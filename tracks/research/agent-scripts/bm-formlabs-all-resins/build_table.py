"""Build the per-material table rows (name, fields 'key=value; ...', source URLs) from materials.json, products.json,
solvent.json and ds_index.json.  Run: python -I build_table.py  -> scratch/<label>/table_rows.json
Each row: one material, values per measured state (green / post-cured ...) as printed in the TDS (metric half of the table).
A blank cell in a TDS table is a merged cell (checked by rendering Rigid 10K page 2); it is reported as '(=previous, merged cell)'.
"""
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
bs = chr(92)
SC = 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins'
mat = json.load(open(SC + '/materials.json', encoding='utf8'))
prod = json.load(open(SC + '/products.json', encoding='utf8'))
sol = json.load(open(SC + '/solvent.json', encoding='utf8'))['rows']
idx = json.load(open(SC + '/ds_index.json', encoding='utf8'))
by_pk = {r['pk']: r for r in idx['records']}

# (display name, group, tds key, product slug, solvent-table row, status note)
L = [
 # --- Form 4 family, current ---
 ('Rigid 10K Resin', 'SLA-Form4', 'rigid10k__910', 'rigid-10k-resin', 'Rigid 10K Resin', ''),
 ('Rigid 4000 Resin', 'SLA-Form4', 'rigid4000__56', 'rigid-4000-resin', 'Rigid 4000 Resin', ''),
 ('Tough 2000 Resin V2', 'SLA-Form4', 'tough2000v2__3304', 'tough-2000-resin', 'Tough 2000 Resin V2', ''),
 ('Tough 1500 Resin V2', 'SLA-Form4', 'tough1500v2__3173', 'tough-1500-resin', 'Tough 1500 Resin V2', ''),
 ('Tough 1000 Resin', 'SLA-Form4', 'tough1000__3298', 'tough-1000-resin', 'Tough 1000 Resin', ''),
 ('Durable Resin', 'SLA-Form4', 'durable__51', 'durable-resin', 'Durable Resin V2', ''),
 ('Flexible 80A Resin V2', 'SLA-Form4', 'flexible-80a-resin-v2__3462', 'flexible-80a-resin', None, 'cube table has no V2 row; the older "Flexible 80A Resin" row (IPA 11.7) belongs to V1'),
 ('Flexible 50A Resin (formerly Elastic 50A V2)', 'SLA-Form4', 'flexible50a__2378', 'flexible-50a-resin', 'Elastic 50A Resin V2', 'solvent page still uses the old name'),
 ('Silicone 40A Resin', 'SLA-Form4', 'silicone40a__2083', 'silicone-40a-resin', 'Silicone 40A Resin', ''),
 ('Clear Resin V5', 'SLA-Form4', 'clearv5__2426', 'clear-resin', 'Clear Resin V5', ''),
 ('Grey Resin V5', 'SLA-Form4', 'grey-v5__2425', 'grey-resin', 'Grey Resin V5', ''),
 ('Black Resin V5', 'SLA-Form4', 'blackv5__2428', 'black-resin', 'Black Resin V5', ''),
 ('White Resin V5', 'SLA-Form4', 'white-v5__2429', 'white-resin', 'White Resin V5', ''),
 ('Color Resin V5', 'SLA-Form4', 'colorresin__3251', 'color-resin', 'Color Resin V5', ''),
 ('Fast Model Resin', 'SLA-Form4', 'fastmodel__2424', 'fast-model-resin', 'Fast Model Resin', ''),
 ('High Temp Resin', 'SLA-Form4', 'hightemp__55', 'high-temp-resin', 'High Temp Resin V2', ''),
 ('ESD Resin', 'SLA-Form4', 'esd__1243', 'esd-resin', 'ESD Resin', ''),
 ('Flame Retardant Resin', 'SLA-Form4', 'flameretardant__1948', 'flame-retardant-resin', 'Flame Retardant Resin', ''),
 ('Clear Cast Resin', 'SLA-Form4', 'clearcast__2707', 'clear-cast-resin', 'Clear Cast Resin', 'burn-out casting resin'),
 ('Castable Wax Resin', 'SLA-Form4', 'castablewax__47', 'castable-wax-resin', None, 'burn-out casting wax'),
 ('Alumina 4N Resin', 'SLA-Form4', 'alumina4n__2096', 'ceramic-alumina-4n-resin', None, 'green part is sintered in a furnace; sintered values differ by orders of magnitude'),
 ('True Cast Resin', 'SLA-Form4', 'truecastresin__3250', 'true-cast-resin', None, 'jewellery casting; TDS gives almost no mechanical data'),
 ('Color Base Resin', 'SLA-Form4', 'colorbase__257', 'color-base-resin', None, 'base for Color Kit'),
 # --- Form 4B / medical line ---
 ('BioMed Clear Resin', 'SLA-Medical', 'biomedclear__716', 'biomed-clear-resin', 'BioMed Clear Resin', 'Form 4B/4BL only'),
 ('BioMed Amber Resin', 'SLA-Medical', 'biomedamber__710', 'biomed-amber-resin', 'BioMed Amber Resin', 'Form 4B/4BL only'),
 ('BioMed Durable Resin', 'SLA-Medical', 'biomeddurable__2041', 'biomed-durable-resin', 'BioMed Durable Resin', 'Form 4B/4BL only'),
 ('BioMed Flex 50A Resin (solvent page: BioMed Elastic 50A)', 'SLA-Medical', 'biomedflex50a__2306', 'biomed-flex-50a-resin', 'BioMed Elastic 50A Resin', 'Form 4B/4BL only'),
 ('BioMed Flex 80A Resin', 'SLA-Medical', 'biomedflexible80a__2313', 'biomed-flex-80a-resin', 'BioMed Flex 80A Resin', 'Form 4B/4BL only'),
 ('BioMed Black Resin', 'SLA-Medical', 'biomedblack__1403', 'biomed-black-resin', 'BioMed Black Resin', 'Form 4B/4BL only'),
 ('BioMed White Resin', 'SLA-Medical', 'biomedwhite__1404', 'biomed-white-resin', 'BioMed White Resin', 'Form 4B/4BL only'),
 # --- legacy / other printers (still on the catalogue) ---
 ('Elastic 50A Resin V1 (legacy)', 'SLA-legacy', 'elastic50av1__712', None, 'Elastic 50A Resin V1', 'superseded; Form 3/2 era'),
 ('Flexible 80A Resin V1 (legacy)', 'SLA-legacy', 'flexible80a__711', 'flexible-80a-resin-v1', 'Flexible 80A Resin', 'superseded by V2'),
 ('Tough 1500 Resin V1 (legacy)', 'SLA-legacy', 'tough1500__1350', 'tough-1500-resin-v1', 'Tough 1500 Resin V1', 'Form 3/3L page'),
 ('Tough 2000 Resin V1 (legacy)', 'SLA-legacy', 'tough2000__1349', 'tough-2000-resin-v1', 'Tough 2000 Resin V1', 'Form 4/4L listed on page'),
 ('Draft Resin V2 (Form 3/2 only)', 'SLA-legacy', 'draft__264', 'draft-v2-resin', 'Draft Resin V2', 'Form 3/2 page'),
 ('Model Resin V3 (Form 3/2 only)', 'SLA-legacy', 'modelv3__1240', 'model-resin', 'Model Resin V3', ''),
 ('Grey Pro Resin (Form 3/2 only)', 'SLA-legacy', 'greypro__1293', 'grey-pro-resin', 'Grey Pro Resin', ''),
 ('Precision Model Resin', 'SLA-legacy', 'precisionmodel__2427', 'precision-model-resin', 'Precision Model', 'dental, Form 4B/4BL'),
 ('PU Rigid 1000 Resin (discontinued?)', 'SLA-legacy', 'purigid1000__1535', None, 'PU Rigid 1000 Resin', 'no product page in catalogue'),
 ('PU Rigid 650 Resin (discontinued?)', 'SLA-legacy', 'purigid650__1536', None, 'PU Rigid 650 Resin', 'no product page in catalogue'),
 # --- Fuse SLS powders ---
 ('Nylon 12 Powder', 'SLS', 'nylon12__1351', 'nylon-12-powder-10', 'Nylon 12', ''),
 ('Nylon 12 White Powder', 'SLS', 'nylon12white__2978', 'nylon-12-white-powder', 'Nylon 12 White', ''),
 ('Nylon 12 Tough Powder', 'SLS', 'nylon12tough__2979', 'nylon-12-tough-powder', 'Nylon 12 Tough', ''),
 ('Nylon 12 GF Powder', 'SLS', 'nylon12gf__1331', 'nylon-12-gf-powder', 'Nylon 12 GF', ''),
 ('Nylon 11 Powder', 'SLS', 'nylon11__1115', 'nylon-11-powder', 'Nylon 11', 'only powder with a bio-based claim'),
 ('Nylon 11 CF Powder', 'SLS', 'nylon11cf__1605', 'nylon-11-cf-powder', 'Nylon 11 CF', ''),
 ('TPU 90A Powder', 'SLS', 'tpu90a__1909', 'tpu-90a-powder', 'TPU 90A', ''),
 ('Polypropylene Powder (not on current catalogue)', 'SLS', 'polypropylene__2360', None, 'Polypropylene', 'TDS and solvent row exist; product page 404; catalogue counts 8 SLS materials without it'),
]
ORDER = ['tensile_modulus', 'uts', 'elong_break', 'elong_yield', 'flex_modulus', 'flex_strength', 'stress50', 'stress100', 'tear', 'shore',
         'hdt_0.45', 'hdt_1.8', 'density', 'tg', 'cte', 'water_abs_D570', 'moisture_powder', 'rebound', 'comp_set', 'vicat']
NAME = {'tensile_modulus': 'tensile_modulus', 'uts': 'UTS', 'elong_break': 'elongation_break', 'elong_yield': 'elongation_yield',
        'flex_modulus': 'flexural_modulus', 'flex_strength': 'flexural_strength', 'stress50': 'stress@50%', 'stress100': 'stress@100%',
        'tear': 'tear', 'shore': 'shore', 'hdt_0.45': 'HDT@0.45MPa', 'hdt_1.8': 'HDT@1.8MPa', 'density': 'density', 'tg': 'Tg',
        'cte': 'CTE', 'water_abs_D570': 'water_absorption_ASTM_D570(printed part, duration not stated)',
        'moisture_powder': 'powder_moisture', 'rebound': 'rebound', 'comp_set': 'compression_set', 'vicat': 'Vicat'}


def state_label(s):
    s = re.sub(r'(°[CF])\s?\d+\s*$', chr(92)+'1', s.strip())
    s = re.sub(r'\s+\d+(\s*,\s*\d+)*\s*$', '', s.strip())
    s = s.replace('Post-Cured', 'PC').replace('Post-cured', 'PC')
    s = re.sub(r'PC for (\d+) min at (\d+) ?°C and (\d+) min at (\d+) ?°C', r'PC \1min@\2C+\3min@\4C', s)
    s = re.sub(r'PC for (\d+) min at ambient temperature', r'PC \1min@RT', s)
    s = re.sub(r'PC for (\d+) min at (\d+) ?°C( and Media Blasted)?', lambda m: f'PC {m.group(1)}min@{m.group(2)}C' + (' +media-blast' if m.group(3) else ''), s)
    s = re.sub(r'PC for (\d+) min at (\d+) ?°C', r'PC \1min@\2C', s)
    s = s.replace('Low Warp Cure (Room Temperature)', 'low-warp cure RT').replace('Full Properties Cure', 'full cure')
    return s.lower() if s.startswith('Green') else s


def fmt(tk):
    out = []
    P = mat[tk]['props']
    for k in ORDER:
        for e in P.get(k, []):
            if tk.startswith('flexible-80a-resin-v2') and k == 'shore':
                continue
            vals = e['values']
            st = e['states'] or [None] * len(vals)
            if e['states'] and len(vals) > len(st):
                vals = vals[:len(st)]
            parts = []
            prev = None
            for s, v in zip(st, vals):
                v = v.strip()
                if v == '' and prev is not None:
                    v = prev + ' (blank cell in TDS; merged with previous column only verified for Rigid 10K)'
                elif v:
                    prev = v
                if not v:
                    continue
                parts.append(f'{state_label(s)}={v}' if s else v)
            if parts:
                lab = NAME[k]
                if k in ('elong_break', 'uts', 'tensile_modulus', 'flex_modulus', 'flex_strength', 'tear', 'stress50', 'stress100', 'water_abs_D570', 'density', 'comp_set') and e['label']:
                    m = re.search(r'\((X/Y|Z|[^)]*)\)\s*$', e['label'])
                    extra = re.sub(r'\s+\d+$', '', e['label'])
                    if k in ('density', 'comp_set') or (m and k not in ('water_abs_D570',)):
                        lab = NAME[k] + '[' + re.sub(r'\s+\d+(,\s*\d+)*$', '', e['label'])[:48] + ']' if k in ('density', 'comp_set') else NAME[k] + '(' + m.group(1) + ')'
                out.append(f'{lab}: ' + ' | '.join(parts))
    return out


EXTRA = {
 'Flexible 80A Resin V2': ['shore: green=68A | PC=83A (TDS row text is garbled in extraction: "68 for a printed | 83 and post-cured"; product page says 83A)',
   'water_immersion_slab_TDS_p5 (deionized water): 1 day hardness=-26 Shore A, mass=+8%, volume=+3%, relative elongation=94%; 1 week hardness=-27, mass=+9%, volume=+7%, relative elongation=101%, relative tensile strength=88%',
   'IPA_immersion_slab: 1 day mass=+45%, volume=+113%; 1 week mass=+48%, volume=+119%',
   'other_aqueous_1day_mass/volume: NaOH 10%=+6%/+2%; HCl 10%=+10%/+6%; H2O2 3%=+10%/+6%; acetic acid 6%=+12%/+7%; bleach 5%=+7%/+4%'],
 'Grey Resin V5': ['ASTM_D543_immersion_Type_IV_bars (from the older 13-page Clear V5 TDS, which states results are from Grey V5): DI water 1 day mass=101.38% modulus=88.63% strength=89.21% elongation=105.36% of unexposed; DI water 1 week mass=103.23% modulus=65.29% strength=67.62% elongation=83.53%',
   'Shore D (older Clear V5 TDS, Clear not Grey): 78D (5 min RT post-cure) / 80D (15 min 60C); density=1.21 g/cm3; Tg=96 C (Clear V5)'],
 'Clear Resin V5': ['Shore D=78D (5 min RT) / 80D (15 min 60C), density=1.21 g/cm3, Tg=96C, CTE(-30-140C)=114.1 um/m/C (older 13-page staging TDS, 5 pp cut from current 2-page TDS)'],
 'Tough 1000 Resin': ['shore: green=56D | PC=68D (TDS row)', 'density: bulk=1.07 g/mL; liquid=1.01 g/mL'],
 'Tough 2000 Resin V2': ['shore: green=61D | PC=76D (TDS row)', 'density: bulk=1.09 g/mL; liquid=1.03 g/mL'],
 'Flexible 50A Resin (formerly Elastic 50A V2)': ['shore: green=44A | PC=55A', 'note: product-page image alt text reads "Flexible 50A Resin V2"; TDS file is named Flexible-50A-V1-TDS; solvent page row is Elastic 50A Resin V2 (same 39.2 IPA / 43.4 acetone / 163.9 xylene numbers)'],
 'Alumina 4N Resin': ['green (printed, unfired): flexural strength=3.6 MPa; flexural modulus=24.5 MPa; Shore D=70D',
   'sintered: Young modulus=390 GPa (TDS; product page text says 380 GPa); 4-point flex strength XY=400 MPa, Z=320 MPa; relative density=98.6%; CTE=5 ppm/K; max working temperature=1500 C'],
}
rows = []
for name, grp, tk, slug, srow, note in L:
    parts = [f'group={grp}'] + fmt(tk)
    p = prod.get(slug) if slug else None
    if p and 'error' not in p:
        t = p['tags']
        if t.get('Minimum Layer Thickness'):
            parts.append('min_layer_thickness=' + ' / '.join(t['Minimum Layer Thickness']) + ' (product page tag)')
        else:
            parts.append('min_layer_thickness=not on product page')
        pr = [x for x in t.get('Compatible Printer', []) if re.match(r'(Form|Fuse)', x)]
        parts.append('printers=' + ', '.join(pr))
        if t.get('Biocompatibility'):
            parts.append('page_biocompat_tag=' + ', '.join(t['Biocompatibility']))
    if p and 'error' not in p and p.get('headline'):
        have = '; '.join(parts)
        extra = []
        for a, b in p['headline']:
            if a == 'Tensile Modulus' and 'tensile_modulus' not in have:
                extra.append('Tensile Modulus ' + re.sub('<[^>]+>', '', str(b)))
            if a == 'Shore Hardness' and 'shore' not in have:
                extra.append('Shore Hardness ' + str(b))
        if extra:
            parts.append('product_page_headline_values: ' + ' | '.join(extra) + ' (product page; state not given)')
    bio = mat[tk]['bio']
    if bio:
        parts.append('TDS_biocompat_standards=' + ', '.join(sorted(set(re.sub(r':\d{4}$', '', b) for b in bio))))
    if srow and srow in sol:
        r = sol[srow]
        parts.append('24h_cube_weight_gain_%%: water=%s, salt_water=%s, IPA=%s, acetone=%s, xylene=%s' % (r['Water'], r['Salt Water (3.5% NaCl)'], r['Isopropyl Alcohol'], r['Acetone'], r['Xylene']))
    fn = [f for f in mat[tk]['footnotes'] if re.search(r'(?i)post-?cur|Form Cure|conditioned', f)]
    if fn:
        parts.append('recipe_and_test_conditions_from_TDS_footnotes="' + re.sub(r'(%sd) m%sb' %(bs,bs), '%s1 um' % bs, ' || '.join(x[:340] for x in fn[:2])) + '"')
    if name in EXTRA:
        parts += EXTRA[name]
    if note:
        parts.append('note=' + note)
    pk = int(tk.split('__')[1])
    src = by_pk[pk]['file']
    srcs = [src if src.startswith('http') else 'https://formlabs.com' + src]
    if slug:
        srcs.append(f'https://formlabs.com/products/{slug}/')
    if srow:
        srcs.append('https://formlabs.com/support/solvent-compatibility/')
    rows.append(dict(name=name, fields='; '.join(parts), source=' ; '.join(srcs)))
json.dump(rows, open(SC + '/table_rows.json', 'w', encoding='utf8'), indent=1, ensure_ascii=False)
print(len(rows))
for r in rows[:2] + [x for x in rows if x['name'].startswith(('Flexible 80A Resin V2', 'Silicone', 'Nylon 11 CF'))]:
    print(r['name']); print(r['fields'][:1800]); print()
