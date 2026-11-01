import bpy, bmesh, json, sys, os
argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, OUT = argv[0], argv[1], argv[2]
man = json.load(open(MANIFEST, encoding="utf-8"))
meta = {o["object"]: o for o in man["objects"]}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
rows = {}
for ob in bpy.context.scene.objects:
    if ob.type != "MESH":
        continue
    base = ob.name.split(".")[0]
    if base in rows:
        continue
    d = ob.dimensions
    bm = bmesh.new(); bm.from_mesh(ob.data)
    openE = sum(1 for e in bm.edges if len(e.link_faces) < 2)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    vol = bm.calc_volume(signed=True)
    bm.free()
    rows[base] = dict(dim_units=[round(d.x,5),round(d.y,5),round(d.z,5)],
                      tris=tris, open_edges=openE, vol_units3=round(vol,8),
                      centre=[round(v,5) for v in ob.location],
                      verts=len(ob.data.vertices))
json.dump(rows, open(OUT,"w"), indent=1)
print("MEASURED", len(rows))
