#!/usr/bin/env node
// Stage 2 of the paper watcher: take the readers' extractions, check every extracted number with the
// Lean kernel, and write the tally "found / checked / could not be checked, and why".
//
//   node tracks/watch/verify.mjs --from <folder with watch-*.json>     ingest reader output, then check
//   node tracks/watch/verify.mjs                                       re-check the committed extractions
//   node tracks/watch/verify.mjs --status                              print the tally only
//
// What a check is. For each record a reader extracted (numbers quoted from one paper), this script writes
// one Lean theorem: the law's inequality with those numbers in it, or its negation. The kernel then
// accepts or rejects each. The script picks the direction with ordinary arithmetic; if it picked wrong,
// Lean rejects the file and the run FAILS. So "inside the bound" and "outside the bound" are kernel-checked
// arithmetic facts about the extracted numbers.
// What a check is NOT. It does not check that the reader copied the numbers correctly, that the paper
// measured what the law is about, or that the paper is right. It never certifies a paper.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'usecases.json'), 'utf8'));
const QUEUE = path.join(HERE, 'queue.jsonl'), EXT = path.join(HERE, 'extractions.json'), SUM = path.join(HERE, 'summary.json');
const REASONS = { off_topic: 'the search matched but the paper is about something else', no_full_text: 'only the abstract is open, and it does not carry the numbers',
  no_numbers: 'relevant, but it reports nothing our laws take as input', partial_inputs: 'some of the numbers a law needs are there, at least one is missing',
  numbers_only_in_figure: 'the numbers are only in a plot, not in the text or a table', no_law_yet: 'it makes a quantitative claim that no law of ours covers yet',
  holdout: 'it is about the organisms we keep sealed for the final test', bad_record: 'the reader\'s record was incomplete or not numeric, so it was refused', not_read: 'no reader has opened it yet' };

const readQueue = () => (fs.existsSync(QUEUE) ? fs.readFileSync(QUEUE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const slug = (key) => key.replace(/^doi:/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80);

function printStatus() {
  if (!fs.existsSync(SUM)) { console.log('no summary yet: run verify.mjs first'); return; }
  const s = JSON.parse(fs.readFileSync(SUM, 'utf8'));
  console.log(s.sentence); for (const r of s.reasons) console.log(`  ${String(r.n).padStart(3)}  ${r.plain}`);
  console.log(`  by use case: ${s.by_usecase.map((u) => `${u.id} ${u.checked}/${u.found}`).join(', ')}`);
}
if (process.argv.includes('--status')) { printStatus(); process.exit(0); }

// ---- ingest ----
let papers = fs.existsSync(EXT) ? JSON.parse(fs.readFileSync(EXT, 'utf8')).papers : [];
const from = arg('--from');
if (from) {
  const byKey = new Map(papers.map((p) => [p.key, p]));
  for (const f of fs.readdirSync(from).filter((x) => /^watch-.*\.json$/.test(x))) {
    for (const p of JSON.parse(fs.readFileSync(path.join(from, f), 'utf8')).papers ?? []) byKey.set(p.key, { ...p, reader_file: f });
  }
  papers = [...byKey.values()];
}
// a paper the reader marked as holdout leaves no trace but a count: it is removed from the queue too
let queue = readQueue();
const inQ = new Set(queue.map((q) => q.key));
const held = new Set(papers.filter((p) => p.outcome === 'holdout' && inQ.has(p.key)).map((p) => p.key)); // counted once: after this run it is no longer in the queue
const heldPrev = fs.existsSync(SUM) ? (JSON.parse(fs.readFileSync(SUM, 'utf8')).holdout_dropped_by_reader ?? 0) : 0;
// a sealed paper is remembered only as a sha256 of its key, so the watcher does not queue it again
const SEALED = path.join(HERE, 'sealed.json');
const sealed = new Set(fs.existsSync(SEALED) ? JSON.parse(fs.readFileSync(SEALED, 'utf8')).sha256_of_key : []);
for (const p of papers) if (p.outcome === 'holdout') sealed.add(crypto.createHash('sha256').update(p.key).digest('hex'));
if (sealed.size) fs.writeFileSync(SEALED, JSON.stringify({ note: 'papers a reader found to be about the sealed organisms; only a hash of each key is kept', sha256_of_key: [...sealed].sort() }, null, 1) + '\n');
if (held.size) { queue = queue.filter((q) => !held.has(q.key)); fs.writeFileSync(QUEUE, queue.map((x) => JSON.stringify(x)).join('\n') + '\n'); }
papers = papers.filter((p) => p.outcome !== 'holdout');
const qByKey = new Map(queue.map((q) => [q.key, q]));
papers = papers.filter((p) => qByKey.has(p.key)); // a reader may not add papers the watcher did not find

// ---- build the Lean instances ----
const num = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0;
const lit = (x) => { const s = String(x); return /e/i.test(s) ? x.toFixed(12).replace(/0+$/, '') : s; };
const subst = (expr, inputs) => expr.replace(/[a-z_][a-z0-9_]*/g, (m) => (m in inputs ? `(${lit(inputs[m])} : ℝ)` : m));
const evalJs = (expr, inputs) => Function(...Object.keys(inputs), `return (${expr});`)(...Object.values(inputs));
const theorems = [];
let n = 0;
for (const p of papers) {
  p.checks = [];
  for (const r of p.records ?? []) {
    const laws = /^bilayer_/.test(r.law) ? ['bilayer_plate_ceiling', 'bilayer_strip_ceiling'] : [r.law];
    for (const id of laws) {
      const L = cfg.laws[id];
      if (!L) { p.checks.push({ law: id, label: r.label, result: 'refused', why: 'unknown law id' }); continue; }
      if (id === 'crosslink_direction') {
        const v = r.inputs?.values ?? r.values, q = r.inputs?.quantity ?? r.quantity;
        if (!Array.isArray(v) || v.length < 3 || !v.every((x) => typeof x === 'number') || !/modulus|swelling/.test(q ?? '')) { p.checks.push({ law: id, label: r.label, result: 'refused', why: 'series needs 3+ numeric values and a quantity' }); continue; }
        let up = 0, down = 0; for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { if (v[j] > v[i]) up++; else if (v[j] < v[i]) down++; }
        const want = /modulus/.test(q) ? up > down : down > up;
        p.checks.push({ law: id, label: r.label, result: want ? 'inside' : 'outside', by: 'script (rank direction), no Lean', detail: `${q}: ${v.join(', ')} along rising dose`, quotes: r.quotes });
        continue;
      }
      const need = Object.keys(L.inputs), inp = Object.fromEntries(need.map((k) => [k, r.inputs?.[k]]));
      if (!need.every((k) => num(inp[k]))) { p.checks.push({ law: id, label: r.label, result: 'refused', why: `missing or non-numeric input: ${need.filter((k) => !num(inp[k])).join(', ')}` }); continue; }
      const parts = [[L.lhs, L.rhs], ...(L.lhs2 ? [[L.lhs2, L.rhs2]] : [])];
      const holds = parts.map(([a, b]) => evalJs(a.replace(/(\d+)\/(\d+)/g, '($1/$2)'), inp) <= evalJs(b.replace(/(\d+)\/(\d+)/g, '($1/$2)'), inp));
      const inside = holds.every(Boolean);
      const prop = parts.map(([a, b]) => `${subst(a, inp)} ≤ ${subst(b, inp)}`).join(' ∧ ');
      const name = `w${++n}_${id}`;
      theorems.push(`/-- ${p.key} | ${String(r.label ?? '').replace(/[-/*]+/g, ' ').slice(0, 80)} | ${inside ? 'inside' : 'outside'} -/\ntheorem ${name} : ${inside ? prop : `¬ (${prop})`} := by norm_num`);
      p.checks.push({ law: id, label: r.label, result: inside ? 'inside' : 'outside', theorem: `Watch.${name}`, inputs: inp, says: L.says, kind: L.kind, general_theorem: L.general_theorem, quotes: r.quotes, note: r.note });
    }
  }
}
const LEAN = path.join(HERE, 'lean', 'WatchInstances.lean');
fs.mkdirSync(path.dirname(LEAN), { recursive: true });
let leanOk = null, leanOut = '';
if (theorems.length) {
  fs.writeFileSync(LEAN, `import Mathlib\n/-! Generated by tracks/watch/verify.mjs. One theorem per record extracted from a paper: the law's\ninequality with the paper's numbers in it, or its negation. Do not edit by hand. -/\nnamespace Watch\n\n${theorems.join('\n\n')}\n\nend Watch\n\n${[...Array(n)].map((_, i) => `#print axioms Watch.${theorems[i].match(/theorem (\S+)/)[1]}`).join('\n')}\n`);
  const r = spawnSync('bash', ['tracks/lean/check.sh', 'tracks/watch/lean/WatchInstances.lean'], { cwd: ROOT, encoding: 'utf8', timeout: 900_000 });
  leanOut = `${r.stdout ?? ''}${r.stderr ?? ''}`; leanOk = r.status === 0 && /ALL CHECKED/.test(leanOut);
  fs.writeFileSync(path.join(HERE, 'lean', 'CHECKED.txt'), leanOut.replace(/[A-Z]:\/Users\/[^/\s]+\//g, '<home>/'));
}

// ---- verdict per paper, tally ----
for (const p of papers) {
  const c = p.checks.filter((x) => x.result !== 'refused');
  if (p.outcome === 'extracted' && !c.length) { p.outcome = 'bad_record'; }
  p.verdict = c.length ? (leanOk === false && c.some((x) => x.theorem) ? 'lean_failed' : c.some((x) => x.result === 'outside') ? 'outside' : 'inside') : null;
  p.slug = slug(p.key); const q = qByKey.get(p.key); p.title = q.title; p.doi = q.doi; p.published = q.published; p.journal = q.journal; p.preprint = q.preprint;
}
const read = new Set(papers.map((p) => p.key));
const all = [...papers, ...queue.filter((q) => !read.has(q.key)).map((q) => ({ key: q.key, usecase: q.usecase, outcome: 'not_read', verdict: null, title: q.title, doi: q.doi, slug: slug(q.key), checks: [] }))];
const checked = all.filter((p) => p.verdict === 'inside' || p.verdict === 'outside');
const reasonCount = {}; for (const p of all) if (!p.verdict) reasonCount[p.outcome] = (reasonCount[p.outcome] ?? 0) + 1;
const heldTotal = Math.max(heldPrev + held.size, sealed.size); if (heldTotal) reasonCount.holdout = heldTotal;
const found = all.length + heldTotal, notChecked = found - checked.length;
const reasons = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]).map(([code, k]) => ({ code, n: k, plain: REASONS[code] ?? code }));
const nChecks = checked.reduce((a, p) => a + p.checks.filter((c) => c.result !== 'refused').length, 0), nIn = checked.reduce((a, p) => a + p.checks.filter((c) => c.result === 'inside').length, 0);
const nSeed = queue.filter((q) => q.status === 'seed').length;
const sentence = `${found - nSeed} new papers found since ${cfg.since}${nSeed ? `, plus ${nSeed} from our back catalogue` : ''}. ${checked.length} carried numbers a law of ours takes: ${nChecks} separate checks (${n} by the Lean kernel, ${nChecks - n} by a rank-direction script), ${nIn} inside the law and ${nChecks - nIn} outside. ${checked.filter((p) => p.verdict === 'inside').length} papers were inside on every check. ${notChecked} papers could not be checked, for ${reasons.length} reasons:`;
const summary = { made_by: 'tracks/watch/verify.mjs', since: cfg.since, found, checked: checked.length, inside: checked.filter((p) => p.verdict === 'inside').length, outside: checked.filter((p) => p.verdict === 'outside').length,
  not_checked: notChecked, checks: nChecks, checks_inside: nIn, checks_by_lean: n, checks_by_script: nChecks - n, reasons, holdout_dropped_by_reader: heldTotal, lean: { theorems: n, ok: leanOk }, sentence,
  by_usecase: cfg.usecases.map((u) => ({ id: u.id, title: u.title, group: u.group, found: all.filter((p) => p.usecase === u.id).length, checked: checked.filter((p) => p.usecase === u.id).length,
    candidate_laws: papers.filter((p) => p.usecase === u.id).reduce((a, p) => a + (p.candidate_laws?.length ?? 0), 0) })),
  caveat: 'A check is arithmetic on numbers a reader agent copied from the paper. The copying has not been re-checked by a second reader. No paper is certified.' };
fs.writeFileSync(EXT, JSON.stringify({ papers }, null, 1) + '\n');
fs.writeFileSync(SUM, JSON.stringify(summary, null, 1) + '\n');

// ---- badges: one small SVG per checked paper ----
const BDIR = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/tracks/badges');
fs.rmSync(BDIR, { recursive: true, force: true }); fs.mkdirSync(BDIR, { recursive: true });
for (const p of checked) {
  const cc = p.checks.filter((c) => c.result !== 'refused'), ci = cc.filter((c) => c.result === 'inside').length;
  p.badge = `${ci} of ${cc.length} checks inside`;
  const right = p.badge, col = ci === cc.length ? '#2e7d5b' : ci === 0 ? '#b3541e' : '#8a6d1a', w2 = 30 + right.length * 6.4;
  fs.writeFileSync(path.join(BDIR, `${p.slug}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${104 + w2}" height="20" role="img" aria-label="Lean4Bio checked: ${right}"><title>Lean4Bio checked: ${right}. Click for the proof.</title><rect width="104" height="20" fill="#3b4252"/><rect x="104" width="${w2}" height="20" fill="${col}"/><g fill="#fff" font-family="Verdana,Geneva,sans-serif" font-size="11"><text x="8" y="14">Lean4Bio checked</text><text x="112" y="14">${right}</text></g></svg>\n`);
}
fs.writeFileSync(EXT, JSON.stringify({ papers }, null, 1) + '\n'); // again, now with the badge text
printStatus();
if (leanOk === false) { console.log('LEAN REJECTED the generated instances:\n' + leanOut.split('\n').filter((l) => /REJECTED|error/.test(l)).slice(0, 10).join('\n')); process.exit(1); }
