// node test/ontogeny.mjs
// Validates sim-engine/params/ontogeny.json: schema, units, provenance, monotonic size with age, holdout hygiene.
// ONTOGENY_PATH=<file> validates another file (used to prove the checks fail on a broken fixture; keep fixtures
// outside the repo, e.g. under C:\Temp).
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.ONTOGENY_PATH || path.resolve(import.meta.dirname, '../params/ontogeny.json');
const raw = fs.readFileSync(file, 'utf8');
const doc = JSON.parse(raw);
let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message}`); fail++; }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const KINDS = new Set(['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed']);
// every stage must carry these fields (value may be null with a reason)
const UNITS = {
  SL_m: 'm', mass_kg: 'kg', body_density_kg_m3: 'kg/m3', wetted_area_m2: 'm2', frontal_area_m2: 'm2',
  pectoral_area_both_m2: 'm2', pectoral_span_m: 'm', caudal_area_m2: 'm2',
  red_muscle_fraction: 'fraction of myotomal muscle mass', white_muscle_fraction: 'fraction of myotomal muscle mass',
  gill_area_m2: 'm2', hb_P50_kPa: 'kPa', has_swimbladder: 'boolean',
  routine_metabolic_rate: 'umol O2 g-1 h-1', standard_metabolic_rate: 'umol O2 g-1 h-1', Ucrit_m_s: 'm/s',
};
// optional extra fields: checked for unit when present
const EXTRA_UNITS = { o2_uptake_site: 'category', hb_needed_for_routine_O2: 'boolean', pelvic_len_over_SL: 'fraction of SL', pectoral_len_over_SL: 'fraction of SL', body_planform_area_m2: 'm2' };
// physical plausibility (inclusive) for numeric values
const RANGE = {
  SL_m: [5e-4, 1], mass_kg: [1e-9, 10], body_density_kg_m3: [900, 1200], wetted_area_m2: [1e-8, 1], frontal_area_m2: [1e-9, 0.1],
  pectoral_area_both_m2: [1e-10, 0.1], pectoral_span_m: [1e-5, 1], caudal_area_m2: [1e-10, 0.1], red_muscle_fraction: [0, 1],
  white_muscle_fraction: [0, 1], gill_area_m2: [1e-8, 10], hb_P50_kPa: [0.05, 15], routine_metabolic_rate: [0.1, 500],
  standard_metabolic_rate: [0.1, 500], Ucrit_m_s: [0.001, 10], pelvic_len_over_SL: [0, 1], body_planform_area_m2: [1e-8, 1],
};

function checkValue(where, name, f) {
  const unit = UNITS[name] ?? EXTRA_UNITS[name];
  assert(f && typeof f === 'object', `${where}.${name}: not an object`);
  assert('value' in f, `${where}.${name}: no value key`);
  assert(f.unit === unit, `${where}.${name}: unit "${f.unit}" != expected "${unit}"`);
  if (f.value === null) {
    assert(typeof f.reason === 'string' && f.reason.length >= 20, `${where}.${name}: null value needs a reason (>= 20 chars)`);
    assert(f.kind === null || f.kind === undefined, `${where}.${name}: null value must not claim a kind`);
    return;
  }
  assert(KINDS.has(f.kind), `${where}.${name}: kind "${f.kind}" not one of ${[...KINDS].join(', ')}`);
  const s = f.source;
  assert(s && typeof s === 'object', `${where}.${name}: non-null value without a source`);
  for (const k of ['id', 'cite', 'doi_or_url', 'locator']) assert(typeof s[k] === 'string' && s[k].trim().length > 0, `${where}.${name}: source.${k} empty`);
  assert(doc.sources[s.id], `${where}.${name}: source id "${s.id}" not in sources registry`);
  assert(/^(https:\/\/|repo:)/.test(s.doi_or_url), `${where}.${name}: doi_or_url must be https:// or repo:`);
  if (f.kind === 'assumed' || f.kind === 'borrowed' || f.kind === 'derived') assert(typeof f.note === 'string' && f.note.length > 0, `${where}.${name}: kind ${f.kind} needs a note`);
  const v = f.value;
  if (unit === 'boolean') { assert(typeof v === 'boolean', `${where}.${name}: expected boolean`); return; }
  if (unit === 'category') { assert(typeof v === 'string' && v.length > 0, `${where}.${name}: expected category string`); return; }
  const nums = Array.isArray(v) ? v : [v];
  assert(nums.length === 1 || nums.length === 2, `${where}.${name}: range must be [lo, hi]`);
  for (const x of nums) assert(typeof x === 'number' && Number.isFinite(x), `${where}.${name}: non-numeric value ${JSON.stringify(v)}`);
  if (nums.length === 2) assert(nums[0] <= nums[1], `${where}.${name}: range lo > hi`);
  const rg = RANGE[name];
  if (rg) for (const x of nums) assert(x >= rg[0] && x <= rg[1], `${where}.${name}: ${x} outside plausible ${rg}`);
}

ok('top level: sources registry and both species present', () => {
  assert(doc.sources && Object.keys(doc.sources).length > 0, 'no sources');
  for (const [id, s] of Object.entries(doc.sources)) assert(s.cite && s.doi_or_url && s.access, `source ${id} incomplete`);
  assert(doc.species?.zebrafish?.stages?.length >= 3, 'zebrafish stages missing');
  assert(doc.species?.flying_fish?.stages?.length >= 3, 'flying fish stages missing');
});

for (const [sp, spec] of Object.entries(doc.species ?? {})) {
  const st = spec.stages ?? [];
  ok(`${sp}: stage keys and ages strictly increasing`, () => {
    for (let i = 0; i < st.length; i++) {
      assert(typeof st[i].key === 'string' && typeof st[i].age_days === 'number', `stage ${i} needs key and numeric age_days`);
      if (i) assert(st[i].age_days > st[i - 1].age_days, `age not increasing at ${st[i].key}`);
    }
  });
  for (const s of st) {
    ok(`${sp}.${s.key}: every required field present`, () => {
      for (const name of Object.keys(UNITS)) assert(s.fields && name in s.fields, `missing field ${name}`);
    });
    for (const [name, f] of Object.entries(s.fields ?? {})) {
      ok(`${sp}.${s.key}.${name}`, () => {
        assert(name in UNITS || name in EXTRA_UNITS, `unknown field ${name} (add it to the validator deliberately)`);
        checkValue(`${sp}.${s.key}`, name, f);
      });
    }
  }
  ok(`${sp}: SL strictly increases with age`, () => {
    const sl = st.map((s) => s.fields.SL_m.value);
    for (const x of sl) assert(typeof x === 'number', 'SL must be a number at every stage');
    for (let i = 1; i < sl.length; i++) assert(sl[i] > sl[i - 1], `SL falls from ${sl[i - 1]} to ${sl[i]} at ${st[i].key}`);
  });
  ok(`${sp}: mass strictly increases with age`, () => {
    const m = st.map((s) => s.fields.mass_kg.value);
    for (let i = 1; i < m.length; i++) assert(m[i] > m[i - 1], `mass falls at ${st[i].key}`);
  });
  ok(`${sp}: mass vs SL is roughly cubic between stages (b in 2-4)`, () => {
    for (let i = 1; i < st.length; i++) {
      const a = st[i - 1].fields, b = st[i].fields;
      const exp = Math.log(b.mass_kg.value / a.mass_kg.value) / Math.log(b.SL_m.value / a.SL_m.value);
      assert(exp > 2 && exp < 4, `log-log slope ${exp.toFixed(2)} at ${st[i].key}`);
    }
  });
  ok(`${sp}: allometries carry a, b, validity and a source`, () => {
    for (const a of spec.allometries ?? []) {
      assert(typeof a.b === 'number', `allometry ${a.y}: b not numeric`);
      assert(a.a === null || typeof a.a === 'number', `allometry ${a.y}: a must be number or null`);
      assert(a.valid && Object.keys(a.valid).length, `allometry ${a.y}: no validity range`);
      assert(a.source?.cite && a.source?.doi_or_url && a.source?.locator, `allometry ${a.y}: source incomplete`);
      assert(doc.sources[a.source.id], `allometry ${a.y}: unknown source ${a.source.id}`);
    }
  });
}

ok('no bird (Aves) data: frozen holdout', () => {
  const { no_bird_data, ...rest } = doc;
  const hit = JSON.stringify(rest).match(/\b(aves|birds?|avian|seabirds?|gallus|chicken|columba|passer\w*)\b/i);
  assert(!hit, `bird term found: "${hit?.[0]}"`);
});
ok('no credentials', () => {
  const hit = raw.match(/(api[_-]?key|secret|password|bearer\s+[a-z0-9]|nvapi-|sk-[a-z0-9]{10,}|token\s*[:=])/i);
  assert(!hit, `credential-like text: "${hit?.[0]}"`);
});
ok('every registered source is used at least once', () => {
  const used = new Set([...raw.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1]));
  const walk = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'see' && Array.isArray(v)) v.forEach((id) => { assert(doc.sources[id], `see: unknown source ${id}`); used.add(id); }); else walk(v); } };
  walk(doc.species);
  for (const id of Object.keys(doc.sources)) assert(used.has(id), `source ${id} registered but never cited`);
});

console.log(`ontogeny.json (${path.basename(file)}): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
