const path = require('node:path');
const mongoose = require('mongoose');
const Entity = require('../src/models/Entity');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const Request = require('../src/models/Request');
const Delivery = require('../src/models/Delivery');
const Notification = require('../src/models/Notification');

async function seedDatabase(env = process.env) {
  try {
    if (!env.MONGODB_URI?.trim()) throw new Error('Configura MONGODB_URI en backend/.env');
    // No crear colecciones ni índices de User/Entity al cargar sus modelos.
    await mongoose.connect(env.MONGODB_URI, {
      dbName: 'donaciones_db', autoCreate: false, autoIndex: false,
    });
    const company = await Entity.findOne({ type: 'empresa' }).select('_id');
    const organization = await Entity.findOne({ type: 'organizacion' }).select('_id');
    if (!company || !organization) {
      console.log('No hay suficientes entidades para generar datos de prueba');
      return;
    }
    const recipient = await User.findOne({ entityId: organization._id }).select('_id') ||
      await User.findOne({}).select('_id');

    // Preparar únicamente las nuevas colecciones y sus índices, sin eliminar nada.
    for (const model of [Donation, Request, Delivery, Notification]) {
      await model.createCollection();
      await model.createIndexes();
    }
    await mongoose.connection.transaction(async session => {
      const donation = new Donation({
        title: '[PRUEBA] Alimentos para entrega',
        description: 'Documento de prueba para continuar el desarrollo. No es una donación real.',
        category: 'Alimentos no perecederos', quantity: 10, unit: 'kg',
        observations: 'Generado manualmente con npm run seed-db',
        companyId: company._id, status: 'Aprobada',
        history: [
          { status: 'Disponible', note: 'Donación de prueba publicada' },
          { status: 'Solicitada', note: 'Solicitud de prueba recibida' },
          { status: 'Aprobada', note: 'Solicitud de prueba aprobada' },
        ],
      });
      await donation.save({ session });
      const request = new Request({
        donationId: donation._id, organizationId: organization._id,
        message: '[PRUEBA] Solicitud para verificar las relaciones de datos',
        status: 'Aprobada', reviewedAt: new Date(),
      });
      await request.save({ session });
      await new Delivery({
        requestId: request._id, donationId: donation._id,
        history: [{ status: 'Preparando', note: 'Entrega de prueba en preparación' }],
      }).save({ session });
      if (recipient) {
        await new Notification({
          userId: recipient._id, title: '[PRUEBA] Solicitud aprobada',
          message: 'Notificación de prueba para verificar la estructura de datos.',
          type: 'request_approved',
        }).save({ session });
      }
    });
    console.log('Datos de prueba insertados en donaciones_db: 1 donación, 1 solicitud y 1 entrega');
    console.log(recipient ? 'Se insertó 1 notificación de prueba' : 'No hay usuarios existentes; no se generaron notificaciones');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  seedDatabase().catch(() => {
    console.error('No se pudieron generar los datos de prueba. Revisa MONGODB_URI y los permisos de MongoDB Atlas.');
    process.exitCode = 1;
  });
}

module.exports = seedDatabase;
