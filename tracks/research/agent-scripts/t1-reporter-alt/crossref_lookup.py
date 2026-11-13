"""Look up each title in Crossref and save top hit (DOI, title, year, first author, container).
Usage: python -I crossref_lookup.py OUT.json   (queries listed below)"""
import json, sys, urllib.parse, urllib.request, time
Q = [
 "Quantitative dissection of the simple repression input-output function Garcia Phillips",
 "Tuning transcriptional regulation through signaling: a predictive theory of allosteric induction",
 "The transcription factor titration effect dictates level of gene expression",
 "Molecular titration and ultrasensitivity in regulatory networks",
 "Protein sequestration generates a flexible ultrasensitive response in a genetic network",
 "Resource competition shifts the response of genetic circuits",
 "Escherichia coli Marionette strains with 12 highly optimized small-molecule sensors",
 "Composability of regulatory sequences controlling transcription and translation in Escherichia coli",
 "Automated design of synthetic ribosome binding sites to control protein expression",
 "Quantifying cellular capacity identifies gene expression designs with reduced burden",
 "Regulation of noise in the expression of a single gene",
 "Genetic circuit design automation Nielsen Voigt Science 2016",
 "Mismatch-CRISPRi reveals the co-varying expression-fitness relationships of essential genes in Escherichia coli and Bacillus subtilis",
 "Systematic approach for dissecting the molecular mechanisms of transcriptional regulation in bacteria Belliveau",
 "Complex signal processing in synthetic gene circuits using cooperative regulatory assemblies",
 "Transcriptional regulation by the numbers: models Bintu Phillips",
 "Genomic mining of prokaryotic repressors for orthogonal logic gates",
 "Predictable tuning of protein expression in bacteria bicistronic design",
]
out = []
for q in Q:
    url = "https://api.crossref.org/works?rows=3&select=DOI,title,issued,author,container-title&query.bibliographic=" + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={"User-Agent": "delphi-research/0.1"})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=40))
        hits = [{"doi": i["DOI"], "title": (i.get("title") or [""])[0], "year": (i.get("issued", {}).get("date-parts") or [[None]])[0][0],
                 "first_author": (i.get("author") or [{}])[0].get("family"), "venue": (i.get("container-title") or [""])[0]} for i in d["message"]["items"]]
    except Exception as e:
        hits = [{"error": str(e)}]
    out.append({"query": q, "hits": hits}); time.sleep(0.5)
json.dump(out, open(sys.argv[1], "w"), indent=1)
for o in out:
    print("Q:", o["query"][:70]); 
    for h in o["hits"][:2]: print("   ", h)
