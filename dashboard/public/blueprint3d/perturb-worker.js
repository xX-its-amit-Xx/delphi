// perturb-worker.js: the Perturb mode's optimiser, run off the main thread (module worker).
//
// Same rules and statuses as the engine's optimize (sim-engine/tools/studio.mjs):
//   - the START design (the organism document as it is) is scored first;
//   - a candidate is rejected if it NEWLY violates an accepted (binding) Lean law (strict: any binding violation), if
//     the engine refuses it, if the objective metric is null, or, when a typed DesignSpec is active, if any of the
//     spec's HARD criteria fails or cannot be evaluated at any requested stage (sim-engine/lib/spec.mjs
//     evaluateDesign + explainResult: 'survives' criteria test run.survives, 'feasible' criteria test run.feasible,
//     no-model never counts as met);
//   - status 'ok' only if the best candidate beats the start by more than the tolerance (relative, default 1e-3);
//     'no improvement' (the start design returned unchanged) if nothing beats it; 'no design meets the spec' if
//     neither the start nor any candidate passes. "Apply best" is offered for 'ok' only.
// The search itself is a seeded random-restart hill climb over the ticked edits, inside their bounds.
import { loadEngine, loadLaws, runScenario, metricOf, specFor, judge, hardViolations, newViolations, markInherited, violations, setEditValue, mulberry32, betterSign } from './perturb.js';

self.onmessage = async ev => {
  const m = ev.data;
  try {
    const eng = await loadEngine(m.urls);
    const laws = await loadLaws({ lawClientUrl: m.lawClientUrl, checkerUrl: m.checkerUrl, version: m.lawsetVersion });
    const sc = eng.scenarios.find(s => s.key === m.scenarioKey);
    if (!sc) throw new Error('scenario ' + m.scenarioKey + ' not in the engine');
    const tol = m.tolerance ?? 1e-3;
    const rnd = mulberry32(m.seed >>> 0 || 1);
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const sgn = betterSign(m.better);
    const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

    // hard criteria of a typed spec, judged by the engine's own spec.mjs (never re-implemented here)
    let specLib = null, hardSpec = null, reg = null, specNote = null;
    const hard = ((m.spec && m.spec.criteria) || []).filter(c => c.hard);
    if (hard.length) {
      if (eng.real && eng.mods) {
        specLib = await import(new URL('spec.mjs', m.urls.state).href);
        hardSpec = { ...m.spec, criteria: hard, constraints: { ...(m.spec.constraints || {}), lean: 'must-hold' } };
        reg = specLib.makeRegistry({ scenarios: Object.fromEntries(eng.scenarios.map(s => [s.key, s])), bundle: eng.bundle, organism: eng.mods.om, state: eng.mods.st, runner: eng.mods.sm.runScenario });
      } else specNote = 'the hard criteria could not be checked here (no sim-engine spec.mjs): nothing is reported as meeting them';
    }

    // laws the UNEDITED base organism already breaks are inherited, not caused by the design
    let baseIds = null; if (m.doc.edits && m.doc.edits.length) { const bs = await eng.resolveState({ ...m.doc, edits: [] }, m.age, { ...m.params }); baseIds = new Set(violations(await judge(laws.checker, specFor(eng, bs, m.params, m.species), laws.index)).map(v => v.id)); }

    let n = 0;
    async function evaluateDoc(doc, x, label) {
      const idx = n++;
      const rec = { idx, x, label: label || null, value: null, survives: null, rejected: false, laws: [], inherited: [], soft: [] };
      let state, res;
      try { ({ state, res } = await runScenario(eng, doc, sc, m.params, m.age)); }
      catch (e) { return { ...rec, rejected: true, laws: [{ id: 'engine', domain: 'engine', text: String(e && e.message || e) }] }; }
      const met = metricOf(res, m.objective); rec.value = met && met.value != null && isFinite(met.value) ? +met.value : null;
      rec.survives = res.survives ?? null; rec.inRange = !(res.validity && res.validity.inRange === false);
      const J = markInherited(await judge(laws.checker, specFor(eng, state, m.params, m.species), laws.index), baseIds);
      const broke = m.strict ? hardViolations(J) : newViolations(J);
      rec.inherited = violations(J).filter(r => r.inherited).map(r => r.id); rec.soft = violations(J).filter(r => r.severity !== 'accepted').map(r => ({ id: r.id, severity: r.severity }));
      if (broke.length) { rec.rejected = true; rec.laws = broke.map(r => ({ id: r.id, domain: r.domain, theorem: r.theorem, text: Object.entries(r.numbers || {}).filter(([, v]) => typeof v === 'number').slice(0, 4).map(([a, b]) => a + ' ' + (+b).toPrecision(3)).join(', ') })); return rec; }
      if (res.notRun || res.error) { rec.rejected = true; rec.laws = [{ id: 'scenario', domain: 'engine', text: res.error || 'not run' }]; return rec; }
      if (rec.value == null) { rec.rejected = true; rec.laws = [{ id: 'objective', domain: 'criterion', text: `objective metric ${m.objective} is null or missing` }]; return rec; }
      if (hardSpec) {
        const ex = specLib.explainResult(hardSpec, await specLib.evaluateDesign(hardSpec, doc, reg), { lean: [] });
        if (!ex.meets) { rec.rejected = true; rec.laws = ex.criteria.filter(c => c.verdict !== 'met').map(c => ({ id: c.id, domain: 'criterion', text: `${c.text}: ${c.verdict === 'failed' ? 'failed' : 'cannot be evaluated (counts as not met)'}${c.stages.map(s => s.value != null && typeof s.value === 'number' ? ` · ${s.stage} ${(+s.value).toPrecision(4)}` : s.why ? ` · ${s.stage}: ${s.why}` : '').join('')}` })); return rec; }
      }
      rec.score = sgn * rec.value;
      return rec;
    }
    const post = (cand, best) => self.postMessage({ type: 'cand', cand, best: best ? { x: best.x, value: best.value, idx: best.idx } : null });

    // 1. the start design, unchanged
    const x0 = m.vary.map(({ i }) => ({ i, v: +m.doc.edits[i].value }));
    const start = await evaluateDoc(m.doc, x0, 'start');
    post(start, null);
    const startOk = !start.rejected && start.survives !== false;

    // 2. seeded random-restart hill climb over [lo, hi] per varied edit
    let best = null; const budget = Math.max(2, m.n); const restarts = Math.max(1, Math.min(4, Math.floor((budget - 1) / 6)));
    const perRestart = Math.max(1, Math.floor((budget - 1) / restarts));
    const toX = u => m.vary.map(({ i, lo, hi }, k) => ({ i, v: lo + u[k] * (hi - lo) }));
    const evalU = async u => { const x = toX(u); let doc = m.doc; for (const { i, v } of x) doc = setEditValue(doc, i, v); const r = await evaluateDoc(doc, x); if (!r.rejected && r.survives !== false && (!best || r.score > best.score)) best = r; post(r, best); return r; };
    for (let r = 0; r < restarts && n < budget; r++) {
      let u = m.vary.map(() => rnd()); let cur = await evalU(u); let sigma = 0.25; const stop = Math.min(budget, n + perRestart - 1);
      while (n < stop) {
        const w = u.map(z => clamp(z + sigma * gauss(), 0, 1)); const c = await evalU(w);
        const ok = c && !c.rejected && c.survives !== false; const better = ok && (!cur || cur.rejected || cur.survives === false || c.score > cur.score);
        if (better) { u = w; cur = c; sigma = Math.min(0.5, sigma * 1.3); } else sigma = Math.max(0.01, sigma * 0.8);
      }
    }

    // 3. status, exactly as the engine's optimize
    let status, note = null;
    if (!best && !startOk) { status = 'no design meets the spec'; note = `neither the start design nor any of ${n - 1} candidates passed the laws${hardSpec ? ' and the hard criteria' : ''}`; }
    else if (!best || (startOk && !(best.score - start.score > tol * Math.max(Math.abs(start.score), 1e-12)))) {
      status = 'no improvement'; note = best ? `best candidate ${best.value} does not beat the start ${start.value} by more than ${tol * 100} % (relative); the start design is returned unchanged` : 'no feasible candidate; the start design is returned unchanged';
    } else { status = 'ok'; if (!startOk) note = 'the start design itself does not meet the constraints'; }
    self.postMessage({ type: 'done', status, note, specNote, tolerance: tol, start: { value: start.value, feasible: startOk, laws: start.laws },
      best: status === 'ok' ? { x: best.x, value: best.value, idx: best.idx, improvement: startOk ? best.value - start.value : null } : null });
  } catch (e) { self.postMessage({ type: 'error', message: String(e && e.message || e) }); }
};
