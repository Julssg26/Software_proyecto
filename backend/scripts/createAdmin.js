const path = require('node:path');
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function createAdmin(env = process.env) {
  try {
    if (!env.MONGODB_URI?.trim()) throw new Error('Configura MONGODB_URI en backend/.env');
    // Usa la misma URI que el servidor, fijando la base solicitada.
    // La conexión se gestiona aquí para garantizar el cierre incluso si falla.
    await mongoose.connect(env.MONGODB_URI, { dbName: env.DB_NAME || 'donaciones_db' });

    if (await User.exists({ role: 'admin' })) {
      console.log('Ya existe un administrador en el sistema');
      return;
    }

    const name = env.ADMIN_NAME?.trim();
    const email = env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = env.ADMIN_PASSWORD;
    if (!name || !email || !password?.trim()) {
      throw new Error('Configura ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD en backend/.env');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('ADMIN_EMAIL debe ser un correo válido');
    }
    if (password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('ADMIN_PASSWORD debe tener al menos 6 caracteres y no superar 72 bytes');
    }
    if (await User.exists({ email })) {
      throw new Error('ADMIN_EMAIL ya pertenece a otro usuario; no se modificó su cuenta');
    }

    // El índice parcial evita dos administradores incluso con ejecuciones simultáneas.
    // Los usuarios empresa y organizacion no están sujetos a esta restricción.
    await User.collection.createIndex({ role: 1 }, {
      name: 'unique_admin_role', unique: true, partialFilterExpression: { role: 'admin' },
    });
    await User.init();
    try {
      // El hook pre-save de User aplica bcrypt con 10 rondas; no hashear aquí.
      await User.create({ name, email, password, role: 'admin', status: 'active' });
    } catch (error) {
      if (error.code === 11000 && await User.exists({ role: 'admin' })) {
        console.log('Ya existe un administrador en el sistema');
        return;
      }
      if (error.code === 11000) throw new Error('ADMIN_EMAIL ya pertenece a otro usuario; no se modificó su cuenta');
      throw error;
    }
    console.log('Administrador creado correctamente');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  createAdmin().catch(error => {
    // No imprimir errores de drivers o validación que puedan incluir credenciales.
    const safeMessage = error.constructor === Error &&
      /^(Configura |ADMIN_)/.test(error.message) ? error.message :
      'No se pudo crear el administrador. Revisa la conexión y los permisos de MongoDB.';
    console.error(safeMessage);
    process.exitCode = 1;
  });
}

module.exports = createAdmin;
