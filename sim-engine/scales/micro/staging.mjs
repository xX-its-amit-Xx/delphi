// THE CLOCK: what stage the embryo is at, at a given temperature.
//
// ============================== THE LAW THIS FILE IS BUILT ON ==============================
// Kimmel et al. 1995 define "standard developmental time", written h, as normalised hours post
// fertilisation at 28.5 C, and give the retiming law in the legend to their Figure 2:
//
//       H_T = h / (0.055 T - 0.57)
//
// where H_T is hours of development at temperature T in Celsius, and h is hours to reach the stage at
// 28.5 C.
//
// A SMALL DISCREPANCY, CHECKED RATHER THAN ASSUMED. By the definition of standard developmental time the
// denominator ought to be exactly 1 at T = 28.5. With the published coefficients it is not:
//       0.055 x 28.5 - 0.57 = 1.5675 - 0.57 = 0.9975
// so the law as printed runs the standard temperature 0.25 % slow, and 72 h of standard time comes back
// as 72.18 h at 28.5 C. This is almost certainly rounding in the published coefficients rather than a
// claim about biology - 0.055 and 0.57 are both two significant figures, and the exact-at-28.5 slope
// would be 0.0551 (to three). It is recorded here because the first draft of this file asserted the
// denominator was "1.0 exactly", which is arithmetically false, and a 0.25 % error that nobody has
// written down is how a clock drifts.
//
// The law is used AS PUBLISHED by default, because the alternative is quietly substituting our own
// coefficients for Kimmel's. `normalise: true` offers the exact-at-28.5 variant, clearly flagged as ours.
//
// This is what makes the environment toggle MEAN something rather than swapping a backdrop. A dish at
// 28.5 C and a sun-warmed pool margin at 34.9 C are not the same embryo with different scenery - they are
// the same embryo running at different speeds, and the law says how much.
//
// ============================== THE PROBLEM THE LAW CREATES, WHICH WE KEEP ==============================
// The law is stated as linear between 25 C and 33 C. The temperatures zebrafish were actually MEASURED
// occupying in the wild run from 24.5 C to 35.3 C. So the real habitat extends past BOTH ends of the
// window where the clock is validated. Animating development at a measured wild temperature therefore
// means extrapolating a published law beyond its stated range - which is allowed, and is NOT allowed to
// be silent. rateAt() returns `extrapolated: true` and the reason, and the UI is expected to say so.
//
// Kimmel et al. also print their own caution, which travels with every number here: "there is no
// assurance that all features of the embryo coordinately change their rates of development when the
// temperature is changed."
//
// Source for everything in this file unless stated otherwise: Kimmel CB, Ballard WW, Kimmel SR, Ullmann B,
// Schilling TF (1995) "Stages of embryonic development of the zebrafish", Dev Dyn 203:253-310,
// doi 10.1002/aja.1002030302, Tables 1 and 2 and the Figure 2 legend.

export const CITATION = 'Kimmel et al. 1995, Dev Dyn 203:253-310, doi 10.1002/aja.1002030302';

export const RATE_LAW = {
  formula: 'H_T = h / (0.055 T - 0.57)',
  where: 'H_T = hours of development at temperature T (Celsius); h = hours to the same stage at 28.5 C',
  source: `${CITATION}, legend to Figure 2`,
  validated_between_C: [25, 33],
  evidence: 'rate is linear in temperature across that window; rates at 25 C and 33 C are each approximately linear with equal slopes before and after the bud stage, and at 28.5 C the plot is a straight line through the origin with slope 1.0.',
  worked_example_from_the_paper: '20-somite stage (h = 19) predicted at 23.6 h at 25 C against 23.5 h observed, and 15 h at 33 C against 14.5 h observed.',
  the_authors_own_caution: 'there is no assurance that all features of the embryo coordinately change their rates of development when the temperature is changed',
  beyond_the_window: 'Kimmel et al. warn that incubating for long periods above or below 25-33 C "may produce abnormalities". Outside that range this law is an extrapolation and nothing here pretends otherwise.',
  method: 'groups of generally 20-30 embryos (never fewer than 6) per temperature at 25.0, 28.5 and 33.0 C plus or minus 0.2 C, in covered 150 ml beakers in regulated water baths.',
};

/** The published law evaluated at 28.5 C. Not 1, and the gap is carried as data rather than prose. */
export const STANDARD_TEMPERATURE_C = 28.5;
export const RATE_AT_STANDARD = 0.055 * STANDARD_TEMPERATURE_C - 0.57;   // 0.9975, not 1
export const NORMALISATION_GAP = {
  expected: 1,
  from_published_coefficients: RATE_AT_STANDARD,
  relative_error: +((1 - RATE_AT_STANDARD)).toPrecision(3),
  what_it_means: 'the law as printed runs the standard temperature about 0.25 % slow, so 72 h of standard time returns 72.18 h at 28.5 C.',
  most_likely_cause: 'rounding: both coefficients are given to two significant figures, and a slope of 0.0551 would land on 1 exactly.',
  what_this_module_does: 'uses the law AS PUBLISHED by default, rather than silently substituting coefficients of our own. Pass { normalise: true } for the exact-at-28.5 variant, which is OURS and is labelled so.',
};

/** Developmental rate multiplier at temperature T, relative to the 28.5 C standard. */
export function rateAt(T, { normalise = false } = {}) {
  const raw = 0.055 * T - 0.57;
  const rate = normalise ? raw / RATE_AT_STANDARD : raw;
  const [lo, hi] = RATE_LAW.validated_between_C;
  const outside = T < lo || T > hi;
  const dead = !(rate > 0);
  return {
    temperature_C: T,
    rate_multiplier: +rate.toPrecision(4),
    coefficients: normalise ? 'NORMALISED BY US so the standard temperature is exactly 1; not Kimmel\'s printed coefficients' : 'as published',
    normalisation_gap: normalise ? null : NORMALISATION_GAP,
    faster_or_slower_than_standard: dead ? 'no development: the linear fit has run out' : rate > 1 ? `${((rate - 1) * 100).toFixed(0)} % faster than at 28.5 C` : rate < 1 ? `${((1 - rate) * 100).toFixed(0)} % slower than at 28.5 C` : 'the 28.5 C standard exactly',
    extrapolated: outside,
    valid: rate > 0 && !outside,
    why: outside
      ? `EXTRAPOLATED. ${T} C is outside the ${lo}-${hi} C window in which this law is stated to be linear. Zebrafish were measured occupying water from 24.5 C to 35.3 C, so the real habitat runs past both ends of the validated range - the law is being used beyond where its authors tested it, and the number above should be read as an estimate, not a measurement.`
      : `within the ${lo}-${hi} C window where the law is stated to hold.`,
    breaks_down_below_C: +((0.57 / 0.055)).toPrecision(4),
    breaks_down_note: 'below about 10.4 C the formula returns zero or negative rate, which is arithmetic rather than biology: the linear fit simply does not extend there. The function refuses rather than returning a nonsense time.',
    source: RATE_LAW.source,
  };
}

/** Hours to reach a stage at temperature T. */
export function hoursAt(h_at_285, T) {
  const r = rateAt(T);
  if (!(r.rate_multiplier > 0)) return { hours: null, refused: true, why: r.breaks_down_note, rate: r };
  return { hours: +(h_at_285 / r.rate_multiplier).toPrecision(4), rate: r, standard_hours: h_at_285 };
}

/** The seven periods. `h` is the start, in standard developmental time at 28.5 C. */
export const PERIODS = [
  { id: 'zygote', h: 0, what: 'newly fertilised egg through completion of the first zygotic cell cycle' },
  { id: 'cleavage', h: 0.75, what: 'cell cycles 2 to 7, rapid and synchronous' },
  { id: 'blastula', h: 2.25, what: 'rapid metasynchronous cycles 8 and 9 give way to lengthened ASYNCHRONOUS ones at the midblastula transition; epiboly begins' },
  { id: 'gastrula', h: 5.25, what: 'involution, convergence and extension form epiblast, hypoblast and the embryonic axis; through the end of epiboly' },
  { id: 'segmentation', h: 10, what: 'somites, pharyngeal arch primordia, neuromeres; primary organogenesis; earliest movements; the tail appears' },
  { id: 'pharyngula', h: 24, what: 'the phylotypic-stage embryo; the body axis straightens off the yolk sac; circulation, pigmentation and fins begin' },
  { id: 'hatching', h: 48, what: 'morphogenesis of the primary organ systems completes; head and pectoral-fin cartilage; hatching occurs ASYNCHRONOUSLY' },
  { id: 'early-larva', h: 72, what: 'the swim bladder inflates; food-seeking and active avoidance behaviours appear' },
];

/** Named stages. `el_mm` is embryo length and `hta_deg` the head-trunk angle where Kimmel gives them -
 *  these are the only published numbers available for SCALING a model, so they are carried explicitly. */
export const STAGES = [
  { id: '1-cell', h: 0, period: 'zygote', cells: 1, what: 'cytoplasm streams toward the animal pole to form the blastodisc; the chorion swells and lifts away', egg_diameter_mm: 0.7 },
  { id: '2-cell', h: 0.75, period: 'cleavage', cells: 2, what: 'partial cleavage' },
  { id: '4-cell', h: 1, period: 'cleavage', cells: 4, what: '2 x 2 array of blastomeres' },
  { id: '8-cell', h: 1.25, period: 'cleavage', cells: 8, what: '2 x 4 array' },
  { id: '16-cell', h: 1.5, period: 'cleavage', cells: 16, what: '4 x 4 array' },
  { id: '32-cell', h: 1.75, period: 'cleavage', cells: 32, what: 'two regular tiers, sometimes a 4 x 8 array' },
  { id: '64-cell', h: 2, period: 'cleavage', cells: 64, what: 'three regular tiers' },
  { id: '128-cell', h: 2.25, period: 'blastula', cells: 128, what: 'five tiers; cleavage planes become irregular' },
  { id: '256-cell', h: 2.5, period: 'blastula', cells: 256, what: 'seven tiers' },
  { id: '512-cell', h: 2.75, period: 'blastula', cells: 512, what: 'nine tiers; the yolk syncytial layer forms' },
  { id: '1k-cell', h: 3, period: 'blastula', cells: 1024, what: 'eleven tiers; a single row of yolk syncytial nuclei; SLIGHT CELL-CYCLE ASYNCHRONY begins' },
  { id: 'high', h: 3.33, period: 'blastula', what: 'more than eleven tiers; the blastodisc begins flattening; SUBSTANTIAL DIVISION ASYNCHRONY' },
  { id: 'oblong', h: 3.67, period: 'blastula', what: 'flattening gives an elliptical shape; multiple rows of yolk syncytial nuclei' },
  { id: 'sphere', h: 4, period: 'blastula', what: 'spherical, with a flat border between blastodisc and yolk' },
  { id: 'dome', h: 4.33, period: 'blastula', what: 'the yolk cell domes toward the animal pole as epiboly begins' },
  { id: '30-epiboly', h: 4.67, period: 'blastula', what: 'the blastoderm is an inverted cup of uniform thickness; its margin is 30 % of the way animal to vegetal' },
  { id: '50-epiboly', h: 5.25, period: 'gastrula', what: 'blastoderm uniform in thickness' },
  { id: 'germ-ring', h: 5.67, period: 'gastrula', what: 'the germ ring is visible from the animal pole' },
  { id: 'shield', h: 6, period: 'gastrula', what: 'the embryonic shield is visible from the animal pole' },
  { id: '75-epiboly', h: 8, period: 'gastrula', what: 'the dorsal side is distinctly thicker; epiblast, hypoblast and evacuation zone visible' },
  { id: '90-epiboly', h: 9, period: 'gastrula', what: 'the brain rudiment thickens; the notochord rudiment becomes distinct from the segmental plate' },
  { id: 'bud', h: 10, period: 'gastrula', what: 'the tail bud is prominent; early polster; 100 % epiboly' },
  { id: '1-somite', h: 10.33, period: 'segmentation', somites: 1, what: 'the first somite furrow' },
  { id: '5-somite', h: 11.67, period: 'segmentation', somites: 5, what: 'polster prominent; optic vesicle; Kupffer\'s vesicle' },
  { id: '14-somite', h: 16, period: 'segmentation', somites: 14, el_mm: 0.9, what: 'otic placode; brain neuromeres; V-shaped trunk somites; pronephric duct' },
  { id: '20-somite', h: 19, period: 'segmentation', somites: 20, el_mm: 1.4, what: 'yolk extension over yolk ball exceeds 0.5' },
  { id: '26-somite', h: 22, period: 'segmentation', somites: 26, el_mm: 1.6, hta_deg: 125, what: 'side-to-side flexures; otoliths' },
  { id: 'prim-5', h: 24, period: 'pharyngula', el_mm: 1.9, hta_deg: 120, what: 'early pigmentation in retina and skin; median fin fold; red blood cells on the yolk; THE HEART BEATS' },
  { id: 'prim-15', h: 30, period: 'pharyngula', el_mm: 2.5, hta_deg: 95, what: 'retina pigmented; weak circulation; shallow PECTORAL FIN BUDS; straight tail; early touch reflex' },
  { id: 'prim-25', h: 36, period: 'pharyngula', el_mm: 2.7, hta_deg: 75, what: 'early motility; strong circulation; a single aortic arch pair' },
  { id: 'high-pec', h: 42, period: 'pharyngula', el_mm: 2.9, hta_deg: 55, what: 'pectoral-fin apical ridge prominent; heart chambers; mandibular and hyoid arches' },
  { id: 'long-pec', h: 48, period: 'hatching', el_mm: 3.1, hta_deg: 45, what: 'resting dorsal-up; about six melanophores in the lateral stripe; semicircular canals; neuromasts' },
  { id: 'pec-fin', h: 60, period: 'hatching', el_mm: 3.3, hta_deg: 35, what: 'movements too rapid to resolve; the pectoral fin is flattened with prominent circulation; early jaw cartilages' },
  { id: 'protruding-mouth', h: 72, period: 'hatching', el_mm: 3.5, hta_deg: 25, what: 'wide-open mouth protruding anterior to the eye; gill slits and filament buds; cleithrum. END OF EMBRYOGENESIS' },
];

/** Why cells are not dividing in lockstep - stated by the staging paper itself, not by us. */
export const ASYNCHRONY = {
  headline: 'Cells stop dividing in step at the midblastula transition, and the staging paper says so in its own definitions.',
  evidence: [
    { at: 'cleavage period (h 0.75 to 2.25)', what: 'cell cycles 2 to 7 are "rapid and synchronous"', source: `${CITATION}, Table 1` },
    { at: 'blastula period (from h 2.25)', what: '"rapid metasynchronous cycles 8, 9 give way to lengthened asynchronous ones at the midblastula transition"', source: `${CITATION}, Table 1` },
    { at: '1k-cell (h 3)', what: '"slight cell-cycle asynchrony"', source: `${CITATION}, Table 2` },
    { at: 'high (h 3.33)', what: '"substantial division asynchrony"', source: `${CITATION}, Table 2` },
  ],
  consequence_for_the_animation:
    'Before h 2.25 a synchronous animation is CORRECT and a staggered one would be wrong. After it, a ' +
    'synchronous animation is wrong. The transition is a published event at a published time, so the ' +
    'animation does not need a random number generator to look alive - and must not use one, because the ' +
    'staggering would then be decoration rather than biology.',
  hatching_too: {
    what: 'hatching is asynchronous as well, and the paper is blunt about it: individuals of one clutch hatch sporadically through the whole third day, and "the time of hatching is not useful as a staging index for the zebrafish".',
    consequence: 'a scene showing a clutch hatching together would be wrong. Hatched and unhatched siblings are generally equally developed, so hatching must not be used to drive the clock.',
    source: `${CITATION}, Hatching period`,
  },
};

export function stageAt(h) {
  let cur = STAGES[0];
  for (const s of STAGES) { if (s.h <= h) cur = s; else break; }
  return cur;
}

/** The whole timeline retimed for a temperature, with the extrapolation flag carried on every row. */
export function timeline(T = 28.5) {
  const r = rateAt(T);
  return {
    temperature_C: T,
    rate: r,
    stages: STAGES.map(s => ({ ...s, hours_at_this_temperature: r.rate_multiplier > 0 ? +(s.h / r.rate_multiplier).toPrecision(4) : null })),
    asynchrony: ASYNCHRONY,
    law: RATE_LAW,
    read_these_times_as: r.extrapolated
      ? 'ESTIMATES. The temperature is outside the window in which the retiming law was validated, so every hour in this table is an extrapolation of a published linear fit beyond its tested range.'
      : 'hours computed from a published linear law inside the range its authors tested. Still computed, not separately measured - only the 20-somite values at 25 C and 33 C are printed in the paper itself.',
  };
}
