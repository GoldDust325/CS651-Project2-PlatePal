export function authMessage(error) {
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-login-credentials': 'The email or password is incorrect.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/missing-password': 'Enter your password.',
    'auth/email-already-in-use': 'This email already has an account. Please sign in.',
    'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
    'auth/password-does-not-meet-requirements': 'Your password does not meet the account security requirements. Choose a stronger password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a little and try again.',
    'auth/network-request-failed': 'We could not reach sign-in. Check your connection and try again.',
    'auth/user-disabled': 'This account is disabled. Contact your PlatePal team.',
    'auth/operation-not-allowed': 'Email and password sign-in needs to be enabled in Firebase.',
    'auth/session-expired': 'Your session has expired. Please sign in again.',
    'auth/user-token-expired': 'Your session has expired. Please sign in again.',
    'auth/invalid-user-token': 'Your session has expired. Please sign in again.',
  };
  return messages[error?.code] || 'We could not complete that request. Please try again.';
}
