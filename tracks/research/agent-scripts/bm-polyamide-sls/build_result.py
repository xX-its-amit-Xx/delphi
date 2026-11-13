"""Builds D:/Users/ashenoy00000/delphi-work/agents2/bm-polyamide-sls.json . Run: python -I -X utf8 build_result.py
(run calc.py first; this file reads its calc_out.json for the response-time table)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util

spec = importlib.util.spec_from_file_location("p1", "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/build_result_part1.py")
p1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p1)
F = p1.F
add = p1.add

calc = json.load(open("D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-polyamide-sls/calc_out.json", encoding="utf8"))
CALC = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/calc.py"


def rt(D, h, key):
    for r in calc["response_times"]:
        if abs(r["D_m2s"] - D) / D < 1e-9 and abs(r["h_mm"] - h) < 1e-9:
            return r[key]


# ---- response times ----
rows = []
for D in (3e-13, 4.95e-13, 1.4e-12, 4.95e-12):
    for h in (0.4, 0.8, 1.6):
        rows.append((D, h))
rt_txt = "; ".join("D=%.3g, h=%.1f mm: t50=%.1f h, t90=%.1f h (two faces), %.0f h (one face)" % (
    D, h, rt(D, h, "t50_two_faces_h"), rt(D, h, "t90_two_faces_h"), rt(D, h, "t90_one_face_h")) for D, h in rows)
add("RESPONSE TIME of 0.4 / 0.8 / 1.6 mm strips from Fick's law for a plane sheet, t90 = 0.2120 h^2/D (both faces open; exact series gives Dt/h^2 = 0.0492 for 50 %, 0.2120 for 90 %, 0.4453 for 99 %). With D = 4.95e-13 m2/s (measured PA11): 0.4 mm 19 h, 0.8 mm 76 h (3.2 days), 1.6 mm 305 h (12.7 days). With D = 3e-13: 31 / 126 / 503 h. With D = 1.4e-12: 6.7 / 27 / 108 h. If sintered D were 10x larger (5e-12): 1.9 / 7.6 / 30 h. A strip with one face sealed (a bilayer's bonded face) behaves like a sheet of twice the thickness: four times slower. Time scales with h squared: doubling thickness quadruples the time. Arithmetic example: 0.212 x (0.8e-3 m)^2 / 4.95e-13 m2/s = 0.212 x 6.4e-7 / 4.95e-13 = 2.74e5 s = 76 h.",
    CALC + " (full table in calc_out.json)", "medium (D uncertain by a factor ~3 either way; formula exact)",
    rt_txt)
add("Pore-assisted versus polymer-limited kinetics: because sintered strips behave as dense solution-diffusion media (Liebrich) and vapour cannot condense in micrometre voids, the polymer-limited times above are the realistic ones for humidity (vapour) cycling; the 10x-faster sintered D (Villani) was measured on liquid immersion where pores flood within hours, so it is not evidence of faster vapour response. The Fuse minimum wall for Nylon 12 is 0.6 mm per the project record (agents/spec-formlabs-materials.json), so a 0.4 mm strip is below the vendor's minimum feature size.",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC7921953/ ; D:/Users/ashenoy00000/delphi-work/agents/spec-formlabs-materials.json", "medium-low")

# ---- bilayer ----
add("Free hygroscopic strain estimate for PA12 (own calculation): water swing between 30 % and 80 % RH is 0.74 wt% (EOS isotherm points, 0 at 0 %RH assumed, piecewise linear); times 0.143 %/wt% (vendor) to 0.278 %/wt% (polyamide 6.6 coefficient transferred by the earlier agent, an upper bound) gives a free strain of 0.105 % to 0.205 %. Against a perfectly inert partner at the optimum thickness ratio, curvature is kappa = 1.5 d_eps / h (project record, Lean-checked): bending radius 254-130 mm for a 0.4 mm bilayer, 507-261 mm for 0.8 mm, 1014-521 mm for 1.6 mm, i.e. a 40 mm cantilever strip rises 3.2-6.1 mm, 1.6-3.1 mm and 0.8-1.5 mm respectively. A real partner has its own swelling, so these are ceilings.",
    CALC, "low-medium", "d_eps 1.05e-3 to 2.05e-3; R 130-1014 mm; tip 0.8-6.1 mm on 40 mm")
add("Moisture softening barely touches the curvature ceiling: when the modulus ratio n changes by a factor 0.568 or 0.483 (the Amstutz wet/dry modulus ratios) with the thickness ratio tuned for the dry state, f(m,n) stays at 1.47-1.49 (n = 1-150: 1.470/1.450 at n=1, 1.478/1.463 at n=10, 1.490/1.483 at n=100), i.e. a loss of at most 3.3 % of the 3/2 ceiling. This uses the project record formula; the modulus drop matters for force and stiffness, not for curvature.",
    CALC + " ; project record D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/HygromorphCeilingCheck.lean (read as cited, not re-run)", "high (arithmetic)",
    "f >= 1.450 for n=1, >= 1.463 for n=10")
add("Same-family partners do not give a usable differential: Formlabs Nylon 12 GF, Nylon 12 Tough and Nylon 12 White all gain 0.1 % in the 24 h cube test, indistinguishable from unfilled Nylon 12 (earlier agent's reading of Formlabs' solvent table, not re-fetched here), and carbon-fibre filling cut Zheng's saturation uptake by only about 16 % (5.47 -> 4.6 %). A PA12 + filled-PA12 pair would therefore have a differential strain of order 15 % of PA12's already small 0.1-0.2 %. A usable pair needs a dissimilar passive layer (for example a rigid SLA resin with under 0.1 % 24 h uptake per the project record, or a non-polymer sheet) bonded to PA12; this has not been demonstrated in the sources found.",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC9320715/ ; D:/Users/ashenoy00000/delphi-work/agents/spec-resin-chemistry.json", "medium-low")
add("A TPU + PA12 pair is mechanically plausible: with the project law m^2 n = 1, PA12 (1850 MPa) against TPU 90A (secant 12.2 MPa, ratio 152) puts the optimum thickness of the soft layer at sqrt(152) = 12.3 times the stiff layer (e.g. 0.1 mm PA12 with 1.2 mm TPU, total 1.3 mm), which makes the soft layer slow (t90 ~ 0.2 x (1.2e-3 m)^2/D). Water uptake by mass is similar at 80 % RH (TPU 1.35 wt% versus PA12 ~1.05 wt% interpolated), so no mass-based differential is available; FDM TPU volume swelling up to 8 % in saline (about 2.7 % linear if isotropic, own conversion) suggests TPU could swell more per unit mass, but there is no measured expansion coefficient for SLS TPU. Adhesive bonding of FDM TPU to PBF PA12 has been benchmarked (Loctite 401 + 770 primer: peel 2.6 N/mm, lap shear 3.0 MPa, tensile 2.7 MPa).",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC12824215/ (doi 10.1038/s41598-025-32559-w) ; " + CALC, "low-medium",
    "optimum soft/stiff thickness 12.3; peel 2.6 N/mm",
    "Loctite 401 + 770 achieved the highest mean strengths with low scatter (COV ≤ 15%) in peel (2.6 N/mm), shear (3.0 MPa), and tensile (2.7 MPa) testing.")
add("VERDICT on a PA12 + partner humidity bilayer: usable only as a slow, small actuator. Response at 0.8-1.6 mm total thickness is days to weeks (t90 76-305 h at the central D, one-face exposure 4x longer); the stroke from 30 -> 80 % RH is a 0.8-6 mm tip rise on a 40 mm strip (R 130-1000 mm). That suits seasonal or multi-day humidity swings in a facade or screen, not diurnal reaction (0.4 mm, below the Fuse minimum wall, gives t50 4-7 h). It beats nothing the earlier agents found for speed; the earlier ~0.2-0.45 % dry-to-saturated estimate for PA12 is refined here to ~0.16-0.23 % (vendor ratio) up to 0.45 % (PA6.6 transfer).",
    CALC, "low-medium")

# ---- contradictions with earlier agents ----
add("CONFIRMED from earlier agents: Arkema PA12 1.6 % and PA11 0.8 % (50 % RH) / 1.9 % (immersion); Formlabs Nylon 12 0.66 %, TPU 0.89 %, Nylon 11 0.07 % in the 2021 TDS; sintered PA12 immersion uptake 5.47 % (Zheng) and 10.49 % (Villani); no measured CME for PA11/PA12 exists; no SLS humidity actuator in the literature (Park/Kwon treat humidity swelling as a defect).",
    "see individual findings", "high")
add("CONTRADICTION / REFINEMENT 1 (agents/spec-resin-chemistry.json, summary 'PA12 on the Fuse gives about 0.2-0.45% from dry to saturated'): that range rests on transferring a PA6.6 coefficient. The only PA12-specific number found (a vendor statement, 0.2 % at 1.4 % uptake) gives 0.14 %/wt%, which lowers the estimate to about 0.16-0.23 % for 1.1-1.6 wt%. Still an estimate, not a measurement.",
    CALC, "low")
add("CONTRADICTION / REFINEMENT 2 (spec-resin-chemistry.json says Zheng found 'negligible' modulus change and Villani ~1 -> 0.8 GPa, noting they disagree): a third and fourth source now exist, Arkema -4 % (dry to conditioned) and Amstutz -43 to -52 % (injection-moulded PA12, 23 C), so the disagreement is wider than two papers: it spans -4 % to -52 %.",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC8549196/", "medium")
add("CONTRADICTION / REFINEMENT 3 (spec-resin-chemistry.json: 'uptake dominated by pore filling, not polymer swelling' as Villani's interpretation, not tested): this run supports it quantitatively with the density argument (sintered density 0.90-0.95 gives 6-12 % void capacity matching the 5.5-10.5 % immersion uptakes) but also shows sintered parts at 50 % RH (0.52 %) and 96 % RH (1.33 %) hold only about the dense-polymer amount, so pore filling matters for rain, splash and immersion, not for humid air.",
    CALC, "medium")
add("CONTRADICTION / REFINEMENT 4 (spec-bilayer-physics.json: response time from nylon PA6/66 filament, D = 0.001 mm2/h = 2.78e-13 m2/s, giving 160 h at 0.4 mm using tau = h^2/D): PA11 measured D = 1.78e-3 mm2/h (1.8x larger) and PA12 inferred 1e-3 to 5e-3 mm2/h are the same order, so the earlier 'tens to thousands of hours' range stands. But tau = h^2/D is 4.7 times longer than the time to 90 % (0.212 h^2/D for two open faces), so it overstates the practical response. For example 0.4 mm at D=2.78e-13 gives tau 160 h but t90 only 34 h.",
    CALC, "medium")
add("NOT CONTRADICTED: the project record ceiling f = 3/2 at m^2 n = 1 was applied as given; I did not re-run the Lean file (read-only) and did not re-derive it.", "project record", "n/a")

FINDINGS = F

# ---------------- table ----------------
TABLE = [
    {"name": "PA12 sintered (EOS PA 2200) sorption isotherm", "fields": "water_uptake=0.52 wt% at 23C/50%RH; 1.33 wt% at 23C/96%RH; 1.93 wt% water 100C saturation; density=0.90-0.95 g/cm3; tensile_modulus=1700 +/-150 MPa (EOS method)", "source": "https://www.sculpteo.com/media/imagecontent/PA2200_Product_information_03-10_en.pdf"},
    {"name": "PA12 sintered, Protolabs (EOS PA 2200 Balance)", "fields": "water_uptake=0.5 +/-0.2 wt% at 20C/50%RH (ISO 62); 2.0 +/-0.3 wt% boiling water 24 h", "source": "https://protolabs.com/media/ytzjjomn/pa12-vapour-smooth-white-en-24_10.pdf"},
    {"name": "PA12 sintered, Formlabs Nylon 12 Powder", "fields": "water_absorption=0.66 % (ASTM D570, duration not stated); tensile_modulus=1850 MPa; powder_moisture=0.25 %; conditioning=50%RH/23C/7 d", "source": "https://media.formlabs.com/m/2a02034348060e54/original/-ENUS-Nylon-12-TDS.pdf"},
    {"name": "PA11 sintered, Formlabs Nylon 11 Powder (2021 TDS)", "fields": "water_absorption=0.07 % (ASTM D570); tensile_modulus=1.6 GPa; powder_moisture=0.37 %", "source": "https://media.formlabs.com/m/151bd67a83b2334f/original/-ENUS-Nylon-11-TDS.pdf"},
    {"name": "TPU sintered, Formlabs TPU 90A Powder", "fields": "water_absorption=0.89 % (ASTM D570); stress_50pct_strain=6.1 MPa (secant 12.2 MPa, own calc); Shore=90A; tensile modulus not published", "source": "https://epfl.ch/schools/sti/ateliers/wp-content/uploads/2024/09/TPU_90A-SLS-EN.pdf"},
    {"name": "PA12 dense moulded, Arkema Rilsamid AESNO MED", "fields": "water_uptake_immersion_23C=1.6 wt% (ISO 62); density=1.01 g/cm3; E_dry=1500 MPa; E_cond=1440 MPa", "source": "https://hpp.arkema.com/assets/arkema/TDS_RILSAMID%C2%AE%20AESNO%20MED_en_WW.pdf"},
    {"name": "PA11 dense moulded, Arkema Rilsan BMNO TLD", "fields": "water_uptake_50%RH_23C=0.8 wt%; immersion_23C=1.9 wt% (ISO 62); density=1.03 g/cm3; E_cond=1250 MPa", "source": "https://hpp.arkema.com/assets/arkema/TDS_RILSAN%C2%AE%20BMNO%20TLD_en_WW.pdf"},
    {"name": "PA11 and PA12 hot-pressed (Bahrami 2021)", "fields": "saturation_water=1.5 wt%; saturation_50%RH=0.8 wt%; time_to_saturation=~2 months; sheet=20x20x4 mm", "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8537549/"},
    {"name": "PA12 sintered immersion (Villani 2024)", "fields": "mass_gain_saturation=10.49 wt%; t_sat=2 days; D=~10x base (value not in abstract); E=1 -> 0.8 GPa after 2 h; yield=20 -> 14 MPa", "source": "https://link.springer.com/article/10.1007/s40964-024-00826-3"},
    {"name": "PA12 sintered immersion (Zheng 2022)", "fields": "mass_gain_saturation=5.47 wt% (PA12), 4.6 wt% (CF/PA12); cylinders 8x8 mm; fast uptake ~36 h; compressive_strength=-15 %; modulus 'negligible'", "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9320715/"},
    {"name": "PA12 injection-moulded (Amstutz 2021, Grilamid L25)", "fields": "uptake_40d_water_23C=0.91 wt% (IQR 0.15); E_ambient=1553.5 MPa; E_wet=882.0 MPa (-43 %); E_1mm/min 1506.5 -> 728.0 MPa (-52 %); yield 45.5 -> 36.2 MPa", "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8549196/"},
    {"name": "PA11 injection-moulded diffusion (Oliver-Ortega 2018)", "fields": "D_23C=4.95e-13 m2/s; Minf_23C=1.43 wt%; D_40C=22.0e-13 m2/s; Minf_40C=1.58 wt%", "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6404017/"},
    {"name": "PA12 D inferred (own calculation)", "fields": "D=3.0e-13 to 1.4e-12 m2/s (Amstutz 40 d bars; Bahrami 2-month sheets); central 5e-13", "source": CALC},
    {"name": "TPU Estane 58887 (polyether, 87A) isotherm", "fields": "water=0.25 wt% at 20%RH; 0.53 at 40%; 0.91 at 60%; 1.35 at 80% (23-25C)", "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10534667/"},
    {"name": "TPU FDM filaments 60A-98A in 0.9 % NaCl (Simunic 2026)", "fields": "uptake_96h=1.18-1.80 wt%; D=1.4e-13 to 3.4e-12 m2/s; volume_change_96h=0.6-8 %", "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13258891/"},
    {"name": "Hygroscopic expansion, PA12 (vendor, cast)", "fields": "dimensional_change=0.2 % at 1.4 % uptake (0.143 %/wt%); PA6 2 % at 9 %; PA6.6 3.5 % at 7 %", "source": "https://www.intechpower.com/material-information/effects-of-moisture-absorption"},
    {"name": "Sintered PA12 pore structure (Liebrich 2021)", "fields": "closed_porosity=0.31-1.04 % (CT); layer=100 um; transport=solution-diffusion for >=4 layers", "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7921953/"},
]
for D, h in rows:
    TABLE.append({"name": "Response time, PA12 strip h=%.1f mm, D=%.3g m2/s" % (h, D),
                  "fields": "tau=h2/D=%.1f h; t50_two_faces=%.1f h; t90_two_faces=%.1f h; t90_one_face=%.0f h" % (
                      rt(D, h, "tau_h2_over_D_h"), rt(D, h, "t50_two_faces_h"), rt(D, h, "t90_two_faces_h"), rt(D, h, "t90_one_face_h")),
                  "source": CALC})
for b in calc["bilayer_estimates"]:
    if b["RH"] == [30, 80]:
        TABLE.append({"name": "PA12 + inert partner, optimum ratio, RH 30->80 %%, h_total=%.1f mm, beta=%.3f %%/wt%%" % (b["h_total_mm"], b["beta_pct_per_wt"]),
                      "fields": "free_strain=%.2e; radius=%.0f mm; tip_rise_40mm_strip=%.2f mm" % (b["d_eps"], b["R_mm"], b["tip_40mm_mm"]),
                      "source": CALC})

KEY_CLAIMS = [
    {"claim": "Laser-sintered PA12 holds only about the dense-polymer amount of water in humid air: 0.52 wt% at 23 C / 50 % RH and 1.33 wt% at 96 % RH, 1.93 wt% in 100 C water.",
     "source": "https://www.sculpteo.com/media/imagecontent/PA2200_Product_information_03-10_en.pdf",
     "evidence_quote": "Water absorption 100°C, saturation in water 1,93 | 23°C, 96% RF 1,33 | 23°C, 50% RF 0,52 (pdftotext, labels and values in separate columns)"},
    {"claim": "The 5.5-10.5 wt% uptakes of sintered PA12 on immersion are mostly water filling voids (density 0.90-0.95 vs 1.01 dense allows 6-12 % void water), not polymer swelling; dense PA12 saturates at 1.6 %.",
     "source": "https://link.springer.com/article/10.1007/s40964-024-00826-3 ; https://www.amf.uzh.ch/dam/jcr:59a8b14a-c212-4693-8443-d5e543aeabe2/Material-Data-PA2200-ENGLISH.pdf ; own calc " + CALC,
     "evidence_quote": "Water absorption reaches saturation after 2 days of immersion with a weight variation of around 10.49% and a resulting diffusion coefficient one order of magnitude greater than the value of the base material, due to the porosity of the samples."},
    {"claim": "Bulk water diffusivity of PA11 at 23 C is 4.95e-13 m2/s (measured) and PA12 is the same order (3e-13 to 1.4e-12 by own bounds), so the 0.8 mm sintered strip needs about 76-126 h to reach 90 % of equilibrium with both faces open, and 4 times that with one face sealed.",
     "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6404017/ ; own calc " + CALC,
     "evidence_quote": "23 0 1.43 ± 0.02 0.305 ± 0.045 0.088 ± 0.023 4.95 ± 0.02 (columns: temperature, fibre content, M∞ %, n, K, D in 10−13 m2·s−1)"},
    {"claim": "No measured hygroscopic expansion coefficient exists for PA11/PA12/TPU; the only PA12 number is a vendor 0.2 % dimensional change at 1.4 % uptake, giving a PA12 free strain of about 0.1-0.2 % over 30-80 % RH and a weak bilayer (R of 130-1000 mm).",
     "source": "https://www.intechpower.com/material-information/effects-of-moisture-absorption",
     "evidence_quote": "PowerCore, with a maximum absorption of 1.4%, has a corresponding dimensional change of 0.2%."},
]

REPRODUCE = [
    {"what": "Download and checksum all kept source files (log of URL, date, bytes, sha256 is in the manifest)", "command_or_url": "cat D:/Users/ashenoy00000/delphi-work/data/bm-polyamide/MANIFEST.tsv", "expected": "tab-separated url, UTC date, bytes, sha256, filename; about 20 files, a few MB in total; fetched via D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/fetch.sh (curl 8.x) and epmc_fulltext.sh"},
    {"what": "Extract EOS, Arkema and Formlabs sheet values", "command_or_url": "pdftotext -layout D:/Users/ashenoy00000/delphi-work/data/bm-polyamide/eos-pa2200-productinfo-2010.pdf - | head -15 ; pdftotext -raw .../arkema-rilsan-bmno-tld.pdf - | grep -A2 'Water absorption' ; pdftotext -raw .../formlabs-nylon12-tds.pdf - | grep 'Water Absorption' (poppler pdftotext)", "expected": "EOS column 1.93 / 1.33 / 0.52 %; Arkema PA11 0.8 % (50 %RH) and 1.9 % (immersion); Formlabs N12 0.66 %, N11 0.07 %, TPU 0.89 %"},
    {"what": "Read the open papers' key numbers from the saved Europe PMC text", "command_or_url": "grep -n '4.95' D:/Users/ashenoy00000/delphi-work/data/bm-polyamide/PMC6404017.txt ; grep -n '882.0' .../PMC8549196.txt (strip LaTeX) ; grep -n '5.47%' .../PMC9320715.txt ; grep -n '1.5% and 0.8%' .../PMC8537549.txt ; grep -n '0.0135' .../PMC10534667.txt ; grep -n '3.40 ×' .../PMC13258891.txt", "expected": "D 4.95e-13 m2/s; E 1553.5 and 882.0 MPa; 5.47 %; 1.5 % and 0.8 %; TPU 80 %RH 0.0135; D up to 3.40e-12"},
    {"what": "Re-fetch the full text of an open paper", "command_or_url": "curl -s https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6404017/fullTextXML (or sh D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/epmc_fulltext.sh PMC6404017)", "expected": "JWATS XML with Table 3 (D column)"},
    {"what": "Re-run all calculations (Fick times, pore capacity, Kelvin radius, bilayer curvature, f sensitivity)", "command_or_url": "python -I -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/calc.py (Python 3.14, standard library only)", "expected": "Dt/l^2 = 0.0492 / 0.2120 / 0.4453; t90 0.8 mm at D=4.95e-13 = 76.2 h; pore capacity total 10.12 % at density 0.93; Kelvin 1.51 nm at 50 % RH; f >= 1.450"},
    {"what": "Re-verify DOIs", "command_or_url": "sh D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/crossref_verify.sh <doi...> (Crossref REST, generic User-Agent)", "expected": "one line per DOI with authors/year/title/journal; 10.3390/polym15183770 is not in Crossref at fetch time and was verified via Europe PMC instead (sh epmc_search.sh 'DOI:\"10.3390/polym15183770\"')"},
    {"what": "Rebuild this JSON", "command_or_url": "python -I -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/build_result.py", "expected": "writes D:/Users/ashenoy00000/delphi-work/agents2/bm-polyamide-sls.json"},
    {"what": "Not reproducible by script", "command_or_url": "Villani 2024, Paolucci 2020 (Wiley), Pichler 2023 DVS (ScienceDirect 403): only abstracts / second-hand tables were read", "expected": "a reader with institutional access can check the D value in Villani and the RH conditioning in Paolucci"},
]

CITATIONS = [
    {"authors": "Villani V, Ponticelli GS, Venettacci S, Guarino S", "year": 2024, "title": "Effect of water absorption on the properties of selective laser-sintered PA12 specimens", "venue": "Progress in Additive Manufacturing", "doi_or_arxiv": "10.1007/s40964-024-00826-3", "verified": True, "how_verified": "Crossref API returned the record in this run; abstract read on the Springer page (paywalled body)", "used_for": "10.49 % saturation, 2 days, D one order above base, modulus 1 -> 0.8 GPa"},
    {"authors": "Zheng X, Meng J, Liu Y", "year": 2022, "title": "Strain Rate Dependence of Compressive Mechanical Properties of Polyamide and Its Composite Fabricated Using Selective Laser Sintering under Saturated-Water Conditions", "venue": "Micromachines 13, 1041", "doi_or_arxiv": "10.3390/mi13071041", "verified": True, "how_verified": "Crossref API + full text via Europe PMC PMC9320715", "used_for": "5.47 % saturation of SLS PA12, negligible modulus change"},
    {"authors": "Bahrami M, Abenojar J, Martinez MA", "year": 2021, "title": "Comparative Characterization of Hot-Pressed Polyamide 11 and 12: Mechanical, Thermal and Durability Properties", "venue": "Polymers 13, 3553", "doi_or_arxiv": "10.3390/polym13203553", "verified": True, "how_verified": "Crossref API + full text via Europe PMC PMC8537549", "used_for": "PA11/PA12 1.5 % water, 0.8 % at 50 % RH, 4 mm sheets, 2 months"},
    {"authors": "Oliver-Ortega H, Mendez JA, Espinach FX, Tarres Q, Ardanuy M, Mutje P", "year": 2018, "title": "Impact Strength and Water Uptake Behaviors of Fully Bio-Based PA11-SGW Composites", "venue": "Polymers 10, 717", "doi_or_arxiv": "10.3390/polym10070717", "verified": True, "how_verified": "Crossref API + full text via Europe PMC PMC6404017, Table 3", "used_for": "PA11 D = 4.95e-13 m2/s at 23 C"},
    {"authors": "Amstutz C, Weisse B, Valet S, Haeberlin A, Burger J, Zurbuchen A", "year": 2021, "title": "Temperature-dependent tensile properties of polyamide 12 for the use in percutaneous transluminal coronary angioplasty balloon catheters", "venue": "BioMedical Engineering OnLine 20, 111", "doi_or_arxiv": "10.1186/s12938-021-00947-8", "verified": True, "how_verified": "Crossref API + full text via Europe PMC PMC8549196, Tables 2 and 5", "used_for": "PA12 wet/dry modulus -43 to -52 %, 0.91 % uptake in 40 d"},
    {"authors": "Liebrich A, Langowski HC, Pinzer BR", "year": 2021, "title": "Thickness-Dependent Permeation Properties of Quenched and Standard Laser-Sintered Polyamide 12 Sheets", "venue": "Polymers 13, 603", "doi_or_arxiv": "10.3390/polym13040603", "verified": True, "how_verified": "Crossref API + full text via Europe PMC PMC7921953", "used_for": "closed porosity 0.31-1.04 %, solution-diffusion in sintered sheets"},
    {"authors": "Liebrich A, Langowski HC, Schreiber R, Pinzer BR", "year": 2021, "title": "Effect of thickness and build orientation on the water vapor and oxygen permeation properties of laser-sintered polyamide 12 sheets", "venue": "Rapid Prototyping Journal", "doi_or_arxiv": "10.1108/rpj-05-2020-0101", "verified": True, "how_verified": "Crossref API returned the record; abstract text came from a publisher-page fetch summary, quote not independently copied", "used_for": "water-vapour permeation of LS sheets in the range of extruded PA12 (via the open Polymers paper's own statement)"},
    {"authors": "Paolucci F, Peters GWM, Govaert LE", "year": 2020, "title": "Plasticity-controlled failure of sintered and molded polyamide 12: Influence of temperature and water absorption", "venue": "Journal of Applied Polymer Science 137, 48525", "doi_or_arxiv": "10.1002/app.48525", "verified": True, "how_verified": "Crossref API returned the record (issued 2019 online); abstract seen on the TU/e portal; full text blocked, no water numbers read", "used_for": "existence of a sintered-vs-moulded PA12 humidity study; numbers not obtained"},
    {"authors": "Park JY, Ha S, Park E, Kwon D, Kim N", "year": 2016, "title": "Hygroscopic Swelling Behavior of 3D Printed Parts due to Changes in Environmental Conditions", "venue": "ASME IDETC/CIE 2016", "doi_or_arxiv": "10.1115/DETC2016-59945", "verified": True, "how_verified": "Crossref API + abstract read on pure.skku.edu page (saved)", "used_for": "SLS nylon-12 dimensions track RH, mostly in-plane; no coefficient"},
    {"authors": "Kwon D, Park E, Ha S, Kim N", "year": 2017, "title": "Effect of humidity changes on dimensional stability of 3D printed parts by selective laser sintering", "venue": "International Journal of Precision Engineering and Manufacturing", "doi_or_arxiv": "10.1007/s12541-017-0150-0", "verified": True, "how_verified": "Crossref API + abstract read on Springer page (saved)", "used_for": "humidity changes can violate dimensional specs of SLS parts; no number"},
    {"authors": "Pichler C, Oberparleiter S, Lackner R", "year": 2023, "title": "Surrounding water vapor induced diffusion and physisorption of water within thermoplastic polyurethane TPU samples: A critical analysis of DVS data", "venue": "Polymer Testing", "doi_or_arxiv": "10.1016/j.polymertesting.2023.107962", "verified": True, "how_verified": "Crossref API returned the record; content NOT read (403); isotherm values taken from the follow-up paper's Table 1", "used_for": "origin of the Estane 58887 isotherm"},
    {"authors": "Pichler C, Oberparleiter S, Lackner R", "year": 2023, "title": "Scott Blair Fractional-Type Viscoelastic Behavior of Thermoplastic Polyurethane", "venue": "Polymers 15, 3770", "doi_or_arxiv": "10.3390/polym15183770", "verified": True, "how_verified": "Europe PMC search by DOI returned the record and full text PMC10534667 (Crossref had no record at fetch time); Table 1 read", "used_for": "TPU water content vs RH (0.25-1.35 wt% at 20-80 % RH)"},
    {"authors": "Simunic N, Kostadin T, Hoster J, Obranovic D", "year": 2026, "title": "Hygroscopic Behaviour and Diffusion Characteristics of Flexible TPU Materials Fabricated by FDM for Potential Biomedical Applications", "venue": "Polymers 18, 1392", "doi_or_arxiv": "10.3390/polym18111392", "verified": True, "how_verified": "Crossref API returned the record in this run; full text via Europe PMC PMC13258891", "used_for": "TPU D 1.4e-13 to 3.4e-12 m2/s, uptake 1.18-1.80 %, volume change"},
    {"authors": "Pilipovic A, Ilincic P, Bakic A, Kodvanj J", "year": 2022, "title": "Influence of Atmospheric Conditions on Mechanical Properties of Polyamide with Different Content of Recycled Material in Selective Laser Sintering", "venue": "Polymers 14, 2355", "doi_or_arxiv": "10.3390/polym14122355", "verified": True, "how_verified": "Crossref API (second attempt) + full text via Europe PMC PMC9227374", "used_for": "PA 2200 modulus 1.7 -> 1.1 GPa under weathering; lowest flexural after 28 d at 100 % RH"},
    {"authors": "Aniskevich A, Bulderberga O, Stankevics L", "year": 2023, "title": "Moisture Sorption and Degradation of Polymer Filaments Used in 3D Printing", "venue": "Polymers 15, 2600", "doi_or_arxiv": "10.3390/polym15122600", "verified": True, "how_verified": "Crossref API returned the record; D value for nylon taken from earlier agent's file, not re-read", "used_for": "comparison with the earlier PA6/66 filament D"},
    {"authors": "Alwis Weerasinghe S, Klodowski A, Semken R, Orzechowski G, Mikkola A", "year": 2025, "title": "Benchmarking adhesive performance in bonding FDM TPU to PBF PA12 3D-printed parts", "venue": "Scientific Reports", "doi_or_arxiv": "10.1038/s41598-025-32559-w", "verified": True, "how_verified": "Crossref API + abstract read from Europe PMC PMC12824215", "used_for": "adhesive bonding of TPU to PA12 (peel 2.6 N/mm)"},
]

COULD_NOT_FIND = [
    "A peer-reviewed measured coefficient of hygroscopic expansion for PA11, PA12, sintered PA12 or TPU. Only a vendor statement (0.2 % at 1.4 % uptake, cast PA12) and qualitative reports (Park 2016, Kwon 2017) exist; my strain numbers are estimates.",
    "A primary-source water diffusivity for PA12 at 23 C. The 3e-13 to 1.4e-12 m2/s range is my own inference from two kinetics datasets (Amstutz, Bahrami) with stated assumptions; Villani's D value is paywalled and its abstract gives only 'one order of magnitude greater than the base material'.",
    "Full-text numbers of Paolucci 2020 (sintered vs moulded PA12 at different RH): Wiley blocked automated download; only the abstract was read.",
    "The Pichler 2023 DVS paper itself (ScienceDirect returned 403); the TPU isotherm and D were taken from a follow-up open paper's Table 1 and are second-hand.",
    "Isotherms with 4 or more RH points for PA11 or PA12 (only EOS 0/50/96 % RH, Arkema 50 % RH and immersion); Arkema's water-versus-RH curves are figures I could not read as numbers.",
    "Wet versus dry modulus for any TPU, and any SLS-TPU diffusivity or swelling coefficient; Formlabs TPU 90A lists no modulus.",
    "Direct test separating pore-filling water from polymer-bound water in one sintered part (vapour versus liquid); my separation uses density, Kelvin radius and published porosity, not a measurement.",
    "The current Formlabs Nylon 11 product-page value (0.4 %) the earlier agent reported: not re-fetched; only the 2021 TDS value 0.07 % was confirmed. The Resinex page the earlier agent cited returned nothing in this run (580-byte stub), so its PA11 1.9 / PA12 1.6 reseller claim was replaced by the Arkema sheets themselves.",
    "A current (2026) EOS PA 2200 material data sheet: the moisture values come from 2007-2010 copies hosted by Sculpteo and the University of Zurich.",
    "Ghimouz/Kenne 2024 (J Appl Polym Sci, humidity-aged PA12 tensile data) was downloaded and read for RH effects but only qualitative statements (80 % RH lowers Young's modulus at 70 C) could be extracted cleanly; no number used.",
    "Headroom: RAM free was 32 % at start, C: 6.5 GB, D: 11 GB; no heavy command was run, no Lean run, total downloads a few MB.",
]

RECOMMENDATIONS = [
    "Treat PA12/PA11 SLS strips as slow, small hygromorph layers: design for multi-day to seasonal humidity change; expect 0.1-0.2 % free strain over 30-80 % RH. Do not promise diurnal response below about 0.8 mm total thickness.",
    "Run the cheap decisive experiment on the Fuse: print 40 x 5 mm Nylon 12 and Nylon 11 strips at 0.6, 0.8, 1.6 mm, dry at 50 C under vacuum or dry air to constant mass, then expose to 30, 50, 80 % RH in salt-solution jars; record mass and length (calipers or image) at 1, 3, 7, 14, 28 days. This yields the missing D, isotherm and expansion coefficient for the actual powder and resolves the -4 % versus -52 % modulus disagreement.",
    "Avoid conditioning above about 60-80 C when measuring swelling: Kiwa shows recrystallisation can shrink PA volume by 1-4 % and mask swelling.",
    "Keep liquid water off sintered parts unless you want the 5-10 % pore-fill mass change; coat or infiltrate if a vapour-only response is required.",
    "For a usable bilayer prefer a dissimilar passive layer (rigid, nearly non-hygroscopic) bonded with a tested adhesive; same-powder fillers (glass, carbon) reduce PA12 uptake only about 16 %. TPU as the active partner is a hypothesis: measure its expansion before designing.",
    "Because the project ceiling f = 3/2 is insensitive to the 40-50 % modulus loss on wetting (at most 3 % loss of curvature coefficient), size the layer thickness ratio from the mid-state modulus ratio and accept the drift.",
]

GLOSSARY = [
    {"term": "polyamide 12 / 11 (PA12, PA11, nylon)", "plain": "Tough plastics made of long chains with water-attracting links; the number is how many carbon atoms sit between the links."},
    {"term": "TPU", "plain": "Thermoplastic polyurethane, a rubbery plastic."},
    {"term": "SLS (selective laser sintering)", "plain": "A printing method that fuses plastic powder with a laser, layer by layer, leaving tiny gaps inside."},
    {"term": "relative humidity (RH)", "plain": "How full of water vapour the air is, as a percentage of the most it can hold."},
    {"term": "sorption isotherm", "plain": "A curve (or a few points) showing how much water a material holds at each humidity once it has settled."},
    {"term": "diffusion coefficient (D)", "plain": "A number that says how fast water creeps into a material; bigger means faster."},
    {"term": "t90", "plain": "The time to take up 90 percent of the water the strip will eventually hold."},
    {"term": "pore-filling water", "plain": "Liquid water sitting in the empty gaps of a sintered part, like water in a sponge; it adds weight but does not make the plastic itself swell."},
    {"term": "absorbed (bound) water", "plain": "Water that has actually entered the plastic between its chains; this is what swells and softens it."},
    {"term": "hygroscopic expansion", "plain": "How much a material grows in length when it takes up water."},
    {"term": "modulus", "plain": "A measure of stiffness; a lower number means the material bends more easily."},
    {"term": "bilayer", "plain": "Two layers glued together so that if one swells more than the other, the strip curls."},
    {"term": "Kelvin radius", "plain": "The biggest gap that humid air can fill with liquid water by itself; larger gaps stay dry until they are wetted directly."},
    {"term": "Fickian (Fick's law)", "plain": "The standard maths for steady creeping of a substance into a solid, in which time grows with the square of thickness."},
]

LAY = ("Nylon-type 3D prints take up a little water from the air, much as a wooden spoon does. At normal indoor humidity a printed nylon 12 part holds about half a percent of its weight in water, and at very humid air about one and a third percent. "
       "If you dunk a printed part in water it can soak up five to ten percent, but most of that is just water filling the tiny gaps left by the printing process, like a sponge, and not water inside the plastic. "
       "Water moves into the plastic itself very slowly: a strip 0.8 mm thick, about as thick as a few sheets of card, needs three to five days to fill most of the way, and a 1.6 mm strip needs two to three weeks. "
       "The plastic also grows only about a tenth to a fifth of one percent, so a 40 mm strip glued to a water-proof partner would curl up only a few millimetres, slowly. "
       "That makes nylon a possible slow humidity-sensing skin for a building over days or seasons, but not a quick-reacting one, and nobody has yet measured the exact growth, so the first job is a simple bench test.")

SUMMARY = ("Polyamide SLS parts and TPU hold little water from humid air and respond slowly. Sintered PA12 (EOS PA 2200 sheet) holds 0.52 wt% at 23 C/50 % RH, 1.33 wt% at 96 % RH and 1.93 wt% in 100 C water; dense PA12 saturates at 1.6 % and dense PA11 at 0.8 % (50 % RH) and 1.9 % (immersion) per Arkema ISO 62; Formlabs lists 0.66 % (Nylon 12), 0.07 % (Nylon 11, 2021 TDS) and 0.89 % (TPU 90A) by ASTM D570. A TPU (Estane 87A) isotherm goes 0.25, 0.53, 0.91, 1.35 wt% at 20, 40, 60, 80 % RH. "
           "The 5.5-10.5 % uptakes reported for immersed sintered PA12 are mostly pore filling: sintered density 0.90-0.95 against 1.01 dense gives 6-12 % void capacity, while Kelvin-radius arithmetic shows humid air cannot fill micrometre voids. "
           "Measured diffusivity: PA11 4.95e-13 m2/s (23 C); PA12 not measured in open sources, bounded by my calculation at 3e-13 to 1.4e-12 m2/s; FDM TPU 1.4e-13 to 3.4e-12. With t90 = 0.212 h^2/D, 0.4 / 0.8 / 1.6 mm strips need about 19 / 76 / 305 h (both faces open, D = 4.95e-13; range 7-31 h, 27-126 h, 108-503 h for D 1.4e-12 to 3e-13), 4 times longer with one face sealed. "
           "No measured hygroscopic expansion coefficient exists; a vendor figure (0.2 % at 1.4 % uptake) implies 0.1-0.2 % free strain over 30-80 % RH, i.e. bending radii of 130-1000 mm and 1-6 mm tip rise on a 40 mm strip even against an inert partner. Wet/dry modulus sources disagree from -4 % to -52 %. Moisture softening costs at most 3 % of the 3/2 curvature ceiling. A same-powder filled partner gives little (CF fill cut uptake ~16 %); a dissimilar rigid, non-hygroscopic partner is needed. Usable only as a slow (days to weeks), small humidity layer.")

result = {
    "label": "bm-polyamide-sls",
    "topic": "Polyamide 11 and 12 (SLS) and TPU: moisture, swelling, kinetics",
    "summary": SUMMARY,
    "lay_summary": LAY,
    "glossary": GLOSSARY,
    "findings": FINDINGS,
    "key_claims": KEY_CLAIMS,
    "table": TABLE,
    "recommendations": RECOMMENDATIONS,
    "reproduce": REPRODUCE,
    "citations": CITATIONS,
    "could_not_find": COULD_NOT_FIND,
    "scripts_written": [
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/calc.py",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/build_result.py",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/build_result_part1.py",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/fetch.sh",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/epmc_search.sh",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/epmc_fulltext.sh",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/crossref_verify.sh",
        "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-polyamide-sls/crossref_search.sh",
    ],
}

out = "D:/Users/ashenoy00000/delphi-work/agents2/bm-polyamide-sls.json"
json.dump(result, open(out, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("wrote", out, len(json.dumps(result)), "bytes;", len(FINDINGS), "findings;", len(TABLE), "table rows")
