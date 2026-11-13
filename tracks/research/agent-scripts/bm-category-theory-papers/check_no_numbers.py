"""Search the paper text for any numeric assignment to the fibre-law parameters (tau, chi, m_0, m_eq). Expect zero hits.
Run: python -I check_no_numbers.py <paper.txt>"""
import re,sys
s=open(sys.argv[1],encoding='utf-8').read()
names=[r'\tau_{m}',r'\tau_{L}',r'\tau_{T}',r'\tau_{\Delta}',r'\chi_{L}',r'\chi_{T}',r'm_{0}']
hits=[]
for n in names:
    for m in re.finditer(re.escape(n)+r'\s*(=|\approx|\sim)\s*[-+]?\d',s): hits.append(s[m.start():m.end()+10])
print('numeric assignments to tau/chi/m0 found:',len(hits),hits[:5])
print('lines mentioning tau_ together with a number+unit:',[l[:80] for l in s.splitlines() if 'tau_' in l and re.search(r'\d\s*(s|min|h)\b',l)][:5])
