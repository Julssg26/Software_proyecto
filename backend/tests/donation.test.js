const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const app = require('../src/app');

test('Donaciones: rutas y permisos con persistencia simulada', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const id = () => new mongoose.Types.ObjectId();
  const companyEntityId = id();
  const otherCompanyEntityId = id();

  const empresa = { _id: id(), role: 'empresa', status: 'active', entityId: companyEntityId };
  const otraEmpresa = { _id: id(), role: 'empresa', status: 'active', entityId: otherCompanyEntityId };
  const empresaSinEntidad = { _id: id(), role: 'empresa', status: 'active', entityId: null };
  const organizacion = { _id: id(), role: 'organizacion', status: 'active', entityId: id() };
  const admin = { _id: id(), role: 'admin', status: 'active', entityId: null };

  const companyNames = {
    [String(companyEntityId)]: 'Empresa Uno',
    [String(otherCompanyEntityId)]: 'Empresa Dos',
  };

  let authenticatedUser = empresa;
  t.mock.method(User, 'findById', () => ({ select: async () => authenticatedUser }));

  // Persistencia simulada en memoria como snapshots planos: cada findById construye
  // un documento Mongoose NUEVO a partir del snapshot, igual que hace la app real
  // (evita que un populate() en un request contamine el estado leído por otro request).
  const donations = new Map();

  t.mock.method(Donation.prototype, 'save', async function () {
    await this.validate();
    donations.set(this.id, this.toObject());
    return this;
  });
  t.mock.method(Donation.prototype, 'deleteOne', async function () {
    donations.delete(this.id);
  });
  t.mock.method(Donation.prototype, 'populate', async function (options) {
    assert.equal(options.path, 'companyId');
    const name = companyNames[String(this.companyId)];
    // Se escribe directo en _doc para simular el resultado de populate() sin que
    // el setter del SchemaType ObjectId recorte el objeto poblado a solo el id.
    if (name) this._doc.companyId = { _id: this.companyId, name, status: 'active' };
    return this;
  });
  t.mock.method(Donation, 'find', filter => {
    let list = [...donations.values()];
    if (filter.companyId) list = list.filter(d => String(d.companyId) === String(filter.companyId));
    if (filter.status) list = list.filter(d => d.status === filter.status);
    return {
      sort() { return this; },
      populate(options) {
        assert.equal(options.path, 'companyId');
        return this;
      },
      lean: async () => list.map(obj => {
        const name = companyNames[String(obj.companyId)];
        return name ? { ...obj, companyId: { _id: obj.companyId, name, status: 'active' } } : obj;
      }),
    };
  });
  t.mock.method(Donation, 'findById', async docId => {
    const obj = donations.get(String(docId));
    return obj ? new Donation(obj) : null;
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const tokenFor = user => jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET);

  const request = async (method, path = '', body, user = empresa) => {
    authenticatedUser = user;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/donations${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor(user)}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };

  const validPayload = {
    title: 'Cajas de arroz',
    description: '50 kg de arroz en buen estado',
    category: 'Alimentos',
    quantity: 50,
    unit: 'kg',
  };

  let createdId;

  await t.test('Una empresa sin entidad no puede publicar donaciones', async () => {
    const result = await request('POST', '', validPayload, empresaSinEntidad);
    assert.equal(result.status, 409);
  });

  await t.test('Una organización no puede publicar donaciones', async () => {
    const result = await request('POST', '', validPayload, organizacion);
    assert.equal(result.status, 403);
  });

  await t.test('Rechaza payload incompleto', async () => {
    const result = await request('POST', '', { title: 'Solo título' }, empresa);
    assert.equal(result.status, 400);
  });

  await t.test('Una empresa con entidad publica una donación válida', async () => {
    const result = await request('POST', '', validPayload, empresa);
    assert.equal(result.status, 201);
    assert.equal(result.body.donation.status, 'Disponible');
    createdId = result.body.donation._id;
    assert.equal(String(result.body.donation.companyId), String(companyEntityId));
    assert.equal(result.body.donation.companyName, 'Empresa Uno');
  });

  await t.test('La organización ve la donación en el listado de disponibles', async () => {
    const result = await request('GET', '', undefined, organizacion);
    assert.equal(result.status, 200);
    assert.equal(result.body.donations.length, 1);
  });

  await t.test('Otra empresa no ve la donación ajena en su listado', async () => {
    const result = await request('GET', '', undefined, otraEmpresa);
    assert.equal(result.status, 200);
    assert.equal(result.body.donations.length, 0);
  });

  await t.test('Otra empresa no puede editar una donación ajena', async () => {
    const result = await request('PUT', `/${createdId}`, { title: 'Hackeado' }, otraEmpresa);
    assert.equal(result.status, 403);
  });

  await t.test('El dueño puede editar su donación mientras está Disponible', async () => {
    const result = await request('PUT', `/${createdId}`, { quantity: 80 }, empresa);
    assert.equal(result.status, 200);
    assert.equal(result.body.donation.quantity, 80);
  });

  await t.test('Una organización puede consultar el detalle si está Disponible', async () => {
    const result = await request('GET', `/${createdId}`, undefined, organizacion);
    assert.equal(result.status, 200);
  });

  await t.test('Cambiar el estado bloquea edición y borrado', async () => {
    const donation = donations.get(String(createdId));
    donation.status = 'Solicitada';

    const editResult = await request('PUT', `/${createdId}`, { quantity: 10 }, empresa);
    assert.equal(editResult.status, 409);

    const deleteResult = await request('DELETE', `/${createdId}`, undefined, empresa);
    assert.equal(deleteResult.status, 409);

    donation.status = 'Disponible';
  });

  await t.test('Una organización ya no ve una donación que dejó de estar Disponible', async () => {
    const donation = donations.get(String(createdId));
    donation.status = 'Solicitada';
    const result = await request('GET', `/${createdId}`, undefined, organizacion);
    assert.equal(result.status, 403);
    donation.status = 'Disponible';
  });

  await t.test('El dueño puede eliminar su donación mientras está Disponible', async () => {
    const result = await request('DELETE', `/${createdId}`, undefined, empresa);
    assert.equal(result.status, 204);
    assert.equal(donations.has(String(createdId)), false);
  });

  await t.test('Admin puede listar todas las donaciones sin filtrar', async () => {
    await request('POST', '', validPayload, empresa);
    const result = await request('GET', '', undefined, admin);
    assert.equal(result.status, 200);
    assert.equal(result.body.donations.length, 1);
  });
});
