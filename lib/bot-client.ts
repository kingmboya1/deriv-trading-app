/**
 * Bot Client Library
 * 
 * HTTP client wrapper for communicating with the bot server via Next.js API routes.
 * This replaces the client-side auto-trade-store.ts logic with server-side bot execution.
 * 
 * **Validates: Requirements 17.1, 17.5**
 */

/**
 * Bot status response from the API
 */
export interface BotStatus {
  sessionId: string;
  isRunning: boolean;
  currentStake: number;
  consecutiveLosses: number;
  accumulatedPL: number;
  stopReason: "max_losses" | "take_profit" | "stop_loss" | "max_stake" | "manual" | null;
  error: string | null;
  trades: TradeRecord[];
  uptime: number;
}

/**
 * Trade record from bot execution
 */
export interface TradeRecord {
  id: string;
  contractId: number;
  contractType: string;
  symbol: string;
  stake: number;
  result: "win" | "loss" | "pending";
  payout: number;
  profit: number;
  timestamp: number;
}

/**
 * Response from starting a bot session
 */
export interface StartBotResponse {
  sessionId: string;
  status: "started" | "error";
  error?: string;
}

/**
 * Response from stopping a bot session
 */
export interface StopBotResponse {
  stopped: boolean;
  finalStatus: BotStatus;
}

/**
 * Error thrown by bot client operations
 */
export class BotClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = "BotClientError";
  }
}

/**
 * Start a new bot trading session
 * 
 * **Requirement 17.1**: Calls POST /api/bot/start when user clicks "Start Bot"
 * 
 * @param derivToken - The Deriv API token for WebSocket authentication
 * @returns Promise resolving to sessionId
 * @throws BotClientError if the request fails
 */
export async function startBot(derivToken: string): Promise<{ sessionId: string }> {
  try {
    const response = await fetch("/api/bot/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ derivToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new BotClientError(
        data.error || "Failed to start bot session",
        response.status,
        data
      );
    }

    return { sessionId: data.sessionId };
  } catch (error) {
    // Requirement 17.5: Handle network failures
    if (error instanceof BotClientError) {
      throw error;
    }

    throw new BotClientError(
      error instanceof Error ? error.message : "Network error starting bot",
      undefined,
      error
    );
  }
}

/**
 * Stop an active bot trading session
 * 
 * **Requirement 17.5**: Calls POST /api/bot/stop when user clicks "Stop Bot"
 * 
 * @param sessionId - The bot session ID to stop
 * @param reason - Optional stop reason (default: "manual")
 * @returns Promise resolving to final bot status
 * @throws BotClientError if the request fails
 */
export async function stopBot(
  sessionId: string,
  reason: "manual" | "max_losses" | "take_profit" | "stop_loss" | "max_stake" = "manual"
): Promise<StopBotResponse> {
  try {
    const response = await fetch("/api/bot/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId, reason }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new BotClientError(
        data.error || "Failed to stop bot session",
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    // Requirement 17.5: Handle network failures
    if (error instanceof BotClientError) {
      throw error;
    }

    throw new BotClientError(
      error instanceof Error ? error.message : "Network error stopping bot",
      undefined,
      error
    );
  }
}

/**
 * Get the current status of a bot trading session
 * 
 * **Requirement 17.2, 17.3**: Polls GET /api/bot/status every 2 seconds
 * Returns current stake, accumulated P/L, and trade history
 * 
 * @param sessionId - The bot session ID
 * @returns Promise resolving to bot status
 * @throws BotClientError if the request fails (including 404 for not found)
 */
export async function getBotStatus(sessionId: string): Promise<BotStatus> {
  try {
    const response = await fetch(
      `/api/bot/status?sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new BotClientError(
        data.error || "Failed to get bot status",
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    // Requirement 17.5: Handle network failures
    if (error instanceof BotClientError) {
      throw error;
    }

    throw new BotClientError(
      error instanceof Error ? error.message : "Network error getting bot status",
      undefined,
      error
    );
  }
}

/**
 * Bot client object with all methods
 * 
 * Provides a convenient interface for bot operations:
 * - start(): Start a new bot session
 * - stop(): Stop an active bot session
 * - getStatus(): Get current bot status
 */
export const botClient = {
  start: startBot,
  stop: stopBot,
  getStatus: getBotStatus,
};

/**
 * Default export for convenience
 */
export default botClient;
