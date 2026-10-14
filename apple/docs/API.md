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
| `validation` | 400 | The input broke a rule. `error` is the site's own sentence; show it as sent. |
| `rate_limited` | 429 | Too many tries. The response has a `Retry-After` header in seconds. |
| `not_found` | 404 | No such lesson, learner or profile. |
| `conflict` | 409 | A username is taken, or the profile changed underneath the request. |
| `server` | 500 | Something failed on our side. Safe to retry later. |

`error` strings are the website's copy, unchanged, so the app and the site say the same thing.

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
  "referralCount": 2
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

Bearer. The caller's own team sheet, the same data as the website's /teams page (`loadTeamSheet`). The team is always the one on the caller's own profile. Teammates are shown by username and avatar only.

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

Response 200:

```json
{ "ok": true }
```

Errors: 401, 500.

## What the app reads directly from Supabase

Not covered here, read with the publishable key: `departments`, `modules`, `lessons` (including `quiz`), `articles`, `achievements`; the signed-in user's own `bookmarks` (read, insert, delete under RLS). The app never writes `lesson_progress` or `user_achievements` directly, and never reads `profiles`.
