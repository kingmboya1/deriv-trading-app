# Implementation Plan: Server-Side Bot Engine

## Overview

This plan implements a server-side bot engine that moves automated trading logic from the client to a standalone Express server. The implementation follows a layered approach: configuration and validation → core engine logic → connection management → API integration → client refactoring. The bot interprets JSON strategy configs, maintains persistent WebSocket connections to Deriv's API, and enforces one-bot-per-user sessions.

## Tasks

- [x] 1. Set up configuration validation layer
  - [x] 1.1 Create Zod schema validator for strategy configurations
    - Create `lib/server/bot-engine/config-validator.ts`
    - Define Zod schema matching StrategyConfig interface
    - Implement validation rules: initial stake 0.01-100, multiplier 1-10, maxStake >= initial, maxConsecutiveLosses 1-20, takeProfitAmount > 0, stopLossAmount > 0, interTradeDelay >= 2000
    - Export `validateStrategyConfig()` function
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_
  
  - [ ]* 1.2 Write unit tests for config validation
    - Test all validation boundary conditions
    - Test invalid contract types and duration units
    - Test edge cases (zero, negative, undefined values)
    - _Requirements: 3.2-3.10_
  
  - [x] 1.3 Create default strategy JSON file
    - Create `lib/server/bot-engine/default-strategy.json`
    - Use DIGITEVEN contract type, R_100 symbol
    - Set initial stake 0.35, multiplier 2, maxStake 10
    - Set maxConsecutiveLosses 5, takeProfit 5, stopLoss 10
    - Set interTradeDelay 2000ms
    - _Requirements: 23.1-23.11_

- [x] 2. Checkpoint - Verify configuration layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement core bot engine
  - [x] 3.1 Create BotEngine class skeleton
    - Create `lib/server/bot-engine/bot-engine.ts`
    - Define BotEngine class with BotState and StrategyConfig properties
    - Implement constructor accepting userId, config, derivToken
    - Add utility methods: `round2()`, `generateTradeId()`
    - _Requirements: 3.11, 21.1, 21.2_
  
  - [x] 3.2 Implement stake progression logic
    - Implement `calculateNextStake()` method
    - Reset to initial stake on wins
    - Multiply by config multiplier on losses, round to 2 decimals
    - Increment/reset consecutive losses counter
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_
  
  - [ ]* 3.3 Write property test for stake progression
    - **Property 2: Stake Progression Correctness**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Generate random win/loss sequences
    - Verify stake calculations match martingale formula
    - Test maxStake capping behavior
  
  - [x] 3.4 Implement P/L accounting
    - Add `updateProfitLoss()` method
    - Parse profit from settlement messages, handle non-numeric as zero
    - Add rounded profit to accumulated P/L
    - Update trade record with result and profit
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 21.2, 21.3_
  
  - [ ]* 3.5 Write property test for P/L accounting
    - **Property 4: P/L Accounting Accuracy**
    - **Validates: Requirements 6.1-6.4**
    - Generate random trade sequences with profits/losses
    - Verify accumulatedPL equals sum of settled trades
    - Test rounding edge cases
  
  - [x] 3.6 Implement stop condition checks
    - Add `checkStopConditions()` method
    - Check maxConsecutiveLosses, takeProfitAmount, stopLossAmount, maxStake
    - Set isRunning to false and populate stopReason when triggered
    - Block subsequent trade placements after stop
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 3.7 Write unit tests for stop conditions
    - Test each stop condition independently
    - Verify stopReason set correctly
    - Verify no trades placed after stop
    - _Requirements: 7.1-7.6_

- [x] 4. Checkpoint - Verify core engine logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement WebSocket connection manager
  - [x] 5.1 Create DerivConnection class
    - Create `lib/server/bot-engine/deriv-connection.ts`
    - Implement connection to wss://ws.derivws.com/websockets/v3
    - Add authorization with API token
    - Implement `request<T>()` method for sending/receiving API calls
    - _Requirements: 2.1, 2.2_
  
  - [x] 5.2 Add reconnection logic with exponential backoff
    - Implement retry mechanism (max 5 attempts)
    - Use exponential backoff delays (2s, 4s, 8s, 16s, 32s)
    - Auto-reconnect on connection drop
    - Force terminate session after max retries
    - _Requirements: 2.3, 2.4, 12.2, 12.3, 12.4_
  
  - [x] 5.3 Implement subscription management
    - Add `subscribe()` method with message handler registration
    - Add `unsubscribe()` method
    - Track active subscription IDs
    - Subscribe to balance and portfolio updates on connection
    - _Requirements: 2.6_
  
  - [x] 5.4 Add connection cleanup
    - Implement `disconnect()` method
    - Unsubscribe all active subscriptions
    - Close WebSocket connection
    - Clear connection state
    - _Requirements: 2.5, 15.2, 15.3_
  
  - [ ]* 5.5 Write unit tests for WebSocket connection
    - Mock WebSocket connection
    - Test authorization flow
    - Test reconnection logic
    - Test subscription lifecycle
    - _Requirements: 2.1-2.6, 12.2-12.4_

- [x] 6. Implement trade execution workflow
  - [x] 6.1 Add trade placement logic to BotEngine
    - Implement `placeTrade(stake)` method
    - Build proposal request payload
    - Send proposal, extract proposalId and askPrice
    - Send buy request with proposalId
    - Record pendingContractId and create TradeRecord
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8, 9.1_
  
  - [x] 6.2 Handle trade placement failures
    - Catch proposal errors, set error field, stop session
    - Catch buy errors, set error field, stop session
    - Set stopReason to null on trade errors
    - _Requirements: 4.6, 4.10, 13.1, 13.2, 13.3, 13.4_
  
  - [x] 6.3 Implement contract settlement handler
    - Add `handleContractSettlement()` method
    - Parse proposal_open_contract messages
    - Detect settlement status (won/lost)
    - Clear pendingContractId on settlement
    - Call updateProfitLoss() and checkStopConditions()
    - _Requirements: 4.7, 4.9, 6.1, 6.5_
  
  - [x] 6.4 Add trade scheduling with inter-trade delay
    - Implement timer-based scheduling after settlement
    - Use config.execution.interTradeDelay (minimum 2000ms)
    - Cancel scheduled timer if session stopped
    - Only schedule next trade if isRunning is true
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 15.1_
  
  - [ ]* 6.5 Write property test for concurrent pending contracts
    - **Property 5: No Concurrent Pending Contracts**
    - **Validates: Requirements 4.8**
    - Attempt overlapping placeTrade calls
    - Verify only one pending contract at a time
    - Verify second trade rejected while first pending
  
  - [ ]* 6.6 Write integration tests for trade execution
    - Mock Deriv WebSocket responses
    - Test full trade cycle: proposal → buy → settlement
    - Test win scenario (stake reset, P/L increase)
    - Test loss scenario (stake multiplication, consecutive losses)
    - Test stop condition triggering
    - _Requirements: 4.1-4.10, 5.1-5.6, 6.1-6.6, 7.1-7.6_

- [x] 7. Checkpoint - Verify trade execution
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement session manager
  - [~] 8.1 Create SessionManager class
    - Create `lib/server/bot-engine/session-manager.ts`
    - Use Map for sessionId → BotEngine storage
    - Use Map for userId → sessionId reverse index
    - Implement `createSession()`, `getSession()`, `deleteSession()`
    - Generate unique UUIDs for session IDs
    - _Requirements: 1.1, 1.2, 16.1_
  
  - [~] 8.2 Enforce one-bot-per-user rule
    - Implement `hasActiveSession(userId)` method
    - Implement `getUserSession(userId)` method
    - Reject createSession if user already has active session
    - Return error "User already has an active bot session"
    - _Requirements: 1.3, 16.2, 16.3, 16.5_
  
  - [~] 8.3 Implement session cleanup
    - Remove session from both Maps on deleteSession
    - Remove userId → sessionId mapping on session end
    - _Requirements: 15.4, 16.4_
  
  - [ ]* 8.4 Write property test for one-bot-per-user
    - **Property 1: One Bot Per User**
    - **Validates: Requirements 1.3, 16.2, 16.3, 16.5**
    - Simulate concurrent start requests for same user
    - Verify second request rejected
    - Verify first session remains running
  
  - [ ]* 8.5 Write unit tests for session management
    - Test session creation with unique IDs
    - Test getUserSession lookup
    - Test session cleanup removes all mappings
    - _Requirements: 1.1, 1.2, 15.4, 16.1, 16.4_

- [ ] 9. Create bot server Express application
  - [~] 9.1 Set up Express server structure
    - Create `bot-server/` directory in project root
    - Create `bot-server/index.ts` (main entry point)
    - Create `bot-server/package.json` with dependencies (express, ws, uuid)
    - Create `bot-server/tsconfig.json` for TypeScript compilation
    - Add CORS middleware for Next.js origin
    - _Requirements: 10.3, 10.4_
  
  - [~] 9.2 Implement session start endpoint
    - Create `bot-server/routes/sessions.ts`
    - Add POST /sessions/start route
    - Extract userId and derivToken from request body
    - Check hasActiveSession, return 400 if exists
    - Create BotEngine instance with default strategy
    - Call startSession, return sessionId on success
    - _Requirements: 10.1, 10.2, 10.3, 10.6_
  
  - [~] 9.3 Implement session stop endpoint
    - Add POST /sessions/stop route
    - Extract sessionId and optional reason from body
    - Call BotEngine.stopSession
    - Return final status with stopped: true
    - Handle already-stopped sessions gracefully
    - _Requirements: 10.4, 10.5, 15.5, 15.6_
  
  - [~] 9.4 Implement status endpoint
    - Add GET /sessions/status route
    - Extract sessionId from query params
    - Retrieve session from SessionManager
    - Return 404 if session not found
    - Return BotStatus with sessionId, trades, P/L, uptime
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [~] 9.5 Add error handling middleware
    - Handle malformed JSON requests
    - Handle WebSocket connection failures (return 500)
    - Log errors without crashing server
    - _Requirements: 12.1, 14.1, 14.2, 14.5_
  
  - [~] 9.6 Add environment configuration
    - Create `bot-server/.env.example`
    - Add PORT, CORS_ORIGIN, MAX_SESSIONS config
    - Load default strategy from JSON file on startup
    - _Requirements: 22.3, 23.1_

- [~] 10. Checkpoint - Verify bot server
  - Ensure server starts, endpoints respond, ask the user if questions arise.

- [ ] 11. Implement Next.js API proxy routes
  - [~] 11.1 Create /api/bot/start route
    - Create `app/api/bot/start/route.ts`
    - Verify user authentication (extract userId from session/JWT)
    - Return 401 if unauthorized
    - Extract derivToken from request body
    - Forward userId and derivToken to Bot Server POST /sessions/start
    - Return sessionId or error to client
    - _Requirements: 10.1, 10.2, 18.1, 18.2, 18.3_
  
  - [~] 11.2 Create /api/bot/stop route
    - Create `app/api/bot/stop/route.ts`
    - Verify user authentication
    - Extract sessionId from request body
    - Forward to Bot Server POST /sessions/stop
    - Return final status to client
    - _Requirements: 10.4, 10.5, 18.1, 18.2, 18.5_
  
  - [~] 11.3 Create /api/bot/status route
    - Create `app/api/bot/status/route.ts`
    - Verify user authentication
    - Extract sessionId from query params
    - Forward to Bot Server GET /sessions/status
    - Return bot status or 404 to client
    - _Requirements: 11.1-11.6, 18.1, 18.2_
  
  - [~] 11.4 Add BOT_SERVER_URL environment variable
    - Update `.env.local` with BOT_SERVER_URL
    - Document deployment URLs (Railway/Render)
    - _Requirements: 10.3, 10.4_

- [ ] 12. Implement client HTTP wrapper
  - [~] 12.1 Create bot client library
    - Create `lib/bot-client.ts`
    - Implement `startBot()` → POST /api/bot/start
    - Implement `stopBot(sessionId)` → POST /api/bot/stop
    - Implement `getBotStatus(sessionId)` → GET /api/bot/status
    - Add error handling for network failures
    - _Requirements: 17.1, 17.5_
  
  - [ ]* 12.2 Write unit tests for bot client
    - Mock fetch calls
    - Test successful start/stop/status flows
    - Test error handling (401, 404, 500)
    - _Requirements: 17.1-17.5_

- [ ] 13. Refactor AutoTradePanel to use HTTP bot client
  - [~] 13.1 Update AutoTradePanel component
    - Remove direct imports of `auto-trade-store.ts`
    - Replace with `botClient.startBot()` on "Start Bot" click
    - Start polling `botClient.getBotStatus()` every 2 seconds after start
    - Update UI state from status response (trades, P/L, stake, losses)
    - Stop polling when status.isRunning becomes false
    - Call `botClient.stopBot()` on "Stop Bot" click
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [~] 13.2 Add cleanup for component unmount
    - Clear polling interval on component unmount
    - Prioritize unmount cleanup if stop button and unmount occur simultaneously
    - _Requirements: 17.6, 17.7_
  
  - [~] 13.3 Display error messages from API
    - Show error message from API response if start/stop fails
    - Display stopReason when session stops automatically
    - Show connection errors gracefully
    - _Requirements: 13.3, 13.4, 13.5_

- [ ] 14. Remove deprecated client-side bot logic
  - [~] 14.1 Delete auto-trade-store.ts
    - Remove `lib/auto-trade-store.ts` file
    - Verify no remaining imports in codebase
    - _Requirements: 17.1_

- [~] 15. Checkpoint - Verify end-to-end flow
  - Test complete flow: client start → polling → trades execute → stop
  - Verify bot continues running after browser close
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Add deployment configuration
  - [~] 16.1 Create Railway/Render deployment config
    - Create `bot-server/Dockerfile` for containerization
    - Create `bot-server/railway.json` or `render.yaml`
    - Configure environment variables (PORT, CORS_ORIGIN)
    - Set up health check endpoint GET /health
    - _Requirements: 20.1, 20.2, 20.3_
  
  - [~] 16.2 Document deployment steps
    - Update README with bot server deployment instructions
    - Document environment variable setup
    - Add instructions for connecting Next.js to bot server
    - _Requirements: 10.3, 10.4_

- [~] 17. Final checkpoint - Complete system verification
  - Test one-bot-per-user enforcement
  - Test WebSocket reconnection behavior
  - Test stop conditions trigger correctly
  - Verify memory usage within limits (<512MB for 100 sessions)
  - Verify trade latency (<500ms excluding delay)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for faster MVP
- Each task references specific requirements from requirements.md for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties from design.md
- Unit tests validate specific examples and edge cases
- The bot server is deployed separately from Next.js/Vercel on Railway/Render
- Default strategy JSON is never exposed to client (server-side only)
- One bot per user is enforced at SessionManager level
- WebSocket connections persist independently of browser sessions
- All currency calculations use 2 decimal place precision

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.4", "3.6"] },
    { "id": 3, "tasks": ["3.3", "3.5", "3.7", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["5.5", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["6.5", "6.6", "8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3"] },
    { "id": 9, "tasks": ["8.4", "8.5", "9.1"] },
    { "id": 10, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 11, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 12, "tasks": ["12.1"] },
    { "id": 13, "tasks": ["12.2", "13.1"] },
    { "id": 14, "tasks": ["13.2", "13.3"] },
    { "id": 15, "tasks": ["14.1"] },
    { "id": 16, "tasks": ["16.1", "16.2"] }
  ]
}
```
