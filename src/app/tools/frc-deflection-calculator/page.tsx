import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { JsonLd } from "@/components/json-ld";
import { ToolCTA } from "@/components/tools/tool-cta";
import Calculator from "./_calculator";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Structural Deflection Calculator — Tube & Arm Sag / Bending",
  description:
    "Free FRC deflection calculator. Enter beam type, material (6061-T6 aluminum or steel), cross-section, length, and load to get tip/center sag, bending stress, and a safety factor — for arms, elevators, and drivetrain rails. Beam-mechanics formulas, sourced material properties.",
  alternates: { canonical: `${SITE}/tools/frc-deflection-calculator` },
  openGraph: {
    title: "FRC Structural Deflection Calculator (Free) — LearnFRC",
    description:
      "Will your arm or rail sag? Enter geometry + load for deflection, bending stress, and a safety factor.",
    url: `${SITE}/tools/frc-deflection-calculator`,
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
          name: "FRC Structural Deflection Calculator",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          url: `${SITE}/tools/frc-deflection-calculator`,
          description:
            "Free FRC beam-deflection and bending-stress calculator for arms, elevators, and rails.",
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
              name: "Structural Deflection",
              item: `${SITE}/tools/frc-deflection-calculator`,
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
              name: "How much will my FRC arm or elevator deflect?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Deflection depends on the load, the unsupported length, how the beam is supported, and the material and cross-section's stiffness (its area moment of inertia). Long cantilevered arms made from small tubes deflect the most. Enter your geometry, material, and load above to get the tip or center sag in inches, plus the bending stress and a safety factor.",
              },
            },
            {
              "@type": "Question",
              name: "Is aluminum or steel better for FRC structure?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "It depends on your priority. Steel is about three times stiffer than aluminum for the same shape, so it deflects less, but it is also roughly three times denser. Aluminum (usually 6061-T6) gives far better stiffness-per-weight, which is why most FRC structure is aluminum — you add stiffness with a larger cross-section rather than by switching to steel.",
              },
            },
            {
              "@type": "Question",
              name: "What is a good safety factor for FRC parts?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "A safety factor of at least 2 against yield is a common rule of thumb for FRC structural parts, and more for anything subject to impact or near a person's hands. A factor below 1 means the part is predicted to yield under the given load. This calculator reports the factor so you can add material wherever it is marginal.",
              },
            },
          ],
        }}
      />
      <Calculator authed={!!user} />
      <ToolCTA
        related={[
          { href: "/tools/frc-tipping-calculator", label: "Tip-over & stability" },
          { href: "/blog/frc-elevator-arm-design-guide", label: "Elevator & arm design guide" },
          { href: "/guides", label: "All FRC guides" },
        ]}
      />
    </main>
  );
}
