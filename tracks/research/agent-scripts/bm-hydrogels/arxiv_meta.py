#!/usr/bin/env python
"""usage: python -I arxiv_meta.py ID [ID...]  -> title/authors/date/abstract from arXiv export API"""
import sys,urllib.request,re
sys.stdout.reconfigure(encoding='utf-8')
import xml.etree.ElementTree as ET
ns={'a':'http://www.w3.org/2005/Atom'}
for i in sys.argv[1:]:
    u=f'https://export.arxiv.org/api/query?id_list={i}'
    b=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'}),timeout=40).read()
    r=ET.fromstring(b).find('a:entry',ns)
    if r is None or r.find('a:title',ns) is None: print('NOT FOUND',i); continue
    print('##',i,'|',re.sub(r'\s+',' ',r.find('a:title',ns).text),'|',r.find('a:published',ns).text[:10],'|',', '.join(a.find('a:name',ns).text for a in r.findall('a:author',ns))[:150])
    print(re.sub(r'\s+',' ',r.find('a:summary',ns).text)); print()
