// Cross-boundary test: real frontend request builder + response mapper against the real Express /api/analyze route.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createMealFormData, validateMealAnalysis } from '../../frontend/react/lib/mealAnalysisContract.js';

const require = createRequire(import.meta.url);
const fixtures = JSON.parse(readFileSync(new URL('./analysis.fixtures.json', import.meta.url), 'utf8'));
const authPath = require.resolve('../middleware/verifyFirebaseToken');
const adkPath = require.resolve('../services/adkClient');
let captured;
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true,
  exports: (req, res, next) => { req.user = { uid: 'u1' }; next(); } };
require.cache[adkPath] = { id: adkPath, filename: adkPath, loaded: true,
  exports: { async analyzeMeal(d) { captured = d; return { ...fixtures.validAnalysisResponse, companionStyle: d.companionStyle }; } } };
const app = require('../index.js');
let server, url;
before(() => new Promise(r => { server = app.listen(0, () => { url = `http://127.0.0.1:${server.address().port}/api/analyze`; r(); }); }));
after(() => server.close());

const photo = () => new File([Buffer.from('fake-jpeg')], 'meal.jpg', { type: 'image/jpeg' });
const audio = () => new File([Buffer.from('fake-webm')], 'voice.webm', { type: 'audio/webm' });
const post = body => fetch(url, { method: 'POST', headers: { Authorization: 'Bearer x', Accept: 'application/json' }, body });

for (const companion of ['Casual', 'Strict', 'Athlete']) {
  test(`photo-only request from frontend is accepted by Express (${companion})`, async () => {
    const res = await post(createMealFormData({ photo: photo(), companion }));
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(captured.companionStyle, companion.toLowerCase());
    assert.equal(captured.photo.source, 'local');
    assert.equal(captured.photo.mimeType, 'image/jpeg');
    assert.equal(Buffer.from(captured.photo.data, 'base64').toString(), 'fake-jpeg');
    assert.equal(captured.audio, undefined);
    const view = validateMealAnalysis(await res.json());
    assert.equal(typeof view.totals.calories, 'number');
    assert.ok(Array.isArray(view.recommendations));
  });
}

test('photo + audio + Google Photos source round-trips', async () => {
  const res = await post(createMealFormData({ photo: photo(), photoSource: 'google_photos', audio: audio(), audioDuration: 12.5, companion: 'Athlete' }));
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(captured.photo.source, 'google_photos');
  assert.equal(captured.audio.mimeType, 'audio/webm');
  assert.equal(captured.audio.durationSeconds, 12.5);
  const view = validateMealAnalysis(await res.json());
  assert.equal(view.foods[0].portion, '150 g');
});
