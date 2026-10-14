import Foundation
#if os(macOS)
import Security
#endif

/// Shared between the app and the widget extension.
enum AppGroup {
    static let id = "group.com.learnfrc.app"

    /// The App Group container, or nil when this build isn't entitled to it
    /// (Mac builds without a development team). On macOS the system hands back a
    /// path even for a group the app isn't entitled to, and touching it can prompt
    /// the person, so the entitlement is checked first.
    static var containerURL: URL? {
        guard isEntitled else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
    }

    /// Whether the running binary carries the app group entitlement.
    static var isEntitled: Bool {
        #if os(macOS)
        guard let task = SecTaskCreateFromSelf(nil),
              let value = SecTaskCopyValueForEntitlement(task, "com.apple.security.application-groups" as CFString, nil),
              let groups = value as? [String] else { return false }
        return groups.contains(id)
        #else
        // iOS returns nil from containerURL when the group isn't provisioned.
        return true
        #endif
    }
}
