import SwiftUI

/// One module, the card divider between two sections of the binder
/// (learnfrc.com/guides/{department}/{module}).
///
/// The top is written on the paper: the trail, where the module sits, its name, what it
/// is, and its figures ruled across. Then the lessons as a log you can run a finger down,
/// the module before and after, and the extras the site prints: the glossary terms this
/// module leans on, other departments with a module of the same name, articles that go
/// deeper, and the department's index with "you are here".
struct ModuleView: View {
    let moduleID: UUID

    @Environment(CatalogStore.self) private var catalog
    @Environment(ReferenceStore.self) private var reference
    @Environment(ProgressStore.self) private var progress
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Worked out once per module, off the render path (it runs a few hundred matches).
    @State private var extras: Extras?

    init(moduleID: UUID) {
        self.moduleID = moduleID
    }

    private struct Extras: Equatable {
        var moduleID: UUID
        var terms: [GlossaryTerm]
        var twins: [Twin]
        var articles: [Article]

        struct Twin: Equatable, Identifiable {
            let departmentName: String
            let moduleID: UUID
            let lessons: Int
            var id: UUID { moduleID }
        }
    }

    var body: some View {
        if let module = catalog.module(id: moduleID), let department = catalog.department(ofModule: moduleID) {
            content(module, department)
                .task(id: TaskKey(moduleID: moduleID, glossary: reference.glossary.count, articles: catalog.articles.count)) {
                    computeExtras(module, department)
                }
        } else {
            LearnScrollPage(title: "Module", refresh: { await model.refreshAll() }, place: .route(.module(moduleID))) { layout, _ in
                Group {
                    if !catalog.isLoaded {
                        LearnLoadingBlock(rows: 2)
                    } else {
                        LearnNotice(kicker: "guides / not found",
                                    message: "This module isn't in the catalogue on this device. \(LearnFormat.checkSite) for changes.")
                    }
                }
                .learnColumn(layout)
                .padding(.top, 24)
            }
        }
    }

    private struct TaskKey: Equatable {
        let moduleID: UUID
        let glossary: Int
        let articles: Int
    }

    private func computeExtras(_ module: Module, _ department: Department) {
        let twins = ModuleInsights.twins(of: module, in: department, catalog: catalog.departments).map {
            Extras.Twin(departmentName: $0.department.name, moduleID: $0.module.id, lessons: $0.module.lessons.count)
        }
        extras = Extras(
            moduleID: module.id,
            terms: ModuleInsights.terms(for: module, glossary: reference.glossary),
            twins: twins,
            articles: ModuleInsights.articles(for: module, articles: catalog.articles)
        )
    }

    // MARK: Content

    private func content(_ module: Module, _ department: Department) -> some View {
        let modules = department.modules
        let index = modules.firstIndex { $0.id == module.id } ?? 0
        let labels = ModuleInsights.labels(for: modules)
        let label = labels[index]
        let prev = index > 0 ? modules[index - 1] : nil
        let next = index < modules.count - 1 ? modules[index + 1] : nil
        let extras = extras?.moduleID == module.id ? extras : nil

        return LearnScrollPage(title: module.title, refresh: { await model.refreshAll() }, place: .route(.module(moduleID))) { layout, _ in
            tabDivider(module, department, label: label, layout: layout)
                .learnColumn(layout)
                .padding(.top, 18)

            lessons(module, layout: layout)
                .learnColumn(layout)
                .padding(.top, 44)

            pagination(department, prev: prev, next: next, layout: layout)
                .learnColumn(layout)
                .padding(.top, 34)

            if let extras, !extras.terms.isEmpty {
                jargon(extras.terms, layout: layout)
                    .learnColumn(layout)
                    .padding(.top, 48)
            }

            if let extras, !extras.twins.isEmpty {
                twins(extras.twins, module: module, department: department)
                    .learnColumn(layout)
                    .padding(.top, 40)
            }

            if let extras, !extras.articles.isEmpty {
                longerReads(extras.articles, layout: layout)
                    .learnColumn(layout)
                    .padding(.top, 48)
            }

            if modules.count > 1 {
                departmentIndex(department, current: module, labels: labels)
                    .learnColumn(layout)
                    .padding(.top, 52)
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: moduleURL(module, department), subject: Text(module.title),
                          message: Text("\(module.title), from the \(department.name) guide on LearnFRC")) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .learnHandoff(moduleURL(module, department), place: .route(.module(moduleID)))
    }

    private func moduleURL(_ module: Module, _ department: Department) -> URL {
        AppConfig.webBase.appending(path: "guides/\(department.slug)/\(module.slug)")
    }

    // MARK: Tab divider

    private func tabDivider(_ module: Module, _ department: Department, label: String, layout: LearnLayout) -> some View {
        let lessons = module.lessons
        let first = lessons.first
        let counts = progress.moduleProgress(module)
        let nextUp = lessons.firstIndex { !progress.isCompleted($0.id) }

        return VStack(alignment: .leading, spacing: 0) {
            LearnTrail(parts: ["guides", department.slug, module.slug])
            SectionLabel(module.isPrerequisite ? "start here, before the numbered modules" : "module \(label) of \(department.modules.count)")
                .padding(.top, 18)
            LearnWholeWords(text: module.title) { string in
                Text(string)
                    .lfTitle(.h1)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 640, alignment: .leading)
            .padding(.top, 14)
            LearnLede(ModuleInsights.overview(for: module, in: department, label: label))
                .padding(.top, 16)
            Text(ModuleInsights.fit(for: module, in: department))
                .lfProse(15.5, lineHeight: 1.6, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(58)
                .padding(.top, 14)

            LearnFigureRule(figures: figures(module, department), layout: layout)
                .padding(.top, 26)

            if let first {
                HStack(spacing: 12) {
                    if counts.done > 0, counts.done < counts.total, let nextUp {
                        NavigationLink(value: AppRoute.lesson(lessons[nextUp].id)) {
                            Text("Continue at lesson \(LearnFormat.ordinal(nextUp + 1))")
                        }
                        .buttonStyle(.ink)
                        .accessibilityHint(lessons[nextUp].title)
                    } else {
                        NavigationLink(value: AppRoute.lesson(first.id)) {
                            Text(lessons.count == 1 ? "Open the lesson" : "Start at lesson 01")
                        }
                        .buttonStyle(.ink)
                        .accessibilityHint(first.title)
                    }
                }
                .padding(.top, 24)
            }
        }
    }

    private func figures(_ module: Module, _ department: Department) -> [(label: String, value: String, unit: String?)] {
        var figures: [(label: String, value: String, unit: String?)] = [("lessons here", module.lessons.count.formatted(), nil)]
        if module.totalMinutes > 0 {
            figures.append(("reading time", module.totalMinutes.formatted(), "min"))
        }
        figures.append(("modules in \(department.slug)", department.modules.count.formatted(), nil))
        figures.append(("lessons in the guide", department.lessonCount.formatted(), nil))
        return figures
    }

    // MARK: Lessons

    private func lessons(_ module: Module, layout: LearnLayout) -> some View {
        let lessons = module.lessons
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .bottom, spacing: 28) {
                LearnSectionHeader(
                    kicker: "what is behind this tab",
                    title: "\(LearnFormat.plural(lessons.count, "lesson", "lessons")), in the order they were written."
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                if lessons.count > 1 && layout.isRegular {
                    MarkerText("you can read them out of order, nothing is locked", angle: 1.4)
                        .multilineTextAlignment(.trailing)
                        // Room for the last strokes (`PenOverhangRenderer`).
                        .padding(.trailing, 4)
                        .frame(maxWidth: 210, alignment: .trailing)
                }
            }
            if lessons.count > 1 && !layout.isRegular {
                MarkerText("you can read them out of order, nothing is locked")
                    .padding(.top, 12)
            }

            if lessons.isEmpty {
                LearnNotice(kicker: "nothing filed here yet",
                            message: "This module has no published lessons yet. The rest of the department is ready to read.")
                    .padding(.top, 22)
            } else {
                VStack(spacing: 0) {
                    InkRule()
                    ForEach(Array(lessons.enumerated()), id: \.element.id) { index, lesson in
                        lessonRow(lesson, index: index, layout: layout)
                    }
                }
                .padding(.top, 24)
            }
        }
    }

    private func lessonRow(_ lesson: LessonSummary, index: Int, layout: LearnLayout) -> some View {
        let done = progress.isCompleted(lesson.id)
        let pending = progress.isPending(lesson.id)
        let meta = "lesson \(LearnFormat.ordinal(index + 1))" + (lesson.estimatedMinutes > 0 ? " / \(lesson.estimatedMinutes) min" : "")
        return NavigationLink(value: AppRoute.lesson(lesson.id)) {
            LearnLogRow(layout: layout, trailing: "read it") {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    LearnTickBox(done: done)
                        .alignmentGuide(.firstTextBaseline) { d in d[.bottom] - 4 }
                    VStack(alignment: .leading, spacing: 3) {
                        SlugText(meta)
                        if pending {
                            SlugText("saved, will sync", color: LF.Palette.ink)
                        } else if done {
                            SlugText("done", color: LF.Palette.ink)
                        }
                    }
                }
            } main: {
                LearnRowText(title: lesson.title, summary: lesson.summary)
            }
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel("Lesson \(index + 1): \(lesson.title)")
        .accessibilityValue(LearnFormat.lessonState(done: done, pending: pending, minutes: lesson.estimatedMinutes))
        .accessibilityHint(lesson.summary ?? "")
    }

    // MARK: Pagination

    private func pagination(_ department: Department, prev: Module?, next: Module?, layout: LearnLayout) -> some View {
        let before = paginationLink(
            route: prev.map { AppRoute.module($0.id) } ?? .department(department.id),
            kicker: prev == nil ? "\u{2190} up to the department" : "\u{2190} the module before",
            title: prev?.title ?? department.name,
            trailing: false)
        let after = paginationLink(
            route: next.map { AppRoute.module($0.id) } ?? .department(department.id),
            kicker: next == nil ? "back to the department \u{2192}" : "the module after \u{2192}",
            title: next?.title ?? department.name,
            trailing: true)
        return VStack(alignment: .leading, spacing: 0) {
            InkRule()
            if layout.isRegular {
                HStack(alignment: .top, spacing: 32) {
                    before.frame(maxWidth: .infinity, alignment: .leading)
                    after.frame(maxWidth: .infinity, alignment: .trailing)
                }
                .padding(.top, 12)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    before
                    DashedRule()
                    after
                }
                .padding(.top, 6)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Module pagination")
    }

    private func paginationLink(route: AppRoute, kicker: String, title: String, trailing: Bool) -> some View {
        NavigationLink(value: route) {
            VStack(alignment: trailing ? .trailing : .leading, spacing: 5) {
                SlugText(kicker)
                LearnWholeWords(text: title) { string in
                    Text(string)
                        .font(LF.Fonts.body(16.5, weight: .bold))
                        .foregroundStyle(LF.Palette.ink)
                        .multilineTextAlignment(trailing ? .trailing : .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: trailing ? .trailing : .leading)
            .padding(.vertical, 10)
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel("\(kicker.replacingOccurrences(of: "\u{2190} ", with: "").replacingOccurrences(of: " \u{2192}", with: "")): \(title)")
    }

    // MARK: Jargon

    /// The taped card of terms the module's own text uses without explaining.
    private func jargon(_ terms: [GlossaryTerm], layout: LearnLayout) -> some View {
        NotebookCard(tilt: .degrees(-0.45), tape: true, tapeAngle: -4.2) {
            SlugText("words this module uses without explaining")
            Text(terms.count == 1 ? "The term to look up first" : "The terms to look up first")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            let columns = Array(repeating: GridItem(.flexible(), spacing: 32, alignment: .topLeading),
                                count: layout.isRegular ? 2 : 1)
            LazyVGrid(columns: columns, alignment: .leading, spacing: 0) {
                ForEach(terms) { term in
                    NavigationLink(value: AppRoute.glossaryTerm(term.slug)) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(term.term)
                                    .font(LF.Fonts.body(16.5, weight: .bold))
                                    .foregroundStyle(LF.Palette.ink)
                                    .underline(true, color: LF.Palette.blue)
                                if ModuleInsights.showsAbbreviation(term), let abbr = term.abbr {
                                    SlugText(abbr)
                                }
                            }
                            Text(ModuleInsights.shortDefinition(term.definition))
                                .font(LF.Fonts.body(15))
                                .lineHeight(.multiple(factor: 1.4))
                                .foregroundStyle(LF.Palette.graphite)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 12)
                        .overlay(alignment: .top) { DashedRule() }
                    }
                    .buttonStyle(.inkRow)
                    .accessibilityLabel(term.displayTitle)
                    .accessibilityValue(ModuleInsights.shortDefinition(term.definition))
                    .accessibilityHint("Opens the glossary entry")
                }
            }
            .padding(.top, 14)
        }
        .learnArrival(reduceMotion)
    }

    // MARK: Twins

    private func twins(_ twins: [Extras.Twin], module: Module, department: Department) -> some View {
        let count = module.lessons.count
        let minutes = module.totalMinutes
        return NoteCallout {
            SlugText("landed on the wrong one?")
            LearnWholeWords(text: twins.count == 1 ? "One other department uses this module name" : "\(twins.count) other departments use this module name") { string in
                Text(string)
                    .font(LF.Fonts.display(19, relativeTo: .title3))
                    .tracking(-0.4)
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityAddTraits(.isHeader)
            Text("This is the \(department.name) one: \(LearnFormat.plural(count, "lesson", "lessons"))\(minutes > 0 ? ", about \(minutes) minutes" : ""). The \(twins.count == 1 ? "module" : "modules") below share the name over completely different material.")
                .font(LF.Fonts.body(15))
                .foregroundStyle(LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(twins) { twin in
                    NavigationLink(value: AppRoute.module(twin.moduleID)) {
                        // The department's whole name, and its count beside it while there's
                        // room; under it at the accessibility sizes.
                        let name = LearnWholeWords(text: twin.departmentName) { string in
                            Text(string)
                                .font(LF.Fonts.body(15.5, weight: .bold))
                                .foregroundStyle(LF.Palette.ink)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        let count = SlugText(LearnFormat.plural(twin.lessons, "lesson", "lessons"))
                        Group {
                            if dynamicTypeSize.isAccessibilitySize {
                                VStack(alignment: .leading, spacing: 4) {
                                    name
                                    count
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            } else {
                                HStack(alignment: .firstTextBaseline, spacing: 12) {
                                    name.frame(maxWidth: .infinity, alignment: .leading)
                                    count
                                }
                            }
                        }
                        .padding(.vertical, 8)
                        .overlay(alignment: .top) { DashedRule() }
                    }
                    .buttonStyle(.inkRow)
                }
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: 720, alignment: .leading)
    }

    // MARK: Longer reads

    private func longerReads(_ articles: [Article], layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(
                kicker: "when it breaks, not how it works",
                title: articles.count == 1 ? "An article that goes deeper on this" : "Articles that go deeper on this"
            )
            VStack(spacing: 0) {
                InkRule()
                ForEach(articles) { article in
                    NavigationLink(value: AppRoute.article(article.slug)) {
                        LearnLogRow(layout: layout, trailing: "read it") {
                            SlugText("article / \(article.readMins) min")
                        } main: {
                            LearnRowText(title: article.title, summary: article.description)
                        }
                    }
                    .buttonStyle(.inkRow)
                    .accessibilityLabel(article.title)
                    .accessibilityValue("Article, \(article.readMins) minute read")
                }
            }
            .padding(.top, 22)
        }
    }

    // MARK: Department index

    /// The index at the front of the binder: number, module, lessons. The current row is
    /// marked three ways (a "you are here" note, bold ink, and a blue bar) so the state
    /// survives a photocopy.
    private func departmentIndex(_ department: Department, current: Module, labels: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("All \(department.modules.count) modules in \(department.name)")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 640, alignment: .leading)

            VStack(spacing: 0) {
                // The column heads. At the accessibility sizes each row spells out its own
                // count ("4 lessons") instead, so the heads would only overflow.
                if !dynamicTypeSize.isAccessibilitySize {
                    HStack {
                        SlugText("no.").frame(width: 56, alignment: .leading)
                        SlugText("module")
                        Spacer()
                        SlugText("lessons")
                    }
                    .padding(.vertical, 8)
                    .accessibilityHidden(true)
                }
                InkRule()
                ForEach(Array(department.modules.enumerated()), id: \.element.id) { index, module in
                    indexRow(module, number: module.isPrerequisite ? "pre" : LearnFormat.ordinal(Int(labels[index]) ?? 0),
                             isCurrent: module.id == current.id)
                }
            }
            .padding(.top, 18)
        }
    }

    @ViewBuilder
    private func indexRow(_ module: Module, number: String, isCurrent: Bool) -> some View {
        let title = LearnWholeWords(text: module.title) { string in
            Text(string)
                .font(LF.Fonts.body(15.5, weight: isCurrent ? .bold : .regular))
                .foregroundStyle(LF.Palette.ink)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        let here = SlugText("you are here", color: LF.Palette.blue, weight: .bold)
        let row = Group {
            if dynamicTypeSize.isAccessibilitySize {
                // Number and count on one line, the title under them at full width, so
                // neither the title nor the count is pushed off the page.
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline) {
                        SlugText(number)
                        Spacer(minLength: 12)
                        SlugText(LearnFormat.plural(module.lessons.count, "lesson", "lessons"))
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        title
                        if isCurrent {
                            here
                        }
                    }
                    .padding(.leading, 10)
                    .overlay(alignment: .leading) {
                        if isCurrent {
                            Rectangle().fill(LF.Palette.blue).frame(width: LF.Metrics.heavyStroke)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    SlugText(number).frame(width: 56, alignment: .leading)
                    // "you are here" under the title rather than beside it: beside it, a
                    // long title on a phone was left a column too narrow for its words.
                    VStack(alignment: .leading, spacing: 4) {
                        title
                        if isCurrent {
                            here
                        }
                    }
                    .padding(.leading, 10)
                    .overlay(alignment: .leading) {
                        if isCurrent {
                            Rectangle().fill(LF.Palette.blue).frame(width: LF.Metrics.heavyStroke)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    SlugText(module.lessons.count.formatted())
                }
            }
        }
        .padding(.vertical, 12)
        .frame(minHeight: LF.Metrics.tap)
        .overlay(alignment: .bottom) { DashedRule() }

        if isCurrent {
            row
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(module.title), you are here")
                .accessibilityValue(LearnFormat.plural(module.lessons.count, "lesson", "lessons"))
        } else {
            NavigationLink(value: AppRoute.module(module.id)) { row }
                .buttonStyle(.inkRow)
                .accessibilityLabel(module.title)
                .accessibilityValue(LearnFormat.plural(module.lessons.count, "lesson", "lessons"))
        }
    }
}

// MARK: - Previews

#Preview("Module, iPhone", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { ModuleView(moduleID: PreviewData.module.id) }
        .appEnvironment(.preview)
}

#Preview("Module, iPhone, dark", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { ModuleView(moduleID: PreviewData.businessDepartment.modules[0].id) }
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Module, iPad", traits: .fixedLayout(width: 1180, height: 1700)) {
    NavigationStack { ModuleView(moduleID: PreviewData.module.id) }
        .appEnvironment(.preview)
}

#Preview("Module, iPad, dark", traits: .fixedLayout(width: 834, height: 1500)) {
    NavigationStack { ModuleView(moduleID: PreviewData.department.modules[3].id) }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}
