#!/usr/bin/env python3
"""Extract the ASTM D471 chemical-compatibility table from the Formlabs Flexible 80A V2 TDS with PyMuPDF find_tables(), print rows with a 'Water' label."""
import pymupdf
doc=pymupdf.open(r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films/flex80a_v2_tds.pdf")
for pno,page in enumerate(doc):
    if "ASTM D471" not in page.get_text(): continue
    for tb in page.find_tables().tables:
        for r in tb.extract():
            print(pno,[ (c or "").replace("\n"," | ") for c in r])
