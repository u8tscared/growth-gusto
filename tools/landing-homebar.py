#!/usr/bin/env python3
"""Gives the app screenshots of site/img the bottom of a real iPhone: the floating tab bar is raised to
where the home-indicator safe area puts it (so the rounded screen corners of the phone mockups no longer
cut into it), the content under it fades out, and the home indicator is drawn.
Then the image is brought to the shape of a real iPhone screen (393 x 852 pt, so 600 x 1301): 81 rows of the
page are taken out where the cut does not show (see seam), the tab bar and the bottom stay.
Input: 600 x 1382 captures that already went through tools/landing-statusbar.py. Done images are recorded in
tools/landing-homebar.done; 600 x 1301 images are left alone, so a second run changes nothing.
Usage: python3 tools/landing-homebar.py [site/img/x.jpg ...]   (default: every jpg of site/img)
"""
import sys, glob, pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
DONE = ROOT / "tools" / "landing-homebar.done"
W, H = 600, 1382
UP = 22            # 14 css px × 1.54: tab bar at 26 px from the bottom, as with the iPhone safe area
TAB_TOP, TAB_BOT = H - 132, H - 16   # tab bar strip (70 css px high, 12 px from the bottom) with its border
S = 4
H_OUT = 1301      # 600 / 1301 = 393 / 852, the screen of an iPhone 15 / 16
BOTTOM = 154      # tab bar (raised) + home indicator zone, kept as is when the image is shortened

def has_tabbar(im):
    r, g, b = im.getpixel((W // 2, H - 72))  # the scan button in the middle of the tab bar
    return abs(r - 152) < 18 and abs(g - 128) < 18 and abs(b - 238) < 18

def has_tabbar_raised(im):
    r, g, b = im.getpixel((W // 2, H - 72 - UP))
    return abs(r - 152) < 18 and abs(g - 128) < 18 and abs(b - 238) < 18

def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def indicator(im):
    H = im.height
    zone = im.crop((W // 2 - 110, H - 24, W // 2 + 110, H - 8)).resize((1, 1), Image.BOX).getpixel((0, 0))
    ink = (27, 21, 48, 235) if lum(zone) > 140 else (255, 255, 255, 235)
    w, h, y = 206, 8, H - 12 - 8
    lay = Image.new("RGBA", ((w + 4) * S, (h + 4) * S), (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle((2 * S, 2 * S, (w + 2) * S, (h + 2) * S), radius=h * S // 2, fill=ink)
    lay = lay.resize((w + 4, h + 4), Image.LANCZOS)
    im.paste(lay, (W // 2 - w // 2 - 2, y - 2), lay)

# screens where the first plain cut would take a title or a step away: cut just above the bottom strip instead
LOW_CUT = {"reception.jpg", "zenchef.jpg"}

def seam(im, bottom, name=""):
    """Row where the 81 removed rows start: the lowest place where the page reads on without a visible cut
    (rows just above and just below the removed band alike), so a sticky button above the tab bar is kept whole."""
    import numpy as np
    a = np.asarray(im, dtype=np.int16)
    cut = H - H_OUT
    if name in LOW_CUT:
        return H - bottom - cut
    best, best_d = H - bottom - cut, 1e9
    for c in range(H - bottom - cut, 260, -1):
        d = float(np.abs(a[c - 3:c] - a[c + cut:c + cut + 3]).mean())
        plain = a[c - 1].std(axis=0).max() < 4 and a[c + cut].std(axis=0).max() < 4  # cut between blocks, not through one
        if d < 1.5 and plain:
            return c
    return best  # nothing plain: cut just above the bottom strip

def fit(path, tab):
    im = Image.open(path).convert("RGB")
    if im.size != (W, H):
        return False
    bottom = BOTTOM if tab else 40
    c = seam(im, bottom, pathlib.Path(path).name)
    out = Image.new("RGB", (W, H_OUT))
    out.paste(im.crop((0, 0, W, c)), (0, 0))
    out.paste(im.crop((0, c + H - H_OUT, W, H)), (0, c))
    out.save(path, quality=88, optimize=True)
    return True

def fix(path):
    im = Image.open(path).convert("RGB")
    if im.size != (W, H):
        return False
    if has_tabbar(im):
        bg = im.getpixel((4, 150))
        out = im.copy()
        out.paste(im.crop((0, TAB_TOP, W, TAB_BOT)), (0, TAB_TOP - UP))
        n = H - (TAB_BOT - UP)
        under = im.crop((0, TAB_BOT, W, H)).resize((W, n), Image.BICUBIC)
        veil = Image.new("RGB", (W, n), bg)
        mask = Image.new("L", (1, n))
        for y in range(n):
            mask.putpixel((0, y), int(255 * (0.55 + 0.4 * y / max(1, n - 1))))
        under = Image.composite(veil, under, mask.resize((W, n)))
        out.paste(under, (0, TAB_BOT - UP))
        im = out
    im = im.convert("RGBA")
    indicator(im)
    im.convert("RGB").save(path, quality=88, optimize=True)
    return True

if __name__ == "__main__":
    done = set(DONE.read_text().split()) if DONE.exists() else set()
    files = sys.argv[1:] or sorted(glob.glob(str(ROOT / "site/img/*.jpg")))
    for f in files:
        name = pathlib.Path(f).name
        im = Image.open(f)
        if im.size != (W, H):
            continue
        tab = has_tabbar(im.convert("RGB")) or name in done and has_tabbar_raised(im.convert("RGB"))
        if name not in done:
            fix(f)
            done.add(name)
        if fit(f, tab):
            print("homebar", name)
    DONE.write_text("\n".join(sorted(done)) + "\n")
