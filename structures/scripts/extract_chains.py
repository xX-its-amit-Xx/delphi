"""Write the small coordinate files the repo keeps: only the chains that make each interface
(plus the bound substrate or ions), from the full entries downloaded to C:/Temp.

Output: structures/chains/<PDB>_<chains>.pdb, each a few hundred kB at most, so the interfaces
reported in binding.json can be checked without re-downloading anything.
"""
import json, os, gzip
import gemmi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'chains')
os.makedirs(OUT, exist_ok=True)

# target -> (chains to keep, what it is)
KEEP = {
    'shh_hhip':      (None, 'Sonic hedgehog + HHIP: the interface where hhip loss acts'),
    'shh_ptch1':     (None, 'Sonic hedgehog + Patched-1'),
    'shh_cdo_boc':   (None, 'Sonic hedgehog + CDO third FNIII domain'),
    'cx43_channel':  (None, 'Cx43 gap-junction channel: both docked connexons (12 subunits)'),
    'k2p_dimer':     (None, 'TASK-2 (mouse Kcnk5) dimer: the ortholog of our kcnk5b'),
    'herg_tetramer': (None, 'hERG (KCNH2) tetramer'),
    'lat_substrate': (None, 'LAT4 / SLC43A2 with its phenylalanine substrate bound'),
}


def main():
    b = json.load(open(os.path.join(ROOT, 'binding.json'), encoding='utf-8'))
    manifest = []
    for key, t in b['targets'].items():
        ch = t.get('chosen')
        if not ch or not ch.get('coordinate_file') or not os.path.exists(ch['coordinate_file']):
            continue
        # which chains matter: the interface chains, or for the transporter the chain with the ligand
        chains = set()
        for iface in t.get('interfaces', []):
            chains |= set(iface['chains']['partnerA']) | set(iface['chains']['partnerB'])
        if t.get('substrate_site'):
            chains |= {c['chain'] for c in t['substrate_site']['contacts']}
            chains |= {c['ligand_chain'] for c in t['substrate_site']['contacts']}
        if not chains:
            continue
        st = gemmi.read_structure(ch['coordinate_file'])
        st.setup_entities()
        st.remove_alternative_conformations()
        st.remove_hydrogens()
        st.remove_waters()
        while len(st) > 1:
            del st[1]
        for model in st:
            for name in [c.name for c in model]:
                if name not in chains:
                    model.remove_chain(name)
        st.setup_entities()
        tag = ''.join(sorted(chains))
        if len(tag) > 12:
            tag = f'{len(chains)}chains'
        path = os.path.join(OUT, f'{ch["pdb_id"]}_{tag}.pdb')
        st.write_pdb(path)
        size = os.path.getsize(path)
        if size > 0:  # always gzip: the repo keeps only small files
            with open(path, 'rb') as f, gzip.open(path + '.gz', 'wb') as g:
                g.write(f.read())
            os.remove(path)
            path += '.gz'
            size = os.path.getsize(path)
        manifest.append(dict(target=key, what=KEEP[key][1], pdb_id=ch['pdb_id'],
                             title=ch['title'], method=ch['method'], resolution_A=ch['resolution_A'],
                             url=ch['url'], chains_kept=sorted(chains),
                             file=os.path.relpath(path, ROOT).replace('\\', '/'),
                             bytes=size,
                             note='hydrogens, waters and alternative conformations removed; only the first '
                                  'model and only the chains that make the reported interface are kept. '
                                  'The full entry is at the RCSB url.'))
        print(f'{key:14s} {ch["pdb_id"]} {len(chains):2d} chains -> {os.path.basename(path)} ({size/1000:.0f} kB)')
    with open(os.path.join(OUT, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(
            what='Trimmed coordinate files for the interfaces reported in structures/binding.json',
            source='RCSB PDB (files.rcsb.org); full entries were downloaded to C:/Temp, not into the repo',
            files=manifest), f, indent=1)
    print('total', sum(m['bytes'] for m in manifest) / 1e6, 'MB')


if __name__ == '__main__':
    main()
