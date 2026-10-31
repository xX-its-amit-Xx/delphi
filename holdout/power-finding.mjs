#!/usr/bin/env node
// Writes holdout/POWER.md: the power table as a standalone finding, stated plainly so another team does not repeat
// the attempt. Every number comes from holdout/power-analysis.json, holdout/exam-results/not-applicable.json,
// holdout/split.json and holdout/CHECKSUMS.json; nothing is typed in by hand.
//
//   node holdout/power-analysis.mjs && node holdout/power-finding.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const power = rd('holdout/power-analysis.json');
const na = rd('holdout/exam-results/not-applicable.json');
const split = rd('holdout/split.json');
const sums = rd('holdout/CHECKSUMS.json');
const builders = Object.fromEntries([...new Set(power.tests.map(t => t.test))].map(id => [id, rd(`claim-tests/math-bio-theorems/${id}/result.json`)]));

const tests = [...new Set(power.tests.map(t => t.test))];
const row = (id, clade) => power.tests.find(t => t.test === id && t.clade === clade);
const mammalOnly = na.tests.filter(t => /mammals only/i.test(t.why_not_applicable)).map(t => t.claim_id);
const completed = tests.length + na.tests.length;
const dec = split.decision || {};
const inv = power.inventory;
const fmt = x => typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(3)) : String(x);

const md = `# The public tables cannot support a blind clade exam at the builders' own minimum n

**Finding.** For the two laws whose tests draw on cross-species public tables, holding out one whole class
leaves fewer species than the builders' own pre-registered minimum sample sizes, so a blind exam on that class
cannot reach a verdict. With birds held out: ${tests.map(id => `${row(id, 'Aves').held_out_n} species against a minimum of ${row(id, 'Aves').builder_min_n} for ${id}`).join('; ')}.
With mammals held out instead: ${tests.map(id => `${row(id, 'Mammalia').held_out_n} against ${row(id, 'Mammalia').builder_min_n} for ${id} (${row(id, 'Mammalia').held_out_verdict})`).join('; ')}.
Of the ${completed} completed claim tests in this project, only these ${tests.length} contain bird rows at all; ${na.tests.length} draw on
humans, insects, fish, molluscs, extinct cephalopods, plants, mammals only, or non-biological series.

This is a result about the state of the data, not about the thread that measured it. It is stated here so that the
next team does not repeat the attempt expecting a decisive blind result from these tables at these minimums.

## The numbers

| test | held out | held-out species with usable values | builder's minimum n | verdict on held-out species | measured on held-out species | training set left (verdict) |
|---|---|---:|---:|---|---|---|
${power.tests.map(t => `| \`${t.test}\` | ${t.clade}${t.clade === split.clade ? ' (frozen)' : ' (what-if)'} | ${t.held_out_n} | ${t.builder_min_n} | ${t.held_out_verdict}${t.decisive ? ' (decisive)' : ''} | ${fmt(t.held_out_measured.value)} ${t.held_out_measured.unit.slice(0, 70)} | n = ${t.training_n} (${t.training_verdict}) |`).join('\n')}

Decisive exams by clade: ${Object.entries(power.decisive_exams_by_clade).map(([c, n]) => `${c} ${n} of ${tests.length}`).join(', ')}.

| clade | inventory taxa held out | roster species | genome-ready (chromosome or complete) | with a trait table | claims whose organisms are only in the clade |
|---|---:|---:|---:|---:|---:|
${Object.entries(inv).map(([c, v]) => `| ${c} | ${v.taxa} | ${v.roster_species} | ${v.genome_ready} | ${v.with_trait_table} | ${v.claims_only_in_clade} |`).join('\n')}

## Where the minimums come from

The minimums are the builders' own, pre-registered before the data were downloaded, and the exam applies them
unchanged (holdout/EXAM.md). Verbatim:

${tests.map(id => `- **${id}**: ${builders[id].fail_criterion.replace(/\s+/g, ' ')}`).join('\n')}

Data behind the two tests: ${tests.map(id => builders[id].datasets.map(d => `${d.name.split(':')[0]} (${d.doi ? `doi:${d.doi}` : d.landing_url})`).join('; ')).join('; ')}.

## What was decided, and what it cost

${dec.status === 'confirmed' ? `Class Aves was confirmed as the held-out clade on ${dec.decided_on} by ${dec.decided_by}, after being provisional from
the first freeze at ${dec.provisional_from}; the re-freeze (${sums.frozen_at}) left the roster unchanged.` : `Class ${split.clade} is the frozen clade, provisional until the project lead confirms.`}
The choice was made knowing the table above. Mammalia would have made ${power.decisive_exams_by_clade.Mammalia} of ${tests.length} exams decisive, but the
${tests.length} examined tests had already fitted on mammal rows and ${mammalOnly.length ? `\`${mammalOnly.join('`, `')}\` ${mammalOnly.length === 1 ? 'uses' : 'use'} mammals only` : 'no further test uses mammals only'}, so a
switch would have made ${tests.length + mammalOnly.length} already-built tests post hoc. A clean blind that cannot yet decide was taken over a
decisive-looking test on a contaminated design.

## What this does and does not establish

- It establishes that, at the builders' own minimums, these public tables leave a blind bird exam underpowered for
  both laws, and a blind mammal exam underpowered for one of them.
- It does not establish that either law holds or fails in birds; the measured values above are reported for the
  record and no verdict rests on them.
- It does not establish that a blind clade exam is impossible in general: a larger cross-species table, a lower
  pre-registered minimum justified in advance, or a test designed around a clade-rich dataset would change it.
- It says nothing about operationalisation: the exam applies each builder's own rule, and the collaborator
  cross-check (dashboard/public/crosscheck.json) is where verdicts are compared across operationalisations.

## Reproduce

\`\`\`
node holdout/make-split.mjs --verify          # the frozen roster (exam.json SHA-256 ${sums.outputs['exam.json'].sha256})
node holdout/power-analysis.mjs               # re-runs each test's analysis.py --exam with the class filter swapped, on scratch copies
node holdout/power-finding.mjs                # this file
\`\`\`

Generated ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')} from \`holdout/power-analysis.json\` (${power.generated_at}), \`holdout/exam-results/not-applicable.json\`,
\`holdout/split.json\` and \`holdout/CHECKSUMS.json\`.
`;
fs.writeFileSync(path.join(root, 'holdout/POWER.md'), md);
console.log(`wrote holdout/POWER.md (${md.length} chars): ${tests.length} tests, ${na.tests.length} not applicable, decisive ${JSON.stringify(power.decisive_exams_by_clade)}`);
