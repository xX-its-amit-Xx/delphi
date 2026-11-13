"""Extract structured facts from a saved Formlabs product page (Next.js __NEXT_DATA__), decoding nested JSON strings.
Usage: python -I parse_product.py page.html  -> prints JSON"""
import re,json,sys,html
def clean(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x))).strip()
def decode(o):
    if isinstance(o,str):
        t=o.strip()
        if t[:1] in '{[' and t[-1:] in '}]':
            try: return decode(json.loads(t))
            except Exception: return o
        return o
    if isinstance(o,dict): return {k:decode(v) for k,v in o.items()}
    if isinstance(o,list): return [decode(v) for v in o]
    return o
def walk(o,f):
    f(o)
    if isinstance(o,dict):
        for v in o.values(): walk(v,f)
    elif isinstance(o,list):
        for v in o: walk(v,f)
def parse(path):
    h=open(path,encoding='utf8',errors='ignore').read()
    d=json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',h,re.S).group(1))
    g=decode(d['props']['pageProps']['getContentData'])
    res={'title':None,'tags':{},'headline':None,'tables':[],'texts':[]}
    try: res['title']=g['title']['seo']['title']
    except Exception: pass
    def f(o):
        if isinstance(o,dict):
            if 'tags' in o and 'category' in o and isinstance(o['tags'],list):
                res['tags'].setdefault(o['category'],[t.get('label') for t in o['tags'] if isinstance(t,dict)])
            if 'data' in o and isinstance(o['data'],list) and o['data'] and isinstance(o['data'][0],dict) and 'label' in o['data'][0] and 'value' in o['data'][0]:
                if res['headline'] is None: res['headline']=[(x['label'],x['value']) for x in o['data']]
            if isinstance(o.get('table'),str):
                rows=[]
                for r in re.findall(r'<tr.*?</tr>',o['table'],flags=re.S):
                    rows.append([clean(c) for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>',r,flags=re.S)])
                res['tables'].append(rows)
            if isinstance(o.get('text'),str) and len(o['text'])>40:
                res['texts'].append(clean(o['text']))
    walk(g,f)
    return res
if __name__=='__main__':
    sys.stdout.reconfigure(encoding="utf-8"); print(json.dumps(parse(sys.argv[1]),indent=1,ensure_ascii=False))
