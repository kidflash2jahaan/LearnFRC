import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getDepartmentSources } from "@/lib/queries";
import { FeedbackForm } from "@/components/feedback-form";
import { ShelfBin, hostLabel } from "./_toolbox-panel";
import { ShelfRail, type RailItem } from "./_shelf-rail";

export const metadata: Metadata = {
  title: "FRC Resources: Tools, Docs & Links",
  description:
    "The essential FRC links: official docs, software, vendors, community, and learning resources, plus the sources behind every LearnFRC guide.",
  alternates: { canonical: "/resources" },
};

type Shelf = {
  category: string;
  /** One line saying what job this shelf is for. Printed under the heading. */
  blurb: string;
  links: { title: string; url: string }[];
};

/**
 * The toolbox, unchanged in content from the version before the rebuild.
 *
 * What is gone is the per-shelf colour and icon that used to sit beside each
 * heading. A shelf is identified by its name and its mono slug in this system,
 * the same way a department is, so five accent hues would have been five
 * meanings the palette does not have.
 */
const CURATED: Shelf[] = [
  {
    category: "Official FIRST",
    blurb: "The manual, season materials, and game tools straight from FIRST.",
    links: [
      {
        title: "FIRST Robotics Competition",
        url: "https://www.firstinspires.org/robotics/frc",
      },
      {
        title: "FRC Game & Season Materials",
        url: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
      },
      {
        title: "FRC Driver Station & Game Tools",
        url: "https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-2/frc-game-tools.html",
      },
    ],
  },
  {
    category: "Software & Programming",
    blurb:
      "WPILib and the vision, path, and trajectory tools your code leans on.",
    links: [
      { title: "WPILib Documentation", url: "https://docs.wpilib.org" },
      { title: "PathPlanner", url: "https://pathplanner.dev" },
      { title: "Choreo (trajectory tool)", url: "https://choreo.autos" },
      { title: "PhotonVision", url: "https://docs.photonvision.org" },
      {
        title: "Limelight Documentation",
        url: "https://docs.limelightvision.io",
      },
    ],
  },
  {
    category: "CAD & Design",
    blurb: "Model the robot before you cut metal. Free CAD, built for FRC.",
    links: [
      { title: "Onshape", url: "https://www.onshape.com" },
      {
        title: "Onshape for FRC (FeatureScript/MKCad)",
        url: "https://www.mkcad.com",
      },
    ],
  },
  {
    category: "Hardware & Vendors",
    blurb: "Where the motors, gearboxes, and structure come from.",
    links: [
      { title: "REV Robotics", url: "https://www.revrobotics.com" },
      {
        title: "CTR Electronics (Phoenix)",
        url: "https://store.ctr-electronics.com",
      },
      { title: "AndyMark", url: "https://www.andymark.com" },
      { title: "WestCoast Products (WCP)", url: "https://wcproducts.com" },
    ],
  },
  {
    category: "Community & Data",
    blurb: "Forums and match data, the collective brain of the FRC world.",
    links: [
      { title: "Chief Delphi (forums)", url: "https://www.chiefdelphi.com" },
      { title: "The Blue Alliance", url: "https://www.thebluealliance.com" },
      { title: "Statbotics", url: "https://www.statbotics.io" },
    ],
  },
];

/**
 * Hand angle per bin, in shelf order.
 *
 * Much smaller than the angle on an index card: a bin runs the full width of
 * the content column, where one degree is fourteen pixels of vertical drift and
 * stops reading as "nobody straightened it". No two are the same.
 */
const BIN_TILT = ["-0.35deg", "0.28deg", "-0.2deg", "0.32deg", "-0.26deg"];

/**
 * How many citations to print per department.
 *
 * The catalogue cites 168 sources across 11 departments. Printed in full that
 * is a 179-row table, roughly 7,700px of it, and it buries everything under it
 * for a list nobody scrolls to the end of. Six per department answers the
 * question this section exists for ("is this written from anything real, and
 * what") in a block you can take in at a glance, and every group prints its
 * true total beside the name so the trim is stated rather than hidden.
 */
const SOURCES_PER_DEPT = 6;

/** Mono identifier for a shelf, e.g. `software-programming`. */
function shelfSlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Anchor id, so the rail and the bins agree on the jump target. */
function shelfId(category: string): string {
  return `shelf-${shelfSlug(category)}`;
}

/**
 * /resources is the pocket at the back of the binder, the one holding other
 * people's manuals.
 *
 * Nobody reads this page. They arrive with a name they half-remember, find it,
 * and leave, so every decision here serves scan-and-go: the contents list is
 * the first thing in the masthead rather than a paragraph about curation, every
 * link prints the host it goes to because the domain is how you recognise a doc
 * you already trust, and an index rail follows you down the shelves.
 *
 * The second half is the works-cited page. It is set as a real table, because
 * that is what a bibliography is, and because the question it answers is a
 * lookup ("what are the electrical guides built on") rather than a read.
 *
 * Server Component. Same single cached catalogue fetch as before.
 */
export default async function ResourcesPage() {
  const departments = await getDepartmentSources();

  const totalLinks = CURATED.reduce((sum, s) => sum + s.links.length, 0);
  const withSources = (departments ?? []).filter((d) => d.sources.length > 0);
  const totalSources = withSources.reduce((sum, d) => sum + d.sources.length, 0);

  const railItems: RailItem[] = CURATED.map((shelf) => ({
    id: shelfId(shelf.category),
    label: shelf.category,
    count: shelf.links.length,
  }));

  return (
    <>
      {/* ===================== MASTHEAD =====================
          Two columns, and the right one is the contents list rather than a card
          of figures. On a reference page the table of contents IS the value, so
          it goes above the fold and doubles as the first set of jump links. */}
      <section className="nb-wrap grid items-start gap-[clamp(1.6rem,4vw,3.4rem)] pb-[clamp(2.2rem,4.5vw,3.4rem)] pt-[clamp(2.2rem,5vw,4rem)] min-[900px]:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <div>
          <p className="nb-marker">
            reference / {totalLinks} links / {CURATED.length} shelves
          </p>

          <h1 className="max-w-[17ch]">
            Everything a build season makes you{" "}
            <span className="nb-mark">look up</span>.
          </h1>

          <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
            The official docs, the software your code depends on, the vendors
            you order from, and the two forums where the answers actually are.
          </p>

          <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap gap-3">
            <a href="#toolbox" className="nb-btn">
              Open the toolbox
            </a>
            <a href="#sources" className="nb-btn-ghost">
              What the lessons cite
            </a>
          </div>
        </div>

        <div>
          <nav aria-label="Shelves in this page">
            <p className="nb-slug border-b-2 border-ink pb-2">on the shelves</p>
            <ul>
              {CURATED.map((shelf, i) => (
                <li
                  key={shelf.category}
                  className="border-b border-dashed border-rule"
                >
                  <a
                    href={`#${shelfId(shelf.category)}`}
                    className="group flex min-h-11 items-baseline gap-3 py-2.5"
                  >
                    <span className="nb-slug shrink-0 font-bold text-blue">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 font-semibold leading-snug decoration-blue decoration-2 underline-offset-4 group-hover:text-blue group-hover:underline">
                      {shelf.category}
                    </span>
                    <span className="nb-slug shrink-0">
                      {shelf.links.length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <p className="nb-pen mt-4 max-w-[24ch] rotate-[-1.1deg]">
            the wpilib docs answer most of it
          </p>
        </div>
      </section>

      {/* ===================== THE TOOLBOX =====================
          A sticky index rail beside the bins. The rail is the one place on this
          page that needs the client, because which shelf you are looking at is
          a fact about the scroll position. */}
      <section
        id="toolbox"
        className="nb-wrap nb-rule py-[clamp(2.4rem,5vw,4rem)]"
        aria-labelledby="toolbox-heading"
      >
        <div className="mb-[clamp(1.6rem,3.4vw,2.4rem)] max-w-[46rem]">
          <h2 id="toolbox-heading" className="max-w-[20ch]">
            Five shelves, filed the way a pit is.
          </h2>
          <p className="nb-sub mt-3">
            Each shelf holds the links for one job, so the one you want is where
            you would reach for it. Every link leaves this site and opens in a
            new tab.
          </p>
        </div>

        <div className="grid items-start gap-[clamp(1.4rem,3vw,2.4rem)] min-[1000px]:grid-cols-[15rem_minmax(0,1fr)]">
          {/* The rail is a convenience, not the only route to a shelf: the
              contents list in the masthead reaches every one of them, so this
              is safe to drop below 1000px where a sticky column would eat half
              the screen. */}
          <div className="sticky top-[5.5rem] hidden min-[1000px]:block">
            <ShelfRail items={railItems} />
          </div>

          <div className="grid min-w-0 gap-[clamp(1.1rem,2.4vw,1.7rem)]">
            {CURATED.map((shelf, i) => (
              <ShelfBin
                key={shelf.category}
                id={shelfId(shelf.category)}
                index={i}
                slug={shelfSlug(shelf.category)}
                category={shelf.category}
                blurb={shelf.blurb}
                links={shelf.links}
                tilt={BIN_TILT[i % BIN_TILT.length]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===================== THE WORKS CITED =====================
          Set as a table, because a bibliography is one. Nothing else in this
          section of the binder is tabular, so the change of form is doing work:
          it says these are references to check rather than tools to open. */}
      <section
        id="sources"
        className="nb-wrap nb-rule py-[clamp(2.4rem,5vw,4rem)]"
        aria-labelledby="sources-heading"
      >
        <div className="mb-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <h2 id="sources-heading" className="max-w-[19ch]">
              What the lessons are built on.
            </h2>
            <p className="nb-sub mt-3">
              Every guide here is written from published references rather than
              from memory. These are them, department by department, so you can
              go and check the original. Long lists are trimmed to the first{" "}
              {SOURCES_PER_DEPT}, and the figure beside each department is the
              full count.
            </p>
          </div>

          {withSources.length > 0 && (
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <p className="nb-count">
                {totalSources}
                <small>cited sources</small>
              </p>
              <p className="nb-count">
                {withSources.length}
                <small>departments</small>
              </p>
            </div>
          )}
        </div>

        {withSources.length === 0 ? (
          <div className="nb-note max-w-[46rem]">
            <p className="nb-slug">nothing filed yet</p>
            <p className="mt-1.5 text-[0.95rem]">
              The citation list fills in as each department&apos;s guides are
              published. The toolbox above is complete either way.
            </p>
          </div>
        ) : (
          <div className="nb-scroll">
            <table className="nb-table min-w-[34rem]">
              <caption className="sr-only">
                Sources cited by the LearnFRC guides, grouped by department
              </caption>
              <thead>
                <tr>
                  <th scope="col">source</th>
                  <th scope="col">host</th>
                </tr>
              </thead>

              {withSources.map((dept) => (
                <tbody key={dept.slug}>
                  <tr>
                    {/* A grouping header row, so a screen reader announces the
                        department once for the block instead of repeating it
                        into every line, and so the eye gets the same. */}
                    <th
                      scope="colgroup"
                      colSpan={2}
                      className="whitespace-normal pt-8 font-sans text-[1.05rem] font-extrabold tracking-[-0.02em] text-ink"
                    >
                      {dept.name}
                      <span className="nb-slug ml-3 font-normal">
                        dept / {dept.slug}
                      </span>
                      <span className="nb-slug ml-3 font-normal">
                        {dept.sources.length > SOURCES_PER_DEPT
                          ? `first ${SOURCES_PER_DEPT} of ${dept.sources.length}`
                          : `${dept.sources.length} cited`}
                      </span>
                    </th>
                  </tr>

                  {dept.sources.slice(0, SOURCES_PER_DEPT).map((source, i) => (
                    <tr key={`${dept.slug}-${i}`}>
                      {/* The cell padding is zeroed and the height carried by
                          the link instead. Otherwise the 44px touch target and
                          the table's own vertical padding stack into a 66px
                          row, and a bibliography that airy stops being
                          scannable at the length these run to. */}
                      <td className="py-0 align-middle">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center font-medium decoration-blue decoration-2 underline-offset-4 hover:text-blue hover:underline"
                        >
                          {source.title}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </td>
                      <td className="nb-slug whitespace-nowrap py-0 align-middle">
                        {hostLabel(source.url)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </section>

      {/* ===================== THE SUGGESTION SLIP =====================
          Small, off to the left, and taped down. It is the only thing on the
          page asking the reader for something rather than handing them
          something, so it gets the smallest surface here. */}
      <section className="nb-wrap nb-rule py-[clamp(2.6rem,5vw,4.2rem)]">
        <div className="grid items-start gap-[clamp(1.2rem,3vw,2.6rem)] min-[900px]:grid-cols-[minmax(0,38rem)_minmax(0,1fr)]">
          <div
            id="suggest"
            className="nb-box nb-tilt p-[clamp(1.2rem,2.6vw,1.9rem)]"
            style={{ "--tilt": "-0.5deg" } as CSSProperties}
          >
            <span
              className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]"
              aria-hidden="true"
            />

            <p className="nb-slug">suggestion slip</p>
            <h2 className="mt-2 text-[clamp(1.3rem,1.05rem+1vw,1.85rem)]">
              Missing something worth linking.
            </h2>
            <p className="mt-3 max-w-[50ch] text-[0.96rem] leading-[1.5] text-graphite">
              If a doc, a tool or a forum thread belongs on one of these
              shelves, say so. Naming the shelf is what turns a suggestion into
              a to-do.
            </p>

            <div className="mt-[clamp(1.2rem,2.6vw,1.7rem)]">
              <FeedbackForm page="/resources" />
            </div>
          </div>

          <p className="nb-pen max-w-[22ch] rotate-[1.3deg] min-[900px]:mt-8">
            a link that saved you an hour is worth sending
          </p>
        </div>
      </section>
    </>
  );
}
