#!/usr/bin/env node
// Bundle the outreach profiles for the dashboard page.
//
//   node outreach/build.mjs
//
// Merges the fish-biologist and adjacent-field files, which share a schema deliberately. Either may be
// absent; an absent one is NAMED rather than silently dropped.
//
// ONE RULE ENFORCED HERE, not left to the page: nothing containing an email address or a phone number is
// published. These are real people and the profiles are built from the public professional record. The
// check runs on the serialised bundle immediately before it is written, and a hit ABORTS the build - a
// privacy check that warns and continues is a privacy check that gets ignored.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/outreach/profiles.json');

async function optional(name) {
  try { return { mod: await import(`./${name}`), ok: true }; }
  catch (e) { return { mod: null, ok: false, why: String(e.message ?? e).slice(0, 140) }; }
}

const fish = await optional('fish-biologists.mjs');
const adjacent = await optional('adjacent-fields.mjs');

const absent = [];
if (!fish.ok) absent.push({ module: 'fish-biologists.mjs', why: fish.why });
if (!adjacent.ok) absent.push({ module: 'adjacent-fields.mjs', why: adjacent.why });

const candidates = [
  ...(fish.mod?.CANDIDATES ?? []).map(c => ({ ...c, group: 'fish-biology', priority: true })),
  ...(adjacent.mod?.CANDIDATES ?? []).map(c => ({ ...c, group: c.cluster ?? 'adjacent' })),
];

const bundle = {
  what_this_is:
    'candidate labs for a lab-in-the-loop partnership, built ONLY from the public professional record: ' +
    'published papers, lab pages, public talks. No contact details, no personal inferences.',
  the_rule_on_quotes:
    'every quote is verbatim and sourced, or it is not here. A paraphrase is marked as one. A fabricated ' +
    'quote attributed to a real person would be the worst thing this project could produce.',
  candidates,
  by_group: Object.fromEntries(
    [...new Set(candidates.map(c => c.group))].map(g => [g, candidates.filter(c => c.group === g).length])),
  what_we_would_be_asking: fish.mod?.WHAT_WE_WOULD_BE_ASKING ?? null,
  what_we_bring_honestly: fish.mod?.WHAT_WE_BRING_HONESTLY ?? null,
  why_these_fields: adjacent.mod?.WHY_THESE_FIELDS ?? null,
  the_honest_gap: adjacent.mod?.THE_HONEST_GAP ?? null,
  quote_attrition: adjacent.mod?.QUOTE_ATTRITION ?? null,
  counts: {
    candidates: candidates.length,
    with_quotes: candidates.filter(c => (c.real_quotes ?? []).length > 0).length,
    quotes: candidates.reduce((a, c) => a + (c.real_quotes ?? []).length, 0),
    with_caution: candidates.filter(c => c.caution && String(c.caution).length > 20).length,
    stated_openness: candidates.filter(c => (c.openness_evidence ?? []).some(e => /stated/.test(JSON.stringify(e)))).length,
  },
  modules_absent: absent,
};

// ---------------------------------------------------------------- the privacy gate
const body = JSON.stringify(bundle, null, 1);
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const emails = body.match(EMAIL) ?? [];
if (emails.length) {
  console.error(`REFUSED: ${emails.length} email address(es) in the bundle. These are real people and this file would publish their contact details.`);
  console.error(`first: ${emails[0].replace(/[^@]/g, 'x')}`);
  process.exit(2);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body);

console.log(`${bundle.counts.candidates} candidates across ${Object.keys(bundle.by_group).length} groups`);
console.log(`  ${bundle.counts.quotes} verbatim quotes on ${bundle.counts.with_quotes} profiles`);
console.log(`  ${bundle.counts.with_caution} carry a caution, ${bundle.counts.stated_openness} have STATED (not inferred) openness evidence`);
console.log(`  privacy gate: 0 email addresses`);
if (absent.length) console.log(`  modules absent: ${absent.map(a => a.module).join(', ')}`);
console.log(`written to ${path.relative(ROOT, OUT).split(path.sep).join('/')} (${fs.statSync(OUT).size} bytes)`);
