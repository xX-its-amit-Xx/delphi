import sys,re
t=open(sys.argv[1],encoding="utf8").read()
w=int(sys.argv[2]); 
for p in sys.argv[3:]:
    print("###",p)
    for m in list(re.finditer(p,t,re.I))[:6]:
        print("  ...",t[max(0,m.start()-w):m.end()+w],"\n")
