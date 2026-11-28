import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoalsApi } from '../react/lib/goalsApi.js';
import { prepareMealForSave } from '../react/lib/mealHistory.js';
import { validateMealAnalysis } from '../react/lib/mealAnalysisContract.js';
import { readFileSync } from 'node:fs';

const fixtures = JSON.parse(readFileSync(new URL('../../server/tests/analysis.fixtures.json', import.meta.url), 'utf8'));

const PLAN = {
  goals: {
    fitnessGoal: 'maintain',
    dailyTargets: { calories: 2200, proteinGrams: 110, carbohydrateGrams: 260, fatGrams: 75, fiberGrams: 30 },
    weeklyGoals: ['Add a vegetable to 4 dinners.'],
  },
  reason: 'Vegetables are low this week.',
  basedOnMealCount: 3,
};

test('applyPlan sends only the goals with the planner source', async () => {
  const calls = [];
  const api = createGoalsApi({
    baseUrl: 'https://api.example/',
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return { ok: true, json: async () => ({ goals: PLAN.goals, source: 'planner' }) };
    },
  });
  await api.applyPlan(PLAN);
  assert.equal(calls[0][0], 'https://api.example/api/goals');
  assert.equal(calls[0][1].method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0][1].body), { goals: PLAN.goals, source: 'planner' });
});

test('goals errors are reported', async () => {
  const api = createGoalsApi({ fetchImpl: async () => ({ ok: false, status: 400 }) });
  await assert.rejects(api.applyPlan(PLAN), { code: 'HTTP_400' });
  const empty = createGoalsApi({ fetchImpl: async () => ({ ok: true, json: async () => ({ goals: null }) }) });
  assert.equal(await empty.get(), null);
});

test('saved meals keep the new agent fields', () => {
  const data = structuredClone(fixtures.validAnalysisResponse);
  data.foods[0].category = 'protein';
  data.foods[0].estimatedNutrients = { fiberGrams: 0, sugarGrams: 0, sodiumMilligrams: 110 };
  data.review = { healthRating: 'okay', healthNote: 'Fine.', suggestedAdditions: [], allergyFlags: [] };
  data.dietaryContext = { allergies: [], cravings: [] };
  data.planUpdate = PLAN;
  const body = prepareMealForSave(validateMealAnalysis(data), { photoSource: 'local', hasAudio: false });
  assert.equal(body.analysis.foods[0].category, 'protein');
  assert.deepEqual(body.analysis.planUpdate, PLAN);
  assert.deepEqual(body.analysis.review, data.review);
  assert.equal(body.analysis.reviewed, true);
});
