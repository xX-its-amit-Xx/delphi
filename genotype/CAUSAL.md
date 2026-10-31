# Causal chains from gene to phenotype in the pectoral fin

Built 2026-10-31T20:44:18Z by `genotype/assemble_chains.py` from 2 subagent result files.
Every link carries its own source, organism, experiment type and evidence grade; the grades are, weakest to strongest,
`hypothesis`, `association`, `necessity`, `sufficiency`, `mechanism`. A link with no fetched source is `missing` and is named as a gap.

**All of this is proxy-species work, almost all zebrafish. No causal experiment exists in a flying fish.** A flying fish's wing is an enlarged pectoral fin.

## Coverage

| | |
|---|---|
| genes with a chain | 8 |
| chains whose **weakest** link is `necessity` or better | 5 |
| genes with at least one link graded `necessity` or better | 8 |
| genes with at least one link graded `mechanism` | 8 |
| complete four-step chains | 7 |
| distinct publications cited | 29 |
| fetched calls by the subagents | 287 |

## Strongest chain end to end: kcnk5b

**Tied on grades with kcnh2a**; ranked first because 3 of its cited papers were read in full text against 1 read as abstracts only. Grades alone do not separate them, and the 'where it breaks' lines below say how they differ.

Chain strength, meaning its weakest link: `sufficiency`; strongest single link: `mechanism`. Deepest node with evidence: mesenchyme pectoral fin (part).

   - `mechanism` kcnk5b -> two-pore-domain (K2P) potassium leak channel; alf alleles raise K+ conductance and hyperpolarize the expressing cell. electrophysiology (two-electrode voltage clamp), site-directed mutagenesis of the selectivity filter, Danio rerio gene expressed in Xenopus laevis oocytes, stage Xenopus oocytes (heterologous); mutants scored in the adult. Perathoner S 2014 PLoS Genet (PMID 24453984); Perathoner S 2014 PLoS Genet (PMID 24453984); Perathoner S 2014 PLoS Genet (PMID 24453984); Daane JM 2018 Sci Rep (PMID 29991812); Daane JM 2018 Sci Rep (PMID 29991812)
   - `mechanism` K+ leak conductance / altered membrane potential -> bioelectric signalling: intracellular K+ falls, Na+-channel-dependent depolarization, IP3R-mediated Ca2+ release and CaMKK activity, calcineurin-Kcnk5b node, and morphogen transcription (shha, fgf8a, fgf10a, bmp4, msx2b, aldh1a2). FLIM of a FRET K+ sensor, DiSBAC2(3) membrane-potential imaging, heat-shock overexpression, in situ hybridization, qRT-PCR, pharmacology (2-APB, STO-609, Na+-channel inhibitors, FK506, cyclosporin A, VIVIT), CRISPR-Cas9, Xenopus oocyte voltage clamp, Danio rerio (plus HEK293 cells for SHH transcription), stage 32-72 hours post fertilization (pectoral fin bud); adult caudal/pectoral fin and regenerate. Jiang X 2024 PLoS Biol (PMID 38527087); Jiang X 2024 PLoS Biol (PMID 38527087); Jiang X 2024 PLoS Biol (PMID 38527087); Jiang X 2024 PLoS Biol (PMID 38527087); Daane JM 2018 Sci Rep (PMID 29991812); Daane JM 2018 Sci Rep (PMID 29991812)
   - `sufficiency` bioelectric/Ca2+ signalling in fin tissue -> cell-autonomous increase in proliferation and outgrowth of fin mesenchyme (fibroblast-like intra-ray cells); lower intracellular K+ in pectoral fin bud mesenchyme than ectoderm; coordinated increase in fin bud area at mesenchyme pectoral fin (`ZFA:0001000`). cell transplantation (chimeras), somatic Tol2 mosaic overexpression with cell-type scoring, PCNA immunostaining, FLIM of K+ sensor in ectoderm vs mesenchyme, heat-shock overexpression with bud-area measurement, Danio rerio, stage 32-56 hours post fertilization (pectoral fin bud); adult (clonal overgrowth, regeneration). Perathoner S 2014 PLoS Genet (PMID 24453984); Perathoner S 2014 PLoS Genet (PMID 24453984); Perathoner S 2014 PLoS Genet (PMID 24453984); Perathoner S 2014 PLoS Genet (PMID 24453984); Jiang X 2024 PLoS Biol (PMID 38527087); Jiang X 2024 PLoS Biol (PMID 38527087)
   - `sufficiency` increased mesenchymal outgrowth and proliferation -> increased pectoral fin length (allometric overgrowth of all fins and barbels; longer lepidotrichial segments, segment number unchanged) at pectoral fin (`ZFA:0001161`). dominant gain-of-function mutant phenotyping (alf ty86d, dt30mh), segment measurement, in cis non-conducting-channel control, Danio rerio, stage Adult. Perathoner S 2014 PLoS Genet (PMID 24453984); Perathoner S 2014 PLoS Genet (PMID 24453984); Perathoner S 2014 PLoS Genet (PMID 24453984); Perathoner S 2014 PLoS Genet (PMID 24453984); van Eeden FJ 1996 Development (PMID 9007245) [abstract only]

**Where it breaks:** molecular_function->process. The step is heavily sourced but the papers disagree on sign: Perathoner 2014 shows the gain-of-function channel hyperpolarizes (oocytes), Jiang 2024 shows Kcnk5b produces net depolarization in fin bud cells via Na+ channels, and Daane 2018 obtains the same growth outcome from a decreased-conductance (I290A) channel. The Ca2+/CaMKK/shha arm is also measured partly in HEK293 cells rather than fin cells. A second weakness: the pectoral-fin-specific link in the last step rests on van Eeden 1996 ('generally longer fins'), read as abstract only.

**Gaps:** No electrophysiological recording from a zebrafish fin or fin-bud cell for Kcnk5b; all channel data are from Xenopus oocytes or HEK293 cells.; No cell-type-resolved node: the papers name 'fibroblast-like cells of the intra-ray mesenchyme', and NODE_IDS.json has no post-composed fibroblast node for the pectoral fin, so the chain stops at ZFA:0001000.; The clonal sufficiency experiments (transplantation, mosaic overexpression) were scored in caudal/dorsal fins and barbels, not in the pectoral fin.; No measurement of kcnk5b in any flying fish; Daane 2021 did not implicate kcnk5b in the flying-fish comparative signal.; Direction of the membrane-potential change that drives growth is unresolved (hyperpolarization vs Na+-mediated depolarization).

## Every chain, strongest first

Ordered by **chain strength**, the weakest grade on the chain, because that is what a chain actually supports. The strongest single link is shown beside it: a chain can hold one `mechanism` link and still be worth little if another link is `missing`.

| gene | chain strength (weakest link) | strongest single link | deepest node | publications (full text / abstract only) | where it breaks |
|---|---|---|---|---|---|
| kcnk5b | `sufficiency` | `mechanism` | mesenchyme pectoral fin (part) | 3 / 1 | molecular_function->process. The step is heavily sourced but the papers disagree on sign: Perathoner 2014 shows the gain-of-function channel hyperpolarizes (oocytes), Jiang 2024 shows Kcnk5b produces  |
| kcnh2a | `sufficiency` | `mechanism` | mesenchyme pectoral fin (part) | 1 / 3 | gene->molecular_function joined to molecular_function->process. The biophysics (Kume 2026) is measured for the zebrafish channel but in Xenopus oocytes and for a gene the same paper finds is brain-enr |
| rnf2 | `necessity` | `mechanism` | cleithrum (subpart) | 2 / 2 | gene->molecular_function in the fish: no fetched paper measures H2AK119ub (or any chromatin mark) in a zebrafish rnf2 mutant or in fin tissue, so the chain's first link is carried by human in vitro st |
| prdm1a | `necessity` | `mechanism` | cleithrum (subpart) | 1 / 2 | process->cell_or_tissue_effect: the cellular event in the fin (proliferation and apoptosis) did not reach significance, so 'failure of differentiation' is an inference, not a measurement |
| sox9a | `necessity` | `mechanism` | scapulocoracoid (subpart) | 0 / 5 | process->cell_or_tissue_effect in the fin: the chondrocyte stacking/individuation defect was measured in pharyngeal arch condensations, not in the pectoral fin or scapulocoracoid, so the cellular step |
| hdac1 | `association` | `mechanism` | pectoral fin cartilage (subpart) | 2 / 4 | molecular_function->process: the only candidate target link is whole-embryo RT-qPCR on 'potential targets', and the fin in situ shows tbx5a intensity unchanged in the bud, so no transcriptional mechan |
| slc43a2a | `hypothesis` | `mechanism` | pectoral fin lepidotrichium (subpart) | 1 / 3 | molecular_function->process, which is empty of experiment. The transport function is solid but entirely from mammalian orthologs read as abstracts, and nothing bridges 'moves leucine/methionine' to 'c |
| ezh2 | `missing` | `mechanism` | pectoral fin (organ) | 2 / 1 | process->cell_or_tissue_effect: entirely missing. Nothing links the chromatin lesion to the fin at the cellular level, and the only bridge is that tbx genes are expressed in the fin |

## Claims spanning several genes

- `mechanism` kcnh2a and lat4a interact non-additively to set fin proportion, and the double heterozygote phenocopies the flying-fish fin bauplan (overgrown paired fins, wild-type medial fins, hypocercal caudal fin) (Daane JM 2021 Curr Biol (PMID 34534441); Daane JM 2021 Curr Biol (PMID 34534441))
- `mechanism` lat4a acts downstream of, and not through, kcnh2a expression (Daane JM 2021 Curr Biol (PMID 34534441); Daane JM 2021 Curr Biol (PMID 34534441))
- `mechanism` Kcnk5b is required for the growth effect of calcineurin inhibition, placing the channel and calcineurin in one signalling node (Daane JM 2018 Sci Rep (PMID 29991812); Daane JM 2018 Sci Rep (PMID 29991812); Daane JM 2018 Sci Rep (PMID 29991812))
- `mechanism` Retinoic acid scales the pectoral fin bud by inducing rcan2, and Rcan2-driven growth requires kcnk5b (Jiang X 2024 PLoS Biol (PMID 38527087); Jiang X 2024 PLoS Biol (PMID 38527087); Jiang X 2024 PLoS Biol (PMID 38527087))
- `association` kcnk5b and kcnh2a produce distinguishable fin-overgrowth phenotypes, and the flying-fish pattern matches kcnh2a, not kcnk5b (Daane JM 2021 Curr Biol (PMID 34534441))

## What could not be established

- **prdm1a**: No prdm1a data of any kind in a flying fish (Exocoetidae); the whole chain is Danio rerio proxy evidence.
- **prdm1a**: No transplantation, chimera or fin-restricted conditional allele: autonomy rests on fin-cell-resolved biochemistry, not on a cell-autonomy experiment.
- **prdm1a**: The Prdm1a cofactor for activation at fgfr1a and smo is unidentified; Kdm4a is proposed as a hypothesis only.
- **prdm1a**: The endoskeletal disk, one of the three measured fin structures, has no ZFA node in NODE_IDS.json.
- **prdm1a**: No cell-type-resolved measurement at the apical ectodermal ridge node ZFA:0000085 despite the paper placing prdm1a in the apical fold.
- **sox9a**: No sox9a data in a flying fish (Exocoetidae); entire chain is zebrafish, with the enhancer biochemistry from mouse.
- **sox9a**: No transplantation, chimera or cartilage-restricted conditional rescue was found in a targeted Europe PMC search, so fin autonomy is not established: all sox9a alleles and morpholinos act in the whole embryo and the same mutants have severe craniofacial and otic defects.
- **sox9a**: No zebrafish Sox9a chromatin-occupancy experiment (ChIP/CUT&RUN) on a zebrafish col2a1 enhancer; the direct binding evidence is mouse SOX9 on mouse Col2a1.
- **sox9a**: No cell-level measurement in the pectoral fin or scapulocoracoid for the sox9a mutant.
- **sox9a**: Yan 2002 and Yan 2005 are not open access in Europe PMC, so both were graded from abstracts only.
- **rnf2**: No rnf2 data in a flying fish (Exocoetidae).
- **rnf2**: No fin-specific experiment at all: no transplantation, chimera, mosaic or fin-restricted conditional allele, and the FGF4 rescue and the Rnf2/H3K27me3 ChIP-seq were both done on whole embryos. In a global PRC1 null with near-complete loss of cranial cartilage, bone and musculature (van der Velden 2013), CNS and enteric nervous system defects (Feng 2022, PMID 36117635) and cardiac sarcomere and conduction defects (Peng 2021, PMID 34768802), the pectoral fin phenotype cannot be separated from the pleiotropy.
- **rnf2**: No H2AK119ub measurement in zebrafish rnf2 mutants in any paper fetched here.
- **rnf2**: van der Velden 2012 (PMID 22619390), the only paper dedicated to the rnf2 pectoral fin phenotype, is not open access in Europe PMC; it was graded from the abstract only.
- **rnf2**: Direction of the tbx5 change is inconsistent between reports (reduced in fin mesenchyme vs derepressed in heart), unresolved in the sources fetched.
- **ezh2**: No ezh2 data in a flying fish (Exocoetidae).
- **ezh2**: No cellular or molecular measurement in the ezh2 mutant pectoral fin or fin bud in any paper fetched; the fin phenotype is scored by gross morphology only.
- **ezh2**: No fin-specific experiment: MZezh2 is a global maternal-zygotic null, the authors state their experiments were on whole embryos, and the mRNA rescue is global and was scored on eyes and circulation rather than fins. The fin phenotype in this mutant should be treated as indirect.
- **ezh2**: The ezh2 mutant dies at 2 dpf, so no evidence can exist for fin subparts (girdle, radials, lepidotrichia) or for the adult enlarged-fin phenotype the project cares about.
- **ezh2**: Allele discordance: ezh2 sa1199, another nonsense allele, has no distinct phenotype and retains Ezh2 protein (PMID 30677064), so the fin phenotype depends on the hu5670 maternal-zygotic configuration.
- **ezh2**: A separate ezh2 line is reported to fail caudal fin regeneration (PMID 28887218, abstract only); that is the caudal fin, not the pectoral fin, and was not used here.
- **hdac1**: No hdac1 data in a flying fish (Exocoetidae).
- **hdac1**: No fin-specific experiment of any kind: no transplantation, chimera, mosaic or fin-restricted conditional. All four reagents (two alleles, one morpholino, valproic acid) act on the whole embryo, and the mutant phenotype is severely pleiotropic - heart, retina, otoliths, craniofacial cartilage, melanocyte migration, enteric/DRG/sympathetic neurons (PMID 23667588), inner ear (PMID 26832938), axial extension (PMID 17716875). The fin phenotype should be reported as not shown to be fin-autonomous and most likely partly indirect.
- **hdac1**: No Hdac1 chromatin-occupancy experiment (ChIP or CUT&RUN) on any fin gene; tbx5a/tbx5b are explicitly 'potential targets'.
- **hdac1**: No histone-acetylation measurement in fin tissue; the only zebrafish acetylation readout fetched is in the central nervous system.
- **hdac1**: The only temporal narrowing of the Hdac1 requirement by timed inhibitor exposure (24-36 hpf) was obtained for pharyngeal arch skeleton, not for the pectoral fin, so the fin's critical window is unknown.
- **hdac1**: Nambiar 2007 (PMID 17716875) is not open access: the Europe PMC fullTextXML call for PMC2701655 returned HTTP 500 and the paper was graded from the abstract only.
- **kcnk5b**: No electrophysiological recording from a zebrafish fin or fin-bud cell for Kcnk5b; all channel data are from Xenopus oocytes or HEK293 cells.
- **kcnk5b**: No cell-type-resolved node: the papers name 'fibroblast-like cells of the intra-ray mesenchyme', and NODE_IDS.json has no post-composed fibroblast node for the pectoral fin, so the chain stops at ZFA:0001000.
- **kcnk5b**: The clonal sufficiency experiments (transplantation, mosaic overexpression) were scored in caudal/dorsal fins and barbels, not in the pectoral fin.
- **kcnk5b**: No measurement of kcnk5b in any flying fish; Daane 2021 did not implicate kcnk5b in the flying-fish comparative signal.
- **kcnk5b**: Direction of the membrane-potential change that drives growth is unresolved (hyperpolarization vs Na+-mediated depolarization).
- **kcnh2a**: Stewart 2021 (PMID 34061172) full text unavailable: Europe PMC fullTextXML returned HTTP 500 for PMC8217709 and NCBI PMC efetch returned a publisher 'does not allow' notice. All Stewart 2021 statements here are abstract only.
- **kcnh2a**: Zero ZFIN phenotype rows for kcnh2a; no ontology-term phenotype annotation to cite.
- **kcnh2a**: No measurement of membrane potential, intracellular K+ or Ca2+ in a kcnh2a-expressing fin cell.
- **kcnh2a**: The clone-autonomy sufficiency experiment in Daane 2021 used human KCNH2, not zebrafish kcnh2a.
- **kcnh2a**: No kcnh2a functional data in any flying fish: the flying-fish evidence for this locus is comparative-genomic only.
- **slc43a2a**: No pathway or process step for Lat4a in the fin: no mTOR/mTORC1 readout, no amino acid measurement in fin tissue, no substrate rescue, no transcriptional target.
- **slc43a2a**: Zebrafish Lat4a transport activity has never been measured; the molecular function is imported from human/mouse orthologs.
- **slc43a2a**: No cell type resolved for lat4a in the fin (no transplantation, no clonal mosaic, no cell-type driver).
- **slc43a2a**: Direction of the T200K effect on transport is unknown: the allele is a genetic gain of function but no transport assay was done on it, so whether it moves more or less amino acid is undetermined.
- **slc43a2a**: Every fin phenotype and every ZFIN row for this gene traces to a single paper (PMID 34534441); no independent replication was found.
- **slc43a2a**: Flying-fish Lat4a (F326L) was never functionally tested in any species; it is a convergent substitution in a sequence alignment.

## Validation flags

These are the assembler's own checks on the subagents' output; they are counted in `causal-chains.json`.

- chromatin/ezh2/process->cell_or_tissue_effect: no sources at all: 1

## Interactions

0 tissue-to-tissue and cell-to-cell arrows are in `genotype/interactions.json` (0 inferred by orthology from another species' ligand-receptor data). By grade: {}.
