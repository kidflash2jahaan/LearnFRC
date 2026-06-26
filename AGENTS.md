<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Growth calendar triggers

The founder (Jahaan) keeps a growth calendar and will paste a short keyword — **"content batch"**, **"fall push"**, or **"kickoff"** — to kick off a play. When that happens:

**Always, for every trigger:**
- **Assess the current state fresh.** Don't rely on any saved plan/file. Pull live stats from Supabase (users, signups/day, completions, weekly activity) and look at what's already published (the articles in `src/lib/blog-data.ts` and the live site) to decide the specifics yourself.
- **Verify everything fully online.** Any generated content must have EVERY claim, spec, number, API/class name, and rule confirmed against official primary sources via web search (WPILib, REV, CTRE, PathPlanner, PhotonVision, Limelight, FRCDesign, FIRST, the game manual). Run a dedicated fact-check pass. There was a past accuracy problem ("AI slop" criticism) — do not repeat it.
- **No images/diagrams** in articles (the Markdown renderer has no rehype-raw; the founder also dislikes generated diagrams). Match the house style of existing articles, cross-link, end with a CTA, then insert into `src/lib/blog-data.ts`, build, and push.

**"content batch"** → Generate the next 6–8 SEO articles on the highest-value FRC search topics not yet covered (figure out the gaps yourself via the published set + fresh keyword research). Fact-check each online, then ship.

**"fall push"** → The fall growth campaign (school back, FRC audience active). Pull current stats first. Then DRAFT, in the founder's own plain voice (not AI-sounding, not spammy), for the founder to review and post themselves: a fresh Chief Delphi thread (new, not the old buried one), an r/FRC post, an FRC-Discord message, a "free curriculum for your rookies" team-outreach message, a re-engagement email to existing users (send via Resend only if approved), and a referral-loop nudge. Do not post anything autonomously.

**"kickoff"** → A new FRC game was just revealed. Research the new game fully online (official game manual + reveal) — assume zero prior knowledge, guess nothing. Then generate verified game-specific guides (strategy, mechanisms, scoring, build approach) and draft timely posts for CD / r/FRC / Discords while search interest peaks.
