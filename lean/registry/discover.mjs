#!/usr/bin/env node
// "Lean identifies new laws as we learn": mine the project's SOURCED data for candidate quantitative
// regularities and emit them as MACHINE-PROPOSED law drafts (status 'proposed'). A draft is a Lean statement
// (a named-hypothesis structure plus a non-vacuity witness), the observations it rests on, how many organisms
// and observations support it, and its shared-scope atoms. Drafts enter NO law set: each must go through
// propose.mjs (build, no sorry/axiom, witness, joint consistency, mutants) and then human approval.
//
//   node lean/registry/discover.mjs            # writes lean/registry/discovered/<id>/{law.lean, meta.json} + index.json
//
// Sources read (each optional; a missing file is reported, not invented):
//   genotype/cache/daane2021_data_s1A_fin_measurements.csv  Daane 2021 Data S1 (museum beloniform specimens)
//   physics/glide-data.csv                                  Park & Choi 2010, Makiguchi 2013 specimen rows
//   physics/length-weight.csv                               FishBase fitted length-weight rows
//   sim-engine/params/ontogeny.json                         (when it lands) ontogeny parameters
// No Aves data is read (frozen holdout); every file above is fish-only.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REG, ROOT, writeJson, sha256 } from './registry-lib.mjs';

// ---------- statistics ----------
function lnGamma(z) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const ci of c) s += ci / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; } return h; }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
const tcdf = (t, df) => { const x = df / (df + t * t); const p = 0.5 * ibeta(df / 2, 0.5, x); return t >= 0 ? 1 - p : p; };
export function tq(p, df) { let lo = 0, hi = 100; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (tcdf(m, df) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
/** OLS of y on x: slope, intercept, slope SE, 95% CI, n, r2. */
export function ols(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  const b = sxy / sxx, a = my - b * mx, sse = syy - b * sxy, se = Math.sqrt(sse / (n - 2) / sxx), t = tq(0.975, n - 2);
  return { slope: b, intercept: a, se, ci95: [b - t * se, b + t * se], t, n, r2: 1 - sse / syy };
}
const floor3 = v => Math.floor(v * 1000) / 1000, ceil3 = v => Math.ceil(v * 1000) / 1000;
const dec = v => { const s = (+v).toFixed(3); return s.replace(/0+$/, '').replace(/\.$/, '.0'); };

// ---------- CSV ----------
function readCsv(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const parse = l => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return c; };
  const head = parse(lines[0]);
  return { sha256: sha256(text), rows: lines.slice(1).map(l => { const c = parse(l); return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ''])); }) };
}

// ---------- Lean template ----------
function leanDraft({ ns, structure, doc, fields, bounds, witness, header }) {
  // bounds: [{field, name, op:'lo'|'hi'|'lt', value | other}]
  const lines = ['import Mathlib', '', '/-', ...header.map(h => '  ' + h), '-/', '', `namespace Delphi.Proposed.${ns}`, '', `/-- ${doc} -/`, `structure ${structure} where`];
  for (const f of fields) lines.push(`  ${f} : ℝ`);
  for (const b of bounds) {
    if (b.op === 'lo') lines.push(`  ${b.name} : (${dec(b.value)} : ℝ) ≤ ${b.field}`);
    else if (b.op === 'hi') lines.push(`  ${b.name} : ${b.field} ≤ (${dec(b.value)} : ℝ)`);
    else if (b.op === 'lt') lines.push(`  ${b.name} : ${b.field} < ${b.other}`);
  }
  lines.push('', `/-- Non-vacuity: the observed values are an instance. -/`,
    `theorem witness : Nonempty ${structure} :=`,
    `  ⟨⟨${fields.map(f => dec(witness[f])).join(', ')}, ${bounds.map(() => 'by norm_num').join(', ')}⟩⟩`, '', `end Delphi.Proposed.${ns}`, '');
  return lines.join('\n');
}

export function discover() {
  const drafts = [], skipped = [];
  const today = new Date().toISOString().slice(0, 10);
  const daane = readCsv('genotype/cache/daane2021_data_s1A_fin_measurements.csv');
  const glide = readCsv('physics/glide-data.csv');
  if (!fs.existsSync(path.join(ROOT, 'sim-engine/params/ontogeny.json'))) skipped.push({ source: 'sim-engine/params/ontogeny.json', why: 'not present yet; rerun discover.mjs when it lands' });

  // D1: pectoral fin length allometry across flying-fish specimens (Daane 2021).
  if (daane) {
    const ff = daane.rows.filter(r => r.group === 'flying fish' && +r.SL_cm > 0 && +r.pectoral_cm > 0);
    const f = ols(ff.map(r => Math.log(+r.SL_cm)), ff.map(r => Math.log(+r.pectoral_cm)));
    const lo = floor3(f.ci95[0]), hi = ceil3(f.ci95[1]);
    const species = [...new Set(ff.map(r => r.species))];
    drafts.push({
      id: 'disc-pectoral-length-allometry', ns: 'PectoralAllometry', structure: 'PectoralLengthAllometry',
      quantity: 'finLengthExponent', lo, hi, estimate: f.slope,
      statement_en: `Across museum flying-fish specimens, pectoral fin length scales with standard length as SL^b with the exponent inside its 95% CI [${dec(lo)}, ${dec(hi)}] (OLS on log-log, n = ${f.n}, b = ${f.slope.toFixed(3)}, r^2 = ${f.r2.toFixed(3)}).`,
      support: { n_organisms: ff.length, n_observations: ff.length, n_species: species.length, fit: { slope: f.slope, se: f.se, ci95: f.ci95, r2: f.r2, t: f.t } },
      sources: [`genotype/cache/daane2021_data_s1A_fin_measurements.csv (sha256 ${daane.sha256.slice(0, 16)}), Daane JM et al. 2021 Curr Biol doi:10.1016/j.cub.2021.08.054 Data S1 sheet A`],
      caveats: ['preserved museum specimens; pooled across species (between-species and ontogenetic variation mixed)', 'OLS, not RMA; the CI is the slope CI of y = pectoral on x = SL', 'SL spans 1.68 to 24 cm, so larvae/juveniles are included'],
      taxa: ['Exocoetidae'],
      doc: 'Pooled across 49 museum flying-fish specimens: the log-log slope of pectoral fin length on standard length lies in its 95% CI.',
      fields: ['b'], bounds: [{ field: 'b', name: 'lo', op: 'lo', value: lo }, { field: 'b', name: 'hi', op: 'hi', value: hi }], witness: { b: +f.slope.toFixed(3) }, fieldmap: { b: 'finLengthExponent' },
      quantities: { finLengthExponent: { unit: '1', description: 'log-log slope of pectoral fin length on standard length (pooled flying-fish specimens)' } },
    });

    // D3: separation of flying fish from every other beloniform group on pectoral/SL.
    const ratio = r => +r.pectoral_cm / +r.SL_cm;
    const others = daane.rows.filter(r => r.group && r.group !== 'flying fish' && r.group !== 'group' && +r.SL_cm > 0);
    const ffMin = Math.min(...ff.map(ratio)), otherMax = Math.max(...others.map(ratio));
    const ffMinFloor = floor3(ffMin), otherMaxCeil = ceil3(otherMax);
    if (otherMaxCeil < ffMinFloor) drafts.push({
      id: 'disc-flying-fish-fin-ratio-gap', ns: 'FinRatioGap', structure: 'FinRatioGap',
      statement_en: `Every measured flying fish has pectoral/SL at least ${dec(ffMinFloor)}, and every measured non-flying-fish beloniform (flying halfbeaks, halfbeaks, needlefish) at most ${dec(otherMaxCeil)}: the groups do not overlap (n = ${ff.length} flying fish, ${others.length} others).`,
      support: { n_organisms: ff.length + others.length, n_observations: ff.length + others.length, flying_fish_min: ffMin, others_max: otherMax, groups: [...new Set(others.map(r => r.group))] },
      sources: [`genotype/cache/daane2021_data_s1A_fin_measurements.csv (sha256 ${daane.sha256.slice(0, 16)}), Daane 2021 Data S1`],
      caveats: ['a bound every MEASURED specimen satisfies, not an impossibility; one new specimen can break it', 'museum specimens; ratios recomputed from the length columns'],
      taxa: ['Beloniformes'],
      doc: 'Flying-fish pectoral/SL minimum lies above the maximum of every other measured beloniform group.',
      fields: ['flyingFishMinRatio', 'otherBeloniformMaxRatio'],
      bounds: [{ field: 'flyingFishMinRatio', name: 'ff_lo', op: 'lo', value: ffMinFloor }, { field: 'otherBeloniformMaxRatio', name: 'other_hi', op: 'hi', value: otherMaxCeil }, { field: 'otherBeloniformMaxRatio', name: 'gap', op: 'lt', other: 'flyingFishMinRatio' }],
      witness: { flyingFishMinRatio: ffMinFloor, otherBeloniformMaxRatio: otherMaxCeil }, fieldmap: { flyingFishMinRatio: 'flyingFishMinFinRatio', otherBeloniformMaxRatio: 'otherBeloniformMaxFinRatio' },
      atomsOverride: [`${dec(ffMinFloor)} ≤ q.flyingFishMinFinRatio`, `q.otherBeloniformMaxFinRatio ≤ ${dec(otherMaxCeil)}`, 'q.otherBeloniformMaxFinRatio < q.flyingFishMinFinRatio'],
      quantities: { flyingFishMinFinRatio: { unit: '1', description: 'minimum pectoral/SL over measured flying fish' }, otherBeloniformMaxFinRatio: { unit: '1', description: 'maximum pectoral/SL over measured non-flying-fish beloniforms' } },
    });
  } else skipped.push({ source: 'genotype/cache/daane2021_data_s1A_fin_measurements.csv', why: 'missing' });

  // D2: within-species mass-length exponent of Cheilopogon heterurus doederleini (Makiguchi 2013 specimens).
  if (glide) {
    const rows = glide.rows.filter(r => r.species === 'Cheilopogon heterurus doederleini' && r.row_kind === 'specimen' && +r.body_mass_kg > 0 && +r.body_length_m > 0);
    if (rows.length >= 5) {
      const f = ols(rows.map(r => Math.log(+r.body_length_m)), rows.map(r => Math.log(+r.body_mass_kg)));
      const lo = floor3(f.ci95[0]), hi = ceil3(f.ci95[1]);
      drafts.push({
        id: 'disc-heterurus-mass-exponent', ns: 'HeterurusMass', structure: 'HeterurusMassExponent',
        statement_en: `Within Cheilopogon heterurus doederleini, body mass scales with body length as L^b with b inside its 95% CI [${dec(lo)}, ${dec(hi)}] (OLS on log-log, n = ${f.n} specimens, b = ${f.slope.toFixed(3)}, r^2 = ${f.r2.toFixed(3)}).`,
        support: { n_organisms: rows.length, n_observations: rows.length, n_species: 1, fit: { slope: f.slope, se: f.se, ci95: f.ci95, r2: f.r2, t: f.t } },
        sources: [`physics/glide-data.csv (sha256 ${glide.sha256.slice(0, 16)}), rows source_id makiguchi-2013 (specimen rows)`],
        caveats: ['narrow length range (0.257 to 0.340 m), so the CI is wide', 'length kind as recorded in the CSV', 'one species, one study'],
        taxa: ['Exocoetidae'],
        doc: 'Within one flying-fish species, the log-log slope of body mass on body length lies in its 95% CI.',
        fields: ['b'], bounds: [{ field: 'b', name: 'lo', op: 'lo', value: lo }, { field: 'b', name: 'hi', op: 'hi', value: hi }], witness: { b: +f.slope.toFixed(3) }, fieldmap: { b: 'massExponent' },
        quantities: { massExponent: { unit: '1', description: 'log-log slope of body mass on body length (fitted)' } },
      });
    } else skipped.push({ source: 'physics/glide-data.csv', why: 'fewer than 5 C. heterurus specimen rows' });

    // D4: wing loading of every measured specimen with mass and total lifting area (Park & Choi 2010).
    const wl = glide.rows.filter(r => +r.body_mass_kg > 0 && +r.pectoral_fin_area_m2 > 0 && r.row_kind === 'specimen' && r.body_planform_area_m2 !== '')
      .map(r => ({ r, wl: +r.body_mass_kg * 9.80665 / (+r.pectoral_fin_area_m2 + (+r.pelvic_fin_area_m2 || 0) + (+r.body_planform_area_m2 || 0)) }));
    if (wl.length >= 3) {
      const mn = Math.min(...wl.map(x => x.wl)), mx = Math.max(...wl.map(x => x.wl));
      const lo = floor3(mn), hi = ceil3(mx);
      drafts.push({
        id: 'disc-measured-wing-loading-band', ns: 'WingLoadingBand', structure: 'WingLoadingBand',
        statement_en: `Every measured flying-fish specimen with mass and lifting area in the project has wing loading W/(A_pectoral + A_pelvic + A_body) between ${dec(lo)} and ${dec(hi)} N/m^2 (n = ${wl.length}).`,
        support: { n_organisms: wl.length, n_observations: wl.length, values_N_m2: wl.map(x => +x.wl.toFixed(3)), rows: wl.map(x => x.r.source_locator) },
        sources: [`physics/glide-data.csv (sha256 ${glide.sha256.slice(0, 16)}), Park and Choi 2010 Table 1`],
        caveats: ['stuffed specimens of one species (Cypselurus hiraii); n is tiny', 'model M has pelvic fins folded (A2 = 0)', 'a record bound, not an impossibility'],
        taxa: ['Exocoetidae'],
        doc: 'Wing loading of every measured specimen (Park and Choi 2010) lies in the observed band.',
        fields: ['wingLoading'], bounds: [{ field: 'wingLoading', name: 'lo', op: 'lo', value: lo }, { field: 'wingLoading', name: 'hi', op: 'hi', value: hi }], witness: { wingLoading: +((mn + mx) / 2).toFixed(3) }, fieldmap: { wingLoading: 'wingLoading' },
        quantities: { wingLoading: { unit: 'N/m^2', description: 'weight over total lifting area' } },
      });
    }
  } else skipped.push({ source: 'physics/glide-data.csv', why: 'missing' });

  // Emit
  const outDir = path.join(REG, 'discovered');
  const index = { generated: new Date().toISOString(), tool: 'lean/registry/discover.mjs', label: 'MACHINE-PROPOSED: not in any law set; must pass propose.mjs and human approval', skipped, drafts: [] };
  for (const d of drafts) {
    const header = [`MACHINE-PROPOSED by lean/registry/discover.mjs on ${today}. NOT in any law set.`, d.statement_en, `Support: ${d.support.n_organisms} organisms, ${d.support.n_observations} observations.`, `Sources: ${d.sources.join('; ')}`, `Caveats: ${d.caveats.join('; ')}`];
    const lean = leanDraft({ ns: d.ns, structure: d.structure, doc: d.doc, fields: d.fields, bounds: d.bounds, witness: d.witness, header });
    const fq = `Delphi.Proposed.${d.ns}.${d.structure}`;
    const atoms = d.atomsOverride || d.bounds.map(b => b.op === 'lo' ? `${dec(b.value)} ≤ q.${d.fieldmap[b.field]}` : `q.${d.fieldmap[b.field]} ≤ ${dec(b.value)}`);
    const wv = Object.fromEntries(Object.entries(d.witness).map(([f, v]) => [d.fieldmap[f], dec(v)]));
    const meta = {
      law_id: d.id, kind: 'biological', class: 'empirical-observation', statement_en: d.statement_en,
      lean: { structure: fq, witness: `Delphi.Proposed.${d.ns}.witness`, fields: d.fieldmap },
      shared_scope: { atoms, quantities: d.quantities, witness_values: wv },
      hypotheses: [{ name: fq, statement: d.statement_en, source: d.sources[0] }],
      scope: { taxa: d.taxa, life_stages: [], ranges: {} },
      evidence: { sources: d.sources, observations: [d.statement_en], n_organisms: d.support.n_organisms, n_observations: d.support.n_observations, support: d.support, caveats: d.caveats },
      sources: d.sources,
      origin: { by_role: 'discover.mjs', kind: 'machine-discovery', machine_proposed: true },
    };
    const dir = path.join(outDir, d.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'law.lean'), lean);
    writeJson(path.join(dir, 'meta.json'), meta);
    index.drafts.push({ law_id: d.id, status: 'proposed', machine_proposed: true, statement_en: d.statement_en, n_organisms: d.support.n_organisms, n_observations: d.support.n_observations, quantity_atoms: atoms, dir: `lean/registry/discovered/${d.id}` });
  }
  writeJson(path.join(outDir, 'index.json'), index);
  return index;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const idx = discover();
  for (const d of idx.drafts) console.log(`${d.law_id}: ${d.statement_en}`);
  for (const s of idx.skipped) console.log(`skipped ${s.source}: ${s.why}`);
}
