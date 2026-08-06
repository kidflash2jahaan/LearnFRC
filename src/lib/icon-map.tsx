import {
  Rocket,
  Wrench,
  Box,
  Code2,
  Zap,
  Radar,
  Wind,
  Briefcase,
  Megaphone,
  Trophy,
  LineChart,
  Gamepad2,
  ShieldCheck,
  Coins,
  Cog,
  CircuitBoard,
  Gauge,
  PenTool,
  Camera,
  Award,
  Binoculars,
  HardHat,
  HandCoins,
  BookOpen,
  Flame,
  Target,
  Star,
  GraduationCap,
  Sparkles,
  Medal,
  Cpu,
  Bot,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Rocket,
  Wrench,
  Box,
  Code2,
  Zap,
  Radar,
  Wind,
  Briefcase,
  Megaphone,
  Trophy,
  LineChart,
  Gamepad2,
  ShieldCheck,
  Coins,
  Cog,
  CircuitBoard,
  Gauge,
  PenTool,
  Camera,
  Award,
  Binoculars,
  HardHat,
  HandCoins,
  BookOpen,
  Flame,
  Target,
  Star,
  GraduationCap,
  Sparkles,
  Medal,
  Cpu,
  Bot,
  CheckCircle2,
};

function getIcon(name?: string | null): LucideIcon {
  return (name && ICONS[name]) || BookOpen;
}

export function Icon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const Cmp = getIcon(name);
  return <Cmp className={className} aria-hidden="true" />;
}
