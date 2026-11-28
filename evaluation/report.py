"""Shiv Shankar Yadav — #8. Charts and descriptive findings from observed rows only."""
import argparse
from collections import defaultdict
import html
import json
from pathlib import Path
import statistics


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('results', type=Path)
    parser.add_argument('--output', type=Path, default=Path('.local/evaluation-report.html'))
    args = parser.parse_args()
    rows = [json.loads(line) for line in args.results.read_text().splitlines() if line.strip()]
    groups = defaultdict(list)
    for row in rows: groups[row['mode']].append(row)
    sections = []
    for mode, items in groups.items():
        successful = [r for r in items if r['status'] == 'success']
        failed = sum(r['status'] == 'failure' for r in items)
        skipped = sum(r['status'] == 'skipped' for r in items)
        latencies = [r['latency_ms'] for r in successful if r.get('latency_ms') is not None]
        f1 = [r['identification_scores']['f1'] for r in successful if r.get('identification_scores') and r['identification_scores']['f1'] is not None]
        mean = round(statistics.mean(latencies)) if latencies else None
        f1mean = statistics.mean(f1) if f1 else None
        sections.append(f'<section><h2>{html.escape(mode)}</h2><p>Success: {len(successful)}; failure: {failed}; skipped: {skipped}.</p>'
                        f'<p>Mean successful latency: {mean if mean is not None else "not observed"} ms. '
                        f'Mean exact-label F1: {round(f1mean, 3) if f1mean is not None else "not scored"} ({len(f1)} labeled successes).</p>'
                        f'<p>Success count <meter min="0" max="{max(1, len(items))}" value="{len(successful)}">{len(successful)}</meter></p></section>')
    document = '<!doctype html><meta charset="utf-8"><title>PlatePal observed evaluation</title><style>body{font:18px system-ui;max-width:900px;margin:40px auto;padding:20px}section{border-bottom:1px solid #ccc}meter{width:300px}</style><h1>PlatePal observed evaluation</h1>'
    document += ''.join(sections) or '<p>No observations supplied.</p>'
    document += '<h2>Interpretation limits</h2><p>Descriptive observations only; small samples do not establish general superiority. Compare identification on the same labeled paired cases. Audio-only depends on what the speaker actually says. Exact-label F1 penalizes synonyms. ADK reuses the paired analysis, so identical identification is by construction; assess its recommendation separately using human scores. Baseline arms do not generate advice. Latency excludes Express/network upload and includes reused identification time in the ADK arm. Missing costs and scores are unknown, not zero. Failures and skips are reported separately. Do not claim causal or statistical significance from these summaries.</p>'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(document, encoding='utf-8')
    print(args.output)


if __name__ == '__main__': main()
