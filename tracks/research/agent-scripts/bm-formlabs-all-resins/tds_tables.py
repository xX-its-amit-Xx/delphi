"""Reconstruct TDS tables with row labels using PyMuPDF (needs user-site pymupdf 1.28.2: run `python -E -P tds_tables.py file.pdf`).
Prints one line per table row: label | cell1 | cell2 ...   (labels = words left of first non-empty value cell on the same y band)."""
import fitz,sys
sys.stdout.reconfigure(encoding='utf-8')
def rows_of(path, pages=None):
    d=fitz.open(path); out=[]
    for pn,p in enumerate(d):
        if pages and pn not in pages: continue
        words=p.get_text('words')
        for t in p.find_tables().tables:
            for r in t.rows:
                x0,y0,x1,y1=r.bbox
                cells=[]
                for c in r.cells:
                    if c is None: cells.append(''); continue
                    cx0,cy0,cx1,cy1=c
                    cells.append(' '.join(w[4] for w in sorted([w for w in words if cx0-1<=(w[0]+w[2])/2<=cx1+1 and cy0-1<=(w[1]+w[3])/2<=cy1+1],key=lambda w:(round(w[1]),w[0]))))
                # label: words left of table or in first empty cell, same y band
                first=next((i for i,c in enumerate(cells) if c),None)
                lx=min([c[0] for c in r.cells if c] or [x0])
                lab=' '.join(w[4] for w in sorted([w for w in words if w[2]<=lx+2 and y0-1<=(w[1]+w[3])/2<=y1+1],key=lambda w:(round(w[1]),w[0])))
                out.append((pn,lab,cells))
    return out
if __name__=='__main__':
    for pn,lab,cells in rows_of(sys.argv[1]):
        print(pn,'|',lab,'|',' | '.join(c.replace('\n',' ') for c in cells))
