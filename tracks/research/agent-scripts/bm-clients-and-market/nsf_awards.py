"""Query the public NSF Awards API for SBIR/STTR awards matching keywords. Saves raw JSON under data/bm-clients-market/nsf/.
Usage: python -I nsf_awards.py "keyword phrase" [fundProgramName]"""
import sys, json, urllib.request, urllib.parse, hashlib, os, datetime
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
D = r"D:/Users/ashenoy00000/delphi-work/data/bm-clients-market/nsf"; os.makedirs(D, exist_ok=True)
kw = sys.argv[1]; prog = sys.argv[2] if len(sys.argv) > 2 else "SBIR Phase I"
q = {"keyword": kw, "fundProgramName": prog, "printFields": "id,title,awardeeName,awardeeStateCode,startDate,estimatedTotalAmt,fundProgramName,piLastName_redacted", "rpp": 25}
q["printFields"] = "id,title,awardeeName,awardeeStateCode,startDate,estimatedTotalAmt,fundProgramName"
url = "https://api.nsf.gov/services/v1/awards.json?" + urllib.parse.urlencode(q)
req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
body = urllib.request.urlopen(req, timeout=60).read()
fn = os.path.join(D, f"{prog.replace(' ','_')}__{kw.replace(' ','_')}.json"); open(fn, "wb").write(body)
print(url, "\nbytes", len(body), "sha256", hashlib.sha256(body).hexdigest(), datetime.date.today())
j = json.loads(body)
for a in j.get("response", {}).get("award", []):
    print(a["id"], a.get("startDate"), a.get("estimatedTotalAmt"), a.get("awardeeName"), "|", a.get("title")[:110])
