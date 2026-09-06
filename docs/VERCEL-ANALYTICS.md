# What Vercel Web Analytics can actually answer

Probed against this project on 2026-09-06, not copied from docs. Everything
below was run and its response inspected.

Base: `https://api.vercel.com/v1/query/web-analytics/`
Auth: `Authorization: Bearer $VERCEL_ANALYTICS_TOKEN`
Always send `projectId` and `teamId`.

Two endpoints per dataset:
- `visits/count` and `events/count` return `{ data: { pageviews, visitors } }`
- `visits/aggregate` and `events/aggregate` return `{ data: [ { <dim>, visitors, pageviews } ] }`

## The authoritative list

Straight from the API's own validation error, which is the only trustworthy
source since the public docs list dimensions this plan rejects:

    hour, day, week, month, year, country, deviceType, environment,
    requestPath, referrerHostname, osName, browserName, route,
    utmSource, utmMedium, utmCampaign, utmContent, utmTerm, flags
    plus JSON keys like flags/<name>

The events dataset adds eventName, eventData and eventData/<property>.

## Dimensions that work

    country          US 2183, CN, CA, SG ...
    deviceType       desktop 2452, mobile 779, tablet
    browserName      Chrome, Microsoft Edge, Chrome Mobile, Mobile Safari
    osName           Windows 1628, macOS, iOS, Android
    referrerHostname "" for direct, google.com, bing.com, chiefdelphi.com ...
    requestPath      literal URLs, /guides, /signup ...
    route            Next.js patterns, /guides/[department]/[module]/[lesson]
    environment      production vs preview
    day week month year   time series, each row { timestamp, visitors, pageviews }

## Grouping by TWO dimensions

Works, but ONLY with repeated query params. `by=day&by=deviceType` is correct.
A comma-joined `by=day,deviceType` is rejected with a confusing "should be equal
to one of the allowed values" error, which is what made this look unsupported at
first. `URLSearchParams` with an array produces the comma form, so build the
query string by hand or append repeatedly.

## Filters

OData on `count` and `aggregate`, and this is where most of the power is:

    filter=route eq '/guides'                -> 459 visitors, 903 pageviews
    filter=deviceType eq 'mobile'            -> 779 visitors
    filter=referrerHostname ne ''            -> 1210 visitors (all referred traffic)

Combine a filter with `by=day` to get a time series for any segment.

## Range

Full history is available: 2026-01-01 to 2026-09-07 returns 8,933 visitors and
43,953 pageviews. `hour` granularity is capped at 168 hours; use `day` beyond a
week.

## In the dashboard but NOT in the API

The Vercel Analytics dashboard shows two things the API will not give you.
Do not fake them, and do not quietly substitute something else.

- BOUNCE RATE. The dashboard shows it (48% over the last 7 days). There is no
  bounce dimension and no bounce metric: `metrics=bounceRate` and
  `include=bounceRate` are accepted and silently ignored, `visits/bounces` and
  `visits/summary` both 404. `visits/count` returns only visitors and
  pageviews. Pageviews per visitor is a DIFFERENT measure, so if you show it,
  label it as what it is and link out to the dashboard for the real number.
- HOSTNAMES. The dashboard has a Hostnames tab next to Pages and Routes. There
  is no hostname dimension in the allowed list under any spelling
  (hostname, requestHostname, host, hostnames all rejected).

## NOT available, do not build panels for these

- `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm` all return
  402: "UTM dimensions require an Enterprise plan or the Web Analytics Plus
  add-on." Campaign tagging cannot be reported here on the current plan.
- `referrerUrl`, `pathType`, `requestHostname`, `clientIpCountry`, `httpStatus`
  are rejected as `by` values, despite appearing in the response-shape docs.
- The `events` dataset is EMPTY: `events/count` returns 0 and there are no
  event names, because nothing in the app calls `track()`. Custom events are
  possible but would have to be instrumented first, and most of what we would
  want to track already lives in the database joined to a user id, which Vercel
  cannot do.

## Two traps in the referrer data

- `accounts.google.com` (156 visitors) is this site's own Google OAuth round
  trip, not acquisition. Never present it as a referral source.
- `cn.bing.com` and `bing.com` are one engine, as are `duckduckgo.com` and
  `noai.duckduckgo.com`. Fold engine variants together or the top-referrer
  list under-reports search by splitting it.
