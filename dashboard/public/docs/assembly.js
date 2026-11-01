/* docs/assembly.js — the fish, assembled and then opened, driven by scroll position.
 *
 * Reuses what the project already has rather than modelling anything new:
 *   blueprint3d/model/winged-zebrafish.glb   110 named meshes
 *   blueprint3d/model/manifest.json          each mesh's layer, organ system and ontology id
 *
 * The scroll maps to five stages. Pieces fly in from scattered positions and settle into the
 * assembled animal, then the animal is opened one layer at a time — outer, muscle, skeleton,
 * organs — so the inside is reached by taking the outside off rather than by cutting away.
 *
 * Honesty: the layer and ontology id on every piece come from the manifest, which records which
 * pieces are evidence-backed and which are schematic. The caption says so on screen. This is a
 * viewer, not a measurement, and the geometry outside the fins is schematic.
 *
 * It renders only while on screen, stops entirely under prefers-reduced-motion (showing the
 * assembled animal at rest), and degrades to a plain caption if WebGL or the model is unavailable —
 * a dead canvas would read as a broken page.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL = '../blueprint3d/model/winged-zebrafish.glb';
const MANIFEST = '../blueprint3d/model/manifest.json';

// Stage boundaries in scroll progress [0,1], and what each one says.
const STAGES = [
  { at: 0.00, key: 'assemble', kicker: 'Assembly',
    title: 'One hundred and ten named pieces',
    body: 'Every piece carries an ontology id, so each one can be traced to the term it claims to be. They arrive and settle into the animal.' },
  { at: 0.26, key: 'outer', kicker: 'Outside',
    title: 'Skin, eyes, fin membranes',
    body: 'Eleven pieces in the outer layer. The pectoral fin proportion here is measured; the body geometry around it is schematic, and the manifest marks which is which.' },
  { at: 0.46, key: 'muscle', kicker: 'Under the skin',
    title: 'Myotome',
    body: 'Take the outside off and the swimming muscle is underneath. This is the tissue a launch would have to come from, and the physics check says it cannot deliver one.' },
  { at: 0.66, key: 'skeleton', kicker: 'Deeper',
    title: 'Eighty-three skeletal pieces',
    body: 'The musculoskeletal system is most of the part count. Fin rays, vertebrae, skull — each separable, each named.' },
  { at: 0.86, key: 'organ', kicker: 'Inside',
    title: 'Fourteen organs, eleven systems',
    body: 'Gas bladder, gills, heart, gut, kidney. The inside is reached by taking the outside off, not by cutting the animal in half.' },
];

const LAYER_ORDER = ['outer', 'muscle', 'skeleton', 'organ'];

export async function mountAssembly(host) {
  if (!host) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = host.querySelector('canvas');
  const capEl = host.querySelector('[data-cap]');
  const progEl = host.querySelector('[data-prog]');
  if (!canvas || !capEl) return;

  const fail = (why) => {
    host.querySelector('.asm-stage')?.setAttribute('hidden', '');
    const note = host.querySelector('[data-fallback]');
    if (note) { note.hidden = false; note.textContent = why; }
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return fail('This section needs WebGL, which this browser did not provide. The same model is explorable at /blueprint3d/.');
  }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.01, 100);
  scene.add(new THREE.AmbientLight(0x8fa8d0, 1.5));
  const key = new THREE.DirectionalLight(0xbfd8ff, 2.6); key.position.set(2.4, 2.2, 3.0); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ee7d8, 1.5); rim.position.set(-3, 0.6, -2.2); scene.add(rim);
  const under = new THREE.DirectionalLight(0x9b7bff, 0.8); under.position.set(0, -2.6, 1); scene.add(under);

  let manifest = {};
  try {
    const r = await fetch(MANIFEST);
    if (r.ok) {
      const m = await r.json();
      for (const o of m.objects || []) manifest[o.object] = o;
    }
  } catch { /* the viewer still works; pieces just fall back to 'organ' */ }

  let root;
  try {
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().load(MODEL, res, undefined, () => rej(new Error('load failed'))));
    root = gltf.scene;
  } catch {
    return fail('The 3D model did not load. It is the same one served at /blueprint3d/, which is the better place to explore it anyway.');
  }

  // Normalise: centre the animal and scale it to a known size, so framing does not depend on
  // whatever units the exporter used.
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const s = 2.6 / Math.max(size.x, size.y, size.z);
  root.position.sub(centre);
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(s);
  scene.add(holder);

  // One record per mesh: where it belongs, and where it flies in from.
  const pieces = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const rec = manifest[o.name] || {};
    const layer = LAYER_ORDER.includes(rec.layer) ? rec.layer : 'organ';
    const home = o.position.clone();
    // Scatter outward along the piece's own direction from the centre, so the assembly reads as
    // the animal pulling itself together rather than a random swarm.
    const wp = new THREE.Vector3();
    o.getWorldPosition(wp);
    const dir = wp.lengthSq() > 1e-9 ? wp.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const seed = [...o.name].reduce((a, c) => a + c.charCodeAt(0), 0);
    const rnd = (n) => ((Math.sin(seed * n) + 1) % 1);
    const away = home.clone().add(dir.multiplyScalar(size.length() * (0.55 + rnd(1.7) * 0.9)));
    away.x += (rnd(3.1) - 0.5) * size.length() * 0.3;
    away.y += (rnd(5.3) - 0.5) * size.length() * 0.3;
    if (o.material) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.depthWrite = true;
    }
    pieces.push({
      mesh: o, layer, home, away,
      spinFrom: new THREE.Euler(rnd(2.3) * 2.4 - 1.2, rnd(4.1) * 3.2 - 1.6, rnd(6.7) * 2.0 - 1.0),
      homeQuat: o.quaternion.clone(),
      order: rnd(9.1),
    });
  });

  // ── stage helpers ──────────────────────────────────────────────────────────
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const band = (p, a, b) => clamp01((p - a) / (b - a));

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  function layerOpacity(layer, p) {
    // Each layer is fully present once assembled, then peels away as its stage passes.
    const peel = { outer: [0.40, 0.52], muscle: [0.60, 0.72], skeleton: [0.80, 0.92], organ: [2, 3] }[layer];
    const gone = band(p, peel[0], peel[1]);
    if (layer === 'skeleton') return 1 - gone * 0.86;   // skeleton ghosts rather than vanishing
    if (layer === 'organ') return 1;
    return 1 - gone;
  }

  function apply(p) {
    // 0 -> 0.24 assemble
    const asm = ease(clamp01(p / 0.24));
    for (const pc of pieces) {
      const t = ease(clamp01((asm - pc.order * 0.22) / (1 - pc.order * 0.22 || 1)));
      pc.mesh.position.lerpVectors(pc.away, pc.home, t);
      _e.set(pc.spinFrom.x * (1 - t), pc.spinFrom.y * (1 - t), pc.spinFrom.z * (1 - t));
      _q.setFromEuler(_e);
      pc.mesh.quaternion.copy(pc.homeQuat).premultiply(_q);

      const o = layerOpacity(pc.layer, p) * (0.12 + 0.88 * t);
      if (pc.mesh.material) {
        pc.mesh.material.opacity = o;
        pc.mesh.material.depthWrite = o > 0.9;
      }
      pc.mesh.visible = o > 0.012;
    }
    // Camera: pull in as it assembles, then drift around the animal while it opens.
    const ang = -0.5 + p * 1.9;
    const dist = 5.6 - ease(clamp01(p / 0.24)) * 1.5 - band(p, 0.5, 1) * 0.5;
    camera.position.set(Math.sin(ang) * dist, 0.35 + Math.sin(p * 3.1) * 0.35, Math.cos(ang) * dist);
    camera.lookAt(0, 0, 0);
    holder.rotation.y = p * 0.5;
  }

  // ── caption ────────────────────────────────────────────────────────────────
  let shown = null;
  function caption(p) {
    let st = STAGES[0];
    for (const s2 of STAGES) if (p >= s2.at) st = s2;
    if (shown === st.key) return;
    shown = st.key;
    capEl.style.opacity = '0';
    capEl.style.transform = 'translateY(10px)';
    setTimeout(() => {
      capEl.innerHTML = `<span class="asm-kicker">${st.kicker}</span>
        <h3>${st.title}</h3><p>${st.body}</p>`;
      capEl.style.opacity = '1';
      capEl.style.transform = 'none';
    }, reduce ? 0 : 190);
    for (const d of host.querySelectorAll('[data-dot]')) {
      d.classList.toggle('on', d.dataset.dot === st.key);
    }
  }

  // ── size, scroll, render ───────────────────────────────────────────────────
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }

  let target = 0, current = 0, running = false, raf = 0;
  function progress() {
    const r = host.getBoundingClientRect();
    const span = r.height - innerHeight;
    if (span <= 0) return 0;
    return clamp01(-r.top / span);
  }

  function frame() {
    if (!running) return;
    current += (target - current) * (reduce ? 1 : 0.085);   // the easing that makes it feel sleek
    apply(current);
    caption(current);
    if (progEl) progEl.style.transform = `scaleX(${current.toFixed(4)})`;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const onScroll = () => { target = progress(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { resize(); onScroll(); }, { passive: true });

  new IntersectionObserver((es) => {
    for (const e of es) {
      running = e.isIntersecting;
      if (running) { resize(); onScroll(); cancelAnimationFrame(raf); frame(); }
      else cancelAnimationFrame(raf);
    }
  }, { rootMargin: '120px' }).observe(host);

  resize();
  if (reduce) { target = current = 0.3; apply(0.3); caption(0.3); renderer.render(scene, camera); }
  else { onScroll(); current = target; frame(); }

  host.dataset.ready = '1';
}
