const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

test('Health público y CORS limitado a local y FRONTEND_URL', async t => {
  const previous = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://frontend.example';
  t.after(() => {
    if (previous === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previous;
  });
  const app = require('../src/app');
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/health';
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_URL]) {
    const result = await fetch(url, { headers: { Origin: origin } });
    assert.equal(result.headers.get('access-control-allow-origin'), origin);
  }
  for (const origin of ['https://untrusted.example', 'https://frontend.example.evil']) {
    const result = await fetch(url, { headers: { Origin: origin } });
    assert.equal(result.headers.get('access-control-allow-origin'), null);
  }
  const preflight = await fetch(url, {
    method: 'OPTIONS',
    headers: { Origin: process.env.FRONTEND_URL, 'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), process.env.FRONTEND_URL);
});

test('Servidor y scripts seleccionan la base local o staging sin escribir datos', async t => {
  const previous = process.env.DB_NAME;
  t.after(() => {
    if (previous === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = previous;
  });
  const connect = t.mock.method(mongoose, 'connect', async () => {});
  t.mock.method(mongoose, 'disconnect', async () => {});
  t.mock.method(console, 'log', () => {});
  t.mock.method(require('../src/models/User'), 'exists', async () => ({ _id: 'existing' }));
  t.mock.method(require('../src/models/Entity'), 'findOne', () => ({ select: async () => null }));
  const connectDB = require('../src/config/db');
  const createAdmin = require('../scripts/createAdmin');
  const seedDatabase = require('../scripts/seedDatabase');
  for (const name of [undefined, '', 'donaciones_staging']) {
    if (name === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = name;
    const expected = name || 'donaciones_db';
    await connectDB();
    assert.equal(connect.mock.calls.at(-1).arguments[1].dbName, expected);
    const env = { MONGODB_URI: 'mongodb://example.invalid/test', DB_NAME: name };
    await createAdmin(env);
    assert.equal(connect.mock.calls.at(-1).arguments[1].dbName, expected);
    await seedDatabase(env);
    assert.equal(connect.mock.calls.at(-1).arguments[1].dbName, expected);
  }
});
