# Does overexpressing kcnk5b in fin mesenchyme enlarge fins in the injected fish?

*A proposal from the DELPHI validation harness. Case `kcnk5b-overexpression-f0`, ranked 1 of 5.*

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

**What this case expects:** local overgrowth in a substantial minority of injected fish that carry DsRed-positive fin cells, tightly associated with DsRed in the MESENCHYME specifically, and absent in both a DsRed-only control and a non-conductive channel variant

Numbers: control plasmid (DsRed only): 0/240 fish with overgrowth. kcnk5b (wt or W169L): overgrowth in "about 40 %" of injected fish showing DsRed-positive cells in the fins. Association of overgrowth with DsRed-positive mesenchymal tissue: 89.2 %, N = 37. Non-conductive GFG->AAA variant: no overgrowth, in fins containing DsRed-positive tissue, n = 32. Overgrown tissue with no detectable DsRed: W169L 2/26, wt 2/11.

## How many animals

**30 per arm**, and that number counts N is SCORABLE ADULTS THAT CARRY FIN-EXPRESSING CLONES, not injected embryos.

- vs the marker-only control: n = 16
- vs the specificity control: n = 30 ← the binding one
- the smallest expected cell count is 0.200, below the usual 5 at which the normal approximation is trusted. Use Fisher's exact test, and expect it to need slightly MORE animals than this number, not fewer.

Two fractions sit between that number and the embryos to inject, and neither is published:
- the fraction of injected embryos that survive to adulthood in this lab, on this mix - unpublished for this route, which is why the plan records the survival curve rather than assuming one
- the fraction of surviving adults that show DsRed-positive cells IN THE FINS - the published 40 % is conditioned on this, and the conditioning fraction itself is not published

*score the larval DsRed rate in a pilot clutch, which bounds the second fraction from above and costs one clutch and one afternoon.*

## The experiment, in brief

- **organism** danio_rerio, wild-type one-cell zygotes
- **what is done** none - transgene overexpression, not a genome edit (Tol2 transgenesis, injected plasmid + transposase mRNA)
- **readout** presence of LOCAL fin and barbel overgrowth in adults, scored against DsRed-positive mesenchyme in the same fin, at adult (injected fish raised to adulthood)
- **time to an answer** about 4 month(s)
- **arms** 4, one-at-a-time over plasmid dose, with BOTH published controls in the same session
  - `control:dsred-only` — ef1a:DsRed plasmid alone, same dose, same session
  - `control:non-conductive` — ef1a:kcnk5b(GFGAAA) + ef1a:DsRed, same dose
  - `plasmid-dose:low` — 5 ng/ul
  - `plasmid-dose:high` — 20 ng/ul

**The controls are the experiment here.**
- `control:dsred-only` — published 0/240. Proves that overgrowth needs the channel, not the injection or the transgene machinery.
- `control:non-conductive` — published no overgrowth, n = 32 fins with DsRed-positive tissue. Proves that overgrowth needs the channel to CONDUCT, which is the mechanism claim.
- **Still missing:** a positive control for TRANSPOSITION itself - a construct known to integrate and express in fin tissue in this facility. A lab new to Tol2 should run one before committing four months of tank space, and no published candidate for it is recorded here.

## Money

**$168.60** is what this adds in a lab that already runs zebrafish injections.
$3136.52 is the whole list, including $2967.92 of bulk salts, consumables and general kits such a lab already owns.

**This total is a lower bound.** `construct-ef1a-kcnk5b`: The construct is not in Addgene or any other searchable repository. In the source paper it was built from two gift plasmids (Ale237 from A. Mongera and 587jk from J. Krauss) and the non-conductive variant was made by PCR mutagenesis. So this line is either a request to the corresponding author of Perathoner et al. 2014 (free, but on their timetable and subject to an MTA), or a cloning project of three constructs: wild-type, the DsRed-only control, and the GFG->AAA specificity control.

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

*Generated from `sim-engine/validate/bench` at render time. Every figure above is re-derived from the package, so this page cannot be newer or older than the thing it describes. Case ranking rule: this is the top-ranked case.*
