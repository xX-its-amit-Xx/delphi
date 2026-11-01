# Does the design supply what the functional analogue has? The functional resolution ledger

`sim-engine/validate/functional/` — the FOURTH named result, `functional_resolution`, beside `genotype_similarity`,
`phenotype_similarity` and `lean_check`. Built to Amit's design: compare the novel organism with the closest
**FUNCTIONAL** analogue, then take every genetic difference and ask how many can be functionally resolved from
known sequence annotations.

Data: `results.json` (every case, every row, and the ledger as the scorer's own interface normalises it).
Code: `analogue.mjs`, `requirements.mjs`, `resolve.mjs`, `compensation.mjs`, `cards.mjs`, `designs.mjs`,
`score.mjs`, `index.mjs`. Derived inputs: `data/analogue-requirements.json`, `data/design-residues.json`,
`data/term-specificity.json`. Tests: `test/functional.test.mjs` (25, all passing).

---

## The honest sentence

**For the winged zebrafish against the flying fish we can assess 22 of 73 requirements (30.1 %). Of those 22
differences, 2 are met — both ancestrally, by a residue the zebrafish already carried — 1 rests on a hypothesis,
and 19 are UNRESOLVED. Nothing is resolved by compensation, by a paralogue or by an analogous gene set. And ZERO
of the 73 loci have any flying-fish expression, proteomic or functional-assay data of any kind, so every
"requirement" here is a sequence state of the analogue, never a measured function of it.**

The second honest sentence: **the coverage number is the headline, not the resolved fraction.** A resolved fraction
over a denominator we chose, from an analogue with no functional data, is the number most likely to mislead, so
`functional_resolution` sits beside the composite score as a gate and is never folded into it.

---

## The analogue, and both distances

| | |
|---|---|
| desired phenotype (the generator's prompt) | "a zebrafish with wings: enlarged pectoral fins that let it glide over the water like a flying fish" |
| function, operationally | **glides over water**: leaves the water and travels through air over a measurable distance without flapping-powered thrust |
| how the function was chosen | **specified** — parsed from the desired-phenotype text ("glide"). Not inferred from the base organism's relatedness |
| closest functional analogue | **flying fishes, Exocoetidae** |
| second, independent glider | **gliding halfbeaks** (*Euleptorhamphus viridis*, *Oxyporhamphus micropterus*), fin/SL median 0.274 — they glide **without** meeting the enlarged-fin criterion, which is why the two functions are separate rows in the registry |
| **phylogenetic** distance | MRCA clade **Clupeocephala** (Ensembl Compara `taxonomy_level`, from the orthologue records fetched for these loci). Same cohort, different superorder. **No dated divergence is asserted** — no source fetched in this thread dates the split, so no number is given rather than a remembered one |
| **functional** distance | **UNMEASURABLE.** The axis is pectoral fin length / SL. The analogue is 0.687 (median of 49 specimens, Daane 2021 sheet A). The design side has no number at all: `design-validation/REPORT.md` axis 1 is CANNOT SCORE on **both** sides — no fetched source gives an adult zebrafish pectoral fin length / SL, and the winged zebrafish's own value exists only inside Daane Figure 4B, which this project refuses to digitise |

The two distances are reported separately and never combined. A close functional analogue may be phylogenetically
remote; that is the whole premise of choosing by function.

### The analogue is data-poor, and this is the result Amit asked us to state plainly

| what we hold for Exocoetidae | |
|---|---|
| genome | a draft genome and gene set for **one** species, *Hirundichthys speculiger* (Xu et al. 2021, doi 10.3389/fgene.2021.695700, GCA_018398805.1) |
| transcriptome | **NONE.** `omics/transcriptomic/SOURCES.md`: no flying-fish RNA-seq, raw or processed, in SRA/ENA/GEO/ArrayExpress; 3,485 loose Europe PMC hits and not one flying-fish transcriptome. No pectoral-fin expression data at all |
| proteome | **NONE.** `omics/proteomic/SOURCES.md`: 3 UniProt rows out of 199,149; no MS evidence, no abundance, no structures |
| gene identifiers | **9 of 3,860** genes carry a *Hirundichthys* identifier (`omics/genes.json` `coverage.flying_fish`); 7 of 9 are clean reciprocal best hits |
| mutants / functional assays | **NONE.** No flying fish has ever been mutated, knocked down or functionally assayed in any source we fetched |
| of the **73 requirement loci**, how many carry a flying-fish identifier | **2** (`slc43a2a`, `prdm1a`) |
| of the 73, how many carry flying-fish **expression or assay** data | **0** |

So **"almost nothing about the analogue's function is assessable, because the analogue has no functional data"** is
the honest answer at the function level, and it is a real result about designing from a data-poor analogue. What
*is* assessable is the analogue's **sequence state**, which is what the ledger below reports — and the ledger says
so on its face rather than letting a reader mistake the one for the other.

---

## The requirement set, and what we can and cannot assess

The requirement set is every locus Daane et al. 2021 (Curr Biol, doi 10.1016/j.cub.2021.08.054, PMID 34534441,
Data S1) reports as **known to differ in flying fishes**: sheet G (convergent amino-acid substitutions ticked for
Exocoetidae) and sheet I (glider relative-evolutionary-rate genes). Built by `scripts/build-requirements.mjs` into
`data/analogue-requirements.json`; the analogue's residue at each site is re-read per species from the captured
exons (the `sequences/` thread's Zenodo capture), not copied from the publisher's sheet.

**73 requirements**: 41 usable sheet-G sites + 32 sheet-I genes. (`design-validation/REPORT.md` counts **74
distinct loci**. The difference is bookkeeping, recorded rather than smoothed over: one sheet-G row duplicates
`gpr171 A285E`, and one — `doc2d P44P` — is synonymous as written, so it is a locus but not a site. Our count is of
usable *requirements*, theirs of distinct *loci*.)

**Assessability rule, fixed before the numbers.** A requirement is assessable only if **both**:

1. the analogue's state is READ and CONFIRMED — at least one Exocoetidae species carries the derived residue in our
   own re-read of the captured exons, not merely a tick in the publisher's sheet; and
2. the locus has a *Danio rerio* orthologue (Ensembl Compara), so there is a locus in the design to compare.

| | count |
|---|---|
| requirements total | **73** |
| **assessable** | **22 (30.1 %)** |
| unassessable — sheet I: a per-**gene** RATE correlation across the tree, with no per-species state, so there is nothing for a design to match | 32 |
| unassessable — sheet G: our own re-read finds the derived residue in **0** flying-fish species with data at the site, so the requirement is **not confirmed in the analogue** | 9 |
| unassessable — sheet G: our re-read has **no residue** at the site in any flying-fish species | 8 |
| unassessable — **no zebrafish orthologue** exists for the locus (`cdh6`, `p3h4`) | 2 |
| of the 22 assessable, how many allow a **full** resolution search (the locus is inside the 3,860-gene annotated universe, so paralogue / expression / pathway / domain records can be looked up) | **7** |
| of the 22, how many allow only a **gene-level** statement (orthologue outside the annotated universe: the difference can be stated but no resolution can be searched for) | **15** |

That last row matters: **14 of the 19 UNRESOLVED rows carry the caveat that the UNRESOLVED verdict is the absence
of a SEARCH, not the absence of a resolution** (the fifteenth gene-level-only row, `lipca`, is a SAME and needed no
search). The ledger prints that caveat on every such row rather than banking the gap as a finding.

**What the requirement set is not.** It is not the set of loci that differ in flying fishes — it is the set *known*
to differ: 74 coding loci against the 23,611 predicted protein-coding genes of the *H. speculiger* assembly, 0.31 %
of the gene set. It is not causal (`sequences/progression.json` warns that tracking is not causing, and that the
non-gliders score zero at these sites BY CONSTRUCTION). And it contains **no regulatory requirements at all**,
because Daane's accelerated-conserved-non-coding-element sheets (K, M) are GO-term enrichment tables with no gene
column — so the layer where most between-species difference actually lives cannot be enumerated. A named gap, not
a zero.

---

## THE HEADLINE LEDGER — winged zebrafish vs flying fish, all 22 assessable requirements

One row per requirement. `results.json` carries every row in full, with every evidence item's source.

| requirement | analogue evidence | design state | class | evidence | weakest kind |
|---|---|---|---|---|---|
| the analogue carries the Exocoetidae-associated derived residue L in place of F at position 326 of lat4a (ENSORLG00000009715) | the analogue carries L at lat4a position 326 in 8 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | same gene, DIFFERENT state: the requirement is F326L and the design carries p.T200K at position 200, a different site | ALLELIC (hypothesis) | the design carries p.T200K on slc43a2a (lat4a nr21 / ZFIN slc43a2a dmh26; missense; zygosity heterozygous) [curated]<br>the design's state is NOT the analogue's state: a different position in the same protein [measured]<br>lat4a nr21 / ZFIN slc43a2a dmh26 is a real, documented allele, so the design's state exists in a real organism [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue H in place of L at position 321 of vit-6 (ENSORLG00000006187) | the analogue carries H at vit-6 position 321 in 5 of 6 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry H321 at vit-6: the locus is not edited, and the design's base residue at the homologous site was NOT READ | UNRESOLVED | the design's residue at this site could not be read: LOW CONFIDENCE: window identity 0.273 is below the 0.6 rule. The difference is therefore asserted at GENE level (the design does not edit this locus), not at residue level [inferred-electronic]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search,  | inferred-electronic |
| the analogue carries the Exocoetidae-associated derived residue K in place of R at position 24 of dph5 (ENSORLG00000014112) | the analogue carries K at dph5 position 24 in 7 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry K24 at dph5: the locus is not edited, and the design's base residue is R, not K | UNRESOLVED | the design's base carries R at the aligned column (window identity 0.636) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue G in place of S at position 671 of ptprt (ENSORLG00000009770) | the analogue carries G at ptprt position 671 in 9 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry G671 at ptprt: the locus is not edited, and the design's base residue at the homologous site was NOT READ | UNRESOLVED | the design's residue at this site could not be read: LOW CONFIDENCE: the design side is a gap at this site. The difference is therefore asserted at GENE level (the design does not edit this locus), not at residue level [inferred-electronic]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not th | inferred-electronic |
| the analogue carries the Exocoetidae-associated derived residue R in place of K at position 1534 of ltn1 (ENSORLG00000004903) | the analogue carries R at ltn1 position 1534 in 7 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry R1534 at ltn1: the locus is not edited, and the design's base residue at the homologous site was NOT READ | UNRESOLVED | the design's residue at this site could not be read: LOW CONFIDENCE: window identity 0.545 is below the 0.6 rule. The difference is therefore asserted at GENE level (the design does not edit this locus), not at residue level [inferred-electronic]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search,  | inferred-electronic |
| the analogue carries the Exocoetidae-associated derived residue R in place of K at position 141 of tmem74b (ENSORLG00000017466) | the analogue carries R at tmem74b position 141 in 8 of 9 Exocoetidae species with data (1 of 2 gliding halfbeaks also carry it) | the design does not carry R141 at tmem74b: the locus is not edited, and the design's base residue is K, not R | UNRESOLVED | the design's base carries K at the aligned column (window identity 1) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue M in place of L at position 225 of lipca (ENSORLG00000008243) | the analogue carries M at lipca position 225 in 9 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | none at the residue level: the zebrafish reference already carries M at the homologous site (position 225) | SAME | the design's base protein carries M at the column aligned to lipca 225, which IS the analogue's derived state. Read by global alignment at 63.67 % identity, local window identity 0.636 [measured]<br>so this requirement is met ANCESTRALLY, not by the design. Sheet G is built from substitutions absent in the beloniform OUTGROUPS, and zebrafish is not in that panel, which is why the state had to be read rather than assumed to differ [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue P in place of D at position 109 of exoc2 (ENSORLG00000012658) | the analogue carries P at exoc2 position 109 in 9 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry P109 at exoc2: the locus is not edited, and the design's base residue is D, not P | UNRESOLVED | the design's base carries D at the aligned column (window identity 0.909) [measured]<br>compensation was tested and NOT scored: "unknown" is not scored as a pass. On real omics inputs the classifier returns "unknown" for 24 of 40 rows because our transcriptomic layer rarely has tissue-and-stage expression for a candidate compensator. That abstention is correct behaviour and is never turned into assent. [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue S in place of T at position 138 of ralb (ENSORLG00000001355) | the analogue carries S at ralb position 138 in 9 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry S138 at ralbb: the locus is not edited, and the design's base residue at the homologous site was NOT READ | UNRESOLVED | the design's residue at this site could not be read: LOW CONFIDENCE: window identity 0.455 is below the 0.6 rule. The difference is therefore asserted at GENE level (the design does not edit this locus), not at residue level [inferred-electronic]<br>compensation was tested and NOT scored: "unknown" is not scored as a pass. On real omics inputs the classifier returns "unknown" for 24 of 40 rows because our transcriptomic layer rarely has tissue-and-stage expression for a candidate compensator. That abstention is correct behaviour and is never turned into  | inferred-electronic |
| the analogue carries the Exocoetidae-associated derived residue R in place of K at position 103 of iqgap2 (ENSORLG00000009749) | the analogue carries R at iqgap2 position 103 in 9 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry R103 at iqgap2: the locus is not edited, and the design's base residue is S, not R | UNRESOLVED | the design's base carries S at the aligned column (window identity 0.636) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue M in place of E at position 542 of abce1 (ENSORLG00000002875) | the analogue carries M at abce1 position 542 in 8 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry M542 at abce1: the locus is not edited, and the design's base residue is T, not M | UNRESOLVED | the design's base carries T at the aligned column (window identity 0.727) [measured]<br>compensation was tested and NOT scored: "unknown" is not scored as a pass. On real omics inputs the classifier returns "unknown" for 24 of 40 rows because our transcriptomic layer rarely has tissue-and-stage expression for a candidate compensator. That abstention is correct behaviour and is never turned into assent. [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue R in place of H at position 435 of si:ch211-113g11.6 (ENSXMAG00000013372) | the analogue carries R at si:ch211-113g11.6 position 435 in 8 of 8 Exocoetidae species with data (2 of 2 gliding halfbeaks also ca | the design does not carry R435 at si:ch211-113g11.6: the locus is not edited, and the design's base residue is H, not R | UNRESOLVED | the design's base carries H at the aligned column (window identity 0.727) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue I in place of M at position 645 of arhgef10 (ENSORLG00000017258) | the analogue carries I at arhgef10 position 645 in 7 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry I645 at arhgef10: the locus is not edited, and the design's base residue is L, not I | UNRESOLVED | the design's base carries L at the aligned column (window identity 0.818) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue R in place of K at position 390 of qrsl1 (ENSORLG00000017825) | the analogue carries R at qrsl1 position 390 in 9 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry R390 at qrsl1: the locus is not edited, and the design's base residue is Q, not R | UNRESOLVED | the design's base carries Q at the aligned column (window identity 0.818) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue G in place of E at position 451 of slc9a1b (ENSORLG00000007714) | the analogue carries G at slc9a1b position 451 in 7 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry G451 at slc9a1b: the locus is not edited, and the design's base residue at the homologous site was NOT READ | UNRESOLVED | the design's residue at this site could not be read: LOW CONFIDENCE: window identity 0.455 is below the 0.6 rule. The difference is therefore asserted at GENE level (the design does not edit this locus), not at residue level [inferred-electronic]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search,  | inferred-electronic |
| the analogue carries the Exocoetidae-associated derived residue I in place of V at position 109 of ocstamp (ENSORLG00000015105) | the analogue carries I at ocstamp position 109 in 1 of 1 Exocoetidae species with data (1 of 2 gliding halfbeaks also carry it) | the design does not carry I109 at ocstamp: the locus is not edited, and the design's base residue at the homologous site was NOT READ | UNRESOLVED | the design's residue at this site could not be read: LOW CONFIDENCE: window identity 0.273 is below the 0.6 rule. The difference is therefore asserted at GENE level (the design does not edit this locus), not at residue level [inferred-electronic]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search,  | inferred-electronic |
| the analogue carries the Exocoetidae-associated derived residue T in place of M at position 615 of slc39a6 (ENSORLG00000006625) | the analogue carries T at slc39a6 position 615 in 8 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry T615 at slc39a6: the locus is not edited, and the design's base residue is M, not T | UNRESOLVED | the design's base carries M at the aligned column (window identity 0.818) [measured]<br>compensation was tested and NOT scored: "unknown" is not scored as a pass. On real omics inputs the classifier returns "unknown" for 24 of 40 rows because our transcriptomic layer rarely has tissue-and-stage expression for a candidate compensator. That abstention is correct behaviour and is never turned into assent. [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue C in place of R at position 489 of trpm6 (ENSORLG00000012478) | the analogue carries C at trpm6 position 489 in 8 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry C489 at trpm6: the locus is not edited, and the design's base residue is R, not C | UNRESOLVED | the design's base carries R at the aligned column (window identity 0.727) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue G in place of K at position 726 of pde5a (ENSORLG00000020785) | the analogue carries G at pde5a position 726 in 8 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry G726 at pde5a: the locus is not edited, and the design's base residue is K, not G | UNRESOLVED | the design's base carries K at the aligned column (window identity 1) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue T in place of I at position 236 of chrne (ENSORLG00000008035) | the analogue carries T at chrne position 236 in 8 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry T236 at chrne: the locus is not edited, and the design's base residue at the homologous site was NOT READ | UNRESOLVED | the design's residue at this site could not be read: LOW CONFIDENCE: window identity 0.545 is below the 0.6 rule. The difference is therefore asserted at GENE level (the design does not edit this locus), not at residue level [inferred-electronic]<br>compensation was tested and NOT scored: "unknown" is not scored as a pass. On real omics inputs the classifier returns "unknown" for 24 of 40 rows because our transcriptomic layer rarely has tissue-and-stage expression for a candidate compensator. That abstention is correct behaviour and is never turned into  | inferred-electronic |
| the analogue carries the Exocoetidae-associated derived residue G in place of A at position 384 of coro1a (ENSORLG00000002046) | the analogue carries G at coro1a position 384 in 7 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | none at the residue level: the zebrafish reference already carries G at the homologous site (position 384) | SAME | the design's base protein carries G at the column aligned to coro1a 384, which IS the analogue's derived state. Read by global alignment at 84.62 % identity, local window identity 0.727 [measured]<br>so this requirement is met ANCESTRALLY, not by the design. Sheet G is built from substitutions absent in the beloniform OUTGROUPS, and zebrafish is not in that panel, which is why the state had to be read rather than assumed to differ [curated] | curated |
| the analogue carries the Exocoetidae-associated derived residue I in place of L at position 126 of wasf2 (ENSORLG00000011056) | the analogue carries I at wasf2 position 126 in 9 of 9 Exocoetidae species with data (2 of 2 gliding halfbeaks also carry it) | the design does not carry I126 at wasf2: the locus is not edited, and the design's base residue is L, not I | UNRESOLVED | the design's base carries L at the aligned column (window identity 0.727) [measured]<br>the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution [curated] | curated |

### Reading the ledger

- **The one real overlap is `slc43a2a` / `lat4a`, and it is ALLELIC, not SAME.** The analogue's requirement is
  **F326L**; the design carries **T200K** — the same transporter, a different residue. `T200K` is a real documented
  allele (`lat4a nr21` / ZFIN `slc43a2a dmh26`) with a measured fin phenotype, so the design's *state* exists in a
  real organism. That licenses "this difference is an allele that occurs in nature". It does **not** licence "this
  difference is functionally neutral" or "this supplies what F326L supplies": no experiment in our sources tests
  it, and this project has no model that predicts a phenotype from a residue. The row is `hypothesis: true`.
  `design-validation/REPORT.md` pre-registered the same fact as a result.
- **The 2 SAME rows are not the design's doing.** `coro1a A384G` and `lipca L225M`: the zebrafish reference already
  carries the Exocoetidae-derived residue at the homologous column. The requirement is met **ancestrally**. We only
  know this because the design side was read rather than assumed — sheet G is built from substitutions absent in the
  beloniform *outgroups*, and zebrafish is not in that panel, so "zebrafish must differ" would have been an
  unchecked assumption at every one of the 41 sites.
- **Nothing is resolved by compensation, paralogy or an analogous gene set**, and each refusal is recorded on the
  row (`paralogue_refused`, `analogous_set_refused`, `compensation.refusal`). The refusals are the substance of
  this ledger, so the three that were nearly granted are set out below.
- **19 UNRESOLVED.** Listed gene by gene in `unresolved_genes`: `vit-6`, `dph5`, `ptprt`, `ltn1`, `tmem74b`,
  `exoc2`, `ralbb`, `iqgap2`, `abce1`, `si:ch211-113g11.6`, `arhgef10`, `qrsl1`, `slc9a1b`, `ocstamp`, `slc39a6`,
  `trpm6`, `pde5a`, `chrne`, `wasf2`.

---

## The three near-rescues the ladder refused

These are the rows a looser ledger would have reported as resolved. Each refusal is a rule with a number behind
it, and each rule failed a test once before it was tightened.

**1. "Both proteins are in the membrane" — ANALOGOUS_SET, refused on measured specificity.**
The first working version resolved `ralbb`, `slc39a6` and `chrne` into ANALOGOUS_SET because the design's
`kcnh2a` edit shares GO terms with them: `membrane` (GO:0016020), `plasma membrane` (GO:0005886),
`transmembrane transport` (GO:0055085), `monoatomic ion transport` (GO:0006811). Those terms are carried by 760,
802, and hundreds of the 3,856 annotated genes respectively (`data/term-specificity.json`, built from
`omics/pathway/annotations.jsonl.gz`). So the rule is now **measured, not hand-written**: a shared term licenses
ANALOGOUS_SET only if at most **1 % of the annotated gene universe** carries it, and `go_component` is excluded
outright because co-localisation is not shared function. All three rows fell back to UNRESOLVED. This is Amit's
"entirely different, analogous set of genes" class, and on the headline design it is **empty** — the honest result.

**2. "A paralogue exists" — PARALOGUE, refused.**
`ralbb` has a within-species Ensembl Compara paralogue at **84 % identity**. A rule that accepted a paralogue's
existence rescued that row. The class now requires all three of: a documented paralogue, **expression in a fin
structure** (ZFA, `omics/transcriptomic`), and **domain retention** (a shared InterPro/Pfam term). `ralbb`'s
paralogue carries no gene symbol in our map, so no expression or domain record can be looked up for it at all —
it is a paralogue we cannot follow up, which is reported as exactly that and not as a resolution.
Where the class *does* fire — `slc43a2a` → `slc43a1a` in the unedited-zebrafish control, with pectoral-fin
expression (ZFA:0001161) and a shared MFS transporter superfamily — it is still `hypothesis: true`, with two
caveats printed on the row: no rescue experiment exists in our sources, and `slc43a1a` is the paralogue we could
*follow up*, not the most similar one (two unnamed paralogues sit at 53 % and 78 % identity and could not be
checked).

**3. "It could be compensated" — COMPENSATORY, refused by rule, on the headline design.**
Zebrafish is the organism in which transcriptional adaptation was characterised, so the conditions are published
and are applied as a rule (`compensation.mjs`, six papers fetched through Europe PMC):

| condition | established by |
|---|---|
| the lesion must leave a mutant mRNA that is transcribed and then **degraded**; alleles that fail to transcribe the gene show no adaptation and give *more* severe phenotypes | El-Brolosy et al. 2019, Nature, PMID 30944477, doi 10.1038/s41586-019-1064-z |
| the response needs a **premature termination codon** and depends on the mutant mRNA's sequence being homologous to the compensating gene | Ma et al. 2019, Nature, PMID 30944473, doi 10.1038/s41586-019-1057-y |
| **knockdowns do not induce it** — the mutant/morphant discrepancy is the founding observation | Rossi et al. 2015, Nature, PMID 26168398, doi 10.1038/nature14580; Kok et al. 2015, Dev Cell, PMID 25533206 (≈80 % of morphant phenotypes absent in mutants) |
| sequence similarity suffices at **25 bp / 60 % identity**, in the region between the PTC and the next exon junction | Serobyan et al. 2023, PLoS Genet, PMID 37384903 |
| it is **not universal**: clear NMD with no detectable transcriptional adaptation in wild yeast diploids | Mol Biol Evol 2026, PMID 42626986 |

Applied to the winged zebrafish, the rule **refuses outright**: its two edits are a **missense** (`slc43a2a`
T200K — no PTC, no decay) and a **cis-regulatory inversion** (`kcnh2a` — coding sequence unchanged, transcript not
degraded). And at the 19 unresolved loci there is **no lesion at all**, so there is no mutant mRNA to decay:
transcriptional adaptation answers "what happens when you break gene X", not "what happens when gene X was never
given the analogue's state". That distinction is the single most important refusal in this file.

**The compensation thread's own retrospective validation makes the refusal stricter still**, and we adopt its
scoring rule: a requirement is met by compensation only on `class === 'documented'` **and**
`functional_rescue === true`. `'plausible-by-rule'` is an **unmet** requirement with a review flag — on the 13
retrospective cases independent of the papers the rules came from, the rule was right 4 of 13 and **all nine
errors were false positives** (11 of 12 on cases drawn from its own source papers). `'documented'` alone is not
enough either: vegfaa is a founding example of genetic compensation and still has severe vascular phenotypes, and
titin's paralogue rose 2.55-fold at protein level while the fish were still paralysed by 3 dpf. Compensation at
the transcript level is not rescue of the organism. `'not-expected'` is trusted; `'unknown'` is never a pass.

**The classifier has landed** (`compensation/classify.mjs`) and is wired in. Our lesion kinds are mapped onto its
mRNA-fate vocabulary (`resolve.mjs` `ALLELE_KIND_OF`) rather than handed over raw, and a locus with **no** lesion is
never sent to it at all — there is no allele there to classify. Probed through that adapter it returns:

| gene, lesion | verdict | rule | scored? |
|---|---|---|---|
| `slc43a2a`, missense (the design's actual edit) | **not-expected** | R03-MISSENSE-NOT-EXPECTED | no — and this refusal is the reliable direction of the rule, so it is trusted |
| `slc43a2a`, nonsense (hypothetical) | **unknown** | R10-MISSING-INPUTS-ARE-UNKNOWN | no |
| `hhip`, nonsense (the TFF's actual edit) | **unknown** | R10-MISSING-INPUTS-ARE-UNKNOWN | no |

The two `unknown` verdicts are **correct behaviour, not a shortfall**: our transcriptomic layer rarely has
tissue-and-stage expression for a candidate compensator, and on real omics inputs the classifier abstains on 24 of
40 rows for exactly that reason. Relaxing it to buy coverage would turn abstention into assent, and a high resolved
fraction bought that way is precisely the number that would make this ledger worthless. So **no row in any case is
scored COMPENSATORY**, and every row records both the classifier's verdict and our own rule table's refusal.

---

## All six cases, including the controls Amit specified

| case | direction detected | analogue | assessable | SAME | ALLELIC | PARA | ANALOG | COMP | UNRESOLVED | gate |
|---|---|---|---|---|---|---|---|---|---|---|
| **winged zebrafish** (headline) | ADDITION | Exocoetidae | 22/73 | 2 | 1 | 0 | 0 | 0 | **19** | FAIL |
| **unedited zebrafish** (negative control) | ADDITION | Exocoetidae | 22/73 | 2 | 0 | 1 | 0 | 0 | **19** | FAIL |
| **real flying fish vs itself** (positive control) | ADDITION | Exocoetidae | 22/73 | **22** | 0 | 0 | 0 | 0 | **0** | every difference has a demonstrated resolution |
| **TFF** (truly flying fish) | **NO_ANALOGUE** | *none* | 0/0 | 0 | 0 | 0 | 0 | 0 | 0 | empty ledger — which is not evidence that there are no differences |
| **50:50 chimera** | ADDITION | Exocoetidae | **0/73** | 0 | 0 | 0 | 0 | 0 | 0 | empty ledger — unassessable on the design side |
| **wingless flying fish** | **SUBTRACTION** | Exocoetidae (base) | **0/41** | 0 | 0 | 0 | 0 | 0 | 0 | empty ledger — unassessable by construction |

### The negative control behaves as it must — and that is the ledger's sharpest result

An **unedited zebrafish** scored against the flying fish gives **19 UNRESOLVED**, the same count as the winged
zebrafish. The design's two edits move exactly **one** row: `slc43a2a` goes from a PARALOGUE hypothesis (the
unedited gene, with `slc43a1a` as a fin-expressed paralogue candidate) to an ALLELIC hypothesis (the edited gene,
at a different residue). **Neither is a demonstrated resolution, and the unresolved count does not move at all.**
On this ledger, the winged zebrafish is as far from the flying fish's known requirement set as an unedited
zebrafish is — which is the quantitative form of `design-validation`'s pre-registered finding that the design
reproduces 1.4 % of the loci known to differ.

### The positive control passes, by identity rather than by luck

The real flying fish against itself gives **22 SAME, 0 UNRESOLVED**. That is not an alignment result: the design's
base genome *is* the analogue's, so at every unedited locus its state is the analogue's own measured state. The
row says `IDENTITY` in its method and the evidence says so too, because a control that passed for a reason we
could not name would be worthless.

### The TFF: no analogue exists, and this is the loudest case

The desired phenotype — "sustained powered flight under its own power, not just a glide" — has **no analogue we may
read**:

- **Birds are refused.** Class Aves is this project's frozen holdout. Birds are the obvious analogue, so the
  honest statement is that the best analogue is unavailable to us *by design*, not that the next one down is good.
  Nothing is substituted for it.
- **Pterosaurs are extinct**: no DNA, so no sequence-level requirement set can ever be derived from them.
- The nearest **partial** analogues are listed with what each does and does **not** supply:
  - **bats (Chiroptera)** supply powered flapping flight with an aerobic power supply, in animals whose sequences
    we may read. They supply **nothing transferable to a fin**: no pectoral fin, no lepidotrichium, no fin fold —
    and our own convergence analysis finds **0 of 532 interface positions shared across gliding taxa**, with the
    `lat4a` 326 state being `F` in all three bats, in mouse and in human, the same as in zebrafish and medaka.
  - **flying fishes** supply the airborne half and a sequenced genome. They do not supply **power**: a flying fish
    glides, it does not flap.
- The closest *relative* is never offered in an analogue's place. That is the premise of the whole module.

So the requirement set is **empty**, the ledger has **no rows**, and the gate says an empty ledger is not evidence
that there are no differences. `genotype/flier-genome.json` reaches the same verdict independently: "No requirement
has a route that reaches it."

### The 50:50 chimera has no genome, so the design side is unreadable

The chimera is a weighted average of two parents' **shape parameters**. There is no such thing as a 50:50 blended
genome, the document does not say which allele it carries at any locus, and nothing is averaged into one. All 73
requirements are therefore unassessable **on the design side**, with that reason printed on every row. This is a
property of the design, not a gap in the data — and it is reported as 0 assessable rather than as 0 unresolved.

### The subtraction is unassessable BY CONSTRUCTION, and is not scored as a pile of gaps

The wingless flying fish *loses* a function its base has. The right analogue is an organism that already lacks
gliding — a non-gliding halfbeak — and the question flips from "is the requirement supplied?" to "what did removing
it cost, and is the loss consistent with organisms that live without it?"

Our answer is that **this locus set cannot answer that question**. Daane sheet G lists only substitutions shared by
gliders and **absent from the outgroups**, so every non-gliding species carries the ancestral residue at these
sites *by definition*; `sequences/progression.json` says it outright: "THE NON-GLIDERS SCORE ZERO BY CONSTRUCTION
... the zero is circular and is not a finding". A set built that way carries no information about whether a glider
genotype is compatible with a non-gliding body. Our own data says more: the **gliding halfbeaks carry about as many
derived states as the flying fishes at a fin ratio 2.5× smaller**, so derived-state count does not track the
function even among gliders.

So all 41 subtraction requirements come back unassessable, each carrying `what_would_make_it_assessable`: a
measured, **secondarily non-gliding exocoetid** — a species descended from gliders that lost the habit — whose
state at these sites could be read. No such species is in the Daane panel or in any source we fetched. A design
that loses gliding is a different animal, not a defective one, and this ledger does not score it as one.

---

## How the design side is read, and the guard on it

At an unedited locus the design's state is its **base genome's** state, so which genome that is decides what can
be read (`designs.mjs` `BASE_GENOME`): the zebrafish reference (GRCz11) for the winged zebrafish and the zebrafish
controls, the analogue's own genome for the flying-fish-based designs, and **undefined** for the chimera and for
specimen records.

For a zebrafish-based design the residue is read by pairwise global alignment (Needleman–Wunsch, BLOSUM62, affine
gaps 11/1) of the Daane source protein against the Ensembl Compara *Danio* orthologue protein
(`scripts/read-design-residues.mjs`, cached in `C:/Temp/functional-cache/protein/`). **38 of 41 sheet-G sites were
read; only 24 passed the confidence guard.**

The guard exists because the check failed once without it. A whole-protein identity of 77 % says nothing about
whether *one* column is trustworthy: medaka `ralb` against *Danio* `ralbb` is 76.8 % identical overall and maps
site **138 onto position 33** across an indel — and that bad mapping reported the derived state as PRESENT, a false
SAME. The rule is now: no gap at the site, and **at least 60 % identity in a ±5-residue window** around it.
`ralbb`'s read is rejected by that rule (window identity 0.455) and the row falls to UNRESOLVED with
`LOW CONFIDENCE` printed as its evidence. 14 of the 38 reads are rejected the same way, and every rejection is
reported rather than used.

---

## The six-rung ladder, and what each rung is allowed to claim

| class | what it asserts | evidence it must carry | demonstrated or hypothesis |
|---|---|---|---|
| **SAME** | same gene, same functional state | the design's state read, and identical to the analogue's | demonstrated (a state, not a function) |
| **ALLELIC** | same gene, different allele — and that state exists in a real organism | the design's edit with its allele and source; the analogue's state; the fact that they differ | **hypothesis**, always, unless a functional assay or rescue of that state is cited |
| **PARALOGUE** | the required gene is unedited, but a paralogue could carry the function | a documented paralogue **and** expression in the right structure **and** domain retention | **hypothesis** (no rescue experiment exists in our sources) |
| **ANALOGOUS_SET** | a different gene set plausibly delivers the function | a shared pathway/GO/domain term carried by ≤ 1 % of the annotated gene universe | **hypothesis** |
| **COMPENSATORY** | a documented compensation mechanism applies | the published rule satisfied **and** a classifier verdict of `documented` with `functional_rescue === true` | **hypothesis by definition** |
| **UNRESOLVED** | nothing accounts for it | the refusals, one per rung attempted | — |

**ALLELIC is always a hypothesis here, and the reason is worth stating twice.** The scorer's
`genotype_similarity` fields are sequence-level **states**. `edited_state_exists_in_real_organism: true` means a
real organism carries that residue; it does *not* mean function is preserved, and a high percent identity is not
evidence of preserved function either. This project has no model predicting phenotype from a residue, and its own
pre-registered design validation **failed** — the winged-zebrafish design matched the real mutant at 1 of 74 loci,
at a different residue. A ladder built on this data has to treat "same gene, different residue" as an open
question, and it does.

`demonstrated` and `hypothesised` are reported as two numbers and are **never summed**: a merged total would let a
hypothesis pay for a gap, which is the exact failure the ladder exists to prevent.

---

## Wiring

`sim-engine/validate/functional/index.mjs` exports `functionalResolution(design, opts)`, the slot
`sim-engine/validate/functional-interface.mjs` calls with the same `design` and `opts` the scorer received. The
interface recomputes every count from our rows, refuses any class outside the six rungs, and reports a mismatch
with our own summary rather than trusting it; `results.json` records, per case, the ledger **as the scorer sees
it** so that any disagreement is visible. We never edited `score.mjs`, `score-v1*.mjs`, `benchmark/`, `evaluation/`
or the edit-plan agent's files.

The desired phenotype is looked for in `opts.spec` (the pipeline agent's `DesignSpec`) and in several other places
a caller might put it. When none arrives, the function is inferred from the design's identity and the ledger says
`INFERRED, not specified` in `function_signal` — because a different desired phenotype would change the requirement
set and therefore the whole ledger.

`functional_resolution` is a **gate beside** the composite score, never a term inside it: a sparse term would let a
hypothesis pay for a gap and would make designs with and without a ledger incomparable. The frozen scorer versions
and their published numbers are untouched.

---

## What we could not assess, in one place

1. **The analogue's function, at every locus.** No flying-fish transcriptome, proteome, mutant or assay exists. 0
   of 73 loci have expression or functional data. Every requirement is a sequence state.
2. **32 of 73 requirements have no state at all** — sheet I is a per-gene evolutionary *rate*, and nothing a design
   does can match a rate.
3. **17 of 73 sheet-G requirements are unconfirmed in the analogue by our own re-read** (9 with the derived residue
   in 0 species with data, 8 with no residue at the site). We report the publisher's tick and our failure to
   reproduce it, side by side, rather than choosing one.
4. **Every regulatory requirement.** Sheets K and M give GO terms with no gene column, so the layer where most
   between-species difference lives cannot be enumerated at all.
5. **The resolution search at 15 of the 22 assessable loci** (14 of them UNRESOLVED rows), whose orthologue lies outside the 3,860-gene
   annotated universe. Those UNRESOLVED verdicts are the absence of a search, and say so.
6. **14 of 38 design-side residue reads**, rejected by the alignment-confidence window rule.
7. **Whether any ALLELIC, PARALOGUE or ANALOGOUS_SET row actually preserves the function.** No rescue or
   functional-equivalence experiment for any of these gene pairs exists in our sources. Every such row is
   `hypothesis: true`, and the two totals are never added.
8. **Any requirement set for powered flight or for high-altitude oxygen handling.** The analogues are refused
   (Aves) or extinct (pterosaurs); `genotype/flier-genome.json` independently reports no genetic route at all for
   the oxygen requirement.

## Scope

A functional-analogue ledger for ONE function, built from the loci one paper reports as known to differ in the
analogue. Not a validity claim, and not a phenotype prediction: every state here is a sequence state. No Aves data
anywhere (frozen holdout). No credentials; every endpoint used is public and unauthenticated (Ensembl REST,
Europe PMC), rate-limited, and cached under `C:/Temp/functional-cache/`.
