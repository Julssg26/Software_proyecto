const User = require('../models/User');
const Entity = require('../models/Entity');
const Notification = require('../models/Notification');

// Resuelve el usuario dueño de una Entity (empresa u organización) y le crea una
// notificación. Nunca lanza: si algo falla (no hay usuario asociado, error de red,
// etc.) se registra en consola y se continúa, porque una notificación fallida no
// debe tumbar el flujo principal (aprobar, enviar, etc.) que ya se completó.
async function notifyByEntity(entityId, type, title, message) {
  if (!entityId) return null;
  try {
    const user = await User.findOne({ entityId });
    if (!user) return null;
    const notification = new Notification({ userId: user._id, type, title, message });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('No se pudo crear la notificación', error);
    return null;
  }
}

// Solo se usa para componer mensajes más claros (p. ej. "Empresa X te envió una
// donación"); si falla, el llamador debe seguir adelante con un texto genérico.
async function getEntityName(entityId) {
  if (!entityId) return null;
  try {
    const entity = await Entity.findById(entityId).select('name').lean();
    return entity?.name ?? null;
  } catch (error) {
    console.error('No se pudo resolver el nombre de la entidad', error);
    return null;
  }
}

module.exports = { notifyByEntity, getEntityName };
