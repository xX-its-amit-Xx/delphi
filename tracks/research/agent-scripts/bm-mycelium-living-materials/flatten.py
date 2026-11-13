"""Usage: python -I flatten.py in.txt out.txt -- collapse whitespace, fix soft hyphen/line-break hyphenation."""
import sys,re
t=open(sys.argv[1],encoding='utf-8',errors='replace').read()
t=t.replace('­','').replace('-\n','-')
t=re.sub(r'\s+',' ',t)
open(sys.argv[2],'w',encoding='utf-8').write(t); print(len(t))
