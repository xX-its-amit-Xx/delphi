# COMPENSATION — the evidence base and decision rule for the COMPENSATORY resolution class

Owner: the `functional/compensation` agent. Everything in `sim-engine/validate/functional/compensation/`
is mine; I have changed nothing outside it.

| file | what it is |
|---|---|
| `compensation-rules.json` | 13 rules, each with condition, consequence, confidence, sources with locators and verbatim quotes, and counter-evidence. 23 sources. 12 quantitative statements. 8 declared gaps. |
| `compensation-cases.json` | 40 real cases in **both** directions |
| `classify.mjs` | `compensationVerdict({gene, alleleKind, paralogues, expression, pathway, omicsCard})` |
| `test.mjs` | 48 assertions, plus `--prove-it` which checks each test can actually fail |
| `validate.mjs` → `VALIDATION.json` | the retrospective validation, with the failures |

Run: `node sim-engine/validate/functional/compensation/test.mjs --prove-it` and `… /validate.mjs`.
Literature cached under `C:/Temp/functional-cache/compensation/`. Nothing committed, nothing deployed.

---

## The headline, before anything else

**The positive direction of this rule does not work, and I can show you the numbers.**

Applied retrospectively with the case-table lookup disabled, the rule chain scores **11/12 on cases
drawn from the papers it was derived from, and 4/13 on cases independent of them (31%)**. Every one of
those 9 independent errors is a **false positive**: it predicted a compensation response where the
experimenters looked and found none.

That gap between 11/12 at home and 4/13 away is the result. The rule encodes the published mechanism
faithfully and still fails to predict new cases. The cause is structural: **the rule can only see a
lesion class, while the outcome turns on the individual allele.** El-Brolosy's own data contain two
PTC alleles — `hbegfa^sa18135` and `vcla^sa14599` — of genes that *do* adapt, which *do not* adapt,
and nothing the classifier can see distinguishes them from the alleles that do.

> "while analyzing various mutant alleles, we found that unlike hbegfaΔ7 and vclaΔ13, two other PTC
> bearing alleles, hbegfasa18135 and vclasa14599, do not display transcriptional adaptation"
> — El-Brolosy et al. 2019, Results, Fig. 1c–f

So the COMPENSATORY class is worth having only in its **refusing** direction, which is reliable
(4 true negatives, 1 false negative). Recommendation to the scoring function:

- count a requirement as met **only** on `class === 'documented'` **and** `functional_rescue === true`
- treat `'plausible-by-rule'` as an **unmet** requirement carrying a review flag — do not score it as compensation
- trust `'not-expected'`
- never score `'unknown'` as a pass

---

## The rules, in prose

### 1. Transcriptional adaptation needs a mutant mRNA that is made *and* destroyed

Three rules form one chain, and all three are experimentally grounded.

**R01 — no mRNA, no adaptation.** The trigger is the *decay of the mutant transcript*. Remove the
promoter or the whole locus and there is nothing to decay. This was tested directly by building
"RNA-less" alleles:

> "Alleles that fail to transcribe the mutated gene do not exhibit transcriptional adaptation, and
> these alleles give rise to more severe phenotypes than alleles displaying mutant mRNA decay."
> — El-Brolosy 2019, abstract

**This is the rule that fires most often for a designed organism.** When a design simply does not
carry a required gene, that is an RNA-less state, and transcriptional adaptation is *positively
excluded* — not merely unevidenced. The field has adopted this as practice: a 2026 zebrafish elastin
study deliberately built RNA-less `elna/elnb` alleles specifically to preclude adaptation.

**R02 — the lesion must destabilise the transcript.** Shown three ways: knocking out `upf1` or
inhibiting NMD abolishes the response; injecting uncapped RNA *creates* it in wild types; and
protecting that same RNA from exonuclease decay abolishes it again. Note the requirement is
**destabilisation, not a premature stop codon as such** — Cas13d cleavage and ribozyme pre-mRNA
cleavage both produce the response with no PTC anywhere (Xie et al. 2025).

**R03 — a missense allele must not be classed compensable.** A missense transcript is translated
normally, is not an NMD substrate, and so is not destabilised. Ma et al. make the same inference in
reverse when they propose *creating* a PTC as a therapy for missense disease:

> "may help lead to the development of therapeutic strategies that treat missense mutations associated
> with genetic disorders by either creating a PTC in the mutated gene" — Ma 2019, abstract

**I must flag what this rule rests on.** I did not find the decisive experiment — a missense allele of
a gene with documented adaptation, shown to fail to adapt. El-Brolosy et al. themselves present the
missense prediction as a hypothesis ("we propose… will help test this hypothesis"). The supporting
human data point is indirect: patients with in-frame *DMD* deletions reportedly show no utrophin
upregulation, which reached me through Falcucci 2025's introduction, not from the primary paper. So R03
is **mechanism-inferred**, and labelled as such.

`classify.mjs` refuses missense **outright**, including through the paralogue path. My first test run
returned `'plausible-by-rule'` for a missense `vcla` allele via paralogue buffering — exactly the
failure mode this module exists to prevent. The fix is a declared scope limit: every sourced
paralogue-buffering case (`mef2ca`, `pcdh15a/b`, `ankfn1`) uses a loss-of-function allele, so applying
that rule to a missense allele would be unsourced — and a missense product may be dominant-negative,
which no paralogue can buffer.

### 2. Knockdown does not trigger it — which is why morphants and mutants differ

**R04.** A morpholino blocks a transcript that is still present and undegraded; CRISPRi stops the
transcript being made. Neither yields decay products.

> "Taken together, these data reveal the activation of a compensatory network to buffer against
> deleterious mutations, which was not observed after translational or transcriptional knockdown."
> — Rossi 2015, abstract

**But the field's own consensus document refuses to make compensation the default explanation**, and
so must we. A 24-author guideline with Stainier as first author lists **four** explanations for the
morphant/mutant gap: maternal rescue of zygotic mutants, morpholino off-target effects, the mutant
allele being hypomorphic rather than null, and genetic compensation. Kok et al. — whose "~80%" figure
is the most-quoted number in this literature — read it as morpholino unreliability and explicitly
rule out the maternal explanation:

> "The absence of phenotypes in mutant embryos was not likely due to maternal effects or failure to
> eliminate gene function." — Kok 2015, abstract

The practical consequence for DELPHI: **if a design reduces a gene's dose rather than nulling it, the
compensation class is refused.** A knockdown-like design gap does not get to borrow the mutant literature.

### 3. The compensating gene must share sequence similarity — and where matters

**R05.** Not the whole transcript. Similarity in the adapting gene's **exons or introns** induces
adaptation; similarity in its **3'UTR does not**; similarity in its **promoter gives only a mild
response**:

> "those exhibiting sequence similarity to exons or introns induced transcriptional adaptation while
> those exhibiting sequence similarity to the 3'UTR did not; and the transcripts exhibiting sequence
> similarity to the promoter induced only a mild response" — El-Brolosy 2019, Results, Ext. Data Fig. 8g

On the mutant-mRNA side, the one element ever mapped lies **between the PTC and the next exon/exon
junction**, is **25 bp long at 60% identity**, and is sufficient on its own (Welker 2023) — but that is
*C. elegans*, a nematode, and has never been reproduced in zebrafish. It is marked as a species transfer
and must not be used as a zebrafish threshold.

**A warning about how not to implement this.** The source's operational definition of "similar" was a
BLASTn match anywhere in the target gene body or 2 kb upstream, at **an E-value up to 1,000,000**. At
that threshold almost any pair of genes matches. So R05 is *not* implemented as "ran BLAST, got a hit":
the classifier requires either a named published adapting-gene relationship or a paralogue with a
stated percent identity, and it records the identity figure so a reader can judge it.

Note also that **adapting genes need not be paralogues** — `egfl7`'s are *emilin* family members. A
paralogue-only rule would miss that case entirely.

### 4. A paralogue only buffers if it is actually expressed there and then

**R06**, and this is where the omics layer earns its keep.

Paralogue *existence* is close to uninformative in zebrafish. Howe et al. identified 3,440 ohnologue
pairs covering **26% of zebrafish genes** (a floor — they excluded intrachromosomal pairs). Compensation
is nowhere near that common. The decisive number comes from the largest systematic survey:

> "applying a very relaxed criterion of CRISPRn fold change > 1 and CRISPRn/CRISPRi ratio > 1 yields
> 156 of the 439 possible paralogous pairs. Although most of these are very unlikely to represent TA
> candidates" — El-Brolosy et al. 2026, Science

Under strict criteria: **one** paralogous pair out of 439. The honest reading is that the fraction lies
somewhere between ~0.2% and ~36% and **is not known**.

What *does* discriminate is expression, and two zebrafish studies make it the causal variable rather
than a plausible one:

- **`mef2ca`** (Bailon-Zambrano 2022): selective breeding for high and low *paralogue expression* produced
  low- and high-penetrance strains. Buffering tracks expression **level**, and the buffering paralogue
  `mef2cb` has **no phenotype of its own** — so a paralogue's own phenotype is not a usable signal.
- **`pcdh15a/b`** (Chrystal 2026): the same pair buffers in the retina and contributes **nothing** in the
  mechanosensory lineage, where one `pcdh15a` copy suffices. One gene pair, opposite verdicts by tissue.

And the largest systematic zebrafish screen **actively rejects** paralogue redundancy as the explanation
for silent nulls:

> "Finally, the teleost-specific genome duplication might cause paralogue redundancy. While this is
> possible there are few examples of paralogues being completely redundant. In contrast, there are
> numerous paralogue pairs where gene expression domains and functions have split between paralogues."
> — Kettleborough 2013, Discussion

Two limits the classifier cannot express. Buffering is **asymmetric**: losing the derived `Ankfn1` copy
gave 7% penetrance, losing the ancestral copy 0/110 — and our paralogue rows carry no
ancestral/derived annotation. And our Ensembl Compara rows are themselves **asymmetric**: `vclb` lists
`vcla` at 85.7% identity while `vcla` lists nothing. So an empty paralogue list is treated as
*not recorded* (→ `unknown`), never as *no paralogue*.

Our own data contains the asymmetry case: **`vcla` nulls are phenotypically silent (0 substantive ZFIN
phenotype terms) while `vclb` nulls are not (33 terms), between two 85.7%-identical paralogues.**
Buffering ran one way only.

### 5. Documented adaptation is not documented rescue — the rule that stops everything being rescued

**R07**, and this is the one that makes the class honest at all.

Three states must be kept apart: **transcript up, protein up, phenotype rescued.** Almost all of the
literature establishes only the first.

- **`vegfaa`** is a founding example of transcriptional adaptation — `vegfab` demonstrably goes up — and
  `vegfaa` mutants nevertheless carry 112 substantive phenotype terms across 22 ZFIN publications
  ("dorsal longitudinal anastomotic vessel hypoplastic", "blood circulation disrupted"). The adaptation
  is real and the requirement is still not met.
- **titin (`ttn.2`)** is stronger still, because compensation was measured at **protein** level:
  Ttn.1 peptides up **2.55-fold** by proteomics, the alternative compensator (`cronos`) checked in the
  right tissue and absent — and homozygotes paralysed by 3 dpf with early death.
  > "the lack of effective compensation by Ttn.1 or Cronos, despite evidence of some Ttn.1 upregulation"

**And the biggest hole in the whole field:** across everything I read, **there is no experiment that
blocks a compensating gene's upregulation in a mutant and thereby unmasks a phenotype.** That is the one
experiment that would establish functional rescue directly. All pro-rescue evidence is indirect — either
a comparison between two *different* alleles that differ in more than their adaptation status (the
RNA-less series also deletes promoter DNA), or rescue of a *morphant* rather than a mutant. The flagship
therapeutic paper (Falcucci 2025, Nature) measures transcript, pre-mRNA and protein and never tests
phenotype rescue at all.

### 6. Two mechanisms that are not transcriptional adaptation

**R08 — protein feedback loops.** If the lost protein normally represses a relative, losing it
de-represses that relative — and that happens in knockdowns too. Mutant/knockdown *concordance* is
therefore the discriminator, running opposite to R04. This is the one mechanism that survives a
knockdown-style design gap. It is also the weakest rule here: its cases (Rpl22/Rpl22l1, RBL2/RBL1) are
mouse and human, reached through a review, and I sourced no zebrafish instance.

**R13 — maternal rescue is not compensation.** A zygotic null still carrying wild-type maternal
transcript looks exactly like a compensated mutant. In `pomgnt2`, zygotic knockouts survive to adulthood
while maternal-zygotic nulls die by 28 dpf — and compensation was tested across five candidate genes and
found **absent**. The journal's editors said so explicitly:

> "It is very clear that the maternally-provided pomgnt2 partially compensates for loss of zygotic
> pomgnt2 but this is not what is generally considered \"genetic compensation\"."

This matters directly for DELPHI: **a designed organism has no wild-type mother**, so anything inferred
from a zygotic-only zebrafish null does not transfer to the design at all. The confound can also run the
*other* way — in an `nphp1/4/8` study, removing the maternal contribution made phenotypes *milder*.

### 7. Missing inputs are `unknown`, never `plausible`

**R10.** The failure mode this module exists to prevent is hope dressed as a rule. `'unknown'` is **not**
evidence that compensation does not occur, and **not** a licence to assume it does. The distinction
between `'unknown'` and `'not-expected'` is load-bearing and must not be collapsed downstream.

---

## How often does compensation actually happen?

The number everyone quotes is the wrong number.

| claim | value | source | what it actually measures |
|---|---|---|---|
| morphant phenotypes not seen in mutants | ~80% (**19 of 24** curated genes) | Kok 2015 | **morpholino unreliability**, not compensation. 98 candidates filtered to 24. Do not use as a compensation prior. |
| zebrafish disruptive alleles with no phenotype at 5 dpf | **1065/1216 = 87.6%** | Kettleborough 2013 | the real silent-null rate — and that paper declines to attribute it to compensation |
| knockout targets with significant paralogue upregulation | **16/74 = 21.6%** | Mellis 2024 | best genome-scale "how often". Human/mouse. |
| paralogous pairs showing adaptation | **1/439** strict, 156/439 relaxed | El-Brolosy 2026 | why paralogue existence licenses nothing |
| paralogue knockouts showing adaptation | 6/110 ≈ 5.5% (**unverified**) | O'Brien 2026 preprint | abstract only, human, not peer reviewed |
| similar genes upregulated in KO cells | ≥50% vs ≤21% background | El-Brolosy 2019 | **mouse cell lines**, denominators of ~6–12 genes, "similar" at E-value ≤1e6 |

Kettleborough's own figures are **internally inconsistent** — Results give 48 causal + 77 linked = 125
alleles (10.3%) while the Discussion says "about 6% (74/1216)". I report the range, 6–10% phenotypic,
rather than picking one.

So: about 88% of zebrafish nulls are silent, and roughly 20% of knockouts show paralogue upregulation.
Those are different facts about different things, and neither licenses rescuing a design gap.

---

## Validation

`node validate.mjs` → `VALIDATION.json`. The case-table lookup is **disabled** throughout, or this
would just read the answers back out of the table. Two modes, because they measure different things.

**Mode A — as-available.** Only the inputs the case rows and our omics layer actually contain.
Result: **abstains on 24 of 40 rows, decides 1.** Our transcriptomic layer can almost never supply
tissue-and-stage expression for a candidate compensator. **In production this rule will mostly return
`unknown`. That is correct behaviour and must not be "fixed" by relaxing R06.**

**Mode B — granted.** R06's expression condition granted for every named compensator, isolating the
lesion logic. Result: **15/25 decided correctly (60%)**, with **9 false positives and 1 false negative**.

Split by independence — the only split that means anything:

| | decided | correct | rate |
|---|---|---|---|
| rows from the rules' own source papers (**circular**) | 12 | 11 | 92% |
| rows **independent** of them | 13 | 4 | **31%** |

The 9 independent false positives: `hbegfa^sa18135`, `vcla^sa14599` (PTC alleles that don't adapt);
`HBB`, `PKD1`, `Dmd`, `ARG1` (paralogue not induced despite a PTC construct); `fbn3` (fbn1/fbn2 not
upregulated); `pcdh15a` (no adaptation by pcdh15b in the mechanosensory lineage); `pomgnt2` (five
candidates tested, none moved). The single false negative is `egfl7` RNA-less, where adaptation was
*milder* rather than abolished — which is R01's own declared counter-evidence biting.

**Can this rule be validated? No.** 15 of the 40 rows carry no ground truth on the axis the rule
predicts — most "not-rescued" rows record only that a null had a severe phenotype; nobody measured
whether a compensator went up. Only **5 rows** have compensation actually tested. Those rows can
falsify an over-eager rule; they cannot confirm a correct one. **I state plainly: the positive
direction of this rule cannot be validated to any useful precision, and the evidence I do have says
it is wrong more often than right.**

The negative direction is a different story and is the part worth shipping.

---

## The case table

40 rows in `compensation-cases.json`, both directions, allele-resolved wherever a source distinguished
alleles — because a per-gene row would be a lie: El-Brolosy's own data show two alleles of the same gene
behaving oppositely.

**Compensation observed (9):** `hbegfa`Δ7→hbegfb, `vcla`Δ13→vclb, `hif1ab`→epas1a/epas1b,
`vegfaa`→vegfab, `egfl7`→emilin2a/3a, `alcama`→alcamb, `capn3a`, `nid1a`, plus `mef2ca`→4 mef2
paralogues and `pcdh15a`→pcdh15b (retina only) and `ankfn1`→ankfn1-like.

**Compensation tested and absent (9):** the RNA-less series (`hbegfa`, `vegfaa`, `alcama`, `egfl7`
full-locus/promoter deletions), the two non-adapting PTC alleles, `fbn3`, `pcdh15a` (mechanosensory),
`pomgnt2`, and the four cross-species constructs (`HBB`, `PKD1`, `Dmd`, `ARG1`).

**Not rescued (29 rows overall),** the strongest being `ttna` (protein-level compensation, still
paralysed), `vegfaa`, `npas4l`, `cdh2`, `sox10`, `fn1a`, `tbxta`, `shha`, `tbx5a`, `hoxba/hoxbb`
(complete absence of pectoral fins — directly on the flying-fish trait path).

### Two conflicts I am leaving open rather than resolving

1. **`nid1a`.** Ma et al. report `nid1a`-null mutants "appear normal". ZFIN carries substantive `nid1a`
   allele phenotypes from three publications including "liver mislocalised", "liver absent" and
   "whole organism decreased length" — which are *exactly* the phenotypes Ma et al. attribute to the
   **knockdowns**. Either different alleles behave differently, or the curated record disagrees with
   the paper.
2. **`fbn3`.** The paper rejects transcriptional adaptation in its Discussion and invokes functional
   compensation for the same negative result in its Limitations, supported by never recovering an adult
   triple knockout from ~300–400 genotyped. **Transcriptional** adaptation absent, **functional**
   redundancy present. Keeping those two predicates separate is the commonest error in this literature.

### A data-quality finding about ZFIN

ZFIN `allele_phenotype` rows are **not** a clean readout of "this mutant has a phenotype". Many rows for
phenotypically wild-type genes are bookkeeping annotations — "whole organism increased amount",
"decreased amount", "absent" — recording Mendelian ratios and lethality, not defects. Filtering those
out, our own data independently corroborates the literature: **`vcla` 0 substantive terms, `capn3a` 0
substantive terms** — both documented compensated genes, both silent in the curated record.

But ZFIN aggregates across **all** alleles and publications, so `egfl7` and `alcama` carry many
substantive terms contributed by RNA-less alleles and later papers. **Per-gene ZFIN counts cannot
confirm or refute an allele-level compensation claim**, and are used here only as corroboration or as a
flagged conflict.

---

## What this cannot tell us

**Compensation observed in one gene does not generalise.** It is documented for *that gene*, in *that
organism*, at *that stage*, with *that allele*. `Dmd`→`Utrn` is the cautionary case: a 2025 Nature paper
reports transcriptional adaptation upregulating utrophin in Duchenne muscular dystrophy, and the 2026
Science paper reports that a *Dmd* PTC construct did **not** induce *Utrn* in undifferentiated C2C12
cells. Same gene pair, opposite results, decided by cell state.

**Absence of evidence is not evidence of no compensation.** 15 of my 40 rows have no ground truth
because nobody looked. `'unknown'` means this rule base could not reach a verdict — nothing more. The
rule base also records absence honestly in the other direction: a missing expression row means
"not recorded", never "not expressed", unless the source asserts absence.

**None of this is measured in a flying fish.** *Hirundichthys speculiger* and its relatives have **no
expression data at all** — not in this repo, not anywhere I could source. The `flying_fish` field is
`null` for `vegfaa` and for the great majority of our 3,860-gene universe. Every expression-dependent
rule here is therefore inapplicable to the designed organism itself. **A compensation verdict for a
flying-fish design is a zebrafish verdict wearing a flying-fish label**, and `classify.mjs` flags it as
such (R12) rather than hiding it. There is additionally no reason to assume the teleost paralogue
complement, the NMD machinery efficiency, or the adapting-gene relationships are shared between *Danio*
and an exocoetid — and the yeast result shows the whole mechanism can be absent in a lineage that lacks
the right machinery.

**The rule sees lesion classes, not alleles.** This is the root cause of the 31% independent accuracy
and it is not fixable with the inputs available. It is also why `'plausible-by-rule'` exists as a
separate, deliberately weak class rather than being folded into `'documented'`.

---

## What I could not source

1. **Numeric fold-changes / effect sizes for transcriptional adaptation.** There is no quotable
   fold-change in El-Brolosy 2019's main text or figure legends — every magnitude lives inside a qPCR
   bar panel or a heat map. **The rule base therefore contains no effect-size threshold, and must not
   acquire one without someone reading the figure panels.** (The two numbers I do have are Ttn.1 at
   2.55-fold by proteomics, and utrophin at ~1.5–2 fold.)
2. **Dosage compensation in teleost paralogue pairs.** Five distinct query formulations returned nothing
   with a quotable quantitative statement for zebrafish ohnologues. An open gap, not a negative result.
   Unretrieved leads: Diss et al. 2014 (PMID 24376223); Trends in Genetics 2022 (PMID 34294428, paywalled).
3. **A direct missense-allele experiment.** R03 is mechanism-inferred and says so.
4. **Any experiment that blocks compensation in a mutant to unmask a phenotype.** The single biggest
   hole in the functional-rescue claim, across the whole corpus.
5. **Full text of Rossi 2015 and Ma 2019** — neither is open access nor in Europe PMC full text, so all
   their quotes here are from abstracts with no figure-level locators.
6. **Full text of Kok 2015 from Europe PMC** — `fullTextXML` returns HTTP 500 for PMC4487878. Recovered
   via NCBI efetch on a second pass, which is how the 19/24 decomposition was obtained.
7. **Full text of the O'Brien 2026 preprint** — bioRxiv returned HTTP 429 then Cloudflare 1015 on every
   attempt. Its 6/110 rate is abstract-only and unverified.
8. **Jakutis & Stainier 2021 (Annu Rev Genet, PMID 34314597)** — not open access. The most likely place
   to find a tabulated case list; not read.
9. **A published rebuttal of the Rossi/El-Brolosy/Ma model.** There is none that I could locate. All
   counter-evidence is of the form "absent in another taxon" (yeast), "less prevalent than implied"
   (Mellis), "one of four explanations" (Stainier guidelines), or "insufficient to rescue" (titin,
   fibrillin) — **not** "the original result is wrong". I want that stated, because it would be easy to
   over-read my counter-evidence sections as a dispute about the mechanism. The mechanism is not in
   dispute. Its *predictive usefulness* is.

### One correction to my own work

An earlier draft of `compensation-rules.json` capped confidence on Ma 2019 because a 2026 Author
Correction existed whose content I had not retrieved. I then retrieved it: it fixes **one y-axis tick
label** in one extended-data panel, with no data, panel or conclusion altered. **That cap was
unjustified and has been removed.** Discounting a paper for having a correction, without reading the
correction, is the same species of error as rescuing a gap without reading the evidence.

---

## Compliance

No Aves data anywhere (asserted by a test over both data files). No credentials (likewise tested).
Literature cached under `C:/Temp/functional-cache/compensation/`, nothing cached in the repo. Nothing
committed, nothing deployed. All work confined to this subfolder.
