import json
H = "HYPOTHESIS TO TEST, not a claim of willingness to collaborate: "
cx = "Crossref API https://api.crossref.org/works/%s returned title, journal, year and last author (2026-11-12); script scripts/pp-broad-fish-biologists/crossref.py"


def cit(authors, year, title, doi, venue, used):
    return dict(authors=authors, year=year, title=title, doi_or_arxiv=doi, verified=True,
                venue=venue, used_for=used, how_verified=cx % doi)


C = [
    cit("Ludin ... Zon", 2025, "CRATER tumor niches facilitate CD8+ T cell engagement and correspond with immunotherapy success", "10.1016/j.cell.2025.09.021", "Cell", "Zon (zebrafish melanoma)"),
    cit("Jia, Tang ... Zon, Engert, Cohen", 2025, "Swimming motions evoke Piezo1-dependent Ca2+ events in vascular endothelial cells of larval zebrafish", "10.1016/j.cub.2025.10.053", "Current Biology", "Zon co-author; swimming mechanics"),
    cit("Babu, Chen ... Zon ... Insco", 2025, "Specific oncogene activation of the cell of origin in mucosal melanoma", "10.1038/s41467-025-61937-1", "Nature Communications", "Zon co-author (Europe PMC author list; last author Insco)"),
    cit("Miller ... Goessling", 2024, "The proteasome subunit psmb1 is essential for craniofacial cartilage maturation and morphogenesis", "10.1172/jci.insight.181723", "JCI Insight", "Goessling"),
    cit("Miller ... Goessling", 2024, "Distribution and developmental timing of zebrafish liver innervation", "10.1098/rsbl.2024.0288", "Biology Letters", "Goessling"),
    cit("Oderberg ... Goessling", 2023, "Biliary epithelial cells are facultative liver stem cells during liver regeneration in adult zebrafish", "10.1172/jci.insight.163929", "JCI Insight", "Goessling"),
    cit("Wan, El Kholtei ... Schier", 2026, "Whole-embryo spatial transcriptomics at subcellular resolution from gastrulation to organogenesis", "10.1126/science.adt3439", "Science", "Schier (spatial patterns)"),
    cit("Nichols, Shafer ... Schier", 2025, "Widespread temporal niche partitioning in an adaptive radiation of cichlid fishes", "10.1038/s41559-025-02819-z", "Nature Ecology & Evolution", "Schier (cichlids)"),
    cit("Farrell, Wang ... Schier", 2018, "Single-cell reconstruction of developmental trajectories during zebrafish embryogenesis", "10.1126/science.aar3131", "Science", "Schier; Broad news item"),
]
DIR = "https://www.broadinstitute.org/people/broad-faculty-associate-affiliate-members"
F = [
    dict(claim="Broad Associate Members directory lists Leonard Zon with Boston Children's Hospital.", source=DIR, confidence="medium (read via summarising fetch; raw HTML did not contain names; guessed individual bio URLs returned 404)", evidence_quote=""),
    dict(claim="Directory lists Wolfram Goessling with Massachusetts General Hospital (a search summary said a Broad Metabolism team page gives BWH, and HMS says Brigham and Women's: disagreement unresolved).", source=DIR, confidence="medium-low", evidence_quote=""),
    dict(claim="Directory lists Calum Macrae with Brigham and Women's Hospital.", source=DIR, confidence="medium-low", evidence_quote=""),
    dict(claim="Broad news item describes Alex Schier as associate member at Broad and Harvard professor (2018 zebrafish single-cell atlas).", source="https://www.broadinstitute.org/news/reconstructing-how-zebrafish-embryos-develop-cell-cell", confidence="high for 2018", evidence_quote="Alex Schier, associate member at Broad and professor at Harvard University"),
    dict(claim="Schier's 2025 cichlid paper gives his affiliation as Biozentrum, University of Basel: current Broad status NOT confirmed.", source="https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1038/s41559-025-02819-z&format=json&resultType=core", confidence="high", evidence_quote="Biozentrum, University of Basel, Basel, Switzerland."),
    dict(claim="Kerstin Lindblad-Toh is scientific director of vertebrate genome biology at Broad; page (Jan 2013) lists dog and 29 Mammals work, not fish.", source="https://www.broadinstitute.org/bios/kerstin-lindblad-toh", confidence="high", evidence_quote="scientific director of vertebrate genome biology at the Broad Institute"),
    dict(claim="Broad sequenced a freshwater threespine stickleback (Bear Paw Lake) to 9x coverage.", source="https://www.broadinstitute.org/stickleback/stickleback-genome-project", confidence="medium (search snippet)", evidence_quote="The Broad Institute has sequenced a freshwater threespine stickleback from Bear Paw Lake (Gasterosteus aculeatus) to 9x coverage."),
    dict(claim="Goessling lab uses zebrafish for liver development, regeneration and liver cancer; HMS lists him Robert H. Ebert Professor of Medicine, Brigham and Women's.", source="https://hscrb.harvard.edu/people/wolfram-goessling", confidence="medium (search summary)", evidence_quote=""),
]
T = [
    dict(name="Leonard Zon", fields="role='Leonard Zon, Boston Children's Hospital' (Broad associate-member directory); focus=zebrafish blood stem cells, melanoma; papers=10.1016/j.cell.2025.09.021; 10.1016/j.cub.2025.10.053; 10.1038/s41467-025-61937-1; link=" + H + "CRATER tumour niches and Piezo1 swimming-evoked endothelial Ca2+ touch reporter circuits, spatial patterns and fin/body mechanics", source=DIR),
    dict(name="Wolfram Goessling", fields="role='Wolfram Goessling, Massachusetts General Hospital' (Broad directory); HMS: Robert H. Ebert Professor of Medicine, BWH; focus=zebrafish liver regeneration, craniofacial cartilage; papers=10.1172/jci.insight.181723; 10.1098/rsbl.2024.0288; 10.1172/jci.insight.163929; link=" + H + "craniofacial cartilage morphogenesis and liver innervation timing touch body/lumen geometry (biliary ducts) and spatial patterns", source=DIR),
    dict(name="Alex Schier", fields="role='associate member at Broad and professor at Harvard University' (2018 page); now Biozentrum Basel; focus=zebrafish embryo patterning, single-cell and spatial atlases, cichlids; papers=10.1126/science.adt3439; 10.1038/s41559-025-02819-z; 10.1126/science.aar3131; link=" + H + "whole-embryo spatial transcriptomics bears on spatial patterns and reporter circuits; cichlid work is comparative fish biology; Broad tie probably lapsed", source="https://www.broadinstitute.org/news/reconstructing-how-zebrafish-embryos-develop-cell-cell"),
    dict(name="Calum Macrae", fields="role='Calum Macrae, Brigham and Women's Hospital' (Broad directory); fish focus=not verified in this run; papers=none verified", source=DIR),
]
S = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/pp-broad-fish-biologists/"
out = dict(
    label="pp-broad-fish-biologists",
    topic="Strong fish biologists at or affiliated with the Broad Institute",
    summary="Three Broad-linked zebrafish groups were verified with Crossref-resolved DOIs: Zon (Boston Children's; melanoma, vascular mechanics), Goessling (MGH/BWH; liver, cartilage) and Schier (Broad associate member in 2018, now in Basel; embryo atlases, cichlids). Macrae is in the directory but I verified no fish paper. No Broad-affiliated medaka, killifish, cavefish or stickleback PI was found; Lindblad-Toh's page is about dog and mammal genomics, though Broad sequenced a stickleback genome. All track links are hypotheses. Coverage is partial: guessed Broad bio URLs returned 404 and the directory was read through a summarising fetch.",
    lay_summary="We looked for scientists tied to the Broad Institute, a Boston-area research centre, who study fish. We found three who mainly work on zebrafish, a small see-through fish used as a living window into how bodies form. One studies skin cancer and blood, one studies the liver and skull cartilage, and one maps which genes switch on where in a growing embryo, like a street map of a tiny city. We did not find Broad people working on cave fish, killifish or sticklebacks. Any link to our own projects is only an idea to test, not a sign anyone wants to work with us.",
    glossary=[dict(term="zebrafish", plain="A small see-through fish used to study development and disease."),
              dict(term="melanoma", plain="A skin cancer."),
              dict(term="single-cell atlas", plain="A map of which genes each individual cell uses."),
              dict(term="spatial transcriptomics", plain="Measuring gene activity while keeping track of where in the tissue it happens."),
              dict(term="cichlid", plain="A very diverse group of freshwater fishes."),
              dict(term="DOI", plain="A permanent web ID for a paper.")],
    findings=F,
    key_claims=[dict(claim=F[0]["claim"], source=F[0]["source"], evidence_quote=""),
                dict(claim=F[3]["claim"], source=F[3]["source"], evidence_quote=F[3]["evidence_quote"]),
                dict(claim=F[4]["claim"], source=F[4]["source"], evidence_quote=F[4]["evidence_quote"])],
    table=T,
    reproduce=[dict(what="Verify DOIs", command_or_url="python -I " + S + "crossref.py <doi> ...", expected="title, journal, year, last author matching the citations (Python 3.14)"),
               dict(what="Europe PMC searches", command_or_url="python -I " + S + "epmc.py 'AUTH:\"Zon LI\" AND zebrafish AND PUB_YEAR:[2022 TO 2026]' 8", expected="lists the DOIs used (set PYTHONIOENCODING=utf-8)"),
               dict(what="Directory page", command_or_url=DIR, expected="Zon, Goessling, Macrae rows; raw curl HTML did not contain names, so use a browser")],
    recommendations=["Open the directory in a browser and copy exact role strings and profile URLs for Zon, Goessling, Macrae.", "Check whether Schier still holds a Broad appointment.", "Search Institute Members and Rare Disease pages for other fish groups."],
    citations=C,
    could_not_find=["Broad-hosted individual bio pages for Zon, Goessling, Macrae (guessed URLs 404).", "Verbatim directory row text (only summarised).", "Any Broad PI working on medaka, killifish, cavefish, stickleback or flying fish.", "A verified zebrafish paper for Macrae.", "Other candidates not verified; Lindblad-Toh not fish-focused now.", "No data files downloaded."],
    scripts_written=[S + "epmc.py", S + "crossref.py", S + "build.py"],
)
json.dump(out, open("D:/Users/ashenoy00000/delphi-work/agents2/pp-broad-fish-biologists.json", "w"), indent=1)
