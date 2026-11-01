# Germline editing plans for the winged zebrafish's edits — a proposal, not a protocol

**Run 2026-11-01. Three edits planned for real: `kcnk5b` p.W169L, `kcnk5b` p.F241Y, `hhip` loss of function.**

> **READ THIS FIRST.** Everything below is a **proposal for a wet lab to check**, line by line, against its own
> genome build, its own guide-scoring tool and its own fish. Nothing here has been tested at a bench by us. No
> guide has been cut, no embryo injected, no fish genotyped. On-target scores are a **labelled heuristic**, not a
> validated efficiency model. Off-target counts are a **floor**, not a ceiling. The HDR and prime-editing rates
> are **other papers' loci**. And our own validation of the design these edits belong to **did not establish that
> the edits produce the predicted phenotype** — it mostly could not score it at all
> (`design-validation/REPORT.md`). Any of this that touches an animal needs institutional animal-care approval
> (IACUC or equivalent) **before** the first injection. *Danio rerio* only; the module refuses every other
> species in code.

Reproduce:

```bash
node sim-engine/validate/editplan/cli.mjs --gene kcnk5b --change p.W169L
node sim-engine/validate/editplan/cli.mjs --gene kcnk5b --change p.F241Y
node sim-engine/validate/editplan/cli.mjs --gene hhip   --change knockout
node sim-engine/validate/editplan/test.mjs               # 30 tests
node sim-engine/validate/editplan/test.mjs --fail-once   # inject a fault per test; all 26 assertions must FAIL
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
zebrafish germline (Petri 2022, up to 30 % somatic). For `hhip`, by contrast, a cytosine base editor **can** do
the job cleanly: codon 17 `TGG`→`TGA` installs a stop that removes **97.5 %** of the protein with no
double-strand break. The number we could not produce is the off-target one: a genome-wide `blastn-short` search
against GRCz11 was submitted for every guide and **did not finish on NCBI's public queue within the run** (§5).

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
the on-target heuristic, then exact distance**. Cut-site proximity matters (Prykhozhij 2018), but 1 bp versus
2 bp is not a real difference, while a guide with a poly-T run is simply dead — without the bucket, a 1-bp-closer
dead guide wins. For a knockout, the heuristic alone, since any coding cut frameshifts.

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

### `kcnk5b` p.W169L, on guide `GAACCAAGAAGCCCCATAAA`

**Symmetric, 81 nt, arms 40/40, GRCz11 20:9,232,922–9,233,002**

```
5'-CAGAGAAAAGTTCAGTTCATCTGCACAATTGTGTTTCTCTTATTGGGCTTCTTGGTTCACTTAATCATCCCAGCCTTTGTG-3'
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

**Symmetric, 81 nt, arms 40/40, GRCz11 20:9,237,276–9,237,356**

```
5'-AAAACTTTATGAGCTTCCACCACCATATGCACGTTCCAACTAAAGTATAATGACAACCAAGCAAGGCCCAGGTAGATCCAT-3'
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

## 5. Off-target search — what we could NOT produce

**This is the number the plans are missing, and it is the most important gap.**

The search is implemented and is real: NCBI BLAST URL API, `blastn-short`, `word_size 7`, `expect 1000`,
`hitlist 500`, against **`GPIPE/7955/current/all_top_level`** — the zebrafish genome assembly — with each
full-length ≤4-mismatch hit scored by the **Hsu 2013 (MIT) position weights**
(doi [10.1038/nbt.2647](https://doi.org/10.1038/nbt.2647)) and the gene context of each site read from Ensembl
`/overlap/region`. RefSeq chromosome accessions are mapped back to Ensembl chromosome names (`NC_007112`→chr1 …
`NC_007136`→chr25), and that mapping is unit-tested.

**It did not finish.** Searches were submitted for all five guides we would actually order:

| guide | edit | NCBI result |
|---|---|---|
| `GAACCAAGAAGCCCCATAAA` | kcnk5b W169L, HDR | submitted, `Status=WAITING` past the 10-minute budget |
| `ACAATTGTGTTCCTTTTATG` | kcnk5b W169L, pegRNA | same |
| `GGTTGTCATTGTTCTTCAGT` | kcnk5b F241Y, HDR | same |
| `GAGAATTAAGTCCAAGGAGG` | hhip frameshift | same |
| `TTCCCAAAAATTGGCCGCGA` | hhip iSTOP codon 17 | same |

Then three cheaper parameter sets were submitted to find one that would return:

| probe | database | word size | result |
|---|---|---|---|
| `EDHK4388014` | `all_top_level` | 7 | `WAITING` after **> 45 min** |
| `EDK9RZS2014` | `ref_top_level` | 11 | `WAITING` after > 20 min |
| `EDK9SZEJ014` | `all_top_level` | 11 | `WAITING` after > 20 min |
| `EDK9S7B5014` | `ref_top_level` | **16** | `WAITING` after > 20 min |

**None returned, including `word_size 16` against the reference-chromosomes-only database** — which should have
been cheap. The bottleneck is NCBI's public queue at the time of this run, not the query design, so no parameter
change available to us would have fixed it. The implementation is complete and cached; re-running
`cli.mjs` without `--no-offtarget` will fill this section in whenever the queue clears.

**So: every off-target number in these plans is absent, not small.** The planner reports
`off_target: {ran: false, reason}` rather than a zero, and `mit_specificity` is `null` rather than 100. **Do not
read the absence of listed off-targets as evidence of specificity.** Before ordering any guide here, run it
through CRISPOR or CHOPCHOP (both reachable, HTTP 200, but neither offers a REST API we could call
programmatically), or a local `bwa`/`Cas-OFFinder` index of GRCz11, which is the right tool for this and what we
would use with more time.

The limits that would apply **even if it had finished**, stated because a completed search invites more trust
than it deserves: `word_size 7` is a heuristic seed and **can miss** sites whose mismatches are spread so no
exact 7-mer survives; the primary assembly only, no alternative loci; **no bulges** (DNA/RNA insertions or
deletions at the target), which Cas9 tolerates. The count is a **floor**, never a ceiling.

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
| best single optimisation | **anti-sense asymmetric ssODN**; also cut-site proximity and phosphorothioate | Prykhozhij et al. 2018, *NAR* 46:e102, doi [10.1093/nar/gky512](https://doi.org/10.1093/nar/gky512), PMID 29905858 | measured |
| **off-target *trans* knock-ins** | a previously unrecognised risk; needs a dedicated detection workflow | Prykhozhij 2018 | measured |
| prime editing in zebrafish | **up to 30 % somatic**, germline transmission shown, with unintended indels and scaffold incorporation | Petri 2022 | measured — **their loci, not ours** |
| time to F2 homozygotes | **~6–8 months** at best (≈3 months per generation to sexual maturity) | standard husbandry | derived |

**What we could not source:** no measured HDR, base-editing or prime-editing rate for `kcnk5b` or `hhip`
specifically, and none for any guide listed here. The 1–4 % and 30 % figures bound an order of magnitude and
nothing more. We also could not source a zebrafish-specific optimal homology-arm length (Boel identified arm
length as the dominant factor but we did not read the optimum off their figures), nor the size of the
phosphorothioate gain, nor an Addgene number we had actually read.

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

`node sim-engine/validate/editplan/test.mjs` — **30 pass, 0 fail.**

`node sim-engine/validate/editplan/test.mjs --fail-once` injects a fault into every test and re-runs: **26 FAIL,
4 PASS**, where the 4 are whitelisted setup lines (a fixture read, "the plan resolves", "a pegRNA was designed")
that assert nothing about the subject. **Every one of the 26 real assertions dies when its subject is broken**,
which is what makes them tests. The mode is reproducible rather than a claim about something that happened once.

| test | what it checks |
|---|---|
| 1 | **coordinate mapping against known alleles** — `kcnk5b` *alf* W169L and F241Y, read as expectations from `sequences/alignments/kcnk5b.json` so the two cannot drift apart; reference residue, codon, **pinned GRCz11 coordinates**, the genome round trip, and that W169L is a transversion |
| 2 | **PAM detection** — 9 IUPAC cases (NGG, NNGRRT, TTTV); every protospacer+PAM reads back from its own coordinates; every cut 3 bp 5′ of the PAM on the guide's own strand; Cas12a's PAM is 5′ |
| 3 | **off-target counting** — mismatch counting over 6 hand-built alignments; the ≤4 limit actually excludes a 6-mismatch site; Hsu 2013 properties (perfect = 1, PAM-proximal costs more than PAM-distal, 2 mismatches cost more than 1); aggregate specificity is 100 with none and strictly falls; RefSeq→Ensembl chromosome mapping |
| 4 | **refusals** — 11 cases: unresolvable symbol, empty symbol, a human gene, `species: homo_sapiens`, `species: mus_musculus`, "a human embryo" in the request text, a wrong reference residue, a position past the protein's end, an unparseable change, a non-coding gene, and the same refusal through `editPlan` |
| 5 | **donor correctness** — exactly one amino-acid change, every blocking mutation verified silent, the donor differs from the reference |
| 6 | **pegRNA correctness** — the extension differs from the reference at exactly the edited base(s), and only inside the RT template, never the PBS |

**The fault injector earned its keep.** It caught a weak test: shifting F241 by one codon still passed, because
**codon 242 of `kcnk5b` is also a phenylalanine**. "The residue matches what I claimed" does not prove the
position is right. The fix pins the genomic coordinates, which also makes test 1 a regression test against
coordinate drift between Ensembl releases.

---

## 9. Every number's label

| number | kind | what it is **not** |
|---|---|---|
| GRCz11 coordinates, codon, strand | **measured** | not inferred — the codon is read back out of the genome and re-translated; a mismatch is a refusal |
| zebrafish codon usage | **measured** | Kazusa, 19 062 CDSs / 8 042 248 codons, fetched this run |
| on-target guide score | **assumed** (labelled heuristic) | **not Doench 2016 Rule Set 2, not Azimuth, not a measured efficiency, not calibrated on any zebrafish data.** Terms from published observations; **weights are ours and were not fitted** |
| Hsu 2013 weights | measured-secondhand | the published MIT weights, not re-derived |
| MIT specificity | derived | a prediction, not a measured rate; **absent in this run** (§5) |
| off-target site list | derived | **absent in this run**; absence is not specificity |
| ssODN arm lengths | borrowed | 40/40 is conventional, not Boel's measured optimum; 36/91 is a human-cell result |
| HDR 1–4 % | measured | Boel 2018's loci, not ours |
| prime editing ≤30 % | measured | Petri 2022's loci, not ours |
| pegRNA PBS/RTT | assumed | Anzalone defaults, not optimised here |
| protein fraction lost | derived | arithmetic on the codon number, not a measured truncation |
| **"the edit produces the predicted phenotype"** | **assumed — NOT ESTABLISHED** | `design-validation/REPORT.md`: 1 of 10 scored, that one failed |

---

## 10. Provenance of the run

- **Endpoints, all public and unauthenticated, no credentials anywhere:** Ensembl REST (`/lookup/symbol`,
  `/sequence/id?type=cds`, `/map/cds`, `/sequence/region`, `/overlap/region`), Kazusa Codon Usage Database,
  NCBI BLAST URL API, Europe PMC (citation verification only).
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
