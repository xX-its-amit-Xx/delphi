// CANDIDATE TESTS: which zebrafish experiment is actually worth running, and what answer is already known.
//
// ============================== WHAT THIS FILE IS FOR ==============================
// sim-engine/validate/editplan/ answers "what would it take to make this edit". It does not answer the
// question a PI asks next, which is "is this experiment worth a bench-month, and will I be able to tell
// whether it worked". That second question needs a PUBLISHED EXPECTED ANSWER. An experiment with no
// expected answer cannot be passed or failed; it can only be described afterwards.
//
// So every case here carries `published_expectation`: what the literature says the result should be, with
// the quote and the citation. A case with no published expectation is still listed, and is labelled
// `expectation: null` with the reason - because "we could not find out" is the finding, and hiding it
// behind an experiment that looks runnable is how a plan becomes a trap.
//
// ============================== THE FINDING THAT ORDERS THIS FILE ==============================
// The adult bioelectric fin-size program - kcnk5b, kcnh2a, lat4a, slc12a7a - is the program the winged
// zebrafish design edits. Across that whole program the KNOCKOUTS ARE PHENOTYPICALLY NORMAL. That is
// published, it is verified below against the primary papers, and it has a hard consequence: the cheap
// edit (a frameshift knockout by NHEJ, which needs no donor, no HDR and no screening for a rare event)
// TESTS NOTHING HERE. Every informative edit in this program is a precise gain-of-function point change,
// which is the expensive route - 1-4 % error-free HDR (editplan's FEASIBILITY), two generations, and
// roughly 6-8 months before a homozygote exists.
//
// That is why the ranking below does not put the design's own edits first. The cases most likely to work
// are the ones whose answer is already known and whose readout is visible in the injected generation.
//
// ============================== SCOPE ==============================
// Danio rerio only, matching editplan's SPECIES_REFUSAL. Nothing here is a protocol, nothing here has been
// run at a bench by us, and every one of these requires institutional animal-care approval before the
// first injection (editplan FEASIBILITY.approval).

export const SCOPE =
  'Candidate tests in Danio rerio only. Each case states a PUBLISHED expected answer or says it has none. ' +
  'Nothing here has been run at a bench by us. Nothing here is a protocol. Institutional animal-care ' +
  'approval (IACUC or the local equivalent) is required before the first injection.';

/** How confident we are that a competent zebrafish lab gets an interpretable result first time.
 *  These are OUR labels over published evidence, not measured probabilities, and they say so. */
export const CONFIDENCE_SCALE = {
  kind: 'ORDINAL LABEL CHOSEN BY US over published evidence. Not a probability, not fitted, not measured.',
  levels: {
    'replication-grade': 'the phenotype is binary or near-binary, visible without genotyping, reported at high penetrance in the injected generation, and used by other labs as a control. Failure means the injection failed, not that the biology is unclear.',
    'quantitative-but-small': 'the readout is continuous and published, but the effect is small or its dispersion is not in the paper. A real test must be powered from source data first, and that step is part of the plan.',
    'needs-two-generations': 'no interpretable readout exists in the injected fish. The answer is real but is 6-8 months and two crosses away.',
    'no-published-expectation': 'there is no number or binary outcome in the literature to pass or fail against. Running it produces a description, not a test.',
  },
};

// ---------------------------------------------------------------------------------------------------
// VERIFIED QUOTES. Every quote below was read from the publisher's own page in this run, not from a
// review and not from memory. `verified_in_this_run: true` means exactly that and nothing more: it does
// NOT mean we reproduced the experiment, and it does not mean the paper is right.
// ---------------------------------------------------------------------------------------------------
export const KNOCKOUTS_ARE_NORMAL = {
  headline: 'In the fin-size program the winged-zebrafish design edits, loss of function does not change fin size. The informative edits are all precise gain-of-function point changes.',
  why_it_matters_for_cost:
    'A frameshift knockout needs only a guide and Cas9, is read out in injected embryos, and costs almost nothing. ' +
    'A precise point change needs an ssODN donor, recovers at 1-4 % of alleles error-free (Boel 2018, see editplan ' +
    'FEASIBILITY), and cannot be scored until F1 or F2. Choosing this program commits the lab to the expensive route ' +
    'before a single reagent is ordered. Nothing in the edit plan says so, which is why it is said here.',
  evidence: [
    { gene: 'kcnk5b', finding: 'the null allele has wild-type fins', quote: 'A revertant of alf^dty86d (j131x8) shows wild type-sized fins.', where: 'Figure 3 legend (D)',
      also: 'Homozygotes harboring the deletion are viable and fertile; thus, kcnk5b is not essential for zebrafish development.',
      citation: 'Perathoner et al. 2014, PLoS Genet 10(1):e1004080, doi 10.1371/journal.pgen.1004080, PMID 24453984',
      kind: 'measured', verified_in_this_run: true },
    { gene: 'kcnh2a', finding: 'homozygous loss does not change fin length', quote: 'homozygous loss of kcnh2a has no overt effects on zebrafish development to adulthood, including fin length', where: 'Discussion',
      also: 'phenotypically normal with fin sizes indistinguishable from wild-type clutchmates (of lof^t2/t2; kcnh2a^b1391/b1391 fish)',
      citation: 'Stewart et al. 2021, Development 148(11):dev199384, doi 10.1242/dev.199384, PMID 34061172',
      kind: 'measured', verified_in_this_run: true },
    { gene: 'lat4a', finding: 'loss-of-function homozygotes are phenotypically normal, so the fin effect needs the point allele and not a knockout',
      quote: 'Zebrafish with homozygous loss-of-function mutations in lat4a are phenotypically normal and viable (S7 Fig).', where: 'Results',
      citation: 'Daane et al. 2021, Curr Biol 31(22):5052-5061.e8, doi 10.1016/j.cub.2021.08.054, PMID 34534441',
      kind: 'measured', verified_in_this_run: true,
      caveat: 'the quote was read from the preprint (doi 10.1101/2021.03.05.434157), not from the Current Biology version of record. The sentence may have been edited in review; the finding is not expected to have changed, but the wording is the preprint\'s.' },
  ],
};

export const ALLELE_CORRECTIONS = [
  {
    id: 'kcnk5b-two-alleles-not-one-genotype',
    about: 'the two kcnk5b edits in the current edit plan (p.W169L and p.F241Y)',
    what_the_plan_implies: 'that both point changes belong to one design, and so would be built into one fish.',
    what_the_literature_says: 'They are ONE substitution each in TWO SEPARATE alleles of another longfin: alf^dty86d and alf^dt30mh (also called pfau), each isolated in its own mutagenesis screen.',
    quote: 'In both alf alleles, distinct missense mutations (W169L and F241Y) were identified in the coding sequence for kcnk5b',
    where: 'Results, "The alf phenotype is due to missense mutations in kcnk5b"',
    citation: 'Perathoner et al. 2014, doi 10.1371/journal.pgen.1004080',
    verified_in_this_run: true,
    consequence: 'A fish carrying both changes is NOT a published genotype and has no published expected answer. Each allele separately does. Build one, not both, or state plainly that the double is novel and unpredicted.',
    not_established: 'WHICH allele carries WHICH substitution. The paper assigns them only in an electropherogram figure (Fig. 3B) and states no nucleotide change. A lab must Sanger-confirm the assignment in its own strain, or ask the depositing laboratory, before ordering a donor.',
  },
  {
    id: 'alf-is-dominant',
    about: 'zygosity for the kcnk5b alleles',
    what_the_literature_says: 'dominant, with a stronger homozygous phenotype.',
    quote: 'alf mutations are dominant and lead to overgrown fins and barbels in the adult.',
    where: 'Figure 1 legend (A)',
    citation: 'Perathoner et al. 2014, doi 10.1371/journal.pgen.1004080',
    verified_in_this_run: true,
    consequence: 'A heterozygous F1 already shows the phenotype, so an F2 intercross is NOT required to see an effect. That removes roughly three months and one cross from the cheapest informative version of this experiment - the single largest schedule saving available anywhere in this plan.',
  },
  {
    id: 'kcnh2a-allele-is-regulatory-not-coding',
    about: 'editing kcnh2a as a knockout',
    what_the_literature_says: 'The fin allele is not a coding change at all. longfin t2 is a chromosome-2 inversion that drives ectopic kcnh2a expression in the fin; the coding sequence is intact.',
    quote: 'loft2 likely is a regulatory kcnh2a neomorphic allele.',
    also: 'loft2-linked kcnh2a had no exon or intron/exon boundary non-synonymous mutations or unappreciated SNPs; kcnh2a was greatly elevated in loft2/+ animals (+25.8-fold)',
    citation: 'Stewart et al. 2021, doi 10.1242/dev.199384',
    verified_in_this_run: true,
    consequence: 'No guide-and-donor edit of the kcnh2a coding sequence reproduces this allele. Reproducing it means engineering an inversion or an ectopic expression cassette, which is a different and much larger project than a point change, and the edit planner does not design it.',
  },
];

export const CASES = [
  // ---- the design's own edits, listed honestly rather than first -------------------------------------
  {
    id: 'kcnk5b-alf-knockin',
    rank: null,              // filled by rank() below
    question: 'Does installing a published another-longfin substitution in kcnk5b enlarge the fins?',
    relation_to_the_design: 'This IS the winged-zebrafish design\'s fin-enlargement mechanism, as close as a single edit gets to it.',
    organism: 'danio_rerio', base: 'wild-type AB/TU', edit: { gene: 'kcnk5b', change: 'p.W169L or p.F241Y (ONE of them - see ALLELE_CORRECTIONS)', kind: 'point, gain-of-function' },
    assay: 'fin length normalised to standard length, as an allometric coefficient',
    readout_stage: 'adult (reproductively mature, >3 months)',
    scorable_in_injected_generation: false,
    published_expectation: {
      what: 'the allometric coefficient of fin length against standard length rises from about 1.29 in wild type to near 2 in heterozygotes',
      numbers: 'wild type k=1.29 (R^2=0.92); alf/+ k near 2 (R^2=0.95); n=4 per group, error bars SD',
      citation: 'Perathoner et al. 2014, Fig. 1B-D, doi 10.1371/journal.pgen.1004080',
      kind: 'measured', caveat: 'n=4 per group. Absolute fin and segment lengths are in figures only and were not sourced as numbers. The paper also reports the segment NUMBER is not increased, so a replication should measure segment length, not count segments.',
    },
    confidence: 'needs-two-generations',
    why: 'The edit is a precise point change, so it recovers at the HDR rate (1-4 % of alleles error-free, Boel 2018) and cannot be read in the mosaic F0. But the allele is DOMINANT, so an F1 heterozygote suffices - one cross, not two.',
    cost_drivers: ['ssODN donor', 'F1 screening by amplicon sequencing', 'raising F0 to maturity (~3 months)'],
    what_would_falsify: 'a clean heterozygous F1 carrying the designed substitution whose fin allometry is indistinguishable from its wild-type clutchmates, measured blind to genotype',
  },
  {
    id: 'kcnk5b-f0-finbud',
    question: 'Does disrupting kcnk5b change pectoral fin bud growth in the injected embryo?',
    relation_to_the_design: 'Tests the same gene as the design, in two days instead of six months - but in the OPPOSITE direction. Knockout shrinks the bud; the design wants enlargement. It tests that the gene is in the pathway, not that the design works.',
    organism: 'danio_rerio', base: 'wild-type AB/TU', edit: { gene: 'kcnk5b', change: 'frameshift knockout', kind: 'NHEJ, no donor' },
    assay: 'pectoral fin bud area normalised to eye area at 48 hpf',
    readout_stage: '48 hpf',
    scorable_in_injected_generation: true,
    published_expectation: {
      what: 'fin buds of kcnk5b-targeted embryos are reduced in size by 48 hpf, and the reduction is rescued by an sgRNA-resistant kcnk5b mRNA',
      quote: 'fin buds of kcnk5b-targeted embryos were reduced in size by 48 hpf',
      numbers: null,
      citation: 'Jiang et al. 2024, PLoS Biol 22(3):e3002565, doi 10.1371/journal.pbio.3002565, PMID 38527087, Fig. 4D-E',
      kind: 'measured', verified_in_this_run: true,
      caveat: 'NO means, standard deviations, sample sizes or p-values appear in the main text for this comparison - they exist only in the figure legends and the S1-S7 source data. The authors themselves write that the changes "are not large, but they are biologically significant". A replication therefore CANNOT be powered without first obtaining the source data, and that step belongs in the plan rather than being assumed away. One lab, not yet replicated elsewhere.',
    },
    measure_at_48_hpf_because: 'the paper scores at 48 hpf specifically to avoid the finfold growth that begins around 56 hpf. Scoring later measures a different thing.',
    confidence: 'quantitative-but-small',
    why: 'Injected generation, scale-free normalisation, and a genuine specificity control (rescue by a wobble-mutated mRNA). Against it: a small effect whose dispersion is unpublished, from a single laboratory.',
    cost_drivers: ['guides only, no donor', 'imaging and area measurement', 'obtaining source data to power the test'],
    what_would_falsify: 'bud-area-to-eye-area ratios in kcnk5b crispants that fall within the control distribution at a sample size powered from the source data, with cutting at the locus confirmed by amplicon sequencing in the same clutch',
  },
  {
    id: 'hhip-knockout-radials',
    question: 'Does loss of hhip change the number of fin radial bones?',
    relation_to_the_design: 'hhip is the design\'s second edit. Unlike the bioelectric genes, its knockout DOES have a published skeletal phenotype, so here the cheap edit is informative.',
    organism: 'danio_rerio', base: 'wild-type', edit: { gene: 'hhip', change: 'frameshift knockout in an early coding exon', kind: 'NHEJ, no donor' },
    assay: 'radial bone counts in the pectoral and pelvic fins; ventral hypural count; larval pectoral fin primordium length',
    readout_stage: 'larval for the primordium; adult for the bone counts',
    scorable_in_injected_generation: false,
    published_expectation: {
      what: 'wild-type pectoral fins have four radials and mutants have more; pelvic radials increase beyond four; ventral hypurals increase from two to five; the anal fin skeleton is completely absent; the pectoral endochondral disk is elongated along the antero-posterior axis',
      numbers: null,
      citation: 'Tanaka et al. 2024, Development 151(22):dev202526, doi 10.1242/dev.202526, PMID 39417578',
      kind: 'measured', verified_in_this_run: false,
      caveat: 'No means, standard deviations or p-values appear in the text; n is five mutant and five wild-type fish for the adult skeletons. Counts are integers with a published direction, which is a usable expectation, but there is no dispersion to power against. Adult skeletons are reported as often fused and unrecognisable, which will cost scorable animals.',
    },
    confidence: 'needs-two-generations',
    why: 'Recessive, so an F0 mosaic shows at best a partial effect and a real test needs homozygotes: two generations, about six months. The edit itself is the cheap kind.',
    cost_drivers: ['F2 intercross', 'skeletal preparation and imaging', 'six months of husbandry'],
    side_effect_the_design_should_account_for: 'the anal fin skeleton is reported completely absent in the mutant. A design that wants larger paired fins gets this too.',
    what_would_falsify: 'homozygous F2 mutants whose pectoral radial counts are four, like wild type, with the frameshift confirmed on both alleles by sequencing',
  },
  {
    id: 'kcnh2a-knockout',
    question: 'Does knocking out kcnh2a change fin length?',
    relation_to_the_design: 'kcnh2a is one of the two loci of the published winged-zebrafish double heterozygote, so it looks like an obvious target. It is a trap, and the case is listed in order to say so.',
    organism: 'danio_rerio', base: 'wild-type', edit: { gene: 'kcnh2a', change: 'frameshift knockout', kind: 'NHEJ, no donor' },
    assay: 'fin length',
    readout_stage: 'adult',
    scorable_in_injected_generation: false,
    published_expectation: {
      what: 'NO CHANGE. Homozygous loss of kcnh2a does not affect fin length.',
      quote: 'homozygous loss of kcnh2a has no overt effects on zebrafish development to adulthood, including fin length',
      citation: 'Stewart et al. 2021, doi 10.1242/dev.199384',
      kind: 'measured', verified_in_this_run: true,
    },
    confidence: 'replication-grade',
    why_it_is_listed: 'Its expected answer is a published NULL RESULT, and that makes it valuable for exactly one purpose: as a negative control proving the assay does not manufacture effects. It is worthless as a test of the design, because the design\'s allele is not a knockout at all (see ALLELE_CORRECTIONS kcnh2a-allele-is-regulatory-not-coding).',
    confidence_note: 'replication-grade here means the published answer is reliably reproducible, NOT that the experiment is informative about the design.',
    what_would_falsify: 'a homozygous knockout with altered fin length, which would contradict the published result',
  },
];

/** Rank by what a PI actually trades off: can it be read in the injected generation, does it have a
 *  published number to pass or fail against, and how many months before an answer exists. */
export const RANKING_RULE =
  'Ordered by (1) scorable in the injected generation, (2) has a published expected answer with numbers, ' +
  '(3) fewest generations to an answer. This is OUR ordering rule, stated so it can be disagreed with; it ' +
  'is not a score and nothing is fitted. A case is never promoted for being closer to the design - the ' +
  'design is the thing being tested, so letting it set the order would be circular.';

const CONF_ORDER = ['replication-grade', 'quantitative-but-small', 'needs-two-generations', 'no-published-expectation'];

export function rank(cases = CASES) {
  return [...cases].sort((a, b) =>
    (b.scorable_in_injected_generation ? 1 : 0) - (a.scorable_in_injected_generation ? 1 : 0) ||
    (a.published_expectation?.numbers ? 0 : 1) - (b.published_expectation?.numbers ? 0 : 1) ||
    CONF_ORDER.indexOf(a.confidence) - CONF_ORDER.indexOf(b.confidence)
  ).map((c, i) => ({ ...c, rank: i + 1 }));
}

export function caseById(id) { return CASES.find(c => c.id === id) ?? null; }
