"""Own calculations for bm-safety-lca. Run: python -I sds_extract.py && python -I calc.py
Inputs: scratch/bm-safety-lca/sds_table.json (from sds_extract.py) and numbers quoted below with their source."""
import json
T=json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-safety-lca/sds_table.json',encoding='utf8'))
resins=[r for r in T if r['product'] and 'Nylon' not in r['product'] and 'TPU' not in r['product']]
# the Flexible 50A resin has two SDS (EU CLP version 2026-05-29 and US HazCom version 05.29.2026); count products once, use union of H codes
prod={}
for r in resins:
    k=r['product'].replace('V2/V2.1','V2').strip()
    prod.setdefault(k,set()).update(r['H'])
print('SDS files:',len(T),' resin SDS files:',len(resins),' distinct resin products:',len(prod))
for code,label in [('H317','skin sensitiser'),('H315','skin irritant'),('H319','eye irritant'),('H318','serious eye damage'),('H335','resp. irritation'),('H360','reproductive toxicity 1B'),('H411','toxic to aquatic life, long-lasting')]:
    names=sorted(k for k,v in prod.items() if code in v)
    print(f'{code} {label}: {len(names)}/{len(prod)}  {names}')
only317=sorted(k for k,v in prod.items() if v=={'H317'})
print('products whose only H-code is H317:',only317)
# Flexible 50A: US vs EU H-codes
f=[r for r in resins if r['product']=='Flexible 50A Resin']
for r in f: print('Flexible 50A',r['file'],r['H'])
# Rigid 10K: unlisted mass fraction in SDS section 3 (UDMA 15-25, methacrylate monomer(s) 7-10, photoinitiator <0.5)
lo=100-(25+10+0.5); hi=100-(15+7+0)
print(f'Rigid 10K SDS section 3 itemised max {25+10+0.5} %  min {15+7+0} %  -> unitemised {lo} to {hi} % (TDS says "highly glass-filled")')
# IPA in print-room air (Baguley 2025 review citing one study): 560 ppbV vs 400 ppm TWA
print('IPA 560 ppbV / 400 ppmV =',round(560e-9/400e-6*100,3),'pct of the TWA limit quoted in that review')
# Vaisanen 2021: cured-part outgassing falls from 3000-14000 to 100-1000 ug/m2/h after 28 d
print('outgassing after 28 d, endpoint ratios: 100/3000 =',round(100*100/3000,1),'pct and 1000/14000 =',round(100*1000/14000,1),'pct remaining (paper states 84-96 pct reduction)')
# Wash time vs elastomer IPA uptake: Formlabs says avoid >20 min for Elastic 50A V1; V2 solvent table IPA_24h=39.2 % (project record)
print('Flexible 50A V2 IPA uptake in 24 h = 39.2 pct of part mass; recommended wash 20 min =',round(100*20/1440,2),'pct of 24 h')
# Formlabs powder refresh: Nylon 11 30 % (inert) / 50 % (air) -> reused fraction per build
for n,r in [('Nylon 11 inert',30),('Nylon 11 air',50),('Nylon 12 (30 %)',30),('TPU 90A',20)]: print(n,'refresh',r,'% -> reused unsintered powder per build',100-r,'%')
