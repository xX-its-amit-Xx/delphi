// analogue.mjs - choose the closest FUNCTIONAL analogue, by FUNCTION, not by relatedness.
//
// WHY THIS EXISTS. This project's own findings say the naive "does the design look like its relatives" test is the
// wrong one. sequences/gliders.json: independent gliders do NOT converge at the sequence level (0 of 532 interface
// positions SEPARATE gliders from non-gliders; all 532 are shared with non-gliders, so these positions carry no
// glider-specific signal at all). design-validation/REPORT.md: the winged zebrafish reproduces 1 of the 74
// loci known to differ in flying fishes, and at a DIFFERENT residue. So the comparison that can carry weight is
// against the closest organism that performs the FUNCTION, whatever its relatedness - and the answer has to come
// with the distance in both senses, so nobody mistakes a functional analogue for a close relative.
//
// WHAT A FUNCTION IS HERE. Operationally defined: a measurable criterion, a threshold where one exists, and the
// real taxa that satisfy it with the evidence that they do. A function with no satisfying taxon in our data is
// declared, not quietly dropped.
//
// HARD LIMITS
//   * No Aves data, anywhere. Birds are this project's frozen holdout. Where birds are the obvious analogue
//     (powered flight, high-altitude O2 handling) this module says so and REFUSES to name one, rather than
//     substituting a worse analogue silently.
//   * Pterosaurs are extinct and have no DNA: they can never be a sequence-comparable analogue.
//   * No credentials. Everything here is a local read of repository data.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

export const AVES_REFUSAL =
  'Class Aves is this project\'s FROZEN HOLDOUT: no bird datum may be read. Birds are the obvious analogue for this '
  + 'function, so the honest statement is that the best analogue is unavailable to us by design, not that the next '
  + 'one down is good. Nothing is substituted for it here.';

export const PTEROSAUR_NOTE =
  'Pterosaurs flew and are extinct (Mesozoic): no DNA, so no sequence-level requirement set can ever be derived '
  + 'from them. They are named for completeness and are never an analogue in this module.';

/** Daane et al. 2021 Curr Biol 31:5052-5061, doi 10.1016/j.cub.2021.08.054, PMID 34534441, Data S1 (publisher
 *  mmc2.xlsx, in genotype/cache/). Our copy's sheet A is already summarised per group in
 *  genotype/cache/daane2021_fin_ratios.json; the ratios below are read from that file, never typed in. */
export const DAANE = 'Daane et al. 2021, Modulation of bioelectric cues in the evolution of flying fishes, Curr Biol, doi 10.1016/j.cub.2021.08.054, PMID 34534441';

let _fr = null;
const finRatios = () => (_fr ??= read('genotype/cache/daane2021_fin_ratios.json'));

/** The registry. Each function: an operational definition, a threshold where one exists, the taxa that satisfy it,
 *  and - first class - what functional data we actually hold for each taxon. `refuse` marks a function whose best
 *  analogue we are forbidden to read. */
export function registry() {
  const fr = finRatios().groups;
  return {
    glides_over_water: {
      id: 'glides_over_water',
      label: 'glides over water after leaving it',
      operational:
        'leaves the water and travels through air over a measurable distance without flapping-powered thrust. '
        + 'Satisfied by a taxon for which a glide distance or duration is reported, or for which the gliding habit is '
        + 'the taxon-defining behaviour in the primary literature.',
      threshold: null,
      threshold_note: 'no glide-distance threshold is fixed here: this project holds no glide measurement of any DESIGN, so a threshold would only ever be applied to one side',
      taxa: [
        { id: 'flying-fish', name: 'flying fishes', taxon: 'Exocoetidae', satisfies: true,
          evidence: [
            { claim: 'Exocoetidae are the gliding clade of the Beloniformes; Daane 2021 groups the family as the gliding end of a four-group series (needlefish -> halfbeak -> gliding halfbeak -> flying fish) and measures the fin proportion that supports the glide', source: `${DAANE}, Data S1 sheet A (genotype/cache/daane2021_fin_ratios.json)`, kind: 'curated' },
            { claim: `pectoral fin length / SL median ${fr['flying fish'].pectoral_over_SL_median} (range ${fr['flying fish'].pectoral_over_SL_min}-${fr['flying fish'].pectoral_over_SL_max}, n = ${fr['flying fish'].n_specimens} museum specimens)`, source: `${DAANE}, Data S1 sheet A`, kind: 'measured' },
          ] },
        { id: 'gliding-halfbeak', name: 'gliding (flying) halfbeaks', taxon: 'Hemiramphidae (Euleptorhamphus, Oxyporhamphus)', satisfies: true,
          evidence: [
            { claim: `an independent, shallower glider inside the same order: pectoral fin length / SL median ${fr['flying halfbeak'].pectoral_over_SL_median} (range ${fr['flying halfbeak'].pectoral_over_SL_min}-${fr['flying halfbeak'].pectoral_over_SL_max}, n = ${fr['flying halfbeak'].n_specimens})`, source: `${DAANE}, Data S1 sheet A`, kind: 'measured' },
            { claim: 'gliding halfbeaks carry about as many of the Exocoetidae-derived coding states as flying fishes do, at a fin ratio 2.5x smaller, so derived-state count does not scale with fin length', source: 'sequences/progression.json read_this_first[1] (our own re-read of Daane sheet G per species from the captured exons)', kind: 'measured' },
          ] },
      ],
      functional_data_we_hold: {
        genome: 'a draft genome and gene set exist for ONE flying fish, Hirundichthys speculiger (Xu et al. 2021, Front Genet 12:695700, doi 10.3389/fgene.2021.695700, assembly GCA_018398805.1)',
        transcriptome: 'NONE. omics/transcriptomic/SOURCES.md: no flying-fish RNA-seq, raw or processed, exists in SRA/ENA/GEO/ArrayExpress; 3,485 loose Europe PMC hits and not one flying-fish transcriptome. In particular NO pectoral-fin expression data',
        proteome: 'NONE. omics/proteomic/SOURCES.md: 3 UniProt rows for flying-fish entries in 199,149; no MS evidence, no abundance, no structures',
        focal_gene_ids: 'omics/genes.json coverage.flying_fish = 9 of 3,860 genes carry a Hirundichthys identifier; 7 of 9 are clean reciprocal best hits (genotype/sequence-layer.json counts)',
        mutants_or_assays: 'NONE. No flying fish has ever been mutated, knocked down or functionally assayed in any source we fetched',
      },
      data_poor: true,
      data_poor_statement:
        'The ONLY analogue for this function has a genome and nothing else: no transcriptome, no proteome, no '
        + 'expression atlas, no mutant, no functional assay, and 9 of 3,860 genes carry an identifier for it. Every '
        + 'functional requirement derived from it is therefore derived from SEQUENCE and from the curated comparative '
        + 'analysis in one paper - never from a measurement of the analogue doing the thing.',
    },

    enlarged_paired_pectoral_fins: {
      id: 'enlarged_paired_pectoral_fins',
      label: 'enlarged paired pectoral fins',
      operational: 'pectoral fin length / standard length at or above the smallest value observed in the gliding family',
      threshold: fr['flying fish'].pectoral_over_SL_min,
      threshold_note: `>= ${fr['flying fish'].pectoral_over_SL_min} (the Exocoetidae minimum over ${fr['flying fish'].n_specimens} specimens, Daane 2021 sheet A). A threshold read off the analogue, not invented.`,
      taxa: [
        { id: 'flying-fish', name: 'flying fishes', taxon: 'Exocoetidae', satisfies: true,
          evidence: [{ claim: `median ${fr['flying fish'].pectoral_over_SL_median}, min ${fr['flying fish'].pectoral_over_SL_min}, max ${fr['flying fish'].pectoral_over_SL_max}, n = ${fr['flying fish'].n_specimens}`, source: `${DAANE}, Data S1 sheet A`, kind: 'measured' }] },
        { id: 'gliding-halfbeak', name: 'gliding (flying) halfbeaks', taxon: 'Hemiramphidae', satisfies: false,
          evidence: [{ claim: `median ${fr['flying halfbeak'].pectoral_over_SL_median}, max ${fr['flying halfbeak'].pectoral_over_SL_max}: below the Exocoetidae minimum, so it glides without meeting this criterion. The two functions come apart in real animals, which is why they are separate rows here`, source: `${DAANE}, Data S1 sheet A`, kind: 'measured' }] },
      ],
      functional_data_we_hold: { note: 'the same flying-fish data poverty as glides_over_water; the fin ratio itself is the one well-measured quantity (49 specimens)' },
      data_poor: true,
      data_poor_statement: 'The fin proportion is measured in 49 specimens. Nothing else about the analogue\'s fin is measured: no expression, no protein, no ray counts in our sources.',
    },

    sustained_powered_flight: {
      id: 'sustained_powered_flight',
      label: 'sustained powered (flapping) flight',
      operational: 'level or climbing flight produced by flapping, sustained beyond a ballistic or gliding trajectory, with an aerobic power supply',
      threshold: null,
      taxa: [
        { id: null, name: 'bats', taxon: 'Chiroptera', satisfies: true, partial: true,
          supplies: 'powered flapping flight itself, with an aerobic power supply, in an animal whose sequences we may read',
          does_not_supply: 'anything transferable to a fin. There is no pectoral fin, no lepidotrichium and no fin fold in a bat, and our own glider analysis finds NO sequence convergence between gliding mammals and gliding fishes at the focal sites (the lat4a 326 state is F in all three bats, in mouse and in human - the same as in zebrafish and medaka).',
          evidence: [{ claim: 'the only extant non-avian powered fliers whose sequences we may read; three bat genomes are already in our focal-gene alignments (Myotis lucifugus, Pteropus vampyrus, Rhinolophus ferrumequinum)', source: 'sequences/genes.json, sequences/gliders.json panel', kind: 'curated' },
            { claim: '0 of 532 interface positions separate gliders from non-gliders (all 532 are shared with non-gliders); lat4a F326L is 20.1 A from the substrate', source: 'sequences/gliders.json (our own convergence analysis)', kind: 'measured' }] },
        { id: 'flying-fish', name: 'flying fishes', taxon: 'Exocoetidae', satisfies: false, partial: true,
          supplies: 'the airborne half: a teleost that leaves the water and travels through air, with the enlarged pectoral fin that makes it possible, and a sequenced genome',
          does_not_supply: 'power. A flying fish glides; it does not flap. Nothing in its requirement set speaks to sustained powered flight, so borrowing that set for a powered-flight design would answer a question nobody asked.',
          evidence: [{ claim: 'Exocoetidae glide; no flapping-powered flight is reported for any fish in any source we fetched', source: DAANE, kind: 'curated' }] },
      ],
      refuse: AVES_REFUSAL,
      pterosaurs: PTEROSAUR_NOTE,
      functional_data_we_hold: {
        note: 'bats are mammals: there is no pectoral FIN, no fin ray, no lepidotrichium and no fin-fold in a bat, so a '
          + 'fin-level requirement set cannot be transferred from one. Our own glider analysis found NO sequence convergence '
          + 'between gliding mammals and gliding fishes at the focal sites (sequences/gliders.json; the lat4a 326 state is '
          + 'F in all three bats, mouse and human - the same as zebrafish and medaka).',
      },
      data_poor: true,
      data_poor_statement:
        'For a FISH design this function has NO usable analogue. The best analogues are birds (refused: frozen '
        + 'holdout) and pterosaurs (extinct, no DNA). What remains is bats, which share no fin structure with the '
        + 'design and show no sequence convergence with gliding fishes in our own data. A requirement set derived '
        + 'from a bat would be a requirement set for building a bat.',
    },

    high_altitude_o2_handling: {
      id: 'high_altitude_o2_handling',
      label: 'high-altitude oxygen handling',
      operational: 'sustained aerobic performance at reduced ambient partial pressure of oxygen',
      threshold: null,
      taxa: [],
      refuse: AVES_REFUSAL,
      functional_data_we_hold: {
        note: 'no fish analogue: fish do not operate at altitude. The canonical analogues (bar-headed goose and '
          + 'other high-flying birds) are Aves and are refused. genotype/flier-genome.json item 3 (oxygen delivery) '
          + 'independently reports NO genetic route at all for this requirement.',
      },
      data_poor: true,
      data_poor_statement: 'No analogue is named for this function. The requirement set is empty, and that is a refusal, not a pass.',
    },
  };
}

/** Map a desired-phenotype text (the generator prompt, via the pipeline's DesignSpec) onto a registry function.
 *  Deliberately conservative: a phrase has to name the behaviour or the structure. A text that matches nothing
 *  returns null, and the caller then says the function was INFERRED rather than specified. */
const TEXT_RULES = [
  [/\b(?:powered|flapping|sustained)\s+flight\b|\bflies?\s+under\s+(?:its\s+own\s+)?power\b|\btruly\s+fl(?:y|ies|ying)\b|\bpowered\s+flier\b/i, 'sustained_powered_flight'],
  [/\bglid\w*\b|\bleaps?\s+(?:out\s+)?of\s+the\s+water\b|\bairborne\b|\baerial\b|\bflying\s+fish\b/i, 'glides_over_water'],
  [/\b(?:enlarged|larger|long(?:er)?|wing-?like|outsized)\s+(?:paired\s+)?(?:pectoral\s+)?fins?\b|\bwings?\b|\bwinged\b|\bpectoral\s+fin\s+(?:length|size|area|span)\b/i, 'enlarged_paired_pectoral_fins'],
  [/\b(?:high[\s-]?altitude|hypox\w*|thin\s+air|oxygen\s+(?:handling|delivery)|O2\s+handling)\b/i, 'high_altitude_o2_handling'],
];

export function functionFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const hits = [];
  for (const [re, fn] of TEXT_RULES) { const m = re.exec(text); if (m) hits.push({ function: fn, matched: m[0] }); }
  if (!hits.length) return null;
  // Powered flight and gliding can both match ("a zebrafish that truly flies, not just glides"): the stronger
  // claim wins, because its requirement set is the harder one and a scorer must not be handed the easier one.
  const order = ['sustained_powered_flight', 'glides_over_water', 'enlarged_paired_pectoral_fins', 'high_altitude_o2_handling'];
  hits.sort((a, b) => order.indexOf(a.function) - order.indexOf(b.function));
  return { function: hits[0].function, matched: hits[0].matched, also_matched: hits.slice(1), rule: 'analogue.mjs TEXT_RULES; the strongest claim wins when several match' };
}

/** The design's own base species and taxon, used for the PHYLOGENETIC half of the distance. */
function baseOf(design) {
  const id = typeof design === 'string' ? design
    : design?.organism && typeof design.organism === 'string' ? design.organism
      : design?.doc?.base?.parents?.[0]?.organism || design?.id || null;
  const ZF = { species: 'Danio rerio', taxon: 'Cypriniformes (Otophysi, Teleostei)' };
  const FF = { species: 'Hirundichthys / Exocoetidae', taxon: 'Beloniformes (Acanthomorpha, Teleostei)' };
  if (id === 'flying-fish') return { id, ...FF };
  if (id === 'tff' || id === 'ff-zf-chimera' || id === 'wingless-flying-fish') return { id, ...FF, note: 'a design whose parents include the real flying fish' };
  return { id, ...ZF };
}

/** Phylogenetic distance, stated only as far as our own fetched data supports it. The MRCA clade comes from the
 *  Ensembl Compara orthologue records we fetched for the requirement loci (taxonomy_level), which is a real datum;
 *  no dated divergence is asserted, because no fetched source in this thread gives one. */
export function phylogeneticDistance(base, analogueId, { comparaLevels = null } = {}) {
  if (!analogueId) return null;
  const sameOrder = /Beloniformes/.test(base.taxon);
  if (analogueId === 'flying-fish' || analogueId === 'gliding-halfbeak') {
    return {
      from: base.species, to: analogueId === 'flying-fish' ? 'Exocoetidae' : 'Hemiramphidae',
      same_species: base.id === 'flying-fish' && analogueId === 'flying-fish',
      mrca_clade: sameOrder ? 'Beloniformes (same order)' : (comparaLevels?.[0] || 'Clupeocephala'),
      mrca_source: sameOrder ? 'taxonomy' : 'Ensembl Compara orthologue records fetched for the requirement loci (homology taxonomy_level); see C:/Temp/functional-cache/ortho/',
      kind: 'curated',
      dated_divergence: null,
      dated_divergence_note: 'NOT asserted: no source fetched in this thread dates the Otophysi-Acanthomorpha split, so no number is given rather than a remembered one',
      relatedness_rank: sameOrder ? 'same order' : 'same cohort (Clupeocephala), different superorder',
    };
  }
  return {
    from: base.species, to: 'Chiroptera', mrca_clade: 'Euteleostomi (bony vertebrates)',
    mrca_source: 'Ensembl Compara taxonomy levels for the focal-gene orthologues (sequences/genes.json panel)',
    kind: 'curated', dated_divergence: null,
    relatedness_rank: 'different class; no fin homologue exists in the analogue',
  };
}

/** Functional distance: on the function\'s OWN operational axis, not on relatedness. Returns a reading that may
 *  legitimately be UNMEASURABLE, and says which side is missing when it is. */
export function functionalDistance(fn, { designFinSL = null, designId = null } = {}) {
  const fr = finRatios().groups;
  if (fn.id === 'enlarged_paired_pectoral_fins' || fn.id === 'glides_over_water') {
    const analogue = fr['flying fish'];
    if (designId === 'flying-fish') return { axis: 'pectoral fin length / SL', analogue_value: analogue.pectoral_over_SL_median, design_value: analogue.pectoral_over_SL_median, distance: 0, measurable: true, note: 'the design IS the analogue: distance zero by identity, which is the point of running it as a control' };
    if (typeof designFinSL === 'number') {
      return { axis: 'pectoral fin length / SL', analogue_value: analogue.pectoral_over_SL_median, design_value: designFinSL,
        distance: +(analogue.pectoral_over_SL_median - designFinSL).toFixed(4), measurable: true,
        meets_threshold: fn.threshold == null ? null : designFinSL >= fn.threshold };
    }
    return { axis: 'pectoral fin length / SL', analogue_value: analogue.pectoral_over_SL_median, design_value: null, distance: null, measurable: false,
      why_unmeasurable:
        'The design side has no number. design-validation/REPORT.md axis 1 is CANNOT SCORE on BOTH sides at once: no '
        + 'fetched source gives an adult zebrafish pectoral fin length / SL (development/zebrafish/trajectory.mjs returns '
        + 'finLength_SL: null), and the winged zebrafish\'s own value exists only inside Daane 2021 Figure 4B, which this '
        + 'project refuses to digitise. The single number that would settle the headline question is unavailable at both ends.',
      kind: 'measured (absence)' };
  }
  if (fn.id === 'sustained_powered_flight') {
    return { axis: 'aerobic flight power at the design\'s mass', analogue_value: null, design_value: null, distance: null, measurable: false,
      why_unmeasurable: 'no powered-flight analogue may be read (Aves refused, pterosaurs extinct), and genotype/flier-genome.json reports no route reaching any of the four requirements. There is no axis to place the design on.' };
  }
  return { axis: null, measurable: false, why_unmeasurable: 'no analogue is named for this function' };
}

/** THE ENTRY POINT. Given a design and a target function, return the analogue(s), the evidence, both distances,
 *  and - plainly - whether the only analogue is data-poor.
 *  `target` may be a registry key, or {desired_phenotype | text | function} from the pipeline's DesignSpec. */
export function closestFunctionalAnalogue(design, target, { designFinSL = null } = {}) {
  const R = registry();
  const base = baseOf(design);
  let fnKey = null, signal = null, matched = null;
  if (typeof target === 'string' && R[target]) { fnKey = target; signal = 'specified: the caller named a registry function'; }
  else {
    const text = typeof target === 'string' ? target : (target?.desired_phenotype || target?.text || target?.function || null);
    if (typeof text === 'string' && R[text]) { fnKey = text; signal = 'specified: the spec named a registry function'; }
    else {
      const t = functionFromText(text);
      if (t) { fnKey = t.function; matched = t; signal = `specified: parsed from the desired-phenotype text ("${t.matched}")`; }
    }
  }
  if (!fnKey) {
    // No desired phenotype reached us. Infer from what the design IS, and label it inferred - never pretend the
    // function was given.
    fnKey = base.id === 'tff' ? 'sustained_powered_flight' : 'glides_over_water';
    signal = `INFERRED, not specified: no desired-phenotype text reached this module, so the function was taken from the design's identity (${base.id || 'unknown'}). A different desired phenotype would change the requirement set and so the whole ledger.`;
  }
  const fn = R[fnKey];
  const satisfying = fn.taxa.filter(t => t.satisfies && !t.partial);
  const chosen = satisfying.find(t => t.id) || satisfying[0] || null;
  // NO ANALOGUE is the loud case: nothing is dressed up as one. The nearest PARTIAL analogues are listed with
  // what each one does and does not supply, which is the useful answer when the real one does not exist.
  const partials = fn.taxa.filter(t => t.partial).map(t => ({ name: t.name, taxon: t.taxon, performs_the_function: !!t.satisfies, supplies: t.supplies || null, does_not_supply: t.does_not_supply || null, evidence: t.evidence }));
  return {
    function: { id: fn.id, label: fn.label, operational: fn.operational, threshold: fn.threshold, threshold_note: fn.threshold_note || null },
    function_signal: signal, function_text_match: matched,
    base: base,
    id: chosen?.id ?? null, name: chosen?.name ?? null, taxon: chosen?.taxon ?? null,
    no_analogue: !chosen,
    nearest_partial_analogues: partials,
    basis: chosen ? `satisfies the operational definition of "${fn.label}"`
      : `NO ORGANISM WE MAY READ SATISFIES "${fn.label}". ${partials.length ? `The nearest partial analogues are ${partials.map(p => `${p.name} (supplies: ${p.supplies})`).join('; ')} - each named with what it does NOT supply, so neither is mistaken for the analogue.` : 'There is not even a partial analogue.'} The closest RELATIVE is not offered in its place: relatedness is not function, which is the whole premise of this module.`,
    source: chosen ? chosen.evidence.map(e => e.source).join('; ') : null,
    evidence: chosen?.evidence ?? [],
    other_satisfying_taxa: fn.taxa.filter(t => t.satisfies && t !== chosen).map(t => ({ name: t.name, taxon: t.taxon, partial: !!t.partial, evidence: t.evidence })),
    non_satisfying_taxa_listed: fn.taxa.filter(t => !t.satisfies).map(t => ({ name: t.name, taxon: t.taxon, why_not: t.evidence[0]?.claim || null })),
    refused: fn.refuse || null,
    pterosaurs: fn.pterosaurs || null,
    distance: {
      phylogenetic: chosen ? phylogeneticDistance(base, chosen.id || 'bats') : null,
      functional: functionalDistance(fn, { designFinSL, designId: base.id }),
      rule: 'the two distances are reported separately and never combined: a close functional analogue may be phylogenetically remote, and that is the whole point of choosing by function',
    },
    data_poor: !!fn.data_poor,
    data_poor_statement: fn.data_poor_statement || null,
    functional_data_we_hold: fn.functional_data_we_hold,
    aves: AVES_REFUSAL,
  };
}

export const FUNCTIONS = Object.keys(registry());
