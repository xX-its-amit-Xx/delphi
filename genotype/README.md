# Genotype thread: genotype-to-phenotype links for the flying-fish blueprint, at every layer

Amit's #53 deliverable ("genotype-phenotype links for the demo taxa"). Owner: the genotype thread (session
`scienceclaw-68`), taking over from a background agent whose notes are in `HANDOVER.md`.

**The constraint, stated on every number, corrected 2026-10-31.** An annotated draft genome of a flying fish
**exists**: Xu et al. 2021 (Front Genet 12:695700, doi 10.3389/fgene.2021.695700) assembled the mirrorwing
flyingfish *Hirundichthys speculiger* at 1.04 Gb and predicted **23,611 protein-coding genes, 23,492 of them
(99.5%) with at least one database hit**, and that assembly is the one catalogued as GCA_018398805.1. So the
gap is **not missing genes**. What is missing is phenotype and expression: that paper reports no RNA-seq and
no transcriptome at all, no mutant, no kinetics and no regulatory network, and ZFIN-style expression and
mutant-phenotype records exist only for zebrafish and, through Bgee, medaka. Every gene link here is therefore
a **proxy**-species record, zebrafish (*Danio rerio*) or medaka (*Oryzias latipes*, same order Beloniformes),
and it is a proxy for that reason rather than because flying-fish genes are unknown. None of these links is a
flying-fish measurement. Two caveats travel with the genome: "functionally annotated" there means one
sequence-similarity or domain hit, with TrEMBL alone supplying 23,477 of them and TrEMBL being automatic and
unreviewed; and *H. speculiger* is not one of the species in the fin measurements this thread uses, so mixing
them is cross-species within Exocoetidae and must be labelled. The full record, verified against the paper's
own text, is the `flying_fish_genome` block of `map.vetted.json`.

**Wording:** a flying fish's "wing" is an enlarged pectoral fin. Say "fin enlargement for gliding", never
"fin-to-wing transition".

## Files

| file | what it is |
|---|---|
| `fetch.py` | every network call of the first build; writes `cache/calls.json` (full URL, time, status, bytes, SHA-256, refusals included) and small results into `cache/` |
| `fetch_extra.py` | the Genotype session's extra calls (ZFIN condition and consequence files, NCBI Gene for the lat4a question); appends to `cache/calls.json` |
| `build.py` | offline; builds `map.json`, `map.vetted.json` and `expression_index.json.gz` from the raw files in `C:/Temp/genotype/raw` (about 140 MB; D: is full). About 6 minutes |
| `map.json` | the full map, 44 MB, **never committed** (too big; archive to OneDrive) |
| `map.vetted.json` | the slim, vetted map that the 3D blueprint (`/blueprint3d/`) and the sub-dashboard read. Same top-level keys and per-layer shape as `map.json`; evidence trimmed, "expressed in" links capped per node, derived links dropped (their per-node counts stay). Top-level `"vetted": true` |
| `expression_index.json.gz` | every direct "expressed in" link not stored in full in the maps |
| `SOURCES.md` | generated call log |
| `nanopubs/build-nanopubs.mjs` | writes the unsigned draft records to `nanopubs/unsigned/*.trig` (`--check` runs `np check`) |
| `HANDOVER.md` | the background agent's handover, with the problems it flagged |

Reproduce: `python -I genotype/fetch.py`, `python -I genotype/fetch_extra.py`, `python -I genotype/build.py`,
then `node dashboard/public/t/genotype/build.mjs` and `node genotype/nanopubs/build-nanopubs.mjs --check`.

## What the map is

For each node of the flying-fish blueprint (`organism-design/examples/a-flying-fish.json`: 1 body, 13 organ
systems, 67 organs, 198 tissues, 257 cell types; every node an Uberon or Cell Ontology term) the map lists the
proxy-fish genes linked to it, typed as exactly one of:

- **expressed in**: the gene's RNA or protein was detected there (ZFIN wild-type expression; Bgee present
  calls that include data observed in that very structure, Bgee's own propagation excluded). Detection, not
  causation. Most links are this kind.
- **required for**: a single-gene zebrafish (homozygous allele or knockdown, no construct) has an abnormal
  phenotype there under ZFIN standard conditions. Every such link carries `loss_of_function_evidence`
  (knockdown; truncating allele, established; recessive allele with missense or unrecorded consequence,
  presumed). At the organ-system and body layers, GO IMP/IGI process annotations stand in and are labelled
  the weakest kind.
- **sufficient for**: a verified gain-of-function allele changes the structure (kcnk5b enlarges fins). Never
  "makes" it.

Rules (the eight nuances of the brief; all applied, see `map.json` `propagation_rules`, `crosswalk`, `vetting`):
layer and evidence kind on every link; upward propagation only, marked derived, derived "required for" an
inference, never downward or sideways; ZFIN stage spans in the link key (embryo, larva, juvenile, adult never
merge; Bgee links carry no stage); paralogs kept apart with flying-fish correspondence marked as an
assumption; anatomy mapped only through ontology cross-references (Uberon hasDbXref ZFA via Ubergraph, ZFA
xref CL), never by name, unmapped counted; gene breadth recorded; a node with no record is unstudied, not
gene-free; fin size handled separately (`fin_size`).

## Headline numbers (vetted build of 2026-10-31)

Coverage by direct record: body 1/1, organ system 8/13, organ 28/67, tissue 29/198, cell 14/257. **The cell
gap is a mapping gap:** only 16 of 257 blueprint cell types have any zebrafish-anatomy equivalent to map
through, so the layer is capped by the ontology crosswalk, not by the data.

Pectoral fin (UBERON:0000151): 982 genes expressed in it, 166 required for it, 1 (kcnk5b) sufficient to
enlarge it. Direct links in all: 359,703 (349,658 expressed in, 10,042 required for, 3 sufficient for).

## Fin size, where the flying fish is specific

Verified against fetched PubMed abstracts (quotes in `fin_size.verified_leads`): kcnk5b gain of function
enlarges fins (PMID 24453984); longfin overexpresses kcnh2a (PMID 34061172); Daane et al. 2021 (PMID 34534441,
doi 10.1016/j.cub.2021.08.054) implicate lat4a and kcnh2a in fin proportion and show the interaction in
zebrafish phenocopies flying-fish fin proportions. The paper's **lat4a is ZFIN's slc43a2a**, settled on two
independent records: human SLC43A2 is aliased LAT4 (NCBI Gene 124935), and ZFIN curated PMID 34534441 itself
to slc43a2a (allele dmh26, decreased fin length). ZFIN lists no alias "lat4a".

## Vetting (what changed after the handover)

1. Bgee 15.2 and ZFIN's Ensembl 1:1 table use different Ensembl releases; Bgee genes with no 1:1 row are
   merged onto the ZFIN gene with the identical symbol (1,614 Bgee genes merged; fgf10a and shha no longer appear twice).
2. Phenotype rows are kept only under standard conditions, matched through ZFIN's `phenotype_fish.txt` and
   `pheno_environment_fish.txt`. The clean file is almost entirely standard conditions; what is dropped is
   mostly annotations ZFIN also recorded under a treatment and that cannot be told apart.
3. Homozygous alleles that also have a heterozygous phenotype and no truncating consequence are rejected
   ("loss of function not established"), because the known gain-of-function fin alleles are dominant missense.
4. The lat4a check reads the right column and adds the NCBI and ZFIN-curation evidence.

## Prior art

Closest: the Phenoscape Knowledgebase (doi 10.1093/molbev/msv223; fin-to-limb 10.1093/sysbio/syv031), which
links ontology-annotated fish phenotypes to ZFIN gene data; it holds 40 Exocoetidae phenotypes and none about
pectoral-fin size (`research/prior-art/REPORT.md`). Cross-species genotype-to-phenotype with ontologies:
Monarch (10.1093/nar/gkad1082), uPheno (10.1093/genetics/iyaf027). This map's part_of propagation rule is a
reach-synthesis: it has not been checked against those projects' documented inference rules.

## Not done

Medaka phenotypes (no source queried); ZP identifiers (ZFIN EQ annotations stand in); GO coverage for
musculoskeletal and integumental systems; any flying-fish data.

## For the Physics thread (#50): measured flying-fish fin proportions

Daane et al. 2021 Data S1A (publisher supplement, fetched from the Elsevier CDN; `cache/daane2021_data_s1_mmc2.xlsx`)
holds paired fin and standard lengths of 109 beloniform museum specimens (Harvard MCZ). Re-tabulated by
`fin_ratios_table.py` into `cache/daane2021_data_s1A_fin_measurements.csv` (per specimen) and
`cache/daane2021_fin_ratios.json` (per species and group). Pectoral fin / standard length: flying fish median 0.687
(range 0.41 to 0.82, n 49, SL 1.7 to 24 cm, three species); gliding halfbeaks 0.274; halfbeaks 0.14; needlefishes 0.088.
Lengths only: no mass, fin area, aspect ratio or glide data. PMC's copy of the supplement answered with a reCAPTCHA
page; the Perathoner 2014 and Stewart 2021 full texts hold zebrafish fin measurements only (figures), no flying-fish
numbers. Draft record: `nanopubs/unsigned/daane-2021-fin-length-ratios.trig`.

## Fin-focused subtree (`fin-subtree.json`), for the zoom from organ to cells

The blueprint's pectoral fin has one tissue and no cell types beneath it, so `build_fin_subtree.py` extends the
hierarchy from what the zebrafish anatomy ontology actually holds: the ZFA part_of closure of "pectoral fin" (35
terms: skeleton, musculature, vasculature, fin fold, girdle bones, rays, actinotrichia, and so on) plus the
precursor "pectoral fin bud" and its parts (5 terms, develops_from edges). 35 of the 40 terms carry a Uberon
cross-reference (Ubergraph, typed-literal query in `fetch_fin_subtree.py`); the 5 without are flagged zebrafish-only;
no MFO cross-reference exists for any. Cell level comes only from ZFIN's post-composed annotations (superstructure
plus a ZFA cell term with a Cell Ontology cross-reference): 10 cell-in-structure nodes, expression only. Every ZFIN
row is re-attached to the exact structure it names; nothing propagates up or down in this file. Bgee calls attach
where a node's Uberon term is annotated. Output shape is the one `dashboard/build-graph.mjs` reads (`layers` with
nodes and links: organ, part, subpart, cell, precursor, precursor part); `fin-subtree.json` is capped like the slim
map (456 KB), `fin-subtree.full.json` holds every link (3 MB, local).

**Honest depth for the three wing genes:** all evidence sits at the whole-organ level or above. kcnk5b: one
sufficient-for link on "pectoral fin" (gain-of-function alleles, heterozygous rows, adult); its other fin rows are on
generic "fin", "lepidotrichium" and caudal-fin terms. slc43a2a: one adult RT-PCR expression row on "pectoral fin"
(Daane 2021) and heterozygous dmh26 phenotype rows there (fail the homozygosity rule); homozygous rows are on the
caudal fin. kcnh2a: RT-PCR expression on generic "fin" and "regenerating fin" only, no phenotype row in any
single-gene fish. No row for any of the three names a fin part, tissue or cell. Single-cell fin datasets are listed
as leads from logged GEO searches (`cache/geo_fin_single_cell.json`), not integrated.
