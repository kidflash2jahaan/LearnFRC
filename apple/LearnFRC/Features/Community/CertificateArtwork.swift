import SwiftUI
import UniformTypeIdentifiers
import ImageIO

/// What a certificate says. The name is the signed-in learner's own (full name, else
/// username, else "FRC Learner"); nobody else's name is ever printed.
struct CertificateContent: Hashable, Sendable {
    let name: String
    let departmentName: String
    let departmentSlug: String
    let lessonCount: Int
    let moduleCount: Int
    /// The last completion in the department.
    let awardedOn: Date
    let teamNumber: Int?
    /// `LFRC-{SLG}-{lessons}{yy}`, the site's format.
    let credentialID: String

    var year: Int { Calendar.current.component(.year, from: awardedOn) }
    var dateText: String { awardedOn.formatted(date: .long, time: .omitted) }
    /// "LearnFRC Programming certificate"
    var fileBaseName: String {
        let short = CommunityFormat.subteamLabel(departmentName)
        return "LearnFRC \(short) certificate"
    }
}

/// The certificate itself: one hand-ruled card with the inspection stamp pressed into its
/// corner. The same drawing shows on screen (`.screen`, responsive, Dynamic Type) and goes
/// into the exported image and PDF (`.page`, a fixed US Letter landscape sheet on paper).
struct CertificateArtwork: View {
    enum Mode: Hashable {
        /// On screen, at this width.
        case screen(width: CGFloat)
        /// The exported sheet, 792 x 612 points.
        case page
    }

    static let pageSize = CGSize(width: 792, height: 612)

    let content: CertificateContent
    var mode: Mode
    /// The stamp comes down when the page opens; exports draw it already landed.
    var stampLands: Bool = false

    private var isPage: Bool { mode == .page }
    /// Room for the three signature cells side by side and the wider margins.
    private var isRoomy: Bool {
        switch mode {
        case .page: true
        case .screen(let width): width >= 560
        }
    }

    private var isWide: Bool {
        switch mode {
        case .page: true
        // Below this the corner stamp would run into the centred heading, so it sits on top.
        case .screen(let width): width >= 860
        }
    }

    var body: some View {
        if isPage {
            ZStack {
                PaperBackground()
                card
                    .padding(.horizontal, 34)
                    .padding(.vertical, 30)
            }
            .frame(width: Self.pageSize.width, height: Self.pageSize.height)
        } else {
            card
        }
    }

    // MARK: The card

    private var card: some View {
        VStack(spacing: 0) {
            if !isWide {
                stamp.padding(.bottom, 26)
            }
            LearnFRCWordmark(size: isPage ? 22 : 24)
            Text("certificate of completion")
                .font(LF.Fonts.mono(isPage ? 11.5 : 12.5, relativeTo: .caption))
                .tracking((isPage ? 11.5 : 12.5) * 0.18)
                .foregroundStyle(LF.Palette.graphite)
                .padding(.top, isPage ? 20 : 26)
            Text("This certifies that")
                .font(LF.Fonts.body(isPage ? 15 : 17, relativeTo: .body))
                .foregroundStyle(LF.Palette.graphite)
                .padding(.top, isPage ? 16 : 24)
            Text(content.name)
                .font(LF.Fonts.display(nameSize, relativeTo: .largeTitle))
                .tracking(nameSize * -0.025)
                .foregroundStyle(LF.Palette.ink)
                .multilineTextAlignment(.center)
                .lineLimit(isPage ? 2 : 3)
                .minimumScaleFactor(0.5)
                .padding(.top, 8)
                .accessibilityAddTraits(.isHeader)
            departmentRule
                .padding(.top, isPage ? 16 : 22)
            summary
                .padding(.top, isPage ? 12 : 16)
            signatures
                .padding(.top, isPage ? 22 : 30)
            Text(content.credentialID)
                .font(LF.Fonts.mono(isPage ? 10.5 : 12, relativeTo: .caption))
                .tracking((isPage ? 10.5 : 12) * 0.16)
                .foregroundStyle(LF.Palette.graphite)
                .textSelection(.enabled)
                .padding(.top, isPage ? 14 : 22)
                .accessibilityLabel("Credential \(content.credentialID)")
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, isPage ? 48 : (isRoomy ? 48 : 22))
        .padding(.top, isPage ? 34 : (isRoomy ? 48 : 34))
        .padding(.bottom, isPage ? 26 : (isRoomy ? 40 : 30))
        .overlay(alignment: .topTrailing) {
            if isWide {
                stamp
                    .scaleEffect(isPage ? 0.82 : 0.9, anchor: .topTrailing)
                    .padding(.top, isPage ? 20 : 32)
                    .padding(.trailing, isPage ? 22 : 32)
            }
        }
        .background { NotebookBoxBackground(size: .a, shadow: .card) }
        .overlay(alignment: .topLeading) {
            TapeStrip(angle: -3.4)
                .offset(x: isPage ? 90 : 48, y: -12)
        }
        .overlay(alignment: .bottomTrailing) {
            TapeStrip(angle: 2.2)
                .offset(x: isPage ? -130 : -56, y: 12)
        }
        .accessibilityElement(children: .contain)
    }

    private var nameSize: CGFloat {
        switch mode {
        case .page: 44
        case .screen(let width): width >= 600 ? 50 : 38
        }
    }

    private var stamp: some View {
        StampView("Certified", caption: "dept / \(content.departmentSlug)", footnote: String(content.year), lands: stampLands)
    }

    private var departmentRule: some View {
        HStack(spacing: 16) {
            Rectangle().fill(LF.Palette.ink).frame(height: 2).accessibilityHidden(true)
            Text(content.departmentName)
                .font(LF.Fonts.body(isPage ? 17 : 19, weight: .heavy, relativeTo: .title3))
                .tracking(-0.4)
                .foregroundStyle(LF.Palette.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .layoutPriority(1)
            Rectangle().fill(LF.Palette.ink).frame(height: 2).accessibilityHidden(true)
        }
        .frame(maxWidth: 560)
    }

    private var summary: some View {
        let lessons = Text(CommunityFormat.count(content.lessonCount, "lesson")).bold().foregroundStyle(LF.Palette.ink)
        let modules = Text(CommunityFormat.count(content.moduleCount, "module")).bold().foregroundStyle(LF.Palette.ink)
        return Text("has finished the whole \(content.departmentName) department on LearnFRC: \(lessons) across \(modules), every quiz passed.")
            .font(LF.Fonts.body(isPage ? 14.5 : 16.5, relativeTo: .body))
            .lineSpacing(3)
            .foregroundStyle(LF.Palette.graphite)
            .multilineTextAlignment(.center)
            .frame(maxWidth: 540)
            .fixedSize(horizontal: false, vertical: true)
    }

    @ViewBuilder
    private var signatures: some View {
        let cells = Group {
            cell(content.dateText, "date awarded", alignment: .leading)
            if let team = content.teamNumber {
                cell("Team \(team)", "frc team", alignment: isRoomy ? .center : .leading)
            } else if isRoomy {
                Color.clear.frame(height: 1).accessibilityHidden(true)
            }
            cell("Jahaan Pardhanani", "founder, learnfrc", alignment: isRoomy ? .trailing : .leading)
        }
        VStack(spacing: 0) {
            InkRule()
            if isRoomy {
                HStack(alignment: .top, spacing: 24) { cells }
                    .padding(.top, isPage ? 12 : 18)
            } else {
                VStack(alignment: .leading, spacing: 16) { cells }
                    .padding(.top, 18)
            }
        }
        .frame(maxWidth: 700)
    }

    private func cell(_ value: String, _ label: String, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 4) {
            Text(value)
                .font(LF.Fonts.body(isPage ? 14 : 16, weight: .bold, relativeTo: .body))
                .foregroundStyle(LF.Palette.ink)
            Text(label)
                .font(LF.Fonts.mono(isPage ? 10.5 : 12, relativeTo: .caption))
                .foregroundStyle(LF.Palette.graphite)
        }
        .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .top))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Export

/// The certificate as files: a US Letter landscape PDF and a 3x PNG, drawn with
/// `ImageRenderer` from the same view that's on screen, always on light paper.
struct CertificateExport: Sendable {
    let pdf: Data
    let png: Data
    let baseName: String
    let previewImage: CGImageBox

    var pdfFile: CertificatePDF { CertificatePDF(data: pdf, name: baseName) }
    var imageFile: CertificateImage { CertificateImage(data: png, name: baseName) }

    @MainActor
    static func render(_ content: CertificateContent) -> CertificateExport? {
        let page = CertificateArtwork(content: content, mode: .page)
            .environment(\.colorScheme, .light)
            .environment(\.dynamicTypeSize, .large)
        let renderer = ImageRenderer(content: page)
        renderer.proposedSize = ProposedViewSize(CertificateArtwork.pageSize)

        // PDF: one vector page.
        let pdfData = NSMutableData()
        var rendered = false
        renderer.render { size, draw in
            var box = CGRect(origin: .zero, size: size)
            guard let consumer = CGDataConsumer(data: pdfData as CFMutableData) else { return }
            let info: [String: Any] = [
                kCGPDFContextTitle as String: "\(content.departmentName) certificate",
                kCGPDFContextCreator as String: "LearnFRC",
                kCGPDFContextAuthor as String: "LearnFRC",
            ]
            guard let pdf = CGContext(consumer: consumer, mediaBox: &box, info as CFDictionary) else { return }
            pdf.beginPDFPage(nil)
            draw(pdf)
            pdf.endPDFPage()
            pdf.closePDF()
            rendered = true
        }
        guard rendered else { return nil }

        // PNG at 3x (2376 x 1836), for messages and photos.
        renderer.scale = 3
        renderer.isOpaque = true
        guard let image = renderer.cgImage, let png = Self.pngData(image) else { return nil }
        return CertificateExport(pdf: pdfData as Data, png: png, baseName: content.fileBaseName, previewImage: CGImageBox(image))
    }

    private static func pngData(_ image: CGImage) -> Data? {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data as CFMutableData, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return data as Data
    }
}

/// A CGImage that can cross into the share sheet's preview.
struct CGImageBox: @unchecked Sendable {
    let image: CGImage
    init(_ image: CGImage) { self.image = image }
}

/// The certificate PDF, for the share sheet and Save PDF.
struct CertificatePDF: Transferable, Sendable {
    let data: Data
    let name: String

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .pdf) { $0.data }
            .suggestedFileName { "\($0.name).pdf" }
    }
}

/// The certificate image, for messages, photos and social posts.
struct CertificateImage: Transferable, Sendable {
    let data: Data
    let name: String

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .png) { $0.data }
            .suggestedFileName { "\($0.name).png" }
    }
}

// MARK: - Previews

#Preview("Certificate page (export)", traits: .fixedLayout(width: 792, height: 612)) {
    CertificateArtwork(content: .preview, mode: .page)
    .environment(\.colorScheme, .light)
}

#Preview("Certificate, iPhone, dark", traits: .fixedLayout(width: 393, height: 900)) {
    ScrollView {
        CertificateArtwork(content: .preview, mode: .screen(width: 361), stampLands: true)
            .padding(16)
    }
    .paperBackground()
    .environment(\.colorScheme, .dark)
}

extension CertificateContent {
    static var preview: CertificateContent {
        let department = PreviewData.businessDepartment
        let date = PreviewData.now
        return CertificateContent(
            name: PreviewData.profile.certificateName,
            departmentName: department.name,
            departmentSlug: department.slug,
            lessonCount: department.lessonCount,
            moduleCount: department.modules.count,
            awardedOn: date,
            teamNumber: PreviewData.teamNumber,
            credentialID: department.credentialID(issuedOn: date)
        )
    }
}
