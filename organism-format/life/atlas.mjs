// THE CARNEGIE STAGING LAYER: make `carnegie_stage` usable without making it arithmetic.
//
// spec.mjs already declares `carnegie_stage` in TIME_UNITS and again in ORDINAL_UNITS, and
// TIME_UNIT_NOTES.carnegie_stage already says the mapping to days is "a range per stage, so a
// carnegie_stage time must not be arithmetic on". That is a correct instruction with nothing behind it:
// the format states the rule and ships no table, no range, and no function that stops anybody. This file
// is the enforcement, and the table it enforces against.
//
// ============================== THE ONE THING TO TAKE FROM THIS FILE ==============================
//
//   AN ATLAS IS A CROSS-SECTION ACROSS INDIVIDUALS. A .life IS A TRAJECTORY OF ONE.
//
// Those are different objects, and nothing in a .life file distinguishes them. A timeline is the claim
// that this state FOLLOWS that one - read.mjs refuses a timeline whose stages are out of order precisely
// because "follows" is a claim that can be false. In an atlas, no state follows any other, because no
// individual was observed twice. HESTA's 13 embryos were each sectioned once, at one Carnegie stage, and
// then they were gone. Thirteen embryos, twelve stages, and ZERO embryos observed at two stages.
//
// So a .life assembled from atlas stages is a composite: a trajectory of an animal that did not exist,
// stitched from thirteen that did. It is a perfectly reasonable thing to build and a disastrous thing to
// mistake for a record. compositeFromAtlas() builds it and stamps it `composite: true` in the document,
// because the alternative is a file that reads as an organism.
//
// ============================== WHAT WAS VERIFIED, AND WHAT THE SEARCH SUMMARY GOT WRONG ==============
//
// The task item arrived as a search summary. Every claim in it was checked. Most held; four did not.
//
//   HELD   Nature, May 2026. Pan J, Li Y, Lin Z, et al. "Spatiotemporal transcriptome atlas of human
//          embryos after gastrulation." Nature 654(8119):751-761, published 2026-05-27.
//          doi:10.1038/s41586-026-10545-0, PMID 42203883. 77 sagittal sections, 13 whole human embryos,
//          Carnegie stage 12 to 23, Stereo-seq integrated with snRNA-seq, "a regulatory profile for the
//          development of 50 organs and 198 substructures" - all four counts are the abstract's own.
//   HELD   db.cngb.org/hesta resolves, and its Analysis section does carry a Cross-Species Comparison
//          tool. The help page says it places HESTA (human) beside MOSTA (mouse) "on a shared
//          developmental-stage timeline", which is the exact temptation humanMouseCaution() exists for.
//   WRONG  The acronym. The portal's own title is "Human EARLY Embryogenesis Spatiotemporal
//          Transcriptomic Atlas"; the STOmicsDB dataset page (STDS0000394) drops "Early". The Nature
//          paper never uses "HESTA" at all. All three spellings are in SOURCES.
//   WRONG  "~4-8 weeks post-conception" is the right ballpark and the wrong vocabulary. O'Rahilly &
//          Müller 2010 say plainly: "The term gestational age is ambiguous and should be discarded",
//          and "Prenatal age is postfertilizational and hence some 2 weeks less than the postmenstrual
//          interval". Post-conception is not post-menstrual and the two differ by a fortnight, which is
//          most of a Carnegie stage at this end of development.
//   WRONG  "crown-rump length where standard". CRL is the FETAL measure. The Carnegie tables record
//          GREATEST LENGTH (GL). O'Rahilly & Müller 2010's own list of measurements is "the maximum
//          diameter of the chorionic sac, the crown-heel length, the greatest length exclusive of the
//          lower limbs, the biparietal diameter, the head circumference..." - crown-RUMP is not in it.
//          CARNEGIE therefore carries `greatest_length_mm`, and a `crown_rump_length_mm` field would
//          have been a wrong number under a familiar name. See LENGTH_IS_NOT_A_CRITERION.
//   WRONG  A second paper exists and the summary missed it: Pan J, et al. "Charting human organogenesis
//          across the Carnegie stages from a whole-embryo perspective." GigaScience 2026, giag063,
//          doi:10.1093/gigascience/giag063 - the database paper, cited by the portal itself. If you are
//          citing the RESOURCE rather than the finding, that is the one.
//
// ============================== WHY THERE IS NO POINT ESTIMATE ANYWHERE IN HERE ==============
//
// Carnegie staging is DEFINED BY MORPHOLOGY. A stage is assigned by what the embryo looks like, and
// O'Rahilly & Müller 2010 state the converse twice, in two directions:
//
//   "a stage should never be assigned merely on the basis of embryonic length"
//   "a stage should never be assigned merely on the basis of prenatal age"
//
// Age is a CONSEQUENCE of the stage, estimated afterwards and badly. So the day figure for a stage is a
// range, and the range is wide, and the two published conventions disagree about where it sits: the 1987
// convention gives single days (stage 12 = 26) and the 2010 revision gives ranges, several of them with
// the authors' own question marks (stage 10 = 28-30?). CARNEGIE therefore carries the UNION of the two,
// and both inputs verbatim beside it, because a range that excludes one published convention claims a
// precision the literature does not have. The union is in DAYS_SOURCE.
//
// One consequence worth stating: toDays() returns `unit: 'days_post_fertilisation'`, and that string is
// DELIBERATELY NOT one of SPEC.TIME_UNITS. 'dpf' is in TIME_UNITS; this is not 'dpf'. The point is that
// the output of this module cannot be pasted into a stage's `time_unit` field and pass read.mjs. If it
// could, the first caller who wanted a number on an axis would convert a Carnegie stage into days, write
// it as a time, and the ordinal rule would be gone with nothing left to detect its going.

import * as SPEC from './spec.mjs';
import * as ORGANISM from '../spec.mjs';

// ===================================================================================================
// sources
// ===================================================================================================

/** Every external claim this module makes, with what was checked and how. */
export const SOURCES = Object.freeze({
  staging_system: {
    primary: 'O\'Rahilly R, Müller F. Developmental Stages in Human Embryos. Carnegie Institution of Washington, Publication 637, 1987.',
    revision: 'O\'Rahilly R, Müller F. "Developmental stages in human embryos: revised and new measurements." Cells Tissues Organs 192(2):73-84, 2010. doi:10.1159/000289817, PMID 20185898.',
    verified: 'the 2010 abstract was read in full via PubMed. Every quotation in this file is from it. The 1987 monograph itself was NOT read.',
    origin: 'the scheme is Streeter\'s, completed by O\'Rahilly, who proposed the term "Carnegie stages" - the 2010 abstract\'s own account of its provenance.',
  },
  day_estimates: {
    table: 'Endowment for Human Development, Virtual Human Embryo age table (ehd.org/virtual-human-embryo/ages.php), which prints the 1987 and the 2010 postfertilisation age estimates side by side, plus greatest length in mm.',
    verified: 'fetched 2026-11-06. It is a SECONDARY compilation of O\'Rahilly & Müller, not the primary table, and it is the reason both conventions are carried here rather than one.',
    caveat: 'EHD states it "adopts the convention set forth by O\'Rahilly and Müller in 1987 which has received widespread, but not universal, acceptance". Not universal is the operative phrase.',
  },
  the_atlas: {
    finding_paper: 'Pan J, Li Y, Lin Z, et al. "Spatiotemporal transcriptome atlas of human embryos after gastrulation." Nature 654(8119):751-761, 2026-05-27. doi:10.1038/s41586-026-10545-0, PMID 42203883.',
    resource_paper: 'Pan J, et al. "Charting human organogenesis across the Carnegie stages from a whole-embryo perspective." GigaScience 2026, giag063. doi:10.1093/gigascience/giag063.',
    portal: 'https://db.cngb.org/hesta/ - resolves. Dataset STDS0000394, project STT0000025, GEO series GSE326326.',
    names_in_use: [
      '"Human Early Embryogenesis Spatiotemporal Transcriptomic Atlas" - the portal\'s own title',
      '"Human Embryogenesis Spatiotemporal Transcriptomic Atlas" - the STOmicsDB dataset page',
      '(no acronym at all) - the Nature paper',
    ],
    verified: 'abstract read via PubMed; portal landing page and help page fetched 2026-11-06. The full text was NOT read, so every count here is the abstract\'s or the portal\'s.',
  },
  the_mouse_atlas: {
    citation: 'Chen A, Liao S, Cheng M, et al. "Spatiotemporal transcriptomic atlas of mouse organogenesis using DNA nanoball-patterned arrays." Cell 185(10):1777-1792.e21, 2022. doi:10.1016/j.cell.2022.04.003, PMID 35512705. This is MOSTA.',
    what_its_abstract_says: 'it maps "mid- and late-gestation" mouse embryos. Those are the paper\'s own words.',
    not_verified: 'the specific embryonic days MOSTA covers were NOT confirmed in this session. The figure usually quoted is E9.5 to E16.5 at daily intervals; the Cell abstract does not say so and the STOmicsDB record (STDS0000058) does not list them. Treat the E-day span as unchecked.',
  },
  heterochrony: {
    citation: 'Workman AD, Charvet CJ, Clancy B, Darlington RB, Finlay BL. "Modeling transformations of neurodevelopmental sequences across mammalian species." J Neurosci 33(17):7368-7383, 2013. doi:10.1523/JNEUROSCI.5746-12.2013, PMID 23616543.',
    verified: 'abstract read via PubMed. 18 mammalian species, 271 developmental events.',
    why_it_is_the_right_citation: 'it is the quantitative statement of exactly the thing a stage-matching slider hides: the model needs a species-specific RATE term AND event-specific residuals, and the paper names the residuals - "delay of corticogenesis in all species but rodents and the rabbit", "selective delay of retinogenesis in the cat". An event-specific residual IS heterochrony. If one global rescaling sufficed, there would be no residuals to report.',
  },
});

// ===================================================================================================
// 1. CARNEGIE
// ===================================================================================================

/**
 * What a stage row means, before the rows.
 *
 * `days` is the UNION of the 1987 and 2010 postfertilisation estimates, each read as a closed interval
 * and a bare day read as a degenerate one. `age_1987` and `age_2010` are the source strings verbatim,
 * question marks included, so a caller who wants one convention can have it and can see that choosing it
 * was a choice.
 */
export const DAYS_SOURCE = Object.freeze({
  rule: 'days.lo = min(1987 estimate, 2010 estimate); days.hi = max(the two). Both are postfertilisation.',
  why_the_union: 'the two conventions disagree by up to five days (stage 6: 1987 says 13, 2010 says 16-18?). A table that printed only one would be narrower than the literature and would not say so.',
  why_not_the_2010_alone: 'it is the current revision and it is the better number, but it is not a replacement that the field has uniformly adopted - EHD calls the 1987 convention "widespread, but not universal". Somebody\'s 26-day stage-12 embryo is staged under 1987 and this table has to contain it.',
  question_marks: 'the "?" in the 2010 column is the authors\' own. Stages 6, 7 and 10 carry it on the whole-stage figure, and stage 5 carries it on two of its three substage figures. Those four rows are flagged `source_uncertain`.',
  the_one_row_that_is_not_a_union: 'stage 1. Both conventions print the single day "1", so the union is degenerate. A zero-width range would be a point estimate wearing a range\'s clothes, so the row is widened to 0-1 and flagged `widened_from_a_point`: stage 1 is the unicellular zygote, which begins at fertilisation (day 0 by definition of the convention) and ends at first cleavage. See that row\'s note.',
});

/** Length is recorded and is NOT a staging criterion, and the difference has bitten people. */
export const LENGTH_IS_NOT_A_CRITERION =
  'O\'Rahilly & Müller 2010: "Prenatal measurements are not an integral component of the staging system, ' +
  'and hence a stage should never be assigned merely on the basis of embryonic length. A 20-mm embryo, ' +
  'for example, could belong to any of three stages." The lengths in this table are DESCRIPTIVE - what ' +
  'embryos at that stage have measured - and they are GREATEST LENGTH, not crown-rump length, which is ' +
  'the fetal measure. Inverting the table to stage an embryo from its length is the error the authors ' +
  'wrote that sentence to prevent, and 20 mm spans three stages, so it is not even close.';

/** Stages 19-23 cannot be told apart from the outside, which is a limit on who may assign them. */
export const EXTERNAL_CRITERIA_ARE_NOT_ENOUGH =
  'O\'Rahilly & Müller 2010: "The system is based on internal as well as external features, and the use ' +
  'of only external criteria is subject to serious limitations. For example, precise delineation of ' +
  'stages 19-23 and of the embryonic-fetal transition depends on histological examination." The ' +
  '`criteria` line in each row below is mostly EXTERNAL, because that is what a one-line summary can ' +
  'hold. For stages 19-23 that line is therefore not sufficient to assign the stage, and a staging made ' +
  'from it is a guess. HESTA\'s range is 12-23, so this applies to five of its twelve stages.';

const st = (stage, lo, hi, age_1987, age_2010, glLo, glHi, criteria, extra = {}) => Object.freeze({
  stage,
  days: Object.freeze({ lo, hi, unit: 'days_post_fertilisation' }),
  age_1987,
  age_2010,
  greatest_length_mm: glLo === null ? null : Object.freeze({ lo: glLo, hi: glHi }),
  criteria,
  ...extra,
});

/**
 * Carnegie stages 1-23.
 *
 * `criteria` is one line of standard embryology per stage, compiled from O'Rahilly & Müller's scheme as
 * it is summarised in the standard secondary tables. IT WAS NOT CHECKED LINE BY LINE AGAINST THE
 * CARNEGIE PLATES OR THE 1987 MONOGRAPH, and `criteria_verified` says so on every row. One row in a
 * widely-mirrored public table reads "stage 17: embryo implantation in the posterior uterine wall",
 * which is stage 5's business and not stage 17's - so the secondary tables are wrong somewhere, and
 * "compiled from secondary tables" is the strongest claim available here. Somite counts are the
 * conventional ones and carry the same caveat.
 *
 * `days` is sourced; `criteria` is compiled. They are not the same strength of claim and the row says so.
 */
export const CARNEGIE = Object.freeze([
  st(1, 0, 1, '1', '1', 0.1, 0.15,
    'fertilisation; the unicellular zygote - pronuclei, syngamy, second polar body. Substages 1a-1c.',
    { widened_from_a_point: true, note: 'both conventions print the bare day "1". Stage 1 begins at fertilisation, which is day 0 of the postfertilisation convention by construction, and ends at first cleavage, conventionally within the first day. 0-1 is the interval the point "1" abbreviates; it is not an independent measurement.' }),
  st(2, 1.5, 3, '1½–3', '2–3', 0.1, 0.2,
    'cleavage without growth, 2 to about 16 cells; morula; compaction begins around the 8-cell stage.'),
  st(3, 4, 5, '4', '4–5', 0.1, 0.2,
    'free blastocyst: a cavity appears, trophoblast and embryoblast are distinguishable, zona pellucida being shed.'),
  st(4, 5, 6, '5–6', '6', 0.1, 0.2,
    'blastocyst attaching to the endometrial epithelium; trophoblast begins to invade.'),
  st(5, 7, 12, '7–12', '(substages only: 7–8, 9?, 11–12?)', 0.1, 0.2,
    'implanted but previllous; bilaminar embryonic disc, amniotic cavity, primary then secondary yolk sac. Substages 5a solid trophoblast, 5b trophoblastic lacunae, 5c lacunar vascular circle.',
    { source_uncertain: true, note: 'the 2010 revision gives no whole-stage figure for 5, only substage figures, two of them with the authors\' question marks. The 7-12 range here is the 1987 whole-stage figure and the 2010 substages happen to fall inside it.' }),
  st(6, 13, 18, '13', '16–18?', 0.2, 0.2,
    'chorionic villi appear; primitive streak and primitive groove - gastrulation begins.',
    { source_uncertain: true, note: 'the widest disagreement in the table: 1987 says day 13, the 2010 revision says 16-18 with its own question mark. Five days, at a stage that lasts about three.' }),
  st(7, 16, 21, '16', '18–21?', 0.4, 0.4,
    'notochordal process; neural plate; primitive node. Haematopoiesis beginning in the yolk sac.',
    { source_uncertain: true }),
  st(8, 18, 25, '18', '21–25', 1.0, 1.5,
    'primitive pit and notochordal canal; neural groove deepening; first somite not yet formed.'),
  st(9, 20, 27, '20', '25–27', 1.5, 2.5,
    '1-3 somites; neural folds begin to elevate; cardiac primordium and first heart tubes; otic disc.',
    { somites: '1–3' }),
  st(10, 22, 30, '22', '28–30?', 2, 3.5,
    '4-12 somites; neural folds begin to fuse; two pharyngeal arches; cardiac loop forming.',
    { somites: '4–12', source_uncertain: true }),
  st(11, 24, 30, '24', '28–30', 2.5, 4.5,
    '13-20 somites; rostral neuropore closes; optic vesicle; sinus venosus; mesonephric duct.',
    { somites: '13–20' }),
  st(12, 26, 31, '26', '29–31', 3, 5,
    '21-29 somites; caudal neuropore closes; UPPER LIMB BUDS appear; three (then four) pharyngeal arches.',
    { somites: '21–29', note: 'the first HESTA stage. Upper limb buds are the usual external cue.' }),
  st(13, 28, 33, '28', '30–33', 4, 6,
    '30 or more somites; LOWER LIMB BUDS appear, so four limb buds; lens plate; otic vesicle closed; septum primum.',
    { somites: '30+' }),
  st(14, 32, 35, '32', '33–35', 5, 7,
    'lens pit and optic cup; upper limb buds elongate and become paddle-shaped; ureteric bud; cerebral vesicles appearing.'),
  st(15, 33, 37, '33', '35–37', 7, 9,
    'HAND PLATE on the upper limb; lens vesicle closed; cerebral vesicles distinct; nasal pit forming.'),
  st(16, 37, 40, '37', '37–40', 8, 11,
    'FOOT PLATE on the lower limb; retinal pigment visible externally; nasal pit faces ventrally; auricular hillocks beginning.'),
  st(17, 39, 42, '41', '39–42', 11, 14,
    'FINGER RAYS on the hand plate; auricular hillocks distinct; head relatively larger; trunk straightening.',
    { note: 'the only row where the 2010 revision moved the estimate EARLIER than 1987 and widened it: 41 becomes 39-42.' }),
  st(18, 42, 45, '44', '42–45', 13, 17,
    'TOE RAYS on the foot plate; elbow region distinguishable; eyelid folds beginning; body more cuboidal; septum secundum.'),
  st(19, 45, 47.5, '47½', '45–47', 16, 18,
    'trunk elongates and straightens; limbs extend ventrally; cartilage models of the limb bones.',
    { external_criteria_insufficient: true }),
  st(20, 47, 50.5, '50½', '47–50', 18, 22,
    'upper limbs bent at the elbow, hands over the cardiac region; scalp vascular plexus appearing.',
    { external_criteria_insufficient: true }),
  st(21, 49, 52, '52', '49–52', 22, 24,
    'hands and feet approach each other; fingers longer; webbed digits on the hand plate; digital rays on the foot plate.',
    { external_criteria_insufficient: true }),
  st(22, 52, 55, '54', '52–55', 23, 28,
    'fingers separated; webbed digits on the foot plate; eyelids and external ears better developed.',
    { external_criteria_insufficient: true }),
  st(23, 53, 58, '56½', '53–58', 27, 31,
    'head rounded; limbs longer, fingers and toes free; eyelids and external ears formed; intestines herniated into the cord. End of the embryonic period.',
    { external_criteria_insufficient: true, note: 'the last HESTA stage, and the end of the embryonic period - after this it is a fetus and CRL becomes the standard measure.' }),
].map(row => Object.freeze({ ...row, criteria_verified: false, criteria_source: 'compiled from standard secondary Carnegie tables (UNSW Embryology, EHD, Wikipedia\'s O\'Rahilly-derived table), NOT checked against the 1987 monograph or the Carnegie plates' })));

/** Lookup by stage number. Stage numbers are 1-23 and there is no stage 0 and no stage 24. */
const BY_STAGE = new Map(CARNEGIE.map(r => [r.stage, r]));

export const STAGE_RANGE = Object.freeze({ lo: 1, hi: 23, count: 23 });

/**
 * The shape of the day ranges, stated as prose so the test can hold the prose against the data.
 *
 * A claim about a table that lives next to the table rots quietly. These three are checked in
 * test-atlas.mjs against CARNEGIE itself, so when a row changes the claim fails rather than ages.
 */
export const RANGE_SHAPE = Object.freeze({
  lo_strictly_increases: true,
  hi_is_non_decreasing_but_not_strict: true,
  where_hi_ties: 'stages 10 and 11 both end at day 30 (2010 gives 28-30? and 28-30). hi is non-decreasing, NOT strictly increasing, and a test that asserted strict increase would fail on real data.',
  adjacent_ranges_overlap: true,
  overlap_detail: 'adjacent ranges overlap or touch for every pair from 3→4 onward EXCEPT 4→5 and 5→6, which are separated by a one-day gap, as are 1→2 and 2→3. Four gaps, eighteen overlaps or touches, out of twenty-two adjacent pairs.',
  why_overlap_is_not_a_bug: 'overlapping ranges are what it means for age not to determine stage. On day 30 an embryo may be stage 11, 12 or 13, and which one it is depends on whether its caudal neuropore has closed and whether it has lower limb buds. That is the staging system working as designed. A table with disjoint ranges would be a table you could invert, and O\'Rahilly & Müller say twice that you must not.',
  every_range_has_width: 'hi > lo on every row, including stage 1 - see DAYS_SOURCE.the_one_row_that_is_not_a_union.',
});

// ===================================================================================================
// 2. toDays
// ===================================================================================================

const WHY_NOT_A_POINT =
  'a point estimate would be a fabrication. Carnegie staging is defined by MORPHOLOGY - O\'Rahilly & ' +
  'Müller 2010: "a stage should never be assigned merely on the basis of prenatal age" - so the age of a ' +
  'staged embryo is inferred after the fact, from a population, and the two published conventions ' +
  'disagree about it by up to five days. Any single number here would be a choice of convention, a ' +
  'midpoint of a range, or an invention, and the caller could not tell which. So: a range, always, and a ' +
  'unit string that cannot be written into a .life `time_unit` field.';

/**
 * The day range for a Carnegie stage. A RANGE. There is no overload that returns a number.
 *
 * @param {number|string} stage 1-23. 'CS12', 12, '12' all work; 12.5 does not, because there is no such
 *        stage and a reader who passed 12.5 was interpolating.
 * @returns {{lo:number,hi:number,unit:string,stage:number,why:string}} on success, or
 *          {{refused:true,...}} with a reason. Never a scalar, on either path.
 */
export function toDays(stage) {
  const n = parseStage(stage);
  if (n.refused) return Object.freeze({ ...n, lo: null, hi: null, unit: 'days_post_fertilisation', why: WHY_NOT_A_POINT });
  const row = BY_STAGE.get(n.stage);
  return Object.freeze({
    refused: false,
    stage: row.stage,
    lo: row.days.lo,
    hi: row.days.hi,
    unit: 'days_post_fertilisation',
    width_days: row.days.hi - row.days.lo,
    age_1987: row.age_1987,
    age_2010: row.age_2010,
    source_uncertain: row.source_uncertain === true,
    why: WHY_NOT_A_POINT,
    why_this_unit_string: 'not "dpf" and not "days", both of which are in SPEC.TIME_UNITS. This string is deliberately not a legal `time_unit`, so a day range cannot be written into a stage as a time and launder an ordinal into a clock.',
    overlaps: CARNEGIE.filter(r => r.stage !== row.stage && r.days.lo <= row.days.hi && r.days.hi >= row.days.lo).map(r => r.stage),
    and_overlapping_means: 'on a day inside this range the embryo may equally be any of the overlapping stages. The range does not identify the stage and the stage does not identify the day.',
  });
}

/** Accept 12, '12', 'CS12', 'carnegie 12'; refuse 12.5, 0, 24, 'twelve'. */
function parseStage(stage) {
  if (typeof stage === 'number') {
    if (!Number.isInteger(stage)) {
      return { refused: true, stage: null, why_refused: `${stage} is not a Carnegie stage. There is no stage between 12 and 13 - the stages are a finite ordered set of morphologies, not a scale - so a fractional stage is an interpolation, and ${SPEC.REFUSALS.no_interpolated_stage}` };
    }
    if (!BY_STAGE.has(stage)) {
      return { refused: true, stage: null, why_refused: `stage ${stage} does not exist: Carnegie stages run ${STAGE_RANGE.lo} to ${STAGE_RANGE.hi}. Stage 23 is the end of the embryonic period; after it the organism is a fetus and is not Carnegie-staged at all.` };
    }
    return { refused: false, stage };
  }
  if (typeof stage === 'string') {
    const m = /^\s*(?:cs|carnegie(?:[ _-]?stage)?)?[ _-]?(\d+(?:\.\d+)?)\s*$/i.exec(stage);
    if (!m) return { refused: true, stage: null, why_refused: `${JSON.stringify(stage)} is not a Carnegie stage. Accepted: 12, "12", "CS12", "carnegie stage 12".` };
    return parseStage(Number(m[1]));
  }
  if (stage && typeof stage === 'object' && 'stage' in stage) return parseStage(stage.stage);
  return { refused: true, stage: null, why_refused: `a Carnegie stage is a number or a string naming one; got ${stage === null ? 'null' : typeof stage}.` };
}

/** Exported so a caller can validate without getting a range back. */
export function isStage(stage) { return parseStage(stage).refused === false; }

// ===================================================================================================
// 3. refuseArithmetic
// ===================================================================================================

/**
 * SPEC.REFUSALS.no_cross_unit_distance ends with: "Carnegie 12 minus Carnegie 10 is not 2 of anything."
 * This is the function that stops it, and it refuses UNCONDITIONALLY - a valid pair of stages is not
 * permission, it is just a pair.
 *
 * AND A FINDING ABOUT THE SPEC, since the sentence is filed in the wrong refusal. `no_cross_unit_distance`
 * is about comparing ACROSS units; "Carnegie 12 minus Carnegie 10" is arithmetic WITHIN one unit, and
 * nothing in spec.mjs forbids it. The rule the spec needs and does not have is `no_ordinal_arithmetic`.
 * It is stated here, in OPERATIONS, and spec.mjs should grow it.
 *
 * @param {*} a first stage
 * @param {*} b second stage
 * @param {string} [op] which operation was attempted. Omitted, every operation is refused at once.
 * @returns {{refused:true,...}} always. There is no success path and that is the point.
 */
export function refuseArithmetic(a, b, op = 'any') {
  const key = String(op).trim().toLowerCase();
  const known = Object.prototype.hasOwnProperty.call(OPERATIONS, key);
  const pa = parseStage(a), pb = parseStage(b);
  const bothValid = !pa.refused && !pb.refused;
  const ranges = bothValid
    ? { a: { stage: pa.stage, ...BY_STAGE.get(pa.stage).days }, b: { stage: pb.stage, ...BY_STAGE.get(pb.stage).days } }
    : null;

  return Object.freeze({
    refused: true,
    operation: key,
    operation_recognised: known,
    operands: [a, b],
    operands_are_valid_stages: bothValid,
    why: known ? OPERATIONS[key] : OPERATIONS.any,
    why_validity_is_not_permission:
      'both operands being real Carnegie stages makes the refusal MORE necessary, not less. An invalid ' +
      'operand would have been caught by anything; a valid one produces a plausible number. 12 - 10 = 2 ' +
      'is arithmetically fine and biologically meaningless.',
    the_spec_rule: SPEC.REFUSALS.no_cross_unit_distance,
    the_spec_rule_is_misfiled:
      '"Carnegie 12 minus Carnegie 10 is not 2 of anything" sits under no_cross_unit_distance, but that ' +
      'subtraction is within a SINGLE unit. spec.mjs has no rule against arithmetic inside an ordinal ' +
      'unit. It needs one; see OPERATIONS.',
    operations_refused: Object.freeze(Object.keys(OPERATIONS).filter(k => k !== 'any')),
    what_to_do_instead: ranges
      ? `if you want a duration, take toDays(${ranges.a.stage}) and toDays(${ranges.b.stage}) and report the two ranges, or their union via spanOf. The elapsed days from stage ${ranges.a.stage} (${ranges.a.lo}-${ranges.a.hi} d) to stage ${ranges.b.stage} (${ranges.b.lo}-${ranges.b.hi} d) could be anything from ${fmt(ranges.b.lo - ranges.a.hi)} to ${fmt(ranges.b.hi - ranges.a.lo)} days - a negative lower bound means the ranges overlap and the later-numbered stage may have the earlier day. That is why nobody should want a single number for it.`
      : 'nothing: one or both operands is not a Carnegie stage, so there is no range to report either. ' + (pa.why_refused ?? pb.why_refused),
    day_ranges: ranges,
  });
}

function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

/** Every operation refused, each with the reason specific to it. A shared reason hides the differences. */
export const OPERATIONS = Object.freeze({
  subtract:
    'Carnegie 12 minus Carnegie 10 is not 2 of anything. The stages are an ORDERED SET OF MORPHOLOGIES ' +
    '(SPEC.ORDINAL_UNITS), so the labels are ranks and the interval between consecutive ranks is not ' +
    'constant: by the union table, stage 11 to 12 is about two days and stage 5 to 6 is about five. ' +
    'Subtracting ranks produces a number with no unit, and the caller will read it as days.',
  difference: 'see subtract. A difference of ordinals is a difference of rank, and nothing in the file says so.',
  average:
    'the mean of stage 12 and stage 16 is not stage 14. An average presumes the labels are equally ' +
    'spaced on some underlying quantity, and the whole content of a morphological staging is that they ' +
    'are not - the stages were cut where the embryo visibly changes, not where the clock ticks. The mean ' +
    'of two ranks is a rank that may not exist and, when it does, denotes a morphology nobody averaged.',
  mean: 'see average.',
  midpoint: 'see average. A midpoint of two stages is an average wearing a geometric word.',
  interpolate:
    'there is no state between Carnegie 12 and Carnegie 13. The stages are consecutive descriptions of ' +
    'an embryo, and "halfway" between two descriptions is not a description. ' + SPEC.REFUSALS.no_interpolated_stage,
  lerp: 'see interpolate.',
  scale: 'multiplying a rank by a number produces a rank in no system. 2 x Carnegie 10 is not Carnegie 20 and is not twice anything.',
  ratio: 'Carnegie 20 is not twice as developed as Carnegie 10. A ratio of ordinals requires a true zero, and there is no stage 0 - stage 1 is fertilisation, which is the origin of the clock, not of the scale.',
  divide: 'see ratio.',
  add: 'stage 12 plus 4 is stage 16 only in the sense that it is four places along the list. It is not four of any unit, and a caller who wanted "four stages later" should index the list and say so.',
  sum: 'see add. A sum of ordinals is arithmetic on labels.',
  any:
    'arithmetic on Carnegie stages is refused. They are an ORDINAL unit (SPEC.ORDINAL_UNITS): ordered, ' +
    'comparable, and not subtractable, averageable, interpolatable or scalable. Order is all the ' +
    'structure there is. Use toDays() for a day RANGE per stage, and spanOf() for the union across a set.',
});

// ===================================================================================================
// 4. spanOf
// ===================================================================================================

/**
 * The day range a SET of Carnegie stages could span: lo of the earliest, hi of the latest.
 *
 * This is a UNION of ranges and it is wider than any individual's development, for two compounding
 * reasons. First, each stage's own range already covers the disagreement between conventions and the
 * spread of a population. Second, the earliest possible day of the first stage and the latest possible
 * day of the last cannot both be true of one embryo: an embryo at the fast end of stage 12 is at the fast
 * end of stage 23 too. The union is the envelope of what any embryo could have done, and no embryo did
 * all of it.
 */
export function spanOf(stages) {
  const list = Array.isArray(stages) ? stages : [stages];
  if (!list.length) {
    return Object.freeze({
      nothing_checked: true, lo: null, hi: null, unit: 'days_post_fertilisation', stages: [],
      why_nothing_checked: 'an empty set of stages spans nothing. Zero width is not a narrow span, it is an absent one.',
    });
  }
  const parsed = list.map(s => parseStage(s));
  const bad = parsed.filter(p => p.refused);
  if (bad.length) {
    return Object.freeze({
      refused: true, lo: null, hi: null, unit: 'days_post_fertilisation',
      stages: list, bad_count: bad.length,
      why_refused: `${bad.length} of ${list.length} operand(s) are not Carnegie stages, and a span computed from the rest would silently be a span of a different set. First: ${bad[0].why_refused}`,
    });
  }
  const nums = [...new Set(parsed.map(p => p.stage))].sort((x, y) => x - y);
  const rows = nums.map(n => BY_STAGE.get(n));
  const lo = Math.min(...rows.map(r => r.days.lo));
  const hi = Math.max(...rows.map(r => r.days.hi));
  const earliest = rows.find(r => r.days.lo === lo).stage;
  const latest = rows.find(r => r.days.hi === hi).stage;
  const gapsInside = [];
  for (let i = nums[0]; i < nums[nums.length - 1]; i++) if (!nums.includes(i)) gapsInside.push(i);

  return Object.freeze({
    nothing_checked: false,
    refused: false,
    lo, hi,
    unit: 'days_post_fertilisation',
    width_days: hi - lo,
    stages: Object.freeze(nums),
    earliest_stage: earliest,
    latest_stage: latest,
    is_union_of_ranges: true,
    single_stage: nums.length === 1,
    why_union: nums.length === 1
      ? `one stage, so the span IS that stage's own range (${lo}-${hi} d). It is still a range, and it is still wider than any one embryo's time at that stage, because the width is the disagreement between conventions plus the spread of a population.`
      : `the union of ${nums.length} stage ranges: lo from stage ${earliest}, hi from stage ${latest}. It is NOT a duration and NOT an interval any embryo occupied.`,
    wider_than_any_embryo:
      'the lo and the hi cannot both be true of one individual. An embryo at the early edge of its ' +
      'earliest stage is an early-developing embryo and will be at the early edge of its latest stage ' +
      'too, so the real elapsed time is narrower than hi - lo. This number is an ENVELOPE over ' +
      'individuals, not a measurement of one.',
    and_it_is_wider_still_if_the_stages_came_from_an_atlas:
      'if these stages are atlas stages, they are stages of DIFFERENT individuals. Then hi - lo is not ' +
      'even an envelope over one animal\'s development - it is the range of ages at which a collection ' +
      'of animals was collected. See WHAT_AN_ATLAS_IS_NOT.',
    gaps_in_the_set: Object.freeze(gapsInside),
    gaps_note: gapsInside.length
      ? `stages ${gapsInside.join(', ')} lie inside the span and are not in the set. The span covers days the set does not sample, and interpolating across the gap is ${JSON.stringify('no_interpolated_stage')}.`
      : null,
    per_stage: Object.freeze(rows.map(r => Object.freeze({ stage: r.stage, lo: r.days.lo, hi: r.days.hi }))),
  });
}

// ===================================================================================================
// 5. humanMouseCaution
// ===================================================================================================

const HUMAN_MOUSE_CAUTION = Object.freeze({
  headline:
    'A human Carnegie stage does not map onto a mouse embryonic day, and there is no table that fixes ' +
    'it. HESTA\'s Cross-Species Comparison tool places HESTA beside MOSTA "on a shared ' +
    'developmental-stage timeline" (the portal\'s help text). That shared timeline is an ALIGNMENT ' +
    'CHOICE, not a measurement, and the tool does not carry its own error bars.',

  the_three_reasons: Object.freeze([
    'ORGANOGENESIS IS NOT A UNIFORM TIME RESCALING. Human embryogenesis is not mouse embryogenesis ' +
    'played slowly. Workman et al. 2013 fit 271 developmental events across 18 mammals and needed, ' +
    'beyond a species-specific RATE term, event-specific residuals - which is the formal name for ' +
    'heterochrony. If one global stretch factor sufficed there would be no residuals to fit.',

    'DIFFERENT ORGANS ARE HETEROCHRONIC BETWEEN THE TWO SPECIES. The residuals in Workman et al. are ' +
    'organ- and system-specific: "delay of corticogenesis in all species but rodents and the rabbit, ' +
    'associated with relatively larger cortices in species with delay", and "selective delay of ' +
    'retinogenesis in the cat, associated with greater numbers of rods in its retina". Human cortical ' +
    'neurogenesis is delayed relative to the rest of human development in exactly the way mouse ' +
    'cortical neurogenesis is not. So the brain and the limb do not agree about what mouse day a human ' +
    'stage corresponds to.',

    'A CORRESPONDENCE THAT HOLDS FOR ONE ORGAN FAILS FOR ANOTHER, AND SILENTLY. This is the practical ' +
    'consequence and it is worse than the first two, because the failure has no symptom. Align the two ' +
    'atlases on limb-bud morphology and the cortices are mismatched; align on cortical progenitor ' +
    'markers and the limbs are. Either alignment yields a side-by-side display of two real sections, ' +
    'both correctly labelled, and the mismatch is invisible in the picture. A gene that looks ' +
    'conserved may be conserved; or it may be that the alignment put the stages where that gene agrees.',
  ]),

  what_a_shared_timeline_cannot_be:
    'it cannot be a conversion. There is no function from carnegie_stage to mouse E-day, because the ' +
    'two are indexed on different things: Carnegie stages are morphological ranks (SPEC.ORDINAL_UNITS) ' +
    'and mouse E-days are a clock offset from the plug (SPEC.TIME_UNIT_NOTES.E: "an offset convention, ' +
    'not a clock"). Even within mouse, E10.5 in one colony is not E10.5 in another - strain and litter ' +
    'size move it. Converting an ordinal rank into an offset convention is two coercions, and ' +
    'SPEC.REFUSALS.no_cross_unit_distance forbids the first one outright: "ordinal units are never ' +
    'converted at all".',

  what_it_can_legitimately_be:
    'a stated hypothesis about which pairs of sections to look at together, named after the criterion ' +
    'that produced it. "CS13 beside E10.5, matched on forelimb bud morphology" is honest, checkable and ' +
    'useful. "CS13 ≈ E10.5" is none of those, and it is what gets copied into the next paper.',

  if_you_must_pick_a_pairing: Object.freeze({
    do: 'name the criterion, name the organ it was matched on, and say which organs it is therefore NOT valid for.',
    do_not: 'publish a stage-to-E-day table without that criterion attached, and never let one travel as a lookup.',
    and_record_it_as: 'kind "borrowed" in the KINDS vocabulary - "measured on a DIFFERENT organism and applied here... Says nothing about this one." That is exactly what a cross-species stage match is, and `borrowed` is in SPEC-adjacent ORGANISM.KINDS already.',
  }),

  sources: Object.freeze({
    heterochrony: SOURCES.heterochrony.citation,
    mouse_atlas: SOURCES.the_mouse_atlas.citation,
    the_tool: 'HESTA help page, Analysis > Cross-Species Comparison, fetched 2026-11-06: "It places HESTA (human) and MOSTA (mouse) data on a shared developmental-stage timeline. You choose stage-matched files and an orthologous gene pair."',
    mouse_days_unverified: SOURCES.the_mouse_atlas.not_verified,
  }),

  what_this_note_does_not_establish:
    'it does not say the comparison is worthless - cross-species comparison is most of how ' +
    'developmental biology learns anything. It says the alignment is a parameter of the analysis and ' +
    'must be reported as one. And it does not quantify the human-mouse mismatch per organ; nobody ' +
    'checked that here, and Workman et al. is a neurodevelopmental model, so its residuals are evidence ' +
    'that organ-specific heterochrony exists between mammals and are NOT a table of human-mouse offsets ' +
    'for the fifty organs in HESTA.',
});

/** A frozen, honest note on mapping human Carnegie stages to mouse embryonic days. Same object each call. */
export function humanMouseCaution() { return HUMAN_MOUSE_CAUTION; }

// ===================================================================================================
// 6. atlasStageToLife
// ===================================================================================================

/**
 * THE TEMPERATURE PROBLEM, stated before the code, because it is a hole in the format rather than in
 * this function.
 *
 * SPEC.STAGE_REQUIRED demands `temperature_C` on every stage, and SPEC.WHY_EACH_RULE.temperature_required
 * gives the reason: "development rate is temperature-dependent, so a stage time without a temperature is
 * not a stage". That reason is correct, and it was written for zebrafish, where 28.5 C is a setting on a
 * dial and somebody wrote it down.
 *
 * For a human embryo in utero there is no such number and there never will be. Nobody put a probe in. 37 C
 * is core maternal temperature, so it is a REASONABLE ASSUMPTION and it is not a measurement - and it is
 * not even quite the assumption you want, since maternal core temperature varies by about half a degree
 * over a day and rises in the luteal phase, and the uterus is not the core.
 *
 * So this function requires the field and records it as `assumed`, never `measured`, unless the caller
 * actively declares a measurement and names its source. The value is written as a STAMPED VALUE NODE
 * (ORGANISM.value) rather than a bare 37, deliberately: a bare number in that field is indistinguishable
 * from a thermometer reading, and read.mjs's provenance census would never see it. Stamped, it shows up
 * in the census under `assumed` and counts towards `may_not_be_treated_as_data`, which is true of it.
 *
 * The cost is real: `stage.temperature_C > 30` stops working. That is the trade, and it is the right way
 * round - the format exists so that a number cannot be mistaken for a measurement, and this is the field
 * where the whole human dataset would be mistaken at once.
 *
 * AND THE SPEC FINDING: STAGE_REQUIRED requires the field and does not require its provenance. For in
 * utero mammalian development the field can only ever be assumed, so the rule as written produces a
 * column that is 100% assumption across every human record, with nothing marking it. The fix is not to
 * drop the requirement; it is to require the KIND on it.
 */
export const TEMPERATURE_AWKWARDNESS = Object.freeze({
  the_rule: SPEC.WHY_EACH_RULE.temperature_required,
  the_problem: 'for a human embryo in utero, 37 C is a reasonable assumption and not a measurement. Nobody put a probe in. The field is required and unmeasurable at once.',
  so: 'it is recorded with kind "assumed", as a stamped value node, and it is refused when absent rather than defaulted to 37.',
  why_not_default_it: 'defaulting would fill in the one field whose absence tells a reader that nobody knows the condition this embryo developed under. A default is a measurement with the provenance filed off.',
  and_37_is_not_exactly_right: 'maternal core temperature varies by roughly half a degree across a day and sits higher in the luteal phase, and the uterus is not the core. 37 is the convention, with about a degree of slack that nobody has characterised for first-trimester intrauterine temperature.',
  the_spec_finding: 'SPEC.STAGE_REQUIRED requires temperature_C and does not require a provenance kind on it. For in utero development that makes the column 100% assumption with nothing saying so.',
});

/**
 * Convert an atlas-shaped record into a .life stage conforming to SPEC.STAGE_REQUIRED.
 *
 * @param {object} record {carnegie_stage, temperature_C?, id?, name?, embryo?, section?, channels?, ...}
 * @returns {{status:'ok'|'refused', stage:object|null, problems:Array, warnings:Array}}
 */
export function atlasStageToLife(record) {
  const problems = [], warnings = [];
  const refused = () => ({
    status: 'refused', stage: null, problems, warnings,
    headline: `REFUSED: ${problems.length} problem(s). ${problems[0].field}: ${problems[0].what}`,
    why: 'an atlas record that cannot be made into a stage is not made into one. A stage with a hole in it reads, downstream, as a stage.',
  });

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    problems.push({ field: '(record)', what: `not an object: got ${Array.isArray(record) ? 'an array' : record === null ? 'null' : typeof record}`, why: 'an atlas record is an object carrying at minimum a Carnegie stage.' });
    return refused();
  }

  // ---- the stage ---------------------------------------------------------------------------------
  const raw = record.carnegie_stage ?? record.stage ?? record.CS ?? record.cs;
  const p = parseStage(raw);
  if (p.refused) {
    problems.push({
      field: 'carnegie_stage',
      what: raw === undefined ? 'missing' : `${JSON.stringify(raw)} is not a Carnegie stage`,
      why: p.why_refused ?? 'an atlas record without a stage has no place on a timeline, and placing it anyway is the fabrication this module exists to stop.',
    });
    return refused();
  }
  const row = BY_STAGE.get(p.stage);

  // ---- the temperature ---------------------------------------------------------------------------
  const tRaw = record.temperature_C;
  if (tRaw === undefined || tRaw === null) {
    problems.push({
      field: 'temperature_C',
      what: 'missing',
      why: SPEC.WHY_EACH_RULE.temperature_required,
      and_the_awkwardness: TEMPERATURE_AWKWARDNESS.the_problem,
      what_to_pass: 'temperature_C: 37, which will be recorded with kind "assumed". Pass temperature_provenance: "measured" with a source only if somebody actually measured it, which for an in utero human embryo they did not.',
      not_defaulted_because: TEMPERATURE_AWKWARDNESS.why_not_default_it,
    });
    return refused();
  }
  const tNum = Number(typeof tRaw === 'object' && tRaw !== null && 'v' in tRaw ? tRaw.v : tRaw);
  if (!Number.isFinite(tNum)) {
    problems.push({ field: 'temperature_C', what: `not a number: ${JSON.stringify(tRaw)}`, why: SPEC.WHY_EACH_RULE.temperature_required });
    return refused();
  }

  const declaredKind = record.temperature_provenance ?? (typeof tRaw === 'object' && tRaw !== null ? tRaw.kind : null);
  let tKind = 'assumed', tSource = null;
  if (declaredKind === 'measured' || declaredKind === 'measured-secondhand') {
    if (!record.temperature_source) {
      warnings.push({
        field: 'temperature_C',
        what: `declared "${declaredKind}" with no source, so it was recorded as "assumed" instead`,
        why: 'ORGANISM.value refuses a measured value with no source, and a measured intrauterine temperature would be a remarkable enough claim to need one.',
        degrades: true,
      });
    } else { tKind = declaredKind; tSource = String(record.temperature_source); }
  } else if (declaredKind && declaredKind !== 'assumed') {
    warnings.push({ field: 'temperature_C', what: `temperature_provenance ${JSON.stringify(declaredKind)} is not measured/measured-secondhand/assumed; recorded as "assumed"`, why: `kinds are ${Object.keys(ORGANISM.KINDS).join(', ')}`, degrades: true });
  }
  if (tKind === 'assumed' && Math.abs(tNum - 37) > 1.5) {
    warnings.push({ field: 'temperature_C', what: `${tNum} C is assumed and is more than 1.5 C from the 37 C convention`, why: 'an assumed value far from the convention is either a different convention or a mistake, and neither is visible in the number.', degrades: true });
  }

  const temperature_C = ORGANISM.value({
    v: tNum,
    unit: 'degrees_celsius',
    kind: tKind,
    source: tSource,
    scope: tKind === 'assumed'
      ? 'an assumed intrauterine temperature for one human embryo. Establishes nothing about the actual thermal condition this embryo developed under: nobody measured it, and nobody can.'
      : 'a stated temperature for one human embryo, from the named source. Establishes nothing about any other individual.',
    note: tKind === 'assumed' ? TEMPERATURE_AWKWARDNESS.and_37_is_not_exactly_right : null,
  });
  if (temperature_C.invalid) {
    problems.push({ field: 'temperature_C', what: `could not be stamped: ${temperature_C.why}`, why: 'ORGANISM.value is the shared constructor and its refusals are the format\'s refusals.' });
    return refused();
  }

  // ---- assemble ----------------------------------------------------------------------------------
  const donor = record.embryo ?? record.donor ?? record.embryo_id ?? null;
  const section = record.section ?? record.section_id ?? null;
  const id = record.id ?? `CS${row.stage}${donor ? `_${donor}` : ''}${section ? `_${section}` : ''}`;
  const name = record.name ?? `Carnegie stage ${row.stage}`;

  const known = new Set(['carnegie_stage', 'stage', 'CS', 'cs', 'temperature_C', 'temperature_provenance',
    'temperature_source', 'id', 'name', 'embryo', 'donor', 'embryo_id', 'section', 'section_id', 'observed', 'geometry', 'phenotype']);
  const extra = Object.fromEntries(Object.entries(record).filter(([k]) => !known.has(k)));

  const stage = {
    // SPEC.STAGE_REQUIRED, all five.
    id,
    name,
    time: row.stage,
    time_unit: 'carnegie_stage',
    temperature_C,

    // what was actually seen, and of whom
    observed: record.observed === false ? false : Boolean(donor || section),
    donor: donor,
    section: section,

    // the day range, carried as DATA and never as the time
    carnegie: Object.freeze({
      stage: row.stage,
      days: toDays(row.stage),
      criteria: row.criteria,
      criteria_verified: row.criteria_verified,
      greatest_length_mm: row.greatest_length_mm,
      staged_by: record.staged_by ?? null,
      external_criteria_insufficient: row.external_criteria_insufficient === true,
    }),

    ...(record.geometry ? { geometry: record.geometry } : {}),
    ...(record.phenotype ? { phenotype: record.phenotype } : {}),
    ...(Object.keys(extra).length ? { atlas_fields: extra } : {}),
  };

  if (!donor && !section) {
    warnings.push({ field: 'observed', what: 'the record names neither an embryo nor a section, so `observed` was set false', why: 'a stage that does not say which individual it came from cannot be the observation of one, and a reader will assume it was.', degrades: true });
  }
  if (!record.staged_by) {
    warnings.push({
      field: 'carnegie.staged_by',
      what: 'no staging provenance: who assigned this Carnegie stage, and on what criteria, is not recorded',
      why: 'Carnegie staging is a morphological judgement made by a person on a specimen. ' + EXTERNAL_CRITERIA_ARE_NOT_ENOUGH,
      degrades: true,
    });
  }
  if (row.external_criteria_insufficient) {
    warnings.push({ field: 'carnegie.stage', what: `stage ${row.stage} is one of 19-23, which cannot be delineated from external features alone`, why: EXTERNAL_CRITERIA_ARE_NOT_ENOUGH, degrades: true });
  }
  if (row.source_uncertain) {
    warnings.push({ field: 'carnegie.days', what: `the 2010 age estimate for stage ${row.stage} carries the authors' own question mark (${row.age_2010})`, why: DAYS_SOURCE.question_marks, degrades: true });
  }

  return {
    status: 'ok',
    stage,
    problems,
    warnings,
    degradations: warnings.filter(w => w.degrades),
    headline: `stage ${row.stage} as ${JSON.stringify(id)}; temperature_C is "${tKind}"${warnings.length ? `; ${warnings.length} degradation(s)` : ''}`,
    and_it_is_one_stage_of_one_individual:
      'this is a single observation. It is not a trajectory, and a document assembled from several of ' +
      'these is a composite - see WHAT_AN_ATLAS_IS_NOT and compositeFromAtlas.',
  };
}

// ===================================================================================================
// 7. WHAT_AN_ATLAS_IS_NOT
// ===================================================================================================

export const WHAT_AN_ATLAS_IS_NOT = Object.freeze({

  // ---- the one that matters most -----------------------------------------------------------------
  a_trajectory_of_any_individual:
    'THE IMPORTANT ONE. An atlas is a CROSS-SECTION ACROSS INDIVIDUALS; a .life is a TRAJECTORY OF ONE. ' +
    'HESTA is 13 embryos across 12 Carnegie stages, and NO EMBRYO IN IT WAS OBSERVED AT TWO STAGES - ' +
    'each was sectioned once and that was the end of it. A .life timeline asserts precisely what an ' +
    'atlas cannot supply: that this state FOLLOWS that one, in one animal. read.mjs refuses an ' +
    'out-of-order timeline for exactly this reason, because "follows" is a claim that can be false. ' +
    'Build a .life from atlas stages and you get a composite: a trajectory of an animal that never ' +
    'existed, assembled from thirteen that did. That is a legitimate object and a catastrophic thing to ' +
    'mistake for a record, so compositeFromAtlas() stamps it `composite: true` in the document.',

  and_the_consequence_for_every_rate:
    'every rate, every slope, every "between stage 12 and stage 16 the cells did X" computed from an ' +
    'atlas is a BETWEEN-INDIVIDUAL difference being read as a WITHIN-INDIVIDUAL change. Those are ' +
    'different quantities and the atlas contains only the first. With 13 embryos, donor-to-donor ' +
    'variation and stage-to-stage change are confounded by construction and no amount of analysis ' +
    'separates them, because the design has one embryo per cell of the table.',

  // ---- multimodality -----------------------------------------------------------------------------
  multimodal_in_the_strong_sense:
    'a spatial transcriptomic atlas is NOT multimodal in the strong sense. What HESTA offers is Stereo-' +
    'seq plus snRNA-seq: BOTH ARE RNA. It is one molecule class measured two ways - spatially with ' +
    'modest per-spot depth, and dissociated with nuclear depth and no position - not transcriptomics ' +
    'plus epigenomics plus proteomics. There is no protein, no chromatin accessibility, no methylation ' +
    'and no metabolite in the Nature paper. A plan that assumes protein-level data will be ' +
    'disappointed, and so will one that assumes regulatory-state data: see `the_regulons`.',

  the_two_modalities_fail_together:
    'and because both modalities are RNA, their errors are correlated rather than independent. The ' +
    'point of genuine multimodality is that proteomics can contradict transcriptomics - transcript ' +
    'abundance is a poor predictor of protein abundance, which is why measuring both is worth the ' +
    'money. Two RNA assays cannot contradict each other about translation. They can only agree.',

  the_regulons:
    'the paper\'s headline product is "a regulatory profile for the development of 50 organs and 198 ' +
    'substructures" and "potential tissue-identity regulators". A regulon of that kind is INFERRED from ' +
    'co-expression plus motif annotation; it is not a measured regulatory event. No TF binding was ' +
    'assayed, no perturbation was performed, and the paper\'s own hedge is "potential". In the KINDS ' +
    'vocabulary a regulon call is `derived` at best - "computed from other values... by a stated rule" - ' +
    'and it is not `measured`.',

  // ---- the sample --------------------------------------------------------------------------------
  a_population:
    '13 embryos is not a population. It is roughly one embryo per Carnegie stage across a 12-stage ' +
    'range, so for most stages n = 1 and there is no within-stage variance to estimate at all. ' +
    'Anything that looks like biological variability in a stage-to-stage comparison may be one donor\'s ' +
    'genotype, one donor\'s sex, one collection, one post-mortem interval. The donors are described as ' +
    'euploid, which rules out one confounder and names none of the others.',

  a_random_sample:
    'and they are not a random sample of human embryos. They are elective terminations that reached a ' +
    'tissue programme intact enough to section - a selection on gestational age, on clinical pathway, ' +
    'on geography, and on the embryo surviving collection. Nothing in an atlas marks the embryos that ' +
    'did not make it in.',

  // ---- the geometry ------------------------------------------------------------------------------
  a_volume:
    'a sagittal section is not a volume. 77 sections across 13 embryos is about six per embryo, which ' +
    'is sparse sampling of a 3D object, and every section is a plane chosen by whoever held the knife. ' +
    'Structures off the sampled planes are absent, not sparse; left-right asymmetry is barely ' +
    'addressable from sagittal sections; and the portal itself calls its 3D reconstruction a ' +
    '"proof-of-concept", built from eight consecutive sections of ONE embryo. That is the honest label ' +
    'and it should be carried forward: a reconstruction from six planes is an interpolation between ' +
    'planes, and SPEC.GEOMETRY_PROVENANCE_AXES.shape already says what that makes the resulting mesh.',

  an_anatomy:
    '"50 organs and 198 substructures" is a SEGMENTATION of transcriptomic clusters onto sections, not ' +
    'a dissection. The boundaries are where expression changes, which is often but not always where ' +
    'the anatomist would cut, and a substructure in this count is a labelled region of a plane rather ' +
    'than a delineated 3D organ part.',

  // ---- the reference -----------------------------------------------------------------------------
  a_reference_for_an_individual:
    'an atlas is a REFERENCE, and a reference is a thing other data are compared against, not a thing ' +
    'any individual matched. Mapping a new sample onto it returns a nearest neighbour in the reference, ' +
    'which is a coordinate and not a diagnosis, and the reference has no way to report that the new ' +
    'sample is unlike everything in it.',

  a_developmental_mechanism:
    'the atlas says what was expressed where, at twelve stages, in thirteen individuals. It does not ' +
    'say what causes what. Nothing was perturbed. "Developmentally informed engineering of cell fate" ' +
    'needs causal claims, and an atlas supplies the targets to test, not the tests.',

  // ---- the staging -------------------------------------------------------------------------------
  a_clock:
    'the Carnegie stage on an atlas section is an ORDINAL label assigned by morphology, by a person, ' +
    'usually without the histology that O\'Rahilly & Müller say stages 19-23 require. It is not a time ' +
    'and arithmetic on it is refused: see refuseArithmetic and SPEC.ORDINAL_UNITS.',
});

// ===================================================================================================
// 8. compositeFromAtlas
// ===================================================================================================

/**
 * Build a .life-shaped document from atlas records, and mark it composite.
 *
 * This exists because the module would otherwise be a set of refusals with no way to do the thing the
 * refusals are about. Building a composite is reasonable. Letting it pass as an organism is not, so the
 * document carries `composite` at top level, its identity names no individual, and its not_established
 * leads with the sentence that makes the rest safe.
 *
 * ONE STAGE PER CARNEGIE STAGE, and here is why, because it is a real collision between this module and
 * read.mjs. read.mjs's checkTimelineOrder requires times to be STRICTLY increasing within a unit, and
 * says of a tie: "two stages at one instant are one stage, or one of the times is wrong". An atlas has
 * several sections, and sometimes several embryos, at the same Carnegie stage - 77 sections over 12
 * stages. Emitting one .life stage per section therefore produces a document read.mjs refuses, for a
 * reason that sounds like a clerical error and is actually the atlas's shape. So this collapses to one
 * stage per distinct Carnegie stage and REFUSES the duplicates by name, rather than shipping a document
 * whose refusal nobody would understand.
 *
 * @param {Array<object>} records atlas-shaped records
 * @param {object} [opts] {identity, genome, source, allow_duplicate_stages}
 */
export function compositeFromAtlas(records, opts = {}) {
  const list = Array.isArray(records) ? records : [records];
  const problems = [], warnings = [], converted = [];

  if (!list.length) {
    return {
      status: 'refused', document: null,
      problems: [{ field: '(records)', what: 'no records', why: 'an empty composite is not a document with no stages; it is not a document. A .life whose timeline is empty asserts nothing and read.mjs would have nothing to order.' }],
      warnings, headline: 'REFUSED: no records',
    };
  }

  list.forEach((r, i) => {
    const res = atlasStageToLife(r);
    if (res.status === 'refused') {
      problems.push({ field: `records[${i}]`, what: res.headline, why: 'one unconvertible record refuses the whole composite. A composite missing a stage is a trajectory with a hole in it, and a hole in a trajectory is indistinguishable from a gap in development.', problems: res.problems });
    } else {
      converted.push({ i, stage: res.stage, record: r });
      for (const w of res.warnings) warnings.push({ ...w, field: `records[${i}].${w.field}` });
    }
  });
  if (problems.length) {
    return { status: 'refused', document: null, problems, warnings, headline: `REFUSED: ${problems.length} of ${list.length} record(s) could not be made into a stage. ${problems[0].what}` };
  }

  // collapse to one stage per Carnegie stage
  const byStage = new Map();
  const dropped = [];
  for (const c of converted) {
    const n = c.stage.time;
    if (byStage.has(n)) { dropped.push({ stage: n, id: c.stage.id, kept: byStage.get(n).stage.id }); continue; }
    byStage.set(n, c);
  }
  if (dropped.length && !opts.allow_duplicate_stages) {
    for (const d of dropped) {
      warnings.push({
        field: `timeline.stages[CS${d.stage}]`,
        what: `${JSON.stringify(d.id)} was DROPPED: stage ${d.stage} is already represented by ${JSON.stringify(d.kept)}`,
        why: 'read.mjs refuses two stages at the same time in the same unit - "two stages at one instant are one stage, or one of the times is wrong". An atlas legitimately has several sections and several donors per Carnegie stage, so collapsing is the only way to produce a readable document, and the dropped records are named here rather than silently merged.',
        degrades: true,
      });
    }
  }

  const stages = [...byStage.keys()].sort((a, b) => a - b).map(n => byStage.get(n).stage);
  const donors = [...new Set(converted.map(c => c.stage.donor).filter(Boolean))];
  const span = spanOf(stages.map(s => s.time));

  const document = {
    format: SPEC.FORMAT,

    // The flag. First, so nothing reads past it.
    composite: Object.freeze({
      is_composite: true,
      why: WHAT_AN_ATLAS_IS_NOT.a_trajectory_of_any_individual,
      stages_in_document: stages.length,
      distinct_donors: donors.length,
      donors: Object.freeze(donors),
      donors_observed_at_more_than_one_stage: 0,
      how_that_number_was_obtained: donors.length
        ? `each donor appears at exactly one Carnegie stage in these records. Counted, not assumed: ${donors.length} donor(s) across ${stages.length} stage(s).`
        : 'no record named a donor, so the count is zero by absence rather than by checking. That is weaker, and it is also worse: a composite that cannot name its donors cannot show that none of them spans two stages.',
      what_this_document_is: `a composite of ${stages.length} stage(s) from ${donors.length || 'an unstated number of'} individual(s). No individual in it was observed at two stages, so no transition in it was observed at all.`,
      what_it_must_not_be_used_for: Object.freeze([
        'any rate of change, which here is a between-individual difference read as a within-individual one',
        'any claim that one state follows another in one animal, which is what a timeline means',
        'any trajectory inference, lineage trajectory or pseudotime that treats consecutive stages as the same cells later',
        'comparison to a real organism as if it were one: there is no such organism',
      ]),
      day_span: span,
    }),

    identity: {
      organism: opts.identity?.organism ?? 'Homo sapiens (COMPOSITE: no individual)',
      taxon: opts.identity?.taxon ?? 'NCBI:txid9606',
      ...(opts.identity ?? {}),
      is_an_individual: false,
      why_not: 'a composite names a species and a stage set. It does not name an animal, because there is not one.',
    },

    genome: opts.genome ?? {
      representation: 'none',
      assembly: null,
      edits: [],
      why_none: 'the atlas releases expression, not per-donor genomes, and a composite of 13 donors has no single genome to name anyway. read.mjs will report identity as UNCHECKED rather than agreed, which is the correct outcome: see its "nothing checked is not a pass" rule.',
    },

    channels_declared: opts.channels_declared ?? ['transcriptome'],

    timeline: { stages },

    provenance: {
      source: opts.source ?? SOURCES.the_atlas.finding_paper,
      portal: SOURCES.the_atlas.portal,
      staging: SOURCES.staging_system.revision,
      day_ranges: SOURCES.day_estimates.table,
      assembled_by: 'organism-format/life/atlas.mjs compositeFromAtlas',
      assembly_is_not_an_observation: 'this document was assembled. Nothing in it was observed as a sequence.',
    },

    not_established: [
      // SPEC.NOT_ESTABLISHED_MINIMUM, in its own words, then the composite's own.
      `which stages were observed and which were filled in: all ${stages.length} stage(s) were observed, each in a DIFFERENT individual, and none of the transitions between them was observed in any individual`,
      'for each channel, on how many cells it was actually measured: not established here. Stereo-seq spots are not cells, and no per-cell channel census was carried over from the atlas into this document.',
      'whether the geometry is a measurement, a reconstruction, or a drawing: no geometry was carried over. Sagittal sections are not a volume, and the atlas\'s own 3D reconstruction is labelled proof-of-concept.',
      'what the file cannot be used to simulate: anything. No mechanical, geometric or kinetic parameter is present, and the composite is not an organism.',
      'that this is a trajectory: it is a composite across individuals. See `composite`.',
      'the human-mouse stage correspondence, if any cross-species claim is made from it: see humanMouseCaution().',
      'the day range of any stage as a point: see toDays() - every age here is a range covering two disagreeing published conventions.',
    ],
  };

  const degradations = warnings.filter(w => w.degrades);
  return {
    status: degradations.length ? 'degraded' : 'ok',
    document,
    problems,
    warnings,
    degradations,
    dropped,
    headline: `composite: ${stages.length} stage(s) from ${donors.length || 0} donor(s), 0 donors observed at two stages${degradations.length ? `; ${degradations.length} degradation(s)` : ''}`,
    and_degraded_is_not_a_pass: degradations.length ? 'read.mjs\'s rule, carried here: a degraded document is returned with its degradations listed and never silently upgraded.' : null,
  };
}

// ===================================================================================================
// what this module does not establish
// ===================================================================================================

export const NOT_ESTABLISHED = Object.freeze([
  'the 1987 Carnegie monograph was not read. Every day figure here comes from the 2010 abstract and from the EHD secondary compilation of both conventions.',
  'the morphological criteria were compiled from secondary tables and NOT checked against the Carnegie plates. One widely mirrored public table misattributes implantation to stage 17, so the secondary sources are demonstrably wrong somewhere.',
  'the HESTA Nature paper\'s full text was not read. The counts here - 77 sections, 13 embryos, CS12-23, 50 organs, 198 substructures - are the abstract\'s and the portal\'s.',
  'the embryonic days MOSTA covers were not confirmed, so no human-mouse pairing is even arithmetically available here, which is the correct state of affairs.',
  'the magnitude of human-mouse organ heterochrony is not quantified. Workman et al. 2013 establishes that organ-specific heterochrony exists among mammals; it is a neurodevelopmental model and is not a table of human-mouse offsets for HESTA\'s fifty organs.',
  'nothing here establishes that a composite built by compositeFromAtlas is fit for any purpose. It establishes only that it is marked as a composite.',
]);
