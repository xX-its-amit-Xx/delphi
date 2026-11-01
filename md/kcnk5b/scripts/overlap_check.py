"""List inter-residue atom pairs closer than 0.9 A (periodic) in a tleap PDB. usage: overlap_check.py file.pdb bx by bz"""
import sys, numpy as np
from scipy.spatial import cKDTree
f=sys.argv[1]; box=np.array([float(x) for x in sys.argv[2:5]])
A=[l for l in open(f) if l.startswith(('ATOM','HETATM'))]
X=np.array([[float(l[30:38]),float(l[38:46]),float(l[46:54])] for l in A])
X=X-X.min(0); X=np.mod(X,box)
res=np.array([int(l[22:26]) for l in A])
t=cKDTree(X,boxsize=box)
pairs=t.query_pairs(0.9,output_type='ndarray')
pairs=pairs[res[pairs[:,0]]!=res[pairs[:,1]]]
print(f,'close inter-residue pairs <0.9 A:',len(pairs))
for i,j in pairs[:20]:
    print(A[i][6:26].strip(),'|',A[j][6:26].strip(),round(float(np.linalg.norm(((X[i]-X[j]+box/2)%box)-box/2)),3))
