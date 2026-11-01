# sim-engine/sessions

Runtime storage for the Design Studio tools (`tools/studio.mjs`). Everything here except this README is
gitignored (`sim-engine/.gitignore`).

- `<session-id>.jsonl`: one co-design session, append-only. Line 0 is `{type: "open", title, organism,
  author, lawset_version}`; every later line is a `comment`, `proposal` (an edit that was validated but
  not applied) or `edit` (applied to the session's organism, with the Lean violations at that moment and
  the lawset version used). Lines are never rewritten.
- `organisms/<id>.json`: saved organism documents (`organism_create`, `organism_edit`).

Authors are role labels (`human`, `agent:physics`), never names or e-mail addresses; the tools refuse
anything else. Tests write to a throwaway directory under `C:\Temp` via `STUDIO_SESSIONS_DIR`, never here.
