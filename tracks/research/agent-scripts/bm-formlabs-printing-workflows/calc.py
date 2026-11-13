"""Own calculations for bm-formlabs-printing-workflows. Run: python calc.py  (pure stdlib; prints everything and writes calc_out.json next to scratch).
Inputs are labelled with their source. Estimates are flagged EST."""
import json, math
out = {}

# ---- A. Timoshenko factor (project record) --------------------------------
def f(m, n):
    return 6*(1+m)**2 / (3*(1+m)**2 + (1+m*n)*(m**2 + 1/(m*n)))
# m = h1/h2, n = E1/E2 ; curvature kappa = f * d_eps / h  (d_eps = differential free strain, h = total)
chk = {}
for n in (1, 3.2, 160, 1724):
    m = n**-0.5
    chk[n] = round(f(m, n), 12)
out["ceiling_check_f_at_m=n^-1/2"] = chk   # must all be 1.5

# ---- B. Candidate pairs for h = 1.0 mm total ------------------------------
# Moduli: Rigid 10K 10,000 MPa (spec-formlabs-materials.json, TDS 10-11 GPa); Tough 1000 932 MPa (Formlabs product page);
# Flexible 80A V2 secant 5.8 MPa = 2.9 MPa / 0.5 strain (EST, project file spec-formlabs-materials.json; not a published modulus);
# Flexible 50A secant 1.8 MPa = 0.9/0.5 (EST); Silicone 40A secant 0.8 MPa = 0.4/0.5 (EST).
E = {"Rigid10K": 10000., "Tough1000": 932., "Flex80AV2": 5.8, "Flex50A": 1.8, "Silicone40A": 0.8}
pairs = [("Flex80AV2", "Flex50A"), ("Flex80AV2", "Tough1000"), ("Flex80AV2", "Rigid10K"), ("Flex80AV2", "Silicone40A")]
h = 1.0  # mm
res = []
for act, pas in pairs:
    n = E[pas] / E[act]            # passive/active modulus ratio (layer1 = passive)
    m_opt = n**-0.5                # passive/active thickness ratio at ceiling
    h_pas_opt = h * m_opt/(1+m_opt)
    row = {"active": act, "passive": pas, "n=Ep/Ea": round(n, 2), "m_opt=hp/ha": round(m_opt, 4), "h_passive_at_ceiling_mm": round(h_pas_opt, 4)}
    for hp in (0.2, 0.3, 0.4, 0.5):
        m = hp/(h-hp)
        row[f"f(hp={hp})"] = round(f(m, n), 3)
    res.append(row)
out["pairs_h1mm"] = res

# ---- C. Curvature and tip deflection for a 40 mm strip --------------------
L = 40.0  # mm
def tip(kappa_per_m):
    k = kappa_per_m/1000.0   # 1/mm
    th = k*L
    return (1-math.cos(th))/k if k > 0 else 0, th
# d_eps from Flexible 80A V2 TDS (ASTM D471, Formlabs/reseller PDF): +3 % volume 1 day, +7 % 1 week in DI water, isotropy ASSUMED
for label, dV in (("1 day", 0.03), ("1 week", 0.07)):
    de = (1+dV)**(1/3)-1
    rows = []
    for ff, name in ((1.5, "ceiling 1.5"), (1.0, "f=1.0"), (0.5, "f=0.5")):
        kap = ff*de/(h/1000)    # 1/m
        y, th = tip(kap)
        rows.append({"f": name, "kappa_1/m": round(kap, 2), "R_mm": round(1000/kap, 1), "tip_mm": round(y, 2), "turn_deg": round(math.degrees(th), 1)})
    out[f"curvature_h1mm_water_{label}"] = {"d_eps_linear_%": round(de*100, 3), "rows": rows}

# ---- D. Residual print curl vs the signal ---------------------------------
# a strip that sags s mm at its tip over L=40 mm has kappa = 2 s / L^2
for s in (0.25, 0.5, 1.0, 2.0):
    out.setdefault("residual_curl_from_tip_sag", {})[f"{s} mm"] = round(2*s/(L**2)*1000, 2)  # 1/m
# signal at ceiling for h=1 mm: kappa = 1.5*d_eps/h
for de in (0.002, 0.005, 0.01):
    out.setdefault("signal_ceiling_h1mm", {})[f"d_eps={de}"] = round(1.5*de/(h/1000), 2)
out["note_D"] = "residual curl of 1 mm tip sag (1.25 1/m) equals the ceiling signal of d_eps = 0.083 % at h = 1 mm"
out["eq_deps_for_1mm_sag_%"] = round(1.25*(h/1000)/1.5*100, 3)

# ---- E. Z-compression on thin strips (Formlabs: on-platform parts ~0.1 mm shorter) ----------
for t in (0.2, 0.4, 0.5, 0.8, 1.0):
    out.setdefault("z_compression_error_%", {})[f"t={t} mm"] = round(0.1/t*100, 1)

# ---- F. Diffusion-time scaling for solvent uptake (EST) ----------------------
# Fick: time to reach a given fractional uptake scales with (half-thickness)^2 (D constant, surface equilibrium instant).
cube_half = 5.0   # mm, 1 cm cube (Formlabs solvent-compatibility page: 'originally measuring 1 cm x 1 cm x 1 cm')
cube_time_min = 24*60
for t in (0.2, 0.4, 0.5, 1.0):
    half = t/2
    ratio = (half/cube_half)**2
    out.setdefault("thin_strip_equivalent_time_to_cube_24h_min", {})[f"t={t} mm"] = round(cube_time_min*ratio, 2)
for wash_min, name in ((20, "Flexible 50A wash (support table: 20 min)"), (10, "Flexible 80A V2 TDS wash 10 min"), (5+5, "Flex 80A V2 support table 5+5")):
    for t in (0.4, 1.0):
        half = t/2; ratio = (half/cube_half)**2
        out.setdefault("wash_equivalent_cube_hours", {})[f"{name}, strip t={t} mm"] = round(wash_min/ratio/60, 1)

# ---- G. TDS consistency check Flexible 80A V2 (ASTM D471 slab rows) -------
rho_res, rho_w, rho_ipa = 1.04, 1.00, 0.785   # resin density from TDS (1.04 g/mL liquid); IPA density = unverified background
chk2 = {}
for name, dm, rho, dV_rep in (("DI water 1 day", 0.08, rho_w, 0.03), ("DI water 1 week", 0.09, rho_w, 0.07), ("IPA 1 day", 0.45, rho_ipa, 1.13), ("IPA 1 week", 0.48, rho_ipa, 1.19)):
    dV_add = dm*rho_res/rho
    chk2[name] = {"reported_dm": dm, "reported_dV": dV_rep, "dV_if_volumes_additive": round(dV_add, 3)}
out["tds_mass_vs_volume_additivity"] = chk2

# ---- H. Layer counts ------------------------------------------------------
for lh in (0.1, 0.05):
    out.setdefault("layers_per_thickness", {})[f"layer={lh} mm"] = {str(t): round(t/lh, 1) for t in (0.2, 0.4, 0.5, 0.8, 1.0)}

print(json.dumps(out, indent=1))
json.dump(out, open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-printing-workflows/calc_out.json", "w"), indent=1)

# ---- I. Sensitivity of f to passive-layer thickness error (Tough 1000 passive / Flexible 80A V2 active, h fixed 1.0 mm) ----
n_t = E["Tough1000"]/E["Flex80AV2"]
sens = {f"hp={hp}": round(f(hp/(h-hp), n_t), 3) for hp in (0.05, 0.1, 0.15, 0.2, 0.25, 0.3)}
out["sensitivity_f_Tough1000_passive_h1mm"] = sens
print("sensitivity (Tough1000 passive / Flex80AV2 active, h=1.0 mm):", sens)
json.dump(out, open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-printing-workflows/calc_out.json", "w"), indent=1)
