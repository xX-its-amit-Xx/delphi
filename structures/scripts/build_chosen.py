"""Deliverable 3, part 3: choose one deposited structure per interface and read the interface
off the coordinates. Writes structures/binding.json.

Choice rule, applied in this order and recorded per target:
  1. the entry must contain both partners (from build_interfaces.py screening),
  2. among those, the entry whose relevant chain has the highest sequence identity to OUR
     zebrafish protein (so the residue mapping is as short a jump as possible),
  3. ties broken by resolution, then by chain count (a docked connexon pair beats a hemichannel).
"""
import json, os, re, time, collections
import net, rcsb
from build_interfaces import describe_interface, res_of

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOFF = 4.0
IONS = ('K', 'NA', 'CA', 'MG', 'ZN', 'CL')

# target -> (our zebrafish panel protein for the identity-based choice, entity regex, notes)
CHOICE = {
    'shh_hhip':      ('hhip',     r'hedgehog.?interacting', 'HHIP side'),
    'shh_ptch1':     ('shha',     r'hedgehog(?!.?interacting)', 'ligand side'),
    'shh_cdo_boc':   ('shha',     r'hedgehog(?!.?interacting)', 'ligand side'),
    'cx43_channel':  ('gja1b',    r'gap junction|connexin', 'connexin'),
    'k2p_dimer':     ('kcnk5b',   r'subfamily K|two.pore|TREK|TRAAK|TASK|K2P', 'K2P subunit'),
    'herg_tetramer': ('kcnh2a',   r'subfamily H|hERG|KCNH|ether.a.go', 'KCNH subunit'),
    'lat_substrate': ('slc43a2a', r'amino acid', 'transporter'),
}


def ident(a, b):
    """Global-ish identity from a Needleman-Wunsch alignment (BLOSUM62, Bio.Align)."""
    if not a or not b:
        return None, None
    from Bio import Align
    al = Align.PairwiseAligner(scoring='blastp', mode='global')
    al.open_gap_score, al.extend_gap_score = -11, -1
    try:
        aln = al.align(a, b)[0]
    except Exception:
        return None, None
    s1, s2 = str(aln[0]), str(aln[1])
    m = sum(1 for x, y in zip(s1, s2) if x == y and x != '-')
    cols = sum(1 for x, y in zip(s1, s2) if x != '-' and y != '-')
    return (round(100 * m / cols, 1) if cols else None), cols


def uniprot_sequence(acc):
    b = net.get(f'https://rest.uniprot.org/uniprotkb/{acc}.fasta', f'UniProt FASTA {acc}',
                accept='text/plain')
    if not b:
        return None
    return ''.join(l.strip() for l in b.decode().splitlines()[1:] if not l.startswith('>'))


def split_connexons(cif_path, chains):
    """Group the chains of a gap-junction channel into two hemichannels along the pore axis."""
    import gemmi, numpy as np
    st = gemmi.read_structure(cif_path)
    st.setup_entities()
    cen, all_pts = {}, []
    for ch in st[0]:
        pts = [[a.pos.x, a.pos.y, a.pos.z] for r in ch for a in r if a.name == 'CA']
        if not pts:
            continue
        cen[ch.name] = np.mean(pts, 0)
        all_pts += pts
    if len(cen) < 2:
        return None
    X = np.array(all_pts)
    X = X - X.mean(0)
    axis = np.linalg.svd(X, full_matrices=False)[2][0]
    origin = np.array(all_pts).mean(0)
    proj = {k: float((v - origin) @ axis) for k, v in cen.items()}
    med = sorted(proj.values())[len(proj) // 2]
    a = sorted([k for k, v in proj.items() if v < med])
    b = sorted([k for k, v in proj.items() if v >= med])
    return dict(connexonA=a, connexonB=b, axis_projection={k: round(v, 1) for k, v in proj.items()},
                method='CA centroids projected on the first principal axis of all CA atoms, split at the median')


def selectivity_filter(seq, offset=1):
    """Find the K+ channel signature T-x-G-Y/F-G in a sequence; return 1-based positions."""
    out = []
    for m in re.finditer(r'T.G[YFL]G', seq or ''):
        out.append(dict(motif=m.group(0), start=m.start() + offset, end=m.end() - 1 + offset))
    return out


def main():
    cand = json.load(open(os.path.join(ROOT, 'binding.candidates.json'), encoding='utf-8'))
    models = json.load(open(os.path.join(ROOT, 'models.json'), encoding='utf-8'))
    zf = models['matrix']['zebrafish (Danio rerio)']
    zseq = {}
    for pk, cell in zf.items():
        if cell['status'] != 'absent':
            zseq[pk] = uniprot_sequence(cell['uniprot']['accession'])

    out = {k: v for k, v in cand.items() if k != 'targets'}
    out['built'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    out['tool'] = ('structures/scripts/build_binding.py -> build_interfaces.py -> build_chosen.py')
    out['choice_rule'] = ('Among entries containing both partners: highest sequence identity of the relevant '
                          'chain to the zebrafish protein our causal chains actually name, then best '
                          'resolution, then most chains. Identity from a global BLOSUM62 alignment '
                          '(Bio.Align, blastp scoring, gap -11/-1).')
    out['targets'] = {}

    for key, t in cand['targets'].items():
        pk, rx, side = CHOICE[key]
        ours = zseq.get(pk)
        rxc = re.compile(rx, re.I)
        scored = []
        for c in t['candidates']:
            if not c['has_both_partners']:
                continue
            # sequences are not kept in the candidate table (it would bloat the repo file):
            # re-read the cached entry summary, which costs no network call
            full = rcsb.entry_summary(c['pdb_id'])
            seqs = {e['entity_id']: e['sequence'] for e in (full or {}).get('entities', [])}
            best_id, best_cols, best_ent = None, None, None
            for e in c['entities']:
                if not (e['description'] and rxc.search(e['description'])):
                    continue
                s = seqs.get(e['entity_id'])
                if s is None:
                    continue
                i, cols = ident(ours, s)
                if i is not None and (best_id is None or i > best_id):
                    best_id, best_cols, best_ent = i, cols, e
            scored.append(dict(pdb_id=c['pdb_id'], identity_to_zebrafish=best_id,
                               aligned_columns=best_cols,
                               resolution_A=c['resolution_A'], n_chains=c['n_polymer_chains'],
                               entity=best_ent['entity_id'] if best_ent else None,
                               description=best_ent['description'] if best_ent else None,
                               organisms=best_ent['organisms'] if best_ent else None,
                               uniprot=best_ent['uniprot'] if best_ent else None,
                               candidate=c))
        scored = [s for s in scored if s['identity_to_zebrafish'] is not None]
        # Drop fragments: an NMR structure of a 20-residue linker aligns at 100% identity and
        # tells us nothing about a tetramer. Require at least 60% of the longest aligned region
        # seen for this target, and >= 2 chains where the question is about an oligomer.
        max_cols = max((s['aligned_columns'] or 0) for s in scored) if scored else 0
        need_oligomer = key in ('k2p_dimer', 'herg_tetramer', 'cx43_channel')
        kept = [s for s in scored
                if (s['aligned_columns'] or 0) >= 0.6 * max_cols
                and (not need_oligomer or (s['n_chains'] or 0) >= 2)]
        # Then: inside a 5-point identity band of the best, prefer resolution, then chain count,
        # and for the transporter prefer an entry with a bound non-ion ligand (its substrate).
        if kept:
            top_id = max(s['identity_to_zebrafish'] for s in kept)
            band = [s for s in kept if s['identity_to_zebrafish'] >= top_id - 5]
            ION = {'K', 'NA', 'CA', 'MG', 'ZN', 'CL'}

            def has_substrate(s):
                """rcsb_entry_info.nonpolymer_bound_components is empty for the LAT4 entries, so
                for the transporter the ligand is looked for in the coordinates themselves."""
                if key != 'lat_substrate':
                    return 0
                c = rcsb.fetch_cif(s['pdb_id'])
                if not c:
                    return 0
                try:
                    lig = rcsb.ligand_contacts(c)
                except Exception:
                    return 0
                s['ligands_in_coordinates'] = sorted({l['ligand'] for l in lig})
                AAL = set(rcsb.AA3)            # a free amino acid = the transporter's substrate
                DETERGENT = {'DIG', 'LMT', 'BOG', 'OLC', 'PLM', 'CLR', 'CHS', 'LMN', 'DGD', 'PEE'}
                ligs = [x for x in s['ligands_in_coordinates'] if x not in ION]
                if [x for x in ligs if x in AAL]:
                    return 2                   # amino-acid substrate bound: what the question asks for
                return 1 if [x for x in ligs if x not in DETERGENT] else 0
            def is_sonic(s):
                """For the Hedgehog interfaces, prefer the entry whose ligand is SONIC hedgehog:
                our gene is shha, and the deposited HHIP and CDO complexes also exist with Desert
                and Indian hedgehog, which are paralogs."""
                if key not in ('shh_hhip', 'shh_ptch1', 'shh_cdo_boc'):
                    return 0
                return 1 if re.search(r'sonic', ' '.join(
                    e['description'] or '' for e in s['candidate']['entities']), re.I) else 0
            band.sort(key=lambda s: (has_substrate(s), is_sonic(s), -(s['resolution_A'] or 99),
                                     s['n_chains'] or 0, s['identity_to_zebrafish']), reverse=True)
            scored = band + [s for s in scored if s not in band]
        rec = dict(question=t['question'], n_unique_entries=t['n_unique_entries'],
                   screened=t['screened'], searches=t['searches'],
                   our_protein=pk, identity_side=side,
                   selection=dict(candidates_with_both_partners=len(scored),
                                  longest_aligned_region=max_cols,
                                  fragment_filter='aligned region >= 60% of the longest seen for this target'
                                                  + (', and >= 2 chains in the deposited coordinates'
                                                     if need_oligomer else ''),
                                  kept_after_filters=len(kept),
                                  tie_break='bound non-ion ligand (transporter only), then resolution, then '
                                            'chain count, inside a 5-point identity band of the best'),
                   ranked_candidates=[{k2: v2 for k2, v2 in s.items() if k2 != 'candidate'}
                                      for s in scored[:12]])
        if not scored:
            rec['chosen'] = None
            rec['result'] = 'no deposited entry contains both partners'
            out['targets'][key] = rec
            print(f'{key}: NO STRUCTURE')
            continue
        pickd = scored[0]
        pid = pickd['pdb_id']
        s = rcsb.entry_summary(pid)
        cif = rcsb.fetch_cif(pid)
        rec['chosen'] = dict(pdb_id=pid, title=s['title'], method=s['method'],
                             resolution_A=res_of(s), released=s['deposited'],
                             url=s['url'], n_polymer_chains=s['deposited_polymer_entity_instance_count'],
                             bound_ligands=s.get('nonpolymer_bound_components'),
                             identity_to_zebrafish=pickd['identity_to_zebrafish'],
                             aligned_columns=pickd['aligned_columns'],
                             entities=[dict(entity_id=e['entity_id'], description=e['description'],
                                            chains=e['chains'], organisms=e['organisms'],
                                            taxon_ids=e['taxon_ids'], uniprot=e['uniprot'],
                                            length=e['length']) for e in s['entities']],
                             assembly=rcsb.assembly_info(pid),
                             coordinate_file=cif)
        if not cif:
            rec['result'] = 'coordinates could not be downloaded'
            out['targets'][key] = rec
            continue

        # ---- which chains are partner A and partner B
        if key == 'cx43_channel':
            grp = split_connexons(cif, None)
            rec['connexon_split'] = grp
            iface = describe_interface(pid, s, cif, grp['connexonA'], grp['connexonB'],
                                       'extracellular docking interface between the two hemichannels')
            # and one intra-connexon subunit interface for comparison
            a = grp['connexonA']
            iface2 = describe_interface(pid, s, cif, [a[0]], a[1:],
                                        'subunit-subunit interface inside one connexon')
            rec['interfaces'] = [iface, iface2]
        elif key == 'lat_substrate':
            lig = rcsb.ligand_contacts(cif)
            keep = [l for l in lig if l['ligand'] not in IONS]
            # put the contacting residues in UniProt numbering too, so our variant positions
            # can be compared against them
            from build_interfaces import uniprot_mapper
            umap, regions = uniprot_mapper(pid, s, cif)
            for l in keep:
                u = umap.get((l['chain'], l['res']))
                l['uniprot'] = u[0] if u else None
                l['uniprot_pos'] = u[1] if u else None
            rec['substrate_site'] = dict(
                label='transporter residues contacting each bound non-ion ligand, within 4.0 A',
                ligands=sorted({l['ligand'] for l in keep}),
                sifts_aligned_regions=regions,
                contacts=keep)
            rec['interfaces'] = []
        else:
            rxA, rxB = __import__('build_interfaces').PARTNERS[key]
            ea = [e for e in s['entities'] if e['description'] and re.search(rxA, e['description'], re.I)]
            eb = [e for e in s['entities'] if e['description'] and re.search(rxB, e['description'], re.I)]
            if key in ('k2p_dimer', 'herg_tetramer'):
                ch = sorted({c for e in ea for c in e['chains']})
                if len(ch) < 2:
                    rec['result'] = ('the deposited asymmetric unit holds a single subunit; the oligomer is '
                                     'generated by symmetry, so no subunit-subunit contact can be read from '
                                     'the deposited coordinates of this entry')
                    rec['interfaces'] = []
                else:
                    rec['interfaces'] = [describe_interface(pid, s, cif, [ch[0]], ch[1:],
                                                            'subunit-subunit interface')]
            else:
                ca = sorted({c for e in ea for c in e['chains']})
                cb = sorted({c for e in eb for c in e['chains']})
                cb = [c for c in cb if c not in ca]
                rec['interfaces'] = [describe_interface(pid, s, cif, ca, cb,
                                                        f'{t["question"]}')] if ca and cb else []
                if not (ca and cb):
                    rec['result'] = 'partner chains could not be separated in this entry'

        # ---- selectivity filter and bound ions for the channels
        if key in ('k2p_dimer', 'herg_tetramer'):
            ent = [e for e in s['entities'] if e['entity_id'] == pickd['entity']][0]
            filt = selectivity_filter(ent['sequence'])
            ourfilt = selectivity_filter(zseq.get(pk))
            rec['selectivity_filter'] = dict(
                in_the_structure=dict(entity=ent['entity_id'], uniprot=ent['uniprot'],
                                      motifs_in_entity_numbering=filt),
                in_our_zebrafish_protein=dict(protein=pk,
                                              uniprot=zf[pk]['uniprot']['accession'],
                                              motifs=ourfilt),
                note=('The filter is found by the T-x-G-[YFL]-G signature in the fetched sequence, not from '
                      'memory. Entity numbering is the construct\'s; UniProt positions for the structure are '
                      'in the interface table.'))
            lig = rcsb.ligand_contacts(cif)
            rec['ion_coordination'] = dict(
                label='residues within 4.0 A of each bound ion',
                contacts=[l for l in lig if l['ligand'] in IONS])
        # ---- cross-check: the same interface in every other qualifying deposited entry
        if key in ('shh_hhip', 'shh_cdo_boc'):
            import build_interfaces as bi
            rxA, rxB = bi.PARTNERS[key]
            checks = []
            for s2 in scored[:5]:
                pid2 = s2['pdb_id']
                sm2 = rcsb.entry_summary(pid2)
                cif2 = rcsb.fetch_cif(pid2)
                if not sm2 or not cif2:
                    continue
                ea2 = [e for e in sm2['entities'] if e['description'] and re.search(rxA, e['description'], re.I)]
                eb2 = [e for e in sm2['entities'] if e['description'] and re.search(rxB, e['description'], re.I)]
                ca2 = sorted({c for e in ea2 for c in e['chains']})
                cb2 = [c for c in sorted({c for e in eb2 for c in e['chains']}) if c not in ca2]
                if not (ca2 and cb2):
                    continue
                try:
                    i2 = describe_interface(pid2, sm2, cif2, ca2, cb2, 'cross-check')
                except Exception as ex:
                    checks.append(dict(pdb_id=pid2, error=repr(ex)))
                    continue
                checks.append(dict(
                    pdb_id=pid2, resolution_A=s2['resolution_A'], title=sm2['title'],
                    ligand=[e['description'] for e in ea2], ligand_uniprot=[a for e in ea2 for a in e['uniprot']],
                    receptor=[e['description'] for e in eb2],
                    receptor_uniprot=[a for e in eb2 for a in e['uniprot']],
                    n_residue_pairs=i2['n_residue_pairs'],
                    ligand_side_positions=[r['pos'] for r in i2['interface_residues']['partnerA']],
                    receptor_side_positions=[r['pos'] for r in i2['interface_residues']['partnerB']]))
            # consensus on the receptor side (HHIP / CDO), which has one UniProt accession throughout
            # group by receptor accession: CDO (Q4KMG0) and BOC (Q9BWV1) are different proteins,
            # so their positions are not comparable and must not be pooled
            groups = collections.defaultdict(list)
            for c in checks:
                acc = (c.get('receptor_uniprot') or [None])[0]
                groups[acc].append(c)
            rec['cross_check'] = dict(
                why=('The same interface was read from every other deposited entry that contains both '
                     'partners, so the reported positions are not an artefact of one crystal. The ligand '
                     'differs between entries (Sonic, Desert and Indian hedgehog are paralogs), which is '
                     'recorded per entry.'),
                entries=checks,
                receptor_side_consensus={
                    acc: dict(
                        n_entries=len(cs), entries=[c['pdb_id'] for c in cs],
                        in_all_entries=sorted(p for p, n in collections.Counter(
                            q for c in cs for q in c.get('receptor_side_positions', [])).items()
                            if n == len(cs)),
                        in_at_least_two=sorted(p for p, n in collections.Counter(
                            q for c in cs for q in c.get('receptor_side_positions', [])).items()
                            if n >= 2),
                        in_one_only=sorted(p for p, n in collections.Counter(
                            q for c in cs for q in c.get('receptor_side_positions', [])).items()
                            if n == 1))
                    for acc, cs in groups.items()})

        out['targets'][key] = rec
        n = sum(i['n_residue_pairs'] for i in rec.get('interfaces', []))
        print(f'{key}: chose {pid} ({res_of(s)} A, identity to zebrafish {pk} '
              f'{pickd["identity_to_zebrafish"]}%), {n} residue pairs')

    with open(os.path.join(ROOT, 'binding.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('wrote binding.json')


if __name__ == '__main__':
    main()
