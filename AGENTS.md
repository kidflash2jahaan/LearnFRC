<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The native app depends on this site

The iPhone, iPad and Mac app in `apple/` reads the catalog tables (`departments`, `modules`, `lessons`, `articles`, `achievements`) straight from Supabase and does everything with rules through the `/api/app/*` routes in `src/app/api/app/`. Those routes and the website's own server actions and routes call the same shared functions in `src/lib/app/` (lesson completion, achievements, profile edits, sign-up and sign-in lookup, email consent, account deletion, guest migration, team sheet, leaderboards, public profiles, reference data).

- Change a rule in `src/lib/app/`, never in a route or action alone, so the site and the app can't drift.
- Changing a catalog column, a route's request or response, or anything `/api/app/reference` serves (glossary, paths, lesson bridge, start goals) can break the app already on people's devices. Keep `apple/docs/ARCHITECTURE.md` section 7 and `apple/docs/API.md` true: add fields rather than renaming or removing them.
