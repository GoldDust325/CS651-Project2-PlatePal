// Saved-meal helpers for BE-05 (/api/meals). Kept free of Firebase imports so
// the logic can be unit tested in Node; lib/meals.js binds it to the signed-in user.

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-wav'];
const FOOD_KEYS = ['foodId', 'name', 'quantity', 'estimatedMacros', 'category', 'estimatedNutrients', 'corrected'];
const ANALYSIS_KEYS = [
  'schemaVersion', 'analysisId', 'createdAt', 'foods', 'imageEvidence', 'audioAssertions',
  'conflicts', 'uncertainties', 'estimatedMacros', 'macroStatus', 'recommendation',
  'companionStyle', 'reviewed', 'corrected', 'corrections',
  // Optional multi-agent fields (Identifier, Coach, Planner).
  'estimatedNutrients', 'dietaryContext', 'review', 'planUpdate',
];

const friendlyErrors = {
  MEAL_NOT_FOUND: 'This meal no longer exists. It may have been deleted on another device.',
  UNRESOLVED_CONFLICT: 'This meal has photo and voice details that disagree. Resolve them before saving.',
  REVIEW_REQUIRED: 'Please review the analysis before saving this meal.',
  INVALID_ANALYSIS: 'This meal could not be saved because some details are missing or invalid.',
  INVALID_METADATA: 'This meal could not be saved because its photo or audio details are invalid.',
};

const pick = (source, keys) =>
  Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
const baseType = type => (typeof type === 'string' ? type.split(';')[0].trim().toLowerCase() : '');

export function mealError(message, code) {
  return Object.assign(new Error(message), { code });
}

// Remove frontend-only display fields so the body matches the BE-08 schema exactly.
export function toContractAnalysis(analysis) {
  const source = analysis?.contract ?? analysis;
  if (!source || !Array.isArray(source.foods)) {
    throw mealError('There is no meal analysis to save.', 'NO_ANALYSIS');
  }
  const result = pick(structuredClone(source), ANALYSIS_KEYS);
  result.foods = result.foods.map(food => pick(food, FOOD_KEYS));
  return result;
}

export function hasUnresolvedConflicts(analysis) {
  const source = analysis?.contract ?? analysis;
  return !!source?.conflicts?.some(conflict => !conflict.resolved);
}

// Choosing Save after reading the results is the user's review step.
export function prepareMealForSave(analysis, sourceMetadata) {
  const contract = toContractAnalysis(analysis);
  if (hasUnresolvedConflicts(contract)) {
    throw mealError(friendlyErrors.UNRESOLVED_CONFLICT, 'UNRESOLVED_CONFLICT');
  }
  return { analysis: { ...contract, reviewed: true }, sourceMetadata };
}

// Only the metadata DB-01 allows. Never media bytes or tokens.
export function buildSourceMetadata({ photo, photoSource = 'local', audio, audioDuration } = {}) {
  const metadata = { photoSource, hasAudio: !!audio };
  if (PHOTO_TYPES.includes(baseType(photo?.type))) metadata.photoMimeType = baseType(photo.type);
  if (audio) {
    const audioType = baseType(audio.type);
    if (AUDIO_TYPES.includes(audioType)) metadata.audioMimeType = audioType;
    if (Number.isFinite(audioDuration) && audioDuration > 0 && audioDuration <= 60) {
      metadata.audioDurationSeconds = audioDuration;
    }
  }
  return metadata;
}

// Firestore Timestamps arrive as {_seconds, _nanoseconds} once serialized by Express.
export function mealDate(meal) {
  const value = meal?.savedAt ?? meal?.analysis?.createdAt;
  let date = null;
  if (typeof value === 'string' || typeof value === 'number') date = new Date(value);
  else if (value && typeof value === 'object') {
    const seconds = value._seconds ?? value.seconds;
    if (Number.isFinite(seconds)) date = new Date(seconds * 1000);
  }
  if ((!date || Number.isNaN(date.getTime())) && meal?.analysis?.createdAt) {
    date = new Date(meal.analysis.createdAt);
  }
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

// Apply edits of {foodId: {name, amount, unit}} and record them as BE-08 corrections.
export function applyFoodEdits(analysis, edits) {
  const next = toContractAnalysis(analysis);
  const corrections = [...(next.corrections || [])];
  let quantityChanged = false;

  next.foods = next.foods.map(food => {
    const edit = edits?.[food.foodId];
    if (!edit) return food;
    const name = String(edit.name ?? food.name).trim();
    const unit = String(edit.unit ?? food.quantity.unit).trim();
    const amount = Number(edit.amount ?? food.quantity.amount);
    if (!name) throw mealError('Each food needs a name.', 'INVALID_EDIT');
    if (!unit) throw mealError(`Add a unit for ${name}.`, 'INVALID_EDIT');
    if (!Number.isFinite(amount) || amount <= 0) {
      throw mealError(`Enter an amount greater than 0 for ${name}.`, 'INVALID_EDIT');
    }

    const quantity = { amount, unit };
    const sameQuantity = amount === food.quantity.amount && unit === food.quantity.unit;
    if (name === food.name && sameQuantity) return food;
    if (!sameQuantity) quantityChanged = true;

    // Keep the first "previous" values so repeated edits still point at the AI's original reading.
    const index = corrections.findIndex(item => item.foodId === food.foodId);
    const original = index >= 0 ? corrections[index]
      : { foodId: food.foodId, previousName: food.name, previousQuantity: food.quantity };
    const correction = { ...original, correctedName: name, correctedQuantity: quantity };
    if (index >= 0) corrections[index] = correction;
    else corrections.push(correction);

    return { ...food, name, quantity, corrected: true };
  });

  next.corrections = corrections;
  next.corrected = corrections.length > 0;
  next.reviewed = true;
  if (quantityChanged) next.macroStatus = 'pending_recalculation';
  return next;
}

async function readError(response, fallback) {
  let code;
  try {
    code = (await response.json())?.error?.code;
  } catch {
    // Non-JSON error bodies fall back to the generic message.
  }
  return mealError(friendlyErrors[code] || fallback, code || `HTTP_${response.status}`);
}

export function createMealsApi({ fetchImpl, baseUrl = '' }) {
  const root = `${baseUrl.replace(/\/$/, '')}/api/meals`;
  const json = { Accept: 'application/json', 'Content-Type': 'application/json' };

  async function send(url, options, fallback) {
    let response;
    try {
      response = await fetchImpl(url, options);
    } catch (error) {
      if (error.name === 'AbortError' || error.code?.startsWith('auth/')) throw error;
      throw mealError('PlatePal could not be reached. Check your connection and try again.', 'NETWORK');
    }
    if (!response.ok) throw await readError(response, fallback);
    return response.json();
  }

  return {
    async list({ signal } = {}) {
      const data = await send(root, { headers: { Accept: 'application/json' }, signal },
        'Your meal history could not be loaded. Please try again.');
      return Array.isArray(data?.meals) ? data.meals : [];
    },
    save(body, { signal } = {}) {
      return send(root, { method: 'POST', headers: json, body: JSON.stringify(body), signal },
        'This meal could not be saved. Please try again.');
    },
    update(mealId, analysis, { signal } = {}) {
      return send(`${root}/${encodeURIComponent(mealId)}`,
        { method: 'PATCH', headers: json, body: JSON.stringify({ analysis }), signal },
        'Your changes could not be saved. Please try again.');
    },
    remove(mealId, { signal } = {}) {
      return send(`${root}/${encodeURIComponent(mealId)}`,
        { method: 'DELETE', headers: { Accept: 'application/json' }, signal },
        'This meal could not be deleted. Please try again.');
    },
  };
}
