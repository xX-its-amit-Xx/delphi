"""Split the full PTM build into a public file and a local-only file (licence rule from the hub, 2026-11-01).

- dbPTM and EPSD state no licence (= all rights reserved): their rows go to restricted.local.jsonl.gz (gitignored).
- UniProt (CC BY 4.0), iPTMnet (CC BY-NC-SA 4.0) and Banu 2025 (CC BY 4.0) rows stay public.
- Zebrafish phosphosites from Lemeer et al. 2008 Mol Cell Proteomics (article CC BY per Europe PMC) are re-sourced from the
  paper's own Supplementary Table 3 (phosphopeptides) and kept public. Kwon 2016 (Proteomics) and Lemeer 2008 (J Proteome Res)
  are not open access, so their sites stay local-only (via EPSD).
Input: annotations.full.local.jsonl.gz (from build_ptm.py) and the Lemeer supplementary PDF converted with pdftotext.
"""
import json, gzip, os, re, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = f'{ROOT}/omics/ptm'
LEMEER_T3 = 'C:/Temp/omics-cache/ptm/raw/lemeer/x/Supplementary_Table3.txt'  # pdftotext -layout of mmc1.zip/Supplementary_Table3.pdf
RESTRICTED = {'dbPTM', 'EPSD'}

G = json.load(open(f'{ROOT}/omics/genes.json', encoding='utf-8'))['genes']
SEQ = {}
C = 'C:/Temp/omics-cache/ptm/uniprot'
for f in sorted(os.listdir(C)):
    if f.startswith('zf_') and f[3].isdigit():
        for e in json.load(gzip.open(f'{C}/{f}', 'rt', encoding='utf-8')):
            SEQ[e['primaryAccession']] = e['sequence']['value']
for a, v in json.load(gzip.open(f'{C}/zf_uniparc.json.gz', 'rt', encoding='utf-8')).items():
    SEQ.setdefault(a, v['sequence'])
genes = [g for g in G if g.get('uniprot') and SEQ.get(g['uniprot'])]

pub, res = [], []
ff_by_site = {}
for line in gzip.open(f'{OUT}/annotations.full.local.jsonl.gz', 'rt', encoding='utf-8'):
    r = json.loads(line)
    (res if r['source']['db'] in RESTRICTED else pub).append(r)
    if r['species'] == 'Danio rerio' and 'flying_fish' in r and r['value'].get('position'):
        ff_by_site[(r['gene']['zfin_id'], r['value']['position'])] = r['flying_fish']

# ---- Lemeer 2008 MCP Supplementary Table 3 ----
peps = collections.defaultdict(lambda: {'ipi': set(), 'score': 0.0})
for ln in open(LEMEER_T3, encoding='utf-8', errors='replace'):
    m = re.match(r'^\s*(\S+)\s+([\d.]+)\s+(IPI\d+)', ln)
    if not m:
        continue
    raw = m.group(1).replace('*', '')
    if not re.fullmatch(r'(?:p?[A-Z])+', raw):
        continue
    plain, sites, i = '', [], 0
    while i < len(raw):
        if raw[i] == 'p':
            sites.append(len(plain))
            i += 1
            continue
        plain += raw[i]
        i += 1
    for s in sites:
        k = (plain, s)
        peps[k]['ipi'].add(m.group(3))
        peps[k]['score'] = max(peps[k]['score'], float(m.group(2)))
drop = collections.Counter()
lem = {}
for (plain, s), info in peps.items():
    hits = []
    for g in genes:
        seq = SEQ[g['uniprot']]
        j = seq.find(plain)
        while j >= 0:
            hits.append((g, j + s + 1))
            j = seq.find(plain, j + 1)
    if not hits:
        drop['Lemeer 2008: peptide not found in a universe protein'] += 1
        continue
    if len({h[0]['zfin_id'] for h in hits}) > 1 or len(hits) > 1:
        drop['Lemeer 2008: peptide matches more than one universe position (not assigned)'] += 1
        continue
    g, pos = hits[0]
    k = (g['zfin_id'], pos)
    e = lem.setdefault(k, {'g': g, 'pos': pos, 'peps': set(), 'ipi': set(), 'score': 0.0})
    e['peps'].add(plain)
    e['ipi'] |= info['ipi']
    e['score'] = max(e['score'], info['score'])
for (z, pos), e in lem.items():
    g = e['g']
    aa = SEQ[g['uniprot']][pos - 1]
    r = {'gene': {'symbol': g['symbol'], 'zfin_id': g['zfin_id'], 'ensembl_gene': g.get('ensembl_gene'), 'uniprot': g.get('uniprot')},
         'species': 'Danio rerio', 'layer': 'ptm', 'feature': 'phospho_site',
         'value': {'residue': aa, 'position': pos, 'modification': 'phosphorylation'}, 'unit': None,
         'context': {'anatomy': None, 'stage': None, 'cell_type': None, 'condition': 'whole embryos (wild type and Fyn/Yes morphants)'},
         'source': {'db': 'Lemeer 2008 Mol Cell Proteomics', 'release_or_date': '2008', 'url': 'https://doi.org/10.1074/mcp.M800081-MCP200',
                    'accession': 'Supplementary Table 3', 'licence': 'CC BY (article licence as listed by Europe PMC; supplementary file mmc1.zip)'},
         'kind': 'measured', 'evidence': 'MS/MS', 'concordance': None, 'pmid': ['18550893'],
         'peptides': sorted(e['peps']), 'ipi': sorted(e['ipi']), 'max_mascot_score': e['score'],
         'note': 'zebrafish embryo phosphopeptide; site placed by exact peptide match to the universe protein (unique match only)'}
    ff = ff_by_site.get((z, pos))
    if ff:
        r['flying_fish'] = ff
    pub.append(r)
print('Lemeer 2008 public sites', len(lem), dict(drop))

def write(rows, fn):
    rows.sort(key=lambda r: (r['gene']['symbol'], r['feature'], r['source']['db'], r['value'].get('zf_position') or r['value'].get('position') or 0))
    with gzip.open(fn, 'wt', encoding='utf-8', compresslevel=9) as fh:
        for r in rows:
            fh.write(json.dumps(r, separators=(',', ':'), ensure_ascii=False) + '\n')

write(pub, f'{OUT}/annotations.jsonl.gz')
write(res, f'{OUT}/restricted.local.jsonl.gz')
json.dump({'lemeer_sites': len(lem), 'lemeer_dropped': drop}, open('C:/Temp/omics-cache/ptm/work/split_stats.json', 'w'))
print('public', len(pub), 'restricted', len(res))
