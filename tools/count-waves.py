"""Count wave crests along one balcony band — the horizontal rhythm of the facade."""
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
    return [sum(sig[max(0,i-k):min(len(sig),i+k+1)])/len(sig[max(0,i-k):min(len(sig),i+k+1)]) for i in range(len(sig))]

path, w, y0, y1, x0, x1 = sys.argv[1], int(sys.argv[2]), *map(float, sys.argv[3:7])
W, H, px = grey(path, w)
cols = []
for x in range(int(x0*W), int(x1*W)):
    seg = [px[y*W+x] for y in range(int(y0*H), int(y1*H))]
    cols.append(sum(seg)/max(len(seg),1))
s = smooth(cols, 2)
base = smooth(cols, 12)
peaks = [i for i in range(3, len(s)-3) if s[i] >= s[i-1] and s[i] >= s[i+1] and s[i]-base[i] > 2]
merged = []
for p in peaks:
    if not merged or p - merged[-1] > 4:
        merged.append(p)
print(f"  band y={y0:.2f}-{y1:.2f}, across x={x0:.2f}-{x1:.2f} of {W}x{H}")
print(f"  wave crests across this face: {len(merged)}")
if len(merged) > 1:
    gaps = [merged[i+1]-merged[i] for i in range(len(merged)-1)]
    print(f"  crest spacing px: median {sorted(gaps)[len(gaps)//2]}, range {min(gaps)}-{max(gaps)}")
