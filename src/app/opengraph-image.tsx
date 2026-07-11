import { ImageResponse } from "next/og";
import { ogFonts } from "@/app/_og/font";

export const alt = "LearnFRC — Master FIRST Robotics Competition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "84px",
          background: "linear-gradient(135deg, #eef3fd 0%, #dde8f8 55%, #e7edfb 100%)",
          fontFamily: "Baloo 2",
          position: "relative",
        }}
      >
        {/* soft Arena-Clay glows (light, not neon) */}
        <div
          style={{
            position: "absolute",
            top: -220,
            left: -120,
            width: 720,
            height: 720,
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(47,107,255,0.16), transparent 62%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            right: -140,
            width: 760,
            height: 760,
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(26,169,214,0.18), transparent 62%)",
            display: "flex",
          }}
        />

        {/* brand mark — identical to the favicon: blue→cyan tile, white robot */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="92" height="92" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
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
            <rect x="12.6" y="19.2" width="6.8" height="1.7" rx="0.85" fill="#2560e6" opacity="0.5" />
          </svg>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em" }}>
            <span style={{ color: "#16203a" }}>Learn</span>
            <span style={{ color: "#2560e6" }}>FRC</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 86,
            fontWeight: 800,
            color: "#16203a",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            maxWidth: 960,
            display: "flex",
          }}
        >
          Master FIRST Robotics Competition
        </div>

        <div
          style={{
            marginTop: 30,
            fontSize: 33,
            color: "#55668a",
            maxWidth: 900,
            lineHeight: 1.3,
            display: "flex",
          }}
        >
          Structured, web-grounded guides for every department — 11 departments · 394 lessons.
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 66,
            left: 84,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 26,
            color: "#7a8aa8",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", width: 10, height: 10, borderRadius: 9999, background: "#2560e6" }} />
          learnfrc.com
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
