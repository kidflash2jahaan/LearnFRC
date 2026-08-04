import { ImageResponse } from "next/og";
import { getArticles } from "@/lib/queries";
import { ogFonts } from "@/app/_og/font";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LearnFRC article";

/**
 * Keep long headlines inside the card. Satori has no line-clamp, so we clamp by
 * character count and step the type down — together these cap the title block at
 * ~3 lines for every article, so nothing ever spills past the 630px canvas.
 */
const MAX_TITLE_CHARS = 108;

function clampTitle(title: string): string {
  if (title.length <= MAX_TITLE_CHARS) return title;
  return `${title.slice(0, MAX_TITLE_CHARS).trimEnd()}…`;
}

function titleFontSize(len: number): number {
  if (len <= 34) return 82;
  if (len <= 58) return 70;
  if (len <= 82) return 60;
  return 52;
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
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #eef3fd 0%, #dde8f8 55%, #e7edfb 100%)",
          fontFamily: "Baloo 2",
          position: "relative",
        }}
      >
        {/* soft Arena-Clay glows (light, not neon) */}
        <div
          style={{
            position: "absolute",
            top: -240,
            right: -150,
            width: 740,
            height: 740,
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, rgba(37,96,230,0.16), transparent 62%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -280,
            left: -160,
            width: 720,
            height: 720,
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, rgba(26,169,214,0.18), transparent 62%)",
            display: "flex",
          }}
        />

        {/* brand mark — identical to the favicon: blue→cyan tile, white robot */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="g"
                x1="0"
                y1="0"
                x2="32"
                y2="32"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#2f6bff" />
                <stop offset="1" stopColor="#1aa9d6" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#g)" />
            <rect x="15.1" y="5.4" width="1.8" height="4" rx="0.9" fill="#ffffff" />
            <circle cx="16" cy="5.2" r="1.7" fill="#ffffff" />
            <rect x="8" y="9.8" width="16" height="13" rx="4" fill="#ffffff" />
            <circle cx="12.9" cy="15.8" r="1.9" fill="#2560e6" />
            <circle cx="19.1" cy="15.8" r="1.9" fill="#1aa9d6" />
            <rect
              x="12.6"
              y="19.2"
              width="6.8"
              height="1.7"
              rx="0.85"
              fill="#2560e6"
              opacity="0.5"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>
            <span style={{ color: "#16203a" }}>Learn</span>
            <span style={{ color: "#2560e6" }}>FRC</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: "#2560e6",
              display: "flex",
            }}
          >
            FRC Article
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: titleFontSize(title.length),
              fontWeight: 800,
              color: "#16203a",
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              maxWidth: 1010,
              display: "flex",
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          {/* blue→cyan accent rule, the Arena Clay signature */}
          <div
            style={{
              marginTop: 28,
              width: 200,
              height: 8,
              borderRadius: 9999,
              background: "linear-gradient(90deg, #2560e6, #1aa9d6)",
              display: "flex",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 24,
            color: "#7a8aa8",
            fontWeight: 600,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 10,
              height: 10,
              borderRadius: 9999,
              background: "#2560e6",
            }}
          />
          learnfrc.com
          {readMins ? (
            <div style={{ display: "flex", gap: 14 }}>
              <span>·</span>
              <span>{readMins} min read</span>
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
