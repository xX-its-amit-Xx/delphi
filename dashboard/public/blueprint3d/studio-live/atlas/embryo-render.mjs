// PROVENANCE OF THIS FILE
// Written by a Gemini agent (gemini-4-argon-high, via Antigravity's CLI) on 2026-11-08 against the brief in
// tracks/ of this repo's history, then reviewed here before being wired in: the module was read, its
// preview render was looked at, the radii were confirmed to be applied at measured scale with no
// exaggeration factor, and it was run headless in the atlas. It draws; it asserts nothing. The data it
// draws and every caveat about that data live in sim-engine/scales/atlas/embryo-divisions.mjs.

/**
 * High-quality single-pass Three.js renderer for the measured zebrafish embryo
 * (IDR idr0068 / Shah et al. 2019 endoderm light-sheet recording, 222,071 nuclei across 420 frames).
 *
 * Renders every detection as a 3D sphere at its measured radius using a single pre-sized
 * THREE.InstancedMesh with zero per-frame heap allocations. Depth and volume are achieved in
 * a single pass via a custom GLSL shader combining:
 *   1. View-locked 3-point studio lighting + world hemisphere fill (so every viewing angle is well-sculpted)
 *   2. Per-sphere grazing contour darkening + inner Fresnel bioluminescent rim (separates overlapping spheres)
 *   3. Dual-lobe Blinn-Phong specular highlight on the front hemisphere
 *   4. View-aligned macro depth extinction & cool atmospheric desaturation across the embryo diameter
 *   5. Per-frame O(N) spatial-hash local crowding ambient occlusion
 *   6. Per-instance colour ramp driven by measured nuclear radius (#4ec9a0 -> #6aa9ff -> #b48ef5 -> #bf8410)
 */

/** IEEE 754 half-precision (binary16) fallback decoder for environments without Float16Array. */
function decodeFloat16Fallback(u16) {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i];
    const s = (h & 0x8000) ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x03ff;
    if (e === 0) {
      out[i] = s * 6.103515625e-5 * (f / 1024);
    } else if (e === 0x1f) {
      out[i] = f ? NaN : s * Infinity;
    } else {
      out[i] = s * Math.pow(2, e - 15) * (1 + f / 1024);
    }
  }
  return out;
}

/**
 * Normalise the `nuclei` input into a flat Float32Array of [x, y, z, r, ...] values.
 * Uses native Float16Array when available (Node 24+ and modern browsers).
 */
function toFloat32Nuclei(nuclei) {
  if (!nuclei) throw new Error('createEmbryo: missing `nuclei` buffer');
  if (nuclei instanceof Float32Array) return nuclei;
  if (typeof Float16Array !== 'undefined') {
    if (nuclei instanceof Float16Array) return new Float32Array(nuclei);
    if (nuclei instanceof ArrayBuffer) return new Float32Array(new Float16Array(nuclei));
    if (ArrayBuffer.isView(nuclei)) {
      return new Float32Array(
        new Float16Array(nuclei.buffer, nuclei.byteOffset, nuclei.byteLength >>> 1)
      );
    }
  }
  if (nuclei instanceof ArrayBuffer) return decodeFloat16Fallback(new Uint16Array(nuclei));
  if (ArrayBuffer.isView(nuclei)) {
    return decodeFloat16Fallback(
      new Uint16Array(nuclei.buffer, nuclei.byteOffset, nuclei.byteLength >>> 1)
    );
  }
  throw new Error('createEmbryo: unsupported `nuclei` input type');
}

/**
 * Palette stops matching the DELPHI dark-surface specification:
 *   #4ec9a0 (green, near regularisation floor)
 *   #6aa9ff (blue, moderate fitted radius)
 *   #b48ef5 (purple, large fitted radius)
 *   #bf8410 (amber, largest / mitotic nuclei, slightly lifted for contrast on #080b11)
 */
const PALETTE_STOPS = [
  [0.00, 0x4e / 255, 0xc9 / 255, 0xa0 / 255], // #4ec9a0 emerald green (floor & compact nuclei)
  [0.42, 0x6a / 255, 0xa9 / 255, 0xff / 255], // #6aa9ff cerulean blue (intermediate fitted nuclei)
  [0.74, 0xb4 / 255, 0x8e / 255, 0xf5 / 255], // #b48ef5 violet purple (large fitted nuclei)
  [1.00, 0xdf / 255, 0x9b / 255, 0x18 / 255], // #bf8410 warm amber (largest / mitotic nuclei, lifted for dark bg)
];

/** Sample the 4-stop palette into `out` at offset `off` for normalised parameter `t` in [0, 1]. */
function samplePalette(t, variation, out, off) {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  let s0 = PALETTE_STOPS[0];
  let s1 = PALETTE_STOPS[PALETTE_STOPS.length - 1];
  for (let i = 0; i < PALETTE_STOPS.length - 1; i++) {
    if (c <= PALETTE_STOPS[i + 1][0]) {
      s0 = PALETTE_STOPS[i];
      s1 = PALETTE_STOPS[i + 1];
      break;
    }
  }
  const span = s1[0] - s0[0];
  const u = span > 0 ? (c - s0[0]) / span : 0;
  // Smoothstep interpolation between stops
  const k = u * u * (3 - 2 * u);
  const v = 1 + variation;
  out[off]     = Math.min(1, Math.max(0, (s0[1] + (s1[1] - s0[1]) * k) * v));
  out[off + 1] = Math.min(1, Math.max(0, (s0[2] + (s1[2] - s0[2]) * k) * v));
  out[off + 2] = Math.min(1, Math.max(0, (s0[3] + (s1[3] - s0[3]) * k) * v));
}

const VERTEX_SHADER = /* glsl */ `
  // Per-instance packed metadata:
  //   x = normalised radius in [0, 1]
  //   y = local neighbourhood ambient occlusion in [0.55, 1.0]
  //   z = radial shell depth relative to yolk surface in [0, 1]
  attribute vec3 aInstanceMeta;

  uniform vec3 uEmbryoCenter;
  uniform float uEmbryoRadius;

  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  varying vec3 vViewDir;
  varying vec3 vColor;
  varying float vDepthZ;
  varying float vRadialDist;
  varying float vRadiusNorm;
  varying float vLocalAO;
  varying float vShellDepth;

  void main() {
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(0.306, 0.788, 0.627);
    #endif

    vRadiusNorm = aInstanceMeta.x;
    vLocalAO = aInstanceMeta.y;
    vShellDepth = aInstanceMeta.z;

    // Extract instance centre in local group space from column 3 of instanceMatrix
    vec3 instanceCenter = instanceMatrix[3].xyz;
    vec4 localPos = instanceMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * localPos;
    gl_Position = projectionMatrix * mvPosition;

    // Since each instance matrix is a uniform scale + translation, transforming the unit sphere
    // normal by mat3(modelViewMatrix) preserves direction without needing an inverse-transpose per instance.
    vNormalView = normalize(mat3(modelViewMatrix) * normal);
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(-mvPosition.xyz);

    // Compute view-aligned macro depth of this nucleus relative to the embryo's fitted centre.
    // In Three.js view space, +Z points toward the camera and -Z points away into the screen.
    // Dividing by uEmbryoRadius yields vDepthZ in roughly [-1, +1] regardless of camera zoom or orbit.
    vec3 centerView = (modelViewMatrix * vec4(uEmbryoCenter, 1.0)).xyz;
    vec3 cellCenterView = (modelViewMatrix * vec4(instanceCenter, 1.0)).xyz;
    vec3 relView = cellCenterView - centerView;
    vDepthZ = clamp(relView.z / max(0.001, uEmbryoRadius), -1.25, 1.25);
    vRadialDist = length(relView.xy) / max(0.001, uEmbryoRadius);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec3 uFogColor;

  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  varying vec3 vViewDir;
  varying vec3 vColor;
  varying float vDepthZ;
  varying float vRadialDist;
  varying float vRadiusNorm;
  varying float vLocalAO;
  varying float vShellDepth;

  void main() {
    vec3 N = normalize(vNormalView);
    vec3 V = normalize(vViewDir);
    float NdotV = clamp(dot(N, V), 0.0, 1.0);

    // --- 1. View-locked 3-point studio lighting + subtle world hemisphere cue ---
    // Key light from upper-left front; fill from lower-right; rim from upper-back.
    vec3 Lkey  = normalize(vec3(-0.52,  0.64,  0.56));
    vec3 Lfill = normalize(vec3( 0.68, -0.40,  0.61));
    vec3 Lrim  = normalize(vec3( 0.12,  0.58, -0.80));

    // Wrapped diffuse on the key light gives each nucleus a full, rounded 3D terminator
    float diffKey  = clamp((dot(N, Lkey) + 0.24) / 1.24, 0.0, 1.0);
    diffKey = pow(diffKey, 1.18);
    float diffFill = clamp((dot(N, Lfill) + 0.15) / 1.15, 0.0, 1.0);
    float diffRim  = clamp(dot(N, Lrim), 0.0, 1.0);

    // Subtle world-space vertical hemisphere gradient so orbiting feels anchored in 3D space
    float worldHemi = 0.5 + 0.5 * clamp(vNormalWorld.y, -1.0, 1.0);

    // --- 2. Subsurface core transmission & per-sphere silhouette contour ---
    // Light-sheet fluorescence nuclei appear brightest through their centre (NdotV^1.35)
    // and have a crisp dark grazing contour at NdotV -> 0 that visually separates overlapping
    // spheres of the same colour without post-processing.
    float coreGlow = pow(NdotV, 1.35);
    float silhouetteContour = mix(0.20, 1.0, smoothstep(0.0, 0.30, NdotV));

    // Inner Fresnel rim: peaks just inside the silhouette on the key-lit side
    float fresnel = pow(1.0 - NdotV, 2.4) * smoothstep(0.0, 0.24, NdotV);
    float litFresnel = fresnel * (0.35 + 0.65 * diffKey + 0.45 * diffRim);

    // --- 3. Dual-lobe specular highlight (tight wet gloss + broad chromatin sheen) ---
    vec3 Hkey = normalize(Lkey + V);
    float NdotH = max(dot(N, Hkey), 0.0);
    // Larger nuclei get a slightly stronger highlight to reinforce their physical volume
    float sizeSpecBoost = 0.85 + 0.35 * vRadiusNorm;
    float specTight = pow(NdotH, 44.0) * 0.46 * sizeSpecBoost;
    float specBroad = pow(NdotH, 10.0) * 0.13 * sizeSpecBoost;

    // --- 4. Combine local sphere shading ---
    vec3 shadowTint = vColor * vec3(0.14, 0.17, 0.24);
    vec3 litColor = vColor * (
      0.16 +
      0.76 * diffKey +
      0.18 * diffFill * vec3(0.82, 0.92, 1.08) +
      0.20 * coreGlow +
      0.08 * worldHemi
    );
    vec3 shaded = mix(shadowTint, litColor, smoothstep(0.0, 0.85, diffKey + 0.35 * coreGlow));

    // Add Fresnel rim tint (shifted slightly toward luminous cyan/white or warm gold for large cells)
    vec3 rimTint = mix(vColor * 1.35 + vec3(0.10, 0.18, 0.22), vec3(1.0, 0.90, 0.68), vRadiusNorm * 0.6);
    shaded += rimTint * litFresnel * 0.42;

    // Apply grazing contour darkening and local neighbourhood + radial shell ambient occlusion
    float shellFactor = 0.84 + 0.16 * vShellDepth;
    shaded *= silhouetteContour * vLocalAO * shellFactor;

    // --- 5. Macro front-to-back depth cueing across the embryo ball ---
    // vDepthZ is in [-1, +1]: +1 is closest to camera, -1 is the far back wall of the embryo cup.
    float frontMask = smoothstep(-0.95, 0.68, vDepthZ);
    float backness = 1.0 - frontMask;
    float specDepthMask = smoothstep(-0.25, 0.50, vDepthZ);

    // Shift receding back-hemisphere nuclei toward a cool deep-water slate-blue while preserving
    // their spherical diffuse gradient and contour so the back wall still reads as 3D spheres.
    vec3 coolDepthSphere = vec3(0.22, 0.40, 0.66) * (0.30 + 0.70 * diffKey + 0.28 * coreGlow) * silhouetteContour * vLocalAO;
    shaded = mix(shaded, coolDepthSphere, backness * 0.48);

    // Add specular after contour/AO, masked strongly to the front hemisphere so back-wall nuclei
    // recede quietly instead of sparkling through the front sheet.
    vec3 specColor = mix(vec3(0.88, 0.96, 1.0), vec3(1.0, 0.95, 0.82), vRadiusNorm);
    shaded += specColor * (specTight + specBroad) * specDepthMask * silhouetteContour;

    // Front-to-back brightness & subtle atmospheric extinction into #080b11:
    float depthGain = mix(0.54, 1.16, frontMask);
    shaded *= depthGain;

    vec3 deepInteriorTint = uFogColor + vec3(0.025, 0.050, 0.095);
    float fogAmount = pow(backness, 1.65) * 0.24;
    shaded = mix(shaded, deepInteriorTint, fogAmount);

    gl_FragColor = vec4(shaded, 1.0);
  }
`;

/**
 * Create the measured zebrafish embryo renderer.
 *
 * @param {object} THREE - The Three.js r160 namespace passed by the host page.
 * @param {object} options
 * @param {ArrayBuffer|TypedArray} options.nuclei - Float16 (or Float32) buffer of 4 values per detection: x, y, z, r.
 * @param {object} options.manifest - Companion JSON manifest containing `index: [{offset, count}, ...]`.
 * @param {number} [options.scale=26] - World-space radius multiplier for the normalised unit ball.
 */
export function createEmbryo(THREE, { nuclei, manifest, scale = 26 } = {}) {
  if (!THREE) throw new Error('createEmbryo: THREE namespace is required as the first argument');

  const raw = toFloat32Nuclei(nuclei);
  const index =
    manifest?.index ??
    manifest?.cloud?.index ??
    manifest?.manifest?.index ??
    (Array.isArray(manifest) ? manifest : null);

  if (!index || !index.length) {
    throw new Error('createEmbryo: manifest must provide a non-empty `index` array of {offset, count}');
  }

  const totalDetections = raw.length >>> 2;
  const frameCount = index.length;
  let maxCount = 0;
  for (let f = 0; f < frameCount; f++) {
    if (index[f].count > maxCount) maxCount = index[f].count;
  }
  maxCount = Math.max(1, maxCount);

  // Measure radius distribution and fitted yolk centre once at load time.
  // The endoderm sheet wraps around a spherical yolk whose centre is near (-0.055, 0.077, 0.025)
  // in normalised coordinates with median radial shell distance ~0.467.
  const yolkCenterNorm = [-0.0552, 0.0772, 0.0247];
  const rMin = manifest?.radius?.drawn_normalised?.min ?? 0.0058512;
  // 98.5th percentile radius (~0.0124) anchors the main ramp; larger mitotic cells saturate into amber.
  const rRampSpan = 0.0124 - rMin;

  // Precompute per-detection colour (RGB), normalised radius, and radial shell depth once
  // so setFrame(f) only copies numbers and updates a tiny 16^3 density grid with zero allocations.
  const detColors = new Float32Array(totalDetections * 3);
  const detRadiusNorm = new Float32Array(totalDetections);
  const detShellDepth = new Float32Array(totalDetections);

  for (let i = 0; i < totalDetections; i++) {
    const k = i * 4;
    const x = raw[k];
    const y = raw[k + 1];
    const z = raw[k + 2];
    const r = raw[k + 3];

    // Non-linear power curve (exponent 0.70) spreads the 0.00585..0.0095 range across
    // green -> blue -> purple while reserving warm amber for the largest nuclei (r >= 0.0098..0.0195).
    const lin = Math.max(0, Math.min(1, (r - rMin) / rRampSpan));
    const tR = Math.pow(lin, 0.70);
    detRadiusNorm[i] = tR;

    // Subtle deterministic spatial micro-variation (±3%) so floor-radius neighbours don't band
    const hash = Math.sin(x * 91.7 + y * 137.3 + z * 193.1) * 0.03;
    samplePalette(tR, hash, detColors, i * 3);

    // Distance from the fitted yolk centre: inner sheet (~0.41) -> 0, outer sheet (~0.53) -> 1
    const dy = Math.hypot(x - yolkCenterNorm[0], y - yolkCenterNorm[1], z - yolkCenterNorm[2]);
    detShellDepth[i] = Math.max(0, Math.min(1, (dy - 0.40) / 0.14));
  }

  const group = new THREE.Group();
  group.name = 'measured-embryo';

  const embryoCenterWorld = new THREE.Vector3(0, 0, 0);
  const embryoRadiusUniform = { value: 0.50 * scale };

  // --- Single pre-sized InstancedMesh for all nuclei ---
  // 20x14 segments gives smooth spherical silhouettes while keeping the vertex count low (~300 verts/sphere)
  // so 570-939 instances render in a single draw call well above 60 fps.
  const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
  const metaArray = new Float32Array(maxCount * 3);
  const metaAttr = new THREE.InstancedBufferAttribute(metaArray, 3);
  metaAttr.setUsage(THREE.DynamicDrawUsage);
  sphereGeo.setAttribute('aInstanceMeta', metaAttr);

  const nucleiMat = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uEmbryoCenter: { value: embryoCenterWorld },
      uEmbryoRadius: embryoRadiusUniform,
      uFogColor: { value: new THREE.Color(0x080b11) },
    },
    transparent: false,
    depthTest: true,
    depthWrite: true,
  });

  const instancedMesh = new THREE.InstancedMesh(sphereGeo, nucleiMat, maxCount);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Ensure instanceColor buffer exists and is marked for dynamic updates
  const colorArray = new Float32Array(maxCount * 3);
  instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
  instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

  // Pre-initialise the 4x4 identity structure of instanceMatrix so setFrame() only writes
  // the 3 diagonal scale entries and 3 translation entries per active instance.
  const matArray = instancedMesh.instanceMatrix.array;
  for (let i = 0; i < maxCount; i++) {
    const b = i * 16;
    matArray.fill(0, b, b + 16);
    matArray[b + 15] = 1;
  }

  // Provide an accurate bounding sphere/box covering the embryo across all frames so camera-fitting
  // helpers (such as Box3.setFromObject in Atlas) frame the whole embryo consistently even at frame 0.
  const boundR = 0.60 * scale;
  instancedMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), boundR);
  instancedMesh.boundingBox = new THREE.Box3(
    new THREE.Vector3(-boundR, -boundR, -boundR),
    new THREE.Vector3(boundR, boundR, boundR)
  );
  instancedMesh.computeBoundingBox = function () {};
  instancedMesh.computeBoundingSphere = function () {};

  group.add(instancedMesh);

  // Preallocated 16x16x16 spatial hash grid for fast O(N) per-frame neighbourhood crowding AO.
  // Zero allocations inside setFrame().
  const GRID_N = 16;
  const GRID_MIN = -0.68;
  const GRID_INV_SPAN = GRID_N / (0.68 - GRID_MIN);
  const densityGrid = new Uint16Array(GRID_N * GRID_N * GRID_N);
  const cellVoxelIdx = new Int32Array(maxCount);

  let currentFrame = -1;

  /**
   * Update the instanced mesh to display frame `f`.
   * Zero object allocations; updates instanceMatrix, instanceColor, and aInstanceMeta in place.
   */
  function setFrame(f) {
    const clamped = Math.max(0, Math.min(frameCount - 1, Math.round(Number(f) || 0)));
    if (clamped === currentFrame) return;
    currentFrame = clamped;

    const { offset, count } = index[clamped];
    const n = Math.min(count, maxCount);

    // Pass 1: Bin active nuclei into the 16^3 spatial grid and accumulate frame centroid
    densityGrid.fill(0);
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    for (let i = 0; i < n; i++) {
      const detIdx = offset + i;
      const k = detIdx * 4;
      const x = raw[k];
      const y = raw[k + 1];
      const z = raw[k + 2];
      sumX += x;
      sumY += y;
      sumZ += z;
      const gx = Math.max(0, Math.min(GRID_N - 1, ((x - GRID_MIN) * GRID_INV_SPAN) | 0));
      const gy = Math.max(0, Math.min(GRID_N - 1, ((y - GRID_MIN) * GRID_INV_SPAN) | 0));
      const gz = Math.max(0, Math.min(GRID_N - 1, ((z - GRID_MIN) * GRID_INV_SPAN) | 0));
      const vIdx = (gx << 8) | (gy << 4) | gz;
      cellVoxelIdx[i] = vIdx;
      densityGrid[vIdx]++;
    }

    const invN = n > 0 ? 1 / n : 0;
    const cx = sumX * invN;
    const cy = sumY * invN;
    const cz = sumZ * invN;
    embryoCenterWorld.set(cx * scale, cy * scale, cz * scale);

    // Pass 2: Populate instanceMatrix, instanceColor, and aInstanceMeta for each nucleus in frame
    let rmsDistSq = 0;
    for (let i = 0; i < n; i++) {
      const detIdx = offset + i;
      const k = detIdx * 4;
      const x = raw[k];
      const y = raw[k + 1];
      const z = raw[k + 2];
      const dx = x - cx;
      const dy = y - cy;
      const dz = z - cz;
      rmsDistSq += dx * dx + dy * dy + dz * dz;

      const xw = x * scale;
      const yw = y * scale;
      const zw = z * scale;
      // Measured radius in the same normalised units as x/y/z, scaled to world space
      const rw = Math.max(1e-4, raw[k + 3] * scale);

      const mBase = i * 16;
      matArray[mBase]      = rw;
      matArray[mBase + 5]  = rw;
      matArray[mBase + 10] = rw;
      matArray[mBase + 12] = xw;
      matArray[mBase + 13] = yw;
      matArray[mBase + 14] = zw;

      const cSrc = detIdx * 3;
      const cDst = i * 3;
      colorArray[cDst]     = detColors[cSrc];
      colorArray[cDst + 1] = detColors[cSrc + 1];
      colorArray[cDst + 2] = detColors[cSrc + 2];

      // Local crowding AO from the 6 face-adjacent + centre voxels in the spatial grid
      const vIdx = cellVoxelIdx[i];
      let localCount = densityGrid[vIdx];
      if ((vIdx & 15) > 0)          localCount += densityGrid[vIdx - 1] * 0.5;
      if ((vIdx & 15) < 15)         localCount += densityGrid[vIdx + 1] * 0.5;
      if (((vIdx >> 4) & 15) > 0)   localCount += densityGrid[vIdx - 16] * 0.5;
      if (((vIdx >> 4) & 15) < 15)  localCount += densityGrid[vIdx + 16] * 0.5;
      if ((vIdx >> 8) > 0)          localCount += densityGrid[vIdx - 256] * 0.5;
      if ((vIdx >> 8) < 15)         localCount += densityGrid[vIdx + 256] * 0.5;

      const ao = Math.max(0.68, Math.min(1.0, 1.04 - (localCount - 1) * 0.032));
      metaArray[cDst]     = detRadiusNorm[detIdx];
      metaArray[cDst + 1] = ao;
      metaArray[cDst + 2] = detShellDepth[detIdx];
    }

    // Update effective depth radius from the active frame's spatial spread
    const rmsDist = n > 0 ? Math.sqrt(rmsDistSq * invN) : 0.45;
    embryoRadiusUniform.value = Math.max(0.28, rmsDist * 1.15) * scale;

    instancedMesh.count = n;
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
    metaAttr.needsUpdate = true;
  }

  // Initialise to frame 0 so the mesh is immediately valid even before the host calls setFrame()
  setFrame(0);

  function dispose() {
    sphereGeo.dispose();
    nucleiMat.dispose();
  }

  return {
    group,
    mesh: instancedMesh,
    frameCount,
    maxCount,
    setFrame,
    dispose,
  };
}
