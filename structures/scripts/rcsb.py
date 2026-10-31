"""RCSB PDB search + data API helpers, and interface-contact extraction with gemmi.

All searches go to https://search.rcsb.org/rcsbsearch/v2/query ; all metadata to
https://data.rcsb.org/rest/v1/ ; coordinate files to https://files.rcsb.org (kept on C:/Temp).
UniProt<->PDB residue mapping uses RCSB's own SIFTS-derived alignments
(data.rcsb.org/rest/v1/core/uniprot/{entry}/{entity}), not an assumption.
"""
import json, os
import net

SEARCH = 'https://search.rcsb.org/rcsbsearch/v2/query'
DATA = 'https://data.rcsb.org/rest/v1'
PDBDIR = 'C:/Temp/structures/pdb'
os.makedirs(PDBDIR, exist_ok=True)


def _run(query, purpose, rows=50, return_type='entry'):
    payload = {'query': query, 'return_type': return_type,
               'request_options': {'paginate': {'start': 0, 'rows': rows},
                                   'results_verbosity': 'compact'}}
    d = net.jpost(SEARCH, purpose, payload)
    if not d:
        return []
    return d.get('result_set', []) or []


def search_by_accession(accessions, purpose, rows=60):
    q = {'type': 'terminal', 'service': 'text',
         'parameters': {'attribute': 'rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession',
                        'operator': 'in', 'value': list(accessions), 'negation': False}}
    return _run(q, purpose, rows)


def search_full_text(text, purpose, rows=40):
    q = {'type': 'terminal', 'service': 'full_text', 'parameters': {'value': text}}
    return _run(q, purpose, rows)


def search_name_contains(text, purpose, rows=40):
    q = {'type': 'terminal', 'service': 'text',
         'parameters': {'attribute': 'rcsb_polymer_entity.pdbx_description',
                        'operator': 'contains_phrase', 'value': text, 'negation': False}}
    return _run(q, purpose, rows)


def entry(pdb_id):
    return net.jget(f'{DATA}/core/entry/{pdb_id}', f'RCSB entry metadata {pdb_id}')


def entities(pdb_id, ids):
    out = []
    for e in ids:
        d = net.jget(f'{DATA}/core/polymer_entity/{pdb_id}/{e}',
                     f'RCSB polymer entity {pdb_id}-{e}')
        if d:
            out.append(d)
    return out


def uniprot_alignment(pdb_id, entity_id):
    """SIFTS-derived UniProt alignment for one polymer entity.

    It lives in /core/polymer_entity -> rcsb_polymer_entity_align (provenance SIFTS), as
    aligned_regions of {entity_beg_seq_id, ref_beg_seq_id, length}. (/core/uniprot returns the
    UniProt annotation record for the entity, with no alignment block.)
    """
    d = net.jget(f'{DATA}/core/polymer_entity/{pdb_id}/{entity_id}',
                 f'RCSB polymer entity {pdb_id}-{entity_id}')
    out = []
    for al in (d or {}).get('rcsb_polymer_entity_align') or []:
        if al.get('reference_database_name') not in ('UniProt', 'UniProtKB'):
            continue
        acc = al.get('reference_database_accession')
        for reg in al.get('aligned_regions') or []:
            out.append(dict(uniprot=acc, provenance=al.get('provenance_source'),
                            entity_beg=reg.get('entity_beg_seq_id'),
                            ref_beg=reg.get('ref_beg_seq_id'),
                            length=reg.get('length')))
    return out


def entry_summary(pdb_id):
    """Compact description of an entry: method, resolution, title, entities with organism+UniProt."""
    e = entry(pdb_id)
    if not e:
        return None
    ids = (e.get('rcsb_entry_container_identifiers') or {}).get('polymer_entity_ids') or []
    ents = entities(pdb_id, ids)
    out = dict(
        pdb_id=pdb_id,
        title=(e.get('struct') or {}).get('title'),
        method=[m.get('method') for m in (e.get('exptl') or [])],
        resolution_A=(e.get('rcsb_entry_info') or {}).get('resolution_combined'),
        deposited=(e.get('rcsb_accession_info') or {}).get('initial_release_date'),
        deposited_model_count=(e.get('rcsb_entry_info') or {}).get('deposited_model_count'),
        polymer_entity_count=(e.get('rcsb_entry_info') or {}).get('polymer_entity_count'),
        deposited_polymer_entity_instance_count=(e.get('rcsb_entry_info') or {}).get('deposited_polymer_entity_instance_count'),
        assembly_count=(e.get('rcsb_entry_info') or {}).get('assembly_count'),
        nonpolymer_bound_components=(e.get('rcsb_entry_info') or {}).get('nonpolymer_bound_components'),
        url=f'https://www.rcsb.org/structure/{pdb_id}',
        entities=[],
    )
    for en in ents:
        ids_ = en.get('rcsb_polymer_entity_container_identifiers') or {}
        refs = ids_.get('reference_sequence_identifiers') or []
        src = en.get('rcsb_entity_source_organism') or []
        out['entities'].append(dict(
            entity_id=ids_.get('entity_id'),
            description=(en.get('rcsb_polymer_entity') or {}).get('pdbx_description'),
            chains=ids_.get('auth_asym_ids') or [],
            asym_ids=ids_.get('asym_ids') or [],
            organisms=sorted({s.get('scientific_name') for s in src if s.get('scientific_name')}),
            taxon_ids=sorted({s.get('ncbi_taxonomy_id') for s in src if s.get('ncbi_taxonomy_id')}),
            uniprot=[r.get('database_accession') for r in refs
                     if r.get('database_name') in ('UniProt', 'UniProtKB')],
            length=(en.get('entity_poly') or {}).get('rcsb_sample_sequence_length'),
            sequence=(en.get('entity_poly') or {}).get('pdbx_seq_one_letter_code_can'),
        ))
    return out


def fetch_cif(pdb_id, assembly=None):
    """Download a coordinate file to C:/Temp. assembly=1 gets the biological assembly."""
    if assembly:
        url = f'https://files.rcsb.org/download/{pdb_id.lower()}-assembly{assembly}.cif'
        dest = f'{PDBDIR}/{pdb_id.upper()}-assembly{assembly}.cif'
    else:
        url = f'https://files.rcsb.org/download/{pdb_id.upper()}.cif'
        dest = f'{PDBDIR}/{pdb_id.upper()}.cif'
    return net.download(url, dest, f'RCSB coordinates {os.path.basename(dest)}', accept='chemical/x-mmcif')


# ------------------------------------------------------------------ contacts
AA3 = {'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C', 'GLN': 'Q', 'GLU': 'E',
       'GLY': 'G', 'HIS': 'H', 'ILE': 'I', 'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F',
       'PRO': 'P', 'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V',
       'MSE': 'M', 'SEP': 'S', 'TPO': 'T', 'PTR': 'Y', 'CSO': 'C', 'HYP': 'P'}


def chain_contacts(path, cutoff=4.0, model=0, include_het=False):
    """Heavy-atom contacts between different chains (subchains). Returns a list of
    dicts: chainA, resA (auth seq id), nameA, chainB, resB, nameB, min_dist, n_atom_pairs."""
    import gemmi
    st = gemmi.read_structure(path)
    st.setup_entities()
    st.remove_hydrogens()
    if not include_het:
        st.remove_ligands_and_waters()
    st.remove_alternative_conformations()
    ns = gemmi.NeighborSearch(st, cutoff + 1).populate()
    cs = gemmi.ContactSearch(cutoff)
    cs.ignore = gemmi.ContactSearch.Ignore.SameChain
    cs.min_occupancy = 0.2
    results = cs.find_contacts(ns)
    agg = {}
    for r in results:
        c1 = r.partner1.residue, r.partner1.chain
        c2 = r.partner2.residue, r.partner2.chain
        a = (r.partner1.chain.name, r.partner1.residue.seqid.num, r.partner1.residue.name)
        b = (r.partner2.chain.name, r.partner2.residue.seqid.num, r.partner2.residue.name)
        if a > b:
            a, b = b, a
        k = (a, b)
        cur = agg.setdefault(k, [999.0, 0])
        cur[0] = min(cur[0], r.dist)
        cur[1] += 1
    out = []
    for (a, b), (d, n) in agg.items():
        out.append(dict(chainA=a[0], resA=a[1], nameA=a[2], aaA=AA3.get(a[2], 'X'),
                        chainB=b[0], resB=b[1], nameB=b[2], aaB=AA3.get(b[2], 'X'),
                        min_dist=round(d, 2), n_atom_pairs=n))
    out.sort(key=lambda r: (r['chainA'], r['resA'], r['chainB'], r['resB']))
    return out


def ligand_contacts(path, cutoff=4.0, ignore=('HOH', 'SO4', 'PO4', 'GOL', 'EDO', 'CL', 'NA', 'K',
                                              'MG', 'CA', 'ZN', 'NAG', 'BMA', 'MAN', 'PEG', 'ACT',
                                              'TRS', 'DMS', 'MPD', 'BOG', 'LMT', 'PLM', 'OLC', 'CLR')):
    """Protein-residue contacts to each non-trivial heteroatom group.

    A ligand is identified by its HETATM flag, not by its name: a free amino acid bound in a
    transporter's substrate site carries the standard comp id (a bound phenylalanine is PHE),
    so a name-based filter would silently drop exactly the ligand we care about.
    """
    import gemmi
    st = gemmi.read_structure(path)
    st.setup_entities()
    st.remove_hydrogens()
    st.remove_waters()
    ns = gemmi.NeighborSearch(st, cutoff + 1).populate()
    cs = gemmi.ContactSearch(cutoff)
    cs.ignore = gemmi.ContactSearch.Ignore.SameResidue
    res = cs.find_contacts(ns)
    agg = {}
    for r in res:
        for p, q in ((r.partner1, r.partner2), (r.partner2, r.partner1)):
            rn = p.residue.name
            het = str(p.residue.het_flag).upper().startswith('H')
            if not het or rn in ignore:
                continue
            if q.residue.name not in AA3 or str(q.residue.het_flag).upper().startswith('H'):
                continue
            k = (rn, p.residue.seqid.num, p.chain.name,
                 q.chain.name, q.residue.seqid.num, q.residue.name)
            cur = agg.setdefault(k, [999.0, 0])
            cur[0] = min(cur[0], r.dist)
            cur[1] += 1
    out = []
    for k, (d, n) in agg.items():
        out.append(dict(ligand=k[0], ligand_seq=k[1], ligand_chain=k[2],
                        chain=k[3], res=k[4], name=k[5], aa=AA3.get(k[5], 'X'),
                        min_dist=round(d, 2), n_atom_pairs=n))
    out.sort(key=lambda r: (r['ligand'], r['chain'], r['res']))
    return out


def build_sifts_map(pdb_id, summary):
    """chain -> {auth_seq_id -> (uniprot_acc, uniprot_pos)} from RCSB SIFTS alignments.

    RCSB's alignment is in entity (label_seq_id) coordinates, so we also need the
    label_seq_id <-> auth_seq_id correspondence, taken from the coordinate file.
    """
    maps = {}
    for en in summary['entities']:
        eid = en['entity_id']
        al = uniprot_alignment(pdb_id, eid)
        if not al:
            continue
        for rec in (al if isinstance(al, list) else [al]):
            acc = ((rec.get('rcsb_uniprot_container_identifiers') or {}).get('uniprot_id')
                   or (rec.get('rcsb_id') or '').split('_')[-1])
            for aln in (rec.get('rcsb_uniprot_alignments') or {}).get('core_entity_alignments', []):
                for reg in aln.get('aligned_regions', []):
                    maps.setdefault(eid, []).append(dict(
                        uniprot=acc, entity_beg=reg.get('entity_beg_seq_id'),
                        ref_beg=reg.get('ref_beg_seq_id'), length=reg.get('length')))
    return maps


def label_to_auth(path):
    """chain(auth) -> {label_seq_id: auth_seq_id} and the reverse, per auth chain."""
    import gemmi
    doc = gemmi.cif.read(path)
    block = doc.sole_block()
    tab = block.find('_atom_site.', ['label_seq_id', 'auth_seq_id', 'auth_asym_id',
                                     'label_asym_id', 'label_entity_id'])
    fwd = {}
    for row in tab:
        if row[0] in ('.', '?'):
            continue
        key = (row[4], row[2])
        fwd.setdefault(key, {})[int(row[0])] = int(row[1])
    return fwd


def assembly_info(pdb_id, assembly_id='1'):
    d = net.jget(f'{DATA}/core/assembly/{pdb_id}/{assembly_id}',
                 f'RCSB assembly {pdb_id}-{assembly_id}')
    if not d:
        return None
    ai = d.get('rcsb_assembly_info') or {}
    return dict(assembly_id=assembly_id,
                oligomeric_count=(d.get('pdbx_struct_assembly') or {}).get('oligomeric_count'),
                oligomeric_details=(d.get('pdbx_struct_assembly') or {}).get('oligomeric_details'),
                polymer_entity_instance_count=ai.get('polymer_entity_instance_count'),
                polymer_composition=ai.get('polymer_composition'),
                modeled_polymer_monomer_count=ai.get('modeled_polymer_monomer_count'))
