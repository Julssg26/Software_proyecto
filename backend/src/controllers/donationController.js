const Donation = require('../models/Donation');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Solo estos campos pueden escribirse desde el cliente.
function editableFields(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Se requiere un objeto JSON');
  }
  const fields = {};
  for (const key of ['title', 'description', 'category', 'unit', 'observations']) {
    if (Object.hasOwn(body, key)) {
      if (typeof body[key] !== 'string') throw httpError(400, `${key} debe ser texto`);
      fields[key] = body[key];
    }
  }
  if (Object.hasOwn(body, 'quantity')) {
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw httpError(400, 'quantity debe ser un número mayor o igual a 1');
    }
    fields.quantity = quantity;
  }
  if (Object.hasOwn(body, 'expirationDate')) {
    if (body.expirationDate === null || body.expirationDate === '') {
      fields.expirationDate = null;
    } else {
      const date = new Date(body.expirationDate);
      if (Number.isNaN(date.getTime())) throw httpError(400, 'expirationDate debe ser una fecha válida');
      fields.expirationDate = date;
    }
  }
  if (creating) {
    for (const key of ['title', 'description', 'category', 'quantity', 'unit']) {
      const value = fields[key];
      const missing = value === undefined || (typeof value === 'string' && !value.trim());
      if (missing) throw httpError(400, `${key} es obligatorio`);
    }
  }
  return fields;
}

function handleError(res, error) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Datos de donación inválidos' });
  }
  return res.status(500).json({ message: 'No se pudo completar la operación de donación' });
}

function isOwner(req, donation) {
  return req.user.role === 'empresa'
    && req.user.entityId
    && String(donation.companyId) === String(req.user.entityId);
}

const companyPopulate = {
  path: 'companyId',
  select: '_id name status',
  // Conserva el identificador incluso si la entidad ya no existe.
  transform: (entity, entityId) => entity || entityId,
};

// El frontend necesita el nombre de la empresa dueña sin hacer una consulta aparte;
// aquí se separa companyId (id plano) de companyName (para no romper el contrato existente).
function serializeDonation(donation) {
  const obj = donation.toObject ? donation.toObject() : donation;
  const company = obj.companyId && obj.companyId.name !== undefined ? obj.companyId : null;
  return { ...obj, companyId: company?._id ?? obj.companyId, companyName: company?.name ?? null };
}

async function listDonations(req, res) {
  try {
    const filter = {};
    if (req.user.role === 'empresa') {
      // Una empresa solo ve sus propias donaciones, en cualquier estado.
      filter.companyId = req.user.entityId;
    } else if (req.user.role === 'organizacion') {
      // Una organización solo debe ver lo que está disponible para solicitar.
      filter.status = 'Disponible';
    }
    // admin: sin filtro, ve todas las donaciones (consulta, igual que el resto del panel admin).
    const donations = await Donation.find(filter).sort({ createdAt: -1 }).populate(companyPopulate).lean();
    return res.json({ donations: donations.map(serializeDonation) });
  } catch {
    return res.status(500).json({ message: 'No se pudieron consultar las donaciones' });
  }
}

async function getDonation(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: 'Donación no encontrada' });
    const visible = req.user.role === 'admin'
      || isOwner(req, donation)
      || (req.user.role === 'organizacion' && donation.status === 'Disponible');
    if (!visible) return res.status(403).json({ message: 'No tienes permisos para ver esta donación' });
    await donation.populate(companyPopulate);
    return res.json({ donation: serializeDonation(donation) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createDonation(req, res) {
  if (!req.user.entityId) {
    return res.status(409).json({ message: 'Debes crear tu entidad antes de publicar donaciones' });
  }
  try {
    const fields = editableFields(req.body, true);
    const donation = new Donation({
      ...fields,
      companyId: req.user.entityId,
      status: 'Disponible',
      history: [{ status: 'Disponible', note: 'Donación publicada' }],
    });
    await donation.save();
    await donation.populate(companyPopulate);
    return res.status(201).json({ donation: serializeDonation(donation) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateDonation(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: 'Donación no encontrada' });
    if (!isOwner(req, donation)) {
      return res.status(403).json({ message: 'No tienes permisos para modificar esta donación' });
    }
    if (donation.status !== 'Disponible') {
      return res.status(409).json({ message: 'Solo se puede editar una donación mientras está Disponible' });
    }
    const fields = editableFields(req.body);
    if (Object.keys(fields).length === 0) throw httpError(400, 'No hay campos permitidos para actualizar');
    for (const [key, value] of Object.entries(fields)) donation.set(key, value);
    await donation.save();
    await donation.populate(companyPopulate);
    return res.json({ donation: serializeDonation(donation) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteDonation(req, res) {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: 'Donación no encontrada' });
    if (!isOwner(req, donation)) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar esta donación' });
    }
    if (donation.status !== 'Disponible') {
      return res.status(409).json({ message: 'No se puede eliminar una donación con una solicitud en proceso' });
    }
    await donation.deleteOne();
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  listDonations,
  getDonation,
  createDonation,
  updateDonation,
  deleteDonation,
};
