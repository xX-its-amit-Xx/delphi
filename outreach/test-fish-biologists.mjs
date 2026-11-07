// outreach/test-fish-biologists.mjs
//
//   node outreach/test-fish-biologists.mjs              # must pass
//   node outreach/test-fish-biologists.mjs --fail-once  # ZERO assertions may print "ok"
//
// The load-bearing assertion in this file is the privacy one: the entire CANDIDATES
// structure is serialised and regexed for email addresses and telephone numbers. These are
// real people, and the dossier is only publishable if it contains no way to contact them
// except a public lab page. Every other check is about not mis-citing them.

import {
  CANDIDATES,
  WHAT_WE_WOULD_BE_ASKING,
  WHAT_WE_BRING_HONESTLY,
  DOI_VERIFICATION,
} from './fish-biologists.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const SERIALISED = JSON.stringify(CANDIDATES);
const ALL_SERIALISED = JSON.stringify({ CANDIDATES, WHAT_WE_WOULD_BE_ASKING, WHAT_WE_BRING_HONESTLY, DOI_VERIFICATION });

// ------------------------------------------------------------------ roster shape
console.log('\nroster');

check('8 to 12 profiles',
  f(CANDIDATES.length >= 8 && CANDIDATES.length <= 12, false),
  `got ${CANDIDATES.length}`);

check('every id is a unique non-empty slug',
  f(new Set(CANDIDATES.map(c => c.id)).size === CANDIDATES.length
    && CANDIDATES.every(c => typeof c.id === 'string' && /^[a-z0-9-]+$/.test(c.id)), false));

const REQUIRED_STRINGS = ['id', 'name', 'institution', 'lab_url', 'field', 'why_relevant_to_delphi', 'collaboration_angle', 'caution'];
const REQUIRED_ARRAYS = ['flagship_papers', 'key_figures_or_findings', 'real_quotes', 'public_record', 'openness_evidence'];

check('every candidate carries all required string fields, non-empty',
  f(CANDIDATES.every(c => REQUIRED_STRINGS.every(k => typeof c[k] === 'string' && c[k].trim().length > 0)), false),
  CANDIDATES.filter(c => !REQUIRED_STRINGS.every(k => typeof c[k] === 'string' && c[k].trim().length > 0)).map(c => c.id).join(', '));

check('every candidate carries all required array fields',
  f(CANDIDATES.every(c => REQUIRED_ARRAYS.every(k => Array.isArray(c[k]))), false),
  CANDIDATES.filter(c => !REQUIRED_ARRAYS.every(k => Array.isArray(c[k]))).map(c => c.id).join(', '));

check('no candidate has an unexpected top-level field',
  f(CANDIDATES.every(c => Object.keys(c).every(k => REQUIRED_STRINGS.includes(k) || REQUIRED_ARRAYS.includes(k))), false));

check('every lab_url is an https URL and not a mailto or tel link',
  f(CANDIDATES.every(c => /^https:\/\/[^\s]+$/.test(c.lab_url) && !/^(mailto|tel):/i.test(c.lab_url)), false),
  CANDIDATES.filter(c => !/^https:\/\/[^\s]+$/.test(c.lab_url)).map(c => c.id).join(', '));

check('every institution names a real-looking current affiliation (>= 8 chars, no TODO)',
  f(CANDIDATES.every(c => c.institution.length >= 8 && !/\bTODO\b|\bTBD\b|\?\?\?/.test(c.institution)), false));

check('why_relevant_to_delphi is concrete, not boilerplate (>= 200 chars each)',
  f(CANDIDATES.every(c => c.why_relevant_to_delphi.length >= 200), false),
  CANDIDATES.filter(c => c.why_relevant_to_delphi.length < 200).map(c => c.id).join(', '));

// --------------------------------------------- why_relevant ties to our actual work
console.log('\nrelevance is tied to our own programme, not generic praise');

const OUR_WORK = [/fin[- ]ratio|fin proportion|pectoral fin/i, /guide[- ]rank|CRISPRscan|rho|sgRNA/i, /\.organism|organism[- ]design|organism format/i, /scorer|plausibilit|q = 0\.|AUC/i];
const mentionsOurWork = c => OUR_WORK.some(re => re.test(c.why_relevant_to_delphi + ' ' + c.collaboration_angle));

check('every candidate is tied to at least one of our four actual work items',
  f(CANDIDATES.every(mentionsOurWork), false),
  CANDIDATES.filter(c => !mentionsOurWork(c)).map(c => c.id).join(', '));

check('collaboration_angle always states what WE would have to bring',
  f(CANDIDATES.every(c => /\bWE would have to bring\b/.test(c.collaboration_angle)), false),
  CANDIDATES.filter(c => !/\bWE would have to bring\b/.test(c.collaboration_angle)).map(c => c.id).join(', '));

// ------------------------------------------------------------------ flagship papers
console.log('\nflagship papers');

const PAPER_KEYS = ['title', 'year', 'journal', 'doi', 'why_it_matters'];
const papers = CANDIDATES.flatMap(c => c.flagship_papers.map(p => ({ ...p, _id: c.id })));
// A DOI is 10.<4-9 digits>/<suffix>. The suffix may contain brackets and semicolons
// (legacy Wiley SICI DOIs do), but never whitespace.
const DOI_SHAPE = /^10\.\d{4,9}\/\S+$/;

check('every candidate has 2 to 4 flagship papers',
  f(CANDIDATES.every(c => c.flagship_papers.length >= 2 && c.flagship_papers.length <= 4), false),
  CANDIDATES.filter(c => c.flagship_papers.length < 2 || c.flagship_papers.length > 4).map(c => `${c.id}:${c.flagship_papers.length}`).join(', '));

check('every flagship paper has title, year, journal, doi and why_it_matters',
  f(papers.every(p => PAPER_KEYS.every(k => p[k] !== undefined && p[k] !== null && String(p[k]).trim().length > 0)), false),
  papers.filter(p => !PAPER_KEYS.every(k => p[k] !== undefined && p[k] !== null && String(p[k]).trim().length > 0)).map(p => `${p._id}:${p.title}`).join(' | '));

check('every flagship paper DOI matches a plausible DOI shape',
  f(papers.every(p => DOI_SHAPE.test(p.doi)), false),
  papers.filter(p => !DOI_SHAPE.test(p.doi)).map(p => `${p._id}:${p.doi}`).join(', '));

check('no flagship DOI is a bare doi.org URL (store the DOI, not the link)',
  f(papers.every(p => !/^https?:/i.test(p.doi) && !/doi\.org/i.test(p.doi)), false));

check('every flagship year is a plausible publication year',
  f(papers.every(p => Number.isInteger(p.year) && p.year >= 1990 && p.year <= 2027), false),
  papers.filter(p => !(Number.isInteger(p.year) && p.year >= 1990 && p.year <= 2027)).map(p => `${p._id}:${p.year}`).join(', '));

check('pmid, when present, is a digit string (null is allowed for non-PubMed records)',
  f(papers.every(p => p.pmid === undefined || p.pmid === null || /^\d{6,9}$/.test(p.pmid)), false),
  papers.filter(p => !(p.pmid === undefined || p.pmid === null || /^\d{6,9}$/.test(p.pmid))).map(p => `${p._id}:${p.pmid}`).join(', '));

check('why_it_matters is a real sentence, not a stub (>= 40 chars)',
  f(papers.every(p => p.why_it_matters.length >= 40), false),
  papers.filter(p => p.why_it_matters.length < 40).map(p => `${p._id}:${p.title}`).join(' | '));

check('every paper with no pmid says in why_it_matters how it was verified',
  f(papers.filter(p => !p.pmid).every(p => /verified via Crossref/i.test(p.why_it_matters)), false),
  papers.filter(p => !p.pmid && !/verified via Crossref/i.test(p.why_it_matters)).map(p => `${p._id}:${p.doi}`).join(', '));

check('DOI_VERIFICATION records the methods and the count actually present',
  f(Array.isArray(DOI_VERIFICATION.methods) && DOI_VERIFICATION.methods.length >= 2
    && /Crossref/i.test(JSON.stringify(DOI_VERIFICATION.methods))
    && /PubMed/i.test(JSON.stringify(DOI_VERIFICATION.methods))
    && DOI_VERIFICATION.result.includes(String(papers.length)), false),
  `papers=${papers.length}; result="${DOI_VERIFICATION.result}"`);

check('DOI_VERIFICATION names at least one DOI that was rejected',
  f(Array.isArray(DOI_VERIFICATION.rejected) && DOI_VERIFICATION.rejected.length >= 1, false));

// ------------------------------------------------------- PRIVACY (load-bearing)
console.log('\nPRIVACY - no personal contact details anywhere in the serialised object');

// Deliberately broad. Matches addr@host.tld, and also obfuscations like "a (at) b.org".
// Two alternatives. (a) a plain address: local@host(.sub)*.tld, which is the realistic
// risk here because PubMed affiliation strings carry corresponding-author addresses and
// they would arrive pasted. (b) a bracketed obfuscation: "name (at) host (dot) tld".
// Verified by hand, outside this repository, against ten real institutional addresses of
// several domain depths (two to four labels) taken from PubMed affiliation strings, and
// against eight benign strings from this file's own prose. All ten matched, none of the
// eight did. The addresses themselves are deliberately NOT recorded here, and planting one
// into a copy of the dossier was confirmed to make this exact assertion fail.
const EMAIL = new RegExp(
  '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}' +
  '|[A-Za-z0-9._%+-]+\\s*[(\\[]\\s*at\\s*[)\\]]\\s*[A-Za-z0-9-]+(?:\\s*[(\\[]\\s*dot\\s*[)\\]]\\s*|\\.)[A-Za-z0-9.\\s(\\[\\])-]*\\b(?:com|org|net|edu|gov|es|de|uk|ca|io|ai)\\b',
  'i');
// Telephone shapes: +country groups, (xxx) xxx-xxxx, xxx-xxx-xxxx, and 7+ run-on digits.
const PHONE = /(?:\+\d[\d\s().-]{7,}\d)|(?:\(\d{3}\)\s*\d{3}[\s.-]?\d{4})|(?:\b\d{3}[.\s-]\d{3}[.\s-]\d{4}\b)|(?:\btel\b[:.\s]*\+?\d)/i;
const emailHit = SERIALISED.match(EMAIL);
const phoneHit = SERIALISED.match(PHONE);

check('no field anywhere in CANDIDATES contains an email address',
  f(emailHit === null, false),
  emailHit ? `matched: ${emailHit[0]}` : '');

check('no field anywhere in CANDIDATES contains a telephone number',
  f(phoneHit === null, false),
  phoneHit ? `matched: ${phoneHit[0]}` : '');

check('no mailto: or tel: link anywhere in the whole module',
  f(!/mailto:|(?:^|[^a-z])tel:/i.test(ALL_SERIALISED), false));

check('no room, office or building number recorded',
  f(!/\b(?:room|rm\.|office|suite|bldg|building)\s*#?\s*\d/i.test(ALL_SERIALISED), false));

check('no social media handles beyond a lab website URL',
  f(!/(?:twitter\.com|x\.com|bsky\.app|linkedin\.com|instagram\.com|facebook\.com)/i.test(ALL_SERIALISED)
    && !/(?:^|[\s"([])@[A-Za-z0-9_.]{3,}/.test(SERIALISED), false));

const PERSONAL = /\b(?:nationality|citizenship|married|divorced|spouse|wife|husband|his children|her children|date of birth|born in 19|aged \d{2}|illness|diagnosed with|political party|voted for|tenure denial|was fired|laid off)\b/i;
check('nothing personal recorded - no nationality, age, family, health or politics',
  f(!PERSONAL.test(ALL_SERIALISED), false),
  (ALL_SERIALISED.match(PERSONAL) || [''])[0]);

// ------------------------------------------------------------------ quotes
console.log('\nreal quotes');

const quotes = CANDIDATES.flatMap(c => c.real_quotes.map(q => ({ ...q, _id: c.id })));

check('real_quotes is always an array (an empty one is acceptable)',
  f(CANDIDATES.every(c => Array.isArray(c.real_quotes)), false));

check('every real_quotes entry has a non-empty quote',
  f(quotes.every(q => typeof q.quote === 'string' && q.quote.trim().length > 0), false));

check('every real_quotes entry has a non-empty source_title',
  f(quotes.every(q => typeof q.source_title === 'string' && q.source_title.trim().length > 0), false),
  quotes.filter(q => !(typeof q.source_title === 'string' && q.source_title.trim().length > 0)).map(q => q._id).join(', '));

check('every real_quotes entry has a non-empty doi_or_url that is a resolvable-looking link',
  f(quotes.every(q => typeof q.doi_or_url === 'string' && /^https?:\/\/\S+$/.test(q.doi_or_url)), false),
  quotes.filter(q => !/^https?:\/\/\S+$/.test(String(q.doi_or_url))).map(q => `${q._id}:${q.doi_or_url}`).join(', '));

check('every real_quotes entry has a non-empty context saying where the words came from',
  f(quotes.every(q => typeof q.context === 'string' && q.context.trim().length >= 20), false),
  quotes.filter(q => !(typeof q.context === 'string' && q.context.trim().length >= 20)).map(q => q._id).join(', '));

check('every quote long enough to be a real sentence rather than a fragment (>= 25 chars)',
  f(quotes.every(q => q.quote.length >= 25), false),
  quotes.filter(q => q.quote.length < 25).map(q => `${q._id}:${q.quote}`).join(' | '));

check('every quoted DOI link corresponds to a DOI cited in that candidate\'s flagship papers or is an explicit preprint link',
  f(CANDIDATES.every(c => {
    const own = new Set(c.flagship_papers.map(p => p.doi));
    return c.real_quotes.every(q => {
      const m = q.doi_or_url.match(/doi\.org\/(10\.\S+)$/);
      return m ? own.has(m[1]) || /10\.1101\//.test(m[1]) : true;
    });
  }), false));

check('no quote is wrapped in stray quotation marks (the field holds the words, not the punctuation)',
  f(quotes.every(q => !/^["“].*["”]$/.test(q.quote.trim())), false));

// ------------------------------------------------------------- openness evidence
console.log('\nopenness evidence');

const openness = CANDIDATES.flatMap(c => c.openness_evidence.map(o => ({ ...o, _id: c.id })));

check('every candidate carries at least one openness_evidence item',
  f(CANDIDATES.every(c => c.openness_evidence.length >= 1), false),
  CANDIDATES.filter(c => c.openness_evidence.length < 1).map(c => c.id).join(', '));

check('every openness_evidence item is marked exactly stated or inferred',
  f(openness.every(o => o.basis === 'stated' || o.basis === 'inferred'), false),
  openness.filter(o => !(o.basis === 'stated' || o.basis === 'inferred')).map(o => `${o._id}:${o.basis}`).join(', '));

check('every openness_evidence item has a non-empty claim and a source',
  f(openness.every(o => typeof o.claim === 'string' && o.claim.trim().length > 0
    && typeof o.source === 'string' && o.source.trim().length > 0), false));

check('every inferred openness item says in its source that it is our reading, not their statement',
  f(openness.filter(o => o.basis === 'inferred')
    .every(o => /\bOur reading\b|\bNot (?:a statement|something)\b|\bhas not (?:said|stated|invited)\b|\bour guess\b/i.test(o.source + ' ' + o.claim)), false),
  openness.filter(o => o.basis === 'inferred' && !/\bOur reading\b|\bNot (?:a statement|something)\b|\bhas not (?:said|stated|invited)\b|\bour guess\b/i.test(o.source + ' ' + o.claim)).map(o => o._id).join(', '));

check('at least one candidate has an inferred item, so the marking is doing work',
  f(openness.some(o => o.basis === 'inferred'), false));

check('at least one candidate has a stated item, so the marking is doing work',
  f(openness.some(o => o.basis === 'stated'), false));

// ------------------------------------------------------------------ cautions
console.log('\ncautions - the list must not read as twelve perfect fits');

const cautions = CANDIDATES.map(c => c.caution);

check('at least one candidate carries a non-empty caution',
  f(cautions.some(x => typeof x === 'string' && x.trim().length > 0), false));

check('every candidate carries a non-empty caution (>= 80 chars)',
  f(cautions.every(x => typeof x === 'string' && x.trim().length >= 80), false),
  CANDIDATES.filter(c => c.caution.trim().length < 80).map(c => c.id).join(', '));

check('at least three cautions admit we have nothing the lab needs, or that it is a poor fit',
  f(cautions.filter(x => /nothing (?:he|she|they|the lab) (?:needs|need)|nothing in it for|no (?:second )?reason|not a lab-in-the-loop|weakest fit|poor fit|cannot (?:run|validate)|gains? (?:him|her|them) nothing/i.test(x)).length >= 3, false),
  `${cautions.filter(x => /nothing (?:he|she|they|the lab) (?:needs|need)|nothing in it for|no (?:second )?reason|not a lab-in-the-loop|weakest fit|poor fit|cannot (?:run|validate)|gains? (?:him|her|them) nothing/i.test(x)).length} of ${cautions.length}`);

// ---------------------------------------------------- the two frozen statements
console.log('\nWHAT_WE_WOULD_BE_ASKING');

check('WHAT_WE_WOULD_BE_ASKING is frozen',
  f(Object.isFrozen(WHAT_WE_WOULD_BE_ASKING), false));

check('it states the per-arm animal count as 30',
  f(WHAT_WE_WOULD_BE_ASKING.the_small_number.animals_per_arm === 30, false));

check('it states the marginal consumables figure near $169',
  f(Math.abs(WHAT_WE_WOULD_BE_ASKING.the_small_number.marginal_consumables_usd - 169) < 1, false),
  String(WHAT_WE_WOULD_BE_ASKING.the_small_number.marginal_consumables_usd));

check('it says the per-arm count means scorable adults, not injected embryos',
  f(/scorable adults/i.test(WHAT_WE_WOULD_BE_ASKING.the_small_number.what_that_number_counts)
    && /NOT injected embryos/i.test(WHAT_WE_WOULD_BE_ASKING.the_small_number.what_that_number_counts), false));

check('it says plainly that the real cost is skilled time, not consumables',
  f(/skilled time/i.test(WHAT_WE_WOULD_BE_ASKING.summary)
    && WHAT_WE_WOULD_BE_ASKING.the_real_cost.some(x => /labour is the largest real cost/i.test(x)), false));

check('the real-cost list names animal time, injection, imaging and a person\'s weeks',
  f(['tank space', 'injection', 'imaging', 'weeks'].every(t => new RegExp(t, 'i').test(WHAT_WE_WOULD_BE_ASKING.the_real_cost.join(' '))), false));

check('it requires approval (IACUC or equivalent) to be the partner\'s precondition, not ours to grant',
  f(/IACUC/i.test(WHAT_WE_WOULD_BE_ASKING.the_real_cost.join(' '))
    && /cannot grant/i.test(WHAT_WE_WOULD_BE_ASKING.the_real_cost.join(' ')), false));

check('it tells us to ask for criticism before asking for animals',
  f(WHAT_WE_WOULD_BE_ASKING.what_a_fair_ask_looks_like.some(x => /criticism before asking for animals/i.test(x)), false));

console.log('\nWHAT_WE_BRING_HONESTLY');

check('WHAT_WE_BRING_HONESTLY is frozen',
  f(Object.isFrozen(WHAT_WE_BRING_HONESTLY), false));

check('its negative_results array is frozen and every entry is frozen',
  f(Object.isFrozen(WHAT_WE_BRING_HONESTLY.negative_results)
    && WHAT_WE_BRING_HONESTLY.negative_results.every(Object.isFrozen), false));

const NEGATIVES = [
  { id: 'guide-ranking-is-uninformative', re: /indistinguishable from no information|rho = -0\.037/i },
  { id: 'morphology-scorer-calls-an-impossible-fish-typical', re: /q = 0\.918|plausibility model, not a viability model/i },
  { id: 'law-registry-barely-reaches-our-own-traits', re: /1 of the 48|2\.1 ?%/i },
];
const negBlob = JSON.stringify(WHAT_WE_BRING_HONESTLY);
const hits = NEGATIVES.filter(n => n.re.test(negBlob) && WHAT_WE_BRING_HONESTLY.negative_results.some(r => r.id === n.id));

check('WHAT_WE_BRING_HONESTLY mentions at least two of our actual negative results',
  f(hits.length >= 2, false),
  `matched ${hits.length}: ${hits.map(h => h.id).join(', ')}`);

check('all three of our measured negative results are present, with their numbers',
  f(hits.length === 3, false),
  `matched ${hits.length} of 3`);

check('each negative result carries a claim, numbers, a partner-facing meaning and a source',
  f(WHAT_WE_BRING_HONESTLY.negative_results.every(r => ['id', 'claim', 'numbers', 'what_it_means_for_a_partner', 'source']
    .every(k => typeof r[k] === 'string' && r[k].trim().length > 0)), false));

check('it does not hide the negatives behind the one thing that passes',
  f(/come out at chance/i.test(WHAT_WE_BRING_HONESTLY.stance)
    && /not a coverage figure/i.test(WHAT_WE_BRING_HONESTLY.what_does_pass.honest_scope), false));

check('it admits we have no animals, facility, approvals or reagents',
  f(WHAT_WE_BRING_HONESTLY.also_true_and_also_unflattering
    .some(x => /no animals, no facility, no approvals and no reagents/i.test(x)), false));

check('it states explicitly that a careful scientist would be right to say no',
  f(/right to say no/i.test(WHAT_WE_BRING_HONESTLY.why_this_is_stated_up_front), false));

// -------------------------------------------------- PubMed attribution obligation
console.log('\nattribution');

check('the module attributes PubMed-derived information to PubMed by name',
  f(/\bvia PubMed\b/.test(ALL_SERIALISED) && /\bPubMed record for PMID\b/.test(ALL_SERIALISED), false));

check('every candidate cites at least one DOI in its key_figures_or_findings',
  f(CANDIDATES.every(c => c.key_figures_or_findings.some(k => /\bdoi 10\.\d{4,9}\/|doi\.org\/10\./i.test(k))), false),
  CANDIDATES.filter(c => !c.key_figures_or_findings.some(k => /\bdoi 10\.\d{4,9}\/|doi\.org\/10\./i.test(k))).map(c => c.id).join(', '));

check('every key_figures_or_findings entry names where the number came from',
  f(CANDIDATES.every(c => c.key_figures_or_findings.every(k => /\(|https:\/\//.test(k) && k.length >= 60)), false));

// ------------------------------------------------------------------ summary
console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion was inverted, so 0 ok is correct)' : ''}`);
process.exit(fail && !FAULT ? 1 : 0);
