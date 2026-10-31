# anatomy-model: segmented flying fish (Exocoetidae)

A generic flying fish with enlarged pectoral fins, built as a "textbook cutaway" for the blueprint
viewer. Every anatomical piece is its own named mesh, so the viewer can click, hide, ghost and fly
to each piece. The left and right halves are separate objects, so the fish can be split sagittally.

| file | what |
|---|---|
| `build_fish.py` | the whole model as one reproducible bpy script (no GUI steps, no external meshes) |
| `manifest.json` | one entry per mesh object: name, label, ontology id, level, organ system, layer, side, colour, geometry basis |
| `../dashboard/public/blueprint3d/model/flying-fish.glb` | the exported model (the script writes it) |
| `../dashboard/public/blueprint3d/model/manifest.json` | copy of the manifest next to the GLB |

## Rebuild

Blender **4.2.23 LTS** (Windows x64 portable zip `blender-4.2.23-windows-x64.zip`, sha256
`82e791475779a7342424a480bdde9a20b43710da9264c60346125aa16cd910cb`; it matches the release's own
`blender-4.2.23.sha256`). download.blender.org served a Cloudflare challenge to curl, so the zip
came from the official mirror `mirrors.ocf.berkeley.edu/blender/release/Blender4.2/` and was
checked against that hash. It is unpacked at `C:\Temp\tools\blender\`.

```
C:\Temp\tools\blender\blender-4.2.23-windows-x64\blender.exe -b --factory-startup ^
    --python anatomy-model\build_fish.py -- [--no-render] [--samples 24] ^
    [--glb PATH] [--manifest PATH] [--renders C:\Temp\fish-models\renders]
```

Run it from the repo root. The build takes about 4 s. With the 7 preview renders (Cycles CPU, 24
samples, denoised) it takes about 15 s. The script also checks that every internal object stays
inside the skin surface and prints `INSIDE_CHECK OK`. The vent end of the intestine is exempt.

## Axes and scale

- GLB: glTF Y-up. Head at **+X**, back at **+Y**, the fish's **left side at -Z**.
- Standard length (snout to caudal fin base) is 0.82 units. Total length is about 0.97 units.
  The pectoral wingspan is about 1.0 unit.
- Each object's origin is at its bounding-box centre. `centre_gltf` in the manifest gives that
  centre.
- glTF node extras carry `label`, `ontology_id`, `layer`, `side`, `organ_system` and `level`.

## Objects (110)

- **outer** (11): `skin_L/R` (a shell with blue back to silver belly in vertex colours, plus a
  procedural scale normal map), `eye_L/R`, fin membranes `pectoral_fin_L/R`, `pelvic_fin_L/R`,
  `dorsal_fin`, `anal_fin`, `caudal_fin` (forked, lower lobe longer).
- **muscle** (2): `muscle_L/R`. Each is 32 W-shaped myomere bands (illustrative count).
- **skeleton** (83): `vertebra_01..40` (centrum plus neural spine, and a haemal spine on caudal
  vertebrae), `ribs_L/R`, `skull_L/R` (simplified skull roof with orbit openings),
  `cleithrum_L/R`, `scapula_L/R`, `coracoid_L/R`, `pectoral_fin_ray_L/R_01..14` (individual
  lepidotrichia), and one ray object for each other fin.
- **organ** (14): `brain`, `spinal_cord`, `gills_L/R`, `heart`, `oesophagus`, `intestine`, `liver`,
  `swim_bladder`, `kidney`, `head_kidney`, `gonad_L/R`, `spleen`.

Colours: the skin is dark blue on the back grading to silver sides and belly. Muscle is pinkish
red (#D9727A) and bone is ivory (#F2EAD3). Organs are coloured by system: nervous #F2C14E,
respiratory #B5174B, circulatory #D32F2F, liver #8D4E2A, gut #E8A87C, swim bladder #DCE3E8,
renal #26A69A, reproductive #F6B26B, spleen #6D214F. Fin membranes are #4E6E8E at alpha 0.82
(BLEND). The skin and eye materials have a white base factor; their colour is in `COLOR_0`.

## Evidence-backed vs schematic

**Evidence-backed (one proportion only):** pectoral fin length / standard length = **0.687**. This
is the median of 49 flying-fish specimens in Daane et al. 2021, Curr Biol, Data S1A, recomputed in
`genotype/cache/daane2021_fin_ratios.json`. The script reads the value from that file. The
straight base-to-tip length of the longest pectoral ray is set to exactly 0.687 SL on both sides,
and the manifest records the measured value. Caveat: the data are lengths from preserved museum
specimens. They say nothing about fin area, outline or spread.

**Schematic (everything else):** body depth (about 0.17 SL) and width, head shape, the positions
and sizes of all other fins (the pelvic fin is 0.22 SL; the caudal lobes are 0.19 and 0.27 SL),
the fin spread pose, and all organ shapes, sizes and positions. All counts are illustrative, not
flying-fish data: 40 vertebrae, 32 myomeres, 14 pectoral rays, 6 pelvic rays, 12 dorsal rays,
11 anal rays, 19 caudal rays and 4 gill arches. No stomach is modelled, because beloniform fishes
are generally described as stomachless. That is a textbook statement that has not been checked
against our data.

## Ontology mapping

Ids were looked up in `dashboard/public/blueprint3d/data.json` (`terms`) and in
`genotype/fin-subtree.json` (ZFA nodes with Uberon xrefs). None were guessed. They are written in
the `UBERON_xxxxxxx` form that `data.json` uses, and `zfa_id` is added where the fin subtree has
one. When neither file has a node, `ontology_id` is `null`, and `nearest_ancestor_in_files` names
the closest broader node that does exist.

| object(s) | ontology_id | source |
|---|---|---|
| skin_L/R | UBERON_0002097 skin of body | data.json |
| eye_L/R | UBERON_0000970 eye | data.json |
| pectoral_fin_L/R | UBERON_0000151 pectoral fin (ZFA:0001161) | both |
| pectoral_fin_ray_* | UBERON_4000175 pectoral fin lepidotrichium (ZFA:0001551) | fin-subtree |
| cleithrum_L/R | UBERON_0004741 (ZFA:0000184) | fin-subtree |
| scapula_L/R | UBERON_0006849 (ZFA:0000583) | fin-subtree |
| coracoid_L/R | UBERON_0004743 (ZFA:0000332) | fin-subtree |
| brain | UBERON_0000955 | data.json |
| spinal_cord | UBERON_0002240 | data.json |
| heart | UBERON_0000948 | data.json |
| oesophagus | UBERON_0001043 esophagus | data.json |
| liver | UBERON_0002107 | data.json |
| kidney | UBERON_0002113 | data.json |
| head_kidney | UBERON_0007132 | data.json |
| gonad_L/R | UBERON_0000991 | data.json |
| spleen | UBERON_0002106 | data.json |
| **null**: pelvic, dorsal, anal and caudal fins and their rays; muscle_L/R (no myotome node); vertebra_01..40, ribs, skull (only the generic "skeletal element" node exists); gills_L/R (nearest: respiration organ UBERON_0000171); intestine (the files have only mammalian small/large intestine); swim_bladder | null | not in either file |
