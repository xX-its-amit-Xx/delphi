/* docs/voxels.js — voxel biology floating behind the page.
 *
 * Every sprite is built procedurally from cubes — no model files, no images — and drawn as one
 * InstancedMesh, so a DNA helix of four hundred voxels is a single draw call. They live in the
 * page gutters, rotate slowly, bob, and parallax against scroll at their own depth.
 *
 * Decoration only. Nothing here is read from a result.
 *
 * Cost control, because a background must never be the reason a page is slow:
 *   - one canvas, pixel ratio capped at 1.5, rendering paused when the tab is hidden;
 *   - it stands down entirely under prefers-reduced-motion, on narrow screens, or without WebGL,
 *     and in each case the flat SVG motif layer from bio.js is left to do the job instead.
 */

import * as THREE from 'three';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce && innerWidth >= 1100) boot();

function boot() {
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.className = 'vox-layer';
  canvas.setAttribute('aria-hidden', 'true');
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch { return; }   // no WebGL: the SVG motifs stay, which is fine
  document.body.prepend(canvas);
  document.documentElement.classList.add('has-voxels');   // tells the CSS to retire the flat motifs
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 3, 4); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbff4ea, 0.7); fill.position.set(-3, -1, 2); scene.add(fill);

  // ── voxel builders: each returns [{x,y,z,c}] in a roughly 20-unit box ──────
  const TEAL = 0x0aa38a, LEAF = 0x3fb950, CORAL = 0xff7a59, SUN = 0xf5b829,
        SKY = 0x2f80ed, VIOLET = 0x8b5cf6, CREAM = 0xfff4dc, PINK = 0xf27fa5;

  function dna() {
    const v = [];
    for (let i = 0; i < 36; i++) {
      const t = i * 0.36, y = i - 18;
      const ax = Math.round(Math.cos(t) * 5), az = Math.round(Math.sin(t) * 5);
      v.push({ x: ax, y, z: az, c: TEAL }, { x: -ax, y, z: -az, c: SKY });
      if (i % 3 === 0) {
        for (let k = -4; k <= 4; k++) {
          const f = k / 5;
          v.push({ x: Math.round(ax * f), y, z: Math.round(az * f), c: k < 0 ? SUN : CORAL });
        }
      }
    }
    return v;
  }
  function cell() {
    const v = [];
    for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) for (let z = -8; z <= 8; z++) {
      const r = Math.hypot(x, y, z);
      if (r > 7.2 && r <= 8.2 && (x + y + z) % 2 === 0) v.push({ x, y, z, c: LEAF });      // membrane
      else if (Math.hypot(x - 1.5, y + 1, z) <= 3.2) v.push({ x, y, z, c: VIOLET });        // nucleus
      else if (Math.hypot(x + 4, y - 3, z - 1) <= 1.3) v.push({ x, y, z, c: CORAL });       // organelle
      else if (Math.hypot(x - 3, y - 4, z + 2) <= 1.1) v.push({ x, y, z, c: SUN });
    }
    return v;
  }
  function fish() {
    const v = [];
    for (let x = -11; x <= 11; x++) for (let y = -6; y <= 6; y++) for (let z = -2; z <= 2; z++) {
      const body = (x / 9) ** 2 + (y / 4.6) ** 2 + (z / 2.4) ** 2 <= 1 && x > -9;
      const tail = x <= -8 && x >= -11 && Math.abs(y) <= (-8 - x) * 1.6 + 1 && Math.abs(z) <= 0;
      const fin = y > 3 && y < 7 && x > -3 && x < 4 && z === 0 && y - 3 < 4 - Math.abs(x) / 1.5;
      if (body) v.push({ x, y, z, c: (x + y) % 5 === 0 ? SUN : y > 1 ? SKY : CREAM });
      else if (tail || fin) v.push({ x, y, z, c: TEAL });
    }
    v.push({ x: 6, y: 1, z: 2, c: 0x0e2b29 }, { x: 6, y: 1, z: -2, c: 0x0e2b29 });          // eyes
    return v;
  }
  function mito() {
    const v = [];
    for (let x = -10; x <= 10; x++) for (let y = -5; y <= 5; y++) for (let z = -4; z <= 4; z++) {
      const cx = Math.max(-6, Math.min(6, x));
      const d = Math.hypot(x - cx, y, z);
      if (d <= 4.6 && d > 3.6) v.push({ x, y, z, c: CORAL });                                // outer membrane
      else if (d <= 3.6 && z === 0 && Math.abs(y - Math.round(Math.sin(x * 0.9) * 2.4)) <= 0) v.push({ x, y, z, c: SUN }); // cristae
    }
    return v;
  }
  function leaf() {
    const v = [];
    for (let x = -10; x <= 10; x++) for (let y = -10; y <= 10; y++) {
      const u = (x + y) / 1.414, w = (x - y) / 1.414;
      if ((u / 10) ** 2 + (w / 4.6) ** 2 <= 1) {
        const vein = Math.abs(w) < 0.8 || (Math.abs(w - u * 0.3) < 0.6 && u > -4) || (Math.abs(w + u * 0.3) < 0.6 && u > -4);
        v.push({ x, y, z: 0, c: vein ? 0xd8f5c2 : LEAF });
        if (!vein && (x * 7 + y * 3) % 4 === 0) v.push({ x, y, z: 1, c: 0x56c96a });
      }
    }
    for (let i = 0; i < 4; i++) v.push({ x: -8 - i, y: -8 - i, z: 0, c: 0x2e8f45 });          // stem
    return v;
  }
  function neuron() {
    const v = [];
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++)
      if (Math.hypot(x, y, z) <= 3) v.push({ x, y, z, c: PINK });
    const branch = (ang, len, c, tilt = 0) => {
      for (let i = 3; i < len; i++) {
        v.push({ x: Math.round(Math.cos(ang) * i), y: Math.round(Math.sin(ang) * i), z: Math.round(tilt * i), c });
      }
      const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len;
      for (let k = 1; k < 4; k++) {
        v.push({ x: Math.round(ex + Math.cos(ang + 0.8) * k), y: Math.round(ey + Math.sin(ang + 0.8) * k), z: Math.round(tilt * len), c });
        v.push({ x: Math.round(ex + Math.cos(ang - 0.8) * k), y: Math.round(ey + Math.sin(ang - 0.8) * k), z: Math.round(tilt * len), c });
      }
    };
    for (let a = 0; a < 6; a++) branch(a * 1.05 + 0.3, 7 + (a % 3), TEAL, (a % 2 ? 0.15 : -0.15));
    branch(-Math.PI / 2, 15, VIOLET);                                                         // axon
    return v;
  }
  function hexring() {
    const v = [];
    for (let k = 0; k < 6; k++) {
      const a0 = k * Math.PI / 3, a1 = (k + 1) * Math.PI / 3;
      for (let s = 0; s <= 8; s++) {
        const f = s / 8;
        const x = (Math.cos(a0) * (1 - f) + Math.cos(a1) * f) * 8;
        const y = (Math.sin(a0) * (1 - f) + Math.sin(a1) * f) * 8;
        v.push({ x: Math.round(x), y: Math.round(y), z: 0, c: SKY });
      }
      const ax = Math.round(Math.cos(a0) * 8), ay = Math.round(Math.sin(a0) * 8);
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++)
        v.push({ x: ax + x, y: ay + y, z, c: k % 2 ? CORAL : SUN });                         // atoms
    }
    return v;
  }
  function chromosome() {
    const v = [];
    for (let i = -10; i <= 10; i++) {
      const pinch = Math.abs(i) < 2 ? 1 : 2;
      for (const s of [-1, 1]) {
        const cx = s * (Math.abs(i) * 0.45 + 1.4);
        for (let x = -pinch; x <= pinch; x++) for (let z = -1; z <= 1; z++)
          v.push({ x: Math.round(cx + x), y: i, z, c: Math.abs(i) % 4 === 0 ? CREAM : VIOLET });
      }
    }
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) v.push({ x, y, z: 0, c: SUN });  // centromere
    return v;
  }

  const KINDS = [dna, cell, fish, mito, leaf, neuron, hexring, chromosome];

  // ── build sprites ──────────────────────────────────────────────────────────
  const cube = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
  const sprites = [];
  const N = 8;   // fewer and larger reads better than many and small
  for (let i = 0; i < N; i++) {
    const kind = KINDS[i % KINDS.length];
    const vox = kind();
    // flat sprites (leaf, hex ring) vanish into a line when they turn edge-on, so they rock
    // gently instead of spinning all the way round
    const flat = kind === leaf || kind === hexring;
    const mesh = new THREE.InstancedMesh(cube, mat, vox.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    vox.forEach((p, k) => {
      m.makeTranslation(p.x, p.y, p.z);
      mesh.setMatrixAt(k, m);
      mesh.setColorAt(k, col.setHex(p.c));
    });
    mesh.instanceColor.needsUpdate = true;
    const g = new THREE.Group();
    g.add(mesh);
    const side = i % 2;                                 // left or right gutter
    const slot = Math.floor(i / 2);                     // 0..3 within that column
    sprites.push({
      side, slot,
      g,
      gx: side ? 0.80 + ((i * 7) % 15) / 100 : 0.03 + ((i * 11) % 14) / 100,   // fraction of width
      gy: ((i * 37) % 90) / 100 + 0.05,                                        // fraction of height
      // large enough that the individual cubes read - at 40px a voxel sprite is just a smudge
      size: 96 + ((i * 23) % 70),                                              // pixels per 20 units
      depth: 0.2 + ((i * 29) % 70) / 100,
      spin: (0.12 + ((i * 13) % 20) / 100) * (i % 3 ? 1 : -1),
      flat,
      bob: 0.6 + (i % 4) * 0.25,
      phase: i * 1.7,
      tilt: (i % 5) * 0.25,
    });
    scene.add(g);
  }

  // ── layout, scroll, render ─────────────────────────────────────────────────
  let W = 0, H = 0;
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  let running = !document.hidden;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) loop();
  });

  const t0 = performance.now();
  function loop() {
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    const sy = scrollY;
    // Measure the real gutter each frame (it changes with the window), and keep every sprite
    // inside it: a fixed fraction of the width put the hex ring across the headline on a
    // 1920px screen.
    const gutter = Math.max(0, (W - 1320) / 2);
    const bandH = (H * 1.25) / Math.ceil(sprites.length / 2);
    for (const s of sprites) {
      // capped by the gutter AND by the band: the DNA model is 36 voxels tall, so at full size it
      // would reach into the next band and overlap its neighbour
      const px = Math.min(s.size, gutter * 0.78, bandH * 0.5);
      if (px < 48) { s.g.visible = false; continue; }   // no room: hide rather than overlap text
      s.g.visible = true;
      const k = px / 20;
      s.g.scale.setScalar(k);
      // Each column is a ring of evenly spaced bands that scrolls as ONE unit (a shared parallax
      // depth per column), so the spacing between sprites can never collapse into a pile - which
      // is what per-sprite depths did on a long page.
      const perCol = Math.ceil(sprites.length / 2);
      const ring = H * 1.25;
      const band = ring / perCol;
      const colDepth = s.side ? 0.34 : 0.22;
      const lane = s.slot % 2 ? 0.62 : 0.38;           // stagger left/right inside the gutter
      const x = s.side ? W - gutter * lane : gutter * lane;
      const base = s.slot * band + band / 2 + Math.sin(t * s.bob + s.phase) * 8 - sy * colDepth;
      const wy = ((base % ring) + ring) % ring - H * 0.12;
      s.g.position.set(x, -wy, 0);
      const yaw = s.flat ? Math.sin(t * s.spin * 2 + s.phase) * 0.6 : t * s.spin + s.phase;
      s.g.rotation.set(s.tilt * (s.flat ? 0.4 : 1) + Math.sin(t * 0.3 + s.phase) * 0.25, yaw, Math.sin(t * 0.2 + s.phase) * 0.15);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
}
