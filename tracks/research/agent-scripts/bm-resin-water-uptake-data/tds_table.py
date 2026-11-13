"""Print rows of a PDF page by y-coordinate to align a scrambled table. usage: python -I tds_table.py file.pdf page(1-based) [keyword]"""
import sys, fitz as pymupdf
doc = pymupdf.open(sys.argv[1]); pg = doc[int(sys.argv[2])-1]
words = pg.get_text("words")
rows = {}
for x0,y0,x1,y1,w,*_ in words:
    rows.setdefault(round(y0/3), []).append((x0,w))
for k in sorted(rows):
    line = "  ".join(w for _,w in sorted(rows[k]))
    if len(sys.argv)<4 or sys.argv[3].lower() in line.lower() or True:
        print(f"{k*3:5d} | {line}")
