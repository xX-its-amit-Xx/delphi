// The envelope every sim-engine tool returns: { result, provenance, scope }.
//
// The point of the envelope is that a number leaving this engine carries where it came from. A
// reader should never have to guess whether 56 um^2/s was measured in a zebrafish or invented to
// make a model work. `kind` is the whole contract: if a tool cannot say which kind a number is, it
// must not emit the number.

import { KINDS, p, envelope } from './envelope.mjs';
export { KINDS, p, envelope };

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
