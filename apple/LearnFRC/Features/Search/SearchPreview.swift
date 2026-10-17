import SwiftUI

/// One search result laid out in full, for the right page of the search spread on iPhone
/// Duo's open screen (`SearchView`): what it is, where it's filed, enough of it to decide, and
/// the one button that opens it.
///
/// - A lesson: its summary, where the words matched in the text, and its key takeaways.
/// - A glossary term: the definition, other names, and where you'll meet it.
/// - An article: its description and the matching passage.
/// - A department or module: what's in it.
struct SearchPreviewCard: View {
    let hit: SearchHit
    var isCompleted = false

    @Environment(CatalogStore.self) private var catalog
    @Environment(ReferenceStore.self) private var reference

    private var document: SearchDocument { hit.document }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel("a closer look")
                .accessibilityAddTraits(.isHeader)
            NotebookCard(tilt: .degrees(0.4), tape: true, padding: 20) {
                VStack(alignment: .leading, spacing: 0) {
                    eyebrow
                    Text(hit.title.attributed)
                        .font(LF.Fonts.display(28, relativeTo: .title))
                        .tracking(28 * -0.025)
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .padding(.top, 12)
                    if let crumb = document.crumb {
                        Text(crumb)
                            .font(LF.Fonts.body(15, relativeTo: .subheadline))
                            .foregroundStyle(LF.Palette.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 6)
                    }
                    if let alias = hit.matchedAlias {
                        SearchAliasLine(alias: alias.attributed)
                            .padding(.top, 8)
                    }
                    details
                        .padding(.top, 14)
                    DashedRule()
                        .padding(.top, 18)
                    NavigationLink(value: document.route) {
                        Text(openTitle)
                    }
                    .buttonStyle(.ink)
                    .padding(.top, 16)
                }
            }
        }
    }

    /// "Open the lesson", "Read the entry": the kind's own words, as a button.
    private var openTitle: String {
        let label = document.kind.openLabel
        return label.prefix(1).uppercased() + label.dropFirst()
    }

    // MARK: The eyebrow

    private var eyebrow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                SlugText(document.slug)
                    .lineLimit(1)
                    .fixedSize()
                Spacer(minLength: 0)
                marks
            }
            VStack(alignment: .leading, spacing: 8) {
                SlugText(document.slug)
                    .fixedSize(horizontal: false, vertical: true)
                marks
            }
        }
    }

    @ViewBuilder
    private var marks: some View {
        if document.badge != nil || isCompleted || document.minutes != nil || document.hasVideo {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                if let minutes = document.minutes, document.kind == .lesson {
                    SlugText("\(minutes) min")
                        .fixedSize()
                }
                if document.hasVideo {
                    Image(systemName: "play.rectangle")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(LF.Palette.graphite)
                        .accessibilityLabel("Has a video")
                }
                if let badge = document.badge {
                    TagView(badge)
                        .fixedSize()
                        .accessibilityLabel("Short form \(badge)")
                }
                if isCompleted {
                    PenCheckMark(size: 15)
                        .accessibilityLabel("Completed")
                }
            }
        }
    }

    // MARK: What it is

    @ViewBuilder
    private var details: some View {
        switch document.route {
        case .lesson(let id):
            lesson(id)
        case .glossaryTerm(let slug):
            glossary(slug)
        case .department(let id):
            department(id)
        case .module(let id):
            module(id)
        default:
            // Articles, and anything else: the description and where it matched.
            VStack(alignment: .leading, spacing: 14) {
                prose(document.detail)
                matchedPassage
            }
        }
    }

    private func lesson(_ id: UUID) -> some View {
        let takeaways = catalog.lessonBody(id)?.keyTakeaways ?? []
        return VStack(alignment: .leading, spacing: 16) {
            prose(catalog.location(of: id)?.lesson.summary ?? document.detail)
            matchedPassage
            if !takeaways.isEmpty {
                LessonTakeawaysView(takeaways: Array(takeaways.prefix(4)), inMargin: true)
            }
        }
    }

    private func glossary(_ slug: String) -> some View {
        let term = reference.term(slug: slug)
        return VStack(alignment: .leading, spacing: 14) {
            prose(term?.definition ?? document.detail, size: 17)
            if let names = term?.alsoCalled, !names.isEmpty {
                SearchFlowLayout(spacing: 8, lineSpacing: 8) {
                    SlugText("also called")
                    ForEach(names, id: \.self) { TagView($0) }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Also called \(names.joined(separator: ", "))")
            }
            if let inMatch = term?.inMatch, !inMatch.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    SlugText("where you'll meet it")
                    Text(inMatch)
                        .font(LF.Fonts.body(15, relativeTo: .subheadline))
                        .lineHeight(.multiple(factor: 1.45))
                        .foregroundStyle(LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 2)
            }
        }
    }

    private func department(_ id: UUID) -> some View {
        let department = catalog.department(id: id)
        let learn = department?.whatYoullLearn ?? []
        return VStack(alignment: .leading, spacing: 14) {
            prose(department?.description ?? document.detail)
            if !learn.isEmpty {
                bulletList("What you will learn", Array(learn.prefix(5)))
            }
        }
    }

    private func module(_ id: UUID) -> some View {
        let module = catalog.module(id: id)
        let lessons = module?.lessons.map(\.title) ?? []
        return VStack(alignment: .leading, spacing: 14) {
            if !document.detail.isEmpty {
                prose(document.detail)
            }
            if !lessons.isEmpty {
                bulletList(lessons.count > 6 ? "The first 6 of \(lessons.count) lessons" : "The lessons", Array(lessons.prefix(6)))
            }
        }
    }

    // MARK: Pieces

    /// The passage of the text the words matched, when that's where they were found.
    @ViewBuilder
    private var matchedPassage: some View {
        if hit.snippetIsExcerpt, let snippet = hit.snippet {
            NoteCallout {
                SlugText("where it matches")
                Text(snippet.attributed)
                    .font(LF.Fonts.body(15.5, relativeTo: .callout))
                    .lineHeight(.multiple(factor: 1.45))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private func prose(_ text: String, size: CGFloat = 16) -> some View {
        if !text.isEmpty {
            Text(text)
                .lfProse(size)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
        }
    }

    private func bulletList(_ title: String, _ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SlugText(title)
                .accessibilityAddTraits(.isHeader)
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .firstTextBaseline, spacing: 9) {
                    Text(verbatim: "-")
                        .font(LF.Fonts.body(15.5, weight: .bold, relativeTo: .callout))
                        .foregroundStyle(LF.Palette.blue)
                        .accessibilityHidden(true)
                    Text(item)
                        .font(LF.Fonts.body(15.5, relativeTo: .callout))
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}
