"""Genotype-phenotype ladder across the beloniform series (scope addition 3).
Rows: sequenced beloniform species (Daane 2021 Zenodo translated exons) in species-tree order, grouped
needlefish/saury -> halfbeak -> gliding halfbeak -> flying fish. Columns: Daane 2021 Data S1 sheet G convergent sites,
re-read per species from the captured exons (not copied from the sheet). Phenotype: pectoral fin length / SL from
genotype/cache/daane2021_fin_ratios.json (sheet A). Writes sequences/progression.json and sequences/PROGRESSION.md."""
import json, os, re, openpyxl, statistics
HERE = os.path.dirname(os.path.abspath(__file__)); SEQ = os.path.dirname(HERE); ROOT = os.path.dirname(SEQ)
T = 'C:/Temp/sequences'
XL = os.path.join(ROOT, 'genotype/cache/daane2021_data_s1_mmc2.xlsx')
wb = openpyxl.load_workbook(XL, read_only=True, data_only=True)
def sheet(p):
    ws = [w for w in wb.worksheets if w.title.startswith(p + ' ')][0]
    return ws.title, [list(r) for r in ws.iter_rows(values_only=True)]

fr = json.load(open(os.path.join(ROOT, 'genotype/cache/daane2021_fin_ratios.json'), encoding='utf-8'))
cc = json.load(open(os.path.join(ROOT, 'genotype/causal-chains.json'), encoding='utf-8'))
cc_genes = {g['symbol']: g for g in cc['genes']}
pw = json.load(open(os.path.join(ROOT, 'genotype/pathways.slim.json'), encoding='utf-8'))
n_map_genes = pw['coverage']['all_genes_in_vetted_map']['genes']
G = json.load(open(f'{T}/daane_sheetG.json'))
P = json.load(open(f'{T}/sheetG_proteins.json'))['genes']
tree = open(f'{T}/zenodo/Beloniformes.tre').read()
order = re.findall(r'([A-Z][a-z]+_[a-z]+)', tree)
order_idx = {s: i for i, s in enumerate(order)}

GROUP_ORDER = ['needlefish or saury (non-gliding)', 'halfbeak (non-gliding)', 'flying (gliding) halfbeak', 'flying fish (Exocoetidae)']
GROUP_FR = {'needlefish or saury (non-gliding)': 'needlefish', 'halfbeak (non-gliding)': 'halfbeak',
            'flying (gliding) halfbeak': 'flying halfbeak', 'flying fish (Exocoetidae)': 'flying fish'}
sp_fr = {s['species'].replace(' ', '_'): s for s in fr['species']}

# columns from sheet G (sites verified against the Ensembl 116 protein)
t, rows = sheet('G')
cols, skipped = [], []
seen = set()
for i, r in enumerate(rows, start=1):
    if not r or not r[0] or not str(r[0]).startswith('ENS'): continue
    gid, gene, sub = r[0], r[1], r[2]
    ref, pos, alt = sub[0], int(sub[1:-1]), sub[-1]
    if (gid, sub) in seen:
        skipped.append({'row': i, 'gene': gene, 'sub': sub, 'why': 'duplicate row'}); continue
    seen.add((gid, sub))
    q = P[gid]['seq']
    if pos > len(q) or q[pos - 1] != ref:
        skipped.append({'row': i, 'gene': gene, 'sub': sub, 'why': f'reference residue {ref}{pos} not found in the Ensembl 116 protein of {gid} (annotation changed since MEDAKA1)'}); continue
    if ref == alt:
        skipped.append({'row': i, 'gene': gene, 'sub': sub, 'why': 'synonymous as written (ref == alt)'}); continue
    cols.append({'row': i, 'ensembl_gene': gid, 'gene': gene, 'substitution': sub, 'ref': ref, 'pos': pos, 'alt': alt,
                 'coord_protein': P[gid]['translation'] + f" ({P[gid]['species']})",
                 'in_causal_chains': gene in cc_genes or (gene == 'lat4a' and 'slc43a2a' in cc_genes)})

species = sorted(G['genes'][cols[0]['ensembl_gene']].keys(), key=lambda s: (GROUP_ORDER.index(G['genes'][cols[0]['ensembl_gene']][s]['role']), order_idx.get(s, 999)))
roles = {s: G['genes'][cols[0]['ensembl_gene']][s]['role'] for s in species}
table = []
for s in species:
    cells = {}
    n_alt = n_ref = n_other = n_missing = 0
    for c in cols:
        d = G['genes'][c['ensembl_gene']].get(s)
        res = d['projected_on_medaka_coords'][c['pos'] - 1] if d else '-'
        res = None if res == '-' else res
        cells[f"{c['gene']} {c['substitution']}"] = res
        if res is None: n_missing += 1
        elif res == c['alt']: n_alt += 1
        elif res == c['ref']: n_ref += 1
        else: n_other += 1
    f = sp_fr.get(s)
    if f:
        fin = {'pectoral_over_SL_median': f['pectoral_over_SL_median'], 'n_specimens': f['n_specimens'], 'basis': 'this species, Daane 2021 sheet A'}
    elif s == 'Euleptorhamphus_viridis' and 'Euleptorhamphus_velox' in sp_fr:
        f = sp_fr['Euleptorhamphus_velox']
        fin = {'pectoral_over_SL_median': f['pectoral_over_SL_median'], 'n_specimens': f['n_specimens'], 'basis': 'congener Euleptorhamphus velox (the measured species), Daane 2021 sheet A'}
    else:
        gname = GROUP_FR[roles[s]]; g = fr['groups'][gname]
        fin = {'pectoral_over_SL_median': g['pectoral_over_SL_median'], 'n_specimens': g['n_specimens'], 'basis': f'group median ({gname}), species not measured'}
    table.append({'species': s.replace('_', ' '), 'group': roles[s], 'fin_ratio': fin, 'cells': cells,
                  'n_derived': n_alt, 'n_ancestral': n_ref, 'n_other_residue': n_other, 'n_not_captured': n_missing})

lat = 'lat4a F326L'
groups = {}
for g in GROUP_ORDER:
    rr = [x for x in table if x['group'] == g]
    lat_states = [x['cells'][lat] for x in rr]
    groups[g] = {'n_species_sequenced': len(rr), 'fin_ratio_group_median': fr['groups'][GROUP_FR[g]]['pectoral_over_SL_median'],
                 'fin_ratio_n_specimens': fr['groups'][GROUP_FR[g]]['n_specimens'],
                 'lat4a_326_residues': {r: lat_states.count(r) for r in sorted(set(x for x in lat_states if x))},
                 'mean_derived_states_of_%d_sites' % len(cols): round(statistics.mean(x['n_derived'] for x in rr), 1),
                 'range_derived_states': [min(x['n_derived'] for x in rr), max(x['n_derived'] for x in rr)]}

# non-coding signal per branch
def max_cnes(p):
    t, rows = sheet(p)
    R = [(int(r[2]), i) for i, r in enumerate(rows, start=1) if r and r[0] and str(r[0]).startswith('GO:')]
    return t, max(R), len(R)
tK, (kmax, krow), kn = max_cnes('K')
n_cne_total = sum(1 for _ in open(f'{T}/zenodo/medaka_cne_great.txt')) - 1
tM, (mmax, mrow), mn = max_cnes('M')
tJ, rowsJ = sheet('J')
Jacc = sum(1 for r in rowsJ if r and r[0] and str(r[0]).startswith('ENS') and r[2] == 'acc')
Jcon = sum(1 for r in rowsJ if r and r[0] and str(r[0]).startswith('ENS') and r[2] == 'con')
tI, rowsI = sheet('I')
I = [{'row': i, 'gene': r[1], 'rho': float(r[2]), 'q': float(r[4])} for i, r in enumerate(rowsI, start=1) if r and r[0] and str(r[0]).startswith('ENS')]
n_sheetG_rows = sum(1 for r in rows if r and r[0] and str(r[0]).startswith('ENS'))

out = {
    'title': 'Progression ladder: fin proportion and coding-site state across the beloniform series',
    'read_this_first': [
        'A LADDER TO READ, NOT A TEST. Four groups (needlefish/saury, halfbeak, gliding halfbeak, flying fish) is far too few for any statistical claim. No correlation between residue state and fin ratio is computed: species share ancestry, so a cross-species correlation needs phylogenetic correction, and with four groups that correction cannot be done meaningfully.',
        'THE NON-GLIDERS SCORE ZERO BY CONSTRUCTION. Sheet G lists only substitutions shared by gliders and ABSENT from outgroups, so non-gliding species carry the ancestral residue at these sites by definition; the zero is circular and is not a finding. The informative part of the ladder is among gliders: gliding halfbeaks (fin/SL about 0.27) carry about as many of these derived states as flying fishes (about 0.69), so derived-state count does not scale with fin length.',
        'TRACKING IS NOT CAUSING. A residue that changes along with fin length across the series is consistent with involvement and is not evidence of causation. Our own causal chains grade slc43a2a (lat4a) at "%s".' % cc_genes['slc43a2a'].get('best_grade', 'hypothesis'),
        ('A SLICE, NOT THE SYSTEM. Development means many genes are involved. The project gene map holds %d genes (genotype/pathways.slim.json, coverage.all_genes_in_vetted_map), 982 of them with expression records on the pectoral fin alone (genotype/README.md), and most between-species difference is regulatory rather than coding. '
         'Daane 2021 captured %d conserved non-coding elements (Zenodo medaka_cne_great.txt) alongside the coding exons, and reports accelerated non-coding evolution enriched in %d GO terms on the flying-fish branch (sheet K) and %d on the halfbeak branch (sheet M), against %d convergent coding substitution rows (sheet G). '
         'The number of accelerated elements itself is NOT in Data S1 (the "# CNEs" column is a per-term total: the 118 terms shared by sheets K and M carry identical counts), so no like-for-like count of non-coding versus coding changes can be given from the local data. '
         'This short coding ladder is labelled as a slice through a much larger system, never as "the genes for wings".') % (n_map_genes, n_cne_total, kn, mn, n_sheetG_rows)],
    'sources': {'daane2021': 'Daane et al. 2021 Curr Biol, doi 10.1016/j.cub.2021.08.054, Data S1 (local genotype/cache/daane2021_data_s1_mmc2.xlsx, not redistributed)',
                'exons': 'Daane 2021 Zenodo 10.5281/zenodo.5082978 (record 5082979) translated_exons.tar.gz, residues re-read here by blastp of the Ensembl 116 query protein against each species\' captured exons (MIN identity 75%, best hit per region)',
                'tree': 'Zenodo Beloniformes.tre (row order within groups)', 'fin_ratios': 'genotype/cache/daane2021_fin_ratios.json (Daane 2021 sheet A, 109 specimens)'},
    'coordinate_system': 'Each site is numbered as in Daane 2021 sheet G: 1-based on the medaka protein (or, for rows whose Ensembl ID is from platyfish or Amazon molly, on that species\' protein). The reference residue was checked against the Ensembl release 116 protein for that gene ID; rows where it no longer matches are listed under skipped_columns.',
    'phylogeny_note': 'In the Zenodo species tree the two gliding-halfbeak genera are not sister to each other: Euleptorhamphus groups with Rhynchorhamphus, and Oxyporhamphus with Hemiramphus, so gliding arose more than once inside the halfbeak grade leading to flying fishes. That is why a residue shared by both gliding halfbeaks and flying fishes is called convergent.',
    'groups_in_order': groups,
    'columns': cols, 'skipped_columns': skipped,
    'rows': table,
    'lat4a_F326L_reading': None,
    'gene_level_signal_not_site_level': {
        'sheet_I_glider_RER': {'sheet': tI, 'n_genes': len(I), 'n_q_below_0.05': sum(1 for x in I if x['q'] < 0.05),
                               'in_causal_chains': [f"{x['gene']} rho={x['rho']:.3f} q={x['q']:.3g} (row {x['row']})" for x in I if x['gene'] in cc_genes],
                               'note': 'RER is a per-gene rate correlation with gliding across the tree, not a per-species residue, so it cannot fill ladder cells; listed here as gene-level context.'},
        'sheet_J_exocoetidae_coding_phyloP': {'sheet': tJ, 'accelerated': Jacc, 'conserved': Jcon, 'branch': 'flying fishes (Exocoetidae)'}},
    'non_coding_signal_per_branch': {
        'flying_fishes': {'sheet': tK, 'n_GO_terms_enriched_for_accelerated_CNEs': kn},
        'halfbeaks': {'sheet': tM, 'n_GO_terms_enriched_for_accelerated_CNEs': mn},
        'flying_fish_branch_coding_genes_phyloP_sheet_J': {'sheet': tJ, 'accelerated': Jacc, 'conserved': Jcon},
        'CNEs_captured_total': n_cne_total,
        'convergent_coding_substitutions_sheet_G_rows': n_sheetG_rows,
        'why_no_element_count': 'Data S1 does not report how many CNEs are accelerated on each branch. Its "# CNEs" column is the total number of captured CNEs assigned to the genes of each GO term: the 118 terms shared by sheets K and M have identical counts in both. Computing the accelerated count would need the Zenodo CNE alignments (cne.tar.gz, 153 MB) and a phyloP rerun, which was not done.'},
}
lat_rows = {x['species']: x['cells'][lat] for x in table}
out['lat4a_F326L_reading'] = {g: groups[g]['lat4a_326_residues'] for g in GROUP_ORDER}
json.dump(out, open(os.path.join(SEQ, 'progression.json'), 'w'), indent=1)

# markdown
L = []
L.append('# Progression: fin proportion and coding-site state across the beloniform series\n')
L.append('Built by `sequences/scripts/build_progression.py`; data in `progression.json`.\n')
L.append('## Read this first\n')
for x in out['read_this_first']:
    L.append(f'- {x}')
L.append('\nBirds are excluded from this file until the holdout exam runs.\n')
L.append('## The ladder by group\n')
L.append(f"| group (phylogenetic order) | species sequenced | pectoral fin / SL, group median (specimens) | lat4a site 326 residues | derived states at {len(cols)} sheet-G sites, mean (range) |")
L.append('|---|---|---|---|---|')
for g in GROUP_ORDER:
    x = groups[g]
    L.append(f"| {g} | {x['n_species_sequenced']} | {x['fin_ratio_group_median']} ({x['fin_ratio_n_specimens']}) | "
             f"{', '.join(f'{k}: {v}' for k, v in x['lat4a_326_residues'].items())} | {x['mean_derived_states_of_%d_sites' % len(cols)]} ({x['range_derived_states'][0]}-{x['range_derived_states'][1]}) |")
L.append('\nThe lat4a/slc43a2a site (medaka F326; Daane 2021 sheet G row 2) is the anchor: L in both gliding halfbeaks and in most flying fishes, F in every non-gliding species, read here directly from the captured exons. It is the only sheet-G gene that is also in our causal chains.\n')
L.append('## Species rows\n')
key_cols = [f"{c['gene']} {c['substitution']}" for c in cols if c['gene'] in ('lat4a', 'gja5a')]
L.append('| species | group | pectoral fin / SL (basis) | ' + ' | '.join(key_cols) + f' | derived / ancestral / other / not captured (of {len(cols)}) |')
L.append('|---|---|---|' + '---|' * len(key_cols) + '---|')
for x in table:
    L.append(f"| {x['species']} | {x['group']} | {x['fin_ratio']['pectoral_over_SL_median']} ({x['fin_ratio']['basis']}) | " +
             ' | '.join(str(x['cells'][k] or '.') for k in key_cols) +
             f" | {x['n_derived']} / {x['n_ancestral']} / {x['n_other_residue']} / {x['n_not_captured']} |")
L.append('\n"." = exon not captured for that species. gja5a G329V (row 3) is the other sheet-G site flagged by a fin/limb annotation; gja5a is not in our causal chains.\n')
L.append('## How much of the signal is not coding\n')
nc = out['non_coding_signal_per_branch']
L.append(f"- Convergent coding substitutions (sheet G): **{n_sheetG_rows} rows**, of which 2 are in genes with a fin/limb annotation (lat4a, gja5a).")
L.append(f"- Conserved non-coding elements captured by the design: **{n_cne_total}**.")
L.append(f"- GO terms enriched for ACCELERATED non-coding elements: **{kn}** on the flying-fish branch (sheet K), **{mn}** on the halfbeak branch (sheet M).")
L.append(f"- Coding genes on the flying-fish branch (sheet J phyloP, fin/limb set): {Jacc} accelerated, {Jcon} conserved.")
L.append('\nThe plain number asked for (accelerated non-coding elements against convergent coding substitutions) cannot be read from Data S1: the "# CNEs" column of sheets K and M is the total number of CNEs per GO term, not the accelerated number (the 118 terms shared by K and M carry identical counts). What the data do show is non-coding acceleration enriched across hundreds of gene categories, against a convergent coding signal of 44 rows. The coding ladder above is a slice.\n')
L.append('## Methods and limits\n')
L.append('- Residues are not copied from sheet G (which only ticks presence by group). Each site was re-read per species by aligning the current Ensembl protein for the sheet\'s gene ID to that species\' translated captured exons. A cell can be wrong if the captured exon is a paralogue scoring above 75% identity or if the exon was mistranslated.')
L.append(f"- {len(skipped)} sheet-G rows were not used (duplicate, synonymous as written, or reference residue no longer at that position in the current annotation); see `skipped_columns`.")
L.append('- Fin ratios exist for 9 measured species; other rows show their group median and say so. Euleptorhamphus viridis (sequenced) is shown with its congener E. velox (measured).')
L.append('- Group labels for genera absent from sheet A were assigned from the Zenodo species-tree clade.')
open(os.path.join(SEQ, 'PROGRESSION.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(json.dumps(groups, indent=1)); print(len(cols), 'cols;', len(skipped), 'skipped;', kmax, mmax)
