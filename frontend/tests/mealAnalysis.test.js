import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createMealFormData,
  validateMealAnalysis,
} from '../react/lib/mealAnalysisContract.js';

const fixtures = JSON.parse(
  readFileSync(
    new URL('../../server/tests/analysis.fixtures.json', import.meta.url),
    'utf8'
  )
);

test('maps valid backend analysis into frontend results', () => {
  const result = validateMealAnalysis(fixtures.validAnalysisResponse);

  assert.equal(result.totals.calories, 248);
  assert.equal(result.totals.protein, 46);
  assert.equal(result.totals.carbs, 0);
  assert.equal(result.totals.fat, 5);

  assert.equal(result.foods[0].name, 'Grilled chicken');
  assert.equal(result.foods[0].portion, '150 g');
  assert.equal(result.foods[0].calories, 248);

  assert.deepEqual(result.recommendations, [
    'Consider adding vegetables for a balanced meal.',
  ]);

  assert.equal(result.reviewed, false);
  assert.equal(result.schemaVersion, '1.0.0');
});

test('rejects an invalid backend analysis response', () => {
  assert.throws(
    () => validateMealAnalysis(fixtures.invalidMissingFoods),
    /could not read the meal analysis/i
  );
});

test('creates the correct photo-only request', () => {
  const photo = new File(['photo bytes'], 'meal.jpg', {
    type: 'image/jpeg',
  });

  const form = createMealFormData({
    photo,
    companion: 'Casual',
  });

  assert.equal(form.get('photo').name, 'meal.jpg');
  assert.equal(form.get('photoSource'), 'local');
  assert.equal(form.get('companionStyle'), 'casual');
  assert.equal(form.has('audio'), false);
});

test('includes recorded audio duration', () => {
  const photo = new File(['photo bytes'], 'meal.jpg', {
    type: 'image/jpeg',
  });
  const audio = new File(['audio bytes'], 'voice.webm', {
    type: 'audio/webm',
  });

  const form = createMealFormData({
    photo,
    audio,
    audioDuration: 12.5,
    companion: 'Athlete',
  });

  assert.equal(form.get('companionStyle'), 'athlete');
  assert.equal(form.get('audioDurationSeconds'), '12.5');
  assert.equal(form.get('audio').name, 'voice.webm');
});

test('rejects audio with missing duration', () => {
  const photo = new File(['photo bytes'], 'meal.jpg', {
    type: 'image/jpeg',
  });
  const audio = new File(['audio bytes'], 'voice.webm', {
    type: 'audio/webm',
  });

  assert.throws(
    () => createMealFormData({
      photo,
      audio,
      companion: 'Strict',
    }),
    /audio duration is unavailable/i
  );
});

test('rejects audio-only analysis', () => {
  assert.throws(
    () => createMealFormData({
      companion: 'Casual',
    }),
    /meal photo is required/i
  );
});

test('preserves Google Photos as the photo source', () => {
  const photo = new File(['photo bytes'], 'google-meal.jpg', {
    type: 'image/jpeg',
  });

  const form = createMealFormData({
    photo,
    photoSource: 'google_photos',
    companion: 'Strict',
  });

  assert.equal(form.get('photo').name, 'google-meal.jpg');
  assert.equal(form.get('photoSource'), 'google_photos');
  assert.equal(form.get('companionStyle'), 'strict');
});
