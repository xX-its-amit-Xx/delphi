"""Engineered-genome diff and genome-wide context. Also finalises sequences/genes.json.
(a) edits and their kinds; (b) protein identity of each edited gene before/after the edit, to the zebrafish reference and to
each comparison species (from the MAFFT alignments); (c) context: zebrafish's orthologue protein identity to each species across
all causal-chain genes with Ensembl orthologues (a median across focal genes, labelled as such, not a genome-wide measurement)."""
import json, os, statistics
from collections import OrderedDict
from Bio import Align
from Bio.Align import substitution_matrices
HERE = os.path.dirname(os.path.abspath(__file__)); SEQ = os.path.dirname(HERE); T = 'C:/Temp/sequences'
SPECIES = ['oryzias_latipes', 'hirundichthys_speculiger', 'myotis_lucifugus', 'pteropus_vampyrus', 'rhinolophus_ferrumequinum',
           'mus_musculus', 'homo_sapiens', 'drosophila_melanogaster']

def aln(g): return json.load(open(os.path.join(SEQ, 'alignments', f'{g}.json')))

def col_of(a, sp, pos):
    p = 0
    for i, c in enumerate(a['alignment'][sp]):
        if c != '-':
            p += 1
            if p == pos: return i
    return None

def ident_rows(x, y):
    pr = [(a, b) for a, b in zip(x, y) if a not in '-X' and b not in '-X']
    return (round(100 * sum(a == b for a, b in pr) / len(pr), 2), len(pr)) if pr else (None, 0)

def apply_edit(row, col, alt):
    if alt == '*':   # truncation: everything from this column on is lost
        return row[:col] + '-' * (len(row) - col)
    return row[:col] + alt + row[col + 1:]

def edit_effect(g, pos, alt, coord_species='danio_rerio', label=''):
    a = aln(g); A = a['alignment']
    c = col_of(a, coord_species, pos)
    z = A['danio_rerio']
    zc = sum(1 for ch in z[:c + 1] if ch != '-') if z[c] != '-' else None
    mut = apply_edit(z, c, alt)
    ref_len = len(z.replace('-', ''))
    res = OrderedDict([('gene', g), ('edit', label), ('alignment_column', c + 1), ('zebrafish_position', zc),
                       ('zebrafish_residue_before', z[c]), ('residue_after', alt)])
    res['identity_to_unedited_reference'] = {'before': 100.0, 'after': ident_rows(z, mut)[0],
                                             'fraction_of_reference_protein_retained': round(len(mut.replace('-', '')) / ref_len, 3)}
    per = OrderedDict()
    for sp in SPECIES + [k for k in A if k.startswith('ncbi:')]:
        if sp not in A: continue
        b, nb = ident_rows(z, A[sp]); af, na = ident_rows(mut, A[sp])
        per[sp] = {'residue_at_site': A[sp][c] if A[sp][c] != '-' else None, 'identity_before': b, 'identity_after': af,
                   'aligned_pairs_before': nb, 'aligned_pairs_after': na}
    res['identity_to_species'] = per
    return res

sel = json.load(open(f'{T}/selected.json'))
# (c) context: pairwise global alignment zebrafish vs each species, all genes with orthologues
al = Align.PairwiseAligner(); al.substitution_matrix = substitution_matrices.load('BLOSUM62')
al.open_gap_score = -10; al.extend_gap_score = -0.5; al.mode = 'global'
ctx = {sp: [] for sp in SPECIES if sp != 'hirundichthys_speculiger'}
ens = {sp: [] for sp in ctx}
per_gene = {}
for g, s in sel.items():
    if 'danio_rerio' not in s: continue
    z = s['danio_rerio']['seq']; per_gene[g] = {}
    for sp in ctx:
        if sp not in s: continue
        x = al.align(z, s[sp]['seq'])[0]
        a1, a2 = x[0], x[1]
        pr = [(p, q) for p, q in zip(a1, a2) if p != '-' and q != '-']
        idv = 100 * sum(p == q for p, q in pr) / len(pr)
        diffs = sum(p != q for p, q in pr) + sum(1 for p, q in zip(a1, a2) if (p == '-') != (q == '-'))
        subs = sum(p != q for p, q in pr)
        ctx[sp].append((g, idv, diffs, subs)); ens[sp].append(s[sp]['ensembl_perc_id_zebrafish'])
        per_gene[g][sp] = {'identity': round(idv, 1), 'aa_substitutions': subs, 'aa_differences_incl_indel_positions': diffs}
context = OrderedDict()
for sp, v in ctx.items():
    if not v: continue
    context[sp] = {'n_genes': len(v), 'median_identity_pct': round(statistics.median(x[1] for x in v), 1),
                   'range': [round(min(x[1] for x in v), 1), round(max(x[1] for x in v), 1)],
                   'median_ensembl_perc_id_of_zebrafish_protein': round(statistics.median(ens[sp]), 1),
                   'total_aa_substitutions_in_these_genes': sum(x[3] for x in v),
                   'total_aa_differences_in_these_genes': sum(x[2] for x in v)}

# (a)+(b) edits
winged = [edit_effect('slc43a2a', 200, 'K', label='lat4a nr21 T200K (heterozygous)')]
flier_routes = [
    edit_effect('hhip', 295, '*', label='hhip uki hu418B Y295* nonsense (loss of function; largest measured pectoral fin area increase, +65%)'),
    edit_effect('kcnk5b', 169, 'L', label='kcnk5b W169L (alf, hyperactive channel)'),
    edit_effect('gja1b', 154, 'A', label='Cx43 T154A dominant negative (delivered as a transgene in the source, not as an edit of the locus)'),
    edit_effect('slc43a2a', 326, 'L', coord_species='oryzias_latipes', label='lat4a F326L, the flying-fish/gliding-halfbeak residue placed into zebrafish (HYPOTHETICAL: never engineered or tested in any species)'),
]
w_sites = 2
out = OrderedDict()
out['title'] = 'How different is an "engineered" genome? A diff against the zebrafish reference, set beside natural divergence'
out['what_an_engineered_genome_is_here'] = ('Not a full genome. It is a short list of edits to the zebrafish reference (GRCz11). The winged zebrafish is a real '
    'animal (genotype/compare-2x2.json panel B); the truly flying fish is hypothetical (genotype/flier-genome.json), whose own verdict is that no route reaches the requirement.')
out['winged_zebrafish'] = {
    'source': 'genotype/compare-2x2.json panel B; genotype/interventions.json kcnh2a-lof-x-lat4a-nr21-double-het',
    'edited_sites': w_sites,
    'kinds': [{'locus': 'slc43a2a (lat4a), chromosome 15', 'kind': 'coding, missense, 1 amino acid (T200K), heterozygous',
               'nucleotides_changed': 'not given in the fetched sources; a T->K codon change needs at least 1 nucleotide'},
              {'locus': 'kcnh2a (longfin lof dt2), chromosome 2', 'kind': 'structural, cis-regulatory inversion placing prrx1a regulatory sequence upstream of kcnh2a; coding sequence unchanged, heterozygous',
               'nucleotides_changed': 'inversion size not given in the fetched sources; 0 amino acids changed', 'protein_identity_change': 'none (0 amino acids changed); the effect is ectopic expression'}],
    'amino_acids_changed': 1,
    'protein_effects': winged,
}
out['hypothetical_flier'] = {
    'source': 'genotype/flier-genome.json item 1 candidate_routes (coding routes with a named protein change and direction "increase"), plus the untested lat4a F326L import (compare-2x2 panel D logic)',
    'edited_sites': len(flier_routes),
    'not_modelled_here': ['kcnk5b exon-5 truncations (no single site given)', 'item 2 muscle: mstn knockout reported in red sea bream, not a zebrafish edit with a site',
                          'item 3 oxygen delivery: no genetic route exists', 'item 4 air breathing: routes are anatomical and correlative, no site-level edit',
                          'kcnh2a regulatory inversion (as above: no amino-acid change)'],
    'protein_effects': flier_routes,
    'verdict_carried_from_flier_genome': 'No requirement has a route that reaches it; this list is the edits one could name, not a design that would fly.'}
out['context_natural_divergence'] = {
    'label': 'median orthologue protein identity of zebrafish to each species ACROSS THE PROJECT CAUSAL-CHAIN GENES with Ensembl orthologues (not a genome-wide measurement)',
    'method': 'Biopython PairwiseAligner global, BLOSUM62, gap open -10, extend -0.5; identity = identical / aligned residue pairs; differences = mismatches + positions in indels',
    'per_species': context, 'per_gene': per_gene}
hum = context.get('homo_sapiens', {}); med = context.get('oryzias_latipes', {}); bat = context.get('myotis_lucifugus', {})
out['headline'] = (f"The winged zebrafish differs from its reference by {w_sites} edited loci and 1 amino acid. In just the {med.get('n_genes')} causal-chain proteins "
                   f"with medaka orthologues, zebrafish and medaka (same class, different orders) differ by {med.get('total_aa_substitutions_in_these_genes')} amino-acid substitutions ({med.get('total_aa_differences_in_these_genes')} positions counting indels) "
                   f"(median identity {med.get('median_identity_pct')}%); zebrafish and a bat (Myotis) by {bat.get('total_aa_substitutions_in_these_genes')} substitutions in {bat.get('n_genes')} proteins "
                   f"(median {bat.get('median_identity_pct')}%); zebrafish and human by {hum.get('total_aa_substitutions_in_these_genes')} substitutions in {hum.get('n_genes')} proteins. "
                   "A handful of edits against thousands of differences in a few dozen proteins, and these are only the coding differences in a tiny gene sample: "
                   "the genome-wide difference, coding and non-coding, was not measured here and is necessarily larger.")
json.dump(out, open(os.path.join(SEQ, 'engineered-diff.json'), 'w'), indent=1)
print(out['headline'])
print(json.dumps({k: {kk: vv for kk, vv in v.items()} for k, v in context.items()}, indent=0))
for e in winged + flier_routes:
    print(e['edit'][:40], e['zebrafish_residue_before'], e['zebrafish_position'], e['identity_to_unedited_reference'], {k: (v['residue_at_site'], v['identity_before'], v['identity_after']) for k, v in list(e['identity_to_species'].items())[:4]})

# finalise genes.json
gp = json.load(open(f'{T}/genes_partial.json'))
gj = OrderedDict()
gj['title'] = 'Focal genes: orthologue protein sequences across zebrafish, medaka, flying fish, bats, non-flying mammals, a flying insect and gliders'
gj['ensembl_release'] = 116
gj['birds_excluded'] = 'Birds (class Aves) are this project\'s frozen holdout and are excluded until the holdout exam runs.'
gj['pterosaurs'] = 'Pterosaurs are extinct (Mesozoic) and have no DNA: no sequence comparison is possible; their only comparison is morphological (physics/flier/PRIOR-ART-FLIER.md).'
gj['flying_fish_status'] = ('Annotated Hirundichthys speculiger proteins exist (Xu et al. 2021, Front Genet 12:695700; figshare 10.6084/m9.figshare.14600634.v1, pep.fa, 13 MB) '
    'for the same assembly as GCA_018398805.1 (which NCBI holds unannotated). Orthologues were called by reciprocal best blastp hit to the zebrafish proteome; '
    'where that fails (kcnh2a, shha) the alignment uses tblastn hits on the assembly, labelled. Medaka (Beloniformes) remains in every alignment as the closest '
    'Ensembl-annotated relative. H. speculiger is not one of the species measured for fin length by Daane 2021, so it is cross-species within the family.')
gj['drosophila_note'] = 'Drosophila orthologues exist in Ensembl for kcnk5b, kcnh2a, tbx5a and prdm1a only, all many-to-many or one-to-many and distant (26-52% identity); none for slc43a2a, gja1b (insects use innexins, not connexins), fgf10a, shha or hhip under these Ensembl calls. Insect wings are not homologous to vertebrate limbs or fins.'
gj['genes'] = gp['genes']
gj['aligner'] = gp['mafft']
json.dump(gj, open(os.path.join(SEQ, 'genes.json'), 'w'), indent=1)
