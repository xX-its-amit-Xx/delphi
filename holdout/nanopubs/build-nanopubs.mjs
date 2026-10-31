#!/usr/bin/env node
// Builds the holdout thread's Project Delphi nanopublication records as UNSIGNED DRAFT TriG files.
// One record per nanopub (Delphi ontology v2.0, Knowledge Pixels templates where one exists).
// Every number in a record is read from a file under holdout/ or claim-tests/ at build time.
//
//   node holdout/nanopubs/build-nanopubs.mjs            # writes holdout/nanopubs/unsigned/*.trig + manifest.json
//   node holdout/nanopubs/build-nanopubs.mjs --final    # drops the "Draft:" marks (only for a signing run)
//
// Nothing here signs or publishes. Signing uses the operator's key and publishing needs the key
// owner's explicit approval (AGENTS.md, BEST_PRACTICES.md): test registry first, production never
// without that approval. See holdout/nanopubs/README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const FINAL = process.argv.includes('--final');
// Team decision (hub, 2026-10-31, claim-tests/nanopubs/DECISIONS.md): no human ORCID in drafts. The creator is the
// software agent until the key holder approves and signs; pass --creator <ORCID IRI> on that signing run.
const creatorArg = process.argv.indexOf('--creator');
const CREATOR_OVERRIDE = creatorArg >= 0 ? process.argv[creatorArg + 1] : null;
const rd = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

// ---- inputs (all files) --------------------------------------------------------------------------
const sums = rd('holdout/CHECKSUMS.json');
const split = rd('holdout/split.json');
const power = rd('holdout/power-analysis.json');
const notApplicable = rd('holdout/exam-results/not-applicable.json');
const burned = rd('holdout/burned.json');
const allowlist = rd('holdout/leak-allowlist.json');
const exams = {
  'kimura-heterozygosity': rd('holdout/exam-results/math-bio-theorems/kimura-heterozygosity/result.json'),
  'hamilton-senescence': rd('holdout/exam-results/math-bio-theorems/hamilton-senescence/result.json'),
};
const builders = {
  'kimura-heterozygosity': rd('claim-tests/math-bio-theorems/kimura-heterozygosity/result.json'),
  'hamilton-senescence': rd('claim-tests/math-bio-theorems/hamilton-senescence/result.json'),
};
const organism = rd('holdout/exam-results/organism-design/result.run2.json');
const claimsManifest = rd('math-bio-theorems/nanopubs/manifest.json');
const claimNp = id => claimsManifest.nanopubs.find(e => e.claim === `${R}claim/${id}`);
const completedTests = fs.readdirSync(path.join(root, 'claim-tests'), { withFileTypes: true }).filter(d => d.isDirectory()).flatMap(p =>
  fs.readdirSync(path.join(root, 'claim-tests', p.name), { withFileTypes: true }).filter(d => d.isDirectory() && fs.existsSync(path.join(root, 'claim-tests', p.name, d.name, 'result.json')))
    .map(d => ({ project: p.name, id: d.name, status: rd(`claim-tests/${p.name}/${d.name}/result.json`).status }))).filter(t => t.status === 'complete');

// Leak check, run now so the record describes a check that ran.
const leakRun = spawnSync(process.execPath, [path.join(root, 'holdout/check-leaks.mjs'), '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const leaks = JSON.parse(leakRun.stdout.trim().split(/\r?\n/).pop());
// Rulings (holdout/rulings.json) and a per-folder scan of the folders each ruling is about, so the record carries the numbers.
const rulings = rd('holdout/rulings.json');
const scanFolder = folder => JSON.parse(spawnSync(process.execPath, [path.join(root, 'holdout/check-leaks.mjs'), '--json', folder], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).stdout.trim().split(/\r?\n/).pop());
const allowlistKinds = { taxa: allowlist.filter(a => a.taxa).length, claims: allowlist.filter(a => a.claims).length, committed_before: allowlist.filter(a => a.committed_before).length, unscoped: allowlist.filter(a => !a.taxa && !a.claims && !a.committed_before).length };

// ---- vocabulary ---------------------------------------------------------------------------------
const R = 'https://w3id.org/delphi/resource/';
const ASSESSOR = `${R}agent/delphisci-holdout-assessor-claude-fable-5-1`;
const MODEL = `${R}model/claude-fable-5-1`;
const CREATOR = CREATOR_OVERRIDE || ASSESSOR; // no human ORCID until the key holder approves and signs
const DOMAIN_CLAIMS = `${R}domain/math-population-genetics-and-evolutionary-theory`; // the two examined claims' own domain
const DOMAIN_METHOD = `${R}domain/held-out-clade-exam`;
const LIVE = 'https://delphi-mission-control.ashenoy000.workers.dev/t/holdout/'; // the only resolvable copy of holdout/ today
const LIVE_DATA = `${LIVE}data.json`;
// Commit-pinned copy of holdout/ on the pushed branch (PR #36 against fractastical/delphi, head of delphi-hack-2026-10-31 on
// xX-its-amit-Xx/delphi, public). Pass --commit <sha> when a newer push lands; files changed after this commit (the confirmed
// re-freeze of CHECKSUMS.json, exam.json, split.json) are only in the live copy until then, and the manifest says so.
const commitArg = process.argv.indexOf('--commit');
const COMMIT = commitArg >= 0 ? process.argv[commitArg + 1] : 'da7e271b7015bb60d2d4759c21001895e09852b7'; // "holdout: confirm Aves as the held-out clade and re-freeze"
const TREE = `https://github.com/xX-its-amit-Xx/delphi/tree/${COMMIT}/holdout`;
// What that commit actually holds is checked against the local git object, not asserted: the manifest sentence about it
// went stale once before (it said "provisional freeze" after the confirmed one had been pushed).
const commitSums = (() => { try { return JSON.parse(execSync(`git -C "${root}" show ${COMMIT}:holdout/CHECKSUMS.json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return null; } })();
const sumsNow = JSON.parse(fs.readFileSync(path.join(root, 'holdout/CHECKSUMS.json'), 'utf8'));
const commitHolds = !commitSums ? `a freeze this build could not read (commit ${COMMIT.slice(0, 8)} is not in the local repository)`
  : commitSums.outputs['exam.json'].sha256 === sumsNow.outputs['exam.json'].sha256 ? `the current freeze (${commitSums.frozen_at}${commitSums.provisional ? ', provisional' : ', confirmed'}), the same exam.json SHA-256 as on disk`
  : `an earlier freeze (${commitSums.frozen_at}${commitSums.provisional ? ', provisional' : ''}; exam.json SHA-256 ${commitSums.outputs['exam.json'].sha256}), not the current one on disk`;
const TEMPLATE = { // published Project Delphi assertion templates (project-delphi-ontology pipeline, commit 6ba5f9a)
  evidence: 'https://w3id.org/np/RAk4kcX4zA_touv8CeKku9tTUnbR5xiTLSLwFbrKSl3BE/template',
  claim: 'https://w3id.org/np/RApE-nGpCMigXqZjeHuYuMJEVTGmTlNTlZl7IcHi_fhdQ/template',
  hypothesis: 'https://w3id.org/np/RAPZZB0fIwmSTnoiL9cBDSx9uRGI10J7gd9P42WmunbbA/template',
  provenanceAttributed: 'https://w3id.org/np/RA7lSq6MuK_TIC6JMSHvLtee3lpLoZDOqLJCLXevnrPoU', // "Attributed to myself/others": assertion prov:wasAttributedTo agent
  pubinfoCreator: 'https://w3id.org/np/RAukAcWHRDlkqxk7H2XNSegc1WnHI569INvNr-xdptDGI',
  pubinfoLicense: 'https://w3id.org/np/RACJ58Gvyn91LqCKIO9zu1eijDQIeEff28iyDrJgjSJF8',
  pubinfoDomain: 'https://w3id.org/np/RAtKj9bCnB4gUe0E9k-WhffQFSEWd9Ve2hrVllYoLuOB0',
};

const lit = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
const dbl = x => `"${Number(x)}"^^xsd:double`;
const int = x => `"${Math.trunc(Number(x))}"^^xsd:integer`;
const dt = s => `"${s}"^^xsd:dateTime`;
const iri = u => `<${u}>`;
const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const PREFIXES = `@prefix this: <http://purl.org/nanopub/temp/np1/> .
@prefix sub: <http://purl.org/nanopub/temp/np1/> .
@prefix np: <http://www.nanopub.org/nschema#> .
@prefix npx: <http://purl.org/nanopub/x/> .
@prefix nt: <https://w3id.org/np/o/ntemplate/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix spdx: <http://spdx.org/rdf/terms#> .
@prefix delphi: <https://w3id.org/delphi/ontology/> .
`;
const HEAD = `sub:Head {
  this: a np:Nanopublication ;
    np:hasAssertion sub:assertion ;
    np:hasProvenance sub:provenance ;
    np:hasPublicationInfo sub:pubinfo .
}
`;
const draftLabel = s => (FINAL ? s : `Draft: ${s}`);
const DRAFT_COMMENT = 'Unsigned draft, not published. Built by holdout/nanopubs/build-nanopubs.mjs from files under holdout/ that are not yet committed; the resolvable copy of those files is the live sub-dashboard data file linked from the provenance. The creator is the software agent that ran the exam; the key holder\'s ORCID is added only when that person approves and signs. No assertion template is declared because the published Delphi templates still carry the legacy probknow namespace and this 2.0 record was not created from one. Publishing needs the key owner\'s approval: test registry first.';

// Templates: no nt:wasCreatedFromTemplate, because the published Delphi assertion templates still carry the legacy
// probknow namespace and these 2.0 records were not created from them (team decision, hub 2026-10-31). The provenance
// template "Attributed to myself/others" and the ecosystem's Creator and License pubinfo templates were fetched on
// 2026-10-31 and carry no legacy IRI, so they are declared; ProbKnow's Domain pubinfo template does (2 occurrences) and is not.
function pubinfo({ label, type, introduces, domain }) {
  return `sub:pubinfo {
  this: dct:created ${dt(created)} ;
    dct:creator ${iri(CREATOR)} ;
    rdfs:label ${lit(draftLabel(label))} ;
    dct:license <https://creativecommons.org/licenses/by/4.0/> ;
    npx:hasNanopubType ${type} ;
    npx:introduces ${iri(introduces)} ;
    delphi:domain ${iri(domain)}${FINAL ? '' : ` ;\n    rdfs:comment ${lit(DRAFT_COMMENT)}`} ;
    nt:wasCreatedFromProvenanceTemplate ${iri(TEMPLATE.provenanceAttributed)} ;
    nt:wasCreatedFromPubinfoTemplate ${iri(TEMPLATE.pubinfoCreator)}, ${iri(TEMPLATE.pubinfoLicense)} .
  ${iri(domain)} rdfs:label ${lit(domain.slice(domain.lastIndexOf('/') + 1))} .
}
`;
}
const agentTriples = `  ${iri(ASSESSOR)} a prov:SoftwareAgent ;
    rdfs:label "delphisci holdout thread (session scienceclaw-93, Claude Fable 5.1): froze the held-out exam and runs it; built none of the work it examines" ;
    delphi:usesModel ${iri(MODEL)} .
  ${iri(MODEL)} a delphi:LanguageModel ;
    rdfs:label "Claude Fable 5.1" ;
    dct:identifier "claude-fable-5-1" .
`;
// A file with its SHA-256, as a prov:Entity with an SPDX checksum (the shape the Delphi pipeline uses for dataset files).
function fileNode(local, title, sha256, bytes, when) {
  return `  sub:${local} a prov:Entity ;
    dct:title ${lit(title)} ;
    spdx:checksum sub:${local}-sha ${bytes != null ? `;\n    schema:contentSize ${int(bytes)} ` : ''}${when ? `;\n    prov:generatedAtTime ${dt(when)} ` : ''}.
  sub:${local}-sha a spdx:Checksum ;
    spdx:algorithm spdx:checksumAlgorithm_sha256 ;
    spdx:checksumValue ${lit(sha256)} .
`;
}
// Structured counts and measurements (schema:PropertyValue, as the Delphi dataset builder emits counts).
function pv(subject, local, propertyId, value, description, kind = 'integer') {
  return `  ${iri(subject)} schema:additionalProperty sub:${local} .
  sub:${local} a schema:PropertyValue ;
    schema:propertyID ${lit(propertyId)} ;
    schema:value ${kind === 'integer' ? int(value) : dbl(value)} ;
    schema:description ${lit(description)} .
`;
}
// Status on the evidence item as a structured value (team convention, claim-tests/nanopubs/DECISIONS.md:
// delphi:hasVerdict has domain delphi:Assessment, so evidence items carry propertyID "status").
const statusPv = (subject, status) => `  ${iri(subject)} schema:additionalProperty sub:status .
  sub:status a schema:PropertyValue ;
    schema:propertyID "status" ;
    schema:value ${lit(status)} ;
    schema:description "Status of this evidence item in the words of holdout/EXAM.md and AGENTS.md A10" .
`;
// The frozen exam and split as file nodes. An exam that ran against an earlier freeze (recorded in CHECKSUMS.json as
// previous_freeze) cites that freeze's exam.json SHA-256; the node then says which freeze superseded it and whether
// the roster moved, so the record and the result file agree on what was frozen.
const tidy = s => String(s || '').replace(/\.\d{3}Z$/, 'Z');
const frozenExam = (examSha = sums.outputs['exam.json'].sha256) => {
  const pf = sums.previous_freeze;
  const current = examSha === sums.outputs['exam.json'].sha256;
  if (!current && !(pf && pf.outputs?.['exam.json']?.sha256 === examSha)) throw new Error(`exam.json SHA-256 ${examSha} matches neither the current freeze nor the recorded previous one`);
  const when = current ? sums.frozen_at : pf.frozen_at;
  const examDesc = current
    ? `holdout/exam.json (frozen roster and rules of the held-out exam; ${sums.provisional ? 'provisional' : `clade ${sums.decision?.status || 'confirmed'} ${sums.decision?.decided_on || ''}`.trim()}${sums.first_frozen_at && sums.first_frozen_at !== sums.frozen_at ? `; roster first frozen ${tidy(sums.first_frozen_at)}` : ''})`
    : `holdout/exam.json as frozen ${tidy(pf.frozen_at)} (${pf.provisional ? 'provisional' : 'confirmed'}), the freeze this exam ran against; superseded ${tidy(sums.frozen_at)} by the confirmed freeze (exam.json SHA-256 ${sums.outputs['exam.json'].sha256}) with the roster ${pf.roster_unchanged ? 'unchanged' : 'CHANGED'}`;
  return fileNode('frozen-exam', examDesc, examSha, current ? sums.outputs['exam.json'].bytes : pf.outputs['exam.json'].bytes, tidy(when))
    + fileNode('frozen-split', `holdout/split.json (assignment of every inventory taxon to holdout, train or excluded${current ? '' : `, as frozen ${tidy(pf.frozen_at)}`})`, current ? sums.outputs['split.json'].sha256 : pf.outputs['split.json'].sha256, current ? sums.outputs['split.json'].bytes : pf.outputs['split.json'].bytes, tidy(when));
};

const out = [];
const emit = (name, trig, meta) => out.push({ name, trig, meta });

// ---- 1, 2: held-out exams of the two claim tests ---------------------------------------------------
const EXAM_TEXT = {
  'kimura-heterozygosity': {
    sentence: n => `Held out on ${n} bird species, the exam could not distinguish the neutral-heterozygosity law from its refutation: the builder's pre-registered rule needs a minimum sample of 50.`,
    test: 'Ordinary least-squares slope of log10 nucleotide diversity on log10 census population size, and Spearman rank correlation, over the held-out bird species alone (the builder\'s own analysis.py --exam, unchanged)',
    numbers: (e, b, pw) => [
      ['n_species', e.exam_measured.n, 'held-out bird species with diversity and census-size values in the builder\'s table (the sample this evidence item rests on)'],
      ['builder_minimum_n', 50, 'minimum species count the builder pre-registered for a verdict (INCONCLUSIVE below it)'],
      ['n_training_species', e.exam_measured.extra.non_bird_fit.n, 'non-bird metazoan species the builder fitted; the builder\'s verdict rests on these'],
      ['n_mammal_species_if_mammalia_held_out', pw.find(t => t.clade === 'Mammalia').held_out_n, 'power analysis: species that would be held out had Mammalia been the clade (still below the minimum of 50)'],
      ['ols_slope_birds', e.exam_measured.value, 'OLS slope of log10 diversity on log10 census size, birds only', 'double'],
      ['spearman_rho_birds', e.exam_measured.extra.spearman_rho_birds, 'Spearman rho between log10 diversity and log10 census size, birds only', 'double'],
      ['ols_slope_training', e.exam_measured.extra.non_bird_fit.slope, 'the builder\'s slope on the non-bird species, for comparison (the law predicts about 1)', 'double'],
    ],
    notEstablished: 'It does not establish that the law holds or fails in birds: thirteen species cannot meet a rule written for fifty, and the bird slope is reported for the record only. It does not alter the builder\'s verdict on the training species, which the exam did not re-score. It says nothing about effective population size, which the test proxied by census size.',
  },
  'hamilton-senescence': {
    sentence: n => `Held out on ${n} bird species, the exam could not distinguish rising from flat adult mortality under Hamilton's declining force of selection: the builder's pre-registered rule needs a minimum sample of 15.`,
    test: 'Fraction of held-out bird species whose Spearman rank correlation between age class and adult mortality is positive, from age-classified COMADRE matrices (the builder\'s own analysis.py --exam, unchanged)',
    numbers: (e, b, pw) => [
      ['n_species', e.exam_measured.n, 'held-out bird species with qualifying age-classified matrices (the sample this evidence item rests on)'],
      ['builder_minimum_n', 15, 'minimum species count the builder pre-registered for a verdict (INCONCLUSIVE below it)'],
      ['n_training_species', 35, 'non-bird species the builder scored; the builder\'s verdict (mixed) rests on these'],
      ['n_bird_species_rising', e.exam_measured.extra.rising, 'held-out bird species with rising adult mortality (rho > 0)'],
      ['n_bird_species_falling', e.exam_measured.extra.falling, 'held-out bird species with falling adult mortality'],
      ['n_mammal_species_if_mammalia_held_out', pw.find(t => t.clade === 'Mammalia').held_out_n, 'power analysis: species that would be held out had Mammalia been the clade (clears the minimum of 15; that exam would have read mixed)'],
      ['fraction_birds_rising', e.exam_measured.value, 'fraction of held-out bird species with rising adult mortality', 'double'],
      ['mean_spearman_rho_birds', e.exam_measured.extra.mean_spearman_rho, 'mean Spearman rho(age class, adult mortality) across held-out bird species', 'double'],
    ],
    notEstablished: 'It does not establish whether adult mortality rises with age in birds: eight species cannot meet a rule written for fifteen, and the fraction is reported for the record only. It does not alter the builder\'s mixed verdict on the training species. It does not test the force of selection itself, only its predicted demographic signature.',
  },
};

for (const id of Object.keys(exams)) {
  const e = exams[id], b = builders[id], t = EXAM_TEXT[id];
  const pw = power.tests.filter(x => x.test === id);
  const STATUS = e.exam_verdict; // 'inconclusive' for both current exams
  const claim = `${R}claim/${id}`;
  const assessment = `${R}assessment/holdout-exam-${id}-aves`;
  const evidence = `${R}evidence/holdout-exam-${id}-aves`;
  const np = claimNp(id);
  const numbers = t.numbers(e, b, pw);
  const label = `Held-out exam (Aves) of ${id}: inconclusive, underpowered`;
  const trig = `${PREFIXES}
${HEAD}
sub:assertion {
  ${iri(claim)} delphi:hasAssessment ${iri(assessment)} ;
    delphi:hasEvidence ${iri(evidence)} .
  ${iri(assessment)} a delphi:Assessment ;
    rdfs:label ${lit(label)} ;
    delphi:evaluatesHypothesis ${iri(claim)} ;
    delphi:assessmentType "held-out-clade-exam" ;
    delphi:hasVerdict "inconclusive" ;
    dct:description ${lit(`Status: inconclusive (underpowered). ${t.sentence(e.exam_measured.n)} The exam applied the builder's own pre-registered decision rule, including its minimum sample size, to the held-out bird rows alone, after the builder reported status complete; the assessor did not build the test. Builder's verdict on the training species: ${b.verdict}. ${t.notEstablished}`)} ;
    delphi:evidenceAgainst ${lit(`Underpowered by the builder's own rule: ${e.exam_verdict_reason}.`)} ;
    delphi:hasEvidence ${iri(evidence)} ;
    prov:wasAttributedTo ${iri(ASSESSOR)} .
  ${iri(evidence)} a delphi:EvidenceItem ;
    rdfs:label ${lit(`${id}: ${e.exam_measured.unit} = ${Number(e.exam_measured.value).toFixed(4)} (n = ${e.exam_measured.n}; inconclusive, below the pre-registered minimum)`)} ;
    dct:description ${lit(`Measured on the frozen held-out roster (class Aves, frozen ${sums.frozen_at}, exam.json SHA-256 ${sums.outputs['exam.json'].sha256}) by running the builder's analysis.py --exam on a scratch copy of claim-tests/math-bio-theorems/${id} (analysis.py SHA-256 ${e.preconditions.analysis_sha256}; leak check exit ${e.preconditions.leak_check_exit}; split verified). Pre-registration: the builder's pass and fail criteria were committed before download (local commit 9b73128, 2026-10-31 05:55 UTC) and amended to exclude class Aves at the holdout thread's request before any data were downloaded (local commit 6f5de70, 2026-10-31 05:57:42 UTC), after the exam was frozen at ${sums.frozen_at}. The criteria are quoted verbatim on the pre-registration node this item derives from.`)} ;
    delphi:statisticalTest ${lit(t.test)} ;
    prov:wasDerivedFrom ${iri(b.datasets[0].doi ? `https://doi.org/${b.datasets[0].doi}` : b.datasets[0].landing_url)} , ${iri(b.datasets[0].landing_url)} , sub:frozen-exam , sub:preregistration ;
    rdfs:seeAlso ${iri(LIVE_DATA)} .
${statusPv(evidence, STATUS)}  sub:preregistration a prov:Entity, prov:Plan ;
    dct:title ${lit(`Builder's pre-registered decision rule for ${id} (claim-tests/math-bio-theorems/${id}/result.json, fields pass_criterion and fail_criterion)`)} ;
    prov:generatedAtTime ${dt('2026-10-31T05:57:42Z')} ;
    prov:value ${lit(`PASS: ${b.pass_criterion} FAIL: ${b.fail_criterion}`)} .
${numbers.map(([p, v, d, k], i) => pv(evidence, `m${i + 1}`, p, v, d, k)).join('')}${frozenExam(e.exam_roster_sha256)}${agentTriples}}

sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(ASSESSOR)} ;
    prov:wasDerivedFrom ${iri(LIVE_DATA)} , ${iri(TREE)} , ${iri(np.trustyUri)} ;
    prov:wasGeneratedBy sub:exam .
  sub:exam a prov:Activity ;
    rdfs:label ${lit(`node holdout/exam-results/run-claim-exam.mjs claim-tests/math-bio-theorems/${id} (protocol: holdout/EXAM.md; rule encoded in holdout/exam-results/rules.mjs from the builder's result.json prose)`)} ;
    prov:wasAssociatedWith ${iri(ASSESSOR)} ;
    prov:used sub:frozen-exam ;
    prov:endedAtTime ${dt(`${e.assessor.date}T00:00:00Z`)} .
  ${iri(np.trustyUri)} rdfs:label ${lit(`published claim nanopub for ${id} (production, ${np.productionPublishedAt})`)} .
}

${pubinfo({ label, type: 'delphi:Assessment', introduces: assessment, domain: DOMAIN_CLAIMS, templates: [TEMPLATE.evidence] })}`;
  emit(`exam-${id}-aves`, trig, { kind: 'held-out exam of a claim test', claim, introduces: assessment, verdict: 'inconclusive', n: e.exam_measured.n, builder_min_n: numbers[1][1] });
}

// ---- 3: pre-registered hypothesis for the organism-design exam -----------------------------------
const HYP = `${R}hypothesis/organism-design-blueprint-predicts-aves-anatomy`;
{
  const label = 'Pre-registered: the organism-design blueprint tool predicts sternal keel and foot webbing correctly on unseen bird species';
  const trig = `${PREFIXES}
${HEAD}
sub:assertion {
  ${iri(HYP)} a delphi:TestableHypothesis ;
    rdfs:label ${lit(label)} ;
    dct:description "From identifiers and ontology reasoning alone, the organism-design text-to-blueprint tool predicts, for each of the 48 held-out bird species, whether the sternal keel (carina) is present (absent in palaeognath ratites, present otherwise) and whether the foot is webbed (present for AVONET Primary.Lifestyle = Aquatic, absent for Terrestrial, Insessorial or Aerial), and its blueprints carry no internal conflicts." ;
    delphi:hypothesisType "pre-registered-blind-exam" ;
    delphi:context "Held-out clade Aves (frozen 2026-10-31T05:52:44Z). Ground truth read only at scoring time: NCBI Taxonomy lineage for ratite orders; AVONET supplementary dataset 1 (figshare DOI 10.6084/m9.figshare.16586228) for Primary.Lifestyle. Species whose prediction lacks the structure are not scored and their count is reported." ;
    delphi:proposedTest "Pass: accuracy >= 0.80 on each of tests A (keel) and B (webbing) with at least 10 scored species, and conflict-free blueprints for at least 40 of 48 species. Fail: accuracy < 0.60 on A or B with at least 10 scored species. Inconclusive (underpowered): fewer than 10 scored species on A or B. Between 0.60 and 0.80: mixed. Written in holdout/exam-results/organism-design/PREREG.md on 2026-10-31 before the prediction file existed and before any bird trait row was opened by the assessor." ;
    prov:wasAttributedTo ${iri(ASSESSOR)} .
${agentTriples}}

sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(ASSESSOR)} ;
    prov:wasDerivedFrom ${iri(LIVE_DATA)} , ${iri(TREE)} , <https://doi.org/10.6084/m9.figshare.16586228> .
}

${pubinfo({ label, type: 'delphi:TestableHypothesis', introduces: HYP, domain: DOMAIN_METHOD, templates: [TEMPLATE.hypothesis] })}`;
  emit('prereg-organism-design-aves', trig, { kind: 'pre-registered hypothesis (organism-design exam)', introduces: HYP });
}

// ---- 4: the organism-design exam result ---------------------------------------------------------
{
  const m = organism.exam_measured, x = organism.exploratory_not_preregistered;
  const STATUS = organism.exam_verdict;
  const assessment = `${R}assessment/holdout-exam-organism-design-aves`;
  const evidence = `${R}evidence/holdout-exam-organism-design-aves`;
  const label = 'Held-out exam (Aves) of the organism-design blueprint tool: inconclusive, the panel lacks both pre-registered structures';
  const trig = `${PREFIXES}
${HEAD}
sub:assertion {
  ${iri(HYP)} delphi:hasAssessment ${iri(assessment)} ;
    delphi:hasEvidence ${iri(evidence)} .
  ${iri(assessment)} a delphi:Assessment ;
    rdfs:label ${lit(label)} ;
    delphi:evaluatesHypothesis ${iri(HYP)} ;
    delphi:assessmentType "held-out-clade-exam" ;
    delphi:hasVerdict "inconclusive" ;
    dct:description ${lit(`Status: inconclusive. The exam could not score the pre-registered tests: the tool's structure panel (${x.panel_structures} Uberon terms) contains no sternal-keel term and no foot-webbing term, so tests A and B have zero scored species against a minimum of 10, and the prediction file reports no conflicts field, so test C is not evaluable. ${organism.caveats.join('; ')}. It does not establish that the tool is right or wrong about bird anatomy; it establishes that this panel cannot be examined on these two structures, which is a finding about the panel's coverage. Exploratory and not pre-registered: the ${x.species_with_predictions} roster species received only ${x.distinct_prediction_vectors_across_roster} distinct prediction vectors, so the tool's output barely varies across birds. This is run 3 of the exam, filed as result.run2.json; run 2 overwrote run 1 by a scripting error and that violation of the never-overwrite rule is recorded in holdout/exam-results/organism-design/NOTE.md. The prediction file was identical in every run (SHA-256 ${organism.preconditions.predictions_sha256}).`)} ;
    delphi:evidenceAgainst "No pre-registered structure is in the tool's panel, so no accuracy could be computed." ;
    delphi:hasEvidence ${iri(evidence)} ;
    prov:wasAttributedTo ${iri(ASSESSOR)} .
  ${iri(evidence)} a delphi:EvidenceItem ;
    rdfs:label ${lit(`organism-design on the Aves roster: A keel ${m.A_keel.n_scored} scored, B webbing ${m.B_webbing.n_scored} scored, C conflicts not reported for ${m.C_conflict_free.not_reported} of ${m.C_conflict_free.of} (inconclusive)`)} ;
    dct:description ${lit(`Scored by holdout/exam-results/organism-design/score.mjs against the rule in PREREG.md. Preconditions: frozen split verified; prediction file cites the frozen exam.json SHA-256 (${sums.outputs['exam.json'].sha256}); leak check over organism-design/ exit ${organism.preconditions.leak_check_exit} with organism-design/exam/ allowlisted because the prediction file necessarily names roster species. Ground truth: NCBI Taxonomy lineages (cached) and the AVONET extract (SHA-256 ${organism.ground_truth.avonet_extract_sha256}).`)} ;
    delphi:statisticalTest "Accuracy of present/absent predictions against lineage-derived (keel) and AVONET-derived (webbing) ground truth over scored species; none scored" ;
    prov:wasDerivedFrom <https://doi.org/10.6084/m9.figshare.16586228> , sub:frozen-exam , sub:predictions ;
    rdfs:seeAlso ${iri(LIVE_DATA)} .
${statusPv(evidence, STATUS)}${[
    ['n_roster_species', m.C_conflict_free.of, 'held-out bird species on the frozen roster'],
    ['n_panel_structures', x.panel_structures, 'Uberon structures in the tool\'s panel'],
    ['n_scored_keel', m.A_keel.n_scored, 'species scored on test A (sternal keel); minimum for a verdict is 10'],
    ['n_scored_webbing', m.B_webbing.n_scored, 'species scored on test B (foot webbing); minimum for a verdict is 10'],
    ['n_ratites_on_roster', m.A_keel.ratites_on_roster, 'palaeognath ratites on the roster, the keel-absent class'],
    ['n_conflicts_not_reported', m.C_conflict_free.not_reported, 'species whose blueprint carries no reading.conflicts field (test C not evaluable)'],
    ['n_distinct_prediction_vectors', x.distinct_prediction_vectors_across_roster, 'exploratory, not pre-registered: distinct prediction vectors across the roster'],
  ].map(([p, v, d], i) => pv(evidence, `m${i + 1}`, p, v, d)).join('')}${fileNode('predictions', 'organism-design/exam/aves-predictions.json (the organism thread\'s predictions for the roster)', organism.preconditions.predictions_sha256)}${frozenExam(organism.exam_roster_sha256)}${agentTriples}}

sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(ASSESSOR)} ;
    prov:wasDerivedFrom ${iri(LIVE_DATA)} , ${iri(TREE)} ;
    prov:wasGeneratedBy sub:exam .
  sub:exam a prov:Activity ;
    rdfs:label "node holdout/exam-results/organism-design/score.mjs --rerun --reason ... (protocol: holdout/EXAM.md and PREREG.md)" ;
    prov:wasAssociatedWith ${iri(ASSESSOR)} ;
    prov:used sub:frozen-exam , sub:predictions ;
    prov:endedAtTime ${dt(`${organism.assessor.date}T00:00:00Z`)} .
}

${pubinfo({ label, type: 'delphi:Assessment', introduces: assessment, domain: DOMAIN_METHOD, templates: [TEMPLATE.evidence] })}`;
  emit('exam-organism-design-aves', trig, { kind: 'held-out exam of the organism-design tool', hypothesis: HYP, introduces: assessment, verdict: 'inconclusive' });
}

// ---- 5: clade analysis -----------------------------------------------------------------------------
{
  const claim = `${R}claim/holdout-clade-aves-blind-for-all-current-tests`;
  const evidence = `${R}evidence/holdout-clade-power-analysis`;
  const inv = power.inventory;
  const STATUS = 'established by enumeration of project files';
  const nTests = completedTests.length;
  const nExamined = Object.keys(exams).length;
  const nNA = notApplicable.tests.length;
  const mammalOnly = notApplicable.tests.filter(t => /mammals only/i.test(t.why_not_applicable)).map(t => t.claim_id);
  const postHoc = [...Object.keys(exams), ...mammalOnly];
  const decisive = power.decisive_exams_by_clade;
  // The hub's cross-check of this tree's tests against the collaborator swarm's (dashboard/public/crosscheck.json): a claim's
  // verdict can depend on the operationalisation chosen, a hazard the held-out exam does not detect because it applies the
  // builder's own pre-registered rule and unit of analysis.
  const ccP = path.join(root, 'dashboard/public/crosscheck.json');
  const cc = fs.existsSync(ccP) ? JSON.parse(fs.readFileSync(ccP, 'utf8')) : null;
  const ccDiffer = cc ? cc.comparisons.filter(r => !r.agree) : [];
  const ccSentence = cc ? ` Scope of the exam: it checks a builder's prediction on species the builder never saw, under the builder's own pre-registered rule and unit of analysis; it does not detect that a verdict depends on the operationalisation chosen. The hub's cross-check against the collaborator swarm (dashboard/public/crosscheck.json, ${cc.builtAt}) shows that hazard is real: of ${cc.counts.overlapping} claims both swarms tested independently, ${cc.counts.agreements} verdicts agree and ${cc.counts.disagreements} differ (${ccDiffer.map(r => `${r.claim.split('/').pop()}: ours ${r.ours.verdict}, theirs ${r.theirs.verdict}`).join('; ')}), each difference one of degree between supports and mixed under different operationalisations rather than a factual contradiction. Blindness to the clade and robustness to the operationalisation are two separate checks, and a claim needs both.` : '';
  const dec = split.decision && split.decision.status === 'confirmed' ? split.decision : null;
  const examinedRows = power.tests.filter(t => t.clade === 'Aves');
  const label = `The public tables cannot support a blind clade exam at the builders' own minimum n: with Aves held out ${examinedRows.map(t => `${t.held_out_n} birds against ${t.builder_min_n} for ${t.test}`).join(', ')}; Aves was ${dec ? `confirmed on ${dec.decided_on}` : 'kept'} knowing this, over a Mammalia holdout that would make 1 of 2 exams decisive but ${postHoc.length} already-built tests post hoc`;
  const trig = `${PREFIXES}
${HEAD}
sub:assertion {
  ${iri(claim)} a delphi:Claim ;
    rdfs:label ${lit(label)} ;
    dct:description ${lit(`Status: established by enumeration of the project's own files (not a scientific hypothesis). The finding first: for the laws tested so far, the public trait and demographic tables leave too few held-out bird species to meet the builders' own pre-registered minimum sample sizes (${examinedRows.map(t => `${t.test}: ${t.held_out_n} against ${t.builder_min_n}`).join('; ')}), so a blind clade exam at those minimums cannot yet decide. This is a result about the state of the data, not about the thread, and it is more useful to the next team than a decisive-looking number from a compromised design. The decision: ${dec ? `class Aves was confirmed on ${dec.decided_on} by ${dec.decided_by}, relayed by the hub, after being provisional from the first freeze at ${split.decision.provisional_from}; the re-freeze left the roster unchanged.` : 'class Aves is the frozen clade, provisional until the project lead confirms.'} The cost was taken knowingly: ${dec ? dec.reasoning.slice(0, 3).join(' ') : ''} Of the ${nTests} completed claim tests, ${nExamined} were examined on held-out birds and ${nNA} contain no bird rows at all, so under the Aves holdout no completed test has fitted on held-out data. Under a Mammalia holdout, the ${nExamined} examined tests (which fitted on mammal rows) and ${mammalOnly.join(', ')} (mammals only) would already be built on held-out data: ${postHoc.length} post hoc tests. Power: with the builders' own minimum sample sizes, Aves reaches a verdict in ${decisive.Aves} of 2 examined tests and Mammalia in ${decisive.Mammalia} of 2. ${dec ? 'Aves is the frozen and confirmed clade.' : 'Aves is the frozen clade, labelled provisional until the project lead confirms.'} It does not establish which clade is scientifically better; it establishes the blindness and power trade-off for the tests that exist today, and it will change as tests are added.${ccSentence}`)} ;
    delphi:context ${lit(`Inventory sizes from holdout/split.json and holdout/alt/Mammalia/split.json: Aves ${inv.Aves.roster_species} roster species (${inv.Aves.genome_ready} genome-ready at chromosome or complete level), Mammalia ${inv.Mammalia.roster_species} roster species (${inv.Mammalia.genome_ready} genome-ready). Triage file: holdout/exam-results/not-applicable.json. Power file: holdout/power-analysis.json (${power.generated_at}).`)} ;
    delphi:hasEvidence ${iri(evidence)} ;
    prov:wasAttributedTo ${iri(ASSESSOR)} .
  ${iri(evidence)} a delphi:EvidenceItem ;
    rdfs:label ${lit(`Power analysis: held-out n and the builders' minimum n for each examined test under Aves and Mammalia`)} ;
    dct:description ${lit(power.method)} ;
    delphi:statisticalTest "Each completed claim test re-run with --exam on a scratch copy with the class filter swapped; the builder's own decision rule including its minimum n applied to the held-out species alone" ;
    rdfs:seeAlso ${iri(`${LIVE}POWER.md`)} ;
    prov:wasDerivedFrom sub:frozen-split ;
    rdfs:seeAlso ${iri(LIVE_DATA)} .
${statusPv(evidence, STATUS)}${[
    ['n_completed_claim_tests', nTests, 'completed claim tests under claim-tests/ at build time'],
    ['n_tests_examined_on_aves', nExamined, 'tests whose data contain bird rows and that were examined on the frozen roster'],
    ['n_tests_without_bird_rows', nNA, 'completed tests with no bird rows, logged as not applicable'],
    ['n_tests_post_hoc_if_mammalia', postHoc.length, 'already-built tests that fitted on mammal rows and would be post hoc under a Mammalia holdout'],
    ['n_decisive_exams_aves', decisive.Aves, 'examined tests reaching a verdict with Aves held out'],
    ['n_decisive_exams_mammalia', decisive.Mammalia, 'examined tests that would reach a verdict with Mammalia held out'],
    ['n_roster_species_aves', inv.Aves.roster_species, 'held-out species on the Aves roster'],
    ['n_roster_species_mammalia', inv.Mammalia.roster_species, 'species that a Mammalia roster would hold'],
    ...(cc ? [
      ['n_claims_cross_checked_with_collaborator_swarm', cc.counts.overlapping, 'claims tested independently by both this tree and the collaborator swarm (dashboard/public/crosscheck.json)'],
      ['n_cross_check_agreements', cc.counts.agreements, 'of those, verdicts that agree'],
      ['n_cross_check_disagreements', cc.counts.disagreements, 'of those, verdicts that differ under different operationalisations (supports against mixed), the hazard the held-out exam does not test'],
    ] : []),
    ...power.tests.map(t => [`held_out_n_${t.test.replace(/-/g, '_')}_${t.clade.toLowerCase()}`, t.held_out_n, `${t.test}: held-out species with ${t.clade} held out (builder minimum ${t.builder_min_n}; ${t.held_out_verdict})`]),
  ].map(([p, v, d], i) => pv(evidence, `m${i + 1}`, p, v, d)).join('')}${frozenExam()}${agentTriples}}

sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(ASSESSOR)} ;
    prov:wasDerivedFrom ${iri(LIVE_DATA)} , ${iri(TREE)} , sub:frozen-split .
}

${pubinfo({ label: `Clade decision: ${label}`, type: 'delphi:Claim', introduces: claim, domain: DOMAIN_METHOD, templates: [TEMPLATE.claim, TEMPLATE.evidence] })}`;
  emit('clade-analysis', trig, { kind: 'clade analysis', introduces: claim, post_hoc_if_mammalia: postHoc });
}

// ---- 6: leak check ---------------------------------------------------------------------------------
{
  const claim = `${R}claim/holdout-leak-check-clean-${leaks.scanned_at.slice(0, 10)}`;
  const evidence = `${R}evidence/holdout-leak-check-${leaks.scanned_at.replace(/[:.]/g, '-')}`;
  const STATUS = `observed: ${leaks.hits.length} hits outside the allowlist at ${leaks.scanned_at}`;
  const label = `Leak check: no builder file outside a reasoned allowlist names a held-out bird taxon (${leaks.hits.length} hits in ${leaks.files} files, ${leaks.scanned_at})`;
  const trig = `${PREFIXES}
${HEAD}
sub:assertion {
  ${iri(claim)} a delphi:Claim ;
    rdfs:label ${lit(label)} ;
    dct:description ${lit(`Status: observed at ${leaks.scanned_at}; it is a statement about the tree at that moment and is re-run before every exam. Method: holdout/check-leaks.mjs scans ${leaks.targets.join(', ')} (every top-level folder except ${Object.entries(leaks.excluded || {}).map(([k, v]) => `${k}: ${v}`).join('; ')}) for the scientific name, slug, NCBI taxid and GBIF key of every held-out taxon in holdout/split.json and for the id of every claim whose inventory organisms are all held out (exam.json); any line outside holdout/leak-allowlist.json is a hit and exits 1. Class-level words (Aves, bird, avian, AVONET) and the ids of claims mixing held-out and training organisms are warnings only. Allowlist entries each carry a reason; entries can be scoped to named taxa or claim ids, or gated on a first git commit before the first freeze (${sums.first_frozen_at || sums.frozen_at}) for the pre-freeze claim-extraction folders. It does not establish that no builder saw bird data outside this tree, it does not match common names, and it does not detect a held-out species described without its name, identifier or claim id; it establishes that the files the project holds are blind to the roster except where a stated reason says otherwise.`)} ;
    delphi:hasEvidence ${iri(evidence)} ;
    prov:wasAttributedTo ${iri(ASSESSOR)} .
  ${iri(evidence)} a delphi:EvidenceItem ;
    rdfs:label ${lit(`check-leaks.mjs run of ${leaks.scanned_at}: ${leaks.hits.length} non-allowlisted hits, ${leaks.warns} class-level warnings, ${allowlist.length} allowlist entries`)} ;
    dct:description "Output of node holdout/check-leaks.mjs --json over the builders' folders, against the held-out taxa of the frozen split." ;
    delphi:statisticalTest "Exhaustive string match of held-out names and identifiers; no sampling" ;
    prov:wasDerivedFrom sub:frozen-split ;
    rdfs:seeAlso ${iri(LIVE_DATA)} .
${statusPv(evidence, STATUS)}${[
    ['n_files_scanned', leaks.files, 'files read under the scanned folders'],
    ['n_hits_outside_allowlist', leaks.hits.length, 'lines naming a held-out taxon outside the allowlist (the exit code is 1 if this is not 0)'],
    ['n_class_level_warnings', leaks.warns, 'lines with class-level words only (Aves, bird, avian, AVONET), reported, not failing'],
    ['n_allowlist_entries', allowlist.length, 'entries in holdout/leak-allowlist.json, each with a reason'],
    ['n_allowlisted_lines', leaks.allowed, 'lines naming a held-out taxon or claim id that an allowlist entry tolerates with a reason'],
    ['n_allowlist_entries_scoped_to_taxa', allowlistKinds.taxa, 'entries that tolerate only named taxa under their path'],
    ['n_allowlist_entries_scoped_to_claims', allowlistKinds.claims, 'entries that tolerate only named claim ids under their path'],
    ['n_allowlist_entries_gated_on_first_commit', allowlistKinds.committed_before, 'entries that tolerate only files whose first git commit predates the first freeze'],
    ['n_scanned_folders', leaks.targets.length, 'top-level folders (and dashboard/public/t) scanned'],
    ['n_held_out_taxa', split.summary.holdout, 'held-out taxa whose names and identifiers are searched for'],
    ['n_holdout_claim_ids', leaks.signals.holdout_claim_ids, 'claim ids whose inventory organisms are all held out, searched for as a signal'],
  ].map(([p, v, d], i) => pv(evidence, `m${i + 1}`, p, v, d)).join('')}${frozenExam()}${agentTriples}}

sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(ASSESSOR)} ;
    prov:wasDerivedFrom ${iri(LIVE_DATA)} , ${iri(TREE)} , sub:frozen-split ;
    prov:wasGeneratedBy sub:scan .
  sub:scan a prov:Activity ;
    rdfs:label "node holdout/check-leaks.mjs --json" ;
    prov:wasAssociatedWith ${iri(ASSESSOR)} ;
    prov:endedAtTime ${dt(leaks.scanned_at.replace(/\.\d{3}Z$/, 'Z'))} .
}

${pubinfo({ label, type: 'delphi:Claim', introduces: claim, domain: DOMAIN_METHOD, templates: [TEMPLATE.claim, TEMPLATE.evidence] })}`;
  emit('leak-check', trig, { kind: 'leak check', introduces: claim, hits: leaks.hits.length, files: leaks.files });
}

// ---- 7: triage coverage ---------------------------------------------------------------------------
{
  const claim = `${R}claim/holdout-triage-coverage-${notApplicable.tests[0].checked}`;
  const evidence = `${R}evidence/holdout-triage-${notApplicable.tests[0].checked}`;
  const nTests = completedTests.length, nNA = notApplicable.tests.length, nEx = Object.keys(exams).length;
  const STATUS = 'established by inspection of each test\'s datasets and analysis script';
  const label = `${nNA} of ${nTests} completed claim tests contain no bird rows, so the Aves exam can enter only ${nEx}`;
  const trig = `${PREFIXES}
${HEAD}
sub:assertion {
  ${iri(claim)} a delphi:Claim ;
    rdfs:label ${lit(label)} ;
    dct:description ${lit(`Status: established by inspection of each test's result.json datasets and analysis.py on 2026-10-31. The completed tests draw on humans, Drosophila, a parasitoid wasp, spiders, North Sea fish, gastropods, ammonoids, carnivorans and cetaceans, geological and climate series, plants, and two cross-species tables (Buffalo 2021 diversity; COMADRE matrices) that are the only ones with bird rows. This is evidence about the inventory's coverage: a held-out clade can only examine tests whose data span it. It does not establish anything about the tests' verdicts, which stand as the builders reported them, unexamined. Reasons per test are in holdout/exam-results/not-applicable.json.`)} ;
    delphi:hasEvidence ${iri(evidence)} ;
    prov:wasAttributedTo ${iri(ASSESSOR)} .
  ${iri(evidence)} a delphi:EvidenceItem ;
    rdfs:label ${lit(`Triage of ${nTests} completed claim tests: ${nEx} examined on birds, ${nNA} not applicable`)} ;
    dct:description ${lit(notApplicable.what)} ;
    delphi:statisticalTest "Enumeration, no statistics" ;
    rdfs:seeAlso ${iri(LIVE_DATA)} .
${statusPv(evidence, STATUS)}${[
    ['n_completed_claim_tests', nTests, 'completed claim tests under claim-tests/ at build time'],
    ['n_tests_examined_on_aves', nEx, 'tests with bird rows, examined on the frozen roster'],
    ['n_tests_not_applicable', nNA, 'tests with no bird rows'],
    ['n_not_applicable_human_only', notApplicable.tests.filter(t => /Homo sapiens/.test(t.why_not_applicable)).length, 'of those, tests on Homo sapiens only'],
    ['n_not_applicable_data_blocked', notApplicable.tests.filter(t => /403/.test(t.why_not_applicable)).length, 'of those, tests whose data download was blocked (HTTP 403) so nothing was measured'],
  ].map(([p, v, d], i) => pv(evidence, `m${i + 1}`, p, v, d)).join('')}${notApplicable.tests.map(t => `  ${iri(evidence)} dct:references ${iri(`${R}claim/${t.claim_id}`)} .\n`).join('')}${agentTriples}}

sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(ASSESSOR)} ;
    prov:wasDerivedFrom ${iri(LIVE_DATA)} , ${iri(TREE)} .
}

${pubinfo({ label, type: 'delphi:Claim', introduces: claim, domain: DOMAIN_METHOD, templates: [TEMPLATE.claim, TEMPLATE.evidence] })}`;
  emit('triage-coverage', trig, { kind: 'triage coverage', introduces: claim, not_applicable: nNA, completed: nTests });
}

// ---- 8, 9: burned exam items -------------------------------------------------------------------------
for (const b of burned.claims) {
  const claim = `${R}claim/${b.id}`;
  const assessment = `${R}assessment/holdout-exam-eligibility-${b.id}`;
  const label = `Burned as a held-out exam item: ${b.id} (${b.label})`;
  const trig = `${PREFIXES}
${HEAD}
sub:assertion {
  ${iri(claim)} delphi:hasAssessment ${iri(assessment)} .
  ${iri(assessment)} a delphi:Assessment ;
    rdfs:label ${lit(label)} ;
    delphi:evaluatesHypothesis ${iri(claim)} ;
    delphi:assessmentType "held-out-exam-eligibility" ;
    delphi:hasVerdict "burned" ;
    dct:description ${lit(`Status: burned (retired as a blind exam item for the held-out clade Aves). Why: ${b.why} Disclosed by: ${b.disclosed_by}. A burned item is not a judgement on the claim itself: it stays a valid claim with whatever evidence it has; it can no longer serve as a blind test of a builder's bird predictions because a builder's agents read it before the clade was held out. It does not establish that any result about this claim is wrong, nor that the builder used bird data improperly.`)} ;
    delphi:evidenceAgainst ${lit(`Not blind: ${b.why}`)} ;
    prov:wasAttributedTo ${iri(ASSESSOR)} .
${agentTriples}}

sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(ASSESSOR)} ;
    prov:wasDerivedFrom ${iri(LIVE_DATA)} , ${iri(TREE)} ;
    prov:wasQuotedFrom ${lit(`${b.disclosed_by} (swarm/compare/DEVIATIONS.md, recorded in holdout/burned.json)`)} .
}

${pubinfo({ label, type: 'delphi:Assessment', introduces: assessment, domain: DOMAIN_METHOD, templates: [] })}`;
  emit(`burned-${b.id}`, trig, { kind: 'burned exam item', claim, introduces: assessment, verdict: 'burned' });
}

// ---- 10: rulings on questions other threads raised ---------------------------------------------------
for (const r of rulings.rulings) {
  const assessment = `${R}assessment/holdout-ruling-${r.id}`;
  const evidence = `${R}evidence/holdout-ruling-${r.id}-scan-${leaks.scanned_at.replace(/[:.]/g, '-')}`;
  const ids = r.subject.claims.map(c => c.id);
  const folders = [...new Set(r.subject.files.map(f => f.split('/')[0]))];
  const scans = Object.fromEntries(folders.map(f => [f, scanFolder(f)]));
  const taxonFiles = (f, s) => (s.allowed_files || []).filter(x => x.kinds.includes('taxon')).length + s.hits.filter(h => h.kind === 'taxon' && !h.allowed).length;
  const claimFiles = (f, s) => (s.allowed_files || []).filter(x => x.kinds.includes('claim') && x.what.some(w => ids.some(id => w.includes(id)))).length;
  const label = `Ruling on ${ids.join(' and ')}: ${r.ruling}`;
  const STATUS = `ruled ${r.date}; the scan numbers are from ${leaks.scanned_at}`;
  const trig = `${PREFIXES}
${HEAD}
sub:assertion {
${ids.map(id => `  ${iri(`${R}claim/${id}`)} delphi:hasAssessment ${iri(assessment)} .`).join('\n')}
  ${iri(assessment)} a delphi:Assessment ;
    rdfs:label ${lit(label)} ;
${ids.map(id => `    delphi:evaluatesHypothesis ${iri(`${R}claim/${id}`)} ;`).join('\n')}
    delphi:assessmentType "held-out-exam-eligibility" ;
    delphi:hasVerdict "eligible" ;
    dct:description ${lit(`Status: ruled ${r.date} by the ${r.ruled_by}, at the request of the ${r.asked_by}. Question: ${r.question} Ruling: ${r.ruling} Reasoning: ${r.reasoning.join(' ')} The checker before: ${r.checker_before} The checker after: ${r.checker_after} Does not establish: ${r.does_not_establish.join(' ')}`)} ;
    rdfs:comment ${lit(`To the builders: ${r.to_the_builders.join(' ')}`)} ;
    delphi:hasEvidence ${iri(evidence)} ;
    prov:wasAttributedTo ${iri(ASSESSOR)} .
  ${iri(evidence)} a delphi:EvidenceItem ;
    rdfs:label ${lit(`Scan of ${folders.join(' and ')} on ${leaks.scanned_at}: no file names a held-out taxon outside a reasoned allowlist entry; the claim ids appear only where an entry citing this ruling tolerates them`)} ;
    dct:description ${lit(`Output of node holdout/check-leaks.mjs --json over ${folders.join(', ')} after the scope was widened to .trig, .lean and the claim-id signal. Files the ruling is about: ${r.subject.files.join(', ')}.`)} ;
    delphi:statisticalTest "Exhaustive string match of held-out names, identifiers and claim ids; no sampling" ;
    prov:wasDerivedFrom sub:frozen-split ;
    rdfs:seeAlso ${iri(LIVE_DATA)} .
${statusPv(evidence, STATUS)}${folders.flatMap(f => [
    [`n_files_scanned_${f}`, scans[f].files, `files read under ${f}/`],
    [`n_hits_outside_allowlist_${f}`, scans[f].hits.length, `lines under ${f}/ naming a held-out taxon or claim id outside the allowlist`],
    [`n_files_naming_a_held_out_taxon_${f}`, taxonFiles(f, scans[f]), `files under ${f}/ in which a held-out name or identifier appears (tolerated or not)`],
    [`n_files_naming_the_ruled_claims_${f}`, claimFiles(f, scans[f]), `files under ${f}/ naming ${ids.join(' or ')}, tolerated under the entry that cites this ruling`],
  ]).map(([p, v, d], i) => pv(evidence, `m${i + 1}`, p, v, d)).join('')}${frozenExam()}${agentTriples}}

sub:provenance {
  sub:assertion prov:wasAttributedTo ${iri(ASSESSOR)} ;
    prov:wasDerivedFrom ${iri(LIVE_DATA)} , ${iri(TREE)} , sub:frozen-split ;
    prov:wasGeneratedBy sub:scan .
  sub:scan a prov:Activity ;
    rdfs:label "node holdout/check-leaks.mjs --json, after widening the scope (holdout/rulings.json, checker_after)" ;
    prov:wasAssociatedWith ${iri(ASSESSOR)} ;
    prov:endedAtTime ${dt(leaks.scanned_at.replace(/\.\d{3}Z$/, 'Z'))} .
}

${pubinfo({ label, type: 'delphi:Assessment', introduces: assessment, domain: DOMAIN_METHOD, templates: [] })}`;
  emit(`ruling-${r.id}`, trig, { kind: 'ruling', claims: ids.map(id => `${R}claim/${id}`), introduces: assessment, verdict: 'eligible', ruled_on: r.date });
}

// ---- write -------------------------------------------------------------------------------------------
const outDir = path.join(here, 'unsigned');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const o of out) fs.writeFileSync(path.join(outDir, `${o.name}.trig`), o.trig);
const manifest = {
  status: FINAL ? 'built for signing: unsigned, unpublished' : 'DRAFTS: unsigned, unpublished, awaiting the key owner\'s decision on signing and the test registry',
  built: created,
  generator: 'holdout/nanopubs/build-nanopubs.mjs',
  ontology: 'Project Delphi v2.0 (https://w3id.org/delphi/ontology/), templates from project-delphi-ontology commit 6ba5f9a97a4511c909f5dfd755c7993dd68989f3',
  inputs_frozen_at: sums.frozen_at,
  exam_json_sha256: sums.outputs['exam.json'].sha256,
  commit: COMMIT,
  commit_tree: TREE,
  clade_decision: split.decision ? { status: split.decision.status, decided_on: split.decision.decided_on, decided_by: split.decision.decided_by } : null,
  freeze: { frozen_at: sums.frozen_at, first_frozen_at: sums.first_frozen_at || sums.frozen_at, exam_json_sha256: sums.outputs['exam.json'].sha256, previous_exam_json_sha256: sums.previous_freeze?.outputs?.['exam.json']?.sha256 || null, roster_unchanged_at_refreeze: sums.previous_freeze?.roster_unchanged ?? null },
  commit_holds: commitHolds,
  note: `Provenance points at the live sub-dashboard copy and at the commit-pinned holdout/ tree (${COMMIT}). Checked at build time against the local git object: that commit holds ${commitHolds}. The claim-exam and organism-exam records cite the earlier provisional freeze (exam.json ${sums.previous_freeze?.outputs?.['exam.json']?.sha256 || 'n/a'}) they ran against, with a node saying the confirmed freeze superseded it and the roster did not move. Before signing: --final with --creator <ORCID> and --commit <sha>, node holdout/nanopubs/check.mjs, lint, then test registry.`,
  lint_exemptions: Object.fromEntries(out.filter(o => ['clade-analysis', 'leak-check', 'triage-coverage'].includes(o.name)).map(o => [o.meta.introduces,
    'No empirical dataset: the claim is about files of this project (frozen split, triage record, leak-check run), all carried in the record with SHA-256 or counts. Exempted from CLAIM-NO-DATASET with this reason.'])),
  nanopubs: out.map(o => ({ file: `holdout/nanopubs/unsigned/${o.name}.trig`, ...o.meta, registry: null, trustyUri: null, signedFile: null, publishedAt: null })),
};
fs.writeFileSync(path.join(here, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`wrote ${out.length} draft nanopubs to holdout/nanopubs/unsigned/ (${manifest.status})`);
