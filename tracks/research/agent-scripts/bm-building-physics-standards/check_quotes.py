import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf8')
from quotes import Q
from srcs import check
bad=0
for name,(key,text) in Q.items():
    n=len(text.split())
    r=check(key,text)
    flag='' if r=='exact' else '  <<<<<'
    if n>40: flag+=' TOO LONG(%d)'%n
    if r!='exact' or n>40:
        print(name,r,n,flag); bad+=1
print('checked',len(Q),'problems',bad)
