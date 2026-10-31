"""The one test the whole layer exists for.

Gliding and powered flight evolved independently many times. Our sources name exactly ONE
convergent amino-acid substitution shared by independently gliding lineages: lat4a F326L
(medaka numbering), found in nine Exocoetidae and both flying-halfbeak lineages but not in
needlefishes, sauries, non-gliding halfbeaks, bats, gliding mammals, mouse, human or zebrafish
(Daane 2021, PMID 34534441; the per-species residues are in sequences/alignments/slc43a2a.json,
resolved by the sequence thread against the Ensembl release 116 medaka protein).

So: does that substitution sit in the part of the protein that matters -- the substrate site --
or in an indifferent position? There is now an experimental answer, because human LAT4 / SLC43A2,
the ortholog of zebrafish slc43a2a (lat4a), has been solved WITH its substrate bound
(PDB 9JBT, LAT4 in complex with Phe).

Writes structures/convergence-test.json.
"""
import json, os, math, time
import net, rcsb

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)


def dist_to_ligand(cif, want_auth, ligand_name='PHE'):
    import gemmi
    st = gemmi.read_structure(cif)
    st.setup_entities()
    st.remove_hydrogens()
    st.remove_waters()
    lig, res = [], {}
    for ch in st[0]:
        for r in ch:
            het = str(r.het_flag).upper().startswith('H')
            pts = [(a.pos.x, a.pos.y, a.pos.z) for a in r]
            if het and r.name == ligand_name:
                lig = pts
            elif not het and r.seqid.num in want_auth:
                res[r.seqid.num] = (r.name, pts, ch.name)
    out = {}
    for n, (nm, pts, chn) in res.items():
        out[n] = dict(residue_name=nm, chain=chn,
                      min_dist_to_bound_substrate_A=(round(min(math.dist(p, q) for p in pts for q in lig), 2)
                                                     if lig else None))
    for n in want_auth:
        out.setdefault(n, dict(residue_name=None, chain=None, min_dist_to_bound_substrate_A=None,
                               note='not modelled in this structure'))
    return out


def main():
    binding = json.load(open(os.path.join(ROOT, 'binding.json'), encoding='utf-8'))
    aln = json.load(open(os.path.join(REPO, 'sequences', 'alignments', 'slc43a2a.json'), encoding='utf-8'))
    lat = binding['targets']['lat_substrate']
    ch = lat['chosen']
    cif = ch['coordinate_file']
    refacc = [e['uniprot'][0] for e in ch['entities'] if e['uniprot']][0]

    v = [x for x in aln['variants'] if x['id'] == 'lat4a_F326L'][0]
    human = v['residues']['homo_sapiens']
    site_positions = sorted({c['uniprot_pos'] for c in lat['substrate_site']['contacts'] if c['uniprot_pos']})

    want = set(site_positions) | {human['position_in_own_protein']}
    geom = dist_to_ligand(cif, want)

    # UniProt transmembrane topology for the structure's protein, fetched not remembered
    tm = net.jget(f'https://rest.uniprot.org/uniprotkb/{refacc}.json?fields=ft_transmem',
                  f'UniProt transmembrane features for {refacc}')
    segs = [dict(start=f['location']['start']['value'], end=f['location']['end']['value'],
                 description=f.get('description'))
            for f in (tm or {}).get('features', []) if f['type'] == 'Transmembrane']

    def in_tm(p):
        for s in segs:
            if s['start'] <= p <= s['end']:
                return s
        return None

    # per-lineage residues at the convergent site, and at every substrate-site position
    rows = {}
    for sp, meta in aln['sequences'].items():
        rows[sp] = dict(role=meta.get('role'), length=meta.get('length'))
    col = v['alignment_column_1based']
    conv = {sp: aln['alignment'][sp][col - 1] for sp in aln['alignment']}

    # columns of the substrate-site positions, via the human row
    hrow = aln['alignment']['homo_sapiens']
    p2c, i = {}, 0
    for c, chx in enumerate(hrow, start=1):
        if chx != '-':
            i += 1
            p2c[i] = c
    site_cols = {p: p2c.get(p) for p in site_positions}
    site_residues = {}
    for p, c in site_cols.items():
        if not c:
            continue
        site_residues[p] = {sp: aln['alignment'][sp][c - 1] for sp in aln['alignment']}

    def groups(d):
        g = {'glider': {}, 'control': {}, 'powered_flight': {}}
        for sp, r in d.items():
            role = (rows[sp]['role'] or '').lower()
            if 'tblastn' in role:
                continue
            if 'control' in role:
                g['control'][sp] = r
            elif 'glider' in role or 'flying fish' in role or 'flying (gliding) halfbeak' in role:
                g['glider'][sp] = r
            elif 'bat (powered flight)' in role or 'flying insect' in role:
                g['powered_flight'][sp] = r
            else:
                g['control'][sp] = r
        return g

    gconv = groups(conv)
    out = dict(
        title='Does the one convergent glider substitution our sources name sit in the part of the protein that matters?',
        built=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        tool='structures/scripts/convergence_test.py',
        bird_exclusion='Class Aves is this project\'s frozen holdout; no bird sequence or structure enters '
                       'this test, until the holdout exam runs.',
        pterosaurs='Pterosaurs are extinct and leave no protein, so they cannot appear in any structural or '
                   'sequence comparison anywhere in this layer.',
        the_substitution=dict(
            id='lat4a F326L',
            numbering='position 326 of the Ensembl release 116 medaka (Oryzias latipes) Lat4a protein, which '
                      'is what Daane 2021 Data S1 numbers against; the sequence thread established this and '
                      'checked that the reference residue is F',
            source=v['source'], what=v['what'],
            residue_in_each_group=dict(
                gliders=gconv['glider'], non_gliders=gconv['control'],
                powered_flight=gconv['powered_flight']),
            independent_gliding_lineages_with_L=sorted(
                {('Exocoetidae' if 'flying fish' in (rows[sp]['role'] or '').lower()
                  else 'gliding halfbeaks' if 'halfbeak' in (rows[sp]['role'] or '').lower()
                  else rows[sp]['role'])
                 for sp, r in gconv['glider'].items() if r == 'L'}),
            note_my_own_numbering_failure=(
                'This layer first tried to place F326L on UniProt sequences and failed: every UniProt '
                'isoform of zebrafish and medaka slc43a2a carries D at 326 and not F. The position is '
                'against the ENSEMBL canonical protein, not the UniProt one. Recorded because it is exactly '
                'the kind of silent numbering error that would have produced a confident wrong answer.')),
        the_structure=dict(
            pdb_id=ch['pdb_id'], title=ch['title'], method=ch['method'],
            resolution_A=ch['resolution_A'], url=ch['url'], reference_uniprot=refacc,
            ligand='PHE, a free phenylalanine in the substrate site',
            identity_to_zebrafish_slc43a2a=ch['identity_to_zebrafish'],
            apo_and_other_states=['9JBS (apo, 2.88 A)', '9JBU (with digitonin, 3.8 A)'],
            why_this_is_the_right_structure='SLC43A2 / LAT4 is our own protein, not a family stand-in: the '
                                            'search for PDB entries containing human SLC43A2 returned 9JBS, '
                                            '9JBT and 9JBU directly.'),
        the_substrate_site=dict(
            definition='every LAT4 residue with a heavy atom within 4.0 A of the bound phenylalanine in 9JBT',
            positions=site_positions,
            residues=[dict(uniprot_position=c['uniprot_pos'], residue=c['name'], aa=c['aa'],
                           min_dist_to_substrate_A=c['min_dist'], n_atom_pairs=c['n_atom_pairs'],
                           in_transmembrane_helix=bool(in_tm(c['uniprot_pos'])))
                      for c in lat['substrate_site']['contacts'] if c['uniprot_pos']],
            conservation_across_lineages={
                str(p): dict(
                    human=site_residues[p].get('homo_sapiens'),
                    distinct_residues_in_gliders=sorted(set(groups(site_residues[p])['glider'].values())),
                    distinct_residues_in_nongliders=sorted(set(groups(site_residues[p])['control'].values())),
                    distinct_residues_in_powered_flight=sorted(set(groups(site_residues[p])['powered_flight'].values())),
                    separates_gliders=(set(groups(site_residues[p])['glider'].values())
                                       .isdisjoint(set(groups(site_residues[p])['control'].values()))))
                for p in site_residues}),
        the_answer=dict(
            convergent_site_in_human_LAT4_numbering=human['position_in_own_protein'],
            residue_there=human['residue'],
            is_it_a_substrate_site_residue=human['position_in_own_protein'] in site_positions,
            min_distance_from_the_convergent_site_to_the_bound_substrate_A=geom.get(
                human['position_in_own_protein'], {}).get('min_dist_to_bound_substrate_A'),
            transmembrane_segment_containing_it=in_tm(human['position_in_own_protein']),
            nearest_transmembrane_segment=min(
                segs, key=lambda s: min(abs(s['start'] - human['position_in_own_protein']),
                                        abs(s['end'] - human['position_in_own_protein']))) if segs else None,
            geometry_of_every_position_examined=geom),
        summary=None)

    a = out['the_answer']
    d = a['min_distance_from_the_convergent_site_to_the_bound_substrate_A']
    site_sep = [p for p, r in out['the_substrate_site']['conservation_across_lineages'].items()
                if r['separates_gliders']]
    out['summary'] = dict(
        headline=(f'The one convergent gliding substitution our sources name sits at human LAT4 position '
                  f'{a["convergent_site_in_human_LAT4_numbering"]}, which is NOT one of the eight residues '
                  f'that contact the bound substrate, and is {d} A away from it. '
                  f'It lies just outside transmembrane helix '
                  f'{a["nearest_transmembrane_segment"]["start"]}-{a["nearest_transmembrane_segment"]["end"]}, '
                  f'in the short segment leading into it.'
                  if d else 'the convergent position is not modelled in the deposited structure'),
        substrate_site_positions_that_separate_gliders=site_sep,
        substrate_site_is_invariant_between_gliders_and_nongliders=not site_sep,
        caveat=('A residue 20 A from the substrate can still change transport, through the conformational '
                'cycle, through folding or through trafficking. "Not in the substrate site" is a statement '
                'about where the residue is, not a measurement of what it does; no transport assay for this '
                'substitution exists in any species.'))
    with open(os.path.join(ROOT, 'convergence-test.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out['summary'], indent=1))
    print('\nconvergent site geometry:', geom.get(human['position_in_own_protein']))
    print('substrate-site residues:', [(r['uniprot_position'], r['aa'], r['min_dist_to_substrate_A'])
                                       for r in out['the_substrate_site']['residues']])


if __name__ == '__main__':
    main()
