"""Part 1 of the result builder: sources + helpers. Imported by build.py (do not run alone)."""
import re, json, os

DATA = "D:/Users/ashenoy00000/delphi-work/data/formlabs-printing"
RET = "retrieved 2026-11-12"

# key -> (url, local text file)
SRC = {
    "manual":   ("https://cdn.goengineer.com/formlabs-form4-user-guide-enus.pdf", "form4_manual.txt"),
    "maint":    ("https://formlabs.com/global/support/Schedule-of-maintenance-Form-4-generation/", "form4_maint.txt"),
    "omm_sla":  ("https://formlabs.com/support/Printing-with-Open-Material-Mode/", "omm_sla.txt"),
    "omm_setup": ("https://formlabs.com/support/Setting-up-Open-Material-Mode/", "omm_setup.txt"),
    "omm_sls":  ("https://formlabs.com/support/Printing-with-Open-Material-Mode-SLS/", "omm_sls.txt"),
    "omm_store": ("https://formlabs.com/asia/store/materials/open-material-mode", "omm_store2.txt"),
    "omm_mh":   ("https://www.matterhackers.com/store/l/open-material-license-for-formlabs-3d-printers", "omm_mh.txt"),
    "omm_proto": ("https://store.proto3000.com/products/open-material-mode", "omm_proto.txt"),
    "design":   ("https://formlabs.com/support/Design-specifications-for-3D-models-Form-4-generation/", "design_form4.txt"),
    "fuse_design": ("https://formlabs.com/support/Design-specifications-for-3D-models-Fuse-1/", "fuse_design.txt"),
    "fuse_orient": ("https://formlabs.com/support/Model-orientation-best-practices-for-SLS-printing/", "fuse_orient.txt"),
    "warp":     ("https://formlabs.com/uk/support/Warping-SLA/", "warping_sla.txt"),
    "orient":   ("https://formlabs.com/support/Model-Orientation/", "model_orient.txt"),
    "direct":   ("https://formlabs.com/support/Printing-directly-on-the-build-platform-in-PreForm/", "direct_platform.txt"),
    "faq":      ("https://formlabs.com/support/3d-printing-post-processing-faqs/", "postproc_faq.txt"),
    "blog_large": ("https://formlabs.com/blog/how-to-create-models-larger-than-your-3d-printers-build-volume/", "blog_large.txt"),
    "postcure": ("https://formlabs.com/support/Introduction-to-Post-Curing-Prints/", "intro_postcure.txt"),
    "wash":     ("https://formlabs.com/support/Form-Wash-Time-Settings/", "wash_times.txt"),
    "cure2":    ("https://formlabs.com/support/Form-Cure-2nd-Generation-time-and-temperature-settings/", "cure2_times.txt"),
    "solvent":  ("https://formlabs.com/support/solvent-compatibility/", "solvent.txt"),
    "flex80_tds": ("https://cdn.goengineer.com/flexible-80a-resin-v2-material-spec-sheet.pdf", "flex80_spec.txt"),
    "flex80_page": ("https://formlabs.com/products/flexible-80a-resin/", "flex80_page.txt"),
    "tough1000_page": ("https://formlabs.com/products/tough-1000-resin/", "tough1000_page.txt"),
    "flex50_page": ("https://formlabs.com/products/flexible-50a-resin/", "flex50_page.txt"),
    "rigid10k_page": ("https://formlabs.com/products/rigid-10k-resin/", "rigid10k_page.txt"),
    "techspecs": ("https://formlabs.com/3d-printers/resin/tech-specs/", "form4_techspecs.txt"),
    "insider":  ("https://formlabs.com/support/PreForm-Insider-Program-release-notes/", "insider_notes.txt"),
    "f_printon": ("https://forum.formlabs.com/t/print-on-a-previously-positionned-material-sheet-on-build-platform/33499", "forum_printon.txt"),
    "f_printobj": ("https://forum.formlabs.com/t/printing-on-an-object/38823", "forum_printobj.txt"),
    "f_distort": ("https://forum.formlabs.com/t/shape-distortion-in-long-thin-sections/10940", "forum_distort.txt"),
    "f_glue":   ("https://forum.formlabs.com/t/glue-big-parts/13238", "forum_gluebig.txt"),
    "f_bond":   ("https://forum.formlabs.com/t/bonding-resin-surfaces/36157", "forum_bonding.txt"),
    "f_multimat": ("https://forum.formlabs.com/t/multi-material-prints/30098", "forum_multimat.txt"),
    "f_incompat": ("https://forum.formlabs.com/t/incompatible-resin/11706", "forum_incompat.txt"),
    "gojzewski": ("https://pmc.ncbi.nlm.nih.gov/articles/PMC7033657", "pmc7033657.txt"),
    "oil":      ("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2843537/", "pmc2843537.txt"),
    "xu2016":   ("https://api.crossref.org/works/10.1115/1.4034305", None),
    "project":  ("D:/Users/ashenoy00000/delphi-work/agents/spec-formlabs-materials.json", None),
    "calc":     ("D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-formlabs-printing-workflows/calc.py", None),
}

_norm_cache = {}

def norm(s):
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    s = s.replace("\u00a0", " ").replace("\ufb01", "fi").replace("\ufb02", "fl")
    return re.sub(r"\s+", " ", s).strip().lower()

def load_norm(fname):
    if fname not in _norm_cache:
        _norm_cache[fname] = norm(open(os.path.join(DATA, fname), encoding="utf-8", errors="replace").read())
    return _norm_cache[fname]

FAILS = []
FINDINGS = []
KEY_CLAIMS = []

def check_quote(src, quote):
    """True when quote occurs verbatim (whitespace/quote-normalised) in the local text of src."""
    url, fname = SRC[src]
    if not quote:
        return None
    if fname is None:
        return None  # not checkable against a local text file
    ok = norm(quote) in load_norm(fname)
    if not ok:
        FAILS.append((src, quote))
    return ok

def F(claim, src, conf, value=None, quote="", src2=None, note=None):
    """Add a finding. src is a key of SRC. Verifies the quote against the local copy."""
    url, fname = SRC[src]
    ok = check_quote(src, quote)
    d = {"claim": claim, "source": f"{url} ({RET}; local copy {DATA}/{fname})" if fname else f"{url} ({RET})",
         "confidence": conf}
    if value is not None:
        d["value"] = value
    if quote:
        d["evidence_quote"] = quote
    if src2:
        d["also_see"] = [SRC[s][0] for s in src2]
    if note:
        d["note"] = note
    FINDINGS.append(d)
    return d

def K(claim, src, quote):
    url, fname = SRC[src]
    check_quote(src, quote)
    KEY_CLAIMS.append({"claim": claim, "source": f"{url} ({RET})", "evidence_quote": quote})
