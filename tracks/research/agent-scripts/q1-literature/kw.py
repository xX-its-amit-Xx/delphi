import re,sys
f=sys.argv[1]; w=int(sys.argv[2]); n=int(sys.argv[3])
t=open(f,encoding='utf8').read()
for k in sys.argv[4:]:
    for m in list(re.finditer(k,t))[:n]:
        print('##',k,':',t[max(0,m.start()-w):m.start()+w].encode('ascii','replace').decode(),'\n')
