// Keep token refresh/retry independent of React so every protected API can reuse it.
export function createAuthenticatedFetch({ getUser, waitForSession, endSession, fetchImpl = fetch }) {
  return async function authenticatedFetch(url, options = {}) {
    await waitForSession();
    const user = getUser();
    if (!user) throw Object.assign(new Error('Please sign in to continue.'), { code: 'auth/session-expired' });

    const send = async forceRefresh => {
      const token = await user.getIdToken(forceRefresh);
      // Do not send a token if the account changed while it was being refreshed.
      if (getUser()?.uid !== user.uid) {
        throw Object.assign(new Error('Please sign in again.'), { code: 'auth/session-expired' });
      }
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return fetchImpl(url, { ...options, headers });
    };

    try {
      let response = await send(false);
      if (response.status === 401) response = await send(true);
      if (response.status === 401) {
        if (getUser()?.uid === user.uid) await endSession();
        throw Object.assign(new Error('Your session has expired. Please sign in again.'), { code: 'auth/session-expired' });
      }
      return response;
    } catch (error) {
      if (['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled'].includes(error.code)
        && getUser()?.uid === user.uid) await endSession();
      throw error;
    }
  };
}
