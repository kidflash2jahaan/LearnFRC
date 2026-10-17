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
    static func numbers(in department: Department) -> [UUID: String] {
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
        let numbers = Self.numbers(in: department)
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
                    LearnModuleLessonRow(lesson: lesson, label: "\(isPre ? "P" : number).\(index + 1)")
                }
            }
            .padding(.top, 6)
        }
        .padding(.leading, layout.isRegular ? 62 : 0)
        .padding(.bottom, 22)
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

/// One lesson in a module's list: the tick, the lesson's number and title, and its minutes on
/// the right. At the accessibility sizes the minutes go under the title and the number above
/// it, so the title isn't squeezed into a column two letters wide.
struct LearnModuleLessonRow: View {
    let lesson: LessonSummary
    let label: String

    @Environment(ProgressStore.self) private var progress
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
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
        NavigationLink(value: AppRoute.lesson(lesson.id)) {
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
}

// MARK: - Two pages

/// The department's modules as a list to choose from, on iPhone Duo's leading page: picking
/// one shows its lessons on the next page (`LearnModulePage`). Each row is the log's header,
/// the stamped number, the title with its count and the meter, and the chosen one is marked
/// three ways (a blue bar, a wash and "lessons on the next page"), so the state never rests
/// on colour alone.
struct LearnModuleIndex: View {
    let department: Department
    let selected: UUID?
    let onSelect: (Module) -> Void

    @Environment(ProgressStore.self) private var progress
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let numbers = LearnModuleLog.numbers(in: department)
        VStack(alignment: .leading, spacing: 0) {
            ForEach(department.modules) { module in
                InkRule()
                row(module, number: numbers[module.id] ?? "")
            }
            InkRule()
        }
    }

    private func row(_ module: Module, number: String) -> some View {
        let isSelected = module.id == selected
        let counts = progress.moduleProgress(module)
        let percent = counts.total > 0 ? Int((Double(counts.done) / Double(counts.total) * 100).rounded()) : 0
        let isPre = module.isPrerequisite
        let numberBox = LearnStampedBox(side: 44) {
            Text(isPre ? "pre" : LearnFormat.ordinal(Int(number) ?? 0))
                .font(LF.Fonts.mono(14, weight: .bold, relativeTo: .callout))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.ink)
        }
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
                if counts.total > 0 && counts.done >= counts.total {
                    PenCheckMark(size: 13)
                }
            }
            SlugText("\(isPre ? "recommended first, " : "")\(counts.done) of \(LearnFormat.plural(counts.total, "lesson", "lessons")), \(percent)%")
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            if isSelected {
                SlugText("lessons on the next page", color: LF.Palette.blue, weight: .bold)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        let arrow = Image(systemName: "chevron.forward")
            .font(.footnote.weight(.bold))
            .foregroundStyle(isSelected ? LF.Palette.blue : LF.Palette.graphite)
            .accessibilityHidden(true)

        return Button {
            onSelect(module)
        } label: {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .center) {
                            numberBox
                            Spacer(minLength: 12)
                            arrow
                        }
                        titleBlock
                    }
                } else {
                    HStack(alignment: .center, spacing: 12) {
                        numberBox
                        titleBlock
                        arrow
                    }
                }
            }
            .padding(.vertical, 15)
            .padding(.leading, 12)
            .padding(.trailing, 6)
            .background(isSelected ? LF.Palette.rowWash : Color.clear)
            .overlay(alignment: .leading) {
                if isSelected {
                    Rectangle().fill(LF.Palette.blue).frame(width: LF.Metrics.heavyStroke)
                }
            }
            .frame(minHeight: LF.Metrics.tap)
            .contentShape(Rectangle())
        }
        .buttonStyle(LearnWashButtonStyle())
        .accessibilityLabel("\(isPre ? "Start here: \(module.title)" : "Module \(number): \(module.title)"), \(counts.done) of \(LearnFormat.plural(counts.total, "lesson", "lessons")) done")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityHint(isSelected ? "Its lessons are on the next page" : "Shows its lessons on the next page")
    }
}

/// One module's lessons as a page of their own: iPhone Duo's trailing page beside the
/// department's list of modules (`LearnModuleIndex`). Where the module sits, its name, how
/// far in the reader is, the overview, the way to the module's own page, and the lessons.
struct LearnModulePage: View {
    let department: Department
    let module: Module

    @Environment(ProgressStore.self) private var progress

    var body: some View {
        let number = LearnModuleLog.numbers(in: department)[module.id] ?? ""
        let isPre = module.isPrerequisite
        let counts = progress.moduleProgress(module)
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(isPre ? "start here, before the numbered modules" : "module \(number) of \(department.modules.count)")
            LearnWholeWords(text: module.title) { string in
                Text(string)
                    .lfTitle(.h2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 12)
            MeterView(value: counts.total > 0 ? Double(counts.done) / Double(counts.total) : 0,
                      label: "\(counts.done) of \(LearnFormat.plural(counts.total, "lesson", "lessons")) done",
                      valueText: "\(counts.done)/\(counts.total)")
                .padding(.top, 16)
            if let overview = module.overview, !overview.isEmpty {
                Text(overview)
                    .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .learnMeasure(62)
                    .padding(.top, 16)
            }
            NavigationLink(value: AppRoute.module(module.id)) {
                LearnLinkLabel(title: "Read the module overview", systemImage: "arrow.right")
            }
            .buttonStyle(.plain)
            .padding(.top, 4)

            if module.lessons.isEmpty {
                LearnNotice(kicker: "nothing filed here yet",
                            message: "This module has no published lessons yet. The rest of the department is ready to read.")
                    .padding(.top, 14)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    InkRule()
                    ForEach(Array(module.lessons.enumerated()), id: \.element.id) { index, lesson in
                        LearnModuleLessonRow(lesson: lesson, label: "\(isPre ? "P" : number).\(index + 1)")
                    }
                }
                .padding(.top, 10)
            }
        }
        .accessibilityElement(children: .contain)
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
