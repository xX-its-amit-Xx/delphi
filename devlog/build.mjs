#!/usr/bin/env node
// Bundle the dev log into one JSON the page fetches.
//
//   node devlog/build.mjs [--out <path>]
//
// Every input is optional. A module that has not landed yet is reported as absent BY NAME rather than
// silently omitted, because a dev log that quietly drops a section is the same failure as a reader that
// reports clean because it could not find the field it was checking - which this project has now shipped
// twice and does not intend to ship again.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const OUT = argv.includes('--out')
  ? argv[argv.indexOf('--out') + 1]
  : path.resolve(ROOT, 'dashboard/public/blueprint3d/studio-live/devlog/devlog.json');

async function optional(name) {
  try { return { mod: await import(`./${name}`), ok: true }; }
  catch (e) { return { mod: null, ok: false, why: String(e.message ?? e).slice(0, 160) }; }
}

const framework = await optional('framework.mjs');
const entries = await optional('entries.mjs');
const registers = await optional('registers.mjs');
const glossary = await optional('glossary.mjs');
const laws = await optional('laws.mjs');

const absent = [];
for (const [name, r] of [['framework.mjs', framework], ['entries.mjs', entries], ['registers.mjs', registers], ['glossary.mjs', glossary], ['laws.mjs', laws]]) {
  if (!r.ok) absent.push({ module: name, why: r.why });
}

const ENTRIES = entries.mod?.ENTRIES ?? [];
const REG = registers.mod?.REGISTERS ?? {};

// Which entries can be shown in which view. An entry with no skim register is not a broken entry - it is
// an entry the skim view cannot show, and the page says so rather than rendering an empty card.
const coverage = ENTRIES.map(e => ({
  id: e.id,
  deep: true,
  skim: Boolean(REG[e.id]?.skim),
  blog: Boolean(REG[e.id]?.blog),
}));

const bundle = {
  what_this_is: 'the DELPHI dev log: one entry per feature, each written three times, with every ' +
    'technical term clickable and every section collapsible.',
  views: {
    skim: 'the single most surprising true thing, plus bullets that each carry a number',
    deep: 'the full entry: why it is fun, why it is science, what stays open regardless of data, and what is on disk',
    blog: 'narrative prose for a curious outsider, ending on the open question rather than a summary',
  },
  framework: framework.mod ? {
    interpretation_is_mine: framework.mod.INTERPRETATION_IS_MINE,
    dna: framework.mod.DNA,
    why_three: framework.mod.WHY_THREE,
    goals: framework.mod.GOALS ?? [],
    how_goals_meet_the_triad: framework.mod.HOW_GOALS_MEET_THE_TRIAD ?? null,
  } : null,
  entries: ENTRIES.map(e => ({ ...e, registers: REG[e.id] ?? null })),
  how_to_read_this: entries.mod?.HOW_TO_READ_THIS ?? null,
  glossary: glossary.mod?.GLOSSARY ?? [],
  glossary_undefined: glossary.mod?.UNDEFINED_BUT_USED ?? [],
  laws: laws.mod ? {
    domains: laws.mod.DOMAINS ?? null,
    worked: laws.mod.WORKED ?? [],
    the_honest_shape: laws.mod.THE_HONEST_SHAPE ?? null,
    molecular_candidates: laws.mod.WHAT_A_MOLECULAR_BIOLOGY_LAW_WOULD_LOOK_LIKE ?? [],
  } : null,
  coverage,
  modules_absent: absent,
  // no timestamp: the bundle must be reproducible, so a rebuild with no source change is a no-op diff
};

// ---------------------------------------------------------------- versioning
// The log has to be checkable over time, so every build that CHANGES something gets a version and the
// old one stays reachable at a stable URL. The version is cut on a CONTENT HASH rather than on the
// clock: rebuilding with no source change is a no-op that neither bumps the version nor rewrites the
// archive. That is what makes "has anything changed since I last looked?" answerable by reading one
// number instead of diffing a file.
const OUTDIR = path.dirname(OUT);
const VDIR = path.join(OUTDIR, 'v');
const INDEX = path.join(OUTDIR, 'versions.json');
const crypto = await import('node:crypto');

const body = JSON.stringify(bundle, null, 1);
const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12);

let index = { versions: [] };
try { index = JSON.parse(fs.readFileSync(INDEX, 'utf8')); } catch {}
const prev = index.versions[index.versions.length - 1] ?? null;
const unchanged = Boolean(prev && prev.hash === hash);

const version = unchanged ? prev.version : (prev ? prev.version + 1 : 1);
const stamped = { ...bundle, version, content_hash: hash, previous_version: prev && !unchanged ? prev.version : null };
const stampedBody = JSON.stringify(stamped, null, 1);

fs.mkdirSync(VDIR, { recursive: true });
fs.writeFileSync(OUT, stampedBody);
fs.writeFileSync(path.join(VDIR, `${version}.json`), stampedBody);

if (!unchanged) {
  index.versions.push({
    version,
    hash,
    // the only clock in the bundle, and it records WHEN A CHANGE WAS CUT, not when a build ran
    cut_at: new Date().toISOString(),
    entries: ENTRIES.length,
    glossary: bundle.glossary.length,
    views_covered: {
      skim: coverage.filter(c => c.skim).length,
      blog: coverage.filter(c => c.blog).length,
      deep: coverage.length,
    },
    modules_absent: absent.map(a => a.module),
  });
  index.current = version;
  index.what_this_is = 'every version of the dev log that differed from the one before it. Fetch v/<n>.json for any of them.';
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
}

console.log(`entries: ${ENTRIES.length}  glossary: ${bundle.glossary.length}  laws: ${bundle.laws ? 'present' : 'absent'}`);
console.log(`views covered: skim ${coverage.filter(c => c.skim).length}/${coverage.length}, blog ${coverage.filter(c => c.blog).length}/${coverage.length}, deep ${coverage.length}/${coverage.length}`);
if (absent.length) console.log(`modules absent: ${absent.map(a => a.module).join(', ')}`);
console.log(unchanged
  ? `version ${version} UNCHANGED (content hash ${hash}) - no new version cut`
  : `version ${version} CUT (content hash ${hash})${prev ? `, previous was ${prev.version}` : ', the first'}`);
console.log(`written to ${path.relative(ROOT, OUT).replace(/\\/g, '/')} and v/${version}.json (${fs.statSync(OUT).size} bytes)`);
