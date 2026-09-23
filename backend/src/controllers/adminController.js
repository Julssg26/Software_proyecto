const User = require('../models/User');
const Entity = require('../models/Entity');

async function getUsers(req, res) {
  try {
    const users = await User.find({})
      .select('_id name email role status entityId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .populate({
        path: 'entityId',
        select: '_id name type email phone status',
        // Conserva el identificador incluso si la entidad ya no existe.
        transform: (entity, id) => entity || id,
      })
      .lean();
    return res.json({ users: users.map(user => {
      const entity = user.entityId?.name !== undefined ? user.entityId : null;
      return {
        _id: user._id, name: user.name, email: user.email,
        role: user.role, status: user.status,
        entityId: entity?._id ?? user.entityId ?? null,
        createdAt: user.createdAt, updatedAt: user.updatedAt,
        entity: entity ? {
          _id: entity._id, name: entity.name, type: entity.type,
          email: entity.email, phone: entity.phone, status: entity.status,
        } : null,
      };
    }) });
  } catch {
    return res.status(500).json({ message: 'No se pudieron consultar los usuarios' });
  }
}

function listEntities(type) {
  return async (req, res) => {
    try {
      const entities = await Entity.find({ type })
        .select('_id name description email phone address status createdAt')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({ entities });
    } catch {
      return res.status(500).json({ message: 'No se pudieron consultar las entidades' });
    }
  };
}

module.exports = {
  getUsers,
  getCompanies: listEntities('empresa'),
  getOrganizations: listEntities('organizacion'),
};
