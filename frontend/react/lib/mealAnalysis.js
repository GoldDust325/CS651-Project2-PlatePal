import { authenticatedFetch } from './auth';
import {
  createMealFormData,
  validateMealAnalysis,
} from './mealAnalysisContract.js';

export async function analyzeMeal({
  photo,
  photoSource,
  audio,
  audioDuration,
  companion,
  signal,
}) {
  const endpoint = import.meta.env.VITE_MEAL_ANALYSIS_URL?.trim();

  if (!endpoint) {
    throw new Error('Meal analysis is not available yet. Your meal details are ready.');
  }

const formData = createMealFormData({
  photo,
  photoSource,
  audio,
  companion,
  audioDuration,
});

let response;

try {
  response = await authenticatedFetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error.code?.startsWith('auth/')) throw error;
    throw new Error('Meal analysis could not be reached. Please try again.');
  }

  if (!response.ok) {
    throw new Error('We could not analyze this meal. Please try again.');
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('We could not read the meal analysis. Please try again.');
  }

  return validateMealAnalysis(data);
}
