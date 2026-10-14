import SwiftUI

/// One department, as a sheet out of the binder (learnfrc.com/guides/{department}).
///
/// The masthead names it and offers the one action that fits where the reader is
/// (start, continue or review). A taped title block prints every figure once, with how
/// far in the reader is. For anyone with progress, the next lesson is named, with the
/// week and the nearest badge. Then the module log, the field notes in the margin, and a
/// sign-off that points at the certificate once every lesson is done.
struct DepartmentView: View {
    let departmentID: UUID

    @Environment(CatalogStore.self) private var catalog
    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.isPresented) private var isPresented
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(departmentID: UUID) {
        self.departmentID = departmentID
    }

    var body: some View {
        if let department = catalog.department(id: departmentID) {
            content(department)
        } else {
            LearnScrollPage(title: "Department", refresh: { await model.refreshAll() }, place: .route(.department(departmentID))) { layout, _ in
                Group {
                    if !catalog.isLoaded {
                        LearnLoadingBlock(rows: 3)
                    } else {
                        LearnNotice(kicker: "guides / not found",
                                    message: "This department isn't in the catalogue on this device. \(LearnFormat.checkSite) for changes.")
                    }
                }
                .learnColumn(layout)
                .padding(.top, 24)
            }
        }
    }

    // MARK: Progress

    private struct Standing {
        let done: Int
        let total: Int
        let tracked: Bool
        let next: LessonLocation?

        var percent: Int { total > 0 ? Int((Double(done) / Double(total) * 100).rounded()) : 0 }
        var fraction: Double { total > 0 ? Double(done) / Double(total) : 0 }
        var isComplete: Bool { total > 0 && done >= total }

        /// Never "Start learning" to someone forty lessons in.
        var action: String { done == 0 ? "Start learning" : (isComplete ? "Review" : "Continue") }
    }

    private func standing(of department: Department) -> Standing {
        let lessons = catalog.lessons(in: department)
        let done = lessons.reduce(0) { $0 + (progress.isCompleted($1.id) ? 1 : 0) }
        let next = lessons.first { !progress.isCompleted($0.id) } ?? lessons.first
        return Standing(done: done, total: lessons.count,
                        tracked: account.isSignedIn || progress.completedTotal > 0, next: next)
    }

    // MARK: Content

    private func content(_ department: Department) -> some View {
        let standing = standing(of: department)
        return LearnScrollPage(title: department.name, refresh: { await model.refreshAll() }, place: .route(.department(departmentID))) { layout, _ in
            masthead(department, standing: standing, layout: layout)
                .learnColumn(layout)
                .padding(.top, 18)

            titleBlock(department, standing: standing, layout: layout)
                .learnColumn(layout)
                .padding(.top, 34)

            progressStack(department, standing: standing, layout: layout)
                .learnColumn(layout)

            pathAndMargin(department, layout: layout)
                .learnColumn(layout)
                .padding(.top, 44)

            signOff(department, standing: standing, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: department.webURL, subject: Text(department.name),
                          message: Text(department.tagline ?? "Free FRC lessons on LearnFRC")) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .learnHandoff(department.webURL, place: .route(.department(departmentID)))
    }

    // MARK: Masthead

    @ViewBuilder
    private func masthead(_ department: Department, standing: Standing, layout: LearnLayout) -> some View {
        if layout.isRegular, standing.tracked {
            HStack(alignment: .top, spacing: 40) {
                mastheadText(department, standing: standing)
                    .frame(maxWidth: .infinity, alignment: .leading)
                // The certificate's state, where there's room for it: the stamp once every
                // lesson is done, the dashed unsigned box with the figure until then.
                Group {
                    if standing.isComplete {
                        StampView("Signed off", caption: "dept / \(department.slug)", lands: false)
                    } else {
                        PendingStampView(percent: standing.percent)
                    }
                }
                .padding(.top, 40)
                .padding(.trailing, 12)
            }
        } else {
            // No certificate column to sit beside: just the text.
            mastheadText(department, standing: standing)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func mastheadText(_ department: Department, standing: Standing) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LearnTrail(parts: ["guides", department.slug])
            Text(department.name)
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 600, alignment: .leading)
                .padding(.top, 16)
            if let tagline = department.tagline, !tagline.isEmpty {
                LearnLede(tagline)
                    .padding(.top, 16)
            }
            if let description = department.description, !description.isEmpty {
                Text(description)
                    .lfProse(16, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .learnMeasure(62)
                    .padding(.top, 12)
            }
            ctaRow(department, standing: standing, footer: false)
                .padding(.top, 22)
            // MarkerText shrinks a hair rather than lose a line at the accessibility sizes
            // (this note once ended in "thes..." on iPhone at AX5).
            MarkerText("nobody reads these in order, that is fine")
                .padding(.top, 18)
        }
    }

    @ViewBuilder
    private func ctaRow(_ department: Department, standing: Standing, footer: Bool) -> some View {
        let buttons = Group {
            if let next = standing.next {
                NavigationLink(value: AppRoute.lesson(next.lesson.id)) {
                    Text(standing.action)
                }
                .buttonStyle(.ink)
                .accessibilityHint(next.lesson.title)
            }
            if standing.tracked && standing.isComplete {
                NavigationLink(value: AppRoute.certificate(department.id)) {
                    Text("Get the certificate")
                }
                .buttonStyle(.inkGhost)
            } else if footer {
                Button {
                    backToAllDepartments()
                } label: {
                    // "departments" is wider than the button at the largest text sizes.
                    LearnWholeWords(text: "Back to all departments") { Text($0) }
                }
                .buttonStyle(.inkGhost)
            }
        }
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { buttons }
            VStack(alignment: .leading, spacing: 12) { buttons }
        }
    }

    /// Pops back when this page was pushed; when it's a root (an iPad sidebar entry),
    /// opens the Learn tab's wall instead.
    private func backToAllDepartments() {
        if isPresented {
            dismiss()
        } else {
            model.popToRoot(.learn)
            model.selectedTab = .learn
        }
    }

    // MARK: Title block

    /// Every figure on the page, printed once. Four cells ruled apart; on a phone each
    /// cell is a `label .... figure` line.
    private func titleBlock(_ department: Department, standing: Standing, layout: LearnLayout) -> some View {
        let hours = LearnFormat.hours(fromMinutes: department.totalMinutes)
        let hint = !standing.tracked
            ? "reading is free, no account needed"
            : (standing.isComplete ? "finished, certificate unlocked" : "\(standing.done) of \(standing.total) lessons done")

        return NotebookCard(tilt: .degrees(-0.35), padding: 0) {
            Group {
                if layout.isRegular {
                    HStack(alignment: .top, spacing: 0) {
                        figureCell(label: "modules", value: department.modules.count.formatted(), unit: nil, stacked: true)
                        verticalRule
                        figureCell(label: "lessons", value: department.lessonCount.formatted(), unit: nil, stacked: true)
                        verticalRule
                        figureCell(label: "reading time", value: hours.formatted(), unit: "hours", stacked: true)
                        verticalRule
                        masteryCell(standing: standing, hint: hint, stacked: true)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        figureCell(label: "modules", value: department.modules.count.formatted(), unit: nil, stacked: false)
                        InkRule()
                        figureCell(label: "lessons", value: department.lessonCount.formatted(), unit: nil, stacked: false)
                        InkRule()
                        figureCell(label: "reading time", value: hours.formatted(), unit: "hours", stacked: false)
                        InkRule()
                        masteryCell(standing: standing, hint: hint, stacked: false)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            // The cells are ruled edge to edge, and the card's hand-drawn edge bows in, so
            // the rules are clipped to the same outline the border is drawn on. With no
            // padding and the tape drawn here rather than by the card, the content's frame
            // is the card's frame and the two outlines match exactly.
            .clipShape(HandShape(.a))
            .overlay(alignment: .topLeading) {
                TapeStrip(angle: -3.4)
                    .offset(x: 16, y: -12)
            }
        }
    }

    private var verticalRule: some View {
        Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.stroke)
    }

    private func figureCell(label: String, value: String, unit: String?, stacked: Bool) -> some View {
        Group {
            if stacked {
                VStack(alignment: .leading, spacing: 14) {
                    SlugText(label)
                    CountText(value, unit: unit, size: 30)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else {
                LearnLabelledFigure {
                    SlugText(label)
                } figure: {
                    CountText(value, unit: unit, size: 26)
                }
            }
        }
        .padding(stacked ? 22 : 16)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)\(unit.map { " \($0)" } ?? "")")
    }

    private func masteryCell(standing: Standing, hint: String, stacked: Bool) -> some View {
        VStack(alignment: .leading, spacing: stacked ? 14 : 8) {
            if stacked {
                SlugText("mastered")
                CountText(standing.percent.formatted(), unit: "per cent", size: 30)
            } else {
                LearnLabelledFigure {
                    SlugText("mastered")
                } figure: {
                    CountText(standing.percent.formatted(), unit: "per cent", size: 26)
                }
            }
            MeterView(value: standing.fraction, style: .slim)
                .accessibilityHidden(true)
            FieldHint(hint)
        }
        .padding(stacked ? 22 : 16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Mastered: \(standing.percent) percent")
        .accessibilityValue(hint)
    }

    // MARK: Progress stack

    /// Where am I this week, what do I press now, what's next to earn. Only for someone
    /// with progress to show; a reader with no history isn't shown empty slots.
    @ViewBuilder
    private func progressStack(_ department: Department, standing: Standing, layout: LearnLayout) -> some View {
        let showResume = standing.done > 0 && !standing.isComplete && standing.next != nil
        let rhythm = account.isSignedIn ? progress.rhythm : nil
        let unlock = account.isSignedIn ? progress.nextUnlock : nil
        if showResume || rhythm != nil || unlock != nil {
            VStack(alignment: .leading, spacing: 16) {
                if showResume, let next = standing.next {
                    LearnResumeBar(location: next, kicker: "pick up where you left off", action: "Resume")
                }
                let extras = Group {
                    if let rhythm {
                        LearnWeekMeter(rhythm: rhythm, copy: progress.rhythmCopy, onDevice: progress.rhythmIsOnDevice)
                    }
                    if let unlock {
                        LearnNextUnlockCard(unlock: unlock, layout: LearnLayout(width: layout.isWide ? layout.width / 2 : layout.width))
                    }
                }
                if layout.isWide {
                    HStack(alignment: .top, spacing: 16) { extras }
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    extras
                }
            }
            .frame(maxWidth: layout.isWide ? .infinity : 720, alignment: .leading)
            .padding(.top, 30)
        }
    }

    // MARK: The path and the margin

    @ViewBuilder
    private func pathAndMargin(_ department: Department, layout: LearnLayout) -> some View {
        let path = VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the path", title: "Modules and lessons")
            LearnModuleLog(department: department, layout: layout)
                .padding(.top, 22)
        }
        let hasMargin = !department.whatYoullLearn.isEmpty || !department.tools.isEmpty
            || !department.prerequisites.isEmpty || !department.sources.isEmpty

        if layout.isWide && hasMargin {
            HStack(alignment: .top, spacing: 44) {
                path.frame(maxWidth: .infinity, alignment: .leading)
                LearnFieldNotes(department: department)
                    .frame(width: min(320, layout.contentWidth * 0.3))
                    .padding(.top, 8)
            }
        } else {
            VStack(alignment: .leading, spacing: 44) {
                path
                if hasMargin {
                    LearnFieldNotes(department: department)
                        .frame(maxWidth: 640, alignment: .leading)
                }
            }
        }
    }

    // MARK: Sign-off

    private func signOff(_ department: Department, standing: Standing, layout: LearnLayout) -> some View {
        let heading = standing.isComplete
            ? "You've finished this department."
            : (standing.done > 0 ? "Pick up where you left off." : "Ready to take on \(department.name)?")
        var line = "\(LearnFormat.plural(department.modules.count, "module", "modules")) and \(LearnFormat.plural(department.lessonCount, "lesson", "lessons")), free to read without an account, written against the real Game Manual and the WPILib docs."
        if !account.isSignedIn {
            // Guests' ticks already stick on this device, so the account's pitch is what it
            // adds on top: the same ticks everywhere, and the certificate.
            line += " This device keeps your ticks. A free account carries them to every device and adds the certificate at the end."
        }
        return VStack(alignment: .leading, spacing: 0) {
            InkRule()
            Text(heading)
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 28)
            LearnSub(line)
                .padding(.top, 12)
            ctaRow(department, standing: standing, footer: true)
                .padding(.top, 22)
        }
    }
}

// MARK: - Field notes

/// The margin: one sheet of notes ruled into sections (what you'll learn, the tools,
/// what to know first, where it comes from), rather than four separate cards.
struct LearnFieldNotes: View {
    let department: Department

    private enum Note: Hashable {
        case learn, tools, before, sources

        var title: String {
            switch self {
            case .learn: "What you will learn"
            case .tools: "Tools you will touch"
            case .before: "Before you start"
            case .sources: "Where this comes from"
            }
        }
    }

    private var notes: [Note] {
        var notes: [Note] = []
        if !department.whatYoullLearn.isEmpty { notes.append(.learn) }
        if !department.tools.isEmpty { notes.append(.tools) }
        if !department.prerequisites.isEmpty { notes.append(.before) }
        if !department.sources.isEmpty { notes.append(.sources) }
        return notes
    }

    @ViewBuilder
    private func noteContent(_ note: Note) -> some View {
        switch note {
        case .learn: bullets(department.whatYoullLearn, mono: false)
        case .tools: bullets(department.tools, mono: true)
        case .before: bullets(department.prerequisites, mono: false)
        case .sources: sources
        }
    }

    var body: some View {
        NotebookCard(tilt: .degrees(0.25), tape: true, tapeAngle: 2.8) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(notes.enumerated()), id: \.element) { index, note in
                    section(note.title, isFirst: index == 0) {
                        noteContent(note)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Field notes")
    }

    private func section<Content: View>(_ title: String, isFirst: Bool, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if !isFirst {
                DashedRule().padding(.vertical, 8)
            }
            Text(title)
                .font(LF.Fonts.display(17, relativeTo: .headline))
                .tracking(-0.34)
                .foregroundStyle(LF.Palette.ink)
                .accessibilityAddTraits(.isHeader)
            content()
        }
        .padding(.bottom, 6)
    }

    private func bullets(_ items: [String], mono: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .firstTextBaseline, spacing: 9) {
                    Text("-")
                        .font(LF.Fonts.body(15, weight: .bold))
                        .foregroundStyle(LF.Palette.blue)
                        .accessibilityHidden(true)
                    LearnWholeWords(text: item) { string in
                        Group {
                            if mono {
                                Text(string).font(LF.Fonts.mono(12.5, relativeTo: .footnote))
                            } else {
                                Text(string).font(LF.Fonts.body(15)).lineHeight(.multiple(factor: 1.4))
                            }
                        }
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    private var sources: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(department.sources.prefix(8).enumerated()), id: \.element.id) { index, source in
                if index > 0 { DashedRule() }
                Link(destination: source.url) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        LearnWholeWords(text: source.title) { string in
                            Text(string)
                                .font(LF.Fonts.body(15))
                                .foregroundStyle(LF.Palette.ink)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "arrow.up.right")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(LF.Palette.graphite)
                            .accessibilityHidden(true)
                    }
                    .padding(.vertical, 10)
                    .frame(minHeight: LF.Metrics.tap)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.inkRow)
                .accessibilityHint("Opens in your browser")
            }
        }
    }
}

// MARK: - Previews

#Preview("Department, iPhone", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { DepartmentView(departmentID: PreviewData.department.id) }
        .appEnvironment(.preview)
}

#Preview("Department, iPhone, guest, dark", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { DepartmentView(departmentID: PreviewData.businessDepartment.id) }
        .appEnvironment(.preview(signedIn: false, phase: .new))
        .environment(\.colorScheme, .dark)
}

#Preview("Department, iPad", traits: .fixedLayout(width: 1180, height: 1800)) {
    NavigationStack { DepartmentView(departmentID: PreviewData.department.id) }
        .appEnvironment(.preview(phase: .goalMet))
}

#Preview("Department, iPad, dark", traits: .fixedLayout(width: 834, height: 1600)) {
    NavigationStack { DepartmentView(departmentID: PreviewData.businessDepartment.id) }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}
