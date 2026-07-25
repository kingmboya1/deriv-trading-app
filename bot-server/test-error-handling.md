# Error Handling Middleware - Manual Test Guide

This document provides manual test cases to verify the error handling middleware implemented in `bot-server/index.ts`.

## Test Cases

### 1. Test Malformed JSON Request (400 Bad Request)

**Requirement:** 12.1, 14.1

**Test:** Send a POST request with invalid JSON

```bash
# Using curl (PowerShell)
curl.exe -X POST http://localhost:3001/sessions/start `
  -H "Content-Type: application/json" `
  -d '{invalid json here}'
```

**Expected Response:**
- Status Code: 400
- Response Body:
```json
{
  "error": "Bad Request",
  "message": "Malformed JSON in request body",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Expected Console Log:**
```
[timestamp] Malformed JSON in request body: <error details>
```

---

### 2. Test WebSocket Connection Failure (500 Internal Server Error)

**Requirement:** 12.1, 14.2

**Test:** Send a POST request with invalid Deriv token

```bash
# Using curl (PowerShell)
curl.exe -X POST http://localhost:3001/sessions/start `
  -H "Content-Type: application/json" `
  -d '{\"userId\":\"test-user\",\"derivToken\":\"invalid-token-12345\"}'
```

**Expected Response:**
- Status Code: 500
- Response Body:
```json
{
  "error": "Connection failure",
  "message": "<WebSocket error details in dev mode>",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Expected Console Log:**
```
[timestamp] Error: <WebSocket connection error details>
```

---

### 3. Test General Error Handling (500 Internal Server Error)

**Requirement:** 14.1, 14.2, 14.5

**Test:** Trigger any unexpected server error

**Expected Behavior:**
- Server DOES NOT crash
- Error is logged to console with timestamp
- Appropriate error response is returned to client
- Server continues running and can process subsequent requests

---

### 4. Test Error Logging Without Crash

**Requirement:** 14.5

**Verification Steps:**
1. Start the server: `npm run dev`
2. Trigger any of the error scenarios above
3. Verify error is logged to console
4. Send a valid request to `/health` endpoint
5. Verify server responds successfully (server didn't crash)

```bash
# Health check after error
curl.exe http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "uptime": 123.456,
  "activeSessions": 0,
  "maxSessions": 100,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Implementation Details

### 1. JSON Parsing Error Handler

**Location:** `bot-server/index.ts` (lines 63-77)

**How it works:**
- Middleware catches `SyntaxError` with `'body'` property
- Logs error with timestamp
- Returns 400 status with descriptive error message
- Passes other errors to next error handler

### 2. General Error Handler

**Location:** `bot-server/index.ts` (lines 138-167)

**How it works:**
- Catches all unhandled errors from routes
- Logs error with full stack trace
- Detects WebSocket connection failures by checking error message
- Returns 500 status with appropriate error type
- Hides internal error details in production mode
- Never crashes the server

### 3. WebSocket Error Detection

**Pattern Matching:**
```typescript
const isWebSocketError = err.message.toLowerCase().includes("websocket") ||
                        err.message.toLowerCase().includes("connection") ||
                        err.message.toLowerCase().includes("deriv");
```

This catches common WebSocket-related errors like:
- "WebSocket connection failed"
- "Connection timeout"
- "Deriv API error"
- "Failed to connect to Deriv"

---

## Production vs Development Mode

**Development Mode (`NODE_ENV=development`):**
- Full error messages exposed to client
- Stack traces available for debugging

**Production Mode (default):**
- Generic error messages returned to client
- Full details logged server-side only
- Security: prevents information leakage

---

## Coverage Summary

| Requirement | Description | Implementation |
|-------------|-------------|----------------|
| 12.1 | Handle connection failures (500) | ✅ General error handler + WebSocket detection |
| 14.1 | Handle malformed JSON | ✅ JSON parsing error middleware (400) |
| 14.2 | Handle unexpected message formats | ✅ General error handler catches all |
| 14.5 | Log errors without crashing | ✅ All errors logged, server continues |

---

## Notes

- Error handling middleware MUST be placed after all route handlers
- JSON parsing error handler MUST be placed immediately after `express.json()`
- Multiple error handlers work together via `next(err)` pattern
- Server never crashes due to unhandled errors in routes
