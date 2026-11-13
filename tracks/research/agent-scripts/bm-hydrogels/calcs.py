#!/usr/bin/env python
"""bm-hydrogels own calculations. Run: python -I calcs.py > ../../scratch/bm-hydrogels/calcs_output.txt
Inputs are quoted from fetched sources (see comments)."""
import math
def f(m,n):  # project-record Timoshenko coefficient
    return 6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m*m+1/(m*n)))

print('== 1. PEGDA volumetric swelling J (swollen/dry volume) -> linear ratio J^(1/3)')
print('source: Table 2 of PMC11325651 (Wetzel-type table, PEGDA 1.07/2.03/5.85 kDa, LAP, as-cured conc c wt%)')
for Mn,rows in {'1.07 kDa':[(17.9,5.5),(21.8,4.8),(25.7,4.2)],'2.03 kDa':[(15.8,8.9),(18.4,7.6),(21.0,6.9)],'5.85 kDa':[(8.0,35.7),(11.9,22.2),(15.9,16.9)]}.items():
    for c,J in rows: print(f'  Mn={Mn:9s} c={c:5.1f} wt%  J={J:5.1f}  J^(1/3)={J**(1/3):.2f}  (linear swelling vs dry = {100*(J**(1/3)-1):.0f} %)')

print('\n== 2. GelMA LCD-printed bilayer (PMC13205297 Table 1): Timoshenko prediction with project-record f(m,n)')
tab={30:(14.48,7.83),40:(15.30,7.11),50:(17.07,5.52),60:(18.64,2.02),70:(20.23,0.70)}
def interp(t,i):
    ks=sorted(tab)
    for a,b in zip(ks,ks[1:]):
        if a<=t<=b: return tab[a][i]+(tab[b][i]-tab[a][i])*(t-a)/(b-a)
for ta,tp in [(35,65)]:
    LSa,LSp=interp(ta,1),interp(tp,1); Ea,Ep=interp(ta,0),interp(tp,0)
    de=(LSa-LSp)/100; n=Ea/Ep
    print(f'  active layer exposure {ta}s: LS={LSa:.2f}% E={Ea:.2f} kPa ; passive {tp}s: LS={LSp:.2f}% E={Ep:.2f} kPa')
    print(f'  d_eps={de:.4f}  n=E_active/E_passive={n:.3f}')
    for m in (1.0, n**-0.5):
        h=1.0 # mm total height (20x2x1 mm samples)
        k=f(m,n)*de/h
        print(f'  m={m:.3f}: f={f(m,n):.3f}  kappa={k:.4f} 1/mm  R={1/k:.1f} mm')
    print(f'  ceiling f=1.5 -> R_min={1/(1.5*de):.1f} mm (h=1 mm)')
print('  paper states radii of curvature between 11 and 20 mm depending on geometry (per-sample values are in Fig 5a, not read).')

print('\n== 3. Cooperative-diffusion swelling time: tau = h^2/(pi^2 D) (PMC9457170 Eq: tau = h_inf^2 /(pi^2 D)); D_sw = 8.8e-11 .. 1.7e-10 m2/s (polyampholyte gel, not PEGDA)')
for D in (8.8e-11,1.7e-10):
    for h in (0.1e-3,0.5e-3,1.0e-3,2.0e-3):
        tau=h*h/(math.pi**2*D)
        print(f'  D={D:.1e} h={h*1e3:.1f} mm tau={tau:8.1f} s = {tau/60:7.2f} min ; 5*tau={5*tau/3600:6.2f} h')

print('\n== 4. PNIPAM halftone films (PMC12612155): areal deswelling A35/A0 = 0.3..0.5 -> linear = sqrt')
for a in (0.3,0.5): print(f'  A/A0={a}: linear L/L0={a**0.5:.2f} (shrinkage {100*(1-a**0.5):.0f} %)')

print('\n== 5. Abdullah-Okay EWC (PMC9945108): EWC 51 % -> swollen/dry mass 1/(1-0.51); linear if densities ~1')
for ewc in (0.51,0.07): 
    r=1/(1-ewc); print(f'  EWC={ewc*100:.0f}%: mass ratio {r:.2f}, linear {(r**(1/3)-1)*100:.0f} %')

print('\n== 6. Tanglemer AAm hydrogel (PMC13674616): swelling ratio ~4 <-> ~80 wt% water ; check 1-1/4')
print(f'  1-1/4 = {1-1/4:.2f} -> 75 wt% water if ratio is mass(swollen/dry)=4; paper states ~80 wt% (swelling ratio definition in SI Eq S6, not read)')

print('\n== 7. Stiffness cost of water: Burke 2020 PEGDMA600 on Form 2: tensile E 15.47 vs 19.92 MPa; compressive 13.01 vs 8.26 MPa (as reported; SLA vs UV ordering ambiguous in text)')
print('\n== 8. Optimum thickness ratio m*=n^-1/2 for modulus ratio n between GelMA (E~15-20 kPa) and Rigid 10K (10 GPa): n=E_active/E_passive')
for n in (2e-6,1.5e-6,1.9e-6):
    print(f'  n={n:.1e}: m*={n**-0.5:.0f} (active layer would need to be ~{n**-0.5:.0f}x thicker than the stiff layer); f(1,n)={f(1,n):.2e}; f(m*,n)={f(n**-0.5,n):.3f}')

print('\n== 9. Hydrogel (active) + printed passive layer: modulus ratio n = E_hydrogel/E_passive, optimum m*=n^-1/2 (m = h_hydrogel/h_passive), f at m=1 and at m*')
print('   E values: GelMA 15% swollen ~19 kPa (PMC13205297 Table 1, 60 s row 18.64 / 70 s 20.23); PEGDMA-600 SLA compressive 13.01 MPa (PMC7564751, stored in PBS 37C; hydration state at test not stated);')
print('   passive: Rigid 10K 10-11 GPa (spec-formlabs-materials.json), Grey/Clear V5 ~2.75 GPa (spec-resin-chemistry.json, Clear V5 TDS), Silicone 40A secant ~0.8 MPa and Flexible 80A V2 secant ~5.8 MPa (OWN ESTIMATES in spec-formlabs-materials.json, not published moduli)')
Eh={'GelMA 19 kPa':0.019,'PEGDMA-600 13 MPa':13.01}
Ep={'Rigid 10K 10 GPa':10000.,'Clear V5 2.75 GPa':2750.,'Flexible 80A V2 ~5.8 MPa (est)':5.8,'Silicone 40A ~0.8 MPa (est)':0.8}
for hn,eh in Eh.items():
    for pn,ep in Ep.items():
        n=eh/ep; ms=n**-0.5
        print(f'  {hn:18s} on {pn:32s}: n={n:9.2e}  m*={ms:9.2f}  f(m=1)={f(1,n):.4f}  f(m*)={f(ms,n):.3f}')
print('   reading: m* is the hydrogel-to-passive thickness ratio needed to reach the 1.5 ceiling; with the 0.2 mm Form 4 minimum wall (Grey V5, spec-formlabs-materials.json) m*=h_hydrogel/0.2 mm.')
for pn,ep,eh in [('Clear V5',2750.,0.019),('Rigid 10K',10000.,0.019),('Clear V5 w/ PEGDMA',2750.,13.01)]:
    n=eh/ep; print(f'   {pn}: with 0.2 mm rigid wall, hydrogel thickness needed = {0.2*n**-0.5:.1f} mm')
