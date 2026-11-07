// OUTSTANDING PROBLEMS IN BIOLOGY, graded for whether Lean can do anything about them.
//
// ============================== WHAT THIS FILE IS, AND THE TRAP IT IS AVOIDING ==============================
// The request behind it: "at the lean level I think we can incorporate even more outstanding biological
// issues and then see if we can try to tackle them using this lean for biology system." The obvious way to
// answer is a list of famous open problems with an encouraging note on each. That list would be worthless,
// because the encouraging note is almost always wrong: the open part of an open problem in biology is
// usually a question about ORGANISMS, and a proof assistant cannot reach organisms. It reaches as far as
// the premises you type in.
//
// So every problem here is graded twice, and the second grade is the one that matters:
//
//   formalisable                 can it be WRITTEN in Lean, and can the written thing be PROVED?
//   settles_the_open_question    if we proved it, would the open question be closed?
//
// Those two come apart almost everywhere, and the gap between them is the finding. Eight of the fifteen
// problems below are provable or conditionally provable. ONE of the fifteen would close anything. A
// scoping document that reports only the first number is advertising.
//
// ============================== HOW THE GRADES ARE ASSIGNED ==============================
//   'provable'                 the open part is itself a mathematical statement. Rare. Usually means the
//                              dispute is about whether a published derivation is valid, not about animals.
//   'conditionally-provable'   a SHARP conditional exists: register the empirical premises as hypotheses
//                              and a real theorem follows, whose premises could be checked against data
//                              and whose conclusion could be confronted with data. The biology stays open.
//   'statable-only'            writable as a Lean proposition, not provable from anything available. It
//                              would enter the registry as a conjecture or a named hypothesis, like
//                              `HaldaneCost` already does.
//   'not-formalisable'         the open part is empirical, and the theorem you would get is a theorem
//                              about a model that answers nothing. Five of these are included ON PURPOSE.
//                              A scoping list with no rejects has not been scoped.
//
// The line between 'conditionally-provable' and 'not-formalisable' is the one that does the work, and it is
// the one that collapses if you are lazy: EVERY empirical question can be dressed as "provable given
// premises", because you can always assume the conclusion. The test applied here is bite: could the
// hypotheses be independently measured, and could the conclusion then be wrong? Where the only available
// hypothesis is a restatement of the thing in question, the grade is 'not-formalisable'.
//
// ============================== CITATIONS ==============================
// Every DOI below was resolved against the Crossref API on 2026-11-06 and the returned title, container and
// year checked against the citation. This caught two of my own errors, which is the reason for doing it:
//   * Cooke & Zeeman 1976 - I had `10.1016/0022-5193(76)80131-2`, which 404s. The real DOI carries an `S`:
//     `10.1016/S0022-5193(76)80131-2`.
//   * `10.1111/j.0269-8463.2004.00846.x` - I believed this was Kozlowski & Konarzewski's critique of WBE.
//     It is a paper on inferring plant palatability from a single-date feeding trial. The critique was
//     dropped rather than cited from memory.
// A fabricated DOI is worse than no DOI, so `doi: null` is used where no DOI exists and `verified` says so.

export const WHAT_THIS_IS =
  'A graded list of outstanding problems in biology, scoped for formalisation in the Delphi Lean registry, ' +
  'with the honest finding stated up front: being formalisable and being settled by formalisation are ' +
  'different properties, and they coincide once in fifteen.';

/** The four grades, so the vocabulary is checkable rather than folklore. */
export const FORMALISABLE_VOCAB = Object.freeze([
  'provable',
  'conditionally-provable',
  'statable-only',
  'not-formalisable',
]);

/** Whether a proof would close the open question. */
export const SETTLES_VOCAB = Object.freeze(['yes', 'the-maths-only', 'no']);

export const PROBLEMS = Object.freeze([
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'metabolic-scaling-exponent',
    title: 'Does the West-Brown-Enquist network derivation actually entail the 3/4 power?',
    field: 'physiological allometry',
    statement_en:
      'Metabolic rate B scales with body mass M as B = a M^b. Kleiber measured b near 3/4; surface-area ' +
      'reasoning predicts 2/3. West, Brown & Enquist (1997) derive b = 3/4 from a space-filling, ' +
      'area-preserving, size-invariant-terminal-unit branching network. The formalisable question is not ' +
      'what b is in animals: it is whether the stated WBE premises, written out in full, entail b = 3/4, ' +
      'or whether the derivation needs a further assumption its authors did not state.',
    why_it_is_open:
      'Two things are open and they are usually conflated. (a) EMPIRICALLY, b is not one number: it varies ' +
      'with taxon, activity state and the mass range fitted, and 2/3 is not excluded for many datasets. ' +
      '(b) MATHEMATICALLY, Dodds, Rothman & Weitz re-derived the network model and reported that 3/4 does ' +
      'not follow from the premises as given - that area-preserving branching plus space-filling yields ' +
      '2/3 unless an additional condition is imposed. Savage et al. defend quarter-powers. This second ' +
      'dispute is about algebra, which is why it is the only item on this list graded `provable`: a ' +
      'disagreement over whether a published derivation is valid is settled by checking the derivation.',
    source: {
      citation: 'West, G. B., Brown, J. H. & Enquist, B. J. (1997) A general model for the origin of allometric scaling laws in biology. Science 276:122-126.',
      doi: '10.1126/science.276.5309.122',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [
      { citation: 'Dodds, P. S., Rothman, D. H. & Weitz, J. S. (2001) Re-examination of the "3/4-law" of metabolism. J Theor Biol 209:9-27.', doi: '10.1006/jtbi.2000.2238', verified: 'Crossref 2026-11-06' },
      { citation: 'Kleiber, M. (1932) Body size and metabolism. Hilgardia 6:315-353.', doi: '10.3733/hilg.v06n11p315', verified: 'Crossref 2026-11-06' },
      { citation: 'Savage, V. M. et al. (2004) The predominance of quarter-power scaling in biology. Funct Ecol 18:257-282.', doi: '10.1111/j.0269-8463.2004.00856.x', verified: 'Crossref 2026-11-06' },
    ],
    formalisable: 'provable',
    settles_the_open_question: 'the-maths-only',
    what_lean_would_add:
      'Genuinely something, and it is the narrow thing Lean is for: an adjudication of a live algebraic ' +
      'dispute between two published papers. If the WBE premises are stated as a structure and 3/4 does ' +
      'not follow, the missing premise becomes a named field, visible, and the paper that needs it is ' +
      'identified. What Lean would NOT add: any information about the exponent in any animal. Proving ' +
      'WBE sound would not make 3/4 true of mice, and refuting it would not make 2/3 true of mice.',
    the_hypotheses_it_would_need:
      'Space-filling branching; area-preserving branch junctions (sum of daughter cross-sections equals ' +
      'parent); size-invariant terminal units (capillary radius, length and flow independent of M); ' +
      'minimisation of hydrodynamic dissipation; a pulsatile-flow impedance model in the large vessels; ' +
      'and the step usually left implicit - that the number of branching generations scales as log M with ' +
      'a particular base. That last one is where the dispute lives, and it is exactly the kind of premise ' +
      'that a Lean structure forces into the open.',
    how_it_could_be_false:
      'The mathematical claim is false if an explicit network satisfying every stated premise has b != 3/4; ' +
      'one such construction refutes it outright. The empirical claim is false if a phylogenetically ' +
      'controlled fit over a wide mass range returns a confidence interval excluding 3/4 - which has ' +
      'already happened for several taxa, and is why the empirical half is not on the formalisable list.',
    registry_overlap: {
      relation: 'partial',
      law_ids: ['scaling-area-law', 'flight-allometry-law', 'E2'],
      note: 'The registry has power-law machinery (ratio, log-log exponent, quotient of power laws) and a measured MASS exponent band [2.90, 3.02] for length-to-mass. It has no METABOLIC exponent and nothing about branching networks, so this is not a duplicate - but flight-allometry-law supplies the algebra it would be built on.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'lewontins-paradox',
    title: "Lewontin's paradox: why is genetic diversity so nearly independent of population size?",
    field: 'population genetics',
    statement_en:
      'Neutral theory predicts equilibrium heterozygosity H = 4 Ne mu / (1 + 4 Ne mu), so H should rise ' +
      'monotonically and steeply with effective population size. Across animals, census size spans roughly ' +
      'twelve orders of magnitude while nucleotide diversity spans about two or three. Either Ne is almost ' +
      'uncoupled from N, or the neutral prediction is wrong, or both.',
    why_it_is_open:
      'The textbook answer - selective sweeps and background selection depress diversity more in large ' +
      'populations - has been quantified and found insufficient. Buffalo (2021) fitted linked-selection ' +
      'models across species and reported they cannot account for the flatness; the paradox survives its ' +
      'standard resolution. What is open is which of the remaining candidates (demographic history and ' +
      'bottlenecks, extreme reproductive skew, metapopulation structure, or a systematic failure of the ' +
      'coalescent at these scales) does the work, and in what proportion.',
    source: {
      citation: 'Buffalo, V. (2021) Quantifying the relationship between genetic diversity and population size suggests natural selection cannot explain Lewontin\'s paradox. eLife 10:e67509.',
      doi: '10.7554/eLife.67509',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [
      { citation: 'Lewontin, R. C. (1974) The Genetic Basis of Evolutionary Change. Columbia University Press. (Where the paradox is posed; a book, pre-DOI.)', doi: null, verified: 'standard reference, not machine-verified; no DOI exists for the 1974 monograph' },
    ],
    formalisable: 'conditionally-provable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'A sharp contrapositive, which is more than it sounds. The registry already carries the neutral ' +
      'equilibrium as a named hypothesis (kimura-heterozygosity). Add measured bounds on H and the theorem ' +
      'runs backwards: H <= h_max forces 4 Ne mu <= h_max/(1 - h_max), hence an UPPER BOUND ON Ne that is ' +
      'independent of census size. Stated that way the paradox stops being a puzzle about diversity and ' +
      'becomes a derived numerical claim about Ne/N, which is checkable. Lean contributes the monotonicity ' +
      'and the inversion, both easy; it contributes nothing to the question of why Ne/N is small.',
    the_hypotheses_it_would_need:
      'The infinite-alleles equilibrium H(1 + 4 Ne mu) = 4 Ne mu (already a hypothesis in the registry, ' +
      'never proved there); a per-generation neutral mutation rate mu, which is measured in few species and ' +
      'assumed in most; that the sampled sites are neutral and unlinked to selected sites - the premise ' +
      'Buffalo\'s work puts in doubt; that the population is at equilibrium, which for any species with a ' +
      'Pleistocene history it is not; and a census-size estimate N, which for marine invertebrates is a ' +
      'guess within an order of magnitude.',
    how_it_could_be_false:
      'The derived bound is refuted by a species with a directly measured Ne (from pedigree or temporal ' +
      'allele-frequency data) that exceeds the bound its own diversity implies. The paradox itself would ' +
      'dissolve if direct Ne estimates across taxa turned out to span only the two or three orders of ' +
      'magnitude that diversity does - that is, if Ne and N are simply unrelated and nothing needs ' +
      'explaining beyond that.',
    registry_overlap: {
      relation: 'partial',
      law_ids: ['kimura-heterozygosity', 'kimura-fixation-probability'],
      note: 'kimura-heterozygosity (status: candidate) already carries the equilibrium relation and proves 0 < H < 1 plus a comparison between populations. The inversion to a bound on Ne is NOT there. This problem is an extension of an existing law, not a new one, and should be filed as such.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'molecular-clock-generation-time',
    title: 'The molecular clock runs closer to absolute time than the neutral theory permits',
    field: 'molecular evolution',
    statement_en:
      'For strictly neutral mutations the long-run substitution rate equals the mutation rate PER ' +
      'GENERATION and is independent of population size. Species differ in generation time by three or ' +
      'four orders of magnitude. The neutral prediction is therefore a per-generation clock, and observed ' +
      'clocks for many loci are closer to per-year. At least one premise must be false.',
    why_it_is_open:
      'This is not a gap in the mathematics - the registry proves the per-generation result - but a ' +
      'standing conflict between a proved theorem and the data, and the open question is WHICH premise ' +
      'fails. Candidates: mu per generation is not constant across species but scales inversely with ' +
      'generation time (replication-independent damage, so mutation is partly a function of absolute time); ' +
      'the sites used are not neutral but nearly neutral, making the rate depend on Ne and so on body size ' +
      'and generation time together; or lineage-specific rate variation large enough that "the clock" is an ' +
      'artefact of averaging. Bromham reviews the covariates and the question is not closed.',
    source: {
      citation: 'Kimura, M. (1968) Evolutionary rate at the molecular level. Nature 217:624-626.',
      doi: '10.1038/217624a0',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [
      { citation: 'Bromham, L. (2009) Why do species vary in their rate of molecular evolution? Biol Lett 5:401-404.', doi: '10.1098/rsbl.2009.0136', verified: 'Crossref 2026-11-06' },
    ],
    formalisable: 'conditionally-provable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'The most useful thing on this list short of the Fisher item, and it is a negative: formalise the ' +
      'triple - (i) the neutral per-generation rate, already proved in the registry, (ii) rate constancy ' +
      'per unit absolute time, (iii) generation times differing by a factor of a thousand - and derive ' +
      'False. An INCONSISTENCY PROOF is a real deliverable. It does not tell you which premise to drop, but ' +
      'it makes the registry state that it cannot hold all three, which a registry of separately-accepted ' +
      'laws will otherwise quietly do. This is the one genre where a proof assistant earns its place in ' +
      'biology: not proving facts, but refusing to hold a set of facts that cannot all be true.',
    the_hypotheses_it_would_need:
      'Strict neutrality of the sites (the premise most likely to be the culprit); a constant ' +
      'per-generation mutation rate mu across the lineages compared; non-overlapping generations with a ' +
      'well-defined generation time; and quantitative bounds - that the per-year rate ratio between two ' +
      'lineages is within a factor of f while their generation-time ratio is at least g, with g >> f. The ' +
      'last pair is where the empirical content sits, and both numbers are contestable.',
    how_it_could_be_false:
      'The inconsistency evaporates if mu per generation is measured to scale inversely with generation ' +
      'time - mice and whales accumulating germline mutations at similar per-year rates - in which case ' +
      'premises (i) and (ii) are compatible and there was never a conflict. Direct pedigree-based germline ' +
      'mutation-rate estimates across mammals are the measurement that decides it, and they are now being ' +
      'made.',
    registry_overlap: {
      relation: 'direct-dependency',
      law_ids: ['kimura-substitution-rate', 'genotype-substitution-time'],
      note: 'kimura-substitution-rate is ACCEPTED in the registry and is premise (i) of the inconsistency. That is the point: the conflict is between an accepted law and the data, not between two candidates. Nothing here duplicates the law; it would be a new theorem consuming it.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'exclusion-bound-and-plankton',
    title: 'The competitive exclusion bound versus the paradox of the plankton',
    field: 'ecology / resource competition',
    statement_en:
      'Levin\'s extension of the competitive exclusion principle: at a stable equilibrium the number of ' +
      'coexisting species cannot exceed the number of limiting factors. Hutchinson observed dozens of ' +
      'phytoplankton species coexisting in a water column offering a handful of limiting resources. The ' +
      'formalisable statement is the bound; the open question is which of its premises a lake violates.',
    why_it_is_open:
      'The bound is a theorem, so the paradox is not a mathematical puzzle - it is the question of which ' +
      'premise fails, and the field has not converged. Equilibrium may simply not hold (environmental ' +
      'fluctuation, chaotic internal dynamics with no stable point); "limiting factors" may be ' +
      'undercounted once predators, parasites, spatial microstructure and temporal niches are included; or ' +
      'coexistence may be maintained by fluctuation-dependent mechanisms (storage effect, relative ' +
      'nonlinearity) that are invisible to an equilibrium count. Chesson\'s framework organises the ' +
      'candidates without settling their relative importance in any real community.',
    source: {
      citation: 'Hutchinson, G. E. (1961) The paradox of the plankton. Am Nat 95:137-145.',
      doi: '10.1086/282171',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [
      { citation: 'Levin, S. A. (1970) Community equilibria and stability, and an extension of the competitive exclusion principle. Am Nat 104:413-423.', doi: '10.1086/282676', verified: 'Crossref 2026-11-06' },
      { citation: 'MacArthur, R. & Levins, R. (1967) The limiting similarity, convergence, and divergence of coexisting species. Am Nat 101:377-385.', doi: '10.1086/282505', verified: 'Crossref 2026-11-06' },
      { citation: 'Chesson, P. (2000) Mechanisms of maintenance of species diversity. Annu Rev Ecol Syst 31:343-366.', doi: '10.1146/annurev.ecolsys.31.1.343', verified: 'Crossref 2026-11-06' },
    ],
    formalisable: 'conditionally-provable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'The premise audit, which is the whole value. The exclusion bound is a linear-algebra argument: at ' +
      'equilibrium each species\' per-capita growth is zero, giving n linear constraints on k factor ' +
      'levels, and n > k forces a dependency, so the equilibrium is not isolated and cannot be ' +
      'asymptotically stable. Writing that in Lean forces "limiting factor" to be DEFINED - as a ' +
      'coordinate the growth functions depend on - and once it is defined, the escape routes become ' +
      'explicit cases rather than rhetoric. The repo has no ecology at all, so this also adds a field. It ' +
      'adds nothing whatever to the question of what keeps diatoms coexisting.',
    the_hypotheses_it_would_need:
      'That the community is at an equilibrium and that the equilibrium is asymptotically stable (both ' +
      'doubtful for plankton); that per-capita growth rates are functions of exactly k factor levels; that ' +
      'those functions are differentiable at the equilibrium; linear independence of the resulting ' +
      'constraint rows; and a closed species list. Every escape from the paradox is the denial of one of ' +
      'these, which is precisely why they should be fields of a structure rather than prose.',
    how_it_could_be_false:
      'The theorem is refuted by an explicit stable equilibrium with n > k under the stated premises, which ' +
      'would mean the linear-algebra step is wrong. The biological reading is refuted by a community ' +
      'demonstrated to be at a stable equilibrium with more species than measurable limiting factors - a ' +
      'measurement nobody has managed, because establishing stability in the field is harder than counting ' +
      'species.',
    registry_overlap: {
      relation: 'none',
      law_ids: [],
      note: 'There is no ecology or resource-competition law in the registry: the 62 laws cover scaling, flight, physiology, genotype, development, pattern formation and population genetics. This is a genuinely empty slot.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'senescence-selection-force',
    title: 'Why does senescence persist, and why do senescence rates vary so much?',
    field: 'evolutionary demography',
    statement_en:
      'Hamilton (1966) showed that in an age-structured population the sensitivity of the intrinsic rate of ' +
      'increase to a change in age-specific mortality declines with the age at which the change acts, so ' +
      'selection against late-acting deleterious effects is weak. The theorem is clean. The open question ' +
      'is why observed senescence rates vary by orders of magnitude between taxa of similar life history, ' +
      'and why some organisms show no detectable increase in mortality with age at all.',
    why_it_is_open:
      'Hamilton explains why senescence is TOLERATED, not why it takes the rates and shapes it does. The ' +
      'two mechanistic accounts - mutation accumulation and antagonistic pleiotropy (Williams) - predict ' +
      'different genetic signatures and the evidence supports both partially and neither decisively. ' +
      'Worse for the theory, organisms with negligible senescence (some turtles, bivalves, naked mole ' +
      'rats, hydra) are not predicted by it and are not obviously excluded by it, because Hamilton\'s ' +
      'result bounds the FORCE of selection, not the outcome. Whether negligible senescence refutes the ' +
      'framework or merely sits in a corner of its parameter space is unsettled.',
    source: {
      citation: 'Hamilton, W. D. (1966) The moulding of senescence by natural selection. J Theor Biol 12:12-45.',
      doi: '10.1016/0022-5193(66)90184-6',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [
      { citation: 'Williams, G. C. (1957) Pleiotropy, natural selection, and the evolution of senescence. Evolution 11:398-411.', doi: '10.2307/2406060', verified: 'Crossref 2026-11-06' },
    ],
    formalisable: 'conditionally-provable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'A clean classical theorem the registry does not have, in exactly the repo\'s existing idiom: a named ' +
      'hypothesis (Euler-Lotka) plus a monotonicity conclusion, with an easy non-vacuity witness. The ' +
      'honest accounting: Hamilton\'s result has not been in doubt for sixty years, so Lean is re-checking ' +
      'arithmetic, and the value is structural rather than epistemic - it gives the registry a ' +
      'demographic primitive (age-structured fitness) that several other laws could then be stated ' +
      'against. On the open question - rate variation and negligible senescence - it adds nothing, and ' +
      'anyone claiming otherwise is confusing a bound on selection with a prediction of lifespan.',
    the_hypotheses_it_would_need:
      'The Euler-Lotka relation sum over x of exp(-r x) l(x) m(x) = 1 with survivorship l and fecundity m, ' +
      'as a named hypothesis rather than a derived fact; a stable age distribution, which is the premise ' +
      'most often false in the wild; density independence; a discrete finite age range with l(x) > 0 up to ' +
      'the last reproductive age; and no transgenerational effects, which rules out the grandmother ' +
      'hypothesis and any post-reproductive contribution to fitness by construction - a restriction worth ' +
      'stating loudly, since it is where the human case lives.',
    how_it_could_be_false:
      'The theorem fails if the sensitivity is not monotone in age under the stated premises - which it is ' +
      'not, in general, once fecundity is allowed to rise with age, so the honest Lean statement needs a ' +
      'monotone-fecundity or post-peak restriction and the naive version is refutable by a counterexample. ' +
      'That is a useful outcome: it would show the folk statement of Hamilton\'s result is stronger than ' +
      'the theorem. Biologically, a species with constant age-specific mortality across a long lifespan ' +
      'and demonstrated genetic variance for late-life effects would strain the framework.',
    registry_overlap: {
      relation: 'none',
      law_ids: [],
      note: 'The registry has no age-structured demography. development-growth-asymptote (von Bertalanffy, candidate) is growth over age, not fitness over age, and shares no structure with this. Empty slot.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'tree-height-limit',
    title: 'What sets the maximum height of a tree: buckling, hydraulics, or neither?',
    field: 'biomechanics',
    statement_en:
      'A self-loaded elastic column of given taper and material has a critical height above which it ' +
      'buckles under its own weight (Greenhill). A tree also has a hydraulic limit: water transport by ' +
      'tension fails when the gradient needed to lift sap exceeds what the xylem can hold without ' +
      'cavitating. Observed maximum heights are around 115 m. Which limit binds, and why no taller tree ' +
      'exists, is unresolved.',
    why_it_is_open:
      'Koch et al. measured the physiological gradient in the tallest redwoods and found photosynthesis ' +
      'and leaf expansion approaching zero near the top, arguing the limit is hydraulic rather than ' +
      'mechanical. But the two limits are not independent - taper set by mechanical safety determines the ' +
      'conduit geometry that sets hydraulic resistance - and nobody has shown that either limit is reached ' +
      'before growth simply stops for reasons of carbon balance. The buckling limit computed for real ' +
      'taper sits well above 115 m, so mechanics alone does not explain the observation, and the hydraulic ' +
      'limit depends on cavitation thresholds measured with contested methods.',
    source: {
      citation: 'Koch, G. W., Sillett, S. C., Jennings, G. M. & Davis, S. D. (2004) The limits to tree height. Nature 428:851-854.',
      doi: '10.1038/nature02417',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [
      { citation: 'Greenhill, A. G. (1881) Determination of the greatest height consistent with stability that a vertical pole or mast can be made. Proc Camb Philos Soc 4:65-73.', doi: null, verified: 'standard pre-DOI reference, not machine-verified; cited for the buckling result only' },
      { citation: 'McMahon, T. A. (1973) Size and shape in biology. Science 179:1201-1204.', doi: '10.1126/science.179.4079.1201', verified: 'Crossref 2026-11-06' },
    ],
    formalisable: 'conditionally-provable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'A real addition to the repo\'s mechanics: scaling-bending-law already has the section modulus and ' +
      'the moment-over-Z bending stress, but there is no BUCKLING law anywhere in the registry, and ' +
      'buckling is a different failure mode with a different size dependence (critical height ~ ' +
      '(E/rho g)^(1/3) d^(2/3) for a column, not a stress comparison). Formalising it gives the checker a ' +
      'second way to rule out an oversized design, which is the registry\'s existing use for such laws. On ' +
      'the open question it adds nothing: proving a critical height does not tell you whether a redwood ' +
      'is near it.',
    the_hypotheses_it_would_need:
      'Linear elasticity with a single Young\'s modulus E, the same at every height and in green wood; a ' +
      'specified taper profile (uniform, or a power law) since the critical height depends on it; density ' +
      'rho constant through the trunk; self-weight as the only load, excluding wind, which for real trees ' +
      'is the dominant load and makes the pure buckling limit the wrong criterion; small deflections; and ' +
      'no root failure or soil yielding, which is how large trees actually fall.',
    how_it_could_be_false:
      'The mechanical statement is refuted by a standing tree exceeding the critical height computed from ' +
      'its own measured taper, modulus and density - so the law is directly checkable against any ' +
      'well-measured specimen, which is more than most laws in the registry can say. The hydraulic account ' +
      'is refuted by a tree sustaining positive net carbon gain in leaves above the height at which the ' +
      'measured cavitation threshold should have been crossed.',
    registry_overlap: {
      relation: 'partial',
      law_ids: ['scaling-bending-law', 'scaling-strength-law', 'elastic-similarity'],
      note: 'scaling-bending-law (accepted) gives bending stress F*l/Z and the square-cube argument; scaling-strength-law (accepted) gives axial failure sigma*A. Neither is buckling: both are stress criteria, and Euler/Greenhill instability is a stiffness criterion that can bind first. Not a duplicate, and the gap is real.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'paradox-of-enrichment',
    title: 'Why do enriched natural systems not collapse as the models say they should?',
    field: 'ecology',
    statement_en:
      'In the Rosenzweig-MacArthur predator-prey model, raising the prey carrying capacity past a threshold ' +
      'destabilises the coexistence equilibrium through a Hopf bifurcation, producing limit cycles of ' +
      'growing amplitude and, with demographic noise, extinction. Enrichment should therefore destabilise ' +
      'real systems. Mostly it does not.',
    why_it_is_open:
      'The model result is a theorem and has never been in doubt; what is open is why the prediction fails ' +
      'in the field, and the candidate answers are a list rather than a conclusion: inedible prey classes, ' +
      'predator interference, spatial refuges, stage structure, rapid prey evolution, ratio-dependent ' +
      'rather than prey-dependent functional responses. Each removes the paradox in a model. None has been ' +
      'shown to be the operative mechanism in a particular enriched lake, and the honest position is that ' +
      'the paradox is an artefact of a model nobody believes, which leaves the original question - what ' +
      'actually governs stability under enrichment - untouched.',
    source: {
      citation: 'Rosenzweig, M. L. (1971) Paradox of enrichment: destabilization of exploitation ecosystems in ecological time. Science 171:385-387.',
      doi: '10.1126/science.171.3969.385',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [],
    formalisable: 'not-formalisable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'Nothing worth the effort, and this entry is here to mark that. The provable fragment - a Jacobian ' +
      'eigenvalue computation at a fixed point of a two-variable ODE - is provable and is also a homework ' +
      'exercise; formalising it yields a theorem about Rosenzweig-MacArthur, and Rosenzweig-MacArthur is ' +
      'not a lake. The open part is the choice of functional response and the inventory of stabilising ' +
      'structure, which is a modelling and measurement question with no proposition for Lean to check. ' +
      'Note the contrast with the exclusion bound above: that one has a premise list a field ecologist ' +
      'could argue with, so formalising it disciplines the argument. This one just has a different model.',
    the_hypotheses_it_would_need:
      'A Holling type II functional response with specified attack rate and handling time; logistic prey ' +
      'growth with carrying capacity K; a linear predator death rate; a constant conversion efficiency; ' +
      'well-mixed homogeneous populations; and continuous deterministic dynamics with no stage structure ' +
      'or evolution. The hypothesis list IS the paradox: every item is known to be false of real systems, ' +
      'and the premises cannot be independently measured in a way that would make the conclusion ' +
      'confrontable. That failure of bite is the reason for the `not-formalisable` grade, not the ' +
      'difficulty of the proof, which is low.',
    how_it_could_be_false:
      'As a claim about the world: a controlled enrichment of a replicated mesocosm in which predator and ' +
      'prey densities show no increase in oscillation amplitude and no elevated extinction rate relative ' +
      'to unenriched controls. Several such experiments exist and point against the prediction, which is ' +
      'why the paradox is named as a paradox rather than a law.',
    registry_overlap: {
      relation: 'none',
      law_ids: [],
      note: 'No predator-prey or community-dynamics law in the registry. fisher-kpp-speed (candidate) is the closest thing to a reaction-diffusion population law and shares nothing with this.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'eigen-error-threshold',
    title: "Eigen's paradox: how did replication accuracy and genome length bootstrap each other?",
    field: 'origin of life / molecular evolution',
    statement_en:
      'For a quasispecies, information is maintained only if the product of genome length and per-base ' +
      'error rate stays below a threshold of order one: roughly nu * mu < ln(s) for selective superiority ' +
      's. Accurate replication requires enzymes; enzymes require a genome longer than an error-prone ' +
      'replicator can maintain. How the first replicators escaped the resulting trap is open.',
    why_it_is_open:
      'The threshold inequality is a theorem about the quasispecies model. The open question is historical ' +
      'and mechanistic: which escape actually happened. Proposals include compartmentalisation with group ' +
      'selection on vesicles, hypercycles of short mutually catalytic replicators (Eigen\'s own answer, ' +
      'which is vulnerable to parasites), recombination, transient relaxation of the threshold under ' +
      'spatial structure, and the stochastic-corrector model. None is established, and the relevant ' +
      'chemistry of the period leaves no record, so the question may not be decidable by evidence at all.',
    source: {
      citation: 'Eigen, M. (1971) Selforganization of matter and the evolution of biological macromolecules. Naturwissenschaften 58:465-523.',
      doi: '10.1007/BF00623322',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [],
    formalisable: 'not-formalisable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'For the open question, nothing, and not for lack of trying: the open part is a claim about what ' +
      'happened on the early Earth, and there is no premise set from which a Lean theorem about that ' +
      'follows. The threshold inequality itself could be formalised and would be a respectable piece of ' +
      'work, but it would be a theorem about a quasispecies model whose parameters nobody can supply for ' +
      'any prebiotic replicator, so it would enter the registry as mathematics with no instance - the ' +
      'thing the non-vacuity witness exists to flag. Worth saying plainly: a law whose witness is a ' +
      'made-up parameter triple passes the vacuity check and is still empty.',
    the_hypotheses_it_would_need:
      'A fixed genome length nu; a uniform per-base copying fidelity q = 1 - mu, independent across sites ' +
      'and across copies; a single master sequence with selective superiority s over a uniform mutant ' +
      'cloud; infinite population size; and deterministic concentration dynamics at a steady state. The ' +
      'uniform-error and single-master premises are both known to be wrong for any realistic fitness ' +
      'landscape, and the threshold moves when they are relaxed.',
    how_it_could_be_false:
      'The inequality is refuted by a replicator system maintaining a genome above the threshold its ' +
      'measured fidelity and superiority imply - which has effectively been demonstrated, since ' +
      'populations on rugged or neutral-network landscapes persist past the uniform-landscape threshold. ' +
      'So the sharp version is already known to be premise-dependent, which is a better reason to leave ' +
      'it out of the registry than its difficulty.',
    registry_overlap: {
      relation: 'none',
      law_ids: [],
      note: 'No quasispecies or error-threshold law in the registry. maynardsmith-hitchhiking (candidate) concerns sweeps at linked neutral sites and is unrelated.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'elastic-vs-geometric-similarity',
    title: 'Do skeletons scale by elastic similarity, geometric similarity, or neither?',
    field: 'biomechanics / allometry',
    statement_en:
      'Geometric similarity predicts bone diameter d proportional to length l. Elastic similarity ' +
      '(McMahon) predicts d proportional to l^(3/2), so that elastic deflection under self-load is ' +
      'size-invariant. Measured mammalian limb-bone exponents mostly sit near geometric similarity, close ' +
      'to 1.0-1.1, not 1.5, over several orders of magnitude of body mass.',
    why_it_is_open:
      'Elastic similarity is a prediction that failed, and the open question is what replaced it. ' +
      'Biewener\'s answer is that large mammals keep peak bone stress roughly constant not by thickening ' +
      'bones but by changing POSTURE - straightening the limb so the effective mechanical advantage rises ' +
      'with size - which moves the explanation out of the scaling exponent entirely. That account fits ' +
      'mammals from a chipmunk to a horse and then runs out: postural change cannot continue indefinitely, ' +
      'and what happens at elephant size and above, and in non-mammals, is not settled. There is no ' +
      'accepted replacement law, only a measured exponent and a mechanism that explains part of the range.',
    source: {
      citation: 'McMahon, T. A. (1973) Size and shape in biology. Science 179:1201-1204.',
      doi: '10.1126/science.179.4079.1201',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [
      { citation: 'Biewener, A. A. (1989) Scaling body support in mammals: limb posture and muscle mechanics. Science 245:45-48.', doi: '10.1126/science.2740914', verified: 'Crossref 2026-11-06' },
    ],
    formalisable: 'statable-only',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'Nothing, and the registry already demonstrates why by carrying `elastic-similarity` at status ' +
      '"proposed" with no Lean module - which is the correct place for it. "Bones thicken as l^(3/2)" is ' +
      'not a theorem; it is an empirical claim about animals, and writing it in Lean produces a named ' +
      'hypothesis that is FALSE of the animals measured. The derivation that elastic similarity implies ' +
      'size-invariant deflection IS provable from beam theory, but that is a definitional consequence, not ' +
      'a discovery, and proving it would lend borrowed authority to an exponent the data reject. The ' +
      'grade is `statable-only` because the statement is writable and unprovable, which is exactly the ' +
      'conjecture slot.',
    the_hypotheses_it_would_need:
      'A beam model with a stated cross-section and a single Young\'s modulus; self-weight scaling as l^3; ' +
      'a specified loading geometry and lever arm; and then the exponent itself, as a bare assumption. ' +
      'That last point is the whole objection: the exponent is the thing in question, so assuming it ' +
      'makes the theorem circular, and measuring it makes the theorem unnecessary.',
    how_it_could_be_false:
      'It is already false in the ordinary reading: a phylogenetically controlled regression of limb-bone ' +
      'diameter on length across mammals returns an exponent near 1.1 with a confidence interval ' +
      'excluding 1.5. It would be rescued only if the relevant dimension were something other than ' +
      'external diameter - cortical thickness, or second moment of area corrected for curvature - and ' +
      'that measurement came out near the elastic prediction.',
    registry_overlap: {
      relation: 'already-present-unproved',
      law_ids: ['elastic-similarity', 'scaling-bending-law'],
      note: 'ALREADY IN THE REGISTRY: law_id `elastic-similarity`, status "proposed", statement "Bones thicken with size (d proportional to l^(3/2)) rather than isometrically", with no Lean module. It is listed here to argue that it should STAY unproved, not to propose formalising it. This is the one candidate on the list that is a deliberate duplicate.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'ess-in-finite-populations',
    title: 'What is the right stability condition for a strategy in a finite population?',
    field: 'evolutionary game theory',
    statement_en:
      'The classical ESS condition is defined for an infinite population: a strategy is an ESS if it does ' +
      'better against itself than any mutant does against it, or ties and does better against the mutant. ' +
      'In a population of size N with stochastic dynamics the condition is different, and Nowak et al. ' +
      'showed a resident can be an ESS in the classical sense yet be invaded by a neutral-drift-assisted ' +
      'mutant, with the fixation threshold giving the 1/3 law.',
    why_it_is_open:
      'The mathematics here is largely settled - which is why this is graded `provable` and ' +
      '`the-maths-only` - and what remains open is which condition applies to real populations, since ' +
      'that depends on N, on the mutation rate, on the update rule (Moran, Wright-Fisher, pairwise ' +
      'comparison) and on population structure, and the conclusions differ between update rules in ways ' +
      'that are not empirically distinguishable for any field system. A result that depends on the choice ' +
      'of update rule, where no organism announces its update rule, is a mathematical result wearing ' +
      'biological clothes.',
    source: {
      citation: 'Nowak, M. A., Sasaki, A., Taylor, C. & Fudenberg, D. (2004) Emergence of cooperation and evolutionary stability in finite populations. Nature 428:646-650.',
      doi: '10.1038/nature02414',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [
      { citation: 'Maynard Smith, J. & Price, G. R. (1973) The logic of animal conflict. Nature 246:15-18.', doi: '10.1038/246015a0', verified: 'Crossref 2026-11-06' },
    ],
    formalisable: 'provable',
    settles_the_open_question: 'the-maths-only',
    what_lean_would_add:
      'Re-checking of a 2004 proof, plus one thing with a little more value: the registry currently ' +
      'contains exactly one game (maynardsmith-hawk-dove) with its escalation probability fixed by a ' +
      'named hypothesis p*C = V, and no general ESS definition at all. Adding the definition would let ' +
      'the Hawk-Dove law be stated as an INSTANCE rather than a special case, and would make it possible ' +
      'to state that some games have no ESS - a fact a one-game registry cannot express. Against that: ' +
      'this is game theory, the results are not in dispute, and nothing about any organism follows.',
    the_hypotheses_it_would_need:
      'A finite strategy set with a payoff matrix; a specified update rule (the Moran process with ' +
      'frequency-dependent fitness, or imitation dynamics - the conclusions differ, so it must be named); ' +
      'weak selection, in the form fitness = 1 - w + w*payoff with w small, since the 1/3 law holds in ' +
      'that limit and not generally; well-mixed interaction, with no structure; and a single mutant ' +
      'introduced into a monomorphic resident population, so recurrent mutation is excluded.',
    how_it_could_be_false:
      'The 1/3 law is false outside weak selection, and false under structured interaction - so the ' +
      'formalised version must carry the weak-selection premise explicitly or it is refutable by a direct ' +
      'computation of fixation probabilities at strong selection. That is a good outcome for a test ' +
      'suite and a warning for anyone quoting the law without its premise.',
    registry_overlap: {
      relation: 'partial',
      law_ids: ['maynardsmith-hawk-dove', 'favored-fixation-lower-bound'],
      note: 'maynardsmith-hawk-dove (candidate) is one game with a hypothesised mixed equilibrium. favored-fixation-lower-bound (accepted) already gives fixation probability at least i/M for a chain whose expected copy number never decreases, which is the machinery a finite-population ESS argument needs - so about half the substrate is present. Not a duplicate.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'ftns-total-change-counterexample',
    title: "Is Fisher's fundamental theorem false for the TOTAL change in mean fitness?",
    field: 'population genetics / evolutionary theory',
    statement_en:
      'The registry proves the partial-change form: under fixed fitnesses in a haploid population, the ' +
      'change in mean fitness equals the variance in fitness divided by mean fitness, so mean fitness ' +
      'never falls. The claim at issue is the converse for the TOTAL change: there exists a population ' +
      'with dominance or epistasis, under selection alone with constant genotypic fitnesses, in which ' +
      'mean fitness DECREASES from one generation to the next.',
    why_it_is_open:
      'It is not open in the literature - it has been known since the 1960s that mean fitness can decline ' +
      'under selection with multiple loci and recombination, and that the FTNS survives only in Price\'s ' +
      'and Ewens\'s partial-change reading. It is open IN THIS REPOSITORY, which is the reason it is on ' +
      'the list. `lean/Delphi/Fisher.lean` states at line 44 that the theorem is "**false** for the ' +
      '*total* change under dominance, epistasis, frequency dependence or a changing environment", and ' +
      'nothing in the project proves it. An accepted law (fisher-ftns) sits beside a prose assertion of ' +
      'its own limits, and the limits are the part a reader will rely on.',
    source: {
      citation: 'Ewens, W. J. (1989) An interpretation and proof of the fundamental theorem of natural selection. Theor Popul Biol 36:167-180.',
      doi: '10.1016/0040-5809(89)90028-2',
      verified: 'Crossref 2026-11-06: title, container and year match; also already cited in lean/Delphi/Fisher.lean',
    },
    secondary_sources: [
      { citation: "Price, G. R. (1972) Fisher's 'fundamental theorem' made clear. Ann Hum Genet 36:129-140.", doi: '10.1111/j.1469-1809.1972.tb00764.x', verified: 'Crossref 2026-11-06; also already cited in lean/Delphi/Fisher.lean' },
    ],
    formalisable: 'provable',
    settles_the_open_question: 'yes',
    what_lean_would_add:
      'The single highest-value item on this list, and the only one where a proof closes something the ' +
      'repository actually leans on. It is an EXISTENCE claim with a finite witness: exhibit two loci, ' +
      'specified genotypic fitnesses, a recombination rate and an initial haplotype frequency vector, and ' +
      'compute that mean fitness after one generation is strictly lower than before. No analysis, no ' +
      'limits, no real-number pathology - rational arithmetic that `norm_num` can discharge. It converts a ' +
      'prose caveat into a machine-checked scope boundary, which is precisely what the mutation benchmark ' +
      'identified as the registry\'s weak point: "whether the statement means what the English says... is ' +
      'probably the larger risk".',
    the_hypotheses_it_would_need:
      'Almost none, which is why it is worth doing. Discrete non-overlapping generations; selection by ' +
      'relative genotypic fitness with no mutation, drift or migration; a stated recombination fraction; ' +
      'random mating. All are definitional parts of the model being used, not empirical claims about any ' +
      'organism - so unlike every other item here, the theorem would not be hostage to a measurement. It ' +
      'is a statement about the model the registry already committed to.',
    how_it_could_be_false:
      'The existence claim is false if no such witness exists - that is, if mean fitness is ' +
      'non-decreasing under selection alone for every multi-locus fitness assignment and recombination ' +
      'rate. Attempting the proof therefore settles it either way, which no other item on this list can ' +
      'claim: a failure to find a witness would mean Fisher.lean\'s prose caveat is wrong and should be ' +
      'deleted, and that is as useful a result as the proof.',
    registry_overlap: {
      relation: 'partial',
      law_ids: ['fisher-ftns'],
      note: 'fisher-ftns is ACCEPTED for the haploid partial-change form (Delphi.fisher_fundamental_theorem) and its scope.assumed excludes the diploid/total case. This is the complement, not a duplicate: it would prove the boundary that law already asserts in prose.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'somite-clock-scaling',
    title: 'What sets segment number, and why does the segmentation clock scale with body size?',
    field: 'developmental biology',
    statement_en:
      'Under clock-and-wavefront, segment number is the total duration of wavefront progression divided ' +
      'by the clock period, so N = T_total / T_clock. Species with very different body sizes and ' +
      'temperatures produce reproducible, species-specific segment counts, which requires the clock ' +
      'period and the wavefront speed to co-vary precisely. What enforces that co-variation is unknown.',
    why_it_is_open:
      'The arithmetic is trivial and the biology is not. The clock period is set by a delayed negative ' +
      'feedback oscillator whose period depends on transcription and translation delays, and these are ' +
      'temperature- and species-dependent; the wavefront depends on a separate signalling gradient. ' +
      'Nothing known couples them, yet segment number is among the most canalised traits in vertebrates. ' +
      'Recent work on species-specific oscillation periods in cultured cells shows the period is ' +
      'cell-autonomous, which deepens rather than resolves the problem: it rules out a systemic timer ' +
      'without identifying what matches clock to wavefront.',
    source: {
      citation: 'Cooke, J. & Zeeman, E. C. (1976) A clock and wavefront model for control of the number of repeated structures during animal morphogenesis. J Theor Biol 58:455-476.',
      doi: '10.1016/S0022-5193(76)80131-2',
      verified: 'Crossref 2026-11-06: title, container and year match. NOTE: an earlier draft of this file carried 10.1016/0022-5193(76)80131-2 for this paper, which 404s - the S is required.',
    },
    secondary_sources: [],
    formalisable: 'statable-only',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'Nothing of substance, and the reason is instructive. N = T_total / T_clock is a division; ' +
      'formalising it produces a theorem whose content is that division works, dressed in developmental ' +
      'vocabulary. It would look like a biological law in the registry and would be arithmetic. The open ' +
      'question - what couples the two timescales - has no candidate mechanism precise enough to state as ' +
      'a premise, so there is nothing to put on the left of the implication. The grade is `statable-only` ' +
      'rather than `not-formalisable` only because the identity is writable and the coupling could be ' +
      'stated as a conjecture if someone ever proposes a specific one.',
    the_hypotheses_it_would_need:
      'A constant clock period through somitogenesis, which is false - the period lengthens along the ' +
      'axis in every species measured; a constant wavefront speed, also false; a well-defined T_total; ' +
      'and the independence of the two, which is the thing in question. A theorem conditioned on two ' +
      'premises known to be false of every organism studied is the clearest case in this file of a ' +
      'formalisation that would mislead by existing.',
    how_it_could_be_false:
      'The identity is refuted by a species in which measured clock period and measured wavefront ' +
      'duration do not predict the observed segment count - which is the normal result once the period ' +
      'is allowed to vary along the axis, and is why the constant-period version is not worth writing ' +
      'down. The underlying model would be in real trouble if segment number were shown to be specified ' +
      'before the clock runs, for instance by a prepattern.',
    registry_overlap: {
      relation: 'partial',
      law_ids: ['turing-ddi', 'turing-wavelength', 'genotype-developmental-ordering', 'development-growth-asymptote'],
      note: 'The registry has pattern formation (turing-ddi, turing-wavelength, both candidate) and developmental ORDERING (genotype-developmental-ordering, accepted: every develops_from edge goes strictly down in stage). It has no segmentation clock. Not a duplicate - but the overlap with turing-wavelength is real enough that a segment-spacing law should be checked against it before being added.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'origin-of-flapping-flight',
    title: 'Did powered flight originate from the ground up or from the trees down?',
    field: 'evolutionary biomechanics',
    statement_en:
      'Vertebrate powered flight arose at least three times. For birds the two long-standing accounts are ' +
      'cursorial (a running biped using proto-wings for thrust, or wing-assisted incline running) and ' +
      'arboreal (a gliding ancestor acquiring flapping from a parachuting or gliding stage). Which route ' +
      'the avian lineage took is unresolved.',
    why_it_is_open:
      'Both routes are mechanically possible and both have living analogues, so the dispute turns on ' +
      'fossil evidence about the behaviour and ecology of specific Jurassic and Cretaceous taxa - whether ' +
      'Archaeopteryx and its relatives were arboreal, whether the forelimb could generate useful thrust ' +
      'at their mass and feather morphology, whether wing-assisted incline running leaves a skeletal ' +
      'signature. The evidence is sparse and the inferences from it are contested, which is a different ' +
      'kind of openness from everything else on this list: no new argument settles it, only new fossils.',
    source: {
      citation: null,
      doi: null,
      verified: 'DELIBERATELY NULL AND FLAGGED. This is a large contested literature with no single defining paper, and I was not confident enough of any specific DOI to assert one from memory. Rather than attach a plausible-looking citation that might not resolve, the field is null. The Gould & Lewontin critique of adaptive storytelling (doi:10.1098/rspb.1979.0086, Crossref-verified 2026-11-06) is the relevant methodological reference and is recorded below, but it is not a source FOR this problem.',
    },
    source_note:
      'source is null by choice, not by oversight: see `verified`. A fabricated DOI is worse than an absent ' +
      'one, and this entry exists partly to exercise that rule in the test suite.',
    secondary_sources: [
      { citation: 'Gould, S. J. & Lewontin, R. C. (1979) The spandrels of San Marco and the Panglossian paradigm. Proc R Soc Lond B 205:581-598. (Methodological, on adaptive narratives; not a source for the flight-origins debate itself.)', doi: '10.1098/rspb.1979.0086', verified: 'Crossref 2026-11-06' },
    ],
    formalisable: 'not-formalisable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'Nothing, under any framing, and it is on the list as the clearest negative case. One could ' +
      'formalise power-margin bounds for a proto-wing and prove that a given mass and wing area cannot ' +
      'sustain level flight - the registry already has most of that machinery - and it would not bear on ' +
      'the question, because both hypotheses agree the earliest stages were not powered flight. A ' +
      'historical claim about which sequence of events occurred is not the kind of thing a proof assistant ' +
      'has an opinion about. Any apparent progress here would be a theorem about a model substituted for ' +
      'the question asked.',
    the_hypotheses_it_would_need:
      'To get to the actual question: that a particular fossil taxon was arboreal; that its forelimb ' +
      'stroke could produce a given thrust; that the ancestral condition of the relevant clade was one or ' +
      'the other. Each of these is the conclusion of a contested inference from morphology, and assuming ' +
      'one makes the theorem answer the question by assumption - the exact failure mode the ' +
      '`not-formalisable` grade exists to name.',
    how_it_could_be_false:
      'The cursorial account is undermined by a well-dated basal avialan with unambiguous arboreal ' +
      'adaptations and no cursorial features, and the arboreal account by the converse. This IS a ' +
      'falsifiable problem - it is simply falsifiable by excavation rather than by proof, which is why it ' +
      'belongs on a scoping list as a reject.',
    registry_overlap: {
      relation: 'none',
      law_ids: ['flight-climb-glide-law', 'thompson1917-ch02-07', 'taxiing-thrust'],
      note: 'Listed law_ids are ADJACENT, not overlapping: the registry has power margins for climb and glide, Thompson on the upper size limit of flapping flight, and taxiing thrust (proposed). All concern whether a given animal CAN fly; none concerns how flight originated, and the distinction is the point of this entry.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'levels-of-selection-partition',
    title: 'Does the Price partition identify a cause, or only an accounting scheme?',
    field: 'evolutionary theory / philosophy of biology',
    statement_en:
      'The Price equation partitions the change in a population mean into a selection covariance and a ' +
      'transmission expectation, and for a structured population into between-group and within-group ' +
      'components. The algebra is exact and uncontroversial. Whether the between-group term measures a ' +
      'distinct causal process - group selection - or is one of several equally valid bookkeeping choices ' +
      'is disputed.',
    why_it_is_open:
      'The dispute is not about the mathematics, which is an identity, but about whether the partition ' +
      'carries causal content. Multilevel selection and inclusive fitness give formally equivalent ' +
      'accounts of the same data with different partitions, and each camp regards the other\'s terms as ' +
      'artefacts. Because the accounts are mathematically interconvertible, no measurement distinguishes ' +
      'them, and the question has resisted resolution for fifty years in a way that suggests it is not an ' +
      'empirical question at all.',
    source: {
      citation: "Price, G. R. (1972) Fisher's 'fundamental theorem' made clear. Ann Hum Genet 36:129-140.",
      doi: '10.1111/j.1469-1809.1972.tb00764.x',
      verified: 'Crossref 2026-11-06: title, container and year match. Cited for the partition method; the 1970 Nature paper "Selection and covariance" is the primary statement of the equation but I did not verify its DOI and so do not assert one.',
    },
    secondary_sources: [],
    formalisable: 'not-formalisable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'The worst value-to-effort ratio on the list, and a trap worth naming because it looks like the ' +
      'best. The Price equation is an identity over finite sums - exactly the shape Mathlib handles well, ' +
      'and the kind of thing a formalisation project is tempted by. Proving it would be straightforward ' +
      'and would settle nothing, because NOBODY DISPUTES THE IDENTITY. The disputed content is whether ' +
      'one term names a cause, and causal interpretation is not a proposition in the formal language. A ' +
      'Lean-checked Price equation in the registry would create the impression that a contested question ' +
      'had been addressed, which is worse than leaving it out.',
    the_hypotheses_it_would_need:
      'For the identity: a finite population, a well-defined parent-offspring map, fitnesses as offspring ' +
      'counts, and a partition into groups. All definitional. For the contested claim: a formal criterion ' +
      'for "X is a cause of Y" applicable to a statistical decomposition - which does not exist in a form ' +
      'the parties agree on, and inventing one in Lean would be taking a side by choosing a definition.',
    how_it_could_be_false:
      'The identity cannot be false; it is an identity, and a problem that cannot be false is not a ' +
      'problem - which is the whole argument for this grade. The causal claim has no agreed refutation ' +
      'condition, and that absence is itself the finding: an open question with no specifiable refuting ' +
      'observation is not a target for formalisation.',
    registry_overlap: {
      relation: 'partial',
      law_ids: ['fisher-ftns', 'hamilton-rule'],
      note: 'hamilton-rule (candidate) already carries dp = k*(r*b - c) as a NAMED HYPOTHESIS in the Price-equation form, with b and c as partial regressions - so the registry has already taken the inclusive-fitness formulation as a hypothesis without proving it, which is the right handling and makes a separate Price-equation law redundant.',
    },
  },
  // ---------------------------------------------------------------------------------------------------
  {
    id: 'sustained-metabolic-ceiling',
    title: 'What limits sustained metabolic rate: the gut, the organ, or heat dissipation?',
    field: 'comparative physiology',
    statement_en:
      'Sustained (multi-day) metabolic rate saturates at roughly 4 to 7 times basal rate across endotherms ' +
      'and does not rise further under increased demand. Three accounts compete: a central limit set by ' +
      'the gut\'s capacity to import energy, a peripheral limit set by the consuming tissue, and a limit ' +
      'set by the maximum rate of heat dissipation. Which binds, and whether one does universally, is open.',
    why_it_is_open:
      'The experiments that should discriminate the accounts give mixed results: cold exposure and ' +
      'lactation raise sustained intake above supposed central ceilings in some species; surgically or ' +
      'environmentally relieving heat dissipation raises milk output in others, favouring the thermal ' +
      'account; and peripheral limits are supported by muscle-specific manipulations. Hammond & Diamond ' +
      'concluded the ceiling is real and its cause unidentified, and the position has not moved decisively ' +
      'since. The likely answer - that different limits bind in different species and states - is the kind ' +
      'of answer that makes a general law impossible rather than merely unknown.',
    source: {
      citation: 'Hammond, K. A. & Diamond, J. (1997) Maximal sustained energy budgets in humans and animals. Nature 386:457-462.',
      doi: '10.1038/386457a0',
      verified: 'Crossref 2026-11-06: title, container and year match',
    },
    secondary_sources: [],
    formalisable: 'not-formalisable',
    settles_the_open_question: 'no',
    what_lean_would_add:
      'Nothing, because the registry has already done the formalisable part and it did not answer this. ' +
      'aerobic-power-bound and E3 derive an aerobic ceiling from cardiac output, arteriovenous difference, ' +
      'oxycaloric equivalent and efficiency - a chain of inequalities, correctly proved, and silent on ' +
      'WHICH of its terms is the binding constraint in any animal. That is the general shape of the ' +
      'failure: a conjunction of bounds proves the minimum is a bound without identifying which one it is, ' +
      'and the open question is exactly the identification. Formalising a fourth candidate limit adds ' +
      'another term to the minimum and no discrimination between them.',
    the_hypotheses_it_would_need:
      'A quantitative capacity for each candidate stage - gut uptake rate, delivery rate, tissue ' +
      'utilisation rate, heat loss rate - each measured independently in the same animal in the same ' +
      'state. The premise that makes the theorem interesting is that one of these is strictly smallest, ' +
      'and that is the conclusion. The circularity is unavoidable here, which is what separates this from ' +
      'the `conditionally-provable` items where the premises are measurable independently of the ' +
      'conclusion.',
    how_it_could_be_false:
      'The existence of a ceiling is refuted by a sustained metabolic rate well above 7 times basal ' +
      'maintained over weeks - which is approached by some migrating birds and by Tour de France cyclists, ' +
      'and these cases are exactly why the universality of the ceiling is doubted. Any specific account ' +
      'is refuted by relieving its proposed bottleneck and observing no increase in sustained rate.',
    registry_overlap: {
      relation: 'partial',
      law_ids: ['aerobic-power-bound', 'E3', 'E4', 'fick-principle', 'physiology-q10'],
      note: 'SUBSTANTIALLY COVERED. aerobic-power-bound (accepted) proves eta*E*Q*(Ca-Cv) <= eta*E*Q*Ca <= E*Q*Ca; E3 (accepted) gives a 0.0833 W ceiling from measured coefficients; fick-principle (accepted) gives the delivery identity. The formalisable content of this problem is already in the registry, which is the evidence for the grade: the laws exist and the question is still open.',
    },
  },
]);

// =====================================================================================================
// TRIAGE
// =====================================================================================================

const countBy = (key) =>
  Object.freeze(
    PROBLEMS.reduce((acc, p) => {
      acc[p[key]] = (acc[p[key]] || 0) + 1;
      return acc;
    }, {})
  );

export const TRIAGE = Object.freeze({
  total: PROBLEMS.length,

  by_formalisable: countBy('formalisable'),
  by_settles_the_open_question: countBy('settles_the_open_question'),
  by_registry_relation: Object.freeze(
    PROBLEMS.reduce((acc, p) => {
      const r = p.registry_overlap.relation;
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {})
  ),

  headline:
    'THE FORMALISABILITY HISTOGRAM IS THE WRONG NUMBER, AND IT FLATTERS THE PROJECT. Eight of fifteen ' +
    'problems are provable or conditionally provable, which sounds like a mandate. The number that matters ' +
    'is the second column: in TWELVE of fifteen, proving the formalisable part would not move the open ' +
    'question at all, because the open part is empirical and the theorem would be about a model. In two ' +
    'more, Lean would re-check mathematics already settled in print. EXACTLY ONE of fifteen - the ' +
    'total-change counterexample to Fisher\'s fundamental theorem - would discharge a claim this repository ' +
    'itself relies on and has not proved. One in fifteen is the honest yield of this exercise.',

  the_ratio_that_matters:
    '1 of 15 settles its open question; 2 of 15 settle mathematics only; 12 of 15 settle nothing. Said the ' +
    'other way: formalisation here is 93 % restatement and 7 % result.',

  why_the_first_column_is_misleading:
    'Because "conditionally-provable" can absorb anything. Any empirical claim becomes provable once you ' +
    'are allowed to assume enough, so a grader with a quota will produce a list of conditional theorems ' +
    'whose hypotheses are the conclusions in disguise. The five `not-formalisable` grades here are the ' +
    'load-bearing part of the triage: they are the cases where the only available premise restates the ' +
    'question (sustained-metabolic-ceiling, paradox-of-enrichment), where no premise can reach a historical ' +
    'fact (origin-of-flapping-flight, eigen-error-threshold), or where the identity everyone agrees on is ' +
    'not the thing in dispute (levels-of-selection-partition).',

  what_a_registry_gains_anyway:
    'Three things, all narrow and all real. (1) INCONSISTENCY DETECTION: ' +
    'molecular-clock-generation-time is a conflict between an ACCEPTED law and the data, and a registry ' +
    'that holds accepted laws separately will never notice. (2) SCOPE BOUNDARIES AS THEOREMS: ' +
    'ftns-total-change-counterexample converts a prose caveat in Fisher.lean into something checked. ' +
    '(3) EMPTY SLOTS MADE VISIBLE: there is no ecology, no age-structured demography and no buckling ' +
    'criterion anywhere in the 62 laws, which only becomes apparent when you try to place problems in them.',

  what_would_make_this_worth_continuing:
    'Only the inconsistency-detection use. A registry that can derive False from its own accepted laws plus ' +
    'a measurement is doing something no literature review does. A registry that accumulates conditional ' +
    'theorems about models is a bibliography with a typechecker.',

  counts_sum_check: PROBLEMS.length,
});

// =====================================================================================================
// THE HONEST LIMIT
// =====================================================================================================

export const THE_HONEST_LIMIT = Object.freeze({
  one_sentence:
    'Lean checks that a conclusion follows from stated premises; it cannot check that the premises are true ' +
    'of any organism.',

  therefore:
    'The value of formalising biology is not in establishing biological facts - it cannot establish any - ' +
    'but in two side effects of being forced to write the premises down: VACUITY is caught, because a ' +
    'theorem with unsatisfiable hypotheses can be detected mechanically; and EQUIVOCATION is caught, ' +
    'because a term used in two senses cannot typecheck as one. Both are failures of bookkeeping, and both ' +
    'are common enough in theoretical biology to be worth catching. Neither is a discovery about life.',

  the_shape_of_the_mistake_to_avoid:
    'Proving a theorem about a model and reporting it as a result about organisms. Every item on this list ' +
    'that is graded `not-formalisable` is graded that way because the available formalisation invites ' +
    'exactly this substitution. The registry\'s own practice is the right defence: `scope.basis` on every ' +
    'law reads "a theorem about a model: it applies wherever the design supplies the quantities it uses ' +
    'and accepts the hypotheses in scope.assumed", and `haldane-cost-of-selection` is carried as a NAMED ' +
    'HYPOTHESIS that is never proved. That is honest formalisation, and it is also an admission of how ' +
    'little the proof buys.',

  the_narrow_win_that_is_real:
    'benchmarks/lean-mutation established that all 48 laws carrying a Lean module and theorem also carry a ' +
    'non-vacuity witness, and that the witnesses are Lean theorems in ' +
    'lean/registry/lean/Witnesses.lean which compile depending only on propext, Classical.choice and ' +
    'Quot.sound - no sorry, no project axiom. That is the right kind of win: a mechanically checkable ' +
    'property of the whole registry, obtained for free from formalisation, that could not be established ' +
    'by reading. It is also a narrow one. A non-vacuous theorem can still be about nothing: ' +
    'eigen-error-threshold would pass the vacuity check with an invented parameter triple as its witness, ' +
    'and remain empty of biology.',

  what_formalisation_cannot_catch:
    'That the Lean statement says what its English gloss says. The mutation benchmark names this as the ' +
    'larger risk and the one it does not cover: `statement_en` sits beside every law and nothing checks the ' +
    'correspondence. A SURVIVED mutant - a statement provable even after a constant that carries its ' +
    'empirical content is changed - is the only automated signal available, and it is weak. Everything else ' +
    'in that gap is read by a human or not at all.',

  the_test_for_any_proposed_law:
    'Ask what observation would make it false. If the answer is "none, it is a theorem", it belongs in the ' +
    'registry as mathematics and must not be quoted as biology. If the answer names a measurement, find out ' +
    'whether that measurement bears on the PREMISES or on the CONCLUSION: only the second makes the ' +
    'formalisation load-bearing. levels-of-selection-partition fails the first test and ' +
    'sustained-metabolic-ceiling fails the second.',
});

// =====================================================================================================
// RECOMMENDED
// =====================================================================================================

export const RECOMMENDED = Object.freeze([
  {
    id: 'ftns-total-change-counterexample',
    rank: 1,
    why:
      'The only item on the list where a proof closes something the repository relies on. lean/Delphi/' +
      'Fisher.lean asserts in prose that the fundamental theorem is FALSE for the total change under ' +
      'dominance and epistasis, and an accepted law (fisher-ftns) sits next to that unproved assertion - ' +
      'so the project\'s stated scope boundary is currently a comment. The work is an existence claim with ' +
      'a finite rational witness, discharged by arithmetic rather than analysis, and it is the cheapest ' +
      'item here by a wide margin. If the witness cannot be found, that is equally valuable: it would mean ' +
      'the caveat is wrong and should be removed.',
    effort: 'low - rational arithmetic on a 2-locus, 4-haplotype model; no analysis, no limits',
    lean_sketch_uncompiled: [
      '-- Delphi/FisherTotal.lean (SKETCH, not compiled)',
      '/-- A two-locus selection model: haplotype frequencies and genotypic fitnesses. -/',
      'structure TwoLocus where',
      '  x    : Fin 4 → ℝ            -- haplotype frequencies AB, Ab, aB, ab',
      '  w    : Fin 4 → Fin 4 → ℝ    -- fitness of the diploid formed from two haplotypes',
      '  r    : ℝ                    -- recombination fraction',
      '  hx   : ∀ i, 0 ≤ x i',
      '  hsum : ∑ i, x i = 1',
      '  hw   : ∀ i j, 0 < w i j',
      '  hsym : ∀ i j, w i j = w j i',
      '  hr   : 0 ≤ r ∧ r ≤ 1 / 2',
      '',
      'noncomputable def meanW (M : TwoLocus) : ℝ := ∑ i, ∑ j, M.x i * M.x j * M.w i j',
      '',
      '/-- One generation of selection with recombination (random mating, no mutation/drift). -/',
      'noncomputable def step (M : TwoLocus) : Fin 4 → ℝ := fun k => sorry  -- selection + recombination',
      '',
      '/-- THE CLAIM: mean fitness can DECREASE under selection alone. This is what Fisher.lean',
      '    asserts in prose at line 44 and does not prove. -/',
      'theorem mean_fitness_can_decrease :',
      '    ∃ M : TwoLocus, meanW ⟨step M, M.w, M.r, ?_, ?_, M.hw, M.hsym, M.hr⟩ < meanW M := by',
      '  refine ⟨{ x := ![1/4, 1/4, 1/4, 1/4], w := ..., r := 1/2, .. }, ?_⟩',
      '  norm_num [meanW, step]',
      '',
      '-- Non-vacuity witness, in the style of lean/registry/lean/Witnesses.lean:',
      'theorem twoLocus_witness : ∃ M : TwoLocus, True := ⟨{ .. }, trivial⟩',
    ].join('\n'),
    what_it_does_not_do:
      'It says nothing about any population. It fixes a bookkeeping defect in the registry, which is the ' +
      'only class of thing this exercise reliably delivers.',
  },
  {
    id: 'exclusion-bound-and-plankton',
    rank: 2,
    why:
      'It adds a field. The 62 laws contain no ecology and no resource competition, so there is currently ' +
      'no way to state a coexistence constraint at all, and the exclusion bound is the natural first ' +
      'primitive: it is a linear-algebra argument, it is classical, and every proposed escape from the ' +
      'plankton paradox is the denial of one of its premises - which means formalising it turns a ' +
      'rhetorical debate into a list of named structure fields. That is the premise-audit value described ' +
      'in THE_HONEST_LIMIT, and this is the clearest instance of it on the list.',
    effort:
      'medium - needs a Fintype-indexed growth function depending on k factor levels, differentiability at ' +
      'the equilibrium, and a rank argument. Mathlib has the linear algebra; the modelling choices are the ' +
      'work.',
    lean_sketch_uncompiled: [
      '-- Delphi/Exclusion.lean (SKETCH, not compiled)',
      'variable {S F : Type*} [Fintype S] [Fintype F]   -- species, limiting factors',
      '',
      '/-- A community at equilibrium: per-capita growth of each species is a function of the factor',
      '    levels ONLY, and vanishes at the equilibrium levels. A NAMED HYPOTHESIS, not a fact. -/',
      'structure AtEquilibrium (g : S → (F → ℝ) → ℝ) (z : F → ℝ) : Prop where',
      '  zero_growth  : ∀ s, g s z = 0',
      '  depends_only : True  -- carried by the type of g: factor levels are the only argument',
      '',
      '/-- The sensitivity matrix ∂g_s/∂z_f at the equilibrium. -/',
      'noncomputable def sens (g : S → (F → ℝ) → ℝ) (z : F → ℝ) : Matrix S F ℝ := fun s f => sorry',
      '',
      '/-- LEVIN (1970): more species than limiting factors forces a dependency among the',
      '    equilibrium constraints, so the equilibrium is not isolated. -/',
      'theorem exclusion_bound (g : S → (F → ℝ) → ℝ) (z : F → ℝ)',
      '    (heq : AtEquilibrium g z) (hcard : Fintype.card F < Fintype.card S) :',
      '    ¬ Function.Injective (fun s => (sens g z) s) := by',
      '  -- card S rows in a card F-dimensional space cannot be linearly independent',
      '  sorry',
      '',
      '/-- Corollary in the registry\'s idiom: a design claiming n coexisting species at a stable',
      '    equilibrium on k < n limiting factors is ruled out. -/',
      'theorem cannot_coexist (g : S → (F → ℝ) → ℝ) (z : F → ℝ)',
      '    (heq : AtEquilibrium g z) (hind : Function.Injective (fun s => (sens g z) s)) :',
      '    Fintype.card S ≤ Fintype.card F := by sorry',
    ].join('\n'),
    what_it_does_not_do:
      'It does not explain plankton coexistence, and the law must say so in scope.assumed: the premises ' +
      '(equilibrium, asymptotic stability, a closed factor list) are each denied by at least one serious ' +
      'account of the paradox.',
  },
  {
    id: 'senescence-selection-force',
    rank: 3,
    why:
      'A classical theorem in exactly the repo\'s existing idiom - a named hypothesis (Euler-Lotka) plus a ' +
      'monotonicity conclusion plus an easy non-vacuity witness - that gives the registry an ' +
      'age-structured demographic primitive it entirely lacks. It is third rather than first because ' +
      'Hamilton\'s result has not been in doubt since 1966, so the epistemic gain is nil and the gain is ' +
      'structural. There is one genuine piece of interest: the folk statement ("the force of selection ' +
      'declines with age") is STRONGER than the theorem, which needs a restriction on age-specific ' +
      'fecundity, and formalising it would expose that. A law weaker than its English gloss is the defect ' +
      'the mutation benchmark says nothing currently catches.',
    effort:
      'medium - Euler-Lotka as a structure over a Finset of ages, then a monotonicity proof in the ' +
      'discounting factor. Real-analysis-light but index-heavy.',
    lean_sketch_uncompiled: [
      '-- Delphi/Senescence.lean (SKETCH, not compiled)',
      'open Finset',
      '',
      '/-- Euler-Lotka as a NAMED HYPOTHESIS: r is the intrinsic rate of increase for the',
      '    survivorship l and fecundity m over ages 0..n. Never proved here. -/',
      'structure EulerLotka (n : ℕ) (l m : ℕ → ℝ) (r : ℝ) : Prop where',
      '  l_pos    : ∀ x ≤ n, 0 < l x',
      '  m_nonneg : ∀ x, 0 ≤ m x',
      '  balance  : ∑ x ∈ range (n+1), Real.exp (-r * x) * l x * m x = 1',
      '',
      '/-- Hamilton\'s indicator: the sensitivity of r to a change in mortality acting at age a. -/',
      'noncomputable def forceOfSelection (n : ℕ) (l m : ℕ → ℝ) (r : ℝ) (a : ℕ) : ℝ :=',
      '  ∑ x ∈ Ico a (n+1), Real.exp (-r * x) * l x * m x',
      '',
      '/-- HAMILTON (1966): the force of selection against age-specific mortality is',
      '    non-increasing in the age at which it acts. -/',
      'theorem force_antitone {n : ℕ} {l m : ℕ → ℝ} {r : ℝ} (h : EulerLotka n l m r)',
      '    {a b : ℕ} (hab : a ≤ b) :',
      '    forceOfSelection n l m r b ≤ forceOfSelection n l m r a := by',
      '  -- Ico b (n+1) ⊆ Ico a (n+1) and every summand is nonneg (needs h.m_nonneg, h.l_pos)',
      '  sorry',
      '',
      '/-- The folk statement is STRONGER and needs a premise. Expected to FAIL without one -',
      '    which is the interesting part. -/',
      'theorem force_strictly_decreasing_FALSE_without_fecundity_restriction : True := trivial',
      '',
      'theorem eulerLotka_witness : ∃ n l m r, EulerLotka n l m r := ⟨1, fun _ => 1, fun _ => 1/2, 0, by sorry⟩',
    ].join('\n'),
    what_it_does_not_do:
      'It does not predict any lifespan, explain rate variation between taxa, or bear on negligible ' +
      'senescence. It bounds the force of selection, and a bound on a force is not a prediction of an ' +
      'outcome - a conflation the senescence literature makes often enough that stating the theorem ' +
      'precisely has some modest value on its own.',
  },
]);

export const NOT_RECOMMENDED_AND_WHY = Object.freeze({
  'levels-of-selection-partition':
    'The most tempting and the worst. The Price equation is a finite-sum identity that Mathlib would make ' +
    'short work of, and proving it would settle nothing, because the identity is not what anyone disputes. ' +
    'A Lean-checked Price equation in the registry would advertise progress on a contested question that ' +
    'had not been touched.',
  'elastic-vs-geometric-similarity':
    'Already in the registry at status "proposed" with no module, and it should stay there. The exponent ' +
    'l^(3/2) is contradicted by the measured mammalian data, so formalising it would lend a machine-checked ' +
    'frame to a false empirical claim.',
  'eigen-error-threshold':
    'Would pass the non-vacuity check with an invented parameter triple and still contain no biology. A ' +
    'good illustration that the registry\'s best automated safeguard does not protect against emptiness.',
  'somite-clock-scaling':
    'The formalisable content is a division. It would look like a developmental law and be arithmetic, ' +
    'conditioned on two premises (constant clock period, constant wavefront speed) that are false in every ' +
    'species measured.',
  'metabolic-scaling-exponent':
    'Graded `provable` and still not recommended: adjudicating the WBE derivation means formalising a ' +
    'branching-network model with pulsatile-flow impedance, which is a large piece of applied mathematics ' +
    'whose payoff is settling a dispute between two papers about an exponent that varies empirically ' +
    'anyway. Worth doing by someone; not worth doing third.',
});
