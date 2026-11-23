// Optional SDK integration test. Uses only a local demo project, never real users.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile,
} from 'firebase/auth';
import { createAuthenticatedFetch } from '../react/lib/authenticatedRequest.js';

assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Start the Firebase Auth emulator first.');
const projectId = 'demo-platepal';
process.env.FIREBASE_PROJECT_ID = projectId;
const require = createRequire(new URL('../../server/package.json', import.meta.url));
const verifyFirebaseToken = require('./middleware/verifyFirebaseToken.js');
const admin = require('firebase-admin/app');
const app = initializeApp({ apiKey: 'demo-only-api-key', projectId });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
const email = `sdk-test-${Date.now()}@example.test`;
const password = 'Emulator-only-password-123';

try {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  await updateProfile(credential.user, { displayName: 'Emulator Test' });
  await signOut(auth);
  assert.equal(auth.currentUser, null);
  await assert.rejects(signInWithEmailAndPassword(auth, email, 'wrong-password'));
  await signInWithEmailAndPassword(auth, email, password);
  assert.equal(auth.currentUser.uid, uid);
  assert.equal(auth.currentUser.displayName, 'Emulator Test');
  await assert.rejects(createUserWithEmailAndPassword(auth, email, password), { code: 'auth/email-already-in-use' });
  await assert.rejects(createUserWithEmailAndPassword(auth, 'weak@example.test', '123'), { code: 'auth/weak-password' });

  // Exercise the application's header adapter and the actual BE-03 verifier together.
  const send = createAuthenticatedFetch({ getUser: () => auth.currentUser,
    waitForSession: () => auth.authStateReady(), endSession: () => signOut(auth),
    fetchImpl: async (url, options) => {
      let verified = false;
      const req = { headers: { authorization: options.headers.get('Authorization') } };
      const res = { status(code) { throw new Error(`BE-03 rejected emulator token: ${code}`); } };
      await verifyFirebaseToken(req, res, () => { verified = true; });
      assert.equal(verified, true);
      assert.equal(req.user.uid, uid);
      assert.equal(req.user.email, email);
      return Response.json({ authorized: true });
    } });
  assert.equal((await send('/api/protected')).status, 200);
  const second = await createUserWithEmailAndPassword(auth, `second-${email}`, password);
  assert.notEqual(second.user.uid, uid);
  await signOut(auth);
  await assert.rejects(send('/api/protected'), { code: 'auth/session-expired' });
  console.log('PASS: SDK registration, display name, bad password, sign-in, duplicate/weak passwords, distinct users, BE-03 token verification, and sign-out.');
} finally {
  await deleteApp(app);
  await Promise.all(admin.getApps().map(app => admin.deleteApp(app)));
}
