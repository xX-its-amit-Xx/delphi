# Does disrupting kcnk5b change pectoral fin bud growth in the injected embryo?

*A proposal from the DELPHI validation harness. Case `kcnk5b-f0-finbud`, ranked 2 of 5.*

## Read this first: what this is not

> Not a protocol, not a quote, not evidence that the experiment will work, and not permission to start. The cassette it is built around comes from sim-engine/validate/editplan, which calls itself a proposal for a wet lab to check - this package inherits that status exactly and adds no confidence to it.

It is a costed, sourced experimental **proposal** with decision gates, assembled from published methods. The methods themselves stay in the papers it cites, on purpose: a restated protocol loses its errata.

## Before anything: approval

**Institutional animal-care approval (IACUC or local equivalent), plus biosafety registration for the nuclease and any synthetic nucleic acid.**
Stage 0 of every route: *approval covers this line, these numbers and these endpoints* — otherwise *nothing below may start*.

This module cannot grant any of it, and nothing in the plan starts without it.

## What is already known, including the part that argues against us

**In the fin-size program the winged-zebrafish design edits, loss of function does not change fin size. The informative edits are all precise gain-of-function point changes.**

- *kcnk5b* — the null allele has wild-type fins. “A revertant of alf^dty86d (j131x8) shows wild type-sized fins.” (Perathoner et al. 2014, PLoS Genet 10(1):e1004080, doi 10.1371/journal.pgen.1004080, PMID 24453984)
- *kcnh2a* — homozygous loss does not change fin length. “homozygous loss of kcnh2a has no overt effects on zebrafish development to adulthood, including fin length” (Stewart et al. 2021, Development 148(11):dev199384, doi 10.1242/dev.199384, PMID 34061172)
- *lat4a* — loss-of-function homozygotes are phenotypically normal, so the fin effect needs the point allele and not a knockout. “Zebrafish with homozygous loss-of-function mutations in lat4a are phenotypically normal and viable (S7 Fig).” (Daane et al. 2021, Curr Biol 31(22):5052-5061.e8, doi 10.1016/j.cub.2021.08.054, PMID 34534441)

**What this case expects:** fin buds of kcnk5b-targeted embryos are reduced in size by 48 hpf, and the reduction is rescued by an sgRNA-resistant kcnk5b mRNA

**No published numbers exist for this comparison.** NO means, standard deviations, sample sizes or p-values appear in the main text for this comparison - they exist only in the figure legends and the S1-S7 source data. The authors themselves write that the changes "are not large, but they are biologically significant". A replication therefore CANNOT be powered without first obtaining the source data, and that step belongs in the plan rather than being assumed away. One lab, not yet replicated elsewhere.

## How many animals

**This comparison cannot be powered yet**, and we would rather say so than produce a number.

- missing: **the standard deviation of the bud-area/eye-area ratio in control embryos, and the mean difference**
- from: Jiang et al. 2024 S4 Data (doi 10.1371/journal.pbio.3002565). The main text and figure legends give no mean, SD, n or p for this comparison; the per-comparison values are in the source data file only.
- **this is a data request, not an experiment.** One extraction would make it runnable.

What we refuse to do: substitute a conventional effect size (a "medium d = 0.5", or a round n = 20 per group) to make the gate pass. A sample size derived from a convention rather than from this system's own numbers would look identical to a real one in the plan, and would be the single most dangerous number in it.

## The experiment, in brief

- **organism** danio_rerio, wild-type AB/TU
- **what is done** frameshift knockout (NHEJ, no donor)
- **readout** pectoral fin bud area normalised to eye area at 48 hpf, at 48 hpf
- **time to an answer** about 0.1 month(s)
- **arms** 5, one-at-a-time, not a full factorial
  - `control:buffer` — injection buffer, no nuclease
  - `guide-dose:below-plateau` — 1.5 uM guide
  - `guide-dose:at-plateau` — 4.5 uM guide
  - `guide-number:single-guide` — 1 guide
  - `guide-number:multi-guide` — 3-4 guides

**Controls:** `slc24a5` (95 % (55/58) and 100 % (37/37)) proves the injection worked; `tbx5a` (100 % (43/43) of F0 larvae did not develop pectoral fins) proves the lab can score the readout.

## Money

**$753.40** is what this adds in a lab that already runs zebrafish injections.
$3143.32 is the whole list, including $2389.92 of bulk salts, consumables and general kits such a lab already owns.


Not included, and for any case needing a generation these dominate everything above:
- fish husbandry and facility costs, which for any case needing a generation dominate everything here
- labour - the largest real cost of all
- shipping, tax and vendor surcharges; one supplier never publishes shipping at all
- the microinjection rig, stereoscope, micromanipulator and incubator, which are capital a lab either has or does not
- institutional overhead

*Every price is a PUBLIC LIST PRICE in USD, read from the vendor's own page on the date in `read_on`. Academic and non-profit institutions buy on contract and pay less. No price here is a quote, none includes shipping, tax or surcharges, and none should be presented to a finance office as a cost.*

## What we are asking for

1. **Tell us what is wrong with this before anyone orders anything.** Blunt is more useful than polite. The traps list, the stop rules and the ordering files come with it.
2. If the power section above refuses, the missing number is a literature or source-data question, not bench time.
3. If you run it: blind scoring, both controls in the same session from the same clutch, and per-animal values rather than summaries. The return format is in the package.

*Generated from `sim-engine/validate/bench` at render time. Every figure above is re-derived from the package, so this page cannot be newer or older than the thing it describes. Case ranking rule: see the package.*
