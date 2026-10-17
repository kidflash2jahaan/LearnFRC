import Foundation
import Observation

/// Admin data for the signed-in account: its site role, the counts behind the You tab's admin
/// rows, /admin, the feedback inbox, the super admins' team desk and the member's /apply.
///
/// Memory only, on purpose (security, apple/docs/ARCHITECTURE.md): nothing here is written to
/// the cache, the widgets' app group, Spotlight or App Intents, and all of it goes the moment
/// the account changes (`sync(userID:)` with another id, or nil on sign-out).
///
/// The role comes from the server and only ever decides what's shown. Every route checks it
/// again, so a stale role costs a locked card, never access: a 403 from any admin route turns
/// the role down at once and drops what the account can no longer see.
///
/// One store for every window (`shared`). Views read it with
/// `@Environment(AdminStore.self) private var injected: AdminStore?` and fall back to `shared`,
/// so previews can hand in a store of their own (`AdminStore.preview(...)`).
@Observable
@MainActor
final class AdminStore {
    static let shared = AdminStore()

    /// What a screen's remote copy is doing.
    struct Remote<Value: Sendable & Equatable>: Equatable, Sendable {
        var value: Value?
        var fetchedAt: Date?
        var error: AdminError?
        var isLoading = false
        /// The route answered 403: the screen shows its locked card with this sentence.
        var locked: String?

        var hasValue: Bool { value != nil }
        /// Nothing to show yet and nothing has failed: draw the loading state.
        var isFirstLoad: Bool { value == nil && error == nil && locked == nil }
    }

    /// The account these belong to. Nil while signed out.
    private(set) var ownerID: UUID?
    /// The account's site role, once the server has said. Nil means not known yet (no admin
    /// rows are shown until it is).
    private(set) var role: SiteRole?
    /// The You tab's counts (admins only).
    private(set) var summary: AdminSummary?
    private(set) var dashboard = Remote<AdminDashboard>()
    private(set) var feedback = Remote<AdminFeedbackPage>()
    private(set) var team = Remote<AdminTeamDesk>()
    private(set) var applyState = Remote<AdminApplyState>()
    /// Verified marks changed from this device this session, by lesson, so the lesson footer
    /// shows the new state straight away. `nil` inside means "removed".
    private(set) var verifiedMarks: [UUID: VerifiedMark] = [:]

    struct VerifiedMark: Hashable, Sendable {
        let verifiedAt: Date?
    }

    var isAdmin: Bool { role?.isAdmin ?? false }
    var isSuperAdmin: Bool { role?.isSuperAdmin ?? false }

    @ObservationIgnored private let api: AdminAPI?
    @ObservationIgnored private var summaryFetchedAt: Date?
    @ObservationIgnored private var summaryTask: Task<Void, Never>?
    @ObservationIgnored private var dashboardTask: Task<Void, Never>?
    @ObservationIgnored private var feedbackTask: Task<Void, Never>?
    @ObservationIgnored private var teamTask: Task<Void, Never>?
    @ObservationIgnored private var applyTask: Task<Void, Never>?

    /// How long the role and counts are trusted before a screen that shows them asks again.
    private static let summaryMaxAge: TimeInterval = 60
    private static let memberMaxAge: TimeInterval = 10 * 60

    init(api: AdminAPI? = .shared) {
        self.api = AppConfig.isRunningPreviews ? nil : api
    }

    // MARK: Account

    /// Follows the signed-in account. A different id (or nil) clears everything first, then the
    /// role and counts are fetched when they're older than a minute (`force` asks now).
    /// Call it from anything that shows admin UI, with `AccountStore.userID`.
    func sync(userID: UUID?, force: Bool = false) async {
        // A preview store holds fixed data for a made-up account: leave it be.
        guard api != nil else { return }
        if userID != ownerID {
            reset()
            ownerID = userID
        }
        guard userID != nil else { return }
        // A member is asked again far less often: there's nothing to count for them.
        let maxAge = isAdmin ? Self.summaryMaxAge : Self.memberMaxAge
        if !force, role != nil, let summaryFetchedAt, Date.now.timeIntervalSince(summaryFetchedAt) < maxAge {
            return
        }
        await refreshSummary()
    }

    /// The role `/api/app/me` reported (`siteRole`, display only, from the same server lookup).
    /// A member needs no further request; an admin role still fetches its counts on the next
    /// `sync`. Every admin route checks the role again regardless.
    func adopt(siteRole raw: String?, for userID: UUID) {
        guard api != nil, let raw else { return }
        if userID != ownerID {
            reset()
            ownerID = userID
        }
        let stated = SiteRole(raw: raw)
        if stated != role { setRole(stated) }
        if !stated.isAdmin { summaryFetchedAt = .now }
    }

    /// Forgets everything (sign-out, account switch, account deleted).
    func reset() {
        summaryTask?.cancel()
        dashboardTask?.cancel()
        feedbackTask?.cancel()
        teamTask?.cancel()
        applyTask?.cancel()
        summaryTask = nil
        dashboardTask = nil
        feedbackTask = nil
        teamTask = nil
        applyTask = nil
        ownerID = nil
        role = nil
        summary = nil
        summaryFetchedAt = nil
        dashboard = Remote()
        feedback = Remote()
        team = Remote()
        applyState = Remote()
        verifiedMarks = [:]
    }

    /// `GET /admin/summary`: the role and the counts. One request at a time.
    func refreshSummary() async {
        if let summaryTask {
            await summaryTask.value
            return
        }
        guard let api, let owner = ownerID else { return }
        let task = Task { [weak self] in
            let result: Result<AdminSummary, AdminError>
            do throws(AdminError) { result = .success(try await api.summary()) } catch { result = .failure(error) }
            self?.receive(summary: result, owner: owner)
        }
        summaryTask = task
        await task.value
        summaryTask = nil
    }

    private func receive(summary result: Result<AdminSummary, AdminError>, owner: UUID) {
        guard owner == ownerID else { return }
        switch result {
        case .success(let fresh):
            summary = fresh.role.isAdmin ? fresh : nil
            setRole(fresh.role)
            summaryFetchedAt = .now
        case .failure(let error):
            switch error.kind {
            case .forbidden, .unavailable:
                // Not an admin (or the site has no admin tools yet): nothing to show.
                summary = nil
                setRole(.member)
                summaryFetchedAt = .now
            case .unauthorized:
                break
            default:
                // Offline or a blip: keep whatever was known for this account.
                Log.sync.info("Admin summary kept the last answer: \(error.message, privacy: .public)")
            }
        }
    }

    /// Records a role the server just stated, and drops what a lower role can't see.
    private func setRole(_ newRole: SiteRole) {
        if role != newRole { role = newRole }
        if !newRole.isAdmin {
            summary = nil
            dashboard = Remote(locked: dashboard.locked ?? (dashboard.hasValue ? AdminError.adminOnly : nil))
            feedback = Remote(locked: feedback.locked ?? (feedback.hasValue ? AdminError.adminOnly : nil))
            verifiedMarks = [:]
        }
        if !newRole.isSuperAdmin {
            team = Remote(locked: team.locked ?? (team.hasValue ? AdminError.superAdminOnly : nil))
        }
    }

    /// A 403 from an admin route: whatever the role was, it isn't admin now.
    private func lostAdmin(_ message: String) {
        summaryFetchedAt = nil
        setRole(.member)
        dashboard.locked = message
        feedback.locked = message
    }

    // MARK: Dashboard

    /// `GET /admin/dashboard`. Screens keep showing the last copy while it runs.
    func loadDashboard() async {
        if let dashboardTask {
            await dashboardTask.value
            return
        }
        guard let api, let owner = ownerID else { return }
        dashboard.isLoading = true
        let task = Task { [weak self] in
            let result: Result<AdminDashboard, AdminError>
            do throws(AdminError) { result = .success(try await api.dashboard()) } catch { result = .failure(error) }
            self?.receive(dashboard: result, owner: owner)
        }
        dashboardTask = task
        await task.value
        dashboardTask = nil
    }

    private func receive(dashboard result: Result<AdminDashboard, AdminError>, owner: UUID) {
        guard owner == ownerID else { return }
        dashboard.isLoading = false
        switch result {
        case .success(let fresh):
            dashboard = Remote(value: fresh, fetchedAt: .now)
            summary = fresh.summary
            summaryFetchedAt = .now
            setRole(fresh.role)
        case .failure(let error):
            if error.isForbidden {
                lostAdmin(error.message)
            } else {
                dashboard.error = error
            }
        }
    }

    // MARK: Feedback

    /// `GET /admin/feedback`: the latest 40.
    func loadFeedback() async {
        if let feedbackTask {
            await feedbackTask.value
            return
        }
        guard let api, let owner = ownerID else { return }
        feedback.isLoading = true
        let task = Task { [weak self] in
            let result: Result<AdminFeedbackPage, AdminError>
            do throws(AdminError) { result = .success(try await api.feedback(limit: 40)) } catch { result = .failure(error) }
            self?.receive(feedback: result, owner: owner)
        }
        feedbackTask = task
        await task.value
        feedbackTask = nil
    }

    private func receive(feedback result: Result<AdminFeedbackPage, AdminError>, owner: UUID) {
        guard owner == ownerID else { return }
        feedback.isLoading = false
        switch result {
        case .success(let fresh):
            feedback = Remote(value: fresh, fetchedAt: .now)
            if let summary {
                self.summary = AdminSummary(
                    role: summary.role, openFeedback: fresh.openCount, feedbackTotal: fresh.total,
                    pendingApplications: summary.pendingApplications, pendingEdits: summary.pendingEdits,
                    pendingSubmissions: summary.pendingSubmissions
                )
            }
        case .failure(let error):
            if error.isForbidden { lostAdmin(error.message) } else { feedback.error = error }
        }
    }

    /// Sends a reply from LearnFRC to the sender of one message. On success the message is
    /// marked replied everywhere it's shown and the server's copy is returned.
    func reply(to id: UUID, text: String) async throws(AdminError) -> AdminFeedbackItem {
        guard let api, let owner = ownerID else { throw AdminError.unauthorized }
        do throws(AdminError) {
            let item = try await api.reply(to: id, text: text)
            guard owner == ownerID else { throw AdminError.unauthorized }
            if let page = feedback.value { feedback.value = page.replacing(item) }
            if let summary, item.isReplied { self.summary = summary.answeringOne() }
            if let board = dashboard.value, item.isReplied {
                let now = board.now
                dashboard.value = board.replacing(now: .init(
                    onlineNow: now.onlineNow, openFeedback: max(0, now.openFeedback - 1), feedbackTotal: now.feedbackTotal,
                    pendingApplications: now.pendingApplications, pendingEdits: now.pendingEdits, pendingSubmissions: now.pendingSubmissions))
            }
            return item
        } catch {
            if error.isForbidden, owner == ownerID { lostAdmin(error.message) }
            throw error
        }
    }

    // MARK: Verified mark

    /// Puts the public verified mark on a lesson, or takes it off. Returns the new date.
    func setVerified(lessonID: UUID, verified: Bool) async throws(AdminError) -> Date? {
        guard let api, let owner = ownerID else { throw AdminError.unauthorized }
        do throws(AdminError) {
            let date = try await api.setVerified(lessonID: lessonID, verified: verified)
            guard owner == ownerID else { throw AdminError.unauthorized }
            verifiedMarks[lessonID] = VerifiedMark(verifiedAt: date)
            return date
        } catch {
            if error.isForbidden, owner == ownerID {
                summaryFetchedAt = nil
                setRole(.member)
            }
            throw error
        }
    }

    // MARK: Team desk

    /// `GET /admin/team` (super admins).
    func loadTeam() async {
        if let teamTask {
            await teamTask.value
            return
        }
        guard let api, let owner = ownerID else { return }
        team.isLoading = true
        let task = Task { [weak self] in
            let result: Result<AdminTeamDesk, AdminError>
            do throws(AdminError) { result = .success(try await api.teamDesk()) } catch { result = .failure(error) }
            self?.receive(team: result, owner: owner)
        }
        teamTask = task
        await task.value
        teamTask = nil
    }

    private func receive(team result: Result<AdminTeamDesk, AdminError>, owner: UUID) {
        guard owner == ownerID else { return }
        team.isLoading = false
        switch result {
        case .success(let fresh):
            team = Remote(value: fresh, fetchedAt: .now)
            if role != .superadmin { setRole(.superadmin) }
            if let summary {
                self.summary = AdminSummary(
                    role: .superadmin, openFeedback: summary.openFeedback, feedbackTotal: summary.feedbackTotal,
                    pendingApplications: fresh.pending.count, pendingEdits: summary.pendingEdits,
                    pendingSubmissions: summary.pendingSubmissions
                )
            }
        case .failure(let error):
            if error.isForbidden {
                team = Remote(locked: error.message)
                // Still maybe an admin; the summary says which.
                if role == .superadmin { role = .admin }
                summaryFetchedAt = nil
                Task { await self.refreshSummary() }
            } else {
                team.error = error
            }
        }
    }

    /// Accepts or turns down one application. The applicant is emailed either way.
    func decide(_ id: UUID, decision: AdminDecision, note: String?) async throws(AdminError) {
        guard let api, let owner = ownerID else { throw AdminError.unauthorized }
        do throws(AdminError) {
            try await api.decide(applicationID: id, decision: decision, note: note)
            guard owner == ownerID else { throw AdminError.unauthorized }
            if let desk = team.value { team.value = desk.deciding(id, as: decision, note: note) }
            if let summary { self.summary = summary.decidingOne() }
            if let board = dashboard.value, let waiting = board.now.pendingApplications {
                let now = board.now
                dashboard.value = board.replacing(now: .init(
                    onlineNow: now.onlineNow, openFeedback: now.openFeedback, feedbackTotal: now.feedbackTotal,
                    pendingApplications: max(0, waiting - 1), pendingEdits: now.pendingEdits, pendingSubmissions: now.pendingSubmissions))
            }
        } catch {
            if error.isForbidden, owner == ownerID { team.locked = error.message }
            throw error
        }
    }

    /// Re-reads the desk after a change, so an accepted applicant shows up on the team.
    func refreshTeamQuietly() {
        Task { await self.loadTeam() }
    }

    /// Changes a team member's role (`admin` or `superadmin`).
    func setRole(of userID: UUID, to newRole: SiteRole) async throws(AdminError) {
        guard let api, let owner = ownerID else { throw AdminError.unauthorized }
        do throws(AdminError) {
            try await api.setRole(userID: userID, role: newRole)
            guard owner == ownerID else { throw AdminError.unauthorized }
            if let desk = team.value { team.value = desk.setting(userID, to: newRole) }
        } catch {
            if error.isForbidden, owner == ownerID { team.locked = error.message }
            throw error
        }
    }

    /// Takes somebody off the team. Their account and progress stay.
    func remove(_ userID: UUID) async throws(AdminError) {
        guard let api, let owner = ownerID else { throw AdminError.unauthorized }
        do throws(AdminError) {
            try await api.removeFromTeam(userID: userID)
            guard owner == ownerID else { throw AdminError.unauthorized }
            if let desk = team.value { team.value = desk.removing(userID) }
        } catch {
            if error.isForbidden, owner == ownerID { team.locked = error.message }
            throw error
        }
    }

    // MARK: Apply

    /// `GET /apply` for this account.
    func loadApply() async {
        if let applyTask {
            await applyTask.value
            return
        }
        guard let api, let owner = ownerID else { return }
        applyState.isLoading = true
        let task = Task { [weak self] in
            let result: Result<AdminApplyState, AdminError>
            do throws(AdminError) { result = .success(try await api.applyState()) } catch { result = .failure(error) }
            self?.receive(applyState: result, owner: owner)
        }
        applyTask = task
        await task.value
        applyTask = nil
    }

    private func receive(applyState result: Result<AdminApplyState, AdminError>, owner: UUID) {
        guard owner == ownerID else { return }
        applyState.isLoading = false
        switch result {
        case .success(let fresh):
            applyState = Remote(value: fresh, fetchedAt: .now)
        case .failure(let error):
            applyState.error = error
        }
    }

    /// Sends an application. The page then reads its new state (pending).
    func submitApplication(experience: String, why: String, availability: String?) async throws(AdminError) {
        guard let api, ownerID != nil else { throw AdminError.unauthorized }
        try await api.submitApplication(experience: experience, why: why, availability: availability)
        await loadApply()
    }

    /// Withdraws this account's pending application.
    func withdrawApplication() async throws(AdminError) {
        guard let api, ownerID != nil else { throw AdminError.unauthorized }
        try await api.withdrawApplication()
        await loadApply()
    }

    // MARK: Previews

    /// A store holding fixed data, for previews. Never touches the network.
    static func preview(
        role: SiteRole?,
        summary: AdminSummary? = nil,
        dashboard: AdminDashboard? = nil,
        feedback: AdminFeedbackPage? = nil,
        team: AdminTeamDesk? = nil,
        apply: AdminApplyState? = nil,
        lockedDashboard: String? = nil,
        lockedTeam: String? = nil,
        error: AdminError? = nil
    ) -> AdminStore {
        let store = AdminStore(api: nil)
        store.ownerID = UUID()
        store.role = role
        store.summary = summary ?? dashboard?.summary
        store.summaryFetchedAt = .now
        store.dashboard = Remote(value: dashboard, fetchedAt: dashboard == nil ? nil : .now, error: dashboard == nil ? error : nil, locked: lockedDashboard)
        store.feedback = Remote(value: feedback, fetchedAt: feedback == nil ? nil : .now, error: feedback == nil ? error : nil)
        store.team = Remote(value: team, fetchedAt: team == nil ? nil : .now, error: team == nil ? error : nil, locked: lockedTeam)
        store.applyState = Remote(value: apply, fetchedAt: apply == nil ? nil : .now, error: apply == nil ? error : nil)
        return store
    }
}
