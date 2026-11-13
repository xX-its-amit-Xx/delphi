"""Re-implements the repo's equilibrium pipeline (S_elem/T_tis/O_obj formulas, copied from gh_scripts) with the material
panels decoded from ct_design.gh, and reports for each paper case the stimulus step du that the paper's predicted
angle would require, plus the angle at the repo's default sliders. Pure python, no deps. Run: python -I reproduce_pipeline.py"""
import math, json
P={ # name: (E MPa, alpha_L, alpha_T, chi_L, chi_T) -- from ct_design.gh panels (gh_panels.py)
 'PA6-GF':(2850,1.0e-4,5.0e-3,5.0e-3,1.1e-2),
 'PA612-CF15':(5140,3.0e-5,1.0e-4,1.2e-3,7.0e-3),
 'PLA-CF':(6000,2.0e-5,8.0e-5,2.0e-4,1.0e-3),
 'PLA':(3500,6.8e-5,1.0e-4,1.0e-4,5.0e-4),
 'pine_sclereid':(30,5e-6,5e-5,0.02,0.20),
 'pine_sclerenchyma':(650,5e-6,5e-5,0.01,0.05)}
def C_geom(h1,h2,E1,E2):
    m=h1/h2;n=E1/E2;h=h1+h2
    return 6*(1+m)**2/(h*(3*(1+m)**2+(1+m*n)*(m*m+1/(m*n))))
def angle_per_unit(stim,resp,mat1,th1,mat2,th2,h1=0.06,h2=0.06,L=10.0):
    i=3 if stim=='hygro' else 1  # index of L coefficient
    cL1,cT1=P[mat1][i],P[mat1][i+1]; cL2,cT2=P[mat2][i],P[mat2][i+1]
    r1,r2=math.radians(th1),math.radians(th2)
    es1=cL1*math.cos(r1)**2+cT1*math.sin(r1)**2; es2=cL2*math.cos(r2)**2+cT2*math.sin(r2)**2
    d1=0.5*(cL1-cT1)*math.sin(2*r1); d2=0.5*(cL2-cT2)*math.sin(2*r2)
    d=(d1-d2) if resp=='twisting' else (es1-es2)
    C=C_geom(h1,h2,P[mat1][0],P[mat2][0])
    return math.degrees(C*d*L), C
cases=[('Baseline hygro bend, README 0/90','hygro','bending','PA6-GF',0,'PA612-CF15',90,36.4),
       ('Baseline hygro bend, G-code header 90/0','hygro','bending','PA6-GF',90,'PA612-CF15',0,36.4),
       ('Case I thermal bend (90/0)','thermal','bending','PLA',90,'PLA-CF',0,52.0),
       ('Case II hygro twist (+45/-45)','hygro','twisting','PA6-GF',45,'PA612-CF15',-45,41.3),
       ('Case III thermal twist (+45/-45)','thermal','twisting','PLA',45,'PLA-CF',-45,23.0)]
out=[]
for name,stim,resp,m1,t1,m2,t2,pred in cases:
    a,C=angle_per_unit(stim,resp,m1,t1,m2,t2)
    du_req=pred/abs(a)
    dflt=0.5 if stim=='hygro' else 55.0
    out.append(dict(case=name,C_geom_per_cm=round(C,4),deg_per_unit_du=round(a,4),paper_pred_deg=pred,du_required=round(du_req,4),
                    unit='fraction RH' if stim=='hygro' else 'K',angle_at_repo_default_du=round(a*dflt,2),default_du=dflt))
    print(out[-1])
# Nat-branch panel pair (pine_sclereid / pine_sclerenchyma) at repo default RH 30->80%, h1=h2=0.06 cm, L=10 cm
a,C=angle_per_unit('hygro','bending','pine_sclereid',90,'pine_sclerenchyma',0)
print('pine panel pair: C_geom=%.3f /cm, angle at du=0.5 = %.1f deg (L=10 cm, h1=h2=0.6 mm: NOT a real cone scale geometry)'%(C,a*0.5))
json.dump(out,open(r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-category-theory-papers/reproduce_pipeline.out.json','w'),indent=1)

# Bend 'crosstalk' accompanying the twist cases (the repo's own d_thk, computed by beta_twist.py and labelled crosstalk)
def crosstalk(stim,m1,t1,m2,t2,du,h=0.06,L=10.0):
    i=3 if stim=='hygro' else 1
    r1,r2=math.radians(t1),math.radians(t2)
    es1=P[m1][i]*math.cos(r1)**2+P[m1][i+1]*math.sin(r1)**2; es2=P[m2][i]*math.cos(r2)**2+P[m2][i+1]*math.sin(r2)**2
    return math.degrees(C_geom(h,h,P[m1][0],P[m2][0])*(es1-es2)*du*L)
print('hygro twist (du=1.0): bend crosstalk = %.1f deg alongside 41.3 deg twist'%crosstalk('hygro','PA6-GF',45,'PA612-CF15',-45,1.0))
print('thermal twist (dT=71.1 K implied): bend crosstalk = %.1f deg alongside 23.0 deg twist'%crosstalk('thermal','PLA',45,'PLA-CF',-45,71.1118))
print('G-code header kappa 0.0763 1/cm over L=10 cm -> %.1f deg'%math.degrees(0.0763*10))
