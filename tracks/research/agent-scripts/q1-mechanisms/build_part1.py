"""Part 1 of build_output.py: helpers, quote verification, literature findings and own-calculation findings."""
import json,re,sys
sys.stdout.reconfigure(encoding="utf-8")
S="D:/Users/ashenoy00000/delphi-work/agents2/scratch/q1-mechanisms/"
def norm(t):
    t=t.replace("R<sup>2</sup>","R2"); t=re.sub(r"<sup>.*?</sup>","",t); t=re.sub(r"<xref[^>]*>.*?</xref>","",t); t=re.sub(r"<[^>]+>"," ",t)
    t=t.replace("&amp;","&").replace("\u2009"," ").replace("\u2013","-")
    return re.sub(r"\s+"," ",t).strip()
src={}
for f in ("abs1.json","abs2.json","abs3.json"):
    for k,v in json.load(open(S+f,encoding="utf-8")).items(): src[v["doi"]]=norm(v["abstract"] or "")
ft={"10.1016/j.molcel.2022.04.009":"PMC9278412.xml","10.1038/s41586-022-04570-y":"PMC9021019.xml"}
fulltext={d:norm(open(S+p,encoding="utf-8").read()) for d,p in ft.items()}
def check(doi,q,full=False):
    t=(fulltext if full else src)[doi]
    ok=norm(q) in t
    if not ok: print("QUOTE NOT FOUND",doi,"|",q)
    return ok
U=lambda d:"https://doi.org/"+d
DOI=dict(butler="10.1101/gad.924301",zabidi="10.1038/nature13994",arnold="10.1038/nbt.3739",haberle19="10.1038/s41586-019-1210-7",
 bergman="10.1038/s41586-022-04877-w",mara="10.1016/j.molcel.2022.04.009",tan="10.64898/2026.06.25.734173",zuin="10.1038/s41586-022-04570-y",
 rinzema="10.1038/s41594-022-00787-7",spie="10.64898/2026.10.23.761042",bothma="10.7554/elife.07956",abc="10.1038/s41588-019-0538-0",
 ealo="10.1038/s41467-024-51602-4",wang="10.1101/gr.278631.123",cell26="10.1016/j.cell.2026.06.033")
MA=json.load(open(S+"ma_results.json")); SIM=json.load(open(S+"sim_results_NE48.json")); SIM192=json.load(open(S+"sim_results_NE192.json"))
F=[]
def add(claim,doi,quote,conf,value=None,full=False):
    ok=check(doi,quote,full) if quote else None
    d=dict(claim=claim,source=U(doi),confidence=conf if (ok or not quote) else "low",evidence_quote=quote)
    if value: d["value"]=value
    F.append(d)
add("In vivo, some Drosophila enhancers are specific for DPE-containing versus TATA-containing core promoters (position-matched reporter lines).",DOI["butler"],"These studies revealed transcriptional enhancers that are specific for promoters that contain either DPE or TATA box elements.","high")
add("Thousands of Drosophila enhancers show marked specificity for one of two core promoters (a ribosomal-protein-gene promoter versus a developmentally regulated TF promoter).",DOI["zabidi"],"thousands of enhancers in Drosophila melanogaster S2 and ovarian somatic cells (OSCs) exhibit a marked specificity to one of two core promoters","high")
add("The housekeeping/developmental enhancer split is linked to different transcription factors: Dref activates housekeeping, Trl developmental enhancers.",DOI["zabidi"],"we identify two transcription factors--Dref and Trl--that bind and activate housekeeping versus developmental enhancers, respectively.","high")
add("Core-promoter responsiveness to one strong enhancer spans several orders of magnitude across Drosophila sequences (a promoter-side axis).",DOI["arnold"],"In the presence of a single strong enhancer, the enhancer responsiveness of different sequences differs by several orders of magnitude","high")
add("Transcriptional cofactors differ in which core-promoter types they activate (cofactor-promoter compatibility).",DOI["haberle19"],"We observe differential activation of CPs, indicating distinct regulatory preferences or 'compatibilities' between COFs and specific types of CPs.","high")
add("In human K562 ExP STARR-seq (1,000 enhancers x 1,000 promoters), enhancer and promoter activities combine multiplicatively; most enhancers activate all promoters by similar amounts.",DOI["bergman"],"most enhancers activate all promoters by similar amounts, and intrinsic enhancer and promoter activities multiplicatively combine to determine RNA output (R2 = 0.82).","high","R2=0.82 (multiplicative model)")
add("Bergman et al.: housekeeping promoters carry built-in activating motifs (GABPA, YY1) that lower responsiveness to distal enhancers (a ceiling-like promoter-side effect).",DOI["bergman"],"Promoters of housekeeping genes contain built-in activating motifs for factors such as GABPA and YY1, which decrease the responsiveness of promoters to distal enhancers.","high")
add("Martinez-Ara et al. (mouse cells, thousands of CRE-promoter pairs) emphasise the opposite: most CREs are promoter-selective.",DOI["mara"],"More than half of the tested CREs exhibit significant promoter selectivity.","high")
add("Martinez-Ara et al.: selectivity does not track native looping, so compatibility and folding are separate axes.",DOI["mara"],"CRE-promoter selectivity does not correlate with looping interactions in the native genomic context","high")
add("Martinez-Ara et al. note a saturation-like pattern and say it cannot be told apart from lower enhancer dependence of high-basal promoters.",DOI["mara"],"This suggests a saturation effect, or it could indicate that promoters with high basal activity are less dependent on distal enhancers.","high",full=True)
add("Martinez-Ara et al.: strong boosting occurs mostly at low-basal promoters.",DOI["mara"],"Strong boosting occurred primarily at promoters with low basal activities, while highly active promoters were more difficult to boost","high",full=True)
add("Tan et al. 2026 preprint says earlier reporter assays disagree because of assay confounders and finds a similar enhancer rank order across promoters (abstract only; full text blocked by HTTP 429).",DOI["tan"],"Promoters differ in their responsiveness to enhancers (>100-fold versus 1.1-fold activation) while enhancers activate all promoters in a similar rank order.","medium","responsiveness range >100-fold vs 1.1-fold")
add("Tan et al.: promoter output follows a power law in enhancer activity with a promoter-specific exponent (a promoter-specific monotone response, rank-preserving by construction).",DOI["tan"],"Promoter output scales with enhancer activity following a power law, with the exponent varying across promoters.","medium")
add("Tan et al.: responsiveness is modulated by core-promoter TF motifs.",DOI["tan"],"Responsiveness is modulated by transcription factor motifs in the core promoter.","medium")
add("Enhancer effect depends nonlinearly on enhancer-promoter contact probability.",DOI["zuin"],"the transcriptional effect of an enhancer depends on its contact probabilities with the promoter through a nonlinear relationship.","high")
add("Zuin et al. best-fit Hill coefficient for burst frequency versus contact probability is 2.8.",DOI["zuin"],"Hill coefficient ( h ) of 2.8 (95% confidence interval = 2.4-3.2","high","h=2.8 (95% CI 2.4-3.2)",full=True)
add("Enhancer needs cohesin only for activating distant genes (distance/topology axis).",DOI["rinzema"],"It requires cohesin exclusively for the activation of distant genes, not of proximal genes","high")
add("SPIE-seq (preprint): enhancer influence decays with distance with similar average scaling for all enhancers.",DOI["spie"],"enhancer influence declines with genomic distance, following similar average distance-decay scaling across all tested enhancers","medium")
add("SPIE-seq: promoter skipping grows as competitors accumulate, so promoters do not respond independently (invisible in single-promoter reporters).",DOI["spie"],"Promoter skipping is common and increases as competitors accumulate","medium")
add("Strong enhancers behave sub-additively because of competition with the target promoter; weak ones additively (Drosophila embryo).",DOI["bothma"],"weakly active enhancers function additively while strong enhancers behave sub-additively due to competition with the target promoter.","high")
add("A product of activity and contact (ABC) predicts CRISPRi enhancer-gene links better than earlier methods (a one-strength-times-contact model).",DOI["abc"],"a simple activity-by-contact model substantially outperformed previous methods at predicting the complex connections in our CRISPR dataset.","high")
add("In mouse ESC loci, developmental genes insulate regulatory domains partly by promoter competition rather than enhancer blocking.",DOI["ealo"],"developmental genes preferentially contribute to regulatory insulation through non-structural mechanisms involving promoter competition rather than enhancer blocking.","high")
add("Theory: burst frequency and burst size rise with E-P communication strength as power laws.",DOI["wang"],"burst frequency and burst size are up-regulated by E-P communication strength, following power laws with positive exponents.","medium")
add("A native-locus enhancer (eNMU) shows a hierarchy: autonomous enhancer e1 dominates facilitators and the promoter.",DOI["cell26"],"The autonomous enhancer e1 is functionally hierarchical to e2, additional facilitators, and the NMU promoter","medium")
