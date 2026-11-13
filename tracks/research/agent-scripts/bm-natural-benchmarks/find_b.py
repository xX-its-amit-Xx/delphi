"""Findings block B: awns (wheat, Erodium, Pelargonium), seed pods (Bauhinia, sesame)."""
from quotes import qs as q, URLS

F = []
def add(claim, key, quote, conf, value=""):
    F.append(dict(claim=claim, source=URLS[key], confidence=conf, value=value, evidence_quote=quote, _key=key))

# ---------- wheat awn ----------
add("Wheat awn (Elbaum et al 2007): the abstract says cellulose-fibril arrangement bends the awns with humidity and that silicified hairs make the unit move only toward the seeds; no thickness, modulus, strain or time is in the abstract and the full text was paywalled.",
    "PM_ELB", q("PM_ELB", "The arrangement of cellulose fibrils causes bending of the awns with changes in humidity."), "high", "no numbers in abstract")
add("Wheat awn: the abstract states the awns are driven by the daily humidity cycle, so the timescale is hours (day-night), not seconds.",
    "PM_ELB", q("PM_ELB", "Fueled by the daily humidity cycle, the awns induce the motility required for seed dispersal."), "high", "daily cycle (~24 h)")
add("Wheat-awn Young's modulus 10 +/- 2.8 GPa (ridge) to 20.5 +/- 2.6 GPa (cap) is attributed to Elbaum et al 2007 by a SECONDARY table (Mazzolai et al 2021); I could not check the primary text, so treat as unverified.",
    "MZ", q("MZ", "finding values that range from 10 ± 2.8 GPa at the ridge, to 20.5 ± 2.6 GPa at the cap"), "low", "E=10..20.5 GPa (secondary)")
add("Awn mechanism, as summarised by Huss & Gierlinger 2021: the stress-generating layer has large or random microfibril angle, the other layer a small angle (30 degrees or less); a tilted cellulose helix makes awns coil instead of bend.",
    "HS", q("HS", "show a large MFA (or random orientation; Elbaum et al ., 2007 ) in the stress‐generating layer and a small MFA (≤ 30°) in the other layer"), "medium", "MFA large/random vs <=30 deg")

# ---------- Erodium / Pelargonium ----------
add("Erodium gruinum awn (Ronzan 2025): extensional force 45.9 +/- 22.6 mN and moment 528 +/- 54 uN m; Pelargonium appendiculatum 5.1 +/- 1.1 mN and 20.7 +/- 2.5 uN m. Model values 53.3 mN / 658.5 uN m for Erodium and 5.6 mN / 57.7 uN m for Pelargonium.",
    "RZ", q("RZ", "5.1 ± 1.1 mN and 45.9 ± 22.6 mN (5.6 mN and 53.3 mN for the model), while the moments were 20.7 ± 2.5 and 528 ± 54 µN m (57.7 and 658.5 µN m for the model)"), "high",
    "F_ext 45.9 mN (Erodium), 5.1 mN (Pelargonium); M 528 / 20.7 uN m")
add("Agreement with model (awns): Erodium force within 16 percent of the model (53.3 vs 45.9 mN, my arithmetic); Erodium moment model 658.5 vs measured 528 uN m (+25 percent); Pelargonium moment model 57.7 vs measured 20.7 uN m (2.8 times too high).",
    "RZ", q("RZ", "The results obtained were comparable with the model, except for the higher moment"), "medium", "model/measured: 1.16 (Erodium F), 1.25 (Erodium M), 2.79 (Pelargonium M)")
add("Blocking forces (wet to dry): Pelargonium 0.36 +/- 0.17 mN, Erodium 6.27 +/- 1.92 mN (N = 3).",
    "RZ", q("RZ", "The blocking forces were 0.36 ± 0.17 mN and 6.27 ± 1.92 mN, respectively, for Pelargonium and Erodium"), "high", "0.36 vs 6.27 mN")
add("Erodium gruinum awn nanoindentation moduli at 50 %RH, 25 C (N = 5), inner/outer layer by region E1, E2, E3 in GPa: 0.73/0.34, 3.20/1.36, 1.73/4.17; Pelargonium P1-P3 inner/outer 1.10/2.15, 0.63/1.42, 0.55/0.94. The inner-to-outer ratio changes from region to region (not a fixed n).",
    "RZ", q("RZ", "Erodium 0.73 ± 0.23 0.34 ± 0.04 3.20 ± 0.68 1.36 ± 0.22 1.73 ± 0.74 4.17 ± 1.20"), "high", "E 0.34-4.17 GPa (Erodium)")
add("Pelargonium appendiculatum awn (Cecchini 2023): cap layer 39.8 +/- 6.9 um and ridge layer 59.7 +/- 9.8 um thick (n = 6).",
    "CC", q("CC", "h Cap = 39.8 ± 6.9 µm and h Ridge = 59.7 ± 9.8 µm (n = 6)"), "high", "h_cap 39.8 um; h_ridge 59.7 um")
add("Pelargonium awn moduli: E_cap = 0.78 +/- 0.29 GPa, E_ridge = 1.48 +/- 0.25 GPa (nanoindentation, 50 %RH, 25 C, n = 5). Read as a bilayer (my reduction): m = 1.5, n = 1.9, m^2 n = 4.3, f = 1.30 = 87 percent of ceiling.",
    "CC", q("CC", "E Cap = 0.78 ± 0.29 GPa and E Ridge = 1.48 ± 0.25 GPa ( n = 5)"), "high", "E 0.78 / 1.48 GPa; f=1.30")
add("Pelargonium hygroscopic expansion coefficients taken from Dawson et al as 0.20 +/- 0.04 (cap) and 0.06 +/- 0.02 (ridge). Unit is not stated; a secondary table elsewhere prints 'for dRH = 1%'. Ambiguous; do not use as a strain.",
    "CC", q("CC", "α Cap = 0.20 ± 0.04 and α Ridge = 0.06 ± 0.02"), "low", "alpha 0.20 / 0.06 (units unclear)")
add("Pelargonium natural seed: torque 20.7 +/- 2.5 uN m, extensional force 5.1 +/- 1.1 mN; a 4D-printed artificial seed gave 30.4 +/- 5.1 uN m and 2.4 +/- 0.6 mN, and the authors say the theoretical model predicts the kinematics and statics within the confidence interval.",
    "CC", q("CC", "the developed theoretical model predicts, within the confidence interval, the kinematics and statics of the seeds"), "high", "agreement within CI (as claimed)")
add("Erodium cicutarium awn (Evangelista 2011, via Mazzolai 2021 table): 9 +/- 2 turns, awn spiral angle 86 +/- 2 degrees, awn height 15 +/- 5 mm, maximum awn diameter 2 +/- 1 mm.",
    "MZ", q("MZ", "Number of turns: 9 ± 2 • Awn spiral angle: 86 ± 2°"), "medium", "9 turns; 86 deg (secondary table)")
add("Pelargonium appendiculatum helix at 50 %RH: radius 0.90 +/- 0.43 mm, pitch 1.85 +/- 0.24 mm, both growing with humidity (Ha et al 2020, via Mazzolai table).",
    "MZ", q("MZ", "R = 0.90 ± 0.43 mm • p = 1.85 ± 0.24 mm"), "medium", "R 0.90 mm; p 1.85 mm (secondary)")
add("Erodium coiling is NOT a two-layer Timoshenko bilayer: SAXS shows cellulose microfibrils tilted about 20 degrees at the bottom of the coiling region to about 10 degrees at the top in a single inner layer; the tilt, not a thickness/modulus ratio, sets the handedness and radius.",
    "AB", q("AB", "starting at about 20° tilt at the bottom of the coiling region to about 10° at its top"), "high", "tilt 20 -> 10 deg")
add("Tilted-helix awns: microfibril angle and tilt per sublayer from Abraham & Elbaum 2013 (via Mazzolai table): Erodium gruinum tilt 3, >3, 20 degrees and MFA 30, 10, 80 degrees for outermost, median, inner sublayer.",
    "MZ", q("MZ", "Erodium gruinum • Ψ = 3°, >3° and 20° • MAFH = 30, 10 and 80°"), "medium", "psi 3/>3/20; MFA 30/10/80 deg (secondary)")

# ---------- Bauhinia ----------
add("Bauhinia variegata pod (Armon et al 2011) abstract: pod valve turns from flat into a helix; the strip is modelled with a flat intrinsic metric and saddle-like intrinsic curvature; the authors say the theory 'quantitatively predicts all observed configurations'. No numbers (thickness, modulus, angle, time) are in the abstract; the full text was paywalled.",
    "PM_ARM", q("PM_ARM", "Our theoretical analysis quantitatively predicts all observed"), "medium", "agreement: 'quantitative' (unquantified in abstract)")
add("Bauhinia pod valve: two fibre layers with fibres perpendicular to each other, each at 45 degrees to the long axis of the pod (as summarised in Wan et al 2018, not from Armon directly).",
    "WN", q("WN", "both have a 45° angle relative to the long axis of the seedpod"), "medium", "fibres +/-45 deg")
add("The helix of a pod strip is governed by the dimensionless width w~ = w*kappa0/t (width, intrinsic curvature, thickness), the ratio of stretching to bending energy; narrow strips twist, wide strips coil (secondary summary of Armon 2011).",
    "WN", q("WN", "dimensionless width w ˜ = w κ 0 / t"), "medium", "w~ = w kappa0 / t")

# ---------- sesame ----------
add("Sesame capsule (Shtein 2016): outer soft parenchyma (mesocarp) is the active layer, shrinking to 30 percent of its wet thickness on drying (they quote ~300 percent change); the stiff fibre layers barely change.",
    "HG", q("HG", "with the parenchyma shrinking to 30% of its wet-state thickness"), "high", "mesocarp -> 30 % of wet thickness")
add("Sesame model inputs are ASSUMED, not measured: stiffness ratios 20 (along fibres) : 5 (across fibres) : 0.1 (parenchyma) 'based on typical values from the literature'. So the passive/active modulus ratio entering the model is 50 to 200.",
    "HG", q("HG", "A stiffness ratio of 20 (along the fibers) to 5 (perpendicular to the fibers) to 0.1 (parenchymatous mesocarp) was selected"), "high", "E ratio 20 : 5 : 0.1 (assumed)")
add("Sesame agreement with theory: a layered hygro-elastic model 'successfully simulated the opening curvature'; the curvature is written kappa_L = f*eps with f depending on stiffness anisotropy, thickness and sequence of layers (the Timoshenko structure). No error figure in text.",
    "HG", q("HG", "A biomechanical hygro-elastic model based on the relative thicknesses of the layers successfully simulated the opening curvature."), "medium", "agreement: qualitative")
add("Sesame: removing the outer layer inhibited the opening movement, so the soft layer is the actuator and the fibre layers the restraint (same logic as a pine scale).",
    "HG", q("HG", "Removal of this outer layer inhibited the opening movement, indicating that it is the active tissue."), "high", "")
