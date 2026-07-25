# Deriv Trading Platform

A full-stack trading platform with automated bot engine, built with Next.js and a standalone Express bot server.

## Architecture

This project consists of two separate deployments:

1. **Next.js Frontend + API Routes** (Vercel) - User interface and authentication proxy
2. **Bot Server** (Railway/Render) - Standalone Express server managing automated trading sessions

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

## Getting Started

### Prerequisites

- Node.js 18+ or higher
- Deriv API account and app credentials
- Environment variables configured

### Local Development

1. **Configure environment variables**

   Copy `.env.local` and update with your Deriv app credentials:

   ```env
   NEXT_PUBLIC_DERIV_APP_ID=your_app_id
   NEXT_PUBLIC_DERIV_REST_URL=https://api.derivws.com
   NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   BOT_SERVER_URL=http://localhost:3001
   ```

2. **Start the bot server**

   ```bash
   cd bot-server
   npm install
   npm run dev
   ```

   The bot server will start on `http://localhost:3001`.

3. **Start the Next.js development server**

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser.

4. **Authenticate via Deriv OAuth**

   Visit `/login` to authenticate with your Deriv account.

## Deployment

This application requires two separate deployments:

### 1. Deploy Bot Server (Railway or Render)

The bot server must be deployed first to obtain its URL.

#### Option A: Railway

1. Create a new project on [Railway](https://railway.app/)
2. Connect your GitHub repository
3. Configure environment variables in Railway dashboard:
   ```env
   PORT=3001
   CORS_ORIGIN=https://your-app.vercel.app
   MAX_SESSIONS=100
   ```
4. Railway will auto-detect the Express server and deploy
5. Copy the Railway deployment URL (e.g., `https://your-bot-server.railway.app`)

#### Option B: Render

1. Create a new Web Service on [Render](https://render.com/)
2. Connect your GitHub repository
3. Configure build and start commands:
   - **Build Command**: `cd bot-server && npm install && npm run build`
   - **Start Command**: `cd bot-server && npm start`
4. Set environment variables in Render dashboard:
   ```env
   PORT=3001
   CORS_ORIGIN=https://your-app.vercel.app
   MAX_SESSIONS=100
   ```
5. Copy the Render deployment URL (e.g., `https://your-bot-server.onrender.com`)

**See `bot-server/README.md` for detailed deployment instructions.**

### 2. Deploy Next.js Frontend (Vercel)

1. Push your code to GitHub
2. Import the project into [Vercel](https://vercel.com/)
3. Configure environment variables in Vercel dashboard:
   ```env
   NEXT_PUBLIC_DERIV_APP_ID=your_app_id
   NEXT_PUBLIC_DERIV_REST_URL=https://api.derivws.com
   NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   BOT_SERVER_URL=https://your-bot-server.railway.app  # or .onrender.com
   ```
4. Deploy the application

**Important**: The `BOT_SERVER_URL` must point to your deployed bot server from step 1.

## Environment Configuration

### Next.js Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_DERIV_APP_ID` | Your Deriv OAuth app ID | `33FxvPGva7ZUPKIo23ilc` |
| `NEXT_PUBLIC_DERIV_REST_URL` | Deriv REST API URL | `https://api.derivws.com` |
| `NEXT_PUBLIC_OAUTH_REDIRECT_URI` | OAuth callback URL | `https://your-app.vercel.app/api/auth/callback` |
| `NEXT_PUBLIC_APP_URL` | Your Next.js app URL | `https://your-app.vercel.app` |
| `BOT_SERVER_URL` | Bot server deployment URL | `https://your-bot-server.railway.app` |

### Bot Server Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Next.js app URL for CORS | `https://your-app.vercel.app` |
| `MAX_SESSIONS` | Maximum concurrent bot sessions | `100` |

## Features

- **Deriv OAuth Integration** - Secure authentication with Deriv accounts
- **Server-Side Bot Engine** - Automated trading that runs independently of browser
- **Real-Time Status Updates** - Live monitoring of bot trades and P/L
- **One Bot Per User** - Enforced session management
- **Persistent WebSocket Connections** - Bot continues running after browser close
- **Martingale Strategy** - Configurable stake progression and risk limits
- **Stop Conditions** - Take profit, stop loss, max losses, max stake enforcement

## API Documentation

- Bot API Routes: See `app/api/bot/README.md`
- Bot Server Endpoints: See `bot-server/README.md`

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes (auth, bot proxy)
│   ├── dashboard/         # Dashboard page
│   └── login/            # Login page
├── bot-server/            # Standalone bot server (separate deployment)
│   ├── index.ts          # Express server entry point
│   ├── routes/           # Bot API endpoints
│   └── README.md         # Bot server documentation
├── components/            # React components
│   ├── autotrade/        # Bot UI components
│   ├── dashboard/        # Dashboard layout
│   └── landing/          # Landing page
├── lib/                   # Shared libraries
│   ├── server/           # Server-side bot engine logic
│   │   └── bot-engine/  # Bot engine, session manager, connection manager
│   ├── bot-client.ts     # Client HTTP wrapper for bot API
│   └── derivsocket.ts    # Deriv WebSocket utilities
└── .env.local            # Environment configuration
```

## Troubleshooting

### Bot Server Connection Issues

- Verify `BOT_SERVER_URL` is set correctly in Vercel environment variables
- Check bot server is running and accessible (visit `/health` endpoint)
- Ensure CORS is configured properly in bot server

### Authentication Errors

- Verify Deriv OAuth credentials are correct
- Check redirect URI matches in Deriv app settings
- Ensure cookies are enabled in browser

### Bot Session Issues

- Only one bot per user is allowed - stop existing session first
- Check Deriv API token is valid and not expired
- Review bot server logs for detailed error messages

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Deriv API Documentation](https://api.deriv.com/)
- [Express.js Guide](https://expressjs.com/)

## License

MIT
