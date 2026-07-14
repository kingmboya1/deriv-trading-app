import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 *
 * Expires every auth-related cookie that was set during the OAuth callback.
 * Does NOT touch localStorage (theme preference lives there and must survive).
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });

  const cookiesToClear = [
    "deriv_auth_token",
    "deriv_account_id",
    "deriv_accounts",
    "deriv_account_preference",
    "pkce_verifier",
    "oauth_state",
  ];

  for (const name of cookiesToClear) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  }

  return response;
}
