#!/usr/bin/env python3
"""Count wood-bilayer records above the strip ceiling (3/2) and above the wide-plate ceiling (9/4).

    python -I tracks/scripts/check-hygromorph-plate-ceiling.py

Reads the committed table of the hygromorph case (curvature x thickness / swelling difference, per record).
The strip ceiling is proved in tracks/lean/HygromorphCeilingCheck.lean; the wide-plate ceiling
(1+nu) x 3/2 <= 9/4 for nu <= 1/2 is theorem plateCurvature_le in
tracks/research/lean/cs-hygromorph-bilayer__HygromorphFalsifier.lean.

This comparison was made AFTER the data were seen (2026-11-15). It is a consistency check, not a test:
it shows the records do not contradict the plate ceiling, and what Poisson ratio each would need.
"""
import csv, os, sys
here = os.path.dirname(os.path.abspath(__file__))
rows = list(csv.DictReader(open(os.path.join(here, '..', 'research', 'agent-scripts', 'cs-hygromorph-bilayer', 'results_table.csv'), encoding='utf-8')))
vals = [(r['id'], r['split'], float(r['kappa_h_over_deps'])) for r in rows]
above_strip = [v for v in vals if v[2] > 1.5]
above_plate = [v for v in vals if v[2] > 2.25]
worst = max(vals, key=lambda v: v[2])
print(f"records: {len(vals)} ({sum(v[1]=='dev' for v in vals)} development, {sum(v[1]=='holdout' for v in vals)} held out)")
print(f"above the strip ceiling 3/2: {len(above_strip)}")
print(f"above the wide-plate ceiling 9/4: {len(above_plate)}")
print(f"largest value: {worst[2]:.3f} ({worst[0]}); Poisson ratio needed if the excess is all plate effect: {worst[2]/1.5-1:.3f}")
print("plate ceiling not contradicted" if not above_plate else "PLATE CEILING CONTRADICTED")
sys.exit(1 if above_plate else 0)
