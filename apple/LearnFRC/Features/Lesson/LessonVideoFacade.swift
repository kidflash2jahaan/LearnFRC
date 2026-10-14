import SwiftUI
import YouTubePlayerKit

/// "the video version": a lesson's narrated video as a poster until someone asks for it.
///
/// Nothing from YouTube loads until play is pressed (one thumbnail image, no player, no
/// cookies), exactly like the site's `YouTubeFacade`. Pressing play swaps in the YouTube
/// player and starts that one video, so one press is all it takes; it never starts on its
/// own, never plays in the background, and nothing is drawn over a playing video. Any link
/// inside the player, and "Watch it on YouTube", opens outside the app.
struct LessonVideoFacade: View {
    let videoID: String
    let lessonTitle: String
    /// The live player once play was pressed, owned by the lesson so read-aloud can pause it.
    @Binding var player: YouTubePlayer?
    /// Called when play is pressed (the lesson stops reading aloud).
    var onPlay: () -> Void = {}

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("the video version")
            screen
                .padding(8)
                .background { NotebookBoxBackground(size: .a, shadow: .card) }
            Text(caption)
                .font(LF.Fonts.body(15, relativeTo: .subheadline))
                .foregroundStyle(LF.Palette.graphite)
                .tint(LF.Palette.blue)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Video version of this lesson")
    }

    private var caption: AttributedString {
        var text = AttributedString("The same lesson as a narrated video. ")
        var link = AttributedString("Watch it on YouTube")
        link.link = LessonLinks.youTube(videoID)
        link.foregroundColor = LF.Palette.blue
        link.underlineStyle = .single
        text.append(link)
        return text
    }

    /// A 16:9 frame that the poster and the player both fill exactly, so pressing play swaps
    /// one for the other without the page moving. The frame's size comes from the black
    /// backing alone; whatever sits on it is laid over it and clipped to it.
    private var screen: some View {
        Color.black
            .aspectRatio(16 / 9, contentMode: .fit)
            .overlay {
                if let player {
                    YouTubePlayerView(player) { state in
                        switch state {
                        case .idle:
                            poster(loading: true)
                        case .ready:
                            EmptyView()
                        case .error:
                            unavailable
                        }
                    }
                    .accessibilityLabel("\(lessonTitle), the LearnFRC video")
                } else {
                    Button(action: play) {
                        poster(loading: false)
                    }
                    .buttonStyle(PosterButtonStyle())
                    .accessibilityLabel("Play the video version of \(lessonTitle)")
                    .accessibilityHint("Loads the video from YouTube and starts it")
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
                    .allowsHitTesting(false)
            }
    }

    private func play() {
        onPlay()
        player = YouTubePlayer(
            source: .video(id: videoID),
            parameters: .init(
                // The person just pressed play: start this one video, nothing else.
                autoPlay: true,
                loopEnabled: false,
                showControls: true,
                showFullscreenButton: true,
                restrictRelatedVideosToSameChannel: true
            ),
            configuration: .init(
                fullscreenMode: .preferred,
                allowsInlineMediaPlayback: true,
                allowsPictureInPictureMediaPlayback: false
            )
        )
    }

    private func poster(loading: Bool) -> some View {
        ZStack(alignment: .bottomTrailing) {
            // YouTube's `hqdefault` is 4:3 with black bars baked in above and below a 16:9
            // video. Filling the 16:9 frame (sized by the clear base, not by the image) crops
            // exactly those bars away.
            Color.clear
                .overlay {
                    AsyncImage(url: URL(string: "https://i.ytimg.com/vi/\(videoID)/hqdefault.jpg")) { phase in
                        if let image = phase.image {
                            image
                                .resizable()
                                .scaledToFill()
                        } else {
                            Color.black
                                .overlay {
                                    Image(systemName: "play.rectangle")
                                        .font(.largeTitle)
                                        .foregroundStyle(.white.opacity(0.5))
                                }
                        }
                    }
                }
                .clipped()
                .accessibilityHidden(true)

            if loading {
                ProgressView()
                    .controlSize(.regular)
                    .tint(.white)
                    .padding(10)
                    .background(.black.opacity(0.55), in: Circle())
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityLabel("Loading the video")
            } else {
                Label("watch", systemImage: "play.fill")
                    .labelStyle(.titleAndIcon)
                    .font(LF.Fonts.mono(14, weight: .bold, relativeTo: .callout))
                    .foregroundStyle(LF.Palette.onBlue)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background {
                        ZStack {
                            HandShape(.s).fill(Color(red: 0.07, green: 0.08, blue: 0.09)).offset(x: 3, y: 3)
                            HandShape(.s).fill(LF.Palette.blueButton)
                            HandShape(.s).strokeBorder(LF.Palette.blueButton, lineWidth: LF.Metrics.stroke)
                        }
                    }
                    .padding(.trailing, 14)
                    .padding(.bottom, 12)
                    .accessibilityHidden(true)
            }
        }
    }

    private var unavailable: some View {
        VStack(spacing: 10) {
            Image(systemName: "play.slash")
                .font(.title)
                .accessibilityHidden(true)
            Text("This video won't play here.")
                .font(LF.Fonts.body(16, weight: .bold, relativeTo: .callout))
            Link("Watch it on YouTube", destination: LessonLinks.youTube(videoID))
                .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                .underline()
        }
        .foregroundStyle(.white)
        .tint(.white)
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black)
    }
}

/// The poster's press: the "watch" button nudges up and left under a pointer, like the site,
/// and the whole poster dims a touch while held.
private struct PosterButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        PosterButton(configuration: configuration)
    }
}

private struct PosterButton: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hovering = false

    var body: some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.88 : 1)
            .offset(x: hovering && !reduceMotion ? -1 : 0, y: hovering && !reduceMotion ? -1 : 0)
            .contentShape(Rectangle())
            .onHover { hovering = $0 }
            .animation(reduceMotion ? nil : LF.Motion.hover, value: hovering)
            .animation(reduceMotion ? nil : LF.Motion.press, value: configuration.isPressed)
            #if os(macOS)
            .pointerStyle(.link)
            #else
            .hoverEffectDisabled()
            #endif
    }
}

#Preview("Video facade, iPhone", traits: .fixedLayout(width: 393, height: 420)) {
    @Previewable @State var player: YouTubePlayer?
    LessonVideoFacade(videoID: "jdGy4OUM2EY", lessonTitle: "What FRC Actually Costs", player: $player)
        .padding(LF.Metrics.gutter)
        .frame(maxHeight: .infinity, alignment: .top)
        .paperBackground()
}

#Preview("Video facade, iPad dark", traits: .fixedLayout(width: 760, height: 560)) {
    @Previewable @State var player: YouTubePlayer?
    LessonVideoFacade(videoID: "jdGy4OUM2EY", lessonTitle: "What FRC Actually Costs", player: $player)
        .padding(32)
        .frame(maxHeight: .infinity, alignment: .top)
        .paperBackground()
        .environment(\.colorScheme, .dark)
}
