import { authenticatedFetch } from './auth';
import { createMealsApi } from './mealHistory.js';

// Every request carries the signed-in user's Firebase ID token; the server
// scopes meals to that verified UID, never to a client-supplied one.
export const mealsApi = createMealsApi({
  fetchImpl: authenticatedFetch,
  baseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || '',
});
