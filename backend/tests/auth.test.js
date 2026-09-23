const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const app = require('../src/app');
const authorizeRoles = require('../src/middleware/roleMiddleware');

test('Usuarios y autenticación (persistencia simulada)', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  t.mock.method(User.collection, 'insertOne', async doc => ({ insertedId: doc._id }));
  t.mock.method(User.collection, 'updateOne', async () => ({ matchedCount: 1, modifiedCount: 1 }));
  let storedUser;
  t.mock.method(User, 'findOne', filter => {
    const result = storedUser && storedUser.email === filter.email ? storedUser : null;
    const query = Promise.resolve(result);
    query.select = () => query;
    return query;
  });
  t.mock.method(User, 'findById', id => ({
    select: async () => storedUser && storedUser.id === id ? storedUser : null,
  }));
  t.mock.method(User, 'create', async fields => {
    storedUser = new User(fields);
    await storedUser.save();
    return storedUser;
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const request = async (path, body, token) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const fields = { name: 'Empresa de prueba', email: ' EMPRESA@EXAMPLE.COM ', password: 'prueba123', role: 'empresa' };
  let token;

  await t.test('Rechaza registro público de admin antes de escribir en la base de datos', async () => {
    const result = await request('/register', { ...fields, role: 'admin' });
    assert.equal(result.status, 403);
    assert.equal(result.body.message, 'No está permitido registrar administradores desde este endpoint');
    assert.equal(User.create.mock.callCount(), 0);
    assert.equal(User.findOne.mock.callCount(), 0);
    assert.equal(result.body.token, undefined);
  });
  await t.test('Valida datos obligatorios, contraseña y rol', async () => {
    for (const body of [{}, { ...fields, password: '123' }, { ...fields, role: 'otro' }, { ...fields, email: {} }]) {
      assert.equal((await request('/register', body)).status, 400);
    }
    await assert.rejects(new User({ ...fields, status: 'otro' }).validate(), { name: 'ValidationError' });
  });
  await t.test('Registra, normaliza email, hashea y emite JWT sin exponer password', async () => {
    const result = await request('/register', { ...fields, status: 'inactive' });
    assert.equal(result.status, 201);
    assert.equal(result.body.user.email, 'empresa@example.com');
    assert.equal(result.body.user.status, 'active');
    assert.equal(Object.hasOwn(result.body.user, 'password'), false);
    assert.equal(bcrypt.getRounds(storedUser.password), 10);
    assert.equal(await storedUser.comparePassword(fields.password), true);
    token = result.body.token;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(payload.userId, storedUser.id);
    assert.equal(payload.role, 'empresa');
    assert.equal(payload.exp - payload.iat, 86400);
    assert.equal((await request('/register', fields)).status, 409);
  });
  await t.test('Conserva el hash cuando no cambia la contraseña y lo actualiza cuando cambia', async () => {
    const originalHash = storedUser.password;
    storedUser.name = 'Nombre actualizado';
    await storedUser.save();
    assert.equal(storedUser.password, originalHash);
    storedUser.password = 'otraPrueba123';
    await storedUser.save();
    assert.notEqual(storedUser.password, originalHash);
    assert.equal(await storedUser.comparePassword('otraPrueba123'), true);
  });
  await t.test('Login rechaza credenciales incorrectas y devuelve token sin password', async () => {
    assert.equal((await request('/login', {})).status, 400);
    assert.equal((await request('/login', { email: fields.email, password: 'incorrecta' })).status, 401);
    assert.equal((await request('/login', { email: 'nadie@example.com', password: 'incorrecta' })).status, 401);
    const result = await request('/login', { email: fields.email, password: 'otraPrueba123' });
    assert.equal(result.status, 200);
    assert.ok(result.body.token);
    assert.equal(Object.hasOwn(result.body.user, 'password'), false);
  });
  await t.test('Perfil exige token válido y no expone password', async () => {
    assert.equal((await request('/profile')).status, 401);
    assert.equal((await request('/profile', undefined, 'invalido')).status, 401);
    const expired = jwt.sign({ userId: storedUser.id }, process.env.JWT_SECRET, { expiresIn: -1 });
    assert.equal((await request('/profile', undefined, expired)).status, 401);
    const wrongSignature = jwt.sign({ userId: storedUser.id }, randomBytes(32).toString('hex'));
    assert.equal((await request('/profile', undefined, wrongSignature)).status, 401);
    const result = await request('/profile', undefined, token);
    assert.equal(result.status, 200);
    assert.equal(result.body.user._id, storedUser.id);
    assert.equal(Object.hasOwn(result.body.user, 'password'), false);
  });
  await t.test('Bloquea usuarios inactivos y tokens de usuarios eliminados', async () => {
    storedUser.status = 'inactive';
    assert.equal((await request('/login', { email: fields.email, password: 'otraPrueba123' })).status, 403);
    assert.equal((await request('/profile', undefined, token)).status, 403);
    storedUser = null;
    assert.equal((await request('/profile', undefined, token)).status, 401);
  });
  await t.test('Sin JWT_SECRET no registra usuarios ni permite login', async () => {
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      assert.equal((await request('/register', fields)).status, 500);
      assert.equal(storedUser, null);
      assert.equal((await request('/login', fields)).status, 500);
    } finally {
      process.env.JWT_SECRET = secret;
    }
  });
  await t.test('Autoriza únicamente los roles permitidos', () => {
    const middleware = authorizeRoles('admin', 'empresa');
    let allowed = false;
    middleware({ user: { role: 'empresa' } }, {}, () => { allowed = true; });
    assert.equal(allowed, true);
    for (const req of [{ user: { role: 'organizacion' } }, {}]) {
      const res = { status(code) { assert.equal(code, 403); return this; }, json() {} };
      middleware(req, res, () => assert.fail('No debe autorizar'));
    }
  });
  await t.test('Permite registro público de organización y restaura su rol en el perfil', async () => {
    const result = await request('/register', { ...fields, email: 'org@example.com', role: 'organizacion' });
    assert.equal(result.status, 201);
    assert.equal(result.body.user.role, 'organizacion');
    const profile = await request('/profile', undefined, result.body.token);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.role, 'organizacion');
  });
  await t.test('Un admin creado directamente puede iniciar sesión; ignora el rol enviado al login', async () => {
    storedUser = new User({ ...fields, email: 'admin@example.com', role: 'admin' });
    await storedUser.save();
    const result = await request('/login', { email: storedUser.email, password: fields.password, role: 'empresa' });
    assert.equal(result.status, 200);
    assert.equal(result.body.user.role, 'admin');
    assert.equal(jwt.verify(result.body.token, process.env.JWT_SECRET).role, 'admin');
    const profile = await request('/profile', undefined, result.body.token);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.role, 'admin');
    assert.equal(Object.hasOwn(profile.body.user, 'password'), false);
    storedUser = new User({ ...fields, role: 'empresa' });
    await storedUser.save();
    const company = await request('/login', { email: storedUser.email, password: fields.password, role: 'admin' });
    assert.equal(company.status, 200);
    assert.equal(company.body.user.role, 'empresa');
    assert.equal(jwt.verify(company.body.token, process.env.JWT_SECRET).role, 'empresa');
  });
});
