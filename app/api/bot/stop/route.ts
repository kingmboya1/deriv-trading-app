import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/bot/stop
 * 
 * Stops an active bot trading session. This endpoint acts as a proxy between the client
 * and the bot server, handling authentication and forwarding the stop request.
 * 
 * Authentication:
 * - Verifies user authentication via cookies
 * - Returns 401 if unauthorized
 * 
 * Flow:
 * 1. Verify user authentication
 * 2. Extract sessionId from request body
 * 3. Forward to Bot Server POST /sessions/stop
 * 4. Return final status to client
 * 
 * **Validates: Requirements 10.4, 10.5, 18.1, 18.2, 18.5**
 */
export async function POST(req: NextRequest) {
  try {
    // Step 1: Verify authentication
    const cookieStore = cookies();
    const authToken = cookieStore.get("deriv_auth_token")?.value;
    const userId = cookieStore.get("deriv_account_id")?.value;

    // Requirement 18.1, 18.2: Verify authentication and return 401 if invalid
    if (!authToken || !userId) {
      return NextResponse.json(
        { error: "Unauthorized - missing authentication cookies" },
        { status: 401 }
      );
    }

    // Step 2: Extract sessionId from request body
    const body = await req.json();
    const { sessionId, reason } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required in request body" },
        { status: 400 }
      );
    }

    // Step 3: Forward request to Bot Server
    const botServerUrl = process.env.BOT_SERVER_URL;
    
    if (!botServerUrl) {
      console.error("[bot/stop] BOT_SERVER_URL environment variable not configured");
      return NextResponse.json(
        { error: "Bot server URL not configured" },
        { status: 500 }
      );
    }

    // Requirement 10.4, 18.5: Forward stop request with sessionId
    const response = await fetch(`${botServerUrl}/sessions/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        reason: reason || "manual",
      }),
    });

    // Step 4: Handle bot server response
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: "Unknown error from bot server",
      }));

      return NextResponse.json(
        {
          error: errorData.message || errorData.error || "Failed to stop bot session",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Requirement 10.5: Return final status to client
    return NextResponse.json({
      stopped: true,
      finalStatus: data.finalStatus || data,
    });

  } catch (error) {
    console.error("[bot/stop] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
