"use client";

/**
 * useAutoTrade — HTTP bot client hook for server-side bot execution.
 *
 * Replaces the client-side auto-trade-store.ts with HTTP calls to the bot server.
 * The bot now runs on the server and persists independently of browser sessions.
 *
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7**
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";
import { botClient, type BotStatus, type TradeRecord } from "@/lib/bot-client";

// Re-export types for components
export type { TradeRecord } from "@/lib/bot-client";

export type StopReason = "max_losses" | "take_profit" | "stop_loss" | "max_stake" | "manual" | null;

export interface BotConfig {
  tradeMode: string;
  contractSide: number;
  symbol: string;
  baseStake: number;
  multiplier: number;
  maxConsecutiveLosses: number;
  takeProfitAmount: number;
  stopLossAmount: number;
}

export interface UseAutoTradeReturn {
  isRunning: boolean;
  currentStake: number;
  consecutiveLosses: number;
  accumulatedPL: number;
  sessionTrades: TradeRecord[];
  stopReason: StopReason;
  error: string | null;
  start: (config: BotConfig) => Promise<void>;
  stop: (reason?: StopReason) => Promise<void>;
  resetSession: () => void;
}

/**
 * Hook for managing server-side bot execution
 *
 * **Requirement 17.1**: Calls POST /api/bot/start on "Start Bot" click
 * **Requirement 17.2**: Polls GET /api/bot/status every 2 seconds
 * **Requirement 17.3**: Updates UI with current stake, P/L, and trade history
 * **Requirement 17.4**: Stops polling when isRunning becomes false
 * **Requirement 17.5**: Calls POST /api/bot/stop on "Stop Bot" click
 * **Requirement 17.6**: Stops polling on component unmount
 * **Requirement 17.7**: Prioritizes unmount cleanup if stop and unmount occur simultaneously
 */
export function useAutoTrade(): UseAutoTradeReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = useRef(false);

  // Get Deriv token for bot authentication
  const getToken = useDerivSocketStore((s) => s.getToken);

  /**
   * Poll bot status every 2 seconds
   * **Requirement 17.2**: Begin polling after start
   * **Requirement 17.4**: Stop polling when isRunning becomes false
   */
  const startPolling = useCallback((sid: string) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll immediately
    pollStatus(sid);

    // Poll every 2 seconds (Requirement 17.2)
    pollingIntervalRef.current = setInterval(() => {
      pollStatus(sid);
    }, 2000);
  }, []);

  /**
   * Stop polling and clear interval
   * **Requirement 17.6**: Stop polling on component unmount
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Fetch current bot status
   * **Requirement 17.3**: Update UI state from status response
   */
  const pollStatus = async (sid: string) => {
    try {
      const status = await botClient.getStatus(sid);
      setBotStatus(status);

      // Requirement 17.4: Stop polling when bot stops
      if (!status.isRunning) {
        stopPolling();
      }

      // Clear error on successful poll
      setError(null);
    } catch (err: any) {
      // Don't spam errors on every poll failure
      if (err.statusCode === 404) {
        // Session not found - likely expired
        setError("Bot session not found. Please start a new session.");
        setBotStatus(null);
        setSessionId(null);
        stopPolling();
      } else {
        // Network or other error - keep trying
        console.error("[useAutoTrade] Poll error:", err);
      }
    }
  };

  /**
   * Start a new bot session
   * **Requirement 17.1**: Call POST /api/bot/start when user clicks "Start Bot"
   */
  const start = useCallback(async (config: BotConfig) => {
    try {
      setError(null);

      // Get Deriv API token
      const token = getToken?.();
      if (!token) {
        throw new Error("No Deriv API token available. Please reconnect.");
      }

      // Start bot session (Requirement 17.1)
      const { sessionId: sid } = await botClient.start(token);
      setSessionId(sid);

      // Start polling for status (Requirement 17.2)
      startPolling(sid);
    } catch (err: any) {
      setError(err.message || "Failed to start bot");
      console.error("[useAutoTrade] Start error:", err);
    }
  }, [getToken, startPolling]);

  /**
   * Stop the active bot session
   * **Requirement 17.5**: Call POST /api/bot/stop when user clicks "Stop Bot"
   */
  const stop = useCallback(async (reason: StopReason = "manual") => {
    if (!sessionId) return;

    try {
      setError(null);

      // Stop bot session (Requirement 17.5)
      const { finalStatus } = await botClient.stop(sessionId, reason);

      // Update to final status
      setBotStatus(finalStatus);

      // Stop polling
      stopPolling();
    } catch (err: any) {
      setError(err.message || "Failed to stop bot");
      console.error("[useAutoTrade] Stop error:", err);
    }
  }, [sessionId, stopPolling]);

  /**
   * Reset session state (clear UI)
   */
  const resetSession = useCallback(() => {
    setSessionId(null);
    setBotStatus(null);
    setError(null);
    stopPolling();
  }, [stopPolling]);

  /**
   * Cleanup on unmount
   * **Requirement 17.6**: Stop polling on component unmount
   * **Requirement 17.7**: Prioritize unmount cleanup
   */
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      stopPolling();
    };
  }, [stopPolling]);

  // Extract values from botStatus or use defaults
  const isRunning = botStatus?.isRunning ?? false;
  const currentStake = botStatus?.currentStake ?? 0;
  const consecutiveLosses = botStatus?.consecutiveLosses ?? 0;
  const accumulatedPL = botStatus?.accumulatedPL ?? 0;
  const sessionTrades = botStatus?.trades ?? [];
  const stopReason = botStatus?.stopReason ?? null;

  return {
    isRunning,
    currentStake,
    consecutiveLosses,
    accumulatedPL,
    sessionTrades,
    stopReason,
    error: error || botStatus?.error || null,
    start,
    stop,
    resetSession,
  };
}
