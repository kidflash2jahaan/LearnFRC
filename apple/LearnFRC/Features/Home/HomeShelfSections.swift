import SwiftUI

// The quieter sections lower on Home: the free-account card for guests, the bookmarked
// lessons and the newest articles. The one question and its plan are in HomeStartPlan.swift.

// MARK: - Free account (guests)

/// What an account adds, said once and plainly. Reading and quizzes never need one, and the
/// card says so rather than implying otherwise.
struct HomeGuestAccountCard: View {
    /// Lessons finished on this device as a guest.
    let lessonsOnDevice: Int
    let onCreateAccount: () -> Void
    let onSignIn: () -> Void

    private var headline: String {
        lessonsOnDevice > 0 ? "Keep your place on every device." : "Count it everywhere you learn."
    }

    private var message: String {
        if lessonsOnDevice > 0 {
            return "You've finished \(HomeCopy.count(lessonsOnDevice, "lesson")) on this device. Make a free account and \(lessonsOnDevice == 1 ? "it moves" : "they move") into it, with the XP \(lessonsOnDevice == 1 ? "it's" : "they're") worth. Reading and quizzes never need one."
        }
        return "A free account adds XP, badges and your team's page, and keeps your progress on every device. Reading and quizzes never need one."
    }

    var body: some View {
        NotebookCard(tilt: .preset(1)) {
            SectionLabel("free account")
            Text(headline)
                .homeTitle(22, relativeTo: .title2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            Text(message)
                .homeSub(15.5)
                .padding(.top, 8)
            HomeFlowLayout(spacing: 10, lineSpacing: 10) {
                Button("Create a free account", action: onCreateAccount)
                    .buttonStyle(.inkSmall)
                Button("Sign in", action: onSignIn)
                    .buttonStyle(.inkGhostSmall)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 18)
        }
    }
}

// MARK: - Bookmarks

/// The lessons set aside with the bookmark, newest first: learnfrc.com/bookmarks in small.
/// The first three, then "See all" for the whole folder. Home only shows it once there's
/// something in it. Works the same for guests (bookmarks kept on this device).
struct HomeBookmarksShelf: View {
    /// Every bookmarked lesson, newest first (`ProgressStore.bookmarkedLessons`).
    let lessons: [LessonLocation]
    var limit = 3

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // The site's /bookmarks masthead, word for word.
            HomeSectionHeader(
                marker: "your reading list",
                title: "\(HomeCopy.count(lessons.count, "lesson")) you set aside."
            )
            VStack(spacing: 0) {
                DashedRule()
                ForEach(Array(lessons.prefix(limit))) { location in
                    NavigationLink(value: AppRoute.lesson(location.lesson.id)) {
                        VStack(alignment: .leading, spacing: 5) {
                            SlugText(meta(location))
                                .fixedSize(horizontal: false, vertical: true)
                            Text(location.lesson.title)
                                .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                                .foregroundStyle(LF.Palette.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(location.module.title)
                                .font(LF.Fonts.body(15, relativeTo: .subheadline))
                                .foregroundStyle(LF.Palette.graphite)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 14)
                        .padding(.trailing, 4)
                    }
                    .buttonStyle(.inkRow)
                    // The title first, then where it's filed: the slug line is printed above
                    // the title, but read out first it buried the name under "dept / ...".
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(Text(verbatim: location.lesson.title))
                    .accessibilityValue(Text(verbatim: spokenDetails(location)))
                    .accessibilityHint("Opens the lesson")
                    DashedRule()
                }
            }
            .padding(.top, 14)

            NavigationLink(value: AppRoute.bookmarks) {
                Text("See all")
            }
            .buttonStyle(.inkGhostSmall)
            .accessibilityLabel("See all \(HomeCopy.count(lessons.count, "bookmark"))")
            .padding(.top, 16)
        }
    }

    /// "dept / programming-software / 25 min", the filing line the site prints.
    private func meta(_ location: LessonLocation) -> String {
        ["dept / \(location.department.slug)", HomeCopy.minutes(location.lesson.estimatedMinutes)]
            .compactMap { $0 }
            .joined(separator: " / ")
    }

    /// What VoiceOver reads after the title: "What FIRST and FRC Are, Getting Started with
    /// FRC, 25 minutes" (module, department, length), the way the reading list reads it.
    private func spokenDetails(_ location: LessonLocation) -> String {
        var parts = [location.module.title, location.department.name]
        if location.lesson.estimatedMinutes > 0 { parts.append("\(location.lesson.estimatedMinutes) minutes") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Recent articles

/// The newest few articles, as ruled rows on the paper (`nb-row`).
struct HomeRecentArticles: View {
    let articles: [Article]

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var largeText: Bool { dynamicTypeSize >= .xxxLarge }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HomeSectionHeader(marker: "from the blog", title: "Recent articles")
            VStack(spacing: 0) {
                DashedRule()
                ForEach(articles) { article in
                    NavigationLink(value: AppRoute.article(article.slug)) {
                        VStack(alignment: .leading, spacing: 5) {
                            SlugText(meta(article))
                            Text(article.title)
                                .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                                .foregroundStyle(LF.Palette.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            if !article.description.isEmpty {
                                // Two lines of teaser at the usual sizes. From XXXL two lines
                                // hold a few words and cut the third off mid-word, so the
                                // description wraps whole instead.
                                Text(largeText ? HomeCopy.teaser(article.description) : article.description)
                                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                                    .foregroundStyle(LF.Palette.graphite)
                                    .lineLimit(largeText ? nil : 2)
                                    .fixedSize(horizontal: false, vertical: largeText)
                            }
                        }
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 14)
                        .padding(.trailing, 4)
                    }
                    .buttonStyle(.inkRow)
                    // Title first, like the lesson rows; the date and length after it.
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(Text(verbatim: article.title))
                    .accessibilityValue(Text(verbatim: spokenDetails(article)))
                    .accessibilityHint("Opens the article")
                    DashedRule()
                }
            }
            .padding(.top, 14)
        }
    }

    private func meta(_ article: Article) -> String {
        [HomeCopy.articleDate(article), article.readMins > 0 ? "\(article.readMins) min read" : nil]
            .compactMap { $0 }
            .joined(separator: " / ")
    }

    /// The date and length in words, then the teaser: "October 3, 2026, 6 minute read, ...".
    private func spokenDetails(_ article: Article) -> String {
        let date = article.publishedDate?.formatted(Date.FormatStyle(date: .long, time: .omitted, timeZone: .gmt))
        return [date,
                article.readMins > 0 ? "\(article.readMins) minute read" : nil,
                article.description.isEmpty ? nil : article.description]
            .compactMap { $0 }
            .joined(separator: ", ")
    }
}

// MARK: - Previews

#Preview("Shelf, iPhone", traits: .fixedLayout(width: 393, height: 2000)) {
    NavigationStack {
        ScrollView {
            VStack(alignment: .leading, spacing: 34) {
                HomeGuestAccountCard(lessonsOnDevice: 3, onCreateAccount: {}, onSignIn: {})
                HomeBookmarksShelf(lessons: [PreviewData.location(PreviewData.codeAndTableLessonBody.id),
                                             PreviewData.location(PreviewData.budgetLessonBody.id)])
                HomeRecentArticles(articles: Array(PreviewData.articles.prefix(3)))
            }
            .padding(LF.Metrics.gutter)
            .padding(.top, 14)
        }
        .paperBackground()
    }
    .environment(\.colorScheme, .light)
}

#Preview("Shelf, iPad, dark", traits: .fixedLayout(width: 760, height: 1100)) {
    NavigationStack {
        ScrollView {
            VStack(alignment: .leading, spacing: 34) {
                HomeGuestAccountCard(lessonsOnDevice: 0, onCreateAccount: {}, onSignIn: {})
                HomeRecentArticles(articles: Array(PreviewData.articles.prefix(3)))
            }
            .padding(28)
        }
        .paperBackground()
    }
    .environment(\.colorScheme, .dark)
}
