const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const profiles = new Map();
const timestamp = 'server-timestamp';
const authPath = require.resolve('../middleware/verifyFirebaseToken');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, res, next) => {
  const uid = req.headers.authorization?.match(/^Bearer test-(alice|bob)$/)?.[1];
  if (!uid) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  req.user = { uid, email: `${uid}@example.com` };
  next();
} };
const appPath = require.resolve('firebase-admin/app');
require.cache[appPath] = { id: appPath, filename: appPath, loaded: true, exports: { getApp: () => ({}) } };
const firestorePath = require.resolve('firebase-admin/firestore');
const db = {
  collection(name) { assert.equal(name, 'users'); return { doc: uid => uid }; },
  async runTransaction(callback) {
    return callback({ get: async uid => ({ exists: profiles.has(uid) }),
      create: (uid, profile) => { assert.equal(profiles.has(uid), false); profiles.set(uid, profile); } });
  },
};
require.cache[firestorePath] = { id: firestorePath, filename: firestorePath, loaded: true,
  exports: { getFirestore: () => db, FieldValue: { serverTimestamp: () => timestamp } } };
const app = require('../index');
beforeEach(() => profiles.clear());

test('profile initialization requires authentication', async () => {
  assert.equal((await request(app).post('/api/profile').send({})).status, 401);
  assert.equal(profiles.size, 0);
});
test('profile uses verified identity and creates the documented defaults', async () => {
  const response = await request(app).post('/api/profile').set('Authorization', 'Bearer test-alice')
    .send({ displayName: '  Alice  ' });
  assert.equal(response.status, 201);
  assert.deepEqual(profiles.get('alice'), { displayName: 'Alice', email: 'alice@example.com',
    companionStyle: 'casual', createdAt: timestamp, updatedAt: timestamp });
  assert.equal(response.body.profileReady, true);
});
test('optional name defaults to an empty string', async () => {
  assert.equal((await request(app).post('/api/profile').set('Authorization', 'Bearer test-bob').send({})).status, 201);
  assert.equal(profiles.get('bob').displayName, '');
});
test('repeated initialization preserves preferences, identity, and original timestamps', async () => {
  const existing = { displayName: 'Alice', email: 'alice@example.com', companionStyle: 'athlete', createdAt: 'original' };
  profiles.set('alice', existing);
  const response = await request(app).post('/api/profile').set('Authorization', 'Bearer test-alice')
    .send({ displayName: 'New name' });
  assert.equal(response.status, 200);
  assert.deepEqual(profiles.get('alice'), existing);
});
test('caller-supplied UIDs, emails, credentials, and malformed names are rejected', async () => {
  for (const body of [{ uid: 'bob' }, { email: 'bob@example.com' }, { password: 'never-store' },
    { displayName: 123 }, { displayName: 'x'.repeat(101) }, []]) {
    const response = await request(app).post('/api/profile').set('Authorization', 'Bearer test-alice').send(body);
    assert.equal(response.status, 400);
  }
  assert.equal(profiles.size, 0);
});
test('separate accounts create separate profiles', async () => {
  for (const uid of ['alice', 'bob']) await request(app).post('/api/profile')
    .set('Authorization', `Bearer test-${uid}`).send({ displayName: uid });
  assert.equal(profiles.size, 2);
  assert.equal(profiles.get('alice').email, 'alice@example.com');
  assert.equal(profiles.get('bob').email, 'bob@example.com');
});
