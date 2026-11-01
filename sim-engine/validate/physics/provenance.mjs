// model_confidence: the validation status of the model behind every physics check.
//
// THE POINT OF THIS FILE. A physics check that says "function achieved" and nothing else is theatre.
// The engine's scenarios agree with reality in three very different ways, and the difference decides
// whether a pass is evidence:
//
//   independent         the scenario's own modelCard shows a prediction compared with a measurement
//                       that was NOT used to set any of its inputs.
//   rests-on-assumed    it lands where it should, but the weakest input it rests on is assumed.
//   circular            the number it is scored against was read back from, fitted to, or calibrated
//                       against the very paper it is compared with. The independent validation thread
//                       calls this `circular` and so do we.
//   unvalidated         the scenario declares no validatedAgainst entry at all.
//   no model            there is no scenario for the thing asked about. Never a pass.
//
// Nothing here is hard-coded per scenario. Everything is read at call time from
//   - the scenario module's own `modelCard` (equations, sources, validity, validatedAgainst), and
//   - sim-engine/validation/studio-results.json, the independent harness's machine-readable results,
// so when either changes, this changes with it. `STUDIO-FINDINGS.md`'s one honest sentence is the
// reason this file exists: "every numeric wild-type value that lands in band is now read straight
// from the paper it is scored against."
import fs from 'node:fs';
import path from 'node:path';

export const SIM_ROOT = path.resolve(import.meta.dirname, '..', '..');
const STUDIO_RESULTS = path.join(SIM_ROOT, 'validation', 'studio-results.json');

// Words that, in a modelCard's own prose, admit the comparison is not independent. The scenarios were
// written by other agents and they say so themselves; we read their words rather than judging for them.
const CIRCULAR_WORDS = /\bcircular\b|not independent|read[- ]back|readback|same body of observations|same observation|calibrated to|fitted to|not a pass\/fail|a code check, not a test/i;
const KIND_RANK = ['assumed', 'borrowed', 'calibrated', 'derived', 'measured-secondhand', 'measured'];
const weakest = kinds => kinds.filter(Boolean).sort((a, b) => KIND_RANK.indexOf(a) - KIND_RANK.indexOf(b))[0] ?? null;

let _studio = null;
/** The independent harness's results, grouped by scenario module. Missing file -> null, said plainly. */
export function studioResults(file = STUDIO_RESULTS) {
  if (_studio !== null) return _studio;
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const byModule = new Map();
    for (const r of j.results || []) {
      if (!r.module) continue;
      const list = byModule.get(r.module) || [];
      list.push({ id: r.id, name: r.name, metric: r.metric ?? null, status: r.status, amended_status: r.amended_status ?? null, why: r.why ?? null, band: r.band ?? null, predicted: r.predicted ?? null, measured: r.measured ?? null, weakest: r.weakest ?? null });
      byModule.set(r.module, list);
    }
    _studio = { generated_at: j.generated_at, preregistration: j.preregistration ?? null, byModule, file };
  } catch (e) {
    _studio = { error: `sim-engine/validation/studio-results.json could not be read (${e.message}); no independent-harness status is reported and none is assumed`, byModule: new Map(), file };
  }
  return _studio;
}

/** For tests: forget the cached harness file. */
export function resetStudioCache() { _studio = null; }

const effective = t => t.amended_status || t.status;

/**
 * model_confidence for one check.
 *   scenario   the scenario module (or null for a check with no scenario behind it)
 *   run        the scenario result from scenarios/index.mjs runScenario (or null)
 *   metricKey  which metric the check reads, so the harness row for that metric can be singled out
 *   extra      { circular_note, assumed_inputs[], model } for checks that are not a scenario run
 */
export function modelConfidence({ scenario = null, run = null, metricKey = null, extra = {} } = {}) {
  const S = studioResults();
  if (!scenario && !extra.model) {
    return { validated: 'no model', scenario: null, statement: extra.statement || 'no model stands behind this check', studio_tests: [], validated_against: [], circular_inputs: [], weakest_input_kind: null, independent_harness: S.error || S.generated_at };
  }
  const card = scenario?.modelCard || null;
  const va = card?.validatedAgainst || [];
  const tests = scenario ? (S.byModule.get(scenario.key) || []) : [];
  // Rows about this exact metric, when the harness recorded one; otherwise the module's whole row set.
  const mine = metricKey ? tests.filter(t => t.metric === metricKey) : [];
  const relevant = mine.length ? mine : tests;

  const circularTests = relevant.filter(t => effective(t) === 'circular');
  const assumedTests = relevant.filter(t => /rests-on-assumed/.test(effective(t)));
  const failedTests = relevant.filter(t => effective(t) === 'fail');
  const circularCard = va.filter(v => CIRCULAR_WORDS.test(`${v.source || ''} ${v.measured || ''} ${v.predicted || ''} ${v.observation || ''}`));
  const independentCard = va.filter(v => !CIRCULAR_WORDS.test(`${v.source || ''} ${v.measured || ''} ${v.predicted || ''} ${v.observation || ''}`));

  // The weakest input the run itself rests on, from the scenario's own provenance kinds plus the kinds
  // of the metrics it reported. A `calibrated` quantity can never be cited as a result (CONTRACT.md).
  const kinds = [...(run?.provenance || []).map(q => q.kind), ...(run?.metrics || []).map(m => m.kind)];
  const wk = weakest(kinds) || weakest((extra.assumed_inputs || []).map(() => 'assumed'));

  const circular = circularTests.length > 0 || circularCard.length > 0 || !!extra.circular_note;
  let validated;
  if (!va.length && !relevant.length) validated = 'unvalidated';
  else if (circular && !independentCard.length) validated = 'circular';
  else if (circular) validated = 'circular-in-part';
  else if (assumedTests.length || wk === 'assumed' || wk === 'borrowed') validated = 'rests-on-assumed';
  else validated = 'independent';

  const bits = [];
  if (validated === 'circular' || validated === 'circular-in-part') {
    bits.push(`CIRCULAR${validated === 'circular-in-part' ? ' IN PART' : ''}: the comparison this model is scored against is not independent of its own inputs.`);
    for (const t of circularTests) bits.push(`independent harness ${t.id} (${t.name}) = ${effective(t)}: ${t.why || ''}`.trim());
    for (const v of circularCard) bits.push(`the scenario's own modelCard says so: ${v.organism} - ${String(v.source).slice(0, 320)}`);
  }
  if (validated === 'rests-on-assumed') bits.push(`The weakest input this check rests on is \`${wk}\`: it lands where it should, but not on measured ground.`);
  if (validated === 'unvalidated') bits.push('The scenario declares no validatedAgainst entry and the independent harness has no row for it: nothing says this model agrees with any measurement.');
  if (validated === 'independent' || validated === 'circular-in-part') bits.push(`Comparison(s) that did NOT set its inputs: ${independentCard.map(v => `${v.organism}: predicted ${v.predicted} vs measured ${v.measured} -- ${String(v.source).slice(0, 200)}`).join('; ')}`);
  for (const t of failedTests) bits.push(`independent harness ${t.id} FAILS for this module: ${t.why || ''}`.trim());
  if (extra.circular_note) bits.push(extra.circular_note);
  if (extra.assumed_inputs?.length) bits.push(`Assumed inputs: ${extra.assumed_inputs.join('; ')}.`);
  if (card?.validity) bits.push(`Validity stated by the model: ${card.validity}`);
  if (run && run.ok !== false && run.validity && run.validity.inRange === false) bits.push(`OUT OF VALIDITY for this organism: ${run.validity.notes}`);

  return {
    validated,
    scenario: scenario?.key ?? (extra.model || null),
    model: extra.model || (scenario ? `sim-engine/scenarios/${scenario.file || `${scenario.key}.mjs`}` : null),
    equations: card?.equations ?? null,
    sources: card?.sources ?? null,
    weakest_input_kind: wk,
    circular: validated === 'circular' || validated === 'circular-in-part',
    circular_inputs: [...circularTests.map(t => `${t.id}: ${t.why || t.name}`), ...circularCard.map(v => `modelCard/${v.organism}: ${String(v.source).slice(0, 200)}`), ...(extra.circular_note ? [extra.circular_note] : [])],
    studio_tests: relevant.map(t => ({ id: t.id, name: t.name, status: t.status, amended_status: t.amended_status, effective: effective(t), why: t.why })),
    validated_against: va,
    independent_harness: S.error || `sim-engine/validation/studio-results.json, generated ${S.generated_at}`,
    statement: bits.join(' ') || 'no validation statement available',
  };
}

/** The one line that must travel with any "function achieved": never a verdict without its provenance. */
export function confidenceLine(mc) {
  if (!mc) return 'model_confidence missing: treat as unvalidated';
  return `model_confidence=${mc.validated}${mc.weakest_input_kind ? ` (weakest input ${mc.weakest_input_kind})` : ''}`;
}
