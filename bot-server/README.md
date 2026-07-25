# Bot Server

Standalone Express server for the server-side bot engine. This server manages automated trading bot sessions independently of the Next.js frontend.

## Features

- **Session Management**: Manages active bot sessions with one-bot-per-user enforcement
- **WebSocket Connections**: Maintains persistent connections to Deriv API
- **CORS Support**: Configured for Next.js frontend communication
- **Health Monitoring**: Health check endpoint for deployment platforms
- **Error Handling**: Graceful error handling without server crashes

## Requirements

- Node.js 18+ or higher
- TypeScript 5+
- Environment variables configured (see `.env.example`)

## Installation

```bash
cd bot-server
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=3001                           # Server port
CORS_ORIGIN=http://localhost:3000  # Next.js frontend URL
MAX_SESSIONS=100                    # Maximum concurrent sessions
```

## Development

Start the server in development mode with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:3001` (or your configured PORT).

## Production

Build and start the server:

```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

Returns server status and active session count.

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "activeSessions": 5,
  "maxSessions": 100,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Session Management

#### Start Session
```
POST /sessions/start
```

**Request Body:**
```json
{
  "userId": "user123",
  "derivToken": "your-deriv-api-token"
}
```

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "started"
}
```

#### Stop Session
```
POST /sessions/stop
```

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "manual"
}
```

**Response:**
```json
{
  "stopped": true,
  "finalStatus": { ... }
}
```

#### Get Status
```
GET /sessions/status?sessionId=<session-id>
```

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "isRunning": true,
  "currentStake": 0.35,
  "consecutiveLosses": 0,
  "accumulatedPL": 2.50,
  "stopReason": null,
  "error": null,
  "trades": [...]
}
```

## Deployment

### Railway

1. Create a new project on Railway
2. Connect your GitHub repository
3. Set environment variables in Railway dashboard
4. Railway will automatically detect and deploy the Express server

### Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `cd bot-server && npm install && npm run build`
4. Set start command: `cd bot-server && npm start`
5. Configure environment variables in Render dashboard

## Architecture

The bot server is separate from the Next.js deployment:

```
┌─────────────────┐
│  Next.js/Vercel │  (Frontend + API Routes)
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│   Bot Server    │  (Railway/Render)
│  (Express API)  │
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│   Deriv API     │
└─────────────────┘
```

## Monitoring

- Check `/health` endpoint for server status
- Monitor active session count
- Review server logs for errors and warnings

## Troubleshooting

### Server won't start

- Ensure PORT is not already in use
- Verify environment variables are set correctly
- Check that all dependencies are installed

### CORS errors

- Verify CORS_ORIGIN matches your Next.js frontend URL
- Check that the Next.js app is running on the expected port
- Ensure credentials are enabled in CORS configuration

### Session creation fails

- Verify Deriv API token is valid
- Check WebSocket connection to Deriv API
- Review server logs for detailed error messages

## License

MIT
