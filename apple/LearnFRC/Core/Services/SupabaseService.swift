import AuthenticationServices
import Foundation
import Supabase

/// The app's one `SupabaseClient`, wrapped. Sendable and safe to call from any actor.
///
/// Reads the public catalog straight from PostgREST (RLS allows anyone to read
/// departments, modules, lessons, articles, achievements) and does the signed-in
/// user's own bookmarks directly (RLS `bm_*_own`). It never writes
/// `lesson_progress` or `user_achievements`: completions go through
/// `/api/app/progress/complete` so the quiz gate, XP and badges stay on the server.
///
/// The auth session lives in the Keychain (supabase-swift's default storage).
final class SupabaseService: Sendable {
    static let shared = SupabaseService()

    let client: SupabaseClient

    init(url: URL = AppConfig.supabaseURL, key: String = AppConfig.supabasePublishableKey) {
        client = SupabaseClient(
            supabaseURL: url,
            supabaseKey: key,
            options: SupabaseClientOptions(
                auth: .init(
                    // Continue with Google comes back with a one-time code that only this
                    // device can trade for a session (the verifier never leaves it).
                    flowType: .pkce,
                    // Show the stored session immediately at launch (offline friendly);
                    // the client refreshes it in the background.
                    emitLocalSessionAsInitialSession: true
                ),
                global: .init(headers: ["X-Client-Info": "learnfrc-apple/\(AppConfig.appVersion)"])
            )
        )
    }

    var auth: AuthClient { client.auth }

    // MARK: Catalog (public reads)

    /// Departments with modules and lesson summaries, in one embedded select, sorted like the site.
    func catalog() async throws -> [Department] {
        do {
            let response = try await client
                .from("departments")
                .select(SupabaseQueries.catalogSelect)
                .order("sort_order")
                .execute()
            let departments = try JSONCoding.decode(LossyArray<Department>.self, from: response.data, context: "catalog").elements
            return departments.sorted { $0.sortOrder < $1.sortOrder }
        } catch {
            throw logged(error, "catalog")
        }
    }

    /// Every lesson body. One request today (394 rows), paged so the 1000-row cap can never truncate it.
    func lessonBodies() async throws -> [LessonBody] {
        do {
            var all: [LessonBody] = []
            var from = 0
            while true {
                let response = try await client
                    .from("lessons")
                    .select(SupabaseQueries.lessonBodySelect)
                    .order("id")
                    .range(from: from, to: from + SupabaseQueries.pageSize - 1)
                    .execute()
                let page = try JSONCoding.decode(LossyArray<LessonBody>.self, from: response.data, context: "lessons")
                all.append(contentsOf: page.elements)
                // Count raw rows, not decoded ones, so a skipped bad row can't end paging early.
                let rawCount = (try? JSONSerialization.jsonObject(with: response.data) as? [Any])?.count ?? page.elements.count
                if rawCount < SupabaseQueries.pageSize { break }
                from += SupabaseQueries.pageSize
            }
            return all
        } catch {
            throw logged(error, "lessonBodies")
        }
    }

    /// One lesson body, for a lesson opened before the full set has downloaded.
    func lessonBody(id: UUID) async throws -> LessonBody? {
        do {
            let response = try await client
                .from("lessons")
                .select(SupabaseQueries.lessonBodySelect)
                .eq("id", value: id.uuidString.lowercased())
                .limit(1)
                .execute()
            return try JSONCoding.decode(LossyArray<LessonBody>.self, from: response.data, context: "lesson \(id)").elements.first
        } catch {
            throw logged(error, "lessonBody")
        }
    }

    /// Articles, newest first (the site's `date desc, sort_order asc`).
    func articles() async throws -> [Article] {
        do {
            let response = try await client
                .from("articles")
                .select(SupabaseQueries.articleSelect)
                .order("date", ascending: false)
                .order("sort_order")
                .range(from: 0, to: SupabaseQueries.pageSize - 1)
                .execute()
            return Article.sortedLikeSite(try JSONCoding.decode(LossyArray<Article>.self, from: response.data, context: "articles").elements)
        } catch {
            throw logged(error, "articles")
        }
    }

    /// The badge catalog.
    func achievements() async throws -> [Achievement] {
        do {
            let response = try await client
                .from("achievements")
                .select(SupabaseQueries.achievementSelect)
                .order("sort_order")
                .execute()
            return try JSONCoding.decode(LossyArray<Achievement>.self, from: response.data, context: "achievements").elements
                .sorted { $0.sortOrder < $1.sortOrder }
        } catch {
            throw logged(error, "achievements")
        }
    }

    // MARK: Own completions (read only, RLS lp_select_own)

    /// The signed-in user's completion rows, read directly. Only a fallback for when
    /// `/api/app/me/progress` is unreachable; it has no XP total, rhythm or badges.
    func ownCompletions() async throws -> [Completion] {
        let userID = try await signedInUserID()
        do {
            var all: [Completion] = []
            var from = 0
            while true {
                let response = try await client
                    .from("lesson_progress")
                    .select("lesson_id,completed_at,xp_awarded")
                    .eq("user_id", value: userID.uuidString.lowercased())
                    .order("completed_at")
                    .range(from: from, to: from + SupabaseQueries.pageSize - 1)
                    .execute()
                let page = try JSONCoding.decode(LossyArray<Completion>.self, from: response.data, context: "lesson_progress").elements
                all.append(contentsOf: page)
                if page.count < SupabaseQueries.pageSize { break }
                from += SupabaseQueries.pageSize
            }
            return all
        } catch {
            throw logged(error, "ownCompletions")
        }
    }

    // MARK: Bookmarks (signed-in user's own rows, RLS bm_*_own)

    func bookmarks() async throws -> [Bookmark] {
        let userID = try await signedInUserID()
        do {
            var all: [Bookmark] = []
            var from = 0
            while true {
                let response = try await client
                    .from("bookmarks")
                    .select(SupabaseQueries.bookmarkSelect)
                    .eq("user_id", value: userID.uuidString.lowercased())
                    .order("created_at")
                    .range(from: from, to: from + SupabaseQueries.pageSize - 1)
                    .execute()
                let page = try JSONCoding.decode(LossyArray<Bookmark>.self, from: response.data, context: "bookmarks").elements
                all.append(contentsOf: page)
                if page.count < SupabaseQueries.pageSize { break }
                from += SupabaseQueries.pageSize
            }
            return all
        } catch {
            throw logged(error, "bookmarks")
        }
    }

    func addBookmark(lessonID: UUID) async throws {
        let userID = try await signedInUserID()
        struct Row: Encodable { let user_id: String; let lesson_id: String }
        do {
            try await client
                .from("bookmarks")
                .upsert(
                    Row(user_id: userID.uuidString.lowercased(), lesson_id: lessonID.uuidString.lowercased()),
                    onConflict: "user_id,lesson_id",
                    returning: .minimal,
                    ignoreDuplicates: true
                )
                .execute()
        } catch {
            throw logged(error, "addBookmark")
        }
    }

    func removeBookmark(lessonID: UUID) async throws {
        let userID = try await signedInUserID()
        do {
            try await client
                .from("bookmarks")
                .delete(returning: .minimal)
                .eq("user_id", value: userID.uuidString.lowercased())
                .eq("lesson_id", value: lessonID.uuidString.lowercased())
                .execute()
        } catch {
            throw logged(error, "removeBookmark")
        }
    }

    // MARK: Auth

    /// The stored session, possibly expired. No network.
    var currentSession: Session? { client.auth.currentSession }

    /// A valid access token, refreshing first if the stored one has expired.
    func validAccessToken() async throws -> String {
        do {
            return try await client.auth.session.accessToken
        } catch {
            throw APIError.from(error)
        }
    }

    /// Forces a refresh (after a 401 from the website).
    func refreshedAccessToken() async throws -> String {
        do {
            return try await client.auth.refreshSession().accessToken
        } catch {
            throw APIError.from(error)
        }
    }

    func signIn(email: String, password: String) async throws -> Session {
        do {
            return try await client.auth.signIn(email: email, password: password)
        } catch {
            throw APIError.from(error)
        }
    }

    /// Installs a session minted by `POST /api/app/auth/sign-in`.
    func setSession(_ tokens: SessionTokens) async throws -> Session {
        do {
            return try await client.auth.setSession(accessToken: tokens.accessToken, refreshToken: tokens.refreshToken)
        } catch {
            throw APIError.from(error)
        }
    }

    /// Signs in through a third-party provider (Google today), with PKCE.
    ///
    /// `present` opens Supabase's authorize URL in the system web sign-in sheet
    /// (`ASWebAuthenticationSession`) and returns the `learnfrc://auth-callback` URL the flow
    /// ends on; supabase-swift then trades the code in it for a session (`session(from:)`),
    /// stores it in the Keychain and emits `.signedIn`. nil when the person closed the sheet
    /// or turned Google down: that's a choice, not a failure, so nothing is shown.
    func signInWithOAuth(
        _ provider: Provider,
        present: @MainActor @Sendable (_ url: URL) async throws -> URL
    ) async throws -> Session? {
        do {
            return try await client.auth.signInWithOAuth(
                provider: provider,
                redirectTo: AppConfig.oauthCallbackURL,
                launchFlow: present
            )
        } catch {
            switch OAuthFailure(error) {
            case .cancelled:
                return nil
            case .couldNotStart:
                Log.auth.error("OAuth sign-in didn't start: \(String(describing: error), privacy: .public)")
                // The site's own sentence when its Google button can't get going.
                throw APIError.validation("Couldn't start Google sign-in. Use email instead.")
            case .notEnabled:
                // The site's sentence for a provider switched off in Supabase.
                throw APIError.validation("Google sign-in isn't set up yet, use email for now.")
            case .couldNotFinish:
                Log.auth.error("OAuth sign-in didn't finish: \(String(describing: error), privacy: .public)")
                throw APIError.validation("Couldn't finish signing in with Google. Try again, or use email instead.")
            case .other(let mapped):
                throw mapped
            }
        }
    }

    /// Signs this device out (the website's sessions are separate and stay signed in).
    func signOut() async {
        do {
            try await client.auth.signOut(scope: .local)
        } catch {
            Log.auth.error("Sign out: \(String(describing: error), privacy: .public)")
        }
    }

    /// Emails a reset link; the reset finishes on learnfrc.com.
    func resetPassword(email: String) async throws {
        do {
            try await client.auth.resetPasswordForEmail(email)
        } catch {
            throw APIError.from(error)
        }
    }

    func changePassword(_ newPassword: String) async throws {
        do {
            try await client.auth.update(user: UserAttributes(password: newPassword))
        } catch {
            throw APIError.from(error)
        }
    }

    func resendConfirmation(email: String) async throws {
        do {
            try await client.auth.resend(email: email, type: .signup)
        } catch {
            throw APIError.from(error)
        }
    }

    /// Auth events (`.initialSession` first). Iterate on the main actor.
    var authStateChanges: AsyncStream<(event: AuthChangeEvent, session: Session?)> {
        client.auth.authStateChanges
    }

    private func signedInUserID() async throws -> UUID {
        if let session = client.auth.currentSession { return session.user.id }
        throw APIError.unauthorized
    }

    private func logged(_ error: any Error, _ what: String) -> APIError {
        let mapped = APIError.from(error)
        if mapped != .network {
            Log.network.error("Supabase \(what, privacy: .public) failed: \(String(describing: error), privacy: .public)")
        }
        return mapped
    }
}

/// Why an OAuth sign-in ended without a session, in the terms the sign-in screens need.
private enum OAuthFailure {
    /// The person closed the sheet, pressed Cancel on the system's "wants to use ... to sign
    /// in" prompt, or turned Google down on its consent page. Silent.
    case cancelled
    /// The sheet couldn't be shown.
    case couldNotStart
    /// Google is switched off in the Supabase project.
    case notEnabled
    /// Supabase sent back an error, or the code couldn't be traded for a session.
    case couldNotFinish
    /// Offline or rate limited: the data layer's own sentence fits.
    case other(APIError)

    init(_ error: any Error) {
        if error is CancellationError {
            self = .cancelled
            return
        }
        if let error = error as? ASWebAuthenticationSessionError {
            self = error.code == .canceledLogin ? .cancelled : .couldNotStart
            return
        }
        // Supabase's error on the callback URL (`?error=access_denied&error_description=...`).
        if case .pkceGrantCodeExchange(let message, let oauthError, _)? = error as? AuthError {
            if oauthError == "access_denied" {
                self = .cancelled
            } else if message.localizedCaseInsensitiveContains("not enabled") {
                self = .notEnabled
            } else {
                self = .couldNotFinish
            }
            return
        }
        switch APIError.from(error) {
        case .network: self = .other(.network)
        case .rateLimited(let retryAfter): self = .other(.rateLimited(retryAfter: retryAfter))
        default: self = .couldNotFinish
        }
    }
}
