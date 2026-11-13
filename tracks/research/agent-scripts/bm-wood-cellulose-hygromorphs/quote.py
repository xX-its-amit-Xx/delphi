"""usage: quote.py FILE REGEX [n] -> print up to n sentences (<=45 words) containing REGEX, from plain-text FILE (in data/wood-hygro/)."""
import sys,re
D='D:/Users/ashenoy00000/delphi-work/data/wood-hygro/'
t=open(D+sys.argv[1],encoding='utf8',errors='replace').read()
t=re.sub(r'\s+',' ',t)
sents=re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])',t)
n=int(sys.argv[3]) if len(sys.argv)>3 else 4
k=0
for s in sents:
    if re.search(sys.argv[2],s,re.I) and len(s.split())<=45:
        print('-',s); k+=1
        if k>=n: break
