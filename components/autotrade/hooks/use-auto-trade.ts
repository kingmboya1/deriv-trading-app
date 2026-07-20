"use client";

/**
 * useAutoTrade — thin selector hook over the persistent global auto-trade store.
 *
 * Re-exports all public types for components that import from this path.
 * The bot engine itself lives in lib/auto-trade-store.ts and survives
 * component mount/unmount — navigating away from the Auto Trade panel
 * does NOT stop or reset the bot.
 */

import { useAutoTradeStore } from "@/lib/auto-trade-store";

// Re-export types so existing component imports continue to work unchanged
export type { StopReason, BotTradeRecord as TradeRecord, BotConfig } from "@/lib/auto-trade-store";

export interface UseAutoTradeReturn {
  isRunning: boolean;
  currentStake: number;
  consecutiveLosses: number;
  accumulatedPL: number;
  sessionTrades: ReturnType<typeof useAutoTradeStore.getState>["sessionTrades"];
  stopReason: ReturnType<typeof useAutoTradeStore.getState>["stopReason"];
  error: string | null;
  start: ReturnType<typeof useAutoTradeStore.getState>["startBot"];
  stop: ReturnType<typeof useAutoTradeStore.getState>["stopBot"];
  resetSession: ReturnType<typeof useAutoTradeStore.getState>["resetSession"];
}

export function useAutoTrade(): UseAutoTradeReturn {
  const isRunning        = useAutoTradeStore((s) => s.isRunning);
  const currentStake     = useAutoTradeStore((s) => s.currentStake);
  const consecutiveLosses = useAutoTradeStore((s) => s.consecutiveLosses);
  const accumulatedPL    = useAutoTradeStore((s) => s.accumulatedPL);
  const sessionTrades    = useAutoTradeStore((s) => s.sessionTrades);
  const stopReason       = useAutoTradeStore((s) => s.stopReason);
  const error            = useAutoTradeStore((s) => s.error);
  const startBot         = useAutoTradeStore((s) => s.startBot);
  const stopBot          = useAutoTradeStore((s) => s.stopBot);
  const resetSession     = useAutoTradeStore((s) => s.resetSession);

  return {
    isRunning,
    currentStake,
    consecutiveLosses,
    accumulatedPL,
    sessionTrades,
    stopReason,
    error,
    start: startBot,
    stop: stopBot,
    resetSession,
  };
}
