"""Extract the Formlabs data-sheet index (embedded JSON of https://formlabs.com/materials/data-sheets/).
Usage: python -I build_index.py datasheets.html index.json"""
import re,json,sys
h=open(sys.argv[1],encoding='utf8',errors='ignore').read()
d=json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',h,re.S).group(1))
s=json.dumps(d['props']['pageProps']['getContentData']['title']['page']['placeholders'])
s=s.encode().decode('unicode_escape') if False else s
# records look like {"pk": N, "display_name": "...", "products": [...], "language": "en", "file": "...", "sheet_type": "technical"}
recs=[]
for m in re.finditer(r'\{\\"pk\\": (\d+), \\"display_name\\": \\"(.*?)\\", \\"products\\": \[(.*?)\], \\"language\\": \\"(.*?)\\", \\"file\\": \\"(.*?)\\", \\"sheet_type\\": \\"(.*?)\\"\}',s):
    pk,dn,pr,lang,f,st=m.groups()
    recs.append(dict(pk=int(pk),display_name=dn,products=re.findall(r'\\"(.*?)\\"',pr),language=lang,file=f,sheet_type=st))
prod=re.findall(r'\{\\"handle\\": \\"(.*?)\\", \\"label\\": \\"(.*?)\\"\}',s)
json.dump(dict(records=recs,products=sorted(set(prod))),open(sys.argv[2],'w',encoding='utf8'),indent=1)
print(len(recs),'records',len(set(prod)),'products')
