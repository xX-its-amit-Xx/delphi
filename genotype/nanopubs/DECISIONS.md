# Genotype thread: nanopublication decisions

Conventions inherited from `claim-tests/nanopubs/DECISIONS.md` and `AGENTS.md`: unsigned drafts only, no human ORCID
(the creator is the software agent until the key holder approves and signs), no assertion, provenance or pubinfo
template declared because these hand-authored Delphi 2.0 records were not created from one, datasets described
inline, test registry before production and production only with the key owner's explicit approval.

## 2026-10-31 - kcnk5b recorded as one record, not two

`AGENTS.md` asks for one record per reading where a finding is mixed across readings, and for a single record
stating both components where the mixture is inside one reading, with the choice logged here.

The kcnk5b result is the second case. There is one reading of the claim: "a chain of evidence runs from kcnk5b to
increased fin length". Within that reading, the end points are supported (gain-of-function alleles raise potassium
conductance; overexpression in intra-ray mesenchyme fibroblasts is sufficient for outgrowth; the phenotype is
proportionally enlarged fins with longer segments) while the middle link is contradicted (three papers disagree on
whether the growth-driving change is a hyperpolarization or a depolarization, and one obtains the same overgrowth
from a decreased-conductance channel). Splitting that into two records would invent two readings that no source
distinguishes, and would let the supported record travel without the contradiction. So: one record,
`chain-kcnk5b-fin-size.trig`, status "mixed within one reading", with the supported and the unsupported component
stated separately in the description and the disagreement counted as its own metric.

## 2026-10-31 - publications as entities, with the quote and whether the full text was read

The chain records cite papers rather than bulk datasets, so each cited publication is its own `prov:Entity` carrying
its bibliographic citation, its identifier, the verbatim sentence the grade rests on, and whether the subagent read
the full text or only the abstract. A paywalled paper is cited as abstract-only rather than left out, because the
grade depends on which was read: three of the four records contain at least one abstract-only source, and the
kcnh2a record exists partly because its key paper could not be fetched at all.

## 2026-10-31 - gja5a kept out of the fin-length chain

An earlier note from this thread offered Daane 2021's `gja5a` convergent substitution as a second link between the
flying-fish genomics and the bioelectric fin-size story. The cell-cell subagent checked it and the link does not
hold: the fin-length connexin in zebrafish is `gja1b` (cx43, the `short fin` locus), `gja5a` has no ZFIN fin
expression or phenotype record, and Daane 2021's own text puts cx43 under *constrained*, not accelerated, evolution
along the flying-fish branch. The `gja5a` substitution stays in the map's `fin_size` block as the paper's own data,
and it is kept out of any causal chain. The real connexin tie to the potassium-channel story is `gja1b` with
Seaver 2025, which is independent of Daane.

## 2026-10-31 - the flying-fish genome correction recorded as a correction, not quietly fixed

The thread's constraint line said "almost no molecular data exists for flying fish" and called the available
resource "one scaffold-level assembly". That was wrong: the same accession carries an annotated gene set of
23,611 predicted protein-coding genes. The error was load-bearing, because the constraint was repeated on every
number in the map, on the public dashboard, and in the brief ten subagents worked under.

It could have been fixed silently by editing the wording. It is instead recorded as
`correction-flying-fish-genome-exists.trig`, with the same three-part framing used for the gja5a withdrawal:
what we said, what the source says, what changed. The record names the project lead as the person who caught it
and states that the thread which published the error did not catch it. The numbers in the record are read from
the map's `flying_fish_genome` block, which was built by fetching the paper's full text, so the record and the
data cannot drift apart.

Two things kept the correction honest rather than merely apologetic. The headline figure is caveated in the
record itself: 99.5% "functionally annotated" means one sequence-similarity or domain hit, and the unreviewed
TrEMBL database supplies 23,477 of them, so it measures database coverage rather than understood function. And
the surviving negative is established by counting, not by inference: the strings "RNA-seq" and "transcriptome"
appear zero times in that paper, so "no expression data" is a count.

This is the thread's second public self-correction. Both are drafts in this folder rather than edits to history.
