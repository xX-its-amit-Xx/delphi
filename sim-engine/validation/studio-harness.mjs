// Independent validation harness for the Design Studio. The tests and bands are copied from
// STUDIO-PREREGISTRATION.md (hash on its last line) and must not be edited to match an outcome.
//
//   node validation/studio-harness.mjs            run once, write studio-results.json + STUDIO-RESULTS.md
//   node validation/studio-harness.mjs --audit    also GET a sample of every scenario's cited sources
//   node validation/studio-harness.mjs --watch    re-run whenever a studio file appears or changes,
//                                                 for up to WATCH_MIN minutes (default 150)
//
// The harness never edits another thread's file. It imports the studio modules read-only, discovers
// their interface, and reports an interface it cannot use as `not-evaluable`, never as a pass.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const HERE = import.meta.dirname;
const SIM = path.resolve(HERE, '..');
const OUT_JSON = path.join(HERE, 'studio-results.json');
const OUT_MD = path.join(HERE, 'STUDIO-RESULTS.md');
const PREREG = path.join(HERE, 'STUDIO-PREREGISTRATION.md');
const ARGS = process.argv.slice(2);
const AUDIT = ARGS.includes('--audit');
const WATCH = ARGS.includes('--watch');
const WATCH_MIN = Number(process.env.WATCH_MIN || 150);

// Fixture override (fixtures live under C:\Temp, never in another thread's folder): STUDIO_SCENARIOS_DIR.
const SCEN_DIR = process.env.STUDIO_SCENARIOS_DIR || path.join(SIM, 'scenarios');
const TEMP_RE = /temp|^t_?c$|^t$|celsius/i, DEPTH_RE = /depth|pressure|press|^p_|^p$/i, ALT_RE = /alt|height|elev/i;
const SCENARIOS = ['temperature', 'current', 'pressure', 'altitude', 'wind', 'predator', 'grip', 'sleep', 'daynight', 'digestion'];
const KINDS = ['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed'];
const ORDER = ['assumed', 'borrowed', 'measured-secondhand', 'calibrated', 'derived', 'measured'];

// ─────────────────────────────────────────────────────────── pre-registration integrity
function preregHash() {
  const txt = fs.readFileSync(PREREG, 'utf8');
  const i = txt.lastIndexOf('\n', txt.length - 2);
  const last = txt.slice(i + 1).trim();
  const recorded = (last.match(/[0-9a-f]{64}/) || [])[0];
  const actual = crypto.createHash('sha256').update(txt.slice(0, i), 'utf8').digest('hex');
  return { recorded, actual, ok: recorded === actual };
}

// ─────────────────────────────────────────────────────────── targets (copied from the prereg §1–4)
const T = {
  ucrit_bls: [12.4, 21.6], ucrit_ms: [0.44, 0.66],
  ctmax: [38.7, 42.2], ctmin: [5.2, 11.6],
  sleep_adult_night: [24.6, 64.7], sleep_adult_day_max: 7.7, sleep_larva_night: [49.7, 66.7],
  cstart_ms: [0.42, 1.68],
  glide_m: [5, 75], glide_speed: [7.5, 25],
  zf_glide_max: 1, depth_lethal_m: [9000, 10000],
  current_ok: 0.20, current_lethal: 1.10,
  altitudes: [0, 500, 1000, 2000, 4000, 8000],
};
// Source ids per test, for echo detection (a model that reads the target's own value back).
const TARGET_IDS = {
  W1: ['10648223', '10.1242/jeb.203.4.813', '21217817', '10.1371/journal.pone.0014483'],
  W2: ['10.1577/T04-197.1', '10.1577/t04-197.1', '29740113', '10.1038/s41598-018-25593-4'],
  W3: ['10.1577/T04-197.1', '10.1577/t04-197.1'],
  W5: ['17941721', 'pbio.0050277', '24312015', 'fncir.2013.00178'],
  W6: ['17941721', 'pbio.0050277'],
  W7: ['24312015', 'fncir.2013.00178'],
  W8: ['22573764', '10.1242/jeb.068957'],
  W9: ['10.3354/ab00494', '10.1242/jeb.046052'],
};

// ─────────────────────────────────────────────────────────── module discovery
const exists = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
function walk(dir, out = []) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === 'cache' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.mjs') || e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
function findFiles() {
  const all = walk(SIM).filter(p => !p.startsWith(HERE));
  const pick = re => all.filter(p => re.test(path.relative(SIM, p).replace(/\\/g, '/')));
  return {
    organism: exists(path.join(SIM, 'lib/organism.mjs')) ? path.join(SIM, 'lib/organism.mjs') : null,
    state: exists(path.join(SIM, 'lib/state.mjs')) ? path.join(SIM, 'lib/state.mjs') : null,
    data: exists(path.join(SIM, 'lib/data-node.mjs')) ? path.join(SIM, 'lib/data-node.mjs') : null,
    spec: exists(path.join(SIM, 'lib/spec.mjs')) ? path.join(SIM, 'lib/spec.mjs') : null,
    parse: exists(path.join(SIM, 'lib/parse-text.mjs')) ? path.join(SIM, 'lib/parse-text.mjs') : null,
    optimizer: pick(/optimi[sz]/i).filter(p => !/test/i.test(p))[0] || null,
    scenarios: Object.fromEntries([...new Set([...SCENARIOS, ...extraScenarios()])].map(s => [s, exists(path.join(SCEN_DIR, `${s}.mjs`)) ? path.join(SCEN_DIR, `${s}.mjs`) : null])),
  };
}
function extraScenarios() { try { return fs.readdirSync(SCEN_DIR).filter(f => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'index.mjs' && f !== 'manifest.mjs').map(f => f.slice(0, -4)); } catch { return []; } }
const imp = async p => import(pathToFileURL(p).href + `?t=${fs.statSync(p).mtimeMs}`);

// ─────────────────────────────────────────────────────────── studio adapter
class Studio {
  constructor(files) { this.files = files; this.mods = {}; this.errors = {}; }
  async init() {
    const f = this.files;
    for (const k of ['organism', 'state', 'data', 'spec', 'parse', 'optimizer']) {
      if (!f[k]) continue;
      try { this.mods[k] = await imp(f[k]); } catch (e) { this.errors[k] = String(e.message || e).slice(0, 300); }
    }
    this.scen = {};
    for (const [s, p] of Object.entries(f.scenarios)) {
      if (!p) continue;
      try { this.scen[s] = { mod: await imp(p), src: fs.readFileSync(p, 'utf8'), path: p }; } catch (e) { this.errors[`scenario:${s}`] = String(e.message || e).slice(0, 300); }
    }
    const reg = path.join(SIM, 'scenarios', 'index.mjs');
    if (exists(reg)) { try { this.registry = await imp(reg); } catch (e) { this.errors.registry = String(e.message).slice(0, 200); } }
    if (this.mods.data?.loadBundle) { try { this.bundle = await this.mods.data.loadBundle(); } catch (e) { this.errors.bundle = String(e.message); } }
    return this;
  }
  organismIds() { return this.bundle ? Object.keys(this.bundle.organisms) : []; }
  fishIds() { return this.organismIds(); } // every organism in the bundle is a fish or fish design (no Aves shipped)
  doc(orgId) {
    const o = this.mods.organism;
    if (!o || !this.bundle) throw new NA('lib/organism.mjs or the data bundle');
    return o.docFor(this.bundle, orgId);
  }
  async state(orgId, conditions = {}) {
    const s = this.mods.state;
    if (!s) throw new NA('lib/state.mjs');
    if (typeof s.resolveState !== 'function') throw new NE(`lib/state.mjs exports no resolveState (exports: ${Object.keys(s).join(', ')})`);
    const doc = this.doc(orgId);
    try { return s.resolveState(doc, null, conditions, this.bundle); }
    catch (e) { throw new NE(`resolveState(${orgId}, ${JSON.stringify(conditions)}) threw: ${String(e.message).slice(0, 200)}`); }
  }
  scenario(name) {
    const s = this.scen[name];
    if (!s) throw new NA(`scenarios/${name}.mjs`);
    return s;
  }
  // The scenario's declared parameters, from whatever it exports.
  paramSpec(name) {
    const m0 = this.scenario(name).mod, m = m0.default || m0;
    const cand = [m.params, m.PARAMS, m.paramSpec, m.parameters, m.defaults, m.DEFAULTS, m.modelCard?.params, m.modelCard?.parameters, m.default?.params, m.default?.defaults];
    for (const c of cand) if (c && typeof c === 'object') return Array.isArray(c) ? Object.fromEntries(c.map(x => [x.key || x.id || x.name, x])) : c;
    return {};
  }
  defaults(name) {
    const spec = this.paramSpec(name), out = {};
    for (const [k, v] of Object.entries(spec)) {
      if (v && typeof v === 'object' && 'default' in v) out[k] = v.default;
      else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v;
    }
    return out;
  }
  paramKey(name, re) {
    const keys = Object.keys(this.paramSpec(name));
    const k = keys.find(x => re.test(x));
    if (!k) throw new NE(`scenarios/${name}.mjs: no parameter matching ${re} (declared: ${keys.join(', ') || 'none exported'})`);
    return k;
  }
  // Environment variables live in two places in this studio: scenario params and resolveState
  // conditions. The harness sets both, so a scenario reading either sees the pre-registered value.
  async run(name, orgId, params = {}, conditions = {}) {
    const s = this.scenario(name);
    const mod = s.mod.default || s.mod;
    if (typeof mod.run !== 'function') throw new NE(`scenarios/${name}.mjs exports no run()`);
    const state = await this.state(orgId, conditions);
    let r;
    if (this.registry?.runScenario) {
      r = this.registry.runScenario({ ...mod, file: `${name}.mjs` }, state, params);
      if (!r.ok) {
        if (r.skipped) throw new NE(`scenarios/${name}.mjs not run for ${orgId}: required STATE null (${(r.missing || []).join(', ')})`);
        const e = new NE(`scenarios/${name}.mjs on ${orgId}: ${r.error}${r.errors ? ': ' + r.errors.slice(0, 4).join('; ') : ''}`);
        if (r.raw) e.raw = r.raw;
        throw e;
      }
    } else r = await mod.run(state, { ...this.defaults(name), ...params });
    if (!r || !Array.isArray(r.metrics)) throw new NE(`scenarios/${name}.mjs run() returned no metrics[] (keys: ${r ? Object.keys(r).join(', ') : r})`);
    return r;
  }
  // Set an environmental variable both as a scenario param (if the scenario declares one) and as a condition.
  async envRun(name, orgId, envKey, value, paramRe) {
    const keys = Object.keys(this.paramSpec(name));
    const k = keys.find(x => paramRe.test(x));
    const params = k ? { [k]: envKey === 'depth_m' ? depthValue(k, value, this.paramSpec(name)[k]) : value } : {};
    return this.run(name, orgId, params, { [envKey]: value });
  }
  modelCard(name) { const m = this.scenario(name).mod; return m.default?.modelCard || m.modelCard || null; }
}
class NA extends Error { constructor(what) { super(`not yet available: ${what}`); this.status = 'not-available'; } }
class NE extends Error { constructor(why) { super(why); this.status = 'not-evaluable'; } }

// The metric, with the run-level provenance attached as its inputs. A calibrated run input counts toward
// `circular` only if the metric's own source formula names it; otherwise it is listed as a note.
const metric = (r, re, unitRe) => {
  const m = r.metrics.find(m => re.test(m.key) && (!unitRe || unitRe.test(m.unit || '')) && m.value !== null && m.value !== undefined);
  if (!m) return m;
  const words = q => String(q.quantity || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const src = String(m.source || '').toLowerCase();
  const prov = (r.provenance || []).filter(q => q && q.kind);
  const inputs = prov.filter(q => q.kind !== 'calibrated' || words(q).some(w => src.includes(w)));
  const unref = prov.filter(q => q.kind === 'calibrated' && !inputs.includes(q)).map(q => q.quantity);
  const siblings = r.metrics.filter(x => x !== m && x.key && String(m.source || '').includes(x.key));
  return { ...m, inputs: [...(m.inputs || []), ...inputs, ...siblings.map(x => ({ quantity: x.key, kind: x.kind, source: x.source }))], ...(unref.length ? { calibrated_unreferenced: unref } : {}) };
};
// Contract 0.3.0: `feasible` = the behaviour is possible (hold station, glide, escape, grip); `survives` = the
// organism lives. Amendment A2 (STUDIO-AMENDMENTS.md) reads `feasible` where the pre-registered wording said survives.
const feasibleOf = r => (typeof r.feasible === 'boolean' ? r.feasible : null);
const survives = r => (typeof r.survives === 'boolean' ? r.survives : (r.survives && typeof r.survives === 'object' && 'value' in r.survives ? !!r.survives.value : null));

// ─────────────────────────────────────────────────────────── scoring (pure; self-tested below)
function kindsOf(m) {
  const ks = [m.kind];
  for (const arr of [m.inputs, m.provenance, m.from]) if (Array.isArray(arr)) for (const q of arr) if (q && q.kind) ks.push(q.kind);
  if (m.weakest_input) ks.push(m.weakest_input);
  return ks.filter(Boolean);
}
function weakestKind(ms) {
  const ks = ms.flatMap(kindsOf);
  if (ks.some(k => !KINDS.includes(k))) return 'INVALID';
  return ORDER.find(k => ks.includes(k)) || 'none';
}
function numericLiterals(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/gm, '');
  return [...code.matchAll(/(?<![\w.])(\d+\.?\d*(?:e-?\d+)?)(?![\w])/gi)].map(x => Number(x[1])).filter(Number.isFinite);
}
function isEcho(testId, value, src) {
  if (!src || value === null || value === undefined) return false;
  const ids = TARGET_IDS[testId] || [];
  if (!ids.some(id => src.includes(id))) return false;
  return numericLiterals(src).some(c => c !== 0 && Math.abs(c - value) / Math.abs(value) <= 0.01);
}
// Amendment A1 (STUDIO-AMENDMENTS.md, written AFTER the first results): a metric whose own source says it
// interpolates or fits the very paper the test scores it against is circular, whatever kind it is labelled.
const TARGET_NAMES = {
  W1: ['Plaut', 'Palstra', '10648223', '21217817', 'jeb.203.4.813', 'pone.0014483'],
  W2: ['Cortemeglia', 'T04-197'], W3: ['Cortemeglia', 'T04-197'],
  W5: ['Yokogawa', 'Sorribes', 'pbio.0050277', 'fncir.2013'], W6: ['Yokogawa', 'pbio.0050277'], W7: ['Sorribes', 'fncir.2013'],
  W8: ['Danos', 'jeb.068957', '22573764'], W9: ['Edgerton', 'ab00494'],
};
const TARGET_VALUES = { W1: ['15.5', '18.0', '56.0', '0.548'], W2: ['39.2', '41.7', '40.97'], W3: ['6.2', '10.6'], W5: ['58.1', '33.37', '33.4'], W6: ['5.1'], W7: ['58.17', '58.2'], W8: ['27,800', '27800'], W9: ['50 m'] };
function fitToTarget(testId, metrics) {
  const names = (TARGET_NAMES[testId] || []).map(n => n.toLowerCase());
  const vals = TARGET_VALUES[testId] || [];
  return metrics.flatMap(m => [m, ...(m.inputs || [])]).some(m => {
    const t = String(m.source || '').toLowerCase();
    if (!names.some(n => t.includes(n))) return false;
    return /interpol|linear in|fit|calibrat|between the (two )?measured|measured means|regress|scaled/.test(t) || vals.some(v => t.includes(v.toLowerCase()));
  });
}
function verdictBand(args) {
  const v = verdictBandPre(args);
  if ((v.status === 'pass' || v.status === 'pass-rests-on-assumed') && fitToTarget(args.testId, args.metrics))
    return { ...v, amended_status: 'circular', why: v.why + '; AMENDMENT A1: the metric is an interpolation/fit of the target paper itself, so the pre-registered pass is not independent evidence' };
  return v;
}
// Verdict for an in-band/out-of-band numeric test (the pre-registered rule, unchanged).
function verdictBandPre({ testId, value, band, metrics, src }) {
  const inBand = value >= band[0] && value <= band[1];
  const wk = weakestKind(metrics);
  if (wk === 'INVALID') return { status: 'fail', weakest: wk, why: 'a metric carries a kind outside the six allowed' };
  if (!inBand) return { status: 'fail', weakest: wk, why: `predicted ${fmt(value)} outside [${band.join(', ')}]` };
  if (wk === 'calibrated') return { status: 'circular', weakest: wk, why: 'in band, but rests on a calibrated quantity' };
  if (isEcho(testId, value, src)) return { status: 'circular', weakest: wk, why: 'in band, but the predicted value equals a constant in the module sourced to the target paper (echo)' };
  if (wk === 'assumed') return { status: 'pass-rests-on-assumed', weakest: wk, why: 'in band; weakest input is assumed' };
  return { status: 'pass', weakest: wk, why: 'in band' };
}
const fmt = v => (typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toPrecision(3)) : String(v));
function monotoneNonIncreasing(bools) { for (let i = 1; i < bools.length; i++) if (bools[i] && !bools[i - 1]) return false; return true; }
function glideBoundOK(d, h, ld, delta = 0) { return d <= (h * ld) / (1 - delta) * (1 + 1e-9); }
// Optimizer result classification: does it CLAIM the spec is met?
function claimsMet(res) {
  if (!res || typeof res !== 'object') return null;
  const s = JSON.stringify(res).toLowerCase();
  for (const k of ['meetsSpec', 'meets_spec', 'feasible', 'satisfied', 'met', 'success', 'ok']) if (typeof res[k] === 'boolean') return res[k];
  if (res.result && typeof res.result === 'object') { const c = claimsMet(res.result); if (c !== null) return c; }
  if (/no design meets|no feasible|infeasible|cannot be met|impossible/.test(s)) return false;
  if (res.design || res.best) return true; // a design returned with no explicit flag is taken as a claim
  return null;
}

// ─────────────────────────────────────────────────────────── self-tests: every check must fail once
function selftest() {
  const out = [];
  const t = (name, got, want) => out.push({ check: name, expected: want, got, ok: got === want });
  const M = (kind, extra = {}) => [{ key: 'x', value: 1, unit: '', kind, source: 's', ...extra }];
  t('band: outside -> fail', verdictBand({ testId: 'W2', value: 50, band: T.ctmax, metrics: M('measured') }).status, 'fail');
  t('band: inside measured -> pass', verdictBand({ testId: 'W2', value: 40, band: T.ctmax, metrics: M('measured') }).status, 'pass');
  t('band: calibrated -> circular', verdictBand({ testId: 'W2', value: 40, band: T.ctmax, metrics: M('calibrated') }).status, 'circular');
  t('band: calibrated input -> circular', verdictBand({ testId: 'W2', value: 40, band: T.ctmax, metrics: M('derived', { inputs: [{ kind: 'calibrated' }] }) }).status, 'circular');
  t('band: echo of sourced constant -> circular', verdictBand({ testId: 'W2', value: 39.2, band: T.ctmax, metrics: M('measured'), src: "const CTMAX = { value: 39.2, doi: '10.1577/T04-197.1' }" }).status, 'circular');
  t('band: same value, unsourced to target -> not echo', verdictBand({ testId: 'W2', value: 39.2, band: T.ctmax, metrics: M('measured'), src: 'const X = 39.2' }).status, 'pass');
  t('band: assumed -> pass-rests-on-assumed', verdictBand({ testId: 'W2', value: 40, band: T.ctmax, metrics: M('assumed') }).status, 'pass-rests-on-assumed');
  t('band: bogus kind -> fail', verdictBand({ testId: 'W2', value: 40, band: T.ctmax, metrics: M('guessed') }).status, 'fail');
  t('altitude: non-monotone -> false', monotoneNonIncreasing([false, true, true]), false);
  t('altitude: monotone -> true', monotoneNonIncreasing([true, true, false]), true);
  t('glide bound: 1000 m from 1 m at L/D 15.7 -> violated', glideBoundOK(1000, 1, 15.7, 0.9), false);
  t('glide bound: 4 m from 1 m at L/D 4.37 -> ok', glideBoundOK(4, 1, 4.37, 0), true);
  t('A1: interpolation of target paper -> amended circular', verdictBand({ testId: 'W2', value: 40.45, band: T.ctmax, metrics: M('derived', { source: 'linear in acclimation temperature between the two measured points (Cortemeglia & Beitinger 2005)' }) }).amended_status, 'circular');
  t('A1: target value read back -> amended circular', verdictBand({ testId: 'W1', value: 15.0, band: T.ucrit_bls, metrics: M('measured-secondhand', { source: 'Plaut 2000 adult Ucrit 15.5 SL/s at 28 degC' }) }).amended_status, 'circular');
  t('A1: independent source -> no amendment', verdictBand({ testId: 'W2', value: 40.45, band: T.ctmax, metrics: M('derived', { source: 'heat-shock protein model, Smith 2020' }) }).amended_status, undefined);
  t('A2: feasible=false read even when survives=null', feasibleOf({ survives: null, feasible: false }), false);
  t('A2: absent feasible -> null (falls back to survives)', feasibleOf({ survives: true }), null);
  t('optimizer: best effort labelled feasible -> claims met', claimsMet({ design: {}, feasible: true }), true);
  t('optimizer: explicit no design -> not claimed', claimsMet({ message: 'No design meets the spec', design: null, feasible: false }), false);
  t('optimizer: unlabelled design -> taken as claim', claimsMet({ design: { id: 'x' } }), true);
  return out;
}

// ─────────────────────────────────────────────────────────── the tests
async function bisect(lo, hi, predSurv, tol) {
  // predSurv(lo) and predSurv(hi) must differ; returns {threshold, runs:[lo-run, hi-run]}
  let a = await predSurv(lo), b = await predSurv(hi);
  if (a.s === b.s) return null;
  while (Math.abs(hi - lo) > tol) {
    const mid = (lo + hi) / 2, m = await predSurv(mid);
    if (m.s === a.s) { lo = mid; a = m; } else { hi = mid; b = m; }
  }
  return { threshold: (lo + hi) / 2, runs: [a.r, b.r] };
}

function testDefs(S) {
  const curKey = () => S.paramKey('current', /current|speed|velocity|flow|u_?m/i);
  const src = n => S.scen[n]?.src;
  return [
    { id: 'W1', name: 'adult zebrafish Ucrit', scen: 'current', async run() {
      const r = await S.run('current', 'zebrafish-adult');
      let m = metric(r, /ucrit|critical.?swim/i, /bl|body/i), band = T.ucrit_bls, unit = 'BL/s';
      if (!m) { m = metric(r, /ucrit|critical.?swim/i); band = T.ucrit_ms; unit = 'm/s'; if (m && /cm/i.test(m.unit)) m = { ...m, value: m.value / 100 }; }
      if (m) return { predicted: m.value, unit, measured: '15.5 SL/s (Plaut 2000); 18.0 BL/s (Palstra 2010)', band, ...verdictBand({ testId: 'W1', value: m.value, band, metrics: [m], src: src('current') }), metric: m.key };
      const k = curKey();
      const b = await bisect(0.05, 3, async v => { const rr = await S.run('current', 'zebrafish-adult', { [k]: v }); return { s: feasibleOf(rr) ?? survives(rr), r: rr }; }, 0.01);
      if (!b) throw new NE('no Ucrit metric and survives does not change over 0.05–3 m/s');
      const ms = b.runs.flatMap(x => x.metrics);
      return { predicted: b.threshold, unit: 'm/s (located by bisection on feasible, amendment A2; survives if feasible absent)', band: T.ucrit_ms, ...verdictBand({ testId: 'W1', value: b.threshold, band: T.ucrit_ms, metrics: ms, src: src('current') }) };
    } },
    ...[['W2', 'CTmax', /ctmax|upper.*(lethal|limit|tol)|t_?max|critical.*max/i, T.ctmax, 25, 60, '39.2 (20 °C accl.) – 41.7 (30 °C) °C; 40.97 °C (Morgan 2018)'],
        ['W3', 'CTmin', /ctmin|lower.*(lethal|limit|tol)|t_?min|critical.*min/i, T.ctmin, 25, -5, '6.2 (20 °C accl.) – 10.6 (30 °C) °C']].map(([id, nm, re, band, from, to, meas]) => ({
      id, name: `zebrafish ${nm}`, scen: 'temperature', async run() {
        const r = await S.run('temperature', 'zebrafish-adult');
        const m = metric(r, re);
        if (m) return { predicted: m.value, unit: m.unit, measured: meas, band, ...verdictBand({ testId: id, value: m.value, band, metrics: [m], src: src('temperature') }), metric: m.key };
        const b = await bisect(from, to, async v => { const rr = await S.envRun('temperature', 'zebrafish-adult', 'temperature_C', v, TEMP_RE); return { s: survives(rr), r: rr }; }, 0.25);
        if (!b) throw new NE(`no ${nm} metric, and survives does not change between ${from} and ${to} °C`);
        return { predicted: b.threshold, unit: '°C (bisection on survives)', measured: meas, band, ...verdictBand({ testId: id, value: b.threshold, band, metrics: b.runs.flatMap(x => x.metrics), src: src('temperature') }) };
      } })),
    { id: 'W4', name: 'thermal survival sign (25, 28 survive; 45, 2 do not)', scen: 'temperature', async run() {
      const got = {};
      for (const v of [25, 28, 45, 2]) got[v] = survives(await S.envRun('temperature', 'zebrafish-adult', 'temperature_C', v, TEMP_RE));
      const ok = got[25] === true && got[28] === true && got[45] === false && got[2] === false;
      return { predicted: JSON.stringify(got), measured: 'CTmax 39–42 °C, CTmin 6–11 °C', status: ok ? 'pass' : 'fail', why: ok ? 'signs correct' : 'wrong survival sign at one or more temperatures', weakest: 'n/a (sign test)' };
    } },
    { id: 'W5', name: 'adult night sleep fraction', scen: 'sleep', async run() { return sleepTest(S, 'zebrafish-adult', /night|dark/i, T.sleep_adult_night, 'W5', '58.1 % (Yokogawa 2007); 33.37 % (Sorribes 2013, 4–6 mo)'); } },
    { id: 'W6', name: 'adult day sleep fraction ≤ 7.7 % and below night', scen: 'sleep', async run() {
      const d = await sleepTest(S, 'zebrafish-adult', /day|light/i, [0, T.sleep_adult_day_max], 'W6', '5.1 ± 1.3 % (Yokogawa 2007)');
      const n = await sleepTest(S, 'zebrafish-adult', /night|dark/i, [0, 100], 'W6', '');
      if (d.status.startsWith('pass') && !(d.predicted < n.predicted)) return { ...d, status: 'fail', why: 'day sleep not below night sleep' };
      return d;
    } },
    { id: 'W7', name: 'larval night sleep > adult, larval in [49.7, 66.7] %', scen: 'sleep', async run() {
      const l = await sleepTest(S, 'zebrafish-larva', /night|dark/i, T.sleep_larva_night, 'W7', '58.17 % larva vs 33.37 % adult (Sorribes 2013)');
      const a = await sleepTest(S, 'zebrafish-adult', /night|dark/i, [0, 100], 'W7', '');
      if (l.status.startsWith('pass') && !(l.predicted > a.predicted)) return { ...l, status: 'fail', why: `larval ${fmt(l.predicted)} not above adult ${fmt(a.predicted)}` };
      return { ...l, predicted: `${fmt(l.predicted)} (adult ${fmt(a.predicted)})` };
    } },
    { id: 'W8', name: 'adult C-start peak speed', scen: 'predator', async run() {
      const r = await S.run('predator', 'zebrafish-adult');
      let m = metric(r, /c.?start|escape|fast.?start|burst|peak.*(speed|vel)/i, /m\/s|m s|cm|bl/i);
      if (!m) throw new NE(`predator scenario reports no escape/C-start speed (metrics: ${r.metrics.map(x => x.key).join(', ')})`);
      let v = m.value; if (/cm/i.test(m.unit)) v /= 100; if (/bl|body/i.test(m.unit)) v *= 0.033;
      return { predicted: v, unit: 'm/s', measured: '≈0.84 m/s derived from Re 27,800, TL 33 mm (Danos & Lauder 2012)', band: T.cstart_ms, ...verdictBand({ testId: 'W8', value: v, band: T.cstart_ms, metrics: [m], src: src('predator') }), metric: m.key };
    } },
    { id: 'W9', name: 'flying fish glide distance and speed', scen: 'wind', async run() {
      const r = await findGlide(S, 'flying-fish');
      if (!r) throw new NE('no scenario reports a glide distance for flying-fish');
      const d = r.dist, sp = r.speed;
      const v1 = verdictBand({ testId: 'W9', value: d.value, band: T.glide_m, metrics: [d], src: r.src });
      if (!sp) return { predicted: `${fmt(d.value)} m (no speed metric)`, measured: 'up to 50 m at 15–20 m/s (secondhand)', band: T.glide_m, ...v1, why: v1.why + '; glide speed not reported, half the test unevaluable' };
      const v2 = verdictBand({ testId: 'W9', value: sp.value, band: T.glide_speed, metrics: [sp], src: r.src });
      const order = ['fail', 'circular', 'pass-rests-on-assumed', 'pass'];
      const worst = order.find(s => s === v1.status || s === v2.status);
      return { predicted: `${fmt(d.value)} m at ${fmt(sp.value)} m/s (from ${r.scen})`, measured: 'up to 50 m at 15–20 m/s (secondhand)', band: `${T.glide_m} m; ${T.glide_speed} m/s`, status: worst, weakest: weakestKind([d, sp]), why: `distance: ${v1.why}; speed: ${v2.why}` };
    } },
    { id: 'W10', name: 'gut passage time', scen: 'digestion', async run() {
      const r = await S.run('digestion', 'zebrafish-adult');
      const m = metric(r, /passage|transit|gut|evacuat/i);
      return { predicted: m ? `${fmt(m.value)} ${m.unit} (${m.kind})` : 'no passage metric', measured: 'none fetched', status: 'no-target', why: 'no fetched wild-type gut passage time; the studio value is UNVALIDATED', weakest: m ? weakestKind([m]) : 'n/a' };
    } },
    { id: 'W11', name: 'sustained current sign (pre-registered: 0.20 m/s survive, 1.10 m/s not; A2 reads feasible)', scen: 'current', async run() {
      const k = curKey();
      const ra = await S.run('current', 'zebrafish-adult', { [k]: T.current_ok }), rb = await S.run('current', 'zebrafish-adult', { [k]: T.current_lethal });
      const a = survives(ra), b = survives(rb), fa = feasibleOf(ra), fb = feasibleOf(rb);
      const pre = a === true && b === false ? 'pass' : 'fail';
      const amd = fa === null && fb === null ? pre : (fa === true && fb === false ? 'pass' : 'fail');
      return { predicted: `survives: 0.20 m/s → ${a}, 1.10 m/s → ${b}; feasible: 0.20 → ${fa}, 1.10 → ${fb} (param ${k})`, measured: 'Uopt 0.396, Ucrit 0.548 m/s', status: pre,
        ...(amd !== pre ? { amended_status: amd, amendment: 'A2' } : {}),
        why: `pre-registered reading (survives): ${pre === 'pass' ? 'signs correct' : `not met, survives is ${a}/${b}`}; A2 reading (feasible = can hold station): ${amd === 'pass' ? 'signs correct' : 'wrong sign'}`, weakest: 'n/a (sign test)' };
    } },
    // ── negative controls
    { id: 'N1', name: 'real zebrafish must not glide (< 1 m)', scen: 'wind', async run() {
      const r = await findGlide(S, 'zebrafish-adult');
      if (!r) return { predicted: 'no glide metric for zebrafish in any scenario', status: 'pass', why: 'glide not reported for a fish without wing fins', weakest: 'n/a' };
      const ok = !(r.dist.value >= T.zf_glide_max) || r.survives === false;
      const okA = ok || r.feasible === false;
      return { predicted: `${fmt(r.dist.value)} m (from ${r.scen}, metric ${r.dist.key}, survives=${r.survives}, feasible=${r.feasible})`, measured: 'ballistic leap ≈ 0.07 m', status: ok ? 'pass' : 'fail', ...(okA !== ok ? { amended_status: 'pass', amendment: 'A2' } : {}), why: ok ? 'below 1 m or flagged not surviving' : (r.dist.value >= 30 ? 'zebrafish glides ≥ 30 m' : 'zebrafish glides 1–30 m: not as absurd, still unsupported'), weakest: weakestKind([r.dist]) };
    } },
    { id: 'N2', name: 'no fish survives at 9,000 or 10,000 m', scen: 'pressure', async run() {
      const viol = [], seen = [];
      for (const org of S.fishIds()) for (const depth of T.depth_lethal_m) {
        let s; try { s = survives(await S.envRun('pressure', org, 'depth_m', depth, DEPTH_RE)); } catch (e) { if (e.status === 'not-available') throw e; s = `error: ${e.message.slice(0, 120)}`; }
        seen.push(`${org}@${depth}m:${s}`);
        if (s !== false) viol.push(`${org} at ${depth} m survives=${s}`);
      }
      return { predicted: viol.length ? viol.join('; ') : `all ${seen.length} runs survive=false`, measured: 'no fish below 8,400 m (Yancey 2014)', status: viol.length ? 'fail' : 'pass', why: viol.length ? `${viol.length} organism/depth runs did not report death` : 'all fish die', weakest: 'n/a (negative control)' };
    } },
    { id: 'N3', name: 'no grip force without a gripping organ (zebrafish)', scen: 'grip', async run() {
      const r = await S.run('grip', 'zebrafish-adult');
      const m = metric(r, /grip|force|adhes|cling/i);
      const ok = !m || !(m.value > 0) || /not.?applic|no.?grip|n\/a/i.test(JSON.stringify(r.validity || ''));
      return { predicted: m ? `${m.key} = ${fmt(m.value)} ${m.unit} (${m.kind}); validity ${JSON.stringify(r.validity)?.slice(0, 160)}` : 'no grip metric', measured: 'zebrafish has no gripping organ', status: ok ? 'pass' : 'fail', why: ok ? 'no positive grip force' : 'reports a positive grip force for an organism with no gripping organ', weakest: m ? weakestKind([m]) : 'n/a' };
    } },
    { id: 'N4', name: 'flyable heights downward closed (Lean Altitude.feasible_downward_closed)', scen: 'altitude', async run() {
      const viol = [], rows = [];
      for (const org of S.organismIds()) {
        const sv = [];
        for (const h of T.altitudes) { try { { const ra = await S.envRun('altitude', org, 'altitude_m', h, ALT_RE); sv.push(feasibleOf(ra) ?? survives(ra)); } } catch (e) { if (e.status === 'not-available') throw e; sv.push(null); } }
        if (sv.every(x => x === null)) { rows.push(`${org}: not runnable`); continue; }
        rows.push(`${org}:${sv.map(x => (x ? 1 : 0)).join('')}`);
        if (!monotoneNonIncreasing(sv)) viol.push(`${org} [${sv}]`);
      }
      if (rows.every(r => r.endsWith('not runnable'))) throw new NE(`altitude scenario not runnable for any organism: ${rows.join('; ')}`);
      return { predicted: rows.join('; '), measured: 'proved: feasible at h ⇒ feasible below h', status: viol.length ? 'fail' : 'pass', why: viol.length ? `non-monotone: ${viol.join('; ')}` : 'monotone for every organism', weakest: 'n/a (law control)' };
    } },
    { id: 'N5', name: 'glide range ≤ h·L/D/(1−δ) (Lean glide_range_le)', scen: 'wind', async run() {
      // Pre-registered reading: EVERY reported glide distance (here the total, the largest). Amendment A3 reading:
      // only the distance the module declares covered by the theorem (glide_range_lean_bound_m), plus a check that
      // the module explicitly labels the total as NOT covered.
      const out = [], viol = [], leanOnly = [], leanViol = [], unlabelled = [];
      for (const org of S.organismIds()) {
        const g = await findGlide(S, org); if (!g) continue;
        if (g.lean) {
          const hk0 = Object.keys(S.paramSpec(g.scen)).find(k => /launch.?height|height/i.test(k));
          const ld0 = metric(g.r, /(^|_)l_?d(_|$)|lift.?to.?drag|glide.?ratio/i), h0 = hk0 ? S.defaults(g.scen)[hk0] : null;
          if (h0 != null && ld0) {
            const okL = glideBoundOK(g.lean.value, h0, ld0.value, 0);
            leanOnly.push(`${org}: ${fmt(g.lean.value)} ≤ ${fmt(h0 * ld0.value)}? ${okL}`);
            if (!okL) leanViol.push(org);
          }
          if (g.dist !== g.lean && g.dist.value > (g.lean.value ?? 0) && !/not covered/i.test(String(g.dist.source) + String(g.dist.label))) unlabelled.push(org);
        }
        const h = metric(g.r, /launch.?height|launch.?h|height/i), ld = metric(g.r, /(^|_)l_?d(_|$)|lift.?to.?drag|glide.?ratio/i), de = metric(g.r, /ground.?effect|(^|_)delta/i);
        const hk = Object.keys(S.paramSpec(g.scen)).find(k => /launch.?height|height/i.test(k));
        const hv = h ? h.value : hk ? S.defaults(g.scen)[hk] : null;
        const fm = String(g.dist.source || '').match(/drag factor ([0-9.]+)/i);
        const dv = de ? de.value : fm ? 1 - Number(fm[1]) : 0;
        if (hv == null || !ld) { out.push(`${org}: d=${fmt(g.dist.value)} but no h or L/D reported`); continue; }
        const ok = glideBoundOK(g.dist.value, hv, ld.value, dv);
        out.push(`${org}: d=${fmt(g.dist.value)} ≤ h·L/D/(1−δ) = ${fmt(hv)}·${fmt(ld.value)}/(1−${dv.toFixed(2)}) = ${fmt(hv * ld.value / (1 - dv))}? ${ok}`);
        if (!ok) viol.push(org);
      }
      if (!out.length) throw new NE('no organism has a glide distance in any scenario');
      const allUncheckable = out.every(s => s.includes('no h or L/D'));
      const a3 = leanOnly.length ? { amended_status: leanViol.length || unlabelled.length ? 'fail' : 'pass', amendment: 'A3',
        amended_detail: `Lean-covered metric only: ${leanOnly.join('; ')}${unlabelled.length ? `; total exceeds the bound WITHOUT a "not covered" label for ${unlabelled.join(', ')}` : '; every total above the bound is labelled NOT covered by the theorem'}` } : {};
      return { ...a3, predicted: (a3.amended_detail ? `A3: ${a3.amended_detail} || pre-registered (every reported distance): ` : '') + out.join('; '), status: viol.length ? 'fail' : (allUncheckable ? 'not-evaluable' : 'pass'), why: viol.length ? `bound violated for ${viol.join(', ')}` : (allUncheckable ? 'glide reported without launch height or L/D, so the proved bound cannot be checked' : 'bound holds'), weakest: 'n/a (law control)' };
    } },
    // ── optimizer and parser controls
    { id: 'O1', name: 'already-maximal objective is not improved', scen: 'optimizer', async run() { return optimizerTest(S, 'O1'); } },
    { id: 'O2', name: 'impossible glide spec → no design meets the spec', scen: 'optimizer', async run() { return optimizerTest(S, 'O2'); } },
    { id: 'O3', name: 'impossible depth spec → no design meets the spec', scen: 'optimizer', async run() { return optimizerTest(S, 'O3'); } },
    { id: 'P1', name: 'parser keeps impossible targets (1000 m glide, 10,000 m depth)', scen: 'parse', async run() {
      const P = S.mods.parse; if (!P) throw new NA('lib/parse-text.mjs');
      const fn = P.parseText || P.parse || P.default; if (typeof fn !== 'function') throw new NE(`parse-text exports: ${Object.keys(P).join(', ')}`);
      const a = await fn('a zebrafish that glides 1000 m', S.bundle), b = await fn('a fish at 10,000 m depth', S.bundle);
      const sa = JSON.stringify(a), sb = JSON.stringify(b);
      const okA = /1000|1e\+?3/.test(sa), okB = /10000|1e\+?4|100\.?\d*\s*,?\s*"?(unit|mpa)|"MPa"/i.test(sb) || /10000/.test(sb);
      return { predicted: `glide → ${sa.slice(0, 200)} | depth → ${sb.slice(0, 200)}`, status: okA && okB ? 'pass' : 'fail', why: `${okA ? '' : 'glide target 1000 m lost; '}${okB ? '' : 'depth target 10,000 m lost'}` || 'both targets kept', weakest: 'n/a' };
    } },
    // ── observations: NOT pre-registered, added after results; reported, never counted in the tally
    { id: 'X1', observation: true, name: 'zebrafish LARVA glide (N1 covers only the adult)', scen: 'glide', async run() {
      const r = await findGlide(S, 'zebrafish-larva');
      if (!r) return { predicted: 'no glide metric', status: 'observation', why: 'none' };
      return { predicted: `${fmt(r.dist.value)} m, survives=${r.survives}, inRange=${r.r.validity?.inRange} (from ${r.scen})`, status: 'observation', why: r.survives && r.dist.value >= 1 ? 'a 0.5 mg larva is reported to glide ≥ 1 m and survive; only validity.inRange=false warns' : 'ok' };
    } },
    { id: 'X2', observation: true, name: 'altitude: survives vs limiting consistency (zebrafish adult, defaults)', scen: 'altitude', async run() {
      const r = await S.run('altitude', 'zebrafish-adult');
      const clash = (r.feasible === true || (r.feasible === undefined && r.survives === true)) && /below v_min|cannot/i.test(String(r.feasibility_note || r.limiting || ''));
      return { predicted: `survives=${r.survives}; feasible=${r.feasible}; feasibility_note="${String(r.feasibility_note ?? r.limiting).slice(0, 120)}"`, status: 'observation', why: clash ? 'survives=true while limiting says flight is impossible: survives means different things in different scenarios' : 'consistent' };
    } },
    // ── contract
    ...[...new Set([...SCENARIOS, ...extraScenarios()])].map(s => ({ id: `N7-${s}`, name: `contract + determinism: ${s}`, scen: s, async run() {
      const org = ['wind', 'altitude', 'glide'].includes(s) ? 'flying-fish' : 'zebrafish-adult';
      const a = await S.run(s, org), b = await S.run(s, org);
      const bad = a.metrics.filter(m => !KINDS.includes(m.kind) || !m.source || typeof m.source !== 'string' || !m.source.trim()).map(m => `${m.key}(kind=${m.kind},source=${JSON.stringify(m.source)?.slice(0, 30)})`);
      const mc = S.modelCard(s), va = mc?.validatedAgainst;
      const det = JSON.stringify(a.metrics.map(m => m.value)) === JSON.stringify(b.metrics.map(m => m.value));
      const issues = [...(bad.length ? [`metrics without valid kind/source: ${bad.join(', ')}`] : []), ...(va === undefined ? ['no modelCard.validatedAgainst'] : []), ...(det ? [] : ['non-deterministic']), ];
      const notes = [...(typeof survives(a) === 'boolean' ? [] : [`survives=${a.survives}`]), ...(a.validity?.inRange === false ? ['validity.inRange=false at defaults'] : [])];
      const counts = a.metrics.reduce((o, m) => ((o[m.kind] = (o[m.kind] || 0) + 1), o), {});
      return { predicted: `${a.metrics.length} metrics ${JSON.stringify(counts)}; validatedAgainst: ${JSON.stringify(va)?.slice(0, 200)}${notes.length ? '; note: ' + notes.join(', ') : ''}`, status: issues.length ? 'fail' : 'pass', why: issues.join('; ') || 'contract holds', weakest: weakestKind(a.metrics) };
    } })),
  ];
}

function depthValue(key, depthM, spec) {
  const unit = `${key} ${spec && typeof spec === 'object' ? (spec.unit || '') : ''}`.toLowerCase();
  const P = 101325 + 1025 * 9.81 * depthM; // Pa, seawater
  if (/depth|_m\b|metre|meter/.test(unit) && !/pa|bar|atm/.test(unit)) return depthM;
  if (/mpa/.test(unit)) return P / 1e6;
  if (/kpa/.test(unit)) return P / 1e3;
  if (/bar/.test(unit)) return P / 1e5;
  if (/atm/.test(unit)) return P / 101325;
  if (/pa/.test(unit)) return P;
  return depthM;
}

async function sleepTest(S, org, phaseRe, band, id, meas) {
  let r, scen;
  for (const s of ['sleep', 'daynight']) { try { r = await S.run(s, org); scen = s; if (r.metrics.some(m => /sleep/i.test(m.key))) break; } catch (e) { if (s === 'daynight') throw e; } }
  const ms = r.metrics.filter(m => /sleep/i.test(m.key) && phaseRe.test(m.key));
  const m = ms[0];
  if (!m) throw new NE(`${scen}: no ${phaseRe} sleep metric for ${org} (metrics: ${r.metrics.map(x => x.key).join(', ')})`);
  let v = m.value; if (!/%|percent/i.test(m.unit || '') && v <= 1) v *= 100;
  return { predicted: v, unit: '%', measured: meas, band, ...verdictBand({ testId: id, value: v, band, metrics: [m], src: S.scen[scen]?.src }), metric: `${scen}:${m.key}` };
}

async function findGlide(S, org) {
  const order = [...new Set(['glide', 'wind', 'altitude', 'predator', 'current', ...Object.keys(S.scen)])];
  for (const s of order) {
    if (!S.scen[s]) continue;
    let r; try { r = await S.run(s, org); } catch { continue; }
    // The total distance is what a field glide measures; the Lean-covered part is kept separately for N5.
    const dist = metric(r, /glide_range_total|still_air_range/i) || metric(r, /glide.*(dist|range)|airborne.*dist|flight.*dist/i);
    if (dist) return { scen: s, r, dist, lean: metric(r, /lean_bound/i), speed: metric(r, /glide.*speed|air.?speed|flight.*speed/i), survives: survives(r), feasible: feasibleOf(r), src: S.scen[s].src };
  }
  if (!order.some(s => S.scen[s])) throw new NA('scenarios/wind.mjs (or another glide-reporting scenario)');
  return null;
}

// The studio optimizer is tools/studio.mjs optimize({organism, objective{scenario,metric,params,conditions,
// direction}, variables[{target,param,min,max}], hard_constraints[], budget, seed}). A pre-registered spec
// is expressed as hard constraints, which is how that tool states a requirement.
async function optimizerTest(S, which) {
  const studioPath = path.join(SIM, 'tools', 'studio.mjs');
  if (!exists(studioPath)) throw new NA('tools/studio.mjs optimize');
  const St = await imp(studioPath);
  if (typeof St.optimize !== 'function') throw new NE(`tools/studio.mjs exports no optimize (exports: ${Object.keys(St).join(', ')})`);
  const org = which === 'O2' ? 'flying-fish' : 'zebrafish-adult';
  const doc = S.doc(org);
  const R = S.mods.organism.resolveParameters(S.bundle, doc);
  const numeric = Object.entries(R.params).filter(([k, v]) => typeof v.value === 'number' && v.value > 0 && !/_count$/.test(k));
  // Fin-shape variables only: editing length or depth without mass breaks the cube law (Lean C7b), and a
  // "no design" caused by that would be right for the wrong reason.
  const pick = numeric.filter(([k]) => /^pectoral_(area|span)/i.test(k)).slice(0, 2);
  const vars = (pick.length ? pick : numeric.slice(0, 2)).map(([k, v]) => ({ target: { level: 'body', id: 'body' }, param: k, min: v.value * 0.5, max: v.value * 1.5 }));
  const declared = sc => ((S.scen[sc]?.mod.default || S.scen[sc]?.mod)?.metrics || []).map(m => m.key);
  const num = (sc, re) => declared(sc).find(k => re.test(k)) || declared(sc)[0];
  let args;
  if (which === 'O2') {
    const sc = ['glide', 'wind', 'altitude', 'predator', ...Object.keys(S.scen)].find(x => S.scen[x] && declared(x).some(k => /glide.*(dist|range)/i.test(k)));
    if (!sc) { if (!S.scen.wind) throw new NA('scenarios/wind.mjs (glide metric)'); throw new NE('no scenario declares a glide distance metric'); }
    const gm = num(sc, /glide.*(dist|range)/i);
    args = { organism: doc, objective: { scenario: sc, metric: gm, direction: 'maximize' }, variables: vars,
      hard_constraints: [{ scenario: sc, metric: gm, op: '>=', value: 1000 }], budget: 60, seed: 1 };
    const hm = declared(sc).find(k => /launch.?height|height/i.test(k));
    if (!hm) args.note = 'launch height not a declared metric/param; the 1 m launch height of the pre-registered spec could not be imposed';
    else if (Object.keys(S.paramSpec(sc)).some(k => /height/i.test(k))) args.objective.params = { [Object.keys(S.paramSpec(sc)).find(k => /height/i.test(k))]: 1 };
  } else if (which === 'O3') {
    if (!S.scen.pressure) throw new NA('scenarios/pressure.mjs');
    const pk = Object.keys(S.paramSpec('pressure')).find(k => DEPTH_RE.test(k));
    const params = pk ? { [pk]: depthValue(pk, 10000, S.paramSpec('pressure')[pk]) } : {};
    args = { organism: doc, objective: { scenario: 'pressure', metric: num('pressure', /./), params, conditions: { depth_m: 10000 } }, variables: vars,
      hard_constraints: [{ scenario: 'pressure', survives: true, params }], budget: 60, seed: 1 };
  } else {
    // O1, second pre-registered form: re-running on the optimizer's own output must not find >1 % more.
    // Also recorded: the start design's own value, which the optimizer is never asked to beat.
    if (!S.scen.temperature) throw new NA('scenarios/temperature.mjs');
    const m = num('temperature', /ctmax|margin|scope|upper/i);
    args = { organism: doc, objective: { scenario: 'temperature', metric: m, direction: 'maximize' }, variables: vars, budget: 60, seed: 1 };
  }
  let res;
  try { res = await St.optimize(args); } catch (e) { throw new NE(`optimize threw: ${String(e.message).slice(0, 250)}`); }
  const r = res.result || res;
  if (which === 'O1') {
    if (!r.best) return { predicted: `status ${r.status}`, status: 'not-evaluable', why: 'optimizer found no feasible design for an unconstrained objective', weakest: 'n/a' };
    const start = await S.run('temperature', org);
    const sv = start.metrics.find(q => q.key === args.objective.metric)?.value;
    const res2 = await St.optimize({ ...args, organism: r.best.doc, seed: 2 });
    const r2 = res2.result || res2;
    const gain = r2.best ? (r2.best.metric - r.best.metric) / Math.abs(r.best.metric || 1) : 0;
    const worse = typeof sv === 'number' && r.best.metric < sv - 1e-9;
    const ok = gain <= 0.01 && !worse;
    const nEdits = (r.best.doc?.edits || []).length;
    return { predicted: `${args.objective.metric}: start ${fmt(sv)}, run 1 best ${fmt(r.best.metric)}, re-run on own output best ${r2.best ? fmt(r2.best.metric) : 'none'} (gain ${(gain * 100).toFixed(2)} %); returned design carries ${nEdits} edits (${JSON.stringify(r.best.values)}) although the objective is flat in them`,
      status: ok ? 'pass' : 'fail', why: [gain > 0.01 ? 'second run "improved" its own optimum by >1 %' : '', worse ? 'returned design is WORSE than the start design, labelled status ok' : ''].filter(Boolean).join('; ') || 'idempotent and not worse than start',
      weakest: 'n/a', note: 'pre-registered first form (maximise a boolean survives) is not expressible: optimize() accepts only a numeric metric objective' };
  }
  const meets = r.status !== 'no design meets the spec' && !!r.best;
  let reverify = '';
  if (meets) { // O4: claims must re-verify
    try {
      const rr = await S.run(args.objective.scenario, org, args.objective.params || {}, args.objective.conditions || {});
      reverify = ` | O4 re-run of start (not of the returned doc) gives ${JSON.stringify(rr.metrics.map(q => [q.key, q.value])).slice(0, 120)}`;
    } catch {}
  }
  const reasons = (r.rejected || []).reduce((a, x) => ((a[x.reason] = (a[x.reason] || 0) + 1), a), {});
  if (!meets && !reasons['hard constraint']) return { predicted: `status "${r.status}", rejections ${JSON.stringify(reasons)}`, status: 'not-evaluable', why: 'no design, but no candidate was rejected by the impossible constraint itself (rejected for other reasons), so the control did not exercise the spec', weakest: 'n/a' };
  return { predicted: `status "${r.status}", evaluations ${r.evaluations}, rejections ${JSON.stringify(reasons)}${r.best ? `, best ${fmt(r.best.metric)}` : ''}${args.note ? ' (' + args.note + ')' : ''}${reverify}`,
    status: meets ? 'fail' : 'pass', why: meets ? 'returned a design with status ok for a spec that is impossible' : 'explicitly reports no design meets the spec', weakest: 'n/a' };
}

// ─────────────────────────────────────────────────────────── audit (part 3)
const CONVERSIONS = new Set([0, 1, 2, 3, 4, 10, 100, 1000, 9.81, 9.80665, 60, 3600, 24, 273.15, 101325, 0.5, 1e3, 1e6, 1e-3, 1e-6, 1e-9, 1e9]);
function auditConstants(src) {
  // Numeric literals in CODE only (strings and comments stripped), minus unit conversions and years.
  // A constant is 'sourced' if a URL/DOI/PMID/PMC id sits within 3 lines (or in the object it belongs to),
  // 'sourced-by-name' if only an author-year / repository-file reference does, else 'unsourced'.
  const lines = src.split(/\r?\n/), out = [];
  const srcRe = /(https?:\/\/[^\s'"`,)]+|doi[:\s]*10\.\d{4,}\/[^\s'"`,)]+|\b10\.\d{4,}\/[^\s'"`,)]+|pmid[:\s]*\d{6,9}|PMC\d{5,})/i;
  const nameRe = /([A-Z][a-z]+(?: et al\.?| & [A-Z][a-z]+)?,? ?(19|20)\d\d|[a-z]+(19|20)\d\d\b|\b[\w-]+\/[\w./-]+\.(json|js|mjs|py|csv|md)\b)/;
  const strip = t => t.replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/, '');
  let inBlock = false;
  lines.forEach((ln, i) => {
    if (inBlock) { if (ln.includes('*/')) inBlock = false; return; }
    if (/^\s*\/\*/.test(ln) && !ln.includes('*/')) { inBlock = true; return; }
    if (/^\s*(\*|\/\/|import\b)/.test(ln)) return;
    const code = strip(ln);
    const nums = [...code.matchAll(/(?<![\w.$#])(\d+\.\d+|\d{2,}|\d(?:e-?\d+))(?![\w%])/gi)].map(x => Number(x[1]))
      .filter(n => Number.isFinite(n) && !CONVERSIONS.has(n) && !(Number.isInteger(n) && n >= 1900 && n <= 2035));
    if (!nums.length) return;
    const ctx = lines.slice(Math.max(0, i - 3), i + 4).join(' ');
    const m = ctx.match(srcRe), nm = ctx.match(nameRe);
    out.push({ line: i + 1, constants: nums, text: ln.trim().slice(0, 140), source: m ? m[1].replace(/[),.;'"`]+$/, '') : null, named: !m && nm ? nm[0] : null });
  });
  return out;
}
async function getText(url) {
  const ctl = AbortSignal.timeout(30000);
  const r = await fetch(url, { signal: ctl, headers: { 'user-agent': 'delphisci-validation/1.0 (research; mailto omitted)' }, redirect: 'follow' });
  const t = await r.text();
  return { status: r.status, text: t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
}
async function fetchSource(ref) {
  const doi = (ref.match(/10\.\d{4,}\/[^\s'"`,)]+/) || [])[0];
  const pmid = (ref.match(/pmid[:\s]*(\d{6,9})/i) || [])[1] || (ref.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/) || [])[1];
  const pmc = (ref.match(/PMC\d{5,}/) || [])[0];
  if (doi || pmid || pmc) {
    const q = pmc ? `PMCID:${pmc}` : doi ? `DOI:"${doi.replace(/[.]+$/, '')}"` : `EXT_ID:${pmid} AND SRC:MED`;
    const s = await getText(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=${encodeURIComponent(q)}`);
    let j; try { j = JSON.parse(s.text); } catch { j = null; }
    const rec = j?.resultList?.result?.[0];
    let text = rec ? `${rec.title} ${rec.abstractText || ''}` : '';
    if (rec?.pmcid) { try { const f = await getText(`https://www.ebi.ac.uk/europepmc/webservices/rest/${rec.pmcid}/fullTextXML`); if (f.status === 200) text += ' ' + f.text; } catch {} }
    if (!rec && doi) { try { const c = await getText(`https://api.crossref.org/works/${encodeURIComponent(doi)}`); const m = JSON.parse(c.text).message; text = `${m.title} ${m.abstract || ''}`; } catch {} }
    return { via: rec ? `Europe PMC (${rec.pmcid ? 'full text' : 'abstract'})` : 'Crossref', text, found: !!text.trim() };
  }
  const u = (ref.match(/https?:\/\/\S+/) || [])[0];
  if (!u) return { via: 'none', text: '', found: false };
  const g = await getText(u);
  return { via: `GET ${g.status}`, text: g.text, found: g.status === 200 };
}
// Hand-picked claims from the scenario modules, each checked by a real GET of the cited paper for the
// quoted phrase. Added after the modules landed (an audit, not a pre-registered test).
const SPOT_CHECKS = [
  { module: 'current', claim: 'Plaut 2000 Ucrit 15.5 SL/s, compiled in Widrick 2018', q: 'DOI:"10.1371/journal.pone.0199712"', phrases: ['15.5'] },
  { module: 'current', claim: 'Umax exceeds Ucrit by ~15 % (Widrick 2018)', q: 'DOI:"10.1371/journal.pone.0199712"', phrases: ['15%'] },
  { module: 'predator', claim: 'theta_thresh 10.3-15.8 deg (McKee & McHenry 2020)', q: 'PMCID:PMC7750966', phrases: ['10.3°', '15.8°'] },
  { module: 'predator', claim: 'visual latency 740-780 ms (McKee & McHenry 2020)', q: 'PMCID:PMC7750966', phrases: ['740 ms', '780 ms'] },
  { module: 'predator', claim: 'adult startle "modal latency to startle being 8 ms" (Burgess & Granato 2007, a paper titled "Sensorimotor gating in LARVAL zebrafish")', q: 'DOI:"10.1523/JNEUROSCI.0615-07.2007"', phrases: ['modal latency', '8 ms'] },
  { module: 'predator', claim: 'pike C-start below 11 BL/s, archerfish 24 BL/s (Schuster 2023)', q: 'DOI:"10.1007/s00359-023-01658-2"', phrases: ['11 body lengths', '24 BL'] },
  { module: 'sleep', claim: 'larval sleep 19.6 % day, 83.9 % night (Choudhary 2026)', q: 'DOI:"10.1038/s41467-026-72222-0"', phrases: ['19.6', '83.9'] },
  { module: 'temperature', claim: 'Q10 SMR 1.39, MMR 1.15 (Ripley 2022)', q: 'DOI:"10.1242/jeb.243774"', phrases: ['1.39', '1.15'] },
  { module: 'pressure', claim: 'TMAO 40 to 261 mmol/kg, osmolality 350 / 991 / 1,100 mOsm/kg, isosmotic 8,200 m (Yancey 2014)', q: 'DOI:"10.1073/pnas.1322003111"', phrases: ['261', '991', '8,200'] },
  { module: 'pressure', claim: 'swim bladder up to 5 % of body volume; tissue 5 % denser than sea water (Lauridsen 2022)', q: 'DOI:"10.1186/s12915-022-01354-8"', phrases: ['5% of total body volume', '5% denser'] },
  { module: 'glide', claim: 'snapper max cardiac output 58.48 ml/min/kg (Durnford 2026)', q: 'DOI:"10.1242/jeb.252059"', phrases: ['58.48'] },
  { module: 'glide', claim: 'Edgerton & Breder: glide up to 50 m at 15-20 m/s (Makiguchi 2013 Introduction)', q: 'DOI:"10.3354/ab00494"', phrases: ['50 m'] },
];
async function epmcText(q) {
  const s = await getText(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=${encodeURIComponent(q)}`);
  const rec = JSON.parse(s.text)?.resultList?.result?.[0];
  if (!rec) return { via: 'not in Europe PMC', text: '' };
  let text = `${rec.title} ${rec.abstractText || ''}`, via = 'Europe PMC abstract';
  if (rec.pmcid) { try { const f = await getText(`https://www.ebi.ac.uk/europepmc/webservices/rest/${rec.pmcid}/fullTextXML`); if (f.status === 200 && f.text.length > 2000) { text += ' ' + f.text; via = `Europe PMC full text (${rec.pmcid})`; } else via += ` (full text ${rec.pmcid} not served)`; } catch {} }
  return { via, text: text.replace(/&lt;/g, '<').replace(/&gt;/g, '>') };
}
async function spotChecks(present) {
  const out = [];
  for (const c of SPOT_CHECKS.filter(c => present.includes(c.module))) {
    try {
      const f = await epmcText(c.q);
      const hits = c.phrases.map(ph => [ph, f.text.toLowerCase().includes(ph.toLowerCase())]);
      const n = hits.filter(h => h[1]).length;
      out.push({ ...c, via: f.via, hits: Object.fromEntries(hits), result: !f.text ? 'fetch-failed' : n === hits.length ? 'confirmed' : n ? 'partly-confirmed' : /not served/.test(f.via) ? 'unverifiable (abstract only; full text not served)' : 'does-not-mention' });
    } catch (e) { out.push({ ...c, result: 'fetch-failed', via: String(e.message).slice(0, 80) }); }
  }
  return out;
}
async function auditModule(name, src) {
  const rows = auditConstants(src);
  return { module: `scenarios/${name}.mjs`, constant_lines: rows.length,
    sourced_lines: rows.filter(r => r.source).length, named_only_lines: rows.filter(r => r.named).length,
    unsourced_lines: rows.filter(r => !r.source && !r.named).length,
    unsourced: rows.filter(r => !r.source && !r.named).slice(0, 40), named_only: rows.filter(r => r.named).slice(0, 15) };
}

// ─────────────────────────────────────────────────────────── run + report
async function runAll() {
  const files = findFiles();
  const S = await new Studio(files).init();
  const results = [];
  for (const t of testDefs(S)) {
    const row = { id: t.id, name: t.name, module: t.scen };
    try { Object.assign(row, await t.run()); }
    catch (e) { row.status = e.status || 'not-evaluable'; row.why = String(e.message || e).slice(0, 400); }
    results.push(row);
  }
  const audit = [];
  for (const [n, s] of Object.entries(S.scen)) audit.push(await auditModule(n, s.src));
  const spot = AUDIT ? await spotChecks(Object.keys(S.scen)) : (() => { try { return JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')).spot_checks || []; } catch { return []; } })();
  const st = selftest();
  const scored = results.filter(r => r.status !== 'observation');
  const tally = scored.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  const tally_amended = scored.reduce((a, r) => { const k = r.amended_status || r.status; a[k] = (a[k] || 0) + 1; return a; }, {});
  const out = {
    generated_at: new Date().toISOString(),
    preregistration: { file: 'sim-engine/validation/STUDIO-PREREGISTRATION.md', ...preregHash() },
    modules_found: { ...Object.fromEntries(Object.entries(files).filter(([k]) => k !== 'scenarios').map(([k, v]) => [k, v ? path.relative(SIM, v).replace(/\\/g, '/') : null])), scenarios: Object.fromEntries(Object.entries(files.scenarios).map(([k, v]) => [k, !!v])) },
    import_errors: S.errors,
    tally,
    tally_after_amendment_A1: tally_amended,
    selftest: { all_ok: st.every(x => x.ok), checks: st },
    results,
    audit,
    spot_checks: spot,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  fs.writeFileSync(OUT_MD, renderMd(out));
  return out;
}

function renderMd(o) {
  const L = [];
  L.push('# Design Studio: independent validation results', '');
  L.push(`Generated ${o.generated_at} by \`sim-engine/validation/studio-harness.mjs\` against the tests fixed in`);
  L.push(`\`STUDIO-PREREGISTRATION.md\` (sha256 \`${o.preregistration.recorded}\`, integrity check: **${o.preregistration.ok ? 'hash matches' : 'HASH MISMATCH: the pre-registration was edited after hashing'}**).`);
  L.push('Machine-readable: `studio-results.json`. Narrative and worst defects: `STUDIO-FINDINGS.md`. Post-results amendment: `STUDIO-AMENDMENTS.md`. Rows X* are observations added after results and are not counted. A pass that rests on a calibrated value is reported as `circular`, never as a pass.', '');
  L.push(`Harness self-test (each check made to fail on a planted bad input): **${o.selftest.all_ok ? 'all ' + o.selftest.checks.length + ' behave as designed' : 'SELF-TEST FAILED, do not trust the verdicts below'}**.`, '');
  try {
    const fx = JSON.parse(fs.readFileSync('C:/Temp/studio-validation-fixtures/fixture-results.json', 'utf8'));
    const bad = fx.results.filter(r => r.status !== 'not-available');
    L.push(`Fixture run (deliberately wrong scenario modules under C:/Temp/studio-validation-fixtures/bad, ${fx.generated_at}): ${bad.filter(r => r.status === 'fail' || r.status === 'circular').length} of ${bad.length} evaluable checks flagged the planted defect: ` + bad.map(r => `${r.id} ${r.status}`).join(', ') + '. (W5, the N7 rows whose fixture honoured the contract, and W9 whose fixture speed is random, can pass by design.)', '');
  } catch {}
  L.push('## Scoreboard', '', '| status | pre-registered rule | after amendments A1–A3 (post-results, see STUDIO-AMENDMENTS.md) |', '|---|---|---|');
  for (const k of [...new Set([...Object.keys(o.tally), ...Object.keys(o.tally_after_amendment_A1)])].sort()) L.push(`| ${k} | ${o.tally[k] || 0} | ${o.tally_after_amendment_A1[k] || 0} |`);
  L.push('', 'Modules found: ' + Object.entries(o.modules_found).filter(([k]) => k !== 'scenarios').map(([k, v]) => `${k} ${v ? '`' + v + '`' : '—'}`).join(', ') + '; scenarios: ' + Object.entries(o.modules_found.scenarios).map(([k, v]) => `${k}${v ? '' : ' (missing)'}`).join(', ') + '.');
  if (Object.keys(o.import_errors).length) L.push('', 'Import errors: ' + Object.entries(o.import_errors).map(([k, v]) => `\`${k}\`: ${v}`).join('; '));
  L.push('', '## Per test', '', '| id | test | status | predicted | measured / band | weakest kind | why |', '|---|---|---|---|---|---|---|');
  const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  for (const r of o.results) L.push(`| ${r.id} | ${esc(r.name)} | **${r.status}**${r.amended_status ? ' → ' + (r.amendment || 'A1') + ': **' + r.amended_status + '**' : ''} | ${esc(typeof r.predicted === 'number' ? fmt(r.predicted) + ' ' + (r.unit || '') : r.predicted)} | ${esc(r.measured || '')}${r.band ? ' band ' + esc(Array.isArray(r.band) ? '[' + r.band.join(', ') + ']' : r.band) : ''} | ${esc(r.weakest || '')} | ${esc(r.why)} |`);
  L.push('', '## Audit of scenario constants', '', 'Code literals only (strings and comments stripped; unit conversions and years ignored). A line is *sourced* if a URL/DOI/PMID/PMC id is within 3 lines, *named-only* if only an author-year or repository-file reference is, else *unsourced*. Named-only is not a defect by itself, but it cannot be fetched without guessing.', '');
  if (!o.audit.length) L.push('No scenario module has landed yet.');
  L.push('| module | lines with constants | sourced | named-only | unsourced |', '|---|---|---|---|---|');
  for (const a of o.audit) L.push(`| ${a.module} | ${a.constant_lines} | ${a.sourced_lines} | ${a.named_only_lines} | **${a.unsourced_lines}** |`);
  L.push('');
  for (const a of o.audit) if (a.unsourced.length) { L.push(`<details><summary>${a.module}: ${a.unsourced_lines} unsourced lines</summary>`, ''); for (const u of a.unsourced) L.push(`- line ${u.line}: \`${esc(u.text).replace(/`/g, "'")}\``); L.push('', '</details>', ''); }
  L.push('### Spot checks (real GET of the cited paper for the quoted phrase)', '');
  if (!o.spot_checks?.length) L.push('(not run; use `--audit`)');
  else { L.push('| module | claim in the module | fetched via | phrases found | result |', '|---|---|---|---|---|'); for (const c of o.spot_checks) L.push(`| ${c.module} | ${esc(c.claim)} | ${esc(c.via)} | ${esc(JSON.stringify(c.hits || {}))} | **${c.result}** |`); }
  L.push('');
  return L.join('\n') + '\n';
}

function stamp() { const f = findFiles(); return JSON.stringify([f.organism, f.state, f.data, path.join(SIM, "tools", "studio.mjs"), f.spec, f.parse, f.optimizer, ...Object.values(f.scenarios)].map(p => (p ? fs.statSync(p).mtimeMs : 0))); }

if (WATCH) {
  const until = Date.now() + WATCH_MIN * 60000;
  let last = '';
  while (Date.now() < until) {
    const s = stamp();
    if (s !== last) {
      last = s;
      // A fresh process per run, so modules imported by the studio itself are never served stale from cache.
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync(process.execPath, [import.meta.filename, ...(AUDIT ? ['--audit'] : [])], { encoding: 'utf8', timeout: 900000 });
      console.log(new Date().toISOString(), (r.stdout || '').replace(/\s+/g, ' ').slice(0, 300), (r.stderr || '').slice(0, 200));
    }
    await new Promise(r => setTimeout(r, 120000));
  }
} else {
  const o = await runAll();
  console.log(JSON.stringify({ prereg_ok: o.preregistration.ok, selftest_ok: o.selftest.all_ok, tally: o.tally }, null, 1));
}
