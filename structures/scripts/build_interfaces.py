"""Deliverable 3, part 2: screen the RCSB candidates from build_binding.py, choose one
structure per interface, and read the interface off the deposited coordinates.

Writes structures/binding.json (candidate tables + the chosen entry + the contact list in
both author and UniProt numbering).
"""
import json, os, re, time, collections
import net, rcsb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOFF = 4.0

# target -> (regex for partner 1, regex for partner 2, how to break ties)
PARTNERS = {
    'shh_hhip':      (r'hedgehog(?!.?interacting)', r'hedgehog.?interacting'),
    'shh_ptch1':     (r'hedgehog(?!.?interacting)', r'patched'),
    'shh_cdo_boc':   (r'hedgehog(?!.?interacting)', r'\bCDO\b|CDON|brother of CDO|\bBOC\b|cell adhesion molecule'),
    'cx43_channel':  (r'gap junction|connexin', r'gap junction|connexin'),
    'k2p_dimer':     (r'subfamily K|two.pore|TREK|TRAAK|TASK|K2P', r'subfamily K|two.pore|TREK|TRAAK|TASK|K2P'),
    'herg_tetramer': (r'subfamily H|hERG|KCNH|ether.a.go', r'subfamily H|hERG|KCNH|ether.a.go'),
    'lat_substrate': (r'amino acid', r'amino acid'),
}


def res_of(summary):
    r = summary.get('resolution_A')
    if isinstance(r, list) and r:
        return r[0]
    return r if isinstance(r, (int, float)) else None


def ents_matching(summary, rx):
    r = re.compile(rx, re.I)
    return [e for e in summary['entities'] if e['description'] and r.search(e['description'])]


def uniprot_mapper(pdb_id, summary, cif_path):
    """auth chain + auth_seq_id -> (uniprot accession, uniprot position).

    RCSB's SIFTS alignment is in entity (label_seq_id) space; the coordinate file gives
    label_seq_id -> auth_seq_id per (label_entity_id, auth_asym_id).
    """
    import gemmi
    doc = gemmi.cif.read(cif_path)
    block = doc.sole_block()
    tab = block.find('_atom_site.', ['label_seq_id', 'auth_seq_id', 'auth_asym_id', 'label_entity_id'])
    l2a = {}
    for row in tab:
        if row[0] in ('.', '?'):
            continue
        l2a.setdefault((row[3], row[2]), {})[int(row[0])] = int(row[1])

    out, regions = {}, {}
    for en in summary['entities']:
        eid = en['entity_id']
        al = rcsb.uniprot_alignment(pdb_id, eid)
        if not al:
            continue
        regs = [(r['uniprot'], r['entity_beg'], r['ref_beg'], r['length']) for r in al]
        regions[eid] = al
        for chain in en['chains']:
            amap = l2a.get((eid, chain)) or {}
            inv = {v: k for k, v in amap.items()}
            for auth, lab in inv.items():
                for acc, eb, rb, ln in regs:
                    if eb is None or rb is None or ln is None:
                        continue
                    if eb <= lab < eb + ln:
                        out[(chain, auth)] = (acc, rb + (lab - eb))
                        break
    return out, regions


def describe_interface(pdb_id, summary, cif_path, groupA, groupB, label):
    """Contacts between the chains of groupA and the chains of groupB."""
    contacts = rcsb.chain_contacts(cif_path, CUTOFF)
    umap, regions = uniprot_my = uniprot_mapper(pdb_id, summary, cif_path)[0], None
    umap, regions = uniprot_mapper(pdb_id, summary, cif_path)
    A, B = set(groupA), set(groupB)
    rows = []
    for c in contacts:
        a, b = (c['chainA'], c['resA']), (c['chainB'], c['resB'])
        if c['chainA'] in A and c['chainB'] in B:
            pa, pb = (c['chainA'], c['resA'], c['aaA']), (c['chainB'], c['resB'], c['aaB'])
        elif c['chainA'] in B and c['chainB'] in A:
            pa, pb = (c['chainB'], c['resB'], c['aaB']), (c['chainA'], c['resA'], c['aaA'])
        else:
            continue
        ua = umap.get((pa[0], pa[1]))
        ub = umap.get((pb[0], pb[1]))
        rows.append(dict(
            partnerA_chain=pa[0], partnerA_auth_res=pa[1], partnerA_aa=pa[2],
            partnerA_uniprot=ua[0] if ua else None, partnerA_uniprot_pos=ua[1] if ua else None,
            partnerB_chain=pb[0], partnerB_auth_res=pb[1], partnerB_aa=pb[2],
            partnerB_uniprot=ub[0] if ub else None, partnerB_uniprot_pos=ub[1] if ub else None,
            min_dist=c['min_dist'], n_atom_pairs=c['n_atom_pairs']))
    rows.sort(key=lambda r: (r['partnerA_chain'], r['partnerA_auth_res'], r['partnerB_auth_res']))
    resA = sorted({(r['partnerA_uniprot'], r['partnerA_uniprot_pos'], r['partnerA_aa'])
                   for r in rows if r['partnerA_uniprot_pos']}, key=lambda x: (x[0] or '', x[1]))
    resB = sorted({(r['partnerB_uniprot'], r['partnerB_uniprot_pos'], r['partnerB_aa'])
                   for r in rows if r['partnerB_uniprot_pos']}, key=lambda x: (x[0] or '', x[1]))
    return dict(
        label=label, cutoff_A=CUTOFF,
        chains=dict(partnerA=sorted(A), partnerB=sorted(B)),
        n_residue_pairs=len(rows),
        n_interface_residues=dict(partnerA=len(resA), partnerB=len(resB)),
        unmapped_residue_pairs=sum(1 for r in rows
                                   if r['partnerA_uniprot_pos'] is None or r['partnerB_uniprot_pos'] is None),
        interface_residues=dict(
            partnerA=[dict(uniprot=a, pos=p, aa=aa) for a, p, aa in resA],
            partnerB=[dict(uniprot=a, pos=p, aa=aa) for a, p, aa in resB]),
        sifts_aligned_regions=regions,
        contacts=rows)


def main():
    search = json.load(open(os.path.join(ROOT, 'binding.search.json'), encoding='utf-8'))
    out = dict(search['__dict__'] if False else {k: v for k, v in search.items() if k != 'targets'})
    out['built'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    out['tool'] = 'structures/scripts/build_binding.py then structures/scripts/build_interfaces.py'
    out['accessions'].pop('SMO', None)   # gene_exact:SMO returned spermine oxidase (SMOX), not Smoothened
    out['accessions'].pop('GAS1', None)  # resolved but never used in a search
    out['accession_note'] = ('A reviewed-entry lookup of the symbol SMO returned spermine oxidase, not '
                             'Smoothened, so SMO was dropped rather than cited wrongly; no Smoothened '
                             'search was run. GAS1 was resolved but not used.')
    out['targets'] = {}

    for key, t in search['targets'].items():
        ids = []
        for s in t['searches']:
            ids += s.get('hits', [])
        uniq = []
        for i in ids:
            if i not in uniq:
                uniq.append(i)
        cap = 30
        rec = dict(question=t['question'], searches=[{k: v for k, v in s.items() if k != 'hits'}
                                                     for s in t['searches']],
                   n_unique_entries=len(uniq), screened=min(len(uniq), cap), candidates=[])
        rxA, rxB = PARTNERS[key]
        for pid in uniq[:cap]:
            s = rcsb.entry_summary(pid)
            if not s:
                continue
            ea, eb = ents_matching(s, rxA), ents_matching(s, rxB)
            both = bool(ea) and bool(eb) and (key in ('cx43_channel', 'k2p_dimer', 'herg_tetramer',
                                                      'lat_substrate')
                                              or {e['entity_id'] for e in ea} != {e['entity_id'] for e in eb})
            rec['candidates'].append(dict(
                pdb_id=pid, title=s['title'], method=s['method'], resolution_A=res_of(s),
                released=s['deposited'], n_polymer_entities=s['polymer_entity_count'],
                n_polymer_chains=s['deposited_polymer_entity_instance_count'],
                bound_ligands=s.get('nonpolymer_bound_components'),
                entities=[dict(entity_id=e['entity_id'], description=e['description'],
                               chains=e['chains'], organisms=e['organisms'], uniprot=e['uniprot'],
                               length=e['length']) for e in s['entities']],
                has_both_partners=both, url=s['url']))
            print(f'{key:14s} {pid}  {str(res_of(s)):>6}A  chains={s["deposited_polymer_entity_instance_count"]:>3}  '
                  f'both={both}  {(s["title"] or "")[:62]}')
        out['targets'][key] = rec

    with open(os.path.join(ROOT, 'binding.candidates.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('wrote binding.candidates.json')


if __name__ == '__main__':
    main()
