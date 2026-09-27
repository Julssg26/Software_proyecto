const Donation = require('../models/Donation');
const Request = require('../models/Request');
const Delivery = require('../models/Delivery');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Parsea ?from=YYYY-MM-DD&to=YYYY-MM-DD. Sin filtros, se usa todo el histórico
// (tal como pide la sección 6.4 del plan: "no romper si no se envían").
function parseDateRange(query) {
  const range = {};
  for (const key of ['from', 'to']) {
    const raw = query[key];
    if (raw === undefined || raw === '') continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) throw httpError(400, `${key} debe ser una fecha válida (YYYY-MM-DD)`);
    range[key] = date;
  }
  if (range.to) range.to.setHours(23, 59, 59, 999); // "to" incluye el día completo.
  return range;
}

// Construye el filtro Mongo para un campo de fecha dado, solo con las llaves presentes.
function dateFilter(field, range) {
  if (!range.from && !range.to) return {};
  const cmp = {};
  if (range.from) cmp.$gte = range.from;
  if (range.to) cmp.$lte = range.to;
  return { [field]: cmp };
}

// Promedio en horas entre dos campos de fecha de un modelo, para los documentos
// que cumplan matchStage. Devuelve null si no hay documentos con ambos campos.
async function avgDurationHours(Model, matchStage, startField, endField) {
  const [result] = await Model.aggregate([
    { $match: { ...matchStage, [startField]: { $ne: null }, [endField]: { $ne: null } } },
    { $project: { diffMs: { $subtract: [`$${endField}`, `$${startField}`] } } },
    { $group: { _id: null, avgMs: { $avg: '$diffMs' }, count: { $sum: 1 } } },
  ]);
  if (!result || result.count === 0) return null;
  return Math.round((result.avgMs / 3_600_000) * 10) / 10; // horas, 1 decimal
}

function toPercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10; // 1 decimal
}

// Top categorías por número de donaciones publicadas (histórico completo o rango).
async function topCategories(range) {
  const rows = await Donation.aggregate([
    { $match: dateFilter('createdAt', range) },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);
  return rows.map(r => ({ category: r._id, count: r.count }));
}

// Top organizaciones receptoras: entregas confirmadas (Delivery.status Entregada),
// unidas a su Request para conocer la organización y a Entity para el nombre.
async function topOrganizations(range) {
  const rows = await Delivery.aggregate([
    { $match: { status: 'Entregada', ...dateFilter('receivedAt', range) } },
    { $lookup: { from: 'requests', localField: 'requestId', foreignField: '_id', as: 'request' } },
    { $unwind: '$request' },
    { $group: { _id: '$request.organizationId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'entities', localField: '_id', foreignField: '_id', as: 'entity' } },
    { $unwind: { path: '$entity', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, organizationId: '$_id', name: { $ifNull: ['$entity.name', null] }, count: 1 } },
  ]);
  return rows;
}

async function getAdminSummary(range) {
  const requestMatch = dateFilter('requestedAt', range);
  const [donationsPublished, donationsDelivered, totalRequests, rejectedRequests, avgApprovalHours, avgDeliveryHours, categories, organizations] =
    await Promise.all([
      Donation.countDocuments(dateFilter('createdAt', range)),
      Donation.countDocuments({ status: 'Entregada', ...dateFilter('updatedAt', range) }),
      Request.countDocuments(requestMatch),
      Request.countDocuments({ status: 'Rechazada', ...requestMatch }),
      avgDurationHours(Request, { status: 'Aprobada', ...requestMatch }, 'requestedAt', 'reviewedAt'),
      avgDurationHours(Delivery, { status: 'Entregada', ...dateFilter('receivedAt', range) }, 'createdAt', 'receivedAt'),
      topCategories(range),
      topOrganizations(range),
    ]);
  return {
    role: 'admin',
    donationsPublished,
    donationsDelivered,
    rejectionRate: toPercent(rejectedRequests, totalRequests),
    avgApprovalHours,
    avgDeliveryHours,
    topCategories: categories,
    topOrganizations: organizations,
  };
}

async function getCompanySummary(entityId, range) {
  const ownDonations = await Donation.find({ companyId: entityId }).select('_id').lean();
  const donationIds = ownDonations.map(d => d._id);
  const requestMatch = { donationId: { $in: donationIds }, ...dateFilter('requestedAt', range) };

  const [donationsPublished, donationsDelivered, totalRequests, rejectedRequests, avgApprovalHours, avgDeliveryHours] =
    await Promise.all([
      Donation.countDocuments({ companyId: entityId, ...dateFilter('createdAt', range) }),
      Donation.countDocuments({ companyId: entityId, status: 'Entregada', ...dateFilter('updatedAt', range) }),
      donationIds.length ? Request.countDocuments(requestMatch) : 0,
      donationIds.length ? Request.countDocuments({ ...requestMatch, status: 'Rechazada' }) : 0,
      donationIds.length
        ? avgDurationHours(Request, { status: 'Aprobada', ...requestMatch }, 'requestedAt', 'reviewedAt')
        : null,
      avgDurationHours(
        Delivery,
        { status: 'Entregada', donationId: { $in: donationIds }, ...dateFilter('receivedAt', range) },
        'createdAt',
        'receivedAt',
      ),
    ]);

  return {
    role: 'empresa',
    donationsPublished,
    donationsDelivered,
    rejectionRate: toPercent(rejectedRequests, totalRequests),
    avgApprovalHours,
    avgDeliveryHours,
  };
}

async function getOrganizationSummary(entityId, range) {
  const requestMatch = { organizationId: entityId, ...dateFilter('requestedAt', range) };
  const ownRequests = await Request.find({ organizationId: entityId }).select('_id').lean();
  const requestIds = ownRequests.map(r => r._id);

  const [requestsSent, requestsApproved, requestsRejected, avgApprovalHours, avgDeliveryHours] = await Promise.all([
    Request.countDocuments(requestMatch),
    Request.countDocuments({ ...requestMatch, status: 'Aprobada' }),
    Request.countDocuments({ ...requestMatch, status: 'Rechazada' }),
    avgDurationHours(Request, { status: 'Aprobada', ...requestMatch }, 'requestedAt', 'reviewedAt'),
    requestIds.length
      ? avgDurationHours(
          Delivery,
          { status: 'Entregada', requestId: { $in: requestIds }, ...dateFilter('receivedAt', range) },
          'createdAt',
          'receivedAt',
        )
      : null,
  ]);

  return {
    role: 'organizacion',
    requestsSent,
    requestsApproved,
    requestsRejected,
    rejectionRate: toPercent(requestsRejected, requestsSent),
    avgApprovalHours,
    avgDeliveryHours,
  };
}

async function getSummary(req, res) {
  let range;
  try {
    range = parseDateRange(req.query);
  } catch (error) {
    return res.status(error.status).json({ message: error.message });
  }
  try {
    let summary;
    if (req.user.role === 'admin') {
      summary = await getAdminSummary(range);
    } else if (!req.user.entityId) {
      // Sin Entity todavía: responder con ceros, igual criterio que el dashboard.
      summary =
        req.user.role === 'empresa'
          ? { role: 'empresa', donationsPublished: 0, donationsDelivered: 0, rejectionRate: 0, avgApprovalHours: null, avgDeliveryHours: null }
          : { role: 'organizacion', requestsSent: 0, requestsApproved: 0, requestsRejected: 0, rejectionRate: 0, avgApprovalHours: null, avgDeliveryHours: null };
    } else if (req.user.role === 'empresa') {
      summary = await getCompanySummary(req.user.entityId, range);
    } else {
      summary = await getOrganizationSummary(req.user.entityId, range);
    }
    return res.json({
      ...summary,
      from: range.from ? range.from.toISOString() : null,
      to: range.to ? range.to.toISOString() : null,
    });
  } catch {
    return res.status(500).json({ message: 'No se pudo calcular el reporte' });
  }
}

module.exports = { getSummary };
