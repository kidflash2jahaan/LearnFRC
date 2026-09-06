import { ImageResponse } from "next/og";
import { getArticles } from "@/lib/queries";
import { ogFonts, OG_DISPLAY, OG_MONO } from "@/app/_og/font";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LearnFRC article";

const PAPER = "#E6E8E3";
const CARD = "#F5F6F2";
const INK = "#16181B";
const GRAPHITE = "#565C60";
const BLUE = "#1B36C8";
const KRAFT = "#C4A77D";
const RULE = "rgba(22,24,27,0.30)";
const GRID = "rgba(27,54,200,0.055)";

/**
 * An article's link preview: the page itself, torn out of the binder.
 *
 * It is deliberately NOT the site card with a different headline. The site
 * card is a centred sheet led by the logotype, because it is introducing the
 * whole binder. This one is a single article, so it reads like one: the ink
 * rule runs down the left margin, the title is set hard against it, and the
 * logotype is demoted to the filing line at the foot where the page number
 * would be.
 *
 * Two things the site does in CSS have to be built by hand, because Satori
 * (what renders an ImageResponse) supports neither:
 *
 *  - The 23px graph ruling. There is no repeating background, so the grid is
 *    drawn as absolutely positioned 1px divs.
 *  - The torn tape. There is no clip-path, so the strip is a plain kraft
 *    rectangle rotated a few degrees. It has to be the LAST child, because
 *    Satori paints siblings in document order and a strip declared before the
 *    card simply disappears behind it.
 *
 * The eight-value elliptical radius is not supported either, but the
 * four-value corner shorthand is, and a big corner opposite a tight one is
 * what makes the box read as ruled by hand rather than as a rounded rectangle.
 */
const COLS = Math.ceil(size.width / 23);
const ROWS = Math.ceil(size.height / 23);

/**
 * Keep long headlines inside the card. Satori has no line-clamp, so we clamp
 * by character count and step the type down. Together these cap the title
 * block at about three lines for every article, so nothing spills off the
 * canvas.
 */
const MAX_TITLE_CHARS = 108;

function clampTitle(title: string): string {
  if (title.length <= MAX_TITLE_CHARS) return title;
  return `${title.slice(0, MAX_TITLE_CHARS).trimEnd()}…`;
}

function titleFontSize(len: number): number {
  if (len <= 34) return 78;
  if (len <= 58) return 66;
  if (len <= 82) return 57;
  return 50;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = (await getArticles()).find((x) => x.slug === slug);
  const title = clampTitle(article?.title ?? "FRC Article");
  const readMins = article?.readMins;
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

        {/* the sheet */}
        <div
          style={{
            position: "absolute",
            left: 52,
            top: 50,
            width: size.width - 104,
            height: size.height - 100,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "54px 62px 54px 96px",
            background: CARD,
            border: `2px solid ${INK}`,
            borderRadius: "12px 32px 10px 30px",
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
              borderRadius: "10px 28px 8px 26px",
              display: "flex",
            }}
          />

          {/* the ballpoint margin rule the title is set against */}
          <div
            style={{
              position: "absolute",
              left: 62,
              top: 62,
              bottom: 62,
              width: 6,
              background: BLUE,
              display: "flex",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontFamily: OG_MONO,
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "0.05em",
              color: GRAPHITE,
            }}
          >
            <span>article</span>
            <span style={{ margin: "0 12px" }}>/</span>
            <span style={{ color: INK }}>{readMins ? `${readMins} min read` : "free to read"}</span>
          </div>

          <div
            style={{
              marginTop: 26,
              fontSize: titleFontSize(title.length),
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              maxWidth: 940,
              display: "flex",
              overflow: "hidden",
            }}
          >
            {title}
          </div>

          {/* the filing line, ruled off, with the logotype demoted into it */}
          <div
            style={{
              marginTop: 38,
              paddingTop: 22,
              borderTop: `1px dashed ${RULE}`,
              display: "flex",
              alignItems: "center",
              fontFamily: OG_MONO,
              fontWeight: 700,
              fontSize: 22,
              color: GRAPHITE,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontFamily: OG_DISPLAY,
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: INK,
              }}
            >
              <span>learn</span>
              <span
                style={{
                  marginLeft: 5,
                  padding: "1px 9px 4px",
                  color: BLUE,
                  border: `3px solid ${BLUE}`,
                  borderRadius: "11px 4px 9px 5px",
                  transform: "rotate(-1.4deg)",
                  display: "flex",
                }}
              >
                FRC
              </span>
            </div>
            <span style={{ margin: "0 16px" }}>/</span>
            <span>learnfrc.com</span>
          </div>
        </div>

        {/* the tape, over the sheet's bottom edge */}
        <div
          style={{
            position: "absolute",
            right: 210,
            bottom: 28,
            width: 172,
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
