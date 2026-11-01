// Scenario registry. Scenario modules live next to this file as sim-engine/scenarios/<key>.mjs and
// are written by several agents; this file only finds, validates and runs them. Pure ESM: in node it
// lists the directory, in the browser it reads ./manifest.json (written by dashboard/build-engine.mjs).
//
// SCENARIO INTERFACE (the contract other agents code to; fields may be ADDED, never changed):
//   export default {
//     key, title, group: 'environment'|'behaviour'|'physiology',
//     params:   [{key, label, unit, default, min, max, kind, source}],
//     requires: [STATE field names],
//     metrics:  [{key, label, unit, better}]            // static list (hub addition); run() must emit only these keys
//     run(state, params) => ({ metrics:[{key,label,value,unit,better:'higher'|'lower'|null,kind,source}],
//                              survives:true|false|null,   // the ORGANISM survives the perturbation
//                              feasible:true|false|null,   // the BEHAVIOUR asked about is possible (flight at
//                                                          // altitude, aerial escape, grip); added in contract 0.3.0,
//                                                          // missing -> null with a warning
//                              limiting:string|null, provenance:[...], scope:string,
//                              validity:{inRange:boolean, notes:string} }),
//     modelCard: { equations:[string], sources:[{cite, doi_or_url}], validity:string,
//                  validatedAgainst:[{organism, observation, predicted, measured, source}] }
//   }
// A module that fails validation is listed under `errors` and never run; it does not break the others.
import { KINDS } from '../lib/envelope.mjs';

const GROUPS = ['environment', 'behaviour', 'physiology'];
const BETTER = ['higher', 'lower', null];

export function validateModule(m, file = '?') {
  const errs = [];
  if (!m || typeof m !== 'object') return [`${file}: no default export object`];
  for (const k of ['key', 'title']) if (typeof m[k] !== 'string' || !m[k]) errs.push(`${k} must be a non-empty string`);
  if (!GROUPS.includes(m.group)) errs.push(`group must be one of ${GROUPS.join(', ')}`);
  if (!Array.isArray(m.params)) errs.push('params must be an array');
  else for (const p of m.params) {
    if (typeof p.key !== 'string') errs.push('param without key');
    if (p.kind && !(p.kind in KINDS)) errs.push(`param ${p.key}: unknown kind ${p.kind}`);
    if (typeof p.min === 'number' && typeof p.max === 'number' && p.min > p.max) errs.push(`param ${p.key}: min > max`);
  }
  if (!Array.isArray(m.requires)) errs.push('requires must be an array of STATE field names');
  if (m.metrics !== undefined && (!Array.isArray(m.metrics) || m.metrics.some(x => typeof x.key !== 'string'))) errs.push('metrics, if given, must be [{key,label,unit,better}]');
  if (typeof m.run !== 'function') errs.push('run(state, params) must be a function');
  if (!m.modelCard || !Array.isArray(m.modelCard.equations) || !Array.isArray(m.modelCard.sources) || typeof m.modelCard.validity !== 'string') errs.push('modelCard needs equations[], sources[], validity');
  return errs.map(e => `${file}: ${e}`);
}

/** Load every scenario module. opts.modules: [{file, module}] injects modules directly (tests, browser). */
export async function loadScenarios(opts = {}) {
  const found = [];
  if (opts.modules) found.push(...opts.modules);
  else if (typeof process !== 'undefined' && process.versions?.node) {
    // Listed at call time (no restart needed when a scenario file lands); opts.bust re-imports changed files.
    // opts.dir points at another directory (tests).
    const fs = await import('node:fs');
    const url = await import('node:url');
    const dir = opts.dir || url.fileURLToPath(new URL('.', import.meta.url));
    const base = url.pathToFileURL(/[\\/]$/.test(dir) ? dir : dir + '/');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.mjs') && f !== 'index.mjs').sort()) {
      const mtime = opts.bust ? fs.statSync(new URL(f, base)).mtimeMs : 0;
      try { found.push({ file: f, module: (await import(new URL(f, base).href + (opts.bust ? `?v=${mtime}` : ''))).default }); }
      catch (e) { found.push({ file: f, error: `import failed: ${e.message}` }); }
    }
  } else {
    const list = await (await fetch(new URL('manifest.json', import.meta.url))).json();
    for (const f of list.files) {
      try { found.push({ file: f, module: (await import(new URL(f, import.meta.url).href)).default }); }
      catch (e) { found.push({ file: f, error: `import failed: ${e.message}` }); }
    }
  }
  const scenarios = new Map(); const errors = [];
  for (const { file, module, error } of found) {
    if (error) { errors.push(`${file}: ${error}`); continue; }
    const errs = validateModule(module, file);
    if (errs.length) { errors.push(...errs); continue; }
    if (scenarios.has(module.key)) { errors.push(`${file}: duplicate key "${module.key}"`); continue; }
    scenarios.set(module.key, { ...module, file });
  }
  return { scenarios, errors };
}

export function describeScenario(s) {
  return { key: s.key, title: s.title, group: s.group, file: s.file, params: s.params, requires: s.requires,
    metrics: s.metrics || null, modelCard: s.modelCard, interface_test: !!s.interface_test };
}

/** Fill defaults and check bounds; returns {params, errors}. */
export function resolveParams(s, given = {}) {
  const out = {}; const errors = [];
  for (const k of Object.keys(given)) if (!s.params.some(p => p.key === k)) errors.push(`unknown param "${k}" for scenario ${s.key}; known: ${s.params.map(p => p.key).join(', ') || 'none'}`);
  for (const p of s.params) {
    const v = given[p.key] !== undefined ? given[p.key] : p.default;
    if (typeof p.min === 'number' && typeof v === 'number' && v < p.min) errors.push(`${p.key}=${v} below min ${p.min}`);
    if (typeof p.max === 'number' && typeof v === 'number' && v > p.max) errors.push(`${p.key}=${v} above max ${p.max}`);
    out[p.key] = v;
  }
  return { params: out, errors };
}

/** Check a run() result against the interface and the scenario's static metric list. */
export function validateResult(s, r) {
  const errs = [];
  if (!r || typeof r !== 'object') return ['run() returned no object'];
  if (!Array.isArray(r.metrics)) errs.push('metrics must be an array');
  else for (const m of r.metrics) {
    if (typeof m.key !== 'string') errs.push('metric without key');
    if (m.value !== null && !(typeof m.value === 'number' && Number.isFinite(m.value)) && typeof m.value !== 'boolean') errs.push(`metric ${m.key}: value must be a finite number, boolean or null`);
    if (!BETTER.includes(m.better ?? null)) errs.push(`metric ${m.key}: better must be higher|lower|null`);
    if (!(m.kind in KINDS)) errs.push(`metric ${m.key}: unknown kind ${m.kind}`);
    if (!m.source) errs.push(`metric ${m.key}: needs a source`);
    if (s.metrics && !s.metrics.some(x => x.key === m.key)) errs.push(`metric ${m.key} is not in the scenario's declared metrics`);
  }
  if (![true, false, null].includes(r.survives)) errs.push('survives must be true, false or null');
  if (r.feasible !== undefined && ![true, false, null].includes(r.feasible)) errs.push('feasible must be true, false or null');
  if (typeof r.scope !== 'string' || !r.scope) errs.push('scope is mandatory');
  if (!r.validity || typeof r.validity.inRange !== 'boolean') errs.push('validity.inRange must be boolean');
  if (!Array.isArray(r.provenance)) errs.push('provenance must be an array');
  else for (const q of r.provenance) if (!(q.kind in KINDS)) errs.push(`provenance ${q.quantity}: unknown kind ${q.kind}`);
  return errs;
}

/** Run one scenario on one state. Never calls run() when a required STATE field is null. */
export function runScenario(s, state, given = {}) {
  const { params, errors } = resolveParams(s, given);
  if (errors.length) return { ok: false, scenario: s.key, error: 'bad params', errors };
  const missing = s.requires.filter(f => !(f in state) || state[f] == null || (typeof state[f] === 'object' && 'value' in state[f] && state[f].value == null));
  if (missing.length) return { ok: false, scenario: s.key, params, skipped: true, missing,
    reasons: Object.fromEntries(missing.map(f => [f, state[f]?.reason || 'not in STATE'])),
    error: `required STATE field(s) are null: ${missing.join(', ')}. The scenario was not run; nothing was invented.` };
  let r;
  try { r = s.run(state, params); } catch (e) { return { ok: false, scenario: s.key, params, error: `run() threw: ${e.message}` }; }
  const errs = validateResult(s, r);
  if (errs.length) return { ok: false, scenario: s.key, params, error: 'result failed the scenario interface', errors: errs, raw: r };
  const warnings = r.feasible === undefined ? ["the module returns no 'feasible' (contract 0.3.0); reported as null"] : [];
  return { ok: true, scenario: s.key, params, ...r, feasible: r.feasible ?? null, ...(warnings.length ? { warnings } : {}) };
}
