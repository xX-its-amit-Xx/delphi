"""Re-analysis of Martinez-Ara et al. 2022 (GEO GSE186265) upstream cCRE x promoter reporter matrix.
Question: does the cCRE x promoter activity matrix need more than ONE latent per-cCRE strength passed through
a promoter-specific monotone (saturating/power-law) response?  If one latent + per-promoter monotone curve is
enough, rank order of cCREs is the same on every promoter (up to noise) and 'saturation/responsiveness' explains it.
Everything seeded; output JSON to scratch."""
import pandas as pd, numpy as np, json, sys, itertools
from scipy.stats import spearmanr
from sklearn.isotonic import IsotonicRegression
D="D:/Users/ashenoy00000/delphi-work/data/martinezara-gse186265/GSE186265_Activities_allcombinations_Upstream.tsv.gz"
OUT="D:/Users/ashenoy00000/delphi-work/agents2/scratch/q1-mechanisms/ma_results.json"
EPS=0.02
a=pd.read_csv(D,sep="\t",keep_default_na=False,na_values=[""],low_memory=False)
ep=a[a["class"]=="EP"].copy()
for c in ["activity_br1","activity_br2","activity_br3","activity_all"]:
    ep[c]=np.log10(ep[c].astype(float)+EPS)
def mat(g,col): return g.groupby(["frag1","frag2"])[col].mean().unstack()
res={}
rng=np.random.default_rng(1)

def fit_iso(Y,mask,iters=12,ngrid=50):
    """one latent s_e per row; per-column isotonic (increasing) curve g_p. returns predictor for all cells"""
    n,m=Y.shape
    s=np.nanmean(np.where(mask,Y-np.nanmean(np.where(mask,Y,np.nan),0),np.nan),1); s=np.nan_to_num(s)
    for _ in range(iters):
        curves=[]
        for p in range(m):
            ix=np.where(mask[:,p])[0]
            ir=IsotonicRegression(out_of_bounds="clip",increasing=True).fit(s[ix],Y[ix,p]); curves.append(ir)
        grid=np.quantile(s,np.linspace(0,1,ngrid)); grid=np.unique(grid)
        G=np.stack([c.predict(grid) for c in curves],1)   # grid x m
        for e in range(n):
            ix=np.where(mask[e])[0]
            if len(ix)==0: continue
            err=((G[:,ix]-Y[e,ix])**2).sum(1); s[e]=grid[err.argmin()]
    curves=[]
    for p in range(m):
        ix=np.where(mask[:,p])[0]
        curves.append(IsotonicRegression(out_of_bounds="clip",increasing=True).fit(s[ix],Y[ix,p]))
    return np.stack([c.predict(s) for c in curves],1)

def fit_add(Y,mask,rank=0,iters=40,lam=1.0):
    """y = mu + a_e + b_p + sum_k u_ek v_pk (ALS, ridge on interaction); rank=0 is the additive-in-log (multiplicative) model"""
    n,m=Y.shape; W=mask.astype(float)
    mu=Y[mask].mean(); a=np.zeros(n); b=np.zeros(m)
    U=rng.normal(0,.1,(n,rank)); V=rng.normal(0,.1,(m,rank))
    for _ in range(iters):
        R=Y-mu-U@V.T-b[None]; a=(W*R).sum(1)/np.maximum(W.sum(1),1)
        R=Y-mu-U@V.T-a[:,None]; b=(W*R).sum(0)/np.maximum(W.sum(0),1)
        R=Y-mu-a[:,None]-b[None]
        for k in range(rank):
            Rk=R-sum(np.outer(U[:,j],V[:,j]) for j in range(rank) if j!=k)
            for e in range(n):
                ix=mask[e]; U[e,k]=(Rk[e,ix]*V[ix,k]).sum()/((V[ix,k]**2).sum()+lam) if ix.any() else 0
            for p in range(m):
                ix=mask[:,p]; V[p,k]=(Rk[ix,p]*U[ix,k]).sum()/((U[ix,k]**2).sum()+lam) if ix.any() else 0
    return mu+a[:,None]+b[None]+U@V.T

for loc,g in ep.groupby("locus"):
    Y=mat(g,"activity_all"); R=[mat(g,f"activity_br{i}").reindex_like(Y) for i in (1,2,3)]
    keep_r=Y.notna().sum(1)>=8; keep_c=Y.notna().sum(0)>=20
    Y=Y.loc[keep_r,keep_c]; R=[r.loc[Y.index,Y.columns] for r in R]
    M=Y.notna().values; Yv=Y.values; n,m=Yv.shape
    # --- noise: replicate variance of the 3-replicate mean (log scale)
    stack=np.stack([r.values for r in R],0); rv=np.nanvar(stack,0,ddof=1); noise=np.nanmean(rv[M])/3
    tot=np.nanvar(Yv[M]); ceil=1-noise/tot
    # --- (A) rank agreement between promoters, disattenuated by within-promoter replicate reliability
    rho_obs=[];rho_dis=[]
    for p,q in itertools.combinations(range(m),2):
        ok=M[:,p]&M[:,q]
        if ok.sum()<25: continue
        def rr(i,j,col): return spearmanr(R[i].values[ok,col],R[j].values[ok,col])[0]
        selfp=np.mean([rr(i,j,p) for i,j in ((0,1),(0,2),(1,2))]); selfq=np.mean([rr(i,j,q) for i,j in ((0,1),(0,2),(1,2))])
        cross=np.mean([spearmanr(R[i].values[ok,p],R[j].values[ok,q])[0] for i,j in ((0,1),(1,0),(0,2),(2,0),(1,2),(2,1))])
        if selfp>0.2 and selfq>0.2:
            rho_obs.append(cross); rho_dis.append(cross/np.sqrt(selfp*selfq))
    # --- (B) 5-fold CV on cells
    idx=np.argwhere(M); rng.shuffle(idx); folds=np.array_split(idx,5)
    names={"additive_log(multiplicative)":lambda Yt,Mt:fit_add(Yt,Mt,0),
           "rank1_latent+per-promoter_monotone":lambda Yt,Mt:fit_iso(Yt,Mt),
           "additive+rank1_interaction":lambda Yt,Mt:fit_add(Yt,Mt,1),
           "additive+rank2_interaction":lambda Yt,Mt:fit_add(Yt,Mt,2)}
    sse={k:0.0 for k in names}; N=0
    for f in folds:
        Mt=M.copy(); Mt[f[:,0],f[:,1]]=False
        Yt=np.where(Mt,Yv,0.0)
        for k,fn in names.items():
            P=fn(Yt,Mt); sse[k]+=((P[f[:,0],f[:,1]]-Yv[f[:,0],f[:,1]])**2).sum()
        N+=len(f)
    cv={k:float(1-(v/N)/tot) for k,v in sse.items()}
    res[loc]=dict(n_cCRE=n,n_promoters=m,cells=int(M.sum()),total_var_log10=float(tot),noise_var_mean3=float(noise),
        R2_ceiling_from_replicates=float(ceil),cv_R2=cv,n_promoter_pairs=len(rho_obs),
        spearman_between_promoters_observed_median=float(np.median(rho_obs)),spearman_disattenuated_median=float(np.median(rho_dis)),
        spearman_disattenuated_q10=float(np.quantile(rho_dis,.1)),spearman_disattenuated_q90=float(np.quantile(rho_dis,.9)))
    print(loc,json.dumps(res[loc],indent=1)); sys.stdout.flush()
json.dump(res,open(OUT,"w"),indent=1)
