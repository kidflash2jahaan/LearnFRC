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
              name: "Team Budget Calculator",
              item: `${SITE}/tools/frc-budget-calculator`,
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
              name: "How much does it cost to start an FRC team?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "A rookie FRC team typically needs about $6,000–$8,000 for its first season. The largest fixed cost is the roughly $6,000 rookie registration — which includes the Kit of Parts and entry to one event — followed by tools, the robot's drivetrain and electronics, and travel. Veteran teams pay a lower per-event fee but often spend more on the robot itself. Itemize your own number with the calculator above.",
              },
            },
            {
              "@type": "Question",
              name: "What is the FRC registration fee?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "For the 2025–26 season, rookie registration is about $6,000 and includes the Kit of Parts and entry to one event; each additional regional event costs roughly $4,000. District teams pay a different, lower per-event structure. Always confirm current pricing on the official FIRST cost page before you budget.",
              },
            },
            {
              "@type": "Question",
              name: "How do FRC teams pay for all of this?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Most teams fund their season with a mix of corporate and local sponsorships, FIRST and state/NASA grants, school or booster-club support, and fundraisers. A clear, itemized budget — like the sponsor-ready summary this tool produces — is the single most persuasive thing to put in front of a potential sponsor.",
              },
            },
          ],
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
