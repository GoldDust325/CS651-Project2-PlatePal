# Author: Shiv Shankar Yadav
# Issues: #2 and #4 — orchestrator, agent contract and style-invariance tests
import asyncio
import base64
import copy
import io
import json
from pathlib import Path

from fastapi.testclient import TestClient
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse
from google.genai import types
from PIL import Image
import pytest
from adk_service import service as s

FIXTURES = json.loads((Path(__file__).resolve().parents[2] / 'server/tests/analysis.fixtures.json').read_text())
FIXED = {k: FIXTURES['validAnalysisResponse'][k] for k in s.FIELDS}

# Agent 1's full report: the shared fixture plus category, nutrients and
# what the user said in the voice note.
REPORT = copy.deepcopy(FIXED)
REPORT['foods'][0]['category'] = 'protein'
REPORT['foods'][0]['estimatedNutrients'] = {'fiberGrams': 0, 'sugarGrams': 0, 'sodiumMilligrams': 110}
REPORT['dietaryContext'] = {'allergies': ['soy'], 'cravings': ['Chinese food']}

RECOMMENDATIONS = {
    'casual': 'Your 150 g grilled chicken provides an estimated 46 g protein. Add some vegetables for an easy balance boost.',
    'strict': 'This 150 g grilled chicken has an estimated 248 calories and no carbohydrate. Add a measured whole-grain portion and vegetables for a more balanced meal.',
    'athlete': 'The grilled chicken supplies an estimated 46 g protein for recovery. With 0 g carbohydrate estimated here, consider rice or potatoes to support training fuel.',
}


def review(style='casual', **changes):
    value = {
        'healthRating': 'okay',
        'healthNote': 'High in protein but no vegetables or grains.',
        'suggestedAdditions': ['steamed broccoli', 'brown rice'],
        'allergyFlags': [{'allergen': 'soy', 'foodIds': ['food-001'],
                          'note': 'Marinades often contain soy sauce; check the recipe.'}],
        'cravingSuggestion': 'A chicken and vegetable stir-fry with brown rice fits that craving.',
        'recommendation': RECOMMENDATIONS[style],
    }
    value.update(changes)
    return value


def request_parts(llm_request):
    return [p for c in llm_request.contents for p in c.parts or []]


PLAN = {
    'fitnessGoal': 'lose_weight',
    'dailyTargets': {'calories': 2600, 'proteinGrams': 150, 'carbohydrateGrams': 250,
                     'fatGrams': 70, 'fiberGrams': 35},
    'weeklyGoals': ['Add steamed broccoli to 4 dinners this week.', ' '],
    'reason': 'Protein is on track but vegetables are low.',
}
PLANNER_TOOLS = ['get_meal_review', 'get_current_goals', 'get_recent_meals']


class ScriptedModel(BaseLlm):
    """Plays all agents: report for Agent 1, review for Agent 2, plan for Agent 3."""
    model: str = 'fixture-model'
    style: str = 'casual'
    report: dict = REPORT
    review: dict | None = None
    plan: dict = PLAN
    seen: list = []

    async def generate_content_async(self, llm_request, stream=False):
        parts = request_parts(llm_request)
        instruction = str(llm_request.config.system_instruction)
        if 'goal planner' in instruction:
            self.seen.append(('planner', instruction, parts, llm_request.config))
            done = [p.function_response.name for p in parts if p.function_response]
            pending = [name for name in PLANNER_TOOLS if name not in done]
            if pending:
                part = types.Part.from_function_call(name=pending[0], args={})
            else:
                part = types.Part.from_text(text=json.dumps(self.plan))
        elif 'food identifier' in instruction:
            self.seen.append(('identifier', instruction, parts, llm_request.config))
            part = types.Part.from_text(text=json.dumps(self.report))
        else:
            self.seen.append(('coach', instruction, parts, llm_request.config))
            responses = [p.function_response for p in parts if p.function_response]
            if not responses:
                part = types.Part.from_function_call(name='get_meal_analysis', args={})
            else:
                assert responses[-1].response == self.report
                part = types.Part.from_text(text=json.dumps(self.review or review(self.style)))
        yield LlmResponse(content=types.Content(role='model', parts=[part]))


def photo_request(style='athlete', audio=False):
    b = io.BytesIO()
    Image.new('RGB', (2, 2)).save(b, format='PNG')
    request = {'schemaVersion': '1.0.0', 'photo': {'source': 'local', 'mimeType': 'image/png',
               'data': base64.b64encode(b.getvalue()).decode()}, 'companionStyle': style}
    if audio:
        request['audio'] = {'mimeType': 'audio/webm', 'durationSeconds': 3,
                            'data': base64.b64encode(b'fixture voice note').decode()}
    return request


def run_pipeline(request, model, history=None):
    image = s.decode_photo(request['photo'])
    return asyncio.run(s.analyze_meal(request, image, 'pipeline-test', model, history))


GOALS = {'fitnessGoal': 'build_muscle', 'weeklyGoals': ['Eat fruit daily.'],
         'dailyTargets': {'calories': 2400, 'proteinGrams': 140, 'carbohydrateGrams': 280,
                          'fatGrams': 80, 'fiberGrams': 30}}


def signed_in_history(goals=GOALS, meals=2):
    from adk_service.history import MealHistory
    history = MealHistory('Bearer isolated-test', None)
    history.cache = {'status': 'available' if meals else 'empty',
                     'meals': [{'mealId': str(i), 'foods': [], 'estimatedMacros': REPORT['estimatedMacros']}
                               for i in range(meals)]}
    history.goals_cache = {'status': 'available' if goals else 'empty', 'goals': copy.deepcopy(goals)}
    return history


def test_orchestrator_runs_identifier_then_coach():
    model = ScriptedModel(style='athlete', seen=[])
    request = photo_request(audio=True)
    fixed, coach_review, plan = run_pipeline(request, model)
    assert plan is None  # no signed-in user, so no planner

    assert [step[0] for step in model.seen] == ['identifier', 'coach', 'coach']
    _, id_instruction, id_parts, id_config = model.seen[0]
    media = [p.inline_data for p in id_parts if p.inline_data]
    assert [m.mime_type for m in media] == ['image/png', 'audio/webm']
    assert media[1].data == b'fixture voice note'
    assert 'athlete' not in id_instruction.lower()
    assert id_config.response_mime_type == 'application/json'
    assert 'dietaryContext' in id_config.response_json_schema['required']

    # The coach gets the meal through its tool, never the raw media.
    for _, instruction, parts, _ in model.seen[1:]:
        assert not any(p.inline_data for p in parts)
        assert s.STYLES['athlete'] in instruction

    assert fixed == REPORT
    result = s.assemble(fixed, 'athlete', coach_review, 'pipeline-test')
    assert result['recommendation'] == RECOMMENDATIONS['athlete']
    assert result['review']['healthRating'] == 'okay'
    assert result['review']['allergyFlags'][0]['foodIds'] == ['food-001']
    assert result['dietaryContext'] == REPORT['dietaryContext']
    assert result['estimatedNutrients'] == {'fiberGrams': 0, 'sugarGrams': 0, 'sodiumMilligrams': 110}
    assert 'recommendation' not in result['review']


def test_three_styles_real_runner_fixed_analysis():
    before = copy.deepcopy(REPORT)
    results = []
    for style in s.STYLES:
        rec = asyncio.run(s.coach(REPORT, style, 'test-' + style, ScriptedModel(style=style, seen=[])))
        result = s.assemble(REPORT, style, rec, 'test-' + style)
        results.append(result)
        assert 'grilled chicken' in result['recommendation'].lower()
    assert REPORT == before
    assert len({r['recommendation'] for r in results}) == 3
    for result in results:
        assert result['foods'] == before['foods']
        assert result['estimatedMacros'] == before['estimatedMacros']


def test_report_without_new_fields_still_assembles():
    # Old saved meals and the legacy fixture have no category, nutrients or review.
    result = s.assemble(FIXED, 'casual', 'Plain advice', 'legacy')
    assert 'review' not in result and 'estimatedNutrients' not in result
    s.validate(FIXTURES['validAnalysisResponse'], 'analysisResponse')


def test_review_is_cleaned_for_the_contract():
    messy = review(cravingSuggestion='  ', suggestedAdditions=['a', ' ', 'b', 'c', 'd'],
                   allergyFlags=[{'allergen': 'soy', 'foodIds': ['food-001', 'made-up'], 'note': 'Check.'}])
    result = s.assemble(REPORT, 'casual', messy, 'clean')
    assert 'cravingSuggestion' not in result['review']
    assert result['review']['suggestedAdditions'] == ['a', 'b', 'c']
    assert result['review']['allergyFlags'][0]['foodIds'] == ['food-001']


def test_identifier_report_is_validated():
    bad = copy.deepcopy(REPORT)
    bad['estimatedMacros']['calories'] = -1
    with pytest.raises(Exception):
        run_pipeline(photo_request(), ScriptedModel(report=bad, seen=[]))
    bad = copy.deepcopy(REPORT)
    bad['foods'][0]['category'] = 'meat'
    with pytest.raises(Exception):
        run_pipeline(photo_request(), ScriptedModel(report=bad, seen=[]))


def test_invalid_review_is_rejected():
    with pytest.raises(Exception):
        run_pipeline(photo_request(), ScriptedModel(review=review(healthRating='great'), seen=[]))


def test_runner_rejects_advice_without_tool():
    class NoToolModel(BaseLlm):
        model: str = 'no-tool'
        async def generate_content_async(self, llm_request, stream=False):
            yield LlmResponse(content=types.Content(role='model', parts=[
                types.Part.from_text(text=json.dumps(review()))]))
    with pytest.raises(ValueError, match='must use meal tool'):
        asyncio.run(s.coach(REPORT, 'casual', 'no-tool-test', NoToolModel()))


def test_identify_alone_handles_audio_only():
    model = ScriptedModel(seen=[])
    request = photo_request(audio=True)
    del request['photo']
    report = asyncio.run(s.identify(request, None, model))
    assert report == REPORT
    media = [p.inline_data.mime_type for p in model.seen[0][2] if p.inline_data]
    assert media == ['audio/webm']


def test_endpoint_runs_orchestrator_and_validates(monkeypatch):
    seen = []
    original = s.analyze_meal
    async def analyze_meal(payload, data, analysis_id, history=None, progress=None):
        assert isinstance(data, bytes) and data.startswith(b'\x89PNG')
        seen.append(history)
        return await original(payload, data, analysis_id, ScriptedModel(style='athlete', seen=[]),
                              history, progress)
    monkeypatch.setattr(s, 'analyze_meal', analyze_meal)
    response = TestClient(s.app).post('/analyze', json=photo_request())
    assert response.status_code == 200
    body = response.json()
    s.validate(body, 'analysisResponse')
    assert body['review']['healthRating'] == 'okay'
    assert body['foods'] == REPORT['foods']
    assert seen == [None]


@pytest.mark.parametrize('mutation', ['base64', 'mime', 'style', 'audio'])
def test_bad_request(mutation):
    payload = photo_request(audio=mutation == 'audio')
    if mutation == 'base64': payload['photo']['data'] = 'invalid!'
    if mutation == 'mime': payload['photo']['mimeType'] = 'image/jpeg'
    if mutation == 'style': payload['companionStyle'] = 'unknown'
    if mutation == 'audio': payload['audio']['data'] = 'invalid!'
    assert TestClient(s.app).post('/analyze', json=payload).status_code == 400


def test_invalid_model_output_is_safe(monkeypatch):
    async def analyze_meal(*args, **kwargs):
        raise ValueError('SECRET upstream body')
    monkeypatch.setattr(s, 'analyze_meal', analyze_meal)
    response = TestClient(s.app).post('/analyze', json=photo_request())
    assert response.status_code == 502
    assert 'SECRET' not in response.text


def test_bad_report_through_endpoint_is_502(monkeypatch):
    bad = copy.deepcopy(REPORT)
    bad['estimatedMacros']['calories'] = float('nan')
    original = s.analyze_meal
    async def analyze_meal(payload, data, analysis_id, history=None, progress=None):
        return await original(payload, data, analysis_id, ScriptedModel(report=bad, seen=[]), history, progress)
    monkeypatch.setattr(s, 'analyze_meal', analyze_meal)
    assert TestClient(s.app).post('/analyze', json=photo_request()).status_code == 502


def test_shared_schema_rejects_invalid_estimates():
    bad = copy.deepcopy(FIXED)
    bad['estimatedMacros']['calories'] = -1
    with pytest.raises(Exception): s.assemble(bad, 'casual', 'Advice', 'id')
    bad['estimatedMacros']['calories'] = float('nan')
    with pytest.raises(ValueError): s.assemble(bad, 'casual', 'Advice', 'id')


def test_timeout_is_safe(monkeypatch):
    async def analyze_meal(*args, **kwargs): raise TimeoutError('PRIVATE')
    monkeypatch.setattr(s, 'analyze_meal', analyze_meal)
    response = TestClient(s.app).post('/analyze', json=photo_request())
    assert response.status_code == 504
    assert 'PRIVATE' not in response.text


# #2 live-test hardening: fall back to a second model when Gemini is busy.
class BusyError(Exception):
    code = 503


def test_falls_back_when_primary_model_busy(monkeypatch):
    monkeypatch.setenv('GEMINI_MODEL', 'primary-model')
    monkeypatch.setenv('GEMINI_FALLBACK_MODEL', 'fallback-model')
    tried = []

    async def attempt(model, session_id):
        tried.append((model.model, session_id))
        if model.model == 'primary-model':
            raise BusyError()
        return 'fallback result'

    assert asyncio.run(s.with_fallback(attempt, 'busy-test', 'orchestrator')) == 'fallback result'
    assert tried == [('primary-model', 'busy-test'), ('fallback-model', 'busy-test-fallback')]


def test_does_not_fall_back_on_other_errors(monkeypatch):
    monkeypatch.setenv('GEMINI_MODEL', 'primary-model')
    monkeypatch.setenv('GEMINI_FALLBACK_MODEL', 'fallback-model')
    tried = []

    async def attempt(model, session_id):
        tried.append(model.model)
        raise ValueError('bad output')

    with pytest.raises(ValueError):
        asyncio.run(s.with_fallback(attempt, 'error-test', 'orchestrator'))
    assert tried == ['primary-model']


def test_no_fallback_configured(monkeypatch):
    monkeypatch.setenv('GEMINI_MODEL', 'primary-model')
    monkeypatch.delenv('GEMINI_FALLBACK_MODEL', raising=False)
    assert s.gemini_models() == ['primary-model']


def test_history_compares_against_identified_meal():
    from adk_service.history import MealHistory
    history = MealHistory('Bearer isolated-test', None)
    history.cache = {'status': 'empty', 'meals': []}
    image = s.decode_photo(photo_request()['photo'])
    asyncio.run(s.analyze_meal(photo_request(), image, 'history-test', ScriptedModel(seen=[]), history))
    assert history.current == REPORT


def test_planner_runs_third_for_signed_in_users():
    model = ScriptedModel(style='athlete', seen=[])
    fixed, coach_review, plan = run_pipeline(photo_request(), model, signed_in_history())
    assert [step[0] for step in model.seen] == ['identifier', 'coach', 'coach'] + ['planner'] * 4
    for _, _, parts, _ in model.seen[3:]:
        assert not any(p.inline_data for p in parts)
    review_call = [p.function_response.response for p in model.seen[-1][2]
                   if p.function_response and p.function_response.name == 'get_meal_review'][0]
    assert review_call['review']['healthRating'] == coach_review['healthRating']

    goals = plan['goals']
    # Existing goals: the fitness goal stays the user's and targets move at most 10%.
    assert goals['fitnessGoal'] == 'build_muscle'
    assert goals['dailyTargets'] == {'calories': 2600, 'proteinGrams': 150, 'carbohydrateGrams': 252,
                                     'fatGrams': 72, 'fiberGrams': 33}
    assert goals['weeklyGoals'] == ['Add steamed broccoli to 4 dinners this week.']
    assert plan['basedOnMealCount'] == 2

    result = s.assemble(fixed, 'athlete', coach_review, 'plan-test', plan)
    assert result['planUpdate'] == plan


def test_planner_sets_first_goals_when_none_exist():
    _, _, plan = run_pipeline(photo_request(), ScriptedModel(seen=[]), signed_in_history(goals=None, meals=0))
    assert plan['goals']['fitnessGoal'] == 'lose_weight'
    assert plan['goals']['dailyTargets']['calories'] == 2600
    assert plan['basedOnMealCount'] == 0


def test_planner_failure_keeps_the_review():
    bad = dict(PLAN, fitnessGoal='bulk')
    fixed, coach_review, plan = run_pipeline(photo_request(), ScriptedModel(plan=bad, seen=[]),
                                             signed_in_history())
    assert plan is None
    assert fixed == REPORT and coach_review['healthRating'] == 'okay'


def test_planner_targets_are_clamped_to_safe_limits():
    plan = s.clean_plan(dict(PLAN, dailyTargets={**PLAN['dailyTargets'], 'calories': 1000}),
                        None, 0)
    assert plan['goals']['dailyTargets']['calories'] == 1000
    low = {**GOALS, 'dailyTargets': {**GOALS['dailyTargets'], 'calories': 1050}}
    plan = s.clean_plan(dict(PLAN, dailyTargets={**PLAN['dailyTargets'], 'calories': 1000}), low, 0)
    assert plan['goals']['dailyTargets']['calories'] == 1000
    s.validate(plan, 'planUpdate')


def test_endpoint_returns_plan_for_signed_in_user(monkeypatch):
    original = s.analyze_meal
    seen = []
    async def analyze_meal(payload, data, analysis_id, history=None, progress=None):
        seen.append(history.authorization)
        history.cache = signed_in_history().cache
        history.goals_cache = signed_in_history().goals_cache
        return await original(payload, data, analysis_id, ScriptedModel(seen=[]), history, progress)
    monkeypatch.setattr(s, 'analyze_meal', analyze_meal)
    response = TestClient(s.app).post('/analyze', json=photo_request(),
                                      headers={'Authorization': 'Bearer user-token'})
    assert response.status_code == 200
    body = response.json()
    s.validate(body, 'analysisResponse')
    assert body['planUpdate']['goals']['fitnessGoal'] == 'build_muscle'
    assert seen == ['Bearer user-token']


def test_coaching_fallback_keeps_successful_report(monkeypatch):
    class BusyCoach(ScriptedModel):
        async def generate_content_async(self, llm_request, stream=False):
            if 'food identifier' not in str(llm_request.config.system_instruction):
                raise BusyError()
            async for event in super().generate_content_async(llm_request, stream):
                yield event
    primary = BusyCoach(seen=[])
    fallback = ScriptedModel(seen=[])
    monkeypatch.setenv('GEMINI_MODEL', 'primary')
    monkeypatch.setenv('GEMINI_FALLBACK_MODEL', 'fallback')
    monkeypatch.setattr(s, 'gemini', lambda name: primary if name == 'primary' else fallback)
    request = photo_request()
    fixed, result, _ = asyncio.run(s.analyze_meal(request, s.decode_photo(request['photo']), 'retry'))
    assert fixed == REPORT
    assert [step[0] for step in primary.seen] == ['identifier']
    assert all(step[0] == 'coach' for step in fallback.seen)
    assert result['recommendation']


def test_planner_timeout_preserves_valid_response(monkeypatch):
    class SlowPlanner(ScriptedModel):
        async def generate_content_async(self, llm_request, stream=False):
            if 'goal planner' in str(llm_request.config.system_instruction):
                await asyncio.sleep(10)
            async for event in super().generate_content_async(llm_request, stream):
                yield event
    monkeypatch.setenv('ADK_PLANNER_TIMEOUT_SECONDS', '0.02')
    fixed, result, plan = run_pipeline(photo_request(), SlowPlanner(seen=[]), signed_in_history())
    assert plan is None
    assert fixed == REPORT
    s.validate(s.assemble(fixed, 'athlete', result, 'timeout-test'), 'analysisResponse')


def test_planner_receives_requested_style():
    model = ScriptedModel(seen=[])
    run_pipeline(photo_request('athlete'), model, signed_in_history())
    instructions = [step[1] for step in model.seen if step[0] == 'planner']
    assert instructions and all('Requested style: athlete' in text for text in instructions)
