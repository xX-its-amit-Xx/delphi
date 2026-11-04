"""The Blender driver for the scale theatre's ILLUSTRATION meshes.

    blender -b --factory-startup --python sim-engine/scales/mesh/build_mesh.py -- <spec.json> <out.glb>

Reads a mesh spec (sim-engine/scales/mesh/spec.mjs), runs frames/<frame>.py's build(spec, lib, stage_key)
once per stage inside a root empty named 'stage:<key>', exports ONE GLB (glTF Y-up, modifiers applied,
vertex colours, PBR + KHR material extensions) and writes the manifest beside it (<out>.json).

Then it rewrites the GLB's JSON chunk: Blender object names must be unique, so a slot that exists in four
stages is four objects; each carries its contract name in a custom property and the node is renamed to it
here. Every note a sculptor left on a piece, under whichever key it used (NOTE_KEYS), is folded into
extras.illustration_note and the manifest's node record, so the page can show it on the clicked piece's card.
Scene extras get frame, spec hash, generator version, stages and THIS_IS_NOT_MORPHOMETRY. The result
is checked against the contract before the script exits 0: a GLB the page cannot use is never left behind.
"""
import bpy
import importlib.util
import json
import os
import re
import struct
import sys
import time

sys.dont_write_bytecode = True     # never leave __pycache__ in the source tree
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib  # noqa: E402

PER_STAGE_BUDGET = 150000
GLB_BUDGET = 4 * 1024 * 1024


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(a) < 2:
        raise SystemExit('usage: blender -b --factory-startup --python build_mesh.py -- <spec.json> <out.glb>')
    return a[0], a[1]


def load_sculptor(frame):
    path = os.path.join(HERE, 'frames', '%s.py' % frame)
    if not os.path.exists(path):
        raise SystemExit('no sculptor for frame %r at %s' % (frame, path))
    sp = importlib.util.spec_from_file_location('frame_%s' % frame, path)
    mod = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(mod)
    return mod


def read_glb(path):
    with open(path, 'rb') as fh:
        data = fh.read()
    magic, ver, length = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF', 'not a GLB'
    off, chunks = 12, []
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        chunks.append((ctype, data[off + 8: off + 8 + clen]))
        off += 8 + clen
    js = json.loads(chunks[0][1].decode('utf-8'))
    binc = chunks[1][1] if len(chunks) > 1 else b''
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    binc += b'\x00' * ((4 - len(binc) % 4) % 4)
    total = 12 + 8 + len(jb) + (8 + len(binc) if binc else 0)
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<4sII', b'glTF', 2, total))
        fh.write(struct.pack('<II', len(jb), 0x4E4F534A))
        fh.write(jb)
        if binc:
            fh.write(struct.pack('<II', len(binc), 0x004E4942))
            fh.write(binc)


# ILLUSTRATION NOTES. Sculptors write down, per piece, the drawing choices a viewer could mistake for data ("bristle
# counts are illustrative", "a confined random walk, not a sequence", "beat shapes frozen at phases of a wave"). They
# used different custom-property keys for it; every one of them is folded, in this order, into ONE key the page
# reads, extras.illustration_note, and into the manifest's node record. The original keys stay as written.
NOTE_KEYS = ('illustration_note', 'note', 'schematic', 'shape_basis', 'beat', 'cells_drawn')


def illustration_note(get):
    """The merged note from a getter over custom properties / extras, and the keys it came from."""
    out, keys, seen = [], [], set()
    for k in NOTE_KEYS:
        v = get(k)
        if not isinstance(v, str) or not v.strip():
            continue
        t = v.strip()
        if t in seen:
            continue
        seen.add(t)
        out.append(t if t[-1] in '.!?)' else t + '.')
        keys.append(k)
    return (' '.join(out) if out else None), keys


NODE_RE = re.compile(r'^(slot:[a-z_]+(:(left|right|single)(:\d+)?)?|deco:[a-z_]+(:[A-Za-z0-9_\-]+)+|stage:[a-z_]+)$')


def main():
    t0 = time.time()
    spec_path, out_glb = args()
    with open(spec_path, encoding='utf-8') as fh:
        spec = json.load(fh)
    frame = spec['frame']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sculptor = load_sculptor(frame)
    lib.begin_frame(frame, spec)
    stages = []
    for st in spec['stages']:
        key = st['key']
        lib.begin_stage(key)
        sculptor.build(spec, lib, key)
        root_note, root_keys = illustration_note(lib._S['root'].get)
        made = lib.end_stage()
        tris = sum(n for _, n in made)
        stages.append({'key': key, 'label': st.get('label'), 'triangles': tris,
                       'nodes': sum(1 for o, _ in made if str(o.get('node', '')).startswith('slot:')),
                       'bbox': lib.page_bbox([o for o, _ in made]), 'within_budget': tris <= PER_STAGE_BUDGET})
        if root_note:
            stages[-1]['illustration_note'] = root_note

    sc = bpy.context.scene
    extras = {'frame': frame, 'spec_hash': spec.get('hash'), 'generator_version': spec.get('generator_version'),
              'stages': [s['key'] for s in spec['stages']], 'geometry_basis': lib.GEOMETRY_BASIS,
              'THIS_IS_NOT_MORPHOMETRY': spec.get('THIS_IS_NOT_MORPHOMETRY')}
    for k, v in extras.items():
        sc[k] = json.dumps(v) if isinstance(v, list) else (v if v is not None else '')

    os.makedirs(os.path.dirname(os.path.abspath(out_glb)), exist_ok=True)
    kw = dict(filepath=out_glb, export_format='GLB', export_yup=True, export_apply=True, export_extras=True,
              export_materials='EXPORT', export_cameras=False, export_lights=False, export_texcoords=False,
              export_normals=True, export_animations=False, export_draco_mesh_compression_enable=True,
              export_draco_mesh_compression_level=7, export_draco_position_quantization=14,
              export_draco_normal_quantization=10, export_draco_color_quantization=8,
              export_image_format='AUTO')   # NOT 'NONE': in Blender 4.2 that also drops vertex colours
    try:
        bpy.ops.export_scene.gltf(export_vertex_color='MATERIAL', export_all_vertex_colors=False, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(export_colors=True, **kw)

    # Contract names, scene extras, and the check.
    js, binc = read_glb(out_glb)
    problems = []
    for n in js.get('nodes', []):
        ex = n.get('extras') or {}
        if 'node' in ex:
            n['name'] = ex['node']
            if 'mesh' in n:
                js['meshes'][n['mesh']]['name'] = ex['node']
        if 'drivers_used' in ex and isinstance(ex['drivers_used'], str):
            ex['drivers_used'] = json.loads(ex['drivers_used'])
        note, keys = illustration_note(ex.get)
        if note:
            ex['illustration_note'] = note
            ex['illustration_note_from'] = keys
        if not NODE_RE.match(n.get('name', '')):
            problems.append('node %r does not follow the slot:/deco:/stage: naming' % n.get('name'))
    scene = js['scenes'][js.get('scene', 0)]
    scene['extras'] = extras
    js.setdefault('asset', {})['extras'] = {'geometry_basis': lib.GEOMETRY_BASIS, 'THIS_IS_NOT_MORPHOMETRY': extras['THIS_IS_NOT_MORPHOMETRY']}
    roots = {js['nodes'][i].get('name') for i in scene.get('nodes', [])}
    for st in spec['stages']:
        if 'stage:%s' % st['key'] not in roots:
            problems.append('no root node stage:%s' % st['key'])
    write_glb(out_glb, js, binc)
    size = os.path.getsize(out_glb)
    if size > GLB_BUDGET:
        problems.append('GLB is %d bytes, over the %d budget' % (size, GLB_BUDGET))
    for s in stages:
        if not s['within_budget']:
            problems.append('stage %s has %d triangles, over %d' % (s['key'], s['triangles'], PER_STAGE_BUDGET))

    nodes = []
    for ob, tris in lib._S['nodes']:
        node = ob.get('node')
        if not node:
            continue
        rec = {'name': node, 'slot': ob.get('slot'), 'side': ob.get('side'), 'stage': ob.get('stage'),
               'role': ob.get('role'), 'geometry_basis': ob.get('geometry_basis'), 'triangles': tris,
               'drivers_used': json.loads(ob['drivers_used']) if 'drivers_used' in ob else {},
               'proportions': 'declared' if 'drivers_used' in ob else 'schematic'}
        if ob.parent is not None and ob.parent.get('node', '').startswith('slot:'):
            rec['parent'] = ob.parent['node']
        note, keys = illustration_note(ob.get)
        if note:
            rec['illustration_note'] = note
            rec['illustration_note_from'] = keys
        nodes.append(rec)
    manifest = {
        'what': 'The illustration mesh for the %s frame, one GLB with one root per life-stage form. Built by '
                'sim-engine/scales/mesh/build_mesh.py from frames/%s.py.' % (frame, frame),
        'geometry_basis': lib.GEOMETRY_BASIS,
        'THIS_IS_NOT_MORPHOMETRY': extras['THIS_IS_NOT_MORPHOMETRY'],
        'frame': frame, 'spec_hash': spec.get('hash'), 'generator_version': spec.get('generator_version'),
        'blender': bpy.app.version_string, 'built': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'seconds': round(time.time() - t0, 1),
        'glb': '%s-%s.glb' % (frame, spec.get('hash')),
        'glb_bytes': size,
        'axes': 'glTF Y-up, matching body-frames.json as the theatre draws it (world = pos * 2): +X anterior, +Y dorsal, '
                '+Z the organism\'s RIGHT, -Z its left. Stage size differences are NOT baked in; the page applies the '
                'declared length_ratio.',
        'stages': stages,
        'spec': {'stages': spec['stages'], 'drivers': spec.get('drivers', {}), 'driver_notes': spec.get('driver_notes', [])},
        'drivers': {k: dict(v, basis='declared') for k, v in (spec.get('drivers') or {}).items()},
        'proportions': 'schematic, except where a node lists drivers_used (basis declared, with its source)',
        'nodes': nodes,
        'totals': {'triangles': sum(s['triangles'] for s in stages), 'nodes': len(nodes),
                   'slot_nodes': sum(1 for n in nodes if n['name'].startswith('slot:')),
                   'max_stage_triangles': max([s['triangles'] for s in stages] or [0])},
        'budget': {'per_stage_triangles': PER_STAGE_BUDGET, 'glb_bytes': GLB_BUDGET, 'ok': not problems},
        'problems': problems,
    }
    with open(re.sub(r'\.glb$', '.json', out_glb), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=1)
    print('mesh %s: %d stage(s), %d nodes, %d triangles, %d bytes, %.1f s' % (
        frame, len(stages), len(nodes), manifest['totals']['triangles'], size, time.time() - t0))
    if problems:
        for p in problems:
            print('PROBLEM: ' + p)
        os.remove(out_glb)
        raise SystemExit(4)


try:
    main()
except SystemExit:
    raise
except Exception:
    import traceback
    traceback.print_exc()
    sys.stdout.flush()
    sys.exit(3)
