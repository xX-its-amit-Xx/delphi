# Rebuilding the ground truth

The dataset this benchmark measures against is **not in this repository**. It is derived from
copyrighted supplementary material, and the repository keeps the method and the address instead — the
same rule `DATA.md` applies to everything else that cannot be redistributed.

What *is* committed: this code, a 25-row verification fixture (sequences that are in the public zebrafish
assembly anyway, plus 25 published score values), and the derived numbers in `results.json`.

## The ground truth

**Moreno-Mateos, M.A., Vejnar, C.E., Beaudoin, J.-D., Fernandez, J.P., Mis, E.K., Khokha, M.K. &
Giraldez, A.J. (2015)** *CRISPRscan: designing highly efficient sgRNAs for CRISPR-Cas9 targeting in vivo.*
**Nature Methods 12, 982–988.** [doi:10.1038/nmeth.3543](https://doi.org/10.1038/nmeth.3543)

Three supplementary files are used. They are linked from the article page and served from
`static-content.springer.com`:

| file | what it is | used for |
|---|---|---|
| `MOESM635_ESM.xlsx` | Source Data to Fig. 4 | **the ground truth.** Sheet 1 is `id → activity_norm_mut_ct_log_ran`; sheet 2 is `id → sgrna_seq`. Joining them on the id gives **499** sgRNAs with a sequence and a measured activity. |
| `MOESM634_ESM.xlsx` | Source Data to Fig. 3 | sheet 3 holds **25** sgRNAs with the authors' own published `crisprscan_score`. This is the verification set: it is what proves the reimplementation is right. |
| `MOESM640_ESM.xlsx` | Supplementary Table 3, "Parameters of CRISPRscan model" | the **92 model coefficients**, transcribed into `crisprscan.mjs`. |

```
BASE=https://static-content.springer.com/esm/art%3A10.1038%2Fnmeth.3543/MediaObjects/41592_2015_BFnmeth3543_
curl -L -o moesm634.xlsx "${BASE}MOESM634_ESM.xlsx"
curl -L -o moesm635.xlsx "${BASE}MOESM635_ESM.xlsx"
curl -L -o moesm640.xlsx "${BASE}MOESM640_ESM.xlsx"
```

An `.xlsx` is a zip of XML, so no spreadsheet library is needed — and reading it with a few regexes
rather than a parser keeps an untrusted download away from anything that executes. The extractor used
here lived in a scratch directory; what it produces is a single JSON with three keys:

```json
{ "activity":    [ { "id": "...", "seq": "GGGG...", "activity": 0.87 } ],
  "phenotype":   [ { "gene": "albino", "seq": "GGGG...", "crisprscan_score": 0.712, "wt": 0, "mosaic": 14, "like": 23 } ],
  "coefficients": { "Intercept": 0.1839, "A04": -0.0422 } }
```

Then:

```
node benchmarks/crispr-ontarget/run.mjs --data /path/to/extracted.json
```

## The genome

Guide sequences alone are not enough: both context-dependent models need the flanking genomic sequence,
and the supplementary tables carry only the oligo. Each guide is therefore located in **GRCz11** using the
local index that `sim-engine/validate/editplan/grcz11-local.mjs` already builds for off-target scanning —
one byte per base, 1,373 Mbp, from
`ftp.ensembl.org/pub/current_fasta/danio_rerio/dna/Danio_rerio.GRCz11.dna.primary_assembly.fa.gz`.

Build it with that module's `downloadGenome()` and `buildIndex()` if `indexStatus().built` is false. A
full exact scan of the 26 chromosomes takes a few minutes per spacer-length group.

## Licence and what may be redistributed

- The **genome** is Ensembl's, freely available.
- The **supplementary tables** are the publisher's. Nothing from them beyond the model coefficients and
  25 verification values is committed, and the 499-row activity set is never written into the tree.
- The **CRISPRscan model coefficients** are reproduced here as published model parameters with full
  citation, exactly as `sim-engine/validate/editplan/doench2014.mjs` already does for Doench 2014 Rule
  Set 1. Reimplementing a published model from its published parameters is ordinary practice; passing it
  off as ours would not be, which is why the citation travels in the module and in every result.
