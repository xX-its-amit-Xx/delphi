// Compare mode for Open the Fish (?mode=compare): a 2x2 grid of synced 3D views playing development side by side
// (zebrafish wild type / winged zebrafish; flying fish wild type / wingless flying fish) plus a fifth panel, the
// hypothetical truly flying fish (TFF) with an altitude readout. One WebGL canvas, one viewport per panel (scissor), the
// camera orbit shared by all five. Data: compare-2x2.json (genotype/), tff.json (physics/flier/tff/), the development
// trajectories (development/trajectory.mjs; development/zebrafish/trajectory.mjs when it lands), and browser-check.mjs
// through the page's checker for the glow. Panels A and B draw the real zebrafish models (model/zebrafish-larva.glb and
// model/zebrafish-adult.glb, passed in as host.zf); which of the two is on screen follows the stage the development data
// defines (larva below Parichy 2009 milestone J, SL 11.0 mm; juvenile and adult above it). Their pectoral fins are drawn
// as the model has them and are NEVER scaled by a fin ratio: no sourced wild-type zebrafish pectoral-fin-length / SL
// exists (development/zebrafish/trajectory.mjs returns null), so no fin-ratio value is asserted for them.
import * as THREE from 'three';

const REF_FIN = 0.687; // flying-fish median pectoral fin length / SL (Daane 2021), the model as built
// which parametric design each panel draws, when host.designs carries it. The design's own manifest supplies the number
// shown and the evidence grade behind it; the geometry is drawn as built and never rescaled by a fin ratio here.
export const PANEL_DESIGN = { B: 'winged-zebrafish', D: 'wingless-flying-fish', E: 'tff' };
export const PANELS = [
  { key: 'A', cell: 'a', species: 'zebrafish', fins: 'ordinary fins', title: 'zebrafish, wild type', label: 'baseline, never measured on this axis', tone: 'mute', icon: '○' },
  { key: 'B', cell: 'b', species: 'zebrafish', fins: 'enlarged paired fins', title: '"winged zebrafish" (kcnh2a lof/+ ; lat4a nr21/+)', label: 'real germline experiment; magnitude in figure panels only', tone: 'ok', icon: '◐' },
  { key: 'C', cell: 'c', species: 'flying fish', fins: 'enlarged paired fins', title: 'flying fish, wild type', label: 'measured', tone: 'ok', icon: '●' },
  { key: 'D', cell: 'd', species: 'flying fish', fins: 'ordinary fins', title: '"wingless flying fish"', label: 'measured phenotype, hypothetical genetics', tone: 'warn', icon: '◑' },
  { key: 'E', cell: 'e', species: 'flying fish', fins: 'TFF', title: 'truly flying fish (TFF)', label: 'HYPOTHETICAL', tone: 'bad', icon: '⚠' }
];
// zebrafish growth stand-in until development/zebrafish/trajectory.mjs lands (assumed, labelled on the page)
export const ZF_STANDIN = { note: 'stand-in: zebrafish SL 0.35 cm at hatching rising to 3.0 cm (adult) along an assumed saturating curve; mass 0.01 × SL_cm³ g, assumed. Replaced by development/zebrafish/trajectory.mjs when it lands.',
  at: d => { if (d < 0) return { egg: true, SL: 0.003, mass: 1e-6, stage: 'embryo' }; const SL = 0.0035 + (0.030 - 0.0035) * (1 - Math.exp(-d / 45)); return { SL, mass: 0.01 * Math.pow(SL * 100, 3) / 1000, stage: d < 30 ? 'larva' : d < 90 ? 'juvenile' : 'adult' }; } };

export class Compare {
  // host: {root, objs, PAL, checker, base, derive, flier, trajFF, trajZF, data2x2, tff, onPick}
  constructor(el, host) {
    this.el = el; this.h = host; this.age = 120; this.alt = 0; this.theta = -0.9; this.phi = 1.25; this.playing = false;
    el.innerHTML = `<canvas class="cmpc"></canvas><div class="cmpgrid">${PANELS.map(p => `<div class="cmpp" data-k="${p.key}" style="grid-area:${p.cell}"><div class="cmph"><span class="cmpt">${p.key}. ${esc(p.title)}</span><span class="cmpl ${p.tone}">${p.icon} ${esc(p.label)}</span></div><div class="cmpv" data-v="${p.key}"></div><div class="cmpr" data-r="${p.key}"></div></div>`).join('')}</div>
      <div class="cmpbar"><button class="cmpplay">play</button><label>age <input type="range" class="cmpage" min="-7" max="365" step="1" value="${this.age}"></label><select class="cmpmode" title="How the two species' clocks are matched: the choice is ours, not the data's"><option value="absolute">same days after hatching</option><option value="stage">same stage progress</option></select><span class="cmpread"></span><label class="cmpaltl">TFF altitude <input type="range" class="cmpalt" min="0" max="5000" step="50" value="0"></label></div>`;
    this.canvas = el.querySelector('.cmpc');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.renderer.setScissorTest(true);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.02, 100);
    this.scenes = {}; this.state = {};
    for (const p of PANELS) this.scenes[p.key] = this.makeScene(p);
    el.querySelector('.cmpage').oninput = e => { this.age = +e.target.value; this.update(); };
    el.querySelector('.cmpmode').onchange = e => { this.mode = e.target.value; this.update(); };
    el.querySelector('.cmpalt').oninput = e => { this.alt = +e.target.value; this.update(); };
    el.querySelector('.cmpplay').onclick = e => { this.playing = !this.playing; e.target.textContent = this.playing ? 'pause' : 'play'; if (this.playing && this.age >= 365) this.age = -7; };
    // orbit: drag anywhere on the grid, all five panels follow
    let drag = null; el.addEventListener('pointerdown', e => { if (e.target.closest('.cmpbar') || e.target.closest('.cmph')) return; drag = { x: e.clientX, y: e.clientY, t: this.theta, p: this.phi }; });
    addEventListener('pointermove', e => { if (!drag) return; this.theta = drag.t + (e.clientX - drag.x) * 0.008; this.phi = Math.max(0.3, Math.min(2.8, drag.p - (e.clientY - drag.y) * 0.006)); });
    addEventListener('pointerup', () => { drag = null; });
    el.querySelectorAll('.cmph').forEach(hd => hd.onclick = () => host.onPick && host.onPick(hd.parentElement.dataset.k));
    this.update();
  }
  makeScene(p) {
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0x6a7a80, 0.95)); const dl = new THREE.DirectionalLight(0xffffff, 1.0); dl.position.set(2, 3, 2); s.add(dl);
    const D = this.h.designs && this.h.designs[p.key];
    const Z = this.h.zf;
    if (D) {
      // the design is an adult shape. Panel B also keeps the plain larva, because the design has no larval stage.
      const forms = {};
      const add = (name, src) => { const g = src.group.clone(true); g.visible = false; s.add(g);
        const fins = []; g.traverse(o => { if (o.isMesh && /^(pectoral_fin|pelvic_fin)/.test(o.name)) { o.material = o.material.clone(); fins.push(o); } });
        forms[name] = { group: g, fins }; };
      add('design', D);
      if (p.species === 'zebrafish' && Z && Z.larva) add('larva', Z.larva);
      return { scene: s, design: forms, fins: [], info: {} };
    }
    if (p.species === 'zebrafish' && Z && Z.larva && Z.adult) {
      // both zebrafish models live in the panel; the stage decides which one is visible
      const forms = {};
      for (const k of ['larva', 'adult']) {
        const g = Z[k].group.clone(true); g.visible = false; s.add(g);
        const fins = []; g.traverse(o => { if (o.isMesh && /^(pectoral_fin|pelvic_fin)/.test(o.name)) { o.material = o.material.clone(); fins.push(o); } });
        forms[k] = { group: g, fins };
      }
      return { scene: s, zf: forms, fins: [], info: {} };
    }
    // the flying-fish panels always hold the flying fish, even when the species menu has a zebrafish on the main stage
    const F = this.h.ff;
    const g = (F ? F.group : this.h.root).clone(true); s.add(g);
    // per-panel materials on the fins so each panel glows on its own
    const fins = [];
    g.traverse(o => { if (o.isMesh && /^(pectoral_fin_(L|R)|pectoral_fin_ray_|pelvic_fin)/.test(o.name)) { o.material = o.material.clone(); fins.push(o); } });
    return { scene: s, group: g, fins, info: F ? F.info : Object.fromEntries(this.h.objs.map(o => [o.name, o])) };
  }
  // which zebrafish model a stage calls for: the boundary is the development data's own (Parichy 2009 milestone J,
  // SL 11.0 mm = larva -> juvenile), read off the stage string compareAt returns.
  zfForm(st) { const sg = String(st.stage || '').toLowerCase();
    return /juvenile|adult/.test(sg) ? 'adult' : 'larva'; }
  // the panel's state at the shared age: SL, mass, fin ratio, what it rests on
  panelState(p, d) {
    const H = this.h, ff = H.trajFF, zf = H.trajZF || ZF_STANDIN; const P2 = H.data2x2 && H.data2x2.panels ? Object.fromEntries(H.data2x2.panels.map(x => [x.panel, x])) : {};
    const cr = this.cmpRes;
    if (p.species === 'zebrafish') { let r;
      if (cr && cr.zebrafish) { const z = cr.zebrafish; const hpf = z.hpf != null ? z.hpf : (z.dpf || 0) * 24; r = { SL: z.SL_m != null ? z.SL_m : 0.003, mass: z.mass_kg, stage: z.stage + (z.zfs ? ' · ' + z.zfs.name : ''), egg: z.SL_m == null, finFormed: hpf >= 24, finState: z.pectoral ? z.pectoral.state + ' (' + z.pectoral.kind + ')' : '', zAge: z.ageDays }; }
      else { r = { ...zf.at(d), finFormed: d >= 0, finState: '' }; }
      // NO sourced wild-type zebrafish pectoral fin length / SL: the fins are drawn as outlines at the model's size, not to scale
      const haveModel = !!(H.zf && H.zf.larva && H.zf.adult);
      // the fish is drawn; no fin ratio is asserted. The long version of this sentence is in the side panel.
      const drawn = haveModel
        ? 'fins drawn as the model has them (manifest\'s schematic 0.19 SL), <b>never scaled by a fin ratio</b>: no sourced wild-type zebrafish pectoral/SL exists'
        : 'pectoral fins not drawn: no sourced zebrafish pectoral fin length / SL (compareAt returns null)';
      return { ...r, finLen: null, outline: true, zfModel: haveModel,
        finBasis: (p.key === 'B' ? 'drawn exactly like A (the overgrown fins have no sourced magnitude); ' : '') + drawn + (r.finState ? '; ' + r.finState : ''),
        growthBasis: cr ? 'development/zebrafish/trajectory.mjs' : 'stand-in zebrafish growth (assumed)', SLmax: 0.031, row: P2[p.key] };
    }
    const ffAge = cr ? (cr.flyingFishAgeDays != null ? cr.flyingFishAgeDays : cr.ageDays) : d;
    const r = ff ? ff.at(ffAge / 365) : { SL: 0.2, mass: 0.06, finLen: REF_FIN, stage: 'adult' };
    if (p.key === 'C') return { ...r, finBasis: 'pectoral/SL from development/trajectory.mjs (Daane 2021 fit; proxy or assumed below 1.68 cm SL)', growthBasis: 'development/trajectory.mjs', SLmax: 0.22, row: P2.C };
    if (p.key === 'D') { const hb = P2.D && P2.D.phenotype && P2.D.phenotype.nearest_real_proxies && P2.D.phenotype.nearest_real_proxies.halfbeak ? P2.D.phenotype.nearest_real_proxies.halfbeak.median : 0.14;
      return { ...r, finLen: hb, finSpan: 1, finBasis: `halfbeak median pectoral/SL ${hb} (n 22, measured on relatives); the genotype that would give it is hypothetical`, growthBasis: 'development/trajectory.mjs (flying-fish growth assumed unchanged)', SLmax: 0.22, row: P2.D }; }
    const F = H.flier; // TFF: the flier's proportions on the flying-fish growth, from the start of development
    return { ...r, finLen: F ? F.finLen : 1.75, finSpan: F ? F.finSpan : 0.6, mass: r.mass, finBasis: 'TFF proportions (physics/flier/spec.json, tff.json) held from the start of development: HYPOTHETICAL', growthBasis: 'development/trajectory.mjs', SLmax: 0.22, tff: true };
  }
  update() {
    const H = this.h; const d = this.age; this.el.querySelector('.cmpage').value = d;
    this.cmpRes = null; if (H.zfMod && typeof H.zfMod.compareAt === 'function') { try { this.cmpRes = H.zfMod.compareAt(d, { mode: this.mode || 'absolute' }); } catch (e) { this.cmpRes = null; } }
    const red = new THREE.Color(H.PAL['--bad'] || '#b3392f'), amb = new THREE.Color(H.PAL['--warn'] || '#a8650b');
    const read = []; const ks = [];
    for (const p of PANELS) { const S = this.scenes[p.key]; const st = this.panelState(p, d); this.state[p.key] = st;
      const egg = !!st.egg; const k = egg ? 0.08 : Math.max(0.08, st.SL / st.SLmax);
      ks.push(k);
      let panelFins;
      if (S.design) {
        const useLarva = p.species === 'zebrafish' && (egg || this.zfForm(st) === 'larva') && S.design.larva;
        const form = useLarva ? 'larva' : 'design'; st.designForm = form;
        for (const key of Object.keys(S.design)) S.design[key].group.visible = (key === form);
        S.design[form].group.scale.setScalar(k);
        panelFins = S.design[form].fins;
        const D = this.h.designs[p.key] || {}; const man = D.manifest || {};
        st.designId = D.id || null;
        st.drawnFin = man.parameters ? man.parameters.pectoral_len_over_SL : null;
        const pv = (man.provenance_per_parameter || {}).pectoral_len_over_SL || null;
        st.drawnKind = pv ? pv.kind : null;
        st.drawnReason = pv && pv.delta ? pv.delta.reason : null;
        st.formNote = useLarva
          ? 'the plain larva model: this design exists only as an adult shape (below milestone J, SL 11.0 mm)'
          : (D.file || D.id || 'design') + ' as built, no fin ratio applied here';
      } else if (S.zf) {
        // the real zebrafish models: swap larva for adult at the stage boundary, scale to this age's SL, and leave every
        // piece exactly as built. Nothing here scales a fin, because there is no sourced ratio to scale it by.
        const form = egg ? 'larva' : this.zfForm(st); st.zfForm = form;
        for (const key of ['larva', 'adult']) S.zf[key].group.visible = (key === form);
        S.zf[form].group.scale.setScalar(k);
        panelFins = S.zf[form].fins;
        st.formNote = egg ? 'larva model at the embryo\'s size (no embryo model exists)'
          : form === 'larva' ? 'zebrafish-larva.glb (below milestone J, SL 11.0 mm)'
          : 'zebrafish-adult.glb (at or above milestone J, SL 11.0 mm)';
      } else {
        S.group.scale.setScalar(k);
        const fl = (st.finLen || REF_FIN) / REF_FIN, sp = Math.sqrt(st.finSpan || 1);
        for (const m of S.fins) { const o = S.info[m.name]; if (!o) continue; if (/^pelvic/.test(m.name)) { m.visible = !egg; continue; } const sg = o.side === 'L' ? -1 : 1; m.scale.set(fl, sp, 1); const c = o.centre; m.position.copy(o.basePos).add(new THREE.Vector3((c.x - 0.33) * (fl - 1), 0, (c.z - sg * 0.03) * (sp - 1) * 0.5));
          m.visible = st.outline ? false : !egg; }
        panelFins = S.fins;
      }
      // the page's checker (browser-check.mjs) on this panel's numbers; C9 at the fixed 10 m/s, plus C16/C14 for the TFF
      let v = null, rows = [];
      if (st.outline) { v = { id: 'C9', verdict: 'cannot-evaluate', text: 'no zebrafish pectoral fin length / SL' }; }
      else if (!egg && H.checker && H.base) { const des = { ...H.base, SL: st.SL, mass: st.mass, finLen: st.finLen || REF_FIN, finSpan: st.finSpan || 1, ...(st.tff && H.flier ? { _extra: H.flier._extra } : {}) }; rows = H.checker(des, H.base); v = rows.find(x => x.id === 'C9'); }
      const glow = v ? (v.verdict === 'violated' ? 'violated' : v.verdict === 'cannot-evaluate' ? 'cannot' : null) : null;
      for (const m of panelFins) { if (!m.material.emissive) continue; if (glow) { m.material.emissive.copy(glow === 'violated' ? red : amb); m.material.emissiveIntensity = glow === 'violated' ? 0.55 : 0.3; } else m.material.emissive.setHex(0); }
      const vtxt = v ? (v.verdict === 'holds' ? '✓ C9 holds at 10 m/s' : v.verdict === 'violated' ? '✕ C9 violated at 10 m/s (fins glow red)' : '? C9 cannot evaluate: ' + (v.text || '')) : egg ? 'embryo: no constraint evaluated' : '';
      let extra = '';
      if (st.tff) { const c16 = rows.find(x => x.id === 'C16'), c14 = rows.find(x => x.id === 'C14'); const T = H.tff && H.tff.tff; const atm = H.tff && H.tff.atmosphere && H.tff.atmosphere.samples;
        const ceil = T && T.ceiling_m ? T.ceiling_m.value : null, target = T && T.target_altitude_m ? T.target_altitude_m.value : null;
        const near = atm ? Object.keys(atm).map(Number).sort((a, b) => Math.abs(a - this.alt) - Math.abs(b - this.alt))[0] : null;
        extra = `<br>altitude <b>${this.alt} m</b>${target ? ` · target ${target} m` : ''}${ceil ? ` · derived ceiling ${Math.round(ceil)} m (upper bound: PaO₂ = PiO₂ assumed)` : ''}${this.alt > (ceil || Infinity) ? ' · <b style="color:var(--bad)">✕ above the derived ceiling</b>' : ceil ? ' · ✓ below the derived ceiling' : ''}${near != null && atm ? `<br><span class="tiny">air at ${near} m (NASA troposphere fit): ρ ${atm[near].rho.toFixed(3)} kg/m³, PO₂ ${atm[near].PO2_kPa.toFixed(1)} kPa; C9 above uses sea-level ρ (conditions locked)</span>` : ''}${c16 ? `<br><span class="tiny">C16 ${c16.verdict}: ${esc(c16.text)}</span>` : ''}${c14 ? `<br><span class="tiny">C14 ${c14.verdict}: ${esc(c14.text)}</span>` : ''}`; }
      if (st.drawnFin != null && st.designForm === 'design') {
        const kind = st.drawnKind === 'hypothetical' ? '<b>assumed delta, not a measured value</b>' : esc(st.drawnKind || 'unstated');
        st.finBasis = `drawn at pectoral/SL <b>${(+st.drawnFin).toFixed(3)}</b> (${kind})` + (st.drawnReason ? '; ' + esc(String(st.drawnReason).slice(0, 190)) : '') + (st.outline ? '; <b>no sourced wild-type zebrafish pectoral/SL exists</b>, so no measured ratio is asserted' : '');
      }
      const r = this.el.querySelector(`[data-r="${p.key}"]`);
      r.innerHTML = `${egg ? 'embryo · ' + esc(st.stage || '') : `SL ${(st.SL * 100).toFixed(st.SL < 0.05 ? 2 : 1)} cm · fin/SL ${st.drawnFin != null && st.designForm === 'design' ? `<b>${(+st.drawnFin).toFixed(2)}</b> <span class="tiny">drawn, ${esc(st.drawnKind || '')}</span>` : st.outline ? '<b>no sourced value</b>' : (st.finLen || REF_FIN).toFixed(2)} · ${esc(st.stage || '')}`}${st.zAge != null && Math.abs(st.zAge - d) > 0.5 ? ` · zebrafish age ${st.zAge.toFixed(1)} d` : ''} · <span style="color:${v && v.verdict === 'violated' ? 'var(--bad)' : v && v.verdict === 'holds' ? 'var(--ok)' : 'var(--mute)'}">${vtxt}</span><br><span class="tiny">${st.finBasis}; growth: ${esc(st.growthBasis)}${st.formNote ? '; geometry: ' + esc(st.formNote) : p.species === 'zebrafish' ? '; geometry: the flying-fish body (no zebrafish model passed in)' : ''}</span>${extra}`;
      read.push(`${p.key} ${egg ? 'embryo' : (st.SL * 100).toFixed(1) + ' cm'}`);
    }
    // every panel keeps its own scale (each is sized against its own adult), but the shared camera pulls in so the
    // largest fish of the moment fills its frame: without it a 7 mm larva is a few pixels. Relative sizes are untouched.
    this.maxK = Math.max(0.08, ...ks);
    const cr2 = this.cmpRes; this.el.querySelector('.cmpread').innerHTML = `<b>axis:</b> ${esc(cr2 ? cr2.axis : 'same days after hatching (stand-in zebrafish growth)')} · ${d < 0 ? Math.abs(d) + ' d before hatching' : d + ' d'}${cr2 && cr2.zebrafishAgeDays != null ? ` (zebrafish at ${cr2.zebrafishAgeDays.toFixed(1)} d)` : ''} · each panel scaled to its own adult size (zebrafish ~3 cm, flying fish ~22 cm)${this.maxK < 0.9 ? `, camera &times;${(1 / this.maxK).toFixed(1)} on all five (relative sizes unchanged)` : ''}`;
  }
  step(dt) { if (this.playing) { this.age = Math.min(365, this.age + dt * 20); if (this.age >= 365) { this.playing = false; this.el.querySelector('.cmpplay').textContent = 'play'; } this.update(); } }
  render() {
    const R = this.renderer, cv = this.canvas; const box = this.el.getBoundingClientRect(); const w = box.width, h = box.height;
    if (cv.width !== Math.round(w * R.getPixelRatio()) || cv.height !== Math.round(h * R.getPixelRatio())) R.setSize(w, h, false);
    R.setScissorTest(false); R.clear(); R.setScissorTest(true);
    const d = 1.25 * Math.max(0.12, Math.min(1, this.maxK == null ? 1 : this.maxK)), x = d * Math.sin(this.phi) * Math.cos(this.theta), y = d * Math.cos(this.phi), z = d * Math.sin(this.phi) * Math.sin(this.theta);
    for (const p of PANELS) { const v = this.el.querySelector(`[data-v="${p.key}"]`); const r = v.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      const left = r.left - box.left, bottom = box.bottom - r.bottom; R.setViewport(left, bottom, r.width, r.height); R.setScissor(left, bottom, r.width, r.height);
      this.camera.aspect = r.width / r.height; const fit = Math.max(1, 1.3 / this.camera.aspect); this.camera.position.set(x * fit, y * fit, z * fit); this.camera.lookAt(0, 0, 0); this.camera.updateProjectionMatrix();
      R.render(this.scenes[p.key].scene, this.camera); }
    if (!this.playing) this.theta += 0.0015;
  }
  dispose() { this.renderer.dispose(); this.el.innerHTML = ''; }
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
