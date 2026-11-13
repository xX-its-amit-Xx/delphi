"""Verbatim-quote registry + checker.
Each entry: key -> (saved file, URL, quote). Running this script checks that every quote occurs in the tag-stripped,
whitespace-normalised text of the saved page (en/em dashes normalised both sides) and prints OK / MISSING.
Usage: python -I quotes.py          (prints a line per quote and the number missing)
Import: from quotes import Q, text_of   (used by build_result.py)"""
import re, html, os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DM = "D:/Users/ashenoy00000/delphi-work/data/mamou-mani/"
DC = "D:/Users/ashenoy00000/delphi-work/data/bm-clients-market/"
def mm(f): return DM + f
def cm(f): return DC + f
Q = {}
def q(k, path, url, quote): Q[k] = (path, url, quote)

# --- Mamou-Mani / Fab.Pub (pages saved by the earlier bm-mamou-mani-portfolio run) ---
q("tate_hyundai", mm("tate.txt"), "https://mamou-mani.com/project/tate-modern-turbine-hall-2026/", "Hyundai Commission: Tarek Atoui is in partnership with Hyundai Motor")
q("tate_webbyates", mm("tate.txt"), "https://mamou-mani.com/project/tate-modern-turbine-hall-2026/", "suspension and load tests carried out with Webb Yates Engineers verified the fixings before installation")
q("neko_client", mm("fp_monolith.txt"), "https://fabpub.com/pages/the-monolith-wall-at-neko-health", "Client Neko Health Collaborators Acrylicize")
q("cos_client", mm("conifera.txt"), "https://mamou-mani.com/project/conifera/", "Client COS FabPub Ltd")
q("hermes_client", mm("hermes.txt"), "https://mamou-mani.com/project/hermes-sanlitun-flagship-facade/", "Client: Hermès Architects for the building and interior: RDAI Architects for the facade: RDAI in collaboration with Mamou-Mani Architects")
q("bh_client", mm("woodenwaves.txt"), "https://mamou-mani.com/project/wooden-waves-burohappold/", "Client - Burohappold")
q("fp_intake", mm("fp_materialinnov.txt"), "https://fabpub.com/pages/material-innovation", "Send us the material source, approximate volume and the product or application you have in mind.")
q("fp_collab", mm("fp_materialinnov.txt"), "https://fabpub.com/pages/material-innovation", "Through collaboration with researchers and industry, we test how new formulations behave in real manufacturing conditions")
q("fp_minbudget", mm("fabpub_home.txt"), "https://fabpub.com/", "Total Budget (Minimum Budget: £250)")
q("fp_leadtime", mm("fabpub_home.txt"), "https://fabpub.com/", "All requests will need a minimum of 2 weeks due to high demands in our schedules.")
q("fp_franchise", mm("fp_franchise.txt"), "https://fabpub.com/pages/franchise-jvs", "The Fab.Pub franchise model involves an initial investment in Mobile Factories")
q("mm_consult", mm("about.txt"), "https://mamou-mani.com/about-us/", "Parametric Consultancy Our team uses parametric software to create complex geometries that adapt to environmental constraints.")

# --- pages fetched in this run ---
q("therme_jv", cm("www_thermegroup_com_blog_article_in_conversation_with_arthur_mamou_mani_architect.html"), "https://www.thermegroup.com/blog/article/in-conversation-with-arthur-mamou-mani-architect", "FabPub (Fabrication Public) is a joint venture between Therme Group and Mamou-Mani Architects.")
q("foster_passive", cm("www_aecbytes_com_feature_2020_Tech_FosterPartners_html.html"), "https://www.aecbytes.com/feature/2020/Tech-FosterPartners.html", "In collaboration with Autodesk in 2017, we used Machine Learning to predict how a passively actuated façade would react to temperature change.")
q("foster_univ", cm("www_aecbytes_com_feature_2020_Tech_FosterPartners_html.html"), "https://www.aecbytes.com/feature/2020/Tech-FosterPartners.html", "We conduct state-of-the-art research and development in collaboration with universities and industry partners")
q("zha_code", cm("www_zha_com_about_us_our_story.html"), "https://www.zha.com/about-us/our-story", "We established our first formal research group, ZHA\u2019s Computation and Design Group (ZHA CODE), pioneering new technologies for design and construction.")
q("zha_code2", cm("www_zha_com_people_shajay_bhooshan.html"), "https://www.zha.com/people/shajay-bhooshan", "a practice-embedded group that bridges research with practical architectural applications")
q("sal_sponsored", cm("selfassemblylab_mit_edu_partners_sponsors.html"), "https://selfassemblylab.mit.edu/partners-sponsors", "The lab is generously supported annually by grants, gifts and sponsored research.")
q("sal_4d", cm("selfassemblylab_mit_edu_4d_printing.html"), "https://selfassemblylab.mit.edu/4d-printing", "4D Printing, developed as a collaboration between the Self-Assembly Lab, Stratasys and Autodesk")
q("schueco_fit", cm("www_schueco_com_com_growth_factory.html"), "https://www.schueco.com/com/growth-factory", "Your Start-up complements our core business around intelligent building envelopes")
q("schueco_nonfin", cm("www_schueco_com_com_growth_factory.html"), "https://www.schueco.com/com/growth-factory", "for Start-ups, it\u2019s not always just about securing big budgets. Sometimes it\u2019s about gaining access to non-financial resources.")
q("schueco_turnover", cm("www_schueco_com_bh_company_press_annual_report_2025.html"), "https://www.schueco.com/bh/company/press/annual-report-2025", "In 2025, Sch\u00fcco achieved a turnover of \u20ac2.06 billion with 6750 employees.")
q("ise_partners", cm("www_ise_fraunhofer_de_en_research_projects_synergy_facade_html.html"), "https://www.ise.fraunhofer.de/en/research-projects/synergy-facade.html", "Project Partners: Priedemann Facade-Lab, Transsolar Energietechnik, Warema (external partner), Sch\u00fcco (external partner)")
q("ise_commissioned", cm("www_ise_fraunhofer_de_en_research_projects_synergy_facade_html.html"), "https://www.ise.fraunhofer.de/en/research-projects/synergy-facade.html", "characterization is also commissioned by manufacturers of facade technology")
q("ise_sponsor", cm("www_ise_fraunhofer_de_en_research_projects_synergy_facade_html.html"), "https://www.ise.fraunhofer.de/en/research-projects/synergy-facade.html", "Contracting Authority/ Sponsors: Federal Ministry for Economic Affairs and Climate Action")
q("warema_rev", cm("newsroom_warema_com_en_press_releases_warema_group_presse_financial_year_2024_html.html"), "https://newsroom.warema.com/en/press-releases/warema-group/presse/financial-year-2024.html", "the company achieved a total revenue of around 687 million euros (2023: 753 million euros)")
q("icd_wtt", cm("www_icd_uni_stuttgart_de_research_research_projects_wtt_zerofassade_.html"), "https://www.icd.uni-stuttgart.de/research/research-projects/wtt-zerofassade/", "Zero-energy self-shading 2021-2022")
q("icd_fund", cm("www_icd_uni_stuttgart_de_research_research_projects_wtt_zerofassade_.html"), "https://www.icd.uni-stuttgart.de/research/research-projects/wtt-zerofassade/", "Universit\u00e4tsinterne F\u00f6rderung von Projekten zum Wissens- und Technologietransfer")
q("fl_omm", cm("formlabs_com_store_materials_open_material_mode_.html"), "https://formlabs.com/store/materials/open-material-mode/", "Optional, one-time purchase per printer for lifetime access. Open Material Mode is free with a printer purchase for accredited educational institutions.")
q("fl_omm_price", cm("formlabs_com_store_materials_open_material_mode_.html"), "https://formlabs.com/store/materials/open-material-mode/", "From $875 excl. sales tax")
q("fl_inkind", cm("formlabs_com_research_3d_printing_grant_.html"), "https://formlabs.com/research-3d-printing-grant/", "Formlabs invites student groups and competition teams to request in-kind donations of resins, powder, and other consumables")
q("fl_300", cm("formlabs_com_research_3d_printing_grant_.html"), "https://formlabs.com/research-3d-printing-grant/", "Formlabs printers are relied upon by over 300 top universities")
q("fl_cert", cm("formlabs_com_global_blog_formlabs_open_platform_flexibility_customization_sla_sls.html"), "https://formlabs.com/global/blog/formlabs-open-platform-flexibility-customization-sla-sls", "Formlabs Certified Materials: Enables a curated selection of certified best-in-class third-party materials with pre-tuned print settings")
q("fl_team40", cm("formlabs_com_blog_formlabs_3d_printing_material_development_.html"), "https://formlabs.com/blog/formlabs-3d-printing-material-development/", "Formlabs has built a team of 40+ materials scientists and engineers")
q("fl_team60", cm("formlabs_com_blog_formlabs_3d_printing_material_development_.html"), "https://formlabs.com/blog/formlabs-3d-printing-material-development/", "A Team of 60+ Chemical Engineers and Developers")
q("fl_bego", cm("formlabs_com_materials_certified_materials_.html"), "https://formlabs.com/materials/certified-materials/", "VarseoSmile\u00ae TriniQ\u00ae Resin Dental From $599")
q("sbir_ceiling", cm("www_sbir_gov_about.html"), "https://www.sbir.gov/about", "As of October 16, 2026, agencies may issue a Phase I award (including modifications) up to $335,937 and a Phase II award (including modifications) up to $2,239,578 without seeking SBA approval.")
q("sbir_apply_p1", cm("www_sbir_gov_apply.html"), "https://www.sbir.gov/apply", "Award Amounts: $50,000-$323,000")
q("sbir_apply_p2", cm("www_sbir_gov_apply.html"), "https://www.sbir.gov/apply", "Award Amounts: $650,000-$2.2 million")
q("sbir_elig", cm("www_sbir_gov_apply.html"), "https://www.sbir.gov/apply", "Is a for-profit entity located in the U.S. Has fewer than 500 employees (most applicants have fewer than 10). Is owned and controlled by U.S. citizens or permanent residents.")
q("sttr_partner", cm("www_sbir_gov_apply.html"), "https://www.sbir.gov/apply", "The primary difference from SBIR is that for STTR, the small business must formally partner with a research institution.")
q("sbir_ta", cm("www_sbir_gov_about_policies.html"), "https://www.sbir.gov/about/policies", "up to $6,500 per year for Phase I awards and up to $50,000 per award for Phase II awards")
q("nsf_am5", cm("seedfund_nsf_gov_topics_advanced_materials.html"), "https://seedfund.nsf.gov/topics/advanced-materials", "5. Structural and Infrastructural Materials")
q("nsf_biomason", cm("seedfund_nsf_gov_topics_advanced_materials.html"), "https://seedfund.nsf.gov/topics/advanced-materials", "a small business funded by the National Science Foundation")
q("ukri_smart", cm("www_ukri_org_councils_innovate_uk_guidance_for_applicants_guidance_for_specific_funds_smart_innovation_funding_guidance.html"), "https://www.ukri.org/councils/innovate-uk/guidance-for-applicants/guidance-for-specific-funds/smart-innovation-funding-guidance", "Smart grants are now closed for new applications as funding is being aligned to Innovate UK\u2019s new strategic direction")
q("velocity", cm("grantsights_com_blog_innovate_uk_grants.html"), "https://grantsights.com/blog/innovate-uk-grants", "Velocity will launch in autumn 2027 and that all Innovate UK support will be offered through it from then on")
q("ktp_ukri", cm("www_ukri_org_opportunity_knowledge_transfer_partnership_ktp_2026_to_2027_round_one_.html"), "https://www.ukri.org/opportunity/knowledge-transfer-partnership-ktp-2026-to-2027-round-one/", "can apply for a share of up to \u00a310 million to fund innovation projects with businesses")
q("ktp_closed", cm("www_ukri_org_opportunity_knowledge_transfer_partnership_ktp_2026_to_2027_round_one_.html"), "https://www.ukri.org/opportunity/knowledge-transfer-partnership-ktp-2026-to-2027-round-one/", "Opportunity status: Closed")
q("ktp_costs", cm("apply_for_innovation_funding_service_gov_uk_competition_2380_overview_3e170dd3_4458_4c7e_a096_e0ea50b88040.html"), "https://apply-for-innovation-funding.service.gov.uk/competition/2380/overview/3e170dd3-4458-4c7e-a096-e0ea50b88040", "Projects must be between 12 and 36 months. A project\u2019s total eligible costs are typically \u00a38,500 per month. A proportion of the eligible costs will be funded by Innovate UK, the remainder are paid by the business partner.")
q("lambert_old", cm("www_gov_uk_guidance_university_and_business_collaboration_agreements_lambert_toolkit.html"), "https://www.gov.uk/guidance/university-and-business-collaboration-agreements-lambert-toolkit", "This guidance was last updated in 2018")
q("lambert_what", cm("www_gov_uk_guidance_university_and_business_collaboration_agreements_lambert_toolkit.html"), "https://www.gov.uk/guidance/university-and-business-collaboration-agreements-lambert-toolkit", "The Lambert toolkit is for universities and companies that wish to undertake collaborative research projects with each other.")
q("lambert_5", cm("www_gov_uk_guidance_university_and_business_collaboration_agreements_lambert_toolkit.html"), "https://www.gov.uk/guidance/university-and-business-collaboration-agreements-lambert-toolkit", "Agreement 5 Contract research: no publication by Institution without Collaborator’s permission")
q("royce", cm("cleanroom_leeds_ac_uk_news_royce_industrial_collaboration_programme_funding_.html"), "https://cleanroom.leeds.ac.uk/news/royce-industrial-collaboration-programme-funding/", "The University of Leeds has secured over \u00a3300,000 funding from round six of the Henry Royce Institute\u2019s Industrial Collaboration Programme (ICP), designed to support industry-led, academic engaged projects that address national advanced materials challenges.")
q("cam_arup", cm("www_cam_ac_uk_stories_arup.html"), "https://www.cam.ac.uk/stories/arup", "Arup and Cambridge have been working together for more than 60 years")
q("man_arup", cm("www_manchester_ac_uk_discover_news_the_university_of_manchester_announces_partnership_with_arup_a_global_sustainable_dev.html"), "https://www.manchester.ac.uk/discover/news/the-university-of-manchester-announces-partnership-with-arup-a-global-sustainable-development-consultancy/", "collaborative research initiatives will delve into advancements in materials, social design methodologies, data science")
q("aia", cm("bdcnetwork_com_aia_grants_100000_four_upjohn_research_initiative_projects.html"), "https://bdcnetwork.com/aia-grants-100000-four-upjohn-research-initiative-projects", "The jury for the American Institute of Architects (AIA) Upjohn Research Initiative is providing $100,000 in grants to four research projects")
q("nz_bh", cm("sites_google_com_bodekerscientific_com_bodekerscientific_projects_biomimetic_buildings.html"), "https://sites.google.com/bodekerscientific.com/bodekerscientific/projects/biomimetic-buildings", "International collaborators, including BioMat and Buro Happold, contribute global expertise to the development of scalable shading prototypes.")

def norm(s):
    s = html.unescape(s)
    for a, b in (("\u2013", "-"), ("\u2014", "-"), ("\u00a0", " ")):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()

def text_of(p):
    t = open(p, encoding="utf-8", errors="replace").read()
    t = re.sub(r"(?is)<(script|style|noscript).*?</\1>", " ", t)
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    return norm(t)

def check():
    cache = {}; missing = []
    for k, (p, u, qt) in Q.items():
        if p not in cache:
            cache[p] = text_of(p)
        ok = norm(qt).lower() in cache[p].lower()
        if not ok:
            missing.append(k)
        print("OK     " if ok else "MISSING", k, len(qt.split()), "words")
    return missing

if __name__ == "__main__":
    m = check()
    print("missing:", m)
