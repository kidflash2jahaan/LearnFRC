import SwiftUI

/// "Ask me later" lasts until the app quits, the way the site's lasts until the tab closes.
@Observable
@MainActor
final class HomeEmailPromptSession {
    static let shared = HomeEmailPromptSession()
    /// The person tapped "Ask me later" during this run of the app.
    var askLater = false
}

/// Where the reminder-email card is. Owned by `HomeView`, because `emailPrompt` goes false
/// as soon as the answer is saved, and the card has to stay up to say so.
enum HomeEmailCardPhase: Equatable {
    /// Shown while `AccountStore.emailPrompt` is true.
    case asking
    /// An answer is on its way to learnfrc.com.
    case saving
    /// Saved: the one-line confirmation.
    case answered(optIn: Bool)
}

/// The one-time question about reminder emails, with the site's copy and its three buttons
/// (`email-choice-prompt.tsx`). It's a card in the page, never a modal: nothing is blocked to
/// ask about email. A yes or a no is saved through `AccountStore.setEmailOptIn`, after which
/// `/api/app/me` stops sending `emailPrompt` and the card turns into a one-line confirmation.
struct HomeEmailChoiceCard: View {
    @Binding var phase: HomeEmailCardPhase

    @Environment(AccountStore.self) private var account
    @Environment(AppModel.self) private var model
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @Environment(\.navigationTab) private var tab
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    #if os(macOS)
    @Environment(\.openSettings) private var openSettings
    #endif
    @State private var errorText: String?

    private let session = HomeEmailPromptSession.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if case .answered(let optIn) = phase {
                confirmationView(optIn: optIn)
            } else {
                question
            }
        }
        .padding(LF.Metrics.cardPadding + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox(radius: .a, shadow: .card)
        .accessibilityElement(children: .contain)
        .environment(\.openURL, OpenURLAction { url in
            guard url == AppRoute.settings.deepLinkURL else { return .systemAction }
            #if os(macOS)
            // The Mac has one Settings, in its own window (what `SettingsLink` opens).
            // Pushing the screen into the main window made a second copy.
            openSettings()
            #else
            // Onto Home's own stack, where the card is.
            if let navigation, let tab { navigation.push(.settings, in: tab) } else { model.push(.settings) }
            #endif
            return .handled
        })
    }

    // MARK: The question

    private var question: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("email / your call")
            Text("Want reminder emails?")
                .homeTitle(21, relativeTo: .title3)
                .padding(.top, 8)
            Text(explanation)
                .font(LF.Fonts.body(15.5))
                .lineHeight(.multiple(factor: 1.45))
                .foregroundStyle(LF.Palette.graphite)
                .tint(LF.Palette.blue)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            buttons
                .padding(.top, 16)
                .disabled(phase == .saving)

            if let errorText {
                FieldError(errorText)
                    .padding(.top, 12)
            }
        }
    }

    /// The site's paragraph, with "Settings" as a link that opens Settings in the app (the
    /// Settings window on a Mac).
    private var explanation: AttributedString {
        var text = AttributedString("Reminders are now off unless you turn them on. Say yes and we'll email you now and then about your next lesson, picked up from where you left off. You can change it any time in ")
        var link = AttributedString("Settings")
        link.link = AppRoute.settings.deepLinkURL
        link.underlineStyle = .single
        text.append(link)
        text.append(AttributedString("."))
        return text
    }

    private var buttons: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 10) {
                answerButtons
                Spacer(minLength: 8)
                laterButton
            }
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) { answerButtons }
                laterButton
            }
            VStack(alignment: .leading, spacing: 10) {
                answerButtons
                laterButton
            }
        }
    }

    @ViewBuilder private var answerButtons: some View {
        Button("Yes, email me") { answer(true) }
            .buttonStyle(.inkSmall)
        Button("No thanks") { answer(false) }
            .buttonStyle(.inkGhostSmall)
    }

    private var laterButton: some View {
        Button("Ask me later") {
            Haptics.select()
            LF.Motion.perform(LF.Motion.settle) { session.askLater = true }
        }
        .buttonStyle(.homeText)
        .accessibilityHint("Hides this until you next open the app")
    }

    // MARK: The answer

    private func confirmationView(optIn: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            PenCheckMark(size: 17)
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: 4) {
                SlugText("email / saved")
                Text(Self.confirmationText(optIn: optIn))
                    .font(LF.Fonts.body(15.5, weight: .medium))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button("Done") {
                LF.Motion.perform(LF.Motion.settle) { phase = .asking }
            }
            .buttonStyle(.homeText)
        }
        .accessibilityElement(children: .combine)
    }

    static func confirmationText(optIn: Bool) -> String {
        optIn
            ? "Reminder emails are on. You can turn them off in Settings."
            : "No reminder emails. You can turn them on in Settings."
    }

    private func answer(_ optIn: Bool) {
        guard phase == .asking else { return }
        phase = .saving
        errorText = nil
        Task {
            do {
                try await account.setEmailOptIn(optIn)
                Haptics.success()
                LF.Motion.perform(LF.Motion.settle) { phase = .answered(optIn: optIn) }
                AccessibilityNotification.Announcement(Self.confirmationText(optIn: optIn)).post()
                // Like the site's toast, the confirmation clears itself after a while.
                try? await Task.sleep(for: .seconds(8))
                if phase == .answered(optIn: optIn) {
                    LF.Motion.perform(LF.Motion.settle) { phase = .asking }
                }
            } catch {
                phase = .asking
                let error = APIError.from(error)
                errorText = error == .network
                    ? "Couldn't save that. Check your connection and try again."
                    : error.message
            }
        }
    }
}

// MARK: - Previews

private struct HomeEmailChoicePreview: View {
    @State var phase = HomeEmailCardPhase.asking
    var body: some View {
        ScrollView {
            VStack(spacing: 30) {
                HomeEmailChoiceCard(phase: $phase)
                HomeEmailChoiceCard(phase: .constant(.answered(optIn: true)))
            }
            .padding(LF.Metrics.gutter)
            .padding(.top, 14)
        }
        .paperBackground()
    }
}

#Preview("Email question, iPhone", traits: .fixedLayout(width: 393, height: 560)) {
    HomeEmailChoicePreview()
        .appEnvironment(.preview(me: PreviewData.meWithEmailPrompt))
        .environment(\.colorScheme, .light)
}

#Preview("Email question, iPhone, dark", traits: .fixedLayout(width: 393, height: 560)) {
    HomeEmailChoicePreview()
        .appEnvironment(.preview(me: PreviewData.meWithEmailPrompt))
        .environment(\.colorScheme, .dark)
}

#Preview("Email question, iPad", traits: .fixedLayout(width: 560, height: 480)) {
    HomeEmailChoicePreview()
        .appEnvironment(.preview(me: PreviewData.meWithEmailPrompt))
        .environment(\.colorScheme, .light)
}
