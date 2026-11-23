import { useEffect, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LoginForm from './components/LoginForm';
import CreateAccountForm from './components/CreateAccountForm';
import AccountBenefits from './components/AccountBenefits';
import { useAuth } from './AuthProvider';
import { signInAccount, registerAccount, initializeUserProfile } from './lib/auth';
import { authMessage } from './lib/authMessages';
import tableCompanion from '../images/table-companion.png';
import '../css/signin.css';

export default function SignIn() {
  const { user, loading } = useAuth();
  const [credentials, setCredentials] = useState({ email: '', password: '', remember: false });
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const loginInput = useRef(null);
  const profileUser = useRef(null);

  // Also recover profile setup when Firebase restores an existing session.
  useEffect(() => {
    if (loading || busy || !user || profileUser.current === user.uid) return;
    profileUser.current = user.uid;
    setBusy(true);
    syncProfile().finally(() => setBusy(false));
  }, [loading, user?.uid, busy]);

  function updateCredentials(field, value) {
    setCredentials(current => ({ ...current, [field]: value }));
    setMessage('');
    setError('');
  }

  async function syncProfile() {
    try {
      await initializeUserProfile();
      setProfilePending(false);
      setMessage('You’re signed in. Your PlatePal account is ready.');
      setError('');
    } catch (failure) {
      setProfilePending(true);
      setError(failure.code?.startsWith('auth/') ? authMessage(failure)
        : 'You’re signed in, but we could not set up your meal profile. Please retry when the backend is available.');
    }
  }

  async function submitAccount(account) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const credential = account ? await registerAccount(account) : await signInAccount(credentials);
      profileUser.current = credential.user.uid;
      setCredentials(current => ({ ...current, password: '' }));
      setShowAccountForm(false);
      await syncProfile();
    } catch (failure) {
      setError(authMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar currentPage="Sign In" />
      <main id="main-content" className="page-content container signin-workspace">
        <header className="signin-hero mb-4">
          <div className="signin-hero__copy">
            <p className="eyebrow">Your PlatePal account</p>
            <h1>Welcome to the table.</h1>
            <p className="lead mt-3">A place for your meals, your goals, and your companion.</p>
          </div>
          <img className="signin-hero__mascot" src={tableCompanion} alt="" width="340" height="244" />
        </header>

        {loading ? <p role="status">Checking your session…</p> : user ? (
          <section className="signin-panel" aria-labelledby="signed-in-heading">
            <h2 className="signin-heading" id="signed-in-heading">You’re signed in.</h2>
            <p>{user.displayName ? `${user.displayName} · ` : ''}{user.email}</p>
            <a className="btn btn-primary" href="./app.html" aria-disabled={busy}
              onClick={event => { if (busy) event.preventDefault(); }}>Continue to App</a>
            {profilePending && <button className="btn btn-outline-primary ms-2" type="button" disabled={busy}
              onClick={async () => { setBusy(true); try { await syncProfile(); } finally { setBusy(false); } }}>Retry profile setup</button>}
          </section>
        ) : (
        <div className="row g-4 align-items-start">
          <div className="col-md-6">
            <LoginForm values={credentials} onChange={updateCredentials}
              onSubmit={() => submitAccount()}
              onCreateAccount={() => { setShowAccountForm(true); setMessage(''); setError(''); }}
              showAccountForm={showAccountForm} loginInput={loginInput} busy={busy} />
          </div>
          <div className="col-md-6">
            {/* Account fields are removed after successful registration. */}
            {showAccountForm ? (
              <CreateAccountForm onEnter={submitAccount} busy={busy} />
            ) : (
              <aside className="signin-invitation" aria-labelledby="invitation-heading">
                <p className="eyebrow mb-2">Pull up a chair</p>
                <h2 className="signin-heading" id="invitation-heading">A pal for every plate.</h2>
                <p>New here? Select Create Account to get started or just hang out and we can cook later.</p>
                <a href="./app.html">Explore the App</a>
              </aside>
            )}
          </div>
        </div>
        )}
        <p className="signin-status mt-3 mb-0" role="status" aria-atomic="true">{message}</p>
        {error && <p className="text-danger mt-3" role="alert">{error}</p>}

        <AccountBenefits />
      </main>
      <Footer />
    </>
  );
}
