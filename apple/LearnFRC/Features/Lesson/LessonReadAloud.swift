import AVFoundation
import Observation
import SwiftUI

/// Reads a lesson aloud with the system voice (`AVSpeechSynthesizer`): title, summary,
/// the body without its Markdown, then the key takeaways.
///
/// One per lesson screen. It follows VoiceOver's own speech settings when VoiceOver is on,
/// picks the best installed English voice otherwise, keeps playing with the silent switch on
/// (it's speech the person asked for), and stops when the lesson changes or closes.
@Observable
@MainActor
final class LessonReadAloud {
    enum State: Hashable, Sendable {
        case idle, speaking, paused
    }

    private(set) var state: State = .idle

    var isActive: Bool { state != .idle }

    @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()
    @ObservationIgnored private let delegate = SpeechDelegate()
    /// The utterance that's playing, so a late callback from a stopped one is ignored.
    @ObservationIgnored private var current: ObjectIdentifier?

    init() {
        synthesizer.delegate = delegate
        delegate.onEvent = { [weak self] event, utterance in
            self?.handle(event, utterance: utterance)
        }
    }

    /// Starts reading `text` from the top, or pauses and resumes what's already playing.
    func toggle(_ text: @autoclosure () -> String) {
        switch state {
        case .idle: start(text())
        case .speaking: pause()
        case .paused: resume()
        }
    }

    func start(_ text: String) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        stop()
        activateAudioSession()
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.preferredVoice()
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.prefersAssistiveTechnologySettings = true
        utterance.postUtteranceDelay = 0.1
        current = ObjectIdentifier(utterance)
        synthesizer.speak(utterance)
        state = .speaking
    }

    func pause() {
        guard state == .speaking else { return }
        synthesizer.pauseSpeaking(at: .word)
        state = .paused
    }

    func resume() {
        guard state == .paused else { return }
        synthesizer.continueSpeaking()
        state = .speaking
    }

    func stop() {
        current = nil
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        if state != .idle {
            state = .idle
            deactivateAudioSession()
        }
    }

    // MARK: Text

    /// What gets read for a lesson.
    static func script(title: String, summary: String?, plainBody: String, takeaways: [String]) -> String {
        var parts = [title]
        if let summary, !summary.isEmpty { parts.append(summary) }
        parts.append(plainBody)
        if !takeaways.isEmpty {
            parts.append("Key takeaways.")
            parts.append(contentsOf: takeaways.map(LessonText.plain))
        }
        return parts.joined(separator: "\n\n")
    }

    // MARK: Private

    private func handle(_ event: SpeechDelegate.Event, utterance: ObjectIdentifier) {
        guard utterance == current else { return }
        switch event {
        case .started, .continued: state = .speaking
        case .paused: state = .paused
        case .finished, .cancelled:
            current = nil
            state = .idle
            deactivateAudioSession()
        }
    }

    /// The best installed English voice: the device's own English variant first, premium
    /// over enhanced over default, never a novelty voice.
    private static func preferredVoice() -> AVSpeechSynthesisVoice? {
        let current = AVSpeechSynthesisVoice.currentLanguageCode()
        let language = current.hasPrefix("en") ? current : "en-US"
        let voices = AVSpeechSynthesisVoice.speechVoices().filter {
            $0.language.hasPrefix("en") && !$0.voiceTraits.contains(.isNoveltyVoice)
        }
        func rank(_ voice: AVSpeechSynthesisVoice) -> (Int, Int) {
            let quality: Int
            switch voice.quality {
            case .premium: quality = 3
            case .enhanced: quality = 2
            default: quality = 1
            }
            return (voice.language == language ? 1 : 0, quality)
        }
        return voices.max { rank($0) < rank($1) } ?? AVSpeechSynthesisVoice(language: language)
    }

    private func activateAudioSession() {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)
        #endif
    }

    private func deactivateAudioSession() {
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
}

/// Forwards the synthesizer's callbacks to the main actor.
@MainActor
private final class SpeechDelegate: NSObject, AVSpeechSynthesizerDelegate {
    enum Event: Sendable { case started, paused, continued, finished, cancelled }

    var onEvent: ((Event, ObjectIdentifier) -> Void)?

    private nonisolated func forward(_ event: Event, _ utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in
            self.onEvent?(event, id)
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        forward(.started, utterance)
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didPause utterance: AVSpeechUtterance) {
        forward(.paused, utterance)
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didContinue utterance: AVSpeechUtterance) {
        forward(.continued, utterance)
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        forward(.finished, utterance)
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        forward(.cancelled, utterance)
    }
}
