// INDRA-style statement typing: claim text + grounded mentions -> {type, subject, object, rule}.
// Vocabulary and triggers: relations.json (versioned). First matching rule wins; molecular (INDRA) rules need a
// grounded gene/protein/chemical on BOTH sides of the trigger, otherwise the law rules are tried.
import path from 'node:path';
import { HERE, readJson } from './lib.mjs';

export const VOCAB = readJson(path.join(HERE, 'relations.json'));
const MOLECULAR_DB = new Set(['HGNC', 'UP', 'FPLX', 'CHEBI', 'ZFIN', 'NCBIGene', 'ENSEMBL', 'PUBCHEM']);
const usable = m => m.best && (m.status === 'grounded' || m.status === 'ambiguous');
const ent = m => (m ? { text: m.text, id: m.best?.id ?? null, name: m.best?.name ?? null, status: m.status } : null);

/** @returns {{type, family, formalizable, rule, trigger, subject, object, vocabulary}} */
export function typeStatement(text, mentions = [], { types = [] } = {}) {
  const vocabulary = VOCAB.version;
  if (types.some(t => VOCAB.meta_types.includes(t))) {
    return { type: 'Meta', family: 'law', formalizable: 'no', rule: 'nanopub type is an assessment or concept record', trigger: null, subject: null, object: null, vocabulary };
  }
  const s = String(text || '');
  const located = mentions.filter(usable)
    .map(m => ({ ...m, pos: m.start ?? s.toLowerCase().indexOf(String(m.text).toLowerCase()) }))
    .filter(m => m.pos >= 0).sort((a, b) => a.pos - b.pos);
  for (const r of VOCAB.types) {
    const m = new RegExp(r.trigger, 'i').exec(s);
    if (!m) continue;
    const before = located.filter(x => x.pos < m.index), after = located.filter(x => x.pos > m.index);
    if (r.molecular) {
      const subj = [...before].reverse().find(x => MOLECULAR_DB.has(x.best.db));
      const obj = after.find(x => MOLECULAR_DB.has(x.best.db));
      if (!subj || !obj) continue;
      return { type: r.type, family: r.family, formalizable: r.formalizable, rule: `${r.type}: /${r.trigger}/ with grounded molecular subject and object`, trigger: m[0], subject: ent(subj), object: ent(obj), vocabulary };
    }
    return { type: r.type, family: r.family, formalizable: r.formalizable, rule: `${r.type}: /${r.trigger}/`, trigger: m[0], subject: ent(before[before.length - 1] || null), object: ent(after[0] || null), vocabulary };
  }
  const f = VOCAB.fallback;
  return { type: f.type, family: f.family, formalizable: f.formalizable, rule: 'no trigger matched', trigger: null, subject: ent(located[0] || null), object: ent(located[1] || null), vocabulary };
}
