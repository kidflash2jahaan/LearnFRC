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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE}/tools` },
            {
              "@type": "ListItem",
              position: 3,
              name: "Wire Gauge & Voltage Drop",
              item: `${SITE}/tools/frc-wire-gauge-calculator`,
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What wire gauge do FRC rules require?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "FRC's rules set a minimum wire gauge for each branch-circuit breaker size. As a common guideline, a 40 A circuit needs at least 12 AWG, a 30 A circuit at least 14 AWG, and a 20 A circuit at least 18 AWG, while the main battery and PDH/PDP leads use 6 AWG. Exact minimum-AWG values can change year to year, so always check the current game manual's wiring rules — which this tool does for you.",
              },
            },
            {
              "@type": "Question",
              name: "How much voltage drop is acceptable on an FRC robot?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "There is no single legal limit, but keeping voltage drop under roughly 3–5% of battery voltage on a run is a good target. Excessive drop on long, thin runs wastes power as heat and can contribute to brownouts under high current. Enter your current, run length, and gauge to see the drop and decide whether to size up.",
              },
            },
            {
              "@type": "Question",
              name: "Why does wire length matter for voltage drop?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Voltage drop equals current × resistance, and a wire's resistance is proportional to its length. Doubling a run doubles its resistance and its voltage drop, so long runs to distant mechanisms often need a thicker gauge than a short run carrying the same current.",
              },
            },
          ],
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
