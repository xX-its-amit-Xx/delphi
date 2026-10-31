# SEARCHES: every command and fetch for the prior-art check

All times UTC (from `date -u` immediately before each call). Raw outputs are under `raw/`.
The machine-readable log the table is built from is `_cmdlog.txt`.

## Notes that apply to every row

- **run_identifier: null** for every `orx discover` call. `orx discover` prints a JSON array of hits and issues no run
  identifier, so none is recorded. None was invented.
- All `orx` calls used `--no-telemetry`.
- **Privacy.** No request I built contains an email address, name or account identifier. Europe PMC, doi.org,
  Phenoscape KB and project-page fetches were plain GETs (curl, generic `Mozilla/5.0` user agent for the project pages,
  curl default otherwise) with no `email=` or `tool=` parameters. `orx discover pubmed` calls NCBI E-utilities itself.
  A scan of the `orx.exe` binary shows it reads an optional `NCBI_EMAIL` environment variable and contains the strings
  `tool`, `orx` and the vendor address `orx@alphaxiv.org`. `NCBI_EMAIL` was unset (checked with `env`, and `unset` before
  each PubMed batch), so at most orx's own vendor identifier was sent, never the user's. If that is unacceptable, use
  Europe PMC instead of `orx discover pubmed` next time.
- `doi.org/api/handles/<doi>` was queried for every DOI cited in `works.json` (58 DOIs, all HTTP 200;
  see `raw/doi-resolution.txt`).
- Bgee's homepage returned 403 to curl and the Physiome Project homepage did not answer (000), so neither is cited as a URL.
  Both are cited through DOIs instead. `ubergraph.apps.renci.org/` returned 404 and is not cited.

## Log

| # | time (UTC) | command or request | exit / HTTP | raw output |
|---|---|---|---|---|
| 1 | 2026-10-31T18:01:56Z | `orx discover openalex --no-telemetry --limit 12  "Phenoscape ontology evolutionary phenotypes fish fins candidate genes"` | exit=0 | raw/openalex-phenoscape.txt |
| 2 | 2026-10-31T18:02:07Z | `orx discover openalex --no-telemetry --limit 12  "Phenoscape fin ray fin-to-limb transition ontology annotation candidate genes zebrafish"` | exit=0 | raw/openalex-phenoscape-fin.txt |
| 3 | 2026-10-31T18:02:08Z | `orx discover openalex --no-telemetry --limit 12  "Uberon integrated cross-species anatomy ontology"` | exit=0 | raw/openalex-uberon.txt |
| 4 | 2026-10-31T18:02:08Z | `orx discover openalex --no-telemetry --limit 12  "Cell Ontology update cell types"` | exit=0 | raw/openalex-cl.txt |
| 5 | 2026-10-31T18:02:08Z | `orx discover openalex --no-telemetry --limit 12  "whole-cell computational model Mycoplasma genitalium predicts phenotype from genotype"` | exit=0 | raw/openalex-wholecell.txt |
| 6 | 2026-10-31T18:02:09Z | `orx discover openalex --no-telemetry --limit 12  "design and synthesis of a minimal bacterial genome JCVI-syn3.0"` | exit=0 | raw/openalex-syn3.txt |
| 7 | 2026-10-31T18:02:09Z | `orx discover openalex --no-telemetry --limit 12  "how to build the virtual cell with artificial intelligence priorities"` | exit=0 | raw/openalex-virtualcell.txt |
| 8 | 2026-10-31T18:02:09Z | `orx discover openalex --no-telemetry --limit 12  "IUPS Physiome Project multiscale modelling"` | exit=0 | raw/openalex-physiome.txt |
| 9 | 2026-10-31T18:02:09Z | `orx discover openalex --no-telemetry --limit 12  "Virtual Physiological Human integrative multiscale modelling"` | exit=0 | raw/openalex-vph.txt |
| 10 | 2026-10-31T18:02:10Z | `orx discover openalex --no-telemetry --limit 12  "OpenWorm Caenorhabditis elegans digital organism simulation"` | exit=0 | raw/openalex-openworm.txt |
| 11 | 2026-10-31T18:02:10Z | `orx discover openalex --no-telemetry --limit 12  "Monarch Initiative cross-species genotype phenotype integration ontology"` | exit=0 | raw/openalex-monarch.txt |
| 12 | 2026-10-31T18:02:10Z | `orx discover openalex --no-telemetry --limit 12  "Bgee gene expression anatomy ontology comparison across species"` | exit=0 | raw/openalex-bgee.txt |
| 13 | 2026-10-31T18:02:10Z | `orx discover openalex --no-telemetry --limit 12  "ZFIN zebrafish information network expression anatomy ontology"` | exit=0 | raw/openalex-zfin.txt |
| 14 | 2026-10-31T18:02:11Z | `orx discover openalex --no-telemetry --limit 12  "deep homology fin to limb Hox evolution"` | exit=0 | raw/openalex-deephom.txt |
| 15 | 2026-10-31T18:02:11Z | `orx discover openalex --no-telemetry --limit 12  "flying fish Exocoetidae pectoral fin gliding evolution"` | exit=0 | raw/openalex-flyingfish.txt |
| 16 | 2026-10-31T18:02:11Z | `orx discover openalex --no-telemetry --limit 12  "Exocoetidae genome pectoral fin enlargement genes"` | exit=0 | raw/openalex-flyingfish2.txt |
| 17 | 2026-10-31T18:02:11Z | `orx discover openalex --no-telemetry --limit 12  "formal verification proof assistant biological model Coq Lean"` | exit=0 | raw/openalex-formalbio.txt |
| 18 | 2026-10-31T18:02:12Z | `orx discover openalex --no-telemetry --limit 12  "model checking biological regulatory networks temporal logic"` | exit=0 | raw/openalex-modelcheck.txt |
| 19 | 2026-10-31T18:02:12Z | `orx discover openalex --no-telemetry --limit 12  "formal verification ontology consistency anatomy description logic reasoning"` | exit=0 | raw/openalex-ontoverify.txt |
| 20 | 2026-10-31T18:02:12Z | `orx discover openalex --no-telemetry --limit 12  "generative design of organisms artificial intelligence whole organism"` | exit=0 | raw/openalex-genorg.txt |
| 21 | 2026-10-31T18:02:13Z | `orx discover openalex --no-telemetry --limit 12  "levels of completeness organism model topology expression regulation development function"` | exit=0 | raw/openalex-levels.txt |
| 22 | 2026-10-31T18:02:13Z | `orx discover openalex --no-telemetry --limit 12  "virtual embryo multiscale model development anatomy ontology gene expression"` | exit=0 | raw/openalex-virtualembryo.txt |
| 23 | 2026-10-31T18:02:13Z | `orx discover openalex --no-telemetry --limit 12  "gene expression atlas anatomy ontology mouse EMAP GXD"` | exit=0 | raw/openalex-anatomyatlas.txt |
| 24 | 2026-10-31T18:02:45Z | `orx discover openalex --no-telemetry --limit 12  "anatomical structures cell types biomarkers Human Reference Atlas ASCT+B tables"` | exit=0 | raw/openalex-asctb.txt |
| 25 | 2026-10-31T18:02:46Z | `orx discover openalex --no-telemetry --limit 12  "Human Reference Atlas knowledge graph Uberon Cell Ontology"` | exit=0 | raw/openalex-hrakg.txt |
| 26 | 2026-10-31T18:02:46Z | `orx discover openalex --no-telemetry --limit 12  "Foundational Model of Anatomy ontology"` | exit=0 | raw/openalex-fma.txt |
| 27 | 2026-10-31T18:02:46Z | `orx discover openalex --no-telemetry --limit 12  "scalable pipeline for designing reconfigurable organisms"` | exit=0 | raw/openalex-xenobot.txt |
| 28 | 2026-10-31T18:02:47Z | `orx discover openalex --no-telemetry --limit 12  "sequence modeling and design from molecular to genome scale Evo"` | exit=0 | raw/openalex-evo.txt |
| 29 | 2026-10-31T18:02:47Z | `orx discover openalex --no-telemetry --limit 12  "generative design of novel bacteriophage genomes language model"` | exit=0 | raw/openalex-phagegen.txt |
| 30 | 2026-10-31T18:02:47Z | `orx discover openalex --no-telemetry --limit 12  "OpenWorm open-science approach to modeling Caenorhabditis elegans"` | exit=0 | raw/openalex-openworm2.txt |
| 31 | 2026-10-31T18:02:48Z | `orx discover openalex --no-telemetry --limit 12  "fin to limb transition ontology phenotype knowledgebase sarcopterygian characters"` | exit=0 | raw/openalex-finlimbonto.txt |
| 32 | 2026-10-31T18:02:48Z | `orx discover openalex --no-telemetry --limit 12  "connecting evolutionary morphology to genomics using ontologies Cypriniformes"` | exit=0 | raw/openalex-cypriniformes.txt |
| 33 | 2026-10-31T18:02:48Z | `orx discover openalex --no-telemetry --limit 12  "Lean 4 formalization biology theorem"` | exit=0 | raw/openalex-leanbio.txt |
| 34 | 2026-10-31T18:02:48Z | `orx discover openalex --no-telemetry --limit 12  "Coq proof assistant formal verification systems biology"` | exit=0 | raw/openalex-coqbio.txt |
| 35 | 2026-10-31T18:02:49Z | `orx discover openalex --no-telemetry --limit 12  "formal ontology mereology anatomy parthood axioms verification"` | exit=0 | raw/openalex-mereology.txt |
| 36 | 2026-10-31T18:02:49Z | `orx discover openalex --no-telemetry --limit 12  "genomic code genome generative model of the organism"` | exit=0 | raw/openalex-gencode.txt |
| 37 | 2026-10-31T18:02:49Z | `orx discover openalex --no-telemetry --limit 12  "AI virtual cell multiscale molecular cellular multicellular levels"` | exit=0 | raw/openalex-multiscalebio.txt |
| 38 | 2026-10-31T18:02:50Z | `orx discover openalex --no-telemetry --limit 12  "digital twin of an organism whole-body model"` | exit=0 | raw/openalex-digitaltwin.txt |
| 39 | 2026-10-31T18:02:50Z | `orx discover openalex --no-telemetry --limit 12  "Ubergraph integrated OBO ontologies knowledge graph reasoning"` | exit=0 | raw/openalex-ubergraph.txt |
| 40 | 2026-10-31T18:02:50Z | `orx discover openalex --no-telemetry --limit 12  "KG-Phenio knowledge graph phenotypes"` | exit=0 | raw/openalex-kgphenio.txt |
| 41 | 2026-10-31T18:02:50Z | `orx discover openalex --no-telemetry --limit 12  "flying fish genome pectoral fin kcnh2 bioelectric"` | exit=0 | raw/openalex-flyfishgenome.txt |
| 42 | 2026-10-31T18:02:51Z | `orx discover openalex --no-telemetry --limit 12  "virtual zebrafish whole organism multiscale model"` | exit=0 | raw/openalex-virtualfish.txt |
| 43 | 2026-10-31T18:02:51Z | `orx discover openalex --no-telemetry --limit 12  "whole-organism computational model gene expression anatomy"` | exit=0 | raw/openalex-wholeorganism.txt |
| 44 | 2026-10-31T18:02:52Z | `orx discover openalex --no-telemetry --limit 12  "hierarchical model organism organ system organ tissue cell gene expression integration"` | exit=0 | raw/openalex-hierarchyorg.txt |
| 45 | 2026-10-31T18:02:52Z | `orx discover openalex --no-telemetry --limit 12  "theorem prover verification of biomedical ontology"` | exit=0 | raw/openalex-verifyontology.txt |
| 46 | 2026-10-31T18:02:52Z | `orx discover openalex --no-telemetry --limit 12  "synthetic morphology engineering multicellular form design"` | exit=0 | raw/openalex-synthmorph.txt |
| 47 | 2026-10-31T18:02:53Z | `orx discover openalex --no-telemetry --limit 12  "Physiome ontology of physics for biology semantic annotation CellML"` | exit=0 | raw/openalex-physiomeontology.txt |
| 48 | 2026-10-31T18:03:35Z | `orx discover pubmed --no-telemetry --limit 12  "Phenoscape"` | exit=0 | raw/pubmed-phenoscape.txt |
| 49 | 2026-10-31T18:03:36Z | `orx discover pubmed --no-telemetry --limit 12  "ontology evolutionary phenotypes fin zebrafish candidate genes"` | exit=0 | raw/pubmed-phenoscape-fin.txt |
| 50 | 2026-10-31T18:03:36Z | `orx discover pubmed --no-telemetry --limit 12  "flying fish fin"` | exit=0 | raw/pubmed-flyingfish.txt |
| 51 | 2026-10-31T18:03:39Z | `orx discover pubmed --no-telemetry --limit 12  "fin-to-limb transition gene regulatory"` | exit=0 | raw/pubmed-finlimb.txt |
| 52 | 2026-10-31T18:03:42Z | `orx discover pubmed --no-telemetry --limit 12  "Human Reference Atlas anatomical structures cell types biomarkers"` | exit=0 | raw/pubmed-asctb.txt |
| 53 | 2026-10-31T18:03:42Z | `orx discover pubmed --no-telemetry --limit 12  "whole-cell model"` | exit=0 | raw/pubmed-wholecell.txt |
| 54 | 2026-10-31T18:03:45Z | `orx discover pubmed --no-telemetry --limit 12  "AI virtual cell"` | exit=0 | raw/pubmed-virtualcell.txt |
| 55 | 2026-10-31T18:03:47Z | `orx discover pubmed --no-telemetry --limit 12  "formal verification ontology theorem prover biology"` | exit=0 | raw/pubmed-formalverif.txt |
| 56 | 2026-10-31T18:03:48Z | `orx discover pubmed --no-telemetry --limit 12  "computer-designed organisms"` | exit=0 | raw/pubmed-organismdesign.txt |
| 57 | 2026-10-31T18:03:50Z | `orx discover pubmed --no-telemetry --limit 12  "Uberon anatomy ontology"` | exit=0 | raw/pubmed-uberon.txt |
| 58 | 2026-10-31T18:04:08Z | `orx discover openalex --no-telemetry --limit 12  "levels of model completeness whole-cell model roadmap stages from structure to function"` | exit=0 | raw/openalex-levels2.txt |
| 59 | 2026-10-31T18:04:09Z | `orx discover openalex --no-telemetry --limit 12  "hierarchy of increasingly complete virtual organism models from anatomy to physiology roadmap"` | exit=0 | raw/openalex-levels3.txt |
| 60 | 2026-10-31T18:04:09Z | `orx discover openalex --no-telemetry --limit 12  "formal verification of anatomy ontology in a proof assistant"` | exit=0 | raw/openalex-leanonto.txt |
| 61 | 2026-10-31T18:04:09Z | `orx discover openalex --no-telemetry --limit 12  "logical model of homology comparative biology ontology"` | exit=0 | raw/openalex-homologylogic.txt |
| 62 | 2026-10-31T18:04:09Z | `orx discover openalex --no-telemetry --limit 12  "paired fin loss teleost fishes trees traits ontology"` | exit=0 | raw/openalex-pairedfin.txt |
| 63 | 2026-10-31T18:04:10Z | `orx discover openalex --no-telemetry --limit 12  "ontological morphological phylogenetic framework ray-finned fishes"` | exit=0 | raw/openalex-actino.txt |
| 64 | 2026-10-31T18:04:10Z | `orx discover openalex --no-telemetry --limit 12  "semantic similarity evolutionary phenotypes mutant phenotypes Phenoscape knowledgebase genes"` | exit=0 | raw/openalex-genestosemantic.txt |
| 65 | 2026-10-31T18:04:10Z | `orx discover pubmed --no-telemetry --limit 12  "virtual cell levels framework multiscale roadmap"` | exit=0 | raw/pubmed-levels.txt |
| 66 | 2026-10-31T18:04:11Z | `orx discover pubmed --no-telemetry --limit 12  "gene expression anatomy ontology cross-species homology Bgee"` | exit=0 | raw/pubmed-ontoexpr.txt |
| 67 | 2026-10-31T18:04:51Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI%3A%2210.1093/sysbio/syz067%22&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-homology.json |
| 68 | 2026-10-31T18:04:51Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A34750582%20AND%20SRC%3AMED&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-asctb.json |
| 69 | 2026-10-31T18:04:52Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI%3A%2210.1093/sysbio/syv031%22&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-dececchi.json |
| 70 | 2026-10-31T18:05:10Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A22817898%20AND%20SRC%3AMED&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-wholecell.json |
| 71 | 2026-10-31T18:05:11Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A34534441%20AND%20SRC%3AMED&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-flyfish.json |
| 72 | 2026-10-31T18:05:26Z | `orx discover openalex --no-telemetry --limit 12  "computational model tooth morphology predicts phenotype from genotype developmental mechanism"` | exit=0 | raw/openalex-tooth.txt |
| 73 | 2026-10-31T18:05:26Z | `orx discover openalex --no-telemetry --limit 12  "large language model design of an organism body plan text to organism"` | exit=0 | raw/openalex-text2org.txt |
| 74 | 2026-10-31T18:05:27Z | `orx discover openalex --no-telemetry --limit 12  "digital twin maturity levels framework biology"` | exit=0 | raw/openalex-dtmaturity.txt |
| 75 | 2026-10-31T18:05:27Z | `orx discover openalex --no-telemetry --limit 12  "virtual cell model levels of abstraction capability tiers"` | exit=0 | raw/openalex-vclevels.txt |
| 76 | 2026-10-31T18:05:27Z | `orx discover openalex --no-telemetry --limit 12  "computational model of limb development whole-organ simulation gene regulatory network morphogenesis"` | exit=0 | raw/openalex-limbsim.txt |
| 77 | 2026-10-31T18:05:28Z | `orx discover pubmed --no-telemetry --limit 12  "principles of whole-cell modeling"` | exit=0 | raw/pubmed-principles.txt |
| 78 | 2026-10-31T18:05:28Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI%3A%2210.1038/41710%22&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-shubin.json |
| 79 | 2026-10-31T18:05:29Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A26115539%20AND%20SRC%3AMED&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-karr.json |
| 80 | 2026-10-31T18:05:30Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI%3A%2210.1016/j.jbi.2003.11.007%22&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-fma.json |
| 81 | 2026-10-31T18:05:39Z | `orx discover openalex --no-telemetry --limit 12  "tooth morphology from genotype to phenotype Salazar-Ciudad Jernvall"` | exit=0 | raw/openalex-salazar.txt |
| 82 | 2026-10-31T18:05:40Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI%3A%2210.1038/s44320-025-00128-y%22&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-limbnet.json |
| 83 | 2026-10-31T18:05:54Z | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI%3A%2210.1038/nature08838%22&resultType=core&format=json&pageSize=5` | http=200 | raw/epmc-tooth.json |
| 84 | 2026-10-31T18:05:54Z | `GET https://phenoscape.org/` | http=200 https://phenoscape.org/ | raw/pages/phenoscape_org_.html |
| 85 | 2026-10-31T18:05:54Z | `GET https://kb.phenoscape.org/` | http=200 https://kb.phenoscape.org/ | raw/pages/kb_phenoscape_org_.html |
| 86 | 2026-10-31T18:05:55Z | `GET https://openworm.org/` | http=200 https://openworm.org/ | raw/pages/openworm_org_.html |
| 87 | 2026-10-31T18:05:55Z | `GET https://monarchinitiative.org/` | http=200 https://monarchinitiative.org/ | raw/pages/monarchinitiative_org_.html |
| 88 | 2026-10-31T18:05:55Z | `GET https://www.bgee.org/` | http=403 https://www.bgee.org/ | raw/pages/www_bgee_org_.html |
| 89 | 2026-10-31T18:05:55Z | `GET https://zfin.org/` | http=200 https://zfin.org/ | raw/pages/zfin_org_.html |
| 90 | 2026-10-31T18:05:56Z | `GET https://www.physiomeproject.org/` | http=000 https://www.physiomeproject.org/ | raw/pages/www_physiomeproject_org_.html |
| 91 | 2026-10-31T18:05:56Z | `GET https://www.vph-institute.org/` | http=200 https://vph-society.org/ | raw/pages/www_vph-institute_org_.html |
| 92 | 2026-10-31T18:05:58Z | `GET https://humanatlas.io/` | http=200 https://humanatlas.io/ | raw/pages/humanatlas_io_.html |
| 93 | 2026-10-31T18:05:58Z | `GET https://obophenotype.github.io/uberon/` | http=200 https://obophenotype.github.io/uberon/ | raw/pages/obophenotype_github_io_uberon_.html |
| 94 | 2026-10-31T18:05:58Z | `GET https://obophenotype.github.io/cell-ontology/` | http=200 https://obophenotype.github.io/cell-ontology/ | raw/pages/obophenotype_github_io_cell-ontology_.html |
| 95 | 2026-10-31T18:05:58Z | `GET https://www.wholecell.org/` | http=200 https://www.wholecell.org/ | raw/pages/www_wholecell_org_.html |
| 96 | 2026-10-31T18:06:00Z | `GET https://virtualcellchallenge.org/` | http=200 https://virtualcellchallenge.org/ | raw/pages/virtualcellchallenge_org_.html |
| 97 | 2026-10-31T18:06:00Z | `GET https://limbnet.embl.es/` | http=200 https://limbnet.embl.es/ | raw/pages/limbnet_embl_es_.html |
| 98 | 2026-10-31T18:06:01Z | `GET https://ubergraph.apps.renci.org/` | http=404 https://ubergraph.apps.renci.org/ | raw/pages/ubergraph_apps_renci_org_.html |
| 99 | 2026-10-31T18:06:01Z | `GET https://github.com/phenoscape` | http=200 https://github.com/phenoscape | raw/pages/github_com_phenoscape.html |
| 100 | 2026-10-31T18:06:26Z | `GET https://wiki.phenoscape.org/wiki/Main_Page` | http=200 | raw/pages/wiki_phenoscape_org_wiki_Main_Page.html |
| 101 | 2026-10-31T18:06:26Z | `GET https://wiki.phenoscape.org/wiki/Phenoscape_KB` | http=200 | raw/pages/wiki_phenoscape_org_wiki_Phenoscape_KB.html |
| 102 | 2026-10-31T18:06:26Z | `GET https://scate.phenoscape.org/` | http=200 | raw/pages/scate_phenoscape_org_.html |
| 103 | 2026-10-31T18:06:34Z | `GET https://kb.phenoscape.org/api/v2/term/search?text=Exocoetidae&type=http://www.w3.org/2002/07/owl%23Class&limit=5` | http=200 | (not saved) |
| 104 | 2026-10-31T18:06:34Z | `GET https://kb.phenoscape.org/api/v2/term/search_classes?text=Exocoetidae&definedBy=http://purl.obolibrary.org/obo/vto.owl&limit=5` | http=200 | (not saved) |
| 105 | 2026-10-31T18:06:42Z | `GET https://kb.phenoscape.org/api/v2/taxon/phenotypes?taxon=http%3A%2F%2Fpurl.obolibrary.org%2Fobo%2FVTO_0055205&total=true` | http=200 | (not saved) |
| 106 | 2026-10-31T18:06:42Z | `GET https://kb.phenoscape.org/api/v2/taxon/phenotypes?taxon=http%3A%2F%2Fpurl.obolibrary.org%2Fobo%2FVTO_0055205&limit=10` | http=200 | (not saved) |
| 107 | 2026-10-31T18:06:42Z | `GET https://kb.phenoscape.org/api/v2/taxon/annotations?taxon=http%3A%2F%2Fpurl.obolibrary.org%2Fobo%2FVTO_0055205&total=true` | http=200 | (not saved) |
| 108 | 2026-10-31T18:06:55Z | `GET https://kb.phenoscape.org/api/v2/taxon/phenotypes?taxon=http%3A%2F%2Fpurl.obolibrary.org%2Fobo%2FVTO_0055205&limit=100` | http=200 | raw/pages/kb_exocoetidae_phenotypes.json |
| 109 | 2026-10-31T18:07:21Z | `orx discover openalex --no-telemetry --limit 12  "taxon constraints ontology reasoning anatomy Gene Ontology only_in_taxon"` | exit=0 | raw/openalex-taxoncon.txt |
| 110 | 2026-10-31T18:07:21Z | `orx discover openalex --no-telemetry --limit 12  "interactive theorem prover formalization of OWL description logic ontology Isabelle Coq"` | exit=0 | raw/openalex-itpontology.txt |
| 111 | 2026-10-31T18:07:21Z | `orx discover pubmed --no-telemetry --limit 12  "Lean theorem prover biology"` | exit=0 | raw/pubmed-leanbio.txt |
| 112 | 2026-10-31T18:07:40Z | `GET https://doi.org/api/handles/10.1093/molbev/msv223` | http=200 | (not saved) |
| 113 | 2026-10-31T18:07:40Z | `GET https://doi.org/api/handles/10.7287/peerj.preprints.26988v1` | http=200 | (not saved) |
| 114 | 2026-10-31T18:07:40Z | `GET https://doi.org/api/handles/10.1111/j.1439-0426.2012.01985.x` | http=200 | (not saved) |
| 115 | 2026-10-31T18:07:40Z | `GET https://doi.org/api/handles/10.1093/sysbio/syv031` | http=200 | (not saved) |
| 116 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1093/sysbio/syz067` | http=200 | (not saved) |
| 117 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1093/sysbio/syx098` | http=200 | (not saved) |
| 118 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1002/ar.70090` | http=200 | (not saved) |
| 119 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1371/journal.pone.0010500` | http=200 | (not saved) |
| 120 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1093/sysbio/syq013` | http=200 | (not saved) |
| 121 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1002/jez.b.21181` | http=200 | (not saved) |
| 122 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1371/journal.pbio.1000247` | http=200 | (not saved) |
| 123 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1186/gb-2012-13-1-r5` | http=200 | (not saved) |
| 124 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1186/2041-1480-5-21` | http=200 | (not saved) |
| 125 | 2026-10-31T18:07:41Z | `GET https://doi.org/api/handles/10.1186/1471-2105-12-6` | http=200 | (not saved) |
| 126 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1038/s41597-026-07173-8` | http=200 | (not saved) |
| 127 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1186/2041-1480-5-12` | http=200 | (not saved) |
| 128 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1016/j.jbi.2003.11.007` | http=200 | (not saved) |
| 129 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1038/s41556-021-00788-6` | http=200 | (not saved) |
| 130 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1038/s41597-025-05183-6` | http=200 | (not saved) |
| 131 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1038/s41467-024-54591-6` | http=200 | (not saved) |
| 132 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1093/nar/gkaa793` | http=200 | (not saved) |
| 133 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1093/nar/gkae1118` | http=200 | (not saved) |
| 134 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1093/bioinformatics/bts048` | http=200 | (not saved) |
| 135 | 2026-10-31T18:07:42Z | `GET https://doi.org/api/handles/10.1093/genetics/iyac016` | http=200 | (not saved) |
| 136 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1093/nar/gkw1128` | http=200 | (not saved) |
| 137 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1093/nar/gkad1082` | http=200 | (not saved) |
| 138 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1093/genetics/iyaf027` | http=200 | (not saved) |
| 139 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1016/j.cell.2012.05.044` | http=200 | (not saved) |
| 140 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1016/j.mib.2015.06.004` | http=200 | (not saved) |
| 141 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1038/s41467-020-14545-0` | http=200 | (not saved) |
| 142 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1126/science.aad6253` | http=200 | (not saved) |
| 143 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1128/msphere.00077-26` | http=200 | (not saved) |
| 144 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1016/j.cell.2024.11.015` | http=200 | (not saved) |
| 145 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1016/j.cell.2025.06.008` | http=200 | (not saved) |
| 146 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1113/expphysiol.2003.026740` | http=200 | (not saved) |
| 147 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1093/bib/bbn024` | http=200 | (not saved) |
| 148 | 2026-10-31T18:07:43Z | `GET https://doi.org/api/handles/10.1109/rbme.2009.2036204` | http=200 | (not saved) |
| 149 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.1109/rbme.2024.3490455` | http=200 | (not saved) |
| 150 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.1186/2041-1480-4-41` | http=200 | (not saved) |
| 151 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.3389/fncom.2014.00137` | http=200 | (not saved) |
| 152 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.1038/s43588-024-00738-w` | http=200 | (not saved) |
| 153 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.1038/41710` | http=200 | (not saved) |
| 154 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.1038/ncomms11582` | http=200 | (not saved) |
| 155 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.1038/nature08838` | http=200 | (not saved) |
| 156 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.1038/s44320-025-00128-y` | http=200 | (not saved) |
| 157 | 2026-10-31T18:07:44Z | `GET https://doi.org/api/handles/10.1016/j.cub.2021.08.054` | http=200 | (not saved) |
| 158 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.1242/dev.199384` | http=200 | (not saved) |
| 159 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.1111/j.1095-8312.2010.01550.x` | http=200 | (not saved) |
| 160 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.21203/rs.3.rs-10086537/v1` | http=200 | (not saved) |
| 161 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.1039/d3dd00077j` | http=200 | (not saved) |
| 162 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.48550/arxiv.2610.36343` | http=200 | (not saved) |
| 163 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.1093/bioinformatics/btn275` | http=200 | (not saved) |
| 164 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.20381/ruor-26863` | http=200 | (not saved) |
| 165 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.1073/pnas.1910837117` | http=200 | (not saved) |
| 166 | 2026-10-31T18:07:45Z | `GET https://doi.org/api/handles/10.1126/science.ado9336` | http=200 | (not saved) |
| 167 | 2026-10-31T18:07:46Z | `GET https://doi.org/api/handles/10.1038/s41586-026-10176-5` | http=200 | (not saved) |
| 168 | 2026-10-31T18:07:46Z | `GET https://doi.org/api/handles/10.1101/2025.09.12.675911` | http=200 | (not saved) |
| 169 | 2026-10-31T18:07:46Z | `GET https://doi.org/api/handles/10.1016/j.tig.2025.01.008` | http=200 | (not saved) |
