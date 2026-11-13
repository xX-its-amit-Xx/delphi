"""Own calculations for t4-glide-deep. Run: python derived.py  (prints every derived number with its arithmetic)
Inputs are typed from sources named next to each block (all fetched this run); nothing is from memory except rho_air, marked."""
import math, re, numpy as np
print('== A. Reynolds numbers, Fauli et al. 2019 Table I (arXiv 1811.12221): Re = U*L/nu')
for name,U,L,nu,quoted in [('lab low',0.04,0.06,1e-6,2400),('lab high',0.2,0.06,1e-6,14000),('S. argentifolia',1.2,0.035,1.5e-5,2800),('S. johorensis',1.7,0.05,1.5e-5,5700),('S. mecistopterix',2.4,0.08,1.5e-5,12700)]:
    print(f'  {name}: {U}*{L}/{nu:g} = {U*L/nu:.0f} (table says {quoted})')
print('== B. Measured vs model optimum ratio of descent speeds psi=0 over psi=35 (analyze_repo_out.txt)')
U0,U35=0.1011,0.0676; print(f'  measured (2.16 g key, KL 2.31 vs 1.20): {U0}/{U35} = {U0/U35:.2f}')
Re0,Re35=4709,3900; print(f'  BEM (1.2 g loading, min Re): {Re0}/{Re35} = {Re0/Re35:.2f}')
print('== C. Eq.1 collapse test: U ~ sqrt(mg/Ad), psi=0, m key 2.16 g; Ad from Fig.7 caption (0.0058,0.0069,0.0061 m2 for KL 1.7,2.3,3.0)')
U={1.71:0.1137,2.31:0.1011,3.00:0.1258}; Ad={1.71:0.0058,2.31:0.0069,3.00:0.0061}
base=None
for k in U:
    c=1/(U[k]**2*Ad[k]); base=base or c
    print(f'  KL {k}: relative effective force coefficient 1/(U^2 Ad) = {c/base:.2f} (equal weight; 1.00 = KL 1.71)')
print('== D. Descent factor DF = 2 (W/S)/(rho v^2) from Nave et al. 2021 Table 1 (arXiv 2010.12553); rho=1.225 kg/m3 (UNVERIFIED BACKGROUND, sea-level air)')
rho=1.225
for name,ws,v in [('natural Norway',2.09,1.10),('artificial Norway',3.18,1.28)]:
    DF=2*ws/(rho*v*v); print(f'  {name}: 2*{ws}/({rho}*{v}^2) = {DF:.2f}; predicted v at DF=3: sqrt({ws}/(0.5*{rho}*3)) = {math.sqrt(ws/(0.5*rho*3)):.2f} m/s')
print('== E. Glide angle <-> glide ratio (glide ratio = 1/tan(angle))')
for a in [9.49,10.32,13.58,12.53]: print(f'  Wiesemuller 2022 experiment angle {a} deg -> L/D = {1/math.tan(math.radians(a)):.2f}')
print(f'  Pomerenk&Ristroph max glide ratio 3.8 -> angle {math.degrees(math.atan(1/3.8)):.1f} deg')
print('== F. Smith et al. 2015 (PMC4485961) Table 3: ballistic h*w/V vs LMM and Table 1 medians; h=30 m, w=1.72 m/s')
t=open('D:/Users/ashenoy00000/delphi-work/data/t4-glide-deep-html/smith2015.xml',encoding='utf8').read(); t=re.sub('<[^>]+>',' ',t); t=re.sub(r'\s+',' ',t)
i=t.find('Table 3 Comparison'); s=t[i:i+1600]
rows=re.findall(r'((?:Dipterocarpus|Hopea|Shorea) \w+) ([\d.]+) \(± [\d.]+\) ([\d.]+) ([\d.]+) ([\d.]+|NA)',s)
r=[]
for n,iwl,wl,lmm,bal in rows:
    if bal=='NA': continue
    V=1.72*30/float(bal); r.append(float(bal)/float(lmm)); print(f'  {n}: ballistic {bal} m  (implied V=1.72*30/{bal}={V:.2f} m/s)  LMM {lmm} m  ratio {float(bal)/float(lmm):.1f}')
print(f'  ballistic/LMM ratio: min {min(r):.1f}, median {np.median(r):.1f}, max {max(r):.1f}, n={len(r)}')
print('== G. Registry law perturb-wind-glide/P4b limit u->0: range = h*(u+w)/s  (u horizontal airspeed, s sink). Fruit: u~0 -> range = h*w/s')
print(f'  h=30, w=1.72, s=2.35 -> {30*1.72/2.35:.1f} m')
print('== H. Registry flight-allometry-law: vmin exponent (bW-bS)/2 with E1 exponents mass 2.981, area 1.834 (from earlier law-mapper; check E1.json separately): ',(2.981-1.834)/2)
print('== I. Coefficient peaks from repo model/lift_drag_coefficients.py (parametrization 1, drag divisor 2.0) and a vmin_le scope test')
a=np.linspace(-180,180,360001)
CL=0.225+1.58*np.sin(np.radians(2.13*a-7.2)); CD=(1.92-1.55*np.cos(np.radians(2.04*a-9.82)))/2.0
i=np.argmax(CL); j=np.argmax(CD)
print(f'  max CL = {CL[i]:.3f} at alpha {a[i]:.1f} deg; max CD = {CD[j]:.3f} at alpha {a[j]:.1f} deg; max CL/CD for alpha in (0,45) = {np.max(CL[(a>0)&(a<45)]/CD[(a>0)&(a<45)]):.2f}')
rho=1.225
for name,ws,v in [('natural Norway maple (Nave 2021)',2.09,1.10),('artificial Norway maple',3.18,1.28)]:
    vm=math.sqrt(2*ws/(rho*CL[i])); print(f'  {name}: law vmin_le with S=wing area, CLmax={CL[i]:.2f}: v >= sqrt(2*{ws}/({rho}*{CL[i]:.2f})) = {vm:.2f} m/s; measured {v} m/s -> {"VIOLATES" if v<vm else "ok"} (law scope is steady freestream lift, not autorotation)')
