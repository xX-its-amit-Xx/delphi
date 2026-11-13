#!/usr/bin/env python3
"""All own arithmetic for bm-biopolymer-films. Run: python calcs.py > ../../scratch/bm-biopolymer-films/calcs_output.txt
Inputs are quoted from fetched sources (see report); inputs from search snippets are marked UNVERIFIED."""
import math
def f(m,n): return 6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m**2+1/(m*n)))
print("== 1. Timoshenko factor f(m,n) = 6(1+m)^2/[3(1+m)^2+(1+mn)(m^2+1/(mn))]  (project record)")
print("ceiling check f(m, 1/m^2) for m in 0.1..3:", [round(f(m,1/m**2),6) for m in (0.1,0.32,1,3)])
mx=max(f(m/100,n/10) for m in range(2,400) for n in range(2,2000)); print("grid max f =",round(mx,6))
print("== 2. Silk/polyimide bilayer, Khan et al. 2025 (8 um RSF on 25 um polyimide, h=33 um)")
hs,hp=8e-6,25e-6; h=hs+hp; m=hs/hp
print("m = 8/25 =",m)
for n in (1,2.9,5,10): print(f" n={n}: f={f(m,n):.3f}  (n=2.9 comes from 7.2/2.5 GPa quoted in a SEARCH SNIPPET, UNVERIFIED)")
for dk in (13e2,21e2):
    print(f" Delta kappa={dk/100:.0f} cm^-1 = {dk:.0f} m^-1; kappa*h = {dk*h:.4f}; min differential strain needed = kappa*h/1.5 = {dk*h/1.5*100:.2f} %")
print(" ceiling kappa_max = 1.5*d_eps/h with d_eps=5.02% (free silk film, Jung 2023): ",round(1.5*0.0502/h,0),"m^-1 =",round(1.5*0.0502/h/100,1),"cm^-1")
print(" ratio measured/ceiling: 13/",round(1.5*0.0502/h/100,1),"=",round(13/(1.5*0.0502/h/100),2)," ; 21/..=",round(21/(1.5*0.0502/h/100),2))
print("== 3. Ceiling curvature and radius for a bilayer of total thickness h and differential strain d_eps")
for name,d in (("stock resin low 0.2%",0.002),("stock resin high 1%",0.01),("Flexible 80A V2 1 day D471: 3% vol /3 = 1% linear",0.03/3),("silk 5.02%",0.0502),("silk porous 7.29%",0.0729),("CNC shear-oriented perp: 0.30 %/%C x 10 wt% (ASSUMED dC)",0.0030*10)):
    for hh in (0.0003,0.001):
        k=1.5*d/hh; print(f" {name:60s} h={hh*1e3:.1f} mm: kappa={k:7.1f} m^-1  R={1000/k:7.1f} mm")
print("== 4. Strain ratio silk vs resins")
for s in (5.02,7.29):
    print(f" silk {s}% / resin 1% = {s/1:.1f}x ; / 0.2% = {s/0.2:.1f}x")
print("== 5. Work-density scale 0.0352*E*d_eps^2 (spec-bilayer-physics formula, project record)")
for nm,E,d in (("silk, E=7.2 GPa UNVERIFIED, d=5.02%",7.2e9,0.0502),("Flexible 80A V2 secant 5.8 MPa (earlier agent estimate), d=1%",5.8e6,0.01),("Rigid 10K E=10 GPa, d=0.2%",10e9,0.002)):
    print(f" {nm}: {0.0352*E*d*d:.3g} J/m^3")
print(" measured silk WR energy density (Jung 2023, Khan 2025): 1.6 - 3.5 MJ/m^3 ; PG 72.6 MJ/m^3")
print("== 6. NFC film (Wang 2015): swelling ratio dL/L = d*k")
for d,k in ((8e-6,0.75e2),(48e-6,None)):
    if k: print(f" d={d*1e6:.0f} um, k=0.75 cm^-1 = {k:.0f} m^-1 -> dL/L = {d*k*100:.3f} % (paper states about 0.06 %)")
print("== 7. Response-time scaling tau ~ h^a, from silk/PI bend 13-44 s with 8 um silk (Jung 2023)")
for a in (1.3,1.5,2.0):
    for hl in (100e-6,200e-6,1e-3):
        r=(hl/8e-6)**a; print(f" a={a}: silk layer {hl*1e6:.0f} um: x{r:,.0f} -> {13*r/60:,.1f} - {44*r/60:,.1f} min  ({13*r/3600:.2f} - {44*r/3600:.2f} h)")
print("== 8. CNC hygroscopic swelling coefficient (Shrestha 2017) vs wood (Rueggeberg & Burgert 2015 via spec-hygromorph-4d.json)")
print(" self-organised CNC 0.040 %/%C ; sheared parallel 0.02, perpendicular 0.30 %/%C ; beech 3.2e-3 per %MC = 0.32 %/%MC")
for dC in (5,10,15): print(f" dC={dC} wt% (ASSUMED): isotropic CNC {0.040*dC:.2f} %, sheared-perp {0.30*dC:.2f} %, beech {0.32*dC:.2f} %")
print("== 9. Peptidoglycan (Wang 2022): height change 50.1% cortex, 27.2% cell wall (AFM, 5->90% RH); modulus 4.91->1.77 GPa")
print(" modulus drop factor =",round(4.91/1.77,2)," ; composite 1.33->0.47 GPa factor =",round(1.33/0.47,2))
print(" 180,000 cycles at 5.17e-5 %/cycle -> total degradation if linear =",round(180000*5.17e-5,2),"%")
print("== 10. Flexible 80A V2 (Formlabs TDS, ASTM D471, 1 day DI water): +8% mass, +3% volume -> linear ~",round(((1.03)**(1/3)-1)*100,2),"% ; 1 week +7% vol ->",round(((1.07)**(1/3)-1)*100,2),"%")
