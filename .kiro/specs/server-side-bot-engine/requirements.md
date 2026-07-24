# Requirements Document

## Introduction

This document specifies the requirements for moving the Auto Trade bot logic from client-side execution to a server-side engine. The system SHALL interpret JSON-based strategy configurations, maintain persistent WebSocket connections to Deriv's API, and manage bot sessions independently of browser lifecycle. Phase 1 scope covers the default bot working server-side end-to-end without a UI for uploading custom strategies.

## Glossary

- **Bot_Engine**: The server-side component that interprets strategy configurations and executes automated trading
- **Session_Manager**: The component that tracks and manages active bot sessions in memory
- **Strategy_Config**: A JSON document defining trade parameters, stake progression, and risk limits
- **Deriv_Connection**: The WebSocket client that communicates with Deriv's trading API
- **Client**: The browser-based user interface
- **Next_API**: The Next.js API routes that proxy requests between Client and Bot_Server
- **Bot_Server**: The standalone Express server hosted on Railway/Render
- **Settlement**: The final state of a contract (won or lost)
- **Martingale**: A stake progression strategy that multiplies stake after losses
- **Stop_Condition**: A rule that halts trading (max losses, take profit, stop loss, max stake)

## Requirements

### Requirement 1: Session Management

**User Story:** As a trader, I want the bot to run independently of my browser session, so that I can close my browser without stopping the bot.

#### Acceptance Criteria

1. WHEN a user starts a bot session, THE Bot_Server SHALL create a new session with a unique session identifier
2. THE Session_Manager SHALL store session state in server memory
3. WHEN a user has an active session, THE Session_Manager SHALL reject attempts to start a second session
4. WHEN a bot session is created AND stop conditions are not already met, THE Bot_Engine SHALL maintain the session until explicitly stopped or a stop condition is met
5. WHEN a user closes their browser, THE Bot_Server SHALL continue executing the active bot session

### Requirement 2: WebSocket Connection Management

**User Story:** As a system operator, I want persistent WebSocket connections to Deriv, so that connections survive browser refreshes and reduce connection overhead.

#### Acceptance Criteria

1. WHEN a bot session starts, THE Deriv_Connection SHALL open a WebSocket connection to wss://ws.derivws.com/websockets/v3
2. WHEN the WebSocket connection is established, THE Deriv_Connection SHALL authorize using the provided API token
3. WHEN the WebSocket connection drops, THE Deriv_Connection SHALL attempt reconnection with exponential backoff
4. THE Deriv_Connection SHALL retry failed connections a maximum of 5 times
5. WHEN a bot session ends, THE Deriv_Connection SHALL immediately close the WebSocket connection
6. WHILE a session is active, THE Deriv_Connection SHALL maintain subscriptions to balance and portfolio updates

### Requirement 3: Strategy Configuration

**User Story:** As a system designer, I want strategies defined as JSON configurations, so that no executable code runs on the server from user input.

#### Acceptance Criteria

1. THE Bot_Engine SHALL load the default strategy configuration from a JSON file on server startup
2. WHEN a bot session starts, THE Bot_Engine SHALL validate the strategy configuration against defined rules
3. THE strategy validation SHALL reject initial stakes less than 0.01 or greater than 100
4. THE strategy validation SHALL reject stake multipliers less than 1 or greater than 10
5. THE strategy validation SHALL reject configurations where max stake is less than initial stake
6. THE strategy validation SHALL reject max consecutive losses less than 1 or greater than 20
7. THE strategy validation SHALL reject take profit amounts less than or equal to 0
8. THE strategy validation SHALL reject stop loss amounts less than or equal to 0
9. THE strategy validation SHALL reject inter-trade delays less than 2000 milliseconds
10. THE strategy validation SHALL reject invalid contract types not in the supported enum
11. THE strategy configuration SHALL remain immutable throughout the session lifetime

### Requirement 4: Trade Execution

**User Story:** As a trader, I want the bot to place trades automatically according to the strategy, so that I don't need to manually execute each trade.

#### Acceptance Criteria

1. WHEN a bot session starts, THE Bot_Engine SHALL place the first trade using the initial stake from the strategy
2. WHEN placing a trade, THE Bot_Engine SHALL send a proposal request to Deriv with the configured contract type, symbol, duration, and stake
3. WHEN a proposal is received, THE Bot_Engine SHALL immediately purchase the contract
4. WHEN a contract is purchased successfully, THE Bot_Engine SHALL record the contract ID as pending
5. IF recording the pending contract ID fails after a successful purchase, THE Bot_Engine SHALL treat it as a trade placement failure and stop the session
6. IF a contract purchase request fails, THE Bot_Engine SHALL stop the session and record the error
7. THE Bot_Engine SHALL subscribe to proposal_open_contract updates for the pending contract
8. WHILE a contract is pending, THE Bot_Engine SHALL NOT place any new trades
9. WHEN a contract settlement is detected, THE Bot_Engine SHALL clear the pending contract ID
10. WHEN a trade placement fails, THE Bot_Engine SHALL stop the session and record the error

### Requirement 5: Martingale Stake Progression

**User Story:** As a trader, I want the bot to increase stakes after losses and reset after wins, so that I can implement a martingale strategy.

#### Acceptance Criteria

1. WHEN a contract settles as a loss, THE Bot_Engine SHALL calculate the next stake as the current stake multiplied by the strategy multiplier
2. WHEN a contract settles as a win, THE Bot_Engine SHALL reset the next stake to the initial stake from the strategy
3. WHEN calculating the next stake, THE Bot_Engine SHALL round the result to 2 decimal places
4. WHEN the calculated next stake exceeds max stake after a loss, THE Bot_Engine SHALL stop the session with stop reason "max_stake"
5. WHEN a loss occurs, THE Bot_Engine SHALL increment the consecutive losses counter
6. WHEN a win occurs, THE Bot_Engine SHALL reset the consecutive losses counter to zero

### Requirement 6: Profit and Loss Accounting

**User Story:** As a trader, I want accurate tracking of profit and loss, so that I can monitor bot performance and enforce stop conditions.

#### Acceptance Criteria

1. WHEN a contract settles, THE Bot_Engine SHALL extract the profit value from the settlement message
2. WHEN a profit value is extracted, THE Bot_Engine SHALL add it to the accumulated P/L
3. WHEN updating accumulated P/L, THE Bot_Engine SHALL round the result to 2 decimal places
4. THE accumulated P/L SHALL equal the sum of all settled trade profits at any point in time
5. WHEN a contract is still pending, THE Bot_Engine SHALL NOT include it in accumulated P/L calculations
6. WHEN accumulated losses approach the stop loss threshold, THE Bot_Engine SHALL prepare to trigger stop conditions

### Requirement 7: Stop Conditions

**User Story:** As a trader, I want the bot to stop automatically when risk limits are reached, so that I can protect my capital.

#### Acceptance Criteria

1. WHEN consecutive losses reach the max consecutive losses limit, THE Bot_Engine SHALL stop the session with stop reason "max_losses"
2. WHEN accumulated P/L reaches or exceeds the take profit amount, THE Bot_Engine SHALL stop the session with stop reason "take_profit"
3. WHEN accumulated P/L reaches or falls below the negative stop loss amount, THE Bot_Engine SHALL stop the session with stop reason "stop_loss"
4. WHEN the next calculated stake exceeds max stake, THE Bot_Engine SHALL stop the session with stop reason "max_stake"
5. WHEN a stop condition is met, THE Bot_Engine SHALL mark the session as not running
6. WHEN any stop condition is detected, THE Bot_Engine SHALL immediately block all subsequent trade placements

### Requirement 8: Trade Scheduling

**User Story:** As a trader, I want a delay between trades, so that the bot respects rate limits and allows time for market observation.

#### Acceptance Criteria

1. WHEN a contract settles, THE Bot_Engine SHALL wait for the inter-trade delay duration before placing the next trade
2. THE inter-trade delay SHALL be at least 2000 milliseconds
3. WHEN a session is stopped during the inter-trade delay, THE Bot_Engine SHALL cancel the scheduled next trade without affecting open positions
4. WHEN a stop condition is met during the inter-trade delay, THE Bot_Engine SHALL cancel the scheduled next trade

### Requirement 9: Trade History

**User Story:** As a trader, I want to see a history of all trades executed by the bot, so that I can review performance and debug issues.

#### Acceptance Criteria

1. WHEN a contract is purchased, THE Bot_Engine SHALL create a trade record with contract ID, type, symbol, stake, and timestamp
2. WHEN a contract settles, THE Bot_Engine SHALL update the trade record with result (win/loss), payout, and profit
3. THE trade record SHALL include a unique trade identifier
4. THE Bot_Engine SHALL maintain trade records in chronological order
5. WHEN status is requested, THE Bot_Engine SHALL include all trade records in the response

### Requirement 10: Session Control API

**User Story:** As a user, I want to start and stop the bot through API endpoints, so that I can control bot execution from the web interface.

#### Acceptance Criteria

1. WHEN a POST request is made to /api/bot/start, THE Next_API SHALL verify user authentication
2. WHEN authentication is valid, THE Next_API SHALL forward the user ID and Deriv token to the Bot_Server
3. WHEN the Bot_Server receives a start request, THE Bot_Server SHALL create a new session and return the session ID
4. WHEN a POST request is made to /api/bot/stop, THE Next_API SHALL forward the session ID to the Bot_Server
5. WHEN the Bot_Server receives a stop request, THE Bot_Server SHALL stop the session and return the final status
6. WHEN a POST request to start is made for a user with an active session, THE Bot_Server SHALL return an error with status 400

### Requirement 11: Status Monitoring

**User Story:** As a user, I want to see real-time bot status, so that I can monitor trades, profit/loss, and session state.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/bot/status with a session ID, THE Next_API SHALL forward the request to the Bot_Server
2. WHEN the Bot_Server receives a status request, THE Bot_Server SHALL retrieve the session state from memory
3. THE status response SHALL include session ID, running state, current stake, consecutive losses, accumulated P/L, stop reason, error message, and trade history
4. THE status response SHALL include session uptime in milliseconds
5. WHEN a status request is made for a non-existent session, THE Bot_Server SHALL return a 404 error
6. THE status endpoint SHALL respond in less than 200 milliseconds

### Requirement 12: Error Handling - Connection Failures

**User Story:** As a trader, I want the bot to handle connection failures gracefully, so that temporary network issues don't cause data loss.

#### Acceptance Criteria

1. WHEN the WebSocket connection to Deriv fails during session start, THE Bot_Server SHALL return an error with status 500
2. WHEN the WebSocket connection drops during an active session, THE Deriv_Connection SHALL attempt to reconnect up to the configured maximum attempts
3. WHEN reconnection succeeds, THE Bot_Engine SHALL resume from the last known state
4. WHEN reconnection fails after maximum attempts, THE Bot_Engine SHALL forcibly terminate the session even if error recording fails
5. IF a contract is pending during a connection drop, THE Bot_Engine SHALL query proposal_open_contract after reconnection to retrieve contract status

### Requirement 13: Error Handling - Trade Placement Failures

**User Story:** As a trader, I want clear error messages when trades fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. WHEN a proposal request returns an error, THE Bot_Engine SHALL stop the session immediately
2. WHEN a buy request fails, THE Bot_Engine SHALL stop the session immediately
3. WHEN a trade placement error occurs, THE Bot_Engine SHALL set the session error field with the API error message
4. WHEN a trade placement error occurs, THE Bot_Engine SHALL set the stop reason to null
5. WHEN a session error is set, THE error message SHALL be included in all subsequent status responses

### Requirement 14: Error Handling - Malformed Messages

**User Story:** As a system operator, I want the bot to handle unexpected message formats, so that malformed data doesn't crash sessions.

#### Acceptance Criteria

1. WHEN a WebSocket message cannot be parsed as JSON, THE Deriv_Connection SHALL log the error and ignore the message
2. WHEN a WebSocket message has an unexpected structure, THE Deriv_Connection SHALL log the error and ignore the message
3. WHEN a contract remains pending beyond 5 minutes, THE Bot_Engine SHALL query proposal_open_contract directly for information gathering
4. AFTER querying proposal_open_contract directly, THE contract SHALL remain in pending state until settlement is received
5. THE Bot_Engine SHALL continue running after ignoring malformed messages

### Requirement 15: Session Cleanup

**User Story:** As a system operator, I want proper cleanup when sessions end, so that resources don't leak.

#### Acceptance Criteria

1. WHEN a session is stopped, THE Bot_Engine SHALL cancel any scheduled trade timers
2. WHEN a session is stopped, THE Bot_Engine SHALL unsubscribe from all WebSocket subscriptions
3. WHEN a session is stopped, THE Bot_Engine SHALL close the WebSocket connection
4. WHEN a session is stopped, THE Session_Manager SHALL remove the session from memory
5. WHEN a stop request is made for an already stopped session, THE Bot_Server SHALL attempt to return the same final status
6. IF retrieving or formatting the final status fails for an already stopped session, THE Bot_Server SHALL return an error response

### Requirement 16: One Bot Per User Enforcement

**User Story:** As a system architect, I want to prevent multiple concurrent bots per user, so that we can ensure predictable resource usage and avoid conflicting trades.

#### Acceptance Criteria

1. WHEN a user has an active session, THE Session_Manager SHALL maintain a mapping from user ID to session ID
2. WHEN a start request is received, THE Session_Manager SHALL check if the user has an active session
3. IF the user has an active session, THE Session_Manager SHALL reject the start request with error "User already has an active bot session" and keep the existing session running
4. WHEN a session ends, THE Session_Manager SHALL remove the user ID to session ID mapping
5. AT ANY POINT IN TIME, a user SHALL have at most one running bot session

### Requirement 17: Client-Side Integration

**User Story:** As a developer, I want the client to communicate with the bot via HTTP, so that all bot logic is removed from the client bundle.

#### Acceptance Criteria

1. WHEN the user clicks "Start Bot", THE Client SHALL call POST /api/bot/start
2. WHEN the start request succeeds, THE Client SHALL begin polling GET /api/bot/status every 2 seconds
3. WHEN a status response is received, THE Client SHALL update the UI with current stake, accumulated P/L, and trade history
4. WHEN the status response indicates the session is not running, THE Client SHALL stop polling
5. WHEN the user clicks "Stop Bot", THE Client SHALL call POST /api/bot/stop
6. WHEN the client component is unmounting, THE Client SHALL stop polling
7. IF both stop button click and component unmount occur simultaneously, THE Client SHALL prioritize component unmount cleanup

### Requirement 18: Authentication and Authorization

**User Story:** As a security engineer, I want all API requests authenticated, so that users can only control their own bot sessions.

#### Acceptance Criteria

1. WHEN a request is made to any /api/bot/* endpoint, THE Next_API SHALL verify the user's authentication token
2. IF authentication fails, THE Next_API SHALL return a 401 Unauthorized error
3. WHEN forwarding requests to Bot_Server, THE Next_API SHALL include the authenticated user ID
4. THE Bot_Server SHALL trust the user ID provided by Next_API
5. WHEN a stop request is received, THE Bot_Server SHALL verify the session belongs to the requesting user

### Requirement 19: Performance - Trade Latency

**User Story:** As a trader, I want quick trade execution, so that the bot can respond promptly to market conditions.

#### Acceptance Criteria

1. WHEN a contract settles, THE Bot_Engine SHALL detect the settlement within 50 milliseconds
2. THE Bot_Engine SHALL place the next trade within 500 milliseconds of settlement detection (excluding inter-trade delay)
3. THE status endpoint SHALL respond within 200 milliseconds under normal load

### Requirement 20: Performance - Scalability

**User Story:** As a system operator, I want the system to handle multiple concurrent users, so that the service can scale.

#### Acceptance Criteria

1. THE Bot_Server SHALL support at least 100 concurrent bot sessions
2. EACH session SHALL consume no more than 500KB of memory for state and trade history
3. THE total memory footprint for 100 sessions SHALL NOT exceed 512MB

### Requirement 21: Data Precision

**User Story:** As a trader, I want accurate financial calculations, so that my profit and loss is tracked correctly.

#### Acceptance Criteria

1. WHEN calculating stakes, THE Bot_Engine SHALL round to 2 decimal places
2. WHEN calculating profit/loss, THE Bot_Engine SHALL round to 2 decimal places
3. WHEN parsing profit values from API responses, THE Bot_Engine SHALL handle non-numeric values as zero
4. ALL currency amounts SHALL use 2 decimal place precision

### Requirement 22: Configuration Immutability

**User Story:** As a system architect, I want strategy configurations to be immutable during sessions, so that behavior is predictable and reproducible.

#### Acceptance Criteria

1. WHEN a bot session is created, THE Bot_Engine SHALL create an immutable copy of the strategy configuration
2. THE strategy configuration SHALL NOT change during the session lifetime
3. WHEN a new session is started, THE Bot_Engine SHALL load a fresh copy of the default strategy configuration

### Requirement 23: Default Strategy

**User Story:** As a trader, I want a working default strategy available without configuration, so that I can start trading immediately.

#### Acceptance Criteria

1. THE Bot_Server SHALL include a default strategy JSON file
2. THE default strategy SHALL use contract type DIGITEVEN
3. THE default strategy SHALL use symbol R_100
4. THE default strategy SHALL use initial stake 0.35
5. THE default strategy SHALL use stake multiplier 2
6. THE default strategy SHALL use max stake 10
7. THE default strategy SHALL use max consecutive losses 5
8. THE default strategy SHALL use take profit amount 5
9. THE default strategy SHALL use stop loss amount 10
10. THE default strategy SHALL use inter-trade delay 2000 milliseconds
11. THE default strategy SHALL pass all validation rules
