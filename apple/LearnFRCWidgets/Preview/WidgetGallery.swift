import SwiftUI
import WidgetKit

// Every widget at its real sizes, side by side, in light and dark and in the tinted and
// Lock Screen rendering modes. WidgetKit's own `#Preview(as:)` blocks (in each widget's file)
// show one family at a time in the system frame; these mock frames show them all at once.
// Sizes: iPhone (393pt-wide screens), iPad Pro 13-inch, iPhone Lock Screen.

#if DEBUG

/// A widget-sized frame that stands in for the Home Screen: the right size and corner radius,
/// paper behind full-colour content, a glassy wash behind accented and vibrant content.
struct WidgetMockFrame<Content: View>: View {
    let size: CGSize
    var scheme: ColorScheme = .light
    var mode: WidgetRenderingMode = .fullColor
    var cornerRadius: CGFloat = 22
    @ViewBuilder var content: Content

    var body: some View {
        content
            .notebookStyled()
            .environment(\.widgetRenderingMode, mode)
            .environment(\.colorScheme, scheme)
            .environment(\.widgetUsesLinks, false)
            .frame(width: size.width, height: size.height)
            .background {
                if mode == .fullColor {
                    PaperGround().environment(\.colorScheme, scheme)
                } else {
                    // The system draws the real material; this only stands in for it.
                    Color.white.opacity(0.12)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}

/// Lock Screen accessories: no background of their own, vibrant, over a dark wallpaper.
struct AccessoryMockFrame<Content: View>: View {
    let size: CGSize
    @ViewBuilder var content: Content

    var body: some View {
        content
            .notebookStyled()
            .environment(\.widgetRenderingMode, .vibrant)
            .environment(\.colorScheme, .dark)
            .foregroundStyle(.white)
            .frame(width: size.width, height: size.height)
    }
}

enum WidgetSizes {
    static let phoneSmall = CGSize(width: 158, height: 158)
    static let phoneMedium = CGSize(width: 338, height: 158)
    static let phoneLarge = CGSize(width: 338, height: 354)
    static let padSmall = CGSize(width: 170, height: 170)
    static let padMedium = CGSize(width: 378.5, height: 170)
    static let padLarge = CGSize(width: 378.5, height: 378.5)
    static let padExtraLarge = CGSize(width: 795, height: 378.5)
    /// iOS and macOS 27: an estimate (two large widgets stacked), until the SDK documents it.
    static let padExtraLargePortrait = CGSize(width: 378.5, height: 795)
    static let lockCircular = CGSize(width: 76, height: 76)
    static let lockRectangular = CGSize(width: 172, height: 76)
    static let lockInline = CGSize(width: 257, height: 26)
}

/// One appearance of the iPhone Home Screen set.
private struct PhoneSet: View {
    let scheme: ColorScheme
    var mode: WidgetRenderingMode = .fullColor

    var body: some View {
        let sample = WidgetPreviewData.entry(WidgetPreviewData.sample)
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 22) {
                WidgetMockFrame(size: WidgetSizes.phoneSmall, scheme: scheme, mode: mode) {
                    ContinueLearningContent(entry: sample, family: .systemSmall)
                }
                WidgetMockFrame(size: WidgetSizes.phoneSmall, scheme: scheme, mode: mode) {
                    WeeklyGoalContent(entry: sample, family: .systemSmall)
                }
            }
            WidgetMockFrame(size: WidgetSizes.phoneMedium, scheme: scheme, mode: mode) {
                ContinueLearningContent(entry: sample, family: .systemMedium)
            }
            WidgetMockFrame(size: WidgetSizes.phoneMedium, scheme: scheme, mode: mode) {
                WeeklyGoalContent(entry: sample, family: .systemMedium)
            }
            WidgetMockFrame(size: WidgetSizes.phoneLarge, scheme: scheme, mode: mode) {
                OverviewContent(entry: sample, family: .systemLarge)
            }
        }
    }
}

/// The iPhone Home Screen set, light beside dark.
struct WidgetGalleryPhones: View {
    var body: some View {
        HStack(alignment: .top, spacing: 40) {
            PhoneSet(scheme: .light)
            PhoneSet(scheme: .dark)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(white: 0.55))
    }
}

/// The states that matter: first launch, a guest's first week, a made week, a week that ended
/// without the app being opened, no lesson chosen yet.
struct WidgetGalleryStates: View {
    private let states: [LearnFRCEntry] = [
        WidgetPreviewData.entry(WidgetPreviewData.empty),
        WidgetPreviewData.entry(WidgetPreviewData.firstWeekGuest),
        WidgetPreviewData.entry(WidgetPreviewData.goalMet),
        WidgetPreviewData.entry(WidgetPreviewData.sample, daysLater: 6),
        WidgetPreviewData.entry(WidgetPreviewData.noLesson),
    ]

    var body: some View {
        HStack(alignment: .top, spacing: 20) {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(states.indices, id: \.self) { i in
                    let scheme: ColorScheme = i.isMultiple(of: 2) ? .light : .dark
                    HStack(spacing: 16) {
                        WidgetMockFrame(size: WidgetSizes.phoneSmall, scheme: scheme) {
                            ContinueLearningContent(entry: states[i], family: .systemSmall)
                        }
                        WidgetMockFrame(size: WidgetSizes.phoneSmall, scheme: scheme) {
                            WeeklyGoalContent(entry: states[i], family: .systemSmall)
                        }
                        WidgetMockFrame(size: WidgetSizes.phoneMedium, scheme: scheme) {
                            WeeklyGoalContent(entry: states[i], family: .systemMedium)
                        }
                    }
                }
            }
            VStack(alignment: .leading, spacing: 16) {
                WidgetMockFrame(size: WidgetSizes.phoneMedium, scheme: .light) {
                    ContinueLearningContent(entry: WidgetPreviewData.entry(WidgetPreviewData.longTitle), family: .systemMedium)
                }
                WidgetMockFrame(size: WidgetSizes.phoneLarge, scheme: .dark) {
                    OverviewContent(entry: WidgetPreviewData.entry(WidgetPreviewData.goalMet), family: .systemLarge)
                }
                WidgetMockFrame(size: WidgetSizes.phoneLarge, scheme: .light) {
                    OverviewContent(entry: WidgetPreviewData.entry(WidgetPreviewData.firstWeekGuest), family: .systemLarge)
                }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(white: 0.55))
    }
}

/// iPad and Mac desktop sizes, up to extra large (and extra large portrait, iOS and macOS 27).
struct WidgetGalleryPad: View {
    var body: some View {
        let sample = WidgetPreviewData.entry(WidgetPreviewData.sample)
        HStack(alignment: .top, spacing: 24) {
            padSizes(sample)
            WidgetMockFrame(size: WidgetSizes.padExtraLargePortrait, scheme: .light) {
                OverviewContent(entry: WidgetPreviewData.entry(WidgetPreviewData.firstWeekGuest), layout: .stack)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(white: 0.55))
    }

    private func padSizes(_ sample: LearnFRCEntry) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(alignment: .top, spacing: 24) {
                WidgetMockFrame(size: WidgetSizes.padSmall, scheme: .light) {
                    ContinueLearningContent(entry: sample, family: .systemSmall)
                }
                WidgetMockFrame(size: WidgetSizes.padMedium, scheme: .light) {
                    ContinueLearningContent(entry: sample, family: .systemMedium)
                }
                WidgetMockFrame(size: WidgetSizes.padMedium, scheme: .dark) {
                    WeeklyGoalContent(entry: sample, family: .systemMedium)
                }
            }
            HStack(alignment: .top, spacing: 24) {
                WidgetMockFrame(size: WidgetSizes.padLarge, scheme: .dark) {
                    OverviewContent(entry: sample, family: .systemLarge)
                }
                WidgetMockFrame(size: WidgetSizes.padExtraLarge, scheme: .light) {
                    OverviewContent(entry: WidgetPreviewData.entry(WidgetPreviewData.goalMet), family: .systemExtraLarge)
                }
            }
            WidgetMockFrame(size: WidgetSizes.padExtraLarge, scheme: .dark) {
                OverviewContent(entry: sample, family: .systemExtraLarge)
            }
        }
    }
}

/// Tinted and clear Home Screens (accented), the inactive Mac desktop and the Lock Screen (vibrant).
struct WidgetGalleryModes: View {
    var body: some View {
        let sample = WidgetPreviewData.entry(WidgetPreviewData.sample)
        let met = WidgetPreviewData.entry(WidgetPreviewData.goalMet)
        VStack(alignment: .leading, spacing: 22) {
            HStack(alignment: .top, spacing: 22) {
                WidgetMockFrame(size: WidgetSizes.phoneSmall, scheme: .dark, mode: .accented) {
                    ContinueLearningContent(entry: sample, family: .systemSmall)
                }
                WidgetMockFrame(size: WidgetSizes.phoneSmall, scheme: .dark, mode: .accented) {
                    WeeklyGoalContent(entry: met, family: .systemSmall)
                }
                WidgetMockFrame(size: WidgetSizes.phoneSmall, scheme: .dark, mode: .vibrant) {
                    WeeklyGoalContent(entry: sample, family: .systemSmall)
                }
            }
            HStack(alignment: .top, spacing: 22) {
                WidgetMockFrame(size: WidgetSizes.phoneMedium, scheme: .dark, mode: .accented) {
                    ContinueLearningContent(entry: sample, family: .systemMedium)
                }
                WidgetMockFrame(size: WidgetSizes.phoneMedium, scheme: .dark, mode: .accented) {
                    WeeklyGoalContent(entry: met, family: .systemMedium)
                }
            }
            WidgetMockFrame(size: WidgetSizes.phoneLarge, scheme: .dark, mode: .vibrant) {
                OverviewContent(entry: sample, family: .systemLarge)
            }
            #if os(iOS)
            HStack(alignment: .center, spacing: 22) {
                AccessoryMockFrame(size: WidgetSizes.lockCircular) {
                    WeeklyGoalContent(entry: sample, family: .accessoryCircular)
                }
                AccessoryMockFrame(size: WidgetSizes.lockRectangular) {
                    ContinueLearningContent(entry: sample, family: .accessoryRectangular)
                }
                AccessoryMockFrame(size: WidgetSizes.lockRectangular) {
                    WeeklyGoalContent(entry: sample, family: .accessoryRectangular)
                }
            }
            AccessoryMockFrame(size: WidgetSizes.lockInline) {
                WeeklyGoalContent(entry: sample, family: .accessoryInline)
            }
            #endif
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(LinearGradient(colors: [Color(red: 0.13, green: 0.17, blue: 0.32), Color(red: 0.05, green: 0.06, blue: 0.1)],
                                   startPoint: .top, endPoint: .bottom))
    }
}

#Preview("iPhone, light and dark", traits: .fixedLayout(width: 790, height: 1090)) {
    WidgetGalleryPhones()
}

#Preview("States", traits: .fixedLayout(width: 1180, height: 1000)) {
    WidgetGalleryStates()
}

#Preview("iPad and Mac desktop", traits: .fixedLayout(width: 1660, height: 1000)) {
    WidgetGalleryPad()
}

#Preview("Tinted Home Screen, Mac desktop and Lock Screen", traits: .fixedLayout(width: 790, height: 1180)) {
    WidgetGalleryModes()
}

#endif
