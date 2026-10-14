import Foundation
#if os(iOS)
import UIKit
#endif

/// Small, purposeful haptics. No-ops on Mac.
@MainActor
enum Haptics {
    /// A quiz passed, a lesson completed.
    static func success() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }

    /// Picking a quiz option, toggling a bookmark.
    static func select() {
        #if os(iOS)
        UISelectionFeedbackGenerator().selectionChanged()
        #endif
    }

    /// A wrong answer. Gentle, not punishing.
    static func warning() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        #endif
    }
}
