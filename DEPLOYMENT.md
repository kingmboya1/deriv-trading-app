# Deployment Guide

This guide walks you through deploying the Deriv Trading Platform with the server-side bot engine.

## Overview

The application requires two separate deployments:
1. **Bot Server** - Express server on Railway or Render
2. **Next.js Frontend** - Frontend and API routes on Vercel

**Important**: Deploy the bot server first to obtain its URL, which is needed for the Next.js deployment.

---

## Part 1: Deploy Bot Server

Choose either Railway or Render for hosting the bot server.

### Option A: Deploy to Railway

#### Prerequisites
- GitHub account
- Railway account (sign up at [railway.app](https://railway.app/))

#### Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare bot server for deployment"
   git push origin main
   ```

2. **Create a new Railway project**
   - Go to [railway.app](https://railway.app/)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your repository
   - Select your repository

3. **Configure the service**
   - Railway will auto-detect the Express application
   - If not detected, add a `railway.json` in the bot-server directory:
     ```json
     {
       "build": {
         "builder": "NIXPACKS",
         "buildCommand": "cd bot-server && npm install && npm run build"
       },
       "deploy": {
         "startCommand": "cd bot-server && npm start",
         "restartPolicyType": "ON_FAILURE",
         "restartPolicyMaxRetries": 10
       }
     }
     ```

4. **Set environment variables**
   - In the Railway dashboard, go to your service
   - Navigate to the "Variables" tab
   - Add the following variables:
     ```
     PORT=3001
     CORS_ORIGIN=https://your-app.vercel.app
     MAX_SESSIONS=100
     ```
   - Note: You'll update `CORS_ORIGIN` after deploying to Vercel

5. **Deploy and get URL**
   - Railway will automatically deploy your application
   - Once deployed, go to "Settings" → "Networking"
   - Click "Generate Domain" to get a public URL
   - Copy your Railway URL (e.g., `https://your-bot-server.railway.app`)

6. **Verify deployment**
   - Visit `https://your-bot-server.railway.app/health`
   - You should see:
     ```json
     {
       "status": "ok",
       "uptime": 123.45,
       "activeSessions": 0,
       "maxSessions": 100,
       "timestamp": "2024-01-01T12:00:00.000Z"
     }
     ```

### Option B: Deploy to Render

#### Prerequisites
- GitHub account
- Render account (sign up at [render.com](https://render.com/))

#### Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare bot server for deployment"
   git push origin main
   ```

2. **Create a new Web Service**
   - Go to [render.com](https://render.com/)
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure the service**
   - **Name**: `deriv-bot-server` (or your preferred name)
   - **Root Directory**: Leave empty (Render will find the bot-server directory via commands)
   - **Environment**: `Node`
   - **Build Command**: 
     ```bash
     cd bot-server && npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     cd bot-server && npm start
     ```
   - **Plan**: Select "Free" or your preferred plan

4. **Set environment variables**
   - Scroll down to "Environment Variables"
   - Add the following variables:
     ```
     PORT=3001
     CORS_ORIGIN=https://your-app.vercel.app
     MAX_SESSIONS=100
     ```
   - Note: You'll update `CORS_ORIGIN` after deploying to Vercel

5. **Deploy and get URL**
   - Click "Create Web Service"
   - Render will build and deploy your application
   - Once deployed, copy your Render URL from the dashboard
   - URL format: `https://your-bot-server.onrender.com`

6. **Verify deployment**
   - Visit `https://your-bot-server.onrender.com/health`
   - You should see the health check response

---

## Part 2: Deploy Next.js Frontend to Vercel

#### Prerequisites
- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com/))
- Bot server URL from Part 1

#### Steps

1. **Prepare environment variables**
   
   You'll need:
   - Your Deriv OAuth app credentials (get from [api.deriv.com](https://api.deriv.com/))
   - Bot server URL from Part 1

2. **Import project to Vercel**
   - Go to [vercel.com](https://vercel.com/)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect the Next.js configuration

3. **Configure environment variables**
   
   In the Vercel project settings, add these environment variables:

   | Variable | Value | Example |
   |----------|-------|---------|
   | `NEXT_PUBLIC_DERIV_APP_ID` | Your Deriv app ID | `33FxvPGva7ZUPKIo23ilc` |
   | `NEXT_PUBLIC_DERIV_REST_URL` | Deriv API URL | `https://api.derivws.com` |
   | `NEXT_PUBLIC_OAUTH_REDIRECT_URI` | Your Vercel URL + callback path | `https://your-app.vercel.app/api/auth/callback` |
   | `NEXT_PUBLIC_APP_URL` | Your Vercel URL | `https://your-app.vercel.app` |
   | `BOT_SERVER_URL` | **Bot server URL from Part 1** | `https://your-bot-server.railway.app` |

   **Important Notes**:
   - The `NEXT_PUBLIC_*` variables are exposed to the browser
   - `BOT_SERVER_URL` is server-side only (not exposed to browser)
   - Use your actual Vercel deployment URL (you'll get this after first deploy)

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application
   - Copy your Vercel deployment URL

5. **Update environment variables**
   
   After getting your Vercel URL, update these variables:
   
   **In Vercel**:
   - Update `NEXT_PUBLIC_OAUTH_REDIRECT_URI` with your actual Vercel URL
   - Update `NEXT_PUBLIC_APP_URL` with your actual Vercel URL
   - Redeploy to apply changes

   **In Railway/Render (Bot Server)**:
   - Update `CORS_ORIGIN` to your actual Vercel URL
   - Redeploy the bot server

6. **Configure Deriv OAuth**
   - Go to [api.deriv.com](https://api.deriv.com/)
   - Navigate to your app settings
   - Add your Vercel callback URL to authorized redirect URIs:
     ```
     https://your-app.vercel.app/api/auth/callback
     ```

7. **Verify deployment**
   - Visit your Vercel URL
   - Click "Login" to test Deriv OAuth
   - After login, test the bot functionality

---

## Environment Variables Reference

### Next.js (.env.local for local, Vercel for production)

```env
# Deriv OAuth Configuration
NEXT_PUBLIC_DERIV_APP_ID=your_deriv_app_id
NEXT_PUBLIC_DERIV_REST_URL=https://api.derivws.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Bot Server Connection (server-side only, not exposed to browser)
BOT_SERVER_URL=https://your-bot-server.railway.app
```

### Bot Server (.env for local, Railway/Render for production)

```env
# Server Configuration
PORT=3001

# CORS Configuration (must match Next.js deployment URL)
CORS_ORIGIN=https://your-app.vercel.app

# Session Limits
MAX_SESSIONS=100
```

---

## Troubleshooting

### Bot Server Won't Start

**Issue**: Server crashes or won't start

**Solutions**:
- Check Railway/Render logs for error messages
- Verify all environment variables are set
- Ensure `PORT` is set to `3001` (or the port your platform expects)
- Check build logs for dependency installation errors

### CORS Errors

**Issue**: Next.js API routes can't connect to bot server

**Solutions**:
- Verify `CORS_ORIGIN` in bot server matches your Vercel URL exactly
- Ensure no trailing slash in URLs
- Check bot server logs for CORS-related errors
- Verify bot server is publicly accessible

### Bot Server Connection Failed

**Issue**: API routes return "Bot server URL not configured"

**Solutions**:
- Verify `BOT_SERVER_URL` is set in Vercel environment variables
- Ensure bot server is deployed and accessible
- Test bot server health endpoint: `https://your-bot-server.railway.app/health`
- Redeploy Next.js after adding/changing environment variables

### OAuth Redirect Issues

**Issue**: OAuth callback fails or redirects to wrong URL

**Solutions**:
- Verify `NEXT_PUBLIC_OAUTH_REDIRECT_URI` matches your Vercel URL
- Check Deriv app settings include the correct redirect URI
- Ensure redirect URI in Deriv settings exactly matches environment variable
- No trailing slashes in URLs

### Session Creation Fails

**Issue**: Bot sessions fail to start

**Solutions**:
- Check Deriv API token is valid and not expired
- Verify bot server can connect to Deriv WebSocket API
- Check bot server logs for detailed error messages
- Ensure user doesn't already have an active session

---

## Local Development Setup

For local testing before deployment:

### 1. Configure Local Environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_DERIV_APP_ID=your_deriv_app_id
NEXT_PUBLIC_DERIV_REST_URL=https://api.derivws.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
BOT_SERVER_URL=http://localhost:3001
```

Create `.env` in `bot-server/`:

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
MAX_SESSIONS=100
```

### 2. Start Bot Server

```bash
cd bot-server
npm install
npm run dev
```

### 3. Start Next.js

```bash
npm install
npm run dev
```

### 4. Test Locally

- Visit `http://localhost:3000`
- Login via Deriv OAuth
- Test bot functionality in dashboard

---

## Health Checks and Monitoring

### Bot Server Health Check

The bot server provides a `/health` endpoint for monitoring:

```bash
curl https://your-bot-server.railway.app/health
```

Response:
```json
{
  "status": "ok",
  "uptime": 123456.78,
  "activeSessions": 5,
  "maxSessions": 100,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Railway Monitoring

- Railway provides automatic health checks
- View logs in Railway dashboard under "Deployments"
- Set up alerts for deployment failures

### Render Monitoring

- Render provides automatic health checks
- View logs in Render dashboard under "Logs"
- Configure health check path: `/health`

---

## Scaling Considerations

### Bot Server Resources

The bot server memory requirements:
- ~500KB per active session
- 100 concurrent sessions = ~50MB + overhead
- Recommended: 512MB RAM minimum

### Rate Limits

- Deriv API rate limits apply per connection
- One WebSocket connection per bot session
- Inter-trade delay: minimum 2000ms (2 seconds)

### Session Limits

Configure `MAX_SESSIONS` based on your server resources:
- Free tier (Railway/Render): 50-100 sessions
- Paid tier: Scale based on available memory

---

## Security Checklist

- [ ] `BOT_SERVER_URL` is set and not exposed to browser
- [ ] CORS is configured to only allow requests from your Next.js domain
- [ ] Deriv OAuth redirect URI is whitelisted in app settings
- [ ] Environment variables are set as "secrets" in deployment platforms
- [ ] HTTPS is enabled on all deployments (automatic on Vercel/Railway/Render)
- [ ] API tokens are never logged or exposed in responses

---

## Support and Documentation

- **Bot Server API**: See `bot-server/README.md`
- **Next.js API Routes**: See `app/api/bot/README.md`
- **Main Documentation**: See `README.md`

For issues:
1. Check deployment platform logs
2. Test `/health` endpoint
3. Verify environment variables
4. Review error messages in browser console and server logs
