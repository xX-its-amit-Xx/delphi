"""Findings block C: Venus flytrap (and Aldrovanda), plus the project-record ceiling, plus Dawson 1997 access status."""
from quotes import qs as q, URLS

F = []
def add(claim, key, quote, conf, value=""):
    F.append(dict(claim=claim, source=URLS[key], confidence=conf, value=value, evidence_quote=quote, _key=key))

# ---------- Venus flytrap ----------
add("Venus flytrap (Forterre et al 2005) closes in about 100 ms; the mechanism is a snap-buckling instability whose onset the plant controls actively. Not a diffusion-limited hygromorph.",
    "PM_FOR", q("PM_FOR", "The rapid closure of the Venus flytrap (Dionaea muscipula) leaf in about 100 ms is one of the fastest movements in the plant kingdom."), "high", "~100 ms")
add("Flytrap snap-buckling takes 100 to 300 ms in adult traps; the lobes flip from concave to convex.",
    "D1", q("D1", "snap-buckling—a motion performed between 100 and 300 ms"), "high", "100-300 ms")
add("Flytrap closing force 0.149 N and pressure 41 kPa between adjacent lobe rims (Volkov et al 2013, as quoted by Durak 2022).",
    "D1", q("D1", "closing force of 0.149 N and pressure of 41 kPa between the adjacent lobe rims"), "medium", "0.149 N; 41 kPa (secondary)")
add("Flytrap seedlings close slowly: fastest seedling trap 4.96 s versus 100-300 ms for adult traps, so seedling closure is thought to be purely hydraulic and snap-buckling is acquired later.",
    "D1", q("D1", "The fastest snapping duration for a seedling was measured at 4.96 s"), "high", "4.96 s vs 0.1-0.3 s")
add("Flytrap closure timeline (Tsugawa 2025): the whole movement is completed within 900 milliseconds of the second stimulus; water transport takes minutes and is too slow to explain it, hence the snap-buckling hypothesis.",
    "TS", q("TS", "with the entire movement completed within 900 milliseconds of the second stimulus"), "high", "<=900 ms")
add("Water-transport time scale in the trap is minutes, 'too slow to account entirely for the movement'; for comparison h^2/D = 1000 s at 1 mm (Reyssat & Mahadevan, D ~ 1e-9 m^2/s). Snap speed is therefore about 10^4 times faster than diffusion allows at 1 mm (1000 s / 0.1 s, my arithmetic).",
    "TS", q("TS", "the typical time scale of water transport is on the order of minutes, which is too slow to account entirely for the movement"), "high", "ratio ~1e4")
add("Flytrap reopening is slow and size dependent: median 28.07 h (N clone, median trap length 23 mm) and 31.45 h (L clone, 32.72 mm); in some large traps a reverse snap-buckling stage lasts 6 to 60 min.",
    "D2", q("D2", "N 28.07 23 11.23 14.55 28.05 L 31.45 32.72 15.17 23.95 43.10"), "high", "reopen 28.07 / 31.45 h")
add("Reverse snap-buckling during reopening takes 6 to 60 min, far slower than closing.",
    "D2", q("D2", "took between 6–60 min"), "high", "6-60 min")
add("Flytrap lobe slenderness (length over thickness, simplified) median 38.67 (N) and 44.74 (L); larger, more slender traps are the ones that reopen by reverse snap-buckling.",
    "D2", q("D2", "median slenderness values of 38.67 and 44.74 for N and L morphotypes respectively"), "high", "slenderness 38.7 / 44.7")
add("Hirata et al 2026 model the flytrap leaf as two layers: the curvature is set by the cumulative strain difference between the layers, the same quantity (delta-epsilon / h) the Timoshenko bilayer converts to curvature.",
    "HI", q("HI", "D can be interpreted as the cumulative effect of strain differences between the two layers translated by curvature change"), "medium", "two-layer strain difference -> curvature")
add("Hirata et al 2026 abstract: closure is rapid (under 1 s); buckling, hydrostatic pressure and hydroelastic coupling have all been proposed; angular velocity correlates with a non-dimensional shape index.",
    "HI", q("HI", "the Venus flytrap ( Dionaea muscipula ) is known for its rapid (<1 s) trap closure"), "high", "<1 s")
add("Aldrovanda (waterwheel plant, close relative of the flytrap): lobes 4 to 7 mm long shut in about 100 ms (Poppinga & Joyeux 2011).",
    "PJ", q("PJ", "The lobes shut in about 100 ms upon excitation of one of the 20 sensitive hairs"), "high", "100 ms; 4-7 mm lobes")
add("Poppinga & Joyeux's Dionaea model ASSUMES a uniform lobe thickness h = 400 um (a model input, not a measurement; the same model uses a 2 cm x 1 cm leaf).",
    "PJ", q("PJ", "We assumed uniform membrane thickness h=400"), "medium", "h=400 um; E=5 MPa (assumed)")
add("Poppinga & Joyeux: the fast snap of Aldrovanda comes from kinematic amplification of midrib bending, whereas Dionaea 'unambiguously relies on the buckling instability' of the two lobes.",
    "PJ", q("PJ", "the fast snapping of Aldrovanda is due to kinematic amplification of the bending deformation of the midrib"), "high", "mechanism difference")
add("Poppinga & Joyeux model assumes E = 5 MPa for parenchymatous tissue as 'typical'.",
    "PJ", q("PJ", "For the Young's modulus, we used a value E=5 MPa, which is typical of parenchymatous tissues"), "medium", "E=5 MPa (assumed)")

# ---------- project record ceiling ----------
add("Project record: the Lean file proves the Timoshenko coefficient is at most 3/(2h) for all positive h, m, n (so kappa*h/d_eps <= 3/2), with equality when m^2 n = 1. I read the file (read-only) and did not rerun Lean in this task.",
    "LEAN", q("LEAN", "timoshenkoCoefficient h m n ≤ 3 / (2 * h)"), "high", "ceiling 3/2 at m^2 n = 1")

# ---------- Dawson 1997 access ----------
add("Dawson, Vincent & Rocca 1997 'How pine cones open' (Nature 390:668) resolves in Crossref; the nature.com page returned a JavaScript client challenge, PubMed has no record for the DOI, and no open full text was found. Every Dawson number in this report is therefore a secondary quotation (Reyssat & Mahadevan: n ~ 5; Cecchini: alpha 0.20 and 0.06).",
    "RM", q("RM", "Prior experimental measurements of the moduli of the bilayer tissues ( Dawson et al. 1997 ) suggest that n ≃ 5"), "medium", "Dawson primary text not read")
