"""Build omics/transcriptomic/annotations.jsonl.gz (offline; reads the caches).

Run: python -I omics/transcriptomic/scripts/build.py   (from the repo root)
Raw inputs: C:/Temp/omics-cache/transcriptomic/** (fetched by this thread) and C:/Temp/genotype/raw/**
(ZFIN wild-type expression, ZFA, stages, and Bgee advanced files already fetched by the genotype thread; reused,
not re-downloaded). Writes annotations.jsonl.gz, MANIFEST.json and concordance.json next to this folder.
"""
import csv, gzip, hashlib, json, math, os, re, sys, collections, datetime

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(REPO, 'omics', 'transcriptomic')
C = 'C:/Temp/omics-cache/transcriptomic'
G = 'C:/Temp/genotype/raw'
TODAY = '2026-11-01'
csv.field_size_limit(10**8)

# ---------------------------------------------------------------- universe
genes = json.load(open(os.path.join(REPO, 'omics', 'genes.json'), encoding='utf-8'))['genes']
by_zfin, by_ens, by_sym = {}, {}, {}
for g in genes:
    gid = {'symbol': g['symbol'], 'zfin_id': g['zfin_id'], 'ensembl_gene': g.get('ensembl_gene'), 'uniprot': g.get('uniprot')}
    by_zfin[g['zfin_id']] = gid
    if g.get('ensembl_gene'):
        by_ens[g['ensembl_gene']] = gid
    by_sym[g['symbol']] = gid
print('universe', len(by_zfin), 'with ensembl', len(by_ens))

# ---------------------------------------------------------------- ontology (ZFA)
zfa_name, zfa_par = {}, collections.defaultdict(set)
cur = None
for line in open(f'{G}/zfa.obo', encoding='utf-8'):
    line = line.rstrip('\n')
    if line == '[Term]':
        cur = None
    elif line.startswith('id: ZFA:'):
        cur = line[4:]
    elif cur and line.startswith('name: '):
        zfa_name[cur] = line[6:]
    elif cur and line.startswith('is_a: ZFA:'):
        zfa_par[cur].add(line.split()[1])
    elif cur and line.startswith('relationship: part_of ZFA:'):
        zfa_par[cur].add(line.split()[2])
    elif line.startswith('[Typedef]'):
        cur = None

anc_cache = {}
def ancestors(t):
    if t in anc_cache:
        return anc_cache[t]
    seen, stack = {t}, [t]
    while stack:
        for p in zfa_par.get(stack.pop(), ()):
            if p not in seen:
                seen.add(p); stack.append(p)
    anc_cache[t] = seen
    return seen

u2z, z2u = {}, {}
for line in open(f'{C}/ont/uberon_zfa_xrefs.tsv', encoding='utf-8'):
    m = re.match(r'<http://purl.obolibrary.org/obo/UBERON_(\d+)>\t"(ZFA:\d+)"', line)
    if m:
        u, z = 'UBERON:' + m.group(1), m.group(2)
        u2z.setdefault(u, set()).add(z)
        z2u.setdefault(z, u)
u2z1 = {u: sorted(zs)[0] for u, zs in u2z.items() if len(zs) == 1}  # only unambiguous crosswalks

def anat_zfa(z, label=None):
    o = {'id': z, 'label': zfa_name.get(z, label)}
    if z in z2u:
        o['uberon'] = z2u[z]
    return o

def anat_any(aid, label):
    """Bgee anatomy id -> (anatomy obj, cell_type obj). ZFA via Uberon hasDbXref only, never by name."""
    if aid.startswith('CL:'):
        return None, {'id': aid, 'label': label}
    if aid.startswith('ZFA:'):
        return anat_zfa(aid, label), None
    if aid in u2z1:
        o = anat_zfa(u2z1[aid], label); o['uberon'] = aid
        return o, None
    return {'id': aid, 'label': label}, None

PRIORITY = {  # studio anatomy (dashboard/public/blueprint3d/model manifests); term + is_a/part_of descendants
    'pectoral fin': ['ZFA:0001161', 'ZFA:0000141', 'ZFA:0005317'],
    'fin fold': ['ZFA:0000040', 'ZFA:0005317'],
    'gill': ['ZFA:0000354'],
    'heart': ['ZFA:0000114'],
    'muscle': ['ZFA:0000548', 'ZFA:0005277'],
    'swim bladder': ['ZFA:0000076'],
    'skeleton': ['ZFA:0000434'],
    'skin': ['ZFA:0000368', 'ZFA:0000105', 'ZFA:0001119'],
}
# Uberon terms Bgee uses that have no ZFA xref (e.g. muscle tissue, zone of skin): ancestors among the priority roots'
# Uberon xrefs, from Ubergraph (rdfs:subClassOf or part_of, materialised). C:/Temp/omics-cache/transcriptomic/ont/uberon_priority.json
UPRI = json.load(open(f'{C}/ont/uberon_priority.json', encoding='utf-8'))
U2P = {u: set(v) for u, v in UPRI['uberon_to_priority'].items()}
for k, us in UPRI['priority_uberon_roots'].items():
    for u in us:
        U2P.setdefault(u, set()).add(k)
# ZFA:0000354 'gill' is xref'd to UBERON:0011150; Bgee's teleost gill samples use UBERON:0000206 'pharyngeal gill' (and 0002535 'gill').
for u in ('UBERON:0000206', 'UBERON:0002535'):
    U2P.setdefault(u, set()).add('gill')
def priority_of(anat):
    if not anat:
        return []
    z = anat['id'] if anat['id'].startswith('ZFA:') else None
    if not z:
        u = anat.get('uberon') or anat['id']
        return sorted(U2P.get(u, ()))
    a = ancestors(z)
    return [k for k, roots in PRIORITY.items() if a & set(roots)]

# ---------------------------------------------------------------- stages
zfs_by_name, zfs_by_zdb = {}, {}
for row in csv.reader(open(f'{G}/stage_ontology.txt', encoding='utf-8'), delimiter='\t'):
    if len(row) >= 3:
        zfs_by_name[row[2]] = row[1]
def stage(name):
    if not name:
        return None
    return {'id': zfs_by_name[name], 'label': name} if name in zfs_by_name else None

rows = []
def emit(gene, species, feature, value, unit, anatomy, stg, cell, cond, src, kind, evidence, **extra):
    r = {'gene': gene, 'species': species, 'layer': 'transcriptomic', 'feature': feature, 'value': value, 'unit': unit,
         'context': {'anatomy': anatomy, 'stage': stg, 'cell_type': cell, 'condition': cond},
         'source': src, 'kind': kind, 'evidence': evidence, 'concordance': None}
    r.update(extra)
    rows.append(r)

# calls[source][gene_zfin] = {'pos': set(priority), 'neg': set(priority)}; used for concordance
calls = collections.defaultdict(lambda: collections.defaultdict(lambda: {'pos': set(), 'neg': set(), 'any': False}))
def mark(srcname, z, anat, positive=True):
    c = calls[srcname][z]; c['any'] = True
    for p in priority_of(anat):
        c['pos' if positive else 'neg'].add(p)

# ================================================================ 1. ZFIN wild-type expression
ZFIN_SRC = lambda pub: {'db': 'ZFIN', 'release_or_date': '2026-10-31 (download)', 'url': 'https://zfin.org/downloads/wildtype-expression_fish.txt',
                        'accession': pub, 'licence': 'CC BY 4.0'}
MMO = {}
agg = collections.OrderedDict()
for row in csv.reader(open(f'{G}/wildtype-expression_fish.txt', encoding='utf-8'), delimiter='\t'):
    if len(row) < 12 or row[0] not in by_zfin:
        continue
    zid, sup, supn, sub, subn, st0, st1, assay, mmo, pub = row[0], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11]
    if not sup.startswith('ZFA:'):
        continue
    k = (zid, sup, sub, st0, st1, assay)
    a = agg.setdefault(k, {'pubs': [], 'mmo': mmo, 'supn': supn, 'subn': subn})
    if pub not in a['pubs']:
        a['pubs'].append(pub)
for (zid, sup, sub, st0, st1, assay), a in agg.items():
    anat = anat_zfa(sup, a['supn'])
    extra = {'n_pubs': len(a['pubs']), 'pubs': a['pubs'][:5], 'stage_end': stage(st1) or ({'id': None, 'label': st1} if st1 else None)}
    if sub:
        extra['substructure'] = {'id': sub, 'label': a['subn']}
    emit(by_zfin[zid], 'Danio rerio', 'expressed_in', anat['label'], None, anat, stage(st0), None, 'wild type, standard',
         ZFIN_SRC(a['pubs'][0]), 'curated', f"{a['mmo']} {assay}".strip(), **extra)
    mark('ZFIN', zid, anat)
print('ZFIN rows', len(rows))

# ================================================================ 2. Bgee (zebrafish; medaka and Astyanax via OMA orthologs)
def bgee_rows(path, species, dbname, ens2zf, url, taxon):
    n0 = len(rows)
    with gzip.open(path, 'rt', encoding='utf-8') as fh:
        rd = csv.reader(fh, delimiter='\t'); hdr = next(rd)
        ix = {h.strip('"'): i for i, h in enumerate(hdr)}
        dts = ['Affymetrix', 'EST', 'in situ hybridization', 'RNA-Seq', 'single-cell RNA-Seq']
        for row in rd:
            gid = row[0]
            zf = ens2zf(gid)
            if not zf:
                continue
            if row[ix['Self observation count']] in ('0', ''):
                continue  # keep only calls observed in that very structure (Bgee propagation excluded)
            call = row[ix['Expression']]
            if call not in ('present', 'absent'):
                continue
            q = row[ix['Call quality']]
            aid, alab = row[ix['Anatomical entity ID']], row[ix['Anatomical entity name']].strip('"')
            anat, cell = anat_any(aid, alab)
            types = [d for d in dts if row[ix[f'{d} expression']] == call]
            score = row[ix['Expression score']]
            extra = {'call_quality': q, 'fdr': float(row[ix['FDR']]) if row[ix['FDR']] not in ('NA', '') else None,
                     'score': float(score) if score not in ('NA', '') else None, 'data_types': types,
                     'n_self_observations': int(row[ix['Self observation count']])}
            for zg, orth in zf:
                if orth:
                    extra = dict(extra, ortholog_gene={'species': species, 'ensembl_gene': gid, 'gene_name': row[1].strip('"'),
                                                       'method': 'OMA orthologs (Bgee homologous_genes, 2023)', 'n_zebrafish_orthologs': orth})
                emit(zg, species, 'expressed_in' if call == 'present' else 'not_expressed_in', alab, None, anat, None, cell,
                     'all stages, sexes and strains pooled (Bgee anatomy-level call)',
                     {'db': dbname, 'release_or_date': 'Bgee 15.2', 'url': url, 'accession': f'{gid}|{aid}', 'licence': 'CC0 1.0'},
                     'measured', ';'.join(types) or 'Bgee call', **extra)
                mark(f'{dbname}:{taxon}', zg['zfin_id'], anat or None, call == 'present')
                if taxon == 'Dr' and [t for t in types if t != 'in situ hybridization']:
                    # Bgee imports ZFIN in situ data, so ZFIN vs Bgee is not independent; this key keeps only RNA-seq/Affy/EST/scRNA-backed calls
                    mark('Bgee:Dr:non-ISH', zg['zfin_id'], anat or None, call == 'present')
    print(species, 'rows', len(rows) - n0)

BG = 'https://www.bgee.org/ftp/bgee_v15_2/download/calls/expr_calls/'
bgee_rows(f'{G}/Danio_rerio_expr_advanced.tsv.gz', 'Danio rerio', 'Bgee',
          lambda e: [(by_ens[e], None)] if e in by_ens else None, BG + 'Danio_rerio_expr_advanced.tsv.gz', 'Dr')

def oma(path):
    m = collections.defaultdict(set)
    for row in csv.DictReader(open(path, encoding='utf-8')):
        m[row['gene2']].add(row['gene1'])
    return m
for sp, taxon, fn, ofn in [('Oryzias latipes', 'Ol', f'{G}/Oryzias_latipes_expr_advanced.tsv.gz', f'{C}/bgee/orthologs_7955-8090.csv'),
                           ('Astyanax mexicanus', 'Am', f'{C}/bgee/Astyanax_mexicanus_expr_advanced.tsv.gz', f'{C}/bgee/orthologs_7955-7994.csv')]:
    om = oma(ofn)
    def e2z(e, om=om):
        zs = [by_ens[z] for z in om.get(e, ()) if z in by_ens]
        return [(z, len(om[e])) for z in zs] or None
    bgee_rows(fn, sp, 'Bgee', e2z, BG + os.path.basename(fn), taxon)

# ================================================================ 3. Expression Atlas
GXA = 'https://ftp.ebi.ac.uk/pub/databases/microarray/data/atlas/experiments/'
lab = dict(re.findall(r'assay_group id="(g\d+)" label="([^"]+)"', open(f'{C}/gxa/E-ERAD-475-configuration.xml', encoding='utf-8').read()))
GXA2ZFS = {'zygote': 'Zygote:1-cell', 'cleavage 2-cell': 'Cleavage:2-cell', 'blastula 128-cell': 'Blastula:128-cell',
           'blastula 1k-cell': 'Blastula:1k-cell', 'blastula dome': 'Blastula:Dome', 'gastrula 50%-epiboly': 'Gastrula:50%-epiboly',
           'gastrula shield': 'Gastrula:Shield', 'gastrula 75%-epiboly': 'Gastrula:75%-epiboly', 'segmentation 1-4 somites': 'Segmentation:1-4 somites',
           'segmentation 14-19 somites': 'Segmentation:14-19 somites', 'segmentation 20-25 somites': 'Segmentation:20-25 somites',
           'pharyngula prim-5': 'Pharyngula:Prim-5', 'pharyngula prim-15': 'Pharyngula:Prim-15', 'pharyngula prim-25': 'Pharyngula:Prim-25',
           'hatching long-pec': 'Hatching:Long-pec', 'larval protruding mouth': 'Larval:Protruding-mouth', 'larval day 4': 'Larval:Day 4',
           'larval day 5': 'Larval:Day 5'}
n0 = len(rows); whole = anat_zfa('ZFA:0001094')
with open(f'{C}/gxa/E-ERAD-475-tpms.tsv', encoding='utf-8') as fh:
    rd = csv.reader(fh, delimiter='\t'); hdr = next(rd)
    while hdr[0].startswith('#'):
        hdr = next(rd)
    for row in rd:
        if row[0] not in by_ens:
            continue
        for h, v in zip(hdr[2:], row[2:]):
            if not v:
                continue
            q = [float(x) for x in v.split(',')]
            med = q[2] if len(q) == 5 else q[0]
            if med < 1:
                continue  # below 1 TPM not emitted (absence of a row = not recorded)
            st = stage(GXA2ZFS.get(lab[h], '')) or {'id': 'EFO:unmapped', 'label': lab[h]}
            emit(by_ens[row[0]], 'Danio rerio', 'expression_level', med, 'TPM', whole, st, None, 'wild type (Hubrecht Longfin), whole embryo/larva',
                 {'db': 'Expression Atlas', 'release_or_date': 'retrieved 2026-10-31', 'url': GXA + 'E-ERAD-475/E-ERAD-475-tpms.tsv',
                  'accession': 'E-ERAD-475', 'licence': 'CC BY 4.0'}, 'measured', 'RNA-seq',
                 tpm_quartiles=q, n_samples=5, pmid='28974578')
        calls['Expression Atlas'][by_ens[row[0]]['zfin_id']]['any'] = True
print('GXA baseline rows', len(rows) - n0)

n0 = len(rows); heart = anat_zfa('ZFA:0000114')
contr = dict(re.findall(r'<contrast id="(g\d+_g\d+)">\s*<name>([^<]+)</name>', open(f'{C}/gxa/E-GEOD-17993-configuration.xml', encoding='utf-8').read()))
with open(f'{C}/gxa/E-GEOD-17993_A-AFFY-38-analytics.tsv', encoding='utf-8') as fh:
    rd = csv.reader(fh, delimiter='\t'); hdr = next(rd)
    for row in rd:
        if row[0] not in by_ens:
            continue
        for cid, nm in contr.items():
            p, t, l = row[hdr.index(f'{cid}.p-value')], row[hdr.index(f'{cid}.t-statistic')], row[hdr.index(f'{cid}.log2foldchange')]
            if p in ('NA', '') or l in ('NA', ''):
                continue
            p, l = float(p), float(l)
            if p < 0.05 and abs(l) >= 1:
                emit(by_ens[row[0]], 'Danio rerio', 'differential_expression', l, 'log2FC', heart, {'id': 'ZFS:0000044', 'label': 'Adult'}, None,
                     nm.replace("'", ''), {'db': 'Expression Atlas', 'release_or_date': 'retrieved 2026-10-31',
                     'url': GXA + 'E-GEOD-17993/E-GEOD-17993_A-AFFY-38-analytics.tsv', 'accession': 'E-GEOD-17993', 'licence': 'CC BY 4.0'},
                     'measured', 'Affymetrix microarray (A-AFFY-38), Atlas limma analytics', p_adj=p, direction='up' if l > 0 else 'down',
                     design_element=row[2])
print('GXA heart-regeneration DE rows', len(rows) - n0)

# ================================================================ 4. Single cell: Daniocell (Sur et al. 2023)
n0 = len(rows)
DC = {'db': 'Daniocell', 'release_or_date': 'Daniocell 2023 (cluster_annotations.csv, retrieved 2026-10-31)',
      'url': 'https://daniocell.nichd.nih.gov/assets/obj-download/cluster_annotations.csv', 'licence': 'US Government work (NIH), public domain; cite Sur et al. 2023 Dev Cell, PMID 37995681'}
for c in csv.DictReader(open(f'{C}/sc/daniocell_cluster_annotations.csv', encoding='utf-8-sig')):
    if 'doublet' in c['identity.super'].lower():
        continue
    zs = [z for z in c['zfin'].split(',') if z.startswith('ZFA:')]
    anat = anat_zfa(zs[-1]) if zs else None
    cell = {'id': f"daniocell:{c['clust']}", 'label': ' '.join(x for x in [c['identity.super'], c['identity.sub']] if x)}
    if len(zs) > 1:
        cell['zfa'] = zs[0]
    tests = collections.OrderedDict()
    for k in ['ident.gene.1', 'ident.gene.2', 'ident.gene.3']:
        if c[k]: tests.setdefault(c[k], []).append('identity gene (curated by authors)')
    for k in [f'roc.{i}' for i in range(1, 7)]:
        if c[k]: tests.setdefault(c[k], []).append('ROC marker')
    for k in [f'wilcox.{i}' for i in range(1, 7)]:
        if c[k]: tests.setdefault(c[k], []).append('Wilcoxon marker')
    for sym, how in tests.items():
        g = by_sym.get(sym)
        if not g:
            continue
        emit(g, 'Danio rerio', 'cell_type_marker', cell['label'], None, anat, None, cell, 'wild type, 3-120 hpf time course (Daniocell)',
             dict(DC, accession=c['clust']), 'measured', 'scRNA-seq marker (' + ', '.join(sorted(set(how))) + ')',
             tissue=c['tissue'] or c['tissue.subsets'], zfa_all=zs, stage_text=c['identity.sub'] or None,
             technical_flag=('technical' in c['identity.sub'].lower()))
        mark('Daniocell', g['zfin_id'], anat)
print('Daniocell rows', len(rows) - n0)

# ---- Single cell, fin-specific: Expression Atlas Single Cell E-GEOD-158851 (larval caudal fin, cut and uncut, 24 hpa)
n0 = len(rows); caudal = anat_zfa('ZFA:0001058')
with open(f'{C}/sc/E-GEOD-158851.marker_genes_16.tsv', encoding='utf-8') as fh:
    for r in csv.DictReader(fh, delimiter='\t'):
        if r['genes'] not in by_ens:
            continue
        pa, lf = float(r['pvals_adj']), float(r['logfoldchanges'])
        if pa >= 0.01 or lf < 1:
            continue
        emit(by_ens[r['genes']], 'Danio rerio', 'cell_type_marker', f"unsupervised cluster {r['cluster']} of 16", None, caudal,
             {'id': 'ZFS:0000037', 'label': 'Larval:Protruding-mouth'},
             {'id': f"scxa:E-GEOD-158851:k16:c{r['cluster']}", 'label': f"unsupervised cluster {r['cluster']} (k=16; no author cell-type label in Atlas)"},
             'larval caudal fin, amputated (24 hpa) and uncut pooled; 3 dpf',
             {'db': 'Single Cell Expression Atlas', 'release_or_date': 'retrieved 2026-10-31',
              'url': 'https://ftp.ebi.ac.uk/pub/databases/microarray/data/atlas/sc_experiments/E-GEOD-158851/E-GEOD-158851.marker_genes_16.tsv',
              'accession': 'E-GEOD-158851', 'licence': 'CC BY 4.0'}, 'measured', 'scRNA-seq marker (Wilcoxon vs rest, Atlas pipeline)',
             log2fc=lf, p_adj=pa, rank=int(r['rank']), pmid='34732706')
        mark('SCEA E-GEOD-158851', by_ens[r['genes']]['zfin_id'], caudal)
print('SCEA fin rows', len(rows) - n0)

# ================================================================ 5. Fin-specific bulk: GEO GSE217486 (pectoral fin, 48 hpf)
n0 = len(rows); pec = anat_zfa('ZFA:0001161'); lp = stage('Hatching:Long-pec')
GEO = {'db': 'GEO', 'release_or_date': 'GSE217486 (public 2023-04-13), retrieved 2026-10-31',
       'url': 'https://ftp.ncbi.nlm.nih.gov/geo/series/GSE217nnn/GSE217486/suppl/GSE217486_FeatureCountsDEseq2.txt.gz',
       'accession': 'GSE217486', 'licence': 'NCBI GEO: no restrictions on use (submitter data; cite PMID 37083955)'}
with gzip.open(f'{C}/fin/GSE217486_FeatureCountsDEseq2.txt.gz', 'rt', encoding='utf-8') as fh:
    for r in csv.DictReader(fh, delimiter='\t'):
        g = by_ens.get(r['Ensembl'])
        if not g:
            continue
        calls['GEO GSE217486'][g['zfin_id']]['any'] = True  # gene measured in this table (detected or not)
        wt = [int(float(r['T1_WT_rawCounts'])), int(float(r['T2_WT_rawCounts']))]
        wtl = [float(r['T1_WT_logFC']), float(r['T2_WT_logFC'])]
        if min(wt) >= 10:
            emit(g, 'Danio rerio', 'expressed_in', 'pectoral fin', None, pec, lp, None,
                 'wild type Tg(Mmu.Prx1:EGFP), isolated pectoral fins, 48 hpf', GEO, 'measured', 'RNA-seq (bulk)',
                 value_log2_norm=wtl, raw_counts_wt=wt, n_samples=2, detection_rule='raw count >= 10 in both WT replicates', pmid='37083955')
            mark('GEO GSE217486', g['zfin_id'], pec)
        if r['padj'] not in ('NA', '') and float(r['padj']) < 0.05:
            l = float(r['log2FoldChange'])
            emit(g, 'Danio rerio', 'differential_expression', l, 'log2FC', pec, lp, None,
                 'prdm1a m805/m805 vs wild type sibling, isolated pectoral fins, 48 hpf', GEO, 'measured', 'RNA-seq, DESeq2 (authors\' table)',
                 p_adj=float(r['padj']), base_mean=float(r['baseMean']), direction='up' if l > 0 else 'down', n_samples=2, pmid='37083955')
print('GEO pectoral fin rows', len(rows) - n0)

# ================================================================ write
for r in rows:  # bird guard (none expected: no Aves source was fetched)
    assert not re.search(r'\b(Aves|Gallus|Taeniopygia|chicken|bird)\b', r['species'] + json.dumps(r.get('ortholog_gene', '')), re.I)
os.makedirs(OUT, exist_ok=True)
ann = os.path.join(OUT, 'annotations.jsonl.gz')
with gzip.open(ann, 'wt', encoding='utf-8', compresslevel=9) as fh:
    for r in rows:
        fh.write(json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n')

# ---------------------------------------------------------------- manifest
by_source = collections.defaultdict(lambda: {'rows': 0, 'genes': set(), 'features': collections.Counter()})
by_feature = collections.Counter(); gcov = set(); prio_cov = collections.defaultdict(lambda: collections.defaultdict(set))
for r in rows:
    key = r['source']['db'] if r['species'] == 'Danio rerio' else f"{r['source']['db']} ({r['species']})"
    if r['source']['db'] == 'Expression Atlas':
        key = f"Expression Atlas {r['source']['accession']}"
    b = by_source[key]; b['rows'] += 1; b['genes'].add(r['gene']['zfin_id']); b['features'][r['feature']] += 1
    by_feature[r['feature']] += 1; gcov.add(r['gene']['zfin_id'])
    if r['feature'] in ('expressed_in', 'cell_type_marker'):
        for p in priority_of(r['context']['anatomy']):
            prio_cov[p][key].add(r['gene']['zfin_id'])

# ---------------------------------------------------------------- concordance
SRC_ORDER = ['ZFIN', 'Bgee:Dr', 'Bgee:Dr:non-ISH', 'Daniocell', 'GEO GSE217486', 'Bgee:Ol', 'Bgee:Am']
conc = {'definition': ('For each studio structure S (term plus its ZFA is_a/part_of descendants) and each pair of sources A,B: '
                       'genes that A records as expressed in S AND that B has any call for (any anatomy). Of those, '
                       'B_pos = B also records expression somewhere in S; B_neg = B asserts absence in S only (Bgee absent calls) '
                       'with no presence; B_silent = B has calls for the gene but none in S (not recorded, not absence). '
                       'agree_rate = B_pos / assessed. baseline_rate = the same B_pos rate among genes A has calls for but NOT in S '
                       '(agreement means something only when agree_rate clearly exceeds baseline_rate). '
                       'Bgee:Dr:non-ISH counts only Bgee calls backed by RNA-seq/Affymetrix/EST/scRNA, because Bgee imports ZFIN in situ data '
                       '(ZFIN vs Bgee:Dr is therefore not independent). Bgee calls are restricted to structures observed directly (no propagation). '
                       'Medaka/Astyanax rows reach zebrafish genes through OMA orthologs.'), 'by_structure': {}}
for S in PRIORITY:
    out = {}
    for A in SRC_ORDER:
        for B in SRC_ORDER:
            if A == B:
                continue
            pos_a = {z for z, c in calls[A].items() if S in c['pos']}
            assessed = [z for z in pos_a if calls[B].get(z, {}).get('any') if z in calls[B]]
            if not assessed:
                continue
            bp = sum(1 for z in assessed if S in calls[B][z]['pos'])
            bn = sum(1 for z in assessed if S not in calls[B][z]['pos'] and S in calls[B][z]['neg'])
            base = [z for z, c in calls[A].items() if c['any'] and S not in c['pos'] and z in calls[B] and calls[B][z]['any']]
            bb = sum(1 for z in base if S in calls[B][z]['pos'])
            out[f'{A} -> {B}'] = {'A_pos': len(pos_a), 'assessed_by_B': len(assessed), 'B_pos': bp, 'B_neg': bn,
                                  'B_silent': len(assessed) - bp - bn, 'agree_rate': round(bp / len(assessed), 3),
                                  'baseline_rate': round(bb / len(base), 3) if base else None, 'baseline_n': len(base)}
    multi = collections.Counter()
    for z in by_zfin:
        n = sum(1 for A in SRC_ORDER if A != 'Bgee:Dr:non-ISH' and z in calls[A] and S in calls[A][z]['pos'])
        if n: multi[n] += 1
    out['genes_by_n_sources_positive'] = dict(sorted(multi.items()))
    conc['by_structure'][S] = out

json.dump(conc, open(os.path.join(OUT, 'concordance.json'), 'w', encoding='utf-8'), indent=1)

def sha(p):
    h = hashlib.sha256(); h.update(open(p, 'rb').read()); return h.hexdigest()
def raw_entry(url, p):
    return {'url': url, 'date': '2026-10-31', 'local': p, 'bytes': os.path.getsize(p), 'sha256': sha(p)}
retr = [raw_entry('https://zfin.org/downloads/wildtype-expression_fish.txt', f'{G}/wildtype-expression_fish.txt'),
        raw_entry(BG + 'Danio_rerio_expr_advanced.tsv.gz', f'{G}/Danio_rerio_expr_advanced.tsv.gz'),
        raw_entry(BG + 'Oryzias_latipes_expr_advanced.tsv.gz', f'{G}/Oryzias_latipes_expr_advanced.tsv.gz'),
        raw_entry(BG + 'Astyanax_mexicanus_expr_advanced.tsv.gz', f'{C}/bgee/Astyanax_mexicanus_expr_advanced.tsv.gz'),
        raw_entry('https://www.bgee.org/ftp/current/homologous_genes/OMA_orthologs.zip', f'{C}/bgee/OMA_orthologs.zip'),
        raw_entry('https://ubergraph.apps.renci.org/sparql (UBERON hasDbXref ZFA)', f'{C}/ont/uberon_zfa_xrefs.tsv'),
        raw_entry('https://ubergraph.apps.renci.org/sparql (Bgee Uberon terms -> priority roots)', f'{C}/ont/uberon_priority.json'),
        raw_entry(GXA + 'E-ERAD-475/E-ERAD-475-tpms.tsv', f'{C}/gxa/E-ERAD-475-tpms.tsv'),
        raw_entry(GXA + 'E-GEOD-17993/E-GEOD-17993_A-AFFY-38-analytics.tsv', f'{C}/gxa/E-GEOD-17993_A-AFFY-38-analytics.tsv'),
        raw_entry(DC['url'], f'{C}/sc/daniocell_cluster_annotations.csv'),
        raw_entry('https://ftp.ebi.ac.uk/pub/databases/microarray/data/atlas/sc_experiments/E-GEOD-158851/E-GEOD-158851.marker_genes_16.tsv', f'{C}/sc/E-GEOD-158851.marker_genes_16.tsv'),
        raw_entry(GEO['url'], f'{C}/fin/GSE217486_FeatureCountsDEseq2.txt.gz')]
man = {'layer': 'transcriptomic', 'built': TODAY, 'tool': 'omics/transcriptomic/scripts/build.py', 'rows': len(rows),
       'genes_covered': len(gcov), 'universe': len(by_zfin),
       'by_source': {k: {'rows': v['rows'], 'genes': len(v['genes']), 'features': dict(v['features'])} for k, v in sorted(by_source.items())},
       'by_feature': dict(by_feature),
       'priority_anatomy_genes': {p: {k: len(v) for k, v in sorted(d.items())} | {'any_source': len(set().union(*d.values()))} for p, d in prio_cov.items()},
       'files': {}, 'retrievals': retr, 'status': 'done',
       'notes': ['No Aves data fetched or emitted.', 'No flying-fish (Exocoetidae) transcriptome with processed data exists (see SOURCES.md).',
                 'Absence of a row = not recorded; only Bgee absent calls (not_expressed_in) assert absence.']}
for fn in ['annotations.jsonl.gz', 'concordance.json', 'SOURCES.md', 'scripts/build.py']:
    p = os.path.join(OUT, fn); man['files'][fn] = {'bytes': os.path.getsize(p), 'sha256': sha(p)}
json.dump(man, open(os.path.join(OUT, 'MANIFEST.json'), 'w', encoding='utf-8'), indent=1)
print(json.dumps({k: man[k] for k in ['rows', 'genes_covered', 'by_source', 'priority_anatomy_genes']}, indent=1))
print('bytes', os.path.getsize(ann))
