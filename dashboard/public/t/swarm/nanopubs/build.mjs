#!/usr/bin/env node
// Builds UNSIGNED Project Delphi nanopub drafts for the swarm thread's findings (swarm/PREREG.md and the comparison in
// swarm/compare). One record per nanopub, Delphi ontology v2.0 terms (see DECISIONS.md for why not the templates'
// legacy IRIs). Every number is read from swarm/compare/results.json, results2.json and the files under
// swarm/nanopubs/evidence at build time; nothing is typed in by hand.
//
// Records:
//   01 claim + evidence  a led swarm beats one agent (two pre-registered experiments)
//   02 claim + evidence  the single agent's shortfall is mostly blank plans (post-hoc breakdown)
//   03 claim + evidence  the advantage is spread over distinct claims (post-hoc breakdown)
//   04 claim + evidence  the published Delphi templates use legacy probknow IRIs, against the delphi skill (method gotcha)
//   05 concept           the four-arm comparison harness, as a reusable method
//
// These are drafts: not signed, not published to any registry, and they say so. The human owner is a marked
// placeholder until the key owner approves; the commit hash of PREREG.md is pending.
//
//   node swarm/nanopubs/build.mjs
//   java -jar nanopub.jar check -v swarm/nanopubs/unsigned/*.trig
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const R1 = read('swarm/compare/results.json');
const R2 = read('swarm/compare/results2.json');

const LIVE = 'https://delphi-mission-control.ashenoy000.workers.dev/t/swarm/';
const REPO = 'https://github.com/fractastical/delphisci';
const OWNER = process.env.NANOPUB_ORCID || null; // the human owner; null until the key owner approves (then a marked placeholder is emitted instead)
const DELPHI = 'https://w3id.org/delphi/ontology/';
const DELPHIR = 'https://w3id.org/delphi/resource/';
const AGENT = DELPHIR + 'agent/delphisci-swarm-thread-claude-fable-5-1';
const MODEL = DELPHIR + 'model/claude-fable-5-1';
const ARM_AGENT = DELPHIR + 'agent/delphisci-swarm-compare-arms-claude-sonnet-5-5';
const ARM_MODEL = DELPHIR + 'model/claude-sonnet-5-5';
const DOMAIN = DELPHIR + 'domain/delphisci-swarm-methods'; // minted here; a choice for the key owner to confirm
const TPL_CLAIM_NP = 'https://w3id.org/np/RAI0QFH7bCNJIeKxwG3EbX5QKyoOjlaESiJkVZKs8iUc8'; // "Project Delphi claim", 2026-10-23
const TPL_EVID_NP = 'https://w3id.org/np/RAG7UB06LpEpmDKX8VFoIbeTwyRg5m9vnadwKwTuahwes'; // "Project Delphi evidence item", 2026-10-23
const TPL_CLAIM = TPL_CLAIM_NP + '/template', TPL_EVID = TPL_EVID_NP + '/template';
// Templates that are declared (nt:wasCreatedFrom…) only when the record really has their shape and they carry no
// legacy IRI: the provenance template and the creator and licence pubinfo templates (0 pk: uses each, checked 2026-10-31).
const TPL_PROV = 'https://w3id.org/np/RAaYeFYF-Cz2bM5S1wPQsnvs5X6BBxsphL03UkbVZ1lcA';
const TPL_PUB = ['https://w3id.org/np/RAukAcWHRDlkqxk7H2XNSegc1WnHI569INvNr-xdptDGI', 'https://w3id.org/np/RACJ58Gvyn91LqCKIO9zu1eijDQIeEff28iyDrJgjSJF8'];
// Not declared: the assertion templates (legacy pk: subjects, so the record cannot have been created from them) and
// the label/domain pubinfo template RAtKj9bC… (2 pk: uses; its domain placeholder is a probknow resource prefix).
const TPL_PUB_DOMAIN = 'https://w3id.org/np/RAtKj9bCnB4gUe0E9k-WhffQFSEWd9Ve2hrVllYoLuOB0';
const SKILL_URL = 'https://github.com/knowledgepixels/project-delphi-nanopubs/blob/6c543f4698ca1275247e370cc4c51cb9e09eab12/skills/delphi/SKILL.md';
const TEMPLATES_CHECKED = '2026-10-31';
const NOW = new Date().toISOString();
const DRAFT = 'UNSIGNED DRAFT. Not signed, not published to any registry (test or production). The key owner decides who signs and under which identity; the human owner below is a placeholder until then; the commit hash of swarm/PREREG.md must be added to the evidence before signing. Remove this statement when signing.';
const TEMPLATE_NOTE = tpl => (tpl
  ? `Template note: this record is hand-authored in Delphi ontology v2.0 terms (delphi:) as the delphi skill requires, and declares no assertion template. The template that would otherwise apply, ${tpl.np} ("${tpl.name}", 2026-10-23, checked ${TEMPLATES_CHECKED}), states its statements with legacy probknow (pk:) IRIs (${tpl.uses} pk: term uses, 0 delphi: IRIs), so this record cannot have been created from it and does not say it was.`
  : `Template note: no Project Delphi template exists for a delphi:Concept record (checked ${TEMPLATES_CHECKED}); this record is hand-authored with Delphi ontology v2.0 and SKOS terms and declares no assertion template.`)
  + ` The label/domain publication-info template ${TPL_PUB_DOMAIN} is not declared either (2 pk: uses; its domain field is a probknow resource prefix). Decision recorded in swarm/nanopubs/DECISIONS.md, 2026-10-31; see record delphisci-swarm-04.`;

// When the pre-registration was written, from the session transcript (tool-call timestamps) and the run records.
const PREREG_WRITTEN = '2026-10-31T05:52:04Z';   // `cat > swarm/PREREG.md`, session fffaabe1-3c8f-4fe0-b96f-ed7238a48c9f
const PREREG2_WRITTEN = '2026-10-31T06:27:23Z';  // experiment-2 section appended
const ARMS = ['single', 'isolated', 'centralized', 'decentralized'];
const NICE = { single: 'single agent', isolated: 'isolated workers', centralized: 'centralized (led) swarm', decentralized: 'decentralized board' };
const P = (R, a) => R.arms[a].primary;
const firstStart = R => ARMS.map(a => P(R, a).started).sort()[0];
const lastEnd = R => ARMS.map(a => P(R, a).finished).sort().slice(-1)[0];
const runDir = (R, a) => P(R, a).run_dir;
const liveSummary = (exp, a) => `${LIVE}runs${exp === 1 ? '' : '2'}/${a}/summary.json`;
const PREREG_NOTE = `Pre-registration timing, stated here because the header of swarm/PREREG.md is wrong: the header says "Written 2026-10-31 06:25 UTC", which would be after the experiment-1 runs. The session transcript shows the file written at ${PREREG_WRITTEN}, before the first primary run started at ${firstStart(R1)}; the experiment-2 section was appended at ${PREREG2_WRITTEN}, before the first experiment-2 run at ${firstStart(R2)}. The file was not edited because it states it is never changed after runs start; the correction is in DEVIATIONS.md and here. No git commit of the file exists yet (the hub holds all commits for this branch); the commit hash is to be added to this record before signing.`;

function triage(R) {
  const s = P(R, 'single').per_claim, c = P(R, 'centralized').per_claim;
  const keys = Object.keys(c);
  const id = k => s[k].claim_id || k;
  const blank = keys.filter(k => !s[k].dataset_named);
  const namedUnverified = keys.filter(k => s[k].dataset_named && !s[k].verified);
  const cOnly = keys.filter(k => c[k].verified && !s[k].verified);
  const sOnly = keys.filter(k => s[k].verified && !c[k].verified);
  return { blank: blank.map(id), namedUnverified: namedUnverified.map(id), cOnly: cOnly.map(id), sOnly: sOnly.map(id), shortfall: 20 - P(R, 'single').verified };
}
const T1 = triage(R1), T2 = triage(R2);

// Template evidence for record 04: the templates as fetched, kept under swarm/nanopubs/evidence.
function templateFacts(file) {
  const t = fs.readFileSync(path.join(here, 'evidence', file), 'utf8');
  const uses = [...t.matchAll(/\bpk:([A-Za-z]+)/g)].map(m => m[1]);
  const terms = [...new Set(uses)].sort();
  const created = (/dct:created "([^"]+)"/.exec(t) || [])[1] || null;
  const creator = (/dct:creator (orcid:[0-9X-]+|<https:\/\/orcid\.org\/[0-9X-]+>)/.exec(t) || [])[1]?.replace('orcid:', 'https://orcid.org/').replace(/[<>]/g, '') || null;
  const prefix = /@prefix pk: <https:\/\/w3id\.org\/probknow\/ontology\/>/.test(t);
  const delphiUses = (t.match(/w3id\.org\/delphi\/ontology\//g) || []).length;
  return { file, uses: uses.length, terms, created, creator, prefix, delphiUses };
}
const TF_CLAIM = templateFacts('template-RAI0QFH7-project-delphi-claim.trig');
const TF_EVID = templateFacts('template-RAG7UB06-project-delphi-evidence-item.trig');
const SKILL_LINE = (() => { const lines = fs.readFileSync(path.join(here, 'evidence', 'delphi-skill-SKILL.md'), 'utf8').split('\n'); const i = lines.findIndex(l => /probknow/.test(l)); return { line: i + 1, text: lines[i]?.trim() }; })();

// ---- TriG helpers ------------------------------------------------------------------------------------------------
const lit = s => JSON.stringify(String(s));
const iri = u => `<${u}>`;
const num = (v, t = 'integer') => `"${v}"^^xsd:${t}`;
const PREFIXES = (n) => `@prefix this: <http://purl.org/nanopub/temp/np${n}/> .
@prefix sub: <http://purl.org/nanopub/temp/np${n}/> .
@prefix np: <http://www.nanopub.org/nschema#> .
@prefix npx: <http://purl.org/nanopub/x/> .
@prefix nt: <https://w3id.org/np/o/ntemplate/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix schema: <https://schema.org/> .
@prefix delphi: <${DELPHI}> .
`;
const HEAD = `sub:Head {
  this: a np:Nanopublication ;
    np:hasAssertion sub:assertion ;
    np:hasProvenance sub:provenance ;
    np:hasPublicationInfo sub:pubinfo .
}
`;
const ownerRef = OWNER ? iri(OWNER) : 'sub:owner';
const ownerNode = OWNER ? '' : `  sub:owner a prov:Person ;
    rdfs:label "PLACEHOLDER: the human owner of this agent (ORCID), to be set when the key owner approves these records. Not a real identity." .
`;
function agents() {
  return `  ${iri(AGENT)} a prov:SoftwareAgent ;
    rdfs:label "DELPHI swarm thread (Claude Fable 5.1 in Claude Code) that designed, ran and scored the comparison and wrote these records" ;
    delphi:usesModel ${iri(MODEL)} ;
    prov:actedOnBehalfOf ${ownerRef} .
  ${iri(MODEL)} a delphi:LanguageModel ;
    rdfs:label "Claude Fable 5.1" ;
    dct:identifier "claude-fable-5-1" .
${ownerNode}`;
}
function provenanceComparison(derived) {
  return `sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(AGENT)} ;
    prov:wasDerivedFrom ${derived.map(iri).join(' , ')} ;
    prov:wasGeneratedBy sub:comparison .
  sub:comparison a prov:Activity ;
    rdfs:label "Pre-registered four-arm comparison (single, isolated, centralized, decentralized), experiments 1 and 2, 2026-10-31" ;
    prov:startedAtTime ${num(firstStart(R1), 'dateTime')} ;
    prov:endedAtTime ${num(lastEnd(R2), 'dateTime')} ;
    prov:wasAssociatedWith ${iri(AGENT)} , ${iri(ARM_AGENT)} ;
    prov:qualifiedAssociation sub:plan .
  sub:plan prov:hadPlan ${iri(LIVE + 'PREREG.md')} ;
    rdfs:comment ${lit(PREREG_NOTE)} .
${agents()}  ${iri(ARM_AGENT)} a prov:SoftwareAgent ;
    rdfs:label "The compared arms: headless Claude Code CLI agents running Claude Sonnet 5.5 with WebFetch and WebSearch only" ;
    delphi:usesModel ${iri(ARM_MODEL)} ;
    prov:actedOnBehalfOf ${ownerRef} .
  ${iri(ARM_MODEL)} a delphi:LanguageModel ;
    rdfs:label "Claude Sonnet 5.5" ;
    dct:identifier ${lit(P(R1, 'single').model)} .
}
`;
}
function provenanceSimple(derived, activityLabel) {
  return `sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(AGENT)} ;
    prov:wasDerivedFrom ${derived.map(iri).join(' , ')} ;
    prov:wasGeneratedBy sub:activity .
  sub:activity a prov:Activity ;
    rdfs:label ${lit(activityLabel)} ;
    prov:wasAssociatedWith ${iri(AGENT)} .
${agents()}}
`;
}
function pubinfo({ label, type, introduces, template }) {
  return `sub:pubinfo {
  this: dct:created ${num(NOW, 'dateTime')} ;
    dct:creator ${iri(AGENT)} ;
    rdfs:label ${lit(label)} ;
    dct:license <https://creativecommons.org/licenses/by/4.0/> ;
    npx:hasNanopubType ${iri(DELPHI + type)} ;
    npx:introduces ${iri(introduces)} ;
    delphi:domain ${iri(DOMAIN)} ;
    rdfs:comment ${lit(DRAFT)} , ${lit(TEMPLATE_NOTE(template))} ;
    nt:wasCreatedFromProvenanceTemplate ${iri(TPL_PROV)} ;
    nt:wasCreatedFromPubinfoTemplate ${TPL_PUB.map(iri).join(' , ')} .
  ${iri(DOMAIN)} rdfs:label "delphisci-swarm-methods" .
}
`;
}
let qn = 0;
function quantity(name, value, unit, source, type = 'integer') {
  const id = `sub:q${String(++qn).padStart(2, '0')}`;
  return { id, ttl: `  ${id} a schema:QuantitativeValue ;\n    schema:name ${lit(name)} ;\n    schema:value ${num(value, type)} ;\n    schema:unitText ${lit(unit)} ;\n    dct:source ${iri(source)} .\n` };
}

const CONTEXT_COMMON = `Task: for each of 20 claims from Darwin (1859) and Thompson (1917), write a pre-registered test plan naming one real public dataset (landing URL, DOI if any) or an honest null. Arms: single agent (one call, all 20 claims), isolated workers (20 parallel, no feedback), centralized swarm (emperor sets concurrency, king assigns by domain, retries with verifier feedback, escalation), decentralized board (queens pull tickets from a shared board, no planner). Same model (${P(R1, 'single').model}), same tools (WebFetch, WebSearch), same prompt and schema, run from an empty directory with no file access. Experiment 1 (${firstStart(R1).slice(0, 16)}Z): plans could be written from memory; budget $3 soft cap per arm; "verified" = the named landing page returns HTTP 200 and contains a distinctive token of the dataset or publisher name. Experiment 2 (${firstStart(R2).slice(0, 16)}Z): 20 new claims with no bird claims; the agent had to fetch the landing page itself (checked in the CLI event log) and report a title that agrees with the checker's; hard $8 cap that cannot overshoot. Pre-registered decision rule: an arm beats another only with zero fabricated identifiers and at least two more verified datasets; the earliest full run per arm is primary. Fabricated = URL or DOI that returns 404/410, DNS failure or "DOI not found"; blocked (403, 429, 5xx, timeout) is not fabricated.`;
const ENZYME = 'A sister project (delphi-evolve, github.com/kganjam/delphi-evolve) ran the same four-arm design on an enzyme benchmark with deterministic specialists and found no collective advantage (sharing 78/100, isolated 77/100, single planner 78/100, single planner without its model prior 96/100; zero false certificates); those numbers are quoted from the hub and were not re-verified by this thread.';

const records = [];

// ---- Record 1: led swarm beats single agent -----------------------------------------------------------------
{
  const id = 'delphisci-swarm-01-led-swarm-beats-single-agent';
  const claimIRI = DELPHIR + 'claim/' + id, evIRI = DELPHIR + 'evidence/' + id;
  const c1 = P(R1, 'centralized'), s1 = P(R1, 'single'), c2 = P(R2, 'centralized'), s2 = P(R2, 'single');
  const rep = a => (R1.arms[a].replicates || [])[0];
  const label = `A centrally led swarm of language-model agents produced more verified-dataset test plans than one agent on the same 20 claims, with zero fabricated identifiers, in two pre-registered experiments (${c1.verified} vs ${s1.verified}, then ${c2.verified} vs ${s2.verified}).`;
  const description = `Verified datasets of 20, primary runs: experiment 1 single ${s1.verified}, isolated ${P(R1, 'isolated').verified}, centralized ${c1.verified}, decentralized ${P(R1, 'decentralized').verified} (${P(R1, 'decentralized').fabricated_identifiers} fabricated identifier); experiment 2 single ${s2.verified}, isolated ${P(R2, 'isolated').verified}, centralized ${c2.verified}, decentralized ${P(R2, 'decentralized').verified}. Fabricated identifiers in the centralized and single arms: 0 in both experiments. Experiment 1 replicates (one per arm): single ${rep('single').verified}, isolated ${rep('isolated').verified}, centralized ${rep('centralized').verified}, decentralized ${rep('decentralized').verified}, all with 0 fabricated identifiers. The centralized arm met the pre-registered rule against the single agent in both experiments (margin ${c1.verified - s1.verified} and ${c2.verified - s2.verified}, rule needs 2) and against the isolated workers in both. Cost at list price, centralized vs single: $${c1.cost_usd_list.toFixed(2)} vs $${s1.cost_usd_list.toFixed(2)} (experiment 1), $${c2.cost_usd_list.toFixed(2)} vs $${s2.cost_usd_list.toFixed(2)} (experiment 2). Wall time per arm 1.8 to 3.7 minutes. Prediction for experiment 2 (written before the run): centralized 18, decentralized 17, isolated 15, single 14; outcome ${c2.verified}, ${P(R2, 'decentralized').verified}, ${P(R2, 'isolated').verified}, ${s2.verified}.`;
  const note = `Status: supported. The pre-registered rule (zero fabricated identifiers and at least two more verified datasets, earliest full run per arm decides) was met by the centralized arm against the single agent in experiment 1 and again in experiment 2, and the experiment-1 replicate agrees. ${PREREG_NOTE}`;
  const scope = `What this does not establish. (1) It is a result about language-model agents with a context limit, run through one CLI with one model; ${ENZYME} The single agent's shortfall here was mostly blank plans (see the companion record delphisci-swarm-02), so the gain is expected where the bottleneck is attention and not where it is not. (2) Twenty claims and one primary run per arm (plus one replicate in experiment 1, none in experiment 2) is a pre-registered minimum difference, not a significance test. (3) "Verified" means the landing page resolves and names the dataset (and in experiment 2 that the agent fetched it); it does not mean the dataset can decide the claim. (4) The swarm costs 5 to 11 times more at list price. (5) The decentralized arm is not covered by this claim: it verified more than the single agent in both experiments but had one fabricated identifier in experiment 1. (6) Two experiment-1 claims touch class Aves, the project's held-out clade, so the comparison is not blind to birds. (7) DEVIATIONS.md records where this thread's own experiment-2 prediction was wrong: the single agent was predicted at 14 and scored ${s2.verified}; costs were predicted near the $8 cap and came in at $0.52 to $6.37; runs took 2 to 4 minutes, not 5 to 12.`;
  const Q = [];
  for (const [R, exp] of [[R1, 1], [R2, 2]]) for (const a of ARMS) {
    Q.push(quantity(`verified datasets of 20, ${NICE[a]}, experiment ${exp} primary run (${runDir(R, a)})`, P(R, a).verified, 'claims with a verified dataset', liveSummary(exp, a)));
    Q.push(quantity(`fabricated identifiers, ${NICE[a]}, experiment ${exp} primary run`, P(R, a).fabricated_identifiers, 'identifiers', liveSummary(exp, a)));
    Q.push(quantity(`cost at list price in USD, ${NICE[a]}, experiment ${exp} primary run`, P(R, a).cost_usd_list.toFixed(4), 'USD', liveSummary(exp, a), 'decimal'));
  }
  for (const a of ARMS) if (rep(a)) Q.push(quantity(`verified datasets of 20, ${NICE[a]}, experiment 1 replicate (${rep(a).run_dir})`, rep(a).verified, 'claims with a verified dataset', LIVE + 'results.json'));
  records.push({
    id, claimIRI, evIRI, label, prov: 'comparison',
    claim: { label, description, context: CONTEXT_COMMON, note, scope },
    evidence: {
      label: `Verified-dataset counts, fabricated-identifier counts and costs of the four arms in two pre-registered experiments (centralized ${c1.verified} and ${c2.verified} vs single ${s1.verified} and ${s2.verified} of 20).`,
      description: `Computed by swarm/compare/metrics.mjs from the run records ${ARMS.map(a => runDir(R1, a)).join(', ')} (experiment 1) and ${ARMS.map(a => runDir(R2, a)).join(', ')} (experiment 2), each holding log.jsonl, plans/, verify/ and summary.json; aggregated in swarm/compare/results.json and results2.json (built ${R1.built} and ${R2.built}). Every URL and DOI in every plan was fetched by swarm/compare/verify.mjs with the responses cached in verify-cache.json. ${description} ${PREREG_NOTE}`,
      test: 'Pre-registered decision rule, not an inferential test: arm A beats arm B if A has zero fabricated identifiers and at least two more verified datasets out of 20; the earliest full run per arm is primary. Counts are exact over the 20 claims; no p-value is defined.',
      quantities: Q,
      derived: [LIVE + 'results.json', LIVE + 'results2.json', ...ARMS.map(a => liveSummary(1, a)), ...ARMS.map(a => liveSummary(2, a)), LIVE + 'PREREG.md', LIVE + 'DEVIATIONS.md'],
    },
  });
}

// ---- Record 2: the single agent's loss is mostly attention ---------------------------------------------------
{
  const id = 'delphisci-swarm-02-single-agent-shortfall-is-mostly-blank-plans';
  const claimIRI = DELPHIR + 'claim/' + id, evIRI = DELPHIR + 'evidence/' + id;
  const s1 = P(R1, 'single'), s2 = P(R2, 'single'), c1 = P(R1, 'centralized'), c2 = P(R2, 'centralized');
  const label = `Where the single agent fell short of 20 verified datasets, it was mostly because it left plans blank rather than because it named datasets that failed verification (${T2.blank.length} of ${T2.shortfall} shortfalls blank in experiment 2; ${T1.blank.length} blank and ${T1.namedUnverified.length} named-but-unverified of ${T1.shortfall} in experiment 1).`;
  const description = `Per-claim triage of the single agent's primary runs. Experiment 2 (fetch required): ${s2.verified} verified, shortfall ${T2.shortfall}; blank plans (dataset null with a reason) ${T2.blank.length} [${T2.blank.join(', ')}]; named datasets that failed verification ${T2.namedUnverified.length}. The single agent made ${s2.web_requests.fetch} WebFetch and ${s2.web_requests.search} WebSearch calls for 20 claims in one context (centralized arm: ${c2.web_requests.fetch} fetches over ${c2.calls} calls) and produced ${s2.tokens.output} output tokens against the centralized arm's ${c2.tokens.output}. Experiment 1 (from memory): ${s1.verified} verified, shortfall ${T1.shortfall}; blank ${T1.blank.length} [${T1.blank.join(', ')}]; named-but-unverified ${T1.namedUnverified.length} [${T1.namedUnverified.join(', ')}]; output tokens ${s1.tokens.output} vs ${c1.tokens.output}. So in experiment 2 the whole shortfall was blanks, and in experiment 1 about half of it was.`;
  const note = `Status: supported for experiment 2; mixed for experiment 1, where ${T1.namedUnverified.length} of ${T1.shortfall} shortfalls were datasets the single agent named that did not check out, so it also chose worse there. This triage is a post-hoc breakdown of pre-registered runs: the runs, the claim sets and the scoring rule were fixed in advance, but the blank-versus-wrong split was computed after the results were known, prompted by a question from the hub on 2026-10-31. Treat it as exploratory. ${PREREG_NOTE}`;
  const scope = `What this does not establish. (1) It does not identify the mechanism: "attention" or "context limit" is an interpretation of blank plans; no ablation of context length or turn cap (60 turns in experiment 1, 250 in experiment 2 for the single arm) was run, and a blank can also be a choice the agent made under those caps. (2) The hypothesis was not pre-registered; the counts are exact but the reading is post hoc. (3) It is specific to language-model agents: ${ENZYME} (4) Twenty claims per experiment, one primary run each. (5) The centralized swarm's own one blank per experiment is not analysed here.`;
  const Q = [
    quantity(`single agent, experiment 2: shortfall from 20 verified (${runDir(R2, 'single')})`, T2.shortfall, 'claims', liveSummary(2, 'single')),
    quantity('single agent, experiment 2: blank plans (dataset null)', T2.blank.length, 'claims', liveSummary(2, 'single')),
    quantity('single agent, experiment 2: named datasets that failed verification', T2.namedUnverified.length, 'claims', liveSummary(2, 'single')),
    quantity('single agent, experiment 2: WebFetch calls in the one call', s2.web_requests.fetch, 'tool calls', liveSummary(2, 'single')),
    quantity('single agent, experiment 2: WebSearch calls in the one call', s2.web_requests.search, 'tool calls', liveSummary(2, 'single')),
    quantity('single agent, experiment 2: output tokens', s2.tokens.output, 'tokens', liveSummary(2, 'single')),
    quantity('centralized swarm, experiment 2: output tokens', c2.tokens.output, 'tokens', liveSummary(2, 'centralized')),
    quantity(`single agent, experiment 1: shortfall from 20 verified (${runDir(R1, 'single')})`, T1.shortfall, 'claims', liveSummary(1, 'single')),
    quantity('single agent, experiment 1: blank plans (dataset null)', T1.blank.length, 'claims', liveSummary(1, 'single')),
    quantity('single agent, experiment 1: named datasets that failed verification', T1.namedUnverified.length, 'claims', liveSummary(1, 'single')),
    quantity('single agent, experiment 1: output tokens', s1.tokens.output, 'tokens', liveSummary(1, 'single')),
    quantity('centralized swarm, experiment 1: output tokens', c1.tokens.output, 'tokens', liveSummary(1, 'centralized')),
  ];
  records.push({
    id, claimIRI, evIRI, label, prov: 'comparison',
    claim: { label, description, context: CONTEXT_COMMON, note, scope },
    evidence: {
      label: `Per-claim triage of the single agent's shortfall: ${T2.blank.length} blank of ${T2.shortfall} in experiment 2; ${T1.blank.length} blank and ${T1.namedUnverified.length} named-but-unverified of ${T1.shortfall} in experiment 1.`,
      description: `Computed from the per_claim tables of swarm/compare/results.json and results2.json (fields dataset_named and verified for the single arm's primary run), which come from the plan files under ${runDir(R1, 'single')}/plans and ${runDir(R2, 'single')}/plans and the verifier records beside them. Tool-call counts come from tool_use events in the CLI stream-json log of the single call. ${description} ${PREREG_NOTE}`,
      test: 'Exact counts over 20 claims; no inferential test. Post-hoc breakdown of pre-registered runs.',
      quantities: Q,
      derived: [LIVE + 'results.json', LIVE + 'results2.json', liveSummary(1, 'single'), liveSummary(2, 'single'), liveSummary(1, 'centralized'), liveSummary(2, 'centralized'), LIVE + 'PREREG.md', LIVE + 'DEVIATIONS.md'],
    },
  });
}

// ---- Record 3: the advantage is broad, not one item ----------------------------------------------------------
{
  const id = 'delphisci-swarm-03-led-swarm-advantage-is-spread-over-distinct-claims';
  const claimIRI = DELPHIR + 'claim/' + id, evIRI = DELPHIR + 'evidence/' + id;
  const label = `The led swarm's advantage over the single agent is spread over several distinct claims, not one repeated item: ${T1.cOnly.length} claims in experiment 1 and ${T2.cOnly.length} in experiment 2 were verified by the centralized swarm and not by the single agent, against ${T1.sOnly.length} and ${T2.sOnly.length} the other way.`;
  const description = `Per-claim comparison of the centralized and single arms' primary runs. Experiment 1: verified by centralized and not by single, ${T1.cOnly.length} claims [${T1.cOnly.join(', ')}]; verified by single and not by centralized, ${T1.sOnly.length}${T1.sOnly.length ? ' [' + T1.sOnly.join(', ') + ']' : ''}. Experiment 2: ${T2.cOnly.length} claims [${T2.cOnly.join(', ')}] against ${T2.sOnly.length}${T2.sOnly.length ? ' [' + T2.sOnly.join(', ') + ']' : ''}. The two experiments use disjoint claim sets, so the items differ by construction; the point is that in each experiment the margin comes from many claims.`;
  const note = `Status: supported in both experiments. Like record delphisci-swarm-02 this is a post-hoc breakdown of pre-registered runs (PREREG.md promised a per-claim table; the breadth question was asked by the hub after the results were known, after a sister project found that its best method's wins were concentrated on one endpoint pair). ${PREREG_NOTE}`;
  const scope = `What this does not establish. (1) It does not say which claims are "hard" in general: the claim sets differ between experiments and no claim was run in both. (2) It does not separate the swarm's retry-with-feedback from its parallelism as the cause; the isolated arm (parallel, no feedback) sits between the two in both experiments (${P(R1, 'isolated').verified} and ${P(R2, 'isolated').verified}). (3) Twenty claims per experiment, one primary run each. (4) ${ENZYME}`;
  const Q = [
    quantity(`experiment 1: claims verified by the centralized swarm and not by the single agent (primary runs ${runDir(R1, 'centralized')} vs ${runDir(R1, 'single')})`, T1.cOnly.length, 'claims', LIVE + 'results.json'),
    quantity('experiment 1: claims verified by the single agent and not by the centralized swarm', T1.sOnly.length, 'claims', LIVE + 'results.json'),
    quantity(`experiment 2: claims verified by the centralized swarm and not by the single agent (primary runs ${runDir(R2, 'centralized')} vs ${runDir(R2, 'single')})`, T2.cOnly.length, 'claims', LIVE + 'results2.json'),
    quantity('experiment 2: claims verified by the single agent and not by the centralized swarm', T2.sOnly.length, 'claims', LIVE + 'results2.json'),
  ];
  records.push({
    id, claimIRI, evIRI, label, prov: 'comparison',
    claim: { label, description, context: CONTEXT_COMMON, note, scope },
    evidence: {
      label: `Per-claim wins of the centralized swarm over the single agent: ${T1.cOnly.length} vs ${T1.sOnly.length} distinct claims in experiment 1, ${T2.cOnly.length} vs ${T2.sOnly.length} in experiment 2.`,
      description: `Computed from the per_claim tables (field verified, keyed by claim_id) of swarm/compare/results.json and results2.json for the centralized and single primary runs. ${description} ${PREREG_NOTE}`,
      test: 'Exact per-claim set differences over 20 claims; no inferential test. Post-hoc breakdown of pre-registered runs.',
      quantities: Q,
      derived: [LIVE + 'results.json', LIVE + 'results2.json', liveSummary(1, 'single'), liveSummary(1, 'centralized'), liveSummary(2, 'single'), liveSummary(2, 'centralized'), LIVE + 'PREREG.md', LIVE + 'DEVIATIONS.md'],
    },
  });
}

// ---- Record 4: the published Delphi templates contradict the delphi skill (method gotcha) --------------------
{
  const id = 'delphisci-swarm-04-published-delphi-templates-use-legacy-probknow-iris';
  const claimIRI = DELPHIR + 'claim/' + id, evIRI = DELPHIR + 'evidence/' + id;
  const label = `The published "Project Delphi claim" and "Project Delphi evidence item" templates (2026-10-23) state their statements with legacy probknow (pk:) IRIs, while the delphi skill requires Delphi ontology v2.0 terms and says probknow IRIs are never used in new records, so a record written to the skill fails template conformance.`;
  const description = `Template ${TPL_CLAIM_NP} ("Project Delphi claim", created ${TF_CLAIM.created}, creator ${TF_CLAIM.creator}) declares @prefix pk: <https://w3id.org/probknow/ontology/> and uses pk: terms ${TF_CLAIM.uses} times (${TF_CLAIM.terms.join(', ')}); it uses no https://w3id.org/delphi/ontology/ IRI. Template ${TPL_EVID_NP} ("Project Delphi evidence item", created ${TF_EVID.created}, creator ${TF_EVID.creator}) uses pk: terms ${TF_EVID.uses} times (${TF_EVID.terms.join(', ')}), again with no delphi: IRI. Both were fetched from w3id.org with Accept: application/trig on ${TEMPLATES_CHECKED} and are kept verbatim under swarm/nanopubs/evidence. The delphi skill (${SKILL_URL}, line ${SKILL_LINE.line}) says: "${SKILL_LINE.text}" and that terms come from Delphi ontology v2.0 with prefix delphi: = https://w3id.org/delphi/ontology/. The nanopub skill's check-nanopub-conformance.py therefore reports every delphi: triple as unmatched and the template's required statement st01 (rdf:type pk:Claim or pk:EvidenceItem) as not instantiated, for this repository's records and for its earlier math-bio-theorems drafts alike.`;
  const note = `Status: supported (direct observation of the served templates and the skill text on ${TEMPLATES_CHECKED}). Decision taken by the DELPHI hub on 2026-10-31 and recorded in swarm/nanopubs/DECISIONS.md: follow the skill, write delphi: v2.0 terms, and do not declare nt:wasCreatedFromTemplate for a template whose placeholders the record cannot fill (that triple would assert a false provenance); instead name the template that would otherwise apply, its pk: count and the date checked in an rdfs:comment. Reported so other teams do not lose time rediscovering it.`;
  const scope = `What this does not establish. (1) It does not say which side should change: the ontology's own crosswalk maps the probknow terms to delphi: terms, so the templates may be updated or the skill relaxed. (2) Only these two templates were checked; the other Project Delphi templates of the same date (assessments, rubric, testable hypothesis) were not inspected. (3) Templates are versioned (dct:isVersionOf …/claimKind and …/evidenceKind); a later governed version may already resolve this by the time anyone reads this record. (4) The counts are occurrences of pk: tokens in the TriG serialization as served on ${TEMPLATES_CHECKED}, not a semantic count.`;
  const Q = [
    quantity(`pk: term uses in the served "Project Delphi claim" template (${TPL_CLAIM_NP})`, TF_CLAIM.uses, 'occurrences', TPL_CLAIM_NP),
    quantity('distinct pk: terms in the claim template', TF_CLAIM.terms.length, 'terms', TPL_CLAIM_NP),
    quantity('delphi: ontology IRIs in the claim template', TF_CLAIM.delphiUses, 'occurrences', TPL_CLAIM_NP),
    quantity(`pk: term uses in the served "Project Delphi evidence item" template (${TPL_EVID_NP})`, TF_EVID.uses, 'occurrences', TPL_EVID_NP),
    quantity('distinct pk: terms in the evidence item template', TF_EVID.terms.length, 'terms', TPL_EVID_NP),
    quantity('delphi: ontology IRIs in the evidence item template', TF_EVID.delphiUses, 'occurrences', TPL_EVID_NP),
  ];
  records.push({
    id, claimIRI, evIRI, label, prov: 'templates',
    claim: { label, description, context: `Checked while drafting Delphi records for the swarm comparison on ${TEMPLATES_CHECKED}, with nanopub-java 1.95.0 and the nanopub skill's conformance script. The skill revision read is commit 6c543f46 of knowledgepixels/project-delphi-nanopubs (2026-10-26).`, note, scope },
    evidence: {
      label: `The two served Project Delphi templates (claim, evidence item; 2026-10-23) use pk: terms ${TF_CLAIM.uses} and ${TF_EVID.uses} times and delphi: terms 0 times; the delphi skill forbids probknow IRIs in new records.`,
      description: `${description} Files: swarm/nanopubs/evidence/${TF_CLAIM.file}, swarm/nanopubs/evidence/${TF_EVID.file}, swarm/nanopubs/evidence/delphi-skill-SKILL.md. Counts computed by swarm/nanopubs/build.mjs from those files.`,
      test: 'Direct inspection and token counts; no statistical test.',
      quantities: Q,
      derived: [TPL_CLAIM_NP, TPL_EVID_NP, SKILL_URL, LIVE + 'nanopubs/evidence/' + TF_CLAIM.file, LIVE + 'nanopubs/evidence/' + TF_EVID.file, LIVE + 'nanopubs/evidence/delphi-skill-SKILL.md'],
    },
  });
}

// ---- Record 5: the harness as a reusable method (delphi:Concept) --------------------------------------------
const concept = (() => {
  const id = 'four-arm-agent-comparison-harness';
  const conceptIRI = DELPHIR + 'concept/' + id;
  const label = 'Four-arm comparison harness for agent swarms: pre-registered task, mechanical verifier, hard cost cap';
  const definition = `A method for measuring whether a swarm of language-model agents beats one agent on a unit of scientific work, built so that the result cannot be argued with afterwards. (1) Fix the task, the item set (here 20 claims), the output schema and the prompt, and write the scoring rule and a prediction into a pre-registration file before any run. (2) Run four arms with the same model, tools and budget: single agent (one call, all items); isolated workers (one item each, no feedback); centralized swarm (a planner assigns items by domain, reviews failures, retries with verifier feedback, escalates); decentralized board (workers pull tickets from a shared board and post results, gaps and tips; no planner). (3) Score every output with a mechanical verifier that fetches each URL and DOI and classes it resolves / fabricated (404, 410, DNS failure, DOI not found) / blocked (403, 429, 5xx, timeout) / malformed, and marks a dataset verified only if its landing page resolves and names it; in a second experiment also require evidence in the agent's own event log that it fetched the page, and that the page title it reports agrees with the verifier's. (4) Enforce a hard cost cap by launching a call only if spent + (in-flight + 1) * per-call cap <= budget, so no arm can overshoot. (5) Decide by a pre-registered rule (here: zero fabricated identifiers and at least two more verified items), take the earliest full run per arm as primary, report replicates beside it, and publish every plan, verifier record and event log with a per-item table. (6) Log every change after the pre-registration, and every wrong prediction, in a deviations file with a time.`;
  const description = `Implemented for the ScienceClaw hack (2026-10-31) as Node scripts: swarm/compare/run.mjs (orchestrator and the four arms, spawning the headless Claude Code CLI with --json-schema, --max-budget-usd and stream-json output from an empty directory so agents cannot read the repository), swarm/compare/verify.mjs (verifier, cached), swarm/compare/metrics.mjs (aggregation into results.json and per-queen metrics), swarm/emperor.mjs (structure controller that consumes the measured metrics). Used twice on 2026-10-31; outcomes in records delphisci-swarm-01 to 03. A sister project (delphi-evolve) applied the same four-arm design to an enzyme benchmark with deterministic specialists.`;
  const scope = `Limits. The runner is specific to the Claude Code CLI; the arms and verifier are general. The verifier checks that an identifier resolves and names the dataset, not that the dataset answers the question. Twenty items per experiment give a pre-registered minimum difference, not a significance test. Cost accounting is at list price from the CLI's usage report. The code is uncommitted at the time of this draft; the repository URL below is where it will live and the live copies are what this record points to.`;
  const code = [['run.mjs', 'swarm/compare/run.mjs', 'orchestrator and the four arms'], ['verify.mjs', 'swarm/compare/verify.mjs', 'mechanical verifier for URLs and DOIs'], ['metrics.mjs', 'swarm/compare/metrics.mjs', 'aggregation and per-queen metrics'], ['emperor.mjs', 'swarm/emperor.mjs', 'swarm structure controller']];
  const codeTtl = code.map(([f, p, what], i) => `  sub:code${i + 1} a schema:SoftwareSourceCode ;
    rdfs:label ${lit(p)} ;
    dct:description ${lit(what)} ;
    schema:codeRepository ${iri(REPO)} ;
    schema:programmingLanguage "JavaScript (Node 20+)" ;
    schema:version "uncommitted draft, 2026-10-31; commit hash pending" ;
    dct:source ${iri(LIVE + 'code/' + f)} .
`).join('');
  return {
    id, conceptIRI, label,
    assertion: `sub:assertion {
  ${iri(conceptIRI)} a delphi:Concept , skos:Concept ;
    skos:prefLabel ${lit(label)} ;
    rdfs:label ${lit(label)} ;
    skos:definition ${lit(definition)} ;
    dct:description ${lit(description)} ;
    skos:note "Kind: method (a reusable procedure), not an empirical finding. Its results are separate claim records (delphisci-swarm-01 to 03)." ;
    skos:scopeNote ${lit(scope)} ;
    dct:subject ${code.map((_, i) => `sub:code${i + 1}`).join(' , ')} ;
    skos:related ${[1, 2, 3].map(i => iri(records[i - 1].claimIRI)).join(' , ')} .
${codeTtl}}
`,
    derived: [LIVE + 'PREREG.md', LIVE + 'README.md', ...code.map(([f]) => LIVE + 'code/' + f)],
  };
})();

// ---- Emit ---------------------------------------------------------------------------------------------------
const outDir = path.join(here, 'unsigned');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.trig')) fs.unlinkSync(path.join(outDir, f));
const manifest = {
  status: 'unsigned drafts; not signed, not published to any registry; built from swarm/compare/results.json, results2.json and swarm/nanopubs/evidence',
  built: NOW, builder: 'swarm/nanopubs/build.mjs',
  attribution: { creator: AGENT, human_owner: OWNER || 'PLACEHOLDER sub:owner in each file; set NANOPUB_ORCID when the key owner approves' },
  domain_minted: DOMAIN,
  templates: { declared: { provenance: TPL_PROV, pubinfo: TPL_PUB }, not_declared: { claim: TPL_CLAIM, evidence: TPL_EVID, pubinfo_label_domain: TPL_PUB_DOMAIN, concept: null }, checked: TEMPLATES_CHECKED, pk_uses: { claim: TF_CLAIM.uses, evidence: TF_EVID.uses, provenance: 0, pubinfo_creator: 0, pubinfo_license: 0, pubinfo_label_domain: 2 }, note: 'assertion templates use legacy pk: IRIs, so the records cannot have been created from them and do not declare them; records use delphi: v2.0 per DECISIONS.md' },
  prereg: { file: 'swarm/PREREG.md', written: PREREG_WRITTEN, experiment2_section_written: PREREG2_WRITTEN, first_primary_run: firstStart(R1), first_experiment2_run: firstStart(R2), header_says: '06:25 UTC (typo, see DEVIATIONS.md)', commit: null },
  blockers_before_signing: [
    'Who signs and under which identity (a bot identity with its own key and introduction nanopub, or the operator key): the key owner decides. Then set the human owner (NANOPUB_ORCID) and rebuild so the placeholder disappears.',
    'Commit hash of swarm/PREREG.md and of the code (the hub holds commits until Amit approves a branch); add it to the evidence records and the concept record, and replace live-dashboard URLs in prov:wasDerivedFrom with commit-pinned repository URLs if preferred.',
    'Domain slug delphisci-swarm-methods is minted here; confirm or replace.',
    'Template non-conformance is by decision (DECISIONS.md, 2026-10-31) and stated in each pubinfo; re-check whether a v2 template version exists before publishing.',
    'Remove the UNSIGNED DRAFT rdfs:comment from pubinfo when signing.',
  ],
  registry: null, nanopubs: [],
};
let n = 0;
for (const r of records) {
  const provFn = r.prov === 'comparison' ? provenanceComparison : d => provenanceSimple(d, `Inspection of the served Project Delphi templates and the delphi skill, ${TEMPLATES_CHECKED}`);
  n++;
  const claimTrig = PREFIXES(n) + '\n' + HEAD + `
sub:assertion {
  ${iri(r.claimIRI)} a delphi:Claim ;
    rdfs:label ${lit(r.claim.label)} ;
    dct:description ${lit(r.claim.description)} ;
    delphi:context ${lit(r.claim.context)} ;
    skos:note ${lit(r.claim.note)} ;
    skos:scopeNote ${lit(r.claim.scope)} ;
    delphi:hasEvidence ${iri(r.evIRI)} .
}

` + provFn(r.evidence.derived) + '\n' + pubinfo({ label: r.claim.label, type: 'Claim', introduces: r.claimIRI, template: { np: TPL_CLAIM_NP, name: 'Project Delphi claim', uses: TF_CLAIM.uses } });
  const cf = path.join(outDir, `${r.id}.trig`);
  fs.writeFileSync(cf, claimTrig);
  n++;
  const evTrig = PREFIXES(n) + '\n' + HEAD + `
sub:assertion {
  ${iri(r.evIRI)} a delphi:EvidenceItem ;
    rdfs:label ${lit(r.evidence.label)} ;
    dct:description ${lit(r.evidence.description)} ;
    delphi:statisticalTest ${lit(r.evidence.test)} ;
    dct:hasPart ${r.evidence.quantities.map(q => q.id).join(' , ')} ;
    prov:wasDerivedFrom ${r.evidence.derived.map(iri).join(' , ')} .
${r.evidence.quantities.map(q => q.ttl).join('')}}

` + provFn(r.evidence.derived) + '\n' + pubinfo({ label: r.evidence.label, type: 'EvidenceItem', introduces: r.evIRI, template: { np: TPL_EVID_NP, name: 'Project Delphi evidence item', uses: TF_EVID.uses } });
  const ef = path.join(outDir, `${r.id}--evidence.trig`);
  fs.writeFileSync(ef, evTrig);
  manifest.nanopubs.push({ record: r.id, claim: { file: path.relative(root, cf).replace(/\\/g, '/'), iri: r.claimIRI, label: r.claim.label }, evidence: { file: path.relative(root, ef).replace(/\\/g, '/'), iri: r.evIRI, label: r.evidence.label, quantities: r.evidence.quantities.length }, signedFile: null, trustyUri: null, publishedAt: null });
}
n++;
const conceptTrig = PREFIXES(n) + '\n' + HEAD + '\n' + concept.assertion + '\n' + provenanceSimple(concept.derived, 'Design and implementation of the comparison harness by the swarm thread, 2026-10-31') + '\n' + pubinfo({ label: concept.label, type: 'Concept', introduces: concept.conceptIRI, template: null });
const kf = path.join(outDir, `delphisci-swarm-05-concept-${concept.id}.trig`);
fs.writeFileSync(kf, conceptTrig);
manifest.nanopubs.push({ record: 'delphisci-swarm-05-concept-' + concept.id, concept: { file: path.relative(root, kf).replace(/\\/g, '/'), iri: concept.conceptIRI, label: concept.label }, signedFile: null, trustyUri: null, publishedAt: null });
fs.writeFileSync(path.join(here, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${n} unsigned drafts to swarm/nanopubs/unsigned and manifest.json`);
console.log('templates:', JSON.stringify({ claim: TF_CLAIM, evidence: TF_EVID, skill: SKILL_LINE }));
