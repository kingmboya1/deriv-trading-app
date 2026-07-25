import { describe, it, expect } from "vitest";
import { BotEngine } from "./bot-engine";
import { StrategyConfig } from "./types";

describe("BotEngine - Skeleton", () => {
  // Helper to create a valid test config
  const createTestConfig = (): StrategyConfig => ({
    name: "Test Strategy",
    version: "1.0.0",
    description: "Test strategy for unit tests",
    trade: {
      contractType: "DIGITEVEN",
      symbol: "R_100",
      duration: 1,
      durationUnit: "t",
    },
    stake: {
      initial: 0.35,
      multiplier: 2,
      maxStake: 10,
    },
    risk: {
      maxConsecutiveLosses: 5,
      takeProfitAmount: 5,
      stopLossAmount: 10,
    },
    execution: {
      interTradeDelay: 2000,
      autoRestart: false,
    },
  });

  describe("Constructor", () => {
    it("should initialize with provided userId, config, and derivToken", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      expect(engine.getUserId()).toBe("user123");
      expect(engine.getConfig()).toEqual(config);
    });

    it("should initialize bot state with default values", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      const state = engine.getState();

      expect(state.isRunning).toBe(false);
      expect(state.currentStake).toBe(0.35);
      expect(state.consecutiveLosses).toBe(0);
      expect(state.accumulatedPL).toBe(0);
      expect(state.pendingContractId).toBe(null);
      expect(state.stopReason).toBe(null);
      expect(state.error).toBe(null);
      expect(state.currency).toBe(null);
    });

    it("should freeze config to make it immutable (Req 22.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      const frozenConfig = engine.getConfig();

      // Top-level object should be frozen
      expect(Object.isFrozen(frozenConfig)).toBe(true);
      
      // Nested objects should also be frozen (deep freeze)
      expect(Object.isFrozen(frozenConfig.stake)).toBe(true);
      expect(Object.isFrozen(frozenConfig.trade)).toBe(true);
      expect(Object.isFrozen(frozenConfig.risk)).toBe(true);
      expect(Object.isFrozen(frozenConfig.execution)).toBe(true);

      // Attempt to modify should throw when frozen
      expect(() => {
        (frozenConfig as any).stake.initial = 999;
      }).toThrow(TypeError);
    });
  });

  describe("round2()", () => {
    it("should round numbers to 2 decimal places (Req 21.1, 21.2)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      expect(engine.round2(1.234)).toBe(1.23);
      expect(engine.round2(1.235)).toBe(1.24);
      expect(engine.round2(0.355)).toBe(0.36);
      expect(engine.round2(10)).toBe(10);
      expect(engine.round2(10.1)).toBe(10.1);
    });

    it("should handle negative numbers", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      expect(engine.round2(-1.234)).toBe(-1.23);
      expect(engine.round2(-1.235)).toBe(-1.24);
    });

    it("should handle zero", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      expect(engine.round2(0)).toBe(0);
    });
  });

  describe("generateTradeId()", () => {
    it("should generate unique trade IDs (Req 9.3)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      const id1 = engine.generateTradeId();
      const id2 = engine.generateTradeId();

      // IDs should be different
      expect(id1).not.toBe(id2);

      // IDs should follow format: "trade_{timestamp}_{random}"
      expect(id1).toMatch(/^trade_\d+_[a-z0-9]{6}$/);
      expect(id2).toMatch(/^trade_\d+_[a-z0-9]{6}$/);
    });

    it("should start with 'trade_' prefix", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      const id = engine.generateTradeId();
      expect(id.startsWith("trade_")).toBe(true);
    });
  });

  describe("getState()", () => {
    it("should return a snapshot of bot state", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      const state1 = engine.getState();
      const state2 = engine.getState();

      // Should return equal but different object instances
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe("getConfig()", () => {
    it("should return the immutable strategy configuration", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      const retrievedConfig = engine.getConfig();
      expect(retrievedConfig).toEqual(config);
    });
  });

  describe("getUserId()", () => {
    it("should return the user ID", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      expect(engine.getUserId()).toBe("user123");
    });
  });

  describe("checkStopConditions()", () => {
    it("should stop when max consecutive losses reached (Req 7.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      // Manually set bot state to simulate scenario
      const state = engine.getState();
      (engine as any).botState.isRunning = true;
      (engine as any).botState.consecutiveLosses = 5; // Matches maxConsecutiveLosses

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("max_losses");
    });

    it("should stop when take profit threshold reached (Req 7.2)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.accumulatedPL = 5.0; // Equals takeProfitAmount

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("take_profit");
    });

    it("should stop when take profit threshold exceeded (Req 7.2)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.accumulatedPL = 6.5; // Exceeds takeProfitAmount

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("take_profit");
    });

    it("should stop when stop loss threshold reached (Req 7.3)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.accumulatedPL = -10.0; // Equals negative stopLossAmount

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("stop_loss");
    });

    it("should stop when stop loss threshold exceeded (Req 7.3)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.accumulatedPL = -12.5; // Exceeds negative stopLossAmount

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("stop_loss");
    });

    it("should stop when max stake exceeded (Req 7.4)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currentStake = 11.0; // Exceeds maxStake (10)

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("max_stake");
    });

    it("should not stop when no conditions met", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.consecutiveLosses = 3; // Below limit
      (engine as any).botState.accumulatedPL = 2.0; // Below take profit
      (engine as any).botState.currentStake = 5.0; // Below max stake

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(true);
      expect(updatedState.stopReason).toBe(null);
    });

    it("should prioritize max_losses check first", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      // Set multiple stop conditions - max_losses should be checked first
      (engine as any).botState.isRunning = true;
      (engine as any).botState.consecutiveLosses = 5;
      (engine as any).botState.accumulatedPL = 5.0;
      (engine as any).botState.currentStake = 11.0;

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("max_losses");
    });

    it("should check take_profit before stop_loss", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      // Set both take profit and stop loss conditions
      (engine as any).botState.isRunning = true;
      (engine as any).botState.consecutiveLosses = 0;
      (engine as any).botState.accumulatedPL = 5.0; // Take profit reached
      (engine as any).botState.currentStake = 11.0; // Max stake exceeded

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("take_profit");
    });

    it("should check stop_loss before max_stake", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      // Set both stop loss and max stake conditions
      (engine as any).botState.isRunning = true;
      (engine as any).botState.consecutiveLosses = 0;
      (engine as any).botState.accumulatedPL = -10.0; // Stop loss reached
      (engine as any).botState.currentStake = 11.0; // Max stake exceeded

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(false);
      expect(updatedState.stopReason).toBe("stop_loss");
    });

    it("should handle edge case: P/L just below take profit", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.accumulatedPL = 4.99; // Just below takeProfitAmount

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(true);
      expect(updatedState.stopReason).toBe(null);
    });

    it("should handle edge case: P/L just above stop loss", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.accumulatedPL = -9.99; // Just above negative stopLossAmount

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(true);
      expect(updatedState.stopReason).toBe(null);
    });

    it("should handle edge case: stake equals max stake", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currentStake = 10.0; // Equals maxStake

      engine.checkStopConditions();

      const updatedState = engine.getState();
      expect(updatedState.isRunning).toBe(true);
      expect(updatedState.stopReason).toBe(null);
    });
  });

  describe("placeTrade()", () => {
    // Mock DerivConnection for testing
    const createMockConnection = (
      proposalResponse: any,
      buyResponse: any
    ) => {
      return {
        request: async (payload: any) => {
          if (payload.proposal !== undefined) {
            return proposalResponse;
          }
          if (payload.buy !== undefined) {
            return buyResponse;
          }
          throw new Error("Unexpected request payload");
        },
      };
    };

    it("should return null when bot is not running (Req 4.8)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      // Bot starts with isRunning = false
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(null);
    });

    it("should return null when there is a pending contract (Req 4.8)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345; // Existing pending contract
      
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(null);
    });

    it("should return null when DerivConnection is not set", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(null);
      const state = engine.getState();
      expect(state.error).toBe("DerivConnection not initialized");
      expect(state.isRunning).toBe(false);
    });

    it("should successfully place trade and return contract ID (Req 4.1, 4.2, 4.3, 4.4)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      // Setup bot state
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      // Mock successful API responses
      const mockConnection = createMockConnection(
        {
          proposal: {
            id: "proposal-123",
            ask_price: 0.35,
            payout: 0.68,
          },
        },
        {
          buy: {
            contract_id: 98765,
            buy_price: 0.35,
            payout: 0.68,
          },
        }
      );
      
      engine.setDerivConnection(mockConnection as any);
      
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(98765);
      
      const state = engine.getState();
      expect(state.pendingContractId).toBe(98765);
      expect(state.currentStake).toBe(0.35);
      expect(state.trades.length).toBe(1);
      expect(state.trades[0].contractId).toBe(98765);
      expect(state.trades[0].result).toBe("pending");
      expect(state.trades[0].stake).toBe(0.35);
      expect(state.trades[0].payout).toBe(0.68);
    });

    it("should round stake to 2 decimal places", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      const mockConnection = createMockConnection(
        {
          proposal: {
            id: "proposal-123",
            ask_price: 1.23,
            payout: 2.40,
          },
        },
        {
          buy: {
            contract_id: 98766,
            buy_price: 1.23,
            payout: 2.40,
          },
        }
      );
      
      engine.setDerivConnection(mockConnection as any);
      
      const result = await engine.placeTrade(1.234567);
      
      expect(result).toBe(98766);
      
      const state = engine.getState();
      expect(state.currentStake).toBe(1.23);
      expect(state.trades[0].stake).toBe(1.23);
    });

    it("should create trade record with correct contract type and symbol (Req 9.1)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      const mockConnection = createMockConnection(
        {
          proposal: {
            id: "proposal-123",
            ask_price: 0.35,
            payout: 0.68,
          },
        },
        {
          buy: {
            contract_id: 98767,
            buy_price: 0.35,
            payout: 0.68,
          },
        }
      );
      
      engine.setDerivConnection(mockConnection as any);
      
      await engine.placeTrade(0.35);
      
      const state = engine.getState();
      const trade = state.trades[0];
      
      expect(trade.contractType).toBe("DIGITEVEN");
      expect(trade.symbol).toBe("R_100");
      expect(trade.id).toMatch(/^trade_\d+_[a-z0-9]{6}$/);
      expect(trade.timestamp).toBeGreaterThan(0);
    });

    it("should handle proposal request error and stop session (Req 4.6, 13.1, 13.3, 13.4)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      const mockConnection = createMockConnection(
        {
          error: {
            code: "InvalidProposal",
            message: "Invalid contract parameters",
          },
        },
        {}
      );
      
      engine.setDerivConnection(mockConnection as any);
      
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(null);
      
      const state = engine.getState();
      expect(state.error).toBe("Invalid contract parameters");
      expect(state.isRunning).toBe(false);
      expect(state.stopReason).toBe(null);
      expect(state.pendingContractId).toBe(null);
    });

    it("should handle buy request error and stop session (Req 4.6, 13.2, 13.3, 13.4)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      const mockConnection = createMockConnection(
        {
          proposal: {
            id: "proposal-123",
            ask_price: 0.35,
            payout: 0.68,
          },
        },
        {
          error: {
            code: "InsufficientBalance",
            message: "Insufficient balance to purchase contract",
          },
        }
      );
      
      engine.setDerivConnection(mockConnection as any);
      
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(null);
      
      const state = engine.getState();
      expect(state.error).toBe("Insufficient balance to purchase contract");
      expect(state.isRunning).toBe(false);
      expect(state.stopReason).toBe(null);
      expect(state.pendingContractId).toBe(null);
      expect(state.trades.length).toBe(0); // No trade recorded on failure
    });

    it("should include barrier in proposal if specified in config", async () => {
      const configWithBarrier = createTestConfig();
      configWithBarrier.trade.barrier = "+0.001";
      
      const engine = new BotEngine("user123", configWithBarrier, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      let capturedPayload: any = null;
      const mockConnection = {
        request: async (payload: any) => {
          if (payload.proposal !== undefined) {
            capturedPayload = payload;
            return {
              proposal: {
                id: "proposal-123",
                ask_price: 0.35,
                payout: 0.68,
              },
            };
          }
          return {
            buy: {
              contract_id: 98768,
              buy_price: 0.35,
              payout: 0.68,
            },
          };
        },
      };
      
      engine.setDerivConnection(mockConnection as any);
      
      await engine.placeTrade(0.35);
      
      expect(capturedPayload).not.toBe(null);
      expect(capturedPayload.barrier).toBe("+0.001");
    });

    it("should not include barrier in proposal if not specified in config", async () => {
      const config = createTestConfig();
      // No barrier specified in config
      
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      let capturedPayload: any = null;
      const mockConnection = {
        request: async (payload: any) => {
          if (payload.proposal !== undefined) {
            capturedPayload = payload;
            return {
              proposal: {
                id: "proposal-123",
                ask_price: 0.35,
                payout: 0.68,
              },
            };
          }
          return {
            buy: {
              contract_id: 98769,
              buy_price: 0.35,
              payout: 0.68,
            },
          };
        },
      };
      
      engine.setDerivConnection(mockConnection as any);
      
      await engine.placeTrade(0.35);
      
      expect(capturedPayload).not.toBe(null);
      expect(capturedPayload.barrier).toBeUndefined();
    });

    it("should build correct proposal payload with all parameters (Req 4.2)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      let capturedPayload: any = null;
      const mockConnection = {
        request: async (payload: any) => {
          if (payload.proposal !== undefined) {
            capturedPayload = payload;
            return {
              proposal: {
                id: "proposal-123",
                ask_price: 0.35,
                payout: 0.68,
              },
            };
          }
          return {
            buy: {
              contract_id: 98770,
              buy_price: 0.35,
              payout: 0.68,
            },
          };
        },
      };
      
      engine.setDerivConnection(mockConnection as any);
      
      await engine.placeTrade(0.35);
      
      expect(capturedPayload).toEqual({
        proposal: 1,
        amount: 0.35,
        basis: "stake",
        contract_type: "DIGITEVEN",
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        symbol: "R_100",
      });
    });

    it("should handle network/exception errors during proposal (Req 13.3, 13.4)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      const mockConnection = {
        request: async () => {
          throw new Error("Network error");
        },
      };
      
      engine.setDerivConnection(mockConnection as any);
      
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(null);
      
      const state = engine.getState();
      expect(state.error).toBe("Network error");
      expect(state.isRunning).toBe(false);
      expect(state.stopReason).toBe(null);
    });

    it("should handle missing proposal data in response (Req 13.3, 13.4)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      const mockConnection = createMockConnection(
        {}, // Missing proposal field
        {}
      );
      
      engine.setDerivConnection(mockConnection as any);
      
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(null);
      
      const state = engine.getState();
      expect(state.error).toBe("Invalid proposal response: missing proposal data");
      expect(state.isRunning).toBe(false);
      expect(state.stopReason).toBe(null);
    });

    it("should handle missing buy data in response (Req 13.3, 13.4)", async () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");
      
      (engine as any).botState.isRunning = true;
      (engine as any).botState.currency = "USD";
      
      const mockConnection = createMockConnection(
        {
          proposal: {
            id: "proposal-123",
            ask_price: 0.35,
            payout: 0.68,
          },
        },
        {} // Missing buy field
      );
      
      engine.setDerivConnection(mockConnection as any);
      
      const result = await engine.placeTrade(0.35);
      
      expect(result).toBe(null);
      
      const state = engine.getState();
      expect(state.error).toBe("Invalid buy response: missing buy data");
      expect(state.isRunning).toBe(false);
      expect(state.stopReason).toBe(null);
    });
  });

  describe("calculateNextStake()", () => {
    it("should reset stake to initial after a win (Req 5.2, 5.6)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.currentStake = 2.0;
      (engine as any).botState.consecutiveLosses = 3;

      const nextStake = engine.calculateNextStake(true);

      expect(nextStake).toBe(0.35); // Initial stake
      expect(engine.getState().consecutiveLosses).toBe(0);
    });

    it("should multiply stake after a loss (Req 5.1, 5.5)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.currentStake = 1.0;
      (engine as any).botState.consecutiveLosses = 0;

      const nextStake = engine.calculateNextStake(false);

      expect(nextStake).toBe(2.0); // 1.0 * 2
      expect(engine.getState().consecutiveLosses).toBe(1);
    });

    it("should round stake to 2 decimal places (Req 5.3)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.currentStake = 0.33;

      const nextStake = engine.calculateNextStake(false);

      expect(nextStake).toBe(0.66); // 0.33 * 2 = 0.66
    });

    it("should increment consecutive losses on each loss (Req 5.5)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.consecutiveLosses = 0;

      engine.calculateNextStake(false);
      expect(engine.getState().consecutiveLosses).toBe(1);

      engine.calculateNextStake(false);
      expect(engine.getState().consecutiveLosses).toBe(2);

      engine.calculateNextStake(false);
      expect(engine.getState().consecutiveLosses).toBe(3);
    });

    it("should handle multiple losses progression", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.currentStake = 0.35;

      const stake1 = engine.calculateNextStake(false);
      expect(stake1).toBe(0.7);

      (engine as any).botState.currentStake = stake1;
      const stake2 = engine.calculateNextStake(false);
      expect(stake2).toBe(1.4);

      (engine as any).botState.currentStake = stake2;
      const stake3 = engine.calculateNextStake(false);
      expect(stake3).toBe(2.8);
    });
  });

  describe("handleContractSettlement()", () => {
    it("should return null if contractId does not match pendingContractId (Req 4.7)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;

      const result = engine.handleContractSettlement(99999, "won", 0.65);

      expect(result).toBe(null);
      // State should remain unchanged
      expect(engine.getState().pendingContractId).toBe(12345);
    });

    it("should clear pendingContractId immediately (Req 4.9)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      engine.handleContractSettlement(12345, "won", 0.33);

      expect(engine.getState().pendingContractId).toBe(null);
    });

    it("should update trade record with win result and profit (Req 6.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      engine.handleContractSettlement(12345, "won", 0.33);

      const trade = engine.getState().trades[0];
      expect(trade.result).toBe("win");
      expect(trade.profit).toBe(0.33);
    });

    it("should update trade record with loss result and negative profit (Req 6.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      engine.handleContractSettlement(12345, "lost", -0.35);

      const trade = engine.getState().trades[0];
      expect(trade.result).toBe("loss");
      expect(trade.profit).toBe(-0.35);
    });

    it("should update accumulated P/L (Req 6.1, 6.5)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.accumulatedPL = 0;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      engine.handleContractSettlement(12345, "won", 0.33);

      expect(engine.getState().accumulatedPL).toBe(0.33);
    });

    it("should accumulate profit over multiple settlements (Req 6.1, 6.5)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.accumulatedPL = 1.5;

      // First settlement
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      engine.handleContractSettlement(12345, "won", 0.33);
      expect(engine.getState().accumulatedPL).toBe(1.83); // 1.5 + 0.33
    });

    it("should round accumulated P/L to 2 decimal places (Req 6.5)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.accumulatedPL = 0.555;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      engine.handleContractSettlement(12345, "won", 0.334);

      expect(engine.getState().accumulatedPL).toBe(0.89); // round2(0.555 + 0.334)
    });

    it("should reset to initial stake after a win (Req 5.2)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 2.0;
      (engine as any).botState.consecutiveLosses = 2;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 2.0,
          result: "pending",
          payout: 3.9,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      const nextStake = engine.handleContractSettlement(12345, "won", 1.9);

      expect(nextStake).toBe(0.35); // Initial stake
      expect(engine.getState().currentStake).toBe(0.35);
      expect(engine.getState().consecutiveLosses).toBe(0);
    });

    it("should multiply stake after a loss (Req 5.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.consecutiveLosses = 0;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      const nextStake = engine.handleContractSettlement(12345, "lost", -0.35);

      expect(nextStake).toBe(0.7); // 0.35 * 2
      expect(engine.getState().currentStake).toBe(0.7);
      expect(engine.getState().consecutiveLosses).toBe(1);
    });

    it("should handle non-numeric profit as zero", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.accumulatedPL = 0;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      engine.handleContractSettlement(12345, "won", "invalid" as any);

      expect(engine.getState().accumulatedPL).toBe(0);
      expect(engine.getState().trades[0].profit).toBe(0);
    });

    it("should return null when max consecutive losses reached (Req 7.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 2.8;
      (engine as any).botState.consecutiveLosses = 4; // Will become 5
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 2.8,
          result: "pending",
          payout: 5.46,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      const nextStake = engine.handleContractSettlement(12345, "lost", -2.8);

      expect(nextStake).toBe(null);
      expect(engine.getState().isRunning).toBe(false);
      expect(engine.getState().stopReason).toBe("max_losses");
    });

    it("should return null when take profit reached (Req 7.2)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.accumulatedPL = 4.67; // Will reach 5.0
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      const nextStake = engine.handleContractSettlement(12345, "won", 0.33);

      expect(nextStake).toBe(null);
      expect(engine.getState().isRunning).toBe(false);
      expect(engine.getState().stopReason).toBe("take_profit");
    });

    it("should return null when stop loss reached (Req 7.3)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 5.6;
      (engine as any).botState.accumulatedPL = -4.4; // Will reach -10.0
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 5.6,
          result: "pending",
          payout: 10.92,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      const nextStake = engine.handleContractSettlement(12345, "lost", -5.6);

      expect(nextStake).toBe(null);
      expect(engine.getState().isRunning).toBe(false);
      expect(engine.getState().stopReason).toBe("stop_loss");
    });

    it("should return null when next stake exceeds max stake (Req 7.4)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 5.6; // Next stake would be 11.2
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 5.6,
          result: "pending",
          payout: 10.92,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      const nextStake = engine.handleContractSettlement(12345, "lost", -5.6);

      expect(nextStake).toBe(null);
      expect(engine.getState().isRunning).toBe(false);
      expect(engine.getState().stopReason).toBe("max_stake");
    });

    it("should return next stake when continuing (Req 6.5)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 1.4;
      (engine as any).botState.consecutiveLosses = 2;
      (engine as any).botState.accumulatedPL = -2.5;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 1.4,
          result: "pending",
          payout: 2.73,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      const nextStake = engine.handleContractSettlement(12345, "lost", -1.4);

      expect(nextStake).toBe(2.8); // 1.4 * 2
      expect(engine.getState().isRunning).toBe(true);
      expect(engine.getState().currentStake).toBe(2.8);
    });

    it("should handle string profit values that can be parsed", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.accumulatedPL = 0;
      (engine as any).botState.trades = [
        {
          id: "trade_1",
          contractId: 12345,
          contractType: "DIGITEVEN",
          symbol: "R_100",
          stake: 0.35,
          result: "pending",
          payout: 0.68,
          profit: 0,
          timestamp: Date.now(),
        },
      ];

      engine.handleContractSettlement(12345, "won", "0.33" as any);

      expect(engine.getState().accumulatedPL).toBe(0.33);
      expect(engine.getState().trades[0].profit).toBe(0.33);
    });

    it("should handle complete win-loss sequence", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;

      // Trade 1: Loss (0.35)
      (engine as any).botState.pendingContractId = 1;
      (engine as any).botState.currentStake = 0.35;
      (engine as any).botState.trades = [
        { id: "t1", contractId: 1, contractType: "DIGITEVEN", symbol: "R_100", stake: 0.35, result: "pending", payout: 0.68, profit: 0, timestamp: Date.now() },
      ];
      let nextStake = engine.handleContractSettlement(1, "lost", -0.35);
      expect(nextStake).toBe(0.7);
      expect(engine.getState().accumulatedPL).toBe(-0.35);

      // Trade 2: Loss (0.7)
      (engine as any).botState.pendingContractId = 2;
      (engine as any).botState.trades.push(
        { id: "t2", contractId: 2, contractType: "DIGITEVEN", symbol: "R_100", stake: 0.7, result: "pending", payout: 1.37, profit: 0, timestamp: Date.now() }
      );
      nextStake = engine.handleContractSettlement(2, "lost", -0.7);
      expect(nextStake).toBe(1.4);
      expect(engine.getState().accumulatedPL).toBe(-1.05);

      // Trade 3: Win (1.4)
      (engine as any).botState.pendingContractId = 3;
      (engine as any).botState.trades.push(
        { id: "t3", contractId: 3, contractType: "DIGITEVEN", symbol: "R_100", stake: 1.4, result: "pending", payout: 2.73, profit: 0, timestamp: Date.now() }
      );
      nextStake = engine.handleContractSettlement(3, "won", 1.33);
      expect(nextStake).toBe(0.35); // Reset to initial
      expect(engine.getState().accumulatedPL).toBe(0.28); // -1.05 + 1.33
      expect(engine.getState().consecutiveLosses).toBe(0);
    });
  });

  describe("stopSession()", () => {
    it("should mark session as not running (Req 8.3, 15.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;

      engine.stopSession();

      const state = engine.getState();
      expect(state.isRunning).toBe(false);
    });

    it("should set stop reason to manual by default", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;

      engine.stopSession();

      const state = engine.getState();
      expect(state.stopReason).toBe("manual");
    });

    it("should set custom stop reason when provided", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;

      engine.stopSession("take_profit");

      const state = engine.getState();
      expect(state.stopReason).toBe("take_profit");
    });

    it("should not overwrite existing stop reason", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;
      (engine as any).botState.stopReason = "max_losses";

      engine.stopSession("manual");

      const state = engine.getState();
      expect(state.stopReason).toBe("max_losses"); // Should keep original
    });

    it("should be idempotent - can be called multiple times safely (Req 15.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      (engine as any).botState.isRunning = true;

      engine.stopSession("manual");
      const state1 = engine.getState();

      engine.stopSession("manual");
      const state2 = engine.getState();

      expect(state1.isRunning).toBe(false);
      expect(state2.isRunning).toBe(false);
      expect(state1.stopReason).toBe("manual");
      expect(state2.stopReason).toBe("manual");
    });

    it("should cancel scheduled timer if exists (Req 8.3, 15.1)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      // Create a scheduled timer
      const mockTimer = setTimeout(() => {}, 5000) as NodeJS.Timeout;
      (engine as any).nextTradeTimer = mockTimer;

      engine.stopSession();

      expect((engine as any).nextTradeTimer).toBe(null);
    });
  });

  describe("Trade Scheduling with Inter-Trade Delay", () => {
    it("should schedule next trade after settlement if session is running (Req 8.1, 8.2)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      // Setup: session running, contract pending
      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currency = "USD";

      // Add a pending trade
      (engine as any).botState.trades.push({
        id: "trade_123",
        contractId: 12345,
        contractType: "DIGITEVEN",
        symbol: "R_100",
        stake: 0.35,
        result: "pending",
        payout: 0.68,
        profit: 0,
        timestamp: Date.now(),
      });

      // Mock DerivConnection
      const mockConnection = {
        request: async () => ({
          proposal: { id: "prop-1", ask_price: 0.35, payout: 0.68 },
          buy: { contract_id: 12346, buy_price: 0.35, payout: 0.68 },
        }),
      };
      engine.setDerivConnection(mockConnection as any);

      // Handle settlement - this should schedule next trade
      const nextStake = engine.handleContractSettlement(12345, "won", 0.33);

      expect(nextStake).toBe(0.35); // Should reset to initial stake after win
      expect((engine as any).nextTradeTimer).not.toBe(null); // Timer should be scheduled

      // Cleanup
      if ((engine as any).nextTradeTimer) {
        clearTimeout((engine as any).nextTradeTimer);
      }
    });

    it("should not schedule next trade if session stopped after settlement (Req 8.4)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      // Setup: session running, at max losses - 1
      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.consecutiveLosses = 4;
      (engine as any).botState.currentStake = 2.8;

      // Add a pending trade
      (engine as any).botState.trades.push({
        id: "trade_123",
        contractId: 12345,
        contractType: "DIGITEVEN",
        symbol: "R_100",
        stake: 2.8,
        result: "pending",
        payout: 5.5,
        profit: 0,
        timestamp: Date.now(),
      });

      // Handle settlement with loss - will trigger max_losses stop condition
      const nextStake = engine.handleContractSettlement(12345, "lost", -2.8);

      expect(nextStake).toBe(null); // Should not continue
      expect(engine.getState().isRunning).toBe(false);
      expect(engine.getState().stopReason).toBe("max_losses");
      expect((engine as any).nextTradeTimer).toBe(null); // No timer scheduled
    });

    it("should cancel scheduled trade if stopSession called during delay (Req 8.3)", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      // Setup: session running, contract pending
      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;

      // Add a pending trade
      (engine as any).botState.trades.push({
        id: "trade_123",
        contractId: 12345,
        contractType: "DIGITEVEN",
        symbol: "R_100",
        stake: 0.35,
        result: "pending",
        payout: 0.68,
        profit: 0,
        timestamp: Date.now(),
      });

      // Handle settlement - schedules next trade
      engine.handleContractSettlement(12345, "won", 0.33);

      expect((engine as any).nextTradeTimer).not.toBe(null);

      // Stop session during delay
      engine.stopSession("manual");

      expect((engine as any).nextTradeTimer).toBe(null); // Timer cancelled
      expect(engine.getState().isRunning).toBe(false);
    });

    it("should use config.execution.interTradeDelay for scheduling (Req 8.2)", (done) => {
      const config = createTestConfig();
      config.execution.interTradeDelay = 3000; // 3 seconds

      const engine = new BotEngine("user123", config, "token456");

      // Setup: session running
      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;

      // Add a pending trade
      (engine as any).botState.trades.push({
        id: "trade_123",
        contractId: 12345,
        contractType: "DIGITEVEN",
        symbol: "R_100",
        stake: 0.35,
        result: "pending",
        payout: 0.68,
        profit: 0,
        timestamp: Date.now(),
      });

      const startTime = Date.now();

      // Mock placeTrade to verify timing
      let placeTradeCallTime = 0;
      (engine as any).placeTrade = async () => {
        placeTradeCallTime = Date.now();
        return 12346;
      };

      // Handle settlement
      engine.handleContractSettlement(12345, "won", 0.33);

      // Wait for timer to fire
      setTimeout(() => {
        const elapsed = placeTradeCallTime - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(2900); // Allow 100ms tolerance
        expect(elapsed).toBeLessThan(3500);
        done();
      }, 3500);
    }, 5000);

    it("should check isRunning before placing next trade in timer callback (Req 8.4)", (done) => {
      const config = createTestConfig();
      config.execution.interTradeDelay = 100; // Short delay for testing

      const engine = new BotEngine("user123", config, "token456");

      // Setup: session running
      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currency = "USD";

      // Add a pending trade
      (engine as any).botState.trades.push({
        id: "trade_123",
        contractId: 12345,
        contractType: "DIGITEVEN",
        symbol: "R_100",
        stake: 0.35,
        result: "pending",
        payout: 0.68,
        profit: 0,
        timestamp: Date.now(),
      });

      let placeTradeWasCalled = false;

      // Mock placeTrade
      (engine as any).placeTrade = async () => {
        placeTradeWasCalled = true;
        return 12346;
      };

      // Handle settlement - schedules trade
      engine.handleContractSettlement(12345, "won", 0.33);

      // Stop session immediately (before timer fires)
      (engine as any).botState.isRunning = false;

      // Wait longer than delay to see if placeTrade is called
      setTimeout(() => {
        expect(placeTradeWasCalled).toBe(false); // Should NOT be called because isRunning = false
        done();
      }, 300);
    }, 1000);

    it("should handle errors in scheduled placeTrade (Req 8.1)", (done) => {
      const config = createTestConfig();
      config.execution.interTradeDelay = 100; // Short delay for testing

      const engine = new BotEngine("user123", config, "token456");

      // Setup: session running
      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;
      (engine as any).botState.currency = "USD";

      // Add a pending trade
      (engine as any).botState.trades.push({
        id: "trade_123",
        contractId: 12345,
        contractType: "DIGITEVEN",
        symbol: "R_100",
        stake: 0.35,
        result: "pending",
        payout: 0.68,
        profit: 0,
        timestamp: Date.now(),
      });

      // Mock placeTrade to throw error
      (engine as any).placeTrade = async () => {
        throw new Error("Trade placement failed");
      };

      // Handle settlement - schedules trade
      engine.handleContractSettlement(12345, "won", 0.33);

      // Wait for timer to fire and error to be caught
      setTimeout(() => {
        const state = engine.getState();
        expect(state.error).toBe("Trade placement failed");
        expect(state.isRunning).toBe(false);
        done();
      }, 300);
    }, 1000);

    it("should clear any existing timer before scheduling new one", () => {
      const config = createTestConfig();
      const engine = new BotEngine("user123", config, "token456");

      // Setup: session running
      (engine as any).botState.isRunning = true;
      (engine as any).botState.pendingContractId = 12345;

      // Add a pending trade
      (engine as any).botState.trades.push({
        id: "trade_123",
        contractId: 12345,
        contractType: "DIGITEVEN",
        symbol: "R_100",
        stake: 0.35,
        result: "pending",
        payout: 0.68,
        profit: 0,
        timestamp: Date.now(),
      });

      // Manually set a timer (defensive check)
      const oldTimer = setTimeout(() => {}, 10000) as NodeJS.Timeout;
      (engine as any).nextTradeTimer = oldTimer;

      // Handle settlement - should clear old timer and set new one
      engine.handleContractSettlement(12345, "won", 0.33);

      expect((engine as any).nextTradeTimer).not.toBe(oldTimer);
      expect((engine as any).nextTradeTimer).not.toBe(null);

      // Cleanup
      if ((engine as any).nextTradeTimer) {
        clearTimeout((engine as any).nextTradeTimer);
      }
    });
  });
});
