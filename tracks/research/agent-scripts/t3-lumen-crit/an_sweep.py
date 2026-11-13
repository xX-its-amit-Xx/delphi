import sys,math,json,collections
sys.path.insert(0,'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t3-lumen-crit')
from xl import read
import numpy as np
V="D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-lumen/data/vasquez/Source Data/"
rows=list(read(V+"lumen_manuscript_figure5_SF5.xlsx").values())[0]; h=rows[0]; print(h)
S=[dict(zip(h,r)) for r in rows[1:]]
keys=['l_a','l_l','l_b','P','k']
print(keys)
g=collections.defaultdict(lambda:collections.defaultdict(list))
bad=0
for r in S:
    if r['lumen_area']<=0 or not(0<r['lumen_solidity']<=1.0001): bad+=1; continue
    g[tuple(r[k] for k in keys)][int(r['n_cells'])].append(r['lumen_solidity'])
print('bad rows',bad,'settings',len(g))
line=lambda n:0.67027+0.026082*n
res=[]
for k,v in g.items():
    if all(n in v for n in range(3,11)):
        m=[np.mean(v[n]) for n in range(3,11)]
        res.append((math.sqrt(np.mean([(m[i]-line(n))**2 for i,n in enumerate(range(3,11))])),k,[round(x,3) for x in m]))
res.sort(key=lambda t:t[0])
print(len(res),'settings with N=3..10; best RMSE of N-mean curve vs WT line:')
for r in res[:5]: print(r)
# slope of sim solidity with N across settings
sl=[np.polyfit(range(3,11),[np.mean(g[k][n]) for n in range(3,11)],1)[0] for _,k,_ in res]
print('sim slope with N: median',np.median(sl),'frac positive',np.mean(np.array(sl)>0), 'WT slope 0.0261')
json.dump({'bad':bad,'settings':len(g),'with_all_N':len(res),'best':[(r[0],list(r[1]),r[2]) for r in res[:5]],'median_sim_slope':float(np.median(sl)),'frac_slope_positive':float(np.mean(np.array(sl)>0)),'frac_slope_ge_0.013':float(np.mean(np.array(sl)>=0.0134))},open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t3-lumen-crit/an_sweep.json','w'),indent=1)
