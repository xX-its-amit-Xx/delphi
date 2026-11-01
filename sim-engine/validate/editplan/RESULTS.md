# Germline editing plans for the winged zebrafish's edits — a proposal, not a protocol

**Run 2026-11-01. Three edits planned for real: `kcnk5b` p.W169L, `kcnk5b` p.F241Y, `hhip` loss of function.**

> **READ THIS FIRST.** Everything below is a **proposal for a wet lab to check**, line by line, against its own
> genome build, its own guide-scoring tool and its own fish. Nothing here has been tested at a bench by us. No
> guide has been cut, no embryo injected, no fish genotyped. There are now **two** on-target scores and the
> difference between them matters: `on_target_doench2014` is a **published model** (Doench 2014 Rule Set 1,
> coefficients fetched from the paper's own supplementary table in this run and self-tested) that was fitted in
> **mouse and human cell lines**, so applying it to a zebrafish injection is a cross-species transfer;
> `on_target` is **our heuristic**, with weights we chose and never fitted. Neither is Doench 2016 Rule Set 2,
> and neither is a measured efficiency. Off-target counts now come from an **exhaustive scan of the whole GRCz11
> primary assembly** — complete for substitutions, but still blind to bulges, to alternative loci, and to the
> genome of the laboratory strain you would actually inject; **a sequence match is not a cut**. Evo2 likelihoods
> **rank** options and never gate a plan, and are **not** phenotype predictions. The HDR and prime-editing rates
> are **other papers' loci**. And our own validation of the design these edits belong to **did not establish that
> the edits produce the predicted phenotype** — it mostly could not score it at all
> (`design-validation/REPORT.md`). Any of this that touches an animal needs institutional animal-care approval
> (IACUC or equivalent) **before** the first injection. *Danio rerio* only; the module refuses every other
> species in code.

Reproduce:

```bash
# ONE-TIME: download the GRCz11 primary assembly and build the local off-target index
# (410 MB download, 1.37 GB index, both under C:/Temp/grcz11 - off the near-full D: drive)
node sim-engine/validate/editplan/grcz11-local.mjs build
node sim-engine/validate/editplan/grcz11-local.mjs status

node sim-engine/validate/editplan/cli.mjs --gene kcnk5b --change p.W169L
node sim-engine/validate/editplan/cli.mjs --gene kcnk5b --change p.F241Y
node sim-engine/validate/editplan/cli.mjs --gene hhip   --change knockout
node sim-engine/validate/editplan/doench2014.mjs         # the Rule Set 1 self-test, on its own
node sim-engine/validate/editplan/test.mjs               # 45 assertions, all pass
node sim-engine/validate/editplan/test.mjs --fail-once   # inject a fault per test; 35 FAIL, 10 are setup lines
```

---

## 0. The headline, in one paragraph

All three edits resolve to exact GRCz11 coordinates, and in each case the reference codon was **read back out of
the genome and re-translated** rather than trusted: `kcnk5b` W169 is `TGG` at **chr20:9,232,964–9,232,966** and
F241 is `TTC` at **chr20:9,237,310–9,237,312** (both forward strand, `ENSDART00000023293`); `hhip`
(`ENSDARG00000060397`, `ENSDART00000085051`, chr1, 693 aa) has 725 coding nt across 4 coding exons in the first
35 % of its CDS. The most consequential finding is a hard one: **both *alf* substitutions are transversions**
(W169L is `c.506G>T`, F241Y is `c.722T>A`), so **no standard cytosine or adenine base editor can make either of
them** — base editors install transitions only. That leaves two routes, and we designed both: HDR with an ssODN
(expect **1–4 % error-free repair**, Boel 2018) or **prime editing**, which has been shown to work in the
zebrafish germline (Petri 2022, up to 30 % **somatic, in embryos**; germline transmission is demonstrated there
but no numeric germline rate is given). For `hhip`, by contrast, a cytosine base editor **can** do the job
cleanly: codon 17 `TGG`→`TGA` installs a stop that removes **97.5 %** of the protein with no double-strand
break.

**The off-target table, which was empty in the previous run, is now filled.** The NCBI BLAST path never returned
— every job queued indefinitely — so it was replaced with a **local exhaustive scan of the whole GRCz11
primary assembly**: 1,373,471,384 bp, both strands, every position, no seeding step, ~22 s per guide, no
credentials. All six guides a lab would order now have real counts, and **every one of them finds exactly one
perfect match, at its own intended locus** — which independently confirms the coordinates above. It also found
things worth knowing: the `kcnk5b` W169L HDR guide has a **2-mismatch off-target** (intergenic, chr24), the
F241Y HDR guide has a **3-mismatch off-target inside `mbnl1`**, and the W169L pegRNA spacer is the least
specific guide of the six by a wide margin (138 sites, MIT 73.5) while the F241Y pegRNA spacer is the most
specific (8 sites, MIT 98.9). See §5.

**The on-target score is no longer only ours.** Doench 2016 Rule Set 2 was pursued first and **cannot** be
reimplemented from published numbers — the Azimuth model is a pickled 100-tree gradient-boosted ensemble, so no
coefficient vector exists to transcribe. So Doench **2014 Rule Set 1** was implemented instead, from its own
Supplementary Table 9, fetched in this run and self-tested against its published reference vectors. Both numbers
are reported side by side, and on `hhip` our heuristic returns **1.000 for all four guides** while Rule Set 1
spreads them over 0.078–0.441 — the heuristic was hiding that it had nothing to say there (§5b).

**Evo2 is wired and did not run**, for one reason: the key available is a Brev-style `bak-` key, which NIM
rejects; NIM needs an `nvapi-` key. Every Evo2 field reads `{ran: false, reason: "NVIDIA_API_KEY not set"}` and
all three plans are complete without it, because the model **ranks and never gates** (§5c).

**Two citations had to be corrected, and one design default was simply wrong.** The `<10 nt` / `20–30 %`
cut-site-distance numbers are **Paquet 2016 murine-cell data**, not Prykhozhij zebrafish data (§2). The
symmetric ssODN arms were **40/40, which is 80 nt total — inside the range Boel 2018 measured to be up to
tenfold worse**; they are now 60/60, Boel's measured 120 nt optimum (§3).

---

## 0b. A finding about the design document itself, which should be read before the plans

The three edits above are the ones that were asked for, and they are the *alf* / `hhip` alleles. But the
repository's `winged-zebrafish` document **carries no gene-level edits at all** — it holds only morphological
parameters, so `edit_plan {organism: "winged-zebrafish"}` correctly returns a **refusal**, not an empty plan:

> the document "winged-zebrafish" carries NO gene-level edits (no `doc.edits` at level "gene" and no
> `doc.genotype`), so there is nothing to plan.

The winged zebrafish's genotype is recorded elsewhere in this repo — `sequences/engineered-diff.json` and
`genotype/compare-2x2.json` panel B — and it is **not** the two *alf* alleles. It is:

| locus | change | planned? |
|---|---|---|
| `slc43a2a` (*lat4a* `nr21`), chr15 | **p.T200K**, heterozygous | **yes** — see below |
| `kcnh2a` (*longfin* `dt2`), chr2 | cis-regulatory **inversion** placing `prrx1a` regulatory sequence upstream of `kcnh2a`; coding sequence unchanged, heterozygous | **no — REFUSED** |

Both were run. `slc43a2a` p.T200K resolves cleanly: `ENSDARG00000036848`, chr15 **+**, **`c.599C>A` at
GRCz11 15:28,390,802** — **another transversion** — with best guide `AATTCCTGGGAATGTGACAG` + `CGG` at
**3 bp** from the edit, on-target heuristic **0.95**, and a donor that passes the protein check. The `kcnh2a`
inversion is refused in so many words:

> this module plans point changes (`p.<REF><POS><ALT>`) and knockouts. "cis-regulatory inversion placing
> `prrx1a` regulatory sequence upstream of `kcnh2a`" is a regulatory change: a cis-regulatory inversion or
> transgene insertion is a different construct problem and is **NOT** planned here.

**So there is no complete editing plan for the published winged-zebrafish genotype in this module** — half of it
is a structural rearrangement the planner does not attempt, and saying so is more useful than emitting a
plausible-looking plan for it. Three of the four coding changes seen across all of these designs
(`kcnk5b` W169L, `kcnk5b` F241Y, `slc43a2a` T200K) are **transversions**, which is why §4 matters as much as §3.

---

## 1. Exact genomic changes (GRCz11)

| | `kcnk5b` p.W169L | `kcnk5b` p.F241Y | `hhip` loss of function |
|---|---|---|---|
| gene | `ENSDARG00000012390` | `ENSDARG00000012390` | `ENSDARG00000060397` |
| canonical transcript | `ENSDART00000023293` | `ENSDART00000023293` | `ENSDART00000085051` |
| protein | `ENSDARP00000015031`, 448 aa | `ENSDARP00000015031`, 448 aa | `ENSDARP00000079486`, 693 aa |
| chromosome / strand | **20 / +** | **20 / +** | **1 / +** |
| CDS positions | c.505–507 | c.721–723 | window c.4–c.728 |
| reference codon | **TGG** (W) | **TTC** (F) | — |
| genomic coordinates | **20:9,232,964–9,232,966** | **20:9,237,310–9,237,312** | 1:35,790,495–35,803,020 |
| genome vs CDS | **passed** (genome re-read and re-translated) | **passed** | n/a |
| desired codon | **TTG** (L) | **TAC** (Y) | — |
| nucleotide change | **`c.506G>T`** = 20:9,232,965 **G>T** | **`c.722T>A`** = 20:9,237,311 **T>A** | frameshift, any coding cut in the window |
| transition or transversion | **TRANSVERSION** | **TRANSVERSION** | n/a |
| codon usage of the new codon | TTG = **13.3 %** of Leu codons (12.3 /1000) | TAC = **57.4 %** of Tyr codons (17.0 /1000) | n/a |

Codon choice rule: among the codons for the desired residue, the one needing the fewest nucleotide changes;
ties broken by the commoner zebrafish codon. Codon usage is **measured** — Kazusa Codon Usage Database,
*Danio rerio* [gbvrt], **19 062 CDSs / 8 042 248 codons**, fetched and parsed in this run, never typed from
memory. Note the honest cost of the rule on W169L: `TTG` is the cheapest Leu codon (1 nt) but a relatively rare
one (13.3 %); `CTG` is the common one (40.5 %) and would need 2 nt changes. The plan takes the cheap one and
says so.

For `hhip` the knockout window is the first 35 % of the CDS (codons 2–242 of 693), and it is reported as **four
coding intervals**, not one span, because **a cut in an intron does not shift the frame**:

| coding interval | CDS | codons | GRCz11 chr1 |
|---|---|---|---|
| 1 | c.4–270 | 2–90 | 35,790,495–35,790,761 |
| 2 | c.271–463 | 91–154 | 35,793,679–35,793,871 |
| 3 | c.464–605 | 155–201 | 35,800,394–35,800,535 |
| 4 | c.606–728 | 202–242 | 35,802,898–35,803,020 |

**725 coding nt** of the 12.5 kb span. The enumerator finds 973 SpCas9 protospacers in the span; **85** of them
actually cut in coding sequence. That filter is the difference between a plan and a list.

---

## 2. Guides

Ranking rule, stated so it can be argued with: for a point change, **cut-site distance bucketed to 10 bp, then
the on-target heuristic, then exact distance**. Cut-site proximity matters, but 1 bp versus 2 bp is not a real
difference, while a guide with a poly-T run is simply dead — without the bucket, a 1-bp-closer dead guide wins.
For a knockout, the heuristic alone, since any coding cut frameshifts. Each guide also carries
`on_target_doench2014`, a **published** model (§5b), and every plan now carries a `ranking` section holding all
five orders side by side (§5c).

**A citation this run had to correct.** The ±30 bp window and the proximity ranking were attributed, by
implication, to Prykhozhij et al. 2018 as zebrafish data. Re-reading its full text shows that is wrong:
Prykhozhij contains **no zebrafish-measured distance-versus-efficiency relationship**. Its zebrafish statements
on distance are qualitative ("cut site proximity to the mutation … greatly improved knock-in efficiency";
"knock-ins farther than 10 nt from the cut site are much less efficient", with no numbers attached). Its only
quantitative distance claim is in its **introduction** and is explicitly murine — "at a distance of 20 nt away
from the cut site, the efficiency drops to 20–30% of the maximum, as observed in murine cells" — citing a single
reference, **Paquet et al. 2016, Nature 533, doi [10.1038/nature17664](https://doi.org/10.1038/nature17664)**.
So: the qualitative principle is Prykhozhij's and is zebrafish-supported; the **numbers are Paquet's, in
mammalian cells**, and are now labelled as a cross-species transfer in the provenance
(`CUT_DISTANCE_EVIDENCE`).

### `kcnk5b` p.W169L — 7 SpCas9, 1 SaCas9, 2 AsCas12a in the ±30 bp window

| protospacer + PAM | nuclease | strand | cut | bp to edit | on-target (heuristic) |
|---|---|---|---|---|---|
| **`GAACCAAGAAGCCCCATAAA` AGG** | SpCas9 | − | 20:9,232,962 | **2** | **0.88** |
| `GTTCCTTTTATGGGGCTTCT` TGG | SpCas9 | + | 20:9,232,971 | 5 | 0.63 — **poly-T run: drop it** |
| `ACAATTGTGTTCCTTTTATG` GGG | SpCas9 | + | 20:9,232,963 | 1 | 0.425 (poly-T) |
| `AAAGAACATGAACACAAAGGC` TGGGAT | SaCas9 | − | 20:9,232,996 | 30 | 0.778 |
| `TGGGGCTTCTTGGTTCACTTAAT` (PAM TTTA, 5′) | AsCas12a | + | 20:9,232,982 | 16 | 0.83 |

The W169 neighbourhood is T-rich, so three of the seven SpCas9 guides carry a `TTTT` run and are flagged as
likely U6/T7 transcription failures. The recommended guide is the reverse-strand one at 2 bp.

### `kcnk5b` p.F241Y — 9 SpCas9, **0 SaCas9**, 4 AsCas12a

| protospacer + PAM | nuclease | strand | cut | bp to edit | on-target |
|---|---|---|---|---|---|
| **`GGTTGTCATTGTTCTTCAGT` TGG** | SpCas9 | + | 20:9,237,316 | **4** | **0.88** |
| `GGATCTACCTGGGCCTTGCT` TGG | SpCas9 | + | 20:9,237,295 | 15 | 0.88 |
| `AGAACAATGACAACCAAGCA` AGG | SpCas9 | − | 20:9,237,296 | 14 | 0.83 |
| `TGAGCTTCCACCACCATATGCAC` (PAM TTTA, 5′) | AsCas12a | − | 20:9,237,329 | 17 | 0.83 |

**No NNGRRT PAM exists within 30 bp of F241**, so SaCas9 is not an option here — a real negative result, reported
rather than padded.

### `hhip` knockout — 85 SpCas9, 17 SaCas9, 24 AsCas12a **cutting in coding sequence**

| protospacer + PAM | nuclease | strand | cut | frameshift from codon | protein lost | on-target |
|---|---|---|---|---|---|---|
| **`GAGAATTAAGTCCAAGGAGG` AGG** | SpCas9 | + | 1:35,790,591 | **34** | **95.1 %** | **1.0** |
| `GGAGAGAAAACTGTCACTCG` AGG | SpCas9 | + | 1:35,790,655 | 55 | 92.1 % | 1.0 |
| `GACGGACAGCAGGACACGCG` AGG | SpCas9 | − | 1:35,790,701 | 70 | 89.9 % | 1.0 |
| `ATGCGAAATTTGGCGAGAAAG` GAGAAT | SaCas9 | + | — | 27 | 96.1 % | 0.95 |
| `GGAATGTGGTGATGCGAAATTTG` (PAM TTTG, 5′) | AsCas12a | + | — | **23** | **96.7 %** | 1.0 |

The Cas12a guide frameshifts earliest (codon 23, 96.7 % of the protein lost). "Better placed" in the sense of
cut-to-edit distance does not apply to a knockout, and the plan says so rather than printing a misleading
number.

---

## 3. HDR donors (point changes only)

Both point plans produce two ssODNs, and **both pass the protein check** — exactly one amino-acid change, every
blocking mutation verified silent by re-translating the edited codon rather than by assumption.

**The symmetric arm length changed in this run, from 40/40 to 60/60, and the old value was wrong.** The previous
default was labelled honestly ("40/40 is the conventional starting point, not their measured optimum") — but the
measured optimum was available and we had not read it. Boel et al. 2018 titrated total ssODN length at four
zebrafish sgRNA sites and reports that **"the HDR rate for symmetrical templates increased significantly when
extending the template length from 60 to 120 nucleotides (nt), with the maximum improvement being tenfold"** in
three of four targets, that 180 nt "moderately decreased HDR rates in most cases", and concludes **"120 nt being
identified as the most optimal length to promote HDR"**. 40/40 is 80 nt total — inside the range Boel measured
to be up to tenfold worse. The donors below are therefore **121 nt, arms 60/60**. One caveat kept because it is
real: Boel states the optimum as a *total* length; splitting it 60+60 is **our** reading of "symmetrical".

**And the two zebrafish papers disagree about asymmetry, so this plan does not pick a winner.** Boel 2018:
**"Asymmetrically designed templates did not result in better HDR rates compared to symmetrically designed
templates"**, and "no specific type of repair template performed consistently best across all four sgRNA target
sites". Prykhozhij 2018: asymmetric anti-sense was **"substantially more efficient (3- to 10-fold)"**. The
disagreement is not resolvable from these two papers, because Prykhozhij varied **orientation and asymmetry
together** and its own text says they "have additive contributions" — so it does not isolate arm length. **No
zebrafish study isolates arm length from orientation, and none tested symmetric 40/40 at all.** Richardson 2016,
the source of the 36/91 split, is human cells. Both donors are emitted; order both and compare. All of this is
in the output as `ARM_LENGTH_EVIDENCE`.

### `kcnk5b` p.W169L, on guide `GAACCAAGAAGCCCCATAAA`

**Symmetric, 121 nt, arms 60/60, GRCz11 20:9,232,902–9,233,022** — the arm length corrected to Boel's
measured optimum this run (was 81 nt / 40-40). Order the forward strand, which is complementary to the
protospacer strand:

```
5'-TCTCATTTTCTCTTCTTTGACAGAGAAAAGTTCAGTTCATCTGCACAATTGTGTTTCTCTTATTGGG
   CTTCTTGGTTCACTTAATCATCCCAGCCTTTGTGTTCATGTTCTTTGAGAATTG-3'
```

**Asymmetric, 128 nt, arms 36/91, GRCz11 20:9,232,871–9,232,998**

```
5'-AAAGATGAAAAAGCATTTTTTAAAACATTGTTCTCATTTTCTCTTCTTTGACAGAGAAAAGTTCAGTTCATCTGCACAATT
   GTGTTTCTCTTATTGGGCTTCTTGGTTCACTTAATCATCCCAGCCTT-3'
```

Changes carried (3 of them, 1 intended + 2 silent blocking):

| GRCz11 20: | ref>alt | codon | before→after | aa | kind | zebrafish codon usage |
|---|---|---|---|---|---|---|
| 9,232,965 | **G>T** | 169 | TGG→TTG | **W→L** | the intended change | 0.533 → 0.133 |
| 9,232,957 | C>T | 166 | TTC→TTT | F | silent, seed block | 0.533 → 0.467 |
| 9,232,960 | T>C | 167 | CTT→CTC | L | silent, seed block | 0.136 → 0.184 |

### `kcnk5b` p.F241Y, on guide `GGTTGTCATTGTTCTTCAGT`

**Symmetric, 121 nt, arms 60/60, GRCz11 20:9,237,256–9,237,376** — arm length corrected as above (was
81 nt / 40-40). Order the reverse strand, which is complementary to the protospacer strand:

```
5'-GTCTCATCCTCCTTTTCTTTAAAACTTTATGAGCTTCCACCACCATATGCACGTTCCAACTAAAGTA
   TAATGACAACCAAGCAAGGCCCAGGTAGATCCATAGCTGGACAAAGAATCTGTA-3'
```

**Asymmetric, 128 nt, arms 36/91, GRCz11 20:9,237,280–9,237,407**

```
5'-TCCGGCACGTCATCGGTGGGCAGCCTGTGGCGTCTCATCCTCCTTTTCTTTAAAACTTTATGAGCTTCCACCACCATATGC
   ACGTTCCAACTAAAGTATAATGACAACCAAGCAAGGCCCAGGTAGAT-3'
```

| GRCz11 20: | ref>alt | codon | before→after | aa | kind | codon usage |
|---|---|---|---|---|---|---|
| 9,237,311 | **T>A** | 241 | TTC→TAC | **F→Y** | the intended change | 0.533 → 0.574 |
| 9,237,309 | G>A | 240 | TTG→TTA | L | silent, seed block | 0.133 → 0.075 |
| 9,237,315 | C>T | 242 | TTC→TTT | F | silent, seed block | 0.533 → 0.467 |

**Two honest notes on the donors.** (1) No blocking mutation fell in the **PAM** for either guide — both landed
in the PAM-proximal seed instead, because the PAM bases are either non-coding or cannot be changed
synonymously. A seed mismatch suppresses re-cutting less completely than a destroyed PAM, so expect some
re-cutting of the repaired allele. (2) Both blocking mutations on F241Y and one on W169L swap a commoner codon
for a rarer one. That is a real, if small, cost of the design and is why both usage fractions are printed.

**Order both strands.** Two strand rules exist and disagree: complementary to the protospacer strand, versus
**anti-sense to the mRNA**, which Prykhozhij 2018 found to be the single most successful optimisation in
zebrafish. The plan emits both (`sequence_to_order_5to3` and `sequence_antisense_to_mRNA_5to3`). Order with
**terminal phosphorothioate linkages** — the same paper reports these greatly improved knock-in efficiency; we
did not read the size of the gain off their figures, so no number is attached.

---

## 4. Base editing and prime editing

### The finding that shapes both *kcnk5b* plans

| | W169L | F241Y |
|---|---|---|
| change | `c.506G>T` | `c.722T>A` |
| class | **transversion** | **transversion** |
| CBE (C>T)? | **no** | **no** |
| ABE (A>G)? | **no** | **no** |

Standard cytosine and adenine base editors install **transitions only**. Neither *alf* substitution is a
transition, so **neither is reachable by any standard base editor** — and the alternative codons are no help
(W→L needs `TGG`→`TTG`, a G>T; the 2-nt options are worse). This is a fact about the genetic code, and the test
suite asserts it so it cannot silently rot.

### Prime editing — the route that can make a transversion

Prime editing **has been demonstrated in the zebrafish germline**: Petri et al. 2022, *Nat Biotechnol*
40:189–193, doi [10.1038/s41587-021-00901-y](https://doi.org/10.1038/s41587-021-00901-y), PMID 33927418 —
purified prime-editor RNP, somatic frequencies **as high as 30 %**, germline transmission shown, **alongside
unintended insertions, deletions and pegRNA scaffold incorporation**. Designs follow Anzalone et al. 2019,
*Nature* 576:149–157, doi [10.1038/s41586-019-1711-4](https://doi.org/10.1038/s41586-019-1711-4).

**`kcnk5b` p.W169L** — spacer `ACAATTGTGTTCCTTTTATG` + PAM `GGG`, strand +, nick 20:9,232,963, **2 bp to the
edit**, PBS 13 nt, RTT 17 nt:

```
pegRNA 3' extension (DNA, 5'->3')   TGAACCAAGAAGCCCAATAAAAGGAACACA
  RT template (1-17)                TGAACCAAGAAGCCCAA
  primer binding site (18-30)                        TAAAAGGAACACA
reference span, same coordinates    TGAACCAAGAAGCCCCATAAAAGGAACACA
                                                   ^ the only difference: position 16, C>A
full pegRNA (RNA, 5'->3')
  GACAAUUGUGUUCCUUUUAUG + GUUUUAGAGCUAGAAAUAGCAAGUUAAAAUAAGGCUAGUCCGUUAUCAACUUGAAAAAGUGGCACCGAGUCGGUGC
  + UGAACCAAGAAGCCCAAUAAAAGGAACACA
PE3 nicking guide                   GGGTGGTGAAGGAGAAGTAC AGG, 80 nt from the PE2 nick
```

**`kcnk5b` p.F241Y** — spacer `GGATCTACCTGGGCCTTGCT` + PAM `TGG`, strand +, nick 20:9,237,295, 16 bp to the
edit, PBS 13 nt, RTT 31 nt:

```
pegRNA 3' extension (DNA, 5'->3')   ACGTTCCAACTGAAGTACAATGACAACCAAGCAAGGCCCAGGTA
  RT template (1-31)                ACGTTCCAACTGAAGTACAATGACAACCAAG
  primer binding site (32-44)                                      CAAGGCCCAGGTA
                                                   ^ the only difference: position 16, A>T
PE3 nicking guide                   GAGTGGGGTAGTTTACGGAT GGG, 59 nt from the PE2 nick
```

Note that the prime-editing guide for F241Y is **not** the best HDR guide. Prime editing requires the edit to
lie 3′ of the nick on the protospacer strand, which excludes the 4-bp guide; the planner picks the 15-bp one
that satisfies the geometry instead of forcing the closer guide into a design that cannot work.

**Both extensions were verified, and the verification is a test** (`test.mjs` test 6): each differs from the
reference span at **exactly one** base, the number of intended changes, and that base lies in the **RT
template**, never in the primer-binding site — a PBS mismatch cannot anneal to the nicked strand, so a design
with one is silently broken.

PBS 13 nt and RTT = edit distance + 15 nt are **Anzalone's defaults, not an optimisation for these loci**.
Prime editing needs a pegRNA length screen at every new site. **No efficiency is predicted.**

### `hhip` — here a base editor *is* the better plan

A cytosine base editor can install a premature stop (iSTOP; Billon et al. 2017, *Mol Cell* 67:1068–1079,
doi [10.1016/j.molcel.2017.08.008](https://doi.org/10.1016/j.molcel.2017.08.008)) with no double-strand break
and no donor. Scanning the early CDS found real candidates:

| codon | change | protein lost | guide + PAM | strand | C at window position | bystander C | on-target |
|---|---|---|---|---|---|---|---|
| **17** | **TGG→TGA** | **97.5 %** | `TTCCCAAAAATTGGCCGCGA` TGG | − | **4** | 5 | 0.80 |
| 166 | CAG→TAG | 76.0 % | `CTGCCAGTACTATGGAAGGA` TGG | + | 5 | 4 | 0.83 |
| 212 | CAG→TAG | 69.4 % | `TGCGCTCAGGAGATCCATAG` ... | + | — | — | — |

Codon 17 is the one to use: a stop at residue 17 of 693 removes **97.5 %** of Hhip, the editable C sits at
protospacer position 4 (squarely in the BE4max window), and the edit is `C>T` on the reverse strand at
chr1:35,790,542. Zebrafish precedent for the editor class: Zhang et al. 2017, *Nat Commun* 8:118,
doi [10.1038/s41467-017-00175-6](https://doi.org/10.1038/s41467-017-00175-6).

**Why this is better than the frameshift:** every edited allele is the *same* allele. A frameshift guide gives
each founder a different indel, which is the single biggest reason F0 knockout phenotypes are hard to read.
**The caveat applies to both routes equally:** a premature stop is not guaranteed to be a null — it can trigger
nonsense-mediated decay (usually wanted), leave a truncated protein with residual or neomorphic activity, or
trigger **transcriptional adaptation of paralogues**, a real and documented zebrafish problem (El-Brolosy et al.
2019, *Nature* 568:193–197, doi [10.1038/s41586-019-1064-z](https://doi.org/10.1038/s41586-019-1064-z)). There
is a `hhipl1` in zebrafish, so this is not a theoretical worry here.

---

## 5. Off-target search — **it now returns**, and it is exhaustive

**This was the biggest gap in the previous run, and it is closed.** Every plan now carries a filled off-target
table against GRCz11, produced locally in ~22 seconds per guide.

### What changed, and why

The previous run used the NCBI BLAST URL API (`blastn-short`, `word_size 7`, against
`GPIPE/7955/current/all_top_level`). That path was implemented correctly and politely, and it **never returned**:
four guide jobs plus four cheaper probe parameter sets — including `word_size 16` against the
reference-chromosomes-only database, which should have been trivial — each got an RID and then sat in
`Status=WAITING` past the poll budget, one of them for over 45 minutes. So every plan reported
`off_target: {ran: false}` and the table stayed empty. The bottleneck was the public queue, not the query, so no
parameter we controlled would have fixed it. That experience is now recorded in the code as
`NCBI_QUEUE_EXPERIENCE`, and the BLAST backend is still available as `offtarget_method: "ncbi"` — it is simply
no longer the default.

The default is now **`grcz11-local.mjs`**: a local, complete enumeration.

| | NCBI blastn-short (previous default) | local exhaustive scan (now) |
|---|---|---|
| returns? | **no** — queued indefinitely | **yes**, ~22 s per guide for the whole assembly |
| completeness | heuristic seeding; **can miss** sites whose mismatches leave no exact 7-mer | **exhaustive** for substitutions: every position of both strands tested, no seeding step |
| PAM | searched the **spacer only**; PAM unverified at most sites | **PAM checked at every reported site** |
| credentials | none | none |
| searched | GRCz11 via RefSeq accessions | GRCz11 primary assembly: 25 chromosomes + MT + 967 unplaced scaffolds, **1,373,471,384 bp**, 993 sequences |

It walks every position of both strands, keeps the positions whose PAM matches the nuclease's IUPAC motif
(anchored on the single most restrictive PAM base, so most positions are rejected after one comparison), and
counts mismatches against the spacer with an early exit. The index is one byte per base, built once from
`ftp.ensembl.org/pub/current_fasta/danio_rerio/dna/Danio_rerio.GRCz11.dna.primary_assembly.fa.gz`.

**The exhaustiveness claim is tested, not asserted.** Test 8 brute-forces every position of the mitochondrial
genome with a separate, deliberately naive string matcher and requires the two site sets to be **identical** —
and, because the first version of that test compared zero sites with zero sites, it now also asserts that the
brute force actually found something. `--fail-once` corrupts the spacer handed to the indexed search, and both
assertions die.

### The positive control that makes the table trustworthy

**Every one of the six guides finds exactly one perfect match, and it is at its own intended locus.** That is
not a formality: it confirms at once that the search works, that the index is correct, and that the GRCz11
coordinates in §1 are right — by a route entirely independent of the Ensembl calls that produced them.

| guide | edit | perfect match found at |
|---|---|---|
| `GAACCAAGAAGCCCCATAAA` | kcnk5b W169L, HDR | chr20:9,232,957 (−) |
| `ACAATTGTGTTCCTTTTATG` | kcnk5b W169L, pegRNA | chr20:9,232,946 (+) |
| `GGTTGTCATTGTTCTTCAGT` | kcnk5b F241Y, HDR | chr20:9,237,299 (+) |
| `GGATCTACCTGGGCCTTGCT` | kcnk5b F241Y, pegRNA | chr20:9,237,278 (+) |
| `GAGAATTAAGTCCAAGGAGG` | hhip frameshift | chr1:35,790,574 (+) |
| `TTCCCAAAAATTGGCCGCGA` | hhip iSTOP codon 17 | chr1:35,790,523 (−) |

### The actual numbers

Sites are counted at ≤4 mismatches **with a compatible PAM**. MIT specificity is the Hsu 2013 aggregate
(doi [10.1038/nbt.2647](https://doi.org/10.1038/nbt.2647)) over the mismatched sites. "Exonic" means the site
falls within ±2 kb of a protein-coding gene per Ensembl `/overlap/region`.

| guide | edit | total ≤4 mm | 2 mm | 3 mm | 4 mm | MIT specificity | exonic |
|---|---|---|---|---|---|---|---|
| `GGATCTACCTGGGCCTTGCT` | F241Y pegRNA | **8** | 0 | 0 | 7 | **98.86** | 2 |
| `TTCCCAAAAATTGGCCGCGA` | hhip iSTOP c.17 | **16** | 0 | 0 | 15 | **98.61** | 9 |
| `GAGAATTAAGTCCAAGGAGG` | hhip frameshift | **23** | 0 | 1 | 21 | **95.59** | 12 |
| `GAACCAAGAAGCCCCATAAA` | W169L HDR | **23** | **1** | 1 | 20 | 90.82 | 1 |
| `GGTTGTCATTGTTCTTCAGT` | F241Y HDR | **79** | 0 | 3 | 75 | 86.69 | 14 |
| `ACAATTGTGTTCCTTTTATG` | W169L pegRNA | **138** | **2** | 9 | 126 | **73.49** | 15 |

**The three findings a wet lab would act on:**

1. **The `kcnk5b` W169L HDR guide has a 2-mismatch off-target** — `AAACCAAGAAGCCCCACAAA|GGG` at
   chr24:10,727,912 (−), mismatches at spacer positions 1 and 17, Hsu single-site score 0.059. Position 1 is
   PAM-distal and so the most tolerated position there is, which means this site is plausibly cuttable. It is
   **intergenic** — no gene within ±2 kb — which is the good news. Amplicon-sequence it in any founder anyway.
2. **The `kcnk5b` F241Y HDR guide has a 3-mismatch off-target inside a protein-coding gene** —
   `GCTTGTCATTTTTCTTCACT|AGG` at chr2:47,771,797 (−), in **`mbnl1`**. That is the single most consequential
   number produced in this run: `mbnl1` is a splicing regulator, and it is exactly the kind of site that could
   confound a fin-morphology phenotype. The `hhip` frameshift guide likewise has a 3-mismatch site in
   **`rnf220b`** (chr8:18,282,059), though with a far lower Hsu score (0.0005).
3. **The pegRNA spacer for W169L is the worst guide of the six, and the pegRNA spacer for F241Y is the best.**
   `ACAATTGTGTTCCTTTTATG` has 138 sites, two at 2 mismatches, nine at 3, and one 3-mismatch hit in `nfe2l2a`
   (the Nrf2 orthologue) — MIT 73.49. `GGATCTACCTGGGCCTTGCT` has eight sites in the whole genome, none closer
   than 4 mismatches — MIT 98.86. These are the two guides §4 asks you to order for prime editing, and they sit
   at opposite ends of the specificity range. Order both, but screen the W169L pegRNA much harder.

### Gene annotation is prioritised, and says when it does not know

An exhaustive search finds 100–200 sites at 4 mismatches for some guides, and annotating all of them would be
hundreds of Ensembl calls per guide for sites whose Hsu score is ~0.001. So **every site at ≤3 mismatches is
annotated however many there are**, then others up to a budget of 25. Each search carries a `gene_annotation`
summary with `n_annotated`, `n_annotation_failed` and `n_not_attempted`. A site that was not annotated, or whose
Ensembl call failed (the REST endpoint returned transient 500s and 503s under load; each site is retried twice),
is reported as **`UNKNOWN` — never as intergenic**. Those are different facts and the output keeps them apart.

### What a filled table still does NOT establish

Stated at length, because a completed search invites more trust than it deserves:

- **No bulges.** This counts substitutions only. Cas9 tolerates DNA/RNA bulges (an insertion or deletion at the
  target), and a bulged off-target is invisible here. The count is exhaustive *for substitutions* and remains a
  floor overall.
- **Not your fish.** The primary assembly only: no alternative loci, no patches, and **not the genome of the
  AB/TU/WIK line you would inject.** Laboratory strains differ from the reference at high SNP density, so a site
  can exist in your fish that does not exist here — and the on-target protospacer and PAM must be Sanger-verified
  in the actual breeding animals before anything is ordered.
- **A sequence match is not a cut.** Nothing here models chromatin, expression, delivery or Cas9 residence time.
- **It is not a measurement.** GUIDE-seq, CIRCLE-seq or amplicon sequencing of the real animals is the
  measurement. This is the list of places to look.

---

## 5b. On-target scoring — a **published** model now, and what it cost to get it

The previous run scored guides with a heuristic whose weights we chose, labelled as such. That label was honest
but it was also an admission, so this run went after the real thing.

### Doench 2016 "Rule Set 2" cannot be reimplemented from published numbers — and that is now established

This was tried first, because Rule Set 2 is the better model and the one CRISPOR and CHOPCHOP report. It is not
implementable here, and the reason is specific rather than a shrug:

- The shipped Azimuth model is a **pickled scikit-learn `GradientBoostingRegressor`: 100 decision trees of
  depth 3 over 627 features, learning rate 0.1, squared-error loss.** This was read out of the pickle's own
  bytes. **There is no coefficient vector in existence to transcribe.** Porting Rule Set 2 means extracting 100
  trees, not copying a table.
- Doench 2016's **Supplementary Table 17 is Gini feature importance** — a feature *ranking*, not weights.
  Supplementary Table 19 could not be inspected: nature.com redirects to `idp.nature.com` behind a login wall
  and the PMC copy exposes only uncaptioned PDFs, so its contents are recorded as **UNVERIFIED**, not as empty.
- **Neither CRISPOR nor CHOPCHOP serves a callable REST API**, so neither could be asked for a Rule Set 2 score
  either. Both are live web forms (HTTP 200); `/api` is 404 on CHOPCHOP, and CHOPCHOP's Bitbucket source
  (`valenlab/chopchop`) now 404s on every raw branch path and on the Bitbucket API — the repository appears to
  be gone. CRISPOR's `crisporEffScores.py` *is* importable and CLI-callable, which makes it usable as a local
  reference oracle (academic/non-profit licence only).

All of this is in the output, as `DOENCH.RULE_SET_2`, so a reader does not have to take the absence on trust.

### What was implemented instead: Doench 2014 "Rule Set 1", from the primary source

| | |
|---|---|
| model | logistic regression, 70 position-specific nucleotide and dinucleotide features over a 30-mer, plus a GC term and an intercept |
| citation | Doench et al. 2014, Nat Biotechnol 32:1262–1267, doi [10.1038/nbt.3026](https://doi.org/10.1038/nbt.3026) |
| coefficients from | **Supplementary Table 9, "Feature weights from the final model used to score sgRNAs", page 15** of the Supplementary Text and Figures PDF — fetched in this run and extracted with `pdftotext -raw` |
| precision | the published table is rounded to 8 dp; the values used carry 9, from Bioconductor `crisprScore`. All 70 keys match the published table and all 70 values round to the published values exactly, so this is a refinement of the published numbers, not a different model |
| cross-checked against | the published PDF, CRISPOR's `doenchScore.py`, Bioconductor `crisprScore`, and FlashFry — four sources, all agreeing |
| self-test | reproduces both reference vectors published in CRISPOR's `doenchScore.py` (0.713089368437 and 0.0189838463593) to ~5 × 10⁻⁹, which is exactly the 8-dp-versus-9-dp residual |

Two gotchas, recorded because they would cost the next person an hour each. The coefficient table exists **only
as a PDF table** — none of the six `.xlsx` supplements contain these numbers. And that PDF's font has a broken
`ToUnicode` map in which **the minus sign decodes as the literal character `9`** (`GG12 91.5169074` is
−1.5169074); the substitution is unambiguous only because every coefficient has |v| < 2.

Four degenerate coefficient pairs (`A25`/`AG25`, `C25`/`CG25`, `T25`/`TG25`, `T28`/`GT27`) are **in the published
table**, not a transcription slip: the PAM `G`s sit at 1-based 26 and 27, so `AG25` is `A25` plus a constant `G`.
The model double-counts them by construction, every implementation reproduces the double count, and so does this
one — removing it would no longer be Doench 2014.

### Both numbers are reported, and they disagree — which is the point

`on_target_doench2014` applies only to **SpCas9 with a 20-nt spacer and an NGG PAM**; for SaCas9 and AsCas12a it
returns `{ran: false}` with the reason rather than a number computed on a geometry the model never saw. The
heuristic is kept precisely because nothing published covers those nucleases.

| edit | guide | bp to edit | **Doench 2014 (published)** | our heuristic |
|---|---|---|---|---|
| W169L | `GAACCAAGAAGCCCCATAAA` ← the plan's pick | 2 | **0.124** | 0.88 |
| W169L | `ACAATTGTGTTCCTTTTATG` | 1 | **0.254** ← best | 0.425 |
| W169L | `GTTCCTTTTATGGGGCTTCT` | 5 | 0.029 | 0.63 |
| F241Y | `GGTTGTCATTGTTCTTCAGT` ← the plan's pick | 4 | 0.174 | 0.88 |
| F241Y | `AGAACAATGACAACCAAGCA` | 14 | **0.232** ← best | 0.83 |
| hhip | `GAGAATTAAGTCCAAGGAGG` ← the plan's pick | — | 0.241 | **1.000** |
| hhip | `GGAGTGTTCTAGACTGCTGG` | — | **0.441** ← best | **1.000** |
| hhip | `GACGGACAGCAGGACACGCG` | — | 0.430 | **1.000** |
| hhip | `GGAGAGAAAACTGTCACTCG` | — | 0.078 | **1.000** |

**The `hhip` rows are the clearest argument for having done this work.** Our heuristic scores all four guides at
**exactly 1.000** — it saturates and discriminates nothing. Doench 2014 spreads the same four guides over
0.078–0.441, a 5.7-fold range, and ranks the plan's own pick **third**. On `kcnk5b` W169L the heuristic prefers
the guide the published model likes least by a factor of two. **Neither score is a measured efficiency and
neither should be trusted alone** — but a heuristic that returns 1.000 for everything was hiding that it had
nothing to say, and it no longer can.

---

## 5c. Evo2 via BioNeMo, and the `ranking` section

Amit asked for Evo2 via BioNeMo2 to "guide cassette design intelligently". What is wired is the honest version
of that: Evo2 is a genomic language model, so what it gives is a **likelihood over DNA**, and the plan uses it
to **rank** options it has already produced. It never invents an edit and it never gates one.

### The three legitimate uses, and only these

1. **`edited_vs_reference`** — score the edited locus against the reference locus, to flag an edit the model
   finds implausible *for this genome*.
2. **`codon_choice_ranking`** — rank the synonymous codon options for the desired residue by likelihood rather
   than by our hand rule ("fewest nucleotide changes, ties to the commoner zebrafish codon"). W169L has **6**
   such options, F241Y has **2**.
3. **`blocking_mutation_ranking`** and **`insert_outlier`** — rank the silent blocking-mutation sets, and flag a
   pegRNA/ssODN insert that sits oddly in context. **This is the use where a likelihood adds the most**, because
   our blocking-mutation rule guarantees only that the change is silent *at the protein level*. It can still
   swap a common codon for a rare one, or break a splice or regulatory motif — and the protein re-translation
   that validates it cannot see any of that.

### What a likelihood is NOT — stated in the output, not only in a comment

- **Not a prediction that the edit produces the phenotype.** This is the central point. Our own design
  validation **failed** (`design-validation/REPORT.md`: 1 of 10 phenotypic parameters scored, that one FAILED,
  joint verdict NOT CLOSE / largely UNSHOWN, Lean gate FAILS). No model score repairs that, and none is
  presented as if it did. A likelihood says the sequence looks like the genomes the model was trained on. Fin
  length is not in that statement anywhere.
- **Not evidence of safety.** A likely-looking edit can be lethal.
- **Not evidence of specificity.** Evo2 scores the sequence handed to it. It does not search the genome, knows
  nothing about off-targets, and cannot substitute for §5.
- **Not a cutting or knock-in efficiency**, and never combined with the Doench numbers into one figure.
- **Not calibrated.** A log-likelihood delta has no units a wet lab can act on. **No threshold is asserted here
  and none is implied** — only an ordering.

### It did not run, and here is exactly why

**Every Evo2 field in all three plans reads `{ran: false, reason: "NVIDIA_API_KEY not set"}`, and all three
plans are complete without it.** No key is present in this environment.

The key this project was given is a **Brev-style key beginning `bak-`**, which NVIDIA NIM rejects with HTTP 401.
A Brev key authenticates Brev GPU instances, not NIM inference endpoints. **NIM keys begin `nvapi-`** and come
from build.nvidia.com. The module reports the key's *prefix shape* only and never the key itself; the key is
read from `process.env.NVIDIA_API_KEY` at call time and is never written to a file, logged, cached, echoed into
output, or put in a URL.

**A working `nvapi-` key is the only missing piece.** With one present at runtime, `edited_vs_reference`,
`codon_choice_ranking`, `blocking_mutation_ranking` and `insert_outlier` all run on the three planned edits
without any code change. Because the scoring route's exact response field names could not be exercised against a
live key, `scoreSequence` **parses defensively and returns `{ran: false, reason: "the Evo2 response carried no
recognisable likelihood field"}` with the key names it did see**, rather than inventing a number — a response we
cannot read must look like a failure, not like a score.

**Test 9 enforces the degradation.** It walks the entire `evo2` block for any numeric likelihood field and
requires every one to be absent, and separately requires the plan's guide, donor and coordinates to be present
anyway. `--fail-once` writes a fabricated score into the block with `ran: true` and the reason deleted — the
exact shape the real failure would take — and the test catches it.

### The `ranking` section: five separate orders, never one blended score

Each plan now carries a `ranking` block holding every order the plan computes, each with the rule that produced
it and **what that rule cannot see**:

| order | rule | what it cannot see |
|---|---|---|
| `plan_order` | cut-site distance bucketed to 10 bp, then the heuristic | specificity — it does not look at off-targets at all |
| `doench2014_published_model` | Rule Set 1 score, descending; carries its own self-test result | zebrafish anything; it is a mouse/human-cell model |
| `our_heuristic` | our formula, flagged `THIS_IS_OURS` | that it was never fitted to data |
| `measured_specificity_against_grcz11` | fewest close off-target sites, then MIT aggregate | bulges, your strain's genome, chromatin, delivery |
| `evo2_likelihood` | Evo2 mean per-base log-likelihood | everything in the "is NOT" list above |

They are kept separate deliberately. Blending a published model, a heuristic we invented and a language-model
likelihood into one number would hide exactly the distinctions that matter, and a lab should be able to disagree
with any one order without discarding the others. The section states how to use them together: **take a guide
high in both the published on-target order and the specificity order, and where they disagree, prefer
specificity** — a guide that cuts slightly worse at the right place is recoverable; a guide that cuts well in a
second gene is not. Use the Evo2 order only to break ties the other orders leave level.

That advice has teeth here. On F241Y, Doench 2014 prefers `AGAACAATGACAACCAAGCA` (0.232) — which has **7 sites
at 3 mismatches and 4 of them exonic**, against the plan's pick at 3 sites and MIT 86.69. The on-target order
and the specificity order point at different guides, and §5 is the one to follow.

---

## 6. Reagents — only where a published zebrafish construct exists

No cassette is needed for an F0 injection plan at all: Cas9 protein or mRNA, plus synthetic or T7 sgRNA, plus
(for HDR) a synthetic ssODN, injected into the one-cell embryo. Promoter cassettes are listed only for the case
where a reagent must be expressed from the genome.

| reagent | citation |
|---|---|
| nCas9n mRNA from **pT3TS-nCas9n** | Jao, Wente & Chen 2013, *PNAS* 110:13904–13909, doi [10.1073/pnas.1308335110](https://doi.org/10.1073/pnas.1308335110) |
| **SpCas9 protein as RNP** (higher and earlier activity than mRNA) | Burger et al. 2016, *Development* 143:2025–2037, doi [10.1242/dev.134809](https://doi.org/10.1242/dev.134809) |
| sgRNA by T7 from a **pDR274**-type vector | Hwang et al. 2013, *Nat Biotechnol* 31:227–229, doi [10.1038/nbt.2501](https://doi.org/10.1038/nbt.2501) |
| **U6 sgRNA cassettes (pU6a–d)** for transgenic/multiplex use | Yin et al. 2015, *Genetics* 200:431–441, doi [10.1534/genetics.115.176917](https://doi.org/10.1534/genetics.115.176917) |
| cytosine base editing in zebrafish | Zhang et al. 2017, *Nat Commun* 8:118, doi [10.1038/s41467-017-00175-6](https://doi.org/10.1038/s41467-017-00175-6) |
| adenine base editing in zebrafish | Qin et al. 2018, *BMC Biology* 16:139, doi [10.1186/s12915-018-0609-1](https://doi.org/10.1186/s12915-018-0609-1) |
| prime editing in zebrafish | Petri et al. 2022, *Nat Biotechnol* 40:189–193, doi [10.1038/s41587-021-00901-y](https://doi.org/10.1038/s41587-021-00901-y) |

sgRNA scaffold (constant region, 3′ of the 20-nt spacer), from the Jinek 2012 / Mali 2013 single-guide design
as used in the zebrafish protocols above:

```
GTTTTAGAGCTAGAAATAGCAAGTTAAAATAAGGCTAGTCCGTTATCAACTTGAAAAAGTGGCACCGAGTCGGTGC
```

**Plasmid repository numbers are deliberately not asserted.** The papers are the citation; verify any Addgene
number with the depositor before ordering. We did not fetch the repository records in this run and will not
state a number we have not read.

Of the five recommended guides, four already start with G and need no change for T7; `TTCCCAAAAATTGGCCGCGA`
(hhip iSTOP) does not, so it needs a 5′-G appended — one extra mismatch at protospacer position 1 — or a
synthetic sgRNA, and the plan says which.

---

## 7. Feasibility, with real numbers

| what | number | source | kind |
|---|---|---|---|
| **error-free HDR in zebrafish** | **1–4 % of alleles**, relatively constant across ssODN designs; enough to transmit to F1 | Boel et al. 2018, *Dis Model Mech* 11:dmm035352, doi [10.1242/dmm.035352](https://doi.org/10.1242/dmm.035352), PMID 30355591 | measured — **their loci, not ours** |
| repair-template **fragments integrate** at the cut site | — | Boel 2018 | measured |
| dominant factor in HDR rate | **homology-arm length** | Boel 2018 | measured |
| **optimal ssODN length** | **120 nt total, symmetric** — 60→120 nt raised HDR significantly in 3 of 4 targets, "maximum improvement being tenfold"; 180 nt was worse | Boel 2018 | measured — **sourced this run**; replaces the 40/40 default (§3) |
| does asymmetry help? | **UNSETTLED — the two zebrafish papers disagree.** Boel: "asymmetrically designed templates did not result in better HDR rates". Prykhozhij: asymmetric anti-sense was "substantially more efficient (3- to 10-fold)" but varied orientation and asymmetry **together** | Boel 2018; Prykhozhij 2018 | measured, **contradictory** |
| best single optimisation | **anti-sense asymmetric ssODN**; also cut-site proximity and phosphorothioate | Prykhozhij et al. 2018, *NAR* 46:e102, doi [10.1093/nar/gky512](https://doi.org/10.1093/nar/gky512), PMID 29905858 | measured — but see the row above, and note an **erratum exists** (doi [10.1093/nar/gky674](https://doi.org/10.1093/nar/gky674)) that we did **not** read |
| cut-site distance effect | **<15 nt, ideally <10 nt; efficiency drops to 20–30 % of maximum at 20 nt** | **Paquet et al. 2016, *Nature* 533, doi [10.1038/nature17664](https://doi.org/10.1038/nature17664), PMID 27120160** — quoted in Prykhozhij's introduction, which cites it as its sole reference for the figure | measured-secondhand — **MURINE CELLS, not zebrafish.** Prykhozhij's own zebrafish statements on distance are qualitative only |
| **base editing in zebrafish (C→T)** | **up to 91 %** with ancBE4max (`rb1` W63*); 73 % with BE4-gam (`ctnnb1` S33L), 86 % (`tp53` Q170*), 64 % (`sod2`) — these are **peak single-embryo** values, not means | Rosello et al. 2021, *eLife* 10:e65552, doi [10.7554/eLife.65552](https://doi.org/10.7554/eLife.65552) | measured — **their loci, not ours**; sourced this run. Relevant to the `hhip` iSTOP route (§4), **not** to either `kcnk5b` transversion |
| base editing, earlier report | **up to 28 %** site-specific single-base mutations | Zhang et al. 2017, *Nat Commun* 8:118, doi [10.1038/s41467-017-00175-6](https://doi.org/10.1038/s41467-017-00175-6), PMID 28740134 | measured |
| **knock-in founder transmission** | **1–5 % of founders** transmit; stable lines established by screening ≤12 fish per gene with fin biopsies | Carrington et al. 2022, *BMC Genomics* 23:810, doi [10.1186/s12864-022-08971-1](https://doi.org/10.1186/s12864-022-08971-1), PMID 36476416 | measured — **this is a FOUNDER TRANSMISSION rate, not a per-embryo HDR efficiency**; do not read it in the same column as Boel's 1–4 % |
| knock-in rate, second zebrafish report | **1.04 % and 0.57 % total** (`tp53` R143H, R217H), of which 83 % and 81 % were correct; indels at the same sites were 26.1 % and 28.4 % | Prykhozhij 2018 | measured — **their loci**; a useful reminder that NHEJ dominates by more than an order of magnitude |
| **off-target *trans* knock-ins** | a previously unrecognised risk; needs a dedicated detection workflow | Prykhozhij 2018 | measured |
| prime editing in zebrafish | **up to 30 % somatic, in embryos**, with unintended indels and scaffold incorporation. Germline transmission is **demonstrated but not quantified** — the abstract gives no numeric germline rate | Petri 2022 | measured — **their loci, not ours** |
| time to F2 homozygotes | **~6–8 months** at best (≈3 months per generation to sexual maturity) | standard husbandry | derived |

**What we could not source, after looking.** Still unsourced: no measured HDR, base-editing or prime-editing
rate for `kcnk5b` or `hhip` specifically, and none for any guide listed here — the percentages above bound an
order of magnitude and nothing more. Also still unsourced: the size of the phosphorothioate gain; a numeric
germline prime-editing rate; and an Addgene number we had actually read.

**Three gaps from the previous run were closed** (the optimal arm length, zebrafish base-editing efficiencies,
and the founder-transmission rate) and **one gap turned out to be a mis-citation rather than a gap**: there is
no zebrafish-measured cut-site-distance curve to find, because the number everyone quotes is Paquet's murine
one. **One new gap opened:** whether asymmetric arms help in zebrafish is **unsettled in the literature**, not
merely unsourced by us — the two relevant papers disagree and neither isolates arm length from strand
orientation. That is why both donors are still emitted.

**Three caveats on the sourcing itself,** recorded rather than smoothed over: Boel's per-template percentages
are in its Table S1, which was **not** fetched; Prykhozhij 2018 has an **erratum we did not read**, so we cannot
rule out that it touches the knock-in percentages; and Rosello's figures are **peak single-embryo** values from
its Table 2, not means — quoting "up to 91 %" as a typical rate would be wrong.

### What is NOT established

1. **That the edit produces the predicted phenotype.** Our own design validation
   (`design-validation/REPORT.md`, pre-registered) scored **1 of 10** phenotypic parameters; the one that could
   be scored **FAILED**; the joint verdict was recorded as **`(NOT CLOSE / largely UNSHOWN, Lean gate FAILS)`**;
   and the design reproduces **1 of 74** loci known to differ in flying fishes (1.4 %). An editing plan for an
   edit whose phenotypic consequence is unestablished is a plan to make an animal whose phenotype we cannot
   predict.
2. **That HDR will work.** 1–4 % error-free, and most edited alleles will be indels, not the intended change.
3. **F0 fish are mosaics.** An F0 phenotype is **not** the phenotype of the intended genotype. Nothing can be
   concluded from F0 about the designed allele.
4. **F1/F2 outcrossing and genotyping are mandatory**, by amplicon sequencing across the whole locus (Boel 2018
   says to expect integrated donor fragments) — not by restriction digest, and not only at the edited base.
5. **Institutional animal-care approval is required before the first injection.** This module does not and
   cannot grant any of it, and nothing here is a reason to start.
6. **Strain polymorphism.** All coordinates are the GRCz11 reference. AB, TU and WIK differ at high SNP
   density; a SNP in the PAM makes a guide dead. Sequence the protospacer in the actual breeding fish.
7. **Zygosity.** The published winged zebrafish is a double **heterozygote**. Check which the design asks for
   before planning an F2 intercross.

### What would falsify these plans

| id | what would falsify it | how to check | what it kills |
|---|---|---|---|
| `coordinate-wrong` | sequencing the wild-type locus shows a different base at the stated coordinate | PCR and sequence before ordering | the whole plan for that edit |
| `polymorphism` | the protospacer or PAM is polymorphic in the lab's strain | sequence it in the breeding fish | that guide |
| `no-cut` | no indels at the target in injected embryos | amplicon-sequence pooled 2 dpf embryos | the on-target heuristic (never a measurement) |
| `offtarget-missed` | cutting at a site not listed | amplicon-sequence top sites; GUIDE-seq or CIRCLE-seq | the specificity number — **which this run does not even have** |
| `no-hdr` | no precise knock-in in F1 after the planned screen | amplicon-sequence F1 | the HDR route; switch to prime editing |
| `template-integration` | ssODN fragments integrated, or a correct base beside an indel | sequence the full amplicon, both alleles | the assumption that a positive genotype means a clean allele |
| `no-phenotype` | a clean homozygous F2 shows no predicted morphology | measure fin length / SL blind to genotype | **the design, not the plan** — and our own validation says we cannot predict this either way |
| `lethality` | no homozygote can be raised | score Mendelian ratios in F2 | the homozygous version of the plan |

---

## 8. Tests

`node sim-engine/validate/editplan/test.mjs` — **45 pass, 0 fail.**

`node sim-engine/validate/editplan/test.mjs --fail-once` injects a fault into every test and re-runs: **35 FAIL,
10 PASS**, where the 10 are whitelisted setup lines (a fixture read, "the plan resolves", "a pegRNA was
designed", "the brute force actually found sites") that assert nothing about the subject. **Every one of the 35
real assertions dies when its subject is broken**, which is what makes them tests. The mode is reproducible
rather than a claim about something that happened once.

| test | what it checks |
|---|---|
| 1 | **coordinate mapping against known alleles** — `kcnk5b` *alf* W169L and F241Y, read as expectations from `sequences/alignments/kcnk5b.json` so the two cannot drift apart; reference residue, codon, **pinned GRCz11 coordinates**, the genome round trip, and that W169L is a transversion |
| 2 | **PAM detection** — 9 IUPAC cases (NGG, NNGRRT, TTTV); every protospacer+PAM reads back from its own coordinates; every cut 3 bp 5′ of the PAM on the guide's own strand; Cas12a's PAM is 5′ |
| 3 | **off-target counting** — mismatch counting over 6 hand-built alignments; the ≤4 limit actually excludes a 6-mismatch site; Hsu 2013 properties (perfect = 1, PAM-proximal costs more than PAM-distal, 2 mismatches cost more than 1); aggregate specificity is 100 with none and strictly falls; RefSeq→Ensembl chromosome mapping |
| 4 | **refusals** — 11 cases: unresolvable symbol, empty symbol, a human gene, `species: homo_sapiens`, `species: mus_musculus`, "a human embryo" in the request text, a wrong reference residue, a position past the protein's end, an unparseable change, a non-coding gene, and the same refusal through `editPlan` |
| 5 | **donor correctness** — exactly one amino-acid change, every blocking mutation verified silent, the donor differs from the reference |
| 6 | **pegRNA correctness** — the extension differs from the reference at exactly the edited base(s), and only inside the RT template, never the PBS |
| 7 | **the Doench 2014 coefficient table was transcribed correctly** — both published reference vectors reproduce; a 34-mer and a non-NGG 30-mer are **refused rather than scored** |
| 8 | **the local off-target search is actually exhaustive** — an independent brute force over the whole mitochondrial genome must find **exactly** the same site set; a spacer taken out of MT must find its own locus as a perfect match **at the right coordinate**; every reported site must carry an NGG-compatible PAM; and the comparison must not be vacuous |
| 9 | **Evo2 degrades honestly** — the whole `evo2` block is walked for any numeric likelihood field and every one must be absent with no key; every field must say `ran: false` with the reason; the plan's guide, donor and coordinates must be present anyway; and the "not a phenotype prediction" and "never gates" disclaimers must be **fields of the output**, not only source comments |

**The fault injector earned its keep three times, and each catch was a real bug in a test.**

1. Shifting F241 by one codon still passed, because **codon 242 of `kcnk5b` is also a phenylalanine**. "The
   residue matches what I claimed" does not prove the position is right. The fix pins the genomic coordinates,
   which also makes test 1 a regression test against coordinate drift between Ensembl releases.
2. Test 7's first fault perturbed only the **first** coefficient of the Doench table — and feature `[1,'G']`
   matches neither reference vector, so the score never moved and the test passed **with a broken table**. The
   fault now perturbs all 70.
3. Test 8's first version picked a spacer from MT blindly. It had no NGG PAM, so the brute force found 0 sites,
   the indexed scan found 0 sites, and "the two agree" passed on **nothing at all** while the positive control
   failed and exposed it. The test now searches for a PAM-carrying protospacer first and separately asserts
   that the brute force found something. Its fault corrupts the spacer handed to the indexed search.

---

## 9. Every number's label

| number | kind | what it is **not** |
|---|---|---|
| GRCz11 coordinates, codon, strand | **measured** | not inferred — the codon is read back out of the genome and re-translated; a mismatch is a refusal |
| zebrafish codon usage | **measured** | Kazusa, 19 062 CDSs / 8 042 248 codons, fetched this run |
| on-target, `on_target_doench2014` | **measured-secondhand** (published model) | **not Rule Set 2.** Doench 2014 Rule Set 1, coefficients fetched from Suppl. Table 9 and self-tested. Fitted in **mouse and human cell lines** — a transfer across species, delivery and readout. Scores **cutting** in a knockout screen, **not** knock-in. SpCas9/20-nt/NGG only |
| on-target, Rule Set 2 | **not implemented** | and now established, not assumed: the Azimuth model is a pickled 100-tree `GradientBoostingRegressor`, so **no coefficient vector exists to transcribe** (§5b) |
| on-target, `on_target` | **assumed** (labelled heuristic) | **weights are ours and were not fitted.** Kept only because nothing published covers SaCas9 or Cas12a. On `hhip` it returns 1.000 for all four guides — it discriminates nothing there |
| Hsu 2013 weights | measured-secondhand | the published MIT weights, not re-derived |
| MIT specificity | derived | a prediction, not a measured rate. **Present in this run** (§5). No longer a floor from a heuristic aligner, but still a floor with respect to **bulges** |
| off-target site list | derived | **exhaustive for substitutions** over the GRCz11 primary assembly. Blind to bulges, to alternative loci, and to your strain's genome. A sequence match is not a cut |
| ssODN symmetric arms | **measured-secondhand** | 60/60 = Boel's measured 120 nt total optimum (**corrected from 40/40 this run**); the per-arm split is ours |
| ssODN asymmetric arms | borrowed | 36/91 is a human-cell result (Richardson 2016); Boel and Prykhozhij **disagree** on whether asymmetry helps at all |
| cut-site distance thresholds | measured-secondhand | **<10 nt / 20 nt / 20–30 % are Paquet 2016 MURINE numbers**, quoted in Prykhozhij's introduction — **not** zebrafish data (§2) |
| Evo2 likelihood | **assumed** | **not a phenotype prediction, not evidence of safety, not evidence of specificity, not calibrated, not a threshold.** It ranks; it never gates. **Did not run: no `nvapi-` key** (§5c) |
| HDR 1–4 % | measured | Boel 2018's loci, not ours |
| prime editing ≤30 % | measured | Petri 2022's loci, not ours |
| pegRNA PBS/RTT | assumed | Anzalone defaults, not optimised here |
| protein fraction lost | derived | arithmetic on the codon number, not a measured truncation |
| **"the edit produces the predicted phenotype"** | **assumed — NOT ESTABLISHED** | `design-validation/REPORT.md`: 1 of 10 scored, that one failed |

---

## 10. Provenance of the run

- **Endpoints, all public and unauthenticated, no credentials anywhere:** Ensembl REST (`/lookup/symbol`,
  `/sequence/id?type=cds`, `/map/cds`, `/sequence/region`, `/overlap/region`), Kazusa Codon Usage Database,
  **Ensembl FTP** (the GRCz11 primary assembly, downloaded once for the local off-target index), Europe PMC and
  PMC (citation verification), **static-content.springer.com** (the Doench 2014 supplementary PDF),
  raw.githubusercontent.com (CRISPOR / crisprScore / FlashFry, as cross-checks on the coefficient table). The
  NCBI BLAST URL API is still implemented but is no longer the default and was not used for these numbers.
- **The one credentialled endpoint, which did NOT run:** NVIDIA NIM / BioNeMo (`health.api.nvidia.com`) for
  Evo2. The key is read from `NVIDIA_API_KEY` at call time only and is never written, logged, cached or echoed.
  No key is set here, so every Evo2 field is `{ran: false, reason}` (§5c).
- **Sponsor-tool reachability, probed rather than assumed.** **OpenResearch / alphaXiv: no callable API.**
  `api.alphaxiv.org` answers 200 but serves a placeholder (`<h1>Dreaming is free</h1>`); `/health` is 200 while
  `/v1/papers`, `/v2/papers`, `/docs` and `/openapi.json` are all 404, and there is no OpenAPI spec.
  `openresearch.org` serves a bot interstitial; `api.openresearch.org` is **NXDOMAIN**. So the AGENTS.md
  standing order to ground new material in an OpenResearch run **could not be satisfied through an
  OpenResearch API**, and this is recorded as a blocked integration rather than quietly skipped. Every number
  added in this run was instead sourced through endpoints that do work and are named above — PMC, PubMed,
  Europe PMC REST and the publisher's own supplementary PDF — each with the URL that was actually fetched.
  **GitHub code search needs authentication** (401 unauthenticated); repo trees and raw.githubusercontent.com
  do not.
- **Cache:** `C:/Temp/editplan-cache` (override `EDITPLAN_CACHE_DIR`) — off the near-full D: drive, as the
  environment rules require. **Nothing is committed and nothing was deployed.**
- **Polite:** ≥120 ms between Ensembl calls (`EDITPLAN_MIN_GAP_MS`), one BLAST request in flight per guide,
  15 s between polls.
- **Citations were verified against Europe PMC in this run**, not quoted from memory: the Boel, Prykhozhij,
  Petri, Zhang and Qin entries each had their journal, volume, page, DOI and PMID checked, and two numbers
  (1–4 % error-free HDR; up to 30 % somatic prime editing) were read out of the fetched abstracts. Citations
  **not** re-verified this run are marked `measured-secondhand` in the provenance (Burger 2016, Jao 2013,
  Hwang 2013, Yin 2015, Richardson 2016, Billon 2017, El-Brolosy 2019, Anzalone 2019, Jinek 2012, Mali 2013,
  Hsu 2013, Ran 2015, Zetsche 2015).
- **Scope, enforced in code:** *Danio rerio* only — `resolveGenomic()` refuses any other species and any request
  naming a non-fish organism, and `edit_plan` refuses before reaching the resolver. **No Aves data is read or
  fetched anywhere in this module.**
