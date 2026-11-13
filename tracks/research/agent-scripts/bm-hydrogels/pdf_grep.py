#!/usr/bin/env python
"""usage: python -I pdf_grep.py file.pdf regex [regex...]  -> sentences matching (PyMuPDF text)"""
import sys,re,hashlib,datetime
sys.stdout.reconfigure(encoding='utf-8')
import fitz
f=sys.argv[1]; b=open(f,'rb').read()
print('FILE',f,'bytes',len(b),'sha256',hashlib.sha256(b).hexdigest())
t=' '.join(p.get_text() for p in fitz.open(f)); t=re.sub(r'\s+',' ',t)
sents=re.split(r'(?<=[.;])\s+(?=[A-Z])',t)
for pat in sys.argv[2:]:
    print('=== ',pat); n=0
    for s in sents:
        if re.search(pat,s,re.I):
            print(' -',s[:600]); n+=1
            if n>=10: break
