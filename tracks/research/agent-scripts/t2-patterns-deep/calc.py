"""Own calculations for t2-patterns-deep. Reads Cremer 2019 source-data MOESM11 (ED Fig 1c) and MOESM22 (ED Fig 8c) from
D:/Users/ashenoy00000/delphi-work/data/t2-patterns-deep/ (downloaded 2026-11-12; sha256 in the report). Run: python calc.py
Does NOT open any other Cremer source-data sheet (the design agent quarantined them for a frozen prediction)."""
import openpyxl, numpy as np, json
D=r'D:/Users/ashenoy00000/delphi-work/data/t2-patterns-deep/'
ws=openpyxl.load_workbook(D+'MOESM11.xlsx',data_only=True).active
rows=[r for r in ws.iter_rows(min_row=3,values_only=True) if r[0]]
R=[dict(strain=r[0],gen=r[1],carbon=r[2],ind=r[4],att=r[5],u=r[8],n=r[10],g=r[11]) for r in rows]
um2s_to_mm2h=3.6e-3   # 1 um^2/s = 1e-6 mm^2 * 3600 s/h = 3.6e-3 mm^2/h
Drho=50.2*um2s_to_mm2h; Da=800*um2s_to_mm2h; chi0=315*um2s_to_mm2h   # MOESM3.txt: D_chemotaxis_1=50.2e-12 m^2/s, D_nutrients=8.0e-10, xhi_1=0.315e-9
out={}
print('Drho,Da,chi0 mm2/h:',Drho,Da,chi0)
wt=[x for x in R if x['strain']=='HE206' and x['att']=='Aspartate']
u=np.array([x['u'] for x in wt]); r=np.array([x['g'] for x in wt])
print('\nWT, 100 uM Asp, 6 carbon sources')
cF=2*np.sqrt(Drho*r)
for x,cf,ui in zip(wt,cF,u): print(f"{x['carbon']:16s} r={x['g']:.4f}/h u={ui:.3f} mm/h  Fisher cF=2sqrt(D r)={cf:.3f}  u/cF={ui/cf:.2f}")
out['wt_u_over_cF']=[round(float(a/b),2) for a,b in zip(u,cF)]
sl=np.polyfit(np.log(r),np.log(u),1); print('log-log slope u vs r (WT 6 rows): %.3f'%sl[0]); out['wt_slope']=round(float(sl[0]),3)
k=(u**2*r).sum()/(r**2).sum(); print('k=u^2/r LSQ through origin: %.2f mm2/h'%k); out['k']=round(float(k),2)
print('u^2/r per row:',np.round(u**2/r,2))
# Narla eq 21 / 23 with published sim parameters, a0/am=100 (100 uM Asp, am=1 uM)
def c21(r,a0am=100.0,chi=chi0,Dr=Drho,Dar=Da): 
    X=chi-Dr; return X*np.sqrt(r*a0am/(X+Dar))
print('\nNarla Eq21 with Cremer published parameters (chi0=315, Drho=50.2, Da=800 um2/s; a0/am=100):')
pred=c21(r)
for x,p,ui in zip(wt,pred,u): print(f"{x['carbon']:16s} pred={p:.2f} meas={ui:.2f}  ratio={p/ui:.2f}")
out['narla_over_meas_wt']=[round(float(p/a),2) for p,a in zip(pred,u)]
# Titration series: Pu-glpFK + Asp
gl=[x for x in R if x['strain']=='HE443' and x['att']=='Aspartate']
ug=np.array([x['u'] for x in gl]); rg=np.array([x['g'] for x in gl])
s_all=np.polyfit(np.log(rg),np.log(ug),1)[0]; s_nz=np.polyfit(np.log(rg[1:]),np.log(ug[1:]),1)[0]
print('\nPu-glpFK+Asp: r=',rg,'u=',np.round(ug,3)); print('slope u~r^s: all 5 = %.2f ; without zero-inducer point = %.2f'%(s_all,s_nz))
out['glpFK_slope_all']=round(float(s_all),2); out['glpFK_slope_no0']=round(float(s_nz),2)
pt=[x for x in R if x['strain'].startswith('HE26')]
print('\nHeld-out strains vs sqrt(k r):')
for x in R:
    if x['strain'] in('HE268','HE269','HE433') and x['att']=='Aspartate':
        p=np.sqrt(k*x['g']); print(f"{x['gen']:9s} ind={x['ind']} r={x['g']:.3f} meas={x['u']:.2f} pred={p:.2f} err={100*(p/x['u']-1):+.0f}%")
# same growth rate, different speed
a=[x for x in R if x['carbon']=='40mM glycerol' and x['gen']=='glpK22' and x['att']=='Aspartate'][0]
b=[x for x in wt if x['carbon']=='20mM glucose'][0]
print('\nglpK22/glycerol r=%.4f u=%.2f ; wt/glucose r=%.4f u=%.2f ; ratio of speeds at ~equal r = %.2f'%(a['g'],a['u'],b['g'],b['u'],a['u']/b['u']))
out['same_r_speed_ratio']=round(a['u']/b['u'],2)
# serine vs aspartate
for c in ['20mM glucose','40mM glycerol']:
    s=[x for x in R if x['carbon']==c and x['gen']=='wt' and x['att']=='Serine'][0]; d=[x for x in wt if x['carbon']==c][0]
    print(c,'serine u=%.2f asp u=%.2f ratio %.2f'%(s['u'],d['u'],s['u']/d['u']))
# cAA
for x in R:
    if x['att']=='cAA': print('cAA',x['carbon'],x['u'],x['g'], 'u/(Fisher with Drho=50.2) = %.2f'%(x['u']/(2*np.sqrt(Drho*x['g']))))
# dose series
ws2=openpyxl.load_workbook(D+'MOESM22.xlsx',data_only=True).active
dose=[(r[6],r[4],r[8]) for r in ws2.iter_rows(min_row=3,values_only=True) if r[2]=='HE206']
print('\nDose series (conc uM, carbon, mm/h):')
for c in ['20mM glucose','40mM glycerol']:
    d=[(a,u_) for a,cc,u_ in dose if cc==c]; print(c,d)
    cs=np.array([a for a,_ in d]); us=np.array([u_ for _,u_ in d]); i=us.argmax(); print('  peak at %g uM, %.2f mm/h; at 10 mM: %.2f'%(cs[i],us[i],us[-1]))
    m=(cs>=10)&(cs<=100); print('  slope u~a0^s over 10-100 uM: %.2f'%np.polyfit(np.log(cs[m]),np.log(us[m]),1)[0])
    out['dose_peak_'+c]=[float(cs[i]),round(float(us[i]),2)]
# Narla sqrt prediction for a0 dependence: exponent 0.5 (valid only when a0>>am(1+Da/X))
X=chi0-Drho; print('\nValidity: a0/am >> 1 + Da/(chi0-Drho) = %.2f ; a0/am = 100 for 100 uM'%(1+Da/X))
out['validity_rhs']=round(float(1+Da/X),2)
json.dump(out,open(r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/calc_out.json','w'),indent=1)
# unit conversions used in the report
print('\n4.4 um/s in mm/h =',4.4*3.6,' ; 7.7 um/s =',7.7*3.6)

# Lower-bound check used by law fisher-kpp-speed (KPP1: c^2 >= 4 s D) with s=r (batch growth rate), D=Drho=50.2 um2/s (MOESM3.txt), over all 25 MOESM11 rows
rat=[(x['strain'],x['carbon'],x['ind'],x['att'],x['u']/(2*np.sqrt(Drho*x['g']))) for x in R if x['att'] in('Aspartate','Serine')]
mn=min(rat,key=lambda a:a[4]); mx=max(rat,key=lambda a:a[4])
print('\nKPP1 check u/cF over %d Asp/Ser rows: min %.2f (%s), max %.2f (%s); all >=1: %s'%(len(rat),mn[4],mn[:4],mx[4],mx[:4],all(a[4]>=1 for a in rat)))
out['kpp1_min_ratio']=round(float(mn[4]),2); out['kpp1_max_ratio']=round(float(mx[4]),2); out['kpp1_n']=len(rat)
json.dump(out,open(r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/calc_out.json','w'),indent=1)
