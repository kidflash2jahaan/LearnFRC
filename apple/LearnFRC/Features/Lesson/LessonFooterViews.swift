import SwiftUI

// The foot of the sheet: the guest's ask, the department progress strip (narrow windows),
// the running footer (lesson before and after) and the folded-away contents.

// MARK: - The guest's ask

/// The one inverted surface on the lesson: solid ballpoint with paper as the type. It
/// branches on what the guest has actually done, and it's framed around what an account
/// adds, never around what could be lost. Not shown to signed-in readers.
struct LessonSignupHookView: View {
    let departmentName: String
    /// 1-based position of this lesson in the department, and the department's size.
    let position: Int
    let count: Int
    /// Lessons this guest has finished on this device, everywhere and in this department.
    let total: Int
    let inDepartment: Int
    let onAccount: (LessonAccountRequest) -> Void
    let onQuiz: () -> Void

    @ScaledMetric(relativeTo: .body) private var padding: CGFloat = 24

    /// What an account adds on top of guest reading. All four are real, shipped features.
    private static let perks = ["Saved across every device", "XP and daily streaks", "Certificate on finish", "Leaderboard rank"]

    private var asked: Bool { total > 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(copy.label)
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .foregroundStyle(LF.Palette.onBlue.opacity(0.86))
            Text(copy.headline)
                .lessonHeading(26, color: LF.Palette.onBlue)
                .frame(maxWidth: 520, alignment: .leading)
                .padding(.top, 8)
            Text(copy.body)
                .font(LF.Fonts.body(16, relativeTo: .callout))
                .foregroundStyle(LF.Palette.onBlue.opacity(0.86))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 12)

            if asked {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Self.perks, id: \.self) { perk in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(verbatim: "-").bold().foregroundStyle(LF.Palette.onBlue)
                            Text(perk).foregroundStyle(LF.Palette.onBlue.opacity(0.86))
                        }
                    }
                }
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .padding(.top, 14)
                .accessibilityElement(children: .combine)
            }

            LessonFlowLayout(spacing: 20, lineSpacing: 10) {
                Button {
                    asked ? onAccount(.signUp) : onQuiz()
                } label: {
                    // One line whenever it fits (the flow measures it at its one-line width);
                    // at the largest sizes it wraps between words rather than cut off.
                    Text(copy.cta)
                        .multilineTextAlignment(.center)
                }
                .buttonStyle(InvertedInkButtonStyle())

                LessonFlowLayout(spacing: 4, lineSpacing: 0, alignment: .center) {
                    Text(asked ? "Already have an account?" : "Got an account?")
                        .foregroundStyle(LF.Palette.onBlue.opacity(0.86))
                    OnBlueLink(title: "Log in") { onAccount(.signIn) }
                    if !asked {
                        Text("or").foregroundStyle(LF.Palette.onBlue.opacity(0.86))
                        OnBlueLink(title: "create one free") { onAccount(.signUp) }
                    }
                }
                .font(LF.Fonts.body(15, relativeTo: .callout))
            }
            .padding(.top, 22)
        }
        .padding(LessonLayout.cardPadding(padding))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LF.Palette.blueButton)
        .overlay(alignment: .top) { InkRule() }
        .overlay(alignment: .bottom) { InkRule() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(asked ? "Save your progress" : "Finish this lesson")
    }

    private var copy: (label: String, headline: String, body: String, cta: String) {
        let xp = total * 10
        let them = total == 1 ? "it" : "them"
        let plural = LessonText.plural(total)
        let theLessons = total == 1 ? "your lesson" : "all \(total) lessons"
        if inDepartment > 0 {
            return (
                "saved on this device only",
                "\(inDepartment) of \(count) done in \(departmentName). Take that with you.",
                "A free account gives the work a permanent home. It moves \(theLessons) into a real profile with the dates you actually earned them, worth at least +\(xp) XP, and from then on your progress follows you onto any device, counts toward the \(departmentName) certificate, and puts you on the leaderboard. Reading stays free either way, and nothing here gets locked.",
                "Claim my \(total) lesson\(plural)"
            )
        }
        if total > 0 {
            return (
                "saved on this device only",
                "\(total) lesson\(plural) finished without an account. Give that a permanent home.",
                "A free account moves \(them) into a real profile with the dates you actually earned them, worth at least +\(xp) XP, so your progress follows you onto any device, counts toward streaks and certificates, and puts you on the leaderboard. Reading stays free either way, and nothing here gets locked.",
                "Claim my \(total) lesson\(plural)"
            )
        }
        return (
            "no account needed",
            "Lesson \(position) of \(count) in \(departmentName). Finish it right here.",
            "The quiz above is open to everyone. Pass it and this lesson is marked complete, saved on this device, with no sign-up. Do a few and we'll offer you somewhere permanent to put them.",
            "Take the quiz"
        )
    }
}

/// The button on the inverted surface: paper fill, ballpoint type, the same ink drop.
private struct InvertedInkButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        InvertedInkButton(configuration: configuration)
    }
}

private struct InvertedInkButton: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let travel: CGFloat = configuration.isPressed && !reduceMotion ? SiteTokens.Movement.pressTravel : 0
        configuration.label
            .font(LF.Fonts.mono(14, weight: .bold, relativeTo: .callout))
            .foregroundStyle(LF.Palette.blue)
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
            .frame(minHeight: LF.Metrics.tap)
            .background {
                ZStack {
                    HandShape(.s).fill(LF.Palette.card)
                    HandShape(.s).strokeBorder(LF.Palette.card, lineWidth: LF.Metrics.stroke)
                }
            }
            .offset(x: travel, y: travel)
            .background {
                HandShape(.s).fill(LF.Palette.ink.opacity(0.9)).offset(x: 3, y: 3)
            }
            .contentShape(HandShape(.s))
            .animation(reduceMotion ? nil : LF.Motion.press, value: configuration.isPressed)
    }
}

/// An underlined link on the blue band, 44pt tall to tap.
private struct OnBlueLink: View {
    let title: String
    let action: () -> Void

    var body: some View {
        LessonTextLink(title, color: LF.Palette.onBlue, underline: LF.Palette.onBlue.opacity(0.55), bold: true, action: action)
    }
}

// MARK: - Progress through the department (narrow windows)

/// What the margin carries on a wide window, re-set as a ruled strip for a narrow one.
struct LessonProgressStrip: View {
    let departmentName: String
    let done: Int
    let total: Int
    let signedIn: Bool

    private var pct: Int { total > 0 ? Int((Double(done) / Double(total) * 100).rounded()) : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SlugText(signedIn ? "your progress" : "your progress / this device")
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("\(pct)%")
                    .font(LF.Fonts.mono(32, weight: .bold, relativeTo: .title))
                    .monospacedDigit()
                    .foregroundStyle(LF.Palette.blue)
                Text("through \(departmentName)")
                    .font(LF.Fonts.body(16, weight: .bold, relativeTo: .callout))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            MeterView(value: Double(done) / Double(max(1, total)), valueText: "\(done)/\(total)")
            SlugText("\(done) of \(total) lessons read")
        }
        .padding(.top, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) { InkRule() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your progress through \(departmentName): \(pct) percent, \(done) of \(total) lessons read\(signedIn ? "" : ", on this device")")
    }
}

// MARK: - The running footer

/// What came before and what comes after, set in the footer margin. Crosses module lines,
/// like the site (prev and next run through the whole department in course order).
struct LessonPagination: View {
    let department: Department
    let previous: LessonLocation?
    let next: LessonLocation?
    let isWide: Bool
    let onLesson: (LessonLocation) -> Void
    let onOpen: (AppRoute) -> Void

    var body: some View {
        Group {
            if isWide {
                HStack(alignment: .top, spacing: 32) {
                    before.frame(maxWidth: .infinity, alignment: .leading)
                    after.frame(maxWidth: .infinity, alignment: .trailing)
                }
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    before
                    after
                        .padding(.top, 6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .overlay(alignment: .top) { DashedRule() }
                }
            }
        }
        .padding(.top, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) { InkRule() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lesson pagination")
    }

    @ViewBuilder
    private var before: some View {
        if let previous {
            PageLink(slug: "← the lesson before", title: previous.lesson.title, trailing: false) {
                onLesson(previous)
            }
            .accessibilityLabel("The lesson before: \(previous.lesson.title)")
        } else {
            VStack(alignment: .leading, spacing: 4) {
                SlugText("← the start of the guide")
                Text("This is the first lesson in \(department.name)")
                    .font(LF.Fonts.body(16, weight: .bold, relativeTo: .callout))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 8)
            .accessibilityElement(children: .combine)
        }
    }

    private var after: some View {
        PageLink(
            slug: next == nil ? "back to the department →" : "the lesson after →",
            title: next?.lesson.title ?? department.name,
            trailing: isWide
        ) {
            if let next { onLesson(next) } else { onOpen(.department(department.id)) }
        }
        .accessibilityLabel(next.map { "The lesson after: \($0.lesson.title)" } ?? "Back to \(department.name)")
    }
}

private struct PageLink: View {
    let slug: String
    let title: String
    let trailing: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            VStack(alignment: trailing ? .trailing : .leading, spacing: 4) {
                SlugText(slug)
                Text(title)
                    .font(LF.Fonts.body(16, weight: .bold, relativeTo: .callout))
                    .foregroundStyle(hovering ? LF.Palette.blue : LF.Palette.ink)
                    .multilineTextAlignment(trailing ? .trailing : .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, minHeight: LF.Metrics.tap, alignment: trailing ? .trailing : .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }
}

// MARK: - The whole department, folded away

/// Every lesson in the guide, closed by default (a reader mid-lesson didn't ask for an
/// index). Open, it's the contents page: modules ruled off, lessons under them, the one
/// you're on marked by a bar and bold type, not only by colour. It opens instantly.
struct LessonContentsView: View {
    let department: Department
    let currentID: UUID
    let completed: Set<UUID>
    let columns: Int
    let onLesson: (UUID) -> Void

    @State private var isOpen = false
    @ScaledMetric(relativeTo: .body) private var padding: CGFloat = 18

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                isOpen.toggle()
            } label: {
                HStack(spacing: 12) {
                    Text("All \(department.lessonCount) lessons in \(department.name)")
                        .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                        .foregroundStyle(LF.Palette.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 8)
                    SlugText(isOpen ? "close" : "open", color: LF.Palette.blue)
                }
                .padding(.horizontal, LessonLayout.cardPadding(padding))
                .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            // Read like a system disclosure: the name, then its state (not the printed
            // "open" or "close", which say what a tap does).
            .accessibilityLabel("All \(department.lessonCount) lessons in \(department.name)")
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint(isOpen ? "Hides the list" : "Lists every lesson in the department")
            #if os(macOS)
            .pointerStyle(.link)
            #endif

            if isOpen {
                HStack(alignment: .top, spacing: 36) {
                    ForEach(Array(splitModules.enumerated()), id: \.offset) { _, modules in
                        VStack(alignment: .leading, spacing: 18) {
                            ForEach(modules, id: \.module.id) { entry in
                                moduleBlock(entry.module, number: entry.number)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                }
                .padding(.horizontal, LessonLayout.cardPadding(padding))
                .padding(.top, 8)
                .padding(.bottom, LessonLayout.cardPadding(padding))
                .overlay(alignment: .top) { InkRule() }
            }
        }
        .clipShape(HandShape(.a).inset(by: LF.Metrics.stroke))
        .background { NotebookBoxBackground(size: .a, shadow: .card) }
    }

    private func moduleBlock(_ module: Module, number: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            SlugText(String(format: "%02d / %@", number, module.slug))
                .padding(.top, 10)
                .padding(.bottom, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { DashedRule() }
            ForEach(module.lessons) { lesson in
                ContentsRow(
                    title: lesson.title,
                    isCurrent: lesson.id == currentID,
                    isDone: completed.contains(lesson.id)
                ) {
                    onLesson(lesson.id)
                }
            }
        }
    }

    /// Modules split into columns by lesson count, top to bottom then across (CSS columns).
    private var splitModules: [[(module: Module, number: Int)]] {
        let numbered = department.modules.enumerated().map { (module: $0.element, number: $0.offset + 1) }
        let count = max(1, columns)
        guard count > 1 else { return [numbered] }
        let total = numbered.reduce(0) { $0 + $1.module.lessons.count + 1 }
        let target = Double(total) / Double(count)
        var out: [[(module: Module, number: Int)]] = [[]]
        var running = 0
        for entry in numbered {
            let weight = entry.module.lessons.count + 1
            if out.count < count, !out[out.count - 1].isEmpty, Double(running) + Double(weight) / 2 > target * Double(out.count) {
                out.append([])
            }
            out[out.count - 1].append(entry)
            running += weight
        }
        return out
    }
}

private struct ContentsRow: View {
    let title: String
    let isCurrent: Bool
    let isDone: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                // Filled when read, a dashed empty square when not: shape, not hue.
                Group {
                    if isDone {
                        Rectangle().fill(LF.Palette.blue)
                            .overlay { Rectangle().strokeBorder(LF.Palette.blue, lineWidth: 2) }
                    } else {
                        Rectangle().strokeBorder(LF.Palette.graphite, style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
                    }
                }
                .frame(width: 10, height: 10)
                .accessibilityHidden(true)
                Text(title)
                    .font(LF.Fonts.body(15, weight: isCurrent ? .bold : .regular, relativeTo: .subheadline))
                    .foregroundStyle(isCurrent || hovering ? LF.Palette.ink : LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 6)
            .padding(.leading, 10)
            .frame(minHeight: LF.Metrics.tap)
            .background(isCurrent ? LF.Palette.rowWash : .clear)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(isCurrent ? LF.Palette.blue : (hovering ? LF.Palette.rule : .clear))
                    .frame(width: 3)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .accessibilityLabel("\(isDone ? "Read" : "Not read yet"): \(title)")
        .accessibilityAddTraits(isCurrent ? .isSelected : [])
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }
}

// MARK: - Previews

#Preview("Guest band, iPhone", traits: .fixedLayout(width: 393, height: 1150)) {
    ScrollView {
        VStack(spacing: 28) {
            LessonSignupHookView(departmentName: "Programming, Controls & Sensors", position: 4, count: 51, total: 0, inDepartment: 0, onAccount: { _ in }, onQuiz: {})
            LessonSignupHookView(departmentName: "Programming, Controls & Sensors", position: 4, count: 51, total: 1, inDepartment: 1, onAccount: { _ in }, onQuiz: {})
        }
        .padding(LF.Metrics.gutter)
    }
    .paperBackground()
}
