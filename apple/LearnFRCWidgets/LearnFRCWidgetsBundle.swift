import SwiftUI
import WidgetKit

/// The widget extension's entry point.
///
/// Every widget reads the `WidgetSnapshot` the app writes to the App Group (`Shared/`) after
/// each change; the extension never signs in or touches the network. Widgets:
/// - Continue Learning: small, medium, Lock Screen rectangular and inline. Opens the lesson.
/// - Weekly Goal: small, medium, Lock Screen circular, rectangular and inline. Opens home.
/// - Up Next & This Week: large and extra large (iPhone, iPad, Mac desktop).
@main
struct LearnFRCWidgetsBundle: WidgetBundle {
    init() {
        WidgetFonts.register()
    }

    var body: some Widget {
        ContinueLearningWidget()
        WeeklyGoalWidget()
        OverviewWidget()
    }
}
