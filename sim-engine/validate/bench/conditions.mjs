// THE CONDITION MATRIX: which variables get an arm of their own, which get a fixed value, and why.
//
// ============================== THE RULE THAT DECIDES WHAT GETS AN ARM ==============================
// An arm costs embryos, a needle, a full injection mix (quantities.injectionMix: nearly all of it wasted)
// and a slot in the analysis. So an arm has to buy something. The rule used here:
//
//   SPEND EMBRYOS WHERE THE PUBLISHED EVIDENCE IS CONTRADICTORY, OR ABSENT AT YOUR OPERATING POINT.
//   FIX EVERYTHING THE LITERATURE HAS SETTLED, AND CITE THE PAPER THAT SETTLED IT.
//
// This is the opposite of the instinct to vary everything. Varying a settled variable spends embryos to
// re-derive a published result; leaving a contradicted variable fixed means picking a side of a live
// disagreement by accident and never finding out. Each variable below therefore carries `arm: true|false`
// AND the evidence that decision rests on, so a lab that disagrees can see exactly what to overturn.
//
// ============================== A WARNING ABOUT DOSES IN THIS LITERATURE ==============================
// Published zebrafish Cas9 doses span roughly FIFTY-FOLD, and part of that spread is not biology. Several
// widely cited numbers are unusable: unit errors, arithmetic errors, a formally corrected concentration,
// a mass ratio that reads like a molar ratio, and papers that give a per-embryo mass but no injection
// volume, so the mass cannot be converted to a concentration in either direction. TRAPS below lists each
// one with its source. A matrix seeded from a literature scrape WILL pick some of these up.
//
// Danio rerio only.

export const DESIGN_RULE =
  'An arm exists where the published evidence is contradictory, or absent at this experiment\'s operating ' +
  'point. Everything the literature has settled is fixed at the published value and cited, not varied. ' +
  'Varying a settled variable spends embryos re-deriving a known result; fixing a contradicted one picks a ' +
  'side of a live disagreement by accident.';

export const VARIABLES = [
  {
    id: 'guide-dose', what: 'guide RNA concentration, at fixed Cas9',
    arm: true,
    why_an_arm: 'There is a published threshold and plateau, but they sit inside a fifty-fold spread of published doses, and the one clean titration is at ONE locus (tyr). Whether this experiment\'s locus has the same threshold is not published, and the arm is cheap because both levels share everything else.',
    levels: [
      { id: 'below-plateau', value: '1.5 uM guide', expect: 'not significantly different from control at tyr' },
      { id: 'at-plateau', value: '4.5 uM guide', expect: 'significant at tyr; higher doses bought nothing' },
    ],
    evidence: [
      { finding: 'a titration at 0.5 / 1.5 / 4.5 / 13.5 uM guide against fixed Cas9, scored as tyr pigment area: 0.5 and 1.5 uM not significant; 4.5 uM significant; 13.5 uM no better than 4.5 (retina p = 0.9427, body p = 0.9356). Threshold between 1.5 and 4.5 uM, plateau at 4.5.',
        citation: 'Zhao et al. 2021, Methods 194:37, doi 10.1016/j.ymeth.2020.12.004', kind: 'measured' },
      { finding: 'the best single condition reported there: 4.5 uM guide + 0.75 ug/uL Cas9, 1 nL into the cell, 93 % survival (57/61)', citation: 'Zhao et al. 2021', kind: 'measured' },
      { finding: 'for a knock-in, by contrast, there is NO single saturating dose: the optimum is target-dependent between 200 and 800 pg of Cas9 protein, and the authors state that establishing a statistically significant optimum per target is itself difficult. Indels rose monotonically to 800 pg (100 vs 800 pg, p < 0.001).',
        citation: 'Vanhooydonck et al. 2025', kind: 'measured', note: 'this directly contradicts recommending one dose for a knock-in arm, which is why the knock-in route keeps the dose arm.' },
      { finding: 'the full published spread, like for like: Cas9 protein 1.5 to ~31 uM (100 to 5029 pg per embryo); Cas9 mRNA 75 to 1200 ng/uL; guide 0.19 to 2500 pg; volume 0.5 to 4 nL. There is no consensus dose.', kind: 'measured, pooled across sources' },
    ],
  },
  {
    id: 'guide-number', what: 'how many guides per gene',
    arm: true,
    why_an_arm: 'It is the one variable that trades the thing you want (penetrance) against the thing that kills the experiment (dysmorphology), and the trade cannot be escaped by adjusting anything else - see the finding below, which is the single most useful number in this file.',
    levels: [
      { id: 'single-guide', value: '1 guide', expect: 'lower penetrance, low toxicity; penetrance depends enormously on WHICH guide (see controls.GUIDE_PLACEMENT)' },
      { id: 'multi-guide', value: '3-4 guides', expect: 'higher biallelic rate; toxicity still modest at 4' },
    ],
    evidence: [
      { finding: 'TOXICITY SCALES WITH DOUBLE-STRAND BREAKS, NOT WITH REAGENT MASS. Holding total guide and Cas9 mass CONSTANT and varying only guide number: about 7-15 % dysmorphic at 4 guides, rising to about 41 % at 8, 37.5 % at 12 and 42.7 % at 16 (p < 0.0001).',
        citation: 'Wu et al. 2018, Fig. S4B', kind: 'measured',
        consequence: 'a guide-number arm\'s cost CANNOT be mitigated by lowering concentration. This is why guide number gets its own arm and dose cannot stand in for it.' },
      { finding: 'independently: 8 pooled guides gave 54 % dysmorphic versus 12 % at 4 guides; survival 87 % versus 78 %', citation: 'Zhao et al. 2021', kind: 'measured' },
      { finding: 'the authors of the F0 method attribute the unviability to the cuts rather than to the chemistry: unviability was lower in scrambled-RNP controls than in F0 knockout siblings, "likely excluding chemical toxicity unrelated to Cas9-induced double-strand breaks"',
        citation: 'Kroll et al. 2021, doi 10.7554/eLife.59683', kind: 'measured, quoted' },
    ],
    caution: 'A widely repeated "up to 8 guides is fine" rule, with biallelic figures of 44/79/93/98 %, traces back to a general review (Hsu, Lander & Zhang, Cell 2014) and NOT to zebrafish primary data. The zebrafish numbers are the two rows above.',
  },
  {
    id: 'cas9-format', what: 'Cas9 as protein RNP, as mRNA, or expressed',
    arm: false,
    why_no_arm: 'Settled in favour of RNP for this purpose, and spending embryos to re-derive it buys nothing. Fix it at RNP and cite.',
    fixed_at: 'Cas9 protein as a ribonucleoprotein with synthetic guide',
    evidence: [{ finding: 'RNP injection gives higher and earlier activity in zebrafish embryos than mRNA', citation: 'Burger et al. 2016, Development 143:2025-2037, doi 10.1242/dev.134809', kind: 'measured' }],
    if_you_must_use_mrna: 'the mRNA route is cheaper per injection and slower to act (Jao, Wente & Chen 2013, doi 10.1073/pnas.1308335110). If a lab runs mRNA for cost reasons, the dose arm above does not transfer: the published mRNA range is 75-1200 ng/uL and is a different quantity.',
  },
  {
    id: 'guide-to-cas9-ratio', what: 'molar ratio of guide to Cas9',
    arm: false,
    why_no_arm: 'Settled, and settled in an unintuitive direction that saves money: Cas9 is the limiting factor, so buying extra guide buys nothing.',
    fixed_at: '1:1 molar',
    evidence: [{ finding: 'RNPs from 1:1 mixtures exhibited maximal activity; activity was "not enhanced nor diminished by incubation with a molar excess of RNA. Thus Cas9 is the factor limiting gRNP activity."', citation: 'Hoshijima et al., quoted', kind: 'measured, quoted' }],
    trap: 'One protocol states a "2:1 ratio of Cas9:sgRNA" as a MASS ratio, which is approximately 1:2 MOLAR - Cas9-limiting, the inverse of how it reads. Check which kind of ratio a protocol means before copying it.',
  },
  {
    id: 'kcl', what: 'potassium chloride concentration in the injection mix',
    arm: false,
    why_no_arm: 'Not a variable to explore - a CONFOUNDER to pin down and report. It is listed here because leaving it unstated silently breaks comparability with the published dose numbers the rest of this matrix rests on.',
    fixed_at: 'record it explicitly, and match the salt condition of whichever dose paper you are taking numbers from',
    evidence: [
      { finding: 'the saturation result that underpins the protein-dose numbers is conditioned on at least 300 mM KCl final, which "dramatically improved the solubility ... and limited aggregation in the injection mix and within the embryo cell"', citation: 'Burger et al. 2016', kind: 'measured, quoted' },
      { finding: 'published final KCl spans roughly 50 to 300 mM across protocols', kind: 'measured, pooled' },
    ],
    consequence: 'A dose arm run at 50 mM KCl is NOT comparable to the same dose at 300 mM. This may be part of why the published dose spread is fifty-fold at all.',
  },
  {
    id: 'donor-chemistry', what: 'ssODN strand and arm symmetry, for a point knock-in only',
    arm: true,
    applies_to: 'knock-in routes only',
    why_an_arm: 'This is the clearest case in the whole matrix: two zebrafish papers DISAGREE, neither isolates arm length from strand orientation, and an erratum to one of them was not read. The edit planner already emits both donors for exactly this reason. Spend the embryos here.',
    levels: [
      { id: 'symmetric', value: 'symmetric ssODN, 120 nt total', expect: 'Boel: arm length dominates; asymmetry did not help' },
      { id: 'asymmetric-antisense', value: 'anti-sense asymmetric ssODN', expect: 'Prykhozhij: 3- to 10-fold better' },
    ],
    evidence: [
      { finding: 'error-free HDR at 1-4 % of alleles, relatively constant across ssODN designs; arm LENGTH is the dominant factor; "asymmetrically designed templates did not result in better HDR rates"', citation: 'Boel et al. 2018, Dis Model Mech 11:dmm035352, doi 10.1242/dmm.035352', kind: 'measured' },
      { finding: 'anti-sense asymmetric templates were "substantially more efficient (3- to 10-fold)"', citation: 'Prykhozhij et al. 2018, Nucleic Acids Res 46:e102, doi 10.1093/nar/gky512', kind: 'measured',
        caveat: 'varied orientation and asymmetry TOGETHER, so the two cannot be separated. An erratum exists (doi 10.1093/nar/gky674) and was not read.' },
      { finding: 'optimal ssODN length 120 nt total, symmetric: 60 to 120 nt raised HDR significantly in 3 of 4 targets, maximum improvement tenfold; 180 nt was worse', citation: 'Boel et al. 2018', kind: 'measured' },
    ],
  },
  {
    id: 'temperature', what: 'rearing temperature',
    arm: false,
    why_no_arm: 'NOT because it is settled - because no zebrafish measurement of its effect on editing efficiency was found. An arm here would produce a number with nothing to compare it against.',
    fixed_at: 'standard husbandry (28.5 C), recorded',
    evidence: [{ finding: 'no published zebrafish measurement of rearing temperature against CRISPR editing efficiency was found in this search', kind: 'NOT FOUND - this is a gap in our search, not a proof that none exists' }],
  },
  {
    id: 'injection-site', what: 'into the yolk or into the cell at the one-cell stage',
    arm: false,
    why_no_arm: 'Published protocols split on this and the comparison exists, but the figure holding it could not be read in this run. Recorded as an access failure, not as a settled question.',
    fixed_at: 'whichever the lab routinely does, recorded explicitly',
    evidence: [{ finding: 'the yolk-versus-cell comparison is in Burger et al. 2016 Fig. S4, which was not accessible in this run. Published protocols use both: the F0 method papers inject into the yolk, the cleanest dose titration injected into the cell.', kind: 'NOT READ' }],
  },
];

// ---------------------------------------------------------------------------------------------------
// Numbers that must never seed a matrix. Each is a real published figure that is wrong, corrected, or
// not convertible - and each is the kind of thing a literature scrape picks up and propagates silently.
// ---------------------------------------------------------------------------------------------------
export const TRAPS = [
  { id: 'hruscha-sgrna-2400', what: 'an sgRNA concentration of 2400 ng/uL', why: 'it is 8 to 190 times every other published zebrafish value (12.5-300 ng/uL), and no injection volume is given so it cannot be cross-checked. Most likely a ug/ng unit error.', source: 'Hruscha et al. 2013' },
  { id: 'burger-mol-1e3', what: 'a stated molar amount for 900 ng of Cas9-EGFP', why: 'the paper prints 4.7e-9 mol; for 191.2 kDa it is 4.7e-12 mol (4.7 pmol). An arithmetic error of a thousand-fold, in an otherwise load-bearing paper.', source: 'Burger et al. 2016, doi 10.1242/dev.134809' },
  { id: 'spg-concentration-corrected', what: 'an sgRNA concentration of 30 ng/uL from the SpG/SpRY zebrafish paper', why: 'formally corrected to 200 ng/uL. Scraping the original gives the wrong number.', source: 'correction at doi 10.1038/s41467-023-36632-8' },
  { id: 'mass-ratio-read-as-molar', what: 'a "2:1 Cas9:sgRNA" ratio', why: 'it is a MASS ratio, about 1:2 molar - Cas9-limiting, the inverse of how it reads.', source: 'Sorlien et al.' },
  { id: 'eight-guide-rule', what: 'the "up to 8 guides" rule with 44/79/93/98 % biallelic figures', why: 'traces to a general review (Hsu, Lander & Zhang, Cell 2014), not to zebrafish primary data. The zebrafish numbers are Wu Fig. S4B and Zhao\'s 8-versus-4 comparison, and they are much less encouraging.', source: 'misattribution' },
  { id: 'no-volume-no-conversion', what: 'converting a per-embryo mass to a concentration, or back', why: 'injection volumes are simply absent from several of the most-cited papers (Jao 2013, Hruscha 2013, Moreno-Mateos 2015, Chang 2013), so their pg values cannot be converted in either direction. No such conversion should be performed.', source: 'multiple' },
  { id: 'mrna-toxicity-misattribution', what: 'citing Hruscha 2013 or Varshney 2015 for Cas9 mRNA toxicity', why: 'both contain zero toxicity, survival or mortality data, verified by term scans of both full texts, yet both are routinely cited for it.', source: 'misattribution' },
];

/** The only dose rules anyone actually states, quoted rather than paraphrased. These are stop conditions,
 *  not targets: they tell a lab when to abandon an injection session, which is what makes them useful. */
export const GUARDRAILS = [
  { quote: 'If the injection was too toxic (<50% normal embryos), try again with lower concentrations', source: 'Gagnon et al.' },
  { quote: 'less than 10% lethality is expected relative to the uninjected control', source: 'Sorlien et al.', applies_to: 'a non-essential gene' },
  { quote: 'more than 50% of the embryos in the injected group are expected to show normal development', source: 'Zhao et al. 2021' },
];

export const PRECISION_NOTE =
  'One toxicity series used here (Wu 2018 Fig. S2D: about 7.3 / 8.2 / 13.3 / 47.5 % dysmorphic at 100 / 250 ' +
  '/ 1000 / 2500 pg of guide, p < 0.0001 for trend) has NO PRINTED PERCENTAGES - the values were measured ' +
  'off the supplemental figure, reconstructing to within 0.1 pt against the printed n in three of four bars. ' +
  'Treat them as approximate to within a point or two. The panel also has no uninjected-control bar: 100 pg ' +
  'is the low comparator, not a control.';

// ---------------------------------------------------------------------------------------------------
// THE OVEREXPRESSION ROUTE (Tol2). A different experiment with different levers: there is no nuclease,
// no guide and no dose-to-efficiency curve. What varies is plasmid dose, and what matters far more than
// dose is that the two published controls are run in the same session, because the entire inferential
// weight of the published result rests on them (0/240 and n=32).
// ---------------------------------------------------------------------------------------------------
export const OVEREXPRESSION_ARMS = [
  { id: 'control:dsred-only', variable: null, level: 'dsred-only', value: 'ef1a:DsRed plasmid alone, same dose, same session',
    why: 'THE control that makes the result mean anything: 0 of 240 injected fish showed overgrowth, despite DsRed-positive cells throughout the fin. Without it, a patchy overgrowth call in injected fish is uninterpretable.',
    published_result: '0/240', citation: 'Perathoner et al. 2014, Results and Fig. S3' },
  { id: 'control:non-conductive', variable: null, level: 'GFG->AAA', value: 'ef1a:kcnk5b(GFGAAA) + ef1a:DsRed, same dose',
    why: 'the specificity control. The GFG selectivity filter mutated to AAA blocks K+ conductance (confirmed in oocytes), and gave no overgrowth in fins that did contain DsRed-positive tissue. It separates "the channel\'s conductance causes this" from "injecting a plasmid causes this".',
    published_result: 'no overgrowth, n = 32 fins with DsRed-positive tissue', citation: 'Perathoner et al. 2014, Results and Fig. 6H, 6J' },
  { id: 'plasmid-dose:low', variable: 'plasmid-dose', level: 'low', value: '5 ng/ul',
    expect: 'fewer transgene-positive fish, less mosaic burden, lower toxicity',
    why: 'the bottom of the published injection range. The paper gives a range (5-20 ng/ul) and does not report which end produced its numbers, so the range is the honest arm rather than a single number we would have had to invent.' },
  { id: 'plasmid-dose:high', variable: 'plasmid-dose', level: 'high', value: '20 ng/ul',
    expect: 'more transgene-positive fish per injection, at whatever toxicity cost the lab measures',
    why: 'the top of the published range. Which end to standardise on is the one thing this matrix is actually for.' },
];

export const OVEREXPRESSION_FIXED = [
  { id: 'promoter', fixed_at: 'ef1a (Xenopus laevis)', why_no_arm: 'chosen in the source because it was shown active in all major fin tissues. Changing it changes which cells express, which is a different experiment.' },
  { id: 'transposase-mrna-dose', fixed_at: '25 ng/ul', why_no_arm: 'published, single value, and not the lever under test.' },
  { id: 'injection-pressure-and-duration', fixed_at: '275 Pa (40 psi) for 100 ms', why_no_arm: 'published exactly. Rig-specific in practice, but there is no reason to vary it as an experimental arm.' },
  { id: 'allele', fixed_at: 'wild-type kcnk5b', why_no_arm: 'the source shows WILD-TYPE overexpression is sufficient for overgrowth, so wild type is the cheaper and equally informative construct for a sufficiency test. Using W169L instead answers nothing extra about sufficiency and costs an extra construct.' },
  { id: 'scoring-stage', fixed_at: 'adult', why_no_arm: 'the phenotype is an adult fin and barbel phenotype. There is no published earlier readout for this route.' },
];

export const OVEREXPRESSION_TRAPS = [
  { id: 'the-40-percent-denominator',
    the_number: 'about 40 % of injected fish showed local overgrowth',
    the_trap: 'the denominator is injected fish THAT SHOW DsRed-POSITIVE CELLS IN THE FINS, not injected fish and not injected embryos. The fraction of injected embryos that reach adulthood with fin-expressing clones is not published.',
    consequence: 'a lab budgeting embryos from 40 % will inject too few. Budget on embryos injected, and treat the transgene-positive fraction as something this session measures rather than inherits.' },
  { id: 'borrowed-stop-rules',
    the_trap: 'the published survival and lethality stop rules in GUARDRAILS were measured for NUCLEASE injections (protein or mRNA plus guide), not for plasmid plus transposase mRNA.',
    consequence: 'they are carried into this route as a borrowed rule, not a measured one. A plasmid route has its own toxicity profile and the session should record its own survival curve rather than assume these thresholds transfer.' },
  { id: 'mosaic-and-variegated',
    the_trap: 'clones are mosaic and the promoter variegates: in the source, some overgrown fins had no detectable DsRed at all (W169L 2/26, wt 2/11).',
    consequence: 'absence of the marker is not absence of the transgene. Scoring must allow for marker-negative overgrowth, and a PCR on the overgrown tissue is the arbiter, not the fluorescence.' },
];

export function overexpressionMatrix() {
  return {
    design: 'one-at-a-time over plasmid dose, with BOTH published controls in the same session',
    design_rule: DESIGN_RULE,
    route: 'overexpression',
    arms: OVEREXPRESSION_ARMS,
    n_arms: OVEREXPRESSION_ARMS.length,
    varied: [{ id: 'plasmid-dose', why: 'the source publishes a 4-fold range and does not say which end its numbers came from' }],
    deliberately_not_varied: OVEREXPRESSION_FIXED,
    guardrails: GUARDRAILS,
    guardrails_caveat: 'BORROWED. These stop rules were measured for nuclease injections; see OVEREXPRESSION_TRAPS.borrowed-stop-rules.',
    traps: OVEREXPRESSION_TRAPS,
    the_controls_are_not_optional:
      'In the other cases a control proves the injection worked. Here the controls ARE the experiment: a ' +
      'local, patchy overgrowth call in injected adults has no meaning except against the DsRed-only rate ' +
      '(published 0/240) and the conductance-dead rate (published no overgrowth at n = 32). A session that ' +
      'drops either control has not run this experiment, it has collected anecdotes.',
    cost_note:
      'Unlike the nuclease routes, the dominant cost here is not reagent but TIME: every arm must be raised ' +
      'to adulthood before it can be scored. Four arms of injected embryos is four tanks for about four months.',
  };
}

/** Build the arms for a case. Returns the arms AND the variables deliberately not varied, because a matrix
 *  that shows only what it varies hides the decisions that actually shaped it. */
export function matrix(kase, { knockin = false } = {}) {
  if (/tol2|transgenesis/i.test(kase?.edit?.kind ?? '')) return overexpressionMatrix();
  const applicable = VARIABLES.filter(v => !v.applies_to || (knockin && v.applies_to.startsWith('knock-in')));
  const armed = applicable.filter(v => v.arm);
  const fixed = applicable.filter(v => !v.arm);
  const arms = [];
  // One arm per level of each armed variable, holding the others at their first level: a one-at-a-time
  // design, not a full factorial. Stated plainly because a full factorial of 3 variables is 8+ mixes and
  // nobody reading a budget should have to infer which it was.
  for (const v of armed) for (const lvl of v.levels) {
    arms.push({ id: `${v.id}:${lvl.id}`, variable: v.id, level: lvl.id, value: lvl.value, expect: lvl.expect,
      others_held_at: armed.filter(o => o.id !== v.id).map(o => `${o.id}=${o.levels[0].id}`) });
  }
  const control = { id: 'control:buffer', variable: null, level: 'buffer-injected', value: 'injection buffer, no nuclease',
    why: 'survival and morphology baseline from the SAME clutch. Without it the toxicity numbers above cannot be applied to this session.' };
  return {
    design: 'one-at-a-time, not a full factorial',
    design_rule: DESIGN_RULE,
    arms: [control, ...arms],
    n_arms: arms.length + 1,
    varied: armed.map(v => ({ id: v.id, why: v.why_an_arm })),
    deliberately_not_varied: fixed.map(v => ({ id: v.id, fixed_at: v.fixed_at, why: v.why_no_arm })),
    guardrails: GUARDRAILS,
    traps: TRAPS,
    precision_note: PRECISION_NOTE,
    cost_note: 'Each arm is a separate injection mix. See quantities.injectionMix: the prepared volume, not the embryo count, is what the reagent budget scales with, so the number of arms IS the reagent cost.',
  };
}
