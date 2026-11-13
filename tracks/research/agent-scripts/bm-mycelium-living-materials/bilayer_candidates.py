"""Own calculation for report bm-mycelium-living-materials.
f(m,n)=6(1+m)^2/[3(1+m)^2+(1+m n)(m^2+1/(m n))]  (project record; ceiling 3/2 at m^2 n = 1).
Convention checked below: m = t_active/t_passive, n = E_active/E_passive; kappa = f * d_eps / h, h = t_a + t_p.
Inputs are sourced in the report; strains from volume data assume isotropic swelling (eps_lin = (1+dV/V)^(1/3)-1).
Run: python -I bilayer_candidates.py   (prints a table and writes bilayer_candidates.json next to this script)"""
import json, os, math
def f(m,n): return 6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m**2+1/(m*n)))
# 1. ceiling and symmetry checks
import itertools
mx=max((f(m,n),m,n) for m in [10**(k/20) for k in range(-80,81)] for n in [10**(k/20) for k in range(-80,81)])
print("grid max f =",round(mx[0],6),"(should be <= 1.5)")
for m,n in [(1,1),(0.2,25),(5,0.04),(0.0447,500)]:
    print("m,n=",m,n,"f=",round(f(m,n),4),"m^2 n=",round(m*m*n,3),"| swapped f(1/m,1/n)=",round(f(1/m,1/n),4))
# 2. Wang 2017 cell layer volume law: V/V_wet = 0.345*RH + 0.667 (RH as fraction; V_wet at 95 % RH)
V=lambda rh:0.345*rh+0.667
def eps_lin(lo,hi): return (V(lo)/V(hi))**(1/3)-1
cell={"15->95%RH":eps_lin(.15,.95),"30->70%RH":eps_lin(.30,.70),"30->85%RH":eps_lin(.30,.85)}
print("cell layer linear strain (dry vs wet):",{k:round(v,4) for k,v in cell.items()})
# 3. Nie 2026 Janus mycelium layers: bulk moisture expansion (volume) A=9.27 %, B=3.38 % (30->85 %RH)
nie={"layer_A_lin":(1.0927)**(1/3)-1,"layer_B_lin":(1.0338)**(1/3)-1}
nie["A_minus_B_lin"]=nie["layer_A_lin"]-nie["layer_B_lin"]
print("Nie layers linear-equivalent strain:",{k:round(v,4) for k,v in nie.items()})
# 4. Optimum thickness for pairings with Formlabs passive layers (E from project-record secant estimates, MPa)
passive={"Silicone 40A":0.8,"Flexible 50A":1.8,"Flexible 80A V2":5.8,"Tough 2000 V2":1800.0,"Rigid 10K":10000.0}
active={"Nie Janus mycelium macerate (E 23.7 MPa)":(23.7,nie["layer_A_lin"],"30->85%RH"),
        "Nie macerate, differential A-B only (E 23.7)":(23.7,nie["A_minus_B_lin"],"30->85%RH"),
        "Wang cell layer (E 70 MPa)":(70.0,-cell["30->70%RH"],"30->70%RH")}
rows=[]
for an,(Ea,de,rh) in active.items():
    for pn,Ep in passive.items():
        n=Ea/Ep; mstar=n**-0.5   # m = t_a/t_p at optimum
        # example geometry: passive 1.0 mm, active at m*  (total h)
        tp=1.0; ta=mstar*tp; h=ta+tp; kap=f(mstar,n)*de/(h*1e-3)
        # also fixed example: active 0.2 mm on 0.6 mm passive
        m2=0.2/0.6; k2=f(m2,n)*de/(0.8e-3)
        rows.append(dict(active=an,passive=pn,n=round(n,4),m_opt=round(mstar,3),t_active_at_opt_for_1mm_passive_mm=round(ta,3),
            kappa_opt_per_m=round(kap,2),R_opt_mm=round(1000/kap,1) if kap else None,
            f_at_0p2_over_0p6mm=round(f(m2,n),3),kappa_0p2_on_0p6mm_per_m=round(k2,2),eps_used=round(de,4),RH=rh))
for r in rows: print(r)

# 5. Thin microbial film case: passive layer at the 0.2 mm Form 4 minimum wall, cell film 1, 10, 30 um (E 70 MPa, eps 30->70 %RH)
thin=[]
for pn in ["Silicone 40A","Flexible 50A","Flexible 80A V2"]:
    for ta_um in (1,10,30):
        tp=0.2; ta=ta_um/1000; m=ta/tp; n=70.0/passive[pn]; h=ta+tp
        k=f(m,n)*0.0534/(h*1e-3)
        thin.append(dict(passive=pn,t_active_um=ta_um,t_passive_mm=tp,m=round(m,4),n=round(n,1),f=round(f(m,n),3),kappa_per_m=round(k,1),R_mm=round(1000/k,1)))
for r in thin: print(r)
# 6. derating for soft/large-strain films (spec-hygromorph-4d: Timoshenko over-predicts soft printed films by 3.8-4.4x, Dingler 2021)
base=[r for r in rows if r["active"].startswith("Nie Janus") and r["passive"]=="Flexible 50A"][0]["kappa_0p2_on_0p6mm_per_m"]
der={"linear_theory":base,"derated_4.4x":round(base/4.4,1),"derated_3.8x":round(base/3.8,1),"R_linear_mm":round(1000/base,1),"R_derated_mm":[round(1000/(base/4.4),1),round(1000/(base/3.8),1)]}
print("Nie film 0.2 mm on 0.6 mm Flexible 50A:",der)
json.dump(dict(cell_strain=cell,nie=nie,rows=rows,thin_film=thin,derating=der,grid_max_f=mx[0]),open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"bilayer_candidates.json"),"w"),indent=1)
