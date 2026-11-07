#!/usr/bin/env node
// validatability.mjs - COULD WE BE SHOWN TO BE WRONG, AND HOW SOON, AND BY WHAT EVIDENCE?
//
// ============================== WHY THIS MODULE EXISTS ==============================
// Everything else in this folder asks whether a proposed organism x function design is a GOOD IDEA.
// This module refuses that question and asks a different one, which is the only one it can answer
// honestly: IS THE DESIGN THE KIND OF THING THAT COULD BE SHOWN TO BE WRONG, by whom, with what
// instrument, and when?
//
// The two questions come apart completely, and the separation is the whole content here:
//
//   * A design can be excellent and unfalsifiable. "Borrow the donor's cold tolerance into the host"
//     commits to no number, so no measurement contradicts it. It cannot be validated, not because the
//     biology is hard but because the sentence has no edges.
//   * A design can be almost certainly wrong and highly validatable. "Expressing the donor channel in
//     the host raises the fin-ray-length-to-body-length ratio by at least fifteen percent" is a number
//     with units, read out by a published assay, in a host where the construct is routine, in months.
//     If it is wrong we will know, cheaply, and that is worth more than being plausible.
//
// A pipeline that scores designs by plausibility and never scores them by refutability will accumulate
// plausible designs forever and never find out anything. So this module reports refutability, per axis,
// in words, and it reports it SEPARATELY from any judgement of merit. Nothing here says a design is
// good. REFUSED_BEFORE_VALIDATION is not "bad design"; it is "this is not yet a claim".
//
// ============================== WHAT IT DELIBERATELY WILL NOT DO ==============================
// It will not average the axes. See WHY_NOT_A_SCORE. Seven axes, seven closed vocabularies, seven
// verdicts, one tier drawn by stated rules - and the rules are data, exported, each with a one-line
// justification, so the mapping can be argued with instead of reverse-engineered. There is no number
// to quote and no number to multiply.
//
// It will not let a pre-registration exist without a refutation condition. prereg() THROWS rather than
// warning, because a pre-registration whose refutation condition is blank is worse than no
// pre-registration: it is the ceremony of rigour attached to an unfalsifiable sentence, and it will be
// cited later as though the ceremony were the thing.
//
// ============================== THE PART THAT IS UNCOMFORTABLE ==============================
// See THE_UNCOMFORTABLE_PART. The short version: in this repo's own benchmarks, two of the three levels
// scored AT CHANCE against external ground truth. So a statement about the validatability of a design
// is currently a much stronger claim than any statement about the quality of the design, and this
// module is deliberately the only one in the folder whose output does not depend on the scorers that
// came out at chance.
//
// ============================== EVERY NUMBER HERE ==============================
// A fabricated DOI or measurement is the worst thing this project can produce. Every value attributed
// to a paper in SOURCES was read out of the PubMed record for that PMID, retrieved on 2026-11-07 via
// the PubMed MCP tool; `verified_how` on each source says exactly what was checked. Values that are in
// those papers but NOT in the record we retrieved are written as
// { value: null, null_reason, what_would_have_to_be_measured } and are not guessed. Three of the seven
// sources have such a hole, and the holes are load-bearing: one of them is why a design below reports
// DIRECTION_ONLY instead of NUMBER_WITH_UNITS, i.e. refusing to invent a number demoted the design,
// which is the correct direction for that refusal to push.
//
// The DESIGNS below are OURS. They are proposals in this project's voice. None of them is a claim made
// by any cited paper; the papers supply the ASSAY and, where stated, the measured context.
//
// ============================== SCOPE AND HOLDOUT ==============================
// Data-provenance note: where a cited paper's dataset spans more groups than this repo compares over,
// only the allowed rows are taken, and the subset is mammals, fishes, amphibians, squamate reptiles,
// insects, nematodes and microbes, because that is this repo's comparative scope.
// One clade is a frozen evaluation holdout (holdout/split.json). No member of it is named, read or
// substituted for here. Run `node holdout/check-leaks.mjs analogues/combos` against this folder.
//
//   node analogues/combos/validatability.mjs            # print worked()
//   node analogues/combos/test-validatability.mjs       # the tests

// =====================================================================================================
// 0. DEEP FREEZE
// =====================================================================================================

const deepFreeze = o => {
  if (o && (typeof o === 'object' || typeof o === 'function') && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.getOwnPropertyNames(o)) {
      try { deepFreeze(o[k]); } catch { /* getters that throw are not our business */ }
    }
  }
  return o;
};

// =====================================================================================================
// 1. SOURCES - every one retrieved, every unretrieved value refused
// =====================================================================================================

const RETRIEVAL = 'Fetched the PubMed record on 2026-11-07 with mcp__claude_ai_PubMed__get_article_metadata and read it: PMID, DOI, journal, year, volume/issue/pages, title and abstract. Every value recorded below is quoted from that record. Values that the record does not contain are written null with a reason, and are NOT taken from memory.';

export const SOURCES = deepFreeze({
  perathoner_2014: {
    id: 'perathoner_2014',
    pmid: '24453984',
    doi: '10.1371/journal.pgen.1004080',
    title: 'Bioelectric signaling regulates size in zebrafish fins.',
    journal: 'PLoS Genetics 10(1):e1004080 (2014)',
    taxa: 'bony fish (Danio rerio); amphibian oocytes used as the heterologous expression system',
    reads_out: 'allometric appendage proportion in an adult fish, plus whole-cell K+ conductance of the channel in a heterologous oocyte',
    verified_how: RETRIEVAL,
    values_retrieved: {
      alf_mutations_are: 'gain-of-function mutations in kcnk5b, a two-pore-domain potassium channel gene',
      electrophysiology: 'the mutations increase K+ conductance of the channel and hyperpolarise the cell, measured in a heterologous oocyte',
      locality: 'somatic transgenesis indicates kcnk5b acts locally within the mesenchyme of fins and barbels to specify appendage size',
      requirement: 'the channel requires the ability to conduct K+ ions in order to increase the size of these structures',
    },
    values_refused: {
      fin_length_fold_change: {
        value: null,
        null_reason: 'The retrieved record states that alf mutants show "proportionally enlarged fins and barbels" and does not give a numeric ratio or percentage. We will not supply one.',
        what_would_have_to_be_measured: 'fin ray length normalised to standard length, in mutant and wild-type siblings reared together, read from the paper\'s figures or measured afresh.',
      },
    },
  },

  daane_2021: {
    id: 'daane_2021',
    pmid: '34534441',
    doi: '10.1016/j.cub.2021.08.054',
    title: 'Modulation of bioelectric cues in the evolution of flying fishes.',
    journal: 'Current Biology 31(22):5052-5061.e8 (2021)',
    taxa: 'bony fishes',
    reads_out: 'a cross-species phylogenomic comparison of fin proportion, intersected with fin-proportion mutants in a laboratory fish',
    verified_how: RETRIEVAL,
    values_retrieved: {
      n_species: 35,
      n_species_units: 'species of flying fishes and relatives in the phylogenome-wide variation analysis',
      genes_identified: 'an L-type amino acid transporter, lat4a, and the potassium channel kcnh2a, in the regulation of fin proportion',
      phenocopy: 'interaction between these loci in the laboratory fish "closely phenocopies the observed fin proportions of flying fishes"',
    },
    values_refused: {
      effect_size_on_fin_ratio: {
        value: null,
        null_reason: 'The retrieved record reports a phenocopy qualitatively and gives no fin-proportion effect size.',
        what_would_have_to_be_measured: 'the fin-to-body ratio distribution for each genotype, from the paper\'s source data.',
      },
    },
    in_repo_note: 'This repo records that the comparative signal in this dataset matches kcnh2a and lat4a and NOT kcnk5b, which is the gene this project\'s design work turns on. That is the single most useful retro-test available to us and we did not pass it.',
  },

  jiang_2024: {
    id: 'jiang_2024',
    pmid: '38527087',
    doi: '10.1371/journal.pbio.3002565',
    title: 'The scale of zebrafish pectoral fin buds is determined by intercellular K+ levels and consequent Ca2+-mediated signaling via retinoic acid regulation of Rcan2 and Kcnk5b.',
    journal: 'PLoS Biology 22(3):e3002565 (2024)',
    taxa: 'bony fish (Danio rerio)',
    reads_out: 'intracellular K+ during appendage bud growth, by fluorescence-lifetime imaging of a FRET-based K+ sensor; bud proportion under channel overexpression and under CRISPR-Cas9 targeting',
    verified_how: RETRIEVAL,
    values_retrieved: {
      sensor: 'FLIM measurement of a FRET-based K+ sensor, in vivo',
      direction_during_growth: 'coordinated decreases in intracellular K+ levels during bud growth',
      overexpression: 'overexpression of K+-leak channels in vivo coordinately increased bud proportions',
      rcan2: 'rcan2 overexpression increased bud growth and decreased K+; CRISPR-Cas9 targeting of rcan2 decreased growth and increased K+',
      dependency: 'CRISPR targeting of Kcnk5b revealed that Rcan2-mediated growth was dependent on Kcnk5b',
    },
    values_refused: {
      k_concentration_mM: {
        value: null,
        null_reason: 'The retrieved record reports the DIRECTION of the K+ change and no concentration or lifetime value.',
        what_would_have_to_be_measured: 'calibrated intracellular K+ in mM, or the raw FRET lifetimes, from the paper or afresh.',
      },
    },
  },

  zhang_2023: {
    id: 'zhang_2023',
    pmid: '37612507',
    doi: '10.1038/s41586-023-06463-0',
    title: 'Increased hyaluronan by naked mole-rat Has2 improves healthspan in mice.',
    journal: 'Nature 621(7977):196-205 (2023)',
    taxa: 'mammals (donor: naked mole-rat; host: mouse)',
    reads_out: 'tissue hyaluronan level, spontaneous and induced tumour incidence, lifespan, and a transcriptome signature, in a transgenic host carrying a donor-species gene',
    verified_how: RETRIEVAL,
    values_retrieved: {
      construct: 'a transgenic mouse overexpressing the naked mole-rat hyaluronic acid synthase 2 gene (nmrHas2)',
      outcomes: 'increased hyaluronan in several tissues; lower incidence of spontaneous and induced cancer; extended lifespan; improved healthspan; attenuated inflammation across multiple tissues',
      the_sentence_that_matters: 'the record states that "these beneficial effects were conferred by HMM-HA and were not specific to the nmrHas2 gene"',
    },
    values_refused: {
      lifespan_extension_percent: {
        value: null,
        null_reason: 'The retrieved record says "extended lifespan" without a percentage, a median, or a hazard ratio.',
        what_would_have_to_be_measured: 'median and maximum lifespan per genotype with the survival curves, from the paper\'s figures.',
      },
      tumour_incidence_delta: {
        value: null,
        null_reason: 'The record says "lower incidence" and gives no incidence figures.',
        what_would_have_to_be_measured: 'tumour incidence per genotype per cohort, with cohort sizes.',
      },
    },
    why_it_is_here: 'This is the rare case where the cross-species transfer a design programme proposes HAS ALREADY BEEN DONE, which makes it the sharpest available calibration of our own designs. It is also the case where the source\'s own abstract names the rival explanation that defeats the interesting version of the claim.',
  },

  chen_1997: {
    id: 'chen_1997',
    pmid: '9108060',
    doi: '10.1073/pnas.94.8.3811',
    title: 'Evolution of antifreeze glycoprotein gene from a trypsinogen gene in Antarctic notothenioid fish.',
    journal: 'PNAS 94(8):3811-6 (1997)',
    taxa: 'bony fishes',
    reads_out: 'gene structure and sequence divergence; the origin of a de novo protein-coding region',
    verified_how: RETRIEVAL,
    values_retrieved: {
      origin: 'the antifreeze glycoproteins of the notothenioids evolved from a pancreatic trypsinogen',
      mechanism: 'recruitment of the 5\' and 3\' ends of an ancestral trypsinogen gene, plus de novo amplification of a 9-nucleotide Thr-Ala-Ala coding element to create the repetitive tripeptide backbone',
      divergence_percent: '4-7% sequence divergence between the antifreeze glycoprotein and trypsinogen genes',
      age_mya: '5-14 million years ago for the gene conversion; Antarctic Ocean freezing estimated at 10-14 mya; main phyletic divergence of the antifreeze-bearing families at 7-15 mya',
    },
    values_refused: {
      thermal_hysteresis_degC: {
        value: null,
        null_reason: 'This paper is about the ORIGIN of the gene. The retrieved record contains no thermal-hysteresis measurement, and we did not retrieve a paper that does.',
        what_would_have_to_be_measured: 'thermal hysteresis in degrees Celsius at a stated protein concentration, by nanolitre osmometry, with its own citation retrieved before any number is written down.',
      },
    },
  },

  abusharkh_2014: {
    id: 'abusharkh_2014',
    pmid: '25290156',
    doi: '10.1021/la502654j',
    title: 'The role of phospholipid headgroup composition and trehalose in the desiccation tolerance of Caenorhabditis elegans.',
    journal: 'Langmuir 30(43):12897-906 (2014)',
    taxa: 'nematode',
    reads_out: 'a biophysical membrane readout of desiccation tolerance: monolayer compressibility modulus, and hydration kinetics by time-resolved FTIR',
    verified_how: RETRIEVAL,
    values_retrieved: {
      organism_state: 'the dauer larva of the nematode is anhydrobiotic and accumulates high amounts of trehalose during preconditioning',
      lipid_change: 'preconditioned dauer larvae dramatically reduce their phosphatidylcholine content, lowering the PC:PE ratio',
      compressibility_fold: 2.6,
      compressibility_fold_units: 'fold smaller compressibility modulus of phospholipids from preconditioned larvae than from non-preconditioned larvae',
      methods: 'Langmuir-Blodgett monolayers and time-resolved FTIR spectroscopy',
    },
    values_refused: {
      survival_fraction_after_desiccation: {
        value: null,
        null_reason: 'The retrieved record describes the biophysics and gives no survival fraction, no relative-humidity protocol and no exposure time.',
        what_would_have_to_be_measured: 'fraction surviving a stated relative-humidity step for a stated duration, with the matched non-preconditioned control run alongside.',
      },
    },
  },

  autumn_2000: {
    id: 'autumn_2000',
    pmid: '10864324',
    doi: '10.1038/35015073',
    title: 'Adhesive force of a single gecko foot-hair.',
    journal: 'Nature 405(6787):681-5 (2000)',
    taxa: 'squamate reptile',
    reads_out: 'adhesive force of ONE seta, by a two-dimensional micro-electromechanical force sensor with a wire as a force gauge',
    verified_how: RETRIEVAL,
    values_retrieved: {
      setae_per_foot: 'nearly five hundred thousand keratinous setae per foot',
      seta_length_um: '30-130 micrometres long, about one-tenth the diameter of a human hair',
      spatula_size_um: '0.2-0.5 micrometre spatula-shaped terminal structures',
      effectiveness: 'a seta is ten times more effective at adhesion than predicted from maximal estimates on whole animals',
      orientation_effect: 'a unique macroscopic orientation and preloading increased attachment force 600-fold above frictional measurements of the material',
      mechanism_supported: 'the force values support the hypothesis that individual setae operate by van der Waals forces',
      detachment: 'suitably oriented setae detach above a critical angle with the substratum',
    },
    values_refused: {
      single_seta_force_uN: {
        value: null,
        null_reason: 'The retrieved record reports FOLD-CHANGES (ten times, 600-fold) and not the absolute per-seta force. The absolute figure is widely quoted from memory and we will not write a remembered number next to a DOI.',
        what_would_have_to_be_measured: 'the per-seta force in micronewtons with its preload and orientation, read from the paper\'s own table or figure, not recalled.',
      },
    },
    consequence_in_this_module: 'Because that number is refused, the design that would have used it reports DIRECTION_ONLY on the QUANTITATIVE_PREDICTION axis, and therefore cannot reach the top tier. Refusing to invent a value demoted our own design. That is the correct direction for the refusal to push, and it is the reason the refusal is recorded here rather than silently worked around.',
  },
});

export const SOURCE_IDS = deepFreeze(Object.keys(SOURCES));

/**
 * This repo's own benchmark numbers, read from benchmarks/README.md in the working tree on 2026-11-07.
 * They are not from any paper. They are the reason THE_UNCOMFORTABLE_PART exists.
 */
export const REPO_BENCHMARKS = deepFreeze({
  verified_how: 'Read benchmarks/README.md in this working tree on 2026-11-07 and quoted its summary table. These are this project\'s own results against external ground truth, not any paper\'s.',
  guide_score: {
    what: 'the guide score the editing planner ranks by, against measured activity for 307 measured laboratory-fish sgRNAs',
    spearman_rho: -0.037,
    ci: [-0.149, 0.073],
    verdict_in_words: 'the interval includes zero',
  },
  design_scorer: {
    what: 'design-level AUC against decoy sets of increasing difficulty',
    auc_on_shuffles: 0.891,
    auc_on_real_fish_nudged_quarter_sd: 0.536,
    verdict_in_words: 'chance on the hard negatives',
    constructed_negative: { q: 0.918, what: 'an anatomically impossible animal that the scorer calls typical' },
  },
  lean_layer: {
    what: 'non-vacuity and mutation testing of the machine-checked layer',
    witnesses_machine_checked: '48/48',
    mutants_refuted: 1,
    verdict_in_words: 'a pass',
  },
  laws: { expressible: '1 of 48', worst_violator_q: 0.347, more_typical_than_percent_of_real_fish: 87.1 },
  the_line_from_the_file: 'Two of the three levels come out at chance against external ground truth. One passes.',
});

// =====================================================================================================
// 2. THE AXES
// =====================================================================================================
//
// Seven axes. They are kept separate because they fail separately: a design can be exquisitely
// quantitative with no assay, or sit on a shelf of published data with no way to tell our cause from
// the obvious rival, or be perfectly measurable in a host nobody can transform. Each axis has its OWN
// closed vocabulary; none of the vocabularies is ordinal in a way that licenses arithmetic across axes.

export const AXES = deepFreeze({
  QUANTITATIVE_PREDICTION: {
    id: 'QUANTITATIVE_PREDICTION',
    question: 'Does the system emit a NUMBER with units that a measurement could contradict?',
    why_it_is_first: 'Nothing downstream matters if the claim has no edges. An assay cannot contradict a sentence that does not commit.',
    vocabulary: ['NUMBER_WITH_UNITS', 'DIRECTION_ONLY', 'NO_COMMITMENT'],
    answers: {
      NUMBER_WITH_UNITS: 'a value and a unit are stated, so a single measurement with a stated threshold can contradict the design',
      DIRECTION_ONLY: 'a sign is stated - larger, faster, more tolerant - with no magnitude, so only a wrong-direction result refutes it, and a tiny right-direction result confirms it trivially',
      NO_COMMITMENT: 'no number and no direction. Nothing can contradict it, which means nothing can support it either',
    },
  },
  EXISTING_ASSAY: {
    id: 'EXISTING_ASSAY',
    question: 'Is there a PUBLISHED assay that reads out this phenotype, with a citation we have actually retrieved?',
    why_it_is_separate: 'A number with no instrument is a wish. And an assay we half-remember is worse than none: this axis is answered PUBLISHED_ASSAY only when a retrieved citation is attached.',
    vocabulary: ['PUBLISHED_ASSAY', 'ASSAY_NEEDS_ADAPTING', 'NO_KNOWN_ASSAY'],
    answers: {
      PUBLISHED_ASSAY: 'a retrieved citation reads out this phenotype in a comparable preparation; the protocol exists and has been through review',
      ASSAY_NEEDS_ADAPTING: 'an assay exists for the quantity but not in this host, or not at this scale, or the citation for it has not been retrieved - so the readout itself is a development project with its own failure modes',
      NO_KNOWN_ASSAY: 'nothing published reads this out. The design cannot be wrong in public until the instrument exists',
    },
  },
  RETRO_DECIDABLE: {
    id: 'RETRO_DECIDABLE',
    question: 'Does ALREADY-PUBLISHED data decide it, with no new experiment?',
    why_it_is_the_cheapest_axis: 'A retro-decidable prediction costs a reanalysis. If a design programme has any retro-decidable predictions at all it should settle them first, because they are the only ones that can refute it this week - and because a programme that never makes one is choosing to be unfalsifiable at the cheapest moment available.',
    vocabulary: ['DECIDABLE_FROM_PUBLISHED_DATA', 'NEEDS_NEW_MEASUREMENT', 'UNDECIDABLE_EITHER_WAY'],
    answers: {
      DECIDABLE_FROM_PUBLISHED_DATA: 'a dataset in the literature contains the comparison; reading it settles the prediction in one direction or the other',
      NEEDS_NEW_MEASUREMENT: 'published data does not contain the comparison, but a stated measurement would settle it',
      UNDECIDABLE_EITHER_WAY: 'as posed, neither published data nor the proposed measurement settles it. The claim is not yet of a decidable shape and needs reformulating, not funding',
    },
  },
  HOST_TRACTABLE: {
    id: 'HOST_TRACTABLE',
    question: 'In the HOST organism, can the perturbation actually be made and the readout actually be taken?',
    why_it_bites: 'Design programmes nominate hosts by biology and discover tractability afterwards. Germline access, husbandry, generation time, transgenesis efficiency and the existence of a wild-type baseline colony are not details; they decide whether the experiment happens.',
    vocabulary: ['ROUTINE_IN_HOST', 'POSSIBLE_IN_HOST', 'NOT_TRACTABLE_IN_HOST'],
    answers: {
      ROUTINE_IN_HOST: 'the perturbation and the readout are standard practice in this host; a competent laboratory does this already',
      POSSIBLE_IN_HOST: 'it has been done in this host or a close relative, but it is a project rather than a protocol',
      NOT_TRACTABLE_IN_HOST: 'no established route to the perturbation or the readout in this host. The design is about an organism nobody can presently work in',
    },
  },
  TIME_TO_READOUT: {
    id: 'TIME_TO_READOUT',
    question: 'How long until the evidence exists? Reported as a BAND, never a date.',
    why_bands: 'A point estimate of experimental duration is a forecast dressed as a measurement. The band is what is actually known, and the only distinction that changes the tier is whether the readout needs more than one generation of the host.',
    vocabulary: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS', 'GENERATIONS'],
    answers: {
      DAYS: 'a reanalysis, or a readout on an existing preparation',
      WEEKS: 'a readout within one round of culture or rearing',
      MONTHS: 'the readout needs animals grown to a stage, or a cohort assembled',
      YEARS: 'the readout is a lifespan, a cohort outcome, or a field season sequence',
      GENERATIONS: 'the readout needs a stable line, selection, or inheritance across generations. Treated specially: this is where designs quietly stop being testable by the people who proposed them',
    },
  },
  CONFOUND_SEVERITY: {
    id: 'CONFOUND_SEVERITY',
    question: 'What ELSE could produce the same readout, and can the experiment tell them apart?',
    why_it_outranks_most_things: 'The commonest way a design is validated wrongly is that the readout moved for a reason nobody enumerated. An unenumerated confound set is not a small risk; it means the experiment cannot be interpreted whichever way it comes out.',
    vocabulary: ['CONFOUNDS_NAMED_AND_SEPARABLE', 'CONFOUNDS_NAMED_NOT_SEPARABLE', 'CONFOUNDS_UNENUMERATED'],
    answers: {
      CONFOUNDS_NAMED_AND_SEPARABLE: 'the rival causes are listed, and the design contains the contrast that separates ours from each of them',
      CONFOUNDS_NAMED_NOT_SEPARABLE: 'the rival causes are listed and at least one cannot be separated by this experiment. The readout will move or not move and the cause will remain open',
      CONFOUNDS_UNENUMERATED: 'nobody has written down what else makes this readout move. The result is uninterpretable in advance of being collected',
    },
  },
  NEGATIVE_CONTROL_EXISTS: {
    id: 'NEGATIVE_CONTROL_EXISTS',
    question: 'Is there a design that SHOULD fail, so that a pass means something?',
    why_it_is_an_axis_and_not_a_footnote: 'This repo has the demonstration. Its own design scorer reaches AUC 0.891 against shuffled decoys and 0.536 - chance - against real organisms nudged a quarter of a standard deviation, and it calls an anatomically impossible animal typical at q = 0.918. A test whose negatives are easy is not a test. Every design here must name the thing that ought to fail.',
    vocabulary: ['NEGATIVE_CONTROL_SPECIFIED', 'NEGATIVE_CONTROL_CONCEIVABLE', 'NO_NEGATIVE_CONTROL'],
    answers: {
      NEGATIVE_CONTROL_SPECIFIED: 'a concrete construct, genotype or condition is named that ought to produce no effect, and it is in the plan',
      NEGATIVE_CONTROL_CONCEIVABLE: 'a negative control could be built and has not been specified. A to-do, not a blocker',
      NO_NEGATIVE_CONTROL: 'nothing in the design could fail. A pass carries no information, so the experiment cannot validate anything',
    },
  },
});

export const AXIS_IDS = deepFreeze(Object.keys(AXES));

/** The closed vocabularies, keyed by axis. The cartesian product of these is the domain of tier(). */
export const VOCABULARY = deepFreeze(Object.fromEntries(AXIS_IDS.map(a => [a, AXES[a].vocabulary])));

/** How many distinct complete answer sets exist. tier() must be total over all of them. */
export const N_ANSWER_SETS = AXIS_IDS.reduce((n, a) => n * VOCABULARY[a].length, 1);

// =====================================================================================================
// 3. THE TIERS
// =====================================================================================================

export const TIERS = deepFreeze({
  RETRO_VALIDATABLE_NOW: {
    id: 'RETRO_VALIDATABLE_NOW',
    means: 'published data already decides this. Someone can refute it this week, with no bench work and no money.',
    what_to_do: 'Settle it before proposing anything else. Write the pre-registration FIRST, with written_before_looking set honestly, then open the dataset. A retro-test run after reading the answer is not a test, and prereg() records which it was.',
    is_not: 'a statement that the design is right. It is a statement that we are about to find out.',
  },
  VALIDATABLE_IN_A_LAB: {
    id: 'VALIDATABLE_IN_A_LAB',
    means: 'a stated measurement in a tractable host, with a published assay, named separable confounds and a negative control, inside one generation.',
    what_to_do: 'Name the laboratory and the cost. This tier is where a design becomes a proposal rather than a sentence.',
    is_not: 'a prediction that the experiment will succeed. Most designs at this tier will be refuted, which is the point of them being here.',
  },
  NOT_YET_DECIDABLE: {
    id: 'NOT_YET_DECIDABLE',
    means: 'the claim has edges but something between us and the evidence is missing: the assay, the host, the separability of a named rival, or more than one generation of waiting.',
    what_to_do: 'Name the ONE missing thing and whether it is an instrument, an organism or a contrast. A design that sits here for a specific reason is more useful than one that sits in a lab tier for a vague one.',
    is_not: 'a soft no. Several designs here are the most interesting in the set; they are simply not yet claims anybody can check.',
  },
  REFUSED_BEFORE_VALIDATION: {
    id: 'REFUSED_BEFORE_VALIDATION',
    means: 'this is not yet a claim. No number, or nothing that could fail, or no enumeration of what else moves the readout. There is no experiment to design because there is no proposition to test.',
    what_to_do: 'Rewrite the design until a measurement could contradict it. The fix is editorial, not experimental.',
    is_not: 'a judgement that the biology is wrong or the idea is bad. A refused design can be the best idea in the set and still not be a claim.',
  },
});

export const TIER_IDS = deepFreeze(Object.keys(TIERS));

// =====================================================================================================
// 4. THE RULES
// =====================================================================================================
//
// The mapping from a complete answer set to a tier, as DATA. First matching rule wins; the order is
// part of the content and is justified rule by rule. The set is TOTAL over the cartesian product of the
// vocabularies - tested exhaustively, all N_ANSWER_SETS of them - and tier() throws if it ever falls
// through, so a future edit that opens a hole fails loudly instead of returning undefined.
//
// Two axes deliberately do NOT change the tier on their own:
//   * NEGATIVE_CONTROL_CONCEIVABLE never downgrades. A control that could be built and has not been
//     specified is a to-do. Only its total absence is a blocker, because only then can nothing fail.
//   * TIME_TO_READOUT changes the tier at exactly one place: GENERATIONS. Months versus years is a
//     budgeting fact, not an epistemic one. Crossing a generation is epistemic, because inheritance,
//     drift and selection enter the readout and the proposers typically are not there for it.
// Both are reported in every verdict regardless, as caveats, so an axis that did not bite is still on
// the record rather than silently dropped.

const is = (a, axis, ...vals) => vals.includes(a[axis]);

export const RULES = deepFreeze([
  {
    id: 'R1-no-commitment',
    when: 'QUANTITATIVE_PREDICTION = NO_COMMITMENT',
    tier: 'REFUSED_BEFORE_VALIDATION',
    because: 'A design that commits to no number and not even a direction cannot be contradicted by any measurement, so there is nothing to validate and no experiment to design.',
    test: a => is(a, 'QUANTITATIVE_PREDICTION', 'NO_COMMITMENT'),
  },
  {
    id: 'R2-nothing-could-fail',
    when: 'NEGATIVE_CONTROL_EXISTS = NO_NEGATIVE_CONTROL',
    tier: 'REFUSED_BEFORE_VALIDATION',
    because: 'If no design element ought to fail, a pass carries no information; this repo\'s own scorer calling an impossible animal typical is what that looks like in practice.',
    test: a => is(a, 'NEGATIVE_CONTROL_EXISTS', 'NO_NEGATIVE_CONTROL'),
  },
  {
    id: 'R3-confounds-unenumerated',
    when: 'CONFOUND_SEVERITY = CONFOUNDS_UNENUMERATED',
    tier: 'REFUSED_BEFORE_VALIDATION',
    because: 'An experiment whose rival explanations are unwritten is uninterpretable before it is run, so collecting the data cannot decide anything.',
    test: a => is(a, 'CONFOUND_SEVERITY', 'CONFOUNDS_UNENUMERATED'),
  },
  {
    id: 'R4-undecidable-and-no-instrument',
    when: 'RETRO_DECIDABLE = UNDECIDABLE_EITHER_WAY AND EXISTING_ASSAY = NO_KNOWN_ASSAY',
    tier: 'REFUSED_BEFORE_VALIDATION',
    because: 'No existing data decides it and no instrument reads it out: there is neither a present nor a future route to being wrong, so the design has to be restated before it can be worked on.',
    test: a => is(a, 'RETRO_DECIDABLE', 'UNDECIDABLE_EITHER_WAY') && is(a, 'EXISTING_ASSAY', 'NO_KNOWN_ASSAY'),
  },
  {
    id: 'R5-undecidable-but-instrument-exists',
    when: 'RETRO_DECIDABLE = UNDECIDABLE_EITHER_WAY (an assay exists, confounds are enumerated, something could fail)',
    tier: 'NOT_YET_DECIDABLE',
    because: 'The shape of the claim is the blocker, not the apparatus: an instrument exists, so restating the prediction so that the instrument can contradict it is editorial work with a known endpoint.',
    test: a => is(a, 'RETRO_DECIDABLE', 'UNDECIDABLE_EITHER_WAY'),
  },
  {
    id: 'R6-retro-data-cannot-separate-the-rival',
    when: 'RETRO_DECIDABLE = DECIDABLE_FROM_PUBLISHED_DATA AND CONFOUND_SEVERITY = CONFOUNDS_NAMED_NOT_SEPARABLE',
    tier: 'NOT_YET_DECIDABLE',
    because: 'The dataset exists and still cannot tell our cause from a named rival, so reading it would move a number without deciding the claim - a new contrast is needed, not a new reading.',
    test: a => is(a, 'RETRO_DECIDABLE', 'DECIDABLE_FROM_PUBLISHED_DATA') && is(a, 'CONFOUND_SEVERITY', 'CONFOUNDS_NAMED_NOT_SEPARABLE'),
  },
  {
    id: 'R7-retro-validatable',
    when: 'RETRO_DECIDABLE = DECIDABLE_FROM_PUBLISHED_DATA with separable confounds and at least a stated direction',
    tier: 'RETRO_VALIDATABLE_NOW',
    because: 'The comparison is already in the literature and the rivals are separable, so the only thing between us and a refutation is reading it - which is why this tier outranks any amount of bench feasibility.',
    test: a => is(a, 'RETRO_DECIDABLE', 'DECIDABLE_FROM_PUBLISHED_DATA'),
  },
  {
    id: 'R8-new-measurement-but-blocked',
    when: 'RETRO_DECIDABLE = NEEDS_NEW_MEASUREMENT AND (no assay OR host not tractable OR readout needs generations OR a named rival is inseparable)',
    tier: 'NOT_YET_DECIDABLE',
    because: 'A new measurement would settle it, and one specific thing - instrument, organism, inheritance, or contrast - stands in the way, so the honest report is the name of that thing rather than a feasibility estimate.',
    test: a => is(a, 'RETRO_DECIDABLE', 'NEEDS_NEW_MEASUREMENT') && (
      is(a, 'EXISTING_ASSAY', 'NO_KNOWN_ASSAY') ||
      is(a, 'HOST_TRACTABLE', 'NOT_TRACTABLE_IN_HOST') ||
      is(a, 'TIME_TO_READOUT', 'GENERATIONS') ||
      is(a, 'CONFOUND_SEVERITY', 'CONFOUNDS_NAMED_NOT_SEPARABLE')
    ),
  },
  {
    id: 'R9-validatable-in-a-lab',
    when: 'RETRO_DECIDABLE = NEEDS_NEW_MEASUREMENT with an assay, a tractable host, separable confounds and a readout inside one generation',
    tier: 'VALIDATABLE_IN_A_LAB',
    because: 'Every link from the claim to a contradicting measurement is present, so the remaining questions are cost and calendar rather than epistemics.',
    test: a => is(a, 'RETRO_DECIDABLE', 'NEEDS_NEW_MEASUREMENT'),
  },
]);

export const RULE_IDS = deepFreeze(RULES.map(r => r.id));

const validateAnswers = answers => {
  if (!answers || typeof answers !== 'object') {
    throw new TypeError('validatability: tier(answers) needs a complete answer set, one entry per axis in AXIS_IDS');
  }
  const missing = AXIS_IDS.filter(a => answers[a] === undefined || answers[a] === null);
  if (missing.length) {
    throw new RangeError(`validatability: incomplete answer set; no answer on ${missing.join(', ')}. There is no default: an unanswered axis is a refusal to say, and it may not be scored as a pass.`);
  }
  const bad = AXIS_IDS.filter(a => !VOCABULARY[a].includes(answers[a]));
  if (bad.length) {
    throw new RangeError(`validatability: answer outside the closed vocabulary on ${bad.map(a => `${a}="${answers[a]}" (allowed: ${VOCABULARY[a].join('|')})`).join('; ')}`);
  }
  const extra = Object.keys(answers).filter(k => !AXIS_IDS.includes(k));
  return extra;
};

/**
 * Map a COMPLETE answer set to exactly one tier, by the first matching rule in RULES.
 *
 * @param {object} answers  one entry per axis in AXIS_IDS, each from that axis's closed vocabulary
 * @returns {object} frozen { tier, rule, because, ... }: `tier` is a member of TIER_IDS
 * @throws {RangeError} on an incomplete answer set or an answer outside a vocabulary
 */
export function tier(answers) {
  const unknown_axes = validateAnswers(answers);
  const hit = RULES.find(r => r.test(answers));
  if (!hit) {
    // Unreachable while RULES covers the three RETRO_DECIDABLE values. If an edit opens a hole, this
    // throws rather than returning undefined, and the totality test catches it on the next run.
    throw new Error(`validatability: tier() fell through - the rule set is NOT total for ${JSON.stringify(answers)}. Add a rule; do not add a default.`);
  }
  const all_matching = RULES.filter(r => r.test(answers)).map(r => r.id);
  const caveats = [];
  if (answers.NEGATIVE_CONTROL_EXISTS === 'NEGATIVE_CONTROL_CONCEIVABLE') {
    caveats.push('the negative control is conceivable and not specified. This did not change the tier - by rule, only its total absence blocks - but a pass means less until it is in the plan.');
  }
  if (answers.TIME_TO_READOUT === 'YEARS') {
    caveats.push('the readout band is YEARS. This did not change the tier, because waiting is a budgeting fact and not an epistemic one, but nobody should call this design checked in the meantime.');
  }
  if (answers.TIME_TO_READOUT === 'GENERATIONS') {
    caveats.push('the readout crosses a generation, which is where inheritance, drift and selection enter the readout and where the proposers are typically no longer the ones measuring.');
  }
  if (answers.EXISTING_ASSAY === 'ASSAY_NEEDS_ADAPTING') {
    caveats.push('the assay must be adapted, so the readout is itself a development project with its own failure modes, and its failure will be indistinguishable from the design\'s failure unless a positive control for the assay is run.');
  }
  if (answers.QUANTITATIVE_PREDICTION === 'DIRECTION_ONLY') {
    caveats.push('only a direction is committed to, so a result of the right sign and negligible size counts as a pass. Attach a magnitude before calling any pass a validation.');
  }
  if (unknown_axes.length) {
    caveats.push(`ignored keys that are not axes: ${unknown_axes.join(', ')}. They bought nothing; add an axis if they matter.`);
  }
  return deepFreeze({
    tier: hit.tier,
    tier_means: TIERS[hit.tier].means,
    tier_is_not: TIERS[hit.tier].is_not,
    what_to_do: TIERS[hit.tier].what_to_do,
    rule: hit.id,
    rule_when: hit.when,
    because: hit.because,
    all_matching_rules: all_matching,
    rules_are_ordered: all_matching.length > 1
      ? `${all_matching.length} rules match; the first in RULES wins and the others are listed so the precedence is visible rather than inferred`
      : 'exactly one rule matches this answer set',
    answers: { ...answers },
    caveats,
    fused_score: null,
    score: null,
    probability: null,
    why_no_score: 'see WHY_NOT_A_SCORE',
  });
}

// =====================================================================================================
// 5. PER-AXIS VERDICTS
// =====================================================================================================

/**
 * The full per-axis report for a design, plus its tier. The headline is a sentence and carries no
 * digits, so no float can be quoted out of it.
 */
export function assess(design, answers) {
  const d = design || {};
  const t = tier(answers);
  const per_axis = AXIS_IDS.map(a => deepFreeze({
    axis: a,
    question: AXES[a].question,
    answer: answers[a],
    what_that_means: AXES[a].answers[answers[a]],
    changed_the_tier: RULES.find(r => r.id === t.rule).when.includes(a),
  }));
  const blockers = per_axis.filter(x => [
    'NO_COMMITMENT', 'NO_KNOWN_ASSAY', 'UNDECIDABLE_EITHER_WAY', 'NOT_TRACTABLE_IN_HOST',
    'GENERATIONS', 'CONFOUNDS_UNENUMERATED', 'CONFOUNDS_NAMED_NOT_SEPARABLE', 'NO_NEGATIVE_CONTROL',
  ].includes(x.answer));
  const words =
    `${d.id ?? 'unnamed design'}: ${d.organism ?? 'unstated host'} x ${d.function ?? 'unstated function'}. ` +
    `Validatability tier ${t.tier.replace(/_/g, ' ').toLowerCase()}, by rule ${t.rule.replace(/[^A-Za-z-]/g, '')}. ` +
    `${blockers.length ? `What stands between this design and a refutation: ${blockers.map(b => b.axis.replace(/_/g, ' ').toLowerCase()).join('; ')}.` : 'No axis blocks a refutation; what remains is cost and calendar.'} ` +
    'This says nothing about whether the design is a good idea.';
  return deepFreeze({
    design_id: d.id ?? null,
    organism: d.organism ?? null,
    function: d.function ?? null,
    headline: words.replace(/[0-9]/g, ''),
    tier: t.tier,
    verdict: t,
    per_axis,
    blockers: blockers.map(b => ({ axis: b.axis, answer: b.answer, what_that_means: b.what_that_means })),
    sources_used: d.sources ?? [],
    fused_score: null,
    score: null,
    probability: null,
    why_no_score: WHY_NOT_A_SCORE,
    not_a_merit_judgement: 'This is a report on refutability. A design can be refutable and wrong, unrefutable and right, and this module cannot tell those apart - nor is it trying to.',
  });
}

// =====================================================================================================
// 6. PRE-REGISTRATION
// =====================================================================================================

/** The comparisons a refutation condition may use. A closed set, so "we would know it when we saw it" is not available. */
export const COMPARISONS = deepFreeze(['>', '>=', '<', '<=', 'outside-interval', 'inside-interval', 'sign-differs']);

const nonEmpty = s => typeof s === 'string' && s.trim().length > 0;

/**
 * Emit a pre-registration record for a design.
 *
 * It THROWS - it does not warn - when the refutation condition is missing or incomplete. A
 * pre-registration with a blank refutation condition is worse than none at all: it is the ceremony of
 * rigour wrapped round an unfalsifiable sentence, and later it gets cited as though the ceremony were
 * the thing. A warning would be ignored; an exception cannot be.
 *
 * `written_before_looking` must be set by the caller, as a boolean, honestly. This module cannot check
 * it and does not pretend to. What it does is refuse to omit the field, and label the record POST_HOC
 * when the caller says false - so that a retro-test run after reading the answer can never be presented
 * as a pre-registration.
 *
 * @param {object} design  { id, organism, function, prediction: { statement, number, measurement, refuted_if }, written_before_looking }
 * @param {object} answers a complete axis answer set, as for tier()
 */
export function prereg(design, answers) {
  const d = design || {};
  const p = d.prediction || {};
  const r = p.refuted_if;

  if (r === undefined || r === null || (typeof r === 'object' && Object.keys(r).length === 0)) {
    throw new Error(`prereg: REFUSED for "${d.id ?? 'unnamed design'}" - the refutation condition is empty. A pre-registration with nothing that would refute it is not a pre-registration; it is an unfalsifiable sentence with a timestamp. State prediction.refuted_if = { measurement, comparison, threshold, units } or do not call this.`);
  }
  if (typeof r !== 'object') {
    throw new TypeError(`prereg: REFUSED for "${d.id ?? 'unnamed design'}" - prediction.refuted_if must be an object { measurement, comparison, threshold, units }, not a ${typeof r}.`);
  }
  if (!nonEmpty(r.measurement)) {
    throw new Error(`prereg: REFUSED for "${d.id ?? 'unnamed design'}" - refuted_if.measurement is empty. Name the instrument and the quantity, or there is no refutation, only a mood.`);
  }
  if (!COMPARISONS.includes(r.comparison)) {
    throw new RangeError(`prereg: REFUSED for "${d.id ?? 'unnamed design'}" - refuted_if.comparison must be one of ${COMPARISONS.join(' ')}; got ${JSON.stringify(r.comparison)}. "We would know it when we saw it" is not a comparison.`);
  }
  if (typeof r.threshold !== 'number' || !Number.isFinite(r.threshold)) {
    throw new Error(`prereg: REFUSED for "${d.id ?? 'unnamed design'}" - refuted_if.threshold must be a finite number. If the threshold cannot be stated, the design is not ready to be pre-registered, and that is a finding about the design.`);
  }
  if (!nonEmpty(r.units)) {
    throw new Error(`prereg: REFUSED for "${d.id ?? 'unnamed design'}" - refuted_if.units is empty. A threshold without units is not a threshold.`);
  }
  if (typeof d.written_before_looking !== 'boolean') {
    throw new TypeError(`prereg: REFUSED for "${d.id ?? 'unnamed design'}" - written_before_looking must be set by the caller as a boolean, honestly. This module cannot verify it and will not default it, because defaulting it to true would launder every post-hoc record in the repo.`);
  }

  const t = tier(answers);
  const post_hoc = d.written_before_looking === false;

  return deepFreeze({
    kind: post_hoc ? 'POST_HOC_RECORD' : 'PRE_REGISTRATION',
    design_id: d.id ?? null,
    organism: d.organism ?? null,
    function: d.function ?? null,
    prediction: nonEmpty(p.statement) ? p.statement : '(no statement given: the refutation condition below is the whole of the claim)',
    number: p.number ?? { value: null, null_reason: 'no number was attached to this prediction', what_would_have_to_be_measured: r.measurement },
    measurement_that_would_refute_it: r.measurement,
    refuted_if: { comparison: r.comparison, threshold: r.threshold, units: r.units, read_as: `refuted when ${r.measurement} is ${r.comparison} ${r.threshold} ${r.units}` },
    n_required: r.n_required ?? { value: null, null_reason: 'no power calculation was done for this record', what_would_have_to_be_measured: 'the variance of the readout in the host, from the assay citation or a pilot' },
    negative_control: nonEmpty(p.negative_control) ? p.negative_control : null,
    written_before_looking: d.written_before_looking,
    honesty_note: post_hoc
      ? 'POST-HOC. The caller states this record was written AFTER the deciding data was seen. It is kept, because hiding it would be worse, and it is labelled, because a post-hoc record presented as a pre-registration is the specific dishonesty this field has the most of. It may be reported as a consistency check and never as a prediction.'
      : 'The caller states this was written BEFORE looking. This module cannot verify that and does not claim to; the field exists so that the claim is on the record, attributable, and falsifiable by anyone with the commit history.',
    validatability: { tier: t.tier, rule: t.rule, because: t.because, caveats: t.caveats },
    sources: d.sources ?? [],
    what_this_record_is_not: 'It is not a result, not a prediction of success, and not a claim that the design is good. It is a commitment to a way of being wrong, made before the evidence arrives.',
  });
}

// =====================================================================================================
// 7. WORKED DESIGNS
// =====================================================================================================
//
// Seven proposals in this project's voice, across the clades this repo compares over. Each one's
// sources were retrieved; each one's answer set is argued in `answer_notes`; none of them is a claim
// made by a cited paper.

export const DESIGNS = deepFreeze([
  {
    id: 'kcnk5b-appendage-allometry-in-a-laboratory-fish',
    organism: 'bony fish host (Danio rerio)',
    function: 'allometric enlargement of a paired appendage by a potassium-leak channel',
    ours: 'DELPHI proposal. The papers supply the assay and the context; the prediction and the threshold are ours.',
    sources: ['perathoner_2014', 'jiang_2024'],
    answers: {
      QUANTITATIVE_PREDICTION: 'NUMBER_WITH_UNITS',
      EXISTING_ASSAY: 'PUBLISHED_ASSAY',
      RETRO_DECIDABLE: 'NEEDS_NEW_MEASUREMENT',
      HOST_TRACTABLE: 'ROUTINE_IN_HOST',
      TIME_TO_READOUT: 'MONTHS',
      CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_AND_SEPARABLE',
      NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_SPECIFIED',
    },
    answer_notes: {
      EXISTING_ASSAY: 'Two retrieved citations read this out: appendage proportion under channel gain of function (perathoner_2014) and bud proportion under channel overexpression and CRISPR targeting with an in vivo K+ sensor (jiang_2024).',
      CONFOUND_SEVERITY: 'Rivals named: overall growth rate and body size, rearing temperature and density, and redundancy with the duplicate copy of the channel gene. Separable by normalising appendage length to standard length, rearing clutch-mates together, and scoring both copies. The duplicate-copy problem is a real limit on interpreting the LOSS direction and does not block the gain-of-function prediction, which is why the prediction is written in the gain direction.',
      NEGATIVE_CONTROL_SPECIFIED: 'A conduction-dead channel variant. The retrieved record for perathoner_2014 states the channel requires the ability to conduct K+ ions to increase size, so a non-conducting variant SHOULD fail, and a pass for it would refute the mechanism rather than the design.',
    },
    written_before_looking: true,
    prediction: {
      statement: 'A conducting K+-leak channel driven in appendage mesenchyme raises the ray-length-to-standard-length ratio, relative to clutch-mate controls reared together, by at least fifteen percent at the same developmental stage.',
      number: { value: 1.15, units: 'ratio of (appendage ray length / standard length) in construct vs clutch-mate control, dimensionless' },
      negative_control: 'the same construct carrying a conduction-dead channel variant, which should produce a ratio indistinguishable from control',
      refuted_if: {
        measurement: 'appendage ray length and standard length, measured from calibrated images of stage-matched clutch-mates, construct and control arms',
        comparison: '<',
        threshold: 1.15,
        units: 'ratio of normalised appendage length, construct over control',
        n_required: { value: null, null_reason: 'no variance estimate for this ratio was retrieved from either citation', what_would_have_to_be_measured: 'the standard deviation of normalised appendage length in a wild-type clutch, from a pilot of one clutch' },
      },
    },
  },

  {
    id: 'our-nominated-size-gene-against-a-published-cross-species-comparison',
    organism: 'bony fishes (comparative; no new animal)',
    function: 'appendage proportion across species that have independently enlarged paired appendages',
    ours: 'DELPHI retro-test. The dataset is daane_2021\'s; the prediction under test is this pipeline\'s nomination.',
    sources: ['daane_2021'],
    answers: {
      QUANTITATIVE_PREDICTION: 'NUMBER_WITH_UNITS',
      EXISTING_ASSAY: 'PUBLISHED_ASSAY',
      RETRO_DECIDABLE: 'DECIDABLE_FROM_PUBLISHED_DATA',
      HOST_TRACTABLE: 'ROUTINE_IN_HOST',
      TIME_TO_READOUT: 'DAYS',
      CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_AND_SEPARABLE',
      NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_SPECIFIED',
    },
    answer_notes: {
      RETRO_DECIDABLE: 'daane_2021 reports a phylogenome-wide scan over 35 species of flying fishes and relatives and names the loci that carry the convergent signal. Whether this pipeline\'s nominated gene is among them is decided by reading that result. No animal is needed.',
      CONFOUND_SEVERITY: 'Rival named: phylogenetic non-independence, which makes a shared signal look repeated when it was inherited once. Separable by the published analysis\'s own branch-based treatment of convergence, which is why the test is run against their ranking rather than against a raw gene list.',
      NEGATIVE_CONTROL_SPECIFIED: 'The pipeline\'s nomination for a function it was never given evidence about, run through the same scan, which should land at the rank expected by chance.',
      HOST_TRACTABLE: 'Answered ROUTINE_IN_HOST because no perturbation is required at all; the axis is answered for completeness and does not reach the deciding rule.',
    },
    written_before_looking: false,
    the_honesty_problem: 'This repo had already read daane_2021 before this record was written, and records that the comparative signal matches kcnh2a and lat4a and NOT kcnk5b, the gene this project\'s design work turns on. So this is a POST_HOC_RECORD, prereg() labels it as one, and it may be cited as a consistency check and never as a prediction. It is kept because deleting the one retro-test we have already failed would be the single most misleading edit available in this folder.',
    prediction: {
      statement: 'The gene this pipeline nominates for appendage enlargement is among the top-ranked loci carrying the convergent signal in the published cross-species scan.',
      number: { value: 1, units: 'rank of the nominated gene in the published convergent-signal ranking; the prediction is top-decile' },
      negative_control: 'the pipeline\'s nomination for an unrelated function, which should rank at chance in the same scan',
      refuted_if: {
        measurement: 'the rank of this pipeline\'s nominated gene in the published convergent-signal ranking of daane_2021',
        comparison: 'outside-interval',
        threshold: 10,
        units: 'percentile of the published ranking; refuted if the nominated gene falls outside the top decile',
      },
    },
  },

  {
    id: 'donor-hyaluronan-synthase-into-a-mammalian-host',
    organism: 'mammalian host (mouse), donor gene from a long-lived mammal',
    function: 'raised high-molecular-mass hyaluronan, lowered tumour incidence, extended lifespan',
    ours: 'DELPHI proposal, written against a transfer that has ALREADY been performed - which is why it is the sharpest calibration available to us.',
    sources: ['zhang_2023'],
    answers: {
      QUANTITATIVE_PREDICTION: 'NUMBER_WITH_UNITS',
      EXISTING_ASSAY: 'PUBLISHED_ASSAY',
      RETRO_DECIDABLE: 'DECIDABLE_FROM_PUBLISHED_DATA',
      HOST_TRACTABLE: 'ROUTINE_IN_HOST',
      TIME_TO_READOUT: 'YEARS',
      CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_NOT_SEPARABLE',
      NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_CONCEIVABLE',
    },
    answer_notes: {
      CONFOUND_SEVERITY: 'This is the whole interest of the case. The retrieved record for zhang_2023 states that the beneficial effects "were conferred by HMM-HA and were not specific to the nmrHas2 gene". The interesting DELPHI claim is that the DONOR SPECIES\' gene is what matters - that borrowing this particular lineage\'s solution is the point. The published data cannot separate that from the generic effect of the polysaccharide, because the paper\'s own conclusion is the generic one. A named rival, from the source itself, that the existing data cannot exclude.',
      NEGATIVE_CONTROL_EXISTS: 'Conceivable and not specified: a host-species synthase pushed to the same hyaluronan level would be the control that makes the donor-specific claim testable. It does not block the tier, and it is exactly the missing arm.',
      TIME_TO_READOUT: 'YEARS for the lifespan arm. This does not change the tier - waiting is budgeting, not epistemics - and the record says so rather than letting the calendar masquerade as a difficulty.',
    },
    written_before_looking: false,
    prediction: {
      statement: 'A donor-species hyaluronan synthase raises tissue hyaluronan in the host and lowers spontaneous tumour incidence, and does so MORE than a host-species synthase driven to the same hyaluronan level.',
      number: { value: null, null_reason: 'The retrieved record reports "extended lifespan" and "lower incidence" with no figures, and we did not retrieve the source data. We will not write a percentage next to this DOI.', what_would_have_to_be_measured: 'median lifespan and tumour incidence per genotype with cohort sizes, from the paper\'s figures, plus the host-synthase arm which does not exist in the paper at all.' },
      negative_control: 'a catalytically dead synthase, which should raise no hyaluronan and change no incidence',
      refuted_if: {
        measurement: 'spontaneous tumour incidence at a fixed age in donor-synthase, host-synthase and control cohorts matched for tissue hyaluronan level',
        comparison: '>=',
        threshold: 0,
        units: 'percentage-point difference in incidence between the donor-synthase and host-synthase arms; refuted if the donor arm is not lower, i.e. if the donor species\' gene buys nothing beyond the polysaccharide',
      },
    },
  },

  {
    id: 'antifreeze-glycoprotein-into-a-temperate-fish',
    organism: 'bony fish host from temperate water; donor lineage is a cold-water bony fish',
    function: 'freeze avoidance by a repetitive glycoprotein that binds ice',
    ours: 'DELPHI proposal. chen_1997 supplies the gene\'s origin and architecture; the physiological threshold is ours and the assay citation is missing.',
    sources: ['chen_1997'],
    answers: {
      QUANTITATIVE_PREDICTION: 'NUMBER_WITH_UNITS',
      EXISTING_ASSAY: 'ASSAY_NEEDS_ADAPTING',
      RETRO_DECIDABLE: 'NEEDS_NEW_MEASUREMENT',
      HOST_TRACTABLE: 'POSSIBLE_IN_HOST',
      TIME_TO_READOUT: 'MONTHS',
      CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_AND_SEPARABLE',
      NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_SPECIFIED',
    },
    answer_notes: {
      EXISTING_ASSAY: 'ASSAY_NEEDS_ADAPTING, not PUBLISHED_ASSAY, for a reason that is about us and not about the field: thermal hysteresis is routine in the antifreeze literature, and we did not retrieve a citation for it. The axis is answered on what we hold, so the honest answer is the weaker one. chen_1997 is about the gene\'s origin and contains no hysteresis measurement.',
      CONFOUND_SEVERITY: 'Rivals named: serum osmolality raised by any solute, and endogenous mucus glycoproteins. Separable by measuring hysteresis against an osmolality-matched control serum and by assaying the purified product rather than whole serum alone.',
      NEGATIVE_CONTROL_SPECIFIED: 'The trypsinogen progenitor sequence WITHOUT the amplified Thr-Ala-Ala repeat backbone. The retrieved record for chen_1997 states that the repeat region was created by de novo amplification to make the antifreeze backbone, so the progenitor without it should show no hysteresis.',
    },
    written_before_looking: true,
    prediction: {
      statement: 'The donor glycoprotein expressed and secreted in the temperate host produces measurable thermal hysteresis in host serum at a stated concentration.',
      number: { value: 0.5, units: 'degrees Celsius of thermal hysteresis in host serum, at a stated protein concentration, versus an osmolality-matched control' },
      negative_control: 'the progenitor sequence lacking the amplified repeat backbone, which should give hysteresis indistinguishable from the osmolality-matched control',
      refuted_if: {
        measurement: 'thermal hysteresis of host serum by nanolitre osmometry, construct arm versus osmolality-matched control arm, at a stated protein concentration',
        comparison: '<',
        threshold: 0.5,
        units: 'degrees Celsius',
      },
    },
    a_number_we_refused: 'A hysteresis value for the natural donor protein would be the right thing to anchor the threshold to. We did not retrieve a paper reporting one, so the 0.5 here is OUR stated threshold and is not attributed to anyone. Retrieving that citation would be the first thing to do to this record.',
  },

  {
    id: 'preconditioning-membrane-chemistry-in-a-nematode-host',
    organism: 'nematode host',
    function: 'desiccation tolerance via trehalose accumulation and a lowered phosphatidylcholine fraction',
    ours: 'DELPHI proposal. abusharkh_2014 supplies the biophysical assay and the measured contrast; the transfer and the threshold are ours.',
    sources: ['abusharkh_2014'],
    answers: {
      QUANTITATIVE_PREDICTION: 'NUMBER_WITH_UNITS',
      EXISTING_ASSAY: 'PUBLISHED_ASSAY',
      RETRO_DECIDABLE: 'NEEDS_NEW_MEASUREMENT',
      HOST_TRACTABLE: 'ROUTINE_IN_HOST',
      TIME_TO_READOUT: 'WEEKS',
      CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_AND_SEPARABLE',
      NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_SPECIFIED',
    },
    answer_notes: {
      QUANTITATIVE_PREDICTION: 'The prediction is written on the BIOPHYSICAL readout, where abusharkh_2014 gives a measured contrast we actually retrieved - a 2.6-fold smaller compressibility modulus in preconditioned larvae - and not on survival, where the record gives us no number and no protocol. Writing the prediction where the anchor exists is the whole trick, and it is available here only because we checked which number we had.',
      CONFOUND_SEVERITY: 'Rivals named: the trehalose contribution and the headgroup contribution are confounded in the natural preconditioned state. Separable because the design manipulates them independently, which the natural state does not.',
      NEGATIVE_CONTROL_SPECIFIED: 'Non-preconditioned larvae of the same strain, run in the same monolayer session - the arm whose measured modulus the published contrast is against.',
    },
    written_before_looking: true,
    prediction: {
      statement: 'Driving trehalose accumulation together with a lowered phosphatidylcholine fraction in a host that does not naturally precondition reproduces at least half of the published monolayer compressibility contrast.',
      number: { value: 1.8, units: 'fold reduction in phospholipid monolayer compressibility modulus, construct versus non-preconditioned control of the same strain, measured in the same session' },
      negative_control: 'non-preconditioned larvae of the same strain in the same session; and trehalose alone without the headgroup change, which should give less than the combined arm',
      refuted_if: {
        measurement: 'compressibility modulus of extracted phospholipid monolayers by Langmuir-Blodgett, construct and control arms in one session',
        comparison: '<',
        threshold: 1.8,
        units: 'fold reduction relative to the matched control',
      },
    },
    anchored_to: 'abusharkh_2014 reports a 2.6-fold smaller compressibility modulus for phospholipids from preconditioned larvae than from non-preconditioned ones. Our threshold of 1.8 is roughly half that contrast and is OUR choice, not theirs.',
  },

  {
    id: 'setal-dry-adhesion-onto-a-non-adhesive-squamate-host',
    organism: 'squamate reptile host without adhesive toe pads; donor structure from an adhesive squamate',
    function: 'dry adhesion by arrays of fine keratinous setae operating through van der Waals forces',
    ours: 'DELPHI proposal. autumn_2000 supplies the single-seta assay; the number we would have anchored to is one we refused to write.',
    sources: ['autumn_2000'],
    answers: {
      QUANTITATIVE_PREDICTION: 'DIRECTION_ONLY',
      EXISTING_ASSAY: 'PUBLISHED_ASSAY',
      RETRO_DECIDABLE: 'NEEDS_NEW_MEASUREMENT',
      HOST_TRACTABLE: 'NOT_TRACTABLE_IN_HOST',
      TIME_TO_READOUT: 'GENERATIONS',
      CONFOUND_SEVERITY: 'CONFOUNDS_NAMED_AND_SEPARABLE',
      NEGATIVE_CONTROL_EXISTS: 'NEGATIVE_CONTROL_SPECIFIED',
    },
    answer_notes: {
      QUANTITATIVE_PREDICTION: 'DIRECTION_ONLY, and this is the module demonstrating its own rule on itself. The natural anchor is the per-seta force in micronewtons from autumn_2000. The retrieved record gives fold-changes and not that absolute value, so it is recorded null. Without it we cannot state a per-seta target, so the axis drops from NUMBER_WITH_UNITS to DIRECTION_ONLY and the design cannot reach the top tier. Refusing to write a remembered number demoted our own design, and that is the direction the refusal should push.',
      HOST_TRACTABLE: 'NOT_TRACTABLE_IN_HOST: there is no established germline transformation route in the host species, and a skin-appendage array is a developmental programme rather than a transgene.',
      NEGATIVE_CONTROL_SPECIFIED: 'Setae loaded above the critical detachment angle, which the retrieved record names as the condition under which suitably oriented setae release. They should not adhere, and a pass for them would mean the rig is measuring friction rather than the mechanism.',
    },
    written_before_looking: true,
    prediction: {
      statement: 'A seta array formed on the host\'s digit adheres, per unit projected pad area, measurably more than the host\'s unmodified scale surface on the same substratum at the same preload.',
      number: { value: null, null_reason: 'The per-seta force in micronewtons from autumn_2000 was not in the retrieved record, only fold-changes, so we have no anchor and will not recall one.', what_would_have_to_be_measured: 'the per-seta force with its preload and orientation, read from that paper\'s own table or figure; then this prediction can be restated with units.' },
      negative_control: 'the same array loaded above the critical detachment angle, which should release',
      refuted_if: {
        measurement: 'normal adhesive force per unit projected pad area on a flat substratum at a fixed preload, modified digit versus unmodified digit of the same animal',
        comparison: 'sign-differs',
        threshold: 0,
        units: 'newtons per square centimetre; refuted if the modified digit does not exceed the unmodified digit',
      },
    },
  },

  {
    id: 'oscillatory-flight-musculature-into-a-nematode-body-wall',
    organism: 'nematode host; donor is an insect',
    function: 'asynchronous, stretch-activated oscillatory contraction of the kind that powers insect flight',
    ours: 'DELPHI proposal, included because it is the kind of design a generative pipeline emits constantly and a reviewer rejects in one line. The module should reject it in one line too, and name which line.',
    sources: [],
    answers: {
      QUANTITATIVE_PREDICTION: 'DIRECTION_ONLY',
      EXISTING_ASSAY: 'NO_KNOWN_ASSAY',
      RETRO_DECIDABLE: 'UNDECIDABLE_EITHER_WAY',
      HOST_TRACTABLE: 'POSSIBLE_IN_HOST',
      TIME_TO_READOUT: 'WEEKS',
      CONFOUND_SEVERITY: 'CONFOUNDS_UNENUMERATED',
      NEGATIVE_CONTROL_EXISTS: 'NO_NEGATIVE_CONTROL',
    },
    answer_notes: {
      HOST_TRACTABLE: 'POSSIBLE_IN_HOST, and note that this is the ONE axis on which the design does well. The host\'s germline is workable. That is exactly why tractability must not be the headline: a design can be buildable and still not be a claim.',
      CONFOUND_SEVERITY: 'CONFOUNDS_UNENUMERATED: nobody has written down what else would make a nematode body wall oscillate, and there is a great deal - endogenous rhythmic locomotion first among it.',
      NEGATIVE_CONTROL_EXISTS: 'NO_NEGATIVE_CONTROL: nothing in the proposal could fail, because no quantity is being read out.',
    },
    written_before_looking: true,
    prediction: {
      statement: 'The host body wall shows oscillatory contraction attributable to the donor contractile programme.',
      number: { value: null, null_reason: 'no number was proposed', what_would_have_to_be_measured: 'contraction frequency in hertz and work per cycle, against the host\'s endogenous locomotor rhythm' },
      refuted_if: null,
    },
    what_happens_when_you_prereg_it: 'prereg() THROWS on this design, because refuted_if is null. That is the intended behaviour and this design is in the set so that the throw is exercised against something realistic rather than a fixture.',
  },
]);

export const DESIGN_IDS = deepFreeze(DESIGNS.map(d => d.id));

/** Every design, assessed. Distribution included; it is NOT a base rate, and says so. */
export function worked() {
  const rows = DESIGNS.map(d => {
    const a = assess(d, d.answers);
    let prereg_record = null, prereg_threw = null;
    try { prereg_record = prereg(d, d.answers); } catch (e) { prereg_threw = e.message; }
    return deepFreeze({
      id: d.id,
      organism: d.organism,
      function: d.function,
      tier: a.tier,
      rule: a.verdict.rule,
      because: a.verdict.because,
      headline: a.headline,
      answers: d.answers,
      blockers: a.blockers.map(b => `${b.axis}=${b.answer}`),
      caveats: a.verdict.caveats,
      prereg_kind: prereg_record ? prereg_record.kind : null,
      prereg_threw,
      written_before_looking: d.written_before_looking,
      sources: d.sources,
    });
  });
  const distribution = Object.fromEntries(TIER_IDS.map(t => [t, rows.filter(r => r.tier === t).length]));
  return deepFreeze({
    n: rows.length,
    rows,
    distribution,
    tiers_unreached: TIER_IDS.filter(t => distribution[t] === 0),
    n_post_hoc: rows.filter(r => r.prereg_kind === 'POST_HOC_RECORD').length,
    n_prereg_refused: rows.filter(r => r.prereg_threw !== null).length,
    what_it_does_not_show: 'This distribution is NOT a base rate for DELPHI designs. Seven designs were chosen to span the tiers and the clades this repo compares over, so the spread is a property of the choosing. A base rate would require sampling the pipeline\'s actual output.',
    the_uncomfortable_row: 'our-nominated-size-gene-against-a-published-cross-species-comparison is the only RETRO_VALIDATABLE_NOW design here that bears on this project\'s own central gene nomination, it is a POST_HOC_RECORD because the deciding paper was read first, and the repo already records that the published comparative signal matches other loci and not ours. The one retro-test we have is one we did not pass.',
    data_provenance: 'Where a cited dataset spans more groups than this repo compares over, only the allowed rows are taken; the subset is mammals, fishes, amphibians, squamate reptiles, insects, nematodes and microbes, because that is this repo\'s comparative scope.',
  });
}

// =====================================================================================================
// 8. THE TWO PIECES OF PROSE
// =====================================================================================================

export const WHY_NOT_A_SCORE = deepFreeze({
  headline: 'The seven axes are not averaged, because an average would let a design buy its way past the axis that decides whether it is a claim at all.',
  the_argument: [
    'The axes are not commensurable. One is about the grammar of the prediction, one about the existence of an instrument, one about whether a dataset already exists, one about an organism\'s husbandry, one about elapsed time, one about causal identification, one about whether anything in the design could fail. There is no unit they share and nothing to add up.',
    'Averaging is defeated by its own best case. A design with six excellent axes and NO_COMMITMENT on the first would score high and be unfalsifiable. That is not a near miss to be handled by a penalty term; it is a different kind of object, and a mean cannot represent the difference between "nearly testable" and "not a proposition".',
    'The blocking axes are conjunctive, not additive. A published assay does not compensate for an intractable host; a tractable host does not compensate for an inseparable confound. Each link has to hold for the chain from claim to contradiction to exist, so the right operation over them is AND, and AND is not a weighted sum.',
    'One number hides WHICH link is broken, and the broken link is the entire actionable content. NOT_YET_DECIDABLE because no instrument exists and NOT_YET_DECIDABLE because the host cannot be transformed are the same tier and completely different projects, and a scalar erases the difference at the first function call.',
    'A number between zero and one is read as a probability of being right. This module is not about being right. A design can be maximally validatable and false, which is the best possible state for a design to be in, and a float would make that state look bad.',
    'And this project in particular has no licence to emit fused scores. Two of its three benchmarked levels came out at chance against external ground truth, so a fused number from here would be a confident-looking summary produced by machinery already measured as uninformative. See THE_UNCOMFORTABLE_PART.',
  ],
  what_is_returned_instead: 'a per-axis verdict from a closed vocabulary; one tier from a closed set of four, named by the rule that produced it with that rule\'s one-line justification; the list of blocking axes; and caveats for the axes that did not change the tier but change what a pass would mean.',
  if_you_need_to_rank: 'Rank on the TIERS, which are ordered by how soon a refutation could arrive - retro now, lab next, not yet, refused. Within a tier, rank by the blocker, not by a number, and state the ranking in the artefact that consumes it rather than asking this module to invent one quietly.',
});

export const THE_UNCOMFORTABLE_PART = deepFreeze({
  headline: 'In this project\'s own benchmarks, two of the three levels came out at chance against external ground truth. So a claim about the VALIDATABILITY of a design is currently a far stronger claim than any claim about the QUALITY of the design, and this module is the only one in the folder whose output does not route through the machinery that scored at chance.',
  the_numbers: {
    note: 'Read from benchmarks/README.md in this working tree on 2026-11-07. These are our own results, not any paper\'s.',
    guide_score: 'the score the editing planner ranks by, against measured activity for 307 measured laboratory-fish guides: Spearman rho = -0.037, confidence interval [-0.149, 0.073], which includes zero',
    design_scorer: 'AUC 0.891 against shuffled decoys, falling to 0.536 - chance - against real organisms nudged a quarter of a standard deviation; and an anatomically impossible constructed animal placed at q = 0.918, which the scorer calls typical',
    law_coverage: '1 of 48 laws in the registry expressible as a constraint on the design representation; the worst violator sits at q = 0.347, more typical than 87.1% of real fish',
    the_one_that_passed: 'the machine-checked layer: 48/48 witnesses checked, 1 mutant refuted, control behaves',
    the_line_from_the_file: 'Two of the three levels come out at chance against external ground truth. One passes.',
  },
  what_follows_from_it: [
    'When this repo says a design is good, that sentence is produced by scorers whose discrimination against hard negatives has been measured at chance. It is not evidence. Treat it as a shortlist drawn by an uncalibrated instrument.',
    'When this module says a design is RETRO_VALIDATABLE_NOW, that sentence is about the existence of a published dataset, a stated threshold and a named rival. It can be checked by anyone, today, without trusting any scorer here.',
    'So validatability currently carries more information than quality, and the ordering is the opposite of the one a design pipeline naturally reports. The correct output of this project, right now, is a ranked list of ways it could be shown to be wrong - not a ranked list of organisms.',
    'This also sets the priority. Getting the design scorer above chance on hard negatives is worth more than any number of further designs, and the only way anyone will know whether it has happened is a retro-decidable prediction written before looking. That is what prereg() is for, and why written_before_looking cannot be defaulted.',
  ],
  the_sharpest_instance: 'The single retro-test available to us bears on this project\'s central gene nomination, and the repo records that the published comparative signal matches other loci and not ours. That record is kept, labelled POST_HOC because the paper was read before the prediction was written, and reported in worked() as the uncomfortable row. A validatability module whose own worked set contained only tests it passes would be an advertisement.',
  not_an_excuse: 'None of this licenses vagueness. The response to uncalibrated scorers is sharper thresholds and cheaper refutations, not softer language. Every design in DESIGNS states what would refute it or throws when asked to pretend.',
});

export const WHAT_THIS_IS = deepFreeze(
  'A judgement about a PROPOSAL: could this organism x function design be shown to be wrong, how soon, ' +
  'and by what evidence? Seven independent axes, each with its own closed vocabulary - whether a number ' +
  'with units is committed to, whether a published assay reads the phenotype out, whether already- ' +
  'published data decides it, whether the host can be worked in, how long until the readout, what else ' +
  'produces the same readout, and whether anything in the design could fail. One tier from a closed set ' +
  'of four, assigned by exported rules each carrying its justification. It says nothing whatever about ' +
  'whether the design is a good idea, and it emits no fused score.'
);

// =====================================================================================================
// CLI
// =====================================================================================================

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('validatability.mjs')) {
  const w = worked();
  console.log(`\nvalidatability: could we be shown to be wrong, and how soon?\n`);
  console.log(WHAT_THIS_IS + '\n');
  for (const r of w.rows) {
    console.log(`  ${r.tier.padEnd(26)} ${r.id}`);
    console.log(`  ${''.padEnd(26)} rule ${r.rule}: ${r.because}`);
    if (r.blockers.length) console.log(`  ${''.padEnd(26)} blocked by: ${r.blockers.join(', ')}`);
    if (r.prereg_threw) console.log(`  ${''.padEnd(26)} prereg REFUSED: ${r.prereg_threw.slice(0, 120)}...`);
    else console.log(`  ${''.padEnd(26)} prereg: ${r.prereg_kind}`);
    console.log('');
  }
  console.log(`  distribution: ${JSON.stringify(w.distribution)}`);
  console.log(`  tiers unreached: ${w.tiers_unreached.length ? w.tiers_unreached.join(', ') : 'none'}`);
  console.log(`  answer sets tier() must be total over: ${N_ANSWER_SETS}`);
  console.log(`\n  ${THE_UNCOMFORTABLE_PART.headline}\n`);
}
