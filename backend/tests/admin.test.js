const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Entity = require('../src/models/Entity');
const app = require('../src/app');

test('Consultas administrativas con persistencia simulada', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const id = () => new mongoose.Types.ObjectId();
  const admin = { _id: id(), role: 'admin', status: 'active' };
  let authenticatedUser = admin;
  const company = { _id: id(), name: 'Empresa real', type: 'empresa', email: 'empresa@example.com', phone: '555', status: 'active', createdAt: new Date() };
  const organization = { ...company, _id: id(), type: 'organizacion', name: 'Organización real' };
  const users = [
    { ...admin, name: 'Administrador', email: 'admin@example.com', entityId: null, password: 'HASH_NO_PUBLICO', createdAt: new Date(), updatedAt: new Date() },
    { _id: id(), name: 'Empresa', email: 'user@example.com', role: 'empresa', status: 'inactive', entityId: { ...company, password: 'NO_PUBLICO' }, password: 'HASH_NO_PUBLICO' },
  ];
  t.mock.method(User, 'findById', () => ({ select: async () => authenticatedUser }));
  let queries = 0;
  t.mock.method(User, 'find', () => {
    queries++;
    return {
      select(fields) { assert.equal(fields, '_id name email role status entityId createdAt updatedAt'); return this; },
      sort(order) { assert.deepEqual(order, { createdAt: -1 }); return this; },
      populate(options) {
        assert.equal(options.path, 'entityId');
        assert.equal(options.select, '_id name type email phone status');
        const missingId = id();
        assert.equal(options.transform(null, missingId), missingId);
        return this;
      },
      lean: async () => users,
    };
  });
  t.mock.method(Entity, 'find', filter => {
    queries++;
    return {
      select(fields) { assert.equal(fields, '_id name description email phone address status createdAt'); return this; },
      sort(order) { assert.deepEqual(order, { createdAt: -1 }); return this; },
      lean: async () => [company, organization].filter(entity => entity.type === filter.type),
    };
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ userId: String(admin._id), role: 'admin' }, process.env.JWT_SECRET);
  const paths = ['/users', '/entities/companies', '/entities/organizations'];
  const request = async (path, bearer = token) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin${path}`, {
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test('Admin consulta usuarios sin contraseñas, incluso en Entity poblada', async () => {
    const result = await request('/users');
    assert.equal(result.status, 200);
    assert.equal(result.body.users.length, 2);
    assert.equal(result.body.users[0].role, 'admin');
    assert.equal(result.body.users[0].entityId, null);
    assert.equal(result.body.users[0].entity, null);
    assert.equal(result.body.users[1].entityId, String(company._id));
    assert.equal(result.body.users[1].entity.name, company.name);
    assert.equal(result.body.users[1].status, 'inactive');
    assert.equal(JSON.stringify(result.body).includes('password'), false);
    assert.equal(JSON.stringify(result.body).includes('NO_PUBLICO'), false);
  });
  await t.test('Admin consulta solo empresas', async () => {
    const result = await request('/entities/companies');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.entities.map(entity => entity._id), [String(company._id)]);
  });
  await t.test('Admin consulta solo organizaciones', async () => {
    const result = await request('/entities/organizations');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.entities.map(entity => entity._id), [String(organization._id)]);
  });
  await t.test('Empresa y organización reciben 403 en todos los endpoints aunque el token diga admin', async () => {
    const previousQueries = queries;
    for (const role of ['empresa', 'organizacion']) {
      authenticatedUser = { ...admin, role };
      for (const path of paths) assert.equal((await request(path)).status, 403);
    }
    assert.equal(queries, previousQueries);
    authenticatedUser = admin;
  });
  await t.test('Token ausente o inválido devuelve 401', async () => {
    for (const path of paths) {
      assert.equal((await request(path, null)).status, 401);
      assert.equal((await request(path, 'invalido')).status, 401);
    }
  });
  await t.test('Una nueva consulta incorpora usuarios registrados después de la consulta anterior', async () => {
    const before = (await request('/users')).body.users.length;
    users.push({ _id: id(), name: 'Usuario nuevo', email: 'nuevo@example.com', role: 'organizacion', status: 'active', entityId: null });
    const result = await request('/users');
    assert.equal(result.body.users.length, before + 1);
    assert.equal(result.body.users.at(-1).name, 'Usuario nuevo');
  });
});
