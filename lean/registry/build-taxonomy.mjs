#!/usr/bin/env node
// Builds the taxonomy the law-scope engine walks:
//   lean/registry/taxonomy.json   the data, with the query that produced every row
//   lib/lean-taxonomy.mjs         the same data as a generated, import-free ESM module, because
//                                 lib/lean-scope.mjs runs unchanged in the browser and cannot read a file
//
//   node lean/registry/build-taxonomy.mjs            build (uses the cache; fetches what is missing)
//   node lean/registry/build-taxonomy.mjs --offline  fail rather than fetch
//   node lean/registry/build-taxonomy.mjs --check     verify the committed files match this build
//
// WHY THIS FILE EXISTS. A law carries `scope.taxa`: the clades it is calibrated on. Deciding whether a
// design is inside one of them needs a taxonomy, and until now that taxonomy was NINE HARD-CODED
// ENTRIES repeated in seven files:
//
//     Exocoetidae -> Beloniformes -> Teleostei -> Actinopterygii -> Vertebrata -> Metazoa -> any
//
// Everything about that is specific to this project's fish. Three consequences, all of them bugs rather
// than gaps:
//
//   1. A law could not be scoped to a clade outside the ladder. `scope.taxa: ['Mammalia']` was
//      unsatisfiable by construction: no organism is ever inside a clade the ladder does not contain.
//   2. An organism outside the ladder was not merely unplaced, it was silently OUT OF SCOPE for every
//      scoped law, because `taxonWithin` returned false for "not in my table" exactly as it did for
//      "genuinely a different clade". A mouse is a vertebrate; a vertebrate-scoped law would have been
//      greyed out for it, with a reason that read as though the clade had been checked.
//   3. Genus membership had to be hard-coded (FLYING_FISH_GENERA, SNAILFISH_GENERA) because there was no
//      lineage to look it up in. Those lists are deleted by this file: Cypselurus is inside Exocoetidae
//      in the NCBI taxonomy, and that is a fact to read, not a constant to maintain.
//
// The ancestors come from the SAME endpoint and the SAME relation the organism thread's blueprint tool
// uses (Ubergraph, NCBITaxon rdfs:subClassOf closure), so a clade placement here and a taxon constraint
// there cannot disagree about who is inside what.
//
// HELD-OUT CLADE. Aves is the frozen holdout. Held-out taxa are never written as keys of this table, and
// the build FAILS if a held-out name reaches the output. A non-bird's ancestor list cannot contain Aves,
// so nothing is lost by this: it only means the table will not place a bird, which is the point.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const OFFLINE = process.argv.includes('--offline');
const CHECK = process.argv.includes('--check');
const die = (m) => { console.error(`build-taxonomy.mjs FAILED: ${m}`); process.exit(1); };

const UBERGRAPH = 'https://ubergraph.apps.renci.org/sparql';
const OBO = 'http://purl.obolibrary.org/obo/';
const PFX = 'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX obo: <http://purl.obolibrary.org/obo/> ';
const cacheDir = path.join(here, 'taxonomy-cache');
fs.mkdirSync(cacheDir, { recursive: true });
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

const queries = [];
async function sparql(purpose, q) {
  const full = PFX + q;
  const f = path.join(cacheDir, sha(full) + '.json');
  let rows, retrieved, cached = false;
  if (fs.existsSync(f)) {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    rows = c.rows; retrieved = c.retrieved; cached = true;
  } else {
    if (OFFLINE) die(`offline and not cached: ${purpose}`);
    let last;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(UBERGRAPH, {
          method: 'POST',
          headers: { 'content-type': 'application/sparql-query', accept: 'application/sparql-results+json' },
          body: full,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const j = JSON.parse(await res.text());
        rows = j.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
        retrieved = new Date().toISOString();
        fs.writeFileSync(f, JSON.stringify({ purpose, sparql: full, retrieved, rows }));
        last = null;
        break;
      } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * attempt)); }
    }
    if (last) die(`${purpose}: ${last.message}`);
  }
  queries.push({ purpose, sparql: full, retrieved, cached, rows: rows.length });
  return rows;
}

const taxId = iri => Number(String(iri).replace(/.*NCBITaxon_/, ''));
const isNcbi = iri => /NCBITaxon_[0-9]+$/.test(String(iri));

// ---------------------------------------------------------------- what to place
// CLADE ANCHORS. A law's scope can only name a clade this table knows, so the anchors decide what the law
// base is ABLE to say. They are deliberately broad and span the animal kingdom rather than this project's
// fish: the whole point is that `scope.taxa: ['Mammalia']` becomes a sentence the registry can express.
// Ranks a biologist would reach for first when writing a scope, plus the ones our own laws already use.
const ANCHOR_NAMES = [
  // kingdom to phylum
  'Metazoa', 'Eumetazoa', 'Bilateria', 'Deuterostomia', 'Protostomia', 'Chordata',
  // vertebrates
  'Craniata', 'Vertebrata', 'Gnathostomata', 'Euteleostomi', 'Chondrichthyes', 'Cyclostomata',
  // ray-finned fish, down to the clades our own laws name
  'Actinopterygii', 'Actinopteri', 'Neopterygii', 'Teleostei', 'Clupeocephala',
  'Otomorpha', 'Otophysi', 'Cypriniformes', 'Danionidae', 'Danio',
  'Acanthomorphata', 'Acanthopterygii', 'Percomorphaceae', 'Ovalentaria', 'Atherinomorphae',
  'Beloniformes', 'Belonoidei', 'Exocoetidae', 'Adrianichthyidae', 'Oryzias', 'Liparidae',
  // lobe-finned fish and tetrapods
  'Sarcopterygii', 'Dipnotetrapodomorpha', 'Tetrapoda', 'Amphibia', 'Anura', 'Xenopus',
  'Amniota', 'Lepidosauria', 'Testudines', 'Crocodylia',
  // mammals
  'Mammalia', 'Theria', 'Eutheria', 'Glires', 'Rodentia', 'Myomorpha', 'Muridae', 'Murinae', 'Mus',
  'Primates', 'Carnivora', 'Artiodactyla',
  // invertebrates
  'Ecdysozoa', 'Arthropoda', 'Hexapoda', 'Insecta', 'Diptera', 'Drosophila', 'Nematoda',
  'Lophotrochozoa', 'Mollusca', 'Gastropoda', 'Annelida', 'Platyhelminthes',
  'Cnidaria', 'Hydrozoa', 'Porifera', 'Echinodermata',
  // OUTSIDE THE ANIMALS. The table ran from Metazoa downward, so every bacterium, archaeon, fungus and
  // plant was simply unplaceable -- and "unplaceable" propagates: no clade scope can be decided for it, no
  // reference set can say whether it is covered, and lift-coefficients.json cannot even refuse it properly.
  // A system that claims to work for any base organism cannot stop at the animals. These are the ranks the
  // NCBI taxonomy actually uses above and beside Metazoa.
  'cellular organisms', 'Bacteria', 'Archaea', 'Eukaryota', 'Opisthokonta', 'Fungi', 'Dikarya',
  'Ascomycota', 'Saccharomycetes', 'Viridiplantae', 'Streptophyta', 'Magnoliopsida',
  'Pseudomonadota', 'Gammaproteobacteria', 'Betaproteobacteria', 'Alphaproteobacteria',
  'Enterobacterales', 'Enterobacteriaceae', 'Escherichia', 'Bacillota', 'Bacilli',
  'Cyanobacteriota', 'Actinomycetota', 'Burkholderiales', 'Burkholderiaceae',
];

// The species THIS project works on. They are not in organisms/merged/taxa.json, which is the Darwin
// claims inventory and contains no Danio rerio at all -- a gap worth stating, because it is why the law
// scopes could name `Danio rerio` while nothing in the inventory could ever be placed inside it.
const SPECIES_NAMES = [
  'Danio rerio', 'Oryzias latipes', 'Xenopus laevis', 'Drosophila melanogaster',
  'Canis lupus familiaris', 'Exocoetus volitans', 'Hirundichthys speculiger',
  'Cypselurus hiraii', 'Hirundichthys affinis',
  // The use-case organisms under runs/. A design is placed by its taxon, so a taxon the table cannot
  // place is a design the law layer cannot scope.
  'Escherichia coli', 'Cupriavidus necator', 'Ideonella sakaiensis', 'Mus musculus',
  'Saccharomyces cerevisiae', 'Caenorhabditis elegans',
];

// HOMONYMS. Several of these names are used by more than one clade, and the collisions are not subtle:
// NCBI carries a "Vertebrata <red algae>", a "Craniata <brachiopods>", a "Gnathostomata <sea urchins>"
// and a "Theria <moths & butterflies>". A builder that picked the first match would have placed every
// vertebrate inside a genus of seaweed. Each is therefore named here in full, by the label wanted, and
// an ambiguity NOT listed here is left unplaced rather than guessed.
const DISAMBIGUATE = {
  Craniata: 'Craniata <chordates>',
  Vertebrata: 'Vertebrata <vertebrates>',
  Gnathostomata: 'Gnathostomata <vertebrates>',
  Theria: 'Theria <mammals>',
  Xenopus: 'Xenopus <genus>',
  Mus: 'Mus <genus>',
  Drosophila: 'Drosophila <flies,genus>',
};

// EVERY clade and species above is resolved BY ITS ONTOLOGY LABEL, and no taxid is written in this file.
//
// The first version of this builder hard-coded the taxids from memory and five of them were wrong --
// 103920 serves "Guinea pig cytomegalovirus", and the id written for Exocoetidae serves Atheriniformes.
// A wrong id is far worse than a missing one: it places real organisms inside a clade that is not the one
// the law was calibrated on, and the resulting table LOOKS fine. There is no way to check an id from
// memory, and there is an exact way to check a name, so names are what this file contains.
//
// NCBI disambiguates some labels with a qualifier ("Vertebrata <vertebrates>", "Mus <genus>"), and that
// qualified string is what every ancestor list is written in, so it has to be the key. The bare name a
// biologist would put in a scope is kept as an alias onto it. The pattern therefore accepts the name
// either bare or with one qualifier, and nothing else; two matches is an ambiguity this file refuses to
// resolve by picking.
const NAME_RE = n => `^(${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})( <[^>]*>)?$`;

// Common names and project ids a design may carry instead of a scientific name. DATA, not code: the
// genus lists this replaces existed only because there was no lineage to consult.
const ALIASES = {
  zebrafish: 'Danio rerio',
  'flying fish': 'Exocoetidae',
  'flying-fish': 'Exocoetidae',
  flyingfish: 'Exocoetidae',
  snailfish: 'Liparidae',
  medaka: 'Oryzias latipes',
  mouse: 'Mus musculus',
  'house mouse': 'Mus musculus',
  human: 'Homo sapiens',
  frog: 'Xenopus',
  'fruit fly': 'Drosophila melanogaster',
  cattle: 'Bos taurus',
  dog: 'Canis lupus familiaris',
};

const split = JSON.parse(fs.readFileSync(path.join(root, 'holdout/split.json'), 'utf8'));
const heldOut = split.taxa.filter(t => t.assignment === 'holdout');
const heldNames = new Set(heldOut.map(t => t.name));
const heldIds = new Set(heldOut.map(t => t.ids?.ncbi).filter(Boolean).map(Number));

const inventory = JSON.parse(fs.readFileSync(path.join(root, 'organisms/merged/taxa.json'), 'utf8'));
const want = new Map();                       // taxid -> declared name (may be replaced by the ontology label)
const addWant = (taxid, name) => {
  const id = Number(taxid);
  if (!Number.isFinite(id) || id <= 0) return;
  if (heldIds.has(id) || heldNames.has(name)) return;   // held-out clade: never a key here
  if (!want.has(id)) want.set(id, name || null);
};
// (clade anchors and project species are resolved by label below, then added)
for (const t of inventory) {
  const id = t.identifiers?.ncbi_taxid;
  if (id) addWant(id, t.accepted_name || null);
}
// Every taxon our own law scopes already name must be placeable, or a scope silently stops working.
const lawsPath = path.join(root, 'lean/laws.json');
const scopeTaxa = new Set();
if (fs.existsSync(lawsPath)) {
  const raw = JSON.parse(fs.readFileSync(lawsPath, 'utf8'));
  const laws = Array.isArray(raw) ? raw : (raw.laws || []);
  const collect = sc => { for (const t of (sc?.taxa || [])) if (t && t !== 'any') scopeTaxa.add(t); };
  for (const l of laws) { collect(l.scope); for (const cs of Object.values(l.constraint_scopes || {})) collect(cs); }
}

// Resolve every anchor and species name to a taxid by its ontology label. TWO STEPS, because the two
// have very different costs: an exact-literal match uses the label index and is quick, while scanning
// every label with a regex is not, so the regex runs only for the names the exact match missed (the ones
// NCBI disambiguates, like "Mus <genus>").
//
// REGEX goes over STR(?l), not ?l. Without STR, a label carrying a language tag or datatype does not
// match and the query comes back empty -- which it did, for all 80 names at once, silently.
const NAMES = [...ANCHOR_NAMES, ...SPECIES_NAMES];
const resolved = {};          // requested name -> { taxid, label, matched }
const ambiguous = {};         // requested name -> [labels]

// ONE regex pass, matching the name bare OR with a single qualifier.
//
// Two things went wrong before this shape. REGEX was applied to ?l rather than STR(?l), and a label with
// a language tag simply does not match that way: the query came back empty for all 80 names and reported
// nothing wrong. Then an exact `VALUES ?l { "Metazoa" }` match was tried as a cheap first pass and missed
// for the same reason, while appearing to prove the names were absent from the ontology.
for (let i = 0; i < NAMES.length; i += 20) {
  const batch = NAMES.slice(i, i + 20);
  const alt = batch.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const rows = await sparql(`taxids for ${batch.length} clade/species names by label, batch ${i / 20 + 1}`,
    `SELECT ?t ?l WHERE { ?t rdfs:label ?l . FILTER(REGEX(STR(?t),'NCBITaxon_[0-9]+$')) FILTER(REGEX(STR(?l), ${JSON.stringify('^(' + alt + ')( <[^>]*>)?$')})) }`);
  for (const n of batch) {
    let hits = rows.filter(r => new RegExp(NAME_RE(n)).test(r.l));
    if (!hits.length) continue;
    if (hits.length > 1) {
      const want = DISAMBIGUATE[n];
      const picked = want ? hits.filter(h => h.l === want) : [];
      if (!picked.length) { ambiguous[n] = hits.map(h => h.l); continue; }
      resolved[n] = { taxid: taxId(picked[0].t), label: picked[0].l, matched: `disambiguated to "${want}" from ${hits.length} homonyms: ${hits.map(h => h.l).join(' | ')}` };
      continue;
    }
    resolved[n] = { taxid: taxId(hits[0].t), label: hits[0].l, matched: 'single label match' };
  }
  process.stdout.write(`\r  resolving names by label: ${Math.min(i + 20, NAMES.length)}/${NAMES.length}`);
}
console.log();
const unresolved = NAMES.filter(n => !(n in resolved) && !(n in ambiguous));
if (unresolved.length) console.log(`  not found by label, so not placed: ${unresolved.join(', ')}`);
for (const [n, ls] of Object.entries(ambiguous)) console.log(`  AMBIGUOUS, not placed (add it to DISAMBIGUATE): "${n}" matches ${ls.length}: ${ls.join(' | ')}`);
for (const [n, r] of Object.entries(resolved)) addWant(r.taxid, r.label);

console.log(`placing ${want.size} taxa (${ANCHOR_NAMES.length} clade anchors + ${SPECIES_NAMES.length} project species + inventory), excluding ${heldOut.length} held out`);

// ---------------------------------------------------------------- pass 1: ancestors of every target
const ids = [...want.keys()].sort((a, b) => a - b);
const ancOf = new Map();                       // taxid -> Set(ancestor taxid)
const label = new Map();                       // taxid -> ontology label
const B = 40;
for (let i = 0; i < ids.length; i += B) {
  const batch = ids.slice(i, i + B);
  const vals = batch.map(x => `obo:NCBITaxon_${x}`).join(' ');
  const rows = await sparql(`ancestors (rdfs:subClassOf closure) of ${batch.length} taxa, batch ${i / B + 1}`,
    `SELECT ?t ?sup ?sl WHERE { VALUES ?t { ${vals} } ?t rdfs:subClassOf ?sup . ?sup rdfs:label ?sl . FILTER(REGEX(STR(?sup),'NCBITaxon_[0-9]+$')) }`);
  const self = await sparql(`labels of ${batch.length} taxa, batch ${i / B + 1}`,
    `SELECT ?t ?l WHERE { VALUES ?t { ${vals} } ?t rdfs:label ?l }`);
  for (const r of self) label.set(taxId(r.t), r.l);
  for (const r of rows) {
    const t = taxId(r.t), s = taxId(r.sup);
    if (!isNcbi(r.sup) || t === s) continue;
    if (!ancOf.has(t)) ancOf.set(t, new Set());
    ancOf.get(t).add(s);
    label.set(s, r.sl);
  }
  process.stdout.write(`\r  pass 1: ${Math.min(i + B, ids.length)}/${ids.length}`);
}
console.log();

// ---------------------------------------------------------------- pass 2: how deep is each ancestor
// Ordering matters for the reason strings a verdict shows ("Mus musculus, inside Mus, Murinae, Muridae,
// ... Metazoa"), and guessing it from how often a clade appears would be a heuristic dressed as a fact.
// An ancestor's depth is the number of ancestors IT has, which is one more query per batch.
const allAnc = [...new Set([...ancOf.values()].flatMap(s => [...s]))].sort((a, b) => a - b);
const depth = new Map();
for (let i = 0; i < allAnc.length; i += B) {
  const batch = allAnc.slice(i, i + B);
  const vals = batch.map(x => `obo:NCBITaxon_${x}`).join(' ');
  const rows = await sparql(`depth (number of ancestors) of ${batch.length} clades, batch ${i / B + 1}`,
    `SELECT ?t (COUNT(DISTINCT ?sup) AS ?n) WHERE { VALUES ?t { ${vals} } ?t rdfs:subClassOf ?sup . FILTER(REGEX(STR(?sup),'NCBITaxon_[0-9]+$')) } GROUP BY ?t`);
  for (const r of rows) depth.set(taxId(r.t), Number(r.n));
  process.stdout.write(`\r  pass 2: ${Math.min(i + B, allAnc.length)}/${allAnc.length}`);
}
console.log();

// ---------------------------------------------------------------- assemble
const taxa = {};
let skippedHeld = 0;
for (const id of ids) {
  const name = label.get(id) || want.get(id);
  if (!name) continue;
  if (heldNames.has(name) || heldIds.has(id)) { skippedHeld++; continue; }
  const anc = [...(ancOf.get(id) || new Set())]
    .filter(a => !heldIds.has(a))
    .map(a => ({ a, name: label.get(a), d: depth.get(a) ?? 0 }))
    .filter(x => x.name && !heldNames.has(x.name))
    .sort((x, y) => y.d - x.d || x.name.localeCompare(y.name));
  taxa[name] = { taxid: id, ancestors: anc.map(x => x.name) };
}

// Anchors and law-scope taxa are the contract: a missing one is a scope that cannot be satisfied.
//
// Anchors are checked BY TAXID, not by name. NCBI's label is not always the bare clade name a biologist
// would write in a scope -- 89593 is served as "Craniata <chordates>" -- and the ontology's label is the
// one thing that must win, because it is what every ancestor list is written in. So where the two differ
// the label becomes the key and the anchor name becomes an alias onto it, which keeps
// `scope.taxa: ['Craniata']` working without inventing a name the ontology does not use.
const byTaxid = Object.fromEntries(Object.entries(taxa).map(([n, v]) => [v.taxid, n]));
// Each resolved name must be placed under the label the ontology gave it, and where that label carries a
// qualifier the bare name becomes an alias onto it -- so `scope.taxa: ['Vertebrata']` keeps working while
// every ancestor list stays in the ontology's own vocabulary.
const anchorAliases = {};
for (const [name, r] of Object.entries(resolved)) {
  const key = byTaxid[r.taxid];
  if (!key) die(`${name} resolved to taxid ${r.taxid} (label "${r.label}") but was not placed: no ancestors came back for it`);
  if (key !== name) anchorAliases[name] = key;
}
// A clade a law scope names, that we could not place, is a scope that silently matches nothing.
const anchorsMissing = ANCHOR_NAMES.filter(n => !(n in resolved));
Object.assign(ALIASES, anchorAliases);

// Aliases must resolve, or a design carrying a common name is unplaceable.
// An alias may point at a name the ontology itself renamed (snailfish -> Liparidae, where the ontology
// labels that taxid something else), so alias targets are followed through the anchor renames until they
// land on a real key. A chain that does not land is a hard failure: a design carrying that common name
// would otherwise be unplaceable with no warning.
for (const k of Object.keys(ALIASES)) {
  const seen = new Set();
  let v = ALIASES[k];
  while (v && !taxa[v] && ALIASES[v] && !seen.has(v)) { seen.add(v); v = ALIASES[v]; }
  if (!taxa[v]) die(`alias ${k} -> ${ALIASES[k]}${v !== ALIASES[k] ? ` -> ${v}` : ''} does not resolve: no such taxon in the table`);
  ALIASES[k] = v;
}
// The holdout guard, asserted rather than assumed.
for (const n of Object.keys(taxa)) if (heldNames.has(n)) die(`held-out taxon ${n} reached the table`);
for (const [n, v] of Object.entries(taxa)) for (const a of v.ancestors) if (heldNames.has(a)) die(`held-out taxon ${a} reached the ancestors of ${n}`);

const out = {
  built: new Date().toISOString(),
  tool: 'lean/registry/build-taxonomy.mjs',
  source: 'Ubergraph (https://ubergraph.apps.renci.org/sparql), NCBITaxon rdfs:subClassOf closure as served, including inferred edges',
  what_this_is:
    'The taxonomy the law-scope engine walks. `ancestors` is the clades a taxon is inside, most specific '
    + 'first. Membership is read from the ontology; nothing here is a hand-maintained parent table, which '
    + 'is what it replaces.',
  what_this_is_not:
    'Not a phylogeny and not a statement about evolutionary distance. NCBI taxonomy is a nomenclatural '
    + 'hierarchy: it says what a clade CONTAINS, which is all a scope check needs, and says nothing about '
    + 'divergence times or relatedness. A law scoped to a clade is calibrated on that clade, and being '
    + 'inside it is necessary for the law to apply, not sufficient for the law to be right.',
  held_out: {
    clade: split.clade || 'Aves',
    n_excluded: heldOut.length,
    n_skipped_as_keys: skippedHeld,
    rule: 'held-out taxa are never keys here and are filtered out of every ancestor list; the build fails if one reaches the output. A non-bird has no bird ancestor, so this removes nothing a scope check needs.',
  },
  counts: { taxa: Object.keys(taxa).length, clade_anchors: ANCHOR_NAMES.length, clade_anchors_placed: ANCHOR_NAMES.length - anchorsMissing.length, aliases: Object.keys(ALIASES).length, queries: queries.length },
  clade_anchors: [...ANCHOR_NAMES].sort(),
  clade_anchors_renamed_by_the_ontology: anchorAliases,
  resolved_by_label: Object.fromEntries(Object.entries(resolved).map(([n, r]) => [n, { taxid: r.taxid, label: r.label }])),
  names_not_found: unresolved,
  names_ambiguous: ambiguous,
  homonyms_disambiguated: Object.fromEntries(Object.entries(resolved).filter(([, r]) => r.matched.startsWith('disambiguated')).map(([n, r]) => [n, r.matched])),
  clade_anchors_not_placed: anchorsMissing,
  no_hardcoded_taxids:
    'Every taxid in this file was resolved from an exact ontology label at build time. None is written in '
    + 'the builder. The first version hard-coded them and five were wrong, including one that served a '
    + 'cytomegalovirus strain for a fish family, so the table placed real organisms inside clades their '
    + 'laws were never calibrated on and looked correct doing it.',
  aliases: ALIASES,
  taxa,
  queries,
};

const jsonPath = path.join(here, 'taxonomy.json');
const modPath = path.join(root, 'lib/lean-taxonomy.mjs');

// The generated module. lib/lean-scope.mjs is copied verbatim into the browser bundle, so the data has to
// arrive as a module it can import rather than a file it would have to read.
const mod = `// GENERATED by lean/registry/build-taxonomy.mjs -- do not edit. Rebuild with:
//   node lean/registry/build-taxonomy.mjs
//
// The clade placements lib/lean-scope.mjs walks, as a plain ESM module with no imports, so the same file
// runs in node and in the browser bundle (dashboard/build-lean-api.mjs copies both there).
//
// ANCESTORS come from Ubergraph's NCBITaxon rdfs:subClassOf closure. ALIASES map common names and project
// ids onto a scientific name. ${out.held_out.clade} is held out: no held-out taxon appears here, as a key or
// an ancestor, and the builder fails rather than emit one.
export const TAXONOMY_BUILT = ${JSON.stringify(out.built)};
export const TAXONOMY_SOURCE = ${JSON.stringify(out.source)};
export const ALIASES = ${JSON.stringify(ALIASES, null, 1)};
export const TAXA = ${JSON.stringify(taxa)};
`;

if (CHECK) {
  const okJson = fs.existsSync(jsonPath) && (() => {
    const a = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return JSON.stringify(a.taxa) === JSON.stringify(taxa) && JSON.stringify(a.aliases) === JSON.stringify(ALIASES);
  })();
  const okMod = fs.existsSync(modPath) && fs.readFileSync(modPath, 'utf8').includes(JSON.stringify(taxa));
  if (!okJson || !okMod) die(`committed taxonomy is stale (${!okJson ? 'taxonomy.json' : ''}${!okJson && !okMod ? ' and ' : ''}${!okMod ? 'lib/lean-taxonomy.mjs' : ''}); rerun without --check`);
  console.log(`build-taxonomy.mjs --check: ok, ${Object.keys(taxa).length} taxa`);
  process.exit(0);
}

fs.writeFileSync(jsonPath, JSON.stringify(out, null, 1));
fs.writeFileSync(modPath, mod);
console.log(`${path.relative(root, jsonPath)}: ${Object.keys(taxa).length} taxa, ${ANCHOR_NAMES.length - anchorsMissing.length}/${ANCHOR_NAMES.length} anchors placed, ${queries.length} queries (${queries.filter(q => q.cached).length} cached)`);
console.log(`${path.relative(root, modPath)}: ${(mod.length / 1024).toFixed(0)} KB`);
const nRen = Object.keys(anchorAliases).length;
if (nRen) console.log(`  ${nRen} anchor(s) the ontology labels differently, kept as aliases: ${Object.entries(anchorAliases).map(([a, b]) => `${a} -> ${b}`).join(', ')}`);
for (const probe of ['Mus musculus', 'Danio rerio', 'Exocoetidae', 'Cypselurus hiraii']) {
  const e = taxa[probe];
  console.log(`  ${probe.padEnd(18)} ${e ? e.ancestors.slice(0, 6).join(' < ') + ' < ...' : 'NOT PLACED'}`);
}
