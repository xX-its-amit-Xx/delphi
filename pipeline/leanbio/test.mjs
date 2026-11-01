#!/usr/bin/env node
// Tests for the LeanBio pipeline. Every check runs twice: on real input (must pass) and on deliberately broken input
// (must FAIL), so no check passes vacuously (the lean/registry/test.mjs convention). Offline: no network.
//   node pipeline/leanbio/test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, readJson, heldOutGuard, scanTrig } from './lib.mjs';
import { belief, PARAMS } from './belief.mjs';
import { decide, groundEntity } from './ground.mjs';
import { typeStatement } from './relations.mjs';
import { renderDraft, iriOf } from './draft.mjs';
import { registryProblems, criteriaProblems, draftProblems, holdoutProblems } from './check.mjs';
import { harvestQuery } from './harvest.mjs';
import { LEANBIO_TOOLS } from './tools.mjs';

let failures = 0;
function check(name, realFn, brokenFn) {
  const run = f => { try { return f(); } catch (e) { return [String(e.message || e)]; } };
  const real = run(realFn), broken = run(brokenFn);
  const realOk = Array.isArray(real) ? real.length === 0 : !!real;
  const brokenCaught = Array.isArray(broken) ? broken.length > 0 : !broken;
  const ok = realOk && brokenCaught;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${realOk ? '' : `\n     real input: ${JSON.stringify(real).slice(0, 400)}`}${brokenCaught ? '' : '\n     broken input was NOT caught'}`);
}
const near = (a, b) => Math.abs(a - b) < 1e-9;
const M = (side, cls, key) => ({ side, cls, key });

// ── belief ──
check('belief: INDRA form, two model votes -> 1 - (0.25 + 0.45^2) = 0.5475 -> 0.548',
  () => belief([M('support', 'model-elicitation', 'a'), M('support', 'model-elicitation', 'b')]).belief === 0.548,
  () => belief([M('support', 'model-elicitation', 'a'), M('support', 'model-elicitation', 'b')], { ...PARAMS, classes: { ...PARAMS.classes, 'model-elicitation': { rand: 0.9, syst: 0.5 } } }).belief === 0.548);
check('belief: the same source key counts once (independence)',
  () => belief([M('support', 'literature', 'doi:x'), M('support', 'literature', 'doi:x')]).n.support.literature === 1,
  () => belief([M('support', 'literature', 'doi:x'), M('support', 'literature', 'doi:y')]).n.support.literature === 1);
check('belief: contradiction lowers belief, belief = E * (1 - R)',
  () => { const b = belief([M('support', 'preregistered-test', 't'), M('contradict', 'model-elicitation', 'm')]); return near(b.belief, Math.round(b.E * (1 - b.R) * 1000) / 1000) && b.belief < b.E; },
  () => { const b = belief([M('support', 'preregistered-test', 't')]); return b.belief < b.E; });
check('belief: no evidence -> 0; unknown class throws',
  () => belief([]).belief === 0 && (() => { try { belief([M('support', 'vibes', 'x')]); return false; } catch { return true; } })(),
  () => belief([M('support', 'model-elicitation', 'a')]).belief === 0);

// ── grounding acceptance rule (on cached-shape candidates; no network) ──
check('ground: synonym hit with no shared stem is rejected ("mass" -> FBN1 0.54)',
  () => decide('mass', [{ db: 'HGNC', id: 'HGNC:3603', name: 'FBN1', score: 0.54 }]).status === 'low-confidence',
  () => decide('mass', [{ db: 'HGNC', id: 'HGNC:3603', name: 'FBN1', score: 0.74 }]).status === 'low-confidence');
check('ground: low score accepted when the entry shares a stem ("allele" -> Alleles 0.54)',
  () => decide('allele', [{ db: 'MESH', id: 'MESH:D000483', name: 'Alleles', score: 0.54 }]).status === 'grounded',
  () => decide('allele', [{ db: 'MESH', id: 'MESH:D000483', name: 'Alleles', score: 0.40 }]).status === 'grounded');
check('ground: two different entries within 0.05 are flagged ambiguous, not auto-resolved',
  () => decide('ra', [{ db: 'CHEBI', id: 'CHEBI:1', name: 'retinoic acid', score: 0.78 }, { db: 'MESH', id: 'MESH:D2', name: 'Rheumatoid arthritis', score: 0.76 }]).status === 'ambiguous',
  () => decide('ra', [{ db: 'CHEBI', id: 'CHEBI:1', name: 'retinoic acid', score: 0.78 }, { db: 'MESH', id: 'MESH:D2', name: 'Rheumatoid arthritis', score: 0.56 }]).status === 'ambiguous');
const offlineEntity = await groundEntity('UBERON_0000151', { offline: true });
const offlineFake = await groundEntity('UBERON_9999999', { offline: true });
check('ground: a declared identifier is verified against OLS4 (cached), an unknown one is not "grounded"',
  () => offlineEntity.status === 'grounded' && offlineEntity.best.name === 'pectoral fin' && offlineFake.status !== 'grounded',
  () => offlineFake.status === 'grounded');

// ── statement typing ──
const ms = [{ text: 'BMP4', start: 0, status: 'grounded', best: { db: 'HGNC', id: 'HGNC:1071', name: 'BMP4' } }, { text: 'retinoic acid', start: 14, status: 'grounded', best: { db: 'CHEBI', id: 'CHEBI:26536', name: 'retinoic acid' } }];
check('relations: INDRA Inhibition needs grounded molecular subject and object',
  () => { const t = typeStatement('BMP4 inhibits retinoic acid', ms); return t.type === 'Inhibition' && t.subject.id === 'HGNC:1071' && t.object.id === 'CHEBI:26536'; },
  () => typeStatement('Fins inhibits growth', []).type === 'Inhibition');
check('relations: law family and meta records',
  () => typeStatement('Weight varies as the cube of length').type === 'ScalingLaw' && typeStatement('x', [], { types: ['LLMClaimAssessment'] }).formalizable === 'no',
  () => typeStatement('Weight is heavy').type === 'ScalingLaw');

// ── held-out guard ──
const g = heldOutGuard();
const holdoutOnly = readJson(path.join(ROOT, 'holdout/exam.json')).claims_mentioning_holdout.find(c => c.side === 'holdout');
check('guard: a holdout-only claim id is withheld; an unrelated claim is not',
  () => g.hits('', holdoutOnly.id) && !g.hits('Weight varies as the cube of length', 'thompson1917-ch02-01'),
  () => g.hits('Weight varies as the cube of length', 'thompson1917-ch02-01'));

// ── drafts, checks, harvest ──
const recs = readJson(path.join(OUT, 'records.json')).records;
const rec = recs.find(r => r.id === 'maynardsmith-hitchhiking');
const ttl = renderDraft(rec, { created: '2026-11-01T00:00:00Z' });
check('draft: unsigned, software-agent creator, no ORCID, belief and relation present',
  () => draftProblems([['x.trig', ttl]]).length === 0 && /leanbio_belief/.test(ttl) && /relation_type/.test(ttl) && scanTrig(ttl).orcid === false,
  () => draftProblems([['x.trig', ttl.replace('UNSIGNED DRAFT', 'signed').replace('dct:creator', 'dct:creator <https://orcid.org/0000-0002-1825-0097> ; dct:creator')]]).length === 0);
check('draft: OBO ids resolve to purl.obolibrary.org, others to bioregistry',
  () => iriOf('UBERON:0000151') === 'http://purl.obolibrary.org/obo/UBERON_0000151' && iriOf('HGNC:1071') === 'https://bioregistry.io/hgnc:1071',
  () => iriOf('HGNC:1071') === 'http://purl.obolibrary.org/obo/HGNC_1071');
const laws = fs.readdirSync(path.join(ROOT, 'lean/registry/laws')).map(f => readJson(path.join(ROOT, 'lean/registry/laws', f)));
const schema = readJson(path.join(ROOT, 'lean/registry/laws-registry.schema.json'));
const byId = new Map(recs.map(r => [r.id, r]));
const mine = laws.find(l => l.law_id === 'maynardsmith-hitchhiking');
check('check: registry schema and content hash (tampered statement is caught)',
  () => registryProblems(laws, schema),
  () => registryProblems([{ ...mine, statement_en: mine.statement_en + ' (edited)' }], schema));
check('check: LeanBio criteria (missing witness, unsourced hypothesis, low belief are caught)',
  () => criteriaProblems(laws, byId),
  () => criteriaProblems([{ ...mine, non_vacuity_witness: null, hypotheses: [{ name: 'h', statement: 's' }] }], new Map([[mine.law_id, { ...rec, belief: { belief: 0.2 } }]])));
check('check: personal identifier in approval is refused',
  () => criteriaProblems([{ ...mine, status: 'accepted', approval: { approved_by_role: 'human:project-lead', date: '2026-11-01', basis: 'x' } }], byId),
  () => criteriaProblems([{ ...mine, status: 'accepted', approval: { approved_by_role: 'someone@example.org', date: '2026-11-01', basis: 'x' } }], byId));
check('check: held-out leak scan of outputs',
  () => holdoutProblems([['out.json', JSON.stringify(recs.slice(0, 50))]]),
  () => holdoutProblems([['out.json', JSON.stringify({ note: holdoutOnly.id })]]));
check('harvest: read-only SELECT, injection refused',
  () => /^PREFIX[\s\S]*SELECT DISTINCT/.test(harvestQuery({})) && !/INSERT|DELETE/i.test(harvestQuery({})),
  () => harvestQuery({ type: 'x> } ; DROP ALL ; <y' }).length > 0);
check('tools: three MCP tools with schemas and handlers',
  () => LEANBIO_TOOLS.map(t => t.name).join() === 'leanbio_queue,leanbio_ground,leanbio_claim' && LEANBIO_TOOLS.every(t => t.inputSchema && typeof t.handler === 'function'),
  () => LEANBIO_TOOLS.length === 4);
const q = await LEANBIO_TOOLS[0].handler({ limit: 3 });
const c = await LEANBIO_TOOLS[2].handler({ id: 'maynardsmith-hitchhiking' });
check('tools: queue is ordered and the proposed law shows as linked, not queued',
  () => q.result.items.length === 3 && q.result.items[0].rank === 1 && c.result.linked_laws.some(l => l.law_id === 'maynardsmith-hitchhiking' && l.status === 'candidate') && !c.result.queue.rank,
  () => q.result.items[0].rank === 2);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed (each also failed once on broken input)');
process.exit(failures ? 1 : 0);
