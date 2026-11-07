// What the dev log means when it says "62 laws, 48 with theorems" - read off the registry, law by law.
//
// ============================== THE QUESTION THIS ANSWERS ==============================
// The lead asked: "what are 'molecular biology' lean laws?" The dev log's own phrasing invites the
// question and then refuses to answer it: "62 laws, 48 with theorems" names a count and no content.
// So this module classifies every one of the 62 files in lean/registry/laws/ into a domain a biologist
// would recognise, walks six of them through in full, and states what the registry actually is.
//
// ============================== THE ANSWER, STATED FIRST ==============================
// There are TWO molecular-biology laws in a registry of 62, and ONE of them carries a Lean theorem.
//
//   * `genotype-genetic-code` (accepted, theorem, kernel-decided instances) - the standard code as a
//     64-codon table, and the minimum number of nucleotide substitutions between codons for two amino
//     acids. This one is molecular biology in the ordinary sense: codons, nucleotides, missense.
//   * `gene-regulatory-dynamics` (class `gap`, status `proposed`) - "how a gene edit changes a structure
//     quantitatively". No module, no theorem, no non-vacuity witness. It is a placeholder naming the
//     thing nobody has formalised.
//
// That is 1 theorem-carrying molecular-biology law out of 48 theorem-carrying laws: 2.1 %. The honest
// answer to "what are the molecular biology lean laws" is "there is one, and it is about the genetic
// code table". Everything else the registry calls a law is about whole organisms, populations, or the
// project's own bookkeeping. See THE_HONEST_SHAPE.
//
// This is not a complaint about the registry. A registry assembled to adjudicate "could this designed
// animal exist and could it fly" will fill up with mass, power, oxygen, stress and allometry, because
// those are the quantities such a question turns on. It is a complaint about the dev log's sentence,
// which lets a reader assume breadth the registry does not have.
//
// ============================== WHAT IS DELIBERATELY NOT HERE ==============================
// Two law ids are never written in this source. Their identifiers double as claim ids whose inventory
// organisms fall inside the frozen evaluation holdout, and the leak gate scans source text, so writing
// them would disclose the held-out clade. They are filled from the registry AT RUNTIME, exactly as
// `benchmarks/design-hard-negatives/laws.mjs` does it, and their statements are not quoted. Their
// domain assignment does not depend on the taxon: both are size-scaling arguments comparing two
// power-law exponents, which is the same reason every other Thompson scaling entry is where it is.
//
// Read-only: nothing in this file writes to lean/, which is another thread's folder.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
export const REGISTRY_DIR = path.join(ROOT, 'lean/registry/laws');

// ---------------------------------------------------------------- the registry, read not assumed

/** Every law file keyed by law_id. Read-only. */
export function loadRegistry(dir = REGISTRY_DIR) {
  const out = new Map();
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    out.set(j.law_id, j);
  }
  return out;
}

/**
 * A law "has a theorem" only when the registry names BOTH a Lean module and a theorem inside it.
 * A module with a `structure` and no theorem (a named hypothesis), a `gap` with nothing at all, and a
 * bare empirical row all count as no-theorem. This is the same predicate the benchmark file uses, and
 * it is the one that produces the dev log's 48.
 *
 * It says nothing about whether the named theorem was checked, nor whether it says what the English says.
 */
export const hasTheorem = law => !!(law && law.lean_ref && law.lean_ref.module && law.lean_ref.theorem);

/** A law's Lean file on disk, or null when the registry names no module. */
export const leanFilePath = law =>
  law && law.lean_ref && law.lean_ref.module ? path.join(ROOT, law.lean_ref.module) : null;

// ---------------------------------------------------------------- the domains

/**
 * The nine domains, each with what it covers HERE - the boundary actually used below, not a textbook
 * definition. Where a call was debatable the domain says so, because an unstated boundary is how a
 * classification gets to report whatever its author wanted.
 */
export const DOMAIN_DEFS = Object.freeze({
  'molecular-biology': {
    covers:
      'the molecules of heredity and their immediate chemistry: nucleotides, codons, transcripts, ' +
      'proteins, binding, transcription and translation. A law is here only if the quantity it ' +
      'constrains is molecular. A law about an allele FREQUENCY is population genetics, not this.',
    boundary_note:
      'This is the strict reading and it is the one that makes the count small. A loose reading that ' +
      'counted anything with the word "gene" in it would sweep in the whole genotype family and the ' +
      'molecular clock, and would report a breadth the registry does not have.',
  },
  'population-genetics': {
    covers:
      'allele frequencies, fixation, drift, mutation-selection balance, heterozygosity, substitution ' +
      'rates and waiting times, linked variation. The subject is a population of gene copies.',
    boundary_note:
      'The molecular clock (`kimura-substitution-rate`) sits here, not in molecular biology: its ' +
      'content is that the fixation probability 1/M cancels the M copies, which is a statement about a ' +
      'Markov chain on gene copies and mentions no molecule.',
  },
  'evolutionary-theory': {
    covers:
      'the logic of adaptation: evolutionarily stable strategies, invasion criteria, sex allocation, ' +
      'inclusive fitness, the cost of sex. A fitness argument whose conclusion is about which strategy ' +
      'persists rather than about a gene frequency trajectory.',
    boundary_note:
      'The split from population-genetics is by what the conclusion is about. Hawk-Dove concludes that ' +
      'a mixture is uninvadable; hitchhiking concludes how much variation is left. Reasonable people ' +
      'would draw this line elsewhere, which is why ASSIGNMENTS is exported.',
  },
  biomechanics: {
    covers:
      'forces, materials and lifting surfaces on a single animal at a single size: lift, drag, glide, ' +
      'climb, breaking load, bending stress, wing loading, and the morphometry of the surfaces that ' +
      'carry those loads.',
    boundary_note:
      'A law relating TWO sizes is scaling-allometry even when its subject is mechanical, because the ' +
      'content is the exponent, not the force.',
  },
  'scaling-allometry': {
    covers:
      'how a quantity changes with size: power laws, log-log exponents, the cube law, isometry and its ' +
      'failures, elastic similarity, speed as the square root of length.',
    boundary_note: 'Every entry here is a statement relating two specimens or two sizes. One specimen has no exponent.',
  },
  'physiology-metabolism': {
    covers:
      'oxygen delivery and its conversion into work: the Fick chain, aerobic ceilings, oxycaloric ' +
      'equivalents, muscular efficiency, energy budgets, temperature coefficients of rate, and vessel ' +
      'wall limits.',
    boundary_note:
      '`physiology-laplace` is a stress law and could be called biomechanics; it is here because its ' +
      'subject is a pressurised vessel and the registry levels it as physiology.',
  },
  development: {
    covers:
      'ontogeny and pattern formation: growth curves, developmental staging and precursor ordering, ' +
      'reaction-diffusion instability and the wavelength it selects, and whether a phenotype can be ' +
      'scored before the animal dies.',
    boundary_note:
      'The two Turing entries are here rather than in molecular biology on purpose. Their variables are ' +
      'diffusivities and Jacobian entries of an unnamed two-component system; no morphogen is identified, ' +
      'and the module says so explicitly ("Nor does it establish that any developmental system in any ' +
      'organism is a two-morphogen reaction-diffusion system").',
  },
  ecology: {
    covers:
      'the envelope the external medium allows: depth and pressure, temperature window, current speed, ' +
      'wind, altitude. Where the animal can be and move, given what is outside it.',
    boundary_note:
      'This is environmental physiology, not community ecology. There is not one law in this registry ' +
      'about competition, predation, population dynamics in a community, or a food web. If you came ' +
      'looking for ecology in the usual sense, the honest answer is zero.',
  },
  'ontology-bookkeeping': {
    covers:
      'the project\'s own rules about how it records things: graph well-formedness on ontology terms, ' +
      'what may be derived from what in the genotype map, and sanity bounds on committed numbers.',
    boundary_note:
      'These have no physical or biological content. They are true of the bookkeeping, and that is ' +
      'their whole job. Calling them "laws" in the same list as the cube law is the registry\'s single ' +
      'most misleading habit.',
  },
});

export const DOMAIN_NAMES = Object.freeze(Object.keys(DOMAIN_DEFS));

/**
 * One row per law in the registry, giving the domain and why. 60 rows are written here; the remaining
 * two take their law_id from the registry at runtime (see WITHHELD_SLOTS and the header).
 */
const ASSIGNED = [
  // --- molecular-biology (2) -------------------------------------------------------------------
  { law_id: 'genotype-genetic-code', domain: 'molecular-biology', why: 'the standard code as a 64-codon table; the bound is a count of nucleotide substitutions between codons' },
  { law_id: 'gene-regulatory-dynamics', domain: 'molecular-biology', why: 'how a gene edit changes a structure quantitatively - a named gap, no module, no theorem, no witness' },

  // --- population-genetics (9) ----------------------------------------------------------------
  { law_id: 'favored-fixation-lower-bound', domain: 'population-genetics', why: 'fixation probability at least i/M in an absorbing chain on gene copies' },
  { law_id: 'fisher-ftns', domain: 'population-genetics', why: 'rate of increase in mean fitness equals the additive genetic variance in fitness' },
  { law_id: 'fisher-kpp-speed', domain: 'population-genetics', why: 'the minimum spreading speed of an advancing allele, c^2 = 4sD' },
  { law_id: 'genotype-substitution-time', domain: 'population-genetics', why: 'expected waiting time for N substitutions at rate M mu u' },
  { law_id: 'haldane-cost-of-selection', domain: 'population-genetics', why: 'reproductive excess and cost per substitution bound the number of substitutions in T generations' },
  { law_id: 'kimura-fixation-probability', domain: 'population-genetics', why: 'fixation probability from initial frequency, selective advantage and effective size' },
  { law_id: 'kimura-heterozygosity', domain: 'population-genetics', why: 'infinite-alleles equilibrium heterozygosity in Ne times mu' },
  { law_id: 'kimura-substitution-rate', domain: 'population-genetics', why: 'the molecular clock: substitution rate equals mutation rate because 1/M cancels M' },
  { law_id: 'maynardsmith-hitchhiking', domain: 'population-genetics', why: 'relative heterozygosity left at a linked neutral site after a sweep' },

  // --- evolutionary-theory (4) ----------------------------------------------------------------
  { law_id: 'fisher-sex-ratio', domain: 'evolutionary-theory', why: 'no sex allocation is uninvadable unless investment in the two sexes is equal (Shaw-Mohler)' },
  { law_id: 'hamilton-rule', domain: 'evolutionary-theory', why: 'the sign of the change in a social trait is the sign of rb - c' },
  { law_id: 'maynardsmith-hawk-dove', domain: 'evolutionary-theory', why: 'an escalation probability invaded from neither side, and its cost to the population' },
  { law_id: 'maynardsmith-twofold-cost', domain: 'evolutionary-theory', why: 'an asexual mutant leaves twice the grandchildren, so sex needs a compensating advantage' },

  // --- biomechanics (9) -----------------------------------------------------------------------
  { law_id: 'E5', domain: 'biomechanics', why: 'a measured band on the length of the lifting fin over standard length' },
  { law_id: 'aspect-ratio-induced-drag', domain: 'biomechanics', why: 'induced drag falls with aspect ratio - a gap, a direction with no bound' },
  { law_id: 'disc-flying-fish-fin-ratio-gap', domain: 'biomechanics', why: 'a non-overlap in lifting-fin length between two groups; machine-proposed, no theorem' },
  { law_id: 'disc-measured-wing-loading-band', domain: 'biomechanics', why: 'weight over lifting area in N/m^2 across four measured specimens; no theorem' },
  { law_id: 'fin-length-ratio', domain: 'biomechanics', why: 'what sets lifting-fin length relative to body length - an open question, not a constraint' },
  { law_id: 'flight-climb-glide-law', domain: 'biomechanics', why: 'climb rate from excess power, and glide range from height times best lift-to-drag' },
  { law_id: 'scaling-bending-law', domain: 'biomechanics', why: 'maximum bending stress is the moment over the section modulus' },
  { law_id: 'scaling-strength-law', domain: 'biomechanics', why: 'breaking load is the breaking stress times the cross-section' },
  { law_id: 'taxiing-thrust', domain: 'biomechanics', why: 'thrust from the caudal fin on the water surface - a gap' },

  // --- scaling-allometry (12, two of them filled at runtime; 10 written) ----------------------
  { law_id: 'E1', domain: 'scaling-allometry', why: 'three within-species log-log exponents, and the finding that isometry fails' },
  { law_id: 'E2', domain: 'scaling-allometry', why: 'a band on the fitted mass exponent b, used as a weight ratio between two lengths' },
  { law_id: 'disc-heterurus-mass-exponent', domain: 'scaling-allometry', why: 'an OLS log-log exponent of mass on length within one species; contested' },
  { law_id: 'disc-pectoral-length-allometry', domain: 'scaling-allometry', why: 'an OLS log-log exponent of fin length on standard length across 49 specimens' },
  { law_id: 'elastic-similarity', domain: 'scaling-allometry', why: 'bones thicken as the 3/2 power of length rather than isometrically - a gap' },
  { law_id: 'flight-allometry-law', domain: 'scaling-allometry', why: 'power laws compose: ratios, log-log exponents, and the exponent of a quotient' },
  { law_id: 'scaling-area-law', domain: 'scaling-allometry', why: 'an area scales as the square of the linear dimension in an isometric family' },
  { law_id: 'thompson1917-ch02-10', domain: 'scaling-allometry', why: 'velocity tends to vary as the square root of linear dimension, by three independent routes' },
  { law_id: 'thompson1917-ch03-07', domain: 'scaling-allometry', why: 'weight tends to vary as the cube of linear dimensions during growth' },
  { law_id: 'walking-pendulum-speed', domain: 'scaling-allometry', why: 'walking speed as the square root of leg length, the pendulum route - a gap' },

  // --- physiology-metabolism (9) --------------------------------------------------------------
  { law_id: 'E3', domain: 'physiology-metabolism', why: 'measured bounds on muscular efficiency, oxycaloric equivalent and O2 delivery, giving a power ceiling in watts' },
  { law_id: 'E4', domain: 'physiology-metabolism', why: 'gills take up no oxygen in air, so power out of water is paid from a stored O2 budget' },
  { law_id: 'aerobic-power-bound', domain: 'physiology-metabolism', why: 'sustained mechanical power is at most efficiency times the Fick oxygen delivery' },
  { law_id: 'fick-principle', domain: 'physiology-metabolism', why: 'oxygen delivered equals cardiac output times the arteriovenous difference - a named hypothesis, a definition in Lean, no theorem' },
  { law_id: 'gill-o2-uptake', domain: 'physiology-metabolism', why: 'arterial O2 as a function of water O2, gill area and ventilation - a gap' },
  { law_id: 'muscle-power-premise', domain: 'physiology-metabolism', why: 'power available equals muscle fraction times mass-specific power times mass; retired, no theorem' },
  { law_id: 'perturb-energy-balance', domain: 'physiology-metabolism', why: 'a daily energy budget: intake below respiration plus activity means mass loss' },
  { law_id: 'physiology-laplace', domain: 'physiology-metabolism', why: 'wall stress in a thin-walled vessel limits the pressure it can hold' },
  { law_id: 'physiology-q10', domain: 'physiology-metabolism', why: 'a rate ratio between two temperatures is Q10 to the difference over ten' },

  // --- development (6) ------------------------------------------------------------------------
  { law_id: 'E7', domain: 'development', why: 'a phenotype cannot be scored in a living animal that died before the scoring stage' },
  { law_id: 'E8', domain: 'development', why: 'a part cannot appear before its precursor; retired, superseded by genotype-developmental-ordering' },
  { law_id: 'development-growth-asymptote', domain: 'development', why: 'a von Bertalanffy grower stays strictly below its asymptotic length, and K alone sets the shape' },
  { law_id: 'genotype-developmental-ordering', domain: 'development', why: 'every develops_from edge goes strictly later in stage, so the relation is acyclic' },
  { law_id: 'turing-ddi', domain: 'development', why: 'diffusion-driven instability exists under Turing\'s inequality, and equal diffusivities cannot produce it' },
  { law_id: 'turing-wavelength', domain: 'development', why: 'the onset wavenumber is fixed by the diffusivities and det J alone, so tissue size cannot enter it' },

  // --- ecology (7) ---------------------------------------------------------------------------
  { law_id: 'altitude-coupling', domain: 'ecology', why: 'demand rises and aerobic supply falls with height together, so the flyable heights form an interval from the ground up' },
  { law_id: 'perturb-current', domain: 'ecology', why: 'no holding station in a current above the critical swimming speed or the aerobic drag bound' },
  { law_id: 'perturb-depth-cap', domain: 'ecology', why: 'an isosmotic depth cap from the osmolyte hypothesis; contested' },
  { law_id: 'perturb-isa-vmin', domain: 'ecology', why: 'minimum flight speed rises with height because ISA air density falls' },
  { law_id: 'perturb-pressure', domain: 'ecology', why: 'Boyle\'s law on a closed swim bladder under the pressure of a water column' },
  { law_id: 'perturb-thermal', domain: 'ecology', why: 'no sustained power outside the thermal tolerance window, and a Q10 ceiling inside it' },
  { law_id: 'perturb-wind-glide', domain: 'ecology', why: 'ground range of a steady glide in an along-track wind' },

  // --- ontology-bookkeeping (4) --------------------------------------------------------------
  { law_id: 'E6', domain: 'ontology-bookkeeping', why: 'a rule about how rows of the genotype map may be derived: "required for" is never propagated down part_of' },
  { law_id: 'blueprint-well-formedness', domain: 'ontology-bookkeeping', why: 'a finite graph of ontology terms is acyclic and rooted when a Boolean checker accepts it' },
  { law_id: 'genotype-pleiotropy-closure', domain: 'ontology-bookkeeping', why: 'a list-inclusion check: every node the map links to an edited gene must appear among the changed nodes' },
  { law_id: 'test-loop-only-density-sanity', domain: 'ontology-bookkeeping', why: 'a sanity bound on the bulk density a design\'s committed numbers imply; retired, test-loop only, no module' },
];

/**
 * The two rows whose law_id is filled from the registry at runtime. Both are Thompson scaling entries:
 * a comparison of two power-law exponents across two sizes, which is why they are scaling-allometry and
 * not biomechanics. No statement of theirs is quoted anywhere in this file.
 */
const WITHHELD_SLOTS = [
  { domain: 'scaling-allometry', why: 'id and statement withheld under the frozen holdout; a size-scaling argument comparing two power-law exponents' },
  { domain: 'scaling-allometry', why: 'id and statement withheld under the frozen holdout; the size limit that the same exponent comparison implies' },
];

/** Every law, with its domain. Withheld rows carry `withheld: true` and a runtime-filled law_id. */
export const ASSIGNMENTS = Object.freeze((() => {
  const listed = new Set(ASSIGNED.map(r => r.law_id));
  let missing = [];
  try { missing = [...loadRegistry().keys()].filter(id => !listed.has(id)).sort(); } catch { missing = []; }
  const filled = missing.map((law_id, i) => ({ law_id, withheld: true, ...(WITHHELD_SLOTS[i] ?? WITHHELD_SLOTS[0]) }));
  return [...ASSIGNED, ...filled];
})());

/** Redacted view for anything that leaves this process: a withheld id must not reach a file or a log. */
export const publicAssignments = () =>
  ASSIGNMENTS.map(r => (r.withheld ? { ...r, law_id: 'withheld-under-holdout' } : r));

// ---------------------------------------------------------------- the distribution

/**
 * The real distribution, counted off the registry. Every domain appears whether or not it has anything
 * in it, so the shape of the registry is visible rather than inferred from a list of non-empty labels.
 */
export const DOMAINS = Object.freeze((() => {
  let registry;
  try { registry = loadRegistry(); } catch { registry = new Map(); }
  const out = {};
  for (const name of DOMAIN_NAMES) {
    const rows = ASSIGNMENTS.filter(r => r.domain === name);
    const withThm = rows.filter(r => hasTheorem(registry.get(r.law_id)));
    out[name] = Object.freeze({
      covers: DOMAIN_DEFS[name].covers,
      boundary_note: DOMAIN_DEFS[name].boundary_note,
      laws: rows.length,
      with_a_lean_theorem: withThm.length,
      without_a_lean_theorem: rows.length - withThm.length,
      share_of_registry: registry.size ? Number((rows.length / registry.size).toFixed(4)) : null,
      // withheld ids are omitted, not redacted in place, so the list cannot be used to count them
      law_ids: Object.freeze(rows.filter(r => !r.withheld).map(r => r.law_id)),
      law_ids_withheld: rows.filter(r => r.withheld).length,
    });
  }
  return out;
})());

/** Count the classification against the registry, so the denominator is never taken on trust. */
export function census(registry = loadRegistry()) {
  const seen = new Set(ASSIGNMENTS.map(r => r.law_id));
  const perDomain = {};
  let assignedTotal = 0, theoremTotal = 0;
  for (const name of DOMAIN_NAMES) {
    perDomain[name] = { laws: DOMAINS[name].laws, with_a_lean_theorem: DOMAINS[name].with_a_lean_theorem };
    assignedTotal += DOMAINS[name].laws;
    theoremTotal += DOMAINS[name].with_a_lean_theorem;
  }
  return {
    laws_in_registry: registry.size,
    rows_classified: ASSIGNMENTS.length,
    domain_counts_sum_to: assignedTotal,
    laws_not_classified: [...registry.keys()].filter(id => !seen.has(id)),
    rows_with_no_law: ASSIGNMENTS.filter(r => !registry.has(r.law_id)).length,
    theorem_carrying_in_registry: [...registry.values()].filter(hasTheorem).length,
    domain_theorem_counts_sum_to: theoremTotal,
    molecular_biology_laws: DOMAINS['molecular-biology'].laws,
    molecular_biology_laws_with_a_theorem: DOMAINS['molecular-biology'].with_a_lean_theorem,
    per_domain: perDomain,
  };
}

// ---------------------------------------------------------------- six laws, worked through

/**
 * Six laws spanning six of the nine domains, each walked through for a reader who knows biology but
 * not Lean. `the_lean_statement` is copied verbatim from the file the registry names, which is what
 * test-laws.mjs checks: a paraphrase of a theorem is how a registry comes to claim more than it proved.
 *
 * Numbers in `a_concrete_instance` are either taken from the registry (and then said to be) or are
 * stand-ins chosen to make the arithmetic checkable (and then said to be). None is presented as a
 * measurement it is not.
 */
export const WORKED = Object.freeze([
  {
    law_id: 'genotype-genetic-code',
    domain: 'molecular-biology',
    label: 'A claimed amino-acid change is impossible below the code distance',
    status: 'accepted',
    plain_english:
      'You cannot change one amino acid into another with fewer DNA letter changes than the genetic ' +
      'code requires, so a claim that one mutation did a job the code needs two for is impossible.',
    the_lean_statement: `theorem claimed_substitutions_rules_out {a b : AminoAcid} {n : ℕ} (h : n < minSubst a b) :
    ¬ ∃ c d : Codon, code c = a ∧ code d = b ∧ hamming c d ≤ n := by`,
    lean_file: 'lean/Delphi/Genotype.lean',
    what_the_symbols_mean: {
      'a b : AminoAcid': 'the amino acid you start from and the one you claim to reach - two of the twenty, or Stop.',
      '{n : ℕ}': 'the number of single-nucleotide substitutions the claim says it took. A natural number, so zero or more.',
      'minSubst a b': 'the smallest Hamming distance between any codon for a and any codon for b, computed by folding `min` over the whole 64-codon table. Not an estimate - a computation the Lean kernel can run.',
      'Codon': 'a triple of nucleotides. `code c` is the amino acid that codon c specifies under the standard code, carried in the file as a 64-entry table.',
      'hamming c d': 'how many of the three positions differ between codon c and codon d: 0, 1, 2 or 3.',
      '¬ ∃ c d : Codon, ...': 'there is NO pair of codons, one for a and one for b, that differ in at most n positions. The claim has no witness at all, not merely no likely one.',
      '(h : n < minSubst a b)': 'the hypothesis, and the only one. Supply a claim whose substitution count is below the code distance and the impossibility follows.',
    },
    a_concrete_instance:
      'Met to Trp. Methionine has exactly 1 codon (AUG) and tryptophan exactly 1 (UGG), so there is only ' +
      'one pair to compare: A-U-G against U-G-G differs at position 1 (A vs U) and position 2 (U vs G), ' +
      'and agrees at position 3 (G vs G). Hamming distance 2, and with one codon each there is no ' +
      'shorter route - the file proves `minSubst Met Trp = 2` by `decide +kernel`, i.e. the Lean kernel ' +
      'evaluated the fold over all 64 codons rather than taking anyone\'s word for it. A claim of n = 1 ' +
      'substitution therefore satisfies 1 < 2 and is ruled out. ' +
      'Contrast Phe to Leu, where the file proves `minSubst Phe Leu = 1` (UUU to UUA changes position 3 ' +
      'only): the slc43a2a F326L substitution of Daane et al. 2021 is 1 nucleotide away, so this law ' +
      'does not object to it. Trp to Stop is also 1 (UGG to UGA).',
    what_would_refute_it:
      'Exhibit a codon pair below the stated distance - which means showing the 64-codon table in the ' +
      'file is not the standard code, since the bound is computed from that table and nothing else. ' +
      'Outside the formal system: a system using a recoded or non-standard genetic code (selenocysteine ' +
      'readthrough, ciliate stop reassignment, an engineered orthogonal code) is a system this table ' +
      'does not describe, and the law has nothing to say there.',
    what_it_does_NOT_say:
      'It does not say the change IS possible when n is at least minSubst. It supplies no mechanism, no ' +
      'mutation rate, no probability and no selective path: a two-substitution route passes through an ' +
      'intermediate codon that encodes some third amino acid, and that intermediate may be lethal, so ' +
      '"two substitutions suffice" is a statement about the code table and not about any organism. It ' +
      'also says nothing about whether the amino-acid change has the phenotypic effect the claim ' +
      'attributes to it - the law constrains the arithmetic of the substitution, not its consequence.',
    has_a_theorem: true,
    has_a_non_vacuity_witness: true,
  },

  {
    law_id: 'kimura-substitution-rate',
    domain: 'population-genetics',
    label: 'Neutral substitution rate equals the mutation rate',
    status: 'accepted',
    plain_english:
      'For mutations that selection cannot see, the long-run rate at which new variants take over a ' +
      'population equals the rate at which they arise - the size of the population cancels out entirely.',
    the_lean_statement: `theorem neutral_substitution_rate (M : ℕ) (hM : 0 < M) (μ : ℝ) :
    substitutionRate M μ ((wrightFisher M hM).fixationProbability (oneCopy M hM)) = μ := by`,
    lean_file: 'lean/Delphi/Kimura.lean',
    what_the_symbols_mean: {
      '(M : ℕ)': 'the number of gene copies in the population. For a diploid population of N individuals, M = 2N.',
      '(hM : 0 < M)': 'the population is not empty. The only side condition, and it is there because 1/M appears.',
      '(μ : ℝ)': 'the mutation rate per gene copy per generation. Left completely free - any real number, including a negative one, which is a mild sloppiness the statement inherits from being an identity.',
      'substitutionRate M μ u': 'the product M * μ * u: new mutants arrive at rate M*μ per generation and a fraction u of them eventually take over.',
      'wrightFisher M hM': 'the Wright-Fisher Markov chain on 0..M copies - each generation resamples M copies binomially from the current frequency.',
      'fixationProbability (oneCopy M hM)': 'the chance that a lineage starting from a single copy eventually occupies all M. For this chain, with no selection, it is exactly 1/M.',
      '= μ': 'the conclusion. M * μ * (1/M) = μ: the M that makes mutants arrive faster in a big population is the same M that makes each one less likely to win.',
    },
    a_concrete_instance:
      'Take μ = 1e-8 per copy per generation (a round stand-in, not a measurement). A diploid population ' +
      'of N = 10000 has M = 20000 copies: mutants arrive at 20000 * 1e-8 = 2e-4 per generation, each ' +
      'fixes with probability 1/20000 = 5e-5, and the substitution rate is 2e-4 * 5e-5 = 1e-8. Now shrink ' +
      'the population a thousandfold to N = 10, M = 20: arrivals 20 * 1e-8 = 2e-7 per generation, ' +
      'fixation probability 1/20 = 0.05, rate 2e-7 * 0.05 = 1e-8. The same 1e-8, from populations 1000 ' +
      'times apart in size. That exact cancellation is the whole content, and it is why the clock is a clock.',
    what_would_refute_it:
      'Inside the model: show that a single neutral copy in this chain fixes with probability other than ' +
      '1/M, which would break the martingale property the proof rests on. Outside it: a reproduction ' +
      'scheme that is not Wright-Fisher - sweepstakes reproduction with a heavy-tailed offspring ' +
      'distribution, which gives multiple-merger coalescents and a fixation probability that is not 1/M - ' +
      'leaves the rate size-dependent. Empirically: a strictly neutral locus whose substitution rate ' +
      'tracks effective population size.',
    what_it_does_NOT_say:
      'It does not say that real sequence divergence is clocklike. Three things it leaves wide open ' +
      'routinely break the clock in data: selection (the theorem is about neutral mutations only, which ' +
      'is an assumption about the mutations and not a derivation), variation in the mutation rate itself ' +
      '(μ is a constant here), and generation time (the rate is per GENERATION, so two lineages with the ' +
      'same per-generation μ and different generation lengths diverge at different rates per year, which ' +
      'is most of the generation-time effect in the literature). Nor does it say anything about the ' +
      'variance of the substitution process - a Poisson clock and an overdispersed one both satisfy it.',
    has_a_theorem: true,
    has_a_non_vacuity_witness: true,
  },

  {
    law_id: 'scaling-strength-law',
    domain: 'biomechanics',
    label: 'Strength scales as L^2: the missing half of Galileo\'s square-cube argument',
    status: 'accepted',
    plain_english:
      'Make an animal twice as long without changing its shape and its load-bearing parts get four times ' +
      'stronger while the body gets eight times heavier, so its margin against breaking is halved.',
    the_lean_statement: `theorem breakLoad_ratio {A : ℝ → ℝ} {k₃ σ : ℝ} (hA : AreaLaw A k₃) (hσ : 0 < σ) {L₁ L₂ : ℝ} (h₁ : 0 < L₁)
    (h₂ : 0 < L₂) : breakLoad σ A L₂ / breakLoad σ A L₁ = (L₂ / L₁) ^ 2 := by`,
    lean_file: 'lean/Delphi/Scaling.lean',
    what_the_symbols_mean: {
      '{A : ℝ → ℝ}': 'the load-bearing cross-section as a function of the animal\'s linear size. A function, not a number: the law is about a FAMILY of animals of different sizes and the same shape.',
      '(hA : AreaLaw A k₃)': 'the geometric-similarity hypothesis, defined in the file as `0 < k₃ ∧ ∀ L, 0 < L → A L = k₃ * L ^ 2`. Cross-section is a fixed constant times length squared. This is the assumption doing all the work.',
      '{σ : ℝ} (hσ : 0 < σ)': 'the breaking stress of the material, in pascals, the same at both sizes. Positive.',
      'breakLoad σ A L': 'defined in the file as `σ * A L` - the axial force at which the member fails: strength of the stuff times how much of it there is.',
      '{L₁ L₂ : ℝ} (h₁ h₂ : 0 < ...)': 'the two sizes being compared, both positive. The theorem is a RATIO statement; it needs two animals and says nothing about one.',
      '= (L₂ / L₁) ^ 2': 'the conclusion: breaking load goes as the square of the size ratio. Combined with the cube law for weight (`safetyFactor_eq` in the same file) the safety factor goes as 1/L.',
    },
    a_concrete_instance:
      'Two geometrically similar fish, 0.10 m and 0.20 m standard length. Take k₃ = 2.0e-3 m^2 per m^2, ' +
      'so the load-bearing section is 20 mm^2 at 0.10 m and 80 mm^2 at 0.20 m, and take σ = 100 MPa as a ' +
      'stand-in for mineralised tissue (a round figure, not a measurement from this project). Breaking ' +
      'load: 1.0e8 * 2.0e-5 = 2000 N at 0.10 m, and 1.0e8 * 8.0e-5 = 8000 N at 0.20 m. The ratio is ' +
      '8000/2000 = 4 = (0.20/0.10)^2, as the theorem says. Now the weight side: let the small fish mass ' +
      '10 g, so W = 0.098 N and the cube-law constant is k₁ = 0.098/1.0e-3 = 98 N/m^3; the big one masses ' +
      '80 g and weighs 0.784 N. Safety factors: 2000/0.098 = 20408 and 8000/0.784 = 10204. Exactly halved ' +
      'by a doubling of length, and both match the companion theorem\'s closed form σk₃/(k₁L): ' +
      '2.0e5/9.8 = 20408 and 2.0e5/19.6 = 10204.',
    what_would_refute_it:
      'Inside the model the theorem is unconditional given AreaLaw and σ > 0, so a refutation would have ' +
      'to be an arithmetic error. The refutable content is the hypothesis: measure breaking load across a ' +
      'real size series of one species and the same tissue, and if the log-log exponent is not 2 then ' +
      'either the sections are not isometric or σ varies with size, and the law does not apply to that ' +
      'series. The registry says as much in its own `assumed-2`: "real animals thicken bones with size".',
    what_it_does_NOT_say:
      'It does not say that large animals are weak, that there is a maximum body size, or that any real ' +
      'giant must collapse. Three separate reasons. First, real animals are not isometric - thickening ' +
      'bones faster than length is precisely how they escape this, and `elastic-similarity` is in the ' +
      'registry as the unformalised alternative. Second, the law assumes axial loading; the file\'s own ' +
      '`assumed-1` notes bending has the same exponent but a different constant, and for a lamina of ' +
      'constant thickness the companion bending law yields NO size limit at all. Third, and most easily ' +
      'forgotten, the registry\'s `assumed-3` says the law rules on nothing real: it adjudicates only a ' +
      'candidate design that has itself committed to isometry, one material and a safety factor.',
    has_a_theorem: true,
    has_a_non_vacuity_witness: true,
  },

  {
    law_id: 'aerobic-power-bound',
    domain: 'physiology-metabolism',
    label: 'Sustained mechanical power is bounded by oxygen delivery times efficiency',
    status: 'accepted',
    plain_english:
      'An animal can only keep doing as much mechanical work as the oxygen its blood delivers will pay ' +
      'for, so if staying airborne costs more than that, it cannot stay airborne by muscle power.',
    the_lean_statement: `theorem sustained_flight_requires {W v LD P η E Q Ca Cv : ℝ} (hη : 0 ≤ η) (hE : 0 ≤ E) (hQ : 0 ≤ Q) (hCv : 0 ≤ Cv)
    (hsus : P ≤ aerobicPower η E Q Ca Cv) (hflight : powerRequired W v LD ≤ P) :
    powerRequired W v LD ≤ η * E * Q * Ca :=`,
    lean_file: 'lean/Delphi/Flight.lean',
    what_the_symbols_mean: {
      'W': 'weight, in newtons. Not mass - the file works in forces.',
      'v': 'airspeed, in m/s.',
      'LD': 'the lift-to-drag ratio of the whole animal, dimensionless.',
      'powerRequired W v LD': 'defined in Scaling.lean as `W * v / LD` - the mechanical power to hold level flight at speed v. Watts.',
      'Q': 'cardiac output: volume of blood pumped per second, ml/s.',
      'Ca, Cv': 'oxygen content of arterial and venous blood, ml O2 per ml blood. Their difference is what the tissue actually extracted.',
      'E': 'the oxycaloric equivalent: joules of metabolic energy released per ml of O2 consumed.',
      'η': 'muscular efficiency - the fraction of metabolic power that leaves the muscle as mechanical work.',
      'aerobicPower η E Q Ca Cv': 'defined in the file as `η * E * Q * (Ca - Cv)`: the Fick chain read left to right. Blood flow, times oxygen extracted per unit blood, times energy per unit oxygen, times the fraction that becomes work.',
      '(hsus : P ≤ aerobicPower ...)': 'the sustainability hypothesis: the power actually produced is paid for aerobically. This is the clause that excludes bursts.',
      '(hflight : powerRequired W v LD ≤ P)': 'the animal is in fact flying at that speed on that power.',
      'conclusion': 'powerRequired ≤ η E Q Ca, with Cv dropped. Looser than the premise, because Ca - Cv ≤ Ca: you get a bound that needs no venous measurement.',
    },
    a_concrete_instance:
      'Real watts, taken from the registry\'s own E3 (accepted, v2.1.0, sourced to measured zebrafish ' +
      'MO2max and skeletal-muscle efficiency). Supply side: η ≤ 0.23, E ≤ 19.35 J/ml, and Q*Ca ≤ 0.0187 ' +
      'ml O2/s for a 0.06 kg teleost (1600 mg O2 per kg per hour). Multiply: 0.23 * 19.35 * 0.0187 = ' +
      '0.0832 W, which E3 records as a ceiling of at most 0.0833 W. Demand side, from E3\'s own ' +
      'observation: powered level flight at 10 m/s for that animal needs 1.346 W. So ' +
      '1.346 ≤ 0.0833 is false, by a factor of about 16, and the theorem\'s conclusion fails - which ' +
      'means one of its hypotheses must: this animal cannot hold powered level flight at 10 m/s on an ' +
      'aerobic supply. Note where the inequality bites: nothing here is an estimate of what the animal ' +
      'does, only a ceiling on what it could sustain.',
    what_would_refute_it:
      'Measure sustained mechanical power above η * E * Q * (Ca - Cv) in a genuine steady state - no ' +
      'change in oxygen stores, no lactate accumulation, no drop in pH - which would break either the ' +
      'Fick principle or η ≤ 1. Both are stated as hypotheses rather than proved (`fick-principle` is in ' +
      'the registry as a named hypothesis with no theorem at all), so the refutation lands on them and ' +
      'not on this theorem, whose own step from premise to conclusion is just Ca - Cv ≤ Ca.',
    what_it_does_NOT_say:
      'It does not say the animal cannot produce 1.346 W. It says it cannot SUSTAIN it aerobically; burst ' +
      'power from white-muscle glycogen is outside the hypothesis entirely, and the registry notes that ' +
      'is what the animal in question is understood to use. Nor does it bound the power of an unpowered ' +
      'glide, where the work comes from potential energy and not from metabolism - E3 records that this ' +
      'exact mistake was made, a realistic glide converted into a level-powered-flight requirement and ' +
      'then reported as a violation, and labels it an application error rather than a violation. Finally ' +
      'the bound is an upper bound and a loose one: dropping Cv throws away the oxygen the tissue did not ' +
      'extract, so η E Q Ca is not an estimate of the ceiling, it is above it.',
    has_a_theorem: true,
    has_a_non_vacuity_witness: true,
  },

  {
    law_id: 'turing-ddi',
    domain: 'development',
    label: 'Diffusion-driven instability exists, and equal diffusivities cannot produce it',
    status: 'candidate',
    plain_english:
      'Two chemicals that react with each other and spread through a tissue can turn a uniform state ' +
      'into a pattern, but only if one spreads faster than the other - equal spreading rates can never ' +
      'do it, whatever the chemistry.',
    the_lean_statement: `theorem turing_instability {du dv fu fv gu gv : ℝ} (h : TuringHyp du dv fu fv gu gv) :
    (∃ q : ℝ, 0 < q ∧ disp du dv fu fv gu gv q < 0) ∧ du ≠ dv := by`,
    lean_file: 'lean/registry/proposals/turing-ddi/law.lean',
    what_the_symbols_mean: {
      'du, dv': 'the diffusion coefficients of the two chemicals - how fast each spreads.',
      'fu, fv, gu, gv': 'the four partial derivatives of the two reaction rates with respect to the two concentrations, at the uniform steady state. The Jacobian: how each chemical\'s production responds to a small excess of each chemical.',
      'q': 'the SQUARED spatial wavenumber, k^2. A large q is a fine-grained pattern, a small q a coarse one. The file works in q rather than k so no square root enters the statement.',
      'disp du dv fu fv gu gv q': 'defined in the file as `du * dv * q ^ 2 - (dv * fu + du * gv) * q + (fu * gv - fv * gu)` - the determinant of J - qD. The uniform state is unstable to the mode q exactly when this is negative.',
      'TuringHyp': 'the named hypothesis, a structure with six fields: du > 0, dv > 0, trace fu + gv < 0, det fu*gv - fv*gu > 0 (so the state is stable with no diffusion), cross term dv*fu + du*gv > 0, and Turing\'s inequality 4*du*dv*det < (dv*fu + du*gv)^2.',
      '∃ q, 0 < q ∧ disp ... < 0': 'first conclusion: SOME pattern-sized mode grows. The proof names it: q = (dv*fu + du*gv) / (2*du*dv).',
      'du ≠ dv': 'second conclusion, and the interesting one - an impossibility. No system satisfying the hypothesis has equal diffusivities, so equal diffusivities rule out this route to patterning entirely.',
    },
    a_concrete_instance:
      'Pick du = 1, dv = 20 (a 20-fold difference in spreading rate), fu = 1, fv = -4, gu = 1, gv = -2. ' +
      'Check the six hypothesis fields: diffusivities positive; trace = 1 + (-2) = -1 < 0; determinant = ' +
      '(1)(-2) - (-4)(1) = 2 > 0, so without diffusion this state is stable and nothing happens; cross ' +
      'term = 20*1 + 1*(-2) = 18 > 0; Turing\'s inequality 4*1*20*2 = 160 < 18^2 = 324. All six hold, so ' +
      'the theorem applies. Its witness is q = 18/(2*1*20) = 0.45, and there ' +
      'disp = 1*20*0.45^2 - 18*0.45 + 2 = 4.05 - 8.10 + 2 = -2.05 < 0: that mode grows. A squared ' +
      'wavenumber of 0.45 is k = 0.671 per length unit, a wavelength of 2*pi/0.671 = 9.4 length units - ' +
      'so in a tissue 94 units across you would expect about 10 stripes. And du = 1 is not dv = 20, as ' +
      'the second conclusion requires; set dv = 1 and the cross term becomes 1 - 2 = -1 < 0, so the ' +
      'hypothesis fails and there is no instability to find.',
    what_would_refute_it:
      'The impossibility half is the sharp one: exhibit a two-component reaction-diffusion system with ' +
      'EQUAL diffusivities, a steady state stable in the absence of diffusion, and a growing spatial ' +
      'mode. That would contradict the theorem and so must contain an arithmetic error, a third ' +
      'component, advection, a growing domain, or a non-Fickian transport term - each of which is a ' +
      'system this hypothesis does not describe, and each of which does occur in real tissue.',
    what_it_does_NOT_say:
      'It does not say a pattern forms. This is LINEAR instability: a uniform state is shown not to be a ' +
      'resting place, and which pattern replaces it, whether it survives, and whether it is stripes or ' +
      'spots are nonlinear questions outside the hypothesis - the module states this itself. It does not ' +
      'say the wavelength above will be seen, since the fastest-growing linear mode need not be the one ' +
      'selected. And it does not say any real developmental system is a two-morphogen ' +
      'reaction-diffusion system: no chemical is named anywhere, du and dv are free reals, and the ' +
      'module\'s own closing line says the theorem establishes nothing about any organism. Reading this ' +
      'law as evidence that a particular stripe pattern is a Turing pattern is the overreach, and it is ' +
      'the one the formalisation most invites.',
    has_a_theorem: true,
    has_a_non_vacuity_witness: true,
  },

  {
    law_id: 'blueprint-well-formedness',
    domain: 'ontology-bookkeeping',
    label: 'An emitted anatomical blueprint graph is well-formed under its own rules',
    status: 'accepted',
    plain_english:
      'If an automatic check passes on a generated body-plan diagram, then the diagram really is ' +
      'coherent: nothing is a part of itself, every part traces up to the whole body, and no part is ' +
      'placed in an animal the ontology says cannot have it.',
    the_lean_statement:
      'theorem wellFormed_of_check (g : Graph α) (D : TaxonData α τ) (h : check g D = true) : WellFormed g D := by',
    lean_file: 'lean/Delphi/Blueprint.lean',
    what_the_symbols_mean: {
      'Graph α': 'a finite graph whose nodes are ontology terms of type α: a node list, a root (the whole body), a level for each node, and a list of part_of edges as (part, whole) pairs.',
      'level': 'a natural number per node: body 0, organ system 1, organ 2, tissue 3, cell 4. An ordinal depth - the module is explicit that the theorems use nothing about it except that edges strictly decrease it.',
      'TaxonData α τ': 'the taxon statements pinned alongside: in_taxon, stated_in_taxon and never_in_taxon claims on the terms, and the taxon the blueprint is for.',
      'check g D : Bool': 'one computable Boolean: every edge goes strictly down in level, every edge joins two nodes in the list, every non-root node has a whole, and no kept term carries a never_in_taxon for a taxon containing this one.',
      'WellFormed g D': 'the Prop the Boolean is sound for - a conjunction: levelsDown, closed, ACYCLIC (part_of is irreflexive on its transitive closure, so nothing is part of itself), ROOTED (every node reaches the body), and the taxon conditions.',
      '(h : check g D = true)': 'the only hypothesis. Because `check` is computable, a concrete blueprint discharges it by `decide` and the Lean kernel does the work, rather than a human asserting it.',
      ':= by': 'the proof unpacks the Boolean conjunction and feeds each half to the matching soundness lemma. The interesting step is `acyclic_of_levelsDown`: a strictly decreasing natural-number level along every edge is enough to forbid cycles.',
    },
    a_concrete_instance:
      'The emitted blueprint in lean/Delphi/Certificates/AFlyingFish.lean: 536 nodes and 674 part_of ' +
      'edges, with `aFlyingFish_check : check aFlyingFish aFlyingFishTaxon = true` proved by ' +
      '`decide +kernel`, from which `aFlyingFish_wellFormed` follows by this theorem applied to those ' +
      'literals. The levels resolve to 1 node at level 0, 13 at level 1, 67 at level 2, 198 at level 3 ' +
      'and 257 at level 4, also kernel-decided, and 1 + 13 + 67 + 198 + 257 = 536. A failing instance in ' +
      'the same directory shows what the check catches: a two-node graph with stages 29 and 30 and the ' +
      'edge (0, 1) makes the developmental variant of the checker evaluate to `false`, because 30 is not ' +
      'strictly below 29.',
    what_would_refute_it:
      'Find a graph where `check` returns true and one of the five conjuncts of WellFormed fails - which, ' +
      'given a kernel-checked proof, means finding an error in Lean. The refutable content lies ' +
      'elsewhere: that the DATA is right. The module\'s own "what is assumed" section says it assumes ' +
      'Uberon and the Cell Ontology are correct and that Ubergraph served their part_of, subClassOf, ' +
      'never_in_taxon and in_taxon statements correctly and completely on the retrieval date. A wrong ' +
      'part_of edge served by Ubergraph passes the check and is still wrong.',
    what_it_does_NOT_say:
      'It does not say the animal is anatomically possible, or that the blueprint describes a real or ' +
      'viable animal. It says a graph satisfies four graph properties and a taxon-label condition. It ' +
      'says nothing about size, shape, position or function: the graph has no coordinates and no ' +
      'measurements, and the module warns that `level` is an ordinal depth and nothing more. Reading ' +
      '"part_of edges go strictly down in level" as "a part is no larger than its whole" is an ' +
      'interpretation that this theorem does not license - `benchmarks/design-hard-negatives/laws.mjs` ' +
      'made exactly that substitution, derived thirteen size containments from it, and found SEVEN of ' +
      'the thirteen false of real fish, including "the caudal fin is no deeper than the body", which ' +
      '30 % of real fish break. The theorem was sound throughout; the reading was not.',
    has_a_theorem: true,
    has_a_non_vacuity_witness: true,
  },
]);

// ---------------------------------------------------------------- what this registry actually is

/**
 * Frozen. The lead's expectation, held up against the distribution above: confirmed on the main claim,
 * and sharpened on the second.
 */
export const THE_HONEST_SHAPE = Object.freeze({
  one_sentence:
    'It is a registry of physical and statistical constraints on WHOLE ORGANISMS - what a body of a ' +
    'given size, shape and oxygen supply can and cannot do - not a registry of molecular mechanisms; ' +
    'and the word "law" is doing at least five different jobs across its 62 entries.',

  the_expectation_was_right: {
    claim: 'physical and statistical constraints on whole organisms, not molecular mechanisms',
    verdict: 'CONFIRMED',
    how:
      'Group the 62 by what the constrained quantity is. 37 bind a whole-organism PHYSICAL quantity - ' +
      'mass, force, power, oxygen, stress, speed, area, length ratio, depth, temperature, pressure, ' +
      'air density (biomechanics 9, scaling-allometry 12, physiology-metabolism 9, ecology 7). 13 bind a ' +
      'POPULATION-STATISTICAL quantity - allele frequency, fixation probability, fitness variance, ' +
      'heterozygosity, substitution rate (population-genetics 9, evolutionary-theory 4). 6 are models of ' +
      'a developmental process. 4 are the project\'s own bookkeeping. 2 are molecular. ' +
      'So 50 of 62, or 81 %, are physical-or-statistical constraints on whole organisms, exactly as ' +
      'expected, and 2 of 62 are molecular.',
  },

  the_expectation_was_right_about_the_word_law_too: {
    claim: '"law" means different things in different entries',
    verdict: 'CONFIRMED - and there are five senses, not three',
    senses: Object.freeze([
      {
        sense: 'a theorem about a model',
        registry_class: 'theorem',
        count: 23,
        what_it_is:
          'A conclusion proved in Lean from stated premises. True of the model whether or not the model ' +
          'fits an animal. `scaling-strength-law` and `blueprint-well-formedness` are of this kind.',
      },
      {
        sense: 'a theorem from a NAMED HYPOTHESIS that is never proved',
        registry_class: 'theorem-from-hypothesis',
        count: 17,
        what_it_is:
          'The implication is proved; the antecedent is asserted and carried as a structure. ' +
          '`haldane-cost-of-selection` says so in its own label - "a hypothesis, not proved here". ' +
          '`turing-ddi` bundles six assumptions into `TuringHyp`. Quoting one of these as a proved law ' +
          'without its hypothesis is the single easiest way to misreport this registry, and the 17 ' +
          'entries of this class are 35 % of the 48 "with theorems".',
      },
      {
        sense: 'a measured empirical band',
        registry_class: 'empirical-observation',
        count: 11,
        what_it_is:
          'A range taken from data, with an n. `E5` bounds a fin ratio in [0.406, 0.823]; ' +
          '`disc-measured-wing-loading-band` reports 37.025 to 46.375 N/m^2 from n = 4. The Lean content ' +
          'is a structure holding the numbers plus a trivial consequence; the scientific content is the ' +
          'measurement, and it can be falsified by one more specimen.',
      },
      {
        sense: 'a project convention',
        registry_class: 'convention',
        count: 2,
        what_it_is:
          'A rule about the project\'s own records with no physical content: `E6` ("required for" is ' +
          'never propagated down part_of) and `test-loop-only-density-sanity` (retired, and labelled ' +
          'TEST-LOOP-ONLY in its own title). True by construction.',
      },
      {
        sense: 'a bare named hypothesis, no theorem at all',
        registry_class: 'named-hypothesis',
        count: 2,
        what_it_is:
          '`fick-principle` and `muscle-power-premise`. Each names a Lean module and a STRUCTURE or ' +
          'DEFINITION but no theorem, so neither counts toward the 48. `fick-principle` is the premise ' +
          'the whole physiology chain rests on, and it is an assumption.',
      },
      {
        sense: 'an unformalised gap - a label for work not done',
        registry_class: 'gap',
        count: 7,
        what_it_is:
          'No module, no theorem, no non-vacuity witness, often phrased as a question: `fin-length-ratio` ' +
          'is literally "what sets pectoral fin length relative to body length". These are honest ' +
          'placeholders, and they are also 7 of the 62 things the dev log calls laws.',
      },
    ]),
    check: 'class totals 23 + 17 + 11 + 2 + 2 + 7 = 62.',
  },

  what_the_48_and_the_14_are: Object.freeze({
    theorem_carrying: 48,
    not_theorem_carrying: 14,
    criterion: 'lean_ref names BOTH a module and a theorem inside it',
    the_14:
      '7 gaps (no module at all), 2 bare named hypotheses (module + structure, no theorem), 3 ' +
      'machine-proposed empirical observations whose proposal file holds a structure and no theorem, ' +
      '1 retired convention with no module, and 1 open question. The count 48 is a count of NAMED ' +
      'theorems, not of verified ones: nothing in the registry record says the named theorem was ' +
      'checked on the recorded commit, nor that it says what statement_en says. `evidence.faithfulness` ' +
      'is literally "not assessed" on entries that have the field at all.',
  }),

  statuses: Object.freeze({
    accepted: 36, candidate: 13, proposed: 7, contested: 3, retired: 3,
    note:
      'Three are CONTESTED (`disc-heterurus-mass-exponent`, `haldane-cost-of-selection`, ' +
      '`perturb-depth-cap`) and three RETIRED (`E8`, `muscle-power-premise`, ' +
      '`test-loop-only-density-sanity`) and all six are inside the 62. Any sentence of the form ' +
      '"the registry holds 62 laws" is counting withdrawn and disputed entries alongside accepted ones.',
  }),

  the_part_the_expectation_missed:
    'Two things the "physical constraints on whole organisms" summary understates. First, the ' +
    'biomechanical and physiological entries are almost all about ONE animal in ONE situation - ' +
    'flight, glide, station-holding, depth - and 20 of the 62 have `level: null`, so the registry ' +
    'does not even uniformly record what level of organisation a law is about. Second, the ecology ' +
    'domain is ecology only in the environmental-physiology sense: depth, temperature, current, wind, ' +
    'altitude. There is not one law in this registry about competition, predation, community ' +
    'structure or population dynamics in an ecosystem. "Ecology: 7" should not be read as ecology.',

  so_what_to_say_in_the_dev_log:
    'Replace "62 laws, 48 with theorems" with something that cannot be misread: "62 registry entries ' +
    'about whole-organism mechanics, physiology, allometry, population genetics and the project\'s own ' +
    'bookkeeping. 40 state a Lean theorem about a model, 17 of those only under an unproved named ' +
    'hypothesis. 11 are measured bands, 7 are unformalised gaps, 2 are conventions, 2 are bare ' +
    'hypotheses. Molecular biology: 1 entry with a theorem (the genetic code table) and 1 gap."',
});

// ---------------------------------------------------------------- the lead's actual question

/**
 * Three laws that would genuinely be molecular biology, could be stated formally in the same style as
 * the registry's existing entries, and would be useful to a project that adjudicates designed animals.
 *
 * Every citation below was looked up and confirmed in PubMed before being written here: the DOI, the
 * journal, the volume, the pages and the author list are from the record, not from memory. The third
 * candidate's named bound is the one the lead already identified (Berg-von Hippel), and it is real.
 */
export const WHAT_A_MOLECULAR_BIOLOGY_LAW_WOULD_LOOK_LIKE = Object.freeze([
  {
    proposed_law_id: 'codon-adaptation-expression-ceiling',
    name: 'Translational selection: a gene cannot be both highly expressed and codon-unadapted',
    domain: 'molecular-biology',
    why_it_belongs_here:
      'The project already edits genes and asserts phenotypic consequences (`gene-regulatory-dynamics`, ' +
      'the slc43a2a and kcnk5b levers). A design that claims strong expression of a transgene whose ' +
      'codons are badly matched to the host tRNA pool is making a claim this bound can refuse - which is ' +
      'exactly the shape of every other "rules out" law in the registry.',
    the_statement:
      'For a genome with tRNA gene copy numbers t, let w(c) be the tRNA-weighted availability of codon c ' +
      'and tAI(g) the geometric mean of w over the codons of gene g. Then for genes in that genome, ' +
      'elongation rate is nonincreasing as tAI falls, and at a fixed ribosome budget the steady-state ' +
      'protein output of a gene is bounded above by a nondecreasing function of tAI(g). Contrapositive, ' +
      'and this is the usable half: a claimed protein output above that bound is impossible without ' +
      'either more ribosomes, more mRNA, or recoded codons.',
    hypotheses_it_would_need: Object.freeze([
      'tRNA abundance is proportional to tRNA gene copy number (standard, and the weakest link - it is an approximation, well supported in fast-growing bacteria and shakier in vertebrates).',
      'Elongation, not initiation, is rate-limiting for the gene in question. Where initiation limits, codon usage barely moves output and the bound is vacuous.',
      'A fixed ribosome and tRNA pool - the bound is per-cell-state, not absolute.',
      'Wobble-pairing efficiencies as a fixed table of constants, the way the standard code table is fixed in `genotype-genetic-code`.',
    ]),
    provable_or_merely_statable:
      'MERELY STATABLE as a biological law; PROVABLE as a theorem-from-hypothesis in exactly the ' +
      'registry\'s existing style. The monotonicity of a geometric mean in its arguments, and the ' +
      'monotonicity of a steady-state ribosome-flux model in the slowest codon\'s dwell time, are both ' +
      'ordinary real analysis and would go through in Lean. What cannot be proved is the biology: that ' +
      'tAI predicts output in any particular organism is an empirical claim, so this would land as ' +
      'class `theorem-from-hypothesis` with the tRNA-proportionality assumption named and carried - the ' +
      'same construction as `turing-ddi`.',
    sources: Object.freeze([
      { cite: 'Gouy M, Gautier C (1982) Codon usage in bacteria: correlation with gene expressivity. Nucleic Acids Res 10(22):7055-74', doi: '10.1093/nar/10.22.7055', pmid: '6760125', verified: 'PubMed record fetched 2026-11-06', role: 'the original correlation between codon composition and expression level' },
      { cite: 'Sharp PM, Li WH (1987) The codon Adaptation Index - a measure of directional synonymous codon usage bias, and its potential applications. Nucleic Acids Res 15(3):1281-95', doi: '10.1093/nar/15.3.1281', pmid: '3547335', verified: 'PubMed record fetched 2026-11-06', role: 'CAI: the first index of the quantity the law would bound' },
      { cite: 'dos Reis M, Savva R, Wernisch L (2004) Solving the riddle of codon usage preferences: a test for translational selection. Nucleic Acids Res 32(17):5036-44', doi: '10.1093/nar/gkh834', pmid: '15448185', verified: 'PubMed record fetched 2026-11-06', role: 'tAI, the tRNA-weighted index the statement above is written in, and the genome-size caveat that makes the hypothesis explicit' },
    ]),
  },

  {
    proposed_law_id: 'binding-specificity-thermodynamic-bound',
    name: 'Equilibrium discrimination cannot exceed the Boltzmann factor of the binding-energy gap',
    domain: 'molecular-biology',
    why_it_belongs_here:
      'It is the molecular analogue of `physiology-laplace`: a hard ceiling from physics on how well a ' +
      'molecular machine can do a job, with the loophole (pay energy, and you can beat it) stated ' +
      'precisely. A design that claims an enzyme or a transcription factor discriminates its target from ' +
      'a near-match by a factor of 10^6 at equilibrium is committing to a binding-energy gap it can be ' +
      'held to.',
    the_statement:
      'Let a binding site discriminate a correct substrate from an incorrect one whose complex is ' +
      'ΔΔG less stable. At thermodynamic equilibrium the ratio of occupancies - the discrimination ' +
      'factor - is exactly exp(ΔΔG / kT), and no equilibrium mechanism exceeds it. A process that ' +
      'achieves a discrimination factor f > exp(ΔΔG / kT) is therefore not at equilibrium, and must ' +
      'dissipate free energy at a rate bounded below by the excess: the squared bound of Hopfield\'s ' +
      'proofreading, f ≤ exp(ΔΔG / kT)^n for n successive irreversible checks, with each check paid for.',
    hypotheses_it_would_need: Object.freeze([
      'A two-state equilibrium with a single binding energy per substrate, and ΔΔG defined between them. Real sites have conformational substates, and then ΔΔG is an effective quantity.',
      'kT at the stated temperature - this is where the law couples to `physiology-q10` and the thermal window, which is a genuine cross-link the registry does not currently have.',
      'For the proofreading half: n irreversible discard steps, each driven far from equilibrium, and discrimination at each step by the same ΔΔG (Hopfield\'s assumption; relaxing it gives a product rather than a power).',
      'No kinetic discrimination in the association step - the bound is on equilibrium occupancy, and k_on differences are a separate channel.',
    ]),
    provable_or_merely_statable:
      'PROVABLE, and the easiest of the three. The equilibrium half is one line of algebra from the ' +
      'Boltzmann distribution and would be a `theorem`, not a `theorem-from-hypothesis`, in the ' +
      'registry\'s sense: given the two-state hypothesis the ratio IS exp(ΔΔG/kT). The proofreading half ' +
      'is a product of n independent factors and is equally mechanical. The content worth having is the ' +
      'contrapositive as a ruling: a claimed specificity above the Boltzmann bound is a commitment to ' +
      'energy dissipation, and the design must then say where the ATP or GTP comes from - which is the ' +
      'same move `aerobic-power-bound` makes for mechanical work.',
    sources: Object.freeze([
      { cite: 'Hopfield JJ (1974) Kinetic proofreading: a new mechanism for reducing errors in biosynthetic processes requiring high specificity. Proc Natl Acad Sci USA 71(10):4135-9', doi: '10.1073/pnas.71.10.4135', pmid: '4530290', verified: 'PubMed record fetched 2026-11-06', role: 'the theorem to formalise: equilibrium discrimination is capped, and an energy-driven cascade squares it' },
      { cite: 'Ninio J (1975) Kinetic amplification of enzyme discrimination. Biochimie 57(5):587-95', doi: '10.1016/s0300-9084(75)80139-8', pmid: '1182215', verified: 'PubMed record fetched 2026-11-06', role: 'the independent co-discovery, and the delayed-reaction variant - worth having because it shows the bound is mechanism-independent' },
      { cite: 'Bialek W, Setayeshgar S (2005) Physical limits to biochemical signaling. Proc Natl Acad Sci USA 102(29):10040-5', doi: '10.1073/pnas.0504321102', pmid: '16006514', verified: 'PubMed record fetched 2026-11-06', role: 'the counting-noise floor that sits underneath any specificity claim, and the template for writing a molecular bound as a physical limit' },
    ]),
  },

  {
    proposed_law_id: 'tf-search-rate-bound',
    name: 'Berg-von Hippel: a site-search rate above the 3D diffusion limit requires facilitated diffusion',
    domain: 'molecular-biology',
    why_it_belongs_here:
      'This is the one the lead named, and it is the best fit of the three. It has the exact shape of the ' +
      'registry\'s strongest entries: a physical ceiling (Smoluchowski), a measured value that exceeds ' +
      'it, and a mechanism that is therefore forced. It is the molecular twin of `aerobic-power-bound` - ' +
      'demand above supply forces something, and the law says what.',
    the_statement:
      'For a protein of radius a searching a single target of radius s by three-dimensional diffusion ' +
      'with coefficient D, the association rate constant is at most the Smoluchowski limit ' +
      'k_3D ≤ 4*pi*D*s (with the appropriate geometric factor for a partially reactive patch). A ' +
      'measured on-rate k_on > k_3D therefore cannot arise from 3D diffusion to the target alone, and ' +
      'requires a reduced-dimensionality search: nonspecific binding to the polymer followed by sliding, ' +
      'hopping or intersegment transfer. The rate with sliding is k_on ≈ k_3D * (L_slide / s) up to ' +
      'geometry, so an observed k_on fixes a lower bound on the sliding length, and the fraction of ' +
      'time the protein spends nonspecifically bound is bounded below by the same ratio.',
    hypotheses_it_would_need: Object.freeze([
      'Dilute solution, spherical absorber, Fickian diffusion - the Smoluchowski hypotheses. These fail in a crowded nucleoid, which is why the bound is a useful floor rather than a prediction.',
      'A single target, and a known target size s. With many decoy sites the problem changes character and the bound becomes the one Gerland et al. analyse.',
      'The two-step mechanism as a named hypothesis: free 3D diffusion to any nonspecific site, then 1D translocation. This is the structure Berg, Winter and von Hippel introduce, and it would be carried as `BergVonHippelHyp` the way `TuringHyp` is.',
      'A diffusion coefficient for the sliding protein along the polymer, distinct from D in solution.',
    ]),
    provable_or_merely_statable:
      'BOTH HALVES PROVABLE, in different senses, and the split is the interesting part. The ceiling ' +
      'half is a theorem: the Smoluchowski rate is the solution of a steady-state diffusion equation ' +
      'with an absorbing boundary, and "k_on > 4*pi*D*s implies the 3D-only hypothesis is false" is then ' +
      'an impossibility result of exactly the kind the registry already holds - a `theorem`, provable ' +
      'without any biology. The second half, the sliding-length formula, is an approximation with ' +
      'geometric factors that depend on the model of hopping, so it would have to be a ' +
      '`theorem-from-hypothesis` with the facilitated-diffusion scaling named and unproved. Stating it ' +
      'honestly as two entries rather than one is the lesson the registry has already learned the hard ' +
      'way with `fick-principle` sitting separately from `aerobic-power-bound`.',
    sources: Object.freeze([
      { cite: 'Riggs AD, Bourgeois S, Cohn M (1970) The lac repressor-operator interaction. 3. Kinetic studies. J Mol Biol 53(3):401-17', doi: '10.1016/0022-2836(70)90074-4', pmid: '4924006', verified: 'PubMed record fetched 2026-11-06', role: 'the measurement that creates the problem: an on-rate above the naive diffusion limit' },
      { cite: 'Berg OG, Winter RB, von Hippel PH (1981) Diffusion-driven mechanisms of protein translocation on nucleic acids. 1. Models and theory. Biochemistry 20(24):6929-48', doi: '10.1021/bi00527a028', pmid: '7317363', verified: 'PubMed record fetched 2026-11-06', role: 'the law itself: four translocation processes, each with its contribution to the apparent rate worked out as a function of nonspecific affinity and polymer length' },
      { cite: 'Elf J, Li GW, Xie XS (2007) Probing transcription factor dynamics at the single-molecule level in a living cell. Science 316(5828):1191-4', doi: '10.1126/science.1141967', pmid: '17525339', verified: 'PubMed record fetched 2026-11-06', role: 'the in vivo test, and the non-vacuity witness a registry entry would need: a repressor spends about 90 % of its time nonspecifically bound, with a residence time under 5 ms' },
      { cite: 'Gerland U, Moroz JD, Hwa T (2002) Physical constraints and functional characteristics of transcription factor-DNA interaction. Proc Natl Acad Sci USA 99(19):12015-20', doi: '10.1073/pnas.192693599', pmid: '12218191', verified: 'PubMed record fetched 2026-11-06', role: 'the many-decoy-sites version, and the one that turns the bound into a narrow window of viable interaction parameters - i.e. into a law that rules designs out' },
    ]),
  },
]);

export default { DOMAINS, DOMAIN_DEFS, WORKED, THE_HONEST_SHAPE, WHAT_A_MOLECULAR_BIOLOGY_LAW_WOULD_LOOK_LIKE };
