"""Procedural, segmented 3D model of a flying fish (Exocoetidae) for the DELPHI blueprint viewer.

Run headless with Blender 4.2.23 LTS:

    blender.exe -b --factory-startup --python anatomy-model/build_fish.py -- \
        [--glb PATH] [--manifest PATH] [--renders DIR] [--no-render] [--samples N]

Everything is built from parametric functions in this file; no external meshes are used.
Only ONE proportion is evidence-backed: pectoral fin length / standard length (Daane et al. 2021,
Data S1A, median of 49 flying-fish specimens, recomputed in genotype/cache/daane2021_fin_ratios.json).
Every other shape, position, size and count is schematic (textbook-generic teleost) and is marked
so in the manifest.

Coordinates while building (Blender, Z up): head at +X, back at +Z, the fish's LEFT side at +Y.
The glTF export is Y-up, so in the GLB: head +X, back +Y, fish's left side at -Z.
"""
import bpy
import bmesh
import json
import math
import os
import sys
import shutil
import numpy as np

# ----------------------------------------------------------------------------- arguments
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def _arg(flag, default):
    if flag in argv:
        return argv[argv.index(flag) + 1]
    return default


GLB_PATH = _arg("--glb", os.path.join(REPO, "dashboard", "public", "blueprint3d", "model", "flying-fish.glb"))
MANIFEST_PATH = _arg("--manifest", os.path.join(HERE, "manifest.json"))
RENDER_DIR = _arg("--renders", r"C:\Temp\fish-models\renders")
DO_RENDER = "--no-render" not in argv
SAMPLES = int(_arg("--samples", "24"))
ONLY_RENDER = _arg("--only", "")  # comma list of render names, for iteration

# ----------------------------------------------------------------------------- evidence
DAANE_FILE = os.path.join(REPO, "genotype", "cache", "daane2021_fin_ratios.json")
with open(DAANE_FILE, encoding="utf-8") as fh:
    _daane = json.load(fh)
PECT_RATIO = float(_daane["groups"]["flying fish"]["pectoral_over_SL_median"])  # 0.687
PECT_N = int(_daane["groups"]["flying fish"]["n_specimens"])
DAANE_BASIS = ("evidence: pectoral fin length / standard length = %.3f (median of %d flying-fish "
               "specimens, Daane et al. 2021 Curr Biol Data S1A, recomputed in "
               "genotype/cache/daane2021_fin_ratios.json); fin shape, spread and ray layout schematic"
               % (PECT_RATIO, PECT_N))
SCHEMATIC = "schematic"

# ----------------------------------------------------------------------------- body frame
X0 = 0.50            # snout x
SL = 0.82            # standard length (snout to caudal fin base); total length with caudal fin ~0.97
H = 0.085 * SL       # max half body depth   (schematic: body depth ~0.17 SL)
W = 0.068 * SL       # max half body width   (schematic)
NEXP = 2.3           # superellipse exponent of the cross-section (rounded, slightly flat belly)
NOSE = 0.20          # fraction of SL over which the head rounds off
PH, PW = 0.30, 0.35  # caudal peduncle depth / width as fraction of max (schematic)
T_END = 1.04         # body tip just inside the caudal fin base
SKIN_T = 0.0015      # skin shell thickness


def _env(t, p):
    if t <= 0.0:
        return 0.0
    if t < NOSE:
        a = t / NOSE
        return math.sqrt(max(a * (2 - a), 0.0))
    if t <= 0.42:
        return 1.0
    if t <= 0.95:
        return p + (1 - p) * 0.5 * (1 + math.cos(math.pi * (t - 0.42) / 0.53))
    if t <= 1.0:
        return p
    u = min((t - 1.0) / (T_END - 1.0), 1.0)
    return p * math.sqrt(max(1 - u * u, 0.0))


def eh(t):
    return _env(t, PH)


def ew(t):
    return _env(t, PW)


def world(t, ny, nz):
    """normalized body coords -> Blender world. ny, nz are fractions of the local half width / depth."""
    return (X0 - t * SL, ny * W * ew(t), nz * H * eh(t))


def section(theta, s=1.0, side=1):
    """superellipse cross-section point (ny, nz) at angle theta in [-pi/2, pi/2] (belly -> back)."""
    c, sn = math.cos(theta), math.sin(theta)
    ny = s * math.copysign(abs(c) ** (2.0 / NEXP), c) * side
    nz = s * math.copysign(abs(sn) ** (2.0 / NEXP), sn)
    return ny, nz


def body_pt(t, theta, s=1.0, side=1):
    ny, nz = section(theta, s, side)
    return world(t, ny, nz)


def x_to_t(x):
    return (X0 - x) / SL


def norm_of(p):
    """superellipse norm of a world point: <1 inside the outer skin surface."""
    t = x_to_t(p[0])
    hh, ww = H * eh(t), W * ew(t)
    if hh < 1e-6 or ww < 1e-6:
        return 9.0
    return (abs(p[1] / ww) ** NEXP + abs(p[2] / hh) ** NEXP) ** (1.0 / NEXP)


def local_radius(t):
    return max(min(W * ew(t), H * eh(t)), 1e-4)

# ----------------------------------------------------------------------------- colours / materials


def hex_lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def srgb_lin(rgb):
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]


# palette, by organ system / layer
PAL = {
    "skin":        "#7F97AE",  # base factor for the skin (vertex colours carry blue back -> silver belly)
    "eye":         "#C0C6CC",
    "fin":         "#4E6E8E",  # fin membrane (slightly translucent)
    "muscle":      "#D9727A",  # pinkish red
    "bone":        "#F2EAD3",  # ivory
    "ray":         "#E6DCC0",  # fin rays, ivory slightly darker
    "nervous":     "#F2C14E",  # brain, spinal cord
    "respiratory": "#B5174B",  # gills
    "circulatory": "#D32F2F",  # heart
    "liver":       "#8D4E2A",  # digestive: liver
    "gut":         "#E8A87C",  # digestive: oesophagus, intestine
    "bladder":     "#DCE3E8",  # swim bladder (gas bladder)
    "renal":       "#26A69A",  # kidney, head kidney
    "reproductive": "#F6B26B",  # gonads
    "lymphoid":    "#6D214F",  # spleen
}
MATS = {}


def get_mat(key, alpha=1.0, metallic=0.0, rough=0.5, vcol=False, normal_img=None):
    name = "mat_" + key
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    col = hex_lin(PAL[key]) + [1.0]
    bsdf.inputs["Base Color"].default_value = col
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    m.use_backface_culling = False
    m.diffuse_color = col
    if vcol:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    if normal_img is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = normal_img
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.6
        nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    MATS[name] = m
    return m


def make_scale_normal_map(size=256):
    """Imbricate scale pattern -> tangent-space normal map (procedural, no external texture)."""
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float64)
    u = xs / size * 4.0   # 4 scales across the tile along the body
    v = ys / size * 4.0   # 4 rows
    hgt = np.zeros_like(u)
    R = 0.62
    for row in range(-1, 6):
        off = 0.5 * (row % 2)
        for colm in range(-1, 6):
            cu, cv = colm + off, row
            du = u - cu
            dv = v - cv
            d = np.sqrt(du * du + dv * dv)
            dome = np.clip(1 - (d / R) ** 2, 0, 1) * (0.55 + 0.45 * np.clip(du / R + 0.5, 0, 1))
            hgt = np.maximum(hgt, dome)
    gy, gx = np.gradient(hgt)
    k = 6.0
    nx, ny_, nz = -gx * k, -gy * k, np.ones_like(hgt)
    ln = np.sqrt(nx * nx + ny_ * ny_ + nz * nz)
    nx, ny_, nz = nx / ln, ny_ / ln, nz / ln
    rgba = np.stack([nx * 0.5 + 0.5, ny_ * 0.5 + 0.5, nz * 0.5 + 0.5, np.ones_like(nz)], axis=-1)
    img = bpy.data.images.new("skin_scales_normal", size, size, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.file_format = "PNG"
    img.pack()
    return img

# ----------------------------------------------------------------------------- geometry helpers


class MB:
    """mesh builder: accumulate parts into one mesh"""

    def __init__(self):
        self.V, self.F, self.UV, self.C = [], [], [], []

    def add(self, V, F, uv=None, col=None):
        o = len(self.V)
        self.V.extend([tuple(map(float, p)) for p in V])
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
    """closed solid between two (nu, nv, 3) grids"""
    nu, nv = len(outer), len(outer[0])
    V = [p for row in outer for p in row] + [p for row in inner for p in row]
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
    F = []
    top = len(V) - 1
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


def ellipsoid_world(c, r, nlat=12, nlon=18, rot_z=0.0):
    V, F = unit_sphere(nlat, nlon)
    cz, sz = math.cos(rot_z), math.sin(rot_z)
    out = []
    for p in V:
        x, y, z = p[0] * r[0], p[1] * r[1], p[2] * r[2]
        x, z = x * cz - z * sz, x * sz + z * cz   # tilt in the x-z plane
        out.append((c[0] + x, c[1] + y, c[2] + z))
    return out, F


def ellipsoid_norm(c, r, nlat=12, nlon=18):
    """ellipsoid defined in normalized body coords (t, ny, nz) -> follows the body taper"""
    V, F = unit_sphere(nlat, nlon)
    return [world(c[0] + p[0] * r[0], c[1] + p[1] * r[1], c[2] + p[2] * r[2]) for p in V], F


def tube(P, R, nseg=8, cap=True):
    P = np.asarray(P, dtype=float)
    N = len(P)
    R = np.broadcast_to(np.asarray(R, dtype=float), (N,))
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None] + 1e-12
    ref = np.array([0, 0, 1.0]) if abs(T[0][2]) < 0.9 else np.array([1.0, 0, 0])
    nrm = np.cross(T[0], ref)
    nrm /= np.linalg.norm(nrm)
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
    """Catmull-Rom through control points, n samples"""
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

# ----------------------------------------------------------------------------- object registry


ENTRIES = []
OBJ = {}
CHECK_INSIDE = {}   # name -> max allowed superellipse norm


def mk(name, mb, mat, meta, closed=True, smooth=True, solidify=None, solid_offset=-1.0,
       inside=None, outward_axis=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(mb.V, [], mb.F)
    me.validate(clean_customdata=False)
    bm = bmesh.new()
    bm.from_mesh(me)
    if closed:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    elif outward_axis is not None:
        # open shell: make normals point away from the given axis function
        bm.normal_update()
        score = 0.0
        for f in bm.faces:
            c = f.calc_center_median()
            a = outward_axis(c)
            score += (c - a).dot(f.normal)
        if score < 0:
            for f in bm.faces:
                f.normal_flip()
    bm.to_mesh(me)
    bm.free()
    if any(uv != (0.0, 0.0) for uv in mb.UV):
        uvl = me.uv_layers.new(name="UVMap")
        for loop in me.loops:
            uvl.data[loop.index].uv = mb.UV[loop.vertex_index]
    if any(c is not None for c in mb.C):
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        for i, c in enumerate(mb.C):
            attr.data[i].color = (c or [1, 1, 1]) + [1.0] if len(c or [1, 1, 1]) == 3 else c
    me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    # origin at the bounding-box centre (helps the viewer fly to / explode pieces)
    co = np.array([v.co[:] for v in me.vertices])
    ctr = (co.min(0) + co.max(0)) / 2
    me.transform(__import__("mathutils").Matrix.Translation(-__import__("mathutils").Vector(ctr)))
    ob.location = ctr
    if solidify:
        md = ob.modifiers.new("solidify", "SOLIDIFY")
        md.thickness = solidify
        md.offset = solid_offset
        md.use_rim = True
        md.use_even_offset = True
    meta = dict(meta)
    meta["object"] = name
    meta["colour"] = meta.get("colour") or "#%s" % PAL_KEY_HEX(mat)
    for k in ("ontology_id", "layer", "side", "organ_system", "level"):
        ob[k] = meta.get(k) if meta.get(k) is not None else ""
    ob["label"] = meta["label"]
    ENTRIES.append(meta)
    OBJ[name] = ob
    if inside is not None:
        CHECK_INSIDE[name] = inside
    return ob


def PAL_KEY_HEX(mat):
    return PAL[mat.name[4:]].lstrip("#")


# ----------------------------------------------------------------------------- ontology table
# ids looked up in dashboard/public/blueprint3d/data.json ("terms") and genotype/fin-subtree.json
# (ZFA nodes with their Uberon xrefs). null where no node exists in either file.
DJ = "dashboard/public/blueprint3d/data.json"
FS = "genotype/fin-subtree.json"
SYS = {  # organ system -> (label, id in data.json)
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


def M(label, oid, olabel, src, level, system, layer, side, basis=SCHEMATIC, nearest=None, note=None,
      zfa=None, colour=None):
    sl, sid = SYS[system]
    d = {"label": label, "ontology_id": oid, "ontology_label": olabel, "ontology_source": src,
         "level": level, "organ_system": sl, "organ_system_id": sid, "layer": layer, "side": side,
         "geometry_basis": basis}
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
    return d


SIDES = (("L", 1), ("R", -1))


def side_word(sd):
    return "left" if sd == "L" else "right"

# ============================================================================ BUILD


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_skin(img):
    mat = get_mat("skin", metallic=0.35, rough=0.38, vcol=True, normal_img=img)
    NU, NV = 110, 40
    ts = np.concatenate([np.linspace(0.0, 1.0, NU - 8), np.linspace(1.0, T_END, 9)[1:]])
    ths = np.linspace(-math.pi / 2, math.pi / 2, NV)
    blue = srgb_lin((0.05, 0.13, 0.33))
    steel = srgb_lin((0.35, 0.45, 0.58))
    silver = srgb_lin((0.78, 0.82, 0.86))
    belly = srgb_lin((0.93, 0.95, 0.96))

    def lerp(a, b, f):
        f = min(max(f, 0.0), 1.0)
        return [a[i] + (b[i] - a[i]) * f for i in range(3)]
    for sd, sg in SIDES:
        mb = MB()
        V, UV, C = [], [], []
        for t in ts:
            for th in ths:
                V.append(body_pt(t, th, 1.0, sg))
                UV.append((t * 36.0, (th + math.pi / 2) / math.pi * 7.0))
                z = math.sin(th)
                if z > 0.45:
                    col = lerp(steel, blue, (z - 0.45) / 0.35)
                elif z > 0.05:
                    col = lerp(silver, steel, (z - 0.05) / 0.40)
                else:
                    col = lerp(belly, silver, (z + 0.7) / 0.75)
                C.append(col)
        F = grid_faces(len(ts), NV)
        if sg < 0:
            F = [tuple(reversed(f)) for f in F]
        mb.add(V, F, UV, C)
        mk("skin_" + sd, mb, mat,
           M("skin and scales, %s half" % side_word(sd), "UBERON_0002097", "skin of body", DJ, "organ",
             "integumental", "outer", sd,
             note="body shell; scale pattern is a procedural normal map, not a scale count",
             colour="vertex colours (COLOR_0): #0D2154 back -> #597394 sides -> #EEF2F5 belly; material factor white"),
           closed=False, solidify=SKIN_T, solid_offset=-1.0,
           outward_axis=lambda c: __import__("mathutils").Vector((c.x, 0.0, 0.0)))


EYE = {}


def build_eyes():
    mat = get_mat("eye", metallic=0.6, rough=0.25, vcol=True)
    te = 0.075
    re = 0.020
    hh, ww = H * eh(te), W * ew(te)
    for sd, sg in SIDES:
        ny_s, nz_s = section(math.radians(10), 1.0, 1)
        c = (X0 - te * SL, sg * (ww * ny_s - re * 0.62 + 0.0035), 0.16 * hh)
        EYE[sd] = (c, re)
        # poles on the lateral axis so the pupil and iris are round rings
        Vs, F = unit_sphere(22, 36)
        V = [(c[0] + q[0] * re, c[1] + sg * q[2] * re * 0.70, c[2] + q[1] * re * 0.95) for q in Vs]
        if sg < 0:
            F = [tuple(reversed(f)) for f in F]
        C = []
        for q in Vs:
            lat = q[2]
            if lat > 0.86:
                C.append(srgb_lin((0.02, 0.02, 0.03)))
            elif lat > 0.55:
                C.append(srgb_lin((0.66, 0.58, 0.32)))
            else:
                C.append(srgb_lin((0.86, 0.88, 0.91)))
        mb = MB()
        mb.add(V, F, None, C)
        mk("eye_" + sd, mb, mat,
           M("eye, %s" % side_word(sd), "UBERON_0000970", "eye", DJ, "organ", "sensory", "outer", sd,
             note="large lateral eye; size and position schematic",
             colour="vertex colours (COLOR_0): #DBE0E8 eyeball, #A8944F iris, #050508 pupil; material factor white"))


def fin(name_m, name_r, rays, mat_m, mat_r, meta_m, meta_r, individual_rays=False, ray_label=None,
        ray_meta_fn=None, r0=0.0022, r1=0.0005, mem_t=0.0008):
    """rays: list of (N,3) centerline arrays ordered across the fin. Builds membrane + rays."""
    ns = len(rays[0])
    mb = MB()
    V = [tuple(p) for r in rays for p in r]
    mb.add(V, grid_faces(len(rays), ns))
    mk(name_m, mb, mat_m, meta_m, closed=False, solidify=mem_t, solid_offset=0.0)
    if individual_rays:
        for k, r in enumerate(rays):
            rb = MB()
            rb.add(*tube(r, np.linspace(r0, r1, len(r)), 6))
            mk("%s_%02d" % (name_r, k + 1), rb, mat_r, ray_meta_fn(k))
    else:
        rb = MB()
        for r in rays:
            rb.add(*tube(r, np.linspace(r0, r1, len(r)), 6))
        mk(name_r, rb, mat_r, meta_r)


def ray_line(base, direction, L, bend, ns=16):
    s = np.linspace(0, 1, ns)[:, None]
    return np.asarray(base) + np.asarray(direction) * L * s + np.asarray(bend) * L * s ** 2


PECT_MEASURED = {}


def build_fins():
    mfin = get_mat("fin", alpha=0.82, rough=0.45)
    mray = get_mat("ray", rough=0.5)
    # ---- pectoral fins: the evidence-backed proportion
    L_PECT = PECT_RATIO * SL
    NPR = 14  # illustrative ray count
    for sd, sg in SIDES:
        rays = []
        for k in range(NPR):
            f = k / (NPR - 1)
            t = 0.228 + 0.022 * f
            th = math.pi * (0.26 - 0.16 * f)
            base = body_pt(t, th, 0.93, sg)
            phi = math.radians(22 + 58 * f)
            dlt = math.radians(10 - 6 * f)
            d = (-math.sin(phi) * math.cos(dlt), sg * math.cos(phi) * math.cos(dlt), math.sin(dlt))
            prof = 0.85 + 0.15 * (f / 0.2) if f <= 0.2 else 1 - 0.55 * ((f - 0.2) / 0.8) ** 1.3
            rays.append(ray_line(base, d, L_PECT * prof, (-0.07, 0, -0.02)))
        # rescale so the longest ray measures exactly L_PECT from base to tip (straight-line)
        longest = max(float(np.linalg.norm(r[-1] - r[0])) for r in rays)
        rays = [r[0] + (r - r[0]) * (L_PECT / longest) for r in rays]
        PECT_MEASURED[sd] = max(float(np.linalg.norm(r[-1] - r[0])) for r in rays) / SL
        fin("pectoral_fin_" + sd, "pectoral_fin_ray_" + sd, rays, mfin, mray,
            M("pectoral fin (membrane), %s; enlarged, spread for gliding" % side_word(sd), "UBERON_0000151",
              "pectoral fin", DJ + "; " + FS, "organ", "musculoskeletal", "outer", sd, basis=DAANE_BASIS,
              zfa="ZFA:0001161",
              note="longest ray = %.3f SL = %.4f model units (SL = %.2f)" % (PECT_RATIO, L_PECT, SL)),
            None, individual_rays=True,
            ray_meta_fn=lambda k, sd=sd: M("pectoral fin ray %d (lepidotrichium), %s" % (k + 1, side_word(sd)),
                                           "UBERON_4000175", "pectoral fin lepidotrichium", FS, "organ",
                                           "musculoskeletal", "skeleton", sd,
                                           basis="ray length follows the pectoral fin length ratio (evidence, "
                                                 "longest ray); ray count %d is illustrative" % NPR,
                                           zfa="ZFA:0001551"))
    # ---- pelvic fins (schematic; abdominal, ventrolateral)
    for sd, sg in SIDES:
        rays = []
        for k in range(6):
            f = k / 5
            base = body_pt(0.585 + 0.016 * f, math.pi * (-0.36 + 0.06 * f), 0.93, sg)
            phi = math.radians(30 + 42 * f)
            dlt = math.radians(-14 + 4 * f)
            d = (-math.sin(phi) * math.cos(dlt), sg * math.cos(phi) * math.cos(dlt), math.sin(dlt))
            rays.append(ray_line(base, d, 0.22 * SL * (1 - 0.45 * f), (-0.05, 0, 0), 12))
        fin("pelvic_fin_" + sd, "pelvic_fin_rays_" + sd, rays, mfin, mray,
            M("pelvic fin (membrane), %s" % side_word(sd), None, None, None, "organ", "musculoskeletal",
              "outer", sd, nearest="UBERON_0002204 musculoskeletal system",
              note="size (0.22 SL) and position schematic; pelvic/SL data exist in Daane Data S1A but "
                   "were not used"),
            M("pelvic fin rays, %s (6, illustrative)" % side_word(sd), None, None, None, "organ",
              "musculoskeletal", "skeleton", sd, nearest="UBERON_0004765 skeletal element"),
            r0=0.0016, r1=0.0004)
    # ---- dorsal fin (posterior, opposite the anal fin)
    rays = []
    for k in range(12):
        f = k / 11
        base = world(0.665 + 0.185 * f, 0.0, 0.95)
        psi = math.radians(38 + 18 * f)
        rays.append(ray_line(base, (-math.sin(psi), 0, math.cos(psi)), 0.10 * SL * (1 - 0.55 * f),
                             (-0.04, 0, 0), 12))
    fin("dorsal_fin", "dorsal_fin_rays", rays, mfin, mray,
        M("dorsal fin (membrane)", None, None, None, "organ", "musculoskeletal", "outer", "mid",
          nearest="UBERON_0002204 musculoskeletal system", note="position and height schematic"),
        M("dorsal fin rays (12, illustrative)", None, None, None, "organ", "musculoskeletal", "skeleton", "mid",
          nearest="UBERON_0004765 skeletal element"), r0=0.0014, r1=0.0004)
    # ---- anal fin
    rays = []
    for k in range(11):
        f = k / 10
        base = world(0.70 + 0.16 * f, 0.0, -0.95)
        psi = math.radians(38 + 18 * f)
        rays.append(ray_line(base, (-math.sin(psi), 0, -math.cos(psi)), 0.085 * SL * (1 - 0.5 * f),
                             (-0.04, 0, 0), 12))
    fin("anal_fin", "anal_fin_rays", rays, mfin, mray,
        M("anal fin (membrane)", None, None, None, "organ", "musculoskeletal", "outer", "mid",
          nearest="UBERON_0002204 musculoskeletal system", note="position and height schematic"),
        M("anal fin rays (11, illustrative)", None, None, None, "organ", "musculoskeletal", "skeleton", "mid",
          nearest="UBERON_0004765 skeletal element"), r0=0.0014, r1=0.0004)
    # ---- caudal fin: deeply forked, lower lobe longer
    rays = []
    NC = 19
    hb = H * eh(1.0)
    Lu, Ll, Lm = 0.19 * SL, 0.27 * SL, 0.07 * SL
    for k in range(NC):
        f = k / (NC - 1)
        base = (X0 - 0.985 * SL, 0.0, hb * (0.92 - 1.84 * f))
        a = math.radians(42 - 84 * f)
        if f < 0.5:
            L = Lm + (Lu - Lm) * ((0.5 - f) / 0.5) ** 1.4
        else:
            L = Lm + (Ll - Lm) * ((f - 0.5) / 0.5) ** 1.4
        rays.append(ray_line(base, (-math.cos(a), 0, math.sin(a)), L, (0, 0, 0.03 * math.copysign(1, a)), 14))
    fin("caudal_fin", "caudal_fin_rays", rays, mfin, mray,
        M("caudal fin (membrane), forked, lower lobe longer", None, None, None, "organ", "musculoskeletal",
          "outer", "mid", nearest="UBERON_0002204 musculoskeletal system",
          note="lobe lengths schematic (upper 0.19 SL, lower 0.27 SL)"),
        M("caudal fin rays (19, illustrative)", None, None, None, "organ", "musculoskeletal", "skeleton", "mid",
          nearest="UBERON_0004765 skeletal element"), r0=0.0016, r1=0.0004)


def wfun(nz):
    # W-shaped myoseptum: anterior-pointing cone at the horizontal septum (nz=0),
    # posterior-pointing cones dorsally and ventrally (nz=+-0.5)
    return 2 * abs(2 * abs(nz) - 1) - 1


def build_muscle():
    mat = get_mat("muscle", rough=0.6)
    NM = 32   # illustrative myomere count
    t0, t1 = 0.25, 0.985
    edges = np.linspace(t0, t1, NM + 1)
    A = 0.6 * (edges[1] - edges[0])
    gap = 0.06 * (edges[1] - edges[0])
    NTH = 30
    ths = np.linspace(-math.pi / 2, math.pi / 2, NTH)
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
                    s_out = 1 - (SKIN_T + 0.0012) / local_radius(t)
                    s_in = 0.60 if t < 0.65 else 0.60 - 0.22 * (t - 0.65) / 0.35
                    ro.append(body_pt(t, th, s_out, sg))
                    ri.append(body_pt(t, th, s_in, sg))
                outer.append(ro)
                inner.append(ri)
            mb.add(*slab(outer, inner))
        mk("muscle_" + sd, mb, mat,
           M("trunk musculature: myomeres (W-shaped segments), %s" % side_word(sd), None, None, None, "tissue",
             "musculoskeletal", "muscle", sd, nearest="UBERON_0002204 musculoskeletal system",
             note="no myotome/axial-muscle node in the files; %d myomeres is illustrative" % NM),
           inside=0.995)


VERT_NZ = lambda t: 0.22 - 0.22 * min(max((t - 0.6) / 0.4, 0), 1) ** 1.2


def build_skeleton():
    bone = get_mat("bone", rough=0.55)
    NV_ = 40  # illustrative vertebra count
    t0, t1 = 0.215, 0.99
    step = (t1 - t0) / NV_
    for i in range(NV_):
        tc = t0 + step * (i + 0.5)
        hh = H * eh(tc)
        rc = max(0.13 * hh, 0.0018)
        cx, cz = X0 - tc * SL, VERT_NZ(tc) * hh
        Lc = step * SL * 0.86
        mb = MB()
        # amphicoelous centrum (hourglass)
        xs = np.linspace(cx + Lc / 2, cx - Lc / 2, 7)
        rad = rc * (1 - 0.25 * np.sin(np.linspace(0, math.pi, 7)))
        mb.add(*tube(np.stack([xs, np.zeros(7), np.full(7, cz)], 1), rad, 12))
        # neural spine
        top = world(tc + 0.03, 0.0, 0.86 if tc < 0.95 else 0.7)
        p0 = np.array([cx, 0, cz + rc * 0.8])
        mb.add(*tube(np.linspace(p0, np.array(top), 6), np.linspace(rc * 0.35, rc * 0.12, 6), 5))
        if tc > 0.62:  # haemal spine on caudal vertebrae
            bot = world(tc + 0.03, 0.0, -0.84 if tc < 0.95 else -0.7)
            p0 = np.array([cx, 0, cz - rc * 0.8])
            mb.add(*tube(np.linspace(p0, np.array(bot), 6), np.linspace(rc * 0.35, rc * 0.12, 6), 5))
        mk("vertebra_%02d" % (i + 1), mb, bone,
           M("vertebra %d (centrum + spines)" % (i + 1), None, None, None, "organ", "musculoskeletal",
             "skeleton", "mid", nearest="UBERON_0004765 skeletal element (vertebral column has no node)",
             note="%d vertebrae is illustrative, not a flying-fish count" % NV_), inside=0.98)
    # pleural ribs on abdominal vertebrae
    for sd, sg in SIDES:
        mb = MB()
        for i in range(NV_):
            tc = t0 + step * (i + 0.5)
            if tc < 0.26 or tc > 0.62:
                continue
            ctrl = [(tc, 0.10 * sg, VERT_NZ(tc)), (tc + 0.01, 0.45 * sg, 0.12), (tc + 0.03, 0.57 * sg, -0.15),
                    (tc + 0.05, 0.47 * sg, -0.5)]
            P = spline([world(*c) for c in ctrl], 14)
            mb.add(*tube(P, np.linspace(0.0011, 0.0005, 14), 5))
        mk("ribs_" + sd, mb, bone,
           M("pleural ribs, %s" % side_word(sd), None, None, None, "organ", "musculoskeletal", "skeleton", sd,
             nearest="UBERON_0004765 skeletal element", note="rib count follows the illustrative vertebrae"),
           inside=0.98)
    # skull: simplified neurocranium/skull roof, as two halves, with orbit openings
    for sd, sg in SIDES:
        NT_, NTH_ = 64, 32
        ts = np.linspace(0.015, 0.212, NT_)
        ths = np.linspace(0.02 * math.pi, 0.5 * math.pi, NTH_)
        V = [body_pt(t, th, 0.84, sg) for t in ts for th in ths]
        ec, er = EYE[sd]
        ecn = np.array(ec)

        def mask(i, j, V=V):
            p = (np.array(V[i * NTH_ + j]) + np.array(V[(i + 1) * NTH_ + j + 1])) / 2
            return np.linalg.norm(p - ecn) > er * 1.15
        F = grid_faces(NT_, NTH_, mask)
        if sg < 0:
            F = [tuple(reversed(f)) for f in F]
        mb = MB()
        mb.add(V, F)
        mk("skull_" + sd, mb, bone,
           M("skull (simplified: skull roof / neurocranium shell), %s half" % side_word(sd), None, None, None,
             "organ", "musculoskeletal", "skeleton", sd, nearest="UBERON_0004765 skeletal element",
             note="jaws, opercular and branchial bones not modelled"),
           closed=False, solidify=0.0022, solid_offset=-1.0,
           outward_axis=lambda c: __import__("mathutils").Vector((c.x, 0.0, 0.0)))
    # pectoral girdle
    for sd, sg in SIDES:
        ths = np.linspace(0.42 * math.pi, -0.49 * math.pi, 18)
        P = [body_pt(0.214 + 0.012 * (th / math.pi + 0.5), th, 0.90, sg) for th in ths]
        mb = MB()
        mb.add(*tube(P, np.linspace(0.0016, 0.0024, 18), 6))
        mk("cleithrum_" + sd, mb, bone,
           M("cleithrum, %s" % side_word(sd), "UBERON_0004741", "cleithrum", FS, "organ", "musculoskeletal",
             "skeleton", sd, zfa="ZFA:0000184", note="pectoral girdle; shape simplified to a curved bar"),
           inside=0.98)
        mb = MB()
        mb.add(*ellipsoid_world(body_pt(0.232, 0.17 * math.pi, 0.84, sg), (0.005, 0.0018, 0.006), 8, 12))
        mk("scapula_" + sd, mb, bone,
           M("scapula, %s" % side_word(sd), "UBERON_0006849", "scapula", FS, "organ", "musculoskeletal",
             "skeleton", sd, zfa="ZFA:0000583", note="simplified plate at the pectoral fin base"), inside=0.98)
        mb = MB()
        mb.add(*ellipsoid_world(body_pt(0.228, -0.17 * math.pi, 0.80, sg), (0.006, 0.0018, 0.013), 8, 12))
        mk("coracoid_" + sd, mb, bone,
           M("coracoid, %s" % side_word(sd), "UBERON_0004743", "coracoid bone", FS, "organ", "musculoskeletal",
             "skeleton", sd, zfa="ZFA:0000332", note="simplified plate below the fin base"), inside=0.98)


def build_organs():
    # ---- nervous
    nerv = get_mat("nervous", rough=0.5)
    mb = MB()
    mb.add(*ellipsoid_norm((0.130, 0.0, 0.36), (0.022, 0.20, 0.16)))           # telencephalon
    mb.add(*ellipsoid_norm((0.163, 0.17, 0.42), (0.020, 0.17, 0.17)))          # optic tectum L
    mb.add(*ellipsoid_norm((0.163, -0.17, 0.42), (0.020, 0.17, 0.17)))         # optic tectum R
    mb.add(*ellipsoid_norm((0.190, 0.0, 0.40), (0.016, 0.15, 0.15)))           # cerebellum
    mb.add(*ellipsoid_norm((0.200, 0.0, 0.28), (0.022, 0.12, 0.12)))           # medulla
    mk("brain", mb, nerv, M("brain", "UBERON_0000955", "brain", DJ, "organ", "nervous", "organ", "mid",
                            note="lobes (telencephalon, optic tecta, cerebellum, medulla) schematic"),
       inside=0.9)
    ts = np.linspace(0.205, 0.975, 40)
    P = [world(t, 0.0, VERT_NZ(t) + 0.20 - 0.06 * min(max((t - 0.85) / 0.13, 0), 1)) for t in ts]
    mb = MB()
    mb.add(*tube(P, [max(0.035 * H * eh(t), 0.0007) for t in ts], 8))
    mk("spinal_cord", mb, nerv, M("spinal cord", "UBERON_0002240", "spinal cord", DJ, "organ", "nervous",
                                  "organ", "mid"), inside=0.9)
    # ---- gills (4 arches per side, illustrative)
    gm = get_mat("respiratory", rough=0.5)
    for sd, sg in SIDES:
        mb = MB()
        for a in range(4):
            ta = 0.128 + a * 0.016
            ph = np.linspace(0, 1, 18)
            P = np.array([world(ta + 0.012 * math.sin(math.pi * p), sg * (0.18 + 0.36 * math.sin(math.pi * p)),
                                0.30 - 0.92 * p) for p in ph])
            mb.add(*tube(P, 0.0013, 6))
            for p in np.linspace(0.08, 0.92, 16):
                q = np.array(world(ta + 0.012 * math.sin(math.pi * p), sg * (0.18 + 0.36 * math.sin(math.pi * p)),
                                   0.30 - 0.92 * p))
                d = np.array([-0.5, sg * 1.0, 0.0])
                d /= np.linalg.norm(d)
                Lf = 0.010 * (0.6 + 0.4 * math.sin(math.pi * p))
                mb.add(*tube(np.linspace(q, q + d * Lf, 3), np.array([0.0011, 0.0007, 0.0002]), 4))
        mk("gills_" + sd, mb, gm,
           M("gills (4 gill arches with filaments), %s" % side_word(sd), None, None, None, "organ",
             "respiratory", "organ", sd, nearest="UBERON_0000171 respiration organ",
             note="no gill node in the files; arch and filament counts illustrative"), inside=0.92)
    # ---- heart (ventricle, atrium, bulbus arteriosus)
    hm = get_mat("circulatory", rough=0.45)
    mb = MB()
    mb.add(*ellipsoid_norm((0.200, 0.0, -0.58), (0.013, 0.20, 0.15)))
    mb.add(*ellipsoid_norm((0.214, 0.0, -0.40), (0.011, 0.22, 0.10)))
    mb.add(*ellipsoid_norm((0.183, 0.0, -0.55), (0.009, 0.09, 0.08)))
    mk("heart", mb, hm, M("heart (ventricle, atrium, bulbus arteriosus)", "UBERON_0000948", "heart", DJ, "organ",
                          "circulatory", "organ", "mid"), inside=0.9)
    # ---- digestive: oesophagus, intestine, liver
    gmat = get_mat("gut", rough=0.5)
    ctrl = [(0.165, 0.0, -0.05), (0.21, 0.0, -0.08), (0.26, 0.0, -0.15)]
    P = spline([world(*c) for c in ctrl], 12)
    mb = MB()
    mb.add(*tube(P, 0.0048, 10))
    mk("oesophagus", mb, gmat, M("oesophagus", "UBERON_0001043", "esophagus", DJ, "organ", "digestive", "organ",
                                 "mid"), inside=0.9)
    ctrl = [(0.255, 0.0, -0.14), (0.32, 0.08, -0.38), (0.42, -0.05, -0.50), (0.52, 0.06, -0.52),
            (0.62, 0.0, -0.58), (0.675, 0.0, -0.76), (0.692, 0.0, -0.93)]
    P = spline([world(*c) for c in ctrl], 48)
    mb = MB()
    mb.add(*tube(P, np.linspace(0.0062, 0.0035, 48), 10))
    mk("intestine", mb, gmat,
       M("intestine (straight tube to the vent)", None, None, None, "organ", "digestive", "organ", "mid",
         nearest="UBERON_0001007 digestive system",
         note="files have only mammalian 'small/large intestine' nodes, not mapped; no separate stomach is "
              "modelled because beloniform fishes are generally described as stomachless (textbook "
              "statement, not checked against our data)"), inside=1.0)
    lm = get_mat("liver", rough=0.45)
    mb = MB()
    mb.add(*ellipsoid_norm((0.300, 0.30, -0.52), (0.055, 0.22, 0.22)))
    mb.add(*ellipsoid_norm((0.290, -0.28, -0.50), (0.045, 0.20, 0.20)))
    mb.add(*ellipsoid_norm((0.265, 0.0, -0.45), (0.022, 0.30, 0.16)))
    mk("liver", mb, lm, M("liver (two lobes)", "UBERON_0002107", "liver", DJ, "organ", "digestive", "organ", "mid"),
       inside=0.9)
    # ---- swim bladder
    sm = get_mat("bladder", rough=0.3, metallic=0.2)
    mb = MB()
    mb.add(*ellipsoid_norm((0.48, 0.0, -0.12), (0.18, 0.36, 0.14), 14, 22))
    mk("swim_bladder", mb, sm,
       M("swim bladder (gas bladder)", None, None, None, "organ", "buoyancy", "organ", "mid",
         note="no swim bladder / gas bladder node in the files"), inside=0.9)
    # ---- renal: kidney + head kidney
    km = get_mat("renal", rough=0.5)
    ts = np.linspace(0.26, 0.64, 24)
    P = [world(t, 0.0, VERT_NZ(t) - 0.17) for t in ts]
    mb = MB()
    mb.add(*tube(P, [0.0040 * (1 - 0.4 * (t - 0.26) / 0.38) for t in ts], 10))
    mk("kidney", mb, km, M("kidney (trunk kidney)", "UBERON_0002113", "kidney", DJ, "organ", "renal", "organ",
                           "mid"), inside=0.9)
    mb = MB()
    mb.add(*ellipsoid_norm((0.235, 0.0, 0.03), (0.022, 0.26, 0.09)))
    mk("head_kidney", mb, km, M("head kidney", "UBERON_0007132", "head kidney", DJ, "organ", "renal", "organ",
                                "mid", note="teleost head kidney is also haematopoietic"), inside=0.9)
    # ---- gonads (paired)
    gom = get_mat("reproductive", rough=0.5)
    for sd, sg in SIDES:
        mb = MB()
        mb.add(*ellipsoid_norm((0.56, 0.24 * sg, -0.33), (0.09, 0.10, 0.07)))
        mk("gonad_" + sd, mb, gom, M("gonad, %s" % side_word(sd), "UBERON_0000991", "gonad", DJ, "organ",
                                     "reproductive", "organ", sd, note="sex not specified"), inside=0.9)
    # ---- spleen
    spm = get_mat("lymphoid", rough=0.45)
    mb = MB()
    mb.add(*ellipsoid_norm((0.37, -0.30, -0.30), (0.018, 0.10, 0.08)))
    mk("spleen", mb, spm, M("spleen", "UBERON_0002106", "spleen", DJ, "organ", "hematopoietic", "organ", "mid"),
       inside=0.9)

# ============================================================================ checks / export


def check_inside():
    problems = []
    dg = bpy.context.evaluated_depsgraph_get()
    for name, lim in CHECK_INSIDE.items():
        ob = OBJ[name]
        mw = ob.matrix_world
        worst = 0.0
        for v in ob.data.vertices:
            p = mw @ v.co
            if name == "intestine" and x_to_t(p[0]) > 0.66:
                continue  # the vent opens on the ventral surface
            worst = max(worst, norm_of(p))
        if worst > lim:
            problems.append((name, round(worst, 3)))
    return problems


def export_glb():
    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    kw = dict(filepath=GLB_PATH, export_format="GLB", export_yup=True, export_apply=True,
              export_extras=True, export_materials="EXPORT", export_cameras=False, export_lights=False,
              export_texcoords=True, export_normals=True, export_draco_mesh_compression_enable=False,
              export_image_format="AUTO")
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="MATERIAL", **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(export_colors=True, **kw)


def write_manifest():
    for e in ENTRIES:
        ob = OBJ[e["object"]]
        c = ob.location
        e["centre_gltf"] = [round(c.x, 4), round(c.z, 4), round(-c.y, 4)]
    order = ["object", "label", "ontology_id", "ontology_label", "ontology_source", "zfa_id", "level",
             "organ_system", "organ_system_id", "layer", "side", "colour", "geometry_basis",
             "nearest_ancestor_in_files", "ontology_note", "note", "centre_gltf"]
    ents = [{k: e[k] for k in order if k in e} for e in ENTRIES]
    man = {
        "model": "flying fish with enlarged pectoral fins (family Exocoetidae), generic, segmented for a cutaway viewer",
        "file": "dashboard/public/blueprint3d/model/flying-fish.glb",
        "built_with": "Blender %s (bpy, headless); anatomy-model/build_fish.py" % bpy.app.version_string,
        "units_and_axes": "glTF Y-up; fish ~0.97 units total length along X, head at +X, back at +Y, fish's left "
                          "side at -Z. Standard length (snout to caudal base) = %.2f units." % SL,
        "evidence_backed": {
            "pectoral_fin_length_over_SL": PECT_RATIO,
            "n_specimens": PECT_N,
            "source": "Daane JM et al. 2021 Curr Biol (doi 10.1016/j.cub.2021.08.054) Data S1A, flying-fish "
                      "group median, recomputed in genotype/cache/daane2021_fin_ratios.json",
            "applied_to": "straight-line base-to-tip length of the longest pectoral fin ray, both sides",
            "measured_in_model_over_SL": {k: round(v, 4) for k, v in PECT_MEASURED.items()},
            "caveat": "preserved museum specimens; length only (no fin area, shape or spread)"},
        "schematic": "everything else: body depth and width, head shape, fin positions and sizes, fin spread, "
                     "organ shapes, sizes and positions; all counts (vertebrae 40, myomeres 32, pectoral rays 14, "
                     "gill arches 4, other fin rays) are illustrative, not flying-fish data",
        "ontology_sources": [DJ, FS],
        "ontology_id_format": "UBERON_xxxxxxx as in data.json; zfa_id from fin-subtree.json where present",
        "levels": "body / organ system / organ / tissue",
        "layers": "outer (skin, eyes, fin membranes) / muscle / skeleton / organ",
        "n_objects": len(ents),
        "objects": ents,
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(man, fh, indent=1)
    shutil.copyfile(MANIFEST_PATH, os.path.join(os.path.dirname(GLB_PATH), "manifest.json"))

# ============================================================================ renders


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 1400, 800
    sc.render.film_transparent = False
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
    return cam, tgt


def render_views():
    os.makedirs(RENDER_DIR, exist_ok=True)
    cam, tgt = setup_render()
    by_layer = {}
    for e in ENTRIES:
        by_layer.setdefault(e["layer"], []).append(e["object"])
    skin = ["skin_L", "skin_R"]
    membranes = [e["object"] for e in ENTRIES if e["layer"] == "outer" and e["object"].endswith(("_fin", "_fin_L", "_fin_R"))]
    muscle = by_layer["muscle"]
    skel = by_layer["skeleton"]
    organs = by_layer["organ"]
    eyes = ["eye_L", "eye_R"]
    allobj = [e["object"] for e in ENTRIES]

    def show(names):
        s = set(names)
        for n in allobj:
            OBJ[n].hide_render = n not in s

    def place(loc, target=(0, 0, 0), ortho=None, lens=50):
        cam.location = loc
        tgt.location = target
        if ortho:
            cam.data.type = "ORTHO"
            cam.data.ortho_scale = ortho
        else:
            cam.data.type = "PERSP"
            cam.data.lens = lens

    def shoot(name):
        if ONLY_RENDER and name not in ONLY_RENDER.split(","):
            return
        bpy.context.scene.render.filepath = os.path.join(RENDER_DIR, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", bpy.context.scene.render.filepath)

    def split(d):
        for e in ENTRIES:
            ob = OBJ[e["object"]]
            base = ob.get("_base")
            if base is None:
                ob["_base"] = list(ob.location)
                base = ob["_base"]
            off = d if e["side"] == "L" else (-d if e["side"] == "R" else 0.0)
            ob.location = (base[0], base[1] + off, base[2])

    show(allobj)
    place((0.85, 1.25, 1.15), (-0.02, 0.06, 0.0), lens=42)
    shoot("01_whole_three_quarter")
    place((0.0, 2.5, 0.0), (0.0, 0.0, 0.0), ortho=1.25)
    shoot("02_lateral_left")
    split(0.22)
    place((0.95, 1.75, 0.95), (-0.02, 0.0, 0.0), lens=40)
    shoot("03_split_halves")
    split(0.0)
    show([n for n in allobj if n not in skin])
    place((0.75, 1.25, 0.95), (-0.02, 0.05, 0.0), lens=45)
    shoot("04_skin_removed_muscle")
    show(skel + organs + eyes)
    place((0.0, 2.5, 0.05), (0.0, 0.0, 0.0), ortho=1.1)
    shoot("05_muscle_removed_skeleton_organs")
    show(organs + eyes)
    place((0.6, 1.1, 0.35), (0.15, 0.0, -0.01), lens=50)
    shoot("06_organs_only")
    show(skel + organs + eyes)
    place((0.95, 1.45, 0.6), (0.02, 0.0, 0.0), lens=45)
    shoot("07_skeleton_organs_three_quarter")


# ============================================================================ main
def main():
    clear_scene()
    img = make_scale_normal_map()
    build_skin(img)
    build_eyes()
    build_fins()
    build_muscle()
    build_skeleton()
    build_organs()
    probs = check_inside()
    print("INSIDE_CHECK", "OK" if not probs else probs)
    export_glb()
    write_manifest()
    print("EXPORTED", GLB_PATH, os.path.getsize(GLB_PATH), "bytes,", len(ENTRIES), "objects")
    if DO_RENDER:
        render_views()


main()
