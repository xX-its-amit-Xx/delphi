"""Rebuild the ASTM D471 table of the Formlabs Flexible 80A V2 TDS by word coordinates (pymupdf) because pdftotext scrambles rows.
Usage: python flex80a_v2_water.py <pdf>"""
import sys
try:
    import pymupdf
except ImportError:
    import fitz as pymupdf
doc=pymupdf.open(sys.argv[1])
for pno,page in enumerate(doc):
    if 'Chemical Compatibility' not in page.get_text(): continue
    words=page.get_text("words")
    rows={}
    for x0,y0,x1,y1,w,*_ in words:
        rows.setdefault(round(y0/3),[]).append((x0,w))
    print("page",pno+1)
    for k in sorted(rows):
        print(round(k*3), ' '.join(w for x,w in sorted(rows[k])))
