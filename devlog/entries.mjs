// The dev log. One entry per feature, each answering the same four questions.
//
// WHY  - the fun and the science, kept apart, because they are different reasons and a feature that only
//        has the first is a toy while one that only has the second is a chore.
// OPEN - the questions that stay open REGARDLESS OF DATA. Not "we haven't measured it yet" - those go
//        under what_would_settle_it. These are the ones where more measurement is not the kind of thing
//        that would help: definitional boundaries, modelling choices, category questions. They are the
//        most interesting part of each feature and the part usually left out of a changelog.
// HOW  - at the FILE level. What is actually on disk, how it is organised, what is packed into it.
// DNA  - where it sits in Delphi / Nous / Aletheia (see framework.mjs, and note the reading is mine).

export const ENTRIES = Object.freeze([
  {
    id: 'life-format',
    title: '.life — an organism\'s whole trajectory, in time',
    status: 'shipped',
    dna: ['delphi', 'aletheia'],
    why_fun:
      'A file format is the most durable thing you can build. .stl outlived every program that made one, ' +
      'because it was simple enough to be obvious and specific enough to be useful. The idea that a ' +
      'designed organism could have an extension - that you could double-click a creature - is a good ' +
      'enough idea on its own that it is worth seeing whether it survives contact with the biology.',
    why_science:
      'A .organism describes a design AT REST; stages are metadata. That is the wrong shape for the thing ' +
      'actually being designed, which is a trajectory. And the difference is not cosmetic: A SNAPSHOT ' +
      'CANNOT BE WRONG ABOUT A TRAJECTORY - it has nothing to be wrong with. Make time the primary axis ' +
      'and the file starts making claims that can be FALSE - that this cell count follows that one, that ' +
      'this stiffness falls as that lineage separates - which is what makes them worth storing.',
    open_questions: [
      {
        q: 'When is a simulated organism "the same organism" as the design it came from?',
        why_data_will_not_settle_it:
          'identity over time is a definitional boundary, not a measurement. A trajectory that diverges ' +
          'from its design at stage 4 is either a failed instance of that design or a different design, ' +
          'and no amount of imaging decides which. The file has to pick a convention and say so.',
      },
      {
        q: 'What is the right granularity for a stage?',
        why_data_will_not_settle_it:
          'development is continuous and staging is a human imposition on it. Carnegie stages are ' +
          'defined by morphology precisely because age does not work, and the cost is that a stage is a ' +
          'RANGE of days that overlaps its neighbours. Finer imaging gives you more frames, not a ' +
          'principled stage boundary.',
      },
      {
        q: 'Should a format be able to represent an organism that cannot exist?',
        why_data_will_not_settle_it:
          'this is a design choice with real consequences either way. Forbid it and you cannot write ' +
          'down a hypothesis; allow it and the file cannot be trusted as a record. .life allows it and ' +
          'requires it to be marked, which is a third answer and not obviously the right one.',
      },
    ],
    how_file_level: {
      path: 'organism-format/life/',
      files: [
        ['spec.mjs', 'the format: FORMAT tag, CHANNELS, STAGE_REQUIRED, TIME_UNITS, REFUSALS, the two geometry-provenance axes, COORDINATE_CONVENTIONS'],
        ['write.mjs', 'the builder. Requires provenance AT CONSTRUCTION and throws without it - 12 refusals verified firing'],
        ['read.mjs', 'the validator: refused / degraded / ok, plus channelCoverage and provenanceCensus'],
        ['stl.mjs', 'binary STL export, provenance burned into the 80-byte header'],
        ['fasta.mjs', 'genome export, provenance forced into every description line'],
        ['compare.mjs', 'genetic and phenotypic distance, returned separately and never summed'],
        ['atlas.mjs', 'the Carnegie-stage layer, ordinal and refusing arithmetic'],
        ['examples/mouse-preimplantation.life', 'the worked example, 5 stages and 31 cells'],
      ],
      what_is_packed_in:
        'A .life is JSON with four required blocks. `identity` says what animal this is. `genome` is an ' +
        'EDIT-LIST against a named reference assembly - kilobytes rather than hundreds of megabytes, and ' +
        'it states what the design IS rather than what it resembles. `timeline.stages[]` is the spine: ' +
        'each stage pins itself with a time, a TIME UNIT and a TEMPERATURE (development rate is ' +
        'temperature-dependent, so a stage time without one is not a stage), and carries `geometry` ' +
        '(per-cell centre, radius, surface area, EXPOSED surface area, curvature) plus a `phenotype` map. ' +
        'Each cell may carry channels: transcriptome (with an in_situ flag), mechanics, geometry, ' +
        'lineage, signalling. And `not_established` is required - a file that lists nothing it does not ' +
        'know is making the strongest possible claim by omission.',
      the_detail_that_matters:
        'EVERY VALUE CARRIES A KIND AND A SCOPE. The kinds are measured, measured-secondhand, borrowed, ' +
        'derived, calibrated, assumed, depicted. An `unknown` carries no value at all - that rule exists ' +
        'because a value of the shape {v: 0.31, unknown: true} slipped past every provenance check in ' +
        'the .organism reader. The census line that falls out is the most useful line in the file: the ' +
        'worked example is 10 measured-secondhand / 5 assumed / 5 depicted / 5 derived / 5 ' +
        'not-established, and NONE measured by us.',
    },
    real_numbers: [
      '5 stages, 31 cells, 25 phenotype values in the worked example',
      'geometry present on 31 of 31 cells, MEASURED ON 0',
      'transcriptome and mechanics present on 0 of 31 cells',
      '226 tests across the format modules, 0 survive their own fault',
    ],
    what_went_wrong: [
      'The spec required `elastic_modulus_Pa` as a field name, following an abstract that turned out to be a STALE v1 deposit. The authors had retreated to "relative compliance". A field name can impose a unit the measurement does not have - requiring pascals does not make the data a modulus, it makes the file lie in a way no reader can detect.',
      'read.mjs stringified `{what, answer}` entries to "[object Object]", so it reported the example missing all four required disclosures while the example answered all four verbatim. A false negative in the honesty check is worse than no check.',
    ],
  },

  {
    id: 'benchmarks',
    title: 'Benchmarks — the state of the system as measured, not as described',
    status: 'shipped',
    dna: ['aletheia'],
    why_fun:
      'There is a particular pleasure in finding out that something you built does not work, before ' +
      'someone else does. It is also the only move in this whole field that is guaranteed to teach you ' +
      'something: a benchmark that confirms what you believed is a wasted afternoon, and one that does ' +
      'not is the best day of the month.',
    why_science:
      '"61 laws registered, 73 Lean-checked theorems" and "AUC 0.89" are PRODUCTIVITY figures. They ' +
      'measure how much was built and they cannot come out badly. A benchmark has to be able to come out ' +
      'badly, which means the answer has to come from somewhere the system does not control. Three of ' +
      'the four here did come out badly, which is the point.',
    open_questions: [
      {
        q: 'Does a plausibility score ever constitute evidence of viability?',
        why_data_will_not_settle_it:
          'this is a category question, not an empirical one. A Mahalanobis distance measures how unusual ' +
          'a vector is under a fitted distribution. More data makes the distribution better estimated; it ' +
          'does not turn "unusual" into "impossible". We demonstrated the gap - an animal whose dorsal ' +
          'fin starts past its tail scores more typical than 87% of real fish - but the gap is structural ' +
          'and would survive a perfect model.',
      },
      {
        q: 'What should a benchmark do when the ground truth is itself a model?',
        why_data_will_not_settle_it:
          'CRISPRscan reaches rho 0.269 on data from the study that fitted it. That is an upper bound, ' +
          'not an estimate, and the only fix is independent data - but "independent" is a judgement about ' +
          'provenance and shared assumptions, not a quantity you can measure.',
      },
      {
        q: 'Is soundness ever evidence of relevance?',
        why_data_will_not_settle_it:
          'the Lean layer proves things correctly. Whether the things proved are the things that matter ' +
          'to a design is a question about the choice of formalisation, and no proof assistant has an ' +
          'opinion about it.',
      },
    ],
    how_file_level: {
      path: 'benchmarks/',
      files: [
        ['README.md', 'the index: the four results, the five properties, and the two predictions that came out wrong'],
        ['crispr-ontarget/', 'the guide score against 307 measured zebrafish sgRNAs; CRISPRscan reimplemented and verified'],
        ['lean-mutation/', 'non-vacuity, and mutation testing with the three-way kill classification'],
        ['design-hard-negatives/', 'the decoy ladder, the adversarial search, and laws.mjs deriving constraints from the registry'],
        ['lean-open-problems/', '14 problems triaged on two axes'],
      ],
      what_is_packed_in:
        'Each directory is self-contained: a module holding the method, a `run.mjs` producing a ' +
        '`results.json`, a `test.mjs` taking `--fail-once`, and a README stating the result and what it ' +
        'does NOT cover. `crispr-ontarget/SOURCES.md` rebuilds the ground truth in three curls; the ' +
        'ground truth itself is copyrighted and is not redistributed.',
      the_detail_that_matters:
        'The `--fail-once` discipline: the harness injects ONE fault per assertion and requires that the ' +
        'assertion notices. AN ASSERTION THAT SURVIVES ITS OWN FAULT IS REPORTED AS A FAILURE, because it ' +
        'was not testing anything. Across every suite in this work: 0 survivors.',
    },
    real_numbers: [
      'the guide score we rank by: rho = -0.037, CI [-0.149, 0.073] - includes zero',
      'CRISPRscan layout DERIVED by reproducing 25 published scores exactly, max difference 0.0000',
      'design AUC: 0.891 on shuffled decoys, 0.536 on real fish nudged a quarter of a standard deviation',
      'an anatomically impossible animal at q = 0.347, more typical than 4,068 of 4,673 real fish',
      '48/48 laws with a theorem carry a machine-checked non-vacuity witness',
      'only 1 of 48 theorem-carrying laws is expressible on the ten trait ratios',
    ],
    what_went_wrong: [
      'A first CRISPRscan alignment gave a plausible rho = 0.75 at the WRONG offset - pure misalignment artefact, because reverse-complementing a window flips its flanks with it. It would have shipped.',
      'A written prediction that correlation-preserving decoys would score 0.5 "by construction" came out at 0.663, because the fitted Gaussian is OVERDISPERSED relative to real fish. The wrong prediction was more informative than the right one would have been.',
    ],
  },

  {
    id: 'controls',
    title: 'The fifth property: a benchmark needs a control',
    status: 'learned the hard way, twice',
    dna: ['aletheia'],
    why_fun:
      'Every single control built this week caught MY work rather than the system\'s. That is a slightly ' +
      'humbling pattern and a very reassuring one: it means the controls are load-bearing rather than ' +
      'decorative, which is not true of most tests.',
    why_science:
      'A benchmark must take its answer from outside the system, be able to fail, state its scope, and be ' +
      'reproducible. Those four are standard. The fifth is not, and it is the one that actually bit: ' +
      'without a control you cannot distinguish "the system failed" from "my harness cannot tell".',
    open_questions: [
      {
        q: 'How do you control a control?',
        why_data_will_not_settle_it:
          'the regress is real. The Lean control was a weakened mutant that must survive; it came back ' +
          'UNPROVEN, revealing the harness was too weak. But that only worked because I knew independently ' +
          'that the weakened statement was true. At some point a human judgement terminates the chain, ' +
          'and no amount of automation removes that point - it only moves it.',
      },
      {
        q: 'When a plausible constraint fails on real data, is the constraint wrong or the data?',
        why_data_will_not_settle_it:
          'one "preanal <= 1 SL" violator is almost certainly a measurement artefact. But overruling a ' +
          'control because the violator looks wrong is exactly the move the control exists to prevent, ' +
          'so it stands. Which way to resolve this is a methodological commitment, not a finding.',
      },
    ],
    how_file_level: {
      path: 'benchmarks/*/test*.mjs and the CONSTRAINTS/REJECTED exports',
      files: [
        ['design-hard-negatives/adversarial.mjs', 'REJECTED carries each failed candidate WITH its measured rate, so the mistake cannot be repeated quietly'],
        ['design-hard-negatives/laws.mjs', 'verifyAgainstReal() returns counts, not booleans; cleared() admits only rate exactly 1.0'],
        ['lean-mutation/mutants.mjs', 'is_control marks the mutant that MUST survive'],
        ['sim-engine/validate/gate/containment.mjs', 'mayGate() refuses in code anything below 1.0 support'],
      ],
      what_is_packed_in:
        'A rejected constraint is not deleted. It is kept with the share of real specimens that satisfy ' +
        'it and a `why_not` - so the file records the near-miss rather than only the survivor.',
      the_detail_that_matters:
        'The rule is enforced in code, not in a comment: a constraint may gate ONLY when its recorded ' +
        'support over a real sample is exactly 1. A gate that rejects real fish is worse than no gate.',
    },
    real_numbers: [
      '"the pectoral fin sits behind the head" is FALSE for 39% of real fish - 4,673 specimens checked',
      'the real-specimen control rejected 4 of 8 candidates in one module and 7 of 13 in another',
      'a plausible-sounding anatomical containment is about as likely to be wrong as right',
      'the gate refuses 0 of 4,673 real specimens, which is the only property that makes it deployable',
    ],
    what_went_wrong: [
      'I ran the holdout leak gate and git commit in one && chain, so a flagged leak did not block the commit. A GATE CHAINED BEHIND THE ACTION IT GUARDS IS NOT A GATE.',
      'A Lean mutant was aimed the wrong way: widening a disjunct WEAKENS a conclusion, so the "false" mutant stayed true. Lean said so precisely - the attempted counterexample was inside the measured band.',
    ],
  },

  {
    id: 'analogy',
    title: 'Analogy mapping — homology is not function',
    status: 'in progress',
    dna: ['delphi', 'aletheia'],
    why_fun:
      'The question "is this the same thing as that?" is the oldest question in comparative biology and ' +
      'it is still not mechanised. Watching agents fan out over twenty genomes to answer it, and then ' +
      'watching most of the answers get thrown out, is the most honest demo this project has.',
    why_science:
      'DELPHI designs by borrowing a structure from one species into another, which requires deciding ' +
      'when a gene in A is the FUNCTIONAL ANALOGUE of one in B. The pipeline treated orthology as if it ' +
      'answered this. It does not. Homology is shared ancestry; analogy is shared function without it. An ' +
      'ortholog can have diverged entirely, a one-to-many orthologue is not an equivalent of anything, ' +
      'and the convergent cases a design programme most cares about have no orthology at all.',
    open_questions: [
      {
        q: 'What makes two structures "the same structure"?',
        why_data_will_not_settle_it:
          'homology is a claim about history, and history is not directly observable. Sequence, position, ' +
          'development and expression are all correlates, and they disagree - a structure can be ' +
          'positionally homologous and developmentally novel. There is no measurement that returns ' +
          '"same", only measurements that return "similar in this respect".',
      },
      {
        q: 'How should incommensurable evidence kinds be weighed against each other?',
        why_data_will_not_settle_it:
          'rescue experiments, synteny, expression similarity and domain architecture are different kinds ' +
          'of evidence, not different amounts of one kind. Collapsing them into a single confidence number ' +
          'requires weights, and the weights are a modelling choice that propagates into every downstream ' +
          'decision. More data makes each kind better measured and does not make them commensurable.',
      },
      {
        q: 'Is "no orthologue found" ever evidence of absence?',
        why_data_will_not_settle_it:
          'searching one database is not searching. The strength of a negative depends on the coverage ' +
          'and sensitivity of what was searched, which is a judgement about the search, not a result of it.',
      },
    ],
    how_file_level: {
      path: 'analogues/',
      files: [
        ['fetch.mjs', 'live NCBI Datasets v2, Ensembl REST and E-utilities, with on-disk caching to C:/Temp and real rate limiting'],
        ['inventory.mjs', 'the curated species inventory, each entry stating WHY it is a reference and verified to resolve'],
        ['analogy.mjs', 'EVIDENCE_KINDS, the classifier, and the refusals'],
        ['align.mjs', 'real Gotoh affine-gap Needleman-Wunsch and Smith-Waterman, BLOSUM62, and the cassette layout'],
        ['phylo.mjs', 'the tree, divergence ranges, and phenome correspondence classes'],
        ['cases.mjs', 'the three worked requests'],
        ['storyboard.mjs', 'assembles the animation data and degrades rather than failing'],
      ],
      what_is_packed_in:
        'Nothing in here caches into the repository. Genome responses go to C:/Temp/delphi-genome-cache/ ' +
        'keyed by a hash of the URL, because the repo already has a rule against committing large data ' +
        'and a genome is the canonical violation of it. Every fetch distinguishes three outcomes that are ' +
        'usually collapsed: the API said no, the API failed, and we did not ask.',
      the_detail_that_matters:
        'THE TELEOST PROBLEM. The teleost genome duplication means many zebrafish genes are duplicate ' +
        'pairs that SPLIT the ancestral function, so a single mammalian gene maps to two fish genes each ' +
        'doing part of the job. A mapping that picks one and calls it "the" orthologue is wrong in a way ' +
        'that shows up as a failed experiment. We have a live instance: kcnk5b and its paralog kcnk5a.',
    },
    real_numbers: [
      'percent identity has three defensible denominators - on one real alignment they give 100.0%, 75.0% and 60.0%. The module returns all three rather than picking',
      'BLOSUM62 verified: 24x24, 0 of 576 entries asymmetric',
      'hand-computed alignment case GATTACA/GATACA = 9, asserted exactly',
      'the SpCas9 blunt cut is 3 bp 5\' of the PAM, asserted six ways - an off-by-one here designs a cassette that integrates in the wrong place',
    ],
    what_went_wrong: [],
  },

  {
    id: 'cases',
    title: 'Three requests that fail in three different ways',
    status: 'in progress',
    dna: ['delphi', 'aletheia'],
    why_fun:
      'A glowing fly, a higher-protein worm, and a cow that burps less. They sound like three versions of ' +
      'the same request and they are not even the same KIND of request, which is the most useful thing ' +
      'about the set.',
    why_science:
      'Only one of the three is a genome-editing problem in the shape the pipeline assumes. One is not a ' +
      'mapping problem - the function is ADDED, not transferred, and no orthologue exists or is needed. ' +
      'One is polygenic and not a single edit. And one is not about the named organism at all: enteric ' +
      'methane is produced by rumen archaea, and the cow genome encodes no methanogenesis pathway. A ' +
      'system that silently produced a cassette for all three would be wrong three times over.',
    open_questions: [
      {
        q: 'Where does an organism end and its microbiome begin?',
        why_data_will_not_settle_it:
          'the methane case forces this. If the trait of interest is produced by an associated community, ' +
          'is the "designed organism" the cow, the holobiont, or the archaea? Sequencing everything does ' +
          'not answer it - the boundary is a choice about what counts as the unit being engineered.',
      },
      {
        q: 'What does the person asking for a glowing fly actually want?',
        why_data_will_not_settle_it:
          'fluorescence needs excitation light, so a GFP fly does NOT glow in the dark; bioluminescence ' +
          'needs a luciferase AND a substrate the fly cannot make. Which one was meant is a fact about ' +
          'the asker, not about the fly, and it changes the entire design.',
      },
      {
        q: 'Is "heritable" ever the same as "editable"?',
        why_data_will_not_settle_it:
          'methane yield has non-zero heritability through host effects on the rumen environment. That ' +
          'makes it a selection target. Whether any identified locus is an EDIT target is a different ' +
          'claim, and a heritability estimate - however precise - does not contain it.',
      },
    ],
    how_file_level: {
      path: 'analogues/cases.mjs and dashboard/public/blueprint3d/studio-live/analogues/',
      files: [
        ['cases.mjs', 'CASES[] with verdict, is_the_target_organism_the_right_one, CRISPR_RELEVANCE and real citations'],
        ['storyboard.json', 'the generated animation data, one entry per case, eight stages each'],
        ['index.html', 'the animation: canvas scene, stage rail, and refusals drawn across the whole frame'],
      ],
      what_is_packed_in:
        'Each case carries the request as the lead phrased it, what is ACTUALLY being asked, the target ' +
        'organism and whether it is the right one, the analogy class, what would have to be measured, a ' +
        'verdict from a closed vocabulary, how it could fail, and sources with real DOIs - null and ' +
        'flagged where unverified, because a fabricated DOI is worse than none.',
      the_detail_that_matters:
        'CRISPR_RELEVANCE asks, per case, whether a cassette is even the right tool. For the fly the ' +
        'classic tool is transgenesis rather than knock-in; for the cow it is beside the point entirely. ' +
        'A design system that answers "CRISPR cassette" to every request is a hammer.',
    },
    real_numbers: [
      'the storyboard asserts at least one case refuses before reaching a cassette - a storyboard where everything succeeds is a bug in the storyboard',
      'and asserts not everything refuses, since showing nothing working is the opposite failure',
    ],
    what_went_wrong: [],
  },

  {
    id: 'ecology',
    title: 'Ecology — the quantity that decides survival is not the one the design optimises',
    status: 'shipped',
    dna: ['delphi', 'aletheia'],
    why_fun:
      'The result is genuinely counterintuitive and takes two lines of arithmetic: a design that grows ' +
      '67% faster still loses. You can show that to anyone in thirty seconds and it changes how they ' +
      'think about what "better" means.',
    why_science:
      'A design is not released into an empty world. Tilman\'s R* rule says that with one limiting ' +
      'resource at steady state, the species with the lowest R* = Ks*D/(mu_max - D) competitively ' +
      'EXCLUDES the others - not "does better", excludes. R* turns on affinity at least as much as on ' +
      'rate, and a design optimised for maximum growth rate is not thereby safe. It is often the ' +
      'opposite, because the engineered pathway costs low-substrate performance.',
    open_questions: [
      {
        q: 'Is R* the right frame for a release at all?',
        why_data_will_not_settle_it:
          'R* describes steady state in a well-mixed system. Soil is neither. The honest answer may be ' +
          'that it is the BEST CASE for the design - if it loses here it loses everywhere - but whether ' +
          'that framing is appropriate is a judgement about model applicability, not a measurement.',
      },
      {
        q: 'If low-substrate affinity decides survival and we optimise rate, is the design objective wrong?',
        why_data_will_not_settle_it:
          'that is a question for whoever sets the objective. The model can say which quantity decides ' +
          'the outcome; it cannot say which outcome you should want.',
      },
    ],
    how_file_level: {
      path: 'ecology/',
      files: [
        ['rstar.mjs', 'Monod growth, R*, compete(), assessDesign() and WHAT_R_STAR_IGNORES'],
        ['coexist.mjs', 'two-resource theory: ZNGIs for essential and substitutable resources, consumption vectors, mutual invasibility'],
      ],
      what_is_packed_in:
        'Three numbers per organism settle the single-resource question: mu_max, Ks, and the loss rate D ' +
        'of the environment entered. The module REFUSES to assess any design lacking measured mu_max and ' +
        'Ks, and returns the bar plus the three measurements that would settle it, because a competition ' +
        'outcome computed from invented growth constants looks exactly like one computed from measurements.',
      the_detail_that_matters:
        'The two-resource module corrected the one-resource module. WHAT_R_STAR_IGNORES said two ' +
        'resources make the single-resource conclusion "lapse entirely". It does not - it GENERALISES. A ' +
        'species with the lower R* on both resources excludes the other outright at every supply point. ' +
        'It lapses only where the isoclines cross, which is where there is a real trade-off.',
    },
    real_numbers: [
      'design mu_max 0.5 / Ks 1.0 -> R* 0.25 LOSES to incumbent mu_max 0.3 / Ks 0.1 -> R* 0.05',
      'the design grows 67% faster and would need to be 5x better to win',
      'no designed organism in this repository has a measured mu_max or Ks, so every assessment refuses',
      'reverse ONLY the consumption vectors, leave all four R* identical, and stable coexistence flips to founder-control',
    ],
    what_went_wrong: [],
  },

  {
    id: 'holdout',
    title: 'The holdout — a clade nobody is allowed to mention',
    status: 'standing discipline',
    dna: ['aletheia'],
    why_fun:
      'There is something genuinely strange about working on a comparative-biology project where one ' +
      'entire class of animals is unspeakable. It shapes the code in visible ways: a tree-of-life module ' +
      'has to actively avoid reaching for it, and a survey of registry laws had to redact two identifiers ' +
      'and fill them in at runtime instead.',
    why_science:
      'A held-out evaluation set is only held out if nothing leaks into the work. Not the species names, ' +
      'not the clade, not a claim id whose organisms all belong to it - because any of those tells a ' +
      'later reader what the evaluation is about, and a system tuned against a leaked holdout has ' +
      'measured itself.',
    open_questions: [
      {
        q: 'How much can leak before a holdout stops being one?',
        why_data_will_not_settle_it:
          'there is no measurement of "how much information about the evaluation entered the design". ' +
          'A leak check counts tokens; it cannot count influence. The honest position is that a leaked ' +
          'holdout is compromised and you cannot quantify by how much.',
      },
    ],
    how_file_level: {
      path: 'holdout/ (owned by another thread) and every module that touches taxa',
      files: [
        ['holdout/check-leaks.mjs', 'scans a path for held-out taxa and for claim ids whose organisms are all held out'],
        ['benchmarks/design-hard-negatives/laws.mjs', 'two registry rows take their law_id from the registry AT RUNTIME so the identifiers never appear in source'],
        ['benchmarks/lean-open-problems/problems.mjs', 'one problem WITHDRAWN rather than written, with a comment saying why the count is 14 and not 15'],
      ],
      what_is_packed_in:
        'The gate reports leaks and warnings separately and exits non-zero on a leak. The rule here is ' +
        'that rulings belong to the holdout thread: a leak is fixed by REDACTION, never by adding an ' +
        'allowlist entry, because allowlisting is a judgement about scope that is not mine to make.',
      the_detail_that_matters:
        'check-leaks does not scan .html or .glb files, so those are grepped by hand. A gate with a ' +
        'documented blind spot is only as good as the habit that covers it.',
    },
    real_numbers: [
      'two leaks reached a commit this week; both were redacted rather than allowlisted',
      'one survey keeps all 62 registry rows while naming only 60 of them',
    ],
    what_went_wrong: [
      'A `git add <directory>` swept in a half-written module from a running agent, and separately a leak gate chained with && behind the commit it guarded did not block it. Both are the same root cause: a broad command staging whatever happens to be there.',
    ],
  },

  {
    id: 'scale-ladder',
    title: 'The scale ladder — organelle to organism, and the two rungs with nothing on them',
    status: 'shipped',
    dna: ['delphi', 'aletheia'],
    why_fun:
      'Everyone draws this ladder. Organelle, cell, tissue, organ, organism, five tidy boxes with arrows ' +
      'between them, and the arrows do the work that nobody has done. The fun of building it as a data ' +
      'structure rather than a diagram is that the structure cannot draw an arrow it does not have.',
    why_science:
      'The gap between levels is not a drawing problem, it is the central unsolved problem of the field. ' +
      'A fin ratio is a number about a FISH; a stiffness is a number about a TISSUE; nothing in this ' +
      'project converts one into the other, and the honest way to say so is to show which rungs carry a ' +
      'representation and which are an identifier with nothing behind it.',
    open_questions: [
      {
        q: 'What is the smallest unit of a body plan that is worth representing separately?',
        why_data_will_not_settle_it:
          'this is a modelling decision dressed as an empirical one. More imaging gives finer structures, ' +
          'not a principled boundary between "a tissue" and "a lot of cells arranged a certain way".',
      },
      {
        q: 'Can a constraint discovered at one level ever be transported to another?',
        why_data_will_not_settle_it:
          'a packing limit on cells and an aspect-ratio limit on a body are both real, and whether the ' +
          'first ENTAILS the second is a question about the modelling, not about either measurement.',
      },
    ],
    how_file_level: {
      path: 'sim-engine/scales/micro/',
      files: [
        ['represent.mjs', 'RUNGS (organelle, cell, tissue, organ, organism), CARRIER, THE_GAP, decadesBetween(), span(), coverage()'],
        ['build-ladder.mjs', 'emits the bundle the /scale/ page reads, including the REAL cells from the worked .life example rather than a plausible cloud'],
      ],
      what_is_packed_in:
        'each rung carries its length scale in metres, what in this repo actually represents it, and - ' +
        'where nothing does - the empty string rather than an aspiration.',
      the_detail_that_matters:
        'the cell rung is drawn from 31 real cells in the worked example, and the page says out loud that ' +
        'their geometry provenance is "depicted": a drawing, not a measurement. A rung populated by a ' +
        'sketch and a rung populated by data must not look the same.',
    },
    real_numbers: [
      'three of five rungs have any representation at all; organelle and tissue have none, organ is an identifier only',
      'the cell rung is 31 real cells, 31 of 31 carrying geometry, 0 of 31 measured',
    ],
    what_went_wrong: [
      'The ladder makes the 1-of-48 result legible from the other side: the laws that carry a theorem speak in quantities the traits do not carry, because the traits are about whole animals and the laws are about parts. Building the ladder did not fix that; it explained it.',
    ],
  },

  {
    id: 'analogues',
    title: 'Mining genomes for functional analogues, and ten pairs that argue with each other',
    status: 'shipped',
    dna: ['delphi', 'nous'],
    why_fun:
      'The premise of borrowing is that some lineage solved a problem by a route your host does not have. ' +
      'Antifreeze built twice from different ancestors in opposite oceans; an electric organ assembled ' +
      'twice from the same muscle sodium channel; a fish that survives months without oxygen by brewing ' +
      'ethanol in its own muscle. These are the interesting cases precisely because an orthology table ' +
      'has nothing to say about most of them.',
    why_science:
      'Homology is a claim about ancestry and analogy is a claim about function, and the gap between them ' +
      'is where design pipelines quietly fail. Half of 414 essential yeast genes could NOT be replaced by ' +
      'their human orthologues. So the module does not score orthology: it enumerates seven kinds of ' +
      'evidence that a mapping is functional, keeps them apart, and returns a band of words rather than a ' +
      'number that would be read downstream as a probability.',
    open_questions: [
      {
        q: 'When one gene in A corresponds to two in B, what does "the orthologue" even denote?',
        why_data_will_not_settle_it:
          'nothing. The phrase fails to refer, and picking one of the two is a category error rather than ' +
          'an approximation. More sequencing makes the ambiguity sharper, not smaller.',
      },
      {
        q: 'Is a convergent solution evidence that the problem has few solutions, or that one route is cheap?',
        why_data_will_not_settle_it:
          'both predict repeated convergence. Distinguishing them needs a claim about the space of routes ' +
          'that were available and not taken, which is not a thing that leaves a fossil.',
      },
    ],
    how_file_level: {
      path: 'analogues/ and analogues/combos/',
      files: [
        ['analogy.mjs', 'EVIDENCE_KINDS (rescue, lof-phenotype, sequence-orthology, synteny, expression-domain, domain-architecture, positional-correspondence), BANDS, scoreAnalogy(), and the four refusals'],
        ['combos/space.mjs', '14 hosts x 16 capabilities, every cell a verdict with a reason rather than a score'],
        ['combos/validatability.mjs', 'seven axes asking whether a design could be SHOWN WRONG, and a tier mapping proved total over all 3645 answer sets'],
        ['combos/pairs/*.mjs', 'ten dossiers, each evidence kind marked present or absent with a retrieved source or a stated gap'],
      ],
      what_is_packed_in:
        'per pair: both sides with species and gene, the claim, the developmental context difference, the ' +
        'databases actually searched, and each of the seven evidence kinds marked present (with what) or ' +
        'absent (with why). An honest absent is worth more than a plausible present.',
      the_detail_that_matters:
        'only one pair of ten reaches "strong", and only because a real cross-species rescue was performed ' +
        'in the host. A deliberate negative control was included and the module separated it from its ' +
        'positive: killifish diapause against nematode dauer bands moderate, against fly diapause it bands ' +
        'no-support.',
    },
    real_numbers: [
      'ten pairs: 1 strong, 3 moderate, 2 weak, 2 no-support, 2 unbanded for want of any evidence kind',
      '437 assertions across the pair dossiers, 0 survivors under --fail-once',
      'Ensembl Compara types the carp-into-zebrafish relationship as the literal string ortholog_many2many',
    ],
    what_went_wrong: [
      'The pair meant to be a clean one-to-many example turned out worse than that. The donor’s HOUSEKEEPING copy sits in the same clade as the neofunctionalised one, so orthology cannot separate the two donor FUNCTIONS a borrow would have to tell apart - not merely the two host genes. And the source paper names neither host gene, giving clade labels with no symbol and no accession, so even the shape it reports cannot be cashed into a mapping.',
      'An Ensembl symbol search returned a third gene id that is an alternate-haplotype copy of one of the two. Counting it would have made a two-gene family look like three.',
    ],
  },

  {
    id: 'outreach',
    title: 'Lab-in-the-loop candidates, and the five who would be right to say no',
    status: 'shipped',
    dna: ['nous', 'aletheia'],
    why_fun:
      'The nicest thing about reading twenty-four labs’ work closely is how specific everyone’s question ' +
      'is. Nobody studies "fish". They study why a fin stops growing where it does, or how a notochord ' +
      'holds pressure, and the specificity is the thing worth borrowing.',
    why_science:
      'Lab-in-the-loop only means anything if the loop closes on a measurement someone can actually make. ' +
      'So each profile asks what WE would have to bring, and the answer is often "nothing they need". ' +
      'Writing that down is not modesty; it is the difference between a collaboration proposal and a ' +
      'request for free labour.',
    open_questions: [
      {
        q: 'What is the smallest useful unit of exchange between a computational group and a wet lab?',
        why_data_will_not_settle_it:
          'it is a question about incentives and credit, not about biology. The answer differs per lab and ' +
          'per career stage and no dataset arbitrates it.',
      },
    ],
    how_file_level: {
      path: 'outreach/',
      files: [
        ['fish-biologists.mjs', 'twelve profiles, each with verbatim sourced quotes, flagship papers with DOIs, a collaboration angle and a caution'],
        ['adjacent-fields.mjs', 'twelve more across xenobots, the ortholog-conjecture dispute, biomechanics, theory and origins of life'],
        ['build.mjs', 'merges both and ABORTS if an email address appears anywhere in the serialised bundle'],
      ],
      what_is_packed_in:
        'only the public professional record: published papers, lab pages, public talks. No contact ' +
        'details, no personal inferences, and every quote verbatim with a source or absent.',
      the_detail_that_matters:
        'the privacy gate aborts rather than warns. A privacy check that warns and continues is a privacy ' +
        'check that gets ignored, and it was validated against a planted fixture so that a regex which ' +
        'silently stopped matching could not pass by matching nothing.',
    },
    real_numbers: [
      '24 candidates, 56 verbatim quotes, 24 carrying a caution, 23 with STATED rather than inferred openness',
      'two cited DOIs were rejected: one resolved to an unrelated paper, one to a paper whose author list did not include the person it was meant to support',
      'five of the twelve fish biologists state outright that they are not partners in this sense',
    ],
    what_went_wrong: [
      'Re-reading five web quotes against raw page bytes rather than a summarising fetch caught two more that would otherwise have shipped. A fetch that summarises is not a source.',
      'One quote was refused outright: the best available passage came from a jointly authored essay with per-author sections, and authorship of that passage could not be resolved. A quote attributed to the wrong real person would be the worst thing this project could produce.',
    ],
  },

  {
    id: 'retro-validation',
    title: 'Retro-validation — being wrong nine times out of eleven, on the record',
    status: 'shipped',
    dna: ['aletheia', 'nous'],
    why_fun:
      'There is a particular pleasure in a test you cannot talk your way out of. Four relationships that ' +
      'are already measured, by people who have never heard of this project, sitting in papers from the ' +
      'nineties onward. We write down what we think the answer is, commit it to git, and then look. No ' +
      'wet lab, no approvals, no reagents - just the chance to be publicly wrong by teatime.',
    why_science:
      'Every other benchmark in this repo was written by the same hands that built the thing being ' +
      'measured, which is the weakest possible footing: a system can look good merely by being ' +
      'well-matched to its own test. A retro-validation borrows an answer key nobody wrote for us. It is ' +
      'a weaker test than a prospective experiment in exactly one way - the answers are findable - and ' +
      'that is what the pre-registration commit is for.',
    open_questions: [
      {
        q: 'When a published relationship depends on a modelling convention, whose result is it?',
        why_data_will_not_settle_it:
          'the myoglobin charge/dive relationship comes out positive at one pH and negative at another, ' +
          'from the same sequences. No further measurement of those species decides which convention is ' +
          'the right one, because the convention is a claim about what the mechanism IS.',
      },
      {
        q: 'What does it mean to reproduce a result you cannot reproduce the method of?',
        why_data_will_not_settle_it:
          'the published method models site-specific ionisation constants onto a tertiary structure. We ' +
          'used a uniform model pKa set. The direction agrees at the published pH; whether that counts as ' +
          'a reproduction is a judgement about how much of a method is load-bearing.',
      },
      {
        q: 'Is a number that no two labs measure the same way a quantity at all?',
        why_data_will_not_settle_it:
          'two labs disagree by 1.35x about the TTX sensitivity of the SAME unmutated channel, which is ' +
          'the size of many of the substitution effects being compared. More measurements of that kind ' +
          'add rows without adding comparability.',
      },
    ],
    how_file_level: {
      path: 'benchmarks/retro-validation/',
      files: [
        ['PREREGISTRATION.md', 'eleven predictions with refutation thresholds, committed in its own commit BEFORE the data modules, so git history is the timestamp'],
        ['structure.mjs', 'Shrake-Rupley solvent accessibility, and the sequence quality gate that runs before any arithmetic'],
        ['predict.mjs', 'the pure predictors: Henderson-Hasselbalch net charge, Needleman-Wunsch alignment to a reference, lambda-max from site shifts, Spearman/Pearson with Fisher CIs and a seeded permutation test. No network access anywhere in it.'],
        ['data/myoglobin.mjs', '26 mammalian myoglobins, every accession resolved live and the organism read back, 11 with a sourced maximum dive duration and 15 honestly null'],
        ['data/opsin.mjs', 'measured rod-opsin lambda-max with method and source, plus per-site spectral shifts and the bovine reference for numbering'],
        ['data/ttx.mjs', '44 rows of sodium-channel TTX resistance across 5 numbering conventions, with the discrepancies between sources recorded rather than averaged'],
        ['run-myoglobin.mjs', 'scores Case 1 against the pre-registered thresholds and writes the verdicts'],
        ['RESULTS.md', 'the scoreboard, including the predictions that could not be tested and the one that was mis-specified'],
      ],
      what_is_packed_in:
        'per row: the accession, the organism as READ BACK from the record rather than as requested, the ' +
        'sequence, the measured value with its units, the kind of measurement it is, and a retrieved DOI ' +
        'or PMID for that specific number. A value without an identifier is refused and replaced by a ' +
        'null with a reason.',
      the_detail_that_matters:
        'the sequence gate refuses before the arithmetic runs. A sequence carrying ambiguity codes has a ' +
        'charge INTERVAL, not a charge, and eleven unknown residues bound it 22 units wide - several ' +
        'times the whole biological range being compared.',
    },
    real_numbers: [
      'eleven pre-registered predictions: 2 supported, 7 refuted, 1 untestable at the sample size the record yields, 1 mis-specified',
      'the myoglobin relationship comes out +0.43 at pH 6.5 and -0.63 at pH 7.4, from the same nine species',
      'Pearson(histidine count, charge difference between the two pH values) = 1.000, and Spearman(pH 6.5 charge, pH 7.4 charge) across species = -0.008',
      'opsin lambda-max MAE 4.67 nm against a predicted 8-25 nm, with a rank correlation of 0.911',
      'the largest mutually comparable set of TTX values is 18, against a predicted ceiling of 6',
      'two independent fetches of these myoglobins agree byte for byte on all 21 shared species',
    ],
    what_went_wrong: [
      'I MIS-SPECIFIED A PRE-REGISTERED PREDICTION FROM THE NAME OF THE QUANTITY. The pre-registration argues at length that myoglobin net SURFACE charge must need structure, and that a sequence-only charge is therefore a weaker proxy. The published methods text says the quantity is the sum over ALL ionisable groups at pH 6.5, not an exposed subset. An agent retrieving the methods section caught it; I had reasoned from the word "surface".',
      'THE MOST STRIKING NUMBER IN THE FIRST TABLE WAS AN ARTEFACT OF MY OWN FETCHING RULE. Preferring reviewed UniProt entries gave one diving mammal more than double everyone else’s charge, because that reviewed entry is a protein-level record with eleven unknown residues. The complete, unreviewed, genome-derived entry puts it mid-pack. Reviewed means curated, not complete.',
      'The charge code could not have caught it. It was caught because a structure predictor refused the sequence and the structure-derived sequence came back short - a check written to catch a wrong accession, catching an ambiguous sequence instead.',
      'A test assertion in the accessibility module claimed two coincident atoms come out fully buried. They do not: whether a sample point counts as occluded is decided by floating-point noise, so the area is arbitrary. The claim was mine, not the code’s, and the module now DETECTS duplicates instead.',
      'The holdout scan in that same test guessed three roster paths, fell back to the largest JSON in the folder, extracted zero taxon names and so scanned for nothing - and passed. It survived its own inverted predicate under --fail-once, which is the only reason it was found.',
      'A correlation was briefly run against minus infinity: rows carry a duration OBJECT whose value may be null, the filter tested the object rather than the value, and Math.log10(null) is -Infinity rather than an error. The statistics module refused it by name, which is why it is a corrected line and not a silent wrong number.',
    ],
  },

  {
    id: 'atlas',
    title: 'The atlas — cells that split, and the geometry that says they cannot',
    status: 'shipped',
    dna: ['delphi', 'nous', 'aletheia'],
    why_fun:
      'Zooming from an embryo to a ribosome is the oldest trick in science communication and it still ' +
      'works, because the numbers are genuinely absurd: a metre of DNA in a nucleus you could fit sixty ' +
      'of across a full stop, machines that read it at twenty letters a second, and a cell so crowded ' +
      'that the average gap between two proteins is about one protein wide. The pleasure of building it ' +
      'is that every one of those numbers is checkable, and several of the famous ones turn out to be off.',
    why_science:
      'A zoomable viewer is a claim factory. Every level asserts a size, a count, a spacing and a speed, ' +
      'and almost all of them get asserted by eye because nobody will check. So the rule here is that ' +
      'the POSITIONS may be invented - there is no physics in this - but no size, count, rate or spacing ' +
      'may be, and every one carries a provenance chip saying which it is. What the drawing gets right ' +
      'is then separable from what it merely draws plausibly, which is the only thing that makes a ' +
      'teaching tool also an honest one.',
    open_questions: [
      {
        q: 'What should a viewer draw where the field does not agree?',
        why_data_will_not_settle_it:
          'the 30 nm chromatin fibre is in every textbook and its existence in living nuclei is disputed. ' +
          'Drawing a tidy solenoid teaches something that may not exist; drawing a disordered chain takes ' +
          'a side. The viewer marks it CONTESTED, which is a third option and not obviously the right one.',
      },
      {
        q: 'When a famous number disagrees with the coordinates it came from, which is the measurement?',
        why_data_will_not_settle_it:
          'the nucleosome is quoted at 1.65 superhelical turns; the deposited coordinates sweep 1.81. Both ' +
          'are probably right about different arcs of the same DNA, and no further experiment decides it, ' +
          'because the disagreement is about what the quantity MEANS.',
      },
      {
        q: 'Can a format that stores a centre and a radius ever depict development?',
        why_data_will_not_settle_it:
          'cleavage without growth cannot be drawn with non-overlapping spheres at constant envelope, for ' +
          'geometric reasons that hold regardless of data. The embryo solves it by changing cell shape. A ' +
          'representation choice, not a measurement, decides whether the picture can be right.',
      },
    ],
    how_file_level: {
      path: 'sim-engine/scales/micro/, sim-engine/scales/molecular/, sim-engine/scales/atlas/',
      files: [
        ['micro/division.mjs', 'cleavage as a constraint: lensVolume, unionVolume, radiusForUnion by bisection, pairDaughters, divisionFrame, packingCheck, THE_PACKING_IMPOSSIBILITY'],
        ['molecular/machines.mjs', 'ten machines with dimensions MEASURED FROM DEPOSITED COORDINATES, structures verified live against the PDB, copy numbers and catalytic rates with the organism named'],
        ['molecular/chromatin.mjs', 'seven packing levels from the double helix up, each with a firmness grade; the mouse assembly resolved live; contourLength() and the 30 nm dispute'],
        ['molecular/dynamics.mjs', 'replication, transcription and translation rates with methods; THE_ORIGIN_ARGUMENT; and the real-time factor each animation needs to be visible'],
        ['molecular/budget.mjs', 'the volume and crowding audit, and the depictions those numbers forbid'],
        ['molecular/provenance.mjs', 'the closed provenance vocabulary and a cite() that throws on an incomplete record'],
        ['atlas/build.mjs', 'assembles the bundle; absent modules are NAMED in the viewer rather than hidden'],
      ],
      what_is_packed_in:
        'per level: the geometry to draw, the measured quantities that fix its scale, and a provenance ' +
        'kind per claim - MEASURED, DEPICTED, DERIVED, DATABASE_RECORD, CONTESTED or NOT_ESTABLISHED. ' +
        'The embryo level carries real tracked positions; everything inward carries invented positions ' +
        'at measured dimensions, and the header says so before anything is drawn.',
      the_detail_that_matters:
        'the cleavage animation solves for the radius rather than interpolating it, so union volume is ' +
        'constant to one part in 10^9 at every frame. The furrow is not drawn: it is what two overlapping ' +
        'spheres look like.',
    },
    real_numbers: [
      'the nucleosome sweeps 1.81 superhelical turns in the deposited coordinates, not the textbook 1.65 - 1.805 and 1.810 across two structures, reproduced independently',
      'rise per base pair is 3.341 A, not 3.4 - 1.8% low, which is 16 mm over a mouse genome',
      'the mouse genome GRCm39 is 2,728,206,152 bp, which is 0.91 m of B-DNA haploid and 1.82 m diploid',
      'a mid-sized protein is 4-6 nm across and its nearest neighbour is 8.69 nm away: the gap is about one protein wide',
      'the eukaryotic ribosome measures 31 nm at its longest, the nuclear pore complex 160 nm',
      'the stored two-cell embryo has centres 16.5 um apart with radii of 31.75 um, so its union is 31% smaller than the zygote',
      '6 of 6 levels built; 550 assertions across the molecular modules and 57 on division, 0 survivors',
    ],
    what_went_wrong: [
      'THE VIEWER DREW A DEPICTION ITS OWN EVIDENCE MODULE FORBIDS. The cell level began as 1,500 sparse dots with clear space between them. budget.mjs states it plainly: there is no scale at which clear fluid is the right thing to draw between macromolecules. The sample is now dense, and labelled as generated.',
      'The machines were all drawn the same size for a while, because the size extractor looked for a "diameter" key and the module stores max_extent_nm - it MEASURES the extents from deposited coordinates rather than quoting them. Reading the wrong key silently defeated the one thing that level exists for.',
      'Four rendering defects that only looking could find: a sidebar whose title and subtitle ran together as inline spans; a camera framed on a constant that clipped the animation at its widest moment; fog with a fixed range that faded the entire scene to the background once the camera moved out; and a near plane of 0.01 against a far plane of 4000, which spent the depth buffer on the first few units and left the intersecting daughter cells z-fighting into speckle.',
      'A test assertion of mine claimed the union-conserving animation would land on the stored two-cell radius. It does not, and cannot: the stored cells interpenetrate, so their union is smaller than the zygote. The assertion was rewritten to assert the discrepancy instead, which is the fact.',
      'The 8-cell to 16-cell division cannot be animated as a lineage at all - nearest-centre pairing is not two-to-one there. The first version would have animated it anyway. It now cross-fades, and the plan exports a per-step flag so no caller can animate it by accident.',
    ],
  },
  {
    id: 'counting',
    title: 'Counting the machines in a cell, and the three tables that would not agree',
    status: 'shipped',
    dna: ['delphi', 'aletheia', 'nous'],
    why_fun:
      'There is a particular pleasure in asking a database a question it looks perfectly equipped to ' +
      'answer and watching it decline. Arc released a hundred million measured single-cell ' +
      'transcriptomes; ask any one of those cells how many ribosomes it has and the answer is zero, for ' +
      'every cell and every machine, because a complex needs all its subunits detected and the median ' +
      'cell detects a thousand genes of sixty-two thousand. The number that finally worked came from ' +
      'immunoblots run in 1999.',
    why_science:
      'A picture of a cell interior asserts a count whether or not anyone measured one, and the counts ' +
      'are where these pictures are usually wrong - too few ribosomes, too much empty space, machines ' +
      'all drawn at the same size. Fixing it needs an absolute scale, and an abundance table does not ' +
      'carry one: it gives relative abundance and leaves the conversion to copies per cell as a single ' +
      'free parameter. That parameter can be fitted, and once fitted it PREDICTS quantities it was not ' +
      'fitted to, which is the only thing that makes it a measurement rather than a choice.',
    open_questions: [
      {
        q: 'When two careful measurements disagree about a ratio by tenfold, what does a drawing do?',
        why_data_will_not_settle_it:
          'quantitative immunoblotting puts RNA polymerase II at 10 to 30 times the general transcription ' +
          'factors; the mass-spectrometry abundance table puts them near 1. Both were done carefully, ' +
          'twenty-six years apart, on the same cell line. One scale factor cannot satisfy both, so a ' +
          'viewer must either pick one and say so, or refuse to draw the relative sizes of the two pools.',
      },
      {
        q: 'Is a quantity that cannot be measured per cell a property of the cell at all?',
        why_data_will_not_settle_it:
          'the number of assembled ribosomes in one particular cell is a real number about a real object, ' +
          'and no single-cell method measures it. Pseudobulk recovers a population average that no ' +
          'individual cell need have. Deeper sequencing moves the threshold without crossing it; the ' +
          'quantity and the instrument are mismatched in kind.',
      },
      {
        q: 'What is the honest default when an accuracy test can be passed by having no dynamic range?',
        why_data_will_not_settle_it:
          'a test that checks whether the subunits of an equimolar complex come out level is passed ' +
          'perfectly by a table that reports everything as the same number. Every spread-based quality ' +
          'measure has this shape. Which companion test is required, and in what order, is a judgement ' +
          'about what a measurement is for.',
      },
    ],
    how_file_level: {
      path: 'sim-engine/scales/atlas/',
      files: [
        ['counts.mjs', 'the inventory and the drawing contract: copiesPerCell, drawingSpec, instancesFor with a downsampling label that names the ratio, transcriptShare, and six refusals that each carry a number'],
        ['counts.json', 'the derived artefact - table tests, anchor selection, held-out checks, twelve machines in copies per cell. The raw tables are not committed; this is'],
        ['embryo-divisions.mjs', 'the re-export: parseFrame over 420 GMEM frames, sdRadius via det(nu*W)^(-1/6), divisionsBetween, divisionGeometry, buildTracks with no length filter, and measureFloor'],
        ['holdout-html-scan.mjs', 'the leak scan for the .html and .json files the project gate does not read, with a named roster path and a refusal on an empty one'],
        ['build.mjs', 'assembles the bundle and computes the slab: the cube of cytoplasm that holds a sample at its measured density'],
      ],
      what_is_packed_in:
        'three independent HeLa proteomes, scored on dynamic range, on a known large ratio and on the ' +
        'spread across subunits of complexes that are equimolar by construction; one free parameter ' +
        'fitted to a single immunoblot count; and two held-out measurements that decide which anchor to ' +
        'use. Plus two shards of Arc\'s Tahoe-100M, used for the perturbation axis and for nothing else.',
      the_detail_that_matters:
        'the anchor is chosen by what it predicts, not by which measurement looks better. Fitting all ' +
        'seven available counts misses both held-out checks tenfold; fitting the polymerase alone lands ' +
        'inside both. The transcription-factor disagreement is then recorded per factor rather than averaged.',
    },
    real_numbers: [
      'P(all twelve Pol II subunits detected in one cell) = 3.6e-15, so 0.000 countable cells expected in 56,449 - but cohesin is expected in 138, so the refusal is per machine',
      'the fitted total is 2.51e9 protein molecules per HeLa cell, inside a range of 2.0e9 to 8.2e9 compiled from eight independent studies',
      'it predicts 4.93 million ribosomes, inside the 3.3 to 9.5 million measured twice in the primary literature, and 998,982 proteasomes against a literature figure near 800,000',
      'the rejected abundance table spans 27-fold in total; the one used spans 1.75e8-fold, and the rejected one scored BETTER on the elegant test',
      'replication-dependent histones come in at 375 UMI per gene against 11,233 for the polyadenylated variants, 29.9x, a prediction made before looking',
      'the measured embryo gives 1,360 drawable division events where the earlier export gave 4, and the division count matches another thread\'s parse bin for bin at 1,634',
      '60,001 machines drawn in a 2.70 um cube standing for 7,377,460 in one cell, occupying at most 2.63% against 8.6-19.1% for all mammalian protein',
      '169 assertions across the two new modules, 891 across the suite, 0 survivors under --fail-once',
    ],
    what_went_wrong: [
      'THE ELEGANT TEST PICKED THE WRONG TABLE. A spread test over complexes that are equimolar by construction needs no anchor, no literature count and no scale factor - only the stoichiometry - and it scored a near-perfect 1.3-fold on a table whose entire dynamic range is 27-fold, because everything in it comes out level. A spread test rewards flatness. It is only meaningful after a range test, and the order had to be learned by being caught.',
      'A pseudogene filter written as .*P\\d*$ deleted twenty-one real nucleoporins, because in NUP107 the P is followed by digits. A filter that removes two thirds of the nuclear pore to remove five pseudogenes is worse than no filter.',
      'The scarcest-subunit estimator was set by a gene that does not belong to the complex three times running: ribosomal pseudogenes, then RPL10L, then NUP210L. That is why every count is now a median over subunits, and why the estimator reports the gene that set it - a value alone would have hidden all three.',
      'A suspect-frame rule written as "more than 15% of the population" flagged nothing, while the four frames another thread had already identified as a tracker artefact sit at exactly 15.0%. A threshold chosen for how it reads is not a threshold; the replacement is relative to the median frame.',
      'The holdout scanner took the roster as the first array it found, matched a five-sentence `rule` field, and printed a confident pass over ZERO held-out rows. Then the fixed version carried a hand-written list of the words it was hunting for, which made it the only file in the repo breaking the rule it enforces - and the project gate said so.',
      'The first volume result read as a clean refutation: daughters add up to twice the parent, over 1,360 events. It is the tracker\'s regularisation floor. Where no axis is free the ratio is 1.999998, and it walks away from 2 as axes come free. The verdict is UNTESTABLE, and the only reason it is not sitting in the repo as a refutation is that a quartile happened to equal a minimum.',
    ],
  },
]);

export const HOW_TO_READ_THIS = Object.freeze({
  the_four_questions: ['why it is fun', 'why it is science', 'what stays open regardless of data', 'what is actually on disk'],
  the_open_questions_rule:
    'an entry under open_questions must be one where MORE MEASUREMENT IS NOT THE KIND OF THING THAT ' +
    'WOULD HELP. "We have not measured it yet" is not an open question in this sense, it is a task. The ' +
    'ones listed are definitional boundaries, modelling choices and category questions - and they are ' +
    'the part of the work most likely to still be interesting in ten years.',
  what_went_wrong_is_not_optional:
    'every entry carries its mistakes. A dev log that records only what worked is a changelog with ' +
    'better typography, and the failures here were more instructive than the successes - a wrong ' +
    'prediction about decoy AUC taught more than a right one would have.',
});
