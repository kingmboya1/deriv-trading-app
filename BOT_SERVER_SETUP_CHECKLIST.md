# Bot Server Setup Checklist

Use this checklist to verify your bot server environment configuration is complete.

## Quick Reference

### Environment Variable: BOT_SERVER_URL

**Purpose**: Connects Next.js API routes to the standalone bot server

**Location**:
- **Local Development**: `.env.local` (in project root)
- **Production**: Vercel environment variables

**Values**:
- **Local**: `http://localhost:3001`
- **Railway**: `https://your-bot-server.railway.app`
- **Render**: `https://your-bot-server.onrender.com`

---

## Local Development Checklist

- [x] `.env.local` exists in project root
- [x] `BOT_SERVER_URL=http://localhost:3001` is set in `.env.local`
- [x] `BOT_SERVER_URL` includes helpful comments about production deployment
- [ ] Bot server starts successfully: `cd bot-server && npm run dev`
- [ ] Bot server responds to health check: `http://localhost:3001/health`
- [ ] Next.js starts successfully: `npm run dev`
- [ ] Next.js can connect to bot server (no console errors about bot server URL)

---

## Production Deployment Checklist

### Part 1: Bot Server (Railway or Render)

- [ ] Bot server deployed to Railway or Render
- [ ] Bot server environment variables configured:
  - [ ] `PORT=3001`
  - [ ] `CORS_ORIGIN` set to Vercel URL
  - [ ] `MAX_SESSIONS=100`
- [ ] Bot server is publicly accessible
- [ ] Health check endpoint works: `https://your-bot-server.railway.app/health`
- [ ] Bot server URL copied for use in Vercel

### Part 2: Next.js (Vercel)

- [ ] Project deployed to Vercel
- [ ] All environment variables configured in Vercel:
  - [ ] `NEXT_PUBLIC_DERIV_APP_ID`
  - [ ] `NEXT_PUBLIC_DERIV_REST_URL`
  - [ ] `NEXT_PUBLIC_OAUTH_REDIRECT_URI` (with Vercel URL)
  - [ ] `NEXT_PUBLIC_APP_URL` (Vercel URL)
  - [ ] **`BOT_SERVER_URL`** (Railway/Render URL from Part 1)
- [ ] Application redeployed after setting environment variables
- [ ] Deriv OAuth redirect URI updated in Deriv app settings

### Part 3: Cross-Service Configuration

- [ ] Bot server `CORS_ORIGIN` matches Vercel URL exactly (no trailing slash)
- [ ] Vercel `BOT_SERVER_URL` matches bot server URL exactly (no trailing slash)
- [ ] Test bot server health from Vercel URL
- [ ] Test full flow: login → start bot → verify session

---

## Verification Tests

### Test 1: Environment Variable Exists

**In Vercel Dashboard**:
1. Go to Settings → Environment Variables
2. Confirm `BOT_SERVER_URL` is listed
3. Verify it points to your bot server deployment

**Expected**: Variable exists with correct bot server URL

### Test 2: Bot Server Health Check

```bash
curl https://your-bot-server.railway.app/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "activeSessions": 0,
  "maxSessions": 100,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Test 3: API Route Connection

Visit your Next.js app and check browser console for errors:

**No errors like**:
- ❌ "Bot server URL not configured"
- ❌ "Failed to connect to bot server"
- ❌ CORS errors

**Expected**:
- ✅ No bot-server-related errors in console
- ✅ API routes can connect to bot server

### Test 4: Full Bot Flow

1. Login via Deriv OAuth
2. Navigate to dashboard
3. Click "Start Bot"
4. Verify session starts (no errors)
5. Check status updates every 2 seconds
6. Click "Stop Bot"
7. Verify session stops cleanly

**Expected**: All steps complete without errors

---

## Troubleshooting

### Issue: "Bot server URL not configured" error

**Cause**: `BOT_SERVER_URL` environment variable is missing or not loaded

**Solutions**:
1. Verify variable exists in Vercel environment variables
2. Redeploy application after adding the variable
3. Check variable name is exactly `BOT_SERVER_URL` (case-sensitive)
4. Ensure no typos in the variable value

### Issue: CORS errors when calling bot server

**Cause**: Bot server CORS origin doesn't match Next.js URL

**Solutions**:
1. Check bot server `CORS_ORIGIN` environment variable
2. Ensure it matches your Vercel URL exactly
3. Remove trailing slashes from both URLs
4. Redeploy bot server after changing CORS_ORIGIN

### Issue: Bot server unreachable

**Cause**: Bot server is not running or URL is incorrect

**Solutions**:
1. Check bot server deployment status in Railway/Render
2. Test health endpoint directly: `curl https://your-bot-server.railway.app/health`
3. Verify bot server URL in Vercel matches actual deployment URL
4. Check bot server logs for startup errors

---

## Documentation References

- **Full Deployment Guide**: See `DEPLOYMENT.md`
- **Environment Variables Example**: See `.env.example`
- **Bot Server Documentation**: See `bot-server/README.md`
- **API Routes Documentation**: See `app/api/bot/README.md`
- **Main README**: See `README.md`

---

## Summary

✅ **Current Status** (as of Task 11.4):

- [x] `BOT_SERVER_URL` configured in `.env.local` for local development
- [x] `.env.local` includes comprehensive comments about production deployment
- [x] `bot-server/README.md` documents Railway and Render deployment
- [x] `app/api/bot/README.md` documents BOT_SERVER_URL configuration for Vercel
- [x] Main `README.md` updated with full deployment instructions
- [x] `DEPLOYMENT.md` created with step-by-step deployment guide
- [x] `.env.example` created as template for configuration
- [x] All API routes (`start`, `stop`, `status`) use `process.env.BOT_SERVER_URL`
- [x] All API routes have error handling for missing BOT_SERVER_URL

**Requirements Validated**: 10.3, 10.4

**What you need to do for production**:
1. Deploy bot server to Railway or Render
2. Copy bot server URL
3. Add `BOT_SERVER_URL` to Vercel environment variables with bot server URL
4. Redeploy Next.js application

---

**Last Updated**: Task 11.4 - Add BOT_SERVER_URL environment variable
