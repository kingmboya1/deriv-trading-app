import { z } from "zod";
import { StrategyConfig } from "./types";

/**
 * Zod schema for validating strategy configurations.
 * Enforces all validation rules from requirements 3.2-3.10.
 */

// Contract type enum schema
const contractTypeSchema = z.enum([
  "CALL",
  "PUT",
  "DIGITODD",
  "DIGITEVEN",
  "DIGITMATCH",
  "DIGITDIFF",
  "DIGITOVER",
  "DIGITUNDER",
]);

// Duration unit enum schema
const durationUnitSchema = z.enum(["t", "s", "m", "h", "d"]);

// Trade configuration schema
const tradeConfigSchema = z.object({
  contractType: contractTypeSchema,
  symbol: z.string().min(1, "Symbol must not be empty"),
  duration: z.number().positive("Duration must be positive"),
  durationUnit: durationUnitSchema,
  barrier: z.string().optional(),
});

// Stake configuration schema
const stakeConfigSchema = z.object({
  initial: z
    .number()
    .min(0.01, "Initial stake must be at least 0.01")
    .max(100, "Initial stake must not exceed 100"),
  multiplier: z
    .number()
    .min(1, "Multiplier must be at least 1")
    .max(10, "Multiplier must not exceed 10"),
  maxStake: z.number().positive("Max stake must be positive"),
});

// Risk management configuration schema
const riskConfigSchema = z.object({
  maxConsecutiveLosses: z
    .number()
    .int("Max consecutive losses must be an integer")
    .min(1, "Max consecutive losses must be at least 1")
    .max(20, "Max consecutive losses must not exceed 20"),
  takeProfitAmount: z
    .number()
    .positive("Take profit amount must be greater than 0"),
  stopLossAmount: z
    .number()
    .positive("Stop loss amount must be greater than 0"),
});

// Execution configuration schema
const executionConfigSchema = z.object({
  interTradeDelay: z
    .number()
    .int("Inter-trade delay must be an integer")
    .min(2000, "Inter-trade delay must be at least 2000 milliseconds"),
  autoRestart: z.boolean(),
});

// Full strategy configuration schema
const strategyConfigSchema = z
  .object({
    name: z.string().min(1, "Strategy name must not be empty"),
    version: z.string().min(1, "Version must not be empty"),
    description: z.string().optional(),
    trade: tradeConfigSchema,
    stake: stakeConfigSchema,
    risk: riskConfigSchema,
    execution: executionConfigSchema,
  })
  .refine(
    (config) => config.stake.maxStake >= config.stake.initial,
    {
      message: "Max stake must be greater than or equal to initial stake",
      path: ["stake", "maxStake"],
    }
  );

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  message?: string;
  errors?: z.ZodIssue[];
}

/**
 * Validates a strategy configuration against all defined rules.
 * 
 * Validation rules (from requirements 3.2-3.10):
 * - Initial stake: 0.01 - 100 (Req 3.2)
 * - Multiplier: 1 - 10 (Req 3.3)
 * - Max stake >= initial stake (Req 3.4)
 * - Max consecutive losses: 1 - 20 (Req 3.5)
 * - Take profit amount > 0 (Req 3.6)
 * - Stop loss amount > 0 (Req 3.7)
 * - Inter-trade delay >= 2000ms (Req 3.8)
 * - Valid contract type (Req 3.9)
 * 
 * @param config - The strategy configuration to validate
 * @returns ValidationResult with isValid flag and error details if invalid
 */
export function validateStrategyConfig(
  config: unknown
): ValidationResult {
  const result = strategyConfigSchema.safeParse(config);

  if (result.success) {
    return {
      isValid: true,
    };
  }

  // Extract first error message for user-friendly feedback
  const firstError = result.error.issues[0];
  const message = firstError
    ? `${firstError.path.join(".")}: ${firstError.message}`
    : "Invalid strategy configuration";

  return {
    isValid: false,
    message,
    errors: result.error.issues,
  };
}

/**
 * Type guard to check if a value is a valid StrategyConfig.
 * Throws an error if validation fails.
 * 
 * @param config - The value to validate
 * @returns The validated StrategyConfig
 * @throws Error if validation fails
 */
export function assertValidStrategyConfig(
  config: unknown
): asserts config is StrategyConfig {
  const result = validateStrategyConfig(config);
  
  if (!result.isValid) {
    throw new Error(result.message || "Invalid strategy configuration");
  }
}

/**
 * Parses and validates a strategy configuration, returning the typed result.
 * 
 * @param config - The configuration to parse and validate
 * @returns The validated StrategyConfig
 * @throws Error if validation fails
 */
export function parseStrategyConfig(config: unknown): StrategyConfig {
  assertValidStrategyConfig(config);
  return config;
}
