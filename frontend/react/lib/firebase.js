import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Public Firebase web configuration; this is not an Admin/service-account key.
// Other projects can supply VITE_FIREBASE_CONFIG as a complete JSON object.
const teamConfig = {
  apiKey: 'AIzaSyA44auTNufQv7qcOQMdSp0E3XHX0z-RyTE',
  authDomain: 'cs651-platepal-project2.firebaseapp.com',
  projectId: 'cs651-platepal-project2',
  appId: '1:1093919822699:web:627e6cf9301791d079722e',
};

const config = import.meta.env.VITE_FIREBASE_CONFIG?.trim();
export const auth = getAuth(initializeApp(config ? JSON.parse(config) : teamConfig));

// Emulator use is restricted to local development, never a production build.
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL);
}
