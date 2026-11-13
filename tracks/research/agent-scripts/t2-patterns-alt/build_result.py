import json, os
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/t2-patterns-alt.json"
S = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-alt/"
EP = "https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML"
ABS = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=DOI:%22{}%22"


def F(claim, source, conf, quote="", value=""):
    d = dict(claim=claim, source=source, confidence=conf)
    if value:
        d["value"] = value
    d["evidence_quote"] = quote
    return d


findings = [
    F("Pure Fisher-KPP expansion (no chemotaxis) is the canonical null for this track; Narla 2021 states it cannot explain chemotactic front speeds.",
      EP % "PMC8640786", "high",
      "it is not sufficient to explain the high expansion speeds of the bacterial front observed in populations of chemotactic bacteria"),
    F("Cremer 2019 reports navigated range expansion spreads faster than unguided Fisher-Kolmogorov expansion.",
      EP % "PMC6883170", "high",
      "This navigated range expansion process spreads faster and yields larger population gains than unguided expansion following the canonical Fisher-Kolmogorov dynamics"),
    F("Own calculation: with D = 50.2e-12 m^2/s (0.18072 mm^2/h, simulation parameter file) the Fisher speed 2*sqrt(D*r) is 0.40 to 1.04 mm/h over the 25 ED Fig 1c conditions; measured speed is 2.49x to 7.59x higher (median 4.73x). D is a simulation parameter, not a measured soft-agar value.",
      S + "fisher_null.py (data: Cremer 2019 MOESM11.xlsx, MOESM3.txt)", "medium", "",
      "u/(2 sqrt(D r)): min 2.49, median 4.73, max 7.59"),
    F("Own calculation: OLS log-log slope of front speed on growth rate over all 25 ED Fig 1c rows (mixed strains and attractants) is 0.96, not the 0.5 of a square-root law; pooled, so only a diagnostic.",
      S + "fisher_null.py", "medium", "", "0.96"),
    F("Phan 2024 (microfluidic E. coli wave with an imaged attractant sensor): the standard Patlak-Keller-Segel model fits at low cell density and diverges at high density.",
      EP % "PMC10801886", "high",
      "While the model agreed well with our data at low cell densities, it diverged at high cell densities."),
    F("Phan 2024 proposes a phenomenological correction: bacteria consume aspartate more slowly at higher local cell density, and the chemotactic coefficient is reduced at high density.",
      EP % "PMC10801886", "high",
      "we propose the following phenomenological correction to the maximum consumption rate, in which the bacteria consume Asp more slowly at higher local cell density"),
    F("Phan 2024 dataset is CC0 on Dryad but 1.10 GB, over the 150 MB cap, so not downloaded; simulation code is on GitHub (emonetlab/ks).",
      "https://api.datacite.org/dois/10.5061/dryad.37pvmcvqx", "high",
      "Simulation code is available at https://github.com/emonetlab/ks", "1104347323 bytes"),
    F("Phan 2024 measured a channel wave, not a soft-agar front; waves at peak OD 0.6 (low) and OD 4.6 (high). Transfer of its density correction to soft agar is untested.",
      EP % "PMC10801886", "medium",
      "the model predictions with the same parameters values clearly deviated from the data in high cell density waves (peak cell density O D = 4.6)"),
    F("Fu 2018: clonal E. coli bands self-sort so individual differences in chemotactic ability are compensated by local gradient steepness (phenotypic heterogeneity as an explanation of collective migration).",
      EP % "PMC5988668", "high",
      "We discover that despite substantial differences in individual chemotactic abilities, the cells are able to migrate as a coherent group by spontaneously sorting themselves within the moving band."),
    F("Fu 2018 data are MATLAB .fig files on figshare (513 MB, CC BY 4.0); model code only on request.",
      "https://api.datacite.org/dois/10.6084/m9.figshare.6207371", "high",
      "The code to simulate the mathematical model is described above and available from the corresponding author upon request.",
      "513097249 bytes"),
    F("Bhattacharjee 2022: populations in a 3D-printed porous gel smooth out imposed morphology perturbations because sensing varies in space; raw data in Princeton DataSpace (CC BY 4.0, size not given by DataCite).",
      EP % "PMC8903832", "high",
      "We find that bacterial populations autonomously smooth out large-scale perturbations in their overall morphology, enabling the cells to continue to migrate together."),
    F("Wolfe and Berg 1989: swarm size in semisolid agar depends on tumble frequency (obstacle escape), so not all swarming need be chemotactic; a competing explanation for part of the speed in agar.",
      ABS.format("10.1073/pnas.86.18.6973"), "high",
      "Surprisingly, the higher the tumble frequency, the larger the swarms."),
    F("Croze 2011 reports front speed only weakly dependent on agar concentration below 0.25% (0.15 to 0.5% studied) and offers an extended Keller-Segel model with agar collisions.",
      ABS.format("10.1016/j.bpj.2011.06.023"), "high",
      "The migration front speed is weakly dependent on agar concentration at C < 0.25%, but decreases sharply above this value."),
    F("DISAGREEMENT: Liu 2019 Fig 5a shows strong agar dependence already between 0.2% and 0.25%. Own means of triplicates: TB 10.03 to 6.17 mm/h, CAA 5.78 to 3.97 mm/h; 0.2% to 0.3% falls to x0.35 (TB) and x0.40 (CAA). Croze (weak below 0.25%) and Liu differ; strains, media and attractants differ, so unresolved.",
      S + "liu2019_agar.py (data: Liu 2019 MOESM11.xlsx)", "medium", "",
      "TB 0.2/0.225/0.25/0.275/0.3% = 10.03/7.90/6.17/4.83/3.47 mm/h; CAA = 5.78/5.20/3.97/2.96/2.28 mm/h"),
    F("All 25 Cremer ED Fig 1c rows are at 0.25% agar, so agar concentration is a fixed hidden covariate; Narla's closed form has no agar term.",
      "D:/Users/ashenoy00000/delphi-work/data/t2alt/cremer2019/MOESM11.xlsx (column 'agar.conc %')", "high", "",
      "0.25 in all 25 rows"),
    F("Liu 2019 evolves E. coli in soft agar and reports an optimal expansion speed per habitat size; source data are 15 xlsx files (about 1 MB total I downloaded). Hwa co-authored it and the Cremer paper, so not an independent lab.",
      EP % "PMC6883132", "high",
      "Contrary to the intuitive expectation that faster is better, we show the existence of an optimal expansion speed associated with a given habitat size."),
    F("Own calculation from Liu 2019 Fig 1c: mean speeds of 60 clones per selection series are 3.515, 4.992, 5.450, 6.748, 7.198 mm/h for selection distances 5, 10, 15, 20, 25 mm.",
      S + "liu2019_numbers.py", "high", "", "3.515/4.992/5.450/6.748/7.198 mm/h"),
    F("Fraebel 2017: selection for faster migration through a porous environment reveals a swimming-speed vs growth-rate trade-off. Public data are sequencing, a movie and code; speed values are in figures only (not read).",
      EP % "PMC5441876", "high",
      "We find that a trade-off between swimming speed and growth rate constrains the evolution of faster migration."),
    F("Ni 2020: motility investment rises when growth slows on poor carbon sources, matching the benefit of chemotaxis; independent support for growth-dependent motility (the design's F1 premise).",
      EP % "PMC6955288", "high",
      "Swimming motility is one of the costliest bacterial behaviors, but expression of motility genes nevertheless increases when bacteria grow slower on poor carbon sources."),
    F("Bhattacharjee 2019: cells in a porous medium are transiently trapped and diffusive at long times, a pore-scale origin for the effective diffusion coefficient that Keller-Segel treats as a constant.",
      ABS.format("10.1038/s41467-019-10115-1"), "high",
      "the cells are intermittently and transiently trapped as they navigate the pore space, exhibiting diffusive behavior at long time scales."),
    F("Saragosti 2011 explains the travelling wave with a kinetic run-and-tumble persistence model, an alternative to the continuum Keller-Segel closure; measured in capillaries, not agar.",
      ABS.format("10.1073/pnas.1101996108"), "high",
      "We recover quantitatively these microscopic and macroscopic observations with a dedicated kinetic model."),
    F("Law library 1.8.1 (59 laws): the only pinned laws relevant to this track are fisher-kpp-speed 1.1.0 and turing-ddi 1.1.0, both candidate and non-binding; no law file mentions chemotaxis, Keller-Segel, bacteria, colony or range expansion. turing-wavelength exists as a law file but is not pinned in 1.8.1.",
      "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/lawsets/lawset-1.8.1.json (script lawset_scan.py)", "high",
      "the four genuine discovery candidates (turing-ddi, kimura-heterozygosity, maynardsmith-hawk-dove, fisher-kpp-speed) stay candidate and stay non-binding."),
    F("fisher-kpp-speed states c^2 = 4*s*D as the minimum of the linear spreading speeds in a one-dimensional, constant-diffusion, logistic setting; it can serve as the null law for the chemotactic front but cannot give a binding red verdict while it is a candidate.",
      "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/laws/fisher-kpp-speed.json", "high",
      "so c is the minimum of the family of linear spreading speeds and is attained at exactly one decay rate"),
]

table = [
    dict(name="Liu 2019 evolution and agar-density sheets (Hwa/Liu, E. coli, soft agar)",
         fields="n_files=15 xlsx; size=about 1 MB; axes=speed_mm_per_h vs agar_pct (0.2-0.3, TB and CAA), vs selection_distance_mm (5-25), growth_rate_per_h; independent_lab=no; licence=none seen; gives=agar axis and 300 evolved-clone speeds the Cremer table lacks; cost=2 days tabular, model needs an agar term",
         source="https://doi.org/10.1038/s41586-019-1734-x"),
    dict(name="Phan 2024 microfluidic travelling wave with imaged attractant (Emonet lab)",
         fields="system=E. coli channel wave; size_bytes=1104347323; licence=CC0; code=github.com/emonetlab/ks; gives=direct attractant profile and a density-dependent PKS correction (the competing explanation); cost=1.1 GB over cap so file-level subset, 1D channel not soft agar, OD 0.6 vs 4.6",
         source="https://doi.org/10.5061/dryad.37pvmcvqx"),
    dict(name="Fu 2018 band sorting in channels (phenotypic heterogeneity)",
         fields="size_bytes=513097249; licence=CC BY 4.0; format=MATLAB .fig; code=on request; gives=tumble-bias distribution vs position in band; cost=figure extraction, no code, channel geometry",
         source="https://doi.org/10.6084/m9.figshare.6207371"),
    dict(name="Bhattacharjee 2022 chemotactic smoothing in 3D-printed porous gel",
         fields="system=E. coli in granular hydrogel; data=Princeton DataSpace; licence=CC BY 4.0; size=not reported; gives=perturbed-geometry front stability, a genuinely new condition; cost=imaging data, needs a 2D/3D PDE solver, format not inspected",
         source="https://doi.org/10.34770/3g41-6j28"),
    dict(name="Fraebel 2017 selection for faster migration (Kuehn lab)",
         fields="public_data=sequencing, movie, code; speed_values=figures only, not read; licence=CC BY 4.0 (movie/code record); gives=speed vs growth trade-off by medium; cost=figure digitising",
         source="https://doi.org/10.7554/eLife.24669"),
    dict(name="Ni 2020 growth-rate dependence of motility (Sourjik lab)",
         fields="data=Datasets S1-S4 (metabolomics, ODE/PDE code) not fetched; gives=independent growth vs motility investment, the alpha input to design F1; cost=SI files, no front-speed data",
         source="https://doi.org/10.1073/pnas.1910849117"),
    dict(name="Croze 2011 and Wolfe-Berg 1989 agar and tumble-rate classics",
         fields="agar_range_pct=0.15-0.5; public_data=none found; gives=agar/obstacle mechanism as rival; cost=text only, no numbers",
         source="https://doi.org/10.1016/j.bpj.2011.06.023"),
    dict(name="Saragosti 2011 kinetic wave model",
         fields="system=E. coli microcapillary; public_data=none located; gives=run-tumble persistence alternative to Keller-Segel; cost=re-derivation, no dataset",
         source="https://doi.org/10.1073/pnas.1101996108"),
    dict(name="Chosen system for comparison: Cremer 2019 ED Fig 1c + Narla 2021 law",
         fields="n_conditions=25; agar_pct=0.25 (all); u_range_mm_per_h=1.0-7.6; r_range_per_h=0.22-1.51; size=11.5 kB; Fisher_null_ratio=2.49-7.59",
         source="https://doi.org/10.1038/s41586-019-1733-y"),
]

summary = (
    "Keep the chosen system (Cremer 2019 table plus Narla 2021 law): no neighbour I checked offers a small tabular many-condition front-speed table with public code. "
    "Run two things alongside it. (1) Liu 2019 source data (15 xlsx, about 1 MB, same Hwa lab so not independent) adds the missing agar axis (own means: TB speed 10.03 to 3.47 mm/h from 0.2 to 0.3 percent agar) and 300 evolved-clone speeds; every Cremer row is at 0.25 percent agar, so agar is a hidden covariate. "
    "(2) Treat the Phan 2024 density-dependent correction to Patlak-Keller-Segel (fits at OD 0.6, diverges at OD 4.6; CC0 data 1.1 GB) as the strongest published competing explanation, with the Wolfe-Berg/Croze agar-obstacle mechanism and Fu 2018 phenotypic sorting as secondary rivals. Phan measured a microfluidic channel, not agar, so a transfer test is needed and the design's F5 should be framed as a replication. "
    "Pure Fisher-KPP is the null the law library can express (fisher-kpp-speed, candidate, non-binding in lawset 1.8.1): by own calculation measured speeds are 2.49 to 7.59 times 2*sqrt(D*r), median 4.73, with D from the simulation parameter file. "
    "Fu 2018, Bhattacharjee 2022 and Fraebel 2017 are not worth running now (figure-only, very large, or no tabular speeds). Law set 1.8.1 has no chemotaxis law and the Turing laws do not apply. "
    "Open disagreement: Croze says speed is weakly agar-dependent below 0.25 percent; Liu 2019 shows a strong dependence in that range under different conditions."
)

lay = (
    "Imagine a crowd of bacteria spreading across a dish of jelly. They do not just drift: they smell food and push towards it, and they also multiply. "
    "The earlier team picked one well-measured set of such experiments, and I looked for other experiments that could play the same role. "
    "A plain 'multiply and wander' explanation predicts a speed about five times too slow, so that rival is out. "
    "The best live rival says that when the crowd gets very dense the cells smell less well, and one study showed the standard model breaks there. "
    "I advise keeping the chosen set and adding a small second dataset that changes how firm the jelly is, because every chosen experiment used the same firmness."
)

glossary = [
    dict(term="chemotaxis", plain="Cells steering towards a chemical they like."),
    dict(term="multiply and wander (Fisher-KPP)", plain="A front driven only by growth plus random motion; its speed is 2 times the square root of (diffusion times growth rate)."),
    dict(term="Patlak-Keller-Segel model", plain="The standard equations for cells that climb a chemical gradient they themselves create."),
    dict(term="jelly firmness / agar concentration", plain="How much gelling powder is in the dish; more means firmer and harder to swim through."),
    dict(term="dense crowd / cell density", plain="How many cells are packed into a given volume."),
    dict(term="held-out", plain="Data kept hidden when fitting a model so it can be tested fairly."),
    dict(term="source data", plain="The numbers behind a paper's figures, published as spreadsheets."),
    dict(term="CC0 / CC BY", plain="Open licences: CC0 gives up all rights, CC BY requires credit."),
]

key_claims = [
    dict(claim="Pure Fisher-KPP expansion is not enough: measured chemotactic front speeds are 2.49 to 7.59 times 2*sqrt(D*r) over the 25 Cremer conditions (D from the published parameter file).",
         source=S + "fisher_null.py; Narla 2021 " + EP % "PMC8640786",
         evidence_quote="it is not sufficient to explain the high expansion speeds of the bacterial front observed in populations of chemotactic bacteria"),
    dict(claim="The strongest published competitor is Phan 2024: Patlak-Keller-Segel with growth fits at low cell density but fails at high density, and a density-dependent correction is proposed.",
         source=EP % "PMC10801886",
         evidence_quote="At high cell densities, the model fails to describe both Asp and bacterial dynamics."),
    dict(claim="All Cremer 2019 ED Fig 1c conditions are at 0.25 percent agar, while Liu 2019 Fig 5a shows speed falling sharply between 0.2 and 0.3 percent agar; Croze 2011 disagrees on how strong the dependence is below 0.25 percent.",
         source=S + "liu2019_agar.py; Croze 2011 abstract via Europe PMC",
         evidence_quote="The migration front speed is weakly dependent on agar concentration at C < 0.25%, but decreases sharply above this value."),
    dict(claim="Keep the chosen system and add Liu 2019 tabular data as a cheap second arm; Phan 2024 is the competing-explanation arm but needs a subset of a 1.1 GB deposit; Fu, Bhattacharjee and Fraebel are not worth running now.",
         source="This report's table and findings (sizes from DataCite metadata)", evidence_quote=""),
]

recommendations = [
    "KEEP the chosen system: it remains the only candidate with a small tabular 25-condition front-speed table, public code and a closed-form law.",
    "RUN ALONGSIDE (1): Liu 2019 MOESM11 (Fig 5a agar series) and MOESM7 (Fig 1c clone speeds). Freeze an agar-dependence prediction (Croze 2011 style agar term) before extracting anything beyond the means reported here. Caveats: same lab, so not an independent replication; I have seen the Fig 5a means, so it is declared-seen.",
    "RUN ALONGSIDE (2): put the Phan 2024 density-dependent correction into the pre-registration as an explicit rival model and test whether it improves the held-out Cremer rows. Check the Dryad file list first and fetch only what is needed (deposit 1.1 GB, cap 150 MB).",
    "Use Fisher-KPP (law fisher-kpp-speed, candidate) as the null: the 2.49x to 7.59x gap is a one-line elimination of the pure-growth explanation, but D comes from the simulation parameter file, and no binding red verdict is possible while the law is a candidate.",
    "Do not run Fu 2018, Bhattacharjee 2022 or Fraebel 2017 unless the team gains a PDE solver or a wet lab.",
    "Re-state the earlier law-mapper against lawset 1.8.1: fisher-kpp-speed and turing-ddi are now pinned as candidates; there is still no chemotaxis or Keller-Segel law.",
]

reproduce = [
    dict(what="Fetch Liu 2019 source data (saved with SHA256SUMS.txt and FETCHED_UTC.txt)",
         command_or_url="curl -sL -A delphi-research/0.1 https://static-content.springer.com/esm/art%3A10.1038%2Fs41586-019-1734-x/MediaObjects/41586_2019_1734_MOESM11_ESM.xlsx (also ..._MOESM7_ESM.xlsx); local copy D:/Users/ashenoy00000/delphi-work/data/t2alt/liu2019",
         expected="MOESM11.xlsx 19759 bytes, sheet 'Fig. 5a'"),
    dict(what="Agar-dependence means (Python 3.14, openpyxl 3.1.5)",
         command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-alt/liu2019_agar.py",
         expected="TB 0.2->0.3%: 10.03 -> 3.47 (x0.35); CAA 5.78 -> 2.28 (x0.40)"),
    dict(what="Clone speeds by selection series",
         command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-alt/liu2019_numbers.py D:/Users/ashenoy00000/delphi-work/data/t2alt/liu2019",
         expected="means 3.515, 4.992, 5.450, 6.748, 7.198 mm/h, n=60 each"),
    dict(what="Fetch Cremer 2019 ED Fig 1c table and parameter file",
         command_or_url="https://static-content.springer.com/esm/art%3A10.1038%2Fs41586-019-1733-y/MediaObjects/41586_2019_1733_MOESM11_ESM.xlsx and ..._MOESM3_ESM.txt; local copy D:/Users/ashenoy00000/delphi-work/data/t2alt/cremer2019",
         expected="MOESM11.xlsx 11512 bytes; MOESM3.txt 5908 bytes, line 31 D_chemotaxis_1: 50.2e-12"),
    dict(what="Fisher-null ratio and growth-rate slope",
         command_or_url="python D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-alt/fisher_null.py",
         expected="D = 0.18072 mm^2/h; ratio min 2.49, median 4.73, max 7.59; slope 0.96"),
    dict(what="Data sizes and licences of alternatives",
         command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-alt/datacite_check.py 10.5061/dryad.37pvmcvqx 10.6084/m9.figshare.6207371 10.34770/3g41-6j28",
         expected="Dryad 1104347323 bytes CC0; figshare 513097249 bytes CC BY 4.0; DataSpace CC BY 4.0, no size"),
    dict(what="Competing-explanation sentences (Phan 2024)",
         command_or_url="curl -s https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10801886/fullTextXML -o phan.xml; python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-alt/xml_text.py phan.xml 'diverged|fails to describe'",
         expected="'it diverged at high cell densities'; 'the model fails to describe both Asp and bacterial dynamics'"),
    dict(what="Law library scan (read-only)",
         command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-alt/lawset_scan.py",
         expected="lawset 1.8.1, 59 laws; pinned fisher-kpp-speed 1.1.0 and turing-ddi 1.1.0 (candidate); no law mentions chemotaxis"),
    dict(what="DOI checks",
         command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/t2-patterns-alt/crossref_verify.py <doi> ...",
         expected="ok true with matching titles (Crossref returns HTTP 429 if queried too fast; script sleeps 3 s)"),
]

could_not_find = [
    "Phan 2024 Dryad files were not downloaded (1.10 GB, over the 150 MB cap; unauthenticated whole-dataset download returned HTTP 401). Its fitted parameters and the size of the density correction were not read.",
    "Fu 2018 figshare archive (513 MB) and Bhattacharjee 2022 DataSpace deposit were not downloaded; formats and contents are unverified.",
    "Fraebel 2017: eLife API lists no source-data files; migration speeds exist only in figures, values not read.",
    "Ni 2020 Datasets S1-S4 not fetched; I did not extract the growth-rate vs motility slope (the alpha needed by the design's F1).",
    "No public dataset from a fully independent second lab with front speed plus growth rate in soft agar was found (Liu 2019 shares an author with Cremer 2019). Search covered only Europe PMC full texts, Crossref and DataCite.",
    "Narla's closed-form speed (Eq 21) was not copied; the Fisher null uses the standard 2*sqrt(D*r) form, whose square-root sign was lost in the extracted Narla text (the prose and the variable names confirm it).",
    "Liu 2019 and Cremer 2019 supplementary files carry no explicit licence that I saw.",
    "Phan 2020 (PRX, mazes and fractals) was a real Crossref record but I did not check its data; Europe PMC has no record.",
    "No non-E. coli patterning candidate beyond the scout's (biofilm wrinkling, sector boundaries, Proteus rings, synthetic stripes) was added; I did not search for Dictyostelium, Myxococcus or yeast datasets.",
    "Seen-data caveat: I looked at Cremer ED Fig 1c values (for the Fisher null), Liu Fig 5a means and Fig 1c means; these are not blind for any later freeze.",
    "Full author lists were not checked; citations give the first author from Crossref plus et al.",
]


def C(a, y, t, d, use, venue, extra=""):
    return dict(authors=a, year=y, title=t, doi_or_arxiv=d, verified=True,
                how_verified="Fetched https://api.crossref.org/works/%s in this run and saw matching title and year%s" % (d, extra),
                used_for=use, venue=venue)


citations = [
    C("Narla AV et al.", 2021, "A traveling-wave solution for bacterial chemotaxis with growth", "10.1073/pnas.2105138118", "Fisher speed statement; law", "PNAS", "; full text read via Europe PMC PMC8640786"),
    C("Cremer J et al.", 2019, "Chemotaxis as a navigation strategy to boost range expansion", "10.1038/s41586-019-1733-y", "chosen system data", "Nature", "; source data downloaded"),
    C("Liu W et al.", 2019, "An evolutionarily stable strategy to colonize spatially extended habitats", "10.1038/s41586-019-1734-x", "second dataset", "Nature", "; source data downloaded"),
    C("Phan TV et al.", 2024, "Direct measurement of dynamic attractant gradients reveals breakdown of the Patlak-Keller-Segel chemotaxis model", "10.1073/pnas.2309251121", "competing explanation", "PNAS", "; full text read via Europe PMC PMC10801886; Dryad metadata via DataCite"),
    C("Fu X et al.", 2018, "Spatial self-organization resolves conflicts between individuality and collective migration", "10.1038/s41467-018-04539-4", "phenotypic sorting rival", "Nat Commun", "; full text read via PMC5988668"),
    C("Bhattacharjee T et al.", 2022, "Chemotactic smoothing of collective migration", "10.7554/eLife.71226", "porous-gel front", "eLife", "; full text read via PMC8903832"),
    C("Fraebel DT et al.", 2017, "Environment determines evolutionary trajectory in a constrained phenotypic space", "10.7554/eLife.24669", "speed-growth trade-off", "eLife", "; full text read via PMC5441876"),
    C("Ni B et al.", 2020, "Growth-rate dependent resource investment in bacterial motile behavior quantitatively follows potential benefit of chemotaxis", "10.1073/pnas.1910849117", "growth-dependent motility", "PNAS", "; full text read via PMC6955288"),
    C("Croze OA et al.", 2011, "Migration of chemotactic bacteria in soft agar: role of gel concentration", "10.1016/j.bpj.2011.06.023", "agar dependence", "Biophys J", "; abstract via Europe PMC PMID 21806920"),
    C("Wolfe AJ, Berg HC", 1989, "Migration of bacteria in semisolid agar", "10.1073/pnas.86.18.6973", "obstacle-escape rival", "PNAS", "; abstract via Europe PMC PMID 2674941"),
    C("Saragosti J et al.", 2011, "Directional persistence of chemotactic bacteria in a traveling concentration wave", "10.1073/pnas.1101996108", "kinetic-model rival", "PNAS", "; abstract via Europe PMC PMID 21918111"),
    C("Bhattacharjee T, Datta SS", 2019, "Bacterial hopping and trapping in porous media", "10.1038/s41467-019-10115-1", "pore-scale diffusion", "Nat Commun", "; abstract via Europe PMC PMID 31061418"),
    C("Fisher RA", 1937, "The wave of advance of advantageous genes", "10.1111/j.1469-1809.1937.tb02153.x", "Fisher null", "Ann Eugenics"),
]

res = dict(
    label="t2-patterns-alt",
    topic="Track 2 alternatives and neighbours: other systems and datasets that could replace or sit beside the E. coli chemotactic range-expansion front, and the strongest competing explanation",
    summary=summary, lay_summary=lay, glossary=glossary, findings=findings,
    key_claims=key_claims, recommendations=recommendations, table=table,
    reproduce=reproduce, citations=citations, could_not_find=could_not_find,
    scripts_written=[S + n for n in ["crossref_search.py", "crossref_verify.py", "epmc_data_avail.py", "epmc_abstract.py",
                                      "xml_text.py", "datacite_check.py", "dump_xlsx_heads.py", "liu2019_numbers.py",
                                      "liu2019_agar.py", "liu2019_ess.py", "fisher_null.py", "lawset_scan.py", "build_result.py"]],
)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(res, open(OUT, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("written", OUT, os.path.getsize(OUT))
