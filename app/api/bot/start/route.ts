import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/bot/start
 * 
 * Starts a new bot trading session. This endpoint acts as a proxy between the client
 * and the bot server, handling authentication and forwarding the request.
 * 
 * Authentication:
 * - Extracts userId (account_id) from deriv_account_id cookie
 * - Extracts derivToken from request body
 * - Returns 401 if unauthorized
 * 
 * Flow:
 * 1. Verify user authentication via cookies
 * 2. Extract derivToken from request body
 * 3. Forward userId and derivToken to Bot Server POST /sessions/start
 * 4. Return sessionId or error to client
 * 
 * **Validates: Requirements 10.1, 10.2, 18.1, 18.2, 18.3**
 */
export async function POST(req: NextRequest) {
  try {
    // Step 1: Verify authentication - extract userId from cookies
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

    // Step 2: Extract derivToken from request body
    const body = await req.json();
    const { derivToken } = body;

    if (!derivToken) {
      return NextResponse.json(
        { error: "derivToken is required in request body" },
        { status: 400 }
      );
    }

    // Step 3: Forward request to Bot Server
    const botServerUrl = process.env.BOT_SERVER_URL;
    
    if (!botServerUrl) {
      console.error("[bot/start] BOT_SERVER_URL environment variable not configured");
      return NextResponse.json(
        { error: "Bot server URL not configured" },
        { status: 500 }
      );
    }

    // Requirement 18.3: Forward userId from authenticated session to bot server
    const response = await fetch(`${botServerUrl}/sessions/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        derivToken,
      }),
    });

    // Step 4: Handle bot server response
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: "Unknown error from bot server",
      }));

      return NextResponse.json(
        {
          error: errorData.message || errorData.error || "Failed to start bot session",
          status: "error",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return sessionId to client (Requirement 10.1, 10.2)
    return NextResponse.json({
      sessionId: data.sessionId,
      status: "started",
    });

  } catch (error) {
    console.error("[bot/start] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        status: "error",
      },
      { status: 500 }
    );
  }
}
