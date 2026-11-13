"""All arithmetic used in bm-architecture-gaps. Run: python -I calc.py  (prints every derived number)."""
import math, json
out={}
# 1. CLT price conversion: Mass Timber Performance Index says ~$42-44 per cubic foot (2025 feature story)
ft3_per_m3=1/0.3048**3
out['CLT_MTPI_USD_per_m3']=[round(42*ft3_per_m3),round(44*ft3_per_m3)]
out['CLT_ft3_per_m3']=round(ft3_per_m3,3)
# 2. BC lab cost EUR/g -> EUR/kg (Polymers 18(6):721 abstract: 0.27->0.08 and 0.25->0.07 EUR/g)
out['BC_EUR_per_kg']={'control_0.25-0.27':[250,270],'best_0.07-0.08':[70,80]}
# 3. PLA UV: pure PLA ~28 MPa -> below 10 MPa after 12 weeks simulated UV
out['PLA_UV_retention_max_pct']=round(10/28*100,1)
# 4. Timoshenko f(m,n) ceiling check (independent numeric check of project record)
def f(m,n): return 6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m*m+1/(m*n)))
best=0;arg=None
for n in [0.1,1,2,5,10,50]:
    mm=max((f(m/1000,n),m/1000) for m in range(1,20000))
    out.setdefault('f_max_by_n',{})[n]=[round(mm[0],5),round(mm[1],4),round(n**-0.5,4)]
out['f_equal_layers_n10']=round(f(1,10),4)
out['f_equal_layers_loss_pct']=round((1-f(1,10)/1.5)*100,1)
# 5. Flexible 80A V2 (Formlabs TDS, ASTM D471, DI water): +8% mass, +3% vol (1 d); +9% mass, +7% vol (1 wk).
#    Isotropic linear strain from volume change: (1+dV)^(1/3)-1.  Passive partner Silicone 40A: <0.1% mass (24h cube) -> strain ~0 assumed.
rows=[]
for label,dV in [('1 day',0.03),('1 week',0.07)]:
    eps=(1+dV)**(1/3)-1
    for h in [0.4,1.0,2.0]:  # total bilayer thickness mm (0.2 mm min wall each layer on Form 4 per earlier record)
        kappa=1.5*eps/(h*1e-3)  # 1/m
        rows.append({'exposure':label,'d_eps_pct':round(eps*100,2),'h_mm':h,'radius_mm':round(1000/kappa,1)})
out['Flex80A_V2_bilayer_vs_zero_swelling_partner']=rows
# 6. Freiburg: 5.5 kg active filament / 0.59 kg per m2
out['Freiburg_area_m2']=round(5.5/0.59,2)
# 7. mycelium panel $0.83 per cubic foot -> per m3
out['mycelium_usd_per_m3_secondary']=round(0.83*ft3_per_m3,1)
# 8. 4D shading cellulose powder cost per m2 of facade if all 0.59+0.07 kg/m2 were cellulose powder (upper bound, filament has binder)
out['cellulose_powder_EUR_per_m2_upper_bound']=round((0.59+0.07)*1.52,2)
# 9. CLT per m2 for an assumed 100 mm panel (assumption, not from source): price/m3 * 0.1
out['CLT_100mm_USD_per_m2']={'MTPI_42-44_per_ft3':[round(x*0.1,1) for x in out['CLT_MTPI_USD_per_m3']],'Brandt_mill_gate_536_to_652':[53.6,65.2]}
# 10. BC: crude dry 180.3 MPa vs crude fresh (hydrated) 3.1 MPa modulus (Pogorelova 2020, Tables 1-2)
out['BC_dry_over_fresh_modulus']=round(180.3/3.1,1)
print(json.dumps(out,indent=1))
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-architecture-gaps/calc_out.json','w'),indent=1)
