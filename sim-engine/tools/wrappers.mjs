// Thin wrappers over code that already exists elsewhere in the repository. These tools add no
// science: they add the provenance envelope and a scope sentence, so a Design Studio caller gets
// the same answer the underlying module gives plus an honest label on it.
//
// None of these modules is edited from here. If a number looks wrong, it is wrong in the module.

import path from 'node:path';
import { envelope, p } from '../lib/provenance.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const mod = rel => import(new URL(`file:///${path.resolve(root, rel).replace(/\\/g, '/')}`).href);

// ── physiology_chain ───────────────────────────────────────────────────────
export const physiologySchema = {
  title: 'Oxygen-transport physiology chain',
  description:
    'Wraps physiology/index.js createPhysiology: gill oxygen uptake and the downstream transport chain for a fish of a given mass in given water. The underlying module labels each of its own quantities measured, derived, tuned or assumed, and those labels are passed through unchanged.',
  inputSchema: {
    type: 'object',
    properties: {
      mass_kg: { type: 'number', description: 'Body mass. Default 0.06 kg.' },
      gillArea_m2: { type: 'number', description: 'Total gill area; defaults to a per-kg value from the module.' },
      waterTemp_C: { type: 'number', description: 'Default 25.' },
      salinity_psu: { type: 'number', description: 'Default 35.' },
      waterO2_mg_per_l: { type: 'number', description: 'Defaults to air saturation at the given temperature and salinity.' },
    },
  },
};

export async function physiologyChain(args = {}) {
  const { createPhysiology } = await mod('physiology/index.js');
  const spec = {};
  for (const k of ['mass_kg', 'gillArea_m2']) if (args[k] != null) spec[k] = args[k];
  const env = {};
  for (const k of ['waterTemp_C', 'salinity_psu', 'waterO2_mg_per_l', 'airO2_fraction']) if (args[k] != null) env[k] = args[k];

  const chain = createPhysiology(spec, env);

  // describe() returns the module's own labelled quantities, one record per quantity with its kind
  // and source already attached. Those labels are passed through rather than re-derived: the module
  // is the authority on where its own numbers came from.
  const quantities = chain.describe();

  // Map the module's vocabulary onto the envelope's. "tuned" becomes "calibrated" because a number
  // fitted to a reference animal is not a measurement of this one, and "proxy" becomes "borrowed".
  const MAP = { measured: 'measured', derived: 'derived', assumed: 'assumed',
                secondary: 'measured-secondhand', proxy: 'borrowed', tuned: 'calibrated' };
  const prov = quantities.map(q =>
    p(q.quantity, q.value, MAP[q.kind] || 'assumed', q.source || 'physiology/index.js',
      { unit: q.unit, module_kind: q.kind }));
  prov.push(p('module', 'physiology/index.js', 'derived', 'Code in this repository, not modified by sim-engine.'));

  const out = { quantities, isStub: chain.isStub ?? false };
  return envelope(out, prov,
    'Steady-state oxygen transport for one fish under one set of water conditions. It is not a ' +
    'simulation of development, it has no spatial extent, and it does not run in time. Quantities the ' +
    'underlying module marks "tuned" were fitted to a reference animal and must never be cited as ' +
    'predictions of this one.');
}

// ── growth_trajectory ──────────────────────────────────────────────────────
export const growthSchema = {
  title: 'Growth trajectory',
  description:
    'Wraps development/trajectory.mjs: standard length and derived quantities against age, from the growth model fitted in that module.',
  inputSchema: {
    type: 'object',
    properties: {
      quantity: { type: 'string', description: 'Quantity to evaluate, passed to trajectory.at(). Omit for the whole series.' },
      ageDays: { type: 'number', description: 'Age in days.' },
      SLcm: { type: 'number', description: 'Standard length in cm; converted to an age if ageDays is absent.' },
      series: { type: 'integer', description: 'Return this many points instead of a single evaluation.' },
      maxDays: { type: 'number', default: 365 },
    },
  },
};

export async function growthTrajectory(args = {}) {
  const t = await mod('development/trajectory.mjs');
  let result;
  if (args.series) result = t.series(args.series, args.maxDays ?? 365);
  else if (args.quantity) result = t.at(args.quantity, { ageDays: args.ageDays, SLcm: args.SLcm });
  else result = { describe: t.describe(), SLcm_at: args.ageDays != null ? t.SLcmAt(args.ageDays) : null,
                  ageDays_at: args.SLcm != null ? t.ageAtSLcm(args.SLcm) : null };

  return envelope(result,
    [p('module', 'development/trajectory.mjs', 'derived', 'Code in this repository, not modified by sim-engine. Its own parameter block P records where its constants come from.'),
     p('growth curve parameters', t.P, 'calibrated', 'Fitted inside development/trajectory.mjs; see that file for the data each constant came from.')],
    'A fitted growth curve evaluated at a point. It is a description of how a fish of this kind has ' +
    'been observed to grow, not a mechanism, and it cannot predict the effect of a perturbation: ' +
    'nothing in it responds to a genotype, a morphogen or an environment.');
}

// ── lean_check ─────────────────────────────────────────────────────────────
export const leanSchema = {
  title: 'Lean-backed constraint check (NOT a kernel check)',
  description:
    'Wraps lean/eliminate/browser-check.mjs. Evaluates in floating point the same formulas the Lean-backed constraints encode, and returns one verdict per constraint it can reach. This is NOT a kernel proof: kernel certificates exist only for the recorded examples under lean/Delphi/Certificates/.',
  inputSchema: {
    type: 'object',
    properties: {
      spec: { type: 'object', description: 'SI-unit spec: SL_m, mass_kg, finArea_m2, CLmax, LD_max, rho, airspeed_m_s, and the rest documented at the top of browser-check.mjs.' },
    },
    required: ['spec'],
  },
};

export async function leanCheck(args = {}) {
  const m = await mod('lean/eliminate/browser-check.mjs');
  const fn = m.check || m.default;
  if (typeof fn !== 'function') throw new Error('lean/eliminate/browser-check.mjs exports no check()');
  const result = fn(args.spec || {});

  return envelope(result,
    [p('module', 'lean/eliminate/browser-check.mjs', 'derived',
       'Generated by lean/eliminate/build-browser-check.mjs from lean/constraints.json. Not modified by sim-engine.'),
     p('verification status', 'floating-point evaluation of Lean-backed formulas', 'derived',
       'The module states in every result that this is not a kernel check.')],
    'NOT A KERNEL CHECK. This evaluates the same formulas the Lean constraints encode, in floating ' +
    'point, so it inherits rounding and cannot establish anything a proof would. A verdict of "holds" ' +
    'means the spec satisfies the relation under the named hypotheses, never that the design is ' +
    'feasible. Kernel certificates exist only for the recorded examples under lean/Delphi/Certificates/.');
}
