#!/usr/bin/env node
// Blind predictions for the held-out exam (holdout/exam.json): for every roster species and every structure in a
// panel defined by Uberon itself, predict present or absent using only Uberon's taxon constraints as served by
// Ubergraph. No trait table, genome or occurrence data is read. The scoring rule is the holdout thread's and is
// committed separately before this file is opened, so neither side can tune to the other.
//
//   node organism-design/exam/predict.mjs            -> organism-design/exam/aves-predictions.json
//
// Panel rule (not hand-picked): every Uberon term in the uberon_slim, organ_slim or major_organ subset that carries a
// taxon constraint of its own: a never_in_taxon axiom, or an in_taxon statement more specific than Vertebrata.
// Prediction rule per (species S, structure X):
//   absent  if X, a superclass of X, or a whole X is part of has never_in_taxon T and S is in T
//   absent  if X has in_taxon T (NCBI taxon) and T neither contains S nor is inside S
//   present otherwise; confidence "stated" if Uberon places X in_taxon or present_in_taxon some T below Vertebrata
//           that contains S, else "default" (the ontology merely does not exclude it)
// All constraint triples are fetched once for the panel; each species contributes only its ancestor list.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const examBytes = fs.readFileSync(path.join(root, 'holdout/exam.json'));
const exam = JSON.parse(examBytes.toString('utf8'));
const checks = JSON.parse(fs.readFileSync(path.join(root, 'holdout/CHECKSUMS.json'), 'utf8'));
const recordedSha = checks.outputs?.['exam.json']?.sha256 || null;
const actualSha = sha(examBytes);

const UBERGRAPH = 'https://ubergraph.apps.renci.org/sparql';
const OBO = 'http://purl.obolibrary.org/obo/';
const PFX = 'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX obo: <http://purl.obolibrary.org/obo/> PREFIX oio: <http://www.geneontology.org/formats/oboInOwl#> ';
const SUB = 'http://purl.obolibrary.org/obo/uberon/core#';
const queries = {}; let qn = 0;
async function sparql(purpose, q) {
  const full = PFX + q; const id = 'q' + String(++qn).padStart(2, '0'); const t0 = Date.now();
  let res, text;
  for (let a = 1; a <= 3; a++) { try { res = await fetch(UBERGRAPH, { method: 'POST', headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/sparql-query', 'User-Agent': 'delphisci-organism-design/0.1' }, body: full }); text = await res.text(); if (res.ok) break; throw new Error('HTTP ' + res.status + ' ' + text.slice(0, 200)); } catch (e) { if (a === 3) throw e; await new Promise(r => setTimeout(r, 2000 * a)); } }
  const rows = JSON.parse(text).results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
  queries[id] = { purpose, endpoint: UBERGRAPH, sparql: full, retrieved: new Date().toISOString(), rows: rows.length, ms: Date.now() - t0 };
  console.error(`  ${id} ${queries[id].ms} ms ${rows.length} rows: ${purpose}`);
  return rows;
}
const short = i => i.replace(OBO, '');
const isTax = v => `REGEX(STR(${v}),'NCBITaxon_[0-9]+$')`;

// 1. The panel.
const panelRows = await sparql('panel: core Uberon terms that carry a taxon constraint of their own', `SELECT DISTINCT ?x ?l WHERE { ?x rdfs:label ?l ; oio:inSubset ?s . FILTER(?s IN (<${SUB}uberon_slim>, <${SUB}organ_slim>, <${SUB}major_organ>)) FILTER(STRSTARTS(STR(?x),'${OBO}UBERON_')) FILTER NOT EXISTS { ?x oio:inSubset ?bad . FILTER(?bad IN (<${SUB}grouping_class>, <${SUB}non_informative>, <${SUB}upper_level>)) } { ?x obo:RO_0002161 ?nt } UNION { ?x obo:RO_0002162 ?t . FILTER(${isTax('?t')}) ?t rdfs:subClassOf obo:NCBITaxon_7742 . FILTER(?t != obo:NCBITaxon_7742) } } ORDER BY ?l`);
const panel = panelRows.map(r => ({ iri: r.x, label: r.l }));
const PV = panel.map(p => `<${p.iri}>`).join(' ');

// 2. All constraint triples for the panel, in chunks (the server times out on one big query).
async function batched(purpose, items, n, build) {
  const rows = [];
  for (let i = 0; i < items.length; i += n) { const chunk = items.slice(i, i + n); rows.push(...await sparql(`${purpose} [${i + 1}-${i + chunk.length} of ${items.length}]`, build(chunk.map(p => `<${p.iri}>`).join(' ')))); }
  return rows;
}
const CH = 40;
const neverSelf = await batched('never_in_taxon on panel terms themselves', panel, CH, V => `SELECT DISTINCT ?x ?nt ?ntl WHERE { VALUES ?x { ${V} } ?x obo:RO_0002161 ?nt . ?nt rdfs:label ?ntl . FILTER(${isTax('?nt')}) }`);
const neverSuper = await batched('never_in_taxon on superclasses of panel terms', panel, CH, V => `SELECT DISTINCT ?x ?anc ?al ?nt ?ntl WHERE { VALUES ?x { ${V} } ?x rdfs:subClassOf ?anc . FILTER(?anc != ?x) ?anc obo:RO_0002161 ?nt . ?anc rdfs:label ?al . ?nt rdfs:label ?ntl . FILTER(${isTax('?nt')}) }`);
const neverWhole = await batched('never_in_taxon on wholes that panel terms are part of', panel, CH, V => `SELECT DISTINCT ?x ?anc ?al ?nt ?ntl WHERE { VALUES ?x { ${V} } ?x obo:BFO_0000050 ?anc . FILTER(?anc != ?x) ?anc obo:RO_0002161 ?nt . ?anc rdfs:label ?al . ?nt rdfs:label ?ntl . FILTER(${isTax('?nt')}) }`);
const never = [...neverSelf.map(r => ({ ...r, via: 'the term itself' })), ...neverSuper.map(r => ({ ...r, via: 'its superclass ' + r.al })), ...neverWhole.map(r => ({ ...r, via: 'its whole ' + r.al }))];
const inTaxon = await batched('in_taxon statements on panel terms (NCBI taxa, uninformative roots dropped)', panel, CH, V => `SELECT DISTINCT ?x ?t ?tl (COUNT(DISTINCT ?sup) AS ?depth) WHERE { VALUES ?x { ${V} } ?x obo:RO_0002162 ?t . ?t rdfs:label ?tl . FILTER(${isTax('?t')}) FILTER(?t NOT IN (obo:NCBITaxon_1, obo:NCBITaxon_131567, obo:NCBITaxon_2759, obo:NCBITaxon_33154)) ?t rdfs:subClassOf ?sup } GROUP BY ?x ?t ?tl`);
const present = await batched('present_in_taxon statements on panel terms', panel, CH, V => `SELECT DISTINCT ?x ?t ?tl (COUNT(DISTINCT ?sup) AS ?depth) WHERE { VALUES ?x { ${V} } ?x obo:RO_0002175 ?t . ?t rdfs:label ?tl . FILTER(${isTax('?t')}) ?t rdfs:subClassOf ?sup } GROUP BY ?x ?t ?tl`);
const vertRows = await sparql('taxa below Vertebrata among those mentioned by the constraints', `SELECT DISTINCT ?t WHERE { VALUES ?t { ${[...new Set([...inTaxon, ...present].map(r => `<${r.t}>`))].join(' ')} } ?t rdfs:subClassOf obo:NCBITaxon_7742 . FILTER(?t != obo:NCBITaxon_7742) }`);
const belowVert = new Set(vertRows.map(r => r.t));

// 3. Species in the roster: label and full ancestor list (including self), one query.
const roster = exam.roster.filter(r => r.ids?.ncbi).map(r => ({ key: r.key, name: r.name, taxid: r.ids.ncbi, iri: `${OBO}NCBITaxon_${r.ids.ncbi}` }));
const taxaMentioned = new Set([...never.map(r => r.nt), ...inTaxon.map(r => r.t), ...present.map(r => r.t)]);
const ancRows = await sparql('ancestors of each roster species among the taxa the constraints mention', `SELECT ?s ?l ?anc WHERE { VALUES ?s { ${roster.map(r => `<${r.iri}>`).join(' ')} } ?s rdfs:label ?l . OPTIONAL { VALUES ?anc { ${[...taxaMentioned].map(t => `<${t}>`).join(' ')} } ?s rdfs:subClassOf ?anc } }`);
const anc = {}, label = {};
for (const r of ancRows) { label[r.s] = r.l; (anc[r.s] ??= new Set([r.s])); if (r.anc) anc[r.s].add(r.anc); }
// Is constraint taxon T inside the species S (T a subclass of S)? Only possible for taxa below species rank; one query.
const insideRows = await sparql('constraint taxa that are inside a roster species (subspecies, strains)', `SELECT ?s ?t WHERE { VALUES ?s { ${roster.map(r => `<${r.iri}>`).join(' ')} } VALUES ?t { ${[...taxaMentioned].map(t => `<${t}>`).join(' ')} } ?t rdfs:subClassOf ?s . FILTER(?t != ?s) }`);
const inside = {}; for (const r of insideRows) (inside[r.s] ??= new Set()).add(r.t);

// 4. Compute.
const neverBy = {}; for (const r of never) (neverBy[r.x] ??= []).push(r);
const inBy = {}; for (const r of inTaxon) (inBy[r.x] ??= []).push({ ...r, depth: +r.depth });
const presBy = {}; for (const r of present) (presBy[r.x] ??= []).push({ ...r, depth: +r.depth });
const predictions = [], skipped = [];
for (const sp of roster) {
  if (!label[sp.iri]) { skipped.push({ ...sp, reason: 'taxon id not in Ubergraph' }); continue; }
  const A = anc[sp.iri], I = inside[sp.iri] || new Set();
  for (const p of panel) {
    let predicted, reason, confidence;
    const nv = (neverBy[p.iri] || []).find(r => A.has(r.nt));
    const only = (inBy[p.iri] || []).find(r => !A.has(r.t) && !I.has(r.t));
    const stated = [...(inBy[p.iri] || []).filter(r => belowVert.has(r.t) && A.has(r.t)).map(r => ({ ...r, rel: 'in_taxon' })), ...(presBy[p.iri] || []).filter(r => belowVert.has(r.t) && A.has(r.t)).map(r => ({ ...r, rel: 'present_in_taxon' }))].sort((a, b) => b.depth - a.depth)[0];
    if (nv) { predicted = 'absent'; confidence = 'stated'; reason = `Uberon: never_in_taxon ${nv.ntl} (on ${nv.via}); ${sp.name} is in ${nv.ntl}`; }
    else if (only) { predicted = 'absent'; confidence = 'stated'; reason = `Uberon: in_taxon ${only.tl}, which does not contain ${sp.name}`; }
    else if (stated) { predicted = 'present'; confidence = 'stated'; reason = `Uberon: ${stated.rel} ${stated.tl}, which contains ${sp.name}`; }
    else { predicted = 'present'; confidence = 'default'; reason = 'Uberon states no constraint that excludes it for this species, and no presence more specific than Vertebrata; default is present'; }
    predictions.push({ taxid: sp.taxid, species: sp.name, roster_key: sp.key, structure_iri: p.iri, label: p.label, predicted, confidence, reason });
  }
}

const tally = { present_stated: 0, present_default: 0, absent: 0 };
for (const p of predictions) { if (p.predicted === 'absent') tally.absent++; else if (p.confidence === 'stated') tally.present_stated++; else tally.present_default++; }
const out = {
  tool: 'organism-design/exam/predict.mjs',
  built: new Date().toISOString(),
  exam: { file: 'holdout/exam.json', clade: exam.clade, provisional: exam.provisional, sha256_recorded_in_checksums: recordedSha, sha256_computed: actualSha, matches: recordedSha === actualSha, roster_size: exam.roster.length },
  inputs_read: ['holdout/exam.json (identifiers only)', 'holdout/CHECKSUMS.json', 'Ubergraph SPARQL endpoint (Uberon, NCBI Taxonomy)'],
  inputs_not_read: ['AVONET', 'AnAge', 'EltonTraits', 'Amniote database', 'genomes', 'occurrence counts', 'any bird trait value'],
  panel: { rule: 'Uberon terms in uberon_slim, organ_slim or major_organ with a never_in_taxon axiom or an in_taxon more specific than Vertebrata; grouping, non-informative and upper-level terms excluded', size: panel.length, structures: panel, query: 'q01' },
  species_predicted: roster.length - skipped.length, species_skipped: skipped,
  tally,
  predictions,
  queries,
  honesty: ['Predictions come only from Uberon taxon constraints, so they are the same for every species inside the same constrained clade. Differences between bird species cannot appear unless Uberon states them.', 'A "default" presence is not a claim that the species has the structure; it says the ontology does not rule it out. The scorer may treat default and stated differently.', 'The panel is whatever Uberon constrains, not a list chosen by the builder.']
};
fs.writeFileSync(path.join(here, 'aves-predictions.json'), JSON.stringify(out, null, 1));
console.log(`aves-predictions.json: ${panel.length} structures x ${roster.length - skipped.length} species = ${predictions.length} predictions; absent ${tally.absent}, present (stated) ${tally.present_stated}, present (default) ${tally.present_default}; exam sha matches: ${recordedSha === actualSha}; skipped ${skipped.length}`);
