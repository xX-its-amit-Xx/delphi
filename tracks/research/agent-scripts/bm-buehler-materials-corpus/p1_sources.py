# Part 1: source registry and quote checker (exec'd by build.py).
import json, re, unicodedata
D = 'D:/Users/ashenoy00000/delphi-work/data/buehler-papers/'
FL = 'D:/Users/ashenoy00000/delphi-work/data/formlabs-recheck-bm/'
R = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/'

def norm(t, tags=False):
    t = unicodedata.normalize('NFKC', t)
    for ch in '\u2010\u2011\u2012\u2013\u2014\u2212\u00ad':
        t = t.replace(ch, '-')
    t = t.replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"')
    if tags: t = re.sub(r'<[^>]+>', ' ', t)
    t = re.sub(r'&gt;', '>', t); t = re.sub(r'&lt;', '<', t); t = re.sub(r'&amp;', '&', t)
    return re.sub(r'\s+', '', t)  # whitespace-insensitive

def epmc_abs(slug):
    r = json.load(open(D + 'epmc_' + slug + '.json', encoding='utf8'))['resultList']['result']
    return r[0].get('abstractText', '')

def cr_abs(slug):
    return json.load(open(D + 'crossref_' + slug + '.json', encoding='utf8'))['message'].get('abstract', '') or ''

def rd(p):
    return open(p, encoding='utf8', errors='replace').read()

SRC = {}   # key -> dict(text=..., url=..., path=...)
def add(key, text, url, path=''):
    SRC[key] = dict(text=norm(text, tags=key.endswith('_abs')), url=url, path=path)

add('silk_torsion_ft', rd(D + 'fulltext_PMC6397028.txt'), 'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6397028/fullTextXML (doi 10.1126/sciadv.aau9183)', D + 'fulltext_PMC6397028.xml')
add('silk_torsion_abs', epmc_abs('10.1126_sciadv.aau9183'), 'https://europepmc.org/article/MED/30838327')
add('tendon_ft', rd(D + 'fulltext_PMC4354200.txt'), 'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4354200/fullTextXML (doi 10.1038/ncomms6942)', D + 'fulltext_PMC4354200.xml')
add('hier_ft', rd(D + 'fulltext_PMC3216522.txt'), 'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3216522/fullTextXML (doi 10.1038/srep00035)', D + 'fulltext_PMC3216522.xml')
add('web_ft', rd(D + 'fulltext_PMC4479035.txt'), 'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4479035/fullTextXML (doi 10.1038/ncomms8038)', D + 'fulltext_PMC4479035.xml')
add('ling_ft', rd(D + 'fulltext_PMC7189256.txt'), 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7189256/ (doi 10.1002/adma.201802306)', D + 'pmc7189256.html')
add('dimas_thesis', rd(D + 'dimas_thesis.txt'), 'https://dspace.mit.edu/handle/1721.1/79497 (L. Dimas MIT thesis 2013)', D + 'dimas_thesis_mit_1721.1_79497.pdf')
add('gu_thesis', rd(D + 'gu_thesis.txt'), 'https://dspace.mit.edu/handle/1721.1/119343 (G. X. Gu MIT thesis 2018)', D + 'gu_thesis_mit_1721.1_119343.pdf')
add('luu_arxiv_ft', rd(D + 'arxiv_2508.06591.txt'), 'https://arxiv.org/pdf/2508.06591', D + 'arxiv_2508.06591.pdf')
add('luu_arxiv_abs', rd(D + 'arxiv_2508.06591.atom'), 'https://export.arxiv.org/api/query?id_list=2508.06591', D + 'arxiv_2508.06591.atom')
add('lew_arxiv_abs', rd(D + 'arxiv_2108.07877.atom'), 'https://export.arxiv.org/api/query?id_list=2108.07877', D + 'arxiv_2108.07877.atom')
add('b123d_arxiv_abs', rd(D + 'arxiv_2603.29592.atom'), 'https://export.arxiv.org/api/query?id_list=2603.29592', D + 'arxiv_2603.29592.atom')
add('giesa_abs', epmc_abs('10.1021_acsnano.7b01532'), 'https://europepmc.org/article/MED/28846384')
add('ling_abs', epmc_abs('10.1002_adma.201802306'), 'https://europepmc.org/article/MED/30260527')
add('dimas13_abs', cr_abs('10.1002_adfm.201300215'), 'https://api.crossref.org/works/10.1002/adfm.201300215')
add('dimas14_abs', epmc_abs('10.1039_c3sm52890a'), 'https://europepmc.org/article/MED/24700202')
add('mirz_abs', epmc_abs('10.1021_ab500120f'), 'https://europepmc.org/article/MED/33429576')
add('gu17_abs', epmc_abs('10.1002_adma.201700060'), 'https://europepmc.org/article/MED/28556257')
add('gu18_abs', cr_abs('10.1039_c8mh00653a'), 'https://api.crossref.org/works/10.1039/c8mh00653a')
add('brommer_abs', epmc_abs('10.1088_0957-4484_27_2_024002'), 'https://europepmc.org/article/MED/26618369')
add('lew23_abs', epmc_abs('10.1002_adma.202300373'), 'https://europepmc.org/article/MED/36864010')
add('shen_abs', epmc_abs('10.1039_d3mh01277h'), 'https://europepmc.org/article/MED/38315077')
add('grez_abs', cr_abs('10.1002_adem.202000387'), 'https://api.crossref.org/works/10.1002/adem.202000387')
add('qin_abs', epmc_abs('10.1038_ncomms8038'), 'https://europepmc.org/article/MED/25975372')
add('tendon_abs', epmc_abs('10.1038_ncomms6942'), 'https://europepmc.org/article/MED/25608644')
add('sen_abs', epmc_abs('10.1038_srep00035'), 'https://europepmc.org/article/MED/22355554')
add('degrad_abs', epmc_abs('10.1089_3dp.2024.0014'), 'https://europepmc.org/article/PMC/PMC12038357')
add('f80v2_tds', __import__('subprocess').run(['pdftotext', '-enc', 'UTF-8', '-table', FL + 'f80v2.pdf', '-'], capture_output=True).stdout.decode('utf8', 'ignore'),
    'https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf', FL + 'f80v2.pdf')
add('f80v1_tds', __import__('subprocess').run(['pdftotext', '-enc', 'UTF-8', '-layout', FL + 'f80v1.pdf', '-'], capture_output=True).stdout.decode('utf8', 'ignore'),
    'https://media.formlabs.com/m/442fcd13220df367/original/-ENUS-Flexible-80A-TDS.pdf', FL + 'f80v1.pdf')
add('corpus_json', rd(R + 'buehler-corpus.json'), 'file ' + R + 'buehler-corpus.json', R + 'buehler-corpus.json')

def check(src, quote):
    """True if the quote is a substring of the source after normalisation."""
    return norm(quote) in SRC[src]['text']
