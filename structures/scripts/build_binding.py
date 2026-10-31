"""Deliverable 3, part 1: find EXPERIMENTAL structures in the RCSB PDB for the
interfaces our causal chains turn on, and describe each interface from the deposited
coordinates.

Targets
  shh_hhip        Hedgehog ligand bound to HHIP  (hhip loss is the only sourced route to a
                  LARGER pectoral fin, so this interface is where that lever acts)
  shh_ptch1       Hedgehog bound to Patched-1
  shh_cdo_boc     Hedgehog bound to the CDO / BOC co-receptors
  cx43_channel    Connexin-43 gap-junction channel: the docked connexon pair, and the
                  extracellular docking interface between the two hemichannels
  k2p_dimer       A K2P (two-pore-domain) channel dimer: subunit interface + selectivity filter
  herg_tetramer   An hERG-family (KCNH) tetramer: subunit interface + selectivity filter
  lat_substrate   An LAT-family amino-acid transporter with its substrate

Writes structures/binding.raw.json (searches, entries, interfaces in UniProt numbering).
map_interface.py then maps our species onto those positions.
"""
import json, os, re, time, itertools, collections
import net, rcsb
from panel import PROTEINS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = 'https://rest.uniprot.org'

# extra partners not in our 8-protein panel, resolved from UniProt (never from memory)
EXTRA = {
    'PTCH1': ('PTCH1', 9606), 'CDON': ('CDON', 9606), 'BOC': ('BOC', 9606),
    'SMO': ('SMO', 9606), 'GAS1': ('GAS1', 9606), 'IHH': ('IHH', 9606), 'DHH': ('DHH', 9606),
    'SLC7A5': ('SLC7A5', 9606), 'SLC3A2': ('SLC3A2', 9606),
    # mouse Kcnk5 / TASK-2: the ortholog of OUR kcnk5b. Human KCNK5 has no deposited structure,
    # and the deposited TASK-2 entries are described as "Potassium channel TASK2", which the
    # subfamily-K phrase search misses, so this accession and a TASK-2 full-text search are added.
    'KCNK5_MOUSE': ('Kcnk5', 10090),
    'KCNK5_ZF': ('kcnk5b', 7955),
}


def human_accession(symbol, taxon=9606):
    """Resolve one gene symbol in one taxon to a UniProt accession, reviewed entries first.

    `reviewed:true` combined with gene_exact and a capitalised symbol returned nothing for some
    mouse genes, so the filter is applied in code instead of in the query.
    """
    url = (f'{UP}/uniprotkb/search?query=gene_exact:{symbol.lower()}+AND+organism_id:{taxon}'
           f'&fields=accession,id,gene_primary,protein_name,length,reviewed&format=json&size=10')
    d = net.jget(url, f'UniProt accession for {symbol} in taxon {taxon}')
    best = None
    for r in (d or {}).get('results', []):
        rec = dict(accession=r['primaryAccession'], uniprot_id=r.get('uniProtkbId'),
                   reviewed=r.get('entryType', '').startswith('UniProtKB reviewed'),
                   taxon=taxon, symbol=symbol,
                   length=(r.get('sequence') or {}).get('length'),
                   name=((r.get('proteinDescription') or {}).get('recommendedName') or {})
                   .get('fullName', {}).get('value'))
        if rec['reviewed']:
            return rec
        best = best or rec
    return best


def ent_matches(summary, pattern):
    rx = re.compile(pattern, re.I)
    return [e for e in summary['entities']
            if (e['description'] and rx.search(e['description']))
            or any(rx.search(a or '') for a in e['uniprot'])]


def main():
    out = {
        'title': 'Experimental interfaces for the DELPHI flight/gliding protein panel, from deposited RCSB PDB structures',
        'built': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'tool': 'structures/scripts/build_binding.py',
        'bird_exclusion': ('Class Aves is this project\'s frozen holdout; no bird structure was fetched and no '
                           'bird species is named here, until the holdout exam runs.'),
        'method': {
            'search': 'RCSB Search API v2 (https://search.rcsb.org/rcsbsearch/v2/query): structured search on '
                      'rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession '
                      'for a known UniProt accession, plus contains_phrase search on '
                      'rcsb_polymer_entity.pdbx_description for families where our own panel protein has no structure.',
            'metadata': 'RCSB Data API /core/entry, /core/polymer_entity, /core/assembly.',
            'contacts': 'gemmi ContactSearch on the deposited mmCIF (asymmetric unit unless noted), '
                        'heavy atoms only, hydrogens and waters removed, inter-chain pairs within 4.0 A; '
                        'a residue pair is reported once with its minimum atom-atom distance and the number '
                        'of atom pairs under the cutoff.',
            'numbering': 'Contacts are first collected in author numbering, then converted to UniProt numbering '
                         'through RCSB\'s own SIFTS-derived alignment (/core/uniprot/{entry}/{entity}, '
                         'aligned_regions: uniprot_pos = ref_beg + label_seq - entity_beg) combined with the '
                         'label_seq_id -> auth_seq_id table read out of the same coordinate file. Residues outside '
                         'any aligned region (expression tags, engineered linkers, unmodelled loops) carry '
                         'uniprot_pos = null and are kept, flagged.',
        },
        'accessions': {},
        'targets': {},
    }

    # --- resolve the accessions we will search with -------------------------
    acc = {}
    panel_syms = {'HHIP': 'HHIP', 'SHH': 'SHH', 'GJA1': 'GJA1', 'KCNK5': 'KCNK5',
                  'KCNH2': 'KCNH2', 'SLC43A2': 'SLC43A2', 'TBX5': 'TBX5', 'PRDM1': 'PRDM1'}
    for sym in list(panel_syms) + list(EXTRA):
        gene, taxon = EXTRA.get(sym, (sym, 9606))
        a = human_accession(gene, taxon)
        acc[sym] = a
        print(f'{sym:10s} {a["accession"] if a else "NOT FOUND"}  {a["name"] if a else ""}')
    out['accessions'] = acc

    def accs(*syms):
        return [acc[s]['accession'] for s in syms if acc.get(s)]

    # --- target definitions -------------------------------------------------
    targets = [
        dict(key='shh_hhip',
             question='Hedgehog ligand bound to HHIP: the interface where hhip loss acts',
             searches=[('accession', accs('HHIP'), 'PDB entries containing human HHIP')],
             require=[r'hedgehog', r'hedgehog.?interacting|HHIP'],
             partners=('Hedgehog ligand', 'HHIP')),
        dict(key='shh_ptch1',
             question='Hedgehog bound to Patched-1',
             searches=[('accession', accs('PTCH1'), 'PDB entries containing human PTCH1')],
             require=[r'hedgehog', r'patched'],
             partners=('Hedgehog ligand', 'PTCH1')),
        dict(key='shh_cdo_boc',
             question='Hedgehog bound to the CDO / BOC co-receptors',
             searches=[('accession', accs('CDON', 'BOC'), 'PDB entries containing human CDON or BOC')],
             require=[r'hedgehog', r'\bCDO\b|CDON|\bBOC\b|cell adhesion molecule-related'],
             partners=('Hedgehog ligand', 'CDO/BOC')),
        dict(key='cx43_channel',
             question='Connexin-43 gap-junction channel: docked connexon pair and the extracellular docking interface',
             searches=[('accession', accs('GJA1'), 'PDB entries containing human GJA1 / Cx43'),
                       ('phrase', 'Gap junction alpha-1 protein', 'PDB entries described as gap junction alpha-1')],
             require=[r'gap junction|connexin'],
             partners=('Cx43 connexon A', 'Cx43 connexon B'),
             prefer='most_chains'),
        dict(key='k2p_dimer',
             question='A K2P (two-pore-domain) potassium channel dimer: subunit interface and selectivity filter',
             searches=[('accession', accs('KCNK5'), 'PDB entries containing human KCNK5 (our panel protein)'),
                       ('accession', accs('KCNK5_MOUSE', 'KCNK5_ZF'),
                        'PDB entries containing mouse Kcnk5 / TASK-2 or zebrafish kcnk5b, the ortholog of our gene'),
                       ('fulltext', 'TASK-2 potassium channel', 'PDB full-text search for TASK-2'),
                       ('phrase', 'Potassium channel subfamily K member', 'PDB entries described as a K2P channel')],
             require=[r'subfamily K|two.pore|TREK|TRAAK|TASK|K2P'],
             partners=('K2P subunit A', 'K2P subunit B')),
        dict(key='herg_tetramer',
             question='An hERG-family (KCNH) tetramer: subunit interface and selectivity filter',
             searches=[('accession', accs('KCNH2'), 'PDB entries containing human KCNH2 / hERG'),
                       ('phrase', 'Potassium voltage-gated channel subfamily H', 'PDB entries described as a KCNH channel')],
             require=[r'subfamily H|hERG|eag|KCNH'],
             partners=('KCNH subunit A', 'KCNH subunit B'),
             prefer='most_chains'),
        dict(key='lat_substrate',
             question='An LAT-family amino-acid transporter with its substrate',
             searches=[('accession', accs('SLC43A2'), 'PDB entries containing human SLC43A2 / LAT4 (our panel protein)'),
                       ('phrase', 'Large neutral amino acids transporter', 'PDB entries described as a large neutral amino-acid transporter'),
                       ('accession', accs('SLC7A5', 'SLC3A2'), 'PDB entries containing human SLC7A5 (LAT1) or SLC3A2 (4F2hc)')],
             require=[r'amino acid'],
             partners=('transporter', 'substrate')),
    ]

    for t in targets:
        key = t['key']
        rec = dict(question=t['question'], searches=[], candidates=[], chosen=None,
                   interface=None, notes=[])
        ids = []
        for kind, arg, purpose in t['searches']:
            if kind == 'fulltext':
                hits = rcsb.search_full_text(arg, purpose)
                rec['searches'].append(dict(kind=kind, arg=arg, purpose=purpose, n_hits=len(hits),
                                            hits=hits[:60]))
                ids += hits
                print(f'{key}: {purpose} -> {len(hits)} hits')
                continue
            if kind == 'accession':
                if not arg:
                    rec['searches'].append(dict(kind=kind, arg=arg, purpose=purpose,
                                                n_hits=0, note='no accession to search with'))
                    continue
                hits = rcsb.search_by_accession(arg, purpose)
            else:
                hits = rcsb.search_name_contains(arg, purpose)
            rec['searches'].append(dict(kind=kind, arg=arg, purpose=purpose, n_hits=len(hits),
                                        hits=hits[:60]))
            ids += hits
            print(f'{key}: {purpose} -> {len(hits)} hits')
        seen, order = set(), []
        for i in ids:
            if i not in seen:
                seen.add(i)
                order.append(i)
        rec['n_unique_entries'] = len(order)
        out['targets'][key] = rec

    with open(os.path.join(ROOT, 'binding.search.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('wrote binding.search.json')


if __name__ == '__main__':
    main()
