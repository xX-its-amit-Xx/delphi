"""Parse the Formlabs solvent-compatibility HTML tables with header-aware cells; print rows of interest."""
import re, html, sys
p = "D:/Users/ashenoy00000/delphi-work/data/formlabs-printing/solvent.html"
s = open(p, encoding="utf-8", errors="replace").read()
tables = re.findall(r"(?is)<table.*?</table>", s)
print("tables:", len(tables))
want = re.compile(r"Elastic 50|Flexible 50|Flexible 80|Rigid 10K|Silicone 40|Tough 1000|Grey Resin V5|Clear Resin V5", re.I)
def cells(row):
    return [re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", c))).strip() for c in re.findall(r"(?is)<t[hd][^>]*>(.*?)</t[hd]>", row)]
for ti, t in enumerate(tables):
    rows = re.findall(r"(?is)<tr.*?</tr>", t)
    if not rows: continue
    hdr = cells(rows[0])
    print(f"--- table {ti} header: {hdr}")
    for r in rows[1:]:
        c = cells(r)
        if c and want.search(c[0]):
            print(dict(zip(hdr, c)) if len(hdr) == len(c) else c)
