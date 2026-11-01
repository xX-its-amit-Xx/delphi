// Lean law tools: the project's Lean-backed laws as MCP tools, with the provenance envelope.
//
// The SAME handlers serve every surface:
//   sim-engine/server.mjs  (stdio MCP; registration patch in tools/LEAN-REGISTER.md)
//   sim-engine/http.mjs    (POST /tool/lean_*; import LEAN_TOOLS from here)
//   sim-engine/lean-cli.mjs
//   mcp/server.mjs + mcp/cli.mjs (the hosted delphisci MCP)
// and all of them read laws through ONE loader, lib/lean-source.mjs (repo root). Nothing here holds a law
// list of its own. A law that is not in the loader does not exist for any caller, which is what
// lean/registry/check-exposed.mjs enforces.
//
// Only envelope.mjs (pure ESM) is imported from sim-engine/lib, so the hosted server can load this file
// without the sim-engine parameter tables.

import { envelope, p } from '../lib/envelope.mjs';
import * as src from '../../lib/lean-source.mjs';

const KIND = { type: 'string', enum: ['physical', 'biological'] };
const STATUS = { type: 'string', enum: ['proposed', 'candidate', 'accepted', 'contested', 'retired'] };

function origin() {
  const reg = src.load();
  return reg.origin === 'registry'
    ? p('law registry', 'lean/registry/', 'derived', 'Versioned law registry in this repository (lean/registry/laws/*.json, lawsets/*.json).')
    : p('law registry', 'lean/laws.json + lean/constraints.json + lean/empirical.json', 'derived',
        'FALLBACK: lean/registry/ does not exist yet, so registry-shaped entries are derived from the compiled law and constraint files by lib/lean-source.mjs. Status words were mapped (the original is in source_status); the single lawset is 0.0.0-derived, not a release.');
}
const commitP = () => p('git commit', src.gitCommit(), 'derived', src.gitCommit() ? 'git rev-parse HEAD (or DELPHI_GIT_SHA) at load time.' : 'No .git and no DELPHI_GIT_SHA in this deployment; file content hashes still pin the bytes.');

const STATUS_SCOPE =
  'A law\'s status is a registry decision, not a truth value: "accepted" means accepted into a lawset under its ' +
  'named hypotheses and scope; "contested" and "candidate" laws are shown but never binding. "proved" in ' +
  'source_status means a Lean kernel proof of the stated theorem about a model, never that the model describes ' +
  'any organism. Laws absent from the registry are unchecked, not satisfied.';

// ── lean_laws_list ─────────────────────────────────────────────────────────
export const lawsListSchema = {
  title: 'List Lean-backed laws',
  description: 'Every law in the versioned law registry (physical and biological), with law_id, version, kind, status, Lean theorem and the constraint ids that evaluate it. Filter by kind, status, scope substring (matches level and scope text), lawset version, or free text.',
  inputSchema: {
    type: 'object',
    properties: {
      kind: KIND,
      status: { oneOf: [STATUS, { type: 'array', items: STATUS }], description: 'One status or a list.' },
      scope: { type: 'string', description: 'Substring of the law level or scope, e.g. "genotype", "physiology".' },
      lawset: { type: 'string', description: 'Only laws in this lawset version, or "current".' },
      text: { type: 'string', description: 'Substring of law_id, label or statement.' },
    },
  },
};
export async function lawsList(args = {}) {
  const r = src.listLaws(args);
  return envelope(r, [origin(), commitP()], STATUS_SCOPE);
}

// ── lean_law_get ───────────────────────────────────────────────────────────
export const lawGetSchema = {
  title: 'One Lean-backed law, in full',
  description: 'The full registry entry for one law: statement, the Lean source text of its theorem and of the named hypotheses its signature uses, constraint lemmas, version history, sources, non-vacuity witness, and the pinned commit and content hash with a live drift flag.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'law_id from lean_laws_list' } }, required: ['id'] },
};
export async function lawGet(args = {}) {
  if (!args.id) throw new Error('id is required');
  const r = src.getLaw(args.id);
  const prov = [origin(), commitP()];
  if (r.lean_ref?.module) prov.push(p('Lean module', r.lean_ref.module, 'derived', `Source text read from the file; module hash ${r.pin?.module_hash}, pin status ${r.pin?.status}.`));
  return envelope(r, prov,
    STATUS_SCOPE + ' The Lean source shown is read from the module at load time; whether it compiles is established by the Lean build (lake build), not by this tool. Named hypotheses are found by matching identifiers in the theorem signature and may miss hypotheses introduced inside binders.');
}

// ── lean_lawset_get ────────────────────────────────────────────────────────
export const lawsetGetSchema = {
  title: 'A lawset release',
  description: 'A versioned set of laws (law_id, version, content hash, pinned status) as released in the registry. "current" resolves to lean/registry/lawsets/current.json.',
  inputSchema: { type: 'object', properties: { version: { type: 'string', default: 'current', description: 'Semver, or "current".' } } },
};
export async function lawsetGet(args = {}) {
  const r = src.getLawset(args.version || 'current');
  return envelope(r, [origin(), commitP()], STATUS_SCOPE + ' A lawset is what was accepted at release time; laws revised since are not in it until a new lawset is cut.');
}

// ── lean_check ─────────────────────────────────────────────────────────────
export const checkSchema = {
  title: 'Check a design against a lawset (NOT a kernel check)',
  description: 'Evaluates a resolved state/design (SI units, fields documented at the top of lean/eliminate/browser-check.mjs) against one lawset. Evaluation is the generated browser-check (floating point); law_id, version, kind and status come from the registry. Returns per-law verdicts (holds, violated, cannot-evaluate, out-of-scope) and violations [{law_id, version, kind, status, inputs, message, binding}]. Violations of non-accepted laws are advisory (binding:false). A row is out-of-scope when the law scope (taxa, life stages, ranges) excludes the design, or when it compares the design with the single flying-fish reference specimen and the design is not a flying fish; give taxon (e.g. "Danio rerio") in the design.',
  inputSchema: {
    type: 'object',
    properties: {
      design: { type: 'object', description: 'SI-unit spec: taxon, life_stage, SL_m, mass_kg, finArea_m2, CLmax, LD_max, rho, airspeed_m_s, genotype_edits, ... (alias: spec).' },
      spec: { type: 'object', description: 'Alias of design, accepted for compatibility with the v1 lean_check.' },
      lawset: { type: 'string', default: 'current' },
    },
  },
};
export async function check(args = {}) {
  const design = args.design || args.spec || {};
  const r = await src.checkDesign(design, args.lawset || 'current');
  return envelope(r,
    [origin(), commitP(),
     p('evaluator', 'lean/eliminate/browser-check.mjs', 'derived', 'Generated from lean/constraints.json; evaluates the Lean-backed formulas in floating point.'),
     p('verification status', 'floating-point evaluation of Lean-backed formulas', 'derived', 'Not a kernel check.')],
    'NOT A KERNEL CHECK. The formulas the Lean constraints encode are evaluated in floating point. "holds" means the ' +
    'design satisfies the relation under its named hypotheses, never that the design is feasible; "violated" means the ' +
    'committed numbers break the relation under those hypotheses; "out-of-scope" means the law or the comparison is ' +
    'scoped (taxa, life stage, ranges) away from this design and says nothing either way (pass taxon to evaluate ' +
    'flying-fish-scoped rows). Laws listed in laws_without_browser_evaluation were ' +
    'not evaluated at all. Kernel certificates exist only for the recorded examples under lean/Delphi/Certificates/.');
}

// ── lean_propose ───────────────────────────────────────────────────────────
export const proposeSchema = {
  title: 'Propose a new Lean law (local only)',
  description: 'Runs lean/registry/propose.mjs on a submitted Lean statement plus metadata and returns its verdict: candidate, contested or rejected. Never auto-accepts (an "accepted" result is downgraded to candidate). Runs a Lean build, so it is not offered on the hosted HTTP server.',
  inputSchema: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Path to a .lean file (local).' },
      source: { type: 'string', description: 'Lean source text, used if file is absent.' },
      meta: { type: 'object', description: 'law_id, kind, statement_en, hypotheses, sources ... as lean/registry/README.md documents.' },
    },
  },
};
export async function proposeLaw(args = {}) {
  const r = await src.propose(args);
  return envelope(r, [origin(), p('proposer', 'lean/registry/propose.mjs', 'derived', 'The registry\'s own proposal pipeline; this tool only relays its output.')],
    'A proposal verdict is not acceptance. "candidate" means the statement compiled and passed the registry\'s automatic checks; acceptance into a lawset needs a recorded human approval. Nothing is written to lean/registry/laws/ by this tool.');
}

// ── lean_verify ────────────────────────────────────────────────────────────
export const verifySchema = {
  title: 'Verify pinned Lean sources',
  description: 'Re-hashes every pinned Lean module and reports drift against the registry pins, whether each named theorem still exists, whether the static /api/lean/ mirror is stale, and whether the generated browser-check lags lean/constraints.json.',
  inputSchema: { type: 'object', properties: {} },
};
export async function verifyLaws() {
  const r = src.verify();
  return envelope(r, [origin(), commitP()],
    'Hash comparison only: no drift means the bytes match the pins, not that the proofs compile. Run the Lean build for that.');
}

// One table, imported by server.mjs, http.mjs, lean-cli.mjs and mcp/. `local: true` marks tools that must
// not be exposed on a hosted/public server (lean_propose runs a Lean build).
export const LEAN_TOOLS = [
  { name: 'lean_laws_list', ...lawsListSchema, handler: lawsList },
  { name: 'lean_law_get', ...lawGetSchema, handler: lawGet },
  { name: 'lean_lawset_get', ...lawsetGetSchema, handler: lawsetGet },
  { name: 'lean_check', ...checkSchema, handler: check },
  { name: 'lean_propose', ...proposeSchema, handler: proposeLaw, local: true },
  { name: 'lean_verify', ...verifySchema, handler: verifyLaws },
];
export const LEAN_TOOL_NAMES = LEAN_TOOLS.map(t => t.name);
