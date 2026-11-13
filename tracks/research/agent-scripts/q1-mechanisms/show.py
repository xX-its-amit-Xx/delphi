import sys; sys.stdout.reconfigure(encoding="utf-8")
import json,sys
d=json.load(open(sys.argv[1],encoding="utf-8"))
for k,v in d.items():
    if len(sys.argv)>2 and k not in sys.argv[2:]: continue
    print("\n##",k,v["title"],v["year"],v["journal"],"\n",v["abstract"])
