# Author: Shiv Shankar Yadav
# Issues: #2 and #4 — authenticated local demo and style comparison
"""Submit a real photo through Firebase-protected Express without logging secrets."""
import argparse
import asyncio
import getpass
import json
from pathlib import Path
import time
import uuid

import httpx
from PIL import Image
from adk_service.service import FIELDS, STYLES, assemble, coach, validate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('photo', type=Path)
    parser.add_argument('--url', default='http://127.0.0.1:5001/api/analyze')
    parser.add_argument('--style', choices=list(STYLES), default='casual')
    parser.add_argument('--compare-styles', action='store_true', help='Run two additional real ADK coaching calls on the same analysis')
    args = parser.parse_args()
    with Image.open(args.photo) as im:
        mime = Image.MIME[im.format]
    token = getpass.getpass('Firebase ID token (hidden; same Firebase project as Express): ').strip()
    if not token:
        parser.error('A Firebase ID token is required')
    started = time.perf_counter()
    try:
        with args.photo.open('rb') as photo:
            response = httpx.post(args.url, headers={'Authorization': 'Bearer ' + token},
                                  files={'photo': ('meal', photo, mime)},
                                  data={'companionStyle': args.style, 'photoSource': 'local'}, timeout=125,
                                  trust_env=False)
    except httpx.HTTPError as exc:
        print(json.dumps({'httpStatus': None, 'elapsedMs': round((time.perf_counter()-started)*1000),
                          'failure': type(exc).__name__, 'expressValidation': 'not observed'}))
        raise SystemExit(1) from None
    evidence = {'httpStatus': response.status_code, 'elapsedMs': round((time.perf_counter()-started)*1000),
                'analysisId': None, 'expressValidation': 'not observed'}
    if response.status_code != 200:
        print(json.dumps(evidence))
        raise SystemExit(1)
    result = response.json()
    validate(result, 'analysisResponse')
    evidence.update(analysisId=result['analysisId'], expressValidation='passed (200 from existing validated route)',
                    clientSchemaValidation='passed')
    print(json.dumps(evidence))
    print(args.style + ': ' + result['recommendation'])
    if args.compare_styles:
        fixed = {k: result[k] for k in FIELDS}
        for style in STYLES:
            if style == args.style:
                continue
            rec = asyncio.run(coach(fixed, style, str(uuid.uuid4())))
            alternate = assemble(fixed, style, rec, str(uuid.uuid4()))
            assert alternate['foods'] == result['foods']
            assert alternate['estimatedMacros'] == result['estimatedMacros']
            print(style + ': ' + rec)
        print('All three styles preserved identical foods, quantities and macros.')


if __name__ == '__main__':
    main()
