"""Predicted outcomes of the proposed discriminating experiment (enhancer copy-number titration, 2 promoters, 3 replicates).
Model S: ONE latent strength per enhancer, promoter-specific saturating Hill response (rank-preserving by theorem Q1.no_reversal).
Model C: TWO latent strengths; promoter A reads z1, promoter B reads cos(dth)*z1+sin(dth)*z2 (rank-changing).
Statistic: replicate-disattenuated Spearman  rho_dis = mean cross-promoter rho between different replicates /
           sqrt(mean within-promoter replicate rho(A) * mean within-promoter replicate rho(B)).  Same estimator as analyze_ma.py.
Seeded; writes JSON + prints table."""
import numpy as np, json
from scipy.stats import spearmanr
rng=np.random.default_rng(20261112)
import sys
NE=int(sys.argv[1]) if len(sys.argv)>1 else 48; DOSES=[1,2,4,8]; LOG_X0=-0.7; NREP=int(sys.argv[2]) if len(sys.argv)>2 else 1000; NREPL=3
SD_LAT=0.5          # log10 sd of enhancer strength across the library (assumption; real total variance 0.33-0.53 log10^2, scratch ma_results.json)
NOISE_MEAN3=0.10    # log10 sd of a 3-replicate mean (data: sqrt(0.0078..0.0233)=0.088..0.153) -> per-replicate sd = NOISE_MEAN3*sqrt(3)
NOISE=NOISE_MEAN3*np.sqrt(3)
def hill(x,b,V,K,n): return b+(V-b)*x**n/(K**n+x**n)
A=dict(b=1.0,V=100.0,K=10**1.5,n=1.0)   # developmental-like: low basal, 100x headroom, stays in linear range
B=dict(b=30.0,V=300.0,K=1.0,n=1.0)      # housekeeping-like: high basal, 10x headroom, approaches ceiling at high dose
def rho(x,y): return spearmanr(x,y)[0]
def run(model,deg=0):
    dth=np.deg2rad(deg); acc={d:{"raw":[],"dis":[],"occB":[],"occA":[]} for d in DOSES}
    for _ in range(NREP):
        z1=rng.normal(0,SD_LAT,NE); z2=rng.normal(0,SD_LAT,NE)
        for d in DOSES:
            ld=np.log10(d)+LOG_X0; xa=10**(z1+ld)
            xb=xa if model=="S" else 10**(np.cos(dth)*z1+np.sin(dth)*z2+ld)
            ta=np.log10(hill(xa,**A)); tb=np.log10(hill(xb,**B))
            ya=[ta+rng.normal(0,NOISE,NE) for _ in range(NREPL)]; yb=[tb+rng.normal(0,NOISE,NE) for _ in range(NREPL)]
            pairs=[(i,j) for i in range(NREPL) for j in range(NREPL) if i!=j]; ip=[(0,1),(0,2),(1,2)]
            cross=np.mean([rho(ya[i],yb[j]) for i,j in pairs])
            sa=np.mean([rho(ya[i],ya[j]) for i,j in ip]); sb=np.mean([rho(yb[i],yb[j]) for i,j in ip])
            acc[d]["raw"].append(rho(np.mean(ya,0),np.mean(yb,0)))
            acc[d]["dis"].append(cross/np.sqrt(max(sa,1e-6)*max(sb,1e-6)))
            acc[d]["occB"].append(np.mean((hill(xb,**B)-B['b'])/(B['V']-B['b']))); acc[d]["occA"].append(np.mean((hill(xa,**A)-A['b'])/(A['V']-A['b'])))
    return {d:{"rho_raw_mean3":[float(np.mean(a["raw"])),float(np.quantile(a["raw"],.025)),float(np.quantile(a["raw"],.975))],
               "rho_disattenuated":[float(np.mean(a["dis"])),float(np.quantile(a["dis"],.025)),float(np.quantile(a["dis"],.975))],
               "occupancy_A":float(np.mean(a["occA"])),"occupancy_B":float(np.mean(a["occB"]))} for d,a in acc.items()}
res={"params":dict(NE=NE,doses=DOSES,SD_LAT=SD_LAT,LOG_X0=LOG_X0,NOISE_PER_REPLICATE=float(NOISE),NOISE_MEAN3=NOISE_MEAN3,A=A,B=B,NREP=NREP,replicates=NREPL,seed=20261112)}
res["S_saturation_only"]=run("S")
for deg in (34,53): res[f"C_two_latent_{deg}deg"]=run("C",deg)
json.dump(res,open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/q1-mechanisms/sim_results_NE"+str(NE)+".json","w"),indent=1)
for k,v in res.items():
    if k=="params": continue
    print(k)
    for d,r in v.items(): print(f"  copies {d}x  raw rho={r['rho_raw_mean3'][0]:.2f} [{r['rho_raw_mean3'][1]:.2f},{r['rho_raw_mean3'][2]:.2f}]  disatt rho={r['rho_disattenuated'][0]:.2f} [{r['rho_disattenuated'][1]:.2f},{r['rho_disattenuated'][2]:.2f}]  occA={r['occupancy_A']:.2f} occB={r['occupancy_B']:.2f}")
