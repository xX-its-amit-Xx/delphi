# Progression: fin proportion and coding-site state across the beloniform series

Built by `sequences/scripts/build_progression.py`; data in `progression.json`.

## Read this first

- A LADDER TO READ, NOT A TEST. Four groups (needlefish/saury, halfbeak, gliding halfbeak, flying fish) is far too few for any statistical claim. No correlation between residue state and fin ratio is computed: species share ancestry, so a cross-species correlation needs phylogenetic correction, and with four groups that correction cannot be done meaningfully.
- THE NON-GLIDERS SCORE ZERO BY CONSTRUCTION. Sheet G lists only substitutions shared by gliders and ABSENT from outgroups, so non-gliding species carry the ancestral residue at these sites by definition; the zero is circular and is not a finding. The informative part of the ladder is among gliders: gliding halfbeaks (fin/SL about 0.27) carry about as many of these derived states as flying fishes (about 0.69), so derived-state count does not scale with fin length.
- TRACKING IS NOT CAUSING. A residue that changes along with fin length across the series is consistent with involvement and is not evidence of causation. Our own causal chains grade slc43a2a (lat4a) at "mechanism".
- A SLICE, NOT THE SYSTEM. Development means many genes are involved. The project gene map holds 4571 genes (genotype/pathways.slim.json, coverage.all_genes_in_vetted_map), 982 of them with expression records on the pectoral fin alone (genotype/README.md), and most between-species difference is regulatory rather than coding. Daane 2021 captured 105275 conserved non-coding elements (Zenodo medaka_cne_great.txt) alongside the coding exons, and reports accelerated non-coding evolution enriched in 455 GO terms on the flying-fish branch (sheet K) and 582 on the halfbeak branch (sheet M), against 44 convergent coding substitution rows (sheet G). The number of accelerated elements itself is NOT in Data S1 (the "# CNEs" column is a per-term total: the 118 terms shared by sheets K and M carry identical counts), so no like-for-like count of non-coding versus coding changes can be given from the local data. This short coding ladder is labelled as a slice through a much larger system, never as "the genes for wings".

Birds are excluded from this file until the holdout exam runs.

## The ladder by group

| group (phylogenetic order) | species sequenced | pectoral fin / SL, group median (specimens) | lat4a site 326 residues | derived states at 38 sheet-G sites, mean (range) |
|---|---|---|---|---|
| needlefish or saury (non-gliding) | 12 | 0.088 (19) | F: 11, I: 1 | 0 (0-0) |
| halfbeak (non-gliding) | 12 | 0.14 (22) | F: 12 | 0 (0-0) |
| flying (gliding) halfbeak | 2 | 0.274 (19) | L: 2 | 24 (23-25) |
| flying fish (Exocoetidae) | 9 | 0.687 (49) | F: 1, L: 8 | 21.4 (17-24) |

The lat4a/slc43a2a site (medaka F326; Daane 2021 sheet G row 2) is the anchor: L in both gliding halfbeaks and in most flying fishes, F in every non-gliding species, read here directly from the captured exons. It is the only sheet-G gene that is also in our causal chains.

## Species rows

| species | group | pectoral fin / SL (basis) | lat4a F326L | gja5a G329V | derived / ancestral / other / not captured (of 38) |
|---|---|---|---|---|---|
| Xenentodon cancila | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 25 / 5 / 8 |
| Tylosurus crocodilus | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 22 / 5 / 11 |
| Ablennes hians | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 24 / 6 / 8 |
| Belone belone | needlefish or saury (non-gliding) | 0.079 (this species, Daane 2021 sheet A) | F | . | 0 / 24 / 6 / 8 |
| Cololabis saira | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | I | . | 0 / 20 / 9 / 9 |
| Strongylura notata | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 24 / 6 / 8 |
| Belonion dibranchodon | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 23 / 7 / 8 |
| Potamorrhaphis guianensis | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 25 / 6 / 7 |
| Strongylura fluviatilis | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 23 / 6 / 9 |
| Strongylura marina | needlefish or saury (non-gliding) | 0.094 (this species, Daane 2021 sheet A) | F | . | 0 / 25 / 6 / 7 |
| Strongylura hubbsi | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 24 / 6 / 8 |
| Pseudotylosurus angusticeps | needlefish or saury (non-gliding) | 0.088 (group median (needlefish), species not measured) | F | . | 0 / 24 / 7 / 7 |
| Rhynchorhamphus georgii | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 24 / 7 / 7 |
| Hemiramphus far | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 24 / 7 / 7 |
| Hemiramphus brasiliensis | halfbeak (non-gliding) | 0.145 (this species, Daane 2021 sheet A) | F | . | 0 / 23 / 7 / 8 |
| Melapedalion breve | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 26 / 5 / 7 |
| Hyporhamphus quoyi | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 28 / 5 / 5 |
| Arrhamphus sclerolepis | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 25 / 5 / 8 |
| Chriodorus atherinoides | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 25 / 6 / 7 |
| Hyporhamphus brederi | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 25 / 5 / 8 |
| Hyporhamphus unifasciatus | halfbeak (non-gliding) | 0.137 (this species, Daane 2021 sheet A) | F | . | 0 / 27 / 4 / 7 |
| Hemiramphodon tengah | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 22 / 7 / 9 |
| Zenarchopterus spp | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | A | 0 / 26 / 7 / 5 |
| Hemiramphodon pgonognathus | halfbeak (non-gliding) | 0.14 (group median (halfbeak), species not measured) | F | . | 0 / 22 / 7 / 9 |
| Euleptorhamphus viridis | flying (gliding) halfbeak | 0.229 (congener Euleptorhamphus velox (the measured species), Daane 2021 sheet A) | L | . | 25 / 4 / 1 / 8 |
| Oxyporhamphus micropterus | flying (gliding) halfbeak | 0.337 (this species, Daane 2021 sheet A) | L | . | 23 / 6 / 0 / 9 |
| Parexocoetus brachypterus | flying fish (Exocoetidae) | 0.687 (group median (flying fish), species not measured) | F | . | 19 / 8 / 3 / 8 |
| Fodiator rostratus | flying fish (Exocoetidae) | 0.687 (group median (flying fish), species not measured) | L | . | 17 / 10 / 3 / 8 |
| Exocoetus volitans | flying fish (Exocoetidae) | 0.674 (this species, Daane 2021 sheet A) | L | . | 20 / 6 / 2 / 10 |
| Cheilopogon papilio | flying fish (Exocoetidae) | 0.687 (group median (flying fish), species not measured) | L | . | 22 / 6 / 1 / 9 |
| Hirundichthys rondeleti | flying fish (Exocoetidae) | 0.705 (this species, Daane 2021 sheet A) | L | . | 23 / 6 / 1 / 8 |
| Cypselurus callopterus | flying fish (Exocoetidae) | 0.687 (group median (flying fish), species not measured) | L | . | 23 / 5 / 1 / 9 |
| Prognichthys tringa | flying fish (Exocoetidae) | 0.687 (group median (flying fish), species not measured) | L | . | 21 / 6 / 2 / 9 |
| Cheilopogon furcatus | flying fish (Exocoetidae) | 0.677 (this species, Daane 2021 sheet A) | L | . | 24 / 4 / 1 / 9 |
| Cheilopogon xenopterus | flying fish (Exocoetidae) | 0.687 (group median (flying fish), species not measured) | L | . | 24 / 5 / 1 / 8 |

"." = exon not captured for that species. gja5a G329V (row 3) is the other sheet-G site flagged by a fin/limb annotation; gja5a is not in our causal chains.

## How much of the signal is not coding

- Convergent coding substitutions (sheet G): **44 rows**, of which 2 are in genes with a fin/limb annotation (lat4a, gja5a).
- Conserved non-coding elements captured by the design: **105275**.
- GO terms enriched for ACCELERATED non-coding elements: **455** on the flying-fish branch (sheet K), **582** on the halfbeak branch (sheet M).
- Coding genes on the flying-fish branch (sheet J phyloP, fin/limb set): 38 accelerated, 38 conserved.

The plain number asked for (accelerated non-coding elements against convergent coding substitutions) cannot be read from Data S1: the "# CNEs" column of sheets K and M is the total number of CNEs per GO term, not the accelerated number (the 118 terms shared by K and M carry identical counts). What the data do show is non-coding acceleration enriched across hundreds of gene categories, against a convergent coding signal of 44 rows. The coding ladder above is a slice.

## Methods and limits

- Residues are not copied from sheet G (which only ticks presence by group). Each site was re-read per species by aligning the current Ensembl protein for the sheet's gene ID to that species' translated captured exons. A cell can be wrong if the captured exon is a paralogue scoring above 75% identity or if the exon was mistranslated.
- 6 sheet-G rows were not used (duplicate, synonymous as written, or reference residue no longer at that position in the current annotation); see `skipped_columns`.
- Fin ratios exist for 9 measured species; other rows show their group median and say so. Euleptorhamphus viridis (sequenced) is shown with its congener E. velox (measured).
- Group labels for genera absent from sheet A were assigned from the Zenodo species-tree clade.
