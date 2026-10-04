"""Wallpaper balon Ballooney (2560x1440) — gaya ballooney.co.id: buket balon
latex glossy, balon foil bintang & hati, pita keriting, confetti. Tengah
dibiarkan lega untuk jam desktop & form login.

Pakai:  python3 make_ballooney_wallpapers.py <dir-output>
Render: node -e "require('sharp')('ballooney-red.svg').webp({quality:82}).toFile('bg-ballooney-red.webp')"
"""
import math
import random
import sys

W, H = 2560, 1440
RED = "#cc232a"

THEMES = {
    # Default — merah logo, balon putih/blush/emas
    "red": dict(
        bg=RED, bg2="#a81c22", glow="#e84a4f",
        balloons=["#ffffff", "#fdcdce", "#f5d27a", "#fff3f3", "#f9a6a8", "#ffffff"],
        foil=["#f5d27a", "#e7e9ee"], string="#ffffff", confetti=["#ffffff", "#f5d27a", "#fdcdce"],
    ),
    # Blush — latar pink muda (seperti slider ballooney.co.id), balon merah/emas/putih
    "blush": dict(
        bg="#f6dadb", bg2="#efc4c6", glow="#fff3f3",
        balloons=[RED, "#ffffff", "#f5d27a", "#e84a4f", "#fdcdce", RED],
        foil=["#e8b04a", "#cc232a"], string="#a81c22", confetti=[RED, "#e8b04a", "#ffffff"],
    ),
    # Pastel — krem dengan balon pastel (biru, pink, emas, merah)
    "pastel": dict(
        bg="#fbf3e6", bg2="#f3e3c8", glow="#ffffff",
        balloons=["#a9cdf0", "#f9a6a8", "#f5d27a", RED, "#c9b6ef", "#ffffff"],
        foil=["#e8b04a", "#9fb7d9"], string="#b9975b", confetti=[RED, "#a9cdf0", "#e8b04a"],
    ),
}


def shade(hex_color, f):
    """f > 0 → lebih terang (campur putih), f < 0 → lebih gelap (campur hitam)."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    if f >= 0:
        r, g, b = (round(c + (255 - c) * f) for c in (r, g, b))
    else:
        r, g, b = (round(c * (1 + f)) for c in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


class Defs:
    def __init__(self):
        self.items = []
        self.cache = {}

    def radial(self, color):
        if color in self.cache:
            return self.cache[color]
        gid = f"g{len(self.cache)}"
        self.cache[color] = gid
        self.items.append(
            f'<radialGradient id="{gid}" cx="0.36" cy="0.3" r="0.78">'
            f'<stop offset="0" stop-color="{shade(color, 0.55)}"/>'
            f'<stop offset="0.45" stop-color="{color}"/>'
            f'<stop offset="1" stop-color="{shade(color, -0.22)}"/></radialGradient>'
        )
        return gid

    def foil(self, color):
        key = "foil" + color
        if key in self.cache:
            return self.cache[key]
        gid = f"f{len(self.cache)}"
        self.cache[key] = gid
        self.items.append(
            f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{shade(color, 0.6)}"/>'
            f'<stop offset="0.35" stop-color="{color}"/>'
            f'<stop offset="0.55" stop-color="{shade(color, 0.45)}"/>'
            f'<stop offset="1" stop-color="{shade(color, -0.3)}"/></linearGradient>'
        )
        return gid


def string_path(x, y, length, sway, color, sw=3.2):
    """Tali balon keriting dari simpul ke bawah."""
    d = [f"M{x:.1f},{y:.1f}"]
    seg = length / 5
    for i in range(5):
        dx = sway if i % 2 == 0 else -sway
        d.append(f"q{dx:.1f},{seg / 2:.1f} 0,{seg:.1f}")
    return (
        f'<path d="{" ".join(d)}" fill="none" stroke="{color}" stroke-width="{sw}" '
        f'stroke-linecap="round" opacity="0.85"/>'
    )


def latex(defs, cx, cy, r, color, rot=0, string_color="#fff", string_len=260):
    """Balon latex: badan oval glossy + simpul + kilau + tali."""
    gid = defs.radial(color)
    rx, ry = r, r * 1.18
    out = [string_path(cx, cy + ry + 14, string_len, r * 0.22, string_color)]
    out.append(f'<g transform="rotate({rot} {cx} {cy})">')
    out.append(
        f'<path d="M{cx},{cy + ry} C{cx - rx * 1.02},{cy + ry * 0.62} {cx - rx * 1.08},{cy - ry * 0.98} {cx},{cy - ry} '
        f'C{cx + rx * 1.08},{cy - ry * 0.98} {cx + rx * 1.02},{cy + ry * 0.62} {cx},{cy + ry} Z" '
        f'fill="url(#{gid})" stroke="{shade(color, -0.28)}" stroke-width="1.5" stroke-opacity="0.35"/>'
    )
    # simpul
    k = r * 0.14
    out.append(
        f'<path d="M{cx - k},{cy + ry + k * 1.1} L{cx},{cy + ry - 2} L{cx + k},{cy + ry + k * 1.1} Z" '
        f'fill="{shade(color, -0.18)}"/>'
    )
    # kilau
    out.append(
        f'<ellipse cx="{cx - rx * 0.38:.1f}" cy="{cy - ry * 0.42:.1f}" rx="{rx * 0.16:.1f}" ry="{ry * 0.27:.1f}" '
        f'fill="#ffffff" opacity="0.55" transform="rotate(-24 {cx - rx * 0.38:.1f} {cy - ry * 0.42:.1f})"/>'
    )
    out.append(
        f'<circle cx="{cx - rx * 0.12:.1f}" cy="{cy - ry * 0.7:.1f}" r="{r * 0.06:.1f}" fill="#ffffff" opacity="0.6"/>'
    )
    out.append("</g>")
    return "".join(out)


def star_points(cx, cy, r, inner=0.48, rot=0):
    pts = []
    for i in range(10):
        ang = math.radians(rot + i * 36)
        rr = r if i % 2 == 0 else r * inner
        pts.append(f"{cx + rr * math.sin(ang):.1f},{cy - rr * math.cos(ang):.1f}")
    return " ".join(pts)


def star_foil(defs, cx, cy, r, color, rot=0, string_color="#fff"):
    gid = defs.foil(color)
    out = [string_path(cx, cy + r * 0.75, 240, r * 0.18, string_color, 2.6)]
    out.append(
        f'<polygon points="{star_points(cx, cy, r, 0.5, rot)}" fill="url(#{gid})" '
        f'stroke="{shade(color, -0.35)}" stroke-width="2" stroke-opacity="0.4" stroke-linejoin="round"/>'
    )
    out.append(
        f'<polygon points="{star_points(cx - r * 0.08, cy - r * 0.1, r * 0.55, 0.5, rot)}" fill="#ffffff" opacity="0.18"/>'
    )
    return "".join(out)


def heart_foil(defs, cx, cy, s, color, rot=0, string_color="#fff"):
    gid = defs.foil(color)
    p = "M0,62 C-78,10 -92,-52 -48,-74 C-22,-86 -4,-70 0,-52 C4,-70 22,-86 48,-74 C92,-52 78,10 0,62 Z"
    return (
        string_path(cx, cy + 62 * s, 240, 14 * s, string_color, 2.6)
        + f'<g transform="translate({cx},{cy}) rotate({rot}) scale({s})">'
        f'<path d="{p}" fill="url(#{gid})" stroke="{shade(color, -0.35)}" stroke-width="2" stroke-opacity="0.4"/>'
        f'<ellipse cx="-38" cy="-42" rx="12" ry="22" fill="#fff" opacity="0.45" transform="rotate(-30 -38 -42)"/></g>'
    )


def confetti(rnd, colors, n, avoid):
    out = []
    x0, y0, x1, y1 = avoid
    for _ in range(n):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        inside = x0 < x < x1 and y0 < y < y1
        if inside and rnd.random() < 0.8:
            continue
        c = rnd.choice(colors)
        op = 0.35 if inside else 0.8
        kind = rnd.random()
        rot = rnd.uniform(0, 180)
        if kind < 0.45:
            w, h = rnd.uniform(8, 16), rnd.uniform(18, 30)
            out.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" rx="3" fill="{c}" opacity="{op}" transform="rotate({rot:.0f} {x:.0f} {y:.0f})"/>')
        elif kind < 0.8:
            out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.uniform(4, 9):.1f}" fill="{c}" opacity="{op}"/>')
        else:
            out.append(f'<path d="M{x:.0f},{y:.0f} q12,-14 24,0 t24,0" fill="none" stroke="{c}" stroke-width="5" stroke-linecap="round" opacity="{op}" transform="rotate({rot:.0f} {x:.0f} {y:.0f})"/>')
    return out


def cluster(defs, rnd, t, cx, cy, spec, scale=1.0):
    """Buket balon: spec = [(dx, dy, r, rot)], warna diambil bergiliran."""
    out = []
    for i, (dx, dy, r, rot) in enumerate(spec):
        color = t["balloons"][(i + int(cx)) % len(t["balloons"])]
        out.append(latex(defs, cx + dx * scale, cy + dy * scale, r * scale, color, rot, t["string"], 220 + rnd.uniform(0, 160)))
    return out


def build(name):
    t = THEMES[name]
    rnd = random.Random(2016)  # "Delivering Happiness Since 2016"
    defs = Defs()
    body = []
    # Latar + cahaya lembut di tengah
    body.append(f'<rect width="{W}" height="{H}" fill="{t["bg"]}"/>')
    defs.items.append(
        f'<radialGradient id="glow" cx="0.5" cy="0.45" r="0.6">'
        f'<stop offset="0" stop-color="{t["glow"]}" stop-opacity="0.55"/>'
        f'<stop offset="1" stop-color="{t["glow"]}" stop-opacity="0"/></radialGradient>'
    )
    body.append(f'<rect width="{W}" height="{H}" fill="url(#glow)"/>')
    # Bidang organik di pojok (gaya banner)
    body.append(f'<path d="M-60,1500 L-60,980 C120,1010 260,1130 300,1260 C330,1360 420,1420 520,1500 Z" fill="{t["bg2"]}"/>')
    body.append(f'<path d="M2620,-60 L2000,-60 C2060,90 2200,170 2360,180 C2480,188 2560,250 2620,300 Z" fill="{t["bg2"]}"/>')
    body.extend(confetti(rnd, t["confetti"], 260, (760, 260, 1800, 1180)))

    # Buket kiri bawah & kanan atas — tali menjuntai ke luar bidang
    left = [(-40, 0, 128, -8), (110, -90, 112, 6), (230, 30, 120, 10), (40, 140, 104, -4), (-150, 120, 96, -14), (190, 200, 92, 12)]
    right = [(0, 0, 126, 6), (-150, -60, 108, -10), (120, -120, 104, 12), (-60, 150, 112, -6), (150, 110, 96, 8), (-250, 90, 88, -12)]
    body.extend(cluster(defs, rnd, t, 260, 760, left))
    body.extend(cluster(defs, rnd, t, 2300, 300, right))
    # Buket kecil kanan bawah & kiri atas
    body.extend(cluster(defs, rnd, t, 2240, 1060, [(0, 0, 84, 8), (110, -40, 72, 14), (60, 90, 68, -6)]))
    body.extend(cluster(defs, rnd, t, 320, 150, [(0, 0, 70, -10), (-100, 40, 60, 6), (90, 60, 58, 12)]))

    # Balon foil bintang & hati
    body.append(star_foil(defs, 620, 430, 92, t["foil"][0], 12, t["string"]))
    body.append(star_foil(defs, 1990, 760, 70, t["foil"][1], -10, t["string"]))
    body.append(star_foil(defs, 2480, 640, 52, t["foil"][0], 20, t["string"]))
    body.append(heart_foil(defs, 1960, 210, 1.15, t["foil"][1] if name != "red" else "#ffffff", 10, t["string"]))
    body.append(heart_foil(defs, 640, 1180, 0.95, t["foil"][0], -12, t["string"]))

    # Balon kecil melayang (jauh dari tengah)
    for (x, y, r) in [(1180, 110, 40), (1500, 1330, 46), (940, 1300, 34), (1720, 90, 30), (110, 1180, 44), (2480, 1320, 38)]:
        color = rnd.choice(t["balloons"])
        body.append(latex(defs, x, y, r, color, rnd.uniform(-14, 14), t["string"], 120))

    return "\n".join(
        [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         "<defs>", *defs.items, "</defs>", *body, "</svg>"]
    )


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    for n in THEMES:
        with open(f"{out}/ballooney-{n}.svg", "w") as fh:
            fh.write(build(n))
        print("ok", n)
