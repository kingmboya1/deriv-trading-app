/**
 * Bot Server - Main Entry Point
 * 
 * This is the standalone Express server that hosts the bot engine API endpoints
 * for managing automated trading bot sessions. The server:
 * 
 * - Uses SessionManager to track and manage active bot sessions
 * - Enforces one-bot-per-user rule
 * - Supports CORS for Next.js frontend
 * - Runs independently of Next.js/Vercel (deployed to Railway/Render)
 * 
 * Requirements: 10.3, 10.4
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { SessionManager } from "../lib/server/bot-engine/session-manager";
import sessionsRouter from "./routes/sessions";

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Express = express();

// Configuration
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || "100", 10);

/**
 * CORS Configuration
 * 
 * Allows requests from the Next.js frontend origin.
 * In production, CORS_ORIGIN should be set to the Vercel deployment URL.
 * 
 * Requirements: 10.4
 */
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

/**
 * Body Parser Middleware with Error Handling
 * 
 * Parses incoming JSON request bodies and handles malformed JSON.
 * Requirement 12.1, 14.1
 */
app.use(express.json());

/**
 * JSON Parsing Error Handler
 * 
 * Catches SyntaxError from malformed JSON in request bodies.
 * Returns 400 Bad Request for malformed JSON.
 * 
 * Requirements: 12.1, 14.1
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Malformed JSON in request body:`, err.message);
    
    return res.status(400).json({
      error: "Bad Request",
      message: "Malformed JSON in request body",
      timestamp,
    });
  }
  
  // Pass other errors to the next error handler
  next(err);
});

/**
 * Request Logging Middleware
 * 
 * Logs all incoming requests for debugging and monitoring.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health Check Endpoint
 * 
 * Used by Railway/Render for health monitoring and container orchestration.
 * Returns server status and active session count.
 */
app.get("/health", (req: Request, res: Response) => {
  const activeSessionCount = SessionManager.getActiveSessionCount();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    activeSessions: activeSessionCount,
    maxSessions: MAX_SESSIONS,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root Endpoint
 * 
 * Returns basic server information.
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "Bot Server",
    version: "1.0.0",
    description: "Server-side bot engine for automated trading",
    endpoints: {
      health: "GET /health",
      sessions: {
        start: "POST /sessions/start",
        stop: "POST /sessions/stop",
        status: "GET /sessions/status",
      },
    },
  });
});

/**
 * Sessions Routes
 * 
 * Mount the sessions router to handle /sessions/* endpoints
 */
app.use("/sessions", sessionsRouter);

/**
 * Error Handling Middleware
 * 
 * Catches all errors and returns a consistent error response format.
 * Handles WebSocket connection failures and other unexpected errors.
 * Logs errors without crashing the server.
 * 
 * Requirements: 12.1, 14.1, 14.2, 14.5
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Error:`, err);

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  
  // Check if this is a WebSocket connection failure
  // These typically come from DerivConnection errors during session start
  const isWebSocketError = err.message.toLowerCase().includes("websocket") ||
                          err.message.toLowerCase().includes("connection") ||
                          err.message.toLowerCase().includes("deriv");
  
  // Determine appropriate status code
  let statusCode = 500;
  let errorType = "Internal server error";
  
  if (isWebSocketError) {
    statusCode = 500;
    errorType = "Connection failure";
  }
  
  res.status(statusCode).json({
    error: errorType,
    message: isDevelopment ? err.message : "An unexpected error occurred",
    timestamp,
  });
});

/**
 * 404 Handler
 * 
 * Returns a 404 error for unknown routes.
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Start Server
 * 
 * Binds the Express app to the configured port and starts listening for requests.
 */
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                      Bot Server                            ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running                                           ║
║  Port: ${PORT.toString().padEnd(51)}║
║  CORS Origin: ${CORS_ORIGIN.padEnd(44)}║
║  Max Sessions: ${MAX_SESSIONS.toString().padEnd(43)}║
╚════════════════════════════════════════════════════════════╝
  `);
  
  console.log("Endpoints:");
  console.log("  - GET  /health");
  console.log("  - POST /sessions/start");
  console.log("  - POST /sessions/stop");
  console.log("  - GET  /sessions/status");
  console.log("");
});

/**
 * Graceful Shutdown Handler
 * 
 * Handles SIGTERM and SIGINT signals for graceful shutdown.
 * Ensures all sessions are properly cleaned up before exit.
 */
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  // TODO: In future, notify all active sessions before shutdown
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

// Export app for testing
export default app;
