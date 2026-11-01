// The evaluator's OWN index from reference id -> {species, family, order}, parsed directly from the data files, so the
// exclusion audit does not trust the scorer's excludeMatcher or its taxon strings.
import fs from 'node:fs';
import path from 'node:path';
const VAL = path.resolve(import.meta.dirname, '..');
const ROOT = path.resolve(VAL, '..', '..');

// Daane 2021 fin-only species that FishShapes lacks: family by genus (Beloniformes; standard taxonomy, written here
// independently of phenotype.mjs).
const BELONIFORM_FAMILY = { Hirundichthys: 'Exocoetidae', Cheilopogon: 'Exocoetidae', Exocoetus: 'Exocoetidae', Cypselurus: 'Exocoetidae', Parexocoetus: 'Exocoetidae', Fodiator: 'Exocoetidae', Prognichthys: 'Exocoetidae',
  Oxyporhamphus: 'Hemiramphidae', Euleptorhamphus: 'Hemiramphidae', Hemiramphus: 'Hemiramphidae', Hyporhamphus: 'Hemiramphidae', Rhynchorhamphus: 'Hemiramphidae', Arrhamphus: 'Hemiramphidae', Chriodorus: 'Hemiramphidae',
  Dermogenys: 'Zenarchopteridae', Nomorhamphus: 'Zenarchopteridae', Zenarchopterus: 'Zenarchopteridae', Hemirhamphodon: 'Zenarchopteridae',
  Belone: 'Belonidae', Strongylura: 'Belonidae', Tylosurus: 'Belonidae', Ablennes: 'Belonidae', Platybelone: 'Belonidae', Xenentodon: 'Belonidae', Potamorrhaphis: 'Belonidae',
  Scomberesox: 'Scomberesocidae', Cololabis: 'Scomberesocidae', Oryzias: 'Adrianichthyidae' };

export async function buildIndex() {
  const fsj = JSON.parse(fs.readFileSync(path.join(VAL, 'data', 'fishshapes-features.json'), 'utf8'));
  const byId = new Map(), bySpecies = new Map();
  for (const [id, sp, fam, ord] of fsj.rows) { const t = { species: sp.replace(/_/g, ' '), family: fam, order: ord }; byId.set(`fishshapes:${id}:${sp}`, t); bySpecies.set(t.species, t); }
  return { byId, bySpecies };
}
export function taxonOfRef(IDX, id) {
  if (IDX.byId.has(id)) return IDX.byId.get(id);
  let m;
  if ((m = id.match(/^daane2021:(.+)$/))) { const sp = m[1].replace(/_/g, ' '); const fs0 = IDX.bySpecies.get(sp); return fs0 || { species: sp, family: BELONIFORM_FAMILY[sp.split(' ')[0]] || null, order: 'Beloniformes' }; }
  if (/^zebrafish-(adult|larva)(@|$)/.test(id)) return { species: 'Danio rerio', family: 'Cyprinidae', order: 'Cypriniformes', organism_group: 'organism:zebrafish' };
  if (/^flying-fish(@|$)/.test(id)) return { species: 'flying fish (generic Exocoetidae)', family: 'Exocoetidae', order: 'Beloniformes', organism_group: 'organism:flying-fish' };
  return null;
}
export { BELONIFORM_FAMILY };
