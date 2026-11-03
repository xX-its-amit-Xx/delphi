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
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n == null ? '—' : (Math.abs(n) >= 1e4 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(3) : String(Number(n.toFixed(6))));
const qs = new URLSearchParams(location.search);

const LEVEL_COLOUR = { body: 0x9aa7a4, organ_system: 0x6b4fb3, organ: 0x0e7c86, tissue: 0x2f7d4f, cell: 0xa8650b, molecule: 0xb3392f };
const LEVELS = ['body', 'organ_system', 'organ', 'tissue', 'cell', 'molecule'];
const DEFAULT_ON = { body: true, organ_system: true, organ: true, tissue: false, cell: false, molecule: false };

let INDEX = null, BUNDLE = null, LADDER = null, SHOW = { ...DEFAULT_ON }, SEL = null, AGE = 0;
let renderer, scene, camera, group, raycaster, meshes = [], spin = true, yaw = 0.6, pitch = 0.22, dragging = null;

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

function pick(g) {
  LADDER = BUNDLE.ladders[String(g)] ?? BUNDLE.ladders[g];
  SEL = null; AGE = 0;
  // Never open on an empty stage. A construct has no organs (its own declaration disowns them), so the
  // default levels draw nothing; switch on the coarsest levels that actually have parts.
  SHOW = { ...DEFAULT_ON };
  const has = l => (LADDER?.parts ?? []).some(p => p.level === l);
  // The body is a transparent shell, so it does not count as something drawn.
  if (!['organ_system', 'organ'].some(l => SHOW[l] && has(l))) for (const l of ['tissue', 'cell']) if (has(l)) SHOW[l] = true;
  $('#src').textContent = `${BUNDLE.run} · gen ${g} · built ${String(BUNDLE.built).slice(0, 19).replace('T', ' ')}Z`;
  ladderChips();
  draw();
  panel();
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
  if (!T) { $('#stage').insertAdjacentHTML('beforeend', `<div class="card err" style="position:absolute;left:12px;top:12px;max-width:60%"><b>three.js did not load</b><p class="note">The body cannot be drawn. Every number in the panel is still here, and the parts are in <span class="mono">runs/${esc(BUNDLE?.run ?? '')}/scales/</span>.</p></div>`); return; }
  if (!renderer) {
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    camera = new T.PerspectiveCamera(40, 1, 0.05, 100);
    raycaster = new T.Raycaster();
    bindStage(cv);
    requestAnimationFrame(tick);
  }
  scene = new T.Scene();
  group = new T.Group();
  scene.add(group);
  scene.add(new T.AmbientLight(0xffffff, 0.75));
  const key = new T.DirectionalLight(0xffffff, 0.75); key.position.set(2, 3, 2); scene.add(key);
  const rim = new T.DirectionalLight(0xffffff, 0.3); rim.position.set(-2, -1, -2); scene.add(rim);
  meshes = [];

  const parts = (LADDER?.parts ?? []).filter(p => SHOW[p.level]);
  for (const p of parts) {
    const isSel = SEL && SEL.kind === 'part' && SEL.id === p.id;
    const col = LEVEL_COLOUR[p.level] ?? 0x888888;
    const shell = p.shape === 'shell' || p.level === 'body' || p.shape === 'frame';
    const m = new T.Mesh(geomFor(p.shape, p.r ?? 0.1), new T.MeshStandardMaterial({
      color: col, roughness: 0.55, metalness: 0.05,
      transparent: true, opacity: isSel ? 1 : (shell ? 0.1 : (SEL ? 0.3 : 0.82)),
      wireframe: shell && !isSel, depthWrite: !shell,
      emissive: isSel ? col : 0x000000, emissiveIntensity: isSel ? 0.45 : 0,
    }));
    m.position.set(p.pos.x * 2, p.pos.y * 2, p.pos.z * 2);
    if (p.shape === 'rod' || p.shape === 'tube') m.rotation.z = Math.PI / 2.4;
    if (p.shape === 'blade') m.rotation.x = p.side === 'left' ? -0.18 : 0.18;
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
  // and the panel says so and says it is declared.
  const pts = LADDER?.timeline?.points ?? [];
  const ratio = pts[AGE]?.length_ratio ?? 1;
  group.scale.setScalar(ratio || 1);

  // A faint body axis, so "anterior" means something on screen.
  const ag = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([-1.6, 0, 0, 1.6, 0, 0], 3));
  scene.add(new T.Line(ag, new T.LineBasicMaterial({ color: 0x8aa09c, transparent: true, opacity: 0.35 })));
  resize();
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
  cv.addEventListener('wheel', e => { e.preventDefault(); camera.position.multiplyScalar(e.deltaY > 0 ? 1.07 : 0.94); }, { passive: false });
  window.addEventListener('resize', resize);
}

function hit(cx, cy) {
  const r = $('#cv').getBoundingClientRect();
  raycaster.setFromCamera(new window.THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
  return raycaster.intersectObjects(meshes, false)[0] ?? null;
}

function hover(cx, cy) {
  const h = hit(cx, cy), box = $('#hover'), r = $('#stage').getBoundingClientRect();
  if (!h) { box.style.opacity = 0; return; }
  const u = h.object.userData;
  box.textContent = u.kind === 'part' ? `${u.part.label} · ${u.part.level}` : `${u.molecule.label} · molecule`;
  box.style.left = `${cx - r.left + 12}px`; box.style.top = `${cy - r.top + 12}px`; box.style.opacity = 1;
}

function clickAt(cx, cy) {
  const h = hit(cx, cy);
  if (!h) { SEL = null; draw(); panel(); return; }
  const u = h.object.userData;
  SEL = u.kind === 'part' ? { kind: 'part', id: u.part.id, part: u.part } : { kind: 'molecule', id: u.molecule.id, molecule: u.molecule };
  draw(); panel();
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
}

/* --------------------------------------------------------------- panel */

function panel() {
  if (!LADDER) return;
  $('#panel').innerHTML = SEL ? (SEL.kind === 'part' ? partCard(SEL.part) : moleculeCard(SEL.molecule)) + runCard() : runCard();
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
      <p class="note">${esc(pts[AGE]?.stage ?? '')} · length ${fmt(pts[AGE]?.length_m)} m · mass ${fmt(pts[AGE]?.mass_kg)} kg
      ${pts[AGE]?.length_ratio != null ? ` · drawn at ${fmt(pts[AGE].length_ratio)}× the first age` : ''}</p>
      <p class="note">ratio from ${esc(pts[AGE]?.ratio_from ?? '')}. ${pts.some((x, i) => i && x.length_ratio != null && pts[i - 1].length_ratio != null && x.length_ratio < pts[i - 1].length_ratio) ? '<b>This track is not monotonic:</b> the body gets SMALLER between two of these ages, so any reading of it as growth is wrong.' : ''}</p>
      <p class="note">${esc(t.scaling.how)} Under ${esc(t.scaling.under)}. ${esc(t.not_a_simulation)}</p>`
      : `<h3>age</h3><p class="note">${esc(t?.note ?? 'one moment only: ' + (pts[0]?.stage ?? 'no life stage resolved'))}</p>`}
    <p class="note">Order of appearance is <b>not modelled</b>. ${esc(t?.order_of_appearance?.why ?? '')}</p>
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
  return `<div class="card">
    <h2>${esc(p.label)}</h2>
    <p class="note"><span class="badge">${esc(p.level)}</span> <span class="badge">${esc(p.slot)}</span>
      ${p.side !== 'single' ? `<span class="badge">${esc(p.side)}</span>` : ''}
      <span class="mono">${esc(p.ontology_id)}</span></p>
    ${d.svg}
    <p class="note">${esc(d.basis)}. Schematic: not traced from a specimen, not scaled to a measurement, not species-specific.</p>
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
    selected: SEL?.part?.label ?? null, counts: LADDER?.counts ?? null, ages: (LADDER?.timeline?.points ?? []).length,
    spinning: spin, drawn: meshes.length }; },
  stopSpin() { spin = false; $('#spin').setAttribute('aria-pressed', 'false'); },
  parts() { return (LADDER?.parts ?? []).map(p => ({ label: p.label, level: p.level, slot: p.slot, laws: partLaws(p).length, ghost: p.from === 'chain' })); },
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
      pick(Number($('#gen').value));
      const lb = $('#livebadge'); if (lb) lb.textContent = `live: updated ${new Date().toTimeString().slice(0, 8)}`;
    } catch { const lb = $('#livebadge'); if (lb) lb.textContent = 'live: the file went away'; }
  }, 4000);
}
})();
