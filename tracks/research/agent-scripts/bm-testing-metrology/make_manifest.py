"""Write MANIFEST.tsv (file, bytes, sha256, fetched date, url) for the data folder. Run from anywhere."""
import hashlib, os, datetime
D = r"D:/Users/ashenoy00000/delphi-work/data/bm-testing-metrology"
URL = {
 "clearv5.pdf": "https://formlabs-media.formlabs.com/filer_public/dd/7f/dd7f3de9-55ae-4c82-ac52-408a4b5df64d/clear_resin_v5_tds___formlabs.pdf",
 "flex80v2.pdf": "https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf",
 "rigid10k.pdf": "https://media.formlabs.com/m/522eb50e6c8ac0e3/original/-ENUS-Rigid-10K-TDS.pdf",
 "solvent.html": "https://formlabs.com/support/solvent-compatibility/",
 "form4tol.html": "https://formlabs.com/support/Design-specifications-for-3D-models-Form-4-generation/",
 "iso62.pdf": "https://law.resource.org/pub/us/cfr/ibr/inc/iso/iso.0062.2008.pdf",
 "greenspan.pdf": "https://nvlpubs.nist.gov/nistpubs/jres/81A/jresv81An1p89_A1b.pdf",
 "idic_gpg.pdf": "https://idics.org/guide/DICGoodPracticesGuide_ElectronicVersion-V5g-181022.pdf",
 "idics_guide.html": "https://idics.org/guide/",
 "kruger.xml": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8544213/fullTextXML",
 "pa66.xml": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10459301/fullTextXML",
 "sht45.pdf": "https://cdn.sparkfun.com/assets/9/7/7/a/d/SHT45-AD1B-R2_datasheet.pdf",
 "p_bal1302.html": "https://scientificlabs.com/en/product/-nocategory-/BAL1302",
 "p_travers.html": "https://www.travers.com/6-absolute-digimatic-caliper/p/57-016-342/",
 "p_wiltronics.html": "https://www.wiltronics.com.au/product/90397/ohaus-px124-e-pioneer-analytical-balance/",
}
rows = ["file\tbytes\tsha256\tfetched\turl"]
for f in sorted(os.listdir(D)):
    p = os.path.join(D, f)
    if f == "MANIFEST.tsv" or not os.path.isfile(p): continue
    b = open(p, "rb").read()
    u = URL.get(f, "https://store.astm.org/" + f[5:] if f.startswith("astm_") and f.endswith(".html") else "derived text from a file above (pdftotext / tag-strip)")
    rows.append("%s\t%d\t%s\t%s\t%s" % (f, len(b), hashlib.sha256(b).hexdigest(), datetime.date.fromtimestamp(os.path.getmtime(p)), u))
open(os.path.join(D, "MANIFEST.tsv"), "w").write("\n".join(rows) + "\n")
print("\n".join(r[:150] for r in rows))
