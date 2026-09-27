const Donation = require('../models/Donation');
const Request = require('../models/Request');
const Delivery = require('../models/Delivery');
const Entity = require('../models/Entity');
const User = require('../models/User');

const DONATION_STATUSES = ['Disponible', 'Solicitada', 'Aprobada', 'En camino', 'Entregada', 'Rechazada'];
const REQUEST_STATUSES = ['Pendiente', 'Aprobada', 'Rechazada'];

// Convierte el resultado de un $group por status ([{ _id: 'Disponible', count: 3 }, ...])
// en un objeto con todos los estados posibles en 0, para que el frontend no tenga
// que comprobar si una clave existe antes de leerla.
function toStatusMap(possibleStatuses, groupResult) {
  const map = Object.fromEntries(possibleStatuses.map(status => [status, 0]));
  for (const { _id, count } of groupResult) {
    if (_id in map) map[_id] = count;
  }
  return map;
}

// Total de donaciones, entregadas, solicitudes activas, empresas, organizaciones
// y usuarios activos. Se usan agregaciones/countDocuments en vez de traer los
// documentos completos, tal como sugiere el plan (sección 5.2).
async function getAdminDashboard() {
  const [totalDonations, totalDelivered, activeRequests, totalCompanies, totalOrganizations, activeUsers] =
    await Promise.all([
      Donation.countDocuments({}),
      Donation.countDocuments({ status: 'Entregada' }),
      Request.countDocuments({ status: { $in: ['Pendiente', 'Aprobada'] } }),
      Entity.countDocuments({ type: 'empresa' }),
      Entity.countDocuments({ type: 'organizacion' }),
      User.countDocuments({ status: 'active' }),
    ]);
  return {
    role: 'admin',
    totalDonations,
    totalDelivered,
    activeRequests,
    totalCompanies,
    totalOrganizations,
    activeUsers,
  };
}

// Donaciones propias agrupadas por estado + cuántas solicitudes recibidas están
// pendientes de respuesta. "Recibidas" se resuelve igual que en
// requestController.listReceivedRequests: primero las donaciones propias, luego
// las solicitudes que apuntan a ellas (Request no guarda companyId directamente).
async function getCompanyDashboard(entityId) {
  const [statusGroups, ownDonationIds] = await Promise.all([
    Donation.aggregate([
      { $match: { companyId: entityId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Donation.find({ companyId: entityId }).select('_id').lean(),
  ]);

  const ids = ownDonationIds.map(d => d._id);
  const pendingReceivedRequests = ids.length
    ? await Request.countDocuments({ donationId: { $in: ids }, status: 'Pendiente' })
    : 0;

  return {
    role: 'empresa',
    donationsByStatus: toStatusMap(DONATION_STATUSES, statusGroups),
    pendingReceivedRequests,
  };
}

// Donaciones disponibles en toda la red + solicitudes propias por estado + entregas
// propias pendientes de confirmar (status Delivery = 'En camino').
async function getOrganizationDashboard(entityId) {
  const [totalAvailableDonations, statusGroups, ownRequestIds] = await Promise.all([
    Donation.countDocuments({ status: 'Disponible' }),
    Request.aggregate([
      { $match: { organizationId: entityId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Request.find({ organizationId: entityId }).select('_id').lean(),
  ]);

  const ids = ownRequestIds.map(r => r._id);
  const pendingDeliveries = ids.length
    ? await Delivery.countDocuments({ requestId: { $in: ids }, status: 'En camino' })
    : 0;

  return {
    role: 'organizacion',
    totalAvailableDonations,
    requestsByStatus: toStatusMap(REQUEST_STATUSES, statusGroups),
    pendingDeliveries,
  };
}

async function getDashboard(req, res) {
  try {
    if (req.user.role === 'admin') {
      return res.json(await getAdminDashboard());
    }
    // Empresa/organización sin entidad todavía (recién registrados): responder con
    // ceros en vez de 500, igual que hace el resto del panel antes de crear la Entity.
    if (!req.user.entityId) {
      return res.json(
        req.user.role === 'empresa'
          ? { role: 'empresa', donationsByStatus: toStatusMap(DONATION_STATUSES, []), pendingReceivedRequests: 0 }
          : { role: 'organizacion', totalAvailableDonations: 0, requestsByStatus: toStatusMap(REQUEST_STATUSES, []), pendingDeliveries: 0 },
      );
    }
    if (req.user.role === 'empresa') {
      return res.json(await getCompanyDashboard(req.user.entityId));
    }
    return res.json(await getOrganizationDashboard(req.user.entityId));
  } catch {
    return res.status(500).json({ message: 'No se pudo calcular el dashboard' });
  }
}

module.exports = { getDashboard };
