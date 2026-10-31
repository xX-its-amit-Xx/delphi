import json, urllib.parse as U
from net import jget
Q = {
 'weatherbee_webbing': 'TITLE:"interdigital webbing retention in bat wings"',
 'eckalbar_epigenome': 'TITLE:"developing bat wing" AND (transcriptomic OR epigenomic)',
 'bat_shh_fgf8_wing': '(bat OR Carollia) AND (Shh OR "Sonic hedgehog") AND Fgf8 AND wing AND development',
 'bat_tbx3_meis': '(bat OR Chiroptera) AND (Tbx3 OR Meis2) AND wing',
}
raw = json.load(open('C:/Temp/sequences/epmc_raw.json'))
for k, q in Q.items():
    url = ('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=10&query=' + U.quote(q))
    d = jget(url, f'Europe PMC search ({k}): bat wing regulatory regions')
    raw[k] = {'query': q, 'url': url, 'hitCount': d.get('hitCount'),
              'results': [{f: r.get(f) for f in ('id', 'source', 'pmid', 'pmcid', 'doi', 'title', 'authorString',
                           'journalTitle', 'pubYear', 'abstractText')} for r in d.get('resultList', {}).get('result', [])]}
    print('##', k, d.get('hitCount'))
    for r in raw[k]['results']: print('  ', r['pmid'], r['id'], r['pubYear'], (r['title'] or '')[:120])
json.dump(raw, open('C:/Temp/sequences/epmc_raw.json', 'w'), indent=1)
