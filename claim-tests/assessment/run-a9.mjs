#!/usr/bin/env node
// Role A9, the faithfulness assessor, for DATA tests.
//
// Asks an independent model one question: does this analysis measure what the claim asserts?
// The assessor is never the builder and never the builder's model (AGENTS.md), so this runs on a
// non-Anthropic provider. It is also blinded to the builder's verdict, confidence and interpretation,
// so it cannot anchor on the conclusion it is meant to check.
//
//   OPENAI_API_KEY=... node claim-tests/assessment/run-a9.mjs --tests <id>,<id> [--model gpt-5]
// Writes claim-tests/<project>/<id>/faithfulness.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg('model', 'gpt-5');
const only = (arg('tests', '') || '').split(',').filter(Boolean);

const find = () => {
  const out = [];
  for (const proj of fs.readdirSync(path.join(root, 'claim-tests'), { withFileTypes: true })) {
    if (!proj.isDirectory() || proj.name === 'assessment' || proj.name === 'nanopubs') continue;
    const pd = path.join(root, 'claim-tests', proj.name);
    for (const t of fs.readdirSync(pd, { withFileTypes: true })) {
      if (!t.isDirectory()) continue;
      const rp = path.join(pd, t.name, 'result.json');
      if (fs.existsSync(rp)) out.push({ project: proj.name, id: t.name, dir: path.join(pd, t.name), result: rp });
    }
  }
  return out;
};

// What the assessor sees. Deliberately NOT: verdict, confidence, interpretation, caveats.
const buildPrompt = r => `You are assessing whether a scientific data analysis measures what a historical claim actually asserts.

You are an INDEPENDENT assessor. You did not design this test. Your job is not to decide whether the claim is
true, and not to re-run the numbers. Your job is one question: **does this analysis measure the thing the claim
is about?**

## The claim
${r.claim_text || r.hypothesis}

## The operational hypothesis the testers wrote
${r.hypothesis}

## What they pre-registered as passing
${r.pass_criterion}

## What they pre-registered as failing
${r.fail_criterion}

## The data they used
${(r.datasets || []).map(d => `- ${d.id || d.name}: ${(d.description || d.title || '').slice(0, 300)}${d.url ? ` (${d.url})` : ''}`).join('\n') || '(none listed)'}

## What they did
${(r.method || '').slice(0, 2500)}

## What they measured
value: ${r.measured?.value}
unit: ${r.measured?.unit}
sample: ${r.measured?.n}
uncertainty: ${r.measured?.uncertainty}

## Judge these four dimensions, each 0, 0.25, 0.5, 0.75 or 1

1. **same_quantity** — is the quantity measured the quantity the claim is about, or a proxy standing in for it? If a proxy, is the substitution stated and defensible?
2. **modality_fits** — is this kind of data capable of bearing on this kind of claim at all?
3. **assumptions_compatible** — are the analysis's assumptions compatible with how the data was actually collected (sampling, units, population, measurement protocol)?
4. **scope_matches** — does the population and range analysed match the scope the claim asserts, or is it narrower or broader in a way that changes the answer?

Then give ONE overall verdict from exactly this list:
- "faithful" — the analysis measures what the claim asserts
- "faithful-with-narrower-scope" — it measures the right thing on a narrower slice than the claim covers
- "proxy-dependent" — it rests on a proxy that could reasonably be disputed
- "not-representative" — it does not measure what the claim asserts

Be willing to say "not-representative". An assessor that never fails anything is worthless.

Reply with ONLY a JSON object, no prose around it:
{"verdict":"...","scores":{"same_quantity":0.0,"modality_fits":0.0,"assumptions_compatible":0.0,"scope_matches":0.0},"reasoning":"<3-5 sentences>","what_would_change_it":"<1-2 sentences>","biggest_risk":"<the single most likely way this analysis is measuring the wrong thing>"}`;

async function ask(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }] })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(j).slice(0, 400));
  return { text: j.choices?.[0]?.message?.content || '', model: j.model || MODEL };
}

const all = find();
const picked = only.length ? all.filter(t => only.includes(t.id)) : all;
if (!picked.length) { console.error('no matching tests. available:\n' + all.map(t => '  ' + t.id).join('\n')); process.exit(2); }

for (const t of picked) {
  const r = JSON.parse(fs.readFileSync(t.result, 'utf8'));
  process.stdout.write(`${t.id} ... `);
  const t0 = Date.now();
  try {
    const { text, model } = await ask(buildPrompt(r));
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON in answer: ' + text.slice(0, 200));
    const a = JSON.parse(m[0]);
    const out = {
      role: 'A9 faithfulness assessor',
      question: 'Does this analysis measure what the claim asserts?',
      claim_id: r.claim_id,
      assessedAt: new Date().toISOString(),
      assessor: { provider: 'openai', model, independent_of_builder: true, blinded_to: ['verdict', 'confidence', 'interpretation', 'caveats'] },
      verdict: a.verdict,
      scores: a.scores,
      reasoning: a.reasoning,
      what_would_change_it: a.what_would_change_it,
      biggest_risk: a.biggest_risk,
      builder_verdict_for_comparison: r.verdict,
      note: 'The assessor did not see the builder verdict above; it is recorded here only so a reader can compare. A not-representative verdict means the evidence does not count, whatever the numbers said.'
    };
    fs.writeFileSync(path.join(t.dir, 'faithfulness.json'), JSON.stringify(out, null, 1));
    console.log(`${a.verdict} ${JSON.stringify(a.scores)} (${((Date.now() - t0) / 1000).toFixed(1)}s, ${model}) [builder said: ${r.verdict}]`);
  } catch (e) {
    console.log('FAILED: ' + e.message.slice(0, 200));
  }
}
