"""Parametric, segmented 3D fish builder for the DELPHI blueprint viewer.

ONE builder.  Input: a parameter set (a reference organism, or a design resolved from
parents + weights + deltas; see params.py).  Output: one GLB with a base mesh plus named
morph targets (glTF shape keys) for growth stages and/or parent organisms, and a manifest in
which every piece and every parameter carries its provenance.

    blender.exe -b --factory-startup --python anatomy-model/parametric/build.py -- \
        --organism flying-fish --glb OUT.glb --manifest OUT.json \
        [--stages auto|none] [--parents] [--faithful] [--renders DIR] [--no-render] [--samples N]

Conventions kept exactly as in anatomy-model/build_fish.py:
  Blender while building: Z up, head at +X, back at +Z, the fish's LEFT at +Y.
  Exported GLB: Y-up, head +X, back +Y, the fish's left at -Z.  Adult ~1 unit long.
  One named mesh per piece, L/R halves, layers outer / muscle / skeleton / organ, node extras
  carrying label, ontology id, layer, side, organ system and level, one manifest entry per piece
  with geometry_basis.

MORPHOLOGICAL interpolation, not genetic hybridisation: see params.CAVEAT.
"""
import bpy
import bmesh
import mathutils
import json
import math
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ANAT = os.path.dirname(HERE)
REPO = os.path.dirname(ANAT)
sys.path.insert(0, HERE)
import params as PRM  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def _arg(flag, default):
    return argv[argv.index(flag) + 1] if flag in argv else default


ORG = _arg("--organism", "flying-fish")
GLB_PATH = _arg("--glb", os.path.join(REPO, "dashboard", "public", "blueprint3d", "model", ORG + ".glb"))
MANIFEST_PATH = _arg("--manifest", os.path.join(os.path.dirname(GLB_PATH), ORG + "-manifest.json"))
RENDER_DIR = _arg("--renders", r"C:\Temp\fish-models\parametric-renders")
STAGES_MODE = _arg("--stages", "auto")
WANT_PARENTS = "--parents" in argv
FAITHFUL = "--faithful" in argv
DO_RENDER = "--no-render" not in argv
SAMPLES = int(_arg("--samples", "16"))
DETAIL_OVR = _arg("--detail", "")

RES = PRM.resolve(ORG)
PSET = dict(RES["parameters"])
if FAITHFUL:
    PSET["mesh_detail"] = 1.0
if DETAIL_OVR:
    PSET["mesh_detail"] = float(DETAIL_OVR)
SOLIDIFY_OK = FAITHFUL   # Blender cannot apply modifiers to a mesh that carries shape keys
STAGE_FILE = os.path.join(HERE, "stages.json")

SCHEMATIC = "schematic"
DJ = "dashboard/public/blueprint3d/data.json"
FS = "genotype/fin-subtree.json"
G = 9.81
MUSCLE_RHO = 1060.0   # kg/m3, teleost muscle density, assumed

# ============================================================== parameter -> geometry frame
# The model is dimensionless.  The ADULT / design reference set is normalised to SL = 0.82 model
# units (the committed flying-fish.glb convention).  Earlier growth stages are built at their TRUE
# relative size, SL(age) / SL(adult), so development plays as real growth, not as shape-only morphing.
SL_REF_UNITS = 0.82
X0 = 0.50
T_END = 1.04
SKIN_T = 0.0015


class Frame(object):
    """Everything the geometry needs, derived from one parameter set."""

    def __init__(self, ps, size_rel=1.0):
        self.ps = ps
        self.size = size_rel
        self.SL = SL_REF_UNITS * size_rel
        self.H = 0.5 * ps["body_depth_over_SL"] * self.SL
        self.W = 0.5 * ps["body_width_over_SL"] * self.SL
        self.NEXP = ps["body_section_exponent"]
        self.NOSE = ps["head_fraction_SL"]
        self.PH = ps["peduncle_depth_frac"]
        self.PW = ps["peduncle_width_frac"]
        self.SKIN_T = SKIN_T * size_rel
        # metres per model unit, for the physical quantities (muscle volume, areas, wing loading)
        self.m_per_unit = ps["standard_length_m"] / (SL_REF_UNITS * size_rel) if size_rel > 0 else 0.0

    def _env(self, t, p):
        if t <= 0.0:
            return 0.0
        if t < self.NOSE:
            a = t / self.NOSE
            return math.sqrt(max(a * (2 - a), 0.0))
        if t <= 0.42:
            return 1.0
        if t <= 0.95:
            return p + (1 - p) * 0.5 * (1 + math.cos(math.pi * (t - 0.42) / 0.53))
        if t <= 1.0:
            return p
        u = min((t - 1.0) / (T_END - 1.0), 1.0)
        return p * math.sqrt(max(1 - u * u, 0.0))

    def eh(self, t):
        return self._env(t, self.PH)

    def ew(self, t):
        return self._env(t, self.PW)

    def world(self, t, ny, nz):
        return (X0 - t * self.SL, ny * self.W * self.ew(t), nz * self.H * self.eh(t))

    def section(self, theta, s=1.0, side=1):
        c, sn = math.cos(theta), math.sin(theta)
        ny = s * math.copysign(abs(c) ** (2.0 / self.NEXP), c) * side
        nz = s * math.copysign(abs(sn) ** (2.0 / self.NEXP), sn)
        return ny, nz

    def body_pt(self, t, theta, s=1.0, side=1):
        ny, nz = self.section(theta, s, side)
        return self.world(t, ny, nz)

    def x_to_t(self, x):
        return (X0 - x) / self.SL

    def norm_of(self, pt):
        t = self.x_to_t(pt[0])
        hh, ww = self.H * self.eh(t), self.W * self.ew(t)
        if hh < 1e-9 or ww < 1e-9:
            return 9.0
        return (abs(pt[1] / ww) ** self.NEXP + abs(pt[2] / hh) ** self.NEXP) ** (1.0 / self.NEXP)

    def local_radius(self, t):
        return max(min(self.W * self.ew(t), self.H * self.eh(t)), 1e-5)

    def ellipsoid_norm_pts(self, c, r, nlat=12, nlon=18):
        V, F = unit_sphere(nlat, nlon)
        return [self.world(c[0] + q[0] * r[0], c[1] + q[1] * r[1], c[2] + q[2] * r[2]) for q in V], F


# ============================================================== topology (frozen across variants)
class Topo(object):
    """Counts and mesh resolutions.  FROZEN from the base parameter set so every variant of an
    organism has identical topology and can be carried as a glTF morph target."""

    def __init__(self, ps):
        d = float(ps["mesh_detail"])
        self.detail = d

        def q(n, lo=4):
            return max(int(round(n * d)), lo)
        self.SKIN_NU, self.SKIN_NV = q(110, 24), q(40, 14)
        self.MYO_NTH = q(30, 12)
        self.SPH_LAT, self.SPH_LON = q(12, 6), q(18, 8)
        self.EYE_LAT, self.EYE_LON = q(22, 10), q(36, 14)
        self.SKULL_NT, self.SKULL_NTH = q(64, 20), q(32, 12)
        self.RAY_NS = q(16, 6)
        self.N_PECT = int(ps["pectoral_ray_count"])
        self.N_PELV = int(ps["pelvic_ray_count"])
        self.N_DORS = int(ps["dorsal_ray_count"])
        self.N_ANAL = int(ps["anal_ray_count"])
        self.N_CAUD = int(ps["caudal_ray_count"])
        self.N_VERT = int(ps["vertebra_count"])
        self.N_MYO = int(ps["myomere_count"])
        # a count of 0 in a stage must not change topology: build at least 1 ray and shrink it away
        self.N_PECT = max(self.N_PECT, 1)
        self.N_PELV = max(self.N_PELV, 1)
        self.N_DORS = max(self.N_DORS, 1)
        self.N_ANAL = max(self.N_ANAL, 1)
        self.N_CAUD = max(self.N_CAUD, 3)


# ============================================================== palette / materials
PAL = {"skin": "#7F97AE", "eye": "#C0C6CC", "fin": "#4E6E8E", "muscle": "#D9727A", "bone": "#F2EAD3",
       "ray": "#E6DCC0", "nervous": "#F2C14E", "respiratory": "#B5174B", "circulatory": "#D32F2F",
       "liver": "#8D4E2A", "gut": "#E8A87C", "bladder": "#DCE3E8", "renal": "#26A69A",
       "reproductive": "#F6B26B", "lymphoid": "#6D214F", "flightmuscle": "#B03A48"}
PAL_FULL = dict(PAL)
MATS = {}


def srgb_lin(rgb):
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]


def hex_lin(h):
    h = h.lstrip("#")
    return srgb_lin([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])


def get_mat(key, alpha=1.0, metallic=0.0, rough=0.5, vcol=False):
    nm = "mat_" + key
    if nm in MATS:
        return MATS[nm]
    m = bpy.data.materials.new(nm)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    col = [1.0, 1.0, 1.0] if vcol else hex_lin(PAL_FULL[key])
    bsdf.inputs["Base Color"].default_value = col + [1.0]
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    if vcol:
        n = m.node_tree.nodes.new("ShaderNodeVertexColor")
        n.layer_name = "Col"
        m.node_tree.links.new(n.outputs["Color"], bsdf.inputs["Base Color"])
    MATS[nm] = m
    return m


# ============================================================== geometry helpers
class MB(object):
    def __init__(self):
        self.V, self.F, self.UV, self.C = [], [], [], []

    def add(self, V, F, uv=None, col=None):
        o = len(self.V)
        self.V.extend([tuple(map(float, q)) for q in V])
        self.F.extend([tuple(i + o for i in f) for f in F])
        self.UV.extend(uv if uv is not None else [(0.0, 0.0)] * len(V))
        self.C.extend(col if col is not None else [None] * len(V))


def grid_faces(nu, nv, mask=None):
    F = []
    for i in range(nu - 1):
        for j in range(nv - 1):
            if mask is not None and not mask(i, j):
                continue
            F.append((i * nv + j, (i + 1) * nv + j, (i + 1) * nv + j + 1, i * nv + j + 1))
    return F


def slab(outer, inner):
    nu, nv = len(outer), len(outer[0])
    V = [q for row in outer for q in row] + [q for row in inner for q in row]
    n = nu * nv
    F = grid_faces(nu, nv)
    F += [tuple(reversed([i + n for i in f])) for f in grid_faces(nu, nv)]

    def idx(i, j, k):
        return k * n + i * nv + j
    for i in range(nu - 1):
        for j in (0, nv - 1):
            F.append((idx(i, j, 0), idx(i + 1, j, 0), idx(i + 1, j, 1), idx(i, j, 1)))
    for j in range(nv - 1):
        for i in (0, nu - 1):
            F.append((idx(i, j, 0), idx(i, j + 1, 0), idx(i, j + 1, 1), idx(i, j, 1)))
    return V, F


def unit_sphere(nlat=12, nlon=18):
    V = [(0, 0, -1)]
    for i in range(1, nlat):
        a = -math.pi / 2 + math.pi * i / nlat
        for j in range(nlon):
            b = 2 * math.pi * j / nlon
            V.append((math.cos(a) * math.cos(b), math.cos(a) * math.sin(b), math.sin(a)))
    V.append((0, 0, 1))
    F, top = [], len(V) - 1
    for j in range(nlon):
        F.append((0, 1 + (j + 1) % nlon, 1 + j))
    for i in range(nlat - 2):
        for j in range(nlon):
            a = 1 + i * nlon + j
            b = 1 + i * nlon + (j + 1) % nlon
            F.append((a, b, b + nlon, a + nlon))
    base = 1 + (nlat - 2) * nlon
    for j in range(nlon):
        F.append((base + j, base + (j + 1) % nlon, top))
    return V, F


def ellipsoid_world(c, r, nlat=12, nlon=18):
    V, F = unit_sphere(nlat, nlon)
    return [(c[0] + q[0] * r[0], c[1] + q[1] * r[1], c[2] + q[2] * r[2]) for q in V], F


def tube(P, R, nseg=8, cap=True):
    P = np.asarray(P, dtype=float)
    N = len(P)
    R = np.broadcast_to(np.asarray(R, dtype=float), (N,))
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None] + 1e-12
    ref = np.array([0, 0, 1.0]) if abs(T[0][2]) < 0.9 else np.array([1.0, 0, 0])
    nrm = np.cross(T[0], ref)
    nrm /= np.linalg.norm(nrm) + 1e-12
    V, F = [], []
    for i in range(N):
        nrm = nrm - T[i] * np.dot(nrm, T[i])
        nrm /= np.linalg.norm(nrm) + 1e-12
        b = np.cross(T[i], nrm)
        for k in range(nseg):
            a = 2 * math.pi * k / nseg
            V.append(tuple(P[i] + R[i] * (math.cos(a) * nrm + math.sin(a) * b)))
    for i in range(N - 1):
        for k in range(nseg):
            a, b2 = i * nseg + k, i * nseg + (k + 1) % nseg
            F.append((a, b2, b2 + nseg, a + nseg))
    if cap:
        c0 = len(V)
        V.append(tuple(P[0]))
        c1 = len(V)
        V.append(tuple(P[-1]))
        for k in range(nseg):
            F.append((c0, (k + 1) % nseg, k))
            F.append((c1, (N - 1) * nseg + k, (N - 1) * nseg + (k + 1) % nseg))
    return V, F


def spline(ctrl, n):
    C = np.asarray(ctrl, dtype=float)
    C = np.vstack([C[0] * 2 - C[1], C, C[-1] * 2 - C[-2]])
    segs = len(C) - 3
    out = []
    for s in np.linspace(0, segs, n, endpoint=True):
        i = min(int(s), segs - 1)
        u = s - i
        p0, p1, p2, p3 = C[i], C[i + 1], C[i + 2], C[i + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return np.array(out)


def squeeze_inside(F, V, lim):
    """Scale a piece's (y, z) toward the body axis until no vertex pokes outside the skin.
    The superellipse norm is homogeneous of degree 1 in (y, z) at fixed x, so one exact step
    suffices.  Returns (vertices, factor)."""
    worst = max(F.norm_of(q) for q in V)
    if worst <= lim:
        return V, 1.0
    f = lim / worst
    return [(q[0], q[1] * f, q[2] * f) for q in V], f


def tri_area(V, F):
    V = np.asarray(V, dtype=float)
    a = 0.0
    for f in F:
        for k in range(1, len(f) - 1):
            p, q, r = V[f[0]], V[f[k]], V[f[k + 1]]
            a += 0.5 * float(np.linalg.norm(np.cross(q - p, r - p)))
    return a


# ============================================================== registry
class Reg(object):
    """Collects pieces.  mode 'create' makes Blender objects; mode 'collect' only records vertex
    arrays, so a variant can be attached as a morph target to the base objects."""

    def __init__(self, mode, variant=None):
        self.mode = mode
        self.variant = variant
        self.entries = []
        self.obj = {}
        self.verts = {}
        self.check = {}
        self.order = []

    def mk(self, name, mb, mat, meta, closed=True, smooth=True, solidify=None, solid_offset=-1.0,
           inside=None, outward_axis=None, shrink=1.0):
        V = mb.V
        if shrink < 1.0:
            c = np.asarray(V, dtype=float).mean(axis=0)
            V = [tuple(c + (np.asarray(q, dtype=float) - c) * shrink) for q in V]
        self.verts[name] = V
        self.order.append(name)
        if self.mode != "create":
            return None
        me = bpy.data.meshes.new(name)
        me.from_pydata(V, [], mb.F)
        me.validate(clean_customdata=False)
        bm = bmesh.new()
        bm.from_mesh(me)
        if closed:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        elif outward_axis is not None:
            bm.normal_update()
            score = 0.0
            for f in bm.faces:
                cc = f.calc_center_median()
                score += (cc - outward_axis(cc)).dot(f.normal)
            if score < 0:
                for f in bm.faces:
                    f.normal_flip()
        bm.to_mesh(me)
        bm.free()
        if len(me.vertices) != len(V):
            raise RuntimeError("vertex count changed for %s (%d -> %d): morph targets would be "
                               "misaligned" % (name, len(V), len(me.vertices)))
        if any(uv != (0.0, 0.0) for uv in mb.UV):
            uvl = me.uv_layers.new(name="UVMap")
            for loop in me.loops:
                uvl.data[loop.index].uv = mb.UV[loop.vertex_index]
        if any(c is not None for c in mb.C):
            attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
            for i, c in enumerate(mb.C):
                cc = c or [1, 1, 1]
                attr.data[i].color = list(cc) + [1.0] if len(cc) == 3 else list(cc)
        me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(mat)
        co = np.array([v.co[:] for v in me.vertices])
        ctr = (co.min(0) + co.max(0)) / 2
        me.transform(mathutils.Matrix.Translation(-mathutils.Vector(ctr)))
        ob.location = ctr
        if solidify and SOLIDIFY_OK:
            md = ob.modifiers.new("solidify", "SOLIDIFY")
            md.thickness = solidify
            md.offset = solid_offset
            md.use_rim = True
            md.use_even_offset = True
        meta = dict(meta)
        meta["object"] = name
        meta["colour"] = meta.get("colour") or PAL_FULL[mat.name[4:]]
        for k in ("ontology_id", "layer", "side", "organ_system", "level"):
            ob[k] = meta.get(k) if meta.get(k) is not None else ""
        ob["label"] = meta["label"]
        self.entries.append(meta)
        self.obj[name] = ob
        if inside is not None:
            self.check[name] = inside
        return ob


SYS = {
    "integumental": ("integumental system", "UBERON_0002416"),
    "musculoskeletal": ("musculoskeletal system", "UBERON_0002204"),
    "nervous": ("nervous system", "UBERON_0001016"),
    "sensory": ("entire sense organ system", "UBERON_0004456"),
    "respiratory": ("respiratory system", "UBERON_0001004"),
    "circulatory": ("circulatory system", "UBERON_0001009"),
    "digestive": ("digestive system", "UBERON_0001007"),
    "renal": ("renal system", "UBERON_0001008"),
    "reproductive": ("reproductive system", "UBERON_0000990"),
    "hematopoietic": ("hematopoietic system", "UBERON_0002390"),
    "buoyancy": ("gas bladder (no organ-system node; foregut derivative)", None),
}
HYPOTHETICAL = RES.get("kind") == "design"


def M(label, oid, olabel, src, level, system, layer, side, basis=SCHEMATIC, nearest=None, note=None,
      zfa=None, colour=None, drivers=None):
    sl, sid = SYS[system]
    d = {"label": label, "ontology_id": oid, "ontology_label": olabel, "ontology_source": src,
         "level": level, "organ_system": sl, "organ_system_id": sid, "layer": layer, "side": side,
         "geometry_basis": basis}
    if HYPOTHETICAL:
        d["hypothetical"] = True
        d["hypothetical_note"] = ("HYPOTHETICAL: this piece belongs to the design '%s', not to any "
                                  "described animal. It was generated from a parameter set, not "
                                  "observed." % RES["name"])
    if zfa:
        d["zfa_id"] = zfa
    if oid is None:
        d["ontology_note"] = "no matching node in %s or %s" % (DJ, FS)
        if nearest:
            d["nearest_ancestor_in_files"] = nearest
    if note:
        d["note"] = note
    if colour:
        d["colour"] = colour
    if drivers:
        d["driven_by_parameters"] = drivers
    return d


SIDES = (("L", 1), ("R", -1))


def side_word(sd):
    return "left" if sd == "L" else "right"


def cnt(n, key):
    """'11, illustrative' / '18, secondary' - the count plus the kind of its parameter."""
    k = RES["provenance_per_parameter"][key]["kind"]
    return "%d, %s" % (n, "illustrative" if k == "assumed" else k)


OUTWARD = (lambda c: mathutils.Vector((c.x, 0.0, 0.0)))

# ============================================================== pieces
MEAS = {}   # measurements taken on the base build (areas, spans)


def build_skin(R, F, T, st):
    mat = get_mat("skin", metallic=0.35, rough=0.38, vcol=True)
    ts = np.concatenate([np.linspace(0.0, 1.0, T.SKIN_NU - 8), np.linspace(1.0, T_END, 9)[1:]])
    ths = np.linspace(-math.pi / 2, math.pi / 2, T.SKIN_NV)
    blue, steel = srgb_lin((0.05, 0.13, 0.33)), srgb_lin((0.35, 0.45, 0.58))
    silver, belly = srgb_lin((0.78, 0.82, 0.86)), srgb_lin((0.93, 0.95, 0.96))

    def lerp(a, b, f):
        f = min(max(f, 0.0), 1.0)
        return [a[i] + (b[i] - a[i]) * f for i in range(3)]
    for sd, sg in SIDES:
        mb = MB()
        V, UV, C = [], [], []
        for t in ts:
            for th in ths:
                V.append(F.body_pt(t, th, 1.0, sg))
                UV.append((t * 36.0, (th + math.pi / 2) / math.pi * 7.0))
                z = math.sin(th)
                if z > 0.45:
                    col = lerp(steel, blue, (z - 0.45) / 0.35)
                elif z > 0.05:
                    col = lerp(silver, steel, (z - 0.05) / 0.40)
                else:
                    col = lerp(belly, silver, (z + 0.7) / 0.75)
                C.append(col)
        Fc = grid_faces(len(ts), T.SKIN_NV)
        if sg < 0:
            Fc = [tuple(reversed(f)) for f in Fc]
        mb.add(V, Fc, UV, C)
        R.mk("skin_" + sd, mb, mat,
             M("skin and scales, %s half" % side_word(sd), "UBERON_0002097", "skin of body", DJ, "organ",
               "integumental", "outer", sd,
               note="body shell" + ("" if SOLIDIFY_OK else "; zero-thickness shell (a solidify modifier "
                                    "cannot be applied to a mesh that carries morph targets)"),
               drivers=["body_depth_over_SL", "body_width_over_SL", "body_section_exponent",
                        "head_fraction_SL", "peduncle_depth_frac", "peduncle_width_frac"],
               colour="vertex colours (COLOR_0): #0D2154 back -> #597394 sides -> #EEF2F5 belly"),
             closed=False, solidify=F.SKIN_T, solid_offset=-1.0, outward_axis=OUTWARD)


EYE = {}


def build_eyes(R, F, T, st):
    mat = get_mat("eye", metallic=0.6, rough=0.25, vcol=True)
    te = 0.075
    re = 0.020 * F.size * (F.ps["head_fraction_SL"] / 0.20)
    hh, ww = F.H * F.eh(te), F.W * F.ew(te)
    for sd, sg in SIDES:
        ny_s, nz_s = F.section(math.radians(10), 1.0, 1)
        c = (X0 - te * F.SL, sg * (ww * ny_s - re * 0.62 + 0.0035 * F.size), 0.16 * hh)
        EYE[sd] = (c, re)
        Vs, Fc = unit_sphere(T.EYE_LAT, T.EYE_LON)
        V = [(c[0] + q[0] * re, c[1] + sg * q[2] * re * 0.70, c[2] + q[1] * re * 0.95) for q in Vs]
        if sg < 0:
            Fc = [tuple(reversed(f)) for f in Fc]
        C = []
        for q in Vs:
            lat = q[2]
            C.append(srgb_lin((0.02, 0.02, 0.03)) if lat > 0.86 else
                     (srgb_lin((0.66, 0.58, 0.32)) if lat > 0.55 else srgb_lin((0.86, 0.88, 0.91))))
        mb = MB()
        mb.add(V, Fc, None, C)
        R.mk("eye_" + sd, mb, mat,
             M("eye, %s" % side_word(sd), "UBERON_0000970", "eye", DJ, "organ", "sensory", "outer", sd,
               note="size and position schematic; scales with head_fraction_SL",
               drivers=["head_fraction_SL"],
               colour="vertex colours (COLOR_0): #DBE0E8 eyeball, #A8944F iris, #050508 pupil"))


def fin(R, T, name_m, name_r, rays, mat_m, mat_r, meta_m, meta_r, individual_rays=False,
        ray_meta_fn=None, r0=0.0022, r1=0.0005, mem_t=0.0008, scale=1.0, shrink=1.0,
        shrink_rays=None):
    shrink_rays = shrink if shrink_rays is None else shrink_rays
    ns = len(rays[0])
    mb = MB()
    V = [tuple(q) for r in rays for q in r]
    mb.add(V, grid_faces(len(rays), ns))
    R.mk(name_m, mb, mat_m, meta_m, closed=False, solidify=mem_t * scale, solid_offset=0.0, shrink=shrink)
    if individual_rays:
        for k, r in enumerate(rays):
            rb = MB()
            rb.add(*tube(r, np.linspace(r0 * scale, r1 * scale, len(r)), 6))
            R.mk("%s_%02d" % (name_r, k + 1), rb, mat_r, ray_meta_fn(k), shrink=shrink_rays)
    else:
        rb = MB()
        for r in rays:
            rb.add(*tube(r, np.linspace(r0 * scale, r1 * scale, len(r)), 6))
        R.mk(name_r, rb, mat_r, meta_r, shrink=shrink_rays)


def ray_line(base, direction, L, bend, ns=16):
    s = np.linspace(0, 1, ns)[:, None]
    return np.asarray(base) + np.asarray(direction) * L * s + np.asarray(bend) * L * s ** 2


def _pect_rays(F, T, sg, Lp):
    rays = []
    for k in range(T.N_PECT):
        f = k / max(T.N_PECT - 1, 1)
        t = 0.228 + 0.022 * f
        th = math.pi * (0.26 - 0.16 * f)
        base = F.body_pt(t, th, 0.93, sg)
        phi = math.radians(22 + 58 * f)
        dlt = math.radians(10 - 6 * f)
        d = (-math.sin(phi) * math.cos(dlt), sg * math.cos(phi) * math.cos(dlt), math.sin(dlt))
        prof = 0.85 + 0.15 * (f / 0.2) if f <= 0.2 else 1 - 0.55 * ((f - 0.2) / 0.8) ** 1.3
        rays.append(ray_line(base, d, Lp * prof, (-0.07 * F.size, 0, -0.02 * F.size), T.RAY_NS))
    longest = max(float(np.linalg.norm(r[-1] - r[0])) for r in rays)
    return [r[0] + (r - r[0]) * (Lp / longest) for r in rays]


def _aniso(rays, span_k, chord_k):
    """Scale a ray fan anisotropically in its own plane: span_k along the root-to-tip direction of
    the longest ray, chord_k perpendicular to it inside the fin plane."""
    if abs(span_k - 1) < 1e-12 and abs(chord_k - 1) < 1e-12:
        return rays
    org = np.mean([r[0] for r in rays], axis=0)
    tips = np.array([r[-1] - org for r in rays])
    lead = tips[int(np.argmax(np.linalg.norm(tips, axis=1)))]
    s_hat = lead / (np.linalg.norm(lead) + 1e-12)
    # fin plane normal from the spread of the tips
    nrm = np.cross(tips[0], tips[-1])
    if np.linalg.norm(nrm) < 1e-12:
        nrm = np.array([0.0, 0.0, 1.0])
    nrm /= np.linalg.norm(nrm)
    c_hat = np.cross(nrm, s_hat)
    c_hat /= np.linalg.norm(c_hat) + 1e-12
    out = []
    for r in rays:
        v = np.asarray(r) - org
        a = v @ s_hat
        b = v @ c_hat
        c = v @ nrm
        out.append(org + np.outer(a * span_k, s_hat) + np.outer(b * chord_k, c_hat) + np.outer(c, nrm))
    return out


def _fan_area(rays, ns):
    V = [tuple(q) for r in rays for q in r]
    return tri_area(V, grid_faces(len(rays), ns))


def build_fins(R, F, T, st, fit=None, measure_into=None):
    mfin = get_mat("fin", alpha=0.82, rough=0.45)
    mray = get_mat("ray", rough=0.5)
    ps = F.ps
    sz = F.size
    m2 = (F.m_per_unit ** 2) if F.m_per_unit else 0.0

    # ---- pectoral fins
    Lp = ps["pectoral_len_over_SL"] * F.SL
    span_k, chord_k = 1.0, 1.0
    if fit and fit.get("on"):
        tgt_span = ps["pectoral_span_over_SL"] * F.SL
        tgt_area_one = 0.5 * ps["pectoral_area_over_SL2"] * F.SL ** 2
        for _ in range(6):
            rays = _aniso(_pect_rays(F, T, 1, Lp), span_k, chord_k)
            span = 2.0 * max(abs(float(q[1])) for r in rays for q in r)
            area = _fan_area(rays, T.RAY_NS)
            span_k *= tgt_span / max(span, 1e-9)
            chord_k *= (tgt_area_one / max(area, 1e-12)) * (span / max(tgt_span, 1e-9))
    pect_span = pect_area = 0.0
    fiton = bool(fit and fit.get("on"))
    for sd, sg in SIDES:
        rays = _aniso(_pect_rays(F, T, sg, Lp), span_k, chord_k)
        pect_span = max(pect_span, 2.0 * max(abs(float(q[1])) for r in rays for q in r))
        pect_area += _fan_area(rays, T.RAY_NS)
        basis = SCHEMATIC
        fin(R, T, "pectoral_fin_" + sd, "pectoral_fin_ray_" + sd, rays, mfin, mray,
            M("pectoral fin (membrane), %s; enlarged, spread for gliding" % side_word(sd), "UBERON_0000151",
              "pectoral fin", DJ + "; " + FS, "organ", "musculoskeletal", "outer", sd, basis=basis,
              zfa="ZFA:0001161",
              drivers=["pectoral_len_over_SL", "pectoral_span_over_SL", "pectoral_area_over_SL2"],
              note="longest ray = %.4f SL; span/area fit = %s" % (ps["pectoral_len_over_SL"],
                   "on (fitted to pectoral_span_over_SL and pectoral_area_over_SL2)" if fiton
                   else "off (geometry driven by pectoral_len_over_SL)")),
            None, individual_rays=True,
            ray_meta_fn=lambda k, sd=sd: M("pectoral fin ray %d (lepidotrichium), %s" % (k + 1, side_word(sd)),
                                           "UBERON_4000175", "pectoral fin lepidotrichium", FS, "organ",
                                           "musculoskeletal", "skeleton", sd,
                                           basis="ray length follows pectoral_len_over_SL; ray count %d"
                                                 % T.N_PECT, zfa="ZFA:0001551",
                                           drivers=["pectoral_ray_count", "pectoral_len_over_SL"]),
            scale=sz, shrink=st.get("pectoral_membrane", 1.0),
            shrink_rays=st.get("pectoral_rays", 1.0))

    # ---- pelvic fins
    kp = fit.get("pelvic_k", 1.0) if fit else 1.0
    pelv_area = 0.0
    for sd, sg in SIDES:
        rays = []
        for k in range(T.N_PELV):
            f = k / max(T.N_PELV - 1, 1)
            base = F.body_pt(0.585 + 0.016 * f, math.pi * (-0.36 + 0.06 * f), 0.93, sg)
            phi = math.radians(30 + 42 * f)
            dlt = math.radians(-14 + 4 * f)
            d = (-math.sin(phi) * math.cos(dlt), sg * math.cos(phi) * math.cos(dlt), math.sin(dlt))
            rays.append(ray_line(base, d, kp * ps["pelvic_len_over_SL"] * F.SL * (1 - 0.45 * f),
                                 (-0.05 * sz, 0, 0), 12))
        pelv_area += _fan_area(rays, 12)
        fin(R, T, "pelvic_fin_" + sd, "pelvic_fin_rays_" + sd, rays, mfin, mray,
            M("pelvic fin (membrane), %s" % side_word(sd), None, None, None, "organ", "musculoskeletal",
              "outer", sd, nearest="UBERON_0002204 musculoskeletal system",
              drivers=["pelvic_len_over_SL"], note="position schematic"),
            M("pelvic fin rays, %s (%s)" % (side_word(sd), cnt(T.N_PELV, "pelvic_ray_count")), None, None, None, "organ",
              "musculoskeletal", "skeleton", sd, nearest="UBERON_0004765 skeletal element",
              drivers=["pelvic_ray_count"]),
            r0=0.0016, r1=0.0004, scale=sz, shrink=st.get("pelvic", 1.0))

    # ---- dorsal fin
    rays = []
    for k in range(T.N_DORS):
        f = k / max(T.N_DORS - 1, 1)
        base = F.world(0.665 + 0.185 * f, 0.0, 0.95)
        psi = math.radians(38 + 18 * f)
        rays.append(ray_line(base, (-math.sin(psi), 0, math.cos(psi)),
                             ps["dorsal_height_over_SL"] * F.SL * (1 - 0.55 * f), (-0.04 * sz, 0, 0), 12))
    fin(R, T, "dorsal_fin", "dorsal_fin_rays", rays, mfin, mray,
        M("dorsal fin (membrane)", None, None, None, "organ", "musculoskeletal", "outer", "mid",
          nearest="UBERON_0002204 musculoskeletal system", drivers=["dorsal_height_over_SL"]),
        M("dorsal fin rays (%s)" % cnt(T.N_DORS, "dorsal_ray_count"), None, None, None, "organ", "musculoskeletal", "skeleton", "mid",
          nearest="UBERON_0004765 skeletal element", drivers=["dorsal_ray_count"]),
        r0=0.0014, r1=0.0004, scale=sz, shrink=st.get("dorsal", 1.0))

    # ---- anal fin
    rays = []
    for k in range(T.N_ANAL):
        f = k / max(T.N_ANAL - 1, 1)
        base = F.world(0.70 + 0.16 * f, 0.0, -0.95)
        psi = math.radians(38 + 18 * f)
        rays.append(ray_line(base, (-math.sin(psi), 0, -math.cos(psi)),
                             ps["anal_height_over_SL"] * F.SL * (1 - 0.5 * f), (-0.04 * sz, 0, 0), 12))
    fin(R, T, "anal_fin", "anal_fin_rays", rays, mfin, mray,
        M("anal fin (membrane)", None, None, None, "organ", "musculoskeletal", "outer", "mid",
          nearest="UBERON_0002204 musculoskeletal system", drivers=["anal_height_over_SL"]),
        M("anal fin rays (%s)" % cnt(T.N_ANAL, "anal_ray_count"), None, None, None, "organ", "musculoskeletal", "skeleton", "mid",
          nearest="UBERON_0004765 skeletal element", drivers=["anal_ray_count"]),
        r0=0.0014, r1=0.0004, scale=sz, shrink=st.get("anal", 1.0))

    # ---- caudal fin
    kc = fit.get("caudal_k", 1.0) if fit else 1.0
    rays = []
    hb = F.H * F.eh(1.0)
    Lu = kc * ps["caudal_upper_lobe_over_SL"] * F.SL
    Ll = kc * ps["caudal_lower_lobe_over_SL"] * F.SL
    Lm = 0.07 * F.SL * kc * 0.5 * (ps["caudal_upper_lobe_over_SL"] + ps["caudal_lower_lobe_over_SL"]) / 0.23
    for k in range(T.N_CAUD):
        f = k / (T.N_CAUD - 1)
        base = (X0 - 0.985 * F.SL, 0.0, hb * (0.92 - 1.84 * f))
        a = math.radians(42 - 84 * f)
        L = Lm + ((Lu - Lm) * ((0.5 - f) / 0.5) ** 1.4 if f < 0.5 else (Ll - Lm) * ((f - 0.5) / 0.5) ** 1.4)
        rays.append(ray_line(base, (-math.cos(a), 0, math.sin(a)), L,
                             (0, 0, 0.03 * sz * math.copysign(1, a)), 14))
    caud_area = _fan_area(rays, 14)
    fin(R, T, "caudal_fin", "caudal_fin_rays", rays, mfin, mray,
        M("caudal fin (membrane), forked%s" % (", lower lobe longer" if Ll > Lu * 1.02 else
                                               " (equal lobes)"), None, None, None, "organ",
          "musculoskeletal", "outer", "mid", nearest="UBERON_0002204 musculoskeletal system",
          drivers=["caudal_upper_lobe_over_SL", "caudal_lower_lobe_over_SL"],
          note="upper lobe %.4f SL, lower lobe %.4f SL, asymmetry %.3f"
               % (ps["caudal_upper_lobe_over_SL"] * kc, ps["caudal_lower_lobe_over_SL"] * kc,
                  ps["caudal_lower_lobe_over_SL"] / max(ps["caudal_upper_lobe_over_SL"], 1e-9))),
        M("caudal fin rays (%s)" % cnt(T.N_CAUD, "caudal_ray_count"), None, None, None, "organ", "musculoskeletal", "skeleton", "mid",
          nearest="UBERON_0004765 skeletal element", drivers=["caudal_ray_count"]),
        r0=0.0016, r1=0.0004, scale=sz, shrink=st.get("caudal", 1.0))

    if measure_into is not None:
        measure_into.update({
            "pectoral_span_units": pect_span, "pectoral_area_both_units": pect_area,
            "pelvic_area_both_units": pelv_area, "caudal_area_units": caud_area,
            "lifting_area_units": pect_area + pelv_area + caud_area,
            "pectoral_span_m": pect_span * F.m_per_unit,
            "pectoral_area_both_m2": pect_area * m2,
            "lifting_area_m2": (pect_area + pelv_area + caud_area) * m2,
        })


def wfun(nz):
    return 2 * abs(2 * abs(nz) - 1) - 1


def build_muscle(R, F, T, st):
    mat = get_mat("muscle", rough=0.6)
    NM = T.N_MYO
    t0, t1 = 0.25, 0.985
    edges = np.linspace(t0, t1, NM + 1)
    A = 0.6 * (edges[1] - edges[0])
    gap = 0.06 * (edges[1] - edges[0])
    ths = np.linspace(-math.pi / 2, math.pi / 2, T.MYO_NTH)
    for sd, sg in SIDES:
        mb = MB()
        for i in range(NM):
            outer, inner = [], []
            for a in np.linspace(0, 1, 3):
                ro, ri = [], []
                for th in ths:
                    nz = math.sin(th)
                    b0 = edges[i] - A * wfun(nz) * (0.3 if i == 0 else 1.0)
                    b1 = edges[i + 1] - A * wfun(nz)
                    t = min(max(b0 + gap + (b1 - b0 - 2 * gap) * a, t0 - A), 0.995)
                    s_out = 1 - (F.SKIN_T + 0.0012 * F.size) / F.local_radius(t)
                    s_in = 0.60 if t < 0.65 else 0.60 - 0.22 * (t - 0.65) / 0.35
                    ro.append(F.body_pt(t, th, s_out, sg))
                    ri.append(F.body_pt(t, th, s_in, sg))
                outer.append(ro)
                inner.append(ri)
            mb.add(*slab(outer, inner))
        R.mk("muscle_" + sd, mb, mat,
             M("trunk musculature: myomeres (W-shaped segments), %s" % side_word(sd), None, None, None,
               "tissue", "musculoskeletal", "muscle", sd, nearest="UBERON_0002204 musculoskeletal system",
               drivers=["myomere_count", "body_depth_over_SL", "body_width_over_SL"],
               note="%d myomeres" % NM), inside=0.995)

    # ---- pectoral girdle musculature: the piece flight_muscle_fraction drives
    fmat = get_mat("flightmuscle", rough=0.6)
    frac = F.ps["flight_muscle_fraction"]
    mass = F.ps["body_mass_kg"]
    vol_m3 = frac * mass / MUSCLE_RHO
    vol_units = vol_m3 / (F.m_per_unit ** 3) if F.m_per_unit > 0 else 0.0
    # one ellipsoid per side; semi-axes in fixed proportion (ax : ay : az = 1 : 0.42 : 0.80),
    # so a = (vol / (2 * 4/3 pi * 0.42 * 0.80)) ** (1/3) for the pair
    kvol = (4.0 / 3.0) * math.pi * 0.42 * 0.80
    a0 = (max(vol_units, 0.0) / (2.0 * kvol)) ** (1.0 / 3.0) if vol_units > 0 else 1e-5
    T_ANT = 0.205      # anterior pole, just behind the cleithrum
    T_POST_MAX = 0.60  # the mass may not run past the middle of the body cavity
    NORM_LIM = 0.95

    def _centre(sx, sg=1):
        tc = T_ANT + sx / F.SL
        c = F.body_pt(tc, 0.05 * math.pi, 0.45, sg)
        return (c[0], c[1] + sg * 0.35 * F.W * F.ew(tc), c[2]), tc

    def _probe(sx, sy, sz_):
        """max superellipse norm of the ellipsoid at these semi-axes, anchored at T_ANT"""
        c, tc = _centre(sx)
        if tc + sx / F.SL > T_POST_MAX:
            return 99.0
        V, _ = ellipsoid_world(c, (sx, sy, sz_), 10, 14)
        return max(F.norm_of(q) for q in V)

    # 1. largest uniform fraction of the proportional ellipsoid that stays inside the skin
    lo, hi = 0.0, 1.0
    if _probe(a0, a0 * 0.42, a0 * 0.80) > NORM_LIM:
        for _ in range(26):
            mid = 0.5 * (lo + hi)
            if _probe(a0 * mid, a0 * mid * 0.42, a0 * mid * 0.80) > NORM_LIM:
                hi = mid
            else:
                lo = mid
        clip = lo
    else:
        clip = 1.0
    sx, sy, sz_ = a0 * clip, a0 * clip * 0.42, a0 * clip * 0.80
    # 2. if it had to be clipped, recover the missing volume by extending along the body axis only
    #    (a big flight muscle can only be accommodated fore-and-aft), capped at 0.22 SL
    x_cap = 0.5 * (T_POST_MAX - T_ANT) * F.SL
    x_extended = False
    if clip < 1.0 and sy > 0 and sz_ > 0:
        sx_need = min(max(vol_units, 0.0) / (2.0 * (4.0 / 3.0) * math.pi * sy * sz_), x_cap)
        if sx_need > sx:
            lo2, hi2 = sx, sx_need
            if _probe(hi2, sy, sz_) <= NORM_LIM:
                sx = hi2
            else:
                for _ in range(24):
                    mid = 0.5 * (lo2 + hi2)
                    if _probe(mid, sy, sz_) > NORM_LIM:
                        hi2 = mid
                    else:
                        lo2 = mid
                sx = lo2
            x_extended = True
    vol_realized = 2.0 * (4.0 / 3.0) * math.pi * sx * sy * sz_
    fsq = 1.0
    for sd, sg in SIDES:
        c, tc = _centre(sx, sg)
        mb = MB()
        Vm, Fm = ellipsoid_world(c, (sx, sy, sz_), T.SPH_LAT, T.SPH_LON)
        Vm, fsq = squeeze_inside(F, Vm, 0.96)
        mb.add(Vm, Fm)
        R.mk("pectoral_muscle_" + sd, mb, fmat,
             M("pectoral girdle musculature (abductor + adductor mass), %s" % side_word(sd), None, None,
               None, "tissue", "musculoskeletal", "muscle", sd,
               nearest="UBERON_0002204 musculoskeletal system",
               basis="VOLUME set by flight_muscle_fraction x body_mass / 1060 kg/m3 (muscle density "
                     "assumed): target %.4g of body mass = %.4g model units^3; realised %.4g "
                     "(%.1f%% of target)%s"
                     % (frac, vol_units, vol_realized,
                        100.0 * vol_realized / max(vol_units, 1e-12),
                        "" if clip >= 1.0 else
                        "; the proportional ellipsoid did not fit inside the skin (clipped to %.3f) so the "
                        "muscle was extended backwards from the girdle instead%s" % (clip, ", and hit the "
                                                                        "t = 0.60 posterior limit"
                                                                        if x_extended and sx >= x_cap * 0.999
                                                                        else "")),
               drivers=["flight_muscle_fraction", "body_mass_kg", "standard_length_m"],
               note="NEW piece, not present in the committed flying-fish.glb. Shape is one ellipsoid per "
                    "side; only its VOLUME is parametric, and the volume is clipped to what fits inside "
                    "the skin - which is itself a finding when flight_muscle_fraction is large."),
             inside=0.985, shrink=st.get("pectoral_muscle", 1.0))
    vol_realized *= fsq ** 2
    MEAS["flight_muscle_volume_target_units3"] = vol_units
    MEAS["flight_muscle_volume_realized_units3"] = vol_realized
    MEAS["flight_muscle_volume_realized_m3"] = (vol_realized * F.m_per_unit ** 3) if F.m_per_unit else 0.0
    MEAS["flight_muscle_fit_fraction"] = vol_realized / max(vol_units, 1e-12)
    MEAS["flight_muscle_clip"] = clip
    MEAS["flight_muscle_volume_target_m3"] = vol_m3


def VERT_NZ(t):
    return 0.22 - 0.22 * min(max((t - 0.6) / 0.4, 0), 1) ** 1.2


SKULL_MASK = {}


def build_skeleton(R, F, T, st):
    bone = get_mat("bone", rough=0.55)
    NV_ = T.N_VERT
    t0, t1 = 0.215, 0.99
    step = (t1 - t0) / NV_
    nvis = st.get("vertebrae_formed", NV_)
    for i in range(NV_):
        tc = t0 + step * (i + 0.5)
        hh = F.H * F.eh(tc)
        rc = max(0.13 * hh, 0.0018 * F.size)
        cx, cz = X0 - tc * F.SL, VERT_NZ(tc) * hh
        Lc = step * F.SL * 0.86
        mb = MB()
        xs = np.linspace(cx + Lc / 2, cx - Lc / 2, 7)
        rad = rc * (1 - 0.25 * np.sin(np.linspace(0, math.pi, 7)))
        mb.add(*tube(np.stack([xs, np.zeros(7), np.full(7, cz)], 1), rad, 12))
        top = F.world(tc + 0.03, 0.0, 0.86 if tc < 0.95 else 0.7)
        p0 = np.array([cx, 0, cz + rc * 0.8])
        mb.add(*tube(np.linspace(p0, np.array(top), 6), np.linspace(rc * 0.35, rc * 0.12, 6), 5))
        if tc > 0.62:
            bot = F.world(tc + 0.03, 0.0, -0.84 if tc < 0.95 else -0.7)
            p0 = np.array([cx, 0, cz - rc * 0.8])
            mb.add(*tube(np.linspace(p0, np.array(bot), 6), np.linspace(rc * 0.35, rc * 0.12, 6), 5))
        R.mk("vertebra_%02d" % (i + 1), mb, bone,
             M("vertebra %d (centrum + spines)" % (i + 1), None, None, None, "organ", "musculoskeletal",
               "skeleton", "mid", nearest="UBERON_0004765 skeletal element (vertebral column has no node)",
               drivers=["vertebra_count"], note="%d vertebrae" % NV_), inside=0.98,
             shrink=1.0 if i < nvis else st.get("vertebra_unformed", 0.02))
    for sd, sg in SIDES:
        mb = MB()
        for i in range(NV_):
            tc = t0 + step * (i + 0.5)
            if tc < 0.26 or tc > 0.62:
                continue
            ctrl = [(tc, 0.10 * sg, VERT_NZ(tc)), (tc + 0.01, 0.45 * sg, 0.12), (tc + 0.03, 0.57 * sg, -0.15),
                    (tc + 0.05, 0.47 * sg, -0.5)]
            P = spline([F.world(*c) for c in ctrl], 14)
            mb.add(*tube(P, np.linspace(0.0011 * F.size, 0.0005 * F.size, 14), 5))
        R.mk("ribs_" + sd, mb, bone,
             M("pleural ribs, %s" % side_word(sd), None, None, None, "organ", "musculoskeletal", "skeleton",
               sd, nearest="UBERON_0004765 skeletal element", drivers=["vertebra_count"]),
             inside=0.98, shrink=st.get("ribs", 1.0))
    for sd, sg in SIDES:
        NT_, NTH_ = T.SKULL_NT, T.SKULL_NTH
        ts = np.linspace(0.015, 0.212, NT_)
        ths = np.linspace(0.02 * math.pi, 0.5 * math.pi, NTH_)
        V = [F.body_pt(t, th, 0.84, sg) for t in ts for th in ths]
        if sd not in SKULL_MASK:
            ec, er = EYE[sd]
            ecn = np.array(ec)

            def mk_mask(V=V, ecn=ecn, er=er, NTH_=NTH_):
                keep = set()
                for i in range(NT_ - 1):
                    for j in range(NTH_ - 1):
                        q = (np.array(V[i * NTH_ + j]) + np.array(V[(i + 1) * NTH_ + j + 1])) / 2
                        if np.linalg.norm(q - ecn) > er * 1.15:
                            keep.add((i, j))
                return keep
            SKULL_MASK[sd] = mk_mask()
        keep = SKULL_MASK[sd]
        Fc = grid_faces(NT_, NTH_, lambda i, j: (i, j) in keep)
        if sg < 0:
            Fc = [tuple(reversed(f)) for f in Fc]
        mb = MB()
        mb.add(V, Fc)
        R.mk("skull_" + sd, mb, bone,
             M("skull (simplified: skull roof / neurocranium shell), %s half" % side_word(sd), None, None,
               None, "organ", "musculoskeletal", "skeleton", sd,
               nearest="UBERON_0004765 skeletal element", drivers=["head_fraction_SL"],
               note="jaws, opercular and branchial bones not modelled"),
             closed=False, solidify=0.0022 * F.size, solid_offset=-1.0, outward_axis=OUTWARD)
    # pectoral girdle; thickness follows flight_muscle_fraction (a bigger muscle needs a bigger anchor)
    gth = min(1.0 + 1.6 * max(F.ps["flight_muscle_fraction"] - 0.04, 0.0) / 0.12, 2.6)
    for sd, sg in SIDES:
        ths = np.linspace(0.42 * math.pi, -0.49 * math.pi, 18)
        P = [F.body_pt(0.214 + 0.012 * (th / math.pi + 0.5), th, 0.90, sg) for th in ths]
        mb = MB()
        Vg, Fg = tube(P, np.linspace(0.0016 * F.size * gth, 0.0024 * F.size * gth, 18), 6)
        mb.add(squeeze_inside(F, Vg, 0.965)[0], Fg)
        R.mk("cleithrum_" + sd, mb, bone,
             M("cleithrum, %s" % side_word(sd), "UBERON_0004741", "cleithrum", FS, "organ",
               "musculoskeletal", "skeleton", sd, zfa="ZFA:0000184",
               drivers=["flight_muscle_fraction"],
               basis="pectoral girdle; shape simplified to a curved bar. Bar thickness x %.2f, scaled "
                     "with flight_muscle_fraction." % gth), inside=0.98)
        mb = MB()
        Vg, Fg = ellipsoid_world(F.body_pt(0.232, 0.17 * math.pi, 0.84, sg),
                                (0.005 * F.size * gth, 0.0018 * F.size * gth, 0.006 * F.size * gth), 8, 12)
        mb.add(squeeze_inside(F, Vg, 0.965)[0], Fg)
        R.mk("scapula_" + sd, mb, bone,
             M("scapula, %s" % side_word(sd), "UBERON_0006849", "scapula", FS, "organ", "musculoskeletal",
               "skeleton", sd, zfa="ZFA:0000583", drivers=["flight_muscle_fraction"],
               basis="simplified plate at the pectoral fin base, x %.2f with flight_muscle_fraction" % gth),
             inside=0.98)
        mb = MB()
        Vg, Fg = ellipsoid_world(F.body_pt(0.228, -0.17 * math.pi, 0.80, sg),
                                (0.006 * F.size * gth, 0.0018 * F.size * gth, 0.013 * F.size * gth), 8, 12)
        mb.add(squeeze_inside(F, Vg, 0.965)[0], Fg)
        R.mk("coracoid_" + sd, mb, bone,
             M("coracoid, %s" % side_word(sd), "UBERON_0004743", "coracoid bone", FS, "organ",
               "musculoskeletal", "skeleton", sd, zfa="ZFA:0000332",
               drivers=["flight_muscle_fraction"],
               basis="simplified plate below the fin base, x %.2f with flight_muscle_fraction" % gth),
             inside=0.98)


def build_organs(R, F, T, st):
    LAT, LON = T.SPH_LAT, T.SPH_LON
    E = F.ellipsoid_norm_pts
    nerv = get_mat("nervous", rough=0.5)
    mb = MB()
    for c, r in (((0.130, 0.0, 0.36), (0.022, 0.20, 0.16)), ((0.163, 0.17, 0.42), (0.020, 0.17, 0.17)),
                 ((0.163, -0.17, 0.42), (0.020, 0.17, 0.17)), ((0.190, 0.0, 0.40), (0.016, 0.15, 0.15)),
                 ((0.200, 0.0, 0.28), (0.022, 0.12, 0.12))):
        mb.add(*E(c, r, LAT, LON))
    R.mk("brain", mb, nerv, M("brain", "UBERON_0000955", "brain", DJ, "organ", "nervous", "organ", "mid",
                              note="lobes schematic"), inside=0.9)
    ts = np.linspace(0.205, 0.975, 40)
    P = [F.world(t, 0.0, VERT_NZ(t) + 0.20 - 0.06 * min(max((t - 0.85) / 0.13, 0), 1)) for t in ts]
    mb = MB()
    mb.add(*tube(P, [max(0.035 * F.H * F.eh(t), 0.0007 * F.size) for t in ts], 8))
    R.mk("spinal_cord", mb, nerv, M("spinal cord", "UBERON_0002240", "spinal cord", DJ, "organ", "nervous",
                                    "organ", "mid"), inside=0.9)
    gm = get_mat("respiratory", rough=0.5)
    for sd, sg in SIDES:
        mb = MB()
        for a in range(4):
            ta = 0.128 + a * 0.016
            ph = np.linspace(0, 1, 18)
            P = np.array([F.world(ta + 0.012 * math.sin(math.pi * q),
                                  sg * (0.18 + 0.36 * math.sin(math.pi * q)), 0.30 - 0.92 * q) for q in ph])
            mb.add(*tube(P, 0.0013 * F.size, 6))
            for q in np.linspace(0.08, 0.92, 16):
                o = np.array(F.world(ta + 0.012 * math.sin(math.pi * q),
                                     sg * (0.18 + 0.36 * math.sin(math.pi * q)), 0.30 - 0.92 * q))
                d = np.array([-0.5, sg * 1.0, 0.0])
                d /= np.linalg.norm(d)
                Lf = 0.010 * F.size * (0.6 + 0.4 * math.sin(math.pi * q))
                mb.add(*tube(np.linspace(o, o + d * Lf, 3),
                             np.array([0.0011, 0.0007, 0.0002]) * F.size, 4))
        R.mk("gills_" + sd, mb, gm,
             M("gills (4 gill arches with filaments), %s" % side_word(sd), None, None, None, "organ",
               "respiratory", "organ", sd, nearest="UBERON_0000171 respiration organ",
               note="arch and filament counts illustrative"), inside=0.92)
    hm = get_mat("circulatory", rough=0.45)
    mb = MB()
    for c, r in (((0.200, 0.0, -0.58), (0.013, 0.20, 0.15)), ((0.214, 0.0, -0.40), (0.011, 0.22, 0.10)),
                 ((0.183, 0.0, -0.55), (0.009, 0.09, 0.08))):
        mb.add(*E(c, r, LAT, LON))
    R.mk("heart", mb, hm, M("heart (ventricle, atrium, bulbus arteriosus)", "UBERON_0000948", "heart", DJ,
                            "organ", "circulatory", "organ", "mid"), inside=0.9)
    gmat = get_mat("gut", rough=0.5)
    P = spline([F.world(*c) for c in ((0.165, 0.0, -0.05), (0.21, 0.0, -0.08), (0.26, 0.0, -0.15))], 12)
    mb = MB()
    mb.add(*tube(P, 0.0048 * F.size, 10))
    R.mk("oesophagus", mb, gmat, M("oesophagus", "UBERON_0001043", "esophagus", DJ, "organ", "digestive",
                                   "organ", "mid"), inside=0.9)
    P = spline([F.world(*c) for c in ((0.255, 0.0, -0.14), (0.32, 0.08, -0.38), (0.42, -0.05, -0.50),
                                      (0.52, 0.06, -0.52), (0.62, 0.0, -0.58), (0.675, 0.0, -0.76),
                                      (0.692, 0.0, -0.93))], 48)
    mb = MB()
    mb.add(*tube(P, np.linspace(0.0062 * F.size, 0.0035 * F.size, 48), 10))
    R.mk("intestine", mb, gmat,
         M("intestine (straight tube to the vent)", None, None, None, "organ", "digestive", "organ", "mid",
           nearest="UBERON_0001007 digestive system",
           note="no separate stomach: beloniform fishes are generally described as stomachless "
                "(textbook statement, not checked against our data)"), inside=1.0)
    lm = get_mat("liver", rough=0.45)
    mb = MB()
    for c, r in (((0.300, 0.30, -0.52), (0.055, 0.22, 0.22)), ((0.290, -0.28, -0.50), (0.045, 0.20, 0.20)),
                 ((0.265, 0.0, -0.45), (0.022, 0.30, 0.16))):
        mb.add(*E(c, r, LAT, LON))
    R.mk("liver", mb, lm, M("liver (two lobes)", "UBERON_0002107", "liver", DJ, "organ", "digestive",
                            "organ", "mid"), inside=0.9)
    sm = get_mat("bladder", rough=0.3, metallic=0.2)
    mb = MB()
    mb.add(*E((0.48, 0.0, -0.12), (0.18, 0.36, 0.14), max(LAT + 2, 6), max(LON + 4, 8)))
    R.mk("swim_bladder", mb, sm,
         M("swim bladder (gas bladder)", None, None, None, "organ", "buoyancy", "organ", "mid",
           note="no swim bladder node in the files"), inside=0.9,
         shrink=st.get("swim_bladder", 1.0))
    km = get_mat("renal", rough=0.5)
    ts = np.linspace(0.26, 0.64, 24)
    P = [F.world(t, 0.0, VERT_NZ(t) - 0.17) for t in ts]
    mb = MB()
    mb.add(*tube(P, [0.0040 * F.size * (1 - 0.4 * (t - 0.26) / 0.38) for t in ts], 10))
    R.mk("kidney", mb, km, M("kidney (trunk kidney)", "UBERON_0002113", "kidney", DJ, "organ", "renal",
                             "organ", "mid"), inside=0.9)
    mb = MB()
    mb.add(*E((0.235, 0.0, 0.03), (0.022, 0.26, 0.09), LAT, LON))
    R.mk("head_kidney", mb, km, M("head kidney", "UBERON_0007132", "head kidney", DJ, "organ", "renal",
                                  "organ", "mid", note="also haematopoietic in teleosts"), inside=0.9)
    gom = get_mat("reproductive", rough=0.5)
    for sd, sg in SIDES:
        mb = MB()
        mb.add(*E((0.56, 0.24 * sg, -0.33), (0.09, 0.10, 0.07), LAT, LON))
        R.mk("gonad_" + sd, mb, gom, M("gonad, %s" % side_word(sd), "UBERON_0000991", "gonad", DJ, "organ",
                                       "reproductive", "organ", sd, note="sex not specified"), inside=0.9,
             shrink=st.get("gonad", 1.0))
    spm = get_mat("lymphoid", rough=0.45)
    mb = MB()
    mb.add(*E((0.37, -0.30, -0.30), (0.018, 0.10, 0.08), LAT, LON))
    R.mk("spleen", mb, spm, M("spleen", "UBERON_0002106", "spleen", DJ, "organ", "hematopoietic", "organ",
                              "mid"), inside=0.9)


# ============================================================== one full pass
def build_pass(reg, ps, size_rel, stage_shrink, fit=None, measure=None):
    F = Frame(ps, size_rel)
    build_skin(reg, F, TOPO, stage_shrink)
    build_eyes(reg, F, TOPO, stage_shrink)
    build_fins(reg, F, TOPO, stage_shrink, fit=fit, measure_into=measure)
    build_muscle(reg, F, TOPO, stage_shrink)
    build_skeleton(reg, F, TOPO, stage_shrink)
    build_organs(reg, F, TOPO, stage_shrink)
    return F


def check_inside(reg, F):
    problems = []
    for name, lim in reg.check.items():
        worst = 0.0
        for q in reg.verts[name]:
            if name == "intestine" and F.x_to_t(q[0]) > 0.66:
                continue
            worst = max(worst, F.norm_of(q))
        if worst > lim:
            problems.append([name, round(worst, 4), lim])
    return problems


# ============================================================== main
def main():
    global TOPO
    bpy.ops.wm.read_factory_settings(use_empty=True)
    TOPO = Topo(PSET)

    with open(STAGE_FILE, encoding="utf-8") as fh:
        STAGES_ALL = json.load(fh)
    plan = STAGES_ALL.get(ORG, {}) if STAGES_MODE != "none" else {}
    stage_list = plan.get("stages", []) if STAGES_MODE != "none" else []

    # ---- base pass (the adult / resolved design)
    fit = None
    if RES.get("record", {}).get("fit_span_area") or (ORG == "tff"):
        SLm = PSET["standard_length_m"]
        mpu = SLm / SL_REF_UNITS
        fit = {"on": True, "pelvic_k": 1.0, "caudal_k": 1.0,
               "targets": {"pectoral_span_m": PSET["pectoral_span_over_SL"] * SLm,
                           "pectoral_area_both_m2": PSET["pectoral_area_over_SL2"] * SLm ** 2,
                           "lifting_area_m2": 0.012688 * 3.865857}}
        # first pass to measure pelvic / caudal, then set their scale so the TOTAL lifting area
        # hits the spec with the real fish's surface shares
        tot_target_m2 = 0.012688 * 3.865857  # physics/flier: ref area x the TFF area multiplier
        shares = {"pelvic": 0.001837 / 0.012688, "caudal": 0.004474 / 0.012688}
        for _ in range(4):
            probe = Reg("collect")
            m0 = {}
            build_pass(probe, PSET, 1.0, {}, fit=fit, measure=m0)
            fit["pelvic_k"] *= math.sqrt((tot_target_m2 * shares["pelvic"]) /
                                         max(m0["pelvic_area_both_units"] * mpu ** 2, 1e-15))
            fit["caudal_k"] *= math.sqrt((tot_target_m2 * shares["caudal"]) /
                                         max(m0["caudal_area_units"] * mpu ** 2, 1e-15))
        print("FIT", json.dumps(fit))

    base = Reg("create")
    Fbase = build_pass(base, PSET, 1.0, {}, fit=fit, measure=MEAS)
    MEAS_BASE = dict(MEAS)
    probs = check_inside(base, Fbase)
    print("INSIDE_CHECK base", "OK" if not probs else probs)
    inside_report = {"base": probs}

    # ---- morph targets
    targets = []   # (name, {piece -> local vertex list}, meta)
    for stg in stage_list:
        ps2 = dict(PSET)
        ps2.update(stg["parameters"])
        reg = Reg("collect")
        F2 = build_pass(reg, ps2, stg["size_rel"], stg.get("shrink", {}), fit=fit)
        p2 = check_inside(reg, F2)
        inside_report[stg["key"]] = p2
        print("INSIDE_CHECK", stg["key"], "OK" if not p2 else p2)
        targets.append((stg["key"], reg, stg))

    if WANT_PARENTS and RES["kind"] == "design":
        for pr in RES["parents"]:
            pid = pr["organism"]
            pres = PRM.resolve(pid)
            ps2 = dict(pres["parameters"])
            ps2["mesh_detail"] = PSET["mesh_detail"]
            size_rel = ps2["standard_length_m"] / PSET["standard_length_m"]
            reg = Reg("collect")
            F2 = build_pass(reg, ps2, size_rel, {}, fit=None)
            p2 = check_inside(reg, F2)
            inside_report["parent_" + pid] = p2
            print("INSIDE_CHECK parent", pid, "OK" if not p2 else p2)
            targets.append(("parent_" + pid, reg, {"key": "parent_" + pid, "kind": "parent",
                                                   "organism": pid, "size_rel": size_rel,
                                                   "label": pres["name"]}))

    # ---- attach shape keys
    if targets:
        for name in base.order:
            ob = base.obj[name]
            me = ob.data
            ctr = np.array(ob.location[:])
            if not me.shape_keys:
                ob.shape_key_add(name="basis", from_mix=False)
            # the resolved design / adult itself, so the viewer's weights always sum to 1
            sk = ob.shape_key_add(name="base_" + ORG, from_mix=False)
            for tname, reg, _ in targets:
                sk = ob.shape_key_add(name=tname, from_mix=False)
                V = reg.verts[name]
                if len(V) != len(me.vertices):
                    raise RuntimeError("morph target %s/%s length %d != %d"
                                       % (tname, name, len(V), len(me.vertices)))
                for i, q in enumerate(V):
                    sk.data[i].co = (q[0] - ctr[0], q[1] - ctr[1], q[2] - ctr[2])
                sk.value = 0.0

    # ---- export
    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    kw = dict(filepath=GLB_PATH, export_format="GLB", export_yup=True,
              export_apply=SOLIDIFY_OK and not targets, export_extras=True, export_materials="EXPORT",
              export_cameras=False, export_lights=False, export_texcoords=True, export_normals=True,
              export_draco_mesh_compression_enable=False, export_image_format="AUTO",
              export_morph=bool(targets), export_morph_normal=False, export_morph_tangent=False)
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="MATERIAL", **kw)
    except TypeError:
        kw.pop("export_morph_tangent", None)
        bpy.ops.export_scene.gltf(**kw)

    MEAS.clear()
    MEAS.update(MEAS_BASE)
    write_manifest(base, Fbase, targets, inside_report, fit)
    print("EXPORTED", GLB_PATH, os.path.getsize(GLB_PATH), "bytes,", len(base.entries), "objects,",
          len(targets), "morph targets")
    if DO_RENDER:
        render_views(base, targets)


def write_manifest(base, F, targets, inside_report, fit):
    for e in base.entries:
        c = base.obj[e["object"]].location
        e["centre_gltf"] = [round(c.x, 5), round(c.z, 5), round(-c.y, 5)]
    order = ["object", "label", "hypothetical", "hypothetical_note", "ontology_id", "ontology_label",
             "ontology_source", "zfa_id", "level", "organ_system", "organ_system_id", "layer", "side",
             "colour", "geometry_basis", "driven_by_parameters", "nearest_ancestor_in_files",
             "ontology_note", "note", "centre_gltf"]
    ents = [{k: e[k] for k in order if k in e} for e in base.entries]
    SLm = PSET["standard_length_m"]
    la = MEAS.get("lifting_area_m2", 0.0)
    derived = {
        "pectoral_span_m": round(MEAS.get("pectoral_span_m", 0.0), 5),
        "pectoral_area_both_m2": round(MEAS.get("pectoral_area_both_m2", 0.0), 6),
        "pectoral_aspect_ratio": round(MEAS.get("pectoral_span_m", 0.0) ** 2 /
                                       max(MEAS.get("pectoral_area_both_m2", 1e-12), 1e-12), 3),
        "lifting_area_m2": round(la, 6),
        "wing_loading_N_m2": round(PSET["body_mass_kg"] * G / la, 3) if la > 0 else None,
        "caudal_lobe_asymmetry": round(PSET["caudal_lower_lobe_over_SL"] /
                                       max(PSET["caudal_upper_lobe_over_SL"], 1e-9), 4),
        "flight_muscle_volume_target_m3": MEAS.get("flight_muscle_volume_target_m3"),
        "flight_muscle_volume_realized_m3": MEAS.get("flight_muscle_volume_realized_m3"),
        "flight_muscle_fit_fraction": MEAS.get("flight_muscle_fit_fraction"),
        "flight_muscle_note": ("the pectoral girdle musculature is sized by VOLUME from "
                               "flight_muscle_fraction x body_mass, then clipped to what fits inside the "
                               "skin. fit_fraction < 1 means the requested muscle mass does not fit in "
                               "this body at this schematic geometry."),
        "measured_how": "areas are membrane surface areas measured on the exported mesh; span is the "
                        "tip-to-tip extent of the pectoral fins in the spanwise axis. The physical "
                        "values use standard_length_m / %.4f model units." % SL_REF_UNITS,
        "definitions": PRM.DERIVED,
    }
    pv = {
        "what": "the parameters ask for a span and an area; these are what the exported MESH actually has",
        "pectoral_span_m": {"parameter": round(PSET["pectoral_span_over_SL"] * SLm, 5),
                            "mesh": derived["pectoral_span_m"]},
        "pectoral_area_both_m2": {"parameter": round(PSET["pectoral_area_over_SL2"] * SLm ** 2, 6),
                                  "mesh": derived["pectoral_area_both_m2"]},
        "fit_was_applied": bool(fit and fit.get("on")),
    }
    for k in ("pectoral_span_m", "pectoral_area_both_m2"):
        a, b = pv[k]["parameter"], pv[k]["mesh"]
        pv[k]["mesh_over_parameter"] = round(b / a, 4) if a else None
    if not (fit and fit.get("on")):
        pv["verdict"] = ("NO FIT was applied: the pectoral geometry is driven by pectoral_len_over_SL "
                         "(this is what keeps the reference faithful to the committed flying-fish.glb). "
                         "The span and area parameters are therefore TARGETS THAT THE MESH DOES NOT MEET, "
                         "and the ratios above say by how much. For the flying fish this exposes a real "
                         "discrepancy: the committed mesh's pectoral membrane is much broader (lower "
                         "aspect ratio) than the Park & Choi 2010 specimen it is compared with. Note the "
                         "measured value is a projected planform area while the mesh value is membrane "
                         "surface area, which accounts for a few per cent, not for a factor of two.")
    else:
        pv["verdict"] = "fit applied; the mesh is solved to the span and area parameters"
    derived["parameter_vs_mesh_check"] = pv
    if ORG == "tff":
        spec = {"source": "physics/flier/tff/tff.json (v2) + physics/flier/design.py",
                "mass_kg": {"spec": 0.06, "built": PSET["body_mass_kg"]},
                "wing_loading_N_m2": {"spec": 12.0, "built": derived["wing_loading_N_m2"]},
                "lifting_area_m2": {"spec": 0.049050, "built": derived["lifting_area_m2"]},
                "span_m": {"spec": 0.664421, "built": derived["pectoral_span_m"]},
                "flight_muscle_fraction": {"spec": 0.16, "built": PSET["flight_muscle_fraction"]},
                "aspect_ratio": {"spec": 9.0, "spec_definition": "span^2 / TOTAL LIFTING AREA",
                                 "built_same_definition": round(derived["pectoral_span_m"] ** 2 /
                                                                max(derived["lifting_area_m2"], 1e-12), 3),
                                 "built_pectoral_only": derived["pectoral_aspect_ratio"]}}
        for k, v in spec.items():
            if isinstance(v, dict) and "spec" in v and isinstance(v.get("built"), (int, float)):
                v["relative_error"] = round((v["built"] - v["spec"]) / v["spec"], 5)
        spec["MISMATCHES_FOUND"] = [
            "DEFINITION MISMATCH in the spec itself: physics/flier/design.py keeps 'the fish's own aspect "
            "ratio' at 9.0-10.7 from Park & Choi, where AR = pectoral span^2 / PECTORAL area "
            "(0.261^2 / 0.006377 = 10.68). It then applies 9.0 to the TOTAL LIFTING AREA to get the span "
            "(span = sqrt(9 * W / 12)). Those are two different aspect ratios. On the real fish's own "
            "numbers span^2 / total lifting area is 5.37, not 10.7. Read the TFF's AR 9.0 as "
            "span^2/total-lifting-area; its pectoral-only AR is 17.9, i.e. its fins are far more slender "
            "than any measured flying fish's.",
            "ROUNDING: the round multipliers x3.9 (area) and x2.5 (span) give wing loading 11.90 N/m2 and "
            "AR 8.60, not 12.0 and 9.0. This build uses the exact ratios 0.04905/0.012688 = 3.865857 and "
            "0.664421/0.261 = 2.545674, which reproduce 12.0 and 9.0.",
            "TWO READINGS OF THE SPEC, AND NO MESH SATISFIES BOTH. (A) built here: the area multiplier "
            "3.865857 is applied to EVERY lifting surface, so total lifting area = 0.04905 m2 and wing "
            "loading = 12.0 N/m2 exactly, span^2/total = 9.0 exactly, and the pectoral-only AR comes out "
            "at 17.9. (B) the alternative: put ALL the extra area in the pectorals, giving pectoral area "
            "0.04905 m2 and pectoral AR = 0.664421^2/0.04905 = 9.0, which matches Park & Choi's own "
            "pectoral-AR convention - but then the total lifting area is 0.05536 m2 (pelvic and caudal "
            "stay real-sized) and wing loading falls to 10.63 N/m2, not 12.0. The spec names 12 N/m2 as "
            "the design decision, so (A) is shipped. This is the mismatch, not a build error.",
            "FLIGHT MUSCLE DOES NOT FIT: a flight-muscle fraction of 0.16 of 0.06 kg is 9.06e-6 m3 of "
            "muscle at 1060 kg/m3. Only %.0f%% of that volume fits inside the flying fish's body at the "
            "pectoral girdle in this geometry; the rest was clipped. That is a geometric result of the "
            "spec, not a modelling choice, and it is the single most interesting thing the mesh says "
            "about the design." % (100.0 * (derived.get("flight_muscle_fit_fraction") or 0.0)),
        ]
        derived["tff_spec_cross_check"] = spec
    morph = [{"name": "base_" + ORG, "kind": "resolved", "age_days": None, "size_rel": 1.0,
              "label": RES["name"],
              "note": "the resolved parameter set itself; weight 1 here = the adult / design as built"}]
    for tname, reg, stg in targets:
        morph.append({"name": tname, "kind": stg.get("kind", "stage"),
                      "age_days": stg.get("age_days"), "size_rel": round(stg.get("size_rel", 1.0), 5),
                      "label": stg.get("label", tname), "stage": stg.get("stage"),
                      "SL_m": stg.get("SL_m"), "mass_kg": stg.get("mass_kg"),
                      "organism": stg.get("organism"),
                      "shrunk_pieces": stg.get("shrink", {}),
                      "basis": stg.get("basis")})
    man = {
        "model": RES["name"],
        "id": ORG,
        "kind": RES["kind"],
        "hypothetical": HYPOTHETICAL,
        "file": (os.path.relpath(GLB_PATH, REPO).replace("\\", "/")
                 if os.path.splitdrive(GLB_PATH)[0].lower() == os.path.splitdrive(REPO)[0].lower()
                 else GLB_PATH.replace("\\", "/")),
        "built_with": "Blender %s (bpy, headless); anatomy-model/parametric/build.py" % bpy.app.version_string,
        "units_and_axes": ("glTF Y-up; head at +X, back at +Y, the fish's left side at -Z. The adult / "
                           "resolved set has SL = %.2f model units; earlier growth stages are built at "
                           "their TRUE relative size SL(age)/SL(adult), so development plays as real "
                           "growth. standard_length_m = %.4f m sets the metres per model unit."
                           % (SL_REF_UNITS, SLm)),
        "MORPHOLOGICAL_NOT_GENETIC": PRM.CAVEAT,
        "generative_model": "parameters = SUM over parents ( weight_i * parent_i.parameter ) + delta",
        "parents": RES["parents"],
        "moved_parameters": RES["moved_parameters"],
        "lean_recheck": RES.get("lean_recheck"),
        "parameters": PSET,
        "provenance_per_parameter": RES["provenance_per_parameter"],
        "derived_from_the_mesh": derived,
        "span_area_fit": fit,
        "morph_targets": morph,
        "morph_target_rule": ("set the weights of the two bracketing targets to (1-f, f) and every other "
                              "target to 0; weights always sum to 1. See "
                              "anatomy-model/parametric/INTEGRATION.md."),
        "inside_check": {"what": "superellipse norm of every internal piece against the skin surface; "
                                "<= the piece's limit means it does not poke outside",
                         "results": inside_report},
        "levels": "body / organ system / organ / tissue",
        "layers": "outer (skin, eyes, fin membranes) / muscle / skeleton / organ",
        "ontology_sources": [DJ, FS],
        "mesh_detail": PSET["mesh_detail"],
        "n_objects": len(ents),
        "objects": ents,
    }
    if ORG in PRM.DESIGNS:
        man["design_record"] = PRM.DESIGNS[ORG]
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(man, fh, indent=1)


# ============================================================== renders
def render_views(base, targets):
    os.makedirs(RENDER_DIR, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 1100, 640
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("world")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.84, 0.87, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    for nm, rot, en in (("key", (0.7, 0.2, 0.6), 3.2), ("fill", (-0.9, -0.3, -2.4), 1.2)):
        ld = bpy.data.lights.new(nm, "SUN")
        ld.energy = en
        lo = bpy.data.objects.new(nm, ld)
        lo.rotation_euler = rot
        sc.collection.objects.link(lo)
    tgt = bpy.data.objects.new("cam_target", None)
    sc.collection.objects.link(tgt)
    cd = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"

    allobj = [e["object"] for e in base.entries]

    def show(names):
        s = set(names)
        for n in allobj:
            base.obj[n].hide_render = n not in s

    def set_weights(active):
        for n in allobj:
            ks = base.obj[n].data.shape_keys
            if not ks:
                continue
            for kb in ks.key_blocks:
                if kb.name != "basis":
                    kb.value = 1.0 if kb.name == active else 0.0

    def bbox():
        lo = np.array([1e9] * 3)
        hi = -lo
        dg = bpy.context.evaluated_depsgraph_get()
        for n in allobj:
            ob = base.obj[n]
            if ob.hide_render:
                continue
            ev = ob.evaluated_get(dg)
            for c in ev.bound_box:
                p = np.array((ob.matrix_world @ mathutils.Vector(c))[:])
                lo = np.minimum(lo, p)
                hi = np.maximum(hi, p)
        return lo, hi

    FIXED = {}

    def shoot(name, ortho_axis="y", pad=1.18, fixed=None, only=None):
        lo, hi = bbox() if only is None else only
        ctr = (lo + hi) / 2
        ext = hi - lo
        ar = sc.render.resolution_x / float(sc.render.resolution_y)
        if ortho_axis == "y":
            scale = max(ext[0], ext[2] * ar) * pad
            cam.location = (ctr[0], ctr[1] + max(ext[1], 0.1) * 3 + 1.5, ctr[2])
        else:
            e = max(ext[0], ext[1], ext[2])
            scale = max(e, e * ar * 0.72) * pad
            d = e * 2.5 + 1.0
            cam.location = (ctr[0] + d * 0.5, ctr[1] + d * 0.8, ctr[2] + d * 0.5)
        if fixed is not None:
            ctr, scale = fixed
            if ortho_axis == "y":
                cam.location = (ctr[0], ctr[1] + 3.0, ctr[2])
        tgt.location = tuple(ctr)
        FIXED[name] = (ctr, scale)
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = max(scale, 1e-3)
        sc.render.filepath = os.path.join(RENDER_DIR, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)

    skin = [n for n in allobj if n.startswith("skin_")]
    show(allobj)
    set_weights("base_" + ORG)
    shoot("%s_01_adult_lateral" % ORG, "y")
    shoot("%s_02_adult_3q" % ORG, "3q")
    show([n for n in allobj if n not in skin])
    shoot("%s_03_adult_inside" % ORG, "3q")
    # pectoral girdle close-up: the piece flight_muscle_fraction drives
    gpieces = [n for n in allobj if n.startswith(("pectoral_muscle_", "cleithrum_", "scapula_",
                                                  "coracoid_", "muscle_", "vertebra_0"))]
    if gpieces:
        show(gpieces)
        lo = np.array([1e9] * 3)
        hi = -lo
        for n in ("pectoral_muscle_L", "pectoral_muscle_R", "cleithrum_L", "cleithrum_R"):
            if n not in base.obj:
                continue
            ob = base.obj[n]
            for c in ob.bound_box:
                q = np.array((ob.matrix_world @ mathutils.Vector(c))[:])
                lo = np.minimum(lo, q)
                hi = np.maximum(hi, q)
        shoot("%s_05_pectoral_girdle" % ORG, "3q", pad=1.6, only=(lo, hi))
    show(allobj)
    set_weights("base_" + ORG)
    shoot("%s_06_adult_frame" % ORG, "y")
    frame = FIXED["%s_06_adult_frame" % ORG]
    for tname, reg, stg in targets:
        set_weights(tname)
        shoot("%s_04_%s" % (ORG, tname), "y")
        if stg.get("kind", "stage") == "stage":
            shoot("%s_07_to_scale_%s" % (ORG, tname), "y", fixed=frame)
    set_weights("base_" + ORG)


main()
