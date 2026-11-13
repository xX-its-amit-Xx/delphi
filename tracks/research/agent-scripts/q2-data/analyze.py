"""Q2 analysis on ChEMBL pChEMBL data (Ki and IC50 separately). Outputs results_<type>.json + prints.
Definitions (all pChEMBL = -log10 molar):
 (1) noise: for each (molecule,target) with >=2 measurements from DIFFERENT documents, pooled within-pair SD
     s_w = sqrt( sum_g sum_i (y-ybar_g)^2 / sum_g (n_g-1) ); also same-document (intra-lab) version using assay-level dups.
     Bootstrap CI over pairs.
 (2) variance decomposition on per-(molecule,target) mean values: ANOVA between/within target; eta^2.
 (3) target-mean-only predictor r (in-sample, and leave-one-compound-out ~ nearly same), and within-target mean Spearman reference.
 (4) attenuation bound r_max = sqrt(var_true/(var_true+var_noise)) with var_true = var_total_of_single_measurements - noise var.
"""
import json, glob, sys, numpy as np, collections
rng = np.random.default_rng(20261112)
D="D:/Users/ashenoy00000/delphi-work/data/chembl-q2"
ty=sys.argv[1]
rows=[]
for f in sorted(glob.glob(f"{D}/{ty}_*.json")): rows+=json.load(open(f))
rows=[r for r in rows if r["standard_type"]==ty and r["standard_relation"]=="=" and r["pchembl_value"] and not r["data_validity_comment"] and r["potential_duplicate"] in (0,None) and r["assay_type"]=="B"]
# human only to avoid species mixing within target id? keep target-id as is.
pairs=collections.defaultdict(list)
for r in rows: pairs[(r["molecule_chembl_id"],r["target_chembl_id"])].append((float(r["pchembl_value"]),r["document_chembl_id"],r["assay_chembl_id"]))
print(ty,"rows",len(rows),"pairs",len(pairs),"targets",len({k[1] for k in pairs}))
def pooled_sd(groups):
    ss=sum(((g-g.mean())**2).sum() for g in groups); df=sum(len(g)-1 for g in groups)
    return np.sqrt(ss/df), df
def boot(groups, B=2000):
    n=len(groups); out=[]
    for _ in range(B):
        idx=rng.integers(0,n,n); out.append(pooled_sd([groups[i] for i in idx])[0])
    return np.percentile(out,[2.5,97.5])
res={"type":ty,"n_rows":len(rows),"n_pairs":len(pairs),"n_targets":len({k[1] for k in pairs})}
# (1a) inter-document replicates: one value per document (mean within doc), pairs with >=2 documents
inter=[]; intra=[]
for k,v in pairs.items():
    bydoc=collections.defaultdict(list)
    for y,d,a in v: bydoc[d].append(y)
    if len(bydoc)>=2: inter.append(np.array([np.mean(x) for x in bydoc.values()]))
    byas=collections.defaultdict(list)
    for y,d,a in v: byas[(d,a)].append(y)
    for x in byas.values():
        if len(x)>=2: intra.append(np.array(x))
for name,g in (("inter_document",inter),("intra_assay",intra)):
    if len(g)>5:
        s,df=pooled_sd(g); ci=boot(g)
        res[name]={"n_groups":len(g),"df":int(df),"sd":float(s),"ci95":[float(ci[0]),float(ci[1])]}
        # robust: MAD-based on pairwise diffs for 2-doc groups
        d2=np.array([x[0]-x[1] for x in g if len(x)==2])
        if len(d2): res[name]["robust_sd_MAD"]=float(1.4826*np.median(np.abs(d2-np.median(d2)))/np.sqrt(2)); res[name]["n_pairs_2"]=int(len(d2)); res[name]["frac_abs_diff_gt_1"]=float(np.mean(np.abs(d2)>1.0)); res[name]["median_abs_diff"]=float(np.median(np.abs(d2)))
        print(name,res[name])
# robust (MAD) inter-document SD with bootstrap CI, treated as an alternative noise estimate
_d=np.array([x[0]-x[1] for x in inter if len(x)==2])
_rob=lambda d: 1.4826*np.median(np.abs(d-np.median(d)))/np.sqrt(2)
_b=[_rob(_d[rng.integers(0,len(_d),len(_d))]) for _ in range(2000)]
res["inter_document_robust"]={"sd":float(_rob(_d)),"ci95":[float(x) for x in np.percentile(_b,[2.5,97.5])],"n_groups":int(len(_d))}
# per-pair mean dataset (de-duplicated): one mean per (mol,target)
keys=list(pairs); y=np.array([np.mean([a for a,_,_ in pairs[k]]) for k in keys]); tgt=np.array([k[1] for k in keys])
mol=np.array([k[0] for k in keys])
# restrict to targets with >=50 compounds
cnt=collections.Counter(tgt); keep=np.array([cnt[t]>=50 for t in tgt]); y,tgt,mol=y[keep],tgt[keep],mol[keep]
ut=sorted(set(tgt)); res["n_targets_ge50"]=len(ut); res["n_pairs_ge50"]=int(len(y))
def decomp(y,tgt):
    ut=sorted(set(tgt)); gm=y.mean(); N=len(y)
    ssb=sum(((y[tgt==t].mean()-gm)**2)*(tgt==t).sum() for t in ut); ssw=sum(((y[tgt==t]-y[tgt==t].mean())**2).sum() for t in ut)
    sst=ssb+ssw
    return ssb/sst, ssb/N, ssw/N, sst/N   # eta2 (between share), plain pop. variances
eta2,vb,vw,vt=decomp(y,tgt)
# bootstrap over compounds (resample rows)
bs=[]
for _ in range(1000):
    i=rng.integers(0,len(y),len(y)); bs.append(decomp(y[i],tgt[i])[0])
res["decomp"]={"var_total":float(vt),"var_between_target":float(vb),"var_within_target":float(vw),"eta2_between":float(eta2),"eta2_ci95":[float(x) for x in np.percentile(bs,[2.5,97.5])]}
print("decomp",res["decomp"])
# (3) target-mean-only predictor: r between y and target mean (leave-one-out mean to avoid in-sample inflation)
sums={t:y[tgt==t].sum() for t in ut}; ns={t:(tgt==t).sum() for t in ut}
loo=np.array([(sums[t]-yy)/(ns[t]-1) for yy,t in zip(y,tgt)])
r_loo=np.corrcoef(y,loo)[0,1]; r_in=np.sqrt(eta2)
bs=[]
for _ in range(1000):
    i=rng.integers(0,len(y),len(y)); bs.append(np.corrcoef(y[i],loo[i])[0,1])
res["target_mean_predictor"]={"r_in_sample_sqrt_eta2":float(r_in),"r_LOO":float(r_loo),"r_LOO_ci95":[float(x) for x in np.percentile(bs,[2.5,97.5])]}
print(res["target_mean_predictor"])
# within-target: a predictor with ZERO within-target skill has within-target r=0. Per-target ceiling given noise below.
# (4) attenuation bound. Noise var from inter-document SD (conservative, realistic) and intra-assay SD.
# single-measurement total var: use measurement-level rows in kept targets
ytot=np.array([float(r["pchembl_value"]) for r in rows if r["target_chembl_id"] in set(ut)])
vtot=ytot.var(); res["var_single_measurement_total"]=float(vtot)
# within-target var of single measurements
wt=np.mean([ (ytot[np.array([r["target_chembl_id"] for r in rows if r["target_chembl_id"] in set(ut)])==t]).var() for t in ut]) if False else None
rows_k=[r for r in rows if r["target_chembl_id"] in set(ut)]
yk=np.array([float(r["pchembl_value"]) for r in rows_k]); tk=np.array([r["target_chembl_id"] for r in rows_k])
vw_single=sum(((yk[tk==t]-yk[tk==t].mean())**2).sum() for t in ut)/len(yk)
res["var_within_target_single_measurement"]=float(vw_single)
bound={}
for name in ("inter_document","inter_document_robust","intra_assay"):
    if name in res:
        s=res[name]["sd"]; lo,hi=res[name]["ci95"]
        def rm(var,sd): 
            vt_=max(var-sd**2,1e-9); return float(np.sqrt(vt_/(vt_+sd**2)))
        # reference measurement is a single measurement => observed var = true+noise; so bound = sqrt(1 - noise/obs)
        f=lambda var,sd: float(np.sqrt(max(1-sd**2/var,0)))
        bound[name]={"pooled_r_max":f(vtot,s),"pooled_r_max_ci95":[f(vtot,hi),f(vtot,lo)],
                     "within_target_r_max":f(vw_single,s),"within_target_r_max_ci95":[f(vw_single,hi),f(vw_single,lo)]}
        # same, via the formula sqrt(var_true/(var_true+var_noise)) with var_true=obs-noise
        vtrue=vtot-s**2; bound[name]["check_formula_pooled"]=float(np.sqrt(vtrue/(vtrue+s**2)))
res["attenuation_bound"]=bound; print(bound)
# Spearman bound within target via simulation: true ~ N(0,var_true_w), obs = true+N(0,sd^2)
from scipy.stats import spearmanr
sim={}
for name in bound:
    s=res[name]["sd"]; vtw=max(vw_single-s**2,1e-6); n=200000
    t_=rng.normal(0,np.sqrt(vtw),n); o=t_+rng.normal(0,s,n); sim[name]=float(spearmanr(t_,o)[0])
res["within_target_spearman_ceiling_sim"]=sim; print(sim)
# per-target within var summary
res["per_target"]=[{"target":t,"name":next(r["target_pref_name"] for r in rows_k if r["target_chembl_id"]==t),"n_pairs":int(ns[t]),"mean":float(y[tgt==t].mean()),"sd":float(y[tgt==t].std())} for t in ut]
json.dump(res,open(f"D:/Users/ashenoy00000/delphi-work/agents2/scratch/q2-data/results_{ty}.json","w"),indent=1)
