"""Extract schema.org Product/Offer JSON-LD from saved Formlabs store pages. usage: extract_offers.py file.html ..."""
import re,sys,json
def walk(o,out):
    if isinstance(o,dict):
        if o.get('@type')=='Product' or 'offers' in o:
            of=o.get('offers')
            if isinstance(of,list): of=of[0] if of else {}
            out.append((o.get('name'),o.get('sku'),(of or {}).get('price'),(of or {}).get('priceCurrency'),(of or {}).get('url')))
        for v in o.values(): walk(v,out)
    elif isinstance(o,list):
        for v in o: walk(v,out)
for f in sys.argv[1:]:
    s=open(f,encoding='utf8',errors='ignore').read()
    out=[]
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>',s,re.S):
        try: walk(json.loads(m.group(1)),out)
        except Exception as e: pass
    # fallback: inline regex
    for m in re.finditer(r'"@type":"Product","name":"([^"]*)","sku":"([^"]*)".{0,400}?"price":([\d\.]+),"priceCurrency":"(\w+)"',s):
        out.append((m.group(1),m.group(2),float(m.group(3)),m.group(4),'regex'))
    seen=set()
    print('==',f)
    for r in out:
        if r not in seen: seen.add(r); print('  ',r)
