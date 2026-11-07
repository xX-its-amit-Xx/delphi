# Does installing a published another-longfin substitution in kcnk5b enlarge the fins?

*A proposal from the DELPHI validation harness. Case `kcnk5b-alf-knockin`, ranked 3 of 5.*

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

**What this case expects:** the allometric coefficient of CAUDAL fin length against standard length rises from about 1.29 in wild type to near 2 in heterozygotes

Numbers: wild type k=1.29 (R^2=0.92); alf/+ k near 2 (R^2=0.95); significance ***: p<0.001

**A mismatch we have not resolved.** The published number measures the caudal fin; the design's claim is about the pectoral fin. UNRESOLVED. No published adult wild-type pectoral-fin-length/standard-length allometry was found for Danio rerio in this search, and design-validation/scorecard.json records the same gap from the other direction: the axis the design claim rests on cannot be scored because the only reference value found is figure-only.

## How many animals

**This comparison cannot be powered yet**, and we would rather say so than produce a number.

- missing: **a standard error on the allometric coefficient, or the per-animal residuals behind the regression**
- from: Perathoner et al. 2014 Fig. 1D states NO n at all, because it is a regression across development rather than a group comparison. The n = 4 in that figure belongs to panel 1C, a different measurement on a different fin. There is no published dispersion for this coefficient.

What we refuse to do: substitute a conventional effect size (a "medium d = 0.5", or a round n = 20 per group) to make the gate pass. A sample size derived from a convention rather than from this system's own numbers would look identical to a real one in the plan, and would be the single most dangerous number in it.

## The experiment, in brief

- **organism** danio_rerio, wild-type AB/TU
- **what is done** p.W169L or p.F241Y (ONE of them - see ALLELE_CORRECTIONS) (point, gain-of-function)
- **readout** CAUDAL fin length normalised to standard length, as an allometric coefficient (caliper-measured mm, reduced to a dimensionless regression exponent), at adult (reproductively mature, >3 months)
- **time to an answer** about 7 month(s)
- **arms** 7, one-at-a-time, not a full factorial
  - `control:buffer` — injection buffer, no nuclease
  - `guide-dose:below-plateau` — 1.5 uM guide
  - `guide-dose:at-plateau` — 4.5 uM guide
  - `guide-number:single-guide` — 1 guide
  - `guide-number:multi-guide` — 3-4 guides
  - `donor-chemistry:symmetric` — symmetric ssODN, 120 nt total
  - `donor-chemistry:asymmetric-antisense` — anti-sense asymmetric ssODN

**Controls:** `slc24a5` (95 % (55/58) and 100 % (37/37)) proves the injection worked; `tbx5a` (100 % (43/43) of F0 larvae did not develop pectoral fins) proves the lab can score the readout.

## Money

**$705.44** is what this adds in a lab that already runs zebrafish injections.
$3095.36 is the whole list, including $2389.92 of bulk salts, consumables and general kits such a lab already owns.


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
