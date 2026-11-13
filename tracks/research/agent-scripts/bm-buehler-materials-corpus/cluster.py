# Cluster track-5 papers of buehler-corpus.json into coarse super-themes by keyword on theme+title.
# Run: python -I cluster.py  -> writes scratch/t5_clusters.json and t5_listing.txt
import json, re, collections, sys
SRC='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/buehler-corpus.json'
OUT='D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-buehler-materials-corpus/'
d=json.load(open(SRC,encoding='utf8'))
t5=[x for x in d['works'] if 5 in x['tracks']]
RULES=[
 ('printed/ML-designed hierarchical composites', r'printed|additive|3d.print|machine learning|composite design|generative|conch|nacre|bioinspired composite|topology|TPMS|lattice'),
 ('hygromorph / stimulus-response / wood-cellulose', r'hygromorph|stimulus|elastin|SELP|wood|cellulose|bamboo|swell|humid'),
 ('metal-coordination / dynamic crosslinks / mussel / adhesion', r'metal-coord|crosslink|mussel|adhes|mechanomutable|interface|polydopamine|melanin'),
 ('hierarchy / flaw tolerance / size effects / H-bond limits', r'flaw|size effect|hierarch|H-bond|beta-sheet|confinement|materiomics|multiscale|materials-by-design'),
 ('fracture / dynamic fracture / heterogeneous solids', r'fracture|crack|buckling|heterogeneous|plasticity|metal film'),
 ('collagen / bone / biomineral', r'collagen|bone|biomineral|enamel|diatom|silica|fish scale|armour'),
 ('silk / spider / keratin / amyloid / filaments', r'silk|spider|keratin|amyloid|filament|lamin|elastin|protein'),
 ('carbon / 2D / graphene', r'graphene|carbon|carbyne|2D'),
 ('cement / asphalt / civil', r'cement|asphalt|concrete|basalt|civil|C-S-H'),
 ('AI agents / knowledge graph / category theory / LLM', r'agent|knowledge graph|category|olog|LLM|ontolog|AI|verif'),
 ('editorial / outreach / sonification / other', r'editorial|news|outreach|sonif|course|education|interview|report|erratum|paratext|music'),
]
def cl(x):
    s=x['theme']+' '+x['title']
    for name,pat in RULES:
        if re.search(pat,x['theme'],re.I): return name
    for name,pat in RULES:
        if re.search(pat,x['title'],re.I): return name
    return 'unclassified'
c=collections.defaultdict(list)
for x in t5: c[cl(x)].append(x)
summary={k:{'n':len(v),'mean_rel':round(sum(y['relevance'] for y in v)/len(v),2),'n_rel4plus':sum(1 for y in v if y['relevance']>=4)} for k,v in c.items()}
json.dump({'total_t5':len(t5),'clusters':summary},open(OUT+'t5_clusters.json','w',encoding='utf8'),indent=1)
with open(OUT+'t5_listing.txt','w',encoding='utf8') as f:
    for k,v in sorted(c.items(),key=lambda kv:-len(kv[1])):
        f.write(f'\n## {k} (n={len(v)})\n')
        for y in sorted(v,key=lambda y:-y['relevance']):
            f.write(f"{y['relevance']}|{y['year']}|{y['title'][:110]}|{y['doi']}|abs={y['has_abstract']}|{y['theme']}\n")
print(json.dumps(summary,indent=1))
