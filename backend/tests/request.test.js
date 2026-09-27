const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const Request = require('../src/models/Request');
const Delivery = require('../src/models/Delivery');
const notificationService = require('../src/services/notificationService');
const app = require('../src/app');

// Envoltorio mínimo de "Query" de Mongoose: cualquier método de la cadena
// (.session, .select, .sort, .populate, .lean) devuelve el mismo objeto, y
// awaitearlo en cualquier punto de la cadena ejecuta getResult(). Así se
// pueden mockear tanto `await Model.findById(id)` como
// `await Model.findById(id).session(s)` con una sola implementación.
function queryMock(getResult) {
  const q = {
    session() { return q; },
    select() { return q; },
    sort() { return q; },
    populate() { return q; },
    lean() { return q; },
    then(resolve, reject) {
      Promise.resolve().then(getResult).then(resolve, reject);
    },
  };
  return q;
}

test('Solicitudes: rutas, permisos y efectos colaterales con persistencia simulada', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const id = () => new mongoose.Types.ObjectId();
  const companyEntityId = id();
  const otherCompanyEntityId = id();
  const orgEntityId = id();
  const otherOrgEntityId = id();

  const empresa = { _id: id(), role: 'empresa', status: 'active', entityId: companyEntityId };
  const otraEmpresa = { _id: id(), role: 'empresa', status: 'active', entityId: otherCompanyEntityId };
  const organizacion = { _id: id(), role: 'organizacion', status: 'active', entityId: orgEntityId };
  const otraOrganizacion = { _id: id(), role: 'organizacion', status: 'active', entityId: otherOrgEntityId };
  const organizacionSinEntidad = { _id: id(), role: 'organizacion', status: 'active', entityId: null };
  const admin = { _id: id(), role: 'admin', status: 'active', entityId: null };

  const organizationNames = {
    [String(orgEntityId)]: 'Organización Uno',
    [String(otherOrgEntityId)]: 'Organización Dos',
  };

  let authenticatedUser = organizacion;
  t.mock.method(User, 'findById', () => ({ select: async () => authenticatedUser }));

  // El envío real de notificaciones se prueba en notification.test.js; aquí solo
  // verificamos QUE se llame (a quién, con qué tipo), sin tocar Mongo de verdad.
  const sentNotifications = [];
  t.mock.method(notificationService, 'notifyByEntity', async (entityId, type, title, message) => {
    sentNotifications.push({ entityId: String(entityId), type, title, message });
    return null;
  });
  t.mock.method(notificationService, 'getEntityName', async entityId => organizationNames[String(entityId)] ?? null);

  // ---- persistencia simulada (snapshots planos, igual que en donation.test.js) ----
  const donations = new Map();
  const requests = new Map();
  const deliveries = new Map();
  const fakeSession = {};

  function seedDonation(companyId, overrides = {}) {
    const donation = new Donation({
      title: 'Cajas de arroz',
      description: '50 kg de arroz en buen estado',
      category: 'Alimentos',
      quantity: 50,
      unit: 'kg',
      companyId,
      status: 'Disponible',
      history: [{ status: 'Disponible', note: 'Donación publicada' }],
      ...overrides,
    });
    donations.set(donation.id, donation.toObject());
    return donation;
  }

  t.mock.method(mongoose.connection, 'transaction', async callback => {
    const before = {
      donations: new Map(donations),
      requests: new Map(requests),
      deliveries: new Map(deliveries),
    };
    try {
      return await callback(fakeSession);
    } catch (error) {
      donations.clear();
      for (const [k, v] of before.donations) donations.set(k, v);
      requests.clear();
      for (const [k, v] of before.requests) requests.set(k, v);
      deliveries.clear();
      for (const [k, v] of before.deliveries) deliveries.set(k, v);
      throw error;
    }
  });

  t.mock.method(Donation, 'findById', docId =>
    queryMock(() => {
      const obj = donations.get(String(docId));
      return obj ? new Donation(obj) : null;
    }),
  );
  t.mock.method(Donation.prototype, 'save', async function (options) {
    if (options) assert.equal(options.session, fakeSession);
    await this.validate();
    donations.set(this.id, this.toObject());
    return this;
  });
  t.mock.method(Donation, 'find', filter =>
    queryMock(() => {
      let list = [...donations.values()];
      if (filter.companyId) list = list.filter(d => String(d.companyId) === String(filter.companyId));
      return list.map(d => ({ _id: d._id }));
    }),
  );

  t.mock.method(Request, 'findById', docId =>
    queryMock(() => {
      const obj = requests.get(String(docId));
      return obj ? new Request(obj) : null;
    }),
  );
  t.mock.method(Request.prototype, 'save', async function (options) {
    if (options) assert.equal(options.session, fakeSession);
    await this.validate();
    const duplicate = [...requests.values()].some(
      r =>
        String(r._id) !== String(this.id) &&
        String(r.donationId) === String(this.donationId) &&
        String(r.organizationId) === String(this.organizationId),
    );
    if (duplicate) {
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      throw err;
    }
    requests.set(this.id, this.toObject());
    return this;
  });
  const companyNames = {
    [String(companyEntityId)]: 'Empresa Uno',
    [String(otherCompanyEntityId)]: 'Empresa Dos',
  };
  function enrichDonation(donationId) {
    const d = donations.get(String(donationId));
    if (!d) return donationId;
    const name = companyNames[String(d.companyId)];
    return {
      _id: d._id,
      title: d.title,
      category: d.category,
      quantity: d.quantity,
      unit: d.unit,
      status: d.status,
      // Simula el resultado crudo del populate anidado (companyId → {_id, name});
      // serializeRequest (código real del controller) es quien lo aplana.
      companyId: name ? { _id: d.companyId, name, status: 'active' } : d.companyId,
    };
  }
  function enrichOrganization(organizationId) {
    const name = organizationNames[String(organizationId)];
    return name ? { _id: organizationId, name, status: 'active' } : organizationId;
  }
  t.mock.method(Request, 'find', filter =>
    queryMock(() => {
      let list = [...requests.values()];
      if (filter.organizationId) list = list.filter(r => String(r.organizationId) === String(filter.organizationId));
      if (filter.donationId && filter.donationId.$in) {
        const idSet = new Set(filter.donationId.$in.map(String));
        list = list.filter(r => idSet.has(String(r.donationId)));
      }
      list = [...list].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
      return list.map(r => ({ ...r, donationId: enrichDonation(r.donationId), organizationId: enrichOrganization(r.organizationId) }));
    }),
  );
  t.mock.method(Request, 'countDocuments', filter =>
    queryMock(() => {
      let list = [...requests.values()];
      if (filter.donationId) list = list.filter(r => String(r.donationId) === String(filter.donationId));
      if (filter.status && filter.status.$in) list = list.filter(r => filter.status.$in.includes(r.status));
      if (filter._id && filter._id.$ne) list = list.filter(r => String(r._id) !== String(filter._id.$ne));
      return list.length;
    }),
  );
  t.mock.method(Request, 'updateMany', async (filter, update, options) => {
    assert.equal(options.session, fakeSession);
    let list = [...requests.values()];
    if (filter.donationId) list = list.filter(r => String(r.donationId) === String(filter.donationId));
    if (filter._id && filter._id.$ne) list = list.filter(r => String(r._id) !== String(filter._id.$ne));
    if (filter.status) list = list.filter(r => r.status === filter.status);
    for (const r of list) Object.assign(r, update.$set);
    return { modifiedCount: list.length };
  });

  t.mock.method(Delivery.prototype, 'save', async function (options) {
    if (options) assert.equal(options.session, fakeSession);
    await this.validate();
    deliveries.set(this.id, this.toObject());
    return this;
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const tokenFor = user => jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET);

  const request = async (method, path = '', body, user = organizacion) => {
    authenticatedUser = user;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/requests${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(user)}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };

  await t.test('Una empresa no puede crear solicitudes', async () => {
    const donation = seedDonation(companyEntityId);
    const result = await request('POST', '', { donationId: donation.id }, empresa);
    assert.equal(result.status, 403);
  });

  await t.test('Una organización sin entidad no puede solicitar', async () => {
    const donation = seedDonation(companyEntityId);
    const result = await request('POST', '', { donationId: donation.id }, organizacionSinEntidad);
    assert.equal(result.status, 409);
  });

  await t.test('Rechaza payload sin donationId', async () => {
    const result = await request('POST', '', {}, organizacion);
    assert.equal(result.status, 400);
  });

  await t.test('Donación inexistente responde 404', async () => {
    const result = await request('POST', '', { donationId: String(id()) }, organizacion);
    assert.equal(result.status, 404);
  });

  let donationId;
  await t.test('Solicitud válida: 201 y la donación pasa a Solicitada', async () => {
    const donation = seedDonation(companyEntityId);
    donationId = donation.id;
    const result = await request('POST', '', { donationId, message: 'La necesitamos para el comedor' }, organizacion);
    assert.equal(result.status, 201);
    assert.equal(result.body.request.status, 'Pendiente');
    assert.equal(donations.get(donationId).status, 'Solicitada');
    const notified = sentNotifications.at(-1);
    assert.equal(notified.entityId, String(companyEntityId));
    assert.equal(notified.type, 'new_request');
    assert.match(notified.message, /Organización Uno/);
  });

  await t.test('La misma organización no puede solicitar la misma donación dos veces', async () => {
    const result = await request('POST', '', { donationId }, organizacion);
    assert.equal(result.status, 409);
  });

  await t.test('Una donación que ya no está Disponible no puede volver a solicitarse por otra organización', async () => {
    const result = await request('POST', '', { donationId }, otraOrganizacion);
    assert.equal(result.status, 409);
  });

  await t.test('La organización ve su solicitud en /my', async () => {
    const result = await request('GET', '/my', undefined, organizacion);
    assert.equal(result.status, 200);
    assert.equal(result.body.requests.length, 1);
    assert.equal(result.body.requests[0].donationId.title, 'Cajas de arroz');
    assert.equal(result.body.requests[0].donationId.companyName, 'Empresa Uno');
  });

  await t.test('Otra organización no ve solicitudes ajenas en /my', async () => {
    const result = await request('GET', '/my', undefined, otraOrganizacion);
    assert.equal(result.status, 200);
    assert.equal(result.body.requests.length, 0);
  });

  await t.test('La empresa dueña ve la solicitud recibida; otra empresa no ve nada', async () => {
    const mine = await request('GET', '/received', undefined, empresa);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.requests.length, 1);
    assert.equal(mine.body.requests[0].organizationId.name, 'Organización Uno');

    const other = await request('GET', '/received', undefined, otraEmpresa);
    assert.equal(other.status, 200);
    assert.equal(other.body.requests.length, 0);
  });

  let requestId;
  await t.test('Otra empresa no puede aprobar ni rechazar una solicitud ajena', async () => {
    requestId = (await request('GET', '/my', undefined, organizacion)).body.requests[0]._id;
    const approve = await request('PATCH', `/${requestId}/approve`, undefined, otraEmpresa);
    assert.equal(approve.status, 403);
    const reject = await request('PATCH', `/${requestId}/reject`, undefined, otraEmpresa);
    assert.equal(reject.status, 403);
  });

  await t.test('Aprobar: crea Delivery, actualiza Donation y rechaza automáticamente otras solicitudes pendientes', async () => {
    // Segunda organización solicita una donación distinta, para comprobar que el
    // rechazo automático al aprobar NO afecta solicitudes de otras donaciones.
    const donation2 = seedDonation(companyEntityId);
    const secondReq = await request('POST', '', { donationId: donation2.id }, otraOrganizacion);
    assert.equal(secondReq.status, 201);

    const result = await request('PATCH', `/${requestId}/approve`, undefined, empresa);
    assert.equal(result.status, 200);
    assert.equal(result.body.delivery.status, 'Preparando');
    assert.equal(donations.get(donationId).status, 'Aprobada');
    assert.equal(deliveries.size, 1);

    // La solicitud de la otra donación NO debe verse afectada (es de una donación distinta).
    assert.equal(requests.get(secondReq.body.request._id).status, 'Pendiente');

    const notified = sentNotifications.at(-1);
    assert.equal(notified.entityId, String(orgEntityId));
    assert.equal(notified.type, 'request_approved');
  });

  await t.test('Aprobar una solicitud ya resuelta responde 409', async () => {
    const result = await request('PATCH', `/${requestId}/approve`, undefined, empresa);
    assert.equal(result.status, 409);
  });

  await t.test('Rechazar libera la donación cuando no quedan solicitudes activas', async () => {
    const donation = seedDonation(companyEntityId);
    const created = await request('POST', '', { donationId: donation.id }, organizacion);
    const reqId = created.body.request._id;

    const result = await request('PATCH', `/${reqId}/reject`, undefined, empresa);
    assert.equal(result.status, 200);
    assert.equal(result.body.request.status, 'Rechazada');
    assert.equal(donations.get(donation.id).status, 'Disponible');
    const notified = sentNotifications.at(-1);
    assert.equal(notified.entityId, String(orgEntityId));
    assert.equal(notified.type, 'request_rejected');
  });

  await t.test('Rechazar una solicitud no libera la donación si queda otra solicitud activa', async () => {
    const donation = seedDonation(companyEntityId);
    const first = await request('POST', '', { donationId: donation.id }, organizacion);
    // Forzamos manualmente una segunda solicitud "activa" en memoria para simular
    // dos organizaciones interesadas (el índice único ya impediría una tercera igual).
    const secondRequestDoc = new Request({ donationId: donation.id, organizationId: otherOrgEntityId, status: 'Pendiente' });
    requests.set(secondRequestDoc.id, secondRequestDoc.toObject());

    const result = await request('PATCH', `/${first.body.request._id}/reject`, undefined, empresa);
    assert.equal(result.status, 200);
    assert.equal(donations.get(donation.id).status, 'Solicitada');
  });

  await t.test('Admin no tiene acceso a /my (no es su rol), pero sí ve todo en /received', async () => {
    const my = await request('GET', '/my', undefined, admin);
    assert.equal(my.status, 403);

    const received = await request('GET', '/received', undefined, admin);
    assert.equal(received.status, 200);
    assert.equal(received.body.requests.length, requests.size);
  });
});
