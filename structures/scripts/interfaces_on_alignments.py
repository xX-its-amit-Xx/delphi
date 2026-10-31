"""Deliverable 3, part 5 (the real test): put the experimental interface positions onto the
sequence thread's MAFFT alignments, which contain many more lineages than UniProt does, and ask
whether any interface position separates gliders from non-gliders.

Why this and not my own pairwise alignments: sequences/alignments/*.json (built by the other
agent in this session) hold MAFFT L-INS-i alignments that include NINE Exocoetidae, TWO flying
halfbeaks, the sugar glider, TWO colugos and a parachute gecko, each with matched non-gliding
controls (needlefishes, sauries, non-gliding halfbeaks, a tree squirrel, a non-gliding gecko).
UniProt has essentially none of those. So the glider-vs-non-glider test only has power here.

Chain of coordinates, and where it can break:
  deposited coordinates -> structure's reference UniProt (SIFTS, from RCSB)
  -> that species' row in the MAFFT alignment (checked residue by residue, or by a pairwise
     alignment when the PDB reference and the Ensembl canonical protein differ)
  -> alignment column -> every other species' residue in that column
"""
import json, os, re, time, collections
import net

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)
ALN = os.path.join(REPO, 'sequences', 'alignments')

# our panel protein -> the alignment file the sequence thread wrote
FILE = {'hhip': 'hhip.json', 'shha': 'shha.json', 'gja1b': 'gja1b.json',
        'kcnk5b': 'kcnk5b.json', 'kcnh2a': 'kcnh2a.json', 'slc43a2a': 'slc43a2a.json'}

# which row of the alignment is the species the structure comes from
REF_ROW = {'hhip': 'homo_sapiens', 'shha': 'homo_sapiens', 'gja1b': 'homo_sapiens',
           'kcnk5b': 'mus_musculus', 'kcnh2a': 'homo_sapiens', 'slc43a2a': 'homo_sapiens'}


def classify(role):
    r = (role or '').lower()
    if 'glider' in r or 'flying fish' in r or 'flying (gliding) halfbeak' in r:
        if 'control' in r:
            return 'control'
        return 'glider'
    if 'bat (powered flight)' in r:
        return 'powered_flight'
    if 'flying insect' in r:
        return 'powered_flight_insect'
    return 'control'


def lineage(species, role):
    """Independent gliding lineage, so that nine flying fishes do not count as nine lineages."""
    r = (role or '').lower()
    s = species.lower()
    if 'flying fish' in r:
        return 'Exocoetidae (gliding fishes)'
    if 'flying (gliding) halfbeak' in r:
        return 'gliding halfbeaks (Hemiramphidae)'
    if 'colugo' in r:
        return 'Dermoptera (colugos)'
    if 'marsupial' in r and 'glider' in r:
        return 'Petauridae (sugar glider)'
    if 'gecko' in r and 'glider' in r:
        return 'parachute gecko (Gekkonidae)'
    if 'squirrel' in r and 'glider' in r:
        return 'flying squirrels (Sciuridae)'
    return None


def ungap(s):
    return s.replace('-', '')


def seq_of(acc):
    b = net.get(f'https://rest.uniprot.org/uniprotkb/{acc}.fasta', f'UniProt FASTA {acc}',
                accept='text/plain')
    if not b:
        return None
    return ''.join(l.strip() for l in b.decode().splitlines()[1:] if not l.startswith('>'))


def pos_to_col(row):
    """1-based residue position in the ungapped row -> 1-based alignment column."""
    out, i = {}, 0
    for c, ch in enumerate(row, start=1):
        if ch != '-':
            i += 1
            out[i] = c
    return out


def pairwise(a, b):
    from Bio import Align
    al = Align.PairwiseAligner(scoring='blastp', mode='global')
    al.open_gap_score, al.extend_gap_score = -11, -1
    aln = al.align(a, b)[0]
    s1, s2 = str(aln[0]), str(aln[1])
    m = {}
    i = j = 0
    same = cols = 0
    for x, y in zip(s1, s2):
        if x != '-':
            i += 1
        if y != '-':
            j += 1
        if x != '-' and y != '-':
            m[i] = j
            cols += 1
            same += (x == y)
    return m, (round(100 * same / cols, 1) if cols else None)


def main():
    binding = json.load(open(os.path.join(ROOT, 'binding.json'), encoding='utf-8'))
    out = dict(
        title='Experimental interface positions tested across lineages, on the sequence thread\'s MAFFT alignments',
        built=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        tool='structures/scripts/interfaces_on_alignments.py',
        builds_on=('sequences/alignments/*.json, written by the sequence-alignment agent in this same '
                   'session (MAFFT v7.526 --localpair --maxiterate 1000, Ensembl release 116 canonical '
                   'proteins plus NCBI and Daane 2021 Data S1 rows). This layer did not realign anything; '
                   'it reads their columns.'),
        bird_exclusion='Class Aves is this project\'s frozen holdout; no bird row appears in these '
                       'alignments and none was added here, until the holdout exam runs.',
        method=dict(
            step1='Interface positions come from the deposited coordinates (structures/binding.json), in the '
                  'structure\'s reference UniProt numbering via RCSB\'s SIFTS alignment.',
            step2='The structure\'s own species row in the MAFFT alignment is checked against the PDB '
                  'reference sequence. Identical sequences map 1:1; otherwise a pairwise alignment is '
                  'composed and its identity is reported.',
            step3='The interface position becomes an alignment column, and every species\' residue in that '
                  'column is read off.',
            rule=('A column separates gliders from non-gliders only when every glider residue differs from '
                  'every non-glider residue, at least TWO INDEPENDENT gliding lineages carry the glider '
                  'residue, and at least five non-gliders are scored. Lineages are counted as lineages: the '
                  'nine Exocoetidae are one.'),
            limits=['Gap columns are gaps, not differences.',
                    'Rows the sequence thread marked as tblastn projections rather than annotated proteins '
                    'are flagged and excluded from the separation test.',
                    'The structures are human (and one mouse) proteins; every fish, reptile, amphibian and '
                    'insect residue is reached by a cross-species jump.',
                    'Interface membership is a 4.0 A heavy-atom cutoff in one deposited conformation.']),
        interfaces=[], summary={})

    SIDE_PROTEIN = {
        ('shh_hhip', 'partnerA'): 'shha', ('shh_hhip', 'partnerB'): 'hhip',
        ('shh_ptch1', 'partnerA'): 'shha',
        ('shh_cdo_boc', 'partnerA'): 'shha',
        ('cx43_channel', 'partnerA'): 'gja1b', ('cx43_channel', 'partnerB'): 'gja1b',
        ('k2p_dimer', 'partnerA'): 'kcnk5b', ('k2p_dimer', 'partnerB'): 'kcnk5b',
        ('herg_tetramer', 'partnerA'): 'kcnh2a', ('herg_tetramer', 'partnerB'): 'kcnh2a',
    }

    cache = {}

    def load_aln(pk):
        if pk not in cache:
            cache[pk] = json.load(open(os.path.join(ALN, FILE[pk]), encoding='utf-8'))
        return cache[pk]

    all_sep = []
    for key, t in binding['targets'].items():
        ch = t.get('chosen')
        if not ch:
            continue
        for iface in t.get('interfaces', []):
            for sideName in ('partnerA', 'partnerB'):
                pk = SIDE_PROTEIN.get((key, sideName))
                if not pk or pk not in FILE:
                    continue
                res = iface['interface_residues'][sideName]
                if not res:
                    continue
                refacc = res[0]['uniprot']
                a = load_aln(pk)
                refrow = REF_ROW[pk]
                if refrow not in a['alignment']:
                    continue
                row = a['alignment'][refrow]
                ens = ungap(row)
                pdbseq = seq_of(refacc)
                rec = dict(structure=ch['pdb_id'], resolution_A=ch['resolution_A'],
                           interface=iface['label'], side=sideName, our_protein=pk,
                           reference_uniprot=refacc, alignment_file=f'sequences/alignments/{FILE[pk]}',
                           alignment_reference_row=refrow,
                           alignment_reference_protein_id=a['sequences'][refrow].get('protein_id'))
                if pdbseq == ens:
                    direct, idp = {i: i for i in range(1, len(ens) + 1)}, 100.0
                    rec['pdb_reference_vs_alignment_row'] = 'identical sequences, positions map 1:1'
                else:
                    direct, idp = pairwise(pdbseq, ens)
                    rec['pdb_reference_vs_alignment_row'] = (
                        f'different records ({len(pdbseq)} vs {len(ens)} aa): composed through a pairwise '
                        f'alignment at {idp}% identity')
                rec['identity_pdb_reference_to_alignment_row'] = idp
                p2c = pos_to_col(row)
                rows = {}
                for sp, meta in a['sequences'].items():
                    role = meta.get('role', '')
                    rows[sp] = dict(role=role, group=classify(role), lineage=lineage(sp, role),
                                    projected=('tblastn' in role.lower()))
                table, unmapped = {}, 0
                for r in res:
                    e = direct.get(r['pos'])
                    col = p2c.get(e) if e else None
                    if not col:
                        unmapped += 1
                        continue
                    table[str(r['pos'])] = dict(
                        reference_residue=r['aa'], alignment_column=col,
                        residues={sp: a['alignment'][sp][col - 1] for sp in a['alignment']})
                rec['n_interface_positions'] = len(res)
                rec['n_positions_placed_on_the_alignment'] = len(table)
                rec['n_positions_unplaceable'] = unmapped
                rec['species_roles'] = rows
                # the test
                sep, shared, weak = [], 0, 0
                for p, cell in table.items():
                    gl = {sp: v for sp, v in cell['residues'].items()
                          if rows[sp]['group'] == 'glider' and not rows[sp]['projected'] and v != '-'}
                    ng = {sp: v for sp, v in cell['residues'].items()
                          if rows[sp]['group'] in ('control',) and not rows[sp]['projected'] and v != '-'}
                    if not gl or len(ng) < 5:
                        weak += 1
                        continue
                    gs, ns = set(gl.values()), set(ng.values())
                    lins = {rows[sp]['lineage'] for sp in gl if rows[sp]['lineage']}
                    if gs.isdisjoint(ns) and len(lins) >= 2:
                        sep.append(dict(reference_position=int(p), alignment_column=cell['alignment_column'],
                                        reference_residue=cell['reference_residue'],
                                        glider_residues=sorted(gs), nonglider_residues=sorted(ns),
                                        independent_glider_lineages=sorted(lins),
                                        n_gliders=len(gl), n_nongliders=len(ng),
                                        gliders={sp: v for sp, v in gl.items()}))
                    elif gs.isdisjoint(ns):
                        shared += 0
                        sep.append(dict(reference_position=int(p), alignment_column=cell['alignment_column'],
                                        reference_residue=cell['reference_residue'],
                                        glider_residues=sorted(gs), nonglider_residues=sorted(ns),
                                        independent_glider_lineages=sorted(lins),
                                        n_gliders=len(gl), n_nongliders=len(ng),
                                        fails_rule='fewer than two independent gliding lineages',
                                        gliders={sp: v for sp, v in gl.items()}))
                    else:
                        shared += 1
                passing = [s for s in sep if 'fails_rule' not in s]
                rec['result'] = dict(
                    positions_separating_gliders=passing,
                    n_separating=len(passing),
                    n_shared_between_gliders_and_nongliders=shared,
                    n_not_testable=weak,
                    near_misses_one_lineage_only=[s for s in sep if 'fails_rule' in s])
                rec['glider_rows_available'] = sorted(
                    {rows[sp]['lineage'] for sp in rows if rows[sp]['group'] == 'glider'
                     and rows[sp]['lineage']})
                out['interfaces'].append(rec)
                all_sep += [dict(protein=pk, interface=iface['label'], **s) for s in passing]
                print(f'{key:14s} {sideName} {pk:9s} {len(table):3d} positions placed, '
                      f'{len(passing)} separate gliders ({len(rec["glider_rows_available"])} glider '
                      f'lineages available), {shared} shared, {weak} not testable')

    out['summary'] = dict(
        interfaces_tested=len(out['interfaces']),
        interface_positions_placed=sum(r['n_positions_placed_on_the_alignment'] for r in out['interfaces']),
        positions_separating_gliders=len(all_sep),
        the_separating_positions=all_sep,
        positions_shared=sum(r['result']['n_shared_between_gliders_and_nongliders'] for r in out['interfaces']),
        near_misses_one_glider_lineage_only=sum(
            len(r['result']['near_misses_one_lineage_only']) for r in out['interfaces']))
    with open(os.path.join(ROOT, 'interfaces-across-lineages.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps({k: v for k, v in out['summary'].items() if k != 'the_separating_positions'}, indent=1))
    for s in all_sep:
        print('SEPARATES:', s['protein'], s['reference_position'], s['glider_residues'],
              'vs', s['nonglider_residues'], s['independent_glider_lineages'])


if __name__ == '__main__':
    main()
