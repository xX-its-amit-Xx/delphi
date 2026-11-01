#!/usr/bin/env node
// Build the wild-type dossier that criterion C6 is evaluated against.
//
//   node pipeline/leanbio/debate/build-wildtype.mjs [--write]
//
// One row per REAL, MEASURED organism in this repository, with the shared quantities the registry's laws are written
// over (`shared_scope.quantities`: wingLoading, finRatio, body mass, ...). Every number carries the file and locator
// it came from and its provenance kind; nothing here is assumed or calibrated, because C6 must not reject a law on
// the strength of a placeholder. Class Aves is the frozen holdout: no bird row can enter, and the builder fails if
// a source file names one.
import fs from 'node:fs';
import { R, D, writeJson, sha256, nowIso, touchesHoldout } from './lib.mjs';

const WRITE = process.argv.includes('--write');

function csv(rel) {
  const txt = fs.readFileSync(R(rel), 'utf8');
  const hit = touchesHoldout(txt);
  if (hit) throw new Error(`${rel} names the held-out clade (${hit}); the wild-type dossier must contain no bird data`);
  const lines = txt.split(/\r?\n/).filter(l => l.trim());
  const head = splitLine(lines[0]);
  return { hash: sha256(txt).slice(0, 16), rows: lines.slice(1).map(l => Object.fromEntries(splitLine(l).map((v, i) => [head[i], v]))) };
}
function splitLine(l) {
  const out = []; let cur = '', q = false;
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}
const num = v => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const G = 9.80665;

const organisms = [];

// -------- flying fish specimen morphometry (Park & Choi 2010 via physics/glide-data.csv)
const glide = csv('physics/glide-data.csv');
for (const r of glide.rows) {
  if (r.row_kind !== 'specimen') continue;
  const m = num(r.body_mass_kg), L = num(r.body_length_m);
  const a1 = num(r.pectoral_fin_area_m2), a2 = num(r.pelvic_fin_area_m2), a3 = num(r.body_planform_area_m2);
  const area = [a1, a2, a3].every(x => x != null) ? a1 + a2 + a3 : null;
  const span = num(r.pectoral_fin_span_m);
  // A specimen with its fins FOLDED is not in a lifting configuration: its weight over its residual planform area is
  // not a wing loading, and using it to refute a wing-loading law would be dishonest. Such rows are kept (so the
  // exclusion is visible) and marked non-lifting; C6 skips them for area-derived quantities.
  const folded = a1 === 0 && (a2 === 0 || a2 == null);
  organisms.push({
    organism: r.species, common_name: r.common_name, taxon: r.species, locator: r.source_locator,
    source: `physics/glide-data.csv (sha256 ${glide.hash}) <- ${r.source_id}, ${r.source_locator}`,
    value_kind: r.value_kind || 'measured',
    configuration: folded ? 'fins folded: NOT a lifting configuration' : 'lifting configuration',
    lifting: !folded,
    quantities: clean({
      bodyMass: m, bodyLength: L,
      liftingArea: folded ? null : area,
      wingLoading: folded || m == null || !area ? null : (m * G) / area,
      // the repo's finRatio is pectoral fin LENGTH / standard length; the measured column is span (tip to tip over
      // both fins), so half-span is the per-fin length. Recorded as derived, and named so it cannot be mistaken.
      finRatio: span != null && L ? (span / 2) / L : null,
      CLmax: num(r.CL_max), LDmax: num(r.LD_max),
    }),
    kinds: { bodyMass: 'measured', bodyLength: 'measured', liftingArea: 'derived (A1+A2+A3 from measured areas)',
      wingLoading: 'derived (m*g/A, g = 9.80665)', finRatio: 'derived (half pectoral span / standard length)',
      CLmax: 'measured (wind tunnel)', LDmax: 'measured (wind tunnel)' },
    caveats: [r.notes].filter(Boolean),
  });
}

// -------- non-fish gliders and fliers (physics/comparison-data.csv): mammals and insects, no birds
const comp = csv('physics/comparison-data.csv');
for (const r of comp.rows) {
  if (!r.species || r.species === 'species') continue;
  const m = num(r.body_mass_kg), area = num(r.lifting_area_m2), wl = num(r.wing_loading_N_m2);
  organisms.push({
    organism: r.species, common_name: r.common_name, taxon: r.species, locator: r.source_locator,
    source: `physics/comparison-data.csv (sha256 ${comp.hash}) <- ${r.source_id}, ${r.source_locator}`,
    value_kind: r.value_kind || 'measured',
    quantities: clean({ bodyMass: m, liftingArea: area, wingLoading: wl ?? (m != null && area ? (m * G) / area : null), airspeed: num(r.airspeed_m_s) }),
    kinds: { bodyMass: 'measured or published population value', liftingArea: 'published', wingLoading: r.wing_loading_N_m2 ? 'published' : 'derived (m*g/A)', airspeed: 'measured' },
    caveats: [r.mode ? `locomotor mode: ${r.mode}` : null, r.notes].filter(Boolean),
  });
}

// -------- length-weight exponents actually fitted to wild populations (physics/length-weight.csv)
// One row per species, the fitted study with the largest n (b is the mass-on-length log-log slope: massExponent).
const lw = csv('physics/length-weight.csv');
const best = new Map();
for (const r of lw.rows) {
  const b = num(r.b), n = num(r.n);
  if (!r.species || r.species === 'species' || b == null || n == null) continue;
  if (/looks like a FishBase-derived estimate/.test(r.note || '')) continue; // not a fitted field study
  const cur = best.get(r.species);
  if (!cur || n > cur.n) best.set(r.species, { r, b, n });
}
for (const [species, { r, b, n }] of best) {
  organisms.push({
    organism: species, common_name: null, taxon: species, locator: r.locality || r.source,
    source: `physics/length-weight.csv (sha256 ${lw.hash}) <- FishBase length-weight list page`,
    value_kind: 'fitted (published regression)',
    quantities: clean({ massExponent: b }),
    kinds: { massExponent: `fitted log-log slope, n = ${n}${r.r2 ? `, r2 = ${r.r2}` : ''}` },
    caveats: [r.note, r.locality ? `locality: ${r.locality}` : null].filter(Boolean),
  });
}

// -------- the deepest recorded fish (lean/registry/observations/): a real organism that already refuted a law
try {
  const obs = JSON.parse(fs.readFileSync(R('lean/registry/observations/jamieson2023b-pseudoliparis-8336m.json'), 'utf8'));
  organisms.push({
    organism: 'Pseudoliparis sp.', common_name: 'hadal snailfish', taxon: 'Pseudoliparis sp.', locator: obs.quote,
    source: `lean/registry/observations/${obs.id}.json <- ${obs.source}`,
    value_kind: 'measured (field record)',
    quantities: { depth: 8336 },
    kinds: { depth: 'measured (ROV depth record)' },
    caveats: ['one specimen; this observation is why perturb-depth-cap is contested'],
  });
} catch { /* the observation file is optional */ }

function clean(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && Number.isFinite(v))); }

// A provenance kind is recorded only for a quantity the row actually has, so no reader can mistake a kind for a value.
for (const o of organisms) o.kinds = Object.fromEntries(Object.entries(o.kinds).filter(([k]) => k in o.quantities));
// Rows that carry nothing but mass and length, from the same source and species, add no constraint power; keep the
// first three per species so the spread is visible and drop the rest (the full table stays in physics/).
{
  const seen = new Map();
  const keep = [];
  for (const o of organisms) {
    const thin = Object.keys(o.quantities).every(k => k === 'bodyMass' || k === 'bodyLength');
    if (!thin) { keep.push(o); continue; }
    const k = o.organism + '|' + o.source.split(' <- ')[1];
    const n = (seen.get(k) || 0) + 1; seen.set(k, n);
    if (n <= 3) keep.push(o);
  }
  organisms.length = 0; organisms.push(...keep);
}

const doc = {
  version: 'leanbio-debate-wildtype/1.0.0',
  built: nowIso(),
  what: 'Wild-type organisms with measured shared quantities. Criterion C6: a candidate law that evaluates FALSE for any of these organisms inside the law\'s own scope is wrong about biology and is rejected, whatever its Lean status.',
  held_out: 'Class Aves is the frozen holdout. No bird row is present; the builder fails if a source file names one.',
  rule: 'Only measured, published or fitted numbers. No assumed or calibrated value enters, because C6 must not reject a law on the strength of a placeholder.',
  sources: ['physics/glide-data.csv', 'physics/comparison-data.csv', 'physics/length-weight.csv', 'lean/registry/observations/'],
  count: organisms.length,
  organisms,
};

// Scan the DATA, not this file's own prose (which names the holdout to say it is excluded).
const hit = touchesHoldout(JSON.stringify(organisms));
if (hit) throw new Error(`a wild-type row names the held-out clade (${hit})`);

if (WRITE) { writeJson(D('wildtype.json'), doc); console.log(`wrote pipeline/leanbio/debate/wildtype.json: ${organisms.length} wild-type organisms`); }
else console.log(JSON.stringify({ count: organisms.length, organisms: organisms.map(o => ({ organism: o.organism, quantities: Object.keys(o.quantities) })) }, null, 1));
