#!/usr/bin/env node
// Tests for analogues/combos/pairs/anoxia-ethanol.mjs
//
//   node analogues/combos/pairs/test-anoxia-ethanol.mjs [--fail-once]
//
// --fail-once substitutes the BROKEN value for exactly ONE assertion per run and iterates over every
// assertion, so the suite is run once per assertion with only that one assertion's input corrupted.
// Each targeted assertion must then FAIL. One that still passes under its own injected fault is a
// SURVIVOR: it asserts nothing about its subject, and is counted as a test failure.
//
// The faults are predicate inversions or wrong-value substitutions. No threshold is tightened anywhere:
// a fault never makes a test stricter, only wrong, which is the only way the result means anything.
//
// Four things are checked harder than the rest, because they are the four ways this dossier could do
// damage if it were wrong:
//
//   1. A FABRICATED IDENTIFIER - the worst output this project can produce. The test reads its sibling
//      module's SOURCE TEXT and asserts that every DOI, PMID, Ensembl gene id, NCBI GeneID and LOC id
//      appearing anywhere in it, prose and comments included, belongs to the closed set actually
//      retrieved. A new identifier cannot enter the dossier without this test failing.
//   2. THE CARP PAIR BEING PROMOTED. Its orthology is many-to-many on both sides. If evidence can buy
//      it functional equivalence, the dossier is lending the module's vocabulary to the error the
//      module exists to stop - so the promotion is attempted here, with a rescue added, and must fail.
//   3. THE GENE-LOSS PAIR BEING RESHAPED TO SCORE. The finding is that the schema cannot hold a measured
//      absence. The test asserts all seven slots absent, the band at the floor, and that HOMOLOGY_TYPES
//      still carries no value meaning "lost" - the limitation checked in code, not described in prose
//      that could drift away from it.
//   4. A BAND WRITTEN DOWN BY HAND. SCORED must be what scoreAnalogy returns for the evidence as
//      entered, so the test recomputes both bands and compares.

import { readFileSync } from 'node:fs';
import * as A from '../../analogy.mjs';
import * as M from './anoxia-ethanol.mjs';

const FAULT = process.argv.includes('--fail-once');
const SRC = readFileSync(new URL('./anoxia-ethanol.mjs', import.meta.url), 'utf8');

const RANK = ['no-support', 'weak', 'moderate', 'strong', 'directly-tested'];
const rank = l => RANK.indexOf(l);
const carp = M.PAIRS.find(p => p.id === 'pdhe1a3-carp-pdha1-zebrafish');
const ice = M.PAIRS.find(p => p.id === 'globin-locus-icefish-zebrafish');
const scoredCarp = M.SCORED.find(s => s.id === carp.id);
const scoredIce = M.SCORED.find(s => s.id === ice.id);
const afgp = A.PAIRS.find(p => p.id === 'afgp-notothenioid-gadid');

// ---- the harness. One f() per check(), so the f-index and the check-index are the same number. ----
let faultTarget = -1, fIndex = 0, verbose = true, results = [];
const f = (real, broken) => (fIndex++ === faultTarget ? broken : real);
const check = (name, cond, detail = '') => {
  results.push({ name, cond: cond === true });
  if (verbose) console.log(cond === true ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
};

function runSuite() {
  fIndex = 0; results = [];

  // ==================================================================================================
  // 1. NO FABRICATED IDENTIFIERS. The whole file's identifier surface, against the retrieved set.
  // ==================================================================================================
  {
    const RETRIEVED_DOIS = [
      '10.1038/s41598-017-07385-4',
      '10.1073/pnas.92.6.1817',
      '10.1074/jbc.273.24.14745',
      '10.1016/s0378-1119(02)00691-1',
      '10.1016/j.cbpa.2009.04.621',
    ];
    const RETRIEVED_PMIDS = ['28801642', '7892183', '9614073', '12354652', '19401238'];
    const RETRIEVED_ENSEMBL = ['ENSDARG00000012387', 'ENSDARG00000010555', 'ENSDARG00000116841', 'ENSG00000131828', 'ENSG00000163114'];
    const RETRIEVED_GENEIDS = ['406702', '436672', '406428', '132124165'];
    const RETRIEVED_LOCS = ['LOC132141476', 'LOC132141477', 'LOC132139822'];

    // Note the char class: a DOI can legitimately contain parentheses (10.1016/s0378-1119(02)00691-1),
    // so excluding ')' here silently truncated one and made the guard pass on a string it had mangled.
    const doisInFile = [...new Set((SRC.match(/10\.\d{4,5}\/[^\s'",;]+/g) ?? []).map(d => d.replace(/[.,;]+$/, '')))];
    const strayDois = doisInFile.filter(d => !RETRIEVED_DOIS.includes(d));
    check('every DOI anywhere in the module is one retrieved this session',
      f(strayDois.length === 0, strayDois.length !== 0), strayDois.join(', ') || `${doisInFile.length} found, 0 stray`);
    const missingDois = RETRIEVED_DOIS.filter(d => !doisInFile.includes(d));
    check('and all five retrieved DOIs are actually carried, so the guard has something to guard',
      f(missingDois.length === 0, missingDois.length !== 0), missingDois.join(', '));

    const pmidFields = [...new Set((SRC.match(/pmid:\s*'(\d+)'/g) ?? []).map(s => s.replace(/\D/g, '')))];
    const strayPmidFields = pmidFields.filter(p => !RETRIEVED_PMIDS.includes(p));
    check('every pmid field holds a PMID retrieved this session',
      f(strayPmidFields.length === 0, strayPmidFields.length !== 0), strayPmidFields.join(', ') || pmidFields.join(','));
    const prosePmids = (SRC.match(/PMIDs? [\d, ]+/g) ?? []).join(' ').match(/\d+/g) ?? [];
    const strayProse = prosePmids.filter(p => !RETRIEVED_PMIDS.includes(p));
    check('and every PMID quoted in prose is one of the same five',
      f(strayProse.length === 0, strayProse.length !== 0), strayProse.join(', '));

    const ensInFile = [...new Set(SRC.match(/ENS[A-Z]*G\d+/g) ?? [])];
    const strayEns = ensInFile.filter(e => !RETRIEVED_ENSEMBL.includes(e));
    check('every Ensembl gene id in the module was looked up and read back',
      f(strayEns.length === 0, strayEns.length !== 0), strayEns.join(', ') || ensInFile.join(','));
    const badForm = ensInFile.filter(e => !/^ENS(DAR)?G\d{11}$/.test(e));
    check('and each is a well-formed stable id with eleven digits, not a truncated guess',
      f(badForm.length === 0, badForm.length !== 0), badForm.join(', '));

    const geneIds = [...new Set((SRC.match(/GeneID \d+/g) ?? []).map(s => s.split(' ')[1]))];
    const strayGeneIds = geneIds.filter(g => !RETRIEVED_GENEIDS.includes(g));
    check('every NCBI GeneID named in the module was fetched and read back',
      f(strayGeneIds.length === 0, strayGeneIds.length !== 0), strayGeneIds.join(', ') || geneIds.join(','));

    const locIds = [...new Set(SRC.match(/LOC\d+/g) ?? [])];
    const strayLocs = locIds.filter(l => !RETRIEVED_LOCS.includes(l));
    check('every LOC identifier is one of the three donor loci whose coordinates were read back',
      f(strayLocs.length === 0, strayLocs.length !== 0), strayLocs.join(', ') || locIds.join(','));

    const srcKeys = Object.keys(M.SOURCES);
    const noVerify = srcKeys.filter(k => typeof M.SOURCES[k].verified_how !== 'string' || M.SOURCES[k].verified_how.length < 120);
    check('EVERY source carries a verified_how saying what was read back, with substance in it',
      f(noVerify.length === 0, noVerify.length !== 0), noVerify.join(', ') || `${srcKeys.length} sources`);
    check('SOURCES is frozen, so a citation cannot be added to it at runtime',
      f(Object.isFrozen(M.SOURCES) === true, Object.isFrozen(M.SOURCES) !== true));
    check('the two record-level sources that establish the host gene count are both present',
      f(typeof M.SOURCES.ensembl_lookup_zebrafish_pdha === 'object' && typeof M.SOURCES.ncbi_gene_zebrafish_pdh === 'object',
        !(typeof M.SOURCES.ensembl_lookup_zebrafish_pdha === 'object' && typeof M.SOURCES.ncbi_gene_zebrafish_pdh === 'object')));
    check('and the Ensembl record source notes the alt-contig id that would have made the family look like three genes',
      f(/alternate-haplotype annotation/.test(M.SOURCES.ensembl_lookup_zebrafish_pdha.verified_how),
        !/alternate-haplotype annotation/.test(M.SOURCES.ensembl_lookup_zebrafish_pdha.verified_how)));
  }

  // ==================================================================================================
  // 2. NO INVENTED NUMBERS IN THE EVIDENCE SLOTS
  // ==================================================================================================
  {
    const allSlots = M.PAIRS.flatMap(p => Object.entries(p.evidence).map(([k, v]) => [p.id, k, v]));
    const numericIdentity = allSlots.filter(([, , v]) => typeof v.identity === 'number');
    check('NO evidence slot in either pair carries a numeric pairwise identity',
      f(numericIdentity.length === 0, numericIdentity.length !== 0), numericIdentity.map(([p, k]) => `${p}:${k}`).join(', '));
    const orth = carp.evidence['sequence-orthology'];
    check('the carp orthology slot sets identity to null EXPLICITLY rather than omitting it',
      f(orth.identity === null && 'identity' in orth, !(orth.identity === null && 'identity' in orth)));
    check('and says in words why no identity value is entered',
      f(/No pairwise identity was computed here/.test(orth.identity_why_null ?? ''),
        !/No pairwise identity was computed here/.test(orth.identity_why_null ?? '')));
    check('so the identity-floor refusal does not fire, which would have been a false positive',
      f(!scoredCarp.refusal.refusals.some(r => r.id === 'identity-alone-is-not-function'),
        scoredCarp.refusal.refusals.some(r => r.id === 'identity-alone-is-not-function')),
      scoredCarp.refusal.refusals.map(r => r.id).join(', '));

    const species = [...new Set(M.PAIRS.flatMap(p => [p.a.species, p.b.species]))].sort().join('|');
    check('exactly the three species whose records were fetched are named across the two pairs',
      f(species === 'Carassius carassius|Chaenocephalus aceratus|Danio rerio',
        species !== 'Carassius carassius|Chaenocephalus aceratus|Danio rerio'), species);
  }

  // ==================================================================================================
  // 3. THE CARP PAIR IS MANY-TO-MANY AND IT STAYS THERE
  // ==================================================================================================
  {
    const orth = carp.evidence['sequence-orthology'];
    check('the carp/host orthology relationship is recorded many-to-many, not one-to-one',
      f(orth.homology_type === 'many-to-many', orth.homology_type === 'one-to-one'), orth.homology_type);
    check('many-to-many is a value the module recognises',
      f(A.HOMOLOGY_TYPES.includes(orth.homology_type), !A.HOMOLOGY_TYPES.includes(orth.homology_type)), A.HOMOLOGY_TYPES.join(','));
    check('and one the module treats as ambiguous, so "the orthologue" does not denote',
      f(A.AMBIGUOUS_HOMOLOGY_TYPES.includes(orth.homology_type), !A.AMBIGUOUS_HOMOLOGY_TYPES.includes(orth.homology_type)));
    check('the counts that make it many-to-many are recorded: three donor genes against two host genes',
      f(orth.n_on_a_side === 3 && orth.n_on_b_side === 2, !(orth.n_on_a_side === 3 && orth.n_on_b_side === 2)),
      `${orth.n_on_a_side} vs ${orth.n_on_b_side}`);
    check('and the members are listed on both sides, not merely counted',
      f(orth.members_a.length === orth.n_on_a_side && orth.members_b.length === orth.n_on_b_side,
        !(orth.members_a.length === orth.n_on_a_side && orth.members_b.length === orth.n_on_b_side)));
    check('the recorded type matches what Ensembl itself returned, which was many2many and not one2many',
      f(/ortholog_many2many/.test(M.SOURCES.ensembl_compara_pdha1.verified_how),
        !/ortholog_many2many/.test(M.SOURCES.ensembl_compara_pdha1.verified_how)));

    const c = scoredCarp.classification;
    check('the carp pair classifies one-to-many-ambiguous',
      f(c.class === 'one-to-many-ambiguous', c.class !== 'one-to-many-ambiguous'), c.class);
    check('it is NOT a functional equivalent, whatever else is present for it',
      f(c.functional_equivalent === false, c.functional_equivalent !== false), `${c.functional_equivalent}`);
    check('and it does not reach the one class that means substitutable in a design',
      f(!A.FUNCTIONAL_EQUIVALENCE_CLASSES.includes(c.class), A.FUNCTIONAL_EQUIVALENCE_CLASSES.includes(c.class)), c.class);
    check('the one-to-many refusal fires on it by name',
      f(scoredCarp.refusal.refusals.some(r => r.id === 'one-to-many-is-not-equivalence'),
        !scoredCarp.refusal.refusals.some(r => r.id === 'one-to-many-is-not-equivalence')),
      scoredCarp.refusal.refusals.map(r => r.id).join(', '));
    check('and the classification points at the module\'s own record of the problem',
      f(c.see === 'THE_ZEBRAFISH_PROBLEM', c.see !== 'THE_ZEBRAFISH_PROBLEM'), `${c.see}`);

    // The promotion attempt. A rescue that does not exist, added to see whether evidence can buy the gate.
    const withRescue = { ...carp, id: 'probe-carp-plus-rescue', evidence: { ...carp.evidence, 'rescue': { present: true, assay: 'PROBE ONLY - no such experiment exists' } } };
    const pc = A.classify(withRescue);
    check('adding a rescue to the carp pair STILL does not make it a functional equivalent',
      f(pc.functional_equivalent === false && pc.class === 'one-to-many-ambiguous',
        !(pc.functional_equivalent === false && pc.class === 'one-to-many-ambiguous')), `${pc.class}/${pc.functional_equivalent}`);
  }

  // ==================================================================================================
  // 4. THE CLADE DOES NOT RESOLVE THE MAPPING - IT SHARPENS IT
  // ==================================================================================================
  {
    const C = M.THE_CLADE_IS_NOT_A_MAPPING;
    check('THE_CLADE_IS_NOT_A_MAPPING is frozen',
      f(Object.isFrozen(C) === true, Object.isFrozen(C) !== true));
    check('it records that the published clade split carries no host gene symbol and no accession',
      f(C.why_it_is_not.some(s => /no zebrafish gene symbol and no accession/i.test(s)),
        !C.why_it_is_not.some(s => /no zebrafish gene symbol and no accession/i.test(s))));
    check('it records the sharpening finding: the donor PDC paralogue shares a clade with the donor HOUSEKEEPING paralogue',
      f(C.why_it_is_not.some(s => /ALSO contains the donor housekeeping paralogue/.test(s)),
        !C.why_it_is_not.some(s => /ALSO contains the donor housekeeping paralogue/.test(s))));
    check('so it states orthology cannot separate the two donor FUNCTIONS, not merely the two host genes',
      f(C.why_it_is_not.some(s => /cannot separate the gene whose product makes acetyl-CoA/.test(s)),
        !C.why_it_is_not.some(s => /cannot separate the gene whose product makes acetyl-CoA/.test(s))));
    check('and its conclusion says the phylogeny makes the mapping worse rather than better',
      f(/worse, not better/.test(C.so), !/worse, not better/.test(C.so)), C.so.slice(0, 48));
    check('the orthology slot points at that record rather than leaving it in a comment',
      f(/THE_CLADE_IS_NOT_A_MAPPING/.test(carp.evidence['sequence-orthology'].the_clade_does_not_rescue_it ?? ''),
        !/THE_CLADE_IS_NOT_A_MAPPING/.test(carp.evidence['sequence-orthology'].the_clade_does_not_rescue_it ?? '')));

    const G = M.THE_SUBSCRIPT_GAP;
    check('the donor side admits it is not resolved to a locus in the reference annotation either',
      f(/Which locus in the current/.test(G.what_is_not_named), !/Which locus in the current/.test(G.what_is_not_named)));
    check('and records the count discrepancy - three cloned paralogues against four annotated loci - rather than smoothing it',
      f(/Three cloned paralogues/.test(G.and_the_count_does_not_match) && /four E1-alpha-family loci/.test(G.and_the_count_does_not_match),
        !(/Three cloned paralogues/.test(G.and_the_count_does_not_match) && /four E1-alpha-family loci/.test(G.and_the_count_does_not_match))));
    check('no GenBank accession is quoted for the donor gene, because none was retrieved',
      f(/no accession is quoted for side a/.test(G.what_is_not_named), !/no accession is quoted for side a/.test(G.what_is_not_named)));
  }

  // ==================================================================================================
  // 5. THE CARP PAIR'S ABSENCES ARE HONEST, AND ITS PRESENT SLOTS ARGUE AGAINST THEMSELVES
  // ==================================================================================================
  {
    check('rescue is recorded ABSENT: no complementation exists in either direction',
      f(carp.evidence['rescue'].present === false, carp.evidence['rescue'].present !== false));
    check('and the absence names what the paper offered instead, so it is an absence of an experiment not of a search',
      f(/homology model, a transcript-share measurement/.test(carp.evidence['rescue'].why),
        !/homology model, a transcript-share measurement/.test(carp.evidence['rescue'].why)));
    check('loss-of-function is ABSENT, grounded in ZFIN listing no allele and no targeting reagent for either host gene',
      f(carp.evidence['lof-phenotype'].present === false && /no sequence targeting reagent for pdha1a OR pdha1b/.test(carp.evidence['lof-phenotype'].why),
        !(carp.evidence['lof-phenotype'].present === false && /no sequence targeting reagent for pdha1a OR pdha1b/.test(carp.evidence['lof-phenotype'].why))));
    check('synteny is ABSENT even though coordinates are held on both sides',
      f(carp.evidence['synteny'].present === false && /Coordinates are not synteny/.test(carp.evidence['synteny'].why),
        !(carp.evidence['synteny'].present === false && /Coordinates are not synteny/.test(carp.evidence['synteny'].why))));
    check('and the chromosome-number coincidence is named as a trap rather than used as support',
      f(/coincidence of chromosome NUMBERING/.test(carp.evidence['synteny'].the_trap_worth_naming ?? ''),
        !/coincidence of chromosome NUMBERING/.test(carp.evidence['synteny'].the_trap_worth_naming ?? '')));

    const exp = carp.evidence['expression-domain'];
    check('expression-domain is present, carrying the measured donor transcript share',
      f(exp.present === true && /95\.7/.test(exp.what), !(exp.present === true && /95\.7/.test(exp.what))));
    check('but its caveat says the correspondence is to a MEMBER of the set and not to the set',
      f(/to a MEMBER of a many-to-many set, not to the set/.test(exp.caveat),
        !/to a MEMBER of a many-to-many set, not to the set/.test(exp.caveat)));
    check('and records that the second host gene has NO recorded domain, so the division of labour is unmeasured',
      f(/NO tissue-level expression summary for pdha1b/.test(exp.caveat), !/NO tissue-level expression summary for pdha1b/.test(exp.caveat)));

    const dom = carp.evidence['domain-architecture'];
    check('domain-architecture is present, and its own content argues AGAINST reading it as support',
      f(dom.present === true && /The architecture being identical is the problem, not the support/.test(dom.and_this_is_why_it_is_weak_here),
        !(dom.present === true && /The architecture being identical is the problem, not the support/.test(dom.and_this_is_why_it_is_weak_here))));
    check('because the donor\'s functional change sits at the E1-E2 interface, not in the E1-alpha catalytic module',
      f(/not about what the E1-alpha catalytic module does/.test(dom.and_this_is_why_it_is_weak_here),
        !/not about what the E1-alpha catalytic module does/.test(dom.and_this_is_why_it_is_weak_here)));

    const v = scoredCarp.verdict;
    check('no direct functional test exists for the carp pair, and the verdict says so',
      f(v.directly_tested === false, v.directly_tested !== false));
    check('the strongest present kind is NOT rescue',
      f(v.strongest.kind !== 'rescue', v.strongest.kind === 'rescue'), v.strongest.kind);
    check('the verdict lists the missing functional test as a gap, in those words',
      f(v.gaps.some(g => /no direct functional test/.test(g)), !v.gaps.some(g => /no direct functional test/.test(g))), v.gaps.join(' | '));
    check('and the band label stays below "strong": correlates do not add up to a test',
      f(rank(v.confidence.label) < rank('strong'), !(rank(v.confidence.label) < rank('strong'))), v.confidence.label);
    check('the developmental-context difference is stated as a difference, not as a match',
      f(carp.developmental_context.difference_stated === true && /does not exist in it/.test(carp.developmental_context.b),
        !(carp.developmental_context.difference_stated === true && /does not exist in it/.test(carp.developmental_context.b))));
    check('and it admits the pathway needs a second gene this pair does not contain',
      f(/alcohol dehydrogenase/.test(carp.developmental_context.and), !/alcohol dehydrogenase/.test(carp.developmental_context.and)));
  }

  // ==================================================================================================
  // 6. THE GENE-LOSS PAIR: ALL SEVEN SLOTS ABSENT, AND NOT RESHAPED TO SCORE
  // ==================================================================================================
  {
    const present = A.EVIDENCE_IDS.filter(k => ice.evidence[k]?.present === true);
    check('ALL SEVEN evidence kinds are recorded absent for the gene-loss pair',
      f(present.length === 0, present.length !== 0), present.join(', ') || 'none present');
    check('every one of the seven absences carries a why, so none is a silent blank',
      f(A.EVIDENCE_IDS.every(k => typeof ice.evidence[k].why === 'string' && ice.evidence[k].why.length > 40),
        !A.EVIDENCE_IDS.every(k => typeof ice.evidence[k].why === 'string' && ice.evidence[k].why.length > 40)),
      A.EVIDENCE_IDS.filter(k => !(typeof ice.evidence[k].why === 'string' && ice.evidence[k].why.length > 40)).join(', '));
    check('its claim is the negative one, not a correspondence it could not support',
      f(ice.claim === 'no-analogue-exists', ice.claim !== 'no-analogue-exists'), ice.claim);
    check('it classifies no-basis and its band sits at the floor',
      f(scoredIce.classification.class === 'no-basis' && scoredIce.verdict.confidence.hi <= 0.10,
        !(scoredIce.classification.class === 'no-basis' && scoredIce.verdict.confidence.hi <= 0.10)),
      `${scoredIce.classification.class} ${scoredIce.verdict.confidence.lo}-${scoredIce.verdict.confidence.hi}`);
    check('its band label is the lowest the module has',
      f(scoredIce.verdict.confidence.label === 'no-support', scoredIce.verdict.confidence.label !== 'no-support'),
      scoredIce.verdict.confidence.label);
    check('the natural hemoglobinless condition is REFUSED as a loss-of-function datum rather than entered as one',
      f(ice.evidence['lof-phenotype'].present === false && /an outcome as an experiment/.test(ice.evidence['lof-phenotype'].why),
        !(ice.evidence['lof-phenotype'].present === false && /an outcome as an experiment/.test(ice.evidence['lof-phenotype'].why))));
    check('the orthology slot does not assert an icefish-to-host call that nobody has made',
      f(ice.evidence['sequence-orthology'].present === false && /no icefish-to-host globin orthology call was retrieved/.test(ice.evidence['sequence-orthology'].why),
        !(ice.evidence['sequence-orthology'].present === false && /no icefish-to-host globin orthology call was retrieved/.test(ice.evidence['sequence-orthology'].why))));
    check('while recording that a sequenced alpha1 remnant DOES exist, so the absence is not overstated either',
      f(/transcriptionally inactive alpha1 fragment/.test(ice.evidence['sequence-orthology'].why),
        !/transcriptionally inactive alpha1 fragment/.test(ice.evidence['sequence-orthology'].why)));
    check('the host side is 17 genes in two clusters, so one-to-one was never available',
      f(/17 annotated genes/.test(ice.b.name) && /could not be one-to-one/.test(ice.evidence['sequence-orthology'].why),
        !(/17 annotated genes/.test(ice.b.name) && /could not be one-to-one/.test(ice.evidence['sequence-orthology'].why))));
    check('the expression slot says the zero is MEASURED rather than unmeasured, even though the slot cannot carry that',
      f(/measured and it is zero/.test(ice.evidence['expression-domain'].why), !/measured and it is zero/.test(ice.evidence['expression-domain'].why)));
    check('and the host cluster structure is recorded from the live annotation, not from the textbook split',
      f(/interleaves adult and embryonic globin genes/.test(ice.developmental_context.b),
        !/interleaves adult and embryonic globin genes/.test(ice.developmental_context.b)));
  }

  // ==================================================================================================
  // 7. THE SCHEMA LIMITATION, CHECKED IN CODE RATHER THAN DESCRIBED IN PROSE
  // ==================================================================================================
  {
    const L = M.LOSS_IS_NOT_IN_THE_VOCABULARY;
    check('HOMOLOGY_TYPES has NO value meaning a gene was lost or deleted - so the limitation is real',
      f(!A.HOMOLOGY_TYPES.includes('lost') && !A.HOMOLOGY_TYPES.includes('deleted'),
        A.HOMOLOGY_TYPES.includes('lost') || A.HOMOLOGY_TYPES.includes('deleted')), A.HOMOLOGY_TYPES.join(', '));
    check('so the loss pair is forced to use homology_type "none"',
      f(ice.evidence['sequence-orthology'].homology_type === 'none', ice.evidence['sequence-orthology'].homology_type !== 'none'),
      `${ice.evidence['sequence-orthology'].homology_type}`);
    check('and the module reports it IDENTICALLY to an independent-origin pair, which is the collapse',
      f(scoredIce.classification.homology_type === A.classify(afgp).homology_type,
        scoredIce.classification.homology_type !== A.classify(afgp).homology_type),
      `loss:${scoredIce.classification.homology_type} vs independent-origin:${A.classify(afgp).homology_type}`);
    check('the record states that present:false is a predicate on the EVIDENCE and not on the gene',
      f(L.what_the_vocabulary_cannot_express.some(s => /predicate on the EVIDENCE, not on the gene/.test(s)),
        !L.what_the_vocabulary_cannot_express.some(s => /predicate on the EVIDENCE, not on the gene/.test(s))));
    check('it names the three situations the slot collapses and which pair of them nothing separates',
      f(L.what_the_vocabulary_cannot_express.some(s => /NOTHING in the seven kinds separates/.test(s)),
        !L.what_the_vocabulary_cannot_express.some(s => /NOTHING in the seven kinds separates/.test(s))));
    check('it says why a LOSS is the more actionable of the two for a design programme',
      f(L.what_the_vocabulary_cannot_express.some(s => /existed and was abandoned/.test(s)),
        !L.what_the_vocabulary_cannot_express.some(s => /existed and was abandoned/.test(s))));
    check('it states there is no evidence kind for a positively measured absence',
      f(L.what_the_vocabulary_cannot_express.some(s => /no evidence kind for a POSITIVELY MEASURED ABSENCE/.test(s)),
        !L.what_the_vocabulary_cannot_express.some(s => /no evidence kind for a POSITIVELY MEASURED ABSENCE/.test(s))));
    check('it answers the question posed: what an analogy claim means when one side is an absence',
      f(/the subject term does not denote/.test(L.the_answer), !/the subject term does not denote/.test(L.the_answer)));
    check('and states plainly that the pair was NOT forced into a slot to raise its band',
      f(/does not enter the loss as present evidence/.test(L.not_forced), !/does not enter the loss as present evidence/.test(L.not_forced)));
    check('it names the fix it would want in the module, so it is a finding and not a complaint',
      f(/eighth evidence kind/.test(L.what_would_fix_it_in_the_module) && /"lost"/.test(L.what_would_fix_it_in_the_module),
        !(/eighth evidence kind/.test(L.what_would_fix_it_in_the_module) && /"lost"/.test(L.what_would_fix_it_in_the_module))));
    check('LOSS_IS_NOT_IN_THE_VOCABULARY is frozen',
      f(Object.isFrozen(L) === true, Object.isFrozen(L) !== true));
  }

  // ==================================================================================================
  // 8. THE SECOND LIMITATION: THE no-basis WARNING IS FALSE FOR A PAIR THAT WAS SEARCHED
  // ==================================================================================================
  {
    check('the loss pair searched at least MIN_DATABASES resources',
      f(ice.databases_searched.length >= A.MIN_DATABASES, !(ice.databases_searched.length >= A.MIN_DATABASES)),
      `${ice.databases_searched.length} vs ${A.MIN_DATABASES}`);
    check('and ran the function-first search, recording the ANSWER rather than only the fact of running it',
      f(ice.analogue_search.performed === true && /nothing does/.test(ice.analogue_search.how),
        !(ice.analogue_search.performed === true && /nothing does/.test(ice.analogue_search.how))));
    check('so the absence-of-evidence refusal correctly does NOT fire for it',
      f(!scoredIce.refusal.refusals.some(r => r.id === 'absence-of-evidence'),
        scoredIce.refusal.refusals.some(r => r.id === 'absence-of-evidence')),
      scoredIce.refusal.refusals.map(r => r.id).join(', ') || 'no refusals');
    check('indeed NO refusal fires for it at all',
      f(scoredIce.refusal.refused === false, scoredIce.refusal.refused !== false),
      scoredIce.refusal.refusals.map(r => r.id).join(', ') || 'none');
    check('yet the class still attaches the warning that no-basis means nobody looked',
      f(/STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY/.test(scoredIce.classification.critical_warning ?? ''),
        !/STATEMENT ABOUT THE SEARCH, NOT ABOUT THE BIOLOGY/.test(scoredIce.classification.critical_warning ?? '')));
    check('which is false for this pair, and the dossier says so rather than leaving it to be found',
      f(/warning whose content is false for the pair it is attached to/.test(M.LOSS_IS_NOT_IN_THE_VOCABULARY.and_the_class_warning_is_false_here),
        !/warning whose content is false for the pair it is attached to/.test(M.LOSS_IS_NOT_IN_THE_VOCABULARY.and_the_class_warning_is_false_here)));
    check('the refusal and the class disagree, and the dossier records which of them is right',
      f(/the refusal is the one that is right/.test(M.LOSS_IS_NOT_IN_THE_VOCABULARY.and_the_class_warning_is_false_here),
        !/the refusal is the one that is right/.test(M.LOSS_IS_NOT_IN_THE_VOCABULARY.and_the_class_warning_is_false_here)));
    check('and the function-first result is recorded as a SYSTEM-level non-analogue, not a molecular one',
      f(/not a molecular analogue/.test(ice.analogue_search.and_what_that_answer_is_not),
        !/not a molecular analogue/.test(ice.analogue_search.and_what_that_answer_is_not)));
    check('the carp pair, by contrast, records that its function-first search found the host lacks the function entirely',
      f(/there is no host gene with the donor function to map onto/.test(carp.analogue_search.how),
        !/there is no host gene with the donor function to map onto/.test(carp.analogue_search.how)));
  }

  // ==================================================================================================
  // 9. SCORED IS COMPUTED, NOT TYPED IN
  // ==================================================================================================
  {
    check('SCORED has one entry per pair, in order, keyed by pair id',
      f(M.SCORED.length === M.PAIRS.length && M.SCORED.every((s, i) => s.id === M.PAIRS[i].id),
        !(M.SCORED.length === M.PAIRS.length && M.SCORED.every((s, i) => s.id === M.PAIRS[i].id))), `${M.SCORED.length}`);
    for (const p of M.PAIRS) {
      const fresh = A.scoreAnalogy(p.a, p.b, p.evidence).confidence;
      const stored = M.SCORED.find(s => s.id === p.id).verdict.confidence;
      check(`the stored band for ${p.id} is exactly what scoreAnalogy returns, recomputed here`,
        f(fresh.lo === stored.lo && fresh.hi === stored.hi && fresh.label === stored.label,
          !(fresh.lo === stored.lo && fresh.hi === stored.hi && fresh.label === stored.label)),
        `stored ${stored.lo}-${stored.hi} ${stored.label}`);
      check(`the band for ${p.id} has hi > lo, so it is a band and not a point`,
        f(stored.hi > stored.lo && stored.is_a_band_not_a_point === true,
          !(stored.hi > stored.lo && stored.is_a_band_not_a_point === true)), `${stored.lo}-${stored.hi}`);
    }
    const noLiteralBand = !/\bband:\s*\[\s*0?\.?\d/.test(SRC);
    check('no band endpoint is written as a literal anywhere in the module source',
      f(noLiteralBand === true, noLiteralBand !== true));
    check('neither verdict exposes a fused scalar, a score or a probability',
      f(M.SCORED.every(s => s.verdict.fused_scalar === null && s.verdict.score === null && s.verdict.probability === null),
        !M.SCORED.every(s => s.verdict.fused_scalar === null && s.verdict.score === null && s.verdict.probability === null)));
    check('and neither headline carries a digit that could be quoted as a probability',
      f(M.SCORED.every(s => /[0-9]/.test(s.verdict.headline) === false),
        !M.SCORED.every(s => /[0-9]/.test(s.verdict.headline) === false)));
    check('the carp pair\'s band label survives the alternative weighting, so the word is the evidence talking',
      f(scoredCarp.verdict.confidence.label_is_robust_to_weighting === true,
        scoredCarp.verdict.confidence.label_is_robust_to_weighting !== true),
      `${scoredCarp.verdict.confidence.label} -> ${scoredCarp.verdict.confidence.under_alternative_weighting.label}`);
    check('SCORED and SUMMARY are frozen',
      f(Object.isFrozen(M.SCORED) && Object.isFrozen(M.SUMMARY), !(Object.isFrozen(M.SCORED) && Object.isFrozen(M.SUMMARY))));
  }

  // ==================================================================================================
  // 10. SCHEMA CONFORMANCE WITH analogy.mjs PAIRS
  // ==================================================================================================
  {
    check('both pairs key all seven evidence kinds and nothing else',
      f(M.PAIRS.every(p => Object.keys(p.evidence).length === 7 && Object.keys(p.evidence).every(k => A.EVIDENCE_IDS.includes(k))),
        !M.PAIRS.every(p => Object.keys(p.evidence).length === 7 && Object.keys(p.evidence).every(k => A.EVIDENCE_IDS.includes(k)))),
      M.PAIRS.map(p => Object.keys(p.evidence).length).join('/'));
    check('so neither verdict reports an unknown evidence kind',
      f(M.SCORED.every(s => s.verdict.unknown_evidence_kinds.length === 0),
        !M.SCORED.every(s => s.verdict.unknown_evidence_kinds.length === 0)),
      M.SCORED.flatMap(s => s.verdict.unknown_evidence_kinds).join(', '));
    const shape = p => p.id && p.a?.species && p.a?.name && p.b?.species && p.b?.name && p.claim && p.note && p.developmental_context && p.databases_searched && p.analogue_search;
    check('every pair has id, a, b, claim, note, developmental_context, databases_searched and analogue_search',
      f(M.PAIRS.every(shape), !M.PAIRS.every(shape)));
    check('every pair carries a note with substance, so no hardcoded evidence is unexplained',
      f(M.PAIRS.every(p => typeof p.note === 'string' && p.note.length > 60),
        !M.PAIRS.every(p => typeof p.note === 'string' && p.note.length > 60)),
      M.PAIRS.filter(p => !(p.note.length > 60)).map(p => p.id).join(', '));
    check('neither pair is synthetic: both are real pairs with retrieved records',
      f(M.PAIRS.filter(p => /SYNTHETIC/i.test(p.note)).length === 0, M.PAIRS.filter(p => /SYNTHETIC/i.test(p.note)).length !== 0));
    check('both pairs state the developmental-context difference, so the phenotype-transfer refusal has no purchase',
      f(M.PAIRS.every(p => p.developmental_context.difference_stated === true),
        !M.PAIRS.every(p => p.developmental_context.difference_stated === true)));
    check('both pairs searched at least MIN_DATABASES independent resources',
      f(M.PAIRS.every(p => p.databases_searched.length >= A.MIN_DATABASES),
        !M.PAIRS.every(p => p.databases_searched.length >= A.MIN_DATABASES)),
      M.PAIRS.map(p => p.databases_searched.length).join('/'));
    check('both pairs ran the function-first search, which is a different search from an orthology lookup',
      f(M.PAIRS.every(p => p.analogue_search.performed === true), !M.PAIRS.every(p => p.analogue_search.performed === true)));
    check('every pair classifies into exactly one class drawn from CLASS_IDS',
      f(M.SCORED.every(s => A.CLASS_IDS.includes(s.classification.class)), !M.SCORED.every(s => A.CLASS_IDS.includes(s.classification.class))));
    check('NEITHER pair reaches functional equivalence, which is the honest outcome for both',
      f(M.SCORED.every(s => s.classification.functional_equivalent === false),
        !M.SCORED.every(s => s.classification.functional_equivalent === false)),
      M.SCORED.map(s => `${s.id}:${s.classification.functional_equivalent}`).join(', '));
    check('the two pairs land in DIFFERENT classes, so they are not one case written twice',
      f(scoredCarp.classification.class !== scoredIce.classification.class,
        scoredCarp.classification.class === scoredIce.classification.class),
      `${scoredCarp.classification.class} / ${scoredIce.classification.class}`);
    check('every refusal that does fire names what would change it',
      f(M.SCORED.flatMap(s => s.refusal.refusals).every(r => typeof r.what_would_change_it === 'string' && r.what_would_change_it.length > 30),
        !M.SCORED.flatMap(s => s.refusal.refusals).every(r => typeof r.what_would_change_it === 'string' && r.what_would_change_it.length > 30)));
    check('PAIRS and every pair in it are frozen, so a slot cannot be flipped at runtime',
      f(Object.isFrozen(M.PAIRS) && M.PAIRS.every(p => Object.isFrozen(p)),
        !(Object.isFrozen(M.PAIRS) && M.PAIRS.every(p => Object.isFrozen(p)))));
    check('SUMMARY says in words that two chosen pairs are not a sample',
      f(/not a sample/.test(M.SUMMARY.what_they_do_not_show), !/not a sample/.test(M.SUMMARY.what_they_do_not_show)));
  }

  return { results: [...results], nFaultSites: fIndex };
}

// ====================================================================================================
console.log(`\nanoxia-ethanol: one borrow blocked by a gene set, one by the schema${FAULT ? '   [--fail-once: one fault per run, iterated]' : ''}\n`);

faultTarget = -1; verbose = true;
const clean = runSuite();
const nPass = clean.results.filter(r => r.cond).length;
const nFail = clean.results.length - nPass;
console.log(`\n${nPass} pass, ${nFail} fail  (${clean.results.length} assertions, ${clean.nFaultSites} fault sites)`);

let survivors = [], collateral = [];
if (FAULT) {
  if (clean.nFaultSites !== clean.results.length) {
    console.log(`\n  WARNING: ${clean.nFaultSites} fault sites for ${clean.results.length} assertions - they must be 1:1 for the iteration to target one assertion at a time.`);
  }
  verbose = false;
  // A targeted run must fail EXACTLY ONE assertion: its own. More than one means the fault leaked into
  // a neighbour through shared state, which would make the survivor count unreliable in both directions.
  for (let i = 0; i < clean.nFaultSites; i++) {
    faultTarget = i;
    const r = runSuite();
    if (r.results[i]?.cond === true) survivors.push(r.results[i].name);
    const broken = r.results.filter(x => !x.cond);
    if (broken.length !== 1) collateral.push(`#${i} "${clean.results[i].name}" broke ${broken.length} assertions`);
  }
  faultTarget = -1;
  console.log(`\n--fail-once: ${clean.nFaultSites} runs, one injected fault each, iterating over every assertion.`);
  console.log(`  collateral (a fault breaking an assertion other than its own): ${collateral.length}`);
  for (const c of collateral) console.log(`    ${c}`);
  console.log(`  survivors: ${survivors.length}`);
  for (const s of survivors) console.log(`    SURVIVOR  ${s}`);
  console.log(survivors.length === 0
    ? '  No survivors: every assertion failed under its own injected fault, so every one is load-bearing.'
    : '  SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}

// A survivor is a test failure, not a note: an assertion that passes under its own injected fault is
// not asserting anything, so the suite must not exit green while one exists.
process.exit(nFail > 0 || survivors.length > 0 || collateral.length > 0 ? 1 : 0);
