# #31 .life format: genome to locomotion, light sensors, validation toolchain
Goes to: organism-format/life/PROPOSAL-behaviour.md
Status: PARTLY. Gap confirmed by grep; extension drafted, not implemented and not tested.

Checked 2026-11-13: a grep for sensor|locomot|behav|trigger|light in organism-format/life/README.md and organism-format/life/spec.mjs returns no line. So .life has no vocabulary for sensing or movement. What the folder has: genome handling (fasta.mjs), geometry (stl.mjs), atlas.mjs, compare.mjs, read/write, each with a test file. I did not read those modules line by line.

## Proposed block (draft; every value keeps the format's mandatory kind and scope)

    "behaviour": {
      "sensors": [{
        "id": "s1", "modality": "light",
        "band_nm": {"v": [450, 490], "kind": "assumed", "scope": "..."},
        "genome_ref": "edit:<id of the light-sensitive-protein edit in the edit list>",
        "tissue_ref": "atlas:<cell type>"
      }],
      "actuators": [{
        "id": "a1", "type": "muscle|cilia",
        "tissue_ref": "atlas:<cell type>", "geometry_ref": "stl:<part>"
      }],
      "rules": [{
        "when": {"sensor": "s1", "above": {"v": null, "unknown": true, "kind": "not-established",
                 "why": "no threshold measured",
                 "what_would_resolve_it": "movement versus irradiance dose-response", "scope": "..."}},
        "then": {"actuator": "a1", "response": "contract"},
        "latency_s": {"v": null, "unknown": true, "kind": "not-established",
                      "why": "...", "what_would_resolve_it": "...", "scope": "..."}
      }]
    }

The band 450-490 nm is a placeholder of kind "assumed", not a sourced number.

Reader rules to add:
1. Refuse a rule whose sensor or actuator id is undeclared.
2. Refuse a sensor with no genome_ref (a sensor with no gene behind it is the laundering the format forbids).
3. Exclude from "simulate" any rule with a not-established field, as for other values.

## End-to-end validation chain (each step is a refusal point)
1. read.mjs: kinds, scopes, references resolve.
2. fasta.mjs: each genome_ref edit applies to the named assembly.
3. atlas.mjs: tissue_ref exists at the stated stage.
4. stl.mjs: actuator geometry is a closed mesh.
5. NEW test-behaviour.mjs: rule graph has no dangling ids; with --fail-once a planted dangling id must be caught.
6. Simulating the movement itself: out of scope for now. No measured threshold or latency exists in the repo, so a simulator would run on not-established values, which the format forbids.

Steps 2 to 4 state what those modules would need to do; whether they already do it is unverified.

Evidence limit: the project record (pp-meeting-notes-decoder.json) found no published light-steered xenobot; the cited one (doi:10.1126/scirobotics.abf1571, not re-opened today) records light exposure and does not steer movement.
