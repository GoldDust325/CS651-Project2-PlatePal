// DB-02 unit tests (in-memory Firestore fake; no cloud writes).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./analysis.fixtures.json');
const { createMealService } = require('../services/firestoreMeals');

function fakeFirestore() {
  const documents = new Map();
  let nextId = 1;
  function collectionFor(uid) {
    const prefix = `users/${uid}/meals/`;
    function doc(id = `generated-${nextId++}`) {
      const key = prefix + id;
      return {
        id,
        async set(data) { documents.set(key, structuredClone(data)); },
        async get() {
          return { exists: documents.has(key),
            data: () => structuredClone(documents.get(key)) };
        },
        async update(changes) {
          if (!documents.has(key)) throw new Error('not found');
          documents.set(key, { ...documents.get(key), ...structuredClone(changes) });
        },
        async delete() { documents.delete(key); },
      };
    }
    return {
      doc,
      orderBy(field, direction) {
        assert.equal(field, 'savedAt');
        assert.equal(direction, 'desc');
        return { async get() {
          const rows = [...documents.entries()]
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, data]) => ({ id: key.slice(prefix.length), data: () => structuredClone(data) }));
          rows.sort((a, b) => b.data().savedAt - a.data().savedAt);
          return { docs: rows };
        }};
      },
    };
  }
  return {
    collection(name) {
      assert.equal(name, 'users');
      return { doc(uid) { return {
        collection(child) {
          assert.equal(child, 'meals');
          return collectionFor(uid);
        },
      }; }};
    },
  };
}

function setup() {
  const db = fakeFirestore();
  let tick = 0;
  const service = createMealService(db, () => ++tick);
  const data = {
    analysis: { ...structuredClone(fixture.validAnalysisResponse), reviewed: true },
    sourceMetadata: {
      photoSource: 'local', photoMimeType: 'image/jpeg',
      hasAudio: false, audioMimeType: null, audioDurationSeconds: null,
    },
  };
  return { service, data };
}

test('empty meal history returns an empty array', async () => {
  const { service } = setup();
  assert.deepEqual(await service.listMeals('user-A'), []);
});

test('only reviewed results may be saved', async () => {
  const { service, data } = setup();
  data.analysis.reviewed = false;
  await assert.rejects(service.saveMeal('user-A', data),
    (error) => error.code === 'REVIEW_REQUIRED');
});

test('save and list meals are scoped to the Firebase UID', async () => {
  const { service, data } = setup();
  const { mealId } = await service.saveMeal('user-A', data);
  assert.ok(mealId);
  assert.equal((await service.listMeals('user-A')).length, 1);
  assert.deepEqual(await service.listMeals('user-B'), []);
});

test('update persists but does not modify savedAt', async () => {
  const { service, data } = setup();
  const { mealId } = await service.saveMeal('user-A', data);
  const before = (await service.listMeals('user-A'))[0];
  data.analysis.recommendation = 'Try adding broccoli.';
  await service.updateMeal('user-A', mealId, data);
  const after = (await service.listMeals('user-A'))[0];
  assert.equal(after.analysis.recommendation, 'Try adding broccoli.');
  assert.equal(after.savedAt, before.savedAt);
  assert.ok(after.updatedAt > before.updatedAt);
});

test('delete persists', async () => {
  const { service, data } = setup();
  const { mealId } = await service.saveMeal('user-A', data);
  await service.deleteMeal('user-A', mealId);
  assert.deepEqual(await service.listMeals('user-A'), []);
});

test('unknown meal IDs cannot be updated or deleted', async () => {
  const { service, data } = setup();
  await assert.rejects(service.updateMeal('user-A', 'missing', data),
    (error) => error.status === 404);
  await assert.rejects(service.deleteMeal('user-A', 'missing'),
    (error) => error.status === 404);
});

test('user B cannot update user A meal using the same document ID', async () => {
  const { service, data } = setup();
  const { mealId } = await service.saveMeal('user-A', data);
  await assert.rejects(service.updateMeal('user-B', mealId, data),
    (error) => error.status === 404);
});

test('raw media and OAuth tokens are not written into sourceMetadata', async () => {
  const { service, data } = setup();
  data.sourceMetadata.data = 'photoBase64';
  data.sourceMetadata.oauthToken = 'secret';
  await service.saveMeal('user-A', data);
  const saved = (await service.listMeals('user-A'))[0];
  assert.equal(saved.sourceMetadata.data, undefined);
  assert.equal(saved.sourceMetadata.oauthToken, undefined);
});
