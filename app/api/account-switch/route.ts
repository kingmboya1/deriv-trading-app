import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/account-switch
 *
 * Body: { account_id: string }
 *
 * Validates that the requested account_id exists in the deriv_accounts
 * cookie (written at OAuth callback time), then updates deriv_account_id.
 * The single access_token covers all linked accounts, so no re-auth needed.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { account_id?: string };
  const requestedId = body.account_id;

  if (!requestedId || typeof requestedId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid account_id" },
      { status: 400 }
    );
  }

  // Validate the requested ID is in the stored account list
  const accountsRaw = request.cookies.get("deriv_accounts")?.value;
  if (!accountsRaw) {
    return NextResponse.json(
      { error: "No stored accounts found — please sign in again" },
      { status: 403 }
    );
  }

  let accounts: Array<{ account_id: string; account_type: string }> = [];
  try {
    accounts = JSON.parse(accountsRaw) as typeof accounts;
  } catch {
    return NextResponse.json({ error: "Malformed accounts cookie" }, { status: 400 });
  }

  const match = accounts.find((a) => a.account_id === requestedId);
  if (!match) {
    return NextResponse.json(
      { error: "account_id not in linked accounts" },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ ok: true, account_id: match.account_id, account_type: match.account_type });

  response.cookies.set("deriv_account_id", match.account_id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });

  // Also update the preference cookie so future reconnects default to this type
  response.cookies.set("deriv_account_preference", match.account_type, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });

  return response;
}
