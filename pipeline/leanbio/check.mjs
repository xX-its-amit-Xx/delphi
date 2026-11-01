#!/usr/bin/env node
// LeanBio proposal checks, node only (no Lean build, no network). Run in CI by .github/workflows/leanbio-proposal.yml.
//
//   node pipeline/leanbio/check.mjs
//
// 1. pipeline   every claim and draft has a grounding pass and a belief score, and committed outputs are current
//               (node pipeline/leanbio/run.mjs --check, offline from the committed cache)
// 2. registry   every law file validates against lean/registry/laws-registry.schema.json, and its content_hash matches
// 3. criteria   every law that is not accepted/retired meets the LeanBio proposal criteria (CONTRIBUTING-LEANBIO.md):
//               named hypotheses with sources, a non-vacuity witness, a scope, no personal identifier in approval;
//               a law tied to a LeanBio record also needs belief >= the queue threshold and >= 1 grounded entity
// 4. drafts     no human ORCID and no unsigned-draft marker missing in pipeline/leanbio/nanopubs/unsigned/*.trig
// 5. holdout    no pipeline output names the held-out clade's organisms or holdout-only claim ids
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HERE, OUT, ROOT, readJson, exists, heldOutGuard } from './lib.mjs';
import { PARAMS } from './belief.mjs';
import { validate, contentHash } from '../../lean/registry/registry-lib.mjs';

const PERSONAL = /@|orcid|\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/i;

export function registryProblems(laws, schema) {
  const out = [];
  for (const l of laws) {
    for (const e of validate(schema, l)) out.push(`${l.law_id}: schema ${e}`);
    if (l.content_hash && contentHash(l) !== l.content_hash) out.push(`${l.law_id}: content_hash does not match its hashed fields (bump version and rehash)`);
  }
  return out;
}

export function criteriaProblems(laws, recordsById, params = PARAMS) {
  const out = [];
  for (const l of laws) {
    if (l.status === 'accepted' && (!l.approval || !l.approval.approved_by_role)) out.push(`${l.law_id}: accepted without approval.approved_by_role`);
    if (l.approval && PERSONAL.test(JSON.stringify(l.approval))) out.push(`${l.law_id}: approval carries a personal identifier; write a role`);
    if (['accepted', 'retired'].includes(l.status) || l.class === 'gap') continue;
    const leanbio = String(l.origin?.by_role || '').startsWith('agent:leanbio') || recordsById.has(l.law_id) && String(l.lean_ref?.module || '').includes('proposals/');
    if (!leanbio) continue; // criteria apply to LeanBio proposals; other threads' candidates follow lean/registry/README.md
    if (!l.hypotheses?.length) out.push(`${l.law_id}: no named hypotheses`);
    for (const h of l.hypotheses || []) if (!h.source) out.push(`${l.law_id}: hypothesis ${h.name} has no source`);
    if (!l.non_vacuity_witness?.lean) out.push(`${l.law_id}: no non-vacuity witness`);
    if (!l.scope?.taxa?.length) out.push(`${l.law_id}: scope.taxa missing`);
    const r = recordsById.get(l.law_id);
    if (!r) { out.push(`${l.law_id}: LeanBio proposal with no LeanBio record (law_id must be the claim id, or draft:<path>)`); continue; }
    if (!(r.belief?.belief >= params.queue.min_belief)) out.push(`${l.law_id}: belief ${r.belief?.belief} below ${params.queue.min_belief}`);
    if (!r.entities?.length) out.push(`${l.law_id}: no grounded entity in its record`);
  }
  return out;
}

export function draftProblems(files) {
  const out = [];
  for (const [f, src] of files) {
    if (/orcid\.org\/\d{4}-/.test(src)) out.push(`${f}: names a human ORCID; drafts carry the software agent only`);
    if (!/UNSIGNED DRAFT/.test(src)) out.push(`${f}: missing the UNSIGNED DRAFT statement`);
    if (/^\s*sub:sig\b|npx:hasSignature/m.test(src)) out.push(`${f}: carries a signature block; drafts are never signed here`);
  }
  return out;
}

export function holdoutProblems(files, guard = heldOutGuard()) {
  // Scan values, not this pipeline's own code (which reads the roster at run time and names no organism).
  return files.filter(([, src]) => guard.hits(src)).map(([f]) => `${f}: touches the held-out clade`);
}

const listFiles = (dir, ext) => (exists(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(ext)).map(f => path.join(dir, f)) : []);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const problems = [];
  const r = spawnSync(process.execPath, [path.join(HERE, 'run.mjs'), '--check'], { encoding: 'utf8' });
  if (r.status !== 0) problems.push(`pipeline: ${(r.stderr || r.stdout).trim()}`);
  else console.log(r.stdout.trim());
  const lawsDir = path.join(ROOT, 'lean/registry/laws');
  const laws = listFiles(lawsDir, '.json').map(f => readJson(f));
  const schema = readJson(path.join(ROOT, 'lean/registry/laws-registry.schema.json'));
  problems.push(...registryProblems(laws, schema).map(p => `registry: ${p}`));
  const recs = new Map(readJson(path.join(OUT, 'records.json')).records.map(x => [x.id, x]));
  problems.push(...criteriaProblems(laws, recs).map(p => `criteria: ${p}`));
  const drafts = listFiles(path.join(HERE, 'nanopubs/unsigned'), '.trig').map(f => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]);
  problems.push(...draftProblems(drafts).map(p => `drafts: ${p}`));
  const outputs = [...listFiles(OUT, '.json'), path.join(ROOT, 'dashboard/public/leanbio/data.json'), path.join(ROOT, 'dashboard/public/leanbio/index.html')].filter(exists).map(f => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]);
  problems.push(...holdoutProblems([...outputs, ...drafts]).map(p => `holdout: ${p}`));
  if (problems.length) { console.error(`leanbio check: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`); process.exit(1); }
  console.log(`leanbio check: OK (${laws.length} law files valid, LeanBio criteria met, ${drafts.length} drafts unsigned with no ORCID, no held-out leak in outputs)`);
}
