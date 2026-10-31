# Brief for genotype-thread subagents: causal chains and interactions

You are one of several parallel agents working for the DELPHI genotype thread at the ScienceClaw hackathon.
The thread maps genotype to phenotype at every layer of a flying fish's body. An annotated draft genome of a
flying fish **does exist** (*Hirundichthys speculiger*, 23,611 predicted protein-coding genes; Xu et al. 2021,
doi 10.3389/fgene.2021.695700), so do not write that flying fish have no molecular data. What they have **no**
data of is **expression and phenotype**: no RNA-seq, no mutant, no kinetics, no regulatory network. That is why
everything here comes from proxy species, mainly zebrafish (*Danio rerio*) and medaka (*Oryzias latipes*).
Never present proxy data as flying-fish data. A flying fish's "wing" is an **enlarged pectoral fin**: say
"fin enlargement for gliding", never "fin-to-wing transition".

## Hard rules (a result that breaks one of these is discarded)

1. **Nothing from memory.** Every statement you return must come from a document you fetched in this run. If
   you did not fetch it, it does not go in the output. Prior knowledge may guide what you search for, never
   what you assert.
2. **Fetch only through the logged helper**, so every call is on record:
   ```
   python -I genotype/agent_fetch.py --log <YOUR_LOG> --out <file> <call-name> <url>
   python -I genotype/agent_fetch.py --log <YOUR_LOG> --print <call-name> <url>      # body to stdout
   ```
   It caches by call name and URL, exits non-zero on a non-200, and records refusals. Your log path is in
   your task prompt. Do not use curl, WebFetch or any other fetcher.
3. **No personal identifiers** in any request: no email, no name, no account id. Not as an NCBI `email=`
   parameter, not anywhere.
4. **Quote, don't paraphrase, for the key claim.** Every link carries a short verbatim quote from the source.
5. **Say what you could not establish.** A missing link is a finding. Return it as a `gap`, never as a guess.
6. **Write only your own output file** (named in your prompt) and your own log. Never edit any other file in
   the repository.

## Sources that work (checked by the thread)

- **Europe PMC** search and open full text:
  `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=<q>&format=json&resultType=core`
  then `https://www.ebi.ac.uk/europepmc/webservices/rest/<PMCID>/fullTextXML` (open-access only; HTTP 500
  means not open, which is itself worth recording).
- **PubMed E-utilities**: `esearch.fcgi`, `esummary.fcgi`, `efetch.fcgi` with `db=pubmed&retmode=xml&rettype=abstract`.
  Abstracts are usually enough for an evidence grade.
- **NCBI PMC efetch** for author manuscripts: `efetch.fcgi?db=pmc&id=<PMCID>&retmode=xml`. A publisher may
  block it; the body then says so.
- **ZFIN** gene pages and bulk files under `https://zfin.org/downloads/<name>.txt`. The thread already has
  `phenoGeneCleanData_fish.txt`, `wildtype-expression_fish.txt`, `features.txt`, `features-affected-genes.txt`,
  `fish_components_fish.txt`, `anatomy_item.txt`, `anatomy_relationship.txt`, `pub_to_pubmed_id_translation.txt`,
  `stage_ontology.txt`, `aliases.txt`, `pheno_environment_fish.txt`, `phenotype_fish.txt`, `ensembl_1_to_1.txt`
  in `C:/Temp/genotype/raw/` (read them directly, no fetch needed; they are tab-separated, no header row).
- **Ubergraph SPARQL**, POST form `query=`: `https://ubergraph.apps.renci.org/sparql`. **Gotcha:** cross-reference
  values are `xsd:string`-typed, so a `VALUES` block of plain literals matches nothing and returns an empty
  result with HTTP 200. Write `"ZFA:0001161"^^<http://www.w3.org/2001/XMLSchema#string>`.
- **Reactome** `https://reactome.org/ContentService/...`, **KEGG REST** `https://rest.kegg.jp/...` (free for
  academic use; keep to a few calls), **GO** `https://current.geneontology.org/annotations/zfin.gaf.gz`.
- **Refused:** the Bgee SPARQL endpoint (HTTP 403). PMC's `bin/` supplement URLs answer with a captcha page.

## Evidence grades (use these exact words)

| grade | meaning |
|---|---|
| `association` | expression or correlation only: the gene or protein is present where the phenotype is |
| `necessity` | loss of function (mutant, knockdown) changes the structure or process |
| `sufficiency` | gain of function (overexpression, activating allele) changes it |
| `mechanism` | a pathway step shown experimentally (binding, reporter, epistasis, rescue, channel recording) |
| `hypothesis` | proposed or modelled in a paper, not shown there |

Also record `organism`, `experiment_type` (in situ, qPCR, CRISPR knockout, morpholino, overexpression,
transplantation, electrophysiology, scRNA-seq, pharmacology, …), the `stage` in the paper's own words, and
`source` as `{"pmid": …, "doi": …, "first_author": …, "year": …, "journal": …, "title": …, "quote": "verbatim"}`.
A record may carry several sources. If a paper is not open access and only the abstract was read, set
`"read": "abstract only"`.

## Node ids

Use the ids in `C:/Temp/genotype/agents/NODE_IDS.json` for any anatomical endpoint: ZFA ids for the pectoral
fin and its parts (`ZFA:0001161` is the pectoral fin, `ZFA:0000141` the fin bud, `ZFA:0000085` its apical
ectodermal ridge, `ZFA:0001451` its zone of polarizing activity, `ZFA:0001000` fin mesenchyme, `ZFA:0005317`
the fin fold, `ZFA:0000943` the skeleton, `ZFA:0001551` lepidotrichium, `ZFA:0005545` actinotrichium), and the
post-composed `ZFA:<structure>+ZFA:<cell>` ids for cell types. `UBERON:0000151` is the blueprint's pectoral fin.
If the right node is not in that file, give the ZFA or CL id you mean and set `"node_not_in_subtree": true`.
Never invent an id, and never match a term by name alone.

## Output

Write **one JSON file** at the path in your prompt, UTF-8, matching the schema in your prompt exactly. Then
reply with a short report: what you established, the strongest chain or interaction you found, where the
evidence breaks, and your counts. Your reply is read by the thread, not by the user, so be terse and factual.
