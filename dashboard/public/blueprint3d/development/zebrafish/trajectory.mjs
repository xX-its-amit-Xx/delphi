// development/zebrafish/trajectory.mjs
// Data-driven zebrafish (Danio rerio, lab standard) growth trajectory, plus compareAt() that returns the
// zebrafish and the flying fish (../trajectory.mjs) on one call. NOT a mechanistic model: every relation is a
// staging table, a measured rate or regression, or a published fit (see growth.json, allometry.json, stages.json).
//
// Age axis of at(): days post-HATCHING (dph), the same axis as the flying-fish module; negative = embryo.
// Zebrafish hatch at 2.0 dpf (48 hpf; FishBase larvae page, Main Ref Kimmel et al. 1995).
// Rearing temperatures of the sources (27-28.5 C) differ from the 25 C project baseline; recorded, not corrected.

import * as FF from '../trajectory.mjs';

export const Z = {
  hatch_dpf: 2.0, hatch_SL_mm: 3.1, // FishBase larvae page (Kimmel 1995): length at birth 3.1 mm, hatching 48 h
  pecfin_dpf: 2.5, pecfin_SL_mm: 3.4, // Parichy 2009: Pec-fin stage onset 3.4 mm SL, ~60 hpf at 28.5 C
  larvalRate_mm_d: 0.32, // Parichy 2009: individually reared, 0.32 +/- 0.004 mm SL/day
  juvenile_SL_mm: 11.0, // Parichy 2009 Table 4: milestone J, SSL 11.0
  vb: { Linf_mm: 45.1, K_per_yr: 3.97 }, // FishBase autoctr 4255 (Pauly 1978 compilation; lab, unlimited food)
  lw: { lnA: -5.24, b: 3.22 }, // Beaudouin 2015: ln W(mg) = -5.24 + 3.22 ln SL(mm); juveniles 10-50 dpf
  Lm_SL_mm: 24, // FishBase maturity: 23 (male), 25 (female) mm SL, domesticated
  pecRayOnset_SL_mm: 6.4, // Lalonde & Akimenko 2018, Fig. 8 control larvae
  pecRaysNumbered_SL_mm: 6.8,
  parichyRange_mm: [3.4, 12], // Table 3 regressions span post-embryonic larvae to juvenile (range approximated)
  milestones: [ // Parichy 2009 Table 4 SSL (mm); P = PELVIC in Parichy
    ['pSB', 'posterior swim bladder inflation', 3.5], ['FLe', 'early notochord flexion', 4.5], ['CR', 'caudal fin rays appear', 4.9],
    ['AC', 'anal fin condensation', 5.4], ['DC', 'dorsal fin condensation', 5.7], ['MMA', 'metamorphic melanophores', 5.9],
    ['aSB', 'anterior swim bladder lobe', 6.0], ['AR', 'anal fin rays', 6.2], ['DR', 'dorsal fin rays', 6.4],
    ['PB', 'pelvic fin bud', 7.2], ['PR', 'pelvic fin rays', 8.6], ['SP', 'squamation starts posterior', 9.6],
    ['SA', 'squamation reaches anterior', 10.4], ['J', 'juvenile: squamation complete, fin fold gone', 11.0],
  ],
  zfs: [ // ZFIN stage ontology (Kimmel 1995 series): id, name, start hpf
    ['ZFS:0000001', 'Zygote:1-cell', 0], ['ZFS:0000002', 'Cleavage:2-cell', 0.75], ['ZFS:0000008', 'Blastula:128-cell', 2.25],
    ['ZFS:0000011', 'Blastula:1k-cell', 3], ['ZFS:0000014', 'Blastula:Sphere', 4], ['ZFS:0000017', 'Gastrula:50%-epiboly', 5.25],
    ['ZFS:0000019', 'Gastrula:Shield', 6], ['ZFS:0000022', 'Gastrula:Bud', 10], ['ZFS:0000023', 'Segmentation:1-4 somites', 10.33],
    ['ZFS:0000025', 'Segmentation:10-13 somites', 14], ['ZFS:0000027', 'Segmentation:20-25 somites', 19],
    ['ZFS:0000029', 'Pharyngula:Prim-5', 24], ['ZFS:0000030', 'Pharyngula:Prim-15', 30], ['ZFS:0000031', 'Pharyngula:Prim-25', 36],
    ['ZFS:0000032', 'Pharyngula:High-pec', 42], ['ZFS:0000033', 'Hatching:Long-pec', 48], ['ZFS:0000034', 'Hatching:Pec-fin', 60],
    ['ZFS:0000035', 'Larval:Protruding-mouth', 72], ['ZFS:0000036', 'Larval:Day 4', 96], ['ZFS:0000037', 'Larval:Day 5', 120],
    ['ZFS:0000039', 'Larval:Days 7-13', 168], ['ZFS:0000040', 'Larval:Days 14-20', 336], ['ZFS:0000041', 'Larval:Days 21-29', 504],
    ['ZFS:0000042', 'Juvenile:Days 30-44', 720], ['ZFS:0000043', 'Juvenile:Days 45-89', 1080], ['ZFS:0000044', 'Adult', 2160],
  ],
  pectoralByZfs: [ // ZFIN stage-range starts in genotype/fin-subtree.json
    [24, 'pectoral fin bud (ZFA:0000141), its mesoderm and ZPA'], [30, 'apical ectodermal ridge (ZFA:0000085), fin mesenchyme'],
    [36, 'pectoral fin musculature (ZFA:0000563)'], [42, 'fin cartilage, cleithrum, pectoral girdle (ZFA:0000257, 0000184, 0000407)'],
    [48, 'fin fold of the fin bud (ZFA:0005316)'], [60, 'pectoral fin fold, vasculature (ZFA:0005317, 0005096)'],
  ],
};

const k_d = Z.vb.K_per_yr / 365;
const tJ = Z.pecfin_dpf + (Z.juvenile_SL_mm - Z.pecfin_SL_mm) / Z.larvalRate_mm_d; // 26.25 dpf
const t0 = tJ + Math.log(1 - Z.juvenile_SL_mm / Z.vb.Linf_mm) / k_d; // continuity at J

/** SL (mm) at days post-fertilisation. */
export function SLmmAtDpf(dpf) {
  if (dpf < Z.hatch_dpf) return null;
  if (dpf < Z.pecfin_dpf) return Z.hatch_SL_mm + (Z.pecfin_SL_mm - Z.hatch_SL_mm) * (dpf - Z.hatch_dpf) / (Z.pecfin_dpf - Z.hatch_dpf);
  if (dpf < tJ) return Z.pecfin_SL_mm + Z.larvalRate_mm_d * (dpf - Z.pecfin_dpf);
  return Z.vb.Linf_mm * (1 - Math.exp(-k_d * (dpf - t0)));
}
export function dpfAtSLmm(SL) {
  if (SL <= Z.hatch_SL_mm) return Z.hatch_dpf;
  if (SL < Z.pecfin_SL_mm) return Z.hatch_dpf + (Z.pecfin_dpf - Z.hatch_dpf) * (SL - Z.hatch_SL_mm) / (Z.pecfin_SL_mm - Z.hatch_SL_mm);
  if (SL < Z.juvenile_SL_mm) return Z.pecfin_dpf + (SL - Z.pecfin_SL_mm) / Z.larvalRate_mm_d;
  if (SL >= Z.vb.Linf_mm) return Infinity;
  return t0 - Math.log(1 - SL / Z.vb.Linf_mm) / k_d;
}

function zfsAt(hpf) { let c = Z.zfs[0]; for (const z of Z.zfs) if (hpf >= z[2]) c = z; return { zfs: c[0], name: c[1] }; }

function stageOf(dph, SL) {
  if (dph < 0) return 'egg';
  if (dph < 1) return 'hatching';
  if (SL < Z.juvenile_SL_mm) return 'larva';
  if (SL < Z.Lm_SL_mm) return 'juvenile';
  return 'adult';
}

function pectoral(hpf, SL) {
  if (SL == null) {
    const s = Z.pectoralByZfs.filter((p) => hpf >= p[0]).map((p) => p[1]);
    return { state: s.length ? 'forming: ' + s.join('; ') : 'not yet formed (before Prim-5, 24 hpf)', kind: 'measured (ZFIN stage ranges)' };
  }
  if (SL < Z.pecRayOnset_SL_mm) return { state: 'larval fin: endoskeletal disc + fin fold, no rays', kind: 'measured (Hale 2014; Grandel 1998; Lalonde 2018)' };
  if (SL < Z.pecRaysNumbered_SL_mm) return { state: 'first anterior lepidotrichia forming; disc cartilage decomposing', kind: 'measured (Lalonde 2018, 6.4 mm SL)' };
  if (SL < Z.juvenile_SL_mm) return { state: 'several rays, uncalcified at 6.8-7.2 mm SL; adult skeleton forming', kind: 'measured (Lalonde 2018)' };
  return { state: 'adult-type rayed fin', kind: 'secondary (ZFIN ranges run to Adult)' };
}

function proportions(SL) {
  const [lo, hi] = Z.parichyRange_mm;
  if (SL >= lo && SL <= hi) {
    return {
      depthAtNape_SL: +((SL - 1.62) / 4.12 / SL).toFixed(4), head_SL: +((SL - 0.73) / 3.29 / SL).toFixed(4),
      eye_SL: +((SL - 0.22) / 9.49 / SL).toFixed(4), snoutVent_SL: +((SL - 0.55) / 1.48 / SL).toFixed(4),
      kind: 'measured regressions (Parichy 2009 Table 3)',
    };
  }
  if (SL > hi) {
    return { bodyDepth_SL: [0.25, 0.257], head_SL: [0.225, 0.237], prePectoral_SL: [0.24, 0.246],
      kind: 'secondary (FishBase morphometrics on 2 photographs, converted from %TL with SL = 78.8 and 81.4 %TL)' };
  }
  return { kind: 'no proportion data below 3.4 mm SL' };
}

/** Zebrafish state at days post-hatching (number) or at a size ({SL_mm} / {SL_m}). */
export function at(q) {
  let dpf, SL;
  if (typeof q === 'number') { dpf = q + Z.hatch_dpf; SL = SLmmAtDpf(dpf); }
  else if (q && (q.SL_mm != null || q.SL_m != null)) { SL = q.SL_mm != null ? q.SL_mm : q.SL_m * 1000; dpf = dpfAtSLmm(SL); }
  else throw new Error('at(daysPostHatching) or at({SL_mm})');
  const dph = dpf - Z.hatch_dpf, hpf = dpf * 24;
  const base = { species: 'Danio rerio', ageDays: +dph.toFixed(2), dpf: +dpf.toFixed(2), hpf: +hpf.toFixed(1), zfs: zfsAt(hpf) };
  if (SL == null) return { ...base, stage: 'egg', SL_m: null, mass_kg: null, finLength_SL: null, pectoral: pectoral(hpf, null) };
  const mass_mg = Math.exp(Z.lw.lnA) * Math.pow(SL, Z.lw.b);
  const passed = Z.milestones.filter((m) => SL >= m[2]).map((m) => m[0]);
  return {
    ...base, stage: stageOf(dph, SL), SL_m: +(SL / 1000).toFixed(5), mass_kg: +(mass_mg / 1e6).toPrecision(4),
    mass_kind: SL <= 15 ? 'measured fit (Beaudouin 2015, <= ~15 mm)' : 'extrapolated fit (Beaudouin 2015)',
    finLength_SL: null, finLength_note: 'no numeric wild-type pectoral fin length/SL found (Daane 2018 plots it only)',
    pectoral: pectoral(hpf, SL), proportions: proportions(SL),
    parichyMilestonesPassed: passed, nextMilestone: Z.milestones.find((m) => SL < m[2]) || null,
  };
}

// ---- normalised life-stage progress: 0-1 egg, 1-2 larva, 2-3 juvenile, 3-4 adult (to 95% of Linf) ----
function bounds(species) {
  if (species === 'zebrafish') {
    return [-Z.hatch_dpf, 0, dpfAtSLmm(Z.juvenile_SL_mm) - Z.hatch_dpf, dpfAtSLmm(Z.Lm_SL_mm) - Z.hatch_dpf, dpfAtSLmm(0.95 * Z.vb.Linf_mm) - Z.hatch_dpf];
  }
  const P = FF.P;
  const linfSL = P.vb.Linf_FL_cm * P.SL_per_FL.value;
  return [-P.incubation_d.value, 0, FF.ageAtSLcm(P.stages.larvaToJuvenile_SL_cm), FF.ageAtSLcm(P.stages.juvenileToAdult_SL_cm), FF.ageAtSLcm(0.95 * linfSL)];
}
export function progressAt(species, ageDays) {
  const b = bounds(species);
  if (ageDays <= b[0]) return 0;
  for (let i = 0; i < 4; i++) if (ageDays < b[i + 1]) return i + (ageDays - b[i]) / (b[i + 1] - b[i]);
  return 4;
}
export function ageAtProgress(species, p) {
  const b = bounds(species), q = Math.max(0, Math.min(4, p)), i = Math.min(3, Math.floor(q));
  return b[i] + (q - i) * (b[i + 1] - b[i]);
}

/**
 * Both species on one call.
 *  mode 'absolute' (default): ageDays = days post-hatching, applied to both species (same clock).
 *  mode 'stage': ageDays = FLYING-FISH days post-hatching; the zebrafish is shown at the same normalised
 *                life-stage progress (0-1 egg, 1-2 larva, 2-3 juvenile, 3-4 adult to 95% Linf), linear within each stage.
 */
export function compareAt(ageDays, opts = {}) {
  const mode = opts.mode || 'absolute';
  if (mode === 'absolute') {
    return { mode, axis: 'same absolute time: days post-hatching for both species', ageDays,
      progress: { flyingFish: +progressAt('flyingfish', ageDays).toFixed(3), zebrafish: +progressAt('zebrafish', ageDays).toFixed(3) },
      flyingFish: FF.at(ageDays, opts), zebrafish: at(ageDays) };
  }
  if (mode === 'stage') {
    const p = progressAt('flyingfish', ageDays);
    const za = ageAtProgress('zebrafish', p);
    return { mode, axis: 'normalised by life stage: zebrafish age chosen so both have the same stage progress (piecewise linear within egg, larva, juvenile, adult)',
      progress: +p.toFixed(3), flyingFishAgeDays: ageDays, zebrafishAgeDays: +za.toFixed(2),
      flyingFish: FF.at(ageDays, opts), zebrafish: at(za) };
  }
  throw new Error("mode must be 'absolute' or 'stage'");
}

export function describe() {
  return [
    { quantity: 'embryo stage', relation: 'ZFS stage from hpf (ZFIN stage ontology = Kimmel 1995)', kind: 'measured staging table' },
    { quantity: 'SL 2.0-2.5 dpf', relation: '3.1 mm at hatching (48 hpf) to 3.4 mm at Pec-fin (60 hpf), linear between', kind: 'secondary + measured endpoints' },
    { quantity: 'SL 2.5 dpf to 11 mm', relation: 'SL = 3.4 + 0.32 (dpf - 2.5) mm', kind: 'measured rate (Parichy 2009, individually reared); linear form assumed' },
    { quantity: 'SL after 11 mm', relation: `SL = 45.1 (1 - exp(-3.97/365 (dpf - ${t0.toFixed(2)}))) mm`, kind: 'secondary (FishBase lab VB, Pauly 1978); t0 set for continuity' },
    { quantity: 'mass', relation: 'W_mg = exp(-5.24) SL_mm^3.22', kind: 'measured fit (Beaudouin 2015; log base inferred natural)' },
    { quantity: 'body proportions', relation: 'Parichy 2009 Table 3 linear regressions (3.4-12 mm); FishBase photo ratios above', kind: 'measured / secondary' },
    { quantity: 'pectoral fin', relation: 'bud 24 hpf ... fold 60 hpf; disc + fold; rays from 6.4 mm SL; length/SL not found', kind: 'measured (ZFIN; Lalonde 2018)' },
    { quantity: 'stage', relation: 'egg < 0 dph; hatching < 1 dph; larva < 11.0 mm SL (J); juvenile < 24 mm SL (Lm); adult', kind: 'measured cut-offs (Parichy 2009; FishBase Lm)' },
    { quantity: 'compareAt', relation: "mode 'absolute' = same days post-hatching; mode 'stage' = same normalised stage progress", kind: 'definition' },
  ];
}
