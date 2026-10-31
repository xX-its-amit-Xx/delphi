// Builds one unsigned Project Delphi nanopub per record of the organism thread, using the
// upstream builders (project-delphi-ontology/pipeline) so the triples match ontology v2.0.
//
//   DELPHI_PIPELINE=C:/Temp/pdo/pipeline NANOPUB_ORCID=https://orcid.org/0000-... \
//     node organism-design/nanopubs/build.mjs
//
// Output: organism-design/nanopubs/unsigned/*.trig + manifest.json. Nothing is signed and
// nothing is published: signing needs the key owner, and the test registry comes first.
//
// Record kinds, kept in separate nanopubs so a design is never mistaken for a measurement:
//   - blueprint proposals (one per worked example) + the ontology queries behind each
//   - the blind holdout prediction set + the frozen exam it was scored against
//     + the holdout thread's scoring, attributed to that thread
//   - one method observation: the hosted BioNeMo endpoint's authentication refusal
//   - three model outputs (predicted structures) + one derived claim over them

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..', '..');
const here = import.meta.dirname;
const outDir = path.join(here, 'unsigned');

const pipeline = process.env.DELPHI_PIPELINE;
if (!pipeline) throw new Error('Set DELPHI_PIPELINE to the project-delphi-ontology/pipeline directory');
// No human is named unless the key owner names themselves. Without --owner (or NANOPUB_ORCID) the
// records attribute creation to the software agent that built them and omit prov:actedOnBehalfOf,
// so no ORCID appears anywhere in a draft. Consistency with older record sets is not consent.
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const operator = arg('owner', process.env.NANOPUB_ORCID || null);
if (operator && !/^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(operator))
  throw new Error('--owner must be an https://orcid.org/… IRI');
const OWNER_NOTE =
  'Owner ORCID not set: no human is named in this draft. The key owner passes --owner <orcid IRI> to organism-design/nanopubs/build.mjs at signing time, and that one value populates dct:creator and prov:actedOnBehalfOf.';

const B = await import(pathToFileURL(path.resolve(pipeline, 'probknow-builders.ts')).href);
const { DELPHI, DELPHIR, RDF, RDFS, DC, PROV, SYSTEM_ID, buildEntityNanopub } = B;
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const SCHEMA = 'https://schema.org/';

const DOMAIN = `${DELPHIR}domain/organism-anatomy-blueprints-from-ontologies`;
const UBERGRAPH = 'https://ubergraph.apps.renci.org/sparql';
const REPO = 'https://github.com/fractastical/delphi';

// ── TriG serialisation on the temp base, same remapping as pipeline/seal.ts ──
const TEMP = 'http://purl.org/nanopub/temp/np1/';
const remap = (t, pre) =>
  t === pre ? TEMP : t === pre + '/' ? TEMP + 'Head' : t.startsWith(pre + '/') ? TEMP + t.slice(pre.length + 1) : t;
const term = t => {
  if (t.startsWith('"')) {
    const m = t.match(/^(".*")\^\^(.+)$/s);
    return m ? `${m[1]}^^${m[2].startsWith('<') ? m[2] : `<${m[2]}>`}` : t;
  }
  return t.startsWith('_:') ? t : `<${t}>`;
};
function triplesToTrig(triples, pre) {
  const byGraph = new Map();
  for (const q of triples) {
    const g = remap(q.graph, pre);
    if (!byGraph.has(g)) byGraph.set(g, []);
    byGraph.get(g).push(q);
  }
  let out = '';
  for (const [g, qs] of byGraph) {
    out += `<${g}> {\n`;
    for (const q of qs)
      out += `  ${term(remap(q.subject, pre))} <${remap(q.predicate, pre)}> ${term(remap(q.object, pre))} .\n`;
    out += '}\n';
  }
  return out;
}

// ── Provenance: the builders attribute everything to the upstream system agent. These
// records were produced by this thread's own scripts, so the software agent that ran is
// named in provenance and the operator is the creator in pubinfo. ─────────────────────
const AGENTS = {
  blueprint: {
    iri: `${DELPHIR}agent/delphisci-organism-blueprint-tool`,
    label: 'organism-design/blueprint.mjs: a deterministic Node script that reads a description with hand-written word lists and queries Ubergraph. No language model is in the loop.',
    file: 'organism-design/blueprint.mjs',
  },
  exam: {
    iri: `${DELPHIR}agent/delphisci-organism-exam-predictor`,
    label: 'organism-design/exam/predict.mjs: emits present/absent predictions for a held-out roster from Uberon taxon constraints alone.',
    file: 'organism-design/exam/predict.mjs',
  },
  holdoutScorer: {
    iri: `${DELPHIR}agent/delphisci-holdout-exam-scorer`,
    label: "holdout/exam-results/organism-design/score.mjs: the holdout thread's scoring script, run by that thread, not by this one.",
    file: 'holdout/exam-results/organism-design/score.mjs',
  },
  esmfold: {
    iri: `${DELPHIR}agent/delphisci-organism-esmfold-client`,
    label: 'organism-design/esmfold/smoke-test.mjs: calls a hosted ESMFold service on one checksummed UniProt sequence and records what happened.',
    file: 'organism-design/esmfold/smoke-test.mjs',
    model: {
      iri: `${DELPHIR}model/esmfold-v1`,
      label: 'ESMFold v1, a protein language model with a structure head',
      id: 'esmfold-v1',
      comment: 'The version string is the one the service itself reports in the PDB TITLE record of each prediction.',
    },
  },
  comparator: {
    iri: `${DELPHIR}agent/delphisci-organism-structure-comparator`,
    label: 'organism-design/esmfold/compare.mjs: Needleman-Wunsch global alignment and Kabsch superposition of CA atoms, in pure Node.',
    file: 'organism-design/esmfold/compare.mjs',
  },
};

const lit = s => JSON.stringify(s);

function reattribute(triples, agent) {
  const provG = triples.find(t => t.graph.endsWith('/provenance')).graph;
  // Without an owner the creator is the software agent that built the record, not a person.
  const out = triples.map(t =>
    t.object !== SYSTEM_ID ? t : { ...t, object: t.graph === provG ? agent.iri : operator || agent.iri });
  out.push(
    { subject: agent.iri, predicate: `${RDF}type`, object: `${PROV}SoftwareAgent`, graph: provG },
    { subject: agent.iri, predicate: `${RDFS}label`, object: lit(agent.label), graph: provG },
    { subject: agent.iri, predicate: `${DC}identifier`, object: lit(agent.file), graph: provG },
    { subject: agent.iri, predicate: `${SCHEMA}codeRepository`, object: REPO, graph: provG },
    ...(operator ? [{ subject: agent.iri, predicate: `${PROV}actedOnBehalfOf`, object: operator, graph: provG }] : []),
  );
  if (agent.model)
    out.push(
      { subject: agent.iri, predicate: `${DELPHI}usesModel`, object: agent.model.iri, graph: provG },
      { subject: agent.model.iri, predicate: `${RDF}type`, object: `${DELPHI}LanguageModel`, graph: provG },
      { subject: agent.model.iri, predicate: `${RDFS}label`, object: lit(agent.model.label), graph: provG },
      { subject: agent.model.iri, predicate: `${DC}identifier`, object: lit(agent.model.id), graph: provG },
      { subject: agent.model.iri, predicate: `${RDFS}comment`, object: lit(agent.model.comment), graph: provG },
    );
  return out;
}

// ── Output ──────────────────────────────────────────────────────────────────
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// The pipeline's TEMPLATES map points every Delphi v2.0 class at the legacy ProbKnow template for
// that class. Those templates require pk: types on probknow:…/~~ARTIFACTCODE~~ subjects, so a
// record built from v2.0 terms cannot instantiate them: nanopub-skill's
// check-nanopub-conformance.py reports every assertion triple unmatched and st01 missing. Asserting
// wasCreatedFromTemplate would therefore be a false statement in the pubinfo, so it is dropped and
// the reason is stated instead. See DECISIONS.md.
const NT = 'https://w3id.org/np/o/ntemplate/';
const TEMPLATE_NOTE =
  'No assertion, provenance or pubinfo template is declared. The pipeline maps each Project Delphi v2.0 class to the published ProbKnow template for that class, and those published templates still use legacy probknow terms, so a v2.0 record cannot instantiate them: check-nanopub-conformance.py reports every assertion triple unmatched and the required statement missing. Migrated templates exist in the ontology source but have not been republished; see the record delphir:claim/delphi-v2-template-declarations-are-false for the counts and the options.';

function emit(file, entity, agent, extra) {
  const built = buildEntityNanopub({ ...entity, domain: DOMAIN, paper: null });
  const kept = reattribute(built.triples, agent).filter(
    t => !(t.predicate.startsWith(NT) && t.predicate.includes('wasCreatedFrom')),
  );
  const pubG = kept.find(t => t.graph.endsWith('/pubinfo')).graph;
  // Sub-nodes that the builder's flat statement list cannot express, because every statement it takes
  // has the entity as its subject. Used for one node per SPARQL query. Only the entity itself is
  // introduced (npx:introduces); these nodes describe it and mint no new claim.
  if (extra) {
    const assertG = kept.find(t => t.graph.endsWith('/assertion')).graph;
    const subject = kept.find(t => t.graph === assertG && t.predicate === `${RDF}type`).subject;
    kept.push(...extra({ subject, assertG }));
  }
  kept.push({ subject: built.preUri, predicate: `${RDFS}comment`, object: lit(TEMPLATE_NOTE), graph: pubG });
  if (!operator) kept.push({ subject: built.preUri, predicate: `${RDFS}comment`, object: lit(OWNER_NOTE), graph: pubG });
  const trig = triplesToTrig(kept, built.preUri);
  const p = path.join(outDir, file + '.trig');
  fs.writeFileSync(p, trig);
  manifest.push({
    file: `organism-design/nanopubs/unsigned/${file}.trig`,
    kind: entity.type.replace(DELPHI, 'delphi:'),
    introduces: entity.iri || `${DELPHIR}${entity.type.includes('Claim') ? 'claim' : entity.type.includes('Evidence') ? 'evidence' : 'assessment'}/${entity.id}`,
    label: entity.label,
    agent: agent.iri,
    status: 'unsigned draft; not published',
    trig_sha256: sha(p),
  });
  return manifest.at(-1).introduces;
}

const S = (predicate, object) => ({ predicate, object });
const ev = iri => S(`${DELPHI}hasEvidence`, iri);
const notEstablished = text => S(`${RDFS}comment`, `Does not establish: ${text}`);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Blueprint proposals: one claim per worked example, one evidence item per
//    example holding the queries and the identifiers behind every node.
// ─────────────────────────────────────────────────────────────────────────────
const exDir = path.join(root, 'organism-design/examples');
const cacheDir = path.join(root, 'organism-design/cache');
// blueprint.mjs caches each response at sha256("sparql:" + query text), so that hash is both the
// cache key and the name of the file holding the bytes. Recording it and the hash of the file lets a
// clean checkout confirm it replayed the same responses, without the record carrying the responses.
const queryKey = text => crypto.createHash('sha256').update('sparql:' + text).digest('hex');

// Motivation, recorded only where a source sentence exists in this repository. It is an analogy that
// prompted the exercise and nothing stronger: Darwin wrote about a transition that might have
// happened, and a blueprint of present-day anatomy says nothing about whether one did. The record
// therefore cites the sentence with dcterms:references and states the limit in the same breath; no
// equivalence, derivation or support relation is asserted between the two.
const MOTIVATION = {
  'a-flying-fish': {
    source: 'darwin-origin/inputs/pg1228.txt#line=5639,5642',
    work: 'Charles Darwin, On the Origin of Species by Means of Natural Selection, chapter VI; Project Gutenberg eBook 1228',
    quote:
      'it is conceivable that flying-fish, which now glide far through the air, slightly rising and turning by the aid of their fluttering fins, might have been modified into perfectly winged animals.',
    note:
      'Motivation by analogy only. Darwin names a hypothetical transition from gliding fish to winged animal; this blueprint lists the anatomy that Uberon and the Cell Ontology record for the living family, at one point in time. It is not evidence for or against the transition, it does not assert that these structures are the ones that would change, and nothing here is equivalent to or derived from the sentence. The mention is already recorded in organisms/merged/taxa.json under key gbif:2968.',
    taxon_identifiers: ['https://www.gbif.org/species/2968', 'http://www.wikidata.org/entity/Q183686'],
  },
};

for (const f of fs.readdirSync(exDir).filter(f => f.endsWith('.json')).sort()) {
  const b = rd(path.join(exDir, f));
  const slug = f.replace(/\.json$/, '');
  const mot = MOTIVATION[slug] || null;
  // Distinct ontology terms, not placements in the hierarchy: the same tissue or cell type can be part
  // of several organs. Anything a reader sees uses these.
  const cd = b.counts_distinct || b.counts;
  const relFile = `organism-design/examples/${f}`;
  const fileSha = sha(path.join(exDir, f));
  const t = b.reading.taxon;
  const q = Object.entries(b.queries);
  const retrieved = q.map(([, v]) => v.retrieved).sort().at(-1);
  // Two different things, previously conflated under one name: structures the description itself
  // named, and organ systems pulled in only because one of those structures is part of them.
  const namedNodes = [...new Set(b.nodes.filter(n => n.named_in_description).map(n => n.label))];
  const addedSystems = b.nodes.filter(n => n.added_because).map(n => n.label);
  const notRead = b.reading.words_not_recognised || [];
  const cutT = b.pruning?.totals || { organs: 0, tissues: 0, cells: 0 };
  const organs = b.nodes.filter(n => n.level === 'organ');
  const tally = { stated: 0, weak: 0, none: 0 };
  for (const o of organs) {
    const e = String(o.taxon_evidence || '');
    if (e.startsWith('stated')) tally.stated++;
    else if (e.startsWith('weak')) tally.weak++;
    else tally.none++;
  }
  const upper = b.nodes.filter(n => ['body', 'organ_system', 'organ'].includes(n.level));

  const evIri = emit(
    `evidence-blueprint-${slug}`,
    {
      type: `${DELPHI}EvidenceItem`,
      id: `organism-blueprint-${slug}-queries`,
      label: `Ontology queries and term identifiers behind the "${b.input.description}" blueprint`,
      description:
        `${q.length} SPARQL queries against Ubergraph (Uberon, Cell Ontology, Protein Ontology and NCBI Taxonomy with materialised subClassOf and part_of closures). Each query is a part of this evidence item below, carrying its purpose, its full query text, the endpoint, the retrieval time, the row count, and two SHA-256 hashes: sparql-sha256 is the hash of the query text, which is also the name of the file holding the response under organism-design/cache/, and response-sha256 is the hash of that file. A clean checkout replays the same bytes offline and can confirm it did. Latest retrieval ${retrieved}. ` +
        `The ${upper.length} body, organ-system and organ identifiers of this blueprint are referenced below; the ${cd.tissue} tissue and ${cd.cell} cell-type identifiers are listed in the cited file.`,
      statements: [
        S(`${DC}source`, relFile),
        S(`${DC}identifier`, `sha256:${fileSha}`),
        S(`${PROV}wasDerivedFrom`, UBERGRAPH),
        S(`${SCHEMA}codeRepository`, REPO),
        S(`${RDFS}seeAlso`, 'http://purl.obolibrary.org/obo/uberon.owl'),
        S(`${RDFS}seeAlso`, 'http://purl.obolibrary.org/obo/cl.owl'),
        ...upper.map(n => S(`${DC}references`, n.iri)),
        // The taxon as other registries identify it, where the team's inventory records them.
        ...(mot?.taxon_identifiers ?? []).map(i => S(`${DC}references`, i)),
        ...q.map(([id]) => S(`${DC}hasPart`, `${DELPHIR}evidence/organism-blueprint-${slug}-queries/${id}`)),
      ],
    },
    AGENTS.blueprint,
    ({ subject, assertG }) => {
      const out = [];
      for (const [id, v] of q) {
        const node = `${subject}/${id}`;
        const key = queryKey(v.sparql);
        const cf = path.join(cacheDir, `${key}.json`);
        out.push(
          { subject: node, predicate: `${RDF}type`, object: `${PROV}Entity`, graph: assertG },
          { subject: node, predicate: `${RDFS}label`, object: lit(`${id}: ${v.purpose}`), graph: assertG },
          { subject: node, predicate: `${DC}isPartOf`, object: subject, graph: assertG },
          { subject: node, predicate: `${PROV}atLocation`, object: v.endpoint, graph: assertG },
          { subject: node, predicate: `${SCHEMA}text`, object: lit(v.sparql), graph: assertG },
          { subject: node, predicate: `${PROV}generatedAtTime`, object: `${lit(v.retrieved)}^^<${XSD}dateTime>`, graph: assertG },
          { subject: node, predicate: `${DC}extent`, object: lit(`${v.rows} result row${v.rows === 1 ? "" : "s"}`), graph: assertG },
          // Two hashes: the first names the cache file, the second pins the bytes inside it.
          { subject: node, predicate: `${DC}identifier`, object: lit(`sparql-sha256:${key}`), graph: assertG },
          ...(fs.existsSync(cf)
            ? [{ subject: node, predicate: `${DC}identifier`, object: lit(`response-sha256:${sha(cf)}`), graph: assertG }]
            : [{ subject: node, predicate: `${RDFS}comment`, object: lit('The cached response for this query is not in the checkout, so its bytes are not pinned here.'), graph: assertG }]),
        );
      }
      return out;
    },
  );

  emit(
    `claim-blueprint-${slug}`,
    {
      type: `${DELPHI}Claim`,
      id: `organism-blueprint-${slug}`,
      label: `Proposed anatomical blueprint for "${b.input.description}": ${cd.organ_system} organ systems, ${cd.organ} organs, ${cd.tissue} tissues and ${cd.cell} cell types that Uberon and the Cell Ontology record for ${t.label}.`,
      description:
        `The description "${b.input.description}" was resolved to ${t.label} (NCBITaxon:${t.taxid}), ${t.chosen_because}. ` +
        `From that taxon the tool proposes a body > organ system > organ > tissue > cell hierarchy of existing ontology terms: ${cd.organ_system} organ systems, ${cd.organ} organs, ${cd.tissue} tissues and ${cd.cell} cell types, distinct terms counted once each. A tissue or cell type that is part of several organs is shown under each, which is why the file lists ${b.counts.tissue} tissue and ${b.counts.cell} cell placements. ` +
        (b.reading.anatomy_words.length
          ? `Structures read from the description and kept regardless of ranking: ${b.reading.anatomy_words.map(a => `"${a.matched}" as ${a.label || a.term}`).join(', ')}. `
          : 'No structure word in the description was recognised, so every node below comes from the taxon alone. ') +
        (addedSystems.length ? `Organ systems present only because such a structure is part of them: ${addedSystems.join(', ')}. ` : '') +
        (notRead.length
          ? `Words the lexicon does not know, so that nothing in the blueprint stands for them: ${notRead.join(', ')}. `
          : 'Every content word of the description was recognised. ') +
        `Of the ${organs.length} organs, ${tally.stated} carry a taxon basis stated by the ontology for this taxon or an ancestor, ${tally.weak} are stated only for all animals, and ${tally.none} are merely not excluded. ` +
        `The per-parent limits cut a further ${cutT.organs} organs, ${cutT.tissues} tissues and ${cutT.cells} cell types, each listed in the cited file with the query that found it; no structure named in the description was cut. ` +
        `The genome sketch is not a genome and is not part of this proposal: the Cell Ontology records marker gene products for ${b.genome_sketch.cells_with_markers} of the ${cd.cell} cell types and nothing for the other ${cd.cell - b.genome_sketch.cells_with_markers}. ` +
        `What was assembled is an anatomy, not an organism. This is a proposal assembled from ontology statements: it is not an observation of any organism, and no specimen, image or measurement enters it.`,
      statements: [
        S(`${DELPHI}hypothesisType`, 'ontology-derived design proposal'),
        S(
          `${DELPHI}context`,
          `Taxon ${t.label} (NCBITaxon:${t.taxid}), verified live as the most specific of the taxon words found. ` +
            `Selection: organ systems are subclasses of "anatomical system" in Uberon's core subsets, most general kept; organs are parts of a system in the major_organ, organ_slim, efo_slim or vertebrate_core subsets, ranked major organs first then by the number of cell types the Cell Ontology records for them, at most ${b.limits.organs} per system; at most ${b.limits.tissues} tissues and ${b.limits.cells} cell types per organ. ` +
            `Taxon filter: a structure is dropped when Uberon or the Cell Ontology states never_in_taxon on the term, a superclass, or a whole it is part of, for a taxon containing this one, or states in_taxon for a taxon unrelated to this one; for non-vertebrates the vertebrate_core subset is dropped as well. Absence of a constraint is not presence, which is why every organ carries its taxon evidence. ` +
            `Retrieved from Ubergraph on ${retrieved}; the cache pins the bytes. Unknown stays unknown: nothing was filled in where the ontologies are silent.`,
        ),
        ev(evIri),
        S(
          `${DELPHI}proposedTest`,
          `Take a curated anatomical atlas for ${t.label} that was not used here, and count two things: structures the atlas lists at organ level that this blueprint omits, and organs this blueprint proposes that the atlas does not record for the taxon. A blueprint whose "stated" organs disagree with the atlas would falsify the selection rule; disagreement confined to the "not excluded" organs would instead show the ontology's taxon constraints are too sparse, which is the limit already recorded here.`,
        ),
        notEstablished(
          `that an individual of ${t.label} has these structures, that the list is complete, or that any part of it was measured. Uberon's taxon constraints are sparse, so organs marked "not excluded" may be absent in the organism; tissues and cell types are ontology part_of statements, not counts from a specimen. Nothing here is a genome, and no function is predicted.` +
            (mot ? ' In particular, this proposal is not evidence about the transition the motivating sentence imagines, in either direction.' : ''),
        ),
        ...(mot
          ? [
              S(`${DC}references`, mot.source),
              S(
                `${RDFS}comment`,
                `Motivated by analogy with a sentence in ${mot.work}, at ${mot.source}: "${mot.quote}" ${mot.note}`,
              ),
            ]
          : []),
        S(`${RDFS}seeAlso`, `${REPO}/blob/main/${relFile}`),
      ],
    },
    AGENTS.blueprint,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. The blind holdout prediction set, the frozen exam, and the holdout
//    thread's scoring of it (kept as a separate statement, separately attributed).
// ─────────────────────────────────────────────────────────────────────────────
{
  const pf = 'organism-design/exam/aves-predictions.json';
  const p = rd(path.join(root, pf));
  const pSha = sha(path.join(root, pf));
  const rf = 'holdout/exam-results/organism-design/result.run2.json';
  const res = rd(path.join(root, rf));

  const evIri = emit(
    'evidence-aves-exam-and-predictions',
    {
      type: `${DELPHI}EvidenceItem`,
      id: 'organism-aves-exam-and-predictions',
      label: `The frozen Aves exam roster (48 species) and the ${p.predictions.length} blind predictions made against it`,
      description:
        `The exam file holdout/exam.json was frozen by the holdout thread before any prediction was made. Its SHA-256 recorded in holdout/CHECKSUMS.json is ${p.exam.sha256_recorded_in_checksums}; recomputed at prediction time it was ${p.exam.sha256_computed}, and the two match. Roster size ${p.exam.roster_size} species. ` +
        `The panel is ${p.panel.size} Uberon terms selected by this rule: ${p.panel.rule}. ` +
        `Predictions: ${p.predictions.length} rows in ${pf} (SHA-256 ${pSha}), one per species and panel structure, each carrying the species, the structure IRI, present or absent, whether the basis is stated or default, and the reason. Tally: ${p.tally.absent} absent, ${p.tally.present_stated} present with a stated basis, ${p.tally.present_default} present by default. ` +
        `Inputs read: ${p.inputs_read.join('; ')}. Inputs deliberately not read: ${p.inputs_not_read.join('; ')}.`,
      statements: [
        S(`${DC}source`, pf),
        S(`${DC}identifier`, `sha256:${pSha}`),
        S(`${DC}references`, 'http://purl.obolibrary.org/obo/uberon.owl'),
        S(`${PROV}wasDerivedFrom`, UBERGRAPH),
        S(`${SCHEMA}codeRepository`, REPO),
        S(`${RDFS}seeAlso`, `${REPO}/blob/main/${pf}`),
      ],
    },
    AGENTS.exam,
  );

  const claimIri = emit(
    'claim-aves-blind-predictions',
    {
      type: `${DELPHI}Claim`,
      id: 'organism-aves-blind-predictions',
      label: `Present or absent predictions for ${p.predictions.length} species-structure pairs across 48 held-out bird species, made from Uberon taxon constraints alone, with no bird trait data read.`,
      description:
        `For each of the 48 species on the frozen Aves roster and each of the ${p.panel.size} Uberon core terms that carry a taxon constraint, the tool predicted present or absent and said on what basis. A structure is predicted absent when Uberon's never_in_taxon covers the species, or when in_taxon names a clade the species is outside. It is predicted present with a stated basis when in_taxon or present_in_taxon names a clade below Vertebrata containing the species, and present by default otherwise. ` +
        `Because the predictions come only from taxon constraints, they are identical for species inside the same constrained clade: across the roster there are ${res.exploratory_not_preregistered?.distinct_prediction_vectors_across_roster ?? 'a small number of'} distinct prediction vectors. The builder stayed blind to the clade throughout: the blueprint tool refuses descriptions that resolve inside it, and the leak check over this folder exits ${res.preconditions.leak_check_exit}.`,
      statements: [
        S(`${DELPHI}hypothesisType`, 'blind prediction set from ontology constraints'),
        S(
          `${DELPHI}context`,
          `Made before any scoring, against an exam frozen and checksummed by another thread, from identifiers in that exam file and the ontologies only. No bird trait table, genome, occurrence count or atlas was opened. The predictions file cites the exam's SHA-256 so the order of events can be checked.`,
        ),
        ev(evIri),
        S(
          `${DELPHI}proposedTest`,
          `Score the predictions against a trait source for the roster, structure by structure, counting accuracy separately for the stated and the default rows. The informative case is a structure that varies within the held-out clade: taxon constraints cannot distinguish species that the ontology does not distinguish, so a prediction set like this one must fail on exactly those structures.`,
        ),
        notEstablished(
          `that any bird has or lacks a structure. A "present by default" row says only that the ontology does not exclude the structure, which is not evidence of presence, and the set cannot distinguish species that Uberon treats alike. Accuracy on this set would measure Uberon's taxon constraints, not an organism model.`,
        ),
        S(`${RDFS}seeAlso`, `${REPO}/blob/main/${pf}`),
      ],
    },
    AGENTS.exam,
  );

  const verdicts = Object.entries(res.exam_measured).map(([k, v]) => `${k}: ${v.verdict}`).join(', ');
  emit(
    'assessment-aves-holdout-scoring',
    {
      type: `${DELPHI}Assessment`,
      id: 'organism-aves-blind-predictions--holdout-scoring',
      label: `The holdout thread scored the blind Aves predictions inconclusive on all three pre-registered measures (${verdicts}).`,
      description:
        `Scored by the holdout thread under a rule it registered before opening the prediction file. All three measures returned inconclusive with nothing scored: measure A (a sternal keel) had 0 of 48 species scored, measure B (foot webbing) 0 of 48, and measure C (conflict-free reporting) found no conflicts reported for 48 of 48. The reason is that the rule's structures are not among the Uberon terms that carry a taxon constraint, so the prediction panel never contains them. That is the rule meeting the panel, not a pass and not a failure. ` +
        `This record is a transcription of that thread's published result file; the scoring was run by that thread, not by this one.`,
      statements: [
        S(`${DELPHI}hasVerdict`, 'inconclusive'),
        S(`${DELPHI}evaluatesHypothesis`, claimIri),
        S(`${DELPHI}assessmentType`, 'pre-registered holdout exam, Aves roster'),
        S(`${DC}source`, rf),
        S(`${DC}identifier`, `sha256:${sha(path.join(root, rf))}`),
        S(`${DC}references`, `${REPO}/blob/main/holdout/exam-results/organism-design/PREREG.md`),
        S(`${RDFS}seeAlso`, `${REPO}/blob/main/${rf}`),
        S(
          `${RDFS}comment`,
          `Does not establish: that the predictions are right or wrong. An inconclusive exam measured nothing; the pre-registered structures were outside the panel the predictions could cover.`,
        ),
      ],
      about: [{ subject: claimIri, predicate: `${DELPHI}hasAssessment` }],
    },
    AGENTS.holdoutScorer,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ESMFold: the NIM refusal (a method observation), the three model outputs,
//    and one derived claim over them.
// ─────────────────────────────────────────────────────────────────────────────
const runsDir = path.join(root, 'organism-design/esmfold/runs');
const runs = fs
  .readdirSync(runsDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(runsDir, d.name, 'result.json')))
  .map(d => ({ dir: d.name, r: rd(path.join(runsDir, d.name, 'result.json')) }));

for (const { dir, r } of runs) {
  const rel = `organism-design/esmfold/runs/${dir}/result.json`;
  const relSha = sha(path.join(runsDir, dir, 'result.json'));
  const i = r.input;
  const uni = `https://www.uniprot.org/uniprotkb/${i.uniprot_accession}`;

  if (r.run.status !== 'ok') {
    const evIri = emit(
      `evidence-esmfold-${dir}-refusal`,
      {
        type: `${DELPHI}EvidenceItem`,
        id: `organism-esmfold-${dir}-refusal-record`,
        label: `Recorded refusal from the hosted BioNeMo ESMFold endpoint for ${i.protein} (${i.uniprot_accession})`,
        description:
          `One request to ${r.model.endpoint} on ${r.run.started}, carrying ${i.length} residues (${i.residue_range}) of ${i.protein} from ${i.organism}, UniProt ${i.uniprot_accession} sequence version ${i.uniprot_sequence_version}, sequence SHA-256 ${i.sequence_sha256}. ` +
          `The service answered HTTP ${r.run.http_status}. Its message, verbatim: ${r.run.note}. ` +
          `The API key was read from the process environment only and was never written to the repository; the run record holds no key. The key string supplied began "bak-", while NVIDIA keys begin "nvapi-", so it was a credential for a different service or a truncated paste. Status recorded as "${r.run.status}" in ${rel} (SHA-256 ${relSha}).`,
        statements: [
          S(`${DC}source`, rel),
          S(`${DC}identifier`, `sha256:${relSha}`),
          S(`${PROV}wasDerivedFrom`, r.model.endpoint),
          S(`${DC}references`, uni),
          S(`${RDFS}seeAlso`, r.model.docs),
          S(`${SCHEMA}codeRepository`, REPO),
        ],
      },
      AGENTS.esmfold,
    );

    emit(
      `claim-esmfold-${dir}-refused`,
      {
        type: `${DELPHI}Claim`,
        id: `organism-esmfold-nim-refused-${i.uniprot_accession.toLowerCase()}`,
        label: `The hosted BioNeMo ESMFold endpoint refused a fold request for bovine serum albumin with HTTP ${r.run.http_status} and the message "Invalid JWT serialization: Missing dot delimiter(s)" when called with the key supplied on 31 October 2026.`,
        description:
          `A smoke test of the hosted BioNeMo ESMFold NIM on ${i.protein} from ${i.organism} (UniProt ${i.uniprot_accession}, residues ${i.residue_range}, ${i.length} aa) did not run: the service rejected the credential. The attempt, its timestamp, the HTTP status and the server's own message are recorded rather than discarded, so the next person does not assume the route works. Meta's public ESM Atlas endpoint was used instead for the thread's structure predictions.`,
        statements: [
          S(`${DELPHI}hypothesisType`, 'method observation (service refusal)'),
          S(
            `${DELPHI}context`,
            `One request, ${r.run.started}, endpoint ${r.model.endpoint}. Key taken from the process environment, never stored. No fallback, retry or second key was tried. The claim is about this request and this credential, nothing wider.`,
          ),
          ev(evIri),
          S(
            `${DELPHI}proposedTest`,
            `Repeat the identical request with a key whose prefix is "nvapi-". A 200 response carrying a structure would show the route is sound and the refusal was the credential; a second 401 would point at the account or the endpoint instead.`,
          ),
          notEstablished(
            `that the endpoint is unavailable, misconfigured or unusable, or that ESMFold would fail on this sequence. It records one authentication failure with one credential at one time.`,
          ),
          S(`${RDFS}seeAlso`, `${DELPHIR}claim/thompson1917-ch09-06`),
        ],
      },
      AGENTS.esmfold,
    );
    continue;
  }

  const o = r.output;
  const pdbSha = o.pdb_sha256;
  const evIri = emit(
    `evidence-esmfold-${dir}`,
    {
      type: `${DELPHI}EvidenceItem`,
      id: `organism-esmfold-${dir}-run`,
      label: `ESMFold prediction run for ${i.protein} from ${i.organism} (${i.uniprot_accession}), with its input and output checksums`,
      description:
        `Input: UniProt ${i.uniprot_accession}, sequence version ${i.uniprot_sequence_version}, residues ${i.residue_range}, ${i.length} aa; the vendored record is ${i.record_file} (SHA-256 ${i.record_sha256}) and the sequence SHA-256 is ${i.sequence_sha256}. ` +
        `Call: POST to ${r.model.endpoint} on ${r.run.started}, HTTP ${r.run.http_status}, ${r.run.seconds} s. The service reports its own version as "${r.model.version_reported}". ` +
        `Output: one predicted structure, ${o.residues_modelled} residues modelled, written to ${dir}/predicted.pdb (SHA-256 ${pdbSha}). ` +
        `Every pLDDT number below was read from the B-factor column of that file; the file carries the scale "${o.plddt_scale_in_file}". Mean ${o.plddt_mean}, minimum ${o.plddt_min}, maximum ${o.plddt_max}, fraction at or above 70 is ${o.fraction_plddt_ge_70}, fraction at or above 90 is ${o.fraction_plddt_ge_90}. The run record is ${rel} (SHA-256 ${relSha}).`,
      statements: [
        S(`${DC}source`, rel),
        S(`${DC}identifier`, `sha256:${relSha}`),
        S(`${DC}references`, uni),
        S(`${PROV}wasDerivedFrom`, r.model.endpoint),
        S(`${RDFS}seeAlso`, r.model.docs),
        S(`${SCHEMA}codeRepository`, REPO),
      ],
    },
    AGENTS.esmfold,
  );

  emit(
    `claim-esmfold-${dir}`,
    {
      type: `${DELPHI}Claim`,
      id: `organism-esmfold-${dir}`,
      label: `ESMFold v1, called through Meta's public ESM Atlas endpoint, returned a predicted structure for ${i.protein} from ${i.organism} (UniProt ${i.uniprot_accession}, ${i.length} residues) with mean pLDDT ${o.plddt_mean} and ${Math.round(100 * o.fraction_plddt_ge_70)}% of residues at pLDDT 70 or above.`,
      description:
        `A model output, not a measurement. The sequence was taken from a checksummed UniProt record, sent to a hosted ESMFold service, and the returned coordinates were kept with their checksum. pLDDT is the model's own per-residue confidence; the file reports it on a 0 to 1 scale and the numbers here are that column multiplied by 100, which the run record states. No experimental structure of this protein was fetched or compared, so nothing here is validated against a measurement.`,
      statements: [
        S(`${DELPHI}hypothesisType`, 'model output (predicted structure)'),
        S(
          `${DELPHI}context`,
          `Protein ${i.protein}, ${i.organism} (NCBITaxon:${i.organism_ncbi_taxid}), residues ${i.residue_range} of UniProt ${i.uniprot_accession} version ${i.uniprot_sequence_version}. Service ${r.model.host}, endpoint ${r.model.endpoint}, ${r.run.started}. One prediction, no sampling, no relaxation, no template.`,
        ),
        ev(evIri),
        S(
          `${DELPHI}proposedTest`,
          `Superpose the prediction on an experimental structure of this protein from the PDB and report CA RMSD per residue against pLDDT. High pLDDT where the superposition is poor would show the confidence is miscalibrated for this family.`,
        ),
        notEstablished(
          `the structure of this protein. A predicted structure is not a measured one, and pLDDT is the model's confidence, not its accuracy. The prediction was not compared with any experimental structure.`,
        ),
      ],
    },
    AGENTS.esmfold,
  );
}

{
  const cf = 'organism-design/esmfold/runs/compare-cytochrome-c.json';
  const c = rd(path.join(root, cf));
  const cSha = sha(path.join(root, cf));
  const pairText = c.pairs
    .map(p => `${p.organisms[0]} vs ${p.organisms[1]}: ${p.substitutions} substitutions in ${p.aligned_positions} aligned positions, CA RMSD ${p.ca_rmsd_angstrom} angstrom`)
    .join('; ');

  const evIri = emit(
    'evidence-cytochrome-c-superposition',
    {
      type: `${DELPHI}EvidenceItem`,
      id: 'organism-cytochrome-c-superposition',
      label: 'Pairwise alignment and superposition of the three ESMFold cytochrome c predictions',
      description:
        `Computed by ${c.tool} on ${c.built} from the three predicted PDB files, not from experimental structures. Method: ${c.method.alignment}; ${c.method.superposition}. The tool's own note: ${c.method.note} ` +
        `Results: ${pairText}. Substitution counts come from the alignment of the two UniProt sequences; each RMSD comes from the CA atoms of the aligned positions after superposition. Stored in ${cf} (SHA-256 ${cSha}).`,
      statements: [
        S(`${DC}source`, cf),
        S(`${DC}identifier`, `sha256:${cSha}`),
        S(`${SCHEMA}codeRepository`, REPO),
        ...c.proteins.map(p => S(`${DC}references`, `https://www.uniprot.org/uniprotkb/${p.uniprot_accession || p.accession || p}`)),
      ].filter(s => !String(s.object).endsWith('/undefined')),
    },
    AGENTS.comparator,
  );

  emit(
    'claim-cytochrome-c-predicted-divergence',
    {
      type: `${DELPHI}Claim`,
      id: 'organism-cytochrome-c-predicted-divergence',
      label: `Across three ESMFold predictions of cytochrome c, the pairs rank the same way by sequence substitutions and by CA RMSD after superposition (${pairText}).`,
      description:
        `A derived claim over model outputs. The same model folded cytochrome c from three organisms; the predictions were aligned and superposed in pure Node. The pair with fewest substitutions has the smallest RMSD and the pair with most has the largest. This is consistent with the idea that sequence divergence accumulates while the fold is conserved, which is the setting of Kimura's substitution-rate claim, and it is not a test of that claim.`,
      statements: [
        S(`${DELPHI}hypothesisType`, 'derived claim over model outputs'),
        S(
          `${DELPHI}context`,
          `Three predictions by one model (ESMFold v1 through the ESM Atlas endpoint), ${c.built}. Alignment and superposition as described in the evidence item. Three proteins give three pairs, so no rate, no fit and no significance can be read from them.`,
        ),
        ev(evIri),
        S(
          `${DELPHI}proposedTest`,
          `Repeat on a set of orthologs large enough to regress RMSD on substitutions, using experimental structures where they exist, and check whether the ordering survives when predictions are replaced by measured structures.`,
        ),
        notEstablished(
          `Kimura's substitution-rate claim, a molecular clock, or any measured structural difference between these proteins. Both quantities in each pair derive from predictions by a single model, and three points order trivially.`,
        ),
        S(`${RDFS}seeAlso`, `${DELPHIR}claim/kimura-substitution-rate`),
      ],
    },
    AGENTS.comparator,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. A method record about the tooling itself: the template declarations that
//    every Delphi v2.0 record has been carrying are false. Counts measured here
//    on 2026-10-31; the source-versus-published observation came from the lean
//    thread and was re-measured in this clone before being recorded.
// ─────────────────────────────────────────────────────────────────────────────
{
  const CHECKED = '2026-10-31';
  const COMMIT = '6ba5f9a97a4511c909f5dfd755c7993dd68989f3';
  // [label, published trusty URI, probknow occurrences published, source file, probknow in source, delphi in source]
  const T = [
    ['claim, the one published records declare', 'RApE-nGpCMigXqZjeHuYuMJEVTGmTlNTlZl7IcHi_fhdQ', 13, 'nanopubs/src/04-template-probknow-claim.trig', 0, 14],
    ['claim, the one the current template listing shows (labelled "Project Delphi claim", created 2026-10-23T13:08:44Z)', 'RAI0QFH7bCNJIeKxwG3EbX5QKyoOjlaESiJkVZKs8iUc8', 13, 'no source file identified for this one', null, null],
    ['evidence item', 'RAk4kcX4zA_touv8CeKku9tTUnbR5xiTLSLwFbrKSl3BE', 10, 'nanopubs/src/05-template-probknow-evidence-item.trig', 0, 11],
    ['provenance', 'RAaYeFYF-Cz2bM5S1wPQsnvs5X6BBxsphL03UkbVZ1lcA', 0, 'nanopubs/src/02-template-provenance-probknow-extraction.trig', 0, 2],
    ['pubinfo domain', 'RAtKj9bCnB4gUe0E9k-WhffQFSEWd9Ve2hrVllYoLuOB0', 2, 'nanopubs/src/03-template-pubinfo-probknow-domain.trig', 3, 0],
    ['rubric assessment', 'RAOAK6Fe6J6JvD4kUCZg53sRpwRkRq7rzFuDtGT7n6Drw', 19, 'nanopubs/src/18-template-probknow-rubric-assessment.trig', 0, 21],
    ['rubric', 'RAbjeus1yO4SqlPLnpIWNLS6nvW0DGF3879tVduuE0y00', 10, 'nanopubs/src/19-template-probknow-rubric.trig', 11, 0],
  ];
  const tableText = T.map(([n, id, pub, src, sp, sd]) =>
    sp === null
      ? `${n}: published https://w3id.org/np/${id} has ${pub} probknow occurrences and 0 Delphi ontology occurrences (${src})`
      : `${n}: published https://w3id.org/np/${id} has ${pub} probknow occurrences and 0 Delphi ontology occurrences, while ${src} has ${sp} and ${sd}`,
  ).join('; ');
  // One published record checked on the live network, to show the defect is not only in drafts.
  const LIVE = 'RAtLFqIIyu4r-GlMcBEfmDtbV-CHwWxQ49gVMtHIX6r48';

  const agent = {
    iri: `${DELPHIR}agent/delphisci-organism-template-checker`,
    label: 'Shell checks run by the organism thread: curl of each published template, grep counts of each namespace, and nanopub-skill check-nanopub-conformance.py against records built from Delphi v2.0 terms.',
    file: 'organism-design/nanopubs/build.mjs',
  };

  const evIri = emit(
    'evidence-delphi-v2-template-counts',
    {
      type: `${DELPHI}EvidenceItem`,
      id: 'delphi-v2-template-counts',
      label: `Namespace counts for six Delphi templates, published copies against ontology source, checked ${CHECKED}`,
      description:
        `Method: each published template fetched as https://w3id.org/np/<id>.trig and each source file read at commit ${COMMIT} of github.com/fractastical/project-delphi-ontology; occurrences (not lines) of the strings "w3id.org/probknow" and "w3id.org/delphi" counted with grep -o. Checked ${CHECKED}. ` +
        `Results: ${tableText}. ` +
        `Three are already migrated in the source but their published copies are not: the claim, evidence-item and rubric-assessment templates. The provenance template is clean in both. The pubinfo-domain and rubric templates are still legacy in the source itself. There are two claim templates in play, both legacy on the network: published records declare the older one, while the current template listing shows the other. ` +
        `The defect is live, not only in drafts: the published record https://w3id.org/np/${LIVE} resolves with HTTP 200 at 5,685 bytes, its own content uses 19 Delphi ontology terms and no probknow terms, and its publication info declares the legacy claim template https://w3id.org/np/RApE-nGpCMigXqZjeHuYuMJEVTGmTlNTlZl7IcHi_fhdQ/template. That record is the published Fisher fundamental-theorem claim from the math-bio-theorems batch: the repository manifest maps the same trusty URI to nanopubs/unsigned/fisher-ftns.trig, published to the test registry 2026-10-30T23:24:44Z and to production 2026-10-31T00:09:54Z. The hub thread pointed at the record, the lean thread identified which claim it is, and both the fetch and the manifest mapping were checked here. ` +
        `The local manifest for that batch records one approver in promotionApprovedBy and a null secondReviewer, so the promotion to production had a single approver; that is a field in this repository, not something checked on the network. ` +
        `On the checking tool itself: nanopub-java's check command exits 0 even when a file fails to parse. Verified here with a file of garbage and with a truncated copy of a real record, both of which print "RDF ERROR" and "Summary: 1 errors;" and both of which exit 0. The defect was found by the claim-tests thread and reproduced by the lean thread. Every validity statement in these records therefore comes from organism-design/nanopubs/check.mjs, which ignores the exit code, requires one "Valid (but not trusty)" line per file, and runs a negative self-test on a truncated record first. ` +
        `Separately, the nanopub-skill assertion-template collection downloaded on ${CHECKED} holds 503 templates and none references the Delphi ontology namespace. ` +
        `Conformance: nanopub-skill's check-nanopub-conformance.py run against records built from v2.0 terms reports every assertion triple unmatched and the required statement st01 missing, for the published claim template and the published evidence-item template alike. ` +
        `The source-versus-published difference was first reported by the lean thread for the evidence-item, rubric-assessment, provenance, pubinfo-domain and rubric templates; it was re-measured here in this clone, and the claim template was added to it.`,
      statements: [
        S(`${PROV}wasDerivedFrom`, 'https://github.com/fractastical/project-delphi-ontology'),
        S(`${DC}identifier`, `git:${COMMIT}`),
        S(`${DC}date`, `"${CHECKED}"^^${XSD}date`),
        ...T.map(([, id]) => S(`${DC}references`, `https://w3id.org/np/${id}`)),
        S(`${DC}references`, `https://w3id.org/np/${LIVE}`),
        S(`${SCHEMA}codeRepository`, REPO),
        S(`${RDFS}seeAlso`, 'https://github.com/knowledgepixels/nanopub-skill'),
      ],
    },
    agent,
  );

  emit(
    'claim-delphi-v2-template-declarations-are-false',
    {
      type: `${DELPHI}Claim`,
      id: 'delphi-v2-template-declarations-are-false',
      label: `A nanopub whose assertion uses Project Delphi v2.0 terms cannot instantiate the template its pipeline declares, because the published claim, evidence-item and rubric-assessment templates still use legacy ProbKnow terms, so every such declaration is a false statement about how the record was made.`,
      description:
        `The delphi skill settles that new records use ontology v2.0 terms and never the legacy probknow IRIs. The pipeline's TEMPLATES map nonetheless sends each v2.0 class to the published ProbKnow template for that class, and those templates fix legacy types on legacy subjects. A record that follows the settled rule therefore cannot instantiate the template it declares, and nt:wasCreatedFromTemplate becomes a false statement in its publication info. ` +
        `The defect is in the publication info and describes how a record was made, not what it asserts: assertions built from v2.0 terms are unaffected. ` +
        `It is also not a case of one template version regressing. Migrated templates exist in the ontology source for the claim, evidence-item and rubric-assessment templates; they have not been republished, so the network still serves the legacy copies. The pubinfo-domain and rubric templates are still legacy in the source and would need migrating first. ` +
        `There are two claim templates in play and both are legacy on the network: the one the published records declare, and the one the current template listing shows, labelled "Project Delphi claim" and created 2026-10-23. Both were fetched and counted here, and both carry 13 legacy occurrences and no v2.0 terms.`,
      statements: [
        S(`${DELPHI}hypothesisType`, 'method observation (tooling defect)'),
        S(
          `${DELPHI}context`,
          `Found while drafting this thread's 31 records: the records were built with the pipeline's own builders, which add the declaration automatically. Checked ${CHECKED} against the published templates and the ontology source at commit ${COMMIT}. In this repository the declaration appears in swarm (9 files), lean (6), claim-tests (16) and math-bio-theorems (42, being 21 unsigned and 21 signed-test); the hub thread reports that 21 of those were promoted to the production registry on 2026-10-30, which this thread did not verify. The organism thread's own records carry no declaration.`,
        ),
        ev(evIri),
        S(
          `${DELPHI}proposedTest`,
          `Run nanopub-skill's check-nanopub-conformance.py on any record that declares one of these templates. A conforming record reports no unmatched assertion triples and no missing required statement; every v2.0 record checked so far reports both. Republishing the migrated source template and re-checking would settle whether republication is sufficient.`,
        ),
        S(
          `${RDFS}comment`,
          `Remediation options, for whoever owns the key and the registry to choose between, not a recommendation from this thread: (1) drop the declaration and state in the publication info why it is absent, which is what this thread's 31 records do; (2) republish the already-migrated source templates, at minimum the claim, evidence-item and rubric-assessment ones, recording the supersedes link, then re-emit records declaring them; (3) migrate the pubinfo-domain and rubric source templates, which are still legacy, before republishing those two; (4) for records already signed or promoted to production, supersede them with corrected copies at the key owner's convenience; (5) leave published records as they are and record the defect against them. Note that a record minting a readable claim identifier would still not conform to the migrated claim template, which fixes the subject to the artifact-code IRI; that is a separate choice each generator makes.`,
        ),
        notEstablished(
          `that any published record's assertions are wrong, or that the production records must be retracted. The counts are of namespace occurrences in the files as served and as committed on ${CHECKED}; they are not a judgment of whether a template is otherwise correct. How many published records carry the defect was not measured: one was fetched and confirmed, and the rest of that batch is inferred from a local manifest, not from the network.`,
        ),
        S(`${RDFS}seeAlso`, `${REPO}/blob/main/organism-design/nanopubs/DECISIONS.md`),
      ],
    },
    agent,
  );
}

fs.writeFileSync(
  path.join(here, 'manifest.json'),
  JSON.stringify(
    {
      built: new Date().toISOString(),
      builder: 'organism-design/nanopubs/build.mjs',
      ontology: 'Project Delphi ontology v2.0 (https://w3id.org/delphi/ontology/)',
      pipeline: 'project-delphi-ontology/pipeline buildEntityNanopub',
      owner_set: !!operator,
      owner: operator,
      owner_note: operator
        ? null
        : 'No human is named in any record. The key owner passes --owner <orcid IRI> at signing time; that one value populates dct:creator and prov:actedOnBehalfOf. Consistency with earlier record sets is not consent to name someone.',
      signer_identity:
        "to be decided by the key owner: a bot identity with its own key pair and introduction nanopub is the shape the nanopub skill describes; never a human ORCID as signer without that person's approval",
      signing: 'none of these are signed; signing and any registry need the key owner',
      registry: 'test registry first, with the key owner approving; production needs their explicit approval',
      records: manifest.length,
      list: manifest,
    },
    null,
    1,
  ) + '\n',
);

const byKind = manifest.reduce((a, m) => ((a[m.kind] = (a[m.kind] || 0) + 1), a), {});
console.log(`organism-design/nanopubs/unsigned: ${manifest.length} unsigned records ` + JSON.stringify(byKind));
