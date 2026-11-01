// Example (d): altitude. TFF vs flying fish from 0 to 5 km: glide feasibility, powered-flight margin, water
// hypoxia, and the Lean altitude law (the flyable set is closed downward).
//   node sim-engine/examples/d-altitude/run.mjs
// scenario_run (tools/studio.mjs), lean_law_get (tools/lean-tools.mjs). Writes nothing outside this folder.
import { scenarioRun } from '../../tools/studio.mjs';
import { lawGet } from '../../tools/lean-tools.mjs';
import { n, q, metric, checker, finish, table } from '../_lib.mjs';

const ORGS = ['tff', 'flying-fish'];
const STEP = 250, TOP = 5000;
const { checks, expect } = checker();

async function at(o, h) {
  const r = await scenarioRun({ organism: o, scenario: 'altitude', params: { altitude_m: h, launch_height_m: 1 } });
  const run = r.result.run;
  const g = k => metric(run, k);
  return { altitude_m: h, ok: run.ok, feasible: run.feasible ?? null, survives: run.survives ?? null, note: run.feasibility_note ?? run.limiting ?? null,
    v_min: g('v_min_m_s'), launch: g('launch_airspeed_m_s'), lean_bound: g('glide_range_lean_bound_m'), kinetic: g('kinetic_phase_m'),
    p_req: g('power_required_W'), p_aer: g('aerobic_power_available_W'), margin: g('powered_flight_margin'), hyp: g('hypoxia_margin_kPa'), rho: g('air_density_kg_m3'),
    violations: (r.result.violations || []).map(v => v.law_id), out_of_validity: r.result.out_of_validity };
}
const sweep = {};
for (const o of ORGS) { sweep[o] = []; for (let h = 0; h <= TOP; h += STEP) sweep[o].push(await at(o, h)); }

// Glide ceiling by bisection on scenario_run itself (10 m resolution). If the fish glides at every sampled
// height up to TOP, keep probing upward in 500 m steps to the top of the scenario's atmosphere (11,000 m).
const MAX = 11000;
const ceilings = {};
for (const o of ORGS) {
  const s = sweep[o]; let i = s.findIndex(r => r.feasible !== true);
  if (i === 0) { ceilings[o] = { ceiling_m: null, below_top: false, why: 'not feasible at sea level' }; continue; }
  let lo, hi;
  if (i > 0) { lo = s[i - 1].altitude_m; hi = s[i].altitude_m; }
  else {
    lo = TOP; hi = null;
    for (let h = TOP + 500; h <= MAX; h += 500) { if ((await at(o, h)).feasible === true) lo = h; else { hi = h; break; } }
    if (hi === null) { ceilings[o] = { ceiling_m: null, below_top: false, above_max: true, why: `feasible at every probed height up to ${MAX} m` }; continue; }
  }
  while (hi - lo > 10) { const mid = Math.round((lo + hi) / 2); ((await at(o, mid)).feasible === true) ? (lo = mid) : (hi = mid); }
  ceilings[o] = { ceiling_m: lo, first_infeasible_m: hi, below_top: lo < TOP, at_ceiling: await at(o, lo), above: await at(o, hi) };
}
const law = (await lawGet({ id: 'altitude-coupling' })).result;
const isa = (await lawGet({ id: 'perturb-isa-vmin' })).result;

// ------------------------------------------------------------- expectations
const T = sweep.tff, F = sweep['flying-fish'];
const prefix = s => { const k = s.findIndex(r => r.feasible !== true); return k < 0 || s.slice(k).every(r => r.feasible !== true); };
const nondec = (s, f) => s.every((r, i) => i === 0 || f(r) >= f(s[i - 1]) - 1e-12);
expect('every altitude ran for both organisms', ORGS.every(o => sweep[o].every(r => r.ok)), '');
expect('Lean altitude-coupling: glide-feasible heights form an interval from the ground (both)', ORGS.every(o => prefix(sweep[o])), JSON.stringify(ORGS.map(o => sweep[o].map(r => r.feasible))));
expect('Lean altitude-coupling: infeasible at the ground => infeasible at every height (both)', ORGS.every(o => sweep[o][0].feasible === true || sweep[o].every(r => r.feasible !== true)), '');
expect('TFF (lighter wing loading) glides at least as high as the flying fish', T.filter(r => r.feasible === true).length >= F.filter(r => r.feasible === true).length, '');
// regression on the current engine (flying fish launched at the sourced 15 m/s taxi-end speed): no ceiling below 5 km
expect('reference flying fish glides at every sampled height to 5 km (no ceiling below 5 km)', F.every(r => r.feasible === true), JSON.stringify(F.map(r => r.feasible)));
expect('reference flying fish launch speed is 15 m/s (sourced taxi-end speed)', F[0].launch.value === 15, JSON.stringify(F[0].launch));
expect('both glide ceilings lie above 5 km (found by bisection, or none up to 11 km)', ORGS.every(o => ceilings[o].above_max || (typeof ceilings[o].ceiling_m === 'number' && ceilings[o].ceiling_m >= TOP)), JSON.stringify(Object.fromEntries(ORGS.map(o => [o, ceilings[o].ceiling_m]))));
expect('TFF ceiling at or above the flying fish ceiling', ceilings.tff.above_max || !(typeof ceilings['flying-fish'].ceiling_m === 'number') || (typeof ceilings.tff.ceiling_m === 'number' && ceilings.tff.ceiling_m >= ceilings['flying-fish'].ceiling_m), '');
expect('v_min nondecreasing with height (both)', ORGS.every(o => nondec(sweep[o], r => r.v_min.value)), '');
expect('aerobic power available nonincreasing with height (both)', ORGS.every(o => nondec(sweep[o], r => -r.p_aer.value)), '');
expect('powered flight impossible at every height (margin < 1, both)', ORGS.every(o => sweep[o].every(r => r.margin.value < 1)), JSON.stringify(ORGS.map(o => sweep[o].map(r => r.margin.value))));
expect('water hypoxia margin positive to 5 km (survives as a swimmer)', ORGS.every(o => sweep[o].every(r => r.hyp.value > 0 && r.survives === true)), JSON.stringify(T.map(r => [r.hyp.value, r.survives])));
expect('altitude-coupling law is accepted (theorem feasible_downward_closed)', law.status === 'accepted' && /feasible_downward_closed/.test(law.lean_ref?.theorem || ''), `${law.status} ${law.lean_ref?.theorem}`);

// ------------------------------------------------------------- README
const ct = ceilings.tff;
const desc = o => { const c = ceilings[o], s = sweep[o];
  if (c.ceiling_m === null && !c.above_max) return `cannot glide at any altitude, not even at sea level (v_min ${q(s[0].v_min)} vs launch ${q(s[0].launch)}; ${s[0].note || ''})`;
  if (c.above_max) return `glides at every sampled height up to ${TOP} m and at every 500 m probe above it up to ${MAX} m, the top of the scenario's atmosphere (no ceiling found; at ${TOP} m v_min ${q(s.at(-1).v_min)} vs launch ${q(s.at(-1).launch)})`;
  const where = `ceiling ${c.ceiling_m} m (bisection on the scenario to 10 m; first infeasible at ${c.first_infeasible_m} m, where v_min ${n(c.above.v_min.value, 6)} m/s (${c.above.v_min.kind}) exceeds launch ${n(c.above.launch.value, 6)} m/s (${c.above.launch.kind}))`;
  return c.below_top ? `glides from sea level up to a ${where}` : `glides at every sampled height up to ${TOP} m (no ceiling below ${TOP / 1000} km; at ${TOP} m v_min ${q(s.at(-1).v_min)} vs launch ${q(s.at(-1).launch)}). Probing upward (500 m steps, then bisection), its ${where.replace(/^ceiling/, 'ceiling is')}`; };
const show = [0, 1000, 2000, 2500, 3000, 4000, 5000];
const rowFor = r => [r.altitude_m, `${n(r.rho.value)}`, q(r.v_min), q(r.launch), String(r.feasible), q(r.lean_bound), q(r.kinetic), n(r.margin.value, 3) + ` (${r.margin.kind})`, q(r.hyp), String(r.survives)];
const head = ['altitude m', 'air density kg/m3', 'v_min', 'launch speed', 'glide feasible', 'Lean-covered glide', 'kinetic phase (outside Lean)', 'aerobic / required power', 'water hypoxia margin', 'survives (swimmer)'];
const readme = `
**Question.** Move the TFF design (a hypothetical "truly flying fish") and the reference flying fish from sea level to 5 km (a lake or launch site at altitude).
Where can each still glide, can either sustain powered flight, and does the Lean altitude law hold on the studio's numbers?
\`scenario_run\` altitude, every ${STEP} m from 0 to ${TOP} m, launch height 1 m, each organism's own launch speed (no what-if). Where a fish glides at every sampled height, the script probes upward to 11,000 m to find its ceiling.

**Headline.**
- **TFF** ${desc('tff')}.
- **Reference flying fish** ${desc('flying-fish')}.
  Thinner air raises v_min as 1/sqrt(rho); the launch speed is each organism's own sourced leap speed (kind in the tables), so the ceiling is where the two cross.
- **Neither can sustain powered flight anywhere**: the aerobic power available is at most ${n(Math.max(...ORGS.flatMap(o => sweep[o].map(r => r.margin.value))), 3)} of the power required (Fick bound), and that ratio only falls with height.
- **Both would still survive as swimmers** in surface water at 5 km: hypoxia margin ${q(T.at(-1).hyp)} at ${TOP} m. That margin uses a cross-species mean Pcrit, so it is *borrowed*.

**The Lean law.** \`${law.law_id}\` v${law.version} (${law.status}; theorem \`${law.lean_ref?.theorem}\` in \`${law.lean_ref?.module}\`, pin ${law.pin?.status}):
"${law.statement_en}"
On the studio's numbers, for both organisms the glide-feasible heights form one interval from the ground up (TFF ${T.filter(r => r.feasible === true).length} of ${T.length} sampled heights, flying fish ${F.filter(r => r.feasible === true).length} of ${F.length}); v_min never decreases and aerobic supply never increases with height; sustained powered flight is infeasible at the ground and so, as the theorem requires, at every height.
This is a check that the scenario's numbers have the shape the theorem says they must have. It is not a kernel proof of this case.
Related: \`${isa.law_id}\` (${isa.status}, theorem \`${isa.lean_ref?.theorem}\`): "${isa.statement_en}"

## TFF

${table(head, T.filter(r => show.includes(r.altitude_m)).map(rowFor))}

## Flying fish

${table(head, F.filter(r => show.includes(r.altitude_m)).map(rowFor))}

All ${T.length} sampled heights per organism are in output.json (\`sweep\`). The glide ceiling bisection is in \`ceilings\`.
Lean violations reported by scenario_run: ${[...new Set(ORGS.flatMap(o => sweep[o].flatMap(r => r.violations)))].join(', ') || 'none'} (rows the unedited base also violates included).
The "Lean-covered glide" column is h (L/D)max from the glide polar. It drops to 0 once the fish cannot reach v_min. The kinetic phase is the studio's own addition and lies outside the theorem's hypotheses.
`;

finish({
  dir: import.meta.dirname, title: 'Example (d): altitude, 0 to 5 km', checks,
  headline: `glide ceiling: none below 5 km for ${ORGS.filter(o => !ceilings[o].below_top).join(' and ') || 'neither'}; ceilings TFF ${ceilings.tff.above_max ? '> ' + MAX : ceilings.tff.ceiling_m ?? 'none'} m, flying fish ${ceilings['flying-fish'].above_max ? '> ' + MAX : ceilings['flying-fish'].ceiling_m ?? 'none'} m (launch ${n(F[0].launch.value)} m/s, ${F[0].launch.kind}); powered flight impossible at every height for both; feasible heights closed downward as Lean altitude-coupling requires`,
  output: { sweep, ceilings, laws: { 'altitude-coupling': law, 'perturb-isa-vmin': { law_id: isa.law_id, status: isa.status, lean_ref: isa.lean_ref, statement_en: isa.statement_en } } },
  readme,
});
