import re,html,sys,subprocess
sys.stdout.reconfigure(encoding='utf8')
def scope(url):
    r=subprocess.run(['curl','-sL','-m','40','-A','delphi-research/0.1','-w','\n%{http_code}',url],capture_output=True)
    b=r.stdout.decode('utf8','ignore'); code=b.rsplit('\n',1)[-1]
    t=re.sub(r'<script.*?</script>|<style.*?</style>',' ',b,flags=re.S)
    t=html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',t)))
    i=t.find('Scope Give feedback')
    title=re.search(r'<title>(.*?)</title>',b,flags=re.S)
    return code,(title.group(1).strip() if title else ''),(t[i+19:i+19+700] if i>=0 else t[:200])
if __name__=='__main__':
    for u in sys.argv[1:]:
        c,ti,s=scope(u); print(u,c,ti); print('  ',s); print()
