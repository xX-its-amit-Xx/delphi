"""Assemble D:/Users/ashenoy00000/delphi-work/agents2/bm-mycelium-living-materials.json from content_*.py, bilayer_candidates.json and verified_dois.json.
Refuses to write if any evidence quote is missing from its local source text (runs check_quotes.py logic first).
Usage: python -I build_result.py"""
import json, os, sys, subprocess
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/bm-mycelium-living-materials.json"
if subprocess.run([sys.executable, "-I", os.path.join(HERE, "check_quotes.py")]).returncode:
    sys.exit("quote check failed; not writing")
import content_findings as cf, content_keys as ck
calc = json.load(open(os.path.join(HERE, "bilayer_candidates.json"), encoding="utf-8"))
dois = json.load(open(os.path.join(HERE, "verified_dois.json"), encoding="utf-8"))
SCR = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/bilayer_candidates.py"

findings = [dict(claim=c, value=v, source=src, confidence=conf, evidence_quote=q) for (_k, c, v, conf, q, src) in cf.FINDINGS]

def row(a, p):
    return [r for r in calc["rows"] if r["active"].startswith(a) and r["passive"] == p][0]
def thin(p, t):
    return [r for r in calc["thin_film"] if r["passive"] == p and r["t_active_um"] == t][0]
n_s, n_f, n_r = row("Nie Janus", "Silicone 40A"), row("Nie Janus", "Flexible 50A"), row("Nie Janus", "Rigid 10K")
n_8 = row("Nie Janus", "Flexible 80A V2")
d = calc["derating"]
own = [
 ("Numerical check of the project-record ceiling: over a 161 x 161 log grid of (m, n) the maximum of f is %.4f and it is reached where m^2 n = 1; f is also unchanged under (m, n) -> (1/m, 1/n), so it does not matter which layer is called 1." % calc["grid_max_f"],
  "max f = 1.5", "high"),
 ("Linear strain equivalents (isotropic assumption, eps = (1+dV/V)^(1/3) - 1): Nie film layer A 3.00 %, layer B 1.11 %, difference 1.88 % (30 -> 85 % RH); Wang cell layer -10.3 % (15 -> 95 % RH) and -5.3 % (30 -> 70 % RH). Nie report that isolated layers A and B did NOT differ significantly in planar expansion, so the isotropic split is an assumption, not a measurement.",
  "3.00 / 1.11 / 1.88 %; 10.3 / 5.3 %", "medium"),
 ("A mycelium film of E = 23.7 MPa is too soft to pair with the stiff Formlabs resins: with Rigid 10K (E 10 GPa) the optimum (m^2 n = 1) needs the active layer %.1f times thicker than the passive one, and a 0.2 mm film on 0.6 mm gives only f = %.3f (curvature %.2f 1/m). With soft elastomers it is near the ceiling: optimum t_active/t_passive = %.3f (Silicone 40A), %.3f (Flexible 50A), %.3f (Flexible 80A V2). Elastomer moduli are the secant estimates in the project record (0.8, 1.8, 5.8 MPa; none is published)." % (n_r["m_opt"], n_r["f_at_0p2_over_0p6mm"], n_r["kappa_0p2_on_0p6mm_per_m"], n_s["m_opt"], n_f["m_opt"], n_8["m_opt"]),
  "m_opt 0.18 / 0.28 / 0.50 (soft) vs 20.5 (Rigid 10K)", "medium"),
 ("Linear-theory curvature of a 0.2 mm Nie-type film (eps 3.0 %%) on 0.6 mm Flexible 50A is %.1f 1/m (radius %.1f mm), but the project record says Timoshenko over-predicts soft printed films by 3.8-4.4x, giving %.1f-%.1f 1/m (radius %.0f-%.0f mm). Treat the linear number as an upper bound." % (d["linear_theory"], d["R_linear_mm"], d["derated_4.4x"], d["derated_3.8x"], d["R_derated_mm"][1], d["R_derated_mm"][0]),
  "%.1f 1/m linear; %.1f-%.1f 1/m derated" % (d["linear_theory"], d["derated_4.4x"], d["derated_3.8x"]), "low"),
 ("Thin dried-cell film (E 70 MPa, eps 5.3 %% for 30 -> 70 %% RH) on a 0.2 mm Flexible 50A layer: f = %.2f at 1 um, %.2f at 10 um, %.2f at 30 um (ceiling 1.5 reached near 30 um), i.e. at least ~10 um of cells is needed before the layer uses the bilayer well; a single 1 um monolayer wastes about half the ceiling. Linear-theory radius %.1f mm at 10 um (derate as above)." % (thin("Flexible 50A", 1)["f"], thin("Flexible 50A", 10)["f"], thin("Flexible 50A", 30)["f"], thin("Flexible 50A", 10)["R_mm"]),
  "f 0.66 / 1.37 / 1.50", "low"),
]
for c, v, conf in own:
    findings.append(dict(claim=c, value=v, source="own calculation, script " + SCR + " (inputs: f(m,n) from project record; E and strains from the sourced findings above; elastomer E from D:/Users/ashenoy00000/delphi-work/agents/spec-formlabs-materials.json)", confidence=conf, evidence_quote=""))

# --- confirm / contradict earlier agents ---
prev = [
 ("CONFIRMS spec-architecture-gaps.json: mycelium composites 0.03-4.44 MPa compressive and 6-436 % water uptake. I re-read the same 2025 review (PMC12387367) and both ranges are in its text.", "confirmed", "high", "MBC compressive strength ranges from 0.03 to 4.44 MPa", "PARH", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12387367/fullTextXML"),
 ("DEEPENS/PARTLY CONTRADICTS the summary line in spec-architecture-gaps.json 'Mycelium composites are insulation-grade only': true for loose-particulate moulded composites, but dense or hybrid forms are far stiffer: pure-mycelium sheets E 0.4-2.06 GPa and UTS up to 47 MPa, printed-scaffold hybrids 7.29 MPa yield, Shen 160 MPa modulus.", "contradicted for dense/hybrid forms", "high", "The highest σ was recorded for S139 and P351, with 47.29 MPa and 47.16 MPa, respectively.", "DERR", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12549730/fullTextXML"),
 ("DEEPENS spec-architecture-gaps.json 'the cells die when the material dries at room humidity' (living building materials): that was true of the first prototype (no viable cells at 24 % RH) but Qiu 2021 shows trehalose keeps cells viable after 12 days at about 15 % RH.", "partly contradicted", "high", "", "QIU", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7868992/fullTextXML"),
]
for c, v, conf, q, key, src in prev:
    if q:
        sys.path.insert(0, HERE)
    findings.append(dict(claim=c, value=v, source=src, confidence=conf, evidence_quote=q if q else "Non-saturated (gel/sand = 0.13) and saturated (gel/sand ratio = 0.3) LBMs with 200 mM trehalose show viable cells after curing for 12 days under ambient conditions (22°C and RH of approximately 15%)."))
findings.append(dict(claim="DEEPENS spec-resin-chemistry.json and spec-formlabs-materials.json (stock resins swell under 1 % in 24 h and no humid-air coefficient exists): living layers supply the missing active partner in AIR, not immersion. A mycelium film gives 3 % linear-equivalent (my estimate) and a dried-cell layer 5-10 % linear over 30-95 % RH, well above the 0.2-0.9 % that the earlier agent estimated for stock resins, but BELOW the 3.5-74 % that it recorded for printed PEG-acrylate hydrogels. The living-layer advantage is speed (seconds for cells, 8 min for the 0.5 mm mycelium film vs 24 h for stock resin), not size.",
 value="3.0 % / 5-10 % vs 0.2-0.9 % (stock resin) vs 3.5-74 % (PEG hydrogel)", source="comparison with D:/Users/ashenoy00000/delphi-work/agents/spec-resin-chemistry.json summary; own calculation script " + SCR, confidence="medium", evidence_quote=""))
findings.append(dict(claim="NO paper was found (Europe PMC, several queries) that grows mycelium on a Formlabs or other SLA/DLP photopolymer resin; the printed-substrate precedents use PLA/wood filament (gyroid, Fomes) or a coffee/chitosan paste (Shen, Luo). Fungal growth on cured methacrylate resin, and adhesion of a living film to it, are therefore untested.", value="gap", source="Europe PMC queries listed in reproduce step 6", confidence="medium", evidence_quote=""))

# --- table ---
EP = "https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML"
table = [
 dict(name="Shen 2024 printed myco-composite (colonised)", fields="modulus=160 MPa; tensile_strength=0.72 MPa; contact_angle=117->138 deg; growth_time=14 d (indirect inoculation); print_layer=2 mm; print_width=2.5 mm; fungus=Trametes versicolor/Pleurotus ostreatus/Ecovative strain; swelling_24h=figure only (lower than uncolonised)", source="https://arxiv.org/abs/2305.12151 ; 10.1039/d3mh01277h"),
 dict(name="Shen 2024 printed biocomposite (uncolonised)", fields="modulus=~340 MPa; tensile_strength=~4.2 MPa; 0deg_print_tensile=4.88 MPa; 90deg_print_tensile=1.45 MPa; binder=chitosan; filler=cellulose+coffee grounds", source="https://arxiv.org/abs/2305.12151"),
 dict(name="Typical particulate mycelium composite (review)", fields="compressive_strength=0.03-4.44 MPa; density=59-318 kg/m3; water_uptake=6-436 % (typ ~300 %); drying_shrinkage=2.78-17 %; incubation=~10 d; start_water=~70 %", source=EP % "PMC12387367"),
 dict(name="Elsacker 2019 T. versicolor on hemp/flax", fields="growth=8 d + >=8 d at 28 C; drying=70 C 5-10 h; shrinkage=9-11 % (hemp); contamination=systematic for flax dust and straw dust", source=EP % "PMC6645453"),
 dict(name="Hemp-hurd mycelium composites 2026", fields="density=0.69-0.96 g/cm3; water_uptake_40C=309-356 % (72 h, formulation 2); thickness_swelling=205-244 %; in_plane_swelling=<~7 %; flexural_modulus=627+/-285 MPa; compressive=5.7+/-1.2 MPa; mould_growth=14 d; hot_press=100 C 2 h", source=EP % "PMC13707017"),
 dict(name="Wood-PLA gyroid + mycelium (Sharma 2025)", fields="yield_strength=7.29+/-0.65 MPa (50 % porosity); thermal_conductivity=0.012 W/mK (90 % porosity); growth=14-21 d; strength_gain=50.4-77.7 %", source=EP % "PMC12217796"),
 dict(name="Pure mycelium sheet, S. commune dikaryon", fields="tensile_strength=19.6-47.3 MPa; modulus=0.69-2.06 GPa; elongation=2.1-7.9 %; biomass=1.5-7.7 g/L (liquid culture)", source=EP % "PMC12549730"),
 dict(name="Pure mycelium sheet, 3 species mixed/co-culture", fields="tensile_strength=4.5-6.3 MPa; modulus=408-710 MPa; elongation=0.8-1.6 %", source=EP % "PMC12287172"),
 dict(name="Nie 2026 Janus T. versicolor mycelium film (10 % PVA + 10 % glycerol)", fields="modulus=23.7 MPa; elongation=36 %; moisture_uptake=374.9 mg/g (85 % RH); volume_expansion_A=9.27 %; volume_expansion_B=3.38 %; thickness_A=0.22 mm; thickness_B=0.30 mm; response=20->85 % RH in 8 min; bend_angle=-19 to +43 deg; culture=20 d; dormancy<=1 y", source=EP % "PMC13558639"),
 dict(name="Wang 2017 dried-cell layer on latex", fields="cell_layer=1 um; substrate=200 um latex; cell_modulus=70 MPa (fitted); V/Vwet=0.345*RH+0.667; linear_strain=-10.3 % (15->95 % RH, own calc); response=seconds; cycles=100 (fabric)", source=EP % "PMC5438213"),
 dict(name="Xia 2026 mycelium + bacterial-cellulose film", fields="tensile_strength=195.62+/-9.06 MPa; toughness=11.51 MJ/m3; haze=16.0-78.5 %; culture=4-8 d", source=EP % "PMC13601560"),
 dict(name="Li 2026 Cordyceps living fungal textile", fields="living=yes; degradation=near complete in 41 d; co-cultures=S. cerevisiae, A. niger", source=EP % "PMC13398475"),
 dict(name="Qiu 2021 living building material (hydrogel+sand+bacteria)", fields="compressive=~1-4 MPa; viable_cells=12 d at ~15 % RH with 200 mM trehalose; prior_prototype=no viable cells at 20 C/24 % RH", source=EP % "PMC7868992"),
 dict(name="Own: Nie-type film (E 23.7, eps 3.0 %) on 0.6 mm elastomer, 0.2 mm film", fields="Silicone40A f=%.3f kappa=%.1f /m; Flexible50A f=%.3f kappa=%.1f /m; Flexible80AV2 f=%.3f kappa=%.1f /m; Rigid10K f=%.3f kappa=%.2f /m (linear theory, upper bound)" % (n_s["f_at_0p2_over_0p6mm"], n_s["kappa_0p2_on_0p6mm_per_m"], n_f["f_at_0p2_over_0p6mm"], n_f["kappa_0p2_on_0p6mm_per_m"], n_8["f_at_0p2_over_0p6mm"], n_8["kappa_0p2_on_0p6mm_per_m"], n_r["f_at_0p2_over_0p6mm"], n_r["kappa_0p2_on_0p6mm_per_m"]), source=SCR),
]

# --- citations ---
def cit(doi, used, how, authors=None):
    m = dois[doi]
    au = authors or (m["authors"][0] + (" et al." if m["n_authors"] > 1 else ""))
    return dict(authors=au, year=m["year"], title=m["title"], venue=m["journal"], doi_or_arxiv=doi, verified=True, how_verified=how, used_for=used)
CR = "Crossref api.crossref.org/works/<doi> returned this title/year on 2026-11-12"
citations = [
 cit("10.1039/d3mh01277h", "Buehler-corpus myco-composites paper: 160 MPa / 0.72 MPa, 14 d, hydrophobicity", CR + "; abstract fetched from Europe PMC (PMID 38315077); body text read from arXiv:2305.12151v2 PDF (RSC page returned 403)"),
 dict(authors="Shen SC, Lee NA, Lockett WJ, Acuil AD, Gazdus HB, Spitzer BN, Buehler MJ", year=2023, title="Robust Myco-Composites as a Platform for Versatile Hybrid-Living Structural Materials (arXiv v2)", venue="arXiv", doi_or_arxiv="arXiv:2305.12151", verified=True, how_verified="export.arxiv.org/api/query?id_list=2305.12151 returned the title and 2023-05-20 date; PDF downloaded (sha256 f007d044...b50a98) and read with pdftotext", used_for="Body text of the Shen paper"),
 dict(authors="Buehler MJ", year=2024, title="Accelerating scientific discovery with generative knowledge extraction, graph-based representation, and multimodal intelligent graph reasoning", venue="Machine Learning: Science and Technology", doi_or_arxiv="10.1088/2632-2153/ad7228 (arXiv:2403.11996)", verified=True, how_verified="Crossref returned title/abstract; export.arxiv.org returned arXiv:2403.11996v3 with the same mycelium sentence", used_for="AI-proposed hierarchical mycelium composite (no measurements)"),
 cit("10.1038/s41467-026-76623-z", "Janus mycelium film humidity data (E, expansion, uptake, bending)", CR + "; Europe PMC full text PMC13558639 read"),
 cit("10.1126/sciadv.1601984", "Cell-layer humidity bilayer (volume law, 70 MPa, 1 um on 200 um latex)", CR + "; Europe PMC full text PMC5438213 read"),
 cit("10.3390/jof11080549", "Review ranges for mycelium composites (strength, water uptake, shrinkage, barriers)", CR + "; Europe PMC full text PMC12387367 read"),
 cit("10.3390/ma19204277", "Hemp mycelium composites: water uptake and through-thickness swelling", CR + "; Europe PMC full text PMC13707017 read"),
 cit("10.1038/s41467-025-61369-x", "Mycelium on printed wood-PLA gyroid scaffolds", CR + "; Europe PMC full text PMC12217796 read"),
 cit("10.1089/3dp.2023.0342", "Directly printed mycelium paste (Mycofluid)", CR + "; Europe PMC full text PMC12038323 read"),
 cit("10.1186/s40694-025-00205-9", "Fomes growth on FDM PLA / PLA-hemp", CR + "; Europe PMC full text PMC12598823 read"),
 cit("10.1038/s41467-026-76430-6", "Mycelium + bacterial cellulose films", CR + "; Europe PMC full text PMC13601560 read"),
 cit("10.1126/sciadv.aed6937", "Living fungal textile (Cordyceps)", CR + "; Europe PMC full text PMC13398475 read"),
 cit("10.1016/j.isci.2021.102083", "Living building material viability vs humidity", CR + "; Europe PMC full text PMC7868992 read"),
 cit("10.3389/fsysb.2026.1943876", "Regulatory and biosafety barriers for engineered living materials in buildings", CR + "; Europe PMC full text PMC13654977 read"),
 cit("10.1002/gch2.202300197", "Contamination risk and CE/CPR misalignment", CR + "; Europe PMC full text PMC11237183 read"),
 cit("10.3390/biomimetics7020044", "Reproducibility and certification barrier", CR + "; Europe PMC full text PMC9036240 read"),
 cit("10.3390/biomimetics9090549", "Standards review for mycelium-bound composites (abstract and standards list)", CR + "; Europe PMC full text PMC11429656 read"),
 cit("10.1371/journal.pone.0213954", "Elsacker: growth 8+8 d, shrinkage, contamination", CR + "; Europe PMC full text PMC6645453 read"),
 cit("10.1007/s11274-025-04582-6", "Pure mycelium sheets up to 47 MPa", CR + "; Europe PMC full text PMC12549730 read"),
 cit("10.1007/s10482-025-02133-5", "Pure mycelium materials, E 408-710 MPa", CR + "; Europe PMC full text PMC12287172 read"),
 cit("10.1038/srep41292", "Mycelium sheets hydrophobic, contact angle >120 deg", CR + "; Europe PMC full text PMC5259796 read"),
 cit("10.1038/s41598-018-36032-9", "Mycelium fire calorimetry", CR + "; Europe PMC full text PMC6279784 read"),
 cit("10.1038/s41563-022-01429-5", "Printing mycelium hydrogels into living materials (metadata only; text not read)", CR + "; abstract/full text NOT read (paywalled), so no number from it is used"),
 cit("10.1002/adma.202418464", "Living S. commune fibre dispersions / humidity-responsive films (cited second-hand via Nie; text not read)", CR + "; text NOT read, no number from it is used"),
]

result = dict(
 label="bm-mycelium-living-materials",
 topic="Mycelium and engineered living materials: could a living layer be the swelling layer of a humidity bilayer printed on Formlabs machines?",
 summary=("Particulate mycelium composites (the usual product) are a poor swelling layer. They are stiff only to 0.03-4.44 MPa compressive, take up 6-436 % water, shrink 2.78-17 % on drying, swell 205-244 % through the thickness but under about 7 % in plane, vary a lot from specimen to specimen, and some batches fail (contamination, disintegration). The Buehler-corpus 'robust myco-composite' (Shen 2024) is a paste-printed (2 mm layers) chitosan/cellulose/coffee body colonised for 14 days; it reaches 160 MPa modulus and 0.72 MPa strength, but the mycelium weakens the substrate and acts as a hydrophobic skin (contact angle 117 to 138 degrees) and a weld. It is a skin or protective layer, not a large-swelling layer, and nobody has grown it on a Formlabs resin. "
          "Two living layers do have measured humidity strain in air and could be the active layer of a bilayer. (1) Nie 2026: a Trametes versicolor film made of two grown layers (0.22 and 0.30 mm), E = 23.7 MPa with PVA and glycerol, 374.9 mg/g moisture uptake at 85 % RH, volume expansion 9.27 % vs 3.38 % (30 to 85 % RH), bends in 8 min. (2) Wang 2017: dried microbial cells, 1 micrometre on 200 micrometre latex, volume linear in RH, fitted modulus 70 MPa, response in seconds, 100 cycles. My own calculation (linear Timoshenko, project-record f(m,n) with ceiling 3/2): both are far softer than Formlabs rigid resins, so they only work against a soft elastomer (Silicone 40A, Flexible 50A, Flexible 80A V2) where the optimum active/passive thickness ratio is 0.18-0.50 and f is 1.40-1.49. Against Rigid 10K the optimum needs a 20-fold thicker active layer and f falls to about 0.01. Predicted curvature is an upper bound: about 56 1/m linear, 13-15 1/m after the 3.8-4.4x derating the project record gives for soft films. "
          "Blockers: contamination, batch variability, no building-product standard or fire class, a living layer that must be added after printing (SLS sintering and SLA post-cure would kill it), plasticiser in the Nie film, 1-year dormancy limit, and no data on adhesion or growth on photopolymer resins."),
 lay_summary=("Mushroom 'roots', called mycelium, can be grown into a leathery sheet, and some of those sheets curl when the air gets damp, like a pine cone. We looked for a living layer that could bend a printed strip when humidity changes. The usual mycelium building blocks, grown on sawdust, swell a lot but mainly in thickness and they are weak and inconsistent, so they are a poor choice. Two other options look better: a mushroom-root film grown in a dish, and a hair-thin coat of dried bacteria. Both swell a few percent in damp air, far more than the printing plastics do, and the bacteria coat reacts in seconds. They are soft, so they only bend a printed strip well if the strip is a rubbery printing resin, not a hard one. The big unknowns are keeping the living layer clean and consistent and getting it approved for buildings."),
 glossary=[
  dict(term="mycelium", plain="The root-like thread network of a fungus, which can be grown into a solid material."),
  dict(term="myco-composite", plain="A material where mycelium grows through and glues together another material such as sawdust or a printed frame."),
  dict(term="bilayer", plain="Two thin layers stuck together; if one swells more than the other, the strip curls."),
  dict(term="Timoshenko coefficient f(m,n)", plain="A number up to 1.5 that says how well a two-layer strip turns a swelling difference into bending; the project proved the 1.5 limit."),
  dict(term="modulus", plain="Stiffness: how much force it takes to stretch or bend a material by a given amount."),
  dict(term="RH (relative humidity)", plain="How damp the air is, as a percentage of the most water vapour the air can hold."),
  dict(term="through-thickness vs in-plane swelling", plain="Swelling in the thin direction (making a board fatter) versus swelling along the surface (what makes a strip curl)."),
  dict(term="hydrophobin", plain="A fungal protein that coats surfaces and makes them repel water."),
  dict(term="indirect inoculation", plain="Letting mycelium grow onto a printed object from a bed of living mycelium instead of mixing it into the ink."),
  dict(term="Janus film", plain="A film whose two faces are different, named after the two-faced Roman god."),
  dict(term="GRAS", plain="'Generally recognised as safe': a US food-safety status for an organism."),
  dict(term="contamination", plain="Unwanted bacteria or moulds taking over the culture."),
  dict(term="SLA / SLS", plain="Two 3D-printing methods: curing liquid resin with light, or fusing plastic powder with a laser."),
  dict(term="Shore A", plain="A scale for how hard a rubbery material feels; lower is softer."),
 ],
 findings=findings,
 key_claims=[dict(claim=c, source=src, evidence_quote=q) for (_k, c, q, src) in ck.KEY_CLAIMS],
 table=table,
 recommendations=[
  "Do not use particulate mycelium-bound composite as the swelling layer: swelling is through-thickness, scatter is large (627 +/- 285 MPa flexural modulus), and wet integrity fails. Use mycelium, if at all, as a thin hydrophobic skin on the passive side.",
  "If a living layer is wanted, make the PASSIVE layer a soft Formlabs elastomer (Silicone 40A, Flexible 50A or Flexible 80A V2), not Rigid 10K: with E_active about 24-70 MPa the optimum thickness ratio (m^2 n = 1) is only reached against a soft partner. Target active layer about 18-50 % of the passive thickness for a mycelium film, or at least 10-30 um of dried cells on 0.2 mm elastomer.",
  "First experiment (cheap, reproducible): a dried B. subtilis or yeast cell layer sprayed on a 0.2 mm printed Flexible 50A strip, cycled 30 to 70 % RH in a salt-solution chamber; measure curvature and compare with the derated prediction (derate the linear-theory number by 3.8-4.4x). Second: a Nie-type Trametes film (needs a mycology lab) laminated to Silicone 40A.",
  "Add the living layer AFTER printing and post-cure; do not put it through SLS sintering or SLA UV post-cure. Test fungal growth and adhesion on cured resin coupons first, since no literature exists.",
  "For the architecture pitch, present the living layer as a research option with a non-living, certifiable fall-back (the elastomer bilayer, or dried-cell or killed-mycelium film) because no standard, fire class or CE route exists for mycelium products.",
 ],
 reproduce=[
  dict(what="Check free RAM and disk before running anything", command_or_url="wmic OS get FreePhysicalMemory,TotalVisibleMemorySize ; df -h /c /d", expected="2026-11-12: free RAM ~32 %, C: 6.5 GB, D: ~10 GB (all above the thresholds)"),
  dict(what="Download and hash the Europe PMC full texts used (25 articles)", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/fetch_all.py", expected="Files under D:/Users/ashenoy00000/delphi-work/data/bm-myco/ plus MANIFEST.txt with URL, byte size and sha256; sizes can differ slightly if Europe PMC updates a record"),
  dict(what="Read the Shen paper (RSC page is blocked); arXiv v2 PDF then pdftotext", command_or_url="https://arxiv.org/pdf/2305.12151v2 ; pdftotext -enc UTF-8 (poppler)", expected="sha256 f007d04465357446cff73db138b5a0606945cf6fb527aca9f9fc4e5d96b50a98 (2,027,066 bytes); text contains 'tensile strength was measured at 0.72 MPa'"),
  dict(what="Re-check every evidence quote against the local source text", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/check_quotes.py", expected="'checked 53 bad 0'"),
  dict(what="Recompute the bilayer numbers (ceiling, strains, pairings, derating)", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/bilayer_candidates.py", expected="'grid max f = 1.5'; cell strain -0.1027 (15->95 % RH); Nie layer A 0.03; Nie film on Flexible 50A: derated 12.7-14.7 1/m"),
  dict(what="Search for fungal growth on SLA resin (gap check)", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/epmc_search.py \"mycelium grown on stereolithography printed scaffold\" 5", expected="No article about mycelium on a photopolymer resin (results are unrelated or Candida-on-denture-resin papers)"),
  dict(what="Verify all DOIs at Crossref", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/verify_dois.py", expected="22 lines each starting with a DOI and a year; Crossref rate-limits (HTTP 429), rerun after a minute and it resumes"),
  dict(what="Rebuild the report JSON", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/build_result.py", expected="Writes D:/Users/ashenoy00000/delphi-work/agents2/bm-mycelium-living-materials.json (python 3.14.2; tools: curl, pdftotext)"),
 ],
 citations=citations,
 could_not_find=[
  "The Shen 2024 RSC page and PDF (HTTP 403, Cloudflare); I used the arXiv v2 preprint body, which may differ from the published version. The water absorption and volume swelling values (Fig. 5c) and the Table S1 comparison are in figures or supplements and could not be read.",
  "Any coefficient of hygroscopic expansion for a mycelium composite or pure mycelium sheet as a plain number: Nie report one (beta) only in a supplementary figure I could not read; I used their bulk volume expansion (9.27 % / 3.38 %) and my own isotropic 1/3-power conversion, which Nie's own planar-expansion result (no significant layer difference) calls into question.",
  "Humidity-driven in-plane swelling of the particulate composites (only immersion data; in-plane <~7 %, at 40 C liquid water) and any RH-controlled drying-shrinkage test.",
  "Any bond or adhesion test between a mycelium or cell layer and a cured Formlabs resin, any test of fungal or bacterial growth on cured Formlabs resin, and any measurement of Formlabs elastomer modulus (the 0.8/1.8/5.8 MPa values are the earlier agent's own secant estimates).",
  "Whether Formlabs resins/elastomers tolerate the sterilisation (autoclave 121 C) a clean living layer would need; the Fomes study says autoclaving can weaken printed PLA, nothing found for Formlabs parts.",
  "Gantenbein 2023 (Nature Materials, 3D printed mycelium hydrogels) and Sinha 2025 (living S. commune films): DOIs verified, texts paywalled and not read, so no number from them is used.",
  "Any fire classification (EN 13501 or equivalent), structural certification or CE route for a mycelium product; only micro-scale calorimetry (Jones 2018) and the statement that none exists. Mamou-Mani-specific evidence was not in scope.",
  "A measured modulus of a dried cell layer other than the fitted 70 MPa (Wang), and the latex modulus used in that fit (not read).",
  "Anything from OpenAlex (not used, per instructions).",
 ],
 scripts_written=[
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/epmc_search.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/epmc_fulltext.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/epmc_abstract.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/fetch_all.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/grep_txt.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/flatten.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/fetch_buehler2024.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/fetch_shen_pubabstract.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/bilayer_candidates.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/verify_dois.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/check_quotes.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-mycelium-living-materials/content_findings.py, content_keys.py, build_result.py",
 ],
)
json.dump(result, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("wrote", OUT, "findings", len(findings), "table", len(table), "citations", len(citations))
