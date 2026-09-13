#!/usr/bin/env python3
"""
Watchfort Pixar-appeal 2D sprite generator (Pillow).
Soft gradients, rounded AA silhouettes, specular + rim light.
Transparent backgrounds. Same gameplay sizes as before.
"""
from __future__ import annotations

import math
import os
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
PUBLIC = ROOT / "public" / "assets"
SCALE = 4  # draw at 4× then LANCZOS downscale for AA

# Palette (RGBA)
P = {
    "grass": (74, 124, 89, 255),
    "grassL": (110, 168, 118, 255),
    "grassM": (92, 148, 107, 255),
    "grassD": (52, 92, 64, 255),
    "path": (196, 165, 116, 255),
    "pathL": (222, 196, 150, 255),
    "pathM": (184, 152, 100, 255),
    "pathD": (148, 118, 72, 255),
    "blue": (59, 130, 196, 255),
    "blueL": (120, 180, 230, 255),
    "blueD": (36, 90, 150, 255),
    "cannon": (249, 115, 22, 255),
    "cannonL": (255, 176, 96, 255),
    "cannonD": (200, 80, 10, 255),
    "frost": (34, 211, 238, 255),
    "frostL": (160, 240, 255, 255),
    "frostD": (14, 150, 180, 255),
    "barracks": (61, 155, 110, 255),
    "barracksL": (110, 200, 150, 255),
    "barracksD": (36, 110, 78, 255),
    "red": (214, 69, 69, 255),
    "redL": (240, 120, 110, 255),
    "redD": (155, 40, 44, 255),
    "swarm": (232, 106, 60, 255),
    "swarmL": (255, 160, 110, 255),
    "splitter": (123, 198, 126, 255),
    "splitterL": (168, 230, 161, 255),
    "splitterD": (61, 139, 90, 255),
    "gold": (232, 184, 74, 255),
    "goldL": (255, 230, 150, 255),
    "goldD": (180, 130, 40, 255),
    "wood": (160, 105, 55, 255),
    "woodL": (200, 145, 85, 255),
    "woodD": (110, 70, 35, 255),
    "iron": (120, 130, 145, 255),
    "ironL": (180, 190, 205, 255),
    "ironD": (70, 78, 90, 255),
    "skin": (232, 180, 140, 255),
    "skinL": (255, 215, 185, 255),
    "skinD": (190, 140, 105, 255),
    "shade": (31, 41, 51, 255),
    "panel": (17, 24, 39, 255),
    "text": (243, 244, 246, 255),
    "white": (255, 255, 255, 255),
}


def clamp(v: int, lo: int = 0, hi: int = 255) -> int:
    return max(lo, min(hi, v))


def mix(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def lighten(c: tuple, amount: float = 0.25) -> tuple:
    return mix(c, (255, 255, 255, c[3]), amount)


def darken(c: tuple, amount: float = 0.25) -> tuple:
    return mix(c, (0, 0, 0, c[3]), amount)


def new_canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w * SCALE, h * SCALE), (0, 0, 0, 0))


def finish(img: Image.Image, w: int, h: int) -> Image.Image:
    return img.resize((w, h), Image.Resampling.LANCZOS)


def S(v: float) -> int:
    return int(round(v * SCALE))


def fill_ellipse(draw: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, color: tuple):
    box = [S(cx - rx), S(cy - ry), S(cx + rx), S(cy + ry)]
    draw.ellipse(box, fill=color)


def fill_rounded_rect(draw: ImageDraw.ImageDraw, x0: float, y0: float, x1: float, y1: float, r: float, color: tuple):
    draw.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(r), fill=color)


def soft_radial(
    img: Image.Image,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    inner: tuple,
    outer: tuple,
    power: float = 1.0,
):
    """Soft radial gradient ellipse blended onto img (only inside ellipse)."""
    w, h = img.size
    px_cx, px_cy = S(cx), S(cy)
    px_rx, px_ry = max(1, S(rx)), max(1, S(ry))
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pix = overlay.load()
    x0 = max(0, px_cx - px_rx - 1)
    x1 = min(w, px_cx + px_rx + 2)
    y0 = max(0, px_cy - px_ry - 1)
    y1 = min(h, px_cy + px_ry + 2)
    for y in range(y0, y1):
        for x in range(x0, x1):
            nx = (x - px_cx) / px_rx
            ny = (y - px_cy) / px_ry
            d = math.sqrt(nx * nx + ny * ny)
            if d > 1.0:
                continue
            t = d ** power
            pix[x, y] = mix(inner, outer, t)
    img.alpha_composite(overlay)


def soft_linear_v(
    img: Image.Image,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    top: tuple,
    bottom: tuple,
    radius: float = 4,
):
    """Vertical gradient inside a rounded rect region."""
    draw = ImageDraw.Draw(img)
    # mask via temp
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(radius), fill=255)
    grad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gp = grad.load()
    sy0, sy1 = S(y0), S(y1)
    span = max(1, sy1 - sy0)
    sx0, sx1 = S(x0), S(x1)
    for y in range(max(0, sy0), min(h, sy1 + 1)):
        t = (y - sy0) / span
        c = mix(top, bottom, t)
        for x in range(max(0, sx0), min(w, sx1 + 1)):
            gp[x, y] = c
    img.paste(grad, (0, 0), mask)


def add_specular(img: Image.Image, cx: float, cy: float, rx: float, ry: float, alpha: int = 160):
    soft_radial(img, cx, cy, rx, ry, (255, 255, 255, alpha), (255, 255, 255, 0), power=0.7)


def add_rim(img: Image.Image, cx: float, cy: float, rx: float, ry: float, color: tuple, thickness: float = 1.2):
    """Subtle rim light along bottom-right edge via ring difference."""
    w, h = img.size
    ring = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring)
    # outer
    d.ellipse([S(cx - rx), S(cy - ry), S(cx + rx), S(cy + ry)], fill=color)
    # punch inner (slightly shifted up-left so rim sits bottom-right)
    inner = Image.new("L", (w, h), 0)
    idr = ImageDraw.Draw(inner)
    ox, oy = -0.35 * SCALE, -0.35 * SCALE
    idr.ellipse(
        [S(cx - rx + thickness) + ox, S(cy - ry + thickness) + oy, S(cx + rx - thickness) + ox, S(cy + ry - thickness) + oy],
        fill=255,
    )
    # clear inner from ring
    rp = ring.load()
    for y in range(h):
        for x in range(w):
            if inner.getpixel((x, y)) > 128 and rp[x, y][3] > 0:
                rp[x, y] = (0, 0, 0, 0)
    # soften
    ring = ring.filter(ImageFilter.GaussianBlur(radius=max(0.5, SCALE * 0.25)))
    img.alpha_composite(ring)


def contact_blob(img: Image.Image, cx: float, cy: float, rx: float, ry: float, alpha: int = 55):
    soft_radial(img, cx, cy, rx, ry, (0, 0, 0, alpha), (0, 0, 0, 0), power=1.2)


def save(name: str, img: Image.Image, w: int, h: int):
    out = finish(img, w, h)
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    out.save(OUT / name, "PNG")
    shutil.copy2(OUT / name, PUBLIC / name)
    print(f"  {name} ({w}x{h})")


# ─── TILES ───────────────────────────────────────────────────────────

def gen_tile_grass():
    w = h = 64
    img = Image.new("RGBA", (w * SCALE, h * SCALE), P["grass"])
    # soft top-left light via large radial
    soft_radial(img, 18, 14, 50, 48, lighten(P["grass"], 0.22), P["grass"], power=0.9)
    # warm bounce bottom-right
    soft_radial(img, 50, 54, 36, 30, mix(P["grass"], P["pathL"], 0.15), (0, 0, 0, 0), power=1.1)
    d = ImageDraw.Draw(img)
    # soft grass tufts (rounded ellipses)
    tufts = [
        (12, 20, 5, 3, P["grassL"]),
        (28, 14, 6, 3.5, P["grassM"]),
        (44, 22, 5.5, 3, P["grassL"]),
        (18, 40, 6, 3.5, P["grassM"]),
        (36, 48, 5, 3, P["grassL"]),
        (52, 38, 5.5, 3, P["grassM"]),
        (8, 52, 4.5, 2.5, P["grassL"]),
        (48, 8, 5, 2.8, P["grassM"]),
        (24, 30, 4, 2.5, lighten(P["grassL"], 0.15)),
    ]
    for cx, cy, rx, ry, col in tufts:
        fill_ellipse(d, cx, cy, rx, ry, col)
        # highlight tip
        fill_ellipse(d, cx - rx * 0.25, cy - ry * 0.35, rx * 0.45, ry * 0.45, lighten(col, 0.35))
    # subtle edge darkening
    soft_radial(img, 32, 32, 38, 38, (0, 0, 0, 0), darken(P["grass"], 0.35)[:3] + (40,), power=2.5)
    save("tile_grass.png", img, w, h)


def gen_tile_path():
    w = h = 64
    img = Image.new("RGBA", (w * SCALE, h * SCALE), P["path"])
    soft_radial(img, 20, 16, 48, 44, P["pathL"], P["path"], power=0.85)
    soft_radial(img, 48, 52, 40, 36, P["pathD"][:3] + (90,), (0, 0, 0, 0), power=1.0)
    d = ImageDraw.Draw(img)
    # sandy pebbles
    pebbles = [
        (14, 18, 3.5, 2.5),
        (30, 12, 2.8, 2.2),
        (48, 20, 3.2, 2.4),
        (22, 36, 3.0, 2.2),
        (40, 42, 3.5, 2.6),
        (54, 48, 2.6, 2.0),
        (10, 50, 3.0, 2.2),
        (36, 28, 2.5, 1.8),
    ]
    for cx, cy, rx, ry in pebbles:
        fill_ellipse(d, cx, cy, rx, ry, P["pathM"])
        fill_ellipse(d, cx - 0.6, cy - 0.5, rx * 0.5, ry * 0.5, P["pathL"])
    # edge darkening (path reads against grass)
    edge = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    thick = S(3.5)
    # frame
    ed.rectangle([0, 0, img.size[0] - 1, thick], fill=P["pathD"][:3] + (70,))
    ed.rectangle([0, img.size[1] - thick, img.size[0] - 1, img.size[1] - 1], fill=P["pathD"][:3] + (90,))
    ed.rectangle([0, 0, thick, img.size[1] - 1], fill=P["pathD"][:3] + (70,))
    ed.rectangle([img.size[0] - thick, 0, img.size[0] - 1, img.size[1] - 1], fill=P["pathD"][:3] + (90,))
    edge = edge.filter(ImageFilter.GaussianBlur(radius=SCALE * 0.6))
    img.alpha_composite(edge)
    save("tile_path.png", img, w, h)


def gen_tile_gate():
    w = h = 64
    img = new_canvas(w, h)
    d = ImageDraw.Draw(img)
    contact_blob(img, 32, 56, 22, 6, 50)
    # warm wood posts
    soft_linear_v(img, 8, 12, 18, 54, P["woodL"], P["woodD"], radius=5)
    soft_linear_v(img, 46, 12, 56, 54, P["woodL"], P["woodD"], radius=5)
    # lintel
    soft_linear_v(img, 8, 14, 56, 26, P["woodL"], P["wood"], radius=4)
    # gold frame band
    soft_linear_v(img, 12, 16, 52, 24, P["goldL"], P["goldD"], radius=3)
    add_specular(img, 28, 18, 14, 4, 140)
    # crown medallion
    soft_radial(img, 32, 10, 8, 7, P["goldL"], P["goldD"], power=0.8)
    soft_radial(img, 30, 8, 3, 2.5, (255, 255, 255, 180), (255, 255, 255, 0))
    # soft outline hint
    fill_ellipse(d, 32, 10, 8.5, 7.5, (0, 0, 0, 0))  # noop keep draw
    # inviting arch opening soft shade
    soft_radial(img, 32, 40, 14, 16, P["woodD"][:3] + (40,), (0, 0, 0, 0), power=1.0)
    save("tile_gate.png", img, w, h)


# ─── TOWERS ──────────────────────────────────────────────────────────

def tower_base(img: Image.Image, accent: tuple, accent_l: tuple, accent_d: tuple):
    contact_blob(img, 32, 56, 16, 5, 55)
    # rounded wooden platform
    soft_radial(img, 32, 48, 18, 10, P["woodL"], P["woodD"], power=0.9)
    soft_linear_v(img, 14, 36, 50, 52, P["woodL"], P["woodD"], radius=8)
    add_specular(img, 24, 40, 10, 5, 100)
    # accent body (rounded)
    soft_radial(img, 32, 28, 14, 14, accent_l, accent_d, power=0.85)
    soft_linear_v(img, 18, 16, 46, 40, accent_l, accent_d, radius=10)
    add_specular(img, 26, 20, 7, 5, 150)
    add_rim(img, 32, 28, 14, 14, lighten(accent, 0.4)[:3] + (90,), thickness=1.4)


def gen_tower_arrow():
    w = h = 64
    img = new_canvas(w, h)
    tower_base(img, P["blue"], P["blueL"], P["blueD"])
    d = ImageDraw.Draw(img)
    # glossy barrel
    soft_linear_v(img, 28, 4, 36, 22, P["ironL"], P["ironD"], radius=3)
    soft_radial(img, 32, 6, 6, 4, P["goldL"], P["goldD"], power=0.8)
    add_specular(img, 30, 8, 3, 6, 160)
    fill_ellipse(d, 32, 5, 2.5, 2, P["goldL"])
    save("tower_arrow.png", img, w, h)


def gen_tower_cannon():
    w = h = 64
    img = new_canvas(w, h)
    tower_base(img, P["cannon"], P["cannonL"], P["cannonD"])
    soft_linear_v(img, 24, 2, 40, 22, P["ironL"], P["ironD"], radius=6)
    soft_radial(img, 32, 8, 8, 6, P["cannonL"], P["cannonD"], power=0.8)
    soft_radial(img, 32, 5, 4, 3.5, P["shade"][:3] + (200,), P["cannonD"])
    soft_radial(img, 32, 5, 2, 1.8, P["cannonL"], P["cannon"])
    add_specular(img, 28, 6, 4, 3, 140)
    save("tower_cannon.png", img, w, h)


def gen_tower_frost():
    w = h = 64
    img = new_canvas(w, h)
    tower_base(img, P["frost"], P["frostL"], P["frostD"])
    d = ImageDraw.Draw(img)
    # crystal petals
    for i in range(6):
        a = (i / 6) * math.pi * 2 - math.pi / 2
        cx = 32 + math.cos(a) * 10
        cy = 18 + math.sin(a) * 8
        soft_radial(img, cx, cy, 4.5, 4, P["frostL"], P["frostD"], power=0.7)
    soft_radial(img, 32, 18, 8, 8, P["frostL"], P["frostD"], power=0.75)
    soft_radial(img, 30, 15, 3.5, 3, (255, 255, 255, 200), (255, 255, 255, 0))
    fill_ellipse(d, 32, 18, 2.5, 2.5, P["text"])
    save("tower_frost.png", img, w, h)


def gen_tower_barracks():
    w = h = 64
    img = new_canvas(w, h)
    tower_base(img, P["barracks"], P["barracksL"], P["barracksD"])
    # door
    soft_linear_v(img, 26, 38, 38, 52, P["wood"], P["woodD"], radius=3)
    soft_radial(img, 32, 42, 3, 3, P["goldL"], P["goldD"])
    # banner
    soft_linear_v(img, 44, 10, 58, 22, P["barracksL"], P["barracksD"], radius=3)
    soft_linear_v(img, 46, 12, 56, 20, P["goldL"], P["goldD"], radius=2)
    soft_linear_v(img, 44, 10, 47, 36, P["ironL"], P["ironD"], radius=1.5)
    soft_radial(img, 32, 18, 5, 5, P["barracksL"], P["barracksD"])
    soft_radial(img, 32, 18, 2.2, 2.2, P["goldL"], P["gold"])
    save("tower_barracks.png", img, w, h)


# ─── UNITS / ENEMIES ─────────────────────────────────────────────────

def gen_unit_soldier():
    w = h = 32
    img = new_canvas(w, h)
    d = ImageDraw.Draw(img)
    contact_blob(img, 16, 28, 8, 3, 50)
    # legs
    soft_linear_v(img, 10, 20, 14, 28, P["woodL"], P["woodD"], radius=2)
    soft_linear_v(img, 18, 20, 22, 28, P["woodL"], P["woodD"], radius=2)
    # body
    soft_radial(img, 16, 16, 7, 7, P["barracksL"], P["barracksD"], power=0.85)
    add_specular(img, 13, 13, 3, 2.5, 120)
    # head (cute)
    soft_radial(img, 16, 8, 5.5, 5.5, P["skinL"], P["skinD"], power=0.8)
    soft_radial(img, 16, 6.5, 5, 3.5, P["goldL"], P["goldD"], power=0.85)  # helm
    # eyes
    fill_ellipse(d, 14, 9, 1.1, 1.3, P["shade"])
    fill_ellipse(d, 18, 9, 1.1, 1.3, P["shade"])
    fill_ellipse(d, 13.7, 8.6, 0.45, 0.45, P["white"])
    fill_ellipse(d, 17.7, 8.6, 0.45, 0.45, P["white"])
    # spear
    soft_linear_v(img, 24, 2, 26, 26, P["ironL"], P["ironD"], radius=1)
    soft_radial(img, 25, 3, 3.5, 2.5, P["goldL"], P["goldD"])
    save("unit_soldier.png", img, w, h)


def cute_enemy(
    size: int,
    body: tuple,
    body_l: tuple,
    body_d: tuple,
    *,
    head_scale: float = 1.15,
    chunky: bool = False,
    horns: bool = False,
    armor: bool = False,
    legs_short: bool = False,
):
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    mid = size / 2
    contact_blob(img, mid, size - 5, size * 0.28, size * 0.1, 55)
    body_cy = mid + (2 if chunky else 3)
    brx = size * (0.32 if chunky else 0.26)
    bry = size * (0.28 if chunky else 0.24)
    soft_radial(img, mid, body_cy, brx, bry, body_l, body_d, power=0.85)
    add_specular(img, mid - brx * 0.35, body_cy - bry * 0.4, brx * 0.4, bry * 0.35, 130)
    add_rim(img, mid, body_cy, brx, bry, lighten(body, 0.35)[:3] + (80,), 1.2)

    # head (big for cute)
    hx = mid
    hy = mid - size * 0.12 * head_scale
    hrx = size * 0.22 * head_scale
    hry = size * 0.2 * head_scale
    soft_radial(img, hx, hy, hrx, hry, body_l, body_d, power=0.8)
    add_specular(img, hx - hrx * 0.3, hy - hry * 0.35, hrx * 0.35, hry * 0.3, 150)

    # big eyes
    eye_y = hy - hry * 0.05
    eye_dx = hrx * 0.38
    erx, ery = hrx * 0.28, hry * 0.32
    for ex in (hx - eye_dx, hx + eye_dx):
        soft_radial(img, ex, eye_y, erx, ery, P["white"], (220, 220, 230, 255), power=0.9)
        soft_radial(img, ex + erx * 0.1, eye_y + ery * 0.1, erx * 0.45, ery * 0.5, P["shade"], P["shade"])
        fill_ellipse(d, ex - erx * 0.25, eye_y - ery * 0.25, erx * 0.2, ery * 0.2, P["white"])

    # cheeks
    cheek = mix(body_l, (255, 150, 140, 255), 0.45)
    soft_radial(img, hx - hrx * 0.7, hy + hry * 0.25, hrx * 0.22, hry * 0.15, cheek[:3] + (120,), cheek[:3] + (0,))
    soft_radial(img, hx + hrx * 0.7, hy + hry * 0.25, hrx * 0.22, hry * 0.15, cheek[:3] + (120,), cheek[:3] + (0,))

    # smile
    smile_y = hy + hry * 0.35
    fill_ellipse(d, hx, smile_y, hrx * 0.25, hry * 0.12, body_d)
    fill_ellipse(d, hx, smile_y - 0.4, hrx * 0.22, hry * 0.1, body_l)

    # legs
    leg_y0 = body_cy + bry * 0.55
    leg_h = size * (0.12 if legs_short else 0.18)
    soft_linear_v(img, mid - brx * 0.55, leg_y0, mid - brx * 0.2, leg_y0 + leg_h, body, body_d, radius=2)
    soft_linear_v(img, mid + brx * 0.2, leg_y0, mid + brx * 0.55, leg_y0 + leg_h, body, body_d, radius=2)

    # arms
    soft_radial(img, mid - brx * 1.05, body_cy, size * 0.08, size * 0.1, body_l, body_d)
    soft_radial(img, mid + brx * 1.05, body_cy, size * 0.08, size * 0.1, body_l, body_d)

    if armor:
        soft_linear_v(img, mid - brx * 0.85, body_cy - bry * 0.3, mid + brx * 0.85, body_cy + bry * 0.15, P["ironL"], P["ironD"], radius=4)
        add_specular(img, mid - 2, body_cy - bry * 0.15, brx * 0.4, 2, 100)

    if horns:
        soft_radial(img, hx - hrx * 0.7, hy - hry * 0.85, size * 0.06, size * 0.09, P["goldL"], P["goldD"])
        soft_radial(img, hx + hrx * 0.7, hy - hry * 0.85, size * 0.06, size * 0.09, P["goldL"], P["goldD"])

    return img


def gen_enemy_runner():
    img = cute_enemy(40, P["red"], P["redL"], P["redD"], head_scale=1.25, legs_short=False)
    save("enemy_runner.png", img, 40, 40)


def gen_enemy_tank():
    img = cute_enemy(44, P["redD"], P["red"], darken(P["redD"], 0.15), head_scale=1.0, chunky=True, armor=True)
    save("enemy_tank.png", img, 44, 44)


def gen_enemy_brute():
    img = cute_enemy(
        52,
        P["redD"],
        P["red"],
        darken(P["redD"], 0.2),
        head_scale=1.05,
        chunky=True,
        horns=True,
        armor=True,
    )
    save("enemy_brute.png", img, 52, 52)



def gen_enemy_splitter():
    """Lime-mint pod carrier with two swarm dots inside."""
    size = 48
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    mid = size / 2
    body, body_l, body_d = P["splitter"], P["splitterL"], P["splitterD"]
    contact_blob(img, mid, size - 5, size * 0.3, size * 0.1, 55)
    body_cy = mid + 2
    brx = size * 0.30
    bry = size * 0.34
    soft_radial(img, mid, body_cy, brx, bry, body_l, body_d, power=0.85)
    add_specular(img, mid - brx * 0.35, body_cy - bry * 0.4, brx * 0.4, bry * 0.35, 130)
    add_rim(img, mid, body_cy, brx, bry, lighten(body, 0.35)[:3] + (80,), 1.2)
    for sx, sy in ((mid - 6, body_cy + 2), (mid + 6, body_cy + 4)):
        soft_radial(img, sx, sy, 4.2, 3.8, P["swarmL"][:3] + (200,), P["swarm"][:3] + (160,), power=0.8)
        soft_radial(img, sx - 1, sy - 1, 1.5, 1.2, (255, 255, 255, 140), (255, 255, 255, 0))
    hx, hy = mid, mid - size * 0.14
    hrx, hry = size * 0.22, size * 0.2
    soft_radial(img, hx, hy, hrx, hry, body_l, body_d, power=0.8)
    add_specular(img, hx - hrx * 0.3, hy - hry * 0.35, hrx * 0.35, hry * 0.3, 150)
    eye_y = hy - hry * 0.05
    eye_dx = hrx * 0.38
    erx, ery = hrx * 0.30, hry * 0.34
    for ex in (hx - eye_dx, hx + eye_dx):
        soft_radial(img, ex, eye_y, erx, ery, P["white"], (220, 220, 230, 255), power=0.9)
        soft_radial(img, ex + erx * 0.1, eye_y + ery * 0.1, erx * 0.45, ery * 0.5, P["shade"], P["shade"])
        fill_ellipse(d, ex - erx * 0.25, eye_y - ery * 0.25, erx * 0.2, ery * 0.2, P["white"])
    cheek = mix(body_l, (255, 150, 140, 255), 0.45)
    soft_radial(img, hx - hrx * 0.7, hy + hry * 0.25, hrx * 0.22, hry * 0.15, cheek[:3] + (120,), cheek[:3] + (0,))
    soft_radial(img, hx + hrx * 0.7, hy + hry * 0.25, hrx * 0.22, hry * 0.15, cheek[:3] + (120,), cheek[:3] + (0,))
    smile_y = hy + hry * 0.35
    fill_ellipse(d, hx, smile_y, hrx * 0.25, hry * 0.12, body_d)
    fill_ellipse(d, hx, smile_y - 0.4, hrx * 0.22, hry * 0.1, body_l)
    leg_y0 = body_cy + bry * 0.55
    leg_h = size * 0.14
    soft_linear_v(img, mid - brx * 0.5, leg_y0, mid - brx * 0.25, leg_y0 + leg_h, body, body_d, radius=2)
    soft_linear_v(img, mid + brx * 0.25, leg_y0, mid + brx * 0.5, leg_y0 + leg_h, body, body_d, radius=2)
    soft_radial(img, mid - brx * 1.05, body_cy, size * 0.07, size * 0.09, body_l, body_d)
    soft_radial(img, mid + brx * 1.05, body_cy, size * 0.07, size * 0.09, body_l, body_d)
    save("enemy_splitter.png", img, size, size)
    hand = ROOT / "assets" / "handcrafted"
    hand.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUT / "enemy_splitter.png", hand / "enemy_splitter.png")


def gen_enemy_swarm():
    size = 32
    img = new_canvas(size, size)
    d = ImageDraw.Draw(img)
    mid = 16
    contact_blob(img, mid, 27, 8, 3, 45)
    # body
    soft_radial(img, mid, 18, 9, 8, P["swarmL"], darken(P["swarm"], 0.25), power=0.8)
    add_specular(img, mid - 3, 14, 4, 3, 140)
    # big head
    soft_radial(img, mid, 12, 8, 7.5, P["swarmL"], P["swarm"], power=0.75)
    soft_radial(img, mid - 2.5, 9, 3, 2.5, (255, 255, 255, 160), (255, 255, 255, 0))
    # huge eyes
    for ex in (12.5, 19.5):
        soft_radial(img, ex, 12, 3.2, 3.5, P["white"], (230, 230, 240, 255))
        soft_radial(img, ex + 0.4, 12.5, 1.5, 1.7, P["shade"], P["shade"])
        fill_ellipse(d, ex - 0.6, 11.5, 0.6, 0.6, P["white"])
    # little legs/feelers
    soft_linear_v(img, 7, 18, 11, 20, P["redD"], P["redD"], radius=1)
    soft_linear_v(img, 21, 18, 25, 20, P["redD"], P["redD"], radius=1)
    soft_linear_v(img, 10, 22, 13, 28, P["redD"], darken(P["swarm"], 0.3), radius=1.5)
    soft_linear_v(img, 19, 22, 22, 28, P["redD"], darken(P["swarm"], 0.3), radius=1.5)
    save("enemy_swarm.png", img, size, size)


# ─── PROJECTILES / FX / UI ───────────────────────────────────────────

def gen_projectile_arrow():
    w = h = 12
    img = new_canvas(w, h)
    soft_linear_v(img, 1, 4.5, 10, 7.5, P["blueL"], P["blueD"], radius=2)
    soft_radial(img, 9, 6, 3, 3.5, P["blueL"], P["blueD"])
    soft_radial(img, 4, 5.5, 3, 1.5, (255, 255, 255, 120), (255, 255, 255, 0))
    # soft glow
    soft_radial(img, 6, 6, 6, 5, P["blueL"][:3] + (60,), (0, 0, 0, 0))
    save("projectile_arrow.png", img, w, h)


def gen_projectile_cannon():
    w = h = 14
    img = new_canvas(w, h)
    soft_radial(img, 7, 7, 6, 6, P["cannonL"], P["cannonD"], power=0.8)
    soft_radial(img, 5.5, 5.5, 2.5, 2.5, P["goldL"], P["gold"])
    soft_radial(img, 7, 7, 7, 7, P["cannon"][:3] + (70,), (0, 0, 0, 0))
    save("projectile_cannon.png", img, w, h)


def gen_projectile_frost():
    w = h = 12
    img = new_canvas(w, h)
    soft_radial(img, 6, 6, 5, 5, P["frostL"], P["frostD"], power=0.75)
    soft_radial(img, 5, 5, 2, 2, P["text"], P["frostL"])
    soft_radial(img, 6, 6, 6, 6, P["frost"][:3] + (80,), (0, 0, 0, 0))
    save("projectile_frost.png", img, w, h)


def gen_fx_hit():
    w = h = 10
    img = new_canvas(w, h)
    soft_radial(img, 5, 5, 4.5, 4.5, P["goldL"], P["goldD"][:3] + (0,), power=0.7)
    soft_radial(img, 5, 5, 2.5, 2.5, P["text"], P["goldL"][:3] + (0,))
    save("fx_hit.png", img, w, h)


def gen_ui_coin():
    w = h = 16
    img = new_canvas(w, h)
    soft_radial(img, 8, 8, 7, 7, P["goldL"], P["goldD"], power=0.8)
    soft_radial(img, 6, 6, 3, 2.5, (255, 255, 255, 180), (255, 255, 255, 0))
    soft_radial(img, 8, 8, 3.5, 3.5, P["goldD"], P["gold"])
    soft_radial(img, 8, 8, 1.5, 1.5, P["shade"][:3] + (180,), P["shade"][:3] + (0,))
    save("ui_coin.png", img, w, h)


def gen_btn_play():
    w, h = 180, 56
    img = new_canvas(w, h)
    # plump rounded CTA
    soft_linear_v(img, 2, 2, 178, 54, P["blueL"], P["blueD"], radius=18)
    # inner shade
    soft_linear_v(img, 8, 8, 172, 48, lighten(P["blue"], 0.1), P["blueD"], radius=14)
    # gold rim
    rim = Image.new("RGBA", img.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    rd.rounded_rectangle([S(1), S(1), S(179), S(55)], radius=S(18), outline=P["gold"], width=S(2.5))
    rd.rounded_rectangle([S(3), S(3), S(177), S(53)], radius=S(16), outline=P["goldL"][:3] + (120,), width=S(1.2))
    img.alpha_composite(rim)
    # gloss highlight blob top
    soft_radial(img, 60, 14, 70, 14, (255, 255, 255, 110), (255, 255, 255, 0), power=0.8)
    soft_linear_v(img, 20, 6, 160, 18, (255, 255, 255, 70), (255, 255, 255, 0), radius=8)
    save("btn_play.png", img, w, h)


def overlay_handcrafted() -> None:
    """Prefer keyart-matched sprites in assets/handcrafted/ over procedural ones."""
    hand = ROOT / "assets" / "handcrafted"
    if not hand.is_dir():
        return
    for src in sorted(hand.glob("*.png")):
        for dest_dir in (OUT, PUBLIC):
            dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest_dir / src.name)
        print(f"  handcrafted → {src.name}")


def main():
    print("Generating Pixar-appeal Watchfort sprites…")
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    gen_tile_grass()
    gen_tile_path()
    gen_tile_gate()
    gen_tower_arrow()
    gen_tower_cannon()
    gen_tower_frost()
    gen_tower_barracks()
    gen_unit_soldier()
    gen_enemy_runner()
    gen_enemy_tank()
    gen_enemy_brute()
    gen_enemy_swarm()
    gen_enemy_splitter()
    gen_projectile_arrow()
    gen_projectile_cannon()
    gen_projectile_frost()
    gen_fx_hit()
    gen_ui_coin()
    gen_btn_play()
    print("Overlaying handcrafted keyart sprites…")
    overlay_handcrafted()
    print("Done → assets/ and public/assets/")


if __name__ == "__main__":
    main()
