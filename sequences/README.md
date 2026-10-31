# sequences/: sequence comparison layer

Protein sequences, alignments and derived genome tables comparing the flying fish with other gliding and flying animals,
for the focal fin genes of `genotype/causal-chains.json` and `genotype/interventions.json`.

Birds (class Aves) are this project's frozen holdout: no bird sequence, assembly or annotation was fetched, and birds are excluded from every file here until the holdout exam runs.

Pterosaurs are extinct (Mesozoic) and left no DNA, so no sequence comparison is possible for them. Their only comparison is morphological (`physics/flier/PRIOR-ART-FLIER.md`).

## Files

| file | what it holds |
|---|---|
| `genes.json` | The 9 focal genes (kcnk5b, kcnh2a, slc43a2a/lat4a, gja1b/cx43, tbx5a, fgf10a, shha, hhip, prdm1a): orthologue IDs, protein sequences, identity to zebrafish, flying-fish status, glider panel |
| `alignments/<gene>.json` | MAFFT alignment per gene, percent-identity matrix, known variant sites mapped to every species, beloniform exon rows; `slc43a2a.json` has the `key_test_lat4a_site` |
| `genome-regions.json` | "Which parts of the genome": derived tables from Daane 2021 Data S1 sheets G, H, I, J, K-N (sheet and row cited), CNE counts near focal genes, and bat-wing regulatory regions from Europe PMC |
| `engineered-diff.json` | The winged zebrafish and the hypothetical flier as diffs against the zebrafish reference, with before/after protein identity and natural divergence for context |
| `gliders.json` | Glider panel (sugar glider, colugos, parachute gecko and non-gliding relatives): same residues or not? |
| `progression.json`, `PROGRESSION.md` | Fin length / SL ladder across the beloniform series beside the per-species residue state at the Daane 2021 convergent sites |
| `calls.json` | Every network call (583), with purpose and status |
| `scripts/` | Everything that built these files (run order below) |

## Coverage and identity to zebrafish (%, from the MAFFT alignments)

| gene | medaka | flying fish (H. speculiger) | Myotis | Pteropus | Rhinolophus | mouse | human | Drosophila | sugar glider | brushtail possum | colugo (G.v.) | colugo (C.v.) | beloniform exon rows |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kcnk5b | 56 | 56 | 48 | 49 | 48 | 48 | 49 | 26 | 50 | 50 | - | 49 | 13 |
| kcnh2a | - | 80 (tblastn) | 63 | 60 | 65 | 64 | 65 | 52 | 64 | 65 | 68 | 64 | 0 |
| slc43a2a | 82 | 82 | 77 | 78 | 78 | 77 | 78 | - | 76 | 77 | 77 | 77 | 35 |
| gja1b | 90 | 91 | 80 | - | 81 | 81 | 80 | - | 80 | 80 | 80 | 80 | 25 |
| tbx5a | 84 | 84 | 76 | 72 | 75 | 75 | 75 | 36 | 74 | 74 | 76 | 76 | 35 |
| fgf10a | 59 | 70 | 56 | 58 | 58 | 58 | 57 | - | 59 | 59 | 57 | 57 | 1 |
| shha | 77 | 74 (tblastn) | 84 (82-aa fragment) | 66 | 72 | 71 | 72 | - | 56 | 71 | - | 73 | 35 |
| hhip | 79 | 78 | 66 | 67 | 68 | 67 | 68 | - | 67 | - | 68 | 68 | 35 |
| prdm1a | 64 | 64 | 61 | 62 | 61 | 60 | 60 | 37 | 60 | 60 | 60 | 60 | 31 |

"-" = no orthologue returned by Ensembl / NCBI for that species. Reptile and frog controls are in `genes.json` and the alignments.
Drosophila: Ensembl calls orthologues only for kcnk5b, kcnh2a, tbx5a and prdm1a, all distant and many-to-many; there is none for gja1b (insects use innexins), slc43a2a, fgf10a, shha or hhip. Insect wings are not homologous to fins or limbs.

## Headline results

- **Bats at the lat4a convergent site.** At medaka Lat4a F326, where flying fishes and both gliding-halfbeak lineages carry L (Daane 2021 sheet G row 2), all three bats carry **F** (Myotis residue 318, Pteropus 320, Rhinolophus 313 of their own proteins), as do mouse, human, zebrafish, medaka, the sugar glider, both colugos, the squirrel, lizard, gecko, snake and frog. The fish convergence does not extend to bats or to any mammalian glider. The annotated H. speculiger protein carries L, and re-reading Daane's captured exons gives L in 8 of 9 flying fishes (F in Parexocoetus brachypterus, the exception the paper reports) and both gliding halfbeaks, and F in all 24 non-gliders (I in the saury).
- **Gliders do not converge at these genes.** 11 alignment columns show a glider residue shared across lineages and absent from the lineage's non-gliding relative, against 17 for the role-swapped baseline; most of the 11 pair colugos with bats, which share a human control. Mean cross-lineage identity is the same for glider-glider and glider-nonglider pairs: identity follows ancestry, not gliding. The genes were picked from fin biology, so this says nothing about the rest of the genome.
- **Engineered genome.** The winged zebrafish is 2 edited loci (lat4a T200K, 1 amino acid; kcnh2a longfin inversion, 0 amino acids, regulatory) against the reference. Its slc43a2a identity drops from 100% to 99.82% against the unedited protein, and by 0.18 points against every species. In just 37 causal-chain proteins, zebrafish and medaka differ by 7,300 amino-acid substitutions, and zebrafish and human by 10,765 (median orthologue identity 79.2% and 72.5%). See `engineered-diff.json`.
- **Regions.** Daane 2021 lists 44 convergent coding substitution rows (2 in fin-annotated genes: lat4a, gja5a), 76 fin/limb genes with flying-fish-branch phyloP signal (38 accelerated, 38 conserved), and accelerated non-coding elements enriched in 455 GO terms (flying fishes) and 582 (halfbeaks). Every bat entry fetched from the literature is regulatory (Prx1 enhancer, HoxD BAR116, 2,796 bat-accelerated regions, interdigital Fgf8/Gremlin, MEIS2/TBX3, PBX1 regulatory domains). Saying "the genes that code for wings" is a simplification: these regions are associated with wing or fin proportion, and most of them are regulatory.

## Methods and versions

- **Orthologues:** Ensembl REST release 116, `/homology/id/danio_rerio/<gene>` with `type=orthologues;sequence=protein;aligned=0`, restricted to target species medaka, Myotis lucifugus, Pteropus vampyrus, Rhinolophus ferrumequinum, mouse, human and Drosophila melanogaster. When there are several candidates, the one with the highest mean of source and target percent identity is kept. The same call was made for all 43 causal-chain genes; that wider set is used only as divergence context. fgf24, rerea and ric1 returned no orthologues in these species.
- **Flying fish:** NCBI holds GCA_018398805.1 (H. speculiger, scaffold level) without annotation. The annotated protein set for the same assembly (Xu et al. 2021, Front Genet 12:695700; figshare 10.6084/m9.figshare.14600634.v1, `pep.fa`, 13 MB, 23,611 proteins) was used. Orthology was called by reciprocal best blastp hit (BLAST+ 2.17.0) against the Ensembl 116 zebrafish proteome. That succeeded for 7 genes. kcnh2a (whose hit was reciprocal to kcnh7a) and shha (reciprocal to shhb) failed, so for those two the alignment carries tblastn hits of the medaka protein (zebrafish for kcnh2a, which has no medaka orthologue in Ensembl) on the downloaded assembly, labelled as projections. Caveats: H. speculiger is not one of the species Daane 2021 measured for fin length; its "functional annotation" is automated BLAST/InterPro hits, not curation. Medaka (Beloniformes) stays in every alignment as the closest Ensembl-annotated relative.
- **Beloniform exon rows:** Daane 2021 Zenodo `translated_exons.tar.gz` (10.5281/zenodo.5082978, record 5082979; 35 species). The medaka protein was blastp'd against all captured exons. Hits at 75% identity or more were placed on medaka coordinates, keeping the best hit per region. A row was dropped when it covered less than 30% of the protein, or when its identity to medaka sat more than 8 points from the beloniform median (likely a teleost a/b paralogue); the dropped rows and reasons are listed in each alignment file.
- **Glider panel:** NCBI E-utilities, longest RefSeq isoform found by gene-symbol search for the sugar glider (GCF_028583685.1), brushtail possum, both colugos, red squirrel, Anolis, Gekko japonicus, Thamnophis and Xenopus. For Gekko kuhli (parachute gecko, syn. Ptychozoon kuhli) GenBank records were used. No usable protein data exist for flying squirrels (Glaucomys, Pteromys: unannotated assemblies), Petaurista (no assembly), Draco and Chrysopelea (unannotated assemblies), or gliding frogs (no assembly). That absence is recorded in `gliders.json`.
- **Alignment:** MAFFT v7.526 (2024/Apr/26), L-INS-i (`--localpair --maxiterate 1000`). Percent identity = identical / aligned residue pairs, with gaps and X excluded. Divergence context uses a Biopython 1.88 global pairwise alignment (BLOSUM62, gap open -10, extend -0.5).
- **Coordinates:** residues are 1-based in each species' own protein (the IDs are in the files). Zebrafish variant positions (kcnk5b W169L, F241Y, I290A, S345A; gja1b F30V, W78L, G138D, T154A, P191S, F209I; kcnh2a Y418*, Y669N, L739Q; hhip Y285*, Y295*, H215fs, F242fs; lat4a T200K) all match the reference residue in the Ensembl 116 zebrafish protein, except prdm1a m805 W154*, where the canonical protein has M at 154. That allele's numbering refers to another isoform or annotation, so it is reported but not mapped reliably. The Daane 2021 substitutions are numbered on the medaka protein: F326 was confirmed in the current medaka Lat4a (ENSORLG00000009715), and 40 of 44 sheet-G reference residues still match.
- **Literature:** Europe PMC REST searches (queries in `calls.json`). Bat entries paraphrase only the fetched abstracts.

## Limits that matter

- Daane 2021 Data S1 gives no count of accelerated non-coding elements. The "# CNEs" column in sheets K-N is a per-GO-term total: the 118 terms shared by K and M have identical counts. So no like-for-like count of non-coding against coding changes was made.
- Fin/SL exists for 9 measured beloniform species. The progression is a ladder to read, not a statistical test (see `PROGRESSION.md`).
- `genotype/causal-chains.json` grades slc43a2a at "mechanism". Whatever the grade, residue tracking across species is not causation.

## Rebuild (scratch and caches on C:\Temp\sequences, not committed)

```
cd sequences/scripts
python fetch_orthologs.py && python select.py
python fetch_sheetG.py && python fetch_gliders.py
python flyingfish_tblastn.py kcnk5b kcnh2a slc43a2a gja1b tbx5a fgf10a shha hhip prdm1a
python flyingfish_rbh.py && python daane_exons.py focal && python daane_exons.py sheetG
python build_alignments.py && python build_gliders.py && python build_engineered.py
python build_regions.py && python build_bats.py && python build_progression.py
```

The tools (MAFFT, BLAST+) and the downloaded genome, exons and proteomes live under `C:\Temp\sequences\` (tools/, ffgenome/, zenodo/, figshare/, ensembl_ftp/). None of the raw downloads are redistributed here.
