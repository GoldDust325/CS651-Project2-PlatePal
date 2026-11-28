# PlatePal ADK Multi-Agent Meal Coach

**Author:** Shiv Shankar Yadav
**Issues:** #2 (ADK Meal Coach), #3 (history tools), #4 (coaching styles)
**Code:** `adk_service/service.py`

## Architecture

`POST /analyze` runs one Google ADK `SequentialAgent` called `platepal_orchestrator`. It runs the agents in order and passes data between them through session state.

| Agent | ADK name | Input | Output |
|---|---|---|---|
| 1. Food Identifier | `food_identifier` | Meal photo and optional voice note | Meal report: foods with quantity, category, calories, macros and nutrients (fiber, sugar, sodium); image evidence; audio assertions; conflicts; uncertainties; `dietaryContext` (allergies and cravings the user said out loud) |
| 2. Coach | `meal_coach` | Agent 1's report through the `get_meal_analysis` tool, plus recent meal history when the user is signed in | Review in the casual, strict or athlete style: `healthRating`, `healthNote`, `suggestedAdditions`, `allergyFlags`, optional `cravingSuggestion`, and the `recommendation` text |
| 3. Planner | `goal_planner` | Agent 2's review (through `get_meal_review`), current goals (`get_current_goals`) and recent meals (`get_recent_meals`) | `planUpdate`: fitness goal, daily targets (calories, protein, carbs, fat, fiber), up to three weekly goals, a one-line reason and how many past meals it used |

The planner runs only when the request carries the user's Firebase token, because it needs their history and goals. If the planner fails, the response still has the meal report and review, just without `planUpdate`.

## Goals storage

Goals live in Firestore at `users/{uid}/goals/current` with `fitnessGoal`, `dailyTargets`, `weeklyGoals`, `source` (`planner` or `user`) and `updatedAt`. Express serves them at `GET /api/goals` and `PUT /api/goals` (body `{ goals, source }`), always for the verified UID, and validates them against the `goals` definition in the shared schema.

Nothing is saved automatically. The frontend shows the proposed plan with the results, and when the user presses **Save meal** it saves the meal and then sends the plan to `PUT /api/goals`. The proposed plan is also kept inside the saved meal.

## Rules the code enforces

- Agent 1 returns JSON constrained by a schema built from `server/schemas/analysis.schema.json`, then the report is validated against the full shared schema. An invalid report fails the request with 502.
- Agent 1 never sees the companion style, so the food and nutrition estimates are the same for every style.
- Agent 2 never sees the photo or audio. It must call `get_meal_analysis`, and it cannot change the foods or numbers. Its output is checked against a Pydantic `CoachReview` model.
- Allergy flags keep only food ids that Agent 1 reported. Meal nutrient totals are summed in code, not by the model.
- With existing goals, the planner keeps the user's fitness goal, and each daily target moves at most 10% per meal. All targets are clamped to the schema limits (for example 1,000 to 5,000 calories a day). These rules are applied in code, not only in the prompt.
- On Gemini 429 or 503, the whole pipeline is retried once with `GEMINI_FALLBACK_MODEL` if it is set.

## Voice note examples

- "I'm allergic to peanuts" puts `peanuts` in `dietaryContext.allergies`. The coach flags foods that commonly contain peanuts and never suggests one.
- "I'm craving Chinese food" puts `Chinese food` in `dietaryContext.cravings`. The coach adds a `cravingSuggestion` with a balanced way to have it.

## Running parts alone

`identify()` runs Agent 1 alone (used by `evaluation/run.py`). `coach()` runs Agent 2 alone on an existing report (used by `demo.py --compare-styles`).

## Tests

`python -m pytest adk_service/tests` uses scripted models through the real ADK runner, so no Gemini key is needed.
