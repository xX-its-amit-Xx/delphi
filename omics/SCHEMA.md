# omics/: row format and file layout (every layer uses this)

Owner of this file: the omics integration agent. Layers: `genomic`, `transcriptomic`, `proteomic`, `pathway`, `ptm`.
Validator: `node omics/validate.mjs omics/<layer>/annotations.jsonl.gz` (all layers run it before they report done).

## Gene universe

`omics/genes.json` lists every gene in scope (3,860 zebrafish genes: `genotype/pathways.json` genes plus the
causal-chain and intervention genes) with its cross-references: `symbol, zfin_id, ensembl_gene (GRCz11),
ncbi_gene, uniprot (reviewed first, else TrEMBL), uniprot_status, human_ortholog {symbol, hgnc_id, ncbi, uniprot},
flying_fish` and a `source` map naming which download gave each ID. **`zfin_id` is the join key.**
Annotate only genes in the universe (rows for other genes are allowed but the index ignores them).

## Row format: JSONL, one row per (gene, feature, source)

```json
{
  "gene": {"symbol": "kcnk5b", "zfin_id": "ZDB-GENE-040426-1297", "ensembl_gene": "ENSDARG00000012390", "uniprot": "A0A8M1PBI1"},
  "species": "Danio rerio",
  "layer": "genomic",
  "feature": "allele_phenotype",
  "value": "pectoral fin increased size",
  "unit": null,
  "context": {
    "anatomy": {"id": "ZFA:0001161", "label": "pectoral fin", "uberon": "UBERON:0000151"},
    "stage": {"id": "ZFS:0000044", "label": "Adult"},
    "cell_type": null,
    "condition": "standard"
  },
  "source": {"db": "ZFIN", "release_or_date": "2026-10-31", "url": "https://zfin.org/downloads/phenoGeneCleanData_fish.txt",
             "accession": "ZDB-ALT-...", "licence": "CC BY 4.0"},
  "kind": "curated",
  "evidence": "ECO:0000315",
  "concordance": null
}
```

| field | required | rule |
|---|---|---|
| `gene` | yes | object; `zfin_id` required for zebrafish rows (copy all four IDs from `genes.json`); `symbol` always |
| `species` | yes | binomial, e.g. `Danio rerio`, `Oryzias latipes`, `Homo sapiens` (borrowed), `Hirundichthys speculiger`. **Never a bird** (any Aves taxon) |
| `layer` | yes | one of `genomic`, `transcriptomic`, `proteomic`, `pathway`, `ptm`; must match the folder |
| `feature` | yes | snake_case controlled-ish verb/noun. Use the list below when one fits; new ones allowed, list them in your SOURCES.md |
| `value` | yes | string, number, boolean, or small object/array (keep under ~2 KB). The thing itself: a term label, a count, a TPM, a residue |
| `unit` | yes (may be null) | e.g. `TPM`, `bp`, `count`, `log2FC`, `aa` |
| `context` | yes | object with keys `anatomy`, `stage`, `cell_type`, `condition` (each may be null). Ontology objects are `{id, label}`; `id` a CURIE (`ZFA:`, `UBERON:`, `ZFS:`, `CL:`). Add `uberon` on anatomy when you know the crosswalk |
| `source` | yes | `{db, release_or_date, url, accession, licence}`; `db` and `url` non-empty; `accession` = the record id in that db (may be null) |
| `kind` | yes | `measured` (an experiment's number), `curated` (a curator read a paper), `inferred-electronic` (IEA, pipelines), `predicted` (in-silico model, e.g. AlphaFold, NetPhos), `borrowed-ortholog` (annotation of the human/mouse orthologue, not of the fish gene) |
| `evidence` | yes (may be null) | ECO id, GO evidence code (`IMP`, `IDA`, `IEA`...), or a short method name (`RNA-seq`, `MS/MS`, `in situ`) |
| `concordance` | no | leave `null`; filled only by `omics/build-index.mjs` |

Extra fields are allowed (e.g. `score`, `n_samples`, `pmid`) and are carried through into the cards.

### Suggested features per layer

- genomic: `gene_location`, `biotype`, `transcript_count`, `paralog`, `alias`, `summary`, `allele`, `allele_phenotype`,
  `human_disease_model` (borrowed), `ortholog`
- transcriptomic: `expressed_in`, `expression_level`, `cell_type_marker`, `not_expressed_in`, `differential_expression`
- proteomic: `protein_detected`, `protein_abundance`, `domain`, `structure`, `subcellular_location`, `protein_length`, `interacts_with`
- pathway: `pathway_member`, `go_process`, `go_function`, `go_component`, `reaction`
- ptm: `phospho_site`, `glyco_site`, `ubiquitin_site`, `acetyl_site`, `ptm_site` (value = `{residue, position, modification}`)

### Concordance (integration only)

`omics/build-index.mjs` groups rows by `(zfin_id, layer, feature, normalised value[, anatomy id])` and sets
`concordance = {n_sources, sources:[db...], agree: true|false, conflicts:[...]}`. Independent sources = distinct `source.db`.
So: use the database's own name in `source.db` (e.g. `ZFIN`, `Bgee`, `Ensembl`, `UniProt`, `Reactome`, `KEGG`,
`PhosphoSitePlus`, `EPD`) rather than an aggregator's name, unless the aggregator is what you fetched (then name both:
`"db": "Alliance (from ZFIN)"`). For anatomy features use ontology IDs in `context.anatomy.id` so values match across sources.

## File layout per layer

```
omics/<layer>/annotations.jsonl.gz   gzip, one JSON row per line
omics/<layer>/SOURCES.md             each source: what, URL, release/date, licence, rows, genes covered, caveats
omics/<layer>/MANIFEST.json          {layer, built, rows, genes_covered, by_source:{db:{rows, genes}}, by_feature:{f:rows},
                                      files:{name:{bytes, sha256}}, retrievals:[{url, date, sha256?}], status:"done"|"partial"}
omics/<layer>/scripts/               the code that built it (optional but preferred)
```

`MANIFEST.json` with `"status":"done"` is the signal that integration polls for.

## Rules for all layers

- Cache downloads under `C:/Temp/omics-cache/<layer>/`, never in the repo. Compress outputs; no raw dumps. Aim for
  under ~20 MB per `annotations.jsonl.gz`.
- Polite rate limits (Ensembl REST ≤ 15 req/s, NCBI eutils ≤ 3 req/s without key, UniProt streams not loops).
- Record each source's licence. Note any restriction (e.g. KEGG, PhosphoSitePlus are not open; record and say so).
- **No Aves (bird) data anywhere** — frozen holdout. Drop bird orthologues and bird-derived annotations explicitly.
- No credentials in files. Do not commit or deploy.
- Absence of a row means "not recorded", never "not expressed / not present", unless the source asserts absence
  (then use a negative feature such as `not_expressed_in`).
