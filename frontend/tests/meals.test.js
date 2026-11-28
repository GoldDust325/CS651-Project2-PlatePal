import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyFoodEdits,
  buildSourceMetadata,
  createMealsApi,
  mealDate,
  prepareMealForSave,
  toContractAnalysis,
} from '../react/lib/mealHistory.js';
import { validateMealAnalysis } from '../react/lib/mealAnalysisContract.js';

const fixtures = JSON.parse(readFileSync(
  new URL('../../server/tests/analysis.fixtures.json', import.meta.url), 'utf8'));
const raw = fixtures.validAnalysisResponse;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('strips frontend display fields before saving', () => {
  const body = prepareMealForSave(validateMealAnalysis(raw), { photoSource: 'local', hasAudio: false });
  assert.equal(body.analysis.reviewed, true);
  assert.equal(body.analysis.totals, undefined);
  assert.equal(body.analysis.contract, undefined);
  assert.equal(body.analysis.foods[0].portion, undefined);
  assert.deepEqual(Object.keys(body.analysis.foods[0]).sort(), Object.keys(raw.foods[0]).sort());
  assert.equal(raw.reviewed, false, 'the original analysis is not mutated');
});

test('refuses to save a meal with unresolved conflicts', () => {
  const conflicted = { ...raw, conflicts: [{ conflictId: 'c1', foodId: raw.foods[0].foodId,
    imageObservation: 'rice', audioAssertion: 'quinoa', resolved: false }] };
  assert.throws(() => prepareMealForSave(conflicted, {}), /disagree/);
});

test('builds source metadata without codec parameters or media bytes', () => {
  const photo = new File(['x'], 'meal.png', { type: 'image/png' });
  const audio = new File(['x'], 'note.webm', { type: 'audio/webm;codecs=opus' });
  assert.deepEqual(buildSourceMetadata({ photo, photoSource: 'google_photos', audio, audioDuration: 12 }), {
    photoSource: 'google_photos', hasAudio: true, photoMimeType: 'image/png',
    audioMimeType: 'audio/webm', audioDurationSeconds: 12,
  });
  assert.deepEqual(buildSourceMetadata({ photo }), { photoSource: 'local', hasAudio: false, photoMimeType: 'image/png' });
});

test('reads Firestore timestamps and falls back to createdAt', () => {
  assert.equal(mealDate({ savedAt: { _seconds: 1700000000, _nanoseconds: 0 } }).getTime(), 1700000000000);
  assert.equal(mealDate({ savedAt: null, analysis: { createdAt: '2026-11-25T10:00:00Z' } }).toISOString(),
    '2026-11-25T10:00:00.000Z');
  assert.equal(mealDate({}), null);
});

test('records food edits as schema corrections', () => {
  const food = raw.foods[0];
  const once = applyFoodEdits(raw, { [food.foodId]: { name: 'Chicken thigh', amount: '200', unit: 'g' } });
  assert.equal(once.foods[0].name, 'Chicken thigh');
  assert.deepEqual(once.foods[0].quantity, { amount: 200, unit: 'g' });
  assert.equal(once.foods[0].corrected, true);
  assert.equal(once.corrected, true);
  assert.equal(once.reviewed, true);
  assert.equal(once.macroStatus, 'pending_recalculation');
  assert.deepEqual(once.corrections, [{ foodId: food.foodId, previousName: food.name,
    previousQuantity: food.quantity, correctedName: 'Chicken thigh', correctedQuantity: { amount: 200, unit: 'g' } }]);

  const twice = applyFoodEdits(once, { [food.foodId]: { name: 'Chicken breast', amount: '200', unit: 'g' } });
  assert.equal(twice.corrections.length, 1, 'repeat edits update one correction');
  assert.equal(twice.corrections[0].previousName, food.name);
  assert.equal(twice.corrections[0].correctedName, 'Chicken breast');
});

test('a rename alone keeps macros marked as estimated', () => {
  const food = raw.foods[0];
  const result = applyFoodEdits(raw, { [food.foodId]: { name: 'Roast chicken' } });
  assert.equal(result.macroStatus, raw.macroStatus);
  assert.deepEqual(applyFoodEdits(raw, {}).corrections, raw.corrections);
});

test('rejects empty names and non-positive amounts', () => {
  const id = raw.foods[0].foodId;
  assert.throws(() => applyFoodEdits(raw, { [id]: { name: '  ' } }), /needs a name/);
  assert.throws(() => applyFoodEdits(raw, { [id]: { amount: '0' } }), /greater than 0/);
  assert.throws(() => applyFoodEdits(raw, { [id]: { amount: 'abc' } }), /greater than 0/);
});

test('meals API calls the BE-05 routes', async () => {
  const calls = [];
  const api = createMealsApi({
    baseUrl: 'https://api.example/',
    fetchImpl: async (url, options) => {
      calls.push([url, options.method || 'GET', options.body]);
      return jsonResponse(200, url.endsWith('/api/meals') && !options.method ? { meals: [{ mealId: 'm1' }] } : { ok: true });
    },
  });
  assert.deepEqual(await api.list(), [{ mealId: 'm1' }]);
  await api.update('m 1', toContractAnalysis(raw));
  await api.remove('m1');
  assert.deepEqual(calls.map(([url, method]) => [url, method]), [
    ['https://api.example/api/meals', 'GET'],
    ['https://api.example/api/meals/m%201', 'PATCH'],
    ['https://api.example/api/meals/m1', 'DELETE'],
  ]);
  assert.equal(JSON.parse(calls[1][2]).analysis.analysisId, raw.analysisId);
});

test('meals API turns server errors into friendly messages', async () => {
  const api = createMealsApi({ fetchImpl: async () =>
    jsonResponse(404, { error: { code: 'MEAL_NOT_FOUND', message: 'Meal not found' } }) });
  await assert.rejects(api.remove('gone'), error =>
    error.code === 'MEAL_NOT_FOUND' && /no longer exists/.test(error.message));

  const offline = createMealsApi({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(offline.list(), /could not be reached/);

  const broken = createMealsApi({ fetchImpl: async () => new Response('oops', { status: 500 }) });
  await assert.rejects(broken.list(), /could not be loaded/);
});
