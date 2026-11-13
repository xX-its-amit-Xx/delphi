"""Parse Formlabs solvent-compatibility table (saved HTML) into JSON. Usage: python -I parse_solvent.py in.html out.json"""
import re,sys,json,html
src,dst=sys.argv[1],sys.argv[2]
h=open(src,encoding='utf8',errors='ignore').read()
t=re.sub(r'<script.*?</script>|<style.*?</style>','',h,flags=re.S)
tb=re.findall(r'<table.*?</table>',t,flags=re.S)[0]
rows=re.findall(r'<tr.*?</tr>',tb,flags=re.S)
def cells(r): return [html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',c))).strip() for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>',r,flags=re.S)]
hdr=cells(rows[0])
out={}
for r in rows[1:]:
    c=cells(r)
    if len(c)==len(hdr): out[c[0]]=dict(zip(hdr[1:],c[1:]))
    else: out[c[0]+' (WIDTH MISMATCH %d)'%len(c)]=c[1:]
json.dump({'solvents':hdr[1:],'rows':out},open(dst,'w',encoding='utf8'),indent=1)
print(len(out),'rows')
for k,v in out.items():
    if isinstance(v,dict): print(f"{k:40s} water={v['Water']:>7} salt={v['Salt Water (3.5% NaCl)']:>7} IPA={v['Isopropyl Alcohol']:>7} acetone={v['Acetone']:>7} xylene={v['Xylene']:>7} NaOH10={v['Sodium Hydroxide solution (0.025% PH 10)']:>6}")
    else: print(k,v)
