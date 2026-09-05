# The notebook design system

The whole site is one artifact: a student's FRC build binder, photocopied and
taped to a wall. Graph paper ground, hand-ruled boxes, kraft tape, mono part
slugs, ballpoint annotations in the margin. Every page obeys this, no
exceptions and no second visual language anywhere.

Reference implementation: `~/learnfrc-redesign/d12.html`. Read it before
building. It is the approved direction, not a suggestion.

## Palette, six values and nothing else

    --paper     #E6E8E3   cool grey newsprint, the page ground
    --card      #F5F6F2   fresh index-card stock, every raised surface
    --ink       #16181B   marker black, all primary type and every border
    --graphite  #565C60   pencil grey, secondary type only
    --blue      #1B36C8   ballpoint blue, THE single accent
    --kraft     #C4A77D   packing tape, decorative only, NEVER carries text

Derived: `--rule` is `rgba(22,24,27,.30)` for the inner hairline, `--grid` is
`rgba(27,54,200,.055)` for the graph ruling.

This is newsprint, not cream. Do not warm it up. Warm cream plus terracotta is
the AI-default palette and it is banned here.

Blue is the only colour that ever means "you can click this". Department
accents do NOT get their own hues: a department is identified by its name and
its mono slug, not by a colour chip. `--kraft` is tape and nothing else.

## Type, three faces with fixed jobs

- Bricolage Grotesque, variable, `opsz,wdth,wght@12..96,75..100,200..800`.
  Everything structural: headings at 800 and `letter-spacing:-.025em`, body at
  400. Body `font-variation-settings:"wdth" 100,"opsz" 14`.
- Space Mono, 400 and 700. All data furniture: lesson counts, department slugs
  (`dept / programming-software`), timestamps, table figures, form hints, code.
  If it is a number or an identifier, it is Space Mono.
- Caveat, 500 and 600, in `--blue`. Margin annotations only, the handwriting a
  student adds after the fact. Never a heading, never a label, never a control.
  At most one or two per screen or the joke dies.

Headings get `text-wrap:balance`. Running text stops near 65 characters.

## The hand-ruled box

The one container primitive. A 2px ink border with an irregular radius, plus a
second inset hairline at a DIFFERENT irregular radius, which is what sells the
hand-drawn look:

    --hand-a: 250px 14px 235px 16px / 16px 230px 14px 250px;
    --hand-b: 232px 18px 250px 12px / 14px 242px 18px 236px;
    --hand-s: 120px 8px 110px 9px / 9px 112px 8px 120px;   /* small controls */

    .nb-box { position:relative; border:2px solid var(--ink);
              border-radius:var(--hand-a); background:var(--card); }
    .nb-box::after { content:""; position:absolute; inset:3px;
              border:1px solid var(--rule); border-radius:var(--hand-b);
              pointer-events:none; }

One radius system, no others. No `rounded-lg`, no perfect circles except
avatars, no drop shadows in the CSS sense. Depth comes from the double rule and
from tape, never from a blur.

## Ground and grain

Body: `--paper` plus 23px graph ruling from two 1px linear-gradients in
`--grid`. A fixed `body::after` overlay carries an SVG fractal-noise
photocopier grain at `opacity:.5`, `mix-blend-mode:multiply`,
`pointer-events:none`, `z-index:90`. The grain sits over everything so the ink
overprints. Copy the exact data URI from d12.html.

## Kraft tape

    .nb-tape { position:absolute; width:88px; height:24px;
      background:var(--kraft); opacity:.82;
      clip-path:polygon(3% 12%,97% 0%,100% 88%,6% 100%,0% 46%); }

Rotate each piece a few degrees, never the same angle twice on one screen. Tape
holds a card down, so it overlaps the card's edge. It is decoration: it must
never sit under text and never be the only thing marking a state.

## Motion

Deliberately sparse. A taped card straightens and lifts on hover, `rotate(0)`
plus a 2 to 3px rise, 180ms on `cubic-bezier(.2,.9,.3,1)`. Nothing loops,
nothing breathes, nothing floats idle. Honour `prefers-reduced-motion` by
zeroing durations, and every entrance animation must land at its END state so
content is never left invisible.

## Voice

The binder was written by one high-school student who has actually done the
thing. Plain, specific, a little dry. Name the real failure, not the abstraction:
"the robot has no code on the driver station", not "connectivity issues".

NEVER use em dashes. Use a comma, a colon, the word "like", or two sentences.
Contractions are fine. Bullets use "-". No flowery language.

## Hard rules

- Every text and background pair meets WCAG AA, 4.5:1 body and 3:1 large.
  `--graphite` on `--card` passes; do not lighten it further.
- Focus is always visible: 2px `--blue` outline, 2px offset.
- Touch targets 44px minimum.
- Single theme. There is no dark mode, do not add one.
- `min-height:100dvh`, never `100vh`.
- No horizontal scroll at any width. Wide content scrolls inside its own
  `overflow-x:auto` container.
- No external images. Everything is CSS, type and SVG.
- Server Components by default. `"use client"` only on a leaf that genuinely
  needs state, and never on a page shell.

## Nothing from the old site survives

The previous design was "Arena Clay 2": a light liquid-glass and clay system,
blue-tinted `#e6eefb` ground, `ac-*` skin classes, Baloo 2 and Space Grotesk
and Inter and JetBrains Mono. All of it is deleted, not deprecated, not
aliased, not kept for compatibility.

These must return ZERO matches across `src/` when the work is done:

    ac-card  ac-glass  ac-tile  ac-badge  ac-chip  ac-btn  ac-btn-ghost
    ac-input  ac-eyebrow  ac-divider  ac-route  ac-level-ring
    --font-baloo  --font-grotesk  --font-inter  --font-jbmono
    Baloo_2  Space_Grotesk  JetBrains_Mono  arena  clay  liquid-glass
    #e6eefb  #2560e6  #1aa9d6  #d64b8a  --glow-primary  --glow-accent

Do not port an old component by swapping its classes. Delete its markup and
author the page again from the content up: what is this page for, what does a
person do here, how does that read as a page in the binder. If a rebuilt page
happens to land on a similar layout, that is fine, but it must be arrived at,
not inherited.

What is NOT being redesigned: routes and their URLs, data fetching, server
actions, auth gates, Supabase queries, redirects, metadata generation, and any
`src/lib` logic. Behaviour stays identical. Only the presentation is new.
