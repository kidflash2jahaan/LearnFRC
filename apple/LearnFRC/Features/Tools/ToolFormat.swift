import Foundation

// The calculators port learnfrc.com/tools digit for digit, so they need the parts of
// JavaScript's number handling the site leans on: `parseFloat` and `Number()` for what was
// typed, `Math.round` for the unit switches, `String(n)` for a value written back into a
// field, and `toLocaleString("en-US")` / `Intl.NumberFormat` for every printed figure.
// Foundation only (no SwiftUI), so the maths files can be compiled on their own and checked
// against the site's TypeScript.

/// JavaScript's number semantics, as the site's calculators use them.
nonisolated enum JS {

    // MARK: Reading text

    /// `parseFloat(text)`: the longest leading decimal literal after any leading white
    /// space ("12abc" is 12, "1e" is 1, "." is NaN), or NaN when there isn't one.
    static func parseFloat(_ text: String) -> Double {
        let scalars = Array(text.unicodeScalars.drop(while: isWhiteSpace))
        guard let (literal, _) = scanDecimal(scalars, from: 0) else { return .nan }
        return literal
    }

    /// `Number(text)`: the whole string (trimmed) must be a numeric literal. "" is 0,
    /// anything that isn't wholly a number is NaN.
    static func number(_ text: String) -> Double {
        var scalars = Array(text.unicodeScalars.drop(while: isWhiteSpace))
        while let last = scalars.last, isWhiteSpace(last) { scalars.removeLast() }
        if scalars.isEmpty { return 0 }
        let string = String(String.UnicodeScalarView(scalars))
        for (prefix, radix) in [("0x", 16), ("0X", 16), ("0o", 8), ("0O", 8), ("0b", 2), ("0B", 2)] where string.hasPrefix(prefix) {
            let digits = string.dropFirst(2)
            guard !digits.isEmpty, let value = UInt64(digits, radix: radix) else { return .nan }
            return Double(value)
        }
        guard let (value, end) = scanDecimal(scalars, from: 0), end == scalars.count else { return .nan }
        return value
    }

    /// Scans `StrDecimalLiteral` (sign, `Infinity`, digits, a point, an exponent) from
    /// `start`, returning the value and where it stopped.
    private static func scanDecimal(_ s: [Unicode.Scalar], from start: Int) -> (Double, Int)? {
        var i = start
        var negative = false
        if i < s.count, s[i] == "+" || s[i] == "-" {
            negative = s[i] == "-"
            i += 1
        }
        let infinity = Array("Infinity".unicodeScalars)
        if s.count - i >= infinity.count, Array(s[i..<(i + infinity.count)]) == infinity {
            return (negative ? -.infinity : .infinity, i + infinity.count)
        }
        var mantissa = ""
        var sawDigit = false
        while i < s.count, isDigit(s[i]) {
            mantissa.unicodeScalars.append(s[i]); sawDigit = true; i += 1
        }
        if i < s.count, s[i] == "." {
            var fraction = ""
            var j = i + 1
            while j < s.count, isDigit(s[j]) {
                fraction.unicodeScalars.append(s[j]); j += 1
            }
            if sawDigit || !fraction.isEmpty {
                mantissa += "." + fraction
                sawDigit = true
                i = j
            }
        }
        guard sawDigit else { return nil }
        if i < s.count, s[i] == "e" || s[i] == "E" {
            var j = i + 1
            var exponent = "e"
            if j < s.count, s[j] == "+" || s[j] == "-" {
                exponent.unicodeScalars.append(s[j]); j += 1
            }
            var expDigits = false
            while j < s.count, isDigit(s[j]) {
                exponent.unicodeScalars.append(s[j]); expDigits = true; j += 1
            }
            if expDigits {
                mantissa += exponent
                i = j
            }
        }
        if mantissa.hasPrefix(".") { mantissa = "0" + mantissa }
        mantissa = mantissa.replacingOccurrences(of: ".e", with: ".0e")
        if mantissa.hasSuffix(".") { mantissa += "0" }
        guard let value = Double(mantissa) else { return nil }
        return (negative ? -value : value, i)
    }

    private static func isDigit(_ c: Unicode.Scalar) -> Bool { c >= "0" && c <= "9" }

    /// ECMAScript `WhiteSpace` and `LineTerminator`.
    private static func isWhiteSpace(_ c: Unicode.Scalar) -> Bool {
        switch c.value {
        case 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
            return true
        default:
            return false
        }
    }

    // MARK: Arithmetic

    /// `Math.round(x)`: halves go up (toward positive infinity), and negative values that
    /// round to zero stay negative zero.
    static func round(_ x: Double) -> Double {
        guard x.isFinite else { return x }
        let floor = x.rounded(.down)
        let result = x - floor >= 0.5 ? floor + 1 : floor
        if result == 0, x.sign == .minus { return -0.0 }
        return result
    }

    /// `Math.max(...)`: NaN if any argument is NaN.
    static func max(_ values: Double...) -> Double {
        var best = -Double.infinity
        for value in values {
            if value.isNaN { return .nan }
            if value > best || (value == 0 && best == 0 && best.sign == .minus) { best = value }
        }
        return best
    }

    /// `Math.min(...)`: NaN if any argument is NaN.
    static func min(_ values: Double...) -> Double {
        var best = Double.infinity
        for value in values {
            if value.isNaN { return .nan }
            if value < best || (value == 0 && best == 0 && value.sign == .minus) { best = value }
        }
        return best
    }

    // MARK: Writing numbers

    /// `String(x)` (`Number.prototype.toString`): "25.4", "254", "1e-7", "1.5e+21".
    static func string(_ x: Double) -> String {
        if x.isNaN { return "NaN" }
        if x == 0 { return "0" }
        if x < 0 { return "-" + string(-x) }
        if x.isInfinite { return "Infinity" }
        let (digits, exponent) = shortestDigits(x)
        let k = digits.count
        let n = exponent + k
        if k <= n, n <= 21 {
            return digits + String(repeating: "0", count: n - k)
        }
        if 0 < n, n <= 21 {
            let index = digits.index(digits.startIndex, offsetBy: n)
            return String(digits[..<index]) + "." + String(digits[index...])
        }
        if -6 < n, n <= 0 {
            return "0." + String(repeating: "0", count: -n) + digits
        }
        let e = n - 1
        let sign = e < 0 ? "-" : "+"
        if k == 1 { return digits + "e" + sign + String(abs(e)) }
        return String(digits.prefix(1)) + "." + String(digits.dropFirst()) + "e" + sign + String(abs(e))
    }

    /// `x.toFixed(digits)`.
    static func toFixed(_ x: Double, _ digits: Int) -> String {
        guard x.isFinite else { return string(x) }
        if abs(x) >= 1e21 { return string(x) }
        // Negative zero prints as "0.000"; anything below zero keeps its sign.
        return String(format: "%.\(digits)f", locale: Locale(identifier: "en_US_POSIX"), x == 0 ? 0.0 : x)
    }

    /// `x.toExponential(digits)`: "8.734e-9".
    static func toExponential(_ x: Double, _ digits: Int) -> String {
        guard x.isFinite else { return string(x) }
        let text = String(format: "%.\(digits)e", locale: Locale(identifier: "en_US_POSIX"), x)
        guard let e = text.firstIndex(where: { $0 == "e" || $0 == "E" }) else { return text }
        let mantissa = text[..<e]
        let exponent = Int(text[text.index(after: e)...]) ?? 0
        return mantissa + "e" + (exponent < 0 ? "-" : "+") + String(abs(exponent))
    }

    /// `x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })`:
    /// grouped with commas, rounded half away from zero on the shortest decimal form of the
    /// number (ICU's rule, so 1.005 prints as 1.01), negative zero printed as "-0".
    static func locale(_ x: Double, _ digits: Int) -> String {
        if x.isNaN { return "NaN" }
        if x.isInfinite { return x < 0 ? "-∞" : "∞" }
        return (x.sign == .minus ? "-" : "") + grouped(abs(x), digits)
    }

    /// `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", ... })` with `digits`
    /// fraction digits: "$6,300", "-$500.00".
    static func usd(_ x: Double, _ digits: Int) -> String {
        if x.isNaN { return "NaN" }
        if x.isInfinite { return (x < 0 ? "-$" : "$") + "∞" }
        return (x.sign == .minus ? "-$" : "$") + grouped(abs(x), digits)
    }

    /// `magnitude` rounded to `fractionDigits` and grouped in threes.
    private static func grouped(_ magnitude: Double, _ fractionDigits: Int) -> String {
        var integerDigits: [UInt8]
        if magnitude == 0 {
            integerDigits = [0]
        } else {
            let (digitString, exponent) = shortestDigits(magnitude)
            let digits = digitString.utf8.map { $0 - 48 }
            let shift = exponent + fractionDigits
            if shift >= 0 {
                integerDigits = digits + Array(repeating: 0, count: shift)
            } else {
                let keep = digits.count + shift
                if keep < 0 {
                    integerDigits = [0]
                } else {
                    let roundUp = digits[keep] >= 5
                    integerDigits = keep == 0 ? [0] : Array(digits[0..<keep])
                    if roundUp {
                        var index = integerDigits.count - 1
                        while index >= 0 {
                            if integerDigits[index] == 9 {
                                integerDigits[index] = 0
                                index -= 1
                            } else {
                                integerDigits[index] += 1
                                break
                            }
                        }
                        if index < 0 { integerDigits.insert(1, at: 0) }
                    }
                }
            }
        }
        while integerDigits.count < fractionDigits + 1 { integerDigits.insert(0, at: 0) }
        while integerDigits.count > fractionDigits + 1, integerDigits.first == 0 { integerDigits.removeFirst() }
        let whole = integerDigits.dropLast(fractionDigits).map { String($0) }.joined()
        let fraction = integerDigits.suffix(fractionDigits).map { String($0) }.joined()
        var groupedWhole = ""
        for (offset, character) in whole.enumerated() {
            if offset > 0, (whole.count - offset) % 3 == 0 { groupedWhole.append(",") }
            groupedWhole.append(character)
        }
        return fractionDigits > 0 ? groupedWhole + "." + fraction : groupedWhole
    }

    /// The shortest digits that round-trip `x` (positive, finite, non-zero), with the
    /// power of ten they're scaled by: 25.4 is ("254", -1). Swift's `description` is the
    /// same shortest form JavaScript and ICU start from.
    private static func shortestDigits(_ x: Double) -> (String, Int) {
        let text = x.description
        var mantissa = Substring(text)
        var exponent = 0
        if let e = text.firstIndex(where: { $0 == "e" || $0 == "E" }) {
            mantissa = text[..<e]
            exponent = Int(text[text.index(after: e)...]) ?? 0
        }
        var digits = ""
        var fractionCount = 0
        var afterPoint = false
        for character in mantissa {
            if character == "." { afterPoint = true; continue }
            digits.append(character)
            if afterPoint { fractionCount += 1 }
        }
        exponent -= fractionCount
        while digits.count > 1, digits.first == "0" { digits.removeFirst() }
        while digits.count > 1, digits.last == "0" { digits.removeLast(); exponent += 1 }
        return (digits, exponent)
    }
}

/// The site's own little helpers, shared by every calculator.
nonisolated enum ToolFormat {
    /// `fmt(n, digits)` on the site: "n/a" for anything not finite, otherwise the en-US
    /// figure with exactly `digits` decimals.
    static func fixed(_ n: Double, _ digits: Int) -> String {
        n.isFinite ? JS.locale(n, digits) : "n/a"
    }

    /// `parseNum(v)`: `parseFloat`, or 0 when that isn't a finite number.
    static func parseNum(_ text: String) -> Double {
        let n = JS.parseFloat(text)
        return n.isFinite ? n : 0
    }

    /// `num(v, fallback)` / `toNum(s, fallback)`: `parseFloat`, or `fallback`.
    static func num(_ text: String, _ fallback: Double) -> Double {
        let n = JS.parseFloat(text)
        return n.isFinite ? n : fallback
    }
}
