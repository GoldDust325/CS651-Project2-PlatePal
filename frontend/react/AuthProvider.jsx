import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from './lib/firebase';

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, loading: true });
  useEffect(() => onIdTokenChanged(auth,
    user => setSession({ user, loading: false }),
    () => setSession({ user: null, loading: false })), []);
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
