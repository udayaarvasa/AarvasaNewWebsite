"""Count balcony bands in a render by finding bright ridges in a vertical strip.

Perspective makes the spacing vary with height, so autocorrelation finds no
single period. Peak counting does not care: each balcony slab is a bright
horizontal ridge against the darker glazing between floors, so the number of
ridges in a strip is the number of floors the strip crosses.
"""
import subprocess, sys

def grey(path, w):
    probe = subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream=width,height","-of","csv=p=0",path],
        capture_output=True, text=True).stdout.strip().split(",")
    W, H = int(probe[0]), int(probe[1])
    h = max(2, round(w * H / W / 2) * 2)
    raw = subprocess.run(["ffmpeg","-v","error","-i",path,"-vf",
        f"scale={w}:{h},format=gray","-f","rawvideo","-pix_fmt","gray","-"],
        capture_output=True).stdout
    return w, h, list(raw)

def smooth(sig, k):
    out = []
    for i in range(len(sig)):
        lo, hi = max(0, i-k), min(len(sig), i+k+1)
        out.append(sum(sig[lo:hi])/(hi-lo))
    return out

path, w, x0, x1, y0, y1 = sys.argv[1], int(sys.argv[2]), *map(float, sys.argv[3:7])
W, H, px = grey(path, w)
a, b = int(x0*W), int(x1*W)
rows = []
for y in range(int(y0*H), int(y1*H)):
    seg = px[y*W+a : y*W+b]
    rows.append(sum(seg)/max(len(seg),1))

s = smooth(rows, 1)
# A ridge is a local maximum that stands clear of its neighbourhood.
base = smooth(rows, 8)
peaks = [i for i in range(2, len(s)-2)
         if s[i] >= s[i-1] and s[i] >= s[i+1] and s[i] - base[i] > 3
         and s[i] > s[i-2] and s[i] > s[i+2]]
# Merge peaks closer than 3px: one slab, one ridge.
merged = []
for p in peaks:
    if not merged or p - merged[-1] > 3:
        merged.append(p)
print(f"  strip x={x0:.2f}-{x1:.2f}, y={y0:.2f}-{y1:.2f} of {W}x{H}")
print(f"  balcony ridges counted: {len(merged)}")
gaps = [merged[i+1]-merged[i] for i in range(len(merged)-1)]
if gaps:
    gaps_sorted = sorted(gaps)
    print(f"  spacing px: min {min(gaps)}, median {gaps_sorted[len(gaps)//2]}, max {max(gaps)}  (perspective widens it downwards)")
