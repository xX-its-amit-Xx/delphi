// Builds law-breaker (type a) and impossible-combo (type e) negatives and confirms each against the
// accepted Lean lawset via lean/eliminate/browser-check.mjs check(). An item is kept only if at least one
// row with an ABSOLUTE relation (not a reference-specimen exponent comparison) is "violated" and its law
// has registry status "accepted". Also runs the same check on the real specimens with realistic claims
// as a sanity control (they must not violate). Independent of sim-engine/validate/score.mjs (never read).
// Usage: node lean_negatives.mjs <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const { check } = await import(pathToFileURL(path.join(repo, 'lean/eliminate/browser-check.mjs')).href);
const ABSOLUTE = new Set(['C9', 'C15', 'C14', 'C16', 'P1', 'P2', 'P4', 'P4b', 'G1', 'G2', 'G3', 'G4']);

// Real specimens (physics/glide-data.csv, Park & Choi 2010 Table 1, measured) and zebrafish adult
const PC = [
  { id: 'L1', SL: 0.205, m: 0.06, A1: 0.007069, A2: 0.001603, A3: 0.004377, span: 0.252 },
  { id: 'L2', SL: 0.209, m: 0.05, A1: 0.006997, A2: 0.001745, A3: 0.004501, span: 0.260 },
  { id: 'L3', SL: 0.203, m: 0.06, A1: 0.006377, A2: 0.001837, A3: 0.004474, span: 0.261 },
];
// ontogeny.json zebrafish stage_180d: SL and mass derived, pectoral area assumed, Ucrit measured
const ZF = { SL: 0.0388, m: 0.0006943, pect: 0.00002412, Ucrit: 0.56 };
const FF_TAX = { species: 'Cypselurus hiraii', genus: 'Cypselurus', family: 'Exocoetidae', order: 'Beloniformes' };
const ZF_TAX = { species: 'Danio rerio', genus: 'Danio', family: 'Danionidae', order: 'Cypriniformes' };

function verdict(spec) {
  const rows = check(spec);
  const viol = rows.filter(r => r.verdict === 'violated');
  const absViol = viol.filter(r => ABSOLUTE.has(r.id) && r.law && r.law.status === 'accepted');
  return {
    violated_rows: viol.map(r => ({ id: r.id, law_id: r.law && r.law.law_id, version: r.law && r.law.version, status: r.law && r.law.status, relation: r.relation, numbers: r.numbers || null })),
    absolute_accepted_violations: absViol.map(r => r.id),
  };
}
const items = [], controls = [], dropped = [];
function add(type, id, tax, spec, params, desc, donor) {
  const v = verdict(spec);
  const rec = {
    id, label: 'negative', neg_type: type, taxon: tax, description: desc, lean_spec: spec, params,
    features_present: Object.keys(params), donors: donor ? [donor] : [], lean_check: v,
    source: 'synthetic: benchmark build/lean_negatives.mjs from real specimen values (physics/glide-data.csv Park & Choi 2010 Table 1; sim-engine/params/ontogeny.json zebrafish stage_180d)',
  };
  if (v.absolute_accepted_violations.length) items.push(rec);
  else dropped.push({ id, reason: 'no accepted absolute-law violation', violated: v.violated_rows.map(r => r.id) });
}
const ffParams = (s, extra = {}) => ({
  standard_length_m: s.SL, body_mass_kg: s.m, pectoral_span_over_SL: s.span / s.SL,
  pectoral_area_over_SL2: s.A1 / s.SL ** 2, pelvic_area_over_SL2: s.A2 / s.SL ** 2, ...extra,
});
for (const s of PC) {
  const S = s.A1 + s.A2 + s.A3;
  const base = { taxon: 'Cypselurus hiraii', life_stage: 'adult', SL_m: s.SL, mass_kg: s.m, finArea_m2: S };
  const real = { ...base, CLmax: 0.78, airspeed_m_s: 15, LD_max: 4.37, glideHeight_m: 10, glideDistance_m: 40 };
  controls.push({ id: `control-pc-${s.id}`, spec: real, ...verdict(real) });
  const W = s.m * 9.80665, vmin = Math.sqrt(2 * W / (1.225 * S * 0.78));
  for (const f of [0.3, 0.5, 0.7]) {
    const v = +(f * vmin).toFixed(4);
    add('law_breaker', `lb-vmin-${s.id}-f${f}`, FF_TAX, { ...base, CLmax: 0.78, airspeed_m_s: v }, ffParams(s, { airspeed_m_s: v, CLmax: 0.78 }),
      `steady gliding at ${f} x its own minimum speed (C9: lift < weight even at CLmax)`, `parkchoi-${s.id}`);
  }
  for (const k of [4, 8]) {
    add('law_breaker', `lb-area-${s.id}-div${k}`, FF_TAX, { ...base, finArea_m2: S / k, CLmax: 0.78, airspeed_m_s: 12 },
      ffParams({ ...s, A1: s.A1 / k, A2: s.A2 / k, span: s.span / Math.sqrt(k) }, { airspeed_m_s: 12, CLmax: 0.78 }),
      `lifting area divided by ${k} while still claiming steady glide at 12 m/s`, `parkchoi-${s.id}`);
  }
  for (const r of [3, 6]) {
    const x = +(5 * 4.37 * r).toFixed(2);
    add('law_breaker', `lb-glide-${s.id}-x${r}`, FF_TAX, { ...base, LD_max: 4.37, glideHeight_m: 5, glideDistance_m: x },
      ffParams(s, { LD_max: 4.37, glideHeight_m: 5, glideDistance_m: x }),
      `unpowered glide ${r} x farther than height x measured (L/D)max allows (C15)`, `parkchoi-${s.id}`);
  }
  add('law_breaker', `lb-mass-${s.id}-x20`, FF_TAX, { ...base, mass_kg: s.m * 20, CLmax: 0.78, airspeed_m_s: 15 },
    ffParams({ ...s, m: s.m * 20 }, { airspeed_m_s: 15, CLmax: 0.78 }), 'same fins, 20 x the mass, same field airspeed claimed', `parkchoi-${s.id}`);
}
const zbase = { taxon: 'Danio rerio', life_stage: 'adult', SL_m: ZF.SL, mass_kg: ZF.m };
const zp = (extra = {}) => ({ standard_length_m: ZF.SL, body_mass_kg: ZF.m, pectoral_area_over_SL2: ZF.pect / ZF.SL ** 2, ...extra });
add('impossible_combo', 'ic-zf-glide-at-ucrit', ZF_TAX, { ...zbase, finArea_m2: ZF.pect, CLmax: 1.0, airspeed_m_s: ZF.Ucrit }, zp({ airspeed_m_s: ZF.Ucrit, CLmax: 1.0 }),
  'zebrafish body and pectoral fins claiming an aerial glide at its measured water Ucrit (0.56 m/s)');
add('impossible_combo', 'ic-zf-ucrit-with-ff-wing-loading', ZF_TAX, { ...zbase, finArea_m2: ZF.m * 9.80665 / 46.4, CLmax: 0.78, airspeed_m_s: ZF.Ucrit },
  zp({ airspeed_m_s: ZF.Ucrit, CLmax: 0.78, wing_loading_N_m2: 46.4 }),
  'flying-fish glide wing loading (Park & Choi L3, W/(A1+A2+A3) = 46.4 N/m2) combined with zebrafish launch speed 0.56 m/s');
add('impossible_combo', 'ic-zf-glide-50m', ZF_TAX, { ...zbase, LD_max: 4.37, glideHeight_m: 0.05, glideDistance_m: 50 }, zp({ LD_max: 4.37, glideHeight_m: 0.05, glideDistance_m: 50 }),
  'zebrafish leaping 5 cm and claiming a 50 m glide');
add('impossible_combo', 'ic-zf-current-10x', ZF_TAX, { ...zbase, Ucrit_m_s: ZF.Ucrit, U_current_m_s: ZF.Ucrit * 10, current_m_s: ZF.Ucrit * 10 }, zp({ U_current_m_s: ZF.Ucrit * 10 }),
  'zebrafish holding station in a current 10 x its measured Ucrit');
for (const s of PC) {
  const A1z = (ZF.pect / ZF.SL ** 2) * s.SL ** 2;
  add('impossible_combo', `ic-ff-zffins-${s.id}`, FF_TAX, { taxon: 'Cypselurus hiraii', life_stage: 'adult', SL_m: s.SL, mass_kg: s.m, finArea_m2: A1z + s.A3, CLmax: 0.78, airspeed_m_s: 12 },
    ffParams({ ...s, A1: A1z, A2: 0 }, { airspeed_m_s: 12, CLmax: 0.78 }),
    'flying-fish body with zebrafish-proportioned pectorals and no pelvic wings claiming a 12 m/s glide');
}
controls.push({ id: 'control-zf', spec: zbase, ...verdict(zbase) });
const out = { built_by: 'build/lean_negatives.mjs', absolute_laws_considered: [...ABSOLUTE], lawset: 'current',
  note: 'browser-check evaluates the Lean formulas in floating point; NOT a kernel check', items, dropped, controls };
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(`kept ${items.length}, dropped ${dropped.length}: ${JSON.stringify(dropped)}`);
console.log('controls:', controls.map(c => `${c.id}: ${JSON.stringify(c.absolute_accepted_violations)}`).join('; '));
