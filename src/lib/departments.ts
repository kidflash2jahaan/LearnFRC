/**
 * Per-department UI metadata: accent color + icon + gradient stop.
 * Content (name, tagline, lessons …) lives in the database; this is purely visual.
 */
export type DeptMeta = {
  color: string; // primary accent
  to: string; // gradient end stop
  icon: string; // key into ICONS map
};

// All accents stay inside the neon family (lime #c6ff3d / cyan #22d3ee /
// magenta #ff3dcb / green #5dff9b / gold #ffd23d). Per-department identity
// comes from the dominant hue + gradient pairing — no off-brand blue/orange/
// violet/red, so the whole site reads as one neon system.
export const DEPARTMENT_META: Record<string, DeptMeta> = {
  "getting-started": { color: "#c6ff3d", to: "#22d3ee", icon: "Rocket" },
  "mechanical-build": { color: "#ffd23d", to: "#c6ff3d", icon: "Cog" },
  "cad-design": { color: "#ff3dcb", to: "#22d3ee", icon: "PenTool" },
  "programming-software": { color: "#22d3ee", to: "#c6ff3d", icon: "Code2" },
  "electrical-wiring": { color: "#5dff9b", to: "#ffd23d", icon: "Zap" },
  "business-operations": { color: "#c6ff3d", to: "#5dff9b", icon: "Briefcase" },
  "media-outreach": { color: "#ff3dcb", to: "#ff8af0", icon: "Camera" },
  "impact-award": { color: "#ffd23d", to: "#ffe27a", icon: "Trophy" },
  "scouting-strategy": { color: "#22d3ee", to: "#5dff9b", icon: "LineChart" },
  "drive-team": { color: "#5dff9b", to: "#22d3ee", icon: "Gamepad2" },
  safety: { color: "#5dff9b", to: "#c6ff3d", icon: "ShieldCheck" },
};

const FALLBACK: DeptMeta = { color: "#c6ff3d", to: "#22d3ee", icon: "BookOpen" };

export function deptMeta(slug: string): DeptMeta {
  return DEPARTMENT_META[slug] ?? FALLBACK;
}

export function deptGradient(slug: string, angle = 135) {
  const m = deptMeta(slug);
  return `linear-gradient(${angle}deg, ${m.color}, ${m.to})`;
}
