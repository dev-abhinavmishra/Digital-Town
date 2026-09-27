# gen_conservatory.py — Victorian palm house for Willow Creek Park.
# Runs headless:  blender -b -P gen_conservatory.py -- out.glb
# Same conventions as gen_cityhall.py: helpers take scene coords
# (x east, y up, z south) -> Blender (x, -z, y); front faces -Z.
import bpy, math, sys, os

bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mslot(name, rgb, rough=.9, metal=0.0, alpha=1.0):
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
        bsdf.inputs['Alpha'].default_value = alpha
        if alpha < 1:
            m.blend_method = 'BLEND'
    MATS[name] = m
    return m

mslot('stone',  (0.58, 0.56, 0.50))                  # plinth + sill course
mslot('frame',  (0.16, 0.24, 0.20), .6)              # painted iron mullions
mslot('glass',  (0.66, 0.78, 0.76), .1, 0.0, .62)   # glazing, translucent
mslot('ridge',  (0.13, 0.19, 0.16), .55)             # ridge caps / finial
mslot('green',  (0.20, 0.38, 0.16), .9)              # interior foliage
mslot('trunk',  (0.36, 0.26, 0.16), .9)              # palm trunks
mslot('glass_lit', (0.15, 0.19, 0.24), .25)          # door fanlights (lit)

def box(w, h, d, x, y, z, matn, ry=0.0, rx=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.active_object
    o.scale = (w / 2, d / 2, h / 2)
    if ry: o.rotation_euler[2] = ry          # vertical-axis spin
    if rx: o.rotation_euler[0] = rx          # tilt about scene-x axis
    o.data.materials.append(MATS[matn])
    return o

def cyl(r, h, x, y, z, matn, n=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h,
                                       location=(x, -z, y))
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
    """Gable triangle: apex up, base facing -Z/+Z strip of depth d."""
    hw, hd = w / 2, d / 2
    v = [(-hw, 0, -hd), (hw, 0, -hd), (hw, 0, hd), (-hw, 0, hd),
         (0, h, -hd), (0, h, hd)]
    v = [(vx, -vz, vy) for vx, vy, vz in v]
    f = [(0, 1, 4), (3, 5, 2), (0, 4, 5, 3), (1, 2, 5, 4), (0, 3, 2, 1)]
    me = bpy.data.meshes.new('gable')
    me.from_pydata(v, [], f)
    o = bpy.data.objects.new('gable', me)
    bpy.context.collection.objects.link(o)
    o.location = (x, -z, y)
    me.materials.append(MATS[matn])
    return o

W, D, PL = 26.0, 15.0, 0.7      # footprint, plinth height
WH = 4.6                       # top of glazed wall band
RID = WH + D * .5 * math.tan(math.radians(32))   # roof ridge height ~9.1

# plinth + entry steps
box(W + 1.4, PL, D + 1.4, 0, PL / 2, 0, 'stone')
box(6, .28, 2.2, 0, PL + .14, -D / 2 - 1.2, 'stone')
# stone sill course around the glazed band
box(W + .2, 1.0, D + .2, 0, PL + .5, 0, 'stone')

# glazed wall band (two long sides + two gable ends, mullioned)
box(W, WH - 1.0, .16, 0, PL + 1.0 + (WH - 1.0) / 2, -D / 2, 'glass')
box(W, WH - 1.0, .16, 0, PL + 1.0 + (WH - 1.0) / 2,  D / 2, 'glass')
box(.16, WH - 1.0, D, -W / 2, PL + 1.0 + (WH - 1.0) / 2, 0, 'glass')
box(.16, WH - 1.0, D,  W / 2, PL + 1.0 + (WH - 1.0) / 2, 0, 'glass')
# wall mullions: posts every ~2.6 on long sides, ~2.5 on ends
for i in range(11):
    x = -W / 2 + i * (W / 10)
    for zs in (-1, 1):
        box(.14, WH - .9, .2, x, PL + 1.0 + (WH - 1.0) / 2, zs * D / 2, 'frame')
for i in range(7):
    z = -D / 2 + i * (D / 6)
    for xs in (-1, 1):
        box(.2, WH - .9, .14, xs * W / 2, PL + 1.0 + (WH - 1.0) / 2, z, 'frame')
# corner posts + wall top plate
for xs in (-1, 1):
    for zs in (-1, 1):
        box(.34, WH, .34, xs * W / 2, PL + WH / 2, zs * D / 2, 'frame')
box(W + .3, .3, .5, 0, PL + WH + .1, -D / 2, 'frame')
box(W + .3, .3, .5, 0, PL + WH + .1,  D / 2, 'frame')

# glazed gable roof: two sloped planes + gable glass ends + ridge
SLOP = math.radians(32)
PLEN = (D / 2 + .6) / math.cos(SLOP)
RY = PL + WH + PLEN * .5 * math.sin(SLOP)
for zs in (-1, 1):
    box(W + .8, .14, PLEN, 0, RY, zs * (D / 4 + .15), 'glass',
        rx=zs * -SLOP)
    # rafters over the glazing
    for i in range(11):
        x = -W / 2 + i * (W / 10)
        box(.13, .2, PLEN, x, RY + .06, zs * (D / 4 + .15), 'frame',
            rx=zs * -SLOP)
box(W + .9, .3, .5, 0, PL + WH + (D / 2) * math.tan(SLOP) + .18, 0, 'ridge')
for xs in (-1, 1):                               # glazed gable ends (width spans z)
    gb = prism(D, (D / 2) * math.tan(SLOP), .3,
               xs * (W / 2 + .05), PL + WH + .02, 0, 'glass')
    gb.rotation_euler[2] = math.pi / 2

# clerestory: raised center monitor + its own little gable + dome
CW, CD, CH = 10.0, 6.0, 2.6
box(CW, CH, .14, 0, RID + CH / 2 - .4, -CD / 2, 'glass')
box(CW, CH, .14, 0, RID + CH / 2 - .4,  CD / 2, 'glass')
box(.14, CH, CD, -CW / 2, RID + CH / 2 - .4, 0, 'glass')
box(.14, CH, CD,  CW / 2, RID + CH / 2 - .4, 0, 'glass')
for i in range(5):
    x = -CW / 2 + i * (CW / 4)
    for zs in (-1, 1):
        box(.12, CH, .18, x, RID + CH / 2 - .4, zs * CD / 2, 'frame')
CPL = (CD / 2 + .3) / math.cos(SLOP)
for zs in (-1, 1):
    box(CW + .6, .12, CPL, 0, RID + CH - .4 + CPL * .5 * math.sin(SLOP),
        zs * (CD / 4 + .1), 'glass', rx=zs * -SLOP)
box(CW + .7, .24, .4, 0, RID + CH - .4 + (CD / 2) * math.tan(SLOP) + .1, 0,
    'ridge')
sphere(2.5, 0, RID + CH + 1.3, 0, 'glass', sy=.62)          # dome cupola
cyl(.16, 2.6, 0, RID + CH + 1.6, 0, 'ridge', 8)             # cupola mast
sphere(.4, 0, RID + CH + 2.9, 0, 'ridge')                   # finial ball

# double door + fanlight, front center
box(2.8, 3.4, .2, -1.5, PL + 1.7, -D / 2 - .12, 'ridge')
box(2.8, 3.4, .2,  1.5, PL + 1.7, -D / 2 - .12, 'ridge')
sphere(1.4, 0, PL + 3.6, -D / 2 - .1, 'glass_lit', sy=.8)   # fanlight

# interior planting silhouettes (seen through the glass)
for (px, pz, pr) in [(-7.5, -2, 2.4), (-3, 3, 1.8), (4.5, -3, 2.6),
                     (8.5, 2.5, 1.6), (0, 0, 3.0)]:
    cyl(.22, pr * 1.1, px, PL + pr * .55, pz, 'trunk', 8)
    sphere(pr, px, PL + pr * 1.1 + pr * .8, pz, 'green', sy=.8, n=12)

# bake transforms then join (one mesh per material slot)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
bpy.context.active_object.location = (0, 0, 0)

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/conservatory.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
                          export_yup=True, export_apply=False)
print('WROTE', out, os.path.getsize(out))
