# LearnFRC notebook rebuild, how to pick this up

Everything needed to continue or undo this work, so no session has to
remember anything.

## Check state at any time

    ~/learnfrc-redesign/status.sh

Reads git and the workflow journal. Works from any session, including after
the one that launched the run is gone.

## The run

- Workflow run ID: `wf_3cbb5a14-863`
- Background task ID: `wlwj2azl7`
- Script: `~/learnfrc-redesign/rebuild.js`
- Journal: `~/.claude/projects/-Users-jahaan-Desktop-learnfrc/99c05c12-e43a-4096-8815-2248511a4520/subagents/workflows/wf_3cbb5a14-863/`
- 19 agents: 1 foundation, 2 chrome and shared, 11 page families, 5 audits

Resume WITHOUT redoing finished work, from a new session:

    Workflow({ scriptPath: '~/learnfrc-redesign/rebuild.js',
               resumeFromRunId: 'wf_3cbb5a14-863' })

Agents whose prompt is unchanged replay from cache, so only unfinished work
re-runs. Resume is same-session only, so from a fresh session the cache may
miss. In that case the safer move is NOT to relaunch the whole thing: run
`status.sh`, see which areas are incomplete, and rebuild only those.

Agents write straight to the working tree, so their output survives on disk
even if the run dies partway. Nothing is lost by the session ending.

## Undo, at any point

    cd ~/Desktop/learnfrc
    git checkout main                          # the old site, untouched
    git reset --hard pre-notebook-redesign     # if work ever lands on main

`pre-notebook-redesign` is tagged at `6361f08`, the exact commit currently
live on Vercel. `main` has never been touched by this work. All of it lives on
the `notebook-redesign` branch.

## What is being built

Every page rebuilt from scratch in the notebook design system, spec at
`docs/NOTEBOOK-SYSTEM.md`, visual reference at `~/learnfrc-redesign/d12.html`.
The old Arena Clay design is deleted, not aliased.

Frozen on purpose: routes and URLs, data fetching, server actions, auth gates,
Supabase queries, metadata, and everything in `src/lib`. Behaviour identical,
presentation entirely new.

## Gates that must pass before this ships

1. survivors: zero matches for `ac-*`, old fonts, old hexes
2. build: `npx tsc --noEmit` and `npm run build` both clean
3. a11y: real computed WCAG ratios on the six-colour palette
4. craft: no page still reading as a reskin
5. coverage: all 44 routes materially rebuilt, none skipped

## Still to do after the workflow finishes

- Drive the real site in Chrome and check the main flows
- Commit on `notebook-redesign` and push the branch, which gives a Vercel
  preview URL without touching production
- Only merge to `main` after Jahaan has seen it
