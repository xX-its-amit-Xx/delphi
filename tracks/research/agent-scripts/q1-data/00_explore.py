import sys; sys.path.append(r'D:\Users\ashenoy00000\AppData\Roaming\Python\Python314\site-packages')
import gzip,csv,collections as C,numpy as np
F=r'D:\Users\ashenoy00000\delphi-work\data\martinezara2022\GSE186265_Activities_allcombinations_Upstream.tsv.gz'
r=list(csv.DictReader(gzip.open(F,'rt'),delimiter='\t'))
ep=[x for x in r if x['class']=='EP']
a=np.array([[float(x['activity_br%d'%i]) for i in (1,2,3)] for x in ep]); print('min',a.min(),'nonpos',(a<=0).sum(),np.percentile(a,[1,50,99]))
for loc in ['Tfcp2l1','Klf2','Nanog']:
  for so in [('+','+'),('+','-'),('-','+'),('-','-'),None]:
    s=[x for x in ep if x['locus']==loc and (so is None or (x['strand1'],x['strand2'])==so)]
    E=sorted({x['frag1'] for x in s});P=sorted({x['frag2'] for x in s})
    pairs={(x['frag1'],x['frag2']) for x in s}
    print(loc,so,len(E),len(P),len(pairs),round(len(pairs)/(len(E)*len(P)),2))
print(len({x['frag2'] for x in ep if x['locus']=='Tfcp2l1'}&{x['frag2'] for x in ep if x['locus']=='Klf2'}))
print({k:ep[0][k] for k in ('id','id1','strand1','id2','strand2')})
