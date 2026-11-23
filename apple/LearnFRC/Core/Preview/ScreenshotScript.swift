#if DEBUG
import SwiftUI

/// Debug-only launch arguments for the App Store screenshots
/// (`scripts/app-store-screenshots.sh`, docs/SCREENSHOTS.md). Release builds don't have them.
///
///     -LFShotLink learnfrc://lesson/<id>   open a link once the cache is in
///     -LFShotScroll lesson-quiz            scroll a lesson or calculator to an anchor: the quiz, a
///                                          heading's slug, `tool-field-<field>`; `@0.3` lands it
///                                          30% down the screen instead of at the top. Headings,
///                                          the quiz and `tool-verdict` (gear ratio) get blank
///                                          paper above them, so nothing shows faded under the
///                                          toolbar
///     -LFShotQuiz 2,3                      tick these answers on the quiz, in question order
///
/// `simctl openurl` would open the same links, but iOS asks "Open in LearnFRC?" first and
/// nothing headless can tap Open.
enum ScreenshotScript {
    /// The link to open at launch.
    static var link: URL? {
        UserDefaults.standard.string(forKey: "LFShotLink").flatMap { URL(string: $0) }
    }

    /// The anchor a lesson or calculator scrolls to once it's laid out, and where on the
    /// screen it lands.
    static var scrollTarget: (id: String, anchor: UnitPoint)? {
        guard let raw = UserDefaults.standard.string(forKey: "LFShotScroll"), !raw.isEmpty else { return nil }
        let parts = raw.split(separator: "@", maxSplits: 1).map(String.init)
        let y = parts.count > 1 ? Double(parts[1]) : nil
        return (parts[0], y.map { UnitPoint(x: 0.5, y: $0) } ?? .top)
    }

    /// Extra space above the anchor the screenshot scrolls to, so what sits under the
    /// toolbar is empty paper instead of the faded text of the section above it.
    static func room(above id: String) -> CGFloat {
        scrollTarget?.id == id ? 320 : 0
    }

    /// Scrolls to `scrollTarget` after the page has had time to lay out.
    @MainActor
    static func scroll(_ proxy: ScrollViewProxy) async {
        guard let target = scrollTarget else { return }
        try? await Task.sleep(for: .seconds(2))
        proxy.scrollTo(target.id, anchor: target.anchor)
    }

    /// Answer picks for the lesson's quiz, one option index per question.
    static var quizPicks: [Int]? {
        guard let raw = UserDefaults.standard.string(forKey: "LFShotQuiz") else { return nil }
        let picks = raw.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        return picks.isEmpty ? nil : picks
    }

    /// A fresh sheet with the picks ticked, ungraded.
    static func ticked(_ sheet: QuizSheet) -> QuizSheet {
        guard let quizPicks else { return sheet }
        var sheet = sheet
        for (question, option) in quizPicks.enumerated() {
            sheet.select(option, for: question)
        }
        return sheet
    }
}
#endif
