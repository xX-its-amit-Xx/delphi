# Corpus-level counts from buehler-corpus.json (track 5) and underlying buehler.json abstracts.
# Run: python -I corpus_stats.py   -> prints counts, writes scratch/corpus_stats.json
import json,re,sys,collections
sys.stdout.reconfigure(encoding='utf8')
R='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/'
rel=json.load(open(R+'buehler-corpus.json',encoding='utf8'))
raw=json.load(open(R+'corpus/buehler.json',encoding='utf8'))
ab={(w['doi'] or '').lower():(w.get('abstract') or '') for w in raw['works']}
absT={w['openalex']:(w.get('abstract') or '') for w in raw['works']}
t5=[x for x in rel['works'] if 5 in x['tracks']]
def A(x): return absT.get(x['openalex'],'')
pats={
 'vat_or_powder_printing':r'stereolithograph|\bSLA\b|\bDLP\b|vat photopolymer|selective laser sinter|\bSLS\b|Formlabs|powder bed|digital light',
 'polyjet_or_multimaterial_printing':r'multi-?material|PolyJet|material jetting|multimaterial',
 'any_3d_printing':r'3D[- ]print|additive manufactur|additively',
 'humidity_or_water_stimulus':r'humid|moisture|hygro|swell|relative humidity|osmotic|supercontract',
 'bilayer_or_curvature':r'bilayer|bi-layer|curvature|bending actuat|self-shaping|shape-morphing|4D',
 'wood_or_cellulose':r'\bwood\b|cellulose|bamboo|lignocell',
 'hierarchy':r'hierarch',
 'stiff_soft_two_phase':r'stiff and soft|soft and stiff|soft phase|stiff phase|brittle',
 'formal_law_or_category':r'category theor|\bologs?\b|theorem|formal verif|\bLean\b|proof assistant',
}
out={'t5_total':len(t5),'t5_with_abstract':sum(1 for x in t5 if A(x)),'all_works':len(raw['works'])}
for k,p in pats.items():
    hit5=[x for x in t5 if re.search(p,A(x),re.I)]
    hitall=[w for w in raw['works'] if re.search(p,w.get('abstract') or '',re.I)]
    out[k]={'t5':len(hit5),'all795':len(hitall),'t5_examples':[(x['year'],x['title'][:70],x['doi']) for x in hit5[:6]] if k in ('vat_or_powder_printing','humidity_or_water_stimulus','bilayer_or_curvature') else []}
# both printing and humidity
both=[x for x in t5 if re.search(pats['any_3d_printing'],A(x),re.I) and re.search(pats['humidity_or_water_stimulus'],A(x),re.I)]
out['printing_and_humidity_t5']=[(x['year'],x['title'][:80],x['doi']) for x in both]
yrs=collections.Counter(x['year'] for x in t5 if re.search(pats['any_3d_printing'],A(x),re.I))
out['printing_by_year']=dict(sorted(yrs.items()))
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-buehler-materials-corpus/corpus_stats.json','w',encoding='utf8'),indent=1,ensure_ascii=False)
print(json.dumps(out,indent=1,ensure_ascii=False))
