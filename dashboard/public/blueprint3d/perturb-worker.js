// perturb-worker.js: the Perturb mode's optimiser, run off the main thread (module worker).
// A small seeded search over the edited parameters the user ticked, inside their bounds. Every candidate is resolved
// by the engine (resolveState), run through the chosen scenario, and judged by the same law checker the panel uses
// (lean-client.js if it answers, else the bundled browser-check.mjs). A candidate that violates an accepted law is
// rejected and reported with the law; one that fails the scenario (survives === false) is never "best".
import { loadEngine, loadLaws, runScenario, metricOf, specFor, judge, hardViolations, newViolations, markInherited, violations, setEditValue, mulberry32, betterSign } from './perturb.js';

self.onmessage = async ev => {
  const m = ev.data;
  try {
    const eng = await loadEngine(m.urls);
    const laws = await loadLaws({ lawClientUrl: m.lawClientUrl, checkerUrl: m.checkerUrl, version: m.lawsetVersion });
    const sc = eng.scenarios.find(s => s.key === m.scenarioKey);
    if (!sc) throw new Error('scenario ' + m.scenarioKey + ' not in the engine');
    const rnd = mulberry32(m.seed >>> 0 || 1);
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const sgn = betterSign(m.better);
    const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
    const x0 = m.vary.map(({ i, lo, hi }) => ({ i, v: clamp(+m.doc.edits[i].value, lo, hi) }));
    // laws the UNEDITED base organism already breaks here are inherited, not caused by the design; by default only a
    // NEW binding violation rejects a candidate (strict: any binding violation does)
    let baseIds = null; if (m.doc.edits && m.doc.edits.length) { const bs = await eng.resolveState({ ...m.doc, edits: [] }, m.age, { ...m.params }); baseIds = new Set(violations(await judge(laws.checker, specFor(eng, bs, m.params, m.species), laws.index)).map(v => v.id)); }
    let best = null;
    for (let k = 0; k < m.n; k++) {
      let x;
      if (k === 0) x = x0;
      else if (!best || rnd() < 0.25) x = m.vary.map(({ i, lo, hi }) => ({ i, v: lo + (hi - lo) * rnd() }));
      else { const shrink = 1 - 0.7 * k / m.n; x = best.x.map(({ i, v }) => { const b = m.vary.find(q => q.i === i); return { i, v: clamp(v + gauss() * 0.15 * (b.hi - b.lo) * shrink, b.lo, b.hi) }; }); }
      let doc = m.doc; for (const { i, v } of x) doc = setEditValue(doc, i, v);
      let state, res;
      try { ({ state, res } = await runScenario(eng, doc, sc, m.params, m.age)); }
      catch (e) { // the engine refused this candidate (e.g. a factor outside partedit's bounds): listed, never best
        self.postMessage({ type: 'cand', cand: { idx: k, x, value: null, survives: null, rejected: true, laws: [{ id: 'engine', domain: 'engine', text: String(e && e.message || e) }], inherited: [], soft: [] }, best }); continue; }
      const met = metricOf(res, m.objective); const value = met && met.value != null && isFinite(met.value) ? +met.value : null;
      const J = markInherited(await judge(laws.checker, specFor(eng, state, m.params, m.species), laws.index), baseIds);
      const hard = m.strict ? hardViolations(J) : newViolations(J);
      const cand = { idx: k, x, value, survives: res.survives ?? null, rejected: hard.length > 0, inRange: !(res.validity && res.validity.inRange === false),
        laws: hard.map(r => ({ id: r.id, domain: r.domain, theorem: r.theorem, text: Object.entries(r.numbers || {}).filter(([, v]) => typeof v === 'number').slice(0, 4).map(([a, b]) => a + ' ' + (+b).toPrecision(3)).join(', ') })),
        inherited: violations(J).filter(r => r.inherited).map(r => r.id), soft: violations(J).filter(r => r.severity !== 'accepted').map(r => ({ id: r.id, severity: r.severity })) };
      if (!cand.rejected && cand.survives !== false && value != null && (!best || sgn * value > sgn * best.value)) best = { x, value, idx: k };
      self.postMessage({ type: 'cand', cand, best });
    }
    self.postMessage({ type: 'done', best });
  } catch (e) { self.postMessage({ type: 'error', message: String(e && e.message || e) }); }
};
