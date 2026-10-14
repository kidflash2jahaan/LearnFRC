import AppIntents
import Foundation

extension NSUserActivity {
    /// The activity type a lesson screen advertises (listed in `NSUserActivityTypes`).
    static let lessonActivityType = "com.learnfrc.app.lesson"

    /// Describes the lesson on screen for Handoff (to another device or to learnfrc.com in a
    /// browser), Siri suggestions and on-screen awareness. For the lesson screen:
    ///
    ///     .userActivity(NSUserActivity.lessonActivityType) { activity in
    ///         activity.describeLesson(location)
    ///     }
    ///
    /// Spotlight already lists every lesson (`SpotlightIndexer`), so the activity itself is kept
    /// out of the search index to avoid duplicate results. `AppModel.handle(userActivity:)`
    /// opens it on the receiving device.
    @MainActor
    func describeLesson(_ location: LessonLocation) {
        let id = location.lesson.id
        title = location.lesson.title
        webpageURL = location.webURL
        userInfo = ["lessonID": id.uuidString]
        requiredUserInfoKeys = ["lessonID"]
        targetContentIdentifier = location.deepLinkURL.absoluteString
        persistentIdentifier = id.uuidString
        keywords = [location.department.name, location.module.title, "FRC"]
        isEligibleForHandoff = true
        isEligibleForSearch = false
        isEligibleForPublicIndexing = false
        #if os(iOS)
        isEligibleForPrediction = true
        #endif
        appEntityIdentifier = EntityIdentifier(for: LessonEntity.self, identifier: id)
    }
}
