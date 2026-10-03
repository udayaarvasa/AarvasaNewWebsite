"""Measure the REEF 996 facade rhythm from a developer render.

Not eyeballing: ffmpeg decodes the frame to raw greyscale, and the periodicity
of the balcony bands is recovered by autocorrelating the row-brightness profile.
A stack of identical floors is a strong periodic signal, so the first dominant
lag IS the floor pitch in pixels. The same trick along a row recovers the
horizontal wave period.
"""
import subprocess, sys, math

def grey(path, w):
    probe = subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream=width,height","-of","csv=p=0",path],
        capture_output=True, text=True).stdout.strip().split(",")
    W, H = int(probe[0]), int(probe[1])
    h = max(2, round(w * H / W / 2) * 2)
    raw = subprocess.run(["ffmpeg","-v","error","-i",path,"-vf",
        f"scale={w}:{h},format=gray","-f","rawvideo","-pix_fmt","gray","-"],
        capture_output=True).stdout
    return w, h, raw, W, H

def profile(px, w, h, axis, lo, hi):
    """Mean brightness per row (axis=0) or per column (axis=1) over a sub-window."""
    out = []
    if axis == 0:
        for y in range(h):
            row = px[y*w + int(lo*w): y*w + int(hi*w)]
            out.append(sum(row)/max(len(row),1))
    else:
        for x in range(w):
            col = [px[y*w + x] for y in range(int(lo*h), int(hi*h))]
            out.append(sum(col)/max(len(col),1))
    return out

def autocorr_peak(sig, min_lag, max_lag):
    n = len(sig)
    mean = sum(sig)/n
    s = [v-mean for v in sig]
    denom = sum(v*v for v in s) or 1
    best, best_lag, curve = -2, 0, []
    for lag in range(min_lag, min(max_lag, n-1)):
        acc = sum(s[i]*s[i+lag] for i in range(n-lag)) / denom
        curve.append((lag, acc))
        if acc > best:
            best, best_lag = acc, lag
    return best_lag, best, curve

path, w = sys.argv[1], int(sys.argv[2])
axis = 0 if sys.argv[3] == "rows" else 1
lo, hi = float(sys.argv[4]), float(sys.argv[5])
mn, mx = int(sys.argv[6]), int(sys.argv[7])

W, H, raw, OW, OH = grey(path, w)
px = list(raw)
sig = profile(px, W, H, axis, lo, hi)
lag, score, curve = autocorr_peak(sig, mn, mx)
span = H if axis == 0 else W
print(f"  source {OW}x{OH} -> analysed {W}x{H}")
print(f"  dominant period: {lag}px  (correlation {score:.3f})")
print(f"  that is {span/lag:.1f} repeats across the {'height' if axis==0 else 'width'} of the analysed window")
top = sorted(curve, key=lambda t: -t[1])[:5]
print("  top lags:", ", ".join(f"{l}px({a:.2f})" for l, a in top))
