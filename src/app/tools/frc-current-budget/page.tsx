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
              name: "Current Budget & Brownout",
              item: `${SITE}/tools/frc-current-budget`,
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
              name: "What causes an FRC robot to brown out?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "A brownout happens when battery voltage sags below the roboRIO's threshold (around 6.8 V on the roboRIO 2) because too much current is being drawn at once — often several motors stalling or accelerating at the same instant. To protect itself, the roboRIO sheds load (PWM outputs and some ports cut out), so the robot briefly stops responding.",
              },
            },
            {
              "@type": "Question",
              name: "What is the FRC main breaker current limit?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Every FRC robot runs through a single 120 A main breaker between the battery and the power-distribution board. Sustained draw above 120 A trips it and kills robot power. This tool adds up each mechanism's current so you can see your total against that 120 A ceiling before you're on the field.",
              },
            },
            {
              "@type": "Question",
              name: "How can I prevent brownouts?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Limit peak current: set current limits on your motor controllers, avoid commanding several high-draw mechanisms to full power simultaneously, use a healthy, freshly-charged battery with clean connections, and keep wire gauge adequate. Budgeting your current draw ahead of time — as this calculator does — is the first step.",
              },
            },
          ],
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
