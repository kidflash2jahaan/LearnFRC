import Foundation

/// Calls the website's `/api/app/*` routes (and the existing guest-progress route).
///
/// Per-user routes get `Authorization: Bearer <access token>` from the current
/// Supabase session, refreshed first when it has expired, and retried once with a
/// fresh token after a 401. Errors come back as `APIError` with the site's own sentence.
final class APIClient: Sendable {
    static let shared = APIClient()

    let base: URL
    private let supabase: SupabaseService
    private let session: URLSession

    init(base: URL = AppConfig.apiBase, supabase: SupabaseService = .shared, session: URLSession? = nil) {
        self.base = base
        self.supabase = supabase
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = 20
            configuration.timeoutIntervalForResource = 60
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            configuration.waitsForConnectivity = false
            self.session = URLSession(configuration: configuration)
        }
    }

    // MARK: Public routes

    /// `GET /api/app/reference`
    func reference() async throws -> Reference {
        try await send("GET", "/api/app/reference", auth: false)
    }

    /// `GET /api/app/leaderboard?board=`
    func leaderboard(_ board: LeaderboardBoard) async throws -> LeaderboardPayload {
        try await send("GET", "/api/app/leaderboard", query: ["board": board.rawValue], auth: false)
    }

    /// `GET /api/app/u/{username}`. nil when there's no such person.
    func publicProfile(username: String) async throws -> PublicProfile? {
        let name = username.trimmingCharacters(in: .whitespaces).lowercased()
        guard !name.isEmpty, let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else { return nil }
        do {
            return try await send("GET", "/api/app/u/\(encoded)", auth: false, notFoundIsNil: true)
        } catch let error as NotFound {
            _ = error
            return nil
        }
    }

    // MARK: Auth routes

    /// `POST /api/app/auth/sign-in` (username or email + password). Install the result with `setSession`.
    func signIn(identifier: String, password: String) async throws -> SessionTokens {
        struct Body: Encodable { let identifier: String; let password: String }
        return try await send("POST", "/api/app/auth/sign-in", body: Body(identifier: identifier, password: password), auth: false)
    }

    /// `POST /api/app/auth/sign-up`
    func signUp(_ request: SignUpRequest) async throws -> SignUpOutcome {
        struct Response: Decodable {
            let status: String?
        }
        let response: Response = try await send("POST", "/api/app/auth/sign-up", body: request, auth: false)
        switch response.status {
        case "exists": return .exists
        default: return .confirmEmail
        }
    }

    // MARK: Signed-in routes

    /// `GET /api/app/me`
    func me() async throws -> Me {
        try await send("GET", "/api/app/me")
    }

    /// `GET /api/app/me/progress`
    func progress() async throws -> ProgressSnapshot {
        try await send("GET", "/api/app/me/progress")
    }

    /// `POST /api/app/progress/complete`. The server re-grades the answers.
    func complete(lessonID: UUID, answers: [Int]) async throws -> CompletionResult {
        struct Body: Encodable { let lessonId: String; let answers: [Int] }
        var result: CompletionResult = try await send(
            "POST", "/api/app/progress/complete",
            body: Body(lessonId: lessonID.uuidString.lowercased(), answers: answers)
        )
        result.delivery = .server
        return result
    }

    /// `DELETE /api/app/progress/complete?lessonId=`
    func uncomplete(lessonID: UUID) async throws -> UncompleteResult {
        try await send("DELETE", "/api/app/progress/complete", query: ["lessonId": lessonID.uuidString.lowercased()])
    }

    /// `PATCH /api/app/profile`
    func updateProfile(_ update: ProfileUpdate) async throws -> Profile {
        try await send("PATCH", "/api/app/profile", body: update)
    }

    /// `POST /api/app/profile/setup`
    func setupProfile(username: String?, teamNumber: Int?) async throws -> Profile {
        struct Body: Encodable { let username: String?; let teamNumber: Int? }
        return try await send("POST", "/api/app/profile/setup", body: Body(username: username, teamNumber: teamNumber))
    }

    /// `POST /api/app/email-opt-in`
    func setEmailOptIn(_ optIn: Bool) async throws -> EmailOptInResult {
        struct Body: Encodable { let optIn: Bool }
        return try await send("POST", "/api/app/email-opt-in", body: Body(optIn: optIn))
    }

    /// `GET /api/app/team`. nil when I have no team number.
    func team() async throws -> Team? {
        let payload: TeamPayload = try await send("GET", "/api/app/team")
        return payload.team
    }

    /// `POST /api/app/migrate-guest`. Returns how many lessons moved into the account.
    func migrateGuest(visitorID: String) async throws -> Int {
        struct Body: Encodable { let visitorId: String }
        struct Response: Decodable {
            let migrated: Int
            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                migrated = c.flexibleInt(forKey: AnyCodingKey("migrated")) ?? 0
            }
        }
        let response: Response = try await send("POST", "/api/app/migrate-guest", body: Body(visitorId: visitorID))
        return response.migrated
    }

    /// `DELETE /api/app/account`
    func deleteAccount() async throws {
        let _: OKResponse = try await send("DELETE", "/api/app/account")
    }

    // MARK: Guest progress (the site's existing anonymous route)

    /// `POST /api/guest-progress` with `complete: true`. The server re-grades the quiz.
    func guestComplete(visitorID: String, lessonID: UUID, answers: [Int]?) async throws {
        struct Body: Encodable { let visitorId: String; let lessonId: String; let complete: Bool; let answers: [Int]? }
        let _: OKResponse = try await send(
            "POST", "/api/guest-progress",
            body: Body(visitorId: visitorID, lessonId: lessonID.uuidString.lowercased(), complete: true, answers: answers),
            auth: false
        )
    }

    /// `POST /api/guest-progress` with `complete: false`.
    func guestUncomplete(visitorID: String, lessonID: UUID) async throws {
        struct Body: Encodable { let visitorId: String; let lessonId: String; let complete: Bool }
        let _: OKResponse = try await send(
            "POST", "/api/guest-progress",
            body: Body(visitorId: visitorID, lessonId: lessonID.uuidString.lowercased(), complete: false),
            auth: false
        )
    }

    /// `GET /api/guest-progress?visitorId=`: the lessons the server holds for this visitor.
    func guestLessons(visitorID: String) async throws -> [UUID] {
        struct Response: Decodable {
            let lessonIds: [String]
            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                lessonIds = c.stringArray(forKey: AnyCodingKey("lessonIds"))
            }
        }
        let response: Response = try await send("GET", "/api/guest-progress", query: ["visitorId": visitorID], auth: false)
        return response.lessonIds.compactMap(UUID.init(uuidString:))
    }

    // MARK: Transport

    private struct OKResponse: Decodable {
        init(from decoder: any Decoder) throws {}
    }

    private struct NotFound: Error {}

    private struct Empty: Encodable {}

    private func send<Response: Decodable>(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        auth: Bool = true,
        notFoundIsNil: Bool = false
    ) async throws -> Response {
        try await send(method, path, query: query, body: Optional<Empty>.none, auth: auth, notFoundIsNil: notFoundIsNil)
    }

    private func send<Body: Encodable, Response: Decodable>(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        body: Body?,
        auth: Bool = true,
        notFoundIsNil: Bool = false
    ) async throws -> Response {
        var token: String?
        if auth { token = try await supabase.validAccessToken() }

        var (data, response) = try await perform(method, path, query: query, body: body, token: token)
        if auth, response.statusCode == 401 {
            // One retry with a freshly refreshed token.
            token = try await supabase.refreshedAccessToken()
            (data, response) = try await perform(method, path, query: query, body: body, token: token)
        }

        guard (200..<300).contains(response.statusCode) else {
            if notFoundIsNil, response.statusCode == 404 { throw NotFound() }
            let error = APIError.from(status: response.statusCode, data: data, headers: response, authenticated: auth)
            if error != .unauthorized {
                Log.network.error("\(method, privacy: .public) \(path, privacy: .public) -> \(response.statusCode): \(error.message, privacy: .public)")
            }
            throw error
        }

        if Response.self == OKResponse.self || data.isEmpty {
            if let empty = try? JSONCoding.decoder().decode(Response.self, from: Data("{}".utf8)) { return empty }
        }
        do {
            return try JSONCoding.decode(Response.self, from: data, context: "\(method) \(path)")
        } catch {
            throw APIError.server
        }
    }

    private func perform<Body: Encodable>(
        _ method: String,
        _ path: String,
        query: [String: String],
        body: Body?,
        token: String?
    ) async throws -> (Data, HTTPURLResponse) {
        var components = URLComponents(url: base.appending(path: path), resolvingAgainstBaseURL: false)
        if !query.isEmpty {
            components?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw APIError.server }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("learnfrc-apple/\(AppConfig.appVersion)", forHTTPHeaderField: "X-Client-Info")
        // "iOS app" / "Mac app": lets the sign-up route record the source without guessing.
        request.setValue(AppConfig.platformSource, forHTTPHeaderField: "X-LearnFRC-Client")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONCoding.encoder().encode(body)
        }

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw APIError.server }
            return (data, http)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.from(error)
        }
    }
}
