import SwiftUI

/// Every piece of the notebook system on one page, in Paper (light) and Night (dark) side by
/// side when there's room, stacked when there isn't. A reference for feature work and a quick
/// check that the app still matches learnfrc.com after `gen-tokens.py` runs.
struct DesignGalleryView: View {
    enum Appearance: String, CaseIterable, Identifiable {
        case both = "Both", paper = "Paper", night = "Night"
        var id: Self { self }
    }

    @State private var appearance: Appearance
    @Environment(\.colorScheme) private var systemScheme
    @State private var width: CGFloat = 0

    init(appearance: Appearance = .both) {
        _appearance = State(initialValue: appearance)
    }

    var body: some View {
        ScrollView {
            switch appearance {
            case .both:
                if width >= 760 {
                    HStack(alignment: .top, spacing: 0) {
                        DesignGalleryColumn(scheme: .light)
                        DesignGalleryColumn(scheme: .dark)
                    }
                } else {
                    VStack(spacing: 0) {
                        DesignGalleryColumn(scheme: .light)
                        DesignGalleryColumn(scheme: .dark)
                    }
                }
            case .paper:
                DesignGalleryColumn(scheme: .light)
            case .night:
                DesignGalleryColumn(scheme: .dark)
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .background {
            // Overscroll shows the paper of the column being looked at.
            LF.Palette.paper
                .ignoresSafeArea()
                .environment(\.colorScheme, appearance == .paper ? .light : (appearance == .night ? .dark : systemScheme))
        }
        .navigationTitle("Design")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .principal) {
                Picker("Appearance", selection: $appearance) {
                    ForEach(Appearance.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .fixedSize()
            }
        }
    }
}

// MARK: - Column

struct DesignGalleryColumn: View {
    let scheme: ColorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 34) {
            header
            GallerySection("palette / six values and nothing else") { PaletteGrid() }
            GallerySection("type / three faces with fixed jobs") { TypeSamples() }
            GallerySection("cards / hand-ruled, taped, tilted") { CardSamples() }
            GallerySection("buttons / one filled per view") { ButtonSamples() }
            GallerySection("tags, tabs, meters") { DataSamples() }
            GallerySection("forms") { FieldSamples() }
            GallerySection("notes, rules, slab") { NoteSamples() }
            GallerySection("marks / stamp, check, people") { MarkSamples() }
            GallerySection("motion / blunt, no springs") { MotionSamples() }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 28)
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
        .background { PaperBackground() }
        .environment(\.colorScheme, scheme)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                LearnFRCWordmark(size: 26)
                Spacer()
                TagView(scheme == .light ? "paper" : "night", on: true)
            }
            Text("The notebook system").lfTitle(.h1)
            Text("A student's FRC build binder, photocopied and taped to a wall. Native chrome around it, this inside it.")
                .lfProse(17, lineHeight: 1.5, color: LF.Palette.graphite)
            MarkerText("every piece, both lights")
                .padding(.top, 2)
        }
    }
}

private struct GallerySection<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            InkRule()
            SectionLabel(title)
            content
        }
    }
}

// MARK: - Sections

private struct PaletteGrid: View {
    private let swatches: [(String, Color, String)] = [
        ("paper", LF.Palette.paper, "the ground"),
        ("card", LF.Palette.card, "raised surfaces"),
        ("ink", LF.Palette.ink, "type and borders"),
        ("graphite", LF.Palette.graphite, "secondary type"),
        ("blue", LF.Palette.blue, "the one accent"),
        ("blueButton", LF.Palette.blueButton, "fills with text"),
        ("onBlue", LF.Palette.onBlue, "text on blue"),
        ("sidebarTint", LF.Palette.sidebarTint, "sidebar selection"),
        ("kraft", LF.Palette.kraft, "tape only"),
        ("rule", LF.Palette.rule, "hairlines"),
    ]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], alignment: .leading, spacing: 12) {
            ForEach(swatches, id: \.0) { name, color, job in
                HStack(spacing: 10) {
                    HandShape(.s)
                        .fill(color)
                        .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: 2) }
                        .frame(width: 40, height: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name).font(LF.Fonts.body(15, weight: .bold)).foregroundStyle(LF.Palette.ink)
                        SlugText(job, size: 11)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

private struct TypeSamples: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Every job on an FRC team").lfTitle(.h1)
            Text("Wiring the robot").lfTitle(.h2)
            Text("Crimping Anderson connectors").lfTitle(.h3)
            Text("Strip 3/8 inch of insulation, seat the wire fully in the contact, and crimp once. Tug it. If it moves, cut it off and do it again.")
                .lfProse(17)
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                SlugText("dept / electrical-wiring")
                CountText(14, unit: "lessons")
            }
            MarkerText("this one trips everyone up")
        }
    }
}

private struct CardSamples: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            Button {} label: {
                NotebookCard(tilt: .preset(0), tape: true, lift: true) {
                    HStack {
                        SlugText("dept / programming-software")
                        Spacer()
                        SlugText("6 modules")
                    }
                    Text("Programming").lfTitle(.h3).padding(.top, 8)
                    Text("Java, WPILib and command-based code that drives the robot.")
                        .font(LF.Fonts.body(15))
                        .foregroundStyle(LF.Palette.graphite)
                        .padding(.top, 4)
                    MeterView(value: 0.35, label: "progress", style: .slim).padding(.top, 14)
                }
            }
            .buttonStyle(.notebookCard)

            HStack(alignment: .top, spacing: 16) {
                NotebookCard(tilt: .preset(1), lift: true, padding: 14) {
                    CountText(42, unit: "lessons")
                    SlugText("finished").padding(.top, 4)
                }
                NotebookCard(tilt: .preset(2), padding: 14) {
                    CountText("3/5", unit: "this week")
                    SlugText("days with a lesson").padding(.top, 4)
                }
            }

            Text("A notebookBox at the small radius, as a floating surface")
                .font(LF.Fonts.body(15))
                .foregroundStyle(LF.Palette.ink)
                .padding(14)
                .notebookSurface()
        }
    }
}

private struct ButtonSamples: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 14) {
                Button("Start learning") {}.buttonStyle(.ink)
                Button("Browse") {}.buttonStyle(.inkGhost)
            }
            HStack(spacing: 14) {
                Button("Save") {}.buttonStyle(.inkSmall)
                Button("search") {}.buttonStyle(.inkGhostSmall)
                Button("Not yet") {}.buttonStyle(.inkSmall).disabled(true)
            }
            Button {} label: { Label("Mark complete", systemImage: "checkmark") }
                .buttonStyle(InkButtonStyle(.primary, size: .large, fullWidth: true))
            Button("Delete account") {}.buttonStyle(.inkDestructive)
            VStack(spacing: 0) {
                ForEach(["What a PDP does", "Breakers and fuses", "Reading a wiring diagram"], id: \.self) { title in
                    Button {} label: {
                        HStack {
                            Text(title).font(LF.Fonts.body(16, weight: .semibold))
                            Spacer()
                            SlugText("8 min")
                        }
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.inkRow)
                    DashedRule()
                }
            }
        }
    }
}

private struct DataSamples: View {
    @State private var board = "weekly"
    @State private var mech = true
    @State private var cad = false
    @State private var progress = 0.42

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 8) {
                TagView("you", on: true)
                TagView("Team 254")
                TagView("mentor", systemImage: "person")
            }
            HStack(spacing: 8) {
                Toggle(isOn: $mech) { Text("mechanical") }.toggleStyle(.tag)
                Toggle(isOn: $cad) { Text("cad") }.toggleStyle(.tag)
            }
            InkTabStrip(selection: $board, tabs: [("weekly", "weekly"), ("alltime", "all-time"), ("teams", "teams")])
            MeterView(value: progress, label: "dept / mechanical-build")
            MeterView(value: 3.0 / 5.0, label: "this week", valueText: "3/5")
            MeterView(value: 0.8, style: .slim)
            Button("Finish a lesson") { progress = progress >= 1 ? 0.1 : min(1, progress + 0.15) }
                .buttonStyle(.inkGhostSmall)
        }
    }
}

private struct FieldSamples: View {
    @State private var name = "jahaan"
    @State private var team = "25a4"
    @State private var email = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            InkField("username", text: $name, hint: "Letters, numbers and underscores. People see this.")
            InkField("team number", text: $team, error: "Team numbers are digits only, like 254.")
            InkField("email", text: $email, prompt: "you@example.com")
        }
    }
}

private struct NoteSamples: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            NoteCallout {
                SlugText("heads up")
                Text("Unplug the battery before you touch any wiring.")
                    .font(LF.Fonts.body(16))
                    .foregroundStyle(LF.Palette.ink)
            }
            DashedRule()
            SlabView {
                Text("LESSON COMPLETE")
                    .font(LF.Fonts.mono(13, weight: .bold))
                    .tracking(13 * 0.06)
                Text("+25 XP, 4 of 6 in this module")
                    .font(LF.Fonts.mono(12))
                    .opacity(0.85)
            }
        }
    }
}

private struct MarkSamples: View {
    @State private var stampKey = 0

    @ViewBuilder private var stamps: some View {
        StampView("Completed", caption: "lesson / pid-basics", footnote: "+25 XP").id(stampKey)
        PendingStampView(percent: 64)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .center, spacing: 28) { stamps }
                VStack(alignment: .leading, spacing: 28) { stamps }
            }
            .padding(.leading, 8)
            HStack(spacing: 14) {
                PenCheckMark()
                Text("Finished").font(LF.Fonts.body(16, weight: .semibold)).foregroundStyle(LF.Palette.ink)
                Spacer()
                Button("Stamp again") { stampKey += 1 }.buttonStyle(.inkGhostSmall)
            }
            HStack(spacing: 12) {
                InitialsAvatar(name: "Jahaan Pardhanani")
                InitialsAvatar(name: "frc254")
                InitialsAvatar(name: "Ada Lovelace")
                Spacer()
            }
            VStack(alignment: .leading, spacing: 8) {
                SkeletonBlock(height: 20, width: 200)
                SkeletonBlock()
            }
        }
    }
}

private struct MotionSamples: View {
    @State private var fired = 0

    private let rows: [(String, String)] = [
        ("press", "90ms ease-out"), ("hover", "140ms ease-out"), ("stamp / lift", "180ms ease-out"),
        ("arrive", "300ms ease-out"), ("settle", "300ms ease-move"), ("draw", "520ms ease-draw"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(spacing: 0) {
                ForEach(rows, id: \.0) { name, value in
                    HStack {
                        Text(name).font(LF.Fonts.mono(13, weight: .bold)).foregroundStyle(LF.Palette.ink)
                        Spacer()
                        SlugText(value)
                    }
                    .padding(.vertical, 9)
                    DashedRule()
                }
            }
            NotebookCard(tilt: .preset(3), lift: true) {
                Text("Completion mark").lfTitle(.h3)
                Text("One stroke, a few pen ticks, gone. Never under Reduce Motion.")
                    .font(LF.Fonts.body(15))
                    .foregroundStyle(LF.Palette.graphite)
                    .padding(.top, 4)
                Button("Complete") { fired += 1 }
                    .buttonStyle(.inkSmall)
                    .padding(.top, 12)
            }
            .overlay { CompletionBurst(trigger: fired) }
        }
    }
}

// MARK: - Previews

#Preview("Gallery, iPhone, Paper", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack { DesignGalleryView(appearance: .paper) }
}

#Preview("Gallery, iPhone, Night", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack { DesignGalleryView(appearance: .night) }
        .environment(\.colorScheme, .dark)
}

#Preview("Gallery, iPad, both", traits: .fixedLayout(width: 1024, height: 1366)) {
    NavigationStack { DesignGalleryView(appearance: .both) }
}

#Preview("Gallery, iPhone, large type", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack { DesignGalleryView(appearance: .paper) }
        .dynamicTypeSize(.accessibility2)
}
