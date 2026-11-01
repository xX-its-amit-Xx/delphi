"""DELPHI organism-design scorer benchmark, v1 builder.

Built INDEPENDENTLY of the scorer: this script never reads sim-engine/validate/score.mjs, score-weights.json,
scorer-results*.json or sim-engine/validate/data/fishshapes-features.json. Raw data are fetched from the
original sources into C:/Temp/benchmark-cache and checked by sha256.

Usage (from any directory that is not a download directory):
    node build/lean_negatives.mjs C:/Temp/benchmark-cache/lean-negatives.json
    python build/build.py
Deterministic: fixed seed, sorted inputs.
"""
import csv, hashlib, json, math, os, random, sys
from collections import defaultdict, Counter

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(BENCH, '..', '..', '..'))
CACHE = 'C:/Temp/benchmark-cache'
SEED = 20261101
SALT = 'delphi-benchmark-v1'
HELDOUT_FRACTION = 0.30

FS_CSV = os.path.join(CACHE, 'fishshapes', 'FishShapes_specimensv1.csv')
FS_SHA = '7447fdc92c5fd5c9ecf1d9713bbd4207d2de7ab4b2ea0e320871041da8e34264'
FB_DIR = os.path.join(CACHE, 'fishbase')
LEAN_NEG = os.path.join(CACHE, 'lean-negatives.json')

# No bird data anywhere (Aves is DELPHI's frozen holdout). These sources are fish-only, but filter explicitly.
AVES_ORDERS = {'Passeriformes', 'Accipitriformes', 'Anseriformes', 'Galliformes', 'Columbiformes', 'Psittaciformes',
               'Strigiformes', 'Falconiformes', 'Charadriiformes', 'Gruiformes', 'Pelecaniformes', 'Procellariiformes',
               'Sphenisciformes', 'Struthioniformes', 'Apodiformes', 'Coraciiformes', 'Piciformes', 'Cuculiformes',
               'Caprimulgiformes', 'Ciconiiformes', 'Suliformes', 'Gaviiformes', 'Podicipediformes', 'Phoenicopteriformes',
               'Trogoniformes', 'Bucerotiformes', 'Casuariiformes', 'Rheiformes', 'Tinamiformes', 'Apterygiformes'}
AVES_WORDS = ('aves', 'bird', 'avian')
dropped_aves = Counter()


def is_bird(order, cls=None):
    if order in AVES_ORDERS:
        return True
    if cls and str(cls).strip().lower() == 'aves':
        return True
    return False


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def fnum(x):
    try:
        v = float(x)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def r6(x):
    return None if x is None else float('%.6g' % x)


def heldout_family(fam):
    return hashlib.sha256((SALT + '|' + fam).encode()).hexdigest()


# --------------------------------------------------------------------------------------------- FishShapes
FS_CITE = ('Price SA, Friedman ST, Corn KA, et al. (2022) FishShapes v1: functionally relevant measurements of teleost '
           'shape and size on three dimensions. Ecology 103:e3829, doi:10.1002/ecy.3829; data Zenodo 6642650 '
           '(= Dryad doi:10.5061/dryad.vt4b8gtvf), file FishShapes_specimensv1.csv')
FS_URL = 'https://zenodo.org/api/records/6642650/files/FishShapes_specimensv1.csv/content'
FS_TRAITS = ['standard_length_m', 'body_mass_kg', 'body_depth_over_SL', 'body_width_over_SL', 'peduncle_depth_frac',
             'peduncle_width_frac', 'head_depth_over_body_depth', 'lower_jaw_over_SL', 'mouth_width_over_SL']


def load_fishshapes():
    assert sha256(FS_CSV) == FS_SHA, 'FishShapes CSV sha256 mismatch'
    rows = list(csv.DictReader(open(FS_CSV, newline='', encoding='utf-8')))
    items, drops = [], Counter()
    for i, r in enumerate(rows):
        order, fam = r['Order'], r['Family']
        if is_bird(order):
            dropped_aves['fishshapes'] += 1
            continue
        SL = fnum(r['Standard_length'])
        if not SL or SL <= 0:
            drops['no_standard_length'] += 1
            continue
        W = fnum(r['Total_weight']); D = fnum(r['Max_body_depth']); Wd = fnum(r['Max_fish_width'])
        HD = fnum(r['Head_depth']); LJ = fnum(r['Lower_jaw_length']); MW = fnum(r['Mouth_width'])
        PD = fnum(r['Min_caudalpeduncle_depth']); PW = fnum(r['Min_caudalpeduncle_width'])
        pos = lambda v: v if (v is not None and v > 0) else None
        W, D, Wd, HD, LJ, MW, PD, PW = map(pos, (W, D, Wd, HD, LJ, MW, PD, PW))
        p = {
            'standard_length_m': SL / 1000.0,
            'body_mass_kg': W / 1000.0 if W else None,
            'body_depth_over_SL': D / SL if D else None,
            'body_width_over_SL': Wd / SL if Wd else None,
            'peduncle_depth_frac': PD / D if (PD and D) else None,
            'peduncle_width_frac': PW / Wd if (PW and Wd) else None,
            'head_depth_over_body_depth': HD / D if (HD and D) else None,
            'lower_jaw_over_SL': LJ / SL if LJ else None,
            'mouth_width_over_SL': MW / SL if MW else None,
        }
        # transcription-error screen (recorded, not tuned): a ratio > 2 or a part deeper than 1.5x the body,
        # or Fulton K = 100 W(g) / SL(cm)^3 outside [0.02, 30]
        bad = [k for k in ('body_depth_over_SL', 'body_width_over_SL', 'lower_jaw_over_SL', 'mouth_width_over_SL') if p[k] and p[k] > 2]
        bad += [k for k in ('peduncle_depth_frac', 'peduncle_width_frac', 'head_depth_over_body_depth') if p[k] and p[k] > 1.5]
        if W:
            K = 100 * W / (SL / 10) ** 3
            if not (0.02 <= K <= 30):
                bad.append('fulton_K')
        if bad:
            drops['implausible:' + bad[0]] += 1
            continue
        tree = r['Tree_name']
        genus, _, ep = tree.partition('_')
        p = {k: r6(v) for k, v in p.items() if v is not None}
        items.append({
            'id': 'fs-%05d' % i,
            'label': 'positive', 'subset': 'fishshapes_specimen',
            'taxon': {'species': tree.replace('_', ' '), 'genus': genus, 'family': fam, 'order': order},
            'source': {'dataset': 'FishShapes v1', 'cite': FS_CITE, 'licence': 'CC0-1.0', 'url': FS_URL,
                       'record': {'row': i + 2, 'SpecimenID_lot': r['SpecimenID']}, 'kind': 'measured'},
            'params': p, 'features_present': sorted(p),
            'specimen_key': 'fishshapes-lot:' + r['SpecimenID'],
        })
    return items, drops, len(rows)


# --------------------------------------------------------------------------------------------- FishBase
FB_CITE = ('Froese R, Pauly D (eds) FishBase, version 24.07 (www.fishbase.org), MORPHMET table (morphometrics measured '
           'on FishBase pictures), via the rfishbase parquet mirror huggingface.co/datasets/cboettig/fishbase '
           'data/fb/v24.07/parquet/{morphmet,species,genera,families}.parquet')
FB_LICENCE = 'CC BY-NC 4.0 (FishBase); non-commercial research use, attribution required'
FB_TRAITS = ['body_depth_over_SL', 'head_length_over_SL', 'caudal_fin_height_over_SL', 'caudal_fin_aspect_ratio',
             'predorsal_over_SL', 'preanal_over_SL', 'prepelvic_over_SL', 'prepectoral_over_SL', 'eye_diameter_over_SL',
             'preorbital_over_SL']


def load_fishbase(genus_to_fs_family):
    m = pd.read_parquet(os.path.join(FB_DIR, 'morphmet.parquet'))
    s = pd.read_parquet(os.path.join(FB_DIR, 'species.parquet'), columns=['SpecCode', 'Genus', 'Species', 'FamCode'])
    f = pd.read_parquet(os.path.join(FB_DIR, 'families.parquet'), columns=['FamCode', 'Family', 'Order', 'Class'])
    s = s.merge(f, on='FamCode', how='left')
    m = m.merge(s, left_on='Speccode', right_on='SpecCode', how='left').sort_values(['PicName', 'autoctr'])
    items, drops = [], Counter()
    for _, r in m.iterrows():
        if pd.isna(r.get('Genus')):
            drops['no_species_match'] += 1
            continue
        if is_bird(r['Order'], r['Class']):
            dropped_aves['fishbase'] += 1
            continue
        SL = fnum(r['SL'])
        if not SL or SL <= 0:
            drops['no_SL'] += 1
            continue
        g = lambda c: (fnum(r[c]) / SL) if (fnum(r[c]) is not None and fnum(r[c]) > 0) else None
        p = {'body_depth_over_SL': g('BD'), 'head_length_over_SL': g('HL'), 'caudal_fin_height_over_SL': g('CH'),
             'caudal_fin_aspect_ratio': fnum(r['AspectRatio']) if fnum(r['AspectRatio']) and fnum(r['AspectRatio']) > 0 else None,
             'predorsal_over_SL': g('PDL'), 'preanal_over_SL': g('PAL'), 'prepelvic_over_SL': g('PPL'),
             'prepectoral_over_SL': g('PPEL'), 'eye_diameter_over_SL': g('ED'), 'preorbital_over_SL': g('POL')}
        bad = [k for k, v in p.items() if v is not None and k != 'caudal_fin_aspect_ratio' and v > 2]
        if p['caudal_fin_aspect_ratio'] and p['caudal_fin_aspect_ratio'] > 20:
            bad.append('caudal_fin_aspect_ratio')
        if bad:
            drops['implausible:' + bad[0]] += 1
            continue
        p = {k: r6(v) for k, v in p.items() if v is not None}
        if not p:
            drops['no_traits'] += 1
            continue
        genus = str(r['Genus'])
        fam_fb = str(r['Family'])
        fam = genus_to_fs_family.get(genus, fam_fb)
        items.append({
            'id': 'fb-' + os.path.splitext(str(r['PicName']))[0].lower() + '-%d' % int(r['autoctr']),
            'label': 'positive', 'subset': 'fishbase_picture',
            'taxon': {'species': '%s %s' % (genus, r['Species']), 'genus': genus, 'family': fam, 'family_fishbase': fam_fb,
                      'order': str(r['Order']), 'class': str(r['Class'])},
            'source': {'dataset': 'FishBase MORPHMET v24.07', 'cite': FB_CITE, 'licence': FB_LICENCE,
                       'url': 'https://www.fishbase.se/physiology/MorphMetList.php?ID=%d' % int(r['Speccode']),
                       'record': {'autoctr': int(r['autoctr']), 'PicName': str(r['PicName']), 'SpecCode': int(r['Speccode'])},
                       'kind': 'measured (on a picture; ratios only, picture units)'},
            'params': p, 'features_present': sorted(p),
            'specimen_key': 'fishbase-pic:' + str(r['PicName']),
        })
    return items, drops, len(m)


# --------------------------------------------------------------------------------------------- small curated sets
PC_CITE = 'Park H, Choi H (2010) J Exp Biol 213:3269-3279, doi:10.1242/jeb.046052, Table 1 (via physics/glide-data.csv)'
MK_CITE = 'Makiguchi Y et al. (2013) via physics/glide-data.csv (Table 1, captive specimens, fork length + mass)'
FF_TAX = {'species': 'Cypselurus hiraii', 'genus': 'Cypselurus', 'family': 'Exocoetidae', 'order': 'Beloniformes'}
CH_TAX = {'species': 'Cheilopogon heterurus', 'genus': 'Cheilopogon', 'family': 'Exocoetidae', 'order': 'Beloniformes'}
ZF_TAX = {'species': 'Danio rerio', 'genus': 'Danio', 'family': 'Cyprinidae', 'family_alt': 'Danionidae', 'order': 'Cypriniformes'}


def curated_specimens():
    out = []
    rows = list(csv.DictReader(open(os.path.join(REPO, 'physics', 'glide-data.csv'), newline='', encoding='utf-8')))
    for r in rows:
        if r['row_kind'] != 'specimen' or r['value_kind'].split(' ')[0] != 'measured':
            continue
        loc = r['source_locator']
        if r['source_id'] == 'park-choi-2010' and any(t in loc for t in ('model L1', 'model L2', 'model L3')):
            SL = float(r['body_length_m']); m = float(r['body_mass_kg'])
            A1 = float(r['pectoral_fin_area_m2']); A2 = float(r['pelvic_fin_area_m2']); S = float(r['pectoral_fin_span_m'])
            A3 = float(r['body_planform_area_m2'])
            mid = loc.split('model ')[1].split(';')[0].strip()
            p = {'standard_length_m': SL, 'body_mass_kg': m, 'pectoral_span_over_SL': r6(S / SL),
                 'pectoral_area_over_SL2': r6(A1 / SL ** 2), 'pelvic_area_over_SL2': r6(A2 / SL ** 2),
                 'body_planform_area_over_SL2': r6(A3 / SL ** 2)}
            out.append({'id': 'pc-' + mid, 'label': 'positive', 'subset': 'specimen_with_fins', 'taxon': dict(FF_TAX),
                        'source': {'dataset': 'physics/glide-data.csv', 'cite': PC_CITE, 'licence': 'facts from a published paper',
                                   'record': {'locator': loc}, 'kind': 'measured (stuffed specimen)'},
                        'params': p, 'features_present': sorted(p), 'specimen_key': 'parkchoi:' + mid,
                        'lean_spec': {'taxon': 'Cypselurus hiraii', 'life_stage': 'adult', 'SL_m': SL, 'mass_kg': m, 'finArea_m2': A1 + A2 + A3}})
        if r['source_id'] == 'makiguchi-2013' and 'fish ' in loc:
            fid = loc.split('fish ')[1].strip()
            p = {'fork_length_m': float(r['body_length_m']), 'body_mass_kg': float(r['body_mass_kg'])}
            out.append({'id': 'mk-' + fid, 'label': 'positive', 'subset': 'specimen_mass_length',
                        'taxon': dict(CH_TAX, species='Cheilopogon heterurus doederleini'),
                        'source': {'dataset': 'physics/glide-data.csv', 'cite': MK_CITE, 'licence': 'facts from a published paper',
                                   'record': {'locator': loc}, 'kind': 'measured'},
                        'params': p, 'features_present': sorted(p), 'specimen_key': 'makiguchi:' + fid})
    return out


def ontogeny_items():
    o = json.load(open(os.path.join(REPO, 'sim-engine', 'params', 'ontogeny.json'), encoding='utf-8'))
    out = []
    for sp, tax in (('zebrafish', ZF_TAX), ('flying_fish', {'species': 'Exocoetidae (H. affinis / C. hiraii composite)', 'genus': 'Hirundichthys', 'family': 'Exocoetidae', 'order': 'Beloniformes'})):
        for st in o['species'][sp]['stages']:
            F = st['fields']
            val = lambda k: (F.get(k) or {}).get('value') if isinstance((F.get(k) or {}).get('value'), (int, float)) else None
            kind = lambda k: (F.get(k) or {}).get('kind')
            SL = val('SL_m')
            p, kinds = {}, {}
            def put(name, v, k):
                if v is not None:
                    p[name] = r6(v); kinds[name] = k
            put('standard_length_m', SL, kind('SL_m'))
            put('body_mass_kg', val('mass_kg'), kind('mass_kg'))
            if SL:
                if val('pectoral_area_both_m2'): put('pectoral_area_over_SL2', val('pectoral_area_both_m2') / SL ** 2, kind('pectoral_area_both_m2'))
                if val('pectoral_span_m'): put('pectoral_span_over_SL', val('pectoral_span_m') / SL, kind('pectoral_span_m'))
                if val('caudal_area_m2'): put('caudal_area_over_SL2', val('caudal_area_m2') / SL ** 2, kind('caudal_area_m2'))
                if val('frontal_area_m2'): put('frontal_area_over_SL2', val('frontal_area_m2') / SL ** 2, kind('frontal_area_m2'))
            put('pelvic_len_over_SL', val('pelvic_len_over_SL'), kind('pelvic_len_over_SL'))
            out.append({'id': 'ont-%s-%s' % (sp, st['key']), 'label': 'positive', 'subset': 'ontogeny_stage',
                        'taxon': dict(tax), 'life_stage': st.get('label'), 'age_days': st.get('age_days'),
                        'source': {'dataset': 'sim-engine/params/ontogeny.json', 'cite': 'DELPHI ontogeny table (each value cites its own source there)',
                                   'licence': 'repo', 'record': {'species': sp, 'stage': st['key']}, 'kind': 'mixed; see param_kinds'},
                        'params': p, 'param_kinds': kinds, 'features_present': sorted(p),
                        'specimen_key': 'ontogeny:%s:%s' % (sp, st['key']),
                        'caution': 'model-derived stage values; many are derived or assumed (param_kinds). Reported as a separate positive subset, never pooled with measured specimens.'})
    return out


def mutant_items(fs_items):
    """Real zebrafish mutants / treatments with measured fin phenotypes (genotype/interventions.json), as relative effects
    on a wild-type baseline. Absolute fin baselines are the repo's ASSUMED zebrafish values, so the test is relative:
    score(mutant) vs score(paired wild-type baseline item)."""
    iv = {x['id']: x for x in json.load(open(os.path.join(REPO, 'genotype', 'interventions.json'), encoding='utf-8'))['interventions']}
    zf = [x for x in fs_items if x['taxon']['species'] == 'Danio rerio']
    body = {}
    for k in ('body_depth_over_SL', 'body_width_over_SL', 'peduncle_depth_frac', 'peduncle_width_frac', 'head_depth_over_body_depth'):
        v = [x['params'][k] for x in zf if k in x['params']]
        if v:
            body[k] = r6(float(np.median(v)))
    base_adult = dict(body, standard_length_m=0.0388, body_mass_kg=0.0006943, pectoral_len_over_SL=0.155,
                      pectoral_area_over_SL2=0.016, caudal_upper_lobe_over_SL=0.215, caudal_lower_lobe_over_SL=0.215,
                      dorsal_height_over_SL=0.16, anal_height_over_SL=0.14)
    base_larva = {'standard_length_m': 0.0042, 'body_mass_kg': 5.385e-7, 'pectoral_area_over_SL2': r6(7.454e-8 / 0.0042 ** 2),
                  'pectoral_span_over_SL': r6(0.0008535 / 0.0042), 'pectoral_len_over_SL': 0.10}
    bkinds = {'adult': 'body ratios: median of FishShapes Danio rerio specimens (measured); SL/mass: ontogeny.json stage_180d (derived); fin values: anatomy-model/parametric/organisms/zebrafish-adult.json (ASSUMED placeholders)',
              'larva': 'ontogeny.json zebrafish stage_003d (SL/mass derived; pectoral area/span assumed); pectoral_len_over_SL 0.10 assumed'}
    out = []
    for stage, b in (('adult', base_adult), ('larva', base_larva)):
        out.append({'id': 'mut-baseline-wt-' + stage, 'label': 'positive', 'subset': 'mutant_baseline', 'taxon': dict(ZF_TAX),
                    'life_stage': stage, 'source': {'dataset': 'benchmark baseline', 'cite': bkinds[stage], 'licence': 'repo', 'kind': 'mixed'},
                    'params': b, 'features_present': sorted(b), 'specimen_key': 'zf-wt-baseline:' + stage})
    spec = [  # (intervention id, stage, {param: factor}, note)
        ('hhip-uki-loss-fin-area', 'larva', {'pectoral_area_over_SL2': 1.65}, 'pectoral fin area +65% of wild type'),
        ('hhip-uki-loss-fin-dorsoventral', 'larva', {'pectoral_span_over_SL': 1.50}, 'fin dorsoventral extent +50%; mapped onto pectoral span (closest parameter)'),
        ('prdm1a-hypomorph-tp39', 'larva', {'pectoral_len_over_SL': 0.70}, 'pectoral fin length -30% of wild type'),
        ('prdm1a-null-m805-finfold', 'larva', {'pectoral_area_over_SL2': 0.894}, 'fin fold size -10.6%; mapped onto pectoral area'),
        ('gja1b-sof-b123', 'adult', {'pectoral_len_over_SL': 0.5, 'caudal_upper_lobe_over_SL': 0.5, 'caudal_lower_lobe_over_SL': 0.5, 'dorsal_height_over_SL': 0.5, 'anal_height_over_SL': 0.5}, 'short fin: ray segment and whole-fin length 50% of wild type (as recorded)'),
        ('gja1b-stp-tl28d', 'adult', {'pectoral_len_over_SL': 0.95, 'caudal_upper_lobe_over_SL': 0.95, 'caudal_lower_lobe_over_SL': 0.95, 'dorsal_height_over_SL': 0.95, 'anal_height_over_SL': 0.95}, 'ray segment / fin ray length 95% of wild type'),
        ('cx43-morpholino-in-alf-dty86', 'adult', {'caudal_upper_lobe_over_SL': None, 'caudal_lower_lobe_over_SL': None}, 'alf^dty86 caudal ray segment length 609.5 vs 290.7 um wild type (2.10x); whole-fin length factor not given, so fin params are flagged increase-without-number'),
        ('pharm-FK506-calcineurin-inhibition', 'adult', {'pectoral_len_over_SL': 1.50}, 'pharmacological: regenerating pectoral fin length +50%'),
        ('hdac1-valproic-acid-pharmacological', 'larva', {'pectoral_len_over_SL': 0.84}, 'pharmacological: pectoral fin length 84% of wild type'),
        ('kcnh2a-lof-x-lat4a-nr21-double-het', 'adult', {'pectoral_len_over_SL': None}, "Daane et al. 2021 winged zebrafish: paired fins overgrown, medial fins wild-type size; numbers only in figure panels (not digitised)"),
        ('kcnh2a-longfin-t2-inversion', 'adult', {'pectoral_len_over_SL': None, 'caudal_upper_lobe_over_SL': None, 'caudal_lower_lobe_over_SL': None, 'dorsal_height_over_SL': None, 'anal_height_over_SL': None}, 'longfin (lof^dt2): all fins long; numbers only in figures'),
        ('kcnk5b-alf-dt30mh-het', 'adult', {'pectoral_len_over_SL': None, 'caudal_upper_lobe_over_SL': None, 'caudal_lower_lobe_over_SL': None, 'dorsal_height_over_SL': None, 'anal_height_over_SL': None}, 'another longfin (alf) heterozygote: fins and barbels increased size; no number'),
    ]
    for iid, stage, eff, note in spec:
        x = iv.get(iid)
        if not x:
            continue
        b = base_adult if stage == 'adult' else base_larva
        p = dict(b)
        rel = {}
        for k, fct in eff.items():
            rel[k] = {'factor': fct, 'direction': (x.get('direction') if fct is None else ('increase' if fct > 1 else 'decrease'))}
            if fct is not None and k in p:
                p[k] = r6(p[k] * fct)
        quant = all(v is not None for v in eff.values())
        srcs = x.get('sources') or []
        out.append({'id': 'mut-' + iid, 'label': 'positive', 'subset': 'mutant_quantified' if quant else 'mutant_qualitative',
                    'taxon': dict(ZF_TAX), 'life_stage': stage, 'gene': x.get('gene'), 'lesion': x.get('lesion'),
                    'paired_baseline': 'mut-baseline-wt-' + stage, 'relative_effects': rel, 'note': note,
                    'source': {'dataset': 'genotype/interventions.json', 'cite': '; '.join('%s %s %s' % (s.get('first_author', ''), s.get('year', ''), s.get('doi') or s.get('pmid') or '') for s in srcs if isinstance(s, dict)),
                               'licence': 'facts from published papers', 'record': {'intervention_id': iid, 'effect_size': x.get('effect_size')}, 'kind': 'measured relative effect on an assumed absolute baseline'},
                    'params': p if quant else dict(b), 'features_present': sorted(p),
                    'specimen_key': 'zf-mutant:' + iid,
                    'caution': 'relative test: compare with paired_baseline. Absolute fin values inherit the ASSUMED wild-type fin baseline.' + ('' if quant else ' No number: params are the baseline; only the direction in relative_effects is known.')})
    return out


def own_model_items():
    out = []
    d = os.path.join(REPO, 'anatomy-model', 'parametric', 'resolved')
    for fn in sorted(os.listdir(d)):
        j = json.load(open(os.path.join(d, fn), encoding='utf-8'))
        p = {k: v for k, v in (j.get('parameters') or {}).items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
        out.append({'id': 'own-' + fn[:-5], 'label': 'unlabelled', 'subset': 'own_parametric_model',
                    'taxon': {'species': j.get('name'), 'genus': None, 'family': None, 'order': None},
                    'source': {'dataset': 'anatomy-model/parametric/resolved/' + fn, 'licence': 'repo', 'kind': j.get('kind')},
                    'params': p, 'features_present': sorted(p), 'specimen_key': 'own:' + fn[:-5],
                    'doc': {'id': fn[:-5].replace('_', '-'), 'base': {'parents': [{'organism': fn[:-5], 'weight': 1}]}, 'edits': []},
                    'caution': 'Our own models and designs: SCORED and reported, never counted as positives or negatives (hub: base peduncle width and mass fall outside measured specimens of their families).'})
    return out


def containment_items():
    """Organ-containment failures: an internal organ asked to occupy more than the whole body volume (partedit refuses any
    internal-part edit that leaves the body cavity, and any volume edit larger than the cavity). Swim bladder = 5.1% of body
    volume in adult zebrafish (Robertson et al. 2008 J Morphol 269:666, doi:10.1002/jmor.10610, abstract; via ontogeny.json)."""
    out = []
    SB = 0.051
    for f in (25, 40, 80):
        frac = SB * f
        p = {'standard_length_m': 0.0388, 'body_mass_kg': 0.0006943, 'swimbladder_volume_over_body_volume': r6(frac)}
        out.append({'id': 'oc-zf-swimbladder-x%d' % f, 'label': 'negative', 'neg_type': 'organ_containment', 'taxon': dict(ZF_TAX),
                    'description': 'adult zebrafish whose swim bladder is scaled %dx in volume: %.0f%% of the whole body volume (> 100%% cannot fit)' % (f, frac * 100),
                    'doc': {'id': 'zf-swimbladder-x%d' % f, 'base': {'parents': [{'organism': 'zebrafish-adult', 'weight': 1}]},
                            'edits': [{'target': {'level': 'organ', 'id': 'swim_bladder'}, 'param': 'volume', 'op': 'scale', 'value': f,
                                       'author': 'benchmark:containment', 'reason': 'containment negative'}]},
                    'verification': 'arithmetic: requested organ volume %.2f x body volume > 1; partedit refuses volume edits beyond the cavity (dashboard/public/blueprint3d/partedit.js header). Part id not validated against the mesh manifest in v1.' % frac,
                    'params': p, 'features_present': sorted(p), 'donors': [], 'source': 'synthetic'})
    for organ, frac, why in (('liver', 1.3, 'liver volume 1.3 x body volume'), ('heart', 1.1, 'heart volume 1.1 x body volume'),
                             ('brain', 0.9, 'brain volume 0.9 x body volume, larger than the whole head (head depth ~ body depth, head length ~ 0.23 SL)')):
        p = {'standard_length_m': 0.0388, 'body_mass_kg': 0.0006943, organ + '_volume_over_body_volume': frac}
        out.append({'id': 'oc-zf-%s' % organ, 'label': 'negative', 'neg_type': 'organ_containment', 'taxon': dict(ZF_TAX),
                    'description': 'adult zebrafish with ' + why,
                    'doc': {'id': 'zf-%s-overfill' % organ, 'base': {'parents': [{'organism': 'zebrafish-adult', 'weight': 1}]},
                            'edits': [{'target': {'level': 'organ', 'id': organ}, 'param': 'volume', 'op': 'set', 'value': None, 'value_rule': '%s x body volume' % frac,
                                       'author': 'benchmark:containment', 'reason': 'containment negative'}]},
                    'verification': 'arithmetic: an internal organ cannot exceed the body (or head) cavity volume',
                    'params': p, 'features_present': sorted(p), 'donors': [], 'source': 'synthetic'})
    for f in (8, 15):
        p = {'standard_length_m': 0.203, 'body_mass_kg': 0.06, 'body_depth_over_SL': 0.17, 'pectoral_muscle_volume_over_body_volume': r6(0.05 * f)}
        out.append({'id': 'oc-ff-girdle-muscle-x%d' % f, 'label': 'negative', 'neg_type': 'organ_containment', 'taxon': dict(FF_TAX),
                    'description': 'flying fish with pectoral girdle muscle %dx (muscle volume %.0f%% of the body)' % (f, 5 * f),
                    'verification': 'arithmetic: muscle volume fraction > 0.4 of body for a single girdle muscle pair cannot fit with the other organs; > 1 cannot fit at all' ,
                    'params': p, 'features_present': sorted(p), 'donors': [], 'source': 'synthetic (red muscle fraction 0.05 borrowed in ontogeny.json)'})
    return out


# --------------------------------------------------------------------------------------------- negatives from positives
def decoys(pool, traits, rng, prefix, n_per_species_cap=None, max_bases=None):
    """Trait-shuffled decoys. Donors come from OTHER families in the same partition pool."""
    by_species = defaultdict(list)
    for it in pool:
        by_species[it['taxon']['species']].append(it)
    bases = [sorted(v, key=lambda x: x['id'])[0] for k, v in sorted(by_species.items())]
    rng.shuffle(bases)
    if max_bases:
        bases = bases[:max_bases]
    # donor lists per trait
    donors = {t: [it for it in pool if t in it['params']] for t in traits}
    out = []
    size_block = {'standard_length_m', 'body_mass_kg'}
    for b in bases:
        fam = b['taxon']['family']
        present = [t for t in traits if t in b['params']]
        if len(present) < 2:
            continue

        def draw(t, used):
            for _ in range(50):
                d = donors[t][rng.randrange(len(donors[t]))]
                if d['taxon']['family'] != fam and d['id'] not in used:
                    return d
            return None
        variants = [('decoy_shuffle_all', present)]
        shape = [t for t in present if t not in size_block]
        if len(shape) >= 2 and len(shape) < len(present):
            variants.append(('decoy_shuffle_shape', shape))
        variants.append(('decoy_shuffle_one', [present[rng.randrange(len(present))]]))
        for vtype, ts in variants:
            p = dict(b['params']); used = {b['id']}; dn = [b]; prov = {}
            ok = True
            if vtype == 'decoy_shuffle_all':
                # size block moves together from one donor (mass and length stay mutually consistent) - correlation
                # between size and shape is still broken; every other trait from its own donor
                blk = [t for t in ts if t in size_block]
                if blk:
                    d = draw(blk[0], used)
                    if d is None or not all(t in d['params'] for t in blk):
                        d = None
                    if d is None:
                        ok = False
                    else:
                        for t in blk: p[t] = d['params'][t]; prov[t] = d['id']
                        used.add(d['id']); dn.append(d)
                ts = [t for t in ts if t not in size_block]
            for t in ts:
                d = draw(t, used)
                if d is None:
                    ok = False; break
                p[t] = d['params'][t]; prov[t] = d['id']; used.add(d['id']); dn.append(d)
            if not ok:
                continue
            out.append({'id': '%s-%s-%s' % (prefix, vtype.replace('decoy_shuffle_', 'sh'), b['id']), 'label': 'negative', 'neg_type': vtype,
                        'difficulty': {'decoy_shuffle_all': 'standard', 'decoy_shuffle_shape': 'standard', 'decoy_shuffle_one': 'hard'}[vtype],
                        'taxon': {'species': None, 'genus': None, 'family': None, 'order': None, 'base_taxon': b['taxon']},
                        'description': 'real specimen %s (%s) with %s replaced by values from specimens of other families' % (b['id'], b['taxon']['species'], ', '.join(sorted(prov))),
                        'params': p, 'features_present': sorted(p), 'trait_donor': prov, 'donors': [d['id'] for d in dn],
                        '_donor_items': dn, 'source': 'synthetic from %s' % b['source']['dataset']})
    return out


def extrapolations(pool, traits, ranges, rng, prefix, n_bases=6):
    out = []
    bases = sorted(pool, key=lambda x: x['id'])
    rng.shuffle(bases)
    for t in traits:
        lo, hi = ranges[t]
        cands = [b for b in bases if t in b['params']][:n_bases]
        for b in cands:
            for f in (2, 3, 5):
                for direction in ('above', 'below'):
                    if t in ('peduncle_depth_frac', 'peduncle_width_frac', 'head_depth_over_body_depth') and direction == 'above':
                        v = hi * f
                    v = hi * f if direction == 'above' else lo / f
                    p = dict(b['params']); p[t] = r6(v)
                    out.append({'id': '%s-%s-%s%d-%s' % (prefix, t, 'hi' if direction == 'above' else 'lo', f, b['id']), 'label': 'negative',
                                'neg_type': 'out_of_range_extrapolation', 'difficulty': 'easy',
                                'taxon': {'species': None, 'genus': None, 'family': None, 'order': None, 'base_taxon': b['taxon']},
                                'description': '%s set to %s x the %s observed across all screened fish in the source (%s=%.4g; observed [%.4g, %.4g])' % (t, f, 'maximum' if direction == 'above' else '1/minimum', t, v, lo, hi),
                                'params': p, 'features_present': sorted(p), 'extrapolation': {'trait': t, 'factor': f, 'direction': direction, 'observed_min': r6(lo), 'observed_max': r6(hi)},
                                'donors': [b['id']], '_donor_items': [b], 'source': 'synthetic from %s' % b['source']['dataset']})
    return out


def corner_chimeras(pool, traits, rng, prefix, n=150):
    """Every trait at an extreme percentile (p0.5 or p99.5) of the pooled real distribution: marginally real, jointly
    a chimera of extremes. Hard negative (not provably impossible)."""
    out = []
    q = {t: (np.percentile([x['params'][t] for x in pool if t in x['params']], 0.5),
             np.percentile([x['params'][t] for x in pool if t in x['params']], 99.5)) for t in traits}
    for i in range(n):
        ts = [t for t in traits if rng.random() < 0.8] or traits[:2]
        if len(ts) < 3:
            ts = traits[:]
        p = {t: r6(q[t][rng.randrange(2)]) for t in ts}
        out.append({'id': '%s-corner-%03d' % (prefix, i), 'label': 'negative', 'neg_type': 'chimera_extreme_corner', 'difficulty': 'hard',
                    'taxon': {'species': None, 'genus': None, 'family': None, 'order': None},
                    'description': 'every listed trait at the 0.5th or 99.5th percentile of all screened specimens in the source',
                    'params': p, 'features_present': sorted(p), 'donors': [], '_donor_items': [], 'source': 'synthetic from pooled percentiles'})
    return out


# --------------------------------------------------------------------------------------------- main
def main():
    rng = random.Random(SEED)
    fs, fs_drops, fs_n = load_fishshapes()
    g2f = {}
    for it in fs:
        g2f.setdefault(it['taxon']['genus'], it['taxon']['family'])
    fb, fb_drops, fb_n = load_fishbase(g2f)
    cur = curated_specimens()
    ont = ontogeny_items()
    mut = mutant_items(fs)
    own = own_model_items()
    cont = containment_items()
    lean = json.load(open(LEAN_NEG, encoding='utf-8'))
    for it in lean['items']:
        it['taxon'] = dict(it['taxon'])
        if it['taxon']['family'] == 'Danionidae':
            it['taxon'].update(family='Cyprinidae', family_alt='Danionidae')
        it['donors'] = ['pc-' + d.split('-')[1] for d in it.get('donors', [])]

    # held-out families: 30% of all families (FishShapes naming), chosen by salted hash - fixed before any score exists
    fams = sorted({it['taxon']['family'] for it in fs + fb + cur + ont + mut if it['taxon'].get('family')})
    order = sorted(fams, key=heldout_family)
    held = set(order[:int(round(HELDOUT_FRACTION * len(order)))])
    positives = fs + fb + cur + ont + mut
    for it in positives:
        it['partition'] = 'heldout' if it['taxon']['family'] in held else 'dev'

    negatives = []
    for src_items, traits, tag in ((fs, FS_TRAITS, 'fs'), (fb, FB_TRAITS, 'fb')):
        ranges = {t: (min(x['params'][t] for x in src_items if t in x['params']), max(x['params'][t] for x in src_items if t in x['params'])) for t in traits}
        for part in ('dev', 'heldout'):
            pool = [x for x in src_items if x['partition'] == part]
            prng = random.Random('%d|%s|%s' % (SEED, tag, part))
            ds = decoys(pool, traits, prng, 'dc' + tag, max_bases=3000)
            ex = extrapolations(pool, traits, ranges, prng, 'ex' + tag, n_bases=3)
            cc = corner_chimeras(pool, traits, prng, 'cc' + tag + part[0], n=100 if part == 'dev' else 50)
            for it in ds + ex + cc:
                it['partition'] = part
            negatives += ds + ex + cc
    # synthetic negatives not derived from the big pools: partition by salted hash of id (30% held out)
    for it in lean['items'] + cont:
        h = int(hashlib.sha256((SALT + '|' + it['id']).encode()).hexdigest(), 16) % 100
        it['partition'] = 'heldout' if h < 30 else 'dev'
        it.setdefault('difficulty', 'easy')
    negatives += lean['items'] + cont
    for it in own:
        it['partition'] = 'dev'

    # exclusion sets for leave-one-{specimen,species,genus,family}-out
    by_id = {it['id']: it for it in positives}
    def excl(items):
        e = {'specimen': set(), 'species': set(), 'genus': set(), 'family': set()}
        for d in items:
            e['specimen'].add(d['specimen_key'])
            for k in ('species', 'genus', 'family'):
                if d['taxon'].get(k):
                    e[k].add(d['taxon'][k])
                if d['taxon'].get('family_alt') and k == 'family':
                    e[k].add(d['taxon']['family_alt'])
                if d['taxon'].get('family_fishbase') and k == 'family':
                    e[k].add(d['taxon']['family_fishbase'])
        return {k: sorted(v) for k, v in e.items()}
    for it in positives:
        it['exclusion'] = excl([it])
    for it in negatives:
        dn = it.pop('_donor_items', None)
        if dn is None:
            dn = [by_id[d] for d in it.get('donors', []) if d in by_id]
        it['exclusion'] = excl(dn)
    for it in own:
        it['exclusion'] = {'specimen': [], 'species': [], 'genus': [], 'family': []}

    allitems = positives + negatives + own
    ids = [x['id'] for x in allitems]
    assert len(ids) == len(set(ids)), 'duplicate ids: %s' % [k for k, v in Counter(ids).items() if v > 1][:5]
    # bird guard over the final payload
    for x in allitems:
        t = x['taxon']
        vals = [str(v).lower() for v in list(t.values()) + list((t.get('base_taxon') or {}).values()) if not isinstance(v, dict)]
        assert not any(v in ('aves', 'bird', 'birds') or v in {o.lower() for o in AVES_ORDERS} for v in vals), 'bird taxon: %s' % x['id']
        assert not is_bird(t.get('order'), t.get('class')), 'bird taxon: %s' % x['id']

    SOURCES = {
        'fishshapes-v1': {'dataset': 'FishShapes v1', 'cite': FS_CITE, 'licence': 'CC0-1.0', 'url': FS_URL, 'kind': 'measured', 'raw_sha256': FS_SHA},
        'fishbase-morphmet-v24.07': {'dataset': 'FishBase MORPHMET v24.07', 'cite': FB_CITE, 'licence': FB_LICENCE,
                                     'url_pattern': 'https://www.fishbase.se/physiology/MorphMetList.php?ID=<SpecCode>',
                                     'kind': 'measured on a FishBase picture; ratios only (picture units)'},
    }

    def compact(it):
        it = dict(it)
        src = it.get('source')
        if isinstance(src, dict) and src.get('dataset') == 'FishShapes v1':
            it['source'] = {'id': 'fishshapes-v1', 'record': src['record']}
        elif isinstance(src, dict) and src.get('dataset') == 'FishBase MORPHMET v24.07':
            it['source'] = {'id': 'fishbase-morphmet-v24.07', 'record': src['record']}
        if isinstance(it.get('source'), str):
            it['source'] = it['source'].replace('FishShapes v1', 'fishshapes-v1').replace('FishBase MORPHMET v24.07', 'fishbase-morphmet-v24.07')
        if str(it.get('neg_type', '')).startswith('decoy_') or it.get('neg_type') in ('out_of_range_extrapolation', 'chimera_extreme_corner'):
            it.pop('description', None)
        return it
    json.dump(SOURCES, open(os.path.join(BENCH, 'sources.json'), 'w', encoding='utf-8'), indent=1)

    def dump(path, items):
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            for it in sorted(items, key=lambda x: x['id']):
                f.write(json.dumps(compact(it), ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n')
    dump(os.path.join(BENCH, 'dev', 'items.jsonl'), [x for x in positives + negatives if x['partition'] == 'dev'])
    dump(os.path.join(BENCH, 'dev', 'own-models.jsonl'), own)
    dump(os.path.join(BENCH, 'heldout', 'items.jsonl'), [x for x in positives + negatives if x['partition'] == 'heldout'])
    json.dump({'heldout_families': sorted(held), 'rule': 'first round(0.30 x N) families sorted by sha256("%s|" + family)' % SALT, 'n_families_total': len(fams)},
              open(os.path.join(BENCH, 'heldout', 'families.json'), 'w', encoding='utf-8'), indent=1)
    json.dump({'controls': lean['controls'], 'dropped_candidates': lean['dropped'], 'absolute_laws_considered': lean['absolute_laws_considered'], 'note': lean['note']},
              open(os.path.join(BENCH, 'build', 'lean-controls.json'), 'w', encoding='utf-8'), indent=1)

    def counts(items):
        c = defaultdict(Counter)
        for it in items:
            c['label'][it['label']] += 1
            c['type'][it.get('neg_type') or it.get('subset')] += 1
            if it['label'] == 'positive':
                c['positive_order'][it['taxon'].get('order') or 'NA'] += 1
                c['positive_source'][it['subset']] += 1
        return {k: dict(sorted(v.items())) for k, v in c.items()}
    stats = {
        'dev': counts([x for x in allitems if x['partition'] == 'dev']),
        'heldout_total': len([x for x in allitems if x['partition'] == 'heldout']),
        'positive_taxa': {'species': len({x['taxon']['species'] for x in positives}), 'genera': len({x['taxon']['genus'] for x in positives}),
                          'families': len({x['taxon']['family'] for x in positives}), 'orders': len({x['taxon'].get('order') for x in positives})},
        'n_families_heldout': len(held),
        'screens': {'fishshapes': {'rows': fs_n, 'kept': len(fs), 'dropped': dict(fs_drops)},
                    'fishbase_morphmet': {'rows': fb_n, 'kept': len(fb), 'dropped': dict(fb_drops)},
                    'aves_dropped': dict(dropped_aves)},
        'raw_inputs': {'fishshapes_csv_sha256': sha256(FS_CSV),
                       'fishbase_parquet_sha256': {n: sha256(os.path.join(FB_DIR, n + '.parquet')) for n in ('morphmet', 'species', 'families')},
                       'lean_negatives_sha256': sha256(LEAN_NEG)},
    }
    json.dump(stats, open(os.path.join(BENCH, 'build', 'stats.json'), 'w', encoding='utf-8'), indent=1, sort_keys=True)
    print(json.dumps(stats, indent=1)[:4000])


if __name__ == '__main__':
    main()
