# LearnFRC growth review, 2026-09-22

Traffic is genuinely up, roughly 16 to 21 percent over the last fortnight depending on how you strip out non-human pageviews, but signups fell 12 percent over the same span and 48-hour activation dropped from 52.5 percent before the 2026-09-06 redesign to 36.7 percent after it. Most of the new arrivals are anonymous search visitors landing on blog posts and leaving after 1.2 pages, plus a block of Chinese Edge traffic that reads 14 pageviews per visitor and looks automated, while the learning that does happen is carried by one team: 7002 produced 421 of the last fortnight's 1,298 lesson completions. The single biggest lever is the blog-to-account path, because `/blog/[slug]` drew 608 of the last 14 days' 1,977 visitor-days, 30.8 percent, and is where nearly all search discovery lands. Both of those numbers are `visits/count`, and putting them on one basis is the correction that matters most in this file: an earlier draft divided the deduped 567 from `visits/aggregate` by the day-summed 1,977 and published 28.7 percent. Those readers convert at 4.50 percent, which is 89 accounts over 1,977 visitor-days and not 4.50 percent of people, because Vercel cannot produce a person count at all. It is falling either way.

## How to read every number in this file

- All windows are inclusive of both end dates and are UTC calendar days.
- Today, 2026-09-22, is excluded from every headline window because it is still accruing. Traffic figures moved while this report was being written: a `visits/count` for `since=2026-09-01&until=2026-09-22` returned 2,980 visitors on one call and 2,983 about twenty minutes later.
- Traffic source is the Vercel Web Analytics API at `https://api.vercel.com/v1/query/web-analytics/`, always with `projectId` and `teamId`. Adding `filter=environment eq 'production'` changed nothing: `since=2026-09-01&until=2026-09-22` returns 2,980 / 17,702 with and without it, so no environment filter is applied anywhere below.
- Every traffic figure carries a basis, and this is not decoration. `visits/count` is day-summed: a person who visits on five days counts five times, so read it as visitor-days. `visits/aggregate` with a `by` dimension deduplicates a visitor inside the window you asked for, so its rows are smaller. On the same filter the two disagree by up to 40 percent. A number from one basis must never be divided into a total from the other, and every traffic table below says which basis it came from. Four figures in the first draft of this report broke that rule and are corrected in the verification section.
- Database figures are Supabase REST reads, paged at 1000 rows with an `offset` loop until a page returns fewer than 1000. Row counts pulled: profiles 594, lesson_progress 7,409, funnel_events 2,940, feedback 3, content_edits 5, lessons 394, modules 101, departments 11. The verification pass on this file re-pulled profiles and got 595, so the database moved while the report was being written, the same way traffic did.
- Team-number plausibility follows `src/lib/frc-team.ts`: an integer from 1 to 12,000. 194 accounts have no plausible team number. That 194 counts accounts, and it is not the count of distinct teams, which is 196 on today's pull. The first draft printed 194 for both, which is how the distinct-team figure turned out to be unfiltered. See the verification section.

Two API behaviours were re-probed today and they matter for anything you rebuild from this:

- A bare date in `since` and `until` is treated as a whole inclusive day. `since=2026-09-05&until=2026-09-05` returns 163 visitors / 1,757 pageviews, which matches that day's row in the `by=day` series exactly. An ISO instant is exclusive at the end: `since=2026-09-05T00:00:00.000Z&until=2026-09-06T00:00:00.000Z` returns the same 163 / 1,757.
- A `visits/aggregate` call where `since` equals `until` and a categorical `by` dimension is set returns near-garbage. Asking for `by=country` on 2026-09-05 alone returned 3 US visitors on a day that had 163. Any single-day breakdown below was built from a multi-day `by=day` series with a filter, never from a single-day aggregate.

## 1. Trend. Is "booming" real?

Daily figures, 2026-08-25 to 2026-09-22. Visitors and pageviews from `visits/aggregate?by=day`. Signups are `profiles` rows bucketed by `created_at::date`. Completions are `lesson_progress` rows with `completed_at not null` bucketed by `completed_at::date`. Active users are distinct `user_id` among those completion rows that day.

| day | visitors | pageviews | signups | completions | active users |
|---|---|---|---|---|---|
| 08-25 | 113 | 467 | 5 | 59 | 10 |
| 08-26 | 195 | 622 | 8 | 82 | 13 |
| 08-27 | 126 | 561 | 8 | 73 | 10 |
| 08-28 | 73 | 254 | 1 | 12 | 4 |
| 08-29 | 92 | 350 | 2 | 12 | 2 |
| 08-30 | 79 | 294 | 2 | 7 | 4 |
| 08-31 | 105 | 336 | 5 | 19 | 7 |
| 09-01 | 144 | 782 | 21 | 137 | 15 |
| 09-02 | 137 | 599 | 7 | 104 | 14 |
| 09-03 | 112 | 402 | 2 | 36 | 11 |
| 09-04 | 87 | 384 | 6 | 77 | 5 |
| 09-05 | 163 | 1,757 | 22 | 186 | 17 |
| 09-06 | 114 | 1,289 | 11 | 116 | 18 |
| 09-07 | 97 | 700 | 1 | 90 | 15 |
| 09-08 | 111 | 534 | 4 | 129 | 17 |
| 09-09 | 132 | 494 | 1 | 65 | 11 |
| 09-10 | 135 | 725 | 4 | 89 | 10 |
| 09-11 | 131 | 659 | 6 | 62 | 12 |
| 09-12 | 172 | 1,615 | 12 | 312 | 26 |
| 09-13 | 111 | 570 | 3 | 112 | 15 |
| 09-14 | 131 | 558 | 3 | 68 | 18 |
| 09-15 | 172 | 657 | 5 | 93 | 16 |
| 09-16 | 175 | 668 | 4 | 53 | 13 |
| 09-17 | 134 | 1,402 | 6 | 57 | 10 |
| 09-18 | 149 | 639 | 14 | 42 | 10 |
| 09-19 | 167 | 1,056 | 16 | 92 | 22 |
| 09-20 | 112 | 506 | 4 | 53 | 9 |
| 09-21 | 145 | 608 | 7 | 71 | 17 |
| 09-22 (partial) | 149 | 1,098 | 13 | 308 | 25 |

Totals and averages over the 28 complete days, 2026-08-25 to 2026-09-21: 3,613 visitors (129.0 per day), 19,488 pageviews (696.0 per day), 190 signups (6.8 per day), 2,308 lesson completions (82.4 per day).

Week-over-week totals. Each week is a separate `visits/count` call, not a sum of days, though in this data the two happen to agree exactly (see "what not to conclude").

| week | visitors | pageviews | pv/visitor | signups | completions | distinct completers |
|---|---|---|---|---|---|---|
| 08-25 to 08-31 | 782 | 2,884 | 3.69 | 31 | 264 | 37 |
| 09-01 to 09-07 | 854 | 5,913 | 6.92 | 70 | 746 | 59 |
| 09-08 to 09-14 | 923 | 5,155 | 5.59 | 33 | 837 | 57 |
| 09-15 to 09-21 | 1,054 | 5,536 | 5.25 | 56 | 461 | 61 |

Visitors have climbed four weeks running, 782 to 854 to 923 to 1,054, which is +34.8 percent from the first week to the fourth. Signups have not: 31, 70, 33, 56.

The 14 days before the redesign against the 14 days after. Pre is 2026-08-23 to 2026-09-05, post is 2026-09-06 to 2026-09-19, with the launch day counted as post.

| measure | pre (08-23 to 09-05) | post (09-06 to 09-19) | change |
|---|---|---|---|
| visitors, all countries | 1,801 | 1,931 | +7.2% |
| pageviews, all countries | 7,834 | 11,566 | +47.6% |
| pageviews per visitor | 4.35 | 5.99 | +37.7% |
| visitors, `country eq 'US'` | 1,198 | 1,101 | -8.1% |
| visitors, `country ne 'CN'` | 1,612 | 1,600 | -0.7% |
| pageviews, `country ne 'CN'` | 6,307 | 8,077 | +28.1% |
| signups | 102 | 90 | -11.8% |
| lesson completions | 923 | 1,380 | +49.5% |
| visitor to signup | 5.66% | 4.66% | -1.00 pt |

The rolling fortnight comparison tells a friendlier story than the redesign comparison, because the pre-redesign window happens to contain a strong late-August stretch. Last 14 complete days is 2026-09-08 to 2026-09-21, previous 14 is 2026-08-25 to 2026-09-07.

| measure | previous 14 | last 14 | change |
|---|---|---|---|
| visitors | 1,636 | 1,977 | +20.8% |
| pageviews | 8,797 | 10,691 | +21.5% |
| visitors, US only | 1,009 | 1,199 | +18.8% |
| visitors, excluding CN | 1,452 | 1,689 | +16.3% |
| signups | 101 | 89 | -11.9% |
| completions | 1,010 | 1,298 | +28.5% |
| visitor to signup | 6.17% | 4.50% | -1.67 pt |

So: yes on traffic, no on signups. Genuine human traffic is up somewhere between 16.3 percent (excluding China) and 20.8 percent (raw) over the last fortnight, and up 34.8 percent comparing the newest week against four weeks ago. Signups are down 11.9 percent on the same comparison. The +47.6 percent pageview jump across the redesign is mostly not people: excluding China it is +28.1 percent. China's own residual sits on four days, 09-05, 09-06, 09-12 and 09-19, and those are not the same set as the site's four biggest pageview days. Section 10 covers both, including the day that breaks the pattern, 09-17.

## 2. Who the new people are

Accounts created 2026-09-08 to 2026-09-21: 89. A cluster here means 3 or more accounts sharing one plausible team number inside that same 14-day window.

| group | accounts | share of 89 | first signup | last signup |
|---|---|---|---|---|
| team 7002 | 23 | 25.8% | 09-11 | 09-21 |
| team 9427 | 10 | 11.2% | 09-16 | 09-18 |
| all clusters | 33 | 37.1% | | |
| pairs (2 from one team), 5 teams | 10 | 11.2% | | |
| solo (1 from a team), 19 teams | 19 | 21.3% | | |
| no plausible team number | 27 | 30.3% | | |

The previous 14 days, 2026-08-25 to 2026-09-07, had 101 accounts and four clusters: 7002 (26), 6017 (16), 447 (3), 5449 (3), which is 48 of 101 or 47.5 percent in clusters. So cluster share fell from 47.5 percent to 37.1 percent while the total fell too.

7002 and 9427 together are 33 of the last fortnight's 89 signups, 37.1 percent. Everyone else is 56. Over the full last 28 days, 7002 alone contributed 49 of 190 signups, 25.8 percent. Across all time team 7002 holds 64 of the 594 accounts on the site, 10.8 percent, spread continuously from 2026-08-05 to 2026-09-21. That is not a spike, it is a single team steadily onboarding for seven weeks, which is a different and more fragile thing than a growth channel.

Signup source, from `profiles.source`.

| source | last 14 (n=89) | previous 14 (n=101) |
|---|---|---|
| Direct | 37 (41.6%) | 21 (20.8%) |
| Google | 19 (21.3%) | 22 (21.8%) |
| Bing | 17 (19.1%) | 19 (18.8%) |
| Referral | 10 (11.2%) | 19 (18.8%) |
| Chief Delphi | 4 (4.5%) | 9 (8.9%) |
| Other | 2 (2.2%) | 2 (2.0%) |
| DuckDuckGo | 0 | 5 (5.0%) |
| chatgpt.com | 0 | 4 (4.0%) |

Direct doubled its share. Referral halved. Chief Delphi is down to 4 signups a fortnight from a launch-era total of 91 all time, which is the decay described in the 2026-09-08 review continuing rather than stabilising. `referred_by` is populated on only 35 of 594 accounts all time and 7 of the last 89, so the referral link feature is barely used.

Every one of the last 89 accounts has `role = 'student'`. Zero mentors signed up in the last fortnight.

## 3. Where visitors come from

`visits/aggregate?by=referrerHostname` run once per week window. Every number in this first table is on the deduped aggregate basis. Do not compare it against the `visits/count` table below it, and never divide one of its rows into a window total. Engine variants folded as follows: bing.com plus cn.bing.com, duckduckgo.com plus noai.duckduckgo.com, google.com plus google.com.hk. `accounts.google.com` is the site's own OAuth round trip and is listed separately, never as a source.

| host | 08-25 to 08-31 | 09-01 to 09-07 | 09-08 to 09-14 | 09-15 to 09-21 |
|---|---|---|---|---|
| direct (empty referrer) | 540 | 583 | 574 | 670 |
| google (folded) | 67 | 75 | 110 | 116 |
| bing (folded) | 66 | 102 | 114 | 130 |
| duckduckgo (folded) | 49 | 49 | 58 | 69 |
| accounts.google.com (OAuth hop) | 29 | 55 | 43 | 46 |
| chiefdelphi.com | 18 | 19 | 21 | 12 |
| search.brave.com | 7 | 4 | 5 | 13 |
| search.yahoo.com (folded) | 7 | 7 | 5 | 9 |
| chatgpt.com | 5 | 11 | 2 | 5 |
| so.com | 0 | 9 | 7 | 5 |
| ecosia.org | 4 | 0 | 6 | 2 |
| reddit.com (incl. app) | 1 | 1 | 1 | 4 |

A cleaner engine read using `visits/count` with an OData `or` filter per week, which folds engine variants inside one call rather than summing two rows. This is the day-summed basis, so these numbers are larger than the aggregate rows above and they are the ones that can be compared against a `visits/count` week total. Chief Delphi is in this table too, because quoting its aggregate row next to these count figures is exactly the mistake the verification section documents.

| week | google | bing | duckduckgo | chiefdelphi | direct |
|---|---|---|---|---|---|
| 08-25 to 08-31 | 82 | 73 | 58 | 31 | 593 |
| 09-01 to 09-07 | 84 | 104 | 54 | 22 | 658 |
| 09-08 to 09-14 | 126 | 130 | 65 | 23 | 672 |
| 09-15 to 09-21 | 139 | 142 | 78 | 14 | 773 |

What is growing: Google is up 69.5 percent across the four weeks (82 to 139), Bing up 94.5 percent (73 to 142), DuckDuckGo up 34.5 percent (58 to 78), Brave up from 7 to 13. Bing still matches Google visitor for visitor, which is the same low-domain-authority signal flagged on 2026-09-08 and it has not improved.

What is shrinking: Chief Delphi. On the `visits/count` basis it runs 31, 22, 23, 14 across the four weeks, so it is down 39.1 percent in the newest week against the one before and is 1.3 percent of that week's 1,054 visitor-days. The aggregate rows for the same four weeks read 18, 19, 21, 12, and the first draft quoted that series while the engine series next to it was `visits/count`, then divided the deduped 12 into the day-summed 1,054 to get 1.1 percent. The decline is real on both bases and the correction does not rescue Chief Delphi. What it changes is the shape: the aggregate series looks like a rise and then a fall, the count series is a fall from 31 to 22, a plateau at 22 and 23, and then a second fall to 14. chatgpt.com went 5 / 11 / 2 / 5 on the aggregate basis, which is 17 visitors in the previous fortnight against 7 in the last one, a 59 percent drop off a base too small to mean much.

Direct is 1,445 of 1,977 visitor-days over the last 14 days, 73.1 percent, and 9,462 of 10,691 pageviews, 88.5 percent. Both come from `visits/count` with `filter=referrerHostname eq ''`, so numerator and denominator are on the same day-summed basis. The deduped `visits/aggregate` row for the same window reads 1,342 and 8,939, and the first draft divided those into the `visits/count` window totals to get 67.9 and 83.6 percent, which understated direct by 5.2 points. That share almost certainly contains four different things: returning logged-in students arriving by bookmark or typed URL, the OAuth return leg that Vercel sometimes records as direct rather than as accounts.google.com, the owner's own testing, and automated traffic that sends no referrer. Direct visitors average 6.55 pageviews each against 1.22 for Google arrivals, and that contrast holds on either basis, 1.23 against 6.66 on aggregate. Direct is not a single population.

New or odd hosts worth naming, all tiny: `learnfrc.systemerr.com` (2 visitors, week of 09-08), `wiki.teamroboto.org` (2), `frenship.schoology.com` (2) and `nisd.schoology.com` (1) which are school LMS installs linking to the site, `teams.public.onecdn.static.microsoft` (5), `circuitrunners.clickup.com` (1), and a persistent Chinese cluster of so.com, wx.mail.qq.com, mail.163.com, weixin110.qq.com, baidu.com and ntp.msn.cn.

## 4. What search visitors land on

Two-dimension grouping was run as documented, `by=requestPath&by=referrerHostname` with repeated params, over 2026-09-08 to 2026-09-21. It returns 101 rows with the tail collapsed into a literal `Others` / `Others` bucket holding 984 visitors, which makes it useless for a long tail, so the table below was rebuilt from four filtered calls instead: `by=requestPath&filter=referrerHostname eq '<host>'` for google.com, bing.com, cn.bing.com and duckduckgo.com. Those return 95, 78, 23 and 63 rows respectively with no `Others` collapse.

Top search landing pages, 2026-09-08 to 2026-09-21, visitors summed across the four engine queries.

| landing page | total | google | bing | cn.bing | ddg |
|---|---|---|---|---|---|
| / | 168 | 91 | 25 | 47 | 5 |
| /blog/frc-systemcore | 87 | 17 | 29 | 1 | 40 |
| /blog/frc-2027-season-calendar | 17 | 0 | 5 | 1 | 11 |
| /blog/frc-2027-biocore | 15 | 4 | 8 | 0 | 3 |
| /guides/programming-software | 14 | 9 | 4 | 0 | 1 |
| /guides | 14 | 2 | 5 | 7 | 0 |
| /paths | 14 | 0 | 5 | 9 | 0 |
| /blog/frc-can-bus | 10 | 2 | 7 | 0 | 1 |
| /blog/frc-intake-design-guide | 10 | 2 | 7 | 0 | 1 |
| /blog/frc-limelight-setup | 8 | 4 | 2 | 0 | 2 |
| /blog/swerve-drive-explained | 8 | 3 | 2 | 0 | 3 |
| /resources | 8 | 5 | 1 | 2 | 0 |
| /guides/drive-team | 7 | 0 | 6 | 0 | 1 |
| /blog/frc-robot-design-process | 7 | 2 | 4 | 0 | 1 |
| /blog/frc-drivetrain-types | 7 | 1 | 2 | 0 | 4 |

Rolled up by surface, same window and method, 171 distinct paths in total:

| surface | visitors | pageviews | distinct paths |
|---|---|---|---|
| blog posts | 296 | 323 | 59 |
| lesson and department pages under /guides | 186 | 210 | 92 |
| home page | 168 | 254 | 1 |
| /paths | 15 | 19 | 2 |
| other (login, about, teams, tools, glossary) | 41 | 44 | 17 |

That is the finding of this section. The blog is 103 articles and pulls 296 search visitors across 59 pages. The lesson library is 394 lessons across 11 departments and pulls 186 search visitors across 92 pages, an average of 2.0 visitors per page that ranks at all. One blog post, `/blog/frc-systemcore`, pulls 87 on its own, which is nearly half of what the entire lesson library pulls. Departments that get any search traffic at all are Programming and Software (14 on the department page), Drive Team (7), Electrical and Wiring (7 on `pwm-vs-can`), Getting Started (6), and a single deep Programming lesson, `closed-loop-control/feedforward`, with 6, all from DuckDuckGo. Tools pull 9 visitors total, of which `/tools/frc-budget-calculator` is 4.

Most-visited pages overall, 2026-09-08 to 2026-09-21, from `by=requestPath` with `limit=100`. The 100-row cap collapses everything else into `Others`, 657 visitors and 2,796 pageviews, so treat this as a top-100 view and not a complete inventory.

| page | visitors | pageviews | pv/visitor |
|---|---|---|---|
| Others (tail, 100-row cap) | 657 | 2,796 | 4.26 |
| / | 547 | 987 | 1.80 |
| /signup | 299 | 583 | 1.95 |
| /guides | 279 | 529 | 1.90 |
| /dashboard | 210 | 330 | 1.57 |
| /guides/getting-started | 207 | 380 | 1.84 |
| /blog/frc-systemcore | 169 | 213 | 1.26 |
| /teams | 160 | 283 | 1.77 |
| /guides/programming-software | 151 | 239 | 1.58 |
| /login | 146 | 289 | 1.98 |

By Next.js route rather than literal path, same window, which is the better view of the library. These are `visits/aggregate?by=route` rows, so they are deduped inside the 14-day window and are smaller than the matching `visits/count` figures:

| route | visitors (aggregate) | pageviews |
|---|---|---|
| /guides/[department]/[module]/[lesson] | 800 | 3,549 |
| /blog/[slug] | 567 | 853 |
| / | 547 | 987 |
| /guides/[department] | 503 | 1,119 |
| /signup | 299 | 583 |
| /dashboard | 210 | 330 |

Blog reach as a share of all visitors is the one figure here that gets quoted on its own, so it was re-derived on a single basis. `visits/count` with `filter=route eq '/blog/[slug]'` over 2026-09-08 to 2026-09-21 gives 608, and against the 1,977 `visits/count` window total that is 30.8 percent. The first draft put the deduped 567 over the same day-summed 1,977 and published 28.7 percent, which mixed the two bases. Only `/blog/[slug]` was re-run this way. Every other row in the table above is aggregate only and must not be divided into a window total.

Highest pageviews per visitor among pages with at least 20 visitors: `/login` 1.98, `/signup` 1.95, `/guides` 1.90, `/guides/getting-started` 1.84, `/` 1.80, `/settings` 1.76. Nothing on the site exceeds 2.0, which is the honest version of a bounce statement: the Vercel API has no bounce metric at all, so pageviews per visitor is the closest available proxy and it is a different measure. The dashboard's real bounce rate is not retrievable here.

## 5. Activation and retention

Cohort is accounts with `created_at::date` between 2026-09-01 and 2026-09-15, so every member has had at least 7 days. Completions are `lesson_progress` rows with `completed_at not null`, joined on `user_id`. "Within 48h" means the completion timestamp is at most 48 hours after that account's `created_at`. Cluster means the account's plausible team number is shared by 3 or more accounts site-wide; on that definition the September 1 to 15 cohort splits 61 cluster and 47 solo.

| measure | all (n=108) | cluster (n=61) | solo (n=47) | cluster / solo |
|---|---|---|---|---|
| 1+ lesson within 48h | 44 (40.7%) | 26 (42.6%) | 18 (38.3%) | 1.11x |
| 5+ lessons within 48h | 30 (27.8%) | 22 (36.1%) | 8 (17.0%) | 2.12x |
| 10+ lessons within 48h | 18 (16.7%) | 13 (21.3%) | 5 (10.6%) | 2.00x |
| 1+ lesson ever | 62 (57.4%) | 40 (65.6%) | 22 (46.8%) | 1.40x |
| 5+ lessons ever | 50 (46.3%) | 37 (60.7%) | 13 (27.7%) | 2.19x |
| 10+ lessons ever | 37 (34.3%) | 28 (45.9%) | 9 (19.1%) | 2.40x |
| last_seen_at 7+ days after signup | 44 (40.7%) | 33 (54.1%) | 11 (23.4%) | 2.31x |
| median lessons ever completed | 3 | 9 | 0 | |

The 2026-09-08 finding holds and has barely moved: cluster members are 2.40x more likely to reach 10 or more lessons, against 2.5x last time. The starker number is the median. A typical cluster member has finished 9 lessons, a typical solo signup has finished zero.

August comparison, cohort 2026-08-01 to 2026-08-15 so the window length matches at 15 days:

| measure | Sept 1-15 (n=108) | Aug 1-15 (n=49) | Aug full month (n=113) |
|---|---|---|---|
| 1+ within 48h | 40.7% | 57.1% | 55.8% |
| 1+ ever | 57.4% | 63.3% | 64.6% |
| 5+ ever | 46.3% | 40.8% | 38.9% |
| 10+ ever | 34.3% | 30.6% | 29.2% |
| seen 7+ days after signup | 40.7% | 53.1% | 44.2% |

So the September cohort starts worse and finishes better. First-touch activation fell 16.4 points against Aug 1-15, and 7-day return fell 12.4 points, but depth is up: 5+ ever rose from 40.8 to 46.3 percent and 10+ ever from 30.6 to 34.3 percent. Fewer people start, and the ones who do go further.

Overall activation before and after the redesign, using 1 or more completions within 48 hours because that is the only measure not biased by pre-redesign accounts having had more calendar time. Post window stops at 2026-09-19 so that every account in it has had a full 48 hours to act.

| cohort | n | 1+ within 48h | 1+ ever | 5+ ever | 10+ ever |
|---|---|---|---|---|---|
| all accounts created before 2026-09-06 | 480 | 252 (52.5%) | 284 (59.2%) | 172 (35.8%) | 138 (28.8%) |
| accounts created 2026-09-06 to 09-19 | 90 | 33 (36.7%) | 39 (43.3%) | 29 (32.2%) | 18 (20.0%) |

That is a 15.8 point fall in 48-hour activation, and it is not a composition effect: it holds separately inside both groups. Cluster members went from 60.9 percent (95 of 156) to 39.6 percent (19 of 48), and solo signups from 48.5 percent (157 of 324) to 33.3 percent (14 of 42). On the 90-account post cohort the standard error is about 5.1 points, so a 15.8 point gap is roughly 3 standard errors and unlikely to be noise, but the pre-group spans the entire history of the site including the highly self-selected Chief Delphi launch wave, so this is a correlation with the redesign date and not proof the redesign caused it.

Site-wide recency, from `profiles.last_seen_at` measured against 2026-09-22: 148 of 594 accounts seen in the last 7 days (24.9%), 189 in 14 days (31.8%), 250 in 28 days (42.1%). 121 accounts (20.4%) have a null `last_seen_at` and have never been recorded as returning at all.

## 6. Conversion

Visitors from `visits/count` per week. Signups are profiles created in the same week. `/signup` visitors from `visits/count` with `filter=requestPath eq '/signup'`.

| week | visitors | signups | visitor to signup | /signup visitors | signups / /signup visitors |
|---|---|---|---|---|---|
| 08-25 to 08-31 | 782 | 31 | 3.96% | 152 | 20.4% |
| 09-01 to 09-07 | 854 | 70 | 8.20% | 136 | 51.5% |
| 09-08 to 09-14 | 923 | 33 | 3.58% | 143 | 23.1% |
| 09-15 to 09-21 | 1,054 | 56 | 5.31% | 186 | 30.1% |

Over the last 14 complete days the site converted 89 signups from 1,977 visitors, 4.50 percent, against 6.17 percent the fortnight before. The 2026-09-08 review recorded 4.6 percent, so the overall rate has held roughly flat while the immediately preceding fortnight was unusually good.

The `/signup` page rate is unstable week to week (20.4 to 51.5 percent) and the 2026-09-08 figure of about 33 percent sits in the middle of that range, so treat "the signup page converts a third of its viewers" as a range, not a constant. Part of the instability is contamination: US-only `/signup` visitors were 122 of 152 in the week of 08-25 (80 percent US) but only 38 of 136 in the week of 09-01 (28 percent US), which is the same week cn.bing.com referrals appeared. Non-human traffic is reaching `/signup` and inflating the denominator in some weeks. Signups can also start from `/login` (146 visitors in the last 14 days) via Google OAuth, so the `/signup` denominator is not the whole top of the funnel either.

`funnel_events` holds five step names. Counts by week:

| week | lesson_opened | quiz_attempted | lesson_completed | second_lesson_completed | return_visit | distinct user_id | distinct visitor |
|---|---|---|---|---|---|---|---|
| 08-25 to 08-31 | 207 | 42 | 40 | 25 | 18 | 38 | 174 |
| 09-01 to 09-07 | 264 | 64 | 63 | 47 | 32 | 68 | 205 |
| 09-08 to 09-14 | 457 | 44 | 44 | 34 | 26 | 53 | 427 |
| 09-15 to 09-21 | 673 | 45 | 41 | 34 | 15 | 41 | 642 |

This table does not say what it looks like it says, and it is the most misleading thing in the database. `lesson_opened` tripled, 207 to 673, while `lesson_completed` stayed flat at 40 / 63 / 44 / 41, so the open-to-complete ratio fell from 19.3 percent to 6.1 percent. But splitting `lesson_opened` by whether a `user_id` is attached shows the growth is entirely anonymous: 174, 204, 424, 640 anonymous opens against 33, 60, 33, 33 logged-in opens. Three of the four weeks land on exactly 33 logged-in opens, which is not a plausible coincidence and suggests the instrumentation is capped, sampled or partly broken rather than measuring real behaviour. Separately, `funnel_events.lesson_completed` totals 268 rows all time against 7,409 completed `lesson_progress` rows, so the funnel table captures about 3.6 percent of actual completions. Use `lesson_progress` for completion counts and treat `funnel_events` as unusable until it is re-instrumented.

## 7. Devices and countries

Last 14 complete days, 2026-09-08 to 2026-09-21. From `by=deviceType` and `by=country`, both of which are deduped aggregates. The device rows below sum to 1,840, not to the 1,977 window total, which is the giveaway.

| device | visitors (aggregate) | pageviews | pv/visitor |
|---|---|---|---|
| desktop | 1,343 | 7,857 | 5.85 |
| mobile | 466 | 2,155 | 4.62 |
| tablet | 12 | 44 | 3.67 |
| unknown (empty string) | 19 | 39 | 2.05 |

Mobile's share of weekly visitors has risen every week: 165 of 782 (21.1%), 184 of 854 (21.6%), 216 of 923 (23.4%), 278 of 1,054 (26.4%).

Whether mobile converts differently: `visits/count` with `filter=deviceType eq 'mobile' and requestPath eq '/signup'` returns 83 visitors over the last 14 days, and the desktop equivalent returns 238. Both denominators have to come from `visits/count` as well, which is 494 for mobile and 1,451 for desktop. That is 16.80 percent of mobile reaching `/signup` against 16.40 percent of desktop, so mobile reaches the signup page slightly more often than desktop, not slightly less. The first draft used the count denominator for mobile (494) and the aggregate row for desktop (1,343), got 17.7 percent for desktop, and printed the direction backwards. The gap is small enough either way that the conclusion is unchanged: mobile is not the leak. Beyond that point the answer is not available: `profiles` has no device column and the Vercel events dataset is empty (`events/count` for 2026-08-25 to 2026-09-22 returns 0 visitors, 0 events, because nothing in the app calls `track()`), so there is no way to join a device to a completed signup or to a lesson completion. Do not let anyone claim mobile converts worse; the data to say so does not exist yet.

Countries, last 14 complete days:

| country | visitors | pageviews | pv/visitor |
|---|---|---|---|
| US | 1,100 | 4,075 | 3.70 |
| CN | 275 | 2,730 | 9.93 |
| CA | 87 | 501 | 5.76 |
| SG | 75 | 1,092 | 14.56 |
| TW | 65 | 341 | 5.25 |
| MX | 43 | 326 | 7.58 |
| TR | 36 | 208 | 5.78 |
| IL | 33 | 404 | 12.24 |
| BR | 14 | 43 | 3.07 |
| HK | 14 | 28 | 2.00 |
| PY | 13 | 158 | 12.15 |
| JP | 12 | 55 | 4.58 |

43 countries returned rows. The US is 1,100 of the 1,840 visitors the country dimension accounts for, 59.8 percent. China is 14.9 percent of country-dimension visitors but 27.0 percent of country-dimension pageviews. Singapore, Israel and Paraguay show the same signature at a smaller scale: double-digit pageviews per visitor on tiny visitor counts. See section 10.

## 8. Email opt-in state

Report only, no recommendation attached.

- 567 of 594 accounts have `email_opt_in = true`, 95.45 percent. 27 are false. Zero are null.
- At the 2026-09-08 review it was 471 of 495, 95.15 percent. So 96 of the 99 accounts created since then were enrolled by default, and the ratio has not improved.
- `grep -rn "email_opt_in" src/app/settings/` returns nothing. There is no toggle on the settings page. The page has two sections, a profile section (full name, username, hide_name) and an account section that displays the email address.
- The field is referenced in four places: `src/components/auth/auth-form.tsx`, `src/app/unsubscribe/page.tsx`, `src/app/api/lifecycle-email/route.ts` and `src/lib/retention.ts`.
- What has been added since 2026-09-08: a disclosure at the point of collection on the signup form, and a token-gated one-click unsubscribe at `/unsubscribe` that sets `email_opt_in = false` without requiring a login and supports `resub=1` to reverse an accidental click. `/unsubscribe` drew 28 visitors and 30 pageviews over the last 14 days.
- The gap: the signup disclosure tells people "you can switch them off in Settings" and Settings has no such control. The promise made at the point of collection is not yet true. That is the specific exposure, and it is a copy-versus-product mismatch rather than a missing unsubscribe mechanism, since the one-click path does exist.

## 9. Feedback and contributions

All three of these tables are nearly empty, so there is nothing here to trend.

`feedback`, 3 rows total, all with status `replied`:

| created | page | status |
|---|---|---|
| 2026-07-18 | /resources | replied |
| 2026-07-19 | /resources | replied |
| 2026-08-17 | (null) | replied |

Zero feedback rows in the last 28 days, and zero since 2026-08-17. Themes, paraphrased and with no personal detail: two notes about the resources page, one of 165 characters and one of 13 characters, and one general note of 132 characters not tied to a page. Three messages is not a sample; the only real signal is that the feedback channel has gone silent for 36 days while traffic grew 35 percent, which usually means the entry point is hard to find rather than that everyone is happy.

`content_edits`, 5 rows total: 3 accepted (2026-07-06, 2026-08-03, 2026-08-06) and 2 rejected (2026-07-06, 2026-07-19). Nothing submitted since 2026-08-06, a 47-day gap.

Lesson verification: 2 of 394 lessons have a non-null `verified_at`, 0.51 percent. The public `/fact-check` page that shipped on 2026-09-08 has drawn 1 visitor and 1 pageview in the 17 days since, on 2026-09-08 itself. Both the verification programme and the page built to advertise it are, as of today, inert.

## 10. Anomalies

Eleven things that either look non-human or contradict another number.

1. A Chinese Edge-browser pattern is producing a large part of the pageview growth. `filter=country eq 'CN' and browserName eq 'Microsoft Edge'` over the last 14 days returns 116 visitors and 1,651 pageviews, 14.2 pageviews per visitor against 3.70 for US visitors. The daily CN series spikes on exactly four days: 09-05 (80 visitors, 1,071 pageviews), 09-06 (46 / 615), 09-12 (66 / 761) and 09-19 (64 / 704). The Edge-filtered daily series spikes on the same four days: 09-05 (49 / 1,086), 09-06 (27 / 588), 09-12 (53 / 750), 09-19 (35 / 485). On 2026-09-05 China produced 1,071 of the site's 1,757 pageviews, 60.96 percent, and that day is the biggest pageview day in the window.

   What is not true, and what the first draft claimed, is that those four CN days are the site's four biggest pageview days. They are not the same set. The four biggest complete days are 09-05 (1,757), 09-12 (1,615), 09-17 (1,402) and 09-06 (1,289). 09-19, which the draft named, is fifth at 1,056. 09-17 is third and is not a China day at all, which is the next item.

2. 2026-09-17 is the third biggest pageview day in the window and China does not explain it. The day carries 1,402 pageviews on 134 visitors. China contributed 96 of those pageviews, 6.9 percent, the US 282, and Microsoft Edge across all countries 159. Three route-filtered `by=day` series run for this correction locate most of the rest. `/guides/[department]/[module]/[lesson]` carries 586 pageviews on 66 visitors that day, against roughly 200 pageviews on 62 to 71 visitors on each neighbouring day, so 8.9 pageviews per visitor against a normal 3.2. `/blog/[slug]` carries 170 on 40 visitors, against roughly 60 on 50-odd, so 4.3 against a normal 1.3. `/guides/[department]` is flat at 84. So the excess is the lesson library and the blog being walked page by page while the visitor count stays completely normal, which is the shape of a crawler that Vercel's bot filter did not catch, and it has no country concentration. About 560 of the day's pageviews are still unattributed after those three routes. The point that matters: any sentence of the form "the big pageview days are Chinese" has to survive 09-17, and it does not.

3. Those two items together mean the headline pageview number is contaminated, and that stripping China does not fully clean it. Pre to post redesign, pageviews rose 47.6 percent overall but 28.1 percent excluding China, and visitors rose 7.2 percent overall but fell 0.7 percent excluding China and fell 8.1 percent for the US alone. Vercel filters known bots; this pattern survived that filter, so it is either a scraper with a plausible user agent or an LLM-training crawler. The +28.1 percent non-China figure still contains 09-17, so treat it as an upper bound on real pageview growth rather than a clean one.

4. Singapore, Israel and Paraguay show the same shape at lower volume: 75 visitors / 1,092 pageviews (14.6 per visitor), 33 / 404 (12.2), and 13 / 158 (12.2). Together with China that is 396 visitors producing 4,384 pageviews, which is 43.4 percent of the pageviews the country dimension accounts for (10,095) from 21.5 percent of the visitors it accounts for (1,840).

5. `funnel_events` contradicts `lesson_progress` by a factor of 28. The funnel table holds 268 `lesson_completed` rows all time; `lesson_progress` holds 7,409 rows with a non-null `completed_at`. One of the two is not measuring what its name says, and `lesson_progress` is the one that reconciles with the published completion counts.

6. Logged-in `lesson_opened` lands on exactly 33 in three of the last four weeks (33, 60, 33, 33). Anonymous `lesson_opened` over the same weeks runs 174, 204, 424, 640. A constant repeating across non-adjacent weeks is an instrumentation artefact, not user behaviour.

7. Completions are extremely concentrated. Over the last 14 days, 1,298 completions came from 91 distinct users. The single most active account completed 182 of them, 14.0 percent, which is 13 lessons a day for 14 straight days and about 46 percent of the entire 394-lesson library. The top 5 accounts produced 408 (31.4 percent) and the top 10 produced 601 (46.3 percent). Team 7002 produced 421 (32.4 percent). Any "lesson completions" headline is really a headline about a handful of people.

8. Today, 2026-09-22, is already an outlier on the database side and has not finished: 308 completions from 25 distinct users and 13 signups, against a 28-day daily average of 82.4 completions and 6.8 signups. 2026-09-12 looked the same (312 completions, 26 users). Both are almost certainly one team working through material together in a session, not a traffic event, because neither day is a visitor spike (172 and 149 visitors, both near the daily average).

9. `/fact-check` has had 1 visitor in 17 days while 2 of 394 lessons carry a verification mark. The feature exists and is invisible.

10. `learnfrc.systemerr.com` appears as a referrer with 2 visitors in the week of 09-08. That is a third-party hostname containing the site's name, which is worth looking at directly, because it is the shape a mirror or a proxy makes.

11. The 2026-09-06 baseline reconciles cleanly. June (688 / 4,526), July (4,471 / 20,924) and August (3,025 / 13,368) return byte-identical numbers today. The only difference is September, which the baseline recorded as 752 visitors and 5,172 pageviews and which now reads 757 / 5,213 for the same 2026-09-01 to 2026-09-06 window, an increase of 5 visitors and 41 pageviews. The baseline was captured at 22:53 UTC on 09-06, so the extra hour of that day explains it. The 366-day rolling total moved from 8,936 / 43,990 to 11,164 / 56,520, and that also reconciles: 8,936 plus the 2,226 visitors recorded between 09-07 and 09-22 gives 11,162, two short of 11,164, which is within the live-accrual drift already noted. Nothing has fallen out of the rolling window yet because the first recorded visit is 2026-06-19.

Database growth since the baseline, for the permanent record: accounts 491 to 594 (+103 in 16 days) and completions 5,700 to 7,409 (+1,709). Both of those reproduce.

The third figure the first draft printed, "distinct plausible FRC teams 174 to 194 (+20)", was wrong at both ends and is withdrawn. 194 is the unfiltered distinct count of non-null `team_number`, and it includes 12119, 12345 and 99990, which are the exact values `isPlausibleTeamNumber` exists to exclude. `countDistinctTeams` from `src/lib/frc-team.ts` gives 191 on the same 594-row pull, and 196 on the 595-row pull taken for this correction, against 199 distinct non-null values. The 174 baseline is unfiltered too: `scripts-snapshot.js` line 62 is `new Set(teamRows.map((t) => t.team_number)).size` with no predicate, stored as `distinctFrcTeams`. So the honest statements today are 196 distinct plausible teams and 199 distinct non-null team numbers, and there is no like-for-like delta against the baseline until `scripts-snapshot.js` is changed to import the predicate and the baseline is recomputed. The 194 is a real number about something else entirely: it is the count of accounts with no plausible team number, and the two quantities landing on the same value is what hid the error. Fixing the snapshot script is a one-line change and is exactly the drift `src/lib/frc-team.ts` was written to prevent, so the script is the last place still doing it by hand.

One live example of why the bound matters at the other end: two accounts created today carry `team_number = 1`, which passes the 1 to 12,000 test and is plainly a placeholder. The bound catches typos above the range and nothing below it.

## What not to conclude

- Visitors are additive across days in this data but that is not a guarantee, it is an observation. Summing the `by=day` series for 2026-09-01 to 2026-09-21 gives exactly 2,831 visitors and 16,604 pageviews, and `visits/count` for the same window returns exactly 2,831 and 16,604. So Vercel is not deduplicating a person across days: someone visiting on five days counts five times in a weekly total. Read "visitors" as closer to visitor-days than to people.
- Visitors are definitively not additive across dimension values. The country rows for the last 14 days sum to 1,840 visitors against a window total of 1,977, and the device rows sum to the same 1,840. The referrer rows sum to 2,224, which is more than the total. Never compute a percentage of the window total from a dimension row; compute shares inside the dimension and say which dimension.
- Quote every traffic figure with its basis attached or it will be misused, including by whoever wrote it. Four numbers in the first draft of this file divided a deduped `visits/aggregate` row into a day-summed `visits/count` total, which is the exact error the bullet above warns about, and three of them were headline numbers: blog reach, direct share and the mobile-versus-desktop signup comparison, which came out backwards. The verification section lists all of them. A number from this report should be reused as "608 visitor-days, `visits/count`", never as "608 visitors".
- `accounts.google.com` is the site's own OAuth round trip, 91 visitors in the last 14 days. It is not a referral source and must never appear in a traffic-sources chart.
- Bing and cn.bing.com are one engine, as are duckduckgo.com and noai.duckduckgo.com. Splitting them under-reports search.
- The 100-row cap on `by=requestPath` collapses the tail into a literal `Others` row, 657 visitors and 2,796 pageviews in the last 14 days. The top-pages table is a top 100, not an inventory.
- A `visits/aggregate` call with a categorical `by` and `since` equal to `until` returns near-zero and looks like a real answer. It is not. Use a `by=day` series with a filter instead.
- Bounce rate is not in this report because it is not in the API. Pageviews per visitor is a different measure and is labelled as such.
- n is too small to mean anything in several places, and those places should not drive decisions. Three feedback rows, five content_edits rows, two verified lessons, 7 chatgpt.com visitors in a fortnight against 17 the fortnight before, 10 accounts from team 9427, and the 2 visitors from `learnfrc.systemerr.com` are all in that category. The 90-account post-redesign cohort is the smallest number here that is doing real work, and even there a 15.8 point activation gap at roughly 3 standard errors is suggestive rather than settled.
- The redesign comparison and the rolling-fortnight comparison genuinely disagree on visitors (+7.2 percent versus +20.8 percent) because the pre-redesign window contains a strong late-August stretch. Neither is wrong. Quote both or quote the rolling one and name the window.
- The 48-hour activation drop is a correlation with a date, not a proven effect of the redesign. Who was signing up changed at the same time: Chief Delphi fell from 9 signups to 4 and Direct rose from 21 to 37 across the two fortnights, and a redesign is not the only thing that happened in that window.
- `profiles.source` is self-reported and is null on 162 of 594 accounts, all of them pre-redesign, so the field was added partway through. Do not compare its distribution against a period before it existed.
- Nothing here can join a device or a country to a signup or a completion. `profiles` has no such column and Vercel's events dataset is empty. Any claim of that shape would be invented.

## Verification: the six claims that were fought over

Someone re-derived the numbers in this file independently and disputed six of them. All six were upheld against the report, which is worth stating plainly rather than burying: none of the disputed claims survived unchanged. The API reads and the database pulls underneath them were all correct. The arithmetic on top of them was not.

| claim | what this report first published | what the re-derivation gives | resolution |
|---|---|---|---|
| chiefdelphi-decay | 18, 19, 21, 12 visitors by week, now 1.1% of traffic | aggregate 18, 19, 21, 12; `visits/count` 31, 22, 23, 14; 1.3% on one basis | corrected to the count series. The aggregate row was quoted next to a `visits/count` engine series, then a deduped 12 was divided into a day-summed 1,054. The decline survives on both bases. The shape does not: it goes from a rise then a fall to a fall, a plateau, then a second fall. |
| direct-share | 1,342 visitors (67.9%), 8,939 pageviews (83.6%), 6.66 each | 1,445 (73.1%), 9,462 (88.5%), 6.55 each, all `visits/count` | corrected. The raw aggregate figures reproduce and the percentages do not. Direct is 5.2 points larger than published. The google.com contrast holds either way, 1.23 on aggregate and 1.22 on count. |
| blog-route-reach | `/blog/[slug]` drew 567 of 1,977 visitors, 28.7% | 608 of 1,977, 30.8%, both `visits/count` | corrected, and the opening paragraph restated. The 567 reproduces as an aggregate row; the 28.7% was that row over a day-summed total. |
| cn-spike-days | the four biggest pageview days are Chinese bursts, 09-05, 09-06, 09-12 and 09-19 | 09-05 is 1,071 of 1,757, 60.96%, exact; the four biggest complete days are 09-05, 09-12, 09-17 and 09-06 | corrected. The 09-05 arithmetic was right and the framing was wrong. 09-17 is the third biggest day with China at 96 of its 1,402 pageviews, and 09-19 is fifth, not fourth. It is now anomaly item 2. |
| mobile-share-rising | weekly share 21.1 / 21.6 / 23.4 / 26.4%; mobile 16.8% reaches /signup against desktop 17.7% | weekly shares confirmed exactly (165/184/216/278 over 782/854/923/1,054); mobile 83/494 = 16.80%, desktop 238/1,451 = 16.40% | corrected. The desktop denominator was the aggregate row (1,343) under a count numerator, so the published direction was backwards: mobile reaches /signup slightly more often, not less. The conclusion that mobile is not the leak stands. |
| db-growth-since-baseline | accounts 491 to 594, completions 5,700 to 7,409, distinct plausible FRC teams 174 to 194 (+20) | accounts and completions confirmed; `countDistinctTeams` gives 191 on the 594-row pull and 196 today, not 194 | corrected, and the +20 withdrawn rather than restated. 194 was the unfiltered distinct count of non-null `team_number` and includes 12119, 12345 and 99990. The 174 baseline is unfiltered too, so there is no like-for-like delta to publish yet. |

Five of the six are the same mistake, a deduped `visits/aggregate` row divided into a day-summed `visits/count` total. That mistake now has a rule in the preamble, a basis label on every traffic table, and a bullet in "what not to conclude". The sixth is a plausibility filter that was described in prose and not applied in code, which is the exact drift `src/lib/frc-team.ts` was written to make impossible, and `scripts-snapshot.js` is the last place still doing it by hand.

Two of the corrections make the site look better than the first draft said, not worse: direct is 5.2 points larger and blog reach is 2.1 points larger. One flips a direction. One withdraws a number entirely. That mix is the point of running the check.

## What this report did not answer

Ten questions were put to this file that it does not address anywhere above. Each is answered here from what the report already contains or from one cheap query, and where something cannot be answered cheaply that is said rather than guessed.

1. What personal data the admin panel exposes. It is already stripped, and this report should have said so instead of leaving it open. `profiles` does carry `full_name`, `signup_ip` and `hide_name`, and only 8 of 595 accounts set `hide_name`, but none of those three columns reach the panel. Every profile read behind `/admin` is an explicit allow-list: `src/lib/admin.ts` line 482 selects `id, username, team_number, xp, created_at` for recent signups, line 597 selects `id, username, team_number, xp, referred_by, source, created_at` for the paged totals, `src/lib/admin-team.ts` line 53 selects `id, username, team_number`, and the editor lookup at line 1006 selects `id, username`. People are named through `handleLabel()`, which prints `@username` or the word "member" plus six characters of an id. The feedback inbox stopped printing the sender's email. A grep for `full_name` and `signup_ip` across `src/app/admin/`, `src/components/admin/` and `src/lib/admin.ts` finds no reads at all, only comments explaining their removal. So there is nothing to strip there. What is worth auditing is where those columns still flow: `src/app/api/name-scan/route.ts` sends every profile's `full_name` to a moderation scan, `src/app/api/progress-scan/route.ts` reads `signup_ip`, `src/app/api/lifecycle-email/route.ts` puts `full_name` into email greetings, and a person's own settings, dashboard, profile and certificate pages render their own name.

2. The size of the pool you would recruit admins from. By `role` across 595 accounts: 576 student, 13 mentor, 3 other, 2 coach, 1 alum. Non-students are 19 people, 3.2 percent of the site, and mentors plus coaches are 15, 2.5 percent. All 190 accounts created in the last 28 days are students, and the most recent surviving non-student signup is 2026-08-05, which is 48 days ago. So if an application process is going in and it wants mentors, the applicant base is 15 people and it has not gained one in seven weeks. See item 9 for the two mentor accounts that appeared and disappeared tonight, which is the only movement in this number all month.

3. The 2026-09-17 pageview spike. Answered, and it is now anomaly item 2 instead of an unexplained hole under a China headline. Three route-filtered `by=day` calls put most of the day's 1,402 pageviews on `/guides/[department]/[module]/[lesson]` (586 pageviews on 66 visitors, against about 200 on a normal day at the same visitor count) and `/blog/[slug]` (170 on 40, against about 60 on 50-odd). China contributed 96 pageviews and the US 282, so it is not a country story at all. About 560 pageviews are still unattributed after those three routes. Closing that would take one `by=day` series per candidate route, because a single-day `by=requestPath` aggregate is one of the broken calls documented in the preamble.

4. Team 7002's runway, and what the headlines look like without them. One `lesson_progress` read filtered to the team's 64 user ids returns 842 completed rows all time across 241 distinct lessons, so 153 of the library's 394 lessons have never been touched by anyone on the team. 37 of the 64 accounts have ever completed a lesson and 27 never have. The median among the 37 active ones is 14 lessons and the team's heaviest account is at 159, which is below the site's top account at 182 in 14 days, so the single most active user on the site is not a 7002 member. With 7002 removed: last-fortnight signups go from 89 to 66 against 75 the fortnight before, so -11.9 percent becomes -12.0 percent and the signup story does not depend on them at all; last-fortnight completions go from 1,298 to 877, a 32.4 percent cut; visitor to signup goes from 4.50 to 3.34 percent; 28-day signups go from 190 to 141. The completions growth rate excluding them cannot be stated without one more query, because the previous fortnight's 7002 share was never measured. Supply is not the risk: the group has 153 lessons untouched and the median active member has seen 14 of 394. Attention is the risk, and item 10 turns that into an alert.

5. Fixing the instrument that would answer the next question. `funnel_events` captures 3.6 percent of completions and logged-in `lesson_opened` is pinned at exactly 33 in three separate weeks, so there is no way to see where the 47 solo accounts with a median of zero lessons stop. The concrete gap is that nothing in the database records a start. All 7,409 `lesson_progress` rows carry a non-null `completed_at`, so that table has one state and not two, and `funnel_events` is the only thing that ever tried to record an open. The fix is one table and one server action: write a row on lesson open using the user id from the server session rather than anything the client passes, key it on user id plus lesson id plus day so repeats are idempotent, index it on user id, and leave completions where they already work. Then "where do solo accounts stop" becomes a join across `profiles`, that table and `lesson_progress`, and it answers itself every week. Until that ships, no funnel number from this site should be quoted, including the ones in section 6.

6. A basis label on every figure. Done, and it was the right instinct, because labelling is what exposed four wrong numbers. The preamble now defines `visits/count` as day-summed and `visits/aggregate` as deduped inside the window, every traffic table says which one it is, "what not to conclude" carries the rule, and the verification section lists the four figures that broke it.

7. `referred_by`. 35 of 595 accounts carry a real referrer, 5.9 percent, and 7 of the last 89. Those 35 came from 10 distinct referrers and the distribution is 11, 5, 5, 3, 3, 3, 2, 1, 1, 1, so one account brought nearly a third of them and the top three brought 21 of 35. This is the only hard word-of-mouth evidence in the database, and it is a different measurement from the self-reported `source` field, where 10 of the last 89 answered "Referral" while only 7 actually have a `referred_by`. The feature works, almost nobody uses it, and the few who do are heavily concentrated, which is the usual shape just before a referral programme either gets promoted properly or gets removed.

8. A person-level conversion number. There isn't one and Vercel cannot produce one, and that needs saying before 4.50 percent gets quoted somewhere it matters. `visits/count` is day-summed, which this report's own check proves: summing the `by=day` series for 2026-09-01 to 2026-09-21 gives exactly 2,831, identical to a single `visits/count` call, so someone visiting on five days is counted five times. `visits/aggregate` deduplicates only inside one dimension's rows and sums to 1,840, which is not a person count either. So 4.50 percent is 89 accounts over 1,977 visitor-days, and the true per-person rate is higher by whatever the repeat-visit factor is, which is not retrievable from this API. Quote it as "per visitor-day" or not at all. A real number needs a first-party identifier, which the Vercel events dataset would support and which nothing writes, because nothing calls `track()`.

9. Automated signups. A profiles pull during verification returned 595 rows with `source` null on 162, the most recent of those dated 2026-08-10, so the report's claim that the null sources are all pre-redesign holds. A pull taken minutes earlier returned 597 rows and 164 nulls: the two extra accounts, created at 22:11:56 and 22:11:58 UTC on 2026-09-22 with team numbers 4414 and 1678 and the mentor role, were throwaway test accounts that the maintainer's own tooling created and deleted the same evening while testing the admin-application flow. They were never signups, and their removal was not a data-loss event; the mentor count going 15 to 13 between the two pulls is those two rows. (An earlier draft of this item treated them as an unexplained deletion. The person who ran the test is the person writing this correction.) For context on real pairs, there are 13 pairs of signups less than 10 seconds apart in all of history and 11 are benign, a single team registering together in one room (8056 three times inside a minute on 07-16, 6017 four times in 21 seconds on 09-01, 9427 on 09-18). One live pair from today remains: 19:38:22 and 19:38:24, both source Direct, team numbers 1099 and 1. Team 1 is a real FRC team, so that pair is not evidence of anything on its own.

10. A monitoring cadence. There is none for this report, and the one automated job that exists writes the wrong team number. `vercel.json` already runs `/api/snapshot` daily at 06:00 UTC and `/api/lifecycle-email` at 16:00, so the capture is automated; it is `scripts-snapshot.js` computing `distinctFrcTeams` without the plausibility predicate that needs fixing first, since that is how the 174 baseline got there. After that, re-read this file against the snapshot weekly and treat these as the lines that mean something, all stated on the `visits/count` basis so nobody has to argue about which number they are looking at:

   - non-China visitor-days below 700 in a complete week, against roughly 845 a week now
   - signups below 25 in each of two consecutive complete weeks, since one week of 31 is already normal in the run of 31, 70, 33, 56
   - rolling 90-account 48-hour activation below 30 percent, against 36.7 percent now
   - Bing ahead of Google by more than 20 percent for three consecutive weeks, which would mean the domain-authority problem is getting worse rather than holding
   - and the one that actually matters: zero completed `lesson_progress` rows from any of team 7002's 64 user ids for seven consecutive days, or fewer than 100 in a fortnight against 421 in the last one

   That last condition covers 32.4 percent of completions and 25.8 percent of 28-day signups, and nothing watches it today.

## Skills

- analytics: set the "every event should inform a decision" test, which is what exposed `funnel_events` as unusable (268 recorded completions against 7,409 real ones) rather than letting it be quoted as a funnel.
- customer-research: Mode 1, analysing existing assets. It is what made me count and segment the feedback table before reading it, which showed 3 rows and 36 days of silence, so the honest finding is a dead channel rather than three themes.
- churn-prevention: reframed to retention on a free product. Its activation-metric question drove the `last_seen_at` split, giving 24.9 percent seen in 7 days, 20.4 percent never seen again, and the cluster-versus-solo 7-day return gap of 54.1 against 23.4 percent.
- attribution: supplied the "every model is an opinion" and "the attribution gap is normal" framing that is why direct (73.1 percent on `visits/count`) is described as four populations rather than a channel, and why `accounts.google.com` is quarantined.
- cro: its traffic-context-first ordering is why section 4 leads with what search visitors actually land on before any page-quality judgement, which surfaced the blog-versus-lessons split, 296 search visitors against 186.
- onboarding: the time-to-value principle picked 48 hours as the activation boundary over "ever", which is the only comparison not biased by older cohorts having had more calendar time, and it is what made the 52.5 to 36.7 percent drop visible.
- signup: its "where do users drop off" framing produced the visitor to `/signup` to account chain in section 6, which is how the `/signup` denominator turned out to be bot-contaminated (US share of `/signup` visitors swinging from 80 to 28 percent week over week).
- ab-testing: applied only as statistical discipline, not as a test design. It is the source of the standard-error check on the 90-account post cohort and the refusal to call the 2.40x cluster ratio a change from the prior 2.5x.
- research: enforced primary sources, so every figure here comes from a live API call or a database read done today, and the two API behaviours in the preamble were re-probed rather than taken from the docs.
- discernment-nudge: applied to the report itself. It is why "what not to conclude" exists as a section and why the redesign comparison is presented as two disagreeing windows instead of one convenient number.
- ai-seo: the AI-traffic blind spot is why chatgpt.com, copilot.microsoft.com, gemini.google.com and perplexity were checked by name. The finding is 7 chatgpt.com visitors in the last fortnight against 17 before, which is a decline off a base too small to act on.
- seo-audit: its "why am I not ranking" framing produced the Bing-versus-Google parity check. Bing at 142 visitors against Google at 139 in the newest week is the same low-domain-authority signal as 2026-09-08 and it has not moved.
- content-strategy: the searchable-versus-shareable lens is what separated the 103 blog articles (296 search visitors across 59 pages) from the 394 lessons (186 across 92 pages) instead of reporting one "organic traffic" number.
- programmatic-seo: used as a thin-content diagnostic. 92 lesson pages drawing 186 search visitors is an average of 2.0 each, which is the distribution a templated library shows when individual pages have no independent search demand.
- site-architecture: the route-level rollup in section 4 (`/guides/[department]/[module]/[lesson]` at 800 against `/blog/[slug]` at 567, both `visits/aggregate`, with `/blog/[slug]` at 608 on `visits/count`) came from its hierarchy-over-pages view, which is a different and more useful answer than the literal-path table.

Raw data and scripts: `/private/tmp/claude-501/-Users-jahaan-Desktop-learnfrc/99c05c12-e43a-4096-8815-2248511a4520/scratchpad/`. Key numbers: `docs/analysis/2026-09-22-growth-review.json`.
