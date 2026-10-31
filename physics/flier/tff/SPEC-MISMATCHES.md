# Four mismatches found by building the TFF spec as a mesh

Recorded by the hub, 2026-10-31. The physics session that wrote `tff.json` ended before these could
be relayed to it, so they are logged here rather than fixed: the spec is that session's work and the
numbers below are discrepancies to resolve, not corrections already applied.

Source: `anatomy-model/parametric/` built `tff.glb` from `tff.json`. The mesh hits the spec's headline
numbers exactly (wing loading 12.000 N/m², lifting area 0.049050 m², span 0.66441 m). Getting there
surfaced these. Full detail in the manifest's `tff_spec_cross_check.MISMATCHES_FOUND`.

## 1. Two aspect ratios share one name (the substantive one)

`design.py` keeps "the fish's own aspect ratio" at 9.0–10.7, which is span² / **pectoral** area
(0.261² / 0.006377 = 10.68), then applies 9.0 to the **total lifting** area. The real flying fish's
span² / total lifting area is 5.37, not 10.7.

Carried through, the TFF's pectoral-only aspect ratio is **17.9** — more slender than any measured
flying fish. Fish (1990) reports pectoral aspect ratio 3.0–16.9 across 199 specimens of six genera
(we do not hold that full text; the figure comes from the collaborator's graph and is unverified here),
so 17.9 lies outside even that range.

A reader will take "aspect ratio 9, the fish's own" to mean the wings are shaped like a flying fish's.
On the pectoral-only reading they are not. Which area the 9.0 belongs to needs restating.

## 2. Rounding

The stated ×3.9 area and ×2.5 span give wing loading 11.90 N/m² and aspect ratio 8.60, not 12.0 and 9.0.
The exact multipliers are 3.865857 and 2.545674. State the exact ratios or the rounded outcomes, not both.

## 3. Two incompatible readings; no mesh satisfies both

- Spread the area multiplier over all lifting surfaces → wing loading exactly 12.0. **This is what shipped**,
  because the spec names wing loading.
- Put all the extra area in the pectorals → pectoral aspect ratio exactly 9.0, matching Park & Choi, but
  wing loading falls to 10.63.

## 4. The flight muscle does not fit

At 0.16 of 0.060 kg and a muscle density of 1060 kg/m³, the flight muscle is 9.06×10⁻⁶ m³. Only **29.5%**
of it fits inside the body at the pectoral girdle.

This is a geometric consequence of the spec itself, found by trying to build it. It belongs in the
"what no animal has" table alongside the required cardiac output: the design needs a flight muscle
that does not fit in the animal.
