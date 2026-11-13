"""Arithmetic behind the bm-resin-water-uptake-data report. Run: python calc.py
Every input number is copied from a fetched source (named in the comment beside it).
Numbers marked UNVERIFIED-BG are background values used only for consistency checks, never as load-bearing claims.
Writes calc_out.json next to this script's scratch folder."""
import json, math, os

out = {}

# ---- 1. Formlabs Flexible 80A V2 TDS, ASTM D471, deionized water (slab, wiped dry) ----
# source: flex80av2_tds.pdf page 6 (https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf)
rho_resin = 1.09          # g/cm3, same TDS (solid density, as read by earlier agent spec-formlabs-materials.json)
rho_water = 1.00          # UNVERIFIED-BG
d471 = {"1 day": (8.0, 3.0), "1 week": (9.0, 7.0)}   # (mass %, volume %)
r = {}
for k, (dm, dv) in d471.items():
    lin = (1 + dv / 100) ** (1 / 3) - 1
    ideal_dv = dm * rho_resin / rho_water             # volume % if volume were additive with water
    r[k] = dict(mass_pct=dm, vol_pct=dv, linear_strain_pct_isotropic=round(100 * lin, 3),
                strain_pct_per_mass_pct=round(100 * lin / dm, 3),
                ideal_additive_vol_pct=round(ideal_dv, 2),
                volume_efficiency=round(dv / ideal_dv, 2))
out["flex80a_v2_water_D471"] = r
# same table, solvent sanity check (IPA 1 day: +45% mass, +113% vol; acetone 1 day +55/+155)
chk = {}
for name, (dm, dv, rho_s) in {"IPA 1 day": (45, 113, 0.785), "Acetone 1 day": (55, 155, 0.79)}.items():  # rho_s UNVERIFIED-BG
    ideal = dm * rho_resin / rho_s
    chk[name] = dict(mass_pct=dm, vol_pct_reported=dv, ideal_additive_vol_pct=round(ideal, 1), ratio_reported_to_ideal=round(dv / ideal, 2))
out["flex80a_v2_solvent_volume_check"] = chk

# ---- 2. Formlabs Elastic 50A V1 TDS (Spanish copy), 24 h, 1 cm cube: size gain and weight gain ----
# source: elastic50a_v1_tds.pdf page 2, rows aligned by y coordinate (tds_table.py)
elastic = {  # solvent: (size %, weight %, solvent density UNVERIFIED-BG)
    "Acetone": (19.3, 37.3, 0.79), "Isopropyl alcohol": (13.3, 25.6, 0.785), "Butyl acetate": (18.2, 39.6, 0.88),
    "Xylene": (20.4, 46.6, 0.86), "Skydrol 5 (density not used)": (9.9, 21.7, None)}
rows = {}
for s, (sz, wt, rs) in elastic.items():
    row = dict(size_pct=sz, weight_pct=wt, strain_pct_per_mass_pct=round(sz / wt, 3))
    if rs:
        row["implied_resin_density_if_ideal_mixing"] = round(3 * rs * (sz / wt), 2)   # eps = dm * rho_r/(3 rho_s)
    rows[s] = row
out["elastic50a_v1_solvent_coefficients"] = rows
rhos = [v["implied_resin_density_if_ideal_mixing"] for v in rows.values() if "implied_resin_density_if_ideal_mixing" in v]
rho_r = sum(rhos) / len(rhos)
out["elastic50a_v1_mean_implied_density"] = round(rho_r, 2)
# water: weight 2.3 %, size "<1 %"  (same table)
pred = rho_r / (3 * 1.0)           # % linear per mass %, ideal mixing with water (rho_w = 1.00 UNVERIFIED-BG)
out["elastic50a_v1_water"] = dict(weight_pct=2.3, size_pct_reported="<1", upper_bound_strain_per_mass_pct=round(1 / 2.3, 3),
                                  ideal_mixing_strain_per_mass_pct=round(pred, 3), ideal_mixing_strain_pct_at_2p3=round(pred * 2.3, 2))

# ---- 3. Wei et al. 2013 Dent Mater (abstract): mass change vs hygroscopic expansion after 150 d, 37 C, 15x2 mm discs ----
wei = {"Filtek Silorane": (0.68, 0.74), "Vertise Flow": (2.83, 4.79)}
w = {}
for k, (m, e) in wei.items():
    lin_if_vol = (1 + e / 100) ** (1 / 3) - 1
    w[k] = dict(mass_pct=m, expansion_pct_as_reported=e, ratio_as_reported=round(e / m, 2),
                linear_pct_if_expansion_is_volumetric=round(100 * lin_if_vol, 3),
                linear_per_mass_pct_if_volumetric=round(100 * lin_if_vol / m, 3))
out["wei2013_composites"] = w
out["wei2013_note"] = ("abstract does not say linear or volumetric. If 4.79 % were LINEAR the volume gain would be "
                       f"{round(100*((1.0479**3)-1),1)} %, far above any water-additive volume for a 2.83 % mass gain; so it is read as volumetric.")

# ---- 4. Radic 2024 (arXiv 2406.08326): bake mass loss vs caliper length ----
out["radic2024_bound"] = dict(mass_loss_pct=0.29, side_mm=48.0, caliper_tolerance_mm=0.15,
                              max_undetected_strain_pct=round(100 * 0.15 / 48.0, 3),
                              strain_per_mass_pct_upper_bound=round((100 * 0.15 / 48.0) / 0.29, 2),
                              note="null result: no change within +-0.15 mm; bound is weak and mass loss may not be only water")

# ---- 5. ISO 4049/20795 sorption (ug/mm3) -> mass % ----
RHO = 1200.0  # ug/mm3 = 1.20 g/cm3, ASSUMED (typical dimethacrylate density; earlier agent used 1210 for Formlabs denture resin)
def mp(x): return round(100 * x / RHO, 2)
out["sorption_ug_per_mm3_to_mass_pct_assuming_1p20"] = {
    "Gad 2022 Formlabs Denture Base OP, 48 h 37C, before thermocycling (17.86)": mp(17.86),
    "Gad 2022 same, after 5000 thermocycles (25.92)": mp(25.92),
    "BMC Oral Health 2025 Formlabs Denture Base OP, 7 d DW, air (7.53)": mp(7.53),
    "BMC Oral Health 2025 same, glycerin (8.12)": mp(8.12),
    "Polymers 2026 Asiga-printed methacrylate IV, 24 h (11.1)": mp(11.1),
    "Polymers 2026 same, 14 d (39.8)": mp(39.8),
    "Choi 2022 Bis-EMA B100, 7 d 25C (15.1)": mp(15.1),
    "Choi 2022 B2T1O7, 7 d 25C (16.5)": mp(16.5)}

# ---- 6. Diffusivity from Polymers 2026 medians, D = 0.049 L^2 / t_half (their Eq. 3), L = 1 mm ----
L = 1e-3
def D(th_h): return 0.049 * L ** 2 / (th_h * 3600)
# milled I: 24 h = 18.4 of ~28.3 plateau (14 d); half of 28.3 = 14.15 -> before 24 h; sqrt(t) scaling from the 24 h point
th_milled = 24 * (14.15 / 18.4) ** 2
# printed IV: plateau not reached (39.8 at 14 d, still rising) -> use 39.8 as a LOWER bound on M_inf; half = 19.9;
# linear interpolation between 48 h (18.6) and 72 h (24.7)
th_print = 48 + (19.9 - 18.6) / (24.7 - 18.6) * 24
out["polymers2026_diffusivity_recheck"] = dict(
    reported_milled_m2_s="1.02e-12 to 1.15e-12", reported_printed_m2_s="0.85e-12",
    my_milled_t_half_h=round(th_milled, 1), my_milled_D_m2_s=D(th_milled),
    my_printed_t_half_h=round(th_print, 1), my_printed_D_m2_s=D(th_print),
    reported_printed_implied_t_half_h=round(0.049 * L ** 2 / 0.85e-12 / 3600, 1))

# ---- 7. unit conversions of dental-resin diffusivities (Sideridou 2011 abstract: values in 1e-8 cm2/s) ----
sid = {"Bis-GMA": 11.01, "Bis-EMA": 7.43, "UDMA": 6.88, "D3MA": 6.22, "TEGDMA": 1.52}
out["sideridou2011_D_m2_s"] = {k: v * 1e-8 * 1e-4 for k, v in sid.items()}   # 1 cm2 = 1e-4 m2

# ---- 8. time to equilibrium implied by D: t ~ L^2/D for a printable 0.4 mm and 1.0 mm layer ----
for Dv, tag in [(2.6e-13, "printed_methacrylate_recheck"), (0.85e-12, "printed_methacrylate_reported"), (6.88e-12, "UDMA_resin")]:
    for Lm in (0.4e-3, 1.0e-3):
        out.setdefault("t_equals_L2_over_D_hours", {})[f"{tag}_L{Lm*1e3:.1f}mm"] = round(Lm ** 2 / Dv / 3600, 1)


# ---- 9. Pino 2024 (Materials 17:5953) seawater, 60x60x1 mm, 23 C: crude Fickian D from stated time-to-saturation ----
# R3: 12.37 % at 2.5 d vs 13.49 % saturation; R2 "stabilized within four days"; R1 "did not reach saturation until after eight days"
# plate, two faces, late-time series: M/Minf = 1 - (8/pi^2) exp(-pi^2 D t / L^2)  ->  D = -ln((1-f)*pi^2/8) * L^2 / (pi^2 t)
def D_fick(f, t_days, L=1e-3):
    return -math.log((1 - f) * math.pi ** 2 / 8) * L ** 2 / (math.pi ** 2 * t_days * 86400)
out["pino2024_crude_D_m2_s"] = {
    "R3 Conjure HE Tough: f=12.37/13.49 at 2.5 d": D_fick(12.37 / 13.49, 2.5),
    "R2 Elegoo ABS-like: f=0.98 assumed at 4 d (stabilised within 4 d)": D_fick(0.98, 4),
    "R1 Esun standard: f=0.98 assumed at 8 d (saturated only after 8 d)": D_fick(0.98, 8)}

here = os.path.dirname(os.path.abspath(__file__))
dest = os.path.join(here, "..", "..", "scratch", "bm-resin-water-uptake-data", "calc_out.json")
os.makedirs(os.path.dirname(dest), exist_ok=True)
json.dump(out, open(dest, "w"), indent=1)
print(json.dumps(out, indent=1))
