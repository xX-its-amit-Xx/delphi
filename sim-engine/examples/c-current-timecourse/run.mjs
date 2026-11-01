// Example (c): perturbation timecourse. Winged zebrafish vs flying fish against a 0.3 m/s current, at every
// developmental stage in the organism's own stage table.
//   node sim-engine/examples/c-current-timecourse/run.mjs
// scenario_timecourse (tools/studio.mjs). Writes nothing outside this folder.
import { scenarioTimecourse } from '../../tools/studio.mjs';
import { n, metric, checker, finish, slim, table } from '../_lib.mjs';

const CURRENT = 0.3; // m/s, a design input (kind assumed)
const ORGS = ['winged-zebrafish', 'flying-fish'];
const { checks, expect } = checker();

const tc = {};
for (const o of ORGS) tc[o] = await scenarioTimecourse({ organism: o, scenario: 'current', params: { current_m_s: CURRENT } });

const rowsOf = o => tc[o].result.stages.map(s => {
  const r = { metrics: s.metrics };
  const u = metric(r, 'ucrit_m_s'), ub = metric(r, 'ucrit_upper_bound_m_s'), fr = metric(r, 'current_fraction_of_ucrit');
  return { ageDays: s.ageDays, stage: s.stage, label: s.label, SL_mm: s.SL_m * 1000, ok: s.ok, feasible: s.feasible, survives: s.survives, limiting: s.limiting, note: s.feasibility_note ?? null, error: s.error,
    ucrit: u, upper: ub, frac: fr, violations: (s.violations || []).map(v => v.law_id), newBinding: (s.new_binding_violations || []).map(v => v.law_id ?? v) };
});
const R = Object.fromEntries(ORGS.map(o => [o, rowsOf(o)]));
const wz = R['winged-zebrafish'], fly = R['flying-fish'];

// ------------------------------------------------------------- expectations
expect('both timecourses ran at every stage', ORGS.every(o => R[o].length >= 5 && R[o].every(r => r.ok)), JSON.stringify(ORGS.map(o => R[o].map(r => r.ok))));
const wzFail = wz.filter(r => r.feasible === false), wzPass = wz.filter(r => r.feasible === true), wzNull = wz.filter(r => r.feasible === null);
expect('winged zebrafish: cannot hold station as a larva (feasible=false)', wz.some(r => r.stage === 'larva' && r.feasible === false), JSON.stringify(wz.map(r => [r.ageDays, r.feasible])));
expect('winged zebrafish: holds station as an adult (feasible=true)', wz.filter(r => r.stage === 'adult').every(r => r.feasible === true), JSON.stringify(wz.map(r => [r.ageDays, r.feasible])));
expect('winged zebrafish: feasible is false exactly where Ucrit < current', wz.every(r => r.ucrit?.value == null || (r.ucrit.value >= CURRENT) === (r.feasible === true)), JSON.stringify(wz.map(r => [r.ageDays, r.ucrit?.value, r.feasible])));
expect('winged zebrafish: Ucrit labelled calibrated (read back from Plaut 2000)', wz.filter(r => r.ucrit?.value != null).every(r => r.ucrit.kind === 'calibrated'), JSON.stringify(wz.map(r => r.ucrit?.kind)));
expect('flying fish: no Ucrit model at any stage (ucrit null)', fly.every(r => r.ucrit?.value == null), JSON.stringify(fly.map(r => r.ucrit?.value)));
expect('flying fish: physical upper bound exceeds the current from the juvenile stage on', fly.filter(r => r.stage !== 'larva' && r.stage !== 'hatching').every(r => typeof r.upper?.value === 'number' && r.upper.value > CURRENT), JSON.stringify(fly.map(r => [r.ageDays, r.upper?.value])));
const flyFail = fly.filter(r => r.feasible === false), flyNull = fly.filter(r => r.feasible === null);
expect('flying fish: feasible is never true (no Ucrit to pass with)', fly.every(r => r.feasible !== true), JSON.stringify(fly.map(r => r.feasible)));
expect('flying fish: any false verdict comes from the physical upper bound', flyFail.every(r => r.upper?.value < CURRENT), JSON.stringify(flyFail.map(r => r.upper?.value)));
const noteLost = ORGS.some(o => R[o].some(r => r.feasible === false && !r.note && !r.limiting));
expect('timecourse rows carry the reason a stage fails (feasibility_note or limiting)', !noteLost, 'scenario_timecourse copies run.limiting (null by design in current.mjs) but not run.feasibility_note');

// ------------------------------------------------------------- README
const fmtRow = r => [r.ageDays, r.label.replace(/,.*$/, ''), n(r.SL_mm, 3) + ' mm', r.ucrit?.value == null ? `null (${r.ucrit?.kind})` : `${n(r.ucrit.value)} m/s (${r.ucrit.kind})`,
  r.frac?.value == null ? 'null' : n(r.frac.value, 3), r.upper?.value == null ? 'null' : `${n(r.upper.value)} m/s (${r.upper.kind})`, String(r.feasible), String(r.survives), r.note || r.limiting || r.error || ''];
const head = ['age (d after hatching)', 'stage', 'SL', 'Ucrit', 'current / Ucrit', 'physical upper bound on sustained speed', 'feasible (holds station)', 'survives', 'reason given'];
const firstPass = wzPass[0];
const readme = `
**Question.** A steady ${CURRENT} m/s current (a design input, *assumed*). At which life stages can each fish hold station?
\`scenario_timecourse\` runs \`current\` at every stage age in the organism's own stage table (anatomy-model/parametric/stages.json).

**Headline.**
- **Winged zebrafish:** it cannot hold station at ${wzFail.map(r => r.ageDays + ' d').join(', ') || 'no stage'}${wzNull.length ? `, and there is no model at ${wzNull.map(r => r.ageDays + ' d').join(', ')}` : ''}. It holds station from ${firstPass ? firstPass.ageDays + ' d (' + firstPass.stage + ', Ucrit ' + n(firstPass.ucrit.value) + ' m/s, ' + firstPass.ucrit.kind + ')' : 'no stage'} on.
  The wing does not enter this model: Ucrit is the wild-type zebrafish value (15.5 SL/s from Plaut 2000) times SL, so it is *calibrated*. The pass at ${firstPass?.ageDays} d is a read-back of that paper rescaled by body length, not an independent prediction.
- **Flying fish:** ${flyFail.length ? `ruled out at ${flyFail.map(r => r.ageDays + ' d').join(', ')} by the physical bound (${flyFail.map(r => n(r.upper.value) + ' m/s, ' + r.upper.kind).join('; ')} < ${CURRENT} m/s); after that, ` : ''}**no model**. No flying-fish Ucrit was fetched, so \`feasible\` is \`null\` at ${flyNull.map(r => r.ageDays + ' d').join(', ')}. The only number is a physical *upper bound* on sustained speed (rigid drag = red-muscle power, resting on an assumed myotomal fraction). From ${fly.find(r => r.upper?.value > CURRENT)?.ageDays} d on, that bound is above ${CURRENT} m/s. That does not rule the fish out, but it does not show that it can hold station either.
- \`survives\` is \`null\` everywhere, by design: being swept downstream is not modelled as lethal (current.mjs scope).

## Winged zebrafish

${table(head, wz.map(fmtRow))}

## Flying fish

${table(head, fly.map(fmtRow))}

Lean: new binding violations per stage. Winged zebrafish: ${wz.map(r => `${r.ageDays} d: ${r.newBinding.length ? r.newBinding.join(', ') : 'none'}`).join('; ')}. Flying fish: ${fly.map(r => `${r.ageDays} d: ${r.newBinding.length ? r.newBinding.join(', ') : 'none'}`).join('; ')}.
(The full violation lists, including rows the unedited base also violates, are in output.json.)

## Studio defects seen in this run

${noteLost ? '- **The timecourse drops the failure reason.** current.mjs puts the reason in `feasibility_note` and sets `limiting: null`, and `scenario_timecourse` copies `limiting` but not `feasibility_note`. So the "reason given" column above is empty where a stage fails. Reported to the hub.' : 'none'}

## Scope (from the tool)

${tc['winged-zebrafish'].scope}
`;

finish({
  dir: import.meta.dirname, title: 'Example (c): a 0.3 m/s current across development', checks,
  headline: `winged zebrafish fails at ${wzFail.map(r => r.ageDays + 'd').join(',')} and holds from ${firstPass?.ageDays}d (Ucrit calibrated); flying fish ruled out only at ${flyFail.map(r => r.ageDays + 'd').join(',') || 'no stage'} (physical bound), otherwise no Ucrit model (feasible null)`,
  output: { current_m_s: CURRENT, rows: R, timecourses: Object.fromEntries(ORGS.map(o => [o, slim(tc[o])])) },
  readme,
});
