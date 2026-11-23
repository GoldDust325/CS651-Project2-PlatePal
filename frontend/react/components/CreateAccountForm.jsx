import { useState } from 'react';
import FormField from './FormField';

export default function CreateAccountForm({ onEnter, busy }) {
  // These fields exist only while this component is displayed.
  const [account, setAccount] = useState({ name: '', email: '', password: '' });

  function updateField(field, value) {
    setAccount(current => ({ ...current, [field]: value }));
  }

  function handleEnter(event) {
    event.preventDefault();
    onEnter(account);
  }

  return (
    <section className="signin-panel" aria-labelledby="account-heading">
      <p className="eyebrow mb-2">Make room for a new pal</p>
      <h2 className="signin-heading mb-4" id="account-heading">Create your account.</h2>
      <form className="create-account-form" onSubmit={handleEnter} aria-busy={busy}>
        <FormField id="account-name" label="Name (optional)" value={account.name}
          onChange={value => updateField('name', value)} autoComplete="name" autoFocus maxLength={100} disabled={busy} />
        <FormField id="account-email" label="Email" type="email" value={account.email}
          onChange={value => updateField('email', value)} autoComplete="email" required disabled={busy} />
        <FormField id="account-password" label="Password" type="password" value={account.password}
          onChange={value => updateField('password', value)} autoComplete="new-password" required minLength={6} disabled={busy} />
        <p className="small">Use at least 6 characters for your password.</p>
        <button className="btn btn-primary mt-2" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create Account'}</button>
      </form>
    </section>
  );
}
