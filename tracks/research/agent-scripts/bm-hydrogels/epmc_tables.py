#!/usr/bin/env python
"""usage: python -I epmc_tables.py PMCID [regex]  -> print tables (and paragraphs matching regex) from cached XML"""
import sys,re
sys.stdout.reconfigure(encoding='utf-8')
import xml.etree.ElementTree as ET
r=ET.parse(f'D:/Users/ashenoy00000/delphi-work/data/bm-hydrogels/{sys.argv[1]}.xml').getroot()
txt=lambda e: re.sub(r'\s+',' ',''.join(e.itertext()))
for t in r.iter('table-wrap'):
    print(txt(t.find('label')) if t.find('label') is not None else '', txt(t.find('caption')) if t.find('caption') is not None else '')
    for tr in t.iter('tr'): print('  ',' | '.join(txt(c) for c in tr))
    for f in t.iter('table-wrap-foot'): print('FOOT',txt(f)[:400])
if len(sys.argv)>2:
    for p in r.iter('p'):
        s=txt(p)
        if re.search(sys.argv[2],s,re.I): print('P:',s[:700])
