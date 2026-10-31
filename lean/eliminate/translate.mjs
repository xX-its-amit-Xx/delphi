#!/usr/bin/env node
// Joins the lean thread's hand-written readings (lean/eliminate/translations.json) with the enumerator's
// records (open-problems/candidates.json, open-problems/problems.json) into checker-schema candidates:
//   node lean/eliminate/translate.mjs  -> open-problems/candidates.formal.json
// Every original field is copied, never retyped: id, problem_id, origin, uses_illustrative_values, statement,
// commits_to (the original English commitments), source, and the problem's question and source. The lean
// thread adds: reading (one sentence on how the English was read), accepts, commits, cannotRule, notFormalised,
// untranslatable. A candidate with checkable_against but no translation is an error, so nothing is silently dropped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const C = JSON.parse(fs.readFileSync(path.join(root, 'open-problems/candidates.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(root, 'open-problems/problems.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(here, 'translations.json'), 'utf8'));
const probs = Object.fromEntries((P.problems || P).map(p => [p.id, p]));
const SLUG = { 'square-cube': ['C7', 'C7b'], 'kimura-neutral-rate': ['C1', 'C1b'], 'neutral-fixation-probability': ['C2', 'C3'], 'neutral-substitution-budget': ['C3b'], 'fisher-fundamental-theorem-haploid': ['C4', 'C4b', 'C4c'], 'twofold-cost-of-sex': ['C5', 'C5b'], 'blueprint-well-formedness': ['C6'] };

const out = [];
const missing = [];
for (const c of C.candidates) {
  if (!c.checkable_against || c.checkable_against.length === 0) continue;
  const t = T.translations[c.id];
  if (!t) { missing.push(c.id); continue; }
  const p = probs[c.problem_id] || {};
  const provenance = c.origin === 'source' ? 'published (drawn from the cited source)' : c.origin === 'source-hypothesis+formalized-here' ? 'published hypothesis, quantitative condition added by the enumerator' : 'proposed-here (written by the enumerator, not literature)';
  out.push({
    id: c.id, problem_id: c.problem_id,
    problem: p.question || p.statement || null, problem_source: p.source || null, problem_category: p.category || null,
    origin: c.origin, provenance, uses_illustrative_values: !!c.uses_illustrative_values,
    original_statement: c.statement, original_commits: c.commits_to, original_source: c.source || null,
    checkable_against: c.checkable_against, constraints_tagged: c.checkable_against.flatMap(s => SLUG[s] || []), checkable_rationale: c.checkable_rationale || null, notes: c.notes || null,
    reading: t.reading || null,
    untranslatable: t.untranslatable || null,
    accepts: t.accepts || [], commits: t.commits || {},
    cannotRule: t.cannotRule || {}, notFormalised: t.notFormalised || [],
    translated_by: 'lean thread (Claude Fable 5.1), 2026-10-31; see lean/eliminate/translations.json'
  });
}
if (missing.length) { console.error('no translation for: ' + missing.join(', ')); process.exit(1); }
const doc = { _about: 'Checker-schema translations of the enumerator\'s checkable candidates (open-problems/candidates.json), written by the lean thread. Each row keeps the original English commitment beside the formal one and a one-sentence reading. uses_illustrative_values and origin are carried through unchanged: an elimination of a proposed-here candidate with illustrative values eliminates the enumerator\'s own numbers, not a published hypothesis. Reason codes and the policy against inventing numbers: lean/eliminate/translations.json _about.', built: new Date().toISOString(), source_candidates: 'open-problems/candidates.json', source_problems: 'open-problems/problems.json', reasonCodes: ['not-formalised', 'premise-rejected', 'outside-model', 'adopts-theorem', 'no-graph', 'untranslatable'], count: out.length, candidates: out };
fs.writeFileSync(path.join(root, 'open-problems/candidates.formal.json'), JSON.stringify(doc, null, 1));
console.log(`open-problems/candidates.formal.json: ${out.length} candidates (${out.filter(x => x.untranslatable).length} untranslatable, ${out.filter(x => Object.keys(x.commits).length).length} with formal commitments, ${out.filter(x => x.uses_illustrative_values).length} with illustrative values)`);
