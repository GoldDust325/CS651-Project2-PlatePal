// Google Photos access is requested only when the user presses Google Photos.
// Keep access tokens in memory. Never put them in a URL or browser storage.
export const PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
export const MAX_PICKED_PHOTOS = 12;
const PICKER_API = 'https://photospicker.googleapis.com/v1';
const settings = import.meta.env ?? {};
export const googlePhotosClientId = settings.VITE_GOOGLE_PHOTOS_CLIENT_ID?.trim() || '';
const apiBase = (settings.VITE_API_BASE_URL || '').replace(/\/$/, '');
let sdkPromise;

export function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = setTimeout(fail, 15000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      sdkPromise = undefined;
      reject(new Error('Google Photos could not load. Please try again.'));
    }
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      if (window.google?.accounts?.oauth2) resolve(window.google.accounts.oauth2);
      else fail();
    };
    document.head.append(script);
  });
  return sdkPromise;
}

export function pickerUrl(uri) {
  const url = new URL(uri);
  if (url.protocol !== 'https:' || url.hostname !== 'photos.google.com' || url.username || url.password || url.port) {
    throw new Error('Google returned an invalid photo picker link. Please try again.');
  }
  url.pathname = url.pathname.replace(/\/(autoclose\/?)?$/, '') + '/autoclose';
  return url.href;
}

function seconds(value, fallback) {
  return typeof value === 'string' && /^\d+(\.\d+)?s$/.test(value)
    ? Number.parseFloat(value) * 1000 : fallback;
}

export function pollingTiming(session, now = Date.now(), previousDeadline = Infinity) {
  const expires = Date.parse(session.expireTime);
  const timeout = seconds(session.pollingConfig?.timeoutIn, 10 * 60 * 1000);
  return {
    delay: Math.max(1000, seconds(session.pollingConfig?.pollInterval, 5000)),
    deadline: Math.min(previousDeadline, now + timeout, Number.isFinite(expires) ? expires : Infinity),
  };
}

export function waitForPoll(ms, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(done, ms);
    function done() { signal.removeEventListener('abort', abort); resolve(); }
    function abort() { clearTimeout(timer); reject(signal.reason); }
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function pickerRequest(path, token, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${PICKER_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  if (!response.ok) {
    const messages = {
      401: 'Your Google Photos connection expired. Please connect again.',
      403: 'Google Photos access was not granted. Please reconnect and allow photo selection.',
      404: 'This photo selection expired. Please choose your photos again.',
      429: 'Google Photos is busy. Please try again in a moment.',
    };
    const error = new Error(messages[response.status] || 'Google Photos could not complete your selection. Please try again.');
    error.status = response.status;
    throw error;
  }
  return response.status === 204 || method === 'DELETE' ? null : response.json();
}

export async function listPickedPhotos(sessionId, token, signal) {
  const photos = [];
  let pageToken;
  do {
    const query = new URLSearchParams({ sessionId, pageSize: '100', ...(pageToken ? { pageToken } : {}) });
    const result = await pickerRequest(`/mediaItems?${query}`, token, { signal });
    for (const item of result.mediaItems || []) {
      if (item.type === 'PHOTO' && item.id) {
        photos.push({ id: item.id, name: item.mediaFile?.filename || 'Meal photo' });
      }
    }
    pageToken = result.nextPageToken;
  } while (pageToken && photos.length < MAX_PICKED_PHOTOS);
  return photos.slice(0, MAX_PICKED_PHOTOS);
}

export async function importGooglePhoto({ sessionId, itemId, token, thumbnail = false, signal }) {
  const response = await fetch(`${apiBase}/api/google-photos/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, itemId, thumbnail }),
    signal,
    cache: 'no-store',
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    const error = new Error(result?.error?.message || 'We could not import that photo. Please try again or choose a file.');
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || !blob.size || blob.size > 10 * 1024 * 1024) {
    throw new Error('We could not open that photo. Try another photo or choose a file.');
  }
  return blob;
}

export function photoFile(blob, name) {
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[blob.type];
  const stem = (name || 'Meal photo').replace(/\.[^.]+$/, '').replace(/[\\/\x00-\x1f]/g, '').slice(0, 150) || 'Meal photo';
  return new File([blob], `${stem}.${extension}`, { type: blob.type });
}
