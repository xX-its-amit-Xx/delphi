"""Check that every evidence_quote in content_findings.py / content_keys.py occurs verbatim (whitespace-normalised) in its local source text.
Usage: python -I check_quotes.py   (prints FAIL lines; exit 1 if any)"""
import re,sys,os
sys.stdout.reconfigure(encoding="utf-8")
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
D="D:/Users/ashenoy00000/delphi-work/data/bm-myco/"
SRC={"SHENPUB":D+"shen2024_published_abstract.txt","SHEN":D+"arxiv-2305.12151v2.flat.txt","BUEHLER24":D+"buehler2024_abstract.txt"}
for k,p in dict(PARH="PMC12387367",ELS="PMC6645453",HEMP="PMC13707017",GYR="PMC12217796",FOMES="PMC12598823",MYCOF="PMC12038323",DERR="PMC12549730",BRAND="PMC12287172",HAN="PMC5259796",NIE="PMC13558639",WANG="PMC5438213",XIA="PMC13601560",LI="PMC13398475",QIU="PMC7868992",JONES="PMC6279784",BIT="PMC9036240",DERME="PMC11237183",ARCHI="PMC13654977",AID="PMC11429656").items(): SRC[k]=D+p+".txt"
def norm(s): return re.sub(r"\s+"," ",s.replace("\u00ad","")).strip()
cache={}
def check(key,q):
    if not q: return True
    if key not in cache: cache[key]=norm(open(SRC[key],encoding="utf-8").read())
    return norm(q) in cache[key]
bad=0
import content_findings as cf
rows=[(r[0],r[4]) for r in cf.FINDINGS]
try:
    import content_keys as ck; rows+= [(r[0],r[2]) for r in ck.KEY_CLAIMS]
except ImportError: pass
for key,q in rows:
    if q and len(q.split())>40: print("TOO LONG",len(q.split()),q[:60]); bad+=1
    if not check(key,q): print("FAIL",key,"|",q[:110]); bad+=1
print("checked",len(rows),"bad",bad); sys.exit(1 if bad else 0)
