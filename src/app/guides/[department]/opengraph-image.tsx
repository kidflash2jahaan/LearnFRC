import { ImageResponse } from "next/og";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { ogFonts, OG_DISPLAY, OG_MONO } from "@/app/_og/font";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LearnFRC department";

const PAPER = "#E6E8E3";
const CARD = "#F5F6F2";
const INK = "#16181B";
const GRAPHITE = "#565C60";
const BLUE = "#1B36C8";
const KRAFT = "#C4A77D";
const RULE = "rgba(22,24,27,0.30)";
const GRID = "rgba(27,54,200,0.055)";

const COLS = Math.ceil(size.width / 23);
const ROWS = Math.ceil(size.height / 23);

/**
 * A department's link preview: the tab divider out of the binder.
 *
 * Same construction as the site-wide card, because a preview has to be
 * recognisably the same artifact. Three things Satori (what renders an
 * ImageResponse) cannot do, and how each is handled:
 *
 *  - No repeating background, so the 23px graph ruling is drawn as absolutely
 *    positioned 1px divs. It is what makes the card read as paper at the size a
 *    preview is actually seen.
 *  - No clip-path, so the tape is a plain kraft rectangle, rotated. It has to be
 *    the LAST child: Satori paints siblings in document order, and a strip
 *    declared before the card simply vanishes behind it.
 *  - No eight-value elliptical radius, but the four-value corner shorthand
 *    works, and a big corner opposite a tight one is enough to read as ruled by
 *    hand rather than as a rounded rectangle.
 *
 * The department is named by its slug in mono and its name in display type. It
 * gets no colour of its own, because in this system no department does.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const entry = DEPT_CATALOG.find((d) => d.slug === department);
  const name = entry?.name ?? "FRC Department";
  const tagline = entry?.tagline ?? "every job on an FRC team, written down";
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
            transform: "rotate(0.5deg)",
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

          {/* the tab: which part of the binder this sheet came out of */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontFamily: OG_MONO,
              fontWeight: 700,
              fontSize: 24,
              color: GRAPHITE,
            }}
          >
            <div style={{ display: "flex", width: 46, height: 3, background: BLUE, marginRight: 16 }} />
            dept / {department}
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: name.length > 26 ? 66 : 80,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              maxWidth: 940,
              display: "flex",
            }}
          >
            {name}
          </div>

          <div
            style={{
              marginTop: 24,
              fontSize: 30,
              fontWeight: 400,
              lineHeight: 1.32,
              color: GRAPHITE,
              maxWidth: 800,
              display: "flex",
            }}
          >
            {tagline}
          </div>

          {/* the slug line, ruled off */}
          <div
            style={{
              marginTop: 38,
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
            <span style={{ color: INK }}>free to read</span>
            <span style={{ margin: "0 14px" }}>/</span>
            <span style={{ color: INK }}>no account needed</span>
            <span style={{ margin: "0 14px" }}>/</span>
            <span>learnfrc.com</span>
          </div>
        </div>

        {/* the tape, over the card's top edge */}
        <div
          style={{
            position: "absolute",
            left: 690,
            top: 32,
            width: 168,
            height: 44,
            background: KRAFT,
            opacity: 0.82,
            transform: "rotate(2.8deg)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size, fonts }
  );
}
