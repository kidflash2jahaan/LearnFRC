import Foundation

/// Calls the website's admin routes (`/api/app/admin/*`) and `/api/app/apply`.
///
/// Every call carries the signed-in person's Bearer token, refreshed first when it has expired
/// and retried once after a 401, exactly like `APIClient`. The role is never sent: the server
/// reads it from the token on every call (`getSiteRole`), so a member who opens an admin screen
/// gets a 403 back (`AdminError.Kind.forbidden`), which the screen shows as its locked card
/// without signing anyone out.
///
/// Nothing here is cached and no request or response body is logged: feedback text and
/// application answers are people's words.
final class AdminAPI: Sendable {
    static let shared = AdminAPI()

    let base: URL
    private let supabase: SupabaseService
    private let session: URLSession

    init(base: URL = AppConfig.apiBase, supabase: SupabaseService = .shared, session: URLSession? = nil) {
        self.base = base
        self.supabase = supabase
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.timeoutIntervalForRequest = 25
            configuration.timeoutIntervalForResource = 60
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            configuration.urlCache = nil
            configuration.waitsForConnectivity = false
            self.session = URLSession(configuration: configuration)
        }
    }

    // MARK: Admin (admin or super admin)

    /// `GET /api/app/admin/summary`: the counts for the You tab's rows. A 403 means this account
    /// isn't an admin.
    func summary() async throws(AdminError) -> AdminSummary {
        try await send("GET", "/api/app/admin/summary")
    }

    /// `GET /api/app/admin/dashboard`: everything /admin prints.
    func dashboard() async throws(AdminError) -> AdminDashboard {
        try await send("GET", "/api/app/admin/dashboard")
    }

    /// `GET /api/app/admin/feedback?limit=`: the latest messages, newest first.
    func feedback(limit: Int = 40) async throws(AdminError) -> AdminFeedbackPage {
        try await send("GET", "/api/app/admin/feedback", query: ["limit": String(min(max(limit, 1), 100))])
    }

    /// `POST /api/app/admin/feedback/{id}/reply`: emails the sender from LearnFRC and marks the
    /// message replied. Returns the server's copy of the message.
    func reply(to feedbackID: UUID, text: String) async throws(AdminError) -> AdminFeedbackItem {
        struct Body: Encodable { let reply: String }
        struct Response: Decodable {
            let item: AdminFeedbackItem
        }
        let response: Response = try await send(
            "POST", "/api/app/admin/feedback/\(Self.pathID(feedbackID))/reply",
            body: Body(reply: text)
        )
        return response.item
    }

    /// `PUT /api/app/admin/lessons/{lessonId}/verified`: puts the public verified mark on a
    /// lesson, or takes it off. Returns the mark's new date (nil when removed).
    func setVerified(lessonID: UUID, verified: Bool) async throws(AdminError) -> Date? {
        struct Body: Encodable { let verified: Bool }
        let result: AdminVerifiedResult = try await send(
            "PUT", "/api/app/admin/lessons/\(Self.pathID(lessonID))/verified",
            body: Body(verified: verified)
        )
        return result.verifiedAt
    }

    // MARK: Team desk (super admin)

    /// `GET /api/app/admin/team`: applications, the team and the decided log.
    func teamDesk() async throws(AdminError) -> AdminTeamDesk {
        try await send("GET", "/api/app/admin/team")
    }

    /// `POST /api/app/admin/applications/{id}/decision`. The applicant gets an email either way,
    /// with `note` in it.
    func decide(applicationID: UUID, decision: AdminDecision, note: String?) async throws(AdminError) {
        struct Body: Encodable { let decision: String; let note: String? }
        let _: OK = try await send(
            "POST", "/api/app/admin/applications/\(Self.pathID(applicationID))/decision",
            body: Body(decision: decision.rawValue, note: note)
        )
    }

    /// `PATCH /api/app/admin/team/{userId}` with `admin` or `superadmin`.
    func setRole(userID: UUID, role: SiteRole) async throws(AdminError) {
        struct Body: Encodable { let role: String }
        let _: OK = try await send(
            "PATCH", "/api/app/admin/team/\(Self.pathID(userID))",
            body: Body(role: role == .superadmin ? "superadmin" : "admin")
        )
    }

    /// `DELETE /api/app/admin/team/{userId}`: off the team. Their account and progress stay.
    func removeFromTeam(userID: UUID) async throws(AdminError) {
        let _: OK = try await send("DELETE", "/api/app/admin/team/\(Self.pathID(userID))")
    }

    // MARK: Apply (any signed-in member)

    /// `GET /api/app/apply`
    func applyState() async throws(AdminError) -> AdminApplyState {
        try await send("GET", "/api/app/apply")
    }

    /// `POST /api/app/apply`
    func submitApplication(experience: String, why: String, availability: String?) async throws(AdminError) {
        struct Body: Encodable { let experience: String; let why: String; let availability: String? }
        let _: OK = try await send("POST", "/api/app/apply", body: Body(experience: experience, why: why, availability: availability))
    }

    /// `DELETE /api/app/apply`: pulls this account's pending application back.
    func withdrawApplication() async throws(AdminError) {
        let _: OK = try await send("DELETE", "/api/app/apply")
    }

    // MARK: Transport

    /// Any 2xx body (`{ ok: true }`).
    private struct OK: Decodable {
        init(from decoder: any Decoder) throws {}
    }

    private struct Empty: Encodable {}

    /// The site's error body: `{ error, code, field? }`.
    private struct ErrorBody: Decodable {
        let error: String?
        let code: String?
        let field: String?
    }

    /// Lowercase UUID, as the routes expect (they check it with `isUuid`).
    private static func pathID(_ id: UUID) -> String { id.uuidString.lowercased() }

    private func send<Response: Decodable>(
        _ method: String,
        _ path: String,
        query: [String: String] = [:]
    ) async throws(AdminError) -> Response {
        try await send(method, path, query: query, body: Optional<Empty>.none)
    }

    private func send<Body: Encodable, Response: Decodable>(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        body: Body?
    ) async throws(AdminError) -> Response {
        var token: String
        do {
            token = try await supabase.validAccessToken()
        } catch {
            throw Self.signedOutOrTransient(error)
        }

        var (data, response) = try await perform(method, path, query: query, body: body, token: token)
        if response.statusCode == 401 {
            do {
                token = try await supabase.refreshedAccessToken()
            } catch {
                throw Self.signedOutOrTransient(error)
            }
            (data, response) = try await perform(method, path, query: query, body: body, token: token)
        }

        guard (200..<300).contains(response.statusCode) else {
            let error = Self.error(status: response.statusCode, data: data, response: response)
            switch error.kind {
            case .forbidden, .notFound, .conflict, .validation:
                Log.network.info("\(method, privacy: .public) admin route -> \(response.statusCode) \(error.kind.rawValue, privacy: .public)")
            default:
                Log.network.error("\(method, privacy: .public) admin route \(path, privacy: .private) -> \(response.statusCode)")
            }
            throw error
        }

        if Response.self == OK.self || data.isEmpty {
            if let empty = try? JSONCoding.decoder().decode(Response.self, from: Data("{}".utf8)) { return empty }
        }
        do {
            return try JSONCoding.decode(Response.self, from: data, context: "\(method) admin route")
        } catch {
            throw AdminError.server
        }
    }

    private func perform<Body: Encodable>(
        _ method: String,
        _ path: String,
        query: [String: String],
        body: Body?,
        token: String
    ) async throws(AdminError) -> (Data, HTTPURLResponse) {
        var components = URLComponents(url: base.appending(path: path), resolvingAgainstBaseURL: false)
        if !query.isEmpty {
            components?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw AdminError.server }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        request.setValue("learnfrc-apple/\(AppConfig.appVersion)", forHTTPHeaderField: "X-Client-Info")
        request.setValue(AppConfig.platformSource, forHTTPHeaderField: "X-LearnFRC-Client")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            do {
                request.httpBody = try JSONCoding.encoder().encode(body)
            } catch {
                throw AdminError.server
            }
        }

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw AdminError.server }
            return (data, http)
        } catch {
            throw AdminError.wrapping(error)
        }
    }

    /// No session, or it couldn't be refreshed: signed out. Offline: say so instead.
    private static func signedOutOrTransient(_ error: any Error) -> AdminError {
        let wrapped = AdminError.wrapping(error)
        return wrapped.kind == .network ? wrapped : .unauthorized
    }

    /// The website's routes: status plus `{ error, code, field }`, mapped to the kinds the
    /// screens handle, keeping the site's sentence wherever it sent one.
    static func error(status: Int, data: Data, response: HTTPURLResponse?) -> AdminError {
        let body = try? JSONCoding.decoder().decode(ErrorBody.self, from: data)
        let message = body?.error?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let code = body?.code?.lowercased()
        let field = body?.field
        func say(_ fallback: String) -> String { message.isEmpty ? fallback : message }

        switch (status, code) {
        case (401, _), (_, "unauthorized"):
            return .unauthorized
        case (403, _), (_, "forbidden"):
            return AdminError(.forbidden, say(AdminError.adminOnly))
        case (429, _), (_, "rate_limited"):
            let retry = response.flatMap(APIError.retryAfter(from:))
            return AdminError(.rateLimited, say(APIError.rateLimited(retryAfter: retry).message))
        case (409, _), (_, "conflict"):
            return AdminError(.conflict, say("That changed while you were looking. Refresh and try again."), field: field)
        case (404, _), (_, "not_found"):
            // A bare 404 (Next's HTML page) means the route isn't on this site yet.
            if body == nil || (message.isEmpty && code == nil) { return .unavailable }
            return AdminError(.notFound, say("That's no longer there. Refresh and try again."), field: field)
        case (500..., _), (_, "server"):
            return AdminError(.server, say(APIError.server.message))
        case (400, _), (422, _), (_, "validation"):
            return AdminError(.validation, say("That didn't work. Check the details and try again."), field: field)
        default:
            return message.isEmpty ? .server : AdminError(.validation, message, field: field)
        }
    }
}
