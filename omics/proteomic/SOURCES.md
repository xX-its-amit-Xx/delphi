# omics/proteomic: sources

Layer `proteomic` of the DELPHI multi-omic annotations. One JSON row per (gene, feature, source) in
`annotations.jsonl.gz`, in the format set by `omics/SCHEMA.md`. The gene universe and the join key (`zfin_id`) come from
`omics/genes.json`. Code: `omics/proteomic/scripts/` (`fetch_api.py`, `fetch_pdb.py`, `fetch_pride.py`, `build.py`, `common.py`).
Downloads are cached in `C:/Temp/omics-cache/proteomic/`, never in the repo. Counts, coverage, sha256 of every file and
retrieval URLs are in `MANIFEST.json`. The numbers below come from the build of 2026-11-01. MANIFEST.json is the authority if they differ.

**Species.** Every row is *Danio rerio* (taxid 7955) except 3 rows for flying-fish UniProt entries (see the flying-fish section).
None of the rows is bird data. IntAct is restricted to zebrafish-zebrafish pairs, STRING to the zebrafish network, and any
UniProt function sentence that mentions a bird is removed (`AVES` regex, the same one `omics/validate.mjs` uses).

**Which protein.** For each gene the canonical protein is the `uniprot` of `genes.json`, or, when that entry is missing from
the UniProt download, the gene's reviewed entry or its longest entry (joined by the UniProt ZFIN cross-reference). AlphaFold
uses the gene's entry that has an AlphaFold DB cross-reference, because many new TrEMBL accessions have no model. In that
case the row carries `protein_accession` and a note. Every row names its protein in `protein_accession` or `source.accession`.

## Sources

| source.db | what | URL | release | licence | rows | genes |
|---|---|---|---|---|---|---|
| UniProt | protein existence (PE1-5), length, function text, subcellular location, membrane topology, FT domain/region/motif/zinc finger/repeat/coiled coil, keywords, Swiss-Prot vs TrEMBL, annotation score | `https://rest.uniprot.org/uniprotkb/stream?query=organism_id:7955` (78,189 entries) | 2026_03 (02-Sep-2026) | CC BY 4.0 | ~72k | 3,823 |
| InterPro | InterPro entries per protein (family, domain, repeat, homologous superfamily, site), with positions and the Pfam signatures each one integrates | `https://www.ebi.ac.uk/interpro/api/entry/all/protein/uniprot/{acc}` | InterPro 110.0 | CC0 | ~21k | ~3,816 |
| Pfam | Pfam matches (names and positions from the InterPro API, otherwise ids only from the UniProt cross-reference) | same, and the UniProt `xref_pfam` | via InterPro 110.0 | CC0 | ~8k | ~3,772 |
| AlphaFold DB | model id, mean pLDDT, fraction of residues with pLDDT > 70 (confident + very high), > 90 and < 50, model version | `https://alphafold.ebi.ac.uk/api/prediction/{acc}` | AFDB API (models v6) | CC BY 4.0 | 3,612 | 3,612 |
| PDB | experimental structures of the zebrafish protein: number of entries, best-resolution entry, method, resolution, and up to 30 entries | UniProt PDB cross-references plus `https://data.rcsb.org/graphql` | RCSB 2026-11-01 | CC0 | 104 | 104 |
| PaxDb | MS-derived protein abundance (ppm) per zebrafish dataset and tissue, plus one `protein_detected` summary row per gene | `https://pax-db.org/downloads/latest/datasets/7955/` (35 files) | PaxDb v6.1 | CC BY 4.0 (each dataset also falls under its repository's terms) | ~25k | 3,086 |
| PeptideAtlas | `protein_detected` from the UniProt cross-reference to PeptideAtlas (peptides of the protein observed in a PeptideAtlas build). Not independent of PaxDb, since PaxDb's `PA_201403` dataset is a PeptideAtlas build | UniProt `xref_peptideatlas` | UniProt 2026_03 | open access, no explicit licence (cite Desiere et al. 2006) | 2,838 | 2,838 |
| STRING | partners at combined score >= 0.700 (top 40 per gene, plus a partner-count row), every evidence channel kept separately, direct vs transferred | `https://stringdb-downloads.org/download/protein.links.full.v12.0/7955.protein.links.full.v12.0.txt.gz` | v12.0 | CC BY 4.0 | ~66k | 3,540 |
| IntAct | curated zebrafish-zebrafish molecular interactions: detection method, interaction type, PMID, MI score | PSICQUIC `.../intact/webservices/current/search/query/species:7955?format=tab27` (508 records) | 2026-11-01 | CC BY 4.0 | 369 | 63 |

PRIDE Archive was queried too (`https://www.ebi.ac.uk/pride/ws/archive/v3/search/projects`). It is a **project-level
listing only**, so it has no rows: 180 projects with *Danio rerio* among their organisms. By tissue, 43 are embryo, 24
brain, 15 liver and 13 heart, and 4 are fin or tail fin (PXD013176, PXD013552, PXD050706, PXD060144). The full listing is
in MANIFEST `pride_zebrafish_projects`. The archive API does not serve per-protein identification tables, so per-protein MS
evidence comes from PaxDb. Several PaxDb datasets reprocess PRIDE submissions (PXD000479 spleen and testis, PXD010869
brain, liver and muscle, PXD014877 Z4F cell line, PXD016235 adult and juvenile cardiac ventricle, PXD030733 brain), and
those rows carry `pride_accession`.

## Kinds and evidence

- UniProt rows: `kind` is `curated` for a Swiss-Prot entry and `inferred-electronic` for a TrEMBL entry, as asked. Each
  row also keeps the per-statement ECO code in `evidence` where UniProt gives one (for example ECO:0000256 = automatic,
  ECO:0000269 = experimental). The `protein_existence` evidence is `PE1`..`PE5`. When another UniProt entry of the same gene
  has a better PE level than the canonical one, a second `protein_existence` row with that entry's accession is added.
- InterPro and Pfam: `inferred-electronic` with ECO:0000259 (signature match). For proteins the InterPro API did not
  return (see caveats), the matches come from the UniProt InterPro and Pfam cross-references. These rows have no
  positions, and the InterPro names come from InterPro `entry.list`. Each one carries a `note`.
- AlphaFold DB: `predicted`. PDB: `measured`, with the experimental method as evidence.
- PaxDb: `measured`, with evidence `MS/MS (spectral counting | NSAF | ...)` taken from the dataset description. Context:
  the dataset organ mapped to ZFA (brain ZFA:0000008, cardiac ventricle ZFA:0000009, liver ZFA:0000123, skeletal muscle
  ZFA:0005277, spleen ZFA:0000436, testis ZFA:0000598, ovary ZFA:0000403, eye ZFA:0000107, head ZFA:0001114, heart
  ZFA:0000114, pancreas ZFA:0000140, kidney ZFA:0000529, whole organism ZFA:0001094; the IDs were looked up in OLS) and
  the stage where the dataset states it (48 hpf = ZFS:0000033 Hatching:Long-pec, 120 hpf = ZFS:0000037 Larval:Day 5,
  adult ZFS:0000044). Only the non-integrated datasets give rows. PaxDb's integrated per-organ averages would only repeat them.
- STRING: `predicted`. `interaction_class` sorts each link by its strongest channel:
  `experimental (zebrafish data)` (experiments channel >= 0.4 from zebrafish data),
  `experimental (transferred from other species)`, `curated pathway database`, or
  `predicted (text-mining / co-expression / genomic context)`. All non-zero channel scores are in `channels`.
- IntAct: `curated`, with `interaction_class: experimental (zebrafish proteins, curated)` and the PSI-MI detection
  method as evidence.

## New features introduced (beyond the SCHEMA suggestions)

`protein_existence`, `protein_function`, `uniprot_entry_status`, `uniprot_annotation_score`, `uniprot_keyword`,
`membrane_topology`, `region`, `motif`, `zinc_finger`, `repeat`, `site`, `protein_family`, `homologous_superfamily`,
`coiled_coil` / `disordered` (Pfam/InterPro types), `predicted_structure`, `experimental_structure`,
`interaction_partner_count`. `protein_detected` (SCHEMA feature) is used by both PaxDb and PeptideAtlas.

## Detection coverage: protein evidence in zebrafish vs predicted only (3,860 genes)

| | genes |
|---|---|
| any UniProt entry | 3,823 |
| **MS-detected in zebrafish, PaxDb** (abundance > 0 in at least one non-integrated dataset) | **3,086 (80%)** |
| MS-detected, PeptideAtlas cross-reference | 2,838 |
| **MS-detected by either route** | **3,330 (86%)** |
| UniProt PE1 "evidence at protein level" for any of the gene's entries | 1,461 |
| both | 1,384 |
| protein-level by any route (MS, PE1 or IntAct experiment) | 3,377 |
| **only predicted, homology or transcript-level protein** (no MS, no PE1, no IntAct) | **471** |
| no UniProt protein at all | 37 |

The priority sets. "MS" means a PaxDb detection, and "MS any" adds PeptideAtlas.

| set | genes | MS | MS any | PE1 | AlphaFold | InterPro | STRING >= 0.7 | PDB |
|---|---|---|---|---|---|---|---|---|
| causal-chain genes (`genotype/causal-chains.json`) | 42 | 37 | 38 | 15 | 37 | 42 | 40 | 0 |
| fin required/sufficient genes (`genotype/fin-subtree.full.json`) | 178 | 147 | 153 | 71 | 166 | 175 | 165 | 1 |
| pectoral-fin expressed genes | 1,108 | 916 | 962 | 420 | 1,050 | 1,093 | 996 | 18 |

Five causal-chain genes have **no MS detection** in any zebrafish PaxDb dataset: fgf24, kcnk5b, ptch1, rspo2 and shha.
shha still has a PE1 entry and a PeptideAtlas cross-reference. The other four have no protein-level evidence of any kind in zebrafish. None of the 35 PaxDb datasets is fin tissue (they are whole organism, embryo, brain, heart,
liver, muscle, gonads, eye, kidney, pancreas, spleen and one fibroblast cell line). **A detection therefore says the protein
exists somewhere in the fish, not that it is in the fin.** The four fin/tail-fin PRIDE projects are listed but not
integrated.

## Caveats

- **Single-dataset detections of low-abundance regulators** (fgf10a, lef1, sox9a, tbx16 each appear in one dataset) come
  from spectral counting against the STRING/Ensembl proteome. A peptide shared between paralogues (ohnologues are
  common in zebrafish) can be assigned to either one, so read `n_datasets` before trusting a detection.
- PaxDb abundances are normalised within a dataset (ppm). Compare them within one dataset, not across datasets or
  methods.
- **InterPro API rate limit.** At 10 concurrent requests the API answered HTTP 429, so the fetch was slowed to 2
  threads. The proteins it had not reached by build time took the UniProt cross-reference fallback.
  `coverage.interpro_via_api` and `interpro_via_uniprot_xref_fallback` in MANIFEST give the final split.
- STRING experimental evidence from zebrafish itself is rare. Only 52 genes have a partner whose zebrafish experiments
  channel is >= 0.4. Most high-confidence links are transferred from other species or come from text mining and
  databases. Read `interaction_class` and `channels` before treating a partner as a zebrafish interaction.
- IntAct has only 508 zebrafish records. No row means "not curated", not "does not interact".
- **BioGRID was not used.** Its REST API needs an access key, and this repo holds no credentials.
  **ProteomeXchange** repositories other than PRIDE (MassIVE, jPOST, iProX) were not queried.
- The UniProt cross-references to PRIDE, MassIVE and jPOST are empty for every zebrafish entry. The PeptideAtlas
  cross-reference is populated for 33,679 of the 78,189 entries and is used above.

## Flying fish

UniProt has **no proteome** for any flying fish (Exocoetidae, taxon 76072). The Hirundichthys speculiger annotation
(Xu et al. 2021, GCA_018398805.1) is not in UniProtKB/TrEMBL. The family has only 25 entries, most of them cytochrome b
barcoding fragments, plus RAG2, tyrosinase, myosin light chains and COX1 from Exocoetus and Cheilopogon. 3 of these
(Exocoetus gibbosus rag2 x2, Cheilopogon pinnatibarbatus japonicus tyr) join universe genes by protein name only, with
no orthology test. They are `protein_length` rows with the flying-fish binomial as `species`. All 25 are listed in
MANIFEST `flying_fish`. The 8 focal genes with Hirundichthys protein IDs in `genes.json` (from `sequences/`) have no
public proteomic record to annotate. Their structures are covered in `structures/` and not repeated here.
