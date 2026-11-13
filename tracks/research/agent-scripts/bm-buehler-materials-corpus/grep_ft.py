# Usage: python -I grep_ft.py <file> <regex> [width]  -> print matching snippets (case-insens)
import sys,re
sys.stdout.reconfigure(encoding='utf8')
t=open(sys.argv[1],encoding='utf8').read(); t=re.sub(r'\s+',' ',t)
w=int(sys.argv[3]) if len(sys.argv)>3 else 220
n=0
for m in re.finditer(sys.argv[2],t,re.I):
    s=max(0,m.start()-w); e=min(len(t),m.end()+w)
    print('...',t[s:e],'...\n'); n+=1
    if n>=12: break
print('matches shown',n)
