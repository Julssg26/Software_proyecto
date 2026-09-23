const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Entity = require('../src/models/Entity');
const Donation = require('../src/models/Donation');
const Request = require('../src/models/Request');
const Delivery = require('../src/models/Delivery');
const Notification = require('../src/models/Notification');
const seedDatabase = require('../scripts/seedDatabase');

test('Seed con persistencia simulada: solo escribe las cuatro colecciones nuevas', async t => {
  const env = { MONGODB_URI: 'mongodb://example.invalid/test' };
  const company = { _id: new mongoose.Types.ObjectId(), type: 'empresa' };
  const organization = { _id: new mongoose.Types.ObjectId(), type: 'organizacion' };
  const user = { _id: new mongoose.Types.ObjectId(), entityId: organization._id };
  let hasCompany = true;
  let hasOrganization = true;
  let hasUser = true;
  const messages = [];
  const written = [];
  const prepared = [];
  const session = {};
  t.mock.method(console, 'log', message => messages.push(message));
  t.mock.method(mongoose, 'connect', async (uri, options) => {
    assert.equal(uri, env.MONGODB_URI);
    assert.deepEqual(options, { dbName: 'donaciones_db', autoCreate: false, autoIndex: false });
  });
  const disconnect = t.mock.method(mongoose, 'disconnect', async () => {});
  t.mock.method(Entity, 'findOne', filter => ({ select: async () => filter.type === 'empresa' ? hasCompany && company : hasOrganization && organization }));
  t.mock.method(User, 'findOne', () => ({ select: async () => hasUser ? user : null }));
  for (const model of [User, Entity]) {
    t.mock.method(model.prototype, 'save', () => assert.fail('No debe guardar usuarios ni entidades'));
    for (const method of ['create', 'updateOne', 'deleteMany', 'createCollection', 'createIndexes']) {
      t.mock.method(model, method, () => assert.fail('No debe modificar usuarios ni entidades'));
    }
  }
  for (const model of [Donation, Request, Delivery, Notification]) {
    t.mock.method(model, 'createCollection', async () => prepared.push(model.modelName));
    t.mock.method(model, 'createIndexes', async () => {});
    t.mock.method(model, 'deleteMany', () => assert.fail('No debe borrar documentos'));
    t.mock.method(model.prototype, 'save', async function (options) {
      assert.equal(options.session, session);
      await this.validate();
      written.push(this);
      return this;
    });
  }
  t.mock.method(mongoose.connection, 'transaction', callback => callback(session));

  await t.test('Sin empresa u organización no escribe datos ni prepara colecciones', async () => {
    hasCompany = false;
    await seedDatabase(env);
    hasCompany = true;
    hasOrganization = false;
    await seedDatabase(env);
    hasOrganization = true;
    assert.equal(messages.at(-1), 'No hay suficientes entidades para generar datos de prueba');
    assert.equal(written.length, 0);
    assert.equal(prepared.length, 0);
  });
  await t.test('Genera cuatro documentos relacionados con entidades y usuario existentes', async () => {
    await seedDatabase(env);
    assert.equal(written.length, 4);
    const [donation, request, delivery, notification] = written;
    assert.equal(String(donation.companyId), String(company._id));
    assert.equal(String(request.organizationId), String(organization._id));
    assert.equal(String(request.donationId), String(donation._id));
    assert.equal(String(delivery.requestId), String(request._id));
    assert.equal(String(delivery.donationId), String(donation._id));
    assert.equal(String(notification.userId), String(user._id));
    assert.equal(donation.status, 'Aprobada');
    assert.equal(request.status, 'Aprobada');
  });
  await t.test('Sin usuarios omite notificaciones sin crear cuentas', async () => {
    hasUser = false;
    await seedDatabase(env);
    assert.equal(written.length, 7);
    assert.match(messages.at(-1), /No hay usuarios existentes/);
  });
  await t.test('Cierra la conexión aunque falle el seed', async () => {
    const previous = disconnect.mock.callCount();
    t.mock.method(mongoose.connection, 'transaction', async () => { throw new Error('Fallo simulado'); });
    await assert.rejects(seedDatabase(env), /Fallo simulado/);
    assert.equal(disconnect.mock.callCount(), previous + 1);
  });
});
