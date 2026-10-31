# Causal chains from gene to phenotype in the pectoral fin

Built 2026-10-31T20:52:06Z by `genotype/assemble_chains.py` from 7 subagent result files.
Every link carries its own source, organism, experiment type and evidence grade; the grades are, weakest to strongest,
`hypothesis`, `association`, `necessity`, `sufficiency`, `mechanism`. A link with no fetched source is `missing` and is named as a gap.

**All of this is proxy-species work, almost all zebrafish. No causal experiment exists in a flying fish.** A flying fish's wing is an enlarged pectoral fin.

## Coverage

| | |
|---|---|
| genes with a chain | 35 |
| chains whose **weakest** link is `necessity` or better | 24 |
| genes with at least one link graded `necessity` or better | 35 |
| genes with at least one link graded `mechanism` | 33 |
| complete four-step chains | 31 |
| distinct publications cited | 101 |
| fetched calls by the subagents | 293 |

## Strongest chain end to end: mib1


Chain strength, meaning its weakest link: `mechanism`; strongest single link: `mechanism`. Deepest node with evidence: ZFA:0001161+ZFA:0009025 (cell).

   - `mechanism` mib1 (mind bomb; ta52b missense, m178 premature stop per ZFIN) -> Mib1, a RING-domain E3 ubiquitin ligase that binds the Delta intracellular domain and promotes its ubiquitylation and internalisation. positional cloning, protein interaction and ubiquitylation assay, cell transplantation (signalling-cell autonomy), Danio rerio, stage neurogenesis stages, as stated in the paper. Itoh 2003 Developmental Cell (PMID 12530964) [abstract only]
   - `mechanism` Mib1-dependent ubiquitylation and endocytosis of Delta in the signalling cell -> canonical Notch signalling: Delta endocytosis, transendocytosis of the Notch extracellular domain, release of the Notch intracellular fragment and target-gene activation. cell transplantation plus pathway-level blockade at four independent levels (mib1 mutant alleles, jagged2 morpholino, Su(H)1+2 morpholino, gamma-secretase inhibitor DAPT), Danio rerio, stage DAPT added at 1-cell stage, 21 hpf or 48 hpf; phenotype read at 3-5 dpf. Itoh 2003 Developmental Cell (PMID 12530964) [abstract only]; Pascoal 2013 PLoS One (PMID 23840804); Pascoal 2013 PLoS One (PMID 23840804)
   - `mechanism` loss of canonical Notch signalling in the pectoral fin myogenic mesenchyme, where mib1, mib2, notch1a, notch3, jagged2, her6 and her13.2 are all expressed at 48 hpf -> the Pax7-positive myogenic progenitor pool in the pectoral fin is depleted, and the endoskeletal disc cells lose their transversal actin stress fibres at None (`ZFA:0001161+ZFA:0009025`). Pax7 immunohistochemistry with per-fin cell counts and t-tests, DAPI/phalloidin confocal imaging, whole-mount in situ hybridization, time-controlled DAPT added at 21 hpf (fin initiation), Danio rerio, stage 2 dpf, 3 dpf, 4 dpf and 5 dpf. Pascoal 2013 PLoS One (PMID 23840804); Pascoal 2013 PLoS One (PMID 23840804); Pascoal 2013 PLoS One (PMID 23840804)
   - `mechanism` depleted Pax7 progenitor pool and defective myotendinous junction assembly (Desmin and Vinculin protein lost although desmin and vcl mRNA are still transcribed) -> pectoral fin musculature at pectoral fin musculature (`ZFA:0000563`). confocal immunostaining (Desmin, Vinculin, phalloidin, DAPI), transmission electron microscopy, in situ hybridization for desmin and vcl mRNA, blebbistatin and MS222 force-reduction controls, Danio rerio, stage 3 dpf and 5 dpf. Pascoal 2013 PLoS One (PMID 23840804); Pascoal 2013 PLoS One (PMID 23840804); Pascoal 2013 PLoS One (PMID 23840804)

**Where it breaks:** gene->molecular_function: the ubiquitin-ligase activity and Delta binding come from the Itoh 2003 abstract only (full text not open) and were shown in neurogenesis, not in the fin. Also the canonical allele ta52b disrupts both mib1 and mib2; only m178 isolates mib1, and m178 was used for the muscle-fibre and actin readouts but not for the Pax7 counts.

**Gaps:** Pax7 progenitor counts, electron microscopy and the Desmin/Vinculin analysis were done on ta52b (mib1 and mib2) and not repeated on the mib1-specific m178 allele.; No mib1 mosaic or tissue-specific rescue in the fin, so cell autonomy within the fin (signalling vs receiving cell) is not established there.; Itoh 2003 full text is not open access; the ubiquitylation mechanism rests on its abstract.; No Notch target gene (her6, her13.2) output quantified in mutant fins, so loss of pathway output in that specific tissue is inferred rather than measured.; No flying-fish data; whether enlarged pectoral fins in Exocoetidae involve altered Notch-dependent myogenesis is entirely untested.

## Every chain, strongest first

Ordered by **chain strength**, the weakest grade on the chain, because that is what a chain actually supports. The strongest single link is shown beside it: a chain can hold one `mechanism` link and still be worth little if another link is `missing`.

| gene | chain strength (weakest link) | strongest single link | deepest node | publications (full text / abstract only) | where it breaks |
|---|---|---|---|---|---|
| mib1 | `mechanism` | `mechanism` | ZFA:0001161+ZFA:0009025 (cell) | 1 / 1 | gene->molecular_function: the ubiquitin-ligase activity and Delta binding come from the Itoh 2003 abstract only (full text not open) and were shown in neurogenesis, not in the fin. Also the canonical  |
| kcnk5b | `sufficiency` | `mechanism` | mesenchyme pectoral fin (part) | 3 / 1 | molecular_function->process. The step is heavily sourced but the papers disagree on sign: Perathoner 2014 shows the gain-of-function channel hyperpolarizes (oocytes), Jiang 2024 shows Kcnk5b produces  |
| kcnh2a | `sufficiency` | `mechanism` | mesenchyme pectoral fin (part) | 1 / 3 | gene->molecular_function joined to molecular_function->process. The biophysics (Kume 2026) is measured for the zebrafish channel but in Xenopus oocytes and for a gene the same paper finds is brain-enr |
| fgf24 | `necessity` | `mechanism` | scapulocoracoid (subpart) | 4 / 3 | gene->molecular_function: no direct Fgf24-receptor binding or activation assay in any fetched source; the ligand assignment is sequence-family (GO IBA/IEA only) plus receptor-side genetics, and the tr |
| apc | `necessity` | `mechanism` | pectoral fin fold (part) | 3 / 2 | process->cell_or_tissue_effect in the PECTORAL fin: the apc allele itself was assayed in the median fin fold, and the pectoral fin fold result used the GSK-3beta inhibitor BIO. The apc-specific pector |
| tbx5a | `necessity` | `mechanism` | pectoral fin lepidotrichium (subpart) | 2 / 5 | gene->molecular_function: Tbx5a's DNA binding and transcriptional activation were shown in cardiac/cell-based assays (Tong 2014) and inferred from the T-box family, never assayed in fin bud tissue; th |
| rerea | `necessity` | `mechanism` | pectoral fin (organ) | 2 / 3 | process->cell_or_tissue_effect: the molecular mechanism (RA coactivation) is established only in mouse and in zebrafish tissues other than the fin, and the one pathway test performed on the zebrafish  |
| hhip | `necessity` | `mechanism` | pectoral fin radial (subpart) | 2 / 2 | process->cell_or_tissue_effect is resolved only to the whole pectoral fin bud / endochondral disk; the zone of polarizing activity (ZFA:0001451) and apical ectodermal ridge (ZFA:0000085) are never ass |
| hmcn1 | `necessity` | `mechanism` | pectoral fin fold (part) | 2 / 2 | cell_or_tissue_effect->phenotype in the PECTORAL fin: the ultrastructural mechanism (blister below the lamina densa) was established in the median fin fold; for the pectoral fin only light-microscopy  |
| rnf2 | `necessity` | `mechanism` | cleithrum (subpart) | 2 / 2 | gene->molecular_function in the fish: no fetched paper measures H2AK119ub (or any chromatin mark) in a zebrafish rnf2 mutant or in fin tissue, so the chain's first link is carried by human in vitro st |
| lama5 | `necessity` | `mechanism` | pectoral fin fold (part) | 2 / 1 | gene->molecular_function: the claim that the truncation removes receptor binding is inferred from the stop-codon position rather than shown by a binding assay, and Webb 2007 is closed access so only t |
| rspo2 | `necessity` | `mechanism` | pectoral fin lepidotrichium (subpart) | 2 / 1 | molecular_function->process inside the fin: the RSPO2-LGR4-ZNRF3 mechanism is human and in vitro, and no fetched source shows reduced Wnt/beta-catenin output (reporter, axin2, lef1) in the rspo2 mutan |
| disp1 | `necessity` | `mechanism` | pectoral fin (organ) | 1 / 5 | process->cell_or_tissue_effect: the ZPA/AER node evidence is from shh and fgf16 experiments, not from disp1 mutants, so the fin-bud step of the chain is pathway-level inference. |
| fgf10a | `necessity` | `mechanism` | apical ectodermal ridge pectoral fin bud (part) | 1 / 5 | process->cell_or_tissue_effect: that Fgf10a is the mesenchymal signal that induces the AER is stated only as a hedged inference in the fetched sources (Leerberg: "is likely responsible"); the direct f |
| shha | `necessity` | `mechanism` | pectoral fin actinotrichium (subpart) | 1 / 5 | gene->molecular_function: Shha-Patched binding itself is only inferred (GO IBA/ISS). The fin-stage mechanism evidence is pharmacological (cyclopamine blocks Smoothened, ptc1 read-out), so it demonstra |
| extl3 | `necessity` | `mechanism` | pectoral fin fold (part) | 1 / 4 | process->cell_or_tissue_effect: no fetched paper shows, in extl3/boxer mutants specifically, the cell-level event in the pectoral fin bud ectoderm (AER maintenance, ectodermal expansion) that links re |
| prdm1a | `necessity` | `mechanism` | cleithrum (subpart) | 1 / 2 | process->cell_or_tissue_effect: the cellular event in the fin (proliferation and apoptosis) did not reach significance, so 'failure of differentiation' is an inference, not a measurement |
| fras1 | `necessity` | `mechanism` | pectoral fin fold (part) | 1 / 1 | cell_or_tissue_effect->phenotype in the PECTORAL fin: the electron microscopy that pins the blister to the sublamina densa was done on median fin blisters; for the pectoral fin only light microscopy a |
| sec24d | `necessity` | `mechanism` | pectoral fin skeleton (part) | 1 / 1 | process->cell_or_tissue_effect in the FIN: every cell-biological measurement (Col2a1/Matrilin retention, ER distension, failed chondroblast intercalation, BiP induction) was made in craniofacial carti |
| b3galt6 | `necessity` | `mechanism` | pectoral fin radial (subpart) | 1 / 0 | process->cell_or_tissue_effect: the collagen fibril disorganisation was measured by TEM in skin, bone and intervertebral space, not in the pectoral fin, so the mechanistic bridge from reduced GAG to t |
| frem1a | `necessity` | `mechanism` | pectoral fin fold (part) | 1 / 0 | gene->molecular_function: there is no biochemical or cell-biological characterisation of Frem1a protein in zebrafish at all (no antibody, no localisation, no binding partner); the molecular function i |
| ric1 | `necessity` | `mechanism` | pectoral fin (organ) | 1 / 0 | process->cell_or_tissue_effect in the FIN: procollagen retention and chondrocyte shrinkage were measured in craniofacial cartilage and notochord sheath cells only. Nothing was measured in a pectoral f |
| cyp26a1 | `necessity` | `mechanism` | pectoral fin bud (organ) | 0 / 7 | cell_or_tissue_effect->phenotype: the fin-bud size measurement comes from a morpholino annotated in ZFIN to a somitogenesis paper that does not discuss the fin, and the mutant fin phenotype in Emoto 2 |
| sox9a | `necessity` | `mechanism` | scapulocoracoid (subpart) | 0 / 5 | process->cell_or_tissue_effect in the fin: the chondrocyte stacking/individuation defect was measured in pharyngeal arch condensations, not in the pectoral fin or scapulocoracoid, so the cellular step |
| lef1 | `association` | `mechanism` | pectoral fin lepidotrichium (subpart) | 3 / 4 | gene->molecular_function (association only): no fetched source shows Lef1 occupying or activating a fin target gene; its pathway position is asserted, not demonstrated, in every fetched paper. |
| hdac1 | `association` | `mechanism` | pectoral fin cartilage (subpart) | 2 / 4 | molecular_function->process: the only candidate target link is whole-embryo RT-qPCR on 'potential targets', and the fin in situ shows tbx5a intensity unchanged in the bud, so no transcriptional mechan |
| pbx4 | `hypothesis` | `necessity` | pectoral fin bud (precursor) | 4 / 3 | The whole chain: no fetched publication TEXT describes a pbx4 pectoral fin phenotype, and there is no fetched evidence of any kind connecting pbx4 to Wnt signalling. The fin link exists only as ZFIN c |
| ptch1 | `hypothesis` | `mechanism` | pectoral fin (organ) | 2 / 1 | gene->molecular_function: graded hypothesis, since the only fetched statements about zebrafish Ptch1 binding Hh and inhibiting Smo are domain inference and received pathway topology, with no binding o |
| tbx5b | `hypothesis` | `necessity` | pectoral fin (organ) | 2 / 1 | gene->molecular_function: nothing experimental. The Tbx5b protein has never been shown to bind DNA or activate transcription; its molecular function is pure phylogenetic inference (GO IBA only). |
| slc43a2a | `hypothesis` | `mechanism` | pectoral fin lepidotrichium (subpart) | 1 / 3 | molecular_function->process, which is empty of experiment. The transport function is solid but entirely from mammalian orthologs read as abstracts, and nothing bridges 'moves leucine/methionine' to 'c |
| wls | `hypothesis` | `mechanism` | pectoral fin skeleton (part) | 1 / 0 | gene->molecular_function (hypothesis): no fetched source measures Wnt ligand secretion in zebrafish, so the cargo-receptor role is imported. The downstream reporter data are strong, but the Wnt reduct |
| ezh2 | `missing` | `mechanism` | pectoral fin (organ) | 2 / 1 | process->cell_or_tissue_effect: entirely missing. Nothing links the chromatin lesion to the fin at the cellular level, and the only bridge is that tbx genes are expressed in the fin |
| tbx16 | `missing` | `mechanism` | pectoral fin (organ) | 1 / 2 | process->cell_or_tissue_effect: the chain breaks completely between gastrulation-stage trunk mesoderm and the fin. USEFUL NEGATIVE RESULT: tbx16's only fin evidence is a single ZFIN row from a pleiotr |
| trim33 | `missing` | `mechanism` | ZFA:0000040 (part) | 1 / 0 | cell_or_tissue_effect->phenotype for the pectoral fin: no fetched publication of any kind links trim33 to the pectoral fin. USEFUL NEGATIVE RESULT for this project. |
| cpsf1 | `missing` | `mechanism` | pectoral fin skeleton (part) | 0 / 2 | process->cell_or_tissue_effect and cell_or_tissue_effect->phenotype: the entire experimental chain concerns haematopoietic stem cells, and the two fin rows are ZFIN curation of a paper whose full text |

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
- **hhip**: No fetched source assays hhip loss of function at ZFA:0001451 (zone of polarizing activity) or ZFA:0000085 (apical ectodermal ridge pectoral fin bud).
- **hhip**: Cyclopamine rescue in Koudijs 2005 was scored on eye and ear, not on the pectoral fin, so no pharmacological rescue of the fin phenotype itself was found.
- **hhip**: No sufficiency evidence: no hhip overexpression or gain-of-function experiment in the pectoral fin in any fetched source.
- **ptch1**: No fetched source measures zebrafish Ptch1 (old Ptc2) binding a Hedgehog ligand or inhibiting Smoothened directly.
- **ptch1**: Cyclopamine rescue of lep/ptch1 was scored on eye and ear, never on the pectoral fin; the fin phenotype has no pharmacological-rescue evidence.
- **ptch1**: No fin-bud-level cell biology (proliferation, cell counts) in ptch1 mutants; nothing at ZFA:0001451 or ZFA:0000085.
- **ptch1**: The ptch1 fin phenotype rests on a 1997 screen paper whose abstract does not name the gene; the gene-structure-stage link is the ZFIN annotation.
- **disp1**: No fetched source examines the pectoral fin bud of a disp1/chameleon mutant; all disp1 tissue analysis in the fetched literature is craniofacial or midline.
- **disp1**: No Hh-pathway readout (ptch1, gli1) in the disp1 mutant pectoral fin bud; nothing at ZFA:0001451 or ZFA:0000085 for this gene.
- **disp1**: No cyclopamine or Smo-agonist experiment on the disp1 fin phenotype, and no rescue of the fin phenotype by disp1 mRNA.
- **disp1**: No sufficiency evidence (disp1 overexpression) for any fin structure.
- **cyp26a1**: No DEAB or RA-antagonist experiment targeted at the cyp26a1 mutant pectoral fin was found; the pharmacology (RA rescue, RA blockade) comes from aldh1a2/neckless, not from cyp26a1.
- **cyp26a1**: ZFA:0000141 is an organ precursor in NODE_IDS.json ('level': 'precursor'); it is reported here under the nearest schema level 'organ'.
- **cyp26a1**: No source assays the apical ectodermal ridge (ZFA:0000085) or the zone of polarizing activity (ZFA:0001451) in cyp26a1 loss of function.
- **cyp26a1**: No sufficiency evidence: no cyp26a1 overexpression experiment in the fin field in any fetched source.
- **rerea**: No fetched source measures RA signalling output (RARE reporter, rarb/cyp26a1 readout) in the pectoral fin bud of a rerea mutant.
- **rerea**: The one pharmacological test on the rerea fin phenotype (HPI-1 Gli inhibitor) did not rescue it, and cyclopamine was not effective either, so the pathway responsible for the fin defect is unidentified.
- **rerea**: Plaster 2007 is not open access; the fin-specific claim is the ZFIN annotation of that paper and could not be verified against its text.
- **rerea**: ZFIN attributes the rerea pectoral-fin decreased-size rows to a branchial-arch screen paper whose abstract names neither rerea nor babyface.
- **rerea**: No sufficiency evidence (rerea overexpression) for any fin structure.
- **tbx5a**: No ChIP, EMSA or enhancer-reporter evidence in any fetched source that Tbx5a binds the zebrafish fgf24 locus; the gene->fgf24 step rests on morphant/mutant in situ epistasis.
- **tbx5a**: ZFA:0001453 (pectoral fin field), the compartment where the tbx5a cell-tracking experiments are done, is not in NODE_IDS.json (node_not_in_subtree: true).
- **tbx5a**: No fetched source places tbx5a or Tbx5a protein in the apical ectodermal ridge (ZFA:0000085); the ZFIN expression records localise it to fin field, fin bud mesoderm and fin mesenchyme only, so the chain cannot be drawn through the AER for tbx5a.
- **tbx5a**: Mao 2015 (PMID 26525676), the cell-tracking paper, is not open access: Europe PMC fullTextXML returned HTTP 500 and NCBI PMC efetch returned 'The publisher of this article does not allow downloading of the full text in XML form.' It was read as abstract only (plus the passages quoted verbatim inside Boyle-Anderson 2022).
- **tbx5a**: No flying-fish (Exocoetidae) tbx5a data of any kind; all of the above is zebrafish proxy data.
- **tbx5b**: No experimental molecular-function evidence for Tbx5b at all (ZFIN GO: only IBA/GO_REF:0000033).
- **tbx5b**: tbx5b expression in the pectoral fin is thinly documented: ZFIN has a single wildtype-expression record, ZFA:0001161 at Pharyngula:Prim-25 from PMID 23441045, and Pi-Roig state they had not previously detected tbx5b in developing fins ("Although we had not previously observed tbx5b expression in developing pectoral fins [ 16 ], others have recently described it in the pectoral fin bud mesenchyme of 36 hpf embryos [ 17 ]"). So the ZFA:0001000 node is association at best, and contested.
- **tbx5b**: No tbx5b phenotype statement below organ level in ZFIN - no skeletal, mesenchymal or AER sub-phenotype.
- **tbx5b**: Most tbx5b fin data are morpholino-based; only the shape/length phenotype has a germline allele (ch3, PMID 30532148).
- **tbx5b**: No flying-fish tbx5b data.
- **fgf24**: No biochemical demonstration that Fgf24 binds or activates any Fgfr; GO MF annotations for fgf24 are IBA/IEA only.
- **fgf24**: No fetched source gives the paralog situation for fgf24 itself (no fgf24a/fgf24b, no stated tetrapod orthologue), so the paralog field rests on subfamily assignment alone.
- **fgf24**: The mesenchyme-to-AER switch of fgf24 is documented by expression time course (Camarata 2010, Pi-Roig 2014); the causal requirement for AER-phase fgf24 specifically (as opposed to mesodermal-phase fgf24) is not separated by any conditional or stage-restricted experiment in the fetched sources.
- **fgf24**: ZFA:0001453 (pectoral fin field), the earliest fgf24 domain, is not in NODE_IDS.json (node_not_in_subtree: true).
- **fgf24**: Fischer 2003 (PMID 12810598), the primary fgf24 fin paper, is not open access (Europe PMC: isOpenAccess N, no PMCID) and was read as abstract only.
- **fgf24**: No flying-fish fgf24 data.
- **fgf10a**: ZFIN records no fgf10a phenotype statement below the organ / fin-bud level: 5 rows total, all at ZFA:0001161, ZFA:0001383 or ZFA:0000108. No skeletal, AER or cell-level fgf10a phenotype exists.
- **fgf10a**: ZFA:0000085 is reached as the tissue EFFECT of fgf10a, not as a site of fgf10a expression or of a curated fgf10a phenotype; declaring it the deepest node with evidence depends on accepting the epistatic AER argument.
- **fgf10a**: No evidence either way about fgf10b in the pectoral fin; its documented roles are liver/pancreas (Yan 2015) and otic/epibranchial placodes, so the fgf10a fin role must not be transferred.
- **fgf10a**: Three of the five ZFIN fgf10a fin rows are incidental observations in papers about other organs.
- **fgf10a**: Norton 2005 (PMID 16221725) and Nomura 2006 (PMID 16815307) are not open access and were read as abstract only.
- **fgf10a**: No flying-fish fgf10a data.
- **shha**: No direct binding or receptor-activation assay for zebrafish Shha protein in any fetched source; GO MF annotations for shha are IBA/ISS only.
- **shha**: ZFA:0001456 (pectoral fin endoskeletal disc), where several of the deepest shha phenotype rows sit, is not in NODE_IDS.json (node_not_in_subtree: true).
- **shha**: Neumann 1999 (PMID 10518498) and Grandel 2000 (PMID 10976049), the two load-bearing fin papers for shha, are not open access (Europe PMC: isOpenAccess N, no PMCID); both were read as abstract only, so the stage- and tissue-resolved detail behind "required for normal development of the apical ectodermal fold" could not be quoted from their results sections.
- **shha**: The cyclopamine and hoxd10a-morpholino experiments perturb Hh signalling or shh timing rather than shha gene function, so the dose/timing-to-endoskeleton-size relation is one step removed from shha loss of function.
- **shha**: Nothing about shhb in the pectoral fin, in either direction.
- **shha**: No flying-fish shha data.
- **extl3**: Norton 2005 (the only paper that puts extl3 on the Fgf10 pathway) is not open access; only the abstract was read, so the fin-bud stages and target genes assayed could not be recorded in the paper's own words.
- **extl3**: No cell-type-resolved data (scRNA-seq, lineage) for extl3 in the pectoral fin bud; no evidence reaching ZFA:0000085 (apical ectodermal ridge) or ZFA:0001000 (fin mesenchyme) for extl3.
- **extl3**: No chondroitin-sulfate-side explanation for the pectoral fin phenotype, although Holmborn 2012 shows extl3 mutants make MORE CS than controls - whether the raised CS contributes to the fin phenotype is untested.
- **b3galt6**: No signalling-pathway assay in b3galt6 mutants, so the thread cannot say which pathway a GAG-linkage defect perturbs in the fin.
- **b3galt6**: No chondrocyte-level or osteoblast-level readout in the pectoral fin (no cell counts, proliferation or differentiation markers), so no evidence reaches a cell node.
- **b3galt6**: GAG measurements are from adult bone, muscle and skin; no GAG quantification from fin tissue at the larval stages when the radials are patterned.
- **b3galt6**: Only one allele (cmg20) is reported in ZFIN for the fin phenotypes; no second independent allele and no rescue.
- **lama5**: Webb 2007, the primary lama5 fin paper, is not open access; the pectoral-fin AER-to-apical-fold data could only be taken from the abstract, so stages and markers are not in the paper's own words.
- **lama5**: No demonstration that loss of lama5 changes the output of any signalling pathway in the pectoral fin (the Wnt link is Wnt -> lama5, not lama5 -> Wnt).
- **lama5**: No cell-type-resolved data: the affected cells are called 'epidermis of the developing fin fold' with no basal/superficial keratinocyte distinction, so no ZFA+CL post-composed cell node can be filled.
- **lama5**: No adult pectoral fin skeletal data (radials, lepidotrichia) for lama5 beyond the ZFIN 'has fewer parts of type' row from the 1996 screen.
- **hmcn1**: No electron microscopy of pectoral fin blisters, so the tissue plane of failure in the pectoral fin fold is assumed, not shown.
- **hmcn1**: No signalling-pathway readout in hmcn1 mutants at all; whether basement-membrane detachment alters Fgf, Wnt or Shh in the fin is unknown.
- **hmcn1**: Zhang 2022 (hemicentin-1 / nidogen-2 binding) is not open access in Europe PMC (fullTextXML returned HTTP 500), so only the abstract was read; the affinity figures and the zebrafish nid2a genetics could not be checked in the paper's own words.
- **hmcn1**: No adult pectoral fin skeletal phenotyping (radials, lepidotrichia, actinotrichia) for hmcn1 beyond the ZFIN 'has fewer parts of type' row.
- **frem1a**: No Frem1a protein data in zebrafish: no immunolocalisation in the fin basement membrane, so even the subcellular site of action is assumed from fras1/frem2a.
- **frem1a**: No electron microscopy of frem1a/rafels fin blisters, so the tissue plane of failure is inferred from fras1 and hmcn1.
- **frem1a**: frem1a is the only gene in this set with a ZFIN 'pectoral fin characteristic, abnormal' row whose publication (ZDB-PUB-060503-2) has no PubMed ID in pub_to_pubmed_id_translation.txt, so that row could not be traced to a fetchable source.
- **frem1a**: No signalling pathway tested; no adult fin skeletal analysis beyond the 1996 screen's ray count.
- **fras1**: Richardson 2014 (Fras1-AMACO direct binding) and Talbot 2016 (fras1-itga8) are both closed in Europe PMC (fullTextXML HTTP 500), so the CSPG/P2 domain mapping and the itga8 genetics were read from abstracts only.
- **fras1**: No electron microscopy or molecular analysis of pectoral fin blisters in fras1 mutants.
- **fras1**: No demonstration that Fras1 carries or presents a glycosaminoglycan chain in zebrafish, despite the protein's CSPG domains, so the 'proteoglycan modulating a signalling pathway' route is untested for this gene.
- **fras1**: The Fraser-complex paper most relevant to fin ray patterning (Robbins et al., 'The Fraser complex interconnects tissue layers to support basal epidermis and osteoblast integrated morphogenesis underlying fin skeletal patterning', 2023) is indexed in Europe PMC only as a preprint with no PMID, PMCID or retrievable full text, so it could not be used.
- **sec24d**: No imaging or marker analysis of pectoral fin chondrocytes in sec24d mutants, so no fin-level cell node (ZFA:0001161+ZFA:0009084 or ZFA:0000257+ZFA:0009027) has direct evidence.
- **sec24d**: No conditional or fin-restricted knockdown, and no mosaic/transplantation experiment, so a cell-autonomous requirement in the fin is unestablished.
- **sec24d**: Pectoral fin ZFIN rows at ZFA:0001161 only; ZFA:0000943 (fin skeleton) comes from an author summary sentence, not from a scored ZFIN annotation for sec24d alone.
- **sec24d**: No flying-fish (Exocoetidae) data of any kind for sec24d.
- **ric1**: No Col2 immunofluorescence, chondrocyte volume measurement or mosaic analysis in the pectoral fin of ric1-/-.
- **ric1**: No rescue experiment scored on the fin phenotype (rescue was read out on jaw protrusion, body length and intracellular collagen).
- **ric1**: No flying-fish data; the human arm of the paper is a biobank/clinical phenome, which cannot speak to fin enlargement.
- **ric1**: No stage earlier than 5 dpf examined for the fin, so whether the fin bud is affected at all is unknown.
- **trim33**: No publication links trim33/tif1gamma to the pectoral fin; the ZFIN 'pectoral fin rough' row derives from a non-open-access 1996 screen paper whose abstract does not name the locus.
- **trim33**: The demonstrated fin structure is the MEDIAN/CAUDAL fin fold, not the pectoral fin, and its cause is non-specific mesenchymal apoptosis shared with the trunk and tail bud.
- **trim33**: No zebrafish assay of Tif1gamma's molecular function (no ChIP, reporter or coactivator assay), so gene->molecular_function stays at association.
- **trim33**: No flying-fish data.
- **mib1**: Pax7 progenitor counts, electron microscopy and the Desmin/Vinculin analysis were done on ta52b (mib1 and mib2) and not repeated on the mib1-specific m178 allele.
- **mib1**: No mib1 mosaic or tissue-specific rescue in the fin, so cell autonomy within the fin (signalling vs receiving cell) is not established there.
- **mib1**: Itoh 2003 full text is not open access; the ubiquitylation mechanism rests on its abstract.
- **mib1**: No Notch target gene (her6, her13.2) output quantified in mutant fins, so loss of pathway output in that specific tissue is inferred rather than measured.
- **mib1**: No flying-fish data; whether enlarged pectoral fins in Exocoetidae involve altered Notch-dependent myogenesis is entirely untested.
- **tbx16**: No publication reports a pectoral fin phenotype for tbx16/spadetail; the 'aplastic pectoral fin' annotation is ZFIN curation of a non-open-access gastrulation screen.
- **tbx16**: No cell or tissue measurement in the fin bud, and no fin marker (tbx5a, shha, fgf24) analysis in tbx16 mutants in any fetched source.
- **tbx16**: Mechanistic work on Tbx16 targets concerns deltaC and papc in tailbud and presomitic mesoderm; the fin bud derives from lateral plate mesoderm, so the tissue route to the fin is not even proposed.
- **tbx16**: The deepest node ZFA:0001161 is listed because ZFIN annotates it, not because any fetched source supports it; treat it as unsupported.
- **tbx16**: No flying-fish data.
- **cpsf1**: Bolli 2011 full text is not open access (Europe PMC fullTextXML for PMC3087528 returned HTTP 500), so the fin measurement behind the two ZFIN rows could not be read.
- **cpsf1**: No fin cell type, marker or skeletal-staining result for cpsf1 in any fetched source.
- **cpsf1**: cpsf1's molecular mechanism (poly(A) site selection) is demonstrated only in human cancer cell lines; the zebrafish evidence is abstract-level.
- **cpsf1**: Decreased fin size at 5 dpf is not separated from general growth retardation in a mutant with collapsing haematopoiesis; no stage-matched size control is available to me.
- **cpsf1**: The deepest node ZFA:0000943 rests on a ZFIN row only, not on a fetched source; treat it as unsupported.
- **cpsf1**: No flying-fish data.
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
- **lef1**: Full text of PMID 21862556 and 21862557 unobtainable (Europe PMC fullTextXML HTTP 500 for PMC3160089 and PMC3160090; NCBI PMC efetch returns a publisher block), so the pectoral fin lepidotrichium phenotype rests on the ZFIN curated row and not on quoted paper text.
- **lef1**: No fetched source gives ray segment length, segment number or ray bifurcation data for lef1.
- **lef1**: No fetched source links lef1 to pectoral fin (as opposed to caudal fin) regeneration.
- **lef1**: No fetched ChIP, reporter or target-gene assay places Lef1 on a fin-specific promoter.
- **rspo2**: Tatsumi 2014 (FEBS Lett) is not open access and has no PMCID in Europe PMC; only the abstract was read, so no figure-level ray measurements could be quoted.
- **rspo2**: No Wnt-reporter, axin2 or lef1 readout in rspo2 mutant fins in any fetched source - the gene-to-pathway link in the fin itself is unverified.
- **rspo2**: No rspo2 regeneration data.
- **rspo2**: No ray segment length or bifurcation data for rspo2.
- **apc**: No apc mutant data on fin rays (lepidotrichia) at all - the mutants do not survive to ray-forming stages in any fetched source.
- **apc**: van der Velden 2012 (PMID 22619390) is not in PMC; only the abstract was read, so the apc-ring1b-Fgf rescue cannot be quoted at figure level.
- **apc**: The ZFIN pectoral fin rows for apc come from a Cell paper on intestine (PMID 20850014) and a Nature paper on cardiac valves (PMID 14534590) whose abstracts do not mention fins; only the curated rows support them.
- **apc**: Bhattacharya 2018 full text could not be retrieved (Europe PMC fullTextXML HTTP 500 for PMC6288381; NCBI PMC efetch publisher-blocked), so which Wnt inhibitor was used for the segment-length experiment is unknown from fetched text.
- **apc**: No fetched source reports LiCl or IWR-1 by name in an apc fin experiment.
- **wls**: No ray-level (lepidotrichium) data possible: zygotic wls mutants die by about 12 dpf.
- **wls**: No maternal-zygotic wls mutant in any fetched source; the authors flag this explicitly ('The precise roles of maternally provided Wls need to be rigorously tested in zebrafish by eliminating the maternal contribution and generating a maternal-zygotic mutant').
- **wls**: No direct measurement of Wnt ligand secretion, and no identification of which Wnt ligand supplies the pectoral fin.
- **wls**: Europe PMC fullTextXML HTTP 500 for PMC4639407; full text obtained instead through NCBI PMC efetch.
- **pbx4**: No Wnt connection for pbx4 in any fetched source - it is in this set by ZFIN fin ranking, not pathway membership, and must not be presented as a Wnt component.
- **pbx4**: No fetched paper text for the pbx4 pectoral fin bud phenotype. Targeted searches returned nothing usable: Europe PMC query '"pbx4" AND "pectoral fin bud"' returned 0 results; '(pbx4 OR lazarus) AND "pectoral fin"' returned only reviews and unrelated papers; PubMed esearch 'pbx4 AND (fin OR limb) AND zebrafish' returned 0 ids.
- **pbx4**: Popperl 2000 (Mol Cell) and Amsterdam 2004 (PNAS) are not open in PMC; abstract only.
- **pbx4**: No ray, segment or branching data for pbx4.

## Validation flags

These are the assembler's own checks on the subagents' output; they are counted in `causal-chains.json`.

- chromatin/ezh2/process->cell_or_tissue_effect: no sources at all: 1
- secretion/trim33/cell_or_tissue_effect->phenotype: no sources at all: 1
- secretion/tbx16/process->cell_or_tissue_effect: no sources at all: 1
- secretion/tbx16/cell_or_tissue_effect->phenotype: no sources at all: 1
- secretion/cpsf1/process->cell_or_tissue_effect: no sources at all: 1
- secretion/cpsf1/cell_or_tissue_effect->phenotype: no sources at all: 1

## Interactions

30 tissue-to-tissue and cell-to-cell arrows are in `genotype/interactions.json` (1 inferred by orthology from another species' ligand-receptor data). By grade: {'mechanism': 12, 'sufficiency': 1, 'necessity': 13, 'hypothesis': 3, 'association': 1}.
