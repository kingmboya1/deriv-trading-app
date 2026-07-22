"use client";

import { useAutoTradeStore } from "@/lib/auto-trade-store";

export type { StopReason, BotTradeRecord as TradeRecord, BotConfig } from "@/lib/auto-trade-store";

export interface UseAutoTradeReturn {
  isRunning: boolean;
  currentStake: number;
  accumulatedPL: number;
  sessionTrades: ReturnType<typeof useAutoTradeStore.getState>["sessionTrades"];
  stopReason: ReturnType<typeof useAutoTradeStore.getState>["stopReason"];
  error: string | null;
  start: (takeProfit: number, maxLoss: number) => void;
  stop: ReturnType<typeof useAutoTradeStore.getState>["stopBot"];
  resetSession: ReturnType<typeof useAutoTradeStore.getState>["resetSession"];
}

export function useAutoTrade(): UseAutoTradeReturn {
  const isRunning     = useAutoTradeStore((s) => s.isRunning);
  const currentStake  = useAutoTradeStore((s) => s.currentStake);
  const accumulatedPL = useAutoTradeStore((s) => s.accumulatedPL);
  const sessionTrades = useAutoTradeStore((s) => s.sessionTrades);
  const stopReason    = useAutoTradeStore((s) => s.stopReason);
  const error         = useAutoTradeStore((s) => s.error);
  const startBot      = useAutoTradeStore((s) => s.startBot);
  const stopBot       = useAutoTradeStore((s) => s.stopBot);
  const resetSession  = useAutoTradeStore((s) => s.resetSession);

  return { isRunning, currentStake, accumulatedPL, sessionTrades, stopReason, error, start: startBot, stop: stopBot, resetSession };
}
