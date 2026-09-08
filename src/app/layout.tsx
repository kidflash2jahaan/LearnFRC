import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Space_Mono, Caveat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { JsonLd } from "@/components/json-ld";
import { PresenceBeacon } from "@/components/presence-beacon";
import { SourceCapture } from "@/components/source-capture";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getOverviewStats } from "@/lib/queries";

/* Three faces with fixed jobs, per docs/NOTEBOOK-SYSTEM.md. Nothing else is
   loaded, and nothing else may be. */

// Everything structural: headings at 800, body at 400. `axes` is the load-
// bearing part here: next/font ships only the `wght` axis of a variable font
// by default, so without opsz and wdth the `font-variation-settings` the
// stylesheet asks for would silently do nothing.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  axes: ["opsz", "wdth"],
  display: "swap",
});

// All data furniture: counts, department slugs, timestamps, figures, hints,
// buttons, code. Not a variable family, so both weights are named.
const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
  display: "swap",
});

// Ballpoint margin annotations only. The variable cut covers 400 to 700, which
// is the 500 and 600 the system uses, in one file.
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

/**
 * Dynamic so the two figures in these descriptions cannot go stale. They are
 * the site-wide SEO fallback and the OpenGraph card text, which means a wrong
 * number here is what Google and every shared link show. getOverviewStats is
 * cached for a day and refreshed by the "catalog" tag, so this costs one
 * memoised read, not a query per request.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { lessonCount, deptCount } = await getOverviewStats().catch(() => ({
    lessonCount: 0,
    deptCount: 0,
  }));
  // Fall back to wording with no figures rather than printing a zero.
  const n = lessonCount > 0 ? lessonCount.toLocaleString() : null;
  const d = deptCount > 0 ? String(deptCount) : null;

  return {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LearnFRC, every job on an FRC team, written down",
    template: "%s · LearnFRC",
  },
  description:
    `${n ? `${n} free lessons` : "Free lessons"} covering every job on a FIRST Robotics Competition team: mechanical, CAD, programming, electrical, controls, drive team, scouting, strategy, business, media and safety. No account needed to read.`,
  keywords: [
    "FRC",
    "FIRST Robotics Competition",
    "robotics",
    "WPILib",
    "swerve drive",
    "Onshape",
    "Impact Award",
    "FRC programming",
    "learn robotics",
    "STEM",
  ],
  // The author link points at /about, which is where the site's E-E-A-T lives
  // (who writes the lessons, what they're drafted from, how they're checked).
  authors: [{ name: "Jahaan Pardhanani", url: `${SITE_URL}/about` }],
  creator: "Jahaan Pardhanani",
  publisher: "LearnFRC",
  // NOTE: feed autodiscovery is deliberately NOT declared here as
  // `alternates.types`. Metadata is *shallow* merged, so every page that sets
  // its own `alternates` (all public pages do, for `canonical`) would replace
  // the whole object and drop the feed link. Verified: it never reached the
  // homepage <head>. It's rendered as a real <link> in the body instead, which
  // React hoists into <head> on every route. Declaring it in both places
  // emits the tag twice on the pages that don't override `alternates`.
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "LearnFRC, every job on an FRC team, written down",
    description:
      `${n ? `${n} free lessons` : "Free lessons"}${d ? ` across ${d} departments` : ""} of FIRST Robotics Competition, from swerve geometry to sponsor letters. No account needed to read.`,
    siteName: "LearnFRC",
  },
  // Card type only: leaving title/description unset lets every page's own
  // OpenGraph values mirror into its Twitter card (hard-coding them here made
  // all 578 pages share the homepage card).
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Discover large-card eligibility + unclamped snippets.
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  };
}

export const viewport: Viewport = {
  // The paper ground, so the mobile browser chrome matches the page edge.
  themeColor: "#E6E8E3",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${bricolage.variable} ${spaceMono.variable} ${caveat.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        {/* Feed autodiscovery. React hoists this into <head> on every route,
            which the `alternates.types` metadata above cannot do on its own:
            metadata is shallow-merged, so every page that declares its own
            `alternates` (all of them, for canonical) would drop the feed link. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="LearnFRC articles"
          href={`${SITE_URL}/rss.xml`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('perf-mode')==='on')document.documentElement.dataset.perf='on';}catch(e){}`,
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                url: SITE_URL,
                name: "LearnFRC",
                description:
                  "Free, structured guides for every department of the FIRST Robotics Competition.",
                publisher: { "@id": `${SITE_URL}/#org` },
              },
              {
                "@type": "Organization",
                "@id": `${SITE_URL}/#org`,
                name: "LearnFRC",
                url: SITE_URL,
                logo: `${SITE_URL}/opengraph-image`,
                description:
                  "A free, complete learning platform for the FIRST Robotics Competition.",
                // Only URLs that are verifiably ours belong here: the public
                // source repo. No invented social profiles.
                sameAs: ["https://github.com/kidflash2jahaan/LearnFRC"],
                founder: { "@id": `${SITE_URL}/#person` },
              },
              {
                // Site-wide author identity, described in full on /about. Every
                // Article's `author` should reference this @id.
                "@type": "Person",
                "@id": `${SITE_URL}/#person`,
                name: "Jahaan Pardhanani",
                url: `${SITE_URL}/about`,
                sameAs: ["https://github.com/kidflash2jahaan"],
              },
            ],
          }}
        />
        {/* `nb-skip` parks itself off-screen and jumps to the top-left corner
            on focus. Kept as a plain class rather than sr-only utilities so
            the skip link is styled by the same kit as everything else. */}
        <a href="#main-content" className="nb-skip">
          Skip to content
        </a>
        <Providers>
          <ScrollProgress />
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
        <Analytics />
        <SpeedInsights />
        <PresenceBeacon />
        {/* First-touch acquisition cookie (lf_src). Still load-bearing: the
            signup action reads the cookie off the request and stores it on the
            profile, which is where referral credit comes from. It never touched
            the pageview beacon's table, so it is unaffected by traffic moving
            to Vercel. <Analytics/> above is what counts pageviews now. */}
        <SourceCapture />
      </body>
    </html>
  );
}
