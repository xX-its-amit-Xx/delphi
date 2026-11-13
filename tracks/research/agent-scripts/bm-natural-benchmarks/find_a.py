"""Findings block A: pine cone (and the Reyssat paper/polymer biomimetic bilayer). Quotes are extracted verbatim by quotes.q."""
from quotes import qs as q, URLS, ERR

F = []
def add(claim, key, quote, conf, value=""):
    F.append(dict(claim=claim, source=URLS[key], confidence=conf, value=value, evidence_quote=quote, _key=key))

# ---------- Reyssat & Mahadevan 2009 (Pinus coulteri, Picea abies) ----------
add("Pine cone cell strain: single-cell ESEM shows the active-tissue cells of Pinus coulteri are about 20 percent longer wet than dry; the strain-humidity fit is eps = 0.0011*phi + 0.0033 (phi = humidity, as printed; unit of phi not stated in the caption).",
    "RM", q("RM", "The line is a linear fit to the data with equation", "ε = 0.0011ϕ + 0.0033."), "medium",
    "eps = 0.0011 phi + 0.0033; cells ~20 percent longer wet; alpha = 0.001 +/- 0.0001")
add("Pine cone cells are about 20 percent longer in the wet state than in a dry environment (Pinus coulteri, ESEM).",
    "RM", q("RM", "The cells are about 20 per cent longer in the wet state", "than in a dry environment (ii)."), "high", "~20 % length")
add("Pine cone hygroscopic expansion coefficient alpha = 0.001 +/- 0.0001 (strain per unit relative humidity) measured on single cells, said to agree with macroscopic data (Harlow 1964). Taken as per percent RH this gives 0.113 strain over 0-100 %RH (my arithmetic, calc.py), about half the '~20 percent' length change quoted for wet versus dry.",
    "RM", q("RM", "α = 0.001 ± 0.0001", "( figure 1 e )"), "medium", "alpha=1e-3 per %RH; 0.0011*100+0.0033=0.113")
add("Pine cone bilayer geometry and modulus ratio used by Reyssat & Mahadevan: passive/active thickness ratio m ~ 1, active-zone length ~10 h_a, and n ~ 5 taken from Dawson et al. 1997 (the Dawson text itself could not be fetched), giving f(m,n) ~ 1.3.",
    "RM", q("RM", "Prior experimental measurements of the moduli of the bilayer tissues ( Dawson et al. 1997 ) suggest that n ≃ 5, so that from equation ( 2.6 ) it follows that f ( m,n ) ≃ 1.3."), "medium", "m~1; n~5; f~1.3; L_a~10 h_a")
add("Reyssat & Mahadevan prediction for a pine scale: curvature change ~1.3 per cm for h ~ 1 mm over zero-to-saturation humidity, angular amplitude ~75 degrees; observed scale of P. coulteri rotates by as much as 100 degrees. Predicted/observed = 0.75 using these two quoted numbers (not a like-for-like error; 100 deg is a maximum for one species).",
    "RM", q("RM", "the expected curvature change of the scale is Δκ ∼ 1.3 cm −1", "relative humidity changing from zero to saturation)"), "medium",
    "d_kappa ~1.3 /cm; theta ~75 deg predicted vs <=100 deg observed")
add("Observed opening angle of a Pinus coulteri scale: up to 100 degrees when humidity of the active tissue drops from saturation to almost zero.",
    "RM", q("RM", "a scale from a cone of Pinus coulteri can rotate by angles as large as 100°"), "high", "<=100 deg")
add("Pine scale response times scale with active-layer thickness, minutes to hours: drying tau = 96 h_a^1.5 min, wetting tau = 29 h_a^1.3 min (h_a in mm); this differs from the Washburn/diffusive h^2/D ~ 1000 s estimate at 1 mm with D ~ 1e-9 m^2/s. At h_a = 1 mm the fits give 96 min dry and 29 min wet (calc.py).",
    "RM", q("RM", "the shrinking (drying) time varies as τ d = 96 h a 1.5 min", "(where h a is in mm)"), "high",
    "tau_dry=96 h^1.5 min; tau_wet=29 h^1.3 min; 1 mm: 96/29 min; h^2/D=16.7 min")
add("Reyssat & Mahadevan: for strips of comparable thickness (m = 1) the curvature coefficient f changes by less than 10 percent when the modulus ratio n varies from 0.3 to 3.5.",
    "RM", q("RM", "for strips of comparable thicknesses ( m = 1), f ( m,n ) changes by less than 10 per cent when n varies from 0.3 to 3.5."), "high", "")
add("Pine cone layer thickness ratio measured by Reyssat & Mahadevan: m = h_p/h_a ~ 1 and active-zone length L_a ~ 10 h_a, roughly invariant across species (their figure 3; values read from text only).",
    "RM", q("RM", "the thickness ratio m = h p / h a ≃ 1, while the length of the active zone L a ≃ 10 h a"), "medium", "m~1; L_a~10 h_a")
# ---------- biomimetic paper/polymer bilayer ----------
add("Reyssat & Mahadevan paper(active)/polymer(passive) strip: h_a = 100 um, h_p = 200 um (m = 2), alpha ~ 4e-4, stiffness ratio n ~ 0.4; theory gives an expected curvature change ~0.19 per mm, called 'comparable' to observation (no error number given). My f(2,0.4) = 1.48 = 98.8 percent of the 3/2 ceiling (calc.py): this engineered strip was already near the optimum.",
    "RM", q("RM", "Knowing α, m and n for these devices yields an expected curvature change of about 0.19 mm −1", "comparable to the experimental observations in figure 4 d"), "medium",
    "m=2; n=0.4; f=1.48 (98.8 % of ceiling); d_kappa~0.19 /mm; agreement 'comparable', unquantified")

# ---------- Eger et al 2022 (Pinus wallichiana / sylvestris) ----------
add("Pine cone tissue moduli by nanoindentation (P. wallichiana): sclereid layer 35 MPa at 50 %RH dropping to 25 MPa at 60 %RH; brown tissue 52 MPa (43 MPa at 70 %RH); sclerenchyma fibre strands fall linearly from 800 MPa (30 %RH) to 200 MPa (75 %RH). Indentation was perpendicular to the scale axis, so these are not longitudinal bending moduli.",
    "EG", q("EG", "The Young's modulus of the sclereid layer (Figure 8 ) was constant", "E SC,60% = 25 MPa."), "high",
    "E_sclereid 35->25 MPa; E_fibre 800->200 MPa; E_brown 52 MPa")
add("Fibre strands: modulus falls linearly on wetting from E(30%) = 800 MPa to E(75%) = 200 MPa.",
    "EG", q("EG", "decreased upon water uptake linearly from E SF,30% = 800 MPa to E SF,75% = 200 MPa"), "high", "800->200 MPa")
add("Pine scale layer thicknesses (P. wallichiana): sclereid (active) layer about 1000 um at the thickest part; sclerenchyma fibre strands (passive) constant at about 500 um. So m = h_passive/h_active ~ 0.5 here, not ~1.",
    "EG", q("EG", "The sclereid layer is about 1000 µm thick at the thickest part."), "high", "h_active~1000 um; h_passive~500 um; m~0.5")
add("Fibre strand thickness ~500 um at the base cross-section, constant through the scale.",
    "EG", q("EG", "thickness of the sclerenchyma fiber strands (gray) is constant and around 500 µm"), "high", "~500 um")
add("Dimensional change on wetting (micro-CT): sclereid layer 27 percent thicker and 22 percent longer in the bending zone; fibre strands 3 percent thinner and ~1 percent longer on the adaxial side. Differential length strain ~ 21 percent (my subtraction).",
    "EG", q("EG", "In the wet state, the sclereid layer was 27% thicker and 22% longer in the bending zone as compared to the dry state."), "high",
    "+22 % vs +1 % length; mismatch ~0.21")
add("Scale angular change: P. sylvestris dry-to-wet (water) 24 degrees; P. wallichiana 80 to 30 %RH 12 degrees. These are two different species and humidity ranges (an earlier agent file blended them into one sentence).",
    "EG", q("EG", "The angular difference of the P. sylvestris scale in the dry and in the wet state is γ water = 24°"), "high", "24 deg (P. sylvestris, water); 12 deg (P. wallichiana, 30-80 %RH)")
add("P. wallichiana: 12-degree angular change from 80 to 30 %RH at 23 C.",
    "EG", q("EG", "the P. wallichiana scale from 80% to 30% rh at 23 °C is γ 80%rh = 12°"), "high", "12 deg")
add("Water uptake of the active (sclereid) tissue at 80 %RH is only ~4.5 wt percent, reaching equilibrium in about 20 min for small pieces. This is the mass-uptake benchmark for an engineered active layer.",
    "EG", q("EG", "The sclereid cells (93 mg, 23 °C, 80% rh) absorbed 4.5 wt%", "reached an equilibrium after about 20 min"), "high", "4.5 wt % at 80 %RH; ~20 min equilibrium")
add("Equilibration of whole scales for angle measurement was 7 h per humidity step.",
    "EG", q("EG", "The scales were allowed to equilibrate for 7 h."), "high", "7 h")
add("Eger et al caution that the bilayer picture holds only in the basal bending zone and is 'rather simplistic regarding the whole scale'.",
    "EG", q("EG", "this widely accepted construction plan is rather simplistic regarding the whole scale"), "high", "")
add("Eger et al treat the structure in the bending zone as a functional bilayer: almost no brown tissue there.",
    "EG", q("EG", "In the bending zone, almost no brown tissue can be found. Here, the structure can be considered as a functional bilayer"), "high", "")

# ---------- Le Duigou & Castro 2016 (Pinus pinaster) ----------
add("Pinus pinaster scales: average maximum thickness 1.3 / 1.5 / 1.1 mm (top / middle / bottom of cone) with swelling-tissue (sclerid) area fraction 65.5 / 69 / 62.5 percent. Implied m = passive/active = 0.53 / 0.45 / 0.60 (my arithmetic).",
    "LD", q("LD", "Average maximum thickness (mm) 1.3 1.5 1.1 Swelling tissue area (sclerids) (%) 65.5 69 62.5"), "high",
    "h=1.3/1.5/1.1 mm; active 65.5/69/62.5 %; m=0.53/0.45/0.60")
add("Blocking force 3.1 +/- 0.5, 3.6 +/- 0.6, 2.2 +/- 0.1 N and blocking moment 80.5, 107.2, 42.0 N mm (top/middle/bottom).",
    "LD", q("LD", "Blocking force (N) 3.1 ± 0.5 3.6 ± 0.6 2.2 ± 0.1 Blocking moment (N.mm) 80.5 ± 9.1 107.2 ± 20 42.0 ± 4.5"), "high",
    "F=3.1/3.6/2.2 N; M=80.5/107.2/42.0 N mm")
add("Agreement with theory (pine cone): bimetallic-strip theory gives 'fairly good agreement' with measured blocking force but overestimates; a 50 percent reduction of dry-state Young's modulus is needed to fit, attributed to plasticisation by water. Direct support for using WET moduli in a bilayer model.",
    "LD", q("LD", "we need to take into account a 50% reduction of Young’s modulus for dry tissue to fit the experimental data with the model"), "high",
    "model over-predicts; fit needs 0.5 x dry E")
add("Le Duigou & Castro abstract: fairly good agreement with bimetallic-strip theory, with overestimation.",
    "LD", q("LD", "A fairly good agreement is obtained when theoretical results based on bimetallic strip systems are compared with experimental data, even if overestimation is observed"), "high", "")
add("If n = 5 (Reyssat/Dawson) holds for P. pinaster, the measured area fractions put the scale at m^2 n = 1.0 to 1.8 and f = 1.47 to 1.50, i.e. 98 to 100 percent of the 3/2 ceiling. This is my hypothesis: Le Duigou & Castro give no n; with Eger's n = 8 to 23 and m = 0.5 the same scale would sit at 82 to 97 percent.",
    "LD", q("LD", "Swelling tissue area (sclerids) (%) 65.5 69 62.5"), "low", "own calc: f=1.49/1.50/1.47 for n=5; Eger n=8..23, m=0.5: f=1.46..1.23")

# ---------- Ulrich 2024 (P. jeffreyi) ----------
add("Durability benchmark: Pinus jeffreyi scales cycled 102 times by submerging and drying kept 97 percent of blocking force and torque and over 94 percent of opening angle (about 0.03 percent force loss per cycle, my arithmetic), despite cracking and delamination.",
    "UL", q("UL", "they were still able to achieve 97% of their undamaged blocking force and torque and over 94% of their undamaged opening angle"), "high",
    "102 cycles; 97 % force/torque; >94 % angle")
add("Ulrich et al frame the work as passive facade shading, i.e. the architectural use case.",
    "UL", q("UL", "current architectural efforts to develop bioinspired passive façade shading systems"), "high", "")
