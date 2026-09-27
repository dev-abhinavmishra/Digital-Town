# gen_watertower.py — procedural "HAVENBROOK" water tower landmark.
# Runs headless:  blender -b -P gen_watertower.py -- out.glb
# Helpers take scene coords (x east, y up, z south); Blender Z-up remap inside.
import bpy, math, sys, os, mathutils

bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mslot(name, rgb, rough=.85, metal=0.0):
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

mslot('tank',  (0.72, 0.75, 0.78), .6, .15)   # silvery tank
mslot('steel', (0.55, 0.58, 0.60), .7, .2)    # legs + braces
mslot('roof',  (0.30, 0.34, 0.38), .7)        # cone roof
mslot('rust',  (0.45, 0.28, 0.16), .9)        # pipe + feet

def box(w, h, d, x, y, z, matn, ry=0.0, rx=0.0, rz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.active_object
    o.scale = (w / 2, d / 2, h / 2)
    o.rotation_euler = (rx, ry, rz)          # ry -> blender Z (vertical axis)
    o.data.materials.append(MATS[matn])
    return o

def cyl(r, h, x, y, z, matn, n=12, rx=0.0, rz=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h,
                                      location=(x, -z, y))
    o = bpy.context.active_object
    o.rotation_euler = (rx, 0, rz)
    o.data.materials.append(MATS[matn])
    return o

def cone(r1, r2, h, x, y, z, matn, n=16):
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r1, radius2=r2, depth=h,
                                  location=(x, -z, y))
    o = bpy.context.active_object
    o.data.materials.append(MATS[matn])
    return o

def beam(x0, y0, z0, x1, y1, z1, th, matn):
    """Box stretched between two scene points."""
    dx, dy, dz = x1 - x0, y1 - y0, z1 - z0
    L = math.sqrt(dx*dx + dy*dy + dz*dz)
    o = box(th, L, th, (x0+x1)/2, (y0+y1)/2, (z0+z1)/2, matn)
    # local +Z-length axis was authored as height; rotate to connect the points
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = mathutils.Vector((dx, -dz, dy)).to_track_quat('Z', 'Y')
    return o

R_T = 6.4          # tank radius
LEG_T = 14.0       # leg top / tank bottom
SPREAD = 5.2       # legs' ground spread
TANK_H = 7.0

# 4 legs, raked inward
for i in range(4):
    a = i / 4 * math.tau + math.pi / 4
    x0, z0 = math.cos(a) * SPREAD, math.sin(a) * SPREAD
    x1, z1 = math.cos(a) * (R_T * .62), math.sin(a) * (R_T * .62)
    beam(x0, 0, z0, x1, LEG_T, z1, .42, 'steel')
    cyl(.34, .8, x0, .2, z0, 'rust')            # foot pad
    # X-brace pairs between adjacent legs, two bands
for band in (0, 1):
    y0, y1 = 2.2 + band * 5.6, 7.8 + band * 5.6
    for i in range(4):
        a0 = i / 4 * math.tau + math.pi / 4
        a1 = (i + 1) / 4 * math.tau + math.pi / 4
        def lp(a, y):
            t = y / LEG_T
            r = SPREAD + (R_T * .62 - SPREAD) * t
            return math.cos(a) * r, math.sin(a) * r
        x0, z0 = lp(a0, y0); x1, z1 = lp(a1, y1)
        beam(x0, y0, z0, x1, y1, z1, .16, 'steel')
        x2, z2 = lp(a1, y0); x3, z3 = lp(a0, y1)
        beam(x2, y0, z2, x3, y1, z3, .16, 'steel')

# riser pipe down the middle
cyl(.5, LEG_T - 1, 0, (LEG_T - 1) / 2, 0, 'rust', 10)

# tank: bottom dish + wall + top + cone roof
cone(R_T * .62, R_T, 2.4, 0, LEG_T + 1.2, 0, 'tank')
cyl(R_T, TANK_H, 0, LEG_T + 2.4 + TANK_H / 2, 0, 'tank', 24)
cyl(R_T * .55, .5, 0, LEG_T + 2.4 + TANK_H - .2, 0, 'tank', 24)   # top ledge ring
cone(R_T * .85, .0, 3.4, 0, LEG_T + 2.4 + TANK_H + 1.7, 0, 'roof', 24)
cyl(.12, 2.2, 0, LEG_T + 2.4 + TANK_H + 3.4 + 1.1, 0, 'rust', 6)  # finial spire
# tank band rings
for ty in (LEG_T + 3.4, LEG_T + 5.9, LEG_T + 8.4):
    bpy.ops.mesh.primitive_torus_add(major_radius=R_T + .06, minor_radius=.09,
        major_segments=24, minor_segments=6, location=(0, 0, ty))
    bpy.context.active_object.data.materials.append(MATS['steel'])

# ladder up the south face
for i in range(4):
    beam(R_T + .15, 1.0 + i * 5.5, 0, R_T + .15, 6.4 + i * 5.5, 0, .12, 'steel')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.join()
bpy.context.active_object.location = (0, 0, 0)

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'watertower.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
                        export_yup=True, export_apply=True)
print('WROTE', out, os.path.getsize(out), 'bytes')
