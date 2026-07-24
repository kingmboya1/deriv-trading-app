"use client";

/**
 * auto-trade-store.ts — persistent global Zustand store for the martingale bot.
 *
 * Lives at module scope like useDerivSocketStore, so it survives React component
 * mount/unmount cycles. Navigating away from the Auto Trade panel does NOT reset
 * or pause the bot — it keeps running in the background and the UI re-syncs when
 * the user returns.
 *
 * The engine loop runs entirely via module-level subscriptions registered by
 * startBot() and torn down only by stopBot() or a safety-rail trigger.
 */

import { create } from "zustand";
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

export interface BotTradeRecord {
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

export interface AutoTradeState {
  isRunning: boolean;
  currentStake: number;
  consecutiveLosses: number;
  accumulatedPL: number;
  sessionTrades: BotTradeRecord[];
  stopReason: StopReason;
  error: string | null;
  // Actions
  startBot: (config: BotConfig) => void;
  stopBot: (reason?: StopReason) => void;
  resetSession: () => void;
}

// ─── Module-level engine variables (survive component unmount) ────────────────

let botConfig: BotConfig | null           = null;
let pendingContractId: number | null      = null;
let isPlacing                             = false;
let nextTradeTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let prevWsStatus                          = "";

// Unsubscribe functions returned by zustand subscribeWithSelector
let portfolioUnsub: (() => void) | null   = null;
let wsStatusUnsub: (() => void) | null    = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function makeTradeId(): string {
  return `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clearNextTradeTimer() {
  if (nextTradeTimer !== null) {
    clearTimeout(nextTradeTimer);
    nextTradeTimer = null;
  }
}

function clearHeartbeat() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function teardownEngineListeners() {
  portfolioUnsub?.();
  portfolioUnsub = null;
  wsStatusUnsub?.();
  wsStatusUnsub = null;
  clearNextTradeTimer();
  clearHeartbeat();
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAutoTradeStore = create<AutoTradeState>((set, get) => ({
  isRunning: false,
  currentStake: 0,
  consecutiveLosses: 0,
  accumulatedPL: 0,
  sessionTrades: [],
  stopReason: null,
  error: null,

  startBot: (config: BotConfig) => {
    // Tear down any previous engine listeners before starting fresh
    teardownEngineListeners();

    botConfig          = config;
    pendingContractId  = null;
    isPlacing          = false;
    prevWsStatus       = "";

    set({
      isRunning: true,
      currentStake: config.baseStake,
      consecutiveLosses: 0,
      accumulatedPL: 0,
      sessionTrades: [],
      stopReason: null,
      error: null,
    });

    // Register persistent listeners
    registerPortfolioWatcher(set, get);
    registerWsStatusWatcher(set, get);
    startHeartbeat();

    // Fire the first trade immediately
    void placeTrade(config.baseStake, set, get);
  },

  stopBot: (reason: StopReason = "manual") => {
    teardownEngineListeners();
    pendingContractId = null;
    isPlacing         = false;
    set((s) => ({ ...s, isRunning: false, stopReason: reason }));
  },

  resetSession: () => {
    teardownEngineListeners();
    pendingContractId = null;
    isPlacing         = false;
    botConfig         = null;
    set({
      isRunning: false,
      currentStake: 0,
      consecutiveLosses: 0,
      accumulatedPL: 0,
      sessionTrades: [],
      stopReason: null,
      error: null,
    });
  },
}));

// ─── Engine: place one trade ──────────────────────────────────────────────────

async function placeTrade(
  stake: number,
  set: (partial: Partial<AutoTradeState> | ((s: AutoTradeState) => Partial<AutoTradeState>)) => void,
  get: () => AutoTradeState
) {
  const config = botConfig;
  if (!config) return;
  if (!get().isRunning) return;
  if (isPlacing) return;                    // double-fire guard
  if (pendingContractId !== null) return;   // preceding contract not yet cleared

  isPlacing = true;

  const wsState  = useDerivSocketStore.getState();
  const currency = wsState.auth.currency?.toUpperCase();

  console.log("[auto-trade] 💰 placeTrade called:", {
    stake,
    currency,
    hasCurrency: !!currency,
    authState: wsState.auth,
    wsStatus: wsState.status,
  });

  if (!currency) {
    console.error("[auto-trade] ❌ Currency not available - stopping bot", {
      authState: wsState.auth,
      wsStatus: wsState.status,
    });
    set({ isRunning: false, error: "Currency not available — is the WebSocket connected?" });
    teardownEngineListeners();
    isPlacing = false;
    return;
  }

  const contractConfig = CONTRACT_TYPES[config.tradeMode];
  const contractType   = contractConfig.contractTypes[config.contractSide];

  try {
    const proposalPayload: Record<string, unknown> = {
      proposal: 1,
      amount: round2(stake),
      basis: "stake",
      contract_type: contractType,
      currency,
      duration: config.duration,
      duration_unit: config.durationUnit,
      underlying_symbol: config.symbol,
      // subscribe omitted intentionally — one-shot request
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

    pendingContractId = buy.contract_id;

    const record: BotTradeRecord = {
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

    set((s) => ({
      currentStake: round2(stake),
      sessionTrades: [record, ...s.sessionTrades],
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Trade placement failed.";
    set({ isRunning: false, error: msg });
    teardownEngineListeners();
  } finally {
    isPlacing = false;
  }
}

// ─── Engine: settlement handler (shared by portfolio watcher + recovery) ──────

function handleSettlement(
  contractId: number,
  statusStr: string,
  rawProfit: number | string | unknown,
  set: (partial: Partial<AutoTradeState> | ((s: AutoTradeState) => Partial<AutoTradeState>)) => void,
  get: () => AutoTradeState
) {
  if (pendingContractId !== contractId) return;

  const settled = statusStr === "won" || statusStr === "lost";
  if (!settled) return;

  // Clear pending immediately — prevents double-fire
  pendingContractId = null;

  const won    = statusStr === "won";
  const config = botConfig;
  if (!config) return;

  const profit =
    typeof rawProfit === "number"
      ? rawProfit
      : typeof rawProfit === "string"
      ? parseFloat(rawProfit)
      : 0;
  const safeProfit = Number.isNaN(profit) ? 0 : profit;

  const current = get();
  const newPL           = round2(current.accumulatedPL + safeProfit);
  const newConsecLosses = won ? 0 : current.consecutiveLosses + 1;
  const nextStake       = won
    ? config.baseStake
    : round2(current.currentStake * config.multiplier);

  const updatedTrades = current.sessionTrades.map((t) =>
    t.contractId === contractId
      ? { ...t, result: won ? ("win" as const) : ("loss" as const), profit: round2(safeProfit) }
      : t
  );

  // Safety rails
  if (newConsecLosses >= config.maxConsecutiveLosses) {
    teardownEngineListeners();
    set({ accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "max_losses" });
    return;
  }
  if (newPL >= config.takeProfitLimit) {
    teardownEngineListeners();
    set({ accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "take_profit" });
    return;
  }
  if (newPL <= -config.stopLossLimit) {
    teardownEngineListeners();
    set({ accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "stop_loss" });
    return;
  }
  if (nextStake > config.maxStakeCeiling) {
    teardownEngineListeners();
    set({ accumulatedPL: newPL, consecutiveLosses: newConsecLosses, sessionTrades: updatedTrades, isRunning: false, stopReason: "max_stake" });
    return;
  }

  // All rails clear — update state and schedule next trade after 2s
  set({ accumulatedPL: newPL, consecutiveLosses: newConsecLosses, currentStake: nextStake, sessionTrades: updatedTrades });

  clearNextTradeTimer(); // guard against double-schedule
  nextTradeTimer = setTimeout(() => {
    nextTradeTimer = null;
    if (get().isRunning) {
      void placeTrade(nextStake, set, get);
    }
  }, 2000);
}

// ─── Engine: portfolio watcher (primary settlement path) ─────────────────────

function registerPortfolioWatcher(
  set: (partial: Partial<AutoTradeState> | ((s: AutoTradeState) => Partial<AutoTradeState>)) => void,
  get: () => AutoTradeState
) {
  portfolioUnsub = useDerivSocketStore.subscribe(
    (wsState) => {
      const contractId = pendingContractId;
      if (contractId === null) return;

      const entry = wsState.portfolio[contractId];
      if (!entry) return;

      const rawStatus   = typeof entry.status === "string" ? entry.status.toLowerCase() : "";
      const isSold      = entry.is_sold === true || (entry.is_sold as unknown) === 1;
      const hasSellTime = typeof entry.sell_time === "number";
      const isSettled   =
        isSold ||
        hasSellTime ||
        ["won", "lost", "sold", "expired", "settled", "closed"].includes(rawStatus);

      if (!isSettled) return;

      const isWin           = rawStatus === "won" || (rawStatus !== "lost" && typeof entry.profit === "number" && entry.profit > 0);
      const normalizedStatus = isWin ? "won" : "lost";

      handleSettlement(contractId, normalizedStatus, entry.profit, set, get);
    }
  );
}

// ─── Engine: WS status watcher (reconnect recovery) ──────────────────────────

function registerWsStatusWatcher(
  set: (partial: Partial<AutoTradeState> | ((s: AutoTradeState) => Partial<AutoTradeState>)) => void,
  get: () => AutoTradeState
) {
  wsStatusUnsub = useDerivSocketStore.subscribe(
    (wsState) => {
      const status = wsState.status;
      const justReconnected = status === "Connected" && prevWsStatus !== "Connected";
      prevWsStatus = status;

      if (!justReconnected) return;
      if (!get().isRunning) return;

      const contractId = pendingContractId;
      if (contractId === null) return;

      void (async () => {
        try {
          type POCResp = {
            proposal_open_contract?: {
              contract_id?: number;
              status?: string;
              profit?: number | string;
              is_sold?: boolean | number;
              sell_time?: number;
            };
          };
          const resp = await useDerivSocketStore.getState().request<POCResp>({
            proposal_open_contract: 1,
            contract_id: contractId,
          });

          const poc = resp.proposal_open_contract;
          if (!poc) return;

          const rawStatus   = typeof poc.status === "string" ? poc.status.toLowerCase() : "";
          const isSold      = poc.is_sold === true || poc.is_sold === 1;
          const hasSellTime = typeof poc.sell_time === "number";
          const isSettled   =
            isSold ||
            hasSellTime ||
            ["won", "lost", "sold", "expired", "settled", "closed"].includes(rawStatus);

          if (!isSettled) return;

          const rawProfit   = poc.profit;
          const profit      = typeof rawProfit === "number" ? rawProfit : typeof rawProfit === "string" ? parseFloat(rawProfit) : 0;
          const isWin       = rawStatus === "won" || (rawStatus !== "lost" && !Number.isNaN(profit) && profit > 0);
          const normalized  = isWin ? "won" : "lost";

          handleSettlement(contractId, normalized, poc.profit, set, get);
        } catch {
          // Recovery failed — bot remains pending until next portfolio message
        }
      })();
    }
  );
}

// ─── Engine: heartbeat ────────────────────────────────────────────────────────

function startHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!useAutoTradeStore.getState().isRunning) {
      clearHeartbeat();
      return;
    }
    try {
      useDerivSocketStore.getState().send({ ping: 1 });
    } catch {
      // Socket not open — reconnect watcher handles recovery
    }
  }, 30_000);
}
