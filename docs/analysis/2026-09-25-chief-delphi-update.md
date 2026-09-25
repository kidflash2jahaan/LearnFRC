# The Chief Delphi thread, posts 243 to 246 (Sept 24 to 25, 2026)

Read from the print view of the thread on 2026-09-25 at 09:00. Companion to
`2026-09-22-growth-review.md` and `2026-09-22-next-steps.md`; this file changes
the ranking in the next-steps plan and says how.

## What was posted

- Post 243, the owner, Sept 24 8:59pm: verification has started, the admin
  application process is live, and a plan to record himself teaching lessons.
- Post 244, Vihaan_S, Sept 24 10:57pm, 16 likes: a screenshot of the homepage
  card with "built by one high-school student, working alone" crossed out and
  "17 Claude agents" written over it in red. No text. It is the most-liked post
  in this stretch of the thread and the second most-liked since launch.
- Post 245, TheKwabe, Sept 25 12:12am, 3 likes: quotes two commit messages from
  the public repo. The first (Sept 8, 22:12) explains why an unverified lesson
  should say "not fact-checked yet" out loud. The second (Sept 8, 23:00) removes
  that line. Asks why. Then quotes the Aug 20 articles commit, which lists the
  fabricated specs a second pass caught, as evidence the warning is needed.
  Posts the repo link.
- Post 246, RoboRainbowRaye (a mentor), Sept 25 2:16am, 4 likes: warns about
  storing personal data and the August security episode; recommends removing
  email subscriptions and digests entirely until past beta, with a legal
  warning in bold; likes the tools and asks whether the community could keep a
  peer-reviewed source for them; worries outdated FRC facts get fed into the
  models; suggests community-written, peer-reviewed lessons on GitHub for
  fast-changing topics; suggests pulling motor and component specs from WPILib
  rather than from a model; shows a screenshot of the "Student-Led,
  Mentor-Supported" section as an opinion stated as fact; suggests writing a
  topic list without AI and scoping an MVP; quotes the site's own "designing a
  robot that does too much" article back at the owner. Signed "respectfully and
  with kindness".

## What it did to the numbers

- Visitors (visits/aggregate by day): Sept 22 171, Sept 23 221, Sept 24 210,
  Sept 25 173 by 09:00. The Sept 23 peak came before any of these posts.
- chiefdelphi.com referrals: none on Sept 23 or 24, 7 visitors on Sept 25.
- Signups: Sept 24 3 (1 from Chief Delphi), Sept 25 7 (2 from Chief Delphi, 1
  from chatgpt.com, 4 from Bing). Completions held at 85 to 96 a day.
- Admin applications: 0. Lessons verified: 2 of 394. Feedback: 1 message.
- The GitHub repo (public) had 151 clones from 26 unique cloners in the last 14
  days against 17 page views. People are pulling the repo to read it, and the
  commit history is where TheKwabe's quotes came from.

So the posts have not moved traffic or signups either way. The damage is to
credibility with the audience that already doubted the site, and it lands on
one specific line and one specific decision.

## What is true in the criticism

1. The homepage says "built by one high-school student, working alone". Every
   human on the project is one student, but the site is drafted with AI and the
   repo's commit messages say so in detail (the Aug 20 articles commit, the
   Sept 6 rebuild cleanup, the Sept 8 verification commits). The line reads as
   a denial of something the repo admits. That is the whole content of the
   16-like post, and it is fair.
2. The "not fact-checked yet" line was removed on Sept 8 at the owner's request,
   the same evening the commit message arguing for it went in. TheKwabe's
   question is a direct one and the site's own reasoning answers it his way: on
   a catalogue where 392 of 394 lessons are unchecked, a mark that appears only
   on 2 pages tells a reader nothing about the other 392.
3. Email consent. 577 of 605 accounts are opted in, 96 of the 99 accounts since
   Sept 8 were enrolled by default, the settings page has no toggle, and
   `/api/lifecycle-email` runs every day at 16:00 UTC. The mentor's advice
   (stop sending until consent is real) is the same as next-steps action 4, now
   said in public with a legal warning attached.
4. Opinion stated as fact. "Mentors who do the work for students undermine the
   program's purpose" is close to FIRST's stated philosophy but is written as a
   verdict with no source. The verification pass has no rule for this today.
5. Specs from a model. Motor and component figures should come from WPILib
   docs and vendor pages, with the source linked, never from model memory. The
   Aug 20 commit itself lists five fabricated specs a second pass caught.
6. Scope. 153 of 394 lessons have never been opened by the team that uses the
   site most, blog posts out-pull the whole lesson library in search, and 2 of
   394 lessons are verified after 25 days. "Trying to do too much at once" is
   what the growth review's own numbers say.

## What is not supported

- That the posts are hurting growth. They aren't, on any number above.
- That the site should drop accounts and profiles. Cluster members (whole
  teams on one team number) complete lessons at 2.4 times the rate of solo
  readers; that mechanic needs accounts. The mentor's point is about how the
  data is handled, not whether it exists.
- That community peer review on GitHub would replace the work. `content_edits`
  holds 5 rows all time and none in 50 days; `feedback` holds 4. The intent is
  right, the demand is not there yet. The admin application process is the
  first step toward it and has 0 applicants after one day.

## How this changes the plan

The Sept 22 ranking put activation first. This moves three items to the front
because they are now public and cheap:

1. Pause `/api/lifecycle-email` today (one line in `vercel.json`, or an env kill
   switch), then ship the settings toggle and the opt-in default (next-steps
   action 4). Do not send another lifecycle email until both are live. Reply to
   the mentor only once that is done, with what changed.
2. Change the homepage line. Something true in the same register, for example:
   "one high-school student, a lot of AI drafting, and a public verification
   log". Say the same on `/about`. The site already says "Lessons are drafted
   with AI help and checked by hand" on `/apply`; the homepage should not say
   less than the apply page does.
3. Put the unverified state back on every lesson as a status line, not a badge:
   "not yet verified by a person; 2 of 394 done", linking to `/fact-check`. It
   restores the honesty the commit message argued for, and it turns the
   verification count into a public promise with a visible pace.

Then, in the verification work itself:

4. Two rules for the pass: (a) any number about a motor, gearbox, sensor or
   part must link the WPILib or vendor page it came from, or be removed; (b) any
   sentence that tells a team what they should do is either attributed ("FIRST's
   guidance is") or marked as the site's opinion.
5. Verify the most-read 60 lessons first and publish the queue on
   `/fact-check`, so "which lessons are checked" is answerable and the pace is
   visible. That is the MVP the mentor asked for, stated in the site's own
   terms.
6. On `/tools`, link the community calculators that already exist instead of
   rebuilding them, and say so on the page. It costs nothing and answers the
   "single peer-reviewed source" question the way the community would want.

And two things not to do:

- Do not answer the 16-like post. There is no text to answer, and any reply
  reads as defensive. The homepage change is the reply.
- Do not announce the teaching videos again until verification is past 60
  lessons. The activation problem in the growth review is not a lack of video,
  and a second public promise before the first one is visibly kept is the
  pattern the thread is reacting to.

## Commit messages, going forward

Commit bodies in this repo narrate the agent process ("a second agent whose job
was to refute it", "the rebuild agents left behind"). With the repo public and
being cloned 150 times a fortnight, that is where the "17 Claude agents" line
comes from. Two consistent options: say on the site what the commits say, or
write commit bodies about the change and put the process on one page (`/about`
or a `/how-this-is-made` page) that says it once, plainly. The first is the one
the thread is asking for. What does not work is the current split, where the
commits admit what the homepage denies.
