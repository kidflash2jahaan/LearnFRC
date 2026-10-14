# LearnFRC for iPhone, iPad and Mac: architecture and contracts

This is the contract every part of the app is built against. If you're adding to the app, read it first.

## 1. Principles

1. **Always consistent with learnfrc.com** (owner, 2026-10-13). The app never keeps its own copy of the rules or the content:
   - Content (departments, modules, lessons, quizzes, articles, achievements) is read from the same Supabase tables as the site, cached on device for offline use, and refreshed when online.
   - Anything with rules (completing a lesson, XP, streaks and the weekly goal, achievements, profile edits, sign-up, username rules, email consent, account deletion) goes through `/api/app/*` routes on learnfrc.com. Those routes call the **same shared functions** as the website's server actions, so the two can't drift.
   - Reference data that lives in the site's TypeScript (glossary, learning paths, lesson-to-article links, start goals) comes from `GET /api/app/reference`, so editing it on the site updates the app with no app release.
   - Streaks, the weekly goal and its wording are computed by the server (UTC, `computeRhythm` + `rhythmCopy` in `src/lib/streaks.ts`) and shown as sent. The app never recomputes them in the device's timezone (guests excepted, see 6.4). Only the label changes: when the server's UTC "today" isn't the device's local date (a US evening), Home's week strip heads that cell "today" (a dot when the cell is too narrow) instead of a weekday letter, and its VoiceOver label names no weekday. The counts are still the server's.
   - Visual tokens come from the site's CSS (`src/app/globals.css`) through `apple/scripts/gen-tokens.py`, which writes `LearnFRC/Design/Tokens.generated.swift`.
2. **Native chrome, notebook content.** Navigation bars, tab bar, sidebar, toolbars, sheets and menus are standard SwiftUI (Liquid Glass on iOS/macOS 26+), tinted LearnFRC blue. Everything inside the content area uses the site's notebook look (paper grid, hand-drawn ink boxes, tape, hard offset shadows, Bricolage Grotesque / Space Mono / Caveat).
3. **One app, three devices.** iPhone: tab bar. iPad: sidebar (`TabView` with `.tabViewStyle(.sidebarAdaptable)`). Mac: sidebar (`NavigationSplitView`, section 6.6). iPad and Mac: keyboard shortcuts, menus, multiple windows. Every screen must work from compact iPhone width to a full-screen Mac window.
4. **Offline first.** The whole catalog (about 2 MB of lessons and quizzes, about 1.3 MB of articles) is cached. Reading, quizzes and guest progress work offline; completions made offline are queued and sent when the connection returns.
5. **Honest, no-guilt tone** (the site's rule): no countdowns, "don't lose your streak", or threat framing anywhere, including reminders and widgets.
6. **Privacy:** never request or show another person's `full_name`. Only the signed-in user's own full name is ever shown (on their certificate and settings).
7. **Swift 6, strict concurrency, @Observable, async/await.** Deployment targets iOS 26.0 and macOS 26.0. No packages beyond the three in `project.yml` (supabase-swift, swift-markdown, YouTubePlayerKit) without updating this file.

## 2. Folders and who owns them

| Folder | What lives there |
|---|---|
| `LearnFRC/App/` | App entry, the per-window navigation shell (`RootView`: tab bar or sidebar, username gate, profile setup step, links and Handoff for that window, the iPad window name), route table and screen names (`AppRouteDestination`, `AppRoute.screenTitle`). Owned by the integrator. |
| `LearnFRC/Design/` | The design system (section 3). |
| `LearnFRC/Core/Models/` | Codable models (section 4.1). |
| `LearnFRC/Core/Services/` | `AppConfig`, `SupabaseService`, `APIClient`, `CacheStore`, `Haptics` (section 4.2). |
| `LearnFRC/Core/Stores/` | `AppModel`, `CatalogStore`, `ProgressStore`, `AccountStore`, `ReferenceStore` (section 4.3). |
| `LearnFRC/Core/Preview/` | `PreviewData` sample content for SwiftUI previews. |
| `LearnFRC/Markdown/` | `LessonMarkdownView` renderer (section 5.1). |
| `LearnFRC/Features/<Name>/` | One folder per feature (section 5). A feature agent only edits its own folder. |
| `LearnFRC/Resources/` | `Assets.xcassets` (colors, app icon), `Fonts/`, `PrivacyInfo.xcprivacy` (section 6.9). |
| `Shared/` | Compiled into the app AND the widget extension: `AppGroup`, `WidgetSnapshot` (section 4.4). |
| `LearnFRCWidgets/` | The widget extension. |
| `scripts/` | `gen-tokens.py`, `xcode-mcp.py`. |
| Website `src/app/api/app/**`, `src/lib/app/**` | The routes the app calls (section 7). |

Rule: if you need something from another folder that doesn't exist yet, don't create it there. Write it in your own folder as a small private helper and note it in your summary so the integrator can promote it.

## 3. Design system (`LearnFRC/Design/`)

Source of truth: the site's `src/app/globals.css` and `docs/NOTEBOOK-SYSTEM.md`, translated in `marketing/lesson-videos/.claude-scratch/app-research/design.md`.

Public API (exact names; features rely on them):

```swift
enum LF {
  enum Palette {            // dynamic light/dark Colors
    static let paper, card, ink, graphite, blue, kraft, rule: Color
    static let blueButton: Color      // button fill (dark mode differs from link blue)
    static let onBlue: Color          // text on blue
    static let sidebarTint: Color     // the iPad sidebar tint only (white label on it keeps 4.5:1 in dark)
  }
  enum Fonts {              // bundled fonts, all scale with Dynamic Type via relativeTo:
    static func display(_ size: CGFloat, relativeTo: Font.TextStyle = .title) -> Font   // Bricolage Grotesque 800
    static func body(_ size: CGFloat = 17, weight: Font.Weight = .regular, relativeTo: Font.TextStyle = .body) -> Font // Bricolage Grotesque
    static func mono(_ size: CGFloat = 13, weight: Font.Weight = .regular, relativeTo: Font.TextStyle = .caption) -> Font // Space Mono
    static func note(_ size: CGFloat = 20, relativeTo: Font.TextStyle = .callout) -> Font // Caveat 600, margin notes only
  }
  enum Motion { static let hover, press, arrive, stamp, settle: Animation }  // the site's curves/durations; respect Reduce Motion
  enum Metrics { static let gutter: CGFloat = 16; static let stroke: CGFloat = 2; static let cardPadding: CGFloat }
}
struct HandShape: Shape              // the uneven hand-drawn rounded rect (--hand-a / --hand-s)
struct NotebookCard<Content: View>   // NotebookCard(tilt: .none/.left/.right, tape: Bool, lift: Bool) { content }
struct PaperBackground: View         // paper colour + 23px blue grid at 5.5%, scrolls with content
struct TapeStrip: View               // kraft tape at 0.82 opacity
struct StampView: View               // the "completed" stamp that lands with LF.Motion.stamp
struct InkButtonStyle: ButtonStyle   // .ink (primary, blue fill, hard offset shadow, presses down) / .ghost / .small
extension ButtonStyle where Self == InkButtonStyle { static var ink, inkGhost, inkSmall: InkButtonStyle }
struct TagView: View                 // TagView("you", on: true): a label; `on` is filled emphasis, never the Selected trait (a chip the reader picks: .toggleStyle(.tag), or put .isSelected on the Button that wraps it)
struct MeterView: View               // MeterView(value: 0...1, label:)
struct SlugText: View                // small Space Mono label ("settings / email")
struct MarkerText: View              // the blue Caveat margin note (drawn by PenOverhangRenderer, so the last strokes aren't clipped); always wraps (fixedSize vertically) and shrinks to 0.9 rather than lose a line
struct InitialsAvatar: View          // initials in a fixed circle; the initials stop growing at xxxLarge so they stay inside it
struct InkField: View                // label, field, hint or error; the box's drawn padding focuses the field (iOS gave those taps to the nearest button)
extension View {
  func notebookBox(radius: HandShape.Size = .a, shadow: LF.Shadow = .card) -> some View
  func paperBackground() -> some View
}
```

Rules: blue is the only accent; no status colours (success is ink + a check or the stamp, errors are ink with an ink rule). Hard offset shadows only (no blur shadows). Tilts and stamp motion turn off under Reduce Motion. Every text style supports Dynamic Type. Minimum tap target 44pt. A design gallery screen `DesignGalleryView` with previews of every component lives in this folder.

Dark mode: ships with the palette in the design notes (paper #121416, card #1C1F23, ink #E8EAE5, graphite #A2A8AC, blue #82A7FF, button #2648D7), defined in the asset catalog. Light values are generated from the site's CSS.

## 4. Core (`LearnFRC/Core/`)

### 4.1 Models (all `Codable, Hashable, Sendable, Identifiable` where they have an id)

Catalog, decoded straight from Supabase (snake_case keys mapped with CodingKeys):
- `Department { id: UUID, slug, name, tagline?, description?, difficulty?, estimatedHours?: Double, whatYoullLearn: [String], prerequisites: [String], tools: [String], sources: [SourceLink], icon: String, sortOrder: Int, modules: [Module] }`
- `Module { id, departmentID, slug, title, overview?, sortOrder: Int, isPrerequisite: Bool, lessons: [LessonSummary] }`, sorted prerequisite-first then `sortOrder` (the site's `sortModules`).
- `LessonSummary { id, moduleID, slug, title, summary?, estimatedMinutes: Int, sortOrder: Int, youtubeID? }`
- `LessonBody { id, content: String, keyTakeaways: [String], resources: [SourceLink], quiz: [QuizQuestion], verifiedAt: Date?, verifiedBy?, verifiedNote?, verifiedSources: [String]?, youtubeID? }`
- `QuizQuestion { question: String, options: [String], answer: Int, explanation: String }`
- `SourceLink { title: String, url: URL }`
- `Article { id, slug, title, description, keywords: [String], date: String /* YYYY-MM-DD */, readMins: Int, content: String, sortOrder: Int }`
- `Achievement { id, slug, name, description, icon: String /* lucide name */, criteria: AchievementCriteria, sortOrder }`
- `LessonLocation { department: Department, module: Module, lesson: LessonSummary }` with `webURL` = `https://learnfrc.com/guides/{dept}/{module}/{lesson}`.

From `/api/app/*` (camelCase JSON, see section 7): `Me`, `Profile`, `ProgressSnapshot`, `Completion`, `Bookmark`, `EarnedAchievement`, `Rhythm`, `DayCell`, `RhythmCopy`, `NextUnlock`, `CompletionResult`, `Reference` (`GlossaryTerm`, `LearningPath`, `StartGoal`), `LeaderboardPayload`, `LeaderboardEntry`, `TeamPayload`, `PublicProfile`, `APIErrorBody`.

### 4.2 Services
- `AppConfig`: `supabaseURL = https://pkhksadvllasuhonurcv.supabase.co`, `supabasePublishableKey` (the site's `NEXT_PUBLIC_SUPABASE_ANON_KEY`, a public `sb_publishable_` key, read from `.env.local` when generating `AppConfig+Keys.swift`; never the service-role key), `apiBase = https://learnfrc.com` (in Debug builds only, the launch argument `-LFAPIBase http://localhost:3000` overrides it for testing against `next dev`; Release builds ignore it so nothing can send tokens to another host), `webBase = https://learnfrc.com`.
- `SupabaseService` (actor-safe wrapper): one `SupabaseClient`; auth session in the Keychain (supabase-swift default); `catalog()` fetches departments+modules+lesson summaries in one embedded select; `lessonBodies()` fetches all lesson bodies (one request, under the 1000-row cap); `articles()`; `achievements()`; bookmark insert/delete/list for the signed-in user (direct, RLS `bm_*_own`). Never writes `lesson_progress` or `user_achievements` directly.
- `APIClient`: calls `/api/app/*` with `Authorization: Bearer <access token>` from the current session (refreshes first if expired), decodes `APIErrorBody` into `APIError` (`.unauthorized`, `.rateLimited(retryAfter:)`, `.validation(message)`, `.network`, `.server`). `.unauthorized` only comes from a call made with a session; a 401 from the sign-in or sign-up route is `.validation` with the site's sentence ("Invalid login credentials", "No account found with that username.").
- `CacheStore`: JSON files in Application Support (`catalog.json`, `lessons.json`, `articles.json`, `reference.json`, `progress.json`, `queue.json`, `me.json`); atomic writes through the actor; reads decode in parallel off the actor (`load` is `@concurrent nonisolated`); each file wrapped in an envelope with its own `fetchedAt`, so the app never reads file timestamps. `removePersonalFiles()` (sign-out, deletion) removes `me.json` and the community caches in `Caches/LearnFRC/Community` (team sheets name teammates); `progress.json`/`queue.json` keep only guest progress and writes queued for an account, which `ProgressStore` has already scrubbed.
- `Haptics`: `success()`, `select()`, `warning()` (no-op on Mac).

### 4.3 Stores (`@Observable @MainActor` classes; injected with `.environment(...)`)
- `AppModel`: owns the stores below. `loadCache()` loads the on-device cache and restores the session (no network, shared by every caller; `isCacheLoaded` once done); `bootstrap()` runs it, then refreshes whatever is stale in the background; `waitForAccountRestore()` waits for the cache and the stored session (never the network). `activeNavigation` is the `WindowNavigation` of the window in use (a stand-in while no window is open, `hasWindow` false); `selectedTab`, `paths`, `path(for:)`, `push`, `open`, `popToRoot`, `showLesson`, `goBack`, `visibleLessonID` act on it (section 6.6), and on the Mac `open`, links and search requests bring that window forward or open one (`revealActiveWindow()`). `openDeepLink`/`follow`/`followWhenReady`/`requestSearch` route links (section 6.7), and `showSettings()` opens Settings for a link or the system (the Settings window on the Mac, section 6.6); `handle(userActivity:)` continues Handoff (section 6.8).
- `WindowNavigation`: one window's selected tab, a stack per tab and a waiting search request; owned by `RootView`, injected with `.environment(navigation)` and `.focusedSceneValue(\.learnFRCNavigation, navigation)`, restored with `@SceneStorage`. Each stack binds through the key path `[stack: tab]`. `isShowing(_:in:)` and `holds(_:in:)` tell a screen whether it's the one on show (with `\.navigationTab`, the tab whose stack a screen sits in); `memory` (`ScreenMemory`) keeps what a screen should come back with when the Mac rebuilds its stack (section 6.6); `showsStacks` is false while the username gate has the window, so the stacks being taken down don't empty their tabs (section 6.2).
- `CatalogStore`: `departments: [Department]`, `articles: [Article]`, `achievements: [Achievement]`, `lessonBody(_ id: UUID) -> LessonBody?`, `location(of lessonID: UUID) -> LessonLocation?`, `nextLesson(after:)`, `previousLesson(before:)`, `lessons(in department:)`, `allLessons: [LessonLocation]`, `isLoaded`, `refresh() async`, `lastUpdated`.
- `ReferenceStore`: `glossary: [GlossaryTerm]`, `paths: [LearningPath]`, `startGoals`, `relatedArticles(for lessonID) -> [Article]`, `term(slug:)`, `refresh() async`.
- `AccountStore` (a `/me` reply that lands after sign-out, or for another account, is dropped: it can't sign the app back in or rewrite `me.json`; validation copy is the site's sentences, `signUpUsernameRule`, `usernameRule`, `passwordRule`, `teamNumberRule`): `state: .loading | .guest | .signedIn(Me)`; `signIn(identifier:password:)`, `signUp(...) -> SignUpOutcome`, `signOut()`, `deleteAccount()`, `refreshMe()`, `updateProfile(...)`, `setupUsername(...)`, `setEmailOptIn(_:)`, `resetPassword(email:)`, `changePassword(_:)`, `resendConfirmation(email:)`; `needsUsernameSetup`, `hasFreshMe` (`/me` read from the site in this run, not just restored from the device), `profileSetupAsk` (`.ownUsername` or `.teamNumber`, with `asksForOwnUsername` and `asksForTeamNumber`), `skipProfileSetup()` and `setupTeamNumber(_:)` (section 6.2), `emailPrompt`. The other stores hear about a sign-in before `/me` is re-read, so progress (and moving a guest's lessons in) runs alongside it.
- `ProgressStore`: `completedLessonIDs: Set<UUID>`, `bookmarkedLessonIDs: Set<UUID>`, `rhythm: Rhythm?`, `rhythmCopy: RhythmCopy?`, `xp`, `level`, `nextUnlock`, `earnedAchievements`; `isCompleted(_:)`, `isBookmarked(_:)`, `complete(lessonID:answers:) async throws -> CompletionResult` (signed in: server; guest: `/api/guest-progress` with the app's visitor id; offline: queued), `uncomplete(lessonID:)`, `toggleBookmark(_:) async`, `refresh() async`, `flushQueue() async`, `migrateGuestProgress() async` (after sign-in), `departmentProgress(_ dept) -> (done: Int, total: Int)`, `continueLesson: LessonLocation?` (the next unfinished lesson after the most recent completion, else the first lesson of Getting Started), `certificates: [Department]` (fully completed departments), `progressRevision` (goes up when this device changes the account's progress on the server: a confirmed completion or un-completion, or guest lessons moved in at sign-in; screens showing totals from other routes, like the team sheet, reload on it), `isMovingGuestLessons` / `movingGuestLessonIDs` (section 6.4), `knowsAccountTotals` (false while a signed-in account's own progress hasn't been read on this device yet, section 6.4). Writes `WidgetSnapshot` after every change, except while `knowsAccountTotals` is false: the widgets keep what they showed rather than a total smaller than the account's.

### 4.4 Shared with widgets (`Shared/`)
`WidgetSnapshot { generatedAt, continueLesson: { id, title, departmentName, moduleTitle, minutes }?, rhythm: { goal, windowCount, windowLabel, currentStreak, days: [{label, count, isToday, isFuture}] }?, xp, level, completedTotal, signedIn: Bool }` written as JSON to the App Group container (`snapshot.json`) by `ProgressStore`, read by the widgets; `WidgetCenter.shared.reloadAllTimelines()` after writing. Includes `WidgetSnapshot.sample` for previews and Mac builds without an app group.

### 4.5 Previews
`PreviewData` provides a small realistic catalog (two departments, a lesson with code, a table and a blockquote callout, a 3-question quiz), a signed-in `Me`, a `Rhythm` in each phase, and an `AppModel.preview` wired to them, so every view previews without the network.

## 5. Features (`LearnFRC/Features/`)

Each feature exposes the root views named here; the shell (`LearnFRC/App/`) wires them into tabs and navigation. Navigation uses a typed `AppRoute` (defined in Core):
`enum AppRoute: Hashable, Codable { case department(UUID), module(UUID), lesson(UUID), article(String), glossaryTerm(String), path(String), profile(String), team, leaderboard, settings, certificate(UUID), videos, achievements, bookmarks }`. `AppRoute.glossaryIndex` is `.glossaryTerm("")` (the catalogue). The tabs are Home, Guides (`AppTab.learn`, named like the website's navigation), Community, You, and Search (the search-role tab).
Every feature registers its destinations with `.navigationDestination(for: AppRoute.self)` through `AppRouteDestination` in the shell, which switches over the route and returns the feature views below.

| Folder | Root views | Notes |
|---|---|---|
| `Home/` | `HomeView` | Continue card, weekly goal (server `rhythm` + `rhythmCopy`, seven-day strip, never threat copy), next unlock, team snippet (reloads when `progressRevision` changes), bookmarks shelf (up to three, then "See all" to `.bookmarks`), recent articles, the one-time "Want reminder emails?" card when `emailPrompt` (same copy as the site), guest call to action. Home has no text field, so it ignores the keyboard safe area. The tally notes "N moving in" and "catching up" while a guest's lessons move into the account (section 6.4). |
| `Learn/` | `LearnView`, `DepartmentView`, `ModuleView`, `PathView`, `VideosView`, `ArticlesView`, `ArticleView` | Department grid with progress meters and SF Symbols; department detail (what you'll learn, prerequisites, modules, certificate state); paths; video library (lessons with `youtubeID`); articles list and reader (uses `LessonMarkdownView`). `LearnScrollPage` pages ignore the keyboard safe area unless they pass `avoidsKeyboard` (only `ArticlesView`, which has a search field). |
| `Lesson/` | `LessonView` | Header (department/module crumb, minutes, verified badge), video facade (thumbnail first, YouTubePlayerKit on tap, never autoplay or background), markdown body, key takeaways, resources (open in the browser), quiz, completion, next/previous, bookmark, share, read aloud (`AVSpeechSynthesizer`), Handoff (`NSUserActivity` type `com.learnfrc.app.lesson` with `webpageURL`). The page's layout (gutter, one or two columns) is read from a `GeometryReader` while it's laid out, never measured into `@State`: a width that arrived late reflowed the text in the same frame and SwiftUI dropped a scroll-geometry update ("OnScrollGeometryChange tried to update multiple times per frame"). |
| `Lesson/Quiz/` | `QuizView` | Same rules as the site: every question must be correct; a correct answer stays locked in on retry; the explanation appears after the same question is missed twice; the correct option is never revealed. Submitting calls `ProgressStore.complete` (server re-grades). Success: stamp + haptic + the real XP from the response. |
| `Markdown/` (top level) | `LessonMarkdownView(markdown:glossary:onOpen:)` | See 5.1. |
| `Search/` | `SearchView`, `GlossaryView`, `GlossaryTermView` | Instant on-device search over lessons, articles and glossary, tolerant of small typos (a word of 5+ letters found nowhere is matched against title, alias and summary words with one edit, two from 8 letters; those matches only stand in for a word nothing matched exactly); glossary list by category and term detail. Width rules (columns, side-by-side headings) are decided during layout (`searchPage()`, `SearchAdaptiveGrid`, `SearchWidthSwitch`), never from a width stored in `@State`: a stored width fed back into layout and froze the iPad Pro. |
| `Account/` | `SignInView`, `SignUpView`, `UsernameSetupView`, `SettingsView`, `ProfileView`, `BookmarksView` | Email-or-username + password; sign up with username, optional team number and the unticked reminder-email box (same copy as the site); username gate; settings (profile edit, team number, role, reminder emails switch, on-device reminders, appearance, change password, sign out, delete account with confirmation); my profile (XP, level, tier, badges, certificates); the reading list (`BookmarksView`, like learnfrc.com/bookmarks, for accounts and for a guest's bookmarks on this device). On the Mac, Settings is its own window with four panes (Account, Profile, Reminders, Appearance), and every link to Settings is `AccountSettingsLink` (`SettingsLink` on the Mac, a push to `.settings` on iPhone and iPad), so it never opens a second copy in the main window. Pages without text fields (You, Bookmarks) pass `AccountPage(avoidsKeyboard: false)`, so they ignore the keyboard safe area. `AccountPage` hands its content half the column width at the accessibility sizes, so every two-column account page stacks; the width is only for choosing columns. A text button beside a field grows its 44pt target away from it (`AccountTextButtonStyle(reach:)`: `.up` in a label row, `.down` under a field), and a field's drawn padding focuses the field (`AccountField`, like `InkField`). The You page and Settings present sign-in with `authSheet(item:)`, which closes for outside navigation (section 6.7). Just after sign-in, while `isMovingGuestLessons` is true, the member card and the spec sheet say "moving N guest lessons in" instead of presenting XP and the level as final (section 6.4). |
| `Community/` | `LeaderboardView`, `TeamView`, `PublicProfileView`, `AchievementsView`, `CertificateView` | Weekly / all-time / team boards; my team's progress (members' department strips, same as the site; reloads when `progressRevision` changes); public profiles; the badges gallery (`AchievementsView`; on screen it's always "Badges", like the site); certificate rendered with `ImageRenderer` and shared. Team sheets name teammates, so they leave with the account: the files with `CacheStore.removePersonalFiles()`, this session's copies with `CommunityCache.forgetTeams()` (`AppModel`, on `.guest` and `.deleted`). Ruled tables (leaderboards, team roster) switch to stacked rows at the accessibility sizes, and from xxxLarge on phone-width columns (`CommunityTableStyle`). `CommunityLayout.isWide` is false at the accessibility sizes, so the Leaderboard, Team and Profile mastheads stay one column. Every community page ignores the keyboard safe area (`CommunityPage`). |
| `System/` | `AppIntents`, `SpotlightIndexer`, `ReminderScheduler`, `AppCommands`, `DeepLinks`, `SystemServices` | App Shortcuts ("Continue my lesson", "Open a lesson", "How many lessons this week"), Spotlight `IndexedEntity` for lessons and glossary terms, opt-in local reminders (no-guilt copy, at most one a day, user picks the time), keyboard shortcuts and Mac menus (section 6.6), the one link parser (section 6.7). Intents answer from the cached catalog (`AppModel.loadCache()`) and leave the network refresh to run in the background; they only wait on the network when nothing was ever cached. |

### 5.1 Markdown renderer
Built on swift-markdown (cmark-gfm). Must handle what lessons and articles actually use: `##`/`###` headings, paragraphs with bold/italic/inline code/links, ordered and unordered lists (nested), fenced code (java, python, bash, json, plain) with syntax highlighting in Space Mono on a card, GFM tables (scroll horizontally on narrow widths), blockquotes (a blockquote starting with bold text is a callout box), thematic breaks. Links: `https://learnfrc.com/guides/...` and `/blog/...` open the matching app screen via `onOpen(AppRoute)`; other links open the browser. Glossary auto-links: the first mention of up to 4 glossary terms per document becomes a tappable term (popover on iPad/Mac, sheet on iPhone), matching the site's `src/lib/glossary-link.ts` rules. Text is selectable. Dynamic Type throughout.

## 6. Behaviour details

### 6.1 Auth
Sign in with email or username + password: username sign-in goes through `POST /api/app/auth/sign-in` (returns a session the app installs with `auth.setSession`); email sign-in can call Supabase directly. Sign up through `POST /api/app/auth/sign-up` (site rules: ban list, profanity, username, team number, email consent); the confirmation email opens learnfrc.com, then the person signs in in the app. Password reset is emailed and finished on the website. Google and Apple sign-in are later (App Store rule 4.8: offering Google requires Sign in with Apple).

### 6.2 Username gate and profile setup step
Like the site's dashboard (`getProfileSetupState` in `src/lib/onboarding-server.ts`), three cases:
- **No username at all** (`Me.needsUsernameSetup`): a hard stop. `UsernameSetupView()` (in `UsernameGateScreen`) takes the window until a handle is saved; it can sign out, nothing else. It goes by the `/me` on hand, cached or fresh, so it holds from the first frame and offline. Nothing else in the window works, by touch, keyboard, menu or VoiceOver:
  - iPhone and iPad: the gate takes the tab view's place. Laid over the tab view instead, with the tab view `accessibilityHidden` and even at no opacity, UIKit's tab bar, the sidebar and the screen underneath stayed in the accessibility tree.
  - Mac: the gate takes the detail column in place of the tab's stack, and the sidebar stays in view but goes nowhere (disabled, and its selection ignored). The window's toolbar sits above anything drawn over the content, so a gate laid over the stack left the covered screen's toolbar (a lesson's Save, Share and More, Search's field) usable. Hiding the sidebar instead was saved by AppKit with the window, so the next launch opened with it collapsed.
  - Each tab's place survives the gate: it lives in `WindowNavigation`, which ignores what the stacks write back as they're taken down (`showsStacks`), and the stacks are built from it again once a handle is saved.
  - The Go and Lesson menus, and Settings… on iPad, are off while it's up (`AppCommands`), and the Mac Settings window shows the gate instead of Settings.
  - A search request that arrives meanwhile waits for it (section 6.7). A link, notification tap or App Intent still moves the window underneath, so the screen asked for is there once the handle is saved.
- **A machine-made placeholder** (`Me.isPlaceholderUsername`, like `cosmic_builder_77`; the server sets `needsUsernameSetup` false for these): the site's skippable dashboard card in username mode (`profile-setup-form.tsx`). `AccountStore.profileSetupAsk` is `.ownUsername`, and `RootView` presents `UsernameSetupView(mode: .soft, onSkip:)` in its own `NavigationStack` (titled "Your username") as a sheet once the sign-in sheet has closed. It's the card alone, word for word ("You're showing up under a name you didn't pick."), with Username prefilled with the site's `suggestUsername(email)` (never the placeholder), "Team #, optional", "Save it" and "Skip for now". Saving goes through `POST /api/app/profile/setup`, the same function as the site's card. Saving a new handle without a team number turns the card into the team ask in place, as the site's card does after a save.
- The Team # box starts blank in every mode, like the site's card, even when the account already has a team.
- **A handle of the person's own and no team number**: the same card in team mode, the narrower ask. `profileSetupAsk` is `.teamNumber` (`asksForTeamNumber`), and `RootView` presents `UsernameSetupView(mode: .team, onSkip:)` the same way as the placeholder ask (titled "Your team number": "profile / no team number", "Add your team number.", a required "Team #"). It saves with `AccountStore.setupTeamNumber(_:)`, which sends only `teamNumber` to `POST /api/app/profile/setup`.

Both soft asks:
- They wait until `/me` has been read from the site in this run (`AccountStore.hasFreshMe`). The copy restored at launch can still carry a placeholder handle or a missing team number the person has since fixed on learnfrc.com, and offline the step would have stayed up offering to rename an account that already chose its name.
- Skipping either, or closing the sheet by hand, keeps both away for 14 days for that account on this device (`AccountStore.skipProfileSetup()`, like the site's one `lf_setup_skipped` cookie for both modes and its `SETUP_SKIP_MAX_AGE`, kept in `UserDefaults`). Saving closes the step, since the account no longer asks.
- Anything that moves the window while the step is up closes it without counting as a skip: a link, Handoff, a notification tap, a Spotlight result, an App Intent, a menu command or a search request (`closesOnNavigation`, section 6.7). It asks again on the next launch.

### 6.3 Completion
Signed in and online: `POST /api/app/progress/complete`. Offline: queued with the answers; sent on reconnect; the lesson shows "saved, will sync" until confirmed. The server is the authority for XP and achievements.

### 6.4 Guests
No account needed to read or take quizzes. Guest completions go to `POST /api/guest-progress` with an app-generated visitor id stored in the Keychain (the site's existing guest system, with its own quiz check). Guests see a locally computed weekly strip (same rules as `computeRhythm`, labelled as on this device). After sign-in or sign-up, `POST /api/app/migrate-guest { visitorId }` moves it to the account (the site's existing migration logic). The move starts as soon as the account appears and skips reading the account's progress first, so the totals from before the move never show on their own. From that moment the guest lessons are counted in the account's lessons (as pending, `ProgressStore.movingGuestLessonIDs`) and `isMovingGuestLessons` is true, so a screen can say so while XP and badges, which only the server computes (streak bonuses included), catch up: the You page's member card and spec sheet print "moving N guest lessons in", and Home's tally notes "N moving in" and "catching up". When the move fails the lessons stay on the device and are tried again at the next sign-in.

Until the account's own progress has been read (`ProgressStore.knowsAccountTotals` false, right after a sign-in), the lessons counted are only what this device knows: the guest lessons moving in and any queued completions, fewer than the account really has. A screen showing the account's lesson total marks it as still coming rather than printing it as final, and the widgets keep what they last showed.

### 6.5 Sync
Refresh `me/progress` on launch, on returning to the foreground, after every write, and on pull-to-refresh. Catalog and reference refresh on launch if older than 6 hours, and on pull-to-refresh.

Launch order: the cache first (`AppModel.loadCache()`: catalog, glossary and progress decode in parallel; `catalog.json` is applied the moment it's read, so links and lesson headers resolve while the 2 MB of lesson bodies finish), then the search index and the stale-only network refresh side by side. A lesson opened on a cold launch waits for the cached bodies instead of fetching its own. Nothing on screen waits for the network when there's a cache.

### 6.6 Windows and navigation
Every window (iPad windows, Mac ⌘N) has its own `WindowNavigation`, owned by its `RootView` and restored with `@SceneStorage("window.navigation")`; the tab selection and each tab's `NavigationStack` bind to it. **What `WindowNavigation` holds is what the window shows**: Back, the Lesson menu, links and the saved window state all act on it, so a tab's stack is always built from that tab's path and only writes back through it.

The shell differs by platform, because the Mac's `TabView` can't keep that promise:
- **iPhone and iPad**: `TabView(.sidebarAdaptable)`. Every tab keeps its stack alive, so a screen opened in a tab that isn't showing is there when the tab is selected.
- **Mac**: `NavigationSplitView` with a sidebar `List` (Home, Guides, Community, You, Search) bound to `selectedTab`, and only the selected tab's stack in the detail column, rebuilt from its path (`.id(selectedTab)`) on every tab change. On macOS, `TabView(.sidebarAdaptable)` takes the old tab's stack down on a switch and then loses track: a screen opened in another tab never appeared, a tab came back at its root, and later pushes landed in another tab's stack, while `paths` still held the screens (reproduced in a 60-line app, so it isn't ours to fix inside the `TabView`). `SidebarCommands` adds View > Show Sidebar (⌃⌘S).
- **Why the Mac rebuilds instead of keeping every tab alive**: keeping each visited tab's stack in the detail column and hiding all but the selected one was tried (a probe app, `opacity(0)` and `hidden()` plus `disabled`). Hidden stacks still add their toolbar items, their `.searchable` field and their `navigationTitle` to the window: with Home selected the toolbar carried Search's field and the hidden tab's buttons, and the title named another tab. Toolbar items can't be withheld from outside the screens that declare them, so the rebuild stays. What a screen should come back with goes in the window's `WindowNavigation.memory` (`ScreenMemory`, per window, for this run only, never observed so nothing measured can feed back into layout): Search keeps the words being typed and the glossary its search and category (forgotten once it's gone back from). The lesson keeps its quiz (`QuizView.Remembered`: the answer sheet, the completion shown on the card, the milestone) under `"quiz/<tab>/<lesson id>"`, only for the same questions, and its scroll position under `"lesson.scroll/<tab>/<lesson id>"` (keyed by tab, so the same lesson open in Guides and Home keeps two places and going back in one never wipes the other); a rebuilt page scrolls back there once, without animation, through a marker beside the sheet (`LessonResumeAnchor`). Both are forgotten once the lesson is gone back from (no longer in that tab's stack, `holds(_:in:)`) or moved on from in place, so the next visit starts at the top with a fresh quiz, as before. A playing video and read-aloud stop on a switch; nothing plays out of sight.
- `WindowNavigation[stack: tab]` (bound through its key path, `$navigation[stack: tab]`, so the binding is the same on every redraw) takes writes only from the selected tab's stack, and none while the username gate has the window (`showsStacks`), and ignores a stack handing back the path it already has. A stack being taken down (another tab selected, or the gate taking the window) pops itself to its root on the way out; that isn't the person going back, so it mustn't empty the tab. A closure `Binding(get:set:)` was new on every redraw, and a stack built and redrawn in the same frame (every window appearing) logged SwiftUI's "bound path tried to update multiple times per frame". Code that navigates sets `paths` directly (`push`, `open`, `show`, skipping assignments that change nothing) and isn't affected.
- A lesson that moves in place (its own next and previous, the Lesson menu) swaps the top `.lesson` entry of the selected tab's path as it moves (`showLesson(_:replacing:)`, without animation), so the path names the lesson on screen: a rebuilt Mac stack, Back, the saved window state and the Lesson menu (`visibleLessonID`) never bring back the lesson the screen opened on. The lesson screen never moves itself: its next and previous call `showLesson(_:replacing:)` (only while it's the screen on show) and it follows its `lessonID`. A changed `lessonID` always shows that lesson. One missing from the catalogue shows "not found" and, while online, fetches the catalogue once for it (not when it was fetched in the last 2 minutes); if the new catalogue has it, the lesson appears by itself.
- Every screen but the lesson is tied to its route (`AppRouteDestination` puts `.id(route)` on it). When a link replaces the top of a stack with a route of the same kind (`learnfrc://u/a`, then `u/b`), `NavigationStack` reuses the screen at that depth, `@State` and all; the profile page showed a's record under b's name. Lessons are left out on purpose: they move in place (above). Besides `.id(route)`, screens that load by id or handle keep their loaded state keyed to it (`PublicProfileView`'s `stateHandle`, `CertificateView`'s rendered files, `LearnModuleLog`'s open modules), so a reused view never shows the previous item.
- iPhone and iPad keep hidden tabs, and screens under a pushed one, alive, and those still publish focused values and Handoff activities. So nothing speaks for the window unless it is the one on show: each tab's stack carries `\.navigationTab` (set on the stack and again on every pushed destination by `appRouteDestinations(tab:)`), and a screen checks `WindowNavigation.isShowing(route, in: tab)` (the lesson does for its Handoff activity); the Lesson menu reads the path itself.

A window becomes `AppModel.activeNavigation` when it becomes the key window (`appearsActive`, plus a `UIWindow.didBecomeKeyNotification` observer for iPad windows side by side) and when it receives a link, a Handoff or a Spotlight result. Only a `RootView` activates, with its own navigation (menu commands pass the focused window's, which `RootView` published). The first window takes over anything an App Intent navigated before it existed; when a window closes, navigation falls back to the one used before it, or to a stand-in that the next window takes over.

Mac, navigation that starts outside a main window (a link in the Settings window, a Go command while the Settings window is key, an App Intent): `AppModel.open`, links and search requests call `revealActiveWindow()`, which brings the active main window forward (`RootView` hands each `WindowNavigation` its `NSWindow`) or, with every main window closed, opens one with `openWindow(id: LearnFRCApp.mainWindowID)` (handed to `AppModel` by each main window and by the Settings window). The new window takes over the stand-in, so the screen asked for is the one that appears; nothing is replayed later.

Outside events (links from widgets, other apps and the browser, Handoff, Spotlight, notification taps) go to the window in use, never a new one: `RootView` declares `.handlesExternalEvents(preferring: ["*"] when it's the active window, allowing: ["*"])`. On the Mac each link used to open another window. A cold launch still makes the first window for the event; File > New Window (⌘N) and the iPad's New Window still make new ones.

`AppModel.open(route)` switches to the route's tab and shows it on a clean stack; a route that is already a tab's root (`.leaderboard`, Community's root) just selects that tab at its root, so the screen never sits on top of itself. The shell is never replaced: the username gate goes inside it (over the tab view on iPhone and iPad, in the detail column on the Mac, section 6.2).

Settings from outside a screen (`learnfrc://settings`, learnfrc.com/settings, the system's notification-settings button) goes through `AppModel.showSettings()`: on the Mac it opens the Settings window (`openSettings`, handed to `SystemServices` by each window), elsewhere it opens the Settings screen in the window in use.

Window names: the Mac window title follows the screen's `navigationTitle`. On iPad, `RootView` sets the scene's `title` to the screen it's showing (`AppRoute.screenTitle`, else the tab's name), so the Dock's window list and the app switcher tell two windows apart instead of "LearnFRC" and "LearnFRC 1".

Menu commands (`AppCommands`) act on the focused window's navigation (`@FocusedValue(\.learnFRCNavigation)`). With no main window focused (Mac: the Settings window is key, or none is open), the Go menu acts on `activeNavigation` and reveals it (above); Back and the Lesson menu are off, since nothing they'd act on is in front. While the username gate is up, the Go and Lesson menus are off altogether (section 6.2).

| Menu | Command | Shortcut |
|---|---|---|
| Go | Search… | ⌘K |
| Go | Home, Guides, Community, You (the sidebar's order) | ⌘1 to ⌘4 |
| Go | Back (the focused window only) | ⌘[ |
| Go | Continue Lesson | ⇧⌘L |
| Go | Videos, Glossary (the catalogue), Bookmarks, Leaderboard, Badges, My Team | |
| Lesson | Next / Previous Lesson: swaps the `.lesson` on top of the focused window's selected tab (`showLesson(_:replacing:)`, no animation); the lesson screen there follows its route and moves in place | ⌥⌘→ / ⌥⌘← |
| Lesson | Bookmark Lesson / Remove Bookmark, Open on learnfrc.com, Copy Link: the lesson on top of the focused window's selected tab (`visibleLessonID`), and only one the catalog has. Lesson screens don't publish a lesson (on iPhone and iPad a hidden tab's lesson did, and the oldest won) | ⌘D |
| View | Refresh (the only ⌘R; screens don't bind it) | ⌘R |
| View | Show Sidebar / Hide Sidebar (Mac, `SidebarCommands`) | ⌃⌘S |
| App | Settings… | ⌘, |

The selected sidebar row is a blue fill under a white label, so it uses a deeper blue than links in dark mode: on iPad the `TabView` is tinted `LF.Palette.sidebarTint` while the sidebar shows (read from `tabBarPlacement`), and the Mac sidebar `List`, which ignores the tint and uses the app accent, gets the same blue from a Mac-only dark value in `AccentColor`. The iPhone tab bar, the iPad top tab bar and every screen keep `LF.Palette.blue`.

### 6.7 Links and search requests
One parser, `DeepLink.parse`, for `learnfrc://` links, learnfrc.com links, site paths and Spotlight identifiers (`Features/System/DeepLinks.swift`). On a cold launch a link waits for what it needs (`isReady(for:)`, then `followWhenReady`; never the network): links that name lessons by slug wait for the cached catalog, so they open the lesson instead of the browser, and `learnfrc://continue` (the reminder's link) waits for the cached progress and the stored session (`waitForAccountRestore()`), so it opens the reader's lesson instead of the Guides wall. Links take turns (`beginLink()`, `linkGeneration`): one still waiting gives way to any link, Handoff or Spotlight result that arrived after it. `SystemServices.open(url)` is the entry for links, notification taps and learnfrc.com Handoff.

Search has one mechanism: `AppModel.requestSearch(query)` selects Search at its root in the active window and leaves a `WindowNavigation.SearchRequest`; `SearchView` takes it (`.onChange(of: navigation?.searchRequest?.id, initial: true)`), fills in the words and focuses the field. ⌘K, `learnfrc://search?q=`, the Search App Shortcut and Spotlight's "search in app" all go through it. The field it focuses must be the one on screen: sheets close for it (below), and `SearchView` doesn't take a request while the username gate is up; it takes it once the gate is done. The search is saved for the next launch (`@SceneStorage`) only when it's submitted, picked on the page, asked for by a link, or left with results showing, never on every keystroke, so text typed into the field by mistake isn't written to disk.

Sheets, popovers and covers close when their window navigates. `closesOnNavigation($isPresented)` and `closesOnNavigation($item)` (`Core/Stores/NavigationPresentation.swift`) watch the window's `NavigationFingerprint` (the selected tab, every tab's stack and the newest search request) and close what they present as soon as it changes. While something is presented, the person can't move the window behind it themselves, so a change came from outside: a link, Handoff, a notification tap, a Spotlight result, an App Intent, a menu command or a search request. Nothing is left over a screen it doesn't belong to, and nothing in it can push onto a tab the person isn't looking at. `RootView` uses it for its sign-in sheet and for the profile setup step (put aside, not skipped, section 6.2); the You page and Settings present sign-in with `authSheet(item:)`, which does the same. `RootView` also steps aside for a link or Handoff before following it, for the ones that don't move the window: the screen already on show, a page that opens in the browser, a link still waiting for the cache. The username gate isn't a sheet and stays up regardless.

### 6.8 Handoff
`LessonView` advertises `com.learnfrc.app.lesson` with the lesson id in `userInfo["lessonID"]` and its learnfrc.com `webpageURL`. The type is listed in `NSUserActivityTypes`, set under `info.properties` in `project.yml` (Xcode doesn't generate that key from a build setting). Only the lesson on show advertises it (`WindowNavigation.isShowing`, section 6.6). `AppModel.handle(userActivity:)` opens `userInfo["lessonID"]` first, which needs no catalog, and only falls back to `webpageURL`, which goes through `SystemServices.open(url)` like any link: it waits for the cached catalog, and a page the app has no screen for opens in the browser. Without an associated-domains entitlement, `NSUserActivityTypeBrowsingWeb` from Safari doesn't reach the app; its handler (the same path) stays for when one is added.

### 6.9 Privacy manifest
`LearnFRC/Resources/PrivacyInfo.xcprivacy` declares no tracking, the collected data types (email, name, user id, device id, product interaction, other user content: linked, app functionality only), and one required-reason API: UserDefaults (`CA92.1`). The app uses no file-timestamp, boot-time or disk-space APIs (cache freshness comes from each file's envelope); keep it that way or declare the reason. The widget has its own manifest.

## 7. Website API (`/api/app/*`)

All JSON, camelCase. Per-user routes require `Authorization: Bearer <Supabase access token>` and reply `Cache-Control: no-store`. Errors: HTTP status plus `{ "error": "human sentence", "code": "machine_code" }`, with `code` one of `unauthorized`, `validation`, `rate_limited`, `not_found`, `conflict`, `server`. 429 responses include `Retry-After`. Every route reuses the same `src/lib/app/*` functions as the website's server actions.

| Route | Auth | Request | Response |
|---|---|---|---|
| `GET /api/app/reference` | none, `public, s-maxage=3600` | | `{ glossary: GlossaryTerm[] (site shape + slug), glossaryCategories: string[], paths: LearningPath[], lessonBridge: { [lessonId]: string[] /* article slugs */ }, startGoals: StartGoal[], version: string }` |
| `GET /api/app/me` | Bearer | | `{ user: { id, email }, profile: { id, username, fullName, avatarUrl, teamNumber, bio, role, xp, level, tier, createdAt, emailOptIn, emailChoiceAt }, needsUsernameSetup, isPlaceholderUsername, emailPrompt, referralCount }` |
| `GET /api/app/me/progress` | Bearer | | `{ completions: [{ lessonId, completedAt, xpAwarded }], bookmarks: [{ lessonId, createdAt }], earnedAchievements: [{ achievementId, slug, earnedAt }], xp, level, rhythm: Rhythm, rhythmCopy: RhythmCopy, nextUnlock: NextUnlock \| null }` (Rhythm, DayCell, RhythmCopy and NextUnlock exactly as `src/lib/streaks.ts` and `src/app/api/me/progress/route.ts` define them) |
| `POST /api/app/progress/complete` | Bearer | `{ lessonId, answers: number[] }` | `{ ok: true, xpAwarded, xp, level, newAchievements: [{ id, slug, name, description, icon }], completedCount, rhythm, rhythmCopy }` |
| `DELETE /api/app/progress/complete?lessonId=` | Bearer | | `{ ok: true, xp, level, completedCount }` |
| `PATCH /api/app/profile` | Bearer | `{ fullName?, bio?, avatarUrl?, username?, teamNumber? (number or null), role? }` | the `/me` profile object |
| `POST /api/app/profile/setup` | Bearer | `{ username, teamNumber? }` | the `/me` profile object |
| `POST /api/app/email-opt-in` | Bearer | `{ optIn: boolean }` | `{ optIn, emailChoiceAt }` |
| `GET /api/app/team` | Bearer | | `{ team: null }` or `{ team: { number, memberCount, members: [{ username, avatarUrl, role, xp, isYou, completed, depts: [{ slug, name, completed, total, furthest, next }] }], subteamCoverage: [...] , inviteURL } }` |
| `GET /api/app/leaderboard` | none, cached 60 s | `?board=weekly\|alltime\|teams` | `{ board, entries: [{ rank, username, avatarUrl, teamNumber, role, xp, lessons }] }` (teams: `{ rank, teamNumber, members, xp }`) |
| `GET /api/app/u/{username}` | none | | `{ username, avatarUrl, teamNumber, bio, role, xp, level, tier, createdAt, lessonCount, achievements: [{ slug, name, icon, earnedAt }] }` or 404 |
| `POST /api/app/auth/sign-in` | none, rate limited per IP | `{ identifier, password }` | `{ accessToken, refreshToken, expiresAt }` (never echoes the email) |
| `POST /api/app/auth/sign-up` | none, rate limited per IP | `{ email, password, username, fullName?, teamNumber?, emailOptIn, ref?, via? }` | `{ status: "confirm_email" \| "exists" }` |
| `POST /api/app/migrate-guest` | Bearer | `{ visitorId }` | `{ migrated: number }` |
| `DELETE /api/app/account` | Bearer | | `{ ok: true }` |

## 8. Building and checking

- Generate after editing `project.yml`: `(cd apple && xcodegen generate)`. New files in synced folders need no project changes.
- Build (use your own derived-data folder so parallel builds don't collide; packages are already downloaded):
  `xcodebuild -project apple/LearnFRC.xcodeproj -scheme LearnFRC -destination 'platform=iOS Simulator,name=iPhone 18 Pro' -derivedDataPath apple/.build/dd-<you> -clonedSourcePackagesDirPath apple/.build/packages build 2>&1 | grep -E "error:|warning: .*LearnFRC/|BUILD"`
  and the same with `-destination 'platform=macOS'`.
- Previews: `python3 apple/scripts/xcode-mcp.py call RenderPreview '{"sourceFilePath": "LearnFRC/LearnFRC/<path>.swift", "workspaceIdentifier": "<from XcodeListWorkspaces>", "timeout": 240}'` renders a `#Preview` through the open Xcode and prints `previewSnapshotPath`; open that PNG to look at it. Xcode renders one preview at a time, so use it to check your finished screens, not after every edit.
- If the full build fails only because of files outside your folder, say so and stop; don't edit other folders.
- Known system noise in the iOS 27 simulator log, not app code: focusing a form field that has the keyboard bar (`accountKeyboardBar`, a `ToolbarItemGroup(placement: .keyboard)`) logs one SwiftUI runtime fault, "Invalid frame dimension (negative or non-finite)". A backtrace puts it inside SwiftUI's own `InputAccessoryBar` body (`_FrameLayout.init`), and it still logs with the bar split around a `ToolbarSpacer`. The bar works; don't chase it in app code.
