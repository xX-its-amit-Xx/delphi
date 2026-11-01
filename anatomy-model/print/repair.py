"""Force a clean closed solid on named parts: voxel remesh is guaranteed manifold."""
import bpy, sys, os, json
sys.path.insert(0,"C:/Temp/stl/scripts")
import kitlib as K
argv=sys.argv[sys.argv.index("--")+1:]
DIR=argv[0]; VOX=float(argv[1]); names=argv[2:]
for n in names:
    p=os.path.join(DIR,n)
    K.wipe(); bpy.ops.wm.stl_import(filepath=p)
    ob=[o for o in bpy.context.scene.objects if o.type=="MESH"][0]
    before=K.check(ob)
    K.remesh(ob,VOX); K.recalc(ob); K.fix_orientation(ob)
    if os.environ.get("NOCLEAN")!="1": K.cleanup(ob)
    after=K.check(ob)
    K.export_stl(ob,p)
    print("REPAIR %-46s nm %d -> %d  watertight %s -> %s  tris %d -> %d" %
          (n, before["nonmanifold_edges"], after["nonmanifold_edges"],
           before["watertight"], after["watertight"],
           before["triangles"], after["triangles"]), flush=True)
