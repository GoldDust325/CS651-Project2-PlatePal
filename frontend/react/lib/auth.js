import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'firebase/auth';
import { auth } from './firebase';
import { createAuthenticatedFetch } from './authenticatedRequest';

export const authenticatedFetch = createAuthenticatedFetch({
  getUser: () => auth.currentUser,
  waitForSession: () => auth.authStateReady(),
  endSession: () => signOut(auth),
});

export async function signInAccount({ email, password, remember }) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function registerAccount({ email, password, name }) {
  await setPersistence(auth, browserSessionPersistence);
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
  return credential;
}

export function signOutAccount() {
  return signOut(auth);
}

export async function initializeUserProfile() {
  const origin = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') || '';
  const response = await authenticatedFetch(`${origin}/api/profile`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ displayName: auth.currentUser?.displayName || '' }),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Your account is signed in, but your meal profile could not be set up. Please retry.');
  }
  return response.json();
}
