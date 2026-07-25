import { describe, it, expect } from "vitest";
import {
  validateStrategyConfig,
  assertValidStrategyConfig,
  parseStrategyConfig,
} from "./config-validator";
import { StrategyConfig } from "./types";

/**
 * Unit tests for strategy configuration validation.
 * Tests all validation rules from requirements 3.2-3.10.
 */

describe("validateStrategyConfig", () => {
  // Valid baseline configuration for testing
  const validConfig: StrategyConfig = {
    name: "Test Strategy",
    version: "1.0.0",
    description: "Test description",
    trade: {
      contractType: "DIGITEVEN",
      symbol: "R_100",
      duration: 1,
      durationUnit: "t",
      barrier: "",
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
  };

  describe("Valid configurations", () => {
    it("should accept a valid configuration", () => {
      const result = validateStrategyConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it("should accept configuration without optional description", () => {
      const config = { ...validConfig, description: undefined };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should accept all valid contract types", () => {
      const contractTypes = [
        "CALL",
        "PUT",
        "DIGITODD",
        "DIGITEVEN",
        "DIGITMATCH",
        "DIGITDIFF",
        "DIGITOVER",
        "DIGITUNDER",
      ] as const;

      contractTypes.forEach((contractType) => {
        const config = {
          ...validConfig,
          trade: { ...validConfig.trade, contractType },
        };
        const result = validateStrategyConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it("should accept all valid duration units", () => {
      const durationUnits = ["t", "s", "m", "h", "d"] as const;

      durationUnits.forEach((durationUnit) => {
        const config = {
          ...validConfig,
          trade: { ...validConfig.trade, durationUnit },
        };
        const result = validateStrategyConfig(config);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe("Requirement 3.2: Initial stake validation", () => {
    it("should reject initial stake less than 0.01", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, initial: 0.009 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("Initial stake must be at least 0.01");
    });

    it("should reject initial stake greater than 100", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, initial: 100.01 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("Initial stake must not exceed 100");
    });

    it("should accept initial stake of exactly 0.01", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, initial: 0.01 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should accept initial stake of exactly 100", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, initial: 100, maxStake: 100 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Requirement 3.3: Multiplier validation", () => {
    it("should reject multiplier less than 1", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, multiplier: 0.99 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("Multiplier must be at least 1");
    });

    it("should reject multiplier greater than 10", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, multiplier: 10.01 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("Multiplier must not exceed 10");
    });

    it("should accept multiplier of exactly 1", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, multiplier: 1 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should accept multiplier of exactly 10", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, multiplier: 10 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Requirement 3.4: Max stake validation", () => {
    it("should reject maxStake less than initial stake", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, initial: 5, maxStake: 4.99 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain(
        "Max stake must be greater than or equal to initial stake"
      );
    });

    it("should accept maxStake equal to initial stake", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, initial: 5, maxStake: 5 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should accept maxStake greater than initial stake", () => {
      const config = {
        ...validConfig,
        stake: { ...validConfig.stake, initial: 5, maxStake: 10 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Requirement 3.5: Max consecutive losses validation", () => {
    it("should reject max consecutive losses less than 1", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, maxConsecutiveLosses: 0 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain(
        "Max consecutive losses must be at least 1"
      );
    });

    it("should reject max consecutive losses greater than 20", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, maxConsecutiveLosses: 21 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain(
        "Max consecutive losses must not exceed 20"
      );
    });

    it("should accept max consecutive losses of exactly 1", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, maxConsecutiveLosses: 1 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should accept max consecutive losses of exactly 20", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, maxConsecutiveLosses: 20 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should reject non-integer max consecutive losses", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, maxConsecutiveLosses: 5.5 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain(
        "Max consecutive losses must be an integer"
      );
    });
  });

  describe("Requirement 3.6: Take profit amount validation", () => {
    it("should reject take profit amount of 0", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, takeProfitAmount: 0 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain(
        "Take profit amount must be greater than 0"
      );
    });

    it("should reject negative take profit amount", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, takeProfitAmount: -1 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain(
        "Take profit amount must be greater than 0"
      );
    });

    it("should accept positive take profit amount", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, takeProfitAmount: 0.01 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Requirement 3.7: Stop loss amount validation", () => {
    it("should reject stop loss amount of 0", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, stopLossAmount: 0 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("Stop loss amount must be greater than 0");
    });

    it("should reject negative stop loss amount", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, stopLossAmount: -1 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("Stop loss amount must be greater than 0");
    });

    it("should accept positive stop loss amount", () => {
      const config = {
        ...validConfig,
        risk: { ...validConfig.risk, stopLossAmount: 0.01 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Requirement 3.8: Inter-trade delay validation", () => {
    it("should reject inter-trade delay less than 2000", () => {
      const config = {
        ...validConfig,
        execution: { ...validConfig.execution, interTradeDelay: 1999 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain(
        "Inter-trade delay must be at least 2000 milliseconds"
      );
    });

    it("should accept inter-trade delay of exactly 2000", () => {
      const config = {
        ...validConfig,
        execution: { ...validConfig.execution, interTradeDelay: 2000 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should accept inter-trade delay greater than 2000", () => {
      const config = {
        ...validConfig,
        execution: { ...validConfig.execution, interTradeDelay: 5000 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(true);
    });

    it("should reject non-integer inter-trade delay", () => {
      const config = {
        ...validConfig,
        execution: { ...validConfig.execution, interTradeDelay: 2000.5 },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("Inter-trade delay must be an integer");
    });
  });

  describe("Requirement 3.9: Invalid contract type validation", () => {
    it("should reject invalid contract type", () => {
      const config = {
        ...validConfig,
        trade: { ...validConfig.trade, contractType: "INVALID" as any },
      };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
    });
  });

  describe("Missing required fields", () => {
    it("should reject configuration with missing name", () => {
      const config = { ...validConfig, name: "" };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("name");
    });

    it("should reject configuration with missing version", () => {
      const config = { ...validConfig, version: "" };
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("version");
    });

    it("should reject configuration with missing trade section", () => {
      const { trade, ...config } = validConfig;
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
    });

    it("should reject configuration with missing stake section", () => {
      const { stake, ...config } = validConfig;
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
    });

    it("should reject configuration with missing risk section", () => {
      const { risk, ...config } = validConfig;
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
    });

    it("should reject configuration with missing execution section", () => {
      const { execution, ...config } = validConfig;
      const result = validateStrategyConfig(config);
      expect(result.isValid).toBe(false);
    });
  });
});

describe("assertValidStrategyConfig", () => {
  const validConfig: StrategyConfig = {
    name: "Test Strategy",
    version: "1.0.0",
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
  };

  it("should not throw for valid configuration", () => {
    expect(() => assertValidStrategyConfig(validConfig)).not.toThrow();
  });

  it("should throw for invalid configuration", () => {
    const invalidConfig = {
      ...validConfig,
      stake: { ...validConfig.stake, initial: 0.005 },
    };
    expect(() => assertValidStrategyConfig(invalidConfig)).toThrow();
  });

  it("should throw with descriptive message", () => {
    const invalidConfig = {
      ...validConfig,
      stake: { ...validConfig.stake, initial: 0.005 },
    };
    expect(() => assertValidStrategyConfig(invalidConfig)).toThrow(
      /Initial stake must be at least 0\.01/
    );
  });
});

describe("parseStrategyConfig", () => {
  const validConfig: StrategyConfig = {
    name: "Test Strategy",
    version: "1.0.0",
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
  };

  it("should return typed config for valid input", () => {
    const result = parseStrategyConfig(validConfig);
    expect(result).toEqual(validConfig);
    expect(result.name).toBe("Test Strategy");
  });

  it("should throw for invalid input", () => {
    const invalidConfig = {
      ...validConfig,
      stake: { ...validConfig.stake, initial: 0.005 },
    };
    expect(() => parseStrategyConfig(invalidConfig)).toThrow();
  });
});
