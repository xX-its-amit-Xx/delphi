"""Part 2 of 2: gaps, glossary, recommendations, table, summary; writes agents2/bm-open-hardware-repro.json.
usage: python -I build_result2.py   (imports build_result.py from the same folder)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_result import F, KEY, REPRO, CIT, S, DATA  # noqa: E402
OUT = r'D:\Users\ashenoy00000\delphi-work\agents2\bm-open-hardware-repro.json'

GAPS = [
    'Prices for the balance, caliper, IPA and salts come only from search-result snippets: the vendor pages I tried (DSC Balances, Hisco, Raspberry Pi, Flinn) returned HTTP 429, 403 or 404 to me. They are low confidence and not dated per vendor.',
    'Unverified-background price ranges (no source) are used for: stage micrometer, microscope, camera/lens/stand, LED panel, I2C board, jars, NaCl, DI water, glassware, small tools, 1 TB drive, check weights. Together $436-1,700.',
    'Contents of the Form 4 Complete Package ($5,461) and Premium Package ($8,123) are chosen client-side and I could not read them; I priced the Basic Package plus Wash plus Cure separately ($4,323), $1,138 below the Complete Package.',
    'Form 4 tank SKU, tank fill volume, and real resin consumption including supports, raft and priming were not found. The 1.7 % figure counts part volume only.',
    'No Formlabs or independent source gives IPA diffusivity or drying time for these resins, so the conditioning time is an estimate from water D.',
    'Wash-time disagreement for Flexible 80A V2 (data sheet 10 min per bm-formlabs-printing-workflows.json; wash table 5 + 5 min): I re-read the wash table only, not the data sheet PDF.',
    'Fiji/ImageJ version not pinned (no release API found); record Help > About when used. The Python stack was not installed or exercised on image data (C: nearly full); only dependency resolution was checked.',
    'PreForm and printer firmware versions: I did not read a current version number from Formlabs; record the versions shown in the app and on the printer with every build. No open-source alternative to PreForm for Form 4 was found.',
    'Which universities or makerspaces hold a Form 4, Form Wash, Form Cure or a 0.1 mg balance: no source. The borrow flags in bom.csv are my judgement, not data.',
    'Whether the Raspberry Pi HQ camera is still in production in 2026-11: unconfirmed (one retailer said production to at least January 2026).',
    'Greenspan Table 2 was read from OCR of a scanned PDF; K2SO4 at 25 C was not readable and is interpolated; check the digits against the page image before citing them.',
    'No source measures bond strength, curl of 0.2-1 mm strips or minimum elastomer wall on Form 4 (carried over unchanged from bm-formlabs-printing-workflows.json); the pilot has to settle them.',
]

GLOS = [
    {'term': 'Bill of materials', 'plain': 'The shopping list: every part, its price and where the price came from.'},
    {'term': 'Resin', 'plain': 'The liquid plastic a Formlabs printer hardens with light, layer by layer.'},
    {'term': 'Wash and cure station', 'plain': 'Two boxes: one rinses uncured liquid off the part in alcohol, the other bakes it in UV light until it is hard.'},
    {'term': 'Isopropyl alcohol (IPA)', 'plain': 'Rubbing alcohol at high strength, used as the rinse.'},
    {'term': 'Saturated-salt jar', 'plain': 'A sealed jar with a salt slurry at the bottom; the air inside settles at a known, fixed dampness.'},
    {'term': 'Analytical balance', 'plain': 'A very sensitive scale; 0.1 mg is a ten-thousandth of a gram.'},
    {'term': 'Readability', 'plain': 'The smallest step the scale or ruler can show on its display.'},
    {'term': 'Open Material Mode', 'plain': 'A paid Formlabs unlock that lets the printer use other companies\' resins.'},
    {'term': 'Dry reference mass', 'plain': 'The weight of a part once it has dried to a steady, agreed state, so later weight gain can be counted from there.'},
    {'term': 'Pre-registration', 'plain': 'Writing down what you will measure and what counts as success before looking at the data.'},
    {'term': 'SHA-256 hash', 'plain': 'A fingerprint of a file that changes if even one byte changes.'},
    {'term': 'Bilayer', 'plain': 'A strip of two stuck-together layers that bends when one layer swells more than the other.'},
    {'term': 'Elastomer', 'plain': 'A rubber-like plastic that stretches and springs back.'},
]

REC = [
    'RUN ORDER FOR A LAB STARTING FROM NOTHING (design says about 5 weeks): (1) install PreForm and record versions; (2) borrow what bom.csv flags Y; (3) buy resin, tanks, IPA, salts, sensors; (4) set up the jars and log RH for 48 h before any specimen goes in; (5) check the balance with check weights and the scanner or camera with a certified scale; (6) run the dry-down curve below before any swelling measurement; (7) then follow agents/design-biomaterial.json.',
    'FOLDER LAYOUT: BM1/PREREG.md; BM1/CAD/ (STL or 3MF per build plus the .form project file); BM1/RAW/<batch>/ (camera DNG, scanner TIFF, edge images, named by naming.py); BM1/LOGS/ (measurements CSV, humidity CSV, one file per day, LF line ends, equipment.csv for printer firmware, PreForm version, resin lot and tank id); BM1/MANIFEST.tsv from naming.py manifest. Git for text files, the manifest for binaries.',
    'FILE NAMES: BM1_<batch P##>_<specimen S### or bilayer B###>_<MASS|IMG|SCN|EDG|RHL|NOTE>_<DRY|R##|H2O|IPA|PRE|WSH>_t####h_<UTC YYYYMMDDTHHMMSSZ>.<csv|json|dng|tif|png|txt>. Example BM1_P01_S003_IMG_H2O_t0024h_20261113T143000Z.dng. Validate with naming.py check; log columns utc,batch,specimen,quantity,value,unit,uncertainty,instrument,operator_code,rh_pct,temp_c,note validated by naming.py log-check.',
    'LOGGING RULES: UTC always; one reading per row; instrument id, operator code, RH and temperature on every row; raw values never overwritten, corrections appended as new rows; every photograph carries the scale target and a grey card in frame.',
    'LENGTH PROTOCOL: scan or photograph at fixed height with the certified scale in the frame; edge position by sub-pixel fit (scikit-image) with a hand cross-check in Fiji on 10 percent of images; callipers only as a gross sanity check on elastomers.',
    'FLAGGED STEP most likely to differ between labs: conditioning each printed layer to a defined dry reference mass after the IPA wash and post-cure (solvent age and time, drying time and RH, and the criterion for constant mass). Why: Flexible 80A V2 takes up about 45 % mass of IPA in a day (data sheet via project record) against 6.9 % for Tough 1000 and under 0.1 % for Rigid 10K; Formlabs prefers fresh solvent for the second wash and rates one IPA refill at 120 prints; the project record has a 10 min versus 5 + 5 min wash disagreement for the same resin; no leaching or drying rate is measured (my estimate is 1 to 25 h depending on thickness). Leftover solvent or leachable monomer would be read as water gain or swelling. Runner-up: UV dose, because a lab without Form Cure V2 will not reproduce the cure. Control: record a dry-down mass curve for 3 strips per resin, define constant mass as under 0.05 % change over 24 h at 22 +-2 C and 33 %RH (my proposed threshold, not from a source), use fresh IPA for the second wash, and log solvent batch and age.',
    'AMENDMENTS TO THE EARLIER DESIGN: wet jar 97 %RH (K2SO4) or 75 %RH (NaCl) instead of 90 %RH; the Flex Build Platform ($339) is optional; Open Material Mode is $875, not about $3.7k, so the hydrogel fallback is cheaper than bm-formlabs-printing-workflows.json said.',
    'IF NO FORMLABS PRINTER IS ACCESSIBLE: ask a makerspace to print the two layers and hand them over unwashed (or washed to your protocol) with resin lot numbers. The Fuse path (about $49.8k before powder) is not realistic to reproduce in-house; keep it as an outsourced option.',
]

TABLE = [
    {'name': 'Form 4 Basic Package', 'fields': 'sku=PKG-F4-BASIC; price=USD 2625; includes=printer+1 tank+1 mixer+1 build platform+Finish Kit; fetched=2026-11-12', 'source': 'https://formlabs.com/store/form-4/'},
    {'name': 'Form 4 Resin Tank / Mixer', 'fields': 'tank=USD 119; mixer=USD 50; extra tanks needed=2 (3 resins); fetched=2026-11-12', 'source': 'https://formlabs.com/store/materials/tough-1000-resin/'},
    {'name': 'Form Wash V2', 'fields': 'sku=FH-WA-03; price=USD 699; solvent volume=7-15 L; default wash=10 min; prints per IPA refill=120; fetched=2026-11-12', 'source': 'https://formlabs.com/store/form-wash/'},
    {'name': 'Form Cure V2 120V', 'fields': 'sku=FH-CU-120V-02; price=USD 999; turntable=23.5 cm; fetched=2026-11-12', 'source': 'https://formlabs.com/store/form-cure/'},
    {'name': 'Flexible 80A Resin V2 1 L', 'fields': 'sku=RS-C2-FL80-02; price=USD 199; wash=5+5 min IPA; cure=cycle1 5 min no heat in water, cycle2 5 min 80 C', 'source': 'https://formlabs.com/products/flexible-80a-resin/'},
    {'name': 'Flexible 50A Resin 1 L', 'fields': 'sku=RS-C2-ELCL-02; price=USD 199; wash=20 min IPA; cure=7 min 70 C', 'source': 'https://formlabs.com/products/flexible-50a-resin/'},
    {'name': 'Tough 1000 Resin 1 L', 'fields': 'sku=RS-C2-TO10-01; price=USD 149; 5 L=USD 695 (needs resin pump); wash=10+10 min then air dry >=30 min; cure=12 min 70 C or low-warp 12 min no heat', 'source': 'https://formlabs.com/store/materials/tough-1000-resin/'},
    {'name': 'Rigid 10K / Silicone 40A 1 L (optional)', 'fields': 'rigid10k sku=RS-C2-RG10-11 price=USD 299; silicone40a sku=RS-C2-SI40-01 price=USD 349', 'source': 'https://formlabs.com/products/rigid-10k-resin/ ; https://formlabs.com/products/silicone-40a-resin/'},
    {'name': 'Open Material Mode Form 4', 'fields': 'sku=SFT-OMM-F4-02; price=USD 875; lifetime per printer; Form 4B USD 2499; Form 4L USD 4999; Fuse 1 USD 11899', 'source': 'https://formlabs.com/store/materials/open-material-mode/'},
    {'name': 'Form 4 Flex Build Platform (optional)', 'fields': 'sku=BP-F4-02; price=USD 339', 'source': 'https://formlabs.com/products/form-4-flex-build-platform/'},
    {'name': 'Analytical balance 0.1 mg', 'fields': 'readability=0.1 mg; capacity>=100 g; price=USD 2805-3747 (snippets); borrow=yes; strip mass ~174 mg', 'source': 'https://www.dscbalances.com/products/ohaus-px224-analytical-balance-replacement-for-pa224c'},
    {'name': 'Caliper 0.01 mm', 'fields': 'resolution=0.01 mm; price=USD 192-289 (snippets); gross checks only', 'source': 'https://www.transcat.ca/mitutoyo-500-196-30-500-196-30'},
    {'name': 'Flatbed scanner', 'fields': 'optical resolution=6400 dpi; use=2400 dpi = 10.6 um/pixel; price=USD 349.99 (search result); needs scale calibration', 'source': 'https://epson.com/For-Home/Scanners/Photo-Scanners/Epson-Perfection-V600-Photo-Scanner/p/B11B198011'},
    {'name': 'Humidity/temperature sensor', 'fields': 'part=Adafruit SHT45; price=USD 12.50; accuracy=+-1.0 %RH, +-0.1 C; qty=2', 'source': 'https://www.adafruit.com/product/5665'},
    {'name': 'Saturated-salt jars', 'fields': 'MgCl2 32.78 %RH; NaCl 75.29 %RH; K2SO4 ~97.3 %RH (interpolated) at 25 C; coefficient -0.04 to -0.06 %RH per C', 'source': 'https://doi.org/10.6028/jres.081A.011'},
    {'name': 'Software stack (open source)', 'fields': 'python=3.14.2; numpy=2.5.4; scipy=1.18.1; scikit-image=0.26.0; opencv-python-headless=5.0.0.93; matplotlib=3.11.2; pillow=13.0.0; pytest=9.2.0; ExifTool=13.63; FreeCAD=1.1.4; darktable=5.6.2; OpenSCAD=2021.01; git=2.52.0; Fiji=version not read', 'source': 'https://pypi.org/ ; https://exiftool.org/ver.txt ; https://api.github.com/repos/FreeCAD/FreeCAD/releases/latest'},
    {'name': 'PreForm (not open source)', 'fields': 'price=free; OS=Windows 10 1809+ or macOS 13+; reads STL, OBJ, 3MF, STEP; projects across materials from 3.62.0', 'source': 'https://formlabs.com/software/preform/ ; https://formlabs.com/support/Opening-a-model-in-PreForm/'},
    {'name': 'BOM totals (USD)', 'fields': 'core all-new=9017-11524; borrowable part=8097-10293; must-buy=920-1231; Formlabs chain new + rest borrowed=5243-5554; Formlabs/Adafruit-page-priced share=5133; snippet-priced=3448-4691; unverified=436-1700', 'source': S + 'bom.py'},
]

SUMMARY = (
    'Reproduction pack for the first bilayer swelling experiment on Formlabs hardware, with prices read from official Formlabs store pages on 2026-11-12. '
    'Bought new, the core kit costs about $9.0k to $11.5k: $5,133 is read directly from Formlabs and Adafruit pages (Form 4 Basic $2,625, Form Wash V2 $699, Form Cure V2 $999, two extra tanks $238, three 1 L resins $547, two humidity sensors $25), $3.4k to $4.7k comes from search-result snippets (mostly the 0.1 mg balance at $2.8k to $3.7k) and $0.4k to $1.7k from unverified guesses. '
    'Most of it can be borrowed (printer, wash, cure, balance, scanner, microscope, camera); the unavoidable purchases are resin, tanks, IPA, sensors, salts and small items, about $920 to $1,230. '
    'It contradicts an earlier file on one point: Open Material Mode has an official price, $875 for the Form 4, not about $3.7k. '
    'It amends the design: a 90 %RH salt jar is not a clean fixed point, so use NaCl (75 %RH) and K2SO4 (about 97 %RH). '
    'Instrument needs follow from the signal: a 40x4x1 mm strip weighs about 174 mg, so a 0.1 mg balance gives 0.3 % error at 8 % uptake and a 1 mg balance 2.9 %; length needs optical measurement at about 10 um per pixel with a certified scale, thickness about 2 um pixels. '
    'Included: a file-naming and logging convention with a tested validator, a pinned open-source Python stack that resolves under Python 3.14, and SHA-256 manifests of every saved page. '
    'The step most likely to differ between labs is conditioning each layer to a defined dry reference mass after the IPA wash: Flexible 80A V2 takes up about 45 % IPA by mass in a day, nobody has measured drying rates, and Formlabs gives two different wash times. PreForm is free but not open source.')

LAY = (
    'This is a shopping list and instruction sheet so another lab can repeat our first test without asking us anything. '
    'The test needs a resin 3D printer, a rinse-and-bake station, a very fine scale and a way to hold air at a known dampness. '
    'Bought new it costs about as much as a small used car, but most of it can be borrowed from a university lab or makerspace, leaving about a thousand dollars of materials to buy. '
    'The step most likely to go differently from lab to lab is getting each printed strip properly dry after its alcohol rinse, because the soft rubber-like resin soaks up almost half its weight in alcohol and nobody has measured how fast it dries. '
    'If one lab leaves a trace of alcohol inside, it will read that as the strip swelling in water. '
    'So every lab should first record a drying curve, like weighing laundry until it stops getting lighter.')

OUTD = {
    'label': 'bm-open-hardware-repro', 'topic': 'Reproducibility pack: parts list, files and costs',
    'summary': SUMMARY, 'lay_summary': LAY, 'findings': F, 'key_claims': KEY, 'table': TABLE, 'recommendations': REC,
    'reproduce': REPRO, 'citations': CIT, 'could_not_find': GAPS, 'glossary': GLOS,
    'scripts_written': [S + n for n in ('bom.csv', 'bom.py', 'resolution.py', 'resin_use.py', 'naming.py', 'extract_offers.py', 'html2txt.py', 'data_manifest.py', 'requirements.txt', 'build_result.py', 'build_result2.py')],
}
json.dump(OUTD, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('wrote', OUT, os.path.getsize(OUT), 'bytes;', len(F), 'findings')
