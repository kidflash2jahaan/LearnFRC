import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { deptMeta } from "@/lib/departments";
import { getSession } from "@/lib/auth";
import { Glow } from "@/components/motion/primitives";
import { AuthScene, type OrbitDept, type Stat } from "./_auth-scene";

export const metadata = {
  title: "Log in",
  description: "Welcome back. Sign in to pick up where you left off.",
  robots: { index: false, follow: true },
};

/** Department slugs whose glossy tiles ring the auth card. */
const ORBIT_SLUGS = [
  "mechanical-build",
  "programming-software",
  "cad-design",
  "electrical-wiring",
  "scouting-strategy",
  "drive-team",
] as const;

const STATS: Stat[] = [
  { value: 11, suffix: "", label: "departments" },
  { value: 394, suffix: "", label: "lessons" },
  { value: 100, suffix: "%", label: "free, forever" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { user } = await getSession();
  if (user) redirect("/dashboard");

  const safeNext = next && next.startsWith("/") ? next : undefined;

  const orbit: OrbitDept[] = ORBIT_SLUGS.map((slug) => {
    const m = deptMeta(slug);
    return { slug, color: m.color, icon: m.icon };
  });

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "620px", pos: { left: "-180px", top: "-200px" }, color: "#8bbcff", opacity: 0.65 },
          { size: "560px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.55, delay: 2 },
          { size: "520px", pos: { left: "40%", bottom: "-220px" }, color: "#c8b6ff", opacity: 0.45, delay: 4 },
        ]}
      />

      {/* Global navbar provides branding + navigation — no page-level header. */}
      <div className="mx-auto flex min-h-[100svh] max-w-2xl flex-col px-4 pb-16 pt-28 sm:px-6">
        <AuthScene orbit={orbit} stats={STATS}>
          <AuthForm mode="login" next={safeNext} />
        </AuthScene>
      </div>
    </div>
  );
}
