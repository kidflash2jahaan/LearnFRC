import { ImageResponse } from "next/og";
import { ogFonts, OG_DISPLAY, OG_MONO } from "@/app/_og/font";

export const alt = "LearnFRC profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#E6E8E3";
const CARD = "#F5F6F2";
const INK = "#16181B";
const GRAPHITE = "#565C60";
const BLUE = "#1B36C8";
const KRAFT = "#C4A77D";
const RULE = "rgba(22,24,27,0.30)";
const GRID = "rgba(27,54,200,0.055)";

/**
 * Somebody's record sheet, as a link preview.
 *
 * The page itself is one drawn card carrying the handle and a stamped rank, so
 * the card is what a share of it should look like. What the old preview did
 * instead was a blue-to-cyan gradient wordmark on a pale blue wash with a
 * radial glow bleeding off the corner, which is three effects from a visual
 * language the site no longer speaks.
 *
 * TWO THINGS SATORI CANNOT DO, so they are built by hand:
 *  - The 23px graph ruling. There is no repeating background, so the grid is
 *    drawn as absolutely positioned 1px divs. It is what makes the card read as
 *    paper at thumbnail size, which is the only size this is ever seen at.
 *  - The torn tape. There is no clip-path, so the strip is a plain kraft
 *    rectangle rotated a few degrees, and it has to be the LAST child: Satori
 *    paints siblings in document order, so a strip declared before the card
 *    would simply disappear behind it.
 *
 * The eight-value elliptical radius is unsupported too, but the four-value
 * corner shorthand is, and a big corner opposite a tight one is what makes a
 * box read as ruled by hand rather than as a rounded rectangle.
 *
 * Every element with children carries `display: flex`, because Satori has no
 * block layout and silently drops what it cannot lay out.
 *
 * Data fetching is untouched: same service-role read, same three-column
 * allow-list, same 3s abort, same fall back to the bare handle.
 */

const COLS = Math.ceil(size.width / 23);
const ROWS = Math.ceil(size.height / 23);

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let name = username;
  let team: number | null = null;
  let xp = 0;
  try {
    // Service-role, not the anon key: `profiles` is no longer SELECTable by the
    // anon API role, and this card has to render for logged-out visitors and
    // link-unfurling crawlers. Only the three fields the card actually paints
    // are requested. The key bypasses RLS and column grants, so this list IS
    // the access control. Never `select("*")`, never `full_name`.
    //
    // The 3s abort stays: a slow database must degrade to the generic card, not
    // stall OG generation.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(
      `${url}/rest/v1/profiles?username=eq.${encodeURIComponent(
        username
      )}&select=username,team_number,xp`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: ctrl.signal,
      }
    ).finally(() => clearTimeout(timer));
    const rows = await res.json();
    const p = Array.isArray(rows) ? rows[0] : null;
    if (p) {
      name = p.username || username;
      team = p.team_number ?? null;
      xp = p.xp ?? 0;
    }
  } catch {
    /* fall back to defaults */
  }

  const level = Math.floor(xp / 100) + 1;
  const fonts = await ogFonts();

  // A long handle would otherwise run off the sheet. Satori has no ellipsis, so
  // the type steps down instead of overflowing.
  const handle = `@${name}`;
  const handleSize = handle.length > 20 ? 54 : handle.length > 14 ? 68 : 84;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: PAPER,
          fontFamily: OG_DISPLAY,
          color: INK,
        }}
      >
        {/* graph ruling */}
        {Array.from({ length: COLS }, (_, i) => (
          <div
            key={`c${i}`}
            style={{
              position: "absolute",
              left: i * 23,
              top: 0,
              width: 1,
              height: size.height,
              background: GRID,
            }}
          />
        ))}
        {Array.from({ length: ROWS }, (_, i) => (
          <div
            key={`r${i}`}
            style={{
              position: "absolute",
              left: 0,
              top: i * 23,
              width: size.width,
              height: 1,
              background: GRID,
            }}
          />
        ))}

        {/* the record sheet */}
        <div
          style={{
            position: "absolute",
            left: 54,
            top: 52,
            width: size.width - 108,
            height: size.height - 104,
            display: "flex",
            flexDirection: "column",
            padding: "44px 56px",
            background: CARD,
            border: `2px solid ${INK}`,
            borderRadius: "34px 10px 30px 12px",
            transform: "rotate(-0.7deg)",
          }}
        >
          {/* the inset hairline that sells the hand-ruled box */}
          <div
            style={{
              position: "absolute",
              left: 3,
              top: 3,
              right: 3,
              bottom: 3,
              border: `1px solid ${RULE}`,
              borderRadius: "30px 8px 26px 10px",
              display: "flex",
            }}
          />

          {/* the header rule: the logotype, and what this sheet is */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 20,
              borderBottom: `1px dashed ${RULE}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.04em",
              }}
            >
              <span>learn</span>
              <span
                style={{
                  marginLeft: 5,
                  padding: "1px 9px 4px",
                  color: BLUE,
                  border: `3px solid ${BLUE}`,
                  borderRadius: "12px 4px 10px 5px",
                  transform: "rotate(-1.4deg)",
                  display: "flex",
                }}
              >
                FRC
              </span>
            </div>

            <div
              style={{
                display: "flex",
                fontFamily: OG_MONO,
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: "0.05em",
                color: GRAPHITE,
              }}
            >
              record of work
            </div>
          </div>

          {/* the handle, and the rank stamped beside it */}
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "space-between",
              gap: 40,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: handleSize,
                  fontWeight: 800,
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                }}
              >
                {handle}
              </div>

              {team !== null && (
                <div
                  style={{
                    display: "flex",
                    marginTop: 22,
                    padding: "7px 16px 9px",
                    alignSelf: "flex-start",
                    fontFamily: OG_MONO,
                    fontSize: 21,
                    color: INK,
                    border: `2px solid ${INK}`,
                    borderRadius: "14px 5px 12px 6px",
                  }}
                >
                  {`Team ${team}`}
                </div>
              )}
            </div>

            {/* the level, stamped in its own small drawn card */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "22px 34px 24px",
                border: `2px solid ${INK}`,
                borderRadius: "18px 6px 16px 7px",
                transform: "rotate(0.9deg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontFamily: OG_MONO,
                  fontWeight: 700,
                  fontSize: 88,
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  color: BLUE,
                }}
              >
                {level.toLocaleString("en-US")}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: `1px solid ${RULE}`,
                  fontFamily: OG_MONO,
                  fontSize: 19,
                  letterSpacing: "0.06em",
                  color: GRAPHITE,
                }}
              >
                level
              </div>
            </div>
          </div>

          {/* the mono slug line, ruled off */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingTop: 20,
              borderTop: `1px dashed ${RULE}`,
              fontFamily: OG_MONO,
              fontWeight: 700,
              fontSize: 22,
              color: GRAPHITE,
            }}
          >
            <span style={{ color: INK }}>
              {`${xp.toLocaleString("en-US")} xp`}
            </span>
            <span style={{ margin: "0 14px" }}>/</span>
            <span>learnfrc.com</span>
          </div>
        </div>

        {/* the tape, over the sheet's top edge. Last child, so it paints on top. */}
        <div
          style={{
            position: "absolute",
            left: 760,
            top: 30,
            width: 168,
            height: 44,
            background: KRAFT,
            opacity: 0.82,
            transform: "rotate(2.6deg)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size, fonts }
  );
}
