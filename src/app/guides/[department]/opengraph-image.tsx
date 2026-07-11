import { ImageResponse } from "next/og";
import { DEPT_CATALOG } from "@/lib/dept-catalog";
import { deptMeta } from "@/lib/departments";
import { ogFonts } from "@/app/_og/font";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LearnFRC department";

export default async function Image({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const entry = DEPT_CATALOG.find((d) => d.slug === department);
  const name = entry?.name ?? "FRC Department";
  const tagline = entry?.tagline ?? "Master FIRST Robotics Competition";
  const m = deptMeta(department);
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
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 720,
            height: 720,
            borderRadius: "9999px",
            background: `radial-gradient(circle, ${m.color}30, transparent 62%)`,
            display: "flex",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `linear-gradient(135deg, ${m.color}, ${m.to})`,
              display: "flex",
            }}
          />
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>
            <span style={{ color: "#16203a" }}>Learn</span>
            <span style={{ color: "#2560e6" }}>FRC</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: m.color,
              display: "flex",
            }}
          >
            Department
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 76,
              fontWeight: 800,
              color: "#16203a",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 1000,
              display: "flex",
            }}
          >
            {name}
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 32,
              color: "#55668a",
              maxWidth: 920,
              display: "flex",
            }}
          >
            {tagline}
          </div>
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
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
