import Foundation
import os

/// Loggers for the data layer. Decode failures are logged here instead of being
/// swallowed, so a website change that breaks a shape shows up in Console.
enum Log {
    static let data = Logger(subsystem: "com.learnfrc.app", category: "data")
    static let decode = Logger(subsystem: "com.learnfrc.app", category: "decode")
    static let network = Logger(subsystem: "com.learnfrc.app", category: "network")
    static let sync = Logger(subsystem: "com.learnfrc.app", category: "sync")
    static let auth = Logger(subsystem: "com.learnfrc.app", category: "auth")
}

/// One place that builds JSON coders, so the cache, Supabase rows and the
/// website routes all agree on how dates look.
enum JSONCoding {
    /// Accepts Postgres timestamps (`2026-10-13T12:00:00.123456+00:00`), JS
    /// `toISOString()` (`2026-10-13T12:00:00.000Z`), plain dates and epoch numbers.
    static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            if let text = try? container.decode(String.self), let date = FlexibleDate.parse(text) {
                return date
            }
            if let number = try? container.decode(Double.self) {
                // Milliseconds if it's clearly too big to be seconds.
                return Date(timeIntervalSince1970: number > 100_000_000_000 ? number / 1000 : number)
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unrecognised date")
        }
        return decoder
    }

    static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(FlexibleDate.string(from: date))
        }
        return encoder
    }

    /// Decodes and logs a readable reason on failure (then rethrows).
    static func decode<T: Decodable>(_ type: T.Type, from data: Data, context: String) throws -> T {
        do {
            return try decoder().decode(type, from: data)
        } catch {
            Log.decode.error("Decoding \(context, privacy: .public) failed: \(describe(error), privacy: .public)")
            throw error
        }
    }

    /// A one-line explanation of a DecodingError, including the key path.
    static func describe(_ error: any Error) -> String {
        guard let error = error as? DecodingError else { return String(describing: error) }
        func path(_ context: DecodingError.Context) -> String {
            context.codingPath.map { $0.intValue.map(String.init) ?? $0.stringValue }.joined(separator: ".")
        }
        switch error {
        case .typeMismatch(let type, let context):
            return "type mismatch for \(type) at \(path(context)): \(context.debugDescription)"
        case .valueNotFound(let type, let context):
            return "missing \(type) at \(path(context)): \(context.debugDescription)"
        case .keyNotFound(let key, let context):
            return "missing key \(key.stringValue) at \(path(context))"
        case .dataCorrupted(let context):
            return "corrupted at \(path(context)): \(context.debugDescription)"
        @unknown default:
            return String(describing: error)
        }
    }
}

/// Lenient ISO 8601 parsing for the timestamp shapes the backend produces.
enum FlexibleDate {
    static func parse(_ raw: String) -> Date? {
        var text = raw.trimmingCharacters(in: .whitespaces)
        guard text.count >= 10 else { return nil }

        // Date only: midnight UTC.
        if text.count == 10 {
            return try? Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day().parse(text)
        }
        // Postgres text form uses a space between date and time.
        if text.count > 10, text[text.index(text.startIndex, offsetBy: 10)] == " " {
            text.replaceSubrange(text.index(text.startIndex, offsetBy: 10)...text.index(text.startIndex, offsetBy: 10), with: "T")
        }
        // Split off the zone so the fraction can be trimmed to milliseconds.
        var zone = ""
        if text.hasSuffix("Z") || text.hasSuffix("z") {
            zone = "Z"
            text.removeLast()
        } else if let signIndex = text.lastIndex(where: { $0 == "+" || $0 == "-" }),
                  text.distance(from: text.startIndex, to: signIndex) > 10 {
            zone = String(text[signIndex...])
            text = String(text[..<signIndex])
            // "+00" -> "+00:00", "+0530" -> "+05:30"
            let digits = zone.dropFirst().filter(\.isNumber)
            if digits.count == 2 { zone += ":00" }
            if digits.count == 4, !zone.contains(":") {
                zone = String(zone.prefix(3)) + ":" + String(zone.suffix(2))
            }
        } else {
            zone = "Z"
        }
        var hasFraction = false
        if let dot = text.firstIndex(of: ".") {
            let fraction = text[text.index(after: dot)...].prefix(while: \.isNumber)
            let millis = String((fraction + "000").prefix(3))
            text = String(text[..<dot]) + "." + millis
            hasFraction = true
        }
        let candidate = text + zone
        if hasFraction, let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(candidate) {
            return roundedToMilliseconds(date)
        }
        if let date = try? Date.ISO8601FormatStyle().parse(candidate) {
            return date
        }
        return nil
    }

    /// `2026-10-13T12:00:00.123Z`, rounded to the millisecond so that parse(string(d)) == d
    /// for any date that came from the server (binary doubles can't hold .586 exactly).
    static func string(from date: Date) -> String {
        let totalMS = (date.timeIntervalSince1970 * 1000).rounded()
        let wholeSeconds = (totalMS / 1000).rounded(.down)
        let millis = Int(totalMS - wholeSeconds * 1000)
        let whole = Date(timeIntervalSince1970: wholeSeconds).formatted(Date.ISO8601FormatStyle())
        return String(whole.dropLast()) + String(format: ".%03dZ", millis)
    }

    static func roundedToMilliseconds(_ date: Date) -> Date {
        Date(timeIntervalSince1970: (date.timeIntervalSince1970 * 1000).rounded() / 1000)
    }
}

/// Decodes anything and keeps nothing. Used to step past a bad array element.
struct SkipDecodable: Decodable {
    init(from decoder: any Decoder) throws {}
}

/// An array that drops (and logs) elements that fail to decode instead of
/// failing the whole payload.
struct LossyArray<Element: Decodable & Sendable>: Decodable, Sendable {
    var elements: [Element]

    init(from decoder: any Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var out: [Element] = []
        if let count = container.count { out.reserveCapacity(count) }
        while !container.isAtEnd {
            do {
                out.append(try container.decode(Element.self))
            } catch {
                Log.decode.error("Skipped a \(String(describing: Element.self), privacy: .public): \(JSONCoding.describe(error), privacy: .public)")
                _ = try? container.decode(SkipDecodable.self)
            }
        }
        elements = out
    }
}

extension KeyedDecodingContainer {
    /// An array that tolerates a missing key, `null`, a wrong type, and bad elements.
    func lossyArray<T: Decodable & Sendable>(_ type: T.Type, forKey key: Key) -> [T] {
        guard contains(key), (try? decodeNil(forKey: key)) == false else { return [] }
        do {
            return try decode(LossyArray<T>.self, forKey: key).elements
        } catch {
            Log.decode.error("Expected an array at \(key.stringValue, privacy: .public): \(JSONCoding.describe(error), privacy: .public)")
            return []
        }
    }

    /// Strings in an array, skipping anything that isn't one.
    func stringArray(forKey key: Key) -> [String] {
        lossyArray(String.self, forKey: key)
    }

    func flexibleString(forKey key: Key) -> String? {
        if let value = try? decodeIfPresent(String.self, forKey: key) { return value }
        if let value = try? decodeIfPresent(Int.self, forKey: key) { return String(value) }
        if let value = try? decodeIfPresent(Double.self, forKey: key) { return String(value) }
        return nil
    }

    func flexibleInt(forKey key: Key) -> Int? {
        if let value = try? decodeIfPresent(Int.self, forKey: key) { return value }
        if let value = try? decodeIfPresent(Double.self, forKey: key), value.isFinite { return Int(value.rounded()) }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            if let int = Int(trimmed) { return int }
            if let double = Double(trimmed), double.isFinite { return Int(double.rounded()) }
        }
        return nil
    }

    func flexibleDouble(forKey key: Key) -> Double? {
        if let value = try? decodeIfPresent(Double.self, forKey: key) { return value }
        if let value = try? decodeIfPresent(String.self, forKey: key) { return Double(value.trimmingCharacters(in: .whitespaces)) }
        return nil
    }

    func flexibleBool(forKey key: Key) -> Bool? {
        if let value = try? decodeIfPresent(Bool.self, forKey: key) { return value }
        if let value = try? decodeIfPresent(Int.self, forKey: key) { return value != 0 }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            switch value.lowercased() {
            case "true", "t", "1", "yes": return true
            case "false", "f", "0", "no": return false
            default: return nil
            }
        }
        return nil
    }

    func flexibleUUID(forKey key: Key) -> UUID? {
        if let value = try? decodeIfPresent(UUID.self, forKey: key) { return value }
        if let value = try? decodeIfPresent(String.self, forKey: key) { return UUID(uuidString: value) }
        return nil
    }

    func flexibleDate(forKey key: Key) -> Date? {
        if let value = try? decodeIfPresent(Date.self, forKey: key) { return value }
        if let value = try? decodeIfPresent(String.self, forKey: key) { return FlexibleDate.parse(value) }
        return nil
    }

    /// A required UUID; throws a readable error when it's missing or malformed.
    func requiredUUID(forKey key: Key) throws -> UUID {
        guard let value = flexibleUUID(forKey: key) else {
            throw DecodingError.dataCorruptedError(forKey: key, in: self, debugDescription: "Expected a UUID")
        }
        return value
    }

    /// A required string; throws when it's missing.
    func requiredString(forKey key: Key) throws -> String {
        guard let value = flexibleString(forKey: key) else {
            throw DecodingError.dataCorruptedError(forKey: key, in: self, debugDescription: "Expected a string")
        }
        return value
    }
}

/// Keys built at runtime, for payloads that may come in snake_case or camelCase.
struct AnyCodingKey: CodingKey, Hashable {
    var stringValue: String
    var intValue: Int?
    init(_ string: String) { stringValue = string; intValue = nil }
    init?(stringValue: String) { self.stringValue = stringValue; intValue = nil }
    init?(intValue: Int) { stringValue = String(intValue); self.intValue = intValue }
}

extension KeyedDecodingContainer where Key == AnyCodingKey {
    /// The first of several spellings that is present.
    func firstKey(_ names: String...) -> AnyCodingKey {
        for name in names where contains(AnyCodingKey(name)) { return AnyCodingKey(name) }
        return AnyCodingKey(names[0])
    }
}
