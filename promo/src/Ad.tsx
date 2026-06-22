import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  random,
} from "remotion";
import { BRAND, DEPARTMENTS } from "./brand";

/* ============================ helpers ============================ */

const sIn = (frame: number, fps: number, delay = 0, damping = 200) =>
  spring({ frame: frame - delay, fps, config: { damping } });

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

/** Wraps a scene: subtle camera drift + automatic cross-dissolve exit. */
const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const inP = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const exit = interpolate(
    frame,
    [durationInFrames - 16, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const cam = interpolate(frame, [0, durationInFrames], [1.06, 1.12]);
  const blurIn = interpolate(inP, [0, 1], [16, 0]);
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(inP, exit),
        transform: `scale(${cam * interpolate(exit, [0, 1], [1.08, 1])})`,
        filter: `blur(${blurIn}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/* ============================ background ============================ */

const Blob: React.FC<{ seed: number; color: string; size: number }> = ({
  seed,
  color,
  size,
}) => {
  const frame = useCurrentFrame();
  const x = 50 + Math.sin(frame / (60 + seed * 13) + seed) * 26;
  const y = 45 + Math.cos(frame / (70 + seed * 9) + seed * 2) * 30;
  const s = 1 + Math.sin(frame / 50 + seed) * 0.18;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(${size * s}px ${size * s}px at ${x}% ${y}%, ${color}, transparent 60%)`,
      }}
    />
  );
};

const Particles: React.FC = () => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  return (
    <AbsoluteFill>
      {new Array(34).fill(0).map((_, i) => {
        const baseX = random(`x${i}`) * width;
        const baseY = random(`y${i}`) * height;
        const speed = 0.3 + random(`s${i}`) * 0.9;
        const y = (baseY - frame * speed * 1.4 + height * 3) % (height + 60);
        const tw = 0.25 + (Math.sin(frame / 18 + i) * 0.5 + 0.5) * 0.6;
        const sz = 3 + random(`z${i}`) * 5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: baseX + Math.sin(frame / 40 + i) * 20,
              top: y,
              width: sz,
              height: sz,
              borderRadius: "50%",
              background: i % 2 ? BRAND.cyan : BRAND.blue,
              opacity: tw,
              filter: "blur(0.5px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  const gridShift = (frame * 0.6) % 64;
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg }}>
      <Blob seed={1} color="rgba(47,95,255,0.35)" size={900} />
      <Blob seed={2} color="rgba(34,211,238,0.28)" size={760} />
      <Blob seed={3} color="rgba(124,58,237,0.20)" size={680} />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          backgroundPosition: `0 ${gridShift}px`,
          maskImage: "radial-gradient(75% 70% at 50% 45%, black, transparent 92%)",
        }}
      />
      <Particles />
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 400px 80px rgba(0,0,0,0.55)",
        }}
      />
    </AbsoluteFill>
  );
};

/* ============================ kinetic type ============================ */

const Kinetic: React.FC<{
  text: string;
  delay?: number;
  size: number;
  weight?: number;
  stagger?: number;
  grad?: boolean;
}> = ({ text, delay = 0, size, weight = 800, stagger = 4, grad = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: `0 ${size * 0.26}px`,
        justifyContent: "center",
        lineHeight: 1.02,
      }}
    >
      {words.map((w, i) => {
        const p = sIn(frame, fps, delay + i * stagger, 14);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontSize: size,
              fontWeight: weight,
              letterSpacing: -size * 0.03,
              color: grad ? undefined : BRAND.fg,
              opacity: interpolate(p, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(p, [0, 1], [size * 0.7, 0])}px) scale(${interpolate(
                p,
                [0, 1],
                [0.7, 1]
              )})`,
              clipPath: `inset(0 ${interpolate(p, [0, 1], [100, 0])}% 0 0)`,
            }}
          >
            {grad ? <Grad>{w}</Grad> : w}
          </span>
        );
      })}
    </div>
  );
};

const RobotMark: React.FC<{ size: number; spin?: boolean }> = ({ size, spin }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = sIn(frame, fps, 2, 12);
  const rot = spin ? interpolate(p, [0, 1], [-25, 0]) + Math.sin(frame / 30) * 3 : 0;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: BRAND.grad,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 24px 70px -16px rgba(47,95,255,0.7)",
        opacity: interpolate(p, [0, 1], [0, 1]),
        transform: `scale(${interpolate(p, [0, 1], [0.5, 1])}) rotate(${rot}deg)`,
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="8" width="16" height="11" rx="3" stroke="white" strokeWidth="1.8" />
        <circle cx="9" cy="13" r="1.4" fill="white" />
        <circle cx="15" cy="13" r="1.4" fill="white" />
        <path d="M12 4v3.5M9.5 16.5h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="3" r="1.4" fill="white" />
      </svg>
    </div>
  );
};

/* ============================ scenes ============================ */

const Intro: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 44 }}>
      <RobotMark size={210} spin />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -4 }}>
          <Kinetic text="Learn FRC" size={120} delay={10} grad={false} />
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        <Kinetic text="Master the FIRST Robotics Competition" size={40} weight={500} delay={24} />
      </div>
    </AbsoluteFill>
  </Scene>
);

const Departments: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 90, gap: 56 }}>
        <div style={{ textAlign: "center" }}>
          <Kinetic text="Not just code." size={46} weight={500} delay={2} />
          <div style={{ height: 14 }} />
          <Kinetic text="Every department." size={86} delay={10} grad />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center", maxWidth: 900 }}>
          {DEPARTMENTS.map((d, i) => {
            const p = sIn(frame, fps, 26 + i * 4, 11);
            const float = Math.sin(frame / 24 + i) * 5;
            return (
              <div
                key={d}
                style={{
                  opacity: interpolate(p, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(p, [0, 1], [40, float], { extrapolateRight: "clamp" })}px) scale(${interpolate(
                    p,
                    [0, 1],
                    [0.6, 1]
                  )}) rotate(${interpolate(p, [0, 1], [(i % 2 ? -8 : 8), 0])}deg)`,
                  padding: "18px 32px",
                  borderRadius: 999,
                  border: `1px solid ${BRAND.border}`,
                  background: "rgba(255,255,255,0.04)",
                  backdropFilter: "blur(4px)",
                  fontSize: 38,
                  fontWeight: 600,
                  color: BRAND.fg,
                }}
              >
                {d}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Ring: React.FC<{ delay: number; to: number; max: number; label: string; suffix?: string }> = ({
  delay,
  to,
  max,
  label,
  suffix = "",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = sIn(frame, fps, delay, 26);
  const r = 120;
  const c = 2 * Math.PI * r;
  const val = interpolate(p, [0, 1], [0, to]);
  const frac = Math.min(val / max, 1);
  return (
    <div
      style={{
        position: "relative",
        width: 300,
        height: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: interpolate(p, [0, 1], [0, 1]),
        transform: `scale(${interpolate(p, [0, 1], [0.8, 1])})`,
      }}
    >
      <svg width={300} height={300} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={`g${label}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BRAND.blue} />
            <stop offset="100%" stopColor={BRAND.cyan} />
          </linearGradient>
        </defs>
        <circle cx={150} cy={150} r={r} stroke={BRAND.border} strokeWidth={16} fill="none" />
        <circle
          cx={150}
          cy={150}
          r={r}
          stroke={`url(#g${label})`}
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ filter: "drop-shadow(0 0 12px rgba(47,95,255,0.5))" }}
        />
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>
          <Grad>
            {Math.round(val)}
            {suffix}
          </Grad>
        </div>
        <div style={{ fontSize: 26, color: BRAND.muted, fontWeight: 500, maxWidth: 220 }}>{label}</div>
      </div>
    </div>
  );
};

const Stats: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      <Kinetic text="The whole playbook." size={64} delay={2} grad />
      <div style={{ height: 20 }} />
      <Ring delay={14} to={393} max={400} suffix="+" label="web-verified lessons" />
      <div style={{ display: "flex", gap: 50 }}>
        <Ring delay={30} to={11} max={11} label="departments" />
        <Ring delay={46} to={100} max={100} suffix="%" label="free, forever" />
      </div>
    </AbsoluteFill>
  </Scene>
);

const Card: React.FC<{ delay: number; title: string; sub: string; emoji: string; dir: number }> = ({
  delay,
  title,
  sub,
  emoji,
  dir,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = sIn(frame, fps, delay, 16);
  const float = Math.sin(frame / 22 + delay) * 6;
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 1], [0, 1]),
        transform: `perspective(1200px) translateX(${interpolate(p, [0, 1], [dir * 500, 0])}px) translateY(${float}px) rotateY(${interpolate(
          p,
          [0, 1],
          [dir * 40, 0]
        )}deg)`,
        width: 760,
        padding: "34px 40px",
        borderRadius: 30,
        border: `1px solid ${BRAND.border}`,
        background: BRAND.card,
        boxShadow: "0 40px 90px -34px rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: 24,
          background: BRAND.grad,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 46,
          flexShrink: 0,
        }}
      >
        {emoji}
      </div>
      <div>
        <div style={{ fontSize: 44, fontWeight: 700, color: BRAND.fg }}>{title}</div>
        <div style={{ fontSize: 30, color: BRAND.muted, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
};

const Product: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 }}>
      <div style={{ marginBottom: 8 }}>
        <Kinetic text="Get robot-ready." size={62} delay={2} grad />
      </div>
      <Card delay={16} dir={-1} emoji="📈" title="Track your progress" sub="XP, streaks & leaderboards" />
      <Card delay={30} dir={1} emoji="✅" title="Quiz every lesson" sub="learn it, then prove it" />
      <Card delay={44} dir={-1} emoji="🏆" title="Earn certificates" sub="finish a department, get the cert" />
    </AbsoluteFill>
  </Scene>
);

const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const btn = sIn(frame, fps, 26, 12);
  const pulse = 1 + Math.sin(frame / 7) * 0.025;
  const shine = interpolate(frame % 70, [0, 70], [-120, 220]);
  const sub = sIn(frame, fps, 38);
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 48 }}>
        <RobotMark size={160} spin />
        <Kinetic text="Start free today" size={96} delay={12} grad />
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            opacity: interpolate(btn, [0, 1], [0, 1]),
            transform: `scale(${interpolate(btn, [0, 1], [0.7, 1]) * pulse})`,
            padding: "32px 64px",
            borderRadius: 999,
            background: BRAND.grad,
            color: "white",
            fontSize: 48,
            fontWeight: 700,
            boxShadow: "0 26px 80px -14px rgba(47,95,255,0.8)",
          }}
        >
          learnfrc.systemerr.com
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${shine}px`,
              width: 70,
              background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.55), transparent)",
              transform: "skewX(-20deg)",
            }}
          />
        </div>
        <div style={{ opacity: interpolate(sub, [0, 1], [0, 1]), fontSize: 30, color: BRAND.muted }}>
          Built by Jahaan Pardhanani · Sage Hill Robotics 5835
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/* ============================ ad ============================ */

export const Ad: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: BRAND.font }}>
    <Bg />
    <Sequence durationInFrames={100}>
      <Intro />
    </Sequence>
    <Sequence from={86} durationInFrames={168}>
      <Departments />
    </Sequence>
    <Sequence from={240} durationInFrames={168}>
      <Stats />
    </Sequence>
    <Sequence from={394} durationInFrames={140}>
      <Product />
    </Sequence>
    <Sequence from={520} durationInFrames={80}>
      <CTA />
    </Sequence>
  </AbsoluteFill>
);
