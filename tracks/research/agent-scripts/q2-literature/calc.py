import math
RT=0.0019872*298.15; f=RT*math.log(10)
print("kcal/mol per pK unit at 298.15K = %.4f"%f)
for name,v in [("Kramer mean err 0.44",0.44),("Kramer SD 0.54",0.54),("Kramer median 0.34",0.34),("Brown median SD 0.3",0.3)]:
    print(name,"pKi ->","%.2f kcal/mol"%(v*f))
print("r ceiling from R2=0.81: %.3f"%math.sqrt(0.81))
# CleanSplit: search-top5-complexes CASF2016 before/after
print("Pearson drop search-top5 complexes: 0.716->0.653 = %.3f"%(0.716-0.653),"; RMSE 1.517->1.648 = %.3f"%(1.648-1.517))
print("Durant CASF2016 ligand-only bias 0.76 vs OnionNet-2 0.82; both-bias 0.85")
