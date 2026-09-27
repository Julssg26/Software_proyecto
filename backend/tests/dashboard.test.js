const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const Request = require('../src/models/Request');
const Delivery = require('../src/models/Delivery');
const Entity = require('../src/models/Entity');
const app = require('../src/app');

// Envoltorio mínimo de "Query" de Mongoose: cualquier método de la cadena
// devuelve el mismo objeto y awaitearlo ejecuta getResult(). Igual patrón que
// en request.test.js/delivery.test.js.
function queryMock(getResult) {
  const q = {
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

test('Dashboard: métricas agregadas por rol con persistencia simulada', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const id = () => new mongoose.Types.ObjectId();
  const companyEntityId = id();
  const orgEntityId = id();

  const adminUser = { _id: id(), role: 'admin', status: 'active', entityId: null };
  const companyUser = { _id: id(), role: 'empresa', status: 'active', entityId: companyEntityId };
  const orgUser = { _id: id(), role: 'organizacion', status: 'active', entityId: orgEntityId };
  const companyNoEntityUser = { _id: id(), role: 'empresa', status: 'active', entityId: null };
  let authenticatedUser = adminUser;

  t.mock.method(User, 'findById', () => ({ select: async () => authenticatedUser }));

  // --- Datos para el escenario admin ---
  t.mock.method(Donation, 'countDocuments', filter => {
    if (Object.keys(filter).length === 0) return Promise.resolve(12);
    if (filter.status === 'Entregada') return Promise.resolve(5);
    if (filter.status === 'Disponible') return Promise.resolve(3);
    return Promise.resolve(0);
  });
  t.mock.method(Request, 'countDocuments', filter => {
    if (filter.status && filter.status.$in) return Promise.resolve(4);
    if (filter.status === 'Pendiente') return Promise.resolve(2);
    return Promise.resolve(0);
  });
  t.mock.method(Entity, 'countDocuments', filter => {
    if (filter.type === 'empresa') return Promise.resolve(7);
    if (filter.type === 'organizacion') return Promise.resolve(9);
    return Promise.resolve(0);
  });
  t.mock.method(User, 'countDocuments', filter => {
    if (filter.status === 'active') return Promise.resolve(20);
    return Promise.resolve(0);
  });

  // --- Datos para el escenario empresa ---
  const companyDonationIds = [id(), id()];
  t.mock.method(Donation, 'aggregate', pipeline => {
    const match = pipeline[0].$match;
    if (String(match.companyId) === String(companyEntityId)) {
      return Promise.resolve([
        { _id: 'Disponible', count: 2 },
        { _id: 'Entregada', count: 1 },
      ]);
    }
    return Promise.resolve([]);
  });
  t.mock.method(Donation, 'find', filter => {
    if (String(filter.companyId) === String(companyEntityId)) {
      return queryMock(() => companyDonationIds.map(_id => ({ _id })));
    }
    return queryMock(() => []);
  });
  t.mock.method(Request, 'aggregate', pipeline => {
    const match = pipeline[0].$match;
    if (String(match.organizationId) === String(orgEntityId)) {
      return Promise.resolve([{ _id: 'Pendiente', count: 3 }]);
    }
    return Promise.resolve([]);
  });

  // --- Datos para el escenario organización ---
  const orgRequestIds = [id()];
  t.mock.method(Request, 'find', filter => {
    if (String(filter.organizationId) === String(orgEntityId)) {
      return queryMock(() => orgRequestIds.map(_id => ({ _id })));
    }
    return queryMock(() => []);
  });
  t.mock.method(Delivery, 'countDocuments', filter => {
    if (filter.status === 'En camino') return Promise.resolve(1);
    return Promise.resolve(0);
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const request = async user => {
    const token = jwt.sign({ userId: String(user._id) }, process.env.JWT_SECRET);
    authenticatedUser = user;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test('Admin recibe totales globales calculados con countDocuments', async () => {
    const result = await request(adminUser);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      role: 'admin',
      totalDonations: 12,
      totalDelivered: 5,
      activeRequests: 4,
      totalCompanies: 7,
      totalOrganizations: 9,
      activeUsers: 20,
    });
  });

  await t.test('Empresa recibe sus donaciones por estado y solicitudes pendientes recibidas', async () => {
    const result = await request(companyUser);
    assert.equal(result.status, 200);
    assert.equal(result.body.role, 'empresa');
    assert.deepEqual(result.body.donationsByStatus, {
      Disponible: 2,
      Solicitada: 0,
      Aprobada: 0,
      'En camino': 0,
      Entregada: 1,
      Rechazada: 0,
    });
    assert.equal(result.body.pendingReceivedRequests, 2);
  });

  await t.test('Organización recibe disponibles totales, sus solicitudes por estado y entregas pendientes', async () => {
    const result = await request(orgUser);
    assert.equal(result.status, 200);
    assert.equal(result.body.role, 'organizacion');
    assert.equal(result.body.totalAvailableDonations, 3);
    assert.deepEqual(result.body.requestsByStatus, { Pendiente: 3, Aprobada: 0, Rechazada: 0 });
    assert.equal(result.body.pendingDeliveries, 1);
  });

  await t.test('Empresa sin Entity todavía recibe ceros en vez de un error', async () => {
    const result = await request(companyNoEntityUser);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      role: 'empresa',
      donationsByStatus: {
        Disponible: 0,
        Solicitada: 0,
        Aprobada: 0,
        'En camino': 0,
        Entregada: 0,
        Rechazada: 0,
      },
      pendingReceivedRequests: 0,
    });
  });

  await t.test('Token ausente devuelve 401', async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dashboard`);
    assert.equal(response.status, 401);
  });
});
