import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND, DEPARTMENTS } from "./brand";

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

export const Story: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg, fontFamily: BRAND.font }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(50% 30% at 50% 8%, rgba(47,95,255,0.34), transparent 60%), radial-gradient(50% 30% at 50% 96%, rgba(34,211,238,0.24), transparent 60%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(70% 60% at 50% 45%, black, transparent 90%)",
        }}
      />
      <AbsoluteFill style={{ padding: 100, alignItems: "center", justifyContent: "center", gap: 48, textAlign: "center" }}>
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 40,
            background: BRAND.grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 80,
            boxShadow: "0 30px 80px -24px rgba(47,95,255,0.6)",
          }}
        >
          🤖
        </div>

        <div style={{ fontSize: 64, fontWeight: 800, color: BRAND.fg, letterSpacing: -2 }}>
          Learn<Grad>FRC</Grad>
        </div>

        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, color: BRAND.fg }}>
          Master <Grad>every department</Grad> of FRC
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", maxWidth: 820 }}>
          {DEPARTMENTS.map((d) => (
            <div
              key={d}
              style={{
                padding: "14px 26px",
                borderRadius: 999,
                border: `1px solid ${BRAND.border}`,
                background: "rgba(255,255,255,0.03)",
                fontSize: 32,
                fontWeight: 600,
                color: BRAND.fg,
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 40, color: BRAND.muted, fontWeight: 500 }}>
          393+ free, web-verified lessons · quizzes · certificates
        </div>

        <div
          style={{
            padding: "26px 52px",
            borderRadius: 999,
            background: BRAND.grad,
            color: "white",
            fontSize: 44,
            fontWeight: 700,
          }}
        >
          learnfrc.systemerr.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
