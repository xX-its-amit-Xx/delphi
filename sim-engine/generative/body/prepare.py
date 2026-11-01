"""FishShapes v1 -> the derived training table for the body-level generative models.

Usage:  python -I prepare.py <path/to/FishShapes_specimensv1.csv> [<path/to/zenodo-record.json>]

Source: Price SA, Friedman ST, Corn KA, et al. (2022) FishShapes v1. Ecology 103:e3829, doi 10.1002/ecy.3829.
Data: Zenodo record 6642650 (= Dryad doi 10.5061/dryad.vt4b8gtvf), file FishShapes_specimensv1.csv, licence CC0-1.0.
The raw file is NOT stored in the repo (1.6 MB); data/fishshapes-manifest.json records its URL and sha256 so
anyone can re-fetch it and check it is the same bytes. data/fishshapes-derived.csv keeps only the columns used.
Stdlib only.
"""
import csv, hashlib, json, math, random, sys, os

RAW_URL = 'https://zenodo.org/api/records/6642650/files/FishShapes_specimensv1.csv/content'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_CSV = os.path.join(HERE, 'data', 'fishshapes-derived.csv')
OUT_MAN = os.path.join(HERE, 'data', 'fishshapes-manifest.json')

# The 7 features, all natural logs. Ratios match anatomy-model/parametric/params.py definitions:
#   body_depth_over_SL = max depth / SL, body_width_over_SL = max width / SL,
#   peduncle_depth_frac = min peduncle depth / max body depth, peduncle_width_frac = min peduncle width / max width.
FEATURES = ['log_SL_mm', 'log_depth_over_SL', 'log_width_over_SL', 'log_peduncle_depth_frac',
            'log_peduncle_width_frac', 'log_fulton_K', 'log_head_depth_over_depth']
COLS = ['Total_weight', 'Standard_length', 'Max_body_depth', 'Max_fish_width', 'Head_depth',
        'Min_caudalpeduncle_depth', 'Min_caudalpeduncle_width']
# Every Order in FishShapes v1 is an actinopterygian order. A bird or any non-fish taxon must never enter
# (Aves is the frozen holdout); this is checked, not assumed.
NON_FISH_MARKERS = ['aves', 'passeriformes', 'accipitriformes', 'anseriformes', 'galliformes', 'mammalia', 'reptilia',
                    'amphibia', 'chiroptera', 'columbiformes', 'strigiformes', 'piciformes', 'charadriiformes']


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 16), b''):
            h.update(b)
    return h.hexdigest()


def num(s):
    try:
        v = float(s)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def main(raw, record=None):
    rows = list(csv.DictReader(open(raw, newline='', encoding='utf-8')))
    excluded = {'missing_value': 0, 'nonpositive': 0, 'implausible_ratio': 0}
    orders = sorted({r['Order'] for r in rows})
    bad = [o for o in orders if any(m in o.lower() for m in NON_FISH_MARKERS)]
    if bad:
        raise SystemExit(f'non-fish taxa in FishShapes: {bad}')
    out = []
    for r in rows:
        v = {c: num(r[c]) for c in COLS}
        if any(x is None for x in v.values()):
            excluded['missing_value'] += 1; continue
        if any(x <= 0 for x in v.values()):
            excluded['nonpositive'] += 1; continue
        SL = v['Standard_length']; W = v['Total_weight']; D = v['Max_body_depth']; Wd = v['Max_fish_width']
        H = v['Head_depth']; PD = v['Min_caudalpeduncle_depth']; PW = v['Min_caudalpeduncle_width']
        K = 1e5 * W / SL ** 3  # Fulton K = 100 W(g) / L(cm)^3
        q = dict(d=D / SL, w=Wd / SL, pd=PD / D, pw=PW / Wd, K=K, h=H / D)
        # Plausibility screen (stated, generous): a minimum peduncle dimension cannot exceed 1.5x the maximum body
        # dimension, head depth cannot exceed 1.5x max depth, and K outside [0.05, 20] is a units/transcription error.
        if not (0.005 < q['d'] < 2 and 0.005 < q['w'] < 2 and q['pd'] <= 1.5 and q['pw'] <= 1.5
                and q['h'] <= 1.5 and 0.05 <= K <= 20):
            excluded['implausible_ratio'] += 1; continue
        out.append(dict(SpecimenID=r['SpecimenID'], species=r['Tree_name'], family=r['Family'], order=r['Order'],
                        SL_mm=SL, weight_g=W, depth_mm=D, width_mm=Wd, head_depth_mm=H, ped_depth_mm=PD, ped_width_mm=PW,
                        log_SL_mm=math.log(SL), log_depth_over_SL=math.log(q['d']), log_width_over_SL=math.log(q['w']),
                        log_peduncle_depth_frac=math.log(q['pd']), log_peduncle_width_frac=math.log(q['pw']),
                        log_fulton_K=math.log(K), log_head_depth_over_depth=math.log(q['h'])))
    # Species-level split, stratified by family: within each family 20 % of species (rounded; at least one when the
    # family has >= 3 species; p = 0.2 for one when it has fewer) go to TEST. A test specimen's species was never trained on.
    rng = random.Random(20261031)
    by_fam = {}
    for r in out:
        by_fam.setdefault(r['family'], set()).add(r['species'])
    test_species = set()
    for fam in sorted(by_fam):
        sp = sorted(by_fam[fam]); rng.shuffle(sp)
        k = round(0.2 * len(sp))
        if k == 0 and len(sp) >= 3: k = 1
        if k == 0 and len(sp) < 3 and rng.random() < 0.2: k = 1
        test_species.update(sp[:k])
    for r in out:
        r['split'] = 'test' if r['species'] in test_species else 'train'
    # Logs are recomputed by train.py; the stored table keeps the measured columns only (smaller than the raw file).
    keys = ['SpecimenID', 'species', 'family', 'order', 'SL_mm', 'weight_g', 'depth_mm', 'width_mm', 'head_depth_mm',
            'ped_depth_mm', 'ped_width_mm', 'split']
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=keys); w.writeheader()
        for r in out:
            w.writerow({k: (f'{r[k]:.6g}' if isinstance(r[k], float) else r[k]) for k in keys})
    lic = None
    if record:
        rec = json.load(open(record, encoding='utf-8'))
        lic = (rec.get('metadata', {}).get('license') or {}).get('id')
    fam_n = lambda f: sum(1 for r in out if r['family'] == f)
    man = {
        'dataset': 'FishShapes v1: functionally relevant measurements of teleost shape and size on three dimensions',
        'cite': 'Price SA, Friedman ST, Corn KA, et al. (2022) Ecology 103:e3829, doi 10.1002/ecy.3829',
        'zenodo_record': 'https://zenodo.org/records/6642650', 'dryad_doi': '10.5061/dryad.vt4b8gtvf',
        'raw_file': {'url': RAW_URL, 'name': 'FishShapes_specimensv1.csv', 'sha256': sha256(raw), 'bytes': os.path.getsize(raw),
                     'rows': len(rows), 'stored_in_repo': False, 'fetched': '2026-10-31'},
        'licence': {'id': lic or 'unknown', 'checked_in': 'Zenodo record metadata.license, fetched 2026-10-31 (cc-zero = CC0-1.0)'},
        'derived_file': {'path': 'sim-engine/generative/body/data/fishshapes-derived.csv', 'rows': len(out), 'sha256': sha256(OUT_CSV)},
        'excluded': excluded,
        'features': FEATURES,
        'feature_definitions': {
            'log_SL_mm': 'ln standard length (mm)', 'log_depth_over_SL': 'ln(Max_body_depth / SL) = ln body_depth_over_SL',
            'log_width_over_SL': 'ln(Max_fish_width / SL) = ln body_width_over_SL',
            'log_peduncle_depth_frac': 'ln(Min_caudalpeduncle_depth / Max_body_depth) = ln peduncle_depth_frac',
            'log_peduncle_width_frac': 'ln(Min_caudalpeduncle_width / Max_fish_width) = ln peduncle_width_frac',
            'log_fulton_K': 'ln(1e5 * Total_weight_g / SL_mm^3); body_mass_kg = K * SL_mm^3 / 1e8',
            'log_head_depth_over_depth': 'ln(Head_depth / Max_body_depth); auxiliary: the parametric model has no head-depth parameter'},
        'taxa': {'specimens': len(out), 'species': len({r['species'] for r in out}), 'families': len(by_fam),
                 'orders': orders, 'non_fish_taxa': 'none: every Order is an actinopterygian order (checked against bird/tetrapod markers)',
                 'Exocoetidae': fam_n('Exocoetidae'), 'Cyprinidae': fam_n('Cyprinidae'),
                 'Danio_rerio': sum(1 for r in out if r['species'] == 'Danio_rerio')},
        'split': {'rule': 'species-level, stratified by family, 20 % of species to test, seed 20261031',
                  'train_specimens': sum(r['split'] == 'train' for r in out), 'test_specimens': sum(r['split'] == 'test' for r in out),
                  'test_species': len(test_species),
                  'Exocoetidae_test_specimens': sum(1 for r in out if r['family'] == 'Exocoetidae' and r['split'] == 'test'),
                  'Exocoetidae_test_species': sorted({r['species'] for r in out if r['family'] == 'Exocoetidae' and r['split'] == 'test'})},
        'not_in_this_dataset': ['any fin measurement (pectoral, pelvic, dorsal, anal, caudal)', 'head length (head_fraction_SL)',
                                'body cross-section exponent', 'organs', 'ontogeny: museum specimens, mostly ~3 adults or sub-adults per species'],
    }
    json.dump(man, open(OUT_MAN, 'w', encoding='utf-8'), indent=1)
    print(json.dumps({k: man[k] for k in ('excluded', 'taxa', 'split')}, indent=1))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
