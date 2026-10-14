import Foundation

// A small, fast tokenizer for the languages lessons and articles actually use
// (java 232 blocks, python, bash, json, plus a few sql/c++/js). It is a
// single forward scan per block, run once when a document is parsed.
//
// The token classes follow the site's two-colour highlight theme
// (`.hljs-*` in `src/app/globals.css`): keywords and literals blue bold,
// strings blue, numbers / annotations / declared names ink bold, comments
// graphite italic, punctuation graphite, everything else ink.

enum CodeHighlighter {
    enum Language: Hashable, Sendable {
        case java, cpp, javascript, python, bash, json, sql

        /// nil means plain text: untagged fences are formulas, logs and
        /// templates far more often than code, so they are not guessed at.
        init?(info: String?) {
            guard let info = info?.lowercased() else { return nil }
            switch info {
            case "java": self = .java
            case "c", "cpp", "c++", "cc", "h", "hpp", "cxx": self = .cpp
            case "js", "javascript", "jsx", "ts", "typescript", "tsx", "mjs": self = .javascript
            case "py", "python", "python3", "py3": self = .python
            case "bash", "sh", "shell", "zsh", "console", "shellsession", "terminal": self = .bash
            case "json", "jsonc", "json5": self = .json
            case "sql", "postgres", "postgresql", "sqlite": self = .sql
            default: return nil
            }
        }
    }

    enum TokenKind: Hashable, Sendable {
        case plain, keyword, literal, string, number, comment, meta, title, builtin, punctuation, variable, attribute
    }

    struct Token: Hashable, Sendable {
        var kind: TokenKind
        var text: String
    }

    /// Splits `code` into coloured runs. Adjacent runs of the same kind are merged.
    static func tokens(_ code: String, language: Language?) -> [Token] {
        guard let language, !code.isEmpty else { return [Token(kind: .plain, text: code)] }
        var scanner = Scanner(Array(code.unicodeScalars))
        switch language {
        case .java: scanner.scanCFamily(keywords: javaKeywords, literals: cLiterals, builtins: [], preprocessor: false, templates: false)
        case .cpp: scanner.scanCFamily(keywords: cppKeywords, literals: cLiterals.union(["nullptr", "NULL"]), builtins: [], preprocessor: true, templates: false)
        case .javascript: scanner.scanCFamily(keywords: jsKeywords, literals: jsLiterals, builtins: jsBuiltins, preprocessor: false, templates: true)
        case .python: scanner.scanPython()
        case .bash: scanner.scanBash()
        case .json: scanner.scanJSON()
        case .sql: scanner.scanSQL()
        }
        return scanner.finish()
    }

    // MARK: Word lists

    static let javaKeywords: Set<String> = [
        "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const",
        "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float",
        "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "native",
        "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp",
        "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
        "volatile", "while", "var", "record", "yield", "sealed", "permits", "non-sealed",
    ]
    static let cppKeywords: Set<String> = [
        "auto", "bool", "break", "case", "catch", "char", "class", "const", "constexpr", "continue",
        "default", "delete", "do", "double", "else", "enum", "explicit", "extern", "float", "for",
        "friend", "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "operator",
        "override", "private", "protected", "public", "return", "short", "signed", "sizeof", "static",
        "struct", "switch", "template", "this", "throw", "try", "typedef", "typename", "union",
        "unsigned", "using", "virtual", "void", "volatile", "while", "final", "units",
    ]
    static let jsKeywords: Set<String> = [
        "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "delete",
        "do", "else", "export", "extends", "finally", "for", "from", "function", "if", "import", "in",
        "instanceof", "interface", "let", "new", "of", "return", "static", "super", "switch", "this",
        "throw", "try", "type", "typeof", "var", "void", "while", "yield", "enum", "implements",
        "private", "public", "protected", "readonly", "as",
    ]
    static let cLiterals: Set<String> = ["true", "false", "null"]
    static let jsLiterals: Set<String> = ["true", "false", "null", "undefined", "NaN", "Infinity"]
    static let jsBuiltins: Set<String> = ["console", "Math", "JSON", "Promise", "Array", "Object", "String", "Number", "fetch", "document", "window"]

    static let pythonKeywords: Set<String> = [
        "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif",
        "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda",
        "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "match", "case",
    ]
    static let pythonLiterals: Set<String> = ["True", "False", "None"]
    static let pythonBuiltins: Set<String> = [
        "abs", "all", "any", "bool", "dict", "enumerate", "filter", "float", "format", "input", "int",
        "isinstance", "len", "list", "map", "max", "min", "open", "print", "range", "round", "set",
        "sorted", "str", "sum", "super", "tuple", "type", "zip", "self",
    ]

    static let bashKeywords: Set<String> = [
        "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac",
        "in", "function", "select", "time",
    ]
    static let bashBuiltins: Set<String> = [
        "alias", "cd", "echo", "eval", "exec", "exit", "export", "local", "printf", "pwd", "read",
        "readonly", "return", "set", "shift", "source", "test", "trap", "type", "unset", "sudo",
    ]

    static let sqlKeywords: Set<String> = [
        "select", "from", "where", "and", "or", "not", "insert", "into", "values", "update", "set",
        "delete", "create", "table", "drop", "alter", "add", "join", "left", "right", "inner", "outer",
        "on", "group", "by", "order", "having", "limit", "offset", "as", "distinct", "count", "sum",
        "avg", "min", "max", "case", "when", "then", "else", "end", "is", "null", "in", "like",
        "between", "primary", "key", "references", "foreign", "default", "unique", "index", "union",
        "all", "exists", "asc", "desc", "with", "returning", "integer", "text", "boolean", "true", "false",
    ]
}

// MARK: - Scanner

private struct Scanner {
    let s: [Unicode.Scalar]
    var i = 0
    var out: [CodeHighlighter.Token] = []
    /// Last non-whitespace token, for declaration detection.
    var lastSignificant: (kind: CodeHighlighter.TokenKind, text: String, start: Int)?

    init(_ scalars: [Unicode.Scalar]) {
        s = scalars
    }

    // MARK: Emitting

    mutating func emit(_ kind: CodeHighlighter.TokenKind, _ start: Int, _ end: Int) {
        guard end > start else { return }
        let text = String(String.UnicodeScalarView(s[start..<end]))
        if let last = out.last, last.kind == kind {
            out[out.count - 1].text += text
        } else {
            out.append(CodeHighlighter.Token(kind: kind, text: text))
        }
        if !(kind == .plain && text.unicodeScalars.allSatisfy(\.properties.isWhitespace)) {
            lastSignificant = (kind, text, start)
        }
    }

    func finish() -> [CodeHighlighter.Token] { out }

    // MARK: Character classes

    func at(_ offset: Int = 0) -> Unicode.Scalar? {
        let j = i + offset
        return j < s.count ? s[j] : nil
    }

    static func isIdentStart(_ c: Unicode.Scalar) -> Bool {
        c == "_" || c == "$" || c.properties.isAlphabetic
    }

    static func isIdentPart(_ c: Unicode.Scalar) -> Bool {
        isIdentStart(c) || isDigit(c)
    }

    static func isDigit(_ c: Unicode.Scalar) -> Bool { c >= "0" && c <= "9" }

    static func isSpace(_ c: Unicode.Scalar) -> Bool { c.properties.isWhitespace }

    /// True when only spaces and tabs sit between the start of the line and `index`.
    func isLineStart(_ index: Int) -> Bool {
        var j = index - 1
        while j >= 0 {
            if s[j] == "\n" { return true }
            if s[j] != " " && s[j] != "\t" { return false }
            j -= 1
        }
        return true
    }

    func nextNonSpace(from index: Int) -> Unicode.Scalar? {
        var j = index
        while j < s.count, s[j] == " " || s[j] == "\t" { j += 1 }
        return j < s.count ? s[j] : nil
    }

    // MARK: Shared pieces

    mutating func scanWhitespace() -> Bool {
        guard let c = at(), Self.isSpace(c) else { return false }
        let start = i
        while let c = at(), Self.isSpace(c) { i += 1 }
        emit(.plain, start, i)
        return true
    }

    mutating func scanToLineEnd(as kind: CodeHighlighter.TokenKind) {
        let start = i
        while let c = at(), c != "\n" { i += 1 }
        emit(kind, start, i)
    }

    mutating func scanBlockComment(open: String = "/*", close: String = "*/") -> Bool {
        guard matches(open) else { return false }
        let start = i
        i += open.unicodeScalars.count
        while i < s.count, !matches(close) { i += 1 }
        i = min(s.count, i + close.unicodeScalars.count)
        emit(.comment, start, i)
        return true
    }

    func matches(_ literal: String) -> Bool {
        var j = i
        for scalar in literal.unicodeScalars {
            guard j < s.count, s[j] == scalar else { return false }
            j += 1
        }
        return true
    }

    /// A quoted string starting at `i`. Stops at an unescaped newline unless `multiline`.
    mutating func scanQuoted(_ quote: Unicode.Scalar, escapes: Bool = true, multiline: Bool = false, start: Int? = nil) {
        let begin = start ?? i
        i += 1
        while let c = at() {
            if escapes && c == "\\" {
                i += 2
                continue
            }
            if c == quote {
                i += 1
                break
            }
            if c == "\n" && !multiline { break }
            i += 1
        }
        i = min(i, s.count)
        emit(.string, begin, i)
    }

    mutating func scanTripleQuoted(_ quote: Unicode.Scalar, start: Int? = nil, escapes: Bool = true) {
        let begin = start ?? i
        let fence = String(repeating: String(quote), count: 3)
        i += 3
        while i < s.count, !matches(fence) {
            if escapes && s[i] == "\\" { i += 1 }
            i += 1
        }
        i = min(s.count, i + 3)
        emit(.string, begin, i)
    }

    mutating func scanNumber() -> Bool {
        guard let c = at() else { return false }
        let startsWithDot = c == "." && at(1).map(Self.isDigit) == true
        guard Self.isDigit(c) || startsWithDot else { return false }
        if i > 0, Self.isIdentPart(s[i - 1]) { return false }
        let start = i
        if c == "0", let x = at(1), x == "x" || x == "X" || x == "b" || x == "B" {
            i += 2
            while let d = at(), d.properties.isASCIIHexDigit || d == "_" { i += 1 }
        } else {
            while let d = at(), Self.isDigit(d) || d == "_" || d == "." { i += 1 }
            if let e = at(), e == "e" || e == "E" {
                let sign = at(1)
                if let sign, Self.isDigit(sign) {
                    i += 1
                } else if let sign, sign == "+" || sign == "-", at(2).map(Self.isDigit) == true {
                    i += 2
                }
                while let d = at(), Self.isDigit(d) { i += 1 }
            }
        }
        while let suffix = at(), "lLfFdDuUjJ".unicodeScalars.contains(suffix) { i += 1 }
        emit(.number, start, i)
        return true
    }

    mutating func readIdentifier() -> (start: Int, text: String)? {
        guard let c = at(), Self.isIdentStart(c) else { return nil }
        let start = i
        while let d = at(), Self.isIdentPart(d) { i += 1 }
        return (start, String(String.UnicodeScalarView(s[start..<i])))
    }

    static let typeKeywords: Set<String> = [
        "void", "int", "long", "short", "byte", "char", "boolean", "bool", "double", "float", "var",
        "auto", "unsigned", "signed", "const", "constexpr", "static",
    ]

    /// Is the previous token where a declaration's return type sits?
    func isReturnTypePosition(_ previous: (kind: CodeHighlighter.TokenKind, text: String, start: Int), notTypes: Set<String>) -> Bool {
        switch previous.kind {
        case .plain:
            guard let first = previous.text.unicodeScalars.first, Self.isIdentStart(first) else { return false }
            if notTypes.contains(previous.text) { return false }
            // `foo.bar(` is a call, not a declaration.
            return previous.start == 0 || s[previous.start - 1] != "."
        case .keyword:
            return Self.typeKeywords.contains(previous.text)
        case .punctuation:
            // `List<Pose2d> path(` or `double[] values(`, but not `a > b(` or `-> run(`.
            guard previous.start > 0 else { return false }
            let before = s[previous.start - 1]
            if previous.text == ">" { return Self.isIdentPart(before) || before == ">" || before == "?" || before == "<" }
            if previous.text == "]" { return before == "[" }
            return false
        default:
            return false
        }
    }

    mutating func scanPunctuation() {
        emit(.punctuation, i, i + 1)
        i += 1
    }

    // MARK: Java, C++, JavaScript

    mutating func scanCFamily(keywords: Set<String>, literals: Set<String>, builtins: Set<String>, preprocessor: Bool, templates: Bool) {
        let declarers: Set<String> = ["class", "interface", "enum", "record", "struct", "extends", "implements", "namespace", "function"]
        let notTypes: Set<String> = ["return", "new", "throw", "else", "case", "yield", "await", "typeof", "instanceof", "in", "of"]
        while i < s.count {
            if scanWhitespace() { continue }
            let c = s[i]
            if matches("//") { scanToLineEnd(as: .comment); continue }
            if scanBlockComment() { continue }
            if preprocessor && c == "#" && isLineStart(i) { scanToLineEnd(as: .meta); continue }
            if c == "\"" {
                if matches("\"\"\"") { scanTripleQuoted("\"") } else { scanQuoted("\"") }
                continue
            }
            if c == "'" { scanQuoted("'"); continue }
            if templates && c == "`" { scanQuoted("`", multiline: true); continue }
            if c == "@", let next = at(1), Self.isIdentStart(next) {
                let start = i
                i += 1
                while let d = at(), Self.isIdentPart(d) || d == "." { i += 1 }
                emit(.meta, start, i)
                continue
            }
            if scanNumber() { continue }
            if let (start, word) = readIdentifier() {
                let previous = lastSignificant
                let kind: CodeHighlighter.TokenKind
                if keywords.contains(word) {
                    kind = .keyword
                } else if literals.contains(word) {
                    kind = .literal
                } else if builtins.contains(word) {
                    kind = .builtin
                } else if let previous, previous.kind == .keyword, declarers.contains(previous.text) {
                    kind = .title
                } else if nextNonSpace(from: i) == "(", let previous, isReturnTypePosition(previous, notTypes: notTypes) {
                    // `Command getAutonomousCommand(` or `void periodic(`: a method declaration.
                    kind = .title
                } else {
                    kind = .plain
                }
                emit(kind, start, i)
                continue
            }
            scanPunctuation()
        }
    }

    // MARK: Python

    mutating func scanPython() {
        var declaring = false
        while i < s.count {
            if scanWhitespace() { continue }
            let c = s[i]
            if c == "#" { scanToLineEnd(as: .comment); continue }
            if c == "@" && isLineStart(i) {
                let start = i
                i += 1
                while let d = at(), Self.isIdentPart(d) || d == "." { i += 1 }
                emit(.meta, start, i)
                continue
            }
            if c == "\"" || c == "'" {
                if matches(String(repeating: String(c), count: 3)) { scanTripleQuoted(c) } else { scanQuoted(c) }
                continue
            }
            if scanNumber() { continue }
            if let (start, word) = readIdentifier() {
                // String prefixes: r"", f'', b"", rb'' ...
                if word.count <= 2, word.lowercased().allSatisfy({ "rbuf".contains($0) }),
                   let q = at(), q == "\"" || q == "'" {
                    let raw = word.lowercased().contains("r")
                    if matches(String(repeating: String(q), count: 3)) {
                        scanTripleQuoted(q, start: start, escapes: !raw)
                    } else {
                        scanQuoted(q, escapes: !raw, start: start)
                    }
                    continue
                }
                let kind: CodeHighlighter.TokenKind
                if declaring {
                    kind = .title
                    declaring = false
                } else if CodeHighlighter.pythonKeywords.contains(word) {
                    kind = .keyword
                    declaring = word == "def" || word == "class"
                } else if CodeHighlighter.pythonLiterals.contains(word) {
                    kind = .literal
                } else if CodeHighlighter.pythonBuiltins.contains(word), i == s.count || s[i] != "=" {
                    kind = .builtin
                } else {
                    kind = .plain
                }
                emit(kind, start, i)
                continue
            }
            declaring = false
            scanPunctuation()
        }
    }

    // MARK: Bash

    static func isBashWordChar(_ c: Unicode.Scalar) -> Bool {
        !isSpace(c) && !"|&;<>(){}[]\"'`$#\\".unicodeScalars.contains(c)
    }

    mutating func scanBash() {
        while i < s.count {
            if scanWhitespace() { continue }
            let c = s[i]
            if c == "#" && (i == 0 || Self.isSpace(s[i - 1])) { scanToLineEnd(as: .comment); continue }
            if c == "'" { scanQuoted("'", escapes: false, multiline: true); continue }
            if c == "\"" { scanQuoted("\"", multiline: true); continue }
            if c == "\\" {
                emit(.plain, i, min(i + 2, s.count))
                i = min(i + 2, s.count)
                continue
            }
            if c == "$" {
                let start = i
                i += 1
                if at() == "{" {
                    while let d = at(), d != "}" { i += 1 }
                    i = min(i + 1, s.count)
                    emit(.variable, start, i)
                } else if let d = at(), Self.isIdentStart(d) {
                    while let e = at(), Self.isIdentPart(e) && e != "$" { i += 1 }
                    emit(.variable, start, i)
                } else if let d = at(), Self.isDigit(d) || "@#?*!$-".unicodeScalars.contains(d) {
                    i += 1
                    emit(.variable, start, i)
                } else {
                    emit(.punctuation, start, i)
                }
                continue
            }
            if Self.isBashWordChar(c) {
                let start = i
                while let d = at(), Self.isBashWordChar(d) { i += 1 }
                let word = String(String.UnicodeScalarView(s[start..<i]))
                let kind: CodeHighlighter.TokenKind
                if CodeHighlighter.bashKeywords.contains(word) {
                    kind = .keyword
                } else if CodeHighlighter.bashBuiltins.contains(word) {
                    kind = .builtin
                } else if word.unicodeScalars.allSatisfy(Self.isDigit) {
                    kind = .number
                } else {
                    kind = .plain
                }
                emit(kind, start, i)
                continue
            }
            scanPunctuation()
        }
    }

    // MARK: JSON

    mutating func scanJSON() {
        while i < s.count {
            if scanWhitespace() { continue }
            let c = s[i]
            if matches("//") { scanToLineEnd(as: .comment); continue }
            if scanBlockComment() { continue }
            if c == "\"" {
                let start = i
                i += 1
                while let d = at(), d != "\"", d != "\n" {
                    i += d == "\\" ? 2 : 1
                }
                i = min(i + 1, s.count)
                // A key is a string followed by a colon.
                var j = i
                while j < s.count, Self.isSpace(s[j]) { j += 1 }
                let isKey = j < s.count && s[j] == ":"
                emit(isKey ? .attribute : .string, start, i)
                continue
            }
            if c == "-", at(1).map(Self.isDigit) == true {
                let start = i
                i += 1
                _ = scanNumber()
                if let last = out.last, last.kind == .number {
                    out.removeLast()
                }
                emit(.number, start, i)
                continue
            }
            if scanNumber() { continue }
            if let (start, word) = readIdentifier() {
                emit(["true", "false", "null"].contains(word) ? .literal : .plain, start, i)
                continue
            }
            scanPunctuation()
        }
    }

    // MARK: SQL

    mutating func scanSQL() {
        while i < s.count {
            if scanWhitespace() { continue }
            let c = s[i]
            if matches("--") { scanToLineEnd(as: .comment); continue }
            if scanBlockComment() { continue }
            if c == "'" { scanQuoted("'", multiline: true); continue }
            if c == "\"" { scanQuoted("\""); continue }
            if scanNumber() { continue }
            if let (start, word) = readIdentifier() {
                emit(CodeHighlighter.sqlKeywords.contains(word.lowercased()) ? .keyword : .plain, start, i)
                continue
            }
            scanPunctuation()
        }
    }
}
