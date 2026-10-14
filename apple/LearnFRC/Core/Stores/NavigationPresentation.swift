import SwiftUI

/// What a window is showing, as one comparable value: the selected tab, every tab's stack and
/// the newest search request. When it changes, the window has navigated somewhere.
struct NavigationFingerprint: Equatable {
    let selectedTab: AppTab
    let paths: [AppTab: [AppRoute]]
    let searchRequestID: UUID?

    @MainActor
    init(_ navigation: WindowNavigation) {
        selectedTab = navigation.selectedTab
        paths = navigation.paths
        searchRequestID = navigation.searchRequest?.id
    }
}

extension View {
    /// Closes a sheet, popover or cover this screen presented as soon as its window navigates
    /// anywhere (a link, a search request, a notification tap, an App Intent, a tab switch, a
    /// push), so nothing is left floating over a screen it doesn't belong to, and nothing in it
    /// can push onto a tab the person isn't looking at.
    func closesOnNavigation(_ isPresented: Binding<Bool>) -> some View {
        modifier(ClosesOnNavigation { if isPresented.wrappedValue { isPresented.wrappedValue = false } })
    }

    /// The `item:` form of `closesOnNavigation(_:)`.
    func closesOnNavigation<Item>(_ item: Binding<Item?>) -> some View {
        modifier(ClosesOnNavigation { if item.wrappedValue != nil { item.wrappedValue = nil } })
    }
}

private struct ClosesOnNavigation: ViewModifier {
    let close: () -> Void
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?

    func body(content: Content) -> some View {
        if let navigation {
            content.onChange(of: NavigationFingerprint(navigation)) { close() }
        } else {
            content
        }
    }
}
