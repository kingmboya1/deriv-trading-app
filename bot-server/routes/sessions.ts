/**
 * Sessions Routes - Bot session management endpoints
 * 
 * This file contains the route handlers for starting, stopping, and querying
 * bot sessions. It implements the one-bot-per-user rule and manages session
 * lifecycle using SessionManager.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.6
 */

import { Router, Request, Response } from "express";
import { SessionManager } from "../../lib/server/bot-engine/session-manager";
import { BotEngine } from "../../lib/server/bot-engine/bot-engine";
import { StrategyConfig, StopReason } from "../../lib/server/bot-engine/types";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

/**
 * POST /sessions/start
 * 
 * Starts a new bot session for a user.
 * 
 * Request Body:
 * - userId: string - The user's unique identifier
 * - derivToken: string - The user's Deriv API token
 * 
 * Response:
 * - 200: { sessionId: string, status: "started" }
 * - 400: { error: string } - User already has active session
 * - 500: { error: string } - Server error (connection failure, etc.)
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.6
 */
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { userId, derivToken } = req.body;

    // Validate request body
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        error: "Missing or invalid userId",
        status: "error",
      });
    }

    if (!derivToken || typeof derivToken !== "string") {
      return res.status(400).json({
        error: "Missing or invalid derivToken",
        status: "error",
      });
    }

    // Check if user already has an active session (Req 1.3, 16.2)
    if (SessionManager.hasActiveSession(userId)) {
      return res.status(400).json({
        error: "User already has an active bot session",
        status: "error",
      });
    }

    // Load default strategy configuration (Req 23.1)
    const strategyPath = join(__dirname, "../../lib/server/bot-engine/default-strategy.json");
    const strategyJson = readFileSync(strategyPath, "utf-8");
    const config: StrategyConfig = JSON.parse(strategyJson);

    // Create BotEngine instance (Req 10.6)
    const engine = new BotEngine(userId, config, derivToken);

    // Create session in SessionManager (Req 1.1, 1.2)
    const sessionId = SessionManager.createSession(userId, engine);

    // Start the session: connect to Deriv and place first trade (Req 2.1, 4.1)
    try {
      await engine.startSession();
    } catch (error) {
      // If startSession fails, clean up the session
      SessionManager.deleteSession(sessionId);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to start session";
      console.error(`[Sessions] Failed to start session for user ${userId}:`, errorMessage);
      
      return res.status(500).json({
        error: errorMessage,
        status: "error",
      });
    }

    // Return success response with sessionId
    console.log(`[Sessions] Started session ${sessionId} for user ${userId}`);
    
    return res.status(200).json({
      sessionId,
      status: "started",
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[Sessions] Error in /start:", errorMessage);
    
    return res.status(500).json({
      error: errorMessage,
      status: "error",
    });
  }
});

/**
 * POST /sessions/stop
 * 
 * Stops an active bot session.
 * 
 * Request Body:
 * - sessionId: string - The session identifier to stop
 * - reason: string (optional) - The stop reason (default: "manual")
 * 
 * Response:
 * - 200: { stopped: true, finalStatus: BotStatus }
 * - 400: { error: string } - Missing or invalid sessionId
 * - 404: { error: string } - Session not found
 * - 500: { error: string } - Server error
 * 
 * Requirements: 10.4, 10.5, 15.5, 15.6
 */
router.post("/stop", async (req: Request, res: Response) => {
  try {
    const { sessionId, reason } = req.body;

    // Validate request body
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        error: "Missing or invalid sessionId",
        status: "error",
      });
    }

    // Retrieve session from SessionManager
    const engine = SessionManager.getSession(sessionId);

    if (!engine) {
      return res.status(404).json({
        error: "Session not found",
        status: "error",
      });
    }

    // Stop the session (idempotent - safe to call on already-stopped sessions)
    const stopReason = reason || "manual";
    engine.stopSession(stopReason);

    // Build final status response
    const state = engine.getState();
    const finalStatus = {
      sessionId: sessionId,
      isRunning: state.isRunning,
      currentStake: state.currentStake,
      consecutiveLosses: state.consecutiveLosses,
      accumulatedPL: state.accumulatedPL,
      stopReason: state.stopReason,
      error: state.error,
      trades: state.trades,
    };

    // Clean up session from SessionManager
    SessionManager.deleteSession(sessionId);

    console.log(`[Sessions] Stopped session ${sessionId} with reason: ${stopReason}`);

    // Return success response
    return res.status(200).json({
      stopped: true,
      finalStatus,
      status: "stopped",
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[Sessions] Error in /stop:", errorMessage);
    
    return res.status(500).json({
      error: errorMessage,
      status: "error",
    });
  }
});

/**
 * GET /sessions/status
 * 
 * Retrieves the current status of a bot session.
 * 
 * Query Parameters:
 * - sessionId: string - The session identifier
 * 
 * Response:
 * - 200: BotStatus object with session details
 * - 400: { error: string } - Missing or invalid sessionId
 * - 404: { error: string } - Session not found
 * - 500: { error: string } - Server error
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;

    // Validate query parameter (Req 11.1, 11.2)
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        error: "Missing or invalid sessionId",
        status: "error",
      });
    }

    // Retrieve session from SessionManager (Req 11.2)
    const engine = SessionManager.getSession(sessionId);

    if (!engine) {
      // Return 404 if session not found (Req 11.5)
      return res.status(404).json({
        error: "Session not found",
        status: "error",
      });
    }

    // Get current bot state (Req 11.3)
    const state = engine.getState();
    const config = engine.getConfig();

    // Calculate uptime in milliseconds (Req 11.4)
    // Uptime is time elapsed since session start
    // We can infer start time from the first trade timestamp or use current time - first trade time
    // Since we don't have startTime in state, we'll calculate from first trade or use 0
    let uptime = 0;
    if (state.trades.length > 0) {
      const firstTradeTime = state.trades[0].timestamp;
      uptime = Date.now() - firstTradeTime;
    }

    // Build BotStatus response (Req 11.3, 11.4, 11.5, 11.6)
    const botStatus = {
      sessionId: sessionId,
      isRunning: state.isRunning,
      currentStake: state.currentStake,
      consecutiveLosses: state.consecutiveLosses,
      accumulatedPL: state.accumulatedPL,
      stopReason: state.stopReason,
      error: state.error,
      trades: state.trades,
      uptime: uptime,
    };

    console.log(`[Sessions] Status retrieved for session ${sessionId}`);

    // Return success response (Req 11.3)
    return res.status(200).json(botStatus);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[Sessions] Error in /status:", errorMessage);
    
    return res.status(500).json({
      error: errorMessage,
      status: "error",
    });
  }
});

export default router;
