# Renders the "Edits that stay valid Markdown" image: a page split into four slabs, one lifted.
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P blocks.py -- dark|light out.png
import bpy, math, sys
from mathutils import Vector

mode, out = sys.argv[sys.argv.index("--") + 1:][:2]
DARK = mode == "dark"
LINE = (0.91, 0.89, 0.85) if DARK else (0.14, 0.13, 0.11)
FACE = (0.105, 0.11, 0.135) if DARK else (0.985, 0.98, 0.968)
BAR = (0.55, 0.55, 0.53) if DARK else (0.55, 0.53, 0.5)
BRASS = (0.886, 0.714, 0.361) if DARK else (0.56, 0.38, 0.1)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def lin(c):  # sRGB -> linear
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c)

def mat(name, color, emit=False, strength=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out_n = nt.nodes.new("ShaderNodeOutputMaterial")
    if emit:
        n = nt.nodes.new("ShaderNodeEmission"); n.inputs["Color"].default_value = (*lin(color), 1); n.inputs["Strength"].default_value = strength
    else:
        n = nt.nodes.new("ShaderNodeBsdfDiffuse"); n.inputs["Color"].default_value = (*lin(color), 1)
    nt.links.new(n.outputs[0], out_n.inputs[0])
    return m

M_FACE, M_BAR, M_BRASS = mat("face", FACE), mat("bar", BAR, True), mat("brass", BRASS, True)

def coll(name):
    c = bpy.data.collections.new(name); sc.collection.children.link(c); return c
C_SLAB, C_BARS, C_LIFT = coll("slabs"), coll("bars"), coll("lifted")

T = 0.9
def box(c, x0, y0, x1, y1, z0, z1, material, bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.object; o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new("b", "BEVEL"); b.width = bevel; b.segments = 2; b.limit_method = "ANGLE"
    o.data.materials.append(material)
    for u in o.users_collection: u.objects.unlink(o)
    c.objects.link(o); return o

def plane(c, x0, y0, x1, y1, z, material):
    return box(c, x0, y0, x1, y1, z, z + 0.01, material, 0)

def rod(c, p, q, w, z, material):  # a flat bar from p to q on the page
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy)
    o = plane(c, -L / 2, -w / 2, L / 2, w / 2, z, material)
    o.rotation_euler[2] = math.atan2(dy, dx); o.location = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0)
    return o

X0, X1 = -9, 9
def slab(c, y0, y1, lift=0):
    return box(c, X0, y0, X1, y1, lift, lift + T, M_FACE)

def txt(c, x0, x1, y, w=0.45, lift=0, m=None):
    return plane(c, X0 + x0, y - w / 2, X0 + x1, y + w / 2, T + lift + 0.005, m or M_BAR)

# Layout runs along y, back (top-left of the image) to front.
LIFT = 2.6
# heading
slab(C_SLAB, -10.5, -7.5); txt(C_BARS, 1.2, 10.5, -9, 0.9)
# to-do (lifted)
y0, y1 = -6.7, -2.7
slab(C_LIFT, y0, y1, LIFT)
ym = (y0 + y1) / 2
for (a, b, c_, d) in [(1.2, ym - .9, 3.0, ym - .9), (1.2, ym + .9, 3.0, ym + .9)]:
    txt(C_LIFT, a, c_, b, .16, LIFT, M_BRASS)
for xx in (1.2, 3.0):
    plane(C_LIFT, X0 + xx - .08, ym - .9, X0 + xx + .08, ym + .9, T + LIFT + .005, M_BRASS)
rod(C_LIFT, (X0 + 1.5, ym + .05), (X0 + 2.0, ym + .6), .3, T + LIFT + .01, M_BRASS)
rod(C_LIFT, (X0 + 2.0, ym + .6), (X0 + 2.85, ym - .55), .3, T + LIFT + .01, M_BRASS)
txt(C_BARS, 4.3, 13.5, ym, .5, LIFT)
for o in list(C_BARS.objects)[-1:]: o.location.z += 0  # (bar rides with the lifted slab via LIFT)
# table
ty0, ty1 = -1.9, 4.1
slab(C_SLAB, ty0, ty1)
gx0, gx1, gy0, gy1 = X0 + 1, X0 + 17, ty0 + .8, ty1 - .8
for y in (gy0, (gy0 + gy1) / 2, gy1): plane(C_BARS, gx0, y - .06, gx1, y + .06, T + .006, M_BAR)
for x in (gx0, gx0 + 5.33, gx0 + 10.67, gx1): plane(C_BARS, x - .06, gy0, x + .06, gy1, T + .006, M_BAR)
for (a, b, yy) in [(1.8, 4.6, 0), (7.1, 10.2, 0), (12.4, 15.5, 0)]:
    txt(C_BARS, a, b, gy0 + (gy1 - gy0) * .25, .3); txt(C_BARS, a, b - .6, gy0 + (gy1 - gy0) * .75, .3)
# code
slab(C_SLAB, 4.9, 10.5)
for (a, b, y) in [(1.6, 9, 6.1), (3.2, 12.4, 7.5), (3.2, 8, 8.9)]: txt(C_BARS, a, b, y, .45)

# camera: true isometric, orthographic
cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = 31
co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
co.location = (22, -22, 22 + 0); co.rotation_euler = (math.radians(54.736), 0, math.radians(45))
cam.shift_y = 0.02

# soft light
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 2.2
so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9

r = sc.render
r.engine = "BLENDER_EEVEE"; r.resolution_x, r.resolution_y = 1800, 1200
r.film_transparent = True; r.image_settings.file_format = "PNG"; r.image_settings.color_mode = "RGBA"
r.filepath = out
sc.view_settings.view_transform = "Standard"
# lines
r.use_freestyle = True; r.line_thickness_mode = "ABSOLUTE"
vl = bpy.context.view_layer; vl.use_freestyle = True
fs = vl.freestyle_settings; fs.crease_angle = math.radians(120)
def lineset(name, c, color, thick, alpha=1.0):
    ls = fs.linesets.new(name); ls.select_by_collection = True; ls.collection = c
    ls.select_silhouette = ls.select_border = ls.select_crease = True
    st = bpy.data.linestyles.new(name); st.color = color; st.thickness = thick; st.alpha = alpha
    ls.linestyle = st
lineset("slabs", C_SLAB, lin(LINE), 3.2)
lineset("lifted", C_LIFT, lin(BRASS), 3.6)
bpy.ops.render.render(write_still=True)
