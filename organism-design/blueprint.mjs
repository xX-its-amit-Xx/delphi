#!/usr/bin/env node
// Text-to-blueprint: turn a plain-language organism description into a
// body > organ system > organ > tissue > cell hierarchy, where every node is an
// existing ontology term (Uberon for anatomy, Cell Ontology for cells, NCBI Taxonomy
// for the organism, Gene Ontology for functions) and every edge comes from a query
// whose text is stored in the output.
//
//   node organism-design/blueprint.mjs "a teleost fish that swims with fins" [--out file.json]
//                                       [--organs 6] [--tissues 6] [--cells 8] [--offline] [--verbose]
//
// Sources (all public, no credentials):
//   Ubergraph  https://ubergraph.apps.renci.org/sparql  (Uberon + CL + GO + NCBITaxon with
//              precomputed part_of / subClassOf closures and taxon constraints)
//   organisms/merged/taxa.json  the team's species inventory (common names -> NCBI taxid)
//   holdout/exam.json           the frozen held-out clade; descriptions that resolve inside it are refused
// Every SPARQL response is cached under organism-design/cache/<sha256 of query>.json so a
// clean checkout reproduces the same blueprint offline (--offline fails instead of fetching).
//
// What this is NOT: it does not design organisms, predict genomes or infer anything the
// ontologies do not state. The "genome sketch" section lists marker gene products that the
// Cell Ontology records for the chosen cell types. It is labelled a sketch for that reason.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const valueFlags = new Set(['--out', '--organs', '--tissues', '--cells']);
const description = args.filter((a, i) => !a.startsWith('--') && !valueFlags.has(args[i - 1])).join(' ').trim();
if (!description) { console.error('usage: node organism-design/blueprint.mjs "<organism description>" [--out f.json]'); process.exit(2); }
const LIM = { organs: +arg('organs', 6), tissues: +arg('tissues', 6), cells: +arg('cells', 8), genes: 12 };
const OFFLINE = flag('offline');

const UBERGRAPH = 'https://ubergraph.apps.renci.org/sparql';
const OBO = 'http://purl.obolibrary.org/obo/';
const cacheDir = path.join(here, 'cache');
fs.mkdirSync(cacheDir, { recursive: true });
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const lexicon = JSON.parse(fs.readFileSync(path.join(here, 'lexicon.json'), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'organisms/merged/taxa.json'), 'utf8'));
const examPath = path.join(root, 'holdout/exam.json');
const exam = fs.existsSync(examPath) ? JSON.parse(fs.readFileSync(examPath, 'utf8')) : null;

const queries = {};   // id -> { purpose, endpoint, sparql, retrieved, cached, rows, ms }
const writtenThisRun = [];
let qn = 0;
async function cachedFetch(key, url, init, parse) {
  const f = path.join(cacheDir, sha(key) + '.json');
  if (fs.existsSync(f)) { const c = JSON.parse(fs.readFileSync(f, 'utf8')); return { data: c.data, retrieved: c.retrieved, cached: true }; }
  if (OFFLINE) throw new Error('offline and not cached: ' + key.slice(0, 120));
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}: ${(await res.text()).slice(0, 200)}`);
      const data = parse(await res.text());
      const retrieved = new Date().toISOString();
      fs.writeFileSync(f, JSON.stringify({ key: key.slice(0, 6000), url, retrieved, data }));
      writtenThisRun.push(f);
      return { data, retrieved, cached: false };
    } catch (e) { if (attempt === 3) throw e; await new Promise(r => setTimeout(r, 1500 * attempt)); }
  }
}
const PFX = 'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX obo: <http://purl.obolibrary.org/obo/> PREFIX oio: <http://www.geneontology.org/formats/oboInOwl#> ';
async function sparql(purpose, q) {
  const full = PFX + q;
  const id = 'q' + String(++qn).padStart(2, '0');
  const t0 = Date.now();
  // POST, because the server refuses long GET URLs with 403.
  const r = await cachedFetch('sparql:' + full, UBERGRAPH, { method: 'POST', headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/sparql-query', 'User-Agent': 'delphisci-organism-design/0.1' }, body: full }, t => JSON.parse(t).results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value]))));
  queries[id] = { purpose, endpoint: UBERGRAPH, sparql: full, retrieved: r.retrieved, cached: r.cached, rows: r.data.length, ms: Date.now() - t0 };
  if (flag('verbose')) console.error(`  ${id} ${queries[id].ms} ms ${r.cached ? '(cache)' : ''} ${r.data.length} rows: ${purpose}`);
  return { id, rows: r.data };
}
const short = iri => iri.replace(OBO, '');

// ---------------------------------------------------------------- 1. read the description
const text = description.toLowerCase().replace(/[^a-z0-9\- ]/g, ' ').replace(/\s+/g, ' ').trim();
const words = text.split(' ');
const grams = [];
for (let n = 3; n >= 1; n--) for (let i = 0; i + n <= words.length; i++) grams.push(words.slice(i, i + n).join(' '));

const found = { taxon: [], anatomy: [], functions: [], habitat: [] };
// 1a. taxon: the team's inventory first (common and scientific names), then the lexicon.
const invIndex = new Map();
for (const t of inventory) {
  if (!t.identifiers?.ncbi_taxid) continue;
  const names = [t.accepted_name, ...(t.vernacular || []), ...(t.names_as_written || [])].map(s => String(s).toLowerCase());
  for (const n of names) if (n.length > 3 && !invIndex.has(n)) invIndex.set(n, t);
}
for (const g of grams) {
  const t = invIndex.get(g);
  if (t && !found.taxon.some(x => x.taxid === t.identifiers.ncbi_taxid)) found.taxon.push({ matched: g, taxid: t.identifiers.ncbi_taxid, name: t.accepted_name, rank: t.rank, source: { file: 'organisms/merged/taxa.json', key: t.key, gbif: t.identifiers.gbif_usage_key || null, wikidata: t.identifiers.wikidata_qid || null } });
  const lx = lexicon.taxon_words[g] || lexicon.taxon_words[g.replace(/s$/, '')];
  if (lx && !found.taxon.some(x => 'NCBITaxon_' + x.taxid === lx)) found.taxon.push({ matched: g, taxid: +lx.replace('NCBITaxon_', ''), source: { file: 'organism-design/lexicon.json', entry: 'taxon_words.' + g } });
}
// 1b. anatomy words.
for (const g of grams) {
  const a = lexicon.anatomy_words[g];
  if (a && typeof a === 'string' && !found.anatomy.some(x => x.term === a)) found.anatomy.push({ matched: g, term: a, source: { file: 'organism-design/lexicon.json', entry: 'anatomy_words.' + g } });
}
// 1c. functions (stem match with a real inflection, so "hear" does not match "heart") and habitat.
for (const [stem, v] of Object.entries(lexicon.function_words)) {
  if (stem.startsWith('_')) continue;
  const re = new RegExp('^' + stem.replace(/[-]/g, '\\-') + '(s|es|ed|ing|ion|ions|ation|ive|ory|al|ly|esis|tion|tive|e)?$');
  const hit = stem.includes(' ') ? text.includes(stem) : words.some(w => re.test(w));
  if (hit && !found.functions.some(x => x.go === v.go)) found.functions.push({ matched: stem, go: v.go, curated_structures: v.structures, source: { file: 'organism-design/lexicon.json', entry: 'function_words.' + stem } });
}
for (const [w, env] of Object.entries(lexicon.habitat_words)) if (!w.startsWith('_') && grams.includes(w)) found.habitat.push({ matched: w, term: env, source: { file: 'organism-design/lexicon.json', entry: 'habitat_words.' + w }, used_for_filtering: false });

// Pick the most specific taxon: the one that is a subclass of all the others (checked live).
let taxon = null;
if (found.taxon.length) {
  const ids = found.taxon.map(t => 'obo:NCBITaxon_' + t.taxid);
  const r = await sparql('labels and subclass relations among the taxon words found', `SELECT ?t ?l ?sup WHERE { VALUES ?t { ${ids.join(' ')} } ?t rdfs:label ?l . OPTIONAL { VALUES ?sup { ${ids.join(' ')} } ?t rdfs:subClassOf ?sup . FILTER(?t != ?sup) } }`);
  const info = {};
  for (const row of r.rows) { const t = short(row.t); info[t] ??= { label: row.l, supers: new Set() }; if (row.sup) info[t].supers.add(short(row.sup)); }
  let best = null;
  for (const [t, v] of Object.entries(info)) if (!best || v.supers.size > info[best].supers.size) best = t;
  for (const ft of found.taxon) { const k = 'NCBITaxon_' + ft.taxid; ft.label = info[k]?.label || null; ft.verified_by = r.id; }
  if (best) taxon = { term: best, taxid: +best.replace('NCBITaxon_', ''), label: info[best].label, iri: OBO + best, chosen_because: 'most specific of the taxon words found (subclass of the others)', verified_by: r.id };
}
if (!taxon) taxon = { term: 'NCBITaxon_33208', taxid: 33208, label: 'Metazoa', iri: OBO + 'NCBITaxon_33208', chosen_because: 'no taxon word recognised in the description; defaulting to all animals, so no taxon constraint removes any structure' };

// Holdout guard: the frozen exam clade (holdout/exam.json) is off limits to builders. A description that resolves
// to a taxon inside it is refused; one that merely contains it (e.g. "vertebrate") is flagged.
let holdout = { checked: false };
if (exam?.clade) {
  const cladeIri = exam.clade === 'Aves' ? 'obo:NCBITaxon_8782' : null;
  if (cladeIri) {
    const r = await sparql(`holdout check: is ${taxon.label} inside, or does it contain, the held-out clade ${exam.clade}`, `SELECT ?inside ?contains WHERE { BIND(EXISTS { obo:${taxon.term} rdfs:subClassOf ${cladeIri} } AS ?inside) BIND(EXISTS { ${cladeIri} rdfs:subClassOf obo:${taxon.term} } AS ?contains) }`);
    const row = r.rows[0] || {};
    holdout = { checked: true, clade: exam.clade, provisional: !!exam.provisional, inside: row.inside === 'true', contains: row.contains === 'true', via: r.id, source: 'holdout/exam.json' };
    if (holdout.inside && !flag('allow-holdout')) {
      // Refuse, and leave no trace: no example file, and no cached query naming the held-out taxon (the holdout
      // thread's leak checker scans this folder). The refusal is reported on stdout only.
      for (const f of writtenThisRun) { try { fs.unlinkSync(f); } catch {} }
      console.log(`REFUSED: the description resolves to ${taxon.label}, which is inside the held-out clade ${exam.clade}. Builders must not work on held-out organisms (holdout/exam.json). Nothing was written. Rerun with --allow-holdout only for the exam itself.`);
      process.exitCode = 3;
      await new Promise(r => setTimeout(r, 100)); // let the fetch handle close before exiting (avoids a libuv assertion on Windows)
      process.exit(3);
    }
  }
}

const T = 'obo:' + taxon.term;
// Is the taxon a vertebrate? If not, terms Uberon marks "vertebrate_core" are excluded too, because Uberon states
// taxon constraints mainly for vertebrate anatomy and leaves most vertebrate-only terms unconstrained.
const vertQ = await sparql(`is ${taxon.label} a vertebrate (subclass of Vertebrata)`, `SELECT ?v WHERE { BIND(EXISTS { ${T} rdfs:subClassOf obo:NCBITaxon_7742 } AS ?v) }`);
const VERT = vertQ.rows[0]?.v === 'true';
// Taxon filter. Uberon and CL state taxon constraints two ways:
//  never_in_taxon (RO_0002161) on the term, a superclass, or a whole it is part of: drop if the forbidden taxon contains ours.
//  in_taxon (RO_0002162, materialized from "in taxon" / only_in_taxon axioms): drop if the stated taxon neither
//  contains nor is contained in ours (e.g. mammary gland in Mammalia, for a fish).
// Absence of a constraint does not mean the taxon has the structure: Uberon's constraints are sparse.
const taxonFilter = v => `FILTER NOT EXISTS { { ${v} obo:RO_0002161 ?nt } UNION { ${v} rdfs:subClassOf ?anc . ?anc obo:RO_0002161 ?nt } UNION { ${v} obo:BFO_0000050 ?anc . ?anc obo:RO_0002161 ?nt } ${T} rdfs:subClassOf ?nt } FILTER NOT EXISTS { ${v} obo:RO_0002162 ?it . FILTER(REGEX(STR(?it),'NCBITaxon_[0-9]+$')) FILTER NOT EXISTS { ${T} rdfs:subClassOf ?it } FILTER NOT EXISTS { ?it rdfs:subClassOf ${T} } }${VERT ? '' : ` FILTER NOT EXISTS { ${v} oio:inSubset <http://purl.obolibrary.org/obo/uberon/core#vertebrate_core> }`}`;
const isU = v => `FILTER(STRSTARTS(STR(${v}),'${OBO}UBERON_'))`;
const isCL = v => `FILTER(STRSTARTS(STR(${v}),'${OBO}CL_'))`;
const SUBSET = 'http://purl.obolibrary.org/obo/uberon/core#';
const sub = s => `<${SUBSET}${s}>`;

// ---------------------------------------------------------------- 2. verify anatomy and function terms
const nodes = [];  // { id, iri, label, level, parent, relation, ontology, via: queryId, ... }
const addNode = n => { if (!nodes.some(x => x.iri === n.iri && x.parent === n.parent)) nodes.push(n); return n; };
const BODY = OBO + 'UBERON_0000468';
const anatomyIris = new Set(found.anatomy.map(a => OBO + a.term));
for (const f of found.functions) for (const s of f.curated_structures) anatomyIris.add(OBO + s);
const termLabels = {};
{
  const want = [...anatomyIris, ...found.functions.map(f => OBO + f.go), ...found.habitat.map(h => OBO + h.term), BODY];
  const r = await sparql('labels of the terms named by the description', `SELECT ?t ?l WHERE { VALUES ?t { ${want.map(i => `<${i}>`).join(' ')} } ?t rdfs:label ?l }`);
  for (const row of r.rows) termLabels[row.t] = row.l;
  for (const a of found.anatomy) { a.label = termLabels[OBO + a.term] || null; a.verified_by = r.id; }
  for (const f of found.functions) { f.label = termLabels[OBO + f.go] || null; f.verified_by = r.id; }
  for (const h of found.habitat) { h.label = termLabels[OBO + h.term] || null; h.verified_by = r.id; }
}
// Functions: does the ontology itself link a structure to the process (capable_of or capable_of_part_of)?
for (const f of found.functions) {
  const r = await sparql(`structures the ontologies record as capable of "${f.label}" (${f.go}) or a subtype of it, allowed for ${taxon.label}`, `SELECT DISTINCT ?s ?l ?rel WHERE { VALUES ?rel { obo:RO_0002215 obo:RO_0002216 } ?g rdfs:subClassOf obo:${f.go} . ?s ?rel ?g ; rdfs:label ?l . FILTER(STRSTARTS(STR(?s),'${OBO}UBERON_') || STRSTARTS(STR(?s),'${OBO}CL_')) ${taxonFilter('?s')} } LIMIT 40`);
  f.ontology_structures = r.rows.map(x => ({ iri: x.s, label: x.l, relation: short(x.rel) === 'RO_0002215' ? 'capable_of' : 'capable_of_part_of' }));
  f.ontology_structures_query = r.id;
  // Only organ-level structures from the ontology link are promoted into the blueprint (not cells, not whole systems).
  for (const x of f.ontology_structures.filter(x => x.iri.includes('UBERON_') && !/system$/.test(x.label)).slice(0, 3)) anatomyIris.add(x.iri);
}
// Taxon check on the named anatomy: a structure the description names but the taxon cannot have is reported, not silently kept.
let anatomyCheckQuery = null;
const anatomyOk = new Map();
if (anatomyIris.size) {
  const r = await sparql('which named structures the taxon constraints allow for ' + taxon.label, `SELECT ?s ?l WHERE { VALUES ?s { ${[...anatomyIris].map(i => `<${i}>`).join(' ')} } ?s rdfs:label ?l . ${taxonFilter('?s')} }`);
  for (const i of anatomyIris) anatomyOk.set(i, r.rows.some(x => x.s === i));
  for (const row of r.rows) termLabels[row.s] = row.l;
  anatomyCheckQuery = r.id;
}
const conflicts = [...anatomyIris].filter(i => !anatomyOk.get(i)).map(i => ({ iri: i, label: termLabels[i] || short(i), note: `Uberon's taxon constraints say "${termLabels[i] || short(i)}" does not occur in ${taxon.label}; kept out of the blueprint and reported here.` }));
const keptAnatomy = [...anatomyIris].filter(i => anatomyOk.get(i));

// ---------------------------------------------------------------- 3. the hierarchy
addNode({ id: 'body', iri: BODY, label: termLabels[BODY] || 'multicellular organism', level: 'body', parent: null, relation: null, ontology: 'UBERON', taxon: taxon.term, taxon_label: taxon.label });

// 3a. Organ systems. Candidates: subclasses of "anatomical system" that Uberon itself marks as a core term (its
// uberon_slim, efo_slim or vertebrate_core subset), allowed for the taxon. Keep the most general ones: drop a
// candidate that has another candidate as superclass or as whole (part_of), so "cardiovascular system" folds into
// "circulatory system" and "female reproductive system" into "reproductive system".
const SYS_SUBSETS = ['uberon_slim', 'efo_slim', 'vertebrate_core'];
const sysCand = `?x rdfs:subClassOf obo:UBERON_0000467 . FILTER(?x != obo:UBERON_0000467) ${isU('?x')} ?x oio:inSubset ?xs . FILTER(?xs IN (${SYS_SUBSETS.map(sub).join(',')})) ${taxonFilter('?x')}`;
const sysQ = await sparql('organ systems allowed for ' + taxon.label, `SELECT DISTINCT ?s ?l WHERE { ${sysCand.replace(/\?x/g, '?s').replace(/\?xs/g, '?ss')} ?s rdfs:label ?l . FILTER NOT EXISTS { ?s rdfs:subClassOf ?o . FILTER(?o != ?s) ${sysCand.replace(/\?x/g, '?o').replace(/\?xs/g, '?os')} } FILTER NOT EXISTS { ?s obo:BFO_0000050 ?w . FILTER(?w != ?s) ${sysCand.replace(/\?x/g, '?w').replace(/\?xs/g, '?ws')} } } ORDER BY ?l`);
let systems = sysQ.rows.map(r => ({ iri: r.s, label: r.l }));
// Systems the named organs belong to must be present even if the rule above dropped them.
const organSystem = {};  // organ iri -> system iri
let organSystemQuery = null;
if (keptAnatomy.length) {
  const r = await sparql('which organ system each named structure belongs to', `SELECT ?o ?s ?l WHERE { VALUES ?o { ${keptAnatomy.map(i => `<${i}>`).join(' ')} } ?o obo:BFO_0000050 ?s . ?s rdfs:subClassOf obo:UBERON_0000467 ; rdfs:label ?l . FILTER(?s != obo:UBERON_0000467) ${isU('?s')} ${taxonFilter('?s')} }`);
  for (const row of r.rows) if (systems.find(s => s.iri === row.s)) organSystem[row.o] ??= row.s;
  for (const row of r.rows) if (!organSystem[row.o]) { organSystem[row.o] = row.s; if (!systems.some(s => s.iri === row.s)) systems.push({ iri: row.s, label: row.l, added_because: 'a structure named in the description is part of it' }); }
  organSystemQuery = r.id;
}
for (const s of systems) addNode({ id: short(s.iri), iri: s.iri, label: s.label, level: 'organ_system', parent: BODY, relation: 'part_of', ontology: 'UBERON', via: sysQ.id, added_because: s.added_because || null });

// 3b. Organs per system. Candidates: parts of the system that are organs and that Uberon marks as a core organ
// (major_organ, organ_slim, efo_slim or vertebrate_core subset), excluding its grouping classes. Ranked: major
// organs first, then by how many Cell Ontology cell types are recorded for them (a proxy for how well described
// the organ is, not for importance).
const ORGAN_SUBSETS = ['major_organ', 'organ_slim', 'efo_slim', 'vertebrate_core'];
const organs = [];
let organQuery = null;
if (systems.length) {
  const r = await sparql('core organs in each system, with the number of cell types recorded for each', `SELECT ?sys ?o ?l (MAX(IF(?os = ${sub('major_organ')}, 1, 0)) AS ?major) (COUNT(DISTINCT ?c) AS ?ncells) WHERE { VALUES ?sys { ${systems.map(s => `<${s.iri}>`).join(' ')} } ?o obo:BFO_0000050 ?sys ; rdfs:subClassOf obo:UBERON_0000062 ; rdfs:label ?l ; oio:inSubset ?os . FILTER(?os IN (${ORGAN_SUBSETS.map(sub).join(',')})) FILTER NOT EXISTS { ?o oio:inSubset ?bad . FILTER(?bad IN (${sub('grouping_class')}, ${sub('non_informative')}, ${sub('upper_level')})) } ${isU('?o')} ${taxonFilter('?o')} OPTIONAL { ?c obo:BFO_0000050 ?o . ${isCL('?c')} } } GROUP BY ?sys ?o ?l ORDER BY ?sys DESC(?major) DESC(?ncells) ?l`);
  const per = {};
  for (const row of r.rows) (per[row.sys] ??= []).push({ iri: row.o, label: row.l, ncells: +row.ncells, major: row.major === '1' });
  for (const s of systems) {
    const list = per[s.iri] || [];
    const named = list.filter(o => keptAnatomy.includes(o.iri) && organSystem[o.iri] === s.iri);
    const rest = list.filter(o => !named.includes(o)).slice(0, Math.max(0, LIM.organs - named.length));
    for (const o of [...named, ...rest]) { organs.push({ ...o, system: s.iri, named: named.includes(o) }); addNode({ id: short(o.iri), iri: o.iri, label: o.label, level: 'organ', parent: s.iri, relation: 'part_of', ontology: 'UBERON', via: r.id, major_organ: o.major, cell_types_recorded: o.ncells, named_in_description: named.includes(o), organs_available_in_system: list.length }); }
  }
  organQuery = r.id;
}
// Named structures that are not core organs in Uberon's sense (e.g. "limb", "fin", "shell", "feather") still
// belong in the blueprint: attach them under their system, or under the body.
for (const i of keptAnatomy) if (!organs.some(o => o.iri === i)) {
  const parent = organSystem[i] || BODY;
  organs.push({ iri: i, label: termLabels[i] || short(i), system: parent, named: true });
  addNode({ id: short(i), iri: i, label: termLabels[i] || short(i), level: 'organ', parent, relation: 'part_of', ontology: 'UBERON', via: anatomyCheckQuery, named_in_description: true, note: parent === BODY ? 'Uberon does not place this structure in an organ system; shown directly under the body.' : null });
}
// A system with no organ left for this taxon is dropped (it would be an empty heading).
for (const s of systems) if (!organs.some(o => o.system === s.iri)) { const i = nodes.findIndex(n => n.iri === s.iri && n.level === 'organ_system'); if (i >= 0) nodes.splice(i, 1); }
systems = systems.filter(s => organs.some(o => o.system === s.iri));

// What does Uberon actually state about each organ and the taxon? Record the most specific taxon the ontology
// places the organ in (in_taxon) that contains ours, skipping the uninformative roots. "Metazoa" or nothing means
// the organ is merely not excluded, not stated present.
if (organs.length) {
  const r = await sparql('taxa Uberon states each organ occurs in (in_taxon), restricted to ancestors of ' + taxon.label + ', with the depth of each taxon', `SELECT ?o ?t ?l (COUNT(DISTINCT ?sup) AS ?depth) WHERE { VALUES ?o { ${organs.map(o => `<${o.iri}>`).join(' ')} } ?o obo:RO_0002162 ?t . ?t rdfs:label ?l . FILTER(REGEX(STR(?t),'NCBITaxon_[0-9]+$')) FILTER(?t NOT IN (obo:NCBITaxon_1, obo:NCBITaxon_131567, obo:NCBITaxon_2759, obo:NCBITaxon_33154)) ${T} rdfs:subClassOf ?t . ?t rdfs:subClassOf ?sup . } GROUP BY ?o ?t ?l`);
  const ev = {};
  for (const row of r.rows) if (!ev[row.o] || +row.depth > ev[row.o].depth) ev[row.o] = { iri: row.t, label: row.l, depth: +row.depth };
  for (const n of nodes) if (n.level === 'organ') { n.stated_in_taxon = ev[n.iri] || null; n.taxon_evidence = ev[n.iri] ? (ev[n.iri].label === 'Metazoa' ? 'weak: stated only for all animals' : 'stated for ' + ev[n.iri].label) : 'none: not excluded, not stated'; n.taxon_evidence_query = r.id; }
}

// 3c. Tissues and 3d. cells for every organ, in two batched queries.
if (organs.length) {
  const V = organs.map(o => `<${o.iri}>`).join(' ');
  const tq = await sparql('tissues that are part of each organ', `SELECT ?o ?t ?l (COUNT(DISTINCT ?c) AS ?ncells) WHERE { VALUES ?o { ${V} } ?t obo:BFO_0000050 ?o ; rdfs:subClassOf obo:UBERON_0000479 ; rdfs:label ?l . ${isU('?t')} ${taxonFilter('?t')} OPTIONAL { ?c obo:BFO_0000050 ?t . ${isCL('?c')} } } GROUP BY ?o ?t ?l ORDER BY ?o DESC(?ncells) ?l`);
  const perT = {};
  for (const row of tq.rows) (perT[row.o] ??= []).push(row);
  for (const o of organs) for (const row of (perT[o.iri] || []).slice(0, LIM.tissues)) addNode({ id: short(row.t), iri: row.t, label: row.l, level: 'tissue', parent: o.iri, relation: 'part_of', ontology: 'UBERON', via: tq.id, cell_types_recorded: +row.ncells, tissues_available_in_organ: perT[o.iri].length });
  const cq = await sparql('cell types that are part of each organ', `SELECT ?o ?c ?l WHERE { VALUES ?o { ${V} } ?c obo:BFO_0000050 ?o ; rdfs:subClassOf obo:CL_0000000 ; rdfs:label ?l . ${isCL('?c')} ${taxonFilter('?c')} } ORDER BY ?o ?l`);
  const perC = {};
  for (const row of cq.rows) (perC[row.o] ??= []).push(row);
  for (const o of organs) for (const row of (perC[o.iri] || []).slice(0, LIM.cells)) addNode({ id: short(row.c), iri: row.c, label: row.l, level: 'cell', parent: o.iri, relation: 'part_of', ontology: 'CL', via: cq.id, cell_types_available_in_organ: perC[o.iri].length });
}

// ---------------------------------------------------------------- 4. genome sketch (labelled)
const cellIris = [...new Set(nodes.filter(n => n.level === 'cell').map(n => n.iri))];
const sketch = { label: 'SKETCH', note: 'Not a genome. These are marker gene products (Protein Ontology terms) that the Cell Ontology or its Provisional Cell Ontology extension records as expressed by the listed cell types (relation RO_0002292 "expresses"), reduced to the most specific term per cell. Most cell types carry no such annotation, so absence means nothing. Predicting a genome from a description is out of scope and would be labelled a sketch too.', cells_with_markers: 0, cells_total: cellIris.length, markers: [] };
if (cellIris.length) {
  const r = await sparql('gene products recorded as expressed by the chosen cell types (most specific term per cell)', `SELECT DISTINCT ?c ?cl ?g ?gl WHERE { VALUES ?c { ${cellIris.map(i => `<${i}>`).join(' ')} } ?c obo:RO_0002292 ?g ; rdfs:label ?cl . ?g rdfs:label ?gl . FILTER(STRSTARTS(STR(?g),'${OBO}PR_')) FILTER NOT EXISTS { ?c obo:RO_0002292 ?g2 . ?g2 rdfs:subClassOf ?g . FILTER(?g2 != ?g) FILTER(STRSTARTS(STR(?g2),'${OBO}PR_')) } } ORDER BY ?cl ?gl`);
  const per = {};
  for (const row of r.rows) { const e = (per[row.c] ??= { cell: row.c, cell_label: row.cl, gene_products: [] }); if (!e.gene_products.some(g => g.iri === row.g)) e.gene_products.push({ iri: row.g, label: row.gl, ontology: 'PR' }); }
  sketch.markers = Object.values(per).map(x => ({ cell: x.cell, cell_label: x.cell_label, gene_products: x.gene_products.slice(0, LIM.genes), total: x.gene_products.length }));
  sketch.cells_with_markers = sketch.markers.length;
  sketch.via = r.id;
}

// ---------------------------------------------------------------- 5. write
const levels = ['body', 'organ_system', 'organ', 'tissue', 'cell'];
const counts = Object.fromEntries(levels.map(l => [l, nodes.filter(n => n.level === l).length]));
const out = {
  tool: 'organism-design/blueprint.mjs',
  built: new Date().toISOString(),
  input: { description },
  reading: { taxon, taxon_words: found.taxon, anatomy_words: found.anatomy, function_words: found.functions, habitat_words: found.habitat, conflicts, organ_system_query: organSystemQuery, organ_query: organQuery },
  holdout,
  limits: LIM,
  counts,
  nodes,
  genome_sketch: sketch,
  queries,
  honesty: [
    'Every node is an existing ontology term; the tool invents no names or identifiers.',
    'Edges are Uberon/CL part_of or subClassOf statements as served by Ubergraph on the retrieval date, including inferred ones.',
    'Taxon constraints (never_in_taxon on the term, its superclasses or its wholes; in_taxon on the term) remove structures the ontology says the taxon cannot have. For non-vertebrates, terms Uberon marks vertebrate_core are removed as well. Absence of a constraint does not mean the taxon has the structure: each organ carries taxon_evidence saying whether Uberon states it for an ancestor of the taxon or merely does not exclude it.',
    'Organ systems and organs are limited to terms Uberon marks in its own core subsets (uberon_slim, efo_slim, vertebrate_core, major_organ, organ_slim); structures named in the description are kept regardless.',
    'Organs are ranked major organs first, then by how many cell types the Cell Ontology records for them, which measures curation effort, not biology.',
    'Links from a function word to a structure come either from the ontology (capable_of, reported as such) or from the hand-written lexicon (reported as curated).',
    'The genome sketch is marker gene products from the Cell Ontology, not a genome.',
    'Descriptions that resolve inside the held-out clade are refused and leave no file behind; the check and its query are recorded under "holdout" for every built blueprint.'
  ]
};
const slug = description.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const outPath = arg('out', path.join(here, 'examples', slug + '.json'));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
const cached = Object.values(queries).filter(q => q.cached).length;
console.log(`${outPath}\n  taxon: ${taxon.label} (${taxon.term}); systems ${counts.organ_system}, organs ${counts.organ}, tissues ${counts.tissue}, cells ${counts.cell}; markers for ${sketch.cells_with_markers} cell types; ${Object.keys(queries).length} queries (${cached} from cache)${conflicts.length ? '\n  conflicts: ' + conflicts.map(c => c.label).join(', ') : ''}${holdout.contains ? '\n  note: the taxon contains the held-out clade ' + holdout.clade : ''}`);
