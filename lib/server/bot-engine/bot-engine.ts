import { BotState, StrategyConfig, TradeRecord, ProposalResponse, BuyResponse, StopReason } from "./types";
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
export class BotEngine {
  private botState: BotState;
  private config: Readonly<StrategyConfig>;
  private derivToken: string;
  private userId: string;
  private derivConnection: DerivConnection | null = null;
  private nextTradeTimer: NodeJS.Timeout | null = null;

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
  constructor(userId: string, config: StrategyConfig, derivToken: string) {
    this.userId = userId;
    // Deep freeze config for immutability (Req 22.1)
    this.config = this.deepFreeze({ ...config });
    this.derivToken = derivToken;

    // Initialize bot state
    this.botState = {
      isRunning: false,
      currentStake: config.stake.initial,
      consecutiveLosses: 0,
      accumulatedPL: 0,
      pendingContractId: null,
      stopReason: null,
      error: null,
      currency: null, // Will be set after WebSocket connection
      trades: [], // Initialize trade history array
    };
  }

  /**
   * Deep freezes an object to make it immutable at all levels.
   * 
   * @param obj - Object to freeze
   * @returns Deeply frozen object
   */
  private deepFreeze<T>(obj: T): Readonly<T> {
    Object.freeze(obj);
    
    Object.getOwnPropertyNames(obj).forEach((prop) => {
      const value = (obj as any)[prop];
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        this.deepFreeze(value);
      }
    });
    
    return obj as Readonly<T>;
  }

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
  round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

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
  generateTradeId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `trade_${timestamp}_${random}`;
  }

  /**
   * Gets the current bot state.
   * 
   * @returns Current bot state snapshot
   */
  getState(): Readonly<BotState> {
    return { ...this.botState };
  }

  /**
   * Gets the strategy configuration.
   * 
   * @returns Immutable strategy configuration
   */
  getConfig(): Readonly<StrategyConfig> {
    return this.config;
  }

  /**
   * Gets the user ID for this bot session.
   * 
   * @returns User ID string
   */
  getUserId(): string {
    return this.userId;
  }

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
  calculateNextStake(isWin: boolean): number {
    if (isWin) {
      // Win: Reset to initial stake and reset consecutive losses counter (Req 5.2, 5.6)
      this.botState.consecutiveLosses = 0;
      return this.config.stake.initial;
    } else {
      // Loss: Multiply current stake by multiplier and increment consecutive losses (Req 5.1, 5.5)
      this.botState.consecutiveLosses += 1;
      const nextStake = this.botState.currentStake * this.config.stake.multiplier;
      // Round to 2 decimal places (Req 5.3)
      return this.round2(nextStake);
    }
  }

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
  checkStopConditions(): void {
    // Check max consecutive losses (Req 7.1)
    if (this.botState.consecutiveLosses >= this.config.risk.maxConsecutiveLosses) {
      this.botState.isRunning = false;
      this.botState.stopReason = "max_losses";
      return;
    }

    // Check take profit threshold (Req 7.2)
    if (this.botState.accumulatedPL >= this.config.risk.takeProfitAmount) {
      this.botState.isRunning = false;
      this.botState.stopReason = "take_profit";
      return;
    }

    // Check stop loss threshold - negative P/L (Req 7.3)
    if (this.botState.accumulatedPL <= -this.config.risk.stopLossAmount) {
      this.botState.isRunning = false;
      this.botState.stopReason = "stop_loss";
      return;
    }

    // Check max stake limit (Req 7.4)
    if (this.botState.currentStake > this.config.stake.maxStake) {
      this.botState.isRunning = false;
      this.botState.stopReason = "max_stake";
      return;
    }

    // No stop conditions met - continue running
  }

  /**
   * Sets the DerivConnection instance for this bot engine.
   * 
   * This must be called before placeTrade() is invoked.
   * 
   * @param connection - The DerivConnection instance
   * 
   * Requirements: 2.1, 2.2
   */
  setDerivConnection(connection: DerivConnection): void {
    this.derivConnection = connection;
  }

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
  async startSession(): Promise<void> {
    // Step 1: Create and connect DerivConnection (Req 2.1)
    const connection = new DerivConnection(this.derivToken);
    await connection.connect();
    
    // Step 2: Connection automatically authorizes in connect() (Req 2.2)
    
    // Step 3: Get account currency from authorization
    // We need to get the currency - request balance to get it
    const balanceResponse = await connection.request<{
      balance?: { currency: string; balance: number };
      error?: { message: string };
    }>({ balance: 1 });
    
    if (balanceResponse.error) {
      throw new Error(balanceResponse.error.message);
    }
    
    if (!balanceResponse.balance) {
      throw new Error("Failed to retrieve account currency");
    }
    
    this.botState.currency = balanceResponse.balance.currency;
    
    // Step 4: Set connection on engine
    this.setDerivConnection(connection);
    
    // Step 5: Subscribe to proposal_open_contract for settlement detection (Req 2.6, 4.7)
    connection.subscribe(
      { proposal_open_contract: 1, subscribe: 1 },
      (data: unknown) => {
        this.handleContractUpdate(data);
      }
    );
    
    // Step 6: Mark session as running
    this.botState.isRunning = true;
    
    // Step 7: Place first trade with initial stake (Req 4.1)
    await this.placeTrade(this.config.stake.initial);
  }

  /**
   * Handles incoming proposal_open_contract subscription updates.
   * 
   * Detects contract settlements and triggers the settlement handler.
   * 
   * @param data - The WebSocket message data
   */
  private handleContractUpdate(data: unknown): void {
    try {
      const message = data as {
        proposal_open_contract?: {
          contract_id?: number;
          status?: string;
          profit?: number | string;
          is_sold?: number | boolean;
        };
      };
      
      const contract = message.proposal_open_contract;
      if (!contract) {
        return;
      }
      
      // Check if this is a settlement (contract is sold)
      const isSold = contract.is_sold === 1 || contract.is_sold === true;
      if (!isSold) {
        return;
      }
      
      // Check if this is our pending contract
      if (contract.contract_id !== this.botState.pendingContractId) {
        return;
      }
      
      // Extract settlement data
      const contractId = contract.contract_id;
      const status = contract.status || "";
      const profit = typeof contract.profit === "number" 
        ? contract.profit 
        : parseFloat(String(contract.profit || 0));
      
      // Handle the settlement
      this.handleContractSettlement(contractId, status, profit);
      
    } catch (error) {
      console.error("[BotEngine] Error handling contract update:", error);
    }
  }

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
  async placeTrade(stake: number): Promise<number | null> {
    // Step 1: Validate preconditions (Req 4.8)
    if (!this.botState.isRunning) {
      return null;
    }

    if (this.botState.pendingContractId !== null) {
      // Previous contract still pending - cannot place new trade
      return null;
    }

    if (!this.derivConnection) {
      this.botState.error = "DerivConnection not initialized";
      this.botState.isRunning = false;
      return null;
    }

    // Round stake to 2 decimal places
    const roundedStake = this.round2(stake);

    // Step 2: Build proposal request payload (Req 4.2)
    const proposalPayload: Record<string, unknown> = {
      proposal: 1,
      amount: roundedStake,
      basis: "stake",
      contract_type: this.config.trade.contractType,
      currency: this.botState.currency,
      duration: this.config.trade.duration,
      duration_unit: this.config.trade.durationUnit,
      symbol: this.config.trade.symbol,
    };

    // Add barrier if specified in config
    if (this.config.trade.barrier) {
      proposalPayload.barrier = this.config.trade.barrier;
    }

    // Step 3: Send proposal request and get proposalId and askPrice (Req 4.2)
    let proposalId: string;
    let askPrice: number;
    let payout: number;

    try {
      const proposalResponse = await this.derivConnection.request<ProposalResponse>(proposalPayload);

      // Check for API error
      if (proposalResponse.error) {
        throw new Error(proposalResponse.error.message);
      }

      if (!proposalResponse.proposal) {
        throw new Error("Invalid proposal response: missing proposal data");
      }

      proposalId = proposalResponse.proposal.id;
      askPrice = proposalResponse.proposal.ask_price;
      payout = proposalResponse.proposal.payout;

    } catch (error) {
      // Handle proposal request failure (Req 4.6, 13.1, 13.3, 13.4)
      const errorMessage = error instanceof Error ? error.message : "Proposal request failed";
      this.botState.error = errorMessage;
      this.botState.isRunning = false;
      this.botState.stopReason = null;
      return null;
    }

    // Step 4: Send buy request with proposalId (Req 4.3)
    let contractId: number;
    let buyPrice: number;

    try {
      const buyResponse = await this.derivConnection.request<BuyResponse>({
        buy: proposalId,
        price: askPrice,
      });

      // Check for API error
      if (buyResponse.error) {
        throw new Error(buyResponse.error.message);
      }

      if (!buyResponse.buy) {
        throw new Error("Invalid buy response: missing buy data");
      }

      contractId = buyResponse.buy.contract_id;
      buyPrice = buyResponse.buy.buy_price;

    } catch (error) {
      // Handle buy request failure (Req 4.6, 13.2, 13.3, 13.4)
      const errorMessage = error instanceof Error ? error.message : "Buy request failed";
      this.botState.error = errorMessage;
      this.botState.isRunning = false;
      this.botState.stopReason = null;
      return null;
    }

    // Step 5: Record pendingContractId and update botState (Req 4.4)
    this.botState.pendingContractId = contractId;
    this.botState.currentStake = roundedStake;

    // Step 6: Create TradeRecord with result="pending" (Req 4.4, 9.1)
    const tradeRecord: TradeRecord = {
      id: this.generateTradeId(),
      contractId: contractId,
      contractType: this.config.trade.contractType,
      symbol: this.config.trade.symbol,
      stake: roundedStake,
      result: "pending",
      payout: payout,
      profit: 0,
      timestamp: Date.now(),
    };

    // Step 7: Add trade to botState.trades array (Req 9.1)
    this.botState.trades.push(tradeRecord);

    return contractId;
  }

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
  handleContractSettlement(contractId: number, status: string, profit: number): number | null {
    // Step 1: Validate contractId matches pendingContractId (Req 4.7)
    if (contractId !== this.botState.pendingContractId) {
      // Ignore outdated or wrong contract
      return null;
    }

    // Step 2: Clear pendingContractId immediately (Req 4.9)
    this.botState.pendingContractId = null;

    // Step 3: Determine win/loss from status
    const isWin = status === "won";

    // Step 4: Parse profit value (handle non-numeric as zero) (Req 6.1)
    let safeProfit: number;
    if (typeof profit === "number" && !isNaN(profit)) {
      safeProfit = profit;
    } else {
      // Handle non-numeric values as zero
      const parsed = parseFloat(String(profit));
      safeProfit = isNaN(parsed) ? 0 : parsed;
    }

    // Step 5: Update trade record with result and profit
    for (const trade of this.botState.trades) {
      if (trade.contractId === contractId) {
        trade.result = isWin ? "win" : "loss";
        trade.profit = this.round2(safeProfit);
        break;
      }
    }

    // Step 6: Update accumulated P/L (Req 6.1, 6.5)
    const newPL = this.round2(this.botState.accumulatedPL + safeProfit);
    this.botState.accumulatedPL = newPL;

    // Step 7: Calculate next stake using calculateNextStake() (Req 5.1, 5.2)
    const nextStake = this.calculateNextStake(isWin);
    this.botState.currentStake = nextStake;

    // Step 8: Call checkStopConditions() (Req 7.1, 7.2, 7.3, 7.4)
    this.checkStopConditions();

    // Step 9: Return next stake if continuing, null if stopped
    if (!this.botState.isRunning) {
      return null;
    }

    // Step 10: Schedule next trade after inter-trade delay (Req 8.1, 8.2, 8.3, 8.4)
    this.scheduleNextTrade(nextStake);

    return nextStake;
  }

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
  private scheduleNextTrade(stake: number): void {
    // Clear any existing timer (defensive)
    if (this.nextTradeTimer !== null) {
      clearTimeout(this.nextTradeTimer);
      this.nextTradeTimer = null;
    }

    // Schedule next trade after inter-trade delay (Req 8.1, 8.2)
    this.nextTradeTimer = setTimeout(() => {
      // Clear timer reference
      this.nextTradeTimer = null;

      // Check if session is still running before placing trade (Req 8.4)
      if (this.botState.isRunning) {
        this.placeTrade(stake).catch((error) => {
          // Handle any errors during trade placement
          this.botState.error = error instanceof Error ? error.message : "Trade placement failed";
          this.botState.isRunning = false;
        });
      }
    }, this.config.execution.interTradeDelay);
  }

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
  stopSession(reason: StopReason = "manual"): void {
    // Cancel scheduled timer if exists (Req 8.3, 15.1)
    if (this.nextTradeTimer !== null) {
      clearTimeout(this.nextTradeTimer);
      this.nextTradeTimer = null;
    }

    // Mark session as stopped
    this.botState.isRunning = false;

    // Set stop reason if not already set
    if (this.botState.stopReason === null) {
      this.botState.stopReason = reason;
    }
  }
}
