import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND } from "./brand";

/**
 * Instagram profile picture (1080x1080). Everything is kept inside the centered
 * ~74% circle so nothing important is lost to IG's circular crop.
 */
export const Logo: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: BRAND.font, background: BRAND.grad }}>
      {/* depth */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(60% 55% at 50% 38%, rgba(255,255,255,0.18), transparent 60%)",
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 240px 60px rgba(4,10,30,0.35)" }} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 22 }}>
        <svg width={440} height={440} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="8" width="16" height="11" rx="3" stroke="white" strokeWidth="1.7" />
          <circle cx="9" cy="13.2" r="1.5" fill="white" />
          <circle cx="15" cy="13.2" r="1.5" fill="white" />
          <path
            d="M12 3.8V7.6M9.3 16.4h5.4"
            stroke="white"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="12" cy="3" r="1.5" fill="white" />
          <path d="M2.6 11.5v4M21.4 11.5v4" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <div
          style={{
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: -5,
            color: "white",
            marginTop: -30,
          }}
        >
          LearnFRC
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
