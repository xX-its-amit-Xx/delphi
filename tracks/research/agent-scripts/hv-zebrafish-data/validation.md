# hv-zebrafish-data validation (2026-11-13)

Input: dl/human_orthos.txt from https://zfin.org/downloads/human_orthos.txt (9.7 MB, 44,346 rows, no header).
Commands: `cut -f1 | sort -u | wc -l` = 17,180 zebrafish genes; `cut -f4 | sort -u | wc -l` = 13,749 human genes (col 7 gives the same).

V1 Howe 2013 (10.1038/nature12111): 71.4% of 20,479 human coding genes have a zebrafish orthologue -> predicted 14,622.
   Measured in ZFIN curated table: 13,749 -> 67.1% of 20,479. Strict (within 1 point): FAIL. Loose ("approximately 70%", within 5 points): pass.
   Caveat: ZFIN is curated orthology, Howe used Ensembl Compara; denominators differ.
V1b Howe: 69% of 26,206 zebrafish genes have a human orthologue -> 18,082. Measured 17,180 -> 65.6%. Same verdict.
V2 Somite rate 2 per hour at 28.5 C (ZFIN stage table): 14 somites at 16 h, 20 at 19 h, 26 at 22 h -> 2.0 per hour. PASS.
   Early: 1 somite at 10.33 h, 5 at 11.66 h -> 3.0 per hour. Consistent with faster early somites.
V3 Isometric growth b = 3: FishBase Bayesian b = 3.04 (2.84 - 3.24); interval contains 3. PASS (not falsified).

Abstracts fetched from Europe PMC: epmc.txt
