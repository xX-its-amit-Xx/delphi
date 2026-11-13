import sys; sys.path.append(r'D:\Users\ashenoy00000\AppData\Roaming\Python\Python314\site-packages')
import gzip,csv,collections as C,numpy as np
F=r'D:\Users\ashenoy00000\delphi-work\data\martinezara2022\GSE186265_Activities_allcombinations_Upstream.tsv.gz'
r=[x for x in csv.DictReader(gzip.open(F,'rt'),delimiter='\t') if x['class']=='EP']
pairs=C.defaultdict(list)
for x in r: pairs[(x['frag1'],x['frag2'])].append(x)
print('unique frag pairs',len(pairs))
E=sorted({k[0] for k in pairs});P=sorted({k[1] for k in pairs})
M=np.zeros((len(E),len(P)),bool)
for (e,p) in pairs: M[E.index(e),P.index(p)]=1
print(M.shape,M.mean())
loc={}
for x in r: loc.setdefault(x['frag1'],set()).add(x['locus'])
print(C.Counter(len(v) for v in loc.values()))
# per promoter count of enhancers
print(sorted(M.sum(0)))
def greedy(M,minP=3):
    rows=np.arange(M.shape[0]);cols=np.arange(M.shape[1]);S=M.copy()
    while not S.all():
        rm=S.shape[0]-S.sum(0); cm=S.shape[1]-S.sum(1)  # missing per col, per row
        # drop worst of rows/cols by missing count scaled
        i=cm.argmax();j=rm.argmax()
        if cm[i]/S.shape[1] >= rm[j]/S.shape[0] and S.shape[0]>1:
            S=np.delete(S,i,0);rows=np.delete(rows,i)
        else:
            S=np.delete(S,j,1);cols=np.delete(cols,j)
    return rows,cols
for sub,name in [(np.arange(len(E)),'all')]:
    rows,cols=greedy(M); print('greedy complete',len(rows),len(cols))
# per locus
for L in ['Tfcp2l1','Klf2','Nanog']:
    er=[i for i,e in enumerate(E) if L in loc[e]]
    pr=[j for j in range(len(P)) if M[er,j].any()]
    S=M[np.ix_(er,pr)];print(L,S.shape,S.mean())
    rows,cols=greedy(S);print('  complete',len(rows),len(cols))
