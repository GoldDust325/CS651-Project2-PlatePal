export function createMealFormData({ photo, audio, companion }) {
  const body = new FormData();
  if (photo) body.append('image', photo, photo.name);
  if (audio) body.append('audio', audio, audio.name);
  body.append('companion', companion);
  return body;
}

export function validateMealAnalysis(data) {
  if (!data || !Array.isArray(data.foods) || !Array.isArray(data.recommendations)
    || !data.foods.every(food => food && typeof food.name === 'string')
    || !data.recommendations.every(item => typeof item === 'string')) {
    throw new Error('We could not read the meal analysis. Please try again.');
  }
  return data;
}

export async function analyzeMeal({ photo, audio, companion, signal }) {
  const endpoint = import.meta.env.VITE_MEAL_ANALYSIS_URL?.trim();
  if (!endpoint) {
    throw new Error('Meal analysis is not available yet. Your meal details are ready.');
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: createMealFormData({ photo, audio, companion }),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Meal analysis could not be reached. Please try again.');
  }
  if (!response.ok) throw new Error('We could not analyze this meal. Please try again.');
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('We could not read the meal analysis. Please try again.');
  }
  return validateMealAnalysis(data);
}
