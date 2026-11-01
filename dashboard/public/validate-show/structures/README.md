# validate-show/structures — the molecular data pack

Built by `build_pack.py` in this folder, from repo data only (`omics/proteomic`, `omics/ptm`,
`omics/index`, `structures/`, `genotype/`) plus coordinate files fetched from AlphaFold DB.
Served to `../molecular.js`, which is the only consumer. Nothing outside this folder is written.

```
python dashboard/public/validate-show/structures/build_pack.py          # rebuild
python dashboard/public/validate-show/structures/build_pack.py --no-fetch   # cache only
```

## What is here

| path | what |
|---|---|
| `index.json` | manifest: 181 genes with per-gene flags and gap ids, the anatomical-part → gene index, the experimental-entry list, and the global honesty counters |
| `g/<symbol>.json.gz` | one card per gene: AlphaFold CA coordinates + per-residue pLDDT, domains with positions, our own variant placements and their measured distances, modification sites with conservation, interaction partners split by evidence class, MS detection, and the gene's own list of gaps with reasons |
| `exp/<PDBID>.json.gz` | CA coordinates of the experimental complexes this project measured interfaces on, one file per entry |

**Decimation.** Everything is CA-only — one atom per residue, no side chains, no hydrogens, no
waters. Coordinates are rounded to 0.1 Å and pLDDT to 0.1. The experimental files come from
`structures/chains/*.pdb.gz`, which upstream had already dropped hydrogens, waters and alternate
conformations and kept only the chains that make the reported interface; this build drops
everything but CA and the HETATM centroid of each ligand. Full models stay at the AlphaFold DB
and RCSB URLs recorded in every card. Total committed size is about 2.6 MB.

**Gene universe (181).** The union of: the 42 genes on a sourced causal chain
(`genotype/causal-chains.json`), every gene named by a sourced intervention
(`genotype/interventions.json`), and every gene recorded as *required for* or *sufficient for* a
fin structure (`genotype/fin-subtree.full.json`). No gene list is hardcoded in `molecular.js`;
it reads whichever of these the run names.

**Accession choice.** Three layers of this repo pick different UniProt entries for the same gene.
The order used is: the entry our own variant placement used
(`structures/variants/variants.json`), then `structures/models.json`, then the AlphaFold DB row
in `omics/proteomic`. When they disagree the card carries `structure.source_choice.disagreement`
listing every candidate with its length, and `molecular.js` renders that disagreement as a gap —
because two layers modelling different proteins under one gene symbol is exactly the kind of
silent error that produces a clean-looking false result.

**No Aves.** Class Aves is the project's frozen holdout. Every row whose `species` matches
`/Aves|bird/i` is dropped at build time (0 matched, since the upstream layers had already
excluded them), and no bird protein, structure or interaction is in this pack.

## The numbers the pack exists to make visible

* **169 of 181 genes have an AlphaFold model; 12 have none.**
* **23 genes have no protein-level evidence of any kind** — no mass-spec detection, no UniProt
  PE1, no curated experiment. The protein is inferred from the gene and has never been seen.
* **14 genes have no interaction partner at all** above the STRING 0.700 cut.
* Of **3,283 interaction edges** in the pack: **2 curated zebrafish experiments** (IntAct) and
  **2 STRING edges whose zebrafish experiments channel reaches 0.4**. The other 3,279 are
  **955 experiments transferred from another species**, **1,382 pathway-database assertions** and
  **942 text-mining / co-expression predictions**. `molecular.js` draws each class differently and
  labels it; a network drawn without that distinction would be the most misleading picture in
  this project.
* **No PaxDb zebrafish dataset is fin tissue**, so no abundance number here is a fin measurement.
* **UniProt has no flying-fish proteome** (25 entries in all of Exocoetidae, mostly cytochrome b
  barcoding fragments), so there is no structure, interaction or modification of the designed
  organism's own proteins anywhere in this pack.

Licences travel with the data: AlphaFold DB and UniProt CC BY 4.0, InterPro/Pfam/PDB CC0,
PaxDb CC BY 4.0, STRING CC BY 4.0, IntAct CC BY 4.0. Every card names its sources per row.
