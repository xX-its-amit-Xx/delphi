"""Procedural, segmented 3D model of a zebrafish (Danio rerio) LARVA at about 4-5 dpf, at the onset of swim
bladder inflation, for the DELPHI blueprint viewer.

Run headless with Blender 4.2.23 LTS, from the repo root:

    blender.exe -b --factory-startup --python anatomy-model/zebrafish/build_larva.py -- \
        [--glb PATH] [--manifest PATH] [--renders DIR] [--no-render] [--samples N] [--only a,b]

The stage is the one where several of our measured knobs live (hhip pectoral fin area at 72 hpf; prdm1a cleithrum,
endoskeletal disc and fin fold at 4 dpf). The model therefore draws the pectoral fin as its parts: cleithrum,
endoskeletal disc, fin musculature, fin fold and actinotrichia.

Shares the toolkit in build_adult.py (imported; its main() does not run). Proportions with a source come from
sources.json ("values", prefix "larva."); everything else is schematic and the manifest says so per piece.
Coordinates while building (Blender, Z up): head at +X, back at +Z, the fish's LEFT side at +Y; GLB is Y-up.
"""
import os
import sys
import math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_adult as T  # noqa: E402  (toolkit)
from build_adult import (MB, SIDES, SCHEMATIC, side_word, tube, spline, ellipsoid_world, unit_sphere, slab,  # noqa
                         srgb_lin, lerp3, smooth, grid_faces)
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

PAL = {
    "skin": "#EDE6D0", "eye": "#202024", "lens": "#E8EEF2", "finfold": "#F1EDE2", "actino": "#D9D2BC",
    "melano": "#1A1410", "neuromast": "#F5F0D8",
    "muscle": "#D7A7A2", "finmuscle": "#CF9890", "notochord": "#E9F0F2", "cartilage": "#B7CFE6",
    "nervous": "#F2C14E", "sensory": "#9FA8DA", "otolith": "#FFFFFF", "circulatory": "#D32F2F", "atrium": "#B71C1C",
    "bulbus": "#EF9A9A", "aorta": "#E53935", "vein": "#5C6BC0", "yolk": "#F2C46D", "liver": "#8D4E2A",
    "gut": "#E8A87C", "gut2": "#E09A6B", "pancreas": "#F3D9A4", "bladder": "#DCE3E8", "renal": "#26A69A",
}


class Larva:
    def __init__(self):
        self.V = T.Values("larva.")
        V = self.V
        calls = T.load_json("calls.json")
        self.reg = T.Registry(calls["zfa_table"], T.SYS, None)
        self.mats = T.Mats(PAL)
        self.SLmm = V.get("reference_SL_mm", 3.5)
        self.HN = V.get("depth_at_nape_over_SL", 0.13)
        self.HL = V.get("head_length_over_SL", 0.24)
        self.ED = V.get("eye_diameter_over_SL", 0.09)
        self.SVL = V.get("snout_vent_over_SL", 0.57)
        self.N_SOM = int(V.get("somite_pairs", 32))
        self.PECT = V.get("pectoral_fin_length_over_SL", 0.13)
        self.SL = 0.88
        self.X0 = 0.46
        HN = self.HN
        nape = self.HL - 0.03
        # half depth (fraction of SL): head, nape (sourced depth), yolk bulge, trunk, tail to the notochord tip
        hd_ctrl = [(0.0, 0.025), (0.05, 0.045), (0.12, 0.057), (nape, HN / 2), (0.27, 0.078), (0.32, 0.084),
                   (0.38, 0.071), (0.45, 0.055), (self.SVL, 0.046), (0.75, 0.034), (0.90, 0.020), (1.0, 0.008)]
        zc_ctrl = [(0.0, 0.004), (0.12, 0.0), (nape, -0.004), (0.27, -0.015), (0.32, -0.021), (0.38, -0.013),
                   (0.45, -0.006), (self.SVL, -0.003), (0.80, 0.0), (1.0, 0.0)]
        hw_ctrl = [(0.0, 0.030), (0.06, 0.054), (0.12, 0.064), (0.20, 0.058), (0.30, 0.060), (0.40, 0.040),
                   (0.50, 0.029), (0.65, 0.021), (0.85, 0.012), (1.0, 0.005)]
        self.body = T.Body(self.X0, self.SL, hd_ctrl, hw_ctrl, zc_ctrl, nexp=2.0, egg=0.05, nose=0.03, t_end=1.012)
        self.YOLK_T = 0.315

    def M(self, *a, **k):
        return self.reg.meta(*a, **k)

    def mk(self, *a, **k):
        k.setdefault("pal", PAL)
        return self.reg.mk(*a, **k)

    # notochord centre height (normalized nz) and radius (units)
    def noto_nz(self, t):
        return 0.30 - 0.30 * smooth(0.40, 0.75, t)

    def noto_r(self, t):
        return self.SL * (0.0175 - 0.012 * smooth(0.55, 1.0, t))

    def noto_world(self, t):
        return np.array(self.body.world(t, 0.0, self.noto_nz(t)))

    # ------------------------------------------------------------------ outer
    def build_skin(self):
        b = self.body
        mat = self.mats.get("skin", alpha=0.16, rough=0.25, vcol=True)
        NU, NV = 120, 48
        ts = np.concatenate([np.linspace(0.0, 1.0, NU - 6), np.linspace(1.0, b.t_end, 7)[1:]])
        ths = np.linspace(-math.pi / 2, math.pi / 2, NV)
        for sd, sg in SIDES:
            V, C = [], []
            for t in ts:
                for th in ths:
                    V.append(b.pt(t, th, 1.0, sg))
                    nz = b.section(th)[1]
                    c = srgb_lin((0.94, 0.91, 0.82))
                    if 0.24 < t < 0.40 and nz < -0.2:   # yolk shows yellow through the thin skin
                        c = lerp3(c, srgb_lin((0.96, 0.84, 0.55)), 0.5)
                    C.append(c)
            self.mk("skin_" + sd, MB().add(V, grid_faces(len(ts), NV, flip=sg < 0), None, C), mat,
                    self.M("skin (larval epidermis, nearly transparent), %s half" % side_word(sd), "ZFA:0000368",
                           "organ", "integument", "outer", sd,
                           basis=self.V.basis_or(["depth_at_nape_over_SL", "head_length_over_SL", "snout_vent_over_SL"],
                                                 "outline elsewhere (yolk bulge, trunk and tail taper, width) schematic"),
                           note="material alpha 0.16: the larva is transparent; no scales at this stage",
                           colour="vertex colours (COLOR_0): #F0E8D2, warmer #F5D6A2 over the yolk; material factor "
                                  "white, alpha 0.16"),
                    closed=False, solidify=0.0010, solid_offset=-1.0,
                    outward_axis=lambda c: Vector((c.x, 0.0, self.body.zc(self.body.x_to_t(c.x)))))

    def build_eyes(self):
        b = self.body
        mat = self.mats.get("eye", metallic=0.3, rough=0.3, vcol=True)
        lm = self.mats.get("lens", rough=0.1, metallic=0.1)
        re = self.ED * self.SL / 2
        te = 0.105
        self.EYE = {}
        for sd, sg in SIDES:
            c = (b.x(te), sg * b.hw(te) * 0.55, b.zc(te) + 0.10 * b.hd(te))
            self.EYE[sd] = (c, re)
            Vs, F = unit_sphere(20, 32)
            V = [(c[0] + q[0] * re, c[1] + sg * q[2] * re * 0.80, c[2] + q[1] * re * 0.95) for q in Vs]
            if sg < 0:
                F = [tuple(reversed(f)) for f in F]
            C = []
            for q in Vs:
                lat = q[2]
                if lat > 0.80:
                    C.append(srgb_lin((0.05, 0.05, 0.06)))           # pupil over the lens
                elif lat > 0.25:
                    C.append(lerp3(srgb_lin((0.62, 0.58, 0.40)), srgb_lin((0.10, 0.10, 0.12)),
                                   smooth(0.70, 0.30, lat)))        # iridophores of the iris over dark retina
                else:
                    C.append(srgb_lin((0.08, 0.08, 0.10)))           # pigmented retina (RPE)
            self.mk("eye_" + sd, MB().add(V, F, None, C), mat,
                    self.M("eye, %s" % side_word(sd), "ZFA:0000107", "organ", "sensory", "outer", sd,
                           basis=self.V.basis_or(["eye_diameter_over_SL"], "position schematic"),
                           note="eye diameter = %.3f SL (Parichy 2009 regression at 3.5 mm SL; direct 96-120 hpf "
                                "measurements are smaller, see sources.json cross_checks)" % self.ED,
                           colour="vertex colours (COLOR_0): black retina #141418, golden iridophores #CFC6A8, pupil "
                                  "#0D0D10; material factor white"))
            lc = (c[0] + re * 0.05, c[1] + sg * re * 0.44, c[2])
            self.mk("lens_" + sd, MB().add(*ellipsoid_world(lc, (re * 0.36, re * 0.30, re * 0.36), 10, 16)), lm,
                    self.M("lens, %s" % side_word(sd), "ZFA:0000035", "organ", "sensory", "organ", sd, basis=SCHEMATIC))

    def melanophore(self, mb, p, size, normal_axis, rng):
        """a flattened dendritic pigment cell: body + 4 short arms in the plane perpendicular to normal_axis"""
        n = np.asarray(normal_axis, dtype=float)
        n /= np.linalg.norm(n)
        u = np.cross(n, [1.0, 0, 0] if abs(n[0]) < 0.9 else [0, 1.0, 0])
        u /= np.linalg.norm(u)
        w = np.cross(n, u)
        p = np.asarray(p, dtype=float)
        V, F = unit_sphere(5, 8)
        mb.add([tuple(p + q[0] * size * u + q[1] * size * w + q[2] * size * 0.35 * n) for q in V], F)
        for k in range(4):
            a = rng.uniform(0, 2 * math.pi)
            d = math.cos(a) * u + math.sin(a) * w
            L = size * rng.uniform(1.5, 2.6)
            mb.add(*tube([p, p + d * L * 0.5, p + d * L], [size * 0.30, size * 0.18, size * 0.06], 4))

    def build_pigment_and_lateral_line(self):
        b = self.body
        mm = self.mats.get("melano", rough=0.6)
        rng = np.random.default_rng(11)
        sz = 0.0026
        # dorsal stripe: along the dorsal edge of the myotomes, both sides of the midline
        mb = MB()
        for t in np.linspace(0.20, 0.93, 26):
            for sg in (1, -1):
                p = b.world(t + rng.uniform(-0.006, 0.006), 0.20 * sg, 0.93)
                self.melanophore(mb, p, sz * (0.8 + 0.4 * rng.random()), (0, 0.3 * sg, 1), rng)
        self.mk("melanophore_stripe_dorsal", mb, mm,
                self.M("dorsal larval melanophore stripe", "ZFA:0005221", "tissue", "integument", "outer", "mid",
                       basis="sourced: Parichy et al. 2009 (stripes along the dorsal and ventral edges of the myotomes, "
                             "at the horizontal myoseptum, and lining the dorsal and ventral yolk sac); cell count, "
                             "size and spacing schematic"), inside=1.35)
        mb = MB()
        for t in np.linspace(self.YOLK_T + 0.10, 0.93, 22):
            for sg in (1, -1):
                p = b.world(t + rng.uniform(-0.006, 0.006), 0.18 * sg, -0.93)
                self.melanophore(mb, p, sz * (0.8 + 0.4 * rng.random()), (0, 0.3 * sg, -1), rng)
        self.mk("melanophore_stripe_ventral", mb, mm,
                self.M("ventral larval melanophore stripe", "ZFA:0005222", "tissue", "integument", "outer", "mid",
                       basis="sourced: Parichy et al. 2009 (stripe pattern); cell count, size and spacing schematic"),
                inside=1.35)
        for sd, sg in SIDES:
            mb = MB()
            for t in np.linspace(0.36, 0.92, 7):
                nz = self.noto_nz(t)
                ny = math.sqrt(max(1 - nz * nz, 0)) * 0.94 * sg
                self.melanophore(mb, b.world(t, ny, nz), sz * 0.9, (0, sg, 0), rng)
            self.mk("melanophore_stripe_lateral_" + sd, mb, mm,
                    self.M("lateral larval melanophore stripe (horizontal myoseptum), %s" % side_word(sd), "ZFA:0005223",
                           "tissue", "integument", "outer", sd,
                           basis="sourced: Parichy et al. 2009 (stripe at the horizontal myoseptum); sparse cell count "
                                 "schematic"), inside=1.15)
        mb = MB()
        yc, yr = self.yolk_geom()
        for k in range(18):
            a = 2 * math.pi * k / 18
            for top in (0, 1):
                d = np.array([math.cos(a) * 0.9, math.sin(a) * 0.9, -0.45 if top == 0 else 0.35])
                d /= np.linalg.norm(d)
                p = np.array(yc) + d * np.array(yr) * 1.04
                if top == 1 and k % 2:
                    continue
                self.melanophore(mb, p, sz * 0.9, d, rng)
        self.mk("melanophore_stripe_yolk", mb, mm,
                self.M("yolk larval melanophore stripe (on the yolk sac)", "ZFA:0005224", "tissue", "integument",
                       "outer", "mid", basis="sourced: Parichy et al. 2009 (melanophores lining the dorsal and ventral "
                                             "surfaces of the yolk sac); cell positions schematic"), inside=1.05)
        nm = self.mats.get("neuromast", rough=0.4)
        for sd, sg in SIDES:
            mb = MB()
            for t in list(np.linspace(0.30, 0.92, 7)) + [0.985]:
                nz = self.noto_nz(t)
                ny = math.sqrt(max(1 - nz * nz, 0)) * 1.0 * sg
                mb.add(*ellipsoid_world(b.world(t, ny, nz), (0.0028, 0.0018, 0.0028), 6, 10))
            self.mk("lateral_line_neuromasts_" + sd, mb, nm,
                    self.M("posterior lateral line neuromasts, %s" % side_word(sd), "ZFA:0000940", "organ", "sensory",
                           "outer", sd, basis=SCHEMATIC + "; 7 trunk neuromasts plus a terminal one, count and spacing "
                                                         "illustrative"))

    def build_median_fin_fold(self):
        b, SL = self.body, self.SL
        mat = self.mats.get("finfold", alpha=0.26, rough=0.35, vcol=True)
        TD0, TV0 = 0.30, 0.45
        hD = T.curve1d([(TD0, 0.0), (0.40, 0.018), (0.60, 0.034), (0.85, 0.050), (1.0, 0.060)])
        hV = T.curve1d([(TV0, 0.0), (0.50, 0.010), (self.SVL, 0.024), (0.75, 0.040), (0.90, 0.052), (1.0, 0.060)])
        inner, outer = [], []
        for t in np.linspace(TD0, 0.995, 46):
            z0 = b.zc(t) + b.hd(t) * 0.80
            inner.append((b.x(t), 0.0, z0))
            outer.append((b.x(t), 0.0, z0 + hD(t) * SL + b.hd(t) * 0.2))
        tip = np.array([b.x(1.0), 0.0, b.zc(1.0)])
        for a in np.linspace(80, -80, 21)[1:-1]:
            r = (0.060 + 0.016 * math.cos(math.radians(a)) ** 2) * SL
            inner.append(tuple(tip))
            outer.append(tuple(tip + r * np.array([-math.cos(math.radians(a)), 0, math.sin(math.radians(a))])))
        for t in np.linspace(0.995, TV0, 40):
            z0 = b.zc(t) - b.hd(t) * 0.80
            inner.append((b.x(t), 0.0, z0))
            outer.append((b.x(t), 0.0, z0 - hV(t) * SL - b.hd(t) * 0.2))
        n = len(inner)
        M = 6
        V, C = [], []
        for i in range(n):
            pi_, po = np.array(inner[i]), np.array(outer[i])
            for j in range(M):
                f = j / (M - 1)
                V.append(tuple(pi_ + (po - pi_) * f))
                C.append(lerp3(srgb_lin((0.95, 0.93, 0.86)), srgb_lin((0.86, 0.84, 0.78)), f))
        self.mk("median_fin_fold", MB().add(V, grid_faces(n, M), None, C), mat,
                self.M("median fin fold (continuous dorsal, caudal and ventral larval fin fold)", "ZFA:0000040", "organ",
                       "fin", "outer", "mid",
                       basis=SCHEMATIC + "; continuous fold as described for the pSB stage by Parichy et al. 2009 "
                                         "('complete fin fold'); heights and extent schematic",
                       note="dorsal part begins at %.2f SL, ventral part reaches forward to %.2f SL (preanal fold); "
                            "translucent (alpha 0.26)" % (TD0, TV0),
                       colour="vertex colours (COLOR_0): #F3EEDF to #DCD6C5 at the edge; material factor white, "
                              "alpha 0.26"),
                closed=False, solidify=0.0007, solid_offset=0.0)
        # actinotrichia: fine unsegmented fibrils in the outer part of the fold
        am = self.mats.get("actino", rough=0.5)
        mb = MB()
        for i in range(2, n - 2, 2):
            pi_, po = np.array(inner[i]), np.array(outer[i])
            if np.linalg.norm(po - pi_) < 0.006:
                continue
            a0 = pi_ + (po - pi_) * 0.30
            a1 = po - (po - pi_) * 0.04 + np.array([-0.35 * np.linalg.norm(po - pi_), 0, 0]) * (1 if i < n - 40 else 0)
            mb.add(*tube([a0, a1], [0.00040, 0.00016], 4))
        self.mk("median_fin_fold_actinotrichia", mb, am,
                self.M("actinotrichia of the median fin fold", "ZFA:0005435", "tissue", "skeletal", "skeleton", "mid",
                       basis=SCHEMATIC + "; fibril count and spacing illustrative"))

    # ------------------------------------------------------------------ pectoral fin, in parts
    def build_pectoral_fins(self):
        b, SL = self.body, self.SL
        L = self.PECT * SL
        mfold = self.mats.get("finfold", alpha=0.26, rough=0.35, vcol=True)
        mcart = self.mats.get("cartilage", rough=0.45)
        mmus = self.mats.get("finmuscle", rough=0.6)
        mact = self.mats.get("actino", rough=0.5)
        tb = self.HL + 0.012
        for sd, sg in SIDES:
            base = np.array(b.pt(tb, math.radians(5), 0.92, sg))
            ax = np.array([-math.cos(math.radians(24)), sg * math.sin(math.radians(24)), -0.12])
            ax /= np.linalg.norm(ax)
            wv = np.array([0.15, sg * 0.25, 1.0])          # blade width direction (mostly dorsoventral)
            wv -= ax * np.dot(wv, ax)
            wv /= np.linalg.norm(wv)
            nv = np.cross(ax, wv)
            W = 0.036 * SL                                   # blade half-width, schematic
            width = lambda s: W * (0.42 + 0.58 * math.sin(math.pi * min(0.15 + 0.85 * s, 1.0) ** 0.8)) if s < 0.98 \
                else W * 0.3
            NS, NW = 22, 9

            def P(s, f, lift=0.0):
                return base + ax * L * s + wv * width(s) * f + nv * lift + np.array([0, 0, -0.04 * L * s * s])
            # fin fold (distal), from s=0.38 to the rounded tip
            V, C = [], []
            ss = np.linspace(0.38, 1.0, NS)
            for s in ss:
                rnd = math.sqrt(max(1 - ((s - 0.38) / 0.62) ** 6, 0.02))
                for f in np.linspace(-1, 1, NW):
                    V.append(tuple(P(s, f * rnd)))
                    C.append(srgb_lin((0.94, 0.92, 0.85)))
            self.mk("pectoral_fin_fold_" + sd, MB().add(V, grid_faces(NS, NW), None, C), mfold,
                    self.M("pectoral fin fold (distal fin blade), %s" % side_word(sd), "ZFA:0005317", "organ", "fin",
                           "outer", sd,
                           basis=SCHEMATIC + "; total fin length %.2f SL set so the fin reaches past the middle of the "
                                             "yolk, as Kimmel et al. 1995 describe from 60 h ('extends posteriorly to "
                                             "cover more than half of the yolk ball'); wild-type area at 72 hpf not "
                                             "reported in absolute units (Koudijs 2005)" % self.PECT,
                           note="DELPHI knobs: prdm1a fin fold size (4 dpf); hhip pectoral fin area (72 hpf)",
                           colour="vertex colours (COLOR_0): #F1ECDB; material factor white, alpha 0.26"),
                    closed=False, solidify=0.0007, solid_offset=0.0)
            # endoskeletal disc (cartilage), proximal
            V = []
            ss = np.linspace(0.0, 0.46, 12)
            for s in ss:
                for f in np.linspace(-1, 1, 9):
                    V.append(tuple(P(s, f * 0.82 * math.sqrt(max(1 - ((s - 0.23) / 0.26) ** 4, 0.05)))))
            self.mk("pectoral_fin_endoskeletal_disc_" + sd, MB().add(V, grid_faces(12, 9)), mcart,
                    self.M("pectoral fin endoskeletal disc (cartilage), %s" % side_word(sd), "ZFA:0001456", "organ",
                           "skeletal", "skeleton", sd, basis=SCHEMATIC + "; disc length 0.46 of fin length",
                           note="DELPHI knob: prdm1a endoskeletal disc length (4 dpf)"),
                    closed=False, solidify=0.0022, solid_offset=0.0)
            # fin musculature: abductor and adductor sheets on the two faces of the disc
            mb = MB()
            for lift in (1, -1):
                V = []
                for s in np.linspace(0.02, 0.42, 10):
                    for f in np.linspace(-1, 1, 7):
                        V.append(tuple(P(s, f * 0.70 * math.sqrt(max(1 - ((s - 0.22) / 0.22) ** 4, 0.05)),
                                         lift * 0.0019)))
                mb.add(V, grid_faces(10, 7, flip=lift < 0))
            self.mk("pectoral_fin_musculature_" + sd, mb, mmus,
                    self.M("pectoral fin musculature (abductor and adductor sheets), %s" % side_word(sd), "ZFA:0000563",
                           "tissue", "musculature", "muscle", sd, basis=SCHEMATIC),
                    closed=False, solidify=0.0009, solid_offset=0.0)
            # actinotrichia in the fin fold
            mb = MB()
            for f in np.linspace(-0.85, 0.85, 13):
                a = P(0.50, f * 0.9)
                c = P(0.97, f * math.sqrt(max(1 - (0.97 - 0.38) ** 6 / 0.62 ** 6, 0.02)) * 0.95)
                mb.add(*tube([a, (a + c) / 2, c], [0.00035, 0.00028, 0.00012], 4))
            self.mk("pectoral_fin_actinotrichia_" + sd, mb, mact,
                    self.M("pectoral fin actinotrichia, %s" % side_word(sd), "ZFA:0005545", "tissue", "skeletal",
                           "skeleton", sd, basis=SCHEMATIC + "; fibril count illustrative"))
            # cleithrum: thin curved bar just anterior to the fin base
            ths = np.linspace(0.30 * math.pi, -0.42 * math.pi, 16)
            Pc = [b.pt(tb - 0.008 + 0.010 * (0.5 - th / math.pi) * 0.5, th, 0.86, sg) for th in ths]
            self.mk("cleithrum_" + sd, MB().add(*tube(Pc, np.linspace(0.0011, 0.0016, 16), 6, flat=0.6)),
                    self.mats.get("cartilage", rough=0.45),
                    self.M("cleithrum (first bone of the pectoral girdle), %s" % side_word(sd), "ZFA:0000184", "organ",
                           "skeletal", "skeleton", sd, basis=SCHEMATIC,
                           note="DELPHI knobs: prdm1a cleithrum length (4 dpf); drawn in the cartilage colour for "
                                "contrast, though the cleithrum is a dermal bone"), inside=0.95)

    # ------------------------------------------------------------------ muscle
    def build_myotomes(self):
        b = self.body
        mat = self.mats.get("muscle", rough=0.6)
        NM = self.N_SOM
        t0, t1 = self.HL - 0.005, 0.99
        edges = np.linspace(t0, t1, NM + 1)
        A = 0.75 * (edges[1] - edges[0])
        gap = 0.07 * (edges[1] - edges[0])
        vfun = lambda nz: 1 - 2 * abs(nz)   # chevron: anterior-pointing at the horizontal myoseptum
        for sd, sg in SIDES:
            mb = MB()
            for i in range(NM):
                tm = 0.5 * (edges[i] + edges[i + 1])
                for half in (-1, 1):
                    lo = 0.03
                    hi = math.pi / 2 * 0.98
                    if half < 0 and tm < self.SVL + 0.02:
                        hi = math.asin(0.45)  # hypaxial muscle stays above the gut and yolk in the trunk
                    ths = np.linspace(lo, hi, 12) * half
                    if half < 0:
                        ths = ths[::-1]
                    outer, inner = [], []
                    for a in np.linspace(0, 1, 3):
                        ro, ri = [], []
                        for th in ths:
                            nz0 = math.sin(th)
                            # myotomes are centred on the notochord: map nz in [-1, 1] around it
                            nn = self.noto_nz(tm)
                            nz = nn + (nz0 * (1 - nn) if nz0 > 0 else nz0 * (1 + nn))
                            b0 = edges[i] - A * vfun(nz0) * (0.4 if i == 0 else 1.0)
                            b1 = edges[i + 1] - A * vfun(nz0)
                            t = min(max(b0 + gap + (b1 - b0 - 2 * gap) * a, t0 - A * 0.4), 0.997)
                            s_out = 1 - 0.0016 / b.local_radius(t)
                            ny_o = math.sqrt(max(1 - min(abs(nz), 0.999) ** 2, 0.0))
                            ro.append(b.world(t, sg * ny_o * s_out, nz * s_out))
                            ri.append(b.world(t, sg * 0.32 * ny_o, nz * 0.92))
                        outer.append(ro)
                        inner.append(ri)
                    mb.add(*slab(outer, inner))
            self.mk("myotomes_" + sd, mb, mat,
                    self.M("myotomes (chevron-shaped trunk and tail muscle segments), %s" % side_word(sd), "ZFA:0001056",
                           "tissue", "musculature", "muscle", sd,
                           basis=self.V.basis_or(["somite_pairs"], "chevron shape and depth schematic"),
                           note="%d segments (Kimmel et al. 1995: 30-34 somite pairs)" % NM), inside=1.0)

    # ------------------------------------------------------------------ skeleton
    def build_skeleton(self):
        b = self.body
        # notochord with vacuole bands
        nm = self.mats.get("notochord", rough=0.3, vcol=True)
        ts = np.linspace(0.19, 0.995, 120)
        P = [self.noto_world(t) for t in ts]
        R = [self.noto_r(t) * (1 if t < 0.97 else math.sqrt(max((0.995 - t) / 0.025, 0.05))) for t in ts]
        V, F = tube(P, R, 14)
        C = []
        for i, t in enumerate(ts):
            band = 0.5 + 0.5 * math.cos(2 * math.pi * t * 70)
            c = lerp3(srgb_lin((0.93, 0.96, 0.97)), srgb_lin((0.74, 0.80, 0.84)), band * 0.6)
            C.extend([c] * 14)
        C.extend([C[0], C[-1]])
        self.mk("notochord", MB().add(V, F, None, C), nm,
                self.M("notochord (vacuolated rod)", "ZFA:0000135", "organ", "axial", "skeleton", "mid", basis=SCHEMATIC,
                       note="the main axial support at this stage; vertebrae are not yet ossified",
                       colour="vertex colours (COLOR_0): vacuole bands #EDF4F6 / #C9D2D8; material factor white"),
                inside=0.98)
        cm = self.mats.get("cartilage", rough=0.45)
        # neurocranium cartilage: ethmoid plate + trabeculae + parachordals
        mb = MB()
        P = spline([b.world(0.025, 0.0, -0.30), b.world(0.05, 0.0, -0.30), b.world(0.075, 0.0, -0.28)], 8)
        mb.add(*tube(P, 0.0040, 10, flat=0.35))
        for sg in (1, -1):
            P = spline([b.world(0.07, 0.15 * sg, -0.28), b.world(0.13, 0.30 * sg, -0.20), b.world(0.18, 0.22 * sg, -0.10),
                        b.world(0.21, 0.12 * sg, self.noto_nz(0.21) - 0.05)], 14)
            mb.add(*tube(P, 0.0014, 6))
        self.mk("neurocranium_cartilage", mb, cm,
                self.M("neurocranium cartilage (ethmoid plate, trabeculae, parachordals; simplified)", "ZFA:0001580",
                       "organ", "skeletal", "skeleton", "mid", basis=SCHEMATIC), inside=0.95)
        P = spline([b.world(0.115, 0.55, -0.62), b.world(0.06, 0.45, -0.70), b.world(0.022, 0.0, -0.55),
                    b.world(0.06, -0.45, -0.70), b.world(0.115, -0.55, -0.62)], 24)
        self.mk("meckels_cartilage", MB().add(*tube(P, 0.0016, 7)), cm,
                self.M("Meckel's cartilage (lower jaw)", "ZFA:0001205", "organ", "skeletal", "skeleton", "mid",
                       basis=SCHEMATIC), inside=1.0)
        P = spline([b.world(0.165, 0.55, -0.66), b.world(0.12, 0.35, -0.78), b.world(0.08, 0.0, -0.80),
                    b.world(0.12, -0.35, -0.78), b.world(0.165, -0.55, -0.66)], 24)
        self.mk("ceratohyal_cartilage", MB().add(*tube(P, 0.0017, 7)), cm,
                self.M("ceratohyal cartilage", "ZFA:0001400", "organ", "skeletal", "skeleton", "mid", basis=SCHEMATIC),
                inside=1.0)
        for sd, sg in SIDES:
            mb = MB()
            for k in range(5):
                t = 0.17 + 0.013 * k
                P = spline([b.world(t, 0.12 * sg, -0.74), b.world(t + 0.006, 0.40 * sg, -0.62),
                            b.world(t + 0.008, 0.50 * sg, -0.40)], 10)
                mb.add(*tube(P, 0.0011, 6))
            self.mk("pharyngeal_arch_cartilages_" + sd, mb, cm,
                    self.M("pharyngeal arch cartilages (ceratobranchials 1-5), %s" % side_word(sd), "ZFA:0001460",
                           "organ", "skeletal", "skeleton", sd, basis=SCHEMATIC), inside=1.0)

    # ------------------------------------------------------------------ organs
    def yolk_geom(self):
        b = self.body
        t = self.YOLK_T
        c = b.world(t, 0.0, -0.42)
        r = (0.040 * self.SL, b.hw(t) * 0.62, b.hd(t) * 0.46)
        return c, r

    def build_organs(self):
        b, HL = self.body, self.HL
        nerv = self.mats.get("nervous", rough=0.5)
        brain = [("brain_telencephalon", "telencephalon", "ZFA:0000079", [((0.055, 0.0, 0.20), (0.020, 0.30, 0.30))]),
                 ("brain_optic_tectum", "optic tectum (paired lobes)", "ZFA:0000445",
                  [((0.110, 0.24, 0.50), (0.030, 0.26, 0.30)), ((0.110, -0.24, 0.50), (0.030, 0.26, 0.30))]),
                 ("brain_cerebellum", "cerebellum", "ZFA:0000100", [((0.150, 0.0, 0.55), (0.012, 0.32, 0.18))]),
                 ("brain_medulla_oblongata", "hindbrain (medulla oblongata)", "ZFA:0000545",
                  [((0.185, 0.0, 0.38), (0.035, 0.22, 0.25))])]
        for name, lab, zid, parts in brain:
            mb = MB()
            for c, r in parts:
                mb.add(*b.ellipsoid(c, r, 10, 16))
            self.mk(name, mb, nerv, self.M("brain: " + lab, zid, "organ", "nervous", "organ", "mid", basis=SCHEMATIC,
                                           note="part of the brain (ZFA:0000008)"), inside=0.95)
        ts = np.linspace(0.20, 0.985, 60)
        P = [self.noto_world(t) + np.array([0, 0, self.noto_r(t) + 0.0045 * (1 - 0.6 * smooth(0.6, 1.0, t))])
             for t in ts]
        self.mk("spinal_cord", MB().add(*tube(P, [0.0040 * (1 - 0.6 * smooth(0.5, 1.0, t)) for t in ts], 8)), nerv,
                self.M("spinal cord (neural tube)", "ZFA:0000075", "organ", "nervous", "organ", "mid", basis=SCHEMATIC),
                inside=0.98)
        sen = self.mats.get("sensory", alpha=0.6, rough=0.3)
        oto = self.mats.get("otolith", rough=0.2)
        for sd, sg in SIDES:
            c = (0.205, 0.50 * sg, 0.28)
            self.mk("otic_vesicle_" + sd, MB().add(*b.ellipsoid(c, (0.024, 0.28, 0.32), 12, 18)), sen,
                    self.M("otic vesicle (inner ear), %s" % side_word(sd), "ZFA:0000051", "organ", "sensory", "organ", sd,
                           basis=SCHEMATIC), inside=0.98)
            mb = MB()
            for dc in ((0.013, 0.0, -0.10), (-0.013, 0.0, -0.12)):
                p = b.world(c[0] + dc[0], c[1] + dc[1] * sg, c[2] + dc[2])
                mb.add(*ellipsoid_world(p, (0.0042, 0.0030, 0.0036), 8, 12))
            self.mk("otoliths_" + sd, mb, oto,
                    self.M("otoliths (anterior and posterior), %s" % side_word(sd), "ZFA:0001617", "organ", "sensory",
                           "organ", sd, basis=SCHEMATIC + "; two otoliths per ear at this stage"), inside=0.98)
        # heart: in the pericardial region anterior to the yolk
        th_ = HL - 0.035
        parts = [("heart_atrium", "atrium", "ZFA:0000471", "atrium", (th_ + 0.014, 0.10, -0.62), (0.016, 0.24, 0.16)),
                 ("heart_ventricle", "ventricle", "ZFA:0000009", "circulatory", (th_ - 0.004, -0.05, -0.74),
                  (0.016, 0.22, 0.14)),
                 ("heart_bulbus_arteriosus", "bulbus arteriosus", "ZFA:0000173", "bulbus", (th_ - 0.022, 0.0, -0.66),
                  (0.009, 0.10, 0.08))]
        for name, lab, zid, key, c, r in parts:
            self.mk(name, MB().add(*b.ellipsoid(c, r, 10, 16)), self.mats.get(key, rough=0.45),
                    self.M("heart: " + lab, zid, "organ", "cardiovascular", "organ", "mid", basis=SCHEMATIC,
                           note="part of the heart (ZFA:0000114)"), inside=0.98)
        # yolk remnant + extension
        yc, yr = self.yolk_geom()
        ym = self.mats.get("yolk", rough=0.5)
        self.mk("yolk", MB().add(*ellipsoid_world(yc, yr, 14, 22)), ym,
                self.M("yolk (remnant of the yolk sac)", "ZFA:0000084", "organ", "yolk", "organ", "mid", basis=SCHEMATIC,
                       note="mostly consumed by 4-5 dpf; size schematic"), inside=0.98)
        ts = np.linspace(self.YOLK_T + 0.035, 0.50, 16)
        P = [b.world(t, 0.0, -0.72) for t in ts]
        self.mk("yolk_extension", MB().add(*tube(P, [0.0045 * (1 - 0.7 * (t - ts[0]) / (ts[-1] - ts[0])) for t in ts],
                                                 10)), ym,
                self.M("yolk extension (remnant)", "ZFA:0000106", "organ", "yolk", "organ", "mid", basis=SCHEMATIC),
                inside=0.98)
        # gut
        gm = self.mats.get("gut", rough=0.5)
        P = spline([b.world(0.17, 0.0, -0.30), b.world(0.22, 0.0, -0.18), b.world(0.26, 0.05, -0.10)], 12)
        self.mk("oesophagus", MB().add(*tube(P, 0.0028, 8)), gm,
                self.M("oesophagus", "ZFA:0000204", "organ", "digestive", "organ", "mid", basis=SCHEMATIC), inside=0.95)
        P = spline([b.world(0.26, 0.05, -0.10), b.world(0.30, 0.22, -0.12), b.world(0.35, 0.22, -0.16),
                    b.world(0.39, 0.10, -0.24)], 18)
        self.mk("intestinal_bulb", MB().add(*tube(P, [0.0030 + 0.0038 * math.sin(math.pi * u) for u in
                                                      np.linspace(0, 1, 18)], 10)), gm,
                self.M("intestinal bulb (left side, above the yolk)", "ZFA:0001076", "organ", "digestive", "organ", "mid",
                       basis=SCHEMATIC), inside=0.95)
        P = spline([b.world(0.39, 0.10, -0.24), b.world(0.45, 0.0, -0.40), b.world(0.52, 0.0, -0.50),
                    b.world(self.SVL - 0.01, 0.0, -0.68), b.world(self.SVL, 0.0, -0.96)], 24)
        self.mk("intestine", MB().add(*tube(P, np.linspace(0.0030, 0.0022, 24), 8)), self.mats.get("gut2", rough=0.5),
                self.M("intestine (mid and posterior) to the vent", "ZFA:0001338", "organ", "digestive", "organ", "mid",
                       basis=self.V.basis_or(["snout_vent_over_SL"], "path schematic"),
                       note="opens at the vent at snout-vent length %.3f SL" % self.SVL))
        self.mk("liver", MB().add(*b.ellipsoid((0.272, 0.36, -0.22), (0.022, 0.28, 0.20))),
                self.mats.get("liver", rough=0.45),
                self.M("liver (left side, over the yolk)", "ZFA:0000123", "organ", "hepatobiliary", "organ", "mid",
                       basis=SCHEMATIC), inside=0.95)
        self.mk("pancreas", MB().add(*b.ellipsoid((0.325, -0.28, -0.20), (0.018, 0.22, 0.16))),
                self.mats.get("pancreas", rough=0.5),
                self.M("pancreas (right side)", "ZFA:0000140", "organ", "digestive", "organ", "mid", basis=SCHEMATIC),
                inside=0.95)
        # swim bladder: single posterior lobe, inflating, dorsal to the gut and ventral to the notochord
        t_sb = 0.375
        c = b.world(t_sb, 0.0, self.noto_nz(t_sb) - 0.36)
        r = (0.032 * self.SL, b.hw(t_sb) * 0.38, b.hd(t_sb) * 0.26)
        self.mk("swim_bladder", MB().add(*ellipsoid_world(c, r, 14, 22)), self.mats.get("bladder", rough=0.2, metallic=0.2),
                self.M("swim bladder (posterior chamber, inflating)", "ZFA:0001278", "organ", "buoyancy", "organ", "mid",
                       basis=self.V.basis_or(["swim_bladder_lobes"], "size and position schematic"),
                       note="at inflation only the posterior lobe is present (Parichy 2009); the anterior lobe appears "
                            "at ~6.0 mm SL"), inside=0.95)
        # pronephros: glomerulus at the midline + paired ducts to the cloaca
        km = self.mats.get("renal", rough=0.5)
        g = b.world(0.235, 0.0, self.noto_nz(0.235) - 0.40)
        mb = MB()
        mb.add(*ellipsoid_world(g, (0.0045, 0.0060, 0.0035), 8, 12))
        for sg in (1, -1):
            P = spline([g, b.world(0.245, 0.22 * sg, self.noto_nz(0.245) - 0.42),
                        b.world(0.26, 0.28 * sg, self.noto_nz(0.26) - 0.40)], 8)
            mb.add(*tube(P, 0.0012, 6))
        self.mk("pronephros", mb, km,
                self.M("pronephros (glomerulus and tubules)", "ZFA:0000151", "organ", "renal", "organ", "mid",
                       basis=SCHEMATIC), inside=0.95)
        for sd, sg in SIDES:
            ts = np.linspace(0.26, self.SVL - 0.005, 24)
            P = [b.world(t, 0.28 * sg * (1 - 0.8 * smooth(self.SVL - 0.08, self.SVL, t)),
                         self.noto_nz(t) - 0.40 - 0.45 * smooth(self.SVL - 0.08, self.SVL, t)) for t in ts]
            self.mk("pronephric_duct_" + sd, MB().add(*tube(P, 0.0009, 6)), km,
                    self.M("pronephric duct, %s" % side_word(sd), "ZFA:0000150", "organ", "renal", "organ", sd,
                           basis=SCHEMATIC), inside=0.98)
        # main trunk vessels
        ts = np.linspace(0.20, 0.95, 50)
        P = [self.noto_world(t) - np.array([0, 0, self.noto_r(t) + 0.0028]) for t in ts]
        self.mk("dorsal_aorta", MB().add(*tube(P, [0.0019 * (1 - 0.5 * smooth(0.6, 0.95, t)) for t in ts], 8)),
                self.mats.get("aorta", rough=0.4),
                self.M("dorsal aorta", "ZFA:0000014", "organ", "cardiovascular", "organ", "mid", basis=SCHEMATIC),
                inside=0.98)
        ts = np.linspace(0.88, 0.26, 50)
        P = [self.noto_world(t) - np.array([0, 0, self.noto_r(t) + 0.0075]) for t in ts]
        P += [b.world(0.25, 0.30, -0.35), b.world(HL - 0.02, 0.15, -0.55)]
        P = spline(P[::3] + P[-2:], 50)
        self.mk("posterior_cardinal_vein", MB().add(*tube(P, 0.0022, 8)), self.mats.get("vein", rough=0.4),
                self.M("posterior cardinal vein (to the heart over the yolk)", "ZFA:0000477", "organ", "cardiovascular",
                       "organ", "mid", basis=SCHEMATIC), inside=0.98)

    def build(self):
        T.clear_scene()
        self.build_skin()
        self.build_eyes()
        self.build_pigment_and_lateral_line()
        self.build_median_fin_fold()
        self.build_pectoral_fins()
        self.build_myotomes()
        self.build_skeleton()
        self.build_organs()

    def header(self, glb_rel):
        V = self.V
        sourced = {k: {"value": e["value"], "source": e["source"], "measure": e.get("measure"),
                       "derivation": e.get("derivation")}
                   for k, e in V.used.items() if e.get("basis") != SCHEMATIC and "source" in e}
        schematic = {k: e["value"] for k, e in V.used.items() if e.get("basis") == SCHEMATIC}
        return {
            "model": "zebrafish (Danio rerio) larva at about 4-5 dpf, onset of swim bladder inflation (Parichy 2009 "
                     "milestone pSB, about 3.5 mm SL), generic wild type, segmented for a cutaway viewer",
            "file": glb_rel,
            "stage": {"label": "larval, ~4-5 dpf, pSB (posterior swim bladder inflation)", "reference_SL_mm": self.SLmm,
                      "why": "the stage where measured DELPHI knobs live: hhip pectoral fin area (72 hpf), prdm1a "
                             "cleithrum, endoskeletal disc and fin fold (4 dpf)"},
            "built_with": "Blender %s (bpy, headless); anatomy-model/zebrafish/build_larva.py" % bpy.app.version_string,
            "units_and_axes": "glTF Y-up; head at +X, back at +Y, fish's left side at -Z. Standard length (snout to "
                              "notochord tip, as defined for pre-flexion larvae by Parichy 2009) = %.2f units, i.e. "
                              "1 unit = %.2f mm at the reference size." % (self.SL, self.SLmm / self.SL),
            "sourced_values": sourced,
            "schematic_values": schematic,
            "sources_file": "anatomy-model/zebrafish/sources.json",
            "ontology": "ZFA ids (zebrafish anatomy ontology) looked up in Ubergraph; uberon_id is the Uberon class "
                        "that carries the ZFA id as a database cross-reference. Calls in anatomy-model/zebrafish/calls.json",
            "levels": "organ / tissue",
            "layers": "outer (skin, eyes, fin folds, pigment stripes, neuromasts) / muscle / skeleton (notochord, "
                      "cartilage, cleithrum, actinotrichia) / organ",
        }


def larva_main():
    args = T.parse_args(os.path.join(T.MODEL_DIR, "zebrafish-larva.glb"), os.path.join(T.HERE, "manifest-larva.json"),
                        r"C:\Temp\fish-models\zebrafish-renders\larva")
    Lv = Larva()
    Lv.build()
    probs = Lv.reg.check_inside(Lv.body, exempt=None)
    print("INSIDE_CHECK", "OK" if not probs else probs)
    T.export_glb(args["glb"])
    T.write_manifest(Lv.reg, args["manifest"], Lv.header("dashboard/public/blueprint3d/model/zebrafish-larva.glb"),
                     os.path.join(os.path.dirname(args["glb"]), "manifest-larva.json"))
    print("EXPORTED", args["glb"], os.path.getsize(args["glb"]), "bytes,", len(Lv.reg.entries), "objects")
    if args["render"]:
        render_larva(Lv, args)


def render_larva(Lv, args):
    S = T.Shooter(Lv.reg, args["renders"], args["samples"], args["only"])
    L = S.by_layer()
    allobj = S.all
    skin = ["skin_L", "skin_R"]
    eyes = ["eye_L", "eye_R"]
    S.show(allobj)
    S.place((0.75, 1.05, 0.55), (-0.02, 0.0, -0.01), lens=42)
    S.shoot("01_whole_three_quarter")
    S.place((0.0, 2.5, 0.0), (0.0, 0.0, -0.01), ortho=1.05)
    S.shoot("02_lateral_left")
    S.split(0.14)
    S.place((0.80, 1.45, 0.85), (-0.02, 0.0, 0.0), lens=40)
    S.shoot("03_split_halves")
    S.split(0.0)
    S.show([n for n in allobj if n not in skin])
    S.place((0.65, 1.00, 0.45), (-0.02, 0.0, -0.01), lens=42)
    S.shoot("04_skin_removed_muscle")
    S.show(L["skeleton"] + L["organ"] + eyes)
    S.place((0.0, 2.5, 0.02), (0.0, 0.0, -0.01), ortho=1.0)
    S.shoot("05_muscle_removed_skeleton_organs")
    S.show(L["organ"] + eyes)
    S.place((0.45, 0.80, 0.25), (0.18, 0.0, -0.02), lens=50)
    S.shoot("06_organs_only")
    S.show(L["skeleton"] + eyes)
    S.place((0.65, 1.0, 0.55), (-0.02, 0.0, 0.0), lens=42)
    S.shoot("07_skeleton_only")
    S.show(allobj)
    S.cam.constraints[0].mute = True
    S.cam.location = (0.0, 0.0, 2.2)
    S.cam.rotation_euler = (0.0, 0.0, math.pi)
    S.cam.data.type = "ORTHO"
    S.cam.data.ortho_scale = 1.05
    S.shoot("08_dorsal")


if __name__ == "__main__":
    larva_main()
