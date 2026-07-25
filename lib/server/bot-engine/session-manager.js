"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const crypto_1 = require("crypto");
/**
 * SessionManager: Manages active bot sessions in memory.
 *
 * This class enforces the one-bot-per-user rule by maintaining two Maps:
 * 1. sessionId → BotEngine (primary storage)
 * 2. userId → sessionId (reverse index for user lookup)
 *
 * The SessionManager is implemented as a singleton/static class to ensure
 * a single source of truth for all active sessions across the application.
 *
 * Responsibilities:
 * - Generate unique session IDs using UUIDs
 * - Store and retrieve bot engine instances by session ID
 * - Maintain userId → sessionId mappings
 * - Enforce one active session per user
 * - Clean up sessions from both maps on deletion
 *
 * Requirements: 1.1, 1.2, 1.3, 15.4, 16.1, 16.2, 16.3, 16.4, 16.5
 */
class SessionManager {
    /**
     * Creates a new bot session for a user.
     *
     * Generates a unique session ID (UUID v4), stores the BotEngine instance,
     * and creates a reverse mapping from userId to sessionId.
     *
     * @param userId - Unique identifier for the user
     * @param engine - BotEngine instance for this session
     * @returns Unique session identifier (UUID)
     *
     * Requirements: 1.1, 1.2, 16.1
     *
     * Preconditions:
     * - userId is non-empty string
     * - engine is a valid BotEngine instance
     * - User should not have an active session (caller should check hasActiveSession first)
     *
     * Postconditions:
     * - New session added to sessions Map
     * - userId → sessionId mapping added to userSessions Map
     * - Returns unique UUID v4 string
     *
     * Examples:
     * - createSession("user123", engine) → "550e8400-e29b-41d4-a716-446655440000"
     * - Session can be retrieved via getSession(sessionId)
     * - User session can be retrieved via getUserSession(userId)
     */
    static createSession(userId, engine) {
        // Generate unique session ID using UUID v4
        const sessionId = (0, crypto_1.randomUUID)();
        // Store session in primary map (Req 1.1, 1.2)
        this.sessions.set(sessionId, engine);
        // Create reverse index from userId to sessionId (Req 16.1)
        this.userSessions.set(userId, sessionId);
        return sessionId;
    }
    /**
     * Retrieves a bot session by session ID.
     *
     * @param sessionId - The session identifier
     * @returns BotEngine instance if found, null otherwise
     *
     * Requirements: 1.2
     *
     * Preconditions:
     * - sessionId is non-empty string
     *
     * Postconditions:
     * - If session exists: returns BotEngine instance
     * - If session does not exist: returns null
     * - No mutations to internal state
     *
     * Examples:
     * - getSession("valid-uuid") → BotEngine instance
     * - getSession("invalid-uuid") → null
     */
    static getSession(sessionId) {
        return this.sessions.get(sessionId) ?? null;
    }
    /**
     * Checks if a user has an active bot session.
     *
     * This method is used to enforce the one-bot-per-user rule before
     * creating a new session.
     *
     * @param userId - The user identifier
     * @returns true if user has active session, false otherwise
     *
     * Requirements: 1.3, 16.2, 16.5
     *
     * Preconditions:
     * - userId is non-empty string
     *
     * Postconditions:
     * - Returns true if userId exists in userSessions Map
     * - Returns false if userId not in userSessions Map
     * - No mutations to internal state
     *
     * Examples:
     * - hasActiveSession("user123") with active session → true
     * - hasActiveSession("user456") without session → false
     */
    static hasActiveSession(userId) {
        return this.userSessions.has(userId);
    }
    /**
     * Gets the active session ID for a user.
     *
     * This method returns the session ID if the user has an active session,
     * or null if they don't. Useful for retrieving a user's session without
     * needing to store the session ID on the client.
     *
     * @param userId - The user identifier
     * @returns Session ID if found, null otherwise
     *
     * Requirements: 16.2, 16.3
     *
     * Preconditions:
     * - userId is non-empty string
     *
     * Postconditions:
     * - If user has active session: returns session ID string
     * - If user has no active session: returns null
     * - No mutations to internal state
     *
     * Examples:
     * - getUserSession("user123") with active session → "550e8400-e29b-41d4-a716-446655440000"
     * - getUserSession("user456") without session → null
     */
    static getUserSession(userId) {
        return this.userSessions.get(userId) ?? null;
    }
    /**
     * Deletes a bot session and cleans up all associated mappings.
     *
     * This method removes the session from both Maps (sessionId → BotEngine
     * and userId → sessionId) to ensure proper cleanup and prevent memory leaks.
     *
     * @param sessionId - The session identifier to delete
     *
     * Requirements: 15.4, 16.4
     *
     * Preconditions:
     * - sessionId is non-empty string
     *
     * Postconditions:
     * - Session removed from sessions Map
     * - Corresponding userId → sessionId mapping removed from userSessions Map
     * - If sessionId doesn't exist: no-op (idempotent)
     *
     * Examples:
     * - deleteSession("valid-uuid") → removes session and user mapping
     * - deleteSession("invalid-uuid") → no effect
     * - deleteSession(sessionId) called twice → second call is no-op
     */
    static deleteSession(sessionId) {
        // Retrieve the engine to get userId for cleanup
        const engine = this.sessions.get(sessionId);
        if (engine) {
            // Get userId from engine to remove reverse mapping
            const userId = engine.getUserId();
            // Remove userId → sessionId mapping (Req 16.4)
            this.userSessions.delete(userId);
        }
        // Remove session from primary map (Req 15.4)
        this.sessions.delete(sessionId);
    }
    /**
     * Gets the total number of active sessions.
     *
     * Useful for monitoring, debugging, and system health checks.
     *
     * @returns Number of active sessions
     *
     * Preconditions:
     * - None
     *
     * Postconditions:
     * - Returns count of entries in sessions Map
     * - No mutations to internal state
     *
     * Examples:
     * - getActiveSessionCount() → 5
     * - After deleteSession(): count decreases by 1
     */
    static getActiveSessionCount() {
        return this.sessions.size;
    }
    /**
     * Clears all sessions (for testing purposes only).
     *
     * WARNING: This method should only be used in test environments
     * to reset state between tests. Do not use in production.
     *
     * Postconditions:
     * - Both sessions and userSessions Maps are cleared
     * - All session references removed
     */
    static clearAllSessions() {
        this.sessions.clear();
        this.userSessions.clear();
    }
}
exports.SessionManager = SessionManager;
/**
 * Primary storage: Maps session IDs to BotEngine instances.
 * This is the source of truth for all active bot sessions.
 *
 * Requirements: 1.1, 1.2, 16.1
 */
SessionManager.sessions = new Map();
/**
 * Reverse index: Maps user IDs to their active session IDs.
 * Used to quickly check if a user has an active session and
 * enforce the one-bot-per-user rule.
 *
 * Requirements: 1.3, 16.1, 16.2
 */
SessionManager.userSessions = new Map();
//# sourceMappingURL=session-manager.js.map