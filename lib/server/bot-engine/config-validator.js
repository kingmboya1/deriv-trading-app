"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStrategyConfig = validateStrategyConfig;
exports.assertValidStrategyConfig = assertValidStrategyConfig;
exports.parseStrategyConfig = parseStrategyConfig;
const zod_1 = require("zod");
/**
 * Zod schema for validating strategy configurations.
 * Enforces all validation rules from requirements 3.2-3.10.
 */
// Contract type enum schema
const contractTypeSchema = zod_1.z.enum([
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
const durationUnitSchema = zod_1.z.enum(["t", "s", "m", "h", "d"]);
// Trade configuration schema
const tradeConfigSchema = zod_1.z.object({
    contractType: contractTypeSchema,
    symbol: zod_1.z.string().min(1, "Symbol must not be empty"),
    duration: zod_1.z.number().positive("Duration must be positive"),
    durationUnit: durationUnitSchema,
    barrier: zod_1.z.string().optional(),
});
// Stake configuration schema
const stakeConfigSchema = zod_1.z.object({
    initial: zod_1.z
        .number()
        .min(0.01, "Initial stake must be at least 0.01")
        .max(100, "Initial stake must not exceed 100"),
    multiplier: zod_1.z
        .number()
        .min(1, "Multiplier must be at least 1")
        .max(10, "Multiplier must not exceed 10"),
    maxStake: zod_1.z.number().positive("Max stake must be positive"),
});
// Risk management configuration schema
const riskConfigSchema = zod_1.z.object({
    maxConsecutiveLosses: zod_1.z
        .number()
        .int("Max consecutive losses must be an integer")
        .min(1, "Max consecutive losses must be at least 1")
        .max(20, "Max consecutive losses must not exceed 20"),
    takeProfitAmount: zod_1.z
        .number()
        .positive("Take profit amount must be greater than 0"),
    stopLossAmount: zod_1.z
        .number()
        .positive("Stop loss amount must be greater than 0"),
});
// Execution configuration schema
const executionConfigSchema = zod_1.z.object({
    interTradeDelay: zod_1.z
        .number()
        .int("Inter-trade delay must be an integer")
        .min(2000, "Inter-trade delay must be at least 2000 milliseconds"),
    autoRestart: zod_1.z.boolean(),
});
// Full strategy configuration schema
const strategyConfigSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1, "Strategy name must not be empty"),
    version: zod_1.z.string().min(1, "Version must not be empty"),
    description: zod_1.z.string().optional(),
    trade: tradeConfigSchema,
    stake: stakeConfigSchema,
    risk: riskConfigSchema,
    execution: executionConfigSchema,
})
    .refine((config) => config.stake.maxStake >= config.stake.initial, {
    message: "Max stake must be greater than or equal to initial stake",
    path: ["stake", "maxStake"],
});
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
function validateStrategyConfig(config) {
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
function assertValidStrategyConfig(config) {
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
function parseStrategyConfig(config) {
    assertValidStrategyConfig(config);
    return config;
}
//# sourceMappingURL=config-validator.js.map