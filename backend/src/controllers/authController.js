const jwt = require('jsonwebtoken');
const User = require('../models/User');

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const normalizeEmail = email => email.trim().toLowerCase();
const createToken = user => jwt.sign(
  { userId: user._id.toString(), role: user.role },
  process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1d' },
);

async function register(req, res) {
  const { name, email, password, role } = req.body || {};
  if (role === 'admin') {
    return res.status(403).json({ message: 'No está permitido registrar administradores desde este endpoint' });
  }
  if (![name, email, password, role].every(hasText)) {
    return res.status(400).json({ message: 'name, email, password y role son obligatorios' });
  }
  if (password.length < 6 || !['empresa', 'organizacion'].includes(role)) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres y el rol debe ser válido' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'JWT_SECRET no está configurado' });
  }
  try {
    const normalizedEmail = normalizeEmail(email);
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }
    const user = await User.create({ name, email: normalizedEmail, password, role });
    return res.status(201).json({ token: createToken(user), user: user.toJSON() });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Datos de usuario inválidos' });
    }
    return res.status(500).json({ message: 'No se pudo registrar el usuario' });
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (![email, password].every(hasText)) {
    return res.status(400).json({ message: 'email y password son obligatorios' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'JWT_SECRET no está configurado' });
  }
  try {
    const user = await User.findOne({ email: normalizeEmail(email) }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Usuario inactivo' });
    }
    return res.json({ token: createToken(user), user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo iniciar sesión' });
  }
}

function getProfile(req, res) {
  return res.json({ user: req.user.toJSON() });
}

module.exports = { register, login, getProfile };
