import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND } from "./brand";

const Grad: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      backgroundImage: BRAND.grad,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    }}
  >
    {children}
  </span>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: "16px 26px",
      borderRadius: 999,
      border: `1px solid ${BRAND.border}`,
      background: "rgba(255,255,255,0.03)",
      fontSize: 32,
      fontWeight: 600,
      color: BRAND.fg,
    }}
  >
    {children}
  </div>
);

export const Post: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg, fontFamily: BRAND.font }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(55% 45% at 50% 0%, rgba(47,95,255,0.32), transparent 60%), radial-gradient(45% 40% at 100% 100%, rgba(34,211,238,0.22), transparent 60%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(75% 75% at 50% 45%, black, transparent 90%)",
        }}
      />
      <AbsoluteFill
        style={{
          padding: 90,
          justifyContent: "center",
          gap: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: 18,
              background: BRAND.grad,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
            }}
          >
            🤖
          </div>
          <div style={{ fontSize: 46, fontWeight: 800, color: BRAND.fg, letterSpacing: -1 }}>
            Learn<Grad>FRC</Grad>
          </div>
        </div>

        <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, color: BRAND.fg }}>
          Learn <Grad>every part</Grad> of FRC — free.
        </div>

        <div style={{ fontSize: 38, color: BRAND.muted, fontWeight: 500, lineHeight: 1.3 }}>
          Mechanical, CAD, code, electrical, scouting, business &amp; more. 393
          web-verified lessons with quizzes and certificates.
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Chip>393+ lessons</Chip>
          <Chip>11 departments</Chip>
          <Chip>Quizzes &amp; certificates</Chip>
          <Chip>100% free</Chip>
        </div>

        <div
          style={{
            marginTop: 14,
            alignSelf: "flex-start",
            padding: "22px 44px",
            borderRadius: 999,
            background: BRAND.grad,
            color: "white",
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          learnfrc.systemerr.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
