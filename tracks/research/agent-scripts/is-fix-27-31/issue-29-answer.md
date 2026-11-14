# #29 Formlabs: the ten usable materials and the missing swelling data
Goes to: tracks/research/formlabs-ten.md
Status: PARTLY. The swelling-data gap is confirmed still open in the record; the choice of ten is a proposal for Amit, not a fact.

Source for all numbers: tracks/research/agents/bm-formlabs-all-resins.json and bm-resin-water-uptake-data.json (data sheets fetched 2026-11-12 by earlier agents; not re-fetched today).

Rule for the proposal: span stiffness and water uptake, because a moisture-driven bilayer needs one layer that swells and one that does not.

Proposed set:
1. Flexible 80A V2 (the only resin with a published volume change: +3 % at 1 day, +7 % at 1 week, ASTM D471)
2. Elastic 50A V2 (24 h mass gain 0.7 %)
3. Clear V5 (0.9 %)
4. Grey V5 (0.8 %)
5. Tough 2000 V2 (0.19 %)
6. Rigid 10K (stiff passive layer; water figure not seen by me)
7. Nylon 12 powder
8. Nylon 11 powder (0.07 % on its data sheet)
9. Nylon 12 GF powder
10. TPU 90A powder (0.9 %)

Caveat: items 6, 7 and 9 are picked for stiffness range only; I did not see their water numbers in the summaries I read.

Blocking gap (unchanged): no hygroscopic expansion coefficient and no water diffusivity is published for any Formlabs resin. The only derived value is the earlier agent's arithmetic: 1.03^(1/3) - 1 = 0.99 % linear strain at 1 day for Flexible 80A V2, assuming isotropy.

Cheapest way to close it: print 3 strips per material; weigh and measure length dry and after 1, 7 and 28 days in water; fit Fickian uptake for diffusivity. No public data substitutes for this.

Single missing fact from Amit: which printers the partner has (Form 4 only, or also Fuse), since 4 of the proposed 10 are Fuse powders.
