"""Procedural, segmented 3D model of an ADULT zebrafish (Danio rerio) for the DELPHI blueprint viewer.

Run headless with Blender 4.2.23 LTS, from the repo root:

    blender.exe -b --factory-startup --python anatomy-model/zebrafish/build_adult.py -- \
        [--glb PATH] [--manifest PATH] [--renders DIR] [--no-render] [--samples N] [--only a,b]

Everything is built from parametric functions in this file; no external meshes are used.
Proportions and counts that have a source are read from anatomy-model/zebrafish/sources.json ("values");
everything else is schematic and the manifest says so per piece. ZFA ids (and their Uberon xrefs) are read
from anatomy-model/zebrafish/calls.json ("zfa_table"), which records the Ubergraph SPARQL calls that found them.

Coordinates while building (Blender, Z up): head at +X, back at +Z, the fish's LEFT side at +Y.
The glTF export is Y-up, so in the GLB: head +X, back +Y, fish's left side at -Z.

This file is also the shared toolkit for build_larva.py (which imports it); main() only runs when this
file is the script Blender was started with.
"""
import bpy
import bmesh
import json
import math
import os
import sys
import shutil
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MODEL_DIR = os.path.join(REPO, "dashboard", "public", "blueprint3d", "model")
SCHEMATIC = "schematic"


def parse_args(default_glb, default_manifest, default_renders):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

    def arg(flag, default):
        return argv[argv.index(flag) + 1] if flag in argv else default
    return {
        "glb": arg("--glb", default_glb),
        "manifest": arg("--manifest", default_manifest),
        "renders": arg("--renders", default_renders),
        "render": "--no-render" not in argv,
        "samples": int(arg("--samples", "24")),
        "only": arg("--only", ""),
    }


def load_json(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as fh:
        return json.load(fh)


# ============================================================================ sourced values
class Values:
    """Proportions and counts. A value is 'sourced' when sources.json has it, else a schematic default."""

    def __init__(self, prefix):
        src = load_json("sources.json")
        self.refs = {s["id"]: s for s in src["sources"]}
        self.v = {k[len(prefix):]: e for k, e in src["values"].items() if k.startswith(prefix)}
        self.used = {}

    def get(self, key, default):
        e = self.v.get(key)
        if e is not None and e.get("value") is not None:
            self.used[key] = e
            return e["value"]
        self.used[key] = {"value": default, "basis": SCHEMATIC}
        return default

    def basis(self, key):
        e = self.used.get(key) or self.v.get(key)
        if e is None or e.get("basis") == SCHEMATIC or "source" not in e:
            return None
        ref = self.refs[e["source"]]
        return "sourced: %s, %s = %s%s" % (ref["short"], e.get("measure", key), e["value"],
                                          (" (" + e["derivation"] + ")") if e.get("derivation") else "")

    def basis_or(self, keys, extra=""):
        parts = [b for b in (self.basis(k) for k in keys) if b]
        if not parts:
            return SCHEMATIC + (("; " + extra) if extra else "")
        return "; ".join(parts) + ("; " + extra if extra else "; other dimensions schematic")


# ============================================================================ colours / materials
def hex_lin(h):
    h = h.lstrip("#")
    return [srgb1(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)]


def srgb1(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb_lin(rgb):
    return [srgb1(c) for c in rgb]


def lerp3(a, b, f):
    f = min(max(f, 0.0), 1.0)
    return [a[i] + (b[i] - a[i]) * f for i in range(3)]


def smooth(e0, e1, x):
    if e1 == e0:
        return 1.0 if x >= e1 else 0.0
    u = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return u * u * (3 - 2 * u)


class Mats:
    def __init__(self, pal):
        self.pal = pal
        self.cache = {}

    def get(self, key, alpha=1.0, metallic=0.0, rough=0.5, vcol=False, normal_img=None, emit=0.0):
        name = "mat_" + key
        if name in self.cache:
            return self.cache[name]
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        # vertex-coloured materials get a WHITE base factor so COLOR_0 shows unmodified in three.js
        col = ([1.0, 1.0, 1.0] if vcol else hex_lin(self.pal[key])) + [1.0]
        bsdf.inputs["Base Color"].default_value = col
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = rough
        if emit > 0:
            bsdf.inputs["Emission Color"].default_value = hex_lin(self.pal[key]) + [1.0]
            bsdf.inputs["Emission Strength"].default_value = emit
        if alpha < 1.0:
            bsdf.inputs["Alpha"].default_value = alpha
            m.blend_method = "BLEND"
            try:
                m.show_transparent_back = False
            except Exception:
                pass
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
            nm.inputs["Strength"].default_value = 0.5
            nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
        m["palette_key"] = key
        self.cache[name] = m
        return m


def make_scale_normal_map(size=256, nscale=4):
    """Imbricate (overlapping, cycloid) scale pattern -> tangent-space normal map; procedural."""
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float64)
    u = xs / size * nscale
    v = ys / size * nscale
    hgt = np.zeros_like(u)
    R = 0.62
    for row in range(-1, nscale + 2):
        off = 0.5 * (row % 2)
        for colm in range(-1, nscale + 2):
            du = u - (colm + off)
            dv = v - row
            d = np.sqrt(du * du + dv * dv)
            dome = np.clip(1 - (d / R) ** 2, 0, 1) * (0.55 + 0.45 * np.clip(du / R + 0.5, 0, 1))
            hgt = np.maximum(hgt, dome)
    gy, gx = np.gradient(hgt)
    k = 6.0
    nx, ny_, nz = -gx * k, -gy * k, np.ones_like(hgt)
    ln = np.sqrt(nx * nx + ny_ * ny_ + nz * nz)
    rgba = np.stack([nx / ln * 0.5 + 0.5, ny_ / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5, np.ones_like(nz)], axis=-1)
    img = bpy.data.images.new("skin_scales_normal", size, size, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.file_format = "PNG"
    img.pack()
    return img


# ============================================================================ geometry helpers
class MB:
    """mesh builder: accumulate parts into one mesh"""

    def __init__(self):
        self.V, self.F, self.UV, self.C = [], [], [], []

    def add(self, V, F, uv=None, col=None):
        o = len(self.V)
        self.V.extend([tuple(map(float, p)) for p in V])
        self.F.extend([tuple(i + o for i in f) for f in F])
        self.UV.extend(uv if uv is not None else [(0.0, 0.0)] * len(V))
        if col is not None and len(col) == 3 and not hasattr(col[0], "__len__"):
            col = [col] * len(V)
        self.C.extend(col if col is not None else [None] * len(V))
        return self


def grid_faces(nu, nv, mask=None, flip=False):
    F = []
    for i in range(nu - 1):
        for j in range(nv - 1):
            if mask is not None and not mask(i, j):
                continue
            f = (i * nv + j, (i + 1) * nv + j, (i + 1) * nv + j + 1, i * nv + j + 1)
            F.append(tuple(reversed(f)) if flip else f)
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


def ellipsoid_world(c, r, nlat=12, nlon=18, rot=(0.0, 0.0, 0.0)):
    """ellipsoid with radii r, rotated by Euler XYZ rot (radians), centred at c"""
    V, F = unit_sphere(nlat, nlon)
    R = Matrix.Rotation(rot[2], 3, "Z") @ Matrix.Rotation(rot[1], 3, "Y") @ Matrix.Rotation(rot[0], 3, "X")
    out = []
    for p in V:
        q = R @ Vector((p[0] * r[0], p[1] * r[1], p[2] * r[2]))
        out.append((c[0] + q.x, c[1] + q.y, c[2] + q.z))
    return out, F


def tube(P, R, nseg=8, cap=True, flat=1.0):
    """tube along polyline P with radii R; flat<1 squashes the cross-section along the binormal"""
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
            V.append(tuple(P[i] + R[i] * (math.cos(a) * nrm + flat * math.sin(a) * b)))
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


def curve1d(ctrl, n=400):
    """smooth 1-D function y(t) through (t, y) control points -> callable"""
    S = spline(ctrl, n)
    ts, ys = S[:, 0], S[:, 1]
    order = np.argsort(ts)
    ts, ys = ts[order], ys[order]
    return lambda t: float(np.interp(t, ts, ys))


def ray_line(base, direction, L, bend, ns=16):
    s = np.linspace(0, 1, ns)[:, None]
    return np.asarray(base) + np.asarray(direction) * L * s + np.asarray(bend) * L * s ** 2


def segmented_radii(n, r0, r1, nseg_joint=0, depth=0.22):
    """taper r0 -> r1; optional joint constrictions (lepidotrichia are segmented)"""
    s = np.linspace(0, 1, n)
    r = r0 + (r1 - r0) * s
    if nseg_joint:
        ph = (s * nseg_joint) % 1.0
        r = r * (1 - depth * np.exp(-((ph - 0.5) / 0.08) ** 2) * (s > 0.15))
    return r


# ============================================================================ body frame
class Body:
    """Fish body: t in [0, t_end] along SL from snout (t=0) to caudal fin base (t=1).
    hd(t), hw(t): half depth / half width as fractions of SL; zc(t): centre-line height (fraction of SL).
    Cross-section: superellipse of exponent nexp, narrower dorsally by the egg factor."""

    def __init__(self, X0, SL, hd_ctrl, hw_ctrl, zc_ctrl, nexp=2.2, egg=0.12, nose=0.035, t_end=1.03):
        self.X0, self.SL, self.nexp, self.egg, self.nose, self.t_end = X0, SL, nexp, egg, nose, t_end
        self._hd, self._hw, self._zc = curve1d(hd_ctrl), curve1d(hw_ctrl), curve1d(zc_ctrl)

    def _close(self, t):
        if t <= 0:
            return 0.0
        f = 1.0
        if t < self.nose:
            a = t / self.nose
            f = math.sqrt(max(a * (2 - a), 0.0))
        if t > 1.0:
            u = min((t - 1.0) / (self.t_end - 1.0), 1.0)
            f *= math.sqrt(max(1 - u * u, 0.0))
        return f

    def hd(self, t):
        return max(self._hd(min(max(t, 0), 1.0)) * self.SL * self._close(t), 0.0)

    def hw(self, t):
        return max(self._hw(min(max(t, 0), 1.0)) * self.SL * self._close(t), 0.0)

    def zc(self, t):
        return self._zc(min(max(t, 0), 1.0)) * self.SL

    def x(self, t):
        return self.X0 - t * self.SL

    def x_to_t(self, x):
        return (self.X0 - x) / self.SL

    def world(self, t, ny, nz):
        return (self.x(t), ny * self.hw(t) * (1 - self.egg * nz), self.zc(t) + nz * self.hd(t))

    def section(self, theta, s=1.0, side=1):
        c, sn = math.cos(theta), math.sin(theta)
        ny = s * math.copysign(abs(c) ** (2.0 / self.nexp), c) * side
        nz = s * math.copysign(abs(sn) ** (2.0 / self.nexp), sn)
        return ny, nz

    def pt(self, t, theta, s=1.0, side=1):
        ny, nz = self.section(theta, s, side)
        return self.world(t, ny, nz)

    def norm_of(self, p):
        t = self.x_to_t(p[0])
        hh, ww = self.hd(t), self.hw(t)
        if hh < 1e-6 or ww < 1e-6:
            return 9.0
        nz = (p[2] - self.zc(t)) / hh
        ny = p[1] / (ww * (1 - self.egg * nz))
        return (abs(ny) ** self.nexp + abs(nz) ** self.nexp) ** (1.0 / self.nexp)

    def local_radius(self, t):
        return max(min(self.hw(t), self.hd(t)), 1e-4)

    def patch(self, tc, thc, rt, rth, s, side, nr=8, na=32, squash=None, hole=None):
        """elliptical disc on the shell of scale s: centre (tc, theta_c), radii rt (t) and rth (theta, radians).
        squash(u, a) -> radius factor gives non-elliptical outlines; hole(p) -> True drops a face. Open surface."""
        V = [self.pt(tc, thc, s, side)]
        for i in range(1, nr + 1):
            r = i / nr
            for j in range(na):
                a = 2 * math.pi * j / na
                f = squash(r, a) if squash else 1.0
                V.append(self.pt(tc + r * f * rt * math.cos(a), thc + r * f * rth * math.sin(a), s, side))
        F = []
        for j in range(na):
            F.append((0, 1 + j, 1 + (j + 1) % na))
        for i in range(nr - 1):
            for j in range(na):
                a = 1 + i * na + j
                b = 1 + i * na + (j + 1) % na
                F.append((a, a + na, b + na, b))
        if hole is not None:
            F = [f for f in F if not hole(np.mean([V[k] for k in f], axis=0))]
        if side < 0:
            F = [tuple(reversed(f)) for f in F]
        return V, F

    def ellipsoid(self, c, r, nlat=12, nlon=18):
        """ellipsoid in normalized body coords (t, ny, nz) -> follows the body taper"""
        V, F = unit_sphere(nlat, nlon)
        return [self.world(c[0] + p[0] * r[0], c[1] + p[1] * r[1], c[2] + p[2] * r[2]) for p in V], F


# ============================================================================ registry / metadata
class Registry:
    def __init__(self, zfa_table, systems, default_sources):
        self.entries, self.obj, self.inside = [], {}, {}
        self.zfa = zfa_table
        self.systems = systems
        self.default_sources = default_sources

    def meta(self, label, zfa, level, system, layer, side, basis=SCHEMATIC, note=None, colour=None,
             zfa_note=None):
        d = {"label": label, "level": level, "layer": layer, "side": side, "geometry_basis": basis}
        if zfa:
            z = self.zfa.get(zfa)
            assert z is not None, "ZFA id %s missing from calls.json zfa_table" % zfa
            d["ontology_id"] = zfa
            d["ontology_label"] = z["label"]
            d["zfa_id"] = zfa
            ub = z.get("uberon") or []
            d["uberon_id"] = ub[0]["id"] if ub else None
            d["uberon_label"] = ub[0]["label"] if ub else None
            if not ub:
                d["uberon_note"] = "no Uberon class carries this ZFA id as a database cross-reference in Ubergraph"
            d["ontology_source"] = "Ubergraph SPARQL (see calls.json)"
        else:
            d["ontology_id"] = None
            d["zfa_id"] = None
            d["uberon_id"] = None
            d["ontology_note"] = zfa_note or "no ZFA class found"
        sl, sid = self.systems[system]
        d["organ_system"] = sl
        d["organ_system_id"] = sid
        if note:
            d["note"] = note
        if colour:
            d["colour"] = colour
        return d

    def mk(self, name, mb, mat, meta, closed=True, smooth=True, solidify=None, solid_offset=-1.0,
           inside=None, outward_axis=None, pal=None):
        assert name not in self.obj, "duplicate object " + name
        me = bpy.data.meshes.new(name)
        me.from_pydata(mb.V, [], mb.F)
        me.validate(clean_customdata=False)
        bm = bmesh.new()
        bm.from_mesh(me)
        if closed:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        elif outward_axis is not None:
            bm.normal_update()
            score = 0.0
            for f in bm.faces:
                c = f.calc_center_median()
                score += (c - outward_axis(c)).dot(f.normal)
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
                c = list(c) if c is not None else [1.0, 1.0, 1.0]
                attr.data[i].color = c + [1.0] if len(c) == 3 else c
        me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(mat)
        co = np.array([v.co[:] for v in me.vertices])
        ctr = (co.min(0) + co.max(0)) / 2
        me.transform(Matrix.Translation(-Vector(ctr)))
        ob.location = ctr
        if solidify:
            md = ob.modifiers.new("solidify", "SOLIDIFY")
            md.thickness = solidify
            md.offset = solid_offset
            md.use_rim = True
            md.use_even_offset = True
        meta = dict(meta)
        meta["object"] = name
        if "colour" not in meta and pal is not None:
            meta["colour"] = pal.get(mat.get("palette_key"), None)
        for k in ("ontology_id", "zfa_id", "uberon_id", "layer", "side", "organ_system", "level"):
            ob[k] = meta.get(k) if meta.get(k) is not None else ""
        ob["label"] = meta["label"]
        self.entries.append(meta)
        self.obj[name] = ob
        if inside is not None:
            self.inside[name] = inside
        return ob

    def check_inside(self, body, exempt=None):
        problems = []
        bpy.context.view_layer.update()
        for name, lim in self.inside.items():
            ob = self.obj[name]
            mw = ob.matrix_world
            worst, wp = 0.0, None
            for v in ob.data.vertices:
                p = mw @ v.co
                if exempt and exempt(name, p):
                    continue
                n = body.norm_of(p)
                if n > worst:
                    worst, wp = n, p
            if worst > lim:
                problems.append((name, round(worst, 3), "t=%.3f" % body.x_to_t(wp[0]),
                                 tuple(round(c, 4) for c in wp)))
        return problems


SIDES = (("L", 1), ("R", -1))


def side_word(sd):
    return {"L": "left", "R": "right"}.get(sd, "midline")


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(filepath=path, export_format="GLB", export_yup=True, export_apply=True,
              export_extras=True, export_materials="EXPORT", export_cameras=False, export_lights=False,
              export_texcoords=True, export_normals=True, export_draco_mesh_compression_enable=False,
              export_image_format="AUTO")
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="MATERIAL", **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(export_colors=True, **kw)


ORDER = ["object", "label", "ontology_id", "ontology_label", "zfa_id", "uberon_id", "uberon_label",
         "ontology_source", "level", "organ_system", "organ_system_id", "layer", "side", "colour",
         "geometry_basis", "ontology_note", "uberon_note", "note", "centre_gltf"]


def write_manifest(reg, path, header, model_dir_copy):
    for e in reg.entries:
        c = reg.obj[e["object"]].location
        e["centre_gltf"] = [round(c.x, 4), round(c.z, 4), round(-c.y, 4)]
    ents = [{k: e[k] for k in ORDER if k in e} for e in reg.entries]
    n_zfa = sum(1 for e in ents if e.get("zfa_id"))
    n_ub = sum(1 for e in ents if e.get("uberon_id"))
    man = dict(header)
    man["n_objects"] = len(ents)
    man["ontology_coverage"] = {"with_zfa_id": n_zfa, "with_uberon_xref": n_ub, "null_zfa": len(ents) - n_zfa,
                                "null_zfa_objects": [e["object"] for e in ents if not e.get("zfa_id")],
                                "no_uberon_xref_objects": [e["object"] for e in ents
                                                           if e.get("zfa_id") and not e.get("uberon_id")]}
    man["objects"] = ents
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(man, fh, indent=1)
    if os.path.normcase(os.path.abspath(path)) != os.path.normcase(os.path.abspath(model_dir_copy)):
        shutil.copyfile(path, model_dir_copy)


# ============================================================================ renders
def setup_render(samples, res=(1400, 800)):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = res
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
    cd.clip_start = 0.005
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    return cam, tgt


class Shooter:
    def __init__(self, reg, out_dir, samples, only=""):
        os.makedirs(out_dir, exist_ok=True)
        self.reg, self.out, self.only = reg, out_dir, only
        self.cam, self.tgt = setup_render(samples)
        self.all = [e["object"] for e in reg.entries]

    def show(self, names):
        s = set(names)
        for n in self.all:
            self.reg.obj[n].hide_render = n not in s

    def place(self, loc, target=(0, 0, 0), ortho=None, lens=50):
        self.cam.location = loc
        self.tgt.location = target
        if ortho:
            self.cam.data.type = "ORTHO"
            self.cam.data.ortho_scale = ortho
        else:
            self.cam.data.type = "PERSP"
            self.cam.data.lens = lens

    def shoot(self, name):
        if self.only and name not in self.only.split(","):
            return
        bpy.context.scene.render.filepath = os.path.join(self.out, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", bpy.context.scene.render.filepath)

    def split(self, d):
        for e in self.reg.entries:
            ob = self.reg.obj[e["object"]]
            base = ob.get("_base")
            if base is None:
                ob["_base"] = list(ob.location)
                base = ob["_base"]
            off = d if e["side"] == "L" else (-d if e["side"] == "R" else 0.0)
            # organs stay put in the viewer's split; only outer/muscle/skeleton halves move
            if e["layer"] == "organ":
                off = 0.0
            ob.location = (base[0], base[1] + off, base[2])

    def by_layer(self):
        d = {}
        for e in self.reg.entries:
            d.setdefault(e["layer"], []).append(e["object"])
        return d


# ============================================================================ ADULT MODEL
PAL = {
    "skin": "#8C8A6A", "eye": "#C0C6CC", "fin": "#C9B98A", "barbel": "#C8B48A", "lateral_line": "#E8E2C8",
    "muscle": "#D9727A", "septum": "#F1D7CF", "bone": "#F2EAD3", "ray": "#E6DCC0", "teeth": "#FFFFF0",
    "nervous": "#F2C14E", "sensory": "#9FA8DA", "respiratory": "#B5174B", "circulatory": "#D32F2F",
    "atrium": "#B71C1C", "bulbus": "#EF9A9A", "liver": "#8D4E2A", "gall": "#558B2F", "gut": "#E8A87C",
    "gut2": "#E09A6B", "gut3": "#D4895A", "pancreas": "#F3D9A4", "bladder": "#DCE3E8", "renal": "#26A69A",
    "headkidney": "#00897B", "reproductive": "#F3D36B", "lymphoid": "#6D214F",
}

SYS = {  # organ system key -> (ZFA label, ZFA id). part_of links checked in Ubergraph where noted in calls.json
    "integument": ("integument", "ZFA:0000368"),
    "musculature": ("musculature system", "ZFA:0000548"),
    "skeletal": ("skeletal system", "ZFA:0000434"),
    "nervous": ("nervous system", "ZFA:0000396"),
    "sensory": ("sensory system", "ZFA:0000282"),
    "respiratory": ("respiratory system", "ZFA:0000272"),
    "cardiovascular": ("cardiovascular system", "ZFA:0000010"),
    "digestive": ("digestive system", "ZFA:0000339"),
    "hepatobiliary": ("liver and biliary system", "ZFA:0000036"),
    "renal": ("renal system", "ZFA:0000163"),
    "reproductive": ("reproductive system", "ZFA:0000632"),
    "hematopoietic": ("hematopoietic system", "ZFA:0005023"),
    "buoyancy": ("swim bladder: no ZFA part_of link to an organ system (checked in Ubergraph)", None),
    "whole": ("whole organism", "ZFA:0001094"),
    "fin": ("fins: no ZFA part_of link to an organ system (checked in Ubergraph for pectoral fin)", None),
    "axial": ("notochord: no ZFA part_of link to an organ system (checked in Ubergraph)", None),
    "yolk": ("yolk: extra-embryonic nutrient store, no organ system", None),
}


class Adult:
    def __init__(self):
        self.V = Values("adult.")
        V = self.V
        calls = load_json("calls.json")
        self.reg = Registry(calls["zfa_table"], SYS, None)
        self.mats = Mats(PAL)
        # ---- proportions (fractions of SL); sourced where sources.json has them
        self.D = V.get("max_body_depth_over_SL", 0.27)            # depth at dorsal fin origin = maximum
        self.HN = V.get("depth_at_nape_over_SL", 0.22)            # depth at nape
        self.HAA = V.get("depth_at_anal_origin_over_SL", 0.22)    # depth at anterior margin of anal fin
        self.CPD = V.get("caudal_peduncle_depth_over_SL", 0.115)
        self.HL = V.get("head_length_over_SL", 0.28)              # snout to opercle margin
        self.ED = V.get("eye_diameter_over_SL", 0.10)
        self.SVL = V.get("snout_vent_over_SL", 0.65)
        self.PECT = V.get("pectoral_fin_length_over_SL", 0.19)
        self.PELV = V.get("pelvic_fin_length_over_SL", 0.14)
        self.CAUD = V.get("caudal_fin_length_over_SL", 0.28)
        self.DORS_ORIGIN = V.get("dorsal_fin_origin_over_SL", 0.52)
        self.ANAL_ORIGIN = V.get("anal_fin_origin_over_SL", self.SVL + 0.015)
        self.PELV_ORIGIN = V.get("pelvic_fin_origin_over_SL", 0.47)
        # ---- counts
        self.N_VERT = int(V.get("vertebrae_total", 32))
        self.N_WEB = int(V.get("weberian_vertebrae", 4))
        self.N_PRECAUDAL = int(V.get("precaudal_vertebrae_incl_weberian", 14))
        self.N_RIB_PAIRS = int(V.get("pleural_rib_pairs", 10))
        self.N_PECT = int(V.get("pectoral_fin_rays", 13))
        self.N_PELV = int(V.get("pelvic_fin_rays", 8))
        self.N_DORS = int(V.get("dorsal_fin_rays", 10))
        self.N_ANAL = int(V.get("anal_fin_rays", 15))
        self.N_CAUD = int(V.get("caudal_fin_principal_rays", 19))
        self.N_HYP = int(V.get("hypurals", 5))
        self.N_GILL = int(V.get("gill_arches_per_side", 4))
        self.N_MYO = self.N_VERT  # one myomere per vertebral segment (schematic link)
        self.SL = 0.78
        self.X0 = 0.47
        D, HN, HAA, CPD = self.D, self.HN, self.HAA, self.CPD
        # half-depth control points (fractions of SL): nape near the back of the head, maximum depth at the dorsal
        # fin origin, HAA at the anal fin origin, then the caudal peduncle
        hd_ctrl = [(0.0, 0.30 * HN / 2), (0.05, 0.64 * HN / 2), (0.12, 0.84 * HN / 2), (self.HL - 0.045, HN / 2),
                   (0.38, 0.93 * D / 2), (0.46, 0.995 * D / 2), (self.DORS_ORIGIN, D / 2), (self.ANAL_ORIGIN, HAA / 2),
                   (0.83, 0.55 * HAA / 2 + 0.45 * CPD / 2), (0.92, CPD / 2), (1.0, 1.06 * CPD / 2)]
        hw_ctrl = [(0.0, 0.050), (0.08, 0.075), (0.18, 0.085), (0.30, 0.080), (0.45, 0.075), (0.62, 0.058),
                   (0.80, 0.036), (0.90, 0.026), (1.0, 0.022)]
        # centre line: belly deeper than back mid-body; mouth slightly upturned (snout above axis)
        zc_ctrl = [(0.0, 0.012), (0.10, 0.006), (0.22, 0.0), (0.42, -0.010), (0.60, -0.008), (0.80, -0.002),
                   (1.0, 0.0)]
        self.body = Body(self.X0, self.SL, hd_ctrl, hw_ctrl, zc_ctrl, nexp=2.15, egg=0.14, nose=0.04)
        self.EYE = {}

    # ------------------------------------------------------------------ helpers
    def M(self, *a, **k):
        return self.reg.meta(*a, **k)

    def mk(self, *a, **k):
        k.setdefault("pal", PAL)
        return self.reg.mk(*a, **k)

    # ------------------------------------------------------------------ skin with stripes
    def skin_colour(self, t, nz):
        """adult stripe pattern: names follow Parichy et al. 2009 (1D, 1V primary; 2D, 2V secondary; interstripes)"""
        dorsum = srgb_lin((0.33, 0.33, 0.22))
        blue = srgb_lin((0.10, 0.15, 0.36))
        blue2 = srgb_lin((0.17, 0.22, 0.42))
        inter = srgb_lin((0.86, 0.80, 0.60))
        belly = srgb_lin((0.93, 0.93, 0.90))
        cheek = srgb_lin((0.82, 0.78, 0.62))
        head_top = srgb_lin((0.36, 0.35, 0.24))
        # stripes are ~5 deg offset from the horizontal myoseptum (Parichy 2009): rise slightly toward the tail
        v = nz - 0.06 * (t - 0.5)
        bands = [  # (lower nz, upper nz, colour) from belly to back
            (-1.01, -0.64, belly), (-0.64, -0.50, blue2), (-0.50, -0.36, inter), (-0.36, -0.11, blue),
            (-0.11, 0.13, inter), (0.13, 0.37, blue), (0.37, 0.50, inter), (0.50, 0.61, blue2), (0.61, 1.01, dorsum)]
        e = 0.025
        col = belly
        for lo, hi, c in bands:
            w = smooth(lo - e, lo + e, v) * (1 - smooth(hi - e, hi + e, v))
            if w > 0:
                col = lerp3(col, c, w)
        # stripe 2V is restricted to the posterior body (forms later); fade it anteriorly
        if -0.66 < v < -0.45 and t < 0.50:
            col = lerp3(col, belly, 1 - smooth(0.40, 0.50, t))
        # head: no stripes; olive top, golden-silver cheek and operculum, white throat
        h = 1 - smooth(self.HL - 0.03, self.HL + 0.03, t)
        if h > 0:
            hc = lerp3(belly, cheek, smooth(-0.6, -0.2, nz))
            hc = lerp3(hc, head_top, smooth(0.35, 0.65, nz))
            if t < 0.03 and abs(nz) < 0.25:  # mouth slit
                hc = lerp3(hc, srgb_lin((0.25, 0.18, 0.15)), 1 - abs(nz) / 0.25)
            col = lerp3(col, hc, h)
        return col

    def build_skin(self, img):
        b = self.body
        mat = self.mats.get("skin", metallic=0.30, rough=0.40, vcol=True, normal_img=img)
        NU, NV = 140, 76
        ts = np.concatenate([np.linspace(0.0, 1.0, NU - 8), np.linspace(1.0, b.t_end, 9)[1:]])
        ths = np.linspace(-math.pi / 2, math.pi / 2, NV)
        for sd, sg in SIDES:
            V, UV, C = [], [], []
            for t in ts:
                for th in ths:
                    V.append(b.pt(t, th, 1.0, sg))
                    UV.append((t * 40.0, (th + math.pi / 2) / math.pi * 8.0))
                    C.append(self.skin_colour(t, b.section(th)[1]))
            mb = MB().add(V, grid_faces(len(ts), NV, flip=sg < 0), UV, C)
            self.mk("skin_" + sd, mb, mat,
                    self.M("skin and scales, %s half" % side_word(sd), "ZFA:0000368", "organ", "integument",
                           "outer", sd,
                           basis=self.V.basis_or(["max_body_depth_over_SL", "depth_at_nape_over_SL",
                                                  "depth_at_anal_origin_over_SL", "caudal_peduncle_depth_over_SL",
                                                  "head_length_over_SL"],
                                                 "body width, cross-section and outline curvature schematic; stripe "
                                                 "order 2D-1D-1V-2V with interstripes follows Parichy et al. 2009, "
                                                 "stripe widths schematic"),
                           note="body shell; scale pattern is a procedural normal map, not a scale count",
                           colour="vertex colours (COLOR_0): olive dorsum #545438, dark blue stripes #1A2760 / "
                                  "#2C3870, pale gold interstripes #DCCC99, white belly #EDEDE6; material factor white"),
                    closed=False, solidify=0.0015, solid_offset=-1.0,
                    outward_axis=lambda c: Vector((c.x, 0.0, self.body.zc(self.body.x_to_t(c.x)))))

    def build_eyes(self):
        b = self.body
        mat = self.mats.get("eye", metallic=0.55, rough=0.25, vcol=True)
        re = self.ED * self.SL / 2
        te = 0.085
        for sd, sg in SIDES:
            ny_s, nz_s = b.section(math.radians(14), 1.0, 1)
            c = (b.x(te), sg * (b.hw(te) * ny_s * (1 - b.egg * nz_s) - re * 0.40), b.zc(te) + 0.18 * b.hd(te))
            self.EYE[sd] = (c, re)
            Vs, F = unit_sphere(24, 40)
            V = [(c[0] + q[0] * re, c[1] + sg * q[2] * re * 0.50, c[2] + q[1] * re) for q in Vs]
            if sg < 0:
                F = [tuple(reversed(f)) for f in F]
            C = []
            for q in Vs:
                lat = q[2]
                if lat > 0.88:
                    C.append(srgb_lin((0.02, 0.02, 0.03)))           # pupil
                elif lat > 0.40:
                    # iris: silvery gold, darker at its outer rim (schematic)
                    C.append(lerp3(srgb_lin((0.82, 0.74, 0.48)), srgb_lin((0.30, 0.30, 0.34)), smooth(0.55, 0.42, lat)))
                else:
                    C.append(srgb_lin((0.30, 0.30, 0.34)))
            self.mk("eye_" + sd, MB().add(V, F, None, C), mat,
                    self.M("eye, %s" % side_word(sd), "ZFA:0000107", "organ", "sensory", "outer", sd,
                           basis=self.V.basis_or(["eye_diameter_over_SL"], "position schematic"),
                           note="eyeball diameter = %.3f SL" % self.ED,
                           colour="vertex colours (COLOR_0): pupil #050508, iris silvery gold #D1BE7A darkening to "
                                  "#5E5E66 at the rim; material factor white"))

    def build_barbels_and_lateral_line(self):
        b = self.body
        mat = self.mats.get("barbel", rough=0.6)
        for sd, sg in SIDES:
            # maxillary barbel: from the corner of the mouth, pointing back and down (lengths schematic)
            base = np.array(b.pt(0.045, math.radians(-25), 0.95, sg))
            P = spline([base, base + (-0.012, sg * 0.006, -0.008), base + (-0.030, sg * 0.010, -0.016),
                        base + (-0.046, sg * 0.012, -0.020)], 14)
            self.mk("maxillary_barbel_" + sd, MB().add(*tube(P, np.linspace(0.0016, 0.0004, 14), 7)), mat,
                    self.M("maxillary barbel, %s" % side_word(sd), "ZFA:0005408", "organ", "integument",
                           "outer", sd, note="length and pose schematic"))
            base = np.array(b.pt(0.020, math.radians(30), 0.95, sg))
            P = spline([base, base + (0.004, sg * 0.004, -0.004), base + (0.006, sg * 0.007, -0.012)], 10)
            self.mk("nasal_barbel_" + sd, MB().add(*tube(P, np.linspace(0.0011, 0.0003, 10), 6)), mat,
                    self.M("anterior nasal (rostral) barbel, %s" % side_word(sd), "ZFA:0005407", "organ",
                           "integument", "outer", sd, note="short; length and pose schematic"))
        # posterior lateral line: neuromasts as a row of small bumps along the horizontal myoseptum
        ml = self.mats.get("lateral_line", rough=0.4)
        for sd, sg in SIDES:
            mb = MB()
            for t in np.linspace(self.HL + 0.02, 0.97, 30):
                nz = 0.02 - 0.06 * (t - 0.5)
                ny = (1 - abs(nz) ** b.nexp) ** (1 / b.nexp) * sg
                p = b.world(t, ny * 1.005, nz)
                mb.add(*ellipsoid_world(p, (0.0016, 0.0009, 0.0011), 5, 8))
            self.mk("lateral_line_" + sd, mb, ml,
                    self.M("posterior lateral line (neuromast row), %s" % side_word(sd), "ZFA:0000944", "organ",
                           "sensory", "outer", sd,
                           note="drawn as 30 superficial neuromasts along the horizontal myoseptum; count and "
                                "spacing illustrative (adult neuromasts form stitches)"))

    # ------------------------------------------------------------------ fins
    def fin_colour(self, fin, f_across, s_along):
        """membrane vertex colours. f_across: 0..1 across the rays (dorsal->ventral for caudal);
        s_along: 0..1 base->tip"""
        clear = srgb_lin((0.86, 0.83, 0.70))
        blue = srgb_lin((0.14, 0.19, 0.40))
        gold = srgb_lin((0.90, 0.78, 0.45))
        if fin == "caudal":
            # horizontal stripes continuous with the body; M1 central (continuous with body stripe 1V)
            v = abs(f_across - 0.52)
            c = blue if v < 0.07 else gold if v < 0.15 else blue if v < 0.25 else gold if v < 0.33 else clear
            return lerp3(c, clear, smooth(0.80, 1.0, s_along))
        if fin == "anal":
            # bands parallel to the body: alternate blue / gold from base to edge, pale margin
            c = gold if s_along < 0.22 else blue if s_along < 0.42 else gold if s_along < 0.58 else \
                blue if s_along < 0.78 else clear
            return c
        if fin == "dorsal":
            c = srgb_lin((0.45, 0.43, 0.30)) if s_along < 0.55 else blue if s_along < 0.75 else clear
            return c
        return clear  # paired fins: pale, nearly unpigmented

    def fin(self, base_name, rays, mat_m, mat_r, meta_m, ray_meta, fin_key, branch=True, r0=0.0016, r1=0.0004,
            mem_t=0.0006, n_joint=8, branch_skip=(0,)):
        ns = len(rays[0])
        V, C = [], []
        for k, r in enumerate(rays):
            for j, p in enumerate(r):
                V.append(tuple(p))
                C.append(self.fin_colour(fin_key, k / max(len(rays) - 1, 1), j / (ns - 1)))
        meta_m.setdefault("colour", "vertex colours (COLOR_0): %s; material factor white, alpha 0.80" % {
            "caudal": "horizontal blue #24316B / gold #E6C873 stripes, pale #EDE6CC tips",
            "anal": "blue #24316B / gold #E6C873 bands parallel to the body, pale margin",
            "dorsal": "olive base #75704F, blue band #24316B, pale margin"}.get(fin_key, "pale #EDE6CC"))
        self.mk(base_name, MB().add(V, grid_faces(len(rays), ns), None, C), mat_m, meta_m, closed=False,
                solidify=mem_t, solid_offset=0.0)
        names = []
        for k, r in enumerate(rays):
            rb = MB()
            if branch and k not in branch_skip:
                # lepidotrichia branch distally: split at 55% into two daughter rays in the fin plane
                ib = int(0.55 * (ns - 1))
                rb.add(*tube(r[:ib + 1], segmented_radii(ib + 1, r0, r0 + (r1 - r0) * 0.55, int(n_joint * 0.55)), 6))
                nb = (rays[min(k + 1, len(rays) - 1)] - rays[max(k - 1, 0)])
                nb = nb[ib:] / (np.linalg.norm(nb[ib:], axis=1)[:, None] + 1e-9)
                sp = np.linspace(0, 1, ns - ib)[:, None] ** 1.3
                L = np.linalg.norm(r[-1] - r[ib])
                for sgn in (-1, 1):
                    d = r[ib:] + sgn * nb * sp * L * 0.10
                    rr = segmented_radii(ns - ib, (r0 + (r1 - r0) * 0.55) * 0.8, r1 * 0.8, int(n_joint * 0.45))
                    rb.add(*tube(d, rr, 5))
            else:
                rb.add(*tube(r, segmented_radii(ns, r0, r1, n_joint), 6))
            nm = "%s_ray_%02d" % (base_name.replace("_fin", "_fin"), k + 1) if not base_name.endswith(("_L", "_R")) \
                else "%s_ray_%s_%02d" % (base_name[:-2], base_name[-1], k + 1)
            self.mk(nm, rb, mat_r, ray_meta(k))
            names.append(nm)
        return names

    def build_fins(self):
        b, SL = self.body, self.SL
        mfin = self.mats.get("fin", alpha=0.80, rough=0.45, vcol=True)
        mray = self.mats.get("ray", rough=0.5)
        V = self.V
        ray_basis = lambda key, n, extra="": (V.basis_or([key], "ray layout%s schematic" % extra)
                                              if V.basis(key) else "%s; %d rays illustrative" % (SCHEMATIC, n))
        # ---- pectoral fins: low on the flank just behind the opercle, swept back along the body
        L_P = self.PECT * SL
        for sd, sg in SIDES:
            rays = []
            n = self.N_PECT
            for k in range(n):
                f = k / (n - 1)
                t = self.HL + 0.012 + 0.012 * f
                base = b.pt(t, math.pi * (-0.20 - 0.08 * f), 0.95, sg)
                phi = math.radians(18 + 30 * f)        # sweep back
                dlt = math.radians(-14 - 10 * f)       # angled down
                d = (-math.cos(phi) * math.cos(dlt), sg * math.sin(phi) * math.cos(dlt) * 0.55, math.sin(dlt))
                d = np.array(d) / np.linalg.norm(d)
                prof = 0.80 + 0.20 * (f / 0.25) if f <= 0.25 else 1 - 0.55 * ((f - 0.25) / 0.75) ** 1.4
                rays.append(ray_line(base, d, L_P * prof, (0, sg * 0.04, -0.02), 22))
            longest = max(float(np.linalg.norm(r[-1] - r[0])) for r in rays)
            rays = [r[0] + (r - r[0]) * (L_P / longest) for r in rays]
            self.fin("pectoral_fin_" + sd, rays, mfin, mray,
                     self.M("pectoral fin (membrane), %s" % side_word(sd), "ZFA:0001161", "organ", "fin",
                            "outer", sd, basis=V.basis_or(["pectoral_fin_length_over_SL"], "fin outline and pose "
                                                          "schematic"),
                            note="longest ray = %.3f SL" % self.PECT),
                     lambda k, sd=sd: self.M("pectoral fin ray %d (lepidotrichium), %s" % (k + 1, side_word(sd)),
                                             "ZFA:0001551", "organ", "skeletal", "skeleton", sd,
                                             basis=ray_basis("pectoral_fin_rays", self.N_PECT)),
                     "pectoral", r0=0.0012, r1=0.0003)
        # ---- pelvic fins: abdominal, ventrolateral
        L_V = self.PELV * SL
        for sd, sg in SIDES:
            rays = []
            n = self.N_PELV
            for k in range(n):
                f = k / (n - 1)
                base = b.pt(self.PELV_ORIGIN + 0.012 * f, math.pi * (-0.40 + 0.05 * f), 0.95, sg)
                phi = math.radians(10 + 26 * f)
                dlt = math.radians(-22 + 8 * f)
                d = np.array((-math.cos(phi) * math.cos(dlt), sg * math.sin(phi) * math.cos(dlt) * 0.6, math.sin(dlt)))
                d /= np.linalg.norm(d)
                prof = 1.0 - 0.45 * f if f > 0.15 else 0.92 + 0.08 * f / 0.15
                rays.append(ray_line(base, d, L_V * prof, (0, 0, 0.01), 18))
            longest = max(float(np.linalg.norm(r[-1] - r[0])) for r in rays)
            rays = [r[0] + (r - r[0]) * (L_V / longest) for r in rays]
            self.fin("pelvic_fin_" + sd, rays, mfin, mray,
                     self.M("pelvic fin (membrane), %s" % side_word(sd), "ZFA:0001184", "organ", "fin",
                            "outer", sd, basis=V.basis_or(["pelvic_fin_length_over_SL", "pelvic_fin_origin_over_SL"],
                                                          "fin outline and pose schematic")),
                     lambda k, sd=sd: self.M("pelvic fin ray %d (lepidotrichium), %s" % (k + 1, side_word(sd)),
                                             "ZFA:0001552", "organ", "skeletal", "skeleton", sd,
                                             basis=ray_basis("pelvic_fin_rays", self.N_PELV)),
                     "pelvic", r0=0.0010, r1=0.0003)
        # ---- dorsal fin
        rays = []
        n = self.N_DORS
        base_len = 0.15
        for k in range(n):
            f = k / (n - 1)
            t = self.DORS_ORIGIN + base_len * f
            base = b.world(t, 0.0, 0.96)
            psi = math.radians(28 + 22 * f)
            prof = 0.75 + 0.25 * f / 0.2 if f < 0.2 else 1 - 0.50 * ((f - 0.2) / 0.8)
            rays.append(ray_line(base, (-math.sin(psi), 0, math.cos(psi)), 0.13 * SL * prof, (-0.05, 0, 0), 16))
        self.DORS_RAYS = rays
        self.fin("dorsal_fin", rays, mfin, mray,
                 self.M("dorsal fin (membrane)", "ZFA:0001173", "organ", "fin", "outer", "mid",
                        basis=V.basis_or(["dorsal_fin_origin_over_SL"], "fin base length and height schematic")),
                 lambda k: self.M("dorsal fin ray %d (lepidotrichium)" % (k + 1), "ZFA:0001418", "organ", "skeletal",
                                  "skeleton", "mid", basis=ray_basis("dorsal_fin_rays", self.N_DORS)),
                 "dorsal", r0=0.0012, r1=0.0003)
        # ---- anal fin: long base
        rays = []
        n = self.N_ANAL
        base_len = 0.20
        for k in range(n):
            f = k / (n - 1)
            t = self.ANAL_ORIGIN + base_len * f
            base = b.world(t, 0.0, -0.96)
            psi = math.radians(30 + 20 * f)
            prof = 0.80 + 0.20 * f / 0.15 if f < 0.15 else 1 - 0.45 * ((f - 0.15) / 0.85)
            rays.append(ray_line(base, (-math.sin(psi), 0, -math.cos(psi)), 0.11 * SL * prof, (-0.05, 0, 0), 16))
        self.ANAL_RAYS = rays
        self.fin("anal_fin", rays, mfin, mray,
                 self.M("anal fin (membrane), striped", "ZFA:0001162", "organ", "fin", "outer", "mid",
                        basis=V.basis_or(["anal_fin_origin_over_SL"], "fin base length and height schematic; "
                                         "blue/gold bands schematic")),
                 lambda k: self.M("anal fin ray %d (lepidotrichium)" % (k + 1), "ZFA:0001421", "organ", "skeletal",
                                  "skeleton", "mid", basis=ray_basis("anal_fin_rays", self.N_ANAL)),
                 "anal", r0=0.0012, r1=0.0003)
        # ---- caudal fin: forked, lobes about equal
        rays = []
        n = self.N_CAUD
        hb = b.hd(1.0)
        Ll = self.CAUD * SL
        Lm = 0.42 * Ll
        for k in range(n):
            f = k / (n - 1)
            base = (b.x(0.985), 0.0, b.zc(1.0) + hb * (0.95 - 1.9 * f))
            a = math.radians(30 - 60 * f)
            g = abs(f - 0.5) / 0.5
            L = Lm + (Ll - Lm) * g ** 1.3
            rays.append(ray_line(base, (-math.cos(a), 0, math.sin(a)), L, (0, 0, 0.02 * math.copysign(1, a)), 22))
        self.fin("caudal_fin", rays, mfin, mray,
                 self.M("caudal fin (membrane), forked, striped", "ZFA:0001058", "organ", "fin", "outer",
                        "mid", basis=V.basis_or(["caudal_fin_length_over_SL"], "fork depth and lobe shape schematic; "
                                                "fin stripes continuous with body stripes per Parichy et al. 2009, "
                                                "widths schematic")),
                 lambda k: self.M("caudal fin principal ray %d (lepidotrichium)" % (k + 1), "ZFA:0001550", "organ",
                                  "skeletal", "skeleton", "mid", basis=ray_basis("caudal_fin_principal_rays",
                                                                                 self.N_CAUD)),
                 "caudal", r0=0.0014, r1=0.0003, branch_skip=(0, n - 1))
        # procurrent rays: short unbranched rays at the dorsal and ventral margins of the caudal fin
        rb = MB()
        for sgn in (1, -1):
            for k in range(6):
                t = 0.985 - 0.012 * (k + 1)
                base = np.array(b.world(t, 0.0, sgn * 0.98))
                L = (0.34 - 0.04 * k) * Lm
                a = math.radians(sgn * (8 + 2 * k))
                rb.add(*tube(ray_line(base, (-math.cos(a), 0, math.sin(a)), L, (0, 0, 0), 8),
                             np.linspace(0.0007, 0.0002, 8), 5))
        self.mk("caudal_fin_procurrent_rays", rb, mray,
                self.M("caudal fin procurrent rays (6 dorsal, 6 ventral, illustrative)", "ZFA:0001550", "organ",
                       "skeletal", "skeleton", "mid", basis=SCHEMATIC,
                       note="mapped to caudal fin lepidotrichium; no separate procurrent-ray class was looked up"))

    # ------------------------------------------------------------------ muscle
    def build_muscle(self):
        b = self.body
        mat = self.mats.get("muscle", rough=0.6)
        NM = self.N_MYO
        t0, t1 = self.HL + 0.005, 0.985
        edges = np.linspace(t0, t1, NM + 1)
        A = 0.55 * (edges[1] - edges[0])
        gap = 0.06 * (edges[1] - edges[0])
        wfun = lambda nz: 2 * abs(2 * abs(nz) - 1) - 1   # W-shaped myoseptum

        for sd, sg in SIDES:
            mb = MB()
            for i in range(NM):
                for half in (-1, 1):  # hypaxial / epaxial, split at the horizontal myoseptum
                    ths = np.linspace(0.025, math.pi / 2, 16) * half
                    if half < 0:
                        ths = ths[::-1]
                    outer, inner = [], []
                    for a in np.linspace(0, 1, 3):
                        ro, ri = [], []
                        for th in ths:
                            nz = math.sin(th)
                            b0 = edges[i] - A * wfun(nz) * (0.3 if i == 0 else 1.0)
                            b1 = edges[i + 1] - A * wfun(nz)
                            t = min(max(b0 + gap + (b1 - b0 - 2 * gap) * a, t0 - A * 0.3), 0.995)
                            s_out = 1 - 0.0030 / b.local_radius(t)
                            s_in = 0.62 if t < 0.64 else 0.62 - 0.30 * (t - 0.64) / 0.36
                            ro.append(b.pt(t, th, s_out, sg))
                            ri.append(b.pt(t, th, s_in, sg))
                        outer.append(ro)
                        inner.append(ri)
                    mb.add(*slab(outer, inner))
            self.mk("muscle_" + sd, mb, mat,
                    self.M("trunk musculature: myomeres (W-shaped, epaxial and hypaxial), %s" % side_word(sd),
                           "ZFA:0001056", "tissue", "musculature", "muscle", sd,
                           basis=(SCHEMATIC + "; myomere count set equal to the vertebra count (%d), which is %s"
                                  % (NM, "sourced" if self.V.basis("vertebrae_total") else "illustrative")),
                           note="ZFA 'myotome' is the closest class for the segmented trunk muscle; the gap at the "
                                "horizontal myoseptum separates epaxial and hypaxial halves"),
                    inside=0.995)

    # ------------------------------------------------------------------ skeleton
    def vert_nz(self, t):
        return 0.20 - 0.20 * min(max((t - 0.62) / 0.38, 0), 1) ** 1.2

    def build_skeleton(self):
        b, V = self.body, self.V
        bone = self.mats.get("bone", rough=0.55)
        N = self.N_VERT
        t0, t1 = self.HL + 0.005, 0.985
        step = (t1 - t0) / N
        self.VT = []
        cnt_basis = V.basis("vertebrae_total")
        for i in range(N):
            tc = t0 + step * (i + 0.5)
            self.VT.append(tc)
            hh = b.hd(tc)
            rc = max(0.12 * hh, 0.0018) * (0.85 if i < self.N_WEB else 1.0)
            cx, cz = b.x(tc), b.zc(tc) + self.vert_nz(tc) * hh
            Lc = step * self.SL * 0.86
            mb = MB()
            xs = np.linspace(cx + Lc / 2, cx - Lc / 2, 7)
            rad = rc * (1 - 0.25 * np.sin(np.linspace(0, math.pi, 7)))
            mb.add(*tube(np.stack([xs, np.zeros(7), np.full(7, cz)], 1), rad, 12))
            top = b.world(tc + 0.025, 0.0, 0.84 if tc < 0.95 else 0.7)
            p0 = np.array([cx, 0, cz + rc * 0.8])
            for sgn in (1, -1):  # neural arch: paired, meeting above the spinal cord
                mid = p0 + np.array([0, sgn * rc * 0.9, rc * 1.6])
                mb.add(*tube([p0 + (0, sgn * rc * 0.5, 0), mid, mid + (0, -sgn * rc * 0.8, rc * 0.9)],
                             rc * 0.22, 5))
            ps = p0 + np.array([0, 0, rc * 2.4])
            mb.add(*tube(np.linspace(ps, np.array(top), 6), np.linspace(rc * 0.30, rc * 0.10, 6), 5))
            caudal = i >= self.N_PRECAUDAL
            if caudal:
                bot = b.world(tc + 0.025, 0.0, -0.84 if tc < 0.95 else -0.7)
                q0 = np.array([cx, 0, cz - rc * 0.8])
                for sgn in (1, -1):
                    mid = q0 + np.array([0, sgn * rc * 0.9, -rc * 1.6])
                    mb.add(*tube([q0 + (0, sgn * rc * 0.5, 0), mid, mid + (0, -sgn * rc * 0.8, -rc * 0.9)],
                                 rc * 0.22, 5))
                qs = q0 + np.array([0, 0, -rc * 2.4])
                mb.add(*tube(np.linspace(qs, np.array(bot), 6), np.linspace(rc * 0.30, rc * 0.10, 6), 5))
            elif i >= self.N_WEB:  # parapophyses on precaudal vertebrae carry the ribs
                for sgn in (1, -1):
                    mb.add(*tube([(cx, sgn * rc * 0.6, cz - rc * 0.3), (cx, sgn * rc * 1.9, cz - rc * 0.6)],
                                 rc * 0.25, 5))
            if i < self.N_WEB:
                lab = "Weberian vertebra %d (modified centrum and arches)" % (i + 1)
                zid = "ZFA:0001190"
                basis = V.basis_or(["weberian_vertebrae"], "shape schematic")
            else:
                kind = "caudal" if caudal else "precaudal"
                lab = "vertebra %d (%s; centrum, neural arch and spine%s)" % (
                    i + 1, kind, ", haemal arch and spine" if caudal else ", parapophyses")
                zid = "ZFA:0001189"
                basis = V.basis_or(["vertebrae_total", "precaudal_vertebrae_incl_weberian"],
                                   "centrum shape and spine lengths schematic")
            self.mk("vertebra_%02d" % (i + 1), mb, bone,
                    self.M(lab, zid, "organ", "skeletal", "skeleton", "mid", basis=basis), inside=0.97)
        # pleural ribs on precaudal vertebrae after the Weberian ones
        rib_v = [i for i in range(self.N_WEB, self.N_PRECAUDAL)][:self.N_RIB_PAIRS]
        for sd, sg in SIDES:
            mb = MB()
            for i in rib_v:
                tc = self.VT[i]
                ctrl = [(tc, 0.12 * sg, self.vert_nz(tc) - 0.05), (tc + 0.01, 0.48 * sg, 0.02),
                        (tc + 0.03, 0.62 * sg, -0.30), (tc + 0.055, 0.50 * sg, -0.66)]
                P = spline([b.world(*c) for c in ctrl], 16)
                mb.add(*tube(P, np.linspace(0.0010, 0.0004, 16), 5))
            self.mk("ribs_" + sd, mb, bone,
                    self.M("pleural ribs (%d), %s" % (len(rib_v), side_word(sd)), "ZFA:0000538", "organ", "skeletal",
                           "skeleton", sd, basis=V.basis_or(["pleural_rib_pairs"], "rib curvature schematic")),
                    inside=0.98)
        # Weberian ossicles: chain from the inner ear region to the anterior swim bladder chamber
        for sd, sg in SIDES:
            mb = MB()
            pts = [(self.VT[0] - 0.012, 0.10 * sg, 0.30), (self.VT[0], 0.16 * sg, 0.24),   # scaphium, claustrum
                   (self.VT[1], 0.20 * sg, 0.16), (self.VT[2] + 0.004, 0.26 * sg, 0.02),  # intercalarium, tripus
                   (self.VT[3] + 0.010, 0.24 * sg, -0.08)]
            W = [b.world(*p) for p in pts]
            radii = [(0.0022, 0.0016, 0.0020), (0.0010, 0.0008, 0.0010), (0.0016, 0.0012, 0.0014),
                     (0.0030, 0.0014, 0.0022)]
            for k, r in enumerate(radii):
                mb.add(*ellipsoid_world(W[k], r, 8, 12))
            mb.add(*tube(spline(W, 14), 0.0005, 5))  # ligament
            self.mk("weberian_ossicles_" + sd, mb, bone,
                    self.M("Weberian ossicles (scaphium, claustrum, intercalarium, tripus), %s" % side_word(sd),
                           "ZFA:0000461", "organ", "skeletal", "skeleton", sd,
                           basis=SCHEMATIC + "; four ossicles per side as named in ZFA, sizes and positions schematic",
                           note="links the anterior swim bladder chamber to the inner ear (simplified)"), inside=0.95)
        # skull: neurocranium / skull roof over the brain, two halves, with orbit notches
        for sd, sg in SIDES:
            ec, er = self.EYE[sd]
            ecn = np.array(ec)
            hole = lambda p, ecn=ecn, er=er: np.linalg.norm((p - ecn) * (1, 0.5, 1)) < er * 1.10
            Vv, F = b.patch(0.135, 0.36 * math.pi, 0.125, 0.30 * math.pi, 0.86, sg, nr=12, na=40, hole=hole,
                            squash=lambda r, a: 1.0 if math.sin(a) > 0 else 1 - 0.25 * abs(math.sin(a)))
            self.mk("neurocranium_" + sd, MB().add(Vv, F), bone,
                    self.M("neurocranium and skull roof (simplified shell), %s half" % side_word(sd), "ZFA:0001580",
                           "organ", "skeletal", "skeleton", sd, basis=SCHEMATIC,
                           note="braincase roof and upper sides only; individual cranial bones not separated"),
                    closed=False, solidify=0.0018, solid_offset=-1.0,
                    outward_axis=lambda c: Vector((c.x, 0.0, self.body.zc(self.body.x_to_t(c.x)))))
        # opercle: rounded plate covering the gill chamber
        for sd, sg in SIDES:
            Vv, F = b.patch(self.HL - 0.040, -0.02 * math.pi, 0.032, 0.21 * math.pi, 0.958, sg, nr=8, na=32,
                            squash=lambda r, a: 1.0 - 0.18 * max(math.cos(a), 0) * abs(math.sin(a)))
            self.mk("opercle_" + sd, MB().add(Vv, F), bone,
                    self.M("opercle (gill cover bone), %s" % side_word(sd), "ZFA:0000250", "organ", "skeletal",
                           "skeleton", sd, basis=SCHEMATIC),
                    closed=False, solidify=0.0010, solid_offset=-1.0,
                    outward_axis=lambda c: Vector((c.x, 0.0, self.body.zc(self.body.x_to_t(c.x)))))
        # jaws (zebrafish has no oral teeth): dentary, premaxilla, maxilla as simple bars per side
        for sd, sg in SIDES:
            P = spline([b.world(0.004, 0.05 * sg, -0.10), b.world(0.03, 0.55 * sg, -0.40),
                        b.world(0.07, 0.72 * sg, -0.48)], 12)
            self.mk("dentary_" + sd, MB().add(*tube(P, np.linspace(0.0014, 0.0022, 12), 6, flat=0.6)), bone,
                    self.M("dentary (lower jaw), %s" % side_word(sd), "ZFA:0000191", "organ", "skeletal", "skeleton",
                           sd, basis=SCHEMATIC), inside=0.99)
            P = spline([b.world(0.003, 0.05 * sg, 0.12), b.world(0.02, 0.55 * sg, 0.02),
                        b.world(0.035, 0.75 * sg, -0.10)], 10)
            self.mk("premaxilla_" + sd, MB().add(*tube(P, np.linspace(0.0011, 0.0009, 10), 6, flat=0.6)), bone,
                    self.M("premaxilla (upper jaw), %s" % side_word(sd), "ZFA:0000567", "organ", "skeletal",
                           "skeleton", sd, basis=SCHEMATIC), inside=0.99)
            P = spline([b.world(0.012, 0.45 * sg, 0.15), b.world(0.035, 0.74 * sg, -0.05),
                        b.world(0.055, 0.78 * sg, -0.22)], 10)
            self.mk("maxilla_" + sd, MB().add(*tube(P, np.linspace(0.0010, 0.0013, 10), 6, flat=0.6)), bone,
                    self.M("maxilla (upper jaw), %s" % side_word(sd), "ZFA:0000270", "organ", "skeletal", "skeleton",
                           sd, basis=SCHEMATIC), inside=0.99)
        # ceratobranchial 5 with pharyngeal teeth (cyprinids have pharyngeal, not oral, teeth)
        mt = self.mats.get("teeth", rough=0.35)
        for sd, sg in SIDES:
            mb = MB()
            P = spline([b.world(self.HL - 0.075, 0.15 * sg, -0.55), b.world(self.HL - 0.06, 0.36 * sg, -0.30),
                        b.world(self.HL - 0.052, 0.40 * sg, -0.02)], 12)
            mb.add(*tube(P, 0.0013, 6))
            for k in range(5):
                q = P[3 + k * 2]
                mb.add(*tube([q, q + np.array([0.002, -sg * 0.0035, 0.0015])], [0.0008, 0.0002], 5))
            self.mk("ceratobranchial_5_" + sd, mb, mt,
                    self.M("ceratobranchial 5 with pharyngeal teeth, %s" % side_word(sd), "ZFA:0001239", "organ",
                           "skeletal", "skeleton", sd, basis=SCHEMATIC + "; tooth count illustrative"), inside=0.95)
        # pectoral girdle: cleithrum, scapula, coracoid, proximal radials
        tg = self.HL + 0.002
        for sd, sg in SIDES:
            ths = np.linspace(0.40 * math.pi, -0.47 * math.pi, 22)
            P = [b.pt(tg + 0.010 * (0.5 - th / math.pi), th, 0.90, sg) for th in ths]
            self.mk("cleithrum_" + sd, MB().add(*tube(P, np.linspace(0.0014, 0.0022, 22), 6, flat=0.55)), bone,
                    self.M("cleithrum, %s" % side_word(sd), "ZFA:0000184", "organ", "skeletal", "skeleton", sd,
                           basis=SCHEMATIC, note="main bone of the pectoral girdle; curved bar behind the gill "
                                                 "chamber"), inside=0.98)
            p = b.pt(tg + 0.012, -0.12 * math.pi, 0.84, sg)
            self.mk("scapula_" + sd, MB().add(*ellipsoid_world(p, (0.004, 0.0014, 0.005), 8, 12)), bone,
                    self.M("scapula, %s" % side_word(sd), "ZFA:0000583", "organ", "skeletal", "skeleton", sd,
                           basis=SCHEMATIC), inside=0.98)
            p = b.pt(tg + 0.010, -0.30 * math.pi, 0.80, sg)
            self.mk("coracoid_" + sd, MB().add(*ellipsoid_world(p, (0.006, 0.0014, 0.009), 8, 12, (0.3 * sg, 0, 0))),
                    bone, self.M("coracoid, %s" % side_word(sd), "ZFA:0000332", "organ", "skeletal", "skeleton", sd,
                                 basis=SCHEMATIC), inside=0.98)
            mb = MB()
            for k in range(4):
                th = math.pi * (-0.19 - 0.035 * k)
                a = np.array(b.pt(tg + 0.014, th, 0.86, sg))
                c = np.array(b.pt(tg + 0.024, th, 0.93, sg))
                mb.add(*tube([a, c], [0.0010, 0.0008], 6))
            self.mk("pectoral_radials_" + sd, mb, bone,
                    self.M("pectoral fin proximal radials (4), %s" % side_word(sd), "ZFA:0001587", "organ",
                           "skeletal", "skeleton", sd, basis=SCHEMATIC + "; 4 proximal radials illustrative"),
                    inside=0.99)
        # pelvic girdle: basipterygia
        for sd, sg in SIDES:
            P = spline([b.world(self.PELV_ORIGIN - 0.07, 0.10 * sg, -0.86), b.world(self.PELV_ORIGIN - 0.03, 0.22 * sg,
                                                                                     -0.88),
                        b.world(self.PELV_ORIGIN + 0.004, 0.34 * sg, -0.86)], 10)
            self.mk("basipterygium_" + sd, MB().add(*tube(P, np.linspace(0.0009, 0.0018, 10), 6, flat=0.5)), bone,
                    self.M("basipterygium (pelvic girdle), %s" % side_word(sd), "ZFA:0000623", "organ", "skeletal",
                           "skeleton", sd, basis=SCHEMATIC), inside=0.99)
        # median fin radials (pterygiophores), one under each ray
        for key, rays, zid, lab, sgn in (("dorsal", self.DORS_RAYS, "ZFA:0000947", "dorsal fin proximal radials", 1),
                                         ("anal", self.ANAL_RAYS, "ZFA:0000268", "anal fin proximal radials", -1)):
            mb = MB()
            for r in rays:
                t = b.x_to_t(r[0][0])
                top = np.array(b.world(t, 0.0, sgn * 0.93))
                bot = np.array(b.world(t + 0.012, 0.0, sgn * 0.45))
                mb.add(*tube([top, bot], [0.0010, 0.0005], 5))
            self.mk(key + "_fin_radials", mb, bone,
                    self.M("%s (%d, one per ray)" % (lab, len(rays)), zid, "organ", "skeletal", "skeleton", "mid",
                           basis=SCHEMATIC + "; count follows the ray count"), inside=0.97)
        # caudal skeleton: hypurals fan + parhypural
        tl = self.VT[-1]
        cx, cz = b.x(tl), b.zc(tl) + self.vert_nz(tl) * b.hd(tl)
        mb = MB()
        hb = b.hd(1.0)
        for k in range(self.N_HYP):
            f = k / max(self.N_HYP - 1, 1)
            a = math.radians(-35 + 70 * f)
            p0 = np.array([cx - 0.004, 0, cz])
            p1 = np.array([b.x(1.0) - 0.002, 0, b.zc(1.0) + hb * (-0.85 + 1.7 * f)])
            mid = (p0 + p1) / 2
            mb.add(*ellipsoid_world(mid, (np.linalg.norm(p1 - p0) / 2, 0.0006, 0.0014 + 0.0008 * (1 - abs(f - 0.3))),
                                    6, 10, (0, -math.atan2(p1[2] - p0[2], -(p1[0] - p0[0])) * -1, 0)))
        self.mk("hypurals", mb, bone,
                self.M("hypurals 1-%d (caudal fin endoskeleton)" % self.N_HYP, "ZFA:0000364", "organ", "skeletal",
                       "skeleton", "mid", basis=V.basis_or(["hypurals"], "plate shapes schematic")), inside=1.02)
        p0 = np.array([cx + 0.006, 0, cz - 0.002])
        p1 = np.array([b.x(0.99), 0, b.zc(0.99) - hb * 0.95])
        self.mk("parhypural", MB().add(*tube([p0, p1], [0.0010, 0.0007], 6)), bone,
                self.M("parhypural", "ZFA:0000438", "organ", "skeletal", "skeleton", "mid", basis=SCHEMATIC),
                inside=1.02)

    # ------------------------------------------------------------------ organs
    def build_organs(self):
        b, HL = self.body, self.HL
        nerv = self.mats.get("nervous", rough=0.5)
        # brain regions (separate objects), from rostral to caudal
        brain = [
            ("brain_olfactory_bulbs", "olfactory bulbs", "ZFA:0000402",
             [((0.050, 0.10, 0.36), (0.012, 0.10, 0.09)), ((0.050, -0.10, 0.36), (0.012, 0.10, 0.09))]),
            ("brain_telencephalon", "telencephalon", "ZFA:0000079",
             [((0.078, 0.14, 0.42), (0.022, 0.15, 0.15)), ((0.078, -0.14, 0.42), (0.022, 0.15, 0.15))]),
            ("brain_optic_tectum", "optic tectum (paired lobes)", "ZFA:0000445",
             [((0.125, 0.22, 0.45), (0.032, 0.24, 0.22)), ((0.125, -0.22, 0.45), (0.032, 0.24, 0.22))]),
            ("brain_hypothalamus", "hypothalamus (ventral diencephalon)", "ZFA:0000032",
             [((0.118, 0.12, 0.12), (0.022, 0.13, 0.12)), ((0.118, -0.12, 0.12), (0.022, 0.13, 0.12))]),
            ("brain_cerebellum", "cerebellum", "ZFA:0000100", [((0.163, 0.0, 0.50), (0.024, 0.20, 0.18))]),
            ("brain_medulla_oblongata", "medulla oblongata (hindbrain)", "ZFA:0000545",
             [((0.190, 0.0, 0.32), (0.040, 0.18, 0.17))]),
        ]
        for name, lab, zid, parts in brain:
            mb = MB()
            for c, r in parts:
                mb.add(*b.ellipsoid(c, r, 10, 16))
            self.mk(name, mb, nerv, self.M("brain: " + lab, zid, "organ", "nervous", "organ", "mid",
                                           basis=SCHEMATIC, note="part of the brain (ZFA:0000008)"), inside=0.9)
        ts = np.linspace(0.20, 0.975, 44)
        P = [b.world(t, 0.0, self.vert_nz(t) + 0.20 - 0.05 * min(max((t - 0.85) / 0.13, 0), 1)) for t in ts]
        self.mk("spinal_cord", MB().add(*tube(P, [max(0.032 * b.hd(t), 0.0007) for t in ts], 8)), nerv,
                self.M("spinal cord", "ZFA:0000075", "organ", "nervous", "organ", "mid", basis=SCHEMATIC), inside=0.9)
        # inner ears with three otoliths each
        sen = self.mats.get("sensory", rough=0.35)
        for sd, sg in SIDES:
            mb = MB()
            c = (0.180, 0.34 * sg, 0.30)
            mb.add(*b.ellipsoid(c, (0.020, 0.13, 0.16), 10, 14))
            for dc, r in (((-0.012, 0.0, -0.05), 0.0018), ((0.010, 0.02, -0.10), 0.0024), ((0.016, 0.0, -0.02), 0.0012)):
                mb.add(*ellipsoid_world(b.world(c[0] + dc[0], c[1] + dc[1] * sg, c[2] + dc[2]),
                                        (r, r * 0.6, r * 0.8), 6, 10))
            self.mk("inner_ear_" + sd, mb, sen,
                    self.M("inner ear with otoliths (lapillus, sagitta, asteriscus), %s" % side_word(sd),
                           "ZFA:0000217", "organ", "sensory", "organ", sd, basis=SCHEMATIC), inside=0.9)
        # gills: arches with filaments, under the opercle
        gm = self.mats.get("respiratory", rough=0.5)
        for sd, sg in SIDES:
            mb = MB()
            for a in range(self.N_GILL):
                ta = HL - 0.085 + a * 0.014
                ph = np.linspace(0, 1, 18)
                arch = lambda p: b.world(ta + 0.010 * math.sin(math.pi * p),
                                         sg * (0.18 + 0.40 * math.sin(math.pi * p)), 0.30 - 0.90 * p)
                P = np.array([arch(p) for p in ph])
                mb.add(*tube(P, 0.0011, 6))
                for p in np.linspace(0.08, 0.92, 18):
                    q = np.array(arch(p))
                    d = np.array([-0.55, sg * 1.0, 0.0])
                    d /= np.linalg.norm(d)
                    Lf = 0.009 * (0.6 + 0.4 * math.sin(math.pi * p))
                    mb.add(*tube(np.linspace(q, q + d * Lf, 3), np.array([0.0009, 0.0006, 0.0002]), 4))
            self.mk("gills_" + sd, mb, gm,
                    self.M("gills (%d gill arches with filaments), %s" % (self.N_GILL, side_word(sd)), "ZFA:0000354",
                           "organ", "respiratory", "organ", sd,
                           basis=(self.V.basis_or(["gill_arches_per_side"], "filament count illustrative")
                                  if self.V.basis("gill_arches_per_side") else
                                  SCHEMATIC + "; %d arches and filament count illustrative" % self.N_GILL)),
                    inside=0.93)
        # heart: sinus venosus, atrium, ventricle, bulbus arteriosus, in the pericardial region behind the gills
        th_ = HL - 0.010
        parts = [
            ("heart_sinus_venosus", "sinus venosus", "ZFA:0000154", "circulatory", (th_ + 0.020, 0.0, -0.42),
             (0.008, 0.20, 0.06)),
            ("heart_atrium", "atrium", "ZFA:0000471", "atrium", (th_ + 0.006, 0.08, -0.50), (0.013, 0.22, 0.12)),
            ("heart_ventricle", "ventricle", "ZFA:0000009", "circulatory", (th_ - 0.004, -0.02, -0.68),
             (0.012, 0.18, 0.13)),
            ("heart_bulbus_arteriosus", "bulbus arteriosus", "ZFA:0000173", "bulbus", (th_ - 0.020, 0.0, -0.60),
             (0.008, 0.08, 0.07)),
        ]
        for name, lab, zid, key, c, r in parts:
            self.mk(name, MB().add(*b.ellipsoid(c, r, 10, 16)), self.mats.get(key, rough=0.45),
                    self.M("heart: " + lab, zid, "organ", "cardiovascular", "organ", "mid", basis=SCHEMATIC,
                           note="part of the heart (ZFA:0000114); two-chambered fish heart (one atrium, one ventricle)"),
                    inside=0.9)
        # digestive tract: oesophagus -> intestinal bulb -> mid intestine (looped) -> posterior intestine -> vent
        gk = [("gut", "#E8A87C"), ("gut2", None), ("gut3", None)]
        t_v = self.SVL
        P_oes = spline([b.world(*c) for c in [(HL - 0.04, 0.0, 0.0), (HL, 0.0, -0.05), (HL + 0.03, 0.0, -0.12)]], 12)
        self.mk("oesophagus", MB().add(*tube(P_oes, 0.0040, 10)), self.mats.get("gut", rough=0.5),
                self.M("oesophagus", "ZFA:0000204", "organ", "digestive", "organ", "mid", basis=SCHEMATIC),
                inside=0.9)
        P = spline([b.world(*c) for c in [(HL + 0.03, 0.0, -0.12), (HL + 0.06, 0.18, -0.30), (HL + 0.11, 0.22, -0.42),
                                           (HL + 0.15, 0.10, -0.50)]], 24)
        self.mk("intestinal_bulb", MB().add(*tube(P, np.concatenate([np.linspace(0.0045, 0.0085, 8),
                                                                     np.full(10, 0.0085),
                                                                     np.linspace(0.0085, 0.0055, 6)]), 12)),
                self.mats.get("gut", rough=0.5),
                self.M("intestinal bulb (anterior intestine; zebrafish has no stomach)", "ZFA:0001076", "organ",
                       "digestive", "organ", "mid", basis=SCHEMATIC,
                       note="the zebrafish gut has no stomach; the intestinal bulb is the widened anterior intestine"),
                inside=0.9)
        P = spline([b.world(*c) for c in [(HL + 0.15, 0.10, -0.50), (HL + 0.22, -0.10, -0.52), (0.52, -0.28, -0.60),
                                           (0.56, -0.20, -0.74), (0.50, 0.05, -0.80), (0.42, 0.18, -0.74),
                                           (0.40, 0.05, -0.64)]], 40)
        self.mk("mid_intestine", MB().add(*tube(P, 0.0048, 10)), self.mats.get("gut2", rough=0.5),
                self.M("mid intestine (looped)", "ZFA:0001323", "organ", "digestive", "organ", "mid",
                       basis=SCHEMATIC + "; loop path schematic"), inside=0.92)
        P = spline([b.world(*c) for c in [(0.40, 0.05, -0.64), (0.46, -0.05, -0.56), (0.55, 0.04, -0.56),
                                           (t_v - 0.03, 0.0, -0.70), (t_v - 0.005, 0.0, -0.95)]], 28)
        self.mk("posterior_intestine", MB().add(*tube(P, np.linspace(0.0046, 0.0032, 28), 10)),
                self.mats.get("gut3", rough=0.5),
                self.M("posterior intestine to the vent", "ZFA:0000706", "organ", "digestive", "organ", "mid",
                       basis=self.V.basis_or(["snout_vent_over_SL"], "path schematic"),
                       note="ends at the vent, snout-vent length = %.3f SL" % t_v), inside=1.0)
        self.VENT_T = t_v
        # liver: three lobes, anterior-ventral in the body cavity; gall bladder
        lm = self.mats.get("liver", rough=0.45)
        mb = MB()
        mb.add(*b.ellipsoid((HL + 0.065, 0.32, -0.50), (0.048, 0.24, 0.24)))
        mb.add(*b.ellipsoid((HL + 0.055, -0.30, -0.48), (0.040, 0.22, 0.22)))
        mb.add(*b.ellipsoid((HL + 0.085, 0.0, -0.72), (0.050, 0.26, 0.14)))
        self.mk("liver", mb, lm, self.M("liver (left, right and ventral lobes)", "ZFA:0000123", "organ",
                                        "hepatobiliary", "organ", "mid", basis=SCHEMATIC), inside=0.9)
        self.mk("gall_bladder", MB().add(*b.ellipsoid((HL + 0.075, -0.28, -0.62), (0.010, 0.09, 0.08))),
                self.mats.get("gall", rough=0.3),
                self.M("gall bladder", "ZFA:0000208", "organ", "hepatobiliary", "organ", "mid", basis=SCHEMATIC),
                inside=0.9)
        # pancreas: diffuse lobules along the intestine (exocrine pancreas + principal islet)
        mb = MB()
        rng = np.random.default_rng(7)
        for k in range(16):
            t = HL + 0.10 + 0.012 * k + rng.uniform(-0.004, 0.004)
            mb.add(*b.ellipsoid((t, -0.02 + rng.uniform(-0.12, 0.12), -0.40 + rng.uniform(-0.06, 0.06)),
                                (0.008, 0.06, 0.05), 6, 10))
        self.mk("pancreas", mb, self.mats.get("pancreas", rough=0.5),
                self.M("pancreas (diffuse, along the intestine)", "ZFA:0000140", "organ", "digestive", "organ", "mid",
                       basis=SCHEMATIC + "; lobule count illustrative"), inside=0.9)
        self.mk("spleen", MB().add(*b.ellipsoid((HL + 0.17, -0.32, -0.36), (0.016, 0.10, 0.08))),
                self.mats.get("lymphoid", rough=0.45),
                self.M("spleen", "ZFA:0000436", "organ", "hematopoietic", "organ", "mid", basis=SCHEMATIC), inside=0.9)
        # swim bladder: anterior and posterior chambers + pneumatic duct
        sm = self.mats.get("bladder", rough=0.3, metallic=0.2)
        ta0 = self.VT[self.N_WEB - 1] + 0.012
        self.mk("swim_bladder_anterior_chamber",
                MB().add(*b.ellipsoid((ta0 + 0.060, 0.0, -0.02), (0.060, 0.40, 0.28), 16, 24)), sm,
                self.M("swim bladder, anterior chamber", "ZFA:0001277", "organ", "buoyancy", "organ", "mid",
                       basis=self.V.basis_or(["swim_bladder_anterior_over_posterior"], "size and position schematic"),
                       note="two-chambered swim bladder; the anterior chamber contacts the Weberian ossicles"),
                inside=0.9)
        tp0 = ta0 + 0.128
        P = spline([b.world(tp0 + 0.002, 0.0, -0.06), b.world(tp0 + 0.08, 0.0, -0.08), b.world(tp0 + 0.17, 0.0, -0.10),
                    b.world(tp0 + 0.25, 0.0, -0.20)], 30)
        R = [0.0025 + 0.024 * math.sin(math.pi * min(max(u, 0), 1)) ** 0.6 for u in np.linspace(0, 1, 30)]
        self.mk("swim_bladder_posterior_chamber", MB().add(*tube(P, R, 20, flat=0.75)), sm,
                self.M("swim bladder, posterior chamber", "ZFA:0001278", "organ", "buoyancy", "organ", "mid",
                       basis=self.V.basis_or(["swim_bladder_anterior_over_posterior"], "size and position schematic")),
                inside=0.9)
        P = spline([b.world(HL + 0.03, 0.0, -0.10), b.world(tp0 - 0.03, 0.06, -0.30), b.world(tp0 + 0.01, 0.0, -0.20)],
                   16)
        self.mk("pneumatic_duct", MB().add(*tube(P, 0.0009, 6)), sm,
                self.M("pneumatic duct (oesophagus to swim bladder)", "ZFA:0001430", "organ", "buoyancy", "organ",
                       "mid", basis=SCHEMATIC), inside=0.9)
        # kidney (trunk) and head kidney, dorsal in the body cavity under the vertebrae
        km = self.mats.get("renal", rough=0.5)
        ts = np.linspace(ta0 + 0.01, t_v - 0.02, 30)
        P = [b.world(t, 0.0, self.vert_nz(t) - 0.17) for t in ts]
        self.mk("kidney", MB().add(*tube(P, [0.0032 * (1 - 0.35 * (t - ts[0]) / (ts[-1] - ts[0])) for t in ts], 10,
                                         flat=0.6)), km,
                self.M("kidney (trunk kidney, mesonephros)", "ZFA:0000529", "organ", "renal", "organ", "mid",
                       basis=SCHEMATIC), inside=0.9)
        mb = MB()
        for sgn in (1, -1):
            mb.add(*b.ellipsoid((HL + 0.025, 0.16 * sgn, 0.06), (0.018, 0.14, 0.10)))
        self.mk("head_kidney", mb, self.mats.get("headkidney", rough=0.5),
                self.M("head kidney (paired lobes)", "ZFA:0000669", "organ", "renal", "organ", "mid", basis=SCHEMATIC,
                       note="haematopoietic and endocrine tissue as well as renal"), inside=0.9)
        # gonads (sex not specified)
        gom = self.mats.get("reproductive", rough=0.5)
        for sd, sg in SIDES:
            P = spline([b.world(HL + 0.12, 0.30 * sg, -0.30), b.world(0.48, 0.40 * sg, -0.36),
                        b.world(t_v - 0.05, 0.22 * sg, -0.46)], 20)
            self.mk("gonad_" + sd, MB().add(*tube(P, [0.0055 * math.sin(math.pi * (0.1 + 0.8 * s)) for s in
                                                      np.linspace(0, 1, 20)], 10)), gom,
                    self.M("gonad, %s (sex not specified)" % side_word(sd), "ZFA:0000413", "organ", "reproductive",
                           "organ", sd, basis=SCHEMATIC), inside=0.92)

    # ------------------------------------------------------------------ run
    def build(self):
        clear_scene()
        img = make_scale_normal_map()
        self.build_skin(img)
        self.build_eyes()
        self.build_barbels_and_lateral_line()
        self.build_fins()
        self.build_muscle()
        self.build_skeleton()
        self.build_organs()

    def header(self, glb_rel):
        V = self.V
        sourced = {k: {"value": e["value"], "source": e["source"], "measure": e.get("measure"),
                       "derivation": e.get("derivation")}
                   for k, e in V.used.items() if e.get("basis") != SCHEMATIC and "source" in e}
        schematic = {k: e["value"] for k, e in V.used.items() if e.get("basis") == SCHEMATIC}
        return {
            "model": "adult zebrafish (Danio rerio), generic wild type, sex not specified, segmented for a cutaway viewer",
            "file": glb_rel,
            "built_with": "Blender %s (bpy, headless); anatomy-model/zebrafish/build_adult.py" % bpy.app.version_string,
            "units_and_axes": "glTF Y-up; head at +X, back at +Y, fish's left side at -Z. Standard length (snout to "
                              "caudal fin base) = %.2f units; total length about %.2f units."
                              % (self.SL, self.SL * (1 + self.CAUD)),
            "sourced_values": sourced,
            "schematic_values": schematic,
            "sources_file": "anatomy-model/zebrafish/sources.json",
            "ontology": "ZFA ids (zebrafish anatomy ontology) looked up in Ubergraph; uberon_id is the Uberon class "
                        "that carries the ZFA id as a database cross-reference. Calls in anatomy-model/zebrafish/calls.json",
            "levels": "organ / tissue",
            "layers": "outer (skin, eyes, fin membranes, barbels, lateral line) / muscle / skeleton / organ",
        }


def adult_main():
    args = parse_args(os.path.join(MODEL_DIR, "zebrafish-adult.glb"), os.path.join(HERE, "manifest-adult.json"),
                      r"C:\Temp\fish-models\zebrafish-renders\adult")
    A = Adult()
    A.build()
    probs = A.reg.check_inside(A.body, exempt=lambda n, p: n == "posterior_intestine" and
                               A.body.x_to_t(p[0]) > A.VENT_T - 0.04)
    print("INSIDE_CHECK", "OK" if not probs else probs)
    export_glb(args["glb"])
    write_manifest(A.reg, args["manifest"], A.header("dashboard/public/blueprint3d/model/zebrafish-adult.glb"),
                   os.path.join(os.path.dirname(args["glb"]), "manifest-adult.json"))
    print("EXPORTED", args["glb"], os.path.getsize(args["glb"]), "bytes,", len(A.reg.entries), "objects")
    if args["render"]:
        render_adult(A, args)


def render_adult(A, args):
    S = Shooter(A.reg, args["renders"], args["samples"], args["only"])
    L = S.by_layer()
    allobj = S.all
    skin = ["skin_L", "skin_R"]
    outer_keep = [n for n in L["outer"] if n not in skin]
    S.show(allobj)
    S.place((0.80, 1.20, 0.55), (-0.04, 0.0, 0.0), lens=42)
    S.shoot("01_whole_three_quarter")
    S.place((-0.05, 2.5, 0.0), (-0.05, 0.0, 0.0), ortho=1.12)
    S.shoot("02_lateral_left")
    S.split(0.16)
    S.place((0.85, 1.6, 0.85), (-0.05, 0.0, 0.0), lens=40)
    S.shoot("03_split_halves")
    S.split(0.0)
    S.show([n for n in allobj if n not in skin])
    S.place((0.70, 1.15, 0.45), (-0.04, 0.0, 0.0), lens=42)
    S.shoot("04_skin_removed_muscle")
    S.show(L["skeleton"] + L["organ"] + ["eye_L", "eye_R"])
    S.place((-0.05, 2.5, 0.02), (-0.05, 0.0, 0.0), ortho=1.05)
    S.shoot("05_muscle_removed_skeleton_organs")
    S.show(L["organ"] + ["eye_L", "eye_R"])
    S.place((0.45, 0.85, 0.20), (0.20, 0.0, -0.01), lens=50)
    S.shoot("06_organs_only")
    S.show(L["skeleton"])
    S.place((0.80, 1.30, 0.45), (-0.04, 0.0, 0.0), lens=42)
    S.shoot("07_skeleton_only")
    S.show(L["organ"] + ["eye_L", "eye_R"])
    S.place((0.20, 1.6, 0.0), (0.20, 0.0, 0.0), ortho=0.50)
    S.shoot("08_organs_lateral")


if __name__ == "__main__":
    adult_main()
