"""Build omics/ptm/annotations.jsonl.gz: PTM sites for the omics gene universe.

Sources: UniProt (zebrafish entries + human/mouse orthologue entries), EPSD 2.0 (zebrafish phosphoproteomes),
dbPTM (zebrafish + human/mouse), iPTMnet (human/mouse). Human/mouse sites are mapped onto the zebrafish protein
by global pairwise alignment and checked for residue and +/-7 motif conservation. Fin genes get a flying-fish
(H. speculiger) residue-state check. No bird data. Inputs cached under C:/Temp/omics-cache/ptm (fetch_uniprot.py
and the download commands in SOURCES.md).
"""
import json, gzip, os, re, tarfile, io, csv, subprocess, datetime, collections
from Bio import Align
from Bio.Align import substitution_matrices

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
C = 'C:/Temp/omics-cache/ptm'
OUT = f'{ROOT}/omics/ptm'
BLAST = 'C:/Temp/sequences/tools/ncbi-blast-2.17.0+/bin'
HSPEC_DB = 'C:/Temp/sequences/figshare/hspec'
DRER_DB = 'C:/Temp/sequences/figshare/drer'
TODAY = datetime.date.today().isoformat()
WIN = 7
MOTIF_MIN = 0.6  # fraction of identical positions in the 15-residue window for 'conserved'
AVES = re.compile(r'(aves|gallus|chicken|taeniopygia|finch|meleagris|columba|coturnix|\bbird|avian|_CHICK|_MELGA|_TAEGU|_ANAPL|_COLLI|_COTJA)', re.I)


def jload(p):
    return json.load(open(p, encoding='utf-8'))


def gzload(p):
    return json.load(gzip.open(p, 'rt', encoding='utf-8'))


# ---------------- universe ----------------
G = jload(f'{ROOT}/omics/genes.json')['genes']
gene_by_zfacc = {}
genes_by_hs = collections.defaultdict(list)
genes_by_hsym = collections.defaultdict(list)
for g in G:
    if g.get('uniprot'):
        gene_by_zfacc[g['uniprot']] = g
    h = g.get('human_ortholog') or {}
    if h.get('uniprot') and g.get('uniprot'):
        genes_by_hs[h['uniprot']].append(g)
    if h.get('symbol') and g.get('uniprot'):
        genes_by_hsym[h['symbol'].upper()].append(g)


def gid(g):
    return {'symbol': g['symbol'], 'zfin_id': g['zfin_id'], 'ensembl_gene': g.get('ensembl_gene'), 'uniprot': g.get('uniprot')}


# ---------------- UniProt entries ----------------
def load_up(prefix):
    out = {}
    for f in sorted(os.listdir(f'{C}/uniprot')):
        if f.startswith(prefix + '_') and f[len(prefix) + 1].isdigit() and f.endswith('.json.gz'):
            for e in gzload(f'{C}/uniprot/{f}'):
                out[e['primaryAccession']] = e
    return out


UPZ, UPH, UPM = load_up('zf'), load_up('hs'), load_up('mm')
SEQ = {}
for d in (UPZ, UPH, UPM):
    for a, e in d.items():
        SEQ[a] = e['sequence']['value']
UNIPARC = gzload(f'{C}/uniprot/zf_uniparc.json.gz')  # deleted TrEMBL entries: sequence from UniParc (fetch_uniparc.py)
for a, v in UNIPARC.items():
    SEQ.setdefault(a, v['sequence'])
genes_by_mm = {}
for a, e in UPM.items():
    names = [gn['geneName']['value'].upper() for gn in e.get('genes', []) if gn.get('geneName')]
    for n in names:
        if n in genes_by_hsym:
            genes_by_mm[a] = genes_by_hsym[n]
            break
print('UniProt entries zf/hs/mm', len(UPZ), len(UPH), len(UPM), 'mouse mapped', len(genes_by_mm), flush=True)

# ---------------- alignment ----------------
AL = Align.PairwiseAligner()
AL.substitution_matrix = substitution_matrices.load('BLOSUM62')
AL.open_gap_score, AL.extend_gap_score = -10, -0.5
AL.mode = 'global'
AL.end_gap_score = 0  # free end gaps
_amap = {}


def align_map(a_seq, b_seq, key):
    """(posmap a->b 1-based, identity % over aligned pairs, aligned pairs, coverage of a)."""
    if key in _amap:
        return _amap[key]
    if len(a_seq) * len(b_seq) > 2.6e7:  # titin-scale proteins: skip
        _amap[key] = None
        return None
    aln = AL.align(re.sub('[^ARNDCQEGHILKMFPSTWYVBZX]', 'X', a_seq), re.sub('[^ARNDCQEGHILKMFPSTWYVBZX]', 'X', b_seq))[0]
    m = {}
    ident = pairs = 0
    for (as_, ae), (bs, be) in zip(*aln.aligned):
        for i in range(ae - as_):
            m[int(as_) + i + 1] = int(bs) + i + 1
            pairs += 1
            ident += a_seq[int(as_) + i] == b_seq[int(bs) + i]
    r = (m, round(100 * ident / pairs, 1) if pairs else 0.0, pairs, round(pairs / len(a_seq), 3))
    _amap[key] = r
    return r


def window(seq, p):
    return ''.join(seq[i - 1] if 1 <= i <= len(seq) else '-' for i in range(p - WIN, p + WIN + 1))


def conservation(src_seq, zf_seq, m, p):
    q = m.get(p)
    sw = window(src_seq, p)
    if q is None:
        return {'class': 'not-conserved', 'zf_position': None, 'zf_residue': None, 'note': 'site falls in an alignment gap',
                'motif_identity': None, 'src_motif': sw, 'zf_motif': None}
    same = n = 0
    zm = []
    for i in range(p - WIN, p + WIN + 1):
        if not (1 <= i <= len(src_seq)):
            zm.append('-')
            continue
        n += 1
        j = m.get(i)
        zr = zf_seq[j - 1] if j else '-'
        zm.append(zr)
        same += (zr == src_seq[i - 1])
    mi = round(same / n, 2) if n else 0
    zr = zf_seq[q - 1]
    if zr != src_seq[p - 1]:
        cls = 'not-conserved'
    elif mi >= MOTIF_MIN:
        cls = 'conserved'
    else:
        cls = 'residue-conserved-motif-diverged'
    out = {'class': cls, 'zf_position': q, 'zf_residue': zr, 'motif_identity': mi, 'src_motif': sw, 'zf_motif': ''.join(zm)}
    if cls == 'not-conserved' and {zr, src_seq[p - 1]} <= set('ST'):
        out['note'] = 'S/T acceptor swap'
    return out


# ---------------- feature naming ----------------
def feature_of(mod, ftype=''):
    s = (mod + ' ' + ftype).lower()
    if 'disulfide' in s:
        return 'disulfide_bond'
    if 'phospho' in s:
        return 'phospho_site'
    if 'glyc' in s or 'glcnac' in s or 'carbohyd' in s:
        return 'glyco_site'
    if 'sumo' in s:
        return 'sumo_site'
    if 'ubiquitin' in s:
        return 'ubiquitin_site'
    if 'acetyl' in s:
        return 'acetyl_site'
    if 'methyl' in s:
        return 'methyl_site'
    if any(k in s for k in ('palmit', 'myrist', 'farnes', 'geranyl', 'gpi', 'lipid', 'cholesterol')):
        return 'lipid_site'
    if 'nitrosyl' in s:
        return 'nitrosyl_site'
    if 'cross-link' in s or 'isopeptide' in s:
        return 'crosslink_site'
    return 'ptm_site'


ECO_EXP = {'ECO:0000269', 'ECO:0007744', 'ECO:0000314', 'ECO:0000315'}


def up_kind(evs):
    codes = [e.get('evidenceCode') for e in evs or []]
    if any(c in ECO_EXP for c in codes):
        return 'curated', next(c for c in codes if c in ECO_EXP)
    if 'ECO:0000250' in codes:
        return 'borrowed-ortholog', 'ECO:0000250'
    if 'ECO:0000255' in codes:
        return 'predicted', 'ECO:0000255'
    if any(c in ('ECO:0000256', 'ECO:0000259', 'ECO:0007829', 'ECO:0000313', 'ECO:0000312') for c in codes):
        return 'inferred-electronic', codes[0]
    if 'ECO:0000305' in codes:
        return 'curated', 'ECO:0000305'
    return 'curated', (codes[0] if codes else None)


UP_LIC = 'CC BY 4.0'
UP_TYPES = {'Modified residue', 'Glycosylation', 'Lipidation', 'Disulfide bond', 'Cross-link'}
CTX = {'anatomy': None, 'stage': None, 'cell_type': None, 'condition': None}
rows = []
stats = collections.Counter()
cons_stats = collections.Counter()
cons_by_source = collections.defaultdict(collections.Counter)
cons_by_feature = collections.defaultdict(collections.Counter)
dropped = collections.Counter()


def row(g, species, feature, value, source, kind, evidence, **extra):
    r = {'gene': gid(g), 'species': species, 'layer': 'ptm', 'feature': feature, 'value': value, 'unit': None,
         'context': dict(CTX), 'source': source, 'kind': kind, 'evidence': evidence, 'concordance': None}
    r.update(extra)
    rows.append(r)
    stats[(source['db'], kind)] += 1
    return r


# ---------- 1. UniProt zebrafish entries ----------
for acc, e in UPZ.items():
    g = gene_by_zfacc.get(acc)
    if not g:
        continue
    seq = SEQ[acc]
    for f in e.get('features', []):
        if f['type'] not in UP_TYPES:
            continue
        s, t = f['location']['start'].get('value'), f['location']['end'].get('value')
        if s is None or s > len(seq):
            continue
        mod = f.get('description') or f['type']
        if f['type'] == 'Disulfide bond':
            mod = 'disulfide bond' + (f' ({f["description"]})' if f.get('description') else '')
        kind, ev = up_kind(f.get('evidences'))
        val = {'residue': seq[s - 1], 'position': s, 'modification': mod}
        if f['type'] == 'Disulfide bond' or (f['type'] == 'Cross-link' and t and t != s):
            val['partner_position'] = t
        refs = [f"{x.get('source')}:{x.get('id')}" for x in f.get('evidences', []) if x.get('id')]
        extra = {'evidence_refs': refs} if refs else {}
        if kind == 'borrowed-ortholog':
            extra['note'] = 'UniProt curators transferred this site from a homologue (ECO:0000250, by similarity); not measured in zebrafish'
        row(g, 'Danio rerio', feature_of(mod, f['type']), val,
            {'db': 'UniProt', 'release_or_date': TODAY, 'url': f'https://rest.uniprot.org/uniprotkb/{acc}', 'accession': acc, 'licence': UP_LIC},
            kind, ev, uniprot_reviewed=e['entryType'].startswith('UniProtKB reviewed'), **extra)
print('UniProt zf rows', len(rows), flush=True)

# ---------- 2. EPSD zebrafish (measured phosphoproteomes) ----------
PAPERS = {
    '26449285': 'Kwon OK et al. 2016, Proteomics (doi:10.1002/pmic.201500017): Global analysis of phosphoproteome dynamics in embryonic development of zebrafish',
    '18307296': 'Lemeer S et al. 2008, J Proteome Res (doi:10.1021/pr700667w): Online automated in vivo zebrafish phosphoproteomics',
    '18550893': 'Lemeer S et al. 2008, Mol Cell Proteomics (doi:10.1074/mcp.m800081-mcp200): Comparative phosphoproteomics of zebrafish Fyn/Yes morpholino knockdown embryos',
    '24705204': 'SysPTM 2.0 (Li J et al. 2014, Database bau025): a secondary database, not a measurement paper',
}
ep_seq = {}
cur = None
for line in open(f'{C}/raw/epsd/x/Danio rerio.fasta', encoding='utf-8'):
    line = line.strip()
    if line.startswith('>'):
        p = line[1:].split('|')
        cur = p[1]
        ep_seq[cur] = {'sym': p[2] if len(p) > 2 else '', 'seq': ''}
    elif cur:
        ep_seq[cur]['seq'] += line
sym2gene = {g['symbol'].lower(): g for g in G if g.get('uniprot')}
ep_sites = collections.defaultdict(lambda: {'pmids': set(), 'ids': set()})
for r in csv.DictReader(open(f'{C}/raw/epsd/x/Danio rerio.txt', encoding='utf-8'), delimiter='\t'):
    k = (r['UniProt ID'], int(r['Position']), r['AA'])
    ep_sites[k]['pmids'].update(x for x in r['Reference'].split(';') if x)
    ep_sites[k]['ids'].add(r['EPSD ID'])
for (acc, pos, aa), info in ep_sites.items():
    es = ep_seq.get(acc, {})
    g = gene_by_zfacc.get(acc) or sym2gene.get((es.get('sym') or '').lower())
    if not g:
        dropped['EPSD: protein not in gene universe'] += 1
        continue
    zacc = g['uniprot']
    zseq = SEQ.get(zacc)
    if not zseq:
        dropped['EPSD: no zebrafish sequence'] += 1
        continue
    src = es.get('seq') or ''
    if src == zseq:
        q = pos
    else:
        if not src or pos > len(src) or src[pos - 1] != aa:
            dropped['EPSD: residue mismatch in EPSD sequence'] += 1
            continue
        mp = align_map(src, zseq, ('ep', acc, zacc))
        if not mp:
            dropped['EPSD: alignment skipped'] += 1
            continue
        q = mp[0].get(pos)
        if q is None or zseq[q - 1] != aa or mp[1] < 90:
            dropped['EPSD: could not place on the universe protein (identity<90% or residue differs)'] += 1
            continue
    if q > len(zseq) or zseq[q - 1] != aa:
        dropped['EPSD: residue mismatch'] += 1
        continue
    pm = sorted(info['pmids'])
    prim = [p for p in pm if p != '24705204']
    row(g, 'Danio rerio', 'phospho_site', {'residue': aa, 'position': q, 'modification': 'phosphorylation'},
        {'db': 'EPSD', 'release_or_date': 'EPSD 2.0; species file dated 2024-09-05', 'url': 'https://epsd.biocuckoo.cn/Download.php',
         'accession': sorted(info['ids'])[0], 'licence': 'no licence stated; (c) CUCKOO Workgroup; free academic download; cite EPSD 2.0 (NAR 2025)'},
        'measured', 'MS/MS', pmid=pm, papers=[PAPERS.get(p, 'PMID:' + p) for p in pm],
        note=('zebrafish embryo phosphoproteome site' if prim else 'listed only via SysPTM 2.0 (secondary database)')
        + ('' if acc == zacc else f'; EPSD protein {acc} placed on universe protein {zacc} by alignment'),
        epsd_uniprot=acc)
print('after EPSD', len(rows), flush=True)

# ---------- 3. dbPTM (parse) ----------
dbptm_sites = collections.defaultdict(lambda: {'pmids': set()})
SPECIES_SUFFIX = {'_HUMAN': 'Homo sapiens', '_MOUSE': 'Mus musculus', '_DANRE': 'Danio rerio'}
for fn in sorted(os.listdir(f'{C}/raw/dbptm')):
    try:
        tf = tarfile.open(f'{C}/raw/dbptm/{fn}', 'r:gz')
        members = tf.getmembers()
    except Exception:
        dropped[f'dbPTM: unreadable archive {fn}'] += 1
        continue
    for m in members:
        if not m.isfile():
            continue
        for line in io.TextIOWrapper(tf.extractfile(m), encoding='utf-8', errors='replace'):
            p = line.rstrip('\n').split('\t')
            if len(p) < 6:
                continue
            name, acc, pos, mod, pm, pep = p[:6]
            suf = name[name.rfind('_'):] if '_' in name else ''
            if suf not in SPECIES_SUFFIX:
                continue
            try:
                pos = int(pos)
            except ValueError:
                continue
            k = (acc, pos, mod)
            dbptm_sites[k]['pep'] = pep
            dbptm_sites[k]['sp'] = SPECIES_SUFFIX[suf]
            dbptm_sites[k]['pmids'].update(x.strip() for x in pm.split(';') if x.strip())
print('dbPTM human/mouse/zebrafish sites', len(dbptm_sites), flush=True)

# ---------- 4. iPTMnet (parse) ----------
iptm_sites = collections.defaultdict(lambda: {'subs': set(), 'pmids': set(), 'enz': set()})
for line in open(f'{C}/raw/iptmnet_ptm.txt', encoding='utf-8', errors='replace'):
    p = line.rstrip('\n').split('\t')
    if len(p) < 6:
        continue
    typ, sub, acc, sym, org, site = p[:6]
    if org.startswith('Homo sapiens'):
        sp = 'Homo sapiens'
    elif org.startswith('Mus musculus'):
        sp = 'Mus musculus'
    else:
        continue
    mm = re.match(r'^([A-Z])(\d+)$', site)
    if not mm:
        continue
    k = (acc, int(mm.group(2)), typ.lower())
    iptm_sites[k]['res'] = mm.group(1)
    iptm_sites[k]['sp'] = sp
    iptm_sites[k]['subs'].add(sub)
    if len(p) > 9 and p[9]:
        iptm_sites[k]['pmids'].update(x.strip() for x in re.split('[,;]', p[9]) if x.strip())
    if len(p) > 7 and p[7]:
        iptm_sites[k]['enz'].add(p[7])
print('iPTMnet human/mouse sites', len(iptm_sites), flush=True)

# ---------- 5. UniProt human/mouse experimental features ----------
up_borrow = []
for d in (UPH, UPM):
    for acc, e in d.items():
        for f in e.get('features', []):
            if f['type'] not in UP_TYPES:
                continue
            codes = {x.get('evidenceCode') for x in f.get('evidences', [])}
            if not codes & ECO_EXP:
                continue  # only experimentally supported orthologue sites are borrowed
            s = f['location']['start'].get('value')
            if s is None:
                continue
            up_borrow.append((acc, s, f.get('description') or f['type'], f['type'], f.get('evidences')))


# ---------- borrowing ----------
def targets(acc):
    if acc in genes_by_hs:
        return genes_by_hs[acc], 'Homo sapiens', 'human orthologue from omics/genes.json (ZFIN orthology)'
    if acc in genes_by_mm:
        return genes_by_mm[acc], 'Mus musculus', 'reviewed mouse entry with the human orthologue gene symbol'
    return [], None, None


MOTIF_RULE = (f'conserved = same residue and >= {int(MOTIF_MIN * 100)}% identical over the 15-residue window; '
              'residue-conserved-motif-diverged = same residue, window below that; not-conserved = different residue or alignment gap')


def borrow(acc, pos, residue, mod, feature, source, evidence, extra):
    tg, sp, how = targets(acc)
    if not tg:
        dropped[f'borrowed ({source["db"]}): protein is not a mapped orthologue of a universe gene'] += 1
        return
    sseq = SEQ.get(acc)
    if not sseq:
        dropped['borrowed: no source sequence'] += 1
        return
    if pos > len(sseq) or (residue and sseq[pos - 1] != residue):
        dropped[f'borrowed ({source["db"]}): residue differs from current UniProt canonical sequence'] += 1
        return
    for g in tg:
        zseq = SEQ.get(g['uniprot'])
        if not zseq:
            dropped['borrowed: no zebrafish sequence'] += 1
            continue
        mp = align_map(sseq, zseq, (acc, g['uniprot']))
        if not mp:
            dropped['borrowed: alignment skipped (protein too long)'] += 1
            continue
        cons = conservation(sseq, zseq, mp[0], pos)
        cons_stats[cons['class']] += 1
        cons_by_source[source['db']][cons['class']] += 1
        cons_by_feature[feature][cons['class']] += 1
        val = {'residue': sseq[pos - 1], 'position': pos, 'modification': mod, 'source_species': sp, 'source_protein': acc,
               'zf_position': cons['zf_position'], 'zf_residue': cons['zf_residue'], 'conservation': cons['class']}
        row(g, sp, feature, val, source, 'borrowed-ortholog', evidence, orthology=how,
            alignment={'identity_pct': mp[1], 'aligned_pairs': mp[2], 'coverage_of_source': mp[3]},
            motif={'source': cons['src_motif'], 'zebrafish': cons['zf_motif'], 'identity': cons['motif_identity']},
            note=f'site reported in {sp}, mapped onto the zebrafish protein by alignment; not a zebrafish measurement'
            + (('; ' + cons['note']) if cons.get('note') else ''),
            **extra)


for acc, s, mod, ftype, evs in up_borrow:
    ev = next((x['evidenceCode'] for x in evs if x.get('evidenceCode') in ECO_EXP), None)
    refs = [f"{x.get('source')}:{x.get('id')}" for x in evs if x.get('id')][:10]
    m = 'disulfide bond' if ftype == 'Disulfide bond' else mod
    borrow(acc, s, None, m, feature_of(m, ftype),
           {'db': 'UniProt', 'release_or_date': TODAY, 'url': f'https://rest.uniprot.org/uniprotkb/{acc}', 'accession': acc, 'licence': UP_LIC},
           ev, {'evidence_refs': refs} if refs else {})
print('after UniProt borrow', len(rows), flush=True)

for (acc, pos, typ), info in iptm_sites.items():
    subs = sorted(info['subs'])
    if subs == ['unip']:
        dropped['iPTMnet: site only from UniProt (ingested from UniProt directly)'] += 1
        continue
    ex = {'iptmnet_sources': subs, 'pmid': sorted(info['pmids'])[:20]}
    if info['enz']:
        ex['enzymes'] = sorted(info['enz'])[:10]
    borrow(acc, pos, info['res'], typ, feature_of(typ),
           {'db': 'iPTMnet', 'release_or_date': f'files/current retrieved {TODAY}', 'url': 'https://research.bioinformatics.udel.edu/iptmnet_data/files/current/ptm.txt',
            'accession': acc, 'licence': 'CC BY-NC-SA 4.0 (iPTMnet; non-commercial, share-alike)'},
           'iPTMnet:' + '+'.join(subs), ex)
print('after iPTMnet', len(rows), flush=True)

DBPTM_SRC = {'db': 'dbPTM', 'release_or_date': 'dbPTM 2022 experimental-site files (archives dated 2021-09-11)', 'url': 'https://biomics.lab.nycu.edu.tw/dbPTM/download.php',
             'licence': 'no licence stated on the download page; academic resource (Li et al. 2022 NAR); integrates other PTM databases'}
for (acc, pos, mod), info in dbptm_sites.items():
    pep = info.get('pep', '')
    res = pep[10] if len(pep) == 21 and pep[10] != '-' else None
    src = dict(DBPTM_SRC, accession=acc)
    extra = {'pmid': sorted(info['pmids'])[:20]}
    if info['sp'] == 'Danio rerio':
        g = gene_by_zfacc.get(acc)
        zseq = SEQ.get(acc)
        if not g or not zseq:
            dropped['dbPTM zebrafish: protein not in universe (accession differs) or no sequence'] += 1
            continue
        if pos > len(zseq) or (res and zseq[pos - 1] != res):
            dropped['dbPTM zebrafish: residue mismatch'] += 1
            continue
        row(g, 'Danio rerio', feature_of(mod), {'residue': zseq[pos - 1], 'position': pos, 'modification': mod}, src, 'measured', 'literature (dbPTM)', **extra)
    else:
        borrow(acc, pos, res, mod, feature_of(mod), src, 'literature (dbPTM)', extra)
print('after dbPTM', len(rows), flush=True)

# ---------- 6. Banu et al. 2025: phosphoproteins in regenerating zebrafish caudal fin (protein level, no sites) ----------
BANU = jload(f'{C}/work/banu_tables.json')  # parsed from the PMC supplementary .docx by work/parse_banu.py
BANU_SRC = {'db': 'Banu 2025 Sci Rep (PMC11808059)', 'release_or_date': '2025', 'url': 'https://doi.org/10.1038/s41598-024-84735-z',
            'licence': 'CC BY 4.0 (Scientific Reports open access)'}
CAUDAL = {'id': 'ZFA:0001058', 'label': 'caudal fin', 'uberon': 'UBERON:4000164'}
TP = ['12hpa', '1dpa', '2dpa', '3dpa', '7dpa']


def num(x):
    try:
        return float(x)
    except ValueError:
        return None


for tname, tab in (('Supplementary Table 1 (TiO2 enrichment)', BANU['t1']), ('Supplementary Table 2 (pS/pT/pY antibody IP)', BANU['t2'])):
    for c in tab:
        if not c or not c[0].strip().isdigit():
            continue
        sym = c[3].strip().lower()
        g = sym2gene.get(sym)
        if not g:
            dropped['Banu 2025: symbol not an exact universe symbol (not guessed)'] += 1
            continue
        if tname.startswith('Supplementary Table 1'):
            val = {'modification': 'phosphorylation (protein level; sites not reported)', 'psms': num(c[4]),
                   'change_vs_control': {t: num(v) for t, v in zip(TP, c[5:10])}}
        else:
            val = {'modification': 'phosphorylation (protein level; sites not reported)', 'residue_types': c[4],
                   'also_in_TiO2': c[5].strip().upper() == 'YES', 'mean_change_vs_control': {t: num(v) for t, v in zip(TP, c[6:11])}}
        r = row(g, 'Danio rerio', 'phosphoprotein_detected', val, dict(BANU_SRC, accession=c[1].strip()), 'measured', 'MS/MS', pmid=['39924536'],
                table=tname, note='differential phosphorylation during caudal fin regeneration (12 hpa to 7 dpa) vs uninjured control; values as reported in the supplementary table (paper does not state the scale in the table)')
        r['context'] = {'anatomy': CAUDAL, 'stage': None, 'cell_type': None, 'condition': 'regenerating after caudal fin amputation'}
print('after Banu 2025', len(rows), flush=True)

# ---------------- flying fish residue state for fin genes ----------------
FIN_PAT = re.compile(r'^(wnt|fzd|lrp5|lrp6|ctnnb|lef1|tcf7|axin|apc$|dkk|rspo|fgf|fgfr|shh|ihh|dhh|ptch|smo$|gli\d|hhip|bmp|bmpr|smad|nog|chrd|grem|'
                     r'kcnk5b|kcnh2a|slc43a2a|gja1b|tbx5a|prdm1a)')
cc = jload(f'{ROOT}/genotype/causal-chains.json')['genes']
fin_syms = {x['symbol'] for x in cc} | {g['symbol'] for g in G if FIN_PAT.match(g['symbol'])}
fin_genes = [g for g in G if g['symbol'] in fin_syms and g.get('uniprot') and SEQ.get(g['uniprot'])]
print('fin genes', len(fin_genes), flush=True)


def blast(q_fa, db, out):
    subprocess.run([f'{BLAST}/blastp.exe', '-query', q_fa, '-db', db, '-outfmt', '6 qseqid sseqid pident length evalue bitscore stitle',
                    '-max_target_seqs', '5', '-evalue', '1e-10', '-num_threads', '4', '-out', out], check=True)
    hits = collections.defaultdict(list)
    for ln in open(out):
        p = ln.rstrip('\n').split('\t')
        hits[p[0]].append(p)
    return hits


os.makedirs(f'{C}/work', exist_ok=True)
FF = {}
seqs_json = jload(f'{ROOT}/sequences/genes.json')['genes']
for sym in seqs_json:  # focal genes: flying-fish rows of sequences/alignments (MAFFT L-INS-i)
    a = jload(f'{ROOT}/sequences/alignments/{sym}.json')
    al = a['alignment']
    if 'hirundichthys_speculiger' not in al:
        continue
    info = a['sequences']['hirundichthys_speculiger']
    FF[sym] = {'mode': 'msa', 'zrow': al['danio_rerio'], 'frow': al['hirundichthys_speculiger'],
               'protein': info.get('protein_id') or ('tblastn projection on ' + info.get('scaffold', 'assembly')),
               'orthology': 'sequences/alignments (' + ('reciprocal best blastp' if info.get('protein_id') else
                                                        'tblastn projection on the unannotated assembly; not an annotated protein') + ')'}
need = [g for g in fin_genes if g['symbol'] not in FF]
with open(f'{C}/work/fin_q.fa', 'w') as fh:
    for g in need:
        fh.write(f">{g['symbol']}\n{SEQ[g['uniprot']]}\n")
fwd = blast(f'{C}/work/fin_q.fa', HSPEC_DB, f'{C}/work/fin_fwd.tsv')
best = {s: h[0] for s, h in fwd.items()}
ids = sorted({h[1] for h in best.values()})
if ids:
    want = set(ids)
    ffseq = {}
    cur = None
    for ln in open('C:/Temp/sequences/figshare/Hspec.pep.fa'):  # the BLAST db has no parsed seqids, so read the FASTA
        ln = ln.strip()
        if ln.startswith('>'):
            cur = ln[1:].split()[0]
            cur = cur if cur in want else None
            if cur:
                ffseq[cur] = ''
        elif cur:
            ffseq[cur] += ln
    with open(f'{C}/work/ff_hits.fa', 'w') as fh:
        for k, v in ffseq.items():
            fh.write('>' + k + '\n' + v + '\n')
    rev = blast(f'{C}/work/ff_hits.fa', DRER_DB, f'{C}/work/fin_rev.tsv')
    for s, h in best.items():
        ffid = h[1]
        rh = rev.get(ffid, [])
        msym = re.search(r'gene_symbol:(\S+)', rh[0][6]) if rh else None
        if msym and msym.group(1) == s:
            FF[s] = {'mode': 'pair', 'seq': ffseq.get(ffid, ''), 'protein': ffid, 'pident': float(h[2]),
                     'orthology': 'reciprocal best blastp against the Xu et al. 2021 H. speculiger proteome (this layer; automated, not curated)'}
        else:
            dropped['flying fish: no reciprocal best hit (fin gene)'] += 1
print('flying-fish orthologues for fin genes', len(FF), flush=True)

ff_stats = collections.Counter()
ff_by_kind = collections.defaultdict(collections.Counter)
ff_flags = []
fin_ids = {g['zfin_id']: g for g in fin_genes}
for r in rows:
    g = fin_ids.get(r['gene']['zfin_id'])
    if not g or g['symbol'] not in FF:
        continue
    v = r['value']
    zpos = v.get('zf_position') if 'zf_position' in v else v.get('position')
    if not zpos:
        continue
    zseq = SEQ[g['uniprot']]
    zres = zseq[zpos - 1]
    f = FF[g['symbol']]
    if f['mode'] == 'msa':
        if '_map' not in f:
            zi = 0
            e2f = {}
            for zc, fc in zip(f['zrow'], f['frow']):
                if zc != '-':
                    zi += 1
                    e2f[zi] = fc if fc != '-' else None
            zens = f['zrow'].replace('-', '')
            m = None if zens == zseq else align_map(zseq, zens, ('ens', g['uniprot']))[0]
            f['_map'] = (e2f, m)
        e2f, m = f['_map']
        def fat(i):
            e = i if m is None else m.get(i)
            return e2f.get(e) if e else None
    else:
        mp = align_map(zseq, f['seq'], ('ff', g['uniprot'], f['protein']))
        if not mp:
            continue
        def fat(i, mp=mp, s=f['seq']):
            j = mp[0].get(i)
            return s[j - 1] if j else None
    fres = fat(zpos)
    fmot = ''.join((fat(i) or '-') if 1 <= i <= len(zseq) else '-' for i in range(zpos - WIN, zpos + WIN + 1))
    if fres in (None, 'X'):
        state = 'not covered / gap'
    elif fres == zres:
        state = 'same as zebrafish'
    else:
        state = 'differs from zebrafish'
    zmot = window(zseq, zpos)
    valid = [(a, b) for a, b in zip(zmot, fmot) if a != '-']
    mid = sum(a == b for a, b in valid) / max(1, len(valid))
    r['flying_fish'] = {'species': 'Hirundichthys speculiger', 'protein': f['protein'], 'orthology': f['orthology'], 'residue': fres,
                        'state': state, 'motif': fmot, 'motif_identity_vs_zebrafish': round(mid, 2),
                        'caveat': 'residue STATE in the flying-fish protein sequence, not a measured modification and not a phenotype'}
    ff_stats[state] += 1
    ff_by_kind[r['kind']][state] += 1
    if state == 'differs from zebrafish':
        ff_flags.append({'gene': g['symbol'], 'zf_position': zpos, 'zf_residue': zres, 'flying_fish_residue': fres, 'feature': r['feature'],
                         'modification': v.get('modification'), 'source': r['source']['db'], 'kind': r['kind'], 'species': r['species'],
                         'conservation_zf': v.get('conservation')})
print('flying fish', dict(ff_stats), flush=True)

# ---------------- bird guard ----------------
before = len(rows)
rows = [r for r in rows if not AVES.search(r['species']) and not AVES.search(str(r['value'].get('source_protein') or ''))]
assert len(rows) == before, 'bird rows found'

# ---------------- write ----------------
os.makedirs(OUT, exist_ok=True)
rows.sort(key=lambda r: (r['gene']['symbol'], r['feature'], r['source']['db'], r['value'].get('zf_position') or r['value'].get('position') or 0))
with gzip.open(f'{OUT}/annotations.full.local.jsonl.gz', 'wt', encoding='utf-8', compresslevel=9) as fh:
    for r in rows:
        fh.write(json.dumps(r, separators=(',', ':'), ensure_ascii=False, default=int) + '\n')
json.dump({'rows': len(rows), 'stats': {f'{a}|{b}': n for (a, b), n in stats.items()}, 'cons': cons_stats, 'cons_by_source': cons_by_source,
           'cons_by_feature': cons_by_feature, 'dropped': dropped, 'ff_stats': ff_stats, 'ff_by_kind': ff_by_kind, 'ff_flags': ff_flags,
           'ff_genes': {k: {kk: vv for kk, vv in v.items() if kk in ('protein', 'orthology', 'pident')} for k, v in FF.items()},
           'fin_genes': sorted(fin_syms), 'motif_rule': MOTIF_RULE},
          open(f'{C}/work/build_stats.json', 'w'), indent=1, default=list)
print('wrote', len(rows))
