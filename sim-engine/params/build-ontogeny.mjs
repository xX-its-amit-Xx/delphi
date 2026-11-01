// Builds sim-engine/params/ontogeny.json. Values copied from repo files are read live so they cannot drift.
// usage: node build.mjs <out.json>
import fs from 'node:fs';
import path from 'node:path';
const REPO = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci';
const anat = JSON.parse(fs.readFileSync(path.join(REPO, 'anatomy-model/parametric/stages.json'), 'utf8'));
const r = (x, n = 4) => Number(x.toPrecision(n));

// ---------- sources ----------
const S = {
  'repo-anatomy-stages': { cite: 'DELPHI repo: anatomy-model/parametric/stages.json (stage SL, mass and fin proportions, generated from development/trajectory.mjs and development/zebrafish/trajectory.mjs)', doi_or_url: 'repo:anatomy-model/parametric/stages.json', access: 'read from repo; its primary sources are listed in development/sources.json and development/zebrafish/sources.json' },
  'parichy-2009': { cite: 'Parichy DM, Elizondo MR, Mills MG, Gordon TN, Engeszer RE (2009) Normal table of postembryonic zebrafish development: staging by externally visible anatomy of the living fish. Dev Dyn 238:2975-3015', doi_or_url: 'https://doi.org/10.1002/dvdy.22113', access: 'via repo development/zebrafish/stages.json (full text read by the development thread through PMC OAI, PMC3030279); Europe PMC serves no full text for it, so not re-read here' },
  'beaudouin-2015': { cite: 'Beaudouin R, Goussen B, Piccini B, Augustine S, Devillers J, Brion F, Pery ARR (2015) An individual-based model of zebrafish population dynamics accounting for energy dynamics. PLoS ONE 10:e0125841', doi_or_url: 'https://doi.org/10.1371/journal.pone.0125841', access: 'full text, Europe PMC PMC4418570, fetched 2026-10-31' },
  'rombough-2002': { cite: 'Rombough P (2002) Gills are needed for ionoregulation before they are needed for O2 uptake in developing zebrafish, Danio rerio. J Exp Biol 205:1787-1794', doi_or_url: 'https://doi.org/10.1242/jeb.205.12.1787', access: 'full text PDF, Wayback https://web.archive.org/web/20200320073551/https://jeb.biologists.org/content/jexbio/205/12/1787.full.pdf, fetched 2026-10-31' },
  'rombough-drader-2009': { cite: 'Rombough P, Drader H (2009) Hemoglobin enhances oxygen uptake in larval zebrafish (Danio rerio) but only under conditions of extreme hypoxia. J Exp Biol 212:778-784', doi_or_url: 'https://doi.org/10.1242/jeb.026575', access: 'full text PDF, Wayback https://web.archive.org/web/20190430200148/https://jeb.biologists.org/content/jexbio/212/6/778.full.pdf, fetched 2026-10-31' },
  'pelster-burggren-1996': { cite: 'Pelster B, Burggren WW (1996) Disruption of hemoglobin oxygen transport does not impact oxygen-dependent physiological processes in developing embryos of zebra fish (Danio rerio). Circ Res 79:358-362', doi_or_url: 'https://doi.org/10.1161/01.res.79.2.358', access: 'abstract only (Europe PMC, PMID 8756015), fetched 2026-10-31' },
  'grillitsch-2005': { cite: 'Grillitsch S, Medgyesy N, Schwerte T, Pelster B (2005) The influence of environmental PO2 on hemoglobin oxygen saturation in developing zebrafish Danio rerio. J Exp Biol 208:309-316', doi_or_url: 'https://doi.org/10.1242/jeb.01410', access: 'full text PDF, Wayback https://web.archive.org/web/20180720053612/https://jeb.biologists.org/content/jexbio/208/2/309.full.pdf, fetched 2026-10-31' },
  'bagatto-2001': { cite: 'Bagatto B, Pelster B, Burggren WW (2001) Growth and metabolism of larval zebrafish: effects of swim training. J Exp Biol 204:4335-4343', doi_or_url: 'https://doi.org/10.1242/jeb.204.24.4335', access: 'full text PDF, Wayback https://web.archive.org/web/20191120095228/https://jeb.biologists.org/content/jexbio/204/24/4335.full.pdf, fetched 2026-10-31' },
  'plaut-gordon-1994': { cite: 'Plaut I, Gordon MS (1994) Swimming metabolism of wild-type and cloned zebrafish Brachydanio rerio. J Exp Biol 194:209-223', doi_or_url: 'https://doi.org/10.1242/jeb.194.1.209', access: 'full text PDF, Wayback https://web.archive.org/web/20200318101652/https://jeb.biologists.org/content/jexbio/194/1/209.full.pdf, fetched 2026-10-31' },
  'plaut-2000': { cite: 'Plaut I (2000) Effects of fin size on swimming performance, swimming behaviour and routine activity of zebrafish Danio rerio. J Exp Biol 203:813-820', doi_or_url: 'https://doi.org/10.1242/jeb.203.4.813', access: 'full text PDF, Wayback https://web.archive.org/web/20200319005255/https://jeb.biologists.org/content/jexbio/203/4/813.full.pdf, fetched 2026-10-31' },
  'wakamatsu-2019': { cite: 'Wakamatsu Y, Ogino K, Hirata H (2019) Swimming capability of zebrafish is governed by water temperature, caudal fin length and genetic background. Sci Rep 9:16307', doi_or_url: 'https://doi.org/10.1038/s41598-019-52592-w', access: 'full text, Europe PMC PMC6841939, fetched 2026-10-31' },
  'fiaz-2012': { cite: 'Fiaz AW, Leon-Kloosterziel KM, Gort G, Schulte-Merker S, van Leeuwen JL, Kranenbarg S (2012) Swim-training changes the spatio-temporal dynamics of skeletogenesis in zebrafish larvae (Danio rerio). PLoS ONE 7:e34072', doi_or_url: 'https://doi.org/10.1371/journal.pone.0034072', access: 'full text, Europe PMC PMC3329525, fetched 2026-10-31' },
  'lindsey-2010': { cite: 'Lindsey BW, Smith FM, Croll RP (2010) From inflation to flotation: contribution of the swimbladder to whole-body density and swimming depth during development of the zebrafish (Danio rerio). Zebrafish 7:85-96', doi_or_url: 'https://doi.org/10.1089/zeb.2009.0616', access: 'abstract only (Europe PMC, PMID 20415646), fetched 2026-10-31' },
  'robertson-2008': { cite: 'Robertson GN, Lindsey BW, Dumbarton TC, Croll RP, Smith FM (2008) The contribution of the swimbladder to buoyancy in the adult zebrafish (Danio rerio): a morphometric analysis. J Morphol 269:666-673', doi_or_url: 'https://doi.org/10.1002/jmor.10610', access: 'abstract only (Europe PMC, PMID 18302241), fetched 2026-10-31' },
  'bigman-2021-data': { cite: 'Bigman JS et al. (2021) Sci Adv 7:eabe5163; dataset PairedRSAData.csv (figshare 10.6084/m9.figshare.13821968)', doi_or_url: 'https://ndownloader.figshare.com/files/26660168', access: 'dataset fetched 2026-10-31; no Danio and no Exocoetidae rows' },
  'park-choi-2010': { cite: 'Park H, Choi H (2010) Aerodynamic characteristics of flying fish in gliding flight. J Exp Biol 213:3269-3279', doi_or_url: 'https://doi.org/10.1242/jeb.046052', access: 'via repo physics/glide-data.csv (full text read by the physics thread); DOI re-verified in Europe PMC 2026-10-31' },
  'davenport-1992': { cite: 'Davenport J (1992) Wing-loading, stability and morphometric relationships in flying fish (Exocoetidae) from the north-eastern Atlantic. J Mar Biol Assoc UK 72:25-39', doi_or_url: 'https://doi.org/10.1017/S0025315400048761', access: 'abstract only, via repo physics/allometry.json; DOI re-verified on Crossref 2026-10-31' },
  'daane-2021': { cite: 'Daane JM et al. (2021) flying-fish fin measurements, Data S1A (MCZ museum specimens), as fitted in development/allometry.json', doi_or_url: 'repo:development/allometry.json (raw: genotype/cache/daane2021_data_s1A_fin_measurements.csv)', access: 'read from repo' },
  'hunte-1995': { cite: 'Hunte et al. (1995) flyingfish larvae in neuston tows, as quoted in development/allometry.json pelvic_fin_length.fetched_corroboration', doi_or_url: 'repo:development/allometry.json', access: 'read from repo (fetched by the development thread)' },
  'repo-physiology': { cite: 'DELPHI repo: physiology/ (gills.json, haemoglobin.js, muscle.js, sources.json): adult flying-fish physiology built from non-flying-fish proxies (rummer2015 trout Hb, doi 10.1371/journal.pone.0139477; gerry2014 trout slow-fibre fraction, doi 10.1371/journal.pone.0106030; Bigman 2021 mackerel gill area)', doi_or_url: 'repo:physiology/', access: 'read from repo; rummer2015 and gerry2014 DOIs re-verified in Europe PMC 2026-10-31' },
};

// ---------- helpers ----------
const V = (value, unit, kind, src, locator, note, extra = {}) => {
  if (!S[src]) throw new Error('unknown source ' + src);
  return { value, unit, kind, source: { id: src, cite: S[src].cite, doi_or_url: S[src].doi_or_url, locator }, ...(note ? { note } : {}), ...extra };
};
const N = (unit, reason, extra = {}) => ({ value: null, unit, kind: null, source: null, reason, ...extra });

const SEARCH_ZF_GILL = 'not found. Europe PMC: ABSTRACT:"gill surface area" AND zebrafish (2 hits, neither zebrafish morphometry); TITLE zebrafish AND gill AND (develop* OR morpholog*) (5 hits, none with area); Bigman 2021 dataset has no Danio row. Preussner et al. 2025 bioRxiv 10.1101/2025.06.02.657338 (lifelong zebrafish gill development) may hold it but its full text was not reachable (bioRxiv error 1015; Europe PMC abstract only)';
const SEARCH_MUSCLE = 'not found. Europe PMC: zebrafish AND ("red muscle" OR "slow muscle") AND (proportion OR percent) AND myotome, open access (51 hits, none gives a fraction); no flying-fish fibre-type data found';
const SEARCH_HB_ZF = 'not found. Rombough & Drader 2009 (Discussion): "The O2 binding affinity of the Hb of zebrafish larvae has not been determined"; Europe PMC TITLE zebrafish AND (hemoglobin OR haemoglobin OR "oxygen affinity" OR "oxygen binding"): 10 hits, none reports a P50 for any stage';
const SEARCH_FF_PHYS = 'not found. Europe PMC: all 71 records with flying fish / flyingfish / Exocoetidae / Cheilopogon / Cypselurus / Hirundichthys / Exocoetus / Parexocoetus in the title, plus (flying fish OR Exocoetidae) AND (swim bladder OR metabolic rate OR oxygen consumption OR gill area OR red muscle): no physiological measurement on any life stage';

// ---------- ZEBRAFISH ----------
const zfLabels = { 0: 'hatching (Hatching:Long-pec)', 3: 'larva (Larval:Day 5)', 10: 'larva (Larval:Days 7-13; fin rays forming)', 25: 'juvenile onset (Parichy stage J, ~11 mm SL)', 60: 'juvenile', 180: 'adult' };
const rombMS = (M_mg) => 46.1 * Math.pow(M_mg, -0.175); // nmol mg-1 h-1 == umol g-1 h-1
const zf = anat['zebrafish-adult'].stages.map((s) => {
  const d = s.age_days, dpf = d + 2, SL = s.SL_m, M = s.mass_kg, Mmg = M * 1e6, P = s.parameters;
  const f = {};
  f.SL_m = V(SL, 'm', d === 0 ? 'measured-secondhand' : d <= 25 ? 'derived' : 'derived', 'repo-anatomy-stages', `zebrafish-adult.stages[${s.key}].SL_m`,
    d === 0 ? 'hatch length 3.1 mm (FishBase larvae page, Main Ref Kimmel et al. 1995), via development/zebrafish/growth.json'
      : d <= 25 ? 'SL = 3.4 + 0.32 (dpf - 2.5) mm: Parichy 2009 measured larval rate 0.32 mm SL/d (individually reared, 28.5 C); linear form assumed'
        : 'von Bertalanffy Linf 45.1 mm SL, K 3.97/yr (FishBase autoctr 4255, lab, unlimited food), t0 set for continuity at stage J');
  f.mass_kg = V(M, 'kg', 'derived', 'repo-anatomy-stages', `zebrafish-adult.stages[${s.key}].mass_kg`,
    `W_mg = exp(-5.24) SL_mm^3.22 (Beaudouin 2015, fitted on 60 fish 10-50 dpf up to ~15 mm SL)${SL > 0.015 ? '; EXTRAPOLATED above the fitted size' : ''}${SL < 0.009 ? '; measured live larval masses are 25-50% lower at the same length (conflicts.zf_mass_larval): treat as an upper bound' : ''}`);
  if (d === 0) f.body_density_kg_m3 = V(1050, 'kg/m3', 'borrowed', 'robertson-2008', 'abstract: "Mean body density in the absence of the swimbladder was 1.05 +/- 0.04 g cm(-3)" (adults)', 'swim bladder not yet inflated at hatching, so adult bladder-free tissue density is borrowed. Lindsey 2010 (abstract) says inflation is what first lowers larval density but gives no pre-inflation number.', { range: [1010, 1090] });
  else if (d <= 10) f.body_density_kg_m3 = V([996, 1000], 'kg/m3', 'measured', 'lindsey-2010', 'abstract: density "conserved within a narrow range between 1.00 +/- 0.001 and 0.996 +/- 0.001 g/cm(3)"; swim bladder keeps fish "within 1.7% of neutral buoyancy throughout larval development"', 'post-inflation larvae; the abstract does not assign each end of the range to an age');
  else if (d === 25) f.body_density_kg_m3 = V([996, 1000], 'kg/m3', 'borrowed', 'lindsey-2010', 'abstract (larval range; see the 3 d and 10 d rows)', 'larval range carried to juvenile onset');
  else if (d === 60) f.body_density_kg_m3 = V(1010, 'kg/m3', 'borrowed', 'robertson-2008', 'abstract: "mean whole-body density was 1.01 +/- 0.09 g cm(-3)" (fish 0.16-0.73 g)', 'stage mass 0.11 g is just below the measured adult mass range');
  else f.body_density_kg_m3 = V(1010, 'kg/m3', 'measured', 'robertson-2008', 'abstract: "mean whole-body density was 1.01 +/- 0.09 g cm(-3)" over 0.16-0.73 g', 'SD is large (0.09 g/cm3); swim bladder 5.1 +/- 1.4% of body volume');
  f.wetted_area_m2 = N('m2', 'not found: no measured skin or total surface area for any zebrafish stage in fetched sources (Rombough 2002 gives none; Grillitsch 2005 says only qualitatively that total surface area falls as the yolk sac is absorbed). If computed from geometry, label it derived.', { see: ['rombough-2002', 'grillitsch-2005'] });
  if (d === 180) f.frontal_area_m2 = V(r(Math.PI / 4 * 9.3e-3 * 5.2e-3), 'm2', 'derived', 'plaut-2000', 'Table 1, wild-type (N = 21): maximum body height 9.3 +/- 1.2 mm, maximum body width 5.2 +/- 1.0 mm (SL 36.0 mm, mass 0.90 g)', 'pi/4 x height x width (elliptical cross-section assumed)');
  else f.frontal_area_m2 = N('m2', d === 60 ? 'not found at this size; nearest measured depth+width pair is Rombough & Drader 2009 at 40-42 dpf (anchors)' : 'not found: body width not measured at this stage in fetched sources (Parichy 2009 Table 3 gives depth only)');
  f.pectoral_area_both_m2 = V(r(P.pectoral_area_over_SL2 * SL * SL), 'm2', 'assumed', 'repo-anatomy-stages', `zebrafish-adult.stages[${s.key}].parameters.pectoral_area_over_SL2 = ${r(P.pectoral_area_over_SL2)}`, 'the anatomy model ASSUMES zebrafish pectoral proportions: no numeric pectoral fin length or area was found (development/zebrafish/allometry.json: Daane 2018 plots it only in Fig. 1A)');
  f.pectoral_span_m = V(r(P.pectoral_span_over_SL * SL), 'm', 'assumed', 'repo-anatomy-stages', `zebrafish-adult.stages[${s.key}].parameters.pectoral_span_over_SL = ${r(P.pectoral_span_over_SL)}`, 'assumed in the anatomy model, as above');
  if (d === 180) f.caudal_area_m2 = V(r(8.3e-3 * 8.3e-3 / 2.05), 'm2', 'derived', 'plaut-2000', 'Table 1 wild-type: caudal fin height 8.3 +/- 1.9 mm, aspect ratio 2.05 +/- 0.5 (aspect ratio = span^2 / area); the measured mean area itself is not printed', 'area = height^2 / aspect ratio from the group means (a ratio of means, not the mean area)');
  else f.caudal_area_m2 = N('m2', 'not found for larvae or juveniles; caudal fin rays appear at 4.9 mm SSL (Parichy 2009 Table 4, repo)');
  f.red_muscle_fraction = d === 180 ? V(0.05, 'fraction of myotomal muscle mass', 'borrowed', 'repo-physiology', 'physiology/muscle.js MUSCLE_PARAMS.red.fraction_of_myotome (gerry2014 Discussion, rainbow trout, secondhand)', 'rainbow trout superficial slow muscle about 5% of the myotome; NOT a zebrafish measurement') : N('fraction of myotomal muscle mass', SEARCH_MUSCLE);
  f.white_muscle_fraction = N('fraction of myotomal muscle mass', SEARCH_MUSCLE + '. 1 - red is not used: trout also has ~5% mosaic slow-like fibres inside the white zone (gerry2014)');
  f.gill_area_m2 = N('m2', SEARCH_ZF_GILL, { see: ['bigman-2021-data'] });
  f.o2_uptake_site = d === 0 ? V('skin', 'category', 'borrowed', 'rombough-2002', 'Abstract: at 3 dpf neither hyperoxia nor 50% saline changed survival of gill-blocked larvae, "suggesting that at this stage cutaneous exchange was sufficient to satisfy both ionoregulatory and respiratory requirements"', '2 dpf hatchling given the 3 dpf result (earliest age tested)')
    : d === 3 ? V('skin', 'category', 'measured', 'rombough-2002', 'Abstract: at 7 dpf "the skin still appeared capable of satisfying the O2 requirements"; same at 3 dpf; 28 C', '5 dpf lies between the 3 and 7 dpf tests, both skin-sufficient for O2')
      : d === 10 ? V('skin-to-gill transition', 'category', 'derived', 'rombough-2002', 'Abstract: skin sufficient for O2 at 7 dpf; "At 14 days postfertilization ... gills were required for O2 uptake as well as for ionoregulation"', '12 dpf is bracketed by the 7 and 14 dpf tests')
        : d === 25 ? V('gills', 'category', 'measured', 'rombough-2002', 'Abstract: at 21 dpf "larvae apparently are so dependent on gills for O2 uptake that they suffocate before the effects of ionoregulatory impairment become apparent"; Discussion: median survival with gills blocked 1.9 h', '21 dpf result applied at 27 dpf')
          : V('gills', 'category', 'borrowed', 'rombough-2002', 'Abstract (21 dpf result)', 'oldest tested age is 21 dpf; carried forward');
  f.hb_needed_for_routine_O2 = d === 0 ? V(false, 'boolean', 'measured', 'pelster-burggren-1996', 'abstract: "Functional ablation of hemoglobin by carbon monoxide or phenylhydrazine did not reduce whole-animal O2 consumption" (36-96 hpf)', null)
    : d <= 25 ? V(false, 'boolean', 'measured', 'rombough-drader-2009', 'Abstract: "CO poisoning had no significant impact on rMO2 or Pc at any age" (5-42 dpf, 28 C); Hb only lowers residual PO2 (Pr 6.7 vs 11.2 torr)', 'matters for hypoxia/altitude perturbations: up to ~6 weeks, normoxic and moderately hypoxic O2 supply does not depend on Hb')
      : N('boolean', 'not tested beyond 42 dpf; no zebrafish source in hand states adult Hb dependence');
  f.hb_P50_kPa = N('kPa', SEARCH_HB_ZF);
  f.has_swimbladder = d === 0 ? V(false, 'boolean', 'measured', 'parichy-2009', 'Table 4 via repo development/zebrafish/stages.json: posterior swim bladder (pSB) inflation at SSL 3.5 mm (pre 3.4, post 3.7 mm); hatch SL 3.1 mm', 'Rombough & Drader 2009 Methods: "Swimbladder inflation occurred at about 5 dpf" at 28 C', { chambers: 0 })
    : V(true, 'boolean', 'measured', 'parichy-2009', d === 3 ? 'Table 4 (repo): pSB inflation SSL 3.5 mm; stage SL 4.2 mm' : 'Table 4 (repo): pSB at SSL 3.5 mm, anterior chamber (aSB) appears at SSL 6.0 mm', d === 3 ? 'marginal: at 5 dpf some larvae are not yet inflated (inflation "at about 5 dpf", Rombough & Drader 2009). Posterior chamber only until 6.0 mm SL.' : 'two chambers', { chambers: d === 3 ? 1 : 2 });
  if (d === 0) f.routine_metabolic_rate = V([85, 90], 'umol O2 g-1 h-1', 'measured', 'pelster-burggren-1996', 'abstract: whole-animal O2 consumption "was approximately 85 to 90 mumol.g-1.h-1" (embryos and early larvae, 36-96 hpf)', 'abstract only: temperature and mass basis (yolk included or not) not stated there');
  else if (d <= 25) f.routine_metabolic_rate = V(r(rombMS(Mmg), 3), 'umol O2 g-1 h-1', 'derived', 'rombough-drader-2009', 'Eq. 1: rMO2 (nmol O2 h-1) = 46.1 M^0.825, M in mg, R2 0.909, N 109, 5-42 dpf, 28 C (Fig. 3)', `evaluated at the stage mass ${r(Mmg, 3)} mg as rMO2/M = 46.1 M^-0.175. MASS BASIS: Rombough weighed Bouin-fixed larvae (mean 160 ug at 7 dpf, 3.5 mg at 40-42 dpf), lighter than the live-mass law used for mass_kg. If fixed mass = f x live mass, the true rate per live gram is f^0.825 x this value (0.47 for f = 0.4): treat as an upper bound.${Mmg > 3.5 ? ' Stage mass is ABOVE the fitted 0.16-3.5 mg (extrapolated), although the age (27 dpf) is inside the fitted ages.' : ''}`);
  else if (d === 60) f.routine_metabolic_rate = N('umol O2 g-1 h-1', 'not found: no measurement between 42 dpf (Rombough & Drader 2009, <= 3.5 mg) and adults (Plaut & Gordon 1994, 0.27-1.44 g). The larval law extrapolated to 111 mg gives 20 umol/g/h, below the adult range, so neither end can be carried (conflicts.zf_metabolic_scaling)');
  else f.routine_metabolic_rate = V([26.8, 68.7], 'umol O2 g-1 h-1', 'measured', 'plaut-gordon-1994', 'Summary: "Standard metabolic rates were 0.60-1.54 ... ml O2 g-1 h-1" for WT at 28 C (mean mass 0.84 g); Discussion: "we assume that the SMR and RMR of zebrafish are virtually equal"', 'converted at 44.62 umol per ml O2 (STPD assumed). Lucas & Priede 1992, quoted in Plaut & Gordon 1994: 0.39 ml g-1 h-1 = 17.4 umol g-1 h-1 at 24 C (groups of six)');
  f.standard_metabolic_rate = d === 180 ? V([26.8, 68.7], 'umol O2 g-1 h-1', 'measured', 'plaut-gordon-1994', 'Summary: SMR 0.60-1.54 ml O2 g-1 h-1, WT, 28 C (range over groups)', 'converted at 44.62 umol/ml (STPD assumed)') : N('umol O2 g-1 h-1', 'not found: only routine rates are measured in larvae (Rombough & Drader 2009; Pelster & Burggren 1996)');
  f.Ucrit_m_s = d === 180 ? V(0.560, 'm/s', 'measured', 'plaut-2000', 'Summary: wild-type Ucrit "56.0 +/- 4.8 cm s-1 or 15.5 SL s-1 (mean +/- S.D., N=21)"; 28 C, Brett-type tunnel, 4 cm/s steps every 5 min; adults 6-10 months, SL 31.8-39.7 mm', 'Ucrit did not depend on SL within adults (Fig. 3; r2 0.03, P 0.51). Conflicting adult values: conflicts.zf_ucrit', { alternatives: [{ value: 0.437, unit: 'm/s', note: 'long-finned', source: { id: 'plaut-2000', locator: 'Summary: 43.7 +/- 6.8 cm s-1, N=17' } }, { value: 0.238, unit: 'm/s', note: 'pet-store long-fin, 28 C, 1 cm/s per min steps; 22.3 (female) and 23.8 (male) cm/s', source: { id: 'wakamatsu-2019', locator: 'Results: 28 C: 23.8 +/- 0.7 cm/s, n = 10' } }] })
    : N('m/s', d <= 10 ? 'not usable: larval Ucrit (5-14 dpf) exists only as a plot (Fiaz 2012 Fig. 6B), and the authors state it "is an overestimation of the maximum sustained swimming speed" because larvae cling to the tube wall; not digitised' : 'not found: no juvenile control Ucrit vs size (Europe PMC: zebrafish AND (larva* OR juvenile*) AND Ucrit, open access: 77 hits, toxicology-dominated)', d <= 10 ? { see: ['fiaz-2012'] } : {});
  return { key: s.key, age_days: d, dpf, label: zfLabels[d], fields: f };
});

// ---------- FLYING FISH ----------
const ffLabels = { 0: 'hatching', 3: 'yolk-sac larva', 10: 'larva', 30: 'juvenile', 90: 'juvenile', 365: 'adult' };
const ff = anat['flying-fish'].stages.map((s) => {
  const d = s.age_days, SL = s.SL_m, M = s.mass_kg, P = s.parameters, early = d <= 10;
  const f = {};
  f.SL_m = V(SL, 'm', early ? 'assumed' : 'derived', 'repo-anatomy-stages', `flying-fish.stages[${s.key}].SL_m`, early ? 'ASSUMED linear ramp from an assumed 4 mm hatch length (no flying-fish hatch length found: development/growth.json early_life.hatch_size)' : 'von Bertalanffy FL = 23.3 (1 - exp(-3.12 (t - 0.01))) cm, H. affinis, Barbados (Oxenford 1994 via FishBase; flagged questionable there) x SL/FL 0.927 (FishBase, unverified)');
  f.mass_kg = V(M, 'kg', early ? 'assumed' : 'derived', 'repo-anatomy-stages', `flying-fish.stages[${s.key}].mass_kg`, `W_g = 0.0116 FL_cm^3.01 (H. affinis, Barbados, FishBase, reference unverified)${early ? '; input SL is assumed and the adult length-weight law is applied far below its range' : ''}. Davenport 1992 (E. obtusirostris) gives b = 2.981.`);
  f.body_density_kg_m3 = N('kg/m3', SEARCH_FF_PHYS);
  f.wetted_area_m2 = N('m2', 'not found: no flying-fish body surface area; Park & Choi 2010 give body planform area (A3), not wetted area (body_planform_area_m2 at the adult row)');
  f.frontal_area_m2 = N('m2', 'not found: no body depth x width for flying fish at any stage (development/stages.json calls body-depth ontogeny the largest gap)');
  const spanV = r(P.pectoral_span_over_SL * SL), areaV = r(P.pectoral_area_over_SL2 * SL * SL);
  if (d === 365) {
    f.pectoral_area_both_m2 = V(0.006377, 'm2', 'measured', 'park-choi-2010', 'Table 1 model L3 via repo physics/glide-data.csv: pectoral fin area A1 = 0.006377 m2 (both fins), Cypselurus hiraii, SL 0.203 m, 0.06 kg', `different genus and lighter (0.06 kg) than the H. affinis growth-curve adult (SL ${SL} m, ${M} kg); the anatomy model gives ${areaV} m2 at this SL by scaling this specimen`, { species: 'Cypselurus hiraii' });
    f.pectoral_span_m = V(0.261, 'm', 'measured', 'park-choi-2010', 'Table 1 model L3 (repo physics/glide-data.csv): pectoral_fin_span_m 0.261', 'tip-to-tip span of both fins on a stuffed specimen (dihedral set during stuffing)', { species: 'Cypselurus hiraii' });
  } else {
    const k = early ? 'assumed' : 'derived';
    const why = early ? 'ASSUMED: fin-length ratio ramps linearly from an assumed 0.10 SL at hatching to the Daane 2021 fit at 1.68 cm SL; no flying-fish fin data below 1.68 cm SL' : 'fin length from the Daane 2021 pooled fit (measured, 1.68-24 cm SL); span carried linearly and area as length^1.834 (Davenport 1992 exponent, abstract) from the Park & Choi adult: an assumed transfer, not measured at this size';
    f.pectoral_area_both_m2 = V(areaV, 'm2', k, 'repo-anatomy-stages', `flying-fish.stages[${s.key}].parameters.pectoral_area_over_SL2 = ${r(P.pectoral_area_over_SL2)}`, why);
    f.pectoral_span_m = V(spanV, 'm', k, 'repo-anatomy-stages', `flying-fish.stages[${s.key}].parameters.pectoral_span_over_SL = ${r(P.pectoral_span_over_SL)}`, why);
  }
  if (early) f.pelvic_len_over_SL = V(P.pelvic_len_over_SL, 'fraction of SL', 'derived', 'hunte-1995', 'H. affinis larvae: "greatly enlarged, translucent pectoral and pelvic fins of approximately equal size" (p. 26)', 'set equal to the (assumed) pectoral ratio of this stage');
  else f.pelvic_len_over_SL = V(SL < 0.05 ? 0.374 : 0.297, 'fraction of SL', 'measured', 'daane-2021', SL < 0.05 ? 'development/allometry.json pelvic_fin_length: Hirundichthys rondeleti mean pelvic/SL below 5 cm SL (n = 7)' : 'development/allometry.json pelvic_fin_length: Hirundichthys rondeleti mean pelvic/SL at >= 10 cm SL (n = 6)', 'four-winger congener of H. affinis; the anatomy model uses a schematic 0.22 here instead', { species: 'Hirundichthys rondeleti' });
  if (d === 365) f.body_planform_area_m2 = V(0.004474, 'm2', 'measured', 'park-choi-2010', 'Table 1 model L3 (repo physics/glide-data.csv): body_planform_area_m2 (A3)', null, { species: 'Cypselurus hiraii' });
  f.caudal_area_m2 = N('m2', 'not found: no flying-fish caudal fin area at any size (Daane 2021 Data S1A has pectoral and pelvic lengths only)');
  f.red_muscle_fraction = d === 365 ? V(0.05, 'fraction of myotomal muscle mass', 'borrowed', 'repo-physiology', 'physiology/muscle.js MUSCLE_PARAMS.red.fraction_of_myotome (gerry2014, rainbow trout, secondhand)', 'trout value; a burst-launching flying fish may differ in either direction') : N('fraction of myotomal muscle mass', SEARCH_MUSCLE);
  f.white_muscle_fraction = N('fraction of myotomal muscle mass', SEARCH_MUSCLE);
  f.gill_area_m2 = d === 365 ? V(r(1158e-6 * M * 1000), 'm2', 'borrowed', 'repo-physiology', 'physiology/gills.json gill_area_per_body_mass: Scomber scombrus 1158 mm2/g (Gray 1954 via Bigman 2021) x stage mass', 'Atlantic mackerel area per gram applied to the 0.13 kg adult; Bigman 2021 has no Exocoetidae row') : N('m2', 'not found at any size; the adult mackerel proxy is not carried down because gill area scales below isometry and small larvae rely on skin first (zebrafish: Rombough 2002)');
  f.hb_P50_kPa = d === 365 ? V(r(24.8 * 0.133322), 'kPa', 'borrowed', 'repo-physiology', 'physiology/sources.json rummer2015 Table 1: rainbow trout P50 24.8 mmHg', 'trout, at the source temperature, not 25 C') : N('kPa', SEARCH_FF_PHYS);
  f.has_swimbladder = N('boolean', SEARCH_FF_PHYS + '. The anatomy model draws a swim bladder (shrink.swim_bladder) without a source.');
  f.routine_metabolic_rate = N('umol O2 g-1 h-1', SEARCH_FF_PHYS);
  f.standard_metabolic_rate = N('umol O2 g-1 h-1', SEARCH_FF_PHYS);
  f.Ucrit_m_s = N('m/s', SEARCH_FF_PHYS + '; development/stages.json first_gliding: no juvenile glide or swim speed found');
  return { key: s.key, age_days: d, label: ffLabels[d], fields: f };
});

const src = (id, locator) => ({ id, cite: S[id].cite, doi_or_url: S[id].doi_or_url, locator });
const out = {
  title: 'Ontogeny of simulation state fields for zebrafish (Danio rerio) and flying fish (Exocoetidae), per developmental stage',
  built: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  builder: 'session scratch builder (not in repo); SL, mass and fin ratios are read live from anatomy-model/parametric/stages.json so they match the anatomy model exactly',
  consumer: 'sim-engine/lib/state.mjs resolveState(organismDoc, ageDays). Interpolation rule: ONTOGENY.md, section "Interpolation rule".',
  age_axis: 'age_days = days after hatching (the stage keys of anatomy-model/parametric/stages.json). Zebrafish hatch at 2 dpf, so dpf = age_days + 2. Flying-fish incubation is assumed (development/stages.json).',
  kinds: { measured: 'read in the cited primary source', 'measured-secondhand': 'quoted inside another source', borrowed: 'measured, but in another species, stage or condition (named in note)', derived: 'computed from sourced inputs by the rule in note', calibrated: 'tuned to reproduce a named sourced value', assumed: 'no source for the number; reason in note' },
  null_rule: 'value null = not found (reason says what was searched). Never fill a null by interpolating across it.',
  value_forms: 'number | [lo, hi] (a reported range) | boolean | category string',
  temperature: 'zebrafish physiology sources are all 28-28.5 C; project baseline is 25 C and nothing here is temperature-corrected (conditions/baseline.json). Flying-fish growth embeds field temperatures (~27.8 C).',
  no_bird_data: 'No Aves data anywhere in this file (holdout).',
  units_note: 'metabolic rates in umol O2 g-1 h-1 (per g wet mass); 1 umol O2 g-1 h-1 = 0.1204 W/kg using 13.54 J/mg O2 (oxycaloric value in physiology/sources.json, gerry2014, secondhand)',
  sources: S,
  species: {
    zebrafish: {
      taxon: 'Danio rerio', ncbi_taxid: 7955,
      growth_reference: 'development/zebrafish/growth.json and allometry.json (SL and mass laws live there; not duplicated)',
      size_thresholds_SL_m: [
        { event: 'posterior swim bladder inflation', SL_m: 0.0035, source: src('parichy-2009', 'Table 4 pSB, SSL 3.5 mm (repo)') },
        { event: 'anterior swim bladder chamber appears', SL_m: 0.0060, source: src('parichy-2009', 'Table 4 aSB, SSL 6.0 mm (repo)') },
        { event: 'first pectoral lepidotrichia', SL_m: 0.0064, source: { id: 'repo', cite: 'Lalonde & Akimenko 2018 Fig. 8, via development/zebrafish/stages.json', doi_or_url: 'https://doi.org/10.1371/journal.pone.0192500', locator: 'Fig. 8 legend (repo)' } },
        { event: 'juvenile (squamation complete, stage J)', SL_m: 0.0110, source: src('parichy-2009', 'Table 4 J, SSL 11.0 mm (repo)') },
      ],
      age_thresholds_dpf: [
        { event: 'gills required for O2 uptake (skin insufficient)', dpf: [7, 14], source: src('rombough-2002', 'Abstract') },
        { event: 'gills required for ionoregulation', dpf: [3, 7], source: src('rombough-2002', 'Abstract') },
      ],
      stages: zf,
      allometries: [
        { y: 'routine O2 uptake rMO2', unit_y: 'nmol O2 h-1 per fish', x: 'body mass M', unit_x: 'mg (Bouin-fixed wet mass)', a: 46.1, b: 0.825, r2: 0.909, n: 109, valid: { age_dpf: [5, 42], mass_mg: [0.16, 3.5], temperature_C: 28 }, kind: 'measured', source: src('rombough-drader-2009', 'Eq. 1 and Fig. 3'), note: 'control and CO-treated larvae pooled (slopes not different)' },
        { y: 'wet mass W', unit_y: 'mg', x: 'SL', unit_x: 'mm', a: 0.0053, b: 3.22, b_ci95: [2.97, 3.46], valid: { age_dpf: [10, 50], SL_mm: [3.1, 15] }, kind: 'measured', source: src('beaudouin-2015', 'Results, Juvenile allometry: slope 3.22 (2.97; 3.46), intercept -5.24 (-5.83; -4.65)'), note: 'already the repo law (development/zebrafish/allometry.json); natural log by inference (the paper does not state the base); lower SL bound given by the authors as "the hatching length"' },
      ],
      anchors: [
        { dpf: 7, mass_mg: 0.16, rMO2_nmol_h: 9, mass_basis: 'Bouin-fixed', source: src('rombough-drader-2009', 'Results') },
        { dpf: [40, 42], mass_mg: 3.5, TL_mm: 14.1, depth_mm: 1.4, width_mm: 1.0, rMO2_nmol_h: 125, mass_basis: 'Bouin-fixed', source: src('rombough-drader-2009', 'Results') },
        { dpf: '~4-6 (yolk-sac group, training days 1-2)', mass_mg: [0.331, 0.338], length_mm: [3.9, 4.0], mass_basis: 'live wet; length type not stated', source: src('bagatto-2001', 'Table 1, control') },
        { dpf: '~11-15 (swim-up group)', mass_mg: [0.397, 0.488], length_mm: [4.2, 4.6], mass_basis: 'live wet', source: src('bagatto-2001', 'Table 1, control') },
        { dpf: '~26-32 (free-swimming group)', mass_mg: [1.38, 3.69], length_mm: [6.4, 8.2], mass_basis: 'live wet', source: src('bagatto-2001', 'Table 1, control') },
        { stage: 'adult, 6-10 months', SL_mm: 36.0, mass_g: 0.90, body_height_mm: 9.3, body_width_mm: 5.2, caudal_height_mm: 8.3, caudal_aspect_ratio: 2.05, source: src('plaut-2000', 'Table 1, wild-type') },
        { stage: 'adult (pet-store WT)', SL_mm: 33.9, mass_g: 0.84, source: src('plaut-gordon-1994', 'Materials and methods') },
      ],
    },
    flying_fish: {
      taxon: 'Exocoetidae (growth: Hirundichthys affinis; fins: Daane 2021 species and Cypselurus hiraii)', ncbi_taxid: null,
      growth_reference: 'development/growth.json, development/allometry.json, development/stages.json (not duplicated)',
      size_thresholds_SL_m: [
        { event: 'smallest measured flying-fish fin specimen (below this, fin values are assumed)', SL_m: 0.0168, source: src('daane-2021', 'smallest row, H. rondeleti') },
      ],
      stages: ff,
      allometries: [
        { y: 'pectoral fin length', unit_y: 'cm', x: 'SL', unit_x: 'cm', a: r(Math.pow(10, -0.2241)), b: 1.0579, se_b: 0.02, valid: { SL_cm: [1.68, 24] }, kind: 'measured', source: src('daane-2021', 'development/allometry.json pectoral_fin_length.fit_power_law_pooled (n = 49, 3 species)') },
        { y: 'lateral fin area', unit_y: 'relative', x: 'SL', unit_x: 'any', a: null, b: 1.834, valid: { species: 'Exocoetus obtusirostris', SL: 'range not in the abstract' }, kind: 'measured', source: src('davenport-1992', 'abstract (via physics/allometry.json)'), note: 'exponent only; intercept not in the abstract' },
        { y: 'body mass', unit_y: 'relative', x: 'SL', unit_x: 'any', a: null, b: 2.981, valid: { species: 'Exocoetus obtusirostris' }, kind: 'measured', source: src('davenport-1992', 'abstract') },
        { y: 'wing loading', unit_y: 'relative', x: 'SL', unit_x: 'any', a: null, b: 1.236, valid: { species: 'Exocoetus obtusirostris' }, kind: 'measured', source: src('davenport-1992', 'abstract'), note: '2.981 - 1.834 = 1.147, not 1.236; unresolved without the full text (development/allometry.json)' },
      ],
    },
  },
  conflicts: {
    zf_mass_larval: 'Live larval masses (Bagatto 2001 Table 1: 0.33 mg at 3.9-4.0 mm, 1.38 mg at 6.4 mm, 3.69 mg at 8.2 mm) are 25-50% BELOW the Beaudouin 2015 law used for mass_kg (0.44, 2.1, 4.6 mg at those lengths, if Bagatto length is SL). Bouin-fixed masses (Rombough & Drader 2009: 0.16 mg at 7 dpf; 3.5 mg at 14.1 mm TL) are lower still, about 4-5x below the law at an assumed ~12 mm SL. Larval mass_kg is an upper bound.',
    zf_growth_rate: 'Size at age depends on rearing: Bagatto 2001 larvae were 6.4 mm at ~26 dpf, while the repo curve (Parichy 0.32 mm/d) gives 11.0 mm at 26 dpf and Parichy group-reared rates (0.45-0.55 mm/d) reach 11 mm at 16-19 dpf. Age alone does not fix the state; SL does.',
    zf_adult_mass: 'Adults of 34-36 mm SL weighed 0.84-0.90 g (Plaut & Gordon 1994; Plaut 2000), while the extrapolated Beaudouin law gives 0.54 g at 36 mm SL.',
    zf_ucrit: 'Adult Ucrit 0.560 m/s wild-type and 0.437 m/s long-fin (Plaut 2000, 5-min steps) vs 0.238 m/s long-fin at the same 28 C (Wakamatsu 2019, 1-min steps, 170 ml tunnel): a ~2x protocol effect. Treat adult Ucrit as [0.24, 0.56] m/s.',
    zf_metabolic_scaling: 'The larval law (46.1 M^0.825, 28 C) extrapolated to 0.84 g gives ~14 umol g-1 h-1, below Plaut & Gordon 1994 adult SMR 26.8-68.7 umol g-1 h-1 (28 C) but near Lucas & Priede 1992 (17.4 umol g-1 h-1 at 24 C, as quoted by Plaut & Gordon). No data bridge 3.5 mg to 0.27 g.',
    ff_species_mix: 'Flying-fish rows mix H. affinis growth, Daane 2021 fin lengths (H. rondeleti, E. volitans, C. furcatus), Davenport 1992 exponents (E. obtusirostris) and the Park & Choi adult (C. hiraii, 0.06 kg at 0.203 m SL vs 0.13 kg for H. affinis at 0.206 m): mass at a given SL differs ~2x between sources.',
  },
};
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1) + '\n');
console.log('wrote', process.argv[2]);
