const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const Request = require('../src/models/Request');
const Delivery = require('../src/models/Delivery');
const app = require('../src/app');

function queryMock(getResult) {
  const q = {
    select() { return q; },
    lean: async () => getResult(),
  };
  return q;
}

test('Reportes: /api/reports/summary con persistencia simulada', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const id = () => new mongoose.Types.ObjectId();
  const companyEntityId = id();
  const orgEntityId = id();
  const companyDonationIds = [id(), id()];
  const orgRequestIds = [id()];

  const adminUser = { _id: id(), role: 'admin', status: 'active', entityId: null };
  const companyUser = { _id: id(), role: 'empresa', status: 'active', entityId: companyEntityId };
  const orgUser = { _id: id(), role: 'organizacion', status: 'active', entityId: orgEntityId };
  const companyNoEntityUser = { _id: id(), role: 'empresa', status: 'active', entityId: null };
  let authenticatedUser = adminUser;

  t.mock.method(User, 'findById', () => ({ select: async () => authenticatedUser }));

  t.mock.method(Donation, 'countDocuments', filter => {
    if (filter.companyId) {
      return Promise.resolve(filter.status === 'Entregada' ? 1 : 4);
    }
    return Promise.resolve(filter.status === 'Entregada' ? 6 : 15);
  });
  t.mock.method(Donation, 'find', filter => {
    if (String(filter.companyId) === String(companyEntityId)) {
      return queryMock(() => companyDonationIds.map(_id => ({ _id })));
    }
    return queryMock(() => []);
  });
  t.mock.method(Donation, 'aggregate', () =>
    Promise.resolve([
      { _id: 'Alimentos frescos', count: 5 },
      { _id: 'Higiene', count: 2 },
    ]),
  );

  t.mock.method(Request, 'countDocuments', filter => {
    if (filter.organizationId) {
      if (filter.status === 'Aprobada') return Promise.resolve(3);
      if (filter.status === 'Rechazada') return Promise.resolve(1);
      return Promise.resolve(5);
    }
    if (filter.donationId) {
      if (filter.status === 'Rechazada') return Promise.resolve(1);
      return Promise.resolve(4);
    }
    if (filter.status === 'Rechazada') return Promise.resolve(3);
    return Promise.resolve(10);
  });
  t.mock.method(Request, 'find', filter => {
    if (String(filter.organizationId) === String(orgEntityId)) {
      return queryMock(() => orgRequestIds.map(_id => ({ _id })));
    }
    return queryMock(() => []);
  });
  t.mock.method(Request, 'aggregate', pipeline => {
    const match = pipeline[0].$match;
    if (match.status === 'Aprobada') {
      return Promise.resolve([{ _id: null, avgMs: 3_600_000 * 5, count: 2 }]); // 5 horas
    }
    return Promise.resolve([]);
  });

  t.mock.method(Delivery, 'aggregate', pipeline => {
    if (pipeline.some(stage => stage.$lookup)) {
      // Rama de topOrganizations (createdAt/receivedAt no participan aquí).
      return Promise.resolve([{ organizationId: orgEntityId, name: 'Organización real', count: 4 }]);
    }
    // Rama de avgDurationHours (createdAt->receivedAt)
    return Promise.resolve([{ _id: null, avgMs: 3_600_000 * 10, count: 1 }]); // 10 horas
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const request = async (user, qs = '') => {
    const token = jwt.sign({ userId: String(user._id) }, process.env.JWT_SECRET);
    authenticatedUser = user;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reports/summary${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test('Admin recibe métricas globales, top categorías y top organizaciones', async () => {
    const result = await request(adminUser);
    assert.equal(result.status, 200);
    assert.equal(result.body.role, 'admin');
    assert.equal(result.body.donationsPublished, 15);
    assert.equal(result.body.donationsDelivered, 6);
    assert.equal(result.body.rejectionRate, 30); // 3/10
    assert.equal(result.body.avgApprovalHours, 5);
    assert.equal(result.body.avgDeliveryHours, 10);
    assert.deepEqual(result.body.topCategories, [
      { category: 'Alimentos frescos', count: 5 },
      { category: 'Higiene', count: 2 },
    ]);
    assert.equal(result.body.topOrganizations[0].name, 'Organización real');
  });

  await t.test('Empresa recibe métricas acotadas a sus propias donaciones', async () => {
    const result = await request(companyUser);
    assert.equal(result.status, 200);
    assert.equal(result.body.role, 'empresa');
    assert.equal(result.body.donationsPublished, 4);
    assert.equal(result.body.donationsDelivered, 1);
    assert.equal(result.body.rejectionRate, 25); // 1/4
    assert.equal(result.body.topCategories, undefined);
  });

  await t.test('Organización recibe métricas acotadas a sus propias solicitudes', async () => {
    const result = await request(orgUser);
    assert.equal(result.status, 200);
    assert.equal(result.body.role, 'organizacion');
    assert.equal(result.body.requestsSent, 5);
    assert.equal(result.body.requestsApproved, 3);
    assert.equal(result.body.requestsRejected, 1);
    assert.equal(result.body.rejectionRate, 20); // 1/5
  });

  await t.test('Empresa sin Entity todavía recibe ceros en vez de un error', async () => {
    const result = await request(companyNoEntityUser);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      role: 'empresa',
      donationsPublished: 0,
      donationsDelivered: 0,
      rejectionRate: 0,
      avgApprovalHours: null,
      avgDeliveryHours: null,
      from: null,
      to: null,
    });
  });

  await t.test('Filtro de fechas inválido responde 400', async () => {
    const result = await request(adminUser, '?from=no-es-una-fecha');
    assert.equal(result.status, 400);
  });

  await t.test('Filtro de fechas válido se refleja en la respuesta (from/to)', async () => {
    const result = await request(adminUser, '?from=2026-01-01&to=2026-01-31');
    assert.equal(result.status, 200);
    assert.equal(result.body.from, new Date('2026-01-01').toISOString());
    assert.ok(result.body.to.startsWith('2026-01-31'));
  });

  await t.test('Token ausente devuelve 401', async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reports/summary`);
    assert.equal(response.status, 401);
  });
});
