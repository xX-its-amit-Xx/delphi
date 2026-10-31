"""Deliverable 3, part 4: map OUR species and OUR sourced variants onto the interface positions
read off the deposited structures, and ask whether any interface position separates gliders from
non-gliders.

Two analyses:

A. "Do our variants sit in the parts that matter?"  Each sourced variant position in the
   zebrafish protein is carried onto the chosen experimental structure by pairwise alignment,
   and then measured in the coordinates: is it an interface residue, how far is it from the
   partner chain, from a bound ligand, from a bound ion, and is it inside the selectivity filter?

B. "Do gliders differ from non-gliders at interface positions?"  Every panel species with a
   UniProt sequence is aligned to the structure's own reference sequence, and the residue at each
   interface position is tabulated. A position "separates gliders" only when every glider residue
   differs from every non-glider residue, with at least one glider and two non-gliders scored.

Coordinate mapping method and its uncertainty are recorded in the output.
"""
import json, os, time, collections
import net, rcsb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# structure target -> our panel protein, and which interface side is that protein
SIDE = {
    'shh_hhip':      dict(partnerA='shha', partnerB='hhip'),
    # build_chosen puts the regex-A partner (the hedgehog ligand) in partnerA for all three
    # hedgehog targets; PTCH1, CDO and BOC are not in our panel, so their side is None
    'shh_ptch1':     dict(partnerA='shha', partnerB=None),
    'shh_cdo_boc':   dict(partnerA='shha', partnerB=None),     # B = CDO (not in our panel)
    'cx43_channel':  dict(partnerA='gja1b', partnerB='gja1b'),
    'k2p_dimer':     dict(partnerA='kcnk5b', partnerB='kcnk5b'),
    'herg_tetramer': dict(partnerA='kcnh2a', partnerB='kcnh2a'),
}

# sourced variant positions, in ZEBRAFISH protein numbering (see variants/variants.json)
VARIANTS = [
    ('slc43a2a', 326, 'F', 'L', 'flying-fish convergent substitution (Daane 2021)'),
    ('slc43a2a', 200, 'T', 'K', 'zebrafish lat4a nr21 dominant gain of function'),
    ('kcnk5b', 169, 'W', 'L', 'alf missense substitution'),
    ('kcnk5b', 241, 'F', 'Y', 'alf missense substitution'),
    ('kcnk5b', 290, 'I', 'A', 'engineered calcineurin-site substitution'),
    ('kcnk5b', 345, 'S', 'A', 'engineered dephospho-mimic'),
    ('gja1b', 154, 'T', 'A', 'Cx43 T154A dominant negative (position given in Cx43 numbering)'),
    ('gja1b', 78, 'W', 'L', 'stp tl28d ENU allele'),
    ('gja1b', 30, 'F', 'V', 'j7e1 ENU allele'),
    ('gja1b', 191, 'P', 'S', 'j7e2 ENU allele'),
    ('gja1b', 209, 'F', 'I', 'j7e3 ENU allele'),
    ('gja1b', 138, 'G', 'D', 'dmh35 ENU allele'),
    ('hhip', 295, 'Y', '*', 'uki hu418B nonsense allele'),
    ('hhip', 285, 'Y', '*', 'uki hu540A nonsense allele'),
]

# which entity of a chosen structure is OUR protein, by its deposited description
ENTITY_RX = {
    'hhip': r'hedgehog.?interacting',
    'shha': r'hedgehog(?!.?interacting)',
    'gja1b': r'gap junction|connexin',
    'kcnk5b': r'TASK|subfamily K|two.pore|TREK|TRAAK',
    'kcnh2a': r'subfamily H|hERG|ether.a.go',
    'slc43a2a': r'amino acid',
}

GLIDER = {'glider_fish', 'glider_mammal'}
FLIGHT = {'powered_flight', 'powered_flight_insect'}


def seq_of(acc):
    b = net.get(f'https://rest.uniprot.org/uniprotkb/{acc}.fasta', f'UniProt FASTA {acc}',
                accept='text/plain')
    if not b:
        return None
    return ''.join(l.strip() for l in b.decode().splitlines()[1:] if not l.startswith('>'))


def align_map(a, b):
    """Map every position of a (1-based) to a position of b (1-based) by global alignment.
    Returns (dict a_pos -> b_pos, identity %, aligned columns)."""
    if not a or not b:
        return {}, None, None
    from Bio import Align
    al = Align.PairwiseAligner(scoring='blastp', mode='global')
    al.open_gap_score, al.extend_gap_score = -11, -1
    try:
        aln = al.align(a, b)[0]
    except Exception:
        return {}, None, None
    s1, s2 = str(aln[0]), str(aln[1])
    m, cols, out = 0, 0, {}
    i = j = 0
    for x, y in zip(s1, s2):
        if x != '-':
            i += 1
        if y != '-':
            j += 1
        if x != '-' and y != '-':
            cols += 1
            out[i] = j
            if x == y:
                m += 1
    return out, (round(100 * m / cols, 1) if cols else None), cols


def residue_geometry(cif, chain, auth_res, partner_chains):
    """Min heavy-atom distance from this residue to the partner chains, to any HETATM ligand,
    and to any ion, plus its residue name. None when the residue is not modelled."""
    import gemmi
    st = gemmi.read_structure(cif)
    st.setup_entities()
    st.remove_hydrogens()
    st.remove_waters()
    target, part, ligs, ions = None, [], [], []
    IONS = {'K', 'NA', 'CA', 'MG', 'ZN', 'CL'}
    for ch in st[0]:
        for r in ch:
            het = str(r.het_flag).upper().startswith('H')
            pts = [(a.pos.x, a.pos.y, a.pos.z) for a in r]
            if ch.name == chain and r.seqid.num == auth_res and not het:
                target = (r.name, pts)
            if ch.name in partner_chains and not het:
                part += pts
            if het:
                (ions if r.name in IONS else ligs).append((r.name, pts))
    if target is None:
        return None
    import math

    def mind(pts):
        if not pts:
            return None
        return round(min(math.dist(p, q) for p in target[1] for q in pts), 2)
    best_l = min(((mind(p), n) for n, p in ligs if mind(p) is not None), default=(None, None))
    best_i = min(((mind(p), n) for n, p in ions if mind(p) is not None), default=(None, None))
    return dict(residue_name=target[0], min_dist_to_partner_A=mind(part),
                min_dist_to_ligand_A=best_l[0], nearest_ligand=best_l[1],
                min_dist_to_ion_A=best_i[0], nearest_ion=best_i[1])


def main():
    binding = json.load(open(os.path.join(ROOT, 'binding.json'), encoding='utf-8'))
    models = json.load(open(os.path.join(ROOT, 'models.json'), encoding='utf-8'))
    panel = models['species']
    zf = models['matrix']['zebrafish (Danio rerio)']

    out = dict(
        title='Our species and our sourced variants mapped onto experimental interface positions',
        built=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        tool='structures/scripts/map_interface.py',
        bird_exclusion='Class Aves is this project\'s frozen holdout; no bird sequence was aligned and no '
                       'bird species is in the panel, until the holdout exam runs.',
        coordinate_mapping_method=dict(
            step1='Interface positions come from the deposited coordinates in the structure\'s own '
                  'reference-sequence numbering (SIFTS alignment, RCSB rcsb_polymer_entity_align).',
            step2='Each panel species\' UniProt sequence is aligned to that reference sequence with a global '
                  'BLOSUM62 alignment (Bio.Align, blastp scoring, gap open -11, extend -1), and the interface '
                  'position is read through that alignment.',
            uncertainty=[
                'A one-to-one alignment column is an assumption, not a measurement. Where the alignment '
                'places a gap, the position has no counterpart and is reported as a gap, not as a difference.',
                'Identity between the structure\'s protein and each panel species is reported per species; '
                'below roughly 50% identity a single-residue correspondence should not be trusted, and the '
                'K2P and some transporter mappings are in that range.',
                'The structures are human (and one mouse) proteins. Every position in a fish or insect protein '
                'is therefore reached by a cross-species jump, and paralogy (kcnk5a/kcnk5b, gja1a/gja1b, '
                'shha/shhb) can place the alignment on the wrong copy.',
                'Interface membership is defined at a 4.0 A heavy-atom cutoff in one deposited conformation. '
                'A residue just outside the cutoff, or one that only contacts the partner in another state, '
                'is scored as non-interface here.'],
        ),
        variant_positions_on_structures=[],
        interface_species_table={},
        summary={},
    )

    # ---------------- A. our sourced variants, measured on the structures
    target_for = {'slc43a2a': 'lat_substrate', 'kcnk5b': 'k2p_dimer', 'gja1b': 'cx43_channel',
                  'kcnh2a': 'herg_tetramer', 'hhip': 'shh_hhip'}
    zseq = {}
    for pk, cell in zf.items():
        if cell['status'] != 'absent':
            zseq[pk] = seq_of(cell['uniprot']['accession'])

    for pk, pos, wt, mut, why in VARIANTS:
        key = target_for.get(pk)
        t = binding['targets'].get(key) if key else None
        rec = dict(protein=pk, zebrafish_position=pos, wild_type=wt, variant=mut, why=why,
                   structure_target=key)
        ch = t and t.get('chosen')
        if not ch:
            rec['result'] = 'no experimental structure chosen for this protein'
            out['variant_positions_on_structures'].append(rec)
            continue
        # which entity in the structure is OUR protein? matched on the entity description, not
        # on entity order: in 2WG3 entity 1 is the hedgehog ligand and entity 2 is HHIP.
        side = SIDE.get(key, {})
        import re as _re
        rx = _re.compile(ENTITY_RX[pk], _re.I)
        refacc = refname = None
        for e in ch['entities']:
            if e['uniprot'] and e['description'] and rx.search(e['description']):
                refacc, refname = e['uniprot'][0], e['description']
                break
        if refacc is None:
            for e in ch['entities']:
                if e['uniprot']:
                    refacc, refname = e['uniprot'][0], e['description']
                    break
        refseq = seq_of(refacc) if refacc else None
        mp, idp, cols = align_map(zseq.get(pk), refseq)
        sp = mp.get(pos)
        rec.update(structure=dict(pdb_id=ch['pdb_id'], resolution_A=ch['resolution_A'],
                                  reference_uniprot=refacc, reference_name=refname,
                                  identity_zebrafish_vs_structure_protein=idp, aligned_columns=cols),
                   mapped_position_in_structure_protein=sp)
        if sp is None:
            rec['result'] = 'the alignment places a gap here: this zebrafish position has no counterpart'
            out['variant_positions_on_structures'].append(rec)
            continue
        rec['residue_in_structure_protein'] = refseq[sp - 1] if sp <= len(refseq) else None
        # interface membership
        hits = []
        for iface in t.get('interfaces', []):
            for sideName in ('partnerA', 'partnerB'):
                for r in iface['interface_residues'][sideName]:
                    if r['uniprot'] == refacc and r['pos'] == sp:
                        hits.append(dict(interface=iface['label'], side=sideName, aa=r['aa']))
        rec['is_an_interface_residue'] = bool(hits)
        rec['interface_hits'] = hits
        # substrate / ion site membership
        if t.get('substrate_site'):
            close = [c for c in t['substrate_site']['contacts']
                     if c.get('uniprot_pos') == sp]
            rec['is_a_substrate_site_residue'] = bool(close)
            rec['substrate_site_contacts'] = close
        if t.get('selectivity_filter'):
            f = t['selectivity_filter']['in_our_zebrafish_protein']['motifs']
            rec['inside_the_selectivity_filter_of_our_protein'] = any(
                m['start'] <= pos <= m['end'] for m in f)
            rec['selectivity_filter_motifs_our_protein'] = f
        # geometry, measured in the coordinates
        cif = ch.get('coordinate_file')
        auth = None
        for iface in t.get('interfaces', []):
            for c in iface['contacts']:
                for s2 in ('A', 'B'):
                    if c[f'partner{s2}_uniprot'] == refacc and c[f'partner{s2}_uniprot_pos'] == sp:
                        auth = (c[f'partner{s2}_chain'], c[f'partner{s2}_auth_res'])
        if auth is None:
            # derive auth numbering from the SIFTS regions in the interface record
            regs = (t.get('interfaces') or [{}])[0].get('sifts_aligned_regions') or {}
            for eid, rl in regs.items():
                for r in rl:
                    if r['uniprot'] == refacc and r['ref_beg'] <= sp < r['ref_beg'] + r['length']:
                        lab = r['entity_beg'] + (sp - r['ref_beg'])
                        l2a = rcsb.label_to_auth(cif)
                        for (e2, chn), m2 in l2a.items():
                            if e2 == eid and lab in m2:
                                auth = (chn, m2[lab])
                                break
        if auth is None and key == 'lat_substrate':
            l2a = rcsb.label_to_auth(cif)
            al = rcsb.uniprot_alignment(ch['pdb_id'], '1')
            for r in al:
                if r['uniprot'] == refacc and r['ref_beg'] <= sp < r['ref_beg'] + r['length']:
                    lab = r['entity_beg'] + (sp - r['ref_beg'])
                    for (e2, chn), m2 in l2a.items():
                        if lab in m2:
                            auth = (chn, m2[lab])
                            break
        if auth and cif:
            others = sorted({c for e in ch['entities'] for c in e['chains']} - {auth[0]})
            g = residue_geometry(cif, auth[0], auth[1], others)
            rec['measured_in_the_coordinates'] = dict(chain=auth[0], auth_seq_id=auth[1], **(g or {}))
        else:
            rec['measured_in_the_coordinates'] = None
            rec.setdefault('notes', []).append('residue not modelled in the chosen structure, or its author '
                                               'numbering could not be resolved')
        out['variant_positions_on_structures'].append(rec)
        print(f'{pk} {wt}{pos}{mut} -> {ch["pdb_id"]} pos {sp} '
              f'iface={rec["is_an_interface_residue"]} '
              f'geom={rec.get("measured_in_the_coordinates")}')

    # ---------------- A2. the LAT4 substrate site, carried onto our own species
    lat = binding['targets'].get('lat_substrate', {})
    if lat.get('chosen') and lat.get('substrate_site'):
        refacc = [e['uniprot'][0] for e in lat['chosen']['entities'] if e['uniprot']][0]
        refseq = seq_of(refacc)
        rows = []
        for label, meta in panel.items():
            cell = models['matrix'][label]['slc43a2a']
            if cell['status'] == 'absent':
                continue
            s = seq_of(cell['uniprot']['accession'])
            mp, idp, cols = align_map(refseq, s)
            rows.append(dict(species=label, category=meta['category'],
                             uniprot=cell['uniprot']['accession'],
                             identity_to_human_LAT4=idp,
                             residues={str(c['uniprot_pos']): dict(
                                 human=c['aa'], position_in_this_species=mp.get(c['uniprot_pos']),
                                 residue_in_this_species=(s[mp[c['uniprot_pos']] - 1]
                                                          if mp.get(c['uniprot_pos']) else '-'),
                                 min_dist_to_bound_Phe_A=c['min_dist'])
                                 for c in lat['substrate_site']['contacts'] if c['uniprot_pos']}))
        out['lat4_substrate_site_across_the_panel'] = dict(
            structure=lat['chosen']['pdb_id'], reference_uniprot=refacc,
            ligand='PHE (a free phenylalanine bound in the substrate site)',
            note=('This is the experimental substrate site of OUR transporter: human LAT4 / SLC43A2, the '
                  'ortholog of zebrafish slc43a2a (lat4a). The eight contacting residues are given with each '
                  'panel species\' residue at the aligned position, so that the flying-fish substitution can '
                  'be tested against the site as soon as its position can be placed on a sequence '
                  '(see slc43a2a_numbering_problem).'),
            species=rows)
        out['slc43a2a_numbering_problem'] = dict(
            finding=('The two slc43a2a positions our sources give -- F326L (the flying-fish convergent '
                     'substitution, Daane 2021) and T200K (the zebrafish nr21 allele) -- do not match any '
                     'fetched UniProt sequence of slc43a2a. In every zebrafish isoform (Q5PR35, A0ACD6B803, '
                     'A0A8M1N3P6) residue 326 is D and residue 200 is M; in medaka (H2LJY1, H2LJX8) residue '
                     '326 is D and residue 200 is F. No single numbering offset in -60..+60 makes both stated '
                     'wild-type residues appear at their stated positions in any of these sequences.'),
            consequence=('So the key structural question -- does the flying-fish convergent substitution sit in '
                         'the substrate site? -- CANNOT be answered from fetched sources. Placing F326L on the '
                         'LAT4 structure would require the sequence Daane 2021 numbered against, which is not '
                         'in any record this layer fetched. Nothing is renumbered or guessed here.'),
            RESOLVED=('SOLVED, in structures/convergence-test.json. The numbering is against the ENSEMBL '
                      'release 116 medaka protein, not the UniProt one. The sequence thread '
                      '(sequences/alignments/slc43a2a.json) established this from Daane 2021 Data S1 sheet '
                      '"G - conv. aa subst." and checked that the reference residue there is F. The site is '
                      'human LAT4 position 320, 20.1 A from the bound substrate in 9JBT. The UniProt-based '
                      'mapping in variant_positions_on_structures (position 300) is therefore WRONG; it is '
                      'kept only to show what the error looked like before it was caught.'),
            what_would_settle_it=('the Lat4a reference sequence behind Figure 2 of PMID 34534441, or the '
                                  'authors\' Data S1 alignment -- obtained by the sequence thread, see RESOLVED'),
            incidental=('Both zebrafish and medaka do carry a phenylalanine at position 340, 14 residues after '
                        'the stated position. That is noted as a coincidence, not an identification.'))

    # ---------------- B. species residues at every interface position
    species_seq = {}
    for label, meta in panel.items():
        species_seq[label] = {}
        for pk, cell in models['matrix'][label].items():
            if cell['status'] != 'absent':
                species_seq[label][pk] = cell['uniprot']['accession']

    for key, t in binding['targets'].items():
        ch = t.get('chosen')
        if not ch or not t.get('interfaces'):
            continue
        side = SIDE.get(key, {})
        for iface in t['interfaces']:
            for sideName in ('partnerA', 'partnerB'):
                pk = side.get(sideName)
                if not pk:
                    continue
                res = iface['interface_residues'][sideName]
                if not res:
                    continue
                refacc = res[0]['uniprot']
                refseq = seq_of(refacc)
                positions = [r['pos'] for r in res]
                table = dict(structure=ch['pdb_id'], interface=iface['label'], side=sideName,
                             our_protein=pk, reference_uniprot=refacc,
                             n_interface_positions=len(positions),
                             reference_residues={str(r['pos']): r['aa'] for r in res},
                             species={}, per_position={})
                for label, meta in panel.items():
                    acc = species_seq[label].get(pk)
                    if not acc:
                        table['species'][label] = dict(category=meta['category'], uniprot=None,
                                                       status='no UniProt entry for this protein')
                        continue
                    s = seq_of(acc)
                    mp, idp, cols = align_map(refseq, s)
                    table['species'][label] = dict(category=meta['category'], uniprot=acc,
                                                   identity_to_structure_protein=idp,
                                                   aligned_columns=cols, status='ok')
                    for p in positions:
                        q = mp.get(p)
                        table['per_position'].setdefault(str(p), {})[label] = (
                            s[q - 1] if q and q <= len(s) else '-')
                # A species is scored only when its sequence aligns to the structure's protein at
                # >= MIN_ID identity. Below that a single-residue correspondence is not a
                # measurement, and a name-matched TrEMBL hit may not even be the ortholog.
                MIN_ID = 50.0
                usable = {k for k, v in table['species'].items()
                          if v['status'] == 'ok' and (v.get('identity_to_structure_protein') or 0) >= MIN_ID}
                dropped = {k: v.get('identity_to_structure_protein') for k, v in table['species'].items()
                           if v['status'] == 'ok' and k not in usable}
                by_cat = collections.Counter(panel[k]['category'] for k in usable)
                table['scored_species'] = dict(
                    min_identity_to_structure_protein=MIN_ID, n_scored=len(usable),
                    scored=sorted(usable), dropped_for_low_identity=dropped,
                    by_category=dict(by_cat),
                    gliders_scored=sorted(k for k in usable if panel[k]['category'] in GLIDER))

                def compare(group, exclude):
                    hits, shared, untest = [], [], 0
                    for p, row in table['per_position'].items():
                        g = {v for k, v in row.items()
                             if k in usable and panel[k]['category'] in group and v != '-'}
                        o = {v for k, v in row.items()
                             if k in usable and panel[k]['category'] not in exclude and v != '-'}
                        if not g or len(o) < 2:
                            untest += 1
                            continue
                        if g.isdisjoint(o):
                            hits.append(dict(position=int(p), group_residues=sorted(g),
                                             other_residues=sorted(o),
                                             row={k: v for k, v in row.items() if k in usable}))
                        else:
                            shared.append(int(p))
                    return hits, shared, untest

                sep, same, untestable = compare(GLIDER, GLIDER)
                fsep, fsame, funtest = compare(FLIGHT, FLIGHT | GLIDER)
                table['glider_vs_nonglider'] = dict(
                    positions_separating_gliders=sep,
                    n_separating=len(sep), n_shared=len(same),
                    n_untestable_no_glider_sequence=untestable,
                    rule='a position separates gliders only when every glider residue differs from every '
                         'non-glider residue, with at least one glider and two non-gliders scored, counting '
                         f'only species aligned to the structure protein at >= {MIN_ID}% identity',
                    power_warning=('With fewer than two independent glider lineages scored, a "separating" '
                                   'position is a species-specific residue, not evidence of convergence: it '
                                   'cannot be distinguished from ordinary lineage divergence. The count is '
                                   'reported for completeness and must not be read as convergence.')
                    if len(table['scored_species']['gliders_scored']) < 2 else None)
                table['powered_flight_vs_nonflight'] = dict(
                    positions_separating_powered_flight=fsep, n_separating=len(fsep),
                    n_shared=len(fsame), n_untestable=funtest,
                    note='powered-flight species are bats and one insect; non-flight are mouse, human, '
                         'zebrafish and medaka. Gliders are excluded from both sides of this comparison.')
                out['interface_species_table'][f'{key}::{sideName}::{iface["label"][:40]}'] = table
                print(f'{key} {sideName} ({pk}): {len(positions)} interface positions, '
                      f'{len(sep)} separate gliders, {len(fsep)} separate powered flight, '
                      f'{untestable} untestable')

    tot_sep = sum(v['glider_vs_nonglider']['n_separating'] for v in out['interface_species_table'].values())
    tot_pos = sum(v['n_interface_positions'] for v in out['interface_species_table'].values())
    tot_unt = sum(v['glider_vs_nonglider']['n_untestable_no_glider_sequence']
                  for v in out['interface_species_table'].values())
    out['summary'] = dict(
        interfaces_tabulated=len(out['interface_species_table']),
        interface_positions_total=tot_pos,
        positions_separating_gliders=tot_sep,
        positions_untestable_for_lack_of_a_glider_sequence=tot_unt,
        positions_separating_powered_flight=sum(
            v['powered_flight_vs_nonflight']['n_separating'] for v in out['interface_species_table'].values()),
        variants_mapped=sum(1 for v in out['variant_positions_on_structures']
                            if v.get('mapped_position_in_structure_protein')),
        variants_at_an_interface_or_site=sum(1 for v in out['variant_positions_on_structures']
                                             if v.get('is_an_interface_residue')
                                             or v.get('is_a_substrate_site_residue')))
    with open(os.path.join(ROOT, 'interface-mapping.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out['summary'], indent=1))


if __name__ == '__main__':
    main()
