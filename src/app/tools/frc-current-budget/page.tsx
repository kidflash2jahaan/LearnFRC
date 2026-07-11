import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { JsonLd } from "@/components/json-ld";
import { ToolCTA } from "@/components/tools/tool-cta";
import Calculator from "./_calculator";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Current Draw & Brownout Calculator — Motor Current Budget",
  description:
    "Free FRC current-budget and brownout calculator. Add each mechanism's motor current against the 120 A main breaker and the roboRIO brownout thresholds to see what can safely run at once — before you brown out at competition. Uses official FIRST figures and vendor motor specs.",
  alternates: { canonical: `${SITE}/tools/frc-current-budget` },
  openGraph: {
    title: "FRC Current Budget & Brownout Checker (Free) — LearnFRC",
    description:
      "Total motor current vs the 120 A main breaker and roboRIO brownout thresholds — avoid browning out.",
    url: `${SITE}/tools/frc-current-budget`,
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
          name: "FRC Current Budget & Brownout Checker",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          url: `${SITE}/tools/frc-current-budget`,
          description:
            "Free FRC current-draw and brownout calculator against the 120 A main breaker and roboRIO brownout thresholds.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "LearnFRC", url: SITE },
        }}
      />
      <Calculator authed={!!user} />
      <ToolCTA
        related={[
          { href: "/tools/frc-wire-gauge-calculator", label: "Wire gauge & voltage drop" },
          { href: "/blog/frc-no-robot-code-driver-station-troubleshooting", label: "“No robot code” fixes" },
          { href: "/guides", label: "All FRC guides" },
        ]}
      />
    </main>
  );
}
