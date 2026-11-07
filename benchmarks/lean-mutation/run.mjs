#!/usr/bin/env node
// Run the mutation benchmark against the real Lean library.
//
//   node benchmarks/lean-mutation/run.mjs [--out results.json] [--keep]
//
// Writes each mutant to a scratch file, compiles it with `lake env lean` from the lean project, and
// classifies the outcome. NOTHING under lean/ is written: that directory belongs to another thread, and
// the benchmark reads it.
//
// Requires the Lean toolchain on PATH (C:/Temp/elan/bin here) and the Delphi library already built.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TARGETS, TACTICS, WHAT_THIS_IS, HOW_TO_READ_A_RESULT } from './mutants.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const LEAN_DIR = path.join(ROOT, 'lean');
const argv = process.argv.slice(2);
const val = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
const OUT = val('out') ?? path.join(HERE, 'results.json');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leanmut-'));
const PATH_WITH_LEAN = `C:/Temp/elan/bin${path.delimiter}${process.env.PATH}`;

function compile(source, label) {
  const file = path.join(tmp, `${label}.lean`);
  fs.writeFileSync(file, source);
  const r = spawnSync('lake', ['env', 'lean', file], {
    cwd: LEAN_DIR, encoding: 'utf8', timeout: 300_000,
    env: { ...process.env, PATH: PATH_WITH_LEAN },
    shell: true,
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { ok: r.status === 0, status: r.status, output: out.trim().slice(0, 1200) };
}

const PRELUDE = 'import Delphi.Empirical\nimport Delphi.Scaling\n\nopen Delphi\n\n';

// sanity: does an unmutated, known-true statement compile? If not, every "kill" below is a build failure.
const sanity = compile(`${PRELUDE}theorem sanity (r : ℝ) (h : ¬ Delphi.Empirical.measuredFinRatio r) : r < 0.406 ∨ 0.823 < r :=\n  Delphi.Empirical.finRatio_outside h\n`, 'sanity');
console.log(`sanity (the ORIGINAL statement, by its own theorem): ${sanity.ok ? 'compiles' : 'FAILED'}`);
if (!sanity.ok) {
  console.error('the harness cannot distinguish a dead mutant from a broken build. Output:\n' + sanity.output);
  process.exit(3);
}

const results = [];
for (const target of TARGETS) {
  for (const m of target.mutants) {
    const label = `${target.id}__${m.id}`.replace(/[^a-z0-9_]/gi, '_');
    process.stdout.write(`\n${target.id} / ${m.id}\n  ${m.what}\n`);

    // 1. is the mutant provable by any automation we try?
    let proved = null;
    for (const tac of [...(m.proof_attempts ?? []), ...TACTICS]) {
      const r = compile(`${PRELUDE}${m.statement} := ${tac}\n`, `${label}_prove_${tac.replace(/\W/g, '')}`);
      if (r.ok) { proved = /\n/.test(tac) ? 'a tailored proof' : tac; break; }
    }

    // 2. is its negation provable?
    let refuted = null;
    if (!proved && m.negation) {
      const proof = m.negation_proof ?? 'by norm_num';
      const r = compile(`${PRELUDE}${m.negation} := ${proof}\n`, `${label}_refute`);
      if (r.ok) refuted = proof;
      else results.push({ _negation_attempt_output: r.output.slice(0, 300), _for: label });
    }

    const outcome = proved ? (m.is_control ? 'control_survived' : 'SURVIVED') : refuted ? 'REFUTED' : 'UNPROVEN';
    console.log(`  -> ${outcome}${proved ? ` (provable ${proved})` : ''}${refuted ? ' (negation proved)' : ''}`);
    console.log(`     expected: ${m.expect}`);

    results.push({
      target: target.id, law: target.law, mutant: m.id, what: m.what,
      is_control: Boolean(m.is_control),
      outcome,
      provable_by: proved, negation_proved_by: refuted,
      expected: m.expect,
      matches_expectation: m.expect.startsWith(outcome) || (m.is_control && outcome === 'control_survived'),
      where_the_constants_come_from: target.where_the_constants_come_from,
    });
  }
}

const real = results.filter(r => r.outcome && !r._for);
const tally = {};
for (const r of real) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1;

const report = {
  what_this_is: WHAT_THIS_IS,
  how_to_read_a_result: HOW_TO_READ_A_RESULT,
  toolchain: fs.existsSync(path.join(LEAN_DIR, 'lean-toolchain')) ? fs.readFileSync(path.join(LEAN_DIR, 'lean-toolchain'), 'utf8').trim() : null,
  sanity_check: 'the original statement compiles via its own theorem, so a failing mutant is not a failing build',
  mutants: real.length,
  tally,
  results: real,
  the_headline: (() => {
    const survived = real.filter(r => r.outcome === 'SURVIVED');
    return survived.length
      ? `${survived.length} mutant(s) SURVIVED: ${survived.map(s => `${s.target}/${s.mutant}`).join(', ')}. A surviving mutant means the statement does not depend on the constant that was changed.`
      : 'no non-control mutant survived. Every mutation changed what the statement claims, which is what a formalisation carrying empirical content should do.';
  })(),
  what_a_kill_rate_would_hide: HOW_TO_READ_A_RESULT.a_kill_rate_alone_is_meaningless,
  scope: 'two targets and three mutants. This is a method and a first result, not a coverage figure over the 48 laws that carry a Lean theorem.',
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`\ntally: ${JSON.stringify(tally)}`);
console.log(report.the_headline);
console.log(`\nwritten to ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);
if (!argv.includes('--keep')) fs.rmSync(tmp, { recursive: true, force: true });
