"""List zebrafish (Danio rerio) projects in PRIDE Archive (v3 search API), keeping only projects whose organisms include Danio rerio."""
import requests, json, time, collections
out = {}
for kw in ['zebrafish', 'Danio rerio', 'danio']:
    for p in range(0, 40):
        r = requests.get('https://www.ebi.ac.uk/pride/ws/archive/v3/search/projects', params={'keyword': kw, 'pageSize': 100, 'page': p}, timeout=60)
        d = r.json()
        if not d: break
        for x in d:
            if any('danio' in o.lower() for o in (x.get('organisms') or [])):
                out[x['accession']] = {k: x.get(k) for k in ['accession', 'title', 'organisms', 'organismsPart', 'diseases', 'submissionDate', 'publicationDate', 'experimentTypes', 'instruments', 'keywords', 'references']}
        time.sleep(0.3)
    print(kw, len(out), flush=True)
json.dump({'retrieved': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'url': 'https://www.ebi.ac.uk/pride/ws/archive/v3/search/projects?keyword=<zebrafish|Danio rerio|danio>', 'projects': out},
          open('C:/Temp/omics-cache/proteomic/pride/pride_zebrafish_projects.json', 'w'))
c = collections.Counter(t for x in out.values() for t in (x['organismsPart'] or ['(none)']))
print(c.most_common(40))
