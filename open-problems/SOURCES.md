# SOURCES -- open-problems/

**Scope.** `problems.json` is the UNION of the named sources below. It is not, and cannot be, a list of all open problems in biology: no canonical exhaustive list exists. Coverage is weighted toward evolution and organism design because the `orx` queries were chosen that way.

Generated 2026-10-31T16:54:24Z. All times UTC.

## Counts

| source | problems |
|---|---|
| Wikipedia list (rev 1379882679) | 98 |
| Science 2005, Top 25 (biology-related titles) | 17 |
| Science 2005, 100 more (biology block) | 59 |
| orx discover results (screened abstracts) | 20 |
| Pelabon et al. 2025, via orx + Europe PMC | 12 |
| Sole et al. 2024, via orx + NCBI PMC | 9 |
| **total** | **215** |

| category | problems | quantitative |
|---|---|---|
| evolution | 64 | 27 |
| other | 46 | 5 |
| neuro | 30 | 2 |
| molecular | 25 | 6 |
| development | 13 | 8 |
| ecology | 11 | 6 |
| organism-design | 11 | 5 |
| origin-of-life | 8 | 0 |
| morphology-and-scaling | 7 | 7 |

Candidates: 80 for 47 eligible problems (quantitative, in evolution / organism-design / development / morphology-and-scaling); 44 have a non-empty `checkable_against`. Origins: {'proposed-here': 55, 'source-hypothesis+formalized-here': 2, 'source': 23}.

## 1. Wikipedia, 'List of unsolved problems in biology'

- Fetched 2026-10-31T16:42:28Z, HTTP 200: `https://en.wikipedia.org/w/api.php?action=parse&page=List_of_unsolved_problems_in_biology&prop=wikitext|revid&format=json&formatversion=2`
- Revision id **1379882679** (permalink https://en.wikipedia.org/w/index.php?title=List_of_unsolved_problems_in_biology&oldid=1379882679).
- All 98 top-level bullets were taken (all sections, not only biology-of-evolution ones). Sub-bullets (the protein-folding notes) are kept as `source_context`. Wiki markup and `<ref>` tags were stripped; the wording is otherwise the page's.
- The page carries a 'more citations needed' banner (March 2020); its problems are only as reliable as the page.

## 2. Science (2005) 125 questions, 'What Don't We Know?'

- 2026-10-31T16:42:44Z: `https://www.science.org/doi/10.1126/science.309.5731.75` -> **HTTP 403** (blocked to scripted access). `https://www.science.org/toc/science/309/5731` -> **HTTP 403**.
- Used instead: Internet Archive snapshots of Science's own free pages (the 2005 feature was published free to all visitors, per the page).
  - Top 25 index: `http://web.archive.org/web/20050703003106/http://www.sciencemag.org:80/sciext/125th/`, fetched 2026-10-31T16:43:52Z, HTTP 200. A 2021 snapshot (`.../web/20210817211510/https://www.sciencemag.org/site/feature/misc/webfeat/125th/`) was fetched for cross-check and lists the same 25 titles. Only titles were used; the 25 essays were not fetched. 17 of 25 are biology-related and included; excluded: universe composition, unified physics, Earth's interior, chemical self-assembly, limits of computing, quantum nonlocality, greenhouse warming, replacing oil.
  - 'So Much More to Know...' (doi:10.1126/science.309.5731.78b): requested `http://web.archive.org/web/2005/http://www.sciencemag.org/cgi/content/full/309/5731/78b`, served snapshot 20060117020008, fetched 2026-10-31T16:44:08Z, HTTP 200. The contiguous biology block (from 'Is there--or was there--life elsewhere in the solar system?' to 'What are human races, and how did they develop?') gives 60 questions; 'What are the limits of learning by machines?' was excluded as not biology, leaving 59. Each statement is the question plus its blurb, verbatim.
  - Also fetched for link discovery: `http://web.archive.org/web/2005/http://www.sciencemag.org/cgi/content/full/309/5731/102` (Malthus essay), 2026-10-31T16:44:08Z, HTTP 200; not otherwise used.

## 3. NVIDIA OpenResearch (`orx`, version 0.2.23, `~/.cargo/bin/orx.exe`)

`orx discover` issues no run identifier, so every orx-derived record has `run_identifier: null`. Each command was run with `--no-telemetry`; the time is when the command started.

| # | UTC start | exit | command |
|---|---|---|---|
| r1 | 2026-10-31T16:44:40Z | 0 | `orx discover openalex --limit 15 --no-telemetry "open problems evolutionary biology"` |
| r2 | 2026-10-31T16:44:40Z | 0 | `orx discover openalex --limit 15 --no-telemetry "unsolved questions organismal morphology"` |
| r3 | 2026-10-31T16:44:41Z | 0 | `orx discover openalex --limit 15 --no-telemetry "evolvability open questions"` |
| r4 | 2026-10-31T16:44:41Z | 0 | `orx discover openalex --limit 15 --no-telemetry "origin of novel structures"` |
| r5 | 2026-10-31T16:44:42Z | 0 | `orx discover openalex --limit 15 --no-telemetry "evolutionary novelty unresolved questions"` |
| r6 | 2026-10-31T16:44:43Z | 0 | `orx discover openalex --limit 15 --no-telemetry "allometry scaling open questions"` |
| r7 | 2026-10-31T16:44:43Z | 0 | `orx discover pubmed --limit 15 --no-telemetry "open problems evolutionary biology"` |
| r8 | 2026-10-31T16:44:44Z | 0 | `orx discover pubmed --limit 15 --no-telemetry "unsolved questions organismal morphology"` |
| r9 | 2026-10-31T16:44:46Z | 0 | `orx discover pubmed --limit 15 --no-telemetry "evolvability open questions"` |
| r10 | 2026-10-31T16:44:47Z | 0 | `orx discover pubmed --limit 15 --no-telemetry "origin of novel structures"` |
| r11 | 2026-10-31T16:44:50Z | 0 | `orx discover pubmed --limit 15 --no-telemetry "evolutionary novelty unresolved questions"` |
| r12 | 2026-10-31T16:44:53Z | 0 | `orx discover pubmed --limit 15 --no-telemetry "allometry scaling open questions"` |
| r13 | 2026-10-31T16:45:25Z | 0 | `orx discover openalex --limit 10 --no-telemetry "limits to maximum body size unresolved"` |
| r14 | 2026-10-31T16:45:25Z | 0 | `orx discover openalex --limit 10 --no-telemetry "Paleozoic insect gigantism oxygen hypothesis"` |
| r15 | 2026-10-31T16:45:25Z | 0 | `orx discover openalex --limit 10 --no-telemetry "paradox of sex maintenance twofold cost unresolved"` |
| r16 | 2026-10-31T16:45:26Z | 0 | `orx discover openalex --limit 10 --no-telemetry "molecular clock rate variation unresolved question"` |
| r17 | 2026-10-31T16:45:26Z | 0 | `orx discover pubmed --limit 10 --no-telemetry "limits to maximum body size unresolved"` |
| r18 | 2026-10-31T16:45:26Z | 0 | `orx discover pubmed --limit 10 --no-telemetry "Paleozoic insect gigantism oxygen hypothesis"` |
| r19 | 2026-10-31T16:45:29Z | 0 | `orx discover pubmed --limit 10 --no-telemetry "paradox of sex maintenance twofold cost unresolved"` |
| r20 | 2026-10-31T16:45:29Z | 0 | `orx discover pubmed --limit 10 --no-telemetry "molecular clock rate variation unresolved question"` |
| p1 | 2026-10-31T16:47:32Z | 0 | `orx paper --no-telemetry 39741147` |

**Screening rule.** Of the 193 results returned, a result yielded a problem only if its returned abstract states an open or unresolved question in evolution, organism design, development or morphology/scaling. That sentence is copied verbatim as the statement. Most results were off-topic (keyword matches in chemistry, economics, clinical medicine) or did not state an open problem; they were not used. Results that were used:

- r1[9] -> ORX-01
- r1[10] -> ORX-02
- r2[1] -> ORX-03
- r2[10] -> ORX-04
- r2[14] -> ORX-05
- r3[10] -> EVO-01..12 (full text fetched separately)
- r4[1] -> ORX-06
- r5[0] -> ORX-07
- r5[5] -> ORX-08
- r5[8] -> ORX-09
- r6[13] -> ORX-10
- r7[1] -> SMC-01..09 (full text fetched separately)
- r8[2] -> ORX-11
- r9[9] -> ORX-12
- r11[0] -> ORX-13
- r12[2] -> ORX-14
- r12[3] -> ORX-15
- r13[0] -> ORX-16
- r14[1] -> ORX-18/C1
- r14[4] -> ORX-17
- r14[5] -> SCI100-53/C2
- r14[8] -> ORX-18
- r15[0] -> ORX-19
- r15[1] -> WP-003/C2
- r15[2] -> WP-003/C1
- r16[7] -> ORX-20
- r18[1] -> ORX-18/C3

Off-topic results in the 'unsolved' and 'open questions' queries that did state an open problem but fall outside the target areas, and so were not extracted: marine fungi (r2[0]), soil viruses (r2[2]), ferroptosis (r2[3]), reticulophagy (r2[4]), Chagas disease (r2[5], r2[7]), sperm-egg recognition (r2[6]), mammalian fertilization (r2[8]), social lives of viruses (r3[4]). These sources were not mined, so the list is incomplete for those fields.

### Follow-up full-text fetches for two orx hits

- `orx paper --no-telemetry 39741147` (see table, p1): metadata for Sole et al. 2024, 'Open problems in synthetic multicellularity', with a PMC full-text link.
  - 2026-10-31T16:47:41Z `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=11688451&rettype=xml`, HTTP 200. The 9 subsections of 'Open problems' became SMC-01..09.
- Pelabon et al. 2025, 'Evolvability: progress and key questions' (orx result r3[10]):
  - 2026-10-31T16:48:06Z `https://academic.oup.com/bioscience/article/doi/10.1093/biosci/biaf111` -> **HTTP 403**.
  - 2026-10-31T16:48:06Z OpenAlex `https://api.openalex.org/works/doi:10.1093/biosci/biaf111?select=open_access,best_oa_location`, HTTP 200: hybrid open access.
  - 2026-10-31T16:48:06Z NCBI PMC ID converter (old URL, with tool/email query parameters): HTTP 301 redirect, not followed, not used.
  - 2026-10-31T16:48:14Z Europe PMC search `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1093/biosci/biaf111&format=json&resultType=lite`, HTTP 200 -> PMC12683529.
  - 2026-10-31T16:48:21Z `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12683529/fullTextXML`, HTTP 200. The 12 numbered 'Key research questions' became EVO-01..12.

## Not reached / limitations

- science.org (the original Science article and issue TOC): HTTP 403. The Internet Archive copies of Science's own free pages were used instead.
- academic.oup.com (BioScience): HTTP 403. The Europe PMC full text was used instead.
- The 25 Science Top-25 essays were not fetched; only their titles are used.
- orx abstracts are as returned by orx (OpenAlex/PubMed). For orx-only problems the papers' full texts were not read, apart from the two follow-ups above.
- Category, `quantitative` and the named `quantity` are judgements made here, not the sources'. Problems are not deduplicated across sources (e.g. maintenance of sex appears as WP-003 and ORX-19; organ size as WP-025 and SCI100-14), so each problem traces to exactly one source.

## Candidates: provenance rules

- `proposed-here`: written in this run. Not literature. Where a hypothesis of the same general form is known to exist in the literature but no source was fetched for it here, `notes` says so and no citation is given.
- `source`: the candidate is a hypothesis or result stated in the cited source (the locator says where). Quantities marked '(source)' are the source's numbers.
- `source-hypothesis+formalized-here`: the hypothesis is the source's, but the quantitative condition was added here.
- `uses_illustrative_values: true`: numbers such as mu = 1e-9 /site/yr or a 0.1 m starting wingspan were chosen here to make the candidate concrete. They are not sourced.
- `checkable_against` lists which of the seven informal constraints could rule on the candidate; [] means none could. The constraints were not applied.
