# omics/pathway: sources, coverage, concordance

Layer `pathway` of the DELPHI omics annotations, built 2026-11-01 by `scripts/build.py` from downloads made by
`scripts/fetch.py`. Every network call (URL, UTC time, HTTP status, bytes, SHA-256) is in `calls.json`, and raw
files are cached in `C:/Temp/omics-cache/pathway/raw` (gzip), never in the repo. Gene universe:
`omics/genes.json` (3,860 zebrafish genes, join on `zfin_id`). Rows follow `omics/SCHEMA.md`; validated with
`node omics/validate.mjs omics/pathway/annotations.jsonl.gz` (97,470 public rows, 0 invalid, 3,856 genes; plus 5,773 KEGG rows, 0 invalid, in the local-only `kegg.local.jsonl.gz`).

**Proxy species.** Every row is about a zebrafish (*Danio rerio*) gene, or about its human orthologue
(`species: "Homo sapiens"`, `kind: "borrowed-ortholog"`). Nothing here is a flying-fish measurement. No bird
(Aves) data: no source used carries bird rows, and the build exits if a bird name appears.

**Relation to `genotype/pathways.json`.** The genotype thread already built GO BP (ZFIN GAF), Reactome (lowest
level) and KEGG dre for its vetted map, and that file is left untouched. This layer downloads the same URLs again,
so it is consistent with that file (KEGG 1,982 genes and Reactome 1,654 genes in both). It adds GO MF and CC,
UniProt-GOA, Reactome at every level, WikiPathways, Pathway Commons, and the concordance view. The gene universe
was itself drawn from genes that already had a pathway in `genotype/pathways.json`, **so pathway coverage of the
universe is high by construction**. It is not a genome-wide rate.

## Sources

| source.db | what | URL | release | licence | rows | genes |
|---|---|---|---|---|---|---|
| `ZFIN` | GO annotations, all three aspects (BP, MF, CC), from the GO Consortium's ZFIN GAF | https://current.geneontology.org/annotations/zfin.gaf.gz | GAF date-generated 2026-05-21; fetched 2026-11-01 | CC BY 4.0 | 52,487 | 3,815 |
| `UniProt-GOA` | GO annotations for zebrafish UniProt entries (UniProt-GOA, the data QuickGO serves) | https://ftp.ebi.ac.uk/pub/databases/GO/goa/ZEBRAFISH/goa_zebrafish.gaf.gz | 2026-10-11 (go 2026-09-27) | CC BY 4.0 | 13,055 | 3,188 |
| `Reactome` | Danio rerio pathways at every hierarchy level (`lowest_level`, `top_level` flags) | https://reactome.org/download/current/Ensembl2Reactome_All_Levels.txt (+ Ensembl2Reactome.txt, ReactomePathways.txt, ReactomePathwaysRelation.txt) | Reactome v98 | **CC0** (reactome.org/license, section 1c: data) | 17,032 | 1,654 |
| `KEGG` | dre gene to pathway links | https://rest.kegg.jp/link/pathway/dre (+ list/pathway/dre, conv/dre/ncbi-geneid, info/dre) | fetched 2026-11-01 | **Not open.** The KEGG REST API is free for academic use only; commercial use and redistribution need a licence (Kanehisa Laboratories / Pathway Solutions). Five calls made. **Rows are local-only** (`kegg.local.jsonl.gz`, gitignored, not deployed); the public files carry only counts and KEGG pathway IDs/names. | 5,773 local (0 public) | 1,982 |
| `WikiPathways` | Danio rerio pathways (GMT) and one GPML per pathway, read for its provenance comment | https://data.wikipathways.org/20261010/gmt/wikipathways-20261010-gmt-Danio_rerio.gmt ; `.../wikipathways-assets/pathways/{WP}/{WP}.gpml` (55 calls) | 20261010 | CC0 | 1,432 | 692 |
| `PID / PANTHER / NetPath / INOH (via Pathway Commons v14)` | **human** pathways, transferred to zebrafish genes through ZFIN-curated human orthology (`human_genes` field) | https://download.baderlab.org/PathwayCommons/PC2/v14/pc-hgnc.gmt.gz | PC v14 (2024-05-21); PID final 2015, PANTHER 3.6.7, NetPath 2011, INOH 4.0 | per datasource: PID is a US-government work (public domain), PANTHER free with citation, NetPath CC BY 2.5, INOH CC BY 2.1 JP | 11,001 | 1,540 |
| `Pathway Commons v14 (SIF)` | human signalling edges (controls-state-change-of, controls-expression-of, controls-phosphorylation-of, in-complex-with), limited to genes in the key pathways below | https://download.baderlab.org/PathwayCommons/PC2/v14/pc-hgnc.sif.gz | PC v14 | as above (aggregate of many sources) | 1,378 | 622 |
| `Gene Ontology (ZFIN + UniProt-GOA)` | `key_pathway_member` rows for GO (see concordance) | as ZFIN and GOA | | CC BY 4.0 | 530 | 489 |
| `PID/PANTHER/NetPath/INOH (via Pathway Commons v14)` | `key_pathway_member` rows for the borrowed fifth source | as PC | | as PC | 555 | 396 |

Row counts for Reactome, KEGG and WikiPathways include their `key_pathway_member` rows, which carry the same `source.db` so that the integration index can count agreement.

Identifier joins use ZFIN's own downloads, fetched in the same run: `gene.txt` (ZFIN to NCBI GeneID, for KEGG and
WikiPathways), `ensembl_1_to_1.txt` (for Reactome), `uniprot.txt` (for GOA) and `human_orthos.txt` (for
Pathway Commons). Source genes with no ZFIN mapping were not used: 12,892 Reactome ENSDARG ids, 14,440 KEGG
GeneIDs (mostly unnamed loci and RNAs) and 43 WikiPathways GeneIDs.

**SIGNOR was tried and is not included.** signor.uniroma2.it refused the connection on port 443 (2026-11-01
~04:00 UTC). Pathway Commons stands in as the fifth source for signalling.

## Features and kinds

| feature | value | rows |
|---|---|---|
| `go_process`, `go_function`, `go_component` | GO term label (`go_id`, `qualifier`, `assigned_by`, `references` ≤ 8, `evidence_class`) | 32,868 / 15,747 / 16,927 |
| `pathway_member` | the source's own pathway name (`pathway_id`) | 29,053 public (+5,503 KEGG, local-only) |
| `key_pathway_member` | a canonical name for one of 8 developmental signalling pathways, one row per gene × pathway × source; `via` lists the source pathways or GO terms, `public_core_sources` / `n_public_core_sources` give the concordance over GO, Reactome and WikiPathways (KEGG rows additionally carry `core_sources_with_kegg`, local-only) | 1,497 public (+270 KEGG, local-only) |
| `signalling_edge` | `{type, human_source, human_targets, zebrafish_target_symbols}` | 1,378 |

The **GO evidence code is kept on every row** (`evidence`), with a separate `evidence_class` field:

- experimental (EXP, IDA, IPI, IMP, IGI, IEP, plus the HTP codes): `kind: curated`
- electronic (IEA): `kind: inferred-electronic`
- orthology or sequence similarity (ISO, ISS, ISA, ISM, RCA) and phylogenetic (IBA, IBD, IKR, IRD): `kind: borrowed-ortholog`
- author or curator statement (TAS, NAS, IC): `kind: curated`

ND rows and NOT-qualified rows are dropped, and the counts are in `MANIFEST.json` `coverage.go_rows_dropped`.
In the ZFIN GAF rows for the universe there are 15,123 experimental, 16,820 IEA, 16,983 IBA-class and 3,383
ISS/ISO-class rows. **GOA is mostly redundant with ZFIN:** 47,143 GOA rows with the same gene, term and
evidence code were dropped as duplicates, and so were 4,493 rows assigned by ZFIN but absent from this GAF
release. The GOA rows that remain are mostly IEA (12,580: InterPro2GO, UniProtKB-KW, Ensembl Compara and similar),
so they add very little independent evidence. QuickGO reports 473,330 annotations for taxon 7955. The GOA
species file holds 241,924, because it covers only the reference-proteome entries.

`kind` for the pathway databases:
- Reactome dre is **borrowed-ortholog** (evidence IEA). Reactome infers it electronically from curated human
  reactions through PANTHER orthology.
- KEGG dre is **borrowed-ortholog** (evidence "KO assignment"). Genes are placed on reference maps by KEGG
  Orthology assignment, and those maps are drawn mostly from non-fish literature.
- WikiPathways is **borrowed-ortholog** for the **30 of 55** pathways whose GPML carries a `HomologyConvert`
  comment (converted from a human pathway, e.g. WP1349 Wnt from human WP428 at a 75% conversion rate). The other
  25 are labelled `curated`. That label means only that no conversion comment is present, which does not prove
  the pathway was curated from zebrafish data (each pathway's flag is in the crosswalk under
  `wikipathways_provenance`).
- Pathway Commons rows are **borrowed-ortholog** with `species: "Homo sapiens"`.

## Coverage of the 3,860-gene universe

| | genes |
|---|---|
| any pathway-layer row | 3,858 |
| GO BP / MF / CC | 3,804 / 3,376 / 3,721 |
| Reactome / KEGG / WikiPathways / Pathway Commons (any `pathway_member`) | 1,654 / 1,982 / 692 / 1,540 |
| genes in 0 / 1 / 2 / 3 / 4 of the core sources (GO BP, Reactome, KEGG, WikiPathways), with KEGG | 2 / 1,257 / 1,300 / 929 / 372 |
| genes in 0 / 1 / 2 / 3 of the public core sources (GO BP, Reactome, WikiPathways), without KEGG | 15 / 1,959 / 1,467 / 419 |
| genes with any row in the public file | 3,856 (2 genes have only KEGG rows) |

## Concordance of the key developmental signalling pathways

A gene is a member for a source if it falls in any selected pathway of that source. For Reactome the all-levels
file is used, so sub-pathway members count. For GO the gene must be annotated (NOT excluded) to the root term or
a descendant through is_a, part_of or (positively/negatively) regulates. Regulators are included because KEGG and
Reactome include them. The four core sources are GO, Reactome, KEGG and WikiPathways. Pathway Commons is a
borrowed fifth. Counts are universe genes.

| pathway | selected (GO; KEGG; Reactome; WikiPathways) | members: GO (exp) / Reactome / KEGG / WP / PC | **with KEGG**: genes in 0* / 1 / 2 / 3 / 4 core sources | **without KEGG** (public): genes in 0* / 1 / 2 / 3 sources | genes in all 3 public sources (GO, Reactome, WP) |
|---|---|---|---|---|---|
| Wnt | GO:0016055; dre04310; R-DRE-195721; WP1349, WP215, WP1344, WP4021, WP4231 | 157 (86) / 83 / 111 / 116 / 182 | 82 / 174 / 43 / 33 / 27 (all 4: 27) | 108 / 173 / 51 / 27 | apc, axin1, axin2, ctnnb1, dvl2, fzd2, fzd5, fzd6, fzd7a, fzd8a, lef1, lrp5, lrp6, tcf7l1a, vangl1, vangl2, wnt10a, wnt16, wnt2, wnt2bb, wnt3a, wnt4, wnt5a, wnt5b, wnt7aa, wnt8b, wnt9b |
| Fgf | GO:0008543; **no KEGG dre Fgf map** (FGFs sit in dre04010 MAPK); R-DRE-190236; WP152, WP4021 | 53 (28) / 29 / 0 / 58 / 76 | 42 / 78 / 16 / 10 / 0 (all 4: 0) | 42 / 78 / 16 / 10 | fgf10a, fgf16, fgf17, fgf23, fgf3, fgf4, fgf8a, fgfr1a, fgfr2, fgfr3 |
| Hedgehog (Shh) | GO:0007224 (smoothened signalling); dre04340; R-DRE-5358351; **none in WP dre** | 48 (37) / 36 / 33 / 0 / 52 | 23 / 55 / 13 / 12 / 0 (all 4: 0) | 33 / 56 / 14 / 0 | none possible (no WP dre pathway) |
| Bmp / TGF-beta | GO:0030509; dre04350 (TGF-beta, includes BMP); R-DRE-201451; WP211 | 81 (54) / 16 / 77 / 40 / 52 | 16 / 99 / 27 / 11 / 7 (all 4: 7) | 53 / 84 / 16 / 7 | bmp2b, bmpr1aa, bmpr1ba, bmpr2b, nog3, smad1, smad5 |
| Notch | GO:0007219; dre04330; R-DRE-157118; none in WP dre | 65 (51) / 6 / 40 / 0 / 98 | 63 / 64 / 19 / 3 / 0 (all 4: 0) | 81 / 65 / 3 / 0 | none possible (no WP dre pathway) |
| Retinoic acid | GO:0048384 + GO:0042573; dre00830 (retinol metabolism); R-DRE-5362517 + R-DRE-5365859; none | 32 (18) / 20 / 9 / 0 / 59 | 51 / 28 / 9 / 5 / 0 (all 4: 0) | 52 / 30 / 11 / 0 | none possible (no WP dre pathway) |
| Bioelectric / K+ channel (kcnk5b) | GO:0042391 + GO:0071805; no KEGG map; R-DRE-1296071 Potassium Channels; none | 91 (26) / 8 / 0 / 0 / 0 | 0 / 85 / 7 / 0 / 0 (all 4: 0) | 0 / 85 / 7 / 0 | none possible (no WP dre pathway) |
| Calcineurin-NFAT | GO:0033173 + GO:0097720; no KEGG map; R-DRE-2025928; none | 3 (1) / 0 / 0 / 0 / 36 | 35 / 3 / 0 / 0 / 0 (all 4: 0) | 35 / 3 / 0 / 0 | none possible (no WP dre pathway) |

\* "0 core sources" means the gene is a member only through the borrowed human Pathway Commons source (without KEGG, it also includes genes whose only core membership was KEGG). The with-KEGG figures are computed locally from `kegg.local.jsonl.gz` and published as counts only.

What this shows:
1. **Agreement across sources is low even for canonical pathways.** For Wnt, 174 universe members are in exactly
   one core source and only 27 are in all four, and those 27 are the textbook core (ligands, Frizzleds, Lrp5/6,
   Axin, Apc, β-catenin, Lef/Tcf, PCP Vangl). Genome-wide pairwise Jaccard for Wnt is 0.12 to 0.28 (KEGG~WP 0.28,
   GO~KEGG 0.26, KEGG~Reactome 0.19). For Bmp/TGF-beta it is 0.08 to 0.24, and for Notch GO~KEGG is 0.27 while
   Reactome~anything is ≤ 0.08.
   **Without KEGG** (the public view), the same 27 Wnt genes and 7 Bmp genes are in all three public sources, and
   so are 10 Fgf genes (fgf3, fgf4, fgf8a, fgf10a, fgf16, fgf17, fgf23, fgfr1a, fgfr2, fgfr3). Dropping KEGG mainly
   moves genes from "2 sources" to "1" or "0": Bmp genes in 0 public core sources rise from 16 to 53, and Notch genes
   in ≥ 2 sources fall from 22 to 3.
2. **Coverage is uneven.** KEGG dre has no Fgf, bioelectric or calcineurin map, and WikiPathways dre has no
   Hedgehog, Notch, RA, potassium-channel or calcineurin pathway. So for six of the eight pathways no gene can
   reach four sources.
3. **Reactome dre is small for developmental signalling** (Notch 6, Bmp 16 universe genes). Its large pathways also
   pull in shared machinery: the best KEGG match for Reactome "Signaling by Hedgehog" is dre03050 *Proteasome*
   (J 0.27), because Reactome includes proteasome subunits in its Hh, Notch and Wnt degradation events.
4. **For bioelectric (kcnk5b) and calcineurin signalling, GO is effectively the only fish-level source.** kcnk5b
   itself is in it with experimental evidence: ZFIN IDA for regulation of membrane potential, and IMP for fin
   development, fin morphogenesis and fin regeneration.
5. **The sources are not independent.** Reactome dre is wholly orthology-inferred, KEGG assigns by KO, 30 of 55
   WP dre pathways are homology-converted from human, and GO IBA rows are phylogenetic transfers. Agreement among
   them partly reflects shared human-derived annotation. GO experimental membership (the number in parentheses) is
   the one strand of zebrafish-specific evidence.

## Pathway crosswalk (`pathway-crosswalk.json`)

For every KEGG and WikiPathways pathway, and for every Reactome top-level pathway plus its direct children with
≥ 10 genes, the file lists the top 3 matches in each other source (GO BP terms with 5 to 1,500 genes included).
Matches are ranked by gene-set Jaccard over all ZFIN genes, with ties broken by name-token overlap, and only
J ≥ 0.05 is kept. `mutual_best` lists 56 pairs that are each other's best Jaccard match. Examples:

| a | b | Jaccard | name overlap |
|---|---|---|---|
| KEGG dre03320 PPAR signaling | WP4020 PPAR signaling | 0.62 | 1.0 |
| KEGG dre00020 Citrate cycle | WP19 TCA cycle | 0.58 | 0.67 |
| KEGG dre04620 Toll-like receptor signaling | WP1384 Toll like receptor signaling | 0.56 | 1.0 |
| KEGG dre03430 Mismatch repair | R-DRE-5358508 Mismatch Repair | 0.55 | 1.0 |
| KEGG dre04010 MAPK signaling | WP1337 MAPK signaling | 0.47 | 1.0 |
| KEGG dre04310 Wnt signaling | WP215 Non canonical Wnt | 0.23 | 0.33 |
| KEGG dre04310 Wnt signaling | R-DRE-195721 Signaling by WNT | 0.19 | 1.0 |
| KEGG dre04350 TGF-beta signaling | R-DRE-9006936 Signaling by TGFB family members | 0.17 | 0.0 |

Equivalences for the developmental pathways (best match per source, Jaccard):

- **Wnt:** KEGG dre04310 ↔ Reactome R-DRE-195721 (0.19), ↔ GO:0060070 canonical Wnt (0.27), ↔ NetPath Wnt
  (0.28), ↔ WP215 non-canonical Wnt (0.23). WP1349 "Wnt signaling pathway" matches KEGG *Melanogenesis* best
  (0.17, a Wnt-containing map), so name and gene overlap disagree there.
- **Hedgehog:** KEGG dre04340 ↔ R-DRE-5358351 (0.17) ↔ GO:0007224 smoothened signalling (0.22) ↔ PID Hedgehog (0.29).
- **Bmp/TGF-beta:** WP211 BMP ↔ R-DRE-201451 Signaling by BMP (0.17) ↔ GO:0030509 (0.16) ↔ PID BMP receptor
  signalling (0.21). KEGG dre04350 matches Reactome's broader R-DRE-9006936 (0.17).
- **Notch:** KEGG dre04330 ↔ GO:0007219 (0.27) ↔ NetPath Notch (0.30). Reactome R-DRE-157118 matches nothing
  above 0.08.
- **Fgf:** WP152 ↔ GO:0008543 (0.18) ↔ INOH FGF signalling (0.18). KEGG's nearest is dre04010 MAPK (0.11).

## Caveats

- Absence of a row means "not recorded", never "not in the pathway".
- **KEGG is local-only.** KEGG gene-to-pathway data are free for academic use only and not redistributable. The 5,773
  KEGG rows are written to `omics/pathway/kegg.local.jsonl.gz`, matched by the repo `.gitignore` line
  `omics/**/*.local.jsonl.gz` and kept out of the deployed bundle. The public `annotations.jsonl.gz` has zero KEGG
  rows. MANIFEST, this file and the crosswalk cite KEGG only as pathway IDs and names, with gene counts and Jaccard
  overlaps. `MANIFEST.json` `kegg_local_only` gives the local file's row count and SHA-256, and `scripts/build.py`
  rebuilds it from the cached downloads.
- Paralogs: Pathway Commons rows reach every zebrafish paralog that ZFIN lists as an orthologue of the human
  gene, so a borrowed membership does not say which paralog carries the function.
- The `signalling_edge` rows are human interactions restricted to key-pathway genes, not zebrafish measurements.
