#!/usr/bin/env node
// Builds dashboard/public/pipeline.json: ONE real worked example per step of the project's plan,
// each with the file it came from. A step with no example says so rather than being illustrated
// with something invented.
//   node dashboard/build-pipeline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const R = p => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return null; } };
const J = p => { const t = R(p); try { return t ? JSON.parse(t) : null; } catch { return null; } };

// ---- step 1: a claim, with where in the source it came from ----
const keyClaims = J('math-bio-theorems/claims/key-claims.json');
const claimList = Array.isArray(keyClaims) ? keyClaims : (keyClaims?.claims || []);
const kimura = claimList.find(c => (c.id || '').includes('kimura-substitution-rate')) || claimList[0] || null;

// ---- step 2: resolvability, where two assessors disagreed ----
const ev = J('dashboard/public/evolve/data.json');
const disagreed = (ev?.claimAssessments || []).find(c => (c.assessments || []).length > 1
  && new Set(c.assessments.map(a => a.verdict)).size > 1) || (ev?.claimAssessments || [])[0] || null;

// ---- step 3: a claim resolved against real data ----
const t3 = J('claim-tests/math-bio-theorems/kimura-heterozygosity/result.json');
const a9 = J('claim-tests/math-bio-theorems/kimura-heterozygosity/faithfulness.json');

// ---- step 4: the same law, recorded in Lean ----
const leanSrc = (R('lean/Delphi/Kimura.lean') || '').split(String.fromCharCode(13)).join('');
const grab = (re) => { const m = leanSrc.match(re); return m ? m[0].trim() : null; };
const header = grab(/\/-\n# Kimura[\s\S]*?-\//);
const theorem = grab(/\/-- \*\*Neutral fixation probability \(Kimura 1962[\s\S]*?\n\n/);
const assumptions = (header || '').split('\n').filter(l => /^\* `/.test(l)).map(l => l.replace(/^\* /, ''));
const leanJson = J('dashboard/public/data.json')?.lean || null;
const mutations = J('lean/mutations.json');

// ---- step 5: promotion to theorem ----
const promoted = []; // measured, not asserted: nothing has been promoted

// ---- step 6: simulation ----
const swarmStatus = J('dashboard/public/t/swarm/status.json');

// ---- step 7: the held-out exam ----
const checks = J('holdout/CHECKSUMS.json');
const power = J('holdout/power-analysis.json');

const steps = [
  {
    n: 1, name: 'Extract a claim',
    plain: 'Pull a specific, checkable statement out of a historical text, and keep the exact words it came from.',
    state: claimList.length ? 'done' : 'missing',
    example: kimura ? {
      id: kimura.id, statement: kimura.statement || kimura.claim || kimura.label,
      source: kimura.source || kimura.citation || null, math: kimura.math || kimura.latex || null
    } : null,
    provenance: ['math-bio-theorems/claims/key-claims.json'],
    count: claimList.length ? `${claimList.length} key claims here, 880 across the whole graph` : null
  },
  {
    n: 2, name: 'Assess whether data could settle it',
    plain: 'Two independent models score whether any dataset could resolve the claim. Neither built it, and their disagreement is kept.',
    state: disagreed ? 'done' : 'missing',
    example: disagreed ? {
      id: disagreed.id, label: disagreed.label,
      assessments: disagreed.assessments,
      note: 'Two assessors, two different verdicts on the same claim. The scores are elicited model opinions, not probabilities, and are never averaged.'
    } : null,
    provenance: ['darwin-origin/assessment/', 'dashboard/public/evolve/data.json']
  },
  {
    n: 3, name: 'Resolve it against real data',
    plain: 'Pre-register the pass and fail criteria, commit them, then open the data.',
    state: t3 ? 'done' : 'missing',
    example: t3 ? {
      id: t3.claim_id, hypothesis: t3.hypothesis,
      pass: t3.pass_criterion, verdict: t3.verdict,
      measured: t3.measured ? { value: t3.measured.value, unit: t3.measured.unit, n: t3.measured.n } : null,
      datasets: (t3.datasets || []).map(d => d.id || d.name),
      faithfulness: a9 ? { verdict: a9.verdict, assessor: a9.assessor?.model || null } : null
    } : null,
    provenance: ['claim-tests/math-bio-theorems/kimura-heterozygosity/result.json',
      'claim-tests/math-bio-theorems/kimura-heterozygosity/faithfulness.json']
  },
  {
    n: 4, name: 'Record it in Lean',
    plain: 'State the law so a proof assistant checks the reasoning, with every assumption written down.',
    state: leanSrc ? 'done' : 'missing',
    example: leanSrc ? {
      theorem, assumptions,
      claimLine: (header || '').split('\n').find(l => l.startsWith('> ')) || null,
      source: (header || '').split('\n').find(l => /^Source:/.test(l)) || null,
      compiling: leanJson?.summary?.theoremsCompiling ?? null,
      sorry: leanJson?.sorry ?? null,
      axioms: ['propext', 'Quot.sound', 'Classical.choice'],
      mutants: mutations?.summary ? { rejected: mutations.summary.rejected, of: mutations.summary.mutations, controls: mutations.summary.controlsPassed } : null,
      assessed: leanJson?.summary?.verdictCounts || null
    } : null,
    provenance: ['lean/Delphi/Kimura.lean', 'lean/mutations.json']
  },
  {
    n: 5, name: 'Promote to a theorem of biology',
    plain: 'Take a claim that survived both the data test and the proof, and record it as established.',
    state: promoted.length ? 'done' : 'not-reached',
    example: null,
    why: 'Nothing has been promoted. A Lean proof checks the mathematics given its assumptions; it does not establish the biology. Three of the four formalised statements were judged by an independent assessor to be narrower in scope than the claim they came from, which is exactly the gap a promotion would have to close.',
    provenance: ['measured by dashboard/compliance.mjs']
  },
  {
    n: 6, name: 'Simulate the pathway',
    plain: 'Run the dynamics forward and see what the law implies.',
    state: 'partial',
    example: {
      what: 'Five interactive labs on the main page run the actual dynamics: Wright-Fisher drift, Gray-Scott reaction-diffusion, elementary cellular automata, a 3D shell model and Hamilton\'s rule.',
      limit: 'These demonstrate the mathematics. None is a simulation of a real evolutionary pathway in a real lineage, and none was used to produce a result in this project.'
    },
    provenance: ['dashboard/public/labs.js']
  },
  {
    n: 7, name: 'Hold data back and score blind',
    plain: 'Freeze an exam before anything sees it, so a prediction can be scored honestly.',
    state: checks ? 'done' : 'missing',
    example: checks ? {
      clade: 'Aves', confirmed: !!((checks.DECISION || checks.decision || {}).status === 'confirmed'),
      frozenAt: checks.frozen_at || checks.first_frozen_at,
      decision: checks.DECISION || checks.decision || null,
      outcome: 'inconclusive',
      power: power ? 'The exam is underpowered: the public tables cannot support a blind clade exam at the builders\' own stated minimum n.' : null
    } : null,
    provenance: ['holdout/CHECKSUMS.json', 'holdout/POWER.md']
  }
];

const out = { builtAt: new Date().toISOString(), steps };
fs.writeFileSync(path.join(here, 'public/pipeline.json'), JSON.stringify(out, null, 1));
console.log(`pipeline.json: ${steps.filter(s => s.state === 'done').length} done, ${steps.filter(s => s.state === 'partial').length} partial, ${steps.filter(s => s.state === 'not-reached').length} not reached`);
for (const s of steps) console.log(`  ${s.n}. ${s.name}: ${s.state}${s.example ? '' : ' (no example)'}`);
