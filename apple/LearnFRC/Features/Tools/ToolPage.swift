import SwiftUI

/// One calculator's page: the Learn page scaffold (paper, width-aware columns, the inline
/// title once the h1 scrolls away), the keypad bar, the readout that floats up once the
/// verdict scrolls off, Share and Handoff to learnfrc.com, in-app routing for links to the
/// site, and the foot of the sheet (`ToolCTA`).
///
/// On iPhone Duo the answer gets a part of the screen of its own (`ToolReadoutPanel`): the
/// inputs on the leading page and the answer on the trailing page with the inner screen held
/// upright, the answer on top and the inputs below it bent like a laptop. The floating
/// readout isn't needed then.
struct ToolPage<Content: View>: View {
    let tool: ToolInfo
    let focus: FocusState<String?>.Binding
    /// The number fields on screen, top to bottom, for the keypad's previous and next.
    var order: [String]
    /// What the floating readout shows while the verdict band is out of sight.
    var readout: [ToolReadout]
    /// The same figures in a few characters, for the keypad bar.
    var keypadSummary: String
    /// The calculator's verdict, for the readout's own page on iPhone Duo. Calculators
    /// without a verdict band show `readout` there instead.
    var verdict: ToolVerdict?
    @ViewBuilder let content: (LearnLayout) -> Content

    @State private var headline = ToolHeadlineTracker()
    /// Where the inputs are: the whole screen, or one pane beside the readout's own.
    @State private var inputsRole = LearnLayout.Role.page
    @Environment(AppModel.self) private var model
    @Environment(\.navigationTab) private var tab
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(tool: ToolInfo,
         focus: FocusState<String?>.Binding,
         order: [String],
         readout: [ToolReadout],
         keypadSummary: String,
         verdict: ToolVerdict? = nil,
         @ViewBuilder content: @escaping (LearnLayout) -> Content) {
        self.tool = tool
        self.focus = focus
        self.order = order
        self.readout = readout
        self.keypadSummary = keypadSummary
        self.verdict = verdict
        self.content = content
    }

    private var webURL: URL { AppConfig.webBase.appending(path: tool.webPath) }
    /// The floating readout shows while the verdict is out of sight. On iPhone and iPad it
    /// steps aside while a field is being typed in (the keypad bar carries the result then),
    /// so it never covers the field; on iPhone Duo's split screen the readout has its own pane.
    private var showsReadout: Bool {
        #if os(iOS)
        inputsRole == .page && !headline.isOnScreen && !readout.isEmpty && focus.wrappedValue == nil
        #else
        !headline.isOnScreen && !readout.isEmpty
        #endif
    }

    var body: some View {
        LearnScrollPage(title: tool.title, avoidsKeyboard: true, place: .route(.tool(tool.slug)),
                        companionAxes: [.horizontal, .vertical]) { layout, proxy in
            content(layout)
            ToolFooter(tool: tool, layout: layout)
                .learnColumn(layout)
                .padding(.top, 60)
                .preference(key: ToolInputsRoleKey.self, value: layout.role)
                .onChange(of: focus.wrappedValue) { _, field in
                    #if os(iOS)
                    guard let field else { return }
                    Task { @MainActor in
                        // After the keyboard's own scroll, which stops at the keyboard's top edge.
                        try? await Task.sleep(for: .milliseconds(380))
                        guard focus.wrappedValue == field else { return }
                        LF.Motion.perform(LF.Motion.settle) {
                            proxy.scrollTo(ToolFocusScroll.anchor(field), anchor: UnitPoint(x: 0.5, y: 0.28))
                        }
                    }
                    #endif
                }
        } companion: { layout in
            ToolReadoutPanel(verdict: verdict, readout: readout, layout: layout)
        }
        .onPreferenceChange(ToolInputsRoleKey.self) { role in
            inputsRole = role ?? .page
        }
        .scrollDismissesKeyboard(.interactively)
        .environment(headline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if showsReadout {
                ToolReadoutBar(figures: readout)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : LF.Motion.hover, value: showsReadout)
        .modifier(ToolKeyboardBar(focus: focus, order: order, summary: keypadSummary))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: webURL, subject: Text(tool.title), message: Text(tool.ask)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .environment(\.openURL, OpenURLAction { url in
            ToolLinks.open(url, model: model, tab: tab)
        })
        .learnHandoff(webURL, place: .route(.tool(tool.slug)))
    }
}

/// Which part of the screen a calculator's inputs have (`LearnLayout.Role`), handed up from
/// inside the scroll view so the page knows whether the readout has its own pane. Views that
/// don't say (nil) never overwrite the one that does.
private struct ToolInputsRoleKey: PreferenceKey {
    static let defaultValue: LearnLayout.Role? = nil

    static func reduce(value: inout LearnLayout.Role?, nextValue: () -> LearnLayout.Role?) {
        value = value ?? nextValue()
    }
}

// MARK: - Links into the app

/// Where a link on a tool page goes: another screen in the app when the site has one, the
/// browser otherwise.
enum ToolLinks {
    /// A site path (`/tools/frc-current-budget`, `/blog/x`, `/guides/a/b/c`) as a route.
    @MainActor
    static func route(forPath path: String, catalog: CatalogStore) -> AppRoute? {
        let parts = path.split(separator: "/").map(String.init)
        switch parts.first?.lowercased() {
        case "tools": return parts.count >= 2 ? .tool(parts[1]) : .tools
        case "resources": return .resources
        case "blog": return parts.count >= 2 ? .article(parts[1]) : nil
        default: return catalog.route(forPath: path)
        }
    }

    /// The handler behind every link on a tool page.
    @MainActor
    static func open(_ url: URL, model: AppModel, tab: AppTab?) -> OpenURLAction.Result {
        if url.scheme?.lowercased() == AppRoute.scheme {
            guard let route = AppRoute(deepLink: url) else { return .discarded }
            model.push(route, in: tab)
            return .handled
        }
        let host = url.host()?.lowercased()
        let isSite = host == nil || host == "learnfrc.com" || host == "www.learnfrc.com"
        if isSite {
            let path = url.path(percentEncoded: false)
            if path.split(separator: "/").map(String.init) == ["guides"] {
                model.activeNavigation.show(.learn)
                return .handled
            }
            if let route = route(forPath: path, catalog: model.catalog) {
                model.push(route, in: tab)
                return .handled
            }
            let web = host == nil ? AppConfig.webBase.appending(path: path) : url
            return .systemAction(web, prefersInApp: true)
        }
        let isWeb = ["http", "https"].contains(url.scheme?.lowercased() ?? "")
        return isWeb ? .systemAction(url, prefersInApp: true) : .systemAction(url)
    }
}

// MARK: - The foot of the sheet

/// The site's `ToolCTA`: the account pitch on one side and the "keep reading" links on the
/// other, under one ink rule. Signed-in readers already have the account, so they only get
/// the way back to the guides.
struct ToolFooter: View {
    let tool: ToolInfo
    let layout: LearnLayout

    @Environment(CatalogStore.self) private var catalog
    @Environment(AccountStore.self) private var account
    @Environment(AppModel.self) private var model
    @Environment(\.lessonAccountRequest) private var accountRequest
    @Environment(\.navigationTab) private var tab
    @Environment(\.openURL) private var openURL

    /// Read from the catalogue on the device, so it never advertises a size that moved on.
    private var catalogue: String {
        let lessons = catalog.allLessons.count
        let departments = catalog.departments.count
        guard lessons > 0, departments > 0 else { return "Every lesson in the binder" }
        return "\(JS.locale(Double(lessons), 0)) lessons across all \(departments) departments"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            Group {
                if layout.isRegular {
                    HStack(alignment: .top, spacing: 40) {
                        pitch.frame(maxWidth: .infinity, alignment: .leading)
                        related.frame(maxWidth: 360, alignment: .leading)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 34) {
                        pitch
                        related
                    }
                }
            }
            .padding(.top, 30)
        }
    }

    private var pitch: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("free / no account needed to use")
            LearnWholeWords(text: "Every tool here is free, and so is the rest of the binder.") { string in
                Text(string)
                    .lfTitle(.h2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 520, alignment: .leading)
            .padding(.top, 12)
            LearnSub("\(catalogue), plus every calculator on this site. An account is only for saving your work and tracking what you have finished.")
                .padding(.top, 12)
            let buttons = Group {
                if !account.isSignedIn {
                    Button("Create a free account") {
                        if let accountRequest {
                            accountRequest(.signUp)
                        } else {
                            openURL(AppConfig.webBase.appending(path: "signup"))
                        }
                    }
                    .buttonStyle(.ink)
                }
                Button("Browse the guides") {
                    model.activeNavigation.show(.learn)
                }
                .buttonStyle(.inkGhost)
            }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { buttons }
                VStack(alignment: .leading, spacing: 12) { buttons }
            }
            .padding(.top, 22)
        }
    }

    private var related: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("keep reading", color: LF.Palette.ink)
                .padding(.bottom, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { InkRule() }
            ForEach(tool.related, id: \.path) { link in
                Button {
                    _ = ToolLinks.open(AppConfig.webBase.appending(path: String(link.path.dropFirst())), model: model, tab: tab)
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(link.label)
                            .font(LF.Fonts.body(16, weight: .medium))
                            .foregroundStyle(LF.Palette.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 8)
                        Image(systemName: "arrow.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(LF.Palette.blue)
                            .accessibilityHidden(true)
                    }
                    .padding(.vertical, 12)
                    .overlay(alignment: .bottom) { DashedRule() }
                }
                .buttonStyle(.inkRow)
            }
        }
    }
}
