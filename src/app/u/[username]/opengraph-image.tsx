import { ImageResponse } from "next/og";
import { ogFonts } from "@/app/_og/font";

export const alt = "LearnFRC profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let name = username;
  let team: number | null = null;
  let xp = 0;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(
      `${url}/rest/v1/profiles?username=eq.${encodeURIComponent(
        username
      )}&select=username,team_number,xp`,
      {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        cache: "no-store",
        signal: ctrl.signal,
      }
    ).finally(() => clearTimeout(timer));
    const rows = await res.json();
    const p = Array.isArray(rows) ? rows[0] : null;
    if (p) {
      name = p.username || username;
      team = p.team_number ?? null;
      xp = p.xp ?? 0;
    }
  } catch {
    /* fall back to defaults */
  }

  const level = Math.floor(xp / 100) + 1;
  const meta = `Level ${level} · ${xp.toLocaleString("en-US")} XP${team ? ` · Team ${team}` : ""} · learnfrc.com`;
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
            background: "radial-gradient(circle, rgba(37,96,230,0.16), transparent 62%)",
            display: "flex",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              display: "flex",
              background: "linear-gradient(135deg,#2560e6,#1aa9d6)",
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
              color: "#2560e6",
              display: "flex",
            }}
          >
            FRC Learning Profile
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 84,
              fontWeight: 800,
              color: "#16203a",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              display: "flex",
            }}
          >
            {`@${name}`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 26,
            color: "#55668a",
            fontWeight: 600,
          }}
        >
          {meta}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
