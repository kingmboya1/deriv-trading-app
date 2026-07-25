# Bot Engine Configuration Validator

This module provides Zod-based validation for strategy configurations used by the server-side bot engine.

## Usage

### Basic Validation

```typescript
import { validateStrategyConfig } from './config-validator';

const config = {
  name: "My Strategy",
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

const result = validateStrategyConfig(config);

if (result.isValid) {
  console.log("Configuration is valid!");
} else {
  console.error("Validation error:", result.message);
  console.error("All errors:", result.errors);
}
```

### Type Assertion

```typescript
import { assertValidStrategyConfig } from './config-validator';

try {
  assertValidStrategyConfig(config);
  // Config is valid, continue processing
} catch (error) {
  console.error("Invalid configuration:", error.message);
}
```

### Parse and Validate

```typescript
import { parseStrategyConfig } from './config-validator';

try {
  const validConfig = parseStrategyConfig(config);
  // validConfig is typed as StrategyConfig
  console.log("Valid config:", validConfig.name);
} catch (error) {
  console.error("Invalid configuration:", error.message);
}
```

## Validation Rules

The validator enforces the following rules per requirements 3.2-3.10:

### Requirement 3.2: Initial Stake
- **Range**: 0.01 - 100
- **Type**: number

### Requirement 3.3: Multiplier
- **Range**: 1 - 10
- **Type**: number

### Requirement 3.4: Max Stake
- **Constraint**: Must be >= initial stake
- **Type**: number (positive)

### Requirement 3.5: Max Consecutive Losses
- **Range**: 1 - 20
- **Type**: integer

### Requirement 3.6: Take Profit Amount
- **Constraint**: Must be > 0
- **Type**: number

### Requirement 3.7: Stop Loss Amount
- **Constraint**: Must be > 0
- **Type**: number

### Requirement 3.8: Inter-Trade Delay
- **Minimum**: 2000 milliseconds
- **Type**: integer

### Requirement 3.9: Contract Type
- **Valid values**: CALL, PUT, DIGITODD, DIGITEVEN, DIGITMATCH, DIGITDIFF, DIGITOVER, DIGITUNDER
- **Type**: enum

### Duration Unit
- **Valid values**: t, s, m, h, d
- **Type**: enum

## Example Configuration

See `example-config.json` for a complete, valid configuration example.

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```
