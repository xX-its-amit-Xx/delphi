# omics/transcriptomic: sources

Built 2026-11-01 by `scripts/build.py` (offline, about 30 s; `python -I omics/transcriptomic/scripts/build.py` from the repo root).
Raw downloads are cached under `C:/Temp/omics-cache/transcriptomic/`. ZFIN wild-type expression, ZFA, the stage table and the
Bgee zebrafish and medaka anatomy files were already fetched by the genotype thread (`C:/Temp/genotype/raw/`). They are reused
here, not downloaded again. Checksums of every raw input are listed in `MANIFEST.json` under `retrievals`.

Output: `annotations.jsonl.gz`, 380,449 rows covering 3,857 of the 3,860 universe genes. It passes `node omics/validate.mjs` (0 invalid).
`concordance.json` holds the cross-source agreement tables. Every row has `species`, `source.db`, `kind`, `evidence` and
`context` (anatomy as ZFA where a ZFA term exists, with `uberon` added through Uberon `hasDbXref`, never matched by name; stage as ZFS
where the source gives a stage; cell type where the source has one).

**No Aves data.** No bird source was fetched. The build asserts that no bird species appears in any row.
**Absence of a row means "not recorded".** Only Bgee `not_expressed_in` rows assert absence.

## Sources

| # | source.db | what it measures | release | licence | URL | what we kept | rows | genes |
|---|---|---|---|---|---|---|---|---|
| 1 | `ZFIN` | curated wild-type expression (in situ, RT-PCR, antibody, etc.) by anatomy (ZFA) and stage (ZFS) | download of 2026-10-31 | CC BY 4.0 | https://zfin.org/downloads/wildtype-expression_fish.txt | one row per (gene, superstructure, substructure, start stage, end stage, assay). Publications aggregated (`n_pubs`, first 5 in `pubs`). `kind: curated` | 109,639 | 3,662 |
| 2a | `Bgee`, *Danio rerio* | present/absent calls per anatomy, merged from RNA-seq, Affymetrix, EST, in situ and scRNA-seq, with expression score and FDR | Bgee 15.2 | CC0 1.0 | https://www.bgee.org/ftp/bgee_v15_2/download/calls/expr_calls/Danio_rerio_expr_advanced.tsv.gz | only calls observed in that exact structure (`Self observation count > 0`; Bgee's upward propagation excluded). Gold and silver calls. `data_types` lists which assays support each call. Anatomy-level, all stages pooled. CL terms go to `cell_type` | 140,738 | 3,821 |
| 2b | `Bgee`, *Oryzias latipes* (medaka, Beloniformes, same order as flying fish) | same | Bgee 15.2 | CC0 1.0 | …/Oryzias_latipes_expr_advanced.tsv.gz | same filter. Mapped to zebrafish genes through OMA orthologs (Bgee `homologous_genes/OMA_orthologs.zip`, 2023). `ortholog_gene` records the medaka gene and the number of zebrafish orthologs | 40,128 | 2,402 |
| 2c | `Bgee`, *Astyanax mexicanus* | same | Bgee 15.2 | CC0 1.0 | …/Astyanax_mexicanus_expr_advanced.tsv.gz | same, via OMA orthologs | 31,146 | 2,092 |
| 3a | `Expression Atlas` E-ERAD-475 | baseline RNA-seq TPM across 18 developmental stages, whole embryo or larva (White et al. 2017, eLife, PMID 28974578), 5 samples per stage | retrieved 2026-10-31 | CC BY 4.0 | https://ftp.ebi.ac.uk/pub/databases/microarray/data/atlas/experiments/E-ERAD-475/E-ERAD-475-tpms.tsv | `expression_level` = median TPM per stage, with quartiles in `tpm_quartiles`. Only rows with median ≥ 1 TPM. Stage mapped to ZFS by stage name from ZFIN's stage table. Anatomy = whole organism. This is the **only** zebrafish baseline experiment in Expression Atlas, so there is no tissue-level Atlas baseline | 53,076 | 3,752 |
| 3b | `Expression Atlas` E-GEOD-17993 | differential expression, adult heart amputation vs sham at 1, 3, 5 and 7 dpa (Affymetrix) | retrieved 2026-10-31 | CC BY 4.0 | …/E-GEOD-17993/E-GEOD-17993_A-AFFY-38-analytics.tsv | Atlas analytics with adjusted p < 0.05 and abs(log2FC) ≥ 1 | 10 | 10 |
| 4a | `Daniocell` | scRNA-seq atlas, 3–120 hpf (Sur et al. 2023, Dev Cell, PMID 37995681): marker genes per annotated cluster (authors' identity genes, ROC top 6, Wilcoxon top 6) | Daniocell 2023 `cluster_annotations.csv` | US Government work (NIH); cite the paper | https://daniocell.nichd.nih.gov/assets/obj-download/cluster_annotations.csv | `cell_type_marker`. `cell_type` = cluster identity. Anatomy = the last ZFA id the authors attached (the location; the first id, the cell type, is in `cell_type.zfa`). Doublet clusters dropped. `technical_flag` marks low-UMI or high-mito clusters. Markers only (≤ 15 per cluster), not the expression matrix | 1,825 | 743 |
| 4b | `Single Cell Expression Atlas` E-GEOD-158851 | scRNA-seq of larval caudal fin, amputated (24 hpa) and uncut, 3 dpf (PMID 34732706) | retrieved 2026-10-31 | CC BY 4.0 | https://ftp.ebi.ac.uk/pub/databases/microarray/data/atlas/sc_experiments/E-GEOD-158851/E-GEOD-158851.marker_genes_16.tsv | markers of the Atlas-selected k = 16 unsupervised clustering, adjusted p < 0.01 and log2FC ≥ 1. **Clusters carry no cell-type label** (none in Atlas), so `cell_type` is "unsupervised cluster N" | 371 | 237 |
| 5 | `GEO` GSE217486 | bulk RNA-seq of isolated pectoral fins, 48 hpf (Long-pec), wild type vs *prdm1a* m805/m805 (Tg(Mmu.Prx1:EGFP) background), n = 2 per group (PMID 37083955) | GEO public 2023-04-13 | GEO: no restriction on use; cite the paper | https://ftp.ncbi.nlm.nih.gov/geo/series/GSE217nnn/GSE217486/suppl/GSE217486_FeatureCountsDEseq2.txt.gz | (a) `expressed_in` pectoral fin when the raw count is ≥ 10 in both WT replicates (a lenient detection rule; it detects 89% of the universe). (b) `differential_expression` from the **authors' own DESeq2 table**, padj < 0.05 | 3,516 | 3,441 |

Features used: `expressed_in`, `not_expressed_in`, `expression_level`, `cell_type_marker` and `differential_expression`.
Extra row fields (passed into cards): `n_pubs`, `pubs`, `stage_end`, `substructure`, `call_quality`, `fdr`, `score`, `data_types`,
`n_self_observations`, `ortholog_gene`, `tpm_quartiles`, `n_samples`, `pmid`, `p_adj`, `log2fc`, `rank`, `direction`, `tissue`, `zfa_all`,
`stage_text`, `technical_flag`, `value_log2_norm`, `raw_counts_wt`, `detection_rule` and `base_mean`.

## Flying fish (Exocoetidae): no usable transcriptome

Searched on 2026-10-31:
- Europe PMC: (flying fish OR Exocoetidae OR *Cheilopogon* OR *Hirundichthys* OR *Exocoetus* OR *Parexocoetus*) AND (transcriptome OR RNA-seq OR gene expression). There are 3,485 hits for the loose query, and none is a flying-fish transcriptome. The only Exocoetidae omics paper is mitogenomics (PMID 40135747).
- NCBI GEO (gds): Exocoetidae organisms. The only hits are *Cheilopogon californicus* RRBS DNA-methylation samples (GSM5854644/5, part of the GSE195869 580-species methylation survey) and platform GPL31722. That is not expression data.
- NCBI SRA: `Exocoetidae[Organism] AND "transcriptomic"[Source]` returns **0** records.

So **no flying-fish RNA-seq, raw or processed, exists in these archives**, and in particular no pectoral-fin expression data. The
*H. speculiger* genome (GCA_018398805.1) has gene models but no transcriptome (see `genotype/README.md`). Every row here is a proxy
(zebrafish, plus medaka and Astyanax through orthologs). Only 8 focal genes have flying-fish IDs in `genes.json`. A gene with no
flying-fish ID is **unmapped, not absent**.

## Fin-specific datasets considered

GEO search ("fin regeneration" or "pectoral fin", *Danio rerio*, high-throughput sequencing) found 29 series. Most supplementary
files hold raw or normalised counts (e.g. GSE76564 regenerating vs uninjured fin counts, GSE112498 raw counts, GSE231956 normalised
counts) or h5/mtx single-cell matrices, not a published DE table. Following the brief (processed DE tables only, and only if published),
only GSE217486 (authors' DESeq2 table, pectoral fin) and the Atlas-processed E-GEOD-158851 caudal-fin markers were used.
Expression Atlas has no zebrafish fin experiment in bulk.

## Coverage of studio anatomy (genes with `expressed_in` or `cell_type_marker` in the structure or its ZFA is_a/part_of descendants)

| structure | ZFIN | Bgee Dr | Bgee medaka | Bgee Astyanax | Daniocell | GEO GSE217486 | any |
|---|---|---|---|---|---|---|---|
| pectoral fin | 1,095 | 801 | 0 | 0 | 13 | 3,439 | 3,480 |
| fin fold | 109 | 79 | 0 | 0 | 14 | – | 122 |
| gill | 866 | 3,153 | 1,967 | 1,717 | 1 | – | 3,341 |
| heart | 930 | 3,001 | 1,787 | 1,599 | 16 | – | 3,255 |
| muscle | 1,070 | 3,148 | 2,007 | 1,598 | 73 | – | 3,390 |
| swim bladder | 153 | 2,891 | 0 | 0 | 0 | – | 2,909 |
| skeleton | 672 | 3,476 | 2,228 | 1,864 | 8 | – | 3,598 |
| skin | 520 | 3,190 | 0 | 1,587 | 95 | – | 3,313 |

Bgee has no medaka or Astyanax pectoral-fin, fin-fold or swim-bladder samples (and no medaka skin samples), so those zeros mean no samples, not absence.
Bgee Uberon terms without a ZFA xref (muscle tissue, zone of skin) reach the studio structures through their Ubergraph
subClassOf/part_of ancestors (`C:/Temp/omics-cache/transcriptomic/ont/uberon_priority.json`). Bgee's teleost "pharyngeal gill"
(UBERON:0000206) is counted as gill by an explicit, documented rule in `build.py`.

## Concordance (full tables in `concordance.json`)

Method: for structure S and sources A → B, take the genes A records in S that B has any call for. agree = the share that B also records
in S. baseline = the same share among genes A has calls for but **not** in S. Agreement is informative only when it is clearly above
baseline. **Caveat:** Bgee imports ZFIN's in situ data, so ZFIN vs Bgee (all data types) is not independent. `Bgee:Dr:non-ISH`
keeps only Bgee calls backed by RNA-seq, Affymetrix, EST or scRNA.

Key numbers (agree / baseline):

- **Pectoral fin.** Bgee's zebrafish pectoral-fin calls are almost entirely ZFIN in situ. Only 9 genes have a non-in-situ Bgee
  pectoral-fin call, so Bgee adds no independent fin evidence. Independent comparisons:
  - ZFIN → GEO GSE217486 (bulk 48 hpf fin): 1,056/1,086 = **97.2% vs baseline 86.8%**. This is enriched, but the bulk detection rule is lenient.
  - GEO → ZFIN: 1,056/3,261 = 32.4% vs 8.2%.
  - Daniocell pectoral-fin markers → ZFIN: 9/13 = 69% vs 38%.
  - ZFIN → Daniocell: 9/280 = 3.2% vs 0.9%. This is low because Daniocell lists ≤ 15 markers per cluster.
  - Genes positive in 1 / 2 / 3 / 4 sources: 2,392 / 313 / 770 / 5.
- **Heart.**
  - ZFIN → Bgee non-ISH: 792/922 = 85.9% vs 75.2%. Bgee asserts absence for 97 of the 922.
  - ZFIN → medaka (Bgee): 77.1% vs 72.9%. ZFIN → Astyanax: 81.3% vs 74.3%.
  - Bgee Dr non-ISH → medaka: 87.3% vs 20.7%. → Astyanax: 90.0% vs 21.5%.
  - Daniocell heart markers → ZFIN: 12/16 = 75% vs 30%.
- **Gill.**
  - ZFIN → Bgee non-ISH: 87.7% vs 79.5%.
  - Bgee Dr non-ISH → medaka: 94.0% vs 19.0%. → Astyanax: 94.1% vs 21.9%.
- **Muscle.**
  - ZFIN → Bgee non-ISH: 87.7% vs 78.0%.
  - Daniocell muscle markers → ZFIN: 48/73 = 65.8% vs 33.9%.
  - Bgee Dr non-ISH → medaka: 92.5% vs 37.8%.
- **Skeleton.**
  - ZFIN → Bgee non-ISH: 92.0% vs 89.5%. This is barely above baseline, because bulk bone RNA-seq detects most genes.
  - Bgee Dr non-ISH → medaka: 97.4% vs 43.1%.
- **Skin.**
  - ZFIN → Bgee non-ISH: 86.4% vs 82.4%.
  - Daniocell skin/epidermis markers → ZFIN: 45.1% vs 20.3%.
- **Swim bladder.** ZFIN → Bgee non-ISH: 86.6% vs 74.8%. In the other direction it is 4.7%, because ZFIN has only 153 swim-bladder genes.
- **Fin fold.** Daniocell → ZFIN: 1/13. ZFIN → Daniocell: 1/46. This is uninformative because the samples are too small.

Reading: the bulk sources (Bgee RNA-seq, GEO) detect most genes in most tissues, so their "agreement" with curated in situ is high in
absolute terms but only modestly above baseline (+3 to +12 points). Cross-species bulk calls (zebrafish ↔ medaka ↔ Astyanax via
OMA orthologs) agree strongly above baseline for heart, gill, muscle and skeleton. Marker-level sources (Daniocell) show the clearest
enrichment over baseline (about 2× for pectoral fin, heart, muscle and skin), but they cover few genes.
