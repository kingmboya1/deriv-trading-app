import { z } from "zod";
import { StrategyConfig } from "./types";
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
export declare function validateStrategyConfig(config: unknown): ValidationResult;
/**
 * Type guard to check if a value is a valid StrategyConfig.
 * Throws an error if validation fails.
 *
 * @param config - The value to validate
 * @returns The validated StrategyConfig
 * @throws Error if validation fails
 */
export declare function assertValidStrategyConfig(config: unknown): asserts config is StrategyConfig;
/**
 * Parses and validates a strategy configuration, returning the typed result.
 *
 * @param config - The configuration to parse and validate
 * @returns The validated StrategyConfig
 * @throws Error if validation fails
 */
export declare function parseStrategyConfig(config: unknown): StrategyConfig;
//# sourceMappingURL=config-validator.d.ts.map