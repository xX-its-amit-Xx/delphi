"""Find what a term meant in earlier sessions, from their saved transcripts.

    python tracks/scripts/find-in-transcripts.py sentry [--max 40] [--dirs pycharm,vscode]

Each transcript is a JSONL of messages. This prints, for every hit, the transcript, the role, and a
window of text around the match, collapsed to one line. Credentials are masked in the output: any
token-shaped string is replaced before printing, because transcripts are where keys get pasted.
"""
import glob
import json
import os
import re
import sys

BASE = "D:/Users/ashenoy00000"
DIRS = {"antigravity": ".claude-antigravity", "pycharm": ".claude-pycharm", "vscode": ".claude-vscode",
        "default": ".claude", "developer": ".claude-developer", "cursor": ".claude-cursor", "devin": ".claude-devin"}
SECRET = re.compile(r"(gh[pousr]_[A-Za-z0-9]{20,}|nvapi-[A-Za-z0-9_\-]{20,}|gsk_[A-Za-z0-9]{20,}|bak-[A-Za-z0-9_\-]{20,}"
                    r"|frontier-[A-Za-z0-9_\-]{20,}|sk-[A-Za-z0-9_\-]{20,}|AIza[0-9A-Za-z_\-]{20,}|Bearer\s+[A-Za-z0-9._\-]{20,})")


def text_of(msg):
    c = msg.get("message", {}).get("content") if isinstance(msg.get("message"), dict) else msg.get("content")
    if isinstance(c, str):
        return c
    out = []
    for b in c or []:
        if isinstance(b, dict):
            out.append(str(b.get("text") or b.get("input") or b.get("content") or ""))
    return " ".join(out)


def main():
    term = sys.argv[1]
    mx = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 40
    which = sys.argv[sys.argv.index("--dirs") + 1].split(",") if "--dirs" in sys.argv else list(DIRS)
    pat = re.compile(re.escape(term), re.I)
    # --need REGEX keeps only hits whose window also matches it. A common word has many meanings (here:
    # a game sprite, a package name, a base64 blob) and the one wanted is found by what sits beside it.
    need = re.compile(sys.argv[sys.argv.index("--need") + 1], re.I) if "--need" in sys.argv else None
    shown = 0
    for k in which:
        for f in sorted(glob.glob(f"{BASE}/{DIRS[k]}/projects/*/*.jsonl"), key=os.path.getmtime, reverse=True):
            try:
                lines = open(f, encoding="utf-8", errors="replace").read().splitlines()
            except Exception:
                continue
            for i, ln in enumerate(lines):
                if not pat.search(ln):
                    continue
                try:
                    d = json.loads(ln)
                except Exception:
                    continue
                t = " ".join(text_of(d).split())
                m = pat.search(t)
                if not m:
                    continue
                win = SECRET.sub("<masked>", t[max(0, m.start() - 220): m.end() + 320])
                if need and not need.search(win):
                    continue
                if re.search(r"[A-Za-z0-9+/]{60,}", win):
                    continue  # base64 and similar blobs match any word by accident
                proj = os.path.basename(os.path.dirname(f))[-46:]
                sys.stdout.buffer.write(f"[{k}] {proj} #{i} {d.get('type', '?')}\n    ...{win}...\n".encode("utf-8", "replace"))
                shown += 1
                if shown >= mx:
                    return


if __name__ == "__main__":
    main()
