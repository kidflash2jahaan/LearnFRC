# LearnFRC next steps, 2026-09-22

Update 2026-09-25: the Chief Delphi thread gained four posts on Sept 24 to 25. See `2026-09-25-chief-delphi-update.md`, which moves three items to the front of the 14-day list.

Source: `docs/analysis/2026-09-22-growth-review.md` and its JSON. Every number below is quoted from that file with its basis attached, because that report's own verification section shows five of its six disputed numbers broke when a deduped `visits/aggregate` row got divided into a day-summed `visits/count` total. Where a number comes from the codebase instead of the report, this file says so.

## 1. What the numbers say

Traffic is genuinely up and signups are genuinely down: 1,977 visitor-days over 2026-09-08 to 09-21 against 1,636 the fortnight before (+20.8%, or +16.3% excluding China at 1,689 against 1,452), while signups went 101 to 89 and visitor-to-signup went 6.17% to 4.50%, both `visits/count`. The thing that broke is activation, not acquisition: 48-hour activation fell from 52.5% (252 of 480 accounts created before 2026-09-06) to 36.7% (33 of 90 created 09-06 to 09-19), and that fall holds separately inside clusters (60.9% to 39.6%) and inside solo signups (48.5% to 33.3%), so it isn't a change in who's arriving. Learning on this site is a team phenomenon and nothing else: cluster members reach 10 or more lessons at 45.9% against 19.1% for solo signups, their median lessons-ever is 9 against 0, and team 7002 alone produced 421 of the last fortnight's 1,298 completions. Search is the only acquisition channel growing, and it's growing off a weak base: Google went 82 to 139 visitor-days across four weeks while Bing went 73 to 142, and Bing matching Google is the low-domain-authority signal flagged on 2026-09-08 that hasn't moved. Everything else has gone quiet: Chief Delphi is down to 14 visitor-days and 4 signups a fortnight from a launch-era 91 all time, `referred_by` is populated on 7 of the last 89 accounts, zero mentors signed up in the last fortnight against a standing base of 15 mentors and coaches, and chatgpt.com produced 17 visitors the fortnight before last against 7 in the last one, which is the first faint sign that LLMs are starting to cite the site.

## 2. Keep doing

Blog posts on the thing every team is about to search for. `/blog/frc-systemcore` pulled 87 search visitors on its own over the last 14 days, which is 29% of the 296 search visitors the entire 103-post blog pulled, and nearly half of what the whole 394-lesson library pulled (186). `/blog/[slug]` is 608 of 1,977 visitor-days, 30.8%, `visits/count` on both sides. The pattern that works is a new-hardware or new-season topic published before the search demand peaks, not another explainer on a settled topic.

Grouping people by team number with no invite code and no setup. This is the single mechanic with the strongest evidence in the report. Cluster members hit 10+ lessons at 45.9% against 19.1%, hit 5+ ever at 60.7% against 27.7%, and return 7 or more days after signup at 54.1% against 23.4%. The median cluster member has finished 9 lessons and the median solo signup has finished zero. Nothing else on the site produces a gap like that.

`/for-teams` and the printed handout at `/teams/print`. The handout's own source comment makes the right argument: every in-app prompt is bounded by people who already have accounts, and a sheet handed round at a build-season meeting reaches thirty students who don't. That's the only surface on the site whose reach isn't capped by the 594 existing accounts.

Letting search compound with no spend. Google +69.5% (82 to 139), Bing +94.5% (73 to 142), DuckDuckGo +34.5% (58 to 78), Brave 7 to 13, all `visits/count` across the four weeks. That happened without a single outreach action and it's the cheapest growth the site has.

The consent work already shipped. The signup form now discloses at the point of collection and `/unsubscribe` is token-gated, one-click, login-free, and supports `resub=1`. It drew 28 visitors and 30 pageviews in 14 days, so people are finding and using it. That half is right. Section 4 action 4 fixes the half that isn't.

The daily snapshot. `vercel.json` already runs `/api/snapshot` at 06:00 UTC. The capture is automated, which means the weekly tripwires in the report's section 10 cost nothing to start watching.

## 3. Stop doing

Anything aimed at Chief Delphi. On `visits/count` it runs 31, 22, 23, 14 across the four weeks, so it's down 39.1% in the newest week and is 1.3% of that week's 1,054 visitor-days. Signups from it went 9 to 4 across the two fortnights against a launch-era total of 91. It's a decaying channel, and the community there has publicly called the site AI-generated, so further activity costs reputation and buys 14 visitor-days a week. Leave it alone.

Adding lessons as an acquisition move. 92 lesson pages that rank at all pull 186 search visitors, an average of 2.0 each, against 59 blog pages pulling 296. Tools pull 9 total. And supply isn't the binding constraint even for the team that uses the site hardest: 7002's 64 accounts have touched 241 distinct lessons, leaving 153 of 394 never opened by anyone on the team, with 27 of the 64 having never completed a single lesson. Writing lesson 395 moves nothing.

Quoting `funnel_events` or any pageview headline. `funnel_events` holds 268 `lesson_completed` rows all time against 7,409 completed `lesson_progress` rows, 3.6%, and logged-in `lesson_opened` lands on exactly 33 in three of the last four weeks, which is an instrumentation artefact and not behaviour. Pageviews are contaminated in the other direction: China, Singapore, Israel and Paraguay are 396 visitors producing 4,384 pageviews, 43.4% of country-dimension pageviews from 21.5% of country-dimension visitors, and 2026-09-17 was the third biggest pageview day with China at only 96 of its 1,402, so stripping China doesn't clean it either.

Marketing `/fact-check`. It drew 1 visitor in 17 days and 2 of 394 lessons carry a `verified_at`, 0.51%. The page advertises a programme that hasn't started. Either run the programme or take the page down, but don't promote it.

Sending any lifecycle email. 567 of 594 accounts have `email_opt_in = true`, 95.45%, and 96 of the 99 accounts created since 2026-09-08 were enrolled by default. `grep -rn "email_opt_in" src/app/settings/` returns nothing, so the signup disclosure's promise that "you can switch them off in Settings" is not true today. Every email recommendation in this file is gated behind action 4 in section 4, and that gate is not negotiable.

Treating the referral link as a channel. 35 of 595 accounts all time carry a real `referred_by`, 5.9%, and 7 of the last 89. The 35 came from 10 distinct referrers distributed 11, 5, 5, 3, 3, 3, 2, 1, 1, 1, so one person brought nearly a third. Word of mouth is real here but it's three people, not a programme. It's an output of the cluster mechanic, not an input.

## 4. Next 14 days

Ranked by expected impact divided by effort. Action 4 is the exception: it ranks fourth on that ratio and ships anyway, because the signup form already promises it.

| # | Action | Type | Effort | Number it targets |
|---|---|---|---|---|
| 1 | Find out whether `/start` helped or hurt | product | 3h | 48h activation, 36.7% |
| 2 | Ask 7002's mentor for a quote and two introductions | outreach | 1.5h | cluster share, 37.1% |
| 3 | Email the four hosts that already link to the site | outreach | 2h | Referral signups, 10 of 89 |
| 4 | Email settings toggle and honest re-consent | product | 3h | opt-in by default, 95.45% |
| 5 | Record lesson starts | product | 4h | 48h activation, 36.7% |
| 6 | Make the site readable by LLMs | product | 5h | chatgpt.com, 7 visitors |

### Product changes

The numbers below are the ranks from the table above, so they run 1, 4, 5, 6 here and 2, 3 under outreach. That keeps the ranking readable while the work is split by type.

1. Find out whether `/start` helped or hurt.

- Lever: the post-signup first-run flow that already exists and has never been measured.
- Targets: 48-hour activation, 36.7% post-redesign against 52.5% before, a 15.8 point fall at roughly 3 standard errors on n=90.
- Why this first: `/start` is already built. `src/app/start/page.tsx` is a one-question goal picker that hands back a five-lesson plan, `src/lib/first-run.ts` routes fresh signups into it instead of `/dashboard`, and both auth paths share that module. The file's own header says the first-run build "shipped with no entry point" and that `first-run.ts` was added later to fix that. So a change to the post-signup path landed near the date activation dropped, and nobody has checked which way it cut. Building a new first-run experience before answering that is exactly the "build feature X and hope" the brief rules out.
- Steps: (a) get the deploy dates of `src/app/start/page.tsx` and `src/lib/first-run.ts` from Vercel's deployment list and line them up against 2026-09-06; git history is unavailable on this machine right now, the Xcode licence prompt blocks it, so use Vercel. (b) The goal answer is stored only in the `lf_goal` cookie (`START_GOAL_COOKIE` in `src/lib/recommend.ts`), server-read, so it is invisible to every database query, which is why this can't be answered today. Add a nullable `start_goal` text column on `profiles` and write the goal id there when the picker is answered. (c) Run the 48-hour activation query split three ways for accounts created since the column ships: answered a goal, reached `/start` and skipped, never saw it because they came in through an explicit `?next=` or a `/join/<code>` invite.
- Effort: 3 hours.
- 14-day check: you can state 48-hour activation for goal-answered against goal-skipped with an n beside each. That is the check. If goal-answered is below 36.7% and n is over 25, `/start` is the problem and reverting `first-run.ts` to send fresh accounts to a lesson directly is the next action. If it's above, `/start` isn't the cause and action 5 tells you where the loss actually is.

4. Email settings toggle and honest re-consent.

- Lever: consent. This gates every email recommendation in this file and in the 90-day section.
- Targets: 567 of 594 accounts opted in by default (95.45%), 27 false, zero null, unchanged from 471 of 495 (95.15%) at the 2026-09-08 review.
- Steps: (a) add a notification section to `src/app/settings/page.tsx` with one checkbox bound to `profiles.email_opt_in`, which makes the sentence already on the signup form true. (b) Change the signup default to false and make the checkbox on the signup form an explicit opt-in rather than a disclosure. (c) Leave the existing 567 alone rather than mass-mailing a re-consent request, because a re-consent email to people who never consented is the same problem again; instead put a one-line banner on `/dashboard` for accounts with `email_opt_in = true` that were enrolled by default, saying they're subscribed and linking straight to the new toggle.
- Effort: 3 hours.
- 14-day check: the toggle exists and works from a signed-in session, new accounts created after the change show `email_opt_in = false` unless the box was ticked, and the count of `email_opt_in = true` has moved off 567 in at least one direction. A drop is a success, not a failure: it means people who never wanted the mail found the switch.

5. Record lesson starts.

- Lever: the one measurement gap that makes the 36.7% undiagnosable.
- Targets: 48-hour activation, 36.7%, and the 47 solo accounts in the Sept 1 to 15 cohort with a median of zero lessons. Nothing in the database records a start: all 7,409 `lesson_progress` rows carry a non-null `completed_at`, so the table has one state and not two, and `funnel_events` captures 3.6% of completions with logged-in opens pinned at 33.
- Honest framing: this moves no number by itself. Its job is to make the number in action 1 answerable next month instead of guessed at. It's here because every activation fix after this one is a coin flip without it.
- Steps: one table and one server action, exactly as the report's section "what this report did not answer" item 5 specifies. Write a row on lesson open using the user id from the server session and never anything the client passes, key it on user id plus lesson id plus day so repeats are idempotent, index on user id, and leave completions where they already work. Then delete `funnel_events` reads from anything that reports, so nobody quotes 268 against 7,409 again.
- Effort: 4 hours.
- 14-day check: the table holds at least one start row for 80% or more of the accounts created in the 14 days after it ships, and you can answer "how many of the accounts that started a lesson finished one" as a single query. If coverage is under 80%, the write is firing in the wrong place.

6. Make the site readable by LLMs.

- Lever: AI discovery, which the report shows starting and which nothing on the site is built for.
- Targets: chatgpt.com at 7 visitors in the last fortnight against 17 the fortnight before (`visits/aggregate`, a base too small to trend but not too small to build for), and `/blog/[slug]` at 608 of 1,977 visitor-days, since the blog is what would get cited.
- Steps: (a) `robots.ts` currently allows everything public with a short deny list and names no AI crawler, so GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, anthropic-ai, Google-Extended and Bingbot are all already allowed. Leave that alone and confirm it in production rather than changing it. (b) Add `/llms.txt` as a route: what LearnFRC is, who it's for, the 11 departments by name, and links to `/guides`, `/blog`, `/tools`, `/glossary` and `/for-teams`. There is no llms route in `src/app` today. (c) FAQPage JSON-LD already exists on the six tools and conditionally on blog posts that carry a `faq` field (`src/app/blog/[slug]/page.tsx` line 121). Add three to five real questions to the `faq` field of the ten blog posts that pull the most search visitors, starting with `frc-systemcore` (87), `frc-2027-season-calendar` (17) and `frc-2027-biocore` (15). (d) Lesson pages carry LearningResource, Course and BreadcrumbList but no FAQPage; add one to the department pages, starting with `/guides/programming-software` which pulls 14. (e) Write one citable stats page: FRC numbers with sources and dates, in one-line extractable form, because a maintained statistics roundup is the format that earns the most citations per page and is exactly what an LLM lifts.
- Effort: 5 hours.
- 14-day check: two parts, and only the first is a real result in 14 days. First, run 20 queries ("what is FRC SystemCore", "how do I pick an FRC drivetrain", "free FRC training for rookies", and so on) five times each across ChatGPT, Perplexity and Google AI Overviews, log the citation rate as a fraction with its n, and keep the sheet. That's the baseline, and there isn't one today. Second, `/llms.txt` returns 200 in production and the Rich Results Test passes on the ten blog posts. Do not expect referrer numbers to move in 14 days; 7 visitors a fortnight is noise and the report says so.

### Outreach

2. Ask 7002's mentor for a quote and two introductions.

- Lever: the only proven acquisition mechanic on the site, used deliberately once.
- Targets: cluster share of signups, 33 of 89 (37.1%) last fortnight against 48 of 101 (47.5%) the fortnight before, and `referred_by` at 7 of the last 89. Team 7002 holds 64 of 594 accounts all time, 10.8%, spread continuously from 2026-08-05 to 2026-09-21, which is seven weeks of steady onboarding rather than a spike.
- Steps: one email to whoever at 7002 set this in motion. Three asks, in this order: one sentence you can quote on `/for-teams` about what they used it for, an introduction to two other teams in their district or region, and a straight answer to what made them start (you don't know, and the whole plan rests on it). Then, separately, a short note to the 27 of 64 accounts on that team who have never completed a lesson, sent by their mentor rather than by you, because a nudge from the person running the build season lands and a nudge from a website doesn't. That second note waits for action 4 either way.
- Effort: 1.5 hours.
- 14-day check: a usable quote on `/for-teams`, and at least one new team number with 3 or more accounts created in the window. One new cluster is the bar. Two is a good fortnight.
- Constraint note: send from the learnfrc.com address, say plainly that you're a high-school student who built it, and don't put a home address or phone number in the email. If anyone asks for a call, take it with a parent in the room.

3. Email the four hosts that already link to the site.

- Lever: the only mentor-shaped and school-shaped signal in the entire dataset, which nobody has followed up on.
- Targets: Referral signups, 10 of 89 last fortnight against 19 of 101 the fortnight before, a halving. The hosts are `frenship.schoology.com` (2 visitors), `nisd.schoology.com` (1), `wiki.teamroboto.org` (2) and `circuitrunners.clickup.com` (1). Two are school-district LMS installs, which means a teacher or mentor put the link inside a course. That is a coach putting the site in front of a class, which is precisely the channel the data says works and the one that produces clusters.
- Steps: the two team-wiki hosts are traceable directly, so look up each team on FIRST's public team directory and use the contact address the team publishes on its own site. The two Schoology hosts are login-gated, so you can't see the course; work back from the district to the FRC teams in that district and email the team's published contact. Four emails, each one short: you noticed they linked to the site, thank you, here's `/for-teams` and the one-page handout at `/teams/print`, and one question, which is what made them link it. Ask nothing else.
- Effort: 2 hours.
- 14-day check: at least two replies, and referrer visitor-days from those four hosts above their current 2, 1, 2, 1 in the next complete week. Two replies is the real check; the traffic number is too small to read either way and is here only so you log it.
- Constraint note: same as action 2. Public team contact addresses only, nothing scraped, no personal details of yours in the message.

## 5. Next 90 days

Six bets, same format. These assume the 14-day actions landed and that action 4 shipped, because three of the six involve email.

1. Build a mentor path and stop being a student-only site.

- Lever: mentors are the people who bring whole teams, and the site has almost none.
- Targets: 15 mentors and coaches out of 595 accounts (2.5%), 19 non-students total, and zero non-student signups in the last 48 days. All 190 accounts created in the last 28 days are students. Cluster share of signups fell 47.5% to 37.1% over the two fortnights.
- Steps: (a) a `/for-mentors` page separate from `/for-teams`, because the mentor's question is "what do I do at Tuesday's meeting" and `/for-teams` answers "why should my team use this". (b) A 20-minute first-meeting agenda as a one-page download, since the `/teams/print` handout already proves this format works here. (c) Make the department certificate exportable as a roster-level view, because the report's own team page argues mentors use it to find who's trained on the mechanism, and a lead mentor needs that as one sheet, not eleven certificates. (d) Then email the mentor contact at the 10 teams that already have 3 or more accounts, plus the four hosts from 14-day action 3.
- Effort: 20 hours over the quarter.
- 90-day check: non-student accounts above 25 from 15, and at least 3 team numbers other than 7002 with 10 or more accounts. If non-students are still under 20, the mentor path isn't the constraint and the money is in bet 2 instead.

2. Own the January 2027 kickoff search wave.

- Lever: the one repeatable thing the blog has actually done.
- Targets: blog search visitors, 296 across 59 pages over 14 days, and the concentration inside it, since `frc-systemcore` alone is 87 of that. Kickoff falls inside this 90-day window.
- Steps: pick the 12 queries every team types in the first week of January, which is game-manual terminology, rule changes, the new control system, and the season calendar. Publish them in December so they're indexed before demand arrives, each with a real FAQ block feeding FAQPage schema, a visible last-updated date, and one dated update per week through kickoff week. Refresh `frc-2027-season-calendar` weekly rather than writing a new calendar post. Do not write these in January; the whole point is being indexed before the wave.
- Effort: 30 hours over the quarter.
- 90-day check: blog search visitors above 450 in a complete fortnight, and at least 3 posts each above 40 visitors. The second half matters more than the first: today one post carries 29% of blog search traffic, and a wave that produces one more `frc-systemcore` instead of three durable posts is a worse outcome than the number suggests.

3. Fix the domain authority that the Bing and Google parity exposes.

- Lever: links, earned without forums.
- Targets: Bing at 142 visitor-days against Google at 139 in the newest week. An established domain outranks its Bing traffic on Google by a wide margin; parity means Google doesn't trust the domain yet, and the 2026-09-08 review flagged the same thing with no movement since.
- Steps: (a) ask the teams already on the site to link from their own team sites, which is 196 distinct plausible teams and the single most natural link source this site has. (b) School district STEM and robotics resource pages, which the two Schoology referrers prove are already linking to things like this. (c) FIRST regional and district websites that publish resource lists. (d) Legitimate free education directories only, nothing with a DR under 10 and no paid submission services. (e) Publish the stats page from 14-day action 6 and keep it current, because statistics roundups earn roughly 4.25 times the links per page of any other format and this site has real data nobody else has.
- Effort: 15 hours over the quarter.
- 90-day check: Google visitor-days at least 30% ahead of Bing in a complete week, on `visits/count` with the same folded-engine filter the report uses. The report's own tripwire is the inverse of this, Bing ahead by more than 20% for three consecutive weeks, so you'd be watching the same line from the other side.

4. Run an AI citation programme instead of hoping.

- Lever: the channel the report says is starting.
- Targets: chatgpt.com at 7 visitors last fortnight against 17 before, and the citation baseline you'll have from 14-day action 6.
- Steps: (a) add `llms-full.txt` once `llms.txt` is live, and serve Markdown for lesson and blog pages via content negotiation with a `Link` header, so an agent that asks for Markdown gets Markdown instead of a rendered React tree. (b) Put FAQPage on every department page, not just the two or three. (c) Lead every lesson and blog section with a direct 40 to 60 word answer before the explanation, which is the passage length that gets extracted, and which is also just better writing. (d) Publish original data, since the site has 7,409 completions across 394 lessons and 196 teams and nobody else has that; an annual "what FRC teams actually learn first" piece is a primary source that gets cited rather than a page that cites others. (e) Run the 20-query, 5-runs-each check monthly and keep the sheet, tracking the rate with its n and never a single run.
- Effort: 25 hours over the quarter.
- 90-day check: cited on at least 5 of 20 queries at n=5 on at least one platform, against whatever the 14-day baseline turns out to be, and combined chatgpt.com plus perplexity.ai plus copilot referrer visitor-days above 30 in a fortnight from 7. Treat the citation rate as the real number and the referrer count as the noisy confirmation, because the report is explicit that a 7-against-17 swing on that base means nothing on its own.

5. Turn the thing 7002 does into something a second team can do.

- Lever: making the cluster effect reproducible instead of accidental.
- Targets: the cluster-versus-solo gap, 45.9% against 19.1% at 10+ lessons and a median of 9 against 0, and the concentration risk the report names as the one tripwire that matters: 7002 produced 421 of 1,298 completions (32.4%) and 49 of 190 28-day signups (25.8%), and nothing watches it.
- Steps: (a) work out what 7002 actually did, from 14-day action 2's third question. Do not design this before that answer arrives. (b) Whatever it is, make it a named path a mentor can follow: pick departments for the team, assign members to them, and use the department certificate as the deliverable, since certificates already exist at `/certificate/[department]`. (c) Add the report's own alert as a cron check on the existing `/api/snapshot` job: zero completed `lesson_progress` rows from any of 7002's 64 user ids for seven consecutive days, or fewer than 100 in a fortnight against 421 in the last one.
- Effort: 20 hours over the quarter.
- 90-day check: at least 3 team numbers with 10 or more accounts each and a median of 5 or more lessons per member who has completed anything, so the completions headline no longer depends on one team. Secondary check: the last-fortnight completions figure with 7002 removed, which is 877 today against 1,298 including them, should be above 1,100.

6. Get a person-level number and retire the broken instruments.

- Lever: being able to trust your own dashboard.
- Targets: 4.50% visitor-to-signup, which is 89 accounts over 1,977 visitor-days and is not a rate per person, because `visits/count` is day-summed and Vercel cannot produce a person count at all. The `events/count` dataset returns 0 visitors and 0 events for 2026-08-25 to 09-22 because nothing in the app calls `track()`.
- Steps: (a) call `track()` on signup and on first lesson completion so the Vercel events dataset stops being empty and a first-party id exists to join on. (b) Drop `funnel_events` entirely once the lesson-start table from 14-day action 5 has a fortnight of data; keeping a table that captures 3.6% of reality is worse than having no table. (c) Fix `scripts-snapshot.js` line 62, which computes `distinctFrcTeams` as `new Set(teamRows.map((t) => t.team_number)).size` with no plausibility predicate, so the baseline counts 12119, 12345 and 99990 as teams. Import `countDistinctTeams` from `src/lib/frc-team.ts`, recompute the baseline, and the 174-to-196 comparison becomes a real delta instead of a withdrawn one. (d) Tighten the plausible-team bound at the bottom end, because `team_number = 1` passed the 1 to 12,000 test twice today and is plainly a placeholder.
- Effort: 12 hours over the quarter.
- 90-day check: a signups-per-person rate exists, reconciles with the `profiles` count within 10%, and is quoted instead of 4.50%. And `scripts-snapshot.js` and `countDistinctTeams` return the same number on the same pull, which is a one-line diff to verify.

## 6. Tempting, but the data says no

More lessons. 92 lesson pages that rank pull 186 search visitors, 2.0 each, against 59 blog pages pulling 296. 153 of 394 lessons have never been opened by anyone on the team that uses the site hardest. Adding lesson 395 costs a weekend and moves nothing.

A Discord or any owned community. Setting aside the no-forums constraint, there is no demand signal to build on. The `feedback` table holds 3 rows all time and none in 36 days, `content_edits` holds 5 and none in 47 days, and 121 of 594 accounts (20.4%) have a null `last_seen_at` and have never been recorded returning. A community needs 20 to 50 founding members who already engage; this site has 148 people seen in the last 7 days and no evidence any of them want to talk to each other.

More free tools. Six exist. They pull 9 search visitors in 14 days total, of which `/tools/frc-budget-calculator` is 4. They already have FAQPage schema and a WebApplication type, so the format isn't the problem. Building a seventh doesn't explain why the six don't rank, and bet 3 does.

Paid ads of any kind. Zero budget by default, and the CAC math can't even be written down: the site has no revenue, and 4.50% is per visitor-day rather than per person, so there's no denominator to spend against. If money ever appears, it's a $0 recommendation until bet 6 gives a person-level number.

Relaunching the referral programme. 35 of 595 accounts all time, 7 of the last 89, 10 distinct referrers of whom 3 brought 21 of the 35. That's three enthusiastic people, not a programme. It becomes worth building after bet 5 produces a second and third team that look like 7002, and not before.

Chasing mobile. Mobile's share of weekly visitors rose every week, 21.1% to 26.4%, which reads like a story. It isn't one: mobile reaches `/signup` at 16.80% (83 of 494) against desktop at 16.40% (238 of 1,451), both `visits/count`. The first draft of the report printed this backwards. Mobile is not the leak, and no device-level claim beyond this is possible because `profiles` has no device column and the events dataset is empty.

A launch moment, Product Hunt or otherwise. Wrong audience, since FRC mentors and students aren't there, and wrong time: the thing that isn't finished is activation at 36.7%, and a launch pointed at a funnel that loses 63% of arrivals inside 48 hours wastes the one launch you get. Revisit after 48-hour activation is back over 50%.

Exit-intent or email-capture popups on blog posts. It's the obvious move, because `/blog/[slug]` is 608 of 1,977 visitor-days at 1.26 pageviews per visitor, which is a lot of people arriving and leaving. Two reasons not to: there's no consent infrastructure to capture into until action 4 ships, and Google treats intrusive interstitials on mobile as a ranking negative while search is the only growing channel and mobile is 26.4% of it. Risking the one channel that works to capture emails you can't legally use yet is the wrong trade. Revisit after action 4, and test on desktop only.

Publishing a "we're not AI-generated" response anywhere. The report contains no data on this at all, which is the point. The only answer to that criticism that shows up in any number is 2 of 394 lessons carrying a `verified_at`, and fixing that ratio is a content decision, not a marketing one.

## 7. Skills

- marketing-plan: supplied the AARRR ordering that put activation ahead of acquisition in section 4, and the "hope is not a strategy" rule that made every action name its mechanism and its 14-day check.
- marketing-ideas: its by-budget filter is why nothing in this file costs money, and its engineering-as-marketing entry is why the six existing tools got assessed rather than expanded.
- marketing-loops: the cadence rule is why the AI-citation check is monthly and the 7002 completion alert is daily, and its "a weekly conversion loop on 40 visitors a week is measuring noise" warning is why no loop is proposed on the chatgpt.com number.
- marketing-council: seated Byron Sharp against Seth Godin on reach versus resonance, which is the real tension between bet 2 (kickoff search wave, mass reach) and bet 5 (make one team reproducible, smallest viable audience). Both are in the plan because the data supports both, and the disagreement is named rather than resolved.
- referrals: the viral-potential spectrum put LearnFRC on the natural end via team numbers, not the reward end, which is why the referral programme is in section 6 and the cluster mechanic is bet 5.
- community-marketing: its health metrics are what made a Discord a clear no. Zero non-staff content in 36 days and a 20.4% never-returned rate fail every warning sign it lists.
- launch: the SLC readiness gate is why a launch moment is in section 6. Activation at 36.7% means the product isn't Complete at its chosen scope yet.
- product-marketing: no `.agents/product-marketing.md` exists in this repo. Its ICP framing is what separated the mentor buyer from the student user in bet 1, and writing that file is a worthwhile side effect of bet 1's `/for-mentors` work.
- lead-magnets: the format-to-buyer-stage table picked the one-page meeting agenda in bet 1, matching the format `/teams/print` already proves works here.
- social: did not apply as a channel. The owner is a minor with no audience and the data shows reddit.com at 4 visitors in the newest week, so a posting cadence has nothing to attach to. Its content-atom framing survives inside bet 2's blog-to-FAQ repurposing.
- influencer-marketing: did not apply. Zero budget, and the nearest legitimate version, sending product to a creator, has no product to send. The audience-alignment test is what ruled it out rather than the budget.
- public-relations: its "a milestone alone isn't a story" test is why no press push is recommended. The site has 594 accounts and one active team, which is not yet a story a journalist can write from one email.
- co-marketing: the audience-overlap analysis is what made the four linking hosts in 14-day action 3 the highest-value outreach on the list, because they've already demonstrated the overlap rather than being guessed at.
- events: its 80/20 selection rule and the "is in-person even necessary" gate ruled out competitions and regionals for a minor who can't travel alone, but the before-and-after arc is what shaped the mentor outreach in bet 1.
- directory-submissions: its rule-2, destination pages before directories, is why bet 3 sequences the link building after the stats page exists, and its DR-under-10 warning bounds which directories count. The Product Hunt playbook is explicitly not used, per section 6.
- offers: the value equation diagnosed the real constraint as time delay and effort, not dream outcome. The product is free, so nothing here is priced; the lever is getting to the first lesson faster, which is 14-day actions 1 and 5.
- free-tools: its evaluation scorecard is why no seventh calculator is recommended. The existing six score well on build feasibility and badly on search demand, at 9 visitors in 14 days.
- competitors: did not apply as a page format. LearnFRC is free with no direct paid competitor to write `/alternatives/` pages against, and the honest comparison would be against free community resources, which would read as an attack on the community that already dislikes the site.
- competitor-profiling: not run, and it should be, as a 90-day side task. The report contains no competitive data at all, so nothing in this plan knows what the site is losing search traffic to.
- cold-email: shaped the four outreach emails in 14-day action 3 and the 7002 email in action 2. Its "personalization must connect to the problem" rule is why each one leads with what that specific host did rather than with what LearnFRC is.
- prospecting: the demand-signal branch is exactly the four referring hosts, which are public evidence of the exact behaviour you want rather than firmographic guesses. Its compliance guardrails set the published-contact-only rule in both outreach actions.
- brand: applied only as voice discipline, since the site has a visual identity already. No brand work is recommended because nothing in the report suggests brand is the constraint.
- content-strategy: the searchable-versus-shareable split is the spine of bet 2, and its link-earning format table, where statistics roundups earn about 4.25 times the links per page, is the direct source of the stats page in 14-day action 6 and bet 3.
- ai-seo: the whole of 14-day action 6 and bet 4. Its three pillars set the order, structure then authority then presence, and its non-determinism rule is why the citation check is 20 queries times 5 runs with the n recorded, not a single lookup.
- programmatic-seo: used as a diagnostic, not a build. 92 lesson pages at 2.0 search visitors each is the thin-content distribution it describes, which is why section 3 stops lesson production as an acquisition move.
- seo-audit: its crawlability pass confirmed `robots.ts` already blocks the 1,370 parameterised `/login?` and `/signup?` dead ends and allows every AI crawler, so 14-day action 6 changes nothing there. Its single-H1 and heading-hierarchy checks feed the blog FAQ work.
- churn-prevention: reframed to retention on a free product. Its risk-signal table is what turned the 27 of 64 dormant 7002 accounts into a named action (the mentor-sent nudge in action 2) instead of a statistic.
- cro: its traffic-context-first ordering is why section 4 fixes the post-signup path before touching any landing page, since 73.1% of visitor-days are direct and the signup page already converts somewhere between 20.4% and 51.5% depending on the week.
- onboarding: the largest single contributor. Time-to-value, the minimum path to value, and the endowed-progress effect are the frame for 14-day actions 1 and 5, and its "find your aha moment" question is what makes 48-hour activation the number those actions target.
- signup: its field-level drop-off framing is why 14-day action 1 measures the goal picker rather than assuming it helps. One extra question before the first lesson is exactly the friction it warns about, and the report can't currently say which way it cut.
- popups: applied as a rejection. Its own Google-interstitial warning plus the missing consent infrastructure put popups in section 6, with a specific condition for revisiting rather than a flat no.
- ads: did not apply. Zero budget, no revenue, and no person-level conversion number to compute a CPA against. Named in section 6 with the condition that would change it.
- customer-research: Mode 2, mining existing signal, is the four referring hosts. Mode 3, going and asking, is the third question in the 7002 email, and it's there because the `feedback` table has 3 rows all time and 36 days of silence, so there is no Mode 1 material to analyse.
- attribution: supplied the direct-is-four-populations reading (1,445 of 1,977 visitor-days, 73.1%) and the rule that a large direct share is a measurement problem rather than a channel. It's also why bet 6 exists: a self-reported "how did you hear about us" already exists as `profiles.source`, and the identity gap that would make it trustworthy is the missing `track()` call.
