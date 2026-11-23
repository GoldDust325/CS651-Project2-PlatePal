# Shiv Shankar Yadav — #3 history authorization and #6 scoring tests.
import asyncio
import copy
import httpx
from adk_service.history import MealHistory
from adk_service import history as module
from evaluation.run import food_scores

MACROS = {'calories': 100, 'proteinGrams': 10, 'carbohydrateGrams': 5, 'fatGrams': 2}


def test_history_is_scoped_to_authorization_and_cached(monkeypatch):
    calls = []
    class Client:
        def __init__(self, **kwargs): assert kwargs['follow_redirects'] is False
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, url, headers):
            calls.append(headers['Authorization'])
            assert url.endswith('/api/meals')
            rows = [] if headers['Authorization'] == 'Bearer B' else [
                {'mealId': 'a', 'analysis': {'foods': [], 'estimatedMacros': MACROS}}]
            return httpx.Response(200, json={'meals': rows}, request=httpx.Request('GET', url))
    monkeypatch.setattr(module.httpx, 'AsyncClient', Client)
    current = {'estimatedMacros': {**MACROS, 'calories': 150}}
    a, b = MealHistory('Bearer A', current), MealHistory('Bearer B', current)
    assert asyncio.run(a.compare_to_recent_meals())['deltas']['calories'] == 50
    assert asyncio.run(b.get_recent_meals()) == {'status': 'empty', 'meals': []}
    result = asyncio.run(a.get_recent_meals())
    result['meals'].clear()
    assert len(asyncio.run(a.get_recent_meals())['meals']) == 1
    assert calls == ['Bearer A', 'Bearer B']
    assert current['estimatedMacros']['calories'] == 150


def test_missing_auth_is_unavailable_not_empty_history():
    assert asyncio.run(MealHistory(None, {}).get_recent_meals())['status'] == 'unavailable'


def test_scoring_requires_manual_labels_and_handles_misses():
    assert food_scores(None, ['Rice'])['f1'] is None
    assert food_scores(['rice', 'beans'], [' Rice ', 'bread']) == {'precision': .5, 'recall': .5, 'f1': .5}
    assert food_scores(['rice'], [])['f1'] == 0


def test_real_runner_can_execute_history_comparison_tool():
    from google.adk.models.base_llm import BaseLlm
    from google.adk.models.llm_response import LlmResponse
    from google.genai import types
    from adk_service.service import coach
    class Model(BaseLlm):
        model: str = 'history-fixture'
        async def generate_content_async(self, llm_request, stream=False):
            responses = [p.function_response for c in llm_request.contents for p in c.parts or [] if p.function_response]
            names = [r.name for r in responses]
            if 'get_meal_analysis' not in names:
                part = types.Part.from_function_call(name='get_meal_analysis', args={})
            elif 'compare_to_recent_meals' not in names:
                part = types.Part.from_function_call(name='compare_to_recent_meals', args={})
            else:
                assert responses[-1].response['status'] == 'empty'
                part = types.Part.from_text(text='No saved meals yet; this meal has 100 estimated calories.')
            yield LlmResponse(content=types.Content(role='model', parts=[part]))
    current = {'estimatedMacros': MACROS, 'foods': []}
    history = MealHistory('Bearer isolated-test', current)
    history.cache = {'status': 'empty', 'meals': []}
    result = asyncio.run(coach(current, 'casual', 'history-runner-test', Model(), history))
    assert 'No saved meals' in result


def test_four_way_harness_reuses_fixed_paired_analysis(monkeypatch, tmp_path):
    from evaluation import run
    from PIL import Image
    image = tmp_path / 'fixture.png'
    Image.new('RGB', (2, 2)).save(image)
    audio = tmp_path / 'fixture.webm'
    audio.write_bytes(b'fixture only, never sent to a real provider')
    calls = []
    fixed = {'foods': [{'name': 'rice'}], 'estimatedMacros': MACROS}
    async def identify(request, data):
        calls.append(('photo' in request, 'audio' in request))
        return fixed
    async def coach(analysis, style, identifier):
        assert analysis is fixed
        return 'Scripted fixture recommendation'
    monkeypatch.setattr(run, 'identify', identify)
    monkeypatch.setattr(run, 'coach', coach)
    output = tmp_path / 'results.jsonl'
    asyncio.run(run.evaluate({'sample_id': 'fixture', 'photo_path': str(image),
        'audio_path': str(audio), 'audio_mime_type': 'audio/webm', 'manual_food_labels': ['rice']}, output))
    import json
    rows = [json.loads(line) for line in output.read_text().splitlines()]
    assert len(rows) == 4 and all(row['status'] == 'success' for row in rows)
    assert calls == [(True, False), (False, True), (True, True)]
    assert rows[-1]['foods'] == rows[-2]['foods']
    assert all(row['cost_amount'] is None and row['recommendation_quality'] is None for row in rows)
