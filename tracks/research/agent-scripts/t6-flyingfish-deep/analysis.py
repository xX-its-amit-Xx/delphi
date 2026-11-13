"""t6-flyingfish-deep: every calculation behind the report. Run: python -I -X utf8 analysis.py
Reads (read-only) the project's cached Daane 2021 Data S1A CSV and prints all derived numbers."""
import csv,math,statistics,sys,json
CSV='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/genotype/cache/daane2021_data_s1A_fin_measurements.csv'
g=9.81; rho=1.225
out={}
# --- Park & Choi 2010 model L3 (Table 1 as read by project; Table 2 read from PDF text)
m=0.06; S=0.006377+0.001837+0.004474; CLmax=0.78; LD=4.37; CDmin=0.055
W=m*g
out['L3_W_N']=W; out['L3_S_m2']=S; out['L3_wing_loading_N_m2']=W/S
vmin=math.sqrt(2*W/(rho*S*CLmax)); out['vmin_L3_m_s']=vmin
out['vmin_L3_if_CLmax_1.03']=math.sqrt(2*W/(rho*S*1.03))
# range bounds (energy height H = v^2/2g)  x <= LD*H/(1-delta)
def H(v): return v*v/(2*g)
for v in (10,15,20):
    out[f'range_bound_LD4.37_v{v}_m']=LD*H(v)
    out[f'range_bound_LD4.37_v{v}_groundeffect14pct_m']=LD*H(v)/(1-0.14)
out['speed_for_50m_LD4.37']=math.sqrt(50*2*g/LD)
out['speed_for_50m_LD4.37_ge14']=math.sqrt(50*(1-0.14)*2*g/LD)
out['speed_to_reach_13.2m_apex']=math.sqrt(2*g*13.2)
# Deng 2019: launch speed fixed 20 m/s (read in full text, section 3.3); L/D 4.7
Hd=H(20); out['Deng_energy_height_m']=Hd
out['Deng_bound_LD4.7_m']=4.7*Hd
out['Deng_ratio_45.4']=45.4/(4.7*Hd); out['Deng_ratio_41.5']=41.5/(4.7*Hd)
out['Deng_apex_13.2_over_energy_height']=13.2/Hd
# Makiguchi leaps 3.87-5.15 m/s (abstract says 3.9-5.2)
for v in (3.87,5.15):
    out[f'ballistic_apex_v{v}_m']=H(v); out[f'ballistic_range_45deg_v{v}_m']=v*v/g
    out[f'v_over_vmin_{v}']=v/vmin
# power: level flight power needed = W v /(L/D); E3 v2 aerobic ceiling 0.0833 W (registry law E3 2.1.0)
for v in (vmin,10,15):
    P=W*v/LD; out[f'P_level_v{v:.2f}_W']=P; out[f'P_over_E3ceiling_v{v:.2f}']=P/0.0833
# Palstra 2010 unit check: 82.18 umol O2 / g / h -> mg O2 / kg / h
out['Palstra_MO2max_mgO2_per_kg_per_h']=82.18*31.998  # umol/g/h x 31.998 g/mol = ug/g/h = mg/kg/h
# Davenport 1992 exponents (abstract): mass 2.981, area 1.834 vs reported wing loading exponent 1.236
out['Davenport_implied_loading_exponent']=2.981-1.834
# taxi ratio
out['taxi_power_ratio_350_over_36']=350/36

# --- launch energy needed for a single level lifting glide of 50 m (stall floor subtracted): x <= LD*(v0^2-vmin^2)/(2g)/(1-delta)
for lab,dl in (('noGE',0.0),('GE14',0.14)):
    out[f'v0_needed_50m_{lab}']=math.sqrt(vmin**2+50*(1-dl)*2*g/LD)
for v in (15,20):
    out[f'range_bound_with_stall_floor_v{v}_m']=LD*(v*v-vmin**2)/(2*g)
# taxi power per kg vs aerobic ceiling per kg
out['taxi_W_per_kg_CFD']=36/0.191; out['E3_ceiling_W_per_kg']=0.0833/0.06
out['taxi_over_E3_per_kg']=(36/0.191)/(0.0833/0.06)
# Kawachi (second-hand via Deng) L/D 15.7 vs measured 4.37 and CFD 4.7
out['Kawachi_LD_over_ParkChoi']=15.7/4.37; out['Kawachi_LD_over_Deng']=15.7/4.7
# Deng: Re at 10 m/s vs 20 m/s launch (Re scales with speed)
out['Deng_speed_ratio_launch_over_coeff']=20/10
# Daane CSV
rows=list(csv.DictReader(open(CSV,encoding='utf8')))
def ratio(r):
    try: return float(r['pectoral_over_SL_sheet'])
    except: return None
grp={}
for r in rows:
    x=ratio(r)
    if x is not None: grp.setdefault(r['group'],[]).append((r['species'],float(r['SL_cm']),float(r['pectoral_cm']),x))
out['daane_groups']={k:{'n':len(v),'min':min(a[3] for a in v),'max':max(a[3] for a in v),'median':statistics.median(a[3] for a in v)} for k,v in grp.items()}
fl=grp.get('flying fish',[])
xs=[math.log(a[1]) for a in fl]; ys=[math.log(a[2]) for a in fl]; n=len(xs)
mx,my=sum(xs)/n,sum(ys)/n
sxx=sum((x-mx)**2 for x in xs); sxy=sum((x-mx)*(y-my) for x,y in zip(xs,ys))
b=sxy/sxx; a0=my-b*mx
res=sum((y-(a0+b*x))**2 for x,y in zip(xs,ys)); syy=sum((y-my)**2 for y in ys)
se=math.sqrt(res/(n-2)/sxx)
tcrit={47:2.0117}.get(n-2,2.0117)
out['daane_flyingfish_loglog']={'n':n,'b':b,'se':se,'ci95':[b-tcrit*se,b+tcrit*se],'r2':1-res/syy}
big=[a for a in fl if a[1]>=15]; out['daane_flyingfish_SL>=15cm']={'n':len(big),'max_ratio':max(a[3] for a in big)}
out['daane_species_in_groups']={k:sorted(set(a[0] for a in v)) for k,v in grp.items()}
print(json.dumps(out,indent=1))
