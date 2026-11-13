# Verifies each DOI against Crossref (or DataCite for 10.5281) and each arXiv id against export.arxiv.org.
# Prints id, resolved title, first author family, year. Run: python -I verify_citations.py
import json, sys, urllib.request, urllib.parse, re
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
UA = {'User-Agent': 'delphi-research/0.1'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf8', 'replace')
dois = ['10.1088/3050-287X/ae61d1','10.1002/adma.202413523','10.1073/pnas.2111505119','10.1038/s41467-023-42068-x',
        '10.1073/pnas.12.3.207','10.1364/josa.11.000233','10.1016/j.jmps.2026.106780']
for d in dois:
    try:
        m = json.loads(get('https://api.crossref.org/works/' + urllib.parse.quote(d)))['message']
        y = (m.get('issued', {}).get('date-parts') or [[None]])[0][0]
        a = (m.get('author') or [{}])[0].get('family')
        print('CROSSREF', d, '|', (m.get('title') or [''])[0], '|', a, y, '|', (m.get('container-title') or [''])[0])
    except Exception as e:
        print('CROSSREF FAIL', d, e)
try:
    m = json.loads(get('https://api.datacite.org/dois/10.5281/zenodo.15151168'))['data']['attributes']
    print('DATACITE 10.5281/zenodo.15151168 |', m['titles'][0]['title'], '|', m.get('publicationYear'), '|', [c.get('name') for c in m.get('creators', [])][:4])
except Exception as e:
    print('DATACITE FAIL', e)
for a in ['2603.29592', '2409.05556', '2407.07732', '2304.05422', '2604.26367']:
    try:
        x = get('http://export.arxiv.org/api/query?id_list=' + a)
        e = x.split('<entry>')[1]
        t = re.sub(r'\s+', ' ', re.search(r'<title>(.*?)</title>', e, re.S).group(1))
        au = re.findall(r'<name>(.*?)</name>', e)[:3]
        print('ARXIV', a, '|', t, '|', au, '|', re.search(r'<published>(.*?)</published>', e).group(1)[:10])
    except Exception as ex:
        print('ARXIV FAIL', a, ex)
# bibliographic searches for items whose DOI I do not know from the fetched sources
for q in ['Generative design, manufacturing, and molecular modeling of 3D architected materials based on natural language input Hsu Yang Buehler',
          'BioinspiredLLM conversational large language model for the mechanics of biological and bio-inspired materials Luu Buehler',
          'Schreiner Buxbaum Computer-optimization of vascular trees']:
    try:
        r = json.loads(get('https://api.crossref.org/works?rows=2&select=DOI,title,author,issued,container-title&query.bibliographic=' + urllib.parse.quote(q)))['message']['items']
        for m in r:
            print('SEARCH', q[:40], '->', m['DOI'], '|', (m.get('title') or [''])[0][:100], '|', (m.get('author') or [{}])[0].get('family'), (m.get('issued', {}).get('date-parts') or [[None]])[0][0])
    except Exception as e:
        print('SEARCH FAIL', q[:40], e)
