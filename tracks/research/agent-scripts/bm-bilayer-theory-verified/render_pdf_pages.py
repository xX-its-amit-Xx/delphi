"""Render pages of a PDF whose text contains a marker, to PNG. Usage: render_pdf_pages.py in.pdf outdir marker [dpi]
Needs PyMuPDF (import fitz)."""
import sys, os, fitz
pdf, outdir, marker = sys.argv[1:4]; dpi = int(sys.argv[4]) if len(sys.argv) > 4 else 110
os.makedirs(outdir, exist_ok=True)
d = fitz.open(pdf)
print("pages", len(d))
for i, p in enumerate(d):
    t = p.get_text()
    if marker.lower() in t.lower():
        out = os.path.join(outdir, f"p{i+1}.png"); p.get_pixmap(dpi=dpi).save(out); print("hit", i+1, out)
