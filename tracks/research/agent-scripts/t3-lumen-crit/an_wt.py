# WT-only recomputation + covariate-only look at held-out (filenames and cell counts). No held-out outcome column is read.
import sys,math,json,collections,random,hashlib
sys.path.insert(0,'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t3-lumen-crit')
from xl import read
import numpy as np
from scipy import stats
V="D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-lumen/data/vasquez/Source Data/"
out={}
for f in ["lumen_manuscript_figure6.xlsx","lumen_manuscript_figure2_SF2.xlsx","lumen_manuscript_figure4_SF4.xlsx","lumen_manuscript_figure5_SF5.xlsx"]:
    out["sha256_"+f]=hashlib.sha256(open(V+f,'rb').read()).hexdigest()
d6=read(V+"lumen_manuscript_figure6.xlsx")["Nondimensionalized_data"]; h=d6[0]
R=[dict(zip(h,r)) for r in d6[1:] if r and r[0] is not None]
cond=collections.Counter(r['condition'] for r in R); out['fig6_rows_by_condition']=dict(cond)
# covariates only for held-out
for c in ['Rab11a-GFP','Cldn_qKO']:
    N=[r['num_cell_CS'] for r in R if r['condition']==c]
    Nn=[int(n) for n in N if n is not None]
    out['heldout_cov_'+c]=dict(rows=len(N),withN=len(Nn),N3to10=sum(3<=n<=10 for n in Nn),Nlt3=sum(n<3 for n in Nn),Ngt10=sum(n>10 for n in Nn),maxN=max(Nn))
WT=[r for r in R if r['condition']=='WT']
d2=read(V+"lumen_manuscript_figure2_SF2.xlsx")["cldn-qKO"]; h2=d2[0]
sol={r[0]:r[h2.index('solidity')] for r in d2[1:] if r and r[h2.index('condition')]=='WT'}
# cyst identity (pseudo-replication) check on WT filenames
def cyst(fn): return '_'.join(fn.split('_')[:2])
cy=collections.Counter(cyst(r['filename']) for r in WT)
out['wt_files']=len(WT); out['wt_distinct_cyst_ids_date_idx']=len(cy); out['wt_cyst_ids_with_multiple_rows']=sum(v>1 for v in cy.values()); out['wt_max_rows_one_cyst_id']=max(cy.values())
for c in ['Rab11a-GFP','Cldn_qKO']:
    cc=collections.Counter(cyst(r['filename']) for r in R if r['condition']==c)
    out['cystid_'+c]=dict(rows=sum(cc.values()),distinct=len(cc),multi=sum(v>1 for v in cc.values()))
# identity checks on WT
e1=[];e2=[];e2bad=[]
for r in WT:
    n=r['num_cell_CS']
    if n is None: continue
    A0=(r['area_cyst']-r['area'])/n
    la=r['perimeter']/(n*math.sqrt(A0)); lb=r['perimeter_cyst']/(n*math.sqrt(A0)); a=r['area']/A0
    ipq=4*math.pi*r['area']/r['perimeter']**2; ipqc=4*math.pi*r['area_cyst']/r['perimeter_cyst']**2
    e1.append(abs(ipq-4*math.pi*a/(n*la)**2)); 
    e2.append(abs(a-((n*lb)**2*ipqc/(4*math.pi)-n)))
    e2bad.append(abs(a-((n*lb)**2/(4*math.pi*ipqc)-n)))
    assert abs(la-r['l_a'])<1e-6 and abs(lb-r['nondim_basal_length'])<1e-6 and abs(a-r['normalized_lumen_area'])<1e-6
out['identity1_maxabs_err']=max(e1)
out['identity2_correct_form_(IPQc multiplies)_maxabs_err']=max(e2)
out['identity2_as_written_by_designer_(IPQc divides)_maxabs_err']=max(e2bad); out['identity2_as_written_median_abs_err']=float(np.median(e2bad)); out['n_identity_rows']=len(e1)
# WT data set
D=[]
for r in WT:
    if r['num_cell_CS'] is None: continue
    D.append((int(r['num_cell_CS']),sol[r['filename']],r['l_a'],r['area']))
N=np.array([x[0] for x in D]);S=np.array([x[1] for x in D]);LA=np.array([x[2] for x in D])
out['wt_with_N']=len(D); out['wt_N_lt3']=int((N<3).sum()); out['wt_N3to10']=int(((N>=3)&(N<=10)).sum()); out['wt_Ngt10']=int((N>10).sum()); out['wt_maxN']=int(N.max())
m=(N>=3)&(N<=10); n_,s_=N[m].astype(float),S[m]
out['wt_all_sol_median']=float(np.median(S)); out['wt_all_spearman_la_N']=float(stats.spearmanr(LA,N)[0]); out['wt_all_spearman_sol_N']=float(stats.spearmanr(S,N)[0])
b,a=np.polyfit(n_,s_,1); out['M2_intercept']=float(a); out['M2_slope']=float(b)
rm=lambda e: float(np.sqrt(np.mean(np.square(e))))
out['rmse_const_median_insample']=rm(s_-np.median(s_)); out['rmse_const_mean_insample']=rm(s_-s_.mean()); out['rmse_line_insample']=rm(s_-(a+b*n_))
out['rmse_sphere']=rm(s_-1)
out['n_ceiling_M2']=(1-a)/b
out['sd_sol_wt_3to10']=float(s_.std(ddof=1))
# bootstrap slope CI and 5-fold CV (sorted filename, idx mod 5) -> use sorted by filename
idx=sorted(range(len(D)),key=lambda i:[r for r in WT if r['num_cell_CS'] is not None][i]['filename'])
wtf=[r for r in WT if r['num_cell_CS'] is not None]
fn=[wtf[i]['filename'] for i in range(len(D))]
order=sorted(range(len(D)),key=lambda i:fn[i]); fold={i:k%5 for k,i in enumerate(order)}
ii=np.where(m)[0]
def cv(model):
    e=[]
    for f in range(5):
        tr=[i for i in ii if fold[i]!=f]; te=[i for i in ii if fold[i]==f]
        if model=='const': p=np.median(S[tr])*np.ones(len(te))
        else:
            bb,aa=np.polyfit(N[tr],S[tr],1); p=aa+bb*N[te]
        e+=list(S[te]-p)
    return rm(e)
out['cv5_rmse_const']=cv('const'); out['cv5_rmse_line']=cv('line')
rng=np.random.default_rng(1)
sl=[];
for _ in range(5000):
    j=rng.integers(0,len(n_),len(n_)); sl.append(np.polyfit(n_[j],s_[j],1)[0])
out['slope_boot95']=[float(np.percentile(sl,2.5)),float(np.percentile(sl,97.5))]
r,p=stats.pearsonr(n_,s_); out['pearson_r_sol_N_3to10']=float(r); out['R2_line']=float(r*r); out['p']=float(p)
# nonlinearity: does saturating form fit better? AIC-like via LOO
def loo(fn_):
    e=[]
    for i in range(len(n_)):
        k=np.arange(len(n_))!=i; e.append(s_[i]-fn_(n_[k],s_[k],n_[i]))
    return rm(e)
out['loo_const']=loo(lambda x,y,x0: np.median(y)); out['loo_line']=loo(lambda x,y,x0: np.polyval(np.polyfit(x,y,1),x0))
out['loo_log']=loo(lambda x,y,x0: np.polyval(np.polyfit(np.log(x),y,1),np.log(x0)))
# WT N>10 (WT only), M2 clipped
g=N>10; out['wt_gt10_sol']=sorted(float(x) for x in S[g]); out['wt_gt10_N']=[int(x) for x in N[g]]
pred=np.minimum(1,a+b*N[g]); out['wt_gt10_M2clip_rmse_(WT only, M2 fitted on 3..10)']=rm(S[g]-pred); out['wt_gt10_const_rmse']=rm(S[g]-np.median(s_)); out['wt_gt10_mean_residual_vs_M2']=float(np.mean(S[g]-pred))
# P2 critical values
for n in (51,25,44,22):
    t=stats.t.ppf(0.975,n-2); out['rcrit2sided_n%d'%n]=float(t/math.sqrt(n-2+t*t)); t1=stats.t.ppf(0.95,n-2); out['rcrit1sided_n%d'%n]=float(t1/math.sqrt(n-2+t1*t1))
# P2 power via Fisher z for true rho
def power_rho(rho,n,rc):
    z=np.arctanh(rho); se=1/math.sqrt(n-3); zc=np.arctanh(rc)
    return float(1-stats.norm.cdf((zc-z)/se))
out['P2_power_to_refute']={f"rho{r}_n{n}":power_rho(r,n,rc) for r in (0.2,0.3,0.4,0.5) for n,rc in ((51,0.28),(25,0.40))}
# WT bootstrap CI of rho(l_a,N) n=52
bs=[]
for _ in range(5000):
    j=rng.integers(0,len(N),len(N)); bs.append(stats.spearmanr(LA[j],N[j])[0])
out['wt_rho_la_N_boot95']=[float(np.percentile(bs,2.5)),float(np.percentile(bs,97.5))]
# if N is a noisy count the null rho gets biased; rho(l_a,N) within restricted 3..10
out['wt_rho_la_N_3to10']=float(stats.spearmanr(LA[m],N[m])[0])
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t3-lumen-crit/an_wt.json','w'),indent=1)
print(json.dumps(out,indent=1))
