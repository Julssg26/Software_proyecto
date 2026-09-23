const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Donation = require('../src/models/Donation');
const Request = require('../src/models/Request');
const Delivery = require('../src/models/Delivery');
const Notification = require('../src/models/Notification');

const objectId = () => new mongoose.Types.ObjectId();
const donationFields = () => ({ title: ' Alimentos ', description: 'Descripción', category: 'Alimentos', quantity: 1, unit: 'kg', companyId: objectId() });

test('Donation: campos obligatorios, cantidades, estados e historial', async () => {
  const donation = new Donation(donationFields());
  await donation.validate();
  assert.equal(donation.title, 'Alimentos');
  assert.equal(donation.status, 'Disponible');
  assert.deepEqual(donation.history.toObject(), []);
  for (const key of Object.keys(donationFields())) {
    const fields = donationFields();
    delete fields[key];
    await assert.rejects(new Donation(fields).validate(), { name: 'ValidationError' });
  }
  for (const invalid of [{ quantity: 0 }, { quantity: -1 }, { status: 'Pendiente' }, { expirationDate: 'incorrecta' }, { history: [{ status: 'otro' }] }]) {
    await assert.rejects(new Donation({ ...donationFields(), ...invalid }).validate(), { name: 'ValidationError' });
  }
  for (const status of ['Disponible', 'Solicitada', 'Aprobada', 'En camino', 'Entregada', 'Rechazada']) {
    const doc = new Donation({ ...donationFields(), status, history: [{ status, note: 'Prueba' }] });
    await doc.validate();
    assert.ok(doc.history[0].date instanceof Date);
  }
});

test('Request: referencias obligatorias, fechas y unicidad declarada', async () => {
  const fields = { donationId: objectId(), organizationId: objectId() };
  const request = new Request(fields);
  await request.validate();
  assert.equal(request.status, 'Pendiente');
  assert.ok(request.requestedAt instanceof Date);
  assert.equal(request.reviewedAt, undefined);
  for (const invalid of [{ donationId: undefined }, { organizationId: undefined }, { status: 'En camino' }]) {
    await assert.rejects(new Request({ ...fields, ...invalid }).validate(), { name: 'ValidationError' });
  }
  const index = Request.schema.indexes().find(([keys]) => keys.donationId === 1 && keys.organizationId === 1);
  assert.ok(index);
  assert.equal(index[1].unique, true);
});

test('Delivery: referencias, incidentes e historial', async () => {
  const fields = { requestId: objectId(), donationId: objectId() };
  const delivery = new Delivery(fields);
  await delivery.validate();
  assert.equal(delivery.status, 'Preparando');
  assert.equal(delivery.incident.hasIncident, false);
  for (const invalid of [{ requestId: undefined }, { donationId: undefined }, { status: 'Disponible' }, { history: [{ status: 'otro' }] }]) {
    await assert.rejects(new Delivery({ ...fields, ...invalid }).validate(), { name: 'ValidationError' });
  }
  for (const status of ['Preparando', 'En camino', 'Entregada', 'Incidencia']) {
    await new Delivery({ ...fields, status, history: [{ status }] }).validate();
  }
});

test('Notification: destinatario, texto, tipos y valores predeterminados', async () => {
  const fields = { userId: objectId(), title: 'Prueba', message: 'Mensaje de prueba' };
  const notification = new Notification(fields);
  await notification.validate();
  assert.equal(notification.read, false);
  assert.ok(notification.createdAt instanceof Date);
  assert.equal(notification.updatedAt, undefined);
  for (const key of Object.keys(fields)) {
    await assert.rejects(new Notification({ ...fields, [key]: undefined }).validate(), { name: 'ValidationError' });
  }
  await assert.rejects(new Notification({ ...fields, type: 'otro' }).validate(), { name: 'ValidationError' });
  for (const type of ['new_request', 'request_approved', 'request_rejected', 'donation_shipped', 'donation_received', 'incident_reported']) {
    await new Notification({ ...fields, type }).validate();
  }
});

test('Colecciones, timestamps y referencias respetan el esquema solicitado', () => {
  for (const [model, collection] of [[Donation, 'donations'], [Request, 'requests'], [Delivery, 'deliveries'], [Notification, 'notifications']]) {
    assert.equal(model.collection.collectionName, collection);
    if (model !== Notification) assert.equal(model.schema.options.timestamps, true);
  }
  for (const [model, field, ref] of [
    [Donation, 'companyId', 'Entity'], [Request, 'donationId', 'Donation'],
    [Request, 'organizationId', 'Entity'], [Delivery, 'requestId', 'Request'],
    [Delivery, 'donationId', 'Donation'], [Notification, 'userId', 'User'],
  ]) {
    assert.equal(model.schema.path(field).options.ref, ref);
    assert.equal(model.schema.path(field).instance, 'ObjectId');
  }
});
