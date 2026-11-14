#!/usr/bin/env python3
"""Evaluate the PrintStructureLaws.lean certificates on the five proof-of-concept objects.

One command, no network, standard library only:
    python -I evaluate_certificates.py
Reads (read-only) the two repo files named below, checks that every number used here is still
printed in them, and writes certificates_results.json and certificates_table.md next to itself.

Formulas (identical to the Lean definitions):
    sag        = 3 rho g L^4 / (2 E h^2)             horizontal cantilever, own weight
    tau        = h_a^2 / (pi^2 D)                    slowest diffusion mode, two wetted faces
    theta_max  = (3/2) eps L / h                     best-case bilayer tip rotation
    L_cap      = sqrt(3 E delta eps^2 / (2 rho g theta^2))   (thickness cancels)
With delta = s L this is L_cap = 3 E s eps^2 / (2 rho g theta^2).

THE BRIEF IS A PLACEHOLDER chosen by this script's author, not a client requirement.
"""
import json, math, os, sys

REPO = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/agents"
POC = os.path.join(REPO, "bm-poc-designs.json")
RES = os.path.join(REPO, "bm-formlabs-all-resins.json")
HERE = os.path.dirname(os.path.abspath(__file__))
G = 9.81

poc_txt = open(POC, encoding="utf-8").read()
res_txt = open(RES, encoding="utf-8").read()

# every input below must still be printed in the source files; fail loudly otherwise
NEEDED_POC = [
    "30 x 3 x 1.0-1.1 mm", "active=0.4 mm Flexible 80A V2", "total 0.5/1.0/1.5/2.0 mm (active 0.2/0.4/0.6/0.8)",
    "60 mm long x width {3, 6, 12, 24, 60} mm x 1.0 mm", "trunk 50 x 3 x 2.0 mm (0.8+1.2)",
    "2 branches 25 x 2.5 x 1.0 mm (0.4+0.6)", "4 twigs 12.5 x 1.5 x 0.5 mm (0.2+0.3)",
    "3 blades 120 x 9 x 3.0 mm (1.2 mm Flexible 80A V2 + 1.8 mm passive)",
    "d_eps_active=0.99 % (1 day, from +3 % volume), 2.28 % (1 week, from +7 % volume), 3.17 %",
    "D=1.0e-12 to 1.1e-11 m2/s", "E_80A_V2_dry=4.3-11 MPa", "densities 1.09 and 1.01 g/cm3",
    "against 2.4 MPa now", "net density about 90 kg/m3 against water", "Solid Density 1.09 g/cm3",
]
NEEDED_RES = ["Tough 1000 932 MPa", "Rigid 10K 10000 MPa"]
missing = [s for s in NEEDED_POC if s not in poc_txt] + [s for s in NEEDED_RES if s not in res_txt]
if missing:
    sys.exit("INPUT CHECK FAILED, strings not found in the source files: %r" % missing)
if "--fail-once" in sys.argv:  # self-test of the guard: a string that is not there must stop the run
    if "this string is not in the file" not in poc_txt:
        sys.exit("fail-once: guard works (exit 1)")

# (name, L m, h total m, h active m)
PARTS = [
    ("1 strip", 0.030, 1.0e-3, 0.4e-3),
    ("2 comb, 0.5 mm rung", 0.030, 0.5e-3, 0.2e-3),
    ("2 comb, 1.0 mm rung", 0.030, 1.0e-3, 0.4e-3),
    ("2 comb, 2.0 mm rung", 0.030, 2.0e-3, 0.8e-3),
    ("3 tile (as 3 mm strip)", 0.060, 1.0e-3, 0.4e-3),
    ("4 tree trunk", 0.050, 2.0e-3, 0.8e-3),
    ("4 tree branch", 0.025, 1.0e-3, 0.4e-3),
    ("4 tree twig", 0.0125, 0.5e-3, 0.2e-3),
    ("5 louvre blade", 0.120, 3.0e-3, 1.2e-3),
]
# Two input sets. "favourable" takes the end of every prior that helps the design, so an
# elimination under it holds for the whole stated prior range. "central" is the middle.
INPUTS = {
    "favourable": dict(E=11e6, rho=1010.0, eps=0.0317, D=1.1e-11),
    "central": dict(E=2.4e6, rho=1050.0, eps=0.0228, D=math.sqrt(1.0e-12 * 1.1e-11)),
}
RHO_SUBMERGED = 90.0
# PLACEHOLDER brief (author's choice): horizontal cantilever in air
BRIEF = dict(sag_fraction=0.10, theta_deg=30.0, t_hours=1.0)


def sag(rho, L, E, h):
    return 3 * rho * G * L ** 4 / (2 * E * h ** 2)


def tau(h, D):
    return h ** 2 / (math.pi ** 2 * D)


def theta_max(eps, L, h):
    return 1.5 * eps * L / h


def evaluate(part, inp, brief, rho=None):
    name, L, h, ha = part
    rho = inp["rho"] if rho is None else rho
    E, eps, D = inp["E"], inp["eps"], inp["D"]
    delta = brief["sag_fraction"] * L
    theta = math.radians(brief["theta_deg"])
    t = brief["t_hours"] * 3600
    phi = ha / h
    s = sag(rho, L, E, h)
    tt = tau(ha, D)
    th = theta_max(eps, L, h)
    # the interval of the Lean theorem feasible_iff_interval, with effective diffusivity D/phi^2
    floor = math.sqrt(3 * rho * G * L ** 4 / (2 * E * delta))
    ceil_speed = math.sqrt(math.pi ** 2 * (D / phi ** 2) * t)
    ceil_rot = 3 * eps * L / (2 * theta)
    lcap = 3 * E * brief["sag_fraction"] * eps ** 2 / (2 * rho * G * theta ** 2)
    lcrit = (2 * E * h ** 2 * delta / (3 * rho * G)) ** 0.25  # at this part's own delta
    return {
        "part": name, "L_mm": L * 1e3, "h_mm": h * 1e3, "h_active_mm": ha * 1e3,
        "sag_mm": s * 1e3, "sag_over_L": s / L,
        "tau_h": tt / 3600, "theta_max_deg": math.degrees(th),
        "h_floor_sag_mm": floor * 1e3, "h_ceiling_speed_mm": ceil_speed * 1e3,
        "h_ceiling_rotation_mm": ceil_rot * 1e3,
        "L_cap_mm": lcap * 1e3, "L_crit_sag_mm": lcrit * 1e3,
        "elim_sag": s > delta,
        "elim_speed": tt > t,
        "elim_rotation": th < theta,
        "elim_length_cap": L > lcap,
        "elim_empty_window": floor > min(ceil_speed, ceil_rot),
    }


out = {"brief_placeholder": BRIEF, "inputs": INPUTS, "g": G, "rho_submerged": RHO_SUBMERGED, "rows": {}}
for key, inp in INPUTS.items():
    out["rows"][key + " / in air"] = [evaluate(p, inp, BRIEF) for p in PARTS]
out["rows"]["favourable / submerged"] = [evaluate(p, INPUTS["favourable"], BRIEF, RHO_SUBMERGED) for p in PARTS]

# sensitivity of the verdicts to the placeholder brief (favourable inputs, in air)
sens = []
for sf in (0.05, 0.10, 0.20):
    for th in (15.0, 30.0, 45.0):
        for th_h in (1.0, 24.0):
            b = dict(sag_fraction=sf, theta_deg=th, t_hours=th_h)
            rows = [evaluate(p, INPUTS["favourable"], b) for p in PARTS]
            sens.append(dict(brief=b, eliminated_any=[r["part"] for r in rows if r["elim_sag"] or r["elim_speed"] or r["elim_rotation"]],
                             L_cap_mm=rows[0]["L_cap_mm"]))
out["brief_sensitivity_favourable_air"] = sens

# stiffer resins: how long could a horizontal blade be (length cap) if the SAME strain were available
out["length_cap_other_moduli_mm"] = {
    name: 3 * E * BRIEF["sag_fraction"] * 0.0317 ** 2 / (2 * 1010.0 * G * math.radians(BRIEF["theta_deg"]) ** 2) * 1e3
    for name, E in (("Flexible 80A V2 upper prior 11 MPa", 11e6), ("Tough 1000 932 MPa", 932e6), ("Rigid 10K 10000 MPa", 10000e6))
}

json.dump(out, open(os.path.join(HERE, "certificates_results.json"), "w", encoding="utf-8", newline="\n"), indent=1)

lines = ["# Certificates applied to the five proof-of-concept objects", "",
         "Placeholder brief (author's choice, NOT a client requirement): horizontal cantilever, sag <= %.0f %% of length, tip rotation >= %.0f deg, slowest-mode time <= %.0f h." % (
             BRIEF["sag_fraction"] * 100, BRIEF["theta_deg"], BRIEF["t_hours"]), ""]
for key, rows in out["rows"].items():
    lines += ["## " + key, "",
              "| part | L mm | h mm | sag mm (sag/L) | tau h | theta_max deg | h window mm [floor, min(speed, rot)] | L_cap mm | eliminated by |",
              "|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        el = [n for n, k in (("sag", "elim_sag"), ("speed", "elim_speed"), ("rotation", "elim_rotation"), ("length cap", "elim_length_cap"), ("empty window", "elim_empty_window")) if r[k]]
        lines.append("| %s | %g | %g | %.2f (%.2f) | %.2f | %.0f | [%.2f, min(%.2f, %.2f)] | %.1f | %s |" % (
            r["part"], r["L_mm"], r["h_mm"], r["sag_mm"], r["sag_over_L"], r["tau_h"], r["theta_max_deg"],
            r["h_floor_sag_mm"], r["h_ceiling_speed_mm"], r["h_ceiling_rotation_mm"], r["L_cap_mm"], ", ".join(el) or "none"))
    lines.append("")
lines += ["## Length cap for other moduli (same 3.17 % strain assumed, which no stiff resin has shown)", ""]
for k, v in out["length_cap_other_moduli_mm"].items():
    lines.append("- %s: %.0f mm" % (k, v))
open(os.path.join(HERE, "certificates_table.md"), "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
print("\n".join(lines))
print("\nbrief sensitivity (favourable inputs, in air):")
for s in sens:
    print(" sag<=%.0f%% theta>=%.0f t<=%.0fh  L_cap=%.1f mm  eliminated: %s" % (
        s["brief"]["sag_fraction"] * 100, s["brief"]["theta_deg"], s["brief"]["t_hours"], s["L_cap_mm"], "; ".join(s["eliminated_any"]) or "none"))
