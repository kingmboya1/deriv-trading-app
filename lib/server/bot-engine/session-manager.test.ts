import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionManager } from "./session-manager";
import { BotEngine } from "./bot-engine";
import { StrategyConfig } from "./types";

// Mock strategy configuration for testing
const mockConfig: StrategyConfig = {
  name: "Test Strategy",
  version: "1.0.0",
  description: "Test strategy for SessionManager tests",
  trade: {
    contractType: "DIGITEVEN",
    symbol: "R_100",
    duration: 1,
    durationUnit: "t",
  },
  stake: {
    initial: 0.35,
    multiplier: 2,
    maxStake: 10,
  },
  risk: {
    maxConsecutiveLosses: 5,
    takeProfitAmount: 5,
    stopLossAmount: 10,
  },
  execution: {
    interTradeDelay: 2000,
    autoRestart: false,
  },
};

describe("SessionManager", () => {
  // Clear all sessions before each test to ensure isolation
  beforeEach(() => {
    SessionManager.clearAllSessions();
  });

  describe("8.1 Create SessionManager class", () => {
    it("should create a session with unique UUID", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");

      // Act
      const sessionId = SessionManager.createSession(userId, engine);

      // Assert
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("should generate unique session IDs for different sessions", () => {
      // Arrange
      const user1 = "user1";
      const user2 = "user2";
      const engine1 = new BotEngine(user1, mockConfig, "token1");
      const engine2 = new BotEngine(user2, mockConfig, "token2");

      // Act
      const sessionId1 = SessionManager.createSession(user1, engine1);
      // Clean up first session to allow second user
      SessionManager.deleteSession(sessionId1);
      const sessionId2 = SessionManager.createSession(user2, engine2);

      // Assert
      expect(sessionId1).not.toBe(sessionId2);
    });

    it("should store session in Map and retrieve it by sessionId", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");

      // Act
      const sessionId = SessionManager.createSession(userId, engine);
      const retrieved = SessionManager.getSession(sessionId);

      // Assert
      expect(retrieved).toBe(engine);
    });

    it("should create reverse index from userId to sessionId", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");

      // Act
      const sessionId = SessionManager.createSession(userId, engine);
      const userSessionId = SessionManager.getUserSession(userId);

      // Assert
      expect(userSessionId).toBe(sessionId);
    });

    it("should return null when getting non-existent session", () => {
      // Act
      const retrieved = SessionManager.getSession("non-existent-uuid");

      // Assert
      expect(retrieved).toBeNull();
    });

    it("should return null when getting user session for non-existent user", () => {
      // Act
      const userSessionId = SessionManager.getUserSession("non-existent-user");

      // Assert
      expect(userSessionId).toBeNull();
    });
  });

  describe("8.2 Enforce one-bot-per-user rule", () => {
    it("should return true when user has active session", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");
      SessionManager.createSession(userId, engine);

      // Act
      const hasActive = SessionManager.hasActiveSession(userId);

      // Assert
      expect(hasActive).toBe(true);
    });

    it("should return false when user has no active session", () => {
      // Act
      const hasActive = SessionManager.hasActiveSession("user-without-session");

      // Assert
      expect(hasActive).toBe(false);
    });

    it("should return existing session ID for user with active session", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");
      const sessionId = SessionManager.createSession(userId, engine);

      // Act
      const userSessionId = SessionManager.getUserSession(userId);

      // Assert
      expect(userSessionId).toBe(sessionId);
    });

    it("should allow checking active session before creating new one", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");

      // Act - First session
      expect(SessionManager.hasActiveSession(userId)).toBe(false);
      const sessionId1 = SessionManager.createSession(userId, engine);
      expect(SessionManager.hasActiveSession(userId)).toBe(true);

      // Simulate rejection of second session attempt
      const hasActive = SessionManager.hasActiveSession(userId);

      // Assert
      expect(hasActive).toBe(true);
      expect(SessionManager.getUserSession(userId)).toBe(sessionId1);
    });

    it("should prevent creating second session by enforcing one-bot-per-user", () => {
      // Arrange
      const userId = "user123";
      const engine1 = new BotEngine(userId, mockConfig, "token1");
      const engine2 = new BotEngine(userId, mockConfig, "token2");

      // Act
      const sessionId1 = SessionManager.createSession(userId, engine1);
      
      // Simulate the check that should happen before creating second session
      const hasActive = SessionManager.hasActiveSession(userId);

      // Assert
      expect(hasActive).toBe(true);
      expect(SessionManager.getUserSession(userId)).toBe(sessionId1);
      
      // If we were to ignore the check and create a second session,
      // it would overwrite the first (demonstrating why the check is necessary)
      // This test validates that hasActiveSession() correctly detects the conflict
    });

    it("should maintain one-to-one mapping between userId and sessionId", () => {
      // Arrange
      const user1 = "user1";
      const user2 = "user2";
      const engine1 = new BotEngine(user1, mockConfig, "token1");
      const engine2 = new BotEngine(user2, mockConfig, "token2");

      // Act
      const sessionId1 = SessionManager.createSession(user1, engine1);
      const sessionId2 = SessionManager.createSession(user2, engine2);

      // Assert
      expect(SessionManager.getUserSession(user1)).toBe(sessionId1);
      expect(SessionManager.getUserSession(user2)).toBe(sessionId2);
      expect(SessionManager.hasActiveSession(user1)).toBe(true);
      expect(SessionManager.hasActiveSession(user2)).toBe(true);
    });
  });

  describe("8.3 Implement session cleanup", () => {
    it("should remove session from both Maps on deleteSession", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");
      const sessionId = SessionManager.createSession(userId, engine);

      // Act
      SessionManager.deleteSession(sessionId);

      // Assert - Session removed from sessions Map
      expect(SessionManager.getSession(sessionId)).toBeNull();
      // Assert - User removed from userSessions Map
      expect(SessionManager.getUserSession(userId)).toBeNull();
      expect(SessionManager.hasActiveSession(userId)).toBe(false);
    });

    it("should remove userId → sessionId mapping on session end", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");
      const sessionId = SessionManager.createSession(userId, engine);
      expect(SessionManager.hasActiveSession(userId)).toBe(true);

      // Act
      SessionManager.deleteSession(sessionId);

      // Assert
      expect(SessionManager.hasActiveSession(userId)).toBe(false);
      expect(SessionManager.getUserSession(userId)).toBeNull();
    });

    it("should be idempotent when deleting non-existent session", () => {
      // Act & Assert - Should not throw error
      expect(() => {
        SessionManager.deleteSession("non-existent-uuid");
      }).not.toThrow();
    });

    it("should be idempotent when deleting same session twice", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");
      const sessionId = SessionManager.createSession(userId, engine);

      // Act - Delete twice
      SessionManager.deleteSession(sessionId);
      SessionManager.deleteSession(sessionId);

      // Assert - No errors, both maps cleaned
      expect(SessionManager.getSession(sessionId)).toBeNull();
      expect(SessionManager.getUserSession(userId)).toBeNull();
    });

    it("should allow user to create new session after previous session deleted", () => {
      // Arrange
      const userId = "user123";
      const engine1 = new BotEngine(userId, mockConfig, "token1");
      const sessionId1 = SessionManager.createSession(userId, engine1);

      // Act - Delete first session
      SessionManager.deleteSession(sessionId1);
      expect(SessionManager.hasActiveSession(userId)).toBe(false);

      // Create new session
      const engine2 = new BotEngine(userId, mockConfig, "token2");
      const sessionId2 = SessionManager.createSession(userId, engine2);

      // Assert
      expect(sessionId2).not.toBe(sessionId1);
      expect(SessionManager.hasActiveSession(userId)).toBe(true);
      expect(SessionManager.getUserSession(userId)).toBe(sessionId2);
      expect(SessionManager.getSession(sessionId1)).toBeNull();
      expect(SessionManager.getSession(sessionId2)).toBe(engine2);
    });

    it("should properly clean up multiple sessions independently", () => {
      // Arrange
      const user1 = "user1";
      const user2 = "user2";
      const user3 = "user3";
      const engine1 = new BotEngine(user1, mockConfig, "token1");
      const engine2 = new BotEngine(user2, mockConfig, "token2");
      const engine3 = new BotEngine(user3, mockConfig, "token3");

      const sessionId1 = SessionManager.createSession(user1, engine1);
      const sessionId2 = SessionManager.createSession(user2, engine2);
      const sessionId3 = SessionManager.createSession(user3, engine3);

      // Act - Delete middle session
      SessionManager.deleteSession(sessionId2);

      // Assert - Other sessions unaffected
      expect(SessionManager.getSession(sessionId1)).toBe(engine1);
      expect(SessionManager.getSession(sessionId2)).toBeNull();
      expect(SessionManager.getSession(sessionId3)).toBe(engine3);

      expect(SessionManager.hasActiveSession(user1)).toBe(true);
      expect(SessionManager.hasActiveSession(user2)).toBe(false);
      expect(SessionManager.hasActiveSession(user3)).toBe(true);
    });
  });

  describe("Helper methods", () => {
    it("should track active session count", () => {
      // Arrange
      expect(SessionManager.getActiveSessionCount()).toBe(0);

      const user1 = "user1";
      const user2 = "user2";
      const engine1 = new BotEngine(user1, mockConfig, "token1");
      const engine2 = new BotEngine(user2, mockConfig, "token2");

      // Act & Assert
      const sessionId1 = SessionManager.createSession(user1, engine1);
      expect(SessionManager.getActiveSessionCount()).toBe(1);

      const sessionId2 = SessionManager.createSession(user2, engine2);
      expect(SessionManager.getActiveSessionCount()).toBe(2);

      SessionManager.deleteSession(sessionId1);
      expect(SessionManager.getActiveSessionCount()).toBe(1);

      SessionManager.deleteSession(sessionId2);
      expect(SessionManager.getActiveSessionCount()).toBe(0);
    });

    it("should clear all sessions", () => {
      // Arrange
      const user1 = "user1";
      const user2 = "user2";
      const engine1 = new BotEngine(user1, mockConfig, "token1");
      const engine2 = new BotEngine(user2, mockConfig, "token2");

      SessionManager.createSession(user1, engine1);
      SessionManager.createSession(user2, engine2);
      expect(SessionManager.getActiveSessionCount()).toBe(2);

      // Act
      SessionManager.clearAllSessions();

      // Assert
      expect(SessionManager.getActiveSessionCount()).toBe(0);
      expect(SessionManager.hasActiveSession(user1)).toBe(false);
      expect(SessionManager.hasActiveSession(user2)).toBe(false);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete session lifecycle", () => {
      // Arrange
      const userId = "user123";
      const engine = new BotEngine(userId, mockConfig, "mock-token");

      // Act & Assert - No session initially
      expect(SessionManager.hasActiveSession(userId)).toBe(false);

      // Create session
      const sessionId = SessionManager.createSession(userId, engine);
      expect(SessionManager.hasActiveSession(userId)).toBe(true);
      expect(SessionManager.getUserSession(userId)).toBe(sessionId);
      expect(SessionManager.getSession(sessionId)).toBe(engine);

      // Attempt to check for second session (should be prevented)
      expect(SessionManager.hasActiveSession(userId)).toBe(true);

      // End session
      SessionManager.deleteSession(sessionId);
      expect(SessionManager.hasActiveSession(userId)).toBe(false);
      expect(SessionManager.getUserSession(userId)).toBeNull();
      expect(SessionManager.getSession(sessionId)).toBeNull();

      // Can create new session after cleanup
      const newEngine = new BotEngine(userId, mockConfig, "new-token");
      const newSessionId = SessionManager.createSession(userId, newEngine);
      expect(SessionManager.hasActiveSession(userId)).toBe(true);
      expect(newSessionId).not.toBe(sessionId);
    });

    it("should enforce one-bot-per-user across multiple operations", () => {
      // Arrange
      const userId = "user123";
      const engine1 = new BotEngine(userId, mockConfig, "token1");

      // Act - Create first session
      const sessionId1 = SessionManager.createSession(userId, engine1);

      // Try to create second session (should be detected and prevented)
      const canCreateSecond = !SessionManager.hasActiveSession(userId);
      expect(canCreateSecond).toBe(false);

      // Delete first session
      SessionManager.deleteSession(sessionId1);

      // Now can create second session
      const canCreateAfterDelete = !SessionManager.hasActiveSession(userId);
      expect(canCreateAfterDelete).toBe(true);

      const engine2 = new BotEngine(userId, mockConfig, "token2");
      const sessionId2 = SessionManager.createSession(userId, engine2);

      // Assert
      expect(sessionId2).not.toBe(sessionId1);
      expect(SessionManager.getUserSession(userId)).toBe(sessionId2);
    });
  });
});
