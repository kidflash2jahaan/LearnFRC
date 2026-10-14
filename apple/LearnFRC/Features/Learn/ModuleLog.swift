import SwiftUI

/// A department's curriculum as the log it is (the site's `DepartmentModules`): each
/// module opens on a heavy ink rule with its stamped number, title and count, and unfolds
/// into the list of its lessons with a tick in the margin. The first module starts open.
struct LearnModuleLog: View {
    let department: Department
    let layout: LearnLayout

    @State private var open: Set<UUID>
    /// The department `open` was kept for. A view reused for another department starts
    /// again from its first module rather than from the last one's choices.
    @State private var openDepartment: UUID
    @Environment(ProgressStore.self) private var progress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(department: Department, layout: LearnLayout) {
        self.department = department
        self.layout = layout
        _open = State(initialValue: Self.firstOpen(department))
        _openDepartment = State(initialValue: department.id)
    }

    private static func firstOpen(_ department: Department) -> Set<UUID> {
        Set(department.modules.prefix(1).map(\.id))
    }

    /// The modules showing their lessons in this department.
    private var openModules: Set<UUID> {
        openDepartment == department.id ? open : Self.firstOpen(department)
    }

    /// Prerequisite modules read `pre`; the rest are numbered 1..N.
    private var numbers: [UUID: String] {
        var labels: [UUID: String] = [:]
        var n = 0
        for module in department.modules {
            if module.isPrerequisite {
                labels[module.id] = "pre"
            } else {
                n += 1
                labels[module.id] = "\(n)"
            }
        }
        return labels
    }

    var body: some View {
        let numbers = numbers
        VStack(alignment: .leading, spacing: 0) {
            ForEach(department.modules) { module in
                moduleSection(module, number: numbers[module.id] ?? "")
            }
            InkRule()
        }
    }

    // MARK: A module

    private func moduleSection(_ module: Module, number: String) -> some View {
        let isOpen = openModules.contains(module.id)
        let counts = progress.moduleProgress(module)
        let percent = counts.total > 0 ? Int((Double(counts.done) / Double(counts.total) * 100).rounded()) : 0
        let isPre = module.isPrerequisite

        return VStack(alignment: .leading, spacing: 0) {
            InkRule()
            Button {
                toggle(module.id)
            } label: {
                header(module, number: number, isPre: isPre, isOpen: isOpen,
                       done: counts.done, total: counts.total, percent: percent)
            }
            .buttonStyle(LearnWashButtonStyle())
            // A disclosure the way iOS reads one: what the row is, then its state as the
            // value ("Collapsed" / "Expanded"), then what activating it does. The "+" and
            // "-" box is drawn, not read, so the state isn't spoken twice.
            .accessibilityLabel("\(isPre ? "Start here: \(module.title)" : "Module \(number): \(module.title)"), \(counts.done) of \(LearnFormat.plural(counts.total, "lesson", "lessons")) done")
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint(isOpen ? "Hides this module's lessons" : "Shows this module's lessons")

            if isOpen {
                panel(module, number: number, isPre: isPre)
                    .transition(.opacity)
            }
        }
    }

    /// The stamped number, the title with its count, and the "+" box. At the accessibility
    /// sizes the two boxes share a row above the title, so the title and count get the full
    /// width instead of a column a few letters wide ("Cultur / e, Team / s").
    private func header(_ module: Module, number: String, isPre: Bool, isOpen: Bool,
                        done: Int, total: Int, percent: Int) -> some View {
        let numberBox = LearnStampedBox(side: 44) {
            Text(isPre ? "pre" : LearnFormat.ordinal(Int(number) ?? 0))
                .font(LF.Fonts.mono(14, weight: .bold, relativeTo: .callout))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.ink)
        }
        let toggleBox = LearnStampedBox(side: 32) {
            Text(isOpen ? "-" : "+")
                .font(LF.Fonts.mono(17, weight: .bold, relativeTo: .body))
                .foregroundStyle(LF.Palette.blue)
        }
        .accessibilityHidden(true)
        let titleBlock = VStack(alignment: .leading, spacing: 5) {
            if isPre {
                TagView("start here")
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                LearnWholeWords(text: module.title) { string in
                    Text(string)
                        .font(LF.Fonts.display(19, relativeTo: .title3))
                        .tracking(-0.47)
                        .foregroundStyle(LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if total > 0 && done >= total {
                    PenCheckMark(size: 13)
                }
            }
            SlugText(layout.isRegular
                ? "\(isPre ? "recommended first, " : "")\(done) of \(LearnFormat.plural(total, "lesson", "lessons"))"
                : "\(isPre ? "recommended first, " : "")\(done) of \(LearnFormat.plural(total, "lesson", "lessons")), \(percent)%")
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        let meter = MeterView(value: total > 0 ? Double(done) / Double(total) : 0, style: .slim)

        return Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .center) {
                        numberBox
                        Spacer(minLength: 12)
                        toggleBox
                    }
                    titleBlock
                    if layout.isRegular {
                        meter.frame(maxWidth: 260)
                    }
                }
            } else {
                HStack(alignment: .center, spacing: layout.isRegular ? 18 : 12) {
                    numberBox
                    titleBlock
                    if layout.isRegular {
                        meter.frame(width: 130)
                    }
                    toggleBox
                }
            }
        }
        .padding(.vertical, layout.isRegular ? 20 : 15)
        .contentShape(Rectangle())
    }

    // MARK: The open panel

    private func panel(_ module: Module, number: String, isPre: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let overview = module.overview, !overview.isEmpty {
                Text(overview)
                    .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .learnMeasure(62)
            }
            NavigationLink(value: AppRoute.module(module.id)) {
                LearnLinkLabel(title: "Read the module overview", systemImage: "arrow.right")
            }
            .buttonStyle(.plain)
            .padding(.top, 4)

            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(module.lessons.enumerated()), id: \.element.id) { index, lesson in
                    lessonRow(lesson, label: "\(isPre ? "P" : number).\(index + 1)")
                }
            }
            .padding(.top, 6)
        }
        .padding(.leading, layout.isRegular ? 62 : 0)
        .padding(.bottom, 22)
    }

    /// The tick, the lesson's number and title, and its minutes on the right. At the
    /// accessibility sizes the minutes go under the title and the number above it, so the
    /// title isn't squeezed into a column two letters wide.
    private func lessonRow(_ lesson: LessonSummary, label: String) -> some View {
        let done = progress.isCompleted(lesson.id)
        let pending = progress.isPending(lesson.id)
        let number = SlugText(label, color: LF.Palette.blue, weight: .bold)
            .fixedSize()
        let title = LearnWholeWords(text: lesson.title) { string in
            Text(string)
                .font(LF.Fonts.body(16))
                .foregroundStyle(LF.Palette.ink)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        let minutes = lesson.estimatedMinutes > 0 ? "\(lesson.estimatedMinutes) min" : nil
        return NavigationLink(value: AppRoute.lesson(lesson.id)) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .center, spacing: 12) {
                            LearnTickBox(done: done)
                            number
                        }
                        title
                        if pending {
                            SlugText("saved, will sync")
                        }
                        if let minutes {
                            SlugText(minutes)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        LearnTickBox(done: done)
                            .alignmentGuide(.firstTextBaseline) { d in d[.bottom] - 4 }
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                number
                                title
                            }
                            if pending {
                                SlugText("saved, will sync")
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        if let minutes {
                            SlugText(minutes)
                                .fixedSize()
                        }
                    }
                }
            }
            .padding(.vertical, 11)
            .overlay(alignment: .bottom) { DashedRule() }
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel("Lesson \(label): \(lesson.title)")
        .accessibilityValue(LearnFormat.lessonState(done: done, pending: pending, minutes: lesson.estimatedMinutes))
    }

    private func toggle(_ id: UUID) {
        Haptics.select()
        LF.Motion.perform(LF.Motion.arrive) {
            var modules = openModules
            if modules.contains(id) { modules.remove(id) } else { modules.insert(id) }
            open = modules
            openDepartment = department.id
        }
    }
}

/// A full-width disclosure header: a faint blue wash under a pointer or while held,
/// no slide (it doesn't go anywhere, it opens).
struct LearnWashButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        LearnWashButton(configuration: configuration)
    }
}

private struct LearnWashButton: View {
    let configuration: ButtonStyleConfiguration
    @State private var isHovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        configuration.label
            .foregroundStyle(LF.Palette.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                Rectangle().fill(isHovering || configuration.isPressed ? LF.Palette.rowWash : .clear)
            }
            .contentShape(Rectangle())
            .onHover { isHovering = $0 }
            #if os(iOS)
            .hoverEffectDisabled()
            #endif
            .animation(reduceMotion ? nil : LF.Motion.hover, value: isHovering)
    }
}

#Preview("Module log, iPhone", traits: .fixedLayout(width: 393, height: 1100)) {
    NavigationStack {
        ScrollView {
            LearnModuleLog(department: PreviewData.department, layout: LearnLayout(width: 393))
                .learnColumn(LearnLayout(width: 393))
                .padding(.vertical, 20)
        }
        .paperBackground()
    }
    .appEnvironment(.preview)
}

#Preview("Module log, iPad, dark", traits: .fixedLayout(width: 834, height: 1000)) {
    NavigationStack {
        ScrollView {
            LearnModuleLog(department: PreviewData.businessDepartment, layout: LearnLayout(width: 834))
                .learnColumn(LearnLayout(width: 834))
                .padding(.vertical, 20)
        }
        .paperBackground()
    }
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}
