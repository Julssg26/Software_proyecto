const mongoose = require('mongoose');
const Entity = require('../models/Entity');
const User = require('../models/User');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Solo estos campos pueden escribirse desde el cliente.
function editableFields(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Se requiere un objeto JSON');
  }
  const fields = {};
  for (const key of ['name', 'description', 'email', 'phone']) {
    if (Object.hasOwn(body, key)) {
      if (typeof body[key] !== 'string') throw httpError(400, `${key} debe ser texto`);
      fields[key] = body[key];
    }
  }
  if ((creating || Object.hasOwn(fields, 'name')) && !fields.name?.trim()) {
    throw httpError(400, 'name es obligatorio');
  }
  if (Object.hasOwn(body, 'address')) {
    if (!body.address || typeof body.address !== 'object' || Array.isArray(body.address)) {
      throw httpError(400, 'address debe ser un objeto');
    }
    for (const key of ['street', 'city', 'state', 'postalCode']) {
      if (Object.hasOwn(body.address, key)) {
        if (typeof body.address[key] !== 'string') throw httpError(400, `address.${key} debe ser texto`);
        fields[`address.${key}`] = body.address[key];
      }
    }
  }
  return fields;
}

function handleError(res, error) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Datos de entidad inválidos' });
  }
  return res.status(500).json({ message: 'No se pudo completar la operación de entidad' });
}

async function createEntity(req, res) {
  if (!req.user) return res.status(401).json({ message: 'Autenticación requerida' });
  if (!['empresa', 'organizacion'].includes(req.user.role)) {
    return res.status(403).json({ message: 'No tienes permisos para crear una entidad' });
  }
  if (req.user.entityId) return res.status(409).json({ message: 'Ya tienes una entidad asociada' });
  try {
    const fields = editableFields(req.body, true);
    // Atlas permite confirmar la entidad y su vínculo juntos, o revertir ambos.
    const entity = await mongoose.connection.transaction(async session => {
      const created = new Entity({ type: req.user.role });
      for (const [key, value] of Object.entries(fields)) created.set(key, value);
      await created.save({ session });
      const result = await User.updateOne(
        { _id: req.user._id, entityId: null, role: req.user.role, status: 'active' },
        { $set: { entityId: created._id } },
        { session, runValidators: true },
      );
      if (result.matchedCount !== 1) {
        throw httpError(409, 'El usuario ya tiene una entidad o no puede asociarla');
      }
      return created;
    });
    req.user.entityId = entity._id;
    return res.status(201).json({ entity });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getMyEntity(req, res) {
  if (!req.user.entityId) return res.status(404).json({ message: 'No tienes una entidad asociada' });
  try {
    const entity = await Entity.findById(req.user.entityId);
    if (!entity) return res.status(404).json({ message: 'Entidad no encontrada' });
    return res.json({ entity });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateMyEntity(req, res) {
  if (!req.user.entityId) return res.status(404).json({ message: 'No tienes una entidad asociada' });
  try {
    const fields = editableFields(req.body);
    if (Object.keys(fields).length === 0) throw httpError(400, 'No hay campos permitidos para actualizar');
    const entity = await Entity.findByIdAndUpdate(
      req.user.entityId,
      { $set: fields },
      { new: true, runValidators: true },
    );
    if (!entity) return res.status(404).json({ message: 'Entidad no encontrada' });
    return res.json({ entity });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = { createEntity, getMyEntity, updateMyEntity };
