"""Own calculation. Project record: at the Timoshenko optimum m^2 n = 1, kappa = 1.5*d_eps/h  (h = total bilayer thickness).
Cheng 2024 (Nat Commun, doi 10.1038/s41467-024-54808-8) measured kappa = 0.0155 mm^-1 = 15.5 m^-1 at 80% RH.
Differential strains for stock Formlabs pairs are the earlier agent's estimates (agents/spec-resin-chemistry.json, own conversions there, immersion in water not RH).
Output: required d_eps for given h, and the largest h at which each d_eps reaches Cheng's curvature."""
kappa=15.5  # 1/m
print("required differential strain d_eps = kappa*h/1.5 for kappa=15.5 1/m")
for h_mm in (0.3,0.5,1.0,2.0):
    print("  h=%.1f mm -> d_eps=%.2f %%"%(h_mm, kappa*h_mm*1e-3/1.5*100))
print("largest total thickness h = 1.5*d_eps/kappa that still reaches kappa=15.5 1/m")
for name,de in (("Clear/Grey V5 vs Rigid 10K, 24 h water, low est 0.20%",0.0020),("same, high est 0.26%",0.0026),("same, 1 week low 0.70%",0.0070),("same, 1 week high 0.95%",0.0095),("Flexible 80A V2 alone, 1 day ~1.0%",0.0099),("Flexible 80A V2 alone, 1 week ~2.3%",0.0228)):
    print("  %-60s h_max=%.2f mm"%(name,1.5*de/kappa*1e3))
# diffusion-time scaling: t ~ h^2/D (own scaling argument, D unknown for Formlabs resins -> only ratios)
print("response-time ratio for thickness x relative to 0.5 mm: t ~ h^2 ->", {h:round((h/0.5)**2,1) for h in (0.25,0.5,1.0,2.0,4.0)})
