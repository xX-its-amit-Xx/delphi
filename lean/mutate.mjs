#!/usr/bin/env node
// Mutation evidence: a proof nobody tried to break is not evidence. Each entry below changes the
// STATEMENT of a headline theorem (or removes a hypothesis of the model) in a copy of the module,
// then asks the Lean compiler to check the copy. The proofs must be rejected (non-zero exit with an
// error). A control run of the unmodified module must pass through the very same command. Results
// go to lean/mutations.json and are folded into lean.json by report.mjs. Nothing under lean/Delphi
// is modified.
//   node lean/mutate.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [process.env.ELAN_HOME, path.join(process.env.USERPROFILE || process.env.HOME || '', '.elan'), 'C:/Temp/elan'].filter(Boolean);
let bin = '';
for (const c of candidates) { const d = path.join(c, 'bin'); if (fs.existsSync(path.join(d, process.platform === 'win32' ? 'lake.exe' : 'lake'))) { bin = d; break; } }
const env = { ...process.env, PATH: (bin ? bin + path.delimiter : '') + process.env.PATH };
if (bin && !process.env.ELAN_HOME) env.ELAN_HOME = path.dirname(bin);

const NHDS = '\u{1D4DD}'; // the 𝓝 (neighbourhood filter) symbol used in the Kimura statement

const mutations = [
  { id: 'kimura-rate-doubled', file: 'Delphi/Kimura.lean', theorem: 'Delphi.neutral_substitution_rate', claim_id: 'kimura-substitution-rate',
    description: 'Statement changed to claim the substitution rate is 2 mu instead of mu.',
    find: '(wrightFisher M hM).fixationProbability (oneCopy M hM)) = μ := by', replace: '(wrightFisher M hM).fixationProbability (oneCopy M hM)) = 2 * μ := by' },
  { id: 'kimura-fixation-one-wrong', file: 'Delphi/Kimura.lean', theorem: 'Delphi.wrightFisher_fixation_one', claim_id: 'kimura-substitution-rate',
    description: 'Statement changed to claim a single copy fixes with probability 1/(M+1) instead of 1/M.',
    find: '(wrightFisher M hM).fixationProbability (oneCopy M hM) = 1 / M := by', replace: '(wrightFisher M hM).fixationProbability (oneCopy M hM) = 1 / (M + 1) := by' },
  { id: 'kimura-limit-wrong', file: 'Delphi/Kimura.lean', theorem: 'Delphi.NeutralChain.fixedBy_tendsto', claim_id: 'kimura-fixation-probability',
    description: 'Statement changed so the fixation probability of i copies tends to i/(M+1) instead of i/M.',
    find: `Tendsto (fun t => C.fixedBy t i) atTop (${NHDS} (((i : ℕ) : ℝ) / M)) := by`, replace: `Tendsto (fun t => C.fixedBy t i) atTop (${NHDS} (((i : ℕ) : ℝ) / (M + 1))) := by` },
  { id: 'kimura-escape-dropped', file: 'Delphi/Kimura.lean', theorem: 'Delphi.NeutralChain.fixedBy_tendsto', claim_id: 'kimura-fixation-probability',
    description: 'Model hypothesis removed: the chain no longer has to be able to leave interior states (escape := True). Fixation then need not happen, so the limit theorem must fail.',
    find: 'escape : ∀ i : Fin (M + 1), i ≠ 0 → i ≠ Fin.last M → 0 < P i 0 + P i (Fin.last M)', replace: 'escape : True',
    also: [['escape := wf_escape hM', 'escape := trivial']] },
  { id: 'fisher-no-division', file: 'Delphi/Fisher.lean', theorem: 'Delphi.fisher_fundamental_theorem', claim_id: 'fisher-ftns',
    description: 'Statement changed to claim the change in mean fitness equals the variance itself, not the variance divided by mean fitness.',
    find: 'meanFitness (select p w) w - meanFitness p w = variance p w / meanFitness p w := by', replace: 'meanFitness (select p w) w - meanFitness p w = variance p w := by' },
  { id: 'maynardsmith-threefold', file: 'Delphi/MaynardSmith.lean', theorem: 'Delphi.twofold_cost_of_sex', claim_id: 'maynardsmith-twofold-cost',
    description: 'Statement changed to claim the odds triple each generation instead of doubling.',
    find: 'odds (asexualNext q f) = 2 * odds q := by', replace: 'odds (asexualNext q f) = 3 * odds q := by' },
  { id: 'favored-floor-strengthened', file: 'Delphi/Favored.lean', theorem: 'Delphi.FavoredChain.fixationProbability_ge', claim_id: 'favored-fixation-lower-bound',
    description: 'Statement changed to claim a favored lineage of i copies fixes with probability at least (i+1)/M instead of i/M. Not true (the neutral chain is favored and fixes with exactly i/M), so the proof must fail.',
    find: '    ((i : ℕ) : ℝ) / M ≤ C.fixationProbability i := by', replace: '    (((i : ℕ) : ℝ) + 1) / M ≤ C.fixationProbability i := by' },
  { id: 'favored-budget-doubled', file: 'Delphi/Favored.lean', theorem: 'Delphi.favored_expectedSubstitutions_ge', claim_id: 'favored-fixation-lower-bound',
    description: 'Statement changed to claim the expected substitutions over T generations are at least 2 mu T instead of mu T.',
    find: '    μ * T ≤ expectedSubstitutions M μ (C.fixationProbability (oneCopy M hM)) T := by', replace: '    2 * μ * T ≤ expectedSubstitutions M μ (C.fixationProbability (oneCopy M hM)) T := by' },
  { id: 'favored-drift-dropped', file: 'Delphi/Favored.lean', theorem: 'Delphi.FavoredChain.fixationProbability_ge', claim_id: 'favored-fixation-lower-bound',
    description: 'Model hypothesis removed: the chain no longer has to keep the expected copy number from falling (favored := True). Selection against the mutant is then allowed, so the lower bound i/M must fail.',
    find: '  favored : ∀ i : Fin (M + 1), ((i : ℕ) : ℝ) ≤ ∑ j, P i j * ((j : ℕ) : ℝ)', replace: '  favored : True',
    also: [['  { C with favored := fun i => (C.neutral i).ge }', '  { C with favored := trivial }'], ['  favored i := by rw [binomial_mean]; exact hfav i', '  favored := trivial']] }
];

const tmp = fs.mkdtempSync(path.join(process.env.MUTANT_DIR || os.tmpdir(), 'delphi-mutants-'));
const check = (file) => {
  const t0 = Date.now();
  const r = spawnSync('lake', ['env', 'lean', file], { cwd: here, env, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const errs = out.split(/\r?\n/).filter(l => /error:/.test(l));
  const strip = s => s.replace(tmp.replace(/\\/g, '/'), '').replace(tmp, '').replace(/^[\\/]+/, '');
  return { exit: r.status, seconds: +((Date.now() - t0) / 1000).toFixed(1), errors: errs.length, firstError: errs[0] ? strip(errs[0]).slice(0, 300) : null };
};

const results = [];
for (const f of [...new Set(mutations.map(m => m.file))]) {
  const src = fs.readFileSync(path.join(here, f), 'utf8');
  const dst = path.join(tmp, 'control-' + path.basename(f)); fs.writeFileSync(dst, src);
  process.stdout.write(`control ${f} ... `);
  const r = check(dst); console.log(r.exit === 0 ? `passed (${r.seconds}s)` : `FAILED exit ${r.exit}`);
  results.push({ id: 'control-' + path.basename(f, '.lean').toLowerCase(), kind: 'control', file: 'lean/' + f, expected: 'accepted', outcome: r.exit === 0 && r.errors === 0 ? 'accepted' : 'rejected', asExpected: r.exit === 0 && r.errors === 0, ...r });
}
for (const m of mutations) {
  const src = fs.readFileSync(path.join(here, m.file), 'utf8');
  const occ = src.split(m.find).length - 1;
  if (occ !== 1) { console.log(`${m.id}: find string occurs ${occ} times, skipping`); results.push({ ...m, kind: 'mutation', outcome: 'not applied', asExpected: false }); continue; }
  let mut = src.replace(m.find, m.replace);
  for (const [a, b] of m.also || []) { if (mut.split(a).length - 1 !== 1) throw new Error(m.id + ': secondary find not unique'); mut = mut.replace(a, b); }
  const dst = path.join(tmp, m.id + '.lean'); fs.writeFileSync(dst, mut);
  process.stdout.write(`${m.id} ... `);
  const r = check(dst);
  const rejected = r.exit !== 0 && r.errors > 0;
  console.log(rejected ? `rejected (${r.errors} error(s), ${r.seconds}s)` : `NOT REJECTED exit ${r.exit}`);
  results.push({ id: m.id, kind: 'mutation', file: 'lean/' + m.file, theorem: m.theorem, claim_id: m.claim_id, description: m.description, find: m.find, replace: m.replace, also: m.also || [], expected: 'rejected', outcome: rejected ? 'rejected' : 'accepted', asExpected: rejected, ...r });
}
const summary = { run: new Date().toISOString(), command: 'lake env lean <mutant copy>', mutations: results.filter(r => r.kind === 'mutation').length, rejected: results.filter(r => r.kind === 'mutation' && r.outcome === 'rejected').length, controlsPassed: results.filter(r => r.kind === 'control' && r.asExpected).length, controls: results.filter(r => r.kind === 'control').length, allAsExpected: results.every(r => r.asExpected) };
fs.writeFileSync(path.join(here, 'mutations.json'), JSON.stringify({ summary, results }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify(summary));
if (!summary.allAsExpected) process.exitCode = 1;
