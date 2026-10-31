// Physiology mode for Open the Fish: circulation particles on the 3D model, and a 2D gill-lamella zoom with
// counter-current exchange. Everything drawn states its basis. Data, when the physiology thread writes it, is
// copied by dashboard/build-graph.mjs into ./physiology/ (circulation.json, gills.json, countercurrent.js,
// cardiac.js); until then the stand-ins below are used and labelled "assumed (stand-in)".
import * as THREE from 'three';

export const BASIS_STANDIN = {
  flying_fish_data: 'none: no circulatory or respiratory measurement of a flying fish is in the files',
  proxy_teleost: 'single-circuit topology (heart -> gills -> dorsal aorta -> body -> veins -> heart) and the counter-current gill lamella are textbook teleost physiology, not fish data in this repo',
  assumed: 'flow speed, particle count, water and blood PO2 values, transfer coefficient and the co/counter-current efficiency figures are illustrative stand-in values chosen by the viz thread',
  pending: 'physiology/circulation.json, gills.json, countercurrent.js and cardiac.js from the physiology thread; the page switches to them when the build copies them in'
};

// ---------- stand-in circulation: a closed loop through the model's organ centres ----------
// node positions come from the manifest's centre_gltf (model space); the "dorsal aorta" and "ventral vein" are
// proxies along the vertebral column and the ventral body wall, since the model has no vessel objects.
export function standinCirculation(manifest) {
  const C = {}; for (const o of manifest.objects) C[o.object] = o.centre_gltf;
  const P = (x, y, z) => [x, y, z];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const heart = C.heart || P(0.336, -0.036, 0), gL = C.gills_L || P(0.369, -0.011, -0.024), gR = C.gills_R || P(0.369, -0.011, 0.024);
  const brain = C.brain || P(0.365, 0.026, 0), liver = C.liver || P(0.255, -0.036, 0), intestine = C.intestine || P(0.112, -0.024, 0);
  const kidney = C.kidney || P(0.131, 0.003, 0), gon = mid(C.gonad_L || P(0.04, -0.02, -0.012), C.gonad_R || P(0.04, -0.02, 0.012)), spleen = C.spleen || P(0.197, -0.021, 0.017);
  const aorta0 = P(0.33, 0.012, 0), aorta1 = P(0.2, 0.014, 0), aorta2 = P(0.05, 0.012, 0), aortaTail = P(-0.25, 0.005, 0);
  const vein0 = P(-0.25, -0.03, 0), vein1 = P(0.1, -0.045, 0), vein2 = P(0.3, -0.05, 0);
  const n = (id, label, pos, o2, basis) => ({ id, label, pos, o2, basis: basis || 'assumed position proxy' });
  const nodes = [
    n('heart', 'heart (ventricle)', heart, 'deoxygenated', 'manifest centre of heart'),
    n('gills_L', 'gills, left', gL, 'oxygenating', 'manifest centre of gills_L'), n('gills_R', 'gills, right', gR, 'oxygenating', 'manifest centre of gills_R'),
    n('aorta0', 'dorsal aorta (proxy, no vessel object)', aorta0, 'oxygenated'), n('brain', 'brain (carotid proxy)', brain, 'oxygenated', 'manifest centre of brain'),
    n('aorta1', 'dorsal aorta (proxy)', aorta1, 'oxygenated'), n('liver', 'liver', liver, 'oxygenated', 'manifest centre of liver'), n('spleen', 'spleen', spleen, 'oxygenated', 'manifest centre of spleen'),
    n('aorta2', 'dorsal aorta (proxy)', aorta2, 'oxygenated'), n('kidney', 'kidney', kidney, 'oxygenated', 'manifest centre of kidney'), n('intestine', 'intestine', intestine, 'oxygenated', 'manifest centre of intestine'), n('gonads', 'gonads', gon, 'oxygenated', 'midpoint of gonad_L and gonad_R'),
    n('aortaTail', 'caudal artery (proxy)', aortaTail, 'oxygenated'), n('vein0', 'caudal vein (proxy)', vein0, 'deoxygenated'), n('vein1', 'posterior cardinal vein (proxy)', vein1, 'deoxygenated'), n('vein2', 'sinus venosus (proxy)', vein2, 'deoxygenated')
  ];
  const e = (from, to, o2, share) => ({ from, to, o2, share: share || 1 });
  const edges = [
    e('heart', 'gills_L', 'deoxygenated', 0.5), e('heart', 'gills_R', 'deoxygenated', 0.5),
    e('gills_L', 'aorta0', 'oxygenated', 0.5), e('gills_R', 'aorta0', 'oxygenated', 0.5),
    e('aorta0', 'brain', 'oxygenated', 0.15), e('brain', 'vein2', 'deoxygenated', 0.15),
    e('aorta0', 'aorta1', 'oxygenated', 0.85), e('aorta1', 'liver', 'oxygenated', 0.2), e('liver', 'vein1', 'deoxygenated', 0.2),
    e('aorta1', 'spleen', 'oxygenated', 0.1), e('spleen', 'vein1', 'deoxygenated', 0.1),
    e('aorta1', 'aorta2', 'oxygenated', 0.55), e('aorta2', 'kidney', 'oxygenated', 0.15), e('kidney', 'vein1', 'deoxygenated', 0.15),
    e('aorta2', 'intestine', 'oxygenated', 0.2), e('intestine', 'vein1', 'deoxygenated', 0.2), e('aorta2', 'gonads', 'oxygenated', 0.1), e('gonads', 'vein1', 'deoxygenated', 0.1),
    e('aorta2', 'aortaTail', 'oxygenated', 0.1), e('aortaTail', 'vein0', 'deoxygenated', 0.1), e('vein0', 'vein1', 'deoxygenated', 0.1),
    e('vein1', 'vein2', 'deoxygenated', 0.85), e('vein2', 'heart', 'deoxygenated', 1)
  ];
  return { source: 'stand-in', note: 'single circuit, teleost textbook topology; positions are manifest organ centres and vessel proxies; branch shares are illustrative', nodes, edges, basis: BASIS_STANDIN };
}

// accept the physiology thread's circulation.json in a few plausible shapes
export function normaliseCirculation(raw, manifest) {
  if (!raw) return null;
  const C = {}; for (const o of manifest.objects) C[o.object] = o.centre_gltf;
  const nodesIn = raw.nodes || raw.vessels || raw.compartments || []; const edgesIn = raw.edges || raw.flows || raw.links || [];
  const nodes = nodesIn.map(x => ({ id: x.id || x.name, label: x.label || x.name || x.id, pos: x.position || x.pos || x.centre || (x.object && C[x.object]) || (x.model_object && C[x.model_object]) || null,
    o2: x.o2 || x.oxygenation || x.state || 'unknown', basis: x.basis || x.source || (x.object ? 'manifest centre of ' + x.object : 'position from circulation.json') })).filter(x => x.id && x.pos);
  const ids = new Set(nodes.map(x => x.id));
  const edges = edgesIn.map(x => ({ from: x.from || x.source, to: x.to || x.target, o2: x.o2 || x.oxygenation || 'unknown', share: +(x.share || x.fraction || x.flow_fraction || 1) })).filter(x => ids.has(x.from) && ids.has(x.to));
  if (!nodes.length || !edges.length) return null;
  return { source: 'physiology/circulation.json', note: raw.note || raw.description || null, nodes, edges, basis: raw.basis || { flying_fish_data: raw.flying_fish_data || 'see file', proxy_teleost: raw.proxy || 'see file', assumed: raw.assumed || 'see file' }, cardiac: raw.cardiac || null };
}

// ---------- particles along the circulation graph ----------
export class Circulation {
  constructor(scene, modelScene, circ, pal) {
    this.scene = scene; this.model = modelScene; this.circ = circ; this.pal = pal;
    this.byId = Object.fromEntries(circ.nodes.map(n => [n.id, n]));
    this.out = {}; for (const e of circ.edges) (this.out[e.from] || (this.out[e.from] = [])).push(e);
    const N = 420; this.N = N;
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3);
    this.state = []; for (let i = 0; i < N; i++) this.state.push(this.spawn(true));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.012, vertexColors: true, transparent: true, opacity: 0.95, depthTest: false, sizeAttenuation: true }));
    this.points.renderOrder = 10; this.group = new THREE.Group(); this.group.add(this.points);
    // vessels as thin lines so the route reads even when the organs are ghosted
    const la = []; for (const e of circ.edges) { la.push(...this.byId[e.from].pos, ...this.byId[e.to].pos); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(la), 3));
    const lc = new Float32Array(la.length); let k = 0; for (const e of circ.edges) { const c = this.colorFor(e.o2); lc.set([c.r, c.g, c.b, c.r, c.g, c.b], k); k += 6; }
    lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthTest: false })); this.lines.renderOrder = 9; this.group.add(this.lines);
    modelScene.add(this.group); this.speed = 0.09; this.playing = true;
  }
  colorFor(o2) { const c = new THREE.Color(); c.set(o2 === 'oxygenated' ? this.pal.oxy : o2 === 'oxygenating' ? this.pal.mix : this.pal.deoxy); return c; }
  pickEdge(from) { const es = this.out[from] || []; if (!es.length) return null; const tot = es.reduce((a, e) => a + e.share, 0); let r = Math.random() * tot; for (const e of es) { r -= e.share; if (r <= 0) return e; } return es[es.length - 1]; }
  spawn(randomT) { const e = this.circ.edges[Math.floor(Math.random() * this.circ.edges.length)]; return { e, t: randomT ? Math.random() : 0 }; }
  step(dt) {
    if (!this.playing) return;
    for (let i = 0; i < this.N; i++) {
      const s = this.state[i]; const a = this.byId[s.e.from].pos, b = this.byId[s.e.to].pos;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 0.01; s.t += dt * this.speed / len;
      if (s.t >= 1) { const nx = this.pickEdge(s.e.to); if (nx) { s.e = nx; s.t = 0; } else { Object.assign(s, this.spawn(false)); } }
      const a2 = this.byId[s.e.from].pos, b2 = this.byId[s.e.to].pos; const t = s.t;
      // a little lateral jitter so the stream has width
      const j = (i % 7 - 3) * 0.0012;
      this.pos[i * 3] = a2[0] + (b2[0] - a2[0]) * t; this.pos[i * 3 + 1] = a2[1] + (b2[1] - a2[1]) * t + j; this.pos[i * 3 + 2] = a2[2] + (b2[2] - a2[2]) * t + j * 0.7;
      // colour: oxygenating edges blend from deoxygenated to oxygenated along their length
      const c = s.e.o2 === 'oxygenated' ? this.colorFor('oxygenated') : s.e.o2 === 'deoxygenated' ? this.colorFor('deoxygenated') : this.colorFor('deoxygenated').lerp(this.colorFor('oxygenated'), t);
      if (this.byId[s.e.to].o2 === 'oxygenating' && s.e.o2 === 'deoxygenated') c.lerp(this.colorFor('oxygenated'), Math.max(0, t - 0.6) * 2.5);
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
  setPalette(pal) { this.pal = pal; const lc = this.lines.geometry.attributes.color.array; let k = 0; for (const e of this.circ.edges) { const c = this.colorFor(e.o2); lc.set([c.r, c.g, c.b, c.r, c.g, c.b], k); k += 6; } this.lines.geometry.attributes.color.needsUpdate = true; }
  dispose() { this.model.remove(this.group); this.points.geometry.dispose(); this.lines.geometry.dispose(); }
}

// ---------- gill lamella: counter-current vs co-current exchange ----------
// Stand-in model: water and blood as two 1-D streams exchanging O2 across the lamella with a transfer
// coefficient; PO2 in mmHg. Water PO2 in 150 (air-saturated), venous blood 30, both assumed. Solved on a grid.
export const GILL_STANDIN = { Pw_in: 150, Pb_in: 30, k: 2.4, ratio: 1.0, n: 60,
  note: 'illustrative: Pw_in 150 mmHg (air-saturated water), Pb_in 30 mmHg (venous), dimensionless transfer k 2.4, water:blood capacitance ratio 1; none is a flying-fish measurement' };
export function solveExchange(p, counter) {
  const n = p.n, k = p.k / n, r = p.ratio; const Pw = new Array(n + 1).fill(p.Pw_in), Pb = new Array(n + 1).fill(p.Pb_in);
  if (!counter) { // co-current: both enter at x=0, march together
    for (let i = 0; i < n; i++) { const d = k * (Pw[i] - Pb[i]); Pw[i + 1] = Pw[i] - d; Pb[i + 1] = Pb[i] + d * r; }
  } else { // counter-current: water enters at x=0, blood at x=n; iterate to a fixed point
    for (let it = 0; it < 400; it++) {
      for (let i = 0; i < n; i++) { const d = k * (Pw[i] - Pb[i + 1]); Pw[i + 1] = Pw[i] - d; }
      for (let i = n; i > 0; i--) { const d = k * (Pw[i - 1] - Pb[i]); Pb[i - 1] = Pb[i] + d * r; }
      Pb[n] = p.Pb_in;
    }
  }
  const Pb_out = counter ? Pb[0] : Pb[n], Pw_out = Pw[n];
  const extraction = (p.Pw_in - Pw_out) / p.Pw_in; const bloodGain = (Pb_out - p.Pb_in) / (p.Pw_in - p.Pb_in);
  return { Pw, Pb, Pb_out, Pw_out, extraction, bloodGain };
}

// Adapter for physiology/countercurrent.js solve(params, counter): it returns segment means `water`/`blood` (length N),
// `waterOut`/`bloodOut`, `extraction` (exchanger effectiveness) and `utilisation` (fraction of inspired O2 removed).
// The panel labels "O2 extracted from water" as the utilisation; effectiveness is reported beside it.
export function adaptSolver(ext) {
  return (p, counter) => {
    const r = ext({ Pw_in: p.Pw_in, Pb_in: p.Pb_in, k: p.k, ratio: p.ratio, N: p.n, physical: p.physical || null }, counter);
    const N = r.water.length; const Pw = new Array(N + 1), Pb = new Array(N + 1);
    Pw[0] = p.Pw_in; for (let i = 0; i < N; i++) Pw[i + 1] = i < N - 1 ? (r.water[i] + r.water[i + 1]) / 2 : r.waterOut;
    if (counter) { Pb[N] = p.Pb_in; for (let i = N - 1; i >= 0; i--) Pb[i] = i > 0 ? (r.blood[i] + r.blood[i - 1]) / 2 : r.bloodOut; }
    else { Pb[0] = p.Pb_in; for (let i = 0; i < N; i++) Pb[i + 1] = i < N - 1 ? (r.blood[i] + r.blood[i + 1]) / 2 : r.bloodOut; }
    return { Pw, Pb, Pb_out: r.bloodOut, Pw_out: r.waterOut, extraction: r.utilisation, effectiveness: r.extraction, bloodGain: (r.bloodOut - p.Pb_in) / (p.Pw_in - p.Pb_in), converged: r.converged, iterations: r.iterations, external: true };
  };
}
// draws the lamella panel into a 2D canvas; `solver` may be the physiology thread's function when it lands
export class GillPanel {
  constructor(canvas, pal, params, solver) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.pal = pal; this.p = params || GILL_STANDIN; this.solver = solver || solveExchange; this.counter = true; this.t = 0; this.playing = true; }
  draw(dt) {
    if (this.playing) this.t += dt;
    const ctx = this.ctx, W = this.c.width, H = this.c.height; ctx.clearRect(0, 0, W, H);
    const res = this.solver(this.p, this.counter); const n = res.Pw.length - 1;
    const L = 60, R = W - 24, top = 18, chH = Math.min(70, H * 0.17), gap = 18;
    const wy = top, by = top + chH + gap, px0 = by + chH + 44, pH = H - px0 - 34;
    const X = i => L + (R - L) * i / n;
    // channels
    ctx.font = '12px Inter Tight, system-ui, sans-serif'; ctx.fillStyle = this.pal.ink;
    ctx.fillText('water  (PO₂ ' + this.p.Pw_in + ' → ' + res.Pw_out.toFixed(0) + ' mmHg)', L, wy - 5);
    ctx.fillText('blood  (PO₂ ' + this.p.Pb_in + ' → ' + res.Pb_out.toFixed(0) + ' mmHg)', L, by + chH + 14);
    ctx.fillStyle = this.pal.soft; ctx.fillRect(L, wy, R - L, chH); ctx.fillRect(L, by, R - L, chH);
    ctx.fillStyle = this.pal.line; ctx.fillRect(L, wy + chH, R - L, gap); // the lamella wall
    ctx.fillStyle = this.pal.mute; ctx.font = '10.5px Inter Tight, system-ui, sans-serif'; ctx.fillText('lamella (epithelium + pillar cells): O₂ diffuses down the PO₂ difference at every point', L + 6, wy + chH + 12);
    // particles: water left->right; blood right->left (counter) or left->right (co); colour by local PO2
    const pcol = v => { const t = Math.max(0, Math.min(1, (v - this.p.Pb_in) / (this.p.Pw_in - this.p.Pb_in))); return lerpHex(this.pal.deoxy, this.pal.oxy, t); };
    for (let i = 0; i < 70; i++) { const ph = ((this.t * 0.22 + i / 70) % 1); const ix = Math.floor(ph * n); const x = X(ph * n), y = wy + 8 + (i * 37 % (chH - 16));
      ctx.fillStyle = pcol(res.Pw[ix]); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 70; i++) { const ph = ((this.t * 0.16 + i / 70) % 1); const u = this.counter ? 1 - ph : ph; const ix = Math.floor(u * n); const x = X(u * n), y = by + 8 + (i * 29 % (chH - 16));
      ctx.fillStyle = pcol(res.Pb[ix]); ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }
    // arrows
    ctx.strokeStyle = this.pal.ink; ctx.lineWidth = 1.5; arrow(ctx, L + 10, wy + chH / 2, L + 40, wy + chH / 2); if (this.counter) arrow(ctx, R - 10, by + chH / 2, R - 40, by + chH / 2); else arrow(ctx, L + 10, by + chH / 2, L + 40, by + chH / 2);
    // PO2 profiles
    ctx.strokeStyle = this.pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, px0); ctx.lineTo(L, px0 + pH); ctx.lineTo(R, px0 + pH); ctx.stroke();
    ctx.fillStyle = this.pal.mute; ctx.fillText('PO₂ along the lamella (mmHg)', L, px0 - 4); ctx.fillText('water in →', L, px0 + pH + 13); ctx.textAlign = 'right'; ctx.fillText(this.counter ? '← blood in' : 'blood in → (same end)', R, px0 + pH + 13); ctx.textAlign = 'left';
    const Y = v => px0 + pH - pH * (v / this.p.Pw_in);
    for (const [arr, col] of [[res.Pw, this.pal.oxy], [res.Pb, this.pal.deoxy]]) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= n; i++) { const x = X(i), y = Y(arr[i]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
    ctx.fillStyle = this.pal.oxy; ctx.fillText('water', R - 36, Y(res.Pw[n]) - 6); ctx.fillStyle = this.pal.deoxy; ctx.fillText('blood', L + 4, Y(res.Pb[0]) - 6);
    // readout
    ctx.fillStyle = this.pal.ink; ctx.font = '600 12px Inter Tight, system-ui, sans-serif';
    ctx.fillText((this.counter ? 'counter-current' : 'co-current') + ': O₂ extracted from water ' + (res.extraction * 100).toFixed(0) + ' %' + (res.effectiveness != null ? ' (effectiveness ' + (res.effectiveness * 100).toFixed(0) + ' %)' : '') + '  ·  blood leaves at ' + res.Pb_out.toFixed(0) + ' mmHg' + (this.counter ? ' (above the water outlet: only counter-current can do this)' : ' (cannot exceed the water outlet)'), L, H - 8);
    return res;
  }
}
function arrow(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); const a = Math.atan2(y2 - y1, x2 - x1); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 7 * Math.cos(a - 0.5), y2 - 7 * Math.sin(a - 0.5)); ctx.lineTo(x2 - 7 * Math.cos(a + 0.5), y2 - 7 * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill(); }
function lerpHex(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = s => [(s >> 16) & 255, (s >> 8) & 255, s & 255]; const A = ch(pa), B = ch(pb); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
