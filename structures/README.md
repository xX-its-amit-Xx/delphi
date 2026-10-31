# structures/ — the 3D side: models, binding interfaces, and whether convergence lands where it matters

Gliding and powered flight evolved independently many times. The question this folder exists to
answer is not whether the same genes keep turning up — the sequence thread handles that — but
whether the differences sit **in the parts of the protein that matter**: a binding interface, a
pore, a selectivity filter, a transport site. If convergent substitutions sat in binding sites,
that would be mechanism. If they sit on indifferent surface, that is a different and quieter
story. Both answers are reportable; this run got the quieter one, and it got it from an
experimental structure rather than a prediction.

**Birds (class Aves) are this project's frozen holdout. No bird sequence or structure was
fetched, and no bird species is named anywhere in this folder, until the holdout exam runs.**

**Pterosaurs are extinct and leave no DNA or protein. No structural or sequence comparison is
possible for them anywhere in this layer; their only comparison is morphological.**

---

## The headline

**The one convergent gliding substitution our sources name is not in the binding site.**

Daane 2021 (PMID 34534441) reports a single amino-acid substitution shared across independently
gliding beloniform lineages: `lat4a F326L`. In the sequence thread's alignment, **11 of the 16
gliding rows carry L** — ten Exocoetidae plus the flying halfbeak *Euleptorhamphus viridis* and
*Oxyporhamphus micropterus* — against **32 of 33 non-gliders carrying F** (the saury *Cololabis
saira* carries I).

It is worth being exact about what that convergence is and is not. **It is confined to the gliding
fishes.** The five gliding rows that keep F are the sailfin flying fish *Parexocoetus brachypterus*
(the known exception, and the one sequenced flying fish with an elongated dorsal fin instead), both
colugos, the sugar glider, and medaka. The three bats carry F. So the one convergent substitution
our sources name is shared by two gliding beloniform lineages and by **no gliding mammal at all** —
it is not a signature of gliding in general, and this layer did not find it to be one.

Our own protein — human **LAT4 / SLC43A2**, the ortholog of zebrafish
`slc43a2a` (`lat4a`) — has now been solved **with its substrate bound**: PDB **9JBT**, "Structure
of LAT4 in complex with Phe", 3.2 Å cryo-EM, 76.9 % identical to zebrafish Slc43a2a. So the
question has an experimental answer:

| | |
|---|---|
| the eight LAT4 residues that contact the bound phenylalanine (≤ 4.0 Å) | S100, T103, M159, L166, Y187, Q335, H465, S489 |
| the convergent site, in human LAT4 numbering | **F320** |
| is it one of those eight? | **no** |
| distance from F320 to the bound substrate | **20.1 Å** |
| where it is instead | the short segment leading into transmembrane helix 323–345 |
| do any of the eight substrate-site residues differ between gliders and non-gliders? | **no — all eight are invariant across every glider and non-glider lineage in the alignment** |

That is the result: convergence is real at the sequence level, and it is 20 Å from the place the
protein does its job. A residue 20 Å away can still matter — through the transport cycle, folding
or trafficking — and **no transport assay for this substitution exists in any species**. "Not in
the substrate site" is a statement about where the residue is, not about what it does.

And a broader version of the same test, over every interface this layer measured:

**532 experimental interface positions, 6 structures, 3–5 independent gliding lineages each —
zero positions separate gliders from non-gliders.** Every interface position tested carries, in
gliders, a residue also found in non-gliders. (`interfaces-across-lineages.json`)

### A numbering error, kept on the record

This layer first tried to place `F326L` on UniProt sequences and got a confident wrong answer.
Every UniProt isoform of zebrafish and medaka `slc43a2a` carries **D** at position 326, not F, and
**M** at 200, not T; no offset in −60…+60 reconciles both stated wild types. The positions are
numbered against the **Ensembl** canonical protein, not the UniProt one. The sequence thread
established that from Daane 2021 Data S1, and with their alignment the site lands on human LAT4
320. The failed attempt is kept in `interface-mapping.json` →
`slc43a2a_numbering_problem` (with `RESOLVED`) because it is exactly the kind of silent error that
produces a clean-looking false result.

---

## Species × protein coverage

`AF` = an AlphaFold DB model exists; `UP` = a UniProt entry exists but AlphaFold DB has no
prediction for it; `–` = no UniProt entry for any candidate gene symbol or matching protein name.
The last column is the total number of UniProt entries in that taxon, which is the real story.

| species | role | kcnk5b | kcnh2a | gja1b | slc43a2a | hhip | shha | tbx5a | prdm1a | UniProt entries in taxon |
|---|---|---|---|---|---|---|---|---|---|---|
| flying fish (Exocoetidae) | glider (fish) | – | – | – | – | – | – | – | – | 25 |
| gliding halfbeak (Hemiramphidae) | glider (fish) | – | – | – | – | – | – | – | – | 20 |
| medaka (*Oryzias latipes*) | **proxy** for flying fish (same order) | AF | AF | AF | AF | AF | AF | AF | AF | 37,633 |
| zebrafish (*Danio rerio*) | control (fish) | AF | AF | AF | AF | AF | AF | AF | AF | 78,189 |
| needlefish (Belonidae) | control (fish) | – | – | – | – | – | – | – | – | 36 |
| little brown bat (*Myotis lucifugus*) | powered flight | AF | AF | AF | AF | AF | – | AF | AF | 20,773 |
| greater mouse-eared bat (*Myotis myotis*) | powered flight | – | AF | – | – | AF | – | AF | AF | 45,836 |
| greater horseshoe bat (*Rhinolophus ferrumequinum*) | powered flight | AF | AF | UP | AF | AF | AF | AF | AF | 33,647 |
| large flying fox (*Pteropus vampyrus*) | powered flight | AF | AF | AF | AF | AF | UP | UP | AF | 34,789 |
| black flying fox (*Pteropus alecto*) | powered flight | – | AF | – | – | – | – | AF | AF | 19,607 |
| fruit fly (*Drosophila melanogaster*) | powered flight (insect) | AF | AF | AF | AF | – | AF | AF | AF | 42,881 |
| sugar glider (*Petaurus breviceps*) | glider (mammal) | – | – | – | – | – | – | – | – | 115 |
| colugo (*Galeopterus variegatus*) | glider (mammal) | – | UP | UP | UP | UP | – | UP | UP | 29,890 |
| northern flying squirrel (*Glaucomys sabrinus*) | glider (mammal) | – | – | – | – | – | – | – | – | 2 |
| Siberian flying squirrel (*Pteromys volans*) | glider (mammal) | – | – | – | – | – | – | – | – | 31 |
| mouse (*Mus musculus*) | control (mammal) | AF | AF | AF | AF | AF | AF | AF | AF | 88,707 |
| human (*Homo sapiens*) | control (mammal) | AF | AF | AF | AF | AF | AF | AF | AF | 210,788 |

136 cells: **66 with an AlphaFold model, 9 UniProt-only, 61 absent.** Full records, including every
accession tried and the reason for each absence, in `models.json`.

**The absences are not noise; they are the shape of the problem.** Every gliding lineage is
data-poor. Exocoetidae has 25 UniProt entries in total, gliding halfbeaks 20, needlefishes 36, the
sugar glider 115, the Siberian flying squirrel 31 and the northern flying squirrel **2** — these
are mitochondrial and odd fragmentary records, not proteomes. The colugo is the one glider with a
real annotated proteome (29,890 entries) and AlphaFold DB has **no model for any of its proteins**.
So **a structural comparison across gliders cannot be done in AlphaFold DB today**, and that
absence is the first result of this layer, not a gap in the work.

Two notes on the matrix. `gja1b` for *Drosophila* resolves to **Innexin inx2** (Q9V427): insects
have innexins, not connexins, so this is a functional analog and not an ortholog — the row is not
evidence of a shared connexin. And the free-text fallback used for proteomes with no gene symbols
(the two bats, the colugo) originally matched **paralogs** — TBX4 for `tbx5a`, PRDM15/PRDM16 for
`prdm1a`, and HHIP for `shha`. The patterns were tightened to name the specific family member and
the matrix was rebuilt; every such cell carries a `confidence` field saying orthology was not
verified by a tree.

---

## Experimental interfaces (`binding.json`)

Searched through the RCSB Search API, chosen by a stated rule, and read off the deposited
coordinates with a 4.0 Å heavy-atom cutoff. Choice rule: entry must contain both partners; among
those, highest sequence identity of the relevant chain to the zebrafish protein our causal chains
actually name; then (for the hedgehog targets) prefer the entry whose ligand is *Sonic* hedgehog;
then resolution; then chain count. Fragments are excluded — an NMR structure of a 20-residue
linker aligns at 100 % identity and says nothing about a tetramer.

| interface | chosen | method, resolution | identity to our zebrafish protein | residue pairs | interface residues |
|---|---|---|---|---|---|
| **Sonic hedgehog + HHIP** | **3HO5** | X-ray, 3.01 Å | 71.7 % (HHIP side) | 40 | 22 Shh / 16 HHIP |
| Hedgehog + Patched-1 | 6E1H | cryo-EM, 3.5 Å | 94.8 % (Shh side) | 126 | 46 Shh / 62 PTCH1 |
| Sonic hedgehog + CDO (FNIII-3) | 3D1M | X-ray, 1.7 Å | 93.5 % (Shh side) | 90 | 30 Shh / 32 CDO |
| **Cx43 gap-junction channel** | **7Z1T** | cryo-EM, 2.26 Å | 81.1 % | 150 (docking) + 90 (intra-connexon) | 11 + 11 across the docking interface; 53 + 53 inside one connexon |
| **TASK-2 (mouse Kcnk5) K2P dimer** | **10OY** | cryo-EM, 2.62 Å | 67.5 % | 213 | 98 per subunit |
| hERG (KCNH2) tetramer | 9CHQ | cryo-EM, 3.0 Å | 78.2 % | 86 | 47 per subunit |
| **LAT4 / SLC43A2 + its substrate** | **9JBT** | cryo-EM, 3.2 Å | 76.9 % | — (one chain) | 8 residues contacting the bound Phe |

Three of these are better than the brief hoped for, and two are worse:

- **The K2P is not a family stand-in.** Human KCNK5 has no deposited structure, but **mouse Kcnk5 /
  TASK-2 does** (10OY, 2.62 Å), and it is the direct ortholog of our `kcnk5b` at 67.5 % identity.
  Found only after adding an accession search on mouse Kcnk5 and a full-text TASK-2 search: the
  entries are titled "Potassium channel TASK2", which a "subfamily K member" description search
  misses. Without that, the nearest K2P would have been TREK-1 at 39.5 %.
- **The transporter is our own protein with its own substrate.** SLC43A2 (LAT4) returned 9JBS (apo),
  9JBT (+Phe) and 9JBU (+digitonin) directly. Note that the bound substrate's chemical component id
  is `PHE`, so a name-based ligand filter silently drops it; ligands here are identified by their
  HETATM flag instead.
- **The Cx43 entry contains the whole docked dodecamer** (12 chains), so the extracellular docking
  interface between the two hemichannels is read from one deposited structure, not reconstructed.
  The two connexons were separated by projecting chain centroids on the pore axis.
- **The HHIP complex is with human Sonic hedgehog but it is the smallest interface of the four
  deposited HHIP complexes.** 3HO5 gives 40 residue pairs; 2WG3 (HHIP + Desert hedgehog, 2.6 Å)
  gives 156. So every HHIP complex was measured as a cross-check (`cross_check` in `binding.json`):
  across the four entries, **11 HHIP positions are at the interface in all four** (376, 377, 379–384,
  387, 418, 421) and **29 in at least two**. That 376–387 stretch is the reproducible core of the
  Shh–Hhip interface, and it is the structural address of our only sourced route to a *larger*
  pectoral fin.
- **CDO and BOC are different proteins** and their positions are not comparable, so the cross-check
  consensus is grouped by receptor accession rather than pooled. Grouped properly it gives two more
  reproducible interfaces: **28 CDO positions** at the hedgehog interface in both deposited CDO
  complexes (3D1M with Sonic, 3N1F with Indian hedgehog) and **13 BOC positions** in all three BOC
  complexes (3N1G, 3N1M, 3N1P). Pooled, "in all entries" was zero — an artifact of comparing two
  proteins' numbering, which is why the grouping matters.
- **No Smoothened search was run.** A reviewed-entry lookup of the symbol `SMO` returned *spermine
  oxidase* (SMOX), not Smoothened. Rather than cite the wrong protein, the accession was dropped and
  the target left out; this is recorded in `binding.json` → `accession_note`.

### Coordinate mapping, and what it cannot do

Contacts are collected in author numbering, then converted to UniProt numbering through RCSB's own
SIFTS-derived alignment (`rcsb_polymer_entity_align`: `uniprot_pos = ref_beg + label_seq −
entity_beg`) composed with the `label_seq_id → auth_seq_id` table read from the same coordinate
file. Residues outside any aligned region keep `uniprot_pos = null` and are flagged, not dropped.

For the cross-lineage test the structure position is then carried onto the sequence thread's MAFFT
alignment. **Eleven of the twelve interface sides map 1:1**, because the PDB reference sequence and
the Ensembl canonical protein are the identical record; the twelfth (3D1M, mouse Shh) is composed
through a pairwise alignment at 92.9 % identity. Limits: a gap column is a gap, not a difference;
rows the sequence thread marked as tblastn projections rather than annotated proteins are excluded
from the test; the structures are human and mouse proteins, so every fish, reptile, amphibian and
insect residue is reached by a cross-species jump; and interface membership is a 4.0 Å cutoff in
*one* deposited conformation, so a residue just outside the cutoff, or one that only contacts the
partner in another state, counts as non-interface here.

### Why the cross-lineage test has power at all

My own UniProt-based version of this test was worthless and I nearly reported it: only **one**
glider (the colugo) had any sequence, so the "10 interface positions separating gliders" it first
produced were one low-identity, name-matched sequence differing from everything else. An identity
gate (≥ 50 %) cut that to one position, and even that is a single-lineage artifact.

The test is only meaningful on `sequences/alignments/*.json`, built by the sequence-alignment agent
in this same session, which contain **nine Exocoetidae, two flying halfbeaks, the sugar glider, two
colugos and a parachute gecko**, each with matched non-gliding controls (needlefishes, sauries,
non-gliding halfbeaks, a tree squirrel, a non-gliding gecko, a colubrid snake). This layer realigned
nothing; it reads their columns. The rule used: a column separates gliders only when every glider
residue differs from every non-glider residue, **at least two independent gliding lineages** carry
the glider residue, and at least five non-gliders are scored. The nine Exocoetidae count as one
lineage. Result: **0 of 532**.

---

## Variants (`variants/variants.json`)

Twelve variants with a position from a fetched source were position-checked against the fetched
UniProt sequence, given the wild-type AlphaFold per-residue pLDDT around the site, and placed on a
deposited experimental structure. **Every result here is a structure prediction or a geometric
measurement, not a measurement of function.**

**9 of 12 position checks passed.** The three failures are informative: `slc43a2a` F326 and T200 (the
Ensembl-vs-UniProt numbering problem above) and `kcnk5b` S345, which maps to R335 in mouse TASK-2
because the C-terminus diverges. Nothing was renumbered to make a check pass.

**Three variants sit at an interface**, measured in the coordinates:

| variant | where it maps | interface? | measured |
|---|---|---|---|
| `kcnk5b` **F241Y** (an *alf* allele) | mouse TASK-2 10OY, F241 | **yes** | 3.43 Å to the partner subunit; 5.36 Å to a bound lipid; 14.8 Å to the nearest K⁺ |
| `gja1b` **P191S** (`j7e2`) | human Cx43 7Z1T, P191 | **yes** | 3.75 Å to the neighbouring connexin subunit |
| `gja1b` **F209I** (`j7e3`) | human Cx43 7Z1T, F209 | **yes** | 3.82 Å to the neighbouring connexin subunit |
| `kcnk5b` W169L (the other *alf* allele) | 10OY, W169 | no | 9.72 Å to the partner subunit, 5.62 Å to a bound lipid |
| `gja1b` T154A (dominant negative) | 7Z1T, T154 | no | 9.03 Å to the partner subunit |
| `slc43a2a` T200K (`nr21`, the winged zebrafish) | 9JBT, M171 — position check FAILED | no | 15.9 Å from the bound substrate |
| `hhip` Y285*/Y295* (`uki` nonsense alleles) | 3HO5, Y293/Y303 | no | 19.0 / 27.3 Å from the hedgehog ligand |

So the two dominant *alf* gain-of-function substitutions fall on opposite sides of this line: F241Y
is at the K2P subunit–subunit interface, W169L is not. Neither is in the selectivity filter — the
`T-x-G-[YFL]-G` signature of our zebrafish Kcnk5b was located by motif search, and neither position
falls inside it.

**ESMFold:** Meta's public endpoint served the first wild-type/variant pair (a 350-residue window of
zebrafish Kcnk5b, wild type vs W169L) and then returned HTTP 504 "Endpoint request timed out" to
every later request, including a deliberate 66-residue probe — 3 successes and 22 timeouts over the
run. **It is a service outage during the run, not a length limit.** The one pair obtained:

- `kcnk5b` W169L, window 1–350: **CA RMSD 0.321 Å over the window, 0.125 Å over site ±10**; pLDDT at
  the site 90.0 in both wild type and variant. A conservative substitution with no predicted
  backbone consequence, which is what the method can say and no more.

The missing folds are reproducible — rerun `scripts/build_variants.py` when the endpoint is up; the
cache makes everything else free. Variants whose positions no fetched source gives (the `alf`
allele-to-substitution assignment, `gja1b lh10`, `sof b123`, the `kcnh2a longfin` inversion, the
frameshifts) are listed with reasons in `variants.json` → `skipped`, not modelled.

**No co-folding tool was used.** The brief allowed Boltz for one complex with no experimental
structure, "if available as a skill in this session". No `boltz:*` skill is offered in this session,
so it was skipped rather than substituted.

---

## Pathways (`pathways.json`)

Question: is a pathway our genes sit in **intact in gliders and incomplete elsewhere**, or the same
everywhere? Eleven pathways, every one that directly contains one of our eight genes and has at most
36 members (`GO:0033339`, 40 members, was over the cap and is recorded as dropped). 152 distinct
zebrafish member genes, 147 of them in an Ensembl Compara tree; presence in each panel species is
"Compara returns at least one orthologue".

**Answer: the same everywhere — and the glider side is empty.**

| pathway | name | our genes in it | genes with a tree | medaka | zebrafish | *M. lucifugus* | *R. ferrumequinum* | *P. vampyrus* | mouse | human |
|---|---|---|---|---|---|---|---|---|---|---|
| dre04340 | Hedgehog signaling pathway (KEGG) | hhip, shha | 33 | 29 | 33 | 30 | 31 | 31 | 32 | 31 |
| dre04540 | Gap junction (KEGG) | cx43 | 35 | 30 | 35 | 27 | 27 | 29 | 31 | 31 |
| GO:0045879 | negative regulation of smoothened signaling | hhip | 13 | 11 | 13 | 8 | 11 | 10 | 11 | 11 |
| GO:0071805 | potassium ion transmembrane transport | kcnh2a, kcnk5b | 26 | 22 | 26 | 23 | 24 | 23 | 24 | 24 |
| GO:0042391 | regulation of membrane potential | kcnk5b | 13 | 11 | 13 | 11 | 12 | 12 | 12 | 12 |
| GO:0033334 | fin morphogenesis | cx43, hhip, kcnk5b, slc43a2a | 14 | 14 | 14 | 12 | 12 | 12 | 13 | 13 |
| GO:0033333 | fin development | cx43, hhip, kcnk5b, prdm1a | 22 | 19 | 22 | 16 | 15 | 14 | 15 | 15 |
| GO:0035138 | pectoral fin morphogenesis | prdm1a, tbx5a | 9 | 9 | 9 | 8 | 9 | 8 | 9 | 9 |
| GO:0010644 | cell communication by electrical coupling | cx43 | 3 | 3 | 3 | 2 | 2 | **0** | 2 | 2 |
| R-DRE-5632681 | Ligand-receptor interactions (Reactome) | hhip, shha | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| R-DRE-5358346 | Hedgehog ligand biogenesis (Reactome) | shha | 9 | 8 | 9 | 9 | 9 | 8 | 9 | 9 |

**Of the 17 panel species, 7 have an Ensembl genome and not one of them is a glider.** Flying fish,
gliding halfbeaks, needlefishes, the sugar glider, the colugo and both flying squirrels are absent
from Ensembl, so the glider column cannot be written at all. *Drosophila* is outside it too, because
the vertebrate Compara database does not hold it. Among the species that do have genomes — two fish,
three bats and two non-flying mammals — every pathway is 82–100 % complete and the fliers are not
distinguishable from the non-fliers. **Seven of our eight genes are present in all seven species.**

**The specific absences, and why not to over-read them.** The two blanks among our own genes are
medaka `kcnh2a` and *Pteropus vampyrus* `cx43` — and `cx43` / `GJA1` is not plausibly missing from a
bat. *P. vampyrus* also reads 0/3 for `GO:0010644`, the smallest pathway here, which is the same gap
seen three times. These are annotation and tree-membership gaps in a scaffold-level genome, not
biology. Likewise the genes that read absent in the most species (`cx36.7`, `gjd2b`, `rerea`,
`sox11b`, `scn4ab`, `hoxd13a`, `rpz`) are mostly the zebrafish 'b' paralogs from the teleost genome
duplication, which have no one-to-one counterpart in mammals by construction. `pathways.json` →
`method.do_not_over_read` states this: **an orthologue missing from Compara is not evidence the gene
is missing from the animal**, and three different things produce the same blank — no genome in
Ensembl, a genome without the annotation, or real absence — which this method cannot tell apart.

Two corrections made on the way, both recorded in the file. Ensembl's taxon-id lookup returned
*strain* genomes (`oryzias_latipes_hni`, `mus_musculus_cbaj`) rather than the reference genomes, so
species names are now matched exactly. And Compara does not return a gene as its own orthologue, so
a first version of this table read **0/N for zebrafish in every pathway** — an artifact, since every
member gene *is* a zebrafish gene; zebrafish is the query species and is now marked present by
construction.

Carried caveat, as the brief required: every Reactome zebrafish row in `genotype/pathways.json` is
`inferred_by_orthology = 1`. For the two Reactome pathways this analysis therefore compares orthology
against orthology, and the zebrafish membership itself is not experimental.

---

## Files

| file | what it is |
|---|---|
| `models.json` | the species × protein matrix: UniProt accession, AlphaFold entry, version, mean pLDDT, URL, or an explicit absence with the reason |
| `taxa.json` | the resolved taxon ids and per-taxon UniProt entry counts |
| `binding.json` | the heart of it: searches, candidate tables, the chosen entry per interface, and every interface contact in author and UniProt numbering, plus the HHIP cross-check |
| `binding.search.json`, `binding.candidates.json` | the search hits and the screened candidate table they were chosen from |
| `interfaces-across-lineages.json` | the glider-vs-non-glider test on the sequence thread's MAFFT alignments — the one with power |
| `interface-mapping.json` | our variants measured on the structures, the LAT4 substrate site carried across the panel, and the `slc43a2a` numbering problem with its resolution |
| `convergence-test.json` | the headline test: the convergent substitution against the experimental substrate site |
| `pathways.json` | pathway-component presence/absence by Ensembl Compara orthology, with the absences |
| `variants/variants.json` | variant position checks, wild-type pLDDT windows, the one ESMFold pair, the endpoint outage, and the skipped variants with reasons |
| `chains/` | trimmed coordinate files (gzipped PDB) for exactly the chains that make each reported interface, ~1.2 MB in total, with `MANIFEST.json` |
| `calls.json` | every HTTP call this layer made: time, method, URL, status, bytes, purpose, cache file |
| `scripts/` | everything that produced the above, in the order it runs |

Run order: `build_models.py` → `build_binding.py` → `build_interfaces.py` → `build_chosen.py` →
`map_interface.py` → `interfaces_on_alignments.py` → `convergence_test.py` → `build_variants.py` →
`finalise_variants.py` → `extract_chains.py` → `build_pathways.py`.

## Sources, versions, and what is proxy

Only what was fetched is cited; every call is in `calls.json`.

- **RCSB PDB** — Search API v2 (`search.rcsb.org/rcsbsearch/v2/query`), Data API v1
  (`data.rcsb.org/rest/v1`), coordinates from `files.rcsb.org`. Entries used: 3HO5, 2WG3, 2WG4, 2WFX,
  6E1H, 3D1M, 3N1F, 3N1G, 3N1M, 3N1P, 3N1Q, 7Z1T, 10OY, 9CHQ, 9JBS, 9JBT, 9JBU.
- **AlphaFold DB** — `alphafold.ebi.ac.uk/api/prediction/{accession}`; model version and mean pLDDT
  per entry are recorded in `models.json`, not summarised away.
- **UniProtKB** — `rest.uniprot.org` for taxonomy, accession search, FASTA sequences and
  transmembrane features. No email or tool parameter was sent on any request.
- **Ensembl REST** — `rest.ensembl.org` for the species list, gene ids and Compara orthologues;
  release recorded in `pathways.json`.
- **ESMFold** — Meta's public endpoint `api.esmatlas.com/foldSequence/v1/pdb/`, no key. pLDDT comes
  back on a 0–1 scale in the B-factor column and is rescaled to 0–100 here.
- **Built on, not duplicated:** `sequences/alignments/*.json` and `sequences/genes.json` from the
  sequence-alignment agent in this session (MAFFT v7.526 L-INS-i, Ensembl release 116 proteins plus
  NCBI and Daane 2021 Data S1 rows); `genotype/causal-chains.json`, `genotype/interventions.json` and
  `genotype/pathways.json` for every variant position and pathway membership. This layer did no
  sequence alignment of its own except the short pairwise compositions it reports.

**Proxies, labelled:** *medaka* stands in for flying fish in the AlphaFold/UniProt matrix (same order,
Beloniformes; it is a **non-glider**, so it is a proxy for *data availability*, never for the gliding
phenotype). *Mouse TASK-2* stands in for zebrafish Kcnk5b in the structural work (67.5 % identity).
*Human* proteins stand in for zebrafish in every interface (HHIP 71.7 %, Shh 93.5–94.8 %, Cx43 81.1 %,
KCNH2 78.2 %, LAT4 76.9 %). *Desert* and *Indian* hedgehog appear in three of the four HHIP
cross-check entries and in the CDO/BOC entries; they are paralogs of Shh, and which ligand each entry
contains is recorded per entry. *Innexin inx2* is a functional analog of connexin-43 in *Drosophila*,
not an ortholog.

## Holdout leak check

```
$ node holdout/check-leaks.mjs structures/
scanned 27 files under structures for 88 held-out taxa (Aves) and 12 claim ids whose organisms are all held out
warn  ... class name Aves          (21 lines)
warn  ... the word bird            (25 lines)
no held-out organism named; 46 warning(s), of which 0 allowlisted with a reason.
exit 0
```

**Zero leaks.** No held-out organism — no bird species, genus, family, order, slug, NCBI taxid or
GBIF key — is named anywhere in `structures/`. All 46 warnings are class-level words (`Aves`,
`bird`), and every one of them is in a sentence saying birds are excluded; `check-leaks.mjs` reports
those as warnings by design, because naming the class is how a builder says it filtered the class
out. No allowlist entry was needed or added.

## What was not found

- No position in any measured interface separates gliders from non-gliders (0 of 532).
- No AlphaFold model exists for any protein of any gliding mammal in our panel, and no UniProt
  proteome exists for any gliding fish.
- No experimental structure exists for a K2P channel of our own species, for zebrafish Gja1b, or for
  any fish protein in this panel: every structure used is human or mouse.
- No functional measurement exists for any variant here. The strongest statements this folder makes
  are geometric.
- `hhip` has no *Drosophila* counterpart by gene symbol or protein name, consistent with Hhip being a
  vertebrate innovation — but absence by annotation search is not absence in the genome.
