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

  const configRef             = useRef<BotConfig | null>(null);
  const stateRef              = useRef<BotState>(state);
  const pendingContractIdRef  = useRef<number | null>(null);
  const isPlacingRef          = useRef(false);
  // Tracks the last ws status we saw so we can detect connected transitions
  const prevWsStatusRef       = useRef<string>("");

  // Keep stateRef in sync so closures always read fresh state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Shared settlement handler ─────────────────────────────────────────────
  //
  // Extracted into a stable ref so both the portfolio watcher AND the
  // reconnect recovery effect call identical code — no duplication.
  //
  // Returns true if settlement was processed, false if skipped.

  const handleSettlementRef = useRef<(
    contractId: number,
    statusStr: string,
    profit: number
  ) => boolean>(() => false);

  handleSettlementRef.current = (contractId, statusStr, profit) => {
    if (pendingContractIdRef.current !== contractId) return false;

    const settled = statusStr === "won" || statusStr === "lost";
    if (!settled) return false;

    // Clear pending immediately to prevent double-firing
    pendingContractIdRef.current = null;

    const won    = statusStr === "won";
    const config = configRef.current;
    if (!config) return false;

    setState((prev) => {
      const newPL           = round2(prev.accumulatedPL + profit);
      const newConsecLosses = won ? 0 : prev.consecutiveLosses + 1;
      const nextStake       = won
        ? config.baseStake
        : round2(prev.currentStake * config.multiplier);

      const updatedTrades = prev.sessionTrades.map((t) =>
        t.contractId === contractId
          ? { ...t, result: won ? ("win" as const) : ("loss" as const), profit: round2(profit) }
          : t
      );

      // ── Safety rails ─────────────────────────────────────────────────
      if (newConsecLosses >= config.maxConsecutiveLosses) {
        return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "max_losses" as StopReason };
      }
      if (newPL >= config.takeProfitLimit) {
        return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "take_profit" as StopReason };
      }
      if (newPL <= -config.stopLossLimit) {
        return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "stop_loss" as StopReason };
      }
      if (nextStake > config.maxStakeCeiling) {
        return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "max_stake" as StopReason };
      }

      // All rails clear — continue with next stake
      return { ...prev, accumulatedPL: newPL, consecutiveLosses: newConsecLosses, currentStake: nextStake, sessionTrades: updatedTrades };
    });

    return true;
  };

  // ── Core: place one trade ─────────────────────────────────────────────────

  const placeTrade = useCallback(async (stake: number) => {
    const config = configRef.current;
    if (!config) return;

    const wsState  = useDerivSocketStore.getState();
    const currency = wsState.auth.currency?.toUpperCase();
    if (!currency) {
      setState((s) => ({ ...s, isRunning: false, error: "Currency not available — is the WebSocket connected?" }));
      return;
    }

    const contractConfig = CONTRACT_TYPES[config.tradeMode];
    const contractType   = contractConfig.contractTypes[config.contractSide];

    isPlacingRef.current = true;

    try {
      // One-shot proposal — no subscribe:1 to avoid stale stream updates
      const proposalPayload: Record<string, unknown> = {
        proposal: 1,
        amount: round2(stake),
        basis: "stake",
        contract_type: contractType,
        currency,
        duration: config.duration,
        duration_unit: config.durationUnit,
        underlying_symbol: config.symbol,
      };
      if (contractConfig.barrier && config.barrier.trim()) {
        proposalPayload.barrier = config.barrier.trim();
      }

      type ProposalResp = { proposal?: { id: string; ask_price: number; payout: number } };
      const proposalResp = await wsState.request<ProposalResp>(proposalPayload);
      const proposal     = proposalResp.proposal;
      if (!proposal?.id || proposal.ask_price === undefined) {
        throw new Error("Proposal not returned from server.");
      }

      type BuyResp = { buy?: { contract_id: number; buy_price: number; payout: number } };
      const buyResp = await wsState.request<BuyResp>({
        buy: proposal.id,
        price: proposal.ask_price,
      });
      const buy = buyResp.buy;
      if (!buy?.contract_id) throw new Error("Buy response missing contract_id.");

      pendingContractIdRef.current = buy.contract_id;

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

  // ── Portfolio watcher — primary settlement path ───────────────────────────
  //
  // This fires on every portfolio update from the existing store subscription
  // (balance, portfolio, transaction messages). Covers the normal case where
  // the connection stays healthy.

  const portfolio = useDerivSocketStore((s) => s.portfolio);

  useEffect(() => {
    const contractId = pendingContractIdRef.current;
    if (contractId === null) return;

    const entry  = portfolio[contractId];
    if (!entry) return;

    const status = typeof entry.status === "string" ? entry.status.toLowerCase() : "";
    const profit = typeof entry.profit === "number" ? entry.profit : 0;

    handleSettlementRef.current(contractId, status, profit);
  }, [portfolio]);

  // ── Heartbeat ping — keeps the WS alive every 30 s while bot is running ──
  //
  // Uses the store's send() which throws if the socket is closed — the catch
  // is intentionally silent because the reconnect watcher handles recovery.

  useEffect(() => {
    if (!state.isRunning) return;

    const id = window.setInterval(() => {
      try {
        useDerivSocketStore.getState().send({ ping: 1 });
      } catch {
        // Socket not open — reconnect watcher will handle recovery
      }
    }, 30_000);

    return () => window.clearInterval(id);
  }, [state.isRunning]);

  // ── Reconnect recovery — re-fetch pending contract after a drop ──────────
  //
  // Watches the WS status. When it transitions TO "Connected" while the bot
  // is running with a pending contract, sends a one-shot proposal_open_contract
  // request to fetch the current state of that contract. If it has already
  // settled during the disconnection window, the response triggers settlement
  // via the same handleSettlementRef handler used by the portfolio watcher.

  const wsStatus = useDerivSocketStore((s) => s.status);

  useEffect(() => {
    const justReconnected =
      wsStatus === "Connected" &&
      prevWsStatusRef.current !== "Connected";

    prevWsStatusRef.current = wsStatus;

    if (!justReconnected) return;
    if (!stateRef.current.isRunning) return;

    const contractId = pendingContractIdRef.current;
    if (contractId === null) return;

    // Re-subscribe to get the latest state of the pending contract.
    // The store will process the response as a proposal_open_contract message,
    // which the handleMessage handler in derivsocket.ts writes into portfolio —
    // that triggers the portfolio watcher above.
    // As a belt-and-suspenders backup, also send a one-shot status fetch.
    void (async () => {
      try {
        type POCResp = {
          proposal_open_contract?: {
            contract_id: number;
            status?: string;
            profit?: number;
          };
        };
        const resp = await useDerivSocketStore.getState().request<POCResp>({
          proposal_open_contract: 1,
          contract_id: contractId,
        });

        const poc = resp.proposal_open_contract;
        if (!poc) return;

        const status = typeof poc.status === "string" ? poc.status.toLowerCase() : "";
        const profit = typeof poc.profit === "number" ? poc.profit : 0;

        // If already settled, drive the settlement handler directly.
        // If still open, the portfolio watcher will catch it when the next
        // proposal_open_contract stream message arrives.
        handleSettlementRef.current(contractId, status, profit);
      } catch {
        // Request failed (e.g. contract not found) — bot will remain pending
        // until the next portfolio message or the user manually stops it.
      }
    })();
  }, [wsStatus]);

  // ── Trigger next trade after state settles ────────────────────────────────

  useEffect(() => {
    if (!state.isRunning) return;
    if (pendingContractIdRef.current !== null) return;
    if (isPlacingRef.current) return;
    void placeTrade(state.currentStake);
  }, [state.isRunning, state.currentStake, state.consecutiveLosses, placeTrade]);

  // ── Public API ────────────────────────────────────────────────────────────

  const start = useCallback((config: BotConfig) => {
    configRef.current            = config;
    pendingContractIdRef.current = null;
    isPlacingRef.current         = false;
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
    isPlacingRef.current         = false;
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
