"""Shiv Shankar Yadav — #6/#7. Actual local experiments, no fabricated observations."""
import argparse
import asyncio
import base64
import json
import os
from pathlib import Path
import time
import uuid
from PIL import Image
from adk_service.service import identify, coach


def food_scores(labels, predictions):
    if labels is None:
        return {'precision': None, 'recall': None, 'f1': None}
    normalize = lambda values: {x.strip().casefold() for x in values if x.strip()}
    truth, predicted = normalize(labels), normalize(predictions)
    tp = len(truth & predicted)
    precision = tp / len(predicted) if predicted else (1.0 if not truth else 0.0)
    recall = tp / len(truth) if truth else (1.0 if not predicted else 0.0)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {'precision': precision, 'recall': recall, 'f1': f1}


async def evaluate(sample, output):
    if not sample.get('sample_id'):
        raise ValueError('Each sample needs a unique sample_id; do not run the blank template.')
    paired, paired_ms = None, 0
    for mode in ('photo_only', 'audio_only', 'photo_audio', 'gemini_adk'):
        row = {'sample_id': sample['sample_id'], 'mode': mode,
               'model': os.getenv('GEMINI_MODEL', 'gemini-3.8-flash'), 'prompt_version': 'submission-v1',
               'manual_food_labels': sample.get('manual_food_labels'), 'status': 'skipped',
               'latency_ms': None, 'cost_amount': None, 'cost_currency': None,
               'recommendation_quality': None, 'identification_scores': None}
        needs_photo = mode != 'audio_only'
        needs_audio = mode in ('audio_only', 'photo_audio', 'gemini_adk')
        if (needs_photo and not sample.get('photo_path')) or (needs_audio and not sample.get('audio_path')):
            row['reason'] = 'required_media_missing'
        else:
            started = time.perf_counter()
            try:
                request = {'companionStyle': sample.get('companion_style', 'casual')}
                image_bytes = None
                if needs_photo:
                    path = Path(sample['photo_path'])
                    with Image.open(path) as im: mime = Image.MIME[im.format]
                    image_bytes = path.read_bytes()
                    request['photo'] = {'mimeType': mime}
                if needs_audio:
                    request['audio'] = {'mimeType': sample['audio_mime_type'],
                                        'data': base64.b64encode(Path(sample['audio_path']).read_bytes()).decode()}
                async with asyncio.timeout(180):
                    # The ADK arm reuses exactly the photo+audio arm's analysis.
                    if mode == 'gemini_adk':
                        if paired is None:
                            raise ValueError('Paired photo/audio analysis unavailable')
                        fixed = paired
                        review = await coach(fixed, request['companionStyle'], str(uuid.uuid4()))
                        recommendation = review['recommendation']
                    else:
                        fixed = await identify(request, image_bytes)
                        recommendation = None
                    if mode == 'photo_audio':
                        paired = fixed
                        paired_ms = (time.perf_counter() - started) * 1000
                predictions = [x['name'] for x in fixed['foods']]
                row.update(status='success', foods=fixed['foods'], estimatedMacros=fixed['estimatedMacros'],
                           model_food_predictions=predictions, recommendation=recommendation,
                           identification_scores=food_scores(sample.get('manual_food_labels'), predictions))
            except Exception as error:
                row.update(status='failure', reason=type(error).__name__)
            row['latency_ms'] = round((time.perf_counter() - started) * 1000)
            if mode == 'gemini_adk' and row['status'] == 'success':
                row['coaching_latency_ms'] = row['latency_ms']
                row['latency_ms'] = round(paired_ms + row['latency_ms'])
        with output.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps(row, allow_nan=False) + '\n')
        print(sample['sample_id'], mode, row['status'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, default=Path('.local/evaluation.jsonl'))
    args = parser.parse_args()
    samples = [json.loads(line) for line in args.manifest.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    ids = [s.get('sample_id') for s in samples]
    if not all(ids) or len(ids) != len(set(ids)):
        parser.error('Provide nonempty unique sample IDs.')
    if args.output.exists():
        parser.error('Output exists; choose a new output file to preserve measurements.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for sample in samples:
        asyncio.run(evaluate(sample, args.output))


if __name__ == '__main__': main()
