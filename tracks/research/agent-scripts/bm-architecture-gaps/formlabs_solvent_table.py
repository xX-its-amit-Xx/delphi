"""Parse Formlabs solvent-compatibility page (24 h weight gain %). Usage: python -I formlabs_solvent_table.py <html path>
Downloaded from https://formlabs.com/support/solvent-compatibility/ (fetched 2026-11-12). Prints Water, IPA, Acetone, Xylene per resin."""
import re,html,sys
t=open(sys.argv[1],encoding='utf-8',errors='replace').read()
t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
rows=[[html.unescape(re.sub(r'<[^>]+>','',c)).strip().split('\n')[0] for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',r,flags=re.S)] for r in re.findall(r'<tr[^>]*>(.*?)</tr>',t,flags=re.S)]
hdr=rows[0]; 
idx={k:hdr.index(k) for k in ['Water','Isopropyl Alcohol','Acetone','Xylene','Salt Water (3.5% NaCl)']}
print('resin | water | IPA | acetone | xylene | saltwater')
for r in rows[1:]:
    if len(r)==len(hdr): print(' | '.join([r[0]]+[r[idx[k]] for k in idx]))
