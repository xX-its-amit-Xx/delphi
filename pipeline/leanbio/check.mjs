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

/** Classes whose law ASSERTS an empirical regularity, so the belief gate (criterion 3) applies.
 * A 'theorem' or 'theorem-from-hypothesis' law asserts only that its conclusion follows from its
 * NAMED HYPOTHESES; it never asserts that organisms satisfy them, so claim-level belief is not
 * evidence for or against it. House rule, decided 2026-11-01, and the converse of the rule already
 * in pipeline/leanbio/README.md section 6: a Lean proof is not evidence, because it proves a
 * model's consequence rather than that organisms obey the model -- and equally, a refuted empirical
 * claim does not refute a model theorem derived from it. A model theorem is judged on soundness
 * (propose.mjs), scope (below), and whether it binds anything (the browser_check block, reported by
 * lean/registry/check-exposed.mjs as laws_without_browser_evaluation). */
export const EMPIRICAL_CLASSES = ['empirical-observation', 'named-hypothesis'];

/** Whether the LeanBio criteria apply to this law at all (other threads' candidates follow
 * lean/registry/README.md instead). Shared by criteriaProblems and criteriaNotes so the two can
 * never disagree about which laws they are talking about. */
export const isLeanBio = (l, recordsById) => String(l.origin?.by_role || '').startsWith('agent:leanbio')
  || (recordsById.has(l.law_id) && String(l.lean_ref?.module || '').includes('proposals/'));
export const assertsEmpiricalRegularity = l => EMPIRICAL_CLASSES.includes(l.class);

/** A law may be distilled from the repo's own measured data rather than from a claim or a draft.
 * Criterion 1 wants the source to RESOLVE; for a data origin that means the file is in the tree.
 * Returns the repo-relative path, or null when no source names an existing repo file. */
export function dataOrigin(l) {
  for (const s of [...(l.sources || []), ...(l.evidence?.sources || [])]) {
    const p = String(s).split(/[\s(]/)[0];
    if (/^[\w.-]+\/[\w./-]+\.(json|csv|tsv|trig)$/.test(p) && exists(path.join(ROOT, p))) return p;
  }
  return null;
}

/** Belief scores that are computed but NOT gating, with the reason. Printed, never silent: an
 * exemption nobody can see is the same failure as a gate nobody can justify. */
export function criteriaNotes(laws, recordsById, params = PARAMS) {
  const out = [];
  for (const l of laws) {
    if (['accepted', 'retired'].includes(l.status) || l.class === 'gap') continue;
    // Same scope as criteriaProblems: these notes explain why a LeanBio criterion did not gate.
    // Another thread's law is silent here because the criteria never applied to it at all, which is
    // a different reason, and saying otherwise would misdescribe its standing.
    if (!isLeanBio(l, recordsById)) continue;
    const r = recordsById.get(l.law_id);
    if (r && !assertsEmpiricalRegularity(l) && !(r.belief?.belief >= params.queue.min_belief))
      out.push(`${l.law_id}: belief ${r.belief?.belief} is below ${params.queue.min_belief} but does NOT gate, because class '${l.class}' asserts only that its conclusion follows from its named hypotheses. Judge it on soundness, scope and whether it binds. The low belief is about the CLAIM it was distilled from and is worth reading: ${(r.evidence_items || []).filter(e => e.side === 'contradict').map(e => e.note).join('; ') || 'no contradicting evidence recorded'}`);
    const d = !r && dataOrigin(l);
    if (d) out.push(`${l.law_id}: no claim or draft record; distilled from repo data ${d} (origin data:${d}), so the belief and grounded-entity criteria do not apply. Its source must resolve, and it does.`);
  }
  return out;
}

export function criteriaProblems(laws, recordsById, params = PARAMS) {
  const out = [];
  for (const l of laws) {
    if (l.status === 'accepted' && (!l.approval || !l.approval.approved_by_role)) out.push(`${l.law_id}: accepted without approval.approved_by_role`);
    if (l.approval && PERSONAL.test(JSON.stringify(l.approval))) out.push(`${l.law_id}: approval carries a personal identifier; write a role`);
    if (['accepted', 'retired'].includes(l.status) || l.class === 'gap') continue;
    if (!isLeanBio(l, recordsById)) continue; // other threads' candidates follow lean/registry/README.md
    if (!l.hypotheses?.length) out.push(`${l.law_id}: no named hypotheses`);
    for (const h of l.hypotheses || []) if (!h.source) out.push(`${l.law_id}: hypothesis ${h.name} has no source`);
    if (!l.non_vacuity_witness?.lean) out.push(`${l.law_id}: no non-vacuity witness`);
    if (!l.scope?.taxa?.length) out.push(`${l.law_id}: scope.taxa missing`);
    const r = recordsById.get(l.law_id);
    if (!r) {
      // A law may be distilled from the repo's own measured data instead of from a claim or draft.
      // Rejecting that while accepting an aphorism-derived law is backwards, so a resolving
      // data: origin is a legitimate lineage (decided 2026-11-01).
      const d = dataOrigin(l);
      if (!d) out.push(`${l.law_id}: LeanBio proposal with no LeanBio record (law_id must be the claim id, draft:<path>, or a law whose sources name an existing repo data file, origin data:<path>)`);
      continue;
    }
    // Criterion 3, scoped: the belief gate applies to laws that ASSERT an empirical regularity.
    // criteriaNotes() prints the ungated score with its reason, so no exemption is silent.
    if (assertsEmpiricalRegularity(l) && !(r.belief?.belief >= params.queue.min_belief))
      out.push(`${l.law_id}: belief ${r.belief?.belief} below ${params.queue.min_belief} (class '${l.class}' asserts an empirical regularity, so the belief gate applies)`);
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
  const notes = criteriaNotes(laws, recs);
  if (notes.length) console.log(`leanbio criteria notes (${notes.length}; not failures, and not silent):\n  ${notes.join('\n  ')}`);
  const drafts = listFiles(path.join(HERE, 'nanopubs/unsigned'), '.trig').map(f => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]);
  problems.push(...draftProblems(drafts).map(p => `drafts: ${p}`));
  const outputs = [...listFiles(OUT, '.json'), path.join(ROOT, 'dashboard/public/leanbio/data.json'), path.join(ROOT, 'dashboard/public/leanbio/index.html')].filter(exists).map(f => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]);
  problems.push(...holdoutProblems([...outputs, ...drafts]).map(p => `holdout: ${p}`));
  if (problems.length) { console.error(`leanbio check: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`); process.exit(1); }
  console.log(`leanbio check: OK (${laws.length} law files valid, LeanBio criteria met, ${drafts.length} drafts unsigned with no ORCID, no held-out leak in outputs)`);
}
