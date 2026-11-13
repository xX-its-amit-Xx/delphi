"""Fetch Mamou-Mani / Fab.Pub / press pages as raw HTML, save to data dir, record sha256, extract visible text.
Run: python -I fetch_pages.py   (needs only the stdlib). Output: data/mamou-mani/*.html, *.txt, manifest.tsv"""
import urllib.request, hashlib, re, html, os, sys, datetime
OUT = r"D:\Users\ashenoy00000\delphi-work\data\mamou-mani"
URLS = {
 "home":"https://mamou-mani.com/",
 "projects":"https://mamou-mani.com/projects/",
 "about":"https://mamou-mani.com/about-us/",
 "news":"https://mamou-mani.com/news/",
 "teaching":"https://mamou-mani.com/teaching-speaking/",
 "galaxia":"https://mamou-mani.com/project/galaxia/",
 "conifera":"https://mamou-mani.com/project/conifera/",
 "cos":"https://mamou-mani.com/project/cos/",
 "altostrata":"https://mamou-mani.com/project/altostrata-pavilion/",
 "roe":"https://mamou-mani.com/project/the-roe-restaurant-london/",
 "wavery":"https://mamou-mani.com/project/the-wavery-fortnum-mason/",
 "sandwaves":"https://mamou-mani.com/project/sandwaves-installation/",
 "catharsis":"https://mamou-mani.com/project/catharsis-installation/",
 "iwan":"https://mamou-mani.com/project/iwan-architectural-gateway/",
 "foodink":"https://mamou-mani.com/project/food-ink-3d-printing-restaurant/",
 "woodenwaves":"https://mamou-mani.com/project/wooden-waves-burohappold/",
 "whaleshark":"https://mamou-mani.com/project/whale-shark-fifa-world-cup/",
 "cloudcapsule":"https://mamou-mani.com/project/cloud-capsule/",
 "towergaia":"https://mamou-mani.com/project/tower-of-gaia/",
 "circularhouse":"https://mamou-mani.com/project/circular-house-london/",
 "wowhouse":"https://mamou-mani.com/project/wowhouse-installation/",
 "concordia":"https://mamou-mani.com/project/concordia-photoclimat/",
 "thk":"https://mamou-mani.com/project/thk-tower/",
 "aurora":"https://mamou-mani.com/project/aurora/",
 "fabpub_home":"https://fabpub.com/",
 "fabpub_bio":"https://fabpub.com/pages/biomaterials",
 "dezeen_conifera":"https://www.dezeen.com/2019/04/15/bioplastics-bad-environment-damage-arthur-huang/",
 "therme_interview":"https://www.thermegroup.com/blog/article/in-conversation-with-arthur-mamou-mani-architect",
 "frederic":"https://fredericmagazine.com/2024/06/mamou-mani-architect/",
 "fp_3dprinting":"https://fabpub.com/pages/3d-printing",
 "fp_materialinnov":"https://fabpub.com/pages/material-innovation",
 "fp_fabtech":"https://fabpub.com/pages/fabrication-technology",
 "fp_mobile":"https://fabpub.com/pages/the-fab-pub-mobile-factory",
 "fp_circularity":"https://fabpub.com/pages/circularity",
 "fp_panels":"https://fabpub.com/pages/architectural-panels",
 "fp_exterior":"https://fabpub.com/pages/exterior-designs",
 "fp_franchise":"https://fabpub.com/pages/franchise-jvs",
 "fp_about":"https://fabpub.com/pages/about",
 "fp_team":"https://fabpub.com/pages/team",
 "fp_projects":"https://fabpub.com/pages/projects",
 "azfactory":"https://mamou-mani.com/project/az-factory-retail-corners/",
 "tate":"https://mamou-mani.com/project/tate-modern-turbine-hall-2026/",
 "riva":"https://mamou-mani.com/project/riva-at-pancras-square/",
 "falling":"https://mamou-mani.com/project/falling-in-love-stage/",
 "hermes":"https://mamou-mani.com/project/hermes-sanlitun-flagship-facade/",
 "fortnumawards":"https://mamou-mani.com/project/fortnum-mason-3d-printed-awards/",
 "samsung":"https://mamou-mani.com/mamou-mani-contributes-to-samsung-smartthings-future-living-report/",
 "dezeen_galaxia":"https://www.dezeen.com/2018/01/02/burning-man-2018-temple-galaxia-arthur-mamou-mani-university-westminster/",
 "dezeen_sandwaves":"https://www.dezeen.com/2020/01/20/sandwaves-precht-arthur-mamou-mani-pavilion-saudi-arabia/",
 "p3dind":"https://3dprintingindustry.com/news/3d-printing-industry-speaks-burning-man-temple-architect-arthur-mamou-mani-127258/",
 "printing_conifera":"https://3dprinting.com/news/conifera-cos-sustainable-bioplastic-structure",
 "karamba":"https://www.karamba3d.com/project/temple-galaxia/",
 "flyingwhales":"https://mamou-mani.com/project/flying-whales-airship/",
 "wavery_old":"https://mamou-mani.com/project/the-wavery/",
 "fp_monolith":"https://fabpub.com/pages/the-monolith-wall-at-neko-health",
 "fp_annabels":"https://fabpub.com/pages/annabels-summer-facade",
 "fp_cloudlift":"https://fabpub.com/pages/cloud-lift-at-the-roof-gardens",
 "fp_harmonic":"https://fabpub.com/pages/harmonic-tides-3d-printed-clerkenwell",
 "fp_hydro":"https://fabpub.com/pages/hydro-dipping-for-stunning-3d-printed-finishes",
 "fp_mixedreality":"https://fabpub.com/pages/from-vision-to-reality-mixed-reality-for-scalable-fabrication",
 "wallpaper":"https://www.wallpaper.com/architecture/profile-arthur-mamou-mani-uk",
}
def text_of(h):
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    return re.sub(r"\s+", " ", html.unescape(h)).strip()
os.makedirs(OUT, exist_ok=True)
only = sys.argv[1:] or list(URLS)
with open(os.path.join(OUT,"manifest.tsv"),"a",encoding="utf8") as m:
    for k in only:
        u = URLS[k]
        try:
            req = urllib.request.Request(u, headers={"User-Agent":"delphi-research/0.1"})
            b = urllib.request.urlopen(req, timeout=40).read()
            st = "200"
        except Exception as e:
            print(k, "FAIL", e); m.write(f"{k}\t{u}\tFAIL {e}\n"); continue
        open(os.path.join(OUT,k+".html"),"wb").write(b)
        t = text_of(b.decode("utf8","replace"))
        open(os.path.join(OUT,k+".txt"),"w",encoding="utf8").write(t)
        line = f"{k}\t{u}\t{datetime.date.today()}\t{len(b)}\t{hashlib.sha256(b).hexdigest()}"
        print(line); m.write(line+"\n")
