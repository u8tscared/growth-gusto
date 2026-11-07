"""Animated hero of the review e-mails (« Votre dîner s'est bien passé ? », « Merci de votre visite ! »): img/mail/avis-etoiles.gif.
Mail clients run no script and Gmail drops CSS animations: an animated GIF is the motion every client shows (Outlook desktop shows
frame 0, so frame 0 is the finished picture). Run: python3 tools/gen-mail-gif.py"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

W, H, S = 600, 250, 2          # display size, drawn at 2x for retina
w, h = W * S, H * S
N = 54                         # frames
OUT = os.path.join(os.path.dirname(__file__), "..", "img", "mail", "avis-etoiles.gif")

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def ease_back(t):
    c1, c3 = 1.9, 2.9
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2

def star_poly(cx, cy, R, r, rot=0):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5 + rot
        rr = R if i % 2 == 0 else r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts

# static background gradient
base = Image.new("RGB", (w, h))
px = base.load()
top, bot = (52, 16, 168), (16, 7, 48)
for y in range(h):
    for x in range(w):
        t = min(1, max(0, (y / h) * 0.75 + (x / w) * 0.25))
        px[x, y] = lerp(top, bot, t)

BLOBS = [((236, 72, 153), 0.20, 0.25, 230, 0.0), ((34, 211, 238), 0.80, 0.70, 250, 2.1), ((167, 139, 250), 0.55, 0.15, 280, 4.0), ((236, 72, 153), 0.08, 0.95, 170, 1.0)]

def aurora(f):
    layer = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(layer)
    ph = 2 * math.pi * f / N
    for col, bx, by, rad, off in BLOBS:
        cx = w * bx + math.cos(ph + off) * 90 * S
        cy = h * by + math.sin(ph * 1 + off) * 35 * S
        R = rad * S
        d.ellipse([cx - R, cy - R * 0.6, cx + R, cy + R * 0.6], fill=tuple(int(c * 0.42) for c in col))
    return layer.filter(ImageFilter.GaussianBlur(70 * S))

from PIL import ImageChops
BG = ImageChops.add(base, aurora(N // 5))
GOLD, GOLD2 = (255, 203, 47), (255, 166, 0)
xs = [W / 2 + (i - 2) * 92 for i in range(5)]

def frame(f):
    im = BG.copy()  # the aurora stays still: only what moves changes between frames (small GIF)
    glow = Image.new("RGB", (w, h), (0, 0, 0)); gd = ImageDraw.Draw(glow)
    d = ImageDraw.Draw(im)
    # timeline: 0..7 hold full (frame 0 = finished picture), 8..11 fade out, 12..40 pop in one by one, rest: shimmer + hold
    for i, x in enumerate(xs):
        if f < 8: s = 1.0
        elif f < 12: s = max(0.0, 1 - (f - 8) / 4)
        else:
            t = (f - 12 - i * 4) / 7
            s = 0 if t <= 0 else (ease_back(min(1, t)) if t < 1 else 1)
        cx, cy = x * S, 118 * S
        # empty slot
        d.polygon(star_poly(cx, cy, 36 * S, 15 * S), fill=(125, 98, 235))
        if s > 0.02:
            rot = (1 - min(1, s)) * 0.6
            d.polygon(star_poly(cx, cy + 5 * S, 36 * S * s, 15 * S * s, rot), fill=(150, 80, 0))  # depth: a darker star just below
            d.polygon(star_poly(cx, cy, 36 * S * s, 15 * S * s, rot), fill=GOLD)
            d.polygon(star_poly(cx - 2 * S, cy + 3 * S, 36 * S * s * 0.55, 15 * S * s * 0.55, rot), fill=GOLD2)
            d.polygon(star_poly(cx - 4 * S, cy - 6 * S, 36 * S * s * 0.32, 15 * S * s * 0.32, rot), fill=(255, 236, 160))
    d = ImageDraw.Draw(im)
    # shimmer: a sparkle travelling over the stars after they all landed
    if f >= 42:
        t = (f - 42) / (N - 43)
        sx = (xs[0] - 50 + t * (xs[4] - xs[0] + 100)) * S
        for k, (dx, dy, r) in enumerate([(0, -30, 9), (18, 26, 5), (-24, 12, 4)]):
            cx, cy, rr = sx + dx * S, 118 * S + dy * S, r * S * (0.6 + 0.4 * math.sin(t * 9 + k))
            d.polygon([(cx, cy - rr * 2), (cx + rr * 0.4, cy - rr * 0.4), (cx + rr * 2, cy), (cx + rr * 0.4, cy + rr * 0.4), (cx, cy + rr * 2), (cx - rr * 0.4, cy + rr * 0.4), (cx - rr * 2, cy), (cx - rr * 0.4, cy - rr * 0.4)], fill=(255, 255, 255))
    # confetti dots rising slowly
    for k in range(14):
        ph = (f / N + k / 14) % 1
        cx = (40 + (k * 41) % 520) * S; cy = (H + 10 - ph * (H + 30)) * S
        c = [(255, 203, 47), (236, 72, 153), (34, 211, 238), (255, 255, 255)][k % 4]
        r = (2 + k % 3) * S
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
    return im.resize((int(W * 1.5), int(H * 1.5)), Image.LANCZOS)  # 1.5x: sharp on phones, light enough for mail

frames = [frame(f) for f in range(N)]
pal = frames[N - 8].quantize(colors=200, method=Image.Quantize.MEDIANCUT)
bgq = BG.resize(frames[0].size, Image.LANCZOS).quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG)
# dithered background (no banding) shared by every frame; only pixels that differ from the plain background take the frame's own colour
import numpy as np
bgr = np.asarray(BG.resize(frames[0].size, Image.LANCZOS)).astype(int); bqa = np.asarray(bgq)
q = []
for fr in frames:
    a = np.asarray(fr).astype(int); fq = np.asarray(fr.quantize(palette=pal, dither=Image.Dither.NONE))
    diff = np.abs(a - bgr).sum(axis=2) > 30
    out = np.where(diff, fq, bqa).astype("uint8"); im = Image.fromarray(out, "P"); im.putpalette(pal.getpalette()); q.append(im)
dur = [1400] + [60] * (N - 2) + [900]
q[0].save(OUT, save_all=True, append_images=q[1:], duration=dur, loop=0, optimize=True, disposal=1)
print(OUT, os.path.getsize(OUT) // 1024, "KB")
