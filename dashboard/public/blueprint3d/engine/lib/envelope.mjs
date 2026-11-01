// Pure-ESM core of the provenance envelope (no node-only imports), so the browser engine runs the
// identical code. lib/provenance.mjs re-exports these and adds the node-only parameter-table loader.

// The version of the sim-engine contract (tool names, schemas, envelope, scenario interface). Semver; see
// sim-engine/CHANGELOG.md. Every envelope carries it, and contract.json states it.
export const CONTRACT_VERSION = '0.4.0';

// Ordered weakest-to-strongest claim on reality. Anything not on this list is rejected at runtime,
// so a typo cannot quietly downgrade into an unlabelled number.
export const KINDS = Object.freeze({
  measured: 'Read from a primary source that measured it in the stated organism.',
  'measured-secondhand': 'A measurement, but quoted from a citing paper, review or summary rather than read in the source. Treat as provisional.',
  borrowed: 'A real measurement, used for a molecule, tissue or stage it was NOT measured in. The borrowing is the assumption.',
  derived: 'Computed from other entries here by a stated formula, adding no new empirical content.',
  calibrated: 'Set so the model reproduces one named wild-type observation. Calibration is not prediction; a calibrated quantity can never be cited as a result.',
  assumed: 'Not measured and not fetched. A placeholder. Any conclusion resting on it inherits that.',
});

export function p(quantity, value, kind, source, extra = {}) {
  if (!(kind in KINDS)) throw new Error(`unknown provenance kind "${kind}" for ${quantity}; allowed: ${Object.keys(KINDS).join(', ')}`);
  if (!source || typeof source !== 'string') throw new Error(`provenance for "${quantity}" needs a source string`);
  return { quantity, value, kind, source, ...extra };
}

// A tool's answer. `scope` is prose and is mandatory: it says what the result does NOT cover. A tool
// that cannot state its own limits is not finished.
export function envelope(result, provenance, scope) {
  if (!Array.isArray(provenance)) throw new Error('provenance must be an array');
  if (!scope || typeof scope !== 'string') throw new Error('scope is mandatory: say what this result does not establish');
  for (const q of provenance) if (!(q.kind in KINDS)) throw new Error(`bad provenance kind: ${q.kind}`);
  const weakest = ['assumed', 'borrowed', 'measured-secondhand', 'calibrated', 'derived', 'measured'].find(k => provenance.some(q => q.kind === k)) || 'none';
  return {
    contract_version: CONTRACT_VERSION,
    result,
    provenance,
    scope,
    // Surfaced so a caller does not have to scan the list to learn the result rests on a guess.
    weakest_input: weakest,
    counts: provenance.reduce((a, q) => ((a[q.kind] = (a[q.kind] || 0) + 1), a), {}),
  };
}

