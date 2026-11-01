"""Render STLs: a flat plate-layout view and/or a 3/4 view. Used to eyeball parts.

blender.exe -b --python render.py -- <mode> <outpng> <stl> [<stl> ...]
mode: top | iso | plate:<W>x<H> | explode
"""
import bpy, bmesh, sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
MODE, OUTPNG = argv[0], argv[1]
STLS = argv[2:]

K.wipe()
sc = bpy.context.scene
# Cycles on CPU: this box is headless with no GPU, and Workbench/EEVEE need OpenGL.
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 24
sc.cycles.use_denoising = True
sc.render.resolution_x = 1600
sc.render.resolution_y = 1200
sc.render.film_transparent = False
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.08, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
sc.world = w

def mk_mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1)
    b.inputs["Roughness"].default_value = 0.45
    return m

PAL = [(0.85,0.33,0.25),(0.27,0.55,0.80),(0.93,0.72,0.26),(0.38,0.70,0.45),
       (0.70,0.45,0.78),(0.90,0.55,0.30),(0.40,0.75,0.75),(0.80,0.45,0.55),
       (0.60,0.65,0.35),(0.50,0.55,0.85)]

def add_lights(centre, span):
    for i, (dx, dy, dz, e) in enumerate(((1.2,-1.4,1.6,1.0),(-1.5,-0.8,1.0,0.45),
                                         (0.2,1.6,0.9,0.35))):
        l = bpy.data.lights.new("l%d" % i, "AREA")
        l.energy = e * span * span * 2.2
        l.size = span * 0.9
        ob = bpy.data.objects.new("l%d" % i, l)
        bpy.context.collection.objects.link(ob)
        ob.location = centre + Vector((dx, dy, dz)) * span
        d = (centre - ob.location).normalized()
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

objs = []
for p in STLS:
    bpy.ops.wm.stl_import(filepath=p)
    o = bpy.context.view_layer.objects.active
    if o is None:
        continue
    o.name = os.path.splitext(os.path.basename(p))[0]
    o.data.materials.append(mk_mat(o.name, PAL[len(objs) % len(PAL)]))
    objs.append(o)

info = []

if MODE.startswith("plate"):
    W, H = (float(x) for x in MODE.split(":")[1].split("x"))
    sc.render.resolution_x = sc.render.resolution_y = 1500   # square bed, square frame
    # shelf-pack the parts by footprint, tallest shelf first, flat on the plate
    GAP = 3.0
    items = []
    for o in objs:
        lo, hi = K.bbox_world(o)
        items.append([o, hi.x - lo.x, hi.y - lo.y, lo])
    items.sort(key=lambda t: -t[2])          # by depth: shelves pack best that way

    plates = [[]]
    cx = cy = GAP
    rowh = 0.0
    oversize = []
    for it in items:
        o, w, d, lo = it
        if w > W - 2 * GAP or d > H - 2 * GAP:
            oversize.append(dict(part=o.name, footprint_mm=[round(w, 1), round(d, 1)]))
            continue
        if cx + w > W - GAP:                 # next shelf
            cx = GAP
            cy += rowh + GAP
            rowh = 0.0
        if cy + d > H - GAP:                 # next plate
            plates.append([])
            cx = cy = GAP
            rowh = 0.0
        o.location = (cx - lo.x, cy - lo.y, -lo.z)
        plates[-1].append(it)
        cx += w + GAP
        rowh = max(rowh, d)

    # show the fullest plate: it is the representative one
    best = max(range(len(plates)), key=lambda i: len(plates[i]))
    keep = set(id(t[0]) for t in plates[best])
    for o in objs:
        if id(o) not in keep:
            o.hide_render = True
    info.append(dict(plates=len(plates), plate_size=[W, H],
                     counts=[len(p) for p in plates],
                     rendered_plate=best + 1, oversize=oversize))
    bed = K.box("bed", (W, H, 1.0), (W / 2.0, H / 2.0, -0.5))
    info.append(dict(plates=len(plates), plate_size=[W, H],
                     counts=[len(p) for p in plates]))
    cam_t = "top"
    span = max(W, H)
    centre = Vector((W / 2.0, H / 2.0, 0))
elif MODE == "explode":
    for i, o in enumerate(objs):
        lo, hi = K.bbox_world(o)
        c = (lo + hi) / 2.0
        d = Vector((c.x, c.y, c.z)) - Vector((0, 0, 0))
        if d.length < 1e-6:
            d = Vector((0, 0, 1))
        o.location = d.normalized() * (d.length * 0.55 + 12.0)
    cam_t = "iso"
    allp = []
    for o in objs:
        lo, hi = K.bbox_world(o); allp += [lo, hi]
    mn = Vector((min(p.x for p in allp), min(p.y for p in allp), min(p.z for p in allp)))
    mx = Vector((max(p.x for p in allp), max(p.y for p in allp), max(p.z for p in allp)))
    centre = (mn + mx) / 2.0
    span = max(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z)
else:
    cam_t = MODE
    allp = []
    for o in objs:
        lo, hi = K.bbox_world(o); allp += [lo, hi]
    mn = Vector((min(p.x for p in allp), min(p.y for p in allp), min(p.z for p in allp)))
    mx = Vector((max(p.x for p in allp), max(p.y for p in allp), max(p.z for p in allp)))
    centre = (mn + mx) / 2.0
    span = max(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z)

cam_d = bpy.data.cameras.new("c")
cam = bpy.data.objects.new("c", cam_d)
bpy.context.collection.objects.link(cam)
sc.camera = cam
cam_d.type = "ORTHO"
# ortho_scale applies to the LARGER image dimension, so a square region framed in a
# 4:3 image loses the top and bottom unless the scale is widened to compensate.
_aspect = max(1.0, float(sc.render.resolution_x) / float(sc.render.resolution_y))
cam_d.ortho_scale = span * 1.10 * _aspect
if cam_t == "top":
    cam.location = centre + Vector((0, 0, span * 2.5))
    cam.rotation_euler = (0, 0, 0)
else:
    cam.location = centre + Vector((span * 1.6, -span * 1.9, span * 1.3))
    import mathutils
    d = (centre - cam.location).normalized()
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

add_lights(centre, span)
sc.render.filepath = OUTPNG
sc.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print("RENDER_JSON", json.dumps(info))
print("WROTE", OUTPNG)
