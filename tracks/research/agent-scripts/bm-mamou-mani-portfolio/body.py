"""Print the main body (from 'YEAR:' to 'Post navigation') of a saved project page text. Usage: python -I body.py key [maxchars]"""
import sys, re
sys.stdout.reconfigure(encoding="utf8")
t = open(r"D:\Users\ashenoy00000\delphi-work\data\mamou-mani\%s.txt" % sys.argv[1], encoding="utf8").read()
n = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
i = t.find("YEAR:"); j = t.find("Post navigation")
print(sys.argv[1], i, j); print(t[max(i,0): (j if j>0 else None)][:n])
