"""Usage: python -I grep_txt.py file.txt regex [width] [maxhits] -- prints non-overlapping context snippets around matches."""
import sys,re
sys.stdout.reconfigure(encoding="utf-8")
t=open(sys.argv[1],encoding="utf-8").read(); w=int(sys.argv[3]) if len(sys.argv)>3 else 200
mx=int(sys.argv[4]) if len(sys.argv)>4 else 12
last=-1;n=0
for m in re.finditer(sys.argv[2],t):
    if m.start()<last: continue
    print("...",t[max(0,m.start()-w):m.end()+w],"...\n"); last=m.end()+w; n+=1
    if n>=mx: break
