"""Strip tags from every *.html in data/safety-lca -> *.html.txt. Run: python -I html2txt.py"""
import re,glob,html
for f in glob.glob('D:/Users/ashenoy00000/delphi-work/data/safety-lca/*.html'):
    t=open(f,encoding='utf8',errors='replace').read()
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=html.unescape(re.sub(r'<[^>]+>',' ',t)); t=re.sub(r'\s+',' ',t)
    # drop site nav: keep from 'WHITE PAPER' or title onwards, up to footer
    i=t.find('Download as PDF'); j=t.find('Enter your email address')
    body=t[i:j] if i>0 and j>i else t
    open(f+'.txt','w',encoding='utf8').write(body)
    print(f.split('/')[-1],len(body))
