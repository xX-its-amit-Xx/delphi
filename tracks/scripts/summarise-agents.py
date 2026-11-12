"""Print a readable digest of what the track agents returned.

    python tracks/scripts/summarise-agents.py [slug ...]        designs + law maps
    python tracks/scripts/summarise-agents.py --specs [slug ...] specialist reports

Kept as a file rather than an inline heredoc: these digests are long and are run repeatedly.
"""
import glob
import json
import os
import sys

AGENTS = os.environ.get("DELPHI_AGENTS_DIR", "D:/Users/ashenoy00000/delphi-work/agents")
SLUGS = ["reporter", "patterns", "lumen", "glide", "biomaterial", "flyingfish"]


def load(name):
    p = os.path.join(AGENTS, name)
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception as e:
        return {"_error": str(e)}


def w(s):
    sys.stdout.write(str(s) + "\n")


def designs(slugs):
    for s in slugs:
        d, L = load(f"design-{s}.json"), load(f"laws-{s}.json")
        w("\n" + "=" * 100)
        w(f"TRACK {s.upper()}")
        if "_error" in d:
            w("  no design: " + d["_error"])
            continue
        w("CHOSEN: " + str(d.get("chosen", ""))[:300])
        w(str(d.get("one_paragraph", ""))[:1100])
        w("\nFROZEN PREDICTIONS")
        for p in d.get("frozen_predictions", []):
            w(f"  [{p.get('id')}] {str(p.get('statement'))[:260]}")
            if p.get("number"):
                w(f"        number: {str(p['number'])[:140]}")
            w(f"        refuted if: {str(p.get('refuted_if'))[:220]}")
            w(f"        tested by: {str(p.get('data_or_measurement'))[:160]}")
        w("PAPER IF: " + str(d.get("what_would_make_this_a_paper", ""))[:500])
        if d.get("physical_build"):
            w("BUILD: " + str(d["physical_build"])[:400])
        w("FIRST WEEK: " + " | ".join(str(x)[:90] for x in (d.get("first_week") or [])[:5]))
        w("RISKS: " + " | ".join(str(x)[:90] for x in (d.get("risks") or [])[:4]))
        if "_error" not in L:
            w(f"LAWS: {len(L.get('existing', []))} existing, {len(L.get('missing', []))} missing"
              f" | lawset {L.get('lawset_version')} | flags: {str(L.get('sorry_or_axiom_flags'))[:160]}")
            for e in (L.get("existing") or [])[:4]:
                w(f"   have  {str(e.get('theorem_or_def'))[:60]}  ({str(e.get('file'))[:52]})")
            for m in (L.get("missing") or [])[:6]:
                w(f"   need  {str(m.get('law'))[:70]}  [{str(m.get('difficulty')).split()[0]}]")


def specs(slugs):
    files = sorted(glob.glob(os.path.join(AGENTS, "spec-*.json")))
    for f in files:
        slug = os.path.basename(f)[5:-5]
        if slugs and slug not in slugs:
            continue
        d = load(os.path.basename(f))
        w("\n" + "=" * 100)
        w(f"SPECIALIST {slug}")
        if "_error" in d:
            w("  " + d["_error"])
            continue
        w(str(d.get("summary", ""))[:1200])
        w(f"\nfindings {len(d.get('findings', []))}, table rows {len(d.get('table', []))}, citations {len(d.get('citations', []))}")
        for r in (d.get("recommendations") or [])[:6]:
            w("  rec: " + str(r)[:240])
        for t in (d.get("table") or [])[:10]:
            w(f"  [{str(t.get('name'))[:34]}] {str(t.get('fields'))[:220]}")
        for x in (d.get("could_not_find") or [])[:4]:
            w("  gap: " + str(x)[:180])


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--specs" in sys.argv:
        specs(args)
    else:
        designs(args or SLUGS)
