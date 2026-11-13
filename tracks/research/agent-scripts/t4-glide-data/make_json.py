import json, os
S = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-data/expected_output.txt"
REPO = "https://github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds"
D = "D:/Users/ashenoy00000/delphi-work/data/glide-fauli/"
sc = "D:/Users/ashenoy00000/delphi-work/agents2/scripts/t4-glide-data/"


def F(claim, source, conf, q="", val=None):
    d = dict(claim=claim, source=source, confidence=conf, evidence_quote=q)
    if val:
        d['value'] = val
    return d


f = [
    F("Repository zip downloaded 2026-11-12T22:49:55Z: 3,065,098 bytes, sha256 c9c2d6617b120bd398c4e3e8e5e1a0e8bd4a82b7dbc5d73b0a551b1205fbe51b; GitHub master head commit 151df28f, committed 2019-07-22T13:07:28Z (GitHub API).", REPO + " (codeload zip, master)", "high", "", "3065098 bytes"),
    F("Per-file hashes of the 11 model pkl files; the three that earlier agents quoted (psi15 f24a01ae..., psi0 camber ca104417..., psi35 camber ca4ac77b...) match exactly.", S, "high", "sha256 f24a01ae2052a2504ce1cf27c9aa3eaac2bc4571557f201618a9865749398062 1769 model_data_camber_psi_15.0.pkl"),
    F("REPRODUCED. psi=35, mass key 2.16, mean descent speed by KL (n=3): 0.1257, 0.0888, 0.0737, 0.0676, 0.0674, 0.0693, 0.0710 m/s at KL 0.06, 0.60, 0.923, 1.20, 1.333, 1.50, 1.714. Scout reported 0.126/0.089/0.074/0.068/0.067/0.069/0.071.", S + " section [2]", "high", "  KL 1.200 key 2.16 n=3 U=0.0676 f=0.612"),
    F("REPRODUCED. psi=0, key 2.16 (n=10): 0.1678, 0.1137, 0.1011, 0.1258 m/s at KL 0.923, 1.714, 2.308, 3.0. Scout reported 0.168/0.114/0.101/0.126.", S + " section [3]", "high", "  KL 2.308 key 2.16 n=10 U=0.1011 f=1.398"),
    F("REPRODUCED. Control rotation 0.612 Hz and Strouhal f*0.06/U = 0.543 (scout: 0.612 Hz, 0.54).", S + " section [4]", "high", "   U=0.0676 f=0.612 St=f*0.06/U=0.543"),
    F("REPRODUCED. Stored BEM minimum Reynolds number, psi=15 file: 4352 at KL 1.805 (St 0.608, U 0.0725 m/s, f 0.736 Hz). Scout: 4352 at KL 1.81, U 0.0725, f 0.735.", S + " section [7]", "high", "model_data_camber_psi_15.0.pkl     n=40 minRe=4352 at KL=1.805 St=0.608  U=0.0725 f=0.736"),
    F("REPRODUCED. Other stored minima: psi=0 Re 4709-4710 at KL 2.04-2.05 (scout 4709 at 2.05); psi=35 Re 3900 at KL 1.315-1.340 (scout 3900 at 1.32-1.34).", S + " section [7]", "high", "model_data_psi_0.pkl               n=42 minRe=4709 at KL=2.050 St=0.735  U=0.0785 f=0.962"),
    F("REPRODUCED. Stored psi=15 predicted U (interpolated) at KL 0.95/1.34/1.73/2.11/2.5/2.89: 0.0942/0.0775/0.0726/0.0750/0.0823/0.0913 m/s. Scout: 0.094/0.077/0.073/0.075/0.082/0.091.", S + " section [8]", "high", "[8] stored psi=15 predicted U (interp): {0.95: 0.0942, 1.34: 0.0775, 1.73: 0.0726, 2.11: 0.075, 2.5: 0.0823, 2.89: 0.0913}"),
    F("REPRODUCED. Ratio psi=0 KL2.31 over psi=35 KL1.2 control: 1.495 in all_results_experiments.pkl (design: 1.50) and 1.395 in dict_all_results.pkl (design: 1.40). The two psi=0 series disagree by about 7 percent at the same nominal geometry.", S + " sections [5][6]", "high", "[5] ratio psi0 KL2.31 / psi35 KL1.2 (all_results_experiments): 1.495"),
    F("REPRODUCED. The bem.py port (sha256 f4d3088c..., copied unchanged) matches the three stored model files in Re to within 0.17 percent (design: 0.17). Max relative differences 0.0017, 0.0015, 0.0016.", S + " section [9]", "high", "  model_data_camber_psi_15.0.pkl max|rel| 0.0017"),
    F("REPRODUCED. BEM ratios to control: psi=15 KL1.73 1.111; psi=0 KL2.31 1.220; psi=55 KL0.95 0.902; disk rule psi=0 KL2.31 1.390 (design 1.391). Pitch ratios at psi=15 KL1.73: U(5)/U(15) 0.637, U(25)/U(15) 1.505 (design 0.637, 1.505). Continuous BEM optimum psi=15: KL 1.772, ratio 1.110.", S + " sections [10][11][14][15]", "high", "[15] pitch ratios psi15 KL1.73: U(5)/U(15) 0.637 ; U(25)/U(15) 1.505"),
    F("REPRODUCED within rounding. BEM RMS log error against public data: psi=35 0.047 on 6 non-control points (design 0.048; 0.044 if the zero-error control point is counted), psi=0 0.227 (design 0.227). Disk rule: 0.149 at psi=35 (design 0.149), 0.132 at psi=0 (design 0.133).", S + " sections [12][16]", "high", "[16] psi=35 RMS log err excluding the control point (6 pts): 0.047"),
    F("REPRODUCED. U squared against lead-mass key is linear with R2 0.992-0.997 in 10 of 11 series (design: same). The eleventh series (psi=35, rc=35, KL 1.71) has R2 0.888.", S + " section [13]", "high", "R2 range 0.888-0.997 over 11 series"),
    F("NEW. Control scatter: coefficient of variation of the three psi=35 KL=1.2 trials at the 2.16 key is 3.25 percent. Compare with the 6.5 percent BEM-versus-disk separation at psi=15 (1.111 vs 1.183, from the design file).", S + " section [17]", "medium", "[17] control replicate scatter (psi35 KL1.2, key 2.16) CV of 3 trials: 3.25 %"),
    F("Law library 1.8.1 tree contains vmin_le (Delphi/Scaling.lean line 136) and glide_range_le (Delphi/Flight.lean line 115); registry/lawsets/lawset-1.8.1.json exists. Found by grep only, not rebuilt.", "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/Scaling.lean", "medium", "theorem vmin_le {ρ S C Cmax W v : ℝ} (hρ : 0 < ρ) (hS : 0 < S) (hC : 0 < C) (hCmax : C ≤ Cmax) (hv : 0 ≤ v)"),
]
kc = [
    dict(claim="The public repo's per-trial data and stored model files are obtainable and byte-stable (hashes match the earlier agents' downloads), so the design's inputs exist as described.", source=S, evidence_quote=f[1]['evidence_quote']),
    dict(claim="The two headline data numbers reproduce: control U = 0.0676 m/s and psi=0 KL2.31 over control = 1.495 (1.395 in the second series).", source=S, evidence_quote=f[8]['evidence_quote']),
    dict(claim="The frozen BEM table reproduces from the saved port: stored psi=15 minimum Re 4352 at KL 1.805, port within 0.17 percent, pitch ratios 0.637 and 1.505.", source=S, evidence_quote=f[5]['evidence_quote']),
    dict(claim="The two published psi=0 series differ by about 7 percent at the same geometry, similar to the 6.5 percent BEM-vs-disk separation at psi=15, so base-angle discrimination at psi=15 rests on the psi=0 arm and the pitch axis.", source=S + " section [6]", evidence_quote="[6] ratio psi0 KL2.31 (dict_all_results, rc=26) / control: 1.395"),
]
hashes = [("all_results_experiments.pkl", 1595234, "4f010c757190cf7cb5172d60248fbf87acc0c1ba0905d3cc3ff62554f6a6be39"),
          ("dict_all_results.pkl", 89264, "871268c9c82980c15d1e3ce80f78963d24423c5bc9c2f4bfb57b8cb39dd0bfcd"),
          ("model_data_camber_psi_15.0.pkl", 1769, "f24a01ae2052a2504ce1cf27c9aa3eaac2bc4571557f201618a9865749398062"),
          ("model_data_camber_psi_0.0.pkl", 1541, "ca10441711caacd75f5829fd7df4432eaf01343177caba24d2104d0a74b1c16a"),
          ("model_data_camber_psi_35.0.pkl", 1807, "ca4ac77ba81e903fc8a375264ca3c23e07db7fd78952215425de1a0b86546c7d"),
          ("model_data_psi_0.pkl", 1261, "80fe5d228d2a8b5cb87c15d8b4e8257a2f6d0cc803a7c57f2c4e7dabc633f03c"),
          ("model_data_psi_35.pkl", 1237, "dc4cea3c93342f088365278c5a70ae9814f4ea5d20f76756535ed76dafd69d12")]
table = [dict(name="repo.zip", fields="bytes=3065098; sha256=c9c2d6617b120bd398c4e3e8e5e1a0e8bd4a82b7dbc5d73b0a551b1205fbe51b; date=2026-11-12; head=151df28f; path=" + D + "repo.zip", source=REPO + " (codeload zip, master)")]
for n, b, h in hashes:
    table.append(dict(name=n, fields="bytes=%d; sha256=%s; date=2026-11-12; path=%sx/EffectFoldAngleAutorotatingSeeds-master/model/%s" % (b, h, D, n), source=REPO + "/blob/master/model/" + n))
out = dict(
    label="t4-glide-data",
    topic="Track 4 data and reproducibility: whirling-fruit fold-angle data (Fauli, Rabault, Carlson)",
    summary="Downloaded the public repository (3,065,098 bytes, sha256 c9c2d661...e51b, 2026-11-12) to D:/Users/ashenoy00000/delphi-work/data/glide-fauli/ and re-ran an analysis. Every earlier-agent number I checked reproduced: control U 0.0676 m/s, the psi=0 and psi=35 speed tables, stored BEM minimum Re 4352 at KL 1.805, port error 0.17 percent, ratios 1.495 and 1.395 (data) vs 1.220 (BEM) vs 1.390 (disk rule), pitch ratios 0.637 and 1.505, RMS log errors 0.047 and 0.227, R2 0.992-0.997 in 10 of 11 series. Only differences are rounding (disk psi=0 RMS 0.132 vs 0.133; BEM psi=35 RMS 0.044 vs 0.048 if the control point is counted). The BEM is the design agent's port, so reproducing it checks the port and the data reading, not the physics; the physical predictions G1-G5 stay untested until fruits are built. Not checked: the meaning of the mass keys and the 1.2 g loading (inferred by the design agent).",
    lay_summary="We downloaded the real measurements that a research group published about 3D-printed spinning seed models falling through water. We then re-did the earlier team's arithmetic from scratch. Every number we checked came out the same, apart from tiny rounding differences. Think of it as re-adding a restaurant bill and getting the same total. This shows the earlier numbers were read correctly, but it does not show their physics idea is right. That needs real printed seeds dropped in a tank.",
    findings=f, key_claims=kc, table=table,
    glossary=[dict(term="descent speed", plain="how fast the seed model sinks at steady speed"),
              dict(term="fold angle (KL)", plain="how strongly each wing is curved"),
              dict(term="base angle (psi)", plain="the angle at which the wing root leaves the central pod"),
              dict(term="blade-element model", plain="a calculation that adds up the forces on many small slices of each wing"),
              dict(term="sha256", plain="a fingerprint of a file; any change to the file changes it"),
              dict(term="Reynolds number", plain="a number describing how smoothly or turbulently fluid flows past an object"),
              dict(term="Strouhal number", plain="spin rate scaled by size and speed"),
              dict(term="disk rule", plain="a simple rival rule: sink speed depends on the circle area swept by the wings")],
    reproduce=[
        dict(what="Fetch data (needs curl, unzip, sha256sum)", command_or_url="sh " + sc + "fetch.sh ./glide-fauli", expected="sha256 c9c2d6617b120bd398c4e3e8e5e1a0e8bd4a82b7dbc5d73b0a551b1205fbe51b, 3065098 bytes, provided GitHub master is still head 151df28f (2019-07-22)"),
        dict(what="Run analysis (Python 3.14.2, numpy 2.5.3, scipy 1.18.1; analyse.py and bem.py must sit in one folder)", command_or_url="python " + sc + "analyse.py ./glide-fauli/x/EffectFoldAngleAutorotatingSeeds-master/model/", expected="Output identical to " + sc + "expected_output.txt, e.g. [4] U=0.0676, [5] 1.495, [7] minRe=4352 at KL=1.805, [15] 0.637 / 1.505. Do not use python -I on this machine (numpy is in user site-packages); the unpickler is restricted to numpy array primitives in code."),
        dict(what="Verify bem.py unchanged", command_or_url="sha256sum " + sc + "bem.py", expected="f4d3088cc7d0516d69968bb085b44b18d4155624bec4a0f7a6a3485d5eb9c8dd")],
    citations=[],
    could_not_find=[
        "No literature citations were fetched in this run (task was data and reproducibility), so citations is empty; the earlier agents' DOIs are not re-verified here.",
        "The meaning of the mass keys and of the paper's 1.2 g loading is not documented in the repo and was not resolved; only the design agent's inference exists.",
        "bem.py is the design agent's port, copied not rewritten; agreement with the stored model files within 0.17 percent supports it, but I did not re-derive the equations from the paper.",
        "The FreeCAD CAD file and the letter's supplement were not opened or fetched.",
        "No raw video exists in the repo for these numbers, only per-trial summary values (u mean, f mean).",
        "Lead density 11.34 and any net immersed weight are unverified background from the design agent; not used by me.",
        "Law library 1.8.1: theorem names confirmed by grep only; no Lean build was run."],
    scripts_written=[sc + "fetch.sh", sc + "analyse.py", sc + "bem.py (unchanged copy of agents/scratch/design-glide/bem.py)", sc + "expected_output.txt", sc + "make_json.py"],
    recommendations=["Ask the repo authors what the mass keys denote before building; G1 depends on it.",
                     "Treat the psi=0 arm and the pitch axis as the discriminating tests, since the two published psi=0 series differ by 7 percent.",
                     "Base any law mapping on lawset 1.8.1, not 1.6.0."])
json.dump(out, open("D:/Users/ashenoy00000/delphi-work/agents2/t4-glide-data.json", "w"), indent=1, ensure_ascii=False)
print(len(json.dumps(out)))
