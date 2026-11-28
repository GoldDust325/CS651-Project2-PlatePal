import { authenticatedFetch } from './auth';
import { createGoalsApi } from './goalsApi.js';

// Goals are stored under the verified UID on the server, never a client one.
export const goalsApi = createGoalsApi({
  fetchImpl: authenticatedFetch,
  baseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || '',
});
