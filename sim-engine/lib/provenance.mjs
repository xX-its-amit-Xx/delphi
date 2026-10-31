// The envelope every sim-engine tool returns: { result, provenance, scope }.
//
// The point of the envelope is that a number leaving this engine carries where it came from. A
// reader should never have to guess whether 56 um^2/s was measured in a zebrafish or invented to
// make a model work. `kind` is the whole contract: if a tool cannot say which kind a number is, it
// must not emit the number.

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
    result,
    provenance,
    scope,
    // Surfaced so a caller does not have to scan the list to learn the result rests on a guess.
    weakest_input: weakest,
    counts: provenance.reduce((a, q) => ((a[q.kind] = (a[q.kind] || 0) + 1), a), {}),
  };
}

// Load the fetched parameter table and look one up by id, carrying its provenance across.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
export const MORPHOGENS = JSON.parse(fs.readFileSync(path.join(here, '..', 'params', 'zebrafish-morphogens.json'), 'utf8'));

export function param(id) {
  const e = MORPHOGENS.parameters.find(x => x.id === id);
  if (!e) throw new Error(`no fetched parameter "${id}"`);
  return e;
}

// Turn a fetched entry into a provenance record, preserving its kind rather than upgrading it.
export function fromParam(id, { as = null, kind = null } = {}) {
  const e = param(id);
  return p(as || e.quantity, e.value, kind || e.kind, `${e.source}${e.url ? ` <${e.url}>` : ''}`, {
    unit: e.unit,
    read: e.read,
    ...(e.caution ? { caution: e.caution } : {}),
  });
}
