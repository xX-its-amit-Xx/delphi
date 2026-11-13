"""Own calculations for bm-competing-approaches. Run: python calc.py  (prints and writes calc_out.json)"""
import json, math
def f(m,n): return 6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m**2+1/(m*n)))
out={}
# 1. Thermal bilayer from Formlabs TDS CTE (0-150C): Rigid 10K 41-48 um/m/C (TDS metric column, 4 conditions: 48,41,47,46), Tough 1000 161.6 (green) 168.2 (post-cured)
da_lo=161.6-48; da_hi=168.2-41
out['dCTE_um_per_mK']=[da_lo,da_hi]
for dT in (20,40):
    out[f'thermal_strain_pct_dT{dT}']=[da_lo*1e-6*dT*100, da_hi*1e-6*dT*100]
# curvature at the 3/2 ceiling for h=1 mm, dT=40
for h in (0.4,1.0):
    for dT in (20,40):
        k=[1.5*d*1e-6*dT/h for d in (da_lo,da_hi)]   # 1/mm
        out[f'ceiling_kappa_per_m_h{h}_dT{dT}']=[x*1000 for x in k]
        out[f'ceiling_R_mm_h{h}_dT{dT}']=[1/x for x in k]
# the stiffness ratio for this pair: active=Tough1000 (E 0.932 GPa), passive=Rigid 10K (10-11 GPa) n=Ep/Ea
for Ep in (10.0,11.0):
    n=Ep/0.932; mopt=n**-0.5
    out[f'n_Rigid10K_over_Tough1000_Ep{Ep}']=n
    out[f'm_opt_Ep{Ep}']=mopt  # passive thickness / active thickness
    out[f'f_equal_thickness_Ep{Ep}']=f(1.0,n)
# 2. Gap between thermal and hygroscopic: earlier agents' estimated humidity d_eps 0.2% (24 h) .. 0.7-0.95% (1 week), Flexible 80A V2 measured 3% vol/1 d -> 0.99% linear
out['Flex80AV2_linear_strain_1d_pct']=(1.03**(1/3)-1)*100
out['Flex80AV2_linear_strain_1wk_pct']=(1.07**(1/3)-1)*100
# 3. Diffusion time scales t90=0.848 h^2/D (one face exposed; project record bm-diffusion-kinetics) for D (m2/s)
tt={}
for label,D in (('stock rigid resin 1e-12',1e-12),('Flex80AV2-class 6e-12',6e-12),('hydrogel 1e-10',1e-10)):
    for h in (0.2e-3,0.4e-3,0.8e-3,1.6e-3):
        tt[f'{label} h={h*1e3}mm']=0.848*h*h/D/3600  # hours
out['t90_hours']=tt
# 4. Hydrogel speed vs SMP: Ding 2017 cites hydrogel hinge 0.8 mm: 36 deg in ~7 min; SMP ~20 s in 62C water
out['speed_ratio_SMP_vs_hydrogel_hinge']=(7*60)/20
# 5. Small-slope check: arc angle for strip length L at ceiling curvature, strain d, thickness h
ang={}
for d in (0.002,0.005,0.01):
    for h in (0.4,1.0):
        k=1.5*d/h  # 1/mm
        for L in (40,100):
            ang[f'd{d}_h{h}_L{L}_deg']=math.degrees(k*L)
out['arc_angle_deg']=ang
# 6. Dingler 2021 ratio predicted/measured (values quoted from paper text): 17um: predicted max 5.3/mm with humidity-dependent E, measured 1.2/mm; 54um: predicted 1.6/mm, measured = 1.2/3 (paper: 1.2 is "about three times" the 54um value)
out['Dingler_ratio_17um']=5.3/1.2
out['Dingler_ratio_54um']=1.6/(1.2/3)
# 7. Work density (project record bm-bilayer: 0.0352 E d_eps^2) for humid stock-resin vs SMP: just illustrate E d_eps^2 for E=1 MPa..1GPa d=0.5%
out['work_density_J_per_m3']={f'E={E:g}Pa_d=0.005':0.0352*E*0.005**2 for E in (1e6,1e9)}
json.dump(out,open('calc_out.json','w'),indent=1)
print(json.dumps(out,indent=1))
