# Author: Shiv Shankar Yadav
# Issues: #2 and #4 — runner, contract and style-invariance tests
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
RECOMMENDATIONS = {
    'casual': 'Your 150 g grilled chicken provides an estimated 46 g protein. Add some vegetables for an easy balance boost.',
    'strict': 'This 150 g grilled chicken has an estimated 248 calories and no carbohydrate. Add a measured whole-grain portion and vegetables for a more balanced meal.',
    'athlete': 'The grilled chicken supplies an estimated 46 g protein for recovery. With 0 g carbohydrate estimated here, consider rice or potatoes to support training fuel.',
}


class ScriptedModel(BaseLlm):
    model: str = 'fixture-model'
    style: str = 'casual'
    async def generate_content_async(self, llm_request, stream=False):
        responses = [p.function_response for c in llm_request.contents for p in c.parts or [] if p.function_response]
        if not responses:
            part = types.Part.from_function_call(name='get_meal_analysis', args={})
        else:
            assert responses[-1].response == FIXED
            part = types.Part.from_text(text=RECOMMENDATIONS[self.style])
        yield LlmResponse(content=types.Content(role='model', parts=[part]))


def test_three_styles_real_runner_fixed_analysis():
    before = copy.deepcopy(FIXED)
    results = []
    for style in s.STYLES:
        rec = asyncio.run(s.coach(FIXED, style, 'test-' + style, ScriptedModel(style=style)))
        result = s.assemble(FIXED, style, rec, 'test-' + style)
        results.append(result)
        assert 'grilled chicken' in rec
        print(style + ': ' + rec)
    assert FIXED == before
    assert len({r['recommendation'] for r in results}) == 3
    for result in results:
        assert result['foods'] == before['foods']
        assert result['estimatedMacros'] == before['estimatedMacros']


def photo_request():
    b = io.BytesIO()
    Image.new('RGB', (2, 2)).save(b, format='PNG')
    return {'schemaVersion': '1.0.0', 'photo': {'source': 'local', 'mimeType': 'image/png',
            'data': base64.b64encode(b.getvalue()).decode()}, 'companionStyle': 'athlete'}


def test_endpoint_decodes_bytes_and_validates(monkeypatch):
    seen = []
    async def identify(payload, data):
        assert isinstance(data, bytes) and data.startswith(b'\x89PNG')
        assert payload['photo']['mimeType'] == 'image/png'
        seen.append(1)
        return FIXED
    original = s.coach
    async def coach(fixed, style, analysis_id):
        return await original(fixed, style, analysis_id, ScriptedModel(style=style))
    monkeypatch.setattr(s, 'identify', identify)
    monkeypatch.setattr(s, 'coach', coach)
    response = TestClient(s.app).post('/analyze', json=photo_request())
    assert response.status_code == 200
    s.validate(response.json(), 'analysisResponse')
    assert len(seen) == 1


@pytest.mark.parametrize('mutation', ['base64', 'mime', 'style'])
def test_bad_request(mutation):
    payload = photo_request()
    if mutation == 'base64': payload['photo']['data'] = 'invalid!'
    if mutation == 'mime': payload['photo']['mimeType'] = 'image/jpeg'
    if mutation == 'style': payload['companionStyle'] = 'unknown'
    assert TestClient(s.app).post('/analyze', json=payload).status_code == 400


def test_invalid_model_output_is_safe(monkeypatch):
    async def identify(*args):
        raise ValueError('SECRET upstream body')
    monkeypatch.setattr(s, 'identify', identify)
    response = TestClient(s.app).post('/analyze', json=photo_request())
    assert response.status_code == 502
    assert 'SECRET' not in response.text


def test_shared_schema_rejects_invalid_estimates():
    bad = copy.deepcopy(FIXED)
    bad['estimatedMacros']['calories'] = -1
    with pytest.raises(Exception): s.assemble(bad, 'casual', 'Advice', 'id')
    bad['estimatedMacros']['calories'] = float('nan')
    with pytest.raises(ValueError): s.assemble(bad, 'casual', 'Advice', 'id')


def test_gemini_receives_inline_bytes_without_style(monkeypatch):
    captured = []
    class Models:
        async def generate_content(self, **kwargs):
            captured.append(kwargs)
            return type('Response', (), {'text': json.dumps(FIXED)})()
    class AsyncClient:
        models = Models()
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
    class Client:
        def __init__(self, **kwargs):
            assert kwargs["http_options"].retry_options.attempts == 3
        aio = AsyncClient()
    monkeypatch.setattr(s.genai, 'Client', Client)
    payload = photo_request()
    image = s.decode_photo(payload['photo'])
    result = asyncio.run(s.identify(payload, image))
    assert result == FIXED
    assert len(captured) == 1
    media = captured[0]['contents'][1].inline_data
    assert media.data == image
    assert media.mime_type == 'image/png'
    assert 'athlete' not in captured[0]['contents'][0].text
    assert captured[0]['config'].response_mime_type == 'application/json'


def test_timeout_is_safe(monkeypatch):
    async def identify(*args): raise TimeoutError('PRIVATE')
    monkeypatch.setattr(s, 'identify', identify)
    response = TestClient(s.app).post('/analyze', json=photo_request())
    assert response.status_code == 504
    assert 'PRIVATE' not in response.text


def test_runner_rejects_advice_without_tool():
    class NoToolModel(BaseLlm):
        model: str = 'no-tool'
        async def generate_content_async(self, llm_request, stream=False):
            yield LlmResponse(content=types.Content(role='model', parts=[types.Part.from_text(text='Generic advice')]))
    with pytest.raises(ValueError, match='must use meal tool'):
        asyncio.run(s.coach(FIXED, 'casual', 'no-tool-test', NoToolModel()))


def test_invalid_final_response_is_not_returned(monkeypatch):
    async def identify(*args): return FIXED
    async def coach(*args): return ''
    monkeypatch.setattr(s, 'identify', identify)
    monkeypatch.setattr(s, 'coach', coach)
    assert TestClient(s.app).post('/analyze', json=photo_request()).status_code == 502
