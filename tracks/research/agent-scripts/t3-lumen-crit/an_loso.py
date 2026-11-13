import sys,math,json
sys.path.insert(0,'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t3-lumen-crit')
from xl import read
import numpy as np
from scipy import stats
V="D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-lumen/data/vasquez/Source Data/"
d6=read(V+"lumen_manuscript_figure6.xlsx")["Nondimensionalized_data"]; h=d6[0]
d2=read(V+"lumen_manuscript_figure2_SF2.xlsx")["cldn-qKO"]; h2=d2[0]
sol={r[0]:r[h2.index('solidity')] for r in d2[1:] if r and r[h2.index('condition')]=='WT'}
rows=[(r[h.index('filename')],int(r[h.index('num_cell_CS')])) for r in d6[1:] if r and r[h.index('condition')]=='WT' and r[h.index('num_cell_CS')] is not None]
rows=[(f,n,sol[f]) for f,n in rows if 3<=n<=10]
N=np.array([r[1] for r in rows],float);S=np.array([r[2] for r in rows]);D=np.array([r[0][:6] for r in rows])
out={}
ec=[];el=[]
for d in sorted(set(D)):
    te=D==d;tr=~te
    ec+=list(S[te]-np.median(S[tr])); b,a=np.polyfit(N[tr],S[tr],1); el+=list(S[te]-(a+b*N[te]))
rm=lambda e: float(np.sqrt(np.mean(np.square(e))))
out['leave_session_out_rmse_const']=rm(ec); out['leave_session_out_rmse_line']=rm(el); out['n']=len(ec)
for bsd in (0.04,0.074):
    se=math.sqrt(0.0226**2+bsd**2); out[f'P4_null_false_fail_meanresid_batchsd{bsd}']=float(2*(1-stats.norm.cdf(0.05/se)))
    se3=math.sqrt(0.016**2+bsd**2); out[f'P3_se_of_mean_with_batchsd{bsd}']=se3
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t3-lumen-crit/an_loso.json','w'),indent=1);print(out)
