# Own calculation: steady-glide equilibria of the Li et al. (2022) quasi-steady plate model.
# Coefficient set A: Pomerenk & Ristroph 2025 (arXiv 2408.08864v2, text after eq 4.4).
# Coefficient set B: Alsomitra-seed fit, Kessler et al. arXiv 2505.00622v1 Table 3 (after Certini thesis).
# Equilibrium (omega=0, buoyancy torque neglected in air): CP(alpha)/l = e  ; glide ratio = CL/CD ;
# speed v = sqrt(2 W' / (rho_f * sqrt(CL^2+CD^2))), W' = buoyancy-corrected weight per planform area.
import numpy as np
from scipy.optimize import brentq
def coeffs(a,c):
    f=(1-np.tanh((np.degrees(a)-c['a0'])/c['d']))/2
    CL=f*c['CL1']*np.sin(a)+(1-f)*c['CL2']*np.sin(2*a)
    CD=f*(c['CD0']+c['CD1']*np.sin(a)**2)+(1-f)*c['CDp']*np.sin(a)**2
    CP=f*(c['CP0']-c['CP1']*a**2)+(1-f)*c['CP2']*(1-a/(np.pi/2))
    return CL,CD,CP
A=dict(CL1=5.2,CL2=0.95,CD0=0.1,CD1=5.0,CDp=1.9,CP0=0.3,CP1=3.5,CP2=0.2,a0=14,d=6)
B=dict(CL1=5.1822,CL2=0.80751,CD0=0.10598,CD1=4.9368,CDp=1.4996,CP0=0.23857,CP1=2.8529,CP2=0.36893,a0=14,d=6)
def eq(e,c):
    g=lambda a: coeffs(a,c)[2]-e
    aa=np.radians(np.linspace(0.01,89.99,9000)); v=np.array([g(a) for a in aa]); roots=[]
    for i in range(len(aa)-1):
        if v[i]*v[i+1]<0: roots.append(brentq(g,aa[i],aa[i+1]))
    return roots
def row(e,c,Wp,rho,chord,nu):
    out=[]
    for a in eq(e,c):
        CL,CD,CP=coeffs(a,c); C=np.hypot(CL,CD); v=np.sqrt(2*Wp/(rho*C)); gam=np.degrees(np.arctan2(CD,CL))
        out.append((np.degrees(a),CL,CD,CL/CD,gam,v,v*np.sin(np.radians(gam)),v*chord/nu))
    return out
def table(name,c,Wp,rho,chord,nu,es):
    print('\n==',name,"| W'=%.3f N/m2 rho=%.4g chord=%.4f m"%(Wp,rho,chord))
    print(' e=CoM/chord | alpha_deg  CL    CD    glide_ratio  glide_angle_deg  speed_m/s  sink_m/s  Re')
    for e in es:
        rs=row(e,c,Wp,rho,chord,nu)
        if not rs: print(' %.3f | no glide equilibrium (pancake/dive only)'%e); continue
        for r in rs: print(' %.3f | %6.2f  %.3f %.3f  %6.2f  %6.1f  %7.3f  %7.3f  %6.0f'%((e,)+r))
es=[0.05,0.10,0.15,0.187,0.20,0.22,0.25,0.28,0.30,0.32]
# 1. Li et al paper sheet in air (Pomerenk Table 2: 0.59 g, span 15 cm, chord 5.1 cm)
Wp=0.59e-3*9.81/(0.15*0.051); table('Paper sheet in air, coeff set A',A,Wp,1.2,0.051,1.5e-5,es)
# 2. Plastic plate in water (Pomerenk Table 2: 9.12 g, span 20.3 cm, chord 2.54 cm, thickness 0.15 cm)
vol=0.203*0.0254*0.0015; Wp=(9.12e-3-1000*vol)*9.81/(0.203*0.0254); table('Plastic plate in water, coeff set A',A,Wp,1000,0.0254,1.0e-6,es)
# 3. Alsomitra-fit (Kessler Table 3: l=0.07 m, m=3.175e-4 kg, span s=0.1745 from Plate_Model_Site app.py default)
Wp=3.175e-4*9.81/(0.1745*0.07); table('Alsomitra-fit plate in air, coeff set B',B,Wp,1.225,0.07,1.5e-5,[0.15,0.181,0.187,0.193,0.20,0.22,0.235])
# 4. Proposed print: resin plate 40 mm chord x 160 mm span x 1.0 mm, resin density 1.15 g/cc (ASSUMED, check datasheet), in water
t=0.001; rho_s=1150.0
Wp=(rho_s-1000)*9.81*t; table('PROPOSED resin plate 40x160x1.0 mm in water (rho_s=1150 assumed), coeff set A',A,Wp,1000,0.040,1.0e-6,es)
# max glide ratio location for set A
ee=np.linspace(0.02,0.299,280); best=max(((row(e,A,1,1,1,1)[0][3],e) for e in ee if row(e,A,1,1,1,1)),key=lambda x:x[0]); print('\nset A max glide ratio %.2f at e=%.3f'%best)
ee=np.linspace(0.02,0.2385,220); best=max(((row(e,B,1,1,1,1)[0][3],e) for e in ee if row(e,B,1,1,1,1)),key=lambda x:x[0]); print('set B max glide ratio %.2f at e=%.3f'%best)
