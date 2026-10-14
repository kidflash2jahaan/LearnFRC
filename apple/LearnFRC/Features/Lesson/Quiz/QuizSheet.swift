import Foundation

/// The answer sheet's rules, exactly as the website runs them (`lesson-complete.tsx`):
///
/// - Every question must be right for the lesson to count. Options stay in stored order.
/// - Submitting grades every question. A right answer is banked (locked) and stays
///   answered and untouchable on every retry; only the wrong ones come back.
/// - From the second miss on the same question, its explanation is shown, and it stays
///   shown through the retry. The correct option is never marked: only the learner's own
///   pick is graded, and an unselected option always looks neutral.
/// - Retakes are unlimited. Marking the lesson unread hands back a fresh sheet.
///
/// A value type with no UI in it, so the rules can be checked on their own.
struct QuizSheet: Hashable, Sendable {
    /// From this many misses on the same question, its explanation is shown.
    static let explainAfterMisses = 2

    /// The right option for each question, in order.
    let key: [Int]
    /// Each question's options count (so a stray index can't be selected).
    let optionCounts: [Int]

    /// The learner's current picks, question index to option index.
    private(set) var answers: [Int: Int] = [:]
    /// Questions answered right in an earlier graded attempt. Never cleared by a retry.
    private(set) var locked: Set<Int> = []
    /// Wrong answers per question, across attempts.
    private(set) var misses: [Int: Int] = [:]
    /// True between a submit and the next retry.
    private(set) var graded = false
    private(set) var attempts = 0

    init(quiz: [QuizQuestion]) {
        key = quiz.map(\.answer)
        optionCounts = quiz.map(\.options.count)
    }

    // MARK: Reading the sheet

    var count: Int { key.count }
    var hasQuiz: Bool { !key.isEmpty }
    var answeredCount: Int { key.indices.filter { answers[$0] != nil }.count }
    var allAnswered: Bool { hasQuiz && answeredCount == count }
    var correctCount: Int { key.indices.filter { answers[$0] == key[$0] }.count }
    var passed: Bool { hasQuiz && correctCount == count }
    var lockedCount: Int { locked.count }
    /// Questions still to get right.
    var remaining: Int { count - lockedCount }

    /// What the progress meter counts: answered before the first submit, banked after.
    var meterCount: Int { attempts > 0 ? lockedCount : answeredCount }

    func selection(_ question: Int) -> Int? { answers[question] }
    func isLocked(_ question: Int) -> Bool { locked.contains(question) }
    func missCount(_ question: Int) -> Int { misses[question] ?? 0 }

    /// Graded and not banked: the question to take again.
    func wasWrong(_ question: Int) -> Bool { graded && !locked.contains(question) }

    /// The explanation is handed over once the same question has been missed twice.
    func showsExplanation(_ question: Int) -> Bool {
        !locked.contains(question) && missCount(question) >= Self.explainAfterMisses
    }

    /// An option can be picked only on an ungraded sheet and an unbanked question.
    func canSelect(_ question: Int) -> Bool { !graded && !locked.contains(question) }

    /// How one option looks. Only the learner's own pick is ever graded.
    func state(question: Int, option: Int) -> OptionState {
        let isSelected = answers[question] == option
        guard isSelected else { return .idle }
        if locked.contains(question) { return .correct }
        if graded { return .wrong }
        return .selected
    }

    enum OptionState: Hashable, Sendable {
        case idle, selected, correct, wrong
    }

    /// The answers in question order, for the server's re-grade. Unanswered questions are -1.
    var submission: [Int] { key.indices.map { answers[$0] ?? -1 } }

    // MARK: Changing it

    mutating func select(_ option: Int, for question: Int) {
        guard key.indices.contains(question), canSelect(question),
              (0..<optionCounts[question]).contains(option) else { return }
        answers[question] = option
    }

    /// Grades every question: banks the right ones, counts a miss against the rest.
    /// Returns true when the whole sheet is right.
    @discardableResult
    mutating func grade() -> Bool {
        guard allAnswered else { return false }
        for question in key.indices {
            if answers[question] == key[question] {
                locked.insert(question)
            } else {
                misses[question, default: 0] += 1
            }
        }
        attempts += 1
        graded = true
        return passed
    }

    /// Retry without losing ground: only the questions still wrong are cleared.
    mutating func retry() {
        graded = false
        answers = answers.filter { locked.contains($0.key) }
    }

    /// The pass didn't stick (the save failed): hand the sheet back ready to submit again,
    /// answers kept.
    mutating func reopen() {
        graded = false
    }

    /// A fresh sheet (after "Mark it unread again").
    mutating func reset() {
        answers = [:]
        locked = []
        misses = [:]
        graded = false
        attempts = 0
    }
}
