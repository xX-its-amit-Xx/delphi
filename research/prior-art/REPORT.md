# Prior art: has anyone built a layered, ontology-based, formally checked organism?

Date: 2026-10-31. Searches: 59 `orx discover` calls (OpenAlex and PubMed), 8 Europe PMC lookups, 22 page or
API fetches and 58 DOI checks, all listed in `SEARCHES.md`. Every work cited here is in `works.json` with a
resolving DOI or a project URL that returned 200. Nothing is cited from memory. Comparisons with DELPHI are
against what `organism-design/README.md` and `lean/Delphi/` say they do; the proofs were not audited.

*Saved by the hub from the research agent's returned text: the agent's harness refused the file write.
`works.json`, `SEARCHES.md` and `raw/` were written by the agent itself.*

## 1. Has the whole combination been attempted?

No, as far as these searches show. Each part has been done; the parts have not been done together.

| Part | Who did it | How far it went |
|---|---|---|
| Anatomy hierarchy from ontologies | Uberon (10.1186/gb-2012-13-1-r5, 10.1186/2041-1480-5-21); Cell Ontology (10.1038/s41597-026-07173-8); zebrafish anatomy ontology ZFA (10.1186/2041-1480-5-12); Foundational Model of Anatomy (10.1016/j.jbi.2003.11.007) | Built and widely used. |
| Nested hierarchy with genes at the bottom | Human Reference Atlas ASCT+B tables (10.1038/s41556-021-00788-6) and knowledge graph (10.1038/s41597-025-05183-6: 71 organs, 2,268 cell types, 2,531 biomarkers) | Built, but human only. Biomarkers, not genotype-to-phenotype. No evolution, no proofs. |
| Expression on anatomy | Bgee (10.1093/nar/gkaa793, 10.1093/nar/gkae1118); ZFIN (10.1093/genetics/iyac016) | Built, for model organisms. |
| Cross-species genotype-to-phenotype with ontologies | Monarch (10.1093/nar/gkw1128, 10.1093/nar/gkad1082); uPheno (10.1093/genetics/iyaf027); 10.1371/journal.pbio.1000247 | Built, biomedical focus. |
| Evolutionary fish phenotypes linked to genes, including fin-to-limb | Phenoscape (section 2) | Built, with wet-lab validation. |
| Genotype-to-phenotype model | M. genitalium whole-cell model (10.1016/j.cell.2012.05.044) | Built, single cell, no anatomy ontology. |
| Body-to-molecule multiscale models | Physiome / Virtual Physiological Human (10.1113/expphysiol.2003.026740, 10.1109/rbme.2009.2036204, 10.1109/rbme.2024.3490455) | Human physiology. A knowledge graph of all anatomy and physiology is a stated goal (2024), not delivered. |
| Digital organism | OpenWorm (10.3389/fncom.2014.00137); MetaWorm (10.1038/s43588-024-00738-w) | Simulations of C. elegans, not ontology- or genotype-to-phenotype-based. |
| Formal checks on ontologies | Cell Ontology (10.1186/1471-2105-12-6); Phenoscape homology (10.1093/sysbio/syz067) | Automated OWL reasoners only. |
| Formal checks on biological models | Model checking (10.1093/bioinformatics/btn275); Coq (10.20381/ruor-26863); Lean genetic code (10.48550/arxiv.2610.36343); K-Lean (10.21203/rs.3.rs-10086537/v1) | Dynamics, molecules and numeric properties. No proof assistant applied to an anatomy hierarchy was found. |
| Generating organisms | Xenobots (10.1073/pnas.1910837117); JCVI-syn3.0 (10.1126/science.aad6253); genome design from a whole-cell model (10.1038/s41467-020-14545-0); generated phages (10.1101/2025.09.12.675911); Evo and Evo 2 (10.1126/science.ado9336, 10.1038/s41586-026-10176-5); genome as a generative model (10.1016/j.tig.2025.01.008, theory only) | Built only at the level of cells, minimal genomes or viruses. None uses anatomy ontologies. |
| Flying-fish genetics | Daane 2021 (10.1016/j.cub.2021.08.054: lat4a with kcnh2a reproduces flying-fish fin proportions in zebrafish); 10.1242/dev.199384; phylogeny 10.1111/j.1095-8312.2010.01550.x | Empirical findings, not in ontology form. |

## 2. Closest single prior work

**Phenoscape Knowledgebase.** Main paper 10.1093/molbev/msv223; infrastructure 10.1111/j.1439-0426.2012.01985.x;
fin-to-limb 10.1093/sysbio/syv031 and 10.1093/sysbio/syz067; project pages phenoscape.org and
wiki.phenoscape.org/wiki/Phenoscape_KB.

**What it built:**
- About 500,000 fish phenotypes annotated on a fish anatomy ontology later merged into Uberon.
- Stored in OWL with ZFIN, MGI and Xenbase expression and phenotype data and HPO.
- Candidate genes found by reasoning and checked in the lab (brpf1 and eda/edar in catfish).
- A 639-character by 1,051-taxon presence/absence matrix spanning fin-to-limb.
- Two OWL models of the homology of fin and limb bones.
- The wiki names the vertebrate fin/limb transition as its test system.

**What it has that DELPHI lacks:** data across thousands of taxa, semantic-similarity matching, reasoning about
homology, wet-lab validation, and a live public API.

**What DELPHI has that it lacks:**
- A nested body-to-cell blueprint for one named organism; Phenoscape stores phenotype statements per taxon.
- Proofs in Lean; Phenoscape uses OWL reasoners and itself reports OWL's limits (10.1093/sysbio/syz067).
- The generative framing.
- The flying fish: the KB holds 40 Exocoetidae phenotypes, all from Wiley and Johnson (2010), and none is about
  pectoral fin size (`raw/pages/kb_exocoetidae_phenotypes.json`).

**Caution:** Phenoscape's fin-to-limb work is about lobe-finned fishes, whose fin bones are homologous to limb
bones. Flying-fish "wings" are enlarged pectoral fins, and Daane frames them as a change in proportion. Say
**"fin enlargement for gliding"**, not "fin-to-wing" in the fin-to-limb sense.

## 3. What the pitch must cite

1. Phenoscape: 10.1093/molbev/msv223 and 10.1093/sysbio/syv031, optionally 10.1093/sysbio/syz067.
2. Uberon, the Cell Ontology and the Human Reference Atlas ASCT+B tables: 10.1186/gb-2012-13-1-r5,
   10.1186/2041-1480-5-21, 10.1038/s41597-026-07173-8, 10.1038/s41556-021-00788-6.
3. Daane 2021: 10.1016/j.cub.2021.08.054.

Cite these too when the matching claim comes up:
- Karr 2012 (10.1016/j.cell.2012.05.044) for predicting phenotype from genotype.
- Xenobots and JCVI-syn3.0 for designed organisms.
- 10.1186/1471-2105-12-6 for verifying an ontology.
- 10.48550/arxiv.2610.36343 and K-Lean, so we do not claim the first use of Lean in biology.

## 4. What appears new (narrow, and based on searches that found nothing)

- **Proof assistant on an anatomy hierarchy.** Ten searches on formal methods and ontologies found no Lean, Coq
  or Isabelle proofs about a hierarchy built from Uberon and the Cell Ontology. Supported claim: "we did not find
  prior use of a proof assistant on an ontology-derived anatomy hierarchy." Not supported: "the first formal
  verification of biology."
- **The flying fish's defining trait on ontology terms.** It is absent from the Phenoscape KB, and the flying-fish
  genetics literature found is not in ontology form.
- **The integration itself.** No single work combines all five parts.
- **Cannot tell:** Google Scholar, GitHub, arXiv full text and industry work were not searched.

## 5. Levels framework

None found. Searches: levels, levels2, levels3, vclevels, dtmaturity, and PubMed levels. The nearest things:
- Karr 2015 (10.1016/j.mib.2015.06.004): unordered completeness dimensions for a single cell (functional,
  genetic, molecular, temporal).
- Physiome (10.1113/expphysiol.2003.026740): organised by spatial scale, which matches DELPHI's layers, not its
  levels.
- Human Reference Atlas ASCT+B: effectively stops at DELPHI levels 0-1.
- Single-organ models that reach levels 3-4 without proposing any levels scheme: the tooth model
  (10.1038/nature08838), the catshark Turing model (10.1038/ncomms11582) and LimbNET (10.1038/s44320-025-00128-y).

Present the levels as DELPHI's own scheme and cite Karr 2015 as the closest existing vocabulary.

## Privacy

None of the research agent's own requests carried an email or name. `orx` itself adds `tool=orx` and possibly
its vendor address `orx@alphaxiv.org` to NCBI calls; `NCBI_EMAIL` was unset, so the user's address was not sent.

## Unverified leads (not cited)

- PMID 32782340, "Applications and ethics of computer-designed organisms": abstract not read.
- 10.1038/s41586-021-03620-1, "A roadmap for the Human Developmental Cell Atlas": not read.
- OpenAlex W2582835975, "Building a Virtual Lifeform": no DOI or abstract.
- 10.48550/arxiv.1802.06004, "GOTaxon": not read.
- Bgee or ZFIN data for Exocoetidae: not checked (Bgee's homepage returned 403).
- The Phenoscape "Fin-limb test case" wiki page: linked from phenoscape.org but not fetched.
- From memory and not searched, so not cited: a paper on Uberon/GO taxon constraints, the ASME V&V40
  model-credibility standard, and Virtual Fly Brain.
