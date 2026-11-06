#!/usr/bin/env python3
"""Adds an iPhone status bar (time, island, signal, Wi-Fi, battery) on top of the app screenshots
of site/img, so every phone on the landing page shows a real, complete screen.
Input: 600 x 1298 captures (390 x 844 viewport). Output: 600 x 1382, in place. Already done images are skipped.
Usage: python3 tools/landing-statusbar.py [site/img/x.jpg ...]   (default: every 600 x 1298 jpg of site/img)
"""
import sys, glob, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
BAR, W, S = 84, 600, 4  # bar height, width, supersampling
FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"

def bar(bg):
    lum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
    ink = (27, 21, 48) if lum > 140 else (255, 255, 255)
    im = Image.new("RGB", (W * S, BAR * S), bg)
    d = ImageDraw.Draw(im)
    cy = 45 * S
    # island
    iw, ih = 186 * S, 54 * S
    d.rounded_rectangle((W * S // 2 - iw // 2, cy - ih // 2, W * S // 2 + iw // 2, cy + ih // 2), radius=ih // 2, fill=(0, 0, 0))
    # time
    f = ImageFont.truetype(FONT, 27 * S)
    t = "9:41"
    tb = d.textbbox((0, 0), t, font=f)
    d.text((88 * S - (tb[2] - tb[0]) // 2, cy - (tb[3] + tb[1]) // 2), t, font=f, fill=ink)
    # signal bars
    x = 418 * S
    for i, hh in enumerate((8, 12, 16, 20)):
        bx = x + i * 8 * S
        d.rounded_rectangle((bx, cy + 10 * S - hh * S, bx + 5 * S, cy + 10 * S), radius=int(1.4 * S), fill=ink)
    # wifi: three arcs + dot
    wx, wy = 470 * S, cy + 9 * S
    for r in (20, 13.5, 7):
        rr = int(r * S)
        d.arc((wx - rr, wy - rr, wx + rr, wy + rr), 225, 315, fill=ink, width=int(4.2 * S))
    d.ellipse((wx - 3 * S, wy - 5 * S, wx + 3 * S, wy + 1 * S), fill=ink)
    # battery
    bx, by, bw, bh = 497 * S, cy - 10 * S, 42 * S, 20 * S
    d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=6 * S, outline=ink + (0,) if False else ink, width=int(2.2 * S))
    d.rounded_rectangle((bx + 4 * S, by + 4 * S, bx + bw - 10 * S, by + bh - 4 * S), radius=3 * S, fill=ink)
    d.rounded_rectangle((bx + bw + 3 * S, cy - 4 * S, bx + bw + 6 * S, cy + 4 * S), radius=2 * S, fill=ink)
    return im.resize((W, BAR), Image.LANCZOS)

files = sys.argv[1:] or sorted(glob.glob(str(ROOT / "site" / "img" / "*.jpg")))
for p in files:
    im = Image.open(p).convert("RGB")
    if im.size != (W, 1298):
        continue
    bg = im.getpixel((W // 2, 1))
    out = Image.new("RGB", (W, 1298 + BAR), bg)
    out.paste(bar(bg), (0, 0))
    out.paste(im, (0, BAR))
    out.save(p, quality=84, optimize=True, progressive=True)
    print("bar", pathlib.Path(p).name)
