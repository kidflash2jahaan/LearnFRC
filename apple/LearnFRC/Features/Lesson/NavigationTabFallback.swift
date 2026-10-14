import SwiftUI

/// The tab a screen sits in, for when `\.navigationTab` doesn't reach it.
///
/// `RootView` sets `\.navigationTab` on each tab's `NavigationStack`. On iPhone and iPad that
/// reaches every screen in the stack. On the Mac (a `NavigationStack` in the split view's
/// detail column) a screen pushed onto the stack reads nil: a lesson pushed in Guides logged
/// nil while Guides was selected. Without its tab, whatever a screen keeps per tab (the
/// lesson's place and answers, the glossary's filter and place) fell back to one key shared by
/// every tab, and was never forgotten.
///
/// The Mac only ever builds the selected tab's stack (ARCHITECTURE 6.6), so the tab selected
/// when a screen is first built is the one it's in. This keeps that answer for the screen's
/// life; a later tab switch takes the screen down rather than moving it. Wherever
/// `\.navigationTab` does arrive, it wins, so this changes nothing on iPhone and iPad.
///
///     @Environment(\.navigationTab) private var tab
///     @State private var tabFallback = NavigationTabFallback()
///     private var screenTab: AppTab? { tabFallback.tab(tab, navigation: navigation) }
///
///     body.environment(\.navigationTab, screenTab)   // so modifiers inside it see it too
///
/// Not observed: the first answer is kept, so reading it never redraws anything.
@MainActor
final class NavigationTabFallback {
    private var builtIn: AppTab?

    /// `environment` when it's set; otherwise the tab that was selected when this screen was
    /// first asked. nil outside a window (previews).
    func tab(_ environment: AppTab?, navigation: WindowNavigation?) -> AppTab? {
        if let environment { return environment }
        if builtIn == nil { builtIn = navigation?.selectedTab }
        return builtIn
    }
}
