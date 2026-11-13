# Own calculations for bm-buehler-materials-corpus. Run: python -I calc.py  (prints; writes scratch/calc_out.json)
import json, math, sys
sys.stdout.reconfigure(encoding='utf8')
def f(m,n): return 6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m**2+1/(m*n)))
out={}
# 1. symmetry check of f under (m,n)->(1/m,1/n)
out['f_symmetry_max_abs_diff']=max(abs(f(m,n)-f(1/m,1/n)) for m in (0.05,0.3,1,2.5,9) for n in (0.01,0.2,1,7,300))
# 2. ceiling check on a grid
best=max((f(10**(a/50),10**(b/50)),10**(a/50),10**(b/50)) for a in range(-150,151) for b in range(-200,201))
out['grid_max_f']=best[0]
# 3. modulus ratios (source numbers in comments)
Vero,Tango=2187,0.53   # MPa, Gu thesis Table 2.1 (VeroMagenta, TangoBlackPlus)
out['vero_over_tango']=Vero/Tango
rigid10k=(10000,11000); flex80v2_secant=5.8   # MPa; project record spec-formlabs-materials.json own estimate (2.9 MPa / 0.5)
out['rigid10k_over_flex80v2']=[x/flex80v2_secant for x in rigid10k]
# 4. bilayer consequences for n around those ratios (stiff layer = layer 1 so n>1)
rows=[]
for label,n in [('Vero/Tango (Gu thesis)',Vero/Tango),('Rigid10K/Flex80A-V2 (low)',rigid10k[0]/flex80v2_secant),('Rigid10K/Flex80A-V2 (high)',rigid10k[1]/flex80v2_secant),('Dimas effective interface ratio',50.0),('n=10',10.0)]:
    m_opt=n**-0.5
    rows.append({'case':label,'n':round(n,1),'f_equal_thickness(m=1)':round(f(1,n),4),'frac_of_ceiling_at_m=1':round(f(1,n)/1.5,4),
                 'm_opt=n^-1/2':round(m_opt,4),'thick_to_thin_at_opt':round(1/m_opt,1),'f_at_opt':round(f(m_opt,n),6),
                 'thick_layer_mm_if_thin_is_0.2mm':round(0.2/m_opt,2)})
out['bilayer_rows']=rows
# 5. combinatorics quoted in Gu thesis: 16 cells, 4 soft
out['C(16,4)']=math.comb(16,4)
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-buehler-materials-corpus/calc_out.json','w'),indent=1)
print(json.dumps(out,indent=1))

# 6. Osmotic pressure from RH: Pi = -(R T / v_m) ln(RH)  (relation stated in Masic 2015, PMC4354200).
# R=8.314 J/mol/K (constant), T=298.15 K assumed, v_m = molar volume of liquid water = 18.0e-6 m3/mol (unverified background constant).
R=8.314; T=298.15; vm=18.0e-6
osm={}
for rh in (0.30,0.50,0.70,0.90,0.95,0.99,0.997):
    osm[str(rh)]=round(-(R*T/vm)*math.log(rh)/1e6,2)   # MPa
out['osmotic_pressure_MPa_at_RH']=osm
out['RH_for_0.4MPa']=round(math.exp(-0.4e6*vm/(R*T)),4)
out['conch_ratio_Hier2_over_Hier1']=round(1.85/1.10,3)
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-buehler-materials-corpus/calc_out.json','w'),indent=1)
print('osmotic MPa',osm,'RH@0.4MPa',out['RH_for_0.4MPa'],'conch ratio',out['conch_ratio_Hier2_over_Hier1'])
