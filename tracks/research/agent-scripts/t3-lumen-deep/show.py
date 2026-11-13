import sys,re
D='D:/Users/ashenoy00000/delphi-work/agents2/scratch/t3-lumen-deep/'
f=sys.argv[1]; t=open(D+f+'.txt',encoding='utf8').read()
if len(sys.argv)==2: print(t[:int(5000)]); sys.exit()
a=sys.argv[2]
if a.isdigit(): print(t[int(a):int(a)+int(sys.argv[3])]); sys.exit()
for m in re.finditer(a,t,re.I):
    s=max(0,m.start()-int(sys.argv[3])//2); print('>>',t[s:s+int(sys.argv[3])],'\n')
