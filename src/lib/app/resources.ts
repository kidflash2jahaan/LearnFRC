import "server-only";
import { createHash } from "node:crypto";
import { getDepartmentSources } from "@/lib/queries";

/**
 * Everything learnfrc.com/resources shows, as data. The page
 * (src/app/resources/page.tsx) renders it and GET /api/app/resources serves it
 * to the app, so the two can never list different links.
 *
 * Two halves, like the page:
 *  - the toolbox: five hand-picked shelves of outside links (the official
 *    docs, the software, the vendors, the forums), defined here;
 *  - the works cited: every source the lessons cite, per department, read
 *    from `departments.sources` (one cached catalogue query).
 */

/** An outside link, with the host printed beside it on the page. */
export type ResourceLink = { title: string; url: string; host: string };

export type ToolboxShelf = {
  /** Mono identifier, e.g. `software-programming`. Also the page's anchor. */
  slug: string;
  name: string;
  /** One line saying what job this shelf is for. Printed under the heading. */
  blurb: string;
  links: ResourceLink[];
};

export type SourceDepartment = {
  slug: string;
  name: string;
  /** Every cited source, in the department's own order. The page prints the
   *  first SOURCES_PER_DEPT and states the full count. */
  sources: ResourceLink[];
};

export type ResourcesData = {
  shelves: ToolboxShelf[];
  /** Only departments that cite at least one source, in catalogue order. */
  departments: SourceDepartment[];
  sourcesPerDepartment: number;
  totals: {
    /** Links across every toolbox shelf. */
    links: number;
    shelves: number;
    /** Sources cited across every department. */
    sources: number;
    /** Departments that cite at least one source. */
    departments: number;
  };
};

/**
 * How many citations the page prints per department.
 *
 * The catalogue cites 168 sources across 11 departments. Printed in full that
 * is a 179-row table, roughly 7,700px of it, and it buries everything under it
 * for a list nobody scrolls to the end of. Six per department answers the
 * question this section exists for ("is this written from anything real, and
 * what") in a block you can take in at a glance, and every group prints its
 * true total beside the name so the trim is stated rather than hidden.
 */
export const SOURCES_PER_DEPT = 6;

/** Strip protocol and www so the host reads as a label, not a URL. One copy,
 *  shared by the toolbox, the citations table and the app. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Mono identifier for a shelf, e.g. `software-programming`. */
function shelfSlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type CuratedShelf = {
  category: string;
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
const CURATED: CuratedShelf[] = [
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
        // MKCad was the FRC Onshape parts library for years and the name is
        // still what mentors say out loud, but mkcad.com lapsed and now
        // resolves to a domain-resale page. FRCDesign.org is the successor
        // and carries the same library, so the link points there and the
        // old name stays in the label for anyone searching for it.
        title: "FRCDesign.org, the Onshape FRC parts library (formerly MKCad)",
        url: "https://frcdesign.org",
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

const withHost = (l: { title: string; url: string }): ResourceLink => ({
  title: l.title,
  url: l.url,
  host: hostLabel(l.url),
});

/** The toolbox shelves. Compiled in, so built once per server instance. */
const SHELVES: ToolboxShelf[] = CURATED.map((s) => ({
  slug: shelfSlug(s.category),
  name: s.category,
  blurb: s.blurb,
  links: s.links.map(withHost),
}));

/** The whole page's data. One cached catalogue query, the same one as before. */
export async function loadResources(): Promise<ResourcesData> {
  const all = (await getDepartmentSources()) ?? [];
  const departments: SourceDepartment[] = all
    .filter((d) => d.sources.length > 0)
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      sources: d.sources.map(withHost),
    }));

  return {
    shelves: SHELVES,
    departments,
    sourcesPerDepartment: SOURCES_PER_DEPT,
    totals: {
      links: SHELVES.reduce((sum, s) => sum + s.links.length, 0),
      shelves: SHELVES.length,
      sources: departments.reduce((sum, d) => sum + d.sources.length, 0),
      departments: departments.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  GET /api/app/resources                                             */
/* ------------------------------------------------------------------ */

export type ResourcesPayload = {
  /** The toolbox shelves in page order, without their links. */
  shelves: { slug: string; name: string; blurb: string }[];
  /** Every toolbox link in page order (shelf by shelf); `shelf` is its shelf's slug. */
  toolbox: (ResourceLink & { shelf: string })[];
  departments: SourceDepartment[];
  sourcesPerDepartment: number;
  totals: ResourcesData["totals"];
  /** Changes whenever anything above changes. */
  version: string;
};

export async function buildResourcesPayload(): Promise<ResourcesPayload> {
  const data = await loadResources();
  const body = {
    shelves: data.shelves.map(({ slug, name, blurb }) => ({ slug, name, blurb })),
    toolbox: data.shelves.flatMap((s) => s.links.map((l) => ({ ...l, shelf: s.slug }))),
    departments: data.departments,
    sourcesPerDepartment: data.sourcesPerDepartment,
    totals: data.totals,
  };
  const version = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex")
    .slice(0, 16);
  return { ...body, version };
}
