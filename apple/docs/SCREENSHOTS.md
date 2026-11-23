# App Store screenshots

`apple/scripts/app-store-screenshots.sh [iphone|ipad|all] [out folder]` makes them again for a new release: iPhone 6.9" (1320 x 2868, iPhone 17 Pro Max simulator) and iPad 13" (2064 x 2752, iPad Pro 13-inch (M5) simulator), six each, into `apple/.build/screenshots/` unless you name a folder.

It runs headless, without Simulator.app: a Debug build, `simctl` boots each simulator, sets the status bar to 9:41 with full battery and signal, installs the app fresh (a guest, no account), and launches it once per screen. The screens are picked with debug-only launch arguments (`LearnFRC/Core/Preview/ScreenshotScript.swift`; Release builds don't have them):

- `-LFShotLink <learnfrc:// link>` opens a link at launch. `simctl openurl` would stop at iOS's "Open in LearnFRC?" prompt.
- `-LFShotScroll <anchor>[@y]` scrolls a lesson or calculator to `lesson-quiz`, a heading's slug or `tool-field-<field>`, landing it `y` of the way down the screen (the top by default).
- `-LFShotQuiz 2,3` ticks those answers on the lesson's quiz, in question order.

The shot list is at the top of the script. Everything comes from the live site, so look at every PNG before uploading: no spinners, errors, empty states or keyboards, and no other people (leaderboards, team pages, profiles). Live classes are left out while `/api/app/classes` isn't on learnfrc.com.

The Mac isn't scripted: capturing a Mac window needs a visible window and Screen Recording permission. The same launch arguments work in the Mac app (Product > Scheme > Edit Scheme > Arguments). Size the window to 1440 x 900 points and capture it for 2880 x 1800.
