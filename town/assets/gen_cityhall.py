# gen_cityhall.py — procedural "Havenbrook City Hall" landmark.
# Runs headless:  blender -b -P gen_cityhall.py -- out.glb
# One mesh per material slot after join; front faces -Z, +Y up.
import bpy, math, sys, os

bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mslot(name, rgb, rough=.9, metal=0.0):
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
    MATS[name] = m
    return m

mslot('stone',  (0.62, 0.60, 0.55))          # body limestone
mslot('trim',   (0.85, 0.83, 0.76))          # columns/entablature/steps
mslot('glass_lit', (0.15, 0.19, 0.24), .25)  # loader swaps to lit emissive
mslot('roof',   (0.38, 0.42, 0.45), .8)      # dome + roof
mslot('bronze', (0.35, 0.22, 0.10), .5, .4)  # doors + dome finial band

# helpers take scene coords (x = east, y = up, z = south); Blender is Z-up and
# the glTF exporter maps (bx, by, bz) -> (x, z, -y), so place at (x, -z, y).
def box(w, h, d, x, y, z, matn, ry=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.active_object
    o.scale = (w / 2, d / 2, h / 2)
    if ry: o.rotation_euler[2] = ry          # vertical-axis spin
    o.data.materials.append(MATS[matn])
    return o

def cyl(r, h, x, y, z, matn, n=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h, location=(x, -z, y))
    o = bpy.context.active_object
    o.data.materials.append(MATS[matn])
    return o

def sphere(r, x, y, z, matn, sy=1.0, n=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=n, ring_count=max(8, n // 2),
                                       radius=r, location=(x, -z, y))
    o = bpy.context.active_object
    o.scale.z = sy
    o.data.materials.append(MATS[matn])
    return o

def prism(w, h, d, x, y, z, matn):
    """Triangular pediment: apex at back-top, base facing -Z."""
    hw, hd = w / 2, d / 2
    v = [(-hw, 0, -hd), (hw, 0, -hd), (hw, 0, hd), (-hw, 0, hd),
         (0, h, -hd), (0, h, hd)]
    v = [(vx, -vz, vy) for vx, vy, vz in v]   # scene coords -> blender z-up
    f = [(0, 1, 4), (3, 5, 2), (0, 4, 5, 3), (1, 2, 5, 4), (0, 3, 2, 1)]
    me = bpy.data.meshes.new('pediment')
    me.from_pydata(v, [], f)
    o = bpy.data.objects.new('pediment', me)
    bpy.context.collection.objects.link(o)
    o.location = (x, -z, y)
    me.materials.append(MATS[matn])
    return o

W, D = 30.0, 24.0          # footprint
SY = 0.9                    # top of steps
BH = 10.5                   # main wall height above steps

# steps (three courses fanning out front)
for i, (w, h) in enumerate([(34, .3), (32, .3), (30, .3)]):
    box(w, h, 3.4, 0, h / 2 + i * .3, -D / 2 - 1.7 + .0, 'trim')
# main block + rear annex
box(W, BH, D, 0, SY + BH / 2, 0, 'stone')
box(10, 6.5, 8, 0, SY + 3.25, D / 2 + 4, 'stone')
# entablature band + cornice
box(W + 1.2, 1.1, D + 1.2, 0, SY + BH + .55, 0, 'trim')
box(W + .6, .35, D + .6, 0, SY + BH - .18, 0, 'trim')
# colonnade: 6 columns, front face
COLY = SY
for i in range(6):
    x = -10.5 + i * 4.2
    cyl(.62, 7.6, x, COLY + 3.8, -D / 2 - .9, 'trim', 14)
    box(1.6, .45, 1.6, x, COLY + 7.6 + .22, -D / 2 - .9, 'trim')   # capital
    box(1.7, .5, 1.7, x, COLY + .25, -D / 2 - .9, 'trim')          # base
# portico ceiling slab + pediment
box(24, .7, 3.4, 0, SY + 8.1, -D / 2 - .9, 'trim')
prism(24, 3.4, 3.0, 0, SY + 8.45, -D / 2 - .9, 'trim')
# recessed entry + doors behind columns
box(7.5, 5.6, .6, 0, SY + 2.8, -D / 2 - .2, 'stone')
for dx in (-1.6, 1.6):
    box(2.6, 4.4, .25, dx, SY + 2.2, -D / 2 - .55, 'bronze')
# windows: two tiers front (between columns) + sides
for tier, wy in enumerate([2.6, 6.4]):
    for i in range(6):
        x = -10.5 + i * 4.2
        box(1.7, 2.7, .2, x, SY + wy, -D / 2 - .05, 'glass_lit')
for side in (-1, 1):
    for i in range(4):
        z = -7.5 + i * 5.0
        for wy in (2.6, 6.4):
            box(.2, 2.7, 1.9, side * (W / 2 + .02), SY + wy, z, 'glass_lit')
# string course between tiers
box(W + .3, .4, .3, 0, SY + 4.9, -D / 2 - .12, 'trim')
# dome: drum + hemisphere + lantern + finial
DR = 4.6
cyl(DR + .7, 1.1, 0, SY + BH + 1.6, 0, 'trim', 20)           # drum base ring
cyl(DR, 2.6, 0, SY + BH + 2.4, 0, 'stone', 20)              # drum
for i in range(8):                                           # drum windows
    a = i / 8 * math.tau
    box(.7, 1.2, .15, math.cos(a) * (DR + .02), SY + BH + 2.4, math.sin(a) * (DR + .02), 'glass_lit', ry=-a)
sphere(DR * .92, 0, SY + BH + 3.7, 0, 'roof', sy=.68, n=20)  # dome
cyl(.85, 1.6, 0, SY + BH + 6.6, 0, 'trim', 10)               # lantern
sphere(.85, 0, SY + BH + 7.4, 0, 'roof', sy=.8, n=10)        # lantern cap
cyl(.09, 1.6, 0, SY + BH + 8.5, 0, 'bronze', 6)              # finial
sphere(.28, 0, SY + BH + 9.2, 0, 'bronze', n=8)
# corner pilasters
for sx in (-1, 1):
    for sz in (-1, 1):
        box(.9, BH - .2, .9, sx * (W / 2 - .45), SY + BH / 2, sz * (D / 2 - .45), 'trim')

# bake every transform into vertex data, then join (keeps world placement,
# leaves the merged object at the origin)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.join()
bpy.context.active_object.location = (0, 0, 0)

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'cityhall.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
                        export_yup=True, export_apply=True)
print('WROTE', out, os.path.getsize(out), 'bytes')
