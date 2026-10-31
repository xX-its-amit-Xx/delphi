#!/usr/bin/env python3
"""Extract the columns the pre-registered scoring rule needs from the AVONET workbook.

Usage: python3 avonet-extract.py <path to AVONET Supplementary dataset 1.xlsx> <out.csv>

Reads sheet "AVONET1_BirdLife" and writes Species1, Family1, Order1, Primary.Lifestyle,
Hand-Wing.Index and Mass to CSV. Writes nothing else and prints the row count and the
SHA-256 of the input so the scorer can record them. Needs openpyxl.
"""
import csv, hashlib, sys
import openpyxl

src, out = sys.argv[1], sys.argv[2]
h = hashlib.sha256(open(src, "rb").read()).hexdigest()
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
ws = wb["AVONET1_BirdLife"]
rows = ws.iter_rows(values_only=True)
header = [str(c) if c is not None else "" for c in next(rows)]
want = ["Species1", "Family1", "Order1", "Primary.Lifestyle", "Hand-Wing.Index", "Mass"]
idx = [header.index(w) for w in want]
n = 0
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(want)
    for r in rows:
        if r is None or r[idx[0]] is None:
            continue
        w.writerow([r[i] for i in idx])
        n += 1
print(f"rows={n} sha256={h}")
