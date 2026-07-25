# Bot API Routes

This directory contains Next.js API routes that act as proxies between the client and the bot server. These routes handle authentication and forward requests to the standalone bot server running on Railway/Render.

## Overview

The bot API consists of three main endpoints:

1. **POST /api/bot/start** - Start a new bot trading session
2. **POST /api/bot/stop** - Stop an active bot session
3. **GET /api/bot/status** - Get the current status of a bot session

## Authentication

All endpoints verify user authentication using cookies:
- `deriv_auth_token` - The Deriv OAuth access token
- `deriv_account_id` - The user's account ID (used as userId)

If either cookie is missing, the endpoints return `401 Unauthorized`.

## Endpoints

### POST /api/bot/start

Starts a new bot trading session.

**Request Body:**
```json
{
  "derivToken": "string"  // Deriv API token for WebSocket authentication
}
```

**Success Response (200):**
```json
{
  "sessionId": "uuid",
  "status": "started"
}
```

**Error Responses:**
- `401 Unauthorized` - Missing authentication cookies
- `400 Bad Request` - Missing derivToken in request body
- `500 Internal Server Error` - Bot server error or configuration issue

**Requirements:** 10.1, 10.2, 18.1, 18.2, 18.3

---

### POST /api/bot/stop

Stops an active bot trading session.

**Request Body:**
```json
{
  "sessionId": "string",
  "reason": "string"  // Optional: "manual" (default), "max_losses", "take_profit", etc.
}
```

**Success Response (200):**
```json
{
  "stopped": true,
  "finalStatus": {
    "sessionId": "string",
    "isRunning": false,
    "currentStake": 0.35,
    "consecutiveLosses": 0,
    "accumulatedPL": 2.50,
    "stopReason": "manual",
    "error": null,
    "trades": [],
    "uptime": 120000
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing authentication cookies
- `400 Bad Request` - Missing sessionId in request body
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Bot server error or configuration issue

**Requirements:** 10.4, 10.5, 18.1, 18.2, 18.5

---

### GET /api/bot/status

Retrieves the current status of a bot trading session.

**Query Parameters:**
- `sessionId` (required) - The bot session ID

**Success Response (200):**
```json
{
  "sessionId": "string",
  "isRunning": true,
  "currentStake": 0.70,
  "consecutiveLosses": 1,
  "accumulatedPL": -0.35,
  "stopReason": null,
  "error": null,
  "trades": [
    {
      "id": "string",
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

**Error Responses:**
- `401 Unauthorized` - Missing authentication cookies
- `400 Bad Request` - Missing sessionId query parameter
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Bot server error or configuration issue

**Requirements:** 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 18.1, 18.2

---

## Environment Configuration

### Required Environment Variable

The API routes require the `BOT_SERVER_URL` environment variable to be configured:

**Local Development:**
```env
BOT_SERVER_URL=http://localhost:3001
```

**Production (Vercel):**
Set the environment variable in Vercel to point to your deployed bot server:
- Railway: `https://your-bot-server.railway.app`
- Render: `https://your-bot-server.onrender.com`

### Setting up in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add `BOT_SERVER_URL` with the URL of your deployed bot server
4. Redeploy your application

## Bot Server Setup

The bot server must be deployed separately from the Next.js application. See `bot-server/README.md` for deployment instructions.

**Bot Server Requirements:**
- Must be deployed on Railway, Render, or similar platform
- Must be publicly accessible (for Vercel to connect)
- Must have CORS configured to allow requests from your Next.js origin
- Must implement the following endpoints:
  - `POST /sessions/start`
  - `POST /sessions/stop`
  - `GET /sessions/status`

## Testing

To test the API routes locally:

1. Start the bot server:
   ```bash
   cd bot-server
   npm run dev
   ```

2. Start the Next.js development server:
   ```bash
   npm run dev
   ```

3. Authenticate via Deriv OAuth (visit `/login`)

4. Use the AutoTradePanel UI or make direct API calls:
   ```bash
   # Start a bot session
   curl -X POST http://localhost:3000/api/bot/start \
     -H "Content-Type: application/json" \
     -b "deriv_auth_token=YOUR_TOKEN;deriv_account_id=YOUR_ACCOUNT" \
     -d '{"derivToken":"YOUR_DERIV_TOKEN"}'

   # Check status
   curl -X GET "http://localhost:3000/api/bot/status?sessionId=SESSION_ID" \
     -b "deriv_auth_token=YOUR_TOKEN;deriv_account_id=YOUR_ACCOUNT"

   # Stop bot
   curl -X POST http://localhost:3000/api/bot/stop \
     -H "Content-Type: application/json" \
     -b "deriv_auth_token=YOUR_TOKEN;deriv_account_id=YOUR_ACCOUNT" \
     -d '{"sessionId":"SESSION_ID"}'
   ```

## Error Handling

All endpoints include comprehensive error handling:

- **Network Errors**: If the bot server is unreachable, returns 500 with error details
- **Validation Errors**: Missing parameters return 400 with descriptive messages
- **Authentication Errors**: Missing cookies return 401
- **Bot Server Errors**: Forwards bot server error messages with appropriate status codes

## Security Considerations

- Authentication is handled via httpOnly cookies (secure in production)
- The `userId` (account_id) is extracted server-side from cookies, not from client input
- The bot server trusts the `userId` provided by Next.js API routes
- All requests to bot server are server-to-server (not exposed to client)
- The default strategy JSON is never exposed to the client

## Related Files

- Client wrapper: `lib/bot-client.ts` (Task 12.1)
- Bot server routes: `bot-server/routes/sessions.ts` (Task 9)
- UI component: `components/autotrade/AutoTradePanel.tsx` (Task 13)
