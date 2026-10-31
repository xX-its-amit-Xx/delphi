#!/usr/bin/env node
// Builds UNSIGNED Project Delphi nanopub drafts for the Lean thread. One record per nanopub:
//   law-<claim_id>.trig          the machine-checked law: a delphi:Concept (formal-verification convention
//                                v1.3) carrying the Lean statement, the kernel-checked identifiers, and a
//                                delphi:EvidenceItem (build receipt + rejected mutants) linked from the claim
//   scope-<claim_id>.trig        the proof scope: what the kernel checked vs what the module header assumes
//   rubric-lean-faithfulness-0.1.0.trig   the faithfulness rubric as a delphi:Concept with its dimensions
//   assessment-<claim_id>--<provider>.trig  one blind faithfulness assessment, verdict kept literal
// Every number and identifier comes from dashboard/public/t/lean/lean.json (written by lean/report.mjs from
// the compiler's output), lean/mutations.json (lean/mutate.mjs) and lean/assessment/results/*.json.
// Nothing here signs or publishes. An unsigned draft is not a publication.
//   node lean/nanopubs/build.mjs [--commit <hash>] [--owner <orcid-iri>]
// Without --commit, repository links point at the branch and the manifest says commitPinned=false; rerun
// with the hash once lean/ is committed, before anything is signed.
// Without --owner, no human is named anywhere: the assertion and dct:creator are attributed to the bot agent
// that built the record, and prov:actedOnBehalfOf is omitted. The key owner sets --owner at signing time,
// which is the one place the human identity enters. Consistency with earlier records is not consent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const commit = arg('commit', null);
const owner = arg('owner', null);
if (owner && !/^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(owner)) throw new Error('--owner must be an https://orcid.org/… IRI');
const ref = commit || 'main';
const REPO = 'https://github.com/fractastical/delphisci';
const SITE = 'https://delphi-mission-control.ashenoy000.workers.dev/t/lean';
const blob = p => `${REPO}/blob/${ref}/${p}`;

const R = JSON.parse(fs.readFileSync(path.join(root, 'dashboard/public/t/lean/lean.json'), 'utf8'));
const M = JSON.parse(fs.readFileSync(path.join(here, '../mutations.json'), 'utf8'));
const DOMAIN = 'https://w3id.org/delphi/resource/domain/math-population-genetics-and-evolutionary-theory';
if (!R.build.ok || !R.audit.ok || R.sorryTotal !== 0) throw new Error('lean.json does not report a clean build; refusing to draft leanVerified records');
if (!M.summary.allAsExpected) throw new Error('mutations.json has a mutant that was not rejected or a control that failed; refusing');

const resDir = path.join(here, '../assessment/results');
const assessments = fs.existsSync(resDir) ? fs.readdirSync(resDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(resDir, f), 'utf8'))) : [];
const providersPerClaim = id => [...new Set(assessments.filter(a => a.claim_id === id).map(a => a.assessor.provider))];
const claimsWithTwoProviders = R.formalized.filter(f => providersPerClaim(f.claim_id).length >= 2).length;

const DELPHI = 'https://w3id.org/delphi/ontology/', DELPHIR = 'https://w3id.org/delphi/resource/';
const lit = s => JSON.stringify(String(s));
const longlit = s => '"""' + String(s).replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"') + '"""';
const now = new Date().toISOString();
const PREFIXES = `@prefix this: <http://purl.org/nanopub/temp/np1/> .
@prefix sub: <http://purl.org/nanopub/temp/np1/> .
@prefix np: <http://www.nanopub.org/nschema#> .
@prefix npx: <http://purl.org/nanopub/x/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix schema: <https://schema.org/> .
@prefix delphi: <${DELPHI}> .
`;
const TEMPLATES = { // published template nanopubs (project-delphi-ontology/nanopubs/published.json)
  provenance: 'https://w3id.org/np/RAaYeFYF-Cz2bM5S1wPQsnvs5X6BBxsphL03UkbVZ1lcA',
  pubinfoDomain: 'https://w3id.org/np/RAtKj9bCnB4gUe0E9k-WhffQFSEWd9Ve2hrVllYoLuOB0',
  evidence: 'https://w3id.org/np/RAk4kcX4zA_touv8CeKku9tTUnbR5xiTLSLwFbrKSl3BE',
  rubric: 'https://w3id.org/np/RAbjeus1yO4SqlPLnpIWNLS6nvW0DGF3879tVduuE0y00',
  rubricAssessment: 'https://w3id.org/np/RAOAK6Fe6J6JvD4kUCZg53sRpwRkRq7rzFuDtGT7n6Drw'
};
// Team rule (final, 2026-10-31): new records use Delphi ontology v2.0 IRIs only, never legacy probknow IRIs.
// These records were hand-authored by this builder, not instantiated from a template, so they declare NO
// nt:wasCreatedFrom*Template triple (that would be a false provenance assertion). Instead each record names,
// in an rdfs:comment, the template that would otherwise apply, how many legacy probknow IRIs its PUBLISHED
// copy carries, and the check date, so a reader can verify. Counts are grep -c 'w3id.org/probknow' on each
// published template's TriG (https://w3id.org/np/<id>.trig), fetched 2026-10-31. The published
// rubric-assessment template is legacy although the repository's src/18 file is already migrated to delphi:,
// i.e. the migration happened in the source and was never republished to the network.
const TEMPLATE_CHECK_DATE = '2026-10-31';
const TEMPLATE_PROBKNOW_COUNTS = { [TEMPLATES.provenance]: 0, [TEMPLATES.pubinfoDomain]: 2, [TEMPLATES.rubricAssessment]: 19, [TEMPLATES.rubric]: 10 };
const templateNotes = templates => templates.map(([role, u]) => {
  const n = TEMPLATE_PROBKNOW_COUNTS[u];
  const legacy = n > 0 ? `Its published copy still uses legacy w3id.org/probknow IRIs (${n} occurrences when checked on ${TEMPLATE_CHECK_DATE}), and its required statements cannot be instantiated from v2.0 terms, so it was not used and no template is declared.` : `Its published copy carries no legacy probknow IRI (checked ${TEMPLATE_CHECK_DATE}); it was consulted but not instantiated, so no template is declared.`;
  return `    rdfs:comment ${lit(`Hand-authored in Delphi ontology v2.0 terms (https://w3id.org/delphi/ontology/) by the builder, not created from a template. The template that would otherwise apply as ${role.replace('wasCreatedFrom', '').replace('Template', '') || 'assertion'} template is <${u}>. ${legacy} A template-conformance checker will therefore report no template declared.`)} ;\n`;
}).join('');
const BUILDER_AGENT = `${DELPHIR}agent/delphisci-lean-thread-builder`;
const onBehalf = owner ? `    prov:actedOnBehalfOf <${owner}> ;\n` : '';
const BUILDER_MODEL = `${DELPHIR}model/claude-fable-5-1`;
const builderProv = (derived) => `sub:provenance {
  sub:assertion prov:wasAttributedTo <${BUILDER_AGENT}> ;
    prov:wasDerivedFrom ${derived.map(d => `<${d}>`).join(' , ')} .
  <${BUILDER_AGENT}> a prov:SoftwareAgent ;
    rdfs:label "delphisci lean thread (Claude Fable 5.1 writing the Lean modules and this builder; the Lean kernel, not the model, checked the proofs)" ;
${onBehalf}    delphi:usesModel <${BUILDER_MODEL}> .
  <${BUILDER_MODEL}> a delphi:LanguageModel ;
    rdfs:label "Claude Fable 5.1" ;
    dct:identifier "claude-fable-5-1" .
}`;
const pubinfo = (label, type, introduces, templates = []) => `sub:pubinfo {
  this: dct:created "${now}"^^xsd:dateTime ;
    dct:creator <${BUILDER_AGENT}> ;
${owner ? '' : '    rdfs:comment "Owner ORCID not yet set: the key owner passes --owner <orcid> to lean/nanopubs/build.mjs at signing time; until then no human is named in this record." ;\n'}    rdfs:label ${lit(label)} ;
    dct:license <https://creativecommons.org/licenses/by/4.0/> ;
    npx:hasNanopubType <${type}> ;
${templateNotes(templates)}${introduces ? `    npx:introduces <${introduces}> ;\n` : ''}    delphi:domain <${DOMAIN}> .
  <${DOMAIN}> rdfs:label "math-population-genetics-and-evolutionary-theory" .
}`;
const head = `sub:Head {
  this: a np:Nanopublication ;
    np:hasAssertion sub:assertion ;
    np:hasProvenance sub:provenance ;
    np:hasPublicationInfo sub:pubinfo .
}`;
const trig = (assertion, provenance, pub) => `${PREFIXES}\n${head}\n\n${assertion}\n\n${provenance}\n\n${pub}\n`;

const outDir = path.join(here, 'unsigned');
fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
const write = (name, text, extra) => { fs.writeFileSync(path.join(outDir, name), text); manifest.push({ file: `lean/nanopubs/unsigned/${name}`, status: 'unsigned draft', registry: null, trustyUri: null, ...extra }); };

// Which audited theorems belong to each module, and the main definition the law rests on.
const leanDecl = { 'kimura-substitution-rate': 'Delphi.substitutionRate', 'kimura-fixation-probability': 'Delphi.NeutralChain', 'fisher-ftns': 'Delphi.meanFitness', 'maynardsmith-twofold-cost': 'Delphi.asexualNext', 'favored-fixation-lower-bound': 'Delphi.FavoredChain', 'blueprint-well-formedness': 'Delphi.Blueprint.Graph', 'thompson1917-ch03-07': 'Delphi.CubeLaw' };
const theoremsFor = { 'kimura-substitution-rate': ['Delphi.neutral_substitution_rate', 'Delphi.neutral_substitution_rate_diploid', 'Delphi.neutral_substitution_rate_tendsto', 'Delphi.wrightFisher_fixation_one'], 'kimura-fixation-probability': ['Delphi.NeutralChain.fixedBy_tendsto', 'Delphi.NeutralChain.fixedBy_sub_le'], 'fisher-ftns': ['Delphi.fisher_fundamental_theorem', "Delphi.fisher_fundamental_theorem'", 'Delphi.mean_fitness_nondecreasing'], 'maynardsmith-twofold-cost': ['Delphi.twofold_cost_of_sex', 'Delphi.twofold_cost_of_sex_n'], 'favored-fixation-lower-bound': ['Delphi.FavoredChain.fixationProbability_ge', 'Delphi.FavoredChain.fixationProbability_le_one', 'Delphi.wrightFisherSelection_fixation_one_ge', 'Delphi.neutral_expectedSubstitutions', 'Delphi.favored_expectedSubstitutions_ge', 'Delphi.expectedSubstitutions_le', 'Delphi.wrightFisherSelection_substitutions_bounds'], 'blueprint-well-formedness': ['Delphi.Blueprint.wellFormed_of_check', 'Delphi.Blueprint.Graph.acyclic_of_levelsDown', 'Delphi.Blueprint.Graph.transGen_trans', 'Delphi.Blueprint.Graph.transGen_level_lt', 'Delphi.Blueprint.Graph.rooted_of'], 'thompson1917-ch03-07': ['Delphi.cubeLaw_loglog_exponent', 'Delphi.cubeLaw_ratio', 'Delphi.not_cubeLaw_of_exponent_ne_three'] };
const auditOf = name => R.audit.theorems.find(t => t.theorem === name);
const plain = {
  'kimura-substitution-rate': 'In a neutral Wright-Fisher population of M gene copies, the rate at which new mutations become fixed equals the mutation rate per copy per generation, whatever M is.',
  'kimura-fixation-probability': 'In a neutral absorbing chain on 0..M copies, including the exact Wright-Fisher chain, a mutant present in i copies is eventually fixed with probability i/M.',
  'fisher-ftns': 'For one haploid or clonal locus with fixed fitnesses, one round of selection raises mean fitness by exactly the variance in fitness divided by the mean fitness.',
  'maynardsmith-twofold-cost': 'With equal fecundity, a 1:1 sex ratio and males contributing nothing, the odds of asexual to sexual females double every generation and are 2^n times the initial odds after n generations.',
  'blueprint-well-formedness': 'A finite graph of ontology terms with a body root, levels and part_of edges is well-formed when every edge goes strictly down in level, every edge joins two nodes, every non-root node has a whole, and the pinned taxon statements exclude nothing: then part_of is acyclic, its closure is transitive, every node reaches the root, and a Boolean checker whose truth implies all of this can be evaluated by the kernel on each emitted blueprint.',
  'thompson1917-ch03-07': 'If weight is k times the cube of a linear dimension (isometric growth at constant density), the log-log exponent of weight on that dimension is exactly 3 and the weight ratio is the cube of the size ratio; a measured exponent other than 3 refutes the exact cube law on that interval.',
  'favored-fixation-lower-bound': 'In an absorbing chain on 0..M gene copies whose expected copy number never decreases (neutral, or selection for the mutant), including Wright-Fisher sampling with relative fitness 1+s for any s >= 0, a lineage of i copies is eventually fixed with probability at least i/M; so the expected number of substitutions over T generations is at least mu T and at most M mu T.'
};
const notEstablished = 'Does not establish: anything about organisms. The theorem is exact inside the stated model and silent outside it; strict neutrality, constant population size, Wright-Fisher reproduction and independent mutant fates (Kimura), fixed fitnesses and haploid inheritance (Fisher), equal fecundity and a 1:1 sex ratio (Maynard Smith) are assumptions written in the module header, not conclusions. Kernel-checked is not expert-validated: no human expert has validated these statements. Whether the Lean statement faithfully renders the paper is a separate assessment record, and so far only one assessor provider has run.';

for (const f of R.formalized) {
  const id = f.claim_id, law = `${DELPHIR}math-law/${id}`, claim = `${DELPHIR}claim/${id}`, ev = `${DELPHIR}evidence/lean-kernel-check-${id}`;
  const mod = R.modules.find(m => m.file === f.module);
  const thms = theoremsFor[id].map(n => ({ name: n, audit: auditOf(n), decl: R.theorems.find(t => t.name === n.split('.').pop()) || R.lemmas.find(t => t.name === n.split('.').pop()) }));
  const missing = thms.filter(t => !t.audit); if (missing.length) throw new Error(`${id}: not in the #print axioms audit: ${missing.map(t => t.name).join(', ')}`);
  const main = thms[0];
  const leanSrc = (main.decl?.doc ? `/-- ${main.decl.doc} -/\n` : '') + (main.decl?.statement || '');
  const muts = M.results.filter(r => r.kind === 'mutation' && r.claim_id === id);
  const axioms = [...new Set(thms.flatMap(t => t.audit.axioms))].sort();
  const receipt = `Build receipt. ${R.versions.lean}; toolchain ${R.versions.toolchain}; Mathlib ${R.versions.mathlib.inputRev} (${R.versions.mathlib.rev}). lake build exit ${R.build.exit} in ${R.build.seconds} s with ${R.build.errors} errors; ${mod.sorries} sorry in ${f.module} (${mod.lines} lines). #print axioms for ${thms.map(t => t.name).join(', ')}: ${axioms.join(', ')} only (Lean's standard axioms; no sorryAx). Mutation evidence (lean/mutate.mjs, ${M.summary.run}): ${muts.length} deliberate change(s) to the statement or the model were each rejected by the compiler: ${muts.map(m => `[${m.id}] ${m.description} Rejected with ${m.errors} error(s): ${m.firstError}`).join(' ')} Controls: ${M.summary.controlsPassed} of ${M.summary.controls} unmodified modules accepted by the same command.`;
  const assertion = `sub:assertion {
  <${law}> a delphi:Concept, skos:Concept ;
    rdfs:label ${lit(`${f.label} (Lean 4, kernel-checked)`)} ;
    dct:description ${lit(plain[id])} ;
${f.paper ? `    dct:source ${lit(`${f.paper.title} (${f.paper.year})`)} ;\n` : `    dct:source ${lit(f.claim_id === 'blueprint-well-formedness' ? 'Proved in this project (lean/Delphi/Blueprint.lean) for the organism thread\'s text-to-blueprint tool; structural well-formedness, no paper states it.' : 'Proved in this project (lean/Delphi/Favored.lean) as an extension of the neutral case of Kimura (1962) to non-opposing selection; no paper states it in this form.')} ;\n`}${f.paper?.doi ? `    prov:wasDerivedFrom <https://doi.org/${f.paper.doi}> ;\n` : ''}    skos:notation ${lit(f.notation)} ;
    skos:definition ${longlit(leanSrc)}^^delphi:lean4 ;
    schema:programmingLanguage "Lean 4" ;
    delphi:leanDeclaration ${lit(leanDecl[id])} ;
    delphi:leanTheorem ${thms.map(t => lit(t.name)).join(', ')} ;
    delphi:leanVerified "true"^^xsd:boolean ;
    skos:scopeNote ${lit(f.note || 'As stated in the module header.')} ;
    rdfs:comment ${lit('Status: kernel-checked (Lean 4 accepted the module with zero sorry and standard axioms only). Not expert-validated. ' + notEstablished)} ;
    rdfs:seeAlso <${blob(f.module)}>, <${SITE}/lean.json>, <${SITE}/> .
  <${claim}> dct:conformsTo <${law}> ;
    delphi:hasEvidence <${ev}> .
  <${ev}> a delphi:EvidenceItem ;
    rdfs:label ${lit(`Lean 4 kernel accepted ${main.name} with zero sorry and standard axioms, and rejected ${muts.length} deliberately broken variant(s)`)} ;
    dct:description ${lit(receipt)} ;
    dct:subject <${law}> ;
    rdfs:comment ${lit('This evidence item establishes that the stated theorem follows from the stated model. ' + notEstablished)} ;
    prov:wasDerivedFrom <${SITE}/lean.json>, <${blob('lean/mutations.json')}>, <${blob('lean/Delphi/Audit.lean')}> .
}`;
  write(`law-${id}.trig`, trig(assertion, builderProv([blob(f.module), `${SITE}/lean.json`, blob('lean/mutations.json')]), pubinfo(`${f.label}: machine-checked in Lean 4`, `${DELPHI}Concept`, law, [['wasCreatedFromProvenanceTemplate', TEMPLATES.provenance], ['wasCreatedFromPubinfoTemplate', TEMPLATES.pubinfoDomain]])),
    { kind: 'law', claim, law, evidence: ev, theorems: thms.map(t => t.name), axioms, mutantsRejected: muts.length });

  // Proof scope: kernel-checked vs assumed, as separate statements on the law.
  const ps = f.proofScope;
  const scope = `sub:assertion {
  <${law}> dct:description ${lit(`Proof scope of ${f.label}: ${ps.kernelChecked.length} statement(s) the Lean kernel checked and ${ps.assumed.length} assumption(s) stated in the module header and not proved.`)} ;
${ps.kernelChecked.map(x => `    skos:scopeNote ${lit('Kernel-checked: ' + x)} ;`).join('\n')}
${ps.assumed.map(x => `    skos:scopeNote ${lit('Assumed, not proved: ' + x)} ;`).join('\n')}
    rdfs:comment ${lit('The kernel-checked statements are theorems of the model; the assumptions are the model. ' + notEstablished)} ;
    rdfs:seeAlso <${blob(f.module)}> .
}`;
  write(`scope-${id}.trig`, trig(scope, builderProv([blob(f.module), `${SITE}/lean.json`]), pubinfo(`Proof scope of ${f.label}`, `${DELPHI}Concept`, null, [['wasCreatedFromProvenanceTemplate', TEMPLATES.provenance], ['wasCreatedFromPubinfoTemplate', TEMPLATES.pubinfoDomain]])),
    { kind: 'proof-scope', law, kernelChecked: ps.kernelChecked.length, assumed: ps.assumed.length });
}

// The flying-fish substitution budget: a delphi:Hypothesis (a proposition the graph represents without
// asserting; no source states it) derived from the audited theorems and the sourced parameters in
// lean/bound/parameters.json. Every number is read from lean.json's `bound` block (lean/bound/compute.mjs).
const B = R.bound;
if (B && B.verified) {
  const P = JSON.parse(fs.readFileSync(path.join(here, '../bound/parameters.json'), 'utf8'));
  const links = fs.existsSync(path.join(here, '../bound/links.json')) ? JSON.parse(fs.readFileSync(path.join(here, '../bound/links.json'), 'utf8')) : {};
  const HYP = `${DELPHIR}hypothesis/exocoetidae-substitution-budget`, BEV = `${DELPHIR}evidence/exocoetidae-substitution-budget-computation`;
  const lawF = `${DELPHIR}math-law/favored-fixation-lower-bound`, lawK = `${DELPHIR}math-law/kimura-substitution-rate`, lawP = `${DELPHIR}math-law/kimura-fixation-probability`;
  const DATASET = `${DELPHIR}dataset/pbdb-occurrence-counts-2026-10-31`;
  const e2 = x => Number(x).toExponential(2), f3 = x => Number(x).toFixed(3);
  const dois = [...P.mutationRatePerSitePerGeneration.sources.map(s => s.doi), P.genomeSites.source.doi, ...P.populationSize.pointEstimates.map(p => p.doi), ...P.generationTimeYears.sources.filter(s => s.doi).map(s => s.doi)].filter(Boolean).map(d => `<https://doi.org/${d}>`);
  const urls = [P.durationMa.source.url, ...P.generationTimeYears.sources.filter(s => s.url).map(s => s.url)].map(u => `<${u}>`);
  const numbers = `Generations available: ${e2(B.generations.low)} to ${e2(B.generations.high)} (duration ${B.inputs.durationMa.low} to ${B.inputs.durationMa.high} Ma over a generation time of ${B.inputs.generationTimeYears.high} to ${B.inputs.generationTimeYears.low} years). Neutral budget, mu T per site (Delphi.neutral_expectedSubstitutions, independent of N): ${f3(B.neutralPerSite.low)} to ${f3(B.neutralPerSite.high)} substitutions per site, ${e2(B.neutralPerGenome.low)} to ${e2(B.neutralPerGenome.high)} genome-wide (G = ${e2(B.inputs.genomeSites.value)}); with a 2-year generation time the low end becomes ${f3(B.neutralPerSite.sensitivity2y)} per site${B.neutralPerSite.sensitivityAltFossil != null ? `, and with the next-oldest fossil record in place of the Ypresian one (${B.inputs.durationMa.alternativeFirstAppearance.low} Ma, ${B.inputs.durationMa.alternativeFirstAppearance.what}) it becomes ${f3(B.neutralPerSite.sensitivityAltFossil)} per site` : ''}. The first appearance rests on ${(B.inputs.durationMa.records || []).length} PBDB occurrence records from one publication: ${(B.inputs.durationMa.records || []).map(r => `${r.occurrence} ${r.taxon}, ${r.interval} ${r.early_ma}-${r.late_ma} Ma, ${r.reference}`).join('; ')}. Floor on adaptive substitutions (Delphi.favored_expectedSubstitutions_ge): mu_f T per site, with mu_f (the rate of mutations selection does not oppose) undefined; it equals the neutral budget at mu_f = mu and is independent of N. Ceiling (Delphi.expectedSubstitutions_le): 2 N mu T per site, ${B.ceiling.perSiteByN.map(r => `N = ${e2(r.N)}: ${e2(r.low)} to ${e2(r.high)}`).join('; ')}; vacuous. Required substitutions for a wing: undefined. Verdict: ${B.comparison.verdict}.`;
  const plainB = `Over the ${B.inputs.durationMa.low} to ${B.inputs.durationMa.high} million years since the oldest Exocoetidae fossil, the machine-checked fixation theorems give the lineage a neutral substitution budget of ${f3(B.neutralPerSite.low)} to ${f3(B.neutralPerSite.high)} substitutions per site (${e2(B.neutralPerGenome.low)} to ${e2(B.neutralPerGenome.high)} genome-wide), independent of population size; adaptive substitutions have a floor of mu_f T per site that depends on an undefined favored-mutation rate, and a ceiling of 2 N mu T per site that is vacuous. Whether this was enough to modify a gliding fish into a winged animal (Darwin 1859, ch. VI) is inconclusive: the number of substitutions a wing requires is not a defined quantity, so there is nothing to compare the budget with.`;
  const assertion = `sub:assertion {
  <${HYP}> a delphi:Hypothesis, skos:Concept ;
    rdfs:label "Substitution budget of the flying-fish lineage (Exocoetidae) over its fossil duration, from the machine-checked fixation theorems: inconclusive for the gliding-to-flight question" ;
    dct:description ${lit(plainB)} ;
    delphi:context ${lit(`Darwin, On the Origin of Species (1859), chapter VI: flying-fish "might have been modified into perfectly winged animals" (Project Gutenberg text 1228, lines 5639-5642; organisms/darwin-origin/ch05-06/mentions.json). Taxon: Exocoetidae, NCBI Taxonomy ${P.taxon.ncbi_taxid}, GBIF ${P.taxon.gbif_usage_key}, Wikidata ${P.taxon.wikidata_qid}, PBDB ${P.taxon.pbdb_taxon}. Parameters and sources: ${P.durationMa.source.label} ${P.generationTimeYears.sources.map(s => s.label).join(' ')} ${P.mutationRatePerSitePerGeneration.sources.map(s => s.label).join(' ')} ${P.genomeSites.source.label} ${P.populationSize.pointEstimates.map(p => `${p.species}: ${p.value}, ${p.what}; ${p.source}`).join(' ')} Caveats: ${P.durationMa.caveat} ${P.generationTimeYears.caveat} ${P.mutationRatePerSitePerGeneration.caveat} ${P.genomeSites.caveat} ${P.populationSize.caveat}`)} ;
    delphi:hasEvidence <${BEV}> ;
    prov:used <${lawF}>, <${lawK}>, <${lawP}>, <${DATASET}> ;
    prov:wasDerivedFrom ${[...dois, ...urls].join(', ')} ;
${B.kernelChecked.map(x => `    skos:scopeNote ${lit('Kernel-checked: ' + x)} ;`).join('\n')}
${B.assumed.map(x => `    skos:scopeNote ${lit('Assumed, not proved: ' + x)} ;`).join('\n')}
    rdfs:comment ${lit(`Verdict: ${B.comparison.verdict}. ${B.comparison.reason} Does not establish: that a wing was or was not reachable; which genes or substitutions a wing needs; that any of the named parameters hold for Exocoetidae (none of mu, generation time or N is measured for the family, and the fossil age is a minimum); anything beyond the Wright-Fisher model with independent mutant fates. The arithmetic multiplying the proved rate by generations and sites is a definition applied with a script (lean/bound/compute.mjs), kernel-checked only in the form of the theorems named above. Kernel-checked is not expert-validated. The dataset IRI <${DATASET}> follows the Delphi dataset convention for the repository record organisms/darwin-origin/ch05-06/datasets/pbdb-occurrence-counts-2026-10-31.json; its dataset nanopub is unpublished at build time.${links.blueprintClaim ? '' : ' The organism thread\'s blueprint record for the flying fish is not linked because it did not exist when this draft was built; rebuild with lean/bound/links.json once it does.'}`)} ;
${links.blueprintClaim ? `    skos:related <${links.blueprintClaim}> ;\n    rdfs:comment ${lit(`Related record: <${links.blueprintClaim}> is the organism thread's ontology-derived anatomical blueprint for the living family${links.blueprintNote ? ' (' + links.blueprintNote + ')' : ''}. The two records are independent statements about the same taxon; this is a citation, not a support or derivation relation in either direction. Neither record is evidence about the transition Darwin imagined.`)} ;\n` : ''}${links.darwinReference ? `    dct:references ${lit(links.darwinReference)} ;\n` : ''}    rdfs:seeAlso <${blob('lean/bound/parameters.json')}>, <${blob('lean/bound/compute.mjs')}>, <${blob('lean/Delphi/Favored.lean')}>, <${blob('organisms/darwin-origin/ch05-06/taxa/exocoetidae.json')}>, <${SITE}/lean.json>, <${SITE}/#flyingfish> .
  <${BEV}> a delphi:EvidenceItem ;
    rdfs:label "Computation of the Exocoetidae substitution budget from the audited theorems and the sourced parameters" ;
    dct:description ${lit(`Theorems (all accepted by Lean ${R.versions.toolchain} with standard axioms only; see lean.json audit): ${Object.values(B.theorems).map(t => `${t.name} [${t.formula}]`).join('; ')}. ${numbers} Computed ${B.computed} by lean/bound/compute.mjs from lean/bound/parameters.json.`)} ;
    dct:subject <${HYP}> ;
    rdfs:comment "This evidence item establishes only that the numbers follow from the named theorems' formulas and the named parameter values. It is not evidence that the parameters are right for Exocoetidae, and not evidence about wings." ;
    prov:wasDerivedFrom <${SITE}/lean.json>, <${blob('lean/bound/parameters.json')}>, <${blob('lean/bound/result.json')}> .
}`;
  write('bound-exocoetidae-substitution-budget.trig', trig(assertion, builderProv([blob('lean/bound/parameters.json'), blob('lean/bound/compute.mjs'), blob('lean/Delphi/Favored.lean'), `${SITE}/lean.json`]), pubinfo('Substitution budget of the flying-fish lineage from the machine-checked fixation theorems: inconclusive', `${DELPHI}Hypothesis`, HYP, [['wasCreatedFromProvenanceTemplate', TEMPLATES.provenance], ['wasCreatedFromPubinfoTemplate', TEMPLATES.pubinfoDomain]])),
    { kind: 'bound', hypothesis: HYP, evidence: BEV, verdict: B.comparison.verdict, blueprintLinked: !!links.blueprintClaim, publishable: 'after signing by the key owner, test registry first; rebuild with lean/bound/links.json once the organism thread\'s blueprint record exists' });
}

// Blueprint certificates: one record per certified blueprint. A delphi:Hypothesis ("the emitted structure is
// well-formed under its own rules") with the kernel-checked certificate as its evidence item. It cites the organism
// thread's blueprint claim as a related record only; it asserts nothing about that claim's truth.
for (const c of (R.blueprintCertificates || []).filter(c => c.verified && c.current)) {
  const HYP = `${DELPHIR}hypothesis/blueprint-well-formed-${c.name}`, CEV = `${DELPHIR}evidence/blueprint-certificate-${c.name}`;
  const lawB = `${DELPHIR}math-law/blueprint-well-formedness`;
  const related = `${DELPHIR}claim/organism-blueprint-${c.name}`;
  const g = c.graph, t = c.taxonData;
  const plain = `The blueprint the organism thread's tool emitted for "${c.blueprint.description}" (${c.blueprint.taxon.label}, ${c.blueprint.taxon.term}; file ${c.blueprint.file}, sha256 ${c.blueprint.sha256}) is well-formed under its own rules: its ${g.distinctEdges} part_of placements over ${g.distinctTerms} distinct terms all go strictly down in level, form no cycle, and lead every term to the body root; ${t.rows.neverIn} never_in_taxon statements reachable from kept terms name no taxon that contains ${c.blueprint.taxon.label} (containing taxa pinned from Ubergraph: ${t.rows.ancestors}), and ${t.rows.inTaxon} in_taxon plus ${t.rows.stated} stated_in_taxon statements all name containing taxa. Distinct terms per level: ${Object.entries(g.countsByLevelDistinct).map(([k, v]) => `${k} ${v}`).join(', ')} (placements: ${Object.entries(g.countsByLevelPlacements).map(([k, v]) => `${k} ${v}`).join(', ')}). The Lean kernel evaluated the checker (${c.theorems.check}) and accepted ${c.theorems.wellFormed}, ${c.theorems.counts} and ${c.theorems.size} with standard axioms only.`;
  const assertion = `sub:assertion {
  <${HYP}> a delphi:Hypothesis, skos:Concept ;
    rdfs:label ${lit(`The emitted blueprint for "${c.blueprint.description}" is structurally well-formed (kernel-checked certificate)`)} ;
    dct:description ${lit(plain)} ;
    delphi:context ${lit(`Certificate generated ${c.generated} by ${c.tool} from the blueprint file and lean/blueprint/data/${c.name}.taxon.json (sha256 ${t.sha256}; ${t.queries} SPARQL queries to ${t.endpoint}, retrieved ${t.retrieved.first} to ${t.retrieved.last}). Generic theory: lean/Delphi/Blueprint.lean. Lean ${R.versions.toolchain}; certificate compiled in ${c.compile.seconds} s.`)} ;
    delphi:hasEvidence <${CEV}> ;
    prov:used <${lawB}> ;
${c.kernelChecked.map(x => `    skos:scopeNote ${lit('Kernel-checked: ' + x)} ;`).join('\n')}
${c.assumed.map(x => `    skos:scopeNote ${lit('Assumed, not proved: ' + x)} ;`).join('\n')}
    rdfs:comment ${lit(`Does not establish: that ${c.blueprint.taxon.label} or any organism has these structures; that the anatomy is correct or complete; that Uberon, the Cell Ontology or Ubergraph are right; that any part was measured; or anything about a transition between forms. It establishes only that the emitted structure is internally coherent under its own stated rules, with the data pinned by hash. Kernel-checked is not expert-validated.`)} ;
    skos:related <${related}> ;
    rdfs:comment ${lit(`Related record: <${related}> is the organism thread's own record of this blueprint. This record is a citation of it, not a statement about its truth, and no support or derivation relation is asserted in either direction. The organism thread may attach this certificate as evidence from its side if it chooses; this record does not do so.`)} ;
    rdfs:seeAlso <${blob(c.leanModule)}>, <${blob(c.theory)}>, <${blob(`lean/blueprint/certificates/${c.name}.json`)}>, <${blob(c.blueprint.file)}>, <${SITE}/lean.json>, <${SITE}/#blueprint> .
  <${CEV}> a delphi:EvidenceItem ;
    rdfs:label ${lit(`Lean 4 kernel accepted the well-formedness certificate of the "${c.blueprint.description}" blueprint`)} ;
    dct:description ${lit(`${c.theorems.wellFormed} := wellFormed_of_check _ _ ${c.theorems.check}, where ${c.theorems.check} is proved by decide +kernel on the literal graph (${g.distinctTerms} nodes, ${g.distinctEdges} edges) and taxon data (${t.rows.ancestors} ancestors, ${t.rows.neverIn} never_in_taxon rows, ${t.rows.inTaxon} in_taxon rows, ${t.rows.stated} stated_in_taxon rows). #print axioms: ${[...new Set(Object.values(c.audit).flatMap(a => a ? a.axioms : ['(not audited)']))].join(', ')}. Blueprint file sha256 ${c.blueprint.sha256} (built ${c.blueprint.built}); taxon data sha256 ${t.sha256}. Mutation evidence (lean/mutate.mjs): ${M.results.filter(r => r.kind === 'mutation' && r.claim_id === 'blueprint-well-formedness').map(m => `[${m.id}] ${m.description} ${m.outcome}.`).join(' ')}`)} ;
    dct:subject <${HYP}> ;
    rdfs:comment "This evidence item establishes that the checker accepts the pinned data and that the generic theorems apply. It is not evidence about any organism." ;
    prov:wasDerivedFrom <${SITE}/lean.json>, <${blob(`lean/blueprint/certificates/${c.name}.json`)}>, <${blob(`lean/blueprint/data/${c.name}.taxon.json`)}> .
}`;
  write(`certificate-blueprint-${c.name}.trig`, trig(assertion, builderProv([blob(c.leanModule), blob(c.theory), blob(`lean/blueprint/certificates/${c.name}.json`), `${SITE}/lean.json`]), pubinfo(`Well-formedness certificate for the "${c.blueprint.description}" blueprint`, `${DELPHI}Hypothesis`, HYP, [['wasCreatedFromProvenanceTemplate', TEMPLATES.provenance], ['wasCreatedFromPubinfoTemplate', TEMPLATES.pubinfoDomain]])),
    { kind: 'certificate', hypothesis: HYP, evidence: CEV, blueprint: c.blueprint.file, blueprintSha256: c.blueprint.sha256, related, publishable: 'after signing by the key owner, test registry first; regenerate when the blueprint is rebuilt' });
}

// Rubric lean-faithfulness/0.1.0 as a concept with four dimensions (text from lean/assessment/prompt.md).
const RUBRIC = `${DELPHIR}concept/lean-faithfulness-0.1.0`;
const dims = [
  ['same_quantities', 'Same quantities', 'Do the Lean quantities (the definitions shown) correspond to the quantities named in the law? 1 = each named quantity has a matching definition with the same meaning; 0 = the theorem is about different quantities.'],
  ['assumptions_match', 'Assumptions match', "Are the hypotheses of the Lean theorem the law's stated assumptions, no more and no less? Score down for hidden extra assumptions that make the theorem easier, or for missing assumptions that the law needs."],
  ['scope_stated', 'Scope stated', 'If the Lean theorem covers a special case (e.g. neutral only, haploid only), is that narrowing explicit in the docstring, and is it the case the law actually needs?'],
  ['not_trivial', 'Not trivial', "Is the theorem's content the law, rather than generic arithmetic dressed in the law's names? A theorem whose hypotheses already contain the conclusion, or whose conclusion follows by rearranging a definition, scores 0."]
];
const dimIri = k => `${RUBRIC}-${k.replace(/_/g, '-')}`;
const rubricAssertion = `sub:assertion {
  <${RUBRIC}> a delphi:Concept, skos:Concept ;
    rdfs:label "Faithfulness of a Lean 4 statement to a stated law of biology, v0.1.0 (lean-faithfulness/0.1.0)" ;
    dct:description "Scores whether a Lean 4 theorem STATEMENT (hypotheses and conclusion, never the proof) faithfully formalises a law as its source states it. The assessor sees only the claim text, the theorem's docstring and statement, and the definitions it uses; not the proof, not the module header, not the builder's notes. Each dimension is a graded judgement in {0, 0.25, 0.5, 0.75, 1} (delphi:hasScore), never a probability; there is no weighted overall score. Verdicts: faithful = the statement is the law; faithful-with-narrower-scope = a correct but narrower instance of the law, with the narrowing stated; unfaithful = different quantities, hidden assumptions, or trivial content. The project requires assessments from two providers other than the builder's before a verdict travels with a published claim." ;
    rdfs:seeAlso <${blob('lean/assessment/prompt.md')}> ;
    skos:narrower ${dims.map(([k]) => `<${dimIri(k)}>`).join(', ')} .
${dims.map(([k, l, d]) => `  <${dimIri(k)}> a delphi:Concept, skos:Concept ;
    rdfs:label ${lit(`${l} (lean-faithfulness 0.1.0)`)} ;
    dct:description ${lit(d)} ;
    skos:broader <${RUBRIC}> .`).join('\n')}
}`;
write('rubric-lean-faithfulness-0.1.0.trig', trig(rubricAssertion, builderProv([blob('lean/assessment/prompt.md')]), pubinfo('Rubric lean-faithfulness/0.1.0', `${DELPHI}Concept`, RUBRIC, [['wasCreatedFromTemplate', TEMPLATES.rubric], ['wasCreatedFromProvenanceTemplate', TEMPLATES.provenance], ['wasCreatedFromPubinfoTemplate', TEMPLATES.pubinfoDomain]])), { kind: 'rubric', rubric: RUBRIC });

// One assessment record per claim per assessor, verdict literal.
for (const a of assessments) {
  const id = a.claim_id, claim = `${DELPHIR}claim/${id}`, law = `${DELPHIR}math-law/${id}`;
  const modelId = a.assessor.model, provider = a.assessor.provider;
  const A = `${DELPHIR}assessment/lean-faithfulness--${id}--${provider}`;
  const AGENT = `${DELPHIR}agent/delphisci-lean-faithfulness-assessor-${modelId}`, MODEL = `${DELPHIR}model/${modelId}`;
  const nProv = providersPerClaim(id).length;
  const caution = `Single-provider so far: this is 1 of the 2 assessor providers the project requires (claimsWithTwoProviders: ${claimsWithTwoProviders} of ${R.formalized.length} at build time). It is one model's blind opinion about a translation, not a consensus and not evidence about organisms. Verdict recorded exactly as the assessor returned it.`;
  const assertion = `sub:assertion {
  <${claim}> delphi:hasAssessment <${A}> .
  <${A}> a delphi:LLMClaimAssessment ;
    rdfs:label ${lit(`${modelId} on the Lean statement of ${id}: ${a.verdict}`)} ;
    delphi:evaluatesHypothesis <${claim}> ;
    dct:subject <${RUBRIC}> ;
    delphi:assessmentType "lean-faithfulness/0.1.0" ;
    delphi:hasVerdict ${lit(a.verdict)} ;
    dct:date "${a.assessor.date.slice(0, 10)}"^^xsd:date ;
    dct:description ${lit(a.rationale)} ;
    rdfs:comment ${lit(caution)} ;
    prov:used <${law}> ;
    prov:wasAttributedTo <${AGENT}> .
${Object.entries(a.scores).map(([k, v]) => `  <${A}--${k.replace(/_/g, '-')}> a delphi:LLMClaimAssessment ;
    rdfs:label ${lit(`${dims.find(d => d[0] === k)?.[1] || k} of the Lean statement of ${id} by ${modelId}: ${v}`)} ;
    dct:subject <${dimIri(k)}> ;
    delphi:assessmentType "lean-faithfulness/0.1.0/${k}" ;
    delphi:hasScore "${Number(v)}"^^xsd:double ;
    dct:isPartOf <${A}> ;
    prov:wasAttributedTo <${AGENT}> .
  <${claim}> delphi:hasAssessment <${A}--${k.replace(/_/g, '-')}> .`).join('\n')}
  <${AGENT}> a prov:SoftwareAgent ;
    rdfs:label ${lit(`delphisci lean-faithfulness assessor (${modelId}, blind: claim text + Lean statement + definitions, no proof), run via ${a.assessor.via}`)} ;
${onBehalf}    delphi:usesModel <${MODEL}> .
  <${MODEL}> a delphi:LanguageModel ;
    rdfs:label ${lit(modelId)} ;
    dct:identifier ${lit(modelId)} .
}`;
  const provenance = `sub:provenance {
  sub:assertion prov:wasAttributedTo <${AGENT}> ;
    prov:wasDerivedFrom <${blob(`lean/assessment/prompts/${id}.md`)}> , <${blob(`lean/assessment/results/${id}.${provider}.json`)}> , <${RUBRIC}> ;
    prov:wasGeneratedBy sub:assessment .
  sub:assessment a prov:Activity ;
    prov:startedAtTime "${a.assessor.date}"^^xsd:dateTime ;
    prov:wasAssociatedWith <${AGENT}> ;
    prov:qualifiedAssociation sub:assessmentPlan .
  sub:assessmentPlan prov:hadPlan <${blob('lean/assessment/prompt.md')}> .
}`;
  write(`assessment-${id}--${provider}.trig`, trig(assertion, provenance, pubinfo(`${modelId} on the Lean statement of ${id}: ${a.verdict}`, `${DELPHI}LLMClaimAssessment`, A, [['wasCreatedFromTemplate', TEMPLATES.rubricAssessment], ['wasCreatedFromProvenanceTemplate', TEMPLATES.provenance], ['wasCreatedFromPubinfoTemplate', TEMPLATES.pubinfoDomain]])),
    { kind: 'assessment', claim, assessment: A, provider, model: modelId, verdict: a.verdict, scores: a.scores, providersForClaim: nProv, publishable: nProv >= 2 ? 'yes: two providers' : 'hold: one provider only' });
}

fs.writeFileSync(path.join(here, 'manifest.json'), JSON.stringify({
  built: now, commit, commitPinned: !!commit, repository: REPO,
  owner: owner, ownerSet: !!owner, ownerNote: owner ? null : 'No human named. The key owner sets --owner <orcid IRI> at signing time; that single value populates prov:actedOnBehalfOf on both agents.',
  creator: BUILDER_AGENT, signerIdentity: 'to be decided by the key owner: a bot identity with its own key pair and introduction nanopub is the intended shape (nanopub skill); never a human ORCID as signer without that person\'s approval',
  note: commit ? null : 'Links point at the branch; rerun with --commit <hash> once lean/ is committed and before signing.',
  templateConformance: { rule: 'delphi v2.0 IRIs only; records are hand-authored, so no nt:wasCreatedFrom*Template triple is declared; the template that would otherwise apply is named in an rdfs:comment with its published probknow IRI count and the check date', checkedOn: TEMPLATE_CHECK_DATE, publishedTemplateProbknowIriCounts: TEMPLATE_PROBKNOW_COUNTS, observation: 'The published rubric-assessment template RAOAK6Fe… carries 19 legacy probknow IRIs while project-delphi-ontology/nanopubs/src/18-template-probknow-rubric-assessment.trig at commit 6ba5f9a is already migrated to delphi: (0 probknow IRIs): the migration happened in the source and was never republished to the network.' },
  publishing: { status: 'unsigned drafts; nothing signed or published', policy: 'np check + lint, then TEST registry only; production needs the ORCID key owner\'s explicit approval each time', claimsWithTwoProviders, claimsFormalized: R.formalized.length, assessmentRecordsPublishable: claimsWithTwoProviders > 0 ? 'some' : 'none: hold until a second provider has run' },
  leanBuild: { built: R.built, lean: R.versions.lean, mathlib: R.versions.mathlib, buildOk: R.build.ok, sorry: R.sorryTotal, nonStandardAxioms: R.audit.nonStandard.length },
  mutations: M.summary,
  nanopubs: manifest
}, null, 1));
console.log(`${manifest.length} unsigned drafts in lean/nanopubs/unsigned (${manifest.filter(m => m.kind === 'law').length} law, ${manifest.filter(m => m.kind === 'proof-scope').length} proof-scope, ${manifest.filter(m => m.kind === 'bound').length} bound, ${manifest.filter(m => m.kind === 'certificate').length} certificate, 1 rubric, ${manifest.filter(m => m.kind === 'assessment').length} assessment); commitPinned=${!!commit}; claimsWithTwoProviders=${claimsWithTwoProviders}`);
