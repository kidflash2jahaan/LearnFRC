import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { JsonLd } from "@/components/json-ld";
import { ToolCTA } from "@/components/tools/tool-cta";
import Calculator from "./_calculator";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Wire Gauge & Voltage Drop Calculator (AWG Rules Checker)",
  description:
    "Free FRC wire gauge and voltage-drop calculator. Enter current, run length, and gauge to get voltage drop, and check it against FRC's minimum-AWG wiring rules for each breaker size. Built from Ohm's law and the official copper AWG resistance table.",
  alternates: { canonical: `${SITE}/tools/frc-wire-gauge-calculator` },
  openGraph: {
    title: "FRC Wire Gauge & Voltage-Drop Calculator (Free) — LearnFRC",
    description:
      "Voltage drop over a run, plus a check against FRC's minimum-AWG rules for each breaker size.",
    url: `${SITE}/tools/frc-wire-gauge-calculator`,
    type: "website",
  },
};

export default async function Page() {
  const { user } = await getSession();
  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "FRC Wire Gauge & Voltage-Drop Calculator",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          url: `${SITE}/tools/frc-wire-gauge-calculator`,
          description:
            "Free FRC wire gauge and voltage-drop calculator with an FRC minimum-AWG rules check.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "LearnFRC", url: SITE },
        }}
      />
      <Calculator authed={!!user} />
      <ToolCTA
        related={[
          { href: "/tools/frc-current-budget", label: "Current & brownout checker" },
          { href: "/blog/frc-no-robot-code-driver-station-troubleshooting", label: "“No robot code” fixes" },
          { href: "/guides", label: "All FRC guides" },
        ]}
      />
    </main>
  );
}
