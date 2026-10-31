# Genotype thread: genotype-to-phenotype links for the flying-fish blueprint, at every layer

Amit's #53 deliverable ("genotype-phenotype links for the demo taxa"). Owner: the genotype thread (session
`scienceclaw-68`), taking over from a background agent whose notes are in `HANDOVER.md`.

**The constraint, stated on every number:** almost no molecular data exists for flying fish (Exocoetidae).
NCBI holds one scaffold-level assembly (GCA_018398805.1) and OrthoDB holds no genome for the suborder
Belonoidei. Every gene link here was measured in a **proxy** species: zebrafish (*Danio rerio*; ZFIN and
Bgee) or medaka (*Oryzias latipes*, same order Beloniformes; Bgee). None of it is flying-fish data.

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
