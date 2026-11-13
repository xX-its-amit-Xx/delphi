import json, os
os.chdir("D:/Users/ashenoy00000/delphi-work/agents2")

def cit(a, y, t, d, u, v):
    return {"authors": a, "year": y, "title": t, "doi_or_arxiv": d, "verified": True, "venue": v, "used_for": u,
            "how_verified": "Crossref API https://api.crossref.org/works/" + d + " returned matching title/authors/year on 2026-11-12"}

c = [
 cit("Thandiackal, Lauder", 2023, "In-line swimming dynamics revealed by fish interacting with a robotic mechanism", "10.7554/elife.81392", "Lauder paper 1", "eLife"),
 cit("Mignano, Kadapa, Drago, Lauder", 2024, "Fish robotics: multi-fin propulsion and the coupling of fin phase, spacing, and compliance", "10.1088/1748-3190/ad1dba", "Lauder paper 2", "Bioinspiration & Biomimetics"),
 cit("Zhang, Lauder", 2024, "Energy conservation by collective movement in schooling fish", "10.7554/elife.90352", "Lauder paper 3", "eLife"),
 cit("Daane, Blum, Lanni et al. (Harris lab)", 2021, "Modulation of bioelectric cues in the evolution of flying fishes", "10.1016/j.cub.2021.08.054", "Harris paper 1 (flying fish fin proportion)", "Current Biology"),
 cit("Hawkins, Henke, Harris", 2021, "Latent developmental potential to form limb-like skeletal structures in zebrafish", "10.1016/j.cell.2021.01.003", "Harris paper 2", "Cell"),
 cit("Harris", 2023, "To the fin and back again: expanding our understanding of congenital limb malformation", "10.1242/dmm.050230", "Harris paper 3", "Disease Models & Mechanisms"),
 cit("Park, Choi", 2010, "Aerodynamic characteristics of flying fish in gliding flight", "10.1242/jeb.046052", "Flying fish gliding aerodynamics (older, not recent)", "J Exp Biol"),
 cit("Nguyen, Park", 2023, "Feasibility study on mimicking the tail-beating supported gliding flight of flying fish", "10.1016/j.oceaneng.2023.115745", "Flying fish gliding, recent", "Ocean Engineering"),
 cit("Ran, Wang, Liu, Du", 2026, "Impact of the pectoral fin geometry on the gliding performance of flying fish robot", "10.1016/j.birob.2026.100318", "Flying fish robot gliding, recent", "Biomimetic Intelligence and Robotics"),
 cit("Triantafyllou, Triantafyllou, Yue", 2000, "Hydrodynamics of Fishlike Swimming", "10.1146/annurev.fluid.32.1.33", "MIT only verified fish paper (not recent)", "Annu Rev Fluid Mech"),
 cit("Matthews, Dial, Lauder", 2023, "Genes, Morphology, Performance, and Fitness: Quantifying Organismal Performance to Understand Adaptive Evolution", "10.1093/icb/icad096", "Lauder: morphology-performance link", "Integr Comp Biol"),
]

t = [
 {"name": "George V. Lauder", "fields": "affiliation=Harvard OEB / MCZ (Cambridge MA); focus=fish locomotion, fin hydrodynamics, robotic fish, schooling; papers=10.7554/elife.81392; 10.1088/1748-3190/ad1dba; 10.7554/elife.90352; flying_fish_work=none found; boston=yes", "source": "https://www.oeb.harvard.edu/people/george-v-lauder (direct fetch gave 403; facts from search summary)"},
 {"name": "Matthew P. Harris", "fields": "affiliation=Harvard Medical School Genetics + Boston Children's Hospital Orthopedic Research; focus=genetic control of fin form, fin-to-limb, flying-fish fin proportion; papers=10.1016/j.cub.2021.08.054; 10.1016/j.cell.2021.01.003; 10.1242/dmm.050230; boston=yes", "source": "https://research.childrenshospital.org/research-units/fishbone-lab"},
 {"name": "Michael S. Triantafyllou", "fields": "affiliation=MIT Mechanical and Ocean Engineering, Sea Grant; focus=biomimetic fish robots; verified_papers=only 10.1146/annurev.fluid.32.1.33 (2000); recent_fish_papers=not verified; boston=yes", "source": "https://cse.mit.edu/people/michael-s-triantafyllou"},
 {"name": "Park and Nguyen (flying fish gliding)", "fields": "focus=flying fish gliding aerodynamics and robots; papers=10.1242/jeb.046052 (2010); 10.1016/j.oceaneng.2023.115745; boston=no; affiliation not verified", "source": "https://doi.org/10.1016/j.oceaneng.2023.115745"},
]

f = [
 ("Lauder is a Harvard OEB professor at the MCZ studying fish biomechanics and robotic aquatic models", "search summary of https://www.oeb.harvard.edu/people/george-v-lauder (direct fetch 403)", "medium", ""),
 ("Harris lab studies fish to understand genetic regulation of postembryonic development; HMS Genetics and Boston Children's Orthopedics", "https://research.childrenshospital.org/research-units/fishbone-lab; Crossref affiliation of 10.1242/dmm.050230", "high", "The Harris laboratory studies fish as a model to understand the genetic regulation of 'postembryonic' development"),
 ("Harris-lab flying-fish paper: Daane et al. Current Biology 2021; DOI resolves in Crossref", "https://api.crossref.org/works/10.1016/j.cub.2021.08.054", "high", "Modulation of bioelectric cues in the evolution of flying fishes"),
 ("Preprint of that work reports sequencing 35 beloniform species and that flying-fish pectoral fin length grows rapidly with body size", "https://www.biorxiv.org/content/10.1101/2021.03.05.434157.full.pdf (search summary only; not read in full)", "low", ""),
 ("Triantafyllou holds the Doherty Professorship in Ocean Science and Engineering at MIT and pioneered biomimetic robots", "https://cse.mit.edu/people/michael-s-triantafyllou", "medium", "He pioneered the development of science-driven biomimetic robots"),
 ("Park and Choi 2010 measured aerodynamic characteristics of flying fish in gliding flight", "https://api.crossref.org/works/10.1242/jeb.046052", "high", "Aerodynamic characteristics of flying fish in gliding flight"),
 ("Hypothesis: a passive-glide surrogate could give Harris a fin-proportion to glide-performance map, testing whether fin-size changes found in flying fish help gliding", "synthesis, no source", "hypothesis", ""),
 ("Hypothesis: the elimination framework could rule out fin shape and size combinations that cannot glide, for Lauder's fin-compliance and robot work", "synthesis, no source", "hypothesis", ""),
 ("Hypothesis: a passive-glide surrogate could be a no-actuation baseline for MIT biomimetic fish robots and for tail-assisted glide models", "synthesis, no source", "hypothesis", ""),
]

out = {
 "label": "pp-fish-biomechanics-morphology",
 "topic": "Fish biomechanics, fin development and flying-fish experts, including near Boston",
 "summary": "Boston-area experts verified: Lauder (Harvard OEB/MCZ; fin and body mechanics; 3 verified recent papers), Harris (HMS/Boston Children's; fin development incl. a 2021 Current Biology flying-fish paper; 3 verified papers), Triantafyllou (MIT; biomimetic fish robots; only a 2000 paper verified, no recent fish paper found). Flying-fish gliding aerodynamics found is from outside Boston (Park and Choi 2010; Nguyen and Park 2023). Techet (MIT) searched, nothing verified. All collaborations are hypotheses.",
 "lay_summary": "We looked for scientists who study how fish fins work and grow. Near Boston, George Lauder at Harvard studies how fish swim, often with robot fish. Matthew Harris at Harvard Medical School studies the genes that set fin shape, including how flying fish got long wing-like fins. At MIT, Michael Triantafyllou builds robot fish. Each paper was checked against a public records database. Every idea of working together is only a guess, such as asking whether a simple unpowered glider model can show if a fin shape could glide at all.",
 "findings": [{"claim": a, "source": b, "confidence": c_, "evidence_quote": q} for a, b, c_, q in f],
 "key_claims": [
  {"claim": "Harris (Boston) co-authored a verified 2021 Current Biology paper on flying-fish fins", "source": "https://api.crossref.org/works/10.1016/j.cub.2021.08.054", "evidence_quote": "Modulation of bioelectric cues in the evolution of flying fishes"},
  {"claim": "Lauder's lab has verified 2023-2024 fish swimming and fin papers", "source": "https://api.crossref.org/works/10.7554/elife.81392", "evidence_quote": "In-line swimming dynamics revealed by fish interacting with a robotic mechanism"},
  {"claim": "The flying-fish gliding aerodynamics work found is outside Boston", "source": "https://api.crossref.org/works/10.1242/jeb.046052", "evidence_quote": "Aerodynamic characteristics of flying fish in gliding flight"}],
 "table": t,
 "recommendations": ["Treat all collaborations as hypotheses; Harris is the closest fit to flying-fish fin questions.", "Re-verify Triantafyllou and Techet recent fish papers by another route."],
 "glossary": [{"term": "fin ray", "plain": "the thin bony rods that support a fin"}, {"term": "gliding", "plain": "moving through air without flapping"}, {"term": "passive-glide surrogate", "plain": "a simple model that glides with no power"}, {"term": "elimination framework", "plain": "a method that rules out shapes that cannot work"}, {"term": "hydrodynamics", "plain": "how water flows around bodies"}],
 "reproduce": [
  {"what": "Verify DOIs", "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/pp-fish-biomechanics-morphology/verify.py 10.7554/elife.81392 10.1016/j.cub.2021.08.054", "expected": "lines starting OK with matching titles (Crossref sometimes returns 429; retry)"},
  {"what": "Candidate search", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/pp-fish-biomechanics-morphology/cr2.sh Lauder 'fish fin' 2021", "expected": "Lauder 2021-2024 papers"}],
 "citations": c,
 "scripts_written": ["scripts/pp-fish-biomechanics-morphology/cr.sh", "cr2.sh", "cr3.sh", "verify.py", "build.py"],
 "could_not_find": [
  "Triantafyllou and Techet recent (2022+) fish papers: Crossref searches returned only unrelated results",
  "Harvard OEB/MCZ pages returned 403; Lauder profile facts rest on search summaries",
  "Published Harris Current Biology text not read; genome statements come from preprint search summary",
  "Fin-ray (lepidotrichia) evolution specialists beyond Harris not verified",
  "Park and Nguyen affiliations not verified",
  "Dropped one DOI (10.1088/1748-3190/ab23e6) because Crossref returned 429"]
}
json.dump(out, open("pp-fish-biomechanics-morphology.json", "w"), indent=1)
print("ok")
