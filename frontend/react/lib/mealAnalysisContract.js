export function createMealFormData({
  photo,
  photoSource = 'local',
  audio,
  companion,
  audioDuration,
}) {
  if (!photo) {
    throw new Error('A meal photo is required for analysis.');
  }

  if (!['Casual', 'Strict', 'Athlete'].includes(companion)) {
    throw new Error('Please select a valid companion.');
  }

  const body = new FormData();
  if (!['local', 'google_photos'].includes(photoSource)) {
  throw new Error('Invalid photo source.');
}

body.append('photo', photo, photo.name);
body.append('photoSource', photoSource);
  body.append('companionStyle', companion.toLowerCase());

  if (audio) {
    if (
      !Number.isFinite(audioDuration) ||
      audioDuration <= 0 ||
      audioDuration > 60
    ) {
      throw new Error(
        'Audio duration is unavailable or exceeds 60 seconds. Please record a new description.'
      );
    }

    body.append('audio', audio, audio.name);
    body.append('audioDurationSeconds', String(audioDuration));
  }

  return body;
}

export function mapMealAnalysis(data) {
  const macros = data.estimatedMacros;

  return {
    ...data,
    // Untouched BE-08 response, used when saving the meal (POST /api/meals).
    contract: data,
    totals: {
      calories: macros.calories,
      protein: macros.proteinGrams,
      carbs: macros.carbohydrateGrams,
      fat: macros.fatGrams,
      // Present when the identifier estimated nutrients for every food.
      fiber: data.estimatedNutrients?.fiberGrams,
    },
    foods: data.foods.map(food => ({
      ...food,
      portion: food.quantity
        ? `${food.quantity.amount} ${food.quantity.unit}`
        : '',
      calories: food.estimatedMacros?.calories,
    })),
    recommendations: [data.recommendation],
    // The coach's structured review, when the ADK service sends one.
    review: data.review
      ? {
          healthRating: data.review.healthRating,
          healthNote: data.review.healthNote,
          additions: data.review.suggestedAdditions,
          allergyFlags: data.review.allergyFlags.map(flag => ({
            ...flag,
            foodNames: flag.foodIds
              .map(id => data.foods.find(food => food.foodId === id)?.name)
              .filter(Boolean),
          })),
          craving: data.review.cravingSuggestion || '',
        }
      : null,
  };
}

export function validateMealAnalysis(data) {
  if (
    !data ||
    data.schemaVersion !== '1.0.0' ||
    !Array.isArray(data.foods) ||
    !data.foods.every(food =>
      food &&
      typeof food.name === 'string' &&
      food.quantity &&
      typeof food.quantity.amount === 'number' &&
      typeof food.quantity.unit === 'string'
    ) ||
    !data.estimatedMacros ||
    typeof data.estimatedMacros.calories !== 'number' ||
    typeof data.recommendation !== 'string'
  ) {
    throw new Error('We could not read the meal analysis. Please try again.');
  }

  return mapMealAnalysis(data);
}
