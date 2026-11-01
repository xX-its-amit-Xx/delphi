// anatomy-model/parametric/stages.mjs
// Turns the project's real growth trajectories into per-stage parameter overrides for build.py.
//
//   node anatomy-model/parametric/stages.mjs          -> writes anatomy-model/parametric/stages.json
//
// Flying fish: development/trajectory.mjs            (SL, mass, fin ratio, stage, partsPresent)
// Zebrafish:   development/zebrafish/trajectory.mjs   (SL, mass, proportions, Parichy milestones)
// TFF:         NO DEVELOPMENTAL DATA EXISTS.  Its stages are the flying fish's measured growth with
//              the TFF's deltas ramped in on the same schedule as the flying fish's own measured
//              pectoral-fin ontogeny.  That ramp is a STATED ASSUMPTION, not data, and it is labelled
//              as such in stages.json, in the GLB manifest and in the README.
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as FF from '../../development/trajectory.mjs';
import * as ZF from '../../development/zebrafish/trajectory.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AREA_EXP = 1.834; // Davenport 1992 fin-area exponent, development/trajectory.mjs P.area.exp

// size_rel is SL(stage) / SL(BASE), the base being the resolved parameter set the GLB's base mesh is
// built from (resolved/<id>.json, written by params.py --dump). Before 2.0.0 it was SL(stage) / SL(adult
// stage), which drew the flying fish's 365 d target (SL 0.20615 m) at the base's 0.203 m and gave that
// target a different metres-per-unit from the base mesh. Now every target's m_per_unit equals the base's.
const RESOLVED = (id) => JSON.parse(readFileSync(join(HERE, 'resolved', `${id}.json`), 'utf8')).parameters;
const FF_BASE = RESOLVED('flying-fish');
const ZF_BASE = RESOLVED('zebrafish-adult');

const FF_ADULT_AGE = 365;
const FF_AGES = [0, 3, 10, 30, 90, 365];
const ZF_AGES = [0, 3, 10, 25, 60, 180];

// ---------------------------------------------------------------- flying fish
const ffAd = FF.at(FF_ADULT_AGE);
const FF_REF = { pect: 0.687, span: 1.2857, area: 0.15475, muscle: 0.040 };

function ffStage(age) {
  const s = FF.at(age);
  const sizeRel = s.SL_m / FF_BASE.standard_length_m;
  // fin ratio is the MEASURED Daane fit; carry span and area with it
  const r = s.finLength_SL / ffAd.finLength_SL;
  const shrink = {};
  const parts = s.partsPresent.map((p) => p.part);
  const hasRays = s.SL_m * 100 >= 1.68; // below the Daane range the fin is a fold/disc with no rays
  if (!hasRays) { shrink.pectoral_rays = 0.02; }
  // gonads: immature in juveniles, absent before
  if (s.stage === 'adult') { /* full */ }
  else if (parts.some((p) => p.includes('gonad immature'))) shrink.gonad = 0.35;
  else shrink.gonad = 0.03;
  // vertebral centra: ossify progressively; no flying-fish datum, so ramp with SL as an assumption
  const vfrac = Math.min(1, Math.max(0.25, (s.SL_m * 100) / 3.0));
  shrink.vertebrae_formed = Math.max(6, Math.round(40 * vfrac));
  shrink.vertebra_unformed = 0.15;
  if (age < 15) shrink.swim_bladder = 0.45; // yolk-sac larva; no flying-fish inflation datum
  return {
    key: `stage_${String(age).padStart(3, '0')}d`,
    label: `${s.stage}, ${age} d after hatching, SL ${(s.SL_m * 1000).toFixed(1)} mm`,
    age_days: age, stage: s.stage, SL_m: s.SL_m, mass_kg: s.mass_kg,
    size_rel: sizeRel,
    parameters: {
      standard_length_m: s.SL_m,
      body_mass_kg: s.mass_kg,
      // ASSUMED: held at the base (adult) value, itself schematic; no flying-fish body-depth ontogeny found
      body_depth_over_SL: FF_BASE.body_depth_over_SL,
      pectoral_len_over_SL: s.finLength_SL,
      pectoral_span_over_SL: FF_REF.span * r,
      pectoral_area_over_SL2: FF_REF.area * Math.pow(r, AREA_EXP),
      // pelvic fins are about equal to the pectorals in H. affinis LARVAE (Hunte et al. 1995, measured)
      pelvic_len_over_SL: s.stage === 'larva' || s.stage === 'hatching'
        ? s.finLength_SL : 0.22,
    },
    shrink,
    parameter_kinds: {
      standard_length_m: age < 14 ? 'assumed (linear ramp)' : 'secondary (fit)',
      body_mass_kg: age < 14 ? 'derived from an assumed SL' : 'secondary (fit)',
      body_depth_over_SL: 'assumed (held at the adult value)',
      pectoral_len_over_SL: s.SL_m * 100 >= 1.68 ? 'measured (Daane 2021 fit)' : 'assumed',
      pectoral_span_over_SL: 'assumed transfer',
      pectoral_area_over_SL2: 'assumed transfer',
      pelvic_len_over_SL: s.stage === 'larva' || s.stage === 'hatching' ? 'measured (Hunte 1995)' : 'assumed',
    },
    basis: {
      SL_and_mass: 'measured/secondary fits: von Bertalanffy (Oxenford 1994 via FishBase) x SL/FL 0.927, '
        + 'and W = 0.0116 FL^3.01 (physics/length-weight.csv). Below 14 d the SL curve is an ASSUMED linear '
        + 'ramp from an assumed 0.4 cm hatch length.',
      fin_ratio: s.finLength_SL_kind,
      fin_span_and_area: `carried from the adult by the fin-length ratio (span linear, area ^${AREA_EXP}, `
        + 'Davenport 1992): an assumed transfer, not a measurement at this size.',
      pelvic: s.stage === 'larva' || s.stage === 'hatching'
        ? 'MEASURED: pelvic fins are enlarged and about equal to the pectorals in H. affinis larvae (Hunte et al. 1995)'
        : 'adult placeholder 0.22 SL (schematic)',
      pectoral_rays: hasRays
        ? 'rays present (within the Daane 1.68-24 cm SL range)'
        : 'ASSUMED ABSENT: below 1.68 cm SL the fin is modelled as a fold + endoskeletal disc (zebrafish proxy: Hale 2014, Grandel 1998, Lalonde 2018). Rays shrunk to 2%.',
      vertebrae: 'ASSUMED: no flying-fish ossification sequence was found. Centra are faded in with SL '
        + 'and reach the full 40 at 3 cm SL. The COUNT 40 is itself illustrative.',
      gonad: s.stage === 'adult' ? 'measured mature (Oliveira 2015)'
        : (shrink.gonad === 0.35 ? 'secondary: immature in juveniles (FishBase)' : 'assumed absent in larvae'),
      body_depth: `ASSUMED: held at the adult value ${FF_BASE.body_depth_over_SL} SL (itself an assumed, schematic `
        + 'number) at every stage. The repository holds no flying-fish body-depth measurement at any size '
        + '(searched development/, physics/, genotype/, organisms/ on 2026-10-31). Early stages are therefore '
        + 'adult-shaped but small, which is wrong in detail and is the largest honest gap here.',
      adult_mass: age === FF_ADULT_AGE
        ? `population length-weight fit (0.1316 kg); the base mesh is the Park & Choi L3 specimen `
          + `(${FF_BASE.body_mass_kg} kg at SL ${FF_BASE.standard_length_m} m). Both kept with roles: manifest adult_mass.`
        : undefined,
      parts_present: parts,
    },
  };
}

// ---------------------------------------------------------------- zebrafish
const zfAd = ZF.at(180);
const ZF_REF = { pect: 0.155, span: 0.42, area: 0.016, depth: 0.2535, head: 0.231 };

function zfStage(age) {
  const s = ZF.at(age);
  const sizeRel = s.SL_m / zfAd.SL_m;   // drives the assumed fin / muscle ramps below (unchanged)
  const SLmm = s.SL_m * 1000;
  const pr = s.proportions || {};
  const depth = typeof pr.depthAtNape_SL === 'number' ? pr.depthAtNape_SL
    : (Array.isArray(pr.bodyDepth_SL) ? (pr.bodyDepth_SL[0] + pr.bodyDepth_SL[1]) / 2 : ZF_REF.depth);
  const head = typeof pr.head_SL === 'number' ? pr.head_SL
    : (Array.isArray(pr.head_SL) ? (pr.head_SL[0] + pr.head_SL[1]) / 2 : ZF_REF.head);
  const passed = new Set(s.parichyMilestonesPassed || []);
  const shrink = {};
  // Parichy 2009 Table 4 milestones, MEASURED: these are real presence/absence facts
  const hasPecRays = SLmm >= 6.4;      // Lalonde & Akimenko 2018
  const hasPelvic = passed.has('PB');  // pelvic bud 7.2 mm
  const hasPelvicRays = passed.has('PR');
  const hasDorsal = passed.has('DR');  // dorsal rays 6.2 mm
  const hasAnal = passed.has('AR');    // anal rays 5.8 mm
  const hasCaudal = passed.has('CR');  // caudal rays 4.5 mm
  const hasSB = passed.has('pSB') || passed.has('aSB');
  if (!hasPecRays) shrink.pectoral_rays = 0.02;
  if (!hasPelvic) shrink.pelvic = 0.02;
  else if (!hasPelvicRays) shrink.pelvic = 0.35;
  if (!hasDorsal) shrink.dorsal = 0.08;
  if (!hasAnal) shrink.anal = 0.08;
  if (!hasCaudal) shrink.caudal = 0.30;
  if (!hasSB) shrink.swim_bladder = 0.05;
  shrink.gonad = s.stage === 'adult' ? 1.0 : (s.stage === 'juvenile' ? 0.3 : 0.03);
  const vfrac = Math.min(1, Math.max(0.2, (SLmm - 3.0) / (11.0 - 3.0)));
  shrink.vertebrae_formed = Math.max(5, Math.round(32 * vfrac));
  shrink.vertebra_unformed = 0.15;
  shrink.pectoral_muscle = Math.max(0.1, sizeRel ** 0.3);
  const fl = SLmm < 6.4 ? 0.075 : ZF_REF.pect * Math.min(1, 0.6 + 0.4 * sizeRel);
  const r = fl / ZF_REF.pect;
  return {
    key: `stage_${String(age).padStart(3, '0')}d`,
    label: `${s.stage}, ${age} d after hatching (${s.dpf} dpf), SL ${SLmm.toFixed(2)} mm, ${s.zfs.name}`,
    age_days: age, stage: s.stage, SL_m: s.SL_m, mass_kg: s.mass_kg,
    size_rel: s.SL_m / ZF_BASE.standard_length_m,
    parameters: {
      standard_length_m: s.SL_m,
      body_mass_kg: s.mass_kg,
      body_depth_over_SL: depth,
      head_fraction_SL: head,
      pectoral_len_over_SL: fl,
      pectoral_span_over_SL: ZF_REF.span * r,
      pectoral_area_over_SL2: ZF_REF.area * Math.pow(r, AREA_EXP),
      pelvic_len_over_SL: hasPelvic ? 0.13 : 0.004,
      dorsal_height_over_SL: hasDorsal ? 0.16 : 0.03,
      anal_height_over_SL: hasAnal ? 0.14 : 0.03,
      caudal_upper_lobe_over_SL: hasCaudal ? 0.215 : 0.10,
      caudal_lower_lobe_over_SL: hasCaudal ? 0.215 : 0.10,
      peduncle_depth_frac: hasCaudal ? 0.38 : 0.55,
      peduncle_width_frac: hasCaudal ? 0.40 : 0.55,
    },
    shrink,
    basis: {
      SL_and_mass: `MEASURED: ${s.mass_kind}; SL from Parichy 2009 larval rate 0.32 mm/d and a von Bertalanffy fit`,
      body_depth_and_head: pr.kind || 'n/a',
      zfs_stage: `${s.zfs.zfs} ${s.zfs.name} (ZFIN stage ontology)`,
      pectoral: `${s.pectoral.state} - ${s.pectoral.kind}`,
      fin_presence: 'MEASURED from Parichy 2009 Table 4 standardised-standard-length milestones: '
        + `passed = [${[...passed].join(', ')}]. Fins whose milestone has not been passed are shrunk, not removed.`,
      pectoral_length: SLmm < 6.4
        ? 'ASSUMED 0.075 SL for the larval fin fold; the ABSENCE OF RAYS is measured (Lalonde 2018, 6.4 mm SL)'
        : 'ASSUMED: no fetched source measures pectoral length / SL in a wild-type zebrafish at any size',
      vertebrae: 'ASSUMED fade-in with SL; the COUNT 32 is measured (anatomy-model/zebrafish/sources.json)',
      milestones_passed: [...passed],
    },
  };
}

// ---------------------------------------------------------------- TFF (borrowed curve)
const TFF_SPAN_MULT = 0.66442 / 0.261;
const TFF_AREA_MULT = 0.04905 / 0.012688;
const TFF_MUSCLE = 0.16;
const BORROWED = 'growth curve borrowed from the flying fish; the TFF has no developmental data';

function tffStage(age) {
  const b = ffStage(age);
  const s = FF.at(age);
  // delta strength: how far along its own MEASURED fin-ratio ontogeny the flying fish is at this age.
  const r0 = FF.at(0).finLength_SL, r1 = ffAd.finLength_SL;
  const strength = Math.min(1, Math.max(0, (s.finLength_SL - r0) / (r1 - r0)));
  const spanMult = 1 + (TFF_SPAN_MULT - 1) * strength;
  const areaMult = 1 + (TFF_AREA_MULT - 1) * strength;
  const linMult = Math.sqrt(areaMult);
  const mf = FF_REF.muscle + (TFF_MUSCLE - FF_REF.muscle) * strength;
  return {
    ...b,
    label: `HYPOTHETICAL TFF at the flying fish's ${b.stage} stage, ${age} d, SL ${(s.SL_m * 1000).toFixed(1)} mm`,
    parameters: {
      ...b.parameters,
      pectoral_span_over_SL: b.parameters.pectoral_span_over_SL * spanMult,
      pectoral_area_over_SL2: b.parameters.pectoral_area_over_SL2 * areaMult,
      pelvic_len_over_SL: b.parameters.pelvic_len_over_SL * linMult,
      caudal_upper_lobe_over_SL: 0.19 * linMult,
      caudal_lower_lobe_over_SL: 0.27 * linMult,
      flight_muscle_fraction: mf,
    },
    shrink: { ...b.shrink, pectoral_muscle: 1.0 },
    assumption: BORROWED,
    basis: {
      ...b.basis,
      THE_STATED_ASSUMPTION: BORROWED,
      how_the_deltas_were_ramped: `delta strength ${strength.toFixed(4)} = (finRatio(age) - finRatio(hatch)) / `
        + '(finRatio(adult) - finRatio(hatch)), i.e. the TFF is assumed to acquire its extra wing area, span '
        + 'and flight muscle on exactly the schedule on which a real flying fish acquires its measured '
        + 'pectoral-fin proportion. At hatching the TFF therefore equals a real flying-fish hatchling and the '
        + 'invention becomes visible as it grows. Nothing about this ramp is measured.',
      why_this_construction: 'The alternative constructions considered were (a) show only the adult, which hides '
        + 'the question, and (b) apply the adult deltas at every age, which would put a 3.3 x SL wingspan on a '
        + '4 mm hatchling - a shape no developmental process produces and that we would be unable to defend. '
        + '(c), used here, keeps the youngest stage identical to measured flying-fish larval morphology, so the '
        + 'ONLY invented quantity is the ramp of the deltas.',
      what_is_NOT_claimed: 'that a TFF could develop, hatch, survive, or that the ramp resembles any real '
        + 'ontogeny. Development is not simulated anywhere in this project.',
      flight_muscle_fraction: `ramped ${FF_REF.muscle} -> ${TFF_MUSCLE}; the 0.16 endpoint is hypothetical `
        + '(physics/flier/tff/tff.json) and the 0.04 start is an assumed placeholder - no measured pectoral-muscle '
        + 'mass fraction exists for any flying fish.',
    },
  };
}

// ---------------------------------------------------------------- emit
const out = {
  _version: '2.0.0 (anatomy-model/parametric/CHANGELOG.md)',
  _README: 'Generated by anatomy-model/parametric/stages.mjs from the project growth trajectories. '
    + 'Per-stage parameter OVERRIDES on top of a reference parameter set (anatomy-model/parametric/params.py). '
    + 'size_rel is SL(stage) / SL(base resolved set, resolved/<id>.json): stages are built at TRUE relative size, '
    + 'so a larva is genuinely tiny and every target shares the base mesh\'s metres per model unit. '
    + 'shrink maps a piece group to a scale factor applied about its own centroid, which is how a piece that has '
    + 'not formed yet is made to disappear without changing the mesh topology (topology must be identical across '
    + 'morph targets).',
  _shrink_keys: {
    pectoral_rays: 'the individual pectoral lepidotrichia', pectoral_membrane: 'the pectoral fin membrane',
    pelvic: 'pelvic fin membrane + rays', dorsal: 'dorsal fin', anal: 'anal fin', caudal: 'caudal fin',
    gonad: 'gonad_L/R', swim_bladder: 'swim_bladder', pectoral_muscle: 'pectoral_muscle_L/R',
    vertebrae_formed: 'integer: how many vertebrae are at full size (counting from the head)',
    vertebra_unformed: 'scale applied to the vertebrae beyond that count',
  },
  'flying-fish': {
    source: 'development/trajectory.mjs', adult_age_days: FF_ADULT_AGE,
    stages: FF_AGES.map(ffStage),
  },
  'zebrafish-adult': {
    source: 'development/zebrafish/trajectory.mjs', adult_age_days: 180,
    stages: ZF_AGES.map(zfStage),
  },
  tff: {
    source: 'NONE. ' + BORROWED,
    assumption: BORROWED,
    adult_age_days: FF_ADULT_AGE,
    stages: FF_AGES.map(tffStage),
  },
};
writeFileSync(join(HERE, 'stages.json'), JSON.stringify(out, null, 1));
console.log('wrote stages.json');
for (const k of ['flying-fish', 'zebrafish-adult', 'tff']) {
  console.log(k, out[k].stages.map((s) => `${s.key} size_rel=${s.size_rel.toFixed(4)} fin=${s.parameters.pectoral_len_over_SL.toFixed(3)} span=${s.parameters.pectoral_span_over_SL.toFixed(3)}`).join('\n   '));
}
