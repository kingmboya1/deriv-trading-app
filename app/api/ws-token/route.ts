import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get("deriv_auth_token")?.value;
  const accountId = cookieStore.get("deriv_account_id")?.value;
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";

  if (!token || !accountId || !appId) {
    return NextResponse.json(
      { error: "Missing authentication cookies or app ID" },
      { status: 401 }
    );
  }

  try {
    const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`;
    console.log("[ws-token] accountId", accountId);
    console.log("[ws-token] otpUrl", otpUrl);

    const response = await fetch(otpUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Deriv-App-ID": appId,
      },
      cache: "no-store",
    });

    const responseText = await response.text();
    console.log("[ws-token] responseStatus", response.status);
    console.log("[ws-token] responseBody", responseText);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Deriv OTP", details: responseText },
        { status: response.status }
      );
    }

    const payload = JSON.parse(responseText) as {
      data?: { url?: string };
      meta?: unknown;
    };
    const wsUrl = payload.data?.url;
    const otpMatch = wsUrl?.match(/[?&]otp=([^&]+)/);
    const otp = otpMatch?.[1];

    if (!wsUrl || !otp) {
      return NextResponse.json(
        { error: "OTP or websocket URL not returned", details: responseText },
        { status: 200 }
      );
    }

    return NextResponse.json({
      otp,
      wsUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
