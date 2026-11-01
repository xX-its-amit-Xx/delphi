#!/usr/bin/env node
// Cut a new law-set release from the current law files.
//   node lean/registry/release.mjs <semver> "<one-line note>" [--dry-run]
// Refuses when: a law's content_hash does not match its content (edit without a version bump), the version is
// not greater than the current one, or an 'accepted' law has no approval.approved_by_role (or the field looks
// like a personal identifier: it must be a lowercase role such as "project-lead" or "lean-assessor").
// Promotion to 'accepted' is a HUMAN edit to the law file; this script only checks that the edit was made.
// Existing lawset files are never rewritten, so every past verdict can be reproduced against its law set.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { REG, ROOT, LAWSETS_DIR, loadLaws, loadLawset, readJson, writeJson, contentHash, semverCmp, gitHead } from './registry-lib.mjs';

export const ROLE_RE = /^(human:)?[a-z][a-z0-9-]*$/; // a role, optionally marked human: (e.g. human:project-lead); never a personal identifier

export function releaseProblems(laws) {
  const p = [];
  for (const l of laws) {
    if (contentHash(l) !== l.content_hash) p.push(`${l.law_id}: content_hash does not match its content (bump version and recompute)`);
    if (l.status === 'accepted') {
      const role = l.approval && l.approval.approved_by_role;
      if (!role) p.push(`${l.law_id}: status accepted without approval.approved_by_role (a human must approve)`);
      else if (!ROLE_RE.test(role)) p.push(`${l.law_id}: approved_by_role "${role}" is not a role (lowercase, hyphenated; never a personal identifier)`);
    }
    if (l.status === 'retired' && !l.retired_reason) p.push(`${l.law_id}: retired without retired_reason`);
    if (l.status === 'contested' && !(l.contested_with || []).length) p.push(`${l.law_id}: contested without contested_with`);
  }
  return p;
}

export function changelogSection(prev, next, note) {
  const pm = new Map((prev?.laws || []).map(l => [l.law_id, l]));
  const lines = [`## ${next.version} (${next.created.slice(0, 10)})`, '', note || next.note || '', ''];
  const added = [], changed = [], status = [];
  for (const l of next.laws) {
    const o = pm.get(l.law_id);
    if (!o) added.push(`- added \`${l.law_id}\` ${l.version} (${l.kind}, ${l.status})`);
    else {
      if (o.version !== l.version || o.content_hash !== l.content_hash) changed.push(`- \`${l.law_id}\` ${o.version} -> ${l.version}`);
      if (o.status !== l.status) status.push(`- \`${l.law_id}\` ${o.status} -> ${l.status}`);
    }
  }
  const removed = [...pm.keys()].filter(k => !next.laws.some(l => l.law_id === k)).map(k => `- MISSING \`${k}\` (laws are never deleted; this is an error)`);
  if (!prev) { const c = {}; for (const l of next.laws) c[l.kind + ' ' + l.status] = (c[l.kind + ' ' + l.status] || 0) + 1; lines.push('Initial law set: ' + Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ') + '.', ''); }
  else { for (const [h, xs] of [['Added', added], ['Changed', changed], ['Status', status], ['Missing', removed]]) if (xs.length) lines.push(`### ${h}`, ...xs, ''); if (!added.length && !changed.length && !status.length) lines.push('No law changes.', ''); }
  return lines.join('\n');
}

/** Run one generator as a subprocess. Returns {script, ok, output}. */
function runStep(script) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { script, ok: r.status === 0, output: ((r.stdout || '') + (r.stderr || '')).trim().slice(-2000) };
}

/** The law-set versions the GENERATED checker embeds, read as text (no import of a large ESM file). */
export function lawsetsKnownToChecker() {
  const bc = fs.readFileSync(path.join(ROOT, 'lean/eliminate/browser-check.mjs'), 'utf8');
  const m = /export const LAWSETS = (\{[\s\S]*?\n\});/.exec(bc);
  if (!m) return null;
  try { return Object.keys(JSON.parse(m[1])); } catch { return null; }
}

/** Regenerate the checker and the static mirror, then ask the regenerated checker whether it knows `version`. */
export function regenerateCheckers(version) {
  const steps = [runStep('lean/eliminate/build-browser-check.mjs')];
  if (!steps[0].ok) return { steps, knows: false, known: [], reason: `${steps[0].script} failed: ${steps[0].output.slice(-400)}` };
  steps.push(runStep('dashboard/build-lean-api.mjs'));
  const known = lawsetsKnownToChecker();
  if (known === null) return { steps, knows: false, known: [], reason: 'could not read LAWSETS out of the generated lean/eliminate/browser-check.mjs' };
  if (!known.includes(version)) return { steps, knows: false, known, reason: `it knows ${known.join(', ')}` };
  if (!steps[1].ok) return { steps, knows: false, known, reason: `dashboard/build-lean-api.mjs failed: ${steps[1].output.slice(-400)}` };
  return { steps, known, knows: true, reason: null };
}

export function release(version, note, { dryRun = false, regenerate = true } = {}) {
  let regen = null;
  const cur = readJson(path.join(LAWSETS_DIR, 'current.json'));
  if (semverCmp(version, cur.version) <= 0) throw new Error(`version ${version} must be greater than current ${cur.version}`);
  const laws = loadLaws();
  const probs = releaseProblems(laws);
  if (probs.length) throw new Error('release refused:\n' + probs.join('\n'));
  const prev = loadLawset(cur.version);
  const next = { version, created: new Date().toISOString(), previous: cur.version, commit: gitHead(), note,
    laws: laws.map(l => ({ law_id: l.law_id, version: l.version, content_hash: l.content_hash, status: l.status, kind: l.kind })) };
  const firstIn = laws.filter(l => !l.introduced_in && l.status !== 'proposed' && l.status !== 'retired');
  const section = changelogSection(prev, next, note);
  if (!dryRun) {
    const f = path.join(LAWSETS_DIR, `lawset-${version}.json`);
    if (fs.existsSync(f)) throw new Error(f + ' exists; law sets are immutable');
    writeJson(f, next);
    for (const l of firstIn) { l.introduced_in = version; writeJson(path.join(REG, 'laws', l.law_id + '.json'), l); } // not a hashed field
    const cl = path.join(REG, 'CHANGELOG.md');
    const old = fs.readFileSync(cl, 'utf8');
    const head = old.indexOf('\n## ');
    fs.writeFileSync(cl, head < 0 ? old + '\n' + section : old.slice(0, head + 1) + section + '\n' + old.slice(head + 1));
    // Regenerate the checker and the mirror BEFORE pointing current.json at the new lawset.
    regen = regenerate ? regenerateCheckers(version) : { skipped: true, steps: [], known: lawsetsKnownToChecker() || [], knows: false, reason: '--no-regen' };
    if (!regen.knows) {
      const why = regen.skipped
        ? `--no-regen was passed: regenerate lean/eliminate/browser-check.mjs and point lawsets/current.json at ${version} yourself.`
        : `lean/eliminate/browser-check.mjs does not know law set ${version} after regeneration: ${regen.reason}`;
      throw new Error(`lawset-${version}.json and its CHANGELOG entry were written, but lawsets/current.json was NOT moved, `
        + `so every caller still judges against ${cur.version} and nothing is broken.\n${why}`);
    }
    writeJson(path.join(LAWSETS_DIR, 'current.json'), { version, file: `lawset-${version}.json` });
    regen.currentMoved = true;
    // The mirror embeds the current pointer, so rebuild it now that current.json names the new lawset.
    regen.steps.push(runStep('dashboard/build-lean-api.mjs'));
  }
  return { lawset: next, changelog: section, regen };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [version, note] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!version) { console.error('usage: node lean/registry/release.mjs <semver> "<note>" [--dry-run]'); process.exit(2); }
  try {
    const r = release(version, note || '', { dryRun: process.argv.includes('--dry-run'), regenerate: !process.argv.includes('--no-regen') });
    console.log(r.changelog);
    if (r.regen && !r.regen.skipped) console.log(`regenerated ${r.regen.steps.map(x => x.script + (x.ok ? ' ok' : ' FAILED')).join(', ')}; browser-check knows ${r.regen.known.join(', ')}; lawsets/current.json -> ${version}`);
  }
  catch (e) { console.error(e.message); process.exit(1); }
}
