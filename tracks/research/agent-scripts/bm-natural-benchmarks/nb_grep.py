"""usage: python nb_grep.py file.txt regex [width] [max]  (whitespace-normalised)"""
import sys,re
t=re.sub(r'\s+',' ',open(sys.argv[1],encoding="utf8",errors="replace").read()); w=int(sys.argv[3]) if len(sys.argv)>3 else 300; mx=int(sys.argv[4]) if len(sys.argv)>4 else 8
for m in list(re.finditer(sys.argv[2],t,flags=re.I))[:mx]:
    print("...",t[max(0,m.start()-w):m.end()+w],"...\n")
