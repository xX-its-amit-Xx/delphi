# usage: python grep_text.py FILE.xml regex [maxhits] [ctx]  -- prints verbatim context from an NCBI/EPMC XML full text
import re,sys
sys.stdout.reconfigure(encoding='utf-8')
s=open(sys.argv[1],encoding='utf-8').read(); s=re.sub(r'<[^>]+>',' ',s); s=re.sub(r'\s+',' ',s)
mx=int(sys.argv[3]) if len(sys.argv)>3 else 4; c=int(sys.argv[4]) if len(sys.argv)>4 else 250
for m in list(re.finditer(sys.argv[2],s))[:mx]: print('>>',s[max(0,m.start()-c):m.end()+c],'\n')
