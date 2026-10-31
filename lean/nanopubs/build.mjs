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
const leanDecl = { 'kimura-substitution-rate': 'Delphi.substitutionRate', 'kimura-fixation-probability': 'Delphi.NeutralChain', 'fisher-ftns': 'Delphi.meanFitness', 'maynardsmith-twofold-cost': 'Delphi.asexualNext' };
const theoremsFor = { 'kimura-substitution-rate': ['Delphi.neutral_substitution_rate', 'Delphi.neutral_substitution_rate_diploid', 'Delphi.neutral_substitution_rate_tendsto', 'Delphi.wrightFisher_fixation_one'], 'kimura-fixation-probability': ['Delphi.NeutralChain.fixedBy_tendsto', 'Delphi.NeutralChain.fixedBy_sub_le'], 'fisher-ftns': ['Delphi.fisher_fundamental_theorem', "Delphi.fisher_fundamental_theorem'", 'Delphi.mean_fitness_nondecreasing'], 'maynardsmith-twofold-cost': ['Delphi.twofold_cost_of_sex', 'Delphi.twofold_cost_of_sex_n'] };
const auditOf = name => R.audit.theorems.find(t => t.theorem === name);
const plain = {
  'kimura-substitution-rate': 'In a neutral Wright-Fisher population of M gene copies, the rate at which new mutations become fixed equals the mutation rate per copy per generation, whatever M is.',
  'kimura-fixation-probability': 'In a neutral absorbing chain on 0..M copies, including the exact Wright-Fisher chain, a mutant present in i copies is eventually fixed with probability i/M.',
  'fisher-ftns': 'For one haploid or clonal locus with fixed fitnesses, one round of selection raises mean fitness by exactly the variance in fitness divided by the mean fitness.',
  'maynardsmith-twofold-cost': 'With equal fecundity, a 1:1 sex ratio and males contributing nothing, the odds of asexual to sexual females double every generation and are 2^n times the initial odds after n generations.'
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
    dct:source ${lit(`${f.paper.title} (${f.paper.year})`)} ;
${f.paper.doi ? `    prov:wasDerivedFrom <https://doi.org/${f.paper.doi}> ;\n` : ''}    skos:notation ${lit(f.notation)} ;
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
console.log(`${manifest.length} unsigned drafts in lean/nanopubs/unsigned (${manifest.filter(m => m.kind === 'law').length} law, ${manifest.filter(m => m.kind === 'proof-scope').length} proof-scope, 1 rubric, ${manifest.filter(m => m.kind === 'assessment').length} assessment); commitPinned=${!!commit}; claimsWithTwoProviders=${claimsWithTwoProviders}`);
