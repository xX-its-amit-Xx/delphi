// development/trajectory.mjs
// Data-driven growth trajectory for a flying fish (default: Hirundichthys affinis, eastern Caribbean).
// NOT a mechanistic model of development: every number below is a lookup or fit taken from
// growth.json, allometry.json and stages.json (see README.md). Dependency-free ES module.
//
//   import { at, describe, series } from './trajectory.mjs'
//   at(30)               -> state at 30 days after hatching
//   at({ SL_m: 0.10 })   -> state at 10 cm standard length
//   at(-3)               -> embryo, 3 days before hatching
//
// Conditions are fixed at baseline (conditions/baseline.json): growth is NOT adjusted for
// temperature or food; the field fits already embed average field conditions.

export const P = {
  // von Bertalanffy, H. affinis, Barbados (FishBase growth autoctr 4651; Main Ref = Oxenford et al. 1994)
  vb: { Linf_FL_cm: 23.3, K_per_yr: 3.12, t0_yr: 0.01, kind: 'secondary' },
  // SL = 0.927 FL (FishBase length-length, H. affinis; reference not shown -> unverified)
  SL_per_FL: { value: 0.927, kind: 'secondary (unverified)' },
  // hatch length and incubation: NOT found for any flying fish -> assumed placeholders
  hatch_SL_cm: { value: 0.4, kind: 'assumed' },
  incubation_d: { value: 7, kind: 'assumed (Munro 1954 bounds it below 15 d)' },
  // days after hatching where the assumed linear early segment joins the VB curve
  join_d: { value: 14, kind: 'assumed' },
  // egg diameter, Exocoetus (Hunte et al. 1995 citing Bruun 1935, Breder 1938); stand-in for the family
  egg_diameter_mm: { value: [1.7, 3.1], kind: 'secondary, genus stand-in' },
  // W_g = a * FL_cm^b, H. affinis Barbados (physics/length-weight.csv fitted field row)
  lw: { a: 0.0116, b: 3.01, kind: 'secondary (unverified reference), adults; extrapolated below' },
  // pectoral fin length vs SL, Daane et al. 2021 Data S1A (n = 49 flying fish), log10-log10 OLS fits computed here
  fin: {
    pooled: { log10a: -0.2241, b: 1.0579, se_b: 0.0200 },
    'Hirundichthys rondeleti': { log10a: -0.1883, b: 1.0398, se_b: 0.0266 },
    'Exocoetus volitans': { log10a: -0.3476, b: 1.1689, se_b: 0.0318 },
    'Cheilopogon furcatus': { log10a: -0.1749, b: 0.998, se_b: 0.0308 },
    SL_range_cm: [1.68, 24.0],
    max_ratio: 0.79, // Davenport 1992: cannot exceed 78-79% of SL
    ramp_start_ratio: 0.10, // assumed ratio at hatching (no data below 1.68 cm SL)
    kind: 'measured fit (1.68-24 cm SL); assumed ramp below; extrapolated above',
  },
  // fin area: Park & Choi 2010 model L3 anchor scaled with Davenport 1992 exponent 1.834 (assumed transfer)
  area: { SL0_m: 0.203, pectoral_m2: 0.006377, total_m2: 0.006377 + 0.001837 + 0.004474, exp: 1.834, CLmax: 0.78 },
  wingLoadingExp_Davenport: 1.236,
  rho_air: 1.225, // conditions/baseline.json
  g: 9.81,
  // stage boundaries (SL, cm): larva/juvenile assumed at 3 cm; adult at 19 cm FL maturity (Oxenford et al. 1995) * 0.927
  stages: { larvaToJuvenile_SL_cm: 3.0, juvenileToAdult_SL_cm: 19 * 0.927 },
  // zebrafish embryo stages (ZFIN stage_ontology.txt, start hpf) used as a time-scaled proxy in the egg
  zfs: [
    ['ZFS:0000001', 'Zygote:1-cell', 0], ['ZFS:0000002', 'Cleavage:2-cell', 0.75], ['ZFS:0000008', 'Blastula:128-cell', 2.25],
    ['ZFS:0000017', 'Gastrula:50%-epiboly', 5.25], ['ZFS:0000022', 'Gastrula:Bud', 10], ['ZFS:0000023', 'Segmentation:1-4 somites', 10.33],
    ['ZFS:0000029', 'Pharyngula:Prim-5', 24], ['ZFS:0000030', 'Pharyngula:Prim-15', 30], ['ZFS:0000031', 'Pharyngula:Prim-25', 36],
    ['ZFS:0000032', 'Pharyngula:High-pec', 42], ['ZFS:0000033', 'Hatching:Long-pec', 48], ['ZFS:0000034', 'Hatching:Pec-fin', 60],
  ],
  zebrafishHatch_hpf: 60,
};

const yr = (d) => d / 365;
const vbFL = (tDays) => P.vb.Linf_FL_cm * (1 - Math.exp(-P.vb.K_per_yr * (yr(tDays) - P.vb.t0_yr)));
const SL_join = () => P.SL_per_FL.value * vbFL(P.join_d.value);

/** SL (cm) at age (days after hatching). */
export function SLcmAt(ageDays) {
  if (ageDays < 0) return null;
  if (ageDays < P.join_d.value) {
    const h = P.hatch_SL_cm.value;
    return h + (SL_join() - h) * (ageDays / P.join_d.value);
  }
  return P.SL_per_FL.value * vbFL(ageDays);
}

/** Age (days after hatching) at SL (cm); inverse of SLcmAt. */
export function ageAtSLcm(SLcm) {
  const h = P.hatch_SL_cm.value, sj = SL_join();
  if (SLcm <= h) return 0;
  if (SLcm < sj) return P.join_d.value * (SLcm - h) / (sj - h);
  const FL = SLcm / P.SL_per_FL.value;
  if (FL >= P.vb.Linf_FL_cm) return Infinity;
  return 365 * (P.vb.t0_yr - Math.log(1 - FL / P.vb.Linf_FL_cm) / P.vb.K_per_yr);
}

function finRatio(SLcm, species = 'pooled') {
  const f = P.fin[species] || P.fin.pooled;
  const fit = (s) => Math.min(P.fin.max_ratio, Math.pow(10, f.log10a) * Math.pow(s, f.b - 1));
  const [lo, hi] = P.fin.SL_range_cm;
  if (SLcm < lo) {
    const h = P.hatch_SL_cm.value, r0 = P.fin.ramp_start_ratio;
    const r = r0 + (fit(lo) - r0) * Math.max(0, (SLcm - h) / (lo - h));
    return { value: r, kind: 'assumed (linear ramp from an assumed 0.10 at hatching to the fit at 1.68 cm SL; no flying-fish data below 1.68 cm SL)' };
  }
  return { value: fit(SLcm), kind: SLcm <= hi ? 'measured fit (Daane 2021, ' + species + ')' : 'extrapolated beyond 24 cm SL' };
}

function stageOf(ageDays, SLcm) {
  if (ageDays < 0) return 'egg';
  if (ageDays < 1) return 'hatching';
  if (SLcm < P.stages.larvaToJuvenile_SL_cm) return 'larva';
  if (SLcm < P.stages.juvenileToAdult_SL_cm) return 'juvenile';
  return 'adult';
}

function embryoProxy(ageDays) {
  const inc = P.incubation_d.value;
  const hpf = ((ageDays + inc) / inc) * P.zebrafishHatch_hpf; // assumed proportional time scaling
  let cur = P.zfs[0];
  for (const z of P.zfs) if (hpf >= z[2]) cur = z;
  return { zebrafish_equivalent_hpf: +hpf.toFixed(1), zfs: cur[0], zfs_name: cur[1], kind: 'proxy (zebrafish, ZFIN), time-scaled by an assumed incubation' };
}

function partsPresent(stage, ageDays, SLcm, embryo) {
  const p = [];
  if (stage === 'egg') {
    p.push({ part: 'egg with attachment filaments (non-Exocoetus genera)', kind: 'measured/secondary', source: 'munro-1954, hunte-1995' });
    if (embryo.zebrafish_equivalent_hpf >= 24) p.push({ part: 'pectoral fin bud', id: 'ZFA:0000141', uberon: 'UBERON:0005419', kind: 'proxy', source: 'ZFIN Prim-5 onset' });
    if (embryo.zebrafish_equivalent_hpf >= 30) p.push({ part: 'apical ectodermal ridge pectoral fin bud', id: 'ZFA:0000085', kind: 'proxy' });
    if (embryo.zebrafish_equivalent_hpf >= 42) p.push({ part: 'pectoral fin cartilage / girdle (cleithrum) begin', id: 'ZFA:0000257', kind: 'proxy' });
    return p;
  }
  p.push({ part: 'pectoral fin', id: 'UBERON_0000151', kind: SLcm >= 1.68 ? 'measured' : 'proxy' });
  if (SLcm < 1.68) p.push({ part: 'pectoral fin fold + endoskeletal disc (larval fin)', id: 'ZFA:0005317', kind: 'proxy (zebrafish; Hale 2014, Grandel 1998)' });
  if (ageDays < 15) p.push({ part: 'yolk sac (absorbed within the first ~2 weeks)', kind: 'measured bound (Munro 1954 culture, 15 d)' });
  p.push({ part: 'pelvic fins enlarged ("wings"; about equal to pectorals in H. affinis larvae)', kind: 'measured (Hunte 1995)', when: stage === 'larva' });
  if (stage === 'juvenile') {
    p.push({ part: 'dark body bars / mottled paired fins', kind: 'secondary (FishBase, several species)' });
    p.push({ part: 'no chin barbel (Hirundichthys)', kind: 'secondary (FishBase)' });
    p.push({ part: 'gonad immature', id: 'UBERON_0000991', kind: 'secondary' });
  }
  if (stage === 'adult') p.push({ part: 'gonad mature', id: 'UBERON_0000991', kind: 'measured (Oliveira 2015)' });
  return p;
}

/**
 * State at an age (number, days after hatching; negative = embryo) or at a size ({SL_m} or {SL_cm}).
 * opts.species selects the fin-ratio fit: 'pooled' (default), 'Hirundichthys rondeleti', 'Exocoetus volitans', 'Cheilopogon furcatus'.
 */
export function at(q, opts = {}) {
  const species = opts.species || 'pooled';
  let ageDays, SLcm;
  if (typeof q === 'number') { ageDays = q; SLcm = SLcmAt(q); }
  else if (q && (q.SL_m != null || q.SL_cm != null)) { SLcm = q.SL_cm != null ? q.SL_cm : q.SL_m * 100; ageDays = ageAtSLcm(SLcm); }
  else if (q && q.ageDays != null) return at(q.ageDays, opts);
  else throw new Error('at(ageDays) or at({SL_m}) / at({SL_cm})');

  if (ageDays < 0) {
    const embryo = embryoProxy(ageDays);
    return { ageDays, stage: 'egg', SL_m: null, mass_kg: null, eggDiameter_mm: P.egg_diameter_mm.value, embryo,
      finLength_SL: null, finArea_m2: null, partsPresent: partsPresent('egg', ageDays, 0, embryo) };
  }
  const SL_m = SLcm / 100;
  const FL = SLcm / P.SL_per_FL.value;
  const mass_kg = (P.lw.a * Math.pow(FL, P.lw.b)) / 1000;
  const fr = finRatio(SLcm, species);
  const s = Math.pow(SL_m / P.area.SL0_m, P.area.exp);
  const finArea_m2 = P.area.pectoral_m2 * s;
  const totalArea = P.area.total_m2 * s;
  const W = mass_kg * P.g;
  const wingLoading = W / totalArea;
  const vmin = Math.sqrt((2 * W) / (P.rho_air * totalArea * P.area.CLmax));
  const stage = stageOf(ageDays, SLcm);
  return {
    ageDays: +ageDays.toFixed(2), stage, SL_m: +SL_m.toFixed(5), FL_m: +(FL / 100).toFixed(5),
    mass_kg: +mass_kg.toPrecision(4),
    finLength_SL: +fr.value.toFixed(4), finLength_SL_kind: fr.kind,
    finLength_m: +(fr.value * SL_m).toFixed(5),
    finArea_m2: +finArea_m2.toPrecision(4),
    finArea_assumption: 'Park & Choi 2010 L3 pectoral area (0.006377 m2 at SL 0.203 m) scaled by SL^1.834 (Davenport 1992, E. obtusirostris); assumed transfer across species and sizes',
    wingLoading_N_m2: +wingLoading.toPrecision(4),
    vmin_glide_m_s: +vmin.toPrecision(3),
    vmin_note: 'derived: sqrt(2W / (rho S CLmax)) with S = L3 total planform scaled by SL^1.834 and CLmax 0.78 held constant (assumed). Not a glide verdict: no juvenile glide or airspeed data were found.',
    partsPresent: partsPresent(stage, ageDays, SLcm),
  };
}

/** n states evenly spaced in age from -incubation to maxDays. */
export function series(n = 20, maxDays = 365, opts = {}) {
  const lo = -P.incubation_d.value;
  return Array.from({ length: n }, (_, i) => at(lo + (i * (maxDays - lo)) / (n - 1), opts));
}

/** Basis of every relation used. */
export function describe() {
  return [
    { quantity: 'SL(age), age >= 14 d', relation: 'SL = 0.927 * 23.3 * (1 - exp(-3.12 * (t_yr - 0.01))) cm', kind: 'secondary', basis: 'FishBase growth row autoctr 4651 (Oxenford et al. 1994, otolith daily increments, H. affinis, Barbados; FishBase flags Questionable/outlier) x FishBase SL/FL 0.927 (unverified)' },
    { quantity: 'SL(age), 0-14 d', relation: 'linear from 0.4 cm at hatching to the VB value at 14 d', kind: 'assumed', basis: 'no flying-fish hatch length or early growth found' },
    { quantity: 'embryo (age < 0)', relation: 'zebrafish ZFS stage at hpf = 60 * (age + 7) / 7', kind: 'proxy + assumed', basis: 'ZFIN stage ontology; incubation 7 d assumed (Munro 1954: < 15 d)' },
    { quantity: 'mass(SL)', relation: 'W_g = 0.0116 * FL_cm^3.01', kind: 'secondary', basis: 'physics/length-weight.csv, H. affinis Barbados fitted row; adults, extrapolated to small fish' },
    { quantity: 'finLength/SL', relation: 'pooled 10^-0.2241 * SL_cm^0.0579 (capped at 0.79)', kind: 'measured fit', basis: 'Daane et al. 2021 Data S1A, n = 49, 1.68-24 cm SL; b = 1.058 +/- 0.020; below 1.68 cm an assumed ramp' },
    { quantity: 'finArea', relation: '0.006377 m2 * (SL / 0.203 m)^1.834', kind: 'assumed transfer', basis: 'Park & Choi 2010 model L3 (one Cypselurus hiraii) x Davenport 1992 exponent (E. obtusirostris)' },
    { quantity: 'wing loading, v_min', relation: 'W / S; sqrt(2W / (1.225 S 0.78))', kind: 'derived', basis: 'mass law + area law above; CLmax 0.78 from L3; air density from conditions/baseline.json. Davenport reports wing loading ~ SL^1.236; ours implies SL^(3.01-1.834) = SL^1.18' },
    { quantity: 'stage', relation: 'egg < 0 d; hatching < 1 d; larva < 3 cm SL; juvenile < 17.6 cm SL; adult', kind: 'assumed boundaries on sourced sizes', basis: 'larva/juvenile split is gear-defined (Hunte 1995; Balon 1985 via Hunte: flyingfish have no true larval stage); maturity ~190 mm (Oxenford et al. 1995), tm 0.63 yr (FishBase)' },
  ];
}
