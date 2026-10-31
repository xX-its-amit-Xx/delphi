# Handover: genotype thread -> Genotype session

Written 2026-10-31 ~18:20Z by the background `genotype` agent, stopping at the hub's request.
Nothing was committed or pushed.

## State on disk (all consistent)

| file | what it is |
|---|---|
| `genotype/fetch.py` | every network call; writes `genotype/cache/calls.json` (29 calls, incl. the refusal) and small results in `genotype/cache/` |
| `genotype/build.py` | offline; builds `map.json` + `expression_index.json.gz` from raw files in `C:/Temp/genotype/raw` (~140 MB, D: is full). About 6 min |
| `genotype/map.json` | **38 MB**, organised by layer. Too big for the repo or a dashboard: slim it down before anyone commits it (see problems) |
| `genotype/expression_index.json.gz` | 3 MB: every direct "expressed in" link not stored in full in map.json |
| `genotype/SOURCES.md` | generated call log |
| `genotype/cache/pubmed.json`, `pubmed_abstracts.xml` | the PubMed searches and abstracts used to check the fin-size lead |

Reproduce: `python -I genotype/fetch.py`, then `python -I genotype/build.py`.

## Done: coverage per layer (denominators are the blueprint's counts_distinct)

"Direct" means a fish record (zebrafish or medaka) attached to that exact node. "Derived only" means records only on parts of the node, propagated up the blueprint's part_of graph.

| layer | nodes | direct | derived only | none | direct expressed / required / sufficient |
|---|---|---|---|---|---|
| body | 1 | 1 | 0 | 0 | 1 / 1 / 1 |
| organ system | 13 | 8 | 5 | 0 | 6 / 6 / 0 |
| organ | 67 | 28 | 13 | 26 | 28 / 27 / 1 |
| tissue | 198 | 29 | 0 | 169 | 28 / 26 / 0 |
| cell | 257 | **14 (5.4%)** | 0 | 243 | 13 / 12 / 0 |

Six more cells have only Cell Ontology marker relations, which are not fish data, so they are not counted. Only 16 of the 257 cells have a ZFA equivalent at all, so the cell layer is capped by the crosswalk, not by the data. No record means unstudied, not gene-free.

Direct links: 360,205 (349,658 expressed in, 10,544 required for, 3 sufficient for). Genes: 31,575 zebrafish and 22,499 medaka keys. Pectoral fin (UBERON:0000151): 1,244 distinct genes, 2,013 expressed-in links (ZFIN 1,170, Bgee 843), 235 required-for links and 1 sufficient-for link. In the blueprint the pectoral fin has one tissue under it (mesenchyme pectoral fin) and no cells.

## Where I stopped

- `map.json` is built. **Not done:** the sub-dashboard (`dashboard/public/t/genotype/index.html` does not exist), the nanopub drafts (`genotype/nanopubs/unsigned/` is empty), a README, and slimming `map.json`.

## Sources: what worked and the endpoint shapes

- **Bgee SPARQL** `https://www.bgee.org/sparql/`: REFUSED (HTTP 403, Cloudflare challenge). Don't retry.
- **Bgee REST** `api/?page=data&action=expr_calls&...`: HTTP 200 but returns no calls. Not used.
- **Bgee FTP, works:** `https://www.bgee.org/ftp/current/download/calls/expr_calls/{Danio_rerio,Oryzias_latipes}_expr_advanced.tsv.gz`. `current` is Bgee 15.2; a v16_0 directory exists and was not used. Only `Expression=present` AND `Including observed data=yes` is used, which excludes Bgee's own propagation. Per-datatype columns give single-cell, in situ or bulk. These files are anatomy-only, so stages are merged.
- **ZFIN bulk downloads, all work:** `https://zfin.org/downloads/<name>.txt` for wildtype-expression_fish, phenoGeneCleanData_fish, fish_components_fish, features, anatomy_item, anatomy_relationship (columns: parent, child, rel), pub_to_pubmed_id_translation, ensembl_1_to_1, stage_ontology and aliases. Column headers are only on https://zfin.org/downloads.
- **ZFA:** `http://purl.obolibrary.org/obo/zfa.obo` (releases/2026-07-16), with 444 `xref: CL:` lines.
- **GO:** `https://current.geneontology.org/annotations/zfin.gaf.gz`. Only IMP/IGI and non-NOT annotations are used.
- **Ubergraph** `https://ubergraph.apps.renci.org/sparql`, POST form `query=`, works. Queries: Uberon hasDbXref ZFA, CL RO:0002292 markers, GO RO:0002296 "results in development of" a system (9 GO terms; none for musculoskeletal, integumental and some others), and subclasses of GO:0009952.
- **PubMed eutils** (esearch / esummary / efetch): works.
- **Not tried:** medaka phenotype databases, MFO, orx/OpenResearch.

## The eight nuances

1. **Layer and evidence_kind on every link: applied.** Organ-system GO links are labelled "the weakest kind".
2. **Propagation: applied.** Up only. Derived required-for links are labelled an inference. Nothing goes down or sideways. Derived links are stored only for the pectoral-fin subtree and the focus genes (2,765). Coverage uses derivation over all genes.
3. **Stage: applied for ZFIN.** The link key includes the period span (embryo / larva / juvenile / adult), and phenotype rows carry ZFS IDs. Bgee links have no stage (stage-merged file). ZFIN expression stage names are kept, but not their ZFS IDs.
4. **Paralogs: applied.** Kept separate; flying-fish correspondence is marked "assumed".
5. **Xref-only mapping: applied.** Unattached ZFIN rows are counted: expression 171,906 rows (1,839 ZFA terms); phenotype 126,634 rows. Medaka comes only through Bgee's own Uberon annotation; there is no MFO step.
6. **Breadth: applied.** It is in `genes` and `focus_genes`. The median fish gene touches 7 blueprint nodes; the maximum is 19.
7. **Absence ≠ gene-free: stated** in every layer's coverage block.
8. **Fin size: partly applied.** See below.

## Fin-size potassium-channel lead: checked against PubMed abstracts (quotes in map.json fin_size)

- **kcnk5b:** confirmed. PMID 24453984, Perathoner 2014, PLoS Genet, DOI 10.1371/journal.pgen.1004080: "alf mutants carry gain-of-function mutations in kcnk5b". ZFIN alleles ty86d and dt30mh are cited under that paper. Also PMID 38527087 (pectoral fin bud, overexpression increases bud proportions) and PMID 29991812.
- **kcnh2a / longfin t2:** confirmed. PMID 34061172, Stewart 2021, Development, DOI 10.1242/dev.199384: a cis-regulatory allele that overexpresses kcnh2a. ZFIN has no single-gene kcnh2a fish for it, so it is not attached to any node.
- **Flying fishes:** confirmed. PMID 34534441, Daane 2021, Curr Biol, DOI 10.1016/j.cub.2021.08.054: phylogenomics of 35 flying-fish and related species implicates lat4a and kcnh2a in fin proportion.
- **NOT verified:** lat4a = ZFIN `slc43a2a`. The aliases check found no rows, possibly because I read the wrong column. ZFIN slc43a2a phenotype rows do cite that paper (ZDB-PUB-210918-31), but the symbol equivalence is unproven. The map's `symbol_check` text overstates it. Fix that or drop it.
- ZFIN lists 220 genes with fin size or length phenotypes (any allele, gain or loss of function not separated).

## Known problems and doubts

- **Rule check:** "required for" means a single-gene fish with no construct, and either a knockdown reagent or a homozygous allele. A homozygous gain-of-function allele that is not in the hand-checked GOF table would still be typed "required for". Only the two kcnk5b alleles are in that table.
- **Same-name genes:** a Bgee zebrafish Ensembl gene without a 1:1 ZFIN mapping gets its own key. So fgf10a and shha each appear twice in focus_genes (one ZDB key, one ENSDARG key). Merge or explain.
- **Environment not filtered:** the ZFIN phenotype environment (GENOX) is kept but not filtered, so chemical-treatment rows may be included.
- **Whole-organism links:** the 48k body-level expressed-in links are Bgee whole-organism samples. They are real, but they are not body-plan evidence.
- **Missing GO coverage:** GO system mapping missed musculoskeletal, integumental and other systems, because the blueprint uses Uberon terms that no GO term "results in development of". The GO set also includes irrelevant terms (e.g. "open tracheal system development"), which match nothing in zebrafish.
- **No ZP IDs:** ZP term IDs were not produced; ZFIN's EQ annotations (ZFA + PATO) stand in.
- **Heavy dependence on proxies:** nothing here is flying-fish data. Exocoetidae has one scaffold-level assembly (GCA_018398805.1), and OrthoDB has no Belonoidei genomes. Both facts come from the hub's brief and dashboard/figures/DATA.md and were not refetched by me.
  - **CORRECTION, added 2026-10-31 by the Genotype session (this is the background agent's original text, kept as the historical record).** Calling that assembly merely
    scaffold-level understates it. It is annotated: 23,611 predicted protein-coding genes, 23,492 of them (99.5%) with at least one database hit (Xu et al. 2021,
    doi 10.3389/fgene.2021.695700, read in full). The gap is not missing genes but missing expression and phenotype records. See the `flying_fish_genome` block of
    `map.vetted.json` and the constraint paragraph in `README.md`.
