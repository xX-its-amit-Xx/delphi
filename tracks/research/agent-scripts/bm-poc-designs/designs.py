"""Monte Carlo predictions for the five proof-of-concept objects. Imported by run_all.py."""
import math

import numpy as np

import pocmodel as P
import priors as PR

HOUR = 3600.0
TAU_GRID = np.logspace(-4, 1.3, 260)


# ---------------------------------------------------------------------------------------------
# core Monte Carlo kernel
# ---------------------------------------------------------------------------------------------
def simulate(s, pair, t_act, t_pas, L, w=None, times_h=(24, 72, 168), E_bond="passive"):
    """s: dict of joint input samples (priors.draw). Layers bottom to top: passive, bond, active.
    Returns dict of per-sample arrays."""
    ta = np.clip(t_act + s["dt_a"], 0.05, None)
    tp = np.clip(t_pas + s["dt_p"], 0.05, None)
    tb = s["t_b"]
    Ea, Ep = s["E_a"], s["E_p"]
    h = ta + tp + tb
    N = ta.size
    curve = P.kappa_time(ta, Ea, tp, Ep, s["eps_a"], TAU_GRID, t_bond=tb, E_bond=Ep, eps_pas=s["eps_p"])  # [N, G]
    k_inf = curve[:, -1]
    # differential free strain between the active layer and the passive stack (passive + bond; bond strain 0, same modulus)
    d_eps = s["eps_a"] - s["eps_p"] * tp / (tp + tb)
    f_eff = k_inf * h / d_eps
    out = dict(h=h, ta=ta, tp=tp, kappa_inf=k_inf, R_inf=1.0 / k_inf, f_eff=f_eff, d_eps=d_eps,
               m2n=(ta / (tp + tb)) ** 2 * (Ea / Ep))
    # time to 90 % of final curvature (hours)
    ratio = curve / k_inf[:, None]
    # settling time: first time after which the curvature stays within 10 % of its final value (equals the 90 % time when
    # the curve rises monotonically; off-optimum stacks can overshoot, which a plain 90 % crossing would miss)
    bad = np.abs(ratio - 1.0) > 0.10
    idx_last_bad = np.where(bad.any(axis=1), TAU_GRID.size - 1 - np.argmax(bad[:, ::-1], axis=1), -1)
    nxt = np.clip(idx_last_bad + 1, 0, TAU_GRID.size - 1)
    tau90 = np.where(idx_last_bad < 0, TAU_GRID[0], TAU_GRID[nxt])
    out["t90_h"] = tau90 * ta ** 2 / s["D"] / HOUR
    out["overshoot_max_ratio"] = ratio.max(axis=1)
    # curvature at the stated times
    for th in times_h:
        tau = s["D"] * th * HOUR / ta ** 2
        kt = np.array([np.interp(x, TAU_GRID, c) for x, c in zip(tau, curve)])
        out[f"kappa_{th}h"] = kt
    # tip geometry for a cantilever of length L
    defl, adv, ang = P.tip(L, k_inf)
    out["tip_defl_inf"] = defl
    out["tip_angle_deg_inf"] = np.degrees(ang)
    for th in times_h:
        d, _, a = P.tip(L, out[f"kappa_{th}h"])
        out[f"tip_defl_{th}h"] = d
        out[f"tip_angle_deg_{th}h"] = np.degrees(a)
    # self-weight sag (first order): in air and submerged in water
    layers = [(tp, Ep), (tb, Ep), (ta, Ea)]
    Dflex = P.flexural_rigidity(layers)
    rho = (RHO_A * ta + s["rho_p"] * (tp + tb)) / h
    out["E_eq_MPa"] = 12.0 * Dflex / h ** 3                # modulus of a homogeneous beam with the same bending stiffness
    out["sag_air_mm"] = P.self_weight_sag(L, h, Dflex, rho)
    out["sag_water_mm"] = P.self_weight_sag(L, h, Dflex, np.clip(rho - 998.0, 0.0, None))
    if w is not None:
        out["Omega"] = k_inf * w ** 2 / h                 # strip-validity parameter w^2 kappa / h
    return out


RHO_A = PR.RHO_ACTIVE


def summarize(out, keys=None, q=(5, 50, 95)):
    keys = keys or out.keys()
    return {k: PR.pct(out[k], q) for k in keys}


def fmt(v, nd=3):
    return [round(x, nd) for x in v]


# ---------------------------------------------------------------------------------------------
# object 1 : single strip, plus the free-coupon calibration step and what the calibration buys
# ---------------------------------------------------------------------------------------------
def object1(rng, N=6000):
    res = {}
    for pair in ("A", "B"):
        s = PR.draw(rng, N, pair)
        o = simulate(s, pair, t_act=0.4, t_pas=0.6, L=30.0, w=3.0, times_h=(24, 72, 168))
        res[pair] = dict(
            kappa_inf_per_mm=fmt(PR.pct(o["kappa_inf"]), 5),
            R_inf_mm=fmt(PR.pct(o["R_inf"]), 1),
            f_eff=fmt(PR.pct(o["f_eff"]), 3),
            m2n=fmt(PR.pct(o["m2n"]), 3),
            tip_defl_inf_mm=fmt(PR.pct(o["tip_defl_inf"]), 2),
            tip_angle_deg_inf=fmt(PR.pct(o["tip_angle_deg_inf"]), 1),
            t90_h=fmt(PR.pct(o["t90_h"]), 1),
            R_1d_mm=fmt(PR.pct(1.0 / o["kappa_24h"]), 1),
            R_3d_mm=fmt(PR.pct(1.0 / o["kappa_72h"]), 1),
            R_7d_mm=fmt(PR.pct(1.0 / o["kappa_168h"]), 1),
            tip_defl_1d_mm=fmt(PR.pct(o["tip_defl_24h"]), 2),
            tip_defl_3d_mm=fmt(PR.pct(o["tip_defl_72h"]), 2),
            tip_defl_7d_mm=fmt(PR.pct(o["tip_defl_168h"]), 2),
            sag_air_mm=fmt(PR.pct(o["sag_air_mm"]), 1),
            sag_water_mm=fmt(PR.pct(o["sag_water_mm"]), 2),
            Omega=fmt(PR.pct(o["Omega"]), 3),
            frac_samples_over_ceiling=float(np.mean(o["f_eff"] > 1.5 + 1e-9)),
        )
        # sensitivity: rank correlation of each input with log kappa_inf
        keys = ["eps_a", "eps_p", "E_a", "E_p", "dt_a", "dt_p", "t_b"]
        sens = {}
        lk = np.log(o["kappa_inf"])
        rk = lk.argsort().argsort().astype(float)
        for k in keys:
            rx = s[k].argsort().argsort().astype(float)
            sens[k] = round(float(np.corrcoef(rx, rk)[0, 1]) ** 2, 3)  # squared Spearman (rough share of variance)
        res[pair]["sensitivity_sq_spearman"] = sens

        # what calibration buys: predictor sees coupon-measured strains, calliper layer thicknesses (+-0.02 mm),
        # bond line measured to +-0.01 mm, but only the CENTRAL modulus ratio (moduli are not measured)
        # coupon strains come from length changes of 30 mm coupons read to +-0.02 mm  ->  sigma = 0.02/30 = 0.00067 absolute per coupon
        eps_a_m = s["eps_a"] + rng.normal(0, 0.02 / 30.0, N)
        eps_p_m = s["eps_p"] + rng.normal(0, 0.02 / 30.0, N)
        ta_m = np.clip(0.4 + s["dt_a"] + rng.normal(0, 0.02, N), 0.05, None)
        tp_m = np.clip(0.6 + s["dt_p"] + rng.normal(0, 0.02, N), 0.05, None)
        tb_m = np.clip(s["t_b"] + rng.normal(0, 0.01, N), 0.0, None)
        Ea_c = math.exp(np.mean(np.log(s["E_a"])))
        Ep_c = math.exp(np.mean(np.log(s["E_p"])))
        k_pred = P.kappa_uniform([(tp_m, Ep_c), (tb_m, Ep_c), (ta_m, Ea_c)], [eps_p_m, 0 * tp_m, eps_a_m])
        ratio = k_pred / o["kappa_inf"]
        res[pair]["calibrated_pred_over_true"] = dict(
            p0_5_2_5_50_97_5_99_5=fmt(PR.pct(ratio, (0.5, 2.5, 50, 97.5, 99.5)), 3),
            note="ratio of the calibrated prediction to the simulated true curvature; excludes camera error and any physics outside the law")
    return res


# ---------------------------------------------------------------------------------------------
# object 2 : strip array (ratio ladder + thickness ladder)
# ---------------------------------------------------------------------------------------------
def object2(rng, N=4000):
    res = {}
    ladder = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    hladder = [(0.2, 0.3), (0.4, 0.6), (0.6, 0.9), (0.8, 1.2)]
    for pair in ("A", "B"):
        s = PR.draw(rng, N, pair)
        rows = []
        fs = {}
        for ta in ladder:
            o = simulate(s, pair, ta, 1.0 - ta, L=30.0, w=3.0, times_h=(72, 168))
            fs[ta] = o["f_eff"]
            rows.append(dict(t_act=ta, t_pas=round(1.0 - ta, 2),
                             f_eff=fmt(PR.pct(o["f_eff"]), 3),
                             R_inf_mm=fmt(PR.pct(o["R_inf"]), 1),
                             t90_h=fmt(PR.pct(o["t90_h"]), 1),
                             overshoot_max_ratio=fmt(PR.pct(o["overshoot_max_ratio"]), 3),
                             R_3d_mm=fmt(PR.pct(1 / o["kappa_72h"]), 1),
                             tip_defl_inf_mm=fmt(PR.pct(o["tip_defl_inf"]), 2),
                             m_over_opt=fmt(PR.pct(o["m2n"] ** 0.5), 3)))
        res[f"{pair}_ratio_ladder_h1.0"] = rows
        res[f"{pair}_ladder_shape_ratios"] = {
            "f(0.8)/f(0.4)": fmt(PR.pct(fs[0.8] / fs[0.4]), 3),
            "f(0.2)/f(0.4)": fmt(PR.pct(fs[0.2] / fs[0.4]), 3),
            "f(0.3)/f(0.4)": fmt(PR.pct(fs[0.3] / fs[0.4]), 3),
            "f(0.5)/f(0.4)": fmt(PR.pct(fs[0.5] / fs[0.4]), 3)}
        # which rung wins (argmax of f_eff across rungs), per sample, on a fine continuous scan of active thickness
        scan = np.arange(0.10, 0.901, 0.01)
        F = np.empty((N, scan.size))
        for j, ta in enumerate(scan):
            ta_s = np.full(N, ta)
            tb = s["t_b"]
            # fixed total thickness 1.0 incl. bond: passive = 1.0 - ta - bond
            tp = np.clip(1.0 - ta - tb, 0.05, None)
            k = P.kappa_uniform([(tp, s["E_p"]), (tb, s["E_p"]), (ta_s, s["E_a"])],
                                [s["eps_p"], 0 * tp, s["eps_a"]])
            F[:, j] = k * (ta + tp + tb) / (s["eps_a"] - s["eps_p"] * tp / (tp + tb))
        peak = scan[F.argmax(axis=1)]
        res[f"{pair}_peak_active_thickness_mm"] = dict(p5_50_95=fmt(PR.pct(peak), 3),
                                                       max_f_p5_50_95=fmt(PR.pct(F.max(axis=1)), 3))
        wins = {f"{r:.1f}": float(np.mean(np.abs(peak - r) < 0.05)) for r in ladder}
        res[f"{pair}_prob_ladder_rung_is_nearest_to_peak"] = wins
        # thickness ladder at fixed ratio: kappa*h constant, time ~ h_a^2
        trows = []
        hs, ks = [], []
        for ta, tp in hladder:
            o = simulate(s, pair, ta, tp, L=30.0, w=3.0, times_h=(72, 168))
            hs.append(o["h"])
            ks.append(o["kappa_inf"])
            trows.append(dict(t_act=ta, t_pas=tp, h_total=round(ta + tp, 2),
                              kappa_h_over_deps=fmt(PR.pct(o["f_eff"]), 3),
                              R_inf_mm=fmt(PR.pct(o["R_inf"]), 1),
                              t90_h=fmt(PR.pct(o["t90_h"]), 1),
                              tip_defl_inf_mm=fmt(PR.pct(o["tip_defl_inf"]), 2),
                              Omega=fmt(PR.pct(o["Omega"]), 3)))
        res[f"{pair}_thickness_ladder"] = trows
        o_thick = simulate(s, pair, 0.8, 1.2, L=30.0, w=3.0, times_h=(168,))
        res[f"{pair}_prob_thickest_rung_t90_within_7d"] = float(np.mean(o_thick["t90_h"] <= 168))
        lh, lk = np.log(np.array(hs)).T, np.log(np.array(ks)).T          # per sample: [4] points
        slope = np.array([np.polyfit(a, b, 1)[0] for a, b in zip(lh, lk)])
        res[f"{pair}_log_kappa_vs_log_h_slope"] = dict(p5_50_95=fmt(PR.pct(slope), 3), law_ideal=-1.0)
    return res


# ---------------------------------------------------------------------------------------------
# object 3 : self-curling tile; width ladder crossing from the strip regime to the plate regime
# ---------------------------------------------------------------------------------------------
def object3(rng, N=4000, pair="A"):
    s = PR.draw(rng, N, pair)
    rows = []
    for w in (3.0, 6.0, 12.0, 24.0, 60.0):
        o = simulate(s, pair, 0.4, 0.6, L=60.0, w=w, times_h=(72, 168))
        Om = o["Omega"]
        # candidate plate corrections: 1.0 (small-deflection plate theory, derived below in run_all) .. 1.5 ((1+nu), nu = 1/2, inference)
        k_lo, k_hi = o["kappa_inf"], 1.5 * o["kappa_inf"]
        rows.append(dict(
            width_mm=w, w_over_h=round(w / 1.0, 1),
            Omega=fmt(PR.pct(Om), 2),
            prob_strip_regime_Omega_lt_0_3=float(np.mean(Om < 0.3)),
            prob_plate_regime_Omega_gt_3=float(np.mean(Om > 3.0)),
            R_if_strip_law_mm=fmt(PR.pct(1 / k_lo), 1),
            R_if_plate_x1_5_mm=fmt(PR.pct(1 / k_hi), 1),
            tube_closes_prob_strip_law=float(np.mean(60.0 * k_lo > 2 * math.pi)),
            tube_closes_prob_x1_5=float(np.mean(60.0 * k_hi > 2 * math.pi)),
            edge_rise_if_plate_x1_5_mm=fmt(PR.pct((1 - np.cos(np.minimum(30.0 * k_hi, math.pi))) / k_hi), 1),
            edge_rise_if_strip_law_mm=fmt(PR.pct((1 - np.cos(np.minimum(30.0 * k_lo, math.pi))) / k_lo), 1),  # ends of a 60 mm arc resting on its middle
        ))
    crit = {}
    for c in (0.5, 1.0, 2.0):  # unknown prefactor in w_c = c * sqrt(h/kappa)  (Armon 2011 scaling; prefactor not retrieved)
        o = simulate(s, pair, 0.4, 0.6, L=60.0, w=3.0)
        wc = c * np.sqrt(o["h"] / o["kappa_inf"])
        crit[f"c={c}"] = fmt(PR.pct(wc), 1)
    return dict(pair=pair, width_ladder=rows, w_c_mm_by_prefactor=crit)


# ---------------------------------------------------------------------------------------------
# object 4 : three-generation hierarchical element
# ---------------------------------------------------------------------------------------------
def object4(rng, N=5000, pair="A"):
    s = PR.draw(rng, N, pair)
    gens = [("trunk", 0.8, 1.2, 50.0, 3.0), ("branch", 0.4, 0.6, 25.0, 2.5), ("twig", 0.2, 0.3, 12.5, 1.5)]
    snap_h = (3, 6, 12, 24, 48, 72, 168)
    outs = []
    for name, ta, tp, L, w in gens:
        # a thickness error is a property of the print, so it is drawn independently for each generation
        s_g = dict(s)
        s_g["dt_a"] = rng.uniform(-0.05, 0.05, N) if name == "twig" else rng.uniform(-0.08, 0.08, N)
        s_g["dt_p"] = rng.uniform(-0.08, 0.08, N)
        s_g["t_b"] = np.clip(s["t_b"] * (0.6 if name == "twig" else 1.0), 0.02, None)
        o = simulate(s_g, pair, ta, tp, L=L, w=w, times_h=snap_h)
        outs.append((name, ta, tp, L, w, o))
    res = {"generations": []}
    for name, ta, tp, L, w, o in outs:
        res["generations"].append(dict(
            name=name, t_act=ta, t_pas=tp, h_total=round(ta + tp, 2), length_mm=L, width_mm=w,
            f_eff=fmt(PR.pct(o["f_eff"]), 3),
            R_inf_mm=fmt(PR.pct(o["R_inf"]), 1),
            turning_angle_deg_inf=fmt(PR.pct(o["tip_angle_deg_inf"]), 1),
            t90_h=fmt(PR.pct(o["t90_h"]), 2),
            Omega=fmt(PR.pct(o["Omega"]), 3)))
    t = [o["t90_h"] for *_, o in outs]
    res["t90_ratio_trunk_over_twig"] = fmt(PR.pct(t[0] / t[2]), 1)
    res["t90_ratio_trunk_over_branch"] = fmt(PR.pct(t[0] / t[1]), 1)
    res["t90_ratio_branch_over_twig"] = fmt(PR.pct(t[1] / t[2]), 1)
    ha_tr, ha_tw = outs[0][5]["ta"], outs[2][5]["ta"]
    slope = np.log(t[0] / t[2]) / np.log(ha_tr / ha_tw)
    res["log_t90_vs_log_h_active_slope"] = dict(p5_50_95=fmt(PR.pct(slope), 2), fickian=2.0, case_II=1.0)
    res["prob_t90_within_7d"] = {nm: float(np.mean(o["t90_h"] <= 168)) for nm, *_, o in outs}
    res["ideal_fickian_ratio_trunk_over_twig"] = 16.0
    res["case_II_ratio_trunk_over_twig"] = 4.0
    # chained shape: all three arcs curl the same way in one plane; tip position and snapshot of turning angles
    snaps = []
    for th in snap_h:
        angs = [o[f"tip_angle_deg_{th}h"] for *_, o in outs]
        snaps.append(dict(t_h=th, trunk_deg=fmt(PR.pct(angs[0]), 1), branch_deg=fmt(PR.pct(angs[1]), 1),
                          twig_deg=fmt(PR.pct(angs[2]), 1)))
    res["turning_angle_snapshots"] = snaps
    # final planar chain end point (x along trunk axis, y normal)
    x = np.zeros(N)
    y = np.zeros(N)
    phi = np.zeros(N)
    for name, ta, tp, L, w, o in outs:
        k = o["kappa_inf"]
        th = L * k
        x = x + (np.sin(phi + th) - np.sin(phi)) / k
        y = y - (np.cos(phi + th) - np.cos(phi)) / k
        phi = phi + th
    res["chain_tip_xy_mm_inf"] = dict(x=fmt(PR.pct(x), 1), y=fmt(PR.pct(y), 1))
    res["chain_total_turn_deg_inf"] = fmt(PR.pct(np.degrees(phi)), 1)
    res["prob_total_turn_over_360deg_self_contact"] = float(np.mean(np.degrees(phi) > 360))
    res["prob_total_turn_over_180deg"] = float(np.mean(np.degrees(phi) > 180))
    return res


# ---------------------------------------------------------------------------------------------
# object 5 : scaled facade-louver module and the scale-up law
# ---------------------------------------------------------------------------------------------
def object5(rng, N=5000, pair="A"):
    s = PR.draw(rng, N, pair)
    days = (1, 3, 7, 14, 21, 42)
    times_h = tuple(24 * d for d in days)
    o = simulate(s, pair, 1.2, 1.8, L=120.0, w=9.0, times_h=times_h)
    res = dict(
        geometry="3 blades, each 120 x 9 x 3.0 mm (1.2 mm Flexible 80A V2 on 1.8 mm passive), pitch 20 mm, in a Nylon 12 frame",
        h_total_mm=fmt(PR.pct(o["h"]), 3),
        f_eff=fmt(PR.pct(o["f_eff"]), 3),
        R_inf_mm=fmt(PR.pct(o["R_inf"]), 1),
        tip_angle_deg_inf=fmt(PR.pct(o["tip_angle_deg_inf"]), 1),
        tip_defl_inf_mm=fmt(PR.pct(o["tip_defl_inf"]), 1),
        t90_days=fmt(PR.pct(o["t90_h"] / 24), 2),
        Omega=fmt(PR.pct(o["Omega"]), 3),
        sag_air_mm=fmt(PR.pct(o["sag_air_mm"]), 1),
        sag_water_mm=fmt(PR.pct(o["sag_water_mm"]), 2),
        prob_t90_within_7d=float(np.mean(o["t90_h"] <= 168)),
        prob_t90_within_14d=float(np.mean(o["t90_h"] <= 336)),
        angle_by_day={str(d): fmt(PR.pct(o[f"tip_angle_deg_{24 * d}h"]), 1) for d in days},
    )
    # air (humidity) scenario: strain is a fraction s of the immersion strain; fraction unknown, bracketed 0.1 .. 1
    res["air_scenario_angle_deg_inf"] = {f"s={fr}": fmt(PR.pct(o["tip_angle_deg_inf"] * fr), 1) for fr in (0.1, 0.3, 1.0)}
    # scale-up at constant tip angle: theta = f * d_eps * L / h  => h proportional to L; time ~ h_a^2 / D
    scale = []
    for Lfull in (120.0, 300.0, 600.0, 1000.0):
        k = Lfull / 120.0
        ta, tp = 1.2 * k, 1.8 * k
        oo = simulate(s, pair, ta, tp, L=Lfull, w=9.0 * k, times_h=(168,))
        gr = oo["sag_air_mm"] / oo["tip_defl_inf"]
        scale.append(dict(L_mm=Lfull, h_total_mm=round(3.0 * k, 1), t_act_mm=round(ta, 1),
                          sag_over_tip_deflection_horizontal=fmt(PR.pct(gr), 2),
                          E_eq_now_MPa=fmt(PR.pct(oo["E_eq_MPa"]), 2),
                          E_eq_needed_for_sag_le_10pct_MPa=fmt(PR.pct(oo["E_eq_MPa"] * gr / 0.1), 1),
                          tip_angle_deg_inf=fmt(PR.pct(oo["tip_angle_deg_inf"]), 1),
                          t90_days=fmt(PR.pct(oo["t90_h"] / 24), 1)))
    res["scale_up_constant_angle"] = scale
    # diffusivity the NEW material needs: t90_curvature = 0.719 h_a^2 / D at the optimum (checked in run_all)
    need = []
    for ha in (0.4, 1.2, 2.0, 5.0, 10.0):
        for tt_h in (1.0, 24.0):
            need.append(dict(h_active_mm=ha, target_t90_h=tt_h, D_needed_m2s=0.719 * (ha * 1e-3) ** 2 / (tt_h * HOUR)))
    res["diffusivity_needed"] = need
    return res
