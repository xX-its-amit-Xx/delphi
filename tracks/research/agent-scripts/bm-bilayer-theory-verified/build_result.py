# -*- coding: utf-8 -*-
"""Builds D:/Users/ashenoy00000/delphi-work/agents2/bm-bilayer-theory-verified.json. Run: python build_result.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_result_part2 import *

LABEL = "bm-bilayer-theory-verified"
TOPIC = "The bilayer equations, each read in its original paper"

SUMMARY = (
 "I read Timoshenko 1925 (J. Opt. Soc. Am. 11, 233-255, public-domain scan on the Internet Archive; the publisher site blocks automated fetches with a captcha, which I did not bypass), Stoney 1909 (Internet Archive scan), the Freund-Floro-Chason 1999 paper (open preprint, the companion of Freund 2000), Reyssat & Mahadevan 2009 (equation images), and Pezzulla et al. 2016 (arXiv). "
 "RESULT 1: Timoshenko's printed eq.(4) is the project's f(m,n) exactly, as are R&M eq.2.6 and Freund-Floro-Chason eq.(6) with E replaced by E/(1-nu). Timoshenko 1925 does not state the ceiling 3/2 or the optimum m^2 n = 1; those are the project's own results, which I re-proved symbolically (3/2 - f = 3(m^2n-1)^2/(2(m^4n^2+4m^3n+6m^2n+4mn+1))) and by a 2.4-million-point grid. His own remark that the modulus ratio does not matter is limited to n between 1/2 and 2 at equal thickness (3 percent). "
 "RESULT 2 (assumptions): the formula is for a narrow strip, linear, perfectly bonded, plane sections, no Poisson ratio. For a wide plate Timoshenko himself replaces E by E/(1-nu) and f is unchanged (a sphere, while the sag is below about h/2). Plane-strain E/(1-nu^2) enters only after the plate flips to a cylinder, where the curvature is (1+nu) times the strip value (+30 to +50 percent); I derived this symbolically and it is confirmed by Pezzulla et al. (L+N = kappa_o(1+nu)) and by Alben's discrete model. Three independent criteria put the strip/plate boundary at a plate diameter of 2.0, 2.2 and 4.2 times sqrt(h/kappa). Stoney's 1909 equation is the thin-film limit of the same f. "
 "RESULT 3 (printed, wet, soft strips): the modulus ratio is a second-order risk at the optimum (a factor-2 error costs 2-3 percent of curvature; softening of the wet layer to 50 percent costs 2-3 percent), while large swelling strain, creep, the adhesive joint and anisotropic swelling are not covered by the theory and are not sized because no sources were found. Diffusion limits speed: tau ~ h^2/D (R&M), and for the only measured D of printable polymers (0.001-0.015 mm^2/h) my model gives a 90 percent curvature response at 0.72 a^2/D, 2-460 h for active layers of 0.2-0.8 mm. No diffusivity for any Formlabs resin exists in the sources found. "
 "RESULT 4 (honest gaps and one contradiction): Armon 2011, Alben-Balakrisnan-Smela 2011 and Freund 2000 could not be read in the original (abstracts only), so their equations and critical values are not reproduced. Two Formlabs documents disagree on Flexible 80A water uptake (0.7 percent in an older cube-table row versus +8 percent mass in the V2 datasheet), so the project-record sentence that stock resins gain under 1 percent in water holds for the cube table but not for Flexible 80A V2."
)

LAY = (
 "A strip made of two layers bends when one layer swells more than the other, like a bimetal thermostat. "
 "The project's formula for how tightly it bends turns out to be the same one Timoshenko printed in 1925, so the maths is on solid ground. "
 "That formula is for a thin ribbon, though; a wide sheet behaves differently and rolls up about 30 to 50 percent tighter, in one direction only. "
 "It also says nothing about how fast the bending happens, and water creeps into ordinary plastics very slowly: a layer a few tenths of a millimetre thick can take hours to days, like a damp sponge that dries one thin layer at a time. "
 "Several things in a printed, soft, wet strip (big swelling, creep, the glue between layers) are outside the formula, and I could not find numbers for them. "
 "I also could not read three of the original papers in full, and two Formlabs documents disagree on how much one resin swells in water, most likely because they describe two versions of it."
)

GLOSSARY = [
 {"term": "bilayer", "plain": "Two layers bonded together so that a difference in how they expand makes the strip curl."},
 {"term": "curvature", "plain": "How tightly something bends: one divided by the radius of the circle it follows."},
 {"term": "modulus (Young's modulus)", "plain": "How stiff a material is: the force needed to stretch it by a given fraction."},
 {"term": "Poisson ratio", "plain": "How much a material gets thinner sideways when you stretch it lengthwise; about 0.3 to 0.5 for plastics and rubbers."},
 {"term": "plane stress / plane strain", "plain": "Two simplifications for a flat body: free to thin sideways (plane stress) or held from stretching sideways (plane strain); the stiff modulus then becomes E/(1-nu^2)."},
 {"term": "biaxial modulus", "plain": "The stiffness of a sheet pulled equally in two directions, E/(1-nu)."},
 {"term": "eigenstrain / mismatch strain", "plain": "The stretch a layer wants to have by itself (from swelling or heat) if nothing held it."},
 {"term": "isotropic / anisotropic", "plain": "Same in every direction / different in different directions, like wood grain."},
 {"term": "narrow strip versus wide plate", "plain": "A ribbon that can only bend one way versus a sheet that must stretch if it tries to bend two ways at once."},
 {"term": "sphere-to-cylinder bifurcation", "plain": "The moment a wide sheet stops forming a bowl and flips to rolling up like a scroll."},
 {"term": "neutral axis", "plain": "The line inside a bent beam that is neither stretched nor squeezed."},
 {"term": "diffusivity (D)", "plain": "How fast water spreads through a material; time to soak a layer of thickness h is about h squared divided by D."},
 {"term": "Fickian", "plain": "Following the simple law that water moves from wet to dry in proportion to the difference."},
 {"term": "neo-Hookean", "plain": "A standard model of rubbery materials that stay accurate at large stretches."},
 {"term": "ASTM D471 / D570 / D638", "plain": "Standard test recipes for fluid immersion, water absorption and tensile strength."},
 {"term": "SLA / SLS", "plain": "3D printing by light-curing liquid resin / by laser-fusing powder."},
 {"term": "TDS", "plain": "Technical data sheet from the manufacturer."},
 {"term": "sympy", "plain": "A computer program that does algebra exactly, used here to prove formulas."},
]

TABLE = [
 {"name": "Timoshenko 1925 eq.(4)  (the project's f(m,n))",
  "fields": "1/rho = 6(a2-a1)(t-t0)(1+m)^2 / {h[3(1+m)^2+(1+mn)(m^2+1/(mn))]}; m=a1/a2 (-); n=E1/E2 (-); h=a1+a2 (m); width=1 (narrow strip); stated assumptions=plane sections stay plane, constant delta-alpha, perfect weld, no friction, very small width; no Poisson ratio; special cases eq5 24/(14+n+1/n), eq6 3/2 at n=1, eq7 48/33 at n=2 (3% apart)",
  "source": A_TIM},
 {"name": "Timoshenko 1925 section 4, plate",
  "fields": "substitute E/(1-sigma) for E (sigma equal in both layers); eq.(4),(6) unchanged; shape=sphere; limit=sag < h/2 (about half the plate thickness); beyond it mid-surface stretching matters",
  "source": A_TIM + " (journal p.242)"},
 {"name": "Stoney 1909 eq.(1),(2)",
  "fields": "P t = E d^2/(6 r); r=l^2/(8 z); P=(4/3) E d^2 z/(t l^2) (thin film); P=(4/3) E (d^2+t d) z/(t l^2) (film same modulus as rule); test strip=102 x 12 x 0.32 mm steel rule; assumptions=film very thin, uniaxial E, no Poisson ratio; thin-film limit of Timoshenko f (f -> 6mn)",
  "source": A_STO},
 {"name": "Freund-Floro-Chason 1999 eq.(6) (plate, linear)",
  "fields": "kappa=(6 eps_m/h_s) h m (1+h)/(1+h m(4+6h+4h^2)+h^4 m^2); h=h_f/h_s; m=M_f/M_s; M=E/(1-nu) biaxial modulus; identical to Timoshenko f with E->M (residual 0); Stoney error 30% printed (33.1% computed) at m=1,h=0.1; assumptions (i)-(vi) printed",
  "source": A_FFC},
 {"name": "Freund-Floro-Chason 1999 eq.(11) (plate, nonlinear)",
  "fields": "S=K[1+(1-nu_s)K^2]; S=(3/2) eps_m R^2 h_f M_f/(h_s^3 M_s); K=R^2 kappa/(4 h_s); nonlinear above S about 0.3; example R/h_s=100,h_f/h_s=0.01,M ratio 1 -> eps_m about 0.002",
  "source": A_FFC},
 {"name": "Reyssat & Mahadevan 2009 eq.(2.5),(2.6)",
  "fields": "delta-kappa = alpha delta-phi f(m,n)/h; f identical to Timoshenko; m=h_p/h_a; n=E_p/E_a; alpha=alpha_a-alpha_p (per %RH, pine cell alpha=0.001); pine cone m~1, n~5, f quoted ~1.3 (formula gives 1.25); tau~h^2/D, D~1e-9 m^2/s -> 1000 s at 1 mm; fits drying 96 h_a^1.5 min, wetting 29 h_a^1.3 min",
  "source": A_RM},
 {"name": "Pezzulla et al. 2016 (isometric limit and bifurcation)",
  "fields": "isometric: L+N=kappa_o(1+nu), K=0; H=(3/4) kappa_o/Lambda_o^2 at nu=1/2; bifurcation kappa_ob*h=sqrt((20+14 sqrt2)/27) gamma^2=1.2141 gamma^2; gamma=h/S; disk S=0.5217 R; disk R_c=2.112 sqrt(h/kappa) (D_c=4.22 sqrt(h/kappa), sag 2.2 h); convex shapes only",
  "source": A_PEZ},
 {"name": "Own derivation: wide plate versus strip (linear elasticity)",
  "fields": "cylinder/beam curvature = 1+nu (equal nu, any m,n): 1.30 (nu 0.3), 1.35, 1.40, 1.50 (nu 0.5); sphere/beam = 1.00; unequal nu (0.35 stiff,0.49 soft,n=10,m=1) = 1.56; ceiling for wide cylinder (1+nu)*3/2 = 1.95-2.25",
  "source": S_PVB},
 {"name": "Plate/strip boundary, three criteria",
  "fields": "D_crit/sqrt(h/kappa) = 2.0 (Timoshenko sag<h/2), 2.19 (FFC S<0.3), 4.22 (Pezzulla disk); sqrt(h/kappa) at kappa=1.5 eps/h = 2.3 mm (h=0.4,eps=2%) to 29 mm (h=1.6,eps=0.2%); Pezzulla disk D_c = 9.8 to 123 mm over that grid",
  "source": S_VER},
 {"name": "Sensitivity of f at the optimum (own)",
  "fields": "design m=n0^-1/2; true n = s*n0: s=2 or 0.5 -> loss 2.2-3.0%; s=3.3 or 0.3 -> 6.8-9.3%; wet softening of active layer to 65% -> 0.9-1.2%; to 50% -> 2.2-3.0%; to 30% -> 6.9-9.3%; m=1,n=10 -> f=0.9959 (33.6% below 3/2)",
  "source": S_VER},
 {"name": "Curvature response time, one-sided diffusion (own)",
  "fields": "t63=0.198, t90=0.724, t99=1.67 (in a^2/D); mass t90=0.861 a^2/D; slowest mode 4/pi^2=0.405 a^2/D; optimum m^2n=1 curve identical for n=1,10; no overshoot; a=0.2 mm -> t90 1.9-29 h; 0.4 mm -> 7.7-116 h; 0.8 mm -> 31-463 h for D=0.0151-0.001 mm^2/h",
  "source": S_VER},
 {"name": "Measured D of dense printable polymers (Aniskevich 2023 Table 3)",
  "fields": "D (mm^2/h): Nylon 0.001; Antero 0.00245; CPE 0.00247; PET-G 0.00335; Ultem 0.00399; PC 0.00472; PLA LAVA 0.00782; PLA T-W 0.0151; t80 (h): Nylon 360, PC 92, PLA T-W 27, Koltron 550; specimens 1.75-2.8 mm cylinders at 97% RH",
  "source": A_ANI},
 {"name": "Printed-part anisotropy (Formlabs TDS)",
  "fields": "Nylon 12 SLS: E=1850 MPa (one value), elongation 11% X/Y vs 6% Z, D570 water 0.66%, 1 cm cube 24 h 0.1%; Nylon 11 CF SLS: E=5.3/2.8/1.6 GPa (X/Y/Z); SLA Clear (Form 2, vendor blog): modulus roughly constant with build angle",
  "source": A_FL12 + " ; " + A_FL11 + " ; https://formlabs.com/blog/isotropy-in-3d-printing-comparing-fdm-sla-sls/"},
 {"name": "Flexible 80A V2 water (Formlabs TDS) versus solvent page",
  "fields": "TDS ASTM D471 slab, deionized water: 1 day -26 Shore A, +8% mass, +3% volume, 94% rel. elongation, 89% rel. tensile; 1 week -27, +9%, +7%; solvent page 1 cm cube 24 h water=0.7% (row 'Flexible 80A Resin'); unresolved",
  "source": A_FLX + " ; D:/Users/ashenoy00000/delphi-work/agents/scratch/spec-resin-chemistry/dl/solvent.html"},
 {"name": "NOT READ IN THE ORIGINAL: Armon 2011, Alben-Balakrisnan-Smela 2011, Freund 2000",
  "fields": "Armon: abstract only (flat intrinsic metric, saddle-like intrinsic curvature, helical transitions); Alben 2011: abstract only (doubly curved edges decide long-edge bending); Freund 2000: Crossref metadata only; equations, assumptions, critical widths not reproduced",
  "source": "https://doi.org/10.1126/science.1203874 ; https://doi.org/10.1021/nl200473p ; https://doi.org/10.1016/S0022-5096(99)00070-8"},
]

def cit(authors, year, title, doi, how, used, venue):
    return {"authors": authors, "year": year, "title": title, "doi_or_arxiv": doi, "verified": True,
            "how_verified": how, "used_for": used, "venue": venue}

CROSSREF = "Crossref https://api.crossref.org/works/{} returned this title, authors and date in this run"
CITATIONS = [
 cit("Timoshenko S.", 1925, "Analysis of Bi-Metal Thermostats", "10.1364/JOSA.11.000233", CROSSREF.format("10.1364/JOSA.11.000233") + "; full text read from the Internet Archive scan of vol 11 issue 3 (sha256 28d3e86b...)", "eq.(4)-(7), plate section, assumptions, end zones", "J. Opt. Soc. Am. 11(3), 233-255"),
 cit("Stoney G. G.", 1909, "The tension of metallic films deposited by electrolysis", "10.1098/rspa.1909.0021", CROSSREF.format("10.1098/rspa.1909.0021") + "; page images read from the Internet Archive PDF", "eq.(1),(2), assumptions", "Proc. R. Soc. Lond. A 82, 172-175"),
 cit("Freund L. B., Floro J. A., Chason E.", 1999, "Extensions of the Stoney formula for substrate curvature to configurations with thin substrates or large deformations", "10.1063/1.123722", "Crossref title search returned this DOI in this run; open preprint (OSTI/UNT) read in full, equations read from page images", "eq.(6),(11), assumptions (i)-(vi), S=0.3", "Appl. Phys. Lett. 74, 1987-1989"),
 cit("Freund L. B.", 2000, "Substrate curvature due to thin film mismatch strain in the nonlinear deformation range", "10.1016/S0022-5096(99)00070-8", CROSSREF.format("10.1016/S0022-5096(99)00070-8") + " (metadata only; text NOT read)", "cited as the companion; content second-hand", "J. Mech. Phys. Solids 48, 1159-1174"),
 cit("Reyssat E., Mahadevan L.", 2009, "Hygromorphs: from pine cones to biomimetic bilayers", "10.1098/rsif.2009.0184", CROSSREF.format("10.1098/rsif.2009.0184") + "; PMC2838359 page text and equation images read", "eq.(2.5),(2.6), tau~h^2/D, pine cone numbers", "J. R. Soc. Interface 6, 951-957"),
 cit("Pezzulla M., Smith G. P., Nardinocchi P., Holmes D. P.", 2016, "Geometry and mechanics of thin growing bilayers", "arXiv:1509.05259; 10.1039/C6SM00246C", "arXiv export API listed 1509.05259v2 in this run; Crossref resolved the DOI; PDF read", "L+N=kappa_o(1+nu), 3/4 law, bifurcation eq.(6), shape factor", "Soft Matter 12, 4435-4442"),
 cit("Armon S., Efrati E., Kupferman R., Sharon E.", 2011, "Geometry and mechanics in the opening of chiral seed pods", "10.1126/science.1203874", CROSSREF.format("10.1126/science.1203874") + "; abstract from Europe PMC (PMID 21940888); full text NOT read", "abstract-level statement only", "Science 333, 1726-1730"),
 cit("Armon S., Aharoni H., Moshe M., Sharon E.", 2014, "Shape selection in chiral ribbons: from seed pods to supramolecular assemblies", "10.1039/C3SM52313F", "Crossref resolved the DOI; abstract from Europe PMC (PMID 24668301); full text NOT read", "abstract-level statement only", "Soft Matter (2014)"),
 cit("Alben S., Balakrisnan B., Smela E.", 2011, "Edge effects determine the direction of bilayer bending", "10.1021/nl200473p", CROSSREF.format("10.1021/nl200473p") + "; abstract from Europe PMC (PMID 21528897); full text NOT read", "abstract-level statement only", "Nano Lett. 11, 2280-2285"),
 cit("Alben S.", 2011, "Bending of bilayers with general initial shapes", "arXiv:1110.1007", "arXiv export API returned title, author and abstract in this run; PDF read", "independent cylinder-state check, eq.(7),(8)", "arXiv preprint (cond-mat.soft)"),
 cit("Holmes D. P.", 2019, "Elasticity and stability of shape-shifting structures", "arXiv:1809.04620; 10.1016/j.cocis.2019.02.008", "arXiv export API and Crossref both resolved in this run; PDF text read", "kappa_n ~ h/l^2 scaling statement", "Curr. Opin. Colloid Interface Sci. (2019)"),
 cit("Injeti S. S., Vyas N., Natarajan S., Annabattula R. K.", 2017, "Modified Stoney's equation with anisotropic substrates undergoing large deformations", "arXiv:1712.07974", "arXiv export API returned the record in this run; PDF text read", "modern Stoney form with 1/(1-nu) and its isotropy assumption", "arXiv preprint (cond-mat.soft)"),
 cit("Aniskevich A., Bulderberga O., Stankevics L.", 2023, "Moisture Sorption and Degradation of Polymer Filaments Used in 3D Printing", "10.3390/polym15122600", CROSSREF.format("10.3390/polym15122600") + "; Europe PMC full-text XML (PMC10304609) read, Table 3", "measured water diffusivities of printable polymers", "Polymers 15(12), 2600"),
]

COULD_NOT_FIND = [
 "Armon et al. 2011 (Science) full text, its printed equation, its stated assumptions and the critical dimensionless width: publisher returns 403, no open copy in Europe PMC or arXiv; only the abstract was read. The previous agent's w*sqrt(kappa0/t) parameter remains unverified by me.",
 "Alben, Balakrisnan & Smela 2011 (Nano Lett.) full text: not open; only the abstract was read. The separate Alben arXiv paper 1110.1007 was read instead and is not the same paper.",
 "Freund 2000 (J. Mech. Phys. Solids) full text: paywalled; the 1999 companion paper in Appl. Phys. Lett. (open preprint) was read instead.",
 "Optica's own copy of Timoshenko 1925: the site served a bot-check captcha page to an automated fetch; I did not try to defeat it and used the Internet Archive scan of the same journal issue instead. The OCR of the equations is garbled, so equations (4)-(7) and the plate paragraph were transcribed from page images (renderable with scripts/render_pdf_pages.py).",
 "Water diffusion coefficient or hygroscopic expansion coefficient for any Formlabs resin or powder: searched again (Europe PMC, web), nothing found; the FDM filament values are brackets only.",
 "Any measurement of anisotropy of hygroscopic swelling (not stiffness) in a printed polymer part; no value for in-plane shear modulus of printed layers, so bend-twist coupling for off-axis print paths was not sized.",
 "A numerical size for the large-strain (hydrogel, 3.5-74 percent swelling) correction to the linear Timoshenko result: Pezzulla's plotted values could not be read and I did not build a finite-strain bilayer model.",
 "Any quantitative treatment of an adhesive or interfacial layer between two separately printed halves, of creep or hysteresis in printed polymers under humidity cycling, or of the peel/shear stress at the strip ends beyond Timoshenko's qualitative statement.",
 "A V2 cube-test value for Flexible 80A water uptake: sibling reports read the 0.7 percent cube row as the older formulation and the V2 datasheet gives +8 percent mass (slab), but no measurement of V2 in the cube test or of its slab thickness exists in the sources I saw; the V1/V2 reading is therefore second-hand and a bench weighing would settle it.",
 "The Grey V5 'keeps about 65 percent of dry modulus' figure used in the wet-softening sensitivity comes from the earlier record (a scrambled PDF table there) and was not rechecked.",
 "Headroom check at start: C: 6.5 GB free, D: 11 GB free; I downloaded 39.8 MB in total (manifest in D:/Users/ashenoy00000/delphi-work/data/bilayer-theory/MANIFEST.json) and ran no Lean process.",
]

RECS = [
 "Keep f(m,n) and the 3/2 ceiling, but state its regime next to every curvature prediction: narrow strip (width below about 2 sqrt(h/kappa), i.e. 2-29 mm for the planned table), linear and small strain, perfectly bonded. Quote Timoshenko 1925 eq.(4) as the source of f, not of the optimum.",
 "Cite the optimum m^2 n = 1 and the 3/2 ceiling as the project's own result (Lean plus the factorised identity 3/2 - f = 3(m^2n-1)^2/(2(...)) in this report), because Timoshenko's paper does not contain them; if a reviewer asks for a printed source, none was found.",
 "For wide architectural panels, predict the curvature with the plate model, not the strip: sphere (strip value) while the sag is below about h/2, then a cylinder along the long side at (1+nu) times the strip value (+30 to +50 percent). To curl across the short side, add anisotropy (print path, fibre or rib orientation) or slits.",
 "Because kinetics scale as a^2/D and the optimum makes a soft active layer the thick one (m = n^-1/2), prefer a STIFF active layer or a thin soft one with a fast-water route; do not pair a thick soft swelling layer with a rigid passive layer if hour-scale actuation is wanted.",
 "Close the two biggest measurement gaps with one bench step each before designing around them: (a) weigh a Flexible 80A V2 cube and a 0.4 mm strip in water over 1, 6, 24, 168 h and fit D and the saturation (resolves the 0.7 versus 8 percent conflict and supplies the missing D); (b) measure the free swelling strain of each layer separately with a ruler or calipers (the real bottleneck for testing the 20 percent claim).",
 "For the Lean track (read-only here, so a suggestion): add (i) the neutral-axis identity E1 a1^2 = E2 a2^2 <=> m^2 n = 1, (ii) the closed form 3/2 - f = 3(m^2n-1)^2/(2(...)), (iii) the invariance of f under E -> E/(1-nu) for equal nu and under m,n -> 1/m,1/n, and (iv) the (1+nu) cylinder theorem; all four were proved symbolically here.",
 "Retrieve Armon 2011, Alben-Balakrisnan-Smela 2011 and Freund 2000 through a library or the authors' pages before any partner document cites their equations or critical widths.",
]

REPRODUCE = [
 {"what": "Environment", "command_or_url": "Python 3.14.2, numpy, sympy 1.14.0, PyMuPDF 1.28.2 (import fitz). Scripts are in D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/ . Fetch with a generic User-Agent such as 'delphi-research/0.1'.", "expected": "no network access needed for the scripts themselves"},
 {"what": "All own-calculation numbers: f ceiling, factorised gap, Timoshenko special cases, FFC=Timoshenko identity, Stoney limit, sensitivity, Pezzulla constants, diffusion response, real-unit times", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/verify_bilayer.py", "expected": "grid_max_f 1.5000000000000002 over 2404601 cells; gap '3*(m**2*n - 1)**2/(2*(m**4*n**2 + 4*m**3*n + 6*m**2*n + 4*m*n + 1))'; swap residual 0; ffc_eq6_minus_timoshenko 0; Stoney overestimates 33.1 %; sqrt((20+14sqrt2)/27)=1.2141; disk R_c=2.1121 sqrt(h/kappa); t90_kappa 0.7239 (n=1,m=1 and n=10); writes verify_bilayer_out.json"},
 {"what": "Plate versus beam (1+nu) derivation and Timoshenko residual", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/plate_vs_beam.py", "expected": "A residual 0; B ratio 'nu + 1'; C ratio 1; B' unequal nu 1.5616"},
 {"what": "Alben eq.(7) minimisation", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/alben_eq7_check.py", "expected": "k = 4*Cs*ea*h/(8*Cb+3*Cs*h**2); Cb->0 gives 4*ea/(3*h); paper constants give kappa 10.0; '(1+nu)*Timoshenko ... equal: True'"},
 {"what": "Timoshenko 1925 text and page images", "command_or_url": "curl -L https://archive.org/download/sim_optical-society-of-america-journal_1925-09_11_3/sim_optical-society-of-america-journal_1925-09_11_3.pdf (if the redirect host stalls, use the workable server listed at https://archive.org/metadata/sim_optical-society-of-america-journal_1925-09_11_3, e.g. https://ia803200.us.archive.org/33/items/<id>/<id>.pdf); then python .../render_pdf_pages.py <pdf> <outdir> 'BI-METAL THERMOSTATS'", "expected": "108-page PDF, sha256 28d3e86b53f276aa83735590cb2ed22fd09b55554d2b31dbc56ceedbfdafb916; PDF page 43 = journal p.235 with eq.(4)-(6); page 44 = p.236 with eq.(7) 48/33; page 50 = p.242 with the plate paragraph (E1/(1-sigma))"},
 {"what": "Stoney 1909 page images", "command_or_url": "https://archive.org/download/paper-doi-10_1098_rspa_1909_0021/paper-doi-10_1098_rspa_1909_0021.pdf", "expected": "5-page PDF, sha256 eae21132...; page 4 shows P t = (1/6)E d^2/r and eq.(1) P = (4/3)E d^2 z/(t l^2)"},
 {"what": "Freund-Floro-Chason 1999 preprint", "command_or_url": "https://digital.library.unt.edu/ark:/67531/metadc707457/m2/1/high_res_d/7024.pdf", "expected": "11 pages, sha256 103fe0c5...; page 4 eq.(6); page 5 text on '30%' and Stoney; page 6 eq.(11) and 'roughly 0.3'"},
 {"what": "Reyssat & Mahadevan equations 2.1-2.6 and time law", "command_or_url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2838359/ ; images https://cdn.ncbi.nlm.nih.gov/pmc/blobs/1901/2838359/bf169d9f0304/rsif20090184e5.jpg and https://cdn.ncbi.nlm.nih.gov/pmc/blobs/1901/2838359/f04e37537981/rsif20090184e6.jpg", "expected": "e5: delta-kappa = alpha delta-phi f(m,n)/h; e6: f(m,n)=6(1+m)^2/[3(1+m)^2+(1+mn)(m^2+1/mn)]; text 'τ = ha2/D ∼ 1000 s', 'τd = 96 ha1.5 min', '29 ha1.3 min'"},
 {"what": "Pezzulla et al. eq.(6) and L+N", "command_or_url": "https://arxiv.org/pdf/1509.05259", "expected": "sha256 ede5bc6d...; 'L + N = κo(1 + ν) and K = 0'; kappa_ob = sqrt((20+14 sqrt2)/27) gamma^2; 'Lb = 0.63 kappa_ob'"},
 {"what": "Abstracts of the unread papers", "command_or_url": "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%2210.1126/science.1203874%22&format=json&resultType=core  (and 10.1021/nl200473p, 10.1039/C3SM52313F)", "expected": "PMIDs 21940888, 21528897, 24668301 with the abstracts quoted above"},
 {"what": "Filament diffusivities", "command_or_url": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10304609/fullTextXML  (search 'Table 3 Diffusivity and time to reach 80%')", "expected": "Nylon 0.001, PC 0.00472, PET-G 0.00335, PLA T-W 0.0151 mm^2/h; t80 360, 92, 125, 27 h"},
 {"what": "Formlabs datasheets", "command_or_url": "the three TDS URLs in the table; parse with PyMuPDF get_text()", "expected": "Nylon 12: 'Elongation at Break (X/Y) 11%', '(Z) 6%', 'Water Absorption (printed part) 0.66%'; Nylon 11 CF 'Tensile Modulus 5.3 GPa 2.8 GPa 1.6 GPa'; Flexible 80A V2 'Deionized Water 1 day -26 +8% +3%'"},
 {"what": "Citation resolution and file manifest", "command_or_url": "curl -s -A 'delphi-research/0.1' https://api.crossref.org/works/<doi> for each DOI listed; python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/make_manifest.py", "expected": "titles as listed; MANIFEST.json with url, date, bytes, sha256 of 12 kept files (39.8 MB)"},
 {"what": "Rebuild this report file", "command_or_url": "python D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/build_result.py", "expected": "writes D:/Users/ashenoy00000/delphi-work/agents2/bm-bilayer-theory-verified.json"},
]

SCRIPTS = [
 "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/verify_bilayer.py",
 "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/plate_vs_beam.py",
 "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/alben_eq7_check.py",
 "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/render_pdf_pages.py",
 "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/make_manifest.py",
 "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-bilayer-theory-verified/build_result.py (with build_result_part1.py, build_result_part2.py)",
]

def main():
    res = {"label": LABEL, "topic": TOPIC, "summary": SUMMARY, "lay_summary": LAY, "glossary": GLOSSARY,
           "table": TABLE, "findings": FINDINGS + FINDINGS2, "key_claims": KEY_CLAIMS, "recommendations": RECS,
           "reproduce": REPRODUCE, "citations": CITATIONS, "could_not_find": COULD_NOT_FIND, "scripts_written": SCRIPTS}
    for f in res["findings"]:
        f.setdefault("evidence_quote", "")
    out = "D:/Users/ashenoy00000/delphi-work/agents2/bm-bilayer-theory-verified.json"
    json.dump(res, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("written", out, os.path.getsize(out), "bytes;", len(res["findings"]), "findings;", len(res["table"]), "table rows")

if __name__ == "__main__":
    main()
