// sweep.js — exhaustive exploration of the flight/glide solver's parameter space.
//
//   import { extractSolver, applyValues, runSweep, METRICS,
//            drawCurve, drawHeatmap, tableHtml, toCSV, toJSON, leanCheck } from './sweep.js';
//
//   const solver = await extractSolver('index.html');        // the REAL solver, read out of index.html
//   const res = await runSweep({ schema, values, sweep: {kind:'1d', key:'approach_speed_m_s', from:2, to:20, steps:37}, solve: solver });
//
// THE SOLVER IS NOT COPIED. `extractSolver` fetches index.html and lifts the integrator's own
// functions out of it by name (derive, CL, CD, fge, physCap, atmo, satHb, accel, rk4, newSim,
// phaseNow, stepSim), brace-matched from the real bytes, and throws if any one of them is missing or
// has been renamed. There is therefore no second copy of the equations to drift, and this module
// never writes to index.html. The physiology chain is OFF in a sweep (physOn = false, exactly the
// page's default): the chain is async and per-step, and a sweep that silently ran it would not be
// the same model as the page's default run.
//
// Charts follow the dataviz skill: one hue light->dark for the heatmap's magnitude, categorical
// slots 1-3 for the curve's series, and the infeasible / law-violating overlays carry a texture AND
// a label AND a table-view twin, so no verdict is ever colour alone.

// `solveWith` is index.html's own entry point for a complete run (the one scene3d.js drives through
// window.DELPHI_SIM.solve), so a sweep point is produced by exactly the call the 3D view makes.
export const SOLVER_FNS = ['derive', 'CL', 'CD', 'fge', 'physCap', 'atmo', 'satHb', 'accel', 'rk4', 'newSim', 'phaseNow', 'stepSim', 'solveWith'];

// The globals index.html's solver closes over. physOn false => newSim never touches the chain;
// GE_OFF is the page's own ground-effect switch and solveWith sets it from the `groundEffect` field.
const PRELUDE = 'let CUR=null,physOn=false,physMod=null,BASE=null,GE_OFF=false;const location={search:""};\n';

/** Brace-match one top-level `function NAME(...)  {...}` out of a source text. */
export function grabFunction(src, name) {
  const at = src.indexOf('\nfunction ' + name + '(');
  if (at < 0) throw new Error('sweep.js: index.html no longer declares `function ' + name + '(` at the top level. The solver was renamed or restructured; fix SOLVER_FNS rather than copying the equations.');
  let j = src.indexOf('{', at), depth = 0, inS = null;
  for (; j < src.length; j++) {
    const c = src[j], p = src[j - 1];
    if (inS) { if (c === inS && p !== '\\') inS = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); if (j < 0) break; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) break; }
  }
  if (depth !== 0) throw new Error('sweep.js: unbalanced braces while reading `' + name + '` out of index.html');
  return src.slice(at + 1, j + 1);
}

/** Read the solver out of index.html. Returns {source, fns, bytes, url}. */
export async function extractSolver(url = 'index.html') {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('sweep.js: GET ' + url + ' -> ' + r.status);
  const html = await r.text();
  const parts = SOLVER_FNS.map(n => grabFunction(html, n));
  return { source: parts.join('\n'), fns: SOLVER_FNS.slice(), bytes: html.length, url: String(r.url) };
}

// ---------------------------------------------------------------------------------------------
// applyValues: schema + value set -> the exact objects index.html's solver reads.
// PURE and self-contained: it is shipped into the worker by Function.prototype.toString, so it must
// not close over anything in this module.
// ---------------------------------------------------------------------------------------------
export function applyValues(schema, values, base) {
  const P = JSON.parse(JSON.stringify(base.params));
  const fish = P.fish[base.fishIndex || 0];
  const ge = base.groundEffect ? JSON.parse(JSON.stringify(base.groundEffect)) : null;
  const cond = JSON.parse(JSON.stringify(base.baselineConditions || {}));
  const flags = {};
  let geOn = true;
  // index.html's own boot step: the committed air density is replaced by data/baseline.json's.
  if (cond.air_density_kg_m3 && typeof cond.air_density_kg_m3.value === 'number') P.constants.rho_air.value = cond.air_density_kg_m3.value;
  const unknown = [];
  for (const p of schema) {
    if (!p.settable) continue;
    const v = values[p.key];
    const path = p.path || {};
    if (path.t === 'fish') { if (!fish[path.key]) fish[path.key] = { value: null }; fish[path.key].value = v; }
    else if (path.t === 'fishField') { if (!fish[path.key]) fish[path.key] = {}; fish[path.key][path.field] = v; }
    else if (path.t === 'const') { P.constants[path.key].value = v; }
    else if (path.t === 'baseline') { if (!cond[path.key]) cond[path.key] = {}; cond[path.key].value = v; if (path.key === 'air_density_kg_m3') P.constants.rho_air.value = v; }
    else if (path.t === 'geOff') { geOn = !!v; }     // index.html's own GE_OFF switch, via solveWith
    else if (path.t === 'flag') {
      if (p.type === 'bool') { if (!v && path.falseValue != null) flags[path.key] = path.falseValue; }
      else if (v != null && v !== '') flags[path.key] = String(v);
    }
    else if (path.t === 'hardcoded') { /* by construction unreachable */ }
    else unknown.push(p.key);
  }
  if (unknown.length) throw new Error('applyValues: schema entries with an unknown path: ' + unknown.join(', '));
  return { P: P, fish: fish, ge: ge, geOn: geOn, flags: flags, conditions: cond };
}

// ---------------------------------------------------------------------------------------------
// Outcomes. Also shipped into the worker by toString, so: pure, no closures.
// ---------------------------------------------------------------------------------------------
export function outcomesOf(S, opts) {
  const d = S.d, gl = S.glides || [], h = S.hist || [];
  const geOn = !!opts.geOn, tmax = +opts.tmax || 60;
  let glideSum = 0, glideMax = 0, aloft = 0, zmaxGlide = 0;
  for (const g of gl) { glideSum += g.dist; aloft += g.dur; if (g.dist > glideMax) glideMax = g.dist; if (g.zmax > zmaxGlide) zmaxGlide = g.zmax; }
  // Two different speeds, kept apart because they mean different things:
  //  * v_glide_min: the slowest moment of any glide, apex of a ballistic arc included. A dip below
  //    v_min here is NOT a contradiction: the fish can coast upward unsupported.
  //  * climb_below_vmin_s: the longest run of CLIMBING while below 0.95 v_min, which is index.html's
  //    own pre-registered test-1 quantity. Over 0.2 s it means the model is making lift from nothing.
  let vGlideMin = Infinity, climbMax = 0, run = 0, climbBelow = 0, vInRun = Infinity, vWorstRun = null;
  for (let i = 1; i < h.length; i++) {
    const p = h[i], q = h[i - 1];
    const dz = p.z - q.z, dt = p.t - q.t;
    if (p.ph !== 'glide') { run = 0; vInRun = Infinity; continue; }
    if (p.v < vGlideMin) vGlideMin = p.v;
    if (dt > 0 && dz / dt > climbMax) climbMax = dz / dt;
    if (dz > 0 && p.v < 0.95 * d.vmin) {
      run += dt; if (p.v < vInRun) vInRun = p.v;
      if (run > climbBelow) { climbBelow = run; vWorstRun = vInRun; }
    } else { run = 0; vInRun = Infinity; }
  }
  const stop = S.t >= tmax - 1e-6 ? 'time limit' : (S.s.x >= (d.alt ? 30000 : 900) - 1e-6 ? 'distance limit' : (S.phase === 'stopped' ? 'the model stopped the run' : 'still running'));
  const clGlide = d.alpha <= d.stall ? Math.max(-0.5, d.CL0 + d.CLslope * d.alpha) : d.CLmax * (60 - Math.min(d.alpha, 60)) / 25;
  // Feasibility is the C9 statement and nothing else: below v_min lift cannot hold the fish up, so
  // there is no glide. Model-health flags are reported separately and never fold into this.
  const why = [];
  if (!gl.length) why.push('no glide completed: the fish never got the lobe clear of the water');
  else if (glideMax < 1) why.push('longest glide under 1 m');
  if (S.takeoffV == null) { if (gl.length) why.push('no take-off speed recorded'); }
  else if (S.takeoffV < d.vmin) why.push('take-off speed ' + S.takeoffV.toFixed(2) + ' m/s is below v_min ' + d.vmin.toFixed(2) + ' m/s');
  return {
    feasible: why.length === 0,
    infeasible_why: why,
    v_min_m_s: d.vmin,
    v_takeoff_m_s: S.takeoffV == null ? null : S.takeoffV,
    v_glide_min_m_s: isFinite(vGlideMin) ? vGlideMin : null,
    climb_below_vmin_s: climbBelow,
    climb_below_vmin_speed_m_s: vWorstRun,
    // The polar the forces actually use, against the CL_max v_min is computed from. When the glide
    // C_L exceeds CL_max the two disagree and the model flies below its own v_min: see the
    // `polar-consistent-with-CLmax` constraint in params-panel.js.
    CL_at_glide_alpha: clGlide,
    v_min_at_glide_alpha_m_s: clGlide > 0 ? Math.sqrt(2 * d.W / (opts.rho_air * d.S * clGlide)) : null,
    polar_consistent: clGlide <= d.CLmax + 1e-12,
    model_health_flag: climbBelow > 0.2 ? 'climbed for ' + climbBelow.toFixed(2) + ' s below 0.95 v_min (index.html test 1 fails at this point)' : null,
    // kept separate on purpose: the Lean C15 theorem is about ONE steady unpowered glide; taxiing
    // thrust and repeated touch-and-go are outside its model, so they are not folded in.
    range_glide_lean_m: glideSum,
    range_glide_longest_m: glideMax,
    range_total_m: S.s.x,
    lean_glide_bound_m: zmaxGlide * d.LDmax / (1 - (geOn ? 0.14 : 0)),
    time_aloft_s: aloft,
    time_total_s: S.t,
    glides: gl.length,
    max_height_m: S.zmax || 0,
    climb_max_m_s: climbMax,
    mean_taxi_m: (S.taxiLen && S.taxiLen.length) ? S.taxiLen.reduce((a, b) => a + b, 0) / S.taxiLen.length : null,
    P_avail_W: d.Pavail,
    stopped_by: stop,
    // The state the Lean laws are evaluated on (main thread; see leanCheck). Deliberate choices:
    //  * NO `taxon`. The taxon-scoped laws (E2-E7, P1-P5, C2a, C7b, C8*, C9c, G1-G5) would then
    //    evaluate on a flight state that says nothing about development, temperature or oxygen, and
    //    E3 in particular would report a sustained-aerobic-power violation at every single point for
    //    a fish that does not fly under power. Naming the taxon to get that row would be
    //    manufacturing a verdict, so the sweep reports only the taxon-free flight laws and says so.
    //  * `airspeed_m_s` is the TAKE-OFF speed, the speed at which the glide must be lift-supported.
    //    The ballistic apex is not fed to C9: coasting upward below v_min is not steady flight.
    //  * `climbRate_m_s` only for a powered design: C16 bounds climb by EXCESS POWER, and an
    //    unpowered glider climbing on its own kinetic energy is outside that model.
    //  * `glideHeight_m` is the highest point the longest glide reaches, the most generous geometric
    //    reading of C15's launch height. C15 then compares h (L/D)max / (1 - ge) with the distance.
    lean_state: {
      SL_m: opts.SL_m, mass_kg: d.m, finArea_m2: d.S, CLmax: d.CLmax, LD_max: d.LDmax,
      rho: opts.rho_air, g: opts.g,
      airspeed_m_s: S.takeoffV == null ? null : S.takeoffV,
      glideHeight_m: zmaxGlide || null, glideDistance_m: glideMax || null,
      groundEffect: geOn ? 0.14 : 0,
      powerAvailable_W: d.powered ? d.Pavail : null,
      climbRate_m_s: d.powered ? climbMax : null,
    },
  };
}

/** The outcomes a sweep can plot. `lean` marks the two that are kept separate on purpose. */
export const METRICS = [
  { key: 'range_glide_lean_m', label: 'glide range, Lean-covered (sum of unpowered glides)', unit: 'm', lean: 'C15 covers one steady unpowered glide' },
  { key: 'range_total_m', label: 'range, total (taxi + glides, outside the Lean model)', unit: 'm' },
  { key: 'range_glide_longest_m', label: 'longest single glide (the quantity C15 bounds)', unit: 'm', lean: 'C15' },
  { key: 'v_min_m_s', label: 'v_min', unit: 'm/s', lean: 'C9' },
  { key: 'v_takeoff_m_s', label: 'take-off speed', unit: 'm/s' },
  { key: 'time_aloft_s', label: 'time aloft', unit: 's' },
  { key: 'time_total_s', label: 'time, whole sequence', unit: 's' },
  { key: 'glides', label: 'glides completed', unit: '1' },
  { key: 'max_height_m', label: 'maximum height', unit: 'm' },
  { key: 'P_avail_W', label: 'power available', unit: 'W' },
];

// ---------------------------------------------------------------------------------------------
// The worker
// ---------------------------------------------------------------------------------------------
function workerSource() {
  return [
    'var applyValues=', applyValues.toString(), ';\n',
    'var outcomesOf=', outcomesOf.toString(), ';\n',
    'var PRELUDE=', JSON.stringify(PRELUDE), ';\n',
    'var SRC=null, BASE=null, SCHEMA=null;\n',
    'function makeApi(P,ge,flags,fish){\n',
    '  var f=new URLSearchParams(); for(var k in flags) f.set(k,flags[k]);\n',
    '  return new Function("P","ge","FLAGS","fish", PRELUDE+SRC+"\\nreturn {derive:derive,solveWith:solveWith};")(P,ge,f,fish);\n',
    '}\n',
    'function solveOne(values){\n',
    '  var a=applyValues(SCHEMA,values,BASE);\n',
    '  var api=makeApi(a.P,a.ge,a.flags,a.fish);\n',
    '  var tmax=+a.flags.tmax||60;\n',
    '  var S=api.solveWith({fish:a.fish,groundEffect:a.geOn},tmax);\n',
    '  var sl=a.fish.standard_length_m&&a.fish.standard_length_m.value;\n',
    '  return outcomesOf(S,{geOn:!!a.ge&&a.geOn,tmax:tmax,SL_m:sl,rho_air:a.P.constants.rho_air.value,g:a.P.constants.g.value});\n',
    '}\n',
    'self.onmessage=function(ev){\n',
    '  var m=ev.data;\n',
    '  try{\n',
    '    if(m.cmd==="init"){ SRC=m.solverSource; BASE=m.base; SCHEMA=m.schema; self.postMessage({type:"ready"}); return; }\n',
    '    if(m.cmd==="run"){\n',
    '      var out=[], t0=Date.now();\n',
    '      for(var i=0;i<m.jobs.length;i++){\n',
    '        var o;\n',
    '        try{ o=solveOne(m.jobs[i].values); }\n',
    '        catch(e){ o={feasible:false,infeasible_why:["the solver threw: "+(e&&e.message||e)],error:String(e&&e.message||e),lean_state:null}; }\n',
    '        o.index=m.jobs[i].index; o.at=m.jobs[i].at; out.push(o);\n',
    '        if(out.length>=20||i===m.jobs.length-1){ self.postMessage({type:"chunk",id:m.id,rows:out,done:i+1,total:m.jobs.length}); out=[]; }\n',
    '      }\n',
    '      self.postMessage({type:"done",id:m.id,ms:Date.now()-t0});\n',
    '    }\n',
    '  }catch(e){ self.postMessage({type:"error",id:m&&m.id,message:String(e&&e.stack||e)}); }\n',
    '};\n',
  ].join('');
}

/** Spin up the sweep worker. Returns {post, terminate, ready}. */
export function makeWorker(solverSource, base, schema) {
  const url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
  const w = new Worker(url);
  URL.revokeObjectURL(url);
  const ready = new Promise((res, rej) => {
    const on = ev => { if (ev.data && ev.data.type === 'ready') { w.removeEventListener('message', on); res(w); } };
    w.addEventListener('message', on);
    w.addEventListener('error', e => rej(new Error('sweep worker failed to start: ' + (e.message || e.filename))), { once: true });
  });
  w.postMessage({ cmd: 'init', solverSource, base, schema });
  return { worker: w, ready, terminate: () => w.terminate() };
}

// ---------------------------------------------------------------------------------------------
// runSweep
// ---------------------------------------------------------------------------------------------
export const DEFAULT_CAP = 900;

function stepsOf(from, to, n) {
  const out = [];
  if (n < 2) return [from];
  for (let i = 0; i < n; i++) out.push(from + (to - from) * i / (n - 1));
  return out;
}

/** Expand a sweep declaration into the list of value sets to solve. */
export function planSweep(schema, values, sweep) {
  const byKey = new Map(schema.map(p => [p.key, p]));
  const need = k => { const p = byKey.get(k); if (!p) throw new Error('sweep: no schema parameter named ' + k); if (!p.settable) throw new Error('sweep: ' + k + ' is hard-coded in index.html and cannot be swept from here'); return p; };
  const jobs = [];
  if (sweep.kind === '1d') {
    const p = need(sweep.key);
    const xs = stepsOf(sweep.from, sweep.to, sweep.steps || 25);
    xs.forEach((x, i) => jobs.push({ index: i, at: { [p.key]: x }, values: Object.assign({}, values, { [p.key]: x }) }));
    return { kind: '1d', axes: [{ key: p.key, label: p.label, unit: p.unit, values: xs }], jobs };
  }
  if (sweep.kind === '2d') {
    const px = need(sweep.x.key), py = need(sweep.y.key);
    if (px.key === py.key) throw new Error('sweep: a 2-D sweep needs two different parameters');
    const xs = stepsOf(sweep.x.from, sweep.x.to, sweep.x.steps || 20);
    const ys = stepsOf(sweep.y.from, sweep.y.to, sweep.y.steps || 20);
    let i = 0;
    for (const y of ys) for (const x of xs) jobs.push({ index: i++, at: { [px.key]: x, [py.key]: y }, values: Object.assign({}, values, { [px.key]: x, [py.key]: y }) });
    return { kind: '2d', axes: [{ key: px.key, label: px.label, unit: px.unit, values: xs }, { key: py.key, label: py.label, unit: py.unit, values: ys }], jobs };
  }
  if (sweep.kind === 'batch') {
    (sweep.sets || []).forEach((s, i) => jobs.push({ index: i, at: { name: s.name || 'set ' + (i + 1) }, values: Object.assign({}, values, s.values || s) }));
    return { kind: 'batch', axes: [{ key: 'set', label: 'parameter set', unit: '', values: (sweep.sets || []).map((s, i) => s.name || 'set ' + (i + 1)) }], jobs };
  }
  throw new Error('sweep: unknown kind ' + sweep.kind + ' (1d | 2d | batch)');
}

/**
 * runSweep({schema, values, sweep, solve, onProgress, cap, lean})
 *  - `solve` is either {source} (from extractSolver; runs in a Web Worker) or a function
 *    (values) => outcomes, used in-thread for tests and for environments with no Worker.
 *  - resolves to {plan, rows, lean, capped, ms}
 */
export async function runSweep(o) {
  const { schema, values, sweep } = o;
  const cap = Math.max(1, Math.min(o.cap || DEFAULT_CAP, 20000));
  const onProgress = o.onProgress || (() => { });
  const plan = planSweep(schema, values, sweep);
  let capped = 0;
  if (plan.jobs.length > cap) { capped = plan.jobs.length - cap; plan.jobs = plan.jobs.slice(0, cap); }
  const t0 = Date.now();
  const rows = new Array(plan.jobs.length);

  if (typeof o.solve === 'function') {
    for (let i = 0; i < plan.jobs.length; i++) {
      rows[i] = Object.assign({ index: i, at: plan.jobs[i].at }, await o.solve(plan.jobs[i].values));
      if (i % 10 === 0 || i === plan.jobs.length - 1) onProgress({ done: i + 1, total: plan.jobs.length });
    }
  } else if (o.solve && o.solve.source) {
    const h = makeWorker(o.solve.source, o.base, schema);
    await h.ready;
    await new Promise((res, rej) => {
      const id = 'sw' + Date.now();
      h.worker.onmessage = ev => {
        const m = ev.data;
        if (m.type === 'chunk') { for (const r of m.rows) rows[r.index] = r; onProgress({ done: m.done, total: m.total }); }
        else if (m.type === 'done') res();
        else if (m.type === 'error') rej(new Error(m.message));
      };
      h.worker.onerror = e => rej(new Error('sweep worker: ' + (e.message || 'error')));
      h.worker.postMessage({ cmd: 'run', id, jobs: plan.jobs });
    }).finally(() => h.terminate());
  } else throw new Error('runSweep: `solve` must be a function or {source} from extractSolver()');

  let lean = null;
  if (o.lean !== false) {
    try { lean = await leanCheck(rows, { onProgress: p => onProgress({ phase: 'lean', done: p.done, total: p.total }) }); }
    catch (e) { lean = { error: String(e && e.message || e) }; }
  }
  return { plan, rows, lean, capped, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------------------------------------
// Lean laws. Law ids, versions, kinds and statuses come from /api/lean/ via lean-client.js and are
// never written here; `accepted` is read off the lawset, not assumed.
// ---------------------------------------------------------------------------------------------
let LC = null;
const leanClient = () => (LC ||= import(new URL('../../../blueprint3d/lean-client.js', import.meta.url).href));

/** Evaluate every row's lean_state against the current lawset. Mutates rows with .lean_* fields. */
export async function leanCheck(rows, opts = {}) {
  const { checkState, getLawset, lawApiSource } = await leanClient();
  const lawset = await getLawset('current');
  const onProgress = opts.onProgress || (() => { });
  const seen = new Map();
  let checked = 0, bindingRows = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.lean_state) { if (r) { r.lean_violating = false; r.lean_violations = []; } continue; }
    const res = await checkState(r.lean_state, lawset);
    const v = (res.violations || []).filter(x => x.binding);     // binding === the law's status is `accepted`
    r.lean_violations = v;
    r.lean_violating = v.length > 0;
    r.lean_rows = res.length;
    if (r.lean_violating) bindingRows++;
    for (const x of v) { const k = x.law_id + ' / ' + x.constraint; if (!seen.has(k)) seen.set(k, { law_id: x.law_id, version: x.version, kind: x.kind, status: x.status, constraint: x.constraint, message: x.message, n: 0 }); seen.get(k).n++; }
    checked++;
    if (i % 25 === 0) { onProgress({ done: i + 1, total: rows.length }); await new Promise(r2 => setTimeout(r2, 0)); }
  }
  onProgress({ done: rows.length, total: rows.length });
  return {
    lawset: lawset.version, source: lawset.source || lawApiSource(),
    laws_in_set: (lawset.laws || []).length,
    accepted_in_set: (lawset.laws || []).filter(l => l.status === 'accepted').length,
    checked, violating_points: bindingRows,
    laws_violated: [...seen.values()].sort((a, b) => b.n - a.n),
  };
}

// ---------------------------------------------------------------------------------------------
// Charts. dataviz skill: form first, colour by job, texture + label for the overlays.
// ---------------------------------------------------------------------------------------------
// Sequential blue ramp (palette.md, steps 100..700) for magnitude; categorical slots 1-3 for series.
const RAMP_LIGHT = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
const RAMP_DARK = RAMP_LIGHT.slice().reverse();
const css = (v, fb) => { try { const s = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return s || fb; } catch (e) { return fb; } };
const isDark = () => { try { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches; } catch (e) { return false; } };
const SERIES = () => [css('--s1', '#2a78d6'), css('--s2', '#eb6834'), css('--s3', '#1baf7a')];
const ramp = () => isDark() ? RAMP_DARK : RAMP_LIGHT;

function fitCanvas(c, hcss) {
  const ctx = c.getContext('2d');
  const r = c.getBoundingClientRect();
  const W = Math.max(260, Math.round(r.width || c.clientWidth || 760));
  const dpr = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(hcss * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(hcss * dpr); }
  c.style.height = hcss + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, hcss);
  const narrow = W < 470;
  return { ctx, W, H: hcss, narrow, m: { l: narrow ? 46 : 58, r: narrow ? 12 : 18, t: 12, b: narrow ? 42 : 46 } };
}
// A hatch is the accessibility channel, so it has to survive being drawn over any ramp step. Each
// line is laid down twice: a wide stroke in the chart surface colour, then the hatch colour on top.
// The halo keeps the texture legible on the darkest cell and in greyscale.
function hatch(ctx, x, y, w, h, color, dir, gap = 6, halo = true) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const n = Math.ceil((w + h) / gap);
  const path = () => {
    ctx.beginPath();
    for (let i = -1; i <= n; i++) {
      const o = x + i * gap;
      if (dir === 45) { ctx.moveTo(o, y + h); ctx.lineTo(o + h, y); }
      else { ctx.moveTo(o, y); ctx.lineTo(o + h, y + h); }
    }
    ctx.stroke();
  };
  if (halo) { ctx.strokeStyle = css('--panel', '#fff'); ctx.lineWidth = 2.6; ctx.globalAlpha = 0.5; path(); }
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.globalAlpha = 1; path();
  ctx.restore();
}
function axesFrame(F, x0, x1, y0, y1, xl, yl, xTicks, yTicks, fmtX, fmtY) {
  const { ctx, W, H, m } = F;
  ctx.fillStyle = css('--panel', '#fff'); ctx.fillRect(0, 0, W, H);
  const X = v => m.l + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = v => H - m.b - (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  ctx.font = '12px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  ctx.strokeStyle = css('--line', '#e1e0d9'); ctx.lineWidth = 1;           // solid hairline grid
  ctx.fillStyle = css('--mute', '#898781'); ctx.textAlign = 'center';
  for (const v of xTicks) { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), H - m.b); ctx.stroke(); ctx.fillText(fmtX ? fmtX(v) : String(v), X(v), H - m.b + 15); }
  ctx.textAlign = 'right';
  for (const v of yTicks) { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(W - m.r, Y(v)); ctx.stroke(); ctx.fillText(fmtY ? fmtY(v) : String(v), m.l - 6, Y(v) + 4); }
  ctx.textAlign = 'center'; ctx.fillText(xl, (m.l + W - m.r) / 2, H - 6);
  ctx.save(); ctx.translate(13, (m.t + H - m.b) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yl, 0, 0); ctx.restore();
  return { X, Y };
}
const niceTicks = (a, b, n) => { const out = []; for (let i = 0; i <= n; i++) out.push(a + (b - a) * i / n); return out; };
const sig = v => v == null ? '' : (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

/**
 * drawCurve(canvas, {rows, axis, series, yLabel, height}) — a 1-D sweep outcome curve.
 * `series`: [{key,label}] (max 3). Infeasible and law-violating x-spans get a hatched band plus a
 * written label; nothing is carried by colour alone.
 */
export function drawCurve(c, o) {
  const rows = o.rows, axis = o.axis, series = o.series.slice(0, 3);
  const F = fitCanvas(c, o.height || 260), ctx = F.ctx;
  const xs = rows.map((r, i) => (axis.values && typeof axis.values[i] === 'number') ? axis.values[i] : i);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y1 = 0;
  for (const r of rows) for (const s of series) { const v = r && r[s.key]; if (typeof v === 'number' && isFinite(v) && v > y1) y1 = v; }
  y1 = y1 > 0 ? y1 * 1.12 : 1;
  const A = axesFrame(F, x0, x1, 0, y1, (axis.label || axis.key) + (axis.unit && axis.unit !== '1' ? ' (' + axis.unit + ')' : ''), o.yLabel || '', niceTicks(x0, x1, F.narrow ? 3 : 6), niceTicks(0, y1, 4), sig, sig);

  // bands first, under the marks
  const top = F.m.t, bot = F.H - F.m.b;
  const spans = (pred) => { const out = []; let s = null; for (let i = 0; i < rows.length; i++) { const on = pred(rows[i]); if (on && s == null) s = i; if ((!on || i === rows.length - 1) && s != null) { out.push([s, on ? i : i - 1]); s = null; } } return out; };
  const bandAt = (i0, i1) => { const a = A.X(xs[Math.max(0, i0)]), b = A.X(xs[Math.min(xs.length - 1, i1)]); const half = (xs.length > 1 ? Math.abs(A.X(xs[1]) - A.X(xs[0])) : 10) / 2; return [a - half, Math.max(4, (b - a) + 2 * half)]; };
  // A band is a large area, so its texture is sparse and unsaturated: dense angled fields over a
  // whole plot read as noise (and are a vestibular risk). No halo here; the surface is plain.
  ctx.save(); ctx.globalAlpha = 0.55;
  for (const [i0, i1] of spans(r => r && !r.feasible)) { const [bx, bw] = bandAt(i0, i1); ctx.fillStyle = isDark() ? 'rgba(255,255,255,.04)' : 'rgba(11,11,11,.035)'; ctx.fillRect(bx, top, bw, bot - top); hatch(ctx, bx, top, bw, bot - top, css('--mute', '#898781'), 45, 11, false); }
  for (const [i0, i1] of spans(r => r && r.lean_violating)) { const [bx, bw] = bandAt(i0, i1); hatch(ctx, bx, top, bw, bot - top, css('--viol', '#6b4fb3'), 135, 11, false); }
  ctx.restore();

  const cols = SERIES(), labelled = [];
  series.forEach((s, si) => {
    const pts = rows.map((r, i) => (r && typeof r[s.key] === 'number' && isFinite(r[s.key])) ? [A.X(xs[i]), A.Y(r[s.key])] : null).filter(Boolean);
    if (!pts.length) return;
    ctx.save(); ctx.strokeStyle = cols[si]; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    // 2px surface ring on the end marker, and a selective direct label (endpoint only)
    const e = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(e[0], e[1], 4.5, 0, 7); ctx.fillStyle = cols[si]; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = css('--panel', '#fff'); ctx.stroke();
    // one selective direct label per series, at the endpoint, nudged clear of its neighbours
    const lastV = [...rows].reverse().find(r => r && typeof r[s.key] === 'number');
    if (lastV && !F.narrow) {
      let ly = e[1] - 7;
      while (labelled.some(y => Math.abs(y - ly) < 13)) ly += 13;
      labelled.push(ly);
      ctx.fillStyle = css('--mute', '#898781'); ctx.textAlign = 'right'; ctx.font = '600 11px system-ui';
      ctx.fillText(sig(lastV[s.key]), e[0] - 8, ly);
    }
    ctx.restore();
  });
  return F;
}

/**
 * drawHeatmap(canvas, {rows, axes, metric, height}) — a 2-D sweep.
 * One hue light->dark for magnitude (never a rainbow). Infeasible cells are drawn at the surface
 * with a 45 degrees hatch; law-violating cells take a 135 degrees hatch in the violation ink on top,
 * so the two overlays read as a crosshatch where they coincide and both survive greyscale and CVD.
 */
export function drawHeatmap(c, o) {
  const [ax, ay] = o.axes, rows = o.rows, key = o.metric.key;
  const nx = ax.values.length, ny = ay.values.length;
  const F = fitCanvas(c, o.height || 340), ctx = F.ctx;
  const vals = rows.filter(r => r && r.feasible && typeof r[key] === 'number' && isFinite(r[key])).map(r => r[key]);
  const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  const A = axesFrame(F, 0, nx, 0, ny,
    (ax.label || ax.key) + (ax.unit && ax.unit !== '1' ? ' (' + ax.unit + ')' : ''),
    (ay.label || ay.key) + (ay.unit && ay.unit !== '1' ? ' (' + ay.unit + ')' : ''), [], [], sig, sig);
  // axis labels at cell centres, thinned so they never collide
  ctx.font = '12px system-ui'; ctx.fillStyle = css('--mute', '#898781');
  const cw = (F.W - F.m.l - F.m.r) / nx, ch = (F.H - F.m.t - F.m.b) / ny;
  const everyX = Math.max(1, Math.ceil(nx / (F.narrow ? 4 : 8))), everyY = Math.max(1, Math.ceil(ny / (F.narrow ? 4 : 7)));
  ctx.textAlign = 'center';
  for (let i = 0; i < nx; i += everyX) ctx.fillText(sig(ax.values[i]), F.m.l + (i + 0.5) * cw, F.H - F.m.b + 15);
  ctx.textAlign = 'right';
  for (let j = 0; j < ny; j += everyY) ctx.fillText(sig(ay.values[j]), F.m.l - 6, F.H - F.m.b - (j + 0.5) * ch + 4);
  const R = ramp();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const r = rows[j * nx + i];
    const x = F.m.l + i * cw + 1, y = F.H - F.m.b - (j + 1) * ch + 1, w = Math.max(1, cw - 2), h = Math.max(1, ch - 2); // 2px surface gap
    if (!r) { ctx.fillStyle = css('--soft', '#eef2ef'); ctx.fillRect(x, y, w, h); continue; }
    if (!r.feasible) { ctx.fillStyle = css('--panel', '#fff'); ctx.fillRect(x, y, w, h); hatch(ctx, x, y, w, h, css('--mute', '#898781'), 45, 7, false); }
    else {
      const v = r[key];
      const t = (typeof v === 'number' && isFinite(v) && hi > lo) ? (v - lo) / (hi - lo) : 0;
      ctx.fillStyle = R[Math.max(0, Math.min(R.length - 1, Math.round(t * (R.length - 1))))];
      ctx.fillRect(x, y, w, h);
    }
    if (r.lean_violating) hatch(ctx, x, y, w, h, css('--viol', '#6b4fb3'), 135, 8);
  }
  return Object.assign(F, { lo, hi, nx, ny, cw, ch });
}

/** The scale legend for a heatmap, plus the two overlay keys with their written labels. */
export function heatLegendHtml(metric, lo, hi, counts) {
  const R = ramp();   // the SAME ramp the cells were drawn with, so the key is not reversed in dark mode
  const sw = R.filter((_, i) => i % 2 === 0).map(h => '<i style="display:inline-block;width:16px;height:10px;background:' + h + '"></i>').join('');
  return '<div class="legend">' +
    '<span class="key"><b>' + metric.label + '</b> ' + sig(lo) + ' ' + sw + ' ' + sig(hi) + ' ' + (metric.unit && metric.unit !== '1' ? metric.unit : '') + '</span>' +
    '<span class="key"><svg width="18" height="12" aria-hidden="true"><rect width="18" height="12" fill="none" stroke="currentColor" stroke-width="1" opacity=".3"/><path d="M0 12 L12 0 M6 12 L18 0" stroke="currentColor" stroke-width="1.4" fill="none"/></svg> infeasible' + (counts ? ' (' + counts.infeasible + ')' : '') + '</span>' +
    '<span class="key" style="color:var(--viol,#6b4fb3)"><svg width="18" height="12" aria-hidden="true"><path d="M0 0 L12 12 M6 0 L18 12" stroke="currentColor" stroke-width="1.4" fill="none"/></svg> violates an accepted Lean law' + (counts ? ' (' + counts.violating + ')' : '') + '</span>' +
    '<span class="key">both &rarr; crosshatch</span></div>';
}

// ---------------------------------------------------------------------------------------------
// Table view (the WCAG-clean twin of every chart) and export
// ---------------------------------------------------------------------------------------------
const COLS = ['range_glide_lean_m', 'range_total_m', 'range_glide_longest_m', 'lean_glide_bound_m', 'v_min_m_s', 'v_takeoff_m_s', 'v_glide_min_m_s', 'time_aloft_s', 'time_total_s', 'glides', 'max_height_m', 'climb_below_vmin_s', 'stopped_by'];
const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function tableHtml(res, limit = 400) {
  const axKeys = res.plan.axes.map(a => a.key);
  const rows = res.rows.slice(0, limit);
  return '<table class="sw-tab"><thead><tr>' + axKeys.map(k => '<th>' + escH(k) + '</th>').join('') +
    '<th>feasible</th><th>Lean</th>' + COLS.map(k => '<th>' + escH(k) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr>' + axKeys.map(k => '<td class="n">' + escH(r && r.at ? (typeof r.at[k] === 'number' ? sig(r.at[k]) : r.at[k]) : '') + '</td>').join('') +
      '<td>' + (r && r.feasible ? 'yes' : 'no &mdash; ' + escH((r && r.infeasible_why || []).join('; '))) + '</td>' +
      '<td>' + (r && r.lean_violating ? escH(r.lean_violations.map(v => v.law_id + '/' + v.constraint).join(', ')) : (r && r.lean_violations ? 'none' : '—')) + '</td>' +
      COLS.map(k => '<td class="n">' + escH(typeof (r && r[k]) === 'number' ? sig(r[k]) : (r && r[k] != null ? r[k] : '')) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table>' + (res.rows.length > limit ? '<p class="small mute">' + (res.rows.length - limit) + ' further rows are in the CSV and JSON exports.</p>' : '');
}

export function toCSV(res) {
  const axKeys = res.plan.axes.map(a => a.key);
  const head = axKeys.concat(['feasible', 'infeasible_why', 'lean_violating', 'lean_violations'], COLS);
  const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [head.join(',')];
  for (const r of res.rows) {
    if (!r) { lines.push(head.map(() => '').join(',')); continue; }
    lines.push(axKeys.map(k => q(r.at ? r.at[k] : '')).concat([
      q(r.feasible ? 1 : 0), q((r.infeasible_why || []).join('; ')),
      q(r.lean_violating ? 1 : 0), q((r.lean_violations || []).map(v => v.law_id + '/' + v.constraint).join('; ')),
    ], COLS.map(k => q(r[k]))).join(','));
  }
  return lines.join('\n') + '\n';
}

export function toJSON(res, meta) {
  return JSON.stringify({
    what: 'A parameter sweep of the DELPHI physics-thread flight/glide solver, run from sim/sim-tuner.html.',
    scope: 'EXPLORATORY. A sweep moves parameters off the values params.json sources, so no point except the committed one is a pre-registered test. The comparison targets on the simulator page are second-hand field figures. The Lean verdicts evaluate the same formulas in floating point and are NOT kernel checks. The physiology chain is off in a sweep.',
    generated_at: new Date().toISOString(),
    solver: meta && meta.solver || null,
    plan: { kind: res.plan.kind, axes: res.plan.axes, points: res.rows.length, capped_out: res.capped },
    lean: res.lean,
    metrics: METRICS,
    rows: res.rows.map(r => r && Object.assign({}, r, { lean_state: undefined, hist: undefined })),
  }, null, 1);
}

export function download(name, text, type) {
  const b = new Blob([text], { type: type || 'text/plain' });
  const u = URL.createObjectURL(b), a = document.createElement('a');
  a.href = u; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 0);
}
