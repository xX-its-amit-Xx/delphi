"""Source-text loader and verbatim-quote verifier for t4-glide-deep.
verify(key, quote) returns True when the quote (<=40 words) occurs in the stored source text, ignoring
whitespace, case, hyphenation at line breaks and HTML entities."""
import re, html, json, glob, os
D = 'D:/Users/ashenoy00000/delphi-work/data/'
S = 'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t4-glide-deep/'
L = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/'
REPO = glob.glob(D + 't4-glide-repo/x/Effect*/model/')[0]


def _rd(p):
    return open(p, encoding='utf8', errors='replace').read()


def _xml(p):
    t = re.sub('<[^>]+>', ' ', _rd(p))
    return html.unescape(t)


cr = json.load(open(S + 'crossref.json', encoding='utf8'))
ep = json.load(open(S + 'epmc.json', encoding='utf8'))
TEXT = {
    'PRE': _rd(D + 't4-glide-deep-pdfs/1811.12221.raw.txt'),
    'PRL': _rd(D + 't4-glide-deep-pdfs/1902.08038.raw.txt'),
    'POM': _rd(D + 't4-glide-deep-pdfs/2408.08864.raw.txt'),
    'NAVE': _rd(D + 't4-glide-deep-pdfs/2010.12553.raw.txt'),
    'CAZ': _rd(D + 't4-glide-deep-pdfs/2508.05106.raw.txt'),
    'LOO': _rd(D + 't4-glide-deep-pdfs/2503.22606.raw.txt'),
    'PAT': _rd(D + 't4-glide-deep-pdfs/2107.00738.raw.txt'),
    'SMITH': _xml(D + 't4-glide-deep-html/smith2015.xml'),
    'WIES': _xml(D + 't4-glide-deep-html/wies.xml'),
    'CODE': _rd(REPO + 'lift_drag_coefficients.py'),
    'LICENSE': _rd(REPO + '../LICENSE.txt'),
    'LAW_FCG': _rd(L + 'flight-climb-glide-law.json'),
    'LAW_E1': _rd(L + 'E1.json'),
    'LAW_PWG': _rd(L + 'perturb-wind-glide.json'),
    'LEAN_PERTURB': _rd('D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/Perturb.lean'),
    'LAWSET': _rd('D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/lawsets/lawset-1.8.1.json'),
}
for doi, v in cr.items():
    TEXT['CR:' + doi] = v.get('title', '') + ' ' + v.get('abstract', '')
for doi, v in ep.items():
    TEXT['EP:' + doi] = (v.get('title') or '') + ' ' + (v.get('abstract') or '')


def norm(s):
    s = html.unescape(s).replace('\u00ad', '')
    s = re.sub(r'-\s*\n\s*', '', s)          # hyphenation at line breaks
    s = re.sub(r'\s+', '', s).lower()
    return s


_N = {}


def verify(key, quote):
    if not quote:
        return True
    if key not in _N:
        _N[key] = norm(TEXT[key])
    return norm(quote) in _N[key]
