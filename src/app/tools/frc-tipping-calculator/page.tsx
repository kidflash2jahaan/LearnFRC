import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { JsonLd } from "@/components/json-ld";
import { ToolCTA } from "@/components/tools/tool-cta";
import Calculator from "./_calculator";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

export const metadata: Metadata = {
  title: "FRC Robot Tip-Over Calculator — Center of Gravity & Stability",
  description:
    "Free FRC tip-over and traction-stability calculator. Enter your track width, wheelbase, and center-of-gravity height to find the maximum turning acceleration and ramp/incline angle before your robot tips — plus a traction-limited pushing-force estimate. Exact rigid-body statics.",
  alternates: { canonical: `${SITE}/tools/frc-tipping-calculator` },
  openGraph: {
    title: "FRC Tip-Over & Stability Calculator (Free) — LearnFRC",
    description:
      "Will your robot tip? Enter track width, wheelbase, and CoG height for tip acceleration and ramp angle.",
    url: `${SITE}/tools/frc-tipping-calculator`,
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
          name: "FRC Robot Tip-Over & Stability Calculator",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          url: `${SITE}/tools/frc-tipping-calculator`,
          description:
            "Free FRC tip-over and traction-stability calculator from track width, wheelbase, and center-of-gravity height.",
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
              name: "Tip-Over & Stability",
              item: `${SITE}/tools/frc-tipping-calculator`,
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
              name: "What makes an FRC robot tip over?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "A robot tips when the horizontal force on it — from hard turning, a sudden stop, or an incline — pushes its effective center of gravity past the edge of its wheelbase. A higher center of gravity, a narrower track width, and higher acceleration all lower the threshold. This calculator turns your geometry into the maximum turning acceleration and ramp angle before that happens.",
              },
            },
            {
              "@type": "Question",
              name: "How do I lower my robot's center of gravity?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Mount the heaviest components — the battery, motors, and gearboxes — as low and as centered as possible, keep tall mechanisms retracted while driving, and avoid unnecessary height. Even a few inches of CoG height meaningfully changes how hard you can turn or how steep a ramp you can climb before tipping.",
              },
            },
            {
              "@type": "Question",
              name: "Does a wider robot resist tipping better?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Tipping resistance scales with the ratio of half the track width (or wheelbase) to the center-of-gravity height. A wider or longer wheelbase, or a lower CoG, raises the acceleration and incline angle the robot can handle before it tips — try different values above to see the effect.",
              },
            },
          ],
        }}
      />
      <Calculator authed={!!user} />
      <ToolCTA
        related={[
          { href: "/tools/frc-current-budget", label: "Current & brownout checker" },
          { href: "/tools/frc-wire-gauge-calculator", label: "Wire gauge & voltage drop" },
          { href: "/guides", label: "All FRC guides" },
        ]}
      />
    </main>
  );
}
