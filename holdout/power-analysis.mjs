#!/usr/bin/env node
// Clade sizing by statistical power: for each completed claim test with an encoded rule, hold out
// Aves and then Mammalia (on scratch copies, swapping the class name in the builder's analysis.py)
// and ask whether the held-out set clears the builder's own minimum sample size.
//
//   node holdout/power-analysis.mjs [--python py]   ->  holdout/power-analysis.json
//
// Nothing frozen moves: the Aves split stays as it is, and the Mammalia numbers are a what-if.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RULES } from './exam-results/rules.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const python = opt('--python', process.platform === 'win32' ? 'py' : 'python3');
const CLADES = ['Aves', 'Mammalia'];
const TESTS = { 'kimura-heterozygosity': 'claim-tests/math-bio-theorems/kimura-heterozygosity', 'hamilton-senescence': 'claim-tests/math-bio-theorems/hamilton-senescence' };

const splitFor = c => JSON.parse(fs.readFileSync(path.join(root, c === 'Aves' ? 'holdout/split.json' : `holdout/alt/${c}/split.json`), 'utf8')).summary;

const results = [];
for (const [id, dir] of Object.entries(TESTS)) {
  const rule = RULES[id];
  for (const clade of CLADES) {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `delphi-power-${id}-${clade}-`));
    fs.cpSync(path.join(root, dir), scratch, { recursive: true });
    const ap = path.join(scratch, 'analysis.py');
    let src = fs.readFileSync(ap, 'utf8');
    const occurrences = (src.match(/"Aves"/g) || []).length;
    if (clade !== 'Aves') src = src.replace(/"Aves"/g, `"${clade}"`); // the builder's class filter, swapped
    fs.writeFileSync(ap, src);
    const run = spawnSync(python, ['analysis.py', '--exam'], { cwd: scratch, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (run.status !== 0) { console.error(run.stderr.slice(-1500)); results.push({ test: id, clade, error: 'analysis failed' }); continue; }
    const s = JSON.parse(fs.readFileSync(path.join(scratch, 'derived/summary.json'), 'utf8'));
    fs.rmSync(scratch, { recursive: true, force: true });
    const h = s[rule.heldOutKey];
    const { measured, verdict, reason } = rule.evaluate(h, s.main || {});
    const trainingN = s.main?.n_species ?? s.n_species_qualifying_non_aves ?? null;
    const trainingVerdict = s.verdict;
    results.push({ test: id, clade, class_filter_sites: occurrences, held_out_n: measured.n, builder_min_n: rule.min_n, clears_minimum: measured.n >= rule.min_n, held_out_verdict: verdict, decisive: verdict !== 'inconclusive', held_out_measured: measured, training_n: trainingN, training_verdict: trainingVerdict, reason });
    console.log(`${id} / hold out ${clade}: held-out n=${measured.n} (min ${rule.min_n}) -> ${verdict}; training n=${trainingN} -> ${trainingVerdict}`);
  }
}
const inventory = Object.fromEntries(CLADES.map(c => { const s = splitFor(c); return [c, { taxa: s.holdout, roster_species: s.holdout_species, genome_ready: s.holdout_species_genome_ready, with_trait_table: s.holdout_species_with_trait_table, trait_sources: s.trait_sources, claims_only_in_clade: s.claims.holdout, claims_mixed: s.claims.mixed }]; }));
const decisive = Object.fromEntries(CLADES.map(c => [c, results.filter(r => r.clade === c && r.decisive).length]));
const out = {
  generated_at: new Date().toISOString(),
  question: 'Which held-out clade leaves enough species in the public tables for the builders’ own pre-registered minimum sample sizes to be met, so the exam can reach a verdict?',
  method: 'Each completed claim test’s analysis.py was copied to a scratch directory, its class filter ("Aves") swapped for the candidate clade, and run with --exam. The builder’s decision rule, including its minimum n, was then applied to the held-out species alone (holdout/exam-results/rules.mjs). The frozen Aves split was not changed.',
  tests: results,
  inventory,
  decisive_exams_by_clade: decisive,
  clade_currently_frozen: 'Aves (provisional)'
};
fs.writeFileSync(path.join(root, 'holdout/power-analysis.json'), JSON.stringify(out, null, 1) + '\n');
console.log('decisive exams by clade:', JSON.stringify(decisive));
