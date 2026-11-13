"""All own calculations for bm-4d-printing. Run: python -I calc.py  (prints; writes scratch/calc_out.json)
Inputs are copied from fetched sources (cited inline)."""
import json, math, itertools
out = {}

# 1. Timoshenko coefficient f(m,n) and its ceiling (project record: exactly 3/2 at m^2 n = 1)
def f(m, n): return 6*(1+m)**2 / (3*(1+m)**2 + (1+m*n)*(m**2 + 1/(m*n)))
mx = 0; arg = None
for lm in [x/50 for x in range(-200, 201)]:
    for ln in [x/50 for x in range(-200, 201)]:
        m, n = 10**lm, 10**ln
        v = f(m, n)
        if v > mx: mx, arg = v, (m, n)
out["grid_max_f"] = mx; out["grid_argmax"] = arg
out["f_at_m2n1_samples"] = {f"m={m}": f(m, 1/m**2) for m in (0.2, 0.5, 1, 2, 5)}
out["swap_symmetry"] = {"f(2,0.4)": f(2, .4), "f(0.5,2.5)": f(.5, 2.5)}   # layer swap: (m,n)->(1/m,1/n)

# 2. GelMA vat-photopolymerised bilayer (Guida 2026, Gels 12:382, PMC13205297, table: swollen E and linear swelling LS)
E = {30: 14.48, 40: 15.30, 60: 18.64, 70: 20.23}          # kPa swollen
LS = {30: 7.83, 40: 7.11, 60: 2.02, 70: 0.70}              # % linear swelling after 24 h
E35 = (E[30]+E[40])/2; E65 = (E[60]+E[70])/2               # authors model 35 s as mean(30,40); 65 s assumed mean(60,70) (my assumption)
LS35 = (LS[30]+LS[40])/2; LS65 = (LS[60]+LS[70])/2
deps = (LS35-LS65)/100
h = 1.0   # mm total height (methods)
rows = []
for t_act in range(100, 1000, 100):                        # 35 s (active, swells more) thickness in um
    t_pas = 1000 - t_act
    m = t_pas/t_act; n = E65/E35                           # passive(65 s)/active(35 s)
    kappa = f(m, n)*deps/h
    rows.append({"t_active_um": t_act, "m": round(m, 3), "n": round(n, 3), "f": round(f(m, n), 3), "R_mm": round(1/kappa, 1)})
out["gelma"] = {"E35_kPa": E35, "E65_kPa": E65, "LS35_pct": LS35, "LS65_pct": LS65, "d_eps": deps, "n": E65/E35,
                "Rmin_ceiling_mm": h/(1.5*deps), "sweep": rows}

# 3. Elastic energy density bound for a fully blocked, uniformly strained layer: w = 0.5 * E * d_eps^2 (J/m^3)
def w(E_pa, de): return 0.5*E_pa*de**2
out["energy_bound_Jm3"] = {
  "GelMA_swollen_35s": w(E35*1e3, deps),
  "Rueggeberg_beech_E0.65GPa_deps0.0250": w(0.65e9, 0.0250),   # E: 0.5-0.8 GPa mid (Rueggeberg&Burgert 2015), d_eps=(3.2e-3-0.07e-3)*8 (spec-hygromorph-4d)
  "Formlabs_stock_PA12_E1.5GPa_deps0.0035": w(1.5e9, 0.0035),  # PA12 dry-to-saturated 0.33-0.44% (spec-resin-chemistry, estimate)
}
# 4. Upper bound for LCE work density = stress x strain, from review Table 1 (PMC13435120)
out["LCE_sigma_x_eps_kJm3"] = {k: v[0]*1e6*v[1]/100/1e3 for k, v in {"RM82-TATATO": (0.35, 42), "RM257-TATATO": (0.55, 28), "DDA-9": (0.15, 110), "thiol-acrylate": (0.25, 35)}.items()}
# 5. Dental LT Clear V2 water sorption (Formlabs resin, Form 3B+) one week: 29.53 ug/mm3
sorp = 29.53e-6/1e-3   # g/cm3  (ug/mm3 = mg/cm3)
out["LT_clear_week_water_g_per_cm3"] = 29.53e-3
out["LT_clear_week_mass_pct_if_rho_1.1"] = 100*0.02953/1.1   # ASSUMED density 1.1 g/cm3 (not from source)
out["LT_clear_week_linear_strain_upper_pct"] = 100*((1+0.02953/1.0)**(1/3)-1)  # volume gain = water vol (1 g/cm3) if ideal additivity; isotropic
# 6. Cheng 2024: curvature 0.0155 /mm -> radius
out["Cheng_R_mm"] = 1/0.0155
# 7. Cheng-type Timoshenko ceiling: strain needed for kappa=0.0155 /mm at h
for hh in (0.52, 1.0, 2.0):
    out.setdefault("Cheng_min_deps_for_kappa_0.0155", {})[f"h={hh}mm"] = 0.0155*hh/1.5
json.dump(out, open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-4d-printing/calc_out.json", "w"), indent=1)
print(json.dumps(out, indent=1))
