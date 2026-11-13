# WT-only batch effect + power simulations + scalloped polygon recompute. Held-out outcomes not read.
import sys,math,json,collections
sys.path.insert(0,'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t3-lumen-crit')
from xl import read
import numpy as np
from scipy import stats,optimize
V="D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-lumen/data/vasquez/Source Data/"
out={}
d6=read(V+"lumen_manuscript_figure6.xlsx")["Nondimensionalized_data"]; h=d6[0]
d2=read(V+"lumen_manuscript_figure2_SF2.xlsx")["cldn-qKO"]; h2=d2[0]
sol={r[0]:r[h2.index('solidity')] for r in d2[1:] if r and r[h2.index('condition')]=='WT'}
rows=[(r[h.index('filename')],int(r[h.index('num_cell_CS')])) for r in d6[1:] if r and r[h.index('condition')]=='WT' and r[h.index('num_cell_CS')] is not None]
rows=[(f,n,sol[f]) for f,n in rows if 3<=n<=10]
N=np.array([r[1] for r in rows],float);S=np.array([r[2] for r in rows]);date=[r[0][:6] for r in rows]
b,a=np.polyfit(N,S,1); res=S-(a+b*N)
g=collections.defaultdict(list)
for d,e in zip(date,res): g[d].append(e)
out['wt_sessions']={k:(len(v),round(float(np.mean(v)),4)) for k,v in g.items()}
F=stats.f_oneway(*[v for v in g.values() if len(v)>0]); out['wt_residual_anova_by_date']=dict(F=float(F.statistic),p=float(F.pvalue),k=len(g))
# between-session SD of mean residual vs within
means=np.array([np.mean(v) for v in g.values()]); out['wt_between_session_sd_of_mean_resid']=float(means.std(ddof=1)); out['wt_resid_sd']=float(res.std(ddof=1))
# ICC (one-way) approx
k=len(g); n=len(res); grand=res.mean()
ssb=sum(len(v)*(np.mean(v)-grand)**2 for v in g.values()); ssw=sum(((np.array(v)-np.mean(v))**2).sum() for v in g.values())
msb=ssb/(k-1); msw=ssw/(n-k); n0=(n-sum(len(v)**2 for v in g.values())/n)/(k-1)
out['wt_icc_date']=float((msb-msw)/(msb+(n0-1)*msw))
# --- power sims. Residual pool = WT residuals from M2 (SD ~0.106). Held-out genotype assumed = M2 + delta + resid.
rng=np.random.default_rng(7); pool=res
sd=float(np.sqrt((res**2).sum()/(len(res)-2)))
out['wt_resid_sd_dof2']=sd
# P4 M2 mean residual criterion: +-0.05 and RMSE<=0.16, n=22
def p4(delta,n=22,sims=20000,batch_sd=0.0):
    fail_mean=fail_rmse=fail_any=0
    for _ in range(sims):
        e=rng.choice(pool,n)+delta+rng.normal(0,batch_sd)
        fm=abs(e.mean())>0.05; fr=math.sqrt((e**2).mean())>0.16
        fail_mean+=fm;fail_rmse+=fr;fail_any+=(fm or fr)
    return dict(fail_mean=fail_mean/sims,fail_rmse=fail_rmse/sims,fail_any=fail_any/sims)
out['P4_M2_refute_prob']={f"delta{d}_batchsd{bs}":p4(d,batch_sd=bs) for d in (0,0.03,0.05,0.08,0.12) for bs in (0,0.04)}
# batch SD 0.04: roughly what a between-session difference of means would add (reported, WT sessions see above)
# TOST equivalence power at +-0.05 vs +-0.07, n=22, sd .106 (alpha .05 each side)
def tost_power(delta,margin,n,sd_,sims=20000):
    ok=0
    for _ in range(sims):
        x=rng.normal(delta,sd_,n); m=x.mean(); se=x.std(ddof=1)/math.sqrt(n); t=stats.t.ppf(0.95,n-1)
        ok+=(m-margin>-0 and False) or ((m+margin)/se>t and (margin-m)/se>t)
    return ok/sims
out['TOST_power_n22']={f"margin{mg}_true0":tost_power(0,mg,22,0.106) for mg in (0.05,0.07,0.09,0.12)}
out['TOST_halfwidth90_n22']=float(stats.t.ppf(0.95,21)*0.106/math.sqrt(22))
out['TOST_halfwidth90_n44']=float(stats.t.ppf(0.95,43)*0.106/math.sqrt(44))
out['SE_mean_n22']=0.106/math.sqrt(22); out['SE_mean_n44']=0.106/math.sqrt(44)
# P3: truth = M2 + delta + resid(sd). M3 predicts M2 + delta + err (err~N(0,s)); also M3 may include per-lumen skill? no (N and mean l_a only).
def p3(delta,s,n=44,sims=3000,B=500):
    ss_pos=boot_ok=resid_ok=all_ok=0
    for _ in range(sims):
        e=rng.choice(pool,n)+delta   # obs - M2
        err=rng.normal(0,s)           # genotype-level error of M3 shift (scalar, since only N and mean la go in)
        # M3 prediction minus M2 = delta + err (+ small N-dependent term ignored)
        mse2=(e**2).mean(); mse3=((e-(delta+err))**2).mean(); ss=1-mse3/mse2
        ok_ss=ss>0; ok_res=e.mean()<-0.03
        if ok_ss:
            bs=[]
            for _b in range(B):
                j=rng.integers(0,n,n); ee=e[j]; bs.append(1-((ee-(delta+err))**2).mean()/(ee**2).mean())
            ok_b=np.percentile(bs,5)>0
        else: ok_b=False
        ss_pos+=ok_ss; boot_ok+=ok_b; resid_ok+=ok_res; all_ok+=(ok_b and ok_res)
    return dict(P_SSpositive=ss_pos/sims,P_bootstrap5pct_positive=boot_ok/sims,P_mean_resid_below_minus003=resid_ok/sims,P_full_support=all_ok/sims)
out['P3_power']={}
for d in (-0.03,-0.05,-0.08):
    for s in (0.0,0.03,0.06):
        out['P3_power'][f"delta{d}_modelerr{s}"]=p3(d,s,sims=1500,B=300)
# max attainable SS with a perfect genotype-shift model
for d in (-0.03,-0.05,-0.08): out[f'P3_max_SS_perfect_shift_delta{d}']=float(d*d/(d*d+sd**2))
# P5 : nothing to sim; report n and se of RMSE
out['P5_rmse_se_rule_n15']=0.12/math.sqrt(2*15)
# P1 gate: SD of CV RMSE for n=43 under normality and pass prob if true RMSE = x
for true in (0.106,0.115,0.124,0.140):
    se=true/math.sqrt(2*43); out[f'P1_pass_prob_trueRMSE{true}']=float(stats.norm.cdf((0.124-true)/se))
# scalloped polygon
def phi_of(slack):
    return optimize.brentq(lambda p:p/math.sin(p)-slack,1e-6,math.pi-1e-6)
def S_poly(N,slack):
    p=phi_of(slack); return 1-math.tan(math.pi/N)*(p-math.sin(p)*math.cos(p))/math.sin(p)**2,p,math.pi/2-math.pi/N
out['scallop']={f"N{n}_slack{s}":[round(S_poly(n,s)[0],4),round(S_poly(n,s)[1],4),round(S_poly(n,s)[2],4)] for n,s in ((6,1.02),(6,1.05),(6,1.10),(10,1.05),(4,1.05),(4,1.02),(4,1.10))}
# numerical check of the scalloped formula by polygon area integration
def numeric(N,slack,M=20000):
    p=phi_of(slack); R=1/(2*math.sin(p))  # chord=1
    # regular N-gon side 1: circumradius Rc=1/(2 sin(pi/N)); vertices
    Rc=1/(2*math.sin(math.pi/N)); apo=Rc*math.cos(math.pi/N)
    # segment area removed per side: R^2(p - sin p cos p)
    seg=R*R*(p-math.sin(p)*math.cos(p)); poly=N*apo*0.5*1
    # verify by sampling the arc as polygon: sagitta
    sag=R*(1-math.cos(p)); 
    pts=[]
    for k in range(N):
        a0=2*math.pi*k/N; a1=2*math.pi*(k+1)/N
        v0=np.array([Rc*math.cos(a0),Rc*math.sin(a0)]); v1=np.array([Rc*math.cos(a1),Rc*math.sin(a1)])
        mid=(v0+v1)/2; nrm=-mid/np.linalg.norm(mid)  # inward
        c=mid+nrm*(R*math.cos(p))*-1*-1  # centre of arc circle lies outside polygon: mid - nrm*(R cos p)
        c=mid-nrm*R*math.cos(p)
        a_s=math.atan2(*(v0-c)[::-1]); a_e=math.atan2(*(v1-c)[::-1])
        # choose the short arc passing through the point nearest the polygon centre
        da=(a_e-a_s+math.pi)%(2*math.pi)-math.pi
        for t in np.linspace(0,1,M//N,endpoint=False):
            ang=a_s+da*t; pts.append(c+R*np.array([math.cos(ang),math.sin(ang)]))
    P=np.array(pts); x,y=P[:,0],P[:,1]; A=0.5*abs(np.dot(x,np.roll(y,-1))-np.dot(y,np.roll(x,-1)))
    perim=0
    return A/poly, 1.0 and (poly-A)/seg/N
out['scallop_numeric_check_N6_slack1.05(area ratio, segs ratio)']=numeric(6,1.05)
# arc/chord of lumen vs data: median wall slack implied? l_a ~ 0.73 vs ideal polygon with equal-area cells (sqrt(A0)=1): not computed
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t3-lumen-crit/an_power.json','w'),indent=1)
print(json.dumps(out,indent=1))
