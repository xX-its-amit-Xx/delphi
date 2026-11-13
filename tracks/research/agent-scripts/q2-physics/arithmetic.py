# Own calculations for q2-physics. Constants: CODATA 2018 exact SI values.
import math
kB=1.380649e-23; NA=6.02214076e23; cal=4184.0
R=kB*NA            # J/mol/K
T=298.15
RT=R*T/cal         # kcal/mol
print(f"R = {R:.5f} J/mol/K ; RT(298.15 K) = {RT:.4f} kcal/mol")
f10=RT*math.log(10)
print(f"RT ln10 = {f10:.4f} kcal/mol per 10-fold change in K (pK unit)")
for dg in (1.0,1.364,1.4,2.0,3.0):
    print(f"ddG={dg} kcal/mol -> fold change in Kd = {math.exp(dg/RT):.2f}")
print(f"1 pK unit = {f10:.3f} kcal/mol; 1 kcal/mol = {1/f10:.3f} pK")
print("# pK->kcal conversions of literature errors")
for name,pk in [("Kramer mean error",0.44),("Kramer SD",0.54),("Kramer median",0.34),("Ross pairwise 0.56",0.56),("Ross pairwise 0.69",0.69),
                ("CASF-style search baseline RMSE 1.517 pK",1.517),("GEMS CleanSplit 1.308 pK",1.308),("5x lead-opt target (Wang abstract: ~5x)",math.log10(5))]:
    print(f"{name}: {pk:.3f} pK = {pk*f10:.2f} kcal/mol")
print("check Ross: 0.56 pK -> 0.77 kcal?", round(0.56*f10,2), "; 0.69 pK -> 0.95?", round(0.69*f10,2))
print("# single-measurement sigma from pairwise RMS difference (independent equal-variance errors): sigma = D/sqrt2")
for D in (0.77,0.95,0.85):
    print(f"pairwise RMS {D} kcal/mol -> single-assay sigma {D/math.sqrt(2):.2f} kcal/mol = {D/math.sqrt(2)/f10:.2f} pK")
print("# noise ceiling: R2max = 1 - sigma^2/Var(observed)")
for sd_obs in (1.0,1.5,2.0):   # SD of observed pK across a dataset: ASSUMED illustrative values
    for sig in (0.4,0.54):
        print(f"SD(obs pK)={sd_obs}, sigma={sig}: R2max={1-sig**2/sd_obs**2:.3f}, Rmax={math.sqrt(1-sig**2/sd_obs**2):.3f}")
# Kramer 0.81 implies sigma/SD:
print("Kramer R2max=0.81 -> sigma^2/Var =",round(1-0.81,2),"-> sigma/SD =",round(math.sqrt(0.19),3), "-> with sigma=0.54, SD(obs)=",round(0.54/math.sqrt(0.19),2),"pK")
print("# Gaussian share of errors beyond 1 and 2 kcal/mol if sigma = FEP+ pairwise RMSE 1.08 (Ross reported 57.5% within 1, 12.9% beyond 2)")
from math import erf,sqrt
s=1.08
w1=erf(1/(s*sqrt(2))); b2=1-erf(2/(s*sqrt(2)))
print(f"Gaussian sigma=1.08: within 1 = {100*w1:.1f}%, beyond 2 = {100*b2:.1f}%")
s=0.85
print(f"Gaussian sigma=0.85: within 1 = {100*erf(1/(s*sqrt(2))):.1f}%, beyond 2 = {100*(1-erf(2/(s*sqrt(2)))):.1f}%")
print("# kinetics: Kd = koff/kon; residence time = 1/koff; t1/2 = ln2/koff")
for kon,koff in [(1e6,1e-3),(1e8,1e-1),(1e5,1e-4)]:
    print(f"kon={kon:.0e} /M/s koff={koff:.0e} /s -> Kd={koff/kon*1e9:.3g} nM ; residence 1/koff={1/koff:.3g} s ; t1/2={math.log(2)/koff/60:.3g} min")
print("two ligands with equal Kd=1 nM: (kon 1e6, koff 1e-3) vs (kon 1e8 /M/s, koff 1e-1 /s): residence 1000 s vs 10 s = 100x; dG identical")
print("# entropy-enthalpy illustration: dG = dH - T dS")
for dS in (5,10,20):  # cal/mol/K
    print(f"dS={dS} cal/mol/K -> -T dS = {-T*dS/1000:.2f} kcal/mol at 298.15 K; to keep dG fixed, dH must change by the same")
print("# Cheng-Prusoff (competitive): Ki = IC50/(1+[S]/Km)")
for r in (0.1,1,5,10): print(f"[S]/Km={r}: IC50/Ki = {1+r:g} -> offset {RT*math.log(1+r):.2f} kcal/mol")
print("# Kalliokoski: Ki-IC50 conversion factor of 2 ->", round(RT*math.log(2),2),"kcal/mol")
print("# MM-style: errors add in quadrature: sqrt(0.6^2+0.6^2)=",round(math.sqrt(0.72),2))
