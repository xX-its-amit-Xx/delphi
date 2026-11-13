import sys; sys.path.insert(0,'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t3-lumen-crit')
from xl import read
V="D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-lumen/data/vasquez/Source Data/"
d=read(V+"lumen_manuscript_figure6.xlsx")
for k,rows in d.items():
    if k=='Contents': continue
    h=rows[0]; print(k,len(rows)); print(h)
    for r in rows[1:]:
        if r and r[h.index('condition')]=='WT': print(r); break
print(read(V+"lumen_manuscript_figure2_SF2.xlsx")['cldn-qKO'][0])
