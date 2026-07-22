"use client";

/**
 * auto-trade-store.ts — D'Alembert bot engine (hardcoded config).
 *
 * Strategy  : D'Alembert — win reduces stake by 1 unit, loss increases by 1 unit.
 * Symbol    : R_50  (Volatility 50)
 * Contract  : DIGITDIFF (Differs)
 * Duration  : 1 tick
 * Base stake: $10   Unit size: $1
 * Take profit: $80  Max loss : $12
 */

import { create } from "zustand";
import { useDerivSocketStore } from "@/lib/derivsocket";
import type { BuyContractType } from "@/lib/contract-types";

// ─── Hardcoded bot config ─────────────────────────────────────────────────────

const BOT = {
  symbol:        "R_50",
  contractType:  "DIGITDIFF" as BuyContractType,
  duration:      1,
  durationUnit:  "t" as const,
  baseStake:     10,
  unitSize:      1,       // D'Alembert step
  takeProfit:    80,      // stop when totalProfit >= 80
  maxLoss:       12,      // stop when totalProfit <= -12
} as const;

// ─── Public types ─────────────────────────────────────────────────────────────

export type StopReason =
  | "take_profit"
  | "stop_loss"
  | "manual"
  | null;

// Keep BotConfig exported so existing imports don't break —
// the engine no longer uses it but AutoTradePanel still references the type.
export interface BotConfig {
  tradeMode: string;
  contractSide: 0 | 1;
  symbol: string;
  baseStake: number;
  multiplier: number;
  duration: number;
  durationUnit: string;
  barrier: string;
  maxConsecutiveLosses: number;
  takeProfitLimit: number;
  stopLossLimit: number;
  maxStakeCeiling: number;
}

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

export interface AutoTradeState {
  isRunning: boolean;
  currentStake: number;
  dalembertSize: number;
  accumulatedPL: number;
  sessionTrades: BotTradeRecord[];
  stopReason: StopReason;
  error: string | null;
  startBot: (takeProfit: number, maxLoss: number) => void;
  stopBot: (reason?: StopReason) => void;
  resetSession: () => void;
}

// ─── Module-level engine state ────────────────────────────────────────────────

let pendingContractId: number | null = null;
let isPlacing = false;
let nextTradeTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let prevWsStatus = "";
let portfolioUnsub: (() => void) | null = null;
let wsStatusUnsub: (() => void) | null = null;

// Session-level limits set by the user at start
let sessionTakeProfit = BOT.takeProfit;
let sessionMaxLoss    = BOT.maxLoss;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const makeId = () => `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function clearNextTradeTimer() {
  if (nextTradeTimer !== null) { clearTimeout(nextTradeTimer); nextTradeTimer = null; }
}
function clearHeartbeat() {
  if (heartbeatTimer !== null) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}
function teardown() {
  portfolioUnsub?.(); portfolioUnsub = null;
  wsStatusUnsub?.();  wsStatusUnsub  = null;
  clearNextTradeTimer();
  clearHeartbeat();
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAutoTradeStore = create<AutoTradeState>((set, get) => ({
  isRunning:      false,
  currentStake:   BOT.baseStake,
  dalembertSize:  1,
  accumulatedPL:  0,
  sessionTrades:  [],
  stopReason:     null,
  error:          null,

  startBot: (takeProfit: number, maxLoss: number) => {
    teardown();
    pendingContractId  = null;
    isPlacing          = false;
    prevWsStatus       = "";
    sessionTakeProfit  = takeProfit;
    sessionMaxLoss     = maxLoss;

    set({
      isRunning:     true,
      currentStake:  BOT.baseStake,
      dalembertSize: 1,
      accumulatedPL: 0,
      sessionTrades: [],
      stopReason:    null,
      error:         null,
    });

    registerPortfolioWatcher(set, get);
    registerWsStatusWatcher(set, get);
    startHeartbeat();
    void placeTrade(BOT.baseStake, 1, set, get);
  },

  stopBot: (reason: StopReason = "manual") => {
    teardown();
    pendingContractId = null;
    isPlacing         = false;
    set((s) => ({ ...s, isRunning: false, stopReason: reason }));
  },

  resetSession: () => {
    teardown();
    pendingContractId = null;
    isPlacing         = false;
    set({
      isRunning:     false,
      currentStake:  BOT.baseStake,
      dalembertSize: 1,
      accumulatedPL: 0,
      sessionTrades: [],
      stopReason:    null,
      error:         null,
    });
  },
}));

// ─── Place one trade ──────────────────────────────────────────────────────────

async function placeTrade(
  stake: number,
  size: number,
  set: (p: Partial<AutoTradeState> | ((s: AutoTradeState) => Partial<AutoTradeState>)) => void,
  get: () => AutoTradeState
) {
  if (!get().isRunning) return;
  if (isPlacing) return;
  if (pendingContractId !== null) return;

  isPlacing = true;

  const ws       = useDerivSocketStore.getState();
  const currency = ws.auth.currency?.toUpperCase();

  if (!currency) {
    set({ isRunning: false, error: "Currency not available — is the WebSocket connected?" });
    teardown();
    isPlacing = false;
    return;
  }

  try {
    type ProposalResp = { proposal?: { id: string; ask_price: number; payout: number } };
    const pr = await ws.request<ProposalResp>({
      proposal:          1,
      amount:            round2(stake),
      basis:             "stake",
      contract_type:     BOT.contractType,
      currency,
      duration:          BOT.duration,
      duration_unit:     BOT.durationUnit,
      underlying_symbol: BOT.symbol,
    });

    const proposal = pr.proposal;
    if (!proposal?.id || proposal.ask_price === undefined) throw new Error("No proposal returned.");

    type BuyResp = { buy?: { contract_id: number; buy_price: number; payout: number } };
    const br = await ws.request<BuyResp>({ buy: proposal.id, price: proposal.ask_price });
    const buy = br.buy;
    if (!buy?.contract_id) throw new Error("Buy response missing contract_id.");

    pendingContractId = buy.contract_id;

    const record: BotTradeRecord = {
      id: makeId(),
      contractId:   buy.contract_id,
      contractType: BOT.contractType,
      symbol:       BOT.symbol,
      stake:        round2(stake),
      result:       "pending",
      payout:       buy.payout ?? 0,
      profit:       0,
      timestamp:    Date.now(),
    };

    set((s) => ({
      currentStake:  round2(stake),
      dalembertSize: size,
      sessionTrades: [record, ...s.sessionTrades],
    }));
  } catch (err) {
    set({ isRunning: false, error: err instanceof Error ? err.message : "Trade failed." });
    teardown();
  } finally {
    isPlacing = false;
  }
}

// ─── Settlement handler ───────────────────────────────────────────────────────

function handleSettlement(
  contractId: number,
  statusStr: string,
  rawProfit: unknown,
  set: (p: Partial<AutoTradeState> | ((s: AutoTradeState) => Partial<AutoTradeState>)) => void,
  get: () => AutoTradeState
) {
  if (pendingContractId !== contractId) return;
  const settled = statusStr === "won" || statusStr === "lost";
  if (!settled) return;

  pendingContractId = null;

  const won = statusStr === "won";
  const profit = typeof rawProfit === "number" ? rawProfit
    : typeof rawProfit === "string" ? parseFloat(rawProfit) : 0;
  const safeProfit = isNaN(profit) ? 0 : profit;

  const current  = get();
  const newPL    = round2(current.accumulatedPL + safeProfit);
  const prevSize = current.dalembertSize;

  // D'Alembert: win → size - 1 (min 1), loss → size + 1
  const newSize  = won ? Math.max(1, prevSize - 1) : prevSize + 1;
  const nextStake = round2(BOT.baseStake + (newSize - 1) * BOT.unitSize);

  const updatedTrades = current.sessionTrades.map((t) =>
    t.contractId === contractId
      ? { ...t, result: won ? ("win" as const) : ("loss" as const), profit: round2(safeProfit) }
      : t
  );

  // Stop conditions
  if (newPL >= sessionTakeProfit) {
    teardown();
    set({ accumulatedPL: newPL, dalembertSize: newSize, sessionTrades: updatedTrades, isRunning: false, stopReason: "take_profit" });
    return;
  }
  if (newPL <= -sessionMaxLoss) {
    teardown();
    set({ accumulatedPL: newPL, dalembertSize: newSize, sessionTrades: updatedTrades, isRunning: false, stopReason: "stop_loss" });
    return;
  }

  set({ accumulatedPL: newPL, dalembertSize: newSize, currentStake: nextStake, sessionTrades: updatedTrades });

  clearNextTradeTimer();
  nextTradeTimer = setTimeout(() => {
    nextTradeTimer = null;
    if (get().isRunning) void placeTrade(nextStake, newSize, set, get);
  }, 2000);
}

// ─── Portfolio watcher ────────────────────────────────────────────────────────

function registerPortfolioWatcher(
  set: (p: Partial<AutoTradeState> | ((s: AutoTradeState) => Partial<AutoTradeState>)) => void,
  get: () => AutoTradeState
) {
  portfolioUnsub = useDerivSocketStore.subscribe((ws) => {
    const contractId = pendingContractId;
    if (contractId === null) return;
    const entry = ws.portfolio[contractId];
    if (!entry) return;

    const rawStatus = typeof entry.status === "string" ? entry.status.toLowerCase() : "";
    const isSold    = entry.is_sold === true || (entry.is_sold as unknown) === 1;
    const settled   = isSold || typeof entry.sell_time === "number" ||
      ["won","lost","sold","expired","settled","closed"].includes(rawStatus);
    if (!settled) return;

    const isWin = rawStatus === "won" || (rawStatus !== "lost" && typeof entry.profit === "number" && entry.profit > 0);
    handleSettlement(contractId, isWin ? "won" : "lost", entry.profit, set, get);
  });
}

// ─── WS reconnect watcher ─────────────────────────────────────────────────────

function registerWsStatusWatcher(
  set: (p: Partial<AutoTradeState> | ((s: AutoTradeState) => Partial<AutoTradeState>)) => void,
  get: () => AutoTradeState
) {
  wsStatusUnsub = useDerivSocketStore.subscribe((ws) => {
    const status = ws.status;
    const justReconnected = status === "Connected" && prevWsStatus !== "Connected";
    prevWsStatus = status;
    if (!justReconnected || !get().isRunning) return;
    const contractId = pendingContractId;
    if (contractId === null) return;

    void (async () => {
      try {
        type POCResp = { proposal_open_contract?: { contract_id?: number; status?: string; profit?: number | string; is_sold?: boolean | number; sell_time?: number } };
        const resp = await useDerivSocketStore.getState().request<POCResp>({ proposal_open_contract: 1, contract_id: contractId });
        const poc  = resp.proposal_open_contract;
        if (!poc) return;
        const rawStatus = typeof poc.status === "string" ? poc.status.toLowerCase() : "";
        const isSold    = poc.is_sold === true || poc.is_sold === 1;
        const settled   = isSold || typeof poc.sell_time === "number" ||
          ["won","lost","sold","expired","settled","closed"].includes(rawStatus);
        if (!settled) return;
        const p     = poc.profit;
        const profit = typeof p === "number" ? p : typeof p === "string" ? parseFloat(p) : 0;
        const isWin = rawStatus === "won" || (rawStatus !== "lost" && !isNaN(profit) && profit > 0);
        handleSettlement(contractId, isWin ? "won" : "lost", poc.profit, set, get);
      } catch { /* recovery failed */ }
    })();
  });
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function startHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!useAutoTradeStore.getState().isRunning) { clearHeartbeat(); return; }
    try { useDerivSocketStore.getState().send({ ping: 1 }); } catch { /* ignore */ }
  }, 30_000);
}
