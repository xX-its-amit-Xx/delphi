# Worked example: genipin-chitosan film numbers in the crosslinker certificate

Source opened (open full text, Europe PMC PMC7285115): Kildeeva et al., "Influence of Genipin
Crosslinking on the Properties of Chitosan-Based Films", Polymers 12 (2020) 1086,
doi 10.3390/polym12051086. Table 2 and surrounding text.

| Gp/NH2 (mol/mol) | swelling, wt % (paper) | chi (paper) | Mc, g/mol (paper) | nu = rho/Mc, mol/m3 (ours) | Q (ours) | strain Q^(1/3)-1 (ours) | E = 3 nu RT, MPa (ours) | ceiling (3/2) eps/h at h = 1 mm, 1/m (ours) |
|---|---|---|---|---|---|---|---|---|
| 0.003 | 1025 | 0.85 | 6934 | 146.8 | 11.43 | 1.253 | 1.09 | 1879 |
| 0.02  | 340  | 0.99 | 1015 | 1003.0 | 4.46 | 0.646 | 7.46 | 969 |

Film density ~1.018 g/cm3 is the paper's. Regenerate with `python -I worked_example.py`.

## What the numbers say
1. Direction agrees with both laws: 6.8x more strands -> swelling falls (Q 11.4 -> 4.5), affine modulus rises.
2. Certificate instance (Lean `genipin_chitosan_instance`, kernel-checked): 1 mm bilayer, target
   curvature 1000 /m and modulus 8 MPa -> empty window (nu_c = 1003 < nu_s = 1050 mol/m3).
3. NOT eliminated: any gentle target. At 100 /m the ceiling is 10-19x higher than needed at both
   measured films, so the curvature side does not bind. In liquid water this family swells so much
   that the curvature ceiling is almost never the limit; it would bind for humidity-driven use
   (strains of a few percent), for which we have no opened number.

## What was wrong (read before using)
- The paper's chi values are 0.85 and 0.99, i.e. ABOVE 1/2. The high-swelling neutral balance
  `nu V1 s^5 = 1/2 - chi` then has no positive solution, so `explicit_window_empty` (the
  computable-threshold form) does NOT apply to this material. Only the model-free form
  `crosslink_window_empty` was used.
- Apparent exponent of Q against nu between the two films is -0.49 versus -0.60 predicted, but this
  is not an independent test: the paper fitted Mc from the same swelling data.
- Two films only. "Strictly decreasing swelling" beyond them is a hypothesis.
- The paper reports that mechanical strength did NOT rise with genipin (breaking load 73 MPa
  uncrosslinked; 65 and 55 MPa at 0.02 and 0.003), and that hydrogen bonds add to the network.
  Breaking load is not modulus, but it is a warning that E increasing in nu is unverified here.
  No modulus for these films was found in the source.
- A 1 mm bend radius on a 1 mm part is outside Timoshenko's thin-beam range; the instance shows the
  arithmetic of the certificate, not a design verdict.
- Affine `3 nu RT` (1-7 MPa) is a rubbery-network estimate; dry chitosan films are glassy.
