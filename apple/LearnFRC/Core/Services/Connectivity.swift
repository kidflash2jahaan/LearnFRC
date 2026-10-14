import Foundation
import Network
import Observation

/// Whether the device has a usable network path. Used to skip refreshes that
/// can't work and to flush queued writes the moment the connection returns.
@Observable
@MainActor
final class Connectivity {
    private(set) var isOnline = true

    /// Called on the main actor each time the device goes from offline to online.
    @ObservationIgnored var onReconnect: (@MainActor () -> Void)?

    @ObservationIgnored private var monitor: NWPathMonitor?

    init(monitoring: Bool = !AppConfig.isRunningPreviews) {
        guard monitoring else { return }
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor [weak self] in
                self?.update(online: online)
            }
        }
        monitor.start(queue: DispatchQueue(label: "com.learnfrc.app.connectivity", qos: .utility))
        self.monitor = monitor
    }

    /// Forces the state (previews only).
    func setPreviewOnline(_ online: Bool) {
        isOnline = online
    }

    /// Stops watching (the app's instance lives for the whole run, so this is for tests and previews).
    func stop() {
        monitor?.cancel()
        monitor = nil
    }

    private func update(online: Bool) {
        let wasOffline = !isOnline
        guard online != isOnline else { return }
        isOnline = online
        Log.sync.info("Network is \(online ? "online" : "offline", privacy: .public)")
        if online, wasOffline { onReconnect?() }
    }
}
