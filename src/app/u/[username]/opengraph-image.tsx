import { ImageResponse } from "next/og";

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
    const res = await fetch(
      `${url}/rest/v1/profiles?username=eq.${encodeURIComponent(
        username
      )}&select=full_name,username,team_number,xp,hide_name`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, cache: "no-store" }
    );
    const rows = await res.json();
    const p = Array.isArray(rows) ? rows[0] : null;
    if (p) {
      name = (p.hide_name ? p.username : p.full_name || p.username) || username;
      team = p.team_number ?? null;
      xp = p.xp ?? 0;
    }
  } catch {
    /* fall back to defaults */
  }

  const level = Math.floor(xp / 100) + 1;
  const lessons = Math.floor(xp / 10);
  const stat = (label: string, value: string | number) => ({ label, value });
  const stats = [stat("XP", xp), stat("Level", level), stat("Lessons", lessons)];

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
          background: "linear-gradient(135deg, #060912 0%, #0c1322 60%, #0a1a2e 100%)",
          color: "#e8edf7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(110deg,#2f5fff,#22d3ee)",
              fontSize: 30,
            }}
          >
            🤖
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            Learn<span style={{ color: "#22d3ee" }}>FRC</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 26, color: "#94a2bf" }}>FRC learning profile</div>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>{name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, color: "#5b8cff" }}>
            <span>@{username}</span>
            {team ? <span style={{ color: "#94a2bf" }}>· Team {team}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "20px 32px",
                borderRadius: 18,
                border: "1px solid #1d2740",
                background: "rgba(255,255,255,0.03)",
                minWidth: 180,
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: 24, color: "#94a2bf" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
