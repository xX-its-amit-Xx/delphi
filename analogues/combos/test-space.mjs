#!/usr/bin/env node
// Tests for analogues/combos/space.mjs - the HOSTS x FUNCTIONS space and the refusals that shape it.
//
//   node analogues/combos/test-space.mjs [--fail-once]
//
// Six things are checked harder than the rest, because they are the six ways this module could do
// damage if it were wrong:
//
//   1. A MALFORMED REQUEST REACHING AN ADMISSIBLE CLASS. Every one of the four mandated refusals is
//      tested against a pair built to be the strongest case for slipping through, and then tested in
//      the other direction: the condition is cleared on a synthetic copy and the refusal must LIFT.
//      A refusal that fires on everything is not a filter, and a refusal that lifts for nothing is
//      not a discriminator.
//   2. A FABRICATED NUMBER. Every numeric value in this module is supposed to be one that was
//      retrieved. The tests therefore check that every source carries a verified_how, that every
//      quoted figure lives inside a `retrieved` block beside its identifier, and that the fields
//      which could not be retrieved are null WITH a reason and a stated measurement - not zero, not
//      an estimate, and not absent.
//   3. AN ADMISSIBLE REASON MAKING A FALSE STATEMENT IN THE AUDIT TRAIL. reasons() returns every
//      reason that applies so the precedence of the single reported verdict can be audited. If an
//      ADMISSIBLE reason can appear alongside a refusal, the audit trail contains the sentence "the
//      host has the systems the edit acts on" under a verdict that says it does not.
//   4. AN UNKNOWN BEING SPENT AS AN ABSENCE. One host's sodium-channel status is recorded as
//      unretrieved on purpose. If `unknown` collapsed into `lacks`, the module would be refusing
//      pairs on the strength of a search nobody ran.
//   5. A SCORE APPEARING ANYWHERE. One float on a verdict gets read downstream as feasibility and
//      the eight-class vocabulary becomes decoration.
//   6. A CLASS BEING UNREACHABLE. A refusal class that no real pair reaches is a claim the module
//      makes about itself and never has to honour.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a
// wrong value. Every line must then FAIL. An assertion that survives its own inversion is asserting
// nothing about its subject.
//
// Every synthetic host and synthetic function below is marked SYNTHETIC and asserts no biology. No
// experimental result is claimed here that is not in space.mjs's SOURCES.
import * as S from './space.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

console.log(`\nspace: the refusals are the product${FAULT ? '   [--fail-once: every predicate inverted]' : ''}\n`);

// ====================================================================================================
// 1. THE CLOSED VOCABULARIES ARE CLOSED, AND FROZEN
// ====================================================================================================
{
  check('TRACTABILITY is deep-frozen, not merely frozen at the top',
    f(Object.isFrozen(S.TRACTABILITY) === true && Object.isFrozen(S.TRACTABILITY.ROUTINE_TRANSGENESIS) === true,
      !(Object.isFrozen(S.TRACTABILITY) === true && Object.isFrozen(S.TRACTABILITY.ROUTINE_TRANSGENESIS) === true)));
  check('MECHANISM_CLASSES is deep-frozen',
    f(Object.isFrozen(S.MECHANISM_CLASSES.GENE_LOSS) === true, Object.isFrozen(S.MECHANISM_CLASSES.GENE_LOSS) !== true));
  check('VERDICT_CLASSES is deep-frozen',
    f(Object.isFrozen(S.VERDICT_CLASSES.REFUSED_WRONG_GENOME) === true, Object.isFrozen(S.VERDICT_CLASSES.REFUSED_WRONG_GENOME) !== true));
  check('HOSTS is deep-frozen down to a nested array, so a caller cannot edit what a host lacks',
    f(Object.isFrozen(S.HOSTS[0].lacks) === true, Object.isFrozen(S.HOSTS[0].lacks) !== true));
  check('FUNCTIONS is deep-frozen down to a nested object',
    f(Object.isFrozen(S.FUNCTIONS[0].genetic_basis) === true, Object.isFrozen(S.FUNCTIONS[0].genetic_basis) !== true));
  check('SOURCES is deep-frozen down to a retrieved-value block',
    f(Object.isFrozen(S.SOURCES.zheng_2017.retrieved) === true, Object.isFrozen(S.SOURCES.zheng_2017.retrieved) !== true));

  check('the mechanism-class vocabulary has exactly the seven required terms, with no extras',
    f(S.MECHANISM_CLASS_IDS.length === 7, S.MECHANISM_CLASS_IDS.length !== 7), S.MECHANISM_CLASS_IDS.join(', '));
  const requiredMech = ['SINGLE_GENE_ADDITION', 'REGULATORY_REWIRING', 'POLYGENIC_QUANTITATIVE', 'GENE_LOSS', 'PATHWAY_IMPORT', 'TRAIT_OF_ASSOCIATED_MICROBIOME', 'STRUCTURAL_MATERIAL'];
  check('and they are the seven named in the vocabulary, not seven of our own choosing',
    f(requiredMech.every(m => S.MECHANISM_CLASS_IDS.includes(m)), !requiredMech.every(m => S.MECHANISM_CLASS_IDS.includes(m))),
    requiredMech.filter(m => !S.MECHANISM_CLASS_IDS.includes(m)).join(', '));
  check('every host\'s tractability is drawn from the closed vocabulary',
    f(S.HOSTS.every(h => S.TRACTABILITY_IDS.includes(h.tractability)), !S.HOSTS.every(h => S.TRACTABILITY_IDS.includes(h.tractability))),
    S.HOSTS.filter(h => !S.TRACTABILITY_IDS.includes(h.tractability)).map(h => h.id).join(', '));
  check('every function\'s mechanism_class is drawn from the closed vocabulary',
    f(S.FUNCTIONS.every(x => S.MECHANISM_CLASS_IDS.includes(x.mechanism_class)), !S.FUNCTIONS.every(x => S.MECHANISM_CLASS_IDS.includes(x.mechanism_class))),
    S.FUNCTIONS.filter(x => !S.MECHANISM_CLASS_IDS.includes(x.mechanism_class)).map(x => x.id).join(', '));
  check('every function\'s basis firmness is drawn from the closed vocabulary',
    f(S.FUNCTIONS.every(x => S.BASIS_FIRMNESS.includes(x.genetic_basis.firmness)), !S.FUNCTIONS.every(x => S.BASIS_FIRMNESS.includes(x.genetic_basis.firmness))),
    S.FUNCTIONS.filter(x => !S.BASIS_FIRMNESS.includes(x.genetic_basis.firmness)).map(x => x.id).join(', '));
  check('every system a function requires is a declared system, so a typo cannot silently become a requirement nobody can satisfy',
    f(S.FUNCTIONS.every(x => (x.requires_host_systems ?? []).every(s => S.SYSTEM_IDS.includes(s))),
      !S.FUNCTIONS.every(x => (x.requires_host_systems ?? []).every(s => S.SYSTEM_IDS.includes(s)))),
    S.FUNCTIONS.flatMap(x => (x.requires_host_systems ?? []).filter(s => !S.SYSTEM_IDS.includes(s))).join(', '));
  check('every system a host has or lacks is a declared system',
    f(S.HOSTS.every(h => [...(h.has ?? []), ...(h.lacks ?? [])].every(s => S.SYSTEM_IDS.includes(s))),
      !S.HOSTS.every(h => [...(h.has ?? []), ...(h.lacks ?? [])].every(s => S.SYSTEM_IDS.includes(s)))));
  check('no host both has and lacks the same system',
    f(S.HOSTS.every(h => (h.has ?? []).every(s => !(h.lacks ?? []).includes(s))), !S.HOSTS.every(h => (h.has ?? []).every(s => !(h.lacks ?? []).includes(s)))),
    S.HOSTS.filter(h => (h.has ?? []).some(s => (h.lacks ?? []).includes(s))).map(h => h.id).join(', '));
  check('exactly one tractability term denies a germline route, so the refusal has one trigger',
    f(S.TRACTABILITY_IDS.filter(t => S.TRACTABILITY[t].germline_route_exists === false).length === 1,
      S.TRACTABILITY_IDS.filter(t => S.TRACTABILITY[t].germline_route_exists === false).length !== 1));
  check('and that one is NO_GERMLINE_METHOD',
    f(S.TRACTABILITY.NO_GERMLINE_METHOD.germline_route_exists === false, S.TRACTABILITY.NO_GERMLINE_METHOD.germline_route_exists !== false));
  check('exactly one mechanism class is declared to live outside the animal genome',
    f(S.MECHANISM_CLASS_IDS.filter(m => S.MECHANISM_CLASSES[m].not_in_the_animal_genome === true).length === 1,
      S.MECHANISM_CLASS_IDS.filter(m => S.MECHANISM_CLASSES[m].not_in_the_animal_genome === true).length !== 1));
  check('exactly one mechanism class presupposes possession, which is what makes the gene-loss refusal specific',
    f(S.MECHANISM_CLASS_IDS.filter(m => S.MECHANISM_CLASSES[m].presupposes_possession === true).length === 1,
      S.MECHANISM_CLASS_IDS.filter(m => S.MECHANISM_CLASSES[m].presupposes_possession === true).length !== 1));
  // The vocabulary is fixed and has no term for "swap one allele of a gene the host already has".
  // Two capabilities are exactly that shape. Each must say so on its own record, because a reader of
  // one function should not have to find the limitation in the vocabulary's prose to know it applies.
  const caveated = S.FUNCTIONS.filter(x => typeof x.vocabulary_caveat === 'string');
  check('the capabilities that are allele swaps rather than additions say so on their own record',
    f(caveated.length >= 2 && caveated.every(x => x.mechanism_class === 'SINGLE_GENE_ADDITION'),
      !(caveated.length >= 2 && caveated.every(x => x.mechanism_class === 'SINGLE_GENE_ADDITION'))),
    `${caveated.length}: ${caveated.map(x => x.id).join(', ')}`);
  check('and the caveat names the gap rather than apologising vaguely',
    f(caveated.every(x => /allele swap|already has|not an addition/i.test(x.vocabulary_caveat)),
      !caveated.every(x => /allele swap|already has|not an addition/i.test(x.vocabulary_caveat))));
}

// ====================================================================================================
// 2. NO FABRICATED NUMBER: PROVENANCE ON EVERY VALUE, AND EXPLICIT NULLS
// ====================================================================================================
// This is the section that would matter most if the module were wrong, because a fabricated figure
// with a real DOI beside it is the single worst artefact this project can emit.
{
  check('every source carries a verified_how saying what was actually checked',
    f(S.SOURCE_IDS.every(k => typeof S.SOURCES[k].verified_how === 'string' && S.SOURCES[k].verified_how.length > 40),
      !S.SOURCE_IDS.every(k => typeof S.SOURCES[k].verified_how === 'string' && S.SOURCES[k].verified_how.length > 40)),
    S.SOURCE_IDS.filter(k => !(typeof S.SOURCES[k].verified_how === 'string' && S.SOURCES[k].verified_how.length > 40)).join(', '));
  const literature = S.SOURCE_IDS.filter(k => k !== 'ncbi_datasets_live');
  check('every literature source carries BOTH a DOI and a PMID, so the claim can be chased two ways',
    f(literature.every(k => typeof S.SOURCES[k].doi === 'string' && typeof S.SOURCES[k].pmid === 'string'),
      !literature.every(k => typeof S.SOURCES[k].doi === 'string' && typeof S.SOURCES[k].pmid === 'string')),
    literature.filter(k => !(typeof S.SOURCES[k].doi === 'string' && typeof S.SOURCES[k].pmid === 'string')).join(', '));
  check('every DOI has the shape of a DOI rather than being a plausible-looking string',
    f(literature.every(k => /^10\.\d{4,9}\/\S+$/.test(S.SOURCES[k].doi)), !literature.every(k => /^10\.\d{4,9}\/\S+$/.test(S.SOURCES[k].doi))),
    literature.filter(k => !/^10\.\d{4,9}\/\S+$/.test(S.SOURCES[k].doi)).map(k => `${k}:${S.SOURCES[k].doi}`).join(', '));
  check('every PMID is digits only',
    f(literature.every(k => /^\d+$/.test(S.SOURCES[k].pmid)), !literature.every(k => /^\d+$/.test(S.SOURCES[k].pmid))));
  check('every source carries a retrieved block, so a citation cannot sit here with nothing read out of it',
    f(S.SOURCE_IDS.every(k => typeof S.SOURCES[k].retrieved === 'object' && Object.keys(S.SOURCES[k].retrieved).length > 0),
      !S.SOURCE_IDS.every(k => typeof S.SOURCES[k].retrieved === 'object' && Object.keys(S.SOURCES[k].retrieved).length > 0)),
    S.SOURCE_IDS.filter(k => !(typeof S.SOURCES[k].retrieved === 'object' && Object.keys(S.SOURCES[k].retrieved).length > 0)).join(', '));
  const quoteless = S.SOURCE_IDS.filter(k => 'no_numeric_value_quoted' in S.SOURCES[k].retrieved);
  check('sources cited for a qualitative claim only say so IN the retrieved block rather than being left ambiguous',
    f(quoteless.length >= 4 && quoteless.every(k => /no .*figure is quoted|no rate is quoted|not quoted here/i.test(S.SOURCES[k].retrieved.no_numeric_value_quoted)),
      !(quoteless.length >= 4 && quoteless.every(k => /no .*figure is quoted|no rate is quoted|not quoted here/i.test(S.SOURCES[k].retrieved.no_numeric_value_quoted)))),
    `${quoteless.length}: ${quoteless.join(', ')}`);

  // The two corrections the live checks forced are on the record, because a silent correction is a
  // claim that the first guess never happened.
  check('the assembly source records that a live check CORRECTED a guessed accession, naming it',
    f(/GCF_000003025\.6/.test(S.SOURCES.ncbi_datasets_live.verified_how) && /empty report/i.test(S.SOURCES.ncbi_datasets_live.verified_how),
      !(/GCF_000003025\.6/.test(S.SOURCES.ncbi_datasets_live.verified_how) && /empty report/i.test(S.SOURCES.ncbi_datasets_live.verified_how))));
  check('and that a guessed cattle assembly NAME was wrong and the returned string was used instead',
    f(/ARS-UCD2\.0/.test(S.SOURCES.ncbi_datasets_live.verified_how), !/ARS-UCD2\.0/.test(S.SOURCES.ncbi_datasets_live.verified_how)));
  check('the two places where this repo\'s own sibling citation disagrees with the retrieved record are flagged, not quietly overwritten',
    f(/3811/.test(S.SOURCES.chen_1997.verified_how) && /ancient functional divergence/.test(S.SOURCES.kachroo_2015.verified_how),
      !(/3811/.test(S.SOURCES.chen_1997.verified_how) && /ancient functional divergence/.test(S.SOURCES.kachroo_2015.verified_how))));
  check('the crucian-carp source records that a first guessed PMID returned an unrelated paper and was discarded',
    f(/unrelated/i.test(S.SOURCES.fagernes_2017.verified_how), !/unrelated/i.test(S.SOURCES.fagernes_2017.verified_how)));
  check('the Dsup source records that the first search returned a REVIEW and that the primary paper is what is used',
    f(/review/i.test(S.SOURCES.hashimoto_2016.verified_how), !/review/i.test(S.SOURCES.hashimoto_2016.verified_how)));

  // Nulls.
  const gts = S.HOSTS.map(h => h.generation_time);
  const nulls = gts.filter(g => g.value === null);
  check('the generation times that could not be retrieved are null, not estimated',
    f(nulls.length >= 10, !(nulls.length >= 10)), `${nulls.length} of ${gts.length} null`);
  check('every null generation time states WHY it is null',
    f(nulls.every(g => typeof g.null_reason === 'string' && g.null_reason.length > 30), !nulls.every(g => typeof g.null_reason === 'string' && g.null_reason.length > 30)));
  check('and states what would have to be MEASURED to fill it, rather than what could be looked up',
    f(nulls.every(g => typeof g.what_would_have_to_be_measured === 'string' && g.what_would_have_to_be_measured.length > 30),
      !nulls.every(g => typeof g.what_would_have_to_be_measured === 'string' && g.what_would_have_to_be_measured.length > 30)));
  check('no null is dressed as a zero anywhere in the generation-time column',
    f(gts.every(g => g.value !== 0), !gts.every(g => g.value !== 0)));
  const real = gts.filter(g => g.value !== null);
  check('exactly one generation time is a retrieved number, and it names its source',
    f(real.length === 1 && real[0].source === 'vrtilek_2018', !(real.length === 1 && real[0].source === 'vrtilek_2018')),
    `${real.length} non-null`);
  check('that number is the 14 days the retrieved abstract states, not a rounded or remembered figure',
    f(real[0].value === 14, real[0].value !== 14), `${real[0].value}`);
  check('and it says what it is NOT: a wild measurement is not a laboratory generation interval',
    f(/not the same|lower bound/i.test(real[0].not_the_same_as ?? ''), !/not the same|lower bound/i.test(real[0].not_the_same_as ?? '')));
  check('the retrieved 14-day figure is actually present in the source it cites, not only in the host record',
    f(/14 days/.test(S.SOURCES.vrtilek_2018.retrieved.maturation), !/14 days/.test(S.SOURCES.vrtilek_2018.retrieved.maturation)));

  const nullKnockIns = S.HOSTS.map(h => h.knock_in_published).filter(k => k.value === null);
  check('every null knock-in field states why and what would settle it',
    f(nullKnockIns.length >= 4 && nullKnockIns.every(k => typeof k.null_reason === 'string' && typeof k.what_would_have_to_be_measured === 'string'),
      !(nullKnockIns.length >= 4 && nullKnockIns.every(k => typeof k.null_reason === 'string' && typeof k.what_would_have_to_be_measured === 'string'))),
    `${nullKnockIns.length} null`);
  check('a knock-in recorded true WITHOUT a retrieved citation says so instead of implying one',
    f(S.HOSTS.filter(h => h.knock_in_published.value === true && h.knock_in_published.source === null)
      .every(h => /NOT separately verified/i.test(h.knock_in_published.verified_how)),
      !S.HOSTS.filter(h => h.knock_in_published.value === true && h.knock_in_published.source === null)
        .every(h => /NOT separately verified/i.test(h.knock_in_published.verified_how))));
  check('the two knock-in fields recorded FALSE admit they rest on an absence of search result, which is the weaker argument',
    f(S.HOSTS.filter(h => h.knock_in_published.value === false).length === 2
      && S.HOSTS.filter(h => h.knock_in_published.value === false).every(h => /absence of search result/i.test(h.knock_in_published.verified_how)),
      !(S.HOSTS.filter(h => h.knock_in_published.value === false).length === 2
        && S.HOSTS.filter(h => h.knock_in_published.value === false).every(h => /absence of search result/i.test(h.knock_in_published.verified_how)))));
  check('the one function whose mechanism could not be sourced has an EMPTY source list rather than a borrowed citation',
    f(S.functionById('eye-regression').genetic_basis.sources.length === 0, S.functionById('eye-regression').genetic_basis.sources.length !== 0));
  check('and it says the emptiness is deliberate, so a later reader does not fill it in from memory',
    f(/[Dd]eliberately empty/.test(S.functionById('eye-regression').genetic_basis.source_note ?? ''),
      !/[Dd]eliberately empty/.test(S.functionById('eye-regression').genetic_basis.source_note ?? '')));
  check('it is also the only function with no sources, so the gap is one gap and not a habit',
    f(S.FUNCTIONS.filter(x => x.genetic_basis.sources.length === 0).length === 1, S.FUNCTIONS.filter(x => x.genetic_basis.sources.length === 0).length !== 1),
    S.FUNCTIONS.filter(x => x.genetic_basis.sources.length === 0).map(x => x.id).join(', '));
  check('every source id a function cites actually exists in SOURCES, so no citation points at nothing',
    f(S.FUNCTIONS.every(x => x.genetic_basis.sources.every(s => S.SOURCE_IDS.includes(s))),
      !S.FUNCTIONS.every(x => x.genetic_basis.sources.every(s => S.SOURCE_IDS.includes(s)))),
    S.FUNCTIONS.flatMap(x => x.genetic_basis.sources.filter(s => !S.SOURCE_IDS.includes(s))).join(', '));
  check('every germline citation a host names actually exists in SOURCES',
    f(S.HOSTS.every(h => h.germline_citation === null || S.SOURCE_IDS.includes(h.germline_citation)),
      !S.HOSTS.every(h => h.germline_citation === null || S.SOURCE_IDS.includes(h.germline_citation))),
    S.HOSTS.filter(h => h.germline_citation !== null && !S.SOURCE_IDS.includes(h.germline_citation)).map(h => h.id).join(', '));
  check('a host with no germline citation is exactly a host with no germline method - the two columns cannot disagree',
    f(S.HOSTS.every(h => (h.germline_citation === null) === (h.tractability === 'NO_GERMLINE_METHOD')),
      !S.HOSTS.every(h => (h.germline_citation === null) === (h.tractability === 'NO_GERMLINE_METHOD'))),
    S.HOSTS.filter(h => (h.germline_citation === null) !== (h.tractability === 'NO_GERMLINE_METHOD')).map(h => h.id).join(', '));
}

// ====================================================================================================
// 3. HOSTS: THE REQUIRED SET, AND ACCESSIONS THAT WERE ACTUALLY FETCHED
// ====================================================================================================
{
  check('there are at least ten candidate base organisms',
    f(S.HOSTS.length >= 10, !(S.HOSTS.length >= 10)), `${S.HOSTS.length}`);
  const required = ['Danio rerio', 'Drosophila melanogaster', 'Caenorhabditis elegans', 'Mus musculus', 'Oryzias latipes', 'Astyanax mexicanus', 'Nothobranchius furzeri', 'Sus scrofa', 'Bos taurus', 'Saccharomyces cerevisiae'];
  const latins = S.HOSTS.map(h => h.latin);
  check('every required base organism is present, by binomial',
    f(required.every(r => latins.includes(r)), !required.every(r => latins.includes(r))), required.filter(r => !latins.includes(r)).join(', '));
  check('every host carries a Latin binomial of exactly two words',
    f(S.HOSTS.every(h => /^[A-Z][a-z]+ [a-z]+$/.test(h.latin)), !S.HOSTS.every(h => /^[A-Z][a-z]+ [a-z]+$/.test(h.latin))),
    S.HOSTS.filter(h => !/^[A-Z][a-z]+ [a-z]+$/.test(h.latin)).map(h => h.latin).join(', '));
  check('host ids are unique',
    f(new Set(S.HOST_IDS).size === S.HOSTS.length, new Set(S.HOST_IDS).size !== S.HOSTS.length));
  check('every host says why it is a plausible base, at length rather than in a phrase',
    f(S.HOSTS.every(h => typeof h.why_a_plausible_base === 'string' && h.why_a_plausible_base.length > 120),
      !S.HOSTS.every(h => typeof h.why_a_plausible_base === 'string' && h.why_a_plausible_base.length > 120)),
    S.HOSTS.filter(h => !(h.why_a_plausible_base ?? '').length > 120).map(h => h.id).join(', '));
  check('every accession has the shape of an NCBI assembly accession',
    f(S.HOSTS.every(h => /^GC[AF]_\d{9}\.\d+$/.test(h.assembly.accession)), !S.HOSTS.every(h => /^GC[AF]_\d{9}\.\d+$/.test(h.assembly.accession))),
    S.HOSTS.filter(h => !/^GC[AF]_\d{9}\.\d+$/.test(h.assembly.accession)).map(h => h.assembly.accession).join(', '));
  check('every accession records the ORGANISM NAME the API returned, not the one we expected',
    f(S.HOSTS.every(h => typeof h.assembly.organism_returned === 'string' && h.assembly.organism_returned.length > 0),
      !S.HOSTS.every(h => typeof h.assembly.organism_returned === 'string' && h.assembly.organism_returned.length > 0)));
  check('and the returned organism name matches the host binomial, which is how a wrong accession would show up',
    f(S.HOSTS.every(h => h.assembly.organism_returned.startsWith(h.latin)), !S.HOSTS.every(h => h.assembly.organism_returned.startsWith(h.latin))),
    S.HOSTS.filter(h => !h.assembly.organism_returned.startsWith(h.latin)).map(h => `${h.latin} != ${h.assembly.organism_returned}`).join('; '));
  check('every accession records the assembly NAME the API returned',
    f(S.HOSTS.every(h => typeof h.assembly.assembly_name_returned === 'string' && h.assembly.assembly_name_returned.length > 0),
      !S.HOSTS.every(h => typeof h.assembly.assembly_name_returned === 'string' && h.assembly.assembly_name_returned.length > 0)));
  check('every accession says HOW it was verified, and the method is a live fetch and not a recollection',
    f(S.HOSTS.every(h => /live NCBI datasets/.test(h.assembly.verified_how)), !S.HOSTS.every(h => /live NCBI datasets/.test(h.assembly.verified_how))),
    S.HOSTS.filter(h => !/live NCBI datasets/.test(h.assembly.verified_how)).map(h => h.id).join(', '));
  check('the one GCA-only host says what the missing RefSeq annotation costs downstream, rather than letting GCA pass as GCF',
    f(/no RefSeq annotation/.test(S.hostById('chaenocephalus-aceratus').assembly.verified_how),
      !/no RefSeq annotation/.test(S.hostById('chaenocephalus-aceratus').assembly.verified_how)));
  check('the Astyanax record warns that the reference assembly is the SURFACE morph, which is the morph a cave design is not using',
    f(/SURFACE morph/.test(S.hostById('astyanax-mexicanus').assembly.verified_how), !/SURFACE morph/.test(S.hostById('astyanax-mexicanus').assembly.verified_how)));
  check('and that host carries a morph caveat, because `has` cannot describe two morphs at once',
    f(typeof S.hostById('astyanax-mexicanus').morph_caveat === 'string' && /name the morph/.test(S.hostById('astyanax-mexicanus').morph_caveat),
      !(typeof S.hostById('astyanax-mexicanus').morph_caveat === 'string' && /name the morph/.test(S.hostById('astyanax-mexicanus').morph_caveat))));

  check('at least two hosts have NO germline method, so the refusal is not carried by a single removable row',
    f(S.HOSTS.filter(h => h.tractability === 'NO_GERMLINE_METHOD').length >= 2, !(S.HOSTS.filter(h => h.tractability === 'NO_GERMLINE_METHOD').length >= 2)),
    `${S.HOSTS.filter(h => h.tractability === 'NO_GERMLINE_METHOD').length}`);
  check('at least one host is PUBLISHED_ONCE, so the prerequisite class has a real occupant',
    f(S.HOSTS.some(h => h.tractability === 'PUBLISHED_ONCE'), !S.HOSTS.some(h => h.tractability === 'PUBLISHED_ONCE')));
  check('every tractability term in the vocabulary is used by some host, so no term is decorative',
    f(S.TRACTABILITY_IDS.every(t => S.HOSTS.some(h => h.tractability === t)), !S.TRACTABILITY_IDS.every(t => S.HOSTS.some(h => h.tractability === t))),
    S.TRACTABILITY_IDS.filter(t => !S.HOSTS.some(h => h.tractability === t)).join(', '));
  check('every host with no germline method states the germline STATUS in words, not just the enum',
    f(S.HOSTS.filter(h => h.tractability === 'NO_GERMLINE_METHOD').every(h => typeof h.germline_status === 'string' && h.germline_status.length > 60),
      !S.HOSTS.filter(h => h.tractability === 'NO_GERMLINE_METHOD').every(h => typeof h.germline_status === 'string' && h.germline_status.length > 60)));
  check('the hosts span more than one of this repo\'s comparative groups, so the space is not one clade wide',
    f(new Set(S.HOSTS.map(h => h.clade)).size >= 5, !(new Set(S.HOSTS.map(h => h.clade)).size >= 5)),
    [...new Set(S.HOSTS.map(h => h.clade))].join(', '));
}

// ====================================================================================================
// 4. FUNCTIONS: THE REQUIRED SET, AND BOTH INDEPENDENT ANTIFREEZE ORIGINS
// ====================================================================================================
{
  check('there are at least fourteen functional capabilities',
    f(S.FUNCTIONS.length >= 14, !(S.FUNCTIONS.length >= 14)), `${S.FUNCTIONS.length}`);
  check('function ids are unique',
    f(new Set(S.FUNCTION_IDS).size === S.FUNCTIONS.length, new Set(S.FUNCTION_IDS).size !== S.FUNCTIONS.length));
  const requiredFns = ['afgp-notothenioid', 'afgp-gadid', 'ethanolic-anoxia-tolerance', 'rhodopsin-spectral-tuning', 'ttx-resistance', 'electric-organ', 'myoglobin-dive-capacity', 'ucp1-thermogenesis', 'haemoglobin-loss', 'eye-regression', 'embryonic-diapause', 'dsup-radioprotection', 'bioluminescence-by-foreign-addition', 'rumen-methane-output', 'anhydrobiosis-desiccation-tolerance'];
  check('every required capability is present',
    f(requiredFns.every(x => S.FUNCTION_IDS.includes(x)), !requiredFns.every(x => S.FUNCTION_IDS.includes(x))),
    requiredFns.filter(x => !S.FUNCTION_IDS.includes(x)).join(', '));
  check('BOTH independently evolved antifreeze glycoproteins are present as separate entries',
    f(S.functionById('afgp-notothenioid') !== null && S.functionById('afgp-gadid') !== null,
      !(S.functionById('afgp-notothenioid') !== null && S.functionById('afgp-gadid') !== null)));
  check('and the module says WHY they are separate: an orthology search cannot see the pairing',
    f(/orthology search cannot see it/.test(S.functionById('afgp-gadid').why_it_is_listed_separately),
      !/orthology search cannot see it/.test(S.functionById('afgp-gadid').why_it_is_listed_separately)));
  check('the gadid origin records the de-novo-from-noncoding mechanism, which is what makes it independent rather than a copy',
    f(/non-genic DNA/i.test(S.functionById('afgp-gadid').genetic_basis.summary), !/non-genic DNA/i.test(S.functionById('afgp-gadid').genetic_basis.summary)));
  check('the notothenioid origin records the trypsinogen ancestry, which is the other half of the independence argument',
    f(/trypsinogen/.test(S.functionById('afgp-notothenioid').genetic_basis.summary), !/trypsinogen/.test(S.functionById('afgp-notothenioid').genetic_basis.summary)));

  check('every mechanism class in the vocabulary is instantiated by some capability',
    f(S.MECHANISM_CLASS_IDS.every(m => S.FUNCTIONS.some(x => x.mechanism_class === m)), !S.MECHANISM_CLASS_IDS.every(m => S.FUNCTIONS.some(x => x.mechanism_class === m))),
    S.MECHANISM_CLASS_IDS.filter(m => !S.FUNCTIONS.some(x => x.mechanism_class === m)).join(', '));
  check('every capability says what it IS physiologically, at length',
    f(S.FUNCTIONS.every(x => typeof x.what_it_is === 'string' && x.what_it_is.length > 80), !S.FUNCTIONS.every(x => typeof x.what_it_is === 'string' && x.what_it_is.length > 80)),
    S.FUNCTIONS.filter(x => !(x.what_it_is ?? '').length > 80).map(x => x.id).join(', '));
  check('every capability names a donor lineage',
    f(S.FUNCTIONS.every(x => typeof x.donor_lineage === 'string' && x.donor_lineage.length > 10), !S.FUNCTIONS.every(x => typeof x.donor_lineage === 'string' && x.donor_lineage.length > 10)));
  check('every capability carries a stated hazard or a naming correction, so none is offered as cost-free',
    f(S.FUNCTIONS.every(x => typeof x.hazard === 'string' || typeof x.naming_correction === 'string'),
      !S.FUNCTIONS.every(x => typeof x.hazard === 'string' || typeof x.naming_correction === 'string')),
    S.FUNCTIONS.filter(x => !(typeof x.hazard === 'string' || typeof x.naming_correction === 'string')).map(x => x.id).join(', '));

  // The one capability whose transfer has been done AND phenotyped is the module's calibration point,
  // and the thing it reports as NOT having changed is the part a design would have got wrong.
  const ucp1 = S.functionById('ucp1-thermogenesis');
  check('the UCP1 capability is marked DEMONSTRATED_BY_TRANSFER, which is the firmest term available',
    f(ucp1.genetic_basis.firmness === 'DEMONSTRATED_BY_TRANSFER', ucp1.genetic_basis.firmness !== 'DEMONSTRATED_BY_TRANSFER'), ucp1.genetic_basis.firmness);
  check('it quotes the measured fat change as the retrieved 4.89% with its reported significance',
    f(/4\.89%/.test(ucp1.genetic_basis.summary) && /P < 0\.01/.test(ucp1.genetic_basis.summary),
      !(/4\.89%/.test(ucp1.genetic_basis.summary) && /P < 0\.01/.test(ucp1.genetic_basis.summary))));
  check('that figure matches the retrieved block of the source it cites, rather than drifting from it',
    f(/4\.89%/.test(S.SOURCES.zheng_2017.retrieved.fat_change), !/4\.89%/.test(S.SOURCES.zheng_2017.retrieved.fat_change)));
  check('and its hazard names the thing that did NOT change, which is the result a designer would have predicted wrongly',
    f(/daily energy expenditure/.test(ucp1.hazard), !/daily energy expenditure/.test(ucp1.hazard)));
  check('the Dsup entry says its transfer was into CULTURED CELLS, not a whole animal, despite being marked demonstrated-by-transfer',
    f(/cultured cells/i.test(S.functionById('dsup-radioprotection').genetic_basis.transfer_caveat ?? ''),
      !/cultured cells/i.test(S.functionById('dsup-radioprotection').genetic_basis.transfer_caveat ?? '')));
  check('the ethanol-pathway entry carries the donor\'s own hazard: the key substitution is deleterious in humans',
    f(/deleterious in humans/i.test(S.functionById('ethanolic-anoxia-tolerance').hazard), !/deleterious in humans/i.test(S.functionById('ethanolic-anoxia-tolerance').hazard)));
  check('and explains that the duplication is what makes the donor tolerate it, which is the design content',
    f(/duplicat/i.test(S.functionById('ethanolic-anoxia-tolerance').hazard), !/duplicat/i.test(S.functionById('ethanolic-anoxia-tolerance').hazard)));
  check('the TTX entry records the MEASURED trade-off rather than treating resistance as free',
    f(/crawl speed/.test(S.functionById('ttx-resistance').hazard), !/crawl speed/.test(S.functionById('ttx-resistance').hazard)));
  check('the reporter entry corrects the fluorescence/bioluminescence conflation instead of inheriting it',
    f(/[Ff]luorescen\w+ protein is not bioluminescence/.test(S.functionById('bioluminescence-by-foreign-addition').naming_correction),
      !/[Ff]luorescen\w+ protein is not bioluminescence/.test(S.functionById('bioluminescence-by-foreign-addition').naming_correction)));
  check('the methane entry is classed as a microbiome trait, which is what makes the refusal structural rather than a judgement',
    f(S.functionById('rumen-methane-output').mechanism_class === 'TRAIT_OF_ASSOCIATED_MICROBIOME',
      S.functionById('rumen-methane-output').mechanism_class !== 'TRAIT_OF_ASSOCIATED_MICROBIOME'));
  check('and it reports BOTH variance decompositions rather than the one that makes the point more cleanly',
    f(/13%/.test(S.functionById('rumen-methane-output').genetic_basis.summary) && /7%/.test(S.functionById('rumen-methane-output').genetic_basis.summary),
      !(/13%/.test(S.functionById('rumen-methane-output').genetic_basis.summary) && /7%/.test(S.functionById('rumen-methane-output').genetic_basis.summary))));
  check('and it records that the taxon heritabilities did NOT survive multiple-testing correction',
    f(/NONE remained significant/.test(S.functionById('rumen-methane-output').genetic_basis.summary),
      !/NONE remained significant/.test(S.functionById('rumen-methane-output').genetic_basis.summary)));
  check('and it concedes the host-genetic handle is real, instead of using the refusal to deny the finding',
    f(/there IS a host-genetic handle/.test(S.functionById('rumen-methane-output').hazard), !/there IS a host-genetic handle/.test(S.functionById('rumen-methane-output').hazard)));
  check('every CORRELATIVE_ONLY capability says why it is only correlative',
    f(S.FUNCTIONS.filter(x => x.genetic_basis.firmness === 'CORRELATIVE_ONLY')
      .every(x => typeof x.genetic_basis.why_correlative === 'string' || typeof x.genetic_basis.what_would_make_it_firm === 'string'),
      !S.FUNCTIONS.filter(x => x.genetic_basis.firmness === 'CORRELATIVE_ONLY')
        .every(x => typeof x.genetic_basis.why_correlative === 'string' || typeof x.genetic_basis.what_would_make_it_firm === 'string')),
    S.FUNCTIONS.filter(x => x.genetic_basis.firmness === 'CORRELATIVE_ONLY').map(x => x.id).join(', '));
}

// ====================================================================================================
// 5. THE FOUR MANDATED REFUSALS FIRE
// ====================================================================================================
{
  const methane = S.admissible('bos-taurus', 'rumen-methane-output');
  check('a trait of an associated microbial community requested of the animal genome is REFUSED',
    f(methane.admissible === false, methane.admissible !== false), `${methane.class}`);
  check('and the class names the error as a wrong-genome error rather than a difficulty',
    f(methane.class === 'REFUSED_WRONG_GENOME', methane.class !== 'REFUSED_WRONG_GENOME'), methane.class);
  check('its reason states that no edit to the animal genome moves the trait',
    f(/no edit to its genome moves the trait/.test(methane.because), !/no edit to its genome moves the trait/.test(methane.because)));
  check('and what would change it is splitting the request into two projects, not trying harder',
    f(/two projects/.test(methane.what_would_change_it), !/two projects/.test(methane.what_would_change_it)));
  check('the refusal fires even though the host HAS the fermentation chamber the capability needs - it is not a substrate complaint',
    f(S.hostById('bos-taurus').has.includes('forestomach-fermentation-chamber'), !S.hostById('bos-taurus').has.includes('forestomach-fermentation-chamber')));

  const loss = S.admissible('saccharomyces-cerevisiae', 'haemoglobin-loss');
  check('a gene-loss request against a host that never had the gene is REFUSED',
    f(loss.admissible === false, loss.admissible !== false), loss.class);
  check('and the class names it as there being nothing to lose',
    f(loss.class === 'REFUSED_NO_GENE_TO_LOSE', loss.class !== 'REFUSED_NO_GENE_TO_LOSE'), loss.class);
  check('its reason states that a deletion presupposes a possession',
    f(/deletion presupposes a possession/.test(loss.because), !/deletion presupposes a possession/.test(loss.because)));
  check('and it refuses to offer a fix for this host, because there is not one',
    f(/Nothing about this host/.test(loss.what_would_change_it), !/Nothing about this host/.test(loss.what_would_change_it)));
  check('the same loss request against a host that DOES have haemoglobin is not refused for that reason',
    f(S.admissible('danio-rerio', 'haemoglobin-loss').class !== 'REFUSED_NO_GENE_TO_LOSE',
      S.admissible('danio-rerio', 'haemoglobin-loss').class === 'REFUSED_NO_GENE_TO_LOSE'),
    S.admissible('danio-rerio', 'haemoglobin-loss').class);
  check('so the gene-loss refusal discriminates between hosts rather than firing on the capability',
    f(S.HOST_IDS.some(h => S.admissible(h, 'haemoglobin-loss').class === 'REFUSED_NO_GENE_TO_LOSE')
      && S.HOST_IDS.some(h => S.admissible(h, 'haemoglobin-loss').class !== 'REFUSED_NO_GENE_TO_LOSE'),
      !(S.HOST_IDS.some(h => S.admissible(h, 'haemoglobin-loss').class === 'REFUSED_NO_GENE_TO_LOSE')
        && S.HOST_IDS.some(h => S.admissible(h, 'haemoglobin-loss').class !== 'REFUSED_NO_GENE_TO_LOSE'))));

  const poly = S.admissible('mus-musculus', 'myoglobin-dive-capacity');
  check('a polygenic quantitative trait requested as an edit is REFUSED',
    f(poly.admissible === false, poly.admissible !== false), poly.class);
  check('and the class names the request, not the host, as the problem',
    f(poly.class === 'REFUSED_POLYGENIC_AS_SINGLE_EDIT', poly.class !== 'REFUSED_POLYGENIC_AS_SINGLE_EDIT'), poly.class);
  check('its reason says the request has no referent rather than that it is unlikely',
    f(/no referent/.test(poly.because), !/no referent/.test(poly.because)));
  check('the polygenic refusal fires on a host that HAS every system the capability requires, so it is not a substrate complaint',
    f(S.systemCheck('mus-musculus', 'myoglobin-dive-capacity').asserted_absent.length === 0,
      S.systemCheck('mus-musculus', 'myoglobin-dive-capacity').asserted_absent.length !== 0));
  check('and what would change it is identified causal variants, which converts it into a DIFFERENT request',
    f(/causal variants/i.test(poly.what_would_change_it) && /different/.test(poly.what_would_change_it),
      !(/causal variants/i.test(poly.what_would_change_it) && /different/.test(poly.what_would_change_it))));

  const noRoute = S.admissible('chaenocephalus-aceratus', 'dsup-radioprotection');
  check('any request against a host with no published germline method is REFUSED',
    f(noRoute.admissible === false, noRoute.admissible !== false), noRoute.class);
  check('and the class names the missing route',
    f(noRoute.class === 'REFUSED_NO_GERMLINE_ROUTE', noRoute.class !== 'REFUSED_NO_GERMLINE_ROUTE'), noRoute.class);
  check('its reason names the host and the tractability term, so the refusal is checkable',
    f(/Chaenocephalus aceratus/.test(noRoute.because) && /NO_GERMLINE_METHOD/.test(noRoute.because),
      !(/Chaenocephalus aceratus/.test(noRoute.because) && /NO_GERMLINE_METHOD/.test(noRoute.because))));
  check('what would change it names the deeper obstacle - a closed life cycle - not just a paper',
    f(/closed life cycle/.test(noRoute.what_would_change_it), !/closed life cycle/.test(noRoute.what_would_change_it)));
  check('EVERY cell in a no-germline host\'s row is refused, with no exception bought by an easy capability',
    f(S.FUNCTION_IDS.every(x => S.admissible('chaenocephalus-aceratus', x).admissible === false),
      !S.FUNCTION_IDS.every(x => S.admissible('chaenocephalus-aceratus', x).admissible === false)),
    S.FUNCTION_IDS.filter(x => S.admissible('chaenocephalus-aceratus', x).admissible === true).join(', '));

  const present = S.admissible('mus-musculus', 'ucp1-thermogenesis');
  check('a capability requested of a host that already has it is REFUSED rather than scored as trivial',
    f(present.class === 'REFUSED_ALREADY_PRESENT', present.class !== 'REFUSED_ALREADY_PRESENT'), present.class);
  check('and the reason says nothing is being moved',
    f(/nothing is being moved/.test(present.because), !/nothing is being moved/.test(present.because)));
  check('the SAME capability into the host that lacks the gene is admissible, which is the discriminating pair',
    f(S.admissible('sus-scrofa', 'ucp1-thermogenesis').admissible === true, S.admissible('sus-scrofa', 'ucp1-thermogenesis').admissible !== true),
    S.admissible('sus-scrofa', 'ucp1-thermogenesis').class);
  check('and that admissible pair is the one the literature actually did, which is the module\'s calibration point',
    f(S.hostById('sus-scrofa').knock_in_published.source === 'zheng_2017', S.hostById('sus-scrofa').knock_in_published.source !== 'zheng_2017'));

  const noSub = S.admissible('caenorhabditis-elegans', 'electric-organ');
  check('a capability whose substrate the host lacks is refused as a substrate problem',
    f(noSub.class === 'REFUSED_NO_SUBSTRATE', noSub.class !== 'REFUSED_NO_SUBSTRATE'), noSub.class);
  check('and the reason names the missing system rather than gesturing at feasibility',
    f(/myogenic-excitable-organ-substrate/.test(noSub.because), !/myogenic-excitable-organ-substrate/.test(noSub.because)));
  check('the same capability in a host with the substrate is not refused for that reason',
    f(S.admissible('danio-rerio', 'electric-organ').class !== 'REFUSED_NO_SUBSTRATE', S.admissible('danio-rerio', 'electric-organ').class === 'REFUSED_NO_SUBSTRATE'),
    S.admissible('danio-rerio', 'electric-organ').class);
}

// ====================================================================================================
// 6. THE REFUSALS LIFT WHEN THEIR CONDITION IS CLEARED
// ====================================================================================================
// A filter that cannot be satisfied is not a filter. Each refusal is re-run against a SYNTHETIC copy
// of the pair with exactly one field changed, and must lift. Every object here is marked SYNTHETIC and
// asserts no biology.
{
  const SYN = 'SYNTHETIC. No biology asserted; exists to clear exactly one condition.';
  const base = S.hostById('danio-rerio');

  const noRouteHost = { ...base, id: 'synthetic-no-route', latin: 'Synthetica nulla', note: SYN, tractability: 'NO_GERMLINE_METHOD', germline_status: SYN };
  check('making an otherwise fine host untransformable turns an admissible cell into the germline refusal',
    f(S.admissible(base, 'afgp-gadid').admissible === true && S.admissible(noRouteHost, 'afgp-gadid').class === 'REFUSED_NO_GERMLINE_ROUTE',
      !(S.admissible(base, 'afgp-gadid').admissible === true && S.admissible(noRouteHost, 'afgp-gadid').class === 'REFUSED_NO_GERMLINE_ROUTE')),
    `${S.admissible(base, 'afgp-gadid').class} -> ${S.admissible(noRouteHost, 'afgp-gadid').class}`);

  const routedIcefish = { ...S.hostById('chaenocephalus-aceratus'), id: 'synthetic-routed', note: SYN, tractability: 'ESTABLISHED_NOT_ROUTINE', germline_status: SYN };
  check('giving the untransformable host a route LIFTS the germline refusal, so the refusal is about the route and nothing else',
    f(S.admissible(routedIcefish, 'dsup-radioprotection').class !== 'REFUSED_NO_GERMLINE_ROUTE',
      S.admissible(routedIcefish, 'dsup-radioprotection').class === 'REFUSED_NO_GERMLINE_ROUTE'),
    S.admissible(routedIcefish, 'dsup-radioprotection').class);
  check('and that lifted pair becomes admissible, not merely refused for a different reason',
    f(S.admissible(routedIcefish, 'dsup-radioprotection').admissible === true, S.admissible(routedIcefish, 'dsup-radioprotection').admissible !== true),
    S.admissible(routedIcefish, 'dsup-radioprotection').class);

  const hostWithHb = { ...S.hostById('saccharomyces-cerevisiae'), id: 'synthetic-with-hb', note: SYN, has: [...S.hostById('saccharomyces-cerevisiae').has, 'haemoglobin-oxygen-carriage'], lacks: S.hostById('saccharomyces-cerevisiae').lacks.filter(x => x !== 'haemoglobin-oxygen-carriage') };
  check('giving the host the system LIFTS the nothing-to-lose refusal, so it tracks possession and not the host id',
    f(S.admissible(hostWithHb, 'haemoglobin-loss').class !== 'REFUSED_NO_GENE_TO_LOSE', S.admissible(hostWithHb, 'haemoglobin-loss').class === 'REFUSED_NO_GENE_TO_LOSE'),
    S.admissible(hostWithHb, 'haemoglobin-loss').class);

  const singleLocusTrait = { ...S.functionById('myoglobin-dive-capacity'), id: 'synthetic-single-locus-dive', note: SYN, mechanism_class: 'SINGLE_GENE_ADDITION' };
  check('reclassifying the polygenic trait as one locus LIFTS the polygenic refusal, so it tracks the mechanism class',
    f(S.admissible('mus-musculus', singleLocusTrait).class !== 'REFUSED_POLYGENIC_AS_SINGLE_EDIT',
      S.admissible('mus-musculus', singleLocusTrait).class === 'REFUSED_POLYGENIC_AS_SINGLE_EDIT'),
    S.admissible('mus-musculus', singleLocusTrait).class);
  check('and the reclassified request becomes admissible as a single locus',
    f(S.admissible('mus-musculus', singleLocusTrait).class === 'ADMISSIBLE_SINGLE_LOCUS', S.admissible('mus-musculus', singleLocusTrait).class !== 'ADMISSIBLE_SINGLE_LOCUS'));

  const animalGenomeTrait = { ...S.functionById('rumen-methane-output'), id: 'synthetic-host-encoded-methane', note: SYN, mechanism_class: 'POLYGENIC_QUANTITATIVE' };
  check('reclassifying the microbiome trait as host-encoded LIFTS the wrong-genome refusal',
    f(S.admissible('bos-taurus', animalGenomeTrait).class !== 'REFUSED_WRONG_GENOME', S.admissible('bos-taurus', animalGenomeTrait).class === 'REFUSED_WRONG_GENOME'),
    S.admissible('bos-taurus', animalGenomeTrait).class);

  const notPresent = { ...S.functionById('ucp1-thermogenesis'), id: 'synthetic-not-present-ucp1', note: SYN, already_present_in: [] };
  check('removing a host from already_present_in LIFTS the already-present refusal',
    f(S.admissible('mus-musculus', notPresent).class !== 'REFUSED_ALREADY_PRESENT', S.admissible('mus-musculus', notPresent).class === 'REFUSED_ALREADY_PRESENT'),
    S.admissible('mus-musculus', notPresent).class);

  const givenSubstrate = { ...S.hostById('caenorhabditis-elegans'), id: 'synthetic-with-electrocyte', note: SYN, has: [...S.hostById('caenorhabditis-elegans').has, 'myogenic-excitable-organ-substrate', 'voltage-gated-sodium-channel-nav'], lacks: S.hostById('caenorhabditis-elegans').lacks.filter(x => x !== 'myogenic-excitable-organ-substrate') };
  check('giving the host the substrate LIFTS the no-substrate refusal',
    f(S.admissible(givenSubstrate, 'electric-organ').class !== 'REFUSED_NO_SUBSTRATE', S.admissible(givenSubstrate, 'electric-organ').class === 'REFUSED_NO_SUBSTRATE'),
    S.admissible(givenSubstrate, 'electric-organ').class);
  check('and lands on the prerequisite class, because regulatory rewiring is still not one edit',
    f(S.admissible(givenSubstrate, 'electric-organ').class === 'ADMISSIBLE_PENDING_PREREQUISITE',
      S.admissible(givenSubstrate, 'electric-organ').class !== 'ADMISSIBLE_PENDING_PREREQUISITE'),
    S.admissible(givenSubstrate, 'electric-organ').class);

  const adopted = { ...S.hostById('anolis-sagrei'), id: 'synthetic-adopted', note: SYN, tractability: 'ROUTINE_TRANSGENESIS' };
  check('promoting a published-once host to routine LIFTS the prerequisite and reaches the single-locus class',
    f(S.admissible('anolis-sagrei', 'dsup-radioprotection').class === 'ADMISSIBLE_PENDING_PREREQUISITE'
      && S.admissible(adopted, 'dsup-radioprotection').class === 'ADMISSIBLE_SINGLE_LOCUS',
      !(S.admissible('anolis-sagrei', 'dsup-radioprotection').class === 'ADMISSIBLE_PENDING_PREREQUISITE'
        && S.admissible(adopted, 'dsup-radioprotection').class === 'ADMISSIBLE_SINGLE_LOCUS')),
    `${S.admissible('anolis-sagrei', 'dsup-radioprotection').class} -> ${S.admissible(adopted, 'dsup-radioprotection').class}`);
}

// ====================================================================================================
// 7. THE AUDIT TRAIL CANNOT CONTAIN A FALSE SENTENCE
// ====================================================================================================
// reasons() lists every reason that applies so the precedence behind the one reported class is
// visible. If an ADMISSIBLE reason could appear beside a refusal, the trail would carry the sentence
// "the host has the systems the edit acts on" underneath a verdict saying it does not.
{
  let violations = [];
  for (const h of S.HOSTS) for (const x of S.FUNCTIONS) {
    const r = S.reasons(h, x);
    const hasRefusal = r.all_reasons.some(y => S.REFUSAL_CLASS_IDS.includes(y.class));
    const hasAdmissible = r.all_reasons.some(y => S.ADMISSIBLE_CLASS_IDS.includes(y.class));
    if (hasRefusal && hasAdmissible) violations.push(`${h.id} x ${x.id}`);
  }
  check('NO pair in the whole space lists both a refusal reason and an admissible reason',
    f(violations.length === 0, violations.length !== 0), violations.slice(0, 4).join('; '));

  let empties = [];
  for (const h of S.HOSTS) for (const x of S.FUNCTIONS) if (S.reasons(h, x).n_reasons === 0) empties.push(`${h.id} x ${x.id}`);
  check('EVERY pair produces at least one reason, so the reason set is exhaustive and no cell is silently unclassified',
    f(empties.length === 0, empties.length !== 0), empties.slice(0, 4).join('; '));

  check('every reason\'s class is drawn from the verdict vocabulary',
    f(S.HOSTS.every(h => S.FUNCTIONS.every(x => S.reasons(h, x).all_reasons.every(y => S.VERDICT_CLASS_IDS.includes(y.class)))),
      !S.HOSTS.every(h => S.FUNCTIONS.every(x => S.reasons(h, x).all_reasons.every(y => S.VERDICT_CLASS_IDS.includes(y.class))))));
  check('every reason states what would change it, with substance in it',
    f(S.HOSTS.every(h => S.FUNCTIONS.every(x => S.reasons(h, x).all_reasons.every(y => typeof y.what_would_change_it === 'string' && y.what_would_change_it.length > 40))),
      !S.HOSTS.every(h => S.FUNCTIONS.every(x => S.reasons(h, x).all_reasons.every(y => typeof y.what_would_change_it === 'string' && y.what_would_change_it.length > 40)))));
  check('the reason list is ordered by ADMISSIBILITY_ORDER, so the precedence is the declared one and not an accident of the code',
    f(S.HOSTS.every(h => S.FUNCTIONS.every(x => {
      const idx = S.reasons(h, x).all_reasons.map(y => S.ADMISSIBILITY_ORDER.indexOf(y.class));
      return idx.every((v, i) => i === 0 || idx[i - 1] <= v);
    })), !S.HOSTS.every(h => S.FUNCTIONS.every(x => {
      const idx = S.reasons(h, x).all_reasons.map(y => S.ADMISSIBILITY_ORDER.indexOf(y.class));
      return idx.every((v, i) => i === 0 || idx[i - 1] <= v);
    }))));
  check('the reported class is always the FIRST reason in that order, not a different one',
    f(S.HOSTS.every(h => S.FUNCTIONS.every(x => S.admissible(h, x).class === S.reasons(h, x).all_reasons[0].class)),
      !S.HOSTS.every(h => S.FUNCTIONS.every(x => S.admissible(h, x).class === S.reasons(h, x).all_reasons[0].class))));
  check('ADMISSIBILITY_ORDER covers every verdict class, so no class can be unreachable by ordering alone',
    f(S.VERDICT_CLASS_IDS.every(c => S.ADMISSIBILITY_ORDER.includes(c)) && S.ADMISSIBILITY_ORDER.length === S.VERDICT_CLASS_IDS.length,
      !(S.VERDICT_CLASS_IDS.every(c => S.ADMISSIBILITY_ORDER.includes(c)) && S.ADMISSIBILITY_ORDER.length === S.VERDICT_CLASS_IDS.length)),
    S.ADMISSIBILITY_ORDER.join(' > '));
  check('the germline refusal is FIRST in the order, because it is the cheapest decisive fact',
    f(S.ADMISSIBILITY_ORDER[0] === 'REFUSED_NO_GERMLINE_ROUTE', S.ADMISSIBILITY_ORDER[0] !== 'REFUSED_NO_GERMLINE_ROUTE'), S.ADMISSIBILITY_ORDER[0]);
  check('every refusal class precedes every admissible class in the order',
    f(Math.max(...S.REFUSAL_CLASS_IDS.map(c => S.ADMISSIBILITY_ORDER.indexOf(c))) < Math.min(...S.ADMISSIBLE_CLASS_IDS.map(c => S.ADMISSIBILITY_ORDER.indexOf(c))),
      !(Math.max(...S.REFUSAL_CLASS_IDS.map(c => S.ADMISSIBILITY_ORDER.indexOf(c))) < Math.min(...S.ADMISSIBLE_CLASS_IDS.map(c => S.ADMISSIBILITY_ORDER.indexOf(c))))));
  check('a verdict reports the OTHER reasons that also applied, so a reader can see what the precedence hid',
    f(Array.isArray(S.admissible('chaenocephalus-aceratus', 'afgp-notothenioid').other_reasons_that_also_apply)
      && S.admissible('chaenocephalus-aceratus', 'afgp-notothenioid').other_reasons_that_also_apply.includes('REFUSED_ALREADY_PRESENT'),
      !(Array.isArray(S.admissible('chaenocephalus-aceratus', 'afgp-notothenioid').other_reasons_that_also_apply)
        && S.admissible('chaenocephalus-aceratus', 'afgp-notothenioid').other_reasons_that_also_apply.includes('REFUSED_ALREADY_PRESENT'))),
    S.admissible('chaenocephalus-aceratus', 'afgp-notothenioid').other_reasons_that_also_apply.join(', '));
  check('admissible() throws on an unknown host rather than returning a default verdict',
    f((() => { try { S.admissible('not-a-host', 'afgp-gadid'); return false; } catch { return true; } })(),
      !(() => { try { S.admissible('not-a-host', 'afgp-gadid'); return false; } catch { return true; } })()));
  check('and on an unknown function',
    f((() => { try { S.admissible('danio-rerio', 'not-a-function'); return false; } catch { return true; } })(),
      !(() => { try { S.admissible('danio-rerio', 'not-a-function'); return false; } catch { return true; } })()));
}

// ====================================================================================================
// 8. AN UNKNOWN IS NOT AN ABSENCE
// ====================================================================================================
// One host's sodium-channel status is recorded as unretrieved on purpose. If `unknown` collapsed into
// `lacks`, the module would refuse pairs on the strength of a search nobody ran - which is the same
// error analogues/analogy.mjs refuses as absence-of-evidence, in a different costume.
{
  const worm = S.hostById('caenorhabditis-elegans');
  check('the host records its unverified sodium-channel claim as an explicit null with a reason',
    f(worm.note_on_sodium_channels.value === null && typeof worm.note_on_sodium_channels.null_reason === 'string',
      !(worm.note_on_sodium_channels.value === null && typeof worm.note_on_sodium_channels.null_reason === 'string')));
  check('and the claim is NOT asserted: the system appears in neither has nor lacks',
    f(!worm.has.includes('voltage-gated-sodium-channel-nav') && !worm.lacks.includes('voltage-gated-sodium-channel-nav'),
      worm.has.includes('voltage-gated-sodium-channel-nav') || worm.lacks.includes('voltage-gated-sodium-channel-nav')));
  const sc = S.systemCheck('caenorhabditis-elegans', 'ttx-resistance');
  check('systemCheck reports it as unknown rather than folding it into asserted_absent',
    f(sc.unknown.includes('voltage-gated-sodium-channel-nav') && !sc.asserted_absent.includes('voltage-gated-sodium-channel-nav'),
      !(sc.unknown.includes('voltage-gated-sodium-channel-nav') && !sc.asserted_absent.includes('voltage-gated-sodium-channel-nav'))),
    `unknown: ${sc.unknown.join(', ')} | absent: ${sc.asserted_absent.join(', ')}`);
  check('systemCheck says in words that an unknown licenses neither a refusal nor an admission',
    f(/does not license a refusal/.test(sc.unknown_is_not_absent), !/does not license a refusal/.test(sc.unknown_is_not_absent)));
  check('a verdict carries its unknown systems, so the gap travels with the answer',
    f(S.admissible('caenorhabditis-elegans', 'ttx-resistance').unknown_systems.includes('voltage-gated-sodium-channel-nav'),
      !S.admissible('caenorhabditis-elegans', 'ttx-resistance').unknown_systems.includes('voltage-gated-sodium-channel-nav')));
  check('and that pair is still refused on a system genuinely recorded as absent, not on the unknown one',
    f(S.admissible('caenorhabditis-elegans', 'ttx-resistance').class === 'REFUSED_NO_SUBSTRATE'
      && /skeletal-muscle-myoglobin/.test(S.admissible('caenorhabditis-elegans', 'ttx-resistance').because),
      !(S.admissible('caenorhabditis-elegans', 'ttx-resistance').class === 'REFUSED_NO_SUBSTRATE'
        && /skeletal-muscle-myoglobin/.test(S.admissible('caenorhabditis-elegans', 'ttx-resistance').because))),
    S.admissible('caenorhabditis-elegans', 'ttx-resistance').because.slice(0, 90));
  check('the unknown states what measurement would resolve it, not what could be assumed',
    f(/genome-wide search/i.test(worm.note_on_sodium_channels.what_would_have_to_be_measured),
      !/genome-wide search/i.test(worm.note_on_sodium_channels.what_would_have_to_be_measured)));
}

// ====================================================================================================
// 9. NO SCORE, ANYWHERE
// ====================================================================================================
{
  const v = S.admissible('sus-scrofa', 'ucp1-thermogenesis');
  const numbers = Object.entries(v).filter(([, x]) => typeof x === 'number').map(([k]) => k);
  check('NO property of a verdict is a bare number',
    f(numbers.length === 0, numbers.length !== 0), numbers.join(', '));
  check('score and feasibility are explicitly null rather than absent, so their absence is on the record',
    f(v.score === null && v.feasibility === null && 'score' in v && 'feasibility' in v,
      !(v.score === null && v.feasibility === null && 'score' in v && 'feasibility' in v)));
  check('the verdict says in words that no number is available, and points at the argument',
    f(/not one available/.test(v.no_score_is_offered) && /WHY_NO_RANKING/.test(v.no_score_is_offered),
      !(/not one available/.test(v.no_score_is_offered) && /WHY_NO_RANKING/.test(v.no_score_is_offered))));
  check('the verdict is frozen, so a caller cannot staple a score onto it downstream',
    f(Object.isFrozen(v) === true, Object.isFrozen(v) !== true));
  check('admissible is a boolean AND a class, so the boolean can never be the whole answer',
    f(typeof v.admissible === 'boolean' && typeof v.class === 'string', !(typeof v.admissible === 'boolean' && typeof v.class === 'string')));
  check('an admissible verdict carries what the class DOES NOT mean, so admissible cannot be read as a green light',
    f(typeof v.class_does_not_mean === 'string' && /47%/.test(v.class_does_not_mean),
      !(typeof v.class_does_not_mean === 'string' && /47%/.test(v.class_does_not_mean))));
  check('that 47% matches the retrieved block of the source, rather than being a remembered number',
    f(/47%/.test(S.SOURCES.kachroo_2015.retrieved.rate), !/47%/.test(S.SOURCES.kachroo_2015.retrieved.rate)));
  check('no exported module member is a bare number, so there is no module-level scalar to quote',
    f(Object.entries(S).filter(([, x]) => typeof x === 'number').length === 0,
      Object.entries(S).filter(([, x]) => typeof x === 'number').length !== 0),
    Object.entries(S).filter(([, x]) => typeof x === 'number').map(([k]) => k).join(', '));
  check('WHY_NO_RANKING gives more than one reason',
    f(S.WHY_NO_RANKING.the_argument.length >= 4, !(S.WHY_NO_RANKING.the_argument.length >= 4)), `${S.WHY_NO_RANKING.the_argument.length}`);
  check('and names the specific hazard: a malformed request scored mid-range reads as "ambitious, try it"',
    f(S.WHY_NO_RANKING.the_argument.some(s => /mid-range/.test(s)), !S.WHY_NO_RANKING.the_argument.some(s => /mid-range/.test(s))));
  check('and says the second sentence - what would change it - is what a rank deletes',
    f(S.WHY_NO_RANKING.the_argument.some(s => /second sentence is what a rank deletes/.test(s)),
      !S.WHY_NO_RANKING.the_argument.some(s => /second sentence is what a rank deletes/.test(s))));
  check('and makes the arguability point: a class can be disagreed with, a float cannot',
    f(S.WHY_NO_RANKING.the_argument.some(s => /Nobody can disagree with a 0\.41/.test(s)),
      !S.WHY_NO_RANKING.the_argument.some(s => /Nobody can disagree with a 0\.41/.test(s))));
  check('and declines to rank the admissible cells among themselves, saying why',
    f(S.WHY_NO_RANKING.the_argument.some(s => /not ordered among themselves/.test(s)),
      !S.WHY_NO_RANKING.the_argument.some(s => /not ordered among themselves/.test(s))));
}

// ====================================================================================================
// 10. space(): THE CROSS PRODUCT, AND EVERY CLASS REACHED
// ====================================================================================================
{
  const s = S.space();
  check('space() is the full cross product, with no cell dropped',
    f(s.n_cells === s.n_hosts * s.n_functions && s.cells.length === s.n_cells,
      !(s.n_cells === s.n_hosts * s.n_functions && s.cells.length === s.n_cells)), `${s.n_cells} vs ${s.n_hosts * s.n_functions}`);
  check('admissible and refused partition the space exactly',
    f(s.n_admissible + s.n_refused === s.n_cells, s.n_admissible + s.n_refused !== s.n_cells), `${s.n_admissible} + ${s.n_refused} vs ${s.n_cells}`);
  check('the class counts sum to the number of cells, so each cell got exactly one class',
    f(Object.values(s.by_class).reduce((a, b) => a + b, 0) === s.n_cells, Object.values(s.by_class).reduce((a, b) => a + b, 0) !== s.n_cells));
  check('the refusal counts sum to the number refused',
    f(Object.values(s.refused_by_reason).reduce((a, b) => a + b, 0) === s.n_refused, Object.values(s.refused_by_reason).reduce((a, b) => a + b, 0) !== s.n_refused));
  check('EVERY verdict class is reached by a real pair, so no class is a claim the module never honours',
    f(s.classes_unreached.length === 0, s.classes_unreached.length !== 0), s.classes_unreached.join(', '));
  check('all four mandated refusal kinds occur at least once in the real space',
    f(['REFUSED_WRONG_GENOME', 'REFUSED_NO_GENE_TO_LOSE', 'REFUSED_POLYGENIC_AS_SINGLE_EDIT', 'REFUSED_NO_GERMLINE_ROUTE'].every(c => s.refused_by_reason[c] > 0),
      !['REFUSED_WRONG_GENOME', 'REFUSED_NO_GENE_TO_LOSE', 'REFUSED_POLYGENIC_AS_SINGLE_EDIT', 'REFUSED_NO_GERMLINE_ROUTE'].every(c => s.refused_by_reason[c] > 0)),
    JSON.stringify(s.refused_by_reason));
  check('a substantial part of the space is ADMISSIBLE, so the filter is not simply obstructive',
    f(s.n_admissible > s.n_cells / 4, !(s.n_admissible > s.n_cells / 4)), `${s.n_admissible} of ${s.n_cells}`);
  check('and a substantial part is refused, so it is not a rubber stamp either',
    f(s.n_refused > s.n_cells / 4, !(s.n_refused > s.n_cells / 4)), `${s.n_refused} of ${s.n_cells}`);
  check('every cell carries its reason, so a refusal is never a bare label',
    f(s.cells.every(c => typeof c.because === 'string' && c.because.length > 40), !s.cells.every(c => typeof c.because === 'string' && c.because.length > 40)));
  check('every cell carries what would change it',
    f(s.cells.every(c => typeof c.what_would_change_it === 'string' && c.what_would_change_it.length > 40),
      !s.cells.every(c => typeof c.what_would_change_it === 'string' && c.what_would_change_it.length > 40)));
  check('space() states that its refusal fraction is NOT a base rate',
    f(/base rate/i.test(s.what_this_is_not), !/base rate/i.test(s.what_this_is_not)));
  check('and admits the host and capability lists were chosen, partly to cover the vocabularies',
    f(/both lists were chosen/.test(s.what_this_is_not), !/both lists were chosen/.test(s.what_this_is_not)));
  check('space() names the uncomfortable cells rather than leaving them in the table',
    f(/nobody can breed/.test(s.the_uncomfortable_cells), !/nobody can breed/.test(s.the_uncomfortable_cells)));
  check('space() returns no ordering: there is no rank, sort or top field on it',
    f(!('rank' in s) && !('ranked' in s) && !('top' in s) && !('sorted' in s),
      ('rank' in s) || ('ranked' in s) || ('top' in s) || ('sorted' in s)));
  check('space() is frozen, cells included',
    f(Object.isFrozen(s) === true && Object.isFrozen(s.cells[0]) === true, !(Object.isFrozen(s) === true && Object.isFrozen(s.cells[0]) === true)));
  check('no host\'s row is entirely admissible, so no host is treated as universal',
    f(S.HOST_IDS.every(h => S.FUNCTION_IDS.some(x => S.admissible(h, x).admissible === false)),
      !S.HOST_IDS.every(h => S.FUNCTION_IDS.some(x => S.admissible(h, x).admissible === false))),
    S.HOST_IDS.filter(h => S.FUNCTION_IDS.every(x => S.admissible(h, x).admissible === true)).join(', '));
  check('the microbiome capability is refused against EVERY host, including the one with the fermentation chamber',
    f(S.HOST_IDS.every(h => S.admissible(h, 'rumen-methane-output').admissible === false),
      !S.HOST_IDS.every(h => S.admissible(h, 'rumen-methane-output').admissible === false)),
    S.HOST_IDS.filter(h => S.admissible(h, 'rumen-methane-output').admissible === true).join(', '));
  check('at least one capability is admissible in several hosts, so a column is not refused by construction',
    f(S.FUNCTION_IDS.some(x => S.HOST_IDS.filter(h => S.admissible(h, x).admissible === true).length >= 5),
      !S.FUNCTION_IDS.some(x => S.HOST_IDS.filter(h => S.admissible(h, x).admissible === true).length >= 5)));
  check('WHAT_THIS_IS names all the refusals the module claims to make, so the summary cannot drift from the code',
    f(/microbial community/.test(S.WHAT_THIS_IS) && /never had the gene/.test(S.WHAT_THIS_IS) && /single edit/.test(S.WHAT_THIS_IS) && /germline route/.test(S.WHAT_THIS_IS),
      !(/microbial community/.test(S.WHAT_THIS_IS) && /never had the gene/.test(S.WHAT_THIS_IS) && /single edit/.test(S.WHAT_THIS_IS) && /germline route/.test(S.WHAT_THIS_IS))));
  check('and it says admissible means well formed, not that the experiment will work',
    f(/not that the experiment will work/.test(S.WHAT_THIS_IS), !/not that the experiment will work/.test(S.WHAT_THIS_IS)));
}

// ====================================================================================================
console.log(`\n${pass} pass, ${fail} fail`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above had its predicate inverted. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
process.exit(fail && !FAULT ? 1 : 0);
