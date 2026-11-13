"""Render PDF pages containing a phrase to PNG and print words near a keyword. Usage: python pdf_page.py file.pdf "phrase" outprefix [keyword]"""
import sys, fitz
d = fitz.open(sys.argv[1])
for i, p in enumerate(d):
    if sys.argv[2] in p.get_text():
        out = f"{sys.argv[3]}_p{i}.png"; p.get_pixmap(dpi=120).save(out); print("saved", out, "page", i)
        if len(sys.argv) > 4:
            for w in p.get_text("words"):
                if w[4].startswith(sys.argv[4]): print(w[:5])
