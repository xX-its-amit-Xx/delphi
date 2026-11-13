"""Aggregate GSE186265 upstream EP rows to an enhancer x promoter x replicate array (linear scale).
Per (enhancer fragment, promoter fragment, replicate) = mean over all rows (orientations, locus libraries)."""
import sys; sys.path.append(r'D:\Users\ashenoy00000\AppData\Roaming\Python\Python314\site-packages')
import gzip,csv,collections as C,numpy as np,json
F=r'D:\Users\ashenoy00000\delphi-work\data\martinezara2022\GSE186265_Activities_allcombinations_Upstream.tsv.gz'
OUT=r'D:\Users\ashenoy00000\delphi-work\agents2\scratch\q1-data\matrix.npz'
r=[x for x in csv.DictReader(gzip.open(F,'rt'),delimiter='\t') if x['class']=='EP']
acc=C.defaultdict(list)
for x in r: acc[(x['frag1'],x['frag2'])].append([float(x['activity_br%d'%i]) for i in (1,2,3)])
E=sorted({k[0] for k in acc});P=sorted({k[1] for k in acc})
A=np.full((len(E),len(P),3),np.nan);N=np.zeros((len(E),len(P)),int)
for (e,p),v in acc.items():
    A[E.index(e),P.index(p)]=np.mean(v,axis=0);N[E.index(e),P.index(p)]=len(v)
np.savez(OUT,A=A,N=N,E=np.array(E),P=np.array(P))
print(A.shape,'cells',np.isfinite(A[:,:,0]).sum(),'rows pooled',len(r),'mean rows/cell',N[N>0].mean())
print('cells with any rep mean==0:',int((np.nan_to_num(A,nan=1)==0).any(2).sum()),' all-zero:',int((np.nan_to_num(A,nan=1)==0).all(2).sum()))
print('linear pooled-activity quantiles',np.nanpercentile(A.mean(2),[1,5,25,50,75,95,99]))
