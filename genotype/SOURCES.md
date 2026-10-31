# Sources and every call made by the genotype thread

Generated from `genotype/cache/calls.json` (written by `genotype/fetch.py`). Raw downloads live in `C:/Temp/genotype/raw` (D: is nearly full); SHA-256 below lets anyone check a refetch.
Earlier exploratory curl probes (2026-10-31 ~17:55-18:00Z) hit the same endpoints with the same results and are not listed separately; one of them, the Bgee simple call files, was superseded by the advanced files below.

| # | call | method | status | bytes | retrieved (UTC) | URL | note |
|---|---|---|---|---|---|---|---|
| 1 | bgee_sparql_probe | POST | 403 | 5605 | 2026-10-31T18:04:16Z | https://www.bgee.org/sparql/ | REFUSED: Cloudflare challenge page ("Just a moment..."). HTTP Error 403: Forbidden |
| 2 | bgee_api_expr_calls_pectoral_fin_zebrafish | GET | 200 | 486 | 2026-10-31T18:04:16Z | https://www.bgee.org/api/?page=data&action=expr_calls&display_type=json&species_id=7955&anat_entity_id=UBERON:0000151&cond_param2=anat_entity&data_type=all | HTTP 200 but no call list; expressionData keys returned: requestedConditionParameters,requestedDataTypes |
| 3 | bgee_ftp_root_listing | GET | 200 | 11465 | 2026-10-31T18:04:17Z | https://www.bgee.org/ftp/ |  |
| 4 | bgee_ftp_current_listing | GET | 200 | 4806 | 2026-10-31T18:04:17Z | https://www.bgee.org/ftp/current/ |  |
| 5 | bgee_expr_advanced_Danio_rerio | GET | 200 | 28748573 | 2026-10-31T18:04:18Z | https://www.bgee.org/ftp/current/download/calls/expr_calls/Danio_rerio_expr_advanced.tsv.gz |  |
| 6 | bgee_expr_advanced_Oryzias_latipes | GET | 200 | 10940481 | 2026-10-31T18:04:20Z | https://www.bgee.org/ftp/current/download/calls/expr_calls/Oryzias_latipes_expr_advanced.tsv.gz |  |
| 7 | zfin_wildtype-expression_fish | GET | 200 | 43781681 | 2026-10-31T18:04:21Z | https://zfin.org/downloads/wildtype-expression_fish.txt |  |
| 8 | zfin_phenoGeneCleanData_fish | GET | 200 | 45067883 | 2026-10-31T18:04:23Z | https://zfin.org/downloads/phenoGeneCleanData_fish.txt |  |
| 9 | zfin_fish_components_fish | GET | 200 | 15423382 | 2026-10-31T18:04:25Z | https://zfin.org/downloads/fish_components_fish.txt |  |
| 10 | zfin_features | GET | 200 | 9812871 | 2026-10-31T18:04:26Z | https://zfin.org/downloads/features.txt |  |
| 11 | zfin_anatomy_item | GET | 200 | 226263 | 2026-10-31T18:04:27Z | https://zfin.org/downloads/anatomy_item.txt |  |
| 12 | zfin_anatomy_relationship | GET | 200 | 185586 | 2026-10-31T18:04:27Z | https://zfin.org/downloads/anatomy_relationship.txt |  |
| 13 | zfin_pub_to_pubmed_id_translation | GET | 200 | 1796678 | 2026-10-31T18:04:28Z | https://zfin.org/downloads/pub_to_pubmed_id_translation.txt |  |
| 14 | zfin_ensembl_1_to_1 | GET | 200 | 1609577 | 2026-10-31T18:04:28Z | https://zfin.org/downloads/ensembl_1_to_1.txt |  |
| 15 | zfin_stage_ontology | GET | 200 | 2766 | 2026-10-31T18:04:29Z | https://zfin.org/downloads/stage_ontology.txt |  |
| 16 | zfin_aliases | GET | 200 | 14829834 | 2026-10-31T18:04:29Z | https://zfin.org/downloads/aliases.txt |  |
| 17 | zfa_obo | GET | 200 | 1656680 | 2026-10-31T18:04:30Z | http://purl.obolibrary.org/obo/zfa.obo |  |
| 18 | go_zfin_gaf | GET | 200 | 9042741 | 2026-10-31T18:04:30Z | https://current.geneontology.org/annotations/zfin.gaf.gz |  |
| 19 | ubergraph_uberon_zfa_xrefs | POST | 200 | 17775 | 2026-10-31T18:04:30Z | https://ubergraph.apps.renci.org/sparql |  |
| 20 | ubergraph_cl_expresses | POST | 200 | 3179 | 2026-10-31T18:04:31Z | https://ubergraph.apps.renci.org/sparql |  |
| 21 | ubergraph_go_system_development | POST | 200 | 3650 | 2026-10-31T18:04:42Z | https://ubergraph.apps.renci.org/sparql |  |
| 22 | ubergraph_go_ap_patterning | POST | 200 | 6914 | 2026-10-31T18:04:42Z | https://ubergraph.apps.renci.org/sparql |  |
| 23 | pubmed_esearch: kcnk5b AND fin | GET | 200 | 269 | 2026-10-31T18:04:42Z | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=50&term=kcnk5b+AND+fin |  |
| 24 | pubmed_esearch: another longfin zebrafish | GET | 200 | 847 | 2026-10-31T18:04:42Z | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=50&term=another+longfin+zebrafish |  |
| 25 | pubmed_esearch: longfin AND kcnh2a | GET | 200 | 229 | 2026-10-31T18:04:43Z | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=50&term=longfin+AND+kcnh2a |  |
| 26 | pubmed_esearch: flying fish AND fin AND (bioelectric OR potassium) | GET | 200 | 1373 | 2026-10-31T18:04:44Z | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=50&term=flying+fish+AND+fin+AND+%28bioelectric+OR+potassium%29 |  |
| 27 | pubmed_esearch: Exocoetidae AND fin | GET | 200 | 252 | 2026-10-31T18:04:44Z | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=50&term=Exocoetidae+AND+fin |  |
| 28 | pubmed_esummary | GET | 200 | 75717 | 2026-10-31T18:04:45Z | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=12479969%2C16978605%2C18753619%2C20833919%2C22330714%2C23118437%2C24453984 |  |
| 29 | pubmed_efetch_abstracts | GET | 200 | 813645 | 2026-10-31T18:04:46Z | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=12479969%2C16978605%2C18753619%2C20833919%2C22330714%2C23118 |  |

Source organism per call: Bgee Danio_rerio files = zebrafish (NCBITaxon:7955); Bgee Oryzias_latipes files = medaka (NCBITaxon:8090); all ZFIN files and the ZFIN GO GAF = zebrafish; ZFA = zebrafish anatomy ontology; Ubergraph Uberon/CL/GO queries = ontology statements, no organism data; Cell Ontology 'expresses' markers are curator assertions, not fish data; PubMed = literature metadata and abstracts.

Releases: Bgee `ftp/current` = Bgee 15.2 (a `bgee_v16_0` directory dated 2026-10-14 exists and was not used). ZFA data-version releases/2026-07-16. GO ZFIN GAF date in map.json summary.go_gaf_date.
