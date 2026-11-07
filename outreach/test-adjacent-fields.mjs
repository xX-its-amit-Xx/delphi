#!/usr/bin/env node
// node outreach/test-adjacent-fields.mjs [--fail-once]
//
// House discipline: every assertion wraps its condition in f(real, broken), where `broken` is the
// INVERTED predicate and so evaluates FALSE whenever the data are correct. Running with --fail-once must
// therefore print ZERO "ok" lines: if any assertion still passes under the fault, that assertion was not
// actually testing anything and the fault did not bite.
//
// The load-bearing test in this file is the PRIVACY one. These are real people, and the sources these
// profiles were built from - PubMed records and open-access JATS full texts - carry corresponding-author
// email addresses in their front matter. The whole serialised export is regexed for email addresses and
// for phone numbers, so a copy-paste from a source cannot smuggle one in unnoticed. That assertion is
// written to fire on the real data if the data are ever wrong, not merely to pass today.
//
// The second class of tests holds the HONESTY structure in place: every openness claim carries a
// stated/inferred marker, every quote names a source, every cluster is mapped to a goal AND to a
// Delphi/Nous/Aletheia layer, every cluster has a stated gap, and at least two candidates carry a
// caution. Those are the fields that would quietly disappear first if this file were ever regenerated
// carelessly, which is exactly why they are asserted.

import {
  CANDIDATES, WHY_THESE_FIELDS, THE_HONEST_GAP, FIELD_CLUSTERS, GOALS, LAYERS,
  EVIDENCE_KINDS, ALL_DOIS, DOI_LINKS, DOI_VERIFICATION, QUOTE_ATTRITION, PROVENANCE,
  crossCheckClusters,
} from './adjacent-fields.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); }
};
const f = (real, broken) => (FAULT ? broken : real);

// ---------------------------------------------------------------------------------------------------
// Vocabulary and shapes
// ---------------------------------------------------------------------------------------------------

const REQUIRED_FIELDS = [
  'id', 'name', 'institution', 'lab_url', 'field', 'why_relevant_to_delphi', 'flagship_papers',
  'key_figures_or_findings', 'real_quotes', 'public_record', 'collaboration_angle',
  'openness_evidence', 'caution',
];
const PAPER_FIELDS = ['title', 'year', 'journal', 'doi', 'why_it_matters'];
const QUOTE_FIELDS = ['quote', 'source_title', 'doi_or_url', 'context'];

const CLUSTER_IDS = Object.values(FIELD_CLUSTERS);
const GOAL_IDS = Object.values(GOALS);
const LAYER_IDS = Object.values(LAYERS);
const EVIDENCE_IDS = Object.values(EVIDENCE_KINDS);

const DOI_SHAPE = /^10\.\d{4,9}\/\S+$/;
const URL_SHAPE = /^https?:\/\/\S+$/;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

// Serialise EVERYTHING the module exports, so the privacy regexes cannot be dodged by hiding a string
// in a field the tests do not happen to walk.
const SERIALISED = JSON.stringify({
  CANDIDATES, WHY_THESE_FIELDS, THE_HONEST_GAP, FIELD_CLUSTERS, GOALS, LAYERS, EVIDENCE_KINDS,
  ALL_DOIS, DOI_LINKS, DOI_VERIFICATION, QUOTE_ATTRITION, PROVENANCE,
});

// ---------------------------------------------------------------------------------------------------
console.log('\n-- the set --');

check('8 to 12 candidates, as the brief bounds it',
  f(CANDIDATES.length >= 8 && CANDIDATES.length <= 12,
    !(CANDIDATES.length >= 8 && CANDIDATES.length <= 12)),
  `got ${CANDIDATES.length}`);

check('candidate ids are unique',
  f(new Set(CANDIDATES.map((c) => c.id)).size === CANDIDATES.length,
    new Set(CANDIDATES.map((c) => c.id)).size !== CANDIDATES.length));

check('every one of the five field clusters is populated',
  f(CLUSTER_IDS.every((id) => CANDIDATES.some((c) => c.field === id)),
    !CLUSTER_IDS.every((id) => CANDIDATES.some((c) => c.field === id))),
  `missing: ${CLUSTER_IDS.filter((id) => !CANDIDATES.some((c) => c.field === id)).join(', ') || 'none'}`);

check('the module\'s own structural cross-check reports no problems',
  f(crossCheckClusters().length === 0, crossCheckClusters().length !== 0),
  crossCheckClusters().join(' | '));

// ---------------------------------------------------------------------------------------------------
console.log('\n-- required fields, per candidate --');

for (const c of CANDIDATES) {
  const missing = REQUIRED_FIELDS.filter((k) => !(k in c)
    || c[k] === null || c[k] === undefined
    || (typeof c[k] === 'string' && !nonEmpty(c[k]))
    || (Array.isArray(c[k]) && c[k].length === 0));
  check(`${c.id}: all required fields present and non-empty`,
    f(missing.length === 0, missing.length !== 0), `missing/empty: ${missing.join(', ')}`);

  check(`${c.id}: field is in the closed cluster vocabulary`,
    f(CLUSTER_IDS.includes(c.field), !CLUSTER_IDS.includes(c.field)), c.field);

  check(`${c.id}: lab_url is an http(s) URL`,
    f(URL_SHAPE.test(c.lab_url), !URL_SHAPE.test(c.lab_url)), c.lab_url);

  check(`${c.id}: institution is named`,
    f(nonEmpty(c.institution) && c.institution.length > 10,
      !(nonEmpty(c.institution) && c.institution.length > 10)));

  check(`${c.id}: key_figures_or_findings is a non-empty array of non-empty strings`,
    f(Array.isArray(c.key_figures_or_findings) && c.key_figures_or_findings.length > 0
      && c.key_figures_or_findings.every(nonEmpty),
      !(Array.isArray(c.key_figures_or_findings) && c.key_figures_or_findings.length > 0
        && c.key_figures_or_findings.every(nonEmpty))));

  check(`${c.id}: collaboration_angle says what WE must bring`,
    f(nonEmpty(c.collaboration_angle?.what_we_must_bring),
      !nonEmpty(c.collaboration_angle?.what_we_must_bring)));
}

// ---------------------------------------------------------------------------------------------------
console.log('\n-- papers and identifiers --');

for (const c of CANDIDATES) {
  check(`${c.id}: at least two flagship papers`,
    f(c.flagship_papers.length >= 2, !(c.flagship_papers.length >= 2)),
    `got ${c.flagship_papers.length}`);

  const badPaper = c.flagship_papers.find((p) => PAPER_FIELDS.some((k) => !(k in p)
    || p[k] === null || p[k] === undefined
    || (typeof p[k] === 'string' && !nonEmpty(p[k]))));
  check(`${c.id}: every paper carries title, year, journal, doi and why_it_matters`,
    f(!badPaper, !!badPaper), badPaper ? badPaper.title : '');

  const badDoi = c.flagship_papers.find((p) => !DOI_SHAPE.test(p.doi));
  check(`${c.id}: every doi has DOI shape`,
    f(!badDoi, !!badDoi), badDoi ? `${badDoi.title}: ${badDoi.doi}` : '');

  const badYear = c.flagship_papers.find((p) => !(Number.isInteger(p.year) && p.year >= 1950 && p.year <= 2026));
  check(`${c.id}: every year is a plausible integer`,
    f(!badYear, !!badYear), badYear ? `${badYear.title}: ${badYear.year}` : '');

  const badPmid = c.flagship_papers.filter((p) => 'pmid' in p).find((p) => !/^\d{4,8}$/.test(p.pmid));
  check(`${c.id}: every pmid, where given, is 4-8 digits`,
    f(!badPmid, !!badPmid), badPmid ? `${badPmid.title}: ${badPmid.pmid}` : '');
}

check('ALL_DOIS is deduplicated',
  f(new Set(ALL_DOIS).size === ALL_DOIS.length, new Set(ALL_DOIS).size !== ALL_DOIS.length));

check('DOI_LINKS has one resolvable link per cited DOI, as the PubMed terms require',
  f(DOI_LINKS.length === ALL_DOIS.length && DOI_LINKS.every((u) => u.startsWith('https://doi.org/10.')),
    !(DOI_LINKS.length === ALL_DOIS.length && DOI_LINKS.every((u) => u.startsWith('https://doi.org/10.')))));

check('DOI_VERIFICATION reports every cited DOI as resolved against Crossref',
  f(DOI_VERIFICATION.distinct_dois_cited === ALL_DOIS.length
    && DOI_VERIFICATION.resolved_against_crossref === ALL_DOIS.length
    && DOI_VERIFICATION.failed_to_resolve === 0,
    !(DOI_VERIFICATION.distinct_dois_cited === ALL_DOIS.length
      && DOI_VERIFICATION.resolved_against_crossref === ALL_DOIS.length
      && DOI_VERIFICATION.failed_to_resolve === 0)),
  `cited ${ALL_DOIS.length}, claims ${DOI_VERIFICATION.distinct_dois_cited} cited / ${DOI_VERIFICATION.resolved_against_crossref} resolved`);

check('PROVENANCE attributes article metadata to PubMed',
  f(/PubMed/.test(PROVENANCE.article_metadata), !/PubMed/.test(PROVENANCE.article_metadata)));

// ---------------------------------------------------------------------------------------------------
console.log('\n-- quotes: real, sourced, never invented --');

for (const c of CANDIDATES) {
  const badQuoteShape = c.real_quotes.find((q) => QUOTE_FIELDS.some((k) => !nonEmpty(q[k])));
  check(`${c.id}: every quote has a non-empty quote, source_title, doi_or_url and context`,
    f(!badQuoteShape, !!badQuoteShape),
    badQuoteShape ? JSON.stringify(badQuoteShape).slice(0, 120) : '');

  const unsourced = c.real_quotes.find((q) => !nonEmpty(q.source_title));
  check(`${c.id}: no quote has an empty source`,
    f(!unsourced, !!unsourced));

  const badLink = c.real_quotes.find((q) => !(URL_SHAPE.test(q.doi_or_url)));
  check(`${c.id}: every quote's doi_or_url is a URL`,
    f(!badLink, !!badLink), badLink ? badLink.doi_or_url : '');
}

check('quote count matches what QUOTE_ATTRITION claims was kept',
  f(CANDIDATES.reduce((n, c) => n + c.real_quotes.length, 0) === QUOTE_ATTRITION.kept,
    CANDIDATES.reduce((n, c) => n + c.real_quotes.length, 0) !== QUOTE_ATTRITION.kept),
  `present ${CANDIDATES.reduce((n, c) => n + c.real_quotes.length, 0)}, claimed ${QUOTE_ATTRITION.kept}`);

check('QUOTE_ATTRITION records at least one dropped quote with a reason for each',
  f(QUOTE_ATTRITION.dropped > 0 && QUOTE_ATTRITION.why_dropped.length === QUOTE_ATTRITION.dropped,
    !(QUOTE_ATTRITION.dropped > 0 && QUOTE_ATTRITION.why_dropped.length === QUOTE_ATTRITION.dropped)),
  `dropped ${QUOTE_ATTRITION.dropped}, reasons ${QUOTE_ATTRITION.why_dropped.length}`);

// A quote that is a bare fragment with no explanation is the shape a paraphrase takes when it is
// passed off as a quotation. Require every fragment to be declared as one in `context`.
const undeclaredFragment = CANDIDATES.flatMap((c) => c.real_quotes.map((q) => ({ c, q })))
  .find(({ q }) => !/^[A-Z]/.test(q.quote.trim()) && !/fragment/i.test(q.context));
check('every quote that does not begin a sentence declares itself a fragment in context',
  f(!undeclaredFragment, !!undeclaredFragment),
  undeclaredFragment ? `${undeclaredFragment.c.id}: ${undeclaredFragment.q.quote.slice(0, 70)}` : '');

// ---------------------------------------------------------------------------------------------------
console.log('\n-- PRIVACY: the load-bearing assertions --');

// Deliberately permissive, so that anything shaped remotely like an address trips it.
const EMAIL = /[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const AT_SIGN = /@/;
// Bounded so DOI and page-range digit runs cannot be mistaken for a number: the match may not be
// preceded or followed by a digit, dot, hyphen or slash.
const PHONE = /(?<![\d./-])(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}(?![\d./-])/;
const LONG_DIGIT_RUN = /(?<![\d./-])\+?\d{9,}(?![\d./-])/;

check('NO EMAIL ADDRESS anywhere in the serialised export',
  f(!EMAIL.test(SERIALISED), EMAIL.test(SERIALISED)),
  (SERIALISED.match(EMAIL) || [''])[0]);

check('no bare "@" anywhere either, so no social handle can hide as one',
  f(!AT_SIGN.test(SERIALISED), AT_SIGN.test(SERIALISED)),
  SERIALISED.slice(Math.max(0, SERIALISED.indexOf('@') - 40), SERIALISED.indexOf('@') + 40));

check('NO PHONE NUMBER anywhere in the serialised export',
  f(!PHONE.test(SERIALISED), PHONE.test(SERIALISED)),
  (SERIALISED.match(PHONE) || [''])[0]);

check('no bare run of nine or more digits that could be a phone number',
  f(!LONG_DIGIT_RUN.test(SERIALISED), LONG_DIGIT_RUN.test(SERIALISED)),
  (SERIALISED.match(LONG_DIGIT_RUN) || [''])[0]);

// The privacy regexes are only worth anything if they can actually fire. Prove it on a fixture, so a
// regex that silently stopped matching cannot pass this file by matching nothing at all.
const FIXTURE = 'contact a.person(AT)example.edu or (617) 555-0123'.replace('(AT)', String.fromCharCode(64));
check('the email regex demonstrably fires on a planted fixture',
  f(EMAIL.test(FIXTURE), !EMAIL.test(FIXTURE)));
check('the phone regex demonstrably fires on a planted fixture',
  f(PHONE.test(FIXTURE), !PHONE.test(FIXTURE)));

check('PROVENANCE states that no contact details are recorded',
  f(/No contact details of any kind/i.test(PROVENANCE.what_is_NOT_here),
    !/No contact details of any kind/i.test(PROVENANCE.what_is_NOT_here)));

// Every lab_url must be an institutional or lab host, not a social platform.
const SOCIAL = /(twitter|x\.com|facebook|instagram|linkedin|t\.me|mastodon|bsky|threads|tiktok|youtube)/i;
const socialUrl = CANDIDATES.find((c) => SOCIAL.test(c.lab_url));
check('no lab_url points at a social platform',
  f(!socialUrl, !!socialUrl), socialUrl ? `${socialUrl.id}: ${socialUrl.lab_url}` : '');

// ---------------------------------------------------------------------------------------------------
console.log('\n-- openness evidence: every entry marked stated or inferred --');

for (const c of CANDIDATES) {
  check(`${c.id}: openness_evidence is a non-empty array`,
    f(Array.isArray(c.openness_evidence) && c.openness_evidence.length > 0,
      !(Array.isArray(c.openness_evidence) && c.openness_evidence.length > 0)));

  const unmarked = c.openness_evidence.filter((e) => !EVIDENCE_IDS.includes(e.kind));
  check(`${c.id}: every openness_evidence entry is marked stated or inferred`,
    f(unmarked.length === 0, unmarked.length !== 0),
    unmarked.map((e) => JSON.stringify(e.kind)).join(', '));

  const noEvidence = c.openness_evidence.filter((e) => !nonEmpty(e.evidence) || !nonEmpty(e.source));
  check(`${c.id}: every openness_evidence entry carries evidence text and a source`,
    f(noEvidence.length === 0, noEvidence.length !== 0));

  // An inference presented as the person's intention is the failure this field exists to prevent.
  const unflaggedInference = c.openness_evidence
    .filter((e) => e.kind === EVIDENCE_KINDS.INFERRED)
    .find((e) => !/INFERENCE FROM|infer/i.test(e.evidence));
  check(`${c.id}: every inferred entry says in its own text that it is an inference`,
    f(!unflaggedInference, !!unflaggedInference),
    unflaggedInference ? unflaggedInference.evidence.slice(0, 80) : '');
}

const anyStated = CANDIDATES.filter((c) => c.openness_evidence.some((e) => e.kind === EVIDENCE_KINDS.STATED));
check('at least eight candidates have at least one STATED openness signal, not only inferences',
  f(anyStated.length >= 8, !(anyStated.length >= 8)), `got ${anyStated.length}`);

const anyInferred = CANDIDATES.filter((c) => c.openness_evidence.some((e) => e.kind === EVIDENCE_KINDS.INFERRED));
check('both marker values are actually used, so the marker is not decorative',
  f(anyStated.length > 0 && anyInferred.length > 0, !(anyStated.length > 0 && anyInferred.length > 0)));

// ---------------------------------------------------------------------------------------------------
console.log('\n-- WHY_THESE_FIELDS: a goal AND a layer per cluster --');

for (const id of CLUSTER_IDS) {
  const w = WHY_THESE_FIELDS[id];
  check(`${id}: present in WHY_THESE_FIELDS`, f(!!w, !w));
  if (!w) continue;

  check(`${id}: names one of the three stated project goals`,
    f(GOAL_IDS.includes(w.goal), !GOAL_IDS.includes(w.goal)), String(w.goal));

  check(`${id}: names a Delphi/Nous/Aletheia layer`,
    f(LAYER_IDS.includes(w.layer), !LAYER_IDS.includes(w.layer)), String(w.layer));

  check(`${id}: names BOTH a goal and a layer in the same entry`,
    f(GOAL_IDS.includes(w.goal) && LAYER_IDS.includes(w.layer),
      !(GOAL_IDS.includes(w.goal) && LAYER_IDS.includes(w.layer))));

  check(`${id}: layer_name matches the layer it claims`,
    f(({ generation: 'Delphi', inference: 'Nous', disclosure: 'Aletheia' })[w.layer] === w.layer_name,
      ({ generation: 'Delphi', inference: 'Nous', disclosure: 'Aletheia' })[w.layer] !== w.layer_name),
    `${w.layer} vs ${w.layer_name}`);

  check(`${id}: explains why, at length`,
    f(nonEmpty(w.why) && w.why.length > 200, !(nonEmpty(w.why) && w.why.length > 200)));
}

check('WHY_THESE_FIELDS has no cluster outside the closed vocabulary',
  f(Object.keys(WHY_THESE_FIELDS).every((k) => CLUSTER_IDS.includes(k)),
    !Object.keys(WHY_THESE_FIELDS).every((k) => CLUSTER_IDS.includes(k))));

check('WHY_THESE_FIELDS is frozen',
  f(Object.isFrozen(WHY_THESE_FIELDS), !Object.isFrozen(WHY_THESE_FIELDS)));

check('all three project goals are claimed by at least one cluster',
  f(GOAL_IDS.every((g) => Object.values(WHY_THESE_FIELDS).some((w) => w.goal === g || (w.also_serves || []).includes(g))),
    !GOAL_IDS.every((g) => Object.values(WHY_THESE_FIELDS).some((w) => w.goal === g || (w.also_serves || []).includes(g)))));

check('all three layers are used by at least one cluster',
  f(LAYER_IDS.every((l) => Object.values(WHY_THESE_FIELDS).some((w) => w.layer === l)),
    !LAYER_IDS.every((l) => Object.values(WHY_THESE_FIELDS).some((w) => w.layer === l))));

// ---------------------------------------------------------------------------------------------------
console.log('\n-- THE_HONEST_GAP: one entry per cluster, and the xenobot statement --');

check('THE_HONEST_GAP has exactly one entry per cluster and no others',
  f(Object.keys(THE_HONEST_GAP.by_cluster).length === CLUSTER_IDS.length
    && CLUSTER_IDS.every((id) => !!THE_HONEST_GAP.by_cluster[id]),
    !(Object.keys(THE_HONEST_GAP.by_cluster).length === CLUSTER_IDS.length
      && CLUSTER_IDS.every((id) => !!THE_HONEST_GAP.by_cluster[id]))),
  `${Object.keys(THE_HONEST_GAP.by_cluster).length} entries for ${CLUSTER_IDS.length} clusters`);

for (const id of CLUSTER_IDS) {
  const g = THE_HONEST_GAP.by_cluster[id];
  if (!g) continue;
  check(`${id}: states what we cannot offer today, at length`,
    f(nonEmpty(g.what_we_cannot_offer_today) && g.what_we_cannot_offer_today.length > 120,
      !(nonEmpty(g.what_we_cannot_offer_today) && g.what_we_cannot_offer_today.length > 120)));
  check(`${id}: carries a blunt version, so the gap is not only stated politely`,
    f(nonEmpty(g.the_blunt_version), !nonEmpty(g.the_blunt_version)));
  check(`${id}: says what a partner would actually want`,
    f(nonEmpty(g.what_a_partner_would_want), !nonEmpty(g.what_a_partner_would_want)));
}

// The specific admission the brief requires, in so many words.
const xeno = THE_HONEST_GAP.by_cluster[FIELD_CLUSTERS.XENOBOTS];
check('the xenobot gap says nothing in the pipeline can propose a cell arrangement',
  f(/nothing in the pipeline can propose a cell arrangement/i.test(xeno.what_we_cannot_offer_today),
    !/nothing in the pipeline can propose a cell arrangement/i.test(xeno.what_we_cannot_offer_today)));

check('the xenobot gap concedes that a cell arrangement IS the design surface for that field',
  f(/entire design surface/i.test(xeno.what_we_cannot_offer_today),
    !/entire design surface/i.test(xeno.what_we_cannot_offer_today)));

check('the xenobot gap names our actual design surface as an edit list against a reference assembly',
  f(/edit list against a reference assembly/i.test(xeno.what_we_cannot_offer_today),
    !/edit list against a reference assembly/i.test(xeno.what_we_cannot_offer_today)));

check('the xenobot gap admits our formats do represent genomes and per-cell geometry',
  f(/genomes/i.test(xeno.what_we_cannot_offer_today) && /per-cell geometry/i.test(xeno.what_we_cannot_offer_today),
    !(/genomes/i.test(xeno.what_we_cannot_offer_today) && /per-cell geometry/i.test(xeno.what_we_cannot_offer_today))));

check('THE_HONEST_GAP names xenobots as the sharpest gap',
  f(/xenobot/i.test(THE_HONEST_GAP.the_sharpest_one), !/xenobot/i.test(THE_HONEST_GAP.the_sharpest_one)));

check('the origins-of-life gap admits we have nothing to offer there yet',
  f(/nothing/i.test(THE_HONEST_GAP.by_cluster[FIELD_CLUSTERS.ORIGINS].what_we_cannot_offer_today),
    !/nothing/i.test(THE_HONEST_GAP.by_cluster[FIELD_CLUSTERS.ORIGINS].what_we_cannot_offer_today)));

check('THE_HONEST_GAP is frozen',
  f(Object.isFrozen(THE_HONEST_GAP) && Object.isFrozen(THE_HONEST_GAP.by_cluster),
    !(Object.isFrozen(THE_HONEST_GAP) && Object.isFrozen(THE_HONEST_GAP.by_cluster))));

// ---------------------------------------------------------------------------------------------------
console.log('\n-- cautions --');

const cautioned = CANDIDATES.filter((c) => nonEmpty(c.caution));
check('at least two candidates carry a non-empty caution',
  f(cautioned.length >= 2, !(cautioned.length >= 2)), `got ${cautioned.length}`);

check('every caution is substantive rather than a placeholder',
  f(cautioned.every((c) => c.caution.length > 80), !cautioned.every((c) => c.caution.length > 80)),
  cautioned.filter((c) => c.caution.length <= 80).map((c) => c.id).join(', '));

// A candidate with no stated openness evidence is the one most at risk of being written up as keener
// than the record supports, so the caution has to say so.
const inferredOnly = CANDIDATES.filter((c) => !c.openness_evidence.some((e) => e.kind === EVIDENCE_KINDS.STATED));
check('any candidate with inferred-only openness says so in its caution',
  f(inferredOnly.every((c) => /stated/i.test(c.caution) || /inferred/i.test(c.caution)),
    !inferredOnly.every((c) => /stated/i.test(c.caution) || /inferred/i.test(c.caution))),
  inferredOnly.map((c) => c.id).join(', ') || 'none such');

// ---------------------------------------------------------------------------------------------------
console.log('\n-- frozen-ness --');

check('CANDIDATES is frozen',
  f(Object.isFrozen(CANDIDATES), !Object.isFrozen(CANDIDATES)));

check('each candidate object is frozen, so a caution cannot be dropped in place',
  f(CANDIDATES.every((c) => Object.isFrozen(c)), !CANDIDATES.every((c) => Object.isFrozen(c))));

check('nested quote objects are frozen too',
  f(CANDIDATES.every((c) => c.real_quotes.every((q) => Object.isFrozen(q))),
    !CANDIDATES.every((c) => c.real_quotes.every((q) => Object.isFrozen(q)))));

// ---------------------------------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (FAULT) {
  console.log(pass === 0
    ? '--fail-once: correct, zero assertions passed under the injected fault.'
    : `--fail-once: ${pass} assertion(s) STILL PASSED. Those predicates do not bite; fix them.`);
}
process.exit(fail && !FAULT ? 1 : 0);
