import Accessibility
import SwiftUI

// Small pieces the account screens share: the page frame, headings, form fields
// with the site's label / control / hint stack, the checkbox and the switch.
// Internal to the feature; anything generally useful is a candidate for Design/.

// MARK: - Links

/// Pages on learnfrc.com the account screens point to. They open in the browser.
enum AccountLinks {
    static let site = AppConfig.webBase
    static let privacy = AppConfig.webBase.appending(path: "privacy")
    static let terms = AppConfig.webBase.appending(path: "terms")

    static func publicProfile(_ username: String) -> URL {
        AppConfig.webBase.appending(path: "u/\(username)")
    }
}

// MARK: - Page

/// The scrolling sheet every account screen sits on: paper with the grid, a centred
/// column no wider than `maxWidth`, the site's gutter for the window width, and the
/// keyboard dismissed by dragging. The content gets a width to choose between one column
/// and two: the column's, or half of it at the accessibility sizes, where text is two to
/// three times its usual size and a side column (a 432pt sheet, a 240pt margin note)
/// holds a word or two a line. So every two-column page stacks there. Use it only for
/// that choice, never to size anything.
///
/// When `resetKey` changes (sign in, sign out) the page goes back to the top, so the new
/// state never opens at the old one's scroll position. Anything inside can bring a view
/// into sight with `AccountScroller.reveal(_:)` (read it with
/// `@Environment(AccountScroller.self) private var scroller: AccountScroller?`).
///
/// A page with no text field passes `avoidsKeyboard: false`, so a keyboard inset can never
/// reach it (on iPad one once outlived the sign-in sheet and left a blank band at the bottom).
struct AccountPage<Content: View>: View {
    var maxWidth: CGFloat
    var resetKey: AnyHashable?
    var avoidsKeyboard: Bool
    /// Which screen this is, so its scroll position comes back when the Mac builds the tab
    /// again (`remembersScroll`). Nil keeps nothing (the sign-in sheet, the username step).
    var place: ScreenPlace?
    @ViewBuilder var content: (CGFloat) -> Content

    @State private var width: CGFloat = 390
    @State private var scroller = AccountScroller()
    @Environment(\.dynamicTypeSize) private var typeSize

    init(maxWidth: CGFloat = 760, resetKey: AnyHashable? = nil, avoidsKeyboard: Bool = true, place: ScreenPlace? = nil, @ViewBuilder content: @escaping (CGFloat) -> Content) {
        self.maxWidth = maxWidth
        self.resetKey = resetKey
        self.avoidsKeyboard = avoidsKeyboard
        self.place = place
        self.content = content
    }

    private var gutter: CGFloat { LF.Metrics.gutter(for: width) }
    private var columnWidth: CGFloat { max(0, min(maxWidth, width - gutter * 2)) }
    /// What the content chooses its columns by (see above).
    private var layoutWidth: CGFloat { typeSize.isAccessibilitySize ? columnWidth / 2 : columnWidth }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    Color.clear
                        .frame(height: 0)
                        .id(AccountScroller.top)
                    content(layoutWidth)
                        // minWidth 0: the column takes the width it's given, so a child that
                        // can't shrink spills past the right edge instead of pushing the
                        // whole column (and its left gutter) off the page.
                        .frame(minWidth: 0, maxWidth: maxWidth, alignment: .leading)
                        .padding(.horizontal, gutter)
                        .padding(.top, 18)
                        .padding(.bottom, 56)
                        .frame(maxWidth: .infinity)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .remembersScroll(place)
            .onChange(of: resetKey) { _, _ in
                proxy.scrollTo(AccountScroller.top, anchor: .top)
            }
            .onChange(of: scroller.request) { _, request in
                guard let request else { return }
                Task {
                    if request.delay > .zero { try? await Task.sleep(for: request.delay) }
                    // A newer request (another field, another save) wins.
                    guard scroller.request == request else { return }
                    LF.Motion.perform(LF.Motion.settle) {
                        proxy.scrollTo(request.id, anchor: request.anchor)
                    }
                }
            }
        }
        .environment(scroller)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .paperBackground()
        #if os(iOS)
        .ignoresSafeArea(avoidsKeyboard ? [] : .keyboard, edges: .bottom)
        #endif
        .closesShareSheetsOnNavigation()
    }
}

/// Scrolls an `AccountPage` to one of its views: a focused field once the keyboard is up,
/// or a save result that landed below the fold. Mark the target with `.id(_:)`.
@MainActor
@Observable
final class AccountScroller {
    struct Request: Equatable {
        let id: AnyHashable
        let anchor: UnitPoint?
        let delay: Duration
        let serial: Int
    }

    /// The top of the page.
    nonisolated static let top = "account-page-top"

    private(set) var request: Request?
    @ObservationIgnored private var serial = 0

    /// Brings the view with this id into sight. `anchor` nil scrolls only as far as needed.
    /// `afterKeyboard` waits for the keyboard to finish rising first.
    func reveal(_ id: some Hashable, anchor: UnitPoint? = nil, afterKeyboard: Bool = false) {
        serial += 1
        request = Request(id: AnyHashable(id), anchor: anchor, delay: afterKeyboard ? .milliseconds(350) : .zero, serial: serial)
    }
}

// MARK: - Headings

/// The marker, headline and lede at the top of a page (`nb-marker`, `h1`, `nb-lede`).
struct AccountHeader: View {
    let marker: String
    let title: Text
    var lede: String?

    init(marker: String, title: Text, lede: String? = nil) {
        self.marker = marker
        self.title = title
        self.lede = lede
    }

    init(marker: String, title: String, lede: String? = nil) {
        self.init(marker: marker, title: Text(title), lede: lede)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(marker)
            title
                .textRenderer(AccountMarkRenderer())
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            if let lede {
                Text(lede)
                    .lfProse(17.5, lineHeight: 1.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
            }
        }
        .frame(maxWidth: 620, alignment: .leading)
    }
}

/// A word highlighted with a ballpoint underline (`nb-mark`). Tag a run with
/// `.customAttribute(AccountMark())` inside a headline drawn by `AccountMarkRenderer`.
struct AccountMark: TextAttribute {}

/// Draws the text as usual, with a blue pen stroke under any run tagged `AccountMark`,
/// running through the descenders the way the site's `nb-mark` does.
nonisolated struct AccountMarkRenderer: TextRenderer {
    func draw(layout: Text.Layout, in ctx: inout GraphicsContext) {
        for line in layout {
            for run in line where run[AccountMark.self] != nil {
                let bounds = run.typographicBounds
                let em = bounds.ascent + bounds.descent
                let thickness = max(2, em * 0.09)
                let rect = CGRect(
                    x: bounds.rect.minX,
                    y: bounds.rect.maxY - thickness - em * 0.02,
                    width: bounds.rect.width,
                    height: thickness
                )
                ctx.fill(Path(rect), with: .color(LF.Palette.blue))
            }
            ctx.draw(line)
        }
    }
}

/// A headline with one word marked: `accountMarked("Put your name on the ", "roster", ".")`.
func accountMarked(_ before: String, _ marked: String, _ after: String = "") -> Text {
    Text("\(before)\(Text(marked).customAttribute(AccountMark()))\(after)")
}

/// A section heading ruled off from what's above (`border-t-2 border-ink` + `h2`), with
/// an optional slug on the right that wraps under it when there isn't room.
struct AccountSectionHeading: View {
    let title: String
    var slug: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 16) {
                    heading
                    Spacer(minLength: 0)
                    if let slug { SlugText(slug) }
                }
                VStack(alignment: .leading, spacing: 6) {
                    heading
                    if let slug { SlugText(slug) }
                }
            }
            .padding(.top, 20)
        }
    }

    private var heading: some View {
        Text(title)
            .font(LF.Fonts.display(26, relativeTo: .title2))
            .tracking(26 * -0.025)
            .foregroundStyle(LF.Palette.ink)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A card heading (`h3` inside an `nb-box`).
struct AccountCardTitle: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(LF.Fonts.display(21, relativeTo: .title3))
            .tracking(21 * -0.02)
            .foregroundStyle(LF.Palette.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Graphite running text inside a card (`nb-sub`).
struct AccountSubText: View {
    let text: Text
    init(_ text: String) { self.text = Text(text) }
    init(_ text: Text) { self.text = text }

    var body: some View {
        text
            .font(LF.Fonts.body(15.5, relativeTo: .subheadline))
            .lineHeight(.multiple(factor: 1.45))
            .foregroundStyle(LF.Palette.graphite)
            .tint(LF.Palette.blue)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The slug line at the top of a sheet, with the dashed rule under it (`nb-slug pb-3 border-b border-dashed`).
struct AccountSheetSlug: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            SlugText(text)
                .fixedSize(horizontal: false, vertical: true)
            DashedRule()
        }
    }
}

/// A slug and one plain sentence in the site's note box (`nb-note`): a status, not an error.
struct AccountNote: View {
    let slug: String
    let text: Text

    init(_ slug: String, _ text: String) {
        self.slug = slug
        self.text = Text(text)
    }

    init(_ slug: String, text: Text) {
        self.slug = slug
        self.text = text
    }

    var body: some View {
        NoteCallout {
            // Wraps rather than truncating in a narrow column at the largest sizes.
            SlugText(slug)
                .fixedSize(horizontal: false, vertical: true)
            text
                .font(LF.Fonts.body(15.5, relativeTo: .subheadline))
                .lineHeight(.multiple(factor: 1.4))
                .foregroundStyle(LF.Palette.ink)
                .tint(LF.Palette.blue)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Fields

/// What a field holds, which sets its keyboard, AutoFill and capitalisation.
enum AccountFieldKind: Hashable {
    case text
    /// A person's own name (private).
    case name
    /// An email that is also the sign-in identifier (AutoFill saves it with the password).
    case email
    /// "Email or username" on the sign-in sheet.
    case identifier
    /// The public handle (`nickname`, so AutoFill doesn't drop the login email in here).
    case username
    case teamNumber
    case url
    case password(new: Bool)
    /// Typed confirmations like DELETE.
    case confirmation

    var isPassword: Bool {
        if case .password = self { return true }
        return false
    }
}

#if os(iOS)
private typealias AccountContentType = UITextContentType
#else
private typealias AccountContentType = NSTextContentType
#endif

private struct AccountFieldTraits: ViewModifier {
    let kind: AccountFieldKind

    private var contentType: AccountContentType? {
        switch kind {
        case .name: .name
        case .email, .identifier: .username
        case .username: .nickname
        case .url: .URL
        case .password(let new): new ? .newPassword : .password
        case .text, .teamNumber, .confirmation: nil
        }
    }

    func body(content: Content) -> some View {
        content
            .textContentType(contentType)
            .autocorrectionDisabled(kind != .text)
            #if os(iOS)
            .keyboardType(keyboard)
            .textInputAutocapitalization(capitalization)
            #endif
    }

    #if os(iOS)
    private var keyboard: UIKeyboardType {
        switch kind {
        case .email: .emailAddress
        case .identifier, .username: .asciiCapable
        case .teamNumber: .numberPad
        case .url: .URL
        default: .default
        }
    }

    private var capitalization: TextInputAutocapitalization {
        switch kind {
        case .name: .words
        case .text: .sentences
        case .confirmation: .characters
        default: .never
        }
    }
    #endif
}

/// One `nb-field`: a mono label above the control, then the hint or the error under it.
/// Passwords get the site's "show it / hide it" toggle in the label row, a real button
/// with its own focus stop rather than an eye parked inside the field.
struct AccountField<Focus: Hashable>: View {
    let label: String
    @Binding var text: String
    let kind: AccountFieldKind
    let focus: FocusState<Focus?>.Binding
    let field: Focus
    var prompt: String?
    var hint: String?
    var error: String?
    var submitLabel: SubmitLabel
    /// A multi-line field that grows between these line counts (the bio).
    var lines: ClosedRange<Int>?
    /// Characters allowed; also prints "n / max" in the label row.
    var maxLength: Int?
    var onSubmit: () -> Void

    @State private var revealed = false
    @Environment(AccountScroller.self) private var scroller: AccountScroller?
    /// `inkField`'s padding above and below the text (the same scaled 10pt).
    @ScaledMetric(relativeTo: .body) private var boxPadding: CGFloat = 10

    init(
        _ label: String, text: Binding<String>, kind: AccountFieldKind = .text,
        focus: FocusState<Focus?>.Binding, field: Focus,
        prompt: String? = nil, hint: String? = nil, error: String? = nil,
        submitLabel: SubmitLabel = .next, lines: ClosedRange<Int>? = nil, maxLength: Int? = nil,
        onSubmit: @escaping () -> Void = {}
    ) {
        self.label = label
        self._text = text
        self.kind = kind
        self.focus = focus
        self.field = field
        self.prompt = prompt
        self.hint = hint
        self.error = error
        self.submitLabel = submitLabel
        self.lines = lines
        self.maxLength = maxLength
        self.onSubmit = onSubmit
    }

    private var isFocused: Bool { focus.wrappedValue == field }

    var body: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            // The label and its extras on one line while they fit whole; the extras under
            // the label at the largest sizes, so "Password" never breaks mid-word.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    FieldLabel(label)
                        .fixedSize()
                        .accessibilityHidden(true)
                    Spacer(minLength: 0)
                    labelExtras
                }
                VStack(alignment: .leading, spacing: 2) {
                    FieldLabel(label)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityHidden(true)
                    if maxLength != nil || kind.isPassword {
                        HStack(alignment: .firstTextBaseline, spacing: 12) { labelExtras }
                    }
                }
            }
            input
                .modifier(AccountFieldTraits(kind: kind))
                .focused(focus, equals: field)
                .inkField(focused: isFocused, invalid: error != nil)
                .submitLabel(submitLabel)
                .onSubmit(onSubmit)
                .accessibilityLabel(label)
                .accessibilityHint(error == nil ? (hint ?? "") : "")
                .overlay { paddingTargets }
            if let error {
                FieldError(error)
            } else if let hint {
                FieldHint(hint)
                    .accessibilityHidden(true)
            }
        }
        .id(AnyHashable(field))
        #if os(iOS)
        .onChange(of: isFocused) { _, focused in
            // Label, field and hint in sight above the keyboard (the number pad included).
            // Centred, so the keyboard bar floating over the content never sits on the hint.
            if focused { scroller?.reveal(AnyHashable(field), anchor: .center, afterKeyboard: true) }
        }
        .onChange(of: error) { _, new in
            // An error on the field already being typed in (Save from the keyboard bar).
            if new != nil, isFocused { scroller?.reveal(AnyHashable(field), anchor: .center) }
        }
        #endif
        .onChange(of: text) { _, new in
            if let maxLength, new.count > maxLength {
                text = String(new.prefix(maxLength))
            } else if kind == .teamNumber {
                let digits = String(new.filter(\.isASCII).filter(\.isNumber).prefix(5))
                if digits != new { text = digits }
            } else if kind == .username {
                let cleaned = AccountStore.normalizeUsername(new)
                if cleaned != new { text = cleaned }
            }
        }
    }

    @ViewBuilder
    private var labelExtras: some View {
        if let maxLength {
            SlugText("\(text.count) / \(maxLength)")
                .fixedSize()
                .accessibilityLabel("\(text.count) of \(maxLength) characters")
        }
        if kind.isPassword {
            Button(revealed ? "hide it" : "show it") {
                revealed.toggle()
                // The secure and plain fields are different views; keep the caret.
                if isFocused {
                    Task { @MainActor in focus.wrappedValue = field }
                }
            }
            // The field sits 6.4pt under this row, so the target grows up, into the gap
            // and the hint above, never over the field's top edge.
            .buttonStyle(AccountTextButtonStyle(reach: .up))
            .fixedSize()
            .accessibilityLabel(revealed ? "Hide password" : "Show password")
        }
    }

    /// The box's padding is drawn around the text view, not part of it, so a tap there had
    /// no direct target and iOS gave it to the nearest button ("show it" above the password
    /// box, "Get a reset link" under it). These bands make the padding focus the field. The
    /// text view in the middle keeps its own touches (caret, selection).
    private var paddingTargets: some View {
        VStack(spacing: 0) {
            band
            Spacer(minLength: 0)
            band
        }
    }

    private var band: some View {
        Color.clear
            .frame(height: boxPadding)
            .contentShape(Rectangle())
            .onTapGesture { focus.wrappedValue = field }
            // VoiceOver already has the field itself.
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var input: some View {
        // The label sits above the field, so with no prompt the field stays empty rather
        // than repeating its own label as a placeholder.
        let promptText = Text(prompt ?? "").foregroundStyle(LF.Palette.graphite)
        if kind.isPassword && !revealed {
            SecureField(label, text: $text, prompt: promptText)
        } else if let lines {
            TextField(label, text: $text, prompt: promptText, axis: .vertical)
                .lineLimit(lines)
        } else {
            TextField(label, text: $text, prompt: promptText)
        }
    }
}

/// A read-only value drawn as a disabled field (the sign-in email in Settings). One line,
/// cut in the middle, at the standard sizes; at the accessibility sizes it wraps, so the
/// whole address can still be read.
struct AccountReadOnlyField: View {
    let label: String
    let value: String
    var hint: String?

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            FieldLabel(label)
            Text(value)
                .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                .truncationMode(.middle)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .inkField()
                .disabled(true)
            if let hint { FieldHint(hint) }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Buttons

/// A link-weight text button (`nb-navlink` / `nb-link`): blue, underlined, sized for a
/// finger without changing the line it sits on.
///
/// The extra height of the 44pt target goes both ways by default. Beside a text field it
/// grows away from it instead, so a tap on the field's edge always lands in the field:
/// `.up` for a button in a field's label row ("show it"), `.down` for one under a field
/// ("Get a reset link"). The layout around a `.down` button leaves the room under it.
struct AccountTextButtonStyle: ButtonStyle {
    enum Reach: Sendable {
        /// 12pt above and below the label.
        case both
        /// The target ends at the label's bottom edge and grows up to 44pt.
        case up
        /// The target starts at the label's top edge and grows down to 44pt.
        case down
    }

    var size: CGFloat = 13
    var mono: Bool = true
    var reach: Reach = .both

    func makeBody(configuration: Configuration) -> some View {
        AccountTextButton(configuration: configuration, size: size, mono: mono, reach: reach)
    }
}

private struct AccountTextButton: View {
    let configuration: ButtonStyleConfiguration
    let size: CGFloat
    let mono: Bool
    let reach: AccountTextButtonStyle.Reach
    @Environment(\.isEnabled) private var isEnabled
    /// The label's own height, so a one-way target is 44pt at every text size. The padding
    /// below takes back exactly what it adds, so this never changes the label's layout.
    @State private var labelHeight: CGFloat = 0

    private var grow: (top: CGFloat, bottom: CGFloat) {
        let rest = max(0, LF.Metrics.tap - labelHeight)
        return switch reach {
        case .both: (12, 12)
        case .up: (rest, 0)
        case .down: (0, rest)
        }
    }

    var body: some View {
        let grow = grow
        configuration.label
            .font(mono ? LF.Fonts.mono(size, weight: .bold, relativeTo: .footnote) : LF.Fonts.body(size, weight: .semibold, relativeTo: .body))
            .foregroundStyle(isEnabled ? LF.Palette.blue : LF.Palette.graphite)
            .underline(true, color: LF.Palette.blue.opacity(configuration.isPressed ? 1 : 0.45))
            .opacity(configuration.isPressed ? 0.7 : 1)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { labelHeight = $0 }
            // A 44pt target that doesn't push the label row apart.
            .padding(.top, grow.top)
            .padding(.bottom, grow.bottom)
            .padding(.horizontal, 6)
            .contentShape(Rectangle())
            .padding(.top, -grow.top)
            .padding(.bottom, -grow.bottom)
            .padding(.horizontal, -6)
            #if os(macOS)
            .pointerStyle(.link)
            #endif
    }
}

// MARK: - Keyboard bar

extension View {
    /// The bar above the iPhone and iPad keyboard for a form: previous and next field, an
    /// optional action (Save) so it stays reachable while the keyboard covers the form's own
    /// button, and Done. The number pad has no return key, so without this it traps focus.
    /// Only shows while one of `order` is focused. Nothing on the Mac.
    func accountKeyboardBar<Focus: Hashable>(
        _ focus: FocusState<Focus?>.Binding,
        order: [Focus],
        action: String? = nil,
        actionEnabled: Bool = true,
        perform: @escaping () -> Void = {}
    ) -> some View {
        modifier(AccountKeyboardBar(focus: focus, order: order, action: action, actionEnabled: actionEnabled, perform: perform))
    }
}

private struct AccountKeyboardBar<Focus: Hashable>: ViewModifier {
    let focus: FocusState<Focus?>.Binding
    let order: [Focus]
    let action: String?
    let actionEnabled: Bool
    let perform: () -> Void

    func body(content: Content) -> some View {
        #if os(iOS)
        content.toolbar {
            if let current = focus.wrappedValue, let index = order.firstIndex(of: current) {
                ToolbarItemGroup(placement: .keyboard) {
                    Button {
                        focus.wrappedValue = order[index - 1]
                    } label: {
                        Label("Previous field", systemImage: "chevron.up")
                    }
                    .disabled(index == 0)
                    Button {
                        focus.wrappedValue = order[index + 1]
                    } label: {
                        Label("Next field", systemImage: "chevron.down")
                    }
                    .disabled(index >= order.count - 1)
                    Spacer()
                    if let action {
                        Button(action, action: perform)
                            .disabled(!actionEnabled)
                    }
                    Button("Done") { focus.wrappedValue = nil }
                        .fontWeight(.semibold)
                }
            }
        }
        #else
        content
        #endif
    }
}

// MARK: - Settings link

/// A link to Settings. On iPhone and iPad it pushes the Settings screen onto the current
/// stack; on the Mac it opens the Settings window (⌘,), so there's only ever one Settings.
struct AccountSettingsLink<Label: View>: View {
    @ViewBuilder var label: Label

    init(@ViewBuilder label: () -> Label) {
        self.label = label()
    }

    var body: some View {
        #if os(macOS)
        SettingsLink { label }
        #else
        NavigationLink(value: AppRoute.settings) { label }
        #endif
    }
}

extension AccountSettingsLink where Label == Text {
    init(_ title: String) {
        self.init { Text(title) }
    }
}

// MARK: - Checkbox

/// A drawn checkbox with the whole sentence as its label (`<label>` around the box and
/// text on the site, so the target is the sentence, not the 16pt box). The tick is the
/// blue pen check. Reads to VoiceOver as a toggle.
struct AccountCheckboxStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                AccountCheckBox(isOn: configuration.isOn)
                    .padding(.top, 1)
                configuration.label
                    .font(LF.Fonts.body(15.5, relativeTo: .subheadline))
                    .lineHeight(.multiple(factor: 1.4))
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minHeight: LF.Metrics.tap, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityRepresentation {
            Toggle(isOn: configuration.$isOn) { configuration.label }
        }
        .sensoryFeedback(.selection, trigger: configuration.isOn)
    }
}

/// The box itself: card stock, 2pt ink, the pen check when ticked.
struct AccountCheckBox: View {
    var isOn: Bool
    @ScaledMetric(relativeTo: .body) private var side: CGFloat = 22
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        ZStack {
            HandShape(.s).fill(LF.Palette.card)
            HandShape(.s).strokeBorder(isEnabled ? LF.Palette.ink : LF.Palette.rule, lineWidth: LF.Metrics.stroke)
            if isOn {
                PenCheckMark(size: side * 0.52)
            }
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}

// MARK: - Switch

/// The site's switch (`EmailPrefsCard`): a hand-drawn track that fills blue with a card
/// knob that slides, plus a mono `on` / `off`, so the state survives greyscale and never
/// depends on the blue alone.
struct AccountSwitchStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        AccountSwitch(configuration: configuration)
    }
}

private struct AccountSwitch: View {
    let configuration: ToggleStyleConfiguration
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
            : AnyLayout(HStackLayout(alignment: .center, spacing: 16))
        layout {
            configuration.label
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                configuration.isOn.toggle()
            } label: {
                HStack(spacing: 10) {
                    track
                    Text(configuration.isOn ? "on" : "off")
                        .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
                        .foregroundStyle(LF.Palette.ink)
                        .frame(minWidth: 26, alignment: .leading)
                }
                .frame(minHeight: LF.Metrics.tap)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .fixedSize()
        }
        .accessibilityRepresentation {
            Toggle(isOn: configuration.$isOn) { configuration.label }
        }
        .sensoryFeedback(.selection, trigger: configuration.isOn)
    }

    private var track: some View {
        ZStack(alignment: .leading) {
            HandShape(.s).fill(configuration.isOn ? LF.Palette.blueButton : LF.Palette.paper)
            HandShape(.s).strokeBorder(isEnabled ? LF.Palette.ink : LF.Palette.rule, lineWidth: LF.Metrics.stroke)
            ZStack {
                HandShape(.s).fill(LF.Palette.card)
                HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
            }
            .frame(width: 20, height: 20)
            .offset(x: configuration.isOn ? 34 : 6)
        }
        .frame(width: 60, height: 32)
        .opacity(isEnabled ? 1 : 0.6)
        .animation(reduceMotion ? nil : LF.Motion.hover, value: configuration.isOn)
    }
}

// MARK: - Definition lists

/// A ruled two-column list (`nb-list` of `dt` / `dd`): slug on the left, sentence on the
/// right, stacked on narrow widths.
struct AccountDefinitionList: View {
    let items: [(slug: String, text: String)]

    @Environment(\.dynamicTypeSize) private var typeSize
    /// The term column, scaled with the slug's own text style so the longest term
    /// ("certificates") stays on one line at every standard size instead of breaking mid-word.
    @ScaledMetric(relativeTo: .caption) private var termWidth: CGFloat = 112

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(items.indices, id: \.self) { index in
                let item = items[index]
                Group {
                    if typeSize.isAccessibilitySize {
                        // A term column would hold a few letters a line: the term goes above.
                        stacked(item)
                    } else {
                        ViewThatFits(in: .horizontal) {
                            HStack(alignment: .firstTextBaseline, spacing: 22) {
                                SlugText(item.slug)
                                    .frame(width: termWidth, alignment: .leading)
                                definition(item.text)
                            }
                            .frame(minWidth: 460)
                            stacked(item)
                        }
                    }
                }
                .padding(.vertical, 14)
                .accessibilityElement(children: .combine)
                DashedRule()
            }
        }
    }

    private func stacked(_ item: (slug: String, text: String)) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            SlugText(item.slug)
                .fixedSize(horizontal: false, vertical: true)
            definition(item.text)
        }
    }

    private func definition(_ text: String) -> some View {
        Text(text)
            .font(LF.Fonts.body(15, relativeTo: .subheadline))
            .lineHeight(.multiple(factor: 1.4))
            .foregroundStyle(LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
            // A comfortable measure at the usual sizes; the whole width at the largest,
            // where 440pt holds three or four words a line.
            .frame(maxWidth: typeSize.isAccessibilitySize ? .infinity : 440, alignment: .leading)
    }
}

/// What an account keeps, in the site's words (`SignInAside`).
enum AccountPitch {
    static let keeps: [(slug: String, text: String)] = [
        ("progress", "Every lesson you have passed, counted per department, so you always know which one you are mid-way through."),
        ("certificates", "Clear a department's quizzes and it prints you a certificate with your name on it."),
        ("team", "Your team page fills in as your teammates sign up, and the leaderboard starts counting."),
    ]
}

// MARK: - Grids

/// `count` equal flexible columns, top-aligned.
func accountColumns(_ count: Int, spacing: CGFloat) -> [GridItem] {
    Array(repeating: GridItem(.flexible(), spacing: spacing, alignment: .top), count: max(1, count))
}

// MARK: - Errors

extension Error {
    /// The data layer's own sentence for this failure.
    var accountMessage: String { APIError.from(self).message }
}

extension String {
    var accountTrimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

/// Posts a VoiceOver announcement (saved, switched on, sent).
@MainActor
func accountAnnounce(_ message: String) {
    AccessibilityNotification.Announcement(message).post()
}
