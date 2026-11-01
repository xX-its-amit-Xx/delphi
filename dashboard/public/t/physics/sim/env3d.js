// env3d.js — the environment the flying-fish 3D scene flies through.
// Dependency-free ES module. It imports NOTHING: the host passes THREE in, so there is exactly one
// copy of three.js on the page (the viewer pins 0.160.0 from cdnjs via an importmap).
//
//   import { makeOcean, makeSky, makeSpray, makeUnderwater } from './env3d.js';
//   const sky   = makeSky({ THREE, scene, conditions });
//   const ocean = makeOcean({ THREE, scene, size: 48, conditions });
//   const spray = makeSpray({ THREE, scene });
//   const water = makeUnderwater({ THREE, scene });
//   // per frame:
//   ocean.update(t); sky.update(t); spray.update(dt); water.update(t);
//   // the fish sits on the surface exactly:
//   fish.position.y = ocean.heightAt(fish.position.x, fish.position.z);
//
// =====================================================================================
// README — WHICH NUMBERS ARE MEASUREMENTS AND WHICH ARE SCENERY
// The project rule: a decorative number is never presented as a measurement. Everything
// below is also machine-readable at `ocean.info`, `sky.info`, `spray.info`, `water.info`.
// =====================================================================================
//
// PHYSICAL (a real relation, with its source):
//
//  P1. Deep-water (Airy) dispersion. Every drawn wave travels at its own correct phase speed for
//      the wavelength actually drawn:  omega = sqrt(g k),  c = omega/k = sqrt(g*lambda/2pi),
//      T = lambda/c.  k = 2pi/lambda, g = 9.80665 m/s^2 (standard gravity, the value the repo's
//      Lean audit uses). Source: linear deep-water wave theory, any text (e.g. Dean & Dalrymple,
//      "Water Wave Mechanics for Engineers and Scientists", 1991, eq. 2.37; valid for depth >
//      lambda/2, which holds here). Nothing about the speeds or periods on screen is tuned.
//
//  P2. Wind -> sea state. Fully developed sea, Pierson & Moskowitz (1964), J. Geophys. Res. 69:5181:
//        significant height   H_s   = 0.21 U^2 / g
//        peak period          T_p   = 2pi U / (0.877 g) = 0.7306 U
//        peak wavelength      lam_p = g T_p^2 / 2pi
//      U is the 19.5 m wind speed; we use `wind_m_s` as U without a height correction, which is an
//      approximation we state rather than hide. `ocean.info.sea.true_H_s_m` and
//      `true_peak_wavelength_m` always report these UNSCALED physical values, next to what is drawn.
//
//  P3. Gerstner/trochoidal surface kinematics. The surface is the exact Gerstner parametrisation
//      (Gerstner 1802; the form in Finch, GPU Gems 1 ch. 1, 2004) of the wave sum, including the
//      horizontal particle displacement that sharpens crests and flattens troughs. `heightAt`
//      inverts that displacement (Newton, residual < 1e-9 m) so it returns the height of the
//      surface actually drawn at a world (x, z), not the height of the undisplaced parameter grid.
//
//  P4. Horizon geometry. The far water disc has radius 30 km. From 300 m up, the true geometric
//      horizon is sqrt(2*R_E*h) = 62 km away and depressed by 0.55 deg; a 30 km disc puts it at
//      atan(300/30000) = 0.57 deg. So the horizon reads correctly from a few hundred metres without
//      modelling curvature (the curvature itself is NOT modelled; the sea is drawn flat).
//
//  P5. Haze thinning with altitude. haze(h) = exp(-h / 8500 m), the standard atmospheric scale
//      height (US Standard Atmosphere 1976; H = R*T/(M*g) ~ 8.4-8.5 km near the surface). The
//      EXPONENT is physical; the colours it interpolates are chosen for appearance (see D2).
//
//  P6. The sun disc subtends 0.53 deg, its true mean angular diameter (31.6 arcmin, IAU).
//
//  P7. Spray ballistics. Droplets are integrated with g = 9.80665 m/s^2.
//
//  P8. Depth colour. Per-channel transmittance exp(-K_lambda * L) with K taken from pure-water
//      absorption at 450/550/650 nm: 0.0092, 0.0565, 0.340 m^-1 (Pope & Fry 1997, Appl. Opt.
//      36:8710, Table 1). This is why red goes first and blue-green survives. See D5 for the one
//      decorative factor applied on top.
//
//  P9. The path length L in P8 is taken along the VIEW DIRECTION, not at a single depth:
//      L = depth / d.y looking up, unbounded looking level or downward. That is why the sea
//      darkens downward. The clamp L <= 90 m is decorative (D5), so the deep is not pure black.
//
// DECORATIVE (chosen so the scene reads; never to be quoted as a measurement):
//
//  D1. Drawn wave amplitudes. Two separate reasons:
//      (a) BAND. A fully developed sea at U = 10 m/s peaks at lambda_p = 83 m, which does not fit a
//          48 m patch and would be a single slab under a 20 cm fish. So the drawn band is the SHORT
//          gravity-wave end, lambda = 13 / 7.3 / 4.1 / 2.3 m, not the spectral peak. Each drawn
//          wave still uses its own correct phase speed (P1).
//      (b) HEIGHT. Drawn significant height = clamp(readability * H_s_PM, calm_floor, cap) with
//          readability = 0.12, calm_floor = 0.06 m, cap = 0.45 m. The 0.12 and the cap exist so a
//          0.2 m fish stays visible against the sea; they are not a sea state. The true H_s is
//          reported alongside (P2). `ocean.info.sea.readability_scale` names the factor applied.
//      Wave DIRECTIONS (a +-32 deg spread about the wind) and the fixed per-wave PHASES are chosen
//      for appearance; a real sea has a directional spreading function, which we do not use.
//  D2. Sky colours, the sun's elevation/azimuth (38 deg / 135 deg by default) and its glow halo are
//      chosen for appearance. This sky is a hand-tuned vertical gradient: there is NO Rayleigh or
//      Mie scattering computation anywhere in it. Simple and fast, chosen over physically based.
//  D3. Crest foam: whitening driven by surface height and by the Gerstner compression (Jacobian
//      determinant). A readability cue, not a whitecap model (no Monahan-style coverage law).
//  D4. Spray droplet counts, sizes, lifetimes, cone angles and the linear drag coefficient.
//  D5. Underwater: the tint shell's in-scattering colour and opacity, the caustic and light-shaft
//      textures and their drift rates, the particulate density, and a gain of 3.0 applied to the
//      P8 absorption coefficients to stand in for real clear-ocean diffuse attenuation K_d (which
//      is larger than absorption alone because scattering adds to it). The gain is a convenience,
//      so the colour shift reads over tens of metres rather than hundreds.
//  D6. Water body colour, derived from the baseline 25 C warm surface water only as a mood, not a
//      calculation.
//
// FROM conditions/baseline.json (read, reported, locked): water 25 C, salinity 35 psu, air
// 1.225 kg/m^3, wind/waves "calm". "Calm" maps to wind_m_s = 0, which yields the calm_floor sea of
// D1(b) — a 6 cm residual swell, present so the surface is not a dead mirror, and labelled as such.
//
// PERFORMANCE NOTES
//  - The ocean is displaced on the CPU (so heightAt and the drawn mesh cannot drift apart), but the
//    phase is split as theta = k*Dx*x + (k*Dz*z - omega*t + phi) and expanded with the sine
//    addition formula. The x-part is time-independent and cached once; only (segments+1) sin/cos per
//    wave per frame are computed. Per-vertex work is then pure arithmetic: no transcendentals, no
//    allocation. 115 rows x 4 waves = 920 trig calls per frame instead of ~56,000.
//  - update() allocates nothing. Every scratch vector is per-instance and reused.
//  - No external texture files: every texture is painted into a canvas here.
//  - dispose() frees geometries, materials and textures, removes what it added from the scene, and
//    restores scene.fog / scene.background.

'use strict';

// ---------------------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------------------

/** Standard gravity, m/s^2. The value the repo's Lean audit uses. PHYSICAL. */
export const G = 9.80665;

/** Atmospheric scale height, m (US Standard Atmosphere 1976). PHYSICAL (P5). */
const SCALE_HEIGHT_M = 8500;

/** Pure-water absorption at 450/550/650 nm, m^-1 (Pope & Fry 1997 Table 1). PHYSICAL (P8). */
const PURE_WATER_ABSORPTION = { b: 0.0092, g: 0.0565, r: 0.340 };

/** Stand-in gain from absorption to clear-ocean K_d. DECORATIVE (D5). */
const KD_GAIN = 3.0;

/** Drawn wavelengths, m. DECORATIVE band choice (D1a); their speeds are physical (P1). */
const DRAWN_WAVELENGTHS_M = [13.0, 7.3, 4.1, 2.3];
/** Relative height weights across that band. DECORATIVE (D1b). */
const DRAWN_WEIGHTS = [1.0, 0.72, 0.46, 0.27];
/** Direction offsets from the wind, degrees. DECORATIVE (D1b). */
const DRAWN_DIR_OFFSET_DEG = [-9, 17, -32, 28];
/** Fixed phases, radians. DECORATIVE (D1b). */
const DRAWN_PHASE = [0.0, 1.9, 3.7, 5.3];

/** Total Gerstner steepness, < 1 so the surface never self-intersects and the inversion contracts. */
const STEEPNESS = 0.45;

/** Readability scaling of the Pierson-Moskowitz height. DECORATIVE (D1b). */
const READABILITY_SCALE = 0.12;
const CALM_FLOOR_HS_M = 0.06;
const HS_CAP_M = 0.45;

/** WMO sea state code -> representative wind speed, m/s. Used only if sea_state is given and
 *  wind_m_s is not. The code is a real standard; picking the middle of each band is ours. */
const SEA_STATE_WIND_M_S = [0.0, 1.5, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 21.0, 26.0];

/** Far water disc radius, m. PHYSICAL in effect (P4). */
const FAR_DISC_M = 30000;
/** Sky sphere radius, m. Arbitrary: the sky is drawn with depthTest off, so only draw order matters. */
const SKY_RADIUS_M = 6000;
/** What the host's camera far plane must cover to see the far disc. */
export const RECOMMENDED_CAMERA_FAR = 60000;

// ---------------------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------------------

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0 || 1e-9), 0, 1); return t * t * (3 - 2 * t); };

/** Free geometries, materials and textures under `root`, then detach it. */
function deepDispose(root) {
  if (!root) return;
  const seen = new Set();
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      for (const k in m) {
        const v = m[k];
        if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); }
      }
      if (m.uniforms) {
        for (const k in m.uniforms) {
          const v = m.uniforms[k] && m.uniforms[k].value;
          if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); }
        }
      }
      m.dispose();
    }
  });
  if (root.parent) root.parent.remove(root);
}

/**
 * Read conditions/baseline.json (either the whole file or its `conditions` block) plus the two
 * optional overrides. Anything missing falls back to the baseline value, so a caller that passes
 * nothing still gets the locked baseline environment.
 */
export function readConditions(conditions) {
  const c = conditions || {};
  const b = c.conditions && typeof c.conditions === 'object' ? c.conditions : c;
  const val = (k, d) => {
    const e = b[k];
    if (e === undefined || e === null) return d;
    return (typeof e === 'object' && 'value' in e) ? e.value : e;
  };
  const windRaw = c.wind_m_s !== undefined ? c.wind_m_s : val('wind_m_s', undefined);
  const seaState = c.sea_state !== undefined ? c.sea_state : val('sea_state', undefined);
  let wind;
  let windSource;
  if (windRaw !== undefined && windRaw !== null && isFinite(windRaw)) {
    wind = Math.max(0, +windRaw); windSource = 'wind_m_s given by the caller';
  } else if (seaState !== undefined && seaState !== null && isFinite(seaState)) {
    wind = SEA_STATE_WIND_M_S[clamp(Math.round(seaState), 0, 9)];
    windSource = `WMO sea state ${Math.round(seaState)}, representative wind`;
  } else {
    wind = 0; windSource = 'baseline.json wind_waves = "calm" -> 0 m/s';
  }
  return {
    wind_m_s: wind,
    wind_source: windSource,
    wind_direction_deg: c.wind_direction_deg !== undefined ? +c.wind_direction_deg : 20,
    sea_state: seaState === undefined ? null : seaState,
    water_temperature_C: val('water_temperature_C', 25),
    salinity_psu: val('salinity_psu', 35),
    air_density_kg_m3: val('air_density_kg_m3', 1.225),
    wind_waves_label: val('wind_waves', 'calm'),
    sun_elevation_deg: c.sun_elevation_deg !== undefined ? +c.sun_elevation_deg : 38,
    sun_azimuth_deg: c.sun_azimuth_deg !== undefined ? +c.sun_azimuth_deg : 135,
    baseline_note: 'water 25 C, salinity 35 psu, air 1.225 kg/m^3, wind/waves "calm" are LOCKED by conditions/baseline.json'
  };
}

/** Pierson & Moskowitz (1964) fully developed sea. PHYSICAL (P2). */
export function piersonMoskowitz(windMs) {
  const U = Math.max(0, windMs);
  const Hs = 0.21 * U * U / G;
  const Tp = 0.7306 * U;                    // 2pi U / (0.877 g)
  const lam = G * Tp * Tp / (2 * Math.PI);
  return { wind_m_s: U, H_s_m: Hs, T_p_s: Tp, peak_wavelength_m: lam };
}

// ---------------------------------------------------------------------------------------
// procedural textures (no binary assets anywhere)
// ---------------------------------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function canvasTexture(THREE, canvas, { repeat = 1, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (wrap) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  if (repeat !== 1) t.repeat.set(repeat, repeat);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 1;
  t.needsUpdate = true;
  return t;
}

/** A soft round blob: the spray droplet and the particulate mote. */
function sprayBlobCanvas(size = 64) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0.00, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.70, 'rgba(236,248,255,0.28)');
  grd.addColorStop(1.00, 'rgba(236,248,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Caustic-like interference: a sum of a few sine gratings, thresholded into bright filaments.
 *  DECORATIVE (D5) — it is not a refraction calculation. Painted once, then scrolled. */
function causticCanvas(size = 256) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const TAU = Math.PI * 2;
  const gratings = [
    [1, 0.0, 0.0], [1, 1.0, 1.1], [2, -0.7, 2.3], [3, 1.6, 4.0], [2, 2.4, 0.6]
  ];
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let s = 0;
      for (let i = 0; i < gratings.length; i++) {
        const [n, ang, ph] = gratings[i];
        const dx = Math.cos(ang), dy = Math.sin(ang);
        s += Math.sin(TAU * n * (u * dx + v * dy) + ph) / gratings.length;
      }
      // fold to filaments: bright where the interference is near a zero crossing
      let a = 1 - Math.min(1, Math.abs(s) * 3.1);
      a = a * a * a;
      const o = (y * size + x) * 4;
      d[o] = 255; d[o + 1] = 255; d[o + 2] = 255;
      d[o + 3] = Math.round(255 * a * 0.85);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** A soft vertical beam for the underwater light shafts. DECORATIVE (D5). */
function shaftCanvas(w = 32, h = 256) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  // horizontal soft edge
  const gx = g.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)');
  gx.addColorStop(0.5, 'rgba(255,255,255,1)');
  gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx; g.fillRect(0, 0, w, h);
  // vertical fade (bright at the surface end = top of the canvas)
  g.globalCompositeOperation = 'multiply';
  const gy = g.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0.00, 'rgba(255,255,255,1)');
  gy.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gy.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = gy; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  return c;
}

// =======================================================================================
// OCEAN
// =======================================================================================

/**
 * A real travelling-wave sea surface: a sum of four Gerstner waves, displaced on the CPU so that
 * `heightAt` and the drawn triangles cannot disagree.
 *
 * @param {object}  o
 * @param {object}  o.THREE       three.js namespace, passed in by the host.
 * @param {object}  o.scene       the scene to add the meshes to.
 * @param {number} [o.size=48]    patch edge length, m.
 * @param {number} [o.segments]   grid divisions; default puts ~0.42 m between vertices.
 * @param {object} [o.conditions] baseline.json, optionally + {wind_m_s, sea_state, ...}.
 * @returns {{mesh, update, heightAt, normalAt, dispose, info, waves, group, far,
 *            setConditions, sampleDrawnSurface, discretisationBound, cellSize}}
 */
export function makeOcean({ THREE, scene, size = 48, segments, conditions } = {}) {
  if (!THREE) throw new Error('makeOcean: THREE must be passed in (the host owns the single copy)');

  const cond = readConditions(conditions);
  const seg = Math.max(8, Math.round(segments || clamp(Math.round(size / 0.42), 32, 176)));
  const nx = seg + 1;
  const nVerts = nx * nx;
  const half = size / 2;
  const dx = size / seg;

  // ---- wave set -----------------------------------------------------------------------
  // amplitude[], k[], omega[], dirx[], dirz[], phase[], and the Gerstner steepness Q[]
  const NW = DRAWN_WAVELENGTHS_M.length;
  const W = {
    lambda: new Float64Array(NW), amp: new Float64Array(NW), k: new Float64Array(NW),
    om: new Float64Array(NW), dx: new Float64Array(NW), dz: new Float64Array(NW),
    ph: new Float64Array(NW), Q: new Float64Array(NW),
    // per-frame derived
    QAx: new Float64Array(NW), QAz: new Float64Array(NW),
    QAkxx: new Float64Array(NW), QAkzz: new Float64Array(NW), QAkxz: new Float64Array(NW),
    Akx: new Float64Array(NW), Akz: new Float64Array(NW)
  };
  let sea = null;          // the reported sea description
  let ampSum = 0;          // sum of amplitudes, for foam normalisation
  let curvSum = 0;         // sum a_i k_i^2, for the discretisation bound

  // time-independent x tables: sin/cos of k*Dx*x at every column
  const sinAx = new Float64Array(NW * nx);
  const cosAx = new Float64Array(NW * nx);
  // per-frame z tables: sin/cos of (k*Dz*z - omega*t + phi) at every row
  const sinBz = new Float64Array(NW * nx);
  const cosBz = new Float64Array(NW * nx);

  function configure(c) {
    const pm = piersonMoskowitz(c.wind_m_s);
    const hsDrawn = clamp(READABILITY_SCALE * pm.H_s_m, CALM_FLOOR_HS_M, HS_CAP_M);
    // H_s = 4*sigma for a Gaussian surface; sigma^2 = sum(a_i^2)/2 for a sum of sinusoids.
    let wsq = 0;
    for (let i = 0; i < NW; i++) wsq += DRAWN_WEIGHTS[i] * DRAWN_WEIGHTS[i] / 2;
    const scale = (hsDrawn / 4) / Math.sqrt(wsq);
    const windRad = c.wind_direction_deg * Math.PI / 180;

    ampSum = 0; curvSum = 0;
    for (let i = 0; i < NW; i++) {
      const lam = DRAWN_WAVELENGTHS_M[i];
      const k = 2 * Math.PI / lam;
      const a = scale * DRAWN_WEIGHTS[i];
      const th = windRad + DRAWN_DIR_OFFSET_DEG[i] * Math.PI / 180;
      W.lambda[i] = lam;
      W.amp[i] = a;
      W.k[i] = k;
      W.om[i] = Math.sqrt(G * k);                 // PHYSICAL (P1)
      W.dx[i] = Math.sin(th);
      W.dz[i] = Math.cos(th);
      W.ph[i] = DRAWN_PHASE[i];
      // Q_i = steepness / (k_i * a_i * NW): makes sum(Q_i a_i k_i) = steepness < 1 exactly,
      // which both keeps the surface from folding and makes heightAt's inversion a contraction.
      W.Q[i] = a > 1e-12 ? STEEPNESS / (k * a * NW) : 0;
      ampSum += a;
      curvSum += a * k * k;

      const QA = W.Q[i] * a;
      W.QAx[i] = QA * W.dx[i];
      W.QAz[i] = QA * W.dz[i];
      W.QAkxx[i] = QA * k * W.dx[i] * W.dx[i];
      W.QAkzz[i] = QA * k * W.dz[i] * W.dz[i];
      W.QAkxz[i] = QA * k * W.dx[i] * W.dz[i];
      W.Akx[i] = a * k * W.dx[i];
      W.Akz[i] = a * k * W.dz[i];

      // cache the x part
      const kdx = k * W.dx[i];
      const base = i * nx;
      for (let ix = 0; ix < nx; ix++) {
        const ang = kdx * (-half + ix * dx);
        sinAx[base + ix] = Math.sin(ang);
        cosAx[base + ix] = Math.cos(ang);
      }
    }

    sea = {
      wind_m_s: c.wind_m_s,
      wind_source: c.wind_source,
      wind_direction_deg: c.wind_direction_deg,
      // PHYSICAL, unscaled:
      true_H_s_m: pm.H_s_m,
      true_peak_period_s: pm.T_p_s,
      true_peak_wavelength_m: pm.peak_wavelength_m,
      true_source: 'Pierson & Moskowitz 1964 fully developed sea (P2)',
      // DECORATIVE, what is actually drawn:
      drawn_H_s_m: hsDrawn,
      readability_scale: READABILITY_SCALE,
      calm_floor_H_s_m: CALM_FLOOR_HS_M,
      drawn_H_s_cap_m: HS_CAP_M,
      drawn_note: 'drawn height = clamp(0.12 * H_s_PM, 0.06 m, 0.45 m); the band is the short ' +
        'gravity-wave end, not the spectral peak. Heights and band are chosen so a 0.2 m fish ' +
        'stays readable (D1). Every phase speed on screen is the correct one for its wavelength (P1).'
    };
  }
  configure(cond);

  // ---- geometry -----------------------------------------------------------------------
  const pos = new Float32Array(nVerts * 3);
  const nrm = new Float32Array(nVerts * 3);
  const col = new Float32Array(nVerts * 3);
  const uvs = new Float32Array(nVerts * 2);
  const idx = new Uint32Array(seg * seg * 6);
  for (let iz = 0, p = 0; iz < nx; iz++) {
    for (let ix = 0; ix < nx; ix++, p++) {
      uvs[p * 2] = ix / seg; uvs[p * 2 + 1] = iz / seg;
      nrm[p * 3 + 1] = 1;
    }
  }
  for (let iz = 0, o = 0; iz < seg; iz++) {
    for (let ix = 0; ix < seg; ix++) {
      const a = iz * nx + ix, b = a + 1, c2 = a + nx, d2 = c2 + 1;
      idx[o++] = a; idx[o++] = c2; idx[o++] = b;
      idx[o++] = b; idx[o++] = c2; idx[o++] = d2;
    }
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  const nrmAttr = new THREE.BufferAttribute(nrm, 3);
  const colAttr = new THREE.BufferAttribute(col, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  nrmAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('normal', nrmAttr);
  geo.setAttribute('color', colAttr);
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), half * 1.5 + 2);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-half, -2, -half), new THREE.Vector3(half, 2, half));

  // DECORATIVE (D6): warm 25 C surface water read as a mood, not a calculation.
  const WATER_DEEP = new THREE.Color(0.043, 0.168, 0.247);
  const WATER_SHALLOW = new THREE.Color(0.086, 0.337, 0.400);
  const FOAM = new THREE.Color(0.92, 0.96, 0.98);
  const HORIZON = new THREE.Color(0.706, 0.800, 0.878);

  const mat = new THREE.MeshPhongMaterial({
    color: 0xffffff,          // the real colour arrives per-vertex
    vertexColors: true,
    // A tight specular lobe: water is close to a mirror, so the sun must make a narrow glitter
    // path, not a wash across the whole near field. DECORATIVE (D6) but chosen from the look of
    // a real sun glitter path, not from a Fresnel calculation.
    specular: 0x2a323c,
    shininess: 900,
    emissive: new THREE.Color(0.012, 0.042, 0.060),  // so the sea is never pure black without lights
    side: THREE.FrontSide,
    flatShading: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'env3d.ocean.patch';
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  // ---- far water disc: a log-spaced annulus fading into the horizon colour (P4) --------
  const farRings = 26, farSectors = 96;
  const farVerts = (farRings + 1) * (farSectors + 1);
  const fpos = new Float32Array(farVerts * 3);
  const fnrm = new Float32Array(farVerts * 3);
  const fcol = new Float32Array(farVerts * 3);
  const fidx = new Uint32Array(farRings * farSectors * 6);
  {
    const r0 = half * 0.9, r1 = FAR_DISC_M;
    const tmp = new THREE.Color();
    for (let j = 0, p = 0; j <= farRings; j++) {
      const r = r0 * Math.pow(r1 / r0, j / farRings);
      // A gentle long-range fade only; the exponential fog does most of the blend into the
      // horizon, because fog is distance-from-the-camera and so stays right whether the viewer is
      // at eye level or 300 m up. A short fade baked into the vertices looked correct from a
      // raft and turned the whole sea pale from the air.
      const f = Math.pow(smoothstep(0, 1, clamp((r - 300) / 8000, 0, 1)), 0.8);
      tmp.copy(WATER_DEEP).lerp(WATER_SHALLOW, 0.5).lerp(HORIZON, f * 0.55);
      for (let i = 0; i <= farSectors; i++, p++) {
        const a = (i / farSectors) * Math.PI * 2;
        fpos[p * 3] = Math.cos(a) * r;
        fpos[p * 3 + 1] = 0;
        fpos[p * 3 + 2] = Math.sin(a) * r;
        fnrm[p * 3] = 0; fnrm[p * 3 + 1] = 1; fnrm[p * 3 + 2] = 0;
        fcol[p * 3] = tmp.r; fcol[p * 3 + 1] = tmp.g; fcol[p * 3 + 2] = tmp.b;
      }
    }
    const stride = farSectors + 1;
    for (let j = 0, o = 0; j < farRings; j++) {
      for (let i = 0; i < farSectors; i++) {
        const a = j * stride + i, b = a + 1, c2 = a + stride, d2 = c2 + 1;
        // Wound the SAME way round as the patch. With the other winding the disc was back-facing
        // from above, three flipped its normal for DoubleSide, and the sea around the patch was
        // lit from underneath: a bright tile of water sitting on a dark one, obvious from the air.
        fidx[o++] = a; fidx[o++] = b; fidx[o++] = c2;
        fidx[o++] = b; fidx[o++] = d2; fidx[o++] = c2;
      }
    }
  }
  const farGeo = new THREE.BufferGeometry();
  farGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  farGeo.setAttribute('normal', new THREE.BufferAttribute(fnrm, 3));
  farGeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  farGeo.setIndex(new THREE.BufferAttribute(fidx, 1));
  farGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FAR_DISC_M * 1.05);
  // Same lighting model and same constants as the detailed patch, or the patch reads as a bright
  // tile sitting on a different sea -- which is exactly how it looked with an unlit disc, and
  // still looked with a Lambert one.
  const farMat = new THREE.MeshPhongMaterial({
    color: 0xffffff, vertexColors: true,
    specular: 0x2a323c, shininess: 900,
    emissive: new THREE.Color(0.012, 0.042, 0.060),
    side: THREE.DoubleSide, depthWrite: false, fog: true
  });
  const far = new THREE.Mesh(farGeo, farMat);
  far.name = 'env3d.ocean.far';
  far.renderOrder = -900;          // behind the detailed patch, in front of the sky
  far.frustumCulled = false;
  far.matrixAutoUpdate = false;
  far.updateMatrix();

  const group = new THREE.Group();
  group.name = 'env3d.ocean';
  group.add(far, mesh);
  if (scene) scene.add(group);

  // ---- the wave sum, evaluated directly at one point (used by heightAt / normalAt) -----
  // Scratch, per instance, reused: no allocation in any call.
  const S = {
    y: 0, X: 0, Z: 0,
    dXdu: 1, dXdv: 0, dZdu: 0, dZdv: 1, dYdu: 0, dYdv: 0,
    nxv: 0, nyv: 1, nzv: 0, det: 1
  };

  /** Evaluate the Gerstner surface and its Jacobian at parameter (u, v) and time t. */
  function evalAt(u, v, t) {
    let sx = 0, sz = 0, sy = 0, Sxx = 0, Szz = 0, Sxz = 0, Ckx = 0, Ckz = 0;
    for (let i = 0; i < NW; i++) {
      const th = W.k[i] * (W.dx[i] * u + W.dz[i] * v) - W.om[i] * t + W.ph[i];
      const s = Math.sin(th), c = Math.cos(th);
      sx += W.QAx[i] * c;
      sz += W.QAz[i] * c;
      sy += W.amp[i] * s;
      Sxx += W.QAkxx[i] * s;
      Szz += W.QAkzz[i] * s;
      Sxz += W.QAkxz[i] * s;
      Ckx += W.Akx[i] * c;
      Ckz += W.Akz[i] * c;
    }
    S.X = u + sx; S.Z = v + sz; S.y = sy;
    S.dXdu = 1 - Sxx; S.dXdv = -Sxz;
    S.dZdu = -Sxz; S.dZdv = 1 - Szz;
    S.dYdu = Ckx; S.dYdv = Ckz;
    S.det = S.dXdu * S.dZdv - S.dXdv * S.dZdu;
    // normal = Tv x Tu, with Tu = (dXdu, dYdu, dZdu), Tv = (dXdv, dYdv, dZdv)
    const ax = S.dXdv, ay = S.dYdv, az = S.dZdv;
    const bx = S.dXdu, by = S.dYdu, bz = S.dZdu;
    let nx2 = ay * bz - az * by, ny2 = az * bx - ax * bz, nz2 = ax * by - ay * bx;
    const L = Math.hypot(nx2, ny2, nz2) || 1;
    S.nxv = nx2 / L; S.nyv = ny2 / L; S.nzv = nz2 / L;
    return S;
  }

  /**
   * Invert the Gerstner horizontal displacement: find the parameter (u, v) whose drawn world
   * position is (x, z). Four fixed-point sweeps (contraction factor = STEEPNESS = 0.45, so
   * globally convergent) then Newton on the exact 2x2 Jacobian. Residual target 1e-9 m.
   * Writes into `inv` and returns it. No allocation.
   */
  const inv = { u: 0, v: 0, iterations: 0, residual_m: 0 };
  function invert(x, z, t) {
    let u = x, v = z;
    for (let n = 0; n < 4; n++) {
      let sx = 0, sz = 0;
      for (let i = 0; i < NW; i++) {
        const c = Math.cos(W.k[i] * (W.dx[i] * u + W.dz[i] * v) - W.om[i] * t + W.ph[i]);
        sx += W.QAx[i] * c; sz += W.QAz[i] * c;
      }
      u = x - sx; v = z - sz;
    }
    let it = 4, res = Infinity;
    for (let n = 0; n < 12; n++) {
      evalAt(u, v, t);
      const rx = S.X - x, rz = S.Z - z;
      res = Math.max(Math.abs(rx), Math.abs(rz));
      it++;
      if (res < 1e-9) break;
      const det = S.det;
      if (Math.abs(det) < 1e-12) break;
      u -= (S.dZdv * rx - S.dXdv * rz) / det;
      v -= (-S.dZdu * rx + S.dXdu * rz) / det;
    }
    inv.u = u; inv.v = v; inv.iterations = it; inv.residual_m = res;
    return inv;
  }

  let tNow = 0;

  /** Height of the drawn surface at world (x, z), m. Matches the mesh by construction. */
  function heightAt(x, z, t) {
    const tt = (t === undefined ? tNow : t);
    invert(x, z, tt);
    return evalAt(inv.u, inv.v, tt).y;
  }

  /** Unit surface normal at world (x, z). Pass `out` to avoid allocating. */
  function normalAt(x, z, out, t) {
    const tt = (t === undefined ? tNow : t);
    invert(x, z, tt);
    evalAt(inv.u, inv.v, tt);
    const o = out || new THREE.Vector3();
    return o.set(S.nxv, S.nyv, S.nzv);
  }

  // ---- per-frame CPU displacement -----------------------------------------------------
  function update(tSeconds) {
    const t = +tSeconds || 0;
    tNow = t;

    // per-row z tables (the only transcendentals in the frame)
    for (let i = 0; i < NW; i++) {
      const kdz = W.k[i] * W.dz[i];
      const off = -W.om[i] * t + W.ph[i];
      const base = i * nx;
      for (let iz = 0; iz < nx; iz++) {
        const ang = kdz * (-half + iz * dx) + off;
        sinBz[base + iz] = Math.sin(ang);
        cosBz[base + iz] = Math.cos(ang);
      }
    }

    const invAmp = ampSum > 1e-9 ? 1 / ampSum : 0;
    let p = 0;
    for (let iz = 0; iz < nx; iz++) {
      const z0 = -half + iz * dx;
      for (let ix = 0; ix < nx; ix++, p++) {
        const x0 = -half + ix * dx;
        let sx = 0, sz = 0, sy = 0, Sxx = 0, Szz = 0, Sxz = 0, Ckx = 0, Ckz = 0;
        for (let i = 0; i < NW; i++) {
          const b = i * nx;
          const sA = sinAx[b + ix], cA = cosAx[b + ix];
          const sB = sinBz[b + iz], cB = cosBz[b + iz];
          const s = sA * cB + cA * sB;        // sin(A+B)
          const c = cA * cB - sA * sB;        // cos(A+B)
          sx += W.QAx[i] * c;
          sz += W.QAz[i] * c;
          sy += W.amp[i] * s;
          Sxx += W.QAkxx[i] * s;
          Szz += W.QAkzz[i] * s;
          Sxz += W.QAkxz[i] * s;
          Ckx += W.Akx[i] * c;
          Ckz += W.Akz[i] * c;
        }
        const o3 = p * 3;
        pos[o3] = x0 + sx;
        pos[o3 + 1] = sy;
        pos[o3 + 2] = z0 + sz;

        const aXu = 1 - Sxx, aXv = -Sxz, aZu = -Sxz, aZv = 1 - Szz;
        // n = Tv x Tu
        const nx2 = Ckz * aZu - aZv * Ckx;
        const ny2 = aZv * aXu - aXv * aZu;
        const nz2 = aXv * Ckx - Ckz * aXu;
        const L = Math.sqrt(nx2 * nx2 + ny2 * ny2 + nz2 * nz2) || 1;
        nrm[o3] = nx2 / L; nrm[o3 + 1] = ny2 / L; nrm[o3 + 2] = nz2 / L;

        // colour: depth cue by height + foam where crests compress (DECORATIVE, D3/D6)
        const hN = clamp(sy * invAmp * 0.5 + 0.5, 0, 1);
        const compress = clamp(1 - (aXu * aZv - aXv * aZu), 0, 1);
        const foam = clamp((compress - 0.22) * 2.4, 0, 1) * clamp((hN - 0.62) * 3.2, 0, 1);
        const r = lerp(WATER_DEEP.r, WATER_SHALLOW.r, hN);
        const g2 = lerp(WATER_DEEP.g, WATER_SHALLOW.g, hN);
        const b2 = lerp(WATER_DEEP.b, WATER_SHALLOW.b, hN);
        col[o3] = lerp(r, FOAM.r, foam);
        col[o3 + 1] = lerp(g2, FOAM.g, foam);
        col[o3 + 2] = lerp(b2, FOAM.b, foam);
      }
    }
    posAttr.needsUpdate = true;
    nrmAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  /**
   * The height the mesh ACTUALLY draws, read from the attribute buffer alone (linear interpolation
   * inside one cell, exactly what the rasteriser does). The test uses this to check heightAt
   * without going back through the wave maths. `bu`, `bv` in [0,1] locate the sample in the cell.
   * Returns {x, y, z} of the drawn point. Reused object, no allocation.
   */
  const drawn = { x: 0, y: 0, z: 0 };
  function sampleDrawnSurface(ix, iz, bu, bv) {
    const i0 = clamp(ix | 0, 0, seg - 1), j0 = clamp(iz | 0, 0, seg - 1);
    const a = j0 * nx + i0, b = a + 1, c2 = a + nx, d2 = c2 + 1;
    // the two triangles of the cell are (a, c2, b) and (b, c2, d2); pick by the diagonal b-c2
    let p0, p1, p2, w0, w1, w2;
    if (bu + bv <= 1) {
      // triangle a (bu=0,bv=0), b (1,0), c2 (0,1)
      p0 = a; p1 = b; p2 = c2; w1 = bu; w2 = bv; w0 = 1 - bu - bv;
    } else {
      // triangle d2 (1,1), b (1,0), c2 (0,1)
      p0 = d2; p1 = b; p2 = c2; w1 = 1 - bv; w2 = 1 - bu; w0 = bu + bv - 1;
    }
    drawn.x = pos[p0 * 3] * w0 + pos[p1 * 3] * w1 + pos[p2 * 3] * w2;
    drawn.y = pos[p0 * 3 + 1] * w0 + pos[p1 * 3 + 1] * w1 + pos[p2 * 3 + 1] * w2;
    drawn.z = pos[p0 * 3 + 2] * w0 + pos[p1 * 3 + 2] * w1 + pos[p2 * 3 + 2] * w2;
    return drawn;
  }

  /**
   * Worst-case gap between a flat triangle and the true curved surface across one cell:
   * sum_i a_i k_i^2 h^2 / 8 (the chord-to-sine sagitta). The test's tolerance is built from this,
   * so raising the wind raises the tolerance honestly instead of loosening it by hand.
   */
  function discretisationBound() { return curvSum * dx * dx / 8; }

  function setConditions(c) {
    const merged = readConditions(c);
    configure(merged);
    Object.assign(cond, merged);
    update(tNow);
    return info();
  }

  function info() {
    return {
      module: 'env3d.makeOcean',
      model: 'sum of 4 Gerstner (trochoidal) waves, displaced on the CPU',
      size_m: size, segments: seg, vertices: nVerts, cell_size_m: dx,
      gravity_m_s2: G,
      physical: [
        'P1 deep-water dispersion omega=sqrt(gk): every drawn wave moves at the correct speed for its wavelength',
        'P2 Pierson & Moskowitz 1964 wind->H_s, T_p, lambda_p (reported unscaled in `sea.true_*`)',
        'P3 exact Gerstner kinematics incl. horizontal particle displacement; heightAt inverts it',
        'P4 far disc radius 30 km puts the horizon at 0.57 deg depression from 300 m (true 0.55 deg)'
      ],
      decorative: [
        'D1a drawn band lambda = 13/7.3/4.1/2.3 m, not the spectral peak (which would be 83 m at U=10)',
        'D1b drawn H_s = clamp(0.12*H_s_PM, 0.06, 0.45) m, and the fixed directions/phases',
        'D3 crest foam whitening',
        'D6 water colour'
      ],
      conditions: cond,
      sea,
      waves: waves(),
      discretisation_bound_m: discretisationBound(),
      recommended_camera_far_m: RECOMMENDED_CAMERA_FAR
    };
  }

  function waves() {
    const out = [];
    for (let i = 0; i < NW; i++) {
      const c = W.om[i] / W.k[i];
      out.push({
        wavelength_m: W.lambda[i],
        amplitude_m: W.amp[i],
        height_m: 2 * W.amp[i],
        direction_deg: Math.atan2(W.dx[i], W.dz[i]) * 180 / Math.PI,
        phase_speed_m_s: c,
        period_s: W.lambda[i] / c,
        steepness_Q: W.Q[i],
        speed_source: 'PHYSICAL: c = sqrt(g*lambda/2pi), deep-water dispersion',
        amplitude_source: 'DECORATIVE: readability-scaled Pierson-Moskowitz height (D1b)'
      });
    }
    return out;
  }

  function dispose() {
    deepDispose(group);
    if (scene) scene.remove(group);
  }

  update(0);

  return {
    mesh, group, far,
    update, heightAt, normalAt, dispose,
    // optional extras (additive to the agreed interface)
    setConditions, sampleDrawnSurface, discretisationBound,
    cellSize: dx, size, segments: seg,
    get waves() { return waves(); },
    get info() { return info(); },
    get inversion() { return { iterations: inv.iterations, residual_m: inv.residual_m }; }
  };
}

// =======================================================================================
// SKY
// =======================================================================================

/**
 * Gradient sky + sun + altitude-thinned haze. Explicitly NOT physically based: a hand-tuned
 * vertical gradient painted into a canvas (D2). The only physical numbers are the haze scale
 * height (P5) and the sun's angular diameter (P6).
 *
 * Owns `scene.fog` and `scene.background` while mounted and restores both on dispose().
 * Also provides the scene's lights (a directional sun + a hemisphere fill), since the horizon
 * colour and the light direction have to agree.
 *
 * @returns {{update, setAltitude, dispose, info, group, sun, sunLight, hemiLight, sunDirection,
 *            altitude, setSun}}
 */
export function makeSky({ THREE, scene, conditions } = {}) {
  if (!THREE) throw new Error('makeSky: THREE must be passed in');
  const cond = readConditions(conditions);

  // ---- palette (DECORATIVE, D2) -------------------------------------------------------
  const PAL = {
    zenithLow: [0.149, 0.337, 0.584],   // thick haze, at the surface
    zenithHigh: [0.035, 0.106, 0.302],  // thin haze, high up
    horizonLow: [0.776, 0.855, 0.906],
    horizonHigh: [0.447, 0.584, 0.714],
    nadir: [0.055, 0.149, 0.212],
    sunTint: [1.0, 0.957, 0.863]
  };
  const css = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a === undefined ? 1 : a})`;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // ---- sky dome: one canvas, repainted only when the altitude moves ------------------
  const gradCanvas = makeCanvas(8, 512);
  const gctx = gradCanvas.getContext('2d');
  const gradTex = canvasTexture(THREE, gradCanvas, { wrap: false });
  gradTex.minFilter = THREE.LinearFilter;
  gradTex.generateMipmaps = false;

  let altitude = 0;
  let haze = 1;
  const horizonColor = new THREE.Color();
  const zenithColor = new THREE.Color();

  function paint() {
    // PHYSICAL (P5): haze = exp(-h/H), H = 8500 m. The colours it blends are DECORATIVE (D2).
    haze = Math.exp(-Math.max(0, altitude) / SCALE_HEIGHT_M);
    const zen = mix3(PAL.zenithHigh, PAL.zenithLow, haze);
    const hor = mix3(PAL.horizonHigh, PAL.horizonLow, haze);
    zenithColor.setRGB(zen[0], zen[1], zen[2]);
    horizonColor.setRGB(hor[0], hor[1], hor[2]);

    const h = gradCanvas.height;
    const g = gctx.createLinearGradient(0, 0, 0, h);   // 0 = zenith (flipY maps it to the top)
    g.addColorStop(0.00, css(zen));
    g.addColorStop(0.26, css(mix3(zen, hor, 0.28)));
    g.addColorStop(0.44, css(mix3(zen, hor, 0.74)));
    // the haze band: a thin bright rim right at the horizon, thinning with altitude
    const band = lerp(0.012, 0.055, haze);
    g.addColorStop(clamp(0.5 - band, 0, 1), css(hor));
    g.addColorStop(0.50, css(mix3(hor, [1, 1, 1], 0.30 * haze)));
    g.addColorStop(clamp(0.5 + band * 0.6, 0, 1), css(mix3(hor, PAL.nadir, 0.35)));
    g.addColorStop(0.62, css(mix3(hor, PAL.nadir, 0.8)));
    g.addColorStop(1.00, css(PAL.nadir));
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, gradCanvas.width, h);
    gradTex.needsUpdate = true;

    if (scene) {
      scene.background = horizonColor;
      if (fog) {
        fog.color.copy(horizonColor);
        // DECORATIVE: density picked so the 30 km disc fades into the horizon, scaled by haze.
        fog.density = lerp(2.0e-5, 1.1e-4, haze);
      }
    }
    if (sunLight) {
      sunLight.intensity = lerp(2.4, 1.7, haze);
      sunLight.color.setRGB(
        lerp(1.0, PAL.sunTint[0], haze), lerp(1.0, PAL.sunTint[1], haze), lerp(0.98, PAL.sunTint[2], haze)
      );
    }
    if (hemiLight) {
      hemiLight.color.copy(horizonColor);
      hemiLight.intensity = lerp(0.35, 0.85, haze);
    }
    if (glowMat) glowMat.opacity = lerp(0.22, 0.65, haze);
  }

  const domeGeo = new THREE.SphereGeometry(SKY_RADIUS_M, 32, 20);
  const domeMat = new THREE.MeshBasicMaterial({
    map: gradTex, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.name = 'env3d.sky.dome';
  dome.renderOrder = -1000;
  dome.frustumCulled = false;

  // ---- sun: a 0.53 deg disc (P6) plus a decorative halo (D2) --------------------------
  const sunDirection = new THREE.Vector3();
  function aimSun() {
    const el = cond.sun_elevation_deg * Math.PI / 180;
    const az = cond.sun_azimuth_deg * Math.PI / 180;
    sunDirection.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  }
  aimSun();

  const SUN_DIST = SKY_RADIUS_M * 0.82;
  const SUN_ANG_RAD = 0.53 * Math.PI / 180;           // PHYSICAL (P6)
  const sunDiscSize = 2 * SUN_DIST * Math.tan(SUN_ANG_RAD / 2);

  const discCanvas = makeCanvas(64, 64);
  {
    const g = discCanvas.getContext('2d');
    const r = 32;
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0.0, 'rgba(255,255,250,1)');
    grd.addColorStop(0.72, 'rgba(255,253,240,1)');
    grd.addColorStop(0.92, 'rgba(255,248,224,0.55)');
    grd.addColorStop(1.0, 'rgba(255,248,224,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  }
  const haloCanvas = makeCanvas(128, 128);
  {
    const g = haloCanvas.getContext('2d');
    const r = 64;
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0.00, 'rgba(255,250,232,0.85)');
    grd.addColorStop(0.18, 'rgba(255,248,226,0.34)');
    grd.addColorStop(0.45, 'rgba(252,245,226,0.12)');
    grd.addColorStop(1.00, 'rgba(250,245,230,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  }
  const discTex = canvasTexture(THREE, discCanvas, { wrap: false });
  const haloTex = canvasTexture(THREE, haloCanvas, { wrap: false });

  const sunMat = new THREE.SpriteMaterial({
    map: discTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, fog: false
  });
  const sun = new THREE.Sprite(sunMat);
  sun.name = 'env3d.sky.sun';
  sun.scale.setScalar(sunDiscSize);
  sun.renderOrder = -995;

  const glowMat = new THREE.SpriteMaterial({
    map: haloTex, color: 0xffffff, transparent: true, opacity: 0.5,
    depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending
  });
  const glow = new THREE.Sprite(glowMat);
  glow.name = 'env3d.sky.sunGlow';
  glow.scale.setScalar(sunDiscSize * 16);       // ~8.5 deg: DECORATIVE (D2)
  glow.renderOrder = -996;

  function placeSun() {
    sun.position.copy(sunDirection).multiplyScalar(SUN_DIST);
    glow.position.copy(sun.position);
    if (sunLight) sunLight.position.copy(sunDirection).multiplyScalar(220);
  }

  const sunLight = new THREE.DirectionalLight(0xfff4dc, 2.2);
  sunLight.name = 'env3d.sky.sunLight';
  const hemiLight = new THREE.HemisphereLight(0xbdd9ea, 0x16404f, 0.7);
  hemiLight.name = 'env3d.sky.hemiLight';

  const group = new THREE.Group();
  group.name = 'env3d.sky';
  group.add(dome, glow, sun, sunLight, hemiLight);

  let fog = null;
  let prevFog = null, prevBg = null, touchedScene = false;
  if (scene) {
    prevFog = scene.fog || null;
    prevBg = scene.background || null;
    fog = new THREE.FogExp2(0xc6daea, 8e-5);
    scene.fog = fog;
    touchedScene = true;
    scene.add(group);
  }

  placeSun();
  paint();

  function setAltitude(m) {
    const h = Math.max(0, +m || 0);
    if (Math.abs(h - altitude) < 4) return;    // repaint only when it matters: no per-frame work
    altitude = h;
    paint();
  }

  function setSun(elevationDeg, azimuthDeg) {
    if (elevationDeg !== undefined) cond.sun_elevation_deg = +elevationDeg;
    if (azimuthDeg !== undefined) cond.sun_azimuth_deg = +azimuthDeg;
    aimSun(); placeSun(); paint();
  }

  // The sky is static apart from the altitude; update() exists so the host can call all four the
  // same way, and so the sun sprite can breathe a little without allocating.
  function update(/* tSeconds */) { /* nothing per-frame: the dome and sun do not move */ }

  function dispose() {
    deepDispose(group);
    if (scene) {
      scene.remove(group);
      if (touchedScene) { scene.fog = prevFog; scene.background = prevBg; }
    }
  }

  return {
    update, setAltitude, dispose,
    // optional extras
    setSun, group, sun, sunLight, hemiLight, sunDirection,
    get altitude() { return altitude; },
    get horizonColor() { return horizonColor; },
    get info() {
      return {
        module: 'env3d.makeSky',
        model: 'hand-tuned vertical gradient painted into a canvas; NOT physically based ' +
          '(no Rayleigh/Mie computation anywhere). Simple and fast, chosen over physical.',
        physical: [
          'P5 haze(h) = exp(-h/8500 m), the standard atmospheric scale height (US Std Atm 1976)',
          'P6 sun disc subtends 0.53 deg, its true mean angular diameter'
        ],
        decorative: [
          'D2 every colour, the sun elevation/azimuth, the glow halo (~8.5 deg), the fog density'
        ],
        altitude_m: altitude,
        haze_fraction: haze,
        sun_elevation_deg: cond.sun_elevation_deg,
        sun_azimuth_deg: cond.sun_azimuth_deg,
        sun_angular_diameter_deg: 0.53,
        owns: ['scene.fog', 'scene.background', 'one DirectionalLight', 'one HemisphereLight']
      };
    }
  };
}

// =======================================================================================
// SPRAY
// =======================================================================================

/**
 * Pooled GPU point sprites for taxi wake and touchdown splash. Fixed capacity, swap-remove
 * compaction, zero allocation per frame. Droplets fall under g (P7); their count, size, lifetime,
 * cone and linear drag are chosen for appearance (D4).
 *
 * @returns {{burst, update, dispose, info, points, group, capacity, active, clear}}
 */
export function makeSpray({ THREE, scene, capacity = 700 } = {}) {
  if (!THREE) throw new Error('makeSpray: THREE must be passed in');

  const N = Math.max(16, capacity | 0);
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const lifeMax = new Float32Array(N);
  const size0 = new Float32Array(N);
  const aSize = new Float32Array(N);
  const aAlpha = new Float32Array(N);
  let active = 0;

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  const sizeAttr = new THREE.BufferAttribute(aSize, 1);
  const alphaAttr = new THREE.BufferAttribute(aAlpha, 1);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  sizeAttr.setUsage(THREE.DynamicDrawUsage);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aSize', sizeAttr);
  geo.setAttribute('aAlpha', alphaAttr);
  geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

  const tex = canvasTexture(THREE, sprayBlobCanvas(64), { wrap: false });

  // three renamed the output-colourspace chunk at r152; pin by REVISION so a host on a different
  // build cannot fail shader compilation (which would show up as a console error).
  const rev = parseInt(THREE.REVISION, 10) || 160;
  const csChunk = rev >= 152 ? '#include <colorspace_fragment>'
    : (rev >= 100 ? '#include <encodings_fragment>' : '');

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uColor: { value: new THREE.Color(0.95, 0.98, 1.0) },
      uScale: { value: 320.0 }
    },
    vertexShader: [
      'attribute float aSize;',
      'attribute float aAlpha;',
      'uniform float uScale;',
      'varying float vAlpha;',
      'void main() {',
      '  vAlpha = aAlpha;',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = aSize * (uScale / max(0.05, -mv.z));',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D uMap;',
      'uniform vec3 uColor;',
      'varying float vAlpha;',
      'void main() {',
      '  vec4 t = texture2D(uMap, gl_PointCoord);',
      '  float a = t.a * vAlpha;',
      '  if (a < 0.008) discard;',
      '  gl_FragColor = vec4(uColor, a);',
      csChunk,
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'env3d.spray';
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.name = 'env3d.spray.group';
  group.add(points);
  if (scene) scene.add(group);

  // DECORATIVE (D4)
  const DRAG = 1.9;              // s^-1, linear
  const LIFE_MIN = 0.35, LIFE_MAX = 1.15;
  const SIZE_MIN = 0.012, SIZE_MAX = 0.055;   // metres across at 1 m

  /**
   * Spawn droplets at `position` thrown off along `velocity`.
   * @param {Vector3|{x,y,z}} position
   * @param {Vector3|{x,y,z}} velocity  the thrower's velocity, m/s
   * @param {number} strength 0..1-ish; scales count, speed and lifetime.
   */
  function burst(position, velocity, strength = 1) {
    if (!position) return 0;
    const s = clamp(+strength || 0, 0, 3);
    if (s <= 0) return 0;
    const vx = (velocity && velocity.x) || 0, vy = (velocity && velocity.y) || 0, vz = (velocity && velocity.z) || 0;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    let n = Math.round(5 + 38 * s);
    n = Math.min(n, N - active);
    for (let q = 0; q < n; q++) {
      const i = active++;
      const o = i * 3;
      // spawn inside a small disc at the contact point
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (0.03 + 0.09 * s);
      pos[o] = position.x + Math.cos(a) * r;
      pos[o + 1] = position.y + Math.random() * 0.02;
      pos[o + 2] = position.z + Math.sin(a) * r;
      // a cone around the thrower's direction, biased up
      const kick = (0.9 + 2.6 * s) * (0.45 + 0.9 * Math.random());
      const spread = 0.55 + 0.45 * Math.random();
      vel[o] = vx * 0.28 + (Math.random() - 0.5) * kick * spread;
      vel[o + 1] = Math.abs(vy) * 0.18 + kick * (0.55 + 0.75 * Math.random()) + 0.25 * speed * 0.05;
      vel[o + 2] = vz * 0.28 + (Math.random() - 0.5) * kick * spread;
      lifeMax[i] = LIFE_MIN + (LIFE_MAX - LIFE_MIN) * Math.random() * (0.6 + 0.6 * s);
      life[i] = lifeMax[i];
      size0[i] = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * Math.random();
      aSize[i] = size0[i];
      aAlpha[i] = 1;
    }
    if (n > 0) { geo.setDrawRange(0, active); posAttr.needsUpdate = true; sizeAttr.needsUpdate = true; alphaAttr.needsUpdate = true; }
    return n;
  }

  function swapRemove(i) {
    const last = --active;
    if (i !== last) {
      const a = i * 3, b = last * 3;
      pos[a] = pos[b]; pos[a + 1] = pos[b + 1]; pos[a + 2] = pos[b + 2];
      vel[a] = vel[b]; vel[a + 1] = vel[b + 1]; vel[a + 2] = vel[b + 2];
      life[i] = life[last]; lifeMax[i] = lifeMax[last];
      size0[i] = size0[last]; aSize[i] = aSize[last]; aAlpha[i] = aAlpha[last];
    }
    aAlpha[last] = 0; aSize[last] = 0;
  }

  /** @param {number} dtSeconds */
  function update(dtSeconds) {
    if (active === 0) return;
    const dt = clamp(+dtSeconds || 0, 0, 0.1);
    if (dt <= 0) return;
    const damp = 1 - DRAG * dt;
    for (let i = 0; i < active;) {
      const o = i * 3;
      vel[o + 1] -= G * dt;                 // PHYSICAL (P7)
      vel[o] *= damp; vel[o + 1] *= damp; vel[o + 2] *= damp;
      pos[o] += vel[o] * dt;
      pos[o + 1] += vel[o + 1] * dt;
      pos[o + 2] += vel[o + 2] * dt;
      life[i] -= dt;
      if (life[i] <= 0 || pos[o + 1] < -0.4) { swapRemove(i); continue; }
      const f = life[i] / lifeMax[i];
      aAlpha[i] = f < 0.35 ? f / 0.35 : 1;          // fade out at the end (D4)
      aSize[i] = size0[i] * (1 + (1 - f) * 0.9);    // droplets spread as they fly (D4)
      i++;
    }
    geo.setDrawRange(0, active);
    posAttr.needsUpdate = true; sizeAttr.needsUpdate = true; alphaAttr.needsUpdate = true;
  }

  function clear() { active = 0; geo.setDrawRange(0, 0); }

  function dispose() {
    deepDispose(group);
    if (scene) scene.remove(group);
  }

  return {
    burst, update, dispose,
    // optional extras
    points, group, clear, capacity: N,
    get active() { return active; },
    get info() {
      return {
        module: 'env3d.makeSpray',
        model: 'pooled GPU point sprites, ballistic integration, swap-remove compaction, no per-frame allocation',
        capacity: N,
        physical: ['P7 droplets fall under g = 9.80665 m/s^2'],
        decorative: [
          'D4 droplet count (5 + 38*strength), sizes 12-55 mm, lifetimes 0.35-1.15 s, cone angles, ' +
          'and the linear drag coefficient 1.9 s^-1 — none of these is a measured spray property'
        ]
      };
    }
  };
}

// =======================================================================================
// UNDERWATER
// =======================================================================================

/**
 * Depth tint, caustic-like surface shimmer, light shafts and drifting particulate.
 *
 * `setDepth(m)` is the depth of the VIEWER below the surface, in metres. <= 0 switches everything
 * off (you are at or above the surface). The tint is drawn with depthTest off inside a 400 m shell,
 * so it behaves as a full-screen tint for any viewer within 400 m of the origin.
 *
 * Does NOT touch scene.fog or scene.background — makeSky owns those.
 *
 * @returns {{setDepth, update, dispose, info, group, depth, transmittance}}
 */
export function makeUnderwater({ THREE, scene } = {}) {
  if (!THREE) throw new Error('makeUnderwater: THREE must be passed in');

  const revUW = parseInt(THREE.REVISION, 10) || 160;
  const csChunkUW = revUW >= 152 ? '#include <colorspace_fragment>'
    : (revUW >= 100 ? '#include <encodings_fragment>' : '');

  const group = new THREE.Group();
  group.name = 'env3d.underwater';
  group.visible = false;

  // ---- 1. depth tint: multiply by exp(-K*d), plus a decorative in-scatter -------------
  const K = {
    r: PURE_WATER_ABSORPTION.r * KD_GAIN,
    g: PURE_WATER_ABSORPTION.g * KD_GAIN,
    b: PURE_WATER_ABSORPTION.b * KD_GAIN
  };
  const transmittance = new THREE.Color(1, 1, 1);

  // The tint is Beer-Lambert along the VIEW PATH, not at a single depth: looking straight up the
  // light has crossed `depth` metres of water, looking level or downward it has crossed far more
  // (the ray never reaches the surface at all), so the sea must darken downward. Path length for a
  // view direction d is L = depth / d.y when d.y > 0, and unbounded otherwise; we clamp it to
  // L_MAX so the deep does not go absolutely black. The shell is centred on the origin rather than
  // on the camera, which is exact only while the viewer is near the origin relative to its 400 m
  // radius -- true for this scene, and stated rather than hidden.
  const L_MAX_M = 90;          // DECORATIVE clamp (D5)
  const shellGeo = new THREE.SphereGeometry(400, 16, 12);
  const shellDirY = new Float32Array(shellGeo.getAttribute('position').count);
  {
    const sp = shellGeo.getAttribute('position');
    for (let i = 0; i < sp.count; i++) shellDirY[i] = sp.getY(i) / 400;
    shellGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sp.count * 3), 3));
  }
  const absorbMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true, side: THREE.BackSide, transparent: true,
    blending: THREE.MultiplyBlending, depthWrite: false, depthTest: false, fog: false
  });
  const absorb = new THREE.Mesh(shellGeo, absorbMat);
  absorb.name = 'env3d.underwater.absorb';
  absorb.renderOrder = 900;
  absorb.frustumCulled = false;

  // DECORATIVE (D5): what the water itself glows back at you. Its own sphere, because it carries
  // a vertical gradient in vertex colours: light scatters down from the surface, so looking up is
  // bright and looking into the deep is dark. (The absorb shell must stay pure transmittance.)
  const scatterGeo = new THREE.SphereGeometry(400, 16, 12);
  {
    const sp = scatterGeo.getAttribute('position');
    const sc = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i++) {
      const f = clamp(sp.getY(i) / 400 * 0.5 + 0.5, 0, 1);      // 0 at the nadir, 1 at the zenith
      const w = 0.10 + 0.90 * Math.pow(f, 1.6);
      sc[i * 3] = w; sc[i * 3 + 1] = w; sc[i * 3 + 2] = w;
    }
    scatterGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  }
  const scatterMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.055, 0.243, 0.290), vertexColors: true,
    side: THREE.BackSide, transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
  });
  const scatter = new THREE.Mesh(scatterGeo, scatterMat);
  scatter.name = 'env3d.underwater.scatter';
  scatter.renderOrder = 901;
  scatter.frustumCulled = false;

  // ---- 2. the surface seen from below: two caustic layers in ONE additive pass (D5) ---
  // Two interference layers scrolling against each other is what sells a caustic. Drawn as two
  // texture fetches inside one quad rather than two stacked quads: under software WebGL a second
  // full-screen blend pass cost ~15 fps, a second texture fetch costs almost nothing.
  const causticTex = canvasTexture(THREE, causticCanvas(256), { repeat: 1 });
  const ceilGeo = new THREE.PlaneGeometry(260, 260, 1, 1);
  const ceilMat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: causticTex },
      uA: { value: new THREE.Vector4(2.4, 2.4, 0, 0) },      // repeat.xy, offset.xy
      uB: { value: new THREE.Vector4(1.3, 1.3, 0, 0) },
      uCA: { value: new THREE.Color(0.804, 0.941, 1.0) },
      uCB: { value: new THREE.Color(0.659, 0.894, 1.0) },
      uOpacity: { value: 0.0 }
    },
    vertexShader: [
      'varying vec2 vUv;',
      'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D uMap; uniform vec4 uA; uniform vec4 uB;',
      'uniform vec3 uCA; uniform vec3 uCB; uniform float uOpacity;',
      'varying vec2 vUv;',
      'void main(){',
      '  float a = texture2D(uMap, vUv * uA.xy + uA.zw).a;',
      '  float b = texture2D(uMap, vUv * uB.xy + uB.zw).a;',
      '  vec3 c = uCA * a + uCB * b * 0.72;',
      '  gl_FragColor = vec4(c * uOpacity, 1.0);',
      csChunkUW,
      '}'
    ].join('\n'),
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    depthWrite: false, fog: false
  });
  const ceil = new THREE.Mesh(ceilGeo, ceilMat);
  ceil.rotation.x = -Math.PI / 2;
  ceil.position.y = -0.06;
  ceil.name = 'env3d.underwater.surfaceGlow';
  ceil.renderOrder = 910;
  ceil.frustumCulled = false;

  // ---- 3. light shafts (D5) ------------------------------------------------------------
  const shaftTex = canvasTexture(THREE, shaftCanvas(32, 256), { wrap: false });
  const shaftGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
  shaftGeo.translate(0, -0.5, 0);           // pivot at the top (the surface end)
  const shaftMat = new THREE.MeshBasicMaterial({
    map: shaftTex, color: 0xdff4ff, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false
  });
  const shafts = [];
  const SHAFT_N = 3;
  for (let i = 0; i < SHAFT_N; i++) {
    const m = new THREE.Mesh(shaftGeo, shaftMat);
    const a = (i / SHAFT_N) * Math.PI * 2;
    m.position.set(Math.cos(a) * (5 + i * 3.1), -0.1, Math.sin(a) * (5 + i * 3.1));
    m.scale.set(3.2 + i * 0.9, 62, 1);
    m.rotation.set(0.22, a * 0.7, 0.16 * (i % 2 ? 1 : -1));
    m.name = 'env3d.underwater.shaft' + i;
    m.renderOrder = 905;
    m.frustumCulled = false;
    shafts.push(m);
  }

  // ---- 4. particulate: a pooled drifting cloud that follows the viewer down -----------
  const PN = 650;
  const BOX = 60;                       // half-extent, m
  const ppos = new Float32Array(PN * 3);
  const pvel = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) {
    const o = i * 3;
    ppos[o] = (Math.random() * 2 - 1) * BOX;
    ppos[o + 1] = (Math.random() * 2 - 1) * BOX;
    ppos[o + 2] = (Math.random() * 2 - 1) * BOX;
    pvel[o] = (Math.random() - 0.5) * 0.09;
    pvel[o + 1] = -0.012 - Math.random() * 0.05;      // slow marine-snow sink (D5)
    pvel[o + 2] = (Math.random() - 0.5) * 0.09;
  }
  const pgeo = new THREE.BufferGeometry();
  const pposAttr = new THREE.BufferAttribute(ppos, 3);
  pposAttr.setUsage(THREE.DynamicDrawUsage);
  pgeo.setAttribute('position', pposAttr);
  pgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BOX * 2);
  const pmat = new THREE.PointsMaterial({
    map: canvasTexture(THREE, sprayBlobCanvas(32), { wrap: false }),
    color: 0xd8f0f8, size: 0.11, sizeAttenuation: true,
    transparent: true, opacity: 0.0, depthWrite: false, fog: false
  });
  const motes = new THREE.Points(pgeo, pmat);
  motes.name = 'env3d.underwater.particulate';
  motes.frustumCulled = false;
  motes.renderOrder = 906;

  group.add(absorb, scatter, ceil, motes);
  for (const s of shafts) group.add(s);
  if (scene) scene.add(group);

  let depth = 0;
  let lastT = null;

  function setDepth(m) {
    depth = Math.max(0, +m || 0);
    group.visible = depth > 0.001;
    if (!group.visible) return;

    // PHYSICAL (P8/P9), with the one DECORATIVE gain of D5. `transmittance` is the straight-up
    // value, which is what the readout reports; the shell carries the per-direction version.
    transmittance.setRGB(
      Math.exp(-K.r * depth), Math.exp(-K.g * depth), Math.exp(-K.b * depth)
    );
    absorbMat.opacity = 1;      // a multiply shell: the colour IS the tint
    const cAttr = shellGeo.getAttribute('color');
    const ca = cAttr.array;
    for (let i = 0; i < shellDirY.length; i++) {
      const dy = shellDirY[i];
      const L = dy > 1e-3 ? Math.min(L_MAX_M, depth / dy) : L_MAX_M;
      ca[i * 3] = Math.exp(-K.r * L);
      ca[i * 3 + 1] = Math.exp(-K.g * L);
      ca[i * 3 + 2] = Math.exp(-K.b * L);
    }
    cAttr.needsUpdate = true;

    // in-scatter grows as direct transmission falls (DECORATIVE shape, D5)
    const tAvg = (transmittance.r + transmittance.g + transmittance.b) / 3;
    scatterMat.opacity = clamp((1 - tAvg) * 0.30, 0, 0.30);

    // the surface above dims with depth; use the green channel as the "how much light is left" cue
    const lightLeft = Math.exp(-K.g * depth);
    // sqrt, not linear: the real fall-off would make both cues invisible by 15 m, and a scene
    // with no shimmer overhead does not read as underwater. DECORATIVE (D5).
    const lightCue = Math.sqrt(lightLeft);
    ceilMat.uniforms.uOpacity.value = clamp(0.62 * lightCue + 0.06, 0, 0.70);
    shaftMat.opacity = clamp(0.26 * lightCue, 0, 0.26);
    pmat.opacity = clamp(0.20 + 0.45 * (1 - lightLeft), 0, 0.68);

    // Skip layers that have faded to nothing: each one is a near-full-screen blend, which is the
    // expensive thing under a software rasteriser.
    ceil.visible = ceilMat.uniforms.uOpacity.value > 0.015;
    shaftMat.visible = shaftMat.opacity > 0.012;
    for (let i = 0; i < shafts.length; i++) shafts[i].visible = shaftMat.opacity > 0.012;
    scatter.visible = scatterMat.opacity > 0.008;
    motes.visible = pmat.opacity > 0.02;

    motes.position.y = -depth;
  }

  function update(tSeconds) {
    if (!group.visible) { lastT = tSeconds; return; }
    const t = +tSeconds || 0;
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.12);
    lastT = t;

    // caustic drift: writing two uniform vectors costs nothing and allocates nothing (D5)
    ceilMat.uniforms.uA.value.z = t * 0.016;
    ceilMat.uniforms.uA.value.w = t * 0.0104;
    ceilMat.uniforms.uB.value.z = -t * 0.0092;
    ceilMat.uniforms.uB.value.w = t * 0.0191;

    // shafts sway
    for (let i = 0; i < shafts.length; i++) {
      const s = shafts[i];
      s.rotation.z = 0.16 * (i % 2 ? 1 : -1) + 0.06 * Math.sin(t * 0.21 + i);
      s.rotation.x = 0.22 + 0.05 * Math.sin(t * 0.17 + i * 1.7);
    }

    if (dt > 0) {
      for (let i = 0; i < PN; i++) {
        const o = i * 3;
        ppos[o] += pvel[o] * dt;
        ppos[o + 1] += pvel[o + 1] * dt;
        ppos[o + 2] += pvel[o + 2] * dt;
        // wrap inside the box, in place: no allocation, no respawn bookkeeping
        if (ppos[o] > BOX) ppos[o] -= 2 * BOX; else if (ppos[o] < -BOX) ppos[o] += 2 * BOX;
        if (ppos[o + 1] > BOX) ppos[o + 1] -= 2 * BOX; else if (ppos[o + 1] < -BOX) ppos[o + 1] += 2 * BOX;
        if (ppos[o + 2] > BOX) ppos[o + 2] -= 2 * BOX; else if (ppos[o + 2] < -BOX) ppos[o + 2] += 2 * BOX;
      }
      pposAttr.needsUpdate = true;
    }
  }

  function dispose() {
    deepDispose(group);
    if (scene) scene.remove(group);
  }

  setDepth(0);

  return {
    setDepth, update, dispose,
    // optional extras
    group,
    get depth() { return depth; },
    get transmittance() { return transmittance; },
    get info() {
      return {
        module: 'env3d.makeUnderwater',
        model: 'multiply-blended transmittance shell + additive in-scatter + two scrolling caustic ' +
          'layers + swaying light shafts + a wrapped particulate cloud',
        physical: [
          'P8 per-channel transmittance exp(-K*L) with K from pure-water absorption at 450/550/650 nm ' +
          '(0.0092, 0.0565, 0.340 m^-1; Pope & Fry 1997 Appl. Opt. 36:8710 Table 1) — this is why red ' +
          'disappears first',
          'P9 L is the path length along the VIEW DIRECTION (depth/d.y looking up, unbounded looking ' +
          'level or down), so the sea darkens downward for the right reason'
        ],
        decorative: [
          'D5 the 90 m clamp on the view path length; the x3.0 gain applied to those absorption ' +
          'coefficients as a stand-in for clear-ocean K_d ' +
          '(real K_d exceeds absorption because scattering adds); the in-scatter colour and opacity; the ' +
          'caustic and shaft textures and their drift rates; the particulate density and sink speed'
        ],
        depth_m: depth,
        K_used_per_m: { r: K.r, g: K.g, b: K.b },
        K_source: 'pure-water absorption (Pope & Fry 1997) x 3.0 (the x3.0 is decorative)',
        transmittance_rgb: [transmittance.r, transmittance.g, transmittance.b],
        particulate_count: PN,
        does_not_touch: ['scene.fog', 'scene.background']
      };
    }
  };
}

// =======================================================================================
// self-check: the agreement assertion the test page and the headless harness both run
// =======================================================================================

/**
 * Assert that `ocean.heightAt(x, z)` returns the height the mesh actually draws at (x, z).
 *
 * Method, so the check cannot be circular: we take a point from the mesh's own position buffer by
 * linear interpolation inside a cell (`sampleDrawnSurface`) — exactly what the rasteriser draws —
 * and then ask heightAt for the height at that point's world (x, z). The buffer is the only input
 * to the "drawn" side; the wave maths is the only input to the heightAt side.
 *
 *  - at a VERTEX the two must agree to the inversion's residual (~1e-9 m); tolerance 1e-5 m.
 *  - INSIDE a cell the flat triangle departs from the curved surface by at most
 *    sum(a_i k_i^2) h^2 / 8, so the tolerance is 2x that bound (and at least 0.2 mm). Raising the
 *    wind raises the bound, so the tolerance stays honest instead of being loosened by hand.
 *
 * @returns {{pass, vertex:{n,max_error_m,tolerance_m,pass}, interior:{...}, bound_m}}
 */
export function checkOceanAgreement(ocean, { samples = 400, seed = 12345 } = {}) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const seg = ocean.segments;
  const bound = ocean.discretisationBound();
  const tolV = 1e-5;
  const tolI = Math.max(2e-4, 2 * bound);

  let maxV = 0, maxI = 0, nV = 0, nI = 0;
  let worstV = null, worstI = null;
  for (let q = 0; q < samples; q++) {
    const ix = Math.min(seg - 1, Math.floor(rnd() * seg));
    const iz = Math.min(seg - 1, Math.floor(rnd() * seg));
    const atVertex = (q % 2) === 0;
    const bu = atVertex ? (rnd() < 0.5 ? 0 : 1) : 0.15 + rnd() * 0.7;
    const bv = atVertex ? (rnd() < 0.5 ? 0 : 1) : 0.15 + rnd() * 0.7;
    const d = ocean.sampleDrawnSurface(ix, iz, bu, bv);
    const dx = d.x, dy = d.y, dz = d.z;
    const h = ocean.heightAt(dx, dz);
    const e = Math.abs(h - dy);
    if (atVertex) {
      nV++;
      if (e > maxV) { maxV = e; worstV = { x: dx, z: dz, drawn: dy, heightAt: h }; }
    } else {
      nI++;
      if (e > maxI) { maxI = e; worstI = { x: dx, z: dz, drawn: dy, heightAt: h }; }
    }
  }
  const vertex = { n: nV, max_error_m: maxV, tolerance_m: tolV, pass: maxV <= tolV, worst: worstV };
  const interior = { n: nI, max_error_m: maxI, tolerance_m: tolI, pass: maxI <= tolI, worst: worstI };
  return {
    pass: vertex.pass && interior.pass,
    vertex, interior,
    bound_m: bound,
    method: 'drawn height read from the mesh position buffer by linear interpolation in a cell; ' +
      'heightAt queried at that point world (x, z)'
  };
}

export default { makeOcean, makeSky, makeSpray, makeUnderwater, checkOceanAgreement, readConditions, piersonMoskowitz, G, RECOMMENDED_CAMERA_FAR };
