"""usage: python -I -X utf8 gp.py FILE REGEX [maxlen] : print lines matching regex (case-insens) containing a digit"""
import sys,re
t=open(sys.argv[1],encoding='utf8',errors='replace').read()
rx=re.compile(sys.argv[2],re.I); ml=int(sys.argv[3]) if len(sys.argv)>3 else 700
for i,l in enumerate(t.split('\n')):
    if rx.search(l) and re.search(r'\d',l): print(f'[{i}]',re.sub(r'\s+',' ',l)[:ml])
