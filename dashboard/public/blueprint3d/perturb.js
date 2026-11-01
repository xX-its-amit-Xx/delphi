// perturb.js: the "Perturb" mode for Open the Fish (explode.html) and its standalone harness (perturb.html).
//
// Select a part on the 3D organism (body > organ system > organ > tissue > cell, + genes), edit its parameters,
// choose a perturbation scenario, read the physics/physiology result at every developmental stage, check every
// candidate against the Lean laws (lean/eliminate/browser-check.mjs, the same checker the Design Studio uses),
// optimise with a seeded search in a Web Worker, and read/post to the co-design log.
//
// Nothing here is a stand-in for the engine. The engine is sim-engine/ (organism.mjs, state.mjs, scenarios/),
// copied by dashboard/build-engine.mjs into ./engine/. When it is absent the module says so and runs nothing,
// unless the host hands it engine URLs explicitly (the harness does that with a clearly-labelled MOCK).
//
// Host interface: see mountPerturb() below and PERTURB-HOOK.md.
// This file has no top-level DOM access, so perturb-worker.js can import its pure helpers.

import { piecesFor, AIRSPEED, normaliseInterventions } from './design.js';
import { NO_PREDICTION } from './genotype.js';
import { normaliseChains, ladderHtml as chainLadderHtml, gradeChip, GRADE_ORDER } from './chains.js';

export const KINDS = ['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed'];
const HERE = new URL('./', import.meta.url);

// ---------------------------------------------------------------- engine loading
const pick = (mod, names) => { if (!mod) return null; for (const n of names) if (mod[n] != null) return mod[n]; return null; };
const isScenario = s => !!(s && typeof s === 'object' && typeof s.run === 'function' && s.key);
// The paths build-engine.mjs is expected to write. One probe (scenarios) decides whether the engine is present,
// so an absent engine costs a single 404, not one per candidate.
export const ENGINE_CANDIDATES = {
  scenarios: ['engine/scenarios/index.mjs'],
  state: ['engine/lib/state.mjs', 'engine/state.mjs'],
  organism: ['engine/lib/organism.mjs', 'engine/organism.mjs'],
};
export async function discoverEngine(base = HERE) {
  const tryImp = async u => { try { await import(u); return true; } catch { return false; } };
  const urls = {};
  const s0 = new URL(ENGINE_CANDIDATES.scenarios[0], base).href;
  if (!(await tryImp(s0))) return null;
  urls.scenarios = s0;
  for (const k of ['state', 'organism']) for (const p of ENGINE_CANDIDATES[k]) { const u = new URL(p, base).href; if (await tryImp(u)) { urls[k] = u; break; } }
  return urls.state ? urls : null;
}
// urls: {scenarios, state, organism?}; any of them may be the same module (the harness MOCK is one blob module).
// sim-engine levels say 'system'; the page's hierarchy says 'organ_system'
export const engLevel = l => (l === 'organ_system' ? 'system' : l);
export function organismIdFor(species, bundle) {
  if (!bundle || !species) return null; const o = bundle.organisms || {};
  for (const c of [species, String(species).replace(/-dev$/, ''), String(species).replace(/-dev$/, '') === 'zebrafish' ? 'zebrafish-adult' : null]) if (c && o[c]) return c;
  return null;
}
export async function loadEngine(urls) {
  const [sm, st, om] = await Promise.all([import(urls.scenarios), import(urls.state), urls.organism ? import(urls.organism) : null]);
  // the real sim-engine: loadScenarios() + runScenario(s, state, params), and every function takes the data bundle
  if (typeof sm.loadScenarios === 'function') return loadSimEngine(urls, sm, st, om);
  let sc = pick(sm, ['SCENARIOS', 'scenarios', 'registry', 'listScenarios', 'default']);
  if (typeof sc === 'function') { try { sc = sc(); } catch { sc = null; } }
  if (sc && !Array.isArray(sc)) sc = Object.values(sc);
  if (!sc || !sc.some(isScenario)) sc = Object.values(sm).filter(isScenario);
  const resolveState = pick(st, ['resolveState']) || (typeof st.default === 'function' ? st.default : null);
  if (typeof resolveState !== 'function') throw new Error('state module has no resolveState(doc, ageDays, conditions)');
  return {
    urls, mock: !!(sm.MOCK || st.MOCK), scenarios: (sc || []).filter(isScenario), resolveState,
    createOrganism: pick(om, ['createOrganism', 'newOrganism', 'createDoc']),
    addEdit: pick(om, ['addEdit', 'applyEdit']),
    paramsFor: pick(om, ['paramsFor', 'editableParams']) || pick(st, ['paramsFor', 'editableParams']),
    stages: pick(st, ['STAGES', 'stages']) || pick(om, ['STAGES']),
  };
}
async function loadSimEngine(urls, sm, st, om) {
  const bundle = await fetch(new URL('../data/bundle.json', urls.state)).then(r => { if (!r.ok) throw new Error('engine/data/bundle.json: HTTP ' + r.status); return r.json(); });
  const { scenarios, errors } = await sm.loadScenarios();
  const R = (doc, a, c) => st.resolveState(doc, a, c, bundle);
  const E = {
    urls, mock: false, real: true, bundle, scenarioErrors: errors || [], scenarios: [...scenarios.values()],
    resolveState: R,
    run: (s, state, p) => { const r = sm.runScenario(s, state, p); if (r.ok) return r;
      return { metrics: [], survives: null, notRun: true, missing: r.missing || null, provenance: [], error: (r.error || 'not run') + (r.errors ? ': ' + r.errors.join('; ') : ''), validity: { inRange: true, notes: '' } }; },
    createOrganism: ({ species, parents }) => { const id = organismIdFor(species, bundle); if (id) return om.docFor(bundle, id);
      const ps = (parents || []).filter(p => bundle.organisms[p.organism]); if (!ps.length) throw new Error('the engine bundle has no organism for "' + species + '" (known: ' + Object.keys(bundle.organisms).join(', ') + ')');
      return om.createOrganism({ id: String(species).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 60) || 'design', parents: ps }, bundle); },
    addEdit: (doc, e) => om.appendEdit(bundle, doc, { ...e, target: { level: engLevel(e.target.level), id: e.target.id } }),
    paramsFor: (t, doc) => {
      const resolved = om.resolveTarget(bundle, doc, { level: engLevel(t.level), id: t.id });
      const list = om.editableParams(bundle, doc, resolved); const clean = { ...doc, edits: [] };
      const base = om.resolveParameters(bundle, clean).params; const st0 = R(clean, null, {});
      return list.filter(p => p.unit !== 'bool' && p.unit !== 'text').map(p => {
        let value = 1, kind = 'assumed', source = p.note || '';
        if (p.effect === 'parameter') { const e = base[p.param] || {}; value = e.value; kind = e.kind; source = e.source; }
        else if (p.effect === 'state') { const f = st0[p.param] || {}; value = f.value; kind = f.kind; source = f.source !== 'none' ? f.source : f.reason; }
        const fac = p.effect === 'geometry' && p.param !== 'scale';
        return { param: p.param, label: p.param.replace(/_/g, ' ') + (fac ? ' (geometry, factor)' : ''), unit: fac ? '×' : (p.unit === '-' ? '' : p.unit), value, kind: fac ? false : kind, source: fac ? (p.meaning || p.source || '') : source, effect: p.effect, note: p.note || null, ops: fac ? ['scale'] : null, min: fac ? p.min : undefined, max: fac ? p.max : undefined };
      });
    },
    stagesFor: doc => st.stageAges(bundle, doc).map(s => ({ age: s.ageDays, label: s.label, name: s.key, size: null })),
    leanSpec: st.leanSpec || null, inputParts: st.INPUT_PARTS || null,
    mods: { sm, st, om },   // the raw modules: the optimiser worker builds spec.mjs makeRegistry from them
  };
  return E;
}
// the spec the law checker reads: the engine's own leanSpec when it has one (it refuses to pass inputs that would
// manufacture violations), plus the scenario's numeric parameters; else every numeric leaf of the state
const PARAM_ALIAS = { launch_airspeed_m_s: 'airspeed_m_s', airspeed: 'airspeed_m_s', water_temperature_C: 'temperature_C' };
// the design's taxon and life stage, for the law-scope rule (api/lean/scope.mjs): a law calibrated on flying fish says
// nothing about an organism that names no taxon. A blend with no majority parent names none (honestly out of scope).
const TAXON = [[/flying-fish|^tff$|wingless-flying-fish/, 'Exocoetidae'], [/zebrafish/, 'Danio rerio']];
export function taxonOf(key) { for (const [re, t] of TAXON) if (re.test(String(key || ''))) return t; return null; }
function designScope(state, species) {
  const out = {}; const leaves = state && state._meta && state._meta.leaves;
  if (leaves) { const top = Object.entries(leaves).sort((a, b) => b[1] - a[1]); if (top.length && top[0][1] > 0.5) out.taxon = taxonOf(top[0][0]); }
  else if (species && !/chimera|blend/.test(species)) out.taxon = taxonOf(species);
  const st = state && state.stage && (typeof state.stage === 'object' ? state.stage.value : state.stage);
  if (typeof st === 'string') out.life_stage = st;
  if (!out.taxon) delete out.taxon; return out;
}
export function specFor(engine, state, params = {}, species = null) {
  if (engine && engine.leanSpec) { const s = { ...engine.leanSpec(state), ...designScope(state, species) };
    for (const [k, v] of Object.entries(params || {})) if (typeof v === 'number' && isFinite(v)) { s[k] = v; if (PARAM_ALIAS[k] && s[PARAM_ALIAS[k]] == null) s[PARAM_ALIAS[k]] = v; }
    if (s.finArea_m2 != null && s.airspeed_m_s == null) s.airspeed_m_s = AIRSPEED; return s; }
  return { ...stateToSpec(state, params), ...designScope(state, species) };
}

// ---------------------------------------------------------------- state -> checker spec
const SPEC_KEYS = {
  SL_m: ['SL_m', 'standard_length_m', 'standardLength_m', 'SL'],
  mass_kg: ['mass_kg', 'body_mass_kg', 'bodyMass_kg', 'mass'],
  finArea_m2: ['finArea_m2', 'lifting_area_m2', 'liftingArea_m2', 'fin_area_m2', 'S_m2'],
  finLength_SL: ['finLength_SL', 'pectoral_len_over_SL', 'fin_length_over_SL'],
  CLmax: ['CLmax', 'CL_max'], LD_max: ['LD_max', 'LD'],
  flightMuscleFraction: ['flightMuscleFraction', 'flight_muscle_fraction', 'muscle_fraction'],
  airspeed_m_s: ['airspeed_m_s', 'airspeed', 'speed_m_s', 'launch_airspeed_m_s'],
};
// numeric leaves of a nested object; {value, kind} leaves give their value; provenance blocks are skipped
export function flatten(o, out = {}, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 5) return out;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'provenance' || k === 'sources' || k === 'edits') continue;
    if (typeof v === 'number' && isFinite(v)) { if (!(k in out)) out[k] = v; }
    else if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.value === 'number') { if (!(k in out)) out[k] = v.value; }
    else if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, out, depth + 1);
  }
  return out;
}
// Every numeric leaf of the state and the scenario's parameters goes to the checker under its own name (so laws
// added later find their inputs), plus the canonical names browser-check.mjs reads.
export function stateToSpec(state, params = {}) {
  const f = { ...flatten(state), ...flatten(params) };
  for (const [canon, al] of Object.entries(SPEC_KEYS)) if (f[canon] == null) for (const a of al) if (f[a] != null) { f[canon] = f[a]; break; }
  if (f.airspeed_m_s == null) f.airspeed_m_s = AIRSPEED;   // the Design Studio's fixed C9 airspeed, same rule
  return f;
}

// ---------------------------------------------------------------- the Lean checker, read dynamically
const INAPPLICABLE = /fitted exponents|across sizes|a length different from the reference/;  // same rule as design.js
const BIO_LEVEL = /genotype|population|development|physiolog|empirical|bio/i;
const PHYS_LEVEL = /phenotype|structure|physic|mechanic/i;
export function lawDomain(id, row, meta, law) {
  const k = String(row.kind || meta.kind || '');
  if (/phys/i.test(k)) return 'physical';
  if (/bio|gen|dev|physiol|empir/i.test(k)) return 'biological';
  if (law && law.level) { if (BIO_LEVEL.test(law.level)) return 'biological'; if (PHYS_LEVEL.test(law.level)) return 'physical'; }
  const mod = String(row.module || meta.module || '');
  if (/Genotype|Empirical|Develop|Physiol|Kimura|Fisher|Population|Bio/i.test(mod)) return 'biological';
  if (/Scaling|Flight|Thompson|Physics|Perturb|Fick|Boyle|Drag|Therm|Fluid|Pressure/i.test(mod)) return 'physical';
  if (/^[GE]\d/.test(id)) return 'biological';
  return 'unclassified';
}
export function severity(row) {
  const s = String(row.status || '').toLowerCase();
  if (/retired/.test(s)) return 'retired'; if (/contested/.test(s)) return 'contested'; if (/candidate|proposed/.test(s)) return 'candidate';
  return 'accepted';
}
// ---------------------------------------------------------------- law metadata: lean-client.js (the law API)
// lean-client.js (another thread) exposes getLawset(version), getLaw(id), checkState(state, lawset), fetching from the
// live sim-engine HTTP bridge or the static mirror /api/lean/. Law metadata, versions and statuses come ONLY from it.
// When it is absent the UI says "law API unavailable" and falls back to the bundled browser-check.mjs for verdicts
// alone (the Design Studio's checker), with no law statements, versions or statuses invented locally.
export function indexFromLawset(ls) {
  const byConstraint = {}, byId = {};
  const laws = ls ? (Array.isArray(ls.laws) ? ls.laws : ls.laws && typeof ls.laws === 'object' ? Object.values(ls.laws) : []) : [];
  for (const l of laws) { const e = { id: l.law_id || l.id, label: l.label || l.name || null, statement: l.statement || null, level: l.level || null, version: l.version || null, status: l.status || null, kind: l.kind || l.domain || null, sources: l.sources || (l.source ? [l.source] : null), module: l.module || null, theorem: l.theorem || null };
    if (e.id) byId[e.id] = e; for (const c of [].concat(l.constraints || l.constraint || l.constraint_ids || [])) if (!byConstraint[c]) byConstraint[c] = e; }
  return { byConstraint, byId, version: ls && (ls.version || ls.lawset_version) || null };
}
export async function loadLaws({ lawClientUrl, checkerUrl, version } = {}) {
  let api = null, apiError = null;
  try { api = await import(lawClientUrl || new URL('lean-client.js', HERE).href); } catch { apiError = 'law API unavailable: lean-client.js did not load'; }
  if (api && typeof api.getLawset === 'function' && typeof api.checkState === 'function') {
    try {
      const lawset = await api.getLawset(version);
      let versions = null; for (const n of ['listLawsets', 'getLawsets', 'lawsets']) if (typeof api[n] === 'function') { try { versions = await api[n](); } catch { } break; }
      if (versions && !Array.isArray(versions)) versions = versions.lawsets || versions.versions || null;
      versions = (versions || []).map(v => typeof v === 'string' ? v : v.version).filter(Boolean);
      return { api, apiError: null, lawset, versions, index: indexFromLawset(lawset), source: 'lean-client.js' + (lawset && lawset.source ? ' (' + lawset.source + ')' : ''),
        checker: { check: spec => api.checkState(spec, lawset), META: {}, LAWSET_VERSION: lawset && (lawset.version || lawset.lawset_version) || null } };
    } catch (e) { apiError = 'law API unavailable: ' + (e && e.message || e); }
  } else if (api) apiError = 'law API unavailable: lean-client.js has no getLawset/checkState';
  let mod = null; try { mod = await import(checkerUrl || new URL('browser-check.mjs', HERE).href); } catch { }
  return { api: null, apiError, lawset: null, versions: [], index: { byConstraint: {}, byId: {}, version: null }, checker: mod, source: mod ? 'browser-check.mjs (bundled verdicts only)' : null };
}
// lawIndex: {byConstraint: {C9: {id, statement, version, sources, status, level}}, byId, version}
export async function judge(mod, spec, lawIndex) {
  const f = mod && (mod.check || mod.evaluate || mod.default);
  if (typeof f !== 'function') return { rows: [], lawset: null, error: 'no law checker loaded (neither the law API nor browser-check.mjs)' };
  let r; try { r = await f(spec); } catch (e) { return { rows: [], lawset: null, error: 'check threw: ' + (e && e.message || e) }; }
  const arr = Array.isArray(r) ? r : (r && (r.results || r.verdicts || r.rows)) || [];
  const META = mod.META || {};
  const rows = arr.map(x => {
    const id = x.id || x.constraint; const meta = META[id] || {}; const law = lawIndex ? ((lawIndex.byId && x.law_id && lawIndex.byId[x.law_id]) || (lawIndex.byConstraint && lawIndex.byConstraint[id])) : null;
    const missing = x.missing_inputs || x.missing || []; const unconstrained = id === 'unconstrained-inputs';
    const verdict = unconstrained ? 'reported' : /^viol|contested|candidate-violated/.test(x.verdict) ? 'violated' : /^hold/.test(x.verdict) ? 'holds' : 'cannot-evaluate';
    const xLaw = x.law && typeof x.law === 'object' ? x.law : null;
    const row = { id, verdict, numbers: x.numbers || {}, missing, note: x.note || null,
      law_id: x.law_id || (xLaw && xLaw.law_id) || meta.law_id || (law && law.id) || null, version: x.version || meta.version || (law && law.version) || null,
      kind: x.kind || meta.kind || null, status: x.status || meta.status || (law && law.status) || null, statusStated: !!(x.status || meta.status || (law && law.status)),
      theorem: x.theorem || meta.theorem || null, lawName: (typeof x.law === 'string' ? x.law : null) || (typeof meta.law === 'string' ? meta.law : null), module: x.module || meta.module || null,
      relation: x.relation || meta.relation || null, statement: (law && law.statement) || null, sources: (law && law.sources) || null, lawLabel: x.label || (law && law.label) || null,
      noGlow: unconstrained || (verdict === 'cannot-evaluate' && missing.length > 0 && missing.every(m => INAPPLICABLE.test(m))) };
    if (x.law_version) row.version = x.law_version; if (x.lean_ref) { row.theorem = row.theorem || x.lean_ref.theorem; row.module = row.module || x.lean_ref.module; }
    if (Array.isArray(x.parts)) row.parts = x.parts; if (x.inputs) row.numbers = { ...row.inputs, ...x.inputs, ...row.numbers };
    if (x.baseline_violated != null) row.inherited = !!x.baseline_violated;
    if (x.verdict === 'out-of-scope') { row.outOfScope = true; row.scopeReason = x.scope_reason || 'out of the scope of the law'; }
    row.domain = lawDomain(id, x, meta, law); row.severity = x.severity === 'amber' ? 'contested' : severity(row);
    return row;
  });
  return { rows, lawset: mod.LAWSET_VERSION || (r && (r.lawset || r.lawset_version)) || (lawIndex && lawIndex.version) || null, excluded: (r && r.excluded) || [] };
}
// inherited = the unedited base organism, at the same age and conditions, breaks the same law
export function markInherited(J, baseIds) { for (const r of (J && J.rows) || []) if (r.inherited == null) r.inherited = !!(baseIds && baseIds.has(r.id)) && r.verdict === 'violated'; return J; }
export const newViolations = j => violations(j).filter(r => r.severity === 'accepted' && !r.inherited);
export const violations = j => (j && j.rows || []).filter(r => r.verdict === 'violated' && r.severity !== 'retired');
export const hardViolations = j => violations(j).filter(r => r.severity === 'accepted');

// ---------------------------------------------------------------- organism-doc helpers (engine-agnostic)
export function setEditValue(doc, idx, v) { const d = JSON.parse(JSON.stringify(doc)); if (d.edits && d.edits[idx]) d.edits[idx].value = v; return d; }
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export async function runScenario(engine, doc, scenario, params, ageDays) {
  const state = await engine.resolveState(doc, ageDays, { ...params });
  let res; try { res = engine.run ? await engine.run(scenario, state, params) : await scenario.run(state, params); } catch (e) { res = { metrics: [], survives: null, limiting: null, error: String(e && e.message || e), validity: { inRange: false, notes: 'run() threw: ' + (e && e.message || e) } }; }
  return { state, res: res || { metrics: [] } };
}
export const metricOf = (res, key) => (res && res.metrics || []).find(m => m.key === key) || null;
export const betterSign = b => (/low|min|less|down/i.test(String(b || '')) ? -1 : 1);

// ---------------------------------------------------------------- the mounted mode
const CSS = `
.pt{font-size:.86rem}.pt h2{font-family:Fraunces,serif;font-size:1.15rem;margin:0 0 6px;line-height:1.2}
.pt .sec{margin:12px 0;border-top:1px solid var(--line);padding-top:8px}.pt .sec>h4{margin:0 0 6px;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pt .tiny{font-size:.77rem;color:var(--mute)}.pt .mono{font-family:"JetBrains Mono",monospace;font-size:.75rem;background:var(--soft);padding:1px 5px;border-radius:4px;word-break:break-all}
.pt .crumbs{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.pt .crumbs button{font-size:.78rem;padding:2px 8px;border-radius:99px}.pt .crumbs button.on{border-color:var(--accent);color:var(--accent);font-weight:600}.pt .crumbs .sep{color:var(--mute)}
.pt .crumbs select{font-size:.78rem;max-width:100%;padding:2px 6px}
.pt .gene{display:inline-block;padding:1px 7px;border-radius:99px;font-size:.74rem;border:1.5px solid var(--expr);margin:0 4px 4px 0;font-family:"JetBrains Mono",monospace}
.pt .gene.S{border-color:var(--suff)}.pt .gene.R{border-color:var(--req)}
.pt .prow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;align-items:center;margin:6px 0;padding:6px 8px;border:1px solid var(--line);border-radius:8px}
.pt .prow input[type=range]{width:100%;min-width:0}.pt .prow .v{font-family:"JetBrains Mono",monospace;font-size:.74rem;text-align:right}
.pt .prow .full{grid-column:1/-1}.pt input[type=text],.pt input[type=number],.pt input[type=search],.pt textarea{font:inherit;font-size:.8rem;border:1px solid var(--line);border-radius:6px;padding:3px 6px;background:var(--panel);color:var(--ink);max-width:100%;min-width:0}
.pt input[type=number]{width:84px}.pt textarea{width:100%;min-height:48px}
.pt .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0}
.pt .badge{display:inline-block;font-size:.66rem;line-height:1.35;padding:0 6px;border-radius:99px;border:1px solid var(--line);color:var(--mute);white-space:nowrap;vertical-align:1px}
.pt .badge.measured,.pt .badge.measured-secondhand{color:var(--ok);border-color:var(--ok)}
.pt .badge.borrowed{color:var(--req);border-color:var(--req)}.pt .badge.derived{color:var(--ink);border-color:var(--mute)}
.pt .badge.calibrated{color:var(--suff);border-color:var(--suff)}
.pt .badge.assumed{color:var(--warn);border:1px dashed var(--warn);background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--warn) 14%,transparent) 0 4px,transparent 4px 8px)}
.pt .badge.unknown{border-style:dotted}
.pt table{border-collapse:collapse;width:100%;font-size:.78rem}.pt td,.pt th{text-align:left;padding:3px 5px;border-bottom:1px solid var(--line);vertical-align:top}
.pt td.num{font-family:"JetBrains Mono",monospace;font-size:.76rem;white-space:nowrap}
.pt tr.assumed td.num{color:var(--warn)}.pt tr.null td.num{color:var(--mute);font-style:italic}
.pt .tw{overflow-x:auto;max-width:100%}
.pt .res.out{opacity:.55;filter:grayscale(1)}.pt .outnote{border-left:3px solid var(--mute);padding:3px 8px;margin:4px 0;font-size:.78rem;color:var(--mute)}
.pt .fail{border:1.5px solid var(--bad);background:color-mix(in srgb,var(--bad) 10%,var(--panel));border-radius:8px;padding:5px 8px;margin:4px 0;font-size:.8rem}.pt .fail b:first-child{color:var(--bad)}
.pt .okline{border:1px solid var(--ok);border-radius:8px;padding:5px 8px;margin:4px 0;font-size:.8rem}
.pt .viol{border:1.5px solid var(--bad);background:color-mix(in srgb,var(--bad) 10%,var(--panel));border-radius:8px;padding:5px 8px;margin:4px 0;font-size:.8rem}
.pt .viol .lid{color:var(--bad);font-weight:700}
.pt .viol.contested{border-color:var(--warn);background:color-mix(in srgb,var(--warn) 10%,var(--panel))}.pt .viol.contested .lid{color:var(--warn)}
.pt .viol.inherited{border:1px solid color-mix(in srgb,var(--bad) 55%,var(--line));background:var(--panel)}.pt .viol.inherited .lid{color:color-mix(in srgb,var(--bad) 70%,var(--mute))}
.pt .greylist{color:var(--mute)}.pt .viol.candidate{border:1.5px dashed var(--warn);background:var(--panel)}.pt .viol.candidate .lid{color:var(--warn)}
.pt .dom{font-size:.66rem;padding:0 6px;border-radius:99px;border:1px solid currentColor}
.pt .edit{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 6px;border-bottom:1px dashed var(--line);padding:4px 0}.pt .edit.cur{background:color-mix(in srgb,var(--accent) 7%,transparent)}
.pt .edit button{font-size:.72rem;padding:0 6px}
.pt details{border:1px solid var(--line);border-radius:8px;padding:5px 9px;margin:6px 0}.pt details summary{cursor:pointer;font-size:.82rem;font-weight:600}
.pt .chart{position:relative}.pt .chart svg{display:block;width:100%;height:auto;overflow:visible}.pt .chart text{font-family:"Inter Tight",system-ui,sans-serif;font-size:10.5px;fill:var(--mute)}
.pt .tip{position:absolute;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:5px 8px;font-size:.76rem;display:none;z-index:4;max-width:240px;box-shadow:0 3px 12px rgba(0,0,0,.12)}
.pt .tip b{font-size:.86rem}
.pt .key{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.72rem;color:var(--mute);margin:4px 0}.pt .key i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:3px}
.pt .sm{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}.pt .sm button{text-align:left;padding:4px 6px;font-size:.7rem;line-height:1.2;border-radius:6px;min-width:0}.pt .sm button.on{border-color:var(--accent)}
.pt .sm svg{display:block;width:100%;height:30px}
.pt .post{border-left:3px solid var(--line);padding:3px 8px;margin:5px 0}.pt .post.agent{border-left-color:var(--accent)}.pt .post.human{border-left-color:var(--suff)}.pt .post .who{font-size:.72rem;color:var(--mute)}
.pt .loglist{max-height:260px;overflow-y:auto}
.pt .scrub{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pt .scrub input[type=range]{flex:1;min-width:120px;width:auto}
.pt .rej{color:var(--bad)}.pt .warnline{border:1.5px dashed var(--warn);border-radius:8px;padding:5px 8px;font-size:.8rem;margin:6px 0}
.pt .mock{border:1.5px dashed var(--warn);background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--warn) 10%,transparent) 0 8px,transparent 8px 16px);border-radius:8px;padding:5px 9px;font-size:.78rem;margin:0 0 8px}
.pt .slot:empty{display:none}
.pt .chip{display:inline-block;padding:1px 8px;border-radius:99px;font-size:.75rem;border:1px solid var(--line);background:var(--soft);color:var(--mute);margin:0 4px 4px 0}
.pt .chip.ok{color:var(--ok);border-color:var(--ok)}.pt .chip.warn{color:var(--warn);border-color:var(--warn)}.pt .chip.bad{color:var(--bad);border-color:var(--bad)}
.pt .prov{border-left:3px solid var(--accent);padding:4px 10px;margin:6px 0}.pt .prov.model{border-left-style:dashed;border-left-color:var(--mute)}.pt .prov>b{display:block;font-size:.8rem}
.pt .ladder{border-left:3px solid var(--line);margin:8px 0 8px 6px;padding-left:12px}.pt .rung{position:relative;padding:6px 0 8px;border-bottom:1px dashed var(--line)}
.pt .rung .rn{display:inline-block;width:18px;height:18px;border-radius:50%;background:var(--ink);color:var(--hollow,#fff);font-size:.72rem;text-align:center;line-height:18px;margin-left:-23px;margin-right:4px}
.pt .rung.broken{background:color-mix(in srgb,var(--warn) 10%,transparent);border-left:3px solid var(--warn);margin-left:-15px;padding-left:12px}.pt .rung .k{color:var(--mute);font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}
.pt .gchip{cursor:pointer;background:var(--panel)}.pt .gchip.on{box-shadow:0 0 0 2px var(--accent)}
.pt .proxy{display:inline-block;font-size:.66rem;padding:0 6px;border-radius:99px;border:1px dashed var(--mute);color:var(--mute)}
.pt .seqfail{border:1.5px solid var(--bad);border-radius:8px;padding:4px 8px;margin:4px 0;font-size:.8rem}.pt .seqfail b:first-child{color:var(--bad)}
.pt .rule{border:1px solid var(--accent);border-radius:8px;padding:5px 8px;margin:6px 0;font-size:.8rem}
`;
const KIND_BADGE = k => { if (k === false) return ''; const kk = KINDS.includes(k) ? k : 'unknown'; return `<span class="badge ${kk}" title="provenance kind: ${k ? String(k) : 'not stated'}">${k ? String(k).replace(/[<>&"]/g, '') : 'kind?'}</span>`; };
const fmtNum = v => v == null || !isFinite(v) ? '—' : Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? (+v).toExponential(2) : (+v).toPrecision(3).replace(/\.?0+$/, m => m.includes('.') ? '' : m);
const LEVELS = ['body', 'organ_system', 'organ', 'tissue', 'cell'];
const LEVEL_LABEL = { body: 'body', organ_system: 'organ system', system: 'organ system', organ: 'organ', tissue: 'tissue', cell: 'cell type', gene: 'gene' };

/**
 * mountPerturb(host) -> { unmount(), refresh(), select(obj), get doc() }
 * host (only THREE, panelEl and meshes are required):
 *   THREE                       the three.js namespace the page uses
 *   scene, camera, renderer     the page's own (used for nothing destructive; the module never adds to the scene)
 *   root                        the model group (stage scaling for models without morph targets)
 *   meshes                      array (or getter) of {name, mesh, m} — explode.html's `objs`
 *   manifest                    the raw model manifest (explode.html's `MF`), for parameters, morph targets, parents
 *   species                     model key (explode.html's `modelKey`)
 *   getSelection()              -> the selected {name, mesh, m} or null
 *   onSelect(cb)                -> registers cb(obj); returns an unsubscribe function
 *   panelEl                     element the panel renders into (explode.html's #panel)
 *   esc                         HTML escaper
 *   data                        data.json (terms, genotype links, grounding); fetched next to this module if absent
 *   engineUrls                  {scenarios, state, organism}: overrides discovery (the harness passes its MOCK here)
 *   codesign | codesignUrl      a co-design session export (object) or its URL (default ./engine/codesign-session.json)
 *   checkerUrl                  default ./browser-check.mjs
 */
export function mountPerturb(host) {
  const esc = host.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const THREE = host.THREE;
  const meshes = () => (typeof host.meshes === 'function' ? host.meshes() : host.meshes) || [];
  const MF = () => host.manifest || {};
  const panel = host.panelEl;
  const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
  if (!document.getElementById('perturb-css')) { const st = document.createElement('style'); st.id = 'perturb-css'; st.textContent = CSS; document.head.appendChild(st); }

  const S = { engine: null, engineErr: null, doc: null, target: { level: 'body', id: 'body', label: 'whole organism' }, piece: null, tissue: null, cell: null,
    scenarioKey: null, params: {}, stageIdx: 0, stages: [], metricKey: null, now: null, judged: null, tc: [], checker: null, checkerErr: null,
    lawIndex: null, lawsets: [], lawsetSel: null, laws: null, data: host.data || null, log: { session: null, posts: [] }, opt: null, worker: null, undo: [], alive: true, runSeq: 0, geo: [], pe: null, peRes: null };
  const saved = {}; // per-piece base scales, restored on unmount
  const unsub = host.onSelect ? host.onSelect(o => select(o)) : null;

  panel.innerHTML = `<div class="pt" id="pt">
    <div class="slot" id="ptSpec"></div>
    <h2>Perturb &amp; optimise</h2><div id="ptEng"></div>
    <div class="sec" id="ptSel"></div>
    <div class="sec" id="ptGeno"></div>
    <div class="sec" id="ptScn"></div>
    <div class="sec" id="ptRes"></div>
    <div class="sec" id="ptLaw"></div>
    <div class="sec" id="ptTc"></div>
    <div class="sec" id="ptOpt"></div>
    <div class="sec" id="ptLog"></div></div>`;
  const $ = id => panel.querySelector('#' + id);

  // --------------------------------------------------- boot
  (async () => {
    const dataP = S.data ? Promise.resolve(S.data) : fetch(new URL('data.json', HERE)).then(r => r.ok ? r.json() : null).catch(() => null);
    const lawsP = loadLaws({ lawClientUrl: host.lawClientUrl, checkerUrl: host.checkerUrl });
    let urls = host.engineUrls || null;
    if (!urls) urls = await discoverEngine(HERE);
    if (urls) { try { S.engine = await loadEngine(urls); } catch (e) { S.engineErr = String(e && e.message || e); } }
    else S.engineErr = 'dashboard/public/blueprint3d/engine/ is not in this build yet (dashboard/build-engine.mjs copies sim-engine there)';
    const [data, laws] = await Promise.all([dataP, lawsP]);
    S.data = data; setLaws(laws);
    try { S.pe = await import(new URL('partedit.js', HERE).href); } catch { S.pe = null; }
    S.doc = await newDoc();
    S.stages = stagesFor();
    S.stageIdx = S.stages.length - 1;
    if (S.engine && S.engine.scenarios.length) pickScenario((S.engine.scenarios.find(x => !x.interface_test && !/^_/.test(x.file || '')) || S.engine.scenarios[0]).key);
    await loadLog();
    mountSpecBox();
    const o = host.getSelection && host.getSelection(); if (o) S.piece = o;
    if (!S.alive) return;
    renderAll(); recompute();
  })().catch(e => { console.error(e); panel.querySelector('#ptEng').innerHTML = `<div class="fail"><b>Perturb failed to start</b> ${esc(e.message || e)}</div>`; });

  function setLaws(L) { S.laws = L; S.checker = L.checker; S.lawIndex = L.index; S.lawsets = L.versions || []; S.checkerErr = L.checker ? null : 'neither lean-client.js nor browser-check.mjs loaded'; }
  async function applyLawset(version) { setLaws(await loadLaws({ lawClientUrl: host.lawClientUrl, checkerUrl: host.checkerUrl, version })); S.lawsetSel = version; recompute(); }
  async function fillLaw(det) {
    if (det.dataset.filled || !S.laws || !S.laws.api || typeof S.laws.api.getLaw !== 'function') return; det.dataset.filled = '1';
    const box = det.querySelector('.lawbody'); try { const l = await S.laws.api.getLaw(det.dataset.law); if (!l) { box.textContent = 'the law API has no entry for ' + det.dataset.law; return; }
      box.innerHTML = `${l.statement ? `<p class="small">${esc(l.statement)}</p>` : ''}<div class="tiny">${l.version ? 'version ' + esc(l.version) + ' · ' : ''}${l.status ? 'status ' + esc(l.status) + ' · ' : ''}${l.sources ? 'sources: ' + esc([].concat(l.sources).map(x => typeof x === 'string' ? x : x.citation || x.label || x.doi || JSON.stringify(x)).join('; ')) : 'no sources listed'}</div>`; }
    catch (e) { box.textContent = 'law API: ' + (e.message || e); }
  }

  async function newDoc() {
    const parents = (MF().parents && MF().parents.length) ? MF().parents : [{ organism: host.species || 'organism', weight: 1 }];
    if (S.engine && S.engine.createOrganism) { try { const d = await S.engine.createOrganism({ species: host.species, parents, manifest: MF() }); if (d) { d.edits = d.edits || []; return d; } } catch (e) { console.warn('createOrganism failed', e); } }
    return { schema: 'organism document (page copy: sim-engine/lib/organism.mjs not loaded)', species: host.species || null, base: { parents }, edits: [] };
  }
  function stagesFor() {
    let es = S.engine && S.engine.stages; let st = null;
    if (S.engine && S.engine.stagesFor) { try { st = S.engine.stagesFor(S.doc).map(x => ({ ...x })); } catch (e) { console.warn('stageAges', e); } }
    if (st) { /* engine stages */ }
    else if (Array.isArray(es) && es.length) st = es.map(s => ({ age: s.ageDays ?? s.age_days ?? s.age, label: s.label || s.id || String(s.age), name: s.name || null, size: s.size_rel ?? null }));
    else { const mt = (MF().morph_targets || []).filter(t => t.kind === 'stage' && t.age_days != null); if (mt.length) st = mt.map(t => ({ age: t.age_days, label: t.label, name: t.name, size: t.size_rel })); }
    if (!st) st = [0, 3, 10, 30, 90, 365].map(a => ({ age: a, label: a + ' d after hatching', name: null, size: null }));
    return st.filter(s => isFinite(s.age)).sort((a, b) => a.age - b.age);
  }

  // --------------------------------------------------- selection and hierarchy
  const rawEntry = name => { const list = MF().objects || []; const nm = o => o.object || o.name; const base = String(name).replace(/_(L|R)$/, ''); return list.find(o => nm(o) === name) || list.find(o => nm(o) === base) || null; };
  const termOf = id => S.data && S.data.terms ? S.data.terms.find(t => t.id === id) : null;
  const kidsOf = (id, level) => S.data && S.data.terms ? S.data.terms.filter(t => (!level || t.level === level) && (t.parents || []).some(p => p.id === id)) : [];
  const genesOf = id => { const G = S.data && S.data.genotype; return (G && G.links && G.links[id]) || []; };
  function select(o) {
    if (!o) return; S.piece = o; S.tissue = null; S.cell = null;
    const m = o.m || {}; const id = m.ontology_id || m.uberon_id || null;
    S.target = { level: 'organ', id: id || ('piece:' + (o.group || o.name)), label: (m.label || o.name).replace(/,? (left|right)( half)?\b.*$/, ''), piece: o.name, group: o.group || o.name };
    S.gene = null; renderSel(); renderGeno(); recompute();
  }
  function setLevel(level, id, label) { S.target = { level, id, label, piece: S.piece ? S.piece.name : null, group: S.piece ? (S.piece.group || S.piece.name) : null }; if (level !== 'gene') S.gene = null; renderSel(); renderGeno(); }
  function systemOf(o) { if (!o) return null; const r = rawEntry(o.name) || {}; const m = o.m || {}; const id = r.organ_system_id || m.system || null; const label = r.organ_system || m.system_label || (id && termOf(id)?.label) || null; return id ? { id, label: label || id } : null; }

  function geoTarget(t) { return { level: engLevel(t.level), id: t.level === 'body' ? 'body' : (t.level === 'organ' && t.piece) ? t.piece : t.id }; }
  function geoParams(t) {
    if (!S.pe || typeof S.pe.editableParams !== 'function') return [];
    let list = []; try { list = S.pe.editableParams(MF(), geoTarget(t)) || []; } catch { return []; }
    return list.map(p => ({ param: p.param, label: p.param + ' (geometry, factor)', unit: '×', value: 1, kind: false, source: p.meaning + (p.modes ? ' · modes: ' + p.modes.join(', ') + ' (write as ' + p.param + ':' + p.modes[0] + ')' : ''), min: p.min, max: p.max, effect: 'geometry (partedit.js)', note: (p.checks || []).includes('containment') ? 'containment checked against the body cavity' : null, geo: true, ops: ['scale'] }));
  }
  // partedit's own list only when the engine does not already offer the same geometry params
  function catalogueFor(t) { const e = engineCatalogue(t); return e.some(p => p.effect === 'geometry' && p.param !== 'scale') ? e : e.concat(geoParams(t)); }
  function engineCatalogue(t) {
    S.catErr = null;
    if (S.engine && S.engine.paramsFor) { try { const p = S.engine.paramsFor(engTarget(t), S.doc); if (Array.isArray(p)) return p.map(normP); } catch (e) { S.catErr = String(e && e.message || e); return []; } }
    const M = MF(); const P = M.parameters || {}; const prov = M.provenance_per_parameter || {};
    const fromManifest = k => normP({ param: k, label: k.replace(/_/g, ' '), value: P[k], unit: prov[k]?.unit || (/_m$/.test(k) ? 'm' : /_kg$/.test(k) ? 'kg' : ''), kind: prov[k]?.kind || null, source: prov[k]?.source || (prov[k]?.parents ? 'blend of ' + prov[k].parents.map(p => p.organism).join(' + ') : 'model manifest parameters') });
    if (t.level === 'body') {
      const keys = Object.keys(P).filter(k => typeof P[k] === 'number' && /standard_length|body_mass|body_depth|body_width|head_fraction/.test(k));
      if (keys.length) return keys.map(fromManifest);
      const ev = M.evidence_backed || {};
      return [normP({ param: 'standard_length_m', label: 'standard length', unit: 'm', value: 0.203, kind: 'measured', source: 'Park and Choi 2010 model L3 (browser-check.mjs REFERENCE)' }),
        normP({ param: 'body_mass_kg', label: 'body mass', unit: 'kg', value: 0.06, kind: 'measured', source: 'Park and Choi 2010 model L3 (browser-check.mjs REFERENCE)' })]
        .concat(ev.pectoral_fin_length_over_SL ? [] : []);
    }
    if (t.level === 'organ' && t.piece) {
      const r = rawEntry(t.piece) || {}; const keys = (r.driven_by_parameters || []).filter(k => typeof P[k] === 'number');
      if (keys.length) return keys.map(fromManifest);
      if (/pectoral_fin/.test(t.piece) && M.evidence_backed && M.evidence_backed.pectoral_fin_length_over_SL) return [normP({ param: 'pectoral_len_over_SL', label: 'pectoral fin length / SL', unit: '', value: M.evidence_backed.pectoral_fin_length_over_SL, kind: 'measured', source: M.evidence_backed.source })];
    }
    const generic = { organ_system: ['capacity_factor', 'capacity multiplier'], organ: ['relative_size', 'relative size'], tissue: ['relative_volume', 'relative volume'], cell: ['relative_abundance', 'relative abundance'], gene: ['expression_factor', 'expression multiplier'] }[t.level] || ['relative_size', 'relative size'];
    return [normP({ param: generic[0], label: generic[1] + ' (generic multiplier)', unit: '×', value: 1, kind: 'assumed', source: 'no parameter is recorded for this ' + LEVEL_LABEL[t.level] + ' in the part list; a generic multiplier until the engine supplies one', min: 0.25, max: 4 })];
  }
  function engTarget(t) { return { level: engLevel(t.level), id: t.level === 'body' ? 'body' : (t.level === 'organ' && t.piece && S.engine && S.engine.real) ? t.piece : t.id, label: t.label }; }
  function normP(p) {
    if (p.value == null || !isFinite(+p.value)) return { param: p.param || p.key, label: p.label || p.param, unit: p.unit || '', value: null, kind: p.kind || 'assumed', source: p.source || null, effect: p.effect || null, note: p.note || null, min: p.min ?? 0, max: p.max ?? 1 };
    const v = +p.value; const frac = /_over_|fraction|frac$/.test(p.param) && v <= 1;
    return { param: p.param || p.key, label: p.label || p.param, unit: p.unit || '', value: v, kind: p.kind === false ? false : (p.kind || null), source: p.source || null,
      min: p.min ?? (frac ? 0 : v > 0 ? v * 0.25 : v - 1), max: p.max ?? (frac ? 1 : v > 0 ? v * 3 : v + 1), effect: p.effect || null, note: p.note || null, geo: !!p.geo, ops: p.ops || null };
  }
  const editsFor = t => { const T = engTarget(t); return (S.doc && S.doc.edits || []).map((e, i) => ({ e, i })).filter(({ e }) => e.target && e.target.id === T.id && engLevel(e.target.level) === T.level); };
  const labels = {}; const labelOf = tg => tg ? (tg.label || labels[tg.level + ':' + tg.id] || tg.id) : '';
  function currentValue(t, P) { if (P.ops && P.ops.length === 1 && !P.geo) { let v = 1; for (const { e } of editsFor(t)) if (e.param.split(':')[0] === P.param) v *= e.value; return v; }
    if (P.geo) { const T = geoTarget(t); let v = 1; for (const e of S.geo) if (e.target.id === T.id && e.target.level === T.level && e.param.split(':')[0] === P.param) v *= e.value; return v; }
    let v = P.value; if (v == null) { for (const { e } of editsFor(t)) if (e.param === P.param && e.op === 'set') v = e.value; return v; } for (const { e } of editsFor(t)) if (e.param === P.param) v = e.op === 'set' ? e.value : e.op === 'scale' ? v * e.value : e.op === 'add' ? v + e.value : v; return v; }

  async function addEdit(edit, opts = {}) {
    labels[edit.target.level + ':' + edit.target.id] = edit.target.label;
    if (S.engine && S.engine.addEdit) { try { const d = await S.engine.addEdit(S.doc, edit); if (d && d.edits) S.doc = d; else S.doc.edits.push(edit); } catch (e) { alertLine('the organism module refused the edit: ' + (e.message || e)); return; } }
    else S.doc.edits.push(edit);
    S.undo.push(S.doc.edits.length - 1); setTimeout(renderGeno, 0);
    if (!opts.silent) postLog({ role: 'human', label: 'human (Perturb UI)', kind: 'edit', text: `${edit.op} ${edit.param} of ${labelOf(edit.target)} → ${edit.value}${edit.reason ? ' — ' + edit.reason : ''}`, edit });
    renderSel(); recompute();
  }
  function removeEdit(i) { S.doc.edits.splice(i, 1); S.undo = S.undo.filter(x => x !== i).map(x => x > i ? x - 1 : x); renderSel(); recompute(); }
  function alertLine(msg) { const el = $('ptSelMsg'); if (el) el.innerHTML = `<div class="fail"><b>✕</b> ${esc(msg)}</div>`; }

  // --------------------------------------------------- rendering: engine banner + selection
  function renderEng() {
    const E = S.engine; let h = '';
    if (!E) h = `<div class="warnline"><b>Engine not loaded.</b> ${esc(S.engineErr || '')}. Selecting and editing work; scenarios, the timecourse and the optimiser wait for <span class="mono">engine/</span>. Nothing is simulated by this page.</div>`;
    else if (E.mock) h = `<div class="mock"><b>&#9888; MOCK ENGINE</b> — the scenarios and state below come from a stand-in defined inside the test harness, not from sim-engine. Every number is a placeholder to exercise the UI.</div>`;
    else h = `<p class="tiny">Engine: <span class="mono">engine/</span> (sim-engine: organism.mjs${E.createOrganism ? '' : ' not loaded'}, state.mjs, ${E.scenarios.length} scenario${E.scenarios.length === 1 ? '' : 's'}${E.bundle ? ', data bundle ' + esc(String(E.bundle.built || '').slice(0, 16)) : ''}).</p>${(E.scenarioErrors || []).length ? `<div class="warnline">${E.scenarioErrors.length} scenario module(s) failed the interface and are not offered: ${esc(E.scenarioErrors.join('; '))}</div>` : ''}`;
    h += `<p class="tiny">Model: <b>${esc(MF().model || host.species || 'model')}</b>${MF().hypothetical ? ' <span class="badge assumed">HYPOTHETICAL design</span>' : ''}. Click a part on the 3D model to select it.</p>`;
    $('ptEng').innerHTML = h;
  }
  function renderSel() {
    const t = S.target, o = S.piece; const sys = systemOf(o);
    const organId = o && (o.m?.ontology_id || o.m?.uberon_id); const organLabel = o ? (o.m?.label || o.name).replace(/,? (left|right)( half)?\b.*$/, '') : null;
    const tissues = organId ? kidsOf(organId, 'tissue') : []; const cellsFrom = S.tissue || organId; const cells = cellsFrom ? kidsOf(cellsFrom, 'cell') : [];
    const crumb = (lv, id, label, on) => `<button data-lv="${lv}" data-id="${esc(id)}" data-label="${esc(label)}" class="${on ? 'on' : ''}" title="${esc(LEVEL_LABEL[lv])}">${esc(label)}</button>`;
    let c = crumb('body', 'body', 'body', t.level === 'body');
    if (sys) c += `<span class="sep">›</span>` + crumb('organ_system', sys.id, sys.label, t.level === 'organ_system');
    if (o) c += `<span class="sep">›</span>` + crumb('organ', organId || ('piece:' + (o.group || o.name)), organLabel, t.level === 'organ');
    if (tissues.length) c += `<span class="sep">›</span><select id="ptTis" title="tissues of this organ (data.json)"><option value="">tissue… (${tissues.length})</option>${tissues.map(x => `<option value="${esc(x.id)}"${S.tissue === x.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
    if (cells.length) c += `<span class="sep">›</span><select id="ptCel" title="cell types (data.json)"><option value="">cell… (${cells.length})</option>${cells.map(x => `<option value="${esc(x.id)}"${S.cell === x.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
    const gid = t.level === 'body' ? null : t.id; const genes = gid ? genesOf(gid) : [];
    const cat = catalogueFor(t); const catErr = S.catErr;
    const mine = editsFor(t);
    let h = `<h4>Selection · ${esc(LEVEL_LABEL[t.level])}</h4><div class="crumbs">${c}</div>
      <p class="small" style="margin:6px 0 2px"><b>${esc(t.label)}</b> ${t.id && !/^piece:|^body$/.test(t.id) ? `<span class="mono">${esc(t.id)}</span>` : ''}</p>
      ${genes.length ? `<div class="tiny">genes recorded here (proxy organisms): ${genes.slice(0, 14).map(g => `<span class="gene ${g.link === 'sufficient for' ? 'S' : g.link === 'required for' ? 'R' : ''}" title="${esc(g.link)} · ${esc(g.organism || '')}">${esc(g.symbol)}</span>`).join('')}${genes.length > 14 ? ` +${genes.length - 14}` : ''}</div>` : gid ? '<div class="tiny">no gene record stored for this node</div>' : ''}
      <div id="ptSelMsg"></div>${catErr ? `<div class="warnline">The engine offers no parameters here: ${esc(catErr)}</div>` : ''}`;
    h += cat.map((P, k) => { const v = currentValue(t, P); const nul = v == null; const step = (P.max - P.min) / 200 || 0.001;
      return `<div class="prow" data-k="${k}"><label class="small" title="${esc(P.source || '')}">${esc(P.label)} ${P.unit ? `<span class="tiny">(${esc(P.unit)})</span>` : ''} ${KIND_BADGE(P.kind)}${P.effect ? ` <span class="badge${P.effect === 'recorded-only' ? ' unknown' : ''}" title="${esc(P.note || '')}">${esc(P.effect)}</span>` : ''}</label><span class="v" id="ptV${k}">${nul ? 'no value' : fmtNum(v)}</span>
        ${nul ? '' : `<input class="full" type="range" min="${P.min}" max="${P.max}" step="${step}" value="${v}" data-k="${k}" aria-label="${esc(P.label)}">`}
        <div class="full row"><select data-op="${k}" title="how the edit applies">${P.geo || (P.ops && P.ops.length === 1 && P.ops[0] === 'scale') ? '<option value="scale">scale ×</option>' : nul ? '<option value="set">set</option>' : '<option value="set">set</option><option value="scale">scale ×</option><option value="add">add +</option>'}</select><input type="number" data-num="${k}" value="${nul ? '' : +(+v).toPrecision(4)}" step="any" aria-label="value"><input type="text" data-why="${k}" placeholder="reason (required)" style="flex:1" aria-label="reason"><button data-apply="${k}" class="primary">edit</button></div>
        <div class="full tiny">${nul ? '<b>no value in the data</b>' : 'base ' + fmtNum(P.value)} · ${esc(P.source || 'source not stated')}${P.effect === 'recorded-only' ? ' · <b>recorded only</b>: no model consumes it yet' : ''}</div></div>`; }).join('');
    const all = (S.doc && S.doc.edits) || []; const geoList = S.geo;
    h += `<details ${all.length ? 'open' : ''}><summary>Edits on this organism (${all.length})</summary>${all.length ? all.map((e, i) => `<div class="edit${e.target && e.target.id === engTarget(t).id ? ' cur' : ''}"><span class="small"><b>${esc(e.op)}</b> <span class="mono">${esc(e.param)}</span> ${e.op === 'scale' ? '×' : e.op === 'add' ? '+' : '='} ${fmtNum(e.value)} <span class="tiny">on ${esc(LEVEL_LABEL[e.target?.level] || e.target?.level || '')} ${esc(labelOf(e.target))}</span><br><span class="tiny">${esc(e.author || 'author not stated')} · ${esc(e.reason || 'no reason given')}</span></span><button data-del="${i}" title="remove this edit">✕</button></div>`).join('') : '<p class="tiny">No engine edits yet: the organism is its base parents.</p>'}
      ${geoList.length ? `<p class="tiny" style="margin:6px 0 2px"><b>Geometry-only edits</b> (partedit.js; the engine's STATE does not see these yet)</p>` + geoList.map((e, i) => { const R = S.peRes && S.peRes.refusedGeo && S.peRes.refusedGeo.get(e); return `<div class="edit"><span class="small"><b>scale</b> <span class="mono">${esc(e.param)}</span> × ${fmtNum(e.value)} <span class="tiny">on ${esc(labelOf(e.target))}</span><br><span class="tiny">${esc(e.author)} · ${esc(e.reason)}</span>${R ? `<br><span class="tiny" style="color:var(--bad)">✕ refused: ${esc(R)}</span>` : ''}</span><button data-gdel="${i}" title="remove this edit">✕</button></div>`; }).join('') : ''}
      <div class="row"><button id="ptUndo" ${S.undo.length ? '' : 'disabled'}>undo last edit</button><button id="ptExportDoc">download organism doc</button></div></details>`;
    $('ptSel').innerHTML = h;
    $('ptSel').querySelectorAll('.crumbs button').forEach(b => b.onclick = () => { S.tissue = null; S.cell = null; setLevel(b.dataset.lv, b.dataset.id, b.dataset.label); recompute(); });
    const ts = $('ptTis'); if (ts) ts.onchange = () => { S.tissue = ts.value || null; S.cell = null; if (ts.value) setLevel('tissue', ts.value, ts.selectedOptions[0].textContent); else select(S.piece); };
    const cs = $('ptCel'); if (cs) cs.onchange = () => { S.cell = cs.value || null; if (cs.value) setLevel('cell', cs.value, cs.selectedOptions[0].textContent); };
    $('ptSel').querySelectorAll('input[type=range][data-k]').forEach(r => r.oninput = () => { const k = +r.dataset.k; $('ptV' + k).textContent = fmtNum(+r.value); const n = $('ptSel').querySelector(`[data-num="${k}"]`); const op = $('ptSel').querySelector(`[data-op="${k}"]`); op.value = 'set'; n.value = +(+r.value).toPrecision(4); });
    $('ptSel').querySelectorAll('[data-apply]').forEach(b => b.onclick = () => { const k = +b.dataset.apply; const P = cat[k]; const raw = $('ptSel').querySelector(`[data-num="${k}"]`).value; const v = +raw; if (raw === '' || !isFinite(v)) return alertLine('enter a number');
      const why = $('ptSel').querySelector(`[data-why="${k}"]`).value.trim(); if (!why) return alertLine('every edit needs a reason (it is kept in the organism document and the log)');
      if (P.geo) { const tg = geoTarget(t); labels[tg.level + ':' + tg.id] = t.label; S.geo.push({ target: tg, param: P.param, op: 'scale', value: v, author: 'human', reason: why, ts: new Date().toISOString() }); S.undo.push({ geo: S.geo.length - 1 });
        postLog({ role: 'human', label: 'human', kind: 'edit', text: `geometry ${P.param} × ${v} on ${t.label} — ${why}` }); renderSel(); recompute(); return; }
      addEdit({ target: engTarget(t), param: P.param, op: $('ptSel').querySelector(`[data-op="${k}"]`).value, value: v, author: 'human', reason: why, ts: new Date().toISOString() }); });
    $('ptSel').querySelectorAll('[data-del]').forEach(b => b.onclick = () => removeEdit(+b.dataset.del));
    $('ptSel').querySelectorAll('[data-gdel]').forEach(b => b.onclick = () => { S.geo.splice(+b.dataset.gdel, 1); S.undo = S.undo.filter(u => !(u && u.geo != null)); renderSel(); recompute(); });
    $('ptUndo').onclick = () => { const i = S.undo.pop(); if (i && i.geo != null) { S.geo.splice(i.geo, 1); renderSel(); recompute(); return; } if (i != null && S.doc.edits[i]) { S.doc.edits.splice(i, 1); renderSel(); recompute(); } };
    $('ptExportDoc').onclick = () => download('organism-doc.json', S.geo.length ? { ...S.doc, geometry_edits: S.geo } : S.doc);
  }
  function download(name, obj) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

  // --------------------------------------------------- scenario picker + model card
  const scen = () => S.engine && S.engine.scenarios.find(s => s.key === S.scenarioKey);
  function pickScenario(key) { S.scenarioKey = key; const s = scen(); S.params = {}; for (const p of (s && s.params) || []) S.params[p.key] = p.default; S.metricKey = null; }
  function renderScn() {
    const E = S.engine; if (!E) { $('ptScn').innerHTML = `<h4>Perturbation</h4><p class="tiny">Waiting for the engine's scenarios.</p>`; return; }
    const groups = {}; for (const s of E.scenarios) (groups[s.group || 'other'] = groups[s.group || 'other'] || []).push(s);
    const order = ['environment', 'behaviour', 'behavior', 'physiology'];
    const gk = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9));
    const s = scen(); const mc = (s && s.modelCard) || {};
    const list = v => Array.isArray(v) ? `<ul class="t small" style="margin:.2em 0;padding-left:1.1em">${v.map(x => `<li>${esc(typeof x === 'string' ? x : x.label || x.citation || x.text || JSON.stringify(x))}${x && x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener">link</a>` : ''}</li>`).join('')}</ul>` : v ? `<p class="small">${esc(typeof v === 'string' ? v : JSON.stringify(v))}</p>` : '<p class="tiny">not stated</p>';
    let h = `<h4>Perturbation</h4><div class="row"><select id="ptScnSel" style="max-width:100%">${gk.map(g => `<optgroup label="${esc(g)}">${groups[g].map(x => `<option value="${esc(x.key)}"${x.key === S.scenarioKey ? ' selected' : ''}>${esc(x.title || x.key)}${x.interface_test ? ' (interface test, not a model)' : ''}</option>`).join('')}</optgroup>`).join('')}</select></div>`;
    if (s) {
      h += (s.params || []).map(p => { const v = S.params[p.key]; const step = p.step || ((p.max - p.min) / 200) || 0.01;
        return `<div class="prow"><label class="small" title="${esc((p.source ? 'source: ' + p.source : 'source not stated') + (p.kind ? ' · ' + p.kind : ''))}">${esc(p.label || p.key)} ${p.unit ? `<span class="tiny">(${esc(p.unit)})</span>` : ''} ${KIND_BADGE(p.kind)}</label><span class="v" id="ptPV_${esc(p.key)}">${fmtNum(v)}</span>
          <input class="full" type="range" min="${p.min}" max="${p.max}" step="${step}" value="${v}" data-p="${esc(p.key)}" aria-label="${esc(p.label || p.key)}"></div>`; }).join('');
      if (s.requires) h += `<p class="tiny">requires: ${esc([].concat(s.requires).join(', '))}</p>`;
      h += `<details><summary>Model card: ${esc(s.title || s.key)}</summary><h4 class="tiny">Equations</h4>${list(mc.equations)}<h4 class="tiny">Sources</h4>${list(mc.sources)}<h4 class="tiny">Validated against</h4>${list(mc.validatedAgainst)}<h4 class="tiny">Validity</h4>${list(mc.validity)}</details>`;
    }
    $('ptScn').innerHTML = h;
    $('ptScnSel').onchange = e => { pickScenario(e.target.value); renderScn(); recompute(); };
    let deb = null;
    $('ptScn').querySelectorAll('input[data-p]').forEach(r => r.oninput = () => { S.params[r.dataset.p] = +r.value; $('ptPV_' + r.dataset.p).textContent = fmtNum(+r.value); clearTimeout(deb); deb = setTimeout(recompute, 120); });
  }

  // --------------------------------------------------- compute: current stage + every stage
  async function recompute() {
    const seq = ++S.runSeq; applyMesh();
    const s = scen(); const st = S.stages[S.stageIdx];
    if (!S.engine || !s || !st) { S.now = null; S.judged = S.engine ? null : await judgeLocalOnly(); if (seq !== S.runSeq || !S.alive) return; S.tc = []; renderRes(); renderLaws(); renderTc(); renderOpt(); applyGlow(); return; }
    let cur, tc = [];
    try {
      cur = await runScenario(S.engine, S.doc, s, S.params, st.age);
      const base = S.doc.edits && S.doc.edits.length ? { ...S.doc, edits: [] } : null;
      for (const g of S.stages) { const r = g === st ? cur : await runScenario(S.engine, S.doc, s, S.params, g.age);
        const J = await judge(S.checker, specFor(S.engine, r.state, S.params, host.species), S.lawIndex);
        let baseIds = null; if (base) { const bs = await S.engine.resolveState(base, g.age, { ...S.params }); baseIds = new Set(violations(await judge(S.checker, specFor(S.engine, bs, S.params, host.species), S.lawIndex)).map(v => v.id)); }
        markInherited(J, baseIds); tc.push({ stage: g, ...r, judged: J }); }
    } catch (e) { if (seq !== S.runSeq) return; S.now = { state: null, res: { metrics: [], survives: null, error: 'the engine could not resolve this organism: ' + (e && e.message || e), provenance: [] } }; S.tc = []; S.judged = null; renderRes(); renderLaws(); renderTc(); renderOpt(); applyGlow(); return; }
    if (seq !== S.runSeq || !S.alive) return;
    S.now = cur; S.tc = tc; S.judged = tc[S.stageIdx].judged;
    if (!S.metricKey || !metricOf(cur.res, S.metricKey)) S.metricKey = (cur.res.metrics || [])[0]?.key || null;
    renderRes(); renderLaws(); renderTc(); renderOpt(); applyGlow();
  }
  // without an engine there is no state; the checker still runs on the edited base numbers so violations show
  async function judgeLocalOnly_() {
    const vals = {}; for (const lv of ['body']) for (const P of catalogueFor({ level: lv, id: 'body' })) vals[P.param] = currentValue({ level: 'body', id: 'body' }, P);
    if (S.piece) for (const P of catalogueFor(S.target)) vals[P.param] = currentValue(S.target, P);
    return judge(S.checker, { ...stateToSpec(vals, {}), ...designScope(null, host.species) }, S.lawIndex);
  }
  async function judgeLocalOnly() { const J = await judgeLocalOnly_(); markInherited(J, null); return J; }

  function renderRes() {
    const el = $('ptRes'); const s = scen();
    if (!S.engine || !s) { el.innerHTML = ''; return; }
    if (!S.now) { el.innerHTML = '<h4>Result</h4><p class="tiny">running…</p>'; return; }
    const R = S.now.res; const st = S.stages[S.stageIdx]; const inR = !(R.validity && R.validity.inRange === false);
    let h = `<h4>Result · ${esc(st.label)}</h4>`;
    if (R.notRun) h += `<div class="warnline"><b>Not run.</b> ${esc(R.error)}</div>`;
    else if (R.error) h += `<div class="fail"><b>✕ run failed</b> ${esc(R.error)}</div>`;
    if (!inR) h += `<div class="outnote"><b>Outside the model's validity range</b> (greyed, not a violation): ${esc(R.validity.notes || 'no note')}</div>`;
    if (R.survives === false) h += `<div class="fail"><b>✕ does not survive this perturbation</b>${R.limiting ? ` · limiting: ${esc(typeof R.limiting === 'string' ? R.limiting : JSON.stringify(R.limiting))}` : ''}</div>`;
    else if (R.survives === true) h += `<div class="okline"><b style="color:var(--ok)">✓ survives</b>${R.limiting ? ` · closest limit: ${esc(typeof R.limiting === 'string' ? R.limiting : JSON.stringify(R.limiting))}` : ''}</div>`;
    else if (!R.notRun) h += `<p class="tiny">Survival: not stated by the scenario.</p>`;
    h += `<div class="tw res${inR ? '' : ' out'}"><table><tr><th>metric</th><th>value</th><th>kind</th></tr>${(R.metrics || []).map(m => { const nul = m.value == null || !isFinite(m.value);
      return `<tr class="${nul ? 'null' : m.kind === 'assumed' ? 'assumed' : ''}"><td>${esc(m.label || m.key)}${m.better ? ` <span class="tiny">(${esc(m.better)} is better)</span>` : ''}</td><td class="num">${nul ? 'no value' : fmtNum(m.value) + (m.unit ? ' ' + esc(m.unit) : '')}</td><td>${KIND_BADGE(m.kind)}${m.source ? `<div class="tiny">${esc(m.source)}</div>` : ''}</td></tr>`; }).join('')}</table></div>`;
    if (R.scope) h += `<p class="tiny"><b>Scope:</b> ${esc(R.scope)}</p>`;
    if (R.provenance && R.provenance.length) h += `<details><summary>Provenance (${R.provenance.length})</summary><div class="tw"><table>${R.provenance.map(p => `<tr><td>${esc(p.quantity || p.key || '')}</td><td class="num">${fmtNum(p.value)}</td><td>${KIND_BADGE(p.kind)} <span class="tiny">${esc(p.source || '')}</span></td></tr>`).join('')}</table></div></details>`;
    el.innerHTML = h;
  }

  // --------------------------------------------------- laws
  function violationHtml(r) {
    const sev = r.severity; const dom = r.domain === 'physical' ? 'physical law (Lean)' : r.domain === 'biological' ? 'biological law (Lean bio)' : 'law (domain not stated)';
    const nums = Object.entries(r.numbers || {}).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k.replace(/_/g, ' ')} ${fmtNum(v)}`).join(', ');
    return `<div class="viol ${sev === 'accepted' ? (r.inherited ? 'inherited' : '') : sev}">${r.inherited ? '<span class="badge" style="float:right">inherited from base</span>' : ''}<span class="lid">${sev === 'accepted' ? '✕' : sev === 'contested' ? '!' : '?'} ${esc(r.id)}</span> <span class="dom" style="color:${r.domain === 'biological' ? 'var(--suff)' : 'var(--req)'}">${esc(dom)}</span>
      ${sev !== 'accepted' ? `<span class="badge ${sev === 'contested' ? 'calibrated' : 'assumed'}">${esc(sev)} law</span>` : r.statusStated ? '' : '<span class="badge unknown" title="the checker gives no registry status yet; treated as accepted">status not stated</span>'}
      <div class="small">${esc(r.lawLabel || r.relation || r.lawName || '')}</div>
      ${nums ? `<div class="tiny">numbers that broke it: ${esc(nums)}</div>` : ''}${r.note ? `<div class="tiny">${esc(r.note)}</div>` : ''}
      <details data-law="${esc(r.law_id || r.id)}"><summary class="tiny">law entry${r.version ? ' · v' + esc(r.version) : ''}</summary><div class="lawbody tiny">${S.laws && S.laws.api ? 'loading from the law API…' : 'law API unavailable: no statement, version or sources to show'}</div><div class="tiny">${r.law_id ? `id <span class="mono">${esc(r.law_id)}</span> · ` : ''}theorem <span class="mono">${esc(r.theorem || '—')}</span>${r.lawName ? ` · law <span class="mono">${esc(r.lawName)}</span>` : ''}${r.module ? ` · <span class="mono">${esc(r.module)}</span>` : ''}</div>
      ${r.statement && !(S.laws && S.laws.api) ? `<p class="small">${esc(r.statement)}</p>` : ''}${r.sources && !(S.laws && S.laws.api) ? `<div class="tiny">sources: ${esc([].concat(r.sources).map(x => typeof x === 'string' ? x : x.citation || x.label || JSON.stringify(x)).join('; '))}</div>` : ''}<a class="tiny" href="${new URL('../t/lean/index.html#blueprint', HERE)}" target="_blank" rel="noopener">Lean certificate page</a></details></div>`;
  }
  function renderLaws() {
    const el = $('ptLaw'); const J = S.judged;
    const lawset = (J && J.lawset) || null; const cur = S.lawsetSel || lawset;
    let h = `<h4>Laws · ${lawset ? 'judged against law set v' + esc(lawset) : 'law set version not stated'}${S.lawsets.length > 1 ? ` <select id="ptLawset" aria-label="law set">${S.lawsets.map(v => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>v${esc(v)}</option>`).join('')}</select>` : ''}</h4>`;
    if (S.laws && S.laws.apiError) h += `<div class="warnline"><b>Law API unavailable.</b> ${esc(S.laws.apiError.replace(/^law API unavailable:? ?/, ''))}. ${S.checker ? 'Verdicts below come from the bundled <span class="mono">browser-check.mjs</span> (the Design Studio checker); law statements, versions and statuses are not shown until <span class="mono">lean-client.js</span> answers.' : ''}</div>`;
    else if (S.laws) h += `<p class="tiny">Laws from ${esc(S.laws.source)}.</p>`;
    if (!S.checker) h += `<div class="warnline">No law checker loaded (${esc(S.checkerErr || 'unknown')}): no verdict is shown rather than a stand-in.</div>`;
    else if (J && J.error) h += `<div class="warnline">${esc(J.error)}</div>`;
    else if (J) {
      const V = violations(J); const cnt = v => J.rows.filter(r => r.verdict === v).length;
      const Vs = V.slice().sort((a, b) => (a.inherited - b.inherited) || ((a.severity !== 'accepted') - (b.severity !== 'accepted')));
      h += Vs.length ? Vs.map(violationHtml).join('') : `<div class="okline"><b style="color:var(--ok)">✓ no law violated</b> at this stage</div>`;
      if (V.some(r => r.inherited)) h += `<p class="tiny">“Inherited from base”: the unedited ${esc(MF().model || 'organism')} breaks it too at this stage (often a comparison with the one flying-fish reference specimen), so it is not caused by the edits and does not glow.</p>`;
      const grey = J.rows.filter(r => r.verdict === 'cannot-evaluate' && !r.noGlow);
      if (grey.length) h += `<details class="greylist"><summary class="tiny">${grey.length} not checkable here (an input is missing or out of scope)</summary>${grey.map(r => `<div class="tiny">${esc(r.id)} · ${r.scopeReason ? 'out of scope: ' + esc(r.scopeReason) : 'missing ' + esc((r.missing || []).join(', ') || 'not stated')}</div>`).join('')}</details>`;
      h += `<p class="tiny">${cnt('holds')} hold · ${V.length} violated · ${cnt('cannot-evaluate')} not checkable or out of scope · ${J.excluded && J.excluded.length ? J.excluded.length + ' checker constraints not backed by a law in this set (or retired) · ' : ''}${J.rows.length} constraints read from ${esc(S.laws ? S.laws.source : 'the checker')}, not a kernel check. On the model: <span style="color:var(--bad)">red</span> = an accepted law violated, <span style="color:var(--warn)">amber</span> = not checkable or a contested/candidate law, as in the Design Studio.${S.engine ? '' : ' Without the engine, the checker sees the edited base numbers only.'}</p>`;
    }
    el.innerHTML = h;
    if (S.peRes && (S.peRes.refused.length || S.peRes.recorded.length || S.peRes.error)) {
      let g = '';
      for (const x of S.peRes.containment) g += `<div class="viol"><span class="lid">✕ containment</span> <span class="dom" style="color:var(--req)">physical (geometry check, partedit.js)</span><div class="small">${esc(x.edit.param)} ${esc(x.edit.op)} ${fmtNum(x.edit.value)} on ${esc(labelOf(x.edit.target))} refused: ${esc(x.reason)}</div></div>`;
      for (const x of S.peRes.refused.filter(x => !CONTAIN.test(x.reason))) g += `<div class="outnote">geometry not applied: ${esc(x.edit.param)} on ${esc(labelOf(x.edit.target))}: ${esc(x.reason)}</div>`;
      for (const x of S.peRes.recorded) g += `<div class="outnote">recorded only: ${esc(x.edit.param)} on ${esc(labelOf(x.edit.target))} (${esc(x.reason)})</div>`;
      if (S.peRes.error) g += `<div class="warnline">partedit.js: ${esc(S.peRes.error)}</div>`;
      el.insertAdjacentHTML('beforeend', `<div class="sec" style="border-top:0;padding-top:0"><h4>Geometry checks (partedit.js)</h4>${g}</div>`);
    }
    const ls = $('ptLawset'); if (ls) ls.onchange = () => applyLawset(ls.value);
    el.querySelectorAll('details[data-law]').forEach(d => d.addEventListener('toggle', () => { if (d.open) fillLaw(d); }));
  }

  // --------------------------------------------------- mesh: stage, edits, glow
  const CONTAIN = /body cavity|leave the body|leave the skin|containment/i;
  function peEdits() {
    // the engine's part 'scale' edits become partedit geometry: fins scale area by s^2 (span and chord by s), rays
    // length by s, organs, tissues and systems volume by s^3 (uniform)
    const out = [];
    const PE_PARAMS = /^(length|span|width|chord|area|volume|thickness|depth|size)(:|$)/;
    for (const e of (S.doc && S.doc.edits) || []) {
      if (PE_PARAMS.test(e.param)) { out.push({ ...e, _from: e }); continue; }
      if (e.param !== 'scale' || !['organ', 'tissue', 'system'].includes(engLevel(e.target?.level))) continue;
      let kind = null; try { kind = S.pe.resolveTarget(MF(), e.target).kind; } catch { }
      const v = +e.value; if (!(v >= 0)) continue;
      if (kind === 'fin') out.push({ ...e, param: 'area', value: v * v, _from: e });
      else if (kind === 'fin_rays') out.push({ ...e, param: 'length', value: v, _from: e });
      else if (kind) out.push({ ...e, param: 'volume', value: v * v * v, _from: e });
    }
    return out.concat(S.geo);
  }
  function applyPartedit() {
    if (!S.pe || !host.root || typeof S.pe.applyEdits !== 'function') return false;
    const list = peEdits(); let r;
    try { r = S.pe.applyEdits(host.root, MF(), list); } catch (e) { S.peRes = { error: String(e && e.message || e), refused: [], recorded: [], applied: [] }; return true; }
    const refusedGeo = new Map(); for (const x of r.refused) refusedGeo.set(x.edit._from || x.edit, x.reason);
    S.peRes = { ...r, refusedGeo, containment: r.refused.filter(x => CONTAIN.test(x.reason)) };
    return true;
  }
  function applyMesh() {
    const st = S.stages[S.stageIdx]; if (!st) return; let morphed = false;
    const pe = applyPartedit();
    for (const o of meshes()) {
      if (!saved[o.name]) saved[o.name] = o.mesh.scale.clone();
      o.mesh.traverse(c => { if (!c.isMesh || !c.morphTargetDictionary || !c.morphTargetInfluences) return; const d = c.morphTargetDictionary; if (st.name && d[st.name] != null) { c.morphTargetInfluences.fill(0); c.morphTargetInfluences[d[st.name]] = 1; morphed = true; } });
      // edits on an organ scale its pieces (linear dimension: length 1, area 1/2, mass/volume/fraction 1/3)
      let f = 1; const eps = S.now && S.now.state && S.now.state.parts;
      if (pe) f = 1;   // partedit.js writes the edits into the vertices
      else if (eps) { const p = eps[o.name]; f = p && p.edit_scale != null ? p.edit_scale : 1; }
      else for (const e of (S.doc && S.doc.edits) || []) { if (e.target?.level !== 'organ') continue; const grp = String(e.target.id).startsWith('piece:') ? e.target.id.slice(6) : null;
        const hit = grp ? (o.group || o.name) === grp : (o.m && (o.m.ontology_id === e.target.id || o.m.uberon_id === e.target.id)); if (!hit) continue;
        const P = catalogueFor({ level: 'organ', id: e.target.id, piece: o.name }).find(p => p.param === e.param); const base = P ? P.value : 1;
        const r = e.op === 'scale' ? e.value : e.op === 'set' ? (base ? e.value / base : 1) : e.op === 'add' ? (base ? (base + e.value) / base : 1) : 1;
        const ex = /area/.test(e.param) ? 0.5 : /mass|volume|fraction|abundance|capacity/.test(e.param) ? 1 / 3 : 1; if (r > 0) f *= Math.pow(r, ex); }
      o.mesh.scale.copy(saved[o.name]).multiplyScalar(f);
    }
    if (!morphed && host.root && st.size != null) host.root.scale.setScalar(Math.max(0.05, st.size));
    else if (host.root && !morphed) host.root.scale.setScalar(1);
  }
  const glowing = new Map(); let glowT = 0, raf = 0, lastT = 0;
  const grounding = () => S.data && S.data.provenance && S.data.provenance.grounding;
  const DEP = [[/len|span|area|fin|chord/i, ['finArea_m2', 'finLength_SL', 'S_m2']], [/mass/i, ['mass_kg', 'W_N']], [/standard_length|^SL/i, ['SL_m', 'lengthRatio']], [/muscle/i, ['flightMuscleFraction', 'powerAvailable_W']], [/gill|o2|oxygen|heart|cardiac/i, ['cardiacOutput', 'arterialO2']]];
  function piecesForRow(r) {
    const names = new Set(meshes().map(o => o.name)); const out = new Set();
    for (const n of r.parts || []) if (names.has(n)) out.add(n);
    for (const n of piecesFor({ theorem: r.theorem, law: r.lawName, pieces_theorem: r.lawName, id: r.id, noGlow: false }, grounding())) if (names.has(n)) out.add(n);
    if (r.verdict === 'violated') {
      const keys = new Set([...Object.keys(r.numbers || {}), ...(r.missing || [])]);
      for (const e of (S.doc && S.doc.edits) || []) { const dep = DEP.find(([re]) => re.test(e.param)); if (!dep || !dep[1].some(k => keys.has(k))) continue;
        for (const o of meshes()) { const grp = String(e.target?.id || '').startsWith('piece:') ? e.target.id.slice(6) : null; if ((grp && (o.group || o.name) === grp) || (o.m && e.target && o.m.ontology_id === e.target.id)) out.add(o.name); } }
      const IP = S.engine && S.engine.inputParts; if (IP) for (const k of keys) for (const n of IP[k] || []) if (names.has(n)) out.add(n);
      if (!out.size) for (const n of names) out.add(n);    // the law's inputs map to no part: the whole body glows
    }
    return out;
  }
  function clearGlow() { for (const [n] of glowing) { const o = meshes().find(x => x.name === n); if (o) o.mesh.traverse(c => { if (c.isMesh && c.material && c.material.emissive) { c.material.emissive.setHex(c.material.userData.base?.em || 0); c.material.emissiveIntensity = 1; } }); } glowing.clear(); }
  function applyGlow() {
    clearGlow();
    if (S.peRes && S.peRes.containment) for (const x of S.peRes.containment) { let parts = []; try { parts = S.pe.resolveTarget(MF(), x.edit.target).parts || []; } catch { } for (const n of parts) glowing.set(n, 'violated'); }
    const J = S.judged; if (!J || !J.rows) return;
    for (const r of J.rows) { if (r.verdict === 'holds' || r.verdict === 'reported' || r.noGlow || r.severity === 'retired') continue;
      if (r.verdict === 'violated' && r.inherited) continue;   // the base organism already breaks it: listed, not glowing red
      const st = r.verdict === 'violated' && r.severity === 'accepted' ? 'violated' : 'cannot';
      for (const n of piecesForRow(r)) if (!glowing.has(n) || st === 'violated') glowing.set(n, st); }
  }
  function frame(t) {
    if (!S.alive) return; const now = t / 1000; glowT += Math.min(0.05, now - (lastT || now)); lastT = now;
    if (glowing.size && THREE) { const css = getComputedStyle(document.documentElement); const k = 0.45 + 0.3 * Math.sin(glowT * 4);
      const red = new THREE.Color(css.getPropertyValue('--bad').trim() || '#b3392f'), amb = new THREE.Color(css.getPropertyValue('--warn').trim() || '#a8650b');
      for (const [n, st] of glowing) { const o = meshes().find(x => x.name === n); if (!o) continue; o.mesh.traverse(c => { if (c.isMesh && c.material && c.material.emissive) { c.material.emissive.copy(st === 'violated' ? red : amb); c.material.emissiveIntensity = st === 'violated' ? k : 0.3; } }); } }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // --------------------------------------------------- timecourse chart (dataviz: one series, crosshair, bands, table view)
  function renderTc() {
    const el = $('ptTc'); if (!S.stages.length) { el.innerHTML = ''; return; }
    const st = S.stages[S.stageIdx];
    let h = `<h4>Development · every stage</h4><div class="scrub"><input type="range" id="ptStage" min="0" max="${S.stages.length - 1}" step="1" value="${S.stageIdx}" aria-label="developmental stage"><span class="small"><b>${esc(st.label)}</b></span></div>
      <p class="tiny">The scrubber sets the stage for the result, the laws and the model (${(MF().morph_targets || []).some(t => t.kind === 'stage') ? 'morph targets of this GLB, true relative size' : 'uniform scaling'}).</p>`;
    if (!S.tc.length) { el.innerHTML = h + (S.engine ? '' : '<p class="tiny">The per-stage curve needs the engine.</p>'); wireStage(); return; }
    const metrics = (S.tc[S.tc.length - 1].res.metrics || []).map(m => ({ key: m.key, label: m.label || m.key, unit: m.unit || '' }));
    h += `<div class="row"><label class="small">metric <select id="ptMetric">${metrics.map(m => `<option value="${esc(m.key)}"${m.key === S.metricKey ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label></div>
      <div class="chart" id="ptChart"></div>
      <div class="key"><span><i style="background:color-mix(in srgb,var(--ok) 22%,transparent)"></i>✓ survives</span><span><i style="background:color-mix(in srgb,var(--bad) 24%,transparent)"></i>✕ fails</span><span><span style="color:var(--bad);font-weight:700">▲</span> law violated by the design</span><span><span style="color:var(--bad);opacity:.55">△</span> inherited from base</span><span><span style="color:var(--warn)">△</span> contested / candidate law</span><span>○ assumed value</span><span><i style="background:var(--mute)"></i>out of model range</span><span>× no value</span></div>
      <div class="sm" id="ptSM"></div>
      <details><summary>Table</summary><div class="tw" id="ptTable"></div></details>`;
    el.innerHTML = h; wireStage();
    $('ptMetric').onchange = e => { S.metricKey = e.target.value; renderTc(); };
    drawChart($('ptChart'), S.metricKey);
    $('ptSM').innerHTML = metrics.map(m => `<button data-mk="${esc(m.key)}" class="${m.key === S.metricKey ? 'on' : ''}" title="show ${esc(m.label)}">${spark(m.key)}<span>${esc(m.label)}</span></button>`).join('');
    $('ptSM').querySelectorAll('[data-mk]').forEach(b => b.onclick = () => { S.metricKey = b.dataset.mk; renderTc(); });
    const unit = metrics.find(m => m.key === S.metricKey)?.unit || '';
    $('ptTable').innerHTML = `<table><tr><th>stage</th><th>value${unit ? ' (' + esc(unit) + ')' : ''}</th><th>kind</th><th>survives</th><th>in range</th><th>laws violated</th></tr>${S.tc.map(r => { const m = metricOf(r.res, S.metricKey); const V = violations(r.judged);
      return `<tr><td>${esc(r.stage.label)}</td><td class="num">${m && m.value != null && isFinite(m.value) ? fmtNum(m.value) : 'no value'}</td><td>${KIND_BADGE(m && m.kind)}</td><td>${r.res.survives === false ? '<span style="color:var(--bad)">✕ no</span>' : r.res.survives === true ? '✓ yes' : '—'}</td><td>${r.res.validity && r.res.validity.inRange === false ? 'no' : 'yes'}</td><td>${V.length ? `<span style="color:var(--bad)">${V.map(v => esc(v.id)).join(', ')}</span>` : '—'}</td></tr>`; }).join('')}</table>`;
  }
  function wireStage() { const r = $('ptStage'); if (r) r.oninput = () => { S.stageIdx = +r.value; renderTc(); recompute(); }; }
  const xOf = (age, a0, a1, L, R) => { const f = a => Math.log1p(Math.max(0, a - a0)); return L + (R - L) * f(age) / (f(a1) || 1); };
  function spark(key) {
    const pts = S.tc.map(r => metricOf(r.res, key)?.value).map(v => v == null || !isFinite(v) ? null : v); const fin = pts.filter(v => v != null);
    if (fin.length < 1) return '<svg viewBox="0 0 100 30"></svg>';
    const lo = Math.min(...fin), hi = Math.max(...fin); const a0 = S.stages[0].age, a1 = S.stages[S.stages.length - 1].age;
    const Y = v => 26 - 22 * (hi > lo ? (v - lo) / (hi - lo) : 0.5);
    let d = '', pen = false; S.tc.forEach((r, i) => { const v = pts[i]; if (v == null) { pen = false; return; } const x = xOf(r.stage.age, a0, a1, 4, 96); d += (pen ? 'L' : 'M') + x.toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
    const bad = S.tc.map((r, i) => violations(r.judged).length || r.res.survives === false ? `<circle cx="${xOf(r.stage.age, a0, a1, 4, 96).toFixed(1)}" cy="4" r="2.2" fill="var(--bad)"/>` : '').join('');
    return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${bad}</svg>`;
  }
  function drawChart(box, key) {
    const W = Math.max(280, box.clientWidth || 380), H = 210, L = 46, R = W - 12, T = 22, B = H - 30;
    const a0 = S.stages[0].age, a1 = S.stages[S.stages.length - 1].age; const X = a => xOf(a, a0, a1, L, R);
    const rows = S.tc.map(r => ({ r, m: metricOf(r.res, key) })); const fin = rows.map(x => x.m && x.m.value).filter(v => v != null && isFinite(v));
    let lo = fin.length ? Math.min(...fin) : 0, hi = fin.length ? Math.max(...fin) : 1; if (lo > 0 && lo < hi * 0.5) lo = 0; if (hi === lo) { hi = lo + (Math.abs(lo) || 1); lo = lo - (Math.abs(lo) || 1) * 0.1; }
    const pad = (hi - lo) * 0.08; lo -= lo === 0 ? 0 : pad; hi += pad; const Y = v => B - (B - T) * (v - lo) / (hi - lo);
    const ticks = []; const step = niceStep((hi - lo) / 4); for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step) ticks.push(+v.toPrecision(6));
    const unit = rows.find(x => x.m)?.m?.unit || ''; const label = rows.find(x => x.m)?.m?.label || key;
    const xs = rows.map(x => X(x.r.stage.age)); const mid = i => i === 0 ? L : i === xs.length ? R : (xs[i - 1] + xs[i]) / 2;
    let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} at each developmental stage">`;
    g += `<text x="${L}" y="12" style="fill:var(--ink);font-weight:600">${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</text>`;
    rows.forEach((x, i) => { const sv = x.r.res.survives; if (sv == null) return; g += `<rect x="${mid(i).toFixed(1)}" y="${T}" width="${(mid(i + 1) - mid(i)).toFixed(1)}" height="${B - T}" fill="${sv ? 'var(--ok)' : 'var(--bad)'}" opacity="${sv ? 0.09 : 0.13}"/>`; });
    for (const v of ticks) g += `<line x1="${L}" x2="${R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${fmtNum(v)}</text>`;
    rows.forEach((x, i) => { const lab = x.r.stage.age >= 1 ? Math.round(x.r.stage.age) : x.r.stage.age; g += `<text x="${xs[i].toFixed(1)}" y="${B + 14}" text-anchor="middle">${lab}${i === rows.length - 1 ? ' d' : ''}</text>`; });
    g += `<text x="${R}" y="${H - 2}" text-anchor="end">age, days after hatching (log scale)</text>`;
    const cx = xs[S.stageIdx]; g += `<line x1="${cx}" x2="${cx}" y1="${T}" y2="${B}" stroke="var(--ink)" stroke-width="1" opacity=".45"/>`;
    let d = '', pen = false; rows.forEach((x, i) => { const v = x.m && x.m.value; if (v == null || !isFinite(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + xs[i].toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
    g += `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    rows.forEach((x, i) => { const v = x.m && x.m.value; const out = x.r.res.validity && x.r.res.validity.inRange === false;
      if (v == null || !isFinite(v)) { g += `<text x="${xs[i]}" y="${B - 4}" text-anchor="middle" style="fill:var(--mute);font-size:12px">×</text>`; }
      else { const assumed = x.m.kind === 'assumed'; const col = out ? 'var(--mute)' : 'var(--accent)';
        g += `<circle cx="${xs[i].toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5" fill="${assumed ? 'var(--panel)' : col}" stroke="${assumed ? col : 'var(--panel)'}" stroke-width="2"${assumed ? ' stroke-dasharray="2 1.5"' : ''}/>`; }
      if (newViolations(x.r.judged).length) g += `<path d="M${xs[i] - 5} ${T + 9} L${xs[i] + 5} ${T + 9} L${xs[i]} ${T + 1} Z" fill="var(--bad)"/>`;
      else if (violations(x.r.judged).length) g += `<path d="M${xs[i] - 5} ${T + 9} L${xs[i] + 5} ${T + 9} L${xs[i]} ${T + 1} Z" fill="none" stroke="${violations(x.r.judged).every(r => r.inherited) ? 'var(--bad)' : 'var(--warn)'}" stroke-width="1.5" opacity="${violations(x.r.judged).every(r => r.inherited) ? 0.55 : 1}"/>`; });
    g += `<line id="ptCross" x1="0" x2="0" y1="${T}" y2="${B}" stroke="var(--mute)" stroke-width="1" style="display:none"/>`;
    g += `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="transparent" id="ptHit"/></svg><div class="tip" id="ptTip"></div>`;
    box.innerHTML = g;
    const svg = box.querySelector('svg'), tip = box.querySelector('#ptTip'), cross = box.querySelector('#ptCross');
    const near = ev => { const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * W / r.width; let bi = 0; xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(xs[bi] - px)) bi = i; }); return { bi, r }; };
    const hit = box.querySelector('#ptHit');
    hit.addEventListener('pointermove', ev => { const { bi, r } = near(ev); const x = rows[bi]; cross.setAttribute('x1', xs[bi]); cross.setAttribute('x2', xs[bi]); cross.style.display = '';
      tip.textContent = ''; const v = x.m && x.m.value; const b = document.createElement('b'); b.textContent = v == null || !isFinite(v) ? 'no value' : fmtNum(v) + (unit ? ' ' + unit : ''); tip.appendChild(b);
      const lines = [x.r.stage.label, 'kind: ' + ((x.m && x.m.kind) || 'not stated'), x.r.res.survives === false ? '✕ fails' : x.r.res.survives === true ? '✓ survives' : 'survival not stated'];
      if (x.r.res.validity && x.r.res.validity.inRange === false) lines.push('out of model range: ' + (x.r.res.validity.notes || ''));
      const V = violations(x.r.judged); if (V.length) lines.push('laws violated: ' + V.map(v => v.id + (v.severity !== 'accepted' ? ' (' + v.severity + ')' : '')).join(', '));
      for (const l of lines) { const dv = document.createElement('div'); dv.className = 'tiny'; dv.textContent = l; tip.appendChild(dv); }
      tip.style.display = 'block'; const px = xs[bi] * r.width / W; tip.style.left = Math.min(px + 10, r.width - 200) + 'px'; tip.style.top = '24px'; });
    hit.addEventListener('pointerleave', () => { tip.style.display = 'none'; cross.style.display = 'none'; });
    hit.addEventListener('click', ev => { const { bi } = near(ev); S.stageIdx = bi; renderTc(); recompute(); });
  }
  function niceStep(x) { if (!(x > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))); const f = x / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }

  // --------------------------------------------------- optimiser (Web Worker)
  function renderOpt() {
    const el = $('ptOpt'); const s = scen();
    if (!S.engine || !s || !S.now) { el.innerHTML = `<h4>Optimise</h4><p class="tiny">Needs the engine and a scenario.</p>`; return; }
    const metrics = S.now.res.metrics || []; const O = S.opt || {};
    const edits = (S.doc.edits || []).map((e, i) => ({ e, i }));
    const varyRows = edits.map(({ e, i }) => { const v = +e.value; const lo = O.bounds?.[i]?.[0] ?? (e.op === 'add' ? v - Math.abs(v || 1) : v * 0.5); const hi = O.bounds?.[i]?.[1] ?? (e.op === 'add' ? v + Math.abs(v || 1) : v * 1.5);
      return `<tr><td><input type="checkbox" data-vary="${i}" ${O.vary ? (O.vary.includes(i) ? 'checked' : '') : 'checked'} aria-label="vary"></td><td class="small">${esc(e.op)} <span class="mono">${esc(e.param)}</span><div class="tiny">${esc(e.target?.label || '')}</div></td><td><input type="number" step="any" data-lo="${i}" value="${+lo.toPrecision(4)}" aria-label="lower bound"></td><td><input type="number" step="any" data-hi="${i}" value="${+hi.toPrecision(4)}" aria-label="upper bound"></td></tr>`; }).join('');
    let h = `<h4>Optimise</h4><div class="row"><label class="small">objective <select id="ptObj">${metrics.map(m => `<option value="${esc(m.key)}"${m.key === (O.objective || S.metricKey) ? ' selected' : ''}>${esc(m.label || m.key)} (${betterSign(m.better) > 0 ? 'maximise' : 'minimise'})</option>`).join('')}</select></label></div>
      ${edits.length ? `<div class="tw"><table><tr><th></th><th>edited parameter may vary</th><th>min</th><th>max</th></tr>${varyRows}</table></div>` : '<p class="tiny">Only edited parameters vary: make an edit first (Selection, above).</p>'}
      <div class="row"><label class="small">seed <input type="number" id="ptSeed" value="${O.seed ?? 1}" step="1"></label><label class="small">evaluations <input type="number" id="ptN" value="${O.n ?? 40}" min="4" max="400" step="1"></label><label class="small" title="strict: reject any violation of an accepted law, including ones the base organism already breaks"><input type="checkbox" id="ptStrict" ${O.strict ? 'checked' : ''}> strict</label><button id="ptGo" class="primary" ${edits.length ? '' : 'disabled'}>${O.running ? 'stop' : 'optimise'}</button></div>
      <p class="tiny">Seeded random search in a Web Worker at the current stage (${esc(S.stages[S.stageIdx].label)}). A candidate that newly violates an accepted Lean law (one the base organism does not already break; any, in strict mode) is rejected and listed with the law; one that fails the scenario is kept out of “best”.</p>
      ${S.specNote ? `<div class="outnote"><b>From the typed spec</b>: optimising ${esc(S.specNote.main ? (S.specNote.main.metric + ' (' + S.specNote.main.op + ')') : 'nothing (no metric criterion)')}. Not enforced by this in-browser search: ${S.specNote.others.length ? S.specNote.others.map(c => esc((c.hard ? 'hard ' : '') + c.id + ' ' + c.op + (c.value != null ? ' ' + c.value : ''))).join('; ') : 'none'}.</div>` : ''}
      <div id="ptOptOut"></div>`;
    el.innerHTML = h;
    $('ptGo').onclick = () => O.running ? stopOpt() : startOpt();
    drawOptOut();
  }
  function readOptForm() {
    const vary = [], bounds = {};
    $('ptOpt').querySelectorAll('[data-vary]').forEach(c => { const i = +c.dataset.vary; bounds[i] = [+$('ptOpt').querySelector(`[data-lo="${i}"]`).value, +$('ptOpt').querySelector(`[data-hi="${i}"]`).value]; if (c.checked) vary.push(i); });
    return { objective: $('ptObj').value, strict: !!($('ptStrict') && $('ptStrict').checked), vary, bounds, seed: +$('ptSeed').value || 1, n: Math.max(4, Math.min(400, +$('ptN').value || 40)) };
  }
  function startOpt(over) {
    const f = { ...readOptForm(), ...(over || {}) }; const s = scen(); const m = (S.now.res.metrics || []).find(x => x.key === f.objective);
    if (!f.vary.length) { S.opt = { ...f, error: 'tick at least one edited parameter' }; renderOpt(); return; }
    const spec = over && over.spec ? over.spec : null;
    S.opt = { ...f, spec, better: m ? m.better : 'higher', running: true, trace: [], rejected: [], best: null, error: null, status: null, note: null };
    try { if (S.worker) S.worker.terminate(); S.worker = new Worker(new URL('perturb-worker.js', HERE), { type: 'module' }); }
    catch (e) { S.opt.running = false; S.opt.error = 'Web Worker unavailable: ' + e.message; renderOpt(); return; }
    S.worker.onmessage = e => { const d = e.data; const O = S.opt; if (!O) return;
      if (d.type === 'cand') { O.trace.push(d.cand); if (d.cand.rejected) O.rejected.push(d.cand); if (d.best) O.best = d.best; drawOptOut(); }
      else if (d.type === 'done') { O.running = false; O.best = d.best; O.status = d.status; O.note = d.note; O.specNote = d.specNote; O.start = d.start; O.tolerance = d.tolerance; renderOpt(); postLog({ role: 'agent', label: 'optimiser (in-browser worker)', kind: 'optimise', text: `status ${O.status}: seed ${O.seed}, ${O.trace.length} evaluations including the start design, ${O.rejected.length} rejected; ${O.status === 'ok' ? 'best ' + O.objective + ' = ' + fmtNum(O.best.value) : (O.note || '')}` }); }
      else if (d.type === 'error') { O.running = false; O.error = d.message; renderOpt(); } };
    S.worker.onerror = e => { S.opt.running = false; S.opt.error = 'worker error: ' + (e.message || 'unknown'); renderOpt(); };
    S.worker.postMessage({ urls: S.engine.urls, checkerUrl: host.checkerUrl || new URL('browser-check.mjs', HERE).href, lawClientUrl: host.lawClientUrl || new URL('lean-client.js', HERE).href, lawsetVersion: S.lawsetSel || (S.laws && S.laws.lawset && S.laws.lawset.version) || undefined, doc: S.doc, scenarioKey: s.key, params: S.params, age: S.stages[S.stageIdx].age,
      objective: f.objective, better: S.opt.better, strict: !!f.strict, spec, tolerance: 1e-3, species: host.species || null, vary: f.vary.map(i => ({ i, lo: Math.min(...f.bounds[i]), hi: Math.max(...f.bounds[i]) })), seed: f.seed, n: f.n });
    renderOpt();
  }
  function stopOpt() { if (S.worker) S.worker.terminate(); S.worker = null; if (S.opt) S.opt.running = false; renderOpt(); }
  function drawOptOut() {
    const el = $('ptOptOut'); const O = S.opt; if (!el || !O) return; if (O.error) { el.innerHTML = `<div class="fail"><b>✕</b> ${esc(O.error)}</div>`; return; }
    const T = O.trace || []; const W = Math.max(280, el.clientWidth || 380), H = 150, L = 46, R = W - 10, Tp = 10, B = H - 24;
    const vals = T.map(c => c.value).filter(v => v != null && isFinite(v)); let h = '';
    if (T.length) {
      let lo = Math.min(...vals), hi = Math.max(...vals); if (!vals.length) { lo = 0; hi = 1; } if (hi === lo) { hi = lo + (Math.abs(lo) || 1) * 0.1; lo -= (Math.abs(lo) || 1) * 0.1; }
      const X = i => L + (R - L) * i / Math.max(1, (O.n || T.length) - 1), Y = v => B - (B - Tp) * (v - lo) / (hi - lo); const sgn = betterSign(O.better);
      let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="optimiser trace">`; const step = niceStep((hi - lo) / 3);
      for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step) g += `<line x1="${L}" x2="${R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/><text x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${fmtNum(v)}</text>`;
      let best = null, d = ''; T.forEach((c, i) => { if (!c.rejected && c.survives !== false && c.value != null && isFinite(c.value) && (best == null || sgn * c.value > sgn * best)) best = c.value; if (best != null) d += (d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(best).toFixed(1); });
      g += `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2" opacity=".7"/>`;
      T.forEach((c, i) => { if (c.value == null || !isFinite(c.value)) return; const x = X(i), y = Y(c.value);
        g += c.rejected ? `<g><title>#${i + 1} rejected: ${esc(c.laws.map(l => l.id).join(', '))}</title><path d="M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x - 4} ${y + 4}L${x + 4} ${y - 4}" stroke="var(--bad)" stroke-width="2"/></g>`
          : `<g><title>#${i + 1}: ${fmtNum(c.value)}${c.survives === false ? ' (fails the scenario)' : ''}</title><circle cx="${x}" cy="${y}" r="4" fill="${c.survives === false ? 'var(--panel)' : 'var(--accent)'}" stroke="${c.survives === false ? 'var(--bad)' : 'var(--panel)'}" stroke-width="2"/></g>`; });
      g += `<text x="${R}" y="${H - 4}" text-anchor="end">evaluation (${T.length}/${O.n})</text></svg>`;
      h += `<div class="chart">${g}</div><div class="key"><span><span style="color:var(--accent)">●</span> feasible</span><span><span style="color:var(--bad)">✕</span> rejected by a Lean law</span><span>○ red ring: fails the scenario</span><span>— best so far</span></div>`;
    } else if (O.running) h += '<p class="tiny">starting the worker…</p>';
    if (O.running) { if (O.best) h += `<p class="tiny">running… best so far ${esc(O.objective)} = ${fmtNum(O.best.value)} (not yet compared with the start design)</p>`; }
    else if (O.status === 'ok' && O.best) { const B0 = O.best; h += `<div class="okline"><b>Status: ok</b> · best design ${esc(O.objective)} = <b>${fmtNum(B0.value)}</b>${B0.improvement != null ? ` (start ${fmtNum(O.start.value)}, change ${fmtNum(B0.improvement)})` : ''} · seed ${O.seed}${O.note ? `<div class="tiny">${esc(O.note)}</div>` : ''}<div class="tw"><table>${B0.x.map(v => { const e = S.doc.edits[v.i]; return `<tr><td>${esc(e ? e.param : '#' + v.i)}</td><td class="num">${fmtNum(v.v)}</td></tr>`; }).join('')}</table></div><button id="ptApplyBest" class="primary">apply best as edits</button></div>`; }
    else if (O.status === 'no improvement') h += `<div class="outnote"><b>Status: no improvement</b> · the start design is returned unchanged (${esc(O.objective)} = ${fmtNum(O.start && O.start.value)}). ${esc(O.note || '')}</div>`;
    else if (O.status === 'no design meets the spec') { const why = {}; for (const c of [...(O.start && O.start.laws ? [{ laws: O.start.laws }] : []), ...O.rejected]) for (const l of c.laws || []) why[l.id] = l;
      h += `<div class="fail"><b>✕ Status: no design meets the spec</b> · ${esc(O.note || '')}<div class="small">Ruled out by: ${Object.values(why).map(l => `<b>${esc(l.id)}</b> ${esc(l.domain === 'biological' ? 'biological law (Lean bio)' : l.domain === 'physical' ? 'physical law (Lean)' : l.domain === 'criterion' ? 'criterion' : l.domain === 'engine' ? 'engine' : 'law')}: ${esc(l.text || '')}`).join('<br>') || 'not stated'}</div></div>`; }
    if (!O.running && O.specNote) h += `<div class="warnline">${esc(O.specNote)}</div>`;
    if (O.rejected && O.rejected.length) h += `<details ${O.running ? '' : 'open'}><summary style="color:var(--bad)">Rejected candidates (${O.rejected.length}): laws, criteria, engine</summary>${O.rejected.slice(0, 40).map(c => `<div class="viol"><span class="lid">✕ #${c.idx + 1}</span> <span class="tiny">${c.x.map(v => esc((S.doc.edits[v.i] || {}).param || v.i) + ' ' + fmtNum(v.v)).join(', ')}</span><div class="small">${c.laws.map(l => `<b>${esc(l.id)}</b> ${esc(l.domain === 'biological' ? 'biological law (Lean bio)' : l.domain === 'physical' ? 'physical law (Lean)' : l.domain === 'engine' ? 'refused by the engine' : l.domain === 'criterion' ? 'criterion not met' : 'law')}: ${esc(l.text || '')}`).join('<br>')}</div></div>`).join('')}</details>`;
    el.innerHTML = h;
    const ab = el.querySelector('#ptApplyBest'); if (ab) ab.onclick = () => { for (const v of O.best.x) { const e = S.doc.edits[v.i]; if (e) { e.value = v.v; e.author = 'agent:optimiser'; e.reason = `optimiser best ${O.objective} (seed ${O.seed}, ${O.trace.length} evaluations)`; } } postLog({ role: 'human', label: 'human (Perturb UI)', kind: 'edit', text: 'applied the optimiser best design (seed ' + O.seed + ')' }); renderSel(); recompute(); };
  }

  // --------------------------------------------------- spec box (sim-engine's "type the functional criteria")
  async function mountSpecBox() {
    const slot = $('ptSpec'); if (!slot) return;
    let mod = null; try { mod = await import(new URL('spec-box.js', HERE).href); } catch { return; }
    if (!mod || typeof mod.mountSpecBox !== 'function') return;
    try { mod.mountSpecBox(slot, { onSpec: onSpec }); } catch (e) { console.warn('spec-box', e); }
  }
  // spec: a DesignSpec from spec-box.js (sim-engine/lib/spec.mjs): {start_from, base_edits, criteria:[{id, scenario,
  // params, metric, op, value, stages, weight, hard}], editable:[{target, param, min, max}], constraints}. The in-browser
  // search optimises ONE metric: the first soft maximise/minimise/>=/<= criterion. Every other criterion is listed
  // below the optimiser as not enforced here (the engine's optimizer tool evaluates the whole spec).
  async function onSpec(spec, info) {
    if (!spec || !S.engine) return;
    const crit = spec.criteria || []; const soft = crit.filter(c => !c.hard && /maximi|minimi|>=|<=/.test(c.op) && c.metric);
    const main = soft[0] || crit.find(c => c.metric) || null;
    if (main && S.engine.scenarios.some(x => x.key === main.scenario)) { pickScenario(main.scenario); Object.assign(S.params, main.params || {}); }
    for (const e of spec.base_edits || []) await addEdit({ ...e, author: e.author || 'agent:spec-box', reason: e.reason || 'base edit from the typed spec' }, { silent: true });
    // each editable entry becomes a starting edit at its current value, so the optimiser may vary it
    for (const ed of spec.editable || []) {
      const t = { level: ed.target.level === 'system' ? 'organ_system' : ed.target.level, id: ed.target.id, label: ed.target.id, piece: ed.target.level === 'organ' ? ed.target.id : null };
      if ((S.doc.edits || []).some(e => e.param === ed.param && e.target.id === ed.target.id)) continue;
      const P = engineCatalogue(t).find(p => p.param === ed.param); if (!P || P.value == null) continue;
      await addEdit({ target: engTarget(t), param: ed.param, op: 'set', value: P.value, author: 'agent:spec-box', reason: 'made editable by the typed spec (start at the base value)' }, { silent: true });
    }
    S.specNote = { text: info && info.text, main, others: crit.filter(c => c !== main) };
    postLog({ role: 'human', label: 'human', kind: 'spec', text: 'typed spec: ' + ((info && info.text) || JSON.stringify(crit.map(c => c.id))) });
    renderScn(); renderSel(); await recompute();
    if (!main) return;
    const vary = (S.doc.edits || []).map((e, i) => ({ e, i })).filter(({ e }) => !spec.editable || !spec.editable.length || spec.editable.some(x => x.param === e.param && x.target.id === e.target.id)).map(x => x.i);
    const bounds = Object.fromEntries(vary.map(i => { const e = S.doc.edits[i]; const x = (spec.editable || []).find(q => q.param === e.param && q.target.id === e.target.id); return [i, x && x.min != null && x.max != null ? [x.min, x.max] : [e.value * 0.5, e.value * 1.5]]; }));
    if (vary.length) { renderOpt(); startOpt({ objective: main.metric, vary, bounds, seed: 1, n: 40, spec }); }
  }

  // --------------------------------------------------- co-design log
  const logKey = () => 'delphi-perturb-log:' + (S.log.session || 'local');
  const clean = s => String(s ?? '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[removed]');
  async function loadLog() {
    let ex = host.codesign || null;
    if (!ex && host.codesignUrl) ex = await fetch(host.codesignUrl).then(r => r.ok ? r.json() : null).catch(() => null);
    const posts = ex ? (Array.isArray(ex) ? ex : ex.posts || ex.events || ex.log || []) : [];
    S.log = { session: ex && (ex.session?.id || ex.session || ex.id) || null, title: ex && (ex.session?.title || ex.title) || null, mock: !!(ex && ex.MOCK), source: ex ? (host.codesign ? 'host' : String(host.codesignUrl)) : null, posts: posts.map(normPost) };
    try { const loc = JSON.parse(lsGet(logKey()) || '[]'); S.log.local = loc.map(normPost); } catch { S.log.local = []; }
  }
  function normPost(p) { const role = /agent|bot|claude|llm/i.test(p.role || p.kind_of_author || '') ? 'agent' : 'human';
    return { role, label: clean(p.label || p.role_label || p.agent || (role === 'agent' ? 'agent' : 'human')).slice(0, 60), kind: p.kind || p.type || 'comment', text: clean(p.text || p.body || p.message || ''), at: p.at || p.time || p.timestamp || null }; }
  function postLog(p) { const q = normPost({ ...p, at: new Date().toISOString() }); S.log.local = (S.log.local || []).concat(q); lsSet(logKey(), JSON.stringify(S.log.local.slice(-200))); renderLog(); }
  function renderLog() {
    const el = $('ptLog'); const all = [...(S.log.posts || []), ...(S.log.local || [])];
    let h = `<h4>Co-design log${S.log.title ? ' · ' + esc(S.log.title) : ''}</h4>`;
    if (S.log.mock) h += `<div class="mock"><b>&#9888; MOCK session</b> — sample posts defined in the test harness, not a real co-design session.</div>`;
    else if (!S.log.source) h += `<p class="tiny">No session export loaded (the host passes <span class="mono">codesignUrl</span>, the MCP server's session export). Posts below are this browser's own.</p>`;
    h += `<div class="loglist">${all.length ? all.map(p => `<div class="post ${p.role}"><div class="who">${p.role === 'agent' ? 'agent' : 'human'} · ${esc(p.label)} · ${esc(p.kind)}${p.at ? ' · ' + esc(String(p.at).replace('T', ' ').slice(0, 16)) : ''}</div><div class="small">${esc(p.text)}</div></div>`).join('') : '<p class="tiny">No posts yet.</p>'}</div>
      <textarea id="ptPost" placeholder="comment on this design (role labels only; no names or emails)" aria-label="comment"></textarea>
      <div class="row"><label class="small">as <select id="ptRole"><option>human</option><option>biologist</option><option>engineer</option><option>reviewer</option></select></label><button id="ptSend" class="primary">post</button><button id="ptExportLog">download session JSON</button></div>
      <p class="tiny">Posts are kept in this browser and included in the download; the MCP server ingests that file. Role labels only.</p>`;
    el.innerHTML = h; const ll = el.querySelector('.loglist'); ll.scrollTop = ll.scrollHeight;
    $('ptSend').onclick = () => { const t = $('ptPost').value.trim(); if (!t) return; postLog({ role: 'human', label: $('ptRole').value, kind: 'comment', text: t }); };
    $('ptExportLog').onclick = () => download('codesign-session.json', { session: S.log.session, organism: S.doc, posts: all });
  }

  // --------------------------------------------------- genotype layer
  // Every gene annotation here is a PROXY-organism record (zebrafish, medaka, sometimes other species): no flying-fish
  // expression, phenotype or pathway record exists. The files: data.json genotype (= genotype/map.vetted.slim.json),
  // pathways.json, causal-chains.json, interventions.json, sequence-layer.json, all served next to this page.
  // The house rule is genotype.js's: a residue is a STATE, not a phenotype; only a calibrated intervention from
  // interventions.json moves the mesh.
  const GX = { loading: null, pw: null, chains: null, interv: null, seq: null };
  function loadGeno() {
    if (GX.loading) return GX.loading;
    const j = u => fetch(new URL(u, HERE)).then(r => r.ok ? r.json() : null).catch(() => null);
    GX.loading = Promise.all([j('pathways.json'), j('causal-chains.json'), j('interventions.json'), j('sequence-layer.json')]).then(([pw, cc, iv, sq]) => {
      GX.pw = pw; GX.chains = normaliseChains(cc); GX.interv = normaliseInterventions(iv); GX.seq = sq; renderGeno(); });
    return GX.loading;
  }
  const G = () => S.data && S.data.genotype && !S.data.genotype.gated && S.data.genotype.links ? S.data.genotype : null;
  const RANK = { 'sufficient for': 0, 'required for': 1, 'expressed in': 2 };
  // the ontology node behind a target (a part id maps to its manifest ontology id)
  function nodeOf(tg) {
    if (!tg) return null; const lv = engLevel(tg.level); if (lv === 'body' || lv === 'gene') return null;
    if (lv === 'organ' || lv === 'tissue') { const o = meshes().find(x => x.name === tg.id) || meshes().find(x => (x.group || x.name) === String(tg.id).replace(/^piece:/, ''));
      if (o && o.m) return o.m.ontology_id || o.m.uberon_id || null; const r = rawEntry(tg.id); if (r) return r.ontology_id || null; }
    return tg.id;
  }
  function genesAt(node) {
    const by = new Map(); const add = (sym, why, rank) => { const g = by.get(sym) || { sym, why: [], rank: 9 }; g.why.push(why); g.rank = Math.min(g.rank, rank); by.set(sym, g); };
    const Gm = G(); for (const l of (Gm && Gm.links[node]) || []) add(l.symbol, l.link + ' (' + l.organism + ')', RANK[l.link] ?? 3);
    for (const sym of (GX.chains && GX.chains.byNode[node]) || []) add(sym, 'causal chain lands here', 1.5);
    return [...by.values()].sort((a, b) => a.rank - b.rank || a.sym.localeCompare(b.sym));
  }
  function touchedGenes() {
    const out = new Map(); const add = (sym, why) => { const w = out.get(sym) || []; if (!w.includes(why)) w.push(why); out.set(sym, w); };
    for (const e of [...((S.doc && S.doc.edits) || []), ...S.geo]) {
      if (engLevel(e.target && e.target.level) === 'gene') { add(e.target.id, 'edited directly (' + e.param + ')'); continue; }
      const node = nodeOf(e.target); if (!node) continue; const lab = labelOf(e.target);
      for (const g of genesAt(node)) if (g.rank < 2) add(g.sym, g.why[0].replace(/ \(.*\)$/, '') + ' ' + lab);
    }
    return out;
  }
  const PROXY = org => `<span class="proxy" title="a proxy-organism record, not a flying-fish measurement">${esc(org || 'proxy')} proxy · not flying fish</span>`;
  function renderGeno() {
    const el = $('ptGeno'); if (!el || !S.doc) return;
    if (!GX.pw && !GX.loading) loadGeno();
    const t = S.target; const node = t.level === 'gene' ? null : nodeOf(engTarget(t)) || (t.level !== 'body' ? t.id : null);
    let h = `<h4>Genotype</h4><p class="tiny">Proxy-organism annotations (mostly zebrafish, some medaka): none is a flying-fish measurement. From data.json's vetted map (${esc((G() && G().file) || 'genotype/map.vetted.slim.json')}), pathways.json, causal-chains.json, interventions.json and sequence-layer.json.</p>`;
    // genes the current design's edits touch
    const touched = touchedGenes();
    h += `<details${touched.size && touched.size <= 12 ? ' open' : ''}><summary>Genes this design's edits touch (${touched.size})</summary>${touched.size ? (() => { const T = [...touched]; const direct = T.filter(([, w]) => w.some(x => /^edited directly/.test(x))); const sufficient = T.filter(x => !direct.includes(x) && x[1].some(y => /^sufficient|causal chain/.test(y))); const rest = T.filter(x => !direct.includes(x) && !sufficient.includes(x)); const chip = ([g, w]) => `<a class="gene gchip" data-gsym="${esc(g)}" title="${esc(w.join('; '))}">${esc(g)}</a>`;
      return (direct.length ? `<div class="small"><b>edited directly</b>: ${direct.map(([g, w]) => chip([g, w]) + `<span class="tiny">${esc(w.filter(x => /^edited/.test(x)).join('; '))}</span>`).join(' ')}</div>` : '') + (sufficient.length ? `<div class="small"><b>sufficient for / causal chain at an edited part</b>: ${sufficient.map(chip).join('')}</div>` : '') + (rest.length ? `<div class="small"><b>required for an edited part</b>: ${rest.map(chip).join('')}</div>` : ''); })() : '<p class="tiny">No edit touches a gene record (only "sufficient for", "required for" and causal-chain links count; "expressed in" does not).</p>'}</details>`;
    if (node) {
      const genes = GX.chains || G() ? genesAt(node) : [];
      const show = S.genesAll ? genes : genes.slice(0, 30);
      h += `<p class="small" style="margin:6px 0 2px"><b>Genes recorded at ${esc(t.label)}</b> <span class="tiny">(${genes.length}; sufficient and required first)</span></p>${genes.length ? show.map(g => `<a class="gene gchip ${g.rank === 0 ? 'S' : g.rank < 2 ? 'R' : ''}${S.gene === g.sym ? ' on' : ''}" data-gsym="${esc(g.sym)}" title="${esc(g.why.join('; '))}">${esc(g.sym)}</a>`).join('') + (genes.length > 30 ? ` <button id="ptGAll" class="tiny">${S.genesAll ? 'fewer' : 'all ' + genes.length}</button>` : '') : '<p class="tiny">No gene record is stored for this node in the vetted map.</p>'}`;
    }
    const allSyms = [...new Set([...Object.keys((G() && G().gene_index) || {}), ...Object.keys((GX.chains && GX.chains.bySymbol) || {}), ...((GX.interv && GX.interv.all) || []).map(r => r.gene)])].sort();
    h += `<div class="row"><input type="search" id="ptGQ" list="ptGList" placeholder="any gene: symbol…" aria-label="gene symbol"><datalist id="ptGList">${allSyms.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>`;
    if (S.gene) h += geneCard(S.gene, node);
    else h += `<p class="tiny">Click a gene for its annotations and gene-level edits.</p>`;
    h += `<div class="row" style="margin-top:8px"><button id="ptValidate">Validate &amp; score</button><span class="tiny">design scorer, closest real relative, genotype sanity (validate-panel.js)</span></div><div id="ptValSlot"></div>`;
    el.innerHTML = h;
    el.querySelectorAll('[data-gsym]').forEach(a => a.onclick = () => { S.gene = a.dataset.gsym; renderGeno(); });
    const ga = $('ptGAll'); if (ga) ga.onclick = () => { S.genesAll = !S.genesAll; renderGeno(); };
    el.querySelectorAll('[data-gedit]').forEach(b => b.onclick = () => geneEdit(b.dataset.gedit));
    el.querySelectorAll('[data-knob]').forEach(b => b.onclick = () => applyKnob(b.dataset.knob));
    $('ptValidate').onclick = mountValidate;
    const q = $('ptGQ'); if (q) q.onchange = () => { const v = q.value.trim(); if (v) { S.gene = v; renderGeno(); } };
  }
  function geneCard(sym, node) {
    const Gm = G(); let h = `<div class="sec" style="border-top:1px dashed var(--line)"><h4>${esc(sym)}</h4>`;
    // vetted map rows: at this node, and how many nodes the gene touches
    const rows = node && Gm ? (Gm.links[node] || []).filter(l => l.symbol === sym).sort((a, b) => (RANK[a.link] ?? 3) - (RANK[b.link] ?? 3)) : [];
    const gi = Gm && Gm.gene_index && Gm.gene_index[sym];
    h += `<p class="small"><b>Vetted map</b> ${gi ? `· recorded at ${Object.keys(gi.nodes || {}).length} nodes (${esc((gi.organisms || []).join(', '))})` : '· no gene-index entry'}</p>`;
    if (rows.length) h += `<div class="tw"><table><tr><th>link</th><th>record</th></tr>${rows.slice(0, 8).map(l => `<tr><td>${esc(l.link)}<br>${PROXY(l.organism)}</td><td class="tiny">${esc(l.finding || '')}<br>${esc(l.kind || '')} · ${esc(l.db || '')}${l.stage ? ' · stage ' + esc(l.stage) : ''}${l.url ? ` · <a href="${esc(l.url)}" target="_blank" rel="noopener">source</a>` : ''}</td></tr>`).join('')}</table></div>`;
    if (Gm && Gm.causation_warning) h += `<p class="tiny">${esc(Gm.causation_warning)}</p>`;
    // causal chain
    const C = GX.chains, ce = C && C.bySymbol[sym];
    if (!GX.pw && !C) h += '<p class="tiny">loading the genotype files…</p>';
    else if (ce) h += `<details><summary>Causal chain to phenotype: strength ${gradeChip(ce.weakest, true)}</summary>${chainLadderHtml(C, ce, id => { const tt = termOf(id); return tt ? tt.label : null; })}</details>`;
    else h += '<p class="tiny">No causal chain for this gene in causal-chains.json.</p>';
    // pathways
    const P = GX.pw; if (P) { const key = P.symbols && P.symbols[sym]; const list = key ? (P.genes[key] || []) : [];
      const srcName = { G: 'GO:BP', R: 'Reactome', K: 'KEGG' };
      h += list.length ? `<details><summary>Pathways (${list.length}): ${Object.entries(list.reduce((a, r) => (a[srcName[r[1]] || r[1]] = (a[srcName[r[1]] || r[1]] || 0) + 1, a), {})).map(([k, v]) => k + ' ' + v).join(', ')}</summary><p class="tiny">${esc(P.not_causation || '')} ${esc(P.constraint || '')}</p><ul class="t small" style="padding-left:1.1em">${list.slice(0, 24).map(r => { const pw = P.pathways[r[0]] || {}; return `<li>${esc(pw.name || r[0])} <span class="tiny">${esc(r[0])} · ${esc(srcName[r[1]] || r[1])} · evidence ${esc(r[2])}${r[3] ? ' · inferred by orthology from human' : ''}${r[2] === 'IEA' ? ' · electronic' : ''}</span></li>`; }).join('')}</ul>${list.length > 24 ? `<p class="tiny">+${list.length - 24} more in genotype/pathways.slim.json</p>` : ''}</details>` : '<p class="tiny">No pathway row for this gene in pathways.json.</p>'; }
    // calibrated interventions
    const I = GX.interv; if (I) { const mine = I.all.filter(r => r.gene === sym);
      const guard = I.guards && I.guards.pairs.find(p => p.gene === sym);
      h += mine.length ? `<details><summary>Interventions (${mine.length}; ${mine.filter(r => r.knob).length} calibrated)</summary>${guard ? `<p class="tiny">Paralog guard: ${esc(guard.note || '')} (${esc(guard.paralog)} is a different gene; its evidence is never used for ${esc(sym)}).</p>` : ''}${mine.slice(0, 12).map(r => `<div class="prow" style="display:block"><b class="small">${esc(r.parameter)}</b> <span class="tiny">${esc(r.level)} · ${esc(r.direction || '')} · grade ${esc(r.grade)}</span> ${PROXY(r.organism)}${r.knob ? ' <span class="badge calibrated">calibrated knob</span>' : ''}
          <div class="tiny">${r.lesion ? esc(r.lesion) + ' · ' : ''}stage: ${esc(r.stage.text)} (${esc(r.stage.regime)})${r.effect && typeof r.effect.value === 'number' ? ` · effect ${esc(r.effect.value)} ${esc(r.effect.unit || '')}` : ' · no magnitude reported'}${r.lethality ? ' · lethality: ' + esc(typeof r.lethality === 'string' ? r.lethality : JSON.stringify(r.lethality)) : ''}</div>
          ${r.sources.length ? `<div class="tiny">${r.sources.slice(0, 2).map(x => x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.ref)}</a>` : esc(x.ref)).join('; ')}</div>` : ''}
          ${r.knob && r.knobEffect ? `<button data-knob="${esc(r.id)}" class="primary">apply: ${esc(r.knobEffect.label)}</button> <span class="tiny">moves the mesh (both pectoral fins), valid only in its measured stage window</span>` : r.knob ? '<div class="tiny">calibrated, but no morphology the model shows: recorded, not applied</div>' : ''}</div>`).join('')}</details>` : '<p class="tiny">No intervention for this gene in interventions.json.</p>'; }
    // sequence layer, with its labelled failures
    const Q = GX.seq; if (Q) { const ok = (Q.orthologues_resolved || []).find(x => x.gene === sym), bad = (Q.orthologues_not_resolved || []).find(x => x.gene === sym);
      if (ok) h += `<div class="prov"><b>Sequence layer: orthologue present in flying fish</b><span class="small">${esc(ok.flying_fish_protein)} (${esc(ok.protein_length)} aa), ${(+ok.percent_identity_to_zebrafish).toFixed(1)} % identity to zebrafish, reciprocal best hit. Presence only: not place or time of action.</span></div>`;
      if (bad) h += `<div class="seqfail"><b>✕ FAILED reciprocal best hit: not an orthologue call</b> ${esc(bad.flying_fish_protein)} best-hits back to <span class="mono">${esc(bad.reverse_best_zebrafish_symbol)}</span>, not ${esc(sym)}. ${esc(bad.note || bad.why || '')}</div>`;
      if (/lat4a|slc43a2a/.test(sym) && Q.lat4a_convergent_site) h += `<p class="tiny">${esc(Q.lat4a_convergent_site.site)}; the annotated flying-fish protein carries ${esc(Q.lat4a_convergent_site.annotated_flying_fish_protein_carries)}.</p>`;
      if (ok || bad) h += `<p class="tiny">${esc(Q.layer_boundary || '')} ${esc(Q.species_caveat || '')}</p>`; else h += '<p class="tiny">Not among the genes the sequence layer queried.</p>'; }
    // gene-level edits: recorded in the organism document, never propagated
    const mine = ((S.doc && S.doc.edits) || []).filter(e => engLevel(e.target.level) === 'gene' && e.target.id === sym);
    h += `<div class="rule"><b>House rule:</b> a residue is a STATE, not a phenotype. ${esc(NO_PREDICTION)}</div>
      <div class="prow" style="display:block"><b class="small">Gene-level edit</b> <span class="badge unknown">recorded only</span>
      <div class="row"><label class="small">expression × <input type="number" id="ptGExpr" step="any" value="1" aria-label="expression fold"></label><button data-gedit="expression_fold">record</button></div>
      <div class="row"><label class="small"><input type="checkbox" id="ptGKo"> knockout</label><button data-gedit="knockout">record</button></div>
      <div class="row"><label class="small">residue / allele state <input type="text" id="ptGAllele" placeholder="e.g. F326L" aria-label="allele"></label><button data-gedit="allele">record</button></div>
      <input type="text" id="ptGWhy" placeholder="reason (required)" style="width:100%" aria-label="reason">
      ${mine.length ? `<div class="tiny">recorded: ${mine.map(e => esc(e.param + ' = ' + e.value + ' (' + e.author + ': ' + e.reason + ')')).join('; ')}</div>` : ''}</div></div>`;
    return h;
  }
  async function geneEdit(param) {
    const sym = S.gene; const why = ($('ptGWhy').value || '').trim(); if (!why) { const el = $('ptGWhy'); el.placeholder = 'a reason is required'; el.focus(); return; }
    const value = param === 'expression_fold' ? +$('ptGExpr').value : param === 'knockout' ? !!$('ptGKo').checked : String($('ptGAllele').value || '').trim();
    if (param === 'expression_fold' && !isFinite(value)) return; if (param === 'allele' && !value) return;
    labels['gene:' + sym] = sym;
    const before = S.doc.edits.length;
    await addEdit({ target: { level: 'gene', id: sym, label: sym }, param, op: 'set', value, author: 'human', reason: why, ts: new Date().toISOString() });
    if (S.doc.edits.length === before) { const el = $('ptGeno'); if (el) el.insertAdjacentHTML('beforeend', `<div class="fail"><b>✕</b> the organism module refused the gene edit (${esc(sym)} may not be in the engine's gene list)</div>`); }
  }
  async function applyKnob(id) {
    const r = GX.interv && GX.interv.all.find(x => x.id === id); if (!r || !r.knobEffect) return;
    const reason = `calibrated intervention ${r.id}: ${r.gene} ${r.level}, ${r.organism}, ${r.stage.text} (${r.stage.regime}); ${r.knobEffect.label}`;
    for (const side of ['pectoral_fin_L', 'pectoral_fin_R']) if (meshes().some(o => o.name === side))
      await addEdit({ target: { level: 'organ', id: side, label: 'pectoral fin ' + side.slice(-1) }, param: 'area', op: 'scale', value: r.knobEffect.factor, author: 'human', reason, ts: new Date().toISOString() });
  }
  async function mountValidate() {
    const slot = $('ptValSlot'); if (!slot) return;
    let mod = null; try { mod = await import(new URL('validate-panel.js', HERE).href); } catch { }
    if (!mod || typeof mod.mountValidate !== 'function') { slot.innerHTML = '<div class="warnline">validate-panel.js has not landed yet (the validation agent writes it); nothing is scored rather than a stand-in.</div>'; return; }
    try { await mod.mountValidate(slot, { doc: S.doc, geometry_edits: S.geo, species: host.species || null, manifest: MF(), ageDays: S.stages[S.stageIdx] ? S.stages[S.stageIdx].age : null, scenario: S.scenarioKey, params: S.params }); }
    catch (e) { slot.innerHTML = `<div class="fail"><b>✕</b> validate-panel.js: ${esc(e.message || e)}</div>`; }
  }

  function renderAll() { renderEng(); renderSel(); renderGeno(); renderScn(); renderRes(); renderLaws(); renderTc(); renderOpt(); renderLog(); }

  return {
    select, refresh: () => { renderAll(); recompute(); }, get doc() { return S.doc; }, get state() { return S; },
    unmount() {
      S.alive = false; cancelAnimationFrame(raf); if (S.pe && host.root && typeof S.pe.resetEdits === 'function') { try { S.pe.resetEdits(host.root); } catch { } } if (S.worker) S.worker.terminate(); if (unsub) unsub(); clearGlow();
      for (const o of meshes()) { if (saved[o.name]) o.mesh.scale.copy(saved[o.name]); o.mesh.traverse(c => { if (c.isMesh && c.morphTargetInfluences) c.morphTargetInfluences.fill(0); }); }
      if (host.root) host.root.scale.setScalar(1);
    },
  };
}
