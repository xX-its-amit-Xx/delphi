"""usage: txt.py in.html out.txt  -- strip html to text (ascii-safe print)"""
import re,html,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=open(sys.argv[1],encoding='utf-8',errors='replace').read()
t=re.sub(r'<(script|style)[^>]*>.*?</\1>',' ',s,flags=re.S)
t=html.unescape(re.sub(r'<[^>]+>',' ',t)); t=re.sub(r'\s+',' ',t)
open(sys.argv[2],'w',encoding='utf-8').write(t)
print(len(t))
