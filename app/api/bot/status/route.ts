import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/bot/status
 * 
 * Retrieves the current status of a bot trading session. This endpoint acts as a proxy
 * between the client and the bot server, handling authentication and forwarding the request.
 * 
 * Authentication:
 * - Verifies user authentication via cookies
 * - Returns 401 if unauthorized
 * 
 * Flow:
 * 1. Verify user authentication
 * 2. Extract sessionId from query params
 * 3. Forward to Bot Server GET /sessions/status
 * 4. Return bot status or 404 to client
 * 
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 18.1, 18.2**
 */
export async function GET(req: NextRequest) {
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

    // Step 2: Extract sessionId from query params
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      );
    }

    // Step 3: Forward request to Bot Server
    const botServerUrl = process.env.BOT_SERVER_URL;
    
    if (!botServerUrl) {
      console.error("[bot/status] BOT_SERVER_URL environment variable not configured");
      return NextResponse.json(
        { error: "Bot server URL not configured" },
        { status: 500 }
      );
    }

    // Requirement 11.1, 11.2: Forward status request to bot server
    const response = await fetch(
      `${botServerUrl}/sessions/status?sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Step 4: Handle bot server response
    if (response.status === 404) {
      // Requirement 11.5: Return 404 if session not found
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: "Unknown error from bot server",
      }));

      return NextResponse.json(
        {
          error: errorData.message || errorData.error || "Failed to get bot status",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Requirement 11.3, 11.4: Return bot status including sessionId, running state,
    // current stake, consecutive losses, accumulated P/L, stop reason, error message,
    // trade history, and uptime
    return NextResponse.json(data);

  } catch (error) {
    console.error("[bot/status] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
