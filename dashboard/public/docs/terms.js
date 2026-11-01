// docs/terms.js — GENERATED from the scratchpad term chunks. Extends the site glossary
// (dashboard/public/glossary.js, 29 terms) with the terms the product report uses.
// Fields: short, long, why, see. `see` makes the glossary nested: every related term,
// and every glossary term mentioned inside a definition, opens its own definition.
window.GLOSSARY = Object.assign(window.GLOSSARY || {}, {
 "MorphoLemma": {
  "short": "The name this project is presented under: the design studio plus the validation harness.",
  "long": "MorphoLemma predicts an organism from a plain-language description, then checks it against biological law, physics, and the closest real organism that performs the same function. It is supported by DELPHI, the Lean-for-biology layer underneath.",
  "why": "Its default answer is a refusal with reasons, not a score.",
  "see": [
   "DELPHI",
   "validation harness",
   "design studio"
  ]
 },
 "DELPHI": {
  "short": "The repository and the Lean-for-biology layer underneath MorphoLemma.",
  "long": "DELPHI holds the law registry, the formalisation pipeline and the claim graph. Every path and record id in the code uses the name, which is why it still appears on screens.",
  "why": "If you see DELPHI on a page and MorphoLemma in a heading, they are one system.",
  "see": [
   "MorphoLemma",
   "law registry",
   "Lean"
  ]
 },
 "Lean": {
  "short": "A proof assistant: a language in which a machine checks every step of a proof.",
  "long": "Lean 4 with the Mathlib library. A statement that compiles has been checked by the Lean kernel, a small trusted program, rather than by a reviewer reading it.",
  "why": "Compiling proves a conclusion follows from its premises. It says nothing about whether any organism satisfies the premises.",
  "see": [
   "non-vacuity witness",
   "load-bearing hypotheses",
   "law registry"
  ]
 },
 "law registry": {
  "short": "The versioned list of biological laws a design is checked against.",
  "long": "Each law has a Lean statement, a status (accepted, candidate or contested) and a version. Laws are grouped into numbered lawsets so a check can be pinned to one.",
  "why": "A pinned lawset means a verdict can be reproduced later, even after the laws change.",
  "see": [
   "lawset",
   "cannot-evaluate",
   "Lean"
  ]
 },
 "lawset": {
  "short": "A numbered, frozen version of the law registry.",
  "long": "Checks name the lawset they ran against, for example 1.8.1. Releasing a new lawset mid-run cannot move an old result.",
  "why": "Without pinning, a verdict could quietly change underneath a published claim.",
  "see": [
   "law registry"
  ]
 },
 "cannot-evaluate": {
  "short": "A law's answer when the design does not state an input the law needs.",
  "long": "Not a pass and not a failure. It names exactly which input is missing, so supplying it and calling again is a mechanical next step.",
  "why": "A checker that always returns a number is one you cannot use. This one declines to guess.",
  "see": [
   "cannot-assess",
   "law registry"
  ]
 },
 "cannot-assess": {
  "short": "The harness's answer when a requirement cannot be judged at all.",
  "long": "Usually because the comparison organism has no data for it. Of 73 requirements on our headline design, 51 were unassessable.",
  "why": "It is the absence of a judgement. Reading it as a pass is the most common way a validator gets misused.",
  "see": [
   "cannot-evaluate",
   "validation harness",
   "functional analogue"
  ]
 },
 "non-vacuity witness": {
  "short": "Concrete numbers that satisfy every hypothesis of a law, proved rather than asserted.",
  "long": "A theorem whose hypotheses can never all be true is technically true and says nothing. The witness proves the hypotheses can actually be met.",
  "why": "It rules out laws that hold only because they never apply.",
  "see": [
   "load-bearing hypotheses",
   "Lean"
  ]
 },
 "load-bearing hypotheses": {
  "short": "Hypotheses a proof genuinely depends on.",
  "long": "The checker strips every relational hypothesis from a theorem and recompiles. If it still compiles, the hypotheses were decorative and the formalisation fails.",
  "why": "Compiling is not the bar. A statement that compiles but is trivially true is a failure.",
  "see": [
   "non-vacuity witness",
   "Lean"
  ]
 },
 "five named results": {
  "short": "The harness's five checks, reported separately and never added up.",
  "long": "Genotype similarity, phenotype similarity, the law check, functional resolution and physics. Each answers a different question, so strength on one cannot cover a failure on another.",
  "why": "Summing them would let a high similarity hide a design that cannot leave the water.",
  "see": [
   "validation harness",
   "composite score"
  ]
 },
 "validation harness": {
  "short": "The part of MorphoLemma that checks a design and decides what it can and cannot say about it.",
  "long": "It reports five named results that are never summed, then withholds the word validated and lists why.",
  "why": "It refused our own headline design, which is the point.",
  "see": [
   "five named results",
   "functional analogue",
   "composite score",
   "cannot-assess"
  ]
 },
 "functional analogue": {
  "short": "The real organism closest in FUNCTION to a design, not closest in relatedness.",
  "long": "In MorphoLemma this is not searched for. It comes from a hand-curated registry of four functions with at most two taxa each, and the first one marked as satisfying the function is chosen. No database is queried and no model is prompted to choose it.",
  "why": "When nothing qualifies, the harness says so instead of substituting the nearest relative.",
  "see": [
   "validation harness",
   "cannot-assess"
  ]
 },
 "composite score": {
  "short": "A single number the scorer produces, reported but never used as a verdict.",
  "long": "Adding one criterion the design already met moved the same design from 0.4676, not plausible, to 0.878, plausible. No released version has passed a blind evaluation.",
  "why": "A number that moves like that is not a score.",
  "see": [
   "five named results",
   "validation harness"
  ]
 },
 "design studio": {
  "short": "The part of MorphoLemma that turns a description into an organism, layer by layer.",
  "long": "A sentence becomes a specification in SI units, then descends through organ systems, tissues, cells, pathways and genes. It exports meshes for printing and sequences for a lab. It is in active development.",
  "why": "Clauses it cannot parse are reported rather than silently dropped.",
  "see": [
   "MorphoLemma",
   "validation harness"
  ]
 },
 "Exocoetus volitans": {
  "short": "A real flying fish, used as the comparison organism in the alignment.",
  "long": "Its protein rows come from the Daane et al. 2021 beloniform panel, projected onto medaka residues. They cover only part of most proteins and are absent for 3 of the 9 aligned genes.",
  "why": "Uncovered columns are drawn grey, as no data, rather than as agreement or difference.",
  "see": [
   "protein alignment",
   "no data"
  ]
 },
 "protein alignment": {
  "short": "Lining up two proteins residue by residue to see where they match.",
  "long": "Built with MAFFT L-INS-i from Ensembl 116 canonical proteins. It compares amino acids, not DNA, and it is not a whole-genome alignment.",
  "why": "The genome-wide difference, coding and non-coding, was never measured here.",
  "see": [
   "Exocoetus volitans",
   "no data"
  ]
 },
 "no data": {
  "short": "A column the comparison organism's sequence does not cover.",
  "long": "Drawn grey in the alignment. It is absence of evidence: neither agreement nor difference.",
  "why": "Painting it green would claim an agreement nobody measured, and red a difference nobody measured.",
  "see": [
   "protein alignment",
   "Exocoetus volitans"
  ]
 },
 "Xenobot": {
  "short": "A small living machine made by arranging frog cells into a designed shape.",
  "long": "Wild-type Xenopus skin and heart-muscle cells, sculpted into shapes an evolutionary algorithm searched over (Kriegman et al. 2020). There is no engineered genome: the design variable is the arrangement, and the target is movement.",
  "why": "Movement is a phenotype in time. Genotype similarity to a normal frog is near total and tells you nothing about whether it will move.",
  "see": [
   "phenotype in time",
   "five named results"
  ]
 },
 "phenotype in time": {
  "short": "A trait that only exists as a trajectory: gait, locomotion, development.",
  "long": "Most traits a validator checks are quantities at one stage, such as a length or a mass. A phenotype in time has to be checked as behaviour over time.",
  "why": "The harness has no time-varying target function today.",
  "see": [
   "Xenobot",
   "validation harness"
  ]
 }
});
