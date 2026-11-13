"""Builds D:/Users/ashenoy00000/delphi-work/agents2/bm-ip-landscape-deep.json. Run: python -I build_result.py
All patent facts transcribed from pages fetched 2026-11-12 (see google_patents_browser.js, epo_fetch.sh); calculations in bound_check.py."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_part1 import TABLE, GP

def F(claim, source, conf, quote="", value=""):
    d = dict(claim=claim, source=source, confidence=conf)
    if quote: d["evidence_quote"] = quote
    if value: d["value"] = value
    return d

SCAN = "PRELIMINARY SCAN ONLY: not legal advice, not a freedom-to-operate opinion, not a patentability opinion. "
summary = (
 SCAN + "Run 2026-11-12. Google Patents refuses curl and WebFetch (HTTP 503) from this network, but pages and the search endpoint worked from a real Chrome tab, so every row in the table below was read from its Google Patents page (claim 1, assignee, dates, machine-derived status); EP 4019251 B1 was also read from the EPO publication server. "
 "Compared with the earlier agent (agents/spec-ip-landscape.json), which worked from the USPTO search only: (a) the three Harvard / MIT-Harvard applications it left as 'grant not determined' are all Abandoned; (b) the three building-scale wood-bilayer families whose claims it could not read are now read, and all three are narrow: ETH/Empa WO2018033422 claims a lever-coupled shading device and is Ceased; Stuttgart EP4019251 B1 (granted 2026-03-25, opposition window still open) and the Empa/ETH/Stuttgart German national phase DE112019001411 claim pre-conditioning layers at one humidity so the glued part self-shapes at a target climate; none covers a printed resin or powder element; (c) the granted MIT/Stratasys US 11155025 B2 claim 1 is narrower than the earlier summary implied (two joints in series, a planar member, members that touch to limit curvature) but it is the live patent nearest a resin-printed differential-swelling part and runs to about 2034-02-25. "
 "CROWDED: printed stimulus-responsive objects in general (MIT/Stratasys), hygromorphic coatings and composites (MIT, NTU, USAF), hydrogel 4D printing (Harvard, now abandoned, UT, CityU, Accenture), wood bilayer building parts (ETH, Empa, Stuttgart), and, as prior ART rather than live rights, the bilayer mechanics themselves: the ETH specification already cites Timoshenko 1925, states that an optimum thickness ratio exists (0.2-0.3 for wood) and reports measured curvature changes. "
 "OPEN, by keyword: zero Google Patents documents combine a theorem prover or proof assistant with material, geometry or additive-manufacturing design (queries listed in the table); the nearest are a 2010 Microsoft design-space exploration patent (expired, software architectures) and a 2020 PARC satisfiability-solver manufacturing planner (live, integrated circuits), plus a granted Toyota computational design method for shape-morphing structures (live), which shows that design-method claims in this field are grantable. "
 "WHAT THE TEAM COULD PLAUSIBLY CLAIM, if it files before public disclosure (counsel to confirm grace-period rules): (1) a design-and-verification METHOD in which candidate geometries or layups are released to a printer only with a machine-checked proof that they satisfy stated laws (most open, but must show a concrete technical effect); (2) a certified FILE FORMAT binding geometry, material assignment and a proof (open, but data-structure claims face eligibility objections); (3) a specific GEOMETRY found by the constrained search with a measured, unexpected response (narrow); (4) a COMPOSITION (least likely, since stock Formlabs resins are the vendor's formulations and hygromorphic compositions are heavily claimed). 'License your patent' presupposes a patent the team may not hold: no filing by the team was searched for by name or found. "
 "Limits: Google's status labels are machine-derived and not authoritative; no Espacenet, Patentscope, CNIPA, JPO or CPC-class search was possible; Formlabs's own patents were not searched; absence of keyword hits is not proof of absence.")

lay = ("This is a first look, not legal advice, at who already owns ideas close to ours. "
 "Plenty of people have patented things that bend or curl when they get wet or when the air gets damp, including MIT, Harvard, two Swiss universities and Stuttgart, so we cannot claim 'a plate that curls in humidity' as ours. "
 "Several of the best-known older filings have already lapsed or been dropped, which makes them public knowledge anyone may use rather than fences. "
 "What we did not find anywhere is a patent that uses a computer-checked proof to decide which shapes are allowed to be printed, a bit like a spell-checker that refuses to print a design unless the maths is signed off. "
 "If the team files on that method before showing it publicly, that is where something ownable might sit; the team does not yet hold such a patent, so there is nothing to license today. "
 "A patent lawyer must check all of this before anyone relies on it.")

glossary = [
 dict(term="Preliminary scan", plain="A quick keyword look at patent records, not the thorough professional search a lawyer would order."),
 dict(term="Freedom to operate", plain="A lawyer's formal opinion on whether making or selling something would infringe someone else's live patent; this report is not one."),
 dict(term="Patent family", plain="The set of filings in different countries that all stem from one first application."),
 dict(term="Claim 1", plain="The first and usually broadest sentence in a patent that says exactly what is protected."),
 dict(term="Priority date", plain="The earliest filing date, used to decide who was first."),
 dict(term="Prior art", plain="Anything made public before a filing date, including old patents and papers, which can block a later patent."),
 dict(term="Abandoned / Ceased / Expired", plain="Labels meaning the owner no longer holds an enforceable right; Google's labels are automatic and can be wrong."),
 dict(term="Hygromorphic", plain="Changing shape when the humidity changes."),
 dict(term="Bilayer", plain="Two glued layers that swell by different amounts, so the pair curls like a bimetal strip."),
 dict(term="4D printing", plain="3D printing something designed to change shape later, time being the fourth dimension."),
 dict(term="Theorem prover / proof assistant", plain="Software that checks a mathematical proof step by step so no gap can slip through."),
 dict(term="Provisional application", plain="A cheap early patent filing that fixes a date while the full application is prepared."),
 dict(term="Opposition window", plain="A fixed period after a European patent is granted in which anyone may ask the patent office to revoke it."),
 dict(term="SLA / SLS", plain="Two kinds of 3D printing: SLA hardens liquid resin with light, SLS fuses plastic powder with a laser."),
]

findings = [
 F("MIT/Stratasys US 11155025 B2 is granted and shown Active; claim 1 is an additive-manufacturing method with a second polymerizable formulation that swells less than the first, arranged as two joints in series, each with a planar member and members that touch to limit curvature, planar members not parallel.",
   GP % "US11155025B2", "high", "wherein post-polymerization and in response to an external stimulus, the second polymerizable formulation is lower swelling than the first polymerizable formulation",
   "priority 2013-12-05; filed 2020-06-18; granted 2021-10-26; anticipated expiration 2034-02-25"),
 F("The broad parent application US 2015/0158244 A1 (any additive-manufactured object that transforms predictably under a non-biasing stimulus) is Abandoned; only the narrower continuation is granted.",
   GP % "US20150158244A1", "high", "An object, comprising: an additive manufacturing material, the additive manufacturing material having a response to an external stimulus", "status Abandoned (Google); priority 2013-12-05"),
 F("MIT US 9931829 B2 (granted, Active) claims applying hygromorphic material to one side of an object in a spatially varying amount so the object changes from no sharply angled bend to a sharply angled bend.",
   GP % "US9931829B2", "high", "A method comprising applying hygromorphic material to a first side of an object, in such a manner that:", "priority 2014-10-29; granted 2018-04-03"),
 F("All three Harvard and MIT-Harvard 4D-printing applications are Abandoned per Google: US 2017/0151733, US 2018/0251649, US 2020/0130261. This corrects the earlier file, which left their grant status undetermined.",
   GP % "US20170151733A1 (also US20180251649A1, US20200130261A1)", "medium", "Status Abandoned legal-status Critical Current", "three applications, all Abandoned; Google status is machine-derived"),
 F("Nanyang Technological University US 12655582 B2 (granted 2026-06-16, Active) claims a hygromorphic composite of pollen-paper substrate with a patterned moisture-inactive toner or ink layer.",
   GP % "US12655582B2", "high", "A hygromorphic composite material, comprising: a moisture-active pollen paper substrate having a top and a bottom surface", "priority 2021-03-16"),
 F("Carnegie Mellon US 12225924 B2 (granted 2025-02-18, Active, expiry about 2040-06-22) claims self-folding by grooving a single homogeneous layer and exposing it to water: a geometry-only route to water-driven shape change.",
   GP % "US12225924B2", "high", "A method for creating self-folding material consisting of: grooving at least one groove onto a single layer homogeneous material", "priority 2019-06-21"),
 F("City University of Hong Kong US 2025/0213312 A1 (Pending) claims a 4D-printed bilayer of hydrogel film and printed magnetic elastomer filaments responsive to humidity and magnetic fields.",
   GP % "US20250213312A1", "high", "A 4D-printed humidity and magnetic dual responsive actuator with a bilayer structure, comprising a hydrogel film and a numerous of magnetic elastomer filaments", "filed 2023-12-28"),
 F("ETH Zurich/Empa WO 2018/033422 A1 claim 1 covers a shading device with a pivot-mounted shading element and a base-fixed actuator element that reversibly bends and turns it; Google shows the family as Ceased with only EP (2016) and WO (2017) listed. It is a lever-coupled mechanism, not any bilayer.",
   GP % "WO2018033422A1", "high", "A shading device comprising a pivot mounted shading element and an actuator element, comprising a first and a second end, for turning said shading element in a rotary movement", "priority 2016-08-18; filed 2017-08-07; status Ceased"),
 F("The ETH/Empa specification states Timoshenko's 1925 result as prior knowledge: for each stiffness ratio an optimum thickness ratio exists, and for wood it is 0.2-0.3. The thickness-ratio optimum of a hygro-bilayer is therefore published, patent-document prior art (it is an optimum, not the 3/2 ceiling).",
   GP % "WO2018033422A1", "high", "For each stiffness ratio, there exists an optimum thickness ratio to achieve the same maximum bending (Timoshenko, Analysis of Bimetal thermostat, 1925).", "wood optimum thickness ratio 0.2-0.3"),
 F("The same specification reports measured curvature changes for beech 4 mm + spruce 0.8 mm bilayers going from 85% to 35% RH in 24 h: 0.00818 mm^-1 (plain beech), 0.00971 (horizontal strips), 0.01011 (diagonal strips).",
   GP % "WO2018033422A1", "high", "The homogenous (the sample were the beech was not milled) had a MC loss of 31 % and a change of curvature of 0.00818 mm\"1.", "0.00818 / 0.00971 / 0.01011 mm^-1 per 24 h"),
 F("Own calculation using the project-record ceiling kappa*h/d_eps <= 3/2: the plain beech/spruce bilayer (h=4.8 mm, dkappa=0.00818 mm^-1) needs a differential free strain of at least 0.00818*4.8/1.5 = 0.0262 (2.6%); strips give 3.1% and 3.2%. This is consistent with the patent's stated layer difference of at least 3%, and f(m=0.2,n=25)=1.5 shows the patent's 0.2-0.3 thickness ratio sits at the ceiling when the modulus ratio is about 25 (m^2 n = 1); that modulus ratio is not stated in the patent and I did not verify it.",
   "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/bound_check.py (output bound_check_out.json)", "medium", "", "min d_eps = 0.0262, 0.0311, 0.0324"),
 F("University of Stuttgart EP 4019251 B1 is granted (mention of grant 2026-03-25), Active, with only an EP family listed; claim 1 is a method that obtains target climate data (RH2, T2), selects layer type/orientation/thickness, pre-conditions at a different RH1/T1, bonds, and relies on the part changing to a final shape in the target climate. Opposition may be filed within nine months of the grant mention, i.e. to about 2026-12-25 (my arithmetic).",
   "https://data.epo.org/publication-server/rest/v1.2/patents/EP4019251NWB1/document.html (saved D:/Users/ashenoy00000/delphi-work/data/ip-deep/EP4019251B1_epo_publication_server.html, 115885 bytes, sha256 db7ec298683948439ee1de708e089e1c643cd8750bf180348f85218f665a353a)",
   "high", "Manufacturing method of a multi-layer component (1) of layered elements (0, 0'), comprising: - obtaining (I) target climatic condition information of a climatic condition at a target location at a customer's site", "inventors Wood, Menges, Kiesewetter, Rueggeberg, Groenquist, Burgert"),
 F("The EP 4019251 B1 specification cites the Groenquist et al. 2019 Science Advances paper and a Dezeen article on self-shaping wood as references, so the same group's open publications are prior art against broad claims of this kind.",
   "https://data.epo.org/publication-server/rest/v1.2/patents/EP4019251NWB1/document.html", "high", "PHILIPPE ET AL: \"Analysis of hygroscopic self-shaping wood at large scale for curved mass timber structures\", SCIENCE ADVANCES"),
 F("The German national phase DE 11 2019 001 411 T5 (priority 2018-03-21, Stuttgart/ETH/Empa) is Pending in Google; its family lists EP, CH, AT, DE, WO and no US member. Claim 1 begins with laminating and bonding wood-based elements at an initial climate.",
   GP % "DE112019001411T5", "medium", "Herstellungsverfahren für geformte, gestapelte, mehrschichtige, holzbasierte Baukomponenten (4) von holzbasierten Elementen (0, 0'), dadurch gekennzeichnet, dass:", "family countries as shown in Google's 'Worldwide applications'"),
 F("Toyota US 12361183 B2 (granted 2025-07-15, Active) claims a computational design-and-manufacture method for shape-morphing structures (FE mesh, topology optimisation, diffusion coefficients, Turing pattern): a granted design-method claim exists in this field, but it is for inflatable structures.",
   GP % "US12361183B2", "high", "A method of designing and manufacturing an inflatable structure, the method comprising: generating a finite element mesh defining a plurality of elements for an inflatable shape-morphing structure", "filed 2021-10-04"),
 F("Microsoft US 8473895 B2 (design-space exploration using a theorem-prover-style solver) is Expired - Fee Related; it covered software architectures and, being expired, is prior art rather than a barrier.",
   GP % "US8473895B2", "high", "A computer-implemented method for exploring a design space, the method comprising: receiving a design specification expressed in a modeling language", "filed 2010-06-08; granted 2013-06-25"),
 F("A live solver-in-the-loop manufacturing-planning patent exists for integrated circuits (Xerox/PARC US 11157672 B1, expiry about 2040-09-17); it uses a satisfiability-modulo-difference-logic solver to plan hybrid additive/subtractive builds from constraints, which is the nearest manufacturing claim to 'constraints checked by a solver before building'.",
   GP % "US11157672B1", "high", "A method for determining a hybrid-manufacturing plan for an integrated circuit (IC), the method comprising", "granted 2021-10-26"),
 F("Keyword searches on Google Patents found no document combining a theorem prover or proof assistant with material, geometry or additive-manufacturing design: 'theorem prover' AND 'additive manufacturing' returned 1 result (an unrelated robotics network); 'proof assistant' material design returned 22 with the top 10 unrelated; 'formal verification' AND 'additive manufacturing' geometry returned 3, unrelated. Negative keyword result only.",
   "https://patents.google.com/ xhr/query (google_patents_browser.js, gq())", "medium", "### tp_am total=1 q=\"theorem prover\" \"additive manufacturing\"", "counts 1 / 22 / 3 on 2026-11-12"),
 F("Literature check: arXiv API totalResults is 0 for 'theorem prover' AND 'material design', 'proof assistant' AND 'additive manufacturing', 'Lean 4' AND 'metamaterial', and 'proof assistant' AND '4D printing'; Crossref queries returned only software/hardware verification and generic additive-manufacturing standards. The closest published work is Lean formalisation of chemical physics (Bobbin 2024), not a design gate.",
   "D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-ip-landscape-deep/refs2.json (sha256 d391e94caeb9a5216242b7656c6ce662dfa5ca62b2765d951f47a0a30f92ceb4)", "medium", "", "arXiv totalResults = 0 for four queries, 2026-11-12"),
 F("Hygromorphic building-element research is very active and public: a 2025 paper on rice-husk 4D-printed hygromorphic building skin and a 2026 chapter on a simulation framework for porosity-driven hygromorphic bilayers both resolve in Crossref, as does the 2024 Nature Communications weather-responsive 4D-printed shading paper. These are prior art against broad claims on printed hygromorphic facade elements.",
   "https://api.crossref.org/works/10.1080/17452759.2025.2591322 ; https://api.crossref.org/works/10.1007/978-981-92-0615-5_25", "high", "", "titles verified, refs2.json"),
 F("Google Patents returned zero documents for hygroscopic 'shape-changing' facade panel 3D printed, and only five for 'hygromorphic' AND '3D printing' (MIT US9931829, CMU US20220322599, Accenture EP3988317, Purdue US20260001811, IIT EP4783825): printed hygromorphic building elements are thinly patented by keyword, with the heavy prior art in papers.",
   "https://patents.google.com/ xhr/query (gq())", "medium", "US9931829B2 | 2014-10-29 | 2018-04-03 | Massachusetts Institute Of Technology | Methods and apparatus for hygromorphic shape control", "5 results; 0 results"),
 F("Contradiction with the earlier file: spec-ip-landscape.json listed 'Toyota/Georgia Tech US 12768208 B2'; the Google Patents page for US12768208B2 returned HTTP 404, so I could not confirm that number exists. I did not rely on it.",
   "D:/Users/ashenoy00000/delphi-work/agents/spec-ip-landscape.json (could_not_find) vs patents.google.com/patent/US12768208B2/en HTTP 404", "medium", "", "HTTP 404"),
 F("Not re-fetched, from the earlier materials file: spec-formlabs-materials.json reports Flexible 80A Resin V2 gaining 8% mass and 3% volume in one day in deionized water, against the task framing that stock Formlabs resins gain under 1%. I only note the disagreement; it is outside this IP scan.",
   "D:/Users/ashenoy00000/delphi-work/agents/spec-formlabs-materials.json (summary)", "low", "", "8% mass, 3% volume, 24 h immersion (earlier agent's figure)"),
]

key_claims = [
 dict(claim="The three building-scale wood-bilayer families are narrow and are not obstacles to a printed resin or powder element: ETH/Empa WO2018033422 (Ceased) claims a lever-coupled shading device; Stuttgart EP4019251 B1 (live, opposition window open) and DE112019001411 claim pre-conditioning layers at one climate so a bonded part self-shapes at a target climate.",
      source=GP % "WO2018033422A1 ; " + GP % "EP4019251B1 ; EPO publication server EP4019251NWB1",
      evidence_quote="Manufacturing method of a multi-layer component (1) of layered elements (0, 0'), comprising: - obtaining (I) target climatic condition information of a climatic condition at a target location at a customer's site"),
 dict(claim="The live patent nearest a resin-printed differential-swelling part is MIT/Stratasys US 11155025 B2 (Active, to about 2034-02-25), but its claim 1 is narrow (two joints in series with planar and curvature-limiting members); the broad parent application is Abandoned.",
      source=GP % "US11155025B2",
      evidence_quote="wherein post-polymerization and in response to an external stimulus, the second polymerizable formulation is lower swelling than the first polymerizable formulation"),
 dict(claim="Zero Google Patents documents and zero arXiv records combine a theorem prover / proof assistant with material, geometry or additive-manufacturing design; the nearest are an expired Microsoft design-space-exploration patent, a live PARC solver-based manufacturing planner for ICs, and a live Toyota computational design method for inflatable shape-morphing structures. A design-and-verification method is therefore the most plausible ownable subject matter, subject to counsel.",
      source="https://patents.google.com/ xhr/query counts 2026-11-12; refs2.json; " + GP % "US8473895B2",
      evidence_quote="A computer-implemented method for exploring a design space, the method comprising: receiving a design specification expressed in a modeling language"),
 dict(claim="The optimum-thickness-ratio behaviour of a hygro-bilayer and measured wood curvature changes are already in a patent document that cites Timoshenko 1925, so the bilayer principle itself cannot be claimed; only a specific verified design or method could be.",
      source=GP % "WO2018033422A1",
      evidence_quote="For each stiffness ratio, there exists an optimum thickness ratio to achieve the same maximum bending (Timoshenko, Analysis of Bimetal thermostat, 1925)."),
]

reproduce = [
 dict(what="Install nothing; use Chrome with any claude.ai/Chrome automation or plain DevTools. Open a Google Patents page, then paste google_patents_browser.js", command_or_url="D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/google_patents_browser.js (open https://patents.google.com/patent/US11155025B2/en first)",
      expected="Plain curl/WebFetch to patents.google.com returns HTTP 503 (as on 2026-11-12); fetch() inside a Chrome tab returns 200."),
 dict(what="Read each patent's fields: in the console run `await window.gp('US11155025B2'); window.R['US11155025B2']`", command_or_url="repeat for the numbers listed at the bottom of google_patents_browser.js",
      expected="status Active, granted 2021-10-26, claim 1 starts 'A method for additive manufacturing of an object'; US20170151733A1 status Abandoned; WO2018033422A1 status Ceased. Statuses are Google's and can change."),
 dict(what="Re-run the white-space queries: `await window.gq('tp_am','\"theorem prover\" \"additive manufacturing\"'); window.Q.tp_am`", command_or_url="queries: \"hygromorphic\" \"3D printing\"; \"self-shaping\" wood bilayer moisture; \"theorem prover\" \"additive manufacturing\"; \"proof assistant\" material design; \"formal verification\" \"additive manufacturing\" geometry; \"theorem prover\" \"finite element\"; \"SMT solver\" \"additive manufacturing\" design",
      expected="totals 5, 4, 1, 22, 3, 2, 4 on 2026-11-12; totals drift as Google adds documents."),
 dict(what="Fetch the EP 4019251 B1 specification from the EPO", command_or_url="sh D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/epo_fetch.sh (curl 8.x, Python 3.14)",
      expected="115885 bytes, sha256 db7ec298683948439ee1de708e089e1c643cd8750bf180348f85218f665a353a; claim 1 begins 'Manufacturing method of a multi-layer component (1) of layered elements'."),
 dict(what="Verify citations and literature-gap queries", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/verify_refs.py then verify_refs2.py",
      expected="Crossref titles match the citation list; arXiv totalResults 0 for the four formal-methods queries (Crossref may answer HTTP 429; verify_refs2.py retries)."),
 dict(what="Recompute the curvature-implied strain bound", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/bound_check.py",
      expected="min_d_eps 0.026176, 0.031072, 0.032352; f(0.2, 25) = 1.5."),
 dict(what="Rebuild this result file", command_or_url="python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/build_result.py",
      expected="writes D:/Users/ashenoy00000/delphi-work/agents2/bm-ip-landscape-deep.json"),
]

def C(authors, year, title, doi, used, how="Crossref https://api.crossref.org/works/%s fetched in this run (refs.json / refs2.json); title and year matched"):
    return dict(authors=authors, year=year, title=title, doi_or_arxiv=doi, verified=True, how_verified=how % doi, used_for=used)
citations = [
 C("Timoshenko S.", 1925, "Analysis of Bi-Metal Thermostats", "10.1364/josa.11.000233", "Bilayer mechanics public since 1925; cited inside the ETH patent text"),
 C("Reyssat E., Mahadevan L.", 2009, "Hygromorphs: from pine cones to biomimetic bilayers", "10.1098/rsif.2009.0184", "Plant-inspired humidity bilayer prior art"),
 C("Tibbits S.", 2014, "4D Printing: Multi-Material Shape Change", "10.1002/ad.1710", "Academic counterpart of the MIT/Stratasys family"),
 C("Gladman A.S., Matsumoto E.A., Nuzzo R.G., Mahadevan L., Lewis J.A.", 2016, "Biomimetic 4D printing", "10.1038/nmat4544", "Counterpart of the abandoned Harvard hydrogel applications"),
 C("Vailati C., Bachtiar E., Hass P., Burgert I., Rueggeberg M.", 2018, "An autonomous shading system based on coupled wood bilayer elements", "10.1016/j.enbuild.2017.10.042", "Academic counterpart of WO2018033422"),
 C("Groenquist P., Wood D., Hassani M.M., Wittel F.K., Menges A., Rueggeberg M.", 2019, "Analysis of hygroscopic self-shaping wood at large scale for curved mass timber structures", "10.1126/sciadv.aax1311", "Cited in EP4019251 B1; prior art for building-scale self-shaping wood"),
 C("Cheng T., Tahouni Y., Sahin E.S., et al.", 2024, "Weather-responsive adaptive shading through biobased and bioinspired hygromorphic 4D-printing", "10.1038/s41467-024-54808-8", "Closest academic prior art to a printed hygromorphic architectural element"),
 C("van Rees W.M., Vouga E., Mahadevan L.", 2017, "Growth patterns for shape-shifting elastic bilayers", "10.1073/pnas.1709025114", "Computational inverse design of bilayers is published"),
 C("Boley J.W., van Rees W.M., Lissandrello C., et al.", 2019, "Shape-shifting structured lattices via multimaterial 4D printing", "10.1073/pnas.1908806116", "Counterpart of the abandoned MIT/Harvard lattice application"),
 C("Correa D., Papadopoulou A., Guberan C., et al.", 2015, "3D-Printed Wood: Programming Hygroscopic Material Transformations", "10.1089/3dp.2015.0022", "Printed hygroscopic bilayer prior art"),
 C("Yao L., Ou J., Cheng C.-Y., et al.", 2015, "bioLogic", "10.1145/2702123.2702611", "Academic counterpart of MIT US 9931829"),
 C("Reichert S., Menges A., Correa D.", 2015, "Meteorosensitive architecture: Biomimetic building skins based on materially embedded and hygroscopically enabled responsiveness", "10.1016/j.cad.2014.02.010", "Hygroscopic building-skin prior art"),
 C("Bobbin M.P., Sharlin S., Feyzishendi P., Dang A.H., Wraback C.M., Josephson T.R.", 2024, "Formalizing chemical physics using the Lean theorem prover", "10.1039/d3dd00077j", "Nearest published Lean-in-physical-science work; not a design gate"),
 C("Hang, Yi, et al.", 2025, "Rice husk 4D printing in architecture: hygromorphic bi-directional self-shaping building skin", "10.1080/17452759.2025.2591322", "Recent printed hygromorphic building-skin prior art (venue Virtual and Physical Prototyping)"),
 C("Liu, Lu, Colletti, Grigoriadis, et al.", 2026, "Controllable Deformation: A 4D-Printing Simulation Framework for Porosity-Driven Hygromorphic Bilayer Structure", "10.1007/978-981-92-0615-5_25", "Computational design of hygromorphic bilayers is published"),
]

could_not_find = [
 "Any patent or application held by the team or collaborators; none was searched for by name. 'License your patent' is unconfirmed.",
 "Espacenet (HTTP 403), WIPO Patentscope (captcha page) and Lens (HTTP 403) refused automated access; no CPC-class, citation-chain, INPADOC or legal-event search, and no CNIPA, JPO or KIPO full-text search. Chinese 4D-printing filings appeared in result rows and were not analysed.",
 "Google's status labels (Active, Abandoned, Ceased, Pending, Expired) are machine-derived; no register (USPTO Patent Center, EPO Register, DPMA) was checked, and no maintenance-fee or assignment record. WO2018033422's 'Ceased' status and 2019-02-18 'expiration' look like a PCT national-phase lapse, which I infer but did not confirm.",
 "Claims beyond claim 1 were not analysed for any family, and DE112019001411's claims are read only from Google's machine translation header and first lines.",
 "Formlabs's own patents (resins, powders, printers) were not searched; whether any Formlabs right touches a hygromorphic part was not assessed.",
 "US 12768208 B2 (cited by the earlier agent as Toyota/Georgia Tech): Google Patents page returned HTTP 404; existence unconfirmed.",
 "Counterpart status of the ETH/Empa and Stuttgart families outside Europe: Google lists no US member for them, but I did not check national registers (the earlier agent's USPTO keyword search also found none).",
 "A measured hygroscopic expansion coefficient or water diffusivity for any Formlabs resin or powder (the earlier gap stays open; this scan is about patents, not materials data).",
 "Chrome fetches were done through a browser tab; the raw Google Patents HTML was not stored (only the extracted fields, transcribed into build_part1.py / this file). Re-running google_patents_browser.js reproduces them; pages may change. The only stored raw file is the EPO specification.",
 "Whether the one-year US grace period or any other jurisdiction's grace period applies to the live DELPHI dashboard and repo: this is for counsel; I give no view beyond saying public disclosure can be prior art.",
]

recommendations = [
 "Ask a patent attorney about a provisional filing BEFORE the paper, repo or live dashboard publicly discloses the law-constrained design pipeline; public disclosure can be prior art against later filings in most jurisdictions (grace-period rules differ; counsel to confirm).",
 "Frame any claim as a design-and-verification method with a concrete technical effect (for example a slicer or printer that refuses to build without a valid machine-checked certificate, or a measured property guaranteed by the certified bound), not as a humidity bilayer. A certified file format needs a technical-effect hook to survive eligibility objections.",
 "Do not describe the proof of concept as a 'new material composition' if it uses stock Formlabs resins or powders; a specific verified geometry with a measured, unexpected response is the more defensible physical claim.",
 "Before pitching a printed hygromorphic facade element to Mamou-Mani, order a professional search of CPC classes B33Y, B29C64, E04F10, E06B9, G06F30 and G06N5 with Espacenet and CNIPA, and watch EP 4019251 B1 (opposition window to about 2026-12-25) and MIT/Stratasys US 11155025 B2 (to about 2034-02-25).",
 "Keep a dated record of which Lean laws gated which design and what the print measured; it documents conception and technical effect whichever route is chosen.",
 "Describe the 3/2 ceiling and the modulus-ratio independence as the team's contribution only after checking that no paper states them; this scan found the thickness-ratio optimum (0.2-0.3 for wood) in ETH's patent text but not the 3/2 constant, which is a negative result from reading one specification, not a literature search.",
]

result = dict(
 label="bm-ip-landscape-deep",
 topic="Patents and prior art, verified against the patent pages (preliminary scan, not legal advice, not a freedom-to-operate opinion)",
 summary=summary, lay_summary=lay, glossary=glossary, findings=findings, key_claims=key_claims,
 table=TABLE, recommendations=recommendations, reproduce=reproduce, citations=citations, could_not_find=could_not_find,
 scripts_written=[
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/google_patents_browser.js",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/epo_fetch.sh",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/txt.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/verify_refs.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/verify_refs2.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/bound_check.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/build_part1.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-ip-landscape-deep/build_result.py"])
out = "D:/Users/ashenoy00000/delphi-work/agents2/bm-ip-landscape-deep.json"
json.dump(result, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("wrote", out, os.path.getsize(out), "bytes;", len(TABLE), "table rows;", len(findings), "findings")
