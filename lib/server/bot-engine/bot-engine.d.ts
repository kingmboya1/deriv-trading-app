import { BotState, StrategyConfig, StopReason } from "./types";
import { DerivConnection } from "./deriv-connection";
/**
 * BotEngine: Core server-side bot execution engine.
 *
 * This class interprets JSON strategy configurations and executes automated trading
 * via Deriv WebSocket API. Each instance represents a single bot session for a user.
 *
 * Responsibilities:
 * - Execute trade placement logic per strategy rules
 * - Apply martingale stake progression on losses
 * - Monitor contract settlements via WebSocket subscriptions
 * - Enforce stop conditions (max losses, take profit, stop loss, max stake)
 * - Maintain session state (current stake, consecutive losses, accumulated P/L)
 * - Schedule trades with inter-trade delay
 *
 * Requirements: 3.11, 21.1, 21.2
 */
export declare class BotEngine {
    private botState;
    private config;
    private derivToken;
    private userId;
    private derivConnection;
    private nextTradeTimer;
    /**
     * Creates a new BotEngine instance.
     *
     * @param userId - Unique identifier for the user owning this bot session
     * @param config - Immutable strategy configuration defining trade behavior
     * @param derivToken - Deriv API authentication token
     *
     * Preconditions:
     * - userId is non-empty string
     * - config has been validated by validateStrategyConfig()
     * - derivToken is valid Deriv API token
     *
     * Postconditions:
     * - Bot state initialized with default values
     * - Config frozen as immutable
     * - Ready to start trading
     */
    constructor(userId: string, config: StrategyConfig, derivToken: string);
    /**
     * Deep freezes an object to make it immutable at all levels.
     *
     * @param obj - Object to freeze
     * @returns Deeply frozen object
     */
    private deepFreeze;
    /**
     * Rounds a number to 2 decimal places.
     *
     * Used for all currency calculations to maintain consistent precision
     * across stake calculations and P/L accounting.
     *
     * @param n - Number to round
     * @returns Number rounded to 2 decimal places
     *
     * Requirements: 21.1, 21.2
     *
     * Examples:
     * - round2(1.234) → 1.23
     * - round2(0.355) → 0.36 (banker's rounding)
     * - round2(10) → 10.00
     */
    round2(n: number): number;
    /**
     * Generates a unique trade identifier.
     *
     * Creates a timestamp-based ID with random suffix for uniqueness.
     * Format: "trade_{timestamp}_{random}"
     *
     * @returns Unique trade ID string
     *
     * Requirements: 9.3
     *
     * Example:
     * - generateTradeId() → "trade_1704067200000_abc123"
     */
    generateTradeId(): string;
    /**
     * Gets the current bot state.
     *
     * @returns Current bot state snapshot
     */
    getState(): Readonly<BotState>;
    /**
     * Gets the strategy configuration.
     *
     * @returns Immutable strategy configuration
     */
    getConfig(): Readonly<StrategyConfig>;
    /**
     * Gets the user ID for this bot session.
     *
     * @returns User ID string
     */
    getUserId(): string;
    /**
     * Calculates the next stake based on trade outcome (martingale progression).
     *
     * Implements martingale stake progression: reset to initial on wins,
     * multiply by multiplier on losses. Also manages consecutive losses counter.
     *
     * @param isWin - Whether the last trade was a win
     * @returns Next stake amount rounded to 2 decimal places
     *
     * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6
     *
     * Preconditions:
     * - botState.currentStake > 0
     * - config.stake.multiplier >= 1
     * - config.stake.initial > 0
     *
     * Postconditions:
     * - If isWin === true: returns config.stake.initial, consecutiveLosses reset to 0
     * - If isWin === false: returns round2(currentStake * multiplier), consecutiveLosses incremented
     * - Result always >= config.stake.initial
     * - botState.consecutiveLosses updated appropriately
     *
     * Examples:
     * - calculateNextStake(true) after loss streak → returns initial stake, consecutiveLosses = 0
     * - calculateNextStake(false) with stake 1.0, multiplier 2 → returns 2.0, consecutiveLosses++
     * - calculateNextStake(false) with stake 2.5, multiplier 2 → returns 5.0, consecutiveLosses++
     */
    calculateNextStake(isWin: boolean): number;
    /**
     * Checks all stop conditions and updates bot state accordingly.
     *
     * Evaluates four stop conditions after each contract settlement:
     * 1. Max consecutive losses reached
     * 2. Take profit threshold reached or exceeded
     * 3. Stop loss threshold reached or exceeded (negative P/L)
     * 4. Next stake would exceed max stake limit
     *
     * When any condition is met, sets isRunning to false and populates stopReason.
     * This blocks all subsequent trade placements.
     *
     * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
     *
     * Preconditions:
     * - Called after contract settlement and stake calculation
     * - botState.consecutiveLosses is up to date
     * - botState.accumulatedPL is up to date
     * - botState.currentStake reflects the next stake to be used
     *
     * Postconditions:
     * - If any stop condition met: botState.isRunning = false, botState.stopReason set
     * - If no stop condition met: botState unchanged
     *
     * Examples:
     * - consecutiveLosses = 5, maxConsecutiveLosses = 5 → isRunning = false, stopReason = "max_losses"
     * - accumulatedPL = 5.5, takeProfitAmount = 5 → isRunning = false, stopReason = "take_profit"
     * - accumulatedPL = -10.5, stopLossAmount = 10 → isRunning = false, stopReason = "stop_loss"
     * - currentStake = 11, maxStake = 10 → isRunning = false, stopReason = "max_stake"
     */
    checkStopConditions(): void;
    /**
     * Sets the DerivConnection instance for this bot engine.
     *
     * This must be called before placeTrade() is invoked.
     *
     * @param connection - The DerivConnection instance
     *
     * Requirements: 2.1, 2.2
     */
    setDerivConnection(connection: DerivConnection): void;
    /**
     * Starts the bot session: connects to Deriv, authorizes, and places first trade.
     *
     * This method orchestrates the full session start workflow:
     * 1. Creates and connects DerivConnection
     * 2. Authorizes with Deriv API
     * 3. Retrieves account currency
     * 4. Subscribes to proposal_open_contract updates
     * 5. Marks session as running
     * 6. Places the first trade
     *
     * Requirements: 2.1, 2.2, 2.6, 4.1
     *
     * @returns Promise that resolves when session is started and first trade is placed
     *
     * Preconditions:
     * - derivToken is valid
     * - userId is non-empty
     * - Bot state is initialized
     *
     * Postconditions:
     * - DerivConnection established and authorized
     * - botState.currency set from authorization response
     * - botState.isRunning set to true
     * - First trade placed with initial stake
     * - Portfolio subscription active
     *
     * Throws:
     * - Error if connection or authorization fails
     * - Error if first trade placement fails
     */
    startSession(): Promise<void>;
    /**
     * Handles incoming proposal_open_contract subscription updates.
     *
     * Detects contract settlements and triggers the settlement handler.
     *
     * @param data - The WebSocket message data
     */
    private handleContractUpdate;
    /**
     * Places a trade using the specified stake amount.
     *
     * Implements the complete trade placement workflow:
     * 1. Validates preconditions (running state, no pending contract)
     * 2. Builds proposal request payload with contract parameters
     * 3. Sends proposal request to get proposalId and askPrice
     * 4. Sends buy request to purchase the contract
     * 5. Records pendingContractId in botState
     * 6. Creates TradeRecord with result="pending"
     * 7. Adds trade to botState.trades array
     *
     * On error: sets error field, stops session, returns null.
     *
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.8, 9.1
     *
     * @param stake - The stake amount for this trade (must be > 0)
     * @returns The contract ID if successful, null if failed or preconditions not met
     *
     * Preconditions:
     * - botState.isRunning === true
     * - botState.pendingContractId === null
     * - derivConnection is set and connected
     * - stake > 0 and stake <= config.stake.maxStake
     *
     * Postconditions:
     * - If successful:
     *   - botState.pendingContractId set to purchased contract ID
     *   - botState.currentStake updated to rounded stake
     *   - New TradeRecord added to botState.trades with result="pending"
     * - If failed:
     *   - botState.error set with error message
     *   - botState.isRunning set to false
     *   - Returns null
     *
     * Examples:
     * - placeTrade(0.35) → sends proposal, buys contract, returns contractId
     * - placeTrade(1.0) when pendingContractId !== null → returns null (no action)
     * - placeTrade(0.5) when API fails → sets error, stops session, returns null
     */
    placeTrade(stake: number): Promise<number | null>;
    /**
     * Handles contract settlement and determines next action.
     *
     * Processes contract settlements from proposal_open_contract messages:
     * 1. Validates contractId matches pendingContractId
     * 2. Clears pendingContractId immediately
     * 3. Determines win/loss from status
     * 4. Parses profit value (handles non-numeric as zero)
     * 5. Updates trade record with result and profit
     * 6. Updates accumulated P/L
     * 7. Calculates next stake using calculateNextStake()
     * 8. Calls checkStopConditions()
     * 9. Returns next stake if continuing, null if stopped
     *
     * Requirements: 4.7, 4.9, 6.1, 6.5
     *
     * @param contractId - The contract ID from the settlement message
     * @param status - The settlement status ("won" or "lost")
     * @param profit - The profit/loss amount from the contract
     * @returns Next stake amount if continuing, null if stopped
     *
     * Preconditions:
     * - contractId should match botState.pendingContractId
     * - status is either "won" or "lost"
     * - Trade record exists for contractId
     *
     * Postconditions:
     * - If contractId matches pendingContractId:
     *   - pendingContractId cleared
     *   - Trade record updated with result and profit
     *   - accumulatedPL updated
     *   - consecutiveLosses updated
     *   - currentStake updated to next stake
     *   - Stop conditions checked
     * - If stopped: returns null
     * - If continuing: returns next stake for scheduling
     *
     * Examples:
     * - handleContractSettlement(123, "won", 0.65) → updates state, returns initial stake
     * - handleContractSettlement(123, "lost", -0.35) → updates state, returns doubled stake
     * - handleContractSettlement(999, "won", 0.65) → ignores (wrong contract), returns null
     */
    handleContractSettlement(contractId: number, status: string, profit: number): number | null;
    /**
     * Schedules the next trade after the configured inter-trade delay.
     *
     * Uses setTimeout to delay the next trade placement. The timer can be
     * cancelled if the session is stopped before the timer fires.
     *
     * Requirements: 8.1, 8.2, 8.3, 8.4
     *
     * @param stake - The stake amount for the next trade
     *
     * Preconditions:
     * - botState.isRunning === true
     * - config.execution.interTradeDelay >= 2000
     * - No pending contract
     *
     * Postconditions:
     * - Timer scheduled to place trade after interTradeDelay milliseconds
     * - nextTradeTimer reference stored for cleanup
     * - Timer checks isRunning before placing trade
     *
     * Examples:
     * - scheduleNextTrade(0.35) with delay 2000ms → trade placed after 2 seconds
     * - scheduleNextTrade(1.0) then stopSession() → trade cancelled, never placed
     */
    private scheduleNextTrade;
    /**
     * Stops the bot session and cleans up resources.
     *
     * Cancels any scheduled trades, marks the session as stopped, and clears
     * the pending contract. This method is idempotent and can be called
     * multiple times safely.
     *
     * Requirements: 8.3, 15.1
     *
     * @param reason - Optional stop reason (defaults to "manual")
     *
     * Preconditions:
     * - None (can be called at any time)
     *
     * Postconditions:
     * - nextTradeTimer cancelled and cleared
     * - botState.isRunning set to false
     * - botState.stopReason set if not already set
     * - No new trades will be placed
     *
     * Examples:
     * - stopSession("manual") → session stopped by user
     * - stopSession() during scheduled trade → trade cancelled
     */
    stopSession(reason?: StopReason): void;
}
//# sourceMappingURL=bot-engine.d.ts.map