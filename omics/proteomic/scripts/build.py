"""Build omics/proteomic/annotations.jsonl.gz + MANIFEST.json from cached downloads (see SOURCES.md).
Sources: UniProt, InterPro (+Pfam), AlphaFold DB, PDB (RCSB), PaxDb (MS abundance; datasets incl. PRIDE PXDs), STRING, IntAct.
No Aves rows: only Danio rerio (taxid 7955) records plus UniProt Exocoetidae (flying fish) entries."""
import csv, gzip, json, os, re, sys, glob, hashlib, time, collections
sys.path.insert(0, os.path.dirname(__file__))
from common import *
OUT = os.path.join(ROOT, 'omics', 'proteomic')
AVES = re.compile(r'\b(aves|gallus|chicken|taeniopygia|zebra ?finch|meleagris|turkey|anas\b|duck|columba|pigeon|coturnix|quail|ficedula|flycatcher|parus|serinus|canary|melopsittacus|budgerigar|aquila|eagle|falco|strigops|ostrich|struthio|dromaius|emu|bird|avian)\b', re.I)
TODAY = time.strftime('%Y-%m-%d', time.gmtime())
UNIPROT_REL = '2026_03 (02-Sep-2026)'
CTX0 = {'anatomy': None, 'stage': None, 'cell_type': None, 'condition': None}
LIC = {'UniProt': 'CC BY 4.0', 'InterPro': 'CC0 1.0', 'Pfam': 'CC0 1.0', 'AlphaFold DB': 'CC BY 4.0', 'PDB': 'CC0 1.0',
       'PeptideAtlas': 'no explicit licence stated (open access; cite Desiere et al. 2006)', 'PaxDb': 'CC BY 4.0 (PaxDb; underlying datasets per their PRIDE/PeptideAtlas/GPM terms)', 'STRING': 'CC BY 4.0', 'IntAct': 'CC BY 4.0'}
rows_out = []
stats = collections.defaultdict(lambda: {'rows': 0, 'genes': set()})
feat = collections.Counter()


def emit(gobj, feature, value, unit, kind, evidence, db, url, acc, release, context=None, species='Danio rerio', **extra):
    if value is None or value == '' or value == []:
        return
    r = {'gene': gobj, 'species': species, 'layer': 'proteomic', 'feature': feature, 'value': value, 'unit': unit,
         'context': dict(CTX0, **(context or {})),
         'source': {'db': db, 'release_or_date': release, 'url': url, 'accession': acc, 'licence': LIC.get(db)},
         'kind': kind, 'evidence': evidence, 'concordance': None}
    r.update({k: v for k, v in extra.items() if v is not None})
    rows_out.append(r)
    stats[db]['rows'] += 1
    stats[db]['genes'].add(gobj.get('zfin_id') or gobj['symbol'])
    feat[feature] += 1


genes = load_genes(); up = load_uniprot(); z2 = zfin_to_entries(up); sets = priority_sets()
acc2gene = {}
for g in genes:
    for r in z2.get(g['zfin_id'], []):
        acc2gene.setdefault(r['Entry'], g)


def gobj(g): return {k: g.get(k) for k in ('symbol', 'zfin_id', 'ensembl_gene', 'uniprot')}
def scrub(t): return ' '.join(s for s in re.split(r'(?<=\.)\s+', t) if not AVES.search(s))
def ecos(s): return re.findall(r'ECO:\d{7}', s)


TOPO = {'Multi-pass membrane protein', 'Single-pass membrane protein', 'Single-pass type I membrane protein', 'Single-pass type II membrane protein',
        'Single-pass type III membrane protein', 'Single-pass type IV membrane protein', 'Peripheral membrane protein', 'Lipid-anchor', 'GPI-anchor',
        'Cytoplasmic side', 'Extracellular side', 'Lumenal side', 'Nucleoplasmic side', 'Intermembrane side', 'Matrix side'}
PE_RANK = {'Evidence at protein level': 1, 'Evidence at transcript level': 2, 'Inferred from homology': 3, 'Predicted': 4, 'Uncertain': 5}


def ft_parse(txt, kw):
    out = []
    for m in re.finditer(kw + r' (<?\d+)\.\.(>?\d+);\s*/note="([^"]*)"(?:;\s*/evidence="([^"]*)")?', txt):
        out.append({'name': m.group(3), 'start': m.group(1), 'end': m.group(2), 'evidence': ((m.group(4) or '').split('|')[0]) or None})
    return out


def subcell(txt):
    txt = re.sub(r'Note=.*?(?=SUBCELLULAR LOCATION:|$)', '', txt)
    out = []
    for part in txt.split('SUBCELLULAR LOCATION:'):
        part = re.sub(r'^\s*\[[^\]]*\]:\s*', '', part)  # isoform prefix
        for loc in re.split(r'\.\s+|\.$|;\s*', part):
            name = re.sub(r'\{[^}]*\}', '', loc).strip(' ;:.')
            if not name or name.startswith('Note'):
                continue
            out.append((name, (ecos(loc) or [None])[0]))
    return out


# ---------- UniProt ----------
pe_best = {}
for g in genes:
    canon, afe = pick_entries(g, z2)
    if not canon:
        continue
    G = gobj(g); acc = canon['Entry']; url = f'https://rest.uniprot.org/uniprotkb/{acc}'
    rev = canon['Reviewed'] == 'reviewed'; kind = 'curated' if rev else 'inferred-electronic'
    ex = {'protein_accession': acc, 'uniprot_reviewed': rev}
    emit(G, 'uniprot_entry_status', 'reviewed (Swiss-Prot)' if rev else 'unreviewed (TrEMBL)', None, kind, None, 'UniProt', url, acc, UNIPROT_REL, **ex)
    emit(G, 'protein_length', int(canon['Length']), 'aa', kind, None, 'UniProt', url, acc, UNIPROT_REL, **ex)
    pe = canon['Protein existence']
    emit(G, 'protein_existence', pe, None, kind, f"PE{PE_RANK.get(pe, '?')}", 'UniProt', url, acc, UNIPROT_REL, **ex)
    best = min(z2[g['zfin_id']], key=lambda r: PE_RANK.get(r['Protein existence'], 9))
    pe_best[g['zfin_id']] = PE_RANK.get(best['Protein existence'], 9)
    if best['Entry'] != acc and PE_RANK.get(best['Protein existence'], 9) < PE_RANK.get(pe, 9):
        k2 = 'curated' if best['Reviewed'] == 'reviewed' else 'inferred-electronic'
        emit(G, 'protein_existence', best['Protein existence'], None, k2, f"PE{PE_RANK[best['Protein existence']]}", 'UniProt',
             f"https://rest.uniprot.org/uniprotkb/{best['Entry']}", best['Entry'], UNIPROT_REL, protein_accession=best['Entry'],
             uniprot_reviewed=best['Reviewed'] == 'reviewed', note="best protein-existence level among this gene's UniProt entries (not the canonical entry)")
    if canon['Annotation']:
        emit(G, 'uniprot_annotation_score', float(canon['Annotation']), 'score (1-5)', kind, None, 'UniProt', url, acc, UNIPROT_REL, **ex)
    fn = scrub(canon['Function [CC]'].replace('FUNCTION: ', '').strip())
    if fn:
        emit(G, 'protein_function', fn[:1800], None, kind, (ecos(fn) or [None])[0], 'UniProt', url, acc, UNIPROT_REL, **ex)
    seen_loc = set()
    for name, eco in subcell(canon['Subcellular location [CC]']):
        if AVES.search(name) or name in seen_loc:
            continue
        seen_loc.add(name)
        emit(G, 'membrane_topology' if name in TOPO else 'subcellular_location', name, None, kind, eco, 'UniProt', url, acc, UNIPROT_REL, **ex)
    for col, f, kw in [('Domain [FT]', 'domain', 'DOMAIN'), ('Region', 'region', 'REGION'), ('Motif', 'motif', 'MOTIF'),
                       ('Zinc finger', 'zinc_finger', 'ZN_FING'), ('Repeat', 'repeat', 'REPEAT')]:
        for d in ft_parse(canon[col], kw):
            emit(G, f, d['name'], None, kind, d['evidence'], 'UniProt', url, acc, UNIPROT_REL, position={'start': d['start'], 'end': d['end']}, **ex)
    for m in re.finditer(r'COILED (\d+)\.\.(\d+)', canon['Coiled coil']):
        emit(G, 'region', 'Coiled coil', None, kind, None, 'UniProt', url, acc, UNIPROT_REL, position={'start': m.group(1), 'end': m.group(2)}, **ex)
    for kwn, kwid in zip(canon['Keywords'].split(';'), canon['Keyword ID'].split('; ')):
        if kwn.strip():
            emit(G, 'uniprot_keyword', kwn.strip(), None, kind, None, 'UniProt', url, acc, UNIPROT_REL, term_id=kwid.strip(), **ex)

# ---------- PDB (experimental structures via UniProt cross-refs + RCSB metadata) ----------
rcj = json.load(open(f'{CACHE}/rcsb_entries.json')); rc = rcj['entries']
for g in genes:
    pdbs = sorted({(p, r['Entry']) for r in z2.get(g['zfin_id'], []) for p in r['PDB'].strip(';').split(';') if p})
    if not pdbs:
        continue
    ents = []
    for p, a in pdbs:
        e = rc.get(p, {})
        res = (e.get('rcsb_entry_info') or {}).get('resolution_combined')
        ents.append({'pdb': p, 'uniprot': a, 'method': ', '.join(x['method'] for x in (e.get('exptl') or [])) or None,
                     'resolution_A': res[0] if res else None,
                     'released': ((e.get('rcsb_accession_info') or {}).get('initial_release_date') or '')[:10] or None})
    best = min(ents, key=lambda x: x['resolution_A'] or 99)
    emit(gobj(g), 'experimental_structure', {'n_entries': len(ents), 'best': best['pdb'], 'best_method': best['method'], 'best_resolution_A': best['resolution_A']},
         None, 'measured', best['method'], 'PDB', f"https://www.rcsb.org/structure/{best['pdb']}", best['pdb'], 'RCSB Data API ' + rcj['retrieved'][:10],
         entries=ents[:30], note="zebrafish protein chains mapped to this gene's UniProt entries (UniProt PDB cross-references); metadata from RCSB")

# ---------- AlphaFold DB ----------
for g in genes:
    canon, afe = pick_entries(g, z2)
    if not afe:
        continue
    p = f"{CACHE}/alphafold/{afe['Entry']}.json"
    if not os.path.exists(p):
        continue
    d = json.load(open(p))
    if d['status'] != 200 or not d['body']:
        continue
    m = d['body'][0]
    f70 = round((m.get('fractionPlddtConfident') or 0) + (m.get('fractionPlddtVeryHigh') or 0), 3)
    emit(gobj(g), 'predicted_structure', {'model': m.get('modelEntityId'), 'mean_plddt': m.get('globalMetricValue'), 'fraction_plddt_gt70': f70,
                                          'fraction_plddt_gt90': m.get('fractionPlddtVeryHigh'), 'fraction_plddt_lt50': m.get('fractionPlddtVeryLow'),
                                          'version': m.get('latestVersion')},
         None, 'predicted', m.get('toolUsed'), 'AlphaFold DB', f"https://alphafold.ebi.ac.uk/entry/{afe['Entry']}", m.get('modelEntityId'), 'AFDB API ' + d['retrieved'][:10],
         protein_accession=afe['Entry'], score=m.get('globalMetricValue'),
         note=('model is for a different UniProt entry of this gene than the canonical one' if canon and afe['Entry'] != canon['Entry'] else None))

# ---------- InterPro + Pfam ----------
iplist = {l.split('\t')[0]: l.rstrip('\n').split('\t') for l in open(f'{CACHE}/interpro_entry.list', encoding='utf8') if l.startswith('IPR')}
ip_api, ip_fallback = set(), set()
TYPEF = {'family': 'protein_family', 'domain': 'domain', 'repeat': 'repeat', 'homologous_superfamily': 'homologous_superfamily', 'site': 'site',
         'active_site': 'site', 'binding_site': 'site', 'conserved_site': 'site', 'ptm': 'site'}
for g in genes:
    canon, _ = pick_entries(g, z2)
    acc = g.get('uniprot') or (canon and canon['Entry'])
    if not acc:
        continue
    p = f'{CACHE}/interpro/{acc}.json'
    d = json.load(open(p)) if os.path.exists(p) else None
    if d and d['status'] == 200 and d['body']:
        ip_api.add(g['zfin_id'])
        for res in d['body']['results']:
            md = res['metadata']; sdb = md['source_database']
            locs = [{'start': f['start'], 'end': f['end']} for pr in res['proteins'] for el in pr['entry_protein_locations'] for f in el['fragments']][:20]
            if sdb == 'interpro':
                pf = sorted((md.get('member_databases') or {}).get('pfam', {}).keys())
                emit(gobj(g), TYPEF.get(md['type'], md['type']), md['name'], None, 'inferred-electronic', 'ECO:0000259', 'InterPro',
                     f"https://www.ebi.ac.uk/interpro/entry/InterPro/{md['accession']}/", md['accession'], 'InterPro 110.0 API ' + d['retrieved'][:10],
                     interpro_type=md['type'], pfam=pf or None, positions=locs, protein_accession=acc)
            elif sdb == 'pfam':
                emit(gobj(g), 'domain' if md['type'] in ('domain', 'repeat') else TYPEF.get(md['type'], md['type']), md['name'], None, 'inferred-electronic',
                     'ECO:0000259', 'Pfam', f"https://www.ebi.ac.uk/interpro/entry/pfam/{md['accession']}/", md['accession'], 'via InterPro 110.0 API ' + d['retrieved'][:10],
                     pfam_type=md['type'], integrated_into=md.get('integrated'), positions=locs, protein_accession=acc)
    elif canon and canon['InterPro']:
        ip_fallback.add(g['zfin_id'])
        for ipr in canon['InterPro'].strip(';').split(';'):
            e = iplist.get(ipr)
            if not e:
                continue
            emit(gobj(g), TYPEF.get(e[1].lower(), e[1].lower()), e[2], None, 'inferred-electronic', 'ECO:0000259', 'InterPro',
                 f"https://www.ebi.ac.uk/interpro/entry/InterPro/{ipr}/", ipr, 'UniProt ' + UNIPROT_REL + ' cross-reference; names from InterPro entry.list',
                 interpro_type=e[1], protein_accession=canon['Entry'],
                 note='InterPro API not reached for this protein (rate-limited); match from the UniProt InterPro cross-reference, no positions')
        for pf in canon['Pfam'].strip(';').split(';'):
            if pf:
                emit(gobj(g), 'domain', pf, None, 'inferred-electronic', 'ECO:0000259', 'Pfam', f"https://www.ebi.ac.uk/interpro/entry/pfam/{pf}/", pf,
                     'UniProt ' + UNIPROT_REL + ' cross-reference', protein_accession=canon['Entry'], note='Pfam id only (name not fetched); from UniProt cross-reference')

# ---------- STRING id -> gene ----------
ens2g = {g['ensembl_gene']: g for g in genes if g.get('ensembl_gene')}
sid2g = {}
for l in gzip.open(f'{CACHE}/string/7955.protein.aliases.v12.0.txt.gz', 'rt', encoding='utf8'):
    p = l.rstrip('\n').split('\t')
    if len(p) == 3 and p[2] == 'Ensembl_gene' and p[1] in ens2g:
        sid2g.setdefault(p[0], ens2g[p[1]])
for r in up:
    for s in r['STRING'].strip(';').split(';'):
        if s and s not in sid2g and r['Entry'] in acc2gene:
            sid2g[s] = acc2gene[r['Entry']]
sname = {}
for l in gzip.open(f'{CACHE}/string/7955.protein.info.v12.0.txt.gz', 'rt', encoding='utf8'):
    p = l.split('\t')
    if p[0].startswith('7955.'):
        sname[p[0]] = p[1]

# ---------- PaxDb ----------
ORG = {'BRAIN': ('ZFA:0000008', 'brain', 'UBERON:0000955'), 'CARDIAC_VENTRICLE': ('ZFA:0000009', 'cardiac ventricle', 'UBERON:0002082'),
       'WHOLE_ORGANISM': ('ZFA:0001094', 'whole organism', None), 'LIVER': ('ZFA:0000123', 'liver', 'UBERON:0002107'),
       'MUSCLE': ('ZFA:0005277', 'skeletal muscle', None), 'SPLEEN': ('ZFA:0000436', 'spleen', 'UBERON:0002106'), 'TESTIS': ('ZFA:0000598', 'testis', 'UBERON:0000473'),
       'EYE': ('ZFA:0000107', 'eye', None), 'HEAD': ('ZFA:0001114', 'head', None), 'HEART': ('ZFA:0000114', 'heart', 'UBERON:0000948'),
       'PANCREAS': ('ZFA:0000140', 'pancreas', None), 'KIDNEY': ('ZFA:0000529', 'kidney', None), 'FEMALE_GONAD': ('ZFA:0000403', 'ovary', None),
       'EMBRYO': ('ZFA:0001094', 'whole organism', None)}
STAGE = {'Embryo48hrs': ('ZFS:0000033', 'Hatching:Long-pec'), 'Embryo120hr': ('ZFS:0000037', 'Larval:Day 5'), 'adult_proteome': ('ZFS:0000044', 'Adult')}
pax_det = collections.defaultdict(lambda: {'datasets': set(), 'organs': set(), 'pride': set()})
pax_meta = {}
for fpath in sorted(glob.glob(f'{CACHE}/paxdb/7955-*.txt')):
    meta = {}; data = []
    for l in open(fpath, encoding='utf8'):
        if l.startswith('#'):
            if ':' in l:
                k, v = l[1:].split(':', 1); meta[k.strip()] = v.strip()
            continue
        data.append(l.rstrip('\n').split('\t'))
    fn = os.path.basename(fpath); integ = meta.get('integrated') == 'true'
    m = re.search(r'PXD\d+', fn); pxd = m.group(0) if m else None
    pax_meta[fn] = {'name': meta.get('name'), 'organ': meta.get('organ'), 'integrated': integ, 'coverage_pct': meta.get('coverage'), 'score': meta.get('score'),
                    'pride': pxd, 'link': meta.get('link'), 'proteins': len(data), 'description': meta.get('description')}
    if integ:
        continue
    o = ORG.get(meta.get('organ'))
    anat = ({'id': o[0], 'label': o[1], **({'uberon': o[2]} if o[2] else {})}) if o else None
    st = next((STAGE[k] for k in STAGE if k in fn), None)
    cond = 'cell line (Z4F zebrafish fibroblast line)' if meta.get('organ') == 'CELL_LINE' else ('embryo' if meta.get('organ') == 'EMBRYO' else None)
    method = (meta.get('description') or '').split(';')[0].replace('abundance based on ', '')
    seen = set()
    for row in data:
        g = sid2g.get(row[1])
        if not g:
            continue
        try:
            ab = float(row[2])
        except Exception:
            continue
        if ab <= 0 or g['zfin_id'] in seen:
            continue
        seen.add(g['zfin_id'])
        dd = pax_det[g['zfin_id']]; dd['datasets'].add(fn); dd['organs'].add(meta.get('organ'))
        if pxd:
            dd['pride'].add(pxd)
        emit(gobj(g), 'protein_abundance', ab, 'ppm', 'measured', 'MS/MS (' + method + ')', 'PaxDb',
             'https://pax-db.org/downloads/latest/datasets/7955/' + fn, meta.get('id'), 'PaxDb v6.1',
             context={'anatomy': anat, 'stage': {'id': st[0], 'label': st[1]} if st else None, 'condition': cond},
             dataset=meta.get('name'), pride_accession=pxd, string_protein=row[1], dataset_coverage_pct=meta.get('coverage'))
for g in genes:
    d = pax_det.get(g['zfin_id'])
    if d:
        emit(gobj(g), 'protein_detected', True, None, 'measured', 'MS/MS', 'PaxDb', 'https://pax-db.org/species/7955', None, 'PaxDb v6.1',
             n_datasets=len(d['datasets']), organs=sorted(d['organs']), pride_accessions=sorted(d['pride']) or None,
             note='abundance > 0 in at least one non-integrated zebrafish PaxDb dataset; peptides shared between paralogues may be assigned to either')

# ---------- PeptideAtlas (UniProt cross-reference = peptides observed in a PeptideAtlas build) ----------
pa_det = set()
for g in genes:
    ents = [r for r in z2.get(g['zfin_id'], []) if r['PeptideAtlas'].strip()]
    if not ents:
        continue
    pa_det.add(g['zfin_id'])
    canon, _ = pick_entries(g, z2)
    e = next((r for r in ents if canon and r['Entry'] == canon['Entry']), ents[0])
    emit(gobj(g), 'protein_detected', True, None, 'measured', 'MS/MS', 'PeptideAtlas', f"https://db.systemsbiology.net/sbeams/cgi/PeptideAtlas/Search?search_key={e['Entry']}",
         e['Entry'], 'UniProt ' + UNIPROT_REL + ' cross-reference', protein_accession=e['Entry'], n_uniprot_entries_with_xref=len(ents),
         note='UniProt cross-reference to PeptideAtlas (peptides of this protein observed in a PeptideAtlas build); not independent of PaxDb, whose PA_201403 dataset is a PeptideAtlas build')

# ---------- STRING (combined >= 700) ----------
CH = ['neighborhood', 'neighborhood_transferred', 'fusion', 'cooccurence', 'homology', 'coexpression', 'coexpression_transferred', 'experiments',
      'experiments_transferred', 'database', 'database_transferred', 'textmining', 'textmining_transferred']
links = collections.defaultdict(list)
fh = gzip.open(f'{CACHE}/string/7955.protein.links.full.v12.0.txt.gz', 'rt'); fh.readline()
for l in fh:
    p = l.split()
    sc = int(p[-1])
    if sc < 700:
        continue
    g = sid2g.get(p[0])
    if not g:
        continue
    links[g['zfin_id']].append((sc, p[1], dict(zip(CH, map(int, p[2:-1])))))
gz = {g['zfin_id']: g for g in genes}
STRING_CAP = 40
string_counts = {}
for z, L in links.items():
    g = gz[z]; L.sort(key=lambda x: -x[0])
    seenp = set(); kept = []
    for sc, partner, ch in L:
        pg = sid2g.get(partner); key = pg['zfin_id'] if pg else partner
        if key in seenp or key == z:
            continue
        seenp.add(key); kept.append((sc, partner, ch, pg))
    if not kept:
        continue
    n_exp = sum(1 for k in kept if k[2]['experiments'] >= 400)
    string_counts[z] = (len(kept), n_exp)
    emit(gobj(g), 'interaction_partner_count', len(kept), 'count', 'predicted', 'STRING combined score >= 0.7', 'STRING',
         'https://string-db.org/network/' + kept[0][1], None, 'STRING v12.0',
         n_partners_with_zebrafish_experiments_channel_ge_0_4=n_exp, note='distinct partner genes at combined score >= 0.7; interacts_with rows list the top %d' % STRING_CAP)
    for sc, partner, ch, pg in kept[:STRING_CAP]:
        if ch['experiments'] >= 400:
            cls = 'experimental (zebrafish data)'
        elif ch['experiments_transferred'] >= 400:
            cls = 'experimental (transferred from other species)'
        elif ch['database'] + ch['database_transferred'] >= 400:
            cls = 'curated pathway database'
        else:
            cls = 'predicted (text-mining / co-expression / genomic context)'
        emit(gobj(g), 'interacts_with', pg['symbol'] if pg else sname.get(partner, partner), None, 'predicted', 'STRING combined %.3f' % (sc / 1000), 'STRING',
             'https://string-db.org/network/' + partner, partner, 'STRING v12.0', score=sc / 1000, interaction_class=cls,
             channels={k: v for k, v in ch.items() if v}, partner={'string_id': partner, 'zfin_id': pg['zfin_id'] if pg else None, 'in_universe': bool(pg)})

# ---------- IntAct ----------
def uacc(s):
    m = re.search(r'uniprotkb:([A-Z0-9]+)', s); return m.group(1) if m else None


for l in open(f'{CACHE}/intact/intact_species7955.tab27', encoding='utf8'):
    p = l.rstrip('\n').split('\t')
    if len(p) < 15:
        continue
    if not (p[9].startswith('taxid:7955') and p[10].startswith('taxid:7955')):
        continue
    a, b = uacc(p[0]), uacc(p[1])
    meth = re.search(r'\(([^)]*)\)', p[6]); itype = re.search(r'\(([^)]*)\)', p[11])
    pmid = re.search(r'pubmed:(\d+)', p[8]); iid = re.search(r'intact:(EBI-\d+)', p[13]); msc = re.search(r'intact-miscore:([\d.]+)', p[14])
    for x, y in ((a, b), (b, a)) if a != b else ((a, b),):
        g = acc2gene.get(x)
        if not g:
            continue
        pg = acc2gene.get(y)
        emit(gobj(g), 'interacts_with', pg['symbol'] if pg else (y or '-'), None, 'curated', meth.group(1) if meth else None, 'IntAct',
             'https://www.ebi.ac.uk/intact/search?query=' + (iid.group(1) if iid else x), iid.group(1) if iid else None, 'IntAct via PSICQUIC ' + TODAY,
             interaction_class='experimental (zebrafish proteins, curated)', interaction_type=itype.group(1) if itype else None,
             pmid=pmid.group(1) if pmid else None, score=float(msc.group(1)) if msc else None,
             partner={'uniprot': y, 'zfin_id': pg['zfin_id'] if pg else None, 'in_universe': bool(pg)})

# ---------- Flying fish (UniProt Exocoetidae, taxon 76072) ----------
sym2g = {g['symbol'].lower(): g for g in genes}
GUESS = {'Cytochrome b': 'mt-cyb', 'Cytochrome c oxidase subunit 1': 'mt-co1', 'Recombination activating protein 2': 'rag2', 'Tyrosinase': 'tyr'}
ff_rows = 0; ff_entries = []
for r in csv.DictReader(open(f'{CACHE}/exocoetidae_uniprot.tsv', encoding='utf8'), delimiter='\t'):
    org = re.sub(r'\s*\(.*\)$', '', r['Organism']).strip()
    if AVES.search(org):
        continue
    pn = r['Protein names']
    sym = next((v for k, v in GUESS.items() if pn.startswith(k)), None)
    g = sym2g.get(sym) if sym else None
    ff_entries.append({'accession': r['Entry'], 'organism': org, 'protein': pn, 'length': r['Length'], 'joined_to': g['symbol'] if g else None})
    if g:
        emit(gobj(g), 'protein_length', int(r['Length']), 'aa', 'curated' if r['Reviewed'] == 'reviewed' else 'inferred-electronic', None, 'UniProt',
             f"https://rest.uniprot.org/uniprotkb/{r['Entry']}", r['Entry'], UNIPROT_REL, species=org, protein_name=pn, protein_accession=r['Entry'],
             note='flying-fish UniProt entry joined to the zebrafish gene by protein name only (no orthology test); most Exocoetidae entries are barcoding fragments')
        ff_rows += 1

# ---------- write ----------
rows_out.sort(key=lambda r: (tier(r['gene'].get('zfin_id', ''), sets), r['gene'].get('symbol', ''), r['feature']))
fn = os.path.join(OUT, 'annotations.jsonl.gz')
with gzip.open(fn, 'wt', encoding='utf8', compresslevel=9) as f:
    for r in rows_out:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

# ---------- coverage ----------
U = {g['zfin_id'] for g in genes}
ms = {z for z in U if z in pax_det}
pe1 = {z for z in U if pe_best.get(z) == 1}
intact_g = stats['IntAct']['genes'] & U
anyprot = {z for z in U if z2.get(z)}
cov = {
    'universe_genes': len(U),
    'genes_with_any_uniprot_entry': len(anyprot),
    'ms_detected_zebrafish_paxdb': len(ms),
    'uniprot_PE1_protein_level_any_entry': len(pe1),
    'ms_detected_and_PE1': len(ms & pe1),
    'ms_detected_peptideatlas_xref': len(pa_det & U),
    'ms_detected_paxdb_or_peptideatlas': len((ms | pa_det) & U),
    'protein_level_any_ms_or_PE1_or_intact': len(ms | pa_det | pe1 | intact_g),
    'predicted_only_no_ms_no_PE1_no_intact': len(anyprot - (ms | pa_det | pe1 | intact_g)),
    'no_uniprot_entry': len(U - anyprot),
    'alphafold_model': len(stats['AlphaFold DB']['genes'] & U),
    'pdb_experimental_structure': len(stats['PDB']['genes'] & U),
    'interpro_via_api': len(ip_api), 'interpro_via_uniprot_xref_fallback': len(ip_fallback),
    'string_partners_ge_0.7': len(string_counts),
    'string_with_zebrafish_experimental_partner': sum(1 for v in string_counts.values() if v[1]),
    'intact_experimental': len(intact_g),
}
causal, req, expr = sets
for name, S in (('causal_chain_genes', causal & U), ('fin_required_or_sufficient_genes', req & U), ('pectoral_fin_expressed_genes', expr & U)):
    cov[name] = {'genes': len(S), 'ms_detected': len(S & ms), 'ms_paxdb_or_peptideatlas': len(S & (ms | pa_det)), 'PE1': len(S & pe1), 'alphafold': len(S & stats['AlphaFold DB']['genes']),
                 'interpro': len(S & (ip_api | ip_fallback)), 'string': len(S & set(string_counts)), 'pdb': len(S & stats['PDB']['genes']),
                 'intact': len(S & intact_g)}
cov['causal_chain_genes_detail'] = {gz[z]['symbol']: {'ms_datasets': len(pax_det[z]['datasets']) if z in pax_det else 0, 'peptideatlas': z in pa_det,
                                                      'ms_organs': sorted(pax_det[z]['organs']) if z in pax_det else [],
                                                      'best_PE': pe_best.get(z)} for z in sorted(causal & U, key=lambda z: gz[z]['symbol'])}
pride = json.load(open(f'{CACHE}/pride/pride_zebrafish_projects.json'))
pc = collections.Counter(t for x in pride['projects'].values() for t in (x['organismsPart'] or ['(not given)']))


def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()


man = {'layer': 'proteomic', 'built': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'tool': 'omics/proteomic/scripts/build.py',
       'rows': len(rows_out), 'genes_covered': len({r['gene'].get('zfin_id') for r in rows_out} & U),
       'by_source': {k: {'rows': v['rows'], 'genes': len(v['genes'] & U)} for k, v in sorted(stats.items())},
       'by_feature': dict(feat.most_common()), 'coverage': cov,
       'paxdb_datasets': pax_meta,
       'pride_zebrafish_projects': {'n_found_by_keyword_search': len(pride['projects']), 'by_tissue': dict(pc.most_common()),
                                    'fin_projects': sorted(a for a, x in pride['projects'].items() if any('fin' in t.lower() for t in (x['organismsPart'] or []))),
                                    'note': 'project-level listing only (lower bound: keyword search). PRIDE Archive does not serve per-protein identification tables '
                                            'through its API, so per-protein MS evidence comes from PaxDb, whose zebrafish datasets include reprocessed '
                                            'PXD000479, PXD010869, PXD014877, PXD016235 and PXD030733'},
       'flying_fish': {'uniprot_exocoetidae_entries': len(ff_entries), 'rows': ff_rows, 'entries': ff_entries,
                       'note': 'UniProt holds no Hirundichthys speculiger proteome (the Xu 2021 annotation is not in UniProtKB/TrEMBL); only these barcoding/single-gene entries'},
       'files': {'annotations.jsonl.gz': {'bytes': os.path.getsize(fn), 'sha256': sha(fn)}},
       'retrievals': [
           {'url': 'https://rest.uniprot.org/uniprotkb/stream?query=organism_id:7955&format=tsv', 'date': '2026-11-01', 'release': UNIPROT_REL, 'sha256': sha(f'{CACHE}/uniprot_7955.tsv.gz')},
           {'url': 'https://rest.uniprot.org/uniprotkb/search?query=taxonomy_id:76072', 'date': '2026-11-01', 'sha256': sha(f'{CACHE}/exocoetidae_uniprot.tsv')},
           {'url': 'https://www.ebi.ac.uk/interpro/api/entry/all/protein/uniprot/{acc}', 'date': '2026-11-01', 'n_proteins': len(ip_api)},
           {'url': 'https://ftp.ebi.ac.uk/pub/databases/interpro/current_release/entry.list', 'date': '2026-11-01', 'sha256': sha(f'{CACHE}/interpro_entry.list')},
           {'url': 'https://alphafold.ebi.ac.uk/api/prediction/{acc}', 'date': '2026-11-01', 'n_proteins': len(stats['AlphaFold DB']['genes'])},
           {'url': 'https://data.rcsb.org/graphql', 'date': '2026-11-01', 'sha256': sha(f'{CACHE}/rcsb_entries.json')},
           {'url': 'https://pax-db.org/downloads/latest/datasets/7955/', 'date': '2026-11-01', 'files': len(pax_meta)},
           {'url': 'https://stringdb-downloads.org/download/protein.links.full.v12.0/7955.protein.links.full.v12.0.txt.gz', 'date': '2026-11-01',
            'sha256': sha(f'{CACHE}/string/7955.protein.links.full.v12.0.txt.gz')},
           {'url': 'https://stringdb-downloads.org/download/protein.aliases.v12.0/7955.protein.aliases.v12.0.txt.gz', 'date': '2026-11-01'},
           {'url': 'https://stringdb-downloads.org/download/protein.info.v12.0/7955.protein.info.v12.0.txt.gz', 'date': '2026-11-01'},
           {'url': 'https://www.ebi.ac.uk/Tools/webservices/psicquic/intact/webservices/current/search/query/species:7955?format=tab27', 'date': '2026-11-01',
            'sha256': sha(f'{CACHE}/intact/intact_species7955.tab27')},
           {'url': 'https://www.ebi.ac.uk/pride/ws/archive/v3/search/projects', 'date': '2026-11-01', 'sha256': sha(f'{CACHE}/pride/pride_zebrafish_projects.json')}],
       'not_done': ['BioGRID: its REST API needs an access key (a credential) - not used',
                    'PRIDE per-protein identifications: not exposed by the archive API; PaxDb reprocessing used instead',
                    'ProteomeXchange repositories other than PRIDE: not queried'],
       'status': os.environ.get('STATUS', 'partial')}
json.dump(man, open(os.path.join(OUT, 'MANIFEST.json'), 'w'), indent=1)
print(json.dumps({k: man[k] for k in ('rows', 'genes_covered', 'by_source')}, indent=1))
print(json.dumps({k: v for k, v in cov.items() if k != 'causal_chain_genes_detail'}, indent=1)); print(man['files'])
