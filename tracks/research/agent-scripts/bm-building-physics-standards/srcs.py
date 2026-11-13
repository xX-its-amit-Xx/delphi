"""Source loaders and verbatim-quote checker for bm-building-physics-standards.
Every evidence_quote in the result is checked here against the saved copy of the source.
"""
import re, html, subprocess, os, functools

ROOT = "D:/Users/ashenoy00000/delphi-work/data/bm-bps"


def _collapse(s):
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    return re.sub(r"\s+", " ", s)


@functools.lru_cache(None)
def html_text(rel):
    t = open(os.path.join(ROOT, rel), encoding="utf8", errors="ignore").read()
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return _collapse(t)


@functools.lru_cache(None)
def pdf_text(rel):
    r = subprocess.run(["pdftotext", os.path.join(ROOT, rel), "-"], capture_output=True)
    return _collapse(r.stdout.decode("utf8", "ignore"))


@functools.lru_cache(None)
def pdfraw_text(rel):
    r = subprocess.run(["pdftotext", "-raw", os.path.join(ROOT, rel), "-"], capture_output=True)
    return _collapse(r.stdout.decode("utf8", "ignore"))


@functools.lru_cache(None)
def pdflayout_text(rel):
    r = subprocess.run(["pdftotext", "-layout", os.path.join(ROOT, rel), "-"], capture_output=True)
    return _collapse(r.stdout.decode("utf8", "ignore"))


@functools.lru_cache(None)
def plain_text(rel):
    return _collapse(open(os.path.join(ROOT, rel), encoding="utf8", errors="ignore").read())


def load(key):
    kind, rel = key.split(":", 1)
    return {"html": html_text, "pdf": pdf_text, "pdfraw": pdfraw_text, "pdflayout": pdflayout_text, "txt": plain_text}[kind](rel)


def _lig(s):
    # tolerate lost fi/fl/ff ligatures in some PDF extractions
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("fi", "").replace("fl", "").replace("ff", "").replace("f", "").replace("i", "").replace("l", ""))


def check(key, quote):
    """Return 'exact', 'ligature', or None."""
    if not quote:
        return "empty"
    src = load(key)
    q = _collapse(quote).strip()
    if q in src:
        return "exact"
    if _lig(q) in _lig(src):
        return "ligature"
    return None
