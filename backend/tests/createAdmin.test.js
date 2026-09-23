const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const createAdmin = require('../scripts/createAdmin');

test('Inicialización de administrador con persistencia simulada', async t => {
  const env = { MONGODB_URI: 'mongodb://example.invalid/test', ADMIN_NAME: ' Admin de prueba ', ADMIN_EMAIL: ' ADMIN@EXAMPLE.COM ', ADMIN_PASSWORD: 'soloParaPruebas123' };
  const connect = t.mock.method(mongoose, 'connect', async (uri, options) => {
    assert.equal(uri, env.MONGODB_URI);
    assert.equal(options.dbName, 'donaciones_db');
  });
  const disconnect = t.mock.method(mongoose, 'disconnect', async () => {});
  const messages = [];
  t.mock.method(console, 'log', message => messages.push(message));
  let existingAdmin = false;
  let existingEmail = false;
  t.mock.method(User, 'exists', async filter => (filter.role ? existingAdmin : existingEmail) ? { _id: 'exists' } : null);
  const index = t.mock.method(User.collection, 'createIndex', async (keys, options) => {
    assert.deepEqual(keys, { role: 1 });
    assert.equal(options.unique, true);
    assert.deepEqual(options.partialFilterExpression, { role: 'admin' });
  });
  t.mock.method(User, 'init', async () => {});
  let saved;
  const insert = t.mock.method(User.collection, 'insertOne', async doc => {
    saved = doc;
    return { insertedId: doc._id };
  });
  await t.test('Crea con el hash del modelo y cierra MongoDB', async () => {
    await createAdmin(env);
    assert.equal(saved.role, 'admin');
    assert.equal(saved.status, 'active');
    assert.equal(saved.name, 'Admin de prueba');
    assert.equal(saved.email, 'admin@example.com');
    assert.equal(bcrypt.getRounds(saved.password), 10);
    assert.equal(await bcrypt.compare(env.ADMIN_PASSWORD, saved.password), true);
    assert.equal(disconnect.mock.callCount(), 1);
    assert.equal(index.mock.callCount(), 1);
  });
  await t.test('Si existe admin, termina sin credenciales ni nuevas escrituras', async () => {
    existingAdmin = true;
    await createAdmin({ MONGODB_URI: env.MONGODB_URI });
    assert.equal(insert.mock.callCount(), 1);
    assert.equal(index.mock.callCount(), 1);
    assert.equal(messages.at(-1), 'Ya existe un administrador en el sistema');
    existingAdmin = false;
  });
  await t.test('Valida variables y no convierte usuarios existentes en admin', async () => {
    for (const change of [{ ADMIN_NAME: '' }, { ADMIN_EMAIL: 'invalido' }, { ADMIN_PASSWORD: '123' }, { ADMIN_PASSWORD: 'a'.repeat(73) }]) {
      await assert.rejects(createAdmin({ ...env, ...change }));
    }
    existingEmail = true;
    await assert.rejects(createAdmin(env), /ya pertenece a otro usuario/);
    existingEmail = false;
    assert.equal(insert.mock.callCount(), 1);
  });
  await t.test('Una ejecución concurrente no crea otro administrador', async () => {
    insert.mock.mockImplementation(async () => {
      existingAdmin = true;
      throw Object.assign(new Error('Duplicate key'), { code: 11000 });
    });
    await createAdmin(env);
    assert.equal(messages.at(-1), 'Ya existe un administrador en el sistema');
  });
  await t.test('Cierra la conexión también cuando falla connect', async () => {
    const count = disconnect.mock.callCount();
    connect.mock.mockImplementation(async () => { throw new Error('Fallo de conexión simulado'); });
    await assert.rejects(createAdmin(env), /Fallo de conexión simulado/);
    assert.equal(disconnect.mock.callCount(), count + 1);
  });
  assert.equal(disconnect.mock.callCount(), connect.mock.callCount());
});
