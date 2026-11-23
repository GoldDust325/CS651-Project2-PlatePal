import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedFetch } from '../react/lib/authenticatedRequest.js';
import { authMessage } from '../react/lib/authMessages.js';

test('signed-out requests never reach the protected API', async () => {
  let sent = false;
  const send = createAuthenticatedFetch({ getUser: () => null, waitForSession: async () => {},
    fetchImpl: async () => { sent = true; } });
  await assert.rejects(send('/api/profile'), { code: 'auth/session-expired' });
  assert.equal(sent, false);
});

test('waits for restored session and attaches a current Firebase token without changing the body', async () => {
  let restored = false;
  const body = new FormData();
  body.append('photo', new Blob(['photo']), 'meal.jpg');
  const send = createAuthenticatedFetch({ waitForSession: async () => { restored = true; },
    getUser: () => ({ uid: 'alice', getIdToken: async force => {
      assert.equal(restored, true); assert.equal(force, false); return 'firebase-id-token';
    } }),
    fetchImpl: async (url, options) => {
      assert.equal(url, '/api/analyze');
      assert.equal(options.headers.get('Authorization'), 'Bearer firebase-id-token');
      assert.equal(options.headers.get('Accept'), 'application/json');
      assert.equal(options.headers.has('Content-Type'), false);
      assert.equal(options.body, body);
      return new Response(null, { status: 200 });
    } });
  assert.equal((await send('/api/analyze', { method: 'POST', body, headers: { Accept: 'application/json' } })).status, 200);
});

test('an expired token gets exactly one refresh and retry', async () => {
  const refreshes = [];
  const user = { uid: 'alice', getIdToken: async force => { refreshes.push(force); return force ? 'fresh' : 'old'; } };
  let calls = 0;
  const send = createAuthenticatedFetch({ getUser: () => user, waitForSession: async () => {},
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(options.headers.get('Authorization'), calls === 1 ? 'Bearer old' : 'Bearer fresh');
      return new Response(null, { status: calls === 1 ? 401 : 200 });
    } });
  assert.equal((await send('/api/profile')).status, 200);
  assert.deepEqual(refreshes, [false, true]);
});

test('an invalid session signs out after a failed refresh instead of retrying forever', async () => {
  let signOuts = 0, calls = 0;
  const user = { uid: 'alice', getIdToken: async () => 'invalid' };
  const send = createAuthenticatedFetch({ getUser: () => user, waitForSession: async () => {},
    endSession: async () => { signOuts++; }, fetchImpl: async () => { calls++; return new Response(null, { status: 401 }); } });
  await assert.rejects(send('/api/profile'), { code: 'auth/session-expired' });
  assert.equal(signOuts, 1);
  assert.equal(calls, 2);
});

test('switching accounts during token refresh cannot send the previous user’s token', async () => {
  let current;
  const alice = { uid: 'alice', getIdToken: async () => { current = { uid: 'bob' }; return 'alice-token'; } };
  current = alice;
  let sent = false;
  const send = createAuthenticatedFetch({ getUser: () => current, waitForSession: async () => {},
    fetchImpl: async () => { sent = true; } });
  await assert.rejects(send('/api/profile'), { code: 'auth/session-expired' });
  assert.equal(sent, false);
});

test('network failures keep a valid session and auth errors do not expose internal details', async () => {
  const user = { uid: 'alice', getIdToken: async () => 'token' };
  const send = createAuthenticatedFetch({ getUser: () => user, waitForSession: async () => {},
    endSession: async () => assert.fail('A network failure should not sign out'),
    fetchImpl: async () => { throw new TypeError('offline'); } });
  await assert.rejects(send('/api/profile'), /offline/);
  assert.equal(authMessage({ code: 'auth/wrong-password' }), authMessage({ code: 'auth/user-not-found' }));
  assert.match(authMessage({ code: 'auth/email-already-in-use' }), /already has an account/);
  assert.doesNotMatch(authMessage({ message: 'secret internal details' }), /secret/);
});
