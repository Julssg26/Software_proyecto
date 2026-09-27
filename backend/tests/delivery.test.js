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

// Ver donation.test.js / request.test.js para el porqué de este helper:
// cualquier método de la cadena (.session, .select, .sort, .populate, .lean)
// devuelve el mismo objeto, y awaitearlo en cualquier punto ejecuta getResult().
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

test('Entregas: rutas, permisos y transiciones con persistencia simulada', async t => {
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
  const admin = { _id: id(), role: 'admin', status: 'active', entityId: null };

  const companyNames = { [String(companyEntityId)]: 'Empresa Uno', [String(otherCompanyEntityId)]: 'Empresa Dos' };
  const organizationNames = { [String(orgEntityId)]: 'Organización Uno', [String(otherOrgEntityId)]: 'Organización Dos' };

  let authenticatedUser = empresa;
  t.mock.method(User, 'findById', () => ({ select: async () => authenticatedUser }));

  const sentNotifications = [];
  t.mock.method(notificationService, 'notifyByEntity', async (entityId, type, title, message) => {
    sentNotifications.push({ entityId: String(entityId), type, title, message });
    return null;
  });

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
  function seedRequest(donationId, organizationId, overrides = {}) {
    const request = new Request({ donationId, organizationId, status: 'Aprobada', ...overrides });
    requests.set(request.id, request.toObject());
    return request;
  }
  function seedDelivery(requestId, donationId, overrides = {}) {
    const delivery = new Delivery({
      requestId,
      donationId,
      status: 'Preparando',
      history: [{ status: 'Preparando', note: 'Entrega en preparación' }],
      ...overrides,
    });
    deliveries.set(delivery.id, delivery.toObject());
    return delivery;
  }
  // Escenario "de fábrica" para los tests de transición: donación Aprobada,
  // con su Request aprobada y su Delivery Preparando, como quedaría tras
  // aprobar una solicitud en el módulo 2.
  function seedApprovedChain() {
    const donation = seedDonation(companyEntityId, { status: 'Aprobada' });
    const request = seedRequest(donation.id, orgEntityId);
    const delivery = seedDelivery(request.id, donation.id);
    return { donation, request, delivery };
  }

  t.mock.method(mongoose.connection, 'transaction', async callback => {
    const before = { donations: new Map(donations), requests: new Map(requests), deliveries: new Map(deliveries) };
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
  t.mock.method(Request, 'find', filter =>
    queryMock(() => {
      let list = [...requests.values()];
      if (filter.organizationId) list = list.filter(r => String(r.organizationId) === String(filter.organizationId));
      return list.map(r => ({ _id: r._id }));
    }),
  );

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
      companyId: name ? { _id: d.companyId, name, status: 'active' } : d.companyId,
    };
  }
  function enrichRequest(requestId) {
    const r = requests.get(String(requestId));
    if (!r) return requestId;
    const name = organizationNames[String(r.organizationId)];
    return { _id: r._id, organizationId: name ? { _id: r.organizationId, name, status: 'active' } : r.organizationId };
  }

  t.mock.method(Delivery, 'findById', docId =>
    queryMock(() => {
      const obj = deliveries.get(String(docId));
      return obj ? new Delivery(obj) : null;
    }),
  );
  t.mock.method(Delivery.prototype, 'save', async function (options) {
    if (options) assert.equal(options.session, fakeSession);
    await this.validate();
    deliveries.set(this.id, this.toObject());
    return this;
  });
  t.mock.method(Delivery, 'find', filter =>
    queryMock(() => {
      let list = [...deliveries.values()];
      if (filter.donationId && filter.donationId.$in) {
        const idSet = new Set(filter.donationId.$in.map(String));
        list = list.filter(d => idSet.has(String(d.donationId)));
      }
      if (filter.requestId && filter.requestId.$in) {
        const idSet = new Set(filter.requestId.$in.map(String));
        list = list.filter(d => idSet.has(String(d.requestId)));
      }
      list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return list.map(d => ({ ...d, donationId: enrichDonation(d.donationId), requestId: enrichRequest(d.requestId) }));
    }),
  );

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const tokenFor = user => jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET);

  const request = async (method, path = '', body, user = empresa) => {
    authenticatedUser = user;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/deliveries${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(user)}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };

  await t.test('Entrega inexistente responde 404 en ship/receive/incident', async () => {
    const fakeId = String(id());
    assert.equal((await request('PATCH', `/${fakeId}/ship`, undefined, empresa)).status, 404);
    assert.equal((await request('PATCH', `/${fakeId}/receive`, undefined, organizacion)).status, 404);
    assert.equal((await request('PATCH', `/${fakeId}/incident`, { description: 'x' }, organizacion)).status, 404);
  });

  await t.test('Una organización no puede marcar envío (rol incorrecto)', async () => {
    const { delivery } = seedApprovedChain();
    const result = await request('PATCH', `/${delivery.id}/ship`, undefined, organizacion);
    assert.equal(result.status, 403);
  });

  await t.test('Otra empresa no puede marcar envío de una entrega ajena', async () => {
    const { delivery } = seedApprovedChain();
    const result = await request('PATCH', `/${delivery.id}/ship`, undefined, otraEmpresa);
    assert.equal(result.status, 403);
  });

  let chain;
  await t.test('La empresa dueña marca el envío: entrega y donación pasan a En camino', async () => {
    chain = seedApprovedChain();
    const result = await request('PATCH', `/${chain.delivery.id}/ship`, undefined, empresa);
    assert.equal(result.status, 200);
    assert.equal(result.body.delivery.status, 'En camino');
    assert.ok(result.body.delivery.sentAt);
    assert.equal(donations.get(chain.donation.id).status, 'En camino');
    const notified = sentNotifications.at(-1);
    assert.equal(notified.entityId, String(orgEntityId));
    assert.equal(notified.type, 'donation_shipped');
  });

  await t.test('No se puede volver a marcar envío de una entrega que ya no está Preparando', async () => {
    const result = await request('PATCH', `/${chain.delivery.id}/ship`, undefined, empresa);
    assert.equal(result.status, 409);
  });

  await t.test('Una empresa no puede confirmar recepción (rol incorrecto)', async () => {
    const result = await request('PATCH', `/${chain.delivery.id}/receive`, undefined, empresa);
    assert.equal(result.status, 403);
  });

  await t.test('Otra organización no puede confirmar recepción ajena', async () => {
    const result = await request('PATCH', `/${chain.delivery.id}/receive`, undefined, otraOrganizacion);
    assert.equal(result.status, 403);
  });

  await t.test('No se puede reportar incidencia sin description', async () => {
    const result = await request('PATCH', `/${chain.delivery.id}/incident`, {}, organizacion);
    assert.equal(result.status, 400);
  });

  await t.test('La organización dueña reporta una incidencia mientras está En camino', async () => {
    // Usamos una segunda cadena para no interferir con la que se confirmará después.
    const chain2 = seedApprovedChain();
    await request('PATCH', `/${chain2.delivery.id}/ship`, undefined, empresa);

    const result = await request('PATCH', `/${chain2.delivery.id}/incident`, { description: 'Llegó incompleta' }, organizacion);
    assert.equal(result.status, 200);
    assert.equal(result.body.delivery.status, 'Incidencia');
    assert.equal(result.body.delivery.incident.hasIncident, true);
    // La donación NO cambia de estado por una incidencia, solo queda registrada en su historial.
    assert.equal(donations.get(chain2.donation.id).status, 'En camino');
    const notified = sentNotifications.at(-1);
    assert.equal(notified.entityId, String(companyEntityId));
    assert.equal(notified.type, 'incident_reported');
  });

  await t.test('No se puede reportar incidencia si la entrega no está En camino', async () => {
    const { delivery } = seedApprovedChain(); // status Preparando
    const result = await request('PATCH', `/${delivery.id}/incident`, { description: 'x' }, organizacion);
    assert.equal(result.status, 409);
  });

  await t.test('La organización dueña confirma recepción: entrega y donación pasan a Entregada', async () => {
    const result = await request('PATCH', `/${chain.delivery.id}/receive`, undefined, organizacion);
    assert.equal(result.status, 200);
    assert.equal(result.body.delivery.status, 'Entregada');
    assert.ok(result.body.delivery.receivedAt);
    assert.equal(donations.get(chain.donation.id).status, 'Entregada');
    const notified = sentNotifications.at(-1);
    assert.equal(notified.entityId, String(companyEntityId));
    assert.equal(notified.type, 'donation_received');
  });

  await t.test('No se puede confirmar recepción dos veces', async () => {
    const result = await request('PATCH', `/${chain.delivery.id}/receive`, undefined, organizacion);
    assert.equal(result.status, 409);
  });

  await t.test('Listados: empresa ve solo las suyas, organización solo las suyas, otra empresa/organización ven vacío', async () => {
    const mine = await request('GET', '/my', undefined, empresa);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.deliveries.length >= 1);
    assert.ok(mine.body.deliveries.every(d => d.donationId.companyName === 'Empresa Uno'));

    const otherCompany = await request('GET', '/my', undefined, otraEmpresa);
    assert.equal(otherCompany.status, 200);
    assert.equal(otherCompany.body.deliveries.length, 0);

    const org = await request('GET', '/my', undefined, organizacion);
    assert.equal(org.status, 200);
    assert.ok(org.body.deliveries.length >= 1);
    assert.ok(org.body.deliveries.every(d => d.requestId.organizationName === 'Organización Uno'));

    const otherOrg = await request('GET', '/my', undefined, otraOrganizacion);
    assert.equal(otherOrg.status, 200);
    assert.equal(otherOrg.body.deliveries.length, 0);
  });

  await t.test('Admin ve todas las entregas sin filtrar', async () => {
    const result = await request('GET', '/my', undefined, admin);
    assert.equal(result.status, 200);
    assert.equal(result.body.deliveries.length, deliveries.size);
  });
});
