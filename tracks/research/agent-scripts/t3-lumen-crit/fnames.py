import sys,collections
sys.path.insert(0,'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t3-lumen-crit')
from xl import read
V="D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-lumen/data/vasquez/Source Data/"
d6=read(V+"lumen_manuscript_figure6.xlsx")["Nondimensionalized_data"]; h=d6[0]
for c in ['WT','Rab11a-GFP','Cldn_qKO']:
    f=[r[h.index('filename')] for r in d6[1:] if r and r[h.index('condition')]==c]
    print(c,len(f),sorted(f)[:60])
