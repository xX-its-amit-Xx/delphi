// Shared provenance helpers for the nanopub builder and the report.
//
// A citation can resolve and still show the reader different numbers than the ones quoted, so both the
// builder and the report compare the CONTENT at the pinned commit with the content they read. That check
// has one honest complication: some cited artefacts are regenerated on every run and carry a build
// timestamp, so their bytes differ while nothing a reader cares about has changed. Treating that as drift
// would cry wolf on every run; treating it as identity would hide a real change. So the two cases are
// distinguished here, in one place, and both consumers report which one they found.
export const TIMESTAMP_KEYS = new Set(['computed', 'built', 'generated', 'run', 'at', 'checkedAt', 'created', 'builtAt', 'generatedAt', 'retrieved_at', 'timestamp', 'updated']);

/** Flatten an object to dotted paths so two versions can be compared field by field. */
export function flatten(o, prefix = '') {
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) { for (const [k, v] of Object.entries(o)) Object.assign(out, flatten(v, prefix + '.' + k)); }
  else if (Array.isArray(o)) { o.forEach((v, i) => Object.assign(out, flatten(v, prefix + '[' + i + ']'))); }
  else out[prefix] = o;
  return out;
}

/**
 * Compare two versions of a cited file.
 * Returns {identical, onlyTimestamps, fields, parsed}: `onlyTimestamps` is true when the only differing
 * fields are build timestamps, in which case `fields` names them. `parsed` is false when the file is not
 * JSON, and then only byte identity can be decided.
 */
export function compareVersions(textPinned, textNow) {
  if (textPinned === textNow) return { identical: true, onlyTimestamps: false, fields: [], parsed: null };
  let a, b;
  try { a = JSON.parse(textPinned); b = JSON.parse(textNow); } catch (e) { return { identical: false, onlyTimestamps: false, fields: [], parsed: false }; }
  const fa = flatten(a), fb = flatten(b);
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])];
  const diff = keys.filter(k => JSON.stringify(fa[k]) !== JSON.stringify(fb[k]));
  const isStamp = k => TIMESTAMP_KEYS.has(k.split('.').pop().replace(/\[\d+\]$/, ''));
  const substantive = diff.filter(k => !isStamp(k));
  return { identical: diff.length === 0, onlyTimestamps: diff.length > 0 && substantive.length === 0, fields: (substantive.length ? substantive : diff).map(k => k.replace(/^\./, '')), parsed: true };
}
