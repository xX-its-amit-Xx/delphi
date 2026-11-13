"""Map the ASTM D471 table in the Flexible 80A V2 TDS (PDF) to solvent labels by vertical position
(each solvent label is centred between its '1 day' and '1 week' rows). Prints rows for IPA, TPM, Deionized Water.
Input: D:/.../data/formlabs-printing/flex80_spec.pdf"""
import pymupdf
d = pymupdf.open("D:/Users/ashenoy00000/delphi-work/data/formlabs-printing/flex80_spec.pdf")
p = next(pg for pg in d if "Chemical Compatibility (ASTM D471)" in pg.get_text())
ws = p.get_text("words")
rows = {}
for w in ws: rows.setdefault(round(w[1]), []).append(w)
data = []  # (y, [cells]) for day/week rows
for y, row in rows.items():
    row = sorted(row, key=lambda w: w[0])
    if len(row) >= 2 and row[0][4] in ("1",) and row[1][4] in ("day", "week") and row[0][0] > 100:
        data.append((row[0][1], row[1][4], [w[4] for w in row[2:]]))
data.sort()
labels = {}
for w in ws:
    if w[0] < 60 and w[1] > 150: labels.setdefault(round(w[1], 0), []).append(w)
lab = [(sorted(v, key=lambda w: w[0])[0][1], " ".join(x[4] for x in sorted(v, key=lambda w: w[0]))) for v in labels.values()]
lab = [(y, t) for y, t in lab if t not in ("Solvent",) and not t.startswith(("Chemical", "according", "Test", "relative", "22", "immediately", "Results", "an", "change", "5", "Material", "Time"))]
for y, t in sorted(lab):
    pair = [r for r in data if abs(r[0] - y) < 7]
    if any(k in t for k in ("IPA", "TPM", "Deionized", "Ethanol")):
        print(t, "->", [(r[1], r[2]) for r in pair])
print("columns: hardness change (Shore A pts), mass %, volume %, elongation %, tensile %")
