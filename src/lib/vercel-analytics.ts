import "server-only";

/**
 * Vercel Web Analytics, server side.
 *
 * Every traffic number in the admin panel comes from here. The homegrown
 * `page_views` beacon that used to answer these questions is gone: Vercel is
 * the more accurate measure, so the beacon was deleted rather than left running
 * as a second, worse answer (see the note at the top of `src/lib/admin.ts`).
 * Application facts that Vercel cannot answer, anything joined to a user id,
 * still come from the database through `src/lib/admin.ts`. Nothing in this file
 * reads the database, and nothing in this file invents a number Vercel did not
 * return.
 *
 * WHAT THE API ACTUALLY ANSWERS
 * The capability map in `docs/VERCEL-ANALYTICS.md` was probed against this
 * project, and re-probed on 2026-09-06 while writing this file. The parts that
 * shape the code:
 *
 *  - Two endpoints per dataset. `visits/count` returns
 *    `{ data: { visitors, pageviews } }`. `visits/aggregate` returns
 *    `{ data: [ { <dimension>, visitors, pageviews } ] }`, and for a time
 *    granularity each row is `{ timestamp, visitors, pageviews }`.
 *  - The window params are `since` and `until`, as ISO instants. `from`/`to`
 *    are silently ignored on `count` and the whole history comes back instead,
 *    which is the easiest way to publish a wrong number from this API.
 *  - `limit` caps at 100 and only applies to categorical dimensions. A time
 *    series ignores it and returns every bucket.
 *  - `by=day` fails past 62 buckets, `by=hour` past 168, with
 *    `code: "invalid_group_by"`. Granularity is picked from the window here so
 *    that never reaches a panel.
 *  - Grouping by two dimensions needs REPEATED params (`by=day&by=deviceType`).
 *    A comma-joined `by=day,deviceType` is rejected with a misleading "should
 *    be equal to one of the allowed values", and passing an array through
 *    `URLSearchParams` produces exactly that broken comma form. Everything here
 *    goes through `params.append()` one value at a time.
 *  - Filters are OData on both endpoints: `route eq '/guides'`,
 *    `referrerHostname ne ''`, joined with `and`. Single quotes inside a value
 *    are escaped by doubling them.
 *  - `environment=production` as a top-level param is IGNORED. Restricting to
 *    production needs `filter=environment eq 'production'`, which is the
 *    default here.
 *
 * WHAT IT DOES NOT ANSWER, and must never be faked:
 *  - Bounce rate. The dashboard shows it, the API has no bounce dimension and
 *    no bounce metric. `metrics=bounceRate` is accepted and silently ignored.
 *  - Hostnames. No spelling of a hostname dimension is accepted.
 *  - Every `utm*` dimension returns 402 on this plan.
 *  See `ANALYTICS_GAPS` at the bottom: the panel renders those as honest lines
 *  pointing at the dashboard, not as substitutes.
 *
 * CACHING
 * Each query is a `fetch` with an explicit `next.revalidate`, which is what
 * opts it into the Data Cache even though the admin route is dynamic and the
 * request carries an `Authorization` header. Next only writes a cache entry for
 * a 200, so a 403 or a rate-limit is never cached and the next render retries.
 * The window's `until` is snapped down to the revalidate bucket so the URL, and
 * therefore the cache key, is stable for exactly as long as the entry lives.
 *
 * SECRETS
 * The token is read from the environment inside this module, sent only as a
 * request header, and never returned, logged or embedded in a message. Every
 * export is server-only. Nothing here may be imported by a client component.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = "https://api.vercel.com/v1/query/web-analytics";

/**
 * Seconds a cached query lives. The API allows 400 requests an hour
 * (`x-ratelimit-limit: 400`). A full overview is 12 queries, so at five
 * minutes a continuously-watched admin panel costs about 144 an hour, which
 * leaves room for the odd extra panel.
 */
const DEFAULT_REVALIDATE = 300;

/** Cache tag, so an admin refresh can drop every traffic panel at once. */
export const ANALYTICS_CACHE_TAG = "vercel-analytics";

const DEFAULT_WINDOW_DAYS = 30;

/** `limit` is rejected above this. Verified: 101 returns a 400. */
const MAX_LIMIT = 100;

/**
 * Each granularity has its own span cap, and going over is a 400, not a
 * truncated answer. Probed: `by=day` is refused past 62 buckets, `by=week` past
 * 26 weeks ("Can only query up to 26 weeks of data"), `by=hour` past 168 hours.
 * `by=month` covers everything left up to the plan's 366 days.
 */
const MAX_DAY_BUCKETS = 62;
const MAX_WEEK_SPAN_DAYS = 182;

/**
 * How far back this plan reads, whatever the granularity. Ask for more and the
 * API answers "the pro plan only grants access to the latest 366 days of data",
 * so windows are clamped here rather than letting a panel build one that cannot
 * be answered. Probed: 366 days is accepted, beyond that is refused. It does
 * not bind today anyway, the first recorded visit is 2026-06-19.
 */
const MAX_WINDOW_DAYS = 366;

const DAY_MS = 86_400_000;

type Credentials = {
  token: string;
  projectId: string;
  teamId: string | null;
};

/**
 * Reads the three env vars. None of them are committed, and a missing token is
 * an ordinary state rather than a crash: every query then resolves to a
 * `not-configured` failure the panel renders as a sentence.
 */
function readCredentials(): Credentials | null {
  const token = process.env.VERCEL_ANALYTICS_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  return { token, projectId, teamId: teamId || null };
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Why a query could not answer. Every one of these has been produced against
 * the live API except `unreachable` and `server-error`, which are the network
 * and 5xx cases.
 */
export type AnalyticsFailureKind =
  | "not-configured" // VERCEL_ANALYTICS_TOKEN or VERCEL_PROJECT_ID is unset
  | "unauthorized" // 401, or 403 with invalidToken: the token is dead
  | "forbidden" // 403: the token is real but cannot read this project
  | "not-found" // 404: wrong project, or Web Analytics was never enabled
  | "plan-limited" // 402: this plan does not include what was asked for
  | "rate-limited" // 429: 400 requests an hour is spent
  | "bad-request" // 400: the query is malformed, which is a bug in this file
  | "unreachable" // network error, timeout, or a non-JSON body
  | "server-error"; // 5xx at Vercel

export type AnalyticsFailure = {
  ok: false;
  kind: AnalyticsFailureKind;
  /**
   * One plain sentence, safe to render as-is. Never contains the token, the
   * project id, or a URL.
   */
  message: string;
  /** Seconds to wait before retrying. Only set for `rate-limited`. */
  retryAfterSeconds?: number;
  /** HTTP status when there was one. For a support note, not for a panel. */
  status?: number;
  window: TrafficWindow;
};

export type AnalyticsSuccess<T> = {
  ok: true;
  data: T;
  window: TrafficWindow;
  /**
   * The query worked and Vercel had nothing in this window. A panel must say
   * "no traffic recorded in this window" rather than draw zeroes, which read
   * like a broken integration.
   */
  empty: boolean;
};

export type AnalyticsResult<T> = AnalyticsSuccess<T> | AnalyticsFailure;

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

export type TrafficWindow = {
  /** Inclusive start, ISO instant. */
  since: string;
  /** Exclusive end, ISO instant. Snapped down to the cache bucket. */
  until: string;
  /** Whole days covered, which is what picks the series granularity. */
  days: number;
  /** "last 30 days". Panels print this next to the Vercel source label. */
  label: string;
};

/**
 * Builds the window every query shares.
 *
 * `since` is UTC midnight `days - 1` days back, so "30 days" means 29 whole
 * days plus today, the way the dashboard reads it. `until` is now, floored to
 * the revalidate bucket: floor it and the URL stops changing on every render,
 * which is the difference between a cache that hits and one that never does.
 */
export function trafficWindow(
  days: number = DEFAULT_WINDOW_DAYS,
  options: { revalidate?: number; now?: number } = {}
): TrafficWindow {
  const span = Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.floor(days)));
  const bucketMs = Math.max(1, options.revalidate ?? DEFAULT_REVALIDATE) * 1000;
  const now = options.now ?? Date.now();
  const until = new Date(Math.floor(now / bucketMs) * bucketMs);

  const start = new Date(until.getTime() - (span - 1) * DAY_MS);
  start.setUTCHours(0, 0, 0, 0);

  return {
    since: start.toISOString(),
    until: until.toISOString(),
    days: span,
    label: span === 1 ? "today" : `last ${span} days`,
  };
}

function resolveWindow(
  window: TrafficWindow | number | undefined,
  revalidate: number
): TrafficWindow {
  if (typeof window === "object") return window;
  return trafficWindow(window ?? DEFAULT_WINDOW_DAYS, { revalidate });
}

/**
 * The window immediately before `window`, same length. Used for the "vs the
 * previous period" comparison, so the delta is measured against a real query
 * rather than estimated from the series.
 */
export function previousWindow(window: TrafficWindow): TrafficWindow {
  const until = new Date(window.since);
  const since = new Date(until.getTime() - window.days * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);
  return {
    since: since.toISOString(),
    until: until.toISOString(),
    days: window.days,
    label: `previous ${window.days} days`,
  };
}

// ---------------------------------------------------------------------------
// Dimensions and filters
// ---------------------------------------------------------------------------

/**
 * The dimensions this plan actually groups by. `utm*` is deliberately absent:
 * it returns 402 here, so there is no way to build a panel for it that is not
 * an error message.
 */
export type TrafficDimension =
  | "requestPath"
  | "route"
  | "referrerHostname"
  | "country"
  | "deviceType"
  | "browserName"
  | "osName"
  | "environment"
  | "flags";

export type TrafficGranularity = "day" | "week" | "month";

export type FilterClause = {
  dimension: TrafficDimension;
  op: "eq" | "ne";
  value: string;
};

/**
 * The one place an OData filter is built. Values are escaped by doubling any
 * single quote, which the API accepts, so a path with an apostrophe in it
 * cannot break out of the literal.
 */
function toODataFilter(clauses: FilterClause[]): string | null {
  if (clauses.length === 0) return null;
  return clauses
    .map((c) => `${c.dimension} ${c.op} '${c.value.replaceAll("'", "''")}'`)
    .join(" and ");
}

const PRODUCTION_ONLY: FilterClause = {
  dimension: "environment",
  op: "eq",
  value: "production",
};

/** Options every query accepts. */
export type TrafficQuery = {
  /** Days back, or a window from `trafficWindow`. Defaults to 30 days. */
  window?: TrafficWindow | number;
  /** Extra clauses, ANDed with the environment clause. */
  filter?: FilterClause[];
  /**
   * Include preview deployments. Off by default: preview traffic is the team
   * looking at its own branches, and counting it as reach is a lie.
   */
  includePreview?: boolean;
  /** Seconds the answer stays cached. Defaults to 300. */
  revalidate?: number;
};

// ---------------------------------------------------------------------------
// The fetch layer. Auth lives here and nowhere else.
// ---------------------------------------------------------------------------

type RawCount = { visitors?: number; pageviews?: number; count?: number };
type RawAggregateRow = Record<string, string | number | undefined>;

type QuerySpec = {
  dataset: "visits" | "events";
  endpoint: "count" | "aggregate";
  window: TrafficWindow;
  by?: string[];
  limit?: number;
  filter?: FilterClause[];
  revalidate: number;
};

async function queryWebAnalytics<T>(spec: QuerySpec): Promise<AnalyticsResult<T>> {
  const { window } = spec;
  const credentials = readCredentials();

  if (!credentials) {
    return {
      ok: false,
      kind: "not-configured",
      message:
        "Vercel Web Analytics is not connected here. Set VERCEL_ANALYTICS_TOKEN and VERCEL_PROJECT_ID in the environment and these panels will fill in.",
      window,
    };
  }

  const params = new URLSearchParams();
  params.set("projectId", credentials.projectId);
  if (credentials.teamId) params.set("teamId", credentials.teamId);
  params.set("since", window.since);
  params.set("until", window.until);

  // Repeated `by` params, one append at a time. Handing an array to
  // URLSearchParams would comma-join them, which this API rejects.
  for (const dimension of spec.by ?? []) params.append("by", dimension);

  if (spec.limit !== undefined) {
    params.set("limit", String(Math.min(MAX_LIMIT, Math.max(1, spec.limit))));
  }

  const filter = toODataFilter(spec.filter ?? []);
  if (filter) params.set("filter", filter);

  const url = `${API_BASE}/${spec.dataset}/${spec.endpoint}?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        // The only place the token is ever used.
        Authorization: `Bearer ${credentials.token}`,
        Accept: "application/json",
      },
      // An explicit revalidate is what keeps this in the Data Cache despite the
      // Authorization header and the dynamic admin route. Next writes an entry
      // only for a 200, so failures below are never cached.
      next: { revalidate: spec.revalidate, tags: [ANALYTICS_CACHE_TAG] },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return {
      ok: false,
      kind: "unreachable",
      message:
        "Could not reach the Vercel Analytics API. The numbers below are unavailable, not zero.",
      window,
    };
  }

  if (!res.ok) return failureFor(res, window, await readErrorBody(res));

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      kind: "unreachable",
      message:
        "The Vercel Analytics API answered with something that was not JSON. Treat this panel as unavailable.",
      window,
      status: res.status,
    };
  }

  const data = (body as { data?: unknown } | null)?.data;
  if (data === undefined || data === null) {
    return {
      ok: false,
      kind: "unreachable",
      message:
        "The Vercel Analytics API answered without a data field, so there is nothing to show here.",
      window,
      status: res.status,
    };
  }

  return { ok: true, data: data as T, window, empty: false };
}

/** Vercel's error envelope: `{ error: { code, message, invalidToken? } }`. */
type VercelError = { code?: string; message?: string; invalidToken?: boolean };

async function readErrorBody(res: Response): Promise<VercelError> {
  try {
    const body = (await res.json()) as { error?: VercelError };
    return body?.error ?? {};
  } catch {
    return {};
  }
}

/**
 * Maps a failed response to a sentence a person can act on. Every status here
 * was produced against the live API: 403 + invalidToken from a bad token, 404
 * from a wrong project id, 402 from a utm dimension, 400 from a malformed
 * query.
 */
function failureFor(
  res: Response,
  window: TrafficWindow,
  error: VercelError
): AnalyticsFailure {
  const status = res.status;

  if (status === 401 || (status === 403 && error.invalidToken)) {
    return {
      ok: false,
      kind: "unauthorized",
      status,
      window,
      message:
        "Vercel rejected the analytics token. It has expired or been revoked, so issue a new one and update VERCEL_ANALYTICS_TOKEN.",
    };
  }

  if (status === 403) {
    return {
      ok: false,
      kind: "forbidden",
      status,
      window,
      message:
        "The analytics token cannot read this project. Check it belongs to the right team and has read access.",
    };
  }

  if (status === 404) {
    return {
      ok: false,
      kind: "not-found",
      status,
      window,
      message:
        "Vercel has no analytics for this project id. Either VERCEL_PROJECT_ID is wrong or Web Analytics was never enabled on the project.",
    };
  }

  if (status === 402) {
    return {
      ok: false,
      kind: "plan-limited",
      status,
      window,
      message:
        error.message?.trim() ||
        "This plan does not include the data that panel asked for.",
    };
  }

  if (status === 429) {
    return {
      ok: false,
      kind: "rate-limited",
      status,
      window,
      retryAfterSeconds: retryAfterSeconds(res),
      message:
        "The Vercel Analytics rate limit is spent, which is 400 requests an hour. These numbers will come back on their own.",
    };
  }

  if (status >= 500) {
    return {
      ok: false,
      kind: "server-error",
      status,
      window,
      message:
        "Vercel Analytics returned a server error. Nothing is wrong on this side, try again shortly.",
    };
  }

  // 400 is ours: an unsupported dimension, or a window wider than the
  // granularity allows. It is a bug here, not a state the owner can fix.
  return {
    ok: false,
    kind: "bad-request",
    status,
    window,
    message: `Vercel Analytics rejected the query: ${
      error.message?.trim() || "no reason given"
    }`,
  };
}

function retryAfterSeconds(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds);
  }
  // The API always sends x-ratelimit-reset as an epoch second.
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    return Math.max(0, Math.round(reset - Date.now() / 1000));
  }
  return undefined;
}

function baseFilter(query: TrafficQuery): FilterClause[] {
  const extra = query.filter ?? [];
  return query.includePreview ? extra : [PRODUCTION_ONLY, ...extra];
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export type TrafficTotals = {
  /** Unique visitors in the window, as Vercel counts them. */
  visitors: number;
  pageviews: number;
  /**
   * Pageviews divided by visitors. This is NOT bounce rate, and it must never
   * be labelled as one. The API has no bounce metric at all, so a panel that
   * shows this figure has to say what it is and link to the dashboard for the
   * real bounce rate. See `ANALYTICS_GAPS`.
   */
  pageviewsPerVisitor: number | null;
};

/**
 * Visitors and pageviews for a window, optionally for one segment.
 *
 * Pass a filter to measure a slice: `{ dimension: "route", op: "eq", value:
 * "/guides" }` for one route, or `{ dimension: "referrerHostname", op: "ne",
 * value: "" }` for all referred traffic.
 */
export async function getTrafficTotals(
  query: TrafficQuery = {}
): Promise<AnalyticsResult<TrafficTotals>> {
  const revalidate = query.revalidate ?? DEFAULT_REVALIDATE;
  const window = resolveWindow(query.window, revalidate);

  const result = await queryWebAnalytics<RawCount>({
    dataset: "visits",
    endpoint: "count",
    window,
    filter: baseFilter(query),
    revalidate,
  });

  if (!result.ok) return result;

  const visitors = num(result.data.visitors);
  const pageviews = num(result.data.pageviews);

  return {
    ok: true,
    window,
    empty: visitors === 0 && pageviews === 0,
    data: {
      visitors,
      pageviews,
      pageviewsPerVisitor: visitors > 0 ? pageviews / visitors : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export type TrafficPoint = {
  /** Bucket start, ISO instant, as Vercel returned it. */
  timestamp: string;
  /** `YYYY-MM-DD` of the bucket start, in UTC. Convenient chart key. */
  day: string;
  /** Unique visitors WITHIN this bucket. Do not sum these, see below. */
  visitors: number;
  pageviews: number;
};

export type TrafficSeries = {
  granularity: TrafficGranularity;
  points: TrafficPoint[];
  /**
   * Summing `points[].visitors` does NOT give the window's unique visitors:
   * someone who came back on Tuesday is counted in both days. This is that sum,
   * kept only so a panel can show a "visits" line honestly, and
   * `getTrafficTotals` remains the only source for unique visitors.
   */
  summedBucketVisitors: number;
  totalPageviews: number;
};

/**
 * Picks a granularity the API will accept. Over the cap it answers
 * `invalid_group_by` rather than degrading, so the choice is made here instead
 * of being discovered by a panel that then has nothing to draw.
 */
function granularityFor(days: number): TrafficGranularity {
  if (days <= MAX_DAY_BUCKETS) return "day";
  if (days <= MAX_WEEK_SPAN_DAYS) return "week";
  return "month";
}

/**
 * The chart series. Same filter vocabulary as the totals, so a segment's
 * shape over time is one call: pass `{ dimension: "deviceType", op: "eq",
 * value: "mobile" }` for the mobile line.
 */
export async function getTrafficSeries(
  query: TrafficQuery = {}
): Promise<AnalyticsResult<TrafficSeries>> {
  const revalidate = query.revalidate ?? DEFAULT_REVALIDATE;
  const window = resolveWindow(query.window, revalidate);
  const granularity = granularityFor(window.days);

  const result = await queryWebAnalytics<RawAggregateRow[]>({
    dataset: "visits",
    endpoint: "aggregate",
    window,
    by: [granularity],
    limit: MAX_LIMIT,
    filter: baseFilter(query),
    revalidate,
  });

  if (!result.ok) return result;

  const rows = Array.isArray(result.data) ? result.data : [];
  const points: TrafficPoint[] = rows.map((row) => {
    const timestamp = String(row.timestamp ?? "");
    return {
      timestamp,
      day: timestamp.slice(0, 10),
      visitors: num(row.visitors),
      pageviews: num(row.pageviews),
    };
  });

  const summedBucketVisitors = points.reduce((n, p) => n + p.visitors, 0);
  const totalPageviews = points.reduce((n, p) => n + p.pageviews, 0);

  return {
    ok: true,
    window,
    // Vercel fills empty buckets with zeroes rather than dropping them, so an
    // all-zero series is the real "nothing happened" case.
    empty: points.length === 0 || totalPageviews === 0,
    data: { granularity, points, summedBucketVisitors, totalPageviews },
  };
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

export type BreakdownRow = {
  /** The raw value Vercel returned, `""` for unknown. */
  key: string;
  /** Display name. Country codes become names, `""` becomes "Unknown". */
  label: string;
  visitors: number;
  pageviews: number;
  /**
   * Visitors as a share of the summed visitors across every bucket of this
   * dimension, which is how the Vercel dashboard draws its bars. It is not a
   * share of unique visitors: one person on a phone and a laptop lands in two
   * device buckets, so these sum to slightly more than the visitor total.
   */
  share: number;
};

export type Breakdown = {
  dimension: TrafficDimension;
  /** Ranked by visitors, cut to `top`. */
  rows: BreakdownRow[];
  /**
   * Everything below the cut, folded into one row. Null when nothing was cut.
   * `distinctValues` counts the named values that were cut. When
   * `vercelTruncated` is true there are more inside Vercel's own rollup that it
   * never named, so treat that count as a floor.
   */
  other: { visitors: number; pageviews: number; distinctValues: number } | null;
  /**
   * True when Vercel itself returned an "Others" rollup, meaning the dimension
   * had more than 100 distinct values and the tail is an estimate of the rest
   * rather than a list. Worth saying out loud on a Pages panel.
   */
  vercelTruncated: boolean;
  summedVisitors: number;
  summedPageviews: number;
};

/** Vercel's own tail rollup, which arrives as a row with this exact key. */
const VERCEL_TAIL_KEY = "Others";

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

function labelFor(dimension: TrafficDimension, key: string): string {
  if (key === VERCEL_TAIL_KEY) return "Everything else";
  if (key === "") {
    return dimension === "referrerHostname" ? "Direct" : "Unknown";
  }
  if (dimension === "country") {
    try {
      return regionNames?.of(key.toUpperCase()) ?? key;
    } catch {
      return key;
    }
  }
  if (dimension === "deviceType") {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
  return key;
}

export type BreakdownQuery = TrafficQuery & {
  /** How many rows to keep. The rest fold into `other`. Defaults to 8. */
  top?: number;
};

/**
 * One aggregate, for any dimension this plan supports.
 *
 * Always asks for the full 100 rows and ranks locally, so the cut happens after
 * any folding rather than before it. Asking for 8 rows directly would make
 * Vercel decide the tail, and for referrers that would split `bing.com` from
 * `cn.bing.com` across the boundary.
 */
export async function getTrafficBreakdown(
  dimension: TrafficDimension,
  query: BreakdownQuery = {}
): Promise<AnalyticsResult<Breakdown>> {
  const revalidate = query.revalidate ?? DEFAULT_REVALIDATE;
  const window = resolveWindow(query.window, revalidate);

  const result = await queryWebAnalytics<RawAggregateRow[]>({
    dataset: "visits",
    endpoint: "aggregate",
    window,
    by: [dimension],
    limit: MAX_LIMIT,
    filter: baseFilter(query),
    revalidate,
  });

  if (!result.ok) return result;

  const raw = Array.isArray(result.data) ? result.data : [];
  const counted = raw.map((row) => ({
    key: String(row[dimension] ?? ""),
    visitors: num(row.visitors),
    pageviews: num(row.pageviews),
  }));

  return {
    ok: true,
    window,
    empty: counted.length === 0,
    data: assemble(
      dimension,
      counted.map((row) => ({ ...row, label: labelFor(dimension, row.key) })),
      query.top ?? 8
    ),
  };
}

type CountedRow = { key: string; label: string; visitors: number; pageviews: number };

/** Ranks, cuts, and computes shares. Shared by the plain and folded paths. */
function assemble(
  dimension: TrafficDimension,
  rows: CountedRow[],
  top: number
): Breakdown {
  const tail = rows.find((r) => r.key === VERCEL_TAIL_KEY) ?? null;
  const named = rows.filter((r) => r.key !== VERCEL_TAIL_KEY);

  const summedVisitors = rows.reduce((n, r) => n + r.visitors, 0);
  const summedPageviews = rows.reduce((n, r) => n + r.pageviews, 0);

  const ranked = named.slice().sort((a, b) => b.visitors - a.visitors);
  const kept = ranked.slice(0, Math.max(1, top));
  const cut = ranked.slice(Math.max(1, top));

  const otherVisitors =
    cut.reduce((n, r) => n + r.visitors, 0) + (tail?.visitors ?? 0);
  const otherPageviews =
    cut.reduce((n, r) => n + r.pageviews, 0) + (tail?.pageviews ?? 0);

  return {
    dimension,
    rows: kept.map((r) => ({
      ...r,
      share: summedVisitors > 0 ? r.visitors / summedVisitors : 0,
    })),
    other:
      cut.length > 0 || tail
        ? {
            visitors: otherVisitors,
            pageviews: otherPageviews,
            distinctValues: cut.length,
          }
        : null,
    vercelTruncated: tail !== null,
    summedVisitors,
    summedPageviews,
  };
}

// ---------------------------------------------------------------------------
// Referrers: the one place variants are folded and the OAuth hop is removed
// ---------------------------------------------------------------------------

/**
 * How a referrer was reached. This grouping is OURS, applied to Vercel's raw
 * `referrerHostname`, so a panel should say "grouped by us" rather than imply
 * Vercel returned a category.
 */
export type ReferrerKind =
  /** No referrer header at all: a typed URL, a bookmark, or a stripped referrer. */
  | "direct"
  | "search"
  | "ai"
  | "community"
  | "social"
  | "email"
  | "other"
  /** This site's own Google OAuth return leg. Not acquisition. */
  | "oauth"
  /** One of this project's own domains. A hop inside the site. */
  | "internal";

export type FoldedReferrer = { key: string; label: string; kind: ReferrerKind };

/**
 * The site's own domains, from the project's domain list. A referral FROM one
 * of these is a hop between our own hosts, not somebody sending us traffic.
 * `NEXT_PUBLIC_SITE_URL` is folded in too so a rename cannot silently start
 * counting the site as its own referrer.
 */
const SELF_HOSTS = new Set(
  [
    "learnfrc.com",
    "www.learnfrc.com",
    "learnfrc.systemerr.com",
    "www.learnfrc.systemerr.com",
    "learnfrc.vercel.app",
    (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname;
      } catch {
        return "";
      }
    })(),
  ].filter(Boolean)
);

/**
 * Ordered fold rules. First match wins, so `accounts.google.com` is claimed as
 * the OAuth hop before the Google Search rule can swallow it, and
 * `gemini.google.com` is claimed as an assistant before the same rule.
 *
 * Everything in this table appeared in the real referrer list. Anything not
 * listed keeps its own hostname, minus a `www.`, and lands in "other", which
 * is the honest default for a host nobody has classified yet.
 */
const REFERRER_RULES: {
  test: (host: string) => boolean;
  label: string;
  kind: ReferrerKind;
}[] = [
  // Our own round trips first.
  { test: (h) => h.startsWith("accounts.google."), label: "Google sign-in", kind: "oauth" },
  { test: (h) => SELF_HOSTS.has(h), label: "Our own domains", kind: "internal" },

  // Assistants, before the search rules that would otherwise claim them.
  { test: (h) => h === "gemini.google.com", label: "Gemini", kind: "ai" },
  { test: (h) => h === "notebook.google.com", label: "NotebookLM", kind: "ai" },
  { test: (h) => h === "chatgpt.com" || h === "chat.openai.com", label: "ChatGPT", kind: "ai" },
  { test: (h) => h === "copilot.microsoft.com", label: "Microsoft Copilot", kind: "ai" },
  { test: (h) => h === "claude.ai", label: "Claude", kind: "ai" },
  { test: (h) => h.endsWith("perplexity.ai"), label: "Perplexity", kind: "ai" },

  // Search. Every engine here really did arrive split across variants:
  // bing.com and cn.bing.com, duckduckgo.com and noai.duckduckgo.com,
  // google.com and google.com.hk, and five country Yahoos.
  { test: (h) => h === "mail.google.com" || h === "com.google.android.gm", label: "Gmail", kind: "email" },
  { test: (h) => h === "messages.google.com", label: "Google Messages", kind: "social" },
  {
    test: (h) =>
      h === "com.google.android.googlequicksearchbox" ||
      h === "google.com" ||
      h.startsWith("google.") ||
      h.startsWith("www.google."),
    label: "Google",
    kind: "search",
  },
  { test: (h) => h === "bing.com" || h.endsWith(".bing.com"), label: "Bing", kind: "search" },
  { test: (h) => h === "duckduckgo.com" || h.endsWith(".duckduckgo.com"), label: "DuckDuckGo", kind: "search" },
  { test: (h) => h === "yahoo.com" || h.endsWith(".yahoo.com"), label: "Yahoo", kind: "search" },
  { test: (h) => h === "search.brave.com", label: "Brave Search", kind: "search" },
  { test: (h) => h === "ecosia.org" || h.endsWith(".ecosia.org"), label: "Ecosia", kind: "search" },
  { test: (h) => h === "yandex.com" || h === "yandex.ru" || h.startsWith("yandex."), label: "Yandex", kind: "search" },
  { test: (h) => h === "baidu.com" || h.endsWith(".baidu.com"), label: "Baidu", kind: "search" },
  { test: (h) => h === "so.com" || h.endsWith(".so.com"), label: "360 Search", kind: "search" },
  { test: (h) => h === "qwant.com", label: "Qwant", kind: "search" },
  { test: (h) => h === "kagi.com", label: "Kagi", kind: "search" },
  { test: (h) => h === "oceanhero.today", label: "OceanHero", kind: "search" },

  // The FRC forum is the biggest real referrer this site has, so it gets its
  // own kind rather than being filed under generic social.
  { test: (h) => h === "chiefdelphi.com" || h.endsWith(".chiefdelphi.com"), label: "Chief Delphi", kind: "community" },

  { test: (h) => h === "reddit.com" || h.endsWith(".reddit.com") || h === "com.reddit.frontpage", label: "Reddit", kind: "social" },
  { test: (h) => h === "facebook.com" || h.endsWith(".facebook.com"), label: "Facebook", kind: "social" },
  { test: (h) => h === "instagram.com" || h.endsWith(".instagram.com"), label: "Instagram", kind: "social" },
  { test: (h) => h === "com.slack" || h.endsWith("slack.com"), label: "Slack", kind: "social" },
  { test: (h) => h.includes("teams") && h.includes("microsoft"), label: "Microsoft Teams", kind: "social" },
  { test: (h) => h.endsWith("teams.cdn.office.net"), label: "Microsoft Teams", kind: "social" },
  { test: (h) => h === "t.co" || h === "x.com" || h === "twitter.com", label: "X", kind: "social" },
  { test: (h) => h === "youtube.com" || h.endsWith(".youtube.com"), label: "YouTube", kind: "social" },
  { test: (h) => h === "github.com", label: "GitHub", kind: "social" },
  { test: (h) => h === "discord.com" || h.endsWith(".discord.com") || h === "discord.gg", label: "Discord", kind: "social" },

  { test: (h) => h.endsWith("mail.qq.com") || h === "weixin110.qq.com", label: "QQ Mail", kind: "email" },
  { test: (h) => h === "mail.163.com", label: "163 Mail", kind: "email" },
  { test: (h) => h === "mailchi.mp" || h.endsWith("mailchimp.com"), label: "Mailchimp", kind: "email" },
  { test: (h) => h === "10minutemail.com" || h === "temp-mail.org", label: "Disposable inbox", kind: "email" },
];

/**
 * Folds one `referrerHostname` into a source.
 *
 * Exported because this is the single place the variant rules live: any panel,
 * any script, any later report resolves a hostname through here so the top
 * referrer list cannot under-report search by splitting one engine across four
 * rows, and cannot present our own OAuth hop as a referral.
 */
export function foldReferrer(hostname: string): FoldedReferrer {
  const host = hostname.trim().toLowerCase();
  if (host === "") return { key: "", label: "Direct", kind: "direct" };
  if (host === VERCEL_TAIL_KEY.toLowerCase()) {
    return { key: VERCEL_TAIL_KEY, label: "Everything else", kind: "other" };
  }

  for (const rule of REFERRER_RULES) {
    if (rule.test(host)) return { key: rule.label, label: rule.label, kind: rule.kind };
  }

  const trimmed = host.startsWith("www.") ? host.slice(4) : host;
  return { key: trimmed, label: trimmed, kind: "other" };
}

export type ReferrerRow = BreakdownRow & { kind: ReferrerKind };

export type ReferrerBreakdown = {
  /**
   * Real referrals only, ranked. Direct traffic, the OAuth hop and our own
   * domains are pulled out below rather than ranked alongside sites that
   * genuinely sent people here.
   */
  rows: ReferrerRow[];
  other: { visitors: number; pageviews: number; distinctValues: number } | null;
  vercelTruncated: boolean;
  /** No referrer header. Typed the URL, a bookmark, or a stripped referrer. */
  direct: { visitors: number; pageviews: number };
  /** Everything in `rows` plus `other`, summed. */
  referred: { visitors: number; pageviews: number };
  /** This site's own Google OAuth return leg. Never a referral source. */
  oauth: { visitors: number; pageviews: number };
  /** Hops from our own other domains. */
  internal: { visitors: number; pageviews: number };
  /**
   * Every visitor filed under one kind, for a one-line "where reach comes
   * from". Unlike `rows` this includes `direct`, `oauth` and `internal`, so the
   * kinds add up to the window's arrivals.
   */
  byKind: Record<ReferrerKind, { visitors: number; pageviews: number }>;
};

/**
 * The Referrers panel. Same data as `getTrafficBreakdown("referrerHostname")`,
 * with the two traps handled: engine variants folded into one row each, and the
 * Google OAuth round trip separated out instead of sitting fifth in the list
 * looking like acquisition.
 */
export async function getReferrerBreakdown(
  query: BreakdownQuery = {}
): Promise<AnalyticsResult<ReferrerBreakdown>> {
  const revalidate = query.revalidate ?? DEFAULT_REVALIDATE;
  const window = resolveWindow(query.window, revalidate);

  const result = await queryWebAnalytics<RawAggregateRow[]>({
    dataset: "visits",
    endpoint: "aggregate",
    window,
    by: ["referrerHostname"],
    limit: MAX_LIMIT,
    filter: baseFilter(query),
    revalidate,
  });

  if (!result.ok) return result;

  const raw = Array.isArray(result.data) ? result.data : [];

  const zero = () => ({ visitors: 0, pageviews: 0 });
  const direct = zero();
  const oauth = zero();
  const internal = zero();
  const byKind: Record<ReferrerKind, { visitors: number; pageviews: number }> = {
    direct: zero(),
    search: zero(),
    ai: zero(),
    community: zero(),
    social: zero(),
    email: zero(),
    other: zero(),
    oauth: zero(),
    internal: zero(),
  };

  // Fold first, rank after. Folding into a map is what merges bing.com with
  // cn.bing.com before anything is ranked or cut.
  const folded = new Map<string, CountedRow & { kind: ReferrerKind }>();

  for (const row of raw) {
    const host = String(row.referrerHostname ?? "");
    const visitors = num(row.visitors);
    const pageviews = num(row.pageviews);
    const fold = foldReferrer(host);

    if (host === "") {
      direct.visitors += visitors;
      direct.pageviews += pageviews;
      byKind.direct.visitors += visitors;
      byKind.direct.pageviews += pageviews;
      continue;
    }
    if (fold.kind === "oauth") {
      oauth.visitors += visitors;
      oauth.pageviews += pageviews;
      byKind.oauth.visitors += visitors;
      byKind.oauth.pageviews += pageviews;
      continue;
    }
    if (fold.kind === "internal") {
      internal.visitors += visitors;
      internal.pageviews += pageviews;
      byKind.internal.visitors += visitors;
      byKind.internal.pageviews += pageviews;
      continue;
    }

    byKind[fold.kind].visitors += visitors;
    byKind[fold.kind].pageviews += pageviews;

    const existing = folded.get(fold.key);
    if (existing) {
      existing.visitors += visitors;
      existing.pageviews += pageviews;
    } else {
      folded.set(fold.key, {
        key: fold.key,
        label: fold.label,
        kind: fold.kind,
        visitors,
        pageviews,
      });
    }
  }

  const assembled = assemble(
    "referrerHostname",
    [...folded.values()],
    query.top ?? 8
  );
  const kinds = new Map([...folded.values()].map((r) => [r.key, r.kind]));

  return {
    ok: true,
    window,
    empty: raw.length === 0,
    data: {
      rows: assembled.rows.map((row) => ({
        ...row,
        kind: kinds.get(row.key) ?? "other",
      })),
      other: assembled.other,
      vercelTruncated: assembled.vercelTruncated,
      direct,
      oauth,
      internal,
      referred: {
        visitors: assembled.summedVisitors,
        pageviews: assembled.summedPageviews,
      },
      byKind,
    },
  };
}

// ---------------------------------------------------------------------------
// Custom events
// ---------------------------------------------------------------------------

export type EventTotals = {
  events: number;
  visitors: number;
  /**
   * True when the app has never sent a custom event. As of the last probe this
   * is the case: `<Analytics />` is mounted but nothing calls `track()`, so the
   * events dataset returns 0. A panel should print that sentence rather than a
   * zero, and this flag stops the claim from rotting if events are ever added.
   */
  neverInstrumented: boolean;
};

/**
 * The dashboard's Events tab. Answered by the API, and today the honest answer
 * is "none recorded". Kept live rather than hard-coded so the panel starts
 * telling the truth on its own the day something calls `track()`.
 */
export async function getEventTotals(
  query: TrafficQuery = {}
): Promise<AnalyticsResult<EventTotals>> {
  const revalidate = query.revalidate ?? DEFAULT_REVALIDATE;
  const window = resolveWindow(query.window, revalidate);

  const result = await queryWebAnalytics<RawCount>({
    dataset: "events",
    endpoint: "count",
    window,
    filter: baseFilter(query),
    revalidate,
  });

  if (!result.ok) return result;

  // The events endpoint returns `count`, not `pageviews`.
  const events = num(result.data.count);
  const visitors = num(result.data.visitors);

  return {
    ok: true,
    window,
    empty: events === 0,
    data: { events, visitors, neverInstrumented: events === 0 },
  };
}

// ---------------------------------------------------------------------------
// The whole dashboard, in one parallel pass
// ---------------------------------------------------------------------------

export type TrafficOverview = {
  window: TrafficWindow;
  /** Same length window immediately before, for a "vs previous" delta. */
  comparisonWindow: TrafficWindow;
  totals: AnalyticsResult<TrafficTotals>;
  previousTotals: AnalyticsResult<TrafficTotals>;
  series: AnalyticsResult<TrafficSeries>;
  /** The dashboard's Pages tab: literal URLs. */
  pages: AnalyticsResult<Breakdown>;
  /** The dashboard's Routes tab: Next.js route patterns. */
  routes: AnalyticsResult<Breakdown>;
  referrers: AnalyticsResult<ReferrerBreakdown>;
  countries: AnalyticsResult<Breakdown>;
  devices: AnalyticsResult<Breakdown>;
  browsers: AnalyticsResult<Breakdown>;
  operatingSystems: AnalyticsResult<Breakdown>;
  flags: AnalyticsResult<Breakdown>;
  events: AnalyticsResult<EventTotals>;
  /** What the dashboard shows that this API cannot answer. Render these. */
  gaps: typeof ANALYTICS_GAPS;
  /** Where every one of these numbers came from. Print it on the panel. */
  source: typeof TRAFFIC_SOURCE;
};

/**
 * Everything the Vercel Analytics screen shows, for one window, in one pass.
 *
 * Twelve independent queries, all started together. Awaiting them one at a time
 * would stack twelve round trips into the panel's render.
 */
export async function getTrafficOverview(
  query: BreakdownQuery = {}
): Promise<TrafficOverview> {
  const revalidate = query.revalidate ?? DEFAULT_REVALIDATE;
  const window = resolveWindow(query.window, revalidate);
  const comparisonWindow = previousWindow(window);
  const shared = { ...query, window, revalidate };

  const [
    totals,
    previousTotals,
    series,
    pages,
    routes,
    referrers,
    countries,
    devices,
    browsers,
    operatingSystems,
    flags,
    events,
  ] = await Promise.all([
    getTrafficTotals(shared),
    getTrafficTotals({ ...shared, window: comparisonWindow }),
    getTrafficSeries(shared),
    getTrafficBreakdown("requestPath", shared),
    getTrafficBreakdown("route", shared),
    getReferrerBreakdown(shared),
    getTrafficBreakdown("country", shared),
    getTrafficBreakdown("deviceType", { ...shared, top: 4 }),
    getTrafficBreakdown("browserName", shared),
    getTrafficBreakdown("osName", shared),
    getTrafficBreakdown("flags", shared),
    getEventTotals(shared),
  ]);

  return {
    window,
    comparisonWindow,
    totals,
    previousTotals,
    series,
    pages,
    routes,
    referrers,
    countries,
    devices,
    browsers,
    operatingSystems,
    flags,
    events,
    gaps: ANALYTICS_GAPS,
    source: TRAFFIC_SOURCE,
  };
}

// ---------------------------------------------------------------------------
// Provenance and honest gaps
// ---------------------------------------------------------------------------

/**
 * The label every panel built on this file carries. A reader has to be able to
 * tell measured traffic from an application fact without asking anyone.
 */
export const TRAFFIC_SOURCE = {
  label: "Vercel Web Analytics",
  note: "Measured traffic. Production only, and it counts everyone, signed in or not.",
  href: vercelDashboardUrl(),
} as const;

/** The project's analytics screen, or null when the project id is unset. */
export function vercelDashboardUrl(): string | null {
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!projectId) return null;
  // The dashboard resolves a project id to its slug, so this link works from
  // the id alone without hard-coding a team slug into the repo.
  return `https://vercel.com/d?to=%2F%5Bteam%5D%2F%5Bproject%5D%2Fanalytics&project=${encodeURIComponent(projectId)}`;
}

/**
 * What the Vercel dashboard shows that the API on this plan will not return.
 * The owner has seen all three on screen, so a panel must account for them
 * instead of quietly leaving them out, and must never substitute something
 * else and call it the same measure.
 */
export const ANALYTICS_GAPS = [
  {
    id: "bounce-rate",
    name: "Bounce rate",
    why: "The API has no bounce metric and no bounce dimension. Asking for one is accepted and ignored, which is worse than a refusal.",
    instead:
      "Pageviews per visitor is a different measure. Show it as itself if it is useful, never as bounce rate.",
  },
  {
    id: "hostnames",
    name: "Hostnames",
    why: "No hostname dimension exists under any spelling, so the split between learnfrc.com and the other domains is not available here.",
    instead: "The dashboard's Hostnames tab has it.",
  },
  {
    id: "utm",
    name: "UTM parameters",
    why: "Every utm dimension returns 402 on this plan. It needs Enterprise or the Web Analytics Plus add-on.",
    instead:
      "Campaign tagging cannot be reported here at all. Signup attribution in the database is a different question and answers a different one.",
  },
] as const;

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export type AnalyticsAvailability =
  | { configured: true; dashboardUrl: string | null }
  | { configured: false; message: string; dashboardUrl: string | null };

/**
 * Whether the panel can ask anything at all. Cheap and synchronous, so a page
 * can render one honest line instead of a dozen identical failures.
 */
export function getAnalyticsAvailability(): AnalyticsAvailability {
  const credentials = readCredentials();
  if (credentials) return { configured: true, dashboardUrl: vercelDashboardUrl() };
  return {
    configured: false,
    dashboardUrl: vercelDashboardUrl(),
    message:
      "Vercel Web Analytics is not connected here. Set VERCEL_ANALYTICS_TOKEN and VERCEL_PROJECT_ID in the environment, then these panels fill in. Nothing below is zero, it is unmeasured.",
  };
}
