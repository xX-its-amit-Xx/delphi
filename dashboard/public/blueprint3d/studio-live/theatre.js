// The scale theatre: a designed organism in 3D, with every statement that reaches each part.
//
// It reads ONE file per run -- studio-live/scales/<run>.json, baked by sim-engine/scales/build.mjs -- and
// renders nothing it was not given. There is no inference in this file: if a part has no law chip it is
// because the ladder has no law chip for it, and the panel says which of the several reasons applies.
//
// FOUR COLOURS, FOUR KINDS OF STATEMENT. proof = a kernel-checked Lean theorem; check = arithmetic in
// sim-engine/validate; literature = a graded, quoted link from a paper in some other species; declared = a
// number a person typed. They are never drawn in the same colour, because the whole value of the view is
// that a reader can tell them apart without reading.
//
// TWO WAYS TO DRAW THE BODY. "illustrated" (the default when a GLB exists) shows the Blender illustration
// mesh named by ladder.mesh (sim-engine/scales/mesh/); "schematic" shows one primitive per part at its
// frame slot. The mesh is an ILLUSTRATION: its shapes are sculpted from textbook body plans and are not
// measured, and the page says so on screen. It must never make a part look present that the blueprint
// lacks, so every slot node is styled per ladder:
//   present  a non-ghost part of the blueprint lands in this slot: drawn solid, clickable
//   ghost    only the literature chain names it (blueprint_has_it: false): translucent violet, labelled
//   body     an envelope region (head, thorax, trunk...) with no part of its own: drawn neutral, and a click
//            opens the body, because the blueprint names the organism but not that region
//   cells    only cells or tissues of the blueprint land here (in a frame whose slots are organs), so the organ
//            itself is not in the design: an amber/green translucent outline, labelled with the cell's name. A
//            mis-slotted cell must not become a solid sculpted limb.
//   absent   nothing lands here: hidden, unless "show what this blueprint lacks" draws it as a faint outline
// A piece that DEPICTS one specific part (node extras.requires: ontology ids and/or /label regexes/, e.g. a
// construct's multiciliated cells and their cilia) is styled by THAT part's state -- present solid, ghost violet
// and labelled, absent hidden -- never by its parent slot's (sim-engine/scales/mesh/depicts.mjs has the rule).
// A clicked piece's extras.illustration_note (a drawing choice a viewer could mistake for data) is shown on its card
// under "about this drawing".
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n == null ? '—' : (Math.abs(n) >= 1e4 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(3) : String(Number(n.toFixed(6))));
const qs = new URLSearchParams(location.search);

const LEVEL_COLOUR = { body: 0x9aa7a4, organ_system: 0x6b4fb3, organ: 0x0e7c86, tissue: 0x2f7d4f, cell: 0xa8650b, molecule: 0xb3392f };
const LEVELS = ['body', 'organ_system', 'organ', 'tissue', 'cell', 'molecule'];
const DEFAULT_ON = { body: true, organ_system: true, organ: true, tissue: false, cell: false, molecule: false };
const BEAD_LEVELS = ['tissue', 'cell'];              // in illustrated mode these stay beads; coarser levels are the mesh
const PRIORITY = { appendage: 0, interior: 0, envelope: 1, shell: 2 };

let INDEX = null, BUNDLE = null, LADDER = null, SHOW = { ...DEFAULT_ON }, SEL = null, AGE = 0;
let renderer, scene, camera, group, raycaster, meshes = [], spin = true, yaw = 0.6, pitch = 0.22, dragging = null;
let shadow = null, axisLine = null;
// Illustrated mode.
let MODE = qs.get('mode') === 'schematic' ? 'schematic' : 'mesh';   // what the reader asked for
let SHOW_ABSENT = qs.get('absent') === '1';
const GLB = {};                                    // hash -> {status, root, stages, nodes, error}
let STYLE = new Map();                             // node record -> {state, rep, parts}
let AUTOFIT = true;                                // the page frames the body until the reader zooms by hand
let FITTED = null;                                 // which ladder/mode the automatic fit was made for
let EXTRAS = [];                                   // helper meshes added under GLB nodes (outlines, depth pre-pass)
let LASTCLICK = null;                              // {x, y}: a second click at the same spot goes one part deeper
let BEADS_HIDDEN = { n: 0, slots: new Set() };     // beads whose slot this stage form does not sculpt

/* ---------------------------------------------------------------- boot */

init().catch(e => { $('#panel').innerHTML = `<div class="card err"><h2>Could not start</h2><p class="note">${esc(e.message)}</p>
  <p class="note">This page needs <span class="mono">studio-live/scales/index.json</span>. Build it with <span class="mono">node sim-engine/scales/build.mjs</span>.</p></div>`; });

async function init() {
  INDEX = await (await fetch('scales/index.json', { cache: 'no-store' })).json();
  const runs = INDEX.runs ?? [];
  if (!runs.length) throw new Error('scales/index.json lists no runs');
  $('#run').innerHTML = runs.map(r => `<option value="${esc(r.run)}">${esc(r.run)}</option>`).join('');
  const want = qs.get('run');
  $('#run').value = runs.some(r => r.run === want) ? want : runs[0].run;
  $('#run').onchange = () => loadRun($('#run').value);
  $('#gen').onchange = () => { pick(Number($('#gen').value)); };
  $('#spin').onclick = () => { spin = !spin; $('#spin').setAttribute('aria-pressed', String(spin)); };
  $('#theme').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    if (LADDER) draw();
  };
  $('#m-mesh').onclick = () => setMode('mesh');
  $('#m-schem').onclick = () => setMode('schematic');
  $('#absent').onclick = () => { SHOW_ABSENT = !SHOW_ABSENT; draw(); };
  $('#fit').onclick = () => { AUTOFIT = true; fit(); };
  $('#cv').addEventListener('dblclick', () => { AUTOFIT = true; fit(); });

  ladderChips();
  await loadRun($('#run').value);
  if (qs.get('live') === '1') live();
}

async function loadRun(run) {
  const row = (INDEX.runs ?? []).find(r => r.run === run);
  BUNDLE = await (await fetch(`scales/${row.file}`, { cache: 'no-store' })).json();
  const gens = BUNDLE.generations ?? [];
  $('#gen').innerHTML = gens.map(g => `<option value="${g.generation}">${g.generation}${g.body ? '' : ' (no body)'}</option>`).join('');
  // Only honour ?gen= when it is actually there: Number(null) is 0, which matches generation 0 -- and a
  // generation 0 is often a refusal with no body at all, so the page opened on an empty stage.
  const wantGen = qs.has('gen') ? Number(qs.get('gen')) : null;
  const g = (wantGen != null && gens.some(x => x.generation === wantGen)) ? wantGen
    : (gens.find(x => x.body)?.generation ?? gens[0]?.generation ?? 0);
  $('#gen').value = String(g);
  pick(g);
}

function pick(g, { keepView = false } = {}) {
  LADDER = BUNDLE.ladders[String(g)] ?? BUNDLE.ladders[g];
  if (!keepView) { SEL = null; AGE = initialAge(); AUTOFIT = true; FITTED = null; LASTCLICK = null; }
  else AGE = Math.min(AGE, Math.max(0, (LADDER?.timeline?.points ?? []).length - 1));
  defaultLevels();
  $('#src').textContent = `${BUNDLE.run} · gen ${g} · built ${String(BUNDLE.built).slice(0, 19).replace('T', ' ')}Z`;
  ladderChips();
  ensureMesh();
  draw();
  panel();
}

// Which age point the page opens on. ?age=<i> wins; with an illustration the page opens on the LAST declared
// point (the adult, the stationary phase), the most legible form, because the first point is often an egg or a
// lag-phase cell. The slider still reaches every earlier stage.
function initialAge() {
  const pts = LADDER?.timeline?.points ?? [];
  if (qs.has('age')) { const a = Number(qs.get('age')); if (Number.isInteger(a) && a >= 0 && a < pts.length) return a; }
  if (MODE === 'mesh' && meshFetchable(meshInfo()) && pts.length) return pts.length - 1;
  return 0;
}

// Never open on an empty stage. A construct has no organs (its own declaration disowns them), so the
// default levels draw nothing in the schematic; switch on the coarsest levels that actually have parts.
// The illustration is never empty, so with a mesh the beads stay off until the reader asks for them.
function defaultLevels() {
  SHOW = { ...DEFAULT_ON };
  if (meshExpected()) return;
  const has = l => (LADDER?.parts ?? []).some(p => p.level === l);
  // The body is a transparent shell, so it does not count as something drawn.
  if (!['organ_system', 'organ'].some(l => SHOW[l] && has(l))) for (const l of ['tissue', 'cell']) if (has(l)) SHOW[l] = true;
}

/* ----------------------------------------------------------- level chips */

function ladderChips() {
  const counts = LADDER?.counts?.ladder ?? {};
  $('#ladder').innerHTML = LEVELS.map(l => {
    const n = l === 'molecule' ? (LADDER?.molecules?.length ?? 0) : (counts[l] ?? 0);
    return `<button class="rung${n ? '' : ' empty'}" data-level="${l}" aria-pressed="${String(Boolean(SHOW[l]))}" ${n ? '' : 'disabled'}>${l.replace('_', ' ')} <span class="n">${n}</span></button>`;
  }).join('');
  for (const b of document.querySelectorAll('.rung')) b.onclick = () => {
    SHOW[b.dataset.level] = !SHOW[b.dataset.level];
    b.setAttribute('aria-pressed', String(SHOW[b.dataset.level]));
    draw();
  };
}

/* ------------------------------------------------------- the illustration */

const meshInfo = () => LADDER?.mesh ?? null;
// A GLB is worth fetching when the build says it made or reused one, or an earlier build left one.
const meshFetchable = m => Boolean(m?.glb && (m.status === 'built' || m.status === 'cached' || m.exists));
function meshExpected() { const m = meshInfo(); return MODE === 'mesh' && meshFetchable(m) && GLB[m.hash]?.status !== 'error'; }
function meshActive() { const m = meshInfo(); return MODE === 'mesh' && Boolean(m && GLB[m.hash]?.status === 'ok'); }

function ensureMesh() {
  const m = meshInfo();
  if (!m || !meshFetchable(m) || GLB[m.hash] || !window.THREE) return;
  const loader = window.THEATRE_LOOK?.loader?.();
  if (!loader) { GLB[m.hash] = { status: 'error', error: 'GLTFLoader did not load' }; return; }
  GLB[m.hash] = { status: 'loading' };
  loader.load(m.glb, gltf => {
    GLB[m.hash] = prepare(gltf, m);
    if (meshInfo()?.hash === m.hash) { draw(); panel(); }
  }, undefined, e => {
    GLB[m.hash] = { status: 'error', error: String(e?.message ?? e).slice(0, 200) };
    if (meshInfo()?.hash === m.hash) { defaultLevels(); ladderChips(); draw(); panel(); }
  });
}

// Index a loaded GLB by the contract's extras: stage roots, slot nodes, their own meshes and their decos.
// Node NAMES are not used: three.js strips ':' from object names, so extras.node carries the real one.
function prepare(gltf, m) {
  const T = window.THREE, root = gltf.scene;
  const rec = { status: 'ok', root, extras: root.userData ?? {}, stages: {}, nodes: [], hash: m.hash, glb: m.glb };
  for (const st of root.children) if (st.userData?.role === 'stage') rec.stages[st.userData.stage] = st;
  for (const [key, st] of Object.entries(rec.stages)) {
    const walk = (o, owner) => {
      const u = o.userData ?? {};
      let mine = owner;
      const requires = Array.isArray(u.requires) && u.requires.length ? u.requires.map(String) : null;
      if (typeof u.node === 'string' && u.node.startsWith('slot:')) {
        const parts = u.node.split(':');
        mine = { key: `${key}|${u.node}`, node: u.node, slot: u.slot, side: u.side ?? 'single', i: parts[3] != null ? Number(parts[3]) : null,
          role: u.role ?? 'interior', stage: key, obj: o, own: [], decos: [], requires, label: u.depicts ?? null, view_note: u.view_note ?? null };
        rec.nodes.push(mine);
      } else if (typeof u.node === 'string' && u.node.startsWith('deco:') && requires) {
        // A deco that DEPICTS a specific part (extras.requires): its own record, styled by that part's state and
        // clickable, never shown just because its parent slot is.
        const parent = owner && !owner.deco ? (owner.isDeco ? owner.decoOwner : owner) : null;
        mine = { key: `${key}|${u.node}|${rec.nodes.length}`, node: u.node, slot: u.slot ?? parent?.slot, side: u.side ?? parent?.side ?? 'single', role: 'deco', deco: true,
          depicts: true, requires, what: u.deco ?? u.node.split(':').pop(), label: u.depicts ?? String(u.deco ?? u.node.split(':').pop()).replace(/_/g, ' '),
          view_note: u.view_note ?? null, parentNode: parent, outer: parent ? parent.role === 'envelope' || parent.role === 'shell' : true, stage: key, obj: o, own: [], decos: [] };
        rec.nodes.push(mine);
      } else if (typeof u.node === 'string' && u.node.startsWith('deco:')) {
        if (!owner || owner.deco) {   // a free deco ('deco:body:chorion'), styled with the slot it names
          mine = { key: `${key}|${u.node}|${rec.nodes.length}`, node: u.node, slot: u.slot, side: u.side ?? 'single', role: 'deco', deco: true, stage: key, obj: o, own: [], decos: [] };
          rec.nodes.push(mine);
        } else mine = { ...owner, isDeco: true, decoOwner: owner };
      }
      if (o.isMesh && mine) {
        const target = mine.isDeco ? mine.decoOwner.decos : mine.own;
        target.push(o);
        o.userData.__orig = o.material;
        o.userData.__node = mine.isDeco ? mine.decoOwner : mine;
        o.userData.__deco = Boolean(mine.isDeco || mine.deco);
      }
      for (const c of o.children) walk(c, mine?.isDeco ? mine : mine);
    };
    for (const c of st.children) walk(c, null);
  }
  // A node's centre is the centre of its OWN meshes: decos hung under it (an egg's chorion under the abdomen
  // region) would otherwise drag the click point and the label away from the part.
  root.updateMatrixWorld(true);
  const box = new T.Box3(), b = new T.Box3(), v = new T.Vector3();
  for (const n of rec.nodes) {
    box.makeEmpty();
    for (const m of n.own) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); box.union(b.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld)); }
    if (box.isEmpty()) box.setFromObject(n.obj);
    n.center = box.getCenter(v).clone();
    // A piece that depicts a part is often a scatter (cilia over one face): its box centre is inside the body.
    // Its label and click point go to the centroid of its own triangle nearest that centre, which is ON the piece
    // (a vertex can sit on a patch's rim, where a ray may slip past it).
    if (n.depicts) {
      let best = Infinity; const c = n.center.clone(), a = new T.Vector3(), b2 = new T.Vector3(), q = new T.Vector3();
      for (const m of n.own) {
        const pos = m.geometry.attributes?.position; if (!pos) continue;
        const idx = m.geometry.index, tris = idx ? idx.count / 3 : pos.count / 3;
        const step = Math.max(1, Math.floor(tris / 20000));
        for (let t = 0; t < tris; t += step) {
          const at = k => (idx ? idx.getX(3 * t + k) : 3 * t + k);
          q.fromBufferAttribute(pos, at(0)).add(a.fromBufferAttribute(pos, at(1))).add(b2.fromBufferAttribute(pos, at(2))).multiplyScalar(1 / 3).applyMatrix4(m.matrixWorld);
          const d = q.distanceToSquared(c); if (d < best) { best = d; n.center.copy(q); }
        }
      }
    }
  }
  return rec;
}

// A mesh piece that DEPICTS one specific part carries extras.requires (ontology ids and/or /label regexes/) and is
// styled by that part's state in the ladder, not by its slot's. The rule is sim-engine/scales/mesh/depicts.mjs; this
// classic script cannot import a module, so the block below is a verbatim copy (test/mesh.mjs keeps them equal).
// >>> depicts
function depictsParse(r) {
  const s = String(r ?? '').trim();
  const m = /^\/(.+)\/([a-z]*)$/.exec(s);
  if (m) { try { return { kind: 're', src: s, re: new RegExp(m[1], m[2].replace(/[gy]/g, '')) }; } catch { return null; } }
  if (/^[A-Za-z][A-Za-z0-9]*[_:][A-Za-z0-9]+$/.test(s)) return { kind: 'id', src: s, id: s.replace(':', '_') };
  return null;
}
function depictState(requires, parts) {
  const list = Array.isArray(requires) ? requires : [];
  const reqs = list.map(depictsParse);
  const ids = reqs.filter(r => r?.kind === 'id'), res = reqs.filter(r => r?.kind === 're');
  const idOf = p => String(p?.ontology_id ?? p?.id ?? '').replace(/^ghost:/, '').replace(':', '_');
  const pool = (Array.isArray(parts) ? parts : []).filter(p => p && p.level !== 'body');
  const byId = pool.filter(p => ids.some(r => r.id === idOf(p)));
  const byLabel = pool.filter(p => !byId.includes(p) && res.some(r => r.re.test(String(p.label ?? ''))));
  const decide = (hits, by) => {
    const real = hits.filter(p => p.from !== 'chain');
    if (real.length) return { state: 'present', rep: real[0], by, matched: real };
    return { state: 'ghost', rep: hits[0], by, matched: hits };
  };
  const out = byId.length ? decide(byId, 'id') : byLabel.length ? decide(byLabel, 'label') : { state: 'absent', rep: null, by: null, matched: [] };
  return { ...out, related: out.by === 'id' ? byLabel : [], valid: list.length > 0 && reqs.every(Boolean), requires: list.map(String) };
}
// <<< depicts

const partLevel = p => LEVELS.indexOf(p.level);
// The ladder's parts that a slot node stands for. A part with side 'single' in a paired slot (a cell type
// inherited from its parent, a ghost) belongs to both sides.
function partsAt(slot, side) {
  return (LADDER?.parts ?? []).filter(p => p.slot === slot && (side === 'single' || p.side === side || p.side === 'single'));
}
const bodyPart = () => (LADDER?.parts ?? []).find(p => p.level === 'body') ?? null;

// Does this part make its slot's sculpted organ SOLID? In a frame whose slots are organs (insect, tetrapod...),
// only an organ, an organ system or a part placed by the slot's own Uberon id does: the frame's label patterns
// are broad, and a cell type they catch ('alarm substance cell' by /arm/) must not turn into a sculpted forelimb.
// A prokaryote or a construct is made of cells, so there a cell is a part of the plan.
const CELL_FRAMES = new Set(['prokaryote', 'construct']);
const ORGAN_LEVELS = new Set(['body', 'organ_system', 'organ']);
function makesSolid(p) {
  if (CELL_FRAMES.has(LADDER?.frame?.name)) return true;
  return ORGAN_LEVELS.has(p.level) || /^uberon /.test(String(p.matched_by ?? ''));
}

function classify(n) {
  // A node that depicts a specific part (extras.requires) follows THAT part: present / ghost / absent.
  if (n.requires) { const d = depictState(n.requires, LADDER?.parts ?? []); return { state: d.state, rep: d.rep, parts: d.matched, depicts: d }; }
  if (n.deco && n.slot === 'body') { const b = bodyPart(); return { state: b ? 'body' : 'absent', rep: b, parts: b ? [b] : [] }; }
  const parts = partsAt(n.slot, n.side);
  const real = parts.filter(p => p.from !== 'chain').sort((a, b) => partLevel(a) - partLevel(b));
  const solid = real.filter(makesSolid);
  if (solid.length) return { state: 'present', rep: solid[0], parts };
  const ghosts = parts.filter(p => p.from === 'chain').sort((a, b) => partLevel(a) - partLevel(b));
  if (ghosts.length) return { state: 'ghost', rep: ghosts[0], parts };
  // An envelope region holding only cells stays the neutral body (the silhouette needs it); its cells are listed
  // on the body's card. Any other slot holding only cells says so.
  if (n.role === 'envelope') { const b = bodyPart(); if (b) return { state: 'body', rep: b, parts: [b, ...real] }; }
  if (real.length) return { state: 'cells', rep: real[0], parts };
  return { state: 'absent', rep: null, parts: [] };
}

function stageKey() {
  const m = meshInfo(), G = m && GLB[m.hash];
  const want = m?.stage_of_point?.[AGE] ?? m?.stages?.[0];
  if (G?.stages?.[want]) return want;
  return Object.keys(G?.stages ?? {})[0] ?? want ?? null;
}
const currentNodes = () => { const m = meshInfo(), G = m && GLB[m.hash]; const k = stageKey(); return (G?.nodes ?? []).filter(n => n.stage === k); };

const isDark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light')) === 'dark';

function styleMesh(G) {
  const T = window.THREE;
  const key = stageKey();
  for (const [k, st] of Object.entries(G.stages)) st.visible = k === key;
  for (const x of EXTRAS) x.parent?.remove(x);
  EXTRAS = [];
  STYLE = new Map();
  const nodes = G.nodes.filter(n => n.stage === key);
  for (const n of nodes) if (!(n.deco && n.slot !== 'body') || n.requires) STYLE.set(n, classify(n));
  // A free deco named for a slot ('deco:<slot>:<what>') is shown, hidden and ghosted with that slot's node.
  for (const n of nodes) if (n.deco && n.slot !== 'body' && !n.requires) {
    const owner = nodes.find(o => !o.deco && o.slot === n.slot && (o.side === n.side || n.side === 'single'));
    STYLE.set(n, owner ? STYLE.get(owner) : classify(n));
  }
  const interiorShown = nodes.some(n => n.role === 'interior' && ['present', 'ghost', 'cells'].includes(STYLE.get(n).state)) || BEAD_LEVELS.some(l => SHOW[l]);
  const shellPresent = nodes.some(n => n.role === 'shell' && STYLE.get(n).state === 'present');
  const selNodes = new Set(selectedNodes(nodes));
  const dark = isDark();
  const ghostCol = new T.Color(dark ? 0x9a7ae8 : 0x6b4fb3);
  const accent = new T.Color(dark ? 0x38b6c1 : 0x0e7c86);
  const neutral = new T.Color(dark ? 0x9fb0ac : 0xc3ccc9);
  const rimCol = new T.Color(dark ? 0xe3ece9 : 0x2c3836);
  const o = { interiorShown, shellPresent, ghostCol, accent, neutral, rimCol, dark, anySel: selNodes.size > 0 };
  for (const n of nodes) {
    const s = STYLE.get(n);
    const roleFor = n.depicts ? (n.outer ? 'envelope' : 'interior') : n.role;
    const showRole = roleFor === 'envelope' || roleFor === 'shell' || (n.deco && n.slot === 'body') ? SHOW.body !== false : SHOW.organ !== false || SHOW.organ_system !== false;
    const visible = showRole && (s.state !== 'absent' || SHOW_ABSENT);
    n.obj.visible = visible;
    n.state = s.state;
    n.carrier = false;
    const sel = selNodes.has(n);
    const look = { ...o, sel, dim: o.anySel && !sel };
    for (const mesh of n.own) {
      mesh.userData.__carrier = false;
      mesh.material = materialFor(mesh, s.state, n.depicts ? 'depicts' : n.deco ? 'deco' : n.role, look);
      order(mesh, s.state, n.depicts ? (n.outer ? 'deco-outer' : 'deco') : n.deco ? 'deco-free' : n.role);
      if (visible && sel && !n.deco) outline(mesh, accent);
    }
    for (const mesh of n.decos) {
      mesh.visible = s.state === 'present' || s.state === 'body';
      if (mesh.visible) { mesh.material = materialFor(mesh, s.state, 'deco', look); order(mesh, s.state, n.role === 'envelope' || n.role === 'shell' ? 'deco-outer' : 'deco'); }
    }
  }
  // A piece that depicts a part the blueprint HAS, under a slot that is hidden (a larva's salivary glands under a
  // gut the blueprint lacks): three.js hides children with their parent, so the parent stays in the scene as an
  // invisible, unpickable carrier, its own surface and its generic decos not drawn.
  for (const n of nodes) {
    if (!n.depicts || !n.obj.visible) continue;
    for (let p = n.parentNode; p && !p.obj.visible; p = p.parentNode) {
      p.obj.visible = true; p.carrier = true;
      for (const mesh of p.own) { mesh.userData.__carrier = true; mesh.material = carrierMaterial(); }
      for (const mesh of p.decos) mesh.visible = false;
    }
  }
  return nodes;
}

// Draw order for the translucent layers. Everything inside the body is drawn first; then the envelope regions
// (head, thorax, abdomen, trunk...) write depth only, and are drawn again blended: so only the FRONT-MOST
// envelope surface is blended over the inside. Without that, two overlapping translucent regions (a thorax
// over the abdomen's front pole, an egg's fate-map bands) showed their buried poles and rims as discs and rings,
// which also flickered with sort order as the body turned. The shell (cuticle, skin) comes last, as the outer glass.
// The invisible stand-in a hidden slot becomes while it carries a visible piece that depicts a part (see styleMesh).
function carrierMaterial() {
  carrierMaterial.m ??= new window.THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 });
  return carrierMaterial.m;
}
function depthOnly() {
  depthOnly.m ??= new window.THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: window.THREE.DoubleSide });
  return depthOnly.m;
}
function order(mesh, state, role) {
  const m = mesh.material;
  mesh.renderOrder = 0;
  if (!m?.transparent) return;
  if (role === 'envelope' && (state === 'body' || state === 'present')) {
    mesh.renderOrder = 2;
    const pre = new window.THREE.Mesh(mesh.geometry, depthOnly());
    pre.renderOrder = 1; pre.raycast = () => {}; pre.userData.helper = true;
    mesh.add(pre); EXTRAS.push(pre);
  } else if (role === 'deco-outer' || role === 'deco-free') mesh.renderOrder = 3;
  else if (role === 'shell') mesh.renderOrder = 4;
}

// The selected node gets an accent outline: an inverted hull (its own geometry pushed out along the normals,
// back faces only), so the part the card is about reads at a glance even when it is small or translucent.
function outline(mesh, accent) {
  const T = window.THREE;
  outline.mats ??= {};
  const k = accent.getHex();
  const mat = outline.mats[k] ??= (() => {
    const m = new T.MeshBasicMaterial({ color: accent, side: T.BackSide, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
    m.userData.hull = { value: 0.016 };
    m.onBeforeCompile = sh => {
      sh.uniforms.uHull = m.userData.hull;
      sh.vertexShader = 'uniform float uHull;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uHull;');
    };
    m.customProgramCacheKey = () => 'delphi-hull';
    return m;
  })();
  mat.userData.hull.value = 0.01 / Math.max(0.25, viewScale());
  const hull = new T.Mesh(mesh.geometry, mat);
  hull.renderOrder = 5; hull.raycast = () => {}; hull.userData.helper = true;
  mesh.add(hull); EXTRAS.push(hull);
}

// Colour work done in the shader, so a body keeps its sculpted vertex colours: `tintK` mixes the surface colour
// toward a neutral (the body is desaturated, not blanked), and a view-angle (fresnel) rim darkens (light page) or
// lightens (dark page) the silhouette and makes it more opaque, so a translucent body holds its outline.
function shade(m, { tint = null, tintK = 0, rim = null, rimK = 0, rimA = 0, power = 2.4 }) {
  const T = window.THREE;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTint = { value: tint ?? new T.Color(1, 1, 1) }; sh.uniforms.uTintK = { value: tintK };
    sh.uniforms.uRim = { value: rim ?? new T.Color(0, 0, 0) }; sh.uniforms.uRimK = { value: rimK };
    sh.uniforms.uRimA = { value: rimA }; sh.uniforms.uRimP = { value: power };
    sh.fragmentShader = 'uniform vec3 uTint; uniform float uTintK; uniform vec3 uRim; uniform float uRimK; uniform float uRimA; uniform float uRimP;\n'
      + sh.fragmentShader
        .replace('#include <color_fragment>', ['#include <color_fragment>',
          // desaturate toward the neutral's hue at the surface's OWN luminance, so banding and tone survive
          '  { float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); float tl = max(dot(uTint, vec3(0.2126, 0.7152, 0.0722)), 1e-3);',
          '    diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (lum / tl), uTintK); }'].join('\n'))
        .replace('#include <opaque_fragment>', [
          '{ float fr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), uRimP);',
          '  outgoingLight = mix(outgoingLight, uRim, fr * uRimK);',
          '  diffuseColor.a = mix(diffuseColor.a, 1.0, fr * uRimA); }',
          '#include <opaque_fragment>'].join('\n'));
  };
  m.customProgramCacheKey = () => 'delphi-shade';
  return m;
}

// One material per (mesh, look), cached on the mesh, so restyling on every click allocates nothing new.
function materialFor(mesh, state, role, o) {
  const T = window.THREE, orig = mesh.userData.__orig;
  const look = `${state}|${role}|${o.sel ? 1 : 0}|${o.dim ? 1 : 0}|${o.interiorShown ? 1 : 0}|${o.shellPresent ? 1 : 0}|${o.dark ? 1 : 0}|${BEAD_LEVELS.some(l => SHOW[l]) ? 1 : 0}`;
  mesh.userData.__mats ??= {};
  if (mesh.userData.__mats[look]) return mesh.userData.__mats[look];
  let m;
  if (state === 'ghost') {
    // Violet carries "named by the literature, not in this blueprint", so it must survive a dark page too.
    // A piece that depicts a part (thin cilia, small cell patches) needs more body than a whole organ to read at all.
    const op = role === 'depicts' ? (o.sel ? 0.85 : o.dark ? 0.66 : 0.58) : o.sel ? 0.6 : o.dark ? 0.38 : 0.26;
    m = new T.MeshPhysicalMaterial({ color: o.ghostCol, roughness: 0.35, transparent: true, opacity: o.dim ? op * 0.6 : op, depthWrite: Boolean(o.sel),
      emissive: o.ghostCol, emissiveIntensity: o.sel ? 0.8 : o.dark ? 0.42 : 0.25, side: T.DoubleSide });
    shade(m, { rim: o.ghostCol, rimK: 0.5, rimA: 0.35 });
  } else if (state === 'absent') {
    m = new T.MeshBasicMaterial({ color: o.neutral, transparent: true, opacity: o.sel ? 0.25 : 0.07, depthWrite: false, wireframe: true });
  } else if (state === 'cells') {
    // Only cells or tissues land here: a translucent outline in that level's colour, never a solid organ.
    const p = STYLE.get(mesh.userData.__node)?.rep;
    const col = new T.Color(LEVEL_COLOUR[p?.level] ?? 0xa8650b);
    if (o.dark) col.lerp(new T.Color(0xffffff), 0.25);
    m = new T.MeshStandardMaterial({ color: col, roughness: 0.5, transparent: true, opacity: o.sel ? 0.45 : o.dim ? 0.08 : 0.14, depthWrite: Boolean(o.sel),
      emissive: col, emissiveIntensity: o.sel ? 0.6 : 0.2, side: T.DoubleSide });
    shade(m, { rim: col, rimK: 0.6, rimA: 0.55, power: 2.0 });
  } else {
    m = orig.clone();
    if (state === 'body') {
      // The body keeps its sculpted colours, desaturated toward a neutral, so it reads as "the organism" behind
      // the parts drawn at full colour, without turning into colourless glass.
      shade(m, { tint: o.neutral, tintK: 0.32, rim: o.rimCol, rimK: o.dark ? 0.35 : 0.3, rimA: 0.5 });
    }
    const veil = role === 'shell' ? (o.shellPresent ? 0.22 : 0.15) : role === 'envelope' ? (o.shellPresent ? 0.3 : 0.64) : null;
    if (veil != null && o.interiorShown) { m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, veil); m.depthWrite = false; }
    else if (role === 'shell') { m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.3); m.depthWrite = false; }
    if (role === 'interior' && BEAD_LEVELS.some(l => SHOW[l])) { m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.55); m.depthWrite = false; }
    // While something is selected, every other solid part steps back, so the selection stands out.
    if (o.dim && state === 'present' && role !== 'envelope' && role !== 'shell') { m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.35); m.depthWrite = false; }
    if (o.sel && 'emissive' in m) { m.emissive = o.accent.clone(); m.emissiveIntensity = 0.45; }
    if (o.sel && m.transparent) { m.opacity = Math.max(m.opacity, 0.6); m.depthWrite = true; }
  }
  mesh.userData.__mats[look] = m;
  return m;
}

function selectedNodes(nodes) {
  if (SEL?.kind === 'slot') return nodes.filter(n => n.key === SEL.nodeKey);
  if (SEL?.kind !== 'part') return [];
  if (SEL.nodeKey) {
    const hit = nodes.filter(n => n.key === SEL.nodeKey);
    // the pieces that depict the same part (a construct's multiciliated cells and their cilia) light up together
    const r = hit[0]?.requires?.join('|');
    if (r) return nodes.filter(n => n.requires?.join('|') === r);
    if (hit.length) return hit;
  }
  const p = SEL.part;
  if (p.level === 'body') return nodes.filter(n => STYLE.get(n)?.state === 'body');
  // A piece that depicts a part is selected with that part (and only with it), not with its slot.
  return nodes.filter(n => n.requires ? STYLE.get(n)?.rep?.id === p.id
    : n.slot === p.slot && (p.side === 'single' || n.side === p.side || n.side === 'single'));
}

/* ------------------------------------------------------------------ 3D */

function geomFor(shape, r) {
  const T = window.THREE;
  switch (shape) {
    case 'sphere': case 'blob': return new T.SphereGeometry(r, 18, 14);
    case 'capsule': return T.CapsuleGeometry ? new T.CapsuleGeometry(r * 0.55, r * 1.1, 8, 14) : new T.SphereGeometry(r, 16, 12);
    case 'body': return new T.SphereGeometry(r, 24, 18);
    case 'shell': return new T.SphereGeometry(r, 22, 16);
    case 'rod': return new T.CylinderGeometry(r * 0.17, r * 0.12, r * 1.8, 10);
    case 'tube': return new T.CylinderGeometry(r * 0.2, r * 0.2, r * 1.7, 10, 1, true);
    case 'blade': return new T.BoxGeometry(r * 1.7, r * 0.06, r * 1.1);
    case 'cone': return new T.ConeGeometry(r * 0.7, r * 1.4, 14);
    case 'helix': return new T.TorusKnotGeometry(r * 0.5, r * 0.07, 70, 6, 2, 3);
    case 'frame': return new T.BoxGeometry(r * 1.4, r * 1.2, r * 0.9);
    case 'cluster': return new T.SphereGeometry(Math.max(r, 0.012), 8, 6);
    default: return new T.SphereGeometry(r, 14, 10);
  }
}

function draw() {
  const T = window.THREE, cv = $('#cv');
  if (!T) {
    if (!$('#nothree')) $('#stage').insertAdjacentHTML('beforeend', `<div id="nothree" class="card err" style="position:absolute;left:12px;top:12px;max-width:60%"><b>three.js did not load</b><p class="note">The body cannot be drawn. Every number in the panel is still here, and the parts are in <span class="mono">runs/${esc(BUNDLE?.run ?? '')}/scales/</span>.${window.THREE_LOAD_ERROR ? ` (${esc(window.THREE_LOAD_ERROR)})` : ''}</p></div>`);
    badges(); return;
  }
  if (!renderer) {
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    scene = new T.Scene();
    window.THEATRE_LOOK?.setup(T, renderer, scene);
    shadow = window.THEATRE_LOOK?.contactShadow(T, { radius: 2.0 }) ?? null;
    if (shadow) scene.add(shadow);
    // A faint body axis, so "anterior" means something on screen (schematic mode).
    const ag = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([-1.6, 0, 0, 1.6, 0, 0], 3));
    axisLine = new T.Line(ag, new T.LineBasicMaterial({ color: 0x8aa09c, transparent: true, opacity: 0.35 }));
    scene.add(axisLine);
    camera = new T.PerspectiveCamera(40, 1, 0.05, 100);
    raycaster = new T.Raycaster();
    bindStage(cv);
    requestAnimationFrame(tick);
  }
  if (group) {
    scene.remove(group);
    for (const c of group.children) if (c.userData?.kind) { c.geometry?.dispose(); c.material?.dispose(); }
  }
  group = new T.Group();
  scene.add(group);
  meshes = [];
  const G = meshActive() ? GLB[meshInfo().hash] : null;
  let nodes = [];
  if (G) {
    group.add(G.root);
    nodes = styleMesh(G);
    for (const n of nodes) if (n.obj.visible) for (const m of n.own) if (!m.userData.__carrier) meshes.push(m);
  }
  if (shadow) shadow.material.opacity = isDark() ? 0.75 : 0.5;
  axisLine.visible = !G;

  const parts = (LADDER?.parts ?? []).filter(p => SHOW[p.level] && (!G || BEAD_LEVELS.includes(p.level)));
  BEADS_HIDDEN = { n: 0, slots: new Set() };
  for (const p of parts) {
    const at = G ? beadAt(p, nodes) : null;
    if (G && !at) { BEADS_HIDDEN.n++; BEADS_HIDDEN.slots.add(p.slot); continue; }
    const isSel = SEL && SEL.kind === 'part' && SEL.id === p.id;
    const col = LEVEL_COLOUR[p.level] ?? 0x888888;
    const shell = p.shape === 'shell' || p.level === 'body' || p.shape === 'frame';
    const m = new T.Mesh(geomFor(G ? 'cluster' : p.shape, G ? Math.min(p.r ?? 0.05, 0.035) : (p.r ?? 0.1)), new T.MeshStandardMaterial({
      color: col, roughness: 0.45, metalness: 0.05,
      transparent: true, opacity: isSel ? 1 : (shell ? 0.1 : (SEL ? 0.3 : 0.86)),
      wireframe: shell && !isSel, depthWrite: !shell,
      emissive: isSel ? col : 0x000000, emissiveIntensity: isSel ? 0.45 : 0,
    }));
    if (at) m.position.copy(at); else m.position.set(p.pos.x * 2, p.pos.y * 2, p.pos.z * 2);
    if (!G && (p.shape === 'rod' || p.shape === 'tube')) m.rotation.z = Math.PI / 2.4;
    if (!G && p.shape === 'blade') m.rotation.x = p.side === 'left' ? -0.18 : 0.18;
    m.userData = { kind: 'part', part: p };
    group.add(m); meshes.push(m);
  }
  if (SHOW.molecule) for (const mo of (LADDER?.molecules ?? [])) {
    if (!mo.pos) continue;
    const isSel = SEL && SEL.kind === 'molecule' && SEL.id === mo.id;
    const m = new T.Mesh(new T.SphereGeometry(isSel ? 0.035 : 0.018, 8, 6),
      new T.MeshStandardMaterial({ color: LEVEL_COLOUR.molecule, roughness: 0.4, transparent: true, opacity: isSel ? 1 : 0.8,
        emissive: isSel ? LEVEL_COLOUR.molecule : 0x000000, emissiveIntensity: isSel ? 0.6 : 0 }));
    m.position.set(mo.pos.x * 2, mo.pos.y * 2, mo.pos.z * 2);
    m.userData = { kind: 'molecule', molecule: mo };
    group.add(m); meshes.push(m);
  }

  // The age axis: the body is redrawn at the declared length ratio. Linear scale IS the isometric drawing,
  // and the panel says so and says it is declared. The view is divided by the largest ratio on the track,
  // so the biggest declared stage fits and every other one is drawn at its declared size relative to it.
  group.scale.setScalar(viewScale());
  if (shadow) {
    group.rotation.set(0, 0, 0); group.updateMatrixWorld(true);
    const box = visibleBox(group);
    const lo = isFinite(box.min.y) ? box.min.y : -0.6 * viewScale();

    shadow.position.set(0, lo - 0.04, 0);
    shadow.scale.setScalar(Math.max(0.25, viewScale()));
  }
  badges();
  labels(nodes);
  LABEL_BOX = null;
  if (LABELS.length) {
    const ry = group.rotation.y, rx = group.rotation.x, sc = group.scale.x;
    group.rotation.set(0, 0, 0); group.scale.setScalar(1); group.updateMatrixWorld(true);
    LABEL_BOX = visibleBox(group);
    group.rotation.set(rx, ry, 0); group.scale.setScalar(sc); group.updateMatrixWorld(true);
  }
  resize();
  autoFit();
}

// Where a tissue or cell bead goes in illustrated mode. The ladder positions are the frame's ADULT slot
// positions; each stage form puts its organs elsewhere (a larva has no eyes, and its gonads sit further back),
// so a bead is drawn at its offset from its slot, carried onto THIS stage's node for that slot. A bead whose slot
// has no node in this form is not drawn (the stage note says how many and which slots), rather than floating in
// the air where the adult's organ would be.
function beadAt(p, nodes) {
  const T = window.THREE;
  const P = new T.Vector3(p.pos.x * 2, p.pos.y * 2, p.pos.z * 2);
  if (!p.slot || p.slot === 'body') return P;
  const fs = (LADDER?.frame?.slots ?? []).find(x => x.slot === p.slot);
  const cands = nodes.filter(n => !n.deco && n.slot === p.slot && (n.side === 'single' || p.side === 'single' || n.side === p.side));
  if (!cands.length || !fs) return null;
  const sgn = p.side === 'left' || (p.side === 'single' && fs.side === 'paired' && p.pos.z < 0) ? -1 : 1;
  const slotPos = new T.Vector3(fs.x * 2, fs.y * 2, (fs.side === 'paired' ? sgn : 1) * fs.z * 2);
  const near = cands.reduce((a, b) => (a.center.distanceTo(slotPos) <= b.center.distanceTo(slotPos) ? a : b));
  return near.center.clone().add(P.sub(slotPos));
}

// Frame the body: the camera distance at which the visible box fits the canvas at EVERY spin angle, in both
// the vertical and the horizontal field of view (a portrait phone is limited by the horizontal one), with a
// margin. The group spins about the vertical axis through the origin, so the box is taken unrotated and turned.
function fitDistance(margin = 0.1) {
  const T = window.THREE;
  if (!camera || !group) return null;
  const ry = group.rotation.y, rx = group.rotation.x;
  group.rotation.set(0, 0, 0); group.updateMatrixWorld(true);
  const box = visibleBox(group);
  group.rotation.set(rx, ry, 0); group.updateMatrixWorld(true);
  if (!isFinite(box.min.x)) return null;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new T.Vector3(x, y, z));
  const tv = Math.tan(T.MathUtils.degToRad(camera.fov) / 2) * (1 - margin);
  const th = tv * camera.aspect;
  const dir = camera.position.clone().normalize();
  const up = new T.Vector3(0, 1, 0), right = new T.Vector3().crossVectors(up, dir).normalize(), camUp = new T.Vector3().crossVectors(dir, right);
  const e = new T.Euler(), q = new T.Vector3();
  let need = 0.6;
  for (let i = 0; i < 24; i++) {
    e.set(pitch, (2 * Math.PI * i) / 24, 0);
    for (const c of corners) {
      q.copy(c).applyEuler(e);
      const along = q.dot(dir), sx = Math.abs(q.dot(right)), sy = Math.abs(q.dot(camUp));
      need = Math.max(need, along + sx / th, along + sy / tv);
    }
  }
  return need;
}
function fit() {
  const d = fitDistance();
  if (d != null) camera.position.setLength(d);
}
// The first drawing of each ladder is framed automatically, and so is every stage that would not fit at the
// current distance (a 9x larva after the adult); a smaller stage stays small, because stages are drawn to scale
// with each other. Once the reader zooms, the page leaves the camera alone.
function autoFit() {
  if (!AUTOFIT || !camera || !group) return;
  const key = `${BUNDLE?.run}|${LADDER?.generation}|${meshActive() ? 'mesh' : 'schematic'}`;
  const d = fitDistance();
  if (d == null) return;
  if (FITTED !== key) { FITTED = key; camera.position.setLength(d); }
  else if (d > camera.position.length() * 1.02) camera.position.setLength(d);
}

function viewScale() {
  const pts = LADDER?.timeline?.points ?? [];
  const ratio = pts[AGE]?.length_ratio ?? 1;
  const max = Math.max(1, ...pts.map(p => p.length_ratio ?? 1));
  return (ratio || 1) / max;
}

function setMode(m) {
  MODE = m;
  defaultLevels(); ladderChips();
  ensureMesh(); draw(); panel();
}

function badges() {
  const m = meshInfo(), G = m && GLB[m.hash];
  const b = $('#meshbadge');
  let txt, cls = '';
  if (!window.THREE) { txt = 'three.js did not load — no 3D view; the panel still has everything'; cls = 'bad'; }
  else if (meshActive()) { txt = 'illustration sculpted in Blender — shapes are not measured'; cls = 'ill'; }
  else if (MODE === 'schematic') txt = 'schematic primitives — positions declared, not measured';
  else if (m && meshFetchable(m) && !G) txt = 'loading the illustration…';
  else if (!m) txt = 'no mesh field in this bundle — schematic shown (rebuild with node sim-engine/scales/build.mjs --meshes)';
  else if (G?.status === 'loading') txt = 'loading the illustration…';
  else if (G?.status === 'error') {
    // A fetch error carries the whole URL; the file name is what a reader can act on.
    const e = String(G.error ?? '').replace(/https?:\/\/\S*\/([^/\s]+)/g, '$1');
    txt = `mesh could not be loaded: ${e.slice(0, 120)} — schematic shown`; cls = 'bad';
  }
  else if (m.status === 'no-blender') {
    // Name the actual cause: a DELPHI_BLENDER that points at nothing is not fixed by "set DELPHI_BLENDER".
    const w = String(m.why ?? '');
    txt = /which is a folder/.test(w) ? 'mesh not built: DELPHI_BLENDER points at a folder, not the Blender executable — schematic shown'
      : /points at/.test(w) ? 'mesh not built: DELPHI_BLENDER points at a file that does not exist — schematic shown'
      : /switched off/.test(w) ? 'mesh not built: Blender switched off (DELPHI_BLENDER=none) — schematic shown'
      : 'mesh not built: Blender not found (set DELPHI_BLENDER) — schematic shown';
    cls = 'bad';
  }
  else if (m.status === 'failed') { txt = `mesh build failed: ${String(m.why ?? '').split('\n')[0].slice(0, 140)} — schematic shown`; cls = 'bad'; }
  else if (!m.glb) txt = `no illustration for the ${m.frame} frame — schematic shown`;
  else txt = 'mesh not requested — schematic shown (build with node sim-engine/scales/build.mjs --meshes)';
  if (b) { b.textContent = txt; b.className = `badge ${cls}`; }
  const can = Boolean(m && meshFetchable(m) && G?.status !== 'error');
  $('#m-mesh').setAttribute('aria-pressed', String(MODE === 'mesh'));
  $('#m-schem').setAttribute('aria-pressed', String(MODE !== 'mesh'));
  $('#m-mesh').disabled = !can;
  $('#absent').setAttribute('aria-pressed', String(SHOW_ABSENT));
  $('#absent').hidden = !meshActive();
  $('#legend').hidden = !meshActive();
}

// Ghosts and cells-only slots are always labelled; absent slots are labelled when they are shown, unless there
// are more than ABSENT_LABEL_MAX of them (then the hover says it, and the column stays readable).
const ABSENT_LABEL_MAX = 6;
// A ghost's label is the chain part's label, which may name another stage's anatomy ("adult brain" on the larva
// form). Then the label leads with the slot and quotes the chain's name, so a larva view does not assert adult
// anatomy.
const STAGE_WORDS = { adult: /\b(adult|imago|imaginal)\b/i, larva: /\b(larva|larval|instar)\b/i, pupa: /\b(pupa|pupal|puparium)\b/i,
  egg: /\b(egg|embryo|embryonic)\b/i, neonate: /\b(neonate|neonatal|newborn)\b/i, juvenile: /\b(juvenile|weanling)\b/i };
function ghostText(rep, slot) {
  const k = meshActive() ? stageKey() : null;
  const other = k && Object.entries(STAGE_WORDS).some(([st, re]) => st !== k && re.test(rep.label) && !(STAGE_WORDS[k]?.test(rep.label)));
  return other ? `${slot.replace(/_/g, ' ')} — the chain names the ${rep.label}; not in this blueprint`
    : `${rep.label} — literature only, not in this blueprint`;
}
let LABELS = [], LABEL_BOX = null;
function labels(nodes) {
  const box = $('#labels');
  if (!box) return;
  LABELS = [];
  const seen = new Set();
  const nAbsent = new Set(nodes.filter(n => n.obj.visible && !n.carrier && !n.deco && STYLE.get(n)?.state === 'absent').map(n => n.slot)).size;
  for (const n of nodes) {
    const s = STYLE.get(n);
    // A piece that depicts a part is labelled when it is a ghost (always) or absent and shown; one label per part.
    if (n.depicts && n.obj.visible && s && (s.state === 'ghost' || s.state === 'absent')) {
      const k = `depicts|${n.requires.join('|')}|${s.state}`;
      if (seen.has(k)) continue; seen.add(k);
      const text = s.state === 'ghost' ? `${n.label} — literature only, not in this blueprint` : `${n.label} — not in this blueprint`;
      LABELS.push({ n, text, cls: s.state, side: null });
      continue;
    }
    if (!n.obj.visible || n.carrier || !s || n.deco) continue;
    if (!['ghost', 'absent', 'cells'].includes(s.state)) continue;
    if (s.state === 'absent' && nAbsent > ABSENT_LABEL_MAX) continue;
    const k = `${n.slot}|${s.state}`;
    if (seen.has(k)) continue; seen.add(k);
    const text = s.state === 'ghost' ? ghostText(s.rep, n.slot)
      : s.state === 'cells' ? `${s.rep.label} (${s.rep.level}) — cells only, no ${n.slot.replace(/_/g, ' ')} organ`
        : `${n.slot.replace(/_/g, ' ')} — not in this blueprint`;
    LABELS.push({ n, text, cls: s.state, side: null });
  }
  if (SHOW_ABSENT && nAbsent > ABSENT_LABEL_MAX) LABELS.push({ n: null, text: `${nAbsent} absent slots as faint outlines · hover for names`, cls: 'absent note-lab', side: null });
  box.innerHTML = '<svg id="leaders" aria-hidden="true"></svg>' + LABELS.map((l, i) => `<span class="lab ${l.cls}" data-i="${i}">${esc(l.text)}</span>`).join('');
}

// Labels sit OUTSIDE the body, each joined to its node by a thin leader line: in a column to the left or right
// of the body's projected box when there is room there, otherwise in a band above or below it. Labels never run
// off the canvas, and a label keeps its side until its node clearly crosses the middle (no flicker while spinning).
function placeLabels() {
  const svg = $('#leaders');
  if (!LABELS.length || !camera || !group) { if (svg) svg.innerHTML = ''; return; }
  const T = window.THREE, r = $('#cv').getBoundingClientRect(), W = r.width, H = r.height;
  const v = new T.Vector3();
  const proj = p => { v.copy(p).project(camera); return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, behind: v.z > 1 }; };
  // the body's projected box, from the visible box's corners
  // the body's box is measured once per draw (unrotated, in the group's frame) and only projected here
  const bb = LABEL_BOX;
  let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
  if (bb && isFinite(bb.min.x)) for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
    const q = proj(group.localToWorld(new T.Vector3(x, y, z))); bx0 = Math.min(bx0, q.x); bx1 = Math.max(bx1, q.x); by0 = Math.min(by0, q.y); by1 = Math.max(by1, q.y);
  }
  bx0 = Math.max(0, bx0); bx1 = Math.min(W, bx1); by0 = Math.max(0, by0); by1 = Math.min(H, by1);
  const items = LABELS.map((l, i) => {
    const el = $(`#labels .lab[data-i="${i}"]`);
    const w = el?.offsetWidth || 160, h = (el?.offsetHeight || 16) + 4;
    if (!l.n) return { i, el, w, h, free: true };
    const a = proj(l.n.obj.parent ? l.n.obj.parent.localToWorld(v.copy(l.n.center)).clone() : l.n.center);
    return { i, el, w, h, ax: a.x, ay: a.y, behind: a.behind, l };
  });
  const roomL = bx0 - 12, roomR = W - bx1 - 12;
  const widest = Math.max(...items.map(it => it.w));
  const columns = Math.max(roomL, roomR) >= Math.min(widest, 220);
  const midX = (bx0 + bx1) / 2, midY = (by0 + by1) / 2;
  const lines = [];
  const groups = { a: [], b: [] };
  for (const it of items) {
    if (it.free) continue;
    const prev = it.l.side;
    if (columns) {
      let side = prev ?? (it.ax < midX ? 'a' : 'b');
      if (prev === 'a' && it.ax > midX + 30) side = 'b';
      if (prev === 'b' && it.ax < midX - 30) side = 'a';
      if (side === 'a' && roomL < Math.min(it.w, 220)) side = 'b';
      if (side === 'b' && roomR < Math.min(it.w, 220)) side = 'a';
      it.l.side = side;
    } else it.l.side = it.ay < midY ? 'a' : 'b';
    groups[it.l.side].push(it);
  }
  const clampX = (x, w) => Math.max(4, Math.min(W - w - 4, x));
  for (const [side, list] of Object.entries(groups)) {
    if (columns) {
      list.sort((p, q) => p.ay - q.ay);
      const total = list.reduce((t, it) => t + it.h, 0);
      let y = Math.max(6, Math.min(H - total - 6, midY - total / 2));
      // keep each label near its node's height where the column allows
      for (const it of list) { y = Math.max(y, Math.min(it.ay - it.h / 2, H - it.h - 6)); it.y = y; y += it.h; }
      const over = y - (H - 6);
      if (over > 0) for (const it of list) it.y -= over;
      for (const it of list) it.x = side === 'a' ? clampX(bx0 - 14 - it.w, it.w) : clampX(bx1 + 14, it.w);
    } else {
      list.sort((p, q) => p.ax - q.ax);
      let y = side === 'a' ? Math.max(4, by0 - 10 - list.length * list[0]?.h) : Math.min(H - 6, by1 + 10);
      if (side === 'a' && list.length) y = Math.max(4, by0 - 10 - list.reduce((t, it) => t + it.h, 0));
      for (const it of list) { it.y = Math.min(y, H - it.h - 4); it.x = clampX(it.ax - it.w / 2, it.w); y += it.h; }
    }
  }
  let fy = 6;
  for (const it of items) {
    if (!it.el) continue;
    if (it.free) { it.el.style.transform = `translate(${clampX(W - it.w - 8, it.w)}px, ${fy}px)`; it.el.style.opacity = 1; fy += it.h; continue; }
    it.el.style.transform = `translate(${it.x}px, ${it.y}px)`;
    it.el.style.opacity = it.behind ? 0 : 1;
    if (it.behind) continue;
    // the leader: from the label's near edge (or its top/bottom middle, in a band) to the node's centre
    const ex = columns ? (it.l.side === 'a' ? it.x + it.w : it.x) : Math.max(it.x + 6, Math.min(it.x + it.w - 6, it.ax));
    const ey = columns ? it.y + it.h / 2 - 2 : (it.l.side === 'a' ? it.y + it.h - 4 : it.y);
    lines.push(`<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${it.ax.toFixed(1)}" y2="${it.ay.toFixed(1)}" class="${it.l.cls}"/><circle cx="${it.ax.toFixed(1)}" cy="${it.ay.toFixed(1)}" r="2.4" class="${it.l.cls}"/>`);
  }
  // sized to the CANVAS (on a phone #stage also holds the footer, and a 100%-high svg would centre the viewBox)
  if (svg) { svg.style.width = `${W}px`; svg.style.height = `${H}px`; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = lines.join(''); }
}

function bindStage(cv) {
  const down = e => { dragging = { x: e.clientX ?? e.touches[0].clientX, y: e.clientY ?? e.touches[0].clientY, moved: 0 }; };
  const move = e => {
    const x = e.clientX ?? e.touches?.[0]?.clientX, y = e.clientY ?? e.touches?.[0]?.clientY;
    if (dragging && x != null) {
      yaw += (x - dragging.x) * 0.008; pitch = Math.max(-1.2, Math.min(1.2, pitch + (y - dragging.y) * 0.006));
      dragging.moved += Math.abs(x - dragging.x) + Math.abs(y - dragging.y);
      dragging.x = x; dragging.y = y;
    } else if (x != null) hover(x, y);
  };
  const up = e => {
    if (dragging && dragging.moved < 5) {
      const x = e.clientX ?? e.changedTouches?.[0]?.clientX, y = e.clientY ?? e.changedTouches?.[0]?.clientY;
      if (x != null) clickAt(x, y);
    }
    dragging = null;
  };
  cv.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); AUTOFIT = false; camera.position.multiplyScalar(e.deltaY > 0 ? 1.07 : 0.94); }, { passive: false });
  window.addEventListener('resize', () => { resize(); if (AUTOFIT) { FITTED = null; autoFit(); } });
}

// What is under a pixel. Beads first (they sit inside organs and are drawn only when asked for), then
// organs and appendages, then the envelope, then the shell that encloses everything; nearest within a tier.
// Organs and appendages before the envelope before the shell, nearest first within a tier; and a solid, opaque
// node nearer than everything else wins outright: a click opens what you can see.
const tierOf = h => {
  const u = h.object.userData;
  if (u.kind) return -1;
  const n = u.__node;
  return (PRIORITY[n?.role] ?? 0) + (n?.state === 'absent' ? 3 : 0);
};
// Two exceptions to the tiers. A PRESENT envelope that is the nearest surface under the pointer is what the
// reader is looking at (a construct's ciliated surface, which is the design), so it comes first rather than
// behind the interior. And a second click at the same spot (within 4 px) on the part already selected goes one
// part deeper, so whatever sits under the first answer is always one more click away.
const hitKey = h => h.object.userData.__node?.key ?? (h.object.userData.part ? `part|${h.object.userData.part.id}` : h.object.uuid);
function hitsAt(cx, cy) {
  const r = $('#cv').getBoundingClientRect();
  raycaster.setFromCamera(new window.THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
  let hits = raycaster.intersectObjects(meshes, false).filter(h => h.object.visible && (h.object.parent?.visible !== false));
  if (!hits.length) return hits;
  const nearest = hits[0];
  hits.sort((a, b) => tierOf(a) - tierOf(b) || a.distance - b.distance);
  const u = nearest.object.userData, nn = u.__node;
  const seen = !u.kind && nn?.state === 'present' && (!nearest.object.material?.transparent || nn.role === 'envelope');
  if (seen && hits[0] !== nearest) { hits.splice(hits.indexOf(nearest), 1); hits.unshift(nearest); }
  if (LASTCLICK && Math.hypot(cx - LASTCLICK.x, cy - LASTCLICK.y) <= 4 && SEL) {
    // rotate the stack of distinct parts so the one AFTER the selected part comes first (it wraps round)
    const selKey = SEL.nodeKey ?? (SEL.kind === 'part' ? `part|${SEL.id}` : null);
    const keys = [...new Set(hits.map(hitKey))];
    const i = keys.indexOf(selKey);
    if (i >= 0 && keys.length > 1) {
      const rank = new Map(keys.map((k, j) => [k, (j - i - 1 + keys.length) % keys.length]));
      hits = [...hits].sort((a, b) => rank.get(hitKey(a)) - rank.get(hitKey(b)));
    }
  }
  return hits;
}
function hit(cx, cy) { return hitsAt(cx, cy)[0] ?? null; }

// Dolly the camera so what is drawn fills the view. Stages are drawn to scale with each other, so the
// default view shows a small stage small; this is how a reader looks at it closely.
// Box3.expandByObject counts hidden descendants too (every other stage root), so walk visible ones only.
function visibleBox(root) {
  const T = window.THREE, box = new T.Box3(), b = new T.Box3();
  const walk = o => {
    if (o.visible === false) return;
    if (o.isMesh && o.geometry && !o.userData.__carrier) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(b);
    }
    for (const c of o.children) walk(c);
  };
  root.updateMatrixWorld(true);
  walk(root);
  return box;
}


// A prokaryote's body IS one cell. The ladder's body node is labelled upstream (sim-engine/lib/scales.mjs, the
// same label for every frame), so on the cell the page says "the cell" and quotes that label rather than
// presenting a bacterium as a "multicellular organism".
const isCellBody = n => LADDER?.frame?.name === 'prokaryote' && n?.slot === 'cell_body';

function describe(h) {
  const u = h.object.userData;
  if (u.kind === 'part') return `${u.part.label} · ${u.part.level}`;
  if (u.kind === 'molecule') return `${u.molecule.label} · molecule`;
  const n = u.__node, s = STYLE.get(n);
  if (!s) return n.node;
  if (n.depicts) {
    if (s.state === 'ghost') return `${n.label} · ghost: the literature names the ${s.rep.label}; this blueprint lacks it`;
    if (s.state === 'absent') return `${n.label} · not in this blueprint (drawn only because "show what this blueprint lacks" is on)`;
    return `${n.label} · ${s.rep.label} (${s.rep.level}) is in this blueprint`;
  }
  if (s.state === 'absent') return `${n.slot.replace(/_/g, ' ')} · not in this blueprint`;
  if (s.state === 'body' && isCellBody(n)) return `the cell · the ladder's body node ("${s.rep.label}")`;
  if (s.state === 'body') return `${s.rep.label} · the body (this blueprint names no ${n.slot.replace(/_/g, ' ')})`;
  if (s.state === 'cells') return `${s.rep.label} · ${s.rep.level} · only cells/tissue land here: this blueprint has no ${n.slot.replace(/_/g, ' ')}`;
  const more = s.parts.length > 1 ? ` · +${s.parts.length - 1} more here` : '';
  return `${s.rep.label} · ${s.rep.level}${s.state === 'ghost' ? ' · ghost: named by the literature, not in this blueprint' : ''}${more}`;
}

function hover(cx, cy) {
  if (!raycaster) return;
  const hs = hitsAt(cx, cy), h = hs[0] ?? null, box = $('#hover'), r = $('#stage').getBoundingClientRect();
  if (!h) { box.style.opacity = 0; return; }
  const deeper = hs.some(x => hitKey(x) !== hitKey(h));
  box.textContent = describe(h) + (deeper ? ' · click twice to go deeper' : '');
  box.style.left = `${cx - r.left + 12}px`; box.style.top = `${cy - r.top + 12}px`; box.style.opacity = 1;
}

function clickAt(cx, cy) {
  const h = hit(cx, cy);
  LASTCLICK = { x: cx, y: cy };
  if (!h) { SEL = null; LASTCLICK = null; draw(); panel(); return; }
  selectHit(h.object);
  draw(); panel();
}

function selectHit(obj) {
  const u = obj.userData;
  if (u.kind === 'part') SEL = { kind: 'part', id: u.part.id, part: u.part };
  else if (u.kind === 'molecule') SEL = { kind: 'molecule', id: u.molecule.id, molecule: u.molecule };
  else {
    const n = u.__node, s = STYLE.get(n) ?? classify(n);
    const depicts = n.requires ? { label: n.label ?? n.node, requires: n.requires, by: s.depicts?.by ?? null, related: s.depicts?.related ?? [], state: s.state } : null;
    const drawing = drawingNotes(obj, n);
    SEL = s.rep ? { kind: 'part', id: s.rep.id, part: s.rep, nodeKey: n.key, slotParts: s.parts, nodeState: s.state, node: n.node, depicts, drawing }
      : { kind: 'slot', nodeKey: n.key, slot: n.slot, side: n.side, node: n.node, depicts, drawing };
  }
}

// ILLUSTRATION NOTES. A sculptor writes down, per piece, the drawing choices a viewer could mistake for data
// (bristle counts, a ribosome density, beat shapes frozen in a wave); build_mesh.py folds every key they used into
// extras.illustration_note. The clicked mesh's note, then each enclosing node's up to the piece's own node (a deco
// under a slot gives its note and the slot's), so the card says what about THIS drawing is a choice.
function drawingNotes(obj, n) {
  const out = [];
  for (let o = obj; o; o = o.parent) {
    const u = o.userData ?? {};
    const t = typeof u.illustration_note === 'string' ? u.illustration_note.trim() : '';
    if (t && !out.some(x => x.note === t)) out.push({ node: typeof u.node === 'string' ? u.node : null, note: t });
    if (o === n?.obj || u.role === 'stage') break;
  }
  return out;
}
function drawingNote() {
  const d = SEL?.drawing ?? [];
  if (!d.length) return '';
  return `<p class="note about" style="font-size:11px;letter-spacing:.05em;text-transform:uppercase;margin:10px 0 2px">about this drawing</p>
    ${d.map(x => `<p class="note" style="margin-top:2px">${d.length > 1 && x.node ? `<span class="mono">${esc(x.node.replace(/^(slot|deco):/, ''))}</span>: ` : ''}${esc(x.note)}</p>`).join('')}`;
}

function resize() {
  if (!renderer) return;
  const cv = $('#cv'), w = cv.clientWidth, h = cv.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  if (!camera.userData.placed) { camera.position.set(0, 0.6, 4.4); camera.userData.placed = true; }
}

function tick() {
  requestAnimationFrame(tick);
  if (!renderer || !scene) return;
  if (spin && !dragging) yaw += 0.0022;
  if (group) { group.rotation.y = yaw; group.rotation.x = pitch; }
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  placeLabels();
}

/* --------------------------------------------------------------- panel */

function panel() {
  if (!LADDER) return;
  $('#panel').innerHTML = SEL ? (SEL.kind === 'part' ? partCard(SEL.part) : SEL.kind === 'slot' ? slotCard(SEL) : moleculeCard(SEL.molecule)) + runCard() : runCard();
  wire();
}

function basisLegend() {
  const b = LADDER.basis_legend ?? {};
  return `<h3>what the colours mean</h3>` + Object.entries(b).map(([k, v]) =>
    `<div class="note"><span class="chip" data-basis="${k}" style="cursor:default"><span class="dot"></span>${k}</span> ${esc(v)}</div>`).join('');
}

function runCard() {
  const c = LADDER.counts, o = LADDER.organism, f = LADDER.frame, t = LADDER.timeline;
  const pts = t?.points ?? [];
  const gen = (BUNDLE.generations ?? []).find(g => g.generation === LADDER.generation);
  return `<div class="card">
    <h2>${esc(o.label ?? 'an organism with no taxon')} <span class="badge">${esc(o.kind)}</span></h2>
    <p class="note">${esc(BUNDLE.question ?? '')}</p>
    <p class="note"><b>generation ${LADDER.generation}</b> asked: ${esc(LADDER.asked ?? '—')}</p>
    ${LADDER.what_it_taught ? `<p class="note">${esc(LADDER.what_it_taught)}</p>` : ''}
    ${o.made_from ? `<div class="note warn"><b>a construct, not an instance.</b> Built from ${esc(o.made_from.taxon)}: ${esc(o.made_from.what)}.
       It does not inherit ${(o.made_from.does_not_inherit ?? []).map(esc).join('; ')} — and ${LADDER.unplaced.filter(u => u.donors_not_the_constructs).length} part(s) the blueprint returned are marked the donor's for exactly that reason.</div>` : ''}
    <h3>body plan</h3>
    <p class="note"><b>${esc(f.name)}</b> — ${esc(f.label)}<br>${esc(f.why)}</p>
    <p class="note err"><b>Not morphometry.</b> ${esc(f.THIS_IS_NOT_MORPHOMETRY ?? '')}</p>
    ${pts.length > 1 ? `<h3>age</h3><div class="rail"><input type="range" id="age" min="0" max="${pts.length - 1}" value="${AGE}" step="1">
      <span class="mono" id="agelab">${fmt(pts[AGE]?.age_days)} d</span></div>
      <p class="note">${esc(pts[AGE]?.stage ?? '')} · ${pts[AGE]?.length_m != null ? `length ${fmt(pts[AGE].length_m)} m` : 'no length declared'} · ${pts[AGE]?.mass_kg != null ? `mass ${fmt(pts[AGE].mass_kg)} kg` : 'no mass declared'}
      ${pts[AGE]?.length_ratio != null ? ` · drawn at ${fmt(pts[AGE].length_ratio)}× the first age` : ''}</p>
      <p class="note">ratio from ${esc(pts[AGE]?.ratio_from ?? '')}. ${pts.some((x, i) => i && x.length_ratio != null && pts[i - 1].length_ratio != null && x.length_ratio < pts[i - 1].length_ratio) ? '<b>This track is not monotonic:</b> the body gets SMALLER between two of these ages, so any reading of it as growth is wrong.' : ''}</p>
      <p class="note">${esc(t.scaling.how)} Under ${esc(t.scaling.under)}. ${esc(t.not_a_simulation)}</p>
      <p class="note">The view is divided by the largest declared ratio on this track (${fmt(Math.max(1, ...pts.map(x => x.length_ratio ?? 1)))}×), so the biggest stage fits and every other stage is drawn at its declared size relative to it.</p>
      ${stageNote()}`
      : `<h3>age</h3><p class="note">${esc(t?.note ?? 'one moment only: ' + (pts[0]?.stage ?? 'no life stage resolved'))}</p>${stageNote()}`}
    <p class="note">Order of appearance is <b>not modelled</b>. ${esc(t?.order_of_appearance?.why ?? '')}</p>
    ${illustrationCard()}
    <h3>the ladder</h3>
    <dl class="kv">${LEVELS.map(l => { const n = l === 'molecule' ? LADDER.molecules.length : (c.ladder[l] ?? 0); return `<dt>${l.replace('_', ' ')}</dt><dd>${n}</dd>`; }).join('')}
      <dt>pathway</dt><dd>${c.ladder.pathway ?? 0}</dd><dt>cell–cell</dt><dd>${c.ladder.cell_cell ?? 0}</dd>
      <dt>law chips</dt><dd>${c.law_chips}</dd><dt>checks</dt><dd>${c.checks}</dd>
      <dt>unplaced</dt><dd>${c.unplaced}</dd></dl>
    <p class="note">${Object.entries(c.law_status ?? {}).map(([k, v]) => `<span class="s-${k}">${v} ${k.replace(/-/g, ' ')}</span>`).join(' · ')}</p>
    ${basisLegend()}
    ${chainCard()}
    <h3>what checked what</h3>
    ${(LADDER.checks ?? []).length ? (LADDER.checks).map(c2 => `<div class="note"><span class="chip" data-basis="${c2.basis}" style="cursor:default"><span class="dot"></span>${esc(c2.layer)}</span>
      <span class="mono">${esc(c2.tool)}</span> → <b>${esc(c2.verdict)}</b><br>${esc(String(c2.body ?? '').slice(0, 300))}</div>`).join('')
      : '<p class="empty">No check posted a finding for this generation.</p>'}
    <h3>unplaced parts</h3>
    ${c.unplaced ? `<details><summary>${c.unplaced} part(s) have no position, and are listed rather than drawn at the origin</summary>
      ${LADDER.unplaced.slice(0, 60).map(u => `<div class="note"><b>${esc(u.label)}</b> <span class="badge">${esc(u.level)}</span><br>${esc(u.why)}</div>`).join('')}
      ${c.unplaced > 60 ? `<p class="note">…and ${c.unplaced - 60} more, in the ladder file.</p>` : ''}</details>`
      : '<p class="note">Every part the blueprint returned found a slot.</p>'}
    <h3>honesty</h3>
    <ul>${(LADDER.honesty ?? []).map(h => `<li>${esc(h)}</li>`).join('')}</ul>
    <p class="note">Ladder: <span class="mono">studio-live/scales/${esc(BUNDLE.run)}.json</span>, generation ${LADDER.generation} (rebuild with <span class="mono">node sim-engine/scales/build.mjs --run ${esc(BUNDLE.run)}</span>) · contract ${esc(LADDER.contract_version)}</p>
  </div>`;
}

function chainCard() {
  const ch = LADDER.chain ?? {};
  if (!ch.present) return `<h3>molecule to organ</h3><p class="note err">${esc(ch.why ?? 'no chain')}</p>`;
  return `<h3>molecule to organ</h3>
    <p class="note">${ch.links.length} graded, quoted link(s) for: <b>${esc(ch.requirement ?? '')}</b></p>
    <p class="note warn">${esc(ch.species_caveat ?? '')}</p>
    <p class="note">${Object.entries(ch.grades ?? {}).map(([g, n]) => `${n} ${esc(g)}`).join(' · ')}</p>
    ${(ch.missing_rungs ?? []).length ? `<div class="lad">${ch.missing_rungs.map(g => `<div class="step gap"><b>${(g.between ?? []).map(esc).join(' → ')} is missing.</b> ${esc(g.why)}<br><i>${esc(g.what_would_be_needed ?? '')}</i></div>`).join('')}</div>` : ''}
    ${ch.verification ? `<details><summary>what the verifier checked</summary><pre>${esc(JSON.stringify(ch.verification, null, 1))}</pre></details>` : ''}`;
}

// A chip carries only what varies with the part; a law's label, statement text and links are stored once per
// ladder in law_static. The laws that reach every part are stored once in universal_laws.
const chip = c => ({ ...(LADDER?.law_static?.[c.law_id] ?? {}), ...c });
const partLaws = p => [...(p.laws ?? []).map(chip), ...(LADDER?.universal_laws ?? []).map(chip)];

function partCard(p) {
  const d = window.DRAWINGS.svg(p.slot, p.shape);
  const laws = partLaws(p);
  const uni = laws.filter(l => l.universal), spec = laws.filter(l => !l.universal);
  const onCell = SEL?.nodeState === 'body' && p.level === 'body' && /^slot:cell_body/.test(String(SEL?.node ?? '')) && LADDER?.frame?.name === 'prokaryote';
  return `<div class="card">
    <h2>${onCell ? `the cell <span class="note">— the ladder's body node, labelled "${esc(p.label)}"</span>` : esc(p.label)}</h2>
    <p class="note"><span class="badge">${esc(p.level)}</span> <span class="badge">${esc(p.slot)}</span>
      ${p.side !== 'single' ? `<span class="badge">${esc(p.side)}</span>` : ''}
      <span class="mono">${esc(p.ontology_id)}</span></p>
    ${SEL?.depicts && SEL.id === p.id ? depictsNote(p, SEL.depicts) : slotProvenance(p)}
    ${p.from === 'chain' ? `<p class="note warn"><b>ghost: named by the literature chain, not in this blueprint.</b> ${esc(p.why ?? '')}</p>` : ''}
    ${onCell ? `<p class="note">You clicked the illustrated cell. A bacterium's body is one cell, so this is the ladder's body node; its label "${esc(p.label)}" is the one the ladder builder (<span class="mono">sim-engine/lib/scales.mjs</span>) gives the body node in every frame, and it is wrong for a single cell. The page quotes it rather than renaming it.</p>`
      : SEL?.nodeState === 'body' && p.level === 'body' ? `<p class="note">You clicked the <b>${esc(String(SEL.node ?? '').replace(/^slot:/, '').replace(/:.*/, '').replace(/_/g, ' '))}</b> region of the illustration. This blueprint names the whole organism but no organ in that region, so the click opens the body.</p>` : ''}
    ${SEL?.nodeState === 'cells' ? `<p class="note warn"><b>only a ${esc(p.level)} lands here.</b> The illustration's ${esc(p.slot.replace(/_/g, ' '))} is drawn as a translucent outline, not as a solid organ: the blueprint places this ${esc(p.level)} in the ${esc(p.slot.replace(/_/g, ' '))} slot (${esc(p.matched_by)}), but it has no ${esc(p.slot.replace(/_/g, ' '))} organ of its own.</p>` : ''}
    ${SEL?.id === p.id ? drawingNote() : ''}
    ${d.svg}
    <p class="note">${esc(d.basis)}. Schematic: not traced from a specimen, not scaled to a measurement, not species-specific.</p>
    ${slotSiblings(p)}
    <p class="note">Placed by: ${esc(p.matched_by)}. Geometry basis: <b>${esc(p.geometry_basis)}</b>.</p>

    <h3>laws that reach this part</h3>
    ${spec.length ? spec.map(lawChip).join('') : `<p class="empty">${esc(p.no_law_reaches ?? 'No law in the table is specifically about this part.')}</p>`}
    ${uni.length ? `<details><summary>${uni.length} law(s) that reach every part of every organism</summary>${uni.map(lawChip).join('')}</details>` : ''}
    <div id="lawdetail"></div>

    <h3>checks that looked here</h3>
    ${(p.checks ?? []).length ? p.checks.map(i => typeof i === 'number' ? (LADDER.checks ?? [])[i] : i).filter(Boolean).map(c => `<div class="note"><span class="chip" data-basis="${c.basis}" style="cursor:default"><span class="dot"></span>${esc(c.layer)}</span>
      <span class="mono">${esc(c.tool)}</span> → <b>${esc(c.verdict)}</b><br>${esc(String(c.body ?? '').slice(0, 400))}
      ${c.numbers ? `<details><summary>numbers as the tool reported them</summary><pre>${esc(JSON.stringify(c.numbers, null, 1).slice(0, 4000))}</pre></details>` : ''}</div>`).join('')
      : '<p class="empty">No check in this run looked at this part. The tool-to-part map is in sim-engine/lib/scales.mjs; a tool about the whole organism is attached to the body, not spread over parts.</p>'}

    <h3>molecule → this part</h3>
    ${(p.chain_links ?? []).length ? `<div class="lad">${p.chain_links.map(chainStep).join('')}</div>`
      : `<p class="empty">No graded literature link lands on this part. ${esc((LADDER.chain?.present ? 'The run has a chain, and none of its links reaches here.' : 'This run has no molecule-to-organ chain at all.'))}</p>`}
  </div>`;
}

// The other parts a slot node stands for, and (for the body) the parts no mesh of this stage draws.
function pickChips(list, max = 40) {
  return list.slice(0, max).map(x => `<span class="chip pick" data-pick="${esc(x.id)}" tabindex="0" role="button"><span class="dot" style="background:#${(LEVEL_COLOUR[x.level] ?? 0x888888).toString(16).padStart(6, '0')}"></span>${esc(x.label)}${x.from === 'chain' ? ' (ghost)' : ''}</span>`).join('')
    + (list.length > max ? `<span class="note">…and ${list.length - max} more</span>` : '');
}
function slotSiblings(p) {
  if (!meshActive()) return '';
  const here = (SEL?.slotParts ?? partsAt(p.slot, p.side)).filter(x => x.id !== p.id);
  const out = [];
  if (p.level !== 'body' && here.length) {
    out.push(`<h3>also in this slot (${here.length})</h3><p class="note">The illustration has one ${esc(p.slot.replace(/_/g, ' '))} node; this card opened on the coarsest part of the blueprint that lands in it. The others:</p>${pickChips([...here].sort((a, b) => partLevel(a) - partLevel(b)))}`);
  }
  if (p.level === 'body') {
    const slots = new Set(currentNodes().filter(n => !n.deco && !['absent', 'body'].includes(STYLE.get(n)?.state ?? 'absent')).map(n => n.slot));
    const loose = (LADDER?.parts ?? []).filter(x => x.level !== 'body' && !slots.has(x.slot));
    if (loose.length) out.push(`<h3>parts this stage's illustration has no node for (${loose.length})</h3><p class="note">Their slot is not sculpted in the <b>${esc(stageKey())}</b> form, or it is the generic body. They are reachable here:</p>${pickChips(loose)}`);
  }
  return out.join('');
}

// The card opened from a piece that depicts one specific part (extras.requires): what the piece is, why it is drawn
// the way it is, and the blueprint parts that share a word with it but are not the part it depicts.
function depictsNote(p, d) {
  const req = d.requires.map(r => `<span class="mono">${esc(r)}</span>`).join(', ');
  const how = d.state === 'ghost'
    ? `The literature chain names the <b>${esc(p.label)}</b> and this blueprint does not contain it, so the piece is drawn violet and translucent and labelled, whatever its slot shows.`
    : `This blueprint contains it (matched by ${d.by === 'id' ? 'ontology id' : 'label'}), so the piece is drawn solid.`;
  const rel = d.state === 'ghost' ? (d.related ?? []).filter(x => x.id !== p.id) : [];
  return `<p class="note${d.state === 'ghost' ? ' warn' : ''}"><b>You clicked the illustration's ${esc(d.label)}.</b> That piece depicts one specific part (it requires ${req}) and is styled by that part's state in the ladder, not by its slot's. ${how}</p>
    ${rel.length ? `<p class="note">The blueprint does list ${rel.length} part(s) whose label matches but whose ontology id is not the one this piece depicts. They do not make it solid (an id outranks a label, and the page has no ontology reasoner):</p>${pickChips(rel)}` : ''}`;
}

// Where the parts in a slot come from. The frame's label patterns put a blueprint part in a slot; that is not the
// ontology placing it in this organism. When most parts here carry no taxon evidence that includes the organism
// (a construct's interior holding "mesenchyme of parotid"), the card says so plainly, above everything else.
function slotProvenance(p) {
  if (!p || p.level === 'body' || !p.slot || p.slot === 'body') return '';
  const here = partsAt(p.slot, p.side).filter(x => x.from !== 'chain');
  const ev = here.filter(x => x.taxon_evidence?.verdict);
  if (here.length < 2 || ev.length < 2) return '';
  const c = {};
  for (const x of ev) c[x.taxon_evidence.verdict] = (c[x.taxon_evidence.verdict] ?? 0) + 1;
  const placed = c.placed ?? 0;
  if (placed * 2 >= ev.length) return '';
  const o = LADDER.organism ?? {}, taxon = o.taxon ?? o.label ?? 'this organism';
  const who = o.kind === 'construct' ? `${taxon} (the donor)` : taxon;
  const bits = [`only ${placed} carr${placed === 1 ? 'ies' : 'y'} an <span class="mono">in_taxon</span> restriction that includes it (placed)`];
  if (c['placed-vacuously']) bits.push(`${c['placed-vacuously']} only a restriction to a clade most animals belong to (placed vacuously, which discriminates nothing)`);
  if (c.unconstrained) bits.push(`${c.unconstrained} no restriction at all (unconstrained: the ontology is silent, and silence is not presence)`);
  if (c.contested) bits.push(`${c.contested} a restriction that excludes it (contested)`);
  if (c.forbidden) bits.push(`${c.forbidden} a never_in_taxon that forbids it`);
  const mine = p.taxon_evidence?.verdict;
  const slot = p.slot.replace(/_/g, ' ');
  return `<p class="note warn"><b>Where the parts in this slot come from.</b> The ${here.length} parts in the <b>${esc(slot)}</b> slot, this one among them, are the blueprint's:
    the frame's label patterns put them here${p.matched_by ? ` (this one by ${esc(p.matched_by)})` : ''}, not the anatomy of ${esc(who)}. The ontology does not place most of them in ${esc(taxon)}:
    of the ${ev.length} with taxon evidence, ${bits.join('; ')}.${mine ? ` This part is <b>${esc(mine)}</b>.` : ''}
    So "${esc(p.label)}" is a name the blueprint returned, not evidence that this ${o.kind === 'construct' ? 'construct' : 'organism'} has that ${esc(p.level)}.</p>`;
}

function slotCard(s) {
  const f = LADDER.frame?.name ?? '';
  if (s.depicts) return `<div class="card">
    <h2>${esc(s.depicts.label)} — not in this blueprint</h2>
    <p class="note">This piece of the illustration depicts one specific part (it requires ${s.depicts.requires.map(r => `<span class="mono">${esc(r)}</span>`).join(', ')}).
    No part of generation ${LADDER.generation}'s blueprint matches, and the literature chain names none either.
    It is drawn only because "show what this blueprint lacks" is on, as an outline, so nobody reads it as part of the design.</p>
    ${drawingNote()}
  </div>`;
  return `<div class="card">
    <h2>${esc(s.slot.replace(/_/g, ' '))}${s.side !== 'single' ? ` <span class="badge">${esc(s.side)}</span>` : ''} — not in this blueprint</h2>
    <p class="note">The ${esc(f)} body plan has a <b>${esc(s.slot)}</b> slot and the illustration sculpts one, but no part of generation ${LADDER.generation}'s blueprint lands in it and the literature chain names nothing there either.
    It is drawn only because "show what this blueprint lacks" is on, as an outline, so nobody reads it as part of the design.</p>
    ${drawingNote()}
  </div>`;
}

function stageNote() {
  if (!meshActive()) return '';
  const m = meshInfo(), k = stageKey();
  const label = (LADDER?.timeline?.points ?? [])[AGE]?.stage ?? m.stage_labels?.[m.stages.indexOf(k)] ?? null;
  const hid = BEADS_HIDDEN.n ? ` ${BEADS_HIDDEN.n} tissue/cell bead(s) are not drawn in this form, because the ${esc(k)} form has no ${[...BEADS_HIDDEN.slots].map(x => esc(x.replace(/_/g, ' '))).join(', ')} (their slot); they are listed on the body's card.` : '';
  return `<p class="note">Illustration: the textbook <b>${esc(k)}</b> form${label ? `, chosen by the declared stage name "${esc(label)}"` : ''}. Each stage form is a separate schematic: nothing is interpolated between stages and development is not simulated.${hid}</p>`;
}

// The pieces of this stage's illustration that depict one specific part, one line per part, with any view note.
function depictsSummary() {
  const by = new Map();
  for (const n of currentNodes()) if (n.requires) {
    const k = n.requires.join('|');
    if (!by.has(k)) by.set(k, { n, s: STYLE.get(n) ?? classify(n) });
  }
  if (!by.size) return '';
  const word = { present: 'solid: the blueprint has it', ghost: 'violet ghost: the literature names it, the blueprint lacks it', absent: `hidden: not in this blueprint${SHOW_ABSENT ? ' (shown as an outline)' : ''}` };
  return `<p class="note">${by.size} piece(s) depict one specific part and follow that part, not their slot: ${[...by.values()].map(({ n, s }) =>
    `<b>${esc(n.label)}</b> (${s.rep ? `${esc(s.rep.label)} · ` : ''}${word[s.state] ?? esc(s.state)})${n.view_note ? `, ${esc(n.view_note)}` : ''}`).join('; ')}.</p>`;
}

function illustrationCard() {
  const m = meshInfo();
  if (!m) return '';
  const G = GLB[m.hash];
  const counts = {};
  if (meshActive()) for (const n of currentNodes()) if (!n.deco) { const s = STYLE.get(n)?.state ?? classify(n).state; counts[s] = (counts[s] ?? 0) + 1; }
  return `<h3>illustration</h3>
    <p class="note"><b>${meshActive() ? 'illustration sculpted in Blender — shapes are not measured.' : esc($('#meshbadge')?.textContent ?? '')}</b>
      ${meshActive() ? esc(G.extras?.THIS_IS_NOT_MORPHOMETRY ?? '') : ''}</p>
    ${meshActive() ? `<p class="note">${counts.present ?? 0} slot node(s) solid (an organ of the blueprint) · ${counts.cells ?? 0} outlined (only cells or tissue of the blueprint land there) · ${counts.ghost ?? 0} ghost (named by the literature, not in the blueprint) · ${counts.body ?? 0} neutral (the body, no organ of its own) · ${counts.absent ?? 0} hidden (not in this blueprint${SHOW_ABSENT ? ', shown as outlines' : ''}).</p>` : ''}
    ${meshActive() ? depictsSummary() : ''}
    <p class="note"><span class="mono">${esc(m.glb ?? '—')}</span> · frame ${esc(m.frame)} · status <b>${esc(m.status)}</b>${m.hash ? ` · hash <span class="mono">${esc(m.hash)}</span>` : ''}${m.generator_version ? ` · generator <span class="mono">${esc(m.generator_version)}</span>` : ''}</p>
    ${(m.driver_notes ?? []).map(x => `<p class="note">${esc(x)}</p>`).join('')}
    ${m.status !== 'built' && m.status !== 'cached' && m.why ? `<p class="note">${esc(String(m.why).slice(0, 400))}</p>` : ''}`;
}

function lawChip(l) {
  return `<span class="chip law${l.status === 'out-of-scope' || l.status === 'wrong-quantity' ? ' off' : ''}" data-basis="${l.basis}" data-law="${esc(l.law_id)}" tabindex="0" role="button">
    <span class="dot"></span><span class="s-${l.status}">${esc(l.label)}</span></span>`;
}

function chainStep(l) {
  return `<div class="step"><b>${esc(l.from?.label ?? '?')}</b> <span class="mono">${esc(l.from?.level ?? '')}</span>
    → <b>${esc(l.to?.label ?? '?')}</b> <span class="mono">${esc(l.to?.level ?? '')}</span>
    <span class="grade">${esc(l.evidence_grade ?? 'ungraded')}</span>
    <br><span class="note">${esc(l.relation ?? '')} · ${esc(l.organism_of_evidence ?? '')} · ${esc(l.experiment_type ?? '')}${l.read ? ` · ${esc(l.read)}` : ''}</span>
    ${l.quote ? `<blockquote>“${esc(l.quote)}”</blockquote>` : ''}
    <span class="note">${esc(l.source?.first_author ?? '')} ${esc(String(l.source?.year ?? ''))}${l.source?.doi ? ` · <a href="https://doi.org/${esc(l.source.doi)}" target="_blank" rel="noopener">${esc(l.source.doi)}</a>` : ''}${l.source?.pmid ? ` · PMID ${esc(l.source.pmid)}` : ''}</span>
    ${l.what_it_does_not_show ? `<div class="note warn">does not show: ${esc(l.what_it_does_not_show)}</div>` : ''}</div>`;
}

// The law's canonical registry record, fetched when its chip is opened and cached for the page's lifetime.
const RECORDS = {};
async function lawRecord(id) {
  const ref = (BUNDLE.laws ?? {})[id] ?? {};
  if (ref.missing_record) return ref;
  if (!RECORDS[id]) {
    try {
      const r = await (await fetch(ref.api ?? `../../api/lean/laws/${id}.json`, { cache: 'no-store' })).json();
      RECORDS[id] = { law_id: id, label: r.label, level: r.level, kind: r.kind, class: r.class, status: r.status,
        statement_en: r.statement_en, hypotheses: r.hypotheses ?? [],
        theorem: r.lean_ref?.theorem ?? r.lean?.theorem ?? null, module: r.lean_ref?.module ?? r.lean?.module ?? null,
        line: r.lean?.line ?? null, lean_source: r.lean?.source ?? null,
        kernel_checked: r.scope?.kernelChecked ?? [], assumed: r.scope?.assumed ?? [],
        sources: r.sources ?? [], approval: r.approval ?? null, pin: r.pin ?? null, version: r.version ?? null,
        api: ref.api, nanopub: ref.nanopub ?? null };
    } catch (e) { return { law_id: id, missing_record: `could not load ${ref.api}: ${e.message}` }; }
  }
  return RECORDS[id];
}

function lawDetail(id, rec) {
  const inPart = (SEL?.part ? partLaws(SEL.part) : []).find(l => l.law_id === id) ?? {};
  if (rec.missing_record) return `<div class="card err"><h2>${esc(id)}</h2><p class="note">${esc(rec.missing_record)}</p></div>`;
  return `<div class="card">
    <h2>${esc(rec.label ?? id)}</h2>
    <p class="note"><span class="badge">${esc(rec.class ?? '')}</span> <span class="badge">${esc(rec.status ?? '')}</span>
      <span class="badge">${esc(rec.level ?? '')}</span>${rec.version ? ` <span class="badge">v${esc(rec.version)}</span>` : ''}</p>
    <p class="note"><b class="s-${inPart.status}">${esc(String(inPart.status ?? '').replace(/-/g, ' '))}</b> — ${esc(inPart.because ?? '')}</p>
    <p class="note"><b>how it reaches this part:</b> ${esc(inPart.how ?? rec.statement_en ?? '')}</p>
    <h3>statement</h3><p class="note">${esc(rec.statement_en ?? '')}</p>
    ${(rec.hypotheses ?? []).length ? `<h3>named hypotheses it rests on</h3><ul>${rec.hypotheses.map(h => `<li>${esc(h.statement)}</li>`).join('')}</ul>` : ''}
    ${(inPart.needs ?? []).length ? `<h3>quantities</h3>
      <dl class="kv">${(inPart.supplied ?? []).map(s => `<dt>${esc(s.field)}</dt><dd>${esc(s.kind ?? '')} — ${esc(String(s.source ?? '').slice(0, 220))}</dd>`).join('')}
      ${(inPart.missing ?? []).map(m => `<dt class="s-constrains-but-not-evaluated">${esc(m)}</dt><dd class="empty">not supplied by this design</dd>`).join('')}</dl>` : ''}
    ${rec.theorem ? `<h3>the proof</h3>
      <p class="note"><span class="mono">${esc(rec.theorem)}</span> in <span class="mono">${esc(rec.module)}${rec.line ? `:${rec.line}` : ''}</span>
      ${rec.pin ? ` · pin <b>${esc(rec.pin.status ?? '')}</b>${rec.pin.theorem_found === false ? ' (the theorem was NOT found at this pin)' : ''}` : ''}</p>
      ${rec.lean_source ? `<pre>${esc(rec.lean_source)}</pre>` : '<p class="empty">The registry record carries no source text for this theorem.</p>'}
      ${(rec.kernel_checked ?? []).length ? `<h3>what the kernel checked</h3><ul>${rec.kernel_checked.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
      ${(rec.assumed ?? []).length ? `<h3>what it assumes</h3><ul>${rec.assumed.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}`
      : `<h3>there is no proof</h3><p class="note">This law is <b>${esc(rec.status ?? 'not formalised')}</b>: there is no theorem to open. ${esc(inPart.because ?? '')}</p>`}
    <h3>where it came from</h3>
    <ul>${(rec.sources ?? []).map(s => `<li>${esc(s)}</li>`).join('') || '<li class="empty">no source recorded</li>'}</ul>
    ${rec.nanopub ? `<p class="note"><b>nanopublication:</b> <span class="mono">${esc(rec.nanopub.file)}</span> — <b>${esc(rec.nanopub.status)}</b>.
      ${rec.nanopub.trusty_uri ? `Published as <span class="mono">${esc(rec.nanopub.trusty_uri)}</span>.` : 'Nothing has been published: this is a draft on disk, unsigned, with no trusty URI.'}
      <br>claim <span class="mono">${esc(rec.nanopub.claim ?? '—')}</span>${(rec.nanopub.theorems ?? []).length ? `<br>covers ${rec.nanopub.theorems.map(esc).join(', ')}` : ''}</p>`
      : `<p class="note">No nanopublication draft names this law.</p>`}
    ${rec.approval ? `<p class="note">approval: ${esc(rec.approval.approved_by_role ?? '')} — ${esc(rec.approval.basis ?? '')}</p>` : ''}
    <p class="note"><a href="${esc(rec.api ?? '#')}" target="_blank" rel="noopener">the full registry record (JSON)</a> · <a href="../../proofs/" target="_blank" rel="noopener">the claim book</a></p>
  </div>`;
}

function moleculeCard(m) {
  const host = (LADDER.parts ?? []).find(p => p.id === m.placed_on);
  const links = (LADDER.chain?.links ?? []).filter(l => (l.from?.label ?? '').toLowerCase() === String(m.label).toLowerCase() || (l.from?.id ?? '') === m.id);
  return `<div class="card">
    <h2>${esc(m.label)}</h2>
    <p class="note"><span class="badge">molecule</span> <span class="badge">${esc(m.ontology ?? '')}</span> <span class="mono">${esc(m.id)}</span></p>
    <p class="note err">${esc(m.what_it_is)}</p>
    <p class="note">annotated to <b>${esc(m.cell_label)}</b>${host ? `, drawn inside <b>${esc(host.label)}</b>` : ', which is not placed in this frame'}.</p>
    ${links.length ? `<h3>what the literature has it doing</h3><div class="lad">${links.map(chainStep).join('')}</div>`
      : `<p class="empty">No graded link in this run's chain starts from this molecule. Being a marker of a cell type is not evidence that it does anything.</p>`}
  </div>`;
}

function wire() {
  for (const c of document.querySelectorAll('.chip.law')) {
    const open = async () => {
      $('#lawdetail').innerHTML = '<div class="card"><p class="note">loading the proof from the registry…</p></div>';
      const rec = await lawRecord(c.dataset.law);
      $('#lawdetail').innerHTML = lawDetail(c.dataset.law, rec);
      $('#lawdetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    c.onclick = open;
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  }
  const a = $('#age');
  if (a) a.oninput = () => { AGE = Number(a.value); const pts = LADDER.timeline.points; $('#agelab').textContent = `${fmt(pts[AGE]?.age_days)} d`; draw(); panel(); };
  for (const c of document.querySelectorAll('.chip.pick')) {
    const go = () => { const p = (LADDER?.parts ?? []).find(x => x.id === c.dataset.pick); if (p) { SEL = { kind: 'part', id: p.id, part: p }; draw(); panel(); } };
    c.onclick = go;
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  }
}

/* ------------------------------------------------- a hook for the shooter */

// Selecting a part by clicking the canvas means projecting a 3D position to a screen pixel, which a
// screenshot script cannot do reliably. This exposes the same selection the click handler performs, so a
// shot of the pop-out panel is a shot of the real panel and not of a mock-up.
window.THEATRE = {
  select(labelOrId) {
    const k = String(labelOrId).toLowerCase();
    const p = (LADDER?.parts ?? []).find(x => x.id === labelOrId || x.ontology_id === labelOrId || x.label.toLowerCase() === k)
      ?? (LADDER?.parts ?? []).find(x => x.label.toLowerCase().includes(k))
      ?? (LADDER?.parts ?? []).find(x => x.slot === k);
    if (!p) return null;
    SEL = { kind: 'part', id: p.id, part: p };
    draw(); panel();
    return { id: p.id, label: p.label, level: p.level, slot: p.slot, laws: partLaws(p).length,
      checks: (p.checks ?? []).length, chain_links: (p.chain_links ?? []).length, ghost: p.from === 'chain' };
  },
  show(level, on) { SHOW[level] = Boolean(on); ladderChips(); draw(); return { ...SHOW }; },
  age(i) { AGE = Number(i); draw(); panel(); return LADDER?.timeline?.points?.[AGE] ?? null; },
  state() { return { run: BUNDLE?.run, generation: LADDER?.generation, parts: (LADDER?.parts ?? []).length,
    selected: SEL?.part?.label ?? (SEL?.kind === 'slot' ? `slot:${SEL.slot}` : null), selected_id: SEL?.part?.id ?? null,
    drawing: (SEL?.drawing ?? []).map(x => ({ ...x })),
    counts: LADDER?.counts ?? null, ages: (LADDER?.timeline?.points ?? []).length,
    spinning: spin, drawn: meshes.length, mode: meshActive() ? 'mesh' : 'schematic', stage: meshActive() ? stageKey() : null,
    badge: $('#meshbadge')?.textContent ?? null }; },
  stopSpin() { spin = false; $('#spin').setAttribute('aria-pressed', 'false'); },
  /** 'mesh' | 'schematic' to switch; returns what is actually drawn (mesh only when its GLB loaded). */
  mode(m) { if (m) setMode(m === 'schematic' ? 'schematic' : 'mesh'); return meshActive() ? 'mesh' : 'schematic'; },
  /** What the illustration is showing, node by node. */
  meshState() {
    const m = meshInfo(), G = m && GLB[m.hash];
    const ns = meshActive() ? currentNodes() : [];
    const by = st => ns.filter(n => !n.deco && (STYLE.get(n)?.state ?? classify(n).state) === st).map(n => n.node);
    const beads = meshes.filter(m => m.userData?.kind === 'part').map(m => ({ label: m.userData.part.label, slot: m.userData.part.slot, at: m.position.toArray().map(v => Number(v.toFixed(3))) }));
    return { glb: m?.glb ?? null, hash: m?.hash ?? null, status: m?.status ?? null, loaded: G?.status ?? null, error: G?.error ?? null,
      stage: meshActive() ? stageKey() : null, stages: Object.keys(G?.stages ?? {}), nodes: ns.filter(n => !n.deco).map(n => n.node),
      present: by('present'), cells: by('cells'), ghost: by('ghost'), body: by('body'), absent: by('absent'), show_absent: SHOW_ABSENT,
      beads, beads_hidden: BEADS_HIDDEN.n, age: AGE, labels: LABELS.map(l => l.text),
      visible: ns.filter(n => n.obj.visible && !n.carrier).map(n => n.node),
      carriers: ns.filter(n => n.carrier).map(n => n.node),
      // Every piece that depicts a specific part (extras.requires), with the state the page drew it in.
      depicts: ns.filter(n => n.requires).map(n => { const s = STYLE.get(n) ?? classify(n);
        return { node: n.node, label: n.label, requires: n.requires, state: s.state, by: s.depicts?.by ?? null, rep: s.rep?.id ?? null, rep_label: s.rep?.label ?? null,
          related: (s.depicts?.related ?? []).map(p => p.id), visible: n.obj.visible, parent: n.parentNode?.node ?? null, parent_state: n.parentNode ? (STYLE.get(n.parentNode)?.state ?? null) : null }; }),
      centers: Object.fromEntries(ns.filter(n => !n.deco).map(n => [n.node, n.center.toArray().map(v => Number(v.toFixed(3)))])) };
  },
  /** Jump to the first age point drawn with this stage form; returns the current stage key. */
  stage(key) {
    const m = meshInfo();
    if (key != null && m) { const i = (m.stage_of_point ?? []).indexOf(key); if (i >= 0) { AGE = i; draw(); panel(); } }
    return meshActive() ? stageKey() : (m?.stage_of_point?.[AGE] ?? m?.stages?.[0] ?? null);
  },
  absent(on) { SHOW_ABSENT = Boolean(on); draw(); return SHOW_ABSENT; },
  /** Page pixel of a slot node's centre, so a test can click it for real. */
  nodeScreen(node) {
    const n = currentNodes().find(x => x.node === node && x.obj.visible);
    if (!n || !camera) return null;
    group.rotation.y = yaw; group.rotation.x = pitch; group.updateMatrixWorld(true); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const v = n.obj.parent.localToWorld(n.center.clone()).project(camera), r = $('#cv').getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  },
  /** What is under a page pixel, in pick order: [{node|part, tier, distance, state}]. */
  pick(x, y) {
    if (!raycaster) return [];
    // a piece that depicts a part (extras.requires) reports that part: its card is the one a click opens
    return hitsAt(x, y).map(h => ({ node: h.object.userData.__node?.node ?? null,
      part: h.object.userData.part?.label ?? (h.object.userData.__node?.requires ? STYLE.get(h.object.userData.__node)?.rep?.label ?? null : null),
      tier: tierOf(h), distance: Number(h.distance.toFixed(3)), state: h.object.userData.__node?.state ?? null,
      drawing_note: drawingNotes(h.object, h.object.userData.__node).map(x => x.note).join(' | ') || null }));
  },
  /** Dolly the camera so the current stage fills the view (the reader's "fit" button). */
  fit() { fit(); return camera?.position.length(); },
  /** Camera control for screenshots: yaw/pitch in radians, distance from the origin. */
  view(y, p, d) { if (y != null) yaw = y; if (p != null) pitch = p; if (d != null && camera) { AUTOFIT = false; camera.position.setLength(d); } return { yaw, pitch, distance: camera?.position.length() }; },
  parts() { return (LADDER?.parts ?? []).map(p => ({ id: p.id, label: p.label, level: p.level, slot: p.slot, side: p.side, laws: partLaws(p).length, ghost: p.from === 'chain' })); },
};

/* ---------------------------------------------------------------- live */

// Live means: re-read the baked ladder and redraw when its `built` stamp changes, which happens the moment
// a run calls the builder. The badge says which it is showing, because a page that cannot tell you whether
// it is live is worse than one that is honestly stale.
function live() {
  let last = BUNDLE?.built;
  $('#src').insertAdjacentHTML('afterend', '<span class="badge" id="livebadge">live: polling</span>');
  setInterval(async () => {
    try {
      const row = (INDEX.runs ?? []).find(r => r.run === $('#run').value);
      const b = await (await fetch(`scales/${row.file}`, { cache: 'no-store' })).json();
      if (b.built === last) return;
      last = b.built; BUNDLE = b;
      const g = Number($('#gen').value);
      const gens = b.generations ?? [];
      $('#gen').innerHTML = gens.map(x => `<option value="${x.generation}">${x.generation}${x.body ? '' : ' (no body)'}</option>`).join('');
      $('#gen').value = String(gens.some(x => x.generation === g) ? g : gens[gens.length - 1]?.generation ?? 0);
      // A new mesh hash means a new GLB: pick() -> ensureMesh() fetches it; the same hash reuses the loaded one.
      pick(Number($('#gen').value));

      const lb = $('#livebadge'); if (lb) lb.textContent = `live: updated ${new Date().toTimeString().slice(0, 8)}`;
    } catch { const lb = $('#livebadge'); if (lb) lb.textContent = 'live: the file went away'; }
  }, 4000);
}
})();
