// DNA - Delphi / Nous / Aletheia. The three-part frame every feature is placed against.
//
// ============================== A FLAG BEFORE ANYTHING ELSE ==============================
// This triad was named by the project lead and is NOT DEFINED ANYWHERE IN THIS REPOSITORY - I grepped
// for both "Nous" and "Aletheia" across every .md, .mjs, .json and .html and got zero hits. So the
// reading below is MINE, written down so it can be corrected rather than silently assumed. If the
// intended meaning differs, this file is the one to change and the dev log entries follow it.
//
// The reading is not arbitrary: it is chosen because it already describes the three layers this
// repository actually has, which is some evidence it is the intended one.

export const INTERPRETATION_IS_MINE =
  'the DNA triad was named by the project lead and defined nowhere in the repository. This reading is ' +
  'an interpretation, recorded so it can be corrected. Grep confirms zero prior uses of Nous or Aletheia.';

export const DNA = Object.freeze({
  delphi: {
    name: 'Delphi',
    gloss: 'the oracle. What could be built, and what would happen if it were.',
    the_faculty: 'generation',
    what_it_does: 'proposes organisms, designs edits, simulates development, scores plausibility',
    in_this_repo: ['sim-engine/', 'organism-design/', 'organism-format/', 'editplan', 'the design scorer'],
    its_characteristic_failure:
      'fluency. An oracle is never short of an answer, and a design system will produce a cassette for ' +
      'any request put to it - including the two of our three worked requests that are not ' +
      'genome-editing problems at all.',
  },
  nous: {
    name: 'Nous',
    gloss: 'intellect. What follows from what, independently of whether anyone has looked.',
    the_faculty: 'inference',
    what_it_does: 'states laws, proves theorems, checks that a conclusion follows from its premises',
    in_this_repo: ['lean/', 'the 62-law registry', 'benchmarks/lean-mutation', 'benchmarks/lean-open-problems'],
    its_characteristic_failure:
      'vacuity, and its quieter cousin, proving the wrong statement soundly. A theorem with ' +
      'unsatisfiable hypotheses is true and says nothing; a theorem whose English gloss does not match ' +
      'its Lean passes every check this repository has.',
  },
  aletheia: {
    name: 'Aletheia',
    gloss: 'ἀλήθεια - literally UN-concealment, un-forgetting. Truth as disclosure rather than as correspondence.',
    the_faculty: 'disclosure',
    what_it_does: 'measures against the world, records provenance, refuses, and says what is not known',
    in_this_repo: ['benchmarks/', 'sim-engine/validate/', 'the holdout', 'provenance kinds', 'not_established'],
    its_characteristic_failure:
      'the false negative that looks like diligence - a check that reports clean because it could not ' +
      'find the field it was checking. This repository produced exactly that twice in one week.',
    why_the_etymology_matters:
      'the Greek word is privative: a-letheia, NOT-hidden, from lethe, forgetting. It is a better name ' +
      'for this layer than "truth" would be, because almost nothing here establishes that a claim is ' +
      'correct. What it does is stop things being concealed - a depicted mesh marked as depicted, a ' +
      'value marked not-established, a scorer measured against data it did not choose. The discipline ' +
      'is not correspondence, it is refusing to forget what a number was made of.',
  },
});

/** The claim the whole structure rests on, and the reason none of the three suffices alone. */
export const WHY_THREE = Object.freeze({
  the_argument:
    'each layer fails in a way the other two cannot see. Delphi cannot tell a good design from a ' +
    'fluent one. Nous cannot tell a sound proof from a relevant one. Aletheia cannot tell you what to ' +
    'build, only what is so. Run any one alone and the characteristic failure goes unnoticed.',
  the_worked_instance:
    'the design scorer calls an animal whose dorsal fin begins past the end of its body TYPICAL, and ' +
    'ranks it above 87% of real fish. Delphi could not see it - the score is exactly what the model ' +
    'says. Nous could not see it either, until a registry law was read as a geometric constraint. It ' +
    'took Aletheia, in the form of a search over real specimens, to find an animal the other two ' +
    'layers agreed was ordinary.',
  the_asymmetry:
    'the layers are not equal partners. Aletheia is the only one that can say NO on evidence, which is ' +
    'why most of the recent work lives there, and why a refusal is treated as a result rather than a ' +
    'failure to produce one.',
});

/** Where a feature sits. A feature may span layers; most of the interesting ones do. */
export const LAYERS = Object.freeze(['delphi', 'nous', 'aletheia']);

export function placement(layers) {
  const bad = layers.filter(l => !LAYERS.includes(l));
  if (bad.length) throw new Error(`unknown layer(s): ${bad.join(', ')}`);
  return layers;
}

/**
 * The three programme goals, named by the project lead, and how each lands on the triad.
 *
 * These are the reason any of the rest exists. A dev log that lists features without them is a list of
 * things that were built; what makes a feature worth an entry is which of these it moves.
 */
export const GOALS = Object.freeze([
  {
    id: 'agentic-biomaterials',
    name: 'Agentic biomaterials',
    note: 'team members were in the xenobot lab this week',
    what_it_is:
      'materials that behave: structures made of living cells that move, repair and act, rather than ' +
      'materials that merely have properties.',
    dominant_layer: 'delphi',
    why_it_sharpens_the_work:
      'a xenobot is the cleanest counterexample to the assumption this pipeline is built on. It is an ' +
      'organism assembled from cells WITHOUT EDITING A GENOME - the design acts on arrangement, ' +
      'adhesion and geometry, and the genome goes along unchanged. Our design surface is an edit list ' +
      'against a reference assembly, which cannot express "take these cells and put them there". The ' +
      'three worked requests already showed one case where the genome was the wrong target; this is a ' +
      'whole class where it is.',
    what_we_would_have_to_build:
      'a design representation whose primitive is a cell arrangement rather than a sequence edit. ' +
      '.life is closer to this than .organism is - it already carries per-cell position, radius and ' +
      'neighbour-dependent geometry - but nothing in the pipeline can currently propose an arrangement.',
    the_open_question:
      'what is the unit of agency? A xenobot does things no cell in it does. Whether that is emergence ' +
      'worth a new vocabulary or just mechanics at a larger scale is not settled by watching more of them.',
  },
  {
    id: 'reverse-engineering-biological-law',
    name: 'Evolutionary biology, and reverse-engineering biological laws and constraints',
    what_it_is:
      'recovering the constraints that make some organisms possible and others not - and stating them ' +
      'precisely enough to be wrong.',
    dominant_layer: 'nous',
    why_it_sharpens_the_work:
      'this is what the 62-law registry IS, and the benchmarks measured how far it reaches. The result ' +
      'is sobering and useful: only 1 of 48 theorem-carrying laws is expressible on the ten body-ratio ' +
      'traits, because the registry speaks in quantities those traits do not carry - two sizes, a ' +
      'population, a power budget, a genotype. A law you cannot evaluate on your data is not yet a ' +
      'constraint on your design.',
    what_we_would_have_to_build:
      'the missing direction. Everything so far states a law and checks it; nothing INFERS one from ' +
      'data. Reverse-engineering means going from the cloud of real organisms to the boundary of it, ' +
      'and the adversarial search is the first thing here that touches that boundary from the outside.',
    the_open_question:
      'is a biological "law" a constraint, a regularity, or a habit? Allometric exponents hold until ' +
      'they do not. More measurements sharpen the exponent without telling you whether an exception ' +
      'refutes the law or merely bounds it.',
  },
  {
    id: 'open-biological-questions',
    name: 'Other open biological questions, including origins of life',
    dominant_layer: 'aletheia',
    what_it_is:
      'the questions that are open for reasons other than insufficient effort.',
    why_it_sharpens_the_work:
      'origins of life is the hardest case of the thing this whole discipline keeps running into: a ' +
      'question where the evidence is gone. Every other item here can in principle be settled by a ' +
      'measurement. That one cannot, because the event left almost no record and the record it left has ' +
      'been overwritten by four billion years of descendants. It is the limiting case of aletheia as ' +
      'UN-forgetting - the thing was not hidden, it was forgotten, and no instrument recovers it.',
    what_we_would_have_to_build:
      'the honest version is not a simulation of abiogenesis. It is a machine-checkable account of what ' +
      'each proposed route REQUIRES - which is the shape the law registry already has, and the shape ' +
      'the lean-open-problems triage says is worth having: a system that can derive a contradiction ' +
      'from its own accepted premises plus a measurement.',
    the_open_question:
      'what would count as settling it? A demonstration that life CAN arise a particular way is not a ' +
      'demonstration that it DID. That gap is logical, not empirical, and it will survive any amount of ' +
      'laboratory success.',
  },
]);

export const HOW_GOALS_MEET_THE_TRIAD = Object.freeze({
  the_pattern:
    'each goal is dominated by a different layer, which is some evidence the triad is carving at joints ' +
    'rather than being imposed. Biomaterials is a generation problem, law-recovery an inference problem, ' +
    'and origins an evidence problem.',
  the_uncomfortable_implication:
    'the pipeline as built is strongest at the layer the goals need least. Delphi will happily produce a ' +
    'cassette for any request; two of the three worked requests did not need one, and an entire goal - ' +
    'agentic biomaterials - does not involve editing a genome at all.',
});
