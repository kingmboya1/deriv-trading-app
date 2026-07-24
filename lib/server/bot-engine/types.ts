/**
 * Type definitions for the server-side bot engine.
 * These types define the structure of strategy configs and bot state.
 */

// ============================================================================
// Strategy Configuration Types
// ============================================================================

export interface StrategyConfig {
  // Metadata
  name: string;
  version: string;
  description?: string;
  
  // Trade Parameters
  trade: {
    contractType: ContractType;
    symbol: string;
    duration: number;
    durationUnit: DurationUnit;
    barrier?: string;
  };
  
  // Stake Management (Martingale-style)
  stake: {
    initial: number;
    multiplier: number;
    maxStake: number;
  };
  
  // Risk Management & Stop Conditions
  risk: {
    maxConsecutiveLosses: number;
    takeProfitAmount: number;
    stopLossAmount: number;
  };
  
  // Execution Behavior
  execution: {
    interTradeDelay: number;
    autoRestart: boolean;
  };
}

export type ContractType =
  | "CALL"          // Rise
  | "PUT"           // Fall
  | "DIGITODD"      // Odd
  | "DIGITEVEN"     // Even
  | "DIGITMATCH"    // Matches
  | "DIGITDIFF"     // Differs
  | "DIGITOVER"     // Over
  | "DIGITUNDER";   // Under

export type DurationUnit = "t" | "s" | "m" | "h" | "d";

// ============================================================================
// Bot Session Types
// ============================================================================

export interface BotState {
  isRunning: boolean;
  currentStake: number;
  consecutiveLosses: number;
  accumulatedPL: number;
  pendingContractId: number | null;
  stopReason: StopReason | null;
  error: string | null;
  currency: string | null;
}

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
  contractType: string;
  symbol: string;
  stake: number;
  result: "win" | "loss" | "pending";
  payout: number;
  profit: number;
  timestamp: number;
}

export interface BotStatus {
  sessionId: string;
  isRunning: boolean;
  currentStake: number;
  consecutiveLosses: number;
  accumulatedPL: number;
  stopReason: StopReason;
  error: string | null;
  trades: TradeRecord[];
}

// ============================================================================
// Deriv API Types
// ============================================================================

export interface ProposalResponse {
  proposal?: {
    id: string;
    ask_price: number;
    payout: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface BuyResponse {
  buy?: {
    contract_id: number;
    buy_price: number;
    payout: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PortfolioContract {
  contract_id: number;
  contract_type: string;
  status?: string;
  profit?: number | string;
  is_sold?: boolean | number;
  sell_time?: number;
}

export interface BalanceResponse {
  balance?: {
    balance: number;
    currency: string;
  };
}
