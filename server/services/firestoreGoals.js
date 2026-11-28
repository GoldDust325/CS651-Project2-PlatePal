// PlatePal Project 2 — Goals storage for the ADK Planner (Agent 3)
// Author: Shiv Shankar Yadav
// Path: users/{uid}/goals/current. The route passes req.user.uid (verified
// by BE-03), never a client UID.

const { FieldValue } = require('firebase-admin/firestore');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const contract = require('../schemas/analysis.schema.json');
const { getDatabase } = require('./firestoreMeals');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateGoals = ajv.compile({
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: contract.definitions,
  $ref: '#/definitions/goals',
});

const SOURCES = ['planner', 'user'];

function serviceError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function goalsDoc(db, uid) {
  if (typeof uid !== 'string' || !uid.trim() || uid.includes('/')) {
    throw serviceError('INVALID_ID', 'Invalid Firebase UID', 400);
  }
  return db.collection('users').doc(uid).collection('goals').doc('current');
}

function toIso(value) {
  return value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value;
}

// Injecting a database and timestamp provider allows isolated unit tests.
function createGoalsService(db, timestamp = () => FieldValue.serverTimestamp()) {
  async function getGoals(uid) {
    const snapshot = await goalsDoc(db, uid).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    return {
      fitnessGoal: data.fitnessGoal,
      dailyTargets: data.dailyTargets,
      weeklyGoals: data.weeklyGoals,
      source: data.source,
      updatedAt: toIso(data.updatedAt),
    };
  }

  async function saveGoals(uid, body) {
    const goals = body && body.goals;
    if (!validateGoals(goals)) {
      throw serviceError('INVALID_GOALS', 'Goals do not match the shared goals schema', 400);
    }
    const source = body.source === undefined ? 'user' : body.source;
    if (!SOURCES.includes(source)) {
      throw serviceError('INVALID_GOALS', 'Goal source must be planner or user', 400);
    }
    // Only the validated fields are stored, replacing the previous goals.
    await goalsDoc(db, uid).set({
      fitnessGoal: goals.fitnessGoal,
      dailyTargets: goals.dailyTargets,
      weeklyGoals: goals.weeklyGoals,
      source,
      updatedAt: timestamp(),
    });
    return { goals, source };
  }

  return { getGoals, saveGoals };
}

const service = (method) => (...args) =>
  createGoalsService(getDatabase())[method](...args);

module.exports = {
  getGoals: service('getGoals'),
  saveGoals: service('saveGoals'),
  createGoalsService,
};
