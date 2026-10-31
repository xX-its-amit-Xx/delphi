"""Derived tables from Daane et al. 2021 Data S1 (local, genotype/cache/daane2021_data_s1_mmc2.xlsx; not redistributed)
plus the Zenodo CNE-to-gene association file. Bat literature is added by build_bats.py.
Writes C:/Temp/sequences/regions_partial.json"""
import json, os, re, collections, openpyxl

HERE = os.path.dirname(os.path.abspath(__file__)); SEQ = os.path.dirname(HERE); ROOT = os.path.dirname(SEQ)
XL = os.path.join(ROOT, 'genotype/cache/daane2021_data_s1_mmc2.xlsx')
wb = openpyxl.load_workbook(XL, read_only=True, data_only=True)


def sheet(prefix):
    ws = [w for w in wb.worksheets if w.title.startswith(prefix + ' ')][0]
    return ws.title, [list(r) for r in ws.iter_rows(values_only=True)]


CHECK = '\u2713'
SRC = {'doi': '10.1016/j.cub.2021.08.054', 'pmid': '34534441', 'file': 'genotype/cache/daane2021_data_s1_mmc2.xlsx',
       'note': 'Daane et al. 2021 Curr Biol, Data S1. Row numbers are 1-based spreadsheet rows. Derived summaries only; the sheet is not redistributed.'}
FOCAL_ALIASES = {'kcnk5b': ['kcnk5b'], 'kcnh2a': ['kcnh2a'], 'slc43a2a': ['slc43a2a', 'lat4a'], 'gja1b': ['gja1b', 'cx43'],
                 'tbx5a': ['tbx5a'], 'fgf10a': ['fgf10a'], 'shha': ['shha'], 'hhip': ['hhip'], 'prdm1a': ['prdm1a']}


def focal_of(name):
    n = (name or '').lower()
    return [g for g, al in FOCAL_ALIASES.items() if n in al]


out = {'title': 'Which parts of the genome: regions associated with fin or wing proportion',
       'simplification_warning': (
           '"The genes that code for wings" is a simplification. Neither a flying fish wing (an enlarged pectoral fin) nor a bat '
           'wing has a gene of its own. What the sources identify are regions ASSOCIATED with fin or wing proportion: a few '
           'protein-coding substitutions, genes evolving at changed rates, and, mostly, non-coding regulatory elements '
           '(accelerated or constrained conserved non-coding elements, enhancers). Association is not causation, and only a few '
           'have been tested functionally.'),
       'source_daane2021': SRC, 'flying_fish': {}, 'bats': {}}
ff = out['flying_fish']

# G: convergent amino-acid substitutions
t, rows = sheet('G')
items = []
for i, r in enumerate(rows[1:], start=2):
    if not r or not r[0] or not str(r[0]).startswith('ENS'):
        continue
    v = (r + [None] * 8)[:8]
    items.append({'row': i, 'ensembl_gene': r[0], 'gene': r[1], 'substitution_medaka_coords': r[2],
                  'flying_halfbeak_Euleptorhamphus_viridis': v[3] == CHECK,
                  'flying_halfbeak_Oxyporhamphus_micropterus': v[4] == CHECK,
                  'Exocoetidae_at_least_7_of_9': v[5] == CHECK, 'fin_screens': v[6] == CHECK, 'fin_limb_GO': v[7] == CHECK,
                  'focal_gene': focal_of(r[1])})
uniq = {(x['ensembl_gene'], x['substitution_medaka_coords']) for x in items}
ff['convergent_amino_acid_substitutions'] = {
    'sheet': t,
    'what': ('amino-acid substitutions shared by flying fishes and both flying-halfbeak lineages and absent from outgroups; '
             'sheet footnotes (rows 47-50): positions are relative to the medaka protein, present in at least 7/9 sequenced flying fish'),
    'n_rows': len(items), 'n_unique_gene_substitution_pairs': len(uniq),
    'n_unique_genes': len({x['gene'] for x in items}),
    'n_flagged_fin_screen_or_fin_limb_GO': sum(1 for x in items if x['fin_screens'] or x['fin_limb_GO']),
    'fin_flagged_rows': [x for x in items if x['fin_screens'] or x['fin_limb_GO']],
    'duplicate_rows_note': 'gpr171 A285E appears twice (rows 34 and 38) and ralb appears for two Ensembl genes.',
    'all': [f"{x['gene']} {x['substitution_medaka_coords']} (row {x['row']})" for x in items]}

# H: fin and limb genes
t, rows = sheet('H')
H = [{'row': i, 'ensembl_gene': r[0], 'gene': r[1]} for i, r in enumerate(rows[1:], start=2)
     if r and r[0] and str(r[0]).startswith('ENS')]
ff['fin_and_limb_genes_targeted'] = {
    'sheet': t, 'what': 'fin- and limb-associated genes (fin mutant screens or fin/limb GO terms) in the capture design',
    'n_genes': len(H),
    'focal_genes_present': {g: [f"{x['gene']} (row {x['row']}, {x['ensembl_gene']})" for x in H if focal_of(x['gene']) == [g]]
                            for g in FOCAL_ALIASES}}

# I: glider RER genes
t, rows = sheet('I')
I = [{'row': i, 'ensembl_gene': r[0], 'gene': r[1], 'rho': float(r[2]), 'p': float(r[3]), 'q': float(r[4])}
     for i, r in enumerate(rows[1:], start=2) if r and r[0] and str(r[0]).startswith('ENS')]
ff['glider_relative_evolutionary_rate_genes'] = {
    'sheet': t,
    'what': 'fin/limb genes whose relative evolutionary rate (RER) correlates with gliding; rho > 0 means faster evolution in gliders',
    'n_genes': len(I), 'n_q_below_0.05': sum(1 for x in I if x['q'] < 0.05), 'n_p_below_0.05': sum(1 for x in I if x['p'] < 0.05),
    'n_rho_positive': sum(1 for x in I if x['rho'] > 0),
    'q_below_0.05': [f"{x['gene']} rho={x['rho']:.3f} q={x['q']:.3g} (row {x['row']})" for x in I if x['q'] < 0.05],
    'all': [f"{x['gene']} rho={x['rho']:.3f} p={x['p']:.3g} q={x['q']:.3g} (row {x['row']})" for x in I]}

# J: Exocoetidae phyloP
t, rows = sheet('J')
J = [{'row': i, 'ensembl_gene': r[0], 'gene': r[1], 'state': r[2], 'p': float(r[3])} for i, r in enumerate(rows[1:], start=2)
     if r and r[0] and str(r[0]).startswith('ENS')]
ff['exocoetidae_phyloP_coding'] = {
    'sheet': t,
    'what': 'fin/limb genes with significantly accelerated (acc) or conserved (con) evolution on the flying-fish (Exocoetidae) branch, phyloP',
    'n_genes': len(J), 'n_accelerated': sum(1 for x in J if x['state'] == 'acc'), 'n_conserved': sum(1 for x in J if x['state'] == 'con'),
    'focal_and_channel_genes': [f"{x['gene']} {x['state']} p={x['p']:.3g} (row {x['row']})" for x in J
                                if focal_of(x['gene']) or x['gene'].startswith(('kcn', 'slc43'))],
    'accelerated': [f"{x['gene']} (row {x['row']})" for x in J if x['state'] == 'acc'],
    'conserved': [f"{x['gene']} (row {x['row']})" for x in J if x['state'] == 'con']}

# K-N: CNE GO enrichments
KW = re.compile(r'\bfin\b|limb|appendage|skelet|bone|ossif|cartilag|chondro|osteo|wnt|hedgehog|smoothened|fibroblast growth|'
                r'potassium|gap junction|connexin|muscle|growth', re.I)
for pre, key, what in [
        ('K', 'accelerated_CNEs_flying_fishes', 'GO terms enriched among genes near conserved non-coding elements ACCELERATED in Exocoetidae'),
        ('L', 'constrained_CNEs_flying_fishes', 'GO terms enriched among genes near CNEs more CONSTRAINED in Exocoetidae'),
        ('M', 'accelerated_CNEs_halfbeaks', 'GO terms enriched among genes near CNEs ACCELERATED in halfbeaks'),
        ('N', 'constrained_CNEs_halfbeaks', 'GO terms enriched among genes near CNEs more CONSTRAINED in halfbeaks')]:
    t, rows = sheet(pre)
    R = [{'row': i, 'go': r[0], 'name': r[1], 'n_cnes': int(r[2]), 'q': float(r[3])} for i, r in enumerate(rows[1:], start=2)
         if r and r[0] and str(r[0]).startswith('GO:')]
    rel = [x for x in R if KW.search(x['name'] or '')]
    ff[key] = {'sheet': t, 'what': what, 'n_GO_terms_q_below_0.05': len(R),
               'top10_by_q_then_CNE_count': [f"{x['go']} {x['name']} ({x['n_cnes']} CNEs in term, q={x['q']:.3g}, row {x['row']})"
                                            for x in sorted(R, key=lambda x: (x['q'], -x['n_cnes']))[:10]],
               'n_terms_matching_fin_limb_growth_signalling_keywords': len(rel),
               'fin_limb_growth_signalling_terms': [f"{x['go']} {x['name']} ({x['n_cnes']} CNEs in term, q={x['q']:.3g}, row {x['row']})" for x in rel],
               'keyword_filter_regex': KW.pattern,
               'limit': ('The sheet lists GO terms, not the individual CNEs or genes, so the genes next to each accelerated element cannot be listed from Data S1 alone. '
                         'The "# CNEs" column is the total number of captured CNEs assigned to genes in the term, not the number accelerated: the 118 GO terms shared by sheets K and M carry identical counts in both, which only a term total can do. Data S1 therefore gives no count of accelerated elements.')}

# Zenodo CNE -> gene associations
sel = json.load(open('C:/Temp/sequences/selected.json'))
cne = collections.Counter()
ntot = 0
with open('C:/Temp/sequences/zenodo/medaka_cne_great.txt') as f:
    next(f)
    for line in f:
        p = line.rstrip('\n').split('\t')
        if len(p) < 6:
            continue
        ntot += 1
        for gid in p[5].split(','):
            cne[gid] += 1
med_ids = {}
for g in FOCAL_ALIASES:
    ids = set()
    if sel.get(g, {}).get('oryzias_latipes'):
        ids.add(sel[g]['oryzias_latipes']['gene_id'])
    for x in H + J:
        if focal_of(x['gene']) == [g]:
            ids.add(x['ensembl_gene'])
    med_ids[g] = sorted(ids)
vals = sorted(cne.values())
ff['CNEs_associated_with_focal_genes'] = {
    'source': ('Zenodo 10.5281/zenodo.5082978 (record 5082979), medaka_cne_great.txt: assembled CNEs assigned to neighbouring '
               'protein-coding genes by the GREAT rule, MEDAKA1 coordinates'),
    'n_CNEs_total': ntot, 'n_medaka_genes_with_any_CNE': len(cne), 'median_CNEs_per_associated_gene': vals[len(vals) // 2],
    'per_focal_gene': {g: {'medaka_gene_ids': ids, 'n_associated_CNEs': sum(cne.get(i, 0) for i in ids),
                           'percentile_among_genes': (round(100 * sum(1 for v in vals if v <= sum(cne.get(i, 0) for i in ids)) / len(vals), 1)
                                                      if any(cne.get(i, 0) for i in ids) else None)}
                       for g, ids in med_ids.items()},
    'limit': ('These counts cover ALL captured CNEs near each gene, not only accelerated ones; the accelerated subset is reported only as GO enrichments (sheets K and M). '
              'A count of 0 can mean the gene ID used (Ensembl release 116) did not exist in the MEDAKA1 annotation the file uses (tbx5a, fgf10a), or that Ensembl has no medaka orthologue (kcnh2a); it does not mean the gene has no regulatory elements.')}
json.dump(out, open('C:/Temp/sequences/regions_partial.json', 'w'), indent=1)
print(json.dumps({k: (v.get('n_rows') or v.get('n_genes') or v.get('n_GO_terms_q_below_0.05') or v.get('n_CNEs_total')) for k, v in ff.items()}, indent=1))
print(json.dumps(ff['CNEs_associated_with_focal_genes']['per_focal_gene']))
print(ff['exocoetidae_phyloP_coding']['focal_and_channel_genes'])
print(ff['glider_relative_evolutionary_rate_genes']['q_below_0.05'])
print(ff['convergent_amino_acid_substitutions']['n_flagged_fin_screen_or_fin_limb_GO'], [x['gene'] for x in ff['convergent_amino_acid_substitutions']['fin_flagged_rows']])
