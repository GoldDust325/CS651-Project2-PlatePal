import { useCallback, useEffect, useRef, useState } from 'react';
import {
  googlePhotosClientId, loadGoogleIdentity, PHOTOS_SCOPE, MAX_PICKED_PHOTOS,
  pickerRequest, pickerUrl, pollingTiming, waitForPoll, listPickedPhotos,
  importGooglePhoto, photoFile,
} from '../lib/googlePhotos';

const busyPhases = new Set(['authorizing', 'starting', 'picking', 'loading', 'importing']);

export default function useGooglePhotos(onSelectPhoto) {
  const [phase, setPhase] = useState('idle');
  const [photos, setPhotos] = useState([]);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [sdk, setSdk] = useState(googlePhotosClientId ? 'loading' : 'unconfigured');
  const activeRequest = useRef(null);
  const token = useRef(null);
  const sessionRef = useRef(null);
  const onSelected = useRef(onSelectPhoto);
  onSelected.current = onSelectPhoto;

  useEffect(() => {
    if (!googlePhotosClientId) return;
    let mounted = true;
    loadGoogleIdentity().then(() => { if (mounted) setSdk('ready'); })
      .catch(() => { if (mounted) setSdk('failed'); });
    return () => { mounted = false; };
  }, []);

  const releaseSession = useCallback(() => {
    const previous = sessionRef.current;
    sessionRef.current = null;
    if (previous) {
      void pickerRequest(`/sessions/${encodeURIComponent(previous.id)}`, previous.token, {
        method: 'DELETE', signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
  }, []);

  const reset = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    releaseSession();
    setSession(null);
    setPhotos([]);
    setPhase('idle');
    setError('');
  }, [releaseSession]);

  useEffect(() => () => {
    activeRequest.current?.abort();
    releaseSession();
    token.current = null;
  }, [releaseSession]);

  async function beginPicking(accessToken, request, popup) {
    let created;
    try {
      setPhase('starting');
      created = await pickerRequest('/sessions', accessToken, {
        method: 'POST', body: { pickingConfig: { maxItemCount: String(MAX_PICKED_PHOTOS) } },
        signal: request.signal,
      });
      request.signal.throwIfAborted();
      const url = pickerUrl(created.pickerUri);
      sessionRef.current = { id: created.id, token: accessToken };
      setSession({ id: created.id, url });
      setPhase('picking');
      // Returning users get an immediately opened window. For a first connection
      // the browser may block an async popup; the same link stays visible in-app.
      if (popup && !popup.closed) popup.location.replace(url);
      else window.open(url, '_blank', 'noopener,noreferrer');

      let current = created;
      let deadline = Infinity;
      while (!current.mediaItemsSet) {
        const timing = pollingTiming(current, Date.now(), deadline);
        deadline = timing.deadline;
        const remaining = deadline - Date.now();
        if (remaining <= 0 || timing.delay >= remaining) {
          throw new Error('Your photo selection timed out. Please choose your photos again.');
        }
        await waitForPoll(timing.delay, request.signal);
        current = await pickerRequest(`/sessions/${encodeURIComponent(created.id)}`, accessToken, { signal: request.signal });
      }
      setPhase('loading');
      const items = await listPickedPhotos(created.id, accessToken, request.signal);
      request.signal.throwIfAborted();
      if (!items.length) throw new Error('No photos were selected. Please choose a photo rather than a video.');
      setPhotos(items);
      setPhase('ready');
    } catch (failure) {
      if (popup && !popup.closed) popup.close();
      if (created?.id && sessionRef.current?.id !== created.id) {
        void pickerRequest(`/sessions/${encodeURIComponent(created.id)}`, accessToken, {
          method: 'DELETE', signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
      if (activeRequest.current !== request || request.signal.aborted) return;
      releaseSession();
      setSession(null);
      setPhase('idle');
      if (failure.status === 401 || failure.status === 403) token.current = null;
      setError(failure.message || 'Google Photos could not connect. Please try again.');
    }
  }

  // Keep authorization directly inside a click handler: Google requires a user
  // gesture. The SDK is loaded ahead of time, never after an awaited click.
  function start() {
    if (!googlePhotosClientId) {
      setError('Google Photos is not connected yet. You can choose a file for now.');
      return;
    }
    if (sdk !== 'ready') {
      setError('Google Photos could not load. Please try again in a moment.');
      setSdk('loading');
      loadGoogleIdentity().then(() => { setSdk('ready'); setError(''); }).catch(() => setSdk('failed'));
      return;
    }
    reset();
    const request = new AbortController();
    activeRequest.current = request;
    if (token.current?.expiresAt > Date.now() + 60000) {
      const popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      void beginPicking(token.current.value, request, popup);
      return;
    }
    setPhase('authorizing');
    const oauth = window.google.accounts.oauth2;
    function authorizationFailed() {
      if (activeRequest.current !== request || request.signal.aborted) return;
      setPhase('idle');
      setError('Google Photos was not connected. Please try again or choose a file.');
    }
    try {
      const client = oauth.initTokenClient({
        client_id: googlePhotosClientId,
        scope: PHOTOS_SCOPE,
        include_granted_scopes: false,
        callback: response => {
          if (activeRequest.current !== request || request.signal.aborted) return;
          if (response.error || !response.access_token || !oauth.hasGrantedAllScopes(response, PHOTOS_SCOPE)) {
            authorizationFailed();
            return;
          }
          token.current = {
            value: response.access_token,
            expiresAt: Date.now() + (Number(response.expires_in) || 0) * 1000,
          };
          void beginPicking(response.access_token, request);
        },
        error_callback: authorizationFailed,
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch { authorizationFailed(); }
  }

  async function choose(photo) {
    const selection = sessionRef.current;
    if (!selection) return;
    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    setError('');
    setPhase('importing');
    try {
      const blob = await importGooglePhoto({
        token: selection.token, sessionId: selection.id, itemId: photo.id, signal: request.signal,
      });
      request.signal.throwIfAborted();
      onSelected.current(photoFile(blob, photo.name), { googlePhotoId: photo.id });
      setPhase('ready');
    } catch (failure) {
      if (activeRequest.current !== request || request.signal.aborted) return;
      setPhase('ready');
      if (failure.status === 401 || failure.status === 403) token.current = null;
      setError(failure.message || 'We could not import that photo. Please try again.');
    }
  }

  function thumbnail(photo, signal) {
    const selection = sessionRef.current;
    if (!selection) return Promise.reject(new DOMException('Selection closed', 'AbortError'));
    return importGooglePhoto({ token: selection.token, sessionId: selection.id, itemId: photo.id, thumbnail: true, signal });
  }

  return { phase, photos, session, error, sdk, busy: busyPhases.has(phase), start, choose, thumbnail, reset };
}
