"""Build per-material property records from the dumped TDS tables (tds_dump.py output) + product pages + solvent table.
Run: python -I build_materials.py  -> scratch/<label>/materials.json"""
import os,re,json
SC='D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins'
KEYS=[('tensile_modulus',r'^Tensile Modulus'),('uts',r'^Ultimate Tensile'),('elong_break',r'^Elongation at Break'),('elong_yield',r'^Elongation at Yield'),
('flex_modulus',r'^Flexural Modulus'),('flex_strength',r'^Flexural (Strength|Stress)'),('stress50',r'^Stress (@|at) 50'),('stress100',r'^Stress (@|at) 100'),
('tear',r'^Tear'),('shore',r'^Shore'),('hdt_0.45',r'^Heat Deflection Temp\. @ 0\.45'),('hdt_1.8',r'^Heat Deflection Temp\. @ 1\.8'),
('density',r'(Density)'),('tg',r'(Glass [Tt]ransition|Tg)'),('cte',r'^Thermal Expansion'),('water_abs_D570',r'^Water Absorption'),('moisture_powder',r'^Moisture Content'),
('notched_izod',r'^Notched Izod'),('vicat',r'^Vicat'),('rebound',r'(Bayshore|Rebound)'),('comp_set',r'^Compression Set')]
def norm(s): return re.sub(r'\s+',' ',re.sub(r'°[CF]|[0-9.]+',' ',s)).strip()
def load_table(path):
    rows=[]
    for ln in open(path,encoding='utf8').read().split('\n'):
        parts=[x.strip() for x in ln.split(' | ')]
        if len(parts)<3: continue
        rows.append((parts[0],parts[1],parts[2:]))
    return rows
def metric_split(vals,n):
    return vals[:n]
def build(path):
    rows=load_table(path); states=None; out={}; solv=False
    for pg,lab,cells in rows:
        j=' '.join(cells)
        if cells and cells[0]=='Solvent' or (len(cells)>1 and cells[1]=='Solvent') or lab=='' and 'Solvent' in cells[:2]: solv=True
        if lab=='' and cells and cells[0]=='' and len(cells)>1 and re.match(r'(Green|Post|X$|X |Y|Z)',cells[1]):
            st=[c for c in cells[1:] if c]
            n=len(st)
            if n%2==0 and [norm(x) for x in st[:n//2]]==[norm(x) for x in st[n//2:]]: st=st[:n//2]
            states=st; solv=False; continue
        if lab=='' and cells and cells[0]=='' and len(cells)>1 and cells[1].startswith('Post-Cured'):
            states=[cells[1]]; continue
        if 'Solvent' in lab or lab=='' and 'Solvent' in j and len(cells)>=1 and cells[0]=='': continue
        label=lab
        vals=cells[1:] if (lab and cells and cells[0]=='') else cells
        if not label and cells and cells[0] and not re.match(r'(Material|Tensile|Mechanical|Flexural|Thermal|Impact|Other|General|Toughness|Fracture|Electric|ISO|SOLVENT)',cells[0]):
            label=cells[0]; vals=cells[1:]
        if not label or solv: continue
        for k,rx in KEYS:
            if re.search(rx,label):
                v=[x for x in vals]
                n=len(states) if states else 1
                v=v[:n] if states else v[:1]
                # drop trailing method col if empty
                out.setdefault(k,[]).append({'label':label,'states':states if states else None,'values':v})
                break
    return out
def footnotes(txt):
    t=open(txt,encoding='utf8',errors='ignore').read()
    t=re.sub(r'\s+',' ',t)
    fn=[]
    for m in re.finditer(r'(Data was obtained[^.]*\.[^.]*\.|[Pp]ost-?cure[^.]{0,200}\.|specimens? (were|was)[^.]{0,200}\.|Form Cure[^.]{0,150}\.|conditioned[^.]{0,200}\.)',t):
        s=m.group(0).strip()
        if s not in fn: fn.append(s[:400])
    bio=sorted(set(re.findall(r'ISO 10993-\d+(?::\d{4})?|USP Class VI|ISO 18562-\d+|EN 868|ISO 10993-1:2018',t)))
    return fn[:8],bio
if __name__=='__main__':
    res={}
    for f in sorted(os.listdir(SC+'/tables')):
        k=f[:-4]
        r=build(SC+'/tables/'+f)
        fn,bio=footnotes(SC+'/txtraw/'+f)
        res[k]={'props':r,'footnotes':fn,'bio':bio}
    json.dump(res,open(SC+'/materials.json','w',encoding='utf8'),indent=1,ensure_ascii=False)
    print(len(res))
