const Notification = require('../models/Notification');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function handleError(res, error) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  return res.status(500).json({ message: 'No se pudo completar la operación de notificaciones' });
}

async function listMyNotifications(req, res) {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({ notifications });
  } catch {
    return res.status(500).json({ message: 'No se pudieron consultar las notificaciones' });
  }
}

async function markRead(req, res) {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) throw httpError(404, 'Notificación no encontrada');
    if (String(notification.userId) !== String(req.user._id)) {
      throw httpError(403, 'No tienes permisos sobre esta notificación');
    }
    notification.read = true;
    await notification.save();
    return res.json({ notification });
  } catch (error) {
    return handleError(res, error);
  }
}

async function markAllRead(req, res) {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    return res.json({ message: 'Notificaciones marcadas como leídas' });
  } catch {
    return res.status(500).json({ message: 'No se pudieron actualizar las notificaciones' });
  }
}

module.exports = { listMyNotifications, markRead, markAllRead };
