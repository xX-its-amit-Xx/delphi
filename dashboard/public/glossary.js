// Glossary: every dotted term on the page opens one of these. Keep definitions plain and checkable.
// Fields: short (hover), long (drawer), why (why it matters here), see (related terms).
window.GLOSSARY = {
  "nanopublication": {
    short: "A tiny signed record of one scientific assertion plus where it came from.",
    long: "A nanopublication bundles an assertion with its provenance and publication info as separate named graphs in RDF. Because it is signed and has a content-derived identifier, it cannot be silently edited. To change it you publish a new one that supersedes or retracts the old one.",
    why: "Every DELPHI claim, test and assessment is published this way, so anyone can cite, query or challenge a single claim. Knowledge Pixels, where teammate Ashley works, builds the registry network.",
    see: ["test registry", "supersede", "claim"]
  },
  "claim": {
    short: "One testable statement taken from a source, with a verbatim quote.",
    long: "In this repo a claim is a single proposition extracted from a book or paper, stored with the exact quote and its location, a label, and a kind such as mechanism, mathematical-law or prediction. One claim, one proposition.",
    why: "Claims are the unit everything else attaches to: assessments, tests, Lean theorems, and simulator rules.",
    see: ["nanopublication", "dataset-resolvability", "truth score"]
  },
  "dataset-resolvability": {
    short: "How well existing public data could confirm or refute a claim.",
    long: "Two AI assessors from different providers answer a fixed rubric for each claim: is there a real dataset, can the claim be operationalized into a measurable quantity, and so on. The result is a score between 0 and 1, called testability on this page.",
    why: "It decides which claims are worth a pre-registered test first. It is an opinion about testability, not a test.",
    see: ["testability", "pre-registration", "assessor != builder"]
  },
  "testability": {
    short: "The assessors' score for how testable a claim is with current data.",
    long: "An average over assessors of the dataset-resolvability rubric, scaled 0 to 1. Only some claims have one in the claim graph.",
    why: "The horizontal axis of the claim map.",
    see: ["dataset-resolvability"]
  },
  "truth score": {
    short: "An AI assessor's probability that a claim is true.",
    long: "Each claim carries p_true from two assessors and their average. These are model judgments made without running new data, so they can share the same blind spots.",
    why: "Useful as a prior to compare against real test results. Dangerous if mistaken for evidence.",
    see: ["testability", "assessor != builder"]
  },
  "pre-registration": {
    short: "Writing the pass and fail criteria before looking at the data.",
    long: "Each claim test starts with a committed result file stating the hypothesis, what result would confirm it, what would refute it, and which datasets are planned. Only then is any data downloaded. Clinical trials use the same discipline.",
    why: "It stops us from choosing the threshold after seeing the answer, which is how false positives are manufactured.",
    see: ["holdout", "claim"]
  },
  "assessor != builder": {
    short: "The model that built something never scores it.",
    long: "The repo requires at least two assessor providers, neither being the builder, and assessors see only the claim, quote, rubric and source text. AI-audited does not mean expert-validated.",
    why: "Independent audit is the cheapest defense against self-flattering results.",
    see: ["dataset-resolvability", "truth score"]
  },
  "Lean 4": {
    short: "A proof assistant: software that checks a mathematical proof line by line.",
    long: "In Lean a theorem is a program whose type is the statement. If the file compiles with no 'sorry' placeholders, the proof is machine-checked. Lean's Mathlib library covers much of undergraduate and research mathematics, including probability.",
    why: "It turns 'the theorem follows from these assumptions' from a claim into a checked fact. The repo warns against stub proofs that prove generic arithmetic instead of the stated law.",
    see: ["sorry", "LeanBio"]
  },
  "sorry": {
    short: "Lean's placeholder meaning 'proof missing here'.",
    long: "A file that uses sorry compiles but proves nothing about that step. The repo counts sorries as a quality measure.",
    why: "Zero sorries is necessary but not sufficient: the proof must also be about the stated law.",
    see: ["Lean 4"]
  },
  "LeanBio": {
    short: "The team's idea of a probabilistic Lean for biology.",
    long: "Lean statements with explicit probability distributions and population assumptions, so a biological theorem records what it assumes about the population and the randomness.",
    why: "Biology's laws are statistical. Plain logic hides the distributional assumptions that decide whether they hold.",
    see: ["Lean 4", "genetic drift"]
  },
  "holdout": {
    short: "Data deliberately kept hidden until it is time to judge a model.",
    long: "A held-out set is frozen before modeling begins and used once. For evolution, the right holdout removes whole lineages, not random rows, so the model cannot copy a close relative.",
    why: "It is the difference between predicting and remembering.",
    see: ["deep mutational scanning", "phylogeny"]
  },
  "deep mutational scanning": {
    short: "An experiment that measures the effect of thousands of single mutations at once.",
    long: "Researchers make a large library of variants of a protein, select for function, and sequence before and after. The change in each variant's frequency gives a fitness-like score for each mutation.",
    why: "It is real, measured evolutionary fitness data, a natural holdout for theorems about mutations and selection.",
    see: ["holdout", "fixation probability"]
  },
  "phylogeny": {
    short: "The family tree of species.",
    long: "A phylogeny shows how lineages split over time. Traits of related species are not independent, so statistics on species must account for the tree.",
    why: "Splitting held-out data by clade uses the tree to keep the exam fair.",
    see: ["holdout"]
  },
  "reaction-diffusion": {
    short: "Chemicals that react with each other while spreading out.",
    long: "Alan Turing showed in 1952 that if one chemical activates itself and makes an inhibitor that spreads faster, a uniform mixture can break into stable spots or stripes. The Gray-Scott model in the Labs uses two chemicals, u and v, with feed rate F and kill rate k.",
    why: "It is the model case for a mathematical law that creates biological form, and the repo marks diffusion-driven instability as partial and wavelength selection as proved.",
    see: ["Turing pattern"]
  },
  "Turing pattern": {
    short: "A spot or stripe pattern that emerges from reaction-diffusion.",
    long: "Candidate examples include digit spacing in the mouse limb, which a 2014 study modeled as a Turing system. Whether a given animal pattern is truly Turing-made is tested case by case.",
    why: "Shows how local rules produce global shape.",
    see: ["reaction-diffusion"]
  },
  "cellular automaton": {
    short: "A grid of cells updated in lockstep by a simple local rule.",
    long: "In the elementary kind each cell is black or white and its next color depends on itself and its two neighbors. There are 256 such rules. Wolfram's A New Kind of Science argues that simple programs like these underlie much natural complexity; the repo extracted 321 claims from it to test.",
    why: "It is the cheapest generator of complicated patterns and a rival hypothesis to continuous-math explanations.",
    see: ["Rule 110"]
  },
  "Rule 110": {
    short: "An elementary rule that is computationally universal.",
    long: "Rule 110 can in principle run any computation, as shown by Matthew Cook and published in 2004. That is a statement about computation, not that biology uses it.",
    why: "A good reminder that a pattern looking like a seashell is not evidence the shell runs that rule.",
    see: ["cellular automaton"]
  },
  "genetic drift": {
    short: "Random change in gene frequency from chance in finite populations.",
    long: "Each generation is a random sample of the last. In a small population, a harmless new mutation can take over just by luck. Kimura's neutral theory builds on this.",
    why: "It sets the baseline any claim about selection must beat.",
    see: ["fixation probability", "selection coefficient"]
  },
  "fixation probability": {
    short: "The chance a new mutation eventually takes over the whole population.",
    long: "For a neutral new mutation in a population of N individuals it is 1/N for haploids (1/(2N) for diploids). With a selection advantage s in a large population it is roughly 2s. The Labs panel compares simulation with the diffusion formula (1 - e^(-2Ns/N)) / (1 - e^(-2Ns)).",
    why: "Kimura's result is proved in the repo's claim set and is directly testable with mutation-scanning data.",
    see: ["genetic drift", "selection coefficient"]
  },
  "selection coefficient": {
    short: "How much extra reproductive success a variant has, as a fraction.",
    long: "If a variant leaves 1 + s offspring for every 1 of the normal type, s is its selection coefficient. s = 0.01 means a one percent advantage.",
    why: "Whether s beats 1/N decides if drift or selection wins.",
    see: ["genetic drift"]
  },
  "Hamilton's rule": {
    short: "A trait for helping relatives spreads when r times B exceeds C.",
    long: "r is genetic relatedness, B the benefit to the recipient, and C the cost to the actor, both measured in offspring. Full siblings have r = 0.5 in ordinary diploids. The related haplodiploidy hypothesis, which said ants and bees are special because sisters share 75%, is marked refuted in the repo's claim set.",
    why: "Proved as a rule, yet the famous biological story built on it did not hold, a lesson in the gap between math and organisms.",
    see: ["selection coefficient"]
  },
  "gnomon": {
    short: "A shape that, when added to a figure, keeps the figure similar to itself.",
    long: "Thompson used the word for the way a shell adds each new chamber or whorl so that the enlarged shell has the same shape as before. The pre-registered test of this on 179 ammonoid growth series came out against the strict version.",
    why: "It is one of the clearest cases where an elegant idea was refuted by data.",
    see: ["logarithmic spiral"]
  },
  "logarithmic spiral": {
    short: "A spiral whose distance from the center grows by a constant factor per turn.",
    long: "Radius r = a e^(b theta). It looks the same at every scale, so a shell can grow along it without changing shape.",
    why: "The shell panel in the Labs uses Raup's three-parameter version.",
    see: ["gnomon"]
  },
  "text-to-organism": {
    short: "The team's idea: describe an organism, get a multi-scale blueprint and genome sketch.",
    long: "Input is a description of an organism or function. Output is a graph of body, organ systems, organs, tissues and cells, plus a predicted genetic makeup. A credible first version returns the blueprint from existing ontologies and treats the genome as a labeled sketch.",
    why: "It is the application that would make the proven laws useful, and its held-out evaluation can be built from the species inventory.",
    see: ["phylogeny", "holdout"]
  },
  "BioNeMo": {
    short: "NVIDIA's platform and hosted models for biology.",
    long: "Includes structure prediction (OpenFold3, Boltz-2, ESMFold), protein design (RFdiffusion, ProteinMPNN), embeddings (ESM2), and the genomic model Evo 2, offered as NIM microservices.",
    why: "The hackathon's platform sponsor presents it in a Friday session, and the team's issue 14 maps it to claim verification.",
    see: ["NIM"]
  },
  "NIM": {
    short: "NVIDIA Inference Microservice: a packaged model you call over an API.",
    long: "Hosted at build.nvidia.com or run yourself in Docker on a GPU.",
    why: "It is how an agent would call a structure model as a tool.",
    see: ["BioNeMo", "MCP"]
  },
  "MCP": {
    short: "Model Context Protocol: a standard way for AI agents to call tools and read data.",
    long: "The collaborators run a DELPHI MCP server that lets any agent search claims, read their math, and rank assessments. Nebius also offers an MCP for its hosted science models.",
    why: "It lets different teams' agents share capabilities, which the collaboration bonus rewards.",
    see: ["NIM"]
  },
  "test registry": {
    short: "A practice network where nanopublications can be published safely first.",
    long: "Published nanopubs are permanent. The repo's rule is that every batch goes to the test registry first and is promoted to production only after review.",
    why: "A hackathon deadline is not a reason to skip this.",
    see: ["nanopublication", "supersede"]
  },
  "supersede": {
    short: "Publish a newer nanopub that replaces an older one, instead of editing it.",
    long: "Signed with the same key. The old version stays on the network forever, which is why mistakes are expensive.",
    why: "Same logic as amending a law rather than erasing it.",
    see: ["test registry"]
  }
};
