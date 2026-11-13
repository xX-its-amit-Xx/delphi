"""Run everything for bm-poc-designs. Usage:  python -B run_all.py   (about 1-2 minutes, ~300 MB RAM)

Writes results.json next to the other scratch files of this label and prints a readable log.
Seeded: the numbers repeat exactly.
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
from scipy.optimize import brentq

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True

import pocmodel as P          # noqa: E402
import priors as PR           # noqa: E402
import designs as DS          # noqa: E402

OUT_DIR = r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-poc-designs"
RES = {}
SEED = 20261112


def section(title):
    print("\n" + "=" * 100 + "\n" + title + "\n" + "=" * 100)


# ---------------------------------------------------------------------------------------------
def step0_project_ceiling():
    section("0. the project's own ceiling check, run unchanged (read only)")
    r = subprocess.run([sys.executable, "-B", P.CEILING_SCRIPT], capture_output=True, text=True, timeout=900)
    last = [ln for ln in r.stdout.splitlines() if ln.startswith("VERDICT") or ln.startswith("(1)") or ln.startswith("(3)")]
    for ln in last:
        print(ln)
    RES["ceiling_script_verdict"] = last
    assert "holds in every check" in r.stdout


def step1_solver_checks():
    section("1. my layered-beam solver reproduces f(m,n); symmetry; plate theory; diffusion constants")
    rows = []
    for (m, n) in [(1, 1), (0.5, 3), (1, 0.1), (0.316, 10), (2, 5), (0.75, 1.78), (0.45, 5)]:
        h2, h1, E2, E1 = 1.0, m, 1.0, n
        k = P.kappa_uniform([(h1, E1), (h2, E2)], [0.0, 0.01])
        solver = k * (h1 + h2) / 0.01
        rows.append(dict(m=m, n=n, solver=round(solver, 9), f_project=round(P.f_tim(m, n), 9),
                         f_swapped_labels=round(P.f_tim(1 / m, 1 / n), 9)))
        assert abs(solver - P.f_tim(m, n)) < 1e-9 and abs(P.f_tim(m, n) - P.f_tim(1 / m, 1 / n)) < 1e-9
        print(rows[-1])
    RES["solver_vs_f"] = rows
    # diffusion constants (one face exposed)
    t = [brentq(lambda x, fr=fr: P.pq(x)[0][0] - fr, 1e-4, 10) for fr in (0.5, 0.9, 0.99)]
    print("one-face uptake t50,t90,t99 (units h^2/D):", [round(x, 4) for x in t])
    RES["uptake_t50_t90_t99"] = [round(x, 4) for x in t]
    kt = {}
    for n in (0.1, 1.0, 10.0):
        ha = 1.0
        hp = ha * math.sqrt(1.0 / n)            # optimum: (h_a/h_p)^2 (E_a/E_p) = 1  with E_a = 1, E_p = 1/n ... see below
        # define E_a = 1, E_p = Ep; optimum needs hp = ha * sqrt(E_a/E_p)
        Ep = n
        hp = ha * math.sqrt(1.0 / Ep)
        t90 = float(P.tau_to_fraction((ha, 1.0, hp, Ep, 0.01), 0.9)[0])
        t99 = float(P.tau_to_fraction((ha, 1.0, hp, Ep, 0.01), 0.99)[0])
        kt[f"E_p/E_a={n}"] = (round(t90, 4), round(t99, 4))
    print("curvature t90,t99 at the optimum m^2 n = 1, units h_a^2/D:", kt)
    RES["curvature_t90_t99_at_optimum"] = kt
    # plate theory: isotropic layers with equal Poisson ratio and isotropic eigenstrain -> kappa_plate = kappa_beam
    nu = 0.5
    layers = [(0.6, 1.7), (0.4, 4.0)]
    Q11 = lambda E: E / (1 - nu ** 2)
    Q12 = lambda E: nu * E / (1 - nu ** 2)
    A = sum(Q11(E) * t for t, E in layers)
    # build ABD manually for equal in-plane isotropy
    z = 0.0
    S = I = 0.0
    zs = []
    for t, E in layers:
        z0, z1 = z, z + t
        S += Q11(E) * (z1 ** 2 - z0 ** 2) / 2
        I += Q11(E) * (z1 ** 3 - z0 ** 3) / 3
        zs.append((z0, z1))
        z = z1
    A12 = sum(Q12(E) * t for t, E in layers)
    S12 = sum(Q12(E) * (b ** 2 - a ** 2) / 2 for (t, E), (a, b) in zip(layers, zs))
    I12 = sum(Q12(E) * (b ** 3 - a ** 3) / 3 for (t, E), (a, b) in zip(layers, zs))
    eig = [0.0, 0.01]
    Ne = sum((Q11(E) + Q12(E)) * e * t for (t, E), e in zip(layers, eig))     # N_x* = N_y*
    Me = sum((Q11(E) + Q12(E)) * e * (b ** 2 - a ** 2) / 2 for (t, E), (a, b), e in zip(layers, zs, eig))
    # equibiaxial state: eps_x = eps_y = e0, kappa_x = kappa_y = k
    Mat = np.array([[A + A12, S + S12], [S + S12, I + I12]])
    e0, kk = np.linalg.solve(Mat, [Ne, Me])
    beam = P.kappa_uniform([(t, E) for t, E in layers], eig)
    print(f"plate (equibiaxial, equal nu) kappa = {kk:.8f}   beam kappa = {beam:.8f}   ratio = {kk / beam:.6f}")
    RES["plate_over_beam_small_deflection_equal_nu"] = round(float(kk / beam), 8)
    assert abs(kk / beam - 1) < 1e-9


def step2_formlabs_inversion():
    section("2. what Formlabs' own water data say about D and equilibrium strain (two-point Fickian inversion, both faces open)")

    def P_slab(x):          # fractional uptake of a slab, x = D t / l^2 (l = full thickness, both faces)
        k = np.arange(0, 400)
        return 1 - np.sum(8 / ((2 * k + 1) ** 2 * math.pi ** 2) * np.exp(-((2 * k + 1) ** 2) * math.pi ** 2 * x))

    out = {}
    for label, v1, v7 in (("mass +8 -> +9 %", 8.0, 9.0),
                          ("volume-derived linear strain 0.99 -> 2.28 %", 100 * DER_LIN1(), 100 * DER_LIN7())):
        r = v7 / v1
        f = lambda x: P_slab(7 * x) / P_slab(x) - r
        x1 = brentq(f, 1e-5, 5.0)
        row = dict(x_1day=round(x1, 4), uptake_fraction_1d=round(P_slab(x1), 3), uptake_fraction_1wk=round(P_slab(7 * x1), 3),
                   M_inf=round(v1 / P_slab(x1), 3))
        for l in (1.0, 2.0, 3.2):
            row[f"D_m2s_if_slab_{l}mm"] = float(x1 * (l * 1e-3) ** 2 / 86400.0)
        out[label] = row
        print(label, row)
    RES["formlabs_80A_V2_inversion"] = out
    print("=> mass and volume data imply D differing by a factor",
          round(out["mass +8 -> +9 %"]["D_m2s_if_slab_2.0mm"] / out["volume-derived linear strain 0.99 -> 2.28 %"]["D_m2s_if_slab_2.0mm"], 1),
          "for the same (unstated) slab thickness; prior range D = 1e-12 .. 1.1e-11 m2/s spans both.")


def DER_LIN1():
    return PR.DER["eps_lin_1d_from_vol"]


def DER_LIN7():
    return PR.DER["eps_lin_1wk_from_vol"]


def step3_inputs():
    section("3. derived inputs (all from printed Formlabs values; arithmetic in priors.derive_inputs)")
    for k, v in PR.DER.items():
        print(f"  {k:28s} {v:.5g}")
    RES["derived_inputs"] = {k: float(v) for k, v in PR.DER.items()}


def step4_pairs_table():
    section("4. which partner resin can reach the 3/2 ceiling at a printable thickness?  (nominal moduli, own estimates)")
    # E in MPa: active water/solvent swellers and passives. Rigid/Tough from the TDS post-cured tensile modulus.
    pairs = [
        ("Flexible 80A V2 wet (3.0) + Flexible 50A (1.7)", 3.0, 1.7),
        ("Flexible 80A V2 wet (3.0) + Silicone 40A (1.0)", 3.0, 1.0),
        ("Flexible 80A V2 wet (3.0) + Tough 1000 (932)", 3.0, 932.0),
        ("Flexible 80A V2 wet (3.0) + Grey V5 (2500)", 3.0, 2500.0),
        ("Flexible 80A V2 wet (3.0) + Rigid 10K (10000)", 3.0, 10000.0),
        ("Flexible 50A (1.7, IPA active) + Rigid 10K (10000)", 1.7, 10000.0),
        ("Flexible 50A (1.7, IPA active) + Silicone 40A (1.0)", 1.7, 1.0),
    ]
    rows = []
    for name, Ea, Ep in pairs:
        # total thickness h = 1.0 mm
        n = Ep / Ea                                  # passive over active
        # best active thickness (stiff passive thinner): optimum h_a/h_p = sqrt(Ep/Ea) ... (h_a/h_p)^2 (E_a/E_p) = 1
        r_opt = math.sqrt(Ep / Ea)
        h_a_opt = r_opt / (1 + r_opt)
        h_p_opt = 1 - h_a_opt
        # best achievable with every layer >= 0.2 mm (Form 4 wall) and 0.1 mm layers
        best = (0, None)
        for ha10 in range(2, 9):
            ha = ha10 / 10
            hp = round(1 - ha, 2)
            if hp < 0.2:
                continue
            k = P.kappa_uniform([(hp, Ep), (ha, Ea)], [0.0, 0.01]) * 1.0 / 0.01
            if k > best[0]:
                best = (k, ha)
        rows.append(dict(pair=name, Ep_over_Ea=round(n, 3), h_active_at_optimum_mm=round(h_a_opt, 4), h_passive_at_optimum_mm=round(h_p_opt, 4),
                         best_f_with_layers_ge_0_2mm=round(best[0], 3), at_h_active_mm=best[1],
                         pct_of_ceiling=round(100 * best[0] / 1.5, 1)))
        print(rows[-1])
    RES["partner_table_h1mm"] = rows


def step5_ipa_hazard():
    section("5. the IPA wash: Flexible 80A V2 vs Silicone 40A, finite-strain flag")
    lin80 = 2.13 ** (1 / 3) - 1                      # +113 % volume in IPA after 1 day (TDS)
    # silicone: +5.9 % mass in 24 h in IPA (solvent table); volume by ideal mixing, silicone density ASSUMED 1.1 g/cm3, IPA 0.785 (unverified background)
    vol_sil = 0.059 * 1.1 / 0.785
    lin_sil = (1 + vol_sil) ** (1 / 3) - 1
    de_h = math.log(1 + lin80) - math.log(1 + lin_sil)
    R = 1.0 / (1.5 * de_h) * 1.0
    print(f"linear strain Flexible 80A V2 in IPA at 1 day: {100 * lin80:.1f} %  (from +113 % volume);  Silicone 40A (ideal-mixing estimate): {100 * lin_sil:.1f} %")
    print(f"small-strain law would give kappa h = 1.5 * {de_h:.3f} -> R = {R:.2f} x h  (a 1 mm strip curls to R of about {R:.1f} mm); the law is outside its small-strain domain here, "
          "so this is a hazard warning, not a prediction")
    RES["ipa_hazard"] = dict(lin_80A=lin80, lin_sil=lin_sil, hencky_diff=de_h, R_over_h=R)


def step6_fuse_negative():
    section("6. Fuse 1+ nylon bilayer as a negative control (strain from the vendor/literature bracket; not a measurement)")
    rows = []
    for h in (0.8, 1.6):
        for de in (0.001, 0.002):
            R = h / (1.5 * de)
            for D in (3e-13, 1.4e-12):
                ha = h / 2
                t90_d = 0.719 * (ha * 1e-3) ** 2 / D / 86400
                rows.append(dict(h_mm=h, d_eps_pct=100 * de, R_mm=round(R), D_m2s=D, t90_days=round(t90_d, 1)))
    for r in rows:
        print(r)
    RES["fuse_nylon_negative_control"] = rows


def step7_camera_noise(rng):
    section("7. what a photograph can resolve: circle-fit noise on a cantilever silhouette")
    out = []
    for L in (30.0,):
        for k in (1 / 100.0, 1 / 50.0, 1 / 30.0, 1 / 20.0):
            rel = []
            for _ in range(400):
                th = np.linspace(0, L * k, 300)
                x = np.sin(th) / k + rng.normal(0, 0.03, th.size)       # 0.03 mm edge noise (about half of a 0.05 mm pixel)
                y = (1 - np.cos(th)) / k + rng.normal(0, 0.03, th.size)
                Amat = np.c_[2 * x, 2 * y, np.ones_like(x)]
                b = x ** 2 + y ** 2
                c = np.linalg.lstsq(Amat, b, rcond=None)[0]
                R = math.sqrt(c[2] + c[0] ** 2 + c[1] ** 2)
                rel.append(1 / R / k - 1)
            out.append(dict(L_mm=L, R_true_mm=round(1 / k, 1), tip_angle_deg=round(math.degrees(L * k), 1),
                            rel_sd_kappa_pct=round(100 * float(np.std(rel)), 2), rel_bias_pct=round(100 * float(np.mean(rel)), 2)))
            print(out[-1])
    RES["camera_circle_fit"] = out


def step8_designs():
    rng = np.random.default_rng(SEED)
    section("8. object 1 : single strip, 30 x 3 x 1.0 mm (0.4 mm Flexible 80A V2 on 0.6 mm passive)")
    RES["object1"] = DS.object1(rng)
    print(json.dumps(RES["object1"], indent=1)[:6000])
    section("9. object 2 : strip array (comb with ratio ladder and thickness ladder)")
    RES["object2"] = DS.object2(rng)
    for k, v in RES["object2"].items():
        if "ladder" in k and isinstance(v, list):
            print(k)
            for r in v:
                print("  ", r)
        else:
            print(k, v)
    section("10. object 3 : self-curling tile / width ladder")
    RES["object3"] = DS.object3(rng)
    print(json.dumps(RES["object3"], indent=1)[:5000])
    section("11. object 4 : three-generation hierarchical element")
    RES["object4"] = DS.object4(rng)
    print(json.dumps(RES["object4"], indent=1)[:6000])
    section("12. object 5 : louver module and scale-up")
    RES["object5"] = DS.object5(rng)
    print(json.dumps(RES["object5"], indent=1)[:6000])


def main():
    step0_project_ceiling()
    step1_solver_checks()
    step2_formlabs_inversion()
    step3_inputs()
    step4_pairs_table()
    step5_ipa_hazard()
    step6_fuse_negative()
    step7_camera_noise(np.random.default_rng(SEED + 1))
    step8_designs()
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "results.json"), "w", encoding="utf-8") as fh:
        json.dump(RES, fh, indent=1, default=float)
    print("\nwrote", os.path.join(OUT_DIR, "results.json"))


if __name__ == "__main__":
    main()
