const mongoose = require('mongoose');
const Request = require('../models/Request');
const Donation = require('../models/Donation');
const Delivery = require('../models/Delivery');
const notificationService = require('../services/notificationService');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function parseCreateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Se requiere un objeto JSON');
  }
  const { donationId, message } = body;
  if (typeof donationId !== 'string' || !donationId.trim()) {
    throw httpError(400, 'donationId es obligatorio');
  }
  if (message !== undefined && typeof message !== 'string') {
    throw httpError(400, 'message debe ser texto');
  }
  return { donationId: donationId.trim(), message: message ?? '' };
}

function handleError(res, error) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.code === 11000) return res.status(409).json({ message: 'Ya solicitaste esta donación' });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Datos de solicitud inválidos' });
  }
  return res.status(500).json({ message: 'No se pudo completar la operación de solicitud' });
}

const donationPopulate = {
  path: 'donationId',
  select: 'title category quantity unit status companyId',
  populate: { path: 'companyId', select: '_id name', transform: (entity, entityId) => entity || entityId },
};
const organizationPopulate = { path: 'organizationId', select: '_id name status' };

// Aplana donationId.companyId (populado) en companyId + companyName, igual que
// hace serializeDonation en donationController.js, para no anidar dos niveles en la respuesta.
function serializeRequest(item) {
  const donation = item.donationId;
  if (!donation || typeof donation !== 'object' || donation.title === undefined) return item;
  const company = donation.companyId && donation.companyId.name !== undefined ? donation.companyId : null;
  return {
    ...item,
    donationId: { ...donation, companyId: company?._id ?? donation.companyId, companyName: company?.name ?? null },
  };
}

// Trae la solicitud y valida que quien la pide sea la empresa dueña de la donación referenciada.
async function loadOwnedRequest(req) {
  const request = await Request.findById(req.params.id);
  if (!request) throw httpError(404, 'Solicitud no encontrada');
  const donation = await Donation.findById(request.donationId);
  if (!donation) throw httpError(409, 'La donación asociada ya no existe');
  const isOwner = req.user.role === 'empresa' && req.user.entityId && String(donation.companyId) === String(req.user.entityId);
  if (!isOwner) throw httpError(403, 'No tienes permisos sobre esta solicitud');
  return { request, donation };
}

async function createRequest(req, res) {
  if (req.user.role !== 'organizacion') {
    return res.status(403).json({ message: 'Solo una organización puede solicitar una donación' });
  }
  if (!req.user.entityId) {
    return res.status(409).json({ message: 'Debes crear tu entidad antes de solicitar donaciones' });
  }
  let input;
  try {
    input = parseCreateInput(req.body);
  } catch (error) {
    return handleError(res, error);
  }
  try {
    const { request, donation } = await mongoose.connection.transaction(async session => {
      const donation = await Donation.findById(input.donationId).session(session);
      if (!donation) throw httpError(404, 'Donación no encontrada');
      if (donation.status !== 'Disponible') throw httpError(409, 'La donación ya no está disponible');

      const request = new Request({
        donationId: donation._id,
        organizationId: req.user.entityId,
        message: input.message,
      });
      await request.save({ session });

      donation.status = 'Solicitada';
      donation.history.push({ status: 'Solicitada', note: 'Solicitud recibida' });
      await donation.save({ session });

      return { request, donation };
    });

    const orgName = (await notificationService.getEntityName(req.user.entityId)) ?? 'Una organización';
    await notificationService.notifyByEntity(
      donation.companyId,
      'new_request',
      'Nueva solicitud recibida',
      `${orgName} solicitó tu donación "${donation.title}".`,
    );

    return res.status(201).json({ request });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listMyRequests(req, res) {
  try {
    const requests = await Request.find({ organizationId: req.user.entityId })
      .sort({ requestedAt: -1 })
      .populate(donationPopulate)
      .populate(organizationPopulate)
      .lean();
    return res.json({ requests: requests.map(serializeRequest) });
  } catch {
    return res.status(500).json({ message: 'No se pudieron consultar tus solicitudes' });
  }
}

async function listReceivedRequests(req, res) {
  try {
    let filter = {};
    if (req.user.role !== 'admin') {
      const ownDonations = await Donation.find({ companyId: req.user.entityId }).select('_id').lean();
      const donationIds = ownDonations.map(d => d._id);
      if (donationIds.length === 0) return res.json({ requests: [] });
      filter = { donationId: { $in: donationIds } };
    }
    const requests = await Request.find(filter)
      .sort({ requestedAt: -1 })
      .populate(donationPopulate)
      .populate(organizationPopulate)
      .lean();
    return res.json({ requests: requests.map(serializeRequest) });
  } catch {
    return res.status(500).json({ message: 'No se pudieron consultar las solicitudes recibidas' });
  }
}

async function approveRequest(req, res) {
  try {
    const { request, donation } = await loadOwnedRequest(req);
    if (request.status !== 'Pendiente') throw httpError(409, 'La solicitud ya fue resuelta');
    const now = new Date();
    const { delivery } = await mongoose.connection.transaction(async session => {
      request.status = 'Aprobada';
      request.reviewedAt = now;
      await request.save({ session });

      donation.status = 'Aprobada';
      donation.history.push({ status: 'Aprobada', note: 'Solicitud aprobada' });
      await donation.save({ session });

      const delivery = new Delivery({
        requestId: request._id,
        donationId: donation._id,
        status: 'Preparando',
        history: [{ status: 'Preparando', note: 'Entrega en preparación' }],
      });
      await delivery.save({ session });

      // Una donación solo puede tener una entrega en curso: las demás solicitudes
      // pendientes sobre la misma donación quedan automáticamente sin efecto.
      await Request.updateMany(
        { donationId: donation._id, _id: { $ne: request._id }, status: 'Pendiente' },
        { $set: { status: 'Rechazada', reviewedAt: now } },
        { session },
      );

      return { delivery };
    });

    await notificationService.notifyByEntity(
      request.organizationId,
      'request_approved',
      'Solicitud aprobada',
      `Tu solicitud de "${donation.title}" fue aprobada.`,
    );

    return res.json({ request, delivery });
  } catch (error) {
    return handleError(res, error);
  }
}

async function rejectRequest(req, res) {
  try {
    const { request, donation } = await loadOwnedRequest(req);
    if (request.status !== 'Pendiente') throw httpError(409, 'La solicitud ya fue resuelta');
    const now = new Date();
    await mongoose.connection.transaction(async session => {
      request.status = 'Rechazada';
      request.reviewedAt = now;
      await request.save({ session });

      const activeCount = await Request.countDocuments({
        donationId: donation._id,
        status: { $in: ['Pendiente', 'Aprobada'] },
        _id: { $ne: request._id },
      }).session(session);

      // Si esta era la última solicitud activa, la donación vuelve a estar disponible.
      if (activeCount === 0 && donation.status === 'Solicitada') {
        donation.status = 'Disponible';
        donation.history.push({ status: 'Disponible', note: 'Solicitud rechazada, donación disponible nuevamente' });
        await donation.save({ session });
      }
    });

    await notificationService.notifyByEntity(
      request.organizationId,
      'request_rejected',
      'Solicitud rechazada',
      `Tu solicitud de "${donation.title}" fue rechazada.`,
    );

    return res.json({ request });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  createRequest,
  listMyRequests,
  listReceivedRequests,
  approveRequest,
  rejectRequest,
};
