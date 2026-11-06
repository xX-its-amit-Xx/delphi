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
      kind: 'measured', verified_in_this_run: true,
      the_authors_own_explanation: {
        quote: 'As kcnk5b has a close paralog in zebrafish, kcnk5a, which is expressed in similar tissues, the lack of a loss-of-function phenotype in normal development may be due to functional redundancy between the paralogs.',
        where: 'Results',
        verified_in_this_run: true,
        why_this_was_missing: 'The first version of this file recorded the null phenotype without the paper\'s own explanation for it. That omission mattered: read without the paralog sentence, "the knockout is normal" looks like evidence that the gene does not control fin size, when the paper reads it as redundancy.',
        consequence: 'A kcnk5a/kcnk5b DOUBLE knockout is a different experiment with no published expected answer, and it is not planned anywhere in this package or in editplan. It is the obvious next knockout if anyone wants a loss-of-function test in this program at all - and it would need its own case, its own guides and its own power calculation before it is worth ordering.',
      } },
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
  // ---- the route that was missing from this file entirely until 2026-11-06 ---------------------------
  // Every other case here is an EDIT. The published experiment that produces the direction the design
  // wants - bigger fins - in the injected generation, with no cross and no point change, is not an edit
  // at all: it is overexpression of the WILD-TYPE gene from an injected plasmid. `Tol2` appeared zero
  // times in this repository before this case was added. That is the single largest omission the bench
  // audit found, because it changes what to ask a partner lab for.
  {
    id: 'kcnk5b-overexpression-f0',
    rank: null,
    question: 'Does overexpressing kcnk5b in fin mesenchyme enlarge fins in the injected fish?',
    relation_to_the_design: 'It tests the design\'s MECHANISM in the direction the design wants (enlargement), in the injected generation, without needing the design\'s allele at all. It does not test the allele, and it does not produce a stable line.',
    organism: 'danio_rerio', base: 'wild-type one-cell zygotes',
    edit: { gene: 'kcnk5b', change: 'none - transgene overexpression, not a genome edit', kind: 'Tol2 transgenesis, injected plasmid + transposase mRNA' },
    construct: {
      what: 'ef1a:kcnk5b (wild type OR W169L) with a second ef1a:DsRed in cis, in one plasmid, co-injected with Tol2 transposase mRNA into the one-cell zygote',
      why_ef1a: 'the Xenopus laevis ef1a promoter was shown to be active in all major fin tissues',
      injection_parameters_as_published: 'plasmid 5-20 ng/ul, Tol2 mRNA 25 ng/ul, 20 % (v/v) phenol red; 275 Pa (40 psi) for 100 ms',
      note: 'This IS a cassette, and it is the only case in this package that needs one. Every other case is an F0 injection of protein and synthetic RNA, for which editplan correctly states no promoter cassette is required.',
    },
    assay: 'presence of LOCAL fin and barbel overgrowth in adults, scored against DsRed-positive mesenchyme in the same fin',
    readout_stage: 'adult (injected fish raised to adulthood)',
    months_to_answer: 4,
    scorable_in_injected_generation: true,
    published_expectation: {
      what: 'local overgrowth in a substantial minority of injected fish that carry DsRed-positive fin cells, tightly associated with DsRed in the MESENCHYME specifically, and absent in both a DsRed-only control and a non-conductive channel variant',
      numbers: 'control plasmid (DsRed only): 0/240 fish with overgrowth. kcnk5b (wt or W169L): overgrowth in "about 40 %" of injected fish showing DsRed-positive cells in the fins. Association of overgrowth with DsRed-positive mesenchymal tissue: 89.2 %, N = 37. Non-conductive GFG->AAA variant: no overgrowth, in fins containing DsRed-positive tissue, n = 32. Overgrown tissue with no detectable DsRed: W169L 2/26, wt 2/11.',
      quote: 'In about 40% of the fish injected with plasmids encoding wild type or mutant kcnk5b and showing DsRed positive cells in the fins we found a local overgrowth phenotype',
      also: 'these findings indicate that kcnk5b overexpression within fibroblasts of the mesenchyme is sufficient to induce fin outgrowth',
      citation: 'Perathoner et al. 2014, Results and Fig. 6, doi 10.1371/journal.pgen.1004080, PMID 24453984, PMC3894163',
      kind: 'measured', verified_in_this_run: true,
      read_the_denominator: 'The 40 % is of injected fish THAT SHOW DsRed-POSITIVE CELLS IN THE FINS, not of all injected fish. The yield per injected embryo is therefore lower than 40 % by the (unpublished) fraction that express in the fin at all, and a lab must budget on embryos injected, not on the 40 %.',
    },
    independent_support_same_paper: {
      what: 'blastula cell transplantation, which tests locality rather than sufficiency of overexpression',
      numbers: 'kcnk5b^dt30mh/+ donor cells into wild-type albino hosts, 20-40 cells at the 1000-cell stage: local overgrowth in 29 of 120 chimeras raised to adulthood; global overgrowth of all fins and barbels never observed',
      verified_in_this_run: true,
      why_it_matters: 'it is a second, methodologically independent route to the same conclusion, and it is also an F0 readout. A lab with transplantation experience may prefer it; it needs no plasmid and no transposase.',
    },
    confidence: 'replication-grade',
    why: 'A binary phenotype, scored by eye against an internal fluorescent marker, with a 0/240 negative control and a conductance-dead variant as a specificity control, at a penetrance high enough to see in tens of fish rather than hundreds.',
    the_honest_costs: [
      'the readout is in ADULTS: injected fish must be raised to adulthood, so this is months of husbandry, not the two days of the 48 hpf case. "Scorable in the injected generation" means no cross is needed - it does not mean fast.',
      'the clones are MOSAIC and variegated, so this answers "is overexpression sufficient" and cannot give an allele\'s effect size. Two of 26 and 2 of 11 overgrown fins had no detectable DsRed at all, which the authors attribute to promoter variegation.',
      'it needs molecular cloning or a gift of the plasmid, which no other case in this package needs.',
      'local overgrowth is a patchy, subjective call in a way that a normalised area ratio is not; scoring must be blind and ideally scored twice.',
    ],
    what_would_falsify: 'injected fish with clear DsRed-positive fin mesenchyme and no local overgrowth at a rate indistinguishable from the DsRed-only control, scored blind, with transgene presence confirmed by PCR in the same animals',
    what_it_cannot_tell_you: 'whether the design\'s specific substitution does anything. Wild-type kcnk5b overexpression is sufficient on its own, so a positive result here is silent about W169L and F241Y.',
  },
  // ---- the design's own edits, listed honestly rather than first -------------------------------------
  {
    id: 'kcnk5b-alf-knockin',
    rank: null,              // filled by rank() below
    question: 'Does installing a published another-longfin substitution in kcnk5b enlarge the fins?',
    relation_to_the_design: 'This IS the winged-zebrafish design\'s fin-enlargement mechanism, as close as a single edit gets to it.',
    organism: 'danio_rerio', base: 'wild-type AB/TU', edit: { gene: 'kcnk5b', change: 'p.W169L or p.F241Y (ONE of them - see ALLELE_CORRECTIONS)', kind: 'point, gain-of-function' },
    assay: 'CAUDAL fin length normalised to standard length, as an allometric coefficient (caliper-measured mm, reduced to a dimensionless regression exponent)',
    readout_stage: 'adult (reproductively mature, >3 months)',
    months_to_answer: 7,
    scorable_in_injected_generation: false,
    published_expectation: {
      what: 'the allometric coefficient of CAUDAL fin length against standard length rises from about 1.29 in wild type to near 2 in heterozygotes',
      numbers: 'wild type k=1.29 (R^2=0.92); alf/+ k near 2 (R^2=0.95); significance ***: p<0.001',
      numbers_source: 'Fig. 1D legend and Results. Fig. 1D is a linear regression across development and states NO n.',
      citation: 'Perathoner et al. 2014, Fig. 1D, doi 10.1371/journal.pgen.1004080',
      kind: 'measured', verified_in_this_run: true,
      quote: 'Wild type (wt) fins exhibit only a slight increase in relative growth during development (= 1.29) as growth is essentially isometric. [alf] heterozygotes showed positive allometric growth during development of the fin with an allometric coefficient near 2',
      measurement_method: 'fin length and standard length by handheld calipers under a stereo microscope (AxioVision), unpaired Student\'s t-test.',
      caveat: 'Absolute fin and segment lengths are in figures only and were not sourced as numbers. The paper also reports that segment NUMBER is not increased, so a replication should measure segment length, not count segments.',
      a_correction_to_our_own_first_version: {
        what_we_wrote: '"n=4 per group, error bars SD" attached to the k=1.29 / k~2 coefficients, and an assay field that did not name the fin.',
        why_it_was_wrong:
          'Both errors, found by re-reading the primary source. (1) The n=4 and the SD error bars belong to Fig. 1C - segment length and segment NUMBER in the longest ray of the DORSAL fin ("all cases n = 4; error bars: standard deviation; n.s.: not significant; *: p<0.02, ***: p<0.001"). Fig. 1D, the allometric regression this case actually uses, gives no n at all. Merging the two panels produced a sample size that does not exist for this measurement. ' +
          '(2) The coefficient is measured on CAUDAL fins - "Analysis of the caudal fins during development showed that the increase in size seen in the mutants is due to an increased growth rate" - and our assay field said only "fin length", which a reader would naturally apply to whichever fin the design is about.',
        why_it_matters: 'The design\'s claim is about PECTORAL fins. A lab powering a pectoral-fin experiment against a caudal-fin coefficient is comparing two different structures with different growth programs, and would not know it from the record as first written.',
      },
    },
    measurement_mismatch: {
      what_the_published_number_measures: 'caudal fin',
      what_the_design_claims: 'pectoral fin',
      status: 'UNRESOLVED. No published adult wild-type pectoral-fin-length/standard-length allometry was found for Danio rerio in this search, and design-validation/scorecard.json records the same gap from the other direction: the axis the design claim rests on cannot be scored because the only reference value found is figure-only.',
      what_would_resolve_it: 'either a measured wild-type pectoral allometry (which a partner lab could produce from existing adults with calipers, needing no injection at all), or a decision to test the caudal fin and accept that the design claim is then tested only by extrapolation across appendages.',
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
    months_to_answer: 0.1,
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
    months_to_answer: 8,
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
    months_to_answer: 8,
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
  '(3) our ordinal confidence label, (4) fewest months to an answer. This is OUR ordering rule, stated so ' +
  'it can be disagreed with; it is not a score and nothing is fitted. A case is never promoted for being ' +
  'closer to the design - the design is the thing being tested, so letting it set the order would be circular. ' +
  'Criterion (1) means NO CROSS IS NEEDED. It does not mean fast, and conflating the two is how the first ' +
  'version of this rule read: months_to_answer is now an explicit field on every case precisely so that a ' +
  'four-month adult readout cannot hide behind the words "injected generation".';

export const RANKING_CHANGED = {
  when: '2026-11-06',
  what: 'kcnk5b-overexpression-f0 entered the case set and took rank 1 from kcnk5b-f0-finbud.',
  why_under_the_unchanged_rule:
    'Both are scorable in the injected generation, so criterion (1) ties. Criterion (2) decides it: the ' +
    'overexpression route has published numbers (0/240 control, ~40 % penetrance, 89.2 % mesenchymal ' +
    'association at N = 37, a conductance-dead variant at n = 32), and the 48 hpf bud-area case has ' +
    'published_expectation.numbers === null. The rule was not changed to produce this; the rule was already ' +
    'this, and the case set was incomplete.',
  the_trade_the_ranking_does_not_capture:
    'Rank 1 now answers in about four months (raise injected fish to adulthood) where rank 2 answers in two ' +
    'days. A PI who wants an answer this week should still run the 48 hpf case and accept that it has no ' +
    'number to pass or fail against - or spend the cheaper effort first on obtaining the S4 Data values that ' +
    'would give it one, which is a data request, not an experiment.',
  what_would_reverse_it:
    'obtaining the per-comparison values for fin bud area at 48 hpf from Jiang et al. 2024 S4 Data. That ' +
    'single data request would give rank 2 a powerable expectation and make it the cheapest informative ' +
    'experiment in the set by a wide margin.',
};

const CONF_ORDER = ['replication-grade', 'quantitative-but-small', 'needs-two-generations', 'no-published-expectation'];

export function rank(cases = CASES) {
  return [...cases].sort((a, b) =>
    (b.scorable_in_injected_generation ? 1 : 0) - (a.scorable_in_injected_generation ? 1 : 0) ||
    (a.published_expectation?.numbers ? 0 : 1) - (b.published_expectation?.numbers ? 0 : 1) ||
    CONF_ORDER.indexOf(a.confidence) - CONF_ORDER.indexOf(b.confidence) ||
    (a.months_to_answer ?? Infinity) - (b.months_to_answer ?? Infinity)
  ).map((c, i) => ({ ...c, rank: i + 1 }));
}

export function caseById(id) { return CASES.find(c => c.id === id) ?? null; }
