// show.js -- the stage, the narration, the physics montage and the composition for validate-show.
//
// WHAT THIS FILE OWNS: acts 1 (the ask), 2 (the design), 3 (the analogue), 6 (the physics montage) and
// 7 (the verdict), plus the timeline, the transport, the provenance rail and the case selector.
// Acts 4 (molecules) and 5 (networks) are imported from sibling modules through the interface in
// SCENES.md; when a sibling has not landed, its act is rendered as a STATED SKIP, never hidden.
//
// THE CONTENT IS A REAL RUN. Everything drawn here is read out of run-<case>.json, which gen.mjs
// produced by running sim-engine's own validateGeneration() plus eight real scenario runs. There is no
// mock data in this file. Where a value is absent, the page renders a GAP with the validator's own
// reason for it -- that is the design, not a disclaimer.
//
// NOTHING IS HARDCODED TO ONE DESIGN. Every act composes from the run: the changed parameters, the
// anatomy objects those parameters drive (manifest `driven_by_parameters`), the parsed criteria, the
// analogue the validator chose, the ten scales and the five gates. Narration is templated from the data.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { metresPerUnit } from '../blueprint3d/partedit.js';

const MODEL_DIR = '../blueprint3d/model/';
const $ = s => document.querySelector(s);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Numbers are shown at a readable precision and never dressed up. */
function num(v, unit) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  const s = a === 0 ? '0' : a < 0.001 ? v.toExponential(2) : a < 1 ? v.toFixed(3) : a < 100 ? v.toFixed(2) : a < 10000 ? v.toFixed(1) : v.toFixed(0);
  return unit ? `${s} ${unit}` : s;
}
const xfmt = f => (f == null ? '—' : f >= 1 ? `${f.toFixed(2)}x larger` : `${(1 / f).toFixed(2)}x smaller`);

// Status is NEVER colour alone: each state carries a glyph and a word as well.
const SMAP = {
  pass: ['pass', '✓', 'pass'], 'pass-with-gaps': ['pass-with-gaps', '✓', 'pass, with gaps'],
  fail: ['fail', '✕', 'fail'], 'cannot-evaluate': ['na', '◌', 'not assessed'],
  'cannot-assess': ['na', '◌', 'not assessed'], assessed: ['pass', '✓', 'assessed'],
  'not-applicable': ['na', '◌', 'not applicable'],
};
function stBadge(status) {
  const [k, g, w] = SMAP[status] || ['na', '◌', String(status || 'not assessed')];
  const n = el('span', 'st'); n.dataset.s = k;
  n.append(el('span', 'g', g), el('span', null, w));
  return n;
}
const sKind = status => (SMAP[status] || ['na'])[0];

/** A GAP, in its own visual language: hatched, outlined, unfilled, with the reason inside it. */
function gapBox(scale, reason, where) {
  const b = el('div', 'gap');
  b.append(el('div', 'gl', `no data — ${scale}`));
  b.append(el('div', 'gt', reason));
  if (where) b.append(el('div', 'gw', where));
  return b;
}

// ---------------------------------------------------------------------------------------------------
// three.js: ONE copy, created once, handed to every scene including the siblings'.
const loader = new GLTFLoader();
const glbCache = new Map();
const jsonCache = new Map();
const getJSON = u => (jsonCache.has(u) ? jsonCache.get(u) : (jsonCache.set(u, fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null)), jsonCache.get(u)));
const getGLB = u => (glbCache.has(u) ? glbCache.get(u) : (glbCache.set(u, new Promise(res => loader.load(u, g => res(g), () => res(null), () => res(null)))), glbCache.get(u)));

/** A small three.js stage: water below, air above, one fish. Returns helpers an act drives from `t`. */
function makeStage3D(container, { theme }) {
  const w = () => container.clientWidth || 640, h = () => container.clientHeight || 400;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w(), h(), false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, w() / h(), 0.01, 400);
  camera.position.set(0.42, 0.1, 0.78);
  scene.add(new THREE.HemisphereLight(0xcfeaf0, 0x08202a, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1.3, 1.9, 1.1); scene.add(key);
  const rim = new THREE.DirectionalLight(0x76d6e2, 0.7); rim.position.set(-1.2, 0.3, -0.9); scene.add(rim);
  // DECORATIVE: a sea plane so the viewer has a horizon. It carries no measurement and affects no number.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 1, 1), new THREE.MeshStandardMaterial({ color: 0x0d3b46, roughness: .78, metalness: .05, transparent: true, opacity: .62 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.085; scene.add(sea);
  const pivot = new THREE.Group(); scene.add(pivot);
  const onResize = () => { renderer.setSize(w(), h(), false); camera.aspect = w() / h(); camera.updateProjectionMatrix(); };
  return {
    scene, camera, renderer, pivot, sea,
    render() { renderer.render(scene, camera); },
    resize: onResize,
    dispose() {
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => x.dispose?.()); });
      renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove();
    },
  };
}

/** Load a design's mesh and its manifest, scaled to metres with partedit.js's own rule. Returns the
 *  object group plus a name -> mesh index so an act can light up the parts a parameter drives. */
async function loadOrganism(glbName, manifestName) {
  const [g, man] = await Promise.all([getGLB(MODEL_DIR + glbName), getJSON(MODEL_DIR + manifestName)]);
  if (!g) return null;
  const root = g.scene.clone(true);
  const mpu = man ? metresPerUnit(man) : null;
  const byName = new Map();
  root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); byName.set(o.name, o); } });
  // Centre on the body and scale so the fish fills the frame regardless of its real size. The TRUE size
  // in metres is reported in the panel below, from the manifest; the on-screen size is a framing choice.
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  root.position.sub(c);
  const k = 0.52 / Math.max(size.x, 0.001);
  root.scale.setScalar(k);
  return { root, manifest: man, byName, metresPerUnit: mpu, modelSize: size, frameScale: k };
}

/** The anatomy objects a set of changed parameters actually drives, read from the manifest itself.
 *  This is why nothing here says "fin": the mapping is the manifest's own `driven_by_parameters`. */
function objectsDrivenBy(manifest, params) {
  const want = new Set(params);
  const out = [];
  for (const o of manifest?.objects || []) {
    const dv = o.driven_by_parameters || [];
    if (dv.some(p => want.has(p))) out.push({ name: o.object || o.name, label: o.label || o.object, level: o.level, driven_by: dv, ontology: o.ontology_label || null });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// ACT 1 -- THE ASK. The text types in; clauses the validator parsed are underlined, clauses it could not
// parse are struck in red, because those were never checked by anything.
function actAsk(container, { data }) {
  const ask = data.ask || {};
  const text = ask.text || '';
  const crits = ask.criteria || [], unp = ask.unparsed || [];
  const host = el('div'); host.style.cssText = 'position:absolute;inset:0;overflow:auto;padding:68px 16px 16px;display:flex;flex-direction:column;gap:12px';
  container.appendChild(host);

  // Mark up the text: a clause is "parsed" when a criterion quotes it, "unparsed" when the validator
  // listed it. Matching is by the validator's own strings, not by re-parsing here.
  const marks = [];
  for (const c of crits) if (c.source_text || c.text) marks.push({ s: c.source_text || c.text, ok: true });
  for (const u of unp) marks.push({ s: typeof u === 'string' ? u : u.text, ok: false, reason: u?.reason });
  const spans = [];
  let cursor = 0;
  const found = marks.map(m => ({ ...m, at: m.s ? text.toLowerCase().indexOf(String(m.s).toLowerCase().slice(0, 40)) : -1 })).filter(m => m.at >= 0).sort((a, b) => a.at - b.at);
  for (const m of found) {
    if (m.at < cursor) continue;
    if (m.at > cursor) spans.push({ t: text.slice(cursor, m.at) });
    const len = Math.min(String(m.s).length, text.length - m.at);
    spans.push({ t: text.substr(m.at, len), ok: m.ok, reason: m.reason });
    cursor = m.at + len;
  }
  if (cursor < text.length) spans.push({ t: text.slice(cursor) });

  const box = el('div', 'asktext'); host.appendChild(box);
  const nodes = spans.map(s => { const n = el('span', s.ok === true ? 'ok' : s.ok === false ? 'no' : null); n.textContent = ''; box.appendChild(n); return { n, full: s.t }; });
  const critHost = el('div', 'crits'); host.appendChild(critHost);
  const critNodes = [];
  for (const c of crits) {
    const d = el('div', 'crit');
    d.append(el('div', 'ct', `${c.scenario ? `${c.scenario}: ` : ''}${c.source_text || c.text || c.id}`));
    if (c.op || c.metric) d.append(el('div', 'cop', `checked as: ${[c.metric, c.op, c.value, c.unit].filter(x => x != null && x !== '').join(' ')}${c.hard ? ' (hard criterion)' : ''}${c.stages?.length ? ` at ${c.stages.join(', ')}` : ''}`));
    d.hidden = true; critHost.appendChild(d); critNodes.push(d);
  }
  for (const u of unp) {
    const d = el('div', 'crit bad');
    d.append(el('div', 'ct', `NOT parsed, so never checked: "${typeof u === 'string' ? u : u.text}"`));
    if (u?.reason) d.append(el('div', 'cop', u.reason));
    d.hidden = true; critHost.appendChild(d); critNodes.push(d);
  }
  if (!crits.length) {
    const d = el('div'); d.append(gapBox('the request itself', data.case?.function?.not_expressible_statement
      || 'Not one clause of this request became a checkable criterion.', 'pipeline inputs.desired_phenotype.criteria is empty'));
    d.hidden = true; critHost.appendChild(d); critNodes.push(d);
  }

  const total = text.length || 1;
  const TYPE_END = 11, duration = 20;
  const render = t => {
    const frac = reduced() ? 1 : clamp(t / TYPE_END, 0, 1);
    let budget = Math.round(frac * total);
    for (const { n, full } of nodes) { const take = clamp(budget, 0, full.length); n.textContent = full.slice(0, take); budget -= take; }
    const shown = t < TYPE_END + 0.4 ? 0 : Math.ceil(((t - TYPE_END - 0.4) / Math.max(duration - TYPE_END - 1.4, 0.1)) * critNodes.length);
    critNodes.forEach((d, i) => { d.hidden = !(reduced() ? true : i < shown); });
  };
  const nCrit = crits.length, nUn = unp.length;
  return {
    duration, render,
    chapters: [
      { t: 0, label: 'The request', say: `Someone typed this in. ${nCrit ? `The validator turned ${nCrit} part${nCrit > 1 ? 's' : ''} of it into a test.` : 'The validator could not turn any of it into a test.'}` },
      {
        t: TYPE_END + 0.6, label: nCrit ? 'What became a test' : 'Nothing became a test',
        say: nCrit
          ? `Underlined text became a checkable criterion.${nUn ? ` The ${nUn} clause${nUn > 1 ? 's' : ''} struck in red ${nUn > 1 ? 'were' : 'was'} not parsed, so nothing downstream ever checked ${nUn > 1 ? 'them' : 'it'}.` : ''}`
          : `Every clause is struck in red: none could be stated as a test, so no analogue was looked up and nothing was checked. That is not a pass.`,
      },
    ],
    provenance: {
      summary: `The request as typed, parsed by the validator itself. ${nCrit} criterion/criteria, ${nUn} clause(s) unparsed.`,
      verdict: nCrit ? 'measured' : 'absent',
      items: [
        { label: 'the desired-phenotype text', kind: 'supplied', source: 'the input to this run, recorded in run.json ask.text' },
        { label: 'the parse into criteria', kind: 'derived', source: 'sim-engine/validate/pipeline inputs.desired_phenotype.criteria' },
        ...(nUn ? [{ label: `${nUn} unparsed clause(s)`, kind: 'absent', source: 'inputs.desired_phenotype.unparsed_verbatim — never checked by anything' }] : []),
      ],
    },
  };
}

// ---------------------------------------------------------------------------------------------------
// ACT 2 -- THE DESIGN. The organism's own mesh, with the anatomy each changed parameter drives lighting
// up in turn. The part list comes from the manifest, so this works for any design and any parameter.
async function actDesign(container, { data, theme }) {
  const d3 = makeStage3D(container, { theme });
  const des = data.design || {};
  const org = await loadOrganism(des.glb, des.manifest);
  const changed = (data.case?.changed || []).slice();
  // Order the changed parameters by how much they moved, so the biggest change is narrated first.
  changed.sort((a, b) => Math.abs(Math.log(b.factor || 1)) - Math.abs(Math.log(a.factor || 1)));
  const steps = changed.slice(0, 5);

  const legend = el('div'); legend.style.cssText = 'position:absolute;left:14px;right:14px;bottom:12px;z-index:5;display:flex;flex-direction:column;gap:5px;pointer-events:none';
  container.appendChild(legend);
  const mk = (txt, cls) => { const n = el('div', cls); n.style.cssText = 'font:500 12px/1.35 "IBM Plex Mono",monospace;color:#fff;background:rgba(6,26,31,.72);border:1px solid rgba(255,255,255,.17);border-radius:6px;padding:5px 8px;align-self:flex-start;max-width:min(560px,92%)'; n.textContent = txt; return n; };
  const lbl = mk(''); legend.appendChild(lbl);

  const hiMats = [];
  if (org) {
    d3.pivot.add(org.root);
    org.byName.forEach(m => { m.material.transparent = true; });
  }
  // Which meshes does each changed parameter drive? Read from the manifest.
  const perStep = steps.map(c => {
    const objs = org?.manifest ? objectsDrivenBy(org.manifest, [c.parameter]) : [];
    const meshes = objs.map(o => org.byName.get(o.name)).filter(Boolean);
    return { c, objs, meshes };
  });
  for (const s of perStep) for (const m of s.meshes) { if (!hiMats.includes(m)) hiMats.push(m); }

  const PER = 4.6, LEAD = 2.2;
  const duration = Math.max(14, LEAD + steps.length * PER + 3);
  const base = new Map();
  if (org) org.byName.forEach((m, n) => base.set(n, { c: m.material.color.clone(), o: m.material.opacity, e: m.material.emissive?.clone?.() || null }));

  const render = t => {
    if (!org) return;
    const i = clamp(Math.floor((t - LEAD) / PER), -1, steps.length - 1);
    // Reset, then light the active parameter's parts. Pure in t.
    org.byName.forEach((m, n) => {
      const b = base.get(n); if (!b) return;
      m.material.color.copy(b.c); m.material.opacity = i >= 0 ? 0.3 : 1;
      if (m.material.emissive && b.e) m.material.emissive.copy(b.e);
    });
    if (i >= 0 && perStep[i]) {
      const pulse = reduced() ? 1 : 0.62 + 0.38 * Math.sin(((t - LEAD) % PER) * 2.1);
      for (const m of perStep[i].meshes) {
        m.material.opacity = 1;
        if (m.material.emissive) m.material.emissive.setRGB(0.12 * pulse, 0.52 * pulse, 0.56 * pulse);
      }
      const c = perStep[i].c;
      lbl.textContent = `${c.label}  ${num(c.from)} → ${num(c.to)}   (${xfmt(c.factor)})   — ${perStep[i].objs.length} anatomy object(s)`;
    } else lbl.textContent = org.metresPerUnit?.m_per_unit
      ? `${des.name || des.id}  —  standard length ${num(org.manifest?.parameters?.standard_length_m * 100, 'cm')} (from the manifest)`
      : `${des.name || des.id}`;
    d3.pivot.rotation.y = reduced() ? -0.5 : -0.5 + t * 0.082;
    d3.render();
  };

  return {
    duration, render, resize: d3.resize,
    dispose() { d3.dispose(); legend.remove(); },
    chapters: [
      { t: 0, label: 'The body', say: `This is the design: ${des.name || des.id}. ${des.hypothetical ? 'Nothing about it was observed — it was generated from a parameter set.' : ''}` },
      ...steps.map((c, i) => ({
        t: LEAD + i * PER,
        label: c.label,
        say: `The ${c.label} is ${c.direction === 'increase' ? 'enlarged' : c.direction === 'decrease' ? 'reduced' : 'changed'} to ${xfmt(c.factor)} than the base animal's. The parts lighting up are the ones the manifest says this parameter drives.`,
      })),
    ],
    provenance: {
      summary: `The mesh and the anatomy mapping are the design's own manifest; the changed parameters are the validator's difference set against ${des.base_used}.`,
      verdict: des.hypothetical ? 'hypothetical' : 'mixed',
      items: [
        { label: `mesh ${des.glb}`, kind: des.hypothetical ? 'hypothetical' : 'derived', source: `${des.manifest}; built by anatomy-model/parametric/build.py` },
        { label: 'which parts each parameter drives', kind: 'derived', source: `${des.manifest} objects[].driven_by_parameters` },
        { label: 'the changed parameters', kind: 'derived', source: 'validateGeneration differences.entries (base vs generated)' },
        { label: 'real size in metres', kind: org?.metresPerUnit?.m_per_unit ? 'derived' : 'absent', source: org?.metresPerUnit?.source || org?.metresPerUnit?.reason || 'the manifest does not state a scale' },
        { label: 'sea plane, lighting, the slow turn', kind: 'decorative', source: 'drawn to orient the viewer; affects no number' },
      ],
    },
  };
}

// ---------------------------------------------------------------------------------------------------
// ACT 3 -- THE ANALOGUE. FOUR stories, and which one plays is read off the run:
//   (a) an analogue exists and the function was gained   -> fly to it, show WHY (function, not relatedness)
//   (b) the function was LOST (a subtraction)            -> the analogue is the animal that still HAS it
//   (c) no real organism has the function                -> an explicit gap, not a dressed-up analogue
//   (d) the request was never expressible as a test      -> nothing was looked up at all
async function actAnalogue(container, { data, theme }) {
  const an = data.analogue || {}, fn = data.case?.function || {};
  const first = (an.analogues || [])[0] || null;
  const story = fn.not_expressible ? 'not-expressible' : !first ? 'none' : fn.status === 'lost' ? 'lost' : 'exists';

  const host = el('div'); host.style.cssText = 'position:absolute;inset:0;padding:68px 16px 16px;overflow:auto;display:flex;flex-direction:column;gap:11px';
  container.appendChild(host);

  let d3 = null, org = null, ana = null, render, duration = 20, chapters = [], items = [];

  if (story === 'not-expressible' || story === 'none') {
    // No analogue act to play. Render the reason, in the validator's words, as a GAP.
    const g = gapBox(
      story === 'not-expressible' ? 'no analogue was even looked up' : 'no real organism has this function',
      story === 'not-expressible'
        ? (fn.not_expressible_statement || 'The request could not be stated as a test, so no analogue was looked up.')
        : `No organism we are permitted to read satisfies this function, so there is nothing to compare this design against. ${(an.analogues || []).length ? '' : (an.coverage?.note || '')}`,
      story === 'not-expressible' ? 'pipeline inputs.desired_phenotype.criteria is empty' : 'pipeline analogue.analogues is empty');
    g.style.flex = '0 0 auto';
    host.appendChild(g);
    if (story === 'not-expressible') {
      const ul = el('div'); ul.style.cssText = 'display:flex;flex-direction:column;gap:7px';
      for (const u of fn.not_expressible_reasons || []) {
        const d = el('div', 'crit bad');
        d.append(el('div', 'ct', `"${u.text}"`));
        if (u.reason) d.append(el('div', 'cop', u.reason));
        ul.appendChild(d);
      }
      host.appendChild(ul);
    }
    duration = 15;
    render = () => {};
    chapters = [{
      t: 0, label: story === 'not-expressible' ? 'Nothing to compare to' : 'No analogue exists',
      say: story === 'not-expressible'
        ? 'This act normally finds a real animal that already does what was asked. Here there is nothing to find, because the request never became a test. An empty act is the honest result.'
        : 'This act normally flies to a real animal that already does what was asked. For this function there is no such animal we may read, so the act is a marked gap rather than a comparison.',
    }];
    items = [{ label: 'the analogue lookup', kind: 'absent', source: story === 'not-expressible' ? 'no criterion existed to look one up for' : 'analogue.analogues is empty' }];
  } else {
    d3 = makeStage3D(container, { theme });
    const des = data.design || {};
    // The analogue's own mesh when the repo holds one for it; otherwise the act stays with the design and
    // says the analogue has no mesh here rather than drawing a stand-in.
    const anaId = first.id || null;
    const anaGlb = { 'flying-fish': ['flying-fish.glb', 'manifest.json'], 'zebrafish-adult': ['zebrafish-adult.glb', 'manifest-adult.json'] }[anaId] || null;
    [org, ana] = await Promise.all([loadOrganism(des.glb, des.manifest), anaGlb ? loadOrganism(anaGlb[0], anaGlb[1]) : Promise.resolve(null)]);
    if (org) { d3.pivot.add(org.root); org.root.position.x = -0.3; }
    if (ana) { d3.pivot.add(ana.root); ana.root.position.x = 0.3; }

    const cap = el('div'); cap.style.cssText = 'position:absolute;left:14px;right:14px;bottom:12px;z-index:5;display:flex;gap:8px;flex-wrap:wrap;pointer-events:none';
    container.appendChild(cap);
    const tag = t => { const n = el('div'); n.style.cssText = 'font:500 12px/1.35 "IBM Plex Mono",monospace;color:#fff;background:rgba(6,26,31,.74);border:1px solid rgba(255,255,255,.17);border-radius:6px;padding:5px 8px'; n.textContent = t; return n; };
    cap.append(tag(`design: ${data.case?.id}`), tag(ana ? `analogue: ${first.name || anaId}` : `analogue: ${first.name || anaId} (no mesh in this repo)`));

    const C = [0, 5, 10.5, 15.5];
    duration = 21;
    render = t => {
      const camX = reduced() ? 0.05 : t < C[1] ? -0.3 + 0.35 * (t / C[1]) : t < C[2] ? 0.05 + 0.3 * ((t - C[1]) / (C[2] - C[1])) : 0.35;
      d3.camera.position.set(camX, 0.1 + 0.03 * Math.sin(t * 0.3), 0.86);
      d3.camera.lookAt(reduced() ? 0 : clamp((t - C[1]) * 0.07, -0.06, 0.3), 0, 0);
      d3.pivot.rotation.y = reduced() ? -0.4 : -0.4 + t * 0.05;
      d3.render();
    };
    const dist = an.per_criterion?.[0]?.distance || first.distance || null;
    chapters = [
      { t: C[0], label: 'The design', say: `The validator now looks for a real animal that already does what was asked, and it chooses by FUNCTION, not by family tree.` },
      {
        t: C[1], label: `Chosen: ${first.name || anaId}`,
        say: story === 'lost'
          ? `${first.name || anaId} is the animal that still has this ability. The design had it taken away, so the comparison measures what was given up rather than what was gained.`
          : `${first.name || anaId} was chosen because it satisfies the function itself${first.taxon ? ` (${first.taxon})` : ''}. Relatedness played no part in the choice.`,
      },
      { t: C[2], label: 'Why, exactly', say: first.basis || first.why || first.operational || 'The analogue satisfies the operational definition of the function the request asked for.' },
      {
        t: C[3], label: 'What the analogue cannot tell us',
        say: first.data_poor_statement
          ? 'The analogue itself is data-poor, and that limits every requirement taken from it.'
          : 'A parameter moved toward the analogue is not evidence that the function follows. The two distances are reported separately and never combined.',
      },
    ];
    items = [
      { label: `analogue: ${first.name || anaId}`, kind: 'curated', source: first.source || an.chosen_from || 'pipeline analogue.analogues' },
      { label: 'why it was chosen', kind: 'derived', source: 'chosen by function, not relatedness (analogue.rule)' },
      ...(ana ? [{ label: `analogue mesh ${anaGlb[0]}`, kind: 'derived', source: anaGlb[1] }] : [{ label: 'analogue mesh', kind: 'absent', source: 'this repo holds no mesh for the analogue, so none is drawn and no stand-in is used' }]),
      ...(first.data_poor_statement ? [{ label: 'the analogue’s own evidence', kind: 'absent', source: first.data_poor_statement }] : []),
      { label: 'sea plane, lighting, camera move', kind: 'decorative', source: 'drawn to orient the viewer; affects no number' },
    ];
  }

  return {
    duration, render,
    resize: d3?.resize,
    dispose() { d3?.dispose(); host.remove(); container.querySelectorAll(':scope > div').forEach(n => { if (n !== container.firstElementChild) {} }); },
    chapters,
    provenance: { summary: an.rule || 'The analogue is chosen by function, not relatedness.', verdict: story === 'exists' || story === 'lost' ? 'mixed' : 'absent', items },
  };
}

// ---------------------------------------------------------------------------------------------------
// ACT 6 -- PHYSICS, A MONTAGE OF CONDITIONS. The SAME design through eight named conditions, each a real
// scenario run, revealed in sequence, with the ensemble spread where the run produced one.
function actPhysics(container, { data }) {
  const conds = data.conditions || [];
  const ens = data.ensembles || [];
  const gate = data.physics_check || null;
  const standing = (data.standing_checks || []).filter(s => String(s.status || '').toLowerCase().startsWith('fail'));

  const host = el('div'); host.style.cssText = 'position:absolute;inset:0;padding:66px 14px 14px;overflow:auto';
  container.appendChild(host);
  const grid = el('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:8px';
  host.appendChild(grid);

  const cards = conds.map(c => {
    const k = sKind(c.status);
    const d = el('div');
    d.style.cssText = `border:1px solid rgba(255,255,255,.16);border-left:3px ${k === 'na' ? 'dashed' : 'solid'} ${k === 'fail' ? '#ef7a6e' : k === 'na' ? 'rgba(255,255,255,.34)' : '#58c07f'};border-radius:8px;padding:8px 9px;background:${k === 'na' ? 'rgba(255,255,255,.045)' : 'rgba(6,26,31,.56)'};color:#fff;display:flex;flex-direction:column;gap:5px;opacity:0;transition:opacity .35s ease`;
    if (k === 'na') d.style.backgroundImage = 'repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(255,255,255,.1) 6px,rgba(255,255,255,.1) 7px)';
    const h = el('div'); h.style.cssText = 'font:500 13px/1.25 "IBM Plex Sans",sans-serif'; h.textContent = c.label; d.appendChild(h);
    const s = el('div'); s.style.cssText = `font:500 10.5px/1 "IBM Plex Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:${k === 'fail' ? '#ef7a6e' : k === 'na' ? 'rgba(255,255,255,.66)' : '#58c07f'}`;
    const sm = SMAP[c.status] || ['na', '◌', c.status]; s.textContent = `${sm[1]} ${sm[2]}`; d.appendChild(s);
    const key = (c.checks || [])[0];
    if (key) { const v = el('div'); v.style.cssText = 'font:400 11px/1.4 "IBM Plex Mono",monospace;color:rgba(255,255,255,.8)'; v.textContent = `${key.label}: ${num(key.value, key.unit)}`; d.appendChild(v); }
    else if (c.reason) { const v = el('div'); v.style.cssText = 'font:400 10.5px/1.4 "IBM Plex Mono",monospace;color:rgba(255,255,255,.66)'; v.textContent = String(c.reason).slice(0, 120); d.appendChild(v); }
    grid.appendChild(d); return d;
  });

  // The ensemble, drawn as a spread and never as one flattering line.
  let ensNode = null;
  if (ens.length) {
    const e = ens[0];
    ensNode = el('div');
    ensNode.style.cssText = 'margin-top:9px;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:9px 10px;background:rgba(6,26,31,.56);color:#fff;opacity:0;transition:opacity .35s ease';
    const t1 = el('div'); t1.style.cssText = 'font:500 12px/1.3 "IBM Plex Mono",monospace;margin-bottom:6px';
    t1.textContent = `Ensemble, ${e.draws} draws over the stated input distributions — achieved in ${((e.fraction_achieved ?? 0) * 100).toFixed(1)}% of them`;
    ensNode.appendChild(t1);
    const bar = el('div'); bar.style.cssText = 'position:relative;height:24px;border:1px solid rgba(255,255,255,.2);border-radius:5px;overflow:hidden;background:rgba(255,255,255,.05)';
    const frac = e.fraction_achieved ?? 0;
    if (frac <= 0) { const z = el('div'); z.style.cssText = 'position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(239,122,110,.4) 6px,rgba(239,122,110,.4) 7px)'; bar.appendChild(z); }
    else { const f = el('div'); f.style.cssText = `position:absolute;top:0;bottom:0;left:0;width:${(frac * 100).toFixed(1)}%;background:rgba(88,192,127,.42)`; bar.appendChild(f); }
    const lab = el('div'); lab.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;padding:0 8px;font:500 11px/1 "IBM Plex Mono",monospace';
    lab.textContent = frac <= 0 ? `0 of ${e.draws} draws achieved it` : `median ${num(e.median, e.unit)}  ·  5–95% ${num(e.p5)} to ${num(e.p95)}`;
    bar.appendChild(lab); ensNode.appendChild(bar);
    const src = el('div'); src.style.cssText = 'font:400 10.5px/1.45 "IBM Plex Mono",monospace;color:rgba(255,255,255,.62);margin-top:5px';
    src.textContent = `${e.source || 'creatures.js'} · seed ${e.seed || '—'}`;
    ensNode.appendChild(src);
    host.appendChild(ensNode);
  }

  const PER = 2.5, LEAD = 1.3;
  const duration = Math.max(20, LEAD + conds.length * PER + (ensNode ? 5 : 2));
  const render = t => {
    const shown = reduced() ? cards.length : Math.floor((t - LEAD) / PER) + 1;
    cards.forEach((c, i) => { c.style.opacity = i < shown ? '1' : '0'; });
    if (ensNode) ensNode.style.opacity = reduced() || t > LEAD + conds.length * PER ? '1' : '0';
  };

  const nf = conds.filter(c => c.status === 'fail').length;
  const np = conds.filter(c => sKind(c.status) === 'pass').length;
  const nn = conds.filter(c => sKind(c.status) === 'na').length;
  const chapters = [
    { t: 0, label: 'The same design, many conditions', say: `One run tells you almost nothing. The same design is flown through ${conds.length} conditions, each a real scenario run, so you see the envelope instead of one number.` },
    ...conds.map((c, i) => ({
      t: LEAD + i * PER, label: c.label,
      say: `${c.blurb} ${sKind(c.status) === 'na' ? `This one could not be decided at all: ${String(c.reason || '').slice(0, 150)}` : sKind(c.status) === 'fail' ? `It fails${(c.checks || []).find(x => x.status === 'fail') ? ` on ${(c.checks || []).find(x => x.status === 'fail').label.toLowerCase()}` : ''}.` : 'It comes through without a failure.'}`,
    })),
    ...(ensNode ? [{
      t: LEAD + conds.length * PER + 0.3, label: 'The spread, not one line',
      say: `The glide was rerun ${ens[0].draws} times over the stated input distributions. It was achieved in ${((ens[0].fraction_achieved ?? 0) * 100).toFixed(1)}% of them, so the single number above is not a lucky draw.`,
    }] : []),
  ];

  return {
    duration, render,
    dispose() { host.remove(); },
    chapters,
    provenance: {
      summary: `${conds.length} real scenario runs (${np} pass, ${nf} fail, ${nn} not assessable). The montage is NOT the physics gate — the gate is shown in the verdict.`,
      verdict: 'mixed',
      items: [
        { label: `${conds.length} scenario runs`, kind: 'derived', source: 'sim-engine/tools/studio.mjs scenarioRun(), one per condition; parameters recorded per condition in run.json' },
        ...(ens.length ? [{ label: `ensemble, ${ens[0].draws} draws`, kind: 'derived', source: `${ens[0].file || 'creatures.js'}, seed ${ens[0].seed}` }] : [{ label: 'ensemble spread', kind: 'absent', source: 'this run produced no ensemble' }]),
        ...(standing.length ? [{ label: `${standing.length} standing check(s) failing`, kind: 'measured', source: 'reported beside the gate, never folded into it' }] : []),
        ...(nn ? [{ label: `${nn} condition(s) not assessable`, kind: 'absent', source: 'each one’s reason is in the panel below' }] : []),
        { label: 'the card reveal order', kind: 'decorative', source: 'a presentation choice; the conditions are not ranked' },
      ],
    },
  };
}

// ---------------------------------------------------------------------------------------------------
// ACT 7 -- THE VERDICT. The five gates in turn, then the sentence. Never a number as the ending.
function actVerdict(container, { data }) {
  const v = data.verdict || {}, gates = v.gates || [];
  const host = el('div'); host.style.cssText = 'position:absolute;inset:0;padding:66px 14px 14px;overflow:auto;display:flex;flex-direction:column;gap:8px';
  container.appendChild(host);

  const nodes = gates.map(g => {
    const k = sKind(g.status);
    const d = el('div');
    d.style.cssText = `border:1px solid rgba(255,255,255,.16);border-left:3px ${k === 'na' ? 'dashed' : 'solid'} ${k === 'fail' ? '#ef7a6e' : k === 'na' ? 'rgba(255,255,255,.34)' : '#58c07f'};border-radius:8px;padding:9px 11px;background:${k === 'na' ? 'rgba(255,255,255,.045)' : 'rgba(6,26,31,.56)'};color:#fff;opacity:0;transition:opacity .3s ease;display:flex;gap:10px;align-items:flex-start`;
    if (k === 'na') d.style.backgroundImage = 'repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(255,255,255,.1) 6px,rgba(255,255,255,.1) 7px)';
    const sm = SMAP[g.status] || ['na', '◌', g.status];
    const s = el('div'); s.style.cssText = `font:500 10.5px/1.5 "IBM Plex Mono",monospace;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;color:${k === 'fail' ? '#ef7a6e' : k === 'na' ? 'rgba(255,255,255,.7)' : '#58c07f'}`;
    s.textContent = `${sm[1]} ${sm[2]}`;
    const txt = el('div'); txt.style.minWidth = '0';
    const n1 = el('div'); n1.style.cssText = 'font:500 13.5px/1.3 "IBM Plex Sans",sans-serif'; n1.textContent = g.label; txt.appendChild(n1);
    const n2 = el('div'); n2.style.cssText = 'font:400 11.5px/1.45 "IBM Plex Mono",monospace;color:rgba(255,255,255,.78);margin-top:3px;overflow-wrap:anywhere';
    n2.textContent = String(g.why || '').slice(0, 260); txt.appendChild(n2);
    d.append(s, txt); host.appendChild(d); return d;
  });

  const sent = el('div');
  sent.style.cssText = 'margin-top:5px;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:11px 13px;background:rgba(6,26,31,.72);color:#fff;font:300 clamp(15px,2.1vw,19px)/1.42 "Newsreader",Georgia,serif;opacity:0;transition:opacity .4s ease';
  const withheld = v.word_validated_withheld;
  sent.textContent = (withheld ? 'The word "validated" is withheld. ' : '') + String(v.sentence || '').split('. ').slice(-3).join('. ');
  host.appendChild(sent);

  const PER = 2.3, LEAD = 1;
  const duration = Math.max(18, LEAD + gates.length * PER + 6);
  const render = t => {
    const shown = reduced() ? gates.length : Math.floor((t - LEAD) / PER) + 1;
    nodes.forEach((n, i) => { n.style.opacity = i < shown ? '1' : '0'; });
    sent.style.opacity = reduced() || t > LEAD + gates.length * PER + 0.4 ? '1' : '0';
  };

  const npass = gates.filter(g => sKind(g.status) === 'pass').length;
  const nfail = gates.filter(g => sKind(g.status) === 'fail').length;
  const nna = gates.filter(g => sKind(g.status) === 'na').length;
  return {
    duration, render,
    dispose() { host.remove(); },
    chapters: [
      { t: 0, label: 'Five gates', say: `Validation here is five separate gates. ${npass} passed, ${nfail} failed, and ${nna} could not be assessed at all — which is a different thing from passing.` },
      ...gates.map((g, i) => ({
        t: LEAD + i * PER, label: g.label,
        say: `${g.label}: ${sKind(g.status) === 'na' ? 'not assessed. ' : sKind(g.status) === 'fail' ? 'failed. ' : 'passed. '}${String(g.why || '').replace(/^(CANNOT ASSESS|FAIL):\s*/i, '').slice(0, 190)}`,
      })),
      { t: LEAD + gates.length * PER + 0.6, label: 'The verdict', say: withheld ? 'The word "validated" is withheld, and the reason is named rather than implied.' : 'The verdict is a sentence, because a number here would hide which gates never ran.' },
    ],
    provenance: {
      summary: `The five gates and the verdict sentence are the validator's own, verbatim. ${nna} gate(s) could not be assessed.`,
      verdict: nna ? 'mixed' : 'measured',
      items: [
        ...gates.map(g => ({ label: g.label, kind: sKind(g.status) === 'na' ? 'absent' : 'derived', source: `set by ${g.gate_set_by || 'the pipeline'}` })),
        { label: 'the verdict sentence', kind: 'derived', source: 'validateGeneration verdict.statement, not rewritten here' },
      ],
    },
  };
}

// ---------------------------------------------------------------------------------------------------
// ACTS 4 & 5 -- the sibling scenes, through the SCENES.md interface. A sibling that has not landed, or
// that declines this case, becomes a STATED SKIP: visible in the timeline with its reason.
async function actSibling(container, ctx, mod, name, what) {
  let m = null, err = null;
  try { m = await import(`./${mod}`); } catch (e) { err = e; }
  if (!m || typeof m.mountScene !== 'function') {
    return {
      skip: true,
      reason: err
        ? `${mod} has not landed yet, so this act has nothing to play. ${what} is therefore not shown anywhere on this page.`
        : `${mod} loaded but exports no mountScene(), so it does not meet the interface in SCENES.md.`,
      detail: err ? String(err.message || err).slice(0, 180) : null,
    };
  }
  let s;
  try {
    s = await m.mountScene({
      container, THREE, data: ctx.data, act: name, theme: ctx.theme,
      reducedMotion: reduced(), onReady: () => {}, onNote: n => ctx.onNote?.(n, name),
    });
  } catch (e) {
    return { skip: true, reason: `${mod} threw while mounting, so this act is empty rather than wrong.`, detail: String(e.message || e).slice(0, 180) };
  }
  if (!s) return { skip: true, reason: `${mod} returned nothing from mountScene().` };
  if (s.skip) return { skip: true, reason: s.reason || `${mod} declined this case without giving a reason.`, scene: s };
  return { scene: s, external: true };
}

// ---------------------------------------------------------------------------------------------------
// THE ACT SET
const ACTS = [
  { id: 'ask', no: 1, title: 'The ask', mount: (c, x) => actAsk(c, x) },
  { id: 'design', no: 2, title: 'The design', mount: (c, x) => actDesign(c, x) },
  { id: 'analogue', no: 3, title: 'The analogue', mount: (c, x) => actAnalogue(c, x) },
  { id: 'molecules', no: 4, title: 'Molecules', sibling: ['molecular.js', 'molecules', 'The molecular scale'] },
  { id: 'networks', no: 5, title: 'Networks and development', sibling: ['networks.js', 'networks', 'Gene regulation, pathways, metabolism and development'] },
  { id: 'physics', no: 6, title: 'Physics, condition by condition', mount: (c, x) => actPhysics(c, x) },
  { id: 'verdict', no: 7, title: 'The verdict', mount: (c, x) => actVerdict(c, x) },
];

// ---------------------------------------------------------------------------------------------------
// THE STAGE
const S = {
  runs: null, data: null, caseId: null, acts: [], cur: -1, scene: null,
  t: 0, playing: false, raf: 0, last: 0, notes: [],
};

function theme() { return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }

async function boot() {
  const runs = await getJSON('./runs.json');
  if (!runs) { $('#stageinner').innerHTML = '<div class="loading">runs.json is missing &mdash; run <code>node dashboard/public/validate-show/gen.mjs</code></div>'; return; }
  S.runs = runs;
  // Case from the URL, else the headline case, else the first.
  const want = new URLSearchParams(location.search).get('case');
  const pick = runs.cases.find(c => c.case === want) || runs.cases.find(c => c.headline) || runs.cases[0];
  buildCaseButtons();
  await loadCase(pick.case, false);
  wire();
  // Deep link to an act: ?case=tff&act=6 or #physics
  const qa = new URLSearchParams(location.search).get('act');
  const hash = location.hash.replace(/^#/, '');
  const byId = S.acts.findIndex(a => a.id === hash);
  const idx = qa ? clamp(parseInt(qa, 10) - 1, 0, S.acts.length - 1) : byId >= 0 ? byId : 0;
  await gotoAct(idx);
}

function buildCaseButtons() {
  const host = $('#cases');
  for (const c of S.runs.cases) {
    const b = el('button', 'case-b'); b.type = 'button';
    const kindWord = { 'morphological-addition': 'add', 'morphological-subtraction': 'remove', 'functional-addition': 'new ability', 'functional-subtraction': 'lost ability', blend: 'blend', 'morphological-mixed': 'mixed' }[c.kind] || c.kind;
    b.append(el('span', null, (c.name || c.case).split(' - ')[0].replace(/^(a|the)\s+/i, '')), el('span', 'k', kindWord));
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => loadCase(c.case, true).then(() => gotoAct(0)));
    b.dataset.case = c.case;
    host.appendChild(b);
  }
}

async function loadCase(id, push) {
  const row = S.runs.cases.find(c => c.case === id);
  const d = await getJSON(`./${row.file}`);
  if (!d) return;
  S.data = d; S.caseId = id; S.notes = [];
  document.querySelectorAll('.case-b').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.case === id)));
  if (push) { const u = new URL(location); u.searchParams.set('case', id); u.searchParams.delete('act'); history.replaceState(null, '', u); }
  renderMeta();
  // Rebuild the act list for this case. Sibling acts are resolved lazily at mount.
  S.acts = ACTS.map(a => ({ ...a, dur: null, skip: null }));
  await teardown();
  S.cur = -1;
  renderScrub();
  renderBelow();
  renderFoot();
  return d;
}

function renderMeta() {
  const d = S.data, m = d.meta || {};
  const host = $('#runmeta'); host.innerHTML = '';
  const chip = (k, v) => { const c = el('span', 'chip'); c.append(el('b', null, k + ' '), document.createTextNode(v)); return c; };
  const g = d.verdict?.gates || [];
  host.append(
    chip('design', d.case?.name?.split(' - ')[0] || d.case?.id),
    chip('case', (d.case?.kind || '').replace(/-/g, ' ')),
    chip('ran', (m.generated_at || '').replace('T', ' ').slice(0, 16) + ' UTC'),
    chip('validator', m.pipeline || '?'),
    chip('gates', `${g.filter(x => sKind(x.status) === 'pass').length} pass / ${g.filter(x => sKind(x.status) === 'fail').length} fail / ${g.filter(x => sKind(x.status) === 'na').length} not assessed`),
    chip('gaps rendered', String((d.gaps || []).length)),
  );
  $('#lede').textContent = `${d.case?.name || d.case?.id}. ${d.case?.kind_derived_from || ''}`;
}

// ---- act mounting -------------------------------------------------------------------------------
async function teardown() {
  if (S.scene?.dispose) { try { S.scene.dispose(); } catch {} }
  S.scene = null;
  $('#stageinner').innerHTML = '';
}

async function mountAct(i) {
  const a = S.acts[i];
  await teardown();
  const host = $('#stageinner');
  host.innerHTML = '';
  $('#actno').textContent = `Act ${a.no} of ${S.acts.length}`;
  $('#stagetitle').textContent = a.title;
  const ctx = { data: S.data, theme: theme(), onNote: (n, who) => { S.notes.push({ ...n, who }); renderRail(S.scene, a); } };

  let scene = null;
  if (a.sibling) {
    const r = await actSibling(host, ctx, ...a.sibling);
    if (r.skip) {
      a.skip = r.reason;
      host.innerHTML = '';
      const wrapn = el('div'); wrapn.style.cssText = 'position:absolute;inset:0;padding:68px 16px 16px;display:flex;flex-direction:column;gap:10px;overflow:auto';
      wrapn.appendChild(gapBox(`act ${a.no} not shown`, r.reason, r.detail || `expected ./${a.sibling[0]} exporting mountScene(), per SCENES.md`));
      host.appendChild(wrapn);
      scene = {
        duration: 9, render: () => {}, dispose: () => wrapn.remove(),
        chapters: [{ t: 0, label: 'This act is empty', say: r.reason }],
        provenance: { summary: 'This act has no scene to play.', verdict: 'absent', items: [{ label: `act ${a.no}`, kind: 'absent', source: r.reason }] },
      };
    } else scene = r.scene;
  } else {
    scene = await a.mount(host, ctx);
  }
  a.dur = Math.max(2, scene.duration || 18);
  S.scene = scene;
  S.cur = i;
  renderScrub();
  renderRail(scene, a);
  if (scene.seek) scene.seek(0); else scene.render?.(0);
  highlightBelow(a.id);
  return scene;
}

async function gotoAct(i, atT = 0) {
  i = clamp(i, 0, S.acts.length - 1);
  if (i !== S.cur) await mountAct(i);
  S.t = atT;
  applyT();
  const u = new URL(location); u.searchParams.set('act', String(S.acts[i].no)); history.replaceState(null, '', u);
}

// ---- the timeline -------------------------------------------------------------------------------
const actDur = a => a.dur ?? 18;
function totalKnown() { return S.acts.reduce((s, a) => s + actDur(a), 0); }

function applyT() {
  const a = S.acts[S.cur]; if (!a || !S.scene) return;
  const d = actDur(a);
  S.t = clamp(S.t, 0, d);
  if (S.scene.seek) S.scene.seek(S.t); else S.scene.render?.(S.t);
  // narration: the latest chapter at or before t
  const ch = (S.scene.chapters || []).filter(c => c.t <= S.t + 1e-6).pop() || (S.scene.chapters || [])[0];
  $('#chap').textContent = ch ? `Act ${a.no} · ${ch.label || ''}` : `Act ${a.no}`;
  $('#say').textContent = ch ? (ch.say || ch.label || '') : '';
  $('#tnow').textContent = `${fmtT(S.t)} / ${fmtT(d)}  · act ${a.no}/${S.acts.length}`;
  const sc = $('#scrub');
  $('#playhead').style.left = `${((S.cur + S.t / d) / S.acts.length) * 100}%`;
  sc.setAttribute('aria-valuenow', String(Math.round(((S.cur + S.t / d) / S.acts.length) * 100)));
  sc.setAttribute('aria-valuetext', `Act ${a.no}, ${a.title}, ${fmtT(S.t)} of ${fmtT(d)}`);
  document.querySelectorAll('#chapjump .cj').forEach((b, i) => b.setAttribute('aria-pressed', String(ch && Number(b.dataset.t) === ch.t)));
  document.querySelectorAll('.seg').forEach((s, i) => { s.dataset.on = i === S.cur ? '1' : '0'; });
}

function renderScrub() {
  const sc = $('#scrub');
  sc.querySelectorAll('.seg,.tick').forEach(n => n.remove());
  const w = 100 / S.acts.length;
  S.acts.forEach((a, i) => {
    const s = el('div', 'seg');
    s.style.left = `${i * w}%`; s.style.width = `${w}%`;
    s.dataset.on = i === S.cur ? '1' : '0';
    if (a.skip) s.dataset.skip = '1';
    s.append(el('span', null, `${a.no}. ${a.title}${a.skip ? ' (empty)' : ''}`));
    s.addEventListener('click', ev => { ev.stopPropagation(); gotoAct(i, 0); });
    sc.appendChild(s);
  });
  // chapter ticks for the current act
  const a = S.acts[S.cur];
  if (a && S.scene?.chapters) for (const c of S.scene.chapters) {
    const t = el('div', 'tick');
    t.style.left = `${((S.cur + (c.t / actDur(a))) / S.acts.length) * 100}%`;
    sc.appendChild(t);
  }
  // chapter jump buttons
  const cj = $('#chapjump'); cj.innerHTML = '';
  for (const c of S.scene?.chapters || []) {
    const b = el('button', 'cj'); b.type = 'button'; b.textContent = c.label || `${c.t}s`; b.dataset.t = c.t;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { S.t = c.t; applyT(); });
    cj.appendChild(b);
  }
}

function renderRail(scene, a) {
  const p = scene?.provenance;
  $('#pvsum').textContent = p?.summary || 'This act declared no provenance.';
  const ul = $('#pvlist'); ul.innerHTML = '';
  for (const it of p?.items || []) {
    const li = el('li');
    const k = el('span', 'kind'); k.dataset.k = (it.kind || 'unstated').toLowerCase(); k.textContent = it.kind || 'unstated';
    const t = el('span', 't'); t.append(el('b', null, it.label || '')); if (it.source) t.append(el('i', null, it.source));
    li.append(k, t); ul.appendChild(li);
  }
  if (!p?.items?.length) { const li = el('li'); li.append(el('span', 'kind', 'unstated'), el('span', 't', 'no provenance declared for this act')); ul.appendChild(li); }
  for (const n of S.notes.filter(n => n.who === a.id || !n.who)) {
    const li = el('li'); const k = el('span', 'kind'); k.dataset.k = 'absent'; k.textContent = n.severity || 'note';
    const t = el('span', 't'); t.append(el('b', null, n.title || 'note')); if (n.text) t.append(el('i', null, n.text));
    li.append(k, t); ul.appendChild(li);
  }
  const rv = $('#railverdict');
  if (p?.verdict) { rv.hidden = false; rv.innerHTML = ''; rv.append(el('b', null, 'what this act rests on'), document.createTextNode(p.verdict === 'absent' ? 'nothing: this act has no data of its own' : p.verdict)); }
  else rv.hidden = true;
}

// ---- transport ----------------------------------------------------------------------------------
function tick(now) {
  if (!S.playing) return;
  const dt = Math.min((now - S.last) / 1000, 0.2); S.last = now;
  const a = S.acts[S.cur];
  S.t += dt;
  if (S.t >= actDur(a)) {
    if (S.cur < S.acts.length - 1) { gotoAct(S.cur + 1, 0).then(() => { if (S.playing) { S.last = performance.now(); S.raf = requestAnimationFrame(tick); } }); return; }
    S.t = actDur(a); setPlaying(false); applyT(); return;
  }
  applyT();
  S.raf = requestAnimationFrame(tick);
}
function setPlaying(on) {
  S.playing = on;
  $('#playb').textContent = on ? 'Pause' : 'Play';
  cancelAnimationFrame(S.raf); S.raf = 0;
  if (on) { S.last = performance.now(); S.raf = requestAnimationFrame(tick); S.scene?.play?.(S.t); }
  else S.scene?.pause?.();
}

function wire() {
  $('#playb').addEventListener('click', () => setPlaying(!S.playing));
  $('#nextb').addEventListener('click', () => gotoAct(S.cur + 1, 0));
  $('#prevb').addEventListener('click', () => gotoAct(S.cur - 1, 0));
  $('#restartb').addEventListener('click', () => gotoAct(0, 0));
  const sc = $('#scrub');
  const seekFromX = cx => {
    const r = sc.getBoundingClientRect();
    const f = clamp((cx - r.left) / r.width, 0, 0.99999);
    const i = Math.floor(f * S.acts.length);
    const within = (f * S.acts.length - i) * actDur(S.acts[i]);
    if (i !== S.cur) gotoAct(i, within); else { S.t = within; applyT(); }
  };
  sc.addEventListener('pointerdown', e => { sc.setPointerCapture(e.pointerId); seekFromX(e.clientX); });
  sc.addEventListener('pointermove', e => { if (sc.hasPointerCapture(e.pointerId)) seekFromX(e.clientX); });
  sc.addEventListener('keydown', e => {
    const d = actDur(S.acts[S.cur]);
    if (e.key === 'ArrowRight') { S.t = Math.min(d, S.t + 1); applyT(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { S.t = Math.max(0, S.t - 1); applyT(); e.preventDefault(); }
  });
  addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'k') { setPlaying(!S.playing); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'j') { const d = actDur(S.acts[S.cur]); S.t = Math.min(d, S.t + 2); applyT(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'h') { S.t = Math.max(0, S.t - 2); applyT(); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'n') { gotoAct(S.cur + 1, 0); e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'p') { gotoAct(S.cur - 1, 0); e.preventDefault(); }
    else if (/^[1-7]$/.test(e.key)) { gotoAct(Number(e.key) - 1, 0); e.preventDefault(); }
  });
  const tb = $('#themeb');
  const setTheme = t => {
    document.documentElement.dataset.theme = t;
    tb.textContent = t === 'dark' ? 'Light' : 'Dark';
    tb.setAttribute('aria-pressed', String(t === 'dark'));
    S.scene?.setTheme?.(t);
  };
  tb.addEventListener('click', () => setTheme(theme() === 'dark' ? 'light' : 'dark'));
  tb.textContent = theme() === 'dark' ? 'Light' : 'Dark';
  addEventListener('resize', () => S.scene?.resize?.());
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.playing) setPlaying(false); });
}

// ---------------------------------------------------------------------------------------------------
// BELOW THE STAGE: the full detail, always present and readable without playing anything.
function pan(id, title) { const p = el('section', 'pan'); p.id = `p-${id}`; p.append(el('h2', null, title)); const b = el('div', 'body'); p.appendChild(b); return [p, b]; }
function highlightBelow(id) {
  document.querySelectorAll('.pan').forEach(p => { p.style.outline = p.id === `p-${id}` ? '2px solid var(--accent)' : 'none'; p.style.outlineOffset = '1px'; });
}

function renderBelow() {
  const d = S.data, host = $('#below'); host.innerHTML = '';

  // --- 1 the ask
  {
    const [p, b] = pan('ask', 'Act 1 · the request, and what became a test');
    const a = d.ask || {};
    b.append(el('div', 'asktext', a.text || ''));
    const cw = el('div', 'crits');
    for (const c of a.criteria || []) {
      const x = el('div', 'crit'); x.append(el('div', 'ct', `${c.scenario || 'criterion'}: "${c.source_text || c.text}"`));
      x.append(el('div', 'cop', `${[c.metric, c.op, c.value, c.unit].filter(v => v != null && v !== '').join(' ') || 'feasibility'}${c.hard ? ' · hard criterion' : ''}${c.stages?.length ? ` · ${c.stages.join(', ')}` : ''}`));
      cw.appendChild(x);
    }
    for (const u of a.unparsed || []) {
      const x = el('div', 'crit bad'); x.append(el('div', 'ct', `NOT parsed — never checked: "${typeof u === 'string' ? u : u.text}"`));
      if (u?.reason) x.append(el('div', 'cop', u.reason)); cw.appendChild(x);
    }
    if (!(a.criteria || []).length) cw.appendChild(gapBox('the request itself', d.case?.function?.not_expressible_statement || 'No clause became a checkable criterion.', 'inputs.desired_phenotype.criteria is empty'));
    b.append(cw, el('div', 'src', a.rule || ''));
    host.appendChild(p);
  }

  // --- 2 the design + the difference set
  {
    const [p, b] = pan('design', 'Act 2 · the design, and how it differs from its base');
    const c = d.case || {};
    b.append(el('p', null, c.kind_derived_from || ''));
    const dl = el('div', 'diffs');
    const list = (c.changed || []).slice().sort((x, y) => Math.abs(Math.log(y.factor || 1)) - Math.abs(Math.log(x.factor || 1)));
    for (const ch of list.slice(0, 12)) {
      const r = el('div', 'diff');
      const n = el('div', 'dn'); n.append(el('b', null, ch.label || ch.parameter));
      n.append(el('i', null, `${ch.parameter}${ch.part ? ` · ${ch.part}` : ''} · ${ch.kind || 'kind not stated'}${ch.source ? ` — ${String(ch.source).slice(0, 150)}` : ''}`));
      const v = el('div', 'dv');
      v.append(el('s', null, num(ch.from)), document.createTextNode(' → '), el('em', null, num(ch.to)));
      if (ch.factor != null) v.append(el('div', null, xfmt(ch.factor)));
      r.append(n, v); dl.appendChild(r);
    }
    if (list.length > 12) dl.append(el('div', 'src', `${list.length - 12} further changed parameter(s) not listed here; all of them are in run-${d.case?.id}.json differences.entries.`));
    b.appendChild(dl);
    if (d.design?.morphological_not_genetic) {
      const w = el('div', 'limit');
      w.append(el('b', null, 'this is a shape, not an organism'), document.createTextNode(d.design.morphological_not_genetic));
      b.appendChild(w);
    }
    if (d.meta?.base_note) { const w = el('div', 'limit'); w.append(el('b', null, 'what the comparison cannot see'), document.createTextNode(d.meta.base_note)); b.appendChild(w); }
    b.append(el('div', 'src', `mesh ${d.design?.glb} · manifest ${d.design?.manifest} · base ${d.design?.base_used}`));
    host.appendChild(p);
  }

  // --- 3 the analogue
  {
    const [p, b] = pan('analogue', 'Act 3 · the functional analogue');
    const an = d.analogue || {}, fn = d.case?.function || {};
    if (fn.not_expressible) b.appendChild(gapBox('no analogue was looked up', fn.not_expressible_statement, 'no criterion existed to look one up for'));
    else if (!(an.analogues || []).length) b.appendChild(gapBox('no real organism has this function', an.coverage?.note || 'The validator found no organism it may read that satisfies this function.', 'analogue.analogues is empty'));
    else for (const a of an.analogues) {
      const x = el('div', 'crit');
      x.append(el('div', 'ct', `${a.name || a.id}${a.taxon ? ` — ${a.taxon}` : ''}`));
      x.append(el('div', 'cop', a.basis || a.why || a.operational || ''));
      if (a.source) x.append(el('div', 'src', String(a.source)));
      if (a.data_poor_statement) { const g = gapBox('the analogue’s own evidence', a.data_poor_statement, 'analogue registry data_poor_statement'); x.appendChild(g); }
      b.appendChild(x);
    }
    if (fn.status === 'lost') { const w = el('div', 'limit'); w.append(el('b', null, 'the question is inverted here'), document.createTextNode('This design had the ability taken away, so the analogue is the animal that still has it. The comparison measures what was given up, not what was gained.')); b.appendChild(w); }
    b.append(el('div', 'src', an.rule || ''));
    host.appendChild(p);
  }

  // --- 6 the montage
  {
    const [p, b] = pan('physics', `Act 6 · ${(d.conditions || []).length} conditions, each a real scenario run`);
    const cw = el('div', 'conds');
    for (const c of d.conditions || []) {
      const x = el('div', 'cond'); x.dataset.s = sKind(c.status); x.dataset.cond = c.key;
      x.append(el('h4', null, c.label));
      const sr = el('div'); sr.appendChild(stBadge(c.status)); x.appendChild(sr);
      x.append(el('div', 'bl', c.blurb || ''));
      if ((c.checks || []).length) {
        const ul = el('ul', 'ck');
        for (const k of c.checks) {
          const li = el('li');
          const sm = SMAP[k.status] || ['na', '◌', k.status];
          li.append(el('span', null, sm[1]));
          const t = el('span'); t.append(el('span', 'm', `${k.label}: ${num(k.value, k.unit)}`));
          if (k.requirement) t.append(el('span', 'req', `needs: ${k.requirement}`));
          li.appendChild(t); ul.appendChild(li);
        }
        x.appendChild(ul);
      } else x.appendChild(gapBox(`condition: ${c.label}`, c.reason || 'this scenario produced no check that could be decided for this organism', `sim-engine/scenarios/${c.scenario}.mjs`));
      x.append(el('div', 'src', `scenario ${c.scenario} · ${Object.entries(c.params_sent || {}).map(([k, v]) => `${k}=${v}`).join(' ') || 'defaults'}`));
      cw.appendChild(x);
    }
    b.appendChild(cw);

    // the ensemble
    if ((d.ensembles || []).length) {
      const ew = el('div', 'ens');
      ew.append(el('div', 'src', 'The ensemble reruns the same criterion over the stated input distributions, so a single flattering line cannot stand for the design.'));
      for (const e of d.ensembles) {
        const row = el('div', 'ensrow');
        const bar = el('div', 'ensbar');
        const frac = e.fraction_achieved ?? 0;
        if (frac <= 0) bar.appendChild(el('div', 'zero'));
        else { const f = el('div', 'fillpart'); f.style.width = `${(frac * 100).toFixed(1)}%`; bar.appendChild(f); }
        const lab = el('div', 'lab');
        lab.textContent = frac <= 0
          ? `${e.scenario} / ${e.stage}: achieved in 0 of ${e.draws} draws`
          : `${e.scenario} / ${e.stage}: achieved in ${(frac * 100).toFixed(1)}% of ${e.draws} · median ${num(e.median, e.unit)} · 5–95% ${num(e.p5)}–${num(e.p95)}`;
        bar.appendChild(lab); row.appendChild(bar);
        row.append(el('div', 'src', `${e.source || ''} ${e.file || ''} · seed ${e.seed || '—'}${e.species_gate?.note ? ` · ${String(e.species_gate.note).slice(0, 200)}` : ''}`));
        ew.appendChild(row);
      }
      b.appendChild(ew);
    } else b.appendChild(gapBox('ensemble spread', 'This run produced no ensemble, so there is no spread to show and the single values above stand alone.', 'physics_check criteria carried no ensemble'));

    // the gate itself, and the standing checks beside it
    const gw = el('div');
    const gq = d.physics_check || {};
    gw.append(el('div', 'src', `The montage above is NOT the physics gate. The gate is: ${gq.status || 'not reported'} — ${String(gq.gate || '').slice(0, 400)}`));
    b.appendChild(gw);
    for (const s of d.standing_checks || []) {
      if (!String(s.status || '').toLowerCase().startsWith('fail')) continue;
      const w = el('div', 'limit'); w.append(el('b', null, `standing check failed: ${s.id || ''}`), document.createTextNode(s.statement || ''));
      b.appendChild(w);
    }
    // The 3D flight simulator, where this design can be driven through the real solver.
    const det = el('details'); det.style.cssText = 'border:1px solid var(--line);border-radius:8px;padding:9px 11px';
    det.append(el('summary', null, 'Open the 3D flight simulator on this design (loads the physics thread’s own page)'));
    const ifr = el('iframe', 'sim'); ifr.loading = 'lazy'; ifr.title = 'DELPHI flight simulator';
    ifr.src = `../t/physics/sim/?theme=${theme()}`;
    det.append(el('div', 'src', 'The simulator is the physics thread’s own page, embedded through its EMBED.md contract. Read its validation banner: parameters supplied at run time make a run exploratory, not a pre-registered test.'), ifr);
    b.appendChild(det);
    host.appendChild(p);
  }

  // --- the scale ladder (what was reached at all) + 7 the verdict
  {
    const [p, b] = pan('verdict', 'Act 7 · the five gates, the ten scales, and the verdict');
    const gw = el('div', 'gates');
    for (const g of d.verdict?.gates || []) {
      const x = el('div', 'gate'); x.dataset.s = sKind(g.status);
      const sb = el('div'); sb.appendChild(stBadge(g.status));
      const t = el('div');
      t.append(el('div', 'gn', g.label), el('div', 'gy', g.why || ''));
      if (g.gate_set_by) t.append(el('div', 'by', `gate set by: ${g.gate_set_by}`));
      x.append(sb, t); gw.appendChild(x);
    }
    b.appendChild(gw);

    b.append(el('div', 'src', 'The ten scales the validator tried to reach. A hatched rung is a scale with no data, and it carries the reason rather than being left out.'));
    const lw = el('div', 'ladder');
    for (const s of d.scales || []) {
      const r = el('div', 'rung'); r.dataset.a = s.assessable ? '1' : '0';
      const sn = el('div', 'sn');
      sn.append(el('span', null, s.label));
      sn.appendChild(stBadge(s.assessable ? 'assessed' : 'cannot-assess'));
      const why = el('div', 'why');
      if (s.assessable) {
        why.append(document.createTextNode(`${s.n_known} item(s) known at this scale${s.coverage?.genes_swept != null ? `; ${s.coverage.genes_swept} gene(s) swept` : ''}.`));
        if ((s.unknown || []).length) why.append(el('span', 'q', `Still unknown: ${s.unknown[0]}`));
      } else {
        why.append(document.createTextNode('No data at this scale. The validator’s reason:'));
        why.append(el('span', 'q', (s.unknown || [])[0] || 'no reason given'));
      }
      r.append(sn, why); lw.appendChild(r);
    }
    b.appendChild(lw);

    if (d.verdict?.word_validated_withheld) {
      const w = el('div', 'withheld'); w.append(el('b', null, 'the word "validated" is withheld'),
        document.createTextNode('Not every gate passed, and some never ran. A gate that could not be assessed is not a gate that passed.'));
      b.appendChild(w);
    }
    b.append(el('p', 'vsent', d.verdict?.sentence || ''));
    host.appendChild(p);
  }

  // --- the gaps, collected
  {
    const [p, b] = pan('gaps', `What we do NOT know — ${(d.gaps || []).length} gap(s) this run left open`);
    b.append(el('div', 'src', 'Every item here is an absence the validator reported, in its own words. None of them is filled in anywhere on this page.'));
    for (const g of d.gaps || []) b.appendChild(gapBox(g.scale, g.reason, g.where));
    host.appendChild(p);
  }
}

function renderFoot() {
  const d = S.data, m = d.meta || {}, f = $('#foot'); f.innerHTML = '';
  const p1 = el('p');
  p1.append(el('b', null, 'How this page was made. '),
    document.createTextNode(`Everything shown is one real validation run. The command was `));
  p1.append(el('code', 'mono', m.generated_by || 'gen.mjs'));
  p1.append(document.createTextNode(`, run at ${m.generated_at || '?'}, which called `));
  p1.append(el('code', 'mono', m.pipeline_call || m.pipeline || ''));
  p1.append(document.createTextNode(` in ${m.pipeline_module || 'sim-engine'}, plus ${(d.conditions || []).length} scenario runs for the condition montage. No number on this page was typed in by hand.`));
  f.appendChild(p1);
  if (d.sequence) {
    const w = el('div', 'limit');
    w.append(el('b', null, `sequence basis: ${d.sequence.sequence_basis} · loci covered: ${d.sequence.loci_covered}`),
      document.createTextNode(d.sequence.statement || ''));
    f.appendChild(w);
  }
  const p2 = el('p');
  p2.append(el('b', null, 'Keyboard. '));
  for (const [k, t] of [['Space', 'play or pause'], ['← →', 'scrub two seconds'], ['↑ ↓', 'previous or next act'], ['1–7', 'jump to an act']]) {
    p2.append(el('span', 'kbd', k), document.createTextNode(` ${t}  `));
  }
  f.appendChild(p2);
  const p3 = el('p');
  p3.append(el('b', null, 'Scope. '), document.createTextNode('Class Aves is a frozen holdout across this project: no bird value enters any parameter, target or comparison, including as an example. The condition montage is a set of real scenario runs and is not the physics gate; the gate is named in act 7.'));
  f.appendChild(p3);
  f.append(el('p', 'src', `run file: run-${d.case?.id}.json · interface for the sibling scenes: SCENES.md · generator: gen.mjs`));
}

boot();
