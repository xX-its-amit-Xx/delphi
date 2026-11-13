"""Print verbatim context windows around regex matches in saved page texts.
Usage: python -I ctx.py <key> <regex> [width]"""
import re, sys
sys.stdout.reconfigure(encoding="utf8")
D = r"D:\Users\ashenoy00000\delphi-work\data\mamou-mani"
k, rx = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 200
t = open(D + "/" + k + ".txt", encoding="utf8").read()
for m in re.finditer(rx, t, re.I):
    print("...", t[max(0, m.start()-w): m.end()+w], "...\n")
