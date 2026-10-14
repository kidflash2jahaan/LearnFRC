import Foundation
import Security

/// The anonymous visitor id for guest progress (the site's `lf_vid`): a random
/// UUID kept in the Keychain so it survives reinstalls, which is what lets the
/// server-held guest record come back and migrate into an account later.
enum VisitorIdentity {
    private static let service = "com.learnfrc.app.visitor"
    private static let account = "visitor-id"
    private static let fallbackKey = "LFVisitorIDFallback"
    private static let startedKey = "LFGuestStartedAt"

    /// The visitor id, created on first use.
    static func current() -> String {
        if let existing = read() { return existing }
        let fresh = UUID().uuidString.lowercased()
        write(fresh)
        UserDefaults.standard.set(Date.now.timeIntervalSince1970, forKey: startedKey)
        return read() ?? fresh
    }

    /// When this device started as a guest. Anchors the guest's "first week" window.
    static var startedAt: Date? {
        let seconds = UserDefaults.standard.double(forKey: startedKey)
        return seconds > 0 ? Date(timeIntervalSince1970: seconds) : nil
    }

    /// Sets the start date if it isn't known yet (used when the first guest lesson lands).
    static func noteStarted(at date: Date) {
        if startedAt == nil {
            UserDefaults.standard.set(date.timeIntervalSince1970, forKey: startedKey)
        }
    }

    // MARK: Keychain

    private static var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private static func read() -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8), !value.isEmpty {
            return value
        }
        if status != errSecItemNotFound {
            Log.data.error("Keychain read for visitor id failed (\(status)); using the fallback")
        }
        return UserDefaults.standard.string(forKey: fallbackKey)
    }

    private static func write(_ value: String) {
        let data = Data(value.utf8)
        var attributes = baseQuery
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        var status = SecItemAdd(attributes as CFDictionary, nil)
        if status == errSecDuplicateItem {
            status = SecItemUpdate(baseQuery as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        }
        if status != errSecSuccess {
            // Unsigned Mac builds can't always use the Keychain; keep the id anyway.
            Log.data.error("Keychain write for visitor id failed (\(status)); using the fallback")
            UserDefaults.standard.set(value, forKey: fallbackKey)
        }
    }
}
