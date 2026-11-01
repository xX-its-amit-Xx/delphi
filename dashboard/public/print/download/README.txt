WINGED ZEBRAFISH — STL FILES
LeanBio Forum / DELPHI, ScienceClaw Hack @ MIT, 2026-11-01

Units are MILLIMETRES in every file.

WHAT THIS IS, AND WHAT IT IS NOT
--------------------------------
This is a HYPOTHETICAL design: a zebrafish body carrying pectoral fins scaled to a
flying fish's proportions. The fin proportion is MEASURED (flying-fish median
pectoral length / standard length = 0.687, Daane 2021 Data S1A, n = 49); the
TRANSFER of that proportion onto a zebrafish body is a hypothesis, not an
observation. No animal like this exists.

Our own validator REFUSES this design. The physics check says it cannot leave the
water: launch 0.67 m/s against 8.64 m/s required, with lifting area 166x too small.
That refusal is the point of the project, so please do not treat these files as a
model of something that flies.

The body geometry outside the fins is SCHEMATIC, not measured anatomy.


1-full-prototype/
-----------------
  winged-zebrafish-whole-120mm.stl           whole animal, 120 mm standard length
  winged-zebrafish-glider-120mm.stl          hollowed body (1.5 mm wall), solid fins
                                             (1.8 mm), open nose bore for ballast
  winged-zebrafish-whole-1to1-38.8mm.stl     whole animal at life size (38.8 mm SL)
  winged-zebrafish-ff-fins-solid-1to1-38.8mm.stl   solid 1:1, flying-fish fins
  parts-INFO.json                            scale factors, bounding boxes, volumes,
                                             centre of mass, triangle counts

  Measured on the mesh at 120 mm: solid volume 35.751 cm3; glider 14.711 cm3;
  pectoral planform (both fins) 1.18467e-3 m2.


2-assembly-kit-1to1-starter/   <- START HERE if you are printing to assemble
-------------------------------
  Ten numbered parts, 1:1, designed to snap together in order 01 -> 10:

    01/02  body case, left and right half
    03     axial spine
    04     cranium block
    05/06  pectoral fin plate, left and right
    07     viscera organ block
    08/09  myotome muscle, left and right
    10     caudal fin plate

  FIT-TEST-COUPON__peg1.4mm__clearance-0.05-to-0.16.stl
    PRINT THIS FIRST. It is watertight and carries 1.4 mm pegs at clearances from
    0.05 to 0.16 mm. Find the clearance your printer actually holds before
    committing to the ten parts — the snap fits depend on it.

  All ten parts pass the printability check. There is a measured 3.8% size mismatch
  between the design and the first printed set; it is recorded rather than corrected.


3-assembly-kit-120mm/
---------------------
  Fifty-six parts at 120 mm, split along the anatomical containment hierarchy
  (system -> organ -> tissue) rather than for ease of assembly. This is the
  teaching/exploded set, not the snap-together one. All 56 pass the check.


BEFORE YOU PRINT
----------------
* Run the fit-test coupon first (kit 2). Everything else depends on it.
* FIN MEMBRANES ARE ZERO-THICKNESS SURFACES in the whole-animal meshes and must be
  thickened before printing. The glider variant already has solid 1.8 mm fins.
* Mesh clean-up was merge-by-distance and normals-outside ONLY. There is no manifold
  repair, so where non-manifold edges remain the signed volume is approximate.
* The centre of mass in parts-INFO.json is an area-weighted surface centroid — a
  uniform-shell approximation, not a solid centroid.
* A superseded 100-part "legacy" set exists and is NOT included here: its fin ratio
  (0.35) was chosen rather than measured.


MORE
----
  Print kit, viewer and per-part downloads:
    https://delphi-mission-control.ashenoy000.workers.dev/print/
  What the design is and why the validator refuses it:
    https://delphi-mission-control.ashenoy000.workers.dev/docs/#harness
  The project:
    https://delphi-mission-control.ashenoy000.workers.dev/docs/
