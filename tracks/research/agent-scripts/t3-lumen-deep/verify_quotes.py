import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import re,sys
from quotes import S,Q
D='D:/Users/ashenoy00000/delphi-work/agents2/scratch/t3-lumen-deep/'
n=lambda s: re.sub(r'\s+',' ',s.replace('\u2019',"'")).strip()
bad=0
for k,(s,q) in Q.items():
    t=n(open(D+S[s]+'.txt',encoding='utf8',errors='replace').read())
    ok=n(q) in t and len(q.split())<=40
    if not ok: bad+=1; print('FAIL',k,len(q.split()),'words')
print('checked',len(Q),'bad',bad)
