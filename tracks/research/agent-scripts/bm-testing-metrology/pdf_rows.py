"""Rebuild table rows of a PDF page by text y-position. usage: python -I pdf_rows.py file.pdf page(1-based) [filter]"""
import sys, pypdf
f, pg = sys.argv[1], int(sys.argv[2]); flt = sys.argv[3].lower() if len(sys.argv)>3 else None
r = pypdf.PdfReader(f); page = r.pages[pg-1]
items=[]
def v(text, cm, tm, fd, fs):
    t=text.strip()
    if t: items.append((round(tm[5]*cm[3]+cm[5] if False else tm[5],0), tm[4], t))
page.extract_text(visitor_text=v)
rows={}
for y,x,t in items: rows.setdefault(y,[]).append((x,t))
for y in sorted(rows, reverse=True):
    line=' | '.join(t for x,t in sorted(rows[y]))
    if flt is None or flt in line.lower(): print(int(y), line)
