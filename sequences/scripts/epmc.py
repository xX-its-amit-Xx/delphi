import json, urllib.parse as U, sys
from net import jget
Q = {
 'prx1_enhancer': '(bat OR Carollia OR Chiroptera) AND (Prx1 OR Prrx1) AND enhancer AND limb',
 'bat_accelerated_regions': '"bat accelerated regions" OR ((bat OR Chiroptera) AND accelerated AND (enhancer OR regulatory) AND (wing OR forelimb))',
 'bat_wing_epigenome': '(bat OR Miniopterus OR Carollia) AND wing AND (ChIP-seq OR epigenomic OR "regulatory elements") AND development',
 'bat_hox': '(bat OR Chiroptera OR Carollia OR Miniopterus) AND (Hoxd13 OR Hoxd OR "Hox genes") AND (wing OR forelimb OR autopod)',
 'bat_webbing': '(bat OR Chiroptera OR Carollia) AND (interdigit* OR webbing) AND (Fgf8 OR Gremlin OR Grem1 OR Bmp)',
 'bat_wing_singlecell': '(bat OR Carollia) AND wing AND ("single-cell" OR scRNA) AND (Meis2 OR Tbx3 OR fibroblast)',
}
out = {}
for k, q in Q.items():
    url = ('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=15&query='
           + U.quote(q))
    d = jget(url, f'Europe PMC search ({k}): bat wing/forelimb regulatory regions')
    out[k] = {'query': q, 'url': url, 'hitCount': d.get('hitCount'),
              'results': [{f: r.get(f) for f in ('id', 'source', 'pmid', 'pmcid', 'doi', 'title', 'authorString',
                           'journalTitle', 'pubYear', 'abstractText')} for r in d.get('resultList', {}).get('result', [])]}
json.dump(out, open('C:/Temp/sequences/epmc_raw.json', 'w'), indent=1)
for k, v in out.items():
    print('##', k, v['hitCount'])
    for r in v['results']: print('  ', r['pmid'], r['pubYear'], (r['title'] or '')[:130])
