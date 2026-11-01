// scene3d.js -- the 3D view of this page's flight simulator.
//
// THE ONE HARD RULE. Every frame, the fish's position, its orientation and the speed in the readout come from
// the solver's own computed state: the run returned by window.DELPHI_SIM.solve() (the RK4 integration in
// index.html), linearly interpolated in time between its 0.02 s samples. There is not one hand-authored
// keyframe anywhere in this file, and nothing here integrates any equation of motion of its own. Playing the
// scrub bar backwards replays the same computed states backwards; it does not re-simulate.
//
// WHAT IS COMPUTED (by the solver in index.html, from params.json):
//   trajectory x(t), z(t)        the RK4 integration of the point-mass model
//   speed, airspeed              |v| from the solver state (airspeed adds the headwind)
//   height / depth               z(t) (z = 0 is the sea surface)
//   pitch                        atan2(vz, vx) from the solver velocity, plus the solver's own angle-of-attack
//                                parameter for the phase (glide_alpha_deg / pitch_at_leap_deg)
//   phase boundaries             swim / taxi / glide / stopped, the solver's own phase flags
//   v_min, (L/D)max              derived in index.html from params.json
//   ground-effect drag factor    the measured curve (physics/ground-effect.json) at the frame's height
//   the Lean-covered distance    apex height x (L/D)max, the bound sim-engine/scenarios/glide.mjs reports as
//                                glide_range_lean_bound_m; the rest of the range is the kinetic phase, which
//                                that theorem does NOT cover
//   fish size                    metres per model unit from the GLB's manifest (blueprint3d/partedit.js
//                                metresPerUnit), so a 20 cm fish is 20 cm against the waves
//
// WHAT IS DECORATIVE (chosen to look like the sea; no evidence, nothing measured, affects no number):
//   the wave shape and its motion, the sky gradient and the sun, the spray, the lighting, the water colour,
//   the caudal-fin beat, the camera's smoothing, the depth ladder's and distance ruler's styling, and the
//   school / predator / distant gliders if creatures.js is present. Every one of these is listed in the
//   on-screen legend under "decorative", in these words.
//
// MODULES THIS CODE CONSUMES WHEN THEY LAND (each has a trivial, clearly marked local fallback):
//   ./env3d.js        makeOcean({scene, THREE}) -> {mesh, update(t), heightAt(x,z)}, makeSky(...), makeSpray(...)
//   ./creatures.js    makeEnsemble({draws, seed, distributions}), perturbRun(baseParams, rng)  [PHYSICS]
//                     mountCreatures({scene, THREE, ...})                                     [DECORATIVE]
//   ./params-panel.js mountParams({host, api})     ./sweep.js  mountSweep({host, api})
//   The parameter panel and the sweep output get the two empty slots at the bottom of this card.
//
// ENTRY POINT FOR sweep.js / params-panel.js:
//   solveTrajectory({ params: {<params.json key>: number|boolean, ...}, tmax?: number }) ->
//     { ok, reason?, metrics:{...}, samples:[{t,x,z,vx,vz,v,ph}], derived:{vmin,LDmax,span,mass,area} }
//   It is pure: it clones the live entry, applies `params`, and runs a complete solve without touching the
//   page's own run. It is also on window.DELPHI_SIM3D.solveTrajectory. It needs the DOM (the solver lives in
//   index.html), so a Web Worker must route through the page rather than import this module.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { metresPerUnit } from '../../../blueprint3d/partedit.js';

const MODEL_DIR = '../../../blueprint3d/model/';
// Sea-tile resolution. 64 m of tile at 80 segments is a 0.8 m cell: the wave the fish RIDES is read from
// env3d's analytic surface, not from this mesh, so the mesh only has to look like water. Overridable with
// ?s3seg= for the performance check.
const OCEAN_SEGMENTS = (() => {
  const q = +new URLSearchParams(location.search).get('s3seg');
  return q >= 8 && q <= 176 ? Math.round(q) : 80;
})();

// Each entry names the MESH it draws and the SOLVER ENTRY it is flown with. They are separate things and the
// legend says which is which: a mesh standing in for a design with no committed polar is never flown as if it
// had one.
export const SPECIES = [
  {
    key: 'flying-fish', label: 'Flying fish (real, measured)', hypothetical: false,
    glb: 'flying-fish.glb', manifest: 'manifest.json', preset: null, base: 'cypselurus-hiraii-L3', flown: true,
    meshNote: 'flying-fish.glb; its manifest states no standard_length_m, so the metres per model unit uses the solver entry’s standard_length_m (0.203 m, Park & Choi 2010 model L3) over the manifest’s SL of 0.82 model units',
  },
  {
    key: 'tff', label: 'HYPOTHETICAL TFF v2 (truly flying fish)', hypothetical: true,
    glb: 'tff.glb', manifest: 'tff-manifest.json', preset: null, base: 'tff-v2-hypothetical', flown: true,
    meshNote: 'tff.glb, a parametric design (anatomy-model/parametric): nothing about it was observed',
  },
  {
    key: 'flier-f1', label: 'HYPOTHETICAL flier F1', hypothetical: true,
    glb: 'tff.glb', manifest: 'tff-manifest.json', preset: null, base: 'flier-F1-hypothetical', flown: true,
    meshNote: 'the F1 design has no mesh of its own, so tff.glb stands in: the BODY you see is the TFF v2 design, the NUMBERS are the F1 entry in params.json',
  },
  {
    key: 'winged-zebrafish', label: 'HYPOTHETICAL winged zebrafish', hypothetical: true,
    glb: 'winged-zebrafish.glb', manifest: 'winged-zebrafish-manifest.json', preset: null, base: 'zebrafish-winged-hypothetical', flown: true,
    meshNote: 'winged-zebrafish.glb, a parametric design drawn at an ASSUMED pectoral/SL; the real double heterozygote’s fin measurements exist only in that paper’s figure panels and are not digitised anywhere here',
  },
  {
    key: 'zebrafish-adult', label: 'Zebrafish, adult (ordinary fins)', hypothetical: false,
    glb: 'zebrafish-adult.glb', manifest: 'manifest-adult.json', preset: 'zebrafish', base: 'zebrafish-winged-hypothetical', flown: true,
    meshNote: 'zebrafish-adult.glb (observed anatomy); its manifest states no standard_length_m, so the scale uses the solver entry’s standard_length_m (0.03 m, assumed, within the FishBase range) over the manifest’s SL of 0.78 model units',
  },
  {
    key: 'wingless-flying-fish', label: 'HYPOTHETICAL wingless flying fish — NOT FLOWN', hypothetical: true,
    glb: 'wingless-flying-fish.glb', manifest: 'wingless-flying-fish-manifest.json', preset: null, base: null, flown: false,
    notFlownWhy: 'No fin polar is committed for this design: it has no entry in params.json and no preset in presets.json, and a lifting surface it does not have cannot be borrowed from the fish that does. So it is NOT flown here. The mesh floats at the surface so you can compare the body; the trajectory, the readout and the charts stay on the last flown entry.',
    meshNote: 'wingless-flying-fish.glb, a parametric design',
  },
];

// ------------------------------------------------------------------ small helpers
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fx = (v, n = 2) => (typeof v === 'number' && isFinite(v) ? v.toFixed(n) : '—');
const PHASE_LABEL = { swim: 'underwater swim', taxi: 'surface taxi', glide: 'glide', stopped: 'down / stopped' };
const PHASE_COLOR = { swim: [0.16, 0.52, 0.62], taxi: [0.92, 0.45, 0.16], glide: [0.11, 0.69, 0.48], stopped: [0.70, 0.22, 0.18] };

// ------------------------------------------------------------------ DECORATIVE fallback environment
// Used only until env3d.js lands. It is three sine waves and a gradient: a look, not a sea state. heightAt()
// evaluates exactly the same sum the vertex shader does, so the fish sits on the surface it is drawn on.
const FALLBACK_WAVE_GLSL = `
float waveH(vec2 p, float tt){
  return 0.090*sin(p.x*0.55 + tt*1.10)
       + 0.050*sin(p.y*0.73 - tt*0.80)
       + 0.028*sin((p.x+p.y)*0.33 + tt*1.70);
}`;
function fallbackWaveH(x, z, t) {
  return 0.090 * Math.sin(x * 0.55 + t * 1.10)
    + 0.050 * Math.sin(z * 0.73 - t * 0.80)
    + 0.028 * Math.sin((x + z) * 0.33 + t * 1.70);
}
function fallbackOcean({ scene, THREE: T }) {
  const geo = new T.PlaneGeometry(1, 1, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const uni = { uTime: { value: 0 }, uDeep: { value: new T.Color(0x0b3d4d) }, uShal: { value: new T.Color(0x2b8ba6) }, uFoam: { value: new T.Color(0xbfe4ee) } };
  const mat = new T.ShaderMaterial({
    uniforms: uni, side: T.DoubleSide, transparent: true,
    vertexShader: `${FALLBACK_WAVE_GLSL}
      uniform float uTime; varying vec3 vW; varying float vH;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        float h = waveH(w.xz, uTime);
        w.y += h; vW = w.xyz; vH = h;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `${FALLBACK_WAVE_GLSL}
      uniform float uTime; uniform vec3 uDeep, uShal, uFoam; varying vec3 vW; varying float vH;
      void main(){
        float e = 0.35;
        float hx = waveH(vW.xz + vec2(e,0.0), uTime) - waveH(vW.xz - vec2(e,0.0), uTime);
        float hz = waveH(vW.xz + vec2(0.0,e), uTime) - waveH(vW.xz - vec2(0.0,e), uTime);
        vec3 n = normalize(vec3(-hx, 2.0*e, -hz));
        float lam = clamp(dot(n, normalize(vec3(-0.45, 0.78, 0.44))), 0.0, 1.0);
        vec3 c = mix(uDeep, uShal, clamp(vH*2.6 + 0.5, 0.0, 1.0));
        c = mix(c, uFoam, smoothstep(0.085, 0.14, vH) * 0.55);
        c *= 0.62 + 0.52*lam;
        float d = length(vW.xz - cameraPosition.xz);
        gl_FragColor = vec4(c, 1.0 - smoothstep(120.0, 260.0, d)*0.55);
      }`,
  });
  const mesh = new T.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  let t = 0;
  return {
    mesh, uniforms: uni,
    update(tt) { t = tt; uni.uTime.value = tt; },
    heightAt(x, z) { return fallbackWaveH(x, z, t); },
    source: 'fallback in scene3d.js (env3d.js has not landed): three sine waves, DECORATIVE',
  };
}
function fallbackSky({ scene, THREE: T }) {
  const geo = new T.SphereGeometry(1200, 24, 16);
  const mat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new T.Color(0x3f7fb5) }, uBot: { value: new T.Color(0xd8ecf3) }, uSun: { value: new T.Vector3(-0.45, 0.30, 0.44).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uTop, uBot, uSun; varying vec3 vD;
      void main(){
        vec3 c = mix(uBot, uTop, clamp(vD.y*1.5 + 0.1, 0.0, 1.0));
        float s = max(dot(normalize(vD), uSun), 0.0);
        c += vec3(1.0, 0.92, 0.74) * (pow(s, 220.0)*1.2 + pow(s, 7.0)*0.18);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new T.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, update() {}, source: 'fallback in scene3d.js: a two-colour gradient and a sun glow, DECORATIVE' };
}
function fallbackSpray({ scene, THREE: T }) {
  const N = 180;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const mat = new T.PointsMaterial({ color: 0xeaf6fa, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false });
  const pts = new T.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  let next = 0, prev = 0;
  return {
    points: pts,
    // x, y, z: where the fish is; speed: how fast; dt: seconds. All emission is DECORATIVE.
    emit(x, y, z, speed, dt) {
      const n = Math.min(6, Math.floor(speed * dt * 14));
      for (let k = 0; k < n; k++) {
        const i = next; next = (next + 1) % N;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        vel[i * 3] = -speed * (0.10 + 0.22 * Math.random());
        vel[i * 3 + 1] = speed * (0.05 + 0.16 * Math.random());
        vel[i * 3 + 2] = speed * (Math.random() - 0.5) * 0.18;
        life[i] = 0.55 + Math.random() * 0.5;
      }
    },
    update(t) {
      const dt = clamp(t - prev, 0, 0.1); prev = t;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) { pos[i * 3 + 1] = -9999; continue; }
        life[i] -= dt;
        vel[i * 3 + 1] -= 9.81 * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
    },
    source: 'fallback in scene3d.js: ballistic dots, DECORATIVE',
  };
}

// ------------------------------------------------------------------ the page's solver, through its bridge
function bridge() {
  const B = window.DELPHI_SIM;
  if (!B || !B.ready) throw new Error('the simulator on this page is not ready yet (window.DELPHI_SIM)');
  return B;
}

/** A complete solve with `params` applied to the live entry. Pure: the page's own run is untouched.
 *  This is the entry point sweep.js and params-panel.js call. */
export function solveTrajectory(opts = {}) {
  let B;
  try { B = bridge(); } catch (e) { return { ok: false, reason: String(e.message || e) }; }
  const f = B.cloneFish();
  const applied = [], refused = [];
  for (const [k, v] of Object.entries(opts.params || {})) {
    if (!f[k]) {
      if (k === 'headwind_m_s') f[k] = { kind: 'assumed', source: HEADWIND_SOURCE };
      else { refused.push({ key: k, reason: 'no such parameter in the live params.json entry; the simulator does not invent parameters' }); continue; }
    }
    f[k].value = v; applied.push(k);
  }
  const ge = opts.params && opts.params.ground_effect != null ? !!opts.params.ground_effect : B.groundEffectOn();
  let S;
  try { S = B.solve({ fish: f, groundEffect: ge }, opts.tmax); }
  catch (e) { return { ok: false, reason: 'the solver threw: ' + String(e.message || e), applied, refused }; }
  const d = B.deriveOf(f);
  const tr = trajectoryOf(S, d);
  return {
    ok: true, applied, refused,
    derived: { vmin: d.vmin, LDmax: d.LDmax, span_m: d.b * 2, mass_kg: d.m, ref_area_m2: d.S, wind_m_s: d.wind, ground_effect: ge },
    metrics: tr.metrics,
    samples: S.hist,
  };
}

const HEADWIND_SOURCE = 'uniform horizontal headwind, ASSUMED (a what-if, not a condition of any run): 0 in every committed params.json entry, and at 0 the equations are the committed ones number for number. A non-zero value makes the aerodynamic forces use the air-relative velocity (vx + u, vz), the same convention as sim-engine/scenarios/glide.mjs';

/** Read a finished solve into the shape the 3D view plays back. Nothing is smoothed or invented. */
function trajectoryOf(S, d) {
  const h = S.hist || [];
  // `apex` is the apex of the FIRST glide: the Lean bound and the kinetic phase are a property of one
  // glide, and this run can contain several, so mixing a later glide's apex into the first one's range
  // would give a number belonging to no glide at all.
  let launch = null, touchdown = null, apex = null, vmax = 0, xmax = 0, zmin = 0;
  for (let i = 0; i < h.length; i++) {
    const s = h[i], p = i ? h[i - 1] : null;
    if (p && s.ph === 'glide' && p.ph !== 'glide' && !launch) launch = { t: s.t, x: s.x, z: s.z, v: s.v };
    if (p && launch && s.ph !== 'glide' && p.ph === 'glide' && !touchdown) touchdown = { t: s.t, x: s.x, z: s.z, v: s.v };
    if (launch && !touchdown && (!apex || s.z > apex.z)) apex = { t: s.t, x: s.x, z: s.z, v: s.v };
    if (s.v > vmax) vmax = s.v;
    if (s.x > xmax) xmax = s.x;
    if (s.z < zmin) zmin = s.z;
  }
  const liftSupported = !!(S.takeoffV != null && S.takeoffV >= d.vmin);
  const apexZ = apex ? Math.max(0, apex.z) : 0;
  // The bound sim-engine/scenarios/glide.mjs reports as glide_range_lean_bound_m: h x (L/D)max, measured from
  // the apex of the computed path. Everything beyond it is the kinetic phase, which the Lean theorem does not
  // cover. Both are kept apart here, exactly as that scenario keeps them apart.
  // No glide phase at all means no range to split: both parts are 0, not a number read off a run that
  // never left the water.
  const airborne = !!launch;
  const leanBound_m = airborne ? apexZ * d.LDmax : 0;
  const glideEndX = touchdown ? touchdown.x : (h.length ? h[h.length - 1].x : 0);
  const glideFrom = airborne && apex ? apex.x : 0;
  const flownPastApex_m = airborne ? Math.max(0, glideEndX - glideFrom) : 0;
  return {
    samples: h,
    t0: h.length ? h[0].t : 0,
    t1: h.length ? h[h.length - 1].t : 0,
    launch, touchdown, apex,
    metrics: {
      takeoff_speed_m_s: S.takeoffV, v_min_m_s: d.vmin, lift_supported_at_launch: liftSupported,
      apex_height_m: airborne ? apexZ : 0, max_speed_m_s: vmax, range_m: xmax, start_depth_m: zmin,
      airborne,
      glide_range_lean_bound_m: leanBound_m,
      kinetic_phase_m: airborne ? Math.max(0, flownPastApex_m - leanBound_m) : 0,
      lean_bound_exceeded: airborne && flownPastApex_m > leanBound_m + 1e-6,
      n_glides: (S.glides || []).length, LD_max: d.LDmax, headwind_m_s: d.wind,
      duration_s: h.length ? h[h.length - 1].t : 0,
    },
    leanBound_m, glideFrom, xmax, zmin, liftSupported,
  };
}

// ------------------------------------------------------------------ mesh loading
const loader = new GLTFLoader();
const meshCache = new Map();
const _box2 = new THREE.Box3();

/** Load a GLB + its manifest, keep only the OUTER layer (skin, eyes, fins), and scale model units to metres. */
async function loadFish(spec, solverSL_m) {
  const ck = spec.glb + '|' + solverSL_m;
  if (meshCache.has(ck)) return meshCache.get(ck);
  const p = (async () => {
    const [gltf, manifest] = await Promise.all([
      new Promise((res, rej) => loader.load(MODEL_DIR + spec.glb, res, undefined, e => rej(new Error(spec.glb + ' did not load: ' + ((e && e.message) || e))))),
      fetch(MODEL_DIR + spec.manifest).then(r => { if (!r.ok) throw new Error(spec.manifest + ' HTTP ' + r.status); return r.json(); }),
    ]);
    const root = gltf.scene;

    // metres per model unit: partedit.js's own function first. Two manifests (flying-fish, zebrafish-adult)
    // state the standard length in model units but not in metres, so for those the metres come from the
    // SOLVER entry's standard_length_m, which carries its own source in the parameter table. Nothing is guessed.
    const sc = metresPerUnit(manifest);
    let mpu = sc.m_per_unit, scaleSource = sc.source;
    if (!(mpu > 0)) {
      if (sc.SL_units > 0 && solverSL_m > 0) {
        mpu = solverSL_m / sc.SL_units;
        scaleSource = `the manifest states SL = ${sc.SL_units} model units but no standard_length_m, so the metres come from the solver entry's standard_length_m (${solverSL_m} m): ${solverSL_m} / ${sc.SL_units}`;
      } else {
        throw new Error('no metres per model unit for ' + spec.manifest + ': ' + (sc.reason || 'unknown') + ' -- the scale is not guessed, so the fish is not drawn');
      }
    }

    // keep the outside of the animal: 11-17 meshes instead of 100-190, so one fish is ~a dozen draw calls
    const outer = new Set((manifest.objects || []).filter(o => o.layer === 'outer').map(o => o.object || o.name));
    let kept = 0, hidden = 0, caudal = null;
    // The box is expanded over the KEPT meshes only: the hidden internals (and anything a design file
    // carries outside the body) must not set the scale of the animal on screen.
    const box = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh) return;
      if (outer.size && !outer.has(o.name)) { o.visible = false; hidden++; return; }
      kept++;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _box2.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(_box2);
      o.castShadow = false; o.receiveShadow = false;
      o.frustumCulled = true;
      if (o.material) {
        const m = o.material.clone();
        m.side = THREE.FrontSide;
        if ('roughness' in m) m.roughness = Math.min(0.75, (m.roughness == null ? 0.6 : m.roughness));
        if ('metalness' in m) m.metalness = Math.min(0.2, m.metalness || 0);
        m.flatShading = false;
        o.material = m;
      }
      if (o.name === 'caudal_fin') caudal = o;
    });

    // the mesh in model units, so the readout can state the drawn length in metres
    if (box.isEmpty()) box.setFromObject(root);
    const sizeU = box.getSize(new THREE.Vector3());
    const centreU = box.getCenter(new THREE.Vector3());

    // a pivot: the fish's own centre at the origin, model units scaled to metres, head already at +X
    const pivot = new THREE.Group();
    root.position.set(-centreU.x, -centreU.y, -centreU.z);
    pivot.add(root);
    const scaled = new THREE.Group();
    scaled.scale.setScalar(mpu);
    scaled.add(pivot);
    const holder = new THREE.Group();
    holder.add(scaled);

    return {
      holder, caudal, kept, hidden, mpu, scaleSource,
      length_m: sizeU.x * mpu, height_m: sizeU.y * mpu, width_m: sizeU.z * mpu,
      manifestId: manifest.id || spec.manifest,
      axes: manifest.units_and_axes || '',
    };
  })();
  meshCache.set(ck, p);
  p.catch(() => meshCache.delete(ck));
  return p;
}

// ------------------------------------------------------------------ scratch objects (no per-frame allocation)
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _e1 = new THREE.Euler();
const _camWant = new THREE.Vector3(), _camLook = new THREE.Vector3();
const _AXIS_Z = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------------ the view
export async function mount(opts = {}) {
  const host = typeof opts.into === 'string' ? document.querySelector(opts.into) : opts.into;
  if (!host) throw new Error('scene3d.mount: no host element');

  // wait for index.html's loaders
  if (!(window.DELPHI_SIM && window.DELPHI_SIM.ready)) {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('the simulator did not become ready within 30 s')), 30000);
      const done = () => { if (window.DELPHI_SIM && window.DELPHI_SIM.ready) { clearTimeout(t); res(); } };
      window.addEventListener('delphi-sim-ready', done);
      const iv = setInterval(() => { if (window.DELPHI_SIM && window.DELPHI_SIM.ready) { clearInterval(iv); clearTimeout(t); res(); } }, 60);
    });
  }
  const B = bridge();

  // ---- WebGL first: if it is not there, say so and leave the page alone
  let renderer = null, webglReason = '';
  const canvas = document.createElement('canvas');
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  } catch (e) { webglReason = String((e && e.message) || e); }
  if (!renderer) {
    host.innerHTML = `<h3 style="margin:0 0 4px">3D view — not available on this browser</h3>
      <p class="small" style="margin:0"><b>WebGL could not start</b>, so the 3D view is off and this page is the 2D charts below — the same run, the same numbers, no WebGL needed.
      Reason: <code>${esc(webglReason || 'no WebGL context')}</code></p>`;
    window.DELPHI_SIM3D = { status: () => ({ ready: false, webgl: false, reason: webglReason }) };
    return { ok: false, webgl: false };
  }

  // ---- optional modules
  const env = await import('./env3d.js').catch(e => { console.warn('env3d.js not loaded, using the marked fallback:', e); return null; });
  const creatures = await import('./creatures.js').catch(e => { console.warn('creatures.js not loaded:', e); return null; });
  const COND = B.baselineConditions || null; // conditions/baseline.json: locked, so env3d draws the stated sea

  // ---- DOM
  host.innerHTML = layoutHtml();
  const $ = sel => host.querySelector(sel);
  const stage = $('#s3Stage');
  stage.insertBefore(canvas, stage.firstChild);
  canvas.id = 's3Canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';

  // Resolution: start modest and step down once if the machine cannot hold a usable rate (a software
  // WebGL renderer cannot). Only ever downwards, at most twice, so it cannot oscillate.
  let pr = Math.min(devicePixelRatio || 1, 1.5), prSteps = 0;
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.02, env ? (env.RECOMMENDED_CAMERA_FAR || 60000) : 3000);
  camera.position.set(-2, 1.2, 3);

  const envFrom = env ? 'env3d.js' : 'the fallback in scene3d.js';

  // SKY. env3d.makeSky owns scene.fog, scene.background and the scene's lights, so when it is there this
  // file adds none of its own; the fallback below brings its own.
  const sky = (env && typeof env.makeSky === 'function')
    ? env.makeSky({ scene, THREE, conditions: COND })
    : fallbackSky({ scene, THREE });
  let underFog = null, airFog = null;
  if (!env) {
    scene.background = new THREE.Color(0x9ec4d8);
    const sunL = new THREE.DirectionalLight(0xfff3df, 2.1); sunL.position.set(-40, 28, 36); scene.add(sunL);
    scene.add(new THREE.HemisphereLight(0xbfe0f0, 0x0d3b49, 1.0));
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    underFog = new THREE.FogExp2(0x0a3b4a, 0.09);
    airFog = new THREE.FogExp2(0xa9cbdb, 0.0022);
    scene.fog = airFog;
  }

  const spray = (env && typeof env.makeSpray === 'function') ? env.makeSpray({ scene, THREE }) : fallbackSpray({ scene, THREE });
  const under = (env && typeof env.makeUnderwater === 'function') ? env.makeUnderwater({ scene, THREE }) : null;

  // OCEAN. env3d's ocean is a finite tile sized for a readable fish (its cell is ~0.4 m, which is what lets a
  // 0.2 m fish sit on a wave). A run can be hundreds of metres long, so the tile is sized to the run within
  // limits and then SLID along x to stay under the fish. The slide is only ever done while the fish is clear
  // of the water, so its ride on the surface is never interrupted by one, and every height query is corrected
  // by the tile's offset, so the fish sits on the surface it is drawn on.
  let ocean = null, oceanSize = 0, tileX = 0, oceanSegments = OCEAN_SEGMENTS, oceanCut = false;
  function makeOceanOf(size) {
    if (ocean && ocean.dispose) ocean.dispose();
    oceanSize = size; tileX = 0;
    ocean = (env && typeof env.makeOcean === 'function')
      ? env.makeOcean({ scene, THREE, size, segments: oceanSegments, conditions: COND })
      : fallbackOcean({ scene, THREE });
    if (!ocean || typeof ocean.heightAt !== 'function' || typeof ocean.update !== 'function') {
      throw new Error('the ocean module does not satisfy makeOcean -> {mesh, update(t), heightAt(x,z)}');
    }
    if (!env && ocean.mesh) ocean.mesh.scale.set(size, 1, size);
    return ocean;
  }
  const oceanNode = () => (ocean.group || ocean.mesh);
  /** Surface height in WORLD coordinates (the tile offset removed). */
  const surfaceAt = (x, z) => ocean.heightAt(x - tileX, (z || 0));
  // One fixed tile. 64 m at env3d's own ~0.42 m cell is what makes a 0.2 m fish sit on a wave rather than
  // on a facet; a tile stretched over a 300 m run would not, so the tile slides instead of growing.
  makeOceanOf(64);
  function sizeOcean() { /* the tile is fixed and slid; nothing to resize */ }

  const traj = new THREE.Group(); scene.add(traj);
  const pathGeo = new THREE.BufferGeometry();
  const pathMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 });
  const pathLine = new THREE.Line(pathGeo, pathMat);
  pathLine.frustumCulled = false;
  traj.add(pathLine);

  const bandGeo = new THREE.BufferGeometry();
  const bandMat = new THREE.MeshBasicMaterial({ color: 0x1bb07a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  const bandMesh = new THREE.Mesh(bandGeo, bandMat);
  bandMesh.visible = false; bandMesh.frustumCulled = false;
  traj.add(bandMesh);

  const markGeo = new THREE.BufferGeometry();
  const markMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
  const markLines = new THREE.LineSegments(markGeo, markMat);
  markLines.frustumCulled = false;
  traj.add(markLines);

  const labels = new THREE.Group(); scene.add(labels);

  // ---- state
  const st = {
    speciesKey: 'flying-fish', playing: true, rate: 1, cam: 'follow',
    t: 0, T: 1, wall: 0, frames: 0, fps: 0, fpsAt: 0,
    fish: null, fishSpec: null, tr: null, d: null, solved: null,
    ensemble: null, ensembleDraws: 24, seed: 1,
    notFlown: null, hudAt: 0, lastEmit: 0,
  };
  let orbit = null;
  try {
    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true; orbit.dampingFactor = 0.08;
    orbit.minDistance = 0.25; orbit.maxDistance = 400; orbit.maxPolarAngle = Math.PI * 0.95;
    orbit.enabled = false;
  } catch (e) { orbit = null; }

  // ---- re-solve and rebuild the drawn path
  function resolve() {
    const d = B.derive();
    const S = B.solve(null, null);
    const tr = trajectoryOf(S, d);
    st.d = d; st.tr = tr; st.solved = S; st.T = Math.max(0.001, tr.t1);
    st.t = clamp(st.t, 0, st.T);
    buildPath(tr, d);
    sizeOcean(tr);
    if (st.fish) st.fish.holder.visible = true;
    syncInputs();
    renderLegend();
    return tr;
  }

  // The drawn path IS the solver's samples: one vertex per sample, coloured by the solver's phase flag.
  function buildPath(tr, d) {
    const h = tr.samples, n = h.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = h[i].x; pos[i * 3 + 1] = h[i].z; pos[i * 3 + 2] = 0;
      const c = PHASE_COLOR[h[i].ph] || PHASE_COLOR.stopped;
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    pathGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pathGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    pathGeo.setDrawRange(0, n);
    pathGeo.computeBoundingSphere();

    // markers, all computed: the 1 m scale bar, 1 m distance ticks, the depth ladder, the launch and
    // touchdown stakes, and the end of the Lean-covered part of the range.
    const seg = [];
    const push = (x1, y1, z1, x2, y2, z2, c) => { seg.push(x1, y1, z1, c[0], c[1], c[2], x2, y2, z2, c[0], c[1], c[2]); };
    const GREY = [0.62, 0.70, 0.70], ORANGE = [0.92, 0.45, 0.16], RED = [0.70, 0.22, 0.18], TEAL = [0.16, 0.52, 0.62], GOLD = [0.85, 0.66, 0.10];
    const step = tr.xmax > 600 ? 100 : tr.xmax > 120 ? 10 : tr.xmax > 20 ? 1 : 0.5;
    for (let x = 0; x <= tr.xmax + step; x += step) {
      const tall = Math.abs(x / (step * 10) - Math.round(x / (step * 10))) < 1e-6;
      push(x, 0, -1.2, x, 0, -1.2 - (tall ? 1.6 : 0.6), GREY);
    }
    for (let y = -0.25; y >= tr.zmin - 0.25; y -= 0.25) {
      const tall = Math.abs(y * 4 % 4) < 1e-6;
      push(-0.9, y, 0, -0.9 - (tall ? 0.7 : 0.3), y, 0, TEAL);
    }
    push(-0.9, tr.zmin - 0.25, 0, -0.9, 0, 0, TEAL);
    push(-1.6, 0, 2.2, -0.6, 0, 2.2, GOLD); // a 1 m scale bar at the surface
    push(-1.6, 0, 2.2, -1.6, 0.18, 2.2, GOLD);
    push(-0.6, 0, 2.2, -0.6, 0.18, 2.2, GOLD);
    if (tr.launch) push(tr.launch.x, -0.4, 0, tr.launch.x, Math.max(0.6, tr.apex.z + 0.3), 0, ORANGE);
    if (tr.touchdown) push(tr.touchdown.x, -0.4, 0, tr.touchdown.x, Math.max(0.6, tr.apex.z + 0.3), 0, RED);
    if (tr.apex && tr.leanBound_m > 0) {
      const xl = tr.glideFrom + tr.leanBound_m;
      push(xl, 0, 0, xl, Math.max(0.5, tr.apex.z + 0.3), 0, GOLD);
      push(tr.glideFrom, tr.apex.z, 0, xl, tr.apex.z, 0, GOLD);
    }
    const sp = new Float32Array(seg.length / 6 * 3), sc = new Float32Array(seg.length / 6 * 3);
    for (let i = 0, j = 0; i < seg.length; i += 6, j += 3) {
      sp[j] = seg[i]; sp[j + 1] = seg[i + 1]; sp[j + 2] = seg[i + 2];
      sc[j] = seg[i + 3]; sc[j + 1] = seg[i + 4]; sc[j + 2] = seg[i + 5];
    }
    markGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    markGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    markGeo.computeBoundingSphere();

    // text labels
    while (labels.children.length) { const c = labels.children.pop(); if (c.material && c.material.map) c.material.map.dispose(); if (c.material) c.material.dispose(); }
    const addLabel = (text, x, y, z, h_m) => {
      const cv = document.createElement('canvas');
      const pad = 8, fontPx = 34;
      const ctx = cv.getContext('2d');
      ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
      const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
      cv.width = w; cv.height = fontPx + pad * 2;
      const c2 = cv.getContext('2d');
      c2.font = `600 ${fontPx}px system-ui, sans-serif`;
      c2.fillStyle = 'rgba(8,24,28,0.72)';
      c2.fillRect(0, 0, cv.width, cv.height);
      c2.fillStyle = '#eaf6f8'; c2.textBaseline = 'middle';
      c2.fillText(text, pad, cv.height / 2);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sp2.scale.set(h_m * cv.width / cv.height, h_m, 1);
      sp2.position.set(x, y, z);
      labels.add(sp2);
      return sp2;
    };
    const lh = Math.max(0.16, tr.xmax * 0.016);
    addLabel('1 m', -1.1, 0.26, 2.2, lh * 0.9);
    if (tr.launch) addLabel('launch ' + fx(tr.launch.v, 1) + ' m/s', tr.launch.x, Math.max(0.7, tr.apex.z + 0.42), 0, lh);
    if (tr.touchdown) addLabel('touchdown ' + fx(tr.touchdown.x, 1) + ' m', tr.touchdown.x, Math.max(0.7, tr.apex.z + 0.42), 0, lh);
    if (tr.apex && tr.leanBound_m > 0) addLabel('Lean bound ' + fx(tr.leanBound_m, 2) + ' m', tr.glideFrom + tr.leanBound_m, Math.max(0.56, tr.apex.z + 0.16), 0, lh * 0.95);
    addLabel('depth 0 → ' + fx(tr.zmin, 2) + ' m', -1.9, tr.zmin + 0.1, 0, lh * 0.9);
  }

  // ---- species
  async function setSpecies(key) {
    const spec = SPECIES.find(s => s.key === key);
    if (!spec) return false;
    st.speciesKey = key;
    const sel = $('#s3species'); if (sel && sel.value !== key) sel.value = key;

    if (spec.flown) {
      st.notFlown = null;
      // the 2D charts and the 3D view always show the same entry
      if (spec.preset) B.selectPreset(spec.preset);
      else { const i = B.baseIndexOf(spec.base); if (i >= 0) B.selectBase(i); }
      const psel = document.getElementById('presetSel');
      if (psel && spec.preset) psel.value = spec.preset;
      const fsel = document.getElementById('fishSel');
      if (fsel && !spec.preset) { const i = B.baseIndexOf(spec.base); if (i >= 0) fsel.value = String(i); }
    } else {
      st.notFlown = spec;
    }

    const f = B.fish;
    const SL = (f && f.standard_length_m && f.standard_length_m.value) || null;
    let info;
    try { info = await loadFish(spec, SL); }
    catch (e) {
      $('#s3msg').innerHTML = `<b>${esc(spec.glb)} did not load.</b> ${esc(String(e.message || e))}`;
      $('#s3msg').style.display = 'block';
      return false;
    }
    $('#s3msg').style.display = 'none';
    if (st.fish && st.fish.holder.parent) scene.remove(st.fish.holder);
    st.fish = info; st.fishSpec = spec;
    scene.add(info.holder);
    if (!spec.flown) {
      // parked at the surface: it is NOT flown, and the banner says why
      info.holder.position.set(0, 0, 0);
      info.holder.quaternion.identity();
    }
    resolve();
    renderBanner();
    return true;
  }

  // ---- banner / legend / HUD
  function renderBanner() {
    const el = $('#s3banner');
    const spec = st.fishSpec;
    if (!spec) { el.style.display = 'none'; return; }
    const bits = [];
    if (!spec.flown) bits.push(`<b style="color:var(--bad)">NOT FLOWN.</b> ${esc(spec.notFlownWhy)}`);
    else if (spec.hypothetical) bits.push(`<b style="color:var(--bad)">⚠ HYPOTHETICAL.</b> Nothing about this body or these numbers was observed.`);
    const m = st.tr && st.tr.metrics;
    // Where the launch speed in this run actually comes from. It is an OUTPUT of the integration, driven by
    // a thrust params.json itself labels "tuned", so saying so is the difference between a result and a
    // picture of one. Every word of the kind and the source below is read out of params.json, not written here.
    if (spec.flown && m && m.takeoff_speed_m_s != null) {
      const f = B.fish, tt = f.taxi_thrust_N || {}, vt = f.takeoff_speed_target_m_s || {};
      bits.push(`<b>Where this launch comes from.</b> ${fx(m.takeoff_speed_m_s)} m/s is not an input: it is what the run reached, driven by a taxi thrust params.json marks <span class="chip t">${esc(tt.kind || 'unknown')}</span> (factor ${fx(tt.factor, 2)} × the swim thrust) against a take-off target of ${fx(vt.value, 1)} m/s marked <span class="chip a">${esc(vt.kind || 'unknown')}</span>. <code>sim-engine/scenarios/glide.mjs</code> does it the other way round — it takes the organism's <b>own sourced</b> launch speed (adult flying fish: the 15 m/s taxi-end speed, measured second-hand; zebrafish: 1.15 × U<sub>crit</sub>, far below v_min, so it reports <b>zero</b> glide range for every zebrafish design). So a glide here is not evidence that the animal can reach this speed.${/zebrafish/i.test(spec.key) ? ' <b style="color:var(--bad)">For this zebrafish design the whole glide exists only because of that tuned thrust.</b>' : ''}`);
    }
    if (spec.flown && m && m.takeoff_speed_m_s != null && !m.lift_supported_at_launch) {
      bits.push(`<b style="color:var(--bad)">It cannot glide.</b> The solver's own take-off speed is ${fx(m.takeoff_speed_m_s)} m/s and v_min is ${fx(m.v_min_m_s)} m/s, so lift never carries the weight: what you see is a launch and a fall back into the water, which is the result. No glide is drawn for it.`);
    } else if (spec.flown && m && m.takeoff_speed_m_s == null) {
      bits.push(`<b style="color:var(--bad)">It never leaves the water</b> in this run: the solver reaches no glide phase, so there is no launch and no glide to draw.`);
    }
    const bad = !spec.flown || spec.hypothetical || (m && m.takeoff_speed_m_s != null && !m.lift_supported_at_launch) || (m && m.takeoff_speed_m_s == null);
    el.innerHTML = bits.map((b, i) => `<p style="margin:${i ? '6px' : '0'} 0 0">${b}</p>`).join('');
    el.style.borderColor = bad ? 'var(--bad)' : 'var(--warn)';
    el.style.display = bits.length ? 'block' : 'none';
  }

  function renderLegend() {
    const m = st.tr ? st.tr.metrics : {};
    const f = st.fish;
    const spec = st.fishSpec || {};
    const oi = (ocean && ocean.info) || null;
    const seaLine = oi
      ? `env3d.js ocean: the wave SPEEDS are the real deep-water ones for their wavelengths, the wave HEIGHT drawn is ${oi.drawn_H_s_m != null ? fx(oi.drawn_H_s_m, 3) + ' m' : 'a readability-scaled'} against a Pierson–Moskowitz H<sub>s</sub> of ${oi.true_H_s_m != null ? fx(oi.true_H_s_m, 3) + ' m' : '?'} at ${oi.wind_m_s != null ? fx(oi.wind_m_s, 1) : '?'} m/s wind — so the shape and the height are DECORATIVE, and env3d.js says so itself. Tile ${fx(oceanSize, 0)} m, cell ${ocean.cellSize ? fx(ocean.cellSize, 2) : '?'} m.`
      : esc((ocean && ocean.source) || 'the fallback ocean in scene3d.js');
    const ens = st.ensemble;
    $('#s3legend').innerHTML = `
<div class="small" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
  <div>
    <b>Computed</b> — every one of these comes from the solver on this page, not from this 3D file:
    <ul style="margin:4px 0 0;padding-left:18px">
      <li><span style="color:#1bb07a">▬</span> the <b>trajectory</b>: the RK4 run's own samples, one line vertex each, 0.02 s apart. The fish is placed by interpolating those samples in time, never by a keyframe.</li>
      <li><b>orientation</b>: pitch = atan2(v<sub>z</sub>, v<sub>x</sub>) of the solver's velocity, plus the solver's own angle-of-attack parameter for the phase (glide ${fx((B.fish.glide_alpha_deg || {}).value, 1)}° <span class="chip a">assumed</span>, leap ${fx((B.fish.pitch_at_leap_deg || {}).value, 1)}° <span class="chip m">measured</span>).</li>
      <li><b>bank = 0° everywhere.</b> The solver is two-dimensional (x, z): it computes no lateral force, so there is no computed reason to roll, and the fish is kept level rather than banked for looks.</li>
      <li><b>speed, height, depth, v_min, the ground-effect drag factor</b> and the phase boundaries (<span style="color:#2a85a0">▬</span> swim, <span style="color:#eb7329">▬</span> taxi, <span style="color:#1bb07a">▬</span> glide, <span style="color:#b3392f">▬</span> down).</li>
      <li><b>size</b>: ${esc(spec.glb || '')} at ${f ? f.mpu.toPrecision(4) : '?'} m per model unit — ${f ? fx(f.length_m, 3) : '?'} m from snout to tail against the waves. ${f ? esc(f.scaleSource) : ''}</li>
      <li><span style="color:#d9a81a">▬</span> the <b>Lean bound</b> stake: ${fx(m.glide_range_lean_bound_m, 2)} m, the apex height × (L/D)max — the part of the range <code>sim-engine/scenarios/glide.mjs</code> reports as <code>glide_range_lean_bound_m</code>. Past that stake the fish is in the <b>kinetic phase</b> (${fx(m.kinetic_phase_m, 2)} m here), which the Lean theorem does <b>not</b> cover.</li>
      <li><b>the 1 m bar, the 1 m distance ticks and the 0.25 m depth ladder</b> are true scale marks.</li>
    </ul>
  </div>
  <div>
    <b>Decorative</b> — chosen so the sea reads as a sea. None of it is evidence, none of it was measured, and none of it changes a number:
    <ul style="margin:4px 0 0;padding-left:18px">
      <li><b>the wave shape and its height</b>, the water colour and the foam. ${seaLine}</li>
      <li><b>the sky gradient, the horizon and the sun</b>, and all the lighting (${env ? 'env3d.makeSky: a hand-painted gradient, explicitly not physically based' : 'the fallback sky in scene3d.js'}).</li>
      <li><b>the spray</b> at the surface, and the underwater tint, caustics and light shafts.</li>
      <li><b>the caudal-fin beat</b> during the swim and the taxi: a fixed 8 Hz sine, not a measured tail beat and not coupled to the thrust the solver uses.</li>
      <li><b>the camera's smoothing</b>, all camera placement, and the sliding of the sea tile that keeps it under the fish.</li>
      <li>${crew ? 'the <b>school, the predator and the distant gliders</b> (creatures.js, which marks them decorative too). They move nothing and are not counted anywhere.' : 'no school, predator or distant gliders here.'}</li>
    </ul>
    <b style="display:block;margin-top:8px">Single run, or an ensemble</b>
    ${ens
        ? `<b>Ensemble — physics, not decoration.</b> ${ens.draws} seeded draws (seed <code>${esc(ens.seed)}</code>) from creatures.js's stated distributions (${esc(ens.distributions.join('; '))}), and <b>every draw is a complete solve by this page's own solver</b> (creatures.js's <code>run</code> hook is pointed at <code>solveWith</code>, so no second model is involved). The shaded corridor is the 5–95 % band of height against distance; the solid line is still the deterministic run. ${ens.canGlideFraction != null ? `${(ens.canGlideFraction * 100).toFixed(0)} % of the draws are lift-supported at launch.` : ''} ${ens.gate ? esc(ens.gate.note) : ''} Drawn quantities this solver has <b>no input for</b>, so they were not applied: ${esc(ens.unmapped.join(', '))}.`
        : `<b>Single deterministic run.</b> One solve, one line, no band: nothing on screen is sampled from a distribution, so none of it is an uncertainty estimate. ${creatures ? 'Press <b>ensemble</b> to draw from creatures.js’s stated distributions and solve each draw.' : '<code>creatures.js</code> is not available here.'}`}
  </div>
</div>
<p class="small mute" style="margin:8px 0 0">${esc(spec.meshNote || '')} ${esc(st.panelNote || '')}</p>`;
  }

  const hud = () => $('#s3hud');
  function renderHud(s, phase) {
    const m = st.tr.metrics, d = st.d;
    const wind = d.wind || 0;
    const air = wind ? Math.hypot(s.vx + wind, s.vz) : s.v;
    const geR = d.b > 0 ? Math.max(0, s.z) / d.b : 99;
    const geF = B.groundEffectOn() ? (geR >= 0.97 ? 1 : geR <= 0.33 ? 0.86 : 1 - (0.97 - geR) / (0.97 - 0.33) * 0.14) : 1;
    const ratio = (s.vz < -0.05) ? (s.vx / -s.vz) : null;
    const past = Math.max(0, s.x - st.tr.glideFrom);
    const over = phase === 'glide' && past > st.tr.leanBound_m;
    hud().innerHTML =
      `<div><b>${esc(PHASE_LABEL[phase] || phase)}</b> &nbsp; t ${fx(s.t)} s &nbsp; x ${fx(s.x)} m &nbsp; ${s.z >= 0 ? 'height' : 'depth'} ${fx(Math.abs(s.z), 3)} m</div>
<div>speed ${fx(s.v)} m/s${wind ? ` (airspeed ${fx(air)} with ${fx(wind, 1)} m/s headwind)` : ''} &nbsp; v<sub>min</sub> ${fx(m.v_min_m_s)} &nbsp; margin ${s.v - m.v_min_m_s >= 0 ? '+' : ''}${fx(s.v - m.v_min_m_s)} m/s</div>
<div>glide ratio now ${ratio == null ? '—' : fx(ratio, 1)} &nbsp; (L/D)max ${fx(m.LD_max)} &nbsp; ground-effect drag ×${fx(geF, 3)}</div>
<div>Lean-covered ${fx(m.glide_range_lean_bound_m, 2)} m${over ? ` — <b style="color:#ffbe6a">EXCEEDED</b> by ${fx(past - st.tr.leanBound_m, 2)} m (kinetic phase, outside the theorem)` : (phase === 'glide' ? ` — inside it (${fx(past, 2)} m flown)` : '')}</div>`;
  }

  // ---- sampling the solver's run at an arbitrary time (linear interpolation, nothing else)
  const _s = { t: 0, x: 0, z: 0, vx: 0, vz: 0, v: 0, ph: 'swim' };
  let _idx = 0;
  function sampleAt(t) {
    const h = st.tr.samples, n = h.length;
    if (!n) return _s;
    if (t <= h[0].t) { Object.assign(_s, h[0]); return _s; }
    if (t >= h[n - 1].t) { Object.assign(_s, h[n - 1]); return _s;
    }
    if (_idx >= n - 1 || h[_idx].t > t) _idx = 0;
    while (_idx < n - 2 && h[_idx + 1].t < t) _idx++;
    const a = h[_idx], b = h[_idx + 1];
    const u = (t - a.t) / Math.max(1e-9, b.t - a.t);
    _s.t = t;
    _s.x = a.x + (b.x - a.x) * u;
    _s.z = a.z + (b.z - a.z) * u;
    _s.vx = a.vx + (b.vx - a.vx) * u;
    _s.vz = a.vz + (b.vz - a.vz) * u;
    _s.v = a.v + (b.v - a.v) * u;
    _s.ph = a.ph;
    return _s;
  }

  // ---- render loop
  let raf = 0, prevWall = performance.now(), underwater = false, sprayAcc = 0, crew = null;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dtWall = clamp((now - prevWall) / 1000, 0, 0.1); prevWall = now;
    st.frames++;
    if (now - st.fpsAt > 500) {
      st.fps = st.frames / ((now - st.fpsAt) / 1000); st.frames = 0; st.fpsAt = now;
      // Step 1 and 2: render at a lower resolution. Step 3: coarsen the SEA MESH (the wave the fish rides
      // is read from env3d's analytic surface, not from this mesh, so coarsening it changes no number).
      if (st.fps > 0 && now > 2500) {
        if (prSteps < 2 && st.fps < 42) { prSteps++; pr = prSteps === 1 ? Math.min(pr, 1) : 0.8; renderer.setPixelRatio(pr); resize(); }
        else if (prSteps >= 2 && !oceanCut && st.fps < 34) { oceanCut = true; oceanSegments = 48; makeOceanOf(oceanSize || 64); renderLegend(); }
      }
    }

    if (st.playing) {
      st.t += dtWall * st.rate;
      if (st.t > st.T) st.t = 0;
      const sc = $('#s3scrub'); if (sc) sc.value = String(st.t / st.T);
    }
    st.wall += dtWall;

    const s = sampleAt(st.t);
    const f = st.fish;
    const flown = st.fishSpec && st.fishSpec.flown;
    const lobe = (st.d && st.d.lobe) || 0.05;
    const clear = !flown || Math.abs(s.z) > lobe * 8; // the body is well away from the water

    // slide the ocean tile under the fish, but only while the fish is clear of the surface, so a slide
    // can never show up as a step in the height the fish is riding. DECORATIVE (the tile's placement).
    if (clear) {
      const stride = oceanSize * 0.25;
      const want = Math.round((flown ? s.x : 0) / stride) * stride;
      if (want !== tileX) { tileX = want; oceanNode().position.x = tileX; }
    }
    ocean.update(st.wall);
    if (sky.update) sky.update(st.wall);

    if (f) {
      if (flown) {
        // POSITION: the solver's x and z, with the moving surface added only while the body is at the
        // surface, so the fish rides the wave instead of cutting through it. The ride is the DECORATIVE
        // wave's height; the fish's own height above the mean surface stays the solver's z.
        const nearSurf = clamp(1 - Math.abs(s.z) / (lobe * 6), 0, 1);
        const wave = nearSurf > 0 ? surfaceAt(s.x, 0) * nearSurf : 0;
        f.holder.position.set(s.x, s.z + wave, 0);

        // ORIENTATION: the flight-path angle of the solver's velocity, plus the solver's own angle of
        // attack for the phase. Roll stays 0 (see the legend). Model forward is +X, up is +Y.
        const wind = st.d.wind || 0;
        const vx = s.vx + wind, vz = s.vz;
        const path = (Math.abs(vx) + Math.abs(vz) > 1e-6) ? Math.atan2(vz, vx) : 0;
        const aoa = (s.ph === 'glide' ? (st.d.alpha || 0) : s.ph === 'taxi' ? (st.d.pitch ? st.d.pitch * 180 / Math.PI : 0) * 0.5 : 0) * Math.PI / 180;
        _q1.setFromAxisAngle(_AXIS_Z, path + aoa);
        f.holder.quaternion.copy(_q1);

        // DECORATIVE: caudal-fin beat while the tail is in the water, 8 Hz, fixed amplitude
        if (f.caudal) f.caudal.rotation.y = (s.ph === 'swim' || s.ph === 'taxi') ? Math.sin(st.wall * 2 * Math.PI * 8) * 0.38 : 0;

        // DECORATIVE: spray where the body meets the surface, while it is fast
        if (Math.abs(s.z) < lobe * 3.5 && s.v > 3) {
          sprayAcc += dtWall;
          if (sprayAcc > 0.045) {
            sprayAcc = 0;
            _v2.set(s.x, surfaceAt(s.x, 0), 0);
            _v3.set(s.vx, Math.max(0, s.vz) + s.v * 0.08, 0);
            if (spray.burst) spray.burst(_v2, _v3, clamp(s.v / 16, 0.15, 1));
            else if (spray.emit) spray.emit(s.x, _v2.y, 0, s.v, 0.045);
          }
        }
      } else {
        // not flown: bob at the surface, no trajectory
        f.holder.position.set(0, surfaceAt(0, 0), 0);
        f.holder.quaternion.identity();
        if (f.caudal) f.caudal.rotation.y = Math.sin(st.wall * 2) * 0.1;
      }
    }
    if (spray.update) spray.update(spray.burst ? dtWall : st.wall);
    if (crew) { try { crew.update(dtWall, st.wall); } catch (e) { /* decorative: never fatal */ } }

    placeCamera(s, dtWall);

    const camDepth = surfaceAt(camera.position.x, camera.position.z) - camera.position.y;
    const camUnder = camDepth > 0;
    if (under) under.setDepth(camUnder ? camDepth : 0);
    if (under && camUnder) under.update(st.wall);
    if (camUnder !== underwater) {
      underwater = camUnder;
      if (!env) {
        scene.fog = camUnder ? underFog : airFog;
        if (scene.background && scene.background.set) scene.background.set(camUnder ? 0x0a3b4a : 0x9ec4d8);
        if (sky.mesh) sky.mesh.visible = !camUnder;
      }
    }

    if (now - st.hudAt > 90) { st.hudAt = now; renderHud(s, s.ph); const fpsEl = $('#s3fps'); if (fpsEl) fpsEl.textContent = st.fps.toFixed(0) + ' fps'; }
    if (orbit && orbit.enabled) orbit.update();
    renderer.render(scene, camera);
  }

  function placeCamera(s, dt) {
    const f = st.fish;
    const L = f ? Math.max(0.05, f.length_m) : 0.25;
    const D = Math.max(0.8, 7 * L);
    const px = f ? f.holder.position.x : 0, py = f ? f.holder.position.y : 0;
    const k = 1 - Math.exp(-dt * 6); // DECORATIVE smoothing
    if (st.cam === 'orbit') {
      if (orbit) { orbit.target.set(px, py, 0); }
      return;
    }
    if (st.cam === 'cockpit' && f) {
      _v1.set(L * 0.42, L * 0.22, 0).applyQuaternion(f.holder.quaternion).add(f.holder.position);
      camera.position.copy(_v1);
      _v2.set(1, 0.05, 0).applyQuaternion(f.holder.quaternion).multiplyScalar(6).add(_v1);
      camera.lookAt(_v2);
      return;
    }
    if (st.cam === 'side') {
      _camWant.set(px, Math.max(0.25 + L, py + L * 0.4), D * 3.2);
      _camLook.set(px, Math.max(0.1, py), 0);
    } else { // follow
      _v1.set(-1.55 * D, 0.52 * D, 1.25 * D);
      _camWant.set(px, py, 0).add(_v1);
      if (_camWant.y < 0.12 + L) _camWant.y = 0.12 + L;
      _camLook.set(px + D * 0.5, py, 0);
    }
    camera.position.lerp(_camWant, k);
    _v3.copy(_camLook);
    camera.lookAt(_v3);
  }

  // ---- sizing
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(160, Math.floor(r.width)), h = Math.max(140, Math.floor(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(stage);

  // ---- controls
  function syncInputs() {
    const f = B.fish; if (!f) return;
    const set = (id, v) => { const el = $(id); if (el && document.activeElement !== el) el.value = String(v); };
    const out = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('#s3vto', (f.takeoff_speed_target_m_s || {}).value); out('#s3vtoOut', fx((f.takeoff_speed_target_m_s || {}).value, 1) + ' m/s');
    set('#s3depth', (f.start_depth_m || {}).value); out('#s3depthOut', fx((f.start_depth_m || {}).value, 2) + ' m');
    set('#s3wind', (f.headwind_m_s || { value: 0 }).value); out('#s3windOut', fx((f.headwind_m_s || { value: 0 }).value, 1) + ' m/s');
    const ge = $('#s3ge'); if (ge) ge.checked = B.groundEffectOn();
    const al = $('#s3alt'); if (al) al.checked = !!((f.altitude_model || {}).value);
    const m = st.tr ? st.tr.metrics : {};
    out('#s3summary', `launch ${fx(m.takeoff_speed_m_s, 1)} m/s · v_min ${fx(m.v_min_m_s, 1)} m/s · apex ${fx(m.apex_height_m, 2)} m · range ${fx(m.range_m, 1)} m · ${m.n_glides || 0} glide${m.n_glides === 1 ? '' : 's'} · run ${fx(m.duration_s, 1)} s`);
  }

  function wire() {
    const sel = $('#s3species');
    sel.innerHTML = SPECIES.map(s => `<option value="${s.key}">${esc(s.label)}</option>`).join('');
    sel.value = st.speciesKey;
    sel.onchange = () => setSpecies(sel.value);

    $('#s3play').onclick = () => { st.playing = !st.playing; $('#s3play').textContent = st.playing ? '❚❚ Pause' : '▶ Play'; $('#s3play').classList.toggle('on', st.playing); };
    $('#s3scrub').oninput = e => { st.playing = false; $('#s3play').textContent = '▶ Play'; $('#s3play').classList.remove('on'); st.t = clamp(+e.target.value, 0, 1) * st.T; };
    $('#s3rate').onchange = e => { st.rate = +e.target.value; };
    $('#s3cam').onchange = e => { st.cam = e.target.value; if (orbit) orbit.enabled = (st.cam === 'orbit'); };
    $('#s3restart').onclick = () => { st.t = 0; st.playing = true; $('#s3play').textContent = '❚❚ Pause'; $('#s3play').classList.add('on'); };

    const num = (id, key, meta) => {
      const el = $(id);
      el.onchange = () => { B.setParam(key, +el.value, meta); };
      el.oninput = () => { const o = $(id + 'Out'); if (o) o.textContent = fx(+el.value, 2) + ' m/s'; };
    };
    $('#s3vto').onchange = e => B.setParam('takeoff_speed_target_m_s', +e.target.value);
    $('#s3vto').oninput = e => { $('#s3vtoOut').textContent = fx(+e.target.value, 1) + ' m/s'; };
    $('#s3depth').onchange = e => B.setParam('start_depth_m', +e.target.value);
    $('#s3depth').oninput = e => { $('#s3depthOut').textContent = fx(+e.target.value, 2) + ' m'; };
    $('#s3wind').onchange = e => B.setParam('headwind_m_s', +e.target.value, { kind: 'assumed', source: HEADWIND_SOURCE });
    $('#s3wind').oninput = e => { $('#s3windOut').textContent = fx(+e.target.value, 1) + ' m/s'; };
    $('#s3ge').onchange = e => B.setGroundEffect(e.target.checked);
    $('#s3alt').onchange = e => B.setParam('altitude_model', e.target.checked, { kind: 'assumed', source: 'switches the ISA density/PO2 model on; off in the committed non-altitude entries' });
    const ens = $('#s3ens');
    if (ens) ens.onclick = () => runEnsemble();
  }

  // ---- ensemble: PHYSICS. creatures.js draws the parameter sets from its stated distributions; every draw
  // is then solved by THIS PAGE'S solver (makeEnsemble's `run` hook), never by any model of its own, so the
  // band and the single line come from the same equations. The mapping below is explicit about which drawn
  // quantity this solver has an input for and which it has none for.
  const ENSEMBLE_MAP = {
    launch_airspeed_m_s: 'takeoff_speed_target_m_s',
    launch_path_angle_deg: 'approach_angle_deg',
    wind_along_path_m_s: 'headwind_m_s',
    mass_kg: 'mass_kg',
    ref_area_m2: 'ref_area_m2',
    glide_alpha_deg: 'glide_alpha_deg',
  };
  const ENSEMBLE_UNMAPPED = ['surface_elevation_m', 'surface_slope_deg', 'launch_height_m'];
  function hostRun(drawnParams) {
    const pv = k => { const e = drawnParams[k]; return e == null ? null : (typeof e === 'object' && 'value' in e ? e.value : e); };
    const params = {};
    for (const [from, to] of Object.entries(ENSEMBLE_MAP)) { const v = pv(from); if (v != null && isFinite(v)) params[to] = v; }
    const r = solveTrajectory({ params });
    if (!r.ok) return { can_glide: false, range_m: null, time_s: null, max_height_m: null, v_min_m_s: null, pts: null, reason: r.reason };
    const m = r.metrics;
    return {
      can_glide: !!m.lift_supported_at_launch, range_m: m.range_m, time_s: m.duration_s,
      max_height_m: m.apex_height_m, v_min_m_s: m.v_min_m_s,
      wing_loading_N_m2: r.derived.mass_kg * 9.81 / r.derived.ref_area_m2,
      pts: r.samples, solver: "index.html's own RK4 run via solveWith (the host solver)",
    };
  }
  async function runEnsemble() {
    if (!creatures || typeof creatures.makeEnsemble !== 'function') {
      $('#s3msg').innerHTML = '<b>No ensemble.</b> <code>creatures.js</code> (<code>makeEnsemble</code> / <code>perturbRun</code>) is not available, so there is nothing to draw a band from. The line you see is one deterministic run and is labelled as one.';
      $('#s3msg').style.display = 'block';
      return null;
    }
    $('#s3msg').innerHTML = 'running the ensemble…';
    $('#s3msg').style.display = 'block';
    await new Promise(r => setTimeout(r, 0));
    let E;
    try {
      E = creatures.makeEnsemble({
        draws: st.ensembleDraws, seed: st.seed, baseParams: B.cloneFish(),
        conditions: COND || {}, run: hostRun, keepTrajectories: true,
      });
    } catch (e) {
      $('#s3msg').innerHTML = '<b>The ensemble failed:</b> ' + esc(String((e && e.message) || e));
      return null;
    }
    const runs = E.runs.map(r => r.result && r.result.pts).filter(Boolean);
    if (!runs.length) { $('#s3msg').innerHTML = '<b>The ensemble produced no solved run.</b>'; return null; }
    st.ensemble = {
      draws: runs.length, seed: E.seed, stats: E.stats, gate: E.species_gate,
      distributions: (E.distributions || []).map(d => d.label || d.key),
      unmapped: ENSEMBLE_UNMAPPED,
      canGlideFraction: E.stats && E.stats.can_glide_fraction,
    };
    drawBand(runs);
    $('#s3msg').style.display = 'none';
    renderLegend();
    return st.ensemble;
  }

  // The corridor is drawn from the draws' own solved samples: a 5-95 % quantile band of z at each x bin.
  function drawBand(runs) {
    const nb = 160;
    let xmax = 0;
    for (const r of runs) for (const s of r) if (s.x > xmax) xmax = s.x;
    const lo = new Float32Array(nb), hi = new Float32Array(nb), seen = new Uint16Array(nb);
    const bins = Array.from({ length: nb }, () => []);
    for (const r of runs) for (const s of r) { const b = Math.min(nb - 1, Math.floor(s.x / xmax * nb)); bins[b].push(s.z); }
    for (let b = 0; b < nb; b++) {
      const a = bins[b]; if (!a.length) continue;
      a.sort((p, q) => p - q);
      lo[b] = a[Math.floor(a.length * 0.05)]; hi[b] = a[Math.min(a.length - 1, Math.floor(a.length * 0.95))]; seen[b] = 1;
    }
    const pos = [], idx = [];
    let n = 0;
    for (let b = 0; b < nb; b++) {
      if (!seen[b]) continue;
      const x = (b + 0.5) / nb * xmax;
      pos.push(x, lo[b], 0, x, hi[b], 0);
      if (n > 0) { const a0 = (n - 1) * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
      n++;
    }
    bandGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bandGeo.setIndex(idx);
    bandGeo.computeBoundingSphere();
    bandMesh.visible = true;
  }

  // ---- optional panels
  const api = {
    solveTrajectory, SPECIES,
    get species() { return st.speciesKey; },
    setSpecies, resolve,
    get bridge() { return B; },
    THREE, scene,
  };
  if (creatures && typeof creatures.mountCreatures === 'function') {
    try { crew = creatures.mountCreatures({ scene, THREE, seed: st.seed, conditions: COND || {} }); }
    catch (e) { crew = null; console.warn('creatures.mountCreatures failed (decorative, ignored):', e); }
  }

  // The parameter panel gets the first slot. Its value sets are applied through the same bridge the 3D
  // controls use, so the 2D charts, the 3D view and the panel never disagree about which run is on screen.
  let paramsPanel = null;
  import('./params-panel.js').then(m => {
    const host2 = $('#s3paramsSlot');
    if (!host2 || !m || typeof m.mountParams !== 'function' || typeof m.buildSchema !== 'function') return;
    const schema = m.buildSchema(B.P, B.baselineConditions, B.groundEffectData, B.baseIndex || 0);
    host2.style.display = 'block';
    host2.innerHTML = '<h4 style="margin:0 0 6px">Parameters, exhaustively (params-panel.js)</h4>';
    const box = document.createElement('div'); host2.appendChild(box);
    paramsPanel = m.mountParams(box, {
      schema,
      onChange(values, key) {
        const p = schema.find(q => q.key === key);
        if (!p || !p.settable) return;
        if (p.path && p.path.t === 'geOff') { B.setGroundEffect(!!values[key]); return; }
        if (p.path && p.path.t === 'fish') { B.setParam(p.path.key, values[key], { kind: p.raw_kind || p.kind, source: p.source }); return; }
        // constants, baseline conditions and URL flags are not routed through the live page: they belong to
        // a sweep, so say so rather than silently doing nothing.
        $('#s3msg').innerHTML = 'The panel changed <code>' + esc(p.key) + '</code>. This 3D view re-drives only the fish’s own parameters live; constants, baseline conditions and URL flags are sweep inputs — run them through <code>sweep.js</code> against <code>solveWith</code>.';
        $('#s3msg').style.display = 'block';
      },
    });
    st.panelNote = 'params-panel.js mounted: ' + schema.length + ' parameters, ' + schema.filter(p => p.settable).length + ' tunable.';
    renderLegend();
  }).catch(() => { /* not available: the slot stays as its placeholder line */ });

  // sweep.js is a library, not a panel: it reads the solver straight out of index.html (extractSolver, which
  // requires `function solveWith(` to stay a top-level declaration there) and runs it in a Worker. The slot
  // is kept for whoever assembles its UI; the entry points are named below it.
  import('./sweep.js').then(m => {
    const host2 = $('#s3sweepSlot');
    if (!host2 || !m || typeof m.runSweep !== 'function') return;
    host2.style.display = 'block';
    host2.innerHTML = `<h4 style="margin:0 0 6px">Sweep output (sweep.js)</h4>
      <p class="small mute" style="margin:0">Reserved for the sweep UI. <code>sweep.js</code> is loaded and reads this page's solver directly: <code>extractSolver('index.html')</code> → <code>makeWorker</code> → <code>runSweep</code>, calling <code>solveWith({fish, groundEffect}, tmax)</code> in a Worker, with <code>${esc(m.METRICS ? m.METRICS.length : '?')}</code> metrics and <code>leanCheck</code> for the law-violating regions. From this view, a single solve is <code>window.DELPHI_SIM3D.solveTrajectory({params, tmax})</code>.</p>`;
  }).catch(() => { });

  // ---- go
  wire();
  B.onReset(() => { try { resolve(); renderBanner(); } catch (e) { console.error(e); } });
  await setSpecies('flying-fish');
  resize();
  raf = requestAnimationFrame(frame);

  // ---- the API the headless check and any embedder uses
  window.DELPHI_SIM3D = {
    version: 1,
    solveTrajectory,
    status() {
      const m = (st.tr && st.tr.metrics) || {};
      return {
        ready: !!(st.fish && st.tr), webgl: true,
        species: st.speciesKey, flown: !!(st.fishSpec && st.fishSpec.flown),
        fishMeshes: st.fish ? st.fish.kept : 0, hiddenMeshes: st.fish ? st.fish.hidden : 0,
        metresPerUnit: st.fish ? st.fish.mpu : null, fishLength_m: st.fish ? st.fish.length_m : null,
        samples: st.tr ? st.tr.samples.length : 0, duration_s: st.T,
        oceanSource: (ocean.info && (ocean.info.module || ocean.info.true_source)) || ocean.source || 'env3d.makeOcean',
        oceanTile_m: oceanSize, oceanCell_m: ocean.cellSize || null,
        env: envFrom, creatures: !!crew, sky: env ? 'env3d.makeSky' : 'fallback',
        ensemble: st.ensemble,
        canGlide: m.takeoff_speed_m_s == null ? false : !!m.lift_supported_at_launch,
        launchSpeed: m.takeoff_speed_m_s == null ? null : m.takeoff_speed_m_s,
        vMin: m.v_min_m_s, apex_m: m.apex_height_m, range_m: m.range_m,
        leanBound_m: m.glide_range_lean_bound_m, kinetic_m: m.kinetic_phase_m, leanExceeded: m.lean_bound_exceeded,
        fps: st.fps, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      };
    },
    fishState() {
      const f = st.fish, s = sampleAt(st.t);
      return { t: st.t, x: f ? f.holder.position.x : 0, y: f ? f.holder.position.y : 0, z: f ? f.holder.position.z : 0, speed: s.v, solverSpeed: s.v, phase: s.ph, pitch_deg: f ? f.holder.rotation.z * 180 / Math.PI : 0 };
    },
    setPlaying(v) { st.playing = !!v; const b = $('#s3play'); if (b) { b.textContent = st.playing ? '❚❚ Pause' : '▶ Play'; b.classList.toggle('on', st.playing); } },
    setRate(v) { st.rate = +v || 1; const el = $('#s3rate'); if (el) el.value = String(st.rate); },
    seek(t) { st.t = clamp(+t, 0, st.T); },
    setCamera(c) { st.cam = c; if (orbit) orbit.enabled = (c === 'orbit'); const el = $('#s3cam'); if (el) el.value = c; },
    setSpecies, runEnsemble, resolve,
    scene, renderer, camera, THREE,
    /** Triangles per visible object, for the performance check. */
    census() {
      const rows = [];
      scene.traverse(o => {
        if (!o.isMesh && !o.isPoints && !o.isLine) return;
        let vis = o.visible, p = o.parent;
        while (vis && p) { vis = p.visible; p = p.parent; }
        const g = o.geometry;
        const n = g && g.index ? g.index.count / 3 : (g && g.attributes.position ? g.attributes.position.count / 3 : 0);
        rows.push({ name: o.name || o.type, kind: o.isMesh ? 'mesh' : o.isPoints ? 'points' : 'line', tris: Math.round(n), visible: vis });
      });
      rows.sort((a, b) => b.tris - a.tris);
      return rows;
    },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
  };
  return { ok: true, webgl: true };
}

// ------------------------------------------------------------------ markup
function layoutHtml() {
  return `
<style>
#sim3d h3{margin:0 0 4px}
#s3stageWrap{position:relative;margin:8px 0 0}
#s3Stage{position:relative;width:100%;aspect-ratio:16/9;min-height:280px;max-height:62vh;border-radius:10px;overflow:hidden;background:#9ec4d8;border:1px solid var(--line)}
#s3hud{position:absolute;left:8px;top:8px;max-width:min(430px,62%);padding:7px 9px;border-radius:8px;background:rgba(6,22,27,.62);color:#eaf6f8;font:500 11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none;backdrop-filter:blur(3px)}
#s3fps{position:absolute;right:8px;top:8px;padding:3px 7px;border-radius:7px;background:rgba(6,22,27,.55);color:#cfe8ee;font:500 11px ui-monospace,monospace;pointer-events:none}
#s3msg{position:absolute;left:8px;right:8px;bottom:8px;padding:8px 10px;border-radius:8px;background:rgba(120,30,20,.88);color:#fff;font-size:12.5px;display:none}
#s3ctl{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:10px 0 0}
#s3ctl label{display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--mute);flex-wrap:wrap}
#s3ctl input[type=range]{width:120px;max-width:38vw}
#s3ctl select,#s3ctl input[type=number]{font:inherit;font-size:12.5px;padding:3px 6px;border-radius:7px;border:1px solid var(--line);background:var(--panel);color:var(--ink);max-width:min(260px,52vw)}
#s3ctl .v{font:500 12px ui-monospace,monospace;color:var(--ink);min-width:62px}
#s3scrubRow{display:flex;gap:10px;align-items:center;margin:8px 0 0}
#s3scrub{flex:1 1 120px;min-width:80px}
#s3summary{font:500 12px ui-monospace,monospace;color:var(--mute)}
#s3banner{margin:8px 0 0;padding:8px 10px;border:1px solid var(--bad);border-left-width:4px;border-radius:8px;font-size:13px;display:none}
#s3legend{margin:10px 0 0;border-top:1px solid var(--line);padding-top:10px}
.s3slot{display:none;margin:10px 0 0;border-top:1px solid var(--line);padding-top:10px}
@media (max-width:560px){
  #s3Stage{aspect-ratio:4/3;min-height:230px}
  #s3hud{font-size:10.5px;max-width:74%;left:5px;top:5px;padding:5px 7px}
  #s3ctl{gap:6px 10px}
  #s3ctl input[type=range]{width:96px}
}
</style>
<h3>3D view — the computed trajectory, flown by the anatomy meshes</h3>
<p class="small mute" style="margin:0 0 2px">The meshes fly the run the solver on this page computed, sample by sample: no keyframes anywhere. The charts below are the same run in 2D. The legend under the controls separates what is computed from what is only there to look like the sea.</p>
<div id="s3stageWrap">
  <div id="s3Stage">
    <div id="s3hud"></div>
    <div id="s3fps"></div>
    <div id="s3msg"></div>
  </div>
</div>
<div id="s3scrubRow">
  <button id="s3play" class="on">❚❚ Pause</button>
  <button id="s3restart" class="small" title="back to t = 0">↺</button>
  <input id="s3scrub" type="range" min="0" max="1" step="0.0005" value="0" title="scrub the computed trajectory">
</div>
<div id="s3ctl">
  <label>speed <select id="s3rate"><option value="0.1">0.1×</option><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
  <label>camera <select id="s3cam"><option value="follow">follow</option><option value="side">side-on</option><option value="orbit">free orbit</option><option value="cockpit">cockpit</option></select></label>
  <label>species / design <select id="s3species"></select></label>
</div>
<div id="s3ctl">
  <label title="takeoff_speed_target_m_s in params.json (assumed): the speed at which the fish stops trimming low and lets itself lift off">launch speed target <input id="s3vto" type="range" min="4" max="24" step="0.25"><span class="v" id="s3vtoOut"></span></label>
  <label title="start_depth_m in params.json (assumed): where the run starts. The launch HEIGHT is not an input -- the solver computes it.">start depth <input id="s3depth" type="range" min="-4" max="-0.1" step="0.05"><span class="v" id="s3depthOut"></span></label>
  <label title="uniform horizontal headwind, assumed; 0 reproduces the committed run exactly">headwind <input id="s3wind" type="range" min="-8" max="12" step="0.5"><span class="v" id="s3windOut"></span></label>
  <label title="the measured ground-effect drag curve, physics/ground-effect.json"><input id="s3ge" type="checkbox"> ground effect</label>
  <label title="the ISA density and PO2 model with height"><input id="s3alt" type="checkbox"> altitude model</label>
  <button id="s3ens" class="small" title="run an ensemble of draws (needs creatures.js)">ensemble</button>
</div>
<div id="s3scrubRow"><span id="s3summary"></span></div>
<div id="s3banner"></div>
<div id="s3legend"></div>
<div class="s3slot" id="s3paramsSlot"></div>
<div class="s3slot" id="s3sweepSlot"></div>
<p class="small mute" style="margin:8px 0 0">Two slots above are reserved for <code>params-panel.js</code> (exhaustive parameter tuning) and <code>sweep.js</code> (1-D curves, 2-D heatmaps). They appear when those modules land; the solve they call is <code>window.DELPHI_SIM3D.solveTrajectory({params, tmax})</code>.</p>`;
}

export default { mount, solveTrajectory, SPECIES };
