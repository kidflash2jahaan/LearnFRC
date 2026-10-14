import SwiftUI

// MARK: - Avatar

/// A person (`nb-avatar`): the one perfect circle the system allows. Initials are hand-lettered
/// at an angle picked from the name, so a roster reads as names written by hand; a photo stays
/// upright. No colour from a hash: identity is the initials and their angle.
struct InitialsAvatar: View {
    let name: String
    var seed: String?
    var imageURL: URL?
    var size: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(name: String, seed: String? = nil, imageURL: URL? = nil, size: CGFloat = 40) {
        self.name = name
        self.seed = seed
        self.imageURL = imageURL
        self.size = size
    }

    /// The site's `avatar.tsx` tilt table and hash, so a person gets the same angle on both.
    private static let tilts: [Double] = [-3.1, 1.9, -1.3, 2.7, -2.4, 1.1]

    var initials: String {
        let letters = name.split(separator: " ").compactMap(\.first).prefix(2)
        let joined = String(letters).uppercased()
        return joined.isEmpty ? "?" : joined
    }

    var tilt: Double {
        let key = seed ?? (name.isEmpty ? "x" : name)
        var hash = 0
        for unit in key.utf16 { hash = (hash * 31 + Int(unit)) % 997 }
        return Self.tilts[hash % Self.tilts.count]
    }

    var body: some View {
        ZStack {
            Circle().fill(LF.Palette.card)
            Text(initials)
                .font(LF.Fonts.mono(size * 0.32, weight: .bold, relativeTo: .caption))
                .foregroundStyle(LF.Palette.ink)
                .rotationEffect(.degrees(reduceMotion ? 0 : tilt))
                .minimumScaleFactor(0.6)
                // The initials scale with the text size but the circle is `size`: past XXXL
                // they'd fill it to the edge ("QT" at AX5 in an 88pt circle). The avatar is a
                // picture of a name printed beside it, so they stop growing there.
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay { Circle().strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
        .accessibilityAddTraits(.isImage)
    }
}

// MARK: - Tab strip

/// A strip of tabs inside content (`nb-tab`), for choices like weekly / all-time / teams.
/// Dashed until selected, then a solid blue rule and bold ink, so the state survives
/// greyscale. In a toolbar, use the native segmented `Picker` instead.
struct InkTabStrip<Value: Hashable>: View {
    @Binding var selection: Value
    let tabs: [(value: Value, title: String)]

    init(selection: Binding<Value>, tabs: [(value: Value, title: String)]) {
        self._selection = selection
        self.tabs = tabs
    }

    var body: some View {
        // Fits on one line almost always; scrolls sideways (never wraps) when it doesn't.
        ViewThatFits(in: .horizontal) {
            strip
            ScrollView(.horizontal) { strip }
                .scrollIndicators(.hidden)
                .scrollClipDisabled()
        }
        .sensoryFeedback(.selection, trigger: selection)
    }

    private var strip: some View {
        HStack(spacing: 20) {
            ForEach(tabs.indices, id: \.self) { index in
                let tab = tabs[index]
                let isSelected = tab.value == selection
                Button {
                    selection = tab.value   // the rule switches on the same frame, like the site
                } label: {
                    Text(tab.title)
                        .font(LF.Fonts.mono(13, weight: isSelected ? .bold : .regular, relativeTo: .footnote))
                        .foregroundStyle(isSelected ? LF.Palette.ink : LF.Palette.graphite)
                        .fixedSize()
                        .padding(.horizontal, 2.4)
                        .frame(minHeight: LF.Metrics.tap)
                        .overlay(alignment: .bottom) {
                            ZStack {
                                DashedRule(color: LF.Palette.rule, thickness: 2)
                                if isSelected {
                                    Rectangle().fill(LF.Palette.blue).frame(height: 2)
                                }
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
            }
        }
    }
}

// MARK: - Skeleton

/// A loading placeholder (`nb-skeleton`): a dashed outline whose paper-to-card sheen sweeps
/// across, because a frozen grey block reads as broken. Still under Reduce Motion.
struct SkeletonBlock: View {
    var height: CGFloat = 16
    var width: CGFloat?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var sweep = false

    var body: some View {
        HandShape(.s)
            .fill(
                reduceMotion
                    ? AnyShapeStyle(LF.Palette.paper)
                    : AnyShapeStyle(LinearGradient(
                        colors: [LF.Palette.paper, LF.Palette.card, LF.Palette.paper],
                        startPoint: UnitPoint(x: sweep ? -1 : 1, y: 0.5),
                        endPoint: UnitPoint(x: sweep ? 0 : 2, y: 0.5)))
            )
            .overlay {
                HandShape(.s).strokeBorder(LF.Palette.rule, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
            }
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.6).repeatForever(autoreverses: false)) { sweep = true }
            }
            .accessibilityLabel("Loading")
    }
}

#Preview("Avatars, tabs, skeleton", traits: .fixedLayout(width: 393, height: 360)) {
    @Previewable @State var board = "weekly"
    VStack(alignment: .leading, spacing: 22) {
        HStack(spacing: 12) {
            InitialsAvatar(name: "Jahaan Pardhanani")
            InitialsAvatar(name: "frc254")
            InitialsAvatar(name: "Ada Lovelace", size: 56)
        }
        InkTabStrip(selection: $board, tabs: [("weekly", "weekly"), ("alltime", "all-time"), ("teams", "teams")])
        VStack(alignment: .leading, spacing: 10) {
            SkeletonBlock(height: 22, width: 220)
            SkeletonBlock()
            SkeletonBlock(width: 160)
        }
    }
    .padding(LF.Metrics.gutter)
    .frame(maxHeight: .infinity, alignment: .top)
    .paperBackground()
}
