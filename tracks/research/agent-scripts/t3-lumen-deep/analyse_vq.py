"""Recompute headline numbers from Vasquez et al. 2021 Source Data (MOESM6.zip, extracted to data/vasquez2021/x). Run: python -X utf8 -P analyse_vq.py"""
import pandas as pd,numpy as np
from scipy import stats
D='D:/Users/ashenoy00000/delphi-work/data/vasquez2021/x/Source Data/'
def sh(f,s): return pd.read_excel(D+f,sheet_name=s)
f1=sh('lumen_manuscript_figure1_SF1.xlsx','lumen_shape')
print('FIG1 lumen_shape n=',len(f1))
print(' sphericity lumen: median %.3f min %.3f max %.3f'%(f1.spher_lumen.median(),f1.spher_lumen.min(),f1.spher_lumen.max()))
print(' sphericity cyst (basal): median %.3f min %.3f'%(f1.spher_cyst.median(),f1.spher_cyst.min()))
print(' frac concave lumen: min %.3f max %.3f median %.3f ; cyst median %.4f'%(f1.frac_neg_lumen.min(),f1.frac_neg_lumen.max(),f1.frac_neg_lumen.median(),f1.frac_neg_cyst.median()))
print(' cell_num range',f1.cell_num.min(),f1.cell_num.max())
print(' SA_per_cell: mean %.1f CV %.2f ; Pearson r(SA_lumen, cell_num)=%.2f ; Spearman %.2f'%(f1.SA_per_cell.mean(),f1.SA_per_cell.std()/f1.SA_per_cell.mean(),*[np.corrcoef(f1.SA_lumen,f1.cell_num)[0,1],stats.spearmanr(f1.SA_lumen,f1.cell_num)[0]]))
psi=np.pi**(1/3)*(6*f1.vol_lumen)**(2/3)/f1.SA_lumen
print(' recomputed psi vs file: max abs diff %.4f'%np.abs(psi-f1.spher_lumen).max())
big=f1[f1.r_lumen_v>=9]; print(' lumens with r>=9um: n=%d median psi %.3f; r<9: n=%d median psi %.3f'%(len(big),big.spher_lumen.median(),len(f1)-len(big),f1[f1.r_lumen_v<9].spher_lumen.median()))
q=sh('lumen_manuscript_figure2_SF2.xlsx','cldn-qKO')
print('FIG2 cldn-qKO sheet:'); 
for c,g in q.groupby('condition'): print('  ',c,'n=%d solidity median %.3f IQR %.3f-%.3f'%(len(g),g.solidity.median(),g.solidity.quantile(.25),g.solidity.quantile(.75)))
a=q[q.condition.str.contains('WT',case=False)].solidity; b=q[~q.condition.str.contains('WT',case=False)].solidity
print('   MWU WT vs qKO p=%.3f'%stats.mannwhitneyu(a,b).pvalue)
o=sh('lumen_manuscript_figure2_SF2.xlsx','ouabain_ddAVP')
for (d,c),g in o.groupby(['day','condition']): print('  ouab/ddAVP day',d,c,'n=%d solidity median %.3f'%(len(g),g.lumen_solidity.median()))
r=sh('lumen_manuscript_figure4_SF4.xlsx','Crb_KIBRA_Rab11a')
print('FIG4:'); 
for c,g in r.groupby('condition'): print('  ',c,'n=%d solidity median %.3f'%(len(g),g.solidity.median()))
w=r[r.condition.str.contains('WT',case=False)].solidity; rb=r[r.condition.str.contains('Rab',case=False)].solidity
print('   MWU WT vs Rab11a p=%.4g'%stats.mannwhitneyu(w,rb).pvalue)
f6=sh('lumen_manuscript_figure6.xlsx','Nondimensionalized_data')
print('FIG6 (nondimensionalised) n=',len(f6))
for c,g in f6.groupby('condition'): print('  ',c,'n=%d l_a mean %.3f median %.3f ; basal length median %.2f ; num_cell median %s'%(len(g),g.l_a.mean(),g.l_a.median(),g.nondim_basal_length.median(),g.num_cell_CS.median()))
sw=sh('lumen_manuscript_figure5_SF5.xlsx','20210601_all_vertex_model_simul')
print('FIG5 sweep rows',len(sw)); 
for c in ['n_cells','l_a','l_l','l_b','P','k']: print('  ',c,sorted(sw[c].dropna().unique())[:8],'... n unique',sw[c].nunique())
# Laplace consequences (own arithmetic)
print('LAPLACE: sphere P=2T/R -> R=2T/P')
for T in (0.1e-3,1e-3,2e-3):
    for P in (65.,):
        print('  T=%.1f mN/m P=%d Pa -> R=%.1f um'%(T*1e3,P,2*T/P*1e6))
