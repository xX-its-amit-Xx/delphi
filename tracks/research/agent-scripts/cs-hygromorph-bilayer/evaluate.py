"""One command: python evaluate.py   (reads records.csv next to it; no network; stdlib only)"""
import csv,math,itertools,random,statistics as st,os,json
here=os.path.dirname(os.path.abspath(__file__))
R=list(csv.DictReader(open(os.path.join(here,'records.csv'),encoding='utf-8')))
def f(m,n): return 6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m**2+1/(m*n)))
for r in R:
    for k in ('h1_mm','h2_mm','n','n_lo','n_hi','deps','deps_relerr','kappa_per_mm'): r[k]=float(r[k])
    r['kappa_err']=float(r['kappa_err']) if r['kappa_err'] else None
    r['h']=r['h1_mm']+r['h2_mm']; r['m']=r['h1_mm']/r['h2_mm']
    r['pred']=f(r['m'],r['n'])*r['deps']/r['h']
    r['pred_lo']=min(f(r['m'],r['n_lo']),f(r['m'],r['n_hi']))*r['deps']/r['h']
    r['pred_hi']=max(f(r['m'],x) for x in (r['n_lo'],r['n'],r['n_hi'],1/r['m']**2 if r['n_lo']<=1/r['m']**2<=r['n_hi'] else r['n']))*r['deps']/r['h']
    r['dimless']=r['kappa_per_mm']*r['h']/r['deps']      # must be <= 1.5 under the hypothesis set
    ke=r['kappa_err'] or 0.0
    r['dimless_lo']=(r['kappa_per_mm']-ke)*r['h']/(r['deps']*(1+r['deps_relerr']))
dev=[r for r in R if r['split']=='dev']; ho=[r for r in R if r['split']=='holdout']
def medabs(meas,pred): return st.median(abs(math.log10(a/b)) for a,b in zip(meas,pred))
def rmse(meas,pred): return math.sqrt(sum(math.log10(a/b)**2 for a,b in zip(meas,pred))/len(meas))
out={}
ratios=[r['kappa_per_mm']/r['pred'] for r in dev]
med=st.median(ratios); c=1.0 if 0.8<=med<=1.25 else med
out['dev']={'n':len(dev),'median_ratio':med,'min_ratio':min(ratios),'max_ratio':max(ratios),'frozen_c':c,
 'medabs_log10':medabs([r['kappa_per_mm'] for r in dev],[r['pred'] for r in dev]),
 'medabs_log10_with_c':medabs([r['kappa_per_mm'] for r in dev],[c*r['pred'] for r in dev])}
C=math.exp(sum(math.log(r['kappa_per_mm']*r['h']) for r in dev)/len(dev))
def block(S,name):
    meas=[r['kappa_per_mm'] for r in S]
    b={'n':len(S),'papers':len({r['doi'] for r in S}),
       'timoshenko_c1':{'medabs_log10':medabs(meas,[r['pred'] for r in S]),'rmse_log10':rmse(meas,[r['pred'] for r in S])},
       'timoshenko_frozen_c':{'medabs_log10':medabs(meas,[c*r['pred'] for r in S]),'rmse_log10':rmse(meas,[c*r['pred'] for r in S])},
       'baseline1_C_over_h':{'medabs_log10':medabs(meas,[C/r['h'] for r in S]),'rmse_log10':rmse(meas,[C/r['h'] for r in S])},
       'baseline2_ceiling':{'medabs_log10':medabs(meas,[1.5*r['deps']/r['h'] for r in S]),'rmse_log10':rmse(meas,[1.5*r['deps']/r['h'] for r in S])}}
    pred=[r['pred'] for r in S]
    if len(S)<=8: perms=[p for p in itertools.permutations(range(len(S))) if list(p)!=list(range(len(S)))]
    else:
        rng=random.Random(0); perms=[]
        for _ in range(2000):
            p=list(range(len(S))); rng.shuffle(p); perms.append(p)
    sh=[rmse([meas[i] for i in p],pred) for p in perms]
    b['shuffled_labels']={'n_perms':len(perms),'mean_rmse_log10':sum(sh)/len(sh),'frac_perms_worse_than_true':sum(x>b['timoshenko_c1']['rmse_log10'] for x in sh)/len(sh)}
    b['ceiling']={'n_point_estimate_above_1.5':sum(r['dimless']>1.5 for r in S),'n_above_1.5_even_at_lower_error_bound':sum(r['dimless_lo']>1.5 for r in S),'max_dimless':max(r['dimless'] for r in S)}
    out[name]=b
block(dev,'dev_scorer_check'); block(ho,'HOLDOUT_final')
out['baseline_C_mm_free']=C
w=csv.writer(open(os.path.join(here,'results_table.csv'),'w',newline='',encoding='utf-8'))
w.writerow(['id','split','m','n','h_mm','deps','kappa_meas_per_mm','kappa_pred_per_mm','pred_lo','pred_hi','meas_over_pred','kappa_h_over_deps','kappa_h_over_deps_lower_bound'])
for r in R: w.writerow([r['id'],r['split'],round(r['m'],4),r['n'],r['h'],r['deps']]+['%.4g'%x for x in (r['kappa_per_mm'],r['pred'],r['pred_lo'],r['pred_hi'],r['kappa_per_mm']/r['pred'],r['dimless'],r['dimless_lo'])])
json.dump(out,open(os.path.join(here,'results.json'),'w'),indent=1); print(json.dumps(out,indent=1))
