# LearnFRC app API (`/api/app/*`)

The routes the iPhone, iPad and Mac app calls on learnfrc.com. This is the full reference for `docs/ARCHITECTURE.md` section 7: every field below is what the code in `src/app/api/app/**` sends today.

Every route calls the same shared functions as the website (`src/lib/app/*`), so a lesson completed in the app is graded, rate limited, scored and worded exactly like one completed on the site.

## Conventions

**Base URL.** `https://learnfrc.com` (`AppConfig.apiBase`). For testing against `next dev`, launch a Debug build with `-LFAPIBase http://localhost:3000`. Release builds ignore the override.

**Auth.** Routes marked Bearer need the signed-in user's Supabase access token:

```
Authorization: Bearer <access token from the supabase-swift session>
```

The server checks it with the auth server on every call (`supabase.auth.getUser(token)`), so an expired, revoked or deleted session gets a 401. Refresh the session and retry once; if it still fails, sign out locally.

**Bodies.** JSON in, JSON out, camelCase keys. Send `Content-Type: application/json`. A body that isn't a JSON object, or a field with the wrong type, gets a 400 `validation`.

**Errors.** Any non-2xx response has this body:

```json
{ "error": "That username is already taken.", "code": "conflict" }
```

| `code` | HTTP | Meaning |
|---|---|---|
| `unauthorized` | 401 | Missing or bad token, or a failed sign-in. On a Bearer route it means the session ended (the app says "You're signed out"). On the sign-in and sign-up routes, which take no token, it's the answer itself: show `error` as sent. |
| `forbidden` | 403 | Signed in, but this account's site role can't do this (the admin routes below). The session is fine: stay signed in, show the locked screen or `error` as sent. Never sent for "signed out". |
| `validation` | 400 | The input broke a rule. `error` is the site's own sentence; show it as sent. |
| `rate_limited` | 429 | Too many tries. The response has a `Retry-After` header in seconds. |
| `not_found` | 404 | No such lesson, learner or profile. |
| `conflict` | 409 | A username is taken, or the profile changed underneath the request. |
| `server` | 500 | Something failed on our side. Safe to retry later. |

`error` strings are the website's copy, unchanged, so the app and the site say the same thing.

A failure about one input can also carry `field` naming it, like `{ "error": "Keep the note under 1000 characters.", "code": "validation", "field": "note" }`. Only the application decision route sends it today. Mark that control invalid; ignore the key when it's absent.

**Caching.** Per-user routes answer `Cache-Control: no-store`. Public routes are cached at the CDN (see each route).

**Timestamps.** Every timestamp is ISO 8601 in UTC with milliseconds, like `2026-10-13T16:20:00.000Z`. Decode with `ISO8601DateFormatter` and `[.withInternetDateTime, .withFractionalSeconds]`. Day keys inside `rhythm` (`2026-10-13`) are plain UTC calendar dates, not timestamps.

**Ids.** Lesson, achievement and user ids are lowercase UUID strings.

## Shared shapes

### Rhythm, DayCell, RhythmCopy

Computed by the server in UTC with `computeRhythm`, `describeRhythm` and `rhythmMicrocopy` from `src/lib/streaks.ts`, the same functions the site's week-goal card and lesson rail use. Show them as sent. Never recompute them in the device's timezone (guests excepted).

```json
"rhythm": {
  "goal": 5,
  "windowKind": "week",
  "windowLabel": "this week",
  "windowStartKey": "2026-10-12",
  "windowEndKey": "2026-10-18",
  "windowCount": 2,
  "remaining": 3,
  "pct": 40,
  "days": [
    { "key": "2026-10-12", "label": "Mon", "dayOfMonth": 12, "count": 0, "isToday": false, "isFuture": false },
    { "key": "2026-10-13", "label": "Tue", "dayOfMonth": 13, "count": 2, "isToday": false, "isFuture": false },
    { "key": "2026-10-14", "label": "Wed", "dayOfMonth": 14, "count": 0, "isToday": true, "isFuture": false },
    { "key": "2026-10-15", "label": "Thu", "dayOfMonth": 15, "count": 0, "isToday": false, "isFuture": true },
    { "key": "2026-10-16", "label": "Fri", "dayOfMonth": 16, "count": 0, "isToday": false, "isFuture": true },
    { "key": "2026-10-17", "label": "Sat", "dayOfMonth": 17, "count": 0, "isToday": false, "isFuture": true },
    { "key": "2026-10-18", "label": "Sun", "dayOfMonth": 18, "count": 0, "isToday": false, "isFuture": true }
  ],
  "daysActiveInWindow": 1,
  "lifetime": 4,
  "activeDays": 3,
  "currentStreak": 1,
  "bestStreak": 2,
  "bestWindow": 4,
  "daysSinceLast": 1,
  "returnedAfterDays": null,
  "phase": "building"
},
"rhythmCopy": {
  "eyebrow": "This week",
  "headline": "3 to go this week",
  "body": "2 lessons down. Coming back on another day counts for more than doing them all at once.",
  "cta": "Next lesson"
},
"rhythmMicrocopy": "3 more makes the week."
```

| Field | Type | Notes |
|---|---|---|
| `goal` | Int | Lessons that make a week count (5). |
| `windowKind` | String | `first-week` (the 7 days from signup) or `week` (Monday to Sunday). |
| `windowLabel` | String | `your first week` or `this week`. |
| `windowStartKey`, `windowEndKey` | String | `YYYY-MM-DD`. |
| `windowCount` | Int | Lessons inside the window. |
| `remaining` | Int | `goal - windowCount`, never below 0. |
| `pct` | Int | 0 to 100. |
| `days` | [DayCell] | Always 7, oldest first. |
| `daysActiveInWindow`, `lifetime`, `activeDays` | Int | |
| `currentStreak`, `bestStreak`, `bestWindow` | Int | Records, never stakes. |
| `daysSinceLast`, `returnedAfterDays` | Int? | |
| `phase` | String | `new`, `first-lesson`, `building`, `goal-met`, `returning`, `resting`. |

DayCell: `key` (String), `label` (String, `Mon`...`Sun`), `dayOfMonth` (Int), `count` (Int), `isToday` (Bool), `isFuture` (Bool).

RhythmCopy: `eyebrow`, `headline`, `body`, `cta` (all String). `rhythmMicrocopy` is the one-line version the site shows beside a lesson. Some of the site's copy contains an emoji or a dash; render the strings exactly as they arrive.

### NextUnlock

The nearest lesson-count badge, or `null`. Streak badges are never dangled (site rule).

```json
"nextUnlock": {
  "name": "Committed",
  "description": "Complete 10 lessons.",
  "icon": "Flame",
  "progress": { "current": 7, "target": 10, "unit": "lessons" }
}
```

`icon` is a lucide icon name (map it to an SF Symbol in the app).

### MeProfile

The caller's own profile. The only place anyone's `fullName` is ever sent, and only their own.

```json
{
  "id": "6f1c2b9e-0d7a-4c55-9a51-2f7f0c1d9a11",
  "username": "maya_254",
  "fullName": "Maya Chen",
  "avatarUrl": "https://lh3.googleusercontent.com/a/example",
  "teamNumber": 254,
  "bio": "Programming lead.",
  "role": "student",
  "xp": 1240,
  "level": 13,
  "tier": "Veteran",
  "createdAt": "2026-08-21T03:14:07.000Z",
  "emailOptIn": false,
  "emailChoiceAt": "2026-08-21T03:14:09.512Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `username` | String? | Null until the username step is done. |
| `fullName`, `avatarUrl`, `bio` | String? | |
| `teamNumber` | Int? | 1 to 99999. |
| `role` | String | `student`, `mentor`, `alum`, `coach`, `other`. |
| `xp` | Int | Server-owned. |
| `level` | Int | `floor(xp / 100) + 1`. |
| `tier` | String | `Rookie` (level 1-2), `Contender` (3+), `Veteran` (8+), `All-Star` (15+), `Champion` (25+). |
| `emailOptIn` | Bool | Reminder emails on. Only ever true by the member's own choice. |
| `emailChoiceAt` | String? | Null means they were never asked. |

## Routes

### GET /api/app/reference

Public. `Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`.

The reference data that lives in the site's TypeScript: the glossary (`src/lib/glossary-data.ts`), learning paths (`src/lib/paths-data.ts`), each lesson's "read next" articles (`src/lib/lesson-bridge.ts`) and the start goals (`src/lib/recommend.ts`). Cache it on device; refetch when it's older than 6 hours. `version` changes whenever any of it changes, so compare it before re-parsing.

Response 200, about 110 KB:

```json
{
  "glossary": [
    {
      "term": "Kickoff",
      "category": "General",
      "definition": "The event in early January that opens the season: the new game is revealed and the build period begins.",
      "link": "https://www.firstinspires.org/robotics/frc/kickoff",
      "inMatch": "Kickoff is the most consequential Saturday of your season...",
      "alsoCalled": ["Kickoff Saturday", "Game reveal"],
      "lessonCues": ["kickoff", "game reveal", "annual season"],
      "related": ["Build Season", "Kit of Parts", "FIRST Choice"],
      "slug": "kickoff"
    }
  ],
  "glossaryCategories": ["General", "Competition & Game", "Software", "Electrical", "Mechanical", "Sensors & Controls", "Awards", "Data & Scouting", "Community"],
  "paths": [
    {
      "slug": "new-member-onboarding",
      "title": "New Member Onboarding",
      "description": "Brand new to the team? ...",
      "icon": "Rocket",
      "color": "#3b82f6",
      "outcomes": ["Understand what FRC is, the season cadence, and how a team runs"],
      "steps": [
        { "deptSlug": "getting-started", "label": "Learn how FRC works", "note": "Start here. ..." },
        { "deptSlug": "safety", "label": "Earn your shop safety basics", "note": "Before you touch a tool ..." }
      ]
    }
  ],
  "lessonBridge": {
    "3ac2f8bd-38e0-40c5-aaa0-4757b0d50df0": ["frc-led-lights", "frc-pdh-power-distribution-hub", "frc-code-structure-best-practices"]
  },
  "startGoals": [
    { "id": "new", "label": "I'm brand new", "blurb": "Rookie, or still working out where you fit.", "iconName": "Rocket", "pathSlug": "new-member-onboarding" }
  ],
  "version": "2e0cc1c08c9643f7"
}
```

GlossaryTerm: `term`, `category`, `definition`, `slug` are always present. `abbr`, `link`, `internalLink` (a site path like `/blog/frc-can-bus`), `inMatch`, `alsoCalled`, `lessonCues`, `related` (other terms' `term` values) are optional; a missing key means none. LearningPath: `slug`, `title`, `description`, `icon` (lucide name), `color` (hex), `outcomes` [String], `steps` [{ `deptSlug`, `label`, `note` }]. `lessonBridge` maps a lesson id to article slugs (`/blog/{slug}`) in display order; lessons with no good match are absent. StartGoal: `id`, `label`, `blurb`, `iconName` (lucide), `pathSlug`.

### GET /api/app/start-plan?goal={goalId}

Bearer optional. `Cache-Control: no-store`. The site's first-run plan (`/start`): one answer to "What do you do on your team?" turned into the five lessons that get someone started. Built by `getStarterPlan` (`src/lib/recommend.ts`), the same function `/start` and the dashboard's plan card call, reshaped by `loadStartPlan` (`src/lib/app/start-plan.ts`), so the app and the site give the same learner the same five lessons in the same order.

`goal` is a `startGoals[].id` from `/api/app/reference` (`new`, `code`, `build`, `impact`, `gameday`). Missing or unknown gets the default plan (`new`), like the site, with `tailored: false`.

The answer is stored on the device, not on the account. The site keeps it per browser in a one-year cookie (`lf_goal`); the app keeps it in its own UserDefaults for a year and sends it here. Nothing is written.

Auth: with no `Authorization` header, every `done` is false. With a valid token, the account's finished lessons are ticked exactly as on `/start`. An `Authorization` header with an expired or revoked token gets a 401 (refresh and retry once), never a quiet fall back to the signed-out plan.

Finished lessons are not swapped out. Like the site, they stay in the plan as ticked rows (a plan that reshuffles under you never reads as progress), and `next` skips them: it's the first unticked row, or once all five are ticked, the next unfinished lesson further down the same route.

Response 200 (`goal=code`, signed out):

```json
{
  "goal": { "id": "code", "label": "Programming & controls", "blurb": "Robot code, sensors, autonomous.", "pathSlug": "become-a-robot-programmer", "iconName": "Code2" },
  "tailored": true,
  "pathSlug": "become-a-robot-programmer",
  "pathTitle": "Become a Robot Programmer",
  "target": 5,
  "lessons": [
    { "lessonId": "eb956f1f-6624-4d0a-9f3b-048fe7db4f82", "title": "What Is FIRST?", "departmentSlug": "getting-started", "departmentName": "Getting Started with FRC", "moduleSlug": "what-first-and-frc-are", "slug": "what-is-first", "minutes": 2, "done": false },
    { "lessonId": "ae85a782-97d4-4bb7-af56-fe73906e217a", "title": "Programming Basics: Variables, Data Types, and Operators", "departmentSlug": "programming-software", "departmentName": "Programming, Controls & Sensors", "moduleSlug": "prerequisites", "slug": "variables-data-types-operators", "minutes": 2, "done": false }
  ],
  "doneCount": 0,
  "next": { "lessonId": "eb956f1f-6624-4d0a-9f3b-048fe7db4f82", "title": "What Is FIRST?", "departmentSlug": "getting-started", "departmentName": "Getting Started with FRC", "moduleSlug": "what-first-and-frc-are", "slug": "what-is-first", "minutes": 2, "done": false, "step": 1 }
}
```

| Field | Type | Notes |
|---|---|---|
| `goal` | { `id`, `label`, `blurb`, `pathSlug`, `iconName` } (all String) | The goal the plan was built for: the default (`new`) when `goal` was missing or unknown. `iconName` is a lucide name. |
| `tailored` | Bool | False when the default plan was used because `goal` was missing or unknown. The site then links "Tell us what you do and we'll cut this to fit" instead of "Not your subteam? Change the route". |
| `pathSlug`, `pathTitle` | String | The curated learning path (`paths[]` in `/api/app/reference`). |
| `target` | Int | 5, the length the plan aims for. |
| `lessons` | [StartPlanLesson] | In plan order. Exactly `target` long unless the catalogue is smaller. |
| `doneCount` | Int | Ticked rows in `lessons`. |
| `next` | (StartPlanLesson + `step` Int)? | The single next action. `step` is 1-based within `lessons`; when it's greater than `target` the lesson is past the plan (the site says "further down your route"). Null only when the whole route is finished. |

StartPlanLesson: `lessonId` (String, UUID), `title`, `departmentSlug`, `departmentName`, `moduleSlug`, `slug` (all String; the lesson's site path is `/guides/{departmentSlug}/{moduleSlug}/{slug}`), `minutes` (Int: the real read time from the word count, the number the lesson page prints, not the inflated `estimated_minutes` column; always sent, decode it as optional), `done` (Bool).

The plan screen's words are in `src/app/start/page.tsx` and `src/components/onboarding/first-run-plan.tsx`.

Errors: 401 (a token was sent and it's no longer valid), 500 `server`.

### GET /api/app/resources

Public. `Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`.

Everything learnfrc.com/resources shows, as data: the toolbox (five hand-picked shelves of outside links) and the sources every department's lessons cite. Built by `loadResources` (`src/lib/app/resources.ts`), the function the page renders from, so the app lists exactly what the site lists. Cache it on device like `/api/app/reference`; `version` changes whenever any of it changes.

Response 200, about 31 KB:

```json
{
  "shelves": [
    { "slug": "official-first", "name": "Official FIRST", "blurb": "The manual, season materials, and game tools straight from FIRST." },
    { "slug": "software-programming", "name": "Software & Programming", "blurb": "WPILib and the vision, path, and trajectory tools your code leans on." }
  ],
  "toolbox": [
    { "title": "FIRST Robotics Competition", "url": "https://www.firstinspires.org/robotics/frc", "host": "firstinspires.org", "shelf": "official-first" },
    { "title": "WPILib Documentation", "url": "https://docs.wpilib.org", "host": "docs.wpilib.org", "shelf": "software-programming" }
  ],
  "departments": [
    {
      "slug": "getting-started",
      "name": "Getting Started with FRC",
      "sources": [
        { "title": "Gracious Professionalism and Coopertition (FIRST Community)", "url": "https://community.firstinspires.org/gracious-professionalism-and-coopertition", "host": "community.firstinspires.org" }
      ]
    }
  ],
  "sourcesPerDepartment": 6,
  "totals": { "links": 17, "shelves": 5, "sources": 168, "departments": 11 },
  "version": "a2b10966fd9b457c"
}
```

| Field | Type | Notes |
|---|---|---|
| `shelves` | [{ `slug`, `name`, `blurb` }] (all String) | The toolbox shelves in page order. `slug` is the mono label the site prints (`shelf 01 / official-first`). |
| `toolbox` | [{ `title`, `url`, `host`, `shelf` }] (all String) | Every toolbox link in page order, shelf by shelf. `shelf` is its shelf's `slug`; group by it to draw the shelves. `host` is the label printed beside each link (`www.` stripped). There is no `note` today; decode one as optional if it ever appears. |
| `departments` | [{ `slug`, `name`, `sources` }] | Only departments that cite at least one source, in catalogue order. `sources` is the full list ([{ `title`, `url`, `host` }]). |
| `sourcesPerDepartment` | Int | The site prints the first 6 of each department's sources and labels the group `first 6 of {count}` (or `{count} cited` when it has 6 or fewer). |
| `totals` | { `links`, `shelves`, `sources`, `departments` } (all Int) | The page's counts: toolbox links, shelves, cited sources, departments that cite any. |
| `version` | String | Changes whenever anything above changes. |

Source titles come from the database and some contain a dash; render them exactly as they arrive. Every link leaves the site. The page's own words (headings, blurbs, the citation notes) are in `src/app/resources/page.tsx`.

Errors: 500.

### GET /api/app/me

Bearer. Who the token belongs to, their own profile and the site's onboarding flags.

Response 200:

```json
{
  "user": { "id": "6f1c2b9e-0d7a-4c55-9a51-2f7f0c1d9a11", "email": "maya@example.com" },
  "profile": { "...": "MeProfile, see above" },
  "needsUsernameSetup": false,
  "isPlaceholderUsername": false,
  "emailPrompt": true,
  "referralCount": 2,
  "siteRole": "member"
}
```

| Field | Type | Notes |
|---|---|---|
| `user.email` | String? | The caller's own email. |
| `profile` | MeProfile? | Null only if the account has no profile row (should not happen). |
| `needsUsernameSetup` | Bool | True when `username` is null. Show `UsernameSetupView` before anything else (the site's hard gate). |
| `isPlaceholderUsername` | Bool | A machine-made handle like `neon_roboteer_85`. The site asks, never blocks; skipping hides the ask for 14 days. |
| `emailPrompt` | Bool | Ask the one-time "Want reminder emails?" question. True when the member has never answered and has a username. |
| `referralCount` | Int | People who signed up with this member's invite link. |
| `siteRole` | String | `member`, `admin` or `superadmin`, from `getSiteRole` (an owner email in `ADMIN_EMAILS`, otherwise the `site_admins` row). Show the admin rows when it isn't `member`, and the Admin team row only for `superadmin`. Display only: every admin route checks the role again on the server, so a stale value just gets a 403. Treat a missing key (an older server) as `member`. |

The site's soft "finish your profile" ask shows when `isPlaceholderUsername` is true or `teamNumber` is null; the app keeps its own 14-day skip timer.

Errors: 401.

### GET /api/app/me/progress

Bearer. Everything per-user the app shows, in one call. Refresh on launch, on returning to the foreground, after every write and on pull-to-refresh.

Response 200:

```json
{
  "completions": [
    { "lessonId": "3ac2f8bd-38e0-40c5-aaa0-4757b0d50df0", "completedAt": "2026-10-13T16:20:00.000Z", "xpAwarded": 11 }
  ],
  "bookmarks": [
    { "lessonId": "b46175d9-ff33-41a7-a9c7-b791a1ea803b", "createdAt": "2026-10-02T21:05:44.120Z" }
  ],
  "earnedAchievements": [
    { "achievementId": "4f601fbb-cc19-4186-865f-2f75a1c8c5d2", "slug": "first-lesson", "earnedAt": "2026-09-04T20:55:07.960Z" }
  ],
  "xp": 1240,
  "level": 13,
  "rhythm": { "...": "Rhythm, see above" },
  "rhythmCopy": { "...": "RhythmCopy, see above" },
  "rhythmMicrocopy": "3 more makes the week.",
  "nextUnlock": null
}
```

| Field | Type | Notes |
|---|---|---|
| `completions` | [{ `lessonId` String, `completedAt` String?, `xpAwarded` Int }] | One per completed lesson, oldest first. `xpAwarded` is 10 to 20. |
| `bookmarks` | [{ `lessonId` String, `createdAt` String? }] | Oldest first. The app may also read and write bookmarks directly (RLS `bm_*_own`). |
| `earnedAchievements` | [{ `achievementId` String, `slug` String?, `earnedAt` String? }] | Oldest first. Join to the `achievements` table by id. |
| `xp`, `level` | Int | |
| `rhythm`, `rhythmCopy`, `rhythmMicrocopy` | | See Shared shapes. |
| `nextUnlock` | NextUnlock? | |

Errors: 401.

### POST /api/app/progress/complete

Bearer. Completes a lesson. The server re-grades the quiz (every answer must be right), applies the rate limits (12 a minute, 120 an hour), writes the row, awards XP (database trigger) and badges, and records the funnel events, using `completeLesson` from `src/lib/app/progress.ts`, the same function the website's quiz card calls.

Request:

```json
{ "lessonId": "3ac2f8bd-38e0-40c5-aaa0-4757b0d50df0", "answers": [2, 0, 3] }
```

`answers` has one option index (0-based) per quiz question, in order. Completing a lesson that is already complete succeeds and changes nothing.

Response 200:

```json
{
  "ok": true,
  "alreadyCompleted": false,
  "xpAwarded": 11,
  "xp": 1251,
  "level": 13,
  "newAchievements": [
    { "id": "2d0b7c55-7f43-4f1e-8a43-5b1f0f0a9c21", "slug": "ten-lessons", "name": "Committed", "description": "Complete 10 lessons.", "icon": "Flame" }
  ],
  "completedCount": 10,
  "rhythm": { "...": "Rhythm" },
  "rhythmCopy": { "...": "RhythmCopy" },
  "rhythmMicrocopy": "3 more makes the week."
}
```

| Field | Type | Notes |
|---|---|---|
| `alreadyCompleted` | Bool | True when the lesson was already done; then `xpAwarded` is 0 and `newAchievements` is usually empty. |
| `xpAwarded` | Int | The real XP this completion earned (10 plus a streak bonus, up to 20). Show this, never a hardcoded number. |
| `xp`, `level` | Int | Totals after the write. |
| `newAchievements` | [{ `id`, `slug`, `name`, `description`, `icon` }] | Badges this completion unlocked, in catalog order. |
| `completedCount` | Int | Lessons completed, all time. |

Errors:

| Status | `code` | `error` |
|---|---|---|
| 400 | `validation` | `Answer every quiz question correctly to complete this lesson.` |
| 400 | `validation` | `That lesson id isn't valid.` |
| 404 | `not_found` | `We couldn't find that lesson.` |
| 429 | `rate_limited` | `You're completing lessons unusually fast. Take a breather and try again in a minute.` (`Retry-After` 60 or 3600) |
| 401, 500 | | |

Offline: queue `{ lessonId, answers }` and POST it when the connection returns. The server stamps the completion time when it arrives.

### DELETE /api/app/progress/complete?lessonId={uuid}

Bearer. Marks a lesson not complete (`uncompleteLesson`, the website's "mark as not done"). The database refunds the XP that completion earned. Badges are never taken away.

Response 200:

```json
{
  "ok": true,
  "xp": 1240,
  "level": 13,
  "completedCount": 9,
  "rhythm": { "...": "Rhythm" },
  "rhythmCopy": { "...": "RhythmCopy" },
  "rhythmMicrocopy": "3 more makes the week."
}
```

Errors: 400 `validation` (`That lesson id isn't valid.`), 401, 500.

### PATCH /api/app/profile

Bearer. Settings, through `updateProfileFields`, the same function as the website's settings form.

Request (every field optional; a field left out keeps its current value, `null` clears it):

```json
{ "fullName": "Maya Chen", "bio": "Programming lead.", "avatarUrl": "https://example.com/me.png", "username": "maya_254", "teamNumber": 254, "role": "student" }
```

| Field | Type | Rule |
|---|---|---|
| `fullName`, `bio` | String? | Trimmed; blank means none. Profanity filtered. |
| `avatarUrl` | String? | Must start with `http://` or `https://`. |
| `username` | String? | Lowercased and reduced to `a-z`, `0-9`, `_`; at least 3 characters; unique; profanity filtered. |
| `teamNumber` | Int? | 1 to 99999. Changing it is limited to 3 changes a day. |
| `role` | String? | `student`, `mentor`, `alum`, `coach`, `other`; anything else saves as `student`. |

Response 200: the updated MeProfile.

Errors (the site's messages):

| Status | `code` | `error` |
|---|---|---|
| 400 | `validation` | `Avatar URL must start with http:// or https://` |
| 400 | `validation` | `Enter a valid FRC team number.` |
| 400 | `validation` | `Username must be at least 3 characters (a–z, 0–9, _).` |
| 400 | `validation` | `That username isn't allowed. Please choose another.` / `That name isn't allowed. Please use a different one.` / `Please remove the inappropriate language from your bio.` |
| 409 | `conflict` | `That username is already taken.` |
| 429 | `rate_limited` | `Too many profile updates. Try again in a bit.` (20 an hour) |
| 429 | `rate_limited` | `You've changed your team number a few times today. Try again tomorrow.` |
| 401, 404, 500 | | |

### POST /api/app/profile/setup

Bearer. The profile setup step (`saveProfileSetupFields`, the website's dashboard setup card): the username for an account with no username or a placeholder one, and the team number for an account whose handle is its own but has no team number (the card's team mode). A username the person chose themselves is never overwritten here; renames go through `PATCH /api/app/profile`.

Request:

```json
{ "username": "maya_254", "teamNumber": 254 }
```

`teamNumber` is optional (Int or null). `username` is ignored for an account whose handle is its own, so the app's team-only ask (`AccountStore.setupTeamNumber(_:)`) leaves it out and sends `{ "teamNumber": 254 }`.

Response 200: the updated MeProfile.

Errors: 400 `validation` (`Username must be at least 3 characters (a–z, 0–9, _).`, `That username isn't allowed. Please choose another.`, `Enter a valid FRC team number.`, `Nothing to save. Choose a different username, add your team number, or Skip for now.`, `Enter your team number, or choose Skip for now.`), 409 `conflict` (`That username is already taken.`, `Your profile changed in another tab. Reload and retry.`), 429 `rate_limited` (`You've changed your team number a few times today. Try again tomorrow.`, the same 3-a-day budget as `PATCH /api/app/profile`, counted only when the team number changes), 401, 500 `server` (`Couldn't save that. Try again.`).

### POST /api/app/email-opt-in

Bearer. Reminder emails on or off (`setEmailChoice`, the website's Settings switch and one-time prompt). Every call records the time of the choice, which stops the prompt from asking again. Reminders are opt-in: never send `true` unless the person said yes.

Request:

```json
{ "optIn": true }
```

Response 200:

```json
{ "optIn": true, "emailChoiceAt": "2026-10-13T18:02:11.123Z" }
```

Errors: 400 `validation` (`Something went wrong. Try again.` when `optIn` isn't a boolean), 429 `rate_limited` (`Too many changes. Try again in a bit.`, 30 an hour), 401, 500.

### GET /api/app/team

Bearer. The caller's own team sheet, the same data as the website's /teams page (`loadTeamSheet`). The team is always the one on the caller's own profile. Teammates are shown by username and avatar only. Anyone the caller has blocked (`GET /api/app/blocks`) is left off the whole sheet: the roster, the coverage and every figure are worked out from the members the caller can see, and `hiddenMembers` says how many were left off.

Response 200 with no team number on the profile:

```json
{ "team": null }
```

Response 200 with a team:

```json
{
  "team": {
    "number": 254,
    "memberCount": 2,
    "totalLessons": 394,
    "totalCompleted": 57,
    "avgPct": 7,
    "claimedSubteams": 4,
    "totalSubteams": 11,
    "lessonsCovered": 51,
    "hiddenMembers": 0,
    "referralCount": 1,
    "inviteURL": "https://learnfrc.com/signup?ref=maya_254&via=team-invite",
    "members": [
      {
        "username": "maya_254",
        "name": "maya_254",
        "avatarUrl": null,
        "role": "student",
        "xp": 1240,
        "isYou": true,
        "completed": 42,
        "lastActive": "2026-10-13T16:20:00.000Z",
        "joinedAt": "2026-08-21T03:14:07.000Z",
        "depts": [
          {
            "slug": "getting-started",
            "name": "Getting Started with FRC",
            "completed": 2,
            "total": 28,
            "furthest": { "title": "The FIRST Progression: FLL, FTC, and FRC", "moduleTitle": "What FIRST and FRC Are" },
            "next": { "title": "What Makes the FIRST Robotics Competition Unique", "href": "/guides/getting-started/what-first-and-frc-are/what-makes-frc-unique" }
          }
        ]
      }
    ],
    "subteamCoverage": [
      {
        "slug": "electrical-wiring",
        "name": "Electrical & Wiring",
        "lessonCount": 35,
        "teamCompleted": 0,
        "members": []
      },
      {
        "slug": "programming-software",
        "name": "Programming, Controls & Sensors",
        "lessonCount": 51,
        "teamCompleted": 14,
        "members": [
          { "username": "maya_254", "name": "maya_254", "avatarUrl": null, "completed": 12, "isYou": true }
        ]
      }
    ]
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `totalCompleted` | Int | Lessons finished counting everyone (a lesson two people did counts twice). |
| `avgPct` | Int | 0 to 100, average through the catalog. |
| `claimedSubteams` / `totalSubteams` | Int | Departments with at least one member on them. |
| `lessonsCovered` | Int | Distinct lessons anyone on the team has finished. |
| `hiddenMembers` | Int | Teammates the caller has blocked, left off this sheet (the site prints "plus 1 you blocked, not shown"). Added for report and block; decode it as optional. |
| `inviteURL` | String? | The team invite link every site surface hands out. Null until the caller has a username. |
| `members` | [...] | Most lessons first. `username` can be null (then `name` is `Member`). `lastActive` is null with no completions. |
| `members[].depts` | [...] | One per department in catalog order. `furthest` and `next` can be null. `next.href` is a site path; it maps to a lesson the same way `https://learnfrc.com/guides/...` links do. |
| `subteamCoverage` | [...] | One per department in catalog order. `members` is empty when nobody on the team has started that subteam. |

Errors: 401, 500.

### GET /api/app/leaderboard?board=weekly|alltime|teams

Public. `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`. The same boards as the website's /leaderboard (the underlying queries refresh every 5 minutes). Top 50. `board` defaults to `weekly`. Usernames only. To highlight the caller, compare `username` with their own.

Response 200, `weekly` (XP and lessons from the last 7 days; level from all-time XP) or `alltime`:

```json
{
  "board": "weekly",
  "entries": [
    { "rank": 1, "username": "maya_254", "avatarUrl": null, "teamNumber": 254, "role": "student", "xp": 164, "level": 13, "lessons": 11 }
  ],
  "totals": { "learners": 312, "totalXp": 48210 }
}
```

`username` can be null (show `Learner`). `teamNumber` can be null. `totals` covers every learner with XP, not just the top 50.

The route is public and the same for everyone, so it never leaves anyone out. A signed-in app hides the handles it has blocked (`GET /api/app/blocks`) itself, as learnfrc.com/leaderboard does for its reader: the rows go, every other rank stays as earned (so a rank can skip a number). The teams boards aren't filtered.

Response 200, `teams`:

```json
{
  "board": "teams",
  "entries": [
    { "rank": 1, "teamNumber": 447, "members": 15, "xp": 9120, "avgXp": 608 }
  ],
  "perMember": [
    { "rank": 1, "teamNumber": 447, "members": 15, "xp": 9120, "avgXp": 608 }
  ],
  "minMembers": 3,
  "totals": { "learners": 312, "totalXp": 48210 }
}
```

`entries` ranks by combined XP. `perMember` ranks teams with at least `minMembers` members by XP per member, as the site's second team board does.

Errors: 400 `validation` (`Pick a board: weekly, alltime or teams.`), 500.

### GET /api/app/u/{username}

Public. `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`. Somebody's public record, the same reads as the website's /u/{username} page. `username` must match exactly (handles are lowercase).

Response 200:

```json
{
  "username": "maya_254",
  "avatarUrl": null,
  "teamNumber": 254,
  "bio": "Programming lead.",
  "role": "student",
  "xp": 1240,
  "level": 13,
  "tier": "Veteran",
  "createdAt": "2026-08-21T03:14:07.000Z",
  "lessonCount": 42,
  "achievements": [
    { "slug": "twentyfive-lessons", "name": "Quarter Master", "description": "Complete 25 lessons.", "icon": "Target", "earnedAt": "2026-10-01T19:02:33.401Z" }
  ]
}
```

`achievements` is most recent first. Never includes a real name, email or id.

The route is public and doesn't know who is asking. When the signed-in account has blocked `username` (`GET /api/app/blocks`), the app doesn't draw the record: it shows the site's blocked card ("You blocked @{username}.", Unblock, Report), as learnfrc.com/u/{username} does.

Errors: 404 `not_found` (`There's no learner with that username.`), 500.

### POST /api/app/auth/sign-in

Public, rate limited (30 tries per 5 minutes per network, 10 per 5 minutes per account). Signs in with an email or a username, like the website's login form; the username lookup is `resolveSignInEmail`, shared with the site. Plain email sign-in can also go straight to Supabase from the app.

Request:

```json
{ "identifier": "maya_254", "password": "correct horse battery" }
```

Response 200:

```json
{
  "accessToken": "eyJhbGciOiJFUzI1NiIs...",
  "refreshToken": "v1.MjE3...",
  "expiresAt": 1792000000,
  "expiresIn": 3600,
  "tokenType": "bearer",
  "userId": "6f1c2b9e-0d7a-4c55-9a51-2f7f0c1d9a11"
}
```

Install it with `supabase.auth.setSession(accessToken:refreshToken:)`. `expiresAt` is Unix seconds. The account's email is never sent back.

Errors:

| Status | `code` | `error` |
|---|---|---|
| 400 | `validation` | `Please enter your email or username and password.` |
| 401 | `unauthorized` | `No account found with that username.` |
| 401 | `unauthorized` | `Couldn't sign you in. Try your email instead.` |
| 401 | `unauthorized` | Supabase's message, for example `Invalid login credentials` or `Email not confirmed`. |
| 429 | `rate_limited` | `Too many sign-in attempts. Wait a few minutes and try again.` (per network) |
| 429 | `rate_limited` | `Too many attempts. Wait a minute and try again.` (per network and account) |

The app shows the 401 sentences exactly as sent, like the website's login form does (`APIError.from(status:data:headers:authenticated: false)`); a refused sign-in is never reported as a signed-out session.

### POST /api/app/auth/sign-up

Public, rate limited (30 an hour per network; a whole team often signs up together on one school network). Creates an account with exactly the website's rules (`registerAccount`: ban list, profanity filter, username rules and uniqueness, team number, the already-registered check, reminder-email consent, referral and source attribution).

Request:

```json
{
  "email": "maya@example.com",
  "password": "correct horse battery",
  "username": "maya_254",
  "fullName": "Maya Chen",
  "teamNumber": 254,
  "emailOptIn": false,
  "ref": "jordan_frc",
  "via": "team-invite",
  "platform": "ios"
}
```

| Field | Type | Notes |
|---|---|---|
| `email`, `password`, `username` | String | Required. Password at least 8 characters. |
| `fullName` | String? | Optional. Only ever shown back to the person themselves. |
| `teamNumber` | Int? | Optional, 1 to 99999. |
| `emailOptIn` | Bool | Required. The unticked "email me reminders" box; `true` only if they ticked it. |
| `ref`, `via` | String? | From an invite link (`?ref=` and `?via=`). Unknown `via` values are ignored. |
| `platform` | String? | `ios`, `ipados` or `macos`. Recorded as the signup source (`iOS app`, `iPad app`, `Mac app`; anything else is `LearnFRC app`) unless a referral or hook applies. |

Response 200:

```json
{ "status": "confirm_email" }
```

`confirm_email`: the account was created and a confirmation email sent. The link opens learnfrc.com (which pays any referral reward and sends the welcome email); then the person signs in from the app. `exists`: that email already has an account (Supabase reports success without sending anything), so send them to sign in.

Errors (the site's messages):

| Status | `code` | `error` |
|---|---|---|
| 400 | `validation` | `Email and password are required.` |
| 400 | `validation` | `Password must be at least 8 characters.` |
| 400 | `validation` | `Choose a username: at least 3 characters (letters, numbers, _).` |
| 400 | `validation` | `That username isn't allowed. Please choose another.` / `That name isn't allowed. Please use a different one.` |
| 400 | `validation` | `Enter a valid FRC team number.` |
| 400 | `validation` | `This account can't be created. If you believe this is a mistake, contact support.` |
| 400 | `validation` | Supabase's message for anything else it rejects. |
| 409 | `conflict` | `That username is already taken.` |
| 429 | `rate_limited` | `Too many sign-ups from this network. Try again in a bit.`, or Supabase's own limit message. |

### POST /api/app/auth/oauth-complete

Bearer. The app's half of the website's `/auth/callback`. On the site, Google and Apple sign-ins land on that route, which records where a brand-new account came from and pays any pending referral reward. The app's own Google and Apple sign-ins never pass through it, so call this straight after every OAuth sign-in, as soon as the session is installed and before anything else (including `GET /api/app/me`). Both doors run `completeOAuthSignIn` (`src/lib/app/accounts.ts`): the same "new account" test, the same attribution and the same reward.

"New" means the account was created in the last 5 minutes (`isFreshSignup`), so a call made late attributes nothing. Calling it on every OAuth sign-in is safe: an older account gets `false` and nothing is attributed, a source that's already set is never overwritten, and the referral reward (+25 XP each side) is paid at most once. Google and Apple have already verified the address, so the reward is paid now rather than after a confirmation email.

Request (every field optional; no body at all is the same as `{}`):

```json
{ "ref": "jordan_frc", "via": "team-invite", "platform": "ios" }
```

After Sign in with Apple:

```json
{ "platform": "ios", "fullName": "Jordan Rivera", "appleAuthorizationCode": "c1f0e2...0a9.0.rsuv.AbCdEf" }
```

| Field | Type | Notes |
|---|---|---|
| `ref`, `via` | String? | From the invite link the app was opened with (`?ref=` and `?via=`), exactly as for `POST /api/app/auth/sign-up`. Unknown `via` values are ignored; a `ref` that isn't another member's username credits nobody. |
| `platform` | String? | `ios`, `ipados` or `macos`. Recorded as the signup source (`iOS app`, `iPad app`, `Mac app`; anything else, or nothing, is `LearnFRC app`), the same rule as `POST /api/app/auth/sign-up`. A `ref` wins over it and records `Referral`. |
| `fullName` | String? | Sign in with Apple only: the name in Apple's credential (`ASAuthorizationAppleIDCredential.fullName`, formatted), which Apple sends only on the person's first sign-in to LearnFRC. Saved as the profile's full name (private, the name on certificates) only if the profile has none, with the signup form's profanity rule; trimmed to 100 characters. Ignored for an account without an Apple identity. Omit it when Apple sent no name. |
| `appleAuthorizationCode` | String? | Sign in with Apple only: the credential's `authorizationCode` as UTF-8 text. The site trades it with Apple (client id: the app's bundle id) for the refresh token it revokes when the account is deleted (`DELETE /api/app/account`), after checking the code belongs to the account's own Apple ID. Good for five minutes and once, so send it with this first call; the trade happens after the response, so it never slows the sign-in. Ignored for an account without an Apple identity, or when longer than 4096 characters. |

Response 200:

```json
{ "isNewAccount": true }
```

`isNewAccount` is true only for an account created moments ago. The site sends such a person to `/start` (the one-question first-run plan, see `GET /api/app/start-plan`) instead of the dashboard, unless they were heading somewhere specific like an invite. A new Google or Apple account usually has no username yet, so the username step (`needsUsernameSetup` from `GET /api/app/me`) still comes first, as on the site.

Attribution and Apple trouble never fail the call (they're logged on the server), because nothing after the sign-in itself may block it.

The ban list does. A brand-new account whose email is on the ban list, or that was made from a banned IP, is deleted on the spot and the call answers 403 `forbidden` with `This account can't be created. If you believe this is a mistake, contact support.` (the sign-up form's sentence). Sign out and show it. The session the app holds is for an account that no longer exists, so an older app that ignores this answer gets 401 on its next call and signs out then.

Errors: 400 `validation` (a body that isn't a JSON object), 401, 403 `forbidden` (the ban list, above).

An Apple account's email can be an Apple "Hide My Email" address (`...@privaterelay.appleid.com`). It's real: Apple forwards mail sent to it. Don't suggest a username from it or show its first half as a name.

Errors: 400 `validation` (`That request wasn't in the format we expected.` when the body isn't a JSON object or a field isn't a string), 401, 500.

### POST /api/app/migrate-guest

Bearer. After sign-in or sign-up, moves the lessons this device completed as a guest into the account (`migrateGuestProgress`, the same function as the website's /api/migrate-guest). Guest completions are saved with `POST /api/guest-progress { visitorId, lessonId, complete: true, answers }`, an existing public route with its own quiz check; only rows the server holds migrate, with their original dates, and XP comes from the database trigger. Call it once after each sign-in; calling it again is harmless.

Request:

```json
{ "visitorId": "a7d1e0c2-6b3f-4f0e-9a7e-1f2b3c4d5e6f" }
```

Response 200:

```json
{ "migrated": 3, "xp": 34, "lessonIds": ["3ac2f8bd-38e0-40c5-aaa0-4757b0d50df0"] }
```

`migrated` counts lessons newly added to the account (lessons it already had are skipped); `xp` is what they earned; `lessonIds` lists them. The guest rows are cleared afterwards, so start a fresh visitor id for the next guest session.

Errors: 400 `validation` (missing `visitorId`), 429 `rate_limited` (`Too many tries. Try again in a bit.`, 30 an hour), 500 `server` (`Couldn't move your guest progress. Try again in a moment.`), 401.

`POST /api/guest-progress` (no auth) answers `{ "saved": true }`, or `{ "saved": false }` for `complete: false`. Its errors use the same `{ error, code }` shape: 400 `validation` (`Something went wrong. Try again.`), 404 `not_found` (`We couldn't find that lesson.`), 422 `validation` (`Answer every quiz question correctly to complete this lesson.`), 429 `rate_limited` (`Too many attempts. Wait a minute and try again.`, 120 an hour per network, `Retry-After` 3600), 500 `server` (`Couldn't save that. Try again.`). Keep a completion queued on 429 and 5xx; drop it on 400, 404 and 422.

### DELETE /api/app/account

Bearer. Permanently deletes the caller's account and all their data: completions, bookmarks, badges, profile and the sign-in itself (`deleteAccountData`, the same function as the website's Settings "Delete account"). It can't be undone, so confirm first. Afterwards every session for the account is invalid; sign out locally.

An account that signed in with Apple has its Apple tokens revoked with Apple's REST endpoint (`readAppleRevocation` and `revokeAppleTokens` in `src/lib/app/apple-sign-in.ts`), as App Store rule 5.1.1(v) requires, using the refresh tokens kept at sign-in (the website's, and the app's from `appleAuthorizationCode`). The tokens are read before the account is deleted and revoked after the response, so Apple's speed never adds to this call. The app sends nothing extra for it. Apple trouble is logged and never stops the deletion.

Response 200:

```json
{ "ok": true }
```

Errors: 401, 500.

## Report and block (`/api/app/reports`, `/api/app/blocks`)

App Review guideline 1.2. What one member makes that another sees is a handle, an avatar, a bio and a team number (on public profiles, the leaderboards and the team sheet), the title and description of a live class its teacher wrote (the classes list, "Live classes" below), plus the notes and titles on suggested edits and lesson proposals (learnfrc.com/contributions, which the app has no screen for). Any signed-in account can report any of it and block anyone. Every rule is in `src/lib/app/reports.ts` and `src/lib/app/blocks.ts`, which the website's report form, Block button and Settings list call too.

**What a block does.** It hides the blocked account from the person who blocked it: their public profile, their rows on the leaderboards, their row on the team sheet, their suggestions on /contributions, and the live classes they teach. Classes go both ways: a class whose teacher blocked the caller is left off too, and neither can enroll in the other's class. Nothing is sent to them and nothing changes for anyone else. `GET /api/app/classes` leaves those classes off on the server for a signed-in caller. `GET /api/app/team` leaves blocked teammates off on the server. The leaderboards and `/api/app/u/{username}` are public routes cached at the CDN, the same for everyone, so the app hides the handles from `GET /api/app/blocks` itself (ranks stay as earned), as the website does for its reader.

**What a report does.** It stores a row in `user_reports` (service role only: a reporter never reads it back, and the person reported can never find out who filed it) and emails the owner (`ADMIN_EMAILS`, first entry) so it's answered within 24 hours. The desk that answers it is `GET /api/app/admin/reports` below and learnfrc.com/admin/reports.

### GET /api/app/reports

Public. `Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=18000`. The reasons a report can give, in the order the website's form lists them. The app keeps the same list built in for a sheet opened offline; the server checks whichever `id` is sent.

Response 200:

```json
{
  "reasons": [
    { "id": "harassment", "label": "Bullying or harassment" },
    { "id": "offensive", "label": "Offensive or inappropriate" },
    { "id": "personal_info", "label": "Sharing someone's personal information" },
    { "id": "impersonation", "label": "Pretending to be someone else" },
    { "id": "spam", "label": "Spam or cheating" },
    { "id": "other", "label": "Something else" }
  ],
  "detailsMax": 1000,
  "answerWithinHours": 24
}
```

### POST /api/app/reports

Bearer. Files a report (`fileReport`). Rate limited: 10 an hour per account.

Request, a profile (the leaderboards, the team sheet, a public profile):

```json
{ "username": "kai_cad", "contentKind": "profile", "reason": "offensive", "details": "The bio.", "surface": "leaderboard", "platform": "ios" }
```

Request, a live class from the classes list (its title and description, filed against its teacher; `username` is the row's `teacher.username`, so only a signed-in reader, who sees it, can send one):

```json
{ "username": "maya", "contentKind": "class", "contentId": "4f1d2c3b-8a9e-4b7c-9d6e-1a2b3c4d5e6f", "reason": "offensive", "surface": "classes_list", "platform": "ios" }
```

| Field | Type | Notes |
|---|---|---|
| `contentKind` | String? | `profile` (the default), `class`, `edit` or `submission`. The app sends `profile` and `class`. |
| `username` | String | The person reported. Required for `profile` and `class` (for a class, its teacher, or on the website someone from the class); ignored for an edit or a proposal, whose author is read from the row. |
| `contentId` | String? | For `class`, the class's id (`classes[].id` in `GET /api/app/classes`). For an edit or a proposal, its id (website only). Left out for a profile. |
| `reason` | String | A `reasons[].id`. A class report also takes the class-only reasons the website's class report panel lists first (`private_contact`, `sexual`, `unsafe`); the app offers the six from `GET /api/app/reports` for every report. |
| `details` | String? | Up to 1000 characters. Required (5 or more) when `reason` is `other`. |
| `surface` | String? | Where the reporter was: `profile`, `leaderboard`, `team`, `classes_list` (a row in the app's classes list). The website also sends `contributions` and `class` (a class page or room). Anything else is stored as null. |
| `platform` | String? | `ios`, `ipados` or `macos` (`AppConfig.platformID`). |

Response 201 (200 when it was already reported):

```json
{
  "reportId": "1c9a7f3e-2b44-4d0e-8f6a-0f3f0c2a9b11",
  "alreadyReported": false,
  "message": "Thanks. Your report went to the LearnFRC team, and every report is read within 24 hours. @kai_cad isn't told who sent it."
}
```

Show `message` as sent. A second report from the same account about the same thing, while the first is still open, is the same report: `alreadyReported` is true, `message` says so, and no second email goes out.

A class report is handled by the class rules in `src/lib/app/reports.ts` (design section 10.2): anyone signed in can report a class's teacher, and the report goes to both the owner and LearnFRC's safety lead, with the class kept for review. It's answered on the same desk, as kind `class` ("Live class").

Errors (the site's sentences):

| Status | `code` | `error` |
|---|---|---|
| 400 | `validation` | `Pick a reason.` (`field: "reason"`) |
| 400 | `validation` | `Tell us a little about what's wrong.` (`field: "details"`, reason `other`) |
| 400 | `validation` | `Keep it under 1000 characters.` (`field: "details"`) |
| 400 | `validation` | `You can't report yourself.` |
| 400 | `validation` | `That request wasn't in the format we expected.` |
| 404 | `not_found` | `There's no learner with that username.` / `That suggestion no longer exists.` |
| 429 | `rate_limited` | `That's a lot of reports in an hour. Try again in a bit, or write to us from the contact page.` (`Retry-After: 3600`) |
| 500 | `server` | `Couldn't send that report. Try again.` |

### GET /api/app/blocks

Bearer. Everyone the caller has blocked, newest first, by their handle now (`listBlocks`; the website's Settings card lists the same).

Response 200:

```json
{
  "blocks": [
    { "username": "kai_cad", "avatarUrl": null, "blockedAt": "2026-11-08T18:02:11.123Z" }
  ]
}
```

`username` is the account's handle now (it can change after the block); a row whose account has no handle comes back with `username: null` and can't be unblocked by name. At most 500.

Errors: 401, 500 `server` (`Couldn't load the accounts you've blocked. Try again.`).

### POST /api/app/blocks

Bearer. Blocks an account by handle (`blockUser`). Blocking someone already blocked answers 200 with the existing row. Rate limited: 60 an hour per account. A new block also emails the owner (`ADMIN_EMAILS`, first entry, at most 5 a day per blocking account) so the blocked account can be checked, as App Review asks; the blocked account is never told.

Request: `{ "username": "kai_cad" }`

Response 200: `{ "block": { "username": "kai_cad", "avatarUrl": null, "blockedAt": "2026-11-08T18:02:11.123Z" } }`

Errors: 400 `validation` (`Pick someone to block.`, `You can't block yourself.`, `You've blocked as many accounts as you can. Unblock someone in Settings first.`), 404 `not_found` (`There's no learner with that username.`), 429 `rate_limited` (`That's a lot of blocks in an hour. Try again in a bit.`), 500 `server` (`Couldn't save that. Try again.`), 401.

### DELETE /api/app/blocks/{username}

Bearer. Undoes a block (`unblockUser`). Idempotent: unblocking someone who isn't blocked answers 200 too.

Response 200: `{ "ok": true, "username": "kai_cad" }`

Errors: 404 `not_found` (`There's no learner with that username.`), 500 `server`, 401.

## Live classes (`/api/app/classes`)

Live classes are taught on learnfrc.com by FRC students aged 13 to 17, in LearnFRC's own video rooms (Cloudflare RealtimeKit). The app lists them and opens each one in Safari. There's no video in the app, and it never asks for the camera or the microphone: signing up, the one-time age question, a parent's OK, the recording notice and the room all happen on the website, in the person's own browser session. The rules are in `src/lib/app/classes.ts` (`listUpcomingClasses`, `classEligibility`, `enrollInClass`), which learnfrc.com/classes uses too.

Nothing about classes shows until the site opens them (both `CLASSES_VISIBLE` and `class_settings.classes_visible` on). Until then this route answers `{ "visible": false, "classes": [] }` and the app shows no Home card, no list rows and no "Teach a live class".

### GET /api/app/classes

Bearer optional, like `/api/app/start-plan`. The live and upcoming classes, soonest first: this deployment's classes only, `scheduled` or `live`, each listed until 15 minutes after its scheduled end (the hard end), at most 60. Past and canceled classes aren't listed. The same listing learnfrc.com/classes renders (`listUpcomingClasses`).

- No `Authorization` header: `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` and `Vary: Authorization`. The same for everyone: `teacher` and `enrolled` are null on every row, because signed-out visitors never see a handle. Print `teacherLabel` instead.
- A valid token: `Cache-Control: no-store`. `teacher` carries the teacher's username, `enrolled` says whether the caller has a seat, and classes taught by anyone the caller blocked, or who blocked the caller, are left off (`blockedEitherWay` in `src/lib/app/classes.ts`).
- A token that's sent but no longer valid gets a 401 (refresh and retry once), never the signed-out list.

Response 200 (signed in):

```json
{
  "visible": true,
  "classes": [
    {
      "id": "4f1d2c3b-8a9e-4b7c-9d6e-1a2b3c4d5e6f",
      "title": "Wiring a CAN bus",
      "description": "We'll wire a CAN chain on a practice board and find the usual faults.",
      "startsAt": "2026-11-20T01:00:00.000Z",
      "endsAt": "2026-11-20T02:00:00.000Z",
      "durationMinutes": 60,
      "status": "scheduled",
      "teacher": { "username": "maya" },
      "teacherLabel": "Taught by an FRC student",
      "topic": { "kind": "lesson", "id": "0b7f9a52-3c1e-4d8a-b2f6-7e5d4c3b2a19", "title": "CAN Bus Wiring", "url": "https://learnfrc.com/guides/electrical-wiring/can-and-communication/can-bus-wiring" },
      "seats": { "capacity": 15, "taken": 6, "left": 9 },
      "url": "https://learnfrc.com/classes/4f1d2c3b-8a9e-4b7c-9d6e-1a2b3c4d5e6f",
      "enrolled": false
    }
  ],
  "liveNow": 0,
  "teachUrl": "https://learnfrc.com/apply/teach",
  "version": "1"
}
```

Signed out, the same row has `"teacher": null` and `"enrolled": null`. While classes are hidden the whole reply is `{ "visible": false, "classes": [] }`, with no other keys.

| Field | Type | Notes |
|---|---|---|
| `visible` | Bool | False until classes open on the site, and whenever they're switched off. Show nothing about classes while it's false. |
| `classes` | [LiveClass] | Soonest first. Empty when nothing is scheduled: the site's empty state is "The first classes are being scheduled. Want to teach one?" |
| `liveNow` | Int | How many rows have `status: "live"`. |
| `teachUrl` | String | `https://learnfrc.com/apply/teach`, where teachers apply. |
| `version` | String | `1`. Changes only if a field changes meaning; fields are added, never renamed or removed. |

LiveClass:

| Field | Type | Notes |
|---|---|---|
| `id` | String | The class's UUID. `contentId` when reporting it. |
| `title` | String | 4 to 80 characters, written by the teacher (checked for profanity and contact details when it was scheduled). Member content: report it. |
| `description` | String? | Up to 600 characters, written by the teacher. Null when there's none. |
| `startsAt` | String | Timestamp. Show it in the device's time zone. |
| `endsAt` | String | The scheduled end, `startsAt` plus `durationMinutes`. The room closes 15 minutes later (the hard end), and the class stays listed until then. |
| `durationMinutes` | Int | 15 to 90. |
| `status` | String | `scheduled`, or `live` once the room has started. Decode anything else as `scheduled`. |
| `teacher` | { `username` }? | The teacher's username, signed in only. Null signed out. Never a real name, an avatar or a team number. |
| `teacherLabel` | String | `Taught by an FRC student`, printed where there's no `teacher`. |
| `topic` | { `kind`, `id`, `title`, `url` }? | The LearnFRC lesson (`kind: "lesson"`) or module (`"module"`) the class is on, with its page on the site. Its `title` is LearnFRC's, not the teacher's. Null when the class has neither. |
| `seats` | { `capacity`, `taken`, `left` } (all Int) | `capacity` is 2 to 15; `taken` counts enrolled students; `left` never goes below 0. |
| `url` | String | The class page, `https://learnfrc.com/classes/{id}`. Open it in Safari, not an in-app browser: enrolling and joining need the person's signed-in browser session. |
| `enrolled` | Bool? | Whether the caller has a seat. Null signed out. |

No row ever carries a team number, a student list or anything about who else is enrolled.

Report and block on a row use the routes above: `POST /api/app/reports` with `contentKind: "class"`, the class's `id` in `contentId`, the teacher's username and `surface: "classes_list"`; and `POST /api/app/blocks` with the teacher's username, after which the next read leaves their classes off. A guest is offered "Sign in to report or block", as elsewhere.

In a Debug build pointed at `next dev` (`-LFAPIBase`), `url`, `teachUrl` and `topic.url` name that server (`NEXT_PUBLIC_SITE_URL`). The app opens only learnfrc.com links and that host; anything else falls back to `https://learnfrc.com/classes/{id}`.

Errors: 401 (a token was sent and it's no longer valid), 500 `server`.

## Admin and applying (`/api/app/admin/*`, `/api/app/apply`)

The website's three admin jobs (the numbers on `/admin`, the feedback inbox, and the super admin's desk on `/admin/team`), the reports desk on `/admin/reports` (report and block, above), and the closed `/api/app/apply`. The verified mark on lessons is gone; its route is retired (below). Every route is a thin wrapper over a shared function in `src/lib/app/admin-*.ts`, and the website's `/admin` and `/admin/team` pages and their Server Actions call the very same functions, so the two doors check the same role, apply the same limits and print the same sentences.

**Applying here is closed** (since 2026-11-09). The only role LearnFRC takes applications for is teaching a live class, on the website (learnfrc.com/apply/teach); `/apply` redirects there while classes are open and says there's nothing to apply for while they're hidden. The marketing role `/apply` used to take was removed before release (it may come back). `/api/app/apply` and the team desk keep every key for app copies already installed, with empty or closed values (below). The `marketers` and `admin_applications` tables stay; nothing grants a tag any more, and an application left from before can only be turned down. Nobody joins the admin team through an application; super admins change roles on the desk.

**Roles.** Checked on the server on every call from the token's own user (`requireSiteRole` in `src/lib/app/admin-access.ts` over `getSiteRole`). Nothing from the request body, a header or the app's cached `siteRole` is trusted. Signed out gets 401 `unauthorized`; signed in without the role gets 403 `forbidden` with the site's sentence for that surface:

| Routes | Needs | 403 `error` |
|---|---|---|
| summary, dashboard, feedback list | admin | `/admin holds the raw numbers for the whole site, so it is open to administrators only. Nothing is wrong with your account.` (the locked card's heading on the site is "This drawer is locked.") |
| feedback reply | admin | `Not authorized.` |
| team desk, decision, role change, removal | superadmin | `Only a super admin can do that. Try reloading the page and signing in again.` (the site's locked card: "This one stays with the super admins.") |
| reports desk, resolve, remove | admin | The `/admin` sentence above (the site's /admin/reports locked card is "This drawer is locked.") |
| report ban | superadmin | `Only a super admin can do that. Try reloading the page and signing in again.` |

**Privacy.** No email addresses, real names or sender user ids appear in any of these payloads. Applicants and team members are a handle and a team number; team members' `userId` goes only to super admins, because the role controls need it. Keep admin payloads in memory only (never the cache, the widget app group, Spotlight or App Intents) and drop them on sign-out.

**Bodies the server can't read.** A body that isn't a JSON object answers 400 `validation` (`That request wasn't in the format we expected.`) before the role check. A field of the wrong type answers the same sentence after it.

**Cost.** The dashboard pages every profile, every completion and every auth user, plus Vercel queries (cached 300 s). Refresh it every `refreshSeconds` (30) only while the screen is visible and the scene is active, like the site; use `/summary` for badges.

### MiniRow

One line of a tally inside a drawer: a name, a figure and, where comparing is the point, a gauge.

```json
{ "label": "#254", "sub": "22 members", "value": 1925, "valueSuffix": null, "pct": 100 }
```

| Field | Type | Notes |
|---|---|---|
| `label` | String | Main text. |
| `sub` | String? | The quiet mono text after the label. |
| `value` | Int | The figure, right aligned. Format with grouping (`1,925`). |
| `valueSuffix` | String? | Printed hard against the figure. |
| `pct` | Double? | 0 to 100, the gauge under the row. Null means no gauge (the "Before tracking" referral row). Never the only way to read the number. |

### GET /api/app/admin/summary

Bearer, admin. The cheap counts for the You tab rows and badges, without the expensive site-wide figures (`loadAdminSummary`).

Response 200:

```json
{
  "role": "superadmin",
  "openFeedback": 1,
  "feedbackTotal": 8,
  "pendingApplications": 0,
  "pendingEdits": 0,
  "pendingSubmissions": 0,
  "openReports": 1
}
```

| Field | Type | Notes |
|---|---|---|
| `role` | String | `admin` or `superadmin`, as the server sees it right now. |
| `openFeedback`, `feedbackTotal` | Int | Exact counts over the whole `feedback` table. `openFeedback` counts only messages that can still be answered: not replied and with a reply address (anonymous messages never count as open). |
| `pendingApplications` | Int? | Null unless the caller is a super admin (only they can answer applications; the query isn't even run otherwise). |
| `pendingEdits`, `pendingSubmissions` | Int | Exact counts of suggested edits and lesson submissions waiting for the moderator. There's no human review queue on the site; these are counts only. |
| `openReports` | Int | Member reports waiting on a person (`GET /api/app/admin/reports`), each to be answered within 24 hours. 0 when the reports table can't be read. Added for report and block; decode it as optional. |
| `pendingClassReviews` | Int? | Added with live classes (2026-11); decode it as optional. Ended classes waiting for a decision on learnfrc.com/admin/classes. Null unless the caller is a super admin, and null while classes are hidden and nothing waits, so a release without classes shows no trace. The dashboard's `now` object carries the same field. |

Errors: 401, 403.

### GET /api/app/admin/dashboard

Bearer, admin. Everything `/admin` prints, as the view-model the website's `/admin` page renders from (`loadAdminDashboard`). Every sentence (stamp labels, hints, notes, footnotes, the funnel note and badge) is built on the server; show them as sent. Only relative times ("3h") and layout are left to the client.

Response 200 (arrays trimmed):

```json
{
  "role": "superadmin",
  "generatedAt": "2026-10-17T03:38:53.645Z",
  "refreshSeconds": 30,
  "now": { "onlineNow": 7, "openFeedback": 1, "feedbackTotal": 8, "pendingApplications": 0, "pendingEdits": 0, "pendingSubmissions": 0, "openReports": 1 },
  "stamps": [
    { "key": "visitors", "value": 16809, "label": "unique visitors" },
    { "key": "pageViews", "value": 76717, "label": "page views, 4,689 of them on articles" },
    { "key": "learners", "value": 898, "label": "learners: 743 accounts (including unverified) + 155 guest learners" },
    { "key": "completions", "value": 10200, "label": "lessons completed, 628 by guests" }
  ],
  "notes": {
    "traffic": null,
    "coverage": "Page views and unique visitors are Vercel's, and Vercel keeps a rolling 366 days, so both of those cover Oct 17, 2025 onward rather than the whole history. Every figure read out of the database does go back to the first signup."
  },
  "tally": [
    { "slug": "tally / reach", "rows": [
      { "label": "FRC teams represented", "value": 235, "suffix": null, "hint": "distinct team numbers on profiles, placeholders excluded" }
    ] },
    { "slug": "tally / learning", "rows": [
      { "label": "Activation", "value": 58, "suffix": "%", "hint": "430 of 743 accounts finished a lesson" }
    ] },
    { "slug": "tally / the binder", "rows": [ { "...": "..." } ] }
  ],
  "growth": {
    "daily": [ { "day": "2026-09-18", "signups": 14, "completions": 42, "views": 639, "visitors": 149 } ],
    "totals": { "visitors": 4210, "signups": 160, "completions": 2380 },
    "footnote": null
  },
  "funnel": {
    "rows": [ { "label": "Opened a lesson", "sub": "69% of signups", "value": 511, "valueSuffix": null, "pct": 69 } ],
    "badge": "-31% Opened a lesson",
    "note": "Every step measured directly, 1,204 events recorded.",
    "anonymousRows": [],
    "anonymousNote": "Counted by device, not by person, and never joined to an account. A reader who signs up starts a fresh row above.",
    "empty": "Funnel unavailable. Check the server logs for [funnel]."
  },
  "sources": {
    "users": { "week": [ { "name": "Google", "count": 12 } ], "allTime": [ { "name": "Direct", "count": 195 } ] },
    "visitors": { "week": [ { "name": "Google", "count": 900 } ], "allTime": [ { "name": "Google", "count": 7000 } ], "weekTotal": 1800, "allTimeTotal": 16809 },
    "footnote": "“All-time” means two different spans here. On the Users view it is every signup ever, out of the database. On the Visitors view it is only as far back as Vercel still keeps, which is a rolling 366 days, starting Oct 17, 2025. Differencing the two would invent a gap that is really just the older half of the site’s history."
  },
  "engagement": { "lessons": [ "MiniRow" ], "departments": [ "MiniRow" ] },
  "teams": { "teams": [ "MiniRow" ], "recruiters": [ "MiniRow" ], "surfaces": [ "MiniRow" ], "surfacesFootnote": null },
  "articles": [ "MiniRow" ],
  "achievements": [ "MiniRow" ],
  "activity": {
    "newestMembers": [ { "username": "maya_254", "teamNumber": 254, "createdAt": "2026-10-17T03:01:49.198Z" } ],
    "recentCompletions": [ { "user": "@maya_254", "lesson": "What Is FIRST?", "at": "2026-10-17T02:40:00.000Z" } ]
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `role` | String | `admin` or `superadmin`. Super admins also get the "team / manage admins" link and the applications row. |
| `refreshSeconds` | Int | Always 30. The site re-reads this often while the tab is visible, and on refocus ("re-read every 30s"). |
| `now` | object | The "what wants a person today" card, same fields as `/summary` plus `onlineNow` (active in the last few minutes). Card rows, in order: `onlineNow` "people on the site right now" / "active in the last few minutes"; `openFeedback` "messages waiting for a reply" / "{feedbackTotal} received in total"; super admins only, when `pendingApplications` isn't null: "application waiting on you" (1) or "applications waiting on you" / "only a super admin can answer these", which links to the team desk; `openReports` "report waiting on a person" (1) or "reports waiting on a person" / "answer each within 24 hours", which links to the reports desk (learnfrc.com/admin/reports); `pendingEdits` "content edits to review"; `pendingSubmissions` "lesson submissions to review". Pen note: "this card first, the rest after". |
| `stamps` | [{ `key`, `value`, `label` }] | The four big figures on the blue slab "How far it has got.", in order. `key` is `visitors`, `pageViews`, `learners` or `completions`. |
| `notes.traffic` | { `slug`, `text` }? | Present when the traffic figures are unmeasured or come from the banked ledger. Print the slug in mono over the text. |
| `notes.coverage` | String? | The "what those four numbers cover" note. |
| `tally` | [{ `slug`, `rows` }] | Always three columns ("tally / reach", "tally / learning", "tally / the binder") under "Everything else, ruled off.", 11 rows in all. Row: `label`, `value` (Int), `suffix` (String?, `%`), `hint` (String?). |
| `growth.daily` | [object] | 30 UTC days, oldest first. `signups` and `completions` come from the database, `views` and `visitors` from Vercel. Never sum `visitors` across days. |
| `growth.totals` | object | True 30-day window totals for the legend. |
| `growth.footnote` | String? | |
| `funnel` | object | `rows` (each step's share of the first step as `pct`), `badge` (the worst drop, for the drawer header, or null), `note` (which rows are a floor), `anonymousRows` (shown with `anonymousNote` only when not empty), `empty` (show when `rows` is empty). |
| `sources` | object | Users from the database, visitors from Vercel's referrers. `weekTotal` and `allTimeTotal` are measured headcounts for the visitor donut; never sum the slices. `footnote` always shows. |
| `engagement`, `teams`, `articles`, `achievements` | MiniRow lists | Top 8 lessons and departments, 8 teams, 8 recruiters, the referral surfaces, 10 articles, 12 achievements. `surfacesFootnote` shows under the surfaces when present. |
| `activity` | object | 8 newest members (`username` null prints "New member"; team number as "#254") and 8 latest completions (`user` is a handle or "a member"). Times are ISO timestamps; print them relative ("5m", "3h", "2d"). |

The site's drawer titles, slugs and empty lines, for matching: "Growth" (`drawer / growth`, badge "last 30 days"); "Activation funnel" (`drawer / funnel`), anonymous block slug "before signup / anonymous readers"; "Where they come from" (`drawer / sources`); "What gets read" (`drawer / engagement`): "most-completed lessons" and "top departments", empty "No completions yet."; "Teams and referrals" (`drawer / teams`): "top teams" (empty "No teams yet."), "top recruiters" (empty "No referrals yet."), "referral signups / by surface" (empty "No referrals yet."); "Top articles" (`drawer / articles`, empty "No article views yet."); "Achievements" (`drawer / achievements`, empty "No achievements earned yet."); "Recent activity" (`drawer / activity`): "newest members" (empty "No signups yet."), "recent completions" (empty "No completions yet."); "Feedback" (`drawer / feedback`, badge "{n} open").

Errors: 401, 403.

### GET /api/app/admin/feedback?limit=40

Bearer, admin. The feedback inbox, newest first (`listFeedback`, the reads behind `/admin`'s Feedback drawer). `limit` is 1 to 100; anything else falls back to 40.

Response 200:

```json
{
  "items": [
    {
      "id": "073e37fc-6ce4-4f64-8473-b0a3c923c242",
      "message": "The swerve lesson's second diagram is upside down.",
      "page": "/guides/mechanical/drivetrains/swerve",
      "hasReplyAddress": true,
      "status": "open",
      "replyBody": null,
      "repliedAt": null,
      "createdAt": "2026-10-17T02:58:00.250Z"
    }
  ],
  "openCount": 1,
  "total": 8
}
```

| Field | Type | Notes |
|---|---|---|
| `hasReplyAddress` | Bool | Whether a reply can be sent. The address itself never leaves the server. Stamp: "from / can be answered", or "from / anonymous, no reply possible". |
| `status` | String | `open` or `replied`. Show "replied" in the stamp, and `replyBody` under "what you sent back". |
| `page` | String? | Stamp "page / {page}". |
| `openCount`, `total` | Int | Exact, over the whole table, not just the returned items. `openCount` counts only items that can still be answered (`status` not `replied` and `hasReplyAddress`). |

Show Reply only when `status` is `open` and `hasReplyAddress` is true. The site's copy: "Reply" / "Cancel"; label "Reply to the sender"; hint "It goes straight to their inbox from LearnFRC. There's no thread on the site, so this row is the whole conversation."; "Send reply" / "Sending"; success "Reply sent"; empty inbox "Nothing in the box. Feedback lands here the moment someone sends it."

Errors: 401, 403.

### POST /api/app/admin/feedback/{id}/reply

Bearer, admin. Emails the sender from LearnFRC and marks the message replied (`replyToFeedbackAs`, the function `/admin`'s Reply form calls). The row is claimed before the email goes, so a double tap or a second admin gets 409 instead of a second email; if the email fails the row goes back to open.

Request:

```json
{ "reply": "Thanks, fixed. It was flipped in the source image." }
```

Response 200, with the updated item (replace the row with it):

```json
{ "ok": true, "item": { "id": "073e37fc-6ce4-4f64-8473-b0a3c923c242", "status": "replied", "replyBody": "Thanks, fixed. It was flipped in the source image.", "repliedAt": "2026-10-17T03:39:50.364Z", "...": "the rest of the FeedbackItem" } }
```

Errors:

| Status | `code` | `error` |
|---|---|---|
| 400 | `validation` | `Write a reply first.` (under 2 characters) |
| 400 | `validation` | `That reply is too long.` (over 4000) |
| 400 | `validation` | `No reply address was left on this message.` |
| 403 | `forbidden` | `Not authorized.` |
| 404 | `not_found` | `That message no longer exists.` |
| 409 | `conflict` | `That one has already been answered.` |
| 429 | `rate_limited` | `That's a lot of replies in an hour. Give it a little while, then try again.` (30 an hour per admin, `Retry-After` 3600) |
| 500 | `server` | `Couldn't send the reply. Try again.` |
| 401 | | |

### PUT /api/app/admin/lessons/{lessonId}/verified (retired)

Retired. Lessons no longer carry a verified mark, on the site or in the app, and nobody can put one on. The current app never calls this route and has no verify control.

The route stays for app copies built before the change, which still show "Mark this lesson verified" to admins at the foot of a lesson. Whatever they send, with or without a token, the answer is always:

Response 410:

```json
{ "error": "Lessons don't carry a verified mark any more.", "code": "not_found" }
```

Those copies read `not_found` with a sentence as a plain failure and print it after "Could not save: ". Nothing is written. Before the change the route answered `{ ok, lessonId, verifiedAt }` and wrote `lessons.verified_at` and `verified_by`; those columns stay in the table (see "What the app reads directly from Supabase").

### GET /api/app/admin/team

Bearer, superadmin. The super admin's desk, the same data `/admin/team` renders from (`loadAdminTeamDesk`): the admin team, and any application left from before applying closed (reject only). Teacher applications aren't here; they're decided on the website's teacher desk.

Response 200:

```json
{
  "grants": [
    { "label": "Nothing", "hint": "applying here is closed, so an old application can only be turned down" }
  ],
  "pending": [
    {
      "id": "9a139629-1c93-4c17-b2c6-92e238a102e6",
      "username": "maya_5835",
      "teamNumber": 5835,
      "teamRole": "student",
      "teamRoleLabel": "student",
      "experience": "Two seasons on mechanical, ...",
      "why": "I answer this stuff on Chief Delphi already, ...",
      "availability": "weekends",
      "createdAt": "2026-10-17T02:57:59.971Z"
    }
  ],
  "pendingTruncated": false,
  "marketers": [],
  "team": [
    {
      "userId": "57c4f3f0-cc40-47d3-a602-bf9b78805207",
      "username": "sam_5835",
      "teamNumber": 5835,
      "role": "admin",
      "roleWord": "admin",
      "grantedAt": "2026-10-17T02:57:59.693Z",
      "note": "accepted application",
      "isOwner": false,
      "isYou": false,
      "canChange": true
    }
  ],
  "decided": [
    {
      "id": "2bfee6dd-8460-4186-b56a-848f7950168f",
      "username": "alex_971",
      "status": "rejected",
      "statusWord": "turned down",
      "reviewedAt": "2026-10-12T01:28:16.733Z",
      "createdAt": "2026-10-05T21:16:06.067Z",
      "reviewNote": null
    }
  ],
  "decidedTruncated": false
}
```

| Field | Type | Notes |
|---|---|---|
| `grants` | [{ `label`, `hint` }] | Always the one "Nothing" line above, since applying is closed (`CLOSED_GRANTS` in `src/lib/applications.ts`). App copies already installed print it as their "what accepting hands over" card; the current app and the site don't show it. |
| `pending` | [object] | Applications left from before applying closed, newest first, up to 60. They can only be turned down. The site shows the "Old applications" / "drawer / old applications" drawer only while one is waiting, with the hint "Applying here is closed. Turn these down with a short note." `username` null prints "no username yet"; team as "team / {n}" or "team / not given"; "role / {teamRoleLabel}"; "came in 3d ago"; "availability / {availability}" when present; answers under "what they’ve done in FRC" and "why they want to help". |
| `pendingTruncated` | Bool | A full page (60). The site says: "60 shown, which is the page size. If there are more, they come up once you clear these." |
| `marketers` | [] | Always empty. The marketing role was removed before release; the key stays so nothing reading the desk breaks. |
| `team` | [object] | The admin team ("The admin team" / "drawer / the admin team" on the site). Owners first, then by `grantedAt`. `roleWord` is `owner`, `super admin` or `admin`; tag "you" when `isYou`; "since {Mon D, YYYY}" from `grantedAt` (UTC); "note / {note}". Show the role picker and Remove only when `canChange` (never for owners or your own row). |
| `decided` | [object] | The 30 most recently decided, by `reviewedAt`. Date is `reviewedAt` or else `createdAt`. `statusWord` is `accepted`, `turned down` or `withdrawn`. |
| `decidedTruncated` | Bool | A full page (30): "The 30 most recent. Older ones are still on file, they’re just not printed here." |

Errors: 401, 403 `forbidden` (`Only a super admin can do that. Try reloading the page and signing in again.`).

### POST /api/app/admin/applications/{id}/decision

Bearer, superadmin. Turns down an application left from before applying closed (`decideApplication`, the function behind `/admin/team`'s Reject). Accepting answers 409: the role it was for is gone. The status change is the gate: of two decisions on one application exactly one wins and the other gets 409. The applicant gets an email ("About your LearnFRC application"), with the note in it.

Request:

```json
{ "decision": "reject", "note": "Thanks for offering. Applications for that role are closed." }
```

`decision` is still `accept` or `reject`; only `reject` can succeed. `note` is optional, up to 1000 characters. The site's label: "Note to them, optional; it goes in the email", hint "Leave it blank and the email still goes." Reject is a two-step armed button ("Reject", then "Yes, reject" for 5 seconds, with "One more click turns down @x. You can't take it back here.").

Response 200:

```json
{ "ok": true, "status": "rejected" }
```

Success toast on the site: "Turned down. They'll get an email."

Errors:

| Status | `code` | `error` |
|---|---|---|
| 400 | `validation` | `Pick accept or reject.` |
| 400 | `validation` | `Keep the note under 1000 characters.` with `"field": "note"` |
| 403 | `forbidden` | `Only a super admin can do that. Try reloading the page and signing in again.` |
| 404 | `not_found` | `That application no longer exists.` (also for an id that isn't a UUID) |
| 409 | `conflict` | `This role is closed, so old applications can only be turned down.` (any `accept`) |
| 409 | `conflict` | `That one has already been decided.` |
| 500 | `server` | `Couldn't record the decision. Please try again.` |
| 401 | | |

### PATCH /api/app/admin/team/{userId}

Bearer, superadmin. Changes someone's role (`setAdminRoleFor`, behind "Save role"). Updates the existing row so their "since" date is kept; adds a row only when there is none.

Request:

```json
{ "role": "superadmin" }
```

`role` is `admin` or `superadmin`. The site's picker reads "admin" / "super admin", button "Save role" (disabled until changed) / "Saving", toast "Role saved."

Response 200: `{ "ok": true }`

Errors:

| Status | `code` | `error` |
|---|---|---|
| 400 | `validation` | `Pick a role.` |
| 400 | `validation` | `You can't change your own role from here. Another super admin has to do it.` |
| 400 | `validation` | `That account is a site owner and can't be changed here.` |
| 400 | `validation` | `That request wasn't in the format we expected.` (the id isn't a UUID) |
| 403 | `forbidden` | `Only a super admin can do that. Try reloading the page and signing in again.` |
| 500 | `server` | `Couldn't change the role. Please try again.` |
| 401 | | |

### DELETE /api/app/admin/team/{userId}

Bearer, superadmin. Takes someone off the team, through the same `setAdminRoleFor`. They keep their account and progress; `/admin` shuts to them. The site arms it first ("Remove", then "Yes, remove" with "One more click takes @x off the team. They keep their account and their progress, they just lose /admin."), toast "Off the team. /admin is shut to them now."

Response 200: `{ "ok": true }`

Errors: the same own-row, owner and format refusals as PATCH, 403, 500 `server` (`Couldn't remove them. Please try again.`), 401.

### DELETE /api/app/admin/marketers/{userId} (retired)

Retired before release, never shipped: the route is gone (404) along with the marketing role.

### GET /api/app/admin/reports

Bearer, admin. The reports desk, the data learnfrc.com/admin/reports renders from (`loadReportsDesk`, `src/lib/app/admin-reports.ts`). The app has no screen for it yet; the routes are here so it can have one.

Response 200 (one of each):

```json
{
  "role": "superadmin",
  "canBan": true,
  "answerWithinHours": 24,
  "openCount": 1,
  "open": [
    {
      "id": "1c9a7f3e-2b44-4d0e-8f6a-0f3f0c2a9b11",
      "status": "open",
      "statusWord": "open",
      "reason": "offensive",
      "reasonLabel": "Offensive or inappropriate",
      "contentKind": "profile",
      "contentKindLabel": "Profile",
      "contentId": null,
      "reportedUsername": "kai_cad",
      "currentUsername": "kai_cad",
      "accountExists": true,
      "reporterUsername": "maya_254",
      "snapshot": { "username": "kai_cad", "avatarUrl": null, "bio": "…", "teamNumber": 254, "title": null, "note": null, "target": null, "newModuleTitle": null },
      "details": "The bio.",
      "detailsWithheld": false,
      "surface": "leaderboard",
      "platform": "ios",
      "createdAt": "2026-11-08T18:02:11.123Z",
      "answerBy": "2026-11-09T18:02:11.123Z",
      "resolvedAt": null,
      "resolutionNote": null,
      "openAboutAccount": 1
    }
  ],
  "closed": [ { "...": "the same shape, status resolved, removed or banned" } ]
}
```

| Field | Type | Notes |
|---|---|---|
| `canBan` | Bool | Ban is a super admin's call. |
| `open` | [DeskReport] | Oldest first, at most 100: the one closest to its 24 hours is on top. |
| `closed` | [DeskReport] | The last 20 answered, newest first. |
| `status`, `statusWord` | String | `open`; `resolved` ("closed, nothing removed"); `removed` ("content removed"); `banned` ("account banned"). |
| `reportedUsername` / `currentUsername` | String? | The handle when reported, and now (null once the account is gone). |
| `reporterUsername` | String? | Shown only on this desk. |
| `snapshot` | object | The public fields as they stood when it was reported: `username`, `avatarUrl`, `bio`, `teamNumber` for a profile; `target` (the lesson or article), `note`, `title`, `newModuleTitle` for an edit or proposal. For a live-class report (`contentKind` `class`, `contentKindLabel` "Live class"), `target` is one readable line about the class and the reported person's place in it, and these were added with live classes (2026-11; null on every other kind, so decode them as optional): `classId`, `classTitle`, `classStartsAt` (String?), `classRole` (`teacher`, `student` or `staff`), `liveNow` (Bool?, the class was on when it was reported). Remove on a class report is the class action (the student leaves the class for good; a teacher's teaching is suspended and the class ended) and needs a super admin or the safety lead. |
| `details` | String? | What the reporter wrote. Null on a live-class report with reason `sexual`: that goes to the safety lead only (added 2026-11). |
| `detailsWithheld` | Bool | True when the reporter wrote something that `details` leaves out for that reason (added 2026-11; decode as optional, default false). |
| `answerBy` | String | `createdAt` plus 24 hours. |
| `openAboutAccount` | Int | Open reports about the same account, this one included. |

Errors: 401, 403, 500.

### POST /api/app/admin/reports/{id}/resolve

Bearer, admin. Closes one report with nothing taken down (`resolveReport`). Request: `{ "note": "Looked fine." }` (optional, up to 1000 characters; a longer one answers 400 with `field: "note"`). Response 200: `{ "ok": true, "status": "resolved" }`. Logged to `moderation_log`.

Errors: 404 `not_found` (`That report no longer exists.`), 409 `conflict` (`That report has already been answered.`), 401, 403 (also `forbidden` with `That report is about someone on the admin team, so a super admin answers it.` when a plain admin answers a report about anyone on the admin team, themselves included), 500 `server` (`Couldn't check that account. Try again in a moment.`, when that account can't be looked up).

### POST /api/app/admin/reports/{id}/remove

Bearer, admin. Takes the reported content down and closes every open report about it (`removeReportedContent`). A profile loses its bio and picture, and with `replaceUsername: true` its handle too (a free `memberNNNNNN`, the old one kept in `name_moderation_log`); an edit loses its note, a proposal its title and note, and either is turned down if still pending. Request: `{ "note": "…", "replaceUsername": true }` (both optional). Response 200: `{ "ok": true, "status": "removed", "newUsername": "member482913" }` (`newUsername` null unless replaced).

Errors: 404, 409 `conflict` (`That report has already been answered.` or `That account is already gone. Close the report instead.`), 500 `server` (`Couldn't take that down. Try again.`), 401, 403 (also the admin-team sentence under resolve, by the same rule).

### POST /api/app/admin/reports/{id}/ban

Bearer, super admin. Bans the reported account with the site's existing ban (the email on `banned_emails` with its signup IP; the IP on `banned_ips` once a second banned account shares it), deletes it with `deleteAccountData`, and closes every open report about it (`banReportedAccount`). Can't be undone; confirm first. Request: `{ "note": "…" }` (optional). Response 200: `{ "ok": true, "status": "banned" }`.

Errors: 400 `validation` (`That account is on the admin team. Take it off the team on /admin/team first.`, `You can't ban your own account.`), 404, 409 `conflict`, 500 `server` (`Couldn't ban that account. Try again.` or `The email is banned, but the account couldn't be deleted. Try again.`), 401, 403.

### GET /api/app/apply

Bearer, any signed-in account. Closed: kept for app copies already installed, which read every key. The current app doesn't call it. From `loadApplyState` in `src/lib/app/admin-apply.ts`.

The teacher application form is web only (learnfrc.com/apply/teach). Its fields aren't part of any /api/app route.

Response 200:

```json
{
  "applicationsOpen": false,
  "mode": "new",
  "heading": { "title": "Apply", "slug": "three questions, nothing else" },
  "record": { "username": "maya_5835", "teamNumber": 5835, "teamRoleLabel": "student" },
  "application": null,
  "jobs": [],
  "limits": { "minChars": 40, "maxChars": 3000, "availabilityMax": 200 },
  "posting": "",
  "rules": [],
  "marketer": null,
  "roles": [
    {
      "id": "teacher",
      "title": "Teach a live class",
      "url": "https://learnfrc.com/apply/teach",
      "open": true,
      "status": "new"
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `applicationsOpen` | Bool | Always false (`APPLICATIONS_OPEN` in `src/lib/applications.ts`). Installed copies show "Applications are closed for now. Check back soon." in the form's place. |
| `mode` | String | `on-the-team` (admins), `pending` (an application from before is still waiting), `no-handle`, `again` (turned down or withdrawn before) or `new`. Never `marketer` now. |
| `heading` | { `title`, `slug` } | The heading and mono note installed copies print over that block. |
| `record` | object | Handle, team number, and the team role as a word (null when not set). |
| `application` | object? | The latest pending, turned-down or withdrawn application: `status` (`pending`, `rejected`, `withdrawn`), `createdAt`, `reviewedAt`, `reviewNote`. Null for admins and for accounts that never applied. |
| `jobs` | [] | Always empty. Installed copies then fall back to their own built-in list, which is what they showed before. |
| `limits` | object | Kept for installed copies; nothing takes the form any more. |
| `posting` | String | Always `""`. Kept for compatibility. |
| `rules` | [] | Always empty. Kept for compatibility. |
| `marketer` | null | Always null. Kept for compatibility. |
| `roles` | [{ `id`, `title`, `url`, `open`, `status` }] | Added with live classes (2026-11). Only the teacher role, `{ "id": "teacher", "title": "Teach a live class", "url": "https://learnfrc.com/apply/teach", "open": true, "status": ... }`, while live classes are visible; `[]` while they're hidden. `status` is one of `signed-out`, `no-handle`, `device-blocked`, `needs-age`, `adult`, `parent-declined`, `suspended`, `code-outdated`, `teacher`, `pending`, `again`, `new` (`TeachApplyMode` in `src/lib/classes/teacher-rules.ts`), from `teacherApplyRole` in `src/lib/app/class-teachers.ts`. The `marketing` role was retired before release and never shipped. The app doesn't read `roles`: its "Teach a live class" card follows `GET /api/app/classes` (`visible`, `teachUrl`). |

Errors: 401.

### POST /api/app/apply

Bearer. Always refused: applying here is closed (`submitApplication`). The request is still accepted in its old shape so installed copies get a clear answer.

Request:

```json
{ "experience": "Two seasons on mechanical ...", "why": "I answer this stuff on Chief Delphi already ...", "availability": "weekends" }
```

Errors:

| Status | `code` | `error` |
|---|---|---|
| 409 | `conflict` | `Applications are closed for now. Check back later.` |
| 409 | `conflict` | `You're already on the team.` (an admin) |
| 400 | `validation` | `That request wasn't in the format we expected.` (a body that isn't a JSON object) |
| 401 | | |

### DELETE /api/app/apply

Bearer. Withdraws the caller's pending application from before applying closed (`withdrawApplication`). Kept for installed copies, which confirm first: "Withdraw this application? It comes off the reviewer's desk straight away, and you can send a new one whenever you want." / "Yes, withdraw it" / "Leave it in".

Response 200: `{ "ok": true }`

Errors: 404 `not_found` (`There's no open application to withdraw.`), 500 `server` (`Couldn't withdraw it. Please try again.`), 401.

## What the app reads directly from Supabase

Not covered here, read with the publishable key: `departments`, `modules`, `lessons` (including `quiz`), `articles`, `achievements`; the signed-in user's own `bookmarks` (read, insert, delete under RLS).

`lessons.verified_at`, `verified_by`, `verified_note` and `verified_sources` are no longer shown anywhere and the current app doesn't select them. App copies built before the verified mark came off still put all four in their lesson-body select (`SupabaseQueries.lessonBodySelect`), and PostgREST fails the whole request if a named column is missing, so keep the columns in place and readable with the publishable key. Those copies show their old badge on any lesson where `verified_at` isn't null. The app never writes `lesson_progress` or `user_achievements` directly, and never reads `profiles`. Admin data (`site_admins`, `admin_applications`, `marketers`, `feedback`, the admin views) is RLS-locked to the service role, so it only ever comes through the routes above. So are `user_reports` (service role only) and `user_blocks` (an account may read its own rows under RLS, but the app uses the routes, which also resolve handles). Every live classes table is locked to the service role too (the one exception, `class_chat_messages`, is read by class members inside the website's room), so the app only sees classes through `GET /api/app/classes`.
