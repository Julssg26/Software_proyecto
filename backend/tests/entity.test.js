const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Entity = require('../src/models/Entity');
const app = require('../src/app');

test('Entidades: rutas y validación con persistencia simulada', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const user = new User({ name: 'Empresa', email: 'user@example.com', password: 'prueba123', role: 'empresa' });
  const entities = new Map();
  let conflict = false;
  const session = {};
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(mongoose.connection, 'transaction', async callback => {
    const before = new Map(entities);
    try { return await callback(session); } catch (error) {
      entities.clear();
      for (const [id, entity] of before) entities.set(id, entity);
      throw error;
    }
  });
  t.mock.method(Entity.prototype, 'save', async function (options) {
    assert.equal(options.session, session);
    await this.validate();
    entities.set(this.id, this);
    return this;
  });
  t.mock.method(User, 'updateOne', async (filter, update, options) => {
    assert.equal(filter.entityId, null);
    assert.equal(filter.role, user.role);
    assert.equal(filter.status, 'active');
    assert.equal(options.session, session);
    assert.ok(update.$set.entityId instanceof mongoose.Types.ObjectId);
    return { matchedCount: conflict ? 0 : 1 };
  });
  t.mock.method(Entity, 'findById', async id => entities.get(String(id)) || null);
  t.mock.method(Entity, 'findByIdAndUpdate', async (id, update, options) => {
    assert.equal(options.runValidators, true);
    assert.equal(options.new, true);
    const entity = entities.get(String(id));
    if (!entity) return null;
    for (const [key, value] of Object.entries(update.$set)) entity.set(key, value);
    await entity.validate();
    return entity;
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET);
  const request = async (method, path = '', body, authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/entities${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test('Esquema requerido, enums, normalización y referencia', async () => {
    assert.equal(user.entityId, null);
    assert.equal(User.schema.path('entityId').options.ref, 'Entity');
    for (const fields of [{}, { name: 'Nombre', type: 'admin' }, { name: 'Nombre', type: 'empresa', status: 'otro' }]) {
      await assert.rejects(new Entity(fields).validate(), { name: 'ValidationError' });
    }
    const entity = new Entity({ name: 'Nombre', type: 'empresa', email: ' CONTACTO@EXAMPLE.COM ' });
    await entity.validate();
    assert.equal(entity.email, 'contacto@example.com');
    assert.equal(entity.status, 'active');
    assert.equal(Entity.schema.options.timestamps, true);
  });
  await t.test('Todas las rutas requieren autenticación y admin no puede crear', async () => {
    for (const [method, path] of [['POST', ''], ['GET', '/me'], ['PUT', '/me']]) {
      assert.equal((await request(method, path, undefined, false)).status, 401);
    }
    user.role = 'admin';
    assert.equal((await request('POST', '', { name: 'No permitido' })).status, 403);
    user.role = 'empresa';
    assert.equal(entities.size, 0);
  });
  await t.test('Sin entidad responde 404 y valida entrada de creación', async () => {
    assert.equal((await request('GET', '/me')).status, 404);
    assert.equal((await request('PUT', '/me', { name: 'Nuevo' })).status, 404);
    for (const body of [{}, { name: ' ' }, { name: 'Nombre', address: 'incorrecta' }]) {
      assert.equal((await request('POST', '', body)).status, 400);
    }
  });
  await t.test('Crea empresa con tipo del usuario y rechaza duplicados', async () => {
    const result = await request('POST', '', {
      name: 'Empresa ejemplo', type: 'organizacion', status: 'inactive',
      email: ' CONTACTO@EXAMPLE.COM ', address: { city: 'Puebla', street: 'Calle 1' },
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.entity.type, 'empresa');
    assert.equal(result.body.entity.status, 'active');
    assert.equal(result.body.entity.email, 'contacto@example.com');
    assert.equal(String(user.entityId), result.body.entity._id);
    assert.equal((await request('POST', '', { name: 'Duplicada' })).status, 409);
    assert.equal(entities.size, 1);
  });
  await t.test('Consulta y actualiza solo la entidad propia y campos permitidos', async () => {
    assert.equal((await request('GET', '/me')).body.entity._id, String(user.entityId));
    const result = await request('PUT', '/me', {
      name: 'Nuevo nombre', description: 'Descripción', phone: '5551234567',
      address: { city: 'Monterrey' }, type: 'organizacion', status: 'inactive', _id: new mongoose.Types.ObjectId(),
      entityId: new mongoose.Types.ObjectId(), role: 'admin', password: 'no-permitido',
      createdAt: '2000-01-01T00:00:00Z',
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.entity._id, String(user.entityId));
    assert.equal(result.body.entity.name, 'Nuevo nombre');
    assert.equal(result.body.entity.description, 'Descripción');
    assert.equal(result.body.entity.phone, '5551234567');
    assert.equal(result.body.entity.role, undefined);
    assert.equal(result.body.entity.password, undefined);
    assert.equal(result.body.entity.entityId, undefined);
    assert.notEqual(result.body.entity.createdAt, '2000-01-01T00:00:00.000Z');
    assert.equal(result.body.entity.type, 'empresa');
    assert.equal(result.body.entity.status, 'active');
    assert.equal(result.body.entity.address.city, 'Monterrey');
    assert.equal(result.body.entity.address.street, 'Calle 1');
    assert.equal((await request('PUT', '/me', { type: 'organizacion' })).status, 400);
    assert.equal((await request('PUT', '/me', { name: '' })).status, 400);
    assert.equal((await request('PUT', '/me', { address: { city: {} } })).status, 400);
  });
  await t.test('Una referencia inexistente responde 404', async () => {
    user.entityId = new mongoose.Types.ObjectId();
    assert.equal((await request('GET', '/me')).status, 404);
    assert.equal((await request('PUT', '/me', { name: 'Cambio' })).status, 404);
  });
  await t.test('Un conflicto al vincular aborta la transacción', async () => {
    user.entityId = null;
    conflict = true;
    const count = entities.size;
    assert.equal((await request('POST', '', { name: 'Conflicto' })).status, 409);
    assert.equal(entities.size, count);
    assert.equal(user.entityId, null);
    conflict = false;
  });
  await t.test('Organización también puede crear su entidad', async () => {
    user.role = 'organizacion';
    const result = await request('POST', '', { name: 'Organización ejemplo', type: 'empresa' });
    assert.equal(result.status, 201);
    assert.equal(result.body.entity.type, 'organizacion');
    const updated = await request('PUT', '/me', {
      name: 'Organización actualizada', description: 'Apoyo social',
      address: { city: 'Oaxaca' }, email: 'contacto@organizacion.com',
      type: 'empresa', status: 'inactive',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.entity._id, result.body.entity._id);
    assert.equal(updated.body.entity.type, 'organizacion');
    assert.equal(updated.body.entity.status, 'active');
    assert.equal(updated.body.entity.description, 'Apoyo social');
    assert.equal(updated.body.entity.address.city, 'Oaxaca');
    assert.equal(updated.body.entity.email, 'contacto@organizacion.com');
  });
});
