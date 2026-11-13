"""Input ranges for the Monte Carlo, each with where it comes from. Units: mm, MPa, m^2/s, fractions (not %).

Nothing here is a measured hygroscopic coefficient of a Formlabs resin: none exists in any source read by this
project (see the earlier agents' could_not_find lists). The strain range is derived from Formlabs' own ASTM D471
volume changes; the modulus ranges from Formlabs' stress-at-elongation rows; both derivations are in
derive_inputs() so they can be re-run.
"""
import math

import numpy as np


def derive_inputs():
    """Arithmetic behind the ranges (all inputs are printed values from the Formlabs data sheets, fetched 2026-11-12)."""
    d = {}
    # Flexible 80A V2 TDS p.6 (ASTM D471 slabs, deionized water): 1 day +8 % mass +3 % volume; 1 week +9 % mass +7 % volume
    d["eps_lin_1d_from_vol"] = 1.03 ** (1 / 3) - 1          # 0.99 %
    d["eps_lin_1wk_from_vol"] = 1.07 ** (1 / 3) - 1         # 2.28 %
    # upper end: ideal volume mixing of 9 % mass of water (density 1.00) into resin of density 1.09 g/cm3 (TDS solid density)
    d["vol_ideal_mixing_9pct"] = 0.09 * 1.09 / 1.00         # 9.8 % volume
    d["eps_lin_ideal_mixing"] = (1 + d["vol_ideal_mixing_9pct"]) ** (1 / 3) - 1  # 3.2 %
    # secant moduli from stress at elongation (TDS, post-cured): E ~ stress / strain
    d["E_80A_secant_50"] = 2.9 / 0.5                         # 5.8 MPa
    d["E_80A_secant_100"] = 4.7 / 1.0                        # 4.7 MPa
    d["E_80A_secant_200"] = 8.6 / 2.0                        # 4.3 MPa
    d["E_50A_secant_50"] = 0.9 / 0.5                         # 1.8 MPa
    d["E_50A_secant_100"] = 1.7 / 1.0                        # 1.7 MPa
    d["E_sil_secant_50"] = 0.4 / 0.5                         # 0.8 MPa
    d["E_sil_secant_100"] = 1.0 / 1.0                        # 1.0 MPa
    d["E_sil_secant_150"] = 2.1 / 1.5                        # 1.4 MPa
    # Shore A -> modulus, Gent 1958 relation (UNVERIFIED BACKGROUND, used only to bracket the upper end and the wet softening)
    def gent(S):
        return 0.0981 * (56 + 7.62336 * S) / (0.137505 * (254 - 2.54 * S))
    d["E_80A_gent_shore83_dry"] = gent(83)                   # TDS Shore A 83 post-cured
    d["E_80A_gent_shore57_wet"] = gent(83 - 26)              # TDS: -26 Shore A points after 1 day in water
    d["wet_over_dry_gent"] = d["E_80A_gent_shore57_wet"] / d["E_80A_gent_shore83_dry"]
    return d


DER = derive_inputs()

# Diffusivity of water in Flexible 80A V2 (m^2/s). Two inversions of the same data sheet disagree:
# mass (8 -> 9 %) gives ~9e-12, volume (3 -> 7 %) gives ~1.4e-12 for an assumed 2 mm slab (slab thickness unstated).
# The prior spans both plus the stock-resin literature range 4e-13 .. 1.1e-11 (earlier agents).
D_RANGE_M2S = (1.0e-12, 1.1e-11)

PAIRS = {
    "A": dict(name="Flexible 80A V2 (active) + Flexible 50A (passive)",
              E_p=(1.2, 2.5), eps_p=(0.0, 0.008), rho_p=1010.0,
              note="same (meth)acrylate chemistry, bond plausible; passive water strain unmeasured (Formlabs 24 h cube: 0.7 % mass)"),
    "B": dict(name="Flexible 80A V2 (active) + Silicone 40A (passive)",
              E_p=(0.7, 1.6), eps_p=(0.0, 0.0005), rho_p=1100.0,
              note="polysiloxane passive layer, water <0.1 % mass in 24 h cube; bond to acrylate UNPROVEN; density assumed (unverified)"),
}
RHO_ACTIVE = 1090.0  # kg/m^3, Flexible 80A V2 TDS solid density 1.09 g/cm3


def loguniform(rng, lo, hi, n):
    return np.exp(rng.uniform(math.log(lo), math.log(hi), n))


def draw(rng, n, pair, eps_a_tri=None):
    """Draw n joint samples of every uncertain input for one material pair."""
    P = PAIRS[pair]
    eps_a = rng.triangular(DER["eps_lin_1d_from_vol"], DER["eps_lin_1wk_from_vol"], DER["eps_lin_ideal_mixing"], n) \
        if eps_a_tri is None else rng.triangular(*eps_a_tri, n)
    E_dry = loguniform(rng, 4.3, 11.0, n)                 # secant 4.3-5.8 MPa up to Gent 11 MPa
    wet = loguniform(rng, 0.28, 1.0, n)                   # Gent: Shore 83 -> 57 gives 0.28 of the dry modulus
    return dict(
        eps_a=eps_a,
        eps_p=rng.uniform(*P["eps_p"], n),
        E_a=E_dry * wet,
        E_p=loguniform(rng, *P["E_p"], n),
        D=loguniform(rng, *D_RANGE_M2S, n) * 1e6,         # mm^2/s
        dt_a=rng.uniform(-0.08, 0.08, n),                 # layer thickness error, mm (first-layer squash, z tolerance)
        dt_p=rng.uniform(-0.08, 0.08, n),
        t_b=rng.uniform(0.02, 0.10, n),                   # bond line, mm (UNMEASURED: first experiment measures it)
        rho_p=P["rho_p"],
    )


def pct(x, q=(5, 50, 95)):
    x = np.asarray(x, float)
    return [float(np.percentile(x, k)) for k in q]
