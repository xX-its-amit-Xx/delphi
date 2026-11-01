"""Put a mutant protein into the WT-packed bilayer (identical lipids/water/ions), removing any water
that clashes (<2.2 A heavy-atom) with the mutant side chain. Exit 3 if a lipid clashes (caller packs separately).
usage: swap_protein.py WT_bilayer.pdb MUT_amber.pdb out.pdb"""
import sys, numpy as np
wt, mut, out = sys.argv[1:4]
PROT=set('ALA ARG ASN ASP CYS CYX GLN GLU GLY HIS HIE HID HIP ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL'.split())
L=[l for l in open(wt) if l.startswith(('ATOM','HETATM','TER','CRYST1','END'))]
prot=[l for l in L if l.startswith(('ATOM','HETATM')) and l[17:20].strip() in PROT]
rest=[l for l in L if not (l.startswith(('ATOM','HETATM')) and l[17:20].strip() in PROT)]
M=[l for l in open(mut) if l.startswith('ATOM')]
xyz=lambda l: np.array([float(l[30:38]),float(l[38:46]),float(l[46:54])])
ca_w=np.array([xyz(l) for l in prot if l[12:16]==' CA ']); ca_m=np.array([xyz(l) for l in M if l[12:16]==' CA '])
assert len(ca_w)==len(ca_m), (len(ca_w),len(ca_m))
pc,qc=ca_m.mean(0),ca_w.mean(0); H=(ca_m-pc).T@(ca_w-qc); U,S,Vt=np.linalg.svd(H); d=np.sign(np.linalg.det(Vt.T@U.T))
R=Vt.T@np.diag([1,1,d])@U.T; t=qc-R@pc
print('CA fit rmsd', np.sqrt((((R@ca_m.T).T+t-ca_w)**2).sum(1).mean()).round(3))
Mn=[l[:30]+'%8.3f%8.3f%8.3f'%tuple(R@xyz(l)+t)+l[54:] for l in M]
# atoms that differ from WT (mutated side chains) -> clash check
wtset={(l[21],l[22:26],l[12:16]) for l in prot}
new=np.array([xyz(l) for l in Mn if (l[21],l[22:26],l[12:16]) not in wtset or l[17:20]!=next((p[17:20] for p in prot if (p[21],p[22:26])==(l[21],l[22:26])),l[17:20])])
from collections import defaultdict
res=defaultdict(list)
for i,l in enumerate(rest):
    if l.startswith(('ATOM','HETATM')): res[(l[17:20],l[21],l[22:27])].append(i)
drop=set(); lipclash=False
for k,idx in res.items():
    P=np.array([xyz(rest[i]) for i in idx if rest[i][12:16].strip()[0]!='H'] or [xyz(rest[i]) for i in idx])
    dmin=np.min(np.linalg.norm(P[:,None,:]-new[None,:,:],axis=2))
    if dmin<2.2:
        if k[0] in ('WAT','HOH'): drop.update(idx); print('drop water',k,round(dmin,2))
        elif k[0].strip() in ('K+','Cl-','K','CL'): drop.update(idx); print('drop ion',k,round(dmin,2))
        else: lipclash=True; print('LIPID CLASH',k,round(dmin,2))
if lipclash: sys.exit(3)
with open(out,'w') as f:
    for l in L:
        if l.startswith('CRYST1'): f.write(l)
    for l in Mn: f.write(l)
    f.write('TER\n')
    for i,l in enumerate(rest):
        if i in drop or l.startswith('CRYST1'): continue
        f.write(l)
print('n new atoms',len(new),'dropped',len(drop))
