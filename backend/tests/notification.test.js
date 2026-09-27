const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const app = require('../src/app');

function queryMock(getResult) {
  const q = {
    session() { return q; },
    sort() { return q; },
    lean() { return q; },
    then(resolve, reject) {
      Promise.resolve().then(getResult).then(resolve, reject);
    },
  };
  return q;
}

test('Notificaciones: listar, marcar leída y marcar todas', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const id = () => new mongoose.Types.ObjectId();
  const userA = { _id: id(), role: 'empresa', status: 'active', entityId: id() };
  const userB = { _id: id(), role: 'organizacion', status: 'active', entityId: id() };

  let authenticatedUser = userA;
  t.mock.method(User, 'findById', () => ({ select: async () => authenticatedUser }));

  const notifications = new Map();
  function seedNotification(userId, overrides = {}) {
    const notification = new Notification({
      userId,
      type: 'new_request',
      title: 'Nueva solicitud recibida',
      message: 'Organización X solicitó tu donación "Cajas de arroz".',
      ...overrides,
    });
    notifications.set(notification.id, notification.toObject());
    return notification;
  }

  t.mock.method(Notification, 'findById', docId =>
    queryMock(() => {
      const obj = notifications.get(String(docId));
      return obj ? new Notification(obj) : null;
    }),
  );
  t.mock.method(Notification.prototype, 'save', async function () {
    await this.validate();
    notifications.set(this.id, this.toObject());
    return this;
  });
  t.mock.method(Notification, 'find', filter =>
    queryMock(() => {
      let list = [...notifications.values()];
      if (filter.userId) list = list.filter(n => String(n.userId) === String(filter.userId));
      return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }),
  );
  t.mock.method(Notification, 'updateMany', async (filter, update) => {
    let list = [...notifications.values()];
    if (filter.userId) list = list.filter(n => String(n.userId) === String(filter.userId));
    if (filter.read !== undefined) list = list.filter(n => n.read === filter.read);
    for (const n of list) Object.assign(n, update.$set);
    return { modifiedCount: list.length };
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const tokenFor = user => jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET);

  const request = async (method, path = '', body, user = userA) => {
    authenticatedUser = user;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/notifications${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(user)}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };

  await t.test('Un usuario solo ve sus propias notificaciones', async () => {
    seedNotification(userA._id);
    seedNotification(userB._id);
    const mine = await request('GET', '', undefined, userA);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.notifications.length, 1);
    assert.equal(mine.body.notifications[0].read, false);
  });

  let notifId;
  await t.test('Marcar una notificación propia como leída', async () => {
    notifId = (await request('GET', '', undefined, userA)).body.notifications[0]._id;
    const result = await request('PATCH', `/${notifId}/read`, undefined, userA);
    assert.equal(result.status, 200);
    assert.equal(result.body.notification.read, true);
  });

  await t.test('No se puede marcar como leída una notificación ajena', async () => {
    const otherNotifId = (await request('GET', '', undefined, userB)).body.notifications[0]._id;
    const result = await request('PATCH', `/${otherNotifId}/read`, undefined, userA);
    assert.equal(result.status, 403);
  });

  await t.test('Notificación inexistente responde 404', async () => {
    const result = await request('PATCH', `/${String(id())}/read`, undefined, userA);
    assert.equal(result.status, 404);
  });

  await t.test('Marcar todas como leídas solo afecta las propias', async () => {
    seedNotification(userA._id, { type: 'request_approved', title: 'Aprobada', message: 'x' });
    seedNotification(userA._id, { type: 'request_rejected', title: 'Rechazada', message: 'y' });

    const result = await request('PATCH', '/read-all', undefined, userA);
    assert.equal(result.status, 200);

    const mine = await request('GET', '', undefined, userA);
    assert.ok(mine.body.notifications.every(n => n.read === true));

    const otherUser = await request('GET', '', undefined, userB);
    assert.equal(otherUser.body.notifications[0].read, false);
  });
});
