# Shiv Shankar Yadav — #3: scoped history through the existing authorized Express API.
import copy
import os
from urllib.parse import urlparse
import httpx


class MealHistory:
    def __init__(self, authorization, current):
        self.authorization = authorization
        self.current = current
        self.cache = None
        self.goals_cache = None

    async def get_recent_meals(self) -> dict:
        """Retrieve up to five recent meals belonging to the authenticated caller. No user-ID argument is accepted."""
        if self.cache is not None:
            return copy.deepcopy(self.cache)
        if not self.authorization:
            self.cache = {'status': 'unavailable', 'meals': []}
            return copy.deepcopy(self.cache)
        origin = os.getenv('EXPRESS_HISTORY_URL', 'http://127.0.0.1:5001/api/meals')
        target = urlparse(origin)
        if target.scheme != 'https' and not (target.scheme == 'http' and target.hostname in ('127.0.0.1', 'localhost', '::1')):
            raise ValueError('History requires HTTPS or loopback')
        try:
            async with httpx.AsyncClient(timeout=10, trust_env=False, follow_redirects=False) as client:
                response = await client.get(origin, headers={'Authorization': self.authorization})
                response.raise_for_status()
                rows = response.json()['meals'][:5]
            meals = []
            for row in rows:
                analysis = row['analysis']
                meals.append({'mealId': row['mealId'], 'foods': copy.deepcopy(analysis['foods']),
                              'estimatedMacros': copy.deepcopy(analysis['estimatedMacros'])})
            self.cache = {'status': 'available' if meals else 'empty', 'meals': meals}
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            self.cache = {'status': 'unavailable', 'meals': []}
        return copy.deepcopy(self.cache)

    async def compare_to_recent_meals(self) -> dict:
        """Compare the current fixed meal macros to the mean of up to five authorized recent meals. Positive deltas mean higher, not better."""
        history = await self.get_recent_meals()
        meals = history['meals']
        if not meals:
            return {'status': history['status'], 'sampleCount': 0, 'deltas': {}}
        averages = {k: sum(m['estimatedMacros'][k] for m in meals) / len(meals)
                    for k in self.current['estimatedMacros']}
        return {'status': 'available', 'sampleCount': len(meals), 'recentMean': averages,
                'deltas': {k: self.current['estimatedMacros'][k] - v for k, v in averages.items()}}

    async def get_current_goals(self) -> dict:
        """Return the authenticated caller's current fitness goal, daily targets and weekly goals. No user-ID argument is accepted."""
        if self.goals_cache is not None:
            return copy.deepcopy(self.goals_cache)
        if not self.authorization:
            self.goals_cache = {'status': 'unavailable', 'goals': None}
            return copy.deepcopy(self.goals_cache)
        url = os.getenv('EXPRESS_GOALS_URL', 'http://127.0.0.1:5001/api/goals')
        target = urlparse(url)
        if target.scheme != 'https' and not (target.scheme == 'http' and target.hostname in ('127.0.0.1', 'localhost', '::1')):
            raise ValueError('Goals require HTTPS or loopback')
        try:
            async with httpx.AsyncClient(timeout=10, trust_env=False, follow_redirects=False) as client:
                response = await client.get(url, headers={'Authorization': self.authorization})
                response.raise_for_status()
                goals = response.json()['goals']
            if goals is None:
                self.goals_cache = {'status': 'empty', 'goals': None}
            else:
                self.goals_cache = {'status': 'available', 'goals': {
                    'fitnessGoal': goals['fitnessGoal'],
                    'dailyTargets': copy.deepcopy(goals['dailyTargets']),
                    'weeklyGoals': list(goals['weeklyGoals'])}}
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            self.goals_cache = {'status': 'unavailable', 'goals': None}
        return copy.deepcopy(self.goals_cache)
