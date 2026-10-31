# Can the 4,571-gene map be turned into a whole-organism simulation?

**0 of 18,733.**

That is the measurement. A minimal dynamical model of the 4,571 genes in
`genotype/map.vetted.json` needs 18,733 numbers — four per gene (absolute abundance, protein
half-life, mRNA half-life, transcription rate) plus one strength for each of the 449 gene-gene edges
that have any direct experimental support in zebrafish. We hold none of them.

Relax the definition as far as honesty allows — accept a PaxDb ppm value, a share of total protein
mass in a whole organism or a dissected organ, in place of a count per cell in a named cell type at
a named stage — and the number becomes **2,972 of 18,733, or 15.9%**, and every one of those 2,972
is that same relaxed substitute. Nothing in items (b), (c), (d), (e), (g) or the edge strengths
changes, because for those the count is zero under any definition.

For contrast, in the same gene set: **3,857 of 4,571 genes (84.4%) carry a functional annotation.**

That is the whole finding. Functional annotation is nearly complete and parameterisation is empty,
because they are not the same quantity. A GO, Reactome or KEGG entry says *this gene is involved in
this process*. A simulation needs *this many molecules, decaying this fast, binding this tightly*.
The first does not constrain the second.

Date: 2026-10-31. Every one of the 151 logged requests behind these numbers is in `calls.json`
with its URL, UTC time, HTTP status, byte count and SHA-256, plus 10 earlier endpoint-discovery
requests recorded there too (161 in all). Nothing is cited from memory.
Proxy species throughout: zebrafish (*Danio rerio*); no flying-fish molecular data exists.
No bird data was fetched or used — Aves is this project's frozen holdout.

![Coverage per parameter type](coverage.svg)

## The worked example: one species says it in one sentence

Xu et al. 2021, *Draft Genome of the Mirrorwing Flyingfish (Hirundichthys speculiger)*, Front Genet
(doi [10.3389/fgene.2021.695700](https://doi.org/10.3389/fgene.2021.695700), PMC8294118) — the only
flying-fish genome paper, and so the one paper that is actually about our organism.

Read from the fetched full-text XML and both supplementary archives:

- **23,611** protein-coding genes predicted.
- **23,492 (99.5%)** functionally annotated: 20,692 KEGG hits, 21,453 SwissProt, 23,477 TrEMBL,
  21,888 InterPro. Verbatim: *"We predicted 23,611 protein-coding genes in the mirrorwing flyingfish
  genome… Moreover, 99.50% of these genes could be functionally annotated by at least one of the four
  popular databases, with 20,692 KEGG hits, 21,453 SwissProt hits, 23,477 TrEMBL hits, and 21,888
  Interpro hits."*
- **0 of the 8 parameters.** Twenty-five search terms counted one by one across the full text (all
  sections present, Materials and Methods through References) and across `Data_Sheet_2.docx`, which
  holds the 14 supplementary tables. Every count is zero, in both: RNA-seq, transcriptome,
  expression level, TPM, FPKM,
  RPKM, half-life, turnover, degradation rate, decay rate, dissociation constant, binding affinity,
  kcat, Michaelis, diffusion, Hill coefficient, cooperativity, regulatory network, ChIP-seq,
  molecules per cell, copies per cell, absolute quantification, promoter strength, transcription
  rate. Gene prediction was homology plus *ab initio* (Augustus); the word *transcriptome* does not
  appear, and *expression* appears twice, both times about other people's work. Supplementary Data
  Sheet 1 is twelve TIFF figures.

And the definition caveat matters: "functionally annotated" here means **at least one hit in at least
one of four databases**, and TrEMBL alone supplies 23,477 of the 23,492. A TrEMBL hit is a
sequence-similarity match to an unreviewed entry. This is annotation in its weakest sense, and it
still reaches 99.5%.

A genome with essentially complete functional annotation and, in the paper that reports it, not one
simulation parameter. That is the gap, in one species, in one sentence.

## Item by item, with the query

Genes: **4,571** (`genotype/map.vetted.json`), of which 4,566 are ZFIN-keyed zebrafish and 5 are
Ensembl-keyed medaka, which no queried database covers for any of these parameters. Before any
query could run, the identifiers had to be bridged: **3,922** have a UniProt accession, **4,014** an
Ensembl gene, **3,949** a STRING protein, **3,804** a human ortholog (ZFIN downloads, 2026-10-31).
A gene with no UniProt accession cannot be looked up in SABIO-RK or BRENDA at all.

| | needs | genes with it | source queried |
|---|---|---|---|
| **(a)** | absolute abundance, molecules per cell or calibrated concentration, in a defined cell type and stage | **0** (2,972 with a ppm substitute) | PaxDb v6.1, Expression Atlas, PRIDE |
| **(b)** | protein half-life or degradation rate | **0** | BioNumbers census, PaxDb |
| **(c)** | mRNA half-life | **0** | BioNumbers census |
| **(d)** | transcription rate or promoter strength | **0** | BioNumbers census |
| **(e)** | Kd, or Km and kcat if an enzyme | **0** | SABIO-RK, BRENDA |
| **(f)** | diffusion coefficient, if secreted | **4 molecules** | the project's own fetched morphogen file |
| **(g)** | Hill coefficient or cooperativity | **0** | SABIO-RK parameter types, BioNumbers census |
| **(h)** | signed, directed, experimentally supported edges with strengths | **5 edges, 0 strengths** | STRING v12, IntAct, CollecTRI, SIGNOR |

### (a) Absolute expression — 0 strict, 2,972 relaxed

- **PaxDb v6.1**, `pax-db.org/downloads/latest/datasets/7955/`: **35 zebrafish datasets**. Five were
  pulled (whole organism integrated, embryo integrated, two Kelkar embryo stages, a juvenile
  proteome) and cover **2,972 of our genes** between them. The unit is **ppm** — a share of total
  protein mass in the sample. Converting ppm to molecules per cell needs a total protein copy number
  per zebrafish cell, which no fetched source gives. Every dataset is a whole organism or a dissected
  organ; none is a cell type, and staging goes no finer than embryo / juvenile / adult.
- **Expression Atlas**, `ebi.ac.uk/gxa/json/experiments`: 4,562 experiments in all, **25 zebrafish**
  (1 baseline, 24 differential). All in TPM or FPKM, which the checklist excludes by name.
- **PRIDE**, `ws/archive/v3/search/projects?keyword=Danio rerio`: 100 projects returned (the v3 API
  gives no total), 28 of which mention absolute, turnover, SILAC, TMT or iBAQ quantification. PRIDE
  holds spectra, not a per-gene concentration table. A second query, `zebrafish absolute
  quantification`, returned an empty list.
- **Our own map** already holds 349,658 "expressed in" links. They are presence calls. No quantity.

### (b), (c), (d), (g) Half-lives, transcription rates, cooperativity — 0, four times over

**BioNumbers holds 19 zebrafish entries. That is the whole of it.** The term-plus-organism search was
first used and then discarded: a control (`trm=egg+diameter&org=Danio+rerio` against the same term
with `org=Escherichia+coli`) returned the **identical organism mix**, so the `org=` parameter is
ignored and any count from it would be meaningless. Instead every page of the free-text searches
`zebrafish` and `Danio rerio` was followed to the end (`&pi=1..4` each), 75 distinct rows, and the
organism column read directly. The 19 zebrafish entries are:

embryo length at 72 hpf, egg diameter, mass, genome size (twice, from two sources), GC content,
length of a centimorgan, energy density, median cell-cycle length at midblastula, number of cell
divisions before MBT, cells in the coelomic cavity, neurons in the larval brain, optic-tectum layer
thickness, three cell-migration speeds, a cortical friction coefficient of stable-bleb cells, a
summary of cell types labelled by one plasmid, and one **half-time of myosin II redistribution to the
cell cortex (~20 s)** — a relocalisation time, not a degradation half-life.

Not one is a per-gene rate constant. No mRNA half-life, no protein half-life, no transcription rate,
no promoter strength, no Hill coefficient, no morphogen diffusion coefficient.

The measurements do exist in the literature — Europe PMC returns 2,228 papers for zebrafish protein
turnover, 820 for mRNA stability, 507 for Hill coefficients, 451 for transcription rates. Those are
**paper counts, not parameter counts**, recorded here only to show that the numbers are locked in
figures and prose rather than in a table a simulation could read. Turning them into one would be a
curation project of exactly the kind the M. genitalium model was.

### (e) Binding and enzyme kinetics — 0

- **SABIO-RK** (whose documented REST path `/sabioRestWebServices/…` now 404s; the working API is
  `/api/sabio/*`, found by reading the site's own JS bundle). The whole database: **77,042
  kinetic-law entries** over **7,130 distinct UniProt accessions** (7,131 index rows) and 1,335 organisms, with 39 parameter
  types. *Danio rerio* holds **48 entries** across **5 UniProt accessions** — adh8a, adh8b, grk1a,
  grk7a, ido1 — and **not one of those five genes is in our map**. Scale, non-avian: 1,014 human
  accessions, 474 *E. coli*.
- **BRENDA**. Its only open programmatic endpoint is the DSMZ QLever SPARQL prototype
  (`sparql.dsmz.de/api/brenda`, 10,987,199 triples). A full census of its classes and predicates
  shows enzymes, reactions, inhibitors, activators, cofactors, tissues and references — and **no
  kinetic value at all**: there is no Km, kcat, Ki or Kd class or predicate in the graph. Bulk
  kinetic data is behind a licence form. The BRENDA website search for `Danio rerio` returned
  *"Sorry, no results could be found for your query!"*.

The gap is coverage, not schema: SABIO-RK's 39 parameter types include Kd, Km, kcat, half-life and
Hill coefficient. The fields exist. Zebrafish is not in them.

### (f) Diffusion — 4 molecules, all from the wrong stage

The project's own fetched file `sim-engine/params/zebrafish-morphogens.json` holds 9 parameters for
6 molecules: diffusion coefficients for **Fgf8a, Lefty2, Squint and Cyclops**, plus an Fgf8 residence
time and a gradient length. Two values were read in a primary source; six are quoted second-hand; one
— Shh in the pectoral fin bud, which is what the first validation target actually needs — is an
explicit placeholder with no value. The file itself flags the problem: every measured coefficient
comes from the **gastrula**, because that is where FCS and FRAP on morphogens have been done, and
carrying it to a 72 hpf fin bud is an assumption, not a measurement.

This is the one item where something real exists. It is 4 molecules, not 4,571 genes.

### (h) The regulatory network — 449 pairs of 10,444,735, and no strengths

Among 4,571 genes there are 10,444,735 unordered pairs.

- **449 (0.0043%)** have any direct experimental support in a fetched source: the union of STRING
  v12's `experiments` channel for zebrafish, with transferred evidence excluded, and the 80 IntAct
  curated pairs between two of our genes. These edges are **undirected and unsigned**, and carry a
  confidence score, not a strength.
- The scarcity is not an artefact of our gene set. Across the **whole zebrafish proteome**, STRING
  v12 holds only **3,873** edges with direct experimental evidence, touching **612 proteins**, against
  **4,070,667** whose experimental evidence is transferred from another species. The zebrafish
  interactome is overwhelmingly inferred.
- IntAct: the free-text query `7955` returned 5,741 records (the Lucene fields `taxidA:` and
  `species:` return 0, so the records were pulled and filtered on `taxIdA`/`taxIdB` directly); 718
  are zebrafish-on-zebrafish, giving 447 distinct molecule pairs and **80** between two of our genes.
- **Signed, directed, experimentally supported gene-gene edges: 5** — the kcnh2a / lat4a /
  kcnk5b / calcineurin epistasis and pathway-order statements in `genotype/causal-chains.json`
  `cross_gene`, each with a verbatim quote from a fetched paper. **Edges with a measured strength: 0.**
- **No zebrafish-specific signed regulatory edge set was found.** SIGNOR's host did not resolve from
  this network, which is recorded as unreachable rather than as empty. OmniPath — which serves
  CollecTRI and DoRothEA — serves taxa **9606, 10090, 10116 only** and refuses 7955 outright
  (*"Unknown values for argument `organisms`: `7955`"*).
- The only genome-scale option is therefore **orthology transfer, and it must be labelled as such**:
  CollecTRI's 64,516 human signed TF-target edges (53,025 activating, 6,715 inhibiting, 4,776
  carrying both signs) map onto **17,804** zebrafish pairs within our gene set through ZFIN
  orthology, most of it protein BLAST. That is a hypothesis list, not zebrafish data, and zebrafish
  gene duplication means one human edge can land on several zebrafish pairs.

## What we do hold, sized fairly

These are good numbers. They are simply not a per-gene dynamical parameter set.

| | what | size |
|---|---|---|
| `genotype/interventions.json` | genetic and pharmacological interventions on fin and body morphology | 92 interventions on 35 genes, from 56 publications; **12 usable as calibrated knobs** (a magnitude *and* the stage it was measured at); 23 with a numeric effect size; 73 with a stage; 19 morphology parameters covered, 37 with no sourced route |
| `sim-engine/params/zebrafish-morphogens.json` | morphogen transport | 9 parameters, 6 molecules; 2 measured, 6 second-hand, 1 placeholder |
| `physiology/` | circulation, gills, counter-current exchange, heart, haemoglobin, muscle | 25 fetched sources across 6 modules |
| `development/` | staging, growth, allometry | 22 sources, including the ZFIN stage ontology and Daane 2021's 109 measured specimens |
| `genotype/causal-chains.json` | gene-to-phenotype chains, graded per link | 42 genes with a chain, 29 whose weakest link is necessity or better, 122 publications |
| `genotype/interactions.json` | tissue-to-tissue and cell-to-cell arrows | 30 interactions, 12 of them graded mechanism |
| `genotype/pathways.slim.json` | functional annotation | 3,857 of 4,571 genes; GO:BP 3,761, KEGG 1,982, Reactome 1,654 (every zebrafish Reactome row inferred by orthology) |

## So what is simulatable today, and at what coarseness

**Simulatable now:**

1. **One morphogen gradient as reaction-diffusion over a continuum** — not over genes. The 4 fetched
   diffusion coefficients, the Fgf8 residence time and the reported gradient length support this, in
   arbitrary concentration units, in one tissue, with gastrula parameters carried to whatever stage is
   being modelled. The file flags that carry as an assumption and so must any result.
2. **A 2- to 4-node qualitative or Boolean model of the fin-size switch.** The 5 signed directed edges
   and the 12 calibrated interventions give signs, orderings and a few magnitudes with stages.
   Outcomes come out as larger / smaller / unchanged, not as micrometres per hour.
3. **A whole-animal growth and allometry trajectory.** `development/` and `physiology/` support this
   today, with no genes in the loop: the genotype enters only through the 12 calibrated knobs on 19
   morphology parameters.
4. **A small curated network over a handful of cell states.** The 42 causal chains, the 30 tissue and
   cell interactions and the 449 experimentally supported edges give a candidate topology with signs
   where known. Every rate constant in it would be a free parameter, fitted or assumed. Such a model
   is a hypothesis generator, not a predictor.

**Not simulatable, and not close:**

- A zygote-to-adult simulation in which the 4,571 genes are dynamical variables.
- Anything whose output depends on **absolute concentrations**: not one gene has one, and ppm cannot
  be converted without a per-cell total protein count that no fetched source gives.
- Anything whose output depends on **timescales**: no gene has an mRNA or protein half-life, and no
  gene has a transcription rate. Every timescale would be invented.
- A **genome-scale regulatory network**. 0.0043% of gene pairs have direct experimental support, none
  of it signed, directed and quantified. The only genome-scale option is orthology transfer.
- Anything at all **in a flying fish**. See the worked example.

**What would change the answer:** a staged zebrafish absolute-proteomics dataset in copies per cell;
a genome-wide zebrafish mRNA stability dataset published as a per-gene table; a zebrafish TF-target
resource with signs, so the network stops being orthology transfer. None of the three exists in the
sources queried here.

## Calibration: the closest precedent

Karr et al. 2012, *A whole-cell computational model predicts phenotype from genotype*, Cell 150(2)
(doi [10.1016/j.cell.2012.05.044](https://doi.org/10.1016/j.cell.2012.05.044), PMID 22817898,
PMC3413483). Read from the NCBI PMC efetch XML — Europe PMC's `fullTextXML` returned 500 for this
PMCID.

- **525 genes.** *"Mycoplasma genitalium, a human urogenital parasite whose genome contains 525
  genes"*.
- **28 sub-models.** *"We divided M. genitalium into the 28 functional processes illustrated in Figure
  1, and modeled each process independently on a 1 s time scale using different mathematics and
  different experimental data."*
- **Over 900 publications, more than 1,900 measured parameters.** *"Our model is based on a synthesis
  of over 900 publications and includes more than 1,900 experimentally observed parameters."* And:
  *"The whole-cell model was based on a detailed reconstruction of M. genitalium developed from over
  900 primary sources, reviews, books, and databases."*
- **It is a single cell.** The model covers the life cycle of one bacterium. No anatomy, no tissues,
  no development, no body plan.

That is **3.6 parameters and 1.7 publications per gene**. At the same density, 4,571 genes would need
about **16,500 parameters** from about **7,800 publications** — strikingly close to the 18,733 of the
minimal count above, which is some evidence that the "4 per gene plus one per edge" convention is in
the right range rather than a strawman. A zygote-to-adult model would need *more* per gene than a
bacterium, not fewer: cell states, positions, divisions and movements that a single cell does not
have. For comparison, the whole project has so far read 122 publications for the causal chains, 56 for
the interventions, 31 for the tissue interactions and 25 for the physiology.

The precedent does not say the task is impossible. It says the unit of work is a parameter read out
of a paper, and that **functional annotation was that project's starting point, not a substitute for
it**: the paper's claim that the model "accounts for all annotated gene functions" was earned by
curating 900 sources *on top of* the annotation.

## Honest limits of this measurement

- **It measures databases, not the literature.** Items (b), (c) and (d) almost certainly exist for
  some zebrafish genes inside individual papers. The claim here is that no queried database serves
  them per gene, which is what a simulation would need.
- **SIGNOR was unreachable, not empty.** Its host did not resolve from this network. If SIGNOR holds
  zebrafish edges, item (h) is undercounted — though SIGNOR is human-centric, so the likely effect is
  small.
- **PaxDb was sampled, not exhausted.** Five of 35 zebrafish datasets were pulled. Taking all 35
  would raise the 2,972 somewhat. It would not change the unit, which is still ppm.
- **BRENDA's licensed bulk data was not obtained.** Its open SPARQL endpoint carries no kinetic
  values. Licensed BRENDA could hold zebrafish Km or kcat values that SABIO-RK does not; its website
  search for *Danio rerio* found nothing, which is weak evidence against.
- **The 4-per-gene convention is a choice.** It is stated, not derived, and the ratio is reported
  against it. Alternative denominators are in `readiness.json` under `ratio`: a 7-per-gene extended
  variant (4 of 32,446), and the pairwise framing (449 of 10,444,735).
- **None of this is flying-fish data**, and the one flying-fish genome paper carries no parameters.
  Every number above is zebrafish, a proxy.

## Files

| file | what |
|---|---|
| `readiness.json` | per-item counts, the exact query for each, sources, the ratio, the worked example, the precedent |
| `calls.json` | all 161 outbound requests (151 logged by `fetch.py`, 10 earlier endpoint probes): URL, UTC time, status, bytes, SHA-256, and why |
| `fetch.py` | the fetcher, one function per source; generic User-Agent, no email, no API key, no personal identifier in any request |
| `analyse.py` | offline; reads the fetched bodies and this repo, writes `readiness.json` |
| `fig_coverage.py`, `coverage.svg` | the figure |

Raw response bodies are in `C:/Temp/simready/raw` and are deliberately not committed: D: has under
3 GB free, and the STRING zebrafish network alone is 131 MB. Reproduce with
`python simulation-readiness/fetch.py`, then `analyse.py`, then `fig_coverage.py`.
