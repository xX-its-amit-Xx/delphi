#!/usr/bin/env node
// node sim-engine/validate/gate/test-containment.mjs [--fail-once]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATING, REFUSED_AS_GATES, NOT_GATING_YET, mayGate, admit, scoreIfAdmissible, ENFORCEMENT_RULE, VERSION } from './containment.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n}${d ? ` - ${d}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const C = GATING[0];
const ok = { preorbital_over_SL: 0.08, eye_diameter_over_SL: 0.06, head_length_over_SL: 0.25 };
const bad = { preorbital_over_SL: 0.2270, eye_diameter_over_SL: 0.0877, head_length_over_SL: 0.2947 }; // the benchmark's animal

console.log('the enforcement rule');
check('only a constraint with support exactly 1 may gate', f(mayGate(C), !mayGate(C)));
check('a constraint supported on 0.9758 may NOT gate', f(
  !mayGate({ ...C, supported_on: { share: 0.9758, n: 4673 } }),
  mayGate({ ...C, supported_on: { share: 0.9758, n: 4673 } })));
check('a constraint with no evidence at all may not gate', f(
  !mayGate({ id: 'x', traits: [], slack: () => 1 }),
  mayGate({ id: 'x', traits: [], slack: () => 1 })));
check('a constraint with support 1 but no slack function may not gate', f(
  !mayGate({ ...C, slack: undefined }), mayGate({ ...C, slack: undefined })));
check('every constraint cleared to gate records the sample it was measured on', f(
  GATING.every(c => c.supported_on && c.supported_on.n > 0 && typeof c.supported_on.sample === 'string'),
  GATING.every(c => c.supported_on && c.supported_on.n > 1e9)));
check('the rejected gates are recorded with WHY, so the mistake cannot be repeated quietly', f(
  REFUSED_AS_GATES.every(r => r.why_not && r.supported_on.share < 1),
  REFUSED_AS_GATES.every(r => r.supported_on.share > 0.99)));
check('the near-strict constraints are held back rather than rounded up', f(
  NOT_GATING_YET.every(r => r.supported_on.share > 0.99 && r.supported_on.share < 1),
  NOT_GATING_YET.every(r => r.supported_on.share === 1)));
check('the rule is stated, not implied', f(/exactly 1/.test(ENFORCEMENT_RULE), /never stated/.test(ENFORCEMENT_RULE)));

console.log('admitting and refusing');
{
  const a = admit(ok);
  check('an ordinary design is admitted', f(a.admissible && !a.violations.length, !a.admissible));
  check('an admitted design reports the slack it had to spare', f(a.checked.length === 1 && a.checked[0].slack > 0, a.checked.length === 0));
  const r = admit(bad);
  check('the benchmark animal is REFUSED', f(!r.admissible && r.violations.length === 1, r.admissible));
  check('the refusal says it is not an animal, not that it scored badly', f(
    /not an animal/.test(r.refusal) && !/score of/.test(r.refusal), !/not an animal/.test(r.refusal)));
  check('the refusal quantifies the violation in standard lengths', f(
    r.violations[0].by > 0 && r.violations[0].units === 'standard lengths', r.violations[0].by <= 0));
  // the boundary: slack exactly 0 is admissible (the eye may fill the head exactly), below it is not
  const edge = { preorbital_over_SL: 0.1, eye_diameter_over_SL: 0.1, head_length_over_SL: 0.2 };
  check('slack of exactly zero is admitted, since a degenerate animal is not an impossible one', f(
    admit(edge).admissible, !admit(edge).admissible));
  const justOver = { ...edge, head_length_over_SL: 0.2 - 1e-9 };
  check('a violation of one part in a billion is still a violation', f(
    !admit(justOver).admissible, admit(justOver).admissible));
}

console.log('the outcome that is usually got wrong');
{
  const missing = { preorbital_over_SL: 0.08 }; // no eye, no head
  const m = admit(missing);
  check('a design missing the traits is NOT admitted', f(!m.admissible, m.admissible));
  check('and is reported as unchecked rather than refused', f(m.unchecked && !m.violations.length, !m.unchecked));
  check('nothing in the result calls an unchecked design a pass', f(
    m.skipped.every(s => s.is_a_pass === false) && m.note !== null, m.skipped.some(s => s.is_a_pass)));
  check('the missing traits are named, so the gap is actionable', f(
    m.skipped[0].missing.includes('eye_diameter_over_SL'), m.skipped[0].missing.length === 0));
}

console.log('the call order');
{
  let called = 0;
  const scorer = () => { called++; return 0.42; };
  const good = scoreIfAdmissible(ok, scorer);
  check('an admissible design is scored', f(good.score === 0.42 && called === 1, good.score === null));
  called = 0;
  const refused = scoreIfAdmissible(bad, scorer);
  check('an inadmissible design is NOT scored at all', f(refused.score === null && called === 0, called === 1),
    `the scorer was called ${called} time(s)`);
  check('the refusal reaches the caller', f(typeof refused.refused === 'string' && refused.refused.length > 0, refused.refused === null));
}

console.log('against the real sample');
{
  const file = path.join(ROOT, 'sim-engine/validate/benchmark/heldout/items.jsonl');
  const need = C.traits;
  let n = 0, refusedReal = 0;
  if (fs.existsSync(file)) {
    for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!l) continue;
      const it = JSON.parse(l);
      if (it.label !== 'positive') continue;
      const p = it.params || {};
      if (!need.every(t => typeof p[t] === 'number' && p[t] > 0)) continue;
      n++;
      if (!admit(p).admissible) refusedReal++;
    }
  }
  // THE load-bearing property of a gate: it must refuse nothing that exists.
  check('the gate refuses ZERO real specimens, which is the only thing that makes it safe to deploy', f(
    n > 4000 && refusedReal === 0, n > 4000 && refusedReal === 1), `${refusedReal} of ${n} real fish refused`);
  check('and it was checked against a real sample large enough to mean something', f(n > 4000, n > 1e9), `n=${n}`);
}

check('the module is versioned', f(/^\d+\.\d+\.\d+$/.test(VERSION), VERSION === 'dev'));

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion should FAIL; any "ok" is a test that does not test)' : ''}`);
process.exit(fail && !FAULT ? 1 : 0);
