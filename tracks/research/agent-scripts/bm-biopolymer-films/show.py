#!/usr/bin/env python3
"""show.py NAME [start] [n] : print chars of scratch/NAME.txt (whitespace-collapsed). or show.py NAME -g regex [width]"""
import sys,re
n=sys.argv[1]; t=re.sub(r"\s+"," ",open(rf"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films/{n}.txt",encoding="utf8",errors="ignore").read())
if len(sys.argv)>2 and sys.argv[2]=="-g":
    w=int(sys.argv[4]) if len(sys.argv)>4 else 200
    for m in list(re.finditer(sys.argv[3],t,re.I))[:10]:
        s=max(0,m.start()-w); print("...",t[s:m.end()+w],"...\n")
else:
    a=int(sys.argv[2]) if len(sys.argv)>2 else 0; k=int(sys.argv[3]) if len(sys.argv)>3 else 4000
    print(t[a:a+k])
