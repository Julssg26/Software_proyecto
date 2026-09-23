const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return res.status(401).json({ message: 'Se requiere un token Bearer' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'JWT_SECRET no está configurado' });
  }
  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!payload || !mongoose.isObjectIdOrHexString(payload.userId)) {
      return res.status(401).json({ message: 'Token inválido' });
    }
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
  try {
    const user = await User.findById(payload.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Usuario inactivo' });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo verificar el usuario' });
  }
}

module.exports = authMiddleware;
