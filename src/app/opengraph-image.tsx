import { ImageResponse } from "next/og";
import { ogFonts, OG_DISPLAY, OG_MONO } from "@/app/_og/font";
import { getOverviewStats } from "@/lib/queries";

export const alt =
  "LearnFRC, the notebook every FIRST Robotics Competition team wishes it had";
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
 * The link preview, as a sheet out of the binder.
 *
 * Two things the site does in CSS have to be built by hand here, because Satori
 * (what renders an ImageResponse) supports neither:
 *
 *  - The 23px graph ruling. There is no repeating background, so the grid is
 *    drawn as absolutely positioned 1px divs. 80 of them costs nothing next to
 *    the fonts, and it is what makes the card read as paper at thumbnail size.
 *  - The torn tape. There is no clip-path, so the strip is a plain kraft
 *    rectangle rotated a few degrees. It has to be the LAST child, because
 *    Satori paints siblings in document order and a strip declared before the
 *    card simply disappears behind it.
 *
 * The eight-value elliptical radius is not supported, but the four-value corner
 * shorthand is, and that is enough: a big corner opposite a tight one is what
 * makes the box read as ruled by hand rather than as a rounded rectangle. The
 * rest of the identity is the 2px ink border with a 1px rule set inside it, at
 * its own slightly different radius.
 */
const COLS = Math.ceil(size.width / 23);
const ROWS = Math.ceil(size.height / 23);

export default async function Image() {
  // This card is what every shared link renders, so a stale count here travels
  // further than one on a page. Read it, and fall back to the previous known
  // figures only if the query fails, since an OG image cannot show an error.
  const { lessonCount, deptCount } = await getOverviewStats().catch(() => ({
    lessonCount: 394,
    deptCount: 11,
  }));

  const fonts = await ogFonts();

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

        {/* the card */}
        <div
          style={{
            position: "absolute",
            left: 54,
            top: 52,
            width: size.width - 108,
            height: size.height - 104,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "56px 64px",
            background: CARD,
            border: `2px solid ${INK}`,
            borderRadius: "34px 10px 30px 12px",
            transform: "rotate(-0.55deg)",
          }}
        >
          {/* the inset hairline */}
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

          {/* logotype */}
          <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em" }}>
            <span>learn</span>
            <span
              style={{
                marginLeft: 6,
                padding: "2px 12px 6px",
                color: BLUE,
                border: `3px solid ${BLUE}`,
                borderRadius: "14px 5px 12px 6px",
                transform: "rotate(-1.4deg)",
                display: "flex",
              }}
            >
              FRC
            </span>
          </div>

          <div
            style={{
              marginTop: 34,
              fontSize: 82,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              maxWidth: 900,
              display: "flex",
            }}
          >
            Every job on an FRC team, written down.
          </div>

          <div
            style={{
              marginTop: 26,
              fontSize: 30,
              fontWeight: 400,
              lineHeight: 1.32,
              color: GRAPHITE,
              maxWidth: 780,
              display: "flex",
            }}
          >
            Free, structured, and open to read without an account.
          </div>

          {/* the mono slug line, ruled off */}
          <div
            style={{
              marginTop: 40,
              paddingTop: 22,
              borderTop: `1px dashed ${RULE}`,
              display: "flex",
              alignItems: "center",
              fontFamily: OG_MONO,
              fontWeight: 700,
              fontSize: 23,
              color: GRAPHITE,
            }}
          >
            <span style={{ color: INK }}>{deptCount} departments</span>
            <span style={{ margin: "0 14px" }}>/</span>
            <span style={{ color: INK }}>{lessonCount.toLocaleString()} lessons</span>
            <span style={{ margin: "0 14px" }}>/</span>
            <span>learnfrc.com</span>
          </div>
        </div>

        {/* the tape, over the card's top edge */}
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 30,
            width: 168,
            height: 44,
            background: KRAFT,
            opacity: 0.82,
            transform: "rotate(-3.4deg)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size, fonts }
  );
}
