"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";
import {
  CONTRACT_TYPES,
  type BuyContractType,
  type DurationUnit,
  type TradeMode,
} from "@/lib/contract-types";

// ─── Public types ─────────────────────────────────────────────────────────────

export type StopReason =
  | "max_losses"
  | "take_profit"
  | "stop_loss"
  | "max_stake"
  | "manual"
  | null;

export interface TradeRecord {
  id: string;
  contractId: number;
  contractType: BuyContractType;
  symbol: string;
  stake: number;
  result: "win" | "loss" | "pending";
  payout: number;
  profit: number;
  timestamp: number;
}

export interface BotConfig {
  tradeMode: TradeMode;
  /** 0 = first button (e.g. Rise), 1 = second button (e.g. Fall) */
  contractSide: 0 | 1;
  symbol: string;
  baseStake: number;
  multiplier: number;
  duration: number;
  durationUnit: DurationUnit;
  barrier: string;
  maxConsecutiveLosses: number;
  takeProfitLimit: number;
  stopLossLimit: number;
  maxStakeCeiling: number;
}

export interface BotState {
  isRunning: boolean;
  currentStake: number;
  consecutiveLosses: number;
  accumulatedPL: number;
  sessionTrades: TradeRecord[];
  stopReason: StopReason;
  error: string | null;
}

export interface UseAutoTradeReturn extends BotState {
  start: (config: BotConfig) => void;
  stop: (reason?: StopReason) => void;
  resetSession: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTradeId(): string {
  return `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAutoTrade(): UseAutoTradeReturn {
  const [state, setState] = useState<BotState>({
    isRunning: false,
    currentStake: 0,
    consecutiveLosses: 0,
    accumulatedPL: 0,
    sessionTrades: [],
    stopReason: null,
    error: null,
  });

  // Internal refs so the settlement effect always has fresh values without
  // needing to be re-created (avoids stale-closure bugs in the portfolio watcher)
  const configRef = useRef<BotConfig | null>(null);
  const stateRef = useRef<BotState>(state);
  const pendingContractIdRef = useRef<number | null>(null);
  const isPlacingRef = useRef(false); // guard against double-firing

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Core: place one trade ─────────────────────────────────────────────────

  const placeTrade = useCallback(async (stake: number) => {
    const config = configRef.current;
    if (!config) return;

    const wsState = useDerivSocketStore.getState();
    const currency = wsState.auth.currency?.toUpperCase();
    if (!currency) {
      setState((s) => ({ ...s, isRunning: false, error: "Currency not available — is the WebSocket connected?" }));
      return;
    }

    const contractConfig = CONTRACT_TYPES[config.tradeMode];
    const contractType = contractConfig.contractTypes[config.contractSide];

    isPlacingRef.current = true;

    try {
      // 1. One-shot proposal (no subscribe: 1) to avoid stale stream updates
      const proposalPayload: Record<string, unknown> = {
        proposal: 1,
        amount: round2(stake),
        basis: "stake",
        contract_type: contractType,
        currency,
        duration: config.duration,
        duration_unit: config.durationUnit,
        underlying_symbol: config.symbol,
        // deliberately omitting subscribe: 1
      };
      if (contractConfig.barrier && config.barrier.trim()) {
        proposalPayload.barrier = config.barrier.trim();
      }

      type ProposalResp = { proposal?: { id: string; ask_price: number; payout: number } };
      const proposalResp = await wsState.request<ProposalResp>(proposalPayload);
      const proposal = proposalResp.proposal;
      if (!proposal?.id || proposal.ask_price === undefined) {
        throw new Error("Proposal not returned from server.");
      }

      // 2. Buy
      type BuyResp = { buy?: { contract_id: number; buy_price: number; payout: number } };
      const buyResp = await wsState.request<BuyResp>({
        buy: proposal.id,
        price: proposal.ask_price,
      });
      const buy = buyResp.buy;
      if (!buy?.contract_id) throw new Error("Buy response missing contract_id.");

      pendingContractIdRef.current = buy.contract_id;

      // 3. Register trade as pending in session history
      const record: TradeRecord = {
        id: makeTradeId(),
        contractId: buy.contract_id,
        contractType,
        symbol: config.symbol,
        stake: round2(stake),
        result: "pending",
        payout: buy.payout ?? 0,
        profit: 0,
        timestamp: Date.now(),
      };

      setState((s) => ({
        ...s,
        currentStake: round2(stake),
        sessionTrades: [record, ...s.sessionTrades],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Trade placement failed.";
      setState((s) => ({ ...s, isRunning: false, error: msg }));
    } finally {
      isPlacingRef.current = false;
    }
  }, []);

  // ── Portfolio watcher — settlement detection ──────────────────────────────

  const portfolio = useDerivSocketStore((s) => s.portfolio);

  useEffect(() => {
    const contractId = pendingContractIdRef.current;
    if (contractId === null) return;

    const entry = portfolio[contractId];
    if (!entry) return;

    const status = typeof entry.status === "string" ? entry.status.toLowerCase() : "";
    const settled = status === "won" || status === "lost";
    if (!settled) return;

    // Clear pending so this handler doesn't re-fire
    pendingContractIdRef.current = null;

    const won = status === "won";
    const profit = typeof entry.profit === "number" ? entry.profit : 0;
    const config = configRef.current;
    if (!config) return;

    setState((prev) => {
      const newPL = round2(prev.accumulatedPL + profit);
      const newConsecLosses = won ? 0 : prev.consecutiveLosses + 1;
      const nextStake = won
        ? config.baseStake
        : round2(prev.currentStake * config.multiplier);

      // Update trade record
      const updatedTrades = prev.sessionTrades.map((t) =>
        t.contractId === contractId
          ? { ...t, result: won ? ("win" as const) : ("loss" as const), profit: round2(profit) }
          : t
      );

      // ── Safety rail checks ──────────────────────────────────────────
      if (newConsecLosses >= config.maxConsecutiveLosses) {
        return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "max_losses" };
      }
      if (newPL >= config.takeProfitLimit) {
        return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "take_profit" };
      }
      if (newPL <= -config.stopLossLimit) {
        return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "stop_loss" };
      }
      if (nextStake > config.maxStakeCeiling) {
        return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "max_stake" };
      }

      // All clear — queue next trade
      return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, currentStake: nextStake, sessionTrades: updatedTrades };
    });
  }, [portfolio]);

  // ── Trigger next trade after state settles (when still running) ───────────

  useEffect(() => {
    if (!state.isRunning) return;
    if (pendingContractIdRef.current !== null) return;
    if (isPlacingRef.current) return;
    // No pending contract and still running — place next trade
    void placeTrade(state.currentStake);
  }, [state.isRunning, state.currentStake, state.consecutiveLosses, placeTrade]);

  // ── Public API ────────────────────────────────────────────────────────────

  const start = useCallback((config: BotConfig) => {
    configRef.current = config;
    pendingContractIdRef.current = null;
    isPlacingRef.current = false;
    setState({
      isRunning: true,
      currentStake: config.baseStake,
      consecutiveLosses: 0,
      accumulatedPL: 0,
      sessionTrades: [],
      stopReason: null,
      error: null,
    });
  }, []);

  const stop = useCallback((reason: StopReason = "manual") => {
    pendingContractIdRef.current = null;
    setState((s) => ({ ...s, isRunning: false, stopReason: reason }));
  }, []);

  const resetSession = useCallback(() => {
    pendingContractIdRef.current = null;
    isPlacingRef.current = false;
    setState({
      isRunning: false,
      currentStake: configRef.current?.baseStake ?? 1,
      consecutiveLosses: 0,
      accumulatedPL: 0,
      sessionTrades: [],
      stopReason: null,
      error: null,
    });
  }, []);

  return { ...state, start, stop, resetSession };
}
