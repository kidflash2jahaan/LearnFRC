import Foundation
import Supabase

/// Every failure the data layer reports, already worded for people.
enum APIError: Error, LocalizedError, Hashable, Sendable {
    /// Not signed in, or the session expired and couldn't be refreshed. Only for calls made
    /// with a session: a refused sign-in is `.validation` with the site's sentence.
    case unauthorized
    /// Too many requests. `retryAfter` is in seconds when the site said.
    case rateLimited(retryAfter: TimeInterval?)
    /// The request was understood and refused; the message is the site's own sentence.
    case validation(String)
    /// Couldn't reach the server (offline, timed out, DNS).
    case network
    /// The server failed or answered with something unreadable.
    case server

    var errorDescription: String? { message }

    /// A plain sentence to show in the UI.
    var message: String {
        switch self {
        case .unauthorized:
            "You're signed out. Sign in again to keep going."
        case .rateLimited(let retryAfter):
            if let retryAfter, retryAfter > 0, retryAfter < 120 {
                "That's a lot of requests in a row. Try again in \(Int(retryAfter.rounded(.up))) seconds."
            } else {
                "That's a lot of requests in a row. Give it a minute and try again."
            }
        case .validation(let message):
            message
        case .network:
            "Can't reach learnfrc.com right now. Check your connection and try again."
        case .server:
            "Something went wrong on learnfrc.com. Try again in a moment."
        }
    }

    /// Worth retrying later without the person doing anything (offline, busy, server blip).
    var isTransient: Bool {
        switch self {
        case .network, .server, .rateLimited: true
        case .unauthorized, .validation: false
        }
    }

    /// Maps any error from URLSession, supabase-swift or decoding to an APIError.
    static func from(_ error: any Error) -> APIError {
        if let error = error as? APIError { return error }
        if error is CancellationError { return .network }
        if let error = error as? URLError { return from(urlError: error) }
        if let error = error as? AuthError { return from(authError: error) }
        if let error = error as? PostgrestError {
            Log.network.error("PostgREST \(error.code ?? "?", privacy: .public): \(error.message, privacy: .public)")
            if error.code == "PGRST301" || error.code == "PGRST302" { return .unauthorized }
            if error.code == "42501" { return .unauthorized }
            return .server
        }
        if let error = error as? HTTPError {
            return from(status: error.response.statusCode, data: error.data, headers: error.response)
        }
        if error is DecodingError {
            Log.decode.error("\(JSONCoding.describe(error), privacy: .public)")
            return .server
        }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain { return .network }
        Log.network.error("Unexpected error: \(String(describing: error), privacy: .public)")
        return .server
    }

    static func from(urlError: URLError) -> APIError {
        switch urlError.code {
        case .userAuthenticationRequired: .unauthorized
        case .badServerResponse, .cannotParseResponse, .cannotDecodeContentData, .cannotDecodeRawData: .server
        default: .network
        }
    }

    /// Supabase Auth errors, worded for sign-in and account screens.
    static func from(authError: AuthError) -> APIError {
        switch authError {
        case .sessionMissing:
            return .unauthorized
        case .weakPassword(let message, _):
            return .validation(message.isEmpty ? "Pick a longer password (at least 8 characters)." : message)
        case .api(let message, let code, let data, let response):
            switch code {
            case .invalidCredentials:
                // Word for word what learnfrc.com's sign-in form shows (Supabase's own sentence).
                return .validation(message.isEmpty ? "Invalid login credentials" : message)
            case .emailNotConfirmed:
                return .validation("Confirm your email first. The link is in the email we sent when you signed up.")
            case .samePassword:
                return .validation("That's already your password. Pick a new one.")
            case .weakPassword:
                return .validation("Pick a longer password (at least 8 characters).")
            case .userBanned:
                return .validation("This account can't sign in right now.")
            case .overRequestRateLimit, .overEmailSendRateLimit:
                return .rateLimited(retryAfter: retryAfter(from: response))
            case .sessionNotFound, .refreshTokenNotFound, .badJWT:
                return .unauthorized
            default:
                if response.statusCode == 429 { return .rateLimited(retryAfter: retryAfter(from: response)) }
                if response.statusCode == 401 || response.statusCode == 403 { return .unauthorized }
                if response.statusCode >= 500 { return .server }
                _ = data
                return .validation(message.isEmpty ? "That didn't work. Check the details and try again." : message)
            }
        default:
            return .server
        }
    }

    /// The website's routes: status plus `{ error, code }`.
    ///
    /// - Parameter authenticated: the request carried the person's session. A 401 then means
    ///   the session was rejected ("You're signed out"). Without one (sign-in, sign-up), a 401
    ///   is the answer itself, like "Invalid login credentials" or "No account found with that
    ///   username.", and its sentence is shown as the site wrote it.
    static func from(status: Int, data: Data, headers: HTTPURLResponse?, authenticated: Bool = true) -> APIError {
        let body = try? JSONCoding.decoder().decode(APIErrorBody.self, from: data)
        let message = body?.error.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        switch (status, body?.code) {
        case (_, "unauthorized"), (401, _):
            guard authenticated else {
                return .validation(message.isEmpty ? "Couldn't sign you in. Try again." : message)
            }
            return .unauthorized
        case (_, "rate_limited"), (429, _):
            return .rateLimited(retryAfter: headers.flatMap(retryAfter(from:)))
        case (500..., _), (_, "server"):
            return .server
        default:
            if !message.isEmpty { return .validation(message) }
            switch status {
            case 403: return .unauthorized
            // A bare 404 means the route itself is missing (an older or newer site), not bad input.
            case 404: return .server
            case 409: return .validation("That's already taken.")
            case 400, 422: return .validation("That didn't work. Check the details and try again.")
            default: return .server
            }
        }
    }

    static func retryAfter(from response: HTTPURLResponse) -> TimeInterval? {
        guard let value = response.value(forHTTPHeaderField: "Retry-After")?.trimmingCharacters(in: .whitespaces) else { return nil }
        if let seconds = TimeInterval(value) { return max(0, seconds) }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        return formatter.date(from: value).map { max(0, $0.timeIntervalSinceNow) }
    }
}
