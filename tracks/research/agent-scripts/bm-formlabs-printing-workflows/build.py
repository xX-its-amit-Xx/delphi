"""Assemble and write the final result JSON; verify all quotes. Run: python build.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_part1 as p
import build_part2, build_part3
from build_part1 import F
import build_part4 as q

# extra contradiction / confirmation findings
F("CONTRADICTS design-biomaterial.json: it reads Flexible 80A V2 as losing 28 Shore A points after one day in water ('my row count'). With rows assigned to solvents by vertical position the 1-day water hardness change is -26 (week -27); 28 corresponds to no water row. The sibling spec-formlabs-materials.json value (26) is correct.",
  "flex80_tds", "medium", "water hardness: -26 (1 d), -27 (1 wk)",
  "Rectangular slabs, used for hardness, mass, and volume change, are evaluated immediately after wiping dry without a conditioning period.", src2=["project"])
F("CONFIRMS spec-formlabs-materials.json: the Form 4 minimum supported / unsupported wall is 0.2 mm and no value is published for elastomers; and no Formlabs page offers multi-material printing in one job.",
  "design", "high", "0.2 mm; Grey V5 only",
  "Recommended: 0.2 mm/200 microns")
F("CONFIRMS spec-resin-chemistry.json on IPA: Flexible 80A (unversioned row) 11.7 %, Elastic 50A V2 39.2 %, and on the solvent table being easy to misread (Elastic 50A V2 xylene 163.9 %, water 0.7 %).",
  "solvent", "high", "as stated",
  "Flexible 80A Resin | 0.9 | 37.4 | 0.6 | 51.4 | 2.3 | 19.3 | 1 | 0.7 | 1.6 | 11.7 |")

SUMMARY = (
"Can a bilayer strip be printed on Formlabs hardware? Not in one job. A Form 4 job holds one resin: the manual says changing resin means changing both the tank and the cartridge, and I found no Formlabs page that offers two resins per job (one Insider-release line, 'multi-material capability across multiple build volumes', is unexplained). So a two-layer strip is two prints plus a bond; Open Material Mode (a paid per-printer licence, reseller price about $3.7k, low confidence) is only needed for non-Formlabs resins such as a hydrogel. "
"Confirmed: stock resins barely take up water in Formlabs' 1 cm cube test, Elastic/Flexible 50A takes 39.2 % IPA against under 0.1 % for Rigid 10K. Contradicted: the blanket 'every current resin gains under 1 % mass in water' (spec-resin-chemistry.json); the Flexible 80A V2 data sheet gives +8 % mass, +3 % volume in 1 day (ASTM D471 slabs), and design-biomaterial.json's -28 Shore A should read -26. "
"Deeper: (1) printing a strip flat on the platform loses about 0.1 mm of thickness to first-layer compression, which is half of a 0.2 mm layer, and the Timoshenko factor for a stiff-on-soft pair drops from 1.13 to 0.61 as the Tough 1000 layer grows from 0.2 to 0.3 mm, so every strip's layers must be measured; (2) the ceiling of 3/2 needs the stiff layer to be 0.07 mm (Tough 1000) or 0.02 mm (Rigid 10K) thick for a 1 mm strip with Flexible 80A V2, below the 0.2 mm wall Formlabs lists, so Rigid 10K is a poor passive partner; (3) the IPA wash, not humidity, is the dominant swelling event (Flexible 80A V2 +45 % mass in IPA in a day; a thin strip equilibrates in minutes by a scaling estimate), so wash and dry each layer before bonding and never re-wash the bonded stack; (4) a 1 mm tip sag over 40 mm is a curvature of 1.25 1/m, equal to the ceiling signal of a 0.083 % strain, so print curl must be measured and subtracted. "
"No source measures bond strength to a green first layer, curl of 0.2-1 mm strips on a Formlabs printer, Z tolerance, or elastomer minimum walls; those are guesses to settle with a pilot. The step-by-step plan and the guess list are in 'recommendations'."
)

LAY = (
"Think of gluing a thin strip of hard plastic to a thin strip of rubber. If one side swells and the other does not, the pair curls, like a drying leaf. A Formlabs printer can only print one kind of liquid plastic at a time, so we must print the two strips in two separate runs and glue them. The surprise is that the washing alcohol swells the rubber far more than water does, and a thin strip also comes out about a tenth of a millimetre thinner than drawn, which for a strip only two-tenths of a millimetre thick is huge. So each strip has to be measured, washed, dried, and only then glued. We still do not know how well glue holds on a half-hardened strip, so the plan includes a test of that."
)

result = {
 "label": "bm-formlabs-printing-workflows",
 "topic": "How to actually print a bilayer on Formlabs hardware",
 "summary": SUMMARY,
 "lay_summary": LAY,
 "findings": p.FINDINGS,
 "key_claims": p.KEY_CLAIMS,
 "table": q.TABLE,
 "recommendations": q.PLAN + q.GUESSES,
 "reproduce": q.REPRODUCE,
 "citations": q.CITATIONS,
 "could_not_find": q.COULD_NOT_FIND,
 "glossary": q.GLOSSARY,
 "scripts_written": [
   "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-formlabs-printing-workflows/" + n for n in
   ("fetch.py", "solvent_table.py", "flex80_d471.py", "calc.py", "crossref_doi.py", "crossref_search.py", "epmc_search.py", "pdf_table_words.py", "build.py", "build_part1.py", "build_part2.py", "build_part3.py", "build_part4.py")],
}
print("findings", len(p.FINDINGS), "key_claims", len(p.KEY_CLAIMS), "quote failures:", len(p.FAILS))
for s, qq in p.FAILS: print("  FAIL", s, "|", qq[:100])
if not p.FAILS:
    out = "D:/Users/ashenoy00000/delphi-work/agents2/bm-formlabs-printing-workflows.json"
    json.dump(result, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("wrote", out, os.path.getsize(out), "bytes")
