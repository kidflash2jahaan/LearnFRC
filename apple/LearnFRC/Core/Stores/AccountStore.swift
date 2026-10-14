import Foundation
import Observation
import Supabase

/// Who's using the app.
enum AccountState: Hashable, Sendable {
    /// The stored session hasn't been read yet (a moment at launch).
    case loading
    /// No account. Reading, quizzes and guest progress all work.
    case guest
    /// Signed in. `Me` may be provisional (offline, never fetched): see `Me.isProvisional`.
    case signedIn(Me)
}

/// A change other stores react to (wired up by `AppModel`).
enum AccountChange: Hashable, Sendable {
    /// A session for this user is active. `isNewSignIn` is true right after signing in
    /// or up (as opposed to a session restored at launch).
    case signedIn(userID: UUID, isNewSignIn: Bool)
    /// No account on this device (signed out, or never signed in).
    case guest
    /// The account was deleted.
    case deleted(userID: UUID)
}

/// Sign in, sign up, the signed-in profile and every account setting. Rules
/// (username, ban list, team number, email consent, deletion) live on the
/// website; this store calls `/api/app/*` and Supabase Auth.
@Observable
@MainActor
final class AccountStore {
    private(set) var state: AccountState = .loading
    /// A sign-in, sign-up or settings call is running.
    private(set) var isWorking = false
    private(set) var lastError: APIError?

    /// Set by `AppModel`. Called once per change, in order.
    @ObservationIgnored var onChange: (@MainActor (AccountChange) async -> Void)?

    @ObservationIgnored private let supabase: SupabaseService?
    @ObservationIgnored private let api: APIClient?
    @ObservationIgnored private let cache: CacheStore
    @ObservationIgnored private var listener: Task<Void, Never>?
    @ObservationIgnored private var activeUserID: UUID?
    @ObservationIgnored private var lastMeRefresh: Date?
    @ObservationIgnored private var guestNotified = false
    @ObservationIgnored private var establishing: (userID: UUID, task: Task<Void, Never>)?
    @ObservationIgnored private var changeChain: Task<Void, Never>?
    /// When each account on this device last skipped the profile setup step (user id to date).
    /// One entry covers both asks, like the site's one skip cookie.
    private var setupStepSkips: [String: Date] =
        UserDefaults.standard.dictionary(forKey: AccountStore.setupStepSkipsKey) as? [String: Date] ?? [:]
    /// The account whose `/me` was read from learnfrc.com in this run of the app. nil until
    /// then, and again after signing out. The copy restored from the device at launch can be
    /// days old (a handle picked on the website since still looks like a placeholder there),
    /// so nothing that asks the person to change their profile goes by it alone.
    private var freshMeUserID: UUID?

    init(supabase: SupabaseService? = .shared, api: APIClient? = .shared, cache: CacheStore = .shared) {
        self.supabase = supabase
        self.api = api
        self.cache = cache
    }

    // MARK: Derived

    var me: Me? {
        if case .signedIn(let me) = state { return me }
        return nil
    }

    var profile: Profile? { me?.profile }
    var userID: UUID? { me?.user.id }
    var isSignedIn: Bool { me != nil }
    var isGuest: Bool { state == .guest }
    var isLoading: Bool { state == .loading }

    /// The username gate: a signed-in account with no username sees `UsernameSetupView` first.
    /// Goes by the `/me` on hand, cached or fresh: an account with no handle is held from the
    /// first frame, offline too, until one is saved.
    var needsUsernameSetup: Bool { me?.needsUsernameSetup ?? false }

    /// `/me` has been read from learnfrc.com for the signed-in account in this run of the app,
    /// not just restored from the device.
    var hasFreshMe: Bool { freshMeUserID != nil && freshMeUserID == userID }

    /// What the site's skippable profile card asks for (`ProfileSetupMode` in
    /// `src/lib/onboarding.ts`).
    enum ProfileSetupAsk: Hashable, Sendable {
        /// The handle was machine-made (`Me.isPlaceholderUsername`, like `cosmic_builder_77`):
        /// pick your own. The card's `username` mode, where the team number is optional.
        case ownUsername
        /// The handle is the person's own but there's no team number: add it. The card's
        /// `team` mode.
        case teamNumber
    }

    /// The site's softer ask (`getProfileSetupState` in `src/lib/onboarding-server.ts`, not
    /// required), or nil. A placeholder handle is asked to change first; a handle of the
    /// person's own with no team number is asked for the team number. Neither while the account
    /// skipped in the last 14 days on this device (`skipProfileSetup()`, the site's one skip
    /// cookie for both, `SETUP_SKIP_MAX_AGE`), and never for an account with no username at
    /// all: that's the gate (`needsUsernameSetup`). Only once `/me` has been read in this run
    /// (`hasFreshMe`): the cached copy can still show a placeholder handle or a missing team
    /// number the person has since fixed on the website, and offline the step would offer to
    /// rename an account that already chose its name.
    var profileSetupAsk: ProfileSetupAsk? {
        guard let me, hasFreshMe, !me.isProvisional, !me.needsUsernameSetup else { return nil }
        let ask: ProfileSetupAsk
        if me.isPlaceholderUsername {
            ask = .ownUsername
        } else if me.profile.teamNumber == nil {
            ask = .teamNumber
        } else {
            return nil
        }
        if let skipped = setupStepSkips[me.user.id.uuidString],
           Date.now.timeIntervalSince(skipped) < Self.setupStepSkipDuration {
            return nil
        }
        return ask
    }

    /// `profileSetupAsk` is the placeholder-handle ask (`UsernameSetupView(required: false)`).
    var asksForOwnUsername: Bool { profileSetupAsk == .ownUsername }

    /// `profileSetupAsk` is the team-only ask (a real handle, no team number).
    var asksForTeamNumber: Bool { profileSetupAsk == .teamNumber }

    /// "Skip for now" on either ask: neither comes back for 14 days for this account on this
    /// device, like the site's skip cookie (`lf_setup_skipped`), which covers both modes.
    func skipProfileSetup() {
        guard let id = userID else { return }
        var skips = setupStepSkips.filter { Date.now.timeIntervalSince($0.value) < Self.setupStepSkipDuration }
        skips[id.uuidString] = .now
        setupStepSkips = skips
        UserDefaults.standard.set(skips, forKey: Self.setupStepSkipsKey)
    }

    /// The earlier name of `skipProfileSetup()`, from when the placeholder handle was the only ask.
    func skipUsernameStep() { skipProfileSetup() }

    /// How long a skipped setup step stays away (the site's `SETUP_SKIP_MAX_AGE`, 14 days).
    static let setupStepSkipDuration: TimeInterval = 60 * 60 * 24 * 14
    /// The key keeps its first name, so skips made before the team ask existed still count.
    nonisolated private static let setupStepSkipsKey = "account.usernameStepSkips"

    /// Show the one-time "Want reminder emails?" card (same rule as the site).
    var emailPrompt: Bool {
        guard let me, !me.isProvisional, !me.needsUsernameSetup else { return false }
        return me.emailPrompt
    }

    // MARK: Startup

    /// Restores a cached `/me`, then follows Supabase auth events for the life of the app.
    func start() async {
        guard listener == nil, let supabase else {
            if supabase == nil, state == .loading { state = .guest }
            return
        }
        let cached = await cache.load(Me.self, from: .me)?.value

        // Decide the first state from the stored session right away (no network).
        if let session = supabase.currentSession {
            if let cached, cached.user.id == session.user.id {
                state = .signedIn(cached)
            } else {
                state = .signedIn(.provisional(userID: session.user.id, email: session.user.email))
            }
        } else {
            state = .guest
        }

        let stream = supabase.authStateChanges
        listener = Task { [weak self] in
            for await (event, session) in stream {
                guard let self else { return }
                await self.handle(event: event, session: session)
            }
        }
    }

    private func handle(event: AuthChangeEvent, session: Session?) async {
        switch event {
        case .initialSession:
            if let session {
                await establish(userID: session.user.id, email: session.user.email, isNewSignIn: false)
            } else {
                await becomeGuest()
            }
        case .signedIn:
            if let session {
                await establish(userID: session.user.id, email: session.user.email, isNewSignIn: true)
            }
        case .signedOut:
            await becomeGuest()
        case .userDeleted:
            if let id = activeUserID {
                activeUserID = nil
                freshMeUserID = nil
                await cache.removePersonalFiles()
                state = .guest
                notify(.deleted(userID: id))
            }
        case .tokenRefreshed, .userUpdated, .passwordRecovery, .mfaChallengeVerified:
            break
        }
    }

    /// Moves to signed-in for this user once. A second caller for the same user (the
    /// Auth event and `signIn` both arrive) waits for the first to finish, so `signIn`
    /// returns with `/me` loaded and the username gate already known.
    private func establish(userID: UUID, email: String?, isNewSignIn: Bool) async {
        if let establishing, establishing.userID == userID {
            await establishing.task.value
            return
        }
        guard activeUserID != userID else { return }
        activeUserID = userID
        guestNotified = false
        let task = Task { await self.performEstablish(userID: userID, email: email, isNewSignIn: isNewSignIn) }
        establishing = (userID, task)
        await task.value
        if establishing?.userID == userID { establishing = nil }
    }

    private func performEstablish(userID: UUID, email: String?, isNewSignIn: Bool) async {
        if me?.user.id != userID {
            if let cached = await cache.load(Me.self, from: .me)?.value, cached.user.id == userID {
                state = .signedIn(cached)
            } else {
                state = .signedIn(.provisional(userID: userID, email: email))
            }
        }
        Log.auth.info("Signed in (\(isNewSignIn ? "new sign-in" : "restored", privacy: .public))")
        // The other stores hear first, so progress (and moving a guest's lessons in) runs
        // alongside the `/me` read instead of after it: the account's totals settle sooner.
        notify(.signedIn(userID: userID, isNewSignIn: isNewSignIn))
        await refreshMe(force: true)
    }

    /// Tells the other stores, in order, without making sign-in wait for a progress sync.
    private func notify(_ change: AccountChange) {
        let previous = changeChain
        changeChain = Task { [weak self] in
            await previous?.value
            await self?.onChange?(change)
        }
    }

    /// Moves to guest and tells the other stores once (sign out fires this twice: here and from Auth).
    /// Drops the account's files on this device (`/me`, team sheets with teammates' names).
    private func becomeGuest() async {
        let wasSignedIn = activeUserID != nil || isSignedIn
        activeUserID = nil
        freshMeUserID = nil
        if wasSignedIn { await cache.removePersonalFiles() }
        if state == .guest, guestNotified { return }
        state = .guest
        guestNotified = true
        notify(.guest)
    }

    // MARK: Sign in, sign up, sign out

    /// Email or username, plus password. Usernames go through `POST /api/app/auth/sign-in`;
    /// emails sign in with Supabase directly.
    func signIn(identifier: String, password: String) async throws {
        let identifier = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !identifier.isEmpty, !password.isEmpty else {
            throw fail(.validation("Enter your email or username and your password."))
        }
        guard let supabase else { throw fail(.network) }
        isWorking = true
        defer { isWorking = false }
        do {
            let session: Session
            if identifier.contains("@") {
                session = try await supabase.signIn(email: identifier.lowercased(), password: password)
            } else {
                guard let api else { throw APIError.network }
                let tokens = try await api.signIn(identifier: identifier.lowercased(), password: password)
                session = try await supabase.setSession(tokens)
            }
            lastError = nil
            await establish(userID: session.user.id, email: session.user.email, isNewSignIn: true)
        } catch {
            throw fail(APIError.from(error))
        }
    }

    /// Creates an account through the site's rules. The person confirms by email
    /// (the link opens learnfrc.com), then signs in here.
    func signUp(
        email: String, password: String, username: String, fullName: String? = nil, teamNumber: Int? = nil,
        emailOptIn: Bool = false, ref: String? = nil, via: String? = nil
    ) async throws -> SignUpOutcome {
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let username = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard email.contains("@"), email.count >= 3 else { throw fail(.validation("Enter a real email address.")) }
        guard password.count >= 8 else { throw fail(.validation(Self.passwordRule)) }
        guard Self.isPlausibleUsername(username) else {
            throw fail(.validation(Self.signUpUsernameRule))
        }
        if let teamNumber, !(1...99_999).contains(teamNumber) {
            throw fail(.validation(Self.teamNumberRule))
        }
        guard let api else { throw fail(.network) }
        isWorking = true
        defer { isWorking = false }
        do {
            let name = fullName?.trimmingCharacters(in: .whitespacesAndNewlines)
            let outcome = try await api.signUp(SignUpRequest(
                email: email, password: password, username: username,
                fullName: (name?.isEmpty ?? true) ? nil : name,
                teamNumber: teamNumber, emailOptIn: emailOptIn, ref: ref, via: via
            ))
            lastError = nil
            return outcome
        } catch {
            throw fail(APIError.from(error))
        }
    }

    /// Signs this device out. Guest reading carries on.
    func signOut() async {
        isWorking = true
        defer { isWorking = false }
        await supabase?.signOut()
        await becomeGuest()
    }

    /// Deletes the account on learnfrc.com (App Store 5.1.1(v)), then signs out here.
    func deleteAccount() async throws {
        guard let api else { throw fail(.network) }
        let userID = activeUserID ?? self.userID
        isWorking = true
        defer { isWorking = false }
        do {
            try await api.deleteAccount()
        } catch {
            throw fail(APIError.from(error))
        }
        activeUserID = nil
        freshMeUserID = nil
        await supabase?.signOut()
        await cache.removePersonalFiles()
        if let userID { notify(.deleted(userID: userID)) }
        await becomeGuest()
    }

    // MARK: Profile

    /// Re-reads `/api/app/me`. Keeps the cached copy when offline. Throttled to once
    /// every 20 seconds unless forced.
    func refreshMe(force: Bool = false) async {
        guard let requestedFor = userID, let api else { return }
        if !force, let lastMeRefresh, Date.now.timeIntervalSince(lastMeRefresh) < 20 { return }
        lastMeRefresh = .now
        do {
            let fresh = try await api.me()
            // The answer only counts if the same account is still signed in: a reply that
            // lands after sign-out (or after another account signed in) is dropped, so it
            // can't sign the app back in or rewrite me.json.
            guard fresh.user.id == requestedFor, userID == requestedFor else { return }
            state = .signedIn(fresh)
            freshMeUserID = fresh.user.id
            lastError = nil
            await cache.save(fresh, to: .me)
        } catch {
            let error = APIError.from(error)
            if error != .network { lastError = error }
            Log.auth.info("Couldn't refresh /me: \(error.message, privacy: .public)")
        }
    }

    /// `PATCH /api/app/profile` (full name, bio, avatar URL, username, team number, role).
    @discardableResult
    func updateProfile(_ update: ProfileUpdate) async throws -> Profile {
        guard let me else { throw fail(.unauthorized) }
        guard let api else { throw fail(.network) }
        if let username = update.username, !Self.isPlausibleUsername(username.lowercased()) {
            throw fail(.validation(Self.usernameRule))
        }
        if case .set(let number) = update.teamNumber, !(1...99_999).contains(number) {
            throw fail(.validation(Self.teamNumberRule))
        }
        guard !update.isEmpty else { return me.profile }
        isWorking = true
        defer { isWorking = false }
        do {
            let profile = try await api.updateProfile(update)
            apply(profile: profile)
            Task { await self.refreshMe(force: true) }
            return profile
        } catch {
            throw fail(APIError.from(error))
        }
    }

    /// Convenience for settings forms. Pass `teamNumber: .remove` to clear it.
    @discardableResult
    func updateProfile(
        fullName: String? = nil, bio: String? = nil, avatarURL: String? = nil, username: String? = nil,
        teamNumber: ProfileUpdate.TeamNumberChange? = nil, role: ProfileRole? = nil
    ) async throws -> Profile {
        try await updateProfile(ProfileUpdate(
            fullName: fullName, bio: bio, avatarURL: avatarURL, username: username, teamNumber: teamNumber, role: role
        ))
    }

    /// The username gate: `POST /api/app/profile/setup`.
    func setupUsername(_ username: String, teamNumber: Int? = nil) async throws {
        let username = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard Self.isPlausibleUsername(username) else {
            throw fail(.validation(Self.usernameRule))
        }
        if let teamNumber, !(1...99_999).contains(teamNumber) {
            throw fail(.validation(Self.teamNumberRule))
        }
        guard isSignedIn else { throw fail(.unauthorized) }
        guard let api else { throw fail(.network) }
        isWorking = true
        defer { isWorking = false }
        do {
            let profile = try await api.setupProfile(username: username, teamNumber: teamNumber)
            apply(profile: profile)
            await refreshMe(force: true)
        } catch {
            throw fail(APIError.from(error))
        }
    }

    /// The team-only ask (`profileSetupAsk == .teamNumber`, the site's card in `team` mode):
    /// `POST /api/app/profile/setup` with just the team number, through the same function as
    /// the site's card. That route never touches a handle the person chose.
    func setupTeamNumber(_ teamNumber: Int) async throws {
        guard (1...99_999).contains(teamNumber) else { throw fail(.validation(Self.teamNumberRule)) }
        guard isSignedIn else { throw fail(.unauthorized) }
        guard let api else { throw fail(.network) }
        isWorking = true
        defer { isWorking = false }
        do {
            let profile = try await api.setupProfile(username: nil, teamNumber: teamNumber)
            apply(profile: profile)
            await refreshMe(force: true)
        } catch {
            throw fail(APIError.from(error))
        }
    }

    /// Reminder emails on or off (`POST /api/app/email-opt-in`). Also answers the one-time prompt.
    func setEmailOptIn(_ optIn: Bool) async throws {
        guard let me else { throw fail(.unauthorized) }
        guard let api else { throw fail(.network) }
        isWorking = true
        defer { isWorking = false }
        do {
            let result = try await api.setEmailOptIn(optIn)
            // Signed out (or someone else signed in) while that ran: nothing to update here.
            guard let current = self.me, current.user.id == me.user.id else { return }
            let updated = current.answeringEmailPrompt(optIn: result.optIn, at: result.emailChoiceAt)
            state = .signedIn(updated)
            lastError = nil
            await cache.save(updated, to: .me)
        } catch {
            throw fail(APIError.from(error))
        }
    }

    // MARK: Passwords and email

    /// Emails a reset link. The reset itself finishes on learnfrc.com.
    func resetPassword(email: String) async throws {
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard email.contains("@") else { throw fail(.validation("Enter the email you signed up with.")) }
        guard let supabase else { throw fail(.network) }
        isWorking = true
        defer { isWorking = false }
        do {
            try await supabase.resetPassword(email: email)
        } catch {
            throw fail(APIError.from(error))
        }
    }

    func changePassword(_ newPassword: String) async throws {
        guard newPassword.count >= 8 else { throw fail(.validation(Self.passwordRule)) }
        guard isSignedIn else { throw fail(.unauthorized) }
        guard let supabase else { throw fail(.network) }
        isWorking = true
        defer { isWorking = false }
        do {
            try await supabase.changePassword(newPassword)
        } catch {
            throw fail(APIError.from(error))
        }
    }

    func resendConfirmation(email: String) async throws {
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard email.contains("@") else { throw fail(.validation("Enter the email you signed up with.")) }
        guard let supabase else { throw fail(.network) }
        isWorking = true
        defer { isWorking = false }
        do {
            try await supabase.resendConfirmation(email: email)
        } catch {
            throw fail(APIError.from(error))
        }
    }

    // MARK: Helpers

    /// The website's sentences for its own rules, word for word (`src/lib/app/accounts.ts`
    /// for sign-up, `src/lib/app/profile.ts` for profile edits and the username gate).
    static let signUpUsernameRule = "Choose a username: at least 3 characters (letters, numbers, _)."
    static let usernameRule = "Username must be at least 3 characters (a\u{2013}z, 0\u{2013}9, _)."
    static let passwordRule = "Password must be at least 8 characters."
    static let teamNumberRule = "Enter a valid FRC team number."

    /// The site's rule after normalising: lowercase `[a-z0-9_]`, at least 3 characters.
    /// The server has the final word (uniqueness, profanity, ban list).
    static func isPlausibleUsername(_ username: String) -> Bool {
        username.count >= 3 && username.count <= 32 && username.allSatisfy { ("a"..."z").contains($0) || ("0"..."9").contains($0) || $0 == "_" }
    }

    /// What the site does to a typed username: lowercase, drop anything outside `[a-z0-9_]`.
    static func normalizeUsername(_ raw: String) -> String {
        String(raw.lowercased().filter { ("a"..."z").contains($0) || ("0"..."9").contains($0) || $0 == "_" })
    }

    private func apply(profile: Profile) {
        // Only onto the account the profile belongs to (a reply can land after sign-out).
        guard let me, profile.id == me.user.id else { return }
        let updated = me.replacing(profile: profile)
        state = .signedIn(updated)
        lastError = nil
        Task { await cache.save(updated, to: .me) }
    }

    private func fail(_ error: APIError) -> APIError {
        lastError = error
        return error
    }

    // MARK: Previews

    /// Sets the state directly (previews and the design gallery only).
    func setPreviewState(_ state: AccountState) {
        self.state = state
        if case .signedIn(let me) = state {
            activeUserID = me.user.id
            freshMeUserID = me.isProvisional ? nil : me.user.id
        } else {
            activeUserID = nil
            freshMeUserID = nil
        }
    }
}
