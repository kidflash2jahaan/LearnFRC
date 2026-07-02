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
  "mechanical-build": { color: "#ff8a3d", to: "#ffd23d", icon: "Cog" },
  "cad-design": { color: "#b16bff", to: "#ff3dcb", icon: "PenTool" },
  "programming-software": { color: "#22d3ee", to: "#4f8bff", icon: "Code2" },
  "electrical-wiring": { color: "#ffe53d", to: "#ff8a3d", icon: "Zap" },
  "business-operations": { color: "#ff5db1", to: "#ff3dcb", icon: "Briefcase" },
  "media-outreach": { color: "#ff3dcb", to: "#b16bff", icon: "Camera" },
  "impact-award": { color: "#ffd23d", to: "#ffb020", icon: "Trophy" },
  "scouting-strategy": { color: "#2dd4bf", to: "#22d3ee", icon: "LineChart" },
  "drive-team": { color: "#ff6b5d", to: "#ff8a3d", icon: "Gamepad2" },
  safety: { color: "#5dff9b", to: "#c6ff3d", icon: "ShieldCheck" },
};

const FALLBACK: DeptMeta = { color: "#c6ff3d", to: "#22d3ee", icon: "BookOpen" };

export function deptMeta(slug: string): DeptMeta {
  return DEPARTMENT_META[slug] ?? FALLBACK;
}

/**
 * Darkened, same-hue versions of each accent that are legible as TEXT on the
 * light theme. The neon accents are fine as fills / badges / progress bars, but
 * bright ones (yellow, lime, gold, mint, cyan) fail contrast when used as text.
 * Use inkFor()/deptInk() for accent-colored text, numbers, and small icons.
 */
const ACCENT_INK: Record<string, string> = {
  "#c6ff3d": "#3f6212", // lime
  "#ff8a3d": "#c2410c", // orange
  "#b16bff": "#7c3aed", // violet
  "#22d3ee": "#0e7490", // cyan
  "#ffe53d": "#854d0e", // yellow (electrical)
  "#ff5db1": "#be185d", // pink
  "#ff3dcb": "#a21caf", // magenta
  "#ffd23d": "#a16207", // gold
  "#2dd4bf": "#0f766e", // teal
  "#ff6b5d": "#d0392b", // coral
  "#5dff9b": "#059669", // mint
};

/** Legible-on-light text color for a raw accent hex (falls back to the hex). */
export function inkFor(hex: string): string {
  return ACCENT_INK[hex.toLowerCase()] ?? hex;
}

/** Legible-on-light text color for a department. */
export function deptInk(slug: string): string {
  return inkFor(deptMeta(slug).color);
}

export function deptGradient(slug: string, angle = 135) {
  const m = deptMeta(slug);
  return `linear-gradient(${angle}deg, ${m.color}, ${m.to})`;
}
