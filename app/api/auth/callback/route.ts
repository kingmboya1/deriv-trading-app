import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("oauth_state")?.value;
  const codeVerifier = request.cookies.get("pkce_verifier")?.value;
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";
  const redirectUri =
    process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ??
    "http://localhost:3000/api/auth/callback";

  if (!code || !codeVerifier || !appId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (state && storedState && state !== storedState) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const tokenResponse = await fetch("https://auth.deriv.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: appId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const dashboardUrl = new URL("/dashboard", appUrl).toString();
  const response = NextResponse.redirect(dashboardUrl);

  response.cookies.set("pkce_verifier", "", {
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("oauth_state", "", {
    path: "/",
    maxAge: 0,
  });

  if (tokenPayload.access_token) {
    response.cookies.set("deriv_auth_token", tokenPayload.access_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    try {
      const accountsResponse = await fetch(
        "https://api.derivws.com/trading/v1/options/accounts",
        {
          headers: {
            Authorization: `Bearer ${tokenPayload.access_token}`,
            "Deriv-App-ID": appId,
          },
          cache: "no-store",
        }
      );

      if (accountsResponse.ok) {
        const accountsPayload = (await accountsResponse.json()) as {
          data?: Array<{ account_id?: string; account_type?: string }>;
        };
        const demoAccount = accountsPayload.data?.find(
          (account) => account.account_type === "demo"
        );

        if (demoAccount?.account_id) {
          response.cookies.set("deriv_account_id", demoAccount.account_id, {
            path: "/",
            sameSite: "lax",
            maxAge: 60 * 60 * 24,
          });
        }
      }
    } catch {
      // Ignore account lookup failures and continue with the redirect.
    }
  }

  return response;
}
