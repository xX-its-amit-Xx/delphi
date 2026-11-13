"""Assemble D:/Users/ashenoy00000/delphi-work/agents2/bm-natural-benchmarks.json from find_a/b/c + calc_out.json.
Every evidence_quote is re-extracted from the saved source files by quotes.py; the build FAILS if any anchor is missing
or any quote exceeds 40 words.  Run:  python calc.py && python build_result.py"""
import json, sys, os, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import quotes
from quotes import qs as q, URLS
import find_a, find_b, find_c

OUT = "D:/Users/ashenoy00000/delphi-work/agents2/bm-natural-benchmarks.json"
calc = json.load(open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-natural-benchmarks/calc_out.json"))

findings = []
for blk in (find_a.F, find_b.F, find_c.F):
    findings += blk

def add(claim, key, quote, conf, value=""):
    findings.append(dict(claim=claim, source=URLS[key], confidence=conf, value=value, evidence_quote=quote, _key=key))

# ---------- explicit confirm / contradict statements against earlier agent files ----------
add("CONTRADICTS earlier file spec-hygromorph-4d.json / spec-bilayer-physics.json (which adopt Reyssat's m ~ 1, n ~ 5 for the pine scale): the only direct tissue measurements I could read (Eger 2022, nanoindentation) give passive/active modulus ratios n = 800/35 = 22.9 (dry) down to 200/25 = 8 (wet), and thickness ratio m ~ 0.5 (500 um fibre / 1000 um sclereid). With those, m^2 n = 5.7 to 2.0 and f = 1.23 to 1.46 (82 to 97 percent of ceiling), versus f = 1.25 (83 percent) at m = 1, n = 5. Caveat: Eger indented perpendicular to the scale axis, so these are transverse, not bending, moduli.",
    "EG", q("EG", "E SC,50% = 35 MPa to E SC,60% = 25 MPa"), "medium", "n=8..22.9; m~0.5; f=1.23..1.46")
add("CONFIRMS earlier spec-hygromorph-4d.json: Eger moduli (35 -> 25 MPa sclereid; 800 -> 200 MPa fibre), 1000/500 um layer thicknesses, +27/+22 percent sclereid change, 24 and 12 degree angles, and the Ulrich 102-cycle result all reproduce from the fetched texts. CORRECTS wording only: 24 degrees is P. sylvestris (water), 12 degrees is P. wallichiana (30 to 80 %RH).",
    "UL", q("UL", "After cyclically actuating pine cone scales by submerging and drying them for 102 cycles"), "high", "")
add("DEEPENS earlier note on R&M alpha: alpha = 0.001 per %RH over 100 %RH gives a strain of ~0.11, about half the 'up to 20 percent' quoted for wet cells (R&M cite 'strains (up to 20%)' for wetting); the two numbers describe different wetting states (vapour vs liquid water) and R&M do not reconcile them. Eger's liquid-water mismatch (22 % vs 1 %) is closer to 20 percent.",
    "RM", q("RM", "The coupling of large strains (up to 20%) to water transport"), "medium", "0.113 (vapour, fit) vs ~0.20-0.21 (liquid water)")
add("CONFIRMS earlier spec-bilayer-physics.json: R&M's f ~ 1.3 for m ~ 1, n ~ 5 versus the project formula f(1,5) = 1.25 (about 4 percent apart; R&M round the inputs). I also checked the formula numerically on a 36-point grid: maximum f = 1.5 exactly at m^2 n = 1 and f(m,n) = f(1/m,1/n) to 2e-16 (calc.py).",
    "RM", q("RM", "suggest that n ≃ 5, so that from equation ( 2.6 ) it follows that f ( m,n ) ≃ 1.3."), "high", "max f=1.5; symmetric under (m,n)->(1/m,1/n)")
add("DEEPENS the resin finding (project record: stock Formlabs resins gain under 1 percent mass in 24 h in water): the pine active tissue takes up only ~4.5 wt percent at 80 %RH (a vapour condition, not 24 h immersion, so the two are not like-for-like), yet its cells lengthen ~22 percent in liquid water. A bilayer therefore needs a swelling layer that converts a few wt percent of water into a large one-directional strain, and benchmarks should report strain per wt percent water, not mass gain alone.",
    "EG", q("EG", "The sclereid cells (93 mg, 23 °C, 80% rh) absorbed 4.5 wt%"), "medium", "4.5 wt % -> 22 % length (liquid water state differs from 80 %RH)")

# ---------- table ----------
T = []
def row(name, fields, key):
    T.append(dict(name=name, fields=fields, source=URLS[key] if key in URLS else key))

row("Pine cone scale, Pinus coulteri, Reyssat & Mahadevan 2009 (J R Soc Interface)",
    "active_layer_thickness~1 mm (typical); L_active~10*h_a; thickness_ratio_m(passive/active)~1; modulus_ratio_n(passive/active)~5 (Dawson 1997, secondary); cell_strain eps=0.0011*phi+0.0033 (phi=humidity as printed), cells ~20 % longer wet; alpha=0.001+/-0.0001 per unit humidity; "
    "time_wet=29*h_a^1.3 min, time_dry=96*h_a^1.5 min (h_a in mm; 1 mm: 29 and 96 min); h^2/D=1000 s at 1 mm; predicted d_kappa~1.3 cm^-1, predicted angle~75 deg vs observed up to 100 deg (ratio 0.75, not like-for-like); own f(1,5)=1.25=83 % of 3/2 ceiling",
    "RM")
row("Pine cone tissues, Pinus wallichiana / P. sylvestris, Eger et al 2022 (Adv Sci)",
    "h_sclereid(active)~1000 um (thickest); h_fibre(passive)~500 um; m~0.5; E_sclereid=35 MPa(50 %RH)->25 MPa(60 %RH); E_fibre=800 MPa(30 %RH)->200 MPa(75 %RH); E_brown=52->43 MPa; n=22.9 (dry) to 8 (wet) (own calc); "
    "length_change_wet sclereid +22 %, fibre +1 %; thickness +27 % / -3 %; angle 24 deg (P. sylvestris, dry to water) and 12 deg (P. wallichiana, 30->80 %RH); water_uptake sclereid 4.5 wt % at 80 %RH, equilibrium ~20 min (small pieces), 7 h (whole scales); own f=1.23 (dry) to 1.46 (wet)",
    "EG")
row("Pine cone scale force, Pinus pinaster, Le Duigou & Castro 2016 (Sci Rep)",
    "scale_thickness=1.3/1.5/1.1 mm (top/middle/bottom); active_(sclerid)_area=65.5/69/62.5 %; implied m=0.53/0.45/0.60 (own); blocking_force=3.1/3.6/2.2 N; blocking_moment=80.5/107.2/42.0 N mm; theory (bimetal strip) 'fairly good agreement' but over-predicts; fit needs 50 % lower dry modulus; "
    "own f(m, n=5 assumed)=1.49/1.50/1.47 (98-100 % of ceiling; n not measured)",
    "LD")
row("Pine cone durability, Pinus jeffreyi, Ulrich et al 2024 (Bioinspir Biomim)",
    "cycles=102 (submerge/dry); blocking_force_retained=97 %; torque_retained=97 %; opening_angle_retained>94 %; cracking and delamination seen, no loss of function; stated use: passive facade shading",
    "UL")
row("Biomimetic paper/polymer bilayer, Reyssat & Mahadevan 2009",
    "h_active(paper)=100 um; h_passive(polymer)=200 um; total 0.3 mm; m=2; n~0.4; alpha~4e-4; expected d_kappa~0.19 mm^-1 'comparable' to observation (no error given); own f(2,0.4)=1.48=98.8 % of ceiling; humidity swing needed for 0.19 mm^-1 = 96 %RH (own)",
    "RM")
row("Wheat awn (wild wheat), Elbaum et al 2007 (Science)",
    "mechanism: cellulose-fibril arrangement bends the awn with humidity; driver: daily humidity cycle; thickness, strain, time, angle: NOT FOUND (paywalled); E=10+/-2.8 GPa (ridge) to 20.5+/-2.6 GPa (cap) quoted second-hand by Mazzolai 2021 (unverified)",
    "PM_ELB")
row("Erodium gruinum awn, Ronzan et al 2025 (Sci Rep)",
    "E_inner/outer by region E1,E2,E3 (GPa)=0.73/0.34, 3.20/1.36, 1.73/4.17 (50 %RH, N=5); blocking_force=6.27+/-1.92 mN; extensional_force=45.9+/-22.6 mN (model 53.3); moment=528+/-54 uN m (model 658.5); single tilted-helix layer, not a thickness/modulus bilayer",
    "RZ")
row("Erodium cicutarium awn, Evangelista et al 2011 via Mazzolai 2021",
    "turns=9+/-2; spiral_angle=86+/-2 deg; awn_height=15+/-5 mm; max_diameter=2+/-1 mm; E_assumed=9 GPa (wood value); cellulose tilt 20 deg (bottom) to 10 deg (top) of coil zone, Erodium sp. (Abraham 2012, SAXS)",
    "MZ")
row("Pelargonium appendiculatum awn, Cecchini et al 2023 (Adv Sci)",
    "h_cap=39.8+/-6.9 um; h_ridge=59.7+/-9.8 um; E_cap=0.78+/-0.29 GPa; E_ridge=1.48+/-0.25 GPa; torque=20.7+/-2.5 uN m; extensional_force=5.1+/-1.1 mN; helix R=0.90+/-0.43 mm, pitch=1.85+/-0.24 mm at 50 %RH; model within confidence interval (as claimed); own bilayer reading m=1.5, n=1.9, f=1.30=87 % of ceiling",
    "CC")
row("Bauhinia variegata seed pod, Armon et al 2011 (Science)",
    "mechanism: two fibre layers at 45 deg to long axis (second-hand, Wan 2018); helix set by w~=w*kappa0/t; theory 'quantitatively predicts all observed configurations' (abstract); pod thickness, modulus, strain, time, helix angle values: NOT FOUND (paywalled)",
    "PM_ARM")
row("Sesame capsule, Shtein et al 2016 (Front Plant Sci)",
    "active_layer=outer parenchyma (mesocarp), shrinks to 30 % of wet thickness; stiffness ratio assumed 20 : 5 : 0.1 (fibre-along : fibre-across : parenchyma); model 'successfully simulated' opening curvature (no error figure); capsule curvature varies around the circumference",
    "HG")
row("Venus flytrap closing (Dionaea muscipula), Forterre 2005; Durak 2022; Tsugawa 2025; Hirata 2026",
    "closing_time~100 ms (Forterre), 100-300 ms (Durak), <=900 ms after 2nd stimulus (Tsugawa), <1 s (Hirata); seedling 4.96 s; closing_force=0.149 N, pressure=41 kPa (Volkov 2013, second-hand); mechanism: snap-buckling of the two lobes; water transport takes minutes (too slow); model-assumed lobe h=400 um, E=5 MPa (Poppinga & Joyeux)",
    "PM_FOR")
row("Venus flytrap reopening, Durak et al 2022 (Adv Sci)",
    "median_reopening=28.07 h (N clone, trap length 23 mm) and 31.45 h (L clone, 32.72 mm); reverse_snap_buckling=6-60 min in large slender traps; slenderness=38.67 (N), 44.74 (L)",
    "D2")
row("Aldrovanda vesiculosa (waterwheel plant), Poppinga & Joyeux 2011 (Phys Rev E)",
    "lobe_length=4-7 mm; closing_time~100 ms; mechanism: kinematic amplification of midrib bending (no lobe buckling); model h=50 um, E=5 MPa assumed; midrib curvature 83 m^-1 in closed state (model)",
    "PJ")
T_calc = calc["rows"]
row("OWN CALCULATION: Timoshenko f(m,n) for each natural bilayer (script calc.py)",
    "; ".join(f"{r['name']}: m={r['m']}, n={r['n']}, m^2n={r['m2n']}, f={r['f']} ({100*r['frac_of_ceiling']:.0f} % of 3/2)" for r in T_calc)
    + f"; optimum thickness for n=5: m={calc['m_opt_for_n5']:.3f}; n=8: m={calc['m_opt_for_n8']:.3f}; n=22.9: m={calc['m_opt_for_n22.86']:.3f}",
    "file:///D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-natural-benchmarks/calc.py")

# ---------- key claims ----------
key_claims = [
    dict(claim="Measured natural pine-cone bilayers are NOT at the machine-checked optimum m^2 n = 1: Eger's tissue data (passive fibre 500 um / active sclereid 1000 um; E 800 or 200 MPa vs 35 or 25 MPa) give m^2 n = 2 to 5.7, f = 1.23 to 1.46 (82 to 97 percent of the 3/2 ceiling), and Reyssat's m ~ 1, n ~ 5 gives 83 percent. Nature sits close to, but below, the ceiling; the paper/polymer strip is at 98.8 percent.",
         source=URLS["EG"], evidence_quote=q("EG", "E SC,50% = 35 MPa to E SC,60% = 25 MPa")),
    dict(claim="Pine-cone benchmark numbers for an engineered bilayer to match: active layer ~1 mm and passive ~0.5 mm; differential length strain ~21 percent in liquid water (22 percent vs 1 percent), ~11 percent over 0-100 %RH by the cell-level fit; response 29 min wet / 96 min dry at 1 mm (minutes to hours); water uptake only ~4.5 wt percent at 80 %RH.",
         source=URLS["EG"], evidence_quote=q("EG", "In the wet state, the sclereid layer was 27% thicker and 22% longer in the bending zone as compared to the dry state.")),
    dict(claim="Timoshenko-type theory fits the natural pine cone only 'fairly well' and over-predicts unless wet (about 50 percent lower) moduli are used; the same direction as the pine fibre modulus falling 800 -> 200 MPa when wet. An engineered design must be predicted with wet-state moduli.",
         source=URLS["LD"], evidence_quote=q("LD", "we need to take into account a 50% reduction of Young’s modulus for dry tissue to fit the experimental data with the model")),
    dict(claim="Flytrap and Erodium are not Timoshenko bilayers: the flytrap closes in ~100 ms by snap-buckling (water transport takes minutes), and the Erodium coil comes from a single layer of tilted cellulose (20 to 10 degrees). The ceiling applies to pine cone, sesame and the paper strip; the others are analogies only.",
         source=URLS["PM_FOR"], evidence_quote=q("PM_FOR", "The rapid closure of the Venus flytrap (Dionaea muscipula) leaf in about 100 ms is one of the fastest movements in the plant kingdom.")),
]

# ---------- citations (all DOIs fetched via Crossref API on 2026-11-12; ones also seen in PubMed/Europe PMC say so) ----------
def cit(authors, year, title, doi, used, how, verified=True, venue=""):
    return dict(authors=authors, year=year, title=title, doi_or_arxiv=doi, verified=verified, used_for=used, how_verified=how, venue=venue)
CR = "Crossref API https://api.crossref.org/works/%s fetched 2026-11-12, returned matching title/year/first authors"
citations = [
    cit("Reyssat E, Mahadevan L", 2009, "Hygromorphs: from pine cones to biomimetic bilayers", "10.1098/rsif.2009.0184", "Pine cone and paper/polymer bilayer numbers, time laws, f(m,n)", CR % "10.1098/rsif.2009.0184" + "; full text read at pmc.ncbi.nlm.nih.gov/articles/PMC2838359", venue="J R Soc Interface"),
    cit("Eger CJ, Horstmann M, Poppinga S, et al", 2022, "The Structural and Mechanical Basis for Passive-Hydraulic Pine Cone Actuation", "10.1002/advs.202200458", "Layer thicknesses, moduli, strains, angles, water uptake", CR % "10.1002/advs.202200458" + "; open full text PMC9284161 read", venue="Adv Sci"),
    cit("Le Duigou A, Castro M", 2016, "Evaluation of force generation mechanisms in natural, passive hydraulic actuators", "10.1038/srep18105", "Blocking force, area fractions, agreement with bimetal theory", CR % "10.1038/srep18105" + "; open full text PMC4733047 read", venue="Sci Rep"),
    cit("Ulrich S, Genter L, Schäfer M, et al", 2024, "Investigation of the resilience of cyclically actuated pine cone scales of Pinus jeffreyi", "10.1088/1748-3190/ad475b", "102-cycle durability, facade-shading context", CR % "10.1088/1748-3190/ad475b" + "; abstract read via Europe PMC REST search", venue="Bioinspir Biomim"),
    cit("Dawson C, Vincent JFV, Rocca A-M", 1997, "How pine cones open", "10.1038/37745", "Cited ONLY as the source of n ~ 5 and alpha quoted by others; primary text NOT read", CR % "10.1038/37745" + " (DOI resolves; nature.com page blocked by JavaScript challenge; no PubMed record)", venue="Nature 390:668"),
    cit("Elbaum R, Zaltzman L, Burgert I, Fratzl P", 2007, "The Role of Wheat Awns in the Seed Dispersal Unit", "10.1126/science.1140097", "Wheat awn mechanism (abstract only)", CR % "10.1126/science.1140097" + "; abstract read via PubMed efetch PMID 17495170", venue="Science 316:884"),
    cit("Armon S, Efrati E, Kupferman R, Sharon E", 2011, "Geometry and Mechanics in the Opening of Chiral Seed Pods", "10.1126/science.1203874", "Bauhinia pod mechanism and theory-agreement claim (abstract only)", CR % "10.1126/science.1203874" + "; abstract read via PubMed efetch PMID 21940888", venue="Science 333:1726"),
    cit("Forterre Y, Skotheim JM, Dumais J, Mahadevan L", 2005, "How the Venus flytrap snaps", "10.1038/nature03185", "Flytrap closure ~100 ms, snap-buckling (abstract only)", CR % "10.1038/nature03185" + "; abstract read via PubMed efetch PMID 15674293", venue="Nature 433:421"),
    cit("Abraham Y, Tamburu C, Klein E, et al", 2012, "Tilted cellulose arrangement as a novel mechanism for hygroscopic coiling in the stork's bill awn", "10.1098/rsif.2011.0395", "Erodium cellulose tilt 20 to 10 degrees", CR % "10.1098/rsif.2011.0395" + "; PMC3284132 page text read (page now returns a reCAPTCHA; my saved copy is in the data dir)", venue="J R Soc Interface"),
    cit("Evangelista D, Hotton S, Dumais J", 2011, "The mechanics of explosive dispersal and self-burial in the seeds of the filaree, Erodium cicutarium", "10.1242/jeb.050567", "Erodium cicutarium coil geometry, quoted second-hand via Mazzolai 2021; primary not read", CR % "10.1242/jeb.050567", venue="J Exp Biol"),
    cit("Cecchini L, Mariani S, Ronzan M, et al", 2023, "4D Printing of Humidity-Driven Seed Inspired Soft Robots", "10.1002/advs.202205146", "Pelargonium layer thickness, moduli, torque", CR % "10.1002/advs.202205146" + "; open full text PMC10037692 read", venue="Adv Sci"),
    cit("Ronzan M, Mariani S, Cecchini L, et al", 2025, "Structural and mechanical properties of humidity-responsive Geraniaceae awns", "10.1038/s41598-025-09186-6", "Erodium gruinum and Pelargonium moduli, forces, moments", CR % "10.1038/s41598-025-09186-6" + "; open full text PMC12219170 read", venue="Sci Rep"),
    cit("Mazzolai B, Mariani S, Ronzan M, et al", 2021, "Morphological Computation in Plant Seeds for a New Generation of Self-Burial and Flying Soft Robots", "10.3389/frobt.2021.797556", "Second-hand table of Erodium/Pelargonium geometry and wheat-awn modulus", CR % "10.3389/frobt.2021.797556" + "; open full text PMC8664382 read", venue="Front Robot AI"),
    cit("Shtein I, Elbaum R, Bar-On B", 2016, "The Hygroscopic Opening of Sesame Fruits Is Induced by a Functionally Graded Pericarp Architecture", "10.3389/fpls.2016.01501", "Sesame capsule layer behaviour and model", CR % "10.3389/fpls.2016.01501" + "; open full text PMC5056167 read", venue="Front Plant Sci"),
    cit("Wan G, Jin C, Trase I, Zhao S, Chen Z", 2018, "Helical Structures Mimicking Chiral Seedpod Opening and Tendril Coiling", "10.3390/s18092973", "Second-hand description of Bauhinia fibre angle and dimensionless width", CR % "10.3390/s18092973" + "; open full text PMC6164363 read", venue="Sensors"),
    cit("Huss JC, Gierlinger N", 2021, "Functional packaging of seeds", "10.1111/nph.17299", "Awn bilayer microfibril-angle summary", CR % "10.1111/nph.17299" + "; open full text PMC8252473 read", venue="New Phytol"),
    cit("Durak GM, Thierer R, Sachse R, Bischoff M, Speck T, Poppinga S", 2022, "Smooth or with a Snap! Biomechanics of Trap Reopening in the Venus Flytrap (Dionaea muscipula)", "10.1002/advs.202201362", "Reopening times, slenderness", CR % "10.1002/advs.202201362" + "; open full text PMC9353449 read", venue="Adv Sci"),
    cit("Durak GM, Speck T, Poppinga S", 2022, "Shapeshifting in the Venus flytrap (Dionaea muscipula): Morphological and biomechanical adaptations", "10.3389/fpls.2022.970320", "Closing 100-300 ms, closing force, seedling time", CR % "10.3389/fpls.2022.970320" + "; open full text PMC9478607 read", venue="Front Plant Sci"),
    cit("Tsugawa S, Asakawa H, Hirata M, et al", 2025, "Inference of mechanical forces through 3D reconstruction of the closing motion in venus flytrap leaves", "10.1038/s41598-025-10638-2", "Closure within 900 ms; water transport too slow", CR % "10.1038/s41598-025-10638-2" + "; open full text PMC12304133 read", venue="Sci Rep"),
    cit("Hirata M, Kang Z, Asakawa H, et al", 2026, "Size-curvature constraint in the closing motion of Venus flytrap leaves", "10.1371/journal.pone.0349246", "Two-layer curvature model of the flytrap leaf", CR % "10.1371/journal.pone.0349246" + "; open full text PMC13210226 read", venue="PLOS One"),
    cit("Poppinga S, Joyeux M", 2011, "Different mechanics of snap-trapping in the two closely related carnivorous plants Dionaea muscipula and Aldrovanda vesiculosa", "10.1103/PhysRevE.84.041928 ; arXiv:1110.0714", "Aldrovanda 100 ms; Dionaea buckling; model inputs", CR % "10.1103/PhysRevE.84.041928" + "; arXiv export API id_list=1110.0714 returned the same title; PDF text read", venue="Phys Rev E"),
    cit("Timoshenko S", 1925, "Analysis of Bi-Metal Thermostats", "10.1364/JOSA.11.000233", "Origin of the bilayer curvature formula (formula taken from Reyssat & Mahadevan and the project record; original not read)", CR % "10.1364/JOSA.11.000233", venue="J Opt Soc Am 11:233"),
]

# ---------- could_not_find ----------
could_not_find = [
    "Dawson, Vincent & Rocca 1997 full text: nature.com returned a JavaScript client challenge; no open copy found. The modulus ratio n ~ 5 and the expansion coefficients 0.20 and 0.06 are second-hand (Reyssat & Mahadevan; Cecchini; Mazzolai) and their units are ambiguous (one secondary table prints 'for dRH = 1%').",
    "Wheat awn (Elbaum 2007): no thickness, modulus, strain, bending angle or time measured in the paper could be read (Science full text paywalled; a Biointerphases page on wild-oat awns was blocked by a challenge page). The only wheat-awn modulus (10 to 20.5 GPa) is a second-hand quote and may not be from the primary text.",
    "Bauhinia (Armon 2011): thickness, moduli, strains, helix angles/pitch and opening time not readable (paywalled; no arXiv or open copy found by arXiv API, Europe PMC, or a web search). Only abstract, a second-hand fibre angle of 45 degrees and the dimensionless width were verified. Other pods (Banksia, Pelargonium capsule, dandelion pappus) were not collected beyond the sesame capsule.",
    "Forterre 2005 primary data (lobe thickness, curvature, modulus, snap model fit): abstract only. The 0.149 N and 41 kPa closing force is a second-hand quote of Volkov 2013 (not fetched).",
    "No quantitative theory-versus-data error (percent) is reported for the pine cone angle, the paper strip curvature, the sesame capsule or Bauhinia in any text I could read; agreement is stated qualitatively ('comparable', 'fairly good', 'successfully simulated', 'quantitatively predicts'). The only numbers: Le Duigou over-prediction needing 0.5 x modulus; Ronzan model/measured ratios 1.16, 1.25, 2.79.",
    "Pine-cone bending-direction (longitudinal) moduli of the wet and dry layers: Eger's values are nanoindentation perpendicular to the scale axis with large scatter in the fibres; Dawson's tensile values could not be read. So n for a pine scale is uncertain between 5 and 23.",
    "Not run: no Lean process (task needed only to read the existing file); no heavy download (largest file 611 kB). C: has 426 MB free, below the 1 GB rule, so nothing was written to C:; D: has 9.8 GB free; RAM free ~24 percent.",
    "OpenAlex deliberately not used (rules). Ha et al 2020, Volkov 2013, Harlow 1964, Fratzl-Elbaum-Burgert 2008 were seen only as second-hand citations and are not in the citation list.",
    "PMC pages for Reyssat 2009 and Abraham 2012 now sometimes return a reCAPTCHA page, so the byte hash of those two files differs on refetch (fetch_all.py --check shows DIFFERENT for them, and the Ulrich JSON); the quote texts were verified against my saved copies.",
]

# ---------- glossary ----------
glossary = [
    dict(term="hygromorph", plain="A material that changes shape when its moisture content changes, like a pine cone."),
    dict(term="bilayer", plain="Two layers stuck together, one that swells and one that resists, so the strip curls."),
    dict(term="curvature", plain="How tightly a strip is bent: one over the radius of the circle it makes."),
    dict(term="thickness ratio (m)", plain="Thickness of the passive (restraining) layer divided by thickness of the active (swelling) layer."),
    dict(term="modulus ratio (n)", plain="How much stiffer the passive layer is than the active layer."),
    dict(term="Young's modulus", plain="How stiff a material is: the force needed to stretch it, per area, per fraction stretched."),
    dict(term="MPa / GPa", plain="Units of stiffness or pressure: a million or a billion pascals; rubber is a few MPa, wood about 10 GPa."),
    dict(term="strain", plain="How much something stretches or swells, as a fraction of its size (0.1 means 10 percent)."),
    dict(term="ceiling of 3/2", plain="The proved upper limit: a two-layer strip can never bend more than 1.5 times its swelling mismatch divided by its thickness."),
    dict(term="snap-buckling", plain="A quick flip from one curved shape to the opposite one, like a hair clip or a popper toy."),
    dict(term="microfibril angle", plain="The direction the stiff cellulose threads in a cell wall run, relative to the cell's length."),
    dict(term="nanoindentation", plain="Pressing a tiny hard tip into a surface to measure how stiff it is."),
    dict(term="%RH (relative humidity)", plain="How full of water vapour the air is, as a percent of its maximum."),
    dict(term="wt %", plain="Percent of the dry weight that is water."),
    dict(term="blocking force", plain="The push a bending strip makes when held in place so it cannot move."),
    dict(term="awn", plain="The bristle on a grass or cranesbill seed that twists or bends with humidity."),
    dict(term="sclereid / sclerenchyma", plain="The two kinds of woody plant cells in a pine scale: swelling ones and stiff fibre ones."),
    dict(term="diffusion time h^2/D", plain="A rough time for water to soak through a layer of thickness h; grows with the square of the thickness."),
    dict(term="sha256", plain="A fingerprint of a file: any change to the file changes it."),
]

# ---------- reproduce ----------
S = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-natural-benchmarks/"
reproduce = [
    dict(what="Re-fetch every source and compare to the stored sha256 (Python 3.14, standard library; ~25 requests, about 1 minute)", command_or_url=f"python {S}fetch_all.py --check", expected="MATCH for the 20 Europe PMC/arXiv/Crossref/PubMed files; DIFFERENT for PMC2838359.html, PMC3284132.html, ulrich2024_epmc.json (dynamic pages; text unchanged for Reyssat, Abraham page may show reCAPTCHA)"),
    dict(what="Refetch into the data dir (rewrites MANIFEST.json with url, date, bytes, sha256; needs poppler pdftotext for the arXiv PDF text)", command_or_url=f"python {S}fetch_all.py", expected="'<n> bytes -> <file>' per source; files land in D:/Users/ashenoy00000/delphi-work/data/natural-benchmarks (about 4 MB total)"),
    dict(what="Recompute every f(m,n), optimum thickness, response times, ratios (Python 3.14)", command_or_url=f"python {S}calc.py", expected="max_f_on_grid 1.5; pine R&M f=1.25; Eger dry 1.2335, wet 1.4595; paper strip 1.4815; Pelargonium 1.3041; times at 1 mm: wet 29.0 min, dry 96.0 min"),
    dict(what="Rebuild this result; fails if any evidence quote is not found verbatim in the saved sources or exceeds 40 words", command_or_url=f"python {S}calc.py && python {S}build_result.py", expected=f"prints counts and writes {OUT}"),
    dict(what="Spot-check key quotes by hand: open the Eger 2022 XML and search for 'E SC,50% = 35 MPa'", command_or_url="https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9284161/fullTextXML", expected="'from E SC,50% = 35 MPa to E SC,60% = 25 MPa' and 'E SF,30% = 800 MPa to E SF,75% = 200 MPa'"),
    dict(what="Spot-check Reyssat & Mahadevan: search 'n ≃ 5' and 'τ d = 96'", command_or_url="https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/", expected="n ~ 5 from Dawson 1997; drying 96 h_a^1.5 min, wetting 29 h_a^1.3 min (if the page shows a reCAPTCHA, use the PubMed/PMC mirror via Europe PMC search)"),
    dict(what="Verify a DOI (example)", command_or_url="https://api.crossref.org/works/10.1038/37745", expected="title 'How pine cones open', Nature 1997, Dawson/Vincent/Rocca"),
    dict(what="Project-record ceiling (read only; Lean not rerun here)", command_or_url="D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean", expected="theorem timoshenkoCoefficient_le ... ≤ 3 / (2 * h) and timoshenkoCoefficient_eq_of_optimal (m^2 n = 1)"),
]

recommendations = [
    "Use the pine cone as THE benchmark and state it in the proposal as numbers: active layer ~0.5-1 mm, passive layer ~0.5 mm (m ~ 0.5), length strain mismatch ~10-21 percent, water uptake ~4.5 wt percent at 80 %RH, response of minutes at 0.3-1 mm (29/96 min wet/dry at 1 mm), angular change 12-100 degrees depending on species and humidity range, and 102-cycle durability (Ulrich). Quote the ceiling as 'natural cones reach 82-97 percent of the proved 3/2 limit'.",
    "Design to the thickness ratio, not the modulus ratio: for a measured n the optimum is m = 1/sqrt(n) (n=5: 0.447; n=8: 0.354; n=22.9: 0.209). Nature's m ~ 0.5 with n 8-23 implies pine cones are slightly thick on the passive side; an engineered strip can beat them by tuning m.",
    "Predict with WET-state moduli. Both Le Duigou (50 percent reduction needed) and Eger (fibre 800 -> 200 MPa) show the dry-modulus model over-predicts. This supports the 'M_wet' arm already frozen in the earlier design-biomaterial.json.",
    "Do not present the flytrap or Erodium as Timoshenko benchmarks. Use them only as analogies: flytrap = snap through (a hair clip flipping, 100 ms, 10^4 times faster than diffusion allows), Erodium = corkscrew from tilted threads, Bauhinia = a wrung towel twisting from two crossed layers, sesame = a soft cushion drying on a stiff shell, pine cone = a bimetal thermostat run by water instead of heat.",
    "Close the gaps with a library copy: Dawson 1997 (n, alpha, units), Armon 2011 and its supplementary material (pod thickness, modulus, helix angle), Elbaum 2007 (awn modulus, bending angle). Until then keep these as second-hand and say so.",
    "Compare engineered strain honestly: the earlier agents found stock resins and filaments swell 0.15-0.5 percent (filaments) or under 1 percent mass in 24 h (Formlabs resins). Pine active tissue changes length by 11-22 percent with ~4.5 wt percent water; the engineered bilayer should be benchmarked on strain per mass of water and on time, not only on final curvature.",
]

summary = (
    "Natural benchmarks collected from open full texts and abstracts, with every quote re-extracted verbatim by script. "
    "PINE CONE is the only well-measured Timoshenko-type bilayer: Reyssat & Mahadevan (2009) m ~ 1, n ~ 5 (n from Dawson 1997, not read), cells ~20 percent longer wet, alpha = 0.001, response 29 min wetting and 96 min drying at 1 mm, predicted angle ~75 degrees against up to 100 observed. "
    "Eger et al (2022) measure layers of ~1.0 mm (active) and ~0.5 mm (passive), moduli 35->25 MPa (active) and 800->200 MPa (passive), +22 percent versus +1 percent length on wetting, 12-24 degree angles, 4.5 wt percent water uptake. Le Duigou & Castro (2016) give blocking forces 2.2-3.6 N and say bimetal theory fits 'fairly well' but over-predicts unless modulus is halved. "
    "My calculation (calc.py) puts these natural bilayers at 82-97 percent of the proved 3/2 ceiling from measured m and n (98-100 percent for P. pinaster only if n = 5 is assumed), never demonstrably at the exact optimum m^2 n = 1; the engineered paper/polymer strip of Reyssat & Mahadevan is at 98.8 percent. "
    "This CONTRADICTS the earlier files' adoption of m ~ 1, n ~ 5 as the pine-cone state: Eger's data give m ~ 0.5 and n = 8-23 (transverse indentation caveat). "
    "AWNS: Erodium and Pelargonium coil from tilted cellulose in a single layer (tilt 20 to 10 degrees; Erodium gruinum 46 mN, 528 uN m; Pelargonium 5.1 mN, 20.7 uN m; model within 16-25 percent for Erodium, 2.8x too high for the Pelargonium moment). Wheat awn: only the mechanism and a daily-humidity-cycle timescale; no numbers readable. "
    "PODS: Bauhinia has fibres at 45 degrees in two crossed layers and a dimensionless-width rule, but no thickness/modulus/angle values were readable (paywall); sesame capsule has an active parenchyma that shrinks to 30 percent of wet thickness with assumed stiffness ratios 20:5:0.1. "
    "FLYTRAP: closes in ~100 ms (up to 900 ms by one measure) by snap-buckling, reopens in 28-31 h; it is not a Timoshenko bilayer and is 10^4 times faster than diffusion allows at 1 mm. "
    "Theory agreement is stated qualitatively in every paper I could read; no percent error is reported except the Le Duigou modulus correction and the Ronzan model/measured ratios."
)

lay_summary = (
    "A pine cone opens when it dries because its scales are made of two layers that shrink by different amounts, like a strip of two metals that curls when heated. "
    "We gathered the measured sizes and speeds: the swelling layer is about a millimetre thick, the stiff layer about half that, and the scale needs roughly half an hour to an hour or two to move. "
    "A mathematical result already checked by computer says no two-layer strip can bend more than a fixed amount, and real pine cones get within about 80 to 97 percent of it, not exactly to it. "
    "Other plants do different tricks: the Venus flytrap snaps shut in a tenth of a second like a popper toy, and the cranesbill seed twists into a corkscrew from tilted threads in a single layer. "
    "Some numbers we wanted, such as those for wheat bristles and the twisting seed pod of the orchid tree, sit behind paywalls and could not be read."
)

topic = "Nature's benchmarks: pine cone, wheat awn, seed pod, Venus flytrap"

# ---------- finalise ----------
for f in findings:
    f.pop("_key", None)
bad = [f["claim"][:60] for f in findings if not f["evidence_quote"]]
if quotes.ERR or bad:
    print("QUOTE ERRORS:", quotes.ERR, bad); sys.exit(1)
for f in findings + key_claims:
    assert len(f["evidence_quote"].split()) <= 40, f["claim"][:60]
for r in T:
    assert r["source"]
scripts = sorted(x for x in os.listdir(os.path.dirname(os.path.abspath(__file__))) if x.endswith(".py"))
result = dict(label="bm-natural-benchmarks", topic=topic, summary=summary, lay_summary=lay_summary, findings=findings, key_claims=key_claims,
              reproduce=reproduce, citations=citations, could_not_find=could_not_find, glossary=glossary, recommendations=recommendations,
              scripts_written=[S + x for x in scripts], table=T)
json.dump(result, open(OUT, "w", encoding="utf8"), indent=1, ensure_ascii=False)
back = json.load(open(OUT, encoding="utf8"))
print("findings", len(back["findings"]), "key_claims", len(back["key_claims"]), "table", len(back["table"]), "citations", len(back["citations"]), "bytes", os.path.getsize(OUT))
