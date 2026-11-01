"""Remove POPC molecules whose acyl-chain carbons pierce protein aromatic rings (packmol artefact).
A lipid carbon within 1.7 A of a ring centroid, or any lipid heavy atom within 1.6 A of a protein heavy atom,
marks that lipid (PA+PC+OL residues sharing one molecule) for deletion.
usage: fix_pierce.py in_bilayer.pdb out_bilayer.pdb"""
import sys
import numpy as np
from scipy.spatial import cKDTree

inp, out = sys.argv[1:3]
L = [l for l in open(inp)]
PROT = set('ALA ARG ASN ASP CYS CYX GLN GLU GLY HIS HIE HID HIP ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL'.split())
RING = {'PHE': ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'], 'TYR': ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'],
        'TRP': ['CD2', 'CE2', 'CE3', 'CZ2', 'CZ3', 'CH2'], 'HIS': ['CG', 'ND1', 'CD2', 'CE1', 'NE2'],
        'HIE': ['CG', 'ND1', 'CD2', 'CE1', 'NE2'], 'PRO': ['N', 'CA', 'CB', 'CG', 'CD']}
xyz = lambda l: np.array([float(l[30:38]), float(l[38:46]), float(l[46:54])])
atoms = [(i, l) for i, l in enumerate(L) if l.startswith(('ATOM', 'HETATM'))]
prot = [(i, l) for i, l in atoms if l[17:20].strip() in PROT]
lip = [(i, l) for i, l in atoms if l[17:20].strip() in ('PA', 'PC', 'OL')]
# ring centroids
rings = {}
for i, l in prot:
    rn = l[17:20].strip()
    if rn in RING and l[12:16].strip() in RING[rn]:
        rings.setdefault((l[21], l[22:26], rn), []).append(xyz(l))
cent = np.array([np.mean(v, 0) for v in rings.values() if len(v) >= 5])
ph = np.array([xyz(l) for i, l in prot if l[12:16].strip()[0] != 'H'])
# group lipid residues into molecules: packmol writes PA, PC, OL consecutively for each POPC
mols, cur = [], []
for i, l in lip:
    key = (l[17:20].strip(), l[21], l[22:26])
    if not cur or key != cur[-1][0]:
        if key[0] == 'PA' and cur and any(k[0] == 'OL' for k, _ in cur):
            mols.append(cur); cur = []
        cur.append((key, [i]))
    else:
        cur[-1][1].append(i)
if cur:
    mols.append(cur)
tc, tp = cKDTree(cent), cKDTree(ph)
drop = set()
for m in mols:
    idx = [i for _, ii in m for i in ii]
    P = np.array([xyz(L[i]) for i in idx if L[i][12:16].strip()[0] == 'C'])
    H = np.array([xyz(L[i]) for i in idx if L[i][12:16].strip()[0] != 'H'])
    dc = tc.query(P)[0].min()
    dp = tp.query(H)[0].min()
    if dc < 1.7 or dp < 1.6:
        print('drop lipid', [k for k, _ in m], 'ring-centroid %.2f protein-heavy %.2f' % (dc, dp))
        drop.update(idx)
with open(out, 'w') as f:
    for i, l in enumerate(L):
        if i not in drop:
            f.write(l)
print('lipids', len(mols), 'dropped atoms', len(drop))
