// Goals helpers for /api/goals (ADK Planner, Agent 3). Kept free of Firebase
// imports so the logic can be unit tested in Node; lib/goals.js binds it to
// the signed-in user.

export const FITNESS_GOAL_LABELS = {
  lose_weight: 'Lose weight',
  maintain: 'Maintain',
  build_muscle: 'Build muscle',
  improve_performance: 'Improve performance',
  eat_healthier: 'Eat healthier',
};

export function createGoalsApi({ fetchImpl, baseUrl = '' }) {
  const root = `${baseUrl.replace(/\/$/, '')}/api/goals`;

  async function send(options) {
    const response = await fetchImpl(root, options);
    if (!response.ok) {
      throw Object.assign(new Error('Your goals could not be updated.'), { code: `HTTP_${response.status}` });
    }
    return response.json();
  }

  return {
    async get({ signal } = {}) {
      return (await send({ headers: { Accept: 'application/json' }, signal })).goals ?? null;
    },
    // Called after the user saves a meal, so a plan is applied only once they've reviewed it.
    applyPlan(planUpdate, { signal } = {}) {
      return send({
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: planUpdate.goals, source: 'planner' }),
        signal,
      });
    },
  };
}
