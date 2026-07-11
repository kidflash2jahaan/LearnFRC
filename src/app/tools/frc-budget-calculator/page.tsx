import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { JsonLd } from "@/components/json-ld";
import { ToolCTA } from "@/components/tools/tool-cta";
import Calculator from "./_calculator";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Team Budget Calculator — What Does an FRC Team Cost?",
  description:
    "Free interactive FRC team budget calculator. Estimate registration, the Kit of Parts, drivetrain, electronics, tools, and travel for a rookie or veteran season — with a sponsor-ready summary. Figures from official FIRST 2025–26 pricing and current vendor listings.",
  alternates: { canonical: `${SITE}/tools/frc-budget-calculator` },
  openGraph: {
    title: "FRC Team Budget Calculator (Free) — LearnFRC",
    description:
      "Estimate what your FRC season will cost — registration, robot, tools, travel — itemized and sponsor-ready.",
    url: `${SITE}/tools/frc-budget-calculator`,
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
          name: "FRC Team Budget Calculator",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          url: `${SITE}/tools/frc-budget-calculator`,
          description:
            "Free interactive FRC team budget calculator — registration, robot, tools, and travel, itemized and sponsor-ready.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "LearnFRC", url: SITE },
        }}
      />
      <Calculator authed={!!user} />
      <ToolCTA
        related={[
          { href: "/blog/frc-team-budget-worksheet", label: "FRC team budget worksheet" },
          { href: "/blog/frc-sponsorship-letter-template", label: "Sponsorship letter template" },
          { href: "/tools/frc-current-budget", label: "Current & brownout checker" },
        ]}
      />
    </main>
  );
}
