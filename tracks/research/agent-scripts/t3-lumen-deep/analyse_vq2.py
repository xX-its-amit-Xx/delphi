"""Size-matched checks on Vasquez 2021 source data: ddAVP and Rab11a effects once lumen size is controlled."""
import pandas as pd,numpy as np
from scipy import stats
D='D:/Users/ashenoy00000/delphi-work/data/vasquez2021/x/Source Data/'
o=pd.read_excel(D+'lumen_manuscript_figure2_SF2.xlsx',sheet_name='ouabain_ddAVP')
d3=o[o.day==3]
print(d3.groupby('condition')[['lumen_solidity','norm_r','lumen_ipq']].describe().T.round(3).to_string())
def ols(df,y,x,grp,ref):
    X=np.column_stack([np.ones(len(df)),df[x],(df[grp]!=ref).astype(float)]); b,res,_,_=np.linalg.lstsq(X,df[y].values,rcond=None)
    r=df[y].values-X@b; s2=r@r/(len(df)-3); cov=s2*np.linalg.inv(X.T@X); se=np.sqrt(np.diag(cov)); t=b[2]/se[2]
    return b[2],se[2],2*stats.t.sf(abs(t),len(df)-3)
for day in (3,7):
    for c in ('ddAVP','ouabain'):
        g=o[(o.day==day)&(o.condition.isin(['ctl',c]))].dropna(subset=['lumen_solidity','norm_r'])
        print('day',day,c,'vs ctl, solidity ~ norm_r + treated: effect %.3f se %.3f p=%.3g n=%d'%(*ols(g,'lumen_solidity','norm_r','condition','ctl'),len(g)))
r=pd.read_excel(D+'lumen_manuscript_figure4_SF4.xlsx',sheet_name='Crb_KIBRA_Rab11a')
g=r[r.condition.isin(['WT','Rab11a-GFP'])].dropna(subset=['solidity','norm_radius'])
print('Rab11a vs WT, solidity ~ norm_radius + Rab11a: effect %.3f se %.3f p=%.3g n=%d'%(*ols(g,'solidity','norm_radius','condition','WT'),len(g)))
print('norm_radius medians', g.groupby('condition').norm_radius.median().round(3).to_dict())
f6=pd.read_excel(D+'lumen_manuscript_figure6.xlsx',sheet_name='Nondimensionalized_data')
q=pd.read_excel(D+'lumen_manuscript_figure2_SF2.xlsx',sheet_name='cldn-qKO')
print('Spearman l_a vs num_cell by condition:',{c:(round(stats.spearmanr(h.l_a,h.num_cell_CS)[0],2),len(h)) for c,h in f6.dropna(subset=['l_a','num_cell_CS']).groupby('condition')})
