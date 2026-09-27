const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const Request = require('../models/Request');
const Donation = require('../models/Donation');
const notificationService = require('../services/notificationService');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function handleError(res, error) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Datos de entrega inválidos' });
  }
  return res.status(500).json({ message: 'No se pudo completar la operación de entrega' });
}

function parseIncidentInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Se requiere un objeto JSON');
  const { description } = body;
  if (typeof description !== 'string' || !description.trim()) throw httpError(400, 'description es obligatoria');
  return { description: description.trim() };
}

const donationPopulate = {
  path: 'donationId',
  select: 'title category quantity unit status companyId',
  populate: { path: 'companyId', select: '_id name', transform: (entity, entityId) => entity || entityId },
};
const requestPopulate = {
  path: 'requestId',
  select: '_id organizationId',
  populate: { path: 'organizationId', select: '_id name status', transform: (entity, entityId) => entity || entityId },
};

// Aplana los dos niveles de populate (donationId.companyId y requestId.organizationId)
// en campos directos, igual que serializeDonation/serializeRequest en los otros controllers.
function serializeDelivery(item) {
  const out = { ...item };
  const donation = out.donationId;
  if (donation && typeof donation === 'object' && donation.title !== undefined) {
    const company = donation.companyId && donation.companyId.name !== undefined ? donation.companyId : null;
    out.donationId = { ...donation, companyId: company?._id ?? donation.companyId, companyName: company?.name ?? null };
  }
  const request = out.requestId;
  if (request && typeof request === 'object' && request.organizationId !== undefined) {
    const org = request.organizationId && request.organizationId.name !== undefined ? request.organizationId : null;
    out.requestId = { _id: request._id, organizationId: org?._id ?? request.organizationId, organizationName: org?.name ?? null };
  }
  return out;
}

// Trae la entrega junto con su solicitud y donación, y resuelve si quien pide
// es la empresa dueña de la donación o la organización dueña de la solicitud.
async function loadDeliveryContext(req) {
  const delivery = await Delivery.findById(req.params.id);
  if (!delivery) throw httpError(404, 'Entrega no encontrada');
  const [request, donation] = await Promise.all([
    Request.findById(delivery.requestId),
    Donation.findById(delivery.donationId),
  ]);
  if (!request || !donation) throw httpError(409, 'La solicitud o donación asociada ya no existe');
  const isCompanyOwner =
    req.user.role === 'empresa' && req.user.entityId && String(donation.companyId) === String(req.user.entityId);
  const isOrgOwner =
    req.user.role === 'organizacion' &&
    req.user.entityId &&
    String(request.organizationId) === String(req.user.entityId);
  return { delivery, request, donation, isCompanyOwner, isOrgOwner };
}

async function listMyDeliveries(req, res) {
  try {
    let filter = {};
    if (req.user.role === 'empresa') {
      const ownDonations = await Donation.find({ companyId: req.user.entityId }).select('_id').lean();
      const ids = ownDonations.map(d => d._id);
      if (ids.length === 0) return res.json({ deliveries: [] });
      filter = { donationId: { $in: ids } };
    } else if (req.user.role === 'organizacion') {
      const ownRequests = await Request.find({ organizationId: req.user.entityId }).select('_id').lean();
      const ids = ownRequests.map(r => r._id);
      if (ids.length === 0) return res.json({ deliveries: [] });
      filter = { requestId: { $in: ids } };
    }
    // admin: sin filtro, ve todas (mismo patrón que donations/requests).
    const deliveries = await Delivery.find(filter)
      .sort({ createdAt: -1 })
      .populate(donationPopulate)
      .populate(requestPopulate)
      .lean();
    return res.json({ deliveries: deliveries.map(serializeDelivery) });
  } catch {
    return res.status(500).json({ message: 'No se pudieron consultar las entregas' });
  }
}

async function shipDelivery(req, res) {
  try {
    const { delivery, donation, request, isCompanyOwner } = await loadDeliveryContext(req);
    if (!isCompanyOwner) throw httpError(403, 'No tienes permisos sobre esta entrega');
    if (delivery.status !== 'Preparando') throw httpError(409, 'La entrega ya fue enviada o tiene otro estado');
    const now = new Date();
    await mongoose.connection.transaction(async session => {
      delivery.status = 'En camino';
      delivery.sentAt = now;
      delivery.history.push({ status: 'En camino', note: 'La empresa marcó la donación como enviada' });
      await delivery.save({ session });

      donation.status = 'En camino';
      donation.history.push({ status: 'En camino', note: 'La empresa marcó la donación como enviada' });
      await donation.save({ session });
    });

    await notificationService.notifyByEntity(
      request.organizationId,
      'donation_shipped',
      'Donación enviada',
      `La donación "${donation.title}" fue marcada como enviada.`,
    );

    return res.json({ delivery });
  } catch (error) {
    return handleError(res, error);
  }
}

async function receiveDelivery(req, res) {
  try {
    const { delivery, donation, isOrgOwner } = await loadDeliveryContext(req);
    if (!isOrgOwner) throw httpError(403, 'No tienes permisos sobre esta entrega');
    if (delivery.status !== 'En camino') throw httpError(409, 'La entrega debe estar en camino para confirmar la recepción');
    const now = new Date();
    await mongoose.connection.transaction(async session => {
      delivery.status = 'Entregada';
      delivery.receivedAt = now;
      delivery.history.push({ status: 'Entregada', note: 'Recepción confirmada por la organización' });
      await delivery.save({ session });

      donation.status = 'Entregada';
      donation.history.push({ status: 'Entregada', note: 'Recepción confirmada por la organización' });
      await donation.save({ session });
    });

    await notificationService.notifyByEntity(
      donation.companyId,
      'donation_received',
      'Entrega confirmada',
      `La organización confirmó la recepción de "${donation.title}".`,
    );

    return res.json({ delivery });
  } catch (error) {
    return handleError(res, error);
  }
}

async function reportIncidentHandler(req, res) {
  try {
    const { delivery, donation, isOrgOwner } = await loadDeliveryContext(req);
    if (!isOrgOwner) throw httpError(403, 'No tienes permisos sobre esta entrega');
    if (delivery.status !== 'En camino') {
      throw httpError(409, 'Solo se puede reportar una incidencia mientras la entrega está en camino');
    }
    const { description } = parseIncidentInput(req.body);
    await mongoose.connection.transaction(async session => {
      delivery.status = 'Incidencia';
      delivery.incident = { hasIncident: true, description };
      delivery.history.push({ status: 'Incidencia', note: description });
      await delivery.save({ session });

      // La donación no cambia de estado por una incidencia: queda registrada en su
      // historial para que la empresa la revise manualmente (ver documento del plan).
      donation.history.push({ status: donation.status, note: `Incidencia reportada: ${description}` });
      await donation.save({ session });
    });

    await notificationService.notifyByEntity(
      donation.companyId,
      'incident_reported',
      'Incidencia reportada',
      `Se reportó una incidencia en la entrega de "${donation.title}": ${description}`,
    );

    return res.json({ delivery });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  listMyDeliveries,
  shipDelivery,
  receiveDelivery,
  reportIncidentHandler,
};
