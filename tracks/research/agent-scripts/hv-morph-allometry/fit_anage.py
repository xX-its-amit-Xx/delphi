"""OLS fit of log10(metabolic rate, W) on log10(body mass, g) for AnAge mammals only.
Usage: python -I fit_anage.py <path to anage_data.txt>
Only rows with Class == Mammalia are read; every other class is skipped unread.
"""
import csv, math, sys

rows = []
with open(sys.argv[1], encoding="utf-8", errors="replace") as f:
    r = csv.DictReader(f, delimiter="\t")
    cols = r.fieldnames
    for x in r:
        if x.get("Class") != "Mammalia":
            continue
        try:
            b = float(x["Metabolic rate (W)"]); m = float(x["Body mass (g)"])
        except (ValueError, KeyError):
            continue
        if b > 0 and m > 0:
            rows.append((math.log10(m), math.log10(b), x.get("Order", "")))
print("columns with rate/mass:", [c for c in cols if "etabolic" in c or "mass" in c.lower()])


def ols(pts):
    n = len(pts); mx = sum(p[0] for p in pts) / n; my = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - mx) ** 2 for p in pts); sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    b = sxy / sxx; a = my - b * mx
    sse = sum((p[1] - a - b * p[0]) ** 2 for p in pts)
    se = math.sqrt(sse / (n - 2) / sxx)
    return n, b, se, a


n, b, se, a = ols(rows)
lo, hi = b - 1.96 * se, b + 1.96 * se
print(f"mammals n={n} slope={b:.4f} se={se:.4f} 95%CI=[{lo:.4f},{hi:.4f}] intercept={a:.4f}")
print("mass range g:", 10 ** min(p[0] for p in rows), 10 ** max(p[0] for p in rows))
print("3/4 inside CI:", lo <= 0.75 <= hi, "| 2/3 inside CI:", lo <= 2 / 3 <= hi)
# curvature test (Kolokotrones 2010): slope in lower vs upper mass half
rows.sort()
h = len(rows) // 2
print("lower-half slope: n=%d b=%.4f se=%.4f" % ols(rows[:h])[:3])
print("upper-half slope: n=%d b=%.4f se=%.4f" % ols(rows[h:])[:3])
# mass-specific rate exponent (predicted -1/4 under Kleiber)
ms = [(p[0], p[1] - p[0]) for p in rows]
print("mass-specific slope: %.4f" % ols(ms)[1])
