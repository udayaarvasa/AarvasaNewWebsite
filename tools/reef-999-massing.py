"""REEF 999 — developer-render-based exterior reconstruction, review v1.

Sources: reefdevelopments.ae/projects/reef-999 and the developer's 999_Cover.jpg
and reef-999.jpg (saved in research/sources/reef-999).
Observed: offset paired residential wings, stepped crowns, blue glazing,
projecting scalloped balcony plates, double/triple-height winter-garden bays,
roof pergola ribs and a horizontal-louvred retail podium with a rising entry.
Estimated: 12/10 residential levels counted from perspective imagery; footprint
and 3.3 m storeys, garden spacing and unseen rear elevations. These are visual
approximations, not developer-confirmed dimensions or an official CAD model.
Uses the same indexed, material-separated, 1:10 GLB approach as REEF 998.
"""
import math
import sys
from massing_glb import Mesh, export, rounded_rect

MATERIALS = {
    "limestone": ((0.89, 0.83, 0.70, 1), 0.02, 0.62),
    "slab": ((0.94, 0.90, 0.81, 1), 0.02, 0.47),
    "glazing": ((0.24, 0.36, 0.43, 1), 0.42, 0.18),
    "rail": ((0.62, 0.77, 0.82, 0.40), 0.15, 0.11),
    "mullion": ((0.14, 0.19, 0.21, 1), 0.48, 0.32),
    "bronze": ((0.58, 0.48, 0.32, 1), 0.52, 0.32),
    "warm-edge": ((0.98, 0.82, 0.49, 1), 0.12, 0.30),
    "deck": ((0.57, 0.53, 0.46, 1), 0.0, 0.75),
    "foliage": ((0.20, 0.36, 0.22, 1), 0.0, 0.88),
    "trunk": ((0.38, 0.29, 0.19, 1), 0.0, 0.9),
    "water": ((0.12, 0.57, 0.61, 1), 0.23, 0.12),
}
PODIUM_H, FLOOR_H = 7.2, 3.3

def ring(mesh, material, path, y, height, thickness):
    cx, cz = sum(p[0] for p in path)/len(path), sum(p[1] for p in path)/len(path)
    inside=[]
    for x,z in path:
        length=math.hypot(x-cx,z-cz)
        inside.append((x-(x-cx)/length*thickness,z-(z-cz)/length*thickness))
    for i,(x,z) in enumerate(path):
        j=(i+1)%len(path); xx,zz=path[j]; ix,iz=inside[i]; jx,jz=inside[j]
        mesh.quad(material,(x,y,z),(xx,y,zz),(xx,y+height,zz),(x,y+height,z))
        mesh.quad(material,(ix,y,iz),(ix,y+height,iz),(jx,y+height,jz),(jx,y,jz))
        mesh.quad(material,(x,y+height,z),(xx,y+height,zz),(jx,y+height,jz),(ix,y+height,iz))

def balcony_path(x0,z0,x1,z1):
    outline=rounded_rect(x0,z0,x1,z1,1.15,8)
    path=[]
    for i,(x,z) in enumerate(outline):
        xx,zz=outline[(i+1)%len(outline)]
        steps=max(1,math.ceil(math.hypot(xx-x,zz-z)/0.7))
        path.extend((x+(xx-x)*k/steps,z+(zz-z)*k/steps) for k in range(steps))
    # A shallow plan wave, with depth modulated at individual balcony bays.
    return [(x,z+0.43*math.cos((x-x0)*2*math.pi/7.4) if z>(z0+z1)/2 else z-0.25*math.cos((x-x0)*2*math.pi/7.4)) for x,z in path]

def palm(mesh,x,y,z,h=3.2):
    mesh.box("trunk",x,y,z,0.20,h,0.20)
    for i in range(8):
        a=i*math.pi/4
        dx,dz=math.cos(a),math.sin(a); sx,sz=-dz*0.22,dx*0.22
        p=(x,y+h,z); tip=(x+dx*2.0,y+h-0.4,z+dz*2.0)
        mid=(x+dx*0.8,y+h+0.3,z+dz*0.8)
        mesh.tri("foliage",p,(mid[0]+sx,mid[1],mid[2]+sz),tip)
        mesh.tri("foliage",p,tip,(mid[0]-sx,mid[1],mid[2]-sz))

def wing(mesh,cx,cz,width,depth,levels):
    x0,x1=cx-width/2,cx+width/2
    z0,z1=cz-depth/2,cz+depth/2
    for f in range(levels):
        y=PODIUM_H+f*FLOOR_H
        garden=f%4 in (1,2)
        # Recess the centre of the front facade to leave the tall garden bay open.
        if garden:
            mesh.box("glazing",cx,y,cz-2.0,width,FLOOR_H-0.26,depth-4)
            for side in (-1,1):
                mesh.box("glazing",cx+side*(width/2-2.1),y,z1-1.9,4.2,FLOOR_H-0.26,3.8)
        else:
            mesh.box("glazing",cx,y,cz,width,FLOOR_H-0.26,depth)
        path=balcony_path(x0-1.9,z0-1.6,x1+1.9,z1+2.1)
        if not garden:
            mesh.prism("slab",path,y,0.24)
            ring(mesh,"rail",path,y+0.28,0.92,0.045)
            ring(mesh,"warm-edge",path,y-0.065,0.065,0.17)
        else:
            # Side terraces continue past the full-height garden openings.
            for side in (-1,1):
                bx=cx+side*(width/2-1.5)
                terrace=balcony_path(bx-3.1,z0-1.6,bx+3.1,z1+2.1)
                mesh.prism("slab",terrace,y,0.24)
                ring(mesh,"rail",terrace,y+0.28,0.92,0.045)
                ring(mesh,"warm-edge",terrace,y-0.065,0.065,0.17)
        for k in range(1,9):
            x=x0+k*width/9
            # Front mullions follow the recessed glazing instead of filling its void.
            front=z1-4 if garden and abs(x-cx)<width/2-4.2 else z1
            mesh.box("mullion",x,y,front+0.025,0.085,FLOOR_H-0.24,0.09)
            mesh.box("mullion",x,y,z0-0.025,0.085,FLOOR_H-0.24,0.09)
        for side in (-1,1):
            for k in range(1,6):
                mesh.box("mullion",cx+side*width/2,y,z0+k*depth/6,0.09,FLOOR_H-0.24,0.085)
        if f%4==1:
            mesh.box("deck",cx,y,z1-0.3,width-8.3,0.18,4.5)
            ring(mesh,"rail",rounded_rect(cx-width/2+4.2,z1-2.5,cx+width/2-4.2,z1+1.9,0.3,4),y+0.2,1.0,0.05)
            for px in (cx-2.7,cx+2.7):
                mesh.box("limestone",px,y,z1-0.5,1.5,0.6,1.1)
                mesh.box("foliage",px,y+0.6,z1-0.5,1.35,0.7,0.95)
        # Cream uprights frame the winter gardens over several storeys.
        for px in (cx-width/2+4.0,cx+width/2-4.0):
            mesh.box("limestone",px,y,z1+0.5,0.45,FLOOR_H,0.65)
    top=PODIUM_H+levels*FLOOR_H
    mesh.prism("slab",rounded_rect(x0-1,z0-1,x1+1,z1+1,1,8),top,0.35)
    # Curved rectangular rooftop pergola ribs, simplified to upright and cap beams.
    for i in range(9):
        x=x0+1.0+i*(width-2)/8
        for z in (z0+0.7,z1-0.7):mesh.box("bronze",x,top,z,0.15,2.7,0.16)
        mesh.box("bronze",x,top+2.6,cz,0.15,0.15,depth-1.4)
    for px in (x0+3,x1-3):
        mesh.box("limestone",px,top,z0+2,2.7,0.5,1.7)
        mesh.box("foliage",px,top+0.5,z0+2,2.5,0.7,1.5)

def build():
    mesh=Mesh()
    podium=rounded_rect(-39,-25,39,26,4.0,12)
    mesh.prism("glazing",podium,0,PODIUM_H-0.5)
    mesh.prism("slab",podium,PODIUM_H-0.5,0.5)
    mesh.prism("deck",rounded_rect(-38,-24,38,25,3.5,10),PODIUM_H,0.06)
    for i in range(13):ring(mesh,"bronze",podium,3.5+i*0.26,0.09,0.20)
    for x in range(-36,37,3):mesh.box("mullion",x,0,25.85,0.10,3.3,0.15)
    # Rising entrance canopy, a defining feature of the official front render.
    for i in range(40):
        x0=-9+i*18/40; x1=x0+18/40
        lift=lambda x: 1.6+3.4*math.exp(-(x/4.6)**2)
        y0,y1=lift(x0),lift(x1)
        mesh.quad("slab",(x0,y0,28),(x1,y1,28),(x1,y1+0.55,25),(x0,y0+0.55,25))
        mesh.quad("limestone",(x0,y0,28),(x0,y0+0.55,28),(x1,y1+0.55,28),(x1,y1,28))
    # The blocks are offset in plan and height, rather than identical generic towers.
    wing(mesh,-19,3,23,23,12)
    wing(mesh,18,-3,22,23,10)
    # Recessed link behind the two wings.
    for f in range(9):
        y=PODIUM_H+f*FLOOR_H
        mesh.box("glazing",0,y,-7,15,FLOOR_H-0.25,15)
        p=balcony_path(-7.5,-15,7.5,2.0)
        mesh.prism("slab",p,y,0.24);ring(mesh,"rail",p,y+0.28,0.92,0.045)
    # Podium garden / water strip: visible amenities, placement approximated.
    mesh.prism("water",rounded_rect(-31,-22,25,-17,1.2,8),PODIUM_H+0.07,0.08)
    for x,z in ((-34,19),(-26,21),(-10,21),(10,21),(30,19),(33,-20),(-33,-18)):
        mesh.box("limestone",x,PODIUM_H,z,2.6,0.6,2.4)
        palm(mesh,x,PODIUM_H+0.6,z)
    return mesh

if __name__=="__main__":
    path=sys.argv[1] if len(sys.argv)>1 else "reef-999-massing.glb"
    mesh=build()
    size=export(mesh,path,materials=MATERIALS,scale=0.1,generator="aarvasa-reef-999-reference-review 1.0.0",scene_name="REEF 999",copyright_text="Aarvasa reference-based exterior reconstruction. LOCAL REVIEW. Estimated dimensions and unseen elevations; not an official developer model. Scale 1:10.")
    print(f"REEF 999: {mesh.triangles():,} triangles, {size:,} bytes -> {path}")
