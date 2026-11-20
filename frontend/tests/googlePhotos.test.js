import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickerUrl, pollingTiming, waitForPoll, listPickedPhotos, importGooglePhoto, photoFile,
} from '../react/lib/googlePhotos.js';

test('picker links stay on Google Photos and support autoclose exactly once', () => {
  assert.equal(pickerUrl('https://photos.google.com/picker/example'), 'https://photos.google.com/picker/example/autoclose');
  assert.equal(pickerUrl('https://photos.google.com/picker/example/autoclose'), 'https://photos.google.com/picker/example/autoclose');
  for (const url of ['https://example.com/picker', 'http://photos.google.com/picker', 'https://photos.google.com.example.com/picker']) {
    assert.throws(() => pickerUrl(url));
  }
});

test('polling follows updated Google intervals and never extends the original deadline', () => {
  const now = Date.UTC(2026, 0, 1);
  const initial = pollingTiming({ pollingConfig: { pollInterval: '4.5s', timeoutIn: '60s' } }, now);
  assert.deepEqual(initial, { delay: 4500, deadline: now + 60000 });
  const next = pollingTiming({ pollingConfig: { pollInterval: '9s', timeoutIn: '120s' } }, now + 10000, initial.deadline);
  assert.deepEqual(next, { delay: 9000, deadline: initial.deadline });
  assert.equal(pollingTiming({ pollingConfig: { timeoutIn: '0s' } }, now).deadline, now);
  assert.equal(pollingTiming({ expireTime: new Date(now + 1000).toISOString() }, now).deadline, now + 1000);
});

test('cancelling stops a pending polling timer immediately', async () => {
  const controller = new AbortController();
  const waiting = waitForPoll(60000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
});

test('picked-photo list paginates, excludes videos, and keeps access tokens out of URLs', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json(calls.length === 1 ? {
      mediaItems: [{ id: 'video', type: 'VIDEO' }, { id: 'photo-1', type: 'PHOTO', mediaFile: { filename: 'Lunch.jpg' } }],
      nextPageToken: 'next page',
    } : { mediaItems: [{ id: 'photo-2', type: 'PHOTO', mediaFile: { filename: 'Dinner.jpg' } }] });
  });
  const photos = await listPickedPhotos('session/id', 'test-secret', new AbortController().signal);
  assert.deepEqual(photos.map(photo => photo.id), ['photo-1', 'photo-2']);
  assert.equal(new URL(calls[1].url).searchParams.get('pageToken'), 'next page');
  assert.ok(calls.every(call => !call.url.includes('test-secret')));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-secret');
});

test('import requests contain IDs instead of media URLs and create a file with the actual MIME type', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/google-photos/import');
    assert.deepEqual(JSON.parse(options.body), { sessionId: 'session', itemId: 'photo', thumbnail: false });
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    return new Response(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } });
  });
  const blob = await importGooglePhoto({ sessionId: 'session', itemId: 'photo', token: 'test-secret' });
  const file = photoFile(blob, 'Lunch.HEIC');
  assert.equal(file.name, 'Lunch.jpg');
  assert.equal(file.type, 'image/jpeg');
  assert.equal(file.size, 3);
});

test('a missing backend, HTML response, or expired connection never becomes a meal image', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('<html>Error</html>', {
    headers: { 'Content-Type': 'text/html' },
  }));
  const options = { sessionId: 'session', itemId: 'photo', token: 'test-secret' };
  await assert.rejects(importGooglePhoto(options), /could not open/);
  fetchMock.mock.mockImplementation(async () => Response.json({ error: { message: 'Please reconnect.' } }, { status: 401 }));
  await assert.rejects(importGooglePhoto(options), /Please reconnect/);
});
