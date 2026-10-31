// morphogen_diffusion: steady-state reaction-diffusion of a morphogen on a 2D or 3D fin-bud domain.
//
//   dC/dt = D grad^2 C - k C + S(x)      solved to steady state
//
// Finite differences on a uniform grid, Neumann (zero-flux) boundaries by default, because a fin bud
// is a closed piece of tissue rather than a window onto a larger one. Solved by Gauss-Seidel with
// over-relaxation: the steady state is wanted, not the transient, so time stepping would only be a
// slower way to reach the same answer.
//
// The gradient length lambda = sqrt(D/k) is the quantity this is really for. Everything else is
// geometry.

import { envelope, p, fromParam, param } from '../lib/provenance.mjs';

const LN2 = Math.log(2);

// Grid helpers for an arbitrary number of dimensions, so 2D and 3D share one solver.
const strides = dims => dims.map((_, i) => dims.slice(i + 1).reduce((a, b) => a * b, 1));
const toIndex = (coord, st) => coord.reduce((s, c, i) => s + c * st[i], 0);
function* cells(dims) {
  const c = dims.map(() => 0);
  for (;;) {
    yield c;
    let d = dims.length - 1;
    while (d >= 0 && ++c[d] === dims[d]) c[d--] = 0;
    if (d < 0) return;
  }
}

export function solve({
  dims = [80, 80],           // grid cells per axis; axis 0 is anteroposterior, axis 1 dorsoventral
  spacing_um = 2.5,          // grid spacing h
  D_um2_s,                   // diffusion coefficient
  k_s = null,                // first-order clearance; or give half_life_min
  half_life_min = null,
  source,                    // { axis, from, to, rate } OR a function(coord) -> production
  boundary = 'no-flux',      // 'no-flux' | 'absorbing'
  tol = 1e-7,   // RELATIVE to the peak; see the convergence note below
  maxIter = 60000,
} = {}) {
  if (!D_um2_s || D_um2_s <= 0) throw new Error('D_um2_s must be positive');
  if (k_s == null && half_life_min == null) throw new Error('give k_s or half_life_min');
  const k = k_s != null ? k_s : LN2 / (half_life_min * 60);
  if (k <= 0) throw new Error('clearance must be positive, or there is no steady state');

  const h = spacing_um, n = dims.reduce((a, b) => a * b, 1), st = strides(dims);
  const C = new Float64Array(n), S = new Float64Array(n);

  // Production. A plain object describes the common case: a slab of cells at one end of one axis,
  // which is how both the ZPA (posterior) and the AER (distal margin) are usually drawn.
  if (typeof source === 'function') {
    for (const c of cells(dims)) S[toIndex(c, st)] = source([...c]) || 0;
  } else if (source) {
    const { axis = 0, from = 0, to = 2, rate = 1 } = source;
    for (const c of cells(dims)) if (c[axis] >= from && c[axis] < to) S[toIndex(c, st)] = rate;
  } else throw new Error('a source is required: with no production the steady state is zero everywhere');

  const d2 = D_um2_s / (h * h);
  const omega = 1.7; // over-relaxation; plain Gauss-Seidel is omega = 1

  // Tolerance is RELATIVE to the current peak. An absolute tolerance is meaningless here because the
  // steady-state amplitude scales as production/k, so the same absolute residual is loose for a fast
  // clearance and unreachable for a slow one. Getting this wrong reports "not converged" on a field
  // that has in fact settled, which is how a solver quietly becomes untrustworthy.
  let iter = 0, resid = Infinity, scale = 1;
  for (; iter < maxIter; iter++) {
    resid = 0;
    for (const c of cells(dims)) {
      const i = toIndex(c, st);
      let sum = 0, count = 0;
      for (let d = 0; d < dims.length; d++) {
        for (const step of [-1, 1]) {
          const q = c[d] + step;
          if (q >= 0 && q < dims[d]) { sum += C[i + step * st[d]]; count++; }
          else if (boundary === 'no-flux') { sum += C[i]; count++; }   // mirror: zero gradient
          else count++;                                                // absorbing: neighbour is 0
        }
      }
      const next = (d2 * sum + S[i]) / (d2 * count + k);
      const upd = C[i] + omega * (next - C[i]);
      resid = Math.max(resid, Math.abs(upd - C[i]));
      C[i] = upd;
    }
    scale = 0;
    for (let i = 0; i < n; i++) if (C[i] > scale) scale = C[i];
    if (scale > 0 && resid / scale < tol) break;
  }

  const lambda = Math.sqrt(D_um2_s / k);
  let max = 0;
  for (let i = 0; i < n; i++) if (C[i] > max) max = C[i];
  const relResidual = max > 0 ? resid / max : resid;
  return { C, dims, spacing_um: h, k_s: k, lambda_um: lambda, iterations: iter,
           residual: resid, relative_residual: relResidual, converged: relResidual < tol, max, strides: st };
}

// Area (2D) or volume (3D) of the region above a threshold, and its extent along each axis. The
// extents are what the hhip test needs: the measurement distinguishes D/V from A/P.
export function supraThreshold(field, theta) {
  const { C, dims, spacing_um: h } = field;
  const st = field.strides;
  let count = 0;
  const lo = dims.map(() => Infinity), hi = dims.map(() => -Infinity);
  for (const c of cells(dims)) {
    if (C[toIndex(c, st)] < theta) continue;
    count++;
    for (let d = 0; d < dims.length; d++) { if (c[d] < lo[d]) lo[d] = c[d]; if (c[d] > hi[d]) hi[d] = c[d]; }
  }
  const cellMeasure = Math.pow(h, dims.length);
  return {
    cells: count,
    measure: count * cellMeasure,
    measure_unit: dims.length === 2 ? 'um^2' : 'um^3',
    extent_um: dims.map((_, d) => (count ? (hi[d] - lo[d] + 1) * h : 0)),
  };
}

// Choose theta so the supra-threshold measure equals a target. This is CALIBRATION, never a result:
// it is how the model is given a scale, and the envelope labels it so.
export function calibrateThreshold(field, targetMeasure) {
  let lo = 0, hi = field.max;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (supraThreshold(field, mid).measure > targetMeasure) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── MCP tool entry point ────────────────────────────────────────────────────
export const schema = {
  title: 'Morphogen reaction-diffusion on a fin-bud domain',
  description:
    'Steady-state reaction-diffusion of one morphogen on a 2D or 3D rectangular domain standing for a pectoral fin bud, with a source region (ZPA Shh or AER Fgf). Returns the concentration field, its gradient length lambda = sqrt(D/k), and the size of the region above a threshold. Diffusion constants default to FETCHED zebrafish FCS measurements; a Shh source borrows the Fgf8 coefficient because no measured zebrafish Shh value was found, and says so.',
  inputSchema: {
    type: 'object',
    properties: {
      morphogen: { type: 'string', enum: ['fgf', 'shh', 'custom'], default: 'fgf',
        description: 'fgf uses the measured Fgf8a fast-fraction coefficient. shh uses the same number, labelled borrowed. custom requires D_um2_s.' },
      D_um2_s: { type: 'number', description: 'Overrides the fetched coefficient. Labelled assumed when given.' },
      half_life_min: { type: 'number', description: 'Overrides the fetched 9 min residence time. Labelled assumed when given.' },
      dims: { type: 'array', items: { type: 'integer', minimum: 4, maximum: 400 }, minItems: 2, maxItems: 3,
        default: [80, 80], description: 'Grid cells per axis. Axis 0 anteroposterior, axis 1 dorsoventral, axis 2 proximodistal if 3D.' },
      spacing_um: { type: 'number', default: 2.5, description: 'Grid spacing in micrometres.' },
      source: { type: 'object', description: 'Production slab: { axis, from, to, rate }.',
        properties: { axis: { type: 'integer' }, from: { type: 'integer' }, to: { type: 'integer' }, rate: { type: 'number' } } },
      boundary: { type: 'string', enum: ['no-flux', 'absorbing'], default: 'no-flux' },
      threshold_fraction: { type: 'number', default: 0.1,
        description: 'Report the region above this fraction of the peak concentration.' },
      return_field: { type: 'boolean', default: false,
        description: 'Include the full concentration field. Off by default because it is large.' },
    },
  },
};

export function run(args = {}) {
  const morphogen = args.morphogen || 'fgf';
  const prov = [];

  let D;
  if (args.D_um2_s != null) {
    D = args.D_um2_s;
    prov.push(p('diffusion coefficient D', D, 'assumed', 'supplied by the caller, overriding the fetched value', { unit: 'um^2/s' }));
  } else if (morphogen === 'shh') {
    D = param('fgf8a-D-fast-endogenous').value;
    prov.push(fromParam('fgf8a-D-fast-endogenous', { as: 'diffusion coefficient D used for a Shh source', kind: 'borrowed' }));
    prov.push(p('Shh diffusion coefficient in a fin bud', null, 'assumed',
      param('shh-D-finbud').source, { note: 'No measured value exists in this engine; the Fgf8a coefficient above was borrowed in its place.' }));
  } else {
    D = param('fgf8a-D-fast-endogenous').value;
    prov.push(fromParam('fgf8a-D-fast-endogenous', { as: 'diffusion coefficient D' }));
  }

  let halfLife;
  if (args.half_life_min != null) {
    halfLife = args.half_life_min;
    prov.push(p('clearance half-life', halfLife, 'assumed', 'supplied by the caller', { unit: 'min' }));
  } else {
    halfLife = param('fgf8-residence-time').value;
    prov.push(fromParam('fgf8-residence-time', { as: 'clearance half-life' }));
  }

  const dims = args.dims || [80, 80];
  const spacing_um = args.spacing_um ?? 2.5;
  prov.push(p('domain geometry', { dims, spacing_um, size_um: dims.map(d => d * spacing_um) }, 'assumed',
    'No measurement of zebrafish pectoral fin-bud dimensions was fetched; the domain is a rectangle chosen by the caller.'));

  const source = args.source || { axis: 0, from: 0, to: 2, rate: 1 };
  prov.push(p('source region', source, 'assumed',
    'Standing for the ZPA (posterior strip) or AER (distal margin). No measurement of its extent at 72 hpf was fetched.'));

  const field = solve({ dims, spacing_um, D_um2_s: D, half_life_min: halfLife, source, boundary: args.boundary || 'no-flux' });
  prov.push(p('gradient length lambda = sqrt(D/k)', field.lambda_um, 'derived',
    'Computed from the D and half-life above.', { unit: 'um' }));

  // Independent check against the separately reported gradient length, when the fetched defaults are in use.
  let lambdaCheck = null;
  if (args.D_um2_s == null && args.half_life_min == null) {
    const reported = param('fgf8-gradient-length-reported').value;
    lambdaCheck = { reported_um: reported, computed_um: field.lambda_um,
      relative_difference: Math.abs(field.lambda_um - reported) / reported };
    prov.push(fromParam('fgf8-gradient-length-reported', { as: 'independently reported gradient length, used as a check' }));
  }

  const theta = field.max * (args.threshold_fraction ?? 0.1);
  const region = supraThreshold(field, theta);

  const domain_um = dims.map(d => d * spacing_um);
  const result = {
    morphogen,
    D_um2_s: D,
    half_life_min: halfLife,
    k_s: field.k_s,
    lambda_um: field.lambda_um,
    lambda_vs_domain: field.lambda_um / Math.max(...domain_um),
    domain_um,
    converged: field.converged,
    iterations: field.iterations,
    peak_concentration: field.max,
    threshold: theta,
    supra_threshold: region,
    lambda_check: lambdaCheck,
    ...(args.return_field ? { field: Array.from(field.C) } : {}),
  };

  const shallow = result.lambda_vs_domain > 1;
  return envelope(result, prov,
    'A steady-state concentration field on an assumed rectangular domain, not a fin. It says nothing about ' +
    'what any cell does in response, about growth, or about time: the transient was not solved. The ' +
    'coefficient is measured in a zebrafish GASTRULA, so using it at 72 hpf is an extrapolation of about ' +
    'sixty hours and the wrong tissue. ' +
    (morphogen === 'shh' ? 'For Shh it is additionally borrowed from a different molecule, which is this result\'s largest assumption. ' : '') +
    (shallow ? `Here lambda (${field.lambda_um.toFixed(0)} um) exceeds the domain (${Math.max(...domain_um).toFixed(0)} um), so the gradient is shallow across the bud and the supra-threshold region is set largely by geometry rather than by decay. ` : '') +
    'A source-sink model is only one of two live hypotheses for Fgf8; hindered diffusion by heparan sulfate binding is the other, and is not implemented.');
}
