#!/usr/bin/env python
"""usage: python -I epmc_abstract.py DOI -> prints title + abstract from Europe PMC core record"""
import sys,json,urllib.request,urllib.parse
sys.stdout.reconfigure(encoding='utf-8')
for doi in sys.argv[1:]:
    q=urllib.parse.quote(f'DOI:"{doi}"')
    u=f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&format=json&resultType=core'
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'}),timeout=40))
    rs=d['resultList']['result']
    if not rs: print('NOT IN EPMC',doi); continue
    r=rs[0]; print('##',doi,'|',r.get('title'),'|',r.get('journalTitle'),r.get('pubYear'),'| pmid',r.get('pmid'),'pmcid',r.get('pmcid'))
    print(r.get('abstractText')); print()
