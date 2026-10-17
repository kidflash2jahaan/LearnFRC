import SwiftUI

/// The feedback inbox (the Feedback drawer on /admin): what people wrote in, newest first, and
/// the box to write back from.
///
/// A carbon-copy log: one message per ruled line, whether it can be answered and the page it
/// came from stamped above it in mono, the message itself at reading size. Every state is a
/// word ("anonymous", "replied"), never an icon. The sender's address never reaches the app:
/// the server looks it up again by the message's id when a reply goes out.
struct AdminFeedbackView: View {
    @Environment(AdminStore.self) private var injected: AdminStore?
    @Environment(AccountStore.self) private var account
    @State private var isOnScreen = false

    private var admin: AdminStore { injected ?? .shared }

    var body: some View {
        AdminPage(avoidsKeyboard: true, refresh: { await admin.loadFeedback() }) { layout in
            content(layout)
        }
        .navigationTitle(AdminDestination.feedback.title)
        #if os(iOS)
        .toolbarTitleDisplayMode(.inline)
        #endif
        .adminRefreshControl(isLoading: admin.feedback.isLoading) {
            Task { await admin.loadFeedback() }
        }
        .adminHandoff(.feedback, isOnShow: isOnScreen && admin.isAdmin)
        .onAppear { isOnScreen = true }
        .onDisappear { isOnScreen = false }
        .task(id: account.userID) {
            await admin.sync(userID: account.userID)
            await admin.loadFeedback()
        }
    }

    @ViewBuilder
    private func content(_ layout: AdminLayout) -> some View {
        let remote = admin.feedback
        VStack(alignment: .leading, spacing: 0) {
            header(remote.value)
                .adminLeadingPage(layout)

            Group {
                if !account.isSignedIn, !account.isLoading {
                    AdminSignedOutCard(destination: .feedback)
                        .adminLeadingPage(layout)
                        .padding(.top, 24)
                } else if remote.locked != nil, remote.value == nil {
                    AdminLockedDashboardCard()
                        .adminLeadingPage(layout)
                        .padding(.top, 24)
                } else if let page = remote.value {
                    if let error = remote.error {
                        AdminLoadError(error: error, hasCopy: true) { Task { await admin.loadFeedback() } }
                            .adminLeadingPage(layout)
                            .padding(.bottom, 16)
                    }
                    inbox(page, layout: layout)
                } else if let error = remote.error {
                    AdminLoadError(error: error, hasCopy: false) { Task { await admin.loadFeedback() } }
                        .adminLeadingPage(layout)
                } else {
                    AdminLoadingBlock(lines: 8)
                        .adminLeadingPage(layout)
                }
            }
            .padding(.top, 28)
        }
        // The site's reading width; on an open iPhone Duo, both pages.
        .frame(maxWidth: layout.isFoldSplit ? .infinity : 860, alignment: .leading)
        .adminColumn(layout)
        .padding(.top, 12)
    }

    private func header(_ page: AdminFeedbackPage?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("drawer / feedback")
            AdminFlowLayout(spacing: 14, lineSpacing: 8) {
                Text("Feedback")
                    .lfTitle(.h1)
                    .fixedSize(horizontal: false, vertical: true)
                if let page, page.openCount > 0 {
                    TagView("\(page.openCount) open")
                }
            }
            if let page {
                SlugText("\(page.total.formatted()) received in total")
            }
        }
    }

    @ViewBuilder
    private func inbox(_ page: AdminFeedbackPage, layout: AdminLayout) -> some View {
        if page.items.isEmpty {
            SlugText("Nothing in the box. Feedback lands here the moment someone sends it.")
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, 8)
        } else {
            // One ruled log, newest first. On an open iPhone Duo it reads like a book: down the
            // left page, then on down the right, and no message sits across the fold. The same
            // two halves either way, so unfolding mid-reply keeps what's written.
            let split = (page.items.count + 1) / 2
            FoldPages(layout.pages) {
                log(Array(page.items.prefix(split)), isWide: layout.isRegular, inkTop: true)
            } trailing: {
                log(Array(page.items.dropFirst(split)), isWide: layout.isRegular, inkTop: layout.isFoldSplit)
                olderLine(page)
            }
        }
    }

    /// Messages, one per ruled line, under an ink rule at the top of a page (a dashed one
    /// where the log just carries on).
    @ViewBuilder
    private func log(_ items: [AdminFeedbackItem], isWide: Bool, inkTop: Bool) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                if inkTop { InkRule() } else { DashedRule() }
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { DashedRule() }
                    AdminFeedbackRow(item: item, isWide: isWide)
                        .padding(.vertical, 18)
                }
            }
        }
    }

    @ViewBuilder
    private func olderLine(_ page: AdminFeedbackPage) -> some View {
        let older = page.total - page.items.count
        if older > 0 {
            DashedRule()
            SlugText("\(older) older \(older == 1 ? "message" : "messages") not shown")
                .padding(.top, 14)
        }
    }
}

/// One filed message, its stamp line, and (when it can be answered) the reply box.
struct AdminFeedbackRow: View {
    let item: AdminFeedbackItem
    var isWide: Bool

    @State private var isComposing = false
    @State private var sentNow = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isWide {
                HStack(alignment: .top, spacing: 16) {
                    message.frame(maxWidth: .infinity, alignment: .leading)
                    replyToggle
                }
            } else {
                message
                if item.canReply {
                    replyToggle.padding(.top, 12)
                }
            }

            if sentNow {
                AdminStatusLine("Reply sent")
                    .padding(.top, 12)
            }

            if item.isReplied, let reply = item.replyBody {
                NoteCallout {
                    SlugText("what you sent back")
                    Text(reply)
                        .lfProse(15, lineHeight: 1.45, color: LF.Palette.graphite)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: 640, alignment: .leading)
                .padding(.top, 12)
                .accessibilityElement(children: .combine)
            }

            if item.canReply, isComposing {
                AdminReplyComposer(item: item) {
                    isComposing = false
                    sentNow = true
                }
                .padding(.top, 14)
            }
        }
        .animation(nil, value: isComposing)
    }

    private var message: some View {
        VStack(alignment: .leading, spacing: 8) {
            AdminFlowLayout(spacing: 14, lineSpacing: 4) {
                if item.hasReplyAddress {
                    SlugText("from / can be answered", color: LF.Palette.ink)
                } else {
                    SlugText("from / anonymous, no reply possible")
                }
                if let page = item.page {
                    SlugText("page / \(page)")
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                SlugText(AdminText.ago(item.createdAt, ago: true))
                if item.isReplied {
                    SlugText("replied", color: LF.Palette.ink, weight: .bold)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(stampSpoken)

            Text(item.message)
                .lfProse(16.5, lineHeight: 1.45)
                .textSelection(.enabled)
                .frame(maxWidth: 640, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var stampSpoken: String {
        var parts = [item.hasReplyAddress ? "Can be answered" : "Anonymous, no reply possible"]
        if let page = item.page { parts.append("from page \(page)") }
        parts.append(AdminText.spokenAgo(item.createdAt))
        if item.isReplied { parts.append("replied") }
        return parts.joined(separator: ", ")
    }

    @ViewBuilder
    private var replyToggle: some View {
        if item.canReply {
            Button(isComposing ? "Cancel" : "Reply") {
                isComposing.toggle()
                if isComposing { sentNow = false }
            }
            .buttonStyle(.inkGhostSmall)
            .accessibilityHint(isComposing ? "Closes the reply box" : "Opens a box to write back to the sender")
        }
    }
}

/// The reply box: the site's label and hint, the error printed against the field, and one
/// button. The text stays if a send fails, so nothing written is lost.
struct AdminReplyComposer: View {
    let item: AdminFeedbackItem
    let onSent: () -> Void

    @Environment(AdminStore.self) private var injected: AdminStore?
    @State private var text = ""
    @State private var isSending = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var admin: AdminStore { injected ?? .shared }

    /// The site's limits, checked here as a courtesy; the server checks them again.
    private static let minimum = 2
    private static let maximum = 4000

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            FieldLabel("Reply to the sender")
            TextField("", text: $text, axis: .vertical)
                .lineLimit(4...14)
                .focused($focused)
                .inkField(focused: focused, invalid: error != nil)
                .disabled(isSending)
                .accessibilityLabel("Reply to the sender")
                .accessibilityHint("It goes straight to their inbox from LearnFRC. There’s no thread on the site, so this row is the whole conversation.")
            FieldHint("It goes straight to their inbox from LearnFRC. There’s no thread on the site, so this row is the whole conversation.")
                .accessibilityHidden(true)
            if let error {
                FieldError(error)
            }
            Button(isSending ? "Sending" : "Send reply") { send() }
                .buttonStyle(.inkSmall)
                .disabled(isSending)
                .padding(.top, 6)
        }
        .frame(maxWidth: 640, alignment: .leading)
        .onAppear { focused = true }
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
    }

    private func send() {
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard body.count >= Self.minimum else {
            error = "Write a reply first."
            return
        }
        guard body.count <= Self.maximum else {
            error = "That reply is too long."
            return
        }
        error = nil
        isSending = true
        Task {
            do throws(AdminError) {
                _ = try await admin.reply(to: item.id, text: body)
                isSending = false
                text = ""
                onSent()
            } catch {
                isSending = false
                self.error = error.message
            }
        }
    }
}

// MARK: - Previews

#Preview("Inbox, iPhone") {
    NavigationStack {
        AdminFeedbackView()
    }
    .adminStore(.preview(role: .admin, feedback: AdminPreviewData.feedback))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Inbox, iPad, dark", traits: .fixedLayout(width: 1024, height: 768)) {
    NavigationStack {
        AdminFeedbackView()
    }
    .adminStore(.preview(role: .admin, feedback: AdminPreviewData.feedback))
    .appEnvironment(.preview(signedIn: true))
    .preferredColorScheme(.dark)
}

#Preview("Inbox, empty") {
    NavigationStack {
        AdminFeedbackView()
    }
    .adminStore(.preview(role: .admin, feedback: AdminFeedbackPage(items: [], openCount: 0, total: 0)))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Inbox, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 1600)) {
    NavigationStack {
        AdminFeedbackView()
    }
    .adminStore(.preview(role: .admin, feedback: AdminPreviewData.feedback))
    .appEnvironment(.preview(signedIn: true))
    .previewFold(.previewBook)
}
