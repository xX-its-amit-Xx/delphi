"""Own arithmetic for bm-funding-materials. Run: python -I calc.py"""
from datetime import date
today = date(2026, 11, 12)  # date the pages were read
print("MPS 26-521 mean award: $100,000,000 / 300 =", round(100e6/300), "; / 200 =", round(100e6/200))
print("CMMI 26-515 mean award: $100,000,000 / 275 =", round(100e6/275), "; / 225 =", round(100e6/225))
print("DMREF 25-508: $40,000,000 / 25 =", 40e6/25, "; / 20 =", 40e6/20)
print("NMIP sandpit: GBP 7.12m / 8 =", round(7.12e6/8), "; / 3 =", round(7.12e6/3))
for name, d in [("NMIP Digital Materials Sandpit", date(2026,11,26)), ("ERC Consolidator 2027", date(2027,1,12)),
                ("NMIP Investor Partnerships 1", date(2027,1,19)), ("EIT NEB Catalyse", date(2027,1,15)),
                ("Horizon Europe CL4-2027-01", date(2027,2,2)), ("Simons MPS full proposal", date(2027,2,24)),
                ("EIC Pathfinder Open stage 1", date(2027,2,25)), ("Graham grants to organizations", date(2027,2,25)),
                ("NSF SBIR/STTR next window", date(2027,3,4)), ("ERC Proof of Concept cut-off 1", date(2027,3,10)),
                ("NIH parent R01 next standard date (pattern, inferred)", date(2027,2,5)),
                ("ERC Advanced opens", date(2027,5,27))]:
    print(f"{name}: {d} = {(d-today).days} days after {today}")
