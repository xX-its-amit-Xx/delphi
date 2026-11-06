// THE DATA-RETURN CONTRACT: what a partner lab has to send back for a result to be evidence.
//
// ============================== WHY THIS FILE EXISTS ==============================
// The bench package can tell a lab what to run. Before this file there was no format for what comes
// back, anywhere in the repository. The nearest structures were sim-engine/lib/envelope.mjs (a wrapper
// for our OWN tool output, with no parser for external data) and sim-engine/params/ontogeny.json (whose
// allometry records carry exactly the right fields but whose `source.doi_or_url` presumes a publication,
// which an unpublished lab result does not have).
//
// Without a contract, a returned measurement is an anecdote: a number in an email, with the blinding,
// the controls and the clutch structure held in somebody's memory. With one, the same measurement is a
// calibration label - and calibration labels are the thing this project has exactly zero of.
//
// ============================== THE ONE DESIGN DECISION ==============================
// Every field here is REQUIRED or it is absent. There is no "optional but recommended", because the
// fields a tired person skips are precisely the ones that decide whether the result is interpretable
// (was scoring blind; which controls ran in the same session). A result that cannot fill a required
// field is not rejected - it is accepted with `usable_as_a_label: false` and the reason recorded, which
// is strictly more useful than a missing row.
//
// ============================== WHAT THIS IS NOT ==============================
// Not a claim, not a nanopub and not a verdict. It is the raw return. Turning one into a claim is a
// separate step that needs a human, because a single lab result that contradicts a published expectation
// is as likely to be a bad session as a finding.

export const WHAT_THIS_IS =
  'The minimum a partner lab must send for one arm of one case so that the result can be used as a ' +
  'calibration label rather than filed as an anecdote. Raw return only: no verdict, no claim, no ' +
  'interpretation. Produced by the lab, ingested here, never written here.';

export const WHY_EACH_FIELD = {
  prediction_id:
    'the result has to attach to exactly ONE prediction, made BEFORE the experiment, or it is not a test ' +
    'of anything. This is the field that makes the difference between validation and story-telling.',
  blind:
    'the plan gates on it ("scoring is done blind to arm", if_not "the result is not evidence"). If the ' +
    'gate is real then the answer must travel with the data, including when the answer is no.',
  controls_in_the_same_session:
    'a control run last month is not a control. For the overexpression route this is the whole experiment: ' +
    'the overgrowth rate has no meaning except against the marker-only rate measured in the same clutch.',
  clutch_id:
    'clutch-to-clutch variance is the largest nuisance term in this kind of experiment. Without the clutch ' +
    'structure, arms from different clutches silently become a between-clutch comparison.',
  n_injected_n_survived_n_scored:
    'three different denominators, and conflating them is the commonest way a penetrance number goes ' +
    'wrong. The published 40 % in the overexpression case is itself conditioned on a denominator that ' +
    'nobody published, which is exactly the mistake this triple prevents.',
  temperature_log:
    'the condition matrix fixes rearing temperature at 28.5 C because no published measurement of ' +
    'temperature against editing efficiency was found - recorded as a gap in our search, not as a settled ' +
    'question. A returned temperature log is how that gap starts to close.',
  what_went_wrong:
    'free text, required, and may not be empty - "nothing" is an acceptable answer but has to be typed. ' +
    'The single most valuable field in the form, and the first one a template would drop.',
  scorer_disagreement:
    'required where the readout is a subjective call (the overgrowth phenotype). A proportions calculation ' +
    'assumes a clean binary per-animal call; the disagreement rate is the evidence for or against that ' +
    'assumption, and it determines whether the computed N was optimistic.',
};

/** The required fields, as a flat schema a form or a CSV header can be generated from. */
export const SCHEMA = {
  version: '1.0.0',
  // --- what this result is about
  prediction_id: { type: 'string', required: true, what: 'the id of the prediction this result tests, issued before the experiment' },
  case_id: { type: 'string', required: true, what: 'the bench case id, e.g. kcnk5b-overexpression-f0' },
  arm_id: { type: 'string', required: true, what: 'the arm id from the condition matrix, e.g. plasmid-dose:high' },
  // --- who, when, where
  lab: { type: 'string', required: true, what: 'the laboratory, as it should be credited' },
  operator_role: { type: 'string', required: true, what: 'the role of the person who performed and the person who scored, e.g. "injected by a postdoc, scored by a different postdoc". Roles, not names - a returned result should not carry personal identifiers.' },
  date_injected: { type: 'date', required: true },
  date_scored: { type: 'date', required: true },
  // --- the animals
  strain: { type: 'string', required: true, what: 'AB, TU, WIK, AB/TU...; the locus-verification stage exists because strains differ at the target' },
  clutch_id: { type: 'string', required: true, what: 'an identifier per clutch; arms from one clutch must share it' },
  n_injected: { type: 'integer', required: true },
  n_survived: { type: 'integer', required: true, what: 'to the scoring stage' },
  n_scored: { type: 'integer', required: true, what: 'animals that actually yielded a measurement; may be below n_survived' },
  temperature_log: { type: 'string', required: true, what: 'the rearing temperature and how it was recorded, including "28.5 C nominal, not logged" if that is the truth' },
  // --- the measurement
  quantity: { type: 'string', required: true, what: 'what was measured, including the structure: "pectoral fin bud area / eye area", "CAUDAL fin length / standard length", "local fin or barbel overgrowth present"' },
  unit: { type: 'string', required: true, what: 'the unit, or "dimensionless ratio", or "binary"' },
  method: { type: 'string', required: true, what: 'instrument and software, e.g. "handheld calipers under a stereo microscope, AxioVision"' },
  values: { type: 'array', required: true, what: 'ONE ENTRY PER ANIMAL, not a summary. A mean and an SD cannot be re-analysed, pooled, or checked; per-animal values can.' },
  // --- the things that decide whether it is evidence
  blind: { type: 'boolean', required: true, what: 'was scoring blind to arm' },
  blind_how: { type: 'string', required: true, what: 'how blinding was achieved, or why it was not possible' },
  scorer_disagreement: { type: 'string', required: true, what: 'for a subjective call: how many animals two scorers disagreed on, out of how many. "single scorer" is an acceptable answer and is itself information.' },
  controls_in_the_same_session: { type: 'array', required: true, what: 'the control arms run in the same session, each with its own n and result. An empty array is a valid answer and sets usable_as_a_label to false.' },
  // --- the honest field
  what_went_wrong: { type: 'string', required: true, what: 'anything that deviated from the plan, failed, or looked odd. May not be empty.' },
  // --- provenance, borrowed from the envelope vocabulary already used in this repo
  kind: { type: 'enum', required: true, values: ['measured'], what: 'a returned lab result is always `measured`. The enum has one value so that a derived or assumed number cannot enter through this door.' },
  scope: { type: 'string', required: true, what: 'what this result does NOT establish. Mandatory, matching sim-engine/lib/envelope.mjs, where the same field exists for the same reason.' },
  source: { type: 'object', required: true, what: '{ lab, internal_reference, doi_or_url: null }. doi_or_url is explicitly nullable here, which is the one change from the ontogeny.json record shape: an unpublished result has no DOI and must not be forced to borrow one.' },
};

export const REQUIRED = Object.entries(SCHEMA).filter(([, v]) => v && v.required).map(([k]) => k);

/** Validate a returned result. Never throws, never rejects: a result that cannot fill a required field
 *  is accepted with usable_as_a_label: false and the reason, because knowing a session was unblinded is
 *  more useful than having no record of the session. */
export function validate(result) {
  const problems = [];
  const missing = REQUIRED.filter(k => result?.[k] === undefined || result[k] === null || result[k] === '');
  for (const k of missing) problems.push({ field: k, problem: 'missing or empty', consequence: SCHEMA[k].what });

  if (Array.isArray(result?.values) && result.values.length === 0) problems.push({ field: 'values', problem: 'empty array', consequence: 'no measurement' });
  if (Array.isArray(result?.values) && Number.isInteger(result?.n_scored) && result.values.length !== result.n_scored)
    problems.push({ field: 'values', problem: `${result.values.length} per-animal values but n_scored = ${result.n_scored}`, consequence: 'one of the two is wrong, and which one changes the denominator' });
  for (const [a, b] of [['n_survived', 'n_injected'], ['n_scored', 'n_survived']])
    if (Number.isInteger(result?.[a]) && Number.isInteger(result?.[b]) && result[a] > result[b])
      problems.push({ field: a, problem: `${a} (${result[a]}) exceeds ${b} (${result[b]})`, consequence: 'the denominators are inconsistent' });

  const blockers = [];
  if (result?.blind === false) blockers.push('scoring was not blind to arm, which the plan gates on: "if_not: the result is not evidence"');
  if (Array.isArray(result?.controls_in_the_same_session) && result.controls_in_the_same_session.length === 0)
    blockers.push('no control arm ran in the same session, so there is no reference rate from the same clutch');
  if (missing.length) blockers.push(`${missing.length} required field(s) missing: ${missing.join(', ')}`);

  return {
    schema_version: SCHEMA.version,
    problems,
    usable_as_a_label: blockers.length === 0,
    blockers,
    still_worth_recording: true,
    why_still_worth_recording:
      'a session that failed its own gates is a measurement of the protocol, not of the biology, and the ' +
      'protocol is also something this project is trying to learn. Recording it with usable_as_a_label: ' +
      'false keeps it out of any calibration set while keeping it out of the bin.',
  };
}

/** A blank form for one arm, so a lab can be handed a file rather than a description. */
export function blankForm({ case_id = null, arm_id = null, prediction_id = null } = {}) {
  const form = {};
  for (const [k, v] of Object.entries(SCHEMA)) {
    if (k === 'version') continue;
    form[k] = v.type === 'array' ? [] : v.type === 'boolean' ? null : v.type === 'integer' ? null : v.type === 'object' ? { lab: null, internal_reference: null, doi_or_url: null } : null;
  }
  form.case_id = case_id; form.arm_id = arm_id; form.prediction_id = prediction_id;
  form.kind = 'measured';
  return form;
}

/** The CSV header a lab can paste into a spreadsheet. One row per ARM, with per-animal values in a
 *  separate long-format file, because a wide CSV cannot hold a variable number of animals. */
export function csvHeaders() {
  const wide = REQUIRED.filter(k => k !== 'values' && k !== 'source' && k !== 'controls_in_the_same_session');
  return {
    arms_csv: [...wide, 'source_lab', 'source_internal_reference', 'source_doi_or_url', 'controls_in_the_same_session_json'],
    values_csv: ['prediction_id', 'case_id', 'arm_id', 'animal_id', 'value', 'excluded', 'why_excluded'],
    why_two_files:
      'one row per arm cannot hold a variable number of animals, and a summary statistic is not ' +
      're-analysable. So: one wide file of arms, one long file of per-animal values keyed by the same ids. ' +
      'The `excluded` column exists because animals do get excluded and the reason must travel with the ' +
      'exclusion rather than being applied silently before the file is written.',
  };
}
