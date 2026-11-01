"""Writes manifest.json: counts and sha256 of every benchmark file. Usage: python build/manifest.py"""
import os, json, hashlib, datetime, collections
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
stats = json.load(open(os.path.join(B, 'build', 'stats.json')))
files = {}
for root, _, fs in os.walk(B):
    for f in sorted(fs):
        p = os.path.join(root, f); rel = os.path.relpath(p, B).replace(os.sep, '/')
        if rel == 'manifest.json' or '__pycache__' in rel: continue
        files[rel] = {'sha256': hashlib.sha256(open(p, 'rb').read()).hexdigest(), 'bytes': os.path.getsize(p)}
def cnt(part):
    c = collections.defaultdict(collections.Counter)
    for l in open(os.path.join(B, part, 'items.jsonl'), encoding='utf-8'):
        x = json.loads(l)
        c['by_label'][x['label']] += 1
        c['by_type'][x.get('neg_type') or x.get('subset')] += 1
        if x['label'] == 'positive':
            s = x['source']
            c['positives_by_source'][(s.get('id') or s.get('dataset')) if isinstance(s, dict) else s] += 1
            c['positives_by_order'][x['taxon'].get('order') or 'NA'] += 1
    return {k: dict(sorted(v.items())) for k, v in c.items()}
dev = cnt('dev'); held = cnt('heldout')
m = {
  'name': 'DELPHI organism-design scorer benchmark', 'version': 'v1',
  'frozen_at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
  'prereg_sha256': files['BENCHMARK-PREREGISTRATION.md']['sha256'],
  'independence': 'built without reading sim-engine/validate/score.mjs, score-weights.json, scorer-results*.json, SCORER-PREREGISTRATION.md or validate/data/fishshapes-features.json',
  'heldout_notice': 'heldout/ must not be read by the scorer author; only the blind evaluator, once, after the scorer is frozen. Heldout counts by type are deliberately not listed here.',
  'counts': {'dev': dev, 'heldout_by_label': held['by_label'], 'heldout_total': sum(held['by_label'].values()),
             'heldout_families': stats['n_families_heldout'], 'positive_taxa_all_partitions': stats['positive_taxa'], 'own_models_unlabelled': 7},
  'screens': stats['screens'], 'raw_inputs': stats['raw_inputs'],
  'licences': {'fishshapes-v1': 'CC0-1.0', 'fishbase-morphmet-v24.07': 'CC BY-NC 4.0 (non-commercial, attribution)', 'repo-derived items': 'repository'},
  'no_aves': 'bird orders/class filtered and asserted absent; 0 dropped (sources are fish-only)',
  'files': files,
}
json.dump(m, open(os.path.join(B, 'manifest.json'), 'w', encoding='utf-8'), indent=1)
print(m['prereg_sha256'], json.dumps(dev['by_label']), held['by_label'])
