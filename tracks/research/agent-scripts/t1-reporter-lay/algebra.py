# Checks: (1) equal ymax,ymin,n => Hill curves are shifts along log x: y2(x)=y1(x*K1/K2).  (2) shows ymax/ymin of the strict pairs.
import json,sys,math,random
def hill(x,ymax,ymin,K,n): return ymin+(ymax-ymin)/(1+(x/K)**n)
random.seed(1); worst=0
for _ in range(10000):
    ymax,ymin=random.uniform(.5,4),random.uniform(.001,.02);K1,K2=random.uniform(.01,.3),random.uniform(.01,.3);n=random.uniform(1,5);x=10**random.uniform(-3,1)
    worst=max(worst,abs(hill(x,ymax,ymin,K2,n)-hill(x*K1/K2,ymax,ymin,K1,n)))
print('max abs diff over 10000 random trials (equal ymax,ymin,n):',worst)
d=json.load(open(sys.argv[1],encoding='utf-8'))
mods={r['name']:{x['name']:x['value'] for x in r['parameters']} for r in d if r.get('collection')=='models'}
for fam in (['B1_BM3R1','B2_BM3R1','B3_BM3R1'],['P1_PhlF','P2_PhlF','P3_PhlF'],['Q1_QacR','Q2_QacR'],['S2_SrpR','S3_SrpR','S4_SrpR']):
    print([(g,mods[g+'_model']['ymax'],mods[g+'_model']['ymin'],mods[g+'_model']['K'],mods[g+'_model']['n']) for g in fam])
