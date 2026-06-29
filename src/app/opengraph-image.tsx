import { ImageResponse } from "next/og";

export const alt = "LearnFRC — Master FIRST Robotics Competition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#090d15",
          position: "relative",
        }}
      >
        {/* gradient glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -100,
            width: 700,
            height: 700,
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, rgba(198,255,61,0.38), transparent 60%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -250,
            right: -120,
            width: 700,
            height: 700,
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, rgba(34,211,238,0.40), transparent 60%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 22,
              background: "linear-gradient(135deg, #c6ff3d, #22d3ee)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* robot head: dark face with two neon eyes */}
            <div
              style={{
                width: 52,
                height: 44,
                borderRadius: 14,
                background: "#0a1018",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
              }}
            >
              <div style={{ width: 11, height: 11, borderRadius: 6, background: "#c6ff3d", display: "flex" }} />
              <div style={{ width: 11, height: 11, borderRadius: 6, background: "#22d3ee", display: "flex" }} />
            </div>
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            LearnFRC
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 84,
            fontWeight: 800,
            color: "white",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            maxWidth: 950,
            display: "flex",
          }}
        >
          Master FIRST Robotics Competition
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 32,
            color: "#94a2bf",
            maxWidth: 880,
            display: "flex",
          }}
        >
          Structured, web-grounded guides for every department — 11 departments
          · 393+ lessons.
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 64,
            left: 80,
            fontSize: 24,
            color: "#5b6b8c",
            display: "flex",
          }}
        >
          learnfrc.systemerr.com
        </div>
      </div>
    ),
    { ...size }
  );
}
