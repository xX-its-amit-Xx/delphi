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
