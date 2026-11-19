// PlatePal Project 2 — DB-02: Firestore meal storage service
// Path: server/services/firestoreMeals.js
// The Express route must pass req.user.uid (verified by BE-03), never a client UID.

const {
  getApp,
  getApps,
  initializeApp,
  applicationDefault,
} = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const contract = require('../schemas/analysis.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateAnalysis = ajv.compile({
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: contract.definitions,
  $ref: '#/definitions/analysisResponse',
});

function serviceError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function validateDocumentId(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.includes('/') ||
    value === '.' ||
    value === '..'
  ) {
    throw serviceError('INVALID_ID', `Invalid ${label}`, 400);
  }
  return value;
}

function validateReviewedAnalysis(analysis) {
  if (!validateAnalysis(analysis)) {
    throw serviceError('INVALID_ANALYSIS',
      'Analysis does not match the BE-08 response schema', 400);
  }
  if (analysis.reviewed !== true) {
    throw serviceError('REVIEW_REQUIRED',
      'Users must review results before saving a meal', 400);
  }
  if (analysis.conflicts.some((conflict) => !conflict.resolved)) {
    throw serviceError('UNRESOLVED_CONFLICT',
      'Resolve image/audio conflicts before saving', 400);
  }
}

// Keep only metadata defined by DB-01. Never store photo/audio Base64,
// Google Photos tokens, or other credentials in meal documents.
function cleanSourceMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw serviceError('INVALID_METADATA', 'Invalid source metadata', 400);
  }
  const result = {};
  if (metadata.photoSource !== undefined) {
    if (!['local', 'google_photos'].includes(metadata.photoSource)) {
      throw serviceError('INVALID_METADATA', 'Invalid photo source', 400);
    }
    result.photoSource = metadata.photoSource;
  }
  if (metadata.photoMimeType !== undefined) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(metadata.photoMimeType)) {
      throw serviceError('INVALID_METADATA', 'Invalid photo MIME type', 400);
    }
    result.photoMimeType = metadata.photoMimeType;
  }
  if (metadata.hasAudio !== undefined) {
    if (typeof metadata.hasAudio !== 'boolean') {
      throw serviceError('INVALID_METADATA', 'Invalid hasAudio flag', 400);
    }
    result.hasAudio = metadata.hasAudio;
  }
  if (metadata.audioMimeType !== undefined) {
    if (metadata.audioMimeType !== null &&
      !['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-wav'].includes(metadata.audioMimeType)) {
      throw serviceError('INVALID_METADATA', 'Invalid audio MIME type', 400);
    }
    result.audioMimeType = metadata.audioMimeType;
  }
  if (metadata.audioDurationSeconds !== undefined) {
    const duration = metadata.audioDurationSeconds;
    if (duration !== null &&
      (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration > 60)) {
      throw serviceError('INVALID_METADATA', 'Invalid audio duration', 400);
    }
    result.audioDurationSeconds = duration;
  }
  return result;
}

function getDatabase() {
  let app;
  if (getApps().length) {
    app = getApp(); // Reuse the app already initialized by BE-03.
  } else {
    if (!process.env.FIREBASE_PROJECT_ID) {
      throw serviceError('MISSING_PROJECT_ID',
        'FIREBASE_PROJECT_ID must be configured', 500);
    }
    app = initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  if (process.env.FIREBASE_PROJECT_ID &&
      app.options.projectId &&
      app.options.projectId !== process.env.FIREBASE_PROJECT_ID) {
    throw serviceError('PROJECT_ID_MISMATCH', 'Firebase project ID mismatch', 500);
  }
  return getFirestore(app); // Uses the (default) Firestore database.
}

// Injecting a database and timestamp provider allows isolated unit tests.
function createMealService(db, timestamp = () => FieldValue.serverTimestamp()) {
  function mealsFor(uid) {
    validateDocumentId(uid, 'Firebase UID');
    return db.collection('users').doc(uid).collection('meals');
  }

  async function saveMeal(uid, data) {
    const meals = mealsFor(uid);
    const analysis = data && data.analysis;
    validateReviewedAnalysis(analysis);
    const sourceMetadata = cleanSourceMetadata(data.sourceMetadata);
    const ref = meals.doc();
    await ref.set({
      analysis,
      sourceMetadata,
      savedAt: timestamp(),
      updatedAt: timestamp(),
    });
    return { mealId: ref.id };
  }

  async function listMeals(uid) {
    const snapshot = await mealsFor(uid).orderBy('savedAt', 'desc').get();
    return snapshot.docs.map((doc) => ({ mealId: doc.id, ...doc.data() }));
  }

  async function updateMeal(uid, mealId, data) {
    const meals = mealsFor(uid);
    validateDocumentId(mealId, 'meal ID');
    const analysis = data && data.analysis;
    validateReviewedAnalysis(analysis);
    const ref = meals.doc(mealId);
    const existing = await ref.get();
    if (!existing.exists) {
      throw serviceError('MEAL_NOT_FOUND', 'Meal not found', 404);
    }
    const changes = { analysis, updatedAt: timestamp() };
    if (data.sourceMetadata !== undefined) {
      changes.sourceMetadata = cleanSourceMetadata(data.sourceMetadata);
    }
    await ref.update(changes); // Fails if the document is removed concurrently.
    return { mealId };
  }

  async function deleteMeal(uid, mealId) {
    const meals = mealsFor(uid);
    validateDocumentId(mealId, 'meal ID');
    const ref = meals.doc(mealId);
    const existing = await ref.get();
    if (!existing.exists) {
      throw serviceError('MEAL_NOT_FOUND', 'Meal not found', 404);
    }
    await ref.delete();
    return { mealId, deleted: true };
  }

  return { saveMeal, listMeals, updateMeal, deleteMeal };
}

// Lazy database initialization keeps import safe before credentials exist.
const service = (method) => (...args) =>
  createMealService(getDatabase())[method](...args);

module.exports = {
  saveMeal: service('saveMeal'),
  listMeals: service('listMeals'),
  updateMeal: service('updateMeal'),
  deleteMeal: service('deleteMeal'),
  createMealService,
};
