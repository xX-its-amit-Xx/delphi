import json, urllib.request, sys
UA = {'User-Agent': 'delphi-research/0.1'}
for doi in sys.argv[1:]:
    try:
        m = json.load(urllib.request.urlopen(urllib.request.Request('https://api.crossref.org/works/' + doi, headers=UA), timeout=60))['message']
        print(doi, 'OK', m['title'][0][:70], m['issued']['date-parts'][0][0], m.get('container-title', [''])[0])
    except Exception as e:
        print(doi, 'ERR', e)
