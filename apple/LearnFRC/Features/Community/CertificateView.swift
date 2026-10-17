import SwiftUI
import UniformTypeIdentifiers

/// A department's certificate (the site's `/certificate/[department]`).
///
/// Not finished yet, it's a different page, not a certificate with the good bits greyed out:
/// the figure that's missing, the unstamped box, and the next lesson. Finished, it's the
/// certificate with the signed-in learner's own name, shared as an image or a PDF (drawn with
/// `ImageRenderer`) or saved as a PDF.
struct CertificateView: View {
    let departmentID: UUID

    @Environment(CatalogStore.self) private var catalog
    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(AppModel.self) private var app

    /// The files drawn for the certificate, with the words they were drawn from. A link to
    /// another department can reuse this view, and it must never share the last one's files.
    @State private var rendered: Rendered?
    @State private var isSaving = false
    /// "Saved." (or why not) for the department it was said about.
    @State private var savedNote: (departmentID: UUID, text: String)?

    private struct Rendered {
        let content: CertificateContent
        let export: CertificateExport
    }

    init(departmentID: UUID) {
        self.departmentID = departmentID
    }

    private var department: Department? { catalog.department(id: departmentID) }

    /// The files for the certificate on screen, once they're drawn.
    private var export: CertificateExport? {
        guard let rendered, let content, rendered.content == content else { return nil }
        return rendered.export
    }

    /// The certificate's words, once it's earned and there's a signed-in learner to name.
    private var content: CertificateContent? {
        guard let department, let me = account.me, !me.isProvisional, isComplete(department) else { return nil }
        let awarded = progress.completionDate(of: department) ?? .now
        return CertificateContent(
            name: me.profile.certificateName,
            departmentName: department.name,
            departmentSlug: department.slug,
            lessonCount: department.lessonCount,
            moduleCount: department.modules.count,
            awardedOn: awarded,
            teamNumber: me.profile.teamNumber,
            credentialID: department.credentialID(issuedOn: awarded)
        )
    }

    private func isComplete(_ department: Department) -> Bool {
        let counts = progress.departmentProgress(department)
        return counts.total > 0 && counts.done >= counts.total
    }

    var body: some View {
        CommunityPage(refresh: { await app.refreshAll() }, place: .route(.certificate(departmentID))) { layout, _ in
            Group {
                if let department {
                    if let me = account.me, me.isProvisional, isComplete(department) {
                        CommunityEmptyNote("certificate / waiting for your account", "This certificate carries the name on your account, and the app hasn't loaded it yet. Connect to the internet and \(CommunityCopy.refreshHintInSentence).")
                            .foldLeadingPage(layout.pages)
                            .padding(.top, 28)
                    } else if let content {
                        if let pages = layout.pages {
                            earnedSpread(content, pages: pages)
                        } else {
                            earned(content, department: department, layout: layout)
                        }
                    } else if isComplete(department) {
                        finishedAsGuest(department, pages: layout.pages)
                    } else {
                        notYet(department, layout: layout)
                    }
                } else if catalog.isLoaded {
                    CommunityEmptyNote("certificate / not found", "That department isn't in the catalogue any more. \(CommunityCopy.refreshHint), or pick another one in the guides.") {
                        Button("Open the guides") { app.selectedTab = .learn }
                            .buttonStyle(.inkGhostSmall)
                    }
                    .foldLeadingPage(layout.pages)
                    .padding(.top, 28)
                } else {
                    VStack(alignment: .leading, spacing: 16) {
                        SkeletonBlock(height: 12, width: 140)
                        SkeletonBlock(height: 40, width: 300)
                        SkeletonBlock(height: 220).padding(.top, 12)
                    }
                    .foldLeadingPage(layout.pages)
                    .padding(.top, 28)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Loading the certificate")
                }
            }
            .communityColumn(layout)
        }
        .communityNavigationTitle(department.map { "\(CommunityFormat.subteamLabel($0.name)) certificate" } ?? "Certificate")
        .toolbar {
            if let export, let content {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        ShareLink(item: export.imageFile, subject: Text(shareSubject(content)), message: Text(shareMessage(content)), preview: SharePreview(content.fileBaseName, image: Image(decorative: export.previewImage.image, scale: 3))) {
                            Label("Share image", systemImage: "photo")
                        }
                        ShareLink(item: export.pdfFile, subject: Text(shareSubject(content)), message: Text(shareMessage(content)), preview: SharePreview("\(content.fileBaseName).pdf", image: Image(decorative: export.previewImage.image, scale: 3))) {
                            Label("Share PDF", systemImage: "doc.richtext")
                        }
                        Button {
                            isSaving = true
                        } label: {
                            Label("Save PDF…", systemImage: "square.and.arrow.down")
                        }
                    } label: {
                        Label("Share certificate", systemImage: "square.and.arrow.up")
                    }
                    .help("Share or save the certificate")
                }
            }
        }
        .fileExporter(
            isPresented: $isSaving,
            item: export?.pdfFile,
            contentTypes: [.pdf],
            defaultFilename: content.map { "\($0.fileBaseName).pdf" },
            onCompletion: { result in
                switch result {
                case .success:
                    savedNote = (departmentID, "Saved.")
                    Haptics.success()
                case .failure(let error):
                    savedNote = (departmentID, "Couldn't save the PDF: \(error.localizedDescription)")
                }
            },
            onCancellation: {}
        )
        // A link or a search takes the window elsewhere: the save panel goes with the screen.
        .closesOnNavigation($isSaving)
        .task(id: content) {
            guard let content else {
                rendered = nil
                return
            }
            // Let the page draw first; rendering the sheet takes a moment.
            await Task.yield()
            rendered = CertificateExport.render(content).map { Rendered(content: content, export: $0) }
        }
    }

    // MARK: Earned

    @ViewBuilder
    private func earned(_ content: CertificateContent, department: Department, layout: CommunityLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            actions(content)
                .padding(.top, layout.isWide ? 28 : 16)

            CertificateArtwork(content: content, mode: .screen(width: min(layout.columnWidth, 896)), stampLands: true)
                .frame(maxWidth: 896)
                .frame(maxWidth: .infinity)
                .padding(.top, 26)

            if let username = account.profile?.username {
                challenge(content, username: username)
                    .frame(maxWidth: 896)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 36)
            }

            Text("share it as an image, or save the PDF to print it")
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .foregroundStyle(LF.Palette.graphite)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 24)
        }
    }

    /// An open iPhone Duo: the certificate on the left page; sharing, saving and the
    /// challenge on the right.
    private func earnedSpread(_ content: CertificateContent, pages: FoldColumns) -> some View {
        FoldPages(pages) {
            CertificateArtwork(content: content, mode: .screen(width: pages.leading), stampLands: true)
        } trailing: {
            VStack(alignment: .leading, spacing: 0) {
                actions(content)
                Text("share it as an image, or save the PDF to print it")
                    .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
                if let username = account.profile?.username {
                    challenge(content, username: username)
                        .padding(.top, 32)
                }
            }
            .padding(.top, 12)
        }
        .padding(.top, 28)
    }

    private func actions(_ content: CertificateContent) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { actionButtons(content) }
                VStack(alignment: .leading, spacing: 10) { actionButtons(content) }
            }
            if let savedNote, savedNote.departmentID == departmentID {
                Text(savedNote.text)
                    .font(LF.Fonts.mono(12, relativeTo: .caption))
                    .foregroundStyle(LF.Palette.graphite)
                    .accessibilityAddTraits(.updatesFrequently)
            }
        }
        .frame(maxWidth: 896, alignment: .leading)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func actionButtons(_ content: CertificateContent) -> some View {
        if let export {
            ShareLink(
                item: export.imageFile,
                subject: Text(shareSubject(content)),
                message: Text(shareMessage(content)),
                preview: SharePreview(content.fileBaseName, image: Image(decorative: export.previewImage.image, scale: 3))
            ) {
                Label("Share image", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.ink)
            ShareLink(
                item: export.pdfFile,
                subject: Text(shareSubject(content)),
                message: Text(shareMessage(content)),
                preview: SharePreview("\(content.fileBaseName).pdf", image: Image(decorative: export.previewImage.image, scale: 3))
            ) {
                Label("Share PDF", systemImage: "doc.richtext")
            }
            .buttonStyle(.inkGhost)
            Button {
                isSaving = true
            } label: {
                Label("Save PDF", systemImage: "square.and.arrow.down")
            }
            .buttonStyle(.inkGhost)
            .keyboardShortcut("s", modifiers: .command)
        } else {
            HStack(spacing: 10) {
                ProgressView().controlSize(.small)
                SlugText("getting the files ready")
            }
            .frame(minHeight: LF.Metrics.tap)
        }
    }

    private func challenge(_ content: CertificateContent, username: String) -> some View {
        NoteCallout {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .center, spacing: 20) {
                    challengeText.frame(maxWidth: .infinity, alignment: .leading)
                    challengeButton(username)
                }
                VStack(alignment: .leading, spacing: 12) {
                    challengeText
                    challengeButton(username)
                }
            }
        }
    }

    private var challengeText: some View {
        VStack(alignment: .leading, spacing: 6) {
            SlugText("note / challenge your team")
            Text("They learn free, you both get +25 XP, and one of you gets the bragging rights.")
                .lfProse(15.5, lineHeight: 1.45)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func challengeButton(_ username: String) -> some View {
        ShareLink(
            item: CommunityInviteLink.signup(ref: username, via: "certificate"),
            subject: Text("Join me on LearnFRC"),
            message: Text("I'm learning every part of FRC, free, on LearnFRC. Think you can keep up? Join me:")
        ) {
            Label("Send it", systemImage: "paperplane")
        }
        .buttonStyle(.inkGhostSmall)
    }

    private func shareSubject(_ content: CertificateContent) -> String {
        "\(content.departmentName) certificate, LearnFRC"
    }

    private func shareMessage(_ content: CertificateContent) -> String {
        let link = account.profile?.username.map { CommunityInviteLink.signup(ref: $0, via: "certificate") } ?? AppConfig.webBase
        return "I just earned the \(content.departmentName) certificate on LearnFRC, free FRC training for every seat on the team. Earn yours: \(link.absoluteString)"
    }

    // MARK: Not yet

    private func notYet(_ department: Department, layout: CommunityLayout) -> some View {
        let counts = progress.departmentProgress(department)
        let remaining = max(0, counts.total - counts.done)
        let percent = CommunityFormat.percent(counts.done, of: counts.total)
        let lessons = catalog.lessons(in: department)
        let next = lessons.first { !progress.isCompleted($0.lesson.id) } ?? lessons.first

        let intro = VStack(alignment: .leading, spacing: 0) {
            SectionLabel("dept / \(department.slug)")
            Text(counts.total == 0
                 ? "This department has no lessons yet."
                 : "\(CommunityFormat.count(remaining, "lesson")) left to sign this one off.")
                .lfTitle(.h1)
                .frame(maxWidth: 620, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            CommunityLede("Finish every lesson in \(department.name) and this page turns into a certificate with your name on it, ready to share or save as a PDF for the pit wall or a college application.")
                .padding(.top, 18)
        }

        return Group {
            if let pages = layout.pages {
                // An open iPhone Duo: what's left on the left page, the progress card on the right.
                FoldPages(pages) {
                    VStack(alignment: .leading, spacing: 0) {
                        intro
                        notYetMarker
                    }
                } trailing: {
                    VStack(alignment: .leading, spacing: 0) {
                        notYetCard(counts: counts, percent: percent, next: next, department: department, layout: layout.trailingPage)
                            .padding(.top, 12)
                        guestNote
                    }
                }
                .padding(.top, 36)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    intro
                        .padding(.top, layout.isWide ? 36 : 18)
                    notYetCard(counts: counts, percent: percent, next: next, department: department, layout: layout)
                        .padding(.top, 34)
                    notYetMarker
                    guestNote
                }
            }
        }
    }

    private func notYetCard(counts: (done: Int, total: Int), percent: Int, next: LessonLocation?, department: Department, layout: CommunityLayout) -> some View {
        NotebookCard(tilt: .preset(0), tape: true, padding: layout.isRegular ? 28 : 22) {
            if layout.isRegular {
                HStack(alignment: .center, spacing: 36) {
                    PendingStampView(percent: percent)
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    progressBlock(counts: counts, percent: percent, next: next, department: department)
                }
            } else {
                // The stamp is a fixed-size graphic (its figure is printed beside it too), so
                // its type stops growing at xxxLarge and it never pushes the card past the
                // page's edge at the accessibility sizes.
                PendingStampView(percent: percent)
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                progressBlock(counts: counts, percent: percent, next: next, department: department)
                    .padding(.top, 22)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            TapeStrip(angle: 2.8).offset(x: -52, y: 12)
        }
        .frame(maxWidth: 740, alignment: .leading)
    }

    private var notYetMarker: some View {
        MarkerText("one certificate per department, not per lesson")
            .padding(.top, 24)
            .padding(.leading, 4)
    }

    @ViewBuilder
    private var guestNote: some View {
        if account.isGuest {
            NoteCallout {
                SlugText("certificates / need an account")
                Text("A certificate carries your name, so it lives on an account. The lessons you finish on this device move into it when you sign in.")
                    .lfProse(15.5, lineHeight: 1.45)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Sign in or make an account") { app.selectedTab = .profile }
                    .buttonStyle(.inkGhostSmall)
                    .padding(.top, 6)
            }
            .frame(maxWidth: 740, alignment: .leading)
            .padding(.top, 30)
        }
    }

    private func progressBlock(counts: (done: Int, total: Int), percent: Int, next: LessonLocation?, department: Department) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("lessons finished")
            CountText("\(counts.done)", unit: "of \(counts.total)", size: 36)
                .padding(.top, 4)
            MeterView(value: counts.total > 0 ? Double(counts.done) / Double(counts.total) : 0)
                .accessibilityLabel("\(counts.done) of \(counts.total) lessons finished")
                .padding(.top, 12)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) { notYetButtons(next: next, department: department) }
                VStack(alignment: .leading, spacing: 10) { notYetButtons(next: next, department: department) }
            }
            .padding(.top, 20)
        }
    }

    @ViewBuilder
    private func notYetButtons(next: LessonLocation?, department: Department) -> some View {
        if let next {
            NavigationLink(value: AppRoute.lesson(next.lesson.id)) {
                Text("Read the next one")
            }
            .buttonStyle(.ink)
            .accessibilityHint(next.lesson.title)
        }
        NavigationLink(value: AppRoute.department(department.id)) {
            Text("Back to \(CommunityFormat.subteamLabel(department.name))")
        }
        .buttonStyle(.inkGhost)
    }

    // MARK: Finished on this device, no account

    private func finishedAsGuest(_ department: Department, pages: FoldColumns?) -> some View {
        // An open iPhone Duo: the stamp on the left page, the ask on the right.
        FoldPages(pages, spacing: 24) {
            StampView("Finished", caption: "dept / \(department.slug)", footnote: "on this device")
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                .padding(.top, 34)
                .padding(.leading, 8)
        } trailing: {
            CommunitySignInCard(
                slug: "certificate / sign in",
                title: "You've finished every lesson in \(department.name).",
                message: "A certificate carries your name, so it needs an account. Sign in or make one and the lessons you finished here move into it, then this page turns into your certificate."
            )
            .padding(.top, pages == nil ? 0 : 34)
        }
    }
}

// MARK: - Previews

extension PreviewCommunity {
    /// Signed in, with every Business lesson finished, so its certificate is earned.
    @MainActor
    static func certificateModel(signedIn: Bool = true) -> AppModel {
        let model = AppModel.preview(signedIn: signedIn)
        let lessons = PreviewData.businessDepartment.lessons
        let completions = lessons.enumerated().map { index, lesson in
            Completion(lessonID: lesson.id, completedAt: PreviewData.now.addingTimeInterval(Double(index - lessons.count) * 86_400), xpAwarded: 12)
        }
        if signedIn {
            let base = PreviewData.progress(.goalMet)
            let snapshot = ProgressSnapshot(
                completions: completions, bookmarks: base.bookmarks, earnedAchievements: base.earnedAchievements,
                xp: base.xp, level: base.level, rhythm: base.rhythm, rhythmCopy: base.rhythmCopy, nextUnlock: base.nextUnlock
            )
            model.progress.applyPreview(account: snapshot, userID: PreviewData.userID)
        } else {
            model.progress.applyPreview(account: nil, userID: nil, guestCompletions: completions.map { GuestCompletion(lessonID: $0.lessonID, completedAt: $0.completedAt) })
        }
        return model
    }
}

#Preview("Certificate earned, iPhone", traits: .fixedLayout(width: 393, height: 1500)) {
    CommunityPreviewHost(model: PreviewCommunity.certificateModel()) {
        CertificateView(departmentID: PreviewData.businessDepartment.id)
    }
    .environment(\.colorScheme, .light)
}

#Preview("Certificate earned, iPad, dark", traits: .fixedLayout(width: 1180, height: 1100)) {
    CommunityPreviewHost(model: PreviewCommunity.certificateModel()) {
        CertificateView(departmentID: PreviewData.businessDepartment.id)
    }
    .environment(\.colorScheme, .dark)
}

#Preview("Certificate not yet, iPhone, dark", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost(model: .preview(phase: .building)) {
        CertificateView(departmentID: PreviewData.department.id)
    }
    .environment(\.colorScheme, .dark)
}

#Preview("Certificate not yet, iPad", traits: .fixedLayout(width: 834, height: 1100)) {
    CommunityPreviewHost(model: .preview(signedIn: false)) {
        CertificateView(departmentID: PreviewData.department.id)
    }
    .environment(\.colorScheme, .light)
}

#Preview("Certificate earned, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 1000)) {
    CommunityPreviewHost(model: PreviewCommunity.certificateModel()) {
        CertificateView(departmentID: PreviewData.businessDepartment.id)
    }
    .previewFold(.previewBook)
    .environment(\.colorScheme, .light)
}

#Preview("Certificate not yet, iPhone Duo open, night", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 900)) {
    CommunityPreviewHost(model: .preview(signedIn: false)) {
        CertificateView(departmentID: PreviewData.department.id)
    }
    .previewFold(.previewFlat)
    .environment(\.colorScheme, .dark)
}
