import FormField from './FormField';

export default function LoginForm({ values, onChange, onSubmit, onCreateAccount,
  showAccountForm, loginInput, busy }) {
  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="signin-panel" aria-labelledby="login-heading">
      <p className="eyebrow mb-2">Your seat at the table</p>
      <h2 className="signin-heading mb-4" id="login-heading">Sign in.</h2>
      <form className="login-form" onSubmit={handleSubmit} aria-busy={busy}>
        <FormField id="signin-login" label="Email" type="email" value={values.email}
          onChange={value => onChange('email', value)} autoComplete="username" inputRef={loginInput} required disabled={busy} />
        <FormField id="signin-password" label="Password" type="password" value={values.password}
          onChange={value => onChange('password', value)} autoComplete="current-password" required disabled={busy} />
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="remember-signin" checked={values.remember}
            onChange={event => onChange('remember', event.target.checked)} disabled={busy} />
          <label className="form-check-label" htmlFor="remember-signin">Keep me signed in on this device</label>
        </div>
        <div className="d-flex flex-wrap gap-2 mt-4">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
          <button className="btn btn-outline-primary" type="button" disabled={busy}
            aria-expanded={showAccountForm} onClick={onCreateAccount}>Create Account</button>
        </div>
      </form>
    </section>
  );
}
