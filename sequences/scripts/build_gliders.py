"""Glider convergence test (scope addition 1): are the same residues changed in independently evolved gliders and fliers,
and do gliders resemble each other more than their own non-gliding relatives? Reads sequences/alignments/<gene>.json.
Writes sequences/gliders.json."""
import json, os, itertools, statistics
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__)); SEQ = os.path.dirname(HERE)
FOCAL = ['kcnk5b', 'kcnh2a', 'slc43a2a', 'gja1b', 'tbx5a', 'fgf10a', 'shha', 'hhip', 'prdm1a']
FLY = {'Cheilopogon_furcatus', 'Cheilopogon_papilio', 'Cheilopogon_xenopterus', 'Cypselurus_callopterus', 'Exocoetus_volitans',
       'Fodiator_rostratus', 'Hirundichthys_rondeleti', 'Parexocoetus_brachypterus', 'Prognichthys_tringa', 'Euleptorhamphus_viridis',
       'Oxyporhamphus_micropterus'}


def lineages(rows):
    """lineage -> (glider row names, control row names, note)"""
    daane = [r for r in rows if r.startswith('daane2021:')]
    L = {
        'beloniform fishes (flying fishes + gliding halfbeaks vs non-gliding halfbeaks + needlefishes)': (
            [r for r in daane if r.split(':')[1] in FLY] + [r for r in rows if r == 'hirundichthys_speculiger'],
            [r for r in daane if r.split(':')[1] not in FLY], 'independent gliding origins inside this order are pooled: a residue must be shared by all gliders here to count'),
        'marsupials (sugar glider vs common brushtail possum)': (['ncbi:Petaurus_breviceps'], ['ncbi:Trichosurus_vulpecula'], ''),
        'Dermoptera (colugos vs human as nearest available non-gliding relative)': (
            ['ncbi:Galeopterus_variegatus', 'ncbi:Cynocephalus_volans'], ['homo_sapiens'], 'colugos are closest to primates; no treeshrew in the panel'),
        'geckos (parachute gecko vs Gekko japonicus)': (['ncbi:Gekko_kuhli'], ['ncbi:Gekko_japonicus'], 'Gekko kuhli has only gja1b and prdm1a'),
        'bats, powered fliers (three bats vs mouse + human)': (
            ['myotis_lucifugus', 'pteropus_vampyrus', 'rhinolophus_ferrumequinum'], ['mus_musculus', 'homo_sapiens'],
            'weak control: bats are Laurasiatheria and the panel has no non-flying laurasiatherian'),
    }
    return {k: ([r for r in g if r in rows], [r for r in c if r in rows], n) for k, (g, c, n) in L.items()}


def state(aln, names, col):
    res = [aln[n][col] for n in names if aln[n][col] not in '-X']
    if not res or len(set(res)) != 1:
        return None  # missing or not unanimous
    return res[0]


def ident(a, b):
    p = [(x, y) for x, y in zip(a, b) if x not in '-X' and y not in '-X']
    return 100 * sum(x == y for x, y in p) / len(p) if len(p) >= 50 else None


out_genes = {}
tot = Counter()
for g in FOCAL:
    a = json.load(open(os.path.join(SEQ, 'alignments', f'{g}.json')))
    aln = a['alignment']; rows = list(aln)
    lin = {k: v for k, v in lineages(rows).items() if v[0] and v[1]}
    ncol = len(next(iter(aln.values())))
    changed = Counter(); glider_conv, control_conv = [], []
    for c in range(ncol):
        st = {}
        for k, (gl, ct, _) in lin.items():
            sg, sc = state(aln, gl, c), state(aln, ct, c)
            if sg and sc:
                st[k] = (sg, sc)
        ch = {k: v for k, v in st.items() if v[0] != v[1]}
        for k in ch: changed[k] += 1
        if len(ch) >= 2:
            for k1, k2 in itertools.combinations(ch, 2):
                (g1, c1), (g2, c2) = ch[k1], ch[k2]
                if g1 == g2 and g1 != c1 and g2 != c2:
                    glider_conv.append({'column': c + 1, 'lineages': [k1, k2], 'glider_residue': g1, 'control_residues': [c1, c2]})
                if c1 == c2 and c1 != g1 and c2 != g2:
                    control_conv.append({'column': c + 1, 'lineages': [k1, k2], 'control_residue': c1, 'glider_residues': [g1, g2]})
    # similarity: cross-lineage pairs
    gg, gc, cc = [], [], []
    keys = list(lin)
    for k1, k2 in itertools.combinations(keys, 2):
        for x in lin[k1][0]:
            for y in lin[k2][0]:
                v = ident(aln[x], aln[y]); gg.append(v) if v is not None else None
        for x, y in [(p, q) for p in lin[k1][0] for q in lin[k2][1]] + [(p, q) for p in lin[k2][0] for q in lin[k1][1]]:
            v = ident(aln[x], aln[y]); gc.append(v) if v is not None else None
        for x in lin[k1][1]:
            for y in lin[k2][1]:
                v = ident(aln[x], aln[y]); cc.append(v) if v is not None else None
    m = lambda v: round(statistics.mean(v), 1) if v else None
    out_genes[g] = {'lineages_used': {k: {'gliders': v[0], 'controls': v[1], 'note': v[2]} for k, v in lin.items()},
                    'columns': ncol, 'columns_where_glider_differs_from_its_control': dict(changed),
                    'glider_convergent_columns': glider_conv, 'control_convergent_columns_baseline': control_conv,
                    'n_glider_convergent': len(glider_conv), 'n_control_convergent_baseline': len(control_conv),
                    'mean_identity_cross_lineage': {'glider_vs_glider': m(gg), 'glider_vs_other_lineage_control': m(gc), 'control_vs_control': m(cc)}}
    tot['glider'] += len(glider_conv); tot['control'] += len(control_conv)
    print(g, len(glider_conv), len(control_conv), out_genes[g]['mean_identity_cross_lineage'])

lat = json.load(open(os.path.join(SEQ, 'alignments', 'slc43a2a.json')))['variants'][0]['residues']
gl = json.load(open('C:/Temp/sequences/gliders_raw.json'))
out = {
    'title': 'Gliders and fliers across lineages: same genes, same residues?',
    'question': 'Gliding evolved independently many times. At the focal fin genes, do independent gliders share derived residues, and do gliders resemble each other more than they resemble their own non-gliding relatives?',
    'birds_excluded': 'Birds (class Aves) are excluded until the project holdout exam runs.',
    'pterosaurs': 'Pterosaurs are extinct (Mesozoic) and have no DNA; no sequence comparison is possible.',
    'gene_set_caveat': 'The nine genes were chosen from zebrafish fin biology, not from glider biology, so absence of convergence here says nothing about the rest of the genome.',
    'method': {
        'per_column_state': 'For each lineage, the glider state at an alignment column is the residue shared by all its glider rows (unanimous, gaps ignored); the control state likewise. A lineage "changed" at a column when the two differ.',
        'glider_convergent_column': 'two or more lineages changed AND their glider residues are identical AND that residue differs from each lineage control.',
        'baseline': 'control_convergent: the same count with the roles swapped (controls share a residue that both gliders left). With no glider-specific signal the two counts are expected to be similar; neither is a significance test.',
        'identity': 'mean percent identity over aligned residue pairs (>= 50 pairs), cross-lineage pairs only.'},
    'panel': {'annotated_species_used': {k: {'role': v['role'], 'desc': v['desc'], 'assembly': v['assembly'], 'note': v.get('note'),
                                             'genes_found': [g for g, x in v['genes'].items() if x]} for k, v in gl['species'].items()},
              'gliders_without_usable_protein_data': {k: v[1] for k, v in gl['not_annotated'].items()},
              'not_annotated_detail': 'NCBI protein holds only 77-291 scattered records (mitochondrial and marker genes) for each of these; none for the focal genes.'},
    'lat4a_site_326_across_gliders': {n: (r['residue']) for n, r in lat.items() if not n.startswith('daane2021:')},
    'totals': {'glider_convergent_columns': tot['glider'], 'control_convergent_columns_baseline': tot['control']},
    'genes': out_genes,
}
gfl = {n: r['residue'] for n, r in lat.items() if n.startswith('ncbi:') or n in ('myotis_lucifugus', 'pteropus_vampyrus', 'rhinolophus_ferrumequinum')}
out['reading'] = (f"Across the nine fin genes, {tot['glider']} alignment columns show a residue shared by gliders of two or more lineages "
                  f"and absent from their non-gliding relatives, against {tot['control']} columns for the role-swapped baseline. "
                  f"At the lat4a site where flying fishes and gliding halfbeaks carry L, every other glider and flier with data carries "
                  f"{'/'.join(sorted(set(v for v in gfl.values() if v)))}: the fish convergence does not extend to mammals. Gliders do not resemble "
                  f"each other more than they resemble other lineages' non-gliders (see mean_identity_cross_lineage): identity follows ancestry, not gliding. "
                  f"Most of the few 'convergent' columns pair colugos with bats, two lineages whose control is the same human sequence, so a human-specific residue alone produces them; they are not evidence of shared glider biology.")
json.dump(out, open(os.path.join(SEQ, 'gliders.json'), 'w'), indent=1)
print(out['reading'])
