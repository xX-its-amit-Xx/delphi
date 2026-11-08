// Three registers per entry. entries.mjs is the DEEP one; this file is the other two.
//
// SKIM - for someone deciding whether to read more. A headline that is the most surprising TRUE thing in
//        the entry, not a topic label, and bullets that each carry a number or a concrete noun. The
//        constraint that does the work is that a bullet may not be a generality: "the controls were
//        useful" is out, "4 of 8 candidate constraints rejected" is in.
// BLOG - narrative prose for a curious outsider. Assume intelligence, not knowledge. Every blog post uses
//        the real numbers from the entry and names at least one place the work was WRONG, because
//        what_went_wrong is the most interesting array in each entry and a blog post that drops it is
//        marketing.
//
// Three entries - analogy, cases, ecology - carry an EMPTY what_went_wrong. Their blog posts still name a
// place the work was wrong, taken from the_detail_that_matters, and say that the entry's own list is
// empty. An empty list means nothing was written down, not that nothing was wrong.

export const REGISTERS = Object.freeze({
  'life-format': {
    skim: {
      headline: 'Geometry is present on all 31 cells of the worked example and measured on 0 of them',
      bullets: [
        '5 stages, 31 cells, 25 phenotype values in the worked example',
        'Geometry on 31 of 31 cells, MEASURED on 0 - the census line says so in the file',
        'Transcriptome and mechanics on 0 of 31 cells, declared in a required `not_established` block',
        '226 tests across the format modules; 0 of them survive their own injected fault',
        'The spec demanded `elastic_modulus_Pa` on the strength of a stale v1 abstract',
      ],
      so_what:
        'A design file that records what it does not know can be caught being wrong; one that records only ' +
        'its best guesses cannot.',
      read_time_seconds: 40,
    },
    blog: {
      title: 'A File Format That Can Be Wrong',
      hook:
        'A file describing an organism at rest cannot be wrong about development. It captures one moment ' +
        'and files the others as metadata, and a snapshot has nothing to be wrong with. Turn time into the ' +
        'primary axis and the file starts making claims that can be FALSE - that this cell count follows ' +
        'that one, that this stiffness falls as that lineage separates. Those are the claims worth storing.',
      body: [
        'A .life file is JSON with four required blocks. `identity` says what animal this is. `genome` is ' +
          'an edit list against a named reference assembly, which keeps it in the kilobytes rather than the ' +
          'hundreds of megabytes, and - more importantly - states what the design IS rather than what it ' +
          'resembles. `timeline.stages[]` is the spine. Each stage pins itself with a time, a time unit and ' +
          'a temperature, because development rate is temperature-dependent and a stage time without a ' +
          'temperature is not a stage. The fourth block is the one nobody asks for: `not_established`.',
        'Every value in the file carries a kind and a scope. The kinds are measured, measured-secondhand, ' +
          'borrowed, derived, calibrated, assumed and depicted. What falls out of that is a census, and the ' +
          'census is the most useful line in the file. The worked example - 5 stages, 31 cells, 25 ' +
          'phenotype values - comes to 10 measured-secondhand, 5 assumed, 5 depicted, 5 derived and 5 ' +
          'not-established. Nothing in it was measured by us. Geometry is present on 31 of 31 cells and ' +
          'measured on none. Transcriptome and mechanics are present on 0 of 31.',
        'That last sentence is the point of the format. A file that lists nothing it does not know is ' +
          'making the strongest possible claim by omission, and readers believe omissions. So the absence ' +
          'is a required field. An `unknown` in a .life carries no value at all, and that rule exists ' +
          'because a value shaped like {v: 0.31, unknown: true} sailed past every provenance check in the ' +
          'previous reader. A number with a disclaimer attached is still a number to whatever code reads it ' +
          'next.',
        'Here is where the spec was wrong. It required a field called `elastic_modulus_Pa`, following a ' +
          'published abstract that turned out to be a stale v1 deposit. The authors had since retreated to ' +
          '"relative compliance" - they no longer claimed to have measured a modulus. A field name can ' +
          'impose a unit the measurement does not have, and once a compliance ratio is sitting in a field ' +
          'called `_Pa`, no reader downstream can detect the lie. Requiring pascals does not produce ' +
          'pascals.',
        'The second mistake was worse, because it looked like diligence. The validator stringified its ' +
          '{what, answer} disclosure entries to "[object Object]" and therefore reported the worked example ' +
          'as missing all four required disclosures - while the example answered all four, verbatim, in the ' +
          'file being checked. A false negative in an honesty check is worse than having no check, because ' +
          'the clean report is what gets quoted. There are now 226 tests across the format modules, and ' +
          'the harness injects one fault per assertion and fails any assertion that does not notice. 0 ' +
          'survive.',
      ],
      closing:
        'The convention that remains unsettled is identity. If a simulated trajectory diverges from its ' +
        'design at stage 4, is it a failed instance of that design, or a different design? No amount of ' +
        'imaging decides that, so the format has to pick a convention and say which one it picked. Which ' +
        'is the right one to pick?',
      reading_level: 'technical-curious',
    },
  },

  benchmarks: {
    skim: {
      headline: 'An anatomically impossible fish scores more typical than 4,068 of 4,673 real ones',
      bullets: [
        'The guide score we rank by: rho = -0.037, CI [-0.149, 0.073] - the interval includes zero',
        'Design AUC 0.891 on shuffled decoys, 0.536 on real fish nudged a quarter of a standard deviation',
        'The impossible animal sits at q = 0.347, above 4,068 of 4,673 real specimens',
        'CRISPRscan layout re-derived by reproducing 25 published scores exactly, max difference 0.0000',
        'Only 1 of 48 theorem-carrying laws is expressible on the ten trait ratios',
      ],
      so_what:
        'Three of the four benchmarks came out badly, which is the only evidence that any of them could ' +
        'have.',
      read_time_seconds: 45,
    },
    blog: {
      title: 'Four Measurements, Three of Them Bad News',
      hook:
        'An animal whose dorsal fin begins past the end of its tail scores q = 0.347 on our design ' +
        'plausibility model. That ranks it above 4,068 of 4,673 real fish. The model is not broken. It is ' +
        'doing exactly what it was fitted to do, which is the uncomfortable part.',
      body: [
        '"61 laws registered, 73 machine-checked theorems" is not a result. It is a productivity figure, ' +
          'and productivity figures cannot come out badly - you can only build more or less. A benchmark ' +
          'has to be able to come out badly, and the only way to arrange that is to take the answer from ' +
          'somewhere the system does not control.',
        'Start with the guide score. CRISPR guide RNAs are short sequences that tell the editing enzyme ' +
          'where to cut, and some cut far better than others, so every design pipeline ranks them. Ours ' +
          'ranks them by a score that correlates with measured activity at rho = -0.037, confidence ' +
          'interval [-0.149, 0.073]. The interval includes zero. For comparison we reimplemented ' +
          'CRISPRscan, a published scorer, and derived its position layout by reproducing 25 of its ' +
          'published scores exactly, maximum difference 0.0000 - so the comparison is real and the number ' +
          'is ours to own.',
        'An earlier run of that same comparison gave rho = 0.75, which was thrilling for about an hour. ' +
          'The alignment was off by a fixed offset: reverse-complementing a sequence window flips its ' +
          'flanking regions along with it, so the score was being read against the wrong positions. A good ' +
          'number at the wrong offset is indistinguishable from a good number. It would have shipped.',
        'The design scorer went the same way. Against decoys built by shuffling trait values it reaches ' +
          'AUC 0.891, which sounds like a working discriminator. Against real fish nudged by a quarter of ' +
          'a standard deviation it reaches 0.536, which is approximately a coin. The written prediction ' +
          'before that run said correlation-preserving decoys would score 0.5 "by construction". They ' +
          'scored 0.663, because the fitted Gaussian is overdispersed relative to real fish - the model ' +
          'thinks the space of possible animals is wider than it is. The wrong prediction taught more than ' +
          'the right one would have, which is an argument for writing predictions down.',
        'The proof layer came out clean and still unflattering. All 48 theorem-carrying laws now carry a ' +
          'machine-checked non-vacuity witness, so none of them is true merely because its hypotheses ' +
          'cannot be satisfied. But only 1 of those 48 can be evaluated on the ten body-ratio traits we ' +
          'actually have, because the registry speaks in quantities those traits do not carry: two sizes, ' +
          'a population, a power budget, a genotype. A law you cannot evaluate on your data is not yet a ' +
          'constraint on your design.',
      ],
      closing:
        'None of this tells us whether a plausibility score can ever be evidence of viability. A ' +
        'Mahalanobis distance measures how unusual a vector is under a fitted distribution; more data ' +
        'estimates the distribution better without turning "unusual" into "impossible". The gap is ' +
        'structural and would survive a perfect model, so what exactly would a viability score have to ' +
        'measure instead?',
      reading_level: 'technical-curious',
    },
  },

  controls: {
    skim: {
      headline: '"The pectoral fin sits behind the head" is false for 39% of real fish',
      bullets: [
        '39% of 4,673 real specimens violate a constraint that sounds like settled anatomy',
        'Real-specimen controls rejected 4 of 8 candidate constraints in one module, 7 of 13 in another',
        'A constraint may gate only at support exactly 1.0; the shipped gate refuses 0 of 4,673 real fish',
        'The 1 mutant marked is_control came back UNPROVEN - the harness was too weak, not the theorem',
        'A leak gate chained behind `git commit` with && let a flagged leak through',
      ],
      so_what:
        'Without a control you cannot tell "the system failed" from "my harness cannot see anything", and ' +
        'those two look identical in a passing test run.',
      read_time_seconds: 35,
    },
    blog: {
      title: 'The Control Keeps Catching Me',
      hook:
        'Every control built this week caught my own work rather than the system it was pointed at. ' +
        '"The pectoral fin sits behind the head" sounds like anatomy you could teach. It is false for 39% ' +
        'of 4,673 real specimens.',
      body: [
        'Four properties of a benchmark are standard: it takes its answer from outside the system, it can ' +
          'fail, it states its scope, and it reproduces. The fifth is not standard and is the one that ' +
          'actually bit. A benchmark needs a control - something whose answer you already know - because ' +
          'otherwise a clean run is ambiguous between "the system passed" and "the harness cannot see".',
        'The fin constraint shows what that buys. It was proposed as a gate: reject any design whose ' +
          'pectoral fin is in front of the head. Checked against real specimens it rejects 39% of them. ' +
          'So the rule in this repository is now enforced in code rather than in a comment: a constraint ' +
          'may gate only when its recorded support over a real sample is exactly 1.0. The gate that ' +
          'shipped refuses 0 of 4,673 real fish, and that single property is the whole reason it is ' +
          'deployable. A gate that rejects real animals is worse than no gate, because it looks like ' +
          'rigour.',
        'Rejected constraints are not deleted. Each one is kept with the share of real specimens that ' +
          'satisfy it and a `why_not`, so the near-miss stays in the file and the same mistake cannot be ' +
          'made again quietly. One module lost 4 of 8 candidates that way; another lost 7 of 13. The ' +
          'pattern across both is worth stating plainly: a plausible-sounding anatomical rule is about as ' +
          'likely to be wrong as right.',
        'Two of my own mistakes came out of the same week. A mutant in the proof layer was aimed the wrong ' +
          'way - widening a disjunct WEAKENS a conclusion, so the mutant meant to be false stayed true, ' +
          'and the proof assistant said so precisely by placing the attempted counterexample inside the ' +
          'measured band. Separately, I ran a holdout leak gate and a commit in one && chain, so the ' +
          'flagged leak did not block the commit. A gate chained behind the action it guards is not a ' +
          'gate; it is a log line.',
        'The control that worked best was the one designed to succeed. A deliberately weakened mutant that ' +
          'MUST survive came back UNPROVEN, which revealed that the proof harness was too weak to ' +
          'establish even a statement I knew to be true. That diagnosis only worked because I knew it ' +
          'independently.',
      ],
      closing:
        'Which raises the regress the whole scheme sits on: how do you control a control? At some point a ' +
        'human judgement terminates the chain, and automation does not remove that point, it only moves ' +
        'it further back. Where should it sit?',
      reading_level: 'technical-curious',
    },
  },

  analogy: {
    skim: {
      headline: 'One alignment, three defensible percent identities: 100.0%, 75.0% and 60.0%',
      bullets: [
        'Percent identity has 3 defensible denominators; the module returns all three rather than picking',
        'BLOSUM62 checked cell by cell: 24x24, 0 of 576 entries asymmetric',
        'kcnk5b has a paralog kcnk5a - 1 mammalian gene mapping to 2 fish genes that split the job',
        'The SpCas9 blunt cut is 3 bp 5\' of the PAM, asserted six ways',
        'GATTACA against GATACA scores exactly 9, hand-computed and asserted',
      ],
      so_what:
        'Borrowing a structure from one species into another requires deciding when two genes do the same ' +
        'job, and orthology does not answer that question.',
      read_time_seconds: 40,
    },
    blog: {
      title: 'Same Gene, Different Job',
      hook:
        'A single mammalian gene can map onto two zebrafish genes, each doing part of the ancestral job. ' +
        'Pick one, call it "the" orthologue, and you get a cassette that fails at the bench for a reason ' +
        'that never appears in the alignment. kcnk5b and its paralog kcnk5a are the live instance in this ' +
        'repository.',
      body: [
        'DELPHI designs by borrowing a structure from one species into another, which means it constantly ' +
          'has to decide whether a gene in A is the functional analogue of a gene in B. The pipeline ' +
          'treated orthology as the answer to that question. Orthology is not the answer to that question. ' +
          'Homology is shared ancestry; analogy is shared function with or without it. An orthologue can ' +
          'have diverged entirely, a one-to-many orthologue is not an equivalent of anything, and the ' +
          'convergent cases a design programme most wants - the same solution evolved twice - have no ' +
          'orthology at all.',
        'The sharpest version is the teleost problem. An ancient whole-genome duplication in the fish ' +
          'lineage left many zebrafish genes as duplicate pairs that have split the ancestral function ' +
          'between them. A mapping that picks one member and labels it the orthologue is not approximately ' +
          'right. It is wrong in a way that shows up only as a failed experiment, months later, with no ' +
          'diagnostic.',
        'So the arithmetic in this module is deliberately unhelpful where the biology is ambiguous. ' +
          'Percent identity has three defensible denominators - alignment columns, shorter sequence, ' +
          'longer sequence - and on one real alignment they give 100.0%, 75.0% and 60.0%. The module ' +
          'returns all three and refuses to pick, because picking is what lets a single number travel ' +
          'downstream as if it were a measurement. The alignment underneath is a real Gotoh affine-gap ' +
          'implementation: BLOSUM62 is verified 24x24 with 0 of 576 entries asymmetric, and a ' +
          'hand-computed case, GATTACA against GATACA, is asserted at exactly 9. The SpCas9 blunt cut is ' +
          'pinned 3 bp to the 5\' side of the PAM and asserted six separate ways, because an off-by-one ' +
          'there designs a cassette that integrates in the wrong place.',
        'This entry carries an empty what_went_wrong list, which is not the same as nothing having gone ' +
          'wrong. The error was in the premise rather than in a line of code: the earlier pipeline ' +
          'reported orthology and let the reader infer equivalence. Nothing crashed. Nothing failed a ' +
          'test. The mapping was simply answering a different question from the one being asked, which is ' +
          'the failure mode that no test suite catches, and the reason EVIDENCE_KINDS now keeps rescue ' +
          'experiments, synteny, expression similarity and domain architecture as separate kinds instead ' +
          'of averaging them into a confidence number.',
        'One more refusal worth naming. Every fetch here distinguishes three outcomes that are usually ' +
          'collapsed into one: the API said no, the API failed, and we did not ask. "No orthologue found" ' +
          'in the third case is not evidence of anything, and genome responses are cached outside the ' +
          'repository so that the distinction survives a rerun.',
      ],
      closing:
        'Underneath all of it sits a question measurement does not reach. What makes two structures the ' +
        'same structure? Sequence, position, development and expression are all correlates of homology, ' +
        'and they disagree - a structure can be positionally homologous and developmentally novel. No ' +
        'instrument returns "same", only "similar in this respect". So which respect should a design ' +
        'system believe?',
      reading_level: 'specialist',
    },
  },

  cases: {
    skim: {
      headline: 'The cow that burps less is not a problem in the cow\'s genome',
      bullets: [
        '3 requests, 3 different failure modes, and only 1 of them is a genome-editing problem',
        'Enteric methane comes from rumen archaea; the cow genome carries 0 methanogenesis pathways',
        'A GFP fly needs excitation light, so it glows in exactly 0 dark rooms',
        '8 storyboard stages per case; the test asserts at least 1 case refuses before reaching a cassette',
        'Unverified DOIs are stored as null and flagged, because a fabricated DOI is worse than none',
      ],
      so_what:
        'A design system that answers "CRISPR cassette" to every request would have been wrong three times ' +
        'out of three here, and confidently.',
      read_time_seconds: 35,
    },
    blog: {
      title: 'A Glowing Fly, a Fatter Worm, and a Quieter Cow',
      hook:
        'Three requests arrive: make a fly glow, raise the protein content of a worm, make a cow burp less ' +
        'methane. They read like three versions of the same job. Only one is a genome-editing problem in ' +
        'the shape the pipeline assumes, and one of them is not about the named animal at all.',
      body: [
        'Take the fly first, because it fails before any biology starts. Fluorescent protein needs ' +
          'excitation light to emit, so a GFP fly glows in exactly 0 dark rooms. Bioluminescence is the ' +
          'other thing people mean, and that needs a luciferase AND a substrate the fly cannot ' +
          'manufacture. Which of the two was wanted is a fact about the person asking, not about the fly, ' +
          'and it changes the entire design. Either way the function is ADDED rather than transferred, so ' +
          'there is no orthologue to find and nothing to map - and the classic tool is transgenesis, not ' +
          'a knock-in.',
        'The worm is a different shape of wrong. Protein content is polygenic. There is no single edit, ' +
          'and a pipeline that returns one has quietly substituted a tractable problem for the one it was ' +
          'given.',
        'The cow is the interesting one. Enteric methane is produced by archaea living in the rumen. The ' +
          'cow genome encodes no methanogenesis pathway, so editing the cow is editing the wrong organism. ' +
          'Methane yield does have non-zero heritability, through host effects on the rumen environment, ' +
          'which makes it a selection target - and a heritability estimate, however precise, does not ' +
          'contain the claim that any particular locus is an EDIT target.',
        'What went wrong here is recorded as an empty list, which is misleading in the usual direction: ' +
          'the system never shipped the error, but only because the three cases were written down before ' +
          'anything was generated. Left alone, Delphi produces a cassette for whatever is put to it - ' +
          'fluency is its characteristic failure - and it would have produced three. So each case now ' +
          'carries the request as the lead phrased it, what is actually being asked, whether the target ' +
          'organism is even the right one, a verdict from a closed vocabulary, and a CRISPR_RELEVANCE ' +
          'field whose job is to say "not this tool". The storyboard has 8 stages per case, and its test ' +
          'asserts both that at least one case refuses before reaching a cassette and that not every case ' +
          'refuses. A demo where everything works is a broken demo; so is one where nothing does.',
      ],
      closing:
        'The methane case leaves a boundary question nobody can sequence their way out of. If the trait ' +
        'you want belongs to an associated microbial community, is the designed organism the cow, the ' +
        'holobiont, or the archaea - and who decides what counts as the unit being engineered?',
      reading_level: 'general',
    },
  },

  ecology: {
    skim: {
      headline: 'A design that grows 67% faster is still competitively excluded',
      bullets: [
        'Design mu_max 0.5 / Ks 1.0 gives R* 0.25 and loses to an incumbent at R* 0.05',
        'The faster design would have to be 5x better at low substrate to survive the release',
        '0 designed organisms in this repository have a measured mu_max or Ks, so every assessment refuses',
        'Reverse only the 2 consumption vectors, leave all 4 R* values identical, and coexistence flips',
        'R* = Ks*D/(mu_max - D) - the rule says EXCLUDES, not "does better"',
      ],
      so_what:
        'The quantity that decides whether a released design survives is affinity at low substrate, and ' +
        'the design objective optimises rate.',
      read_time_seconds: 35,
    },
    blog: {
      title: 'Faster and Still Dead',
      hook:
        'Two lines of arithmetic. A design with mu_max 0.5 and Ks 1.0 has R* 0.25. An incumbent with ' +
        'mu_max 0.3 and Ks 0.1 has R* 0.05. The design grows 67% faster and is competitively excluded ' +
        'anyway.',
      body: [
        'Tilman\'s R* rule is the reason. With a single limiting resource at steady state, the species ' +
          'with the lowest R* - the resource concentration at which its growth exactly balances its loss ' +
          'rate - excludes the others. Not outcompetes on average. Excludes. R* = Ks*D/(mu_max - D), ' +
          'where Ks is the half-saturation constant, so the outcome turns on affinity at low substrate at ' +
          'least as much as on maximum growth rate.',
        'That is awkward for a design pipeline, because maximum growth rate is what a design pipeline ' +
          'optimises and what a growth curve in a rich medium reports. An engineered pathway typically ' +
          'costs low-substrate performance, which means optimising for rate can actively worsen the ' +
          'quantity that decides survival. In the worked example the design would need to be 5x better - ' +
          'in Ks, not in rate - before it won.',
        'Three numbers settle the single-resource question for any organism: mu_max, Ks, and the loss rate ' +
          'D of the environment it enters. So the module refuses to assess any design that lacks a ' +
          'measured mu_max and Ks. It returns the bar the design would have to clear and the three ' +
          'measurements that would settle it, and nothing else. 0 designed organisms in this repository ' +
          'have those measurements, so every assessment currently refuses - which is the honest output, ' +
          'because a competition outcome computed from invented growth constants is indistinguishable ' +
          'from one computed from data.',
        'The two-resource module then corrected the one-resource module, and the correction is on the ' +
          'record even though this entry\'s what_went_wrong list is empty. A note titled ' +
          'WHAT_R_STAR_IGNORES claimed that adding a second resource makes the single-resource conclusion ' +
          '"lapse entirely". It does not. It GENERALISES: a species with the lower R* on both resources ' +
          'still excludes the other outright, at every supply point. The conclusion lapses only where the ' +
          'two isoclines cross, which is exactly where there is a real trade-off - and overstating the ' +
          'limits of your own result is a way of being wrong that feels like modesty.',
        'The trade-off region has a property worth knowing before anyone releases anything. Reverse only ' +
          'the consumption vectors - who eats more of which resource - and leave all four R* values ' +
          'untouched, and stable coexistence flips to founder control. Same organisms, same affinities, ' +
          'opposite outcome, decided by who arrived first.',
      ],
      closing:
        'All of which assumes R* is the right frame for a release at all. It describes steady state in a ' +
        'well-mixed system, and soil is neither steady nor well mixed. The best defence is that it is the ' +
        'BEST CASE for the design - if it loses here it loses everywhere - but is a best-case model the ' +
        'right thing to hand a regulator?',
      reading_level: 'technical-curious',
    },
  },

  holdout: {
    skim: {
      headline: 'One survey keeps all 62 registry rows while naming only 60 of them',
      bullets: [
        '2 leaks reached a commit this week; both were fixed by redaction, 0 by allowlisting',
        '2 law ids are read from the registry at runtime so the identifiers never appear in source',
        '1 of 15 triaged problems was withdrawn rather than written, which is why the count is 14',
        'The leak gate reads 0 .html and .glb files, so those are checked by hand',
        'A claim id can leak the evaluation even when no organism is named anywhere in the file',
      ],
      so_what:
        'A system tuned against a leaked evaluation set has measured itself, and no later analysis can ' +
        'undo that.',
      read_time_seconds: 30,
    },
    blog: {
      title: 'The Clade We Do Not Name',
      hook:
        'One entire class of animals is unspeakable in this repository. Not the species names, not the ' +
        'class name, not even the id of a claim whose organisms all belong to it. A comparative-biology ' +
        'project with a deliberate hole in it shapes the code in visible ways: one survey keeps all 62 ' +
        'rows of the law registry while naming only 60 of them.',
      body: [
        'The reason is ordinary and strict. A held-out evaluation set is only held out if nothing leaks ' +
          'into the work, and "nothing" includes more than species names. A clade name tells a later ' +
          'reader what the evaluation is about. So does the id of a claim whose organisms are all on the ' +
          'held-out side, even in a file that names no organism at all. A system tuned against a leaked ' +
          'holdout has measured itself, and the measurement cannot be repaired afterwards.',
        'So there is a gate. It scans for the scientific names, the slugs, the database identifiers and ' +
          'the claim ids of the held-out roster, reports leaks and warnings as separate categories, and ' +
          'exits non-zero on a leak. Around it, the code bends. 2 rows in one survey take their law_id ' +
          'from the registry at runtime so the identifiers never appear in source. In another module, 1 ' +
          'of 15 candidate problems was withdrawn rather than written, with a comment explaining why the ' +
          'published count is 14 and not 15.',
        'Two leaks reached a commit anyway. One came from a `git add` on a whole directory, which swept in ' +
          'a half-written module from an agent that was still running. The other came from chaining the ' +
          'leak gate and the commit together with &&, so the gate ran, flagged, and did not block ' +
          'anything. Those are the same root cause wearing two hats: a broad command acting on whatever ' +
          'happens to be there. Both were fixed by redacting the text, never by adding an allowlist ' +
          'entry, because an allowlist entry is a judgement about the scope of the evaluation and that ' +
          'judgement belongs to whoever owns the evaluation.',
        'The gate also has a documented blind spot: it reads 0 .html and .glb files, so those are grepped ' +
          'by hand. Writing the blind spot down is not the same as covering it, and a gate is only as ' +
          'good as the habit around it.',
      ],
      closing:
        'The honest position is uncomfortable. A leak check counts tokens; it cannot count influence. ' +
        'There is no measurement of how much information about an evaluation entered the design that was ' +
        'evaluated, so how much can leak before a holdout stops being one?',
      reading_level: 'general',
    },
  },

  'scale-ladder': {
    skim: {
      headline: 'Three of the five levels of biological organisation have no representation here at all',
      bullets: [
        'organelle, cell, tissue, organ, organism: 3 of 5 rungs carry any representation, 2 carry none',
        'the organ rung is an identifier with nothing behind it',
        'the cell rung is 31 real cells from the worked file, 31 of 31 with geometry and 0 of 31 measured',
        'the span from an organelle to an organism is roughly 6 decades of length',
      ],
      so_what:
        'The missing rungs are tissue and organ, which is exactly where the phenotypes a design pipeline ' +
        'cares about actually live.',
      read_time_seconds: 30,
    },
    blog: {
      title: 'The Ladder With Two Missing Rungs',
      hook:
        'Every talk on multiscale biology opens with the same five boxes: organelle, cell, tissue, organ, ' +
        'organism. The arrows between them do the work nobody has done. We built the ladder as a data ' +
        'structure instead of a drawing, because a data structure cannot draw an arrow it does not have.',
      body: [
        'The question a ladder like this is supposed to answer is how a constraint at one level becomes a ' +
        'constraint at another. A packing limit on cells and an aspect-ratio limit on a body are both ' +
        'real; whether the first entails the second is the whole problem.',
        'So each rung in the file carries three things: its length scale in metres, what in this project ' +
        'actually represents it, and - where nothing does - an empty string rather than an aspiration. ' +
        'Counted that way, 3 of 5 rungs carry any representation and 2 carry none. The organ rung has an ' +
        'identifier and nothing behind it.',
        'The one well-populated rung is the cell, and it is populated from the worked developmental file ' +
        'rather than from a plausible-looking cloud: 31 real cells, all 31 carrying geometry, and 0 of 31 ' +
        'measured. The page says so in those words. A rung populated by a drawing and a rung populated by ' +
        'data must not look the same, or the ladder becomes a picture again.',
        'The payoff is that another result in this project stops being mysterious. Only one of the ' +
        'registry laws that carry a theorem speaks in a quantity our traits carry, and the ladder explains ' +
        'why: the laws are about parts, the traits are about whole animals, and nothing here converts ' +
        'between them. Building the ladder did not fix that. It located it.',
      ],
      closing:
        'The two empty rungs are tissue and organ - which is where almost everything anyone wants to ' +
        'design actually happens. So what is the smallest piece of a body plan that is worth representing ' +
        'on its own terms, and is that a question about biology or about us?',
      reading_level: 'general',
    },
  },

  analogues: {
    skim: {
      headline: 'Ten borrowing proposals scored on evidence; only one reaches "strong"',
      bullets: [
        '10 pairs: 1 strong, 3 moderate, 2 weak, 2 no-support, 2 unbanded for want of any evidence',
        'the only strong one is the only one where a cross-species rescue was actually performed',
        'a deliberate negative control separated from its positive: moderate against no-support',
        '437 assertions across the dossiers, 0 survivors under fault injection',
        'Ensembl types the carp-into-zebrafish mapping as the literal string ortholog_many2many',
      ],
      so_what:
        'Orthology is a claim about ancestry and these are claims about function, so the module reports a ' +
        'band of words over seven evidence kinds rather than a number that would be read as a probability.',
      read_time_seconds: 40,
    },
    blog: {
      title: 'The Gene That Is Two Genes',
      hook:
        'A crucian carp survives months without oxygen by brewing ethanol in its own muscle. It does this ' +
        'with a duplicated copy of a housekeeping enzyme subunit that was repurposed for the job. Moving ' +
        'that trick into a zebrafish is exactly the kind of borrow this project exists to evaluate, and it ' +
        'is where the evaluation broke.',
      body: [
        'The pipeline’s assumption is that you can name the host gene that corresponds to the donor gene. ' +
        'Zebrafish has two copies where the question expects one. Ensembl Compara does not even call that ' +
        'one-to-many: it types the relationship as the literal string ortholog_many2many, because the ' +
        'human genes return the same two host genes from either direction.',
        'That is the familiar problem and it is survivable. The unfamiliar one is worse. The donor’s ' +
        'housekeeping copy - the one that kept making acetyl-CoA inside the intact complex - sits in the ' +
        'same clade as the repurposed copy that makes acetaldehyde. So whichever host gene falls in that ' +
        'clade is equally the nominal orthologue of both donor functions. Orthology cannot separate the ' +
        'two things a borrow would have to tell apart, and the ambiguity is not about which host gene to ' +
        'pick but about which job is being moved.',
        'The source paper names neither host gene. It identifies the host copies by clade label, with no ' +
        'symbol and no accession, so even the shape it does report cannot be turned into a mapping. And a ' +
        'symbol search returned a third gene identifier that turned out to be an alternate-haplotype copy ' +
        'of one of the two: counting it would have made a two-gene family look like three.',
        'This is why the module scores evidence rather than orthology. Seven kinds - rescue, loss of ' +
        'function, orthology, synteny, expression domain, domain architecture, positional correspondence - ' +
        'each marked present with what, or absent with why. Across 10 pairs exactly 1 reaches strong, and ' +
        'it is the mouse-into-pig thermogenesis case, where somebody actually performed the substitution ' +
        'and measured the animal afterwards.',
        'The control mattered as much as the result. One pair was included specifically to fail: a fish ' +
        'embryonic arrest against an insect adult arrest, two different things at two different life ' +
        'stages. It banded no-support while its genuine counterpart banded moderate. A scoring system that ' +
        'cannot separate those is measuring enthusiasm.',
      ],
      closing:
        'When one gene in one species corresponds to two in another, the phrase "the orthologue" does not ' +
        'refer to anything. Sequencing more genomes makes that sharper rather than smaller - so what ' +
        'should a design pipeline say when the question it was built to answer turns out not to be open?',
      reading_level: 'technical-curious',
    },
  },

  outreach: {
    skim: {
      headline: 'Twenty-four research profiles, and five of them say we have nothing they need',
      bullets: [
        '24 candidates, 56 verbatim quotes, 24 carrying a caution about why they might decline',
        '23 of 24 have stated rather than inferred evidence that they collaborate',
        '2 cited DOIs were rejected: one resolved to an unrelated paper, one to the wrong author list',
        '5 of the 12 fish biologists state outright that they are not partners in this sense',
        'the build aborts rather than warns if an email address appears anywhere in the bundle',
      ],
      so_what:
        'A collaboration file that cannot say "they would be right to refuse" is a pitch deck, and the ' +
        'reasons to refuse are the most useful thing in it.',
      read_time_seconds: 35,
    },
    blog: {
      title: 'Reasons They Would Be Right To Say No',
      hook:
        'Twenty-four labs, read closely enough to quote them accurately. The most useful section in every ' +
        'profile turned out to be the one explaining why that person should probably decline.',
      body: [
        'Lab-in-the-loop is a nice phrase that means very little until you name the measurement someone ' +
        'would actually make. So each of the 24 profiles ends with what we would have to bring, and for ' +
        'several the honest answer is nothing they need. 5 of the 12 fish biologists are in that position ' +
        'by their own published account of what their bottleneck is.',
        'Every quote in the file is verbatim with a source, or it is not in the file. That rule cost more ' +
        'than expected. Two cited identifiers were rejected outright - one resolved to an unrelated paper, ' +
        'one to a paper whose author list did not include the person it was meant to support. Re-reading ' +
        'five web quotes against raw page bytes, rather than a fetch that summarises, caught two more that ' +
        'would otherwise have shipped.',
        'One quote was refused on authorship grounds alone. The best available passage came from a jointly ' +
        'authored essay with per-author sections, and we could not establish who wrote that paragraph. A ' +
        'sentence attributed to the wrong real person is the worst thing a project like this can produce, ' +
        'and there is no version of it that is nearly right.',
        'The privacy rule is enforced rather than promised: the build refuses to write the file if an email ' +
        'address appears anywhere in the serialised bundle. It aborts, it does not warn, because a check ' +
        'that warns and continues is a check that gets ignored. It was also fired against a planted ' +
        'address, so a pattern that silently stopped matching could not pass by matching nothing.',
      ],
      closing:
        'The section about what we bring leads with our own worst numbers rather than our best. That is ' +
        'either the most credible way to start a collaboration or the least persuasive - and which it is ' +
        'stays open until somebody answers.',
      reading_level: 'general',
    },
  },

  'retro-validation': {
    skim: {
      headline: 'We wrote down eleven predictions, committed them, then looked: two were right',
      bullets: [
        '11 pre-registered predictions: 2 supported, 7 refuted, 1 untestable, 1 mis-specified',
        'the same 9 species give +0.43 at one pH and -0.63 at another, from identical sequences',
        'Pearson(histidine count, difference between the two charge conventions) = 1.000',
        'opsin colour prediction missed by 4.67 nm against a predicted 8-25 nm band',
        'the largest mutually comparable set of toxin-resistance values is 18, against a predicted 6',
      ],
      so_what:
        'The answers were measured by people who never heard of this project, so for once a good score ' +
        'could not come from fitting the test to the system - and mostly the score was bad.',
      read_time_seconds: 40,
    },
    blog: {
      title: 'Wrong, On The Record, Before Lunch',
      hook:
        'Every benchmark in this project was written by the same hands that built the thing it measures. ' +
        'That is the weakest possible footing. So we picked four relationships that are already published, ' +
        'wrote down what we expected, committed the predictions to version control, and then looked.',
      body: [
        'The first case is a known relationship between a muscle oxygen-storage protein and how long a ' +
        'diving mammal can hold its breath. The proposal is that like charges keep the protein from ' +
        'clumping at the very high concentrations found in diving muscle, so more charge should mean ' +
        'longer dives. We computed the charge from sequence for 9 species with a sourced maximum dive ' +
        'duration and checked.',
        'The relationship came out positive at one pH and negative at another. Same 9 species, same ' +
        'sequences, same durations: +0.43 at the pH the literature uses, -0.63 at the pH our ' +
        'pre-registration had committed to. That is not noise, and it is not a bug. The entire difference ' +
        'between the two conventions is the histidine count - the correlation between them is 1.000 - and ' +
        'histidine is the one residue that changes its charge across that pH range.',
        'So "net charge" does not name one number. Across these species the two conventions are ' +
        'essentially uncorrelated with each other, which means a pipeline that computes a charge without ' +
        'stating a pH and a set of ionisation constants can produce either sign of a published finding ' +
        'without anything going wrong. Nothing here contradicts the original result: at the original pH we ' +
        'recover the original direction. It says the careful part of their method was the load-bearing part.',
        'The other three cases went against us too, in the opposite direction. We predicted that a rule for ' +
        'predicting the colour an eye pigment absorbs would be good to 8-25 nm; it was good to 4.67 nm. We ' +
        'predicted that toxin-resistance measurements across labs would be too incompatible to assemble ' +
        'six comparable values; there are 18. Being wrong about how bad the literature is turns out to be ' +
        'as common as being wrong about how good our code is.',
        'The most instructive failure was neither. One prediction was mis-specified from the NAME of the ' +
        'quantity: we reasoned at length about a "surface" charge needing structure, and the published ' +
        'methods text defines it as a sum over all ionisable groups with no surface restriction at all. ' +
        'The pre-registration is still in the repository, wrong, because the point of writing it first is ' +
        'that you do not get to edit it afterwards.',
        'And the most eye-catching number in our first draft was an artefact of our own fetching rule. ' +
        'Preferring curated database entries gave one diving mammal double everyone else’s charge, ' +
        'because that curated entry predates genome sequencing and has eleven unknown residues in it. The ' +
        'complete, uncurated entry puts the species back in the middle. Curated does not mean complete.',
      ],
      closing:
        'A relationship that reverses with a modelling convention is still somebody’s result - but whose? ' +
        'No further measurement of those animals decides it, because the convention is a claim about what ' +
        'the mechanism is rather than about what the animals are. That one stays open.',
      reading_level: 'technical-curious',
    },
  },

  atlas: {
    skim: {
      headline: 'The deposited nucleosome does not match the textbook nucleosome',
      bullets: [
        'the DNA sweeps 1.81 superhelical turns, not the quoted 1.65 - 1.805 and 1.810 in two structures',
        'rise per base pair is 3.341 A, not 3.4, which is 16 mm over a mouse genome',
        'proteins sit 8.69 nm apart: the average gap is about one protein wide, so clear fluid is never right to draw',
        'the stored two-cell embryo has its two cells 16.5 um apart with radii of 31.75 um',
        '6 levels, 607 assertions, 0 survivors under fault injection',
      ],
      so_what:
        'A zoomable viewer asserts a size, a count and a speed at every level and almost nobody checks ' +
        'them, so here the positions are invented, everything else is sourced, and each is labelled.',
      read_time_seconds: 40,
    },
    blog: {
      title: 'The Cells Would Not Split',
      hook:
        'The request was simple: make the embryo animate so you can watch the cells divide. The file had ' +
        'five stages, one cell becoming sixteen, with the volumes conserved to four decimal places. It ' +
        'should have been an afternoon. The cells refused to split.',
      body: [
        'Cleavage is division without growth, so the two daughters must add up to the parent. That gives ' +
        'an animation for free: let the two centres separate, and solve for the radius that keeps the ' +
        'combined volume constant. Do it that way and the waist appears on its own, because two ' +
        'overlapping spheres make one. No easing curve, no keyframes, just the constraint. It holds to ' +
        'one part in a billion at every frame.',
        'Then the division was drawn, and nothing pinched. In the stored file the two daughter cells sit ' +
        '16.5 micrometres apart while each has a radius of 31.75 micrometres - they are very nearly ' +
        'inside one another, and their combined outline is 31% smaller than the cell they came from. ' +
        'Every pair at the four-cell stage overlaps. Drawn faithfully, a dividing cell just changes colour.',
        'This looked like a bug in the file until the geometry was done properly. You cannot fit several ' +
        'equal spheres of total volume V inside a sphere of volume V. Spheres cannot fill more than about ' +
        '74% of space even in the best possible packing, and a handful of them inside a container do much ' +
        'worse. So a drawing of cleavage has three options and must pick one: let the cells overlap, let ' +
        'the embryo appear to grow, or stop drawing cells as spheres.',
        'The third is what actually happens. Blastomeres flatten against one another, and in a mouse ' +
        'embryo the eight-cell stage compacts - a change in shape and stickiness, not in volume. A file ' +
        'that stores a centre and a radius cannot say it. The stage with the most interesting mechanics ' +
        'in the whole sequence is the one the representation cannot draw, and no amount of imaging fixes ' +
        'that, because it is a choice about the format rather than a gap in the data.',
        'The viewer now offers the second option behind a button, with the price displayed: making the ' +
        'cells touch expands the stages by between 2.5 and 3.8 times and inflates the embryo by 1.93. ' +
        'Neither picture is right. One hides the cells inside each other and the other grows an embryo ' +
        'that does not grow. The panel says so rather than picking quietly.',
        'The same discipline, applied to the molecular end, kept finding things. The nucleosome is quoted ' +
        'everywhere as wrapping 1.65 turns of DNA; integrating the azimuth in the deposited coordinates ' +
        'of two separate crystals gives 1.81 and 1.805. Probably different definitions - the famous ' +
        'figure likely describes the tightly bound core while the integral includes the flared ends - but ' +
        'no sentence defining it was found, so both are recorded and neither is averaged away. The rise ' +
        'per base pair is 3.341 angstroms rather than 3.4, which sounds like nothing and is 16 millimetres ' +
        'of DNA once a mouse genome is laid end to end.',
      ],
      closing:
        'The viewer draws invented positions at measured sizes, and labels which is which at every level. ' +
        'That still leaves the hardest case open: when the textbook number and the coordinates it came ' +
        'from disagree, and both are probably right about different things, what is a teaching tool ' +
        'supposed to draw?',
      reading_level: 'general',
    },
  },
  counting: {
    skim: {
      headline: 'A hundred million measured cells cannot count the machines in one of them',
      bullets: [
        'P(all twelve Pol II subunits detected in one cell) is 3.6e-15, so 0.000 countable cells in 56,449',
        'the fitted 2.51e9 proteins per cell predicts 4.93 million ribosomes, inside the measured 3.3-9.5 million',
        'the proteasome lands at 998,982 against a literature 800,000, and was never fitted',
        'the measured embryo now gives 1,360 drawable divisions where the old export gave 4',
        '169 new assertions, 891 across the suite, 0 survivors under fault injection',
      ],
      so_what:
        'Counts in a cell drawing are usually asserted by eye, so here one free parameter is fitted to ' +
        'a single immunoblot and then judged by two measurements it was never shown.',
      read_time_seconds: 40,
    },
    blog: {
      title: 'The Table That Passed Every Test By Having No Range',
      hook:
        'Drawing the inside of a cell means committing to a number of ribosomes. Pick it by eye and the ' +
        'picture is a guess with good lighting. So the number had to be measured, and measuring it meant ' +
        'choosing between three abundance tables that disagree.',
      body: [
        'The obvious place to look was the largest dataset available: a hundred million single-cell ' +
        'transcriptomes, released openly, covering fifty cancer cell lines under eleven hundred drugs. ' +
        'Ask each cell how many complete RNA polymerases its messages could build, and the answer is ' +
        'zero. Not for most cells. For every cell, and for every machine tried.',
        'That is arithmetic rather than biology. A polymerase needs twelve different subunits, and the ' +
        'median cell in that library detects about a thousand genes out of sixty-two thousand. The ' +
        'chance of catching all twelve in one cell is a product of twelve smallish numbers and comes to ' +
        'about 3.6 in a thousand trillion, so the expected number of countable cells among fifty-six ' +
        'thousand is zero to three decimal places. Sequencing deeper moves that threshold without ' +
        'crossing it. The refusal is not a sample-size problem, and it is not blanket either: cohesin, ' +
        'with five abundant subunits, should turn up complete in about 138 of the same cells.',
        'So the counts had to come from protein measurements, and those ship as relative abundance - ' +
        'parts per million of the proteome. Turning that into copies per cell needs one more number, the ' +
        'total protein molecules in a cell, and published values for it differ by a factor of four. ' +
        'Rather than pick one, it was fitted, which turns the whole thing into a testable claim: one ' +
        'free parameter, several independent constraints, and residuals that say whether a single scale ' +
        'factor exists at all.',
        'First the table had to be chosen, and that is where the interesting mistake happened. The test ' +
        'written for it was the elegant one: a complex with one copy of each subunit must show its ' +
        'subunits at the same level, so the spread across them measures accuracy directly, with no ' +
        'anchor and no literature value - only the stoichiometry. One table scored almost perfectly on ' +
        'it. That table turned out to have been compressed to a total dynamic range of twenty-seven ' +
        'fold, top to bottom, across the entire proteome. Its subunits came out level because ' +
        'everything in it does. A spread test rewards flatness, and it is only worth anything after a ' +
        'range test has run first.',
        'With the right table, fitting to all seven available absolute counts gave a threefold residual ' +
        'and missed both checks by about tenfold - because two careful measurements, taken twenty-six ' +
        'years apart on the same cell line, disagree by an order of magnitude about how much polymerase ' +
        'there is relative to the factors that help it start. One scale factor cannot satisfy both. ' +
        'Fitting to the polymerase alone gives 2.51 billion protein molecules per cell, which then ' +
        'predicts 4.93 million ribosomes - inside the 3.3 to 9.5 million measured twice in the primary ' +
        'literature - and a million proteasomes against a published figure near eight hundred thousand. ' +
        'Neither of those was used to fit anything.',
        'Which leaves the drawing. Showing a sample of the population inside a whole cell would depict a ' +
        'cell that is ninety-nine percent empty, and the crowding numbers in this project forbid exactly ' +
        'that: proteins sit about 8.7 nanometres apart, roughly one protein wide. So the same fraction ' +
        'is taken of the volume as of each population, and what you move through is a 2.70 micrometre ' +
        'cube of cytoplasm holding every machine that belongs in it, at the density that was measured.',
      ],
      closing:
        'Six machines are drawn and six are listed and not drawn, because a count without a measured ' +
        'size would have to be drawn at an invented one. That boundary is the honest one, and it leaves ' +
        'the harder question open: when two careful measurements disagree about a ratio by tenfold, ' +
        'what is a picture supposed to show?',
      reading_level: 'general',
    },
  },
});

/** Entry ids in ENTRIES with no register here. Empty is the goal; a non-empty list is the gap made visible. */
export const MISSING = Object.freeze([]);

export const HOW_THE_REGISTERS_DIFFER = Object.freeze({
  skim: 'one surprising true claim and bullets that each carry a number. A bullet that could be true of ' +
    'any project does not belong in it.',
  deep: 'entries.mjs. The four questions, at the file level, with the open questions that data will not ' +
    'settle.',
  blog: 'prose for someone in another field. Real numbers, one place the work was wrong, and an ending ' +
    'that is a question rather than a summary.',
  the_rule_they_share:
    'all three registers describe the same work, so a number in one must be the number in the others. The ' +
    'test asserts the overlap between each blog post and its entry\'s real_numbers for exactly this ' +
    'reason: a narrative drifts off the facts one adjective at a time.',
});
