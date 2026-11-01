# omics/genomic: sources

Built by `omics/genomic/scripts/fetch.mjs` (network calls; cache in `C:/Temp/omics-cache/genomic`, call log
`calls.json` there) and `omics/genomic/scripts/build.mjs` (offline). Row format: `omics/SCHEMA.md`. Counts, sha256s
and retrieval dates are in `MANIFEST.json`. Retrieved 2026-10-31 / 2026-11-01. Gene universe: `omics/genes.json`
(3,860 zebrafish genes). Genes with at least one genomic row: 3,859.

| source (`source.db`) | what | URL | release | licence | rows | genes |
|---|---|---|---|---|---|---|
| Ensembl | gene model: `chromosome`, `gene_location` (GRCz11), `biotype`, `transcript_count` (with canonical transcript and exon count), `gene_name` | REST `POST /lookup/id?expand=1` | release 116, GRCz11 | open, no restrictions | 27,596 | 3,822 |
| Ensembl (Compara) | `paralog_count`, `paralog` (within-species paralogues, top 10 by identity), `ortholog` to medaka (*Oryzias latipes*, Beloniformes like flying fish) | `ftp.ensembl.org/pub/release-116/tsv/ensembl-compara/homologies/danio_rerio/Compara.116.protein_default.homologies.tsv.gz` (115 MB, streamed and filtered to zebrafish and medaka partners) | 116 | open | (in Ensembl total) | 2,742 with paralogues |
| NCBI Gene | `chromosome`, `gene_location`, `gene_name`, `alias`, `summary` | E-utilities `esummary db=gene` (POST, 200 ids) | 2026-11-01 | public domain | 25,325 | 3,786 |
| ZFIN | `alias`; `allele_count` by feature type; **`allele_phenotype`**: mutant/knockdown phenotypes as entity (ZFA anatomy or GO process) + PATO quality, with ZFS stage, alleles and their transcript consequence, fish ids, publications, and whether the experiment was standard conditions | `zfin.org/downloads/{aliases, features-affected-genes, phenoGeneCleanData_fish, phenotype_fish, pheno_environment_fish, fish_components_fish, stage_ontology}.txt` | downloads of 2026-10-31 | CC BY 4.0 | 105,593 | 3,858 |
| ZFIN (orthology) | `ortholog` (human), curated by ZFIN with evidence codes (AA, CL, …) and publications | `zfin.org/downloads/human_orthos.txt` | 2026-10-31 | CC BY 4.0 | (in ZFIN total) | |
| Alliance of Genome Resources | `ortholog` to human, mouse and *Xenopus tropicalis* (stringent set, algorithm match counts); `summary` (automated gene description) | `fms.alliancegenome.org/download/{ORTHOLOGY-ALLIANCE_COMBINED, GENE-DESCRIPTION-TSV_ZFIN}.tsv.gz` | Alliance 9.0.0 | CC BY 4.0 | 15,299 | 3,857 |
| Alliance (from ZFIN) | `disease_model`: zebrafish genes ZFIN curators implicate in a human disease (DOID) | `DISEASE-ALLIANCE_ZFIN.tsv.gz` | 9.0.0 | CC BY 4.0 | 652 | 520 |
| Alliance (human orthologue) | `human_disease_association`, **kind `borrowed-ortholog`**: disease annotations of the human orthologue (RGD, OMIM via RGD, Alliance), with the association type and a `negative` flag for `is_not_implicated_in` | `DISEASE-ALLIANCE_HUMAN.tsv.gz` | 9.0.0 | CC BY 4.0 | 11,052 | 2,195 |
| Xu et al. 2021 annotation | `ortholog` to *Hirundichthys speculiger*: 8 focal genes, reciprocal best blastp called in `sequences/` (kind `predicted`) | doi 10.3389/fgene.2021.695700; figshare 10.6084/m9.figshare.14600634.v1 | 2021 | CC BY 4.0 | 8 | 8 |

## Choices and caveats

- **Independence.** NCBI Gene's `gene_name` and Ensembl's `gene_name` both come from ZFIN nomenclature, so those rows
  carry `derived_from: "ZFIN"`. NCBI's `summary` text for zebrafish is written by Alliance, so it carries
  `derived_from: "Alliance"`. The integration counts these as the upstream source, not as extra agreement.
- **Coordinates.** NCBI Gene's coordinates are on a newer RefSeq sequence (`NC_141026.1`…), not GRCz11. Compare
  `chromosome`, not positions. Both chromosome rows are emitted so concordance can be counted.
- **Paralogues.** Ensembl BioMart returned HTTP 405 to POST queries (release 116), and REST `/homology` took about 10 s
  per call with 503s. The Compara TSV dump was used instead. Only `within_species_paralog` rows (the teleost duplicates
  that matter for paralog guards) are listed individually; `paralog_count` gives every type.
- **Phenotypes.** The rows come from ZFIN's clean gene-phenotype file (single affected gene). The condition is resolved
  the way `genotype/build.py` resolves it. 2,580 of 132,882 phenotype rows are not standard conditions, or are
  ambiguous. Those rows are **kept but labelled** (`standard_conditions: false`, `context.condition` lists the
  conditions), whereas the genotype map drops them. `reagent` is `allele` or `knockdown/crispant`. A heterozygous or
  gain-of-function allele is not separated out here; see `genotype/map.vetted.json` for loss-of-function grading.
  `anatomy.uberon` is filled only for the 66 ZFA terms in the blueprint crosswalk
  (`genotype/cache/ubergraph_uberon_zfa_xrefs.json`). The index adds more ZFA to UBERON pairs from the transcriptomic
  layer's crosswalk.
- **Disease.** Alliance's `implicated_via_orthology` and `biomarker_via_orthology` rows are skipped in both files. In
  the zebrafish file they are electronic transfers from human, which duplicate the explicit borrowed rows. In the human
  file they come from model organisms, which would be circular here.
- **Flying fish.** NCBI Datasets for GCA_018398805.1 has **no gene annotation** (`annotation_info` absent, checked
  2026-11-01). Gene models exist only in the Xu 2021 figshare release (`pep.fa`). Orthologue IDs exist only for the
  8 focal genes the sequence layer called; the other genes are not mapped, which does not mean they are absent.
- **Birds.** No Aves data. Alliance's species set has no birds, and the Compara dump was filtered to zebrafish and
  medaka partners only. The validator rejects bird species, and the build has an explicit bird filter (0 rows dropped).
- **Licences.** All open. ZFIN, Alliance and UniProt are CC BY 4.0. Ensembl has no restrictions. NCBI is public domain.
  The Xu 2021 article and data are CC BY 4.0.
