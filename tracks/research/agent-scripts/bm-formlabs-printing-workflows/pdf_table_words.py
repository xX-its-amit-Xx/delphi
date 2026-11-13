"""Dump words with coordinates of the ASTM D471 table page of a TDS PDF using pymupdf, grouped into visual rows.
Usage: python pdf_table_words.py file.pdf "search text" """
import sys, pymupdf
doc = pymupdf.open(sys.argv[1]); key = sys.argv[2]
for pno, page in enumerate(doc):
    if key in page.get_text():
        words = page.get_text("words")  # x0,y0,x1,y1,word,block,line,wno
        rows = {}
        for w in words:
            rows.setdefault(round(w[1] / 3), []).append(w)
        print("PAGE", pno + 1)
        for k in sorted(rows):
            ws = sorted(rows[k], key=lambda w: w[0])
            print(" ".join(f"{w[4]}@{int(w[0])}" for w in ws))
        break
