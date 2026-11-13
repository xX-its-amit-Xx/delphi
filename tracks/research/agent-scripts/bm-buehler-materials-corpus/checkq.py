# Verify every evidence_quote against its source. Run: python checkq.py
import sys
sys.stdout.reconfigure(encoding='utf8')
B='D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/'
for p in ('p1_sources.py','p2_findings_a.py','p3_findings_b.py'): exec(open(B+p,encoding='utf8').read())
bad=0
for i,(s,c,v,conf,q) in enumerate(FA+FB):
    ok=check(s,q); wc=len(q.split())
    if not ok or wc>40: bad+=1; print('FAIL' if not ok else 'LONG',i,s,wc,q[:110])
print('total',len(FA+FB),'bad',bad)
