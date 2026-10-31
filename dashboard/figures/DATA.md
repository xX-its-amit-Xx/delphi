# Data record for the three flight figures

Every number on `dashboard/public/deck/fig/flight_cladogram.png`,
`flight_assembly_gap.png` and `flight_gene_families.png` came out of a public API call made by
`dashboard/figures/fetch_sources.py`. That script writes the raw response, the full request URL
and the retrieval time into `dashboard/figures/cache/*.json`, and
`dashboard/figures/make_flight_figures.py` reads only that cache. Nothing on the figures is
recalled, inferred or filled in: a value that could not be fetched is either marked
"not established" on the figure or the row is dropped, and both cases are listed below.

All fetching was done on **2026-10-31** (UTC timestamps per call are in the cache files).
Reproduce with:

```
python dashboard/figures/fetch_sources.py          # refetch everything into cache/
python dashboard/figures/make_flight_figures.py    # redraw all three figures
```

`make_flight_figures.py` needs matplotlib; `fetch_sources.py` needs only the standard library.

## The one thing on these figures that is not fetched

**How a taxon moves through the air** (powered flapping flight / gliding on a membrane or fin /
neither) is a literature-level category. No endpoint returns it, so it is asserted in the
`MODE` table in `make_flight_figures.py` and every figure that uses it says on its face that it
is a literature category and not an API value. The assignments are: powered — Diptera, Aves,
Chiroptera; gliding — Exocoetidae, Pteromyini, Cynocephalidae; neither — Arachnida, Belonidae,
Crocodylia, Felidae, Sciurini, Hominidae.

Everything else — topology, taxids, assembly counts, fossil dates, gene presence, orthogroup
membership — is fetched.

---

## Figure 1 — `flight_cladogram.png`

### 1a. Topology and taxids — NCBI Datasets v2 taxonomy

* Endpoint: `https://api.ncbi.nlm.nih.gov/datasets/v2/taxonomy/taxon/<taxid>`
* Calls: 12, one per tip taxon. Retrieved 2026-10-31T16:16:23Z – 16:16:31Z.
* All 12 returned HTTP 200 with a `taxonomy_nodes[0].taxonomy` object. **No failures.**
* What was used: the `lineage` array (the ordered list of ancestor taxids) and `rank`.

The cladogram is built by `build_tree()` purely from those 12 lineage arrays: for every distinct
set of tips, the deepest taxid shared by exactly that set is taken as the node. This recovers
ten internal nodes, which is what the figure draws:

| node taxid | name | rank | tips below |
| --- | --- | --- | --- |
| 33213 | Bilateria | clade | all 12 |
| 117571 | Euteleostomi | clade | 10 |
| 32524 | Amniota | clade | 8 |
| 1437010 | Boreoeutheria | clade | 6 |
| 314146 | Euarchontoglires | superorder | 4 |
| 6656 | Arthropoda | phylum | Diptera, Arachnida |
| 123731 | Belonoidei | suborder | Exocoetidae, Belonidae |
| 8492 | Archosauria | clade | Aves, Crocodylia |
| 314145 | Laurasiatheria | superorder | Chiroptera, Felidae |
| 9991 | Sciurinae | subfamily | Pteromyini, Sciurini |

* Endpoint for the node names: `https://api.ncbi.nlm.nih.gov/datasets/v2/taxonomy/taxon/<ids>`
  (batched, 40 ids per call). Retrieved 2026-10-31T16:30:00Z. **80 of 80 lineage taxids resolved**;
  `unresolved` in `cache/ncbi_lineage_names.json` is empty.

**Stated on the figure as orientation, not measurement.** NCBI Taxonomy is a nested
classification, not a dated phylogeny. The drawing has no branch lengths and no divergence
times, and the horizontal axis carries no meaning. The figure says this in its footnote.

**A choice worth recording:** NCBI nests Pteromyini (flying squirrels) *inside* Sciuridae, so
Sciuridae cannot sit beside it as a sister tip. The figure therefore uses **Sciurini** (tree
squirrels, taxid 337752), the sister tribe within Sciurinae, as the non-gliding squirrel tip.
This was changed after an initial fetch that used Sciuridae; both fetches are reproducible from
the script.

### 1b. Genome assembly counts — NCBI Datasets v2 genome

* Endpoint: `https://api.ncbi.nlm.nih.gov/datasets/v2/genome/taxon/<taxid>/dataset_report?page_size=1`
* And the same call with `&filters.reference_only=true` for the reference subset.
* Calls: 24 (12 taxa x 2). All HTTP 200. **No failures.**
* Field used: `total_count`. The first report in the unfiltered response supplies the example
  assembly accession, organism, assembly level and scaffold N50 used in figure 2.

These counts independently reproduce `dashboard/public/inventory.json` for every taxon the two
have in common (Exocoetidae 1, Aves 4041, Chiroptera 349, Cynocephalidae 6, Diptera 2345), which
is a useful cross-check on the repo's existing inventory.

### 1c. Oldest fossil occurrence — Paleobiology Database

* Endpoint: `https://paleobiodb.org/data1.2/taxa/single.json?name=<taxon>&show=app`
* Calls: 12. All HTTP 200, all returned exactly one record, **no warnings and no failures.**
* Fields used: `fea` / `fla` (first appearance, max and min Ma) and `noc` (occurrence count).

The Exocoetidae value, 56–48.07 Ma from 7 occurrences, matches `lean/bound/parameters.json`
exactly — an independent confirmation of the number that thread's bound rests on.

### Combined table, as NCBI and PBDB report it

| taxon | NCBI taxid | assemblies | reference_only | oldest fossil, Ma | PBDB occurrences |
| --- | --- | --- | --- | --- | --- |
| Diptera (flies) | 7147 | 2,345 | 974 | 390.5–387.95 | 8,457 |
| Arachnida (spiders, mites) | 6854 | 525 | 295 | 438.6–432.9 | 3,960 |
| Exocoetidae (flying fishes) | 76072 | 1 | 1 | 56–48.07 | 7 |
| Belonidae (needlefishes) | 94935 | 8 | 3 | 37.71–33.9 | 32 |
| Aves (birds) | 8782 | 4,041 | 2,022 | 161.5–154.8 | 15,225 |
| Crocodylia (crocodilians) | 1294634 | 27 | 9 | 237–227.3 | 3,273 |
| Chiroptera (bats) | 9397 | 349 | 170 | 56–51.1 | 1,707 |
| Felidae (cats) | 9681 | 94 | 23 | 33.9–29.5 | 2,059 |
| Pteromyini (flying squirrels) | 337748 | 5 | 4 | 23.04–15.98 | 4 |
| Sciurini (tree squirrels) | 337752 | 9 | 3 | 41.03–37.71 | 184 |
| Cynocephalidae (colugos) | 30657 | 6 | 2 | 15.98–13.82 | 7 |
| Hominidae (great apes) | 9604 | 2,660 | 7 | 23.04–15.98 | 619 |

The Diptera, Crocodylia and Sciurini rows above are PBDB's reported values. The figure
shows three of them corrected and one flagged; see the correction sections below.

### What figure 1 does not claim

* No divergence dates. A PBDB first appearance is the age of the oldest *fossil occurrence*
  assigned to that taxon, which is a minimum age for the lineage, not an origin date.
* No count of evolutionary origins of flight. The figure states that flight and gliding appear
  on six separate branches of the drawn nesting and that each has a non-flying sister group
  here, which is a description of the picture, not an ancestral-state reconstruction.

### Data correction: Diptera first appearance

**The correction is ours. PBDB still returns 390.5 Ma** for Diptera from
`taxa/single.json?name=Diptera&show=app` (re-checked 2026-10-31T16:38Z). The figure shows
247–245.19 Ma, marked †, with PBDB's 390.5–387.95 printed beside it and struck through.

What sets PBDB's 390.5 Ma, and why we do not use it:

* **The record:** `occ:1656545`, entered as *"Schizophora blankenheimensis"*, Late Eifelian
  (Middle Devonian), 390.5–387.95 Ma, in collection `col:235174`, Germany. PBDB resolves it to
  `txn:255565` Schizophora, which it classifies under Insecta › Diptera (396 occurrences).
* **The reference:** `ref:88595` — B. R. Schöne, M. Basse and A. May (1999), *Korrelationen des
  Eifelium/Givetium-Grenzbereichs im Rheinischen Schiefergebirge*, Senckenbergiana lethaea
  77(1):233–242, doi:10.1007/BF03043742. A Devonian stratigraphy paper.
* **The rest of the collection:** `col:235174` holds 5 occurrences — 2 Trilobita, 1 Conodonta,
  1 Rhynchonellata (a brachiopod) and this one "insect". A marine assemblage.
* **The two empty intervals:** PBDB holds **0** Diptera occurrences in the **Carboniferous** and
  **0** in the **Permian**, against **1** in the Devonian and **75** in the Triassic. The
  Devonian record is isolated by about 143 million years from the next Diptera record.
* **The next-oldest record**, used on the figure: `occ:964190`, *Louisa nova*, Aegean (Middle
  Triassic), **247–245.19 Ma**, reference `ref:36813` — W. Krzemiński and E. Krzemińska (2003),
  *Triassic Diptera: descriptions, revisions and phylogenetic relations*, Acta Zoologica
  Cracoviensia 46(Suppl):153–184. At least three more Diptera from the same reference share that age.

Our reading is that a genus name in a Devonian marine paper has been resolved onto the
dipteran section Schizophora — a **probable genus-name homonym**. "Probable" is deliberate: we
have not seen the 1999 paper's text, only PBDB's record of it, its collection-mates and its
title. The coordinator flagged this first; every fact above was re-fetched by this thread
rather than taken from that message.

Endpoints, all HTTP 200, retrieved 2026-10-31T16:38:05Z – 16:38:37Z (per-call times in
`cache/pbdb_oldest.json`):

```
https://paleobiodb.org/data1.2/occs/list.json?base_name=Diptera&max_ma=391.5&min_ma=330.5&timerule=overlap&show=ref
https://paleobiodb.org/data1.2/occs/list.json?base_name=Diptera&interval=Devonian&show=ref       -> 1
https://paleobiodb.org/data1.2/occs/list.json?base_name=Diptera&interval=Carboniferous&show=ref  -> 0
https://paleobiodb.org/data1.2/occs/list.json?base_name=Diptera&interval=Permian&show=ref        -> 0
https://paleobiodb.org/data1.2/occs/list.json?base_name=Diptera&interval=Triassic&show=ref       -> 75
https://paleobiodb.org/data1.2/taxa/single.json?name=Schizophora&show=class,app
https://paleobiodb.org/data1.2/refs/single.json?id=88595
https://paleobiodb.org/data1.2/occs/single.json?id=1656545&show=ref,class,loc
https://paleobiodb.org/data1.2/occs/single.json?id=964190&show=ref,class,loc
https://paleobiodb.org/data1.2/occs/list.json?coll_id=235174&show=class
```

`occs/list.json?...&order=max_ma.desc` — a value PBDB's own error message lists as valid —
returned **HTTP 400** ("Bad value for parameter 'order' (was 'max_ma')"), so oldest-first
ordering is done client-side on `eag` instead.

### Sanity check of the other eleven PBDB first appearances

Same method for every taxon: all occurrences overlapping a 60-Myr window starting at PBDB's
reported first appearance, sorted by early age, to see what record sets the date and how far
behind the next one is. Endpoint
`https://paleobiodb.org/data1.2/occs/list.json?base_name=<taxon>&max_ma=<fea+1>&min_ma=<fea-60>&timerule=overlap&show=ref`,
12 calls, all HTTP 200, retrieved 2026-10-31T16:38Z.

| taxon | PBDB first app. | set by | next older age | verdict |
| --- | --- | --- | --- | --- |
| Diptera | 390.5 | 1 record, occ:1656545 | 247 (next query) | **error, corrected †** (above) |
| Arachnida | 438.6 | 2 records, 2 references (*Palaeophonus*) | 432.9 | consistent |
| Exocoetidae | 56 | 2 records, **1 reference** (Bannikov 2014; *Rhamphexocoetus volans* and "*Engraulis*" *evolans*, Italy) | 37.71 | consistent, but single-source |
| Belonidae | 37.71 | 2 records, 2 references | 23.04 | consistent |
| Aves | 161.5 | 4 records, 4 references; the oldest is *Praeornis sharovi* (occ:1448725), the others a footprint taxon and two "Aves indet." dated only to 161.5–100.5 | 154.8 (Archaeopterygiformes) | consistent within PBDB's broad Aves; not marked |
| Crocodylia | 237 | occ:621595 "*Walteria*", then footprint and bite-trace taxa | 201.4 (first body fossil) | **error plus definition, corrected †** (below) |
| Chiroptera | 56 | 62 records, 34 references | 51.1 | robust |
| Felidae | 33.9 | 1 record, *Proailurus* sp. | 31.8 | consistent |
| Pteromyini | 23.04 | 3 records, 2 references, all "Pteromyini indet." | 5.09 | consistent but thin (4 occurrences in all) |
| Sciurini | 41.03 | 1 record, occ:1349001 *Plesiarctomys spectabilis* | 37 | **classification error, corrected †** (below) |
| Cynocephalidae | 15.98 | 1 record, occ:227167 | 5.333 | **doubtful, flagged ‡** (below) |
| Hominidae | 23.04 | 2 records, 2 references | 20.45 | consistent |

**Exocoetidae is unchanged**, and it is the value `lean/bound/parameters.json` uses. It is worth
the lean thread knowing that the 56–48.07 Ma bound rests on two occurrences from a single
reference (A. F. Bannikov 2014), with the next Exocoetidae record at 37.71 Ma.

### Data correction: Crocodylia first appearance

**The correction is ours. PBDB still returns 237 Ma.** The figure shows 201.4–192.9 Ma, marked
†, with 237–227.3 struck through. Two separate things are going on, and the figure names both.

1. **A probable error.** The 237 Ma date is set by `occ:621595`, "*Walteria* sp.", Carnian,
   Slovenia, from Turnšek, Buser and Ogorelec (1987), *Upper Carnian reef limestone in clastic
   beds at Perbla near Tolmin*. PBDB files *Walteria* under Reptilia › Crocodylia, "replaced by"
   *Mehliella* (2 occurrences in all). The other 20 occurrences in that collection (`col:66930`)
   are 8 Cnidaria (all Anthozoa), 8 Porifera, 4 Foraminifera — a sponge–coral reef. The same
   pattern as Diptera: a name in a marine-carbonate paper resolved onto a vertebrate.
2. **Then trace fossils.** The next two records are ichnotaxa — *Dijaquesopus obliquus*
   (occ:1484801, Carnian, Lesotho; an *-opus* footprint name, from Ellenberger 1970) and *Nihilichnus nihilicus* (occ:1211201,
   bite traces, Norian, Poland, from a paper on bite traces on dicynodont bones). A trace cannot
   be assigned to a crown group, so the figure uses the oldest body fossil.
3. **The age shown:** `occ:699894`, "Crocodylia indet.", Hettangian, South Africa,
   **201.4–192.9 Ma** — Kitching and Raath (1984), Elliot and Clarens Formations.
4. **And a definitional difference that remains.** Even 201.4 Ma is PBDB's broad use of
   Crocodylia; it is not the crown group. We did not fetch a crown-group age from any source, so
   none is drawn; the figure says "a definitional difference, not a data error" for this part.

### Data correction: Sciurini first appearance

**The correction is ours. PBDB still returns 41.03 Ma.** The record setting it is
`occ:1349001`, entered as *Plesiarctomys spectabilis*, Bartonian, Switzerland (Costeur and
Schneider 2011, a type catalogue of Eocene mammals at the Natural History Museum Basel). PBDB's
accepted name for it is *Sciurus spectabilis*, which places it in Sciurini — but PBDB's own
taxon record for the genus *Plesiarctomys* (`txn:41409`) sits in **Ischyromyidae**, not
Sciuridae. PBDB disagrees with itself, so the figure uses the next record: `occ:2064049`,
*Protosciurus* cf. *mengi*, Chadronian, **37–33.9 Ma** (Korth 2017). Note that Korth's fauna is
described as a mixed Eocene–Oligocene assemblage. The shift is 4 Myr and changes nothing about
the figure's argument; it is corrected because it is the same kind of name-resolution error.

### Flag: Cynocephalidae first appearance (not corrected)

The 15.98–13.82 Ma value is shown as PBDB gives it, marked ‡ as doubtful. All **7** PBDB
occurrences under Cynocephalidae are "Galeopithecidae indet." from Kenya, Ethiopia, Tanzania and
South Africa, taken from papers on primates (Pickford 1982), antelopes (Vrba and Gatesy 1994),
Omo cercopithecids (Eck 1977), Omo hominids (Howell and Coppens 1973), Miocene vertebrates
(Hendey 1978), a paper by Kalb et al., and palynology (Bonnefille 1976). None is a named
colugo. PBDB classifies Galeopithecidae as Dermoptera, so the records count as colugos. There is
no better PBDB record to substitute, so the value stays, with the doubt stated on the figure.
What these records actually are we cannot say from PBDB alone.

Endpoints for the three sections above, all HTTP 200, 2026-10-31T16:38Z:

```
https://paleobiodb.org/data1.2/taxa/list.json?name=Walteria&show=class,app,attr
https://paleobiodb.org/data1.2/taxa/list.json?name=Mehliella&show=class,app,attr
https://paleobiodb.org/data1.2/taxa/list.json?name=Plesiarctomys&show=class,app,attr
https://paleobiodb.org/data1.2/taxa/list.json?name=Galeopithecidae&show=class,app,attr
https://paleobiodb.org/data1.2/taxa/list.json?name=Praeornis&show=class,app,attr
https://paleobiodb.org/data1.2/occs/list.json?base_name=Cynocephalidae&show=loc,ref
https://paleobiodb.org/data1.2/occs/list.json?coll_id=66930&show=class
https://paleobiodb.org/data1.2/occs/single.json?id=<n>&show=ref,class,loc   for occ 621595, 1484801,
    1211201, 699894, 1349001, 2064049, 227167, 1364420, 1364422
```

The corrected ages on the figure are read by `fossil_cell()` in `make_flight_figures.py` from
those fetched occurrence records, not typed in.


---

## Figure 2 — `flight_assembly_gap.png`

Same assembly counts as 1b, plotted on a log x axis, plus:

* The example assembly for Exocoetidae, taken verbatim from the first report of the unfiltered
  `dataset_report` call: **GCA_018398805.1**, *Hirundichthys speculiger*, assembly level
  **Scaffold**, scaffold N50 **1,152,470**, total length 1,043,046,751 bp, released 2021-05-19,
  submitted by Shenzhen Key Lab of Marine Genomics (BioProject PRJNA714815).
* OrthoDB annotated-genome counts per clade (see 3c below): **419 bird species, 0 for the whole
  suborder Belonoidei.**

### Caveat recorded on the figure

`filters.reference_only=true` is NCBI's own flag; the figure calls the mark "of which NCBI flags
reference_only" rather than asserting what a reference genome is. And an assembly count is
sampling effort, not diversity — these taxa contain very different numbers of species, and the
figure says so. Hominidae's 2,660 assemblies are overwhelmingly human resequencing, which is
why its reference_only count is 7.

---

## Figure 3 — `flight_gene_families.png`

### 3a. Seed proteins — UniProtKB REST

* Endpoint: `https://rest.uniprot.org/uniprotkb/search?query=gene:<GENE>+AND+organism_id:<taxid>+AND+reviewed:true&format=json&size=5&fields=accession,id,gene_names,protein_name,organism_id,reviewed,xref_orthodb`
* Calls: **64** (8 genes x 8 species). All HTTP 200. **No failures, no rate limiting.**
* Results were then filtered to entries whose own `organism.taxonId` equals the queried taxid.
* **15 of the 64 queries returned a reviewed entry.** Full list:

| gene | species | accession | entry |
| --- | --- | --- | --- |
| TBX5 | *Danio rerio* | Q9IAK8 | TBX5A_DANRE (gene `tbx5a`, synonym `tbx5`) |
| TBX5 | *Gallus gallus* | Q9PWE8 | TBX5_CHICK |
| TBX5 | *Homo sapiens* | Q99593 | TBX5_HUMAN |
| SHH | *Danio rerio* | Q92008 | SHH_DANRE (gene `shha`, synonym `shh`) |
| SHH | *Gallus gallus* | Q91035 | SHH_CHICK |
| SHH | *Homo sapiens* | Q15465 | SHH_HUMAN |
| FGF10 | *Homo sapiens* | O15520 | FGF10_HUMAN |
| HOXD13 | *Danio rerio* | Q90472 | HXDDA_DANRE (gene `hoxd13a`) |
| HOXD13 | *Gallus gallus* | P24344 | HXD13_CHICK |
| HOXD13 | *Homo sapiens* | P35453 | HXD13_HUMAN |
| PAX1 | *Gallus gallus* | P47236 | PAX1_CHICK |
| PAX1 | *Homo sapiens* | P15863 | PAX1_HUMAN |
| vg | *Drosophila melanogaster* | Q26366 | VG_DROME |
| ap | *Drosophila melanogaster* | P29673, P91926 | APTE_DROME, AP2A_DROME |
| nub | *Drosophila melanogaster* | P31368 | PDM1_DROME |

**This presence/absence table is NOT shown as a figure, and deliberately so.** The 49 zeros are
dominated by Swiss-Prot curation coverage, not by gene absence: *Myotis lucifugus*,
*Ictidomys tridecemlineatus*, *Galeopterus variegatus* and *Oryzias latipes* returned 0 for every
one of the eight genes, which is a statement about UniProt review status and nothing else.
Drawing it would have invited exactly the misreading the brief warns about, so it is kept here
as a record and the figure is built on orthogroups instead.

**A false positive to note:** the `gene:ap` query also returned **P91926 (AP2A_DROME**,
transcription factor AP-2), whose gene name `AP-2alpha` matched the three-letter query. The seed
used for *apterous* is **P29673 (APTE_DROME)**, chosen explicitly, not the first hit.

### 3b. Orthogroups — OrthoDB

* Search: `https://data.orthodb.org/current/search?query=<accession>&level=33208&species=33208&limit=5`
* Group metadata: `https://data.orthodb.org/current/group?id=<orthogroup>`
* Membership: `https://data.orthodb.org/current/orthologs?id=<orthogroup>&species=<comma-separated taxids>`
* Calls: 8 searches + 7 group + 7 orthologs. All HTTP 200. Retrieved
  2026-10-31T16:28:46Z – 16:29:05Z (a re-fetch; an earlier run at 16:09Z returned the same
  orthogroup ids, and the step was re-run after adding the InterPro field and correcting one
  clade label).
* Level: **Metazoa, NCBI taxid 33208.**

| gene | seed UniProt | OrthoDB orthogroup | OrthoDB group name | top InterPro domain | genes in group | species in group |
| --- | --- | --- | --- | --- | --- | --- |
| TBX5 | Q99593 | 336089at33208 | T-box transcription factor | T-box transcription factor, DNA-binding domain | 2,466 | 1,129 |
| SHH | Q15465 | 6352123at33208 | hedgehog | Hedgehog Signaling | 5,390 | 2,234 |
| FGF10 | O15520 | 5685397at33208 | `10` | Fibroblast growth factor family | 4,388 | 1,159 |
| HOXD13 | P35453 | 3110492at33208 | homeobox C13 | Homeodomain | 4,376 | 1,150 |
| vg | Q26366 | 6214492at33208 | vestigial like family member 3 | Vestigial family | 3,479 | 2,103 |
| ap | P29673 | 6365979at33208 | LIM homeobox 9 | Homeodomain | 4,102 | 2,187 |
| nub | P31368 | 5942086at33208 | POU class 3 homeobox 3 | POU-specific domain | 13,222 | 2,335 |

OrthoDB's own free-text name for the FGF group is the fragment `10`, so the figure labels rows
with the InterPro domain OrthoDB counts most often in the group instead, and says so.

**DROPPED: PAX1.** The OrthoDB search on P15863 at Metazoa level returned **two** orthogroups,
not one. A single unambiguous group is required for a row to mean anything, so the row was
dropped rather than one group being picked. The figure prints this drop in its footnote. (For
the record, the UniProt entries' own Eukaryota-level OrthoDB cross-reference puts PAX1 and
HOXD13 in the same group, `6159439at2759` — a demonstration of how coarse the Eukaryota level
is, and the reason this figure works at Metazoa level instead.)

### Cell values as drawn — genes per species in the orthogroup

| gene | *D. melanogaster* | *D. rerio* | *O. latipes* | *H. speculiger* | *G. gallus* | *M. lucifugus* | *G. volans* | *G. variegatus* | *H. sapiens* |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TBX5 | 0 | 3 | 3 | 0 | 2 | 2 | 1 | 2 | 4 |
| SHH | 1 | 5 | 4 | 0 | 3 | 2 | 3 | 6 | 6 |
| FGF10 | 0 | 5 | 5 | 0 | 2 | 3 | 3 | 4 | 7 |
| HOXD13 | 0 | 5 | 4 | 0 | 4 | 4 | 4 | 4 | 8 |
| vg | 1 | 2 | 2 | 0 | 2 | 2 | 2 | 2 | 4 |
| ap | 1 | 3 | 2 | 0 | 2 | 2 | 2 | 2 | 4 |
| nub | 5 | 12 | 13 | 0 | 8 | 8 | 9 | 9 | 18 |

### 3c. The empty flying-fish column — OrthoDB clade coverage

The *H. speculiger* column is all zeros. That had to be explained rather than left to be read as
gene absence, so coverage was probed directly: every one of the seven retained orthogroups was
queried with `/orthologs?id=<og>&species=<clade taxid>` and the union of species returned was
taken. 77 calls, all HTTP 200, **no failures.** Retrieved 2026-10-31T16:14:16Z. This probe ran
before the orthogroup re-fetch above; the seven orthogroup ids it used are identical to the ones
in the current `orthodb_groups.json`, so the two are consistent.

| clade | taxid | species OrthoDB has |
| --- | --- | --- |
| Belonoidei (flying fishes, needlefishes, halfbeaks) | 123731 | **0** |
| Exocoetidae (flying fishes) | 76072 | **0** |
| Belonidae (needlefishes) | 94935 | **0** |
| Beloniformes (the flying fish's order) | 76071 | 3 — *Oryzias javanicus, O. latipes, O. melastigma* |
| Aves | 8782 | 419 |
| Chiroptera | 9397 | 41 |
| Sciuridae | 55153 | 11 (including *Glaucomys volans*) |
| Pteromyini (flying squirrels) | 337748 | 1 — *Glaucomys volans* |
| Cynocephalidae (colugos) | 30657 | 2 — *Cynocephalus volans, Galeopterus variegatus* |
| Diptera | 7147 | 196 |
| Hominidae | 9604 | 7 |

Zero across all seven independent orthogroups is strong evidence that OrthoDB has no annotated
genome under that clade at all, rather than that one group happens to miss it. The figure states
the conclusion in those terms: the column is empty because there is no annotated genome, not
because the genes are absent from flying fishes.

### What figure 3 does not claim

* **It is not a one-to-one orthology matrix.** An OrthoDB Metazoa-level orthogroup is a gene
  family. A cell of 4 for *H. sapiens* in the TBX5 row means human contributes four genes to the
  T-box family group that human TBX5 sits in, not four TBX5 orthologs.
* **A 0 is not "this species has no homologue."** It means that species contributes no gene to
  *that* group. Drosophila's 0 in the TBX5 row does not mean flies have no T-box genes; it means
  OrthoDB does not place any fly gene in the particular Metazoa group containing human TBX5.
* **No sequence identities, anywhere.** None were fetched and none are drawn. The figures state
  no percentage identity between any pair of sequences.

### The finding, and how it differs from what was expected

The brief anticipated that the insect wing genes would have no vertebrate ortholog. **The data
says the opposite, and the figure reports the data.** All three fly wing genes — *vestigial*,
*apterous*, *nubbin* — sit in Metazoa orthogroups that also contain vertebrate genes (the
Vestigial/VGLL family, the LIM-homeodomain family, the POU family), while three of the four
vertebrate limb and axial genes have no fly gene in their own group. The gene families are not
partitioned into "wing genes" and "limb genes" at all: they are shared across animals with and
without wings. That is a stronger version of the point the figures are for — a shared gene
family does not make a shared structure, so a convergent wing is not evidence of a shared wing
programme, and Darwin's flying fish would not need to invent a wing gene set to be reworked,
because there is no such set to invent.

---

## Things that could not be sourced

1. **Sequence identities between any pair of these taxa.** Not attempted and not drawn. Doing it
   honestly means running alignments, not calling an endpoint, and nothing on these figures needs
   one.
2. **Divergence dates.** Not fetched from any source, and the cladogram is explicitly undated.
3. **PAX1's orthogroup** (OrthoDB returned two at Metazoa level) — row dropped, drop printed on
   the figure.
4. **Any genomic or orthology data for Exocoetidae beyond the single assembly.** There is one
   GenBank assembly, scaffold level, and no annotated genome in OrthoDB for the whole suborder.
   This is not a gap in our fetching; it is the gap the second and third figures are about.
5. **An OrthoDB genome-listing endpoint.** A first attempt at the clade-coverage question used
   `https://data.orthodb.org/current/genomesearch?query=<name>`, which returned **HTTP 404 for all
   eleven queries** — the endpoint does not exist. That step was rewritten to use the working
   `/orthologs` endpoint, as described in 3c, and the cache now holds the working version, so the
   404s are recorded here rather than in a cache file.

No endpoint rate-limited or refused any of the calls that these figures ultimately rest on. The
one rate limit hit during exploration was NCBI's 5-requests-per-second cap on an ad-hoc name
lookup; `fetch_sources.py` sleeps between calls and never hit it.

## Files

| file | what it is |
| --- | --- |
| `dashboard/figures/fetch_sources.py` | every API call, with retries and refusal recording |
| `dashboard/figures/make_flight_figures.py` | the three figures, reading only the cache |
| `dashboard/figures/cache/ncbi_taxonomy.json` | 12 tip lineages, with URLs and timestamps |
| `dashboard/figures/cache/ncbi_lineage_names.json` | names and ranks for all 80 lineage taxids |
| `dashboard/figures/cache/ncbi_genomes.json` | assembly and reference counts, example assemblies |
| `dashboard/figures/cache/pbdb_appearances.json` | PBDB first/last appearance and occurrence counts |
| `dashboard/figures/cache/pbdb_oldest.json` | occurrence-level checks behind the PBDB corrections |
| `dashboard/figures/cache/uniprot_presence.json` | all 64 gene x species queries and their results |
| `dashboard/figures/cache/orthodb_groups.json` | orthogroup per seed, group metadata, per-species genes |
| `dashboard/figures/cache/orthodb_coverage.json` | the 77 clade-coverage probes |

The three figures are registered in `dashboard/public/deck/fig/manifest.json` with their sha256,
`shows` and `provenance`.
