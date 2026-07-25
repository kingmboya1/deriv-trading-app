# End-to-End Test Guide: Server-Side Bot Engine

This guide walks you through verifying the complete server-side bot engine implementation locally before deployment.

---

## ✅ 1. Environment Variables Verification

### Next.js App (Root `.env.local`)

**File:** `c:\Users\user\Desktop\Deriv thirdpaty\temp-app\.env.local`

**Required Variables:**
```env
# ✅ Already configured
BOT_SERVER_URL=http://localhost:3001
```

**Status:** ✅ **COMPLETE** - BOT_SERVER_URL is set correctly for local development.

**What the code reads:**
- `app/api/bot/start/route.ts` reads `process.env.BOT_SERVER_URL`
- `app/api/bot/stop/route.ts` reads `process.env.BOT_SERVER_URL`
- `app/api/bot/status/route.ts` reads `process.env.BOT_SERVER_URL`

---

### Bot Server (`bot-server/.env`)

**File:** `c:\Users\user\Desktop\Deriv thirdpaty\temp-app\bot-server\.env` (**NEEDS TO BE CREATED**)

**Required Variables:**
```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
MAX_SESSIONS=100
```

**Status:** ⚠️ **ACTION REQUIRED** - Need to create `.env` file from `.env.example`

**What the code reads:**
- `bot-server/index.ts` reads:
  - `process.env.PORT` (default: 3001)
  - `process.env.CORS_ORIGIN` (default: http://localhost:3000)
  - `process.env.MAX_SESSIONS` (default: 100)

**Action Required:**
```bash
cd bot-server
cp .env.example .env
```

---

## 🚀 2. Server Startup Commands

### Prerequisites Check

```bash
# Check if bot-server dependencies are installed
cd "c:\Users\user\Desktop\Deriv thirdpaty\temp-app\bot-server"
dir node_modules

# If node_modules doesn't exist, install dependencies:
npm install
```

### Startup Sequence (TWO TERMINALS)

**Terminal 1: Bot Server**
```bash
# Navigate to bot-server directory
cd "c:\Users\user\Desktop\Deriv thirdpaty\temp-app\bot-server"

# Create .env file if it doesn't exist
copy .env.example .env

# Start the bot server
npm run dev
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║                      Bot Server                            ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running                                           ║
║  Port: 3001                                                ║
║  CORS Origin: http://localhost:3000                        ║
║  Max Sessions: 100                                         ║
╚════════════════════════════════════════════════════════════╝

Endpoints:
  - GET  /health
  - POST /sessions/start
  - POST /sessions/stop
  - GET  /sessions/status
```

**Verify Bot Server is Running:**
Open browser to: `http://localhost:3001/health`

Expected response:
```json
{
  "status": "ok",
  "uptime": 1.234,
  "activeSessions": 0,
  "maxSessions": 100,
  "timestamp": "2024-..."
}
```

---

**Terminal 2: Next.js App**
```bash
# Navigate to project root
cd "c:\Users\user\Desktop\Deriv thirdpaty\temp-app"

# Start Next.js development server
npm run dev
```

**Expected Output:**
```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Ready in X.Xs
```

---

## 🧪 3. Manual Test Flow (Full Cycle)

### Step 1: Initial Authentication
**Requirement:** 18.1, 18.2

1. Navigate to: `http://localhost:3000/login`
2. Authenticate with Deriv OAuth
3. Verify you're redirected to `/dashboard`
4. **Check cookies** (F12 → Application → Cookies):
   - ✅ `deriv_auth_token` should exist
   - ✅ `deriv_account_id` should exist
   
**If cookies missing:** Authentication failed, cannot proceed with bot tests.

---

### Step 2: Navigate to Auto Trade Panel
**Requirement:** 17.1

1. Go to: `http://localhost:3000/dashboard`
2. Click on "Auto Trade" in the sidebar
3. Verify AutoTradePanel loads without errors
4. **Expected UI:** Configuration form with:
   - Trade mode selector
   - Symbol selector
   - Base stake input
   - Martingale multiplier
   - Risk management settings
   - "Start Bot" button

**Check Console:** No errors related to `auto-trade-store` (we deleted it)

---

### Step 3: Start Bot Session
**Requirements:** 10.1, 10.2, 17.1

1. Fill in bot configuration (or use defaults)
2. Click "Start Bot"
3. **Open Network Tab** (F12 → Network)

**Expected API Call:**
```
POST http://localhost:3000/api/bot/start
Request Body:
{
  "derivToken": "xxxxx" // Your Deriv API token
}

Response (200 OK):
{
  "sessionId": "uuid-string-here",
  "status": "started"
}
```

**Successful Response Indicators:**
- ✅ Status: 200 OK
- ✅ Response has `sessionId` field
- ✅ `status: "started"`
- ✅ UI changes to "Bot Running" view
- ✅ Live stats appear (Next Stake, Consec. Losses, Session P/L, W/L)

**Failure Response Examples:**

**401 Unauthorized** (No auth cookies):
```json
{
  "error": "Unauthorized - missing authentication cookies"
}
```
**Fix:** Re-authenticate at `/login`

**400 Bad Request** (No derivToken):
```json
{
  "error": "derivToken is required in request body"
}
```
**Fix:** Check that WebSocket connection is active

**500 Internal Server Error** (Bot server down):
```json
{
  "error": "Bot server URL not configured"
}
```
**Fix:** Verify bot-server is running on port 3001

**500 with message** (Bot server returned error):
```json
{
  "error": "User already has an active bot session"
}
```
**Fix:** Stop existing session first

---

### Step 4: Verify Status Polling
**Requirements:** 17.2, 17.3, 17.4

**What to Check:**

1. **Network Tab:** Look for repeated GET requests every 2 seconds:
```
GET http://localhost:3000/api/bot/status?sessionId=<uuid>
```

2. **Request Frequency:** Should fire every ~2000ms

3. **Successful Response (200 OK):**
```json
{
  "sessionId": "uuid",
  "isRunning": true,
  "currentStake": 0.70,
  "consecutiveLosses": 1,
  "accumulatedPL": -0.35,
  "stopReason": null,
  "error": null,
  "trades": [
    {
      "id": "trade-id",
      "contractId": 123456789,
      "contractType": "DIGITEVEN",
      "symbol": "R_100",
      "stake": 0.35,
      "result": "loss",
      "payout": 0.68,
      "profit": -0.35,
      "timestamp": 1234567890000
    }
  ],
  "uptime": 60000
}
```

4. **UI Updates:** Verify these values update in real-time:
   - ✅ Next Stake changes after each trade
   - ✅ Consecutive Losses increments on losses, resets on wins
   - ✅ Session P/L accumulates trade profits
   - ✅ W/L counts update
   - ✅ Trade History list grows

**Failure Response Examples:**

**404 Not Found** (Session expired):
```json
{
  "error": "Session not found"
}
```
**Fix:** Start a new session

**401 Unauthorized** (Session expired):
```json
{
  "error": "Unauthorized - missing authentication cookies"
}
```
**Fix:** Re-authenticate

---

### Step 5: Browser Persistence Test
**Requirements:** 1.4, 1.5

**This is the KEY test for server-side bot execution!**

1. **While bot is running**, copy the `sessionId` from Network tab
2. **Close the browser tab** (or entire browser window)
3. Wait 10-15 seconds
4. **Reopen browser** and navigate to `http://localhost:3000/dashboard`
5. Click "Auto Trade"

**Expected Behavior:**
- ❌ Bot should NOT appear as running (client lost session state)
- ℹ️ This is expected - client doesn't persist sessionId

**To verify bot IS still running server-side:**

Open new browser tab and manually call status API:
```
http://localhost:3001/sessions/status?sessionId=<paste-your-sessionId>
```

**Expected Response:**
```json
{
  "sessionId": "your-uuid",
  "isRunning": true,
  "currentStake": 1.40,
  "consecutiveLosses": 2,
  "accumulatedPL": -1.05,
  ...
}
```

✅ **Success:** Bot is still running on server despite browser close!

**OR** paste this in browser console while authenticated:
```javascript
fetch('/api/bot/status?sessionId=<your-sessionId>').then(r => r.json()).then(console.log)
```

---

### Step 6: Stop Bot Session
**Requirements:** 10.4, 10.5, 17.5

1. While bot is running, click "Stop Bot" button
2. **Check Network Tab:**

**Expected API Call:**
```
POST http://localhost:3000/api/bot/stop
Request Body:
{
  "sessionId": "uuid",
  "reason": "manual"
}

Response (200 OK):
{
  "stopped": true,
  "finalStatus": {
    "sessionId": "uuid",
    "isRunning": false,
    "currentStake": 1.40,
    "consecutiveLosses": 2,
    "accumulatedPL": -1.05,
    "stopReason": "manual",
    "error": null,
    "trades": [...],
    "uptime": 120000
  }
}
```

**Successful Indicators:**
- ✅ Status: 200 OK
- ✅ `stopped: true`
- ✅ `finalStatus.isRunning: false`
- ✅ `finalStatus.stopReason: "manual"`
- ✅ UI shows "Session Ended" view
- ✅ Polling STOPS (no more /status requests)

**Verify Polling Stopped:**
- Check Network tab: No more status requests after stop
- **Validates Requirement 17.4**

---

### Step 7: Verify Stop Conditions
**Requirements:** 7.1, 7.2, 7.3, 7.4

Start a new bot session and let it run until a stop condition triggers:

**Stop Reason: "max_losses"** (Requirement 7.1)
- Bot stops when `consecutiveLosses >= config.risk.maxConsecutiveLosses`
- Default: 5 consecutive losses

**Stop Reason: "take_profit"** (Requirement 7.2)
- Bot stops when `accumulatedPL >= config.risk.takeProfitAmount`
- Default: $5 profit

**Stop Reason: "stop_loss"** (Requirement 7.3)
- Bot stops when `accumulatedPL <= -config.risk.stopLossAmount`
- Default: -$10 loss

**Stop Reason: "max_stake"** (Requirement 7.4)
- Bot stops when next stake would exceed `config.stake.maxStake`
- Default: $10 max stake

**Verification:**
When any stop condition triggers:
1. ✅ `isRunning` becomes `false`
2. ✅ `stopReason` is set to appropriate value
3. ✅ No new trades placed
4. ✅ UI shows "Session Ended" with reason
5. ✅ Polling stops automatically

---

### Step 8: One-Bot-Per-User Enforcement
**Requirements:** 1.3, 16.2, 16.3, 16.5

1. Start a bot session (wait for "Bot Running" UI)
2. **Without stopping the first bot**, try to start another bot
3. Click "Start Bot" again

**Expected API Response:**
```
POST http://localhost:3000/api/bot/start

Response (400 Bad Request):
{
  "error": "User already has an active bot session",
  "status": "error"
}
```

**Successful Indicators:**
- ✅ Status: 400 Bad Request
- ✅ Error message: "User already has an active bot session"
- ✅ First bot continues running
- ✅ UI shows error message

**Validates:** One bot per user enforcement at SessionManager level

---

## 🔍 4. API Route Success vs Failure Indicators

### POST /api/bot/start

| Status | Indicator | Meaning |
|--------|-----------|---------|
| **200** | `{ sessionId, status: "started" }` | ✅ Bot started successfully |
| **400** | `error: "derivToken is required"` | ❌ Missing derivToken in request body |
| **400** | `error: "User already has an active bot session"` | ❌ User has existing active bot |
| **401** | `error: "Unauthorized"` | ❌ Missing authentication cookies |
| **500** | `error: "Bot server URL not configured"` | ❌ BOT_SERVER_URL env var missing |
| **500** | `error: "Failed to start bot session"` | ❌ Bot server returned error |

---

### GET /api/bot/status?sessionId=xxx

| Status | Indicator | Meaning |
|--------|-----------|---------|
| **200** | `{ sessionId, isRunning: true, ... }` | ✅ Bot running, status retrieved |
| **200** | `{ sessionId, isRunning: false, ... }` | ✅ Bot stopped, final status retrieved |
| **400** | `error: "sessionId query parameter is required"` | ❌ Missing sessionId in query |
| **401** | `error: "Unauthorized"` | ❌ Missing authentication cookies |
| **404** | `error: "Session not found"` | ❌ Session doesn't exist or expired |
| **500** | `error: "Bot server URL not configured"` | ❌ BOT_SERVER_URL env var missing |

---

### POST /api/bot/stop

| Status | Indicator | Meaning |
|--------|-----------|---------|
| **200** | `{ stopped: true, finalStatus: {...} }` | ✅ Bot stopped successfully |
| **400** | `error: "sessionId is required"` | ❌ Missing sessionId in request body |
| **401** | `error: "Unauthorized"` | ❌ Missing authentication cookies |
| **404** | `error: "Session not found"` | ❌ Session doesn't exist |
| **500** | `error: "Bot server URL not configured"` | ❌ BOT_SERVER_URL env var missing |

---

## 🚨 5. Remaining References Check

### ✅ No Build-Breaking References

**Searched for:** `auto-trade-store` imports and usage

**Results:**
- ✅ **SAFE:** Only found in comments in:
  - `lib/bot-client.ts` (comment: "This replaces the client-side auto-trade-store.ts logic...")
  - `components/autotrade/hooks/use-auto-trade.ts` (comment: "Replaces the client-side auto-trade-store.ts...")
- ✅ **No actual imports** - file successfully deleted and all references removed
- ✅ **Build will succeed** - no broken imports

---

## ✅ 6. Checklist Before Testing

### Environment Setup
- [ ] Created `bot-server/.env` from `.env.example`
- [ ] Verified `BOT_SERVER_URL=http://localhost:3001` in root `.env.local`
- [ ] Ran `npm install` in bot-server directory (if first time)

### Servers Running
- [ ] Bot server running on port 3001 (Terminal 1)
- [ ] Next.js running on port 3000 (Terminal 2)
- [ ] Verified bot server health check: `http://localhost:3001/health`

### Authentication
- [ ] Logged in to Deriv OAuth at `/login`
- [ ] Verified cookies exist: `deriv_auth_token` and `deriv_account_id`
- [ ] Navigated to `/dashboard` successfully

### Test Execution
- [ ] Started bot session → verified 200 OK response with sessionId
- [ ] Observed status polling every 2 seconds in Network tab
- [ ] Watched trades execute and UI update in real-time
- [ ] Closed browser → verified bot continues running on server
- [ ] Reopened browser → manually called status API to confirm bot still running
- [ ] Stopped bot → verified 200 OK response and polling stopped
- [ ] Tested one-bot-per-user → verified 400 error on second start attempt

---

## 📊 7. Success Criteria

All of these must pass for the end-to-end test to be successful:

✅ **Configuration Layer**
- Default strategy JSON loads correctly
- Config validation works (tested implicitly during session start)

✅ **Bot Server**
- Starts without errors on port 3001
- Health check returns `status: "ok"`
- All endpoints respond correctly

✅ **Next.js API Routes**
- /api/bot/start returns sessionId (Requirement 10.1, 10.2)
- /api/bot/status polls every 2 seconds (Requirement 17.2)
- /api/bot/stop returns final status (Requirement 10.4, 10.5)
- All routes verify authentication (Requirement 18.1, 18.2)

✅ **Client Integration**
- Bot client library works without errors (Requirement 17.1, 17.5)
- Status polling updates UI in real-time (Requirement 17.3)
- Polling stops when bot stops (Requirement 17.4)
- Component unmount cleanup works (Requirement 17.6)
- No references to deleted auto-trade-store

✅ **Bot Persistence**
- Bot continues running after browser close (Requirement 1.5)
- Session state maintained on server (Requirement 1.2)

✅ **Session Management**
- One bot per user enforced (Requirement 1.3, 16.2, 16.3)
- Stop conditions trigger correctly (Requirement 7.1-7.4)
- Sessions clean up properly (Requirement 15.1-15.4)

✅ **Trade Execution**
- Trades place automatically (Requirement 4.1-4.4)
- Stake progression follows martingale (Requirement 5.1-5.3)
- P/L accounting is accurate (Requirement 6.1-6.4)
- Inter-trade delay respected (Requirement 8.1-8.2)

---

## 🐛 Troubleshooting

### Bot Server Won't Start

**Symptom:** Error on `npm run dev`

**Possible Causes:**
1. Port 3001 already in use
   - **Fix:** Kill process on port 3001 or change PORT in `.env`
2. Missing dependencies
   - **Fix:** Run `npm install` in bot-server directory
3. TypeScript errors
   - **Fix:** Check console for specific errors

---

### Next.js Can't Connect to Bot Server

**Symptom:** 500 error "Bot server URL not configured"

**Possible Causes:**
1. `BOT_SERVER_URL` not set in `.env.local`
   - **Fix:** Add `BOT_SERVER_URL=http://localhost:3001`
2. Bot server not running
   - **Fix:** Start bot server in Terminal 1
3. Wrong URL in `BOT_SERVER_URL`
   - **Fix:** Verify it points to `http://localhost:3001`

---

### Authentication Failures

**Symptom:** 401 Unauthorized on all API calls

**Possible Causes:**
1. Cookies not set
   - **Fix:** Navigate to `/login` and authenticate
2. Cookies expired
   - **Fix:** Re-authenticate
3. Cookies blocked
   - **Fix:** Check browser cookie settings

---

### Polling Not Working

**Symptom:** UI doesn't update after bot starts

**Possible Causes:**
1. Status polling not starting
   - **Fix:** Check browser console for errors
2. Network errors
   - **Fix:** Check Network tab for failed requests
3. sessionId not saved
   - **Fix:** Verify start API returned sessionId

---

## 📝 Test Result Template

After completing the test, fill this out:

```
Date: ____________
Tester: ____________

Environment Setup:
[ ] Bot server .env created
[ ] Dependencies installed
[ ] BOT_SERVER_URL configured

Server Startup:
[ ] Bot server started on port 3001
[ ] Next.js started on port 3000
[ ] Health check passed

Authentication:
[ ] Logged in successfully
[ ] Cookies present

Bot Lifecycle:
[ ] Start bot → 200 OK with sessionId
[ ] Status polling → every 2 seconds
[ ] Trades executing → UI updates
[ ] Browser close → bot continues (verified via direct API call)
[ ] Stop bot → 200 OK, polling stops

Edge Cases:
[ ] One-bot-per-user → 400 error on second start
[ ] Stop condition triggered → session ended with reason

Overall Result: [ ] PASS [ ] FAIL

Notes:
_______________________________________
_______________________________________
```

---

## ✅ Next Steps After Successful Test

Once all tests pass:

1. **Report back** that end-to-end test passed
2. Proceed to **Task 15**: Checkpoint - Verify end-to-end flow (mark as complete)
3. Proceed to **Task 16**: Add deployment configuration
4. Proceed to **Task 17**: Final system verification

**DO NOT proceed to Task 16 until this test passes!**
