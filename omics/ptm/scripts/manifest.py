"""Write omics/ptm/MANIFEST.json and flying-fish flag files.

Public numbers come from annotations.jsonl.gz only; 'full' numbers add restricted.local.jsonl.gz (dbPTM, EPSD: no stated
licence, kept local). Only aggregates of the restricted rows appear in public files.
"""
import json, gzip, hashlib, os, collections, datetime, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = f'{ROOT}/omics/ptm'
C = 'C:/Temp/omics-cache/ptm'
st = json.load(open(f'{C}/work/build_stats.json'))
sp = json.load(open(f'{C}/work/split_stats.json'))
MOTIF_RULE = st['motif_rule']


def rows_of(fn):
    for line in gzip.open(fn, 'rt', encoding='utf-8'):
        yield json.loads(line)


def summarise(files):
    S = {'rows': 0}
    genes = set()
    by_source = collections.defaultdict(lambda: {'rows': 0, 'genes': set()})
    by_feature, by_kind, by_species = collections.Counter(), collections.Counter(), collections.Counter()
    zf_genes, borrowed_genes, cons_genes = set(), set(), set()
    cons = collections.Counter()
    cons_src = collections.defaultdict(collections.Counter)
    cons_feat = collections.defaultdict(collections.Counter)
    ub, ubc = set(), set()
    ff = collections.Counter()
    flags = {}
    for fn in files:
        for r in rows_of(fn):
            S['rows'] += 1
            z = r['gene']['zfin_id']
            genes.add(z)
            db = r['source']['db']
            by_source[db]['rows'] += 1
            by_source[db]['genes'].add(z)
            by_feature[r['feature']] += 1
            by_kind[r['kind']] += 1
            by_species[r['species']] += 1
            v = r['value']
            if r['kind'] in ('measured', 'curated') and r['species'] == 'Danio rerio':
                zf_genes.add(z)
            if r['kind'] == 'borrowed-ortholog' and r['species'] != 'Danio rerio':
                c = v['conservation']
                cons[c] += 1
                cons_src[db][c] += 1
                cons_feat[r['feature']][c] += 1
                borrowed_genes.add(z)
                key = (z, v['zf_position'] or ('gap', v['source_protein'], v['position']), r['feature'])
                ub.add(key)
                if c == 'conserved':
                    cons_genes.add(z)
                    ubc.add(key)
            f = r.get('flying_fish')
            if f:
                ff[f['state']] += 1
                if f['state'] == 'differs from zebrafish' and v.get('conservation') != 'not-conserved':
                    zpos = v.get('zf_position') if 'zf_position' in v else v.get('position')
                    zres = v.get('zf_residue') if 'zf_residue' in v else v.get('residue')
                    e = flags.setdefault((r['gene']['symbol'], zpos), {'gene': r['gene']['symbol'], 'zf_position': zpos, 'zf_residue': zres,
                                                                       'flying_fish_residue': f['residue'], 'flying_fish_protein': f['protein'],
                                                                       'modifications': set(), 'evidence': set()})
                    e['modifications'].add(v.get('modification'))
                    e['evidence'].add(f"{db}|{r['kind']}|{r['species']}")
    sites = []
    for k, e in sorted(flags.items()):
        zr, fr = e['zf_residue'], e['flying_fish_residue']
        ch = 'S/T swap (acceptor kept)' if (zr in 'ST' and fr in 'ST') else ('acceptor kept (S/T/Y)' if (zr in 'STY' and fr in 'STY') else 'modifiable residue replaced')
        sites.append(dict(e, modifications=sorted(e['modifications']), evidence=sorted(e['evidence']), residue_change=ch))
    summary = {
        'rows': S['rows'], 'genes_covered': len(genes),
        'by_source': {k: {'rows': v['rows'], 'genes': len(v['genes'])} for k, v in sorted(by_source.items())},
        'by_feature': dict(by_feature.most_common()), 'by_kind': dict(by_kind.most_common()),
        'by_species_of_measurement': dict(by_species.most_common()),
        'zebrafish_vs_borrowed': {'genes_with_zebrafish_measured_or_curated_site': len(zf_genes), 'genes_with_borrowed_site': len(borrowed_genes),
                                  'genes_with_a_conserved_borrowed_site': len(cons_genes)},
        'conservation': {'rows': dict(cons), 'rows_by_source': {k: dict(v) for k, v in cons_src.items()},
                         'by_feature': {k: dict(v) for k, v in cons_feat.items()},
                         'unique_zebrafish_positions_borrowed': len(ub), 'unique_zebrafish_positions_conserved': len(ubc)},
        'flying_fish': {'rows_checked_by_state': dict(ff), 'unique_sites_differing_from_zebrafish': len(sites),
                        'by_residue_change': dict(collections.Counter(s['residue_change'] for s in sites)),
                        'with_zebrafish_measured_or_curated_evidence': sum(1 for s in sites if any(('|measured|' in x or '|curated|' in x) for x in s['evidence']))},
    }
    return summary, sites


pub, pub_sites = summarise([f'{OUT}/annotations.jsonl.gz'])
full, full_sites = summarise([f'{OUT}/annotations.jsonl.gz', f'{OUT}/restricted.local.jsonl.gz'])

FF_HDR = {'title': 'PTM-site residues where the flying-fish (Hirundichthys speculiger) orthologue differs from zebrafish (fin genes)',
          'rule': 'only sites where the zebrafish residue is itself the modified residue (zebrafish measured/curated, or a borrowed site classed conserved or residue-conserved-motif-diverged)',
          'caveat': 'residue STATE in a flying-fish protein sequence; not a measured modification in flying fish and not a phenotype; medaka/non-flying beloniforms not checked, so not shown to be flying-fish-specific',
          'orthologues': st['ff_genes']}
json.dump(dict(FF_HDR, scope='public rows only (UniProt, iPTMnet, Banu 2025, Lemeer 2008)', sites=pub_sites),
          open(f'{OUT}/flying_fish_flags.json', 'w', encoding='utf-8'), indent=1)
with gzip.open(f'{OUT}/flying_fish_flags.local.jsonl.gz', 'wt', encoding='utf-8') as fh:  # includes dbPTM/EPSD-derived sites: local only
    for s in full_sites:
        fh.write(json.dumps(s) + '\n')


def fstat(p):
    b = open(p, 'rb').read()
    return {'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}


universe = len(json.load(open(f'{ROOT}/omics/genes.json', encoding='utf-8'))['genes'])
m = {
    'layer': 'ptm',
    'built': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
    'universe': universe,
    'scope': 'Top-level counts describe the PUBLIC file annotations.jsonl.gz. "full" adds the local-only restricted.local.jsonl.gz (dbPTM, EPSD: no stated licence, not redistributed); only aggregate numbers of those rows are given here.',
    **pub,
    'conservation': dict(pub['conservation'], rule=MOTIF_RULE),
    'flying_fish': dict(pub['flying_fish'], species='Hirundichthys speculiger (Xu et al. 2021 proteome)',
                        genes_with_orthologue=len(st['ff_genes']), fin_gene_set_size=len(st['fin_genes']), flags_file='flying_fish_flags.json',
                        caveat='residue state in a flying-fish protein sequence; not a measured modification and not a phenotype'),
    'full_including_local_restricted': full,
    'restricted_local': {'file': 'restricted.local.jsonl.gz (gitignored by omics/**/*.local.jsonl.gz; not committed)',
                         'sources': {'dbPTM': 'no licence stated on the download page (all rights reserved by default)',
                                     'EPSD': 'no licence stated ((c) CUCKOO Workgroup); its zebrafish sites come from Kwon 2016 (Proteomics) and Lemeer 2008 (J Proteome Res), neither open access, and Lemeer 2008 (MCP), re-sourced publicly from the paper'},
                         'rows': full['rows'] - pub['rows']},
    'licences_public': {'UniProt': 'CC BY 4.0', 'iPTMnet': 'CC BY-NC-SA 4.0 (non-commercial, share-alike; https://research.bioinformatics.udel.edu/iptmnet/license)',
                        'Banu 2025 Sci Rep (PMC11808059)': 'CC BY 4.0', 'Lemeer 2008 Mol Cell Proteomics': 'CC BY (Europe PMC licence metadata)'},
    'lemeer_2008_mcp': {'sites_public': sp['lemeer_sites'], 'dropped': sp['lemeer_dropped']},
    'dropped': st['dropped'],
    'files': {n: fstat(f'{OUT}/{n}') for n in ('annotations.jsonl.gz', 'SOURCES.md', 'flying_fish_flags.json')},
    'retrievals': [
        {'url': 'https://rest.uniprot.org/uniprotkb/stream (accession batches; zebrafish, human; reviewed mouse by gene symbol) + uniparc/stream', 'date': '2026-11-01'},
        {'url': 'https://research.bioinformatics.udel.edu/iptmnet_data/files/current/ptm.txt', 'date': '2026-11-01', 'sha256': hashlib.sha256(open(f'{C}/raw/iptmnet_ptm.txt', 'rb').read()).hexdigest()},
        {'url': 'https://ars.els-cdn.com/content/image/1-s2.0-S1535947620308847-mmc1.zip (Lemeer 2008 MCP supplementary)', 'date': '2026-11-01', 'sha256': hashlib.sha256(open(f'{C}/raw/lemeer/mmc1.zip', 'rb').read()).hexdigest()},
        {'url': 'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11808059/supplementaryFiles', 'date': '2026-11-01'},
        {'url': 'https://epsd.biocuckoo.cn/Download/Danio%20rerio.zip (local-only use)', 'date': '2026-11-01'},
        {'url': 'https://biomics.lab.nycu.edu.tw/dbPTM/download/experiment/<type>.gz (local-only use)', 'date': '2026-11-01'},
    ],
    'not_used': {'PhosphoSitePlus': 'bulk downloads need a registered login; CC BY-NC-SA; no credentials used, skipped',
                 'qPTM': 'download page returned HTTP 404 on 2026-11-01'},
    'status': sys.argv[1] if len(sys.argv) > 1 else 'done',
}
json.dump(m, open(f'{OUT}/MANIFEST.json', 'w', encoding='utf-8'), indent=1)
for name, s in (('PUBLIC', pub), ('FULL', full)):
    print(name, json.dumps({k: s[k] for k in ('rows', 'genes_covered', 'by_source', 'by_kind', 'zebrafish_vs_borrowed')}))
    print('  cons', json.dumps({k: s['conservation'][k] for k in ('rows', 'unique_zebrafish_positions_borrowed', 'unique_zebrafish_positions_conserved')}))
    print('  ff', json.dumps(s['flying_fish']))
