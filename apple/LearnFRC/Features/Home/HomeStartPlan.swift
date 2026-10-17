import SwiftUI

// learnfrc.com/start on Home: one question, then one plan, then one button into one lesson.
//
// - `HomeStartPicker`: the question (the site's picker state, word for word). Each answer
//   saves on this device for a year (`StartPlanStore`, like the site's `lf_goal` cookie) and
//   turns into the plan.
// - `HomeStartPlanSection`: the plan (the site's plan state and `FirstRunPlan`): the route,
//   the five lessons with their ticks, and the one button into the next lesson.
// - `HomeStartPrompt`: the question folded down after "Skip for now", the dashboard's
//   "not sure where to start" card.

// MARK: - The answers

/// One answer to the question, with the route it commits you to.
struct HomeStartAnswer: Identifiable, Hashable {
    let goal: StartGoal
    let pathTitle: String
    /// The route's departments in order, each once (the site's `RouteStop` names).
    let stops: [String]

    var id: String { goal.id }

    /// The answers the site offers: one per start goal, each with its path's departments in
    /// step order, named the way the catalogue names them. Like the site's `getGoalOptions`,
    /// an answer whose path is missing is left out (while the paths are loaded at all).
    @MainActor
    static func all(reference: ReferenceStore, catalog: CatalogStore) -> [HomeStartAnswer] {
        reference.startGoals.compactMap { goal in
            guard !goal.pathSlug.isEmpty else { return nil }
            let path = reference.path(slug: goal.pathSlug)
            if path == nil, !reference.paths.isEmpty { return nil }
            var seen = Set<String>()
            var stops: [String] = []
            for step in path?.steps ?? [] where seen.insert(step.deptSlug).inserted {
                stops.append(catalog.department(slug: step.deptSlug)?.name ?? step.label)
            }
            return HomeStartAnswer(goal: goal, pathTitle: path?.title ?? "", stops: stops)
        }
    }
}

// MARK: - The question

/// The site's `/start` question: five answers, each a whole-row button. Nothing else asks
/// for anything here, and there is always a way out ("Browse all N departments", "Skip for
/// now"), because a first-run screen you can't leave is a trap.
struct HomeStartPicker: View {
    let answers: [HomeStartAnswer]
    /// The account's handle, for "What do you do on your team, maya?". Nil for guests.
    let handle: String?
    let lessonCount: Int
    let departmentCount: Int
    var wide = false
    let onChoose: (StartGoal) -> Void
    let onBrowse: () -> Void
    let onSkip: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("one question / then you are in")
            Text("What do you do on your team\(handle.map { ", \($0)" } ?? "")?")
                .homeTitle(wide ? 34 : 28, relativeTo: .title)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 12)
            Text("Pick the closest one. It turns \(lessonCount.formatted()) lessons across \(departmentCount.formatted()) departments into the \(StartPlan.defaultTarget) that get you moving, and you can change it any time.")
                .homeSub(17)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 12)
            MarkerText("one tap, then you are reading", angle: -1.1)
                .padding(.top, 14)

            VStack(spacing: 0) {
                InkRule()
                ForEach(Array(answers.enumerated()), id: \.element.id) { index, answer in
                    row(answer, first: index == 0)
                }
            }
            .padding(.top, 22)

            NoteCallout {
                SlugText("not ready to choose")
                Text("The first answer is the safe one. It starts with how FRC works and covers everything a new member needs.")
                    .font(LF.Fonts.body(15.5))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                HomeFlowLayout(spacing: 22, lineSpacing: 0) {
                    Button(action: onBrowse) {
                        LearnLinkLabel(title: "Browse all \(departmentCount.formatted()) departments")
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Opens the Guides tab")
                    Button(action: onSkip) {
                        LearnLinkLabel(title: "Skip for now")
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: 640, alignment: .leading)
            .padding(.top, 24)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: One answer

    /// A carbon-copy log line: the route it commits you to on the left, the answer in the
    /// middle, the length on the right. One column on a phone and at the largest sizes.
    @ViewBuilder
    private func row(_ answer: HomeStartAnswer, first: Bool) -> some View {
        let stacked = !wide || dynamicTypeSize.isAccessibilitySize
        Button {
            onChoose(answer.goal)
        } label: {
            Group {
                if stacked {
                    VStack(alignment: .leading, spacing: 8) {
                        meta(answer, first: first)
                        main(answer)
                        SlugText("\(answer.stops.count) stops")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 24) {
                        meta(answer, first: first)
                            .frame(width: 190, alignment: .leading)
                        main(answer)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        SlugText("\(answer.stops.count) stops")
                            .fixedSize()
                    }
                }
            }
            .padding(.vertical, 16)
            .padding(.trailing, 4)
            .overlay(alignment: .bottom) { DashedRule() }
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel("\(answer.goal.label). \(answer.goal.blurb)")
        .accessibilityValue(spokenRoute(answer, first: first))
        .accessibilityHint("Saves your answer and shows your five lessons")
    }

    private func meta(_ answer: HomeStartAnswer, first: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SlugText("path / \(answer.goal.pathSlug)")
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            // The modal answer for this audience and the safest default: marked, not made
            // bigger, so the other four stay where they are.
            if first {
                TagView("start here if unsure")
            }
        }
    }

    private func main(_ answer: HomeStartAnswer) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            LearnWholeWords(text: answer.goal.label) { string in
                Text(string)
                    .font(LF.Fonts.display(wide ? 22 : 20, relativeTo: .title3))
                    .tracking(-0.5)
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(answer.goal.blurb)
                .font(LF.Fonts.body(15.5))
                .foregroundStyle(LF.Palette.graphite)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            // The stops, in order: you can see the answer change what happens next before
            // you commit to it.
            if !answer.stops.isEmpty {
                SlugText(answer.stops.joined(separator: "  /  "))
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
        }
    }

    private func spokenRoute(_ answer: HomeStartAnswer, first: Bool) -> String {
        var parts: [String] = []
        if first { parts.append("Start here if unsure") }
        if !answer.pathTitle.isEmpty { parts.append("Learning path: \(answer.pathTitle)") }
        parts.append("\(answer.stops.count) stops: \(answer.stops.joined(separator: ", "))")
        return parts.joined(separator: ". ")
    }
}

// MARK: - The question, folded

/// After "Skip for now": the dashboard's way back to the question, one line on the paper.
struct HomeStartPrompt: View {
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            NotebookCard(lift: true, padding: 16) {
                let text = VStack(alignment: .leading, spacing: 4) {
                    SlugText("not sure where to start")
                    Text("Answer one question, get five lessons.")
                        .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                        .foregroundStyle(LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .center, spacing: 14) {
                        text
                        HomeButtonFace(title: "Build my plan", ghost: true)
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        text
                        HomeButtonFace(title: "Build my plan", ghost: true)
                    }
                }
            }
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel("Build my plan")
        .accessibilityValue("Not sure where to start? Answer one question, get five lessons.")
        .accessibilityHint("Shows the question again")
    }
}

// MARK: - The plan

/// What the plan section draws, worked out by Home from the store, the catalogue and the
/// learner's progress.
struct HomeStartPlanModel: Equatable {
    struct Row: Identifiable, Equatable {
        let lesson: StartPlan.Lesson
        let departmentName: String
        let done: Bool
        var id: UUID { lesson.id }
    }

    struct Next: Equatable {
        let row: Row
        /// 1-based position in the plan.
        let step: Int
        /// The read time the lesson page prints (words / 200), when it's known.
        let readMins: Int?
    }

    let pathSlug: String
    let pathTitle: String
    /// False when the site fell back to its default plan (see `StartPlan.tailored`).
    let tailored: Bool
    let rows: [Row]
    let next: Next?

    var total: Int { rows.count }
    var doneCount: Int { rows.count { $0.done } }

    @MainActor
    init(plan: StartPlan, store: StartPlanStore, catalog: CatalogStore, progress: ProgressStore, reference: ReferenceStore) {
        pathSlug = plan.pathSlug
        pathTitle = plan.pathTitle.isEmpty ? (reference.path(slug: plan.pathSlug)?.title ?? plan.goal.label) : plan.pathTitle
        tailored = plan.tailored
        let rows = plan.lessons.map { lesson in
            Row(
                lesson: lesson,
                departmentName: lesson.departmentName
                    ?? catalog.department(slug: lesson.departmentSlug)?.name
                    ?? catalog.location(of: lesson.lessonID)?.department.name
                    ?? lesson.departmentSlug,
                done: store.isDone(lesson, progress: progress)
            )
        }
        self.rows = rows
        if let index = rows.firstIndex(where: { !$0.done }) {
            let row = rows[index]
            // The site's rule: the real read time from the word count, never the inflated
            // `estimated_minutes`, so the number on the card is the number on the page. The
            // route sends it; the cached lesson body gives the same number when it doesn't.
            let readMins = row.lesson.minutes
                ?? catalog.lessonBody(row.lesson.lessonID).map { LessonText.readingMinutes($0.content) }
            next = Next(row: row, step: index + 1, readMins: readMins)
        } else {
            next = nil
        }
    }

    init(pathSlug: String, pathTitle: String, tailored: Bool = true, rows: [Row], next: Next?) {
        self.pathSlug = pathSlug
        self.pathTitle = pathTitle
        self.tailored = tailored
        self.rows = rows
        self.next = next
    }
}

/// The plan, the way learnfrc.com/start draws it once the question is answered: whose route
/// this is, then the checklist taped inside the binder cover with one obvious next lesson
/// and a finish line five rows down. Every state survives a photocopy: a cleared row is a
/// filled box with a drawn tick and the word "done", the next row is a blue bar plus "next".
struct HomeStartPlanSection: View {
    enum Phase: Equatable {
        case ready(HomeStartPlanModel)
        case loading
        case failed(String)
    }

    let phase: Phase
    let pathSlug: String
    let pathTitle: String
    let handle: String?
    var wide = false
    let onChange: () -> Void
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("your route / \(pathSlug)")
            Text(handle.map { "You're set, \($0)." } ?? "You're set.")
                .homeTitle(wide ? 34 : 28, relativeTo: .title)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            if !pathTitle.isEmpty {
                Text("Everything below follows the \(pathTitle) route. Start at the top and work down, that is the whole plan.")
                    .homeSub(17)
                    .frame(maxWidth: 560, alignment: .leading)
                    .padding(.top, 12)
            }

            Group {
                switch phase {
                case .ready(let model):
                    HomeStartPlanCard(model: model, wide: wide, onChange: onChange)
                case .loading:
                    NotebookCard(tilt: .preset(2), tape: true, padding: wide ? 26 : 20) {
                        VStack(alignment: .leading, spacing: 12) {
                            SkeletonBlock(height: 12, width: 190)
                            SkeletonBlock(height: 28, width: 240)
                            SkeletonBlock(height: 16)
                            ForEach(0..<StartPlan.defaultTarget, id: \.self) { _ in
                                SkeletonBlock(height: 40)
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Loading your five lessons")
                    }
                case .failed(let message):
                    NoteCallout {
                        SlugText("your plan / not loaded")
                        Text("Your five lessons didn't come back this time. Your answer is saved. \(message)")
                            .font(LF.Fonts.body(15.5))
                            .foregroundStyle(LF.Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        HomeFlowLayout(spacing: 12, lineSpacing: 10) {
                            Button("Try again", action: onRetry)
                                .buttonStyle(.inkGhostSmall)
                            Button(action: onChange) {
                                LearnLinkLabel(title: "Not your subteam? Change the route")
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.top, 4)
                    }
                    .frame(maxWidth: 640, alignment: .leading)
                }
            }
            .padding(.top, 22)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The checklist itself (the site's `FirstRunPlan`).
struct HomeStartPlanCard: View {
    let model: HomeStartPlanModel
    var wide = false
    let onChange: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var total: Int { model.total }
    private var done: Int { model.doneCount }

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: wide ? 26 : 20, tapeAngle: -3.2) {
            // The filing label: which route, and how far down it you are (that part in ink).
            // One run of text, so it wraps like a line of type at the larger sizes.
            Text("route / \(model.pathSlug) / \(Text("\(done) of \(total) cleared").foregroundStyle(LF.Palette.ink))")
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .tracking(12.5 * 0.02)
                .monospacedDigit()
                .foregroundStyle(LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 12)
                .overlay(alignment: .bottom) { DashedRule() }
                .accessibilityLabel("Route \(model.pathTitle), \(done) of \(total) cleared")

            Text(headline)
                .homeTitle(wide ? 28 : 24)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Text(done >= total
                 ? "That is the threshold that makes it stick. Keep working down the route, everything below it is open and free."
                 : "Learners who clear five lessons in their first week are about five times more likely to still be building three weeks later. One at a time.")
                .homeSub(15.5)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 8)

            if let next = model.next {
                nextBlock(next)
                    .padding(.top, 18)
            }

            VStack(spacing: 0) {
                ForEach(Array(model.rows.enumerated()), id: \.element.id) { index, row in
                    lessonRow(row, number: index + 1, isNext: model.next?.step == index + 1)
                }
            }
            .padding(.top, 18)

            HomeFlowLayout(spacing: 22, lineSpacing: 0) {
                Button(action: onChange) {
                    LearnLinkLabel(title: model.tailored
                                   ? "Not your subteam? Change the route"
                                   : "Tell us what you do and we'll cut this to fit")
                }
                .buttonStyle(.plain)
                .accessibilityHint("Shows the question again")
                NavigationLink(value: AppRoute.path(model.pathSlug)) {
                    LearnLinkLabel(title: "See the whole route")
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 14)
        }
    }

    private var headline: String {
        if done == 0 { return "Your first \(total) lessons." }
        if done >= total { return "All \(total) cleared." }
        return "\(done) down, \(total - done) to go."
    }

    // MARK: The single action

    private func nextBlock(_ next: HomeStartPlanModel.Next) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            SlugText("\(done == 0 ? "start here" : "next up") / lesson \(next.step) of \(total)")
                .padding(.top, 14)
            LearnWholeWords(text: next.row.lesson.title) { string in
                Text(string)
                    .homeTitle(wide ? 23 : 21, relativeTo: .title3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 8)
            LearnWholeWordSlug(text: [next.row.departmentName, next.readMins.map { "\($0) min read" }, "quiz at the end"]
                .compactMap { $0 }
                .joined(separator: " / "))
                .padding(.top, 8)
            NavigationLink(value: AppRoute.lesson(next.row.lesson.lessonID)) {
                Label(done == 0 ? "Open the first lesson" : "Open this lesson", systemImage: "arrow.right")
                    .labelStyle(HomeTrailingIconLabelStyle())
            }
            .buttonStyle(.ink)
            .accessibilityHint("Opens \(next.row.lesson.title)")
            .padding(.top, 16)
        }
    }

    // MARK: The finish line

    private func lessonRow(_ row: HomeStartPlanModel.Row, number: Int, isNext: Bool) -> some View {
        NavigationLink(value: AppRoute.lesson(row.lesson.lessonID)) {
            HStack(alignment: .top, spacing: 12) {
                HomePlanStepBox(number: number, done: row.done, isNext: isNext)
                // At the accessibility sizes "done" and "next" go under the department rather
                // than taking a column the title needs.
                let stateBelow = dynamicTypeSize.isAccessibilitySize
                VStack(alignment: .leading, spacing: 3) {
                    Text(row.lesson.title)
                        .font(LF.Fonts.body(16, weight: .semibold, relativeTo: .headline))
                        .foregroundStyle(row.done ? LF.Palette.graphite : LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    SlugText(row.departmentName)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    if stateBelow, row.done || isNext {
                        SlugText(row.done ? "done" : "next", color: LF.Palette.ink)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !stateBelow, row.done || isNext {
                    SlugText(row.done ? "done" : "next", color: LF.Palette.ink)
                        .fixedSize()
                }
            }
            .padding(.vertical, 12)
            .padding(.leading, 8)
            .padding(.trailing, 4)
            // Blue wash plus a blue bar plus the word "next": three markers, one of them not a
            // colour.
            .background {
                if isNext {
                    ZStack(alignment: .leading) {
                        LF.Palette.rowWash
                        Rectangle().fill(LF.Palette.blue).frame(width: 3)
                    }
                }
            }
            .overlay(alignment: .bottom) { DashedRule() }
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel("Lesson \(number) of \(total): \(row.lesson.title)")
        .accessibilityValue([row.departmentName, row.done ? "done" : (isNext ? "next" : nil)].compactMap { $0 }.joined(separator: ", "))
        .accessibilityHint("Opens the lesson")
    }
}

/// The numbered box at the start of a plan row: a filled box with a drawn tick once the
/// lesson is done (the shape carries the state, not the blue), a blue outline for the next.
struct HomePlanStepBox: View {
    let number: Int
    let done: Bool
    let isNext: Bool

    @ScaledMetric(relativeTo: .body) private var side: CGFloat = 28

    var body: some View {
        ZStack {
            HandShape(.s).fill(done ? LF.Palette.blueButton : LF.Palette.card)
            HandShape(.s).strokeBorder(done ? LF.Palette.blueButton : (isNext ? LF.Palette.blue : LF.Palette.rule),
                                       lineWidth: LF.Metrics.stroke)
            if done {
                PenCheckShape()
                    .stroke(LF.Palette.onBlue, style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
                    .frame(width: side * 0.5, height: side * 0.4)
            } else {
                Text("\(number)")
                    .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .caption))
                    .monospacedDigit()
                    .foregroundStyle(isNext ? LF.Palette.blue : LF.Palette.graphite)
            }
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}

// MARK: - Preview data

enum HomeStartPreviewData {
    /// The real plan for "Programming & controls" from the preview catalogue's lessons.
    static var plan: StartPlan {
        let lessons = Array(PreviewData.allLessons.prefix(5)).map { location in
            StartPlan.Lesson(
                lessonID: location.lesson.id,
                title: location.lesson.title,
                departmentSlug: location.department.slug,
                departmentName: location.department.name,
                moduleSlug: location.module.slug,
                slug: location.lesson.slug,
                minutes: 2
            )
        }
        return StartPlan(
            goal: .init(id: "code", label: "Programming & controls", blurb: "Robot code, sensors, autonomous.", pathSlug: "become-a-robot-programmer"),
            pathSlug: "become-a-robot-programmer",
            pathTitle: "Become a Robot Programmer",
            lessons: lessons
        )
    }
}

#Preview("Start question, iPhone", traits: .fixedLayout(width: 393, height: 1500)) {
    let model = AppModel.preview(signedIn: false, phase: .new)
    ScrollView {
        HomeStartPicker(
            answers: HomeStartAnswer.all(reference: model.reference, catalog: model.catalog),
            handle: nil, lessonCount: 394, departmentCount: 11,
            onChoose: { _ in }, onBrowse: {}, onSkip: {}
        )
        .padding(LF.Metrics.gutter)
    }
    .paperBackground()
}

#Preview("Start plan, iPhone", traits: .fixedLayout(width: 393, height: 1400)) {
    let model = AppModel.preview(signedIn: false, phase: .new)
    let store = StartPlanStore.preview(goal: "code", plan: HomeStartPreviewData.plan)
    NavigationStack {
        ScrollView {
            HomeStartPlanSection(
                phase: .ready(HomeStartPlanModel(plan: HomeStartPreviewData.plan, store: store, catalog: model.catalog,
                                                 progress: model.progress, reference: model.reference)),
                pathSlug: "become-a-robot-programmer", pathTitle: "Become a Robot Programmer", handle: nil,
                onChange: {}, onRetry: {}
            )
            .padding(LF.Metrics.gutter)
            .padding(.top, 14)
        }
        .paperBackground()
    }
    .appEnvironment(model)
}

#Preview("Start plan, iPad, dark", traits: .fixedLayout(width: 760, height: 1300)) {
    let model = AppModel.preview(signedIn: true, phase: .new)
    let store = StartPlanStore.preview(goal: "code", plan: HomeStartPreviewData.plan)
    NavigationStack {
        ScrollView {
            HomeStartPlanSection(
                phase: .ready(HomeStartPlanModel(plan: HomeStartPreviewData.plan, store: store, catalog: model.catalog,
                                                 progress: model.progress, reference: model.reference)),
                pathSlug: "become-a-robot-programmer", pathTitle: "Become a Robot Programmer", handle: "maya_builds", wide: true,
                onChange: {}, onRetry: {}
            )
            .padding(28)
        }
        .paperBackground()
    }
    .appEnvironment(model)
    .environment(\.colorScheme, .dark)
}

#Preview("Start question folded", traits: .fixedLayout(width: 393, height: 260)) {
    HomeStartPrompt(onOpen: {})
        .padding(LF.Metrics.gutter)
        .frame(maxHeight: .infinity, alignment: .top)
        .paperBackground()
}
