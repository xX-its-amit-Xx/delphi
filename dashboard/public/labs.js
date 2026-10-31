(function () {
'use strict';
const $ = s => document.querySelector(s);
const vis = (elm, cb) => { const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), { threshold: 0.05 }); io.observe(elm); };

// ---------- 1. Gray-Scott reaction-diffusion ----------
(function () {
  const cv = $('#gsCanvas'); if (!cv) return;
  const N = 160, ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
  let u = new Float32Array(N * N), v = new Float32Array(N * N), u2 = new Float32Array(N * N), v2 = new Float32Array(N * N);
  const Du = 0.16, Dv = 0.08;
  let F = 0.0367, K = 0.0649, run = false;
  const presets = [['Dividing spots', 0.0367, 0.0649], ['Coral', 0.0545, 0.062], ['Maze', 0.029, 0.057], ['Worms', 0.078, 0.061]];
  function seed(cx, cy, r) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const i = ((cy + y + N) % N) * N + ((cx + x + N) % N); u[i] = 0.5; v[i] = 0.25 + Math.random() * 0.02; } }
  function reset() { u.fill(1); v.fill(0); seed(N >> 1, N >> 1, 8); for (let i = 0; i < 6; i++) seed(Math.random() * N | 0, Math.random() * N | 0, 3); }
  function step() {
    for (let y = 0; y < N; y++) { const ym = ((y + N - 1) % N) * N, yp = ((y + 1) % N) * N, yc = y * N;
      for (let x = 0; x < N; x++) { const xm = (x + N - 1) % N, xp = (x + 1) % N, i = yc + x;
        const lu = u[ym + x] + u[yp + x] + u[yc + xm] + u[yc + xp] - 4 * u[i], lv = v[ym + x] + v[yp + x] + v[yc + xm] + v[yc + xp] - 4 * v[i];
        const uvv = u[i] * v[i] * v[i];
        u2[i] = u[i] + Du * lu - uvv + F * (1 - u[i]); v2[i] = v[i] + Dv * lv + uvv - (F + K) * v[i]; } }
    [u, u2] = [u2, u]; [v, v2] = [v2, v];
  }
  function draw() { const d = img.data; for (let i = 0; i < N * N; i++) { const t = Math.min(1, v[i] * 3.2); d[4 * i] = 12 + 240 * t; d[4 * i + 1] = 30 + 190 * t * t + 40 * t; d[4 * i + 2] = 60 + 90 * (1 - t) * (1 - t) + 30 * t; d[4 * i + 3] = 255; } ctx.putImageData(img, 0, 0); }
  function loop() { if (!run) return; for (let i = 0; i < 8; i++) step(); draw(); requestAnimationFrame(loop); }
  const sync = () => { $('#gsF').value = F; $('#gsK').value = K; $('#gsFv').textContent = F.toFixed(4); $('#gsKv').textContent = K.toFixed(4); };
  $('#gsPresets').innerHTML = presets.map((p, i) => `<button data-i="${i}">${p[0]}</button>`).join('');
  $('#gsPresets').onclick = e => { const b = e.target.closest('button'); if (!b) return; const p = presets[+b.dataset.i]; F = p[1]; K = p[2]; sync(); reset(); };
  $('#gsF').oninput = e => { F = +e.target.value; sync(); };
  $('#gsK').oninput = e => { K = +e.target.value; sync(); };
  $('#gsReset').onclick = reset;
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); seed(((e.clientX - r.left) / r.width * N) | 0, ((e.clientY - r.top) / r.height * N) | 0, 5); });
  reset(); sync(); draw();
  vis(cv, on => { run = on; if (on) loop(); });
})();

// ---------- 2. Elementary cellular automaton ----------
(function () {
  const cv = $('#caCanvas'); if (!cv) return;
  const W = cv.width, H = cv.height, ctx = cv.getContext('2d');
  function draw() {
    const rule = Math.max(0, Math.min(255, +$('#caRule').value | 0));
    let row = new Uint8Array(W);
    if ($('#caStart').value === 'one') row[W >> 1] = 1; else for (let i = 0; i < W; i++) row[i] = Math.random() < .5 ? 1 : 0;
    const img = ctx.createImageData(W, H), d = img.data;
    const dark = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) { const o = 4 * (y * W + x); const on = row[x]; d[o] = on ? 240 : 14; d[o + 1] = on ? 240 : 24; d[o + 2] = on ? 235 : 28; d[o + 3] = 255; }
      const nx = new Uint8Array(W);
      for (let x = 0; x < W; x++) { const idx = (row[(x + W - 1) % W] << 2) | (row[x] << 1) | row[(x + 1) % W]; nx[x] = (rule >> idx) & 1; }
      row = nx;
    }
    ctx.putImageData(img, 0, 0);
  }
  const P = [[30, 'Looks random'], [90, 'Triangles'], [110, 'Universal'], [184, 'Traffic'], [54, 'Mixed']];
  $('#caPresets').innerHTML = P.map(p => `<button data-r="${p[0]}">Rule ${p[0]}: ${p[1]}</button>`).join('');
  $('#caPresets').onclick = e => { const b = e.target.closest('button'); if (b) { $('#caRule').value = b.dataset.r; draw(); } };
  $('#caRule').oninput = draw; $('#caStart').onchange = draw; draw();
})();

// ---------- 3. Wright-Fisher drift and selection ----------
(function () {
  const svg = $('#wfSvg'); if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  function binom(n, p) {
    if (p <= 0) return 0; if (p >= 1) return n; if (p > 0.5) return n - binom(n, 1 - p);
    if (n * p < 30) { const q = 1 - p, s = p / q, a = (n + 1) * s; let r = Math.pow(q, n), u = Math.random(), x = 0; while (u > r) { u -= r; x++; r *= (a / x - s); if (x > n) break; } return Math.min(x, n); }
    const m = n * p, sd = Math.sqrt(m * (1 - p)); let g = 0; for (let i = 0; i < 6; i++) g += Math.random(); g = (g - 3) * Math.SQRT2; // approx normal
    return Math.max(0, Math.min(n, Math.round(m + sd * g)));
  }
  function evolve(N, s, p0, maxGen, keep) {
    let k = Math.round(p0 * N), path = keep ? [k / N] : null, g = 0;
    while (k > 0 && k < N && g < maxGen) { const p = k / N, pe = p * (1 + s) / (1 + s * p); k = binom(N, pe); g++; if (keep) path.push(k / N); }
    return { fixed: k === N, path };
  }
  const P0 = 0.1;
  const theory = (N, s) => s === 0 ? P0 : (1 - Math.exp(-2 * N * s * P0)) / (1 - Math.exp(-2 * N * s));
  const sync = () => { $('#wfNv').textContent = $('#wfN').value; $('#wfSv').textContent = (+$('#wfS').value).toFixed(3); };
  function run() {
    const N = +$('#wfN').value, s = +$('#wfS').value, G = 6 * N;
    svg.innerHTML = '';
    const mk = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    mk('rect', { x: 30, y: 10, width: 360, height: 190, fill: 'none', stroke: 'var(--line)' });
    [0, .5, 1].forEach(v => { const t = mk('text', { x: 24, y: 200 - v * 190 + 4, 'text-anchor': 'end', 'font-size': 10 }); t.textContent = v; });
    mk('text', { x: 210, y: 215, 'text-anchor': 'middle', 'font-size': 10 }).textContent = 'generations (up to ' + G + ')';
    let fixed = 0; const reps = 40;
    for (let i = 0; i < reps; i++) {
      const r = evolve(N, s, P0, G, true); if (r.fixed) fixed++;
      const pts = r.path.map((p, g) => (30 + g / G * 360).toFixed(1) + ',' + (200 - p * 190).toFixed(1)).join(' ');
      mk('polyline', { points: pts, fill: 'none', stroke: r.fixed ? 'var(--ok)' : 'var(--bad)', 'stroke-opacity': .55, 'stroke-width': 1.2 });
    }
    let big = 0; const R = 2000; for (let i = 0; i < R; i++) if (evolve(N, s, P0, 40 * N, false).fixed) big++;
    const newMut = s === 0 ? 1 / N : (1 - Math.exp(-2 * s)) / (1 - Math.exp(-2 * N * s));
    $('#wfOut').innerHTML = `Variant starts at 10%. Simulated fixation over ${R} populations: <b>${(big / R * 100).toFixed(1)}%</b>. Diffusion formula: <b>${(theory(N, s) * 100).toFixed(1)}%</b>. Green lines took over, red were lost.<br><span class="mute">A brand-new single-copy mutation would fix with probability about ${(newMut * 100).toFixed(2)}% under the same model, which is why most new mutations vanish.</span>`;
  }
  $('#wfN').oninput = sync; $('#wfS').oninput = sync; $('#wfRun').onclick = run; sync(); run();
})();

// ---------- 4. 3D shell (Raup model) ----------
(function () {
  const host = $('#shell3d'); if (!host) return;
  if (typeof THREE === 'undefined') { host.innerHTML = '<p style="color:#9fb;padding:12px">3D library could not be loaded.</p>'; return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { host.innerHTML = '<p style="color:#9fb;padding:12px">WebGL is not available in this browser.</p>'; return; }
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 1000);
  host.appendChild(renderer.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55)); const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 4, 5); scene.add(dl);
  const group = new THREE.Group(); scene.add(group); group.rotation.x = -1.1;
  let mesh;
  function build() {
    const W = +$('#shW').value, D = +$('#shD').value, T = +$('#shT').value;
    $('#shWv').textContent = W.toFixed(2); $('#shDv').textContent = D.toFixed(2); $('#shTv').textContent = T.toFixed(1);
    const turns = 4, NT = 260, NP = 36, lw = Math.log(W);
    const pos = [], col = [], idx = [];
    for (let i = 0; i <= NT; i++) { const th = i / NT * turns * Math.PI * 2, s = Math.pow(W, th / (2 * Math.PI)), zc = T * (s - 1) / lw;
      for (let j = 0; j <= NP; j++) { const ph = j / NP * Math.PI * 2, rad = s * (D + Math.cos(ph));
        pos.push(rad * Math.cos(th), rad * Math.sin(th), s * Math.sin(ph) - zc);
        const band = (Math.floor(i / 8) % 2) ? 1 : 0.78, shade = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(ph));
        col.push((0.93 * band) * shade, (0.78 * band) * shade, (0.6 * band) * shade); } }
    for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) { const a = i * (NP + 1) + j, b = a + NP + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    if (mesh) { group.remove(mesh); mesh.geometry.dispose(); }
    mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .05, side: THREE.DoubleSide }));
    const c = g.boundingSphere.center, r = g.boundingSphere.radius; mesh.position.set(-c.x, -c.y, -c.z); group.add(mesh); cam.position.set(0, 0, r * 3.1); cam.far = r * 20; cam.updateProjectionMatrix();
  }
  function size() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  let drag = null, auto = true, on = false;
  host.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; auto = false; host.setPointerCapture(e.pointerId); });
  host.addEventListener('pointermove', e => { if (!drag) return; group.rotation.z += (e.clientX - drag[0]) * 0.01; group.rotation.x += (e.clientY - drag[1]) * 0.01; drag = [e.clientX, e.clientY]; });
  host.addEventListener('pointerup', () => { drag = null; });
  ['#shW', '#shD', '#shT'].forEach(s => $(s).addEventListener('input', build));
  function loop() { if (!on) return; if (auto) group.rotation.z += 0.006; renderer.render(scene, cam); requestAnimationFrame(loop); }
  build(); size(); addEventListener('resize', size);
  vis(host, v => { on = v; if (v) { size(); loop(); } });
})();

// ---------- 5. Hamilton's rule ----------
(function () {
  if (!$('#haR')) return;
  const upd = () => {
    const r = +$('#haR').value, B = +$('#haB').value, C = +$('#haC').value;
    $('#haRv').textContent = r; $('#haBv').textContent = B; $('#haCv').textContent = C;
    const rb = r * B, ok = rb > C;
    $('#haOut').innerHTML = `<span style="color:var(--${ok ? 'ok' : 'bad'})">r&middot;B = ${rb.toFixed(2)} ${ok ? '>' : rb === C ? '=' : '<'} C = ${C}: ${ok ? 'helping can spread' : 'helping is selected against'}</span>`;
  };
  const P = [['Full siblings', .5], ['Half siblings', .25], ['First cousins', .125], ['Sisters in ants and bees (haplodiploid)', .75], ['Clone mates', 1]];
  $('#haPresets').innerHTML = P.map((p, i) => `<button data-i="${i}">${p[0]} (r=${p[1]})</button>`).join('');
  $('#haPresets').onclick = e => { const b = e.target.closest('button'); if (b) { $('#haR').value = P[+b.dataset.i][1]; upd(); } };
  ['#haR', '#haB', '#haC'].forEach(s => $(s).addEventListener('input', upd)); upd();
})();
})();
