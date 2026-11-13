"""Write sha256/size manifest of everything kept under data/resin-water (URL map is hand-maintained below). python manifest.py"""
import hashlib, os, json, datetime
D="D:/Users/ashenoy00000/delphi-work/data/resin-water"
URL={
"flex80av2_tds.pdf":"https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf",
"goeng_flex80av2.pdf":"https://cdn.goengineer.com/flexible-80a-resin-v2-material-spec-sheet.pdf (byte-identical to flex80av2_tds.pdf)",
"solvent_compat2.html":"https://formlabs.com/support/solvent-compatibility/",
"solvent_compat.html":"https://formlabs.com/support/Solvent-Compatibility-of-Formlabs-Resins (redirect stub, 404 content)",
"elastic50a_v1_tds.pdf":"https://digilab.uma.es/pdf/form-3bl/Fichas-tecnicas-resinas/Ficha-tecnica-Elastic-50A.pdf",
"formlabs_materials_library_2019.pdf":"https://formlabs-media.formlabs.com/filer_public/ac/89/ac8963db-f54a-4cac-8fe9-fb740a7b06f1/formlabs-materials-library.pdf",
"flexible_whitepaper.html":"https://formlabs.com/support/Using-Flexible-Resin/",
"radic_2406.08326v2.html":"https://arxiv.org/html/2406.08326v2",
"pmc8947006.html":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8947006/",
"pmc12573946.html":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12573946/",
"springer_retainers.html":"https://link.springer.com/article/10.1007/s00784-024-06120-4",
"opendentj_splint.pdf":"https://opendentistryjournal.com/contents/volumes/V19/e18742106390759/e18742106390759.pdf",
"bmcoh_2025_denture.pdf":"https://link.springer.com/content/pdf/10.1186/s12903-025-07115-7.pdf",
"cobem2007_1247.pdf":"https://www.abcm.org.br/anais/cobem/2007/pdf/COBEM2007-1247.pdf",
"PMC7143370.xml":"https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7143370/fullTextXML",
"PMC12986659.xml":"https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12986659/fullTextXML",
"PMC10452991.xml":"https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10452991/fullTextXML",
"stratasys_pj_matsheet.pdf":"https://pocc-techpark.media.uconn.edu/wp-content/uploads/sites/2880/2020/10/MSS_PJ_PJMaterialsDataSheet-1-1.pdf",
"rpu70_protolabs.pdf":"https://Protolabs.com/media/1022504/tds_103213-02-a_rpu-70.pdf",
"epu41_prototek.pdf":"https://www.prototek.com/wp-content/uploads/2023/10/TDS-EPU-41.pdf"}
rows=[]; tot=0
for f in sorted(os.listdir(D)):
    p=os.path.join(D,f); b=open(p,"rb").read(); tot+=len(b)
    rows.append(dict(file=f,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),url=URL.get(f,"derived text extract of a file above"),fetched="2026-11-12"))
json.dump(dict(total_bytes=tot,files=rows),open(os.path.join(D,"MANIFEST.json"),"w"),indent=1)
print(tot,"bytes in",len(rows),"files")
