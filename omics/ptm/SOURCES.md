# omics/ptm: post-translational modification sites

Layer `ptm` of the DELPHI omics annotations (row format: `omics/SCHEMA.md`). Built by `omics/ptm/scripts/` on 2026-11-01.
Counts: see `MANIFEST.json` (top level = public file; `full_including_local_restricted` = public + local-only).

## Licences and what is public

| file | committed? | sources | licence |
|---|---|---|---|
| `annotations.jsonl.gz` | yes (public) | UniProt, iPTMnet, Banu 2025, Lemeer 2008 MCP | CC BY 4.0 (UniProt, Banu), **CC BY-NC-SA 4.0 (iPTMnet rows)**, CC BY (Lemeer 2008 MCP) |
| `restricted.local.jsonl.gz` | **no** (gitignored, `omics/**/*.local.jsonl.gz`) | dbPTM, EPSD | no licence stated = all rights reserved; used locally only, not redistributed |
| `flying_fish_flags.json` | yes | derived from public rows only | as the underlying rows |
| `flying_fish_flags.local.jsonl.gz` | no | includes dbPTM/EPSD-derived sites | local only |

**iPTMnet attribution (NC-SA).** The 24,186 rows with `source.db: "iPTMnet"` are derived from iPTMnet
(https://research.bioinformatics.udel.edu/iptmnet/, Protein Information Resource, University of Delaware; Huang et al. 2018,
Nucleic Acids Res 46:D542), licensed CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/). Those rows are for
**non-commercial use only**, and any redistribution or adaptation of them must carry the same licence. The licence is on every
iPTMnet row in `source.licence`. Changes made here: sites mapped from human/mouse onto zebrafish proteins with added conservation fields.

## Counts

| | public (`annotations.jsonl.gz`) | full (public + local-only) |
|---|---|---|
| rows | 51,327 | 278,383 |
| genes (of 3,860) | 3,162 | 3,610 |
| borrowed-ortholog / measured / curated / predicted / inferred-electronic | 48,452 / 248 / 112 / 1,287 / 1,228 | 272,358 / 3,398 / 112 / 1,287 / 1,228 |
| genes with a zebrafish measured or curated site | 208 | 630 |
| borrowed rows: conserved / residue-conserved-motif-diverged / not-conserved | 21,354 / 7,747 / 18,560 | 125,889 / 35,929 / 109,749 |
| unique zebrafish positions borrowed / conserved | 38,363 / 16,674 | 198,942 / 88,862 |
| flying fish: site rows same / differ / not covered | 1,025 / 108 / 131 | 3,978 / 801 / 494 |
| flying fish: unique differing sites (zebrafish residue is the modified one) | 35 (32 residue replaced, 3 S/T swaps) | 237 (200 replaced, 35 S/T swaps, 2 S/T/Y kept) |

Public rows by source: UniProt 26,893 (2,717 genes), iPTMnet 24,186 (2,748), Lemeer 2008 MCP 135 (101), Banu 2025 113 (97).
Local-only: dbPTM 224,658 (3,549 genes), EPSD 2,398 (583).
In the full set, phosphosites conserve least (45% not-conserved); acetyl, ubiquitin, methyl, lipid and disulfide sites mostly
conserve (disulfides 92% same residue).

**Read this first: most rows are not zebrafish measurements.** Zebrafish PTM data is sparse. Every row says where the
site was observed in `species` and `kind`:

| kind | species | meaning |
|---|---|---|
| `measured` | Danio rerio | a zebrafish experiment found the site (public: Lemeer 2008 MCP embryo phosphopeptides; local-only: EPSD-collected phosphoproteomes, dbPTM zebrafish entries) or the phosphoprotein (Banu 2025, regenerating caudal fin) |
| `curated` | Danio rerio | UniProt zebrafish entry, feature with experimental evidence (ECO:0000269 / ECO:0007744) |
| `borrowed-ortholog` | Danio rerio | UniProt zebrafish entry, feature marked ECO:0000250 "by similarity": a UniProt curator copied it from a homologue. Not measured in zebrafish |
| `borrowed-ortholog` | Homo sapiens / Mus musculus | site reported in the human or mouse orthologue, mapped onto the zebrafish protein by alignment (this layer). Not measured in zebrafish |
| `predicted` / `inferred-electronic` | Danio rerio | UniProt zebrafish feature from a sequence model (ECO:0000255) or an automatic pipeline (ECO:0000256/0000259/0007829) |

## Sources

### 1. UniProt (zebrafish entries) — `source.db: "UniProt"`, species Danio rerio
- What: features `Modified residue`, `Glycosylation`, `Lipidation`, `Disulfide bond`, `Cross-link` of the zebrafish UniProt entry named in `omics/genes.json`, with every ECO evidence code and its reference (`evidence_refs`, e.g. `UniProtKB:P55013` for a by-similarity transfer, `PubMed:...` for experiments).
- URL: `https://rest.uniprot.org/uniprotkb/stream` (accession batches of 95; fields `ft_mod_res, ft_carbohyd, ft_lipid, ft_disulfid, ft_crosslnk, sequence`). Retrieved 2026-11-01 (current release).
- Licence: CC BY 4.0.
- Caveat: 364 universe accessions are deleted TrEMBL entries ("not part of a reference proteome"). Their sequences were recovered from UniParc (latest sequence version) so that orthologue sites can still be mapped; they carry no UniProt features. Disulfide rows give `position` and `partner_position`.

### 2. EPSD 2.0 (zebrafish phosphoproteomes) — `source.db: "EPSD"`, kind `measured` — LOCAL ONLY (`restricted.local.jsonl.gz`)
- What: the EPSD *Danio rerio* file: 10,287 phosphosite records collected from zebrafish MS studies. Each row lists the papers in `pmid` / `papers`:
  - Kwon et al. 2016, Proteomics, doi:10.1002/pmic.201500017 (embryonic development phosphoproteome dynamics; PMID 26449285)
  - Lemeer et al. 2008, J Proteome Res, doi:10.1021/pr700667w (in vivo embryo phosphoproteomics; PMID 18307296)
  - Lemeer et al. 2008, Mol Cell Proteomics, doi:10.1074/mcp.m800081-mcp200 (Fyn/Yes morphant embryos; PMID 18550893)
  - SysPTM 2.0 (PMID 24705204) is a secondary database, not a measurement; rows supported only by it say so in `note`.
- URL: `https://epsd.biocuckoo.cn/Download/Danio%20rerio.zip` (file dated 2024-09-05). Retrieved 2026-11-01.
- Licence: none stated on the site ("Copyright CUCKOO Workgroup"); free academic download; cite EPSD 2.0 (NAR 2025, PMC12448286 in Europe PMC).
- Mapping: EPSD's own protein sequence (often an older TrEMBL accession) was aligned to the universe protein; a site was kept only if identity >= 90% and the residue is identical (`epsd_uniprot` keeps the original accession).
- Context: embryos (developmental stages vary by paper; not encoded per row).

### 2b. Lemeer et al. 2008, Mol Cell Proteomics — `source.db: "Lemeer 2008 Mol Cell Proteomics"`, kind `measured`, public
- What: zebrafish embryo phosphopeptides (wild type and Fyn/Yes morphants), Supplementary Table 3 of doi:10.1074/mcp.M800081-MCP200
  (PMID 18550893), re-sourced from the paper so these measured sites can be public. Sites placed by exact peptide match to the universe
  protein (IPI accessions in the table are retired); only unique matches kept: 135 sites in 101 genes (430 peptides are from proteins
  outside the gene universe, 2 matched more than one position).
- URL: `https://ars.els-cdn.com/content/image/1-s2.0-S1535947620308847-mmc1.zip` (PDF tables, converted with pdftotext). Retrieved 2026-11-01.
- Licence: CC BY, as listed by Europe PMC for the article.
- The other two zebrafish phosphoproteomes in EPSD are not open access (Kwon 2016 Proteomics, Wiley; Lemeer 2008 J Proteome Res, ACS),
  so their sites stay local-only.

### 3. Banu et al. 2025 (regenerating caudal fin) — `source.db: "Banu 2025 Sci Rep (PMC11808059)"`, kind `measured`, feature `phosphoprotein_detected`
- What: zebrafish caudal-fin regeneration phosphoproteomics (12 hpa to 7 dpa vs uninjured). Protein level only: the supplementary tables list phosphorylated proteins and their change per time point but **no residue positions**. Table 1 = TiO2 enrichment (74 proteins); Table 2 = pS/pT/pY antibody immunoprecipitation (440 proteins, with residue types).
- URL: doi:10.1038/s41598-024-84735-z; supplementary .docx via `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11808059/supplementaryFiles`, parsed by `scripts/parse_banu.py`.
- Licence: CC BY 4.0 (Scientific Reports).
- Context: `anatomy` ZFA:0001058 caudal fin (UBERON:4000164), condition "regenerating after caudal fin amputation". The table does not state the scale of the change values; they are copied as reported.
- Mapping: only exact (case-insensitive) matches of the paper's gene symbol to a universe symbol; others are dropped, not guessed (e.g. "AAK1", "STAT5").
- Found through a Europe PMC search for zebrafish phosphoproteomics (881 hits on 2026-11-01). Other zebrafish phosphoproteomes found there (Kwon 2016, Lemeer 2008 x2) are in EPSD (local-only); Lemeer 2008 MCP is also re-sourced publicly (2b); none of the newer ones checked had a site table we could parse in the time available.

### 4. dbPTM — `source.db: "dbPTM"` — LOCAL ONLY (`restricted.local.jsonl.gz`)
- What: dbPTM experimental PTM site files (72 PTM types, e.g. Phosphorylation, Acetylation, Ubiquitination, N-linked Glycosylation, S-palmitoylation). Columns: entry name, UniProt accession, position, PTM type, PMIDs, 21-residue peptide. Human (`_HUMAN`) and mouse (`_MOUSE`) sites are borrowed; zebrafish (`_DANRE`) sites are kind `measured`.
- URL: `https://biomics.lab.nycu.edu.tw/dbPTM/download/experiment/<type>.gz` (dbPTM 2022 release; archives dated 2021-09-11). Retrieved 2026-11-01.
- Licence: no licence or terms stated on the download page; academic resource (Li et al. 2022, NAR). dbPTM integrates ~40 PTM resources (which may include PhosphoSitePlus-derived records that cannot be told apart in these files): so dbPTM rows are kept local-only and not redistributed.
- 2,784 orthologue sites on titin-scale proteins (source x zebrafish length > 2.6e7) were not aligned and are not in the file.
- Check: the residue at the centre of the 21-mer must equal the residue at that position in the current UniProt canonical sequence; otherwise dropped (counted in MANIFEST `dropped`).

### 5. iPTMnet — `source.db: "iPTMnet"`
- What: iPTMnet bulk `ptm.txt` (all sites, with the upstream resource per site in `iptmnet_sources`, e.g. `hprd`, `phat` (PhosphoGRID/Phospho.ELM-type text mining), `rlim` (RLIMS-P), `sign` (SIGNOR), `glygen`, `pro`; enzymes when known). Human and mouse sites only. Sites whose only upstream source is `unip` (UniProt) are dropped because UniProt is ingested directly (no double counting in concordance).
- URL: `https://research.bioinformatics.udel.edu/iptmnet_data/files/current/ptm.txt` (the REST API per protein was not needed). Retrieved 2026-11-01.
- Licence: CC BY-NC-SA 4.0 (iPTMnet; https://research.bioinformatics.udel.edu/iptmnet/license): non-commercial, share-alike. See the attribution note above.

### 6. UniProt (human and mouse orthologue entries) — `source.db: "UniProt"`, kind `borrowed-ortholog`
- What: the same five feature types on the human orthologue (`omics/genes.json` `human_ortholog.uniprot`) and on the reviewed mouse entry whose gene name equals the human orthologue symbol. **Only features with experimental evidence** (ECO:0000269 / ECO:0007744) are borrowed; by-similarity features of human/mouse entries are not.
- Licence: CC BY 4.0.

### Not used
- **PhosphoSitePlus**: bulk downloads need a registered login and are licensed CC BY-NC-SA (non-commercial). No credentials are used in this project, so it was skipped. (dbPTM may carry some PSP-derived records; see above.)
- **qPTM**: `https://qptm.omicsbio.info/download.php` returned HTTP 404 on 2026-11-01.
- Bird (Aves) proteins: none fetched or used (frozen holdout); the build asserts no bird species or bird UniProt mnemonic appears.

## Mapping orthologue sites onto zebrafish (the value-add)

For every human/mouse site, the source protein (UniProt canonical) and the zebrafish protein (universe accession) are aligned
globally with Biopython 1.88 `PairwiseAligner` (BLOSUM62, gap open -10, extend -0.5, free end gaps). Each borrowed row carries:

- `value.zf_position`, `value.zf_residue`: where the site lands in the zebrafish protein (null if in a gap)
- `value.conservation`, one of
  - `conserved`: same residue in zebrafish, and >= 60% identical residues over the ±7 window (15 positions, termini truncated)
  - `residue-conserved-motif-diverged`: same residue, window identity below 60%
  - `not-conserved`: different residue, or the site falls in an alignment gap (`note` says which; S<->T acceptor swaps are flagged)
- `alignment.identity_pct` (identical / aligned pairs), `alignment.coverage_of_source`, `motif.source`, `motif.zebrafish`, `motif.identity`
- `orthology`: how the orthologue was chosen (human: ZFIN orthology via `omics/genes.json`; mouse: reviewed entry with the human symbol)

When one human protein is the orthologue of several zebrafish paralogues (e.g. `a`/`b` copies), the site is mapped onto each
paralogue separately. Rows are kept for every class, including `not-conserved`: a `not-conserved` row is evidence that the
zebrafish protein probably lacks that site, not a zebrafish annotation.

## Flying fish (fin genes only): residue state, not phenotype

For fin-relevant genes (the 42 `genotype/causal-chains.json` genes plus Wnt/Fzd/Lrp/Ctnnb/Lef/Tcf/Axin/Apc/Dkk/Rspo, Fgf/Fgfr,
Hh/Ptch/Smo/Gli/Hhip, Bmp/Bmpr/Smad/Nog/Chrd/Grem members, kcnk5b, kcnh2a, slc43a2a, gja1b, tbx5a, prdm1a), each row with a
zebrafish position gets a `flying_fish` object: the residue at that position in the *Hirundichthys speculiger* orthologue,
`state` (`same as zebrafish` / `differs from zebrafish` / `not covered / gap`), the ±7 motif and its identity to zebrafish.

- Focal genes: taken from the MAFFT alignments in `sequences/alignments/` (H. speculiger row; for kcnh2a and shha that row is
  a tblastn projection onto the unannotated assembly, not an annotated protein, as `orthology` says).
- Other fin genes: reciprocal best blastp hit between the universe zebrafish protein and the Xu et al. 2021 H. speculiger proteome
  (figshare 10.6084/m9.figshare.14600634.v1; the reverse search is against the Ensembl 116 zebrafish proteome, and the hit must
  return the same gene symbol). Automated, not curated; paralogue confusion is possible for gene families.
- `flying_fish_flags.json` lists the sites where the flying-fish residue differs from zebrafish, keeping only sites where the
  zebrafish residue is itself the modified one (zebrafish measured/curated, or a borrowed site classed conserved or
  residue-conserved-motif-diverged). At build time: 103 of 137 fin genes have a flying-fish orthologue; of 5,272 site rows
  checked. Public file: 35 unique differing sites (focal genes: prdm1a S412E only). Full set incl. local-only rows: 237 unique
  sites (focal genes: kcnh2a S266N, T867V, S1024P, T303S; kcnk5b S436A; prdm1a S135E, S320G, S326A, S412E, S489E, S746N;
  tbx5a S275G); the per-site list of the full set is in the local-only `flying_fish_flags.local.jsonl.gz`.
- A difference from zebrafish mostly reflects ordinary teleost divergence (zebrafish and flying fish split long ago);
  medaka or other non-flying beloniforms were **not** checked here, so none of these is shown to be flying-fish-specific.
- **Caveat:** this is the residue present in a flying-fish protein sequence. Nobody measured these modifications in flying fish,
  and a residue difference says nothing on its own about fin shape or flight.

## New features (beyond the SCHEMA.md suggestions)
`disulfide_bond`, `methyl_site`, `sumo_site`, `lipid_site`, `nitrosyl_site`, `crosslink_site`, `phosphoprotein_detected`.
Value for site features: `{residue, position, modification}`, plus for borrowed rows `{source_species, source_protein, zf_position, zf_residue, conservation}`.

## Rebuild
```
python omics/ptm/scripts/fetch_uniprot.py      # UniProt streams -> C:/Temp/omics-cache/ptm/uniprot
python omics/ptm/scripts/fetch_uniparc.py      # sequences of deleted TrEMBL accessions
# downloads (cached under C:/Temp/omics-cache/ptm/raw): iPTMnet ptm.txt, dbPTM experiment/*.gz, EPSD Danio rerio.zip,
# Banu 2025 supplementary zip (Europe PMC); then python -I omics/ptm/scripts/parse_banu.py <S1.docx> <S2.docx> <out.json>
python omics/ptm/scripts/build_ptm.py          # -> annotations.full.local.jsonl.gz (local); needs Biopython, BLAST+
python omics/ptm/scripts/split_public.py       # -> annotations.jsonl.gz (public) + restricted.local.jsonl.gz; adds Lemeer 2008 MCP
python omics/ptm/scripts/manifest.py done
node omics/validate.mjs omics/ptm/annotations.jsonl.gz omics/ptm/restricted.local.jsonl.gz
```
