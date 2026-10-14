#!/usr/bin/env python3
"""Generate the app's design tokens from the website's CSS.

    python3 apple/scripts/gen-tokens.py            # write the Swift file and sync the colour sets
    python3 apple/scripts/gen-tokens.py --check    # exit 1 if either is out of date (for CI)

Reads `src/app/globals.css` (the notebook system's single source of truth) and writes:

  - `apple/LearnFRC/Design/Tokens.generated.swift`: palette, hand radii, offset drops,
    motion curves and durations, tape, tilts and a few layout numbers, as Swift constants.
    `LF.Palette` takes its light values from here, so the app follows the site.
  - The "any appearance" (light) value of each colour set in
    `apple/LearnFRC/Resources/Assets.xcassets/Notebook/*.colorset` and `AccentColor`, so the
    asset catalog agrees with the CSS too. Dark and high-contrast values in those colour sets
    are app-only decisions and are never touched by this script.

The website has no dark mode, so nothing dark is read from the CSS. Standard library only.
"""
import argparse, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APPLE = os.path.normpath(os.path.join(HERE, ".."))
REPO = os.path.normpath(os.path.join(APPLE, ".."))
CSS = os.path.join(REPO, "src", "app", "globals.css")
SWIFT_OUT = os.path.join(APPLE, "LearnFRC", "Design", "Tokens.generated.swift")
ASSETS = os.path.join(APPLE, "LearnFRC", "Resources", "Assets.xcassets")

REM = 16.0  # 1rem = 16px = 16pt


class TokenError(Exception):
    pass


# ---------------------------------------------------------------- CSS reading

def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def block(css, selector):
    """Declarations of the first rule whose selector list is exactly `selector`."""
    pattern = re.compile(r"(^|[}\s;])" + re.escape(selector) + r"\s*\{([^{}]*)\}", re.M)
    m = pattern.search(css)
    if not m:
        raise TokenError(f"no `{selector} {{ ... }}` rule in globals.css")
    return declarations(m.group(2))


def declarations(body):
    out = {}
    for part in body.split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = " ".join(v.split())
    return out


def need(decls, key, where):
    if key not in decls:
        raise TokenError(f"`{key}` is missing from `{where}` in globals.css")
    return decls[key]


def resolve(value, root, depth=0):
    if depth > 8:
        raise TokenError(f"var() loop resolving {value}")
    def sub(m):
        name, fallback = m.group(1), m.group(2)
        if name in root:
            return resolve(root[name], root, depth + 1)
        if fallback is not None:
            return fallback.strip()
        raise TokenError(f"var({name}) is not defined in :root")
    return re.sub(r"var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)", sub, value)


def color(value):
    """#RRGGBB / #RGB / rgb[a](r, g, b[, a]) -> (r, g, b, a) floats 0...1."""
    v = value.strip()
    m = re.fullmatch(r"#([0-9a-fA-F]{6})", v)
    if m:
        h = m.group(1)
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)
    m = re.fullmatch(r"#([0-9a-fA-F]{3})", v)
    if m:
        return tuple(int(c * 2, 16) / 255 for c in m.group(1)) + (1.0,)
    m = re.fullmatch(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)", v)
    if m:
        r, g, b = (float(m.group(i)) / 255 for i in (1, 2, 3))
        return (r, g, b, float(m.group(4)) if m.group(4) else 1.0)
    raise TokenError(f"can't read the colour `{value}`")


def px(value):
    v = value.strip()
    if v in ("0", "0px"):
        return 0.0
    m = re.fullmatch(r"(-?[\d.]+)(px|rem)", v)
    if not m:
        raise TokenError(f"expected a px or rem length, got `{value}`")
    n = float(m.group(1))
    return n * REM if m.group(2) == "rem" else n


def ms(value):
    m = re.fullmatch(r"([\d.]+)(ms|s)", value.strip())
    if not m:
        raise TokenError(f"expected a duration, got `{value}`")
    n = float(m.group(1))
    return n / 1000 if m.group(2) == "ms" else n


def bezier(value):
    m = re.fullmatch(r"cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)", value.strip())
    if not m:
        raise TokenError(f"expected cubic-bezier(...), got `{value}`")
    return tuple(float(m.group(i)) for i in range(1, 5))


def hand_radius(value):
    """`h1 h2 h3 h4 / v1 v2 v3 v4` (TL TR BR BL) -> [(h, v)] * 4."""
    if "/" not in value:
        raise TokenError(f"hand radius `{value}` needs the elliptical `h / v` form")
    hs, vs = (side.split() for side in value.split("/"))
    if len(hs) != 4 or len(vs) != 4:
        raise TokenError(f"hand radius `{value}` must have four horizontal and four vertical radii")
    return [(px(h), px(v)) for h, v in zip(hs, vs)]


def drop(value):
    parts = value.split(None, 3)
    if len(parts) != 4:
        raise TokenError(f"expected `x y blur colour`, got `{value}`")
    x, y, blur = (px(p) for p in parts[:3])
    if blur != 0:
        raise TokenError(f"drops are never blurred, but `{value}` has a blur")
    return x, y, color(parts[3])


def degrees(value):
    m = re.search(r"rotate\(\s*(-?[\d.]+)deg\s*\)", value)
    if not m:
        raise TokenError(f"expected rotate(...deg), got `{value}`")
    return float(m.group(1))


def keyframe(css, name):
    m = re.search(r"@keyframes\s+" + re.escape(name) + r"\s*\{(.*?)\}\s*\}", css, re.S)
    if not m:
        raise TokenError(f"no @keyframes {name}")
    frm = re.search(r"from\s*\{([^}]*)", m.group(1))
    if not frm:
        raise TokenError(f"@keyframes {name} has no `from` frame")
    return declarations(frm.group(1))


# ---------------------------------------------------------------- reading the tokens

def read_tokens(css_text):
    css = strip_comments(css_text)
    root = block(css, ":root")
    R = lambda k: resolve(need(root, k, ":root"), root)

    t = {}
    t["palette"] = {name: color(R("--" + name)) for name in
                    ("paper", "card", "ink", "graphite", "blue", "kraft", "rule", "grid")}
    t["hand"] = {k: hand_radius(R("--hand-" + k)) for k in ("a", "b", "s")}
    t["drops"] = {
        "drop1": drop(R("--drop-1")),
        "drop2": drop(R("--drop-2")),
        "dropInk": drop(R("--drop-ink")),
        "ghost": drop(resolve(need(block(css, ".nb-btn-ghost"), "box-shadow", ".nb-btn-ghost"), root)),
    }
    t["ease"] = {k: bezier(R("--nb-ease-" + k)) for k in ("out", "move", "draw")}
    t["duration"] = {k: ms(R("--nb-t-" + k)) for k in ("press", "hover", "lift", "enter", "draw")}
    t["tap"] = px(R("--tap"))

    body = block(css, "body")
    size = need(body, "background-size", "body").split()
    t["grid_step"] = px(size[0])

    tape = block(css, ".nb-tape")
    clip = need(tape, "clip-path", ".nb-tape")
    pts = re.findall(r"(-?[\d.]+)%\s+(-?[\d.]+)%", clip)
    if len(pts) < 3:
        raise TokenError(f"can't read the tape polygon `{clip}`")
    t["tape"] = {
        "width": px(need(tape, "width", ".nb-tape")),
        "height": px(need(tape, "height", ".nb-tape")),
        "opacity": float(need(tape, "opacity", ".nb-tape")),
        "polygon": [(float(x) / 100, float(y) / 100) for x, y in pts],
    }

    tilt = block(css, ".nb-tilt")
    m = re.search(r"var\(--tilt,\s*(-?[\d.]+)deg\)", need(tilt, "transform", ".nb-tilt"))
    if not m:
        raise TokenError("can't read the default .nb-tilt angle")
    t["tilt_default"] = float(m.group(1))
    t["tilt_presets"] = [degrees(need(block(css, f".nb-tilt-{i}"), "transform", f".nb-tilt-{i}")) for i in range(1, 5)]
    t["brand_tilt"] = degrees(need(block(css, ".nb-brand b"), "transform", ".nb-brand b"))

    m = re.search(r"translateY\(\s*(-?[\d.]+)px\s*\)", need(block(css, ".nb-lift:focus-visible"), "transform", ".nb-lift:focus-visible"))
    if not m:
        raise TokenError("can't read the .nb-lift rise")
    t["lift_rise"] = -float(m.group(1))

    m = re.search(r"translate\(\s*([\d.]+)px", need(block(css, ".nb-btn:active"), "transform", ".nb-btn:active"))
    if not m:
        raise TokenError("can't read the .nb-btn press travel")
    t["press_travel"] = float(m.group(1))

    settle = keyframe(css, "nb-settle")
    straighten = keyframe(css, "nb-straighten")
    ink = keyframe(css, "nb-ink")
    t["settle_rise"] = px(need(settle, "translate", "nb-settle").split()[1])
    t["straighten_angle"] = float(need(straighten, "rotate", "nb-straighten").replace("deg", ""))
    t["straighten_rise"] = px(need(straighten, "translate", "nb-straighten").split()[1])
    t["ink_drop"] = px(need(ink, "translate", "nb-ink").split()[1])
    t["ink_scale"] = float(need(ink, "scale", "nb-ink"))

    # The blue washes the kit uses, as alphas of --blue.
    def wash(selector, prop):
        c = color(resolve(need(block(css, selector), prop, selector), root))
        return c[3]
    t["washes"] = {
        "row": wash(".nb-row:focus-visible", "background"),
        "ghostHover": wash(".nb-btn-ghost:hover", "background"),
        "menu": menu_wash(css, root),
        "selection": wash("::selection", "background"),
    }
    return t


def menu_wash(css, root):
    m = re.search(r"\.nb-menu-item\[aria-selected=\"true\"\]\s*\{([^}]*)\}", css)
    if not m:
        raise TokenError("no highlighted .nb-menu-item rule")
    return color(resolve(need(declarations(m.group(1)), "background", ".nb-menu-item"), root))[3]


# ---------------------------------------------------------------- Swift output

def f(n):
    s = f"{n:.4f}".rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


def rgba(c):
    return f"RGBA(red: {f(c[0])}, green: {f(c[1])}, blue: {f(c[2])}, alpha: {f(c[3])})"


def hexa(c):
    s = "#" + "".join(f"{round(x * 255):02X}" for x in c[:3])
    return s if c[3] == 1 else f"{s} at {f(c[3])}"


def swift(t, digest):
    P, H, D = t["palette"], t["hand"], t["drops"]
    L = []
    w = L.append
    w("// Generated by apple/scripts/gen-tokens.py from src/app/globals.css. Don't edit by hand:")
    w("// change the CSS, then run `python3 apple/scripts/gen-tokens.py`.")
    w(f"// globals.css sha256 {digest}")
    w("")
    w("import CoreGraphics")
    w("")
    w("/// The website's notebook tokens, exactly as `src/app/globals.css` declares them.")
    w("/// Views use `LF.*`; this is the raw material `LF` is built from.")
    w("nonisolated enum SiteTokens {")
    w("    struct RGBA: Sendable, Hashable {")
    w("        let red, green, blue, alpha: Double")
    w("    }")
    w("    /// One elliptical corner: `h` is the horizontal radius, `v` the vertical one.")
    w("    struct Corner: Sendable, Hashable {")
    w("        let h, v: CGFloat")
    w("    }")
    w("    /// CSS `border-radius` order: top-left, top-right, bottom-right, bottom-left.")
    w("    struct HandRadii: Sendable, Hashable {")
    w("        let topLeft, topRight, bottomRight, bottomLeft: Corner")
    w("    }")
    w("    /// A hard offset drop (`x y 0 colour`). The site never blurs one.")
    w("    struct Drop: Sendable, Hashable {")
    w("        let x, y: CGFloat")
    w("        let color: RGBA")
    w("    }")
    w("    struct Curve: Sendable, Hashable {")
    w("        let x1, y1, x2, y2: Double")
    w("    }")
    w("")
    w("    /// The six palette values plus the two derived ones (`--rule`, `--grid`).")
    w("    enum Palette {")
    for k in ("paper", "card", "ink", "graphite", "blue", "kraft", "rule", "grid"):
        w(f"        /// `--{k}` {hexa(P[k])}")
        w(f"        static let {k} = {rgba(P[k])}")
    w("    }")
    w("")
    w("    /// `--hand-a` (box outline), `--hand-b` (inner hairline), `--hand-s` (small controls).")
    w("    enum Hand {")
    for k in ("a", "b", "s"):
        c = H[k]
        corners = ", ".join(f"{lbl}: Corner(h: {f(h)}, v: {f(v)})" for lbl, (h, v) in
                            zip(("topLeft", "topRight", "bottomRight", "bottomLeft"), c))
        w(f"        static let {k} = HandRadii({corners})")
    w("    }")
    w("")
    w("    /// `--drop-1` (card at rest), `--drop-2` (card lifted), `--drop-ink` (primary button,")
    w("    /// surfaces), and the ghost button's drop.")
    w("    enum Drops {")
    for k in ("drop1", "drop2", "dropInk", "ghost"):
        x, y, c = D[k]
        w(f"        static let {k} = Drop(x: {f(x)}, y: {f(y)}, color: {rgba(c)})")
    w("    }")
    w("")
    w("    /// `--nb-ease-out` (anything a person triggers), `--nb-ease-move` (something on screen")
    w("    /// travelling A to B), `--nb-ease-draw` (a stroke leaving a pen).")
    w("    enum Ease {")
    for k in ("out", "move", "draw"):
        a = t["ease"][k]
        w(f"        static let {k} = Curve(x1: {f(a[0])}, y1: {f(a[1])}, x2: {f(a[2])}, y2: {f(a[3])})")
    w("    }")
    w("")
    w("    /// `--nb-t-*`, in seconds.")
    w("    enum Duration {")
    for k in ("press", "hover", "lift", "enter", "draw"):
        w(f"        static let {k}: Double = {f(t['duration'][k])}")
    w("    }")
    w("")
    w("    /// Travel distances and angles from the kit's motions and keyframes.")
    w("    enum Movement {")
    w(f"        /// `.nb-lift`: a card rises this far when it lifts.")
    w(f"        static let liftRise: CGFloat = {f(t['lift_rise'])}")
    w(f"        /// `.nb-btn:active`: a button travels this far into its drop.")
    w(f"        static let pressTravel: CGFloat = {f(t['press_travel'])}")
    w(f"        /// `nb-settle`: an arriving band starts this far low.")
    w(f"        static let settleRise: CGFloat = {f(t['settle_rise'])}")
    w(f"        /// `nb-straighten`: a taped card arrives this crooked and this far low.")
    w(f"        static let straightenAngle: Double = {f(t['straighten_angle'])}")
    w(f"        static let straightenRise: CGFloat = {f(t['straighten_rise'])}")
    w(f"        /// `nb-ink`: a stamp lands from this far up, at this scale.")
    w(f"        static let inkDrop: CGFloat = {f(t['ink_drop'])}")
    w(f"        static let inkScale: CGFloat = {f(t['ink_scale'])}")
    w("    }")
    w("")
    w("    /// `.nb-tilt` and its four presets, in degrees.")
    w("    enum Tilt {")
    w(f"        static let standard: Double = {f(t['tilt_default'])}")
    w(f"        static let presets: [Double] = [{', '.join(f(x) for x in t['tilt_presets'])}]")
    w(f"        /// `.nb-brand b`, the boxed FRC in the logotype.")
    w(f"        static let brand: Double = {f(t['brand_tilt'])}")
    w("    }")
    w("")
    w("    /// `.nb-tape`. The polygon is the clip-path, as fractions of the strip's size.")
    w("    enum Tape {")
    tp = t["tape"]
    w(f"        static let width: CGFloat = {f(tp['width'])}")
    w(f"        static let height: CGFloat = {f(tp['height'])}")
    w(f"        static let opacity: Double = {f(tp['opacity'])}")
    pts = ", ".join(f"CGPoint(x: {f(x)}, y: {f(y)})" for x, y in tp["polygon"])
    w(f"        static let polygon: [CGPoint] = [{pts}]")
    w("    }")
    w("")
    w("    /// Alphas of `--blue` the kit uses as washes.")
    w("    enum Wash {")
    for k, v in t["washes"].items():
        w(f"        static let {k}: Double = {f(v)}")
    w("    }")
    w("")
    w("    enum Layout {")
    w(f"        /// `--tap`, the minimum touch target.")
    w(f"        static let tap: CGFloat = {f(t['tap'])}")
    w(f"        /// The graph-paper ruling on `body` (`background-size`).")
    w(f"        static let gridStep: CGFloat = {f(t['grid_step'])}")
    w("    }")
    w("}")
    return "\n".join(L) + "\n"


# ---------------------------------------------------------------- colour sets

# colour set -> (palette token, alpha override)
COLORSETS = {
    "Notebook/Paper.colorset": "paper",
    "Notebook/Card.colorset": "card",
    "Notebook/Ink.colorset": "ink",
    "Notebook/Graphite.colorset": "graphite",
    "Notebook/Blue.colorset": "blue",
    "Notebook/BlueButton.colorset": "blue",
    "Notebook/OnBlue.colorset": "card",
    "Notebook/Kraft.colorset": "kraft",
    "Notebook/Rule.colorset": "rule",
    "Notebook/Grid.colorset": "grid",
    "AccentColor.colorset": "blue",
}


def components(c):
    return {"red": f"{c[0]:.3f}", "green": f"{c[1]:.3f}", "blue": f"{c[2]:.3f}", "alpha": f"{c[3]:.3f}"}


def synced_colorsets(t):
    """Returns {path: new json text} for colour sets whose light value changed."""
    out = {}
    for rel, token in COLORSETS.items():
        path = os.path.join(ASSETS, rel, "Contents.json")
        if not os.path.exists(path):
            raise TokenError(f"missing colour set {rel}")
        with open(path) as fh:
            text = fh.read()
        data = json.loads(text)
        light = [e for e in data.get("colors", []) if not e.get("appearances")]
        if len(light) != 1:
            raise TokenError(f"{rel} needs exactly one any-appearance entry")
        light[0]["color"] = {"color-space": "srgb", "components": components(t["palette"][token])}
        new = json.dumps(data, indent=2, separators=(",", " : ")) + "\n"
        if new != text:
            out[path] = new
    return out


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--check", action="store_true", help="fail if anything is out of date, write nothing")
    ap.add_argument("--css", default=CSS)
    args = ap.parse_args()

    with open(args.css, encoding="utf-8") as fh:
        css_text = fh.read()
    try:
        tokens = read_tokens(css_text)
        digest = hashlib.sha256(css_text.encode()).hexdigest()[:16]
        swift_text = swift(tokens, digest)
        colorsets = synced_colorsets(tokens)
    except TokenError as e:
        print(f"gen-tokens: {e}", file=sys.stderr)
        return 2

    current = open(SWIFT_OUT).read() if os.path.exists(SWIFT_OUT) else ""
    # The digest line changes with any CSS edit; compare the rest so --check only
    # fails when a token actually moved.
    strip = lambda s: re.sub(r"^// globals.css sha256 .*$", "", s, flags=re.M)
    swift_stale = strip(current) != strip(swift_text)

    if args.check:
        stale = ([SWIFT_OUT] if swift_stale else []) + list(colorsets)
        for p in stale:
            print(f"out of date: {os.path.relpath(p, REPO)}")
        return 1 if stale else 0

    if swift_stale or current != swift_text:
        os.makedirs(os.path.dirname(SWIFT_OUT), exist_ok=True)
        with open(SWIFT_OUT, "w", encoding="utf-8") as fh:
            fh.write(swift_text)
        print(f"wrote {os.path.relpath(SWIFT_OUT, REPO)}")
    else:
        print(f"up to date: {os.path.relpath(SWIFT_OUT, REPO)}")
    for path, text in colorsets.items():
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"synced {os.path.relpath(path, REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
