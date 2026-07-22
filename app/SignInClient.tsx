"use client";

import { useState } from "react";

// ─── PKCE helpers (identical to the ones that were in login/page.tsx) ────────

function base64UrlEncode(value: Uint8Array | ArrayBuffer): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createPkcePair() {
  const randomValues = new Uint8Array(64);
  crypto.getRandomValues(randomValues);
  const codeVerifier = base64UrlEncode(randomValues);
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
  const codeChallenge = base64UrlEncode(digest);
  return { codeVerifier, codeChallenge };
}

function setCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 7) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

// ─── Sign-in UI ───────────────────────────────────────────────────────────────

export default function SignInClient() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";
    const redirectUri =
      process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ||
      "http://localhost:3000/api/auth/callback";

    if (!appId) {
      window.alert("Missing NEXT_PUBLIC_DERIV_APP_ID");
      return;
    }

    setIsLoading(true);

    const { codeVerifier, codeChallenge } = await createPkcePair();
    const state = crypto.randomUUID();

    // Account preference is no longer set here — switching between Real and
    // Demo happens inside the dashboard via the profile menu after login.
    setCookie("pkce_verifier", codeVerifier);
    setCookie("oauth_state", state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: appId,
      redirect_uri: redirectUri,
      scope: "trade account_manage",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    window.location.assign(
      `https://auth.deriv.com/oauth2/auth?${params.toString()}`
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm">

        {/* Logo / wordmark */}
        <div className="mb-10 flex flex-col items-center gap-3">
          {/* Simple geometric mark */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M14 3L25 9.5V20.5L14 27L3 20.5V9.5L14 3Z"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M14 3V27M3 9.5L25 20.5M25 9.5L3 20.5"
                stroke="var(--color-accent)"
                strokeWidth="1.2"
                strokeOpacity="0.4"
              />
            </svg>
          </div>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-muted">
            AutoTrendX
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-hairline bg-surface p-7 shadow-2xl">
          <h1 className="font-display text-xl font-semibold text-primary">
            Sign in to your account
          </h1>
          <p className="mt-1.5 font-sans text-sm text-muted">
            Connect your Deriv account to start trading.
          </p>

          {/* Primary CTA */}
          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={isLoading}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-4 py-3 font-display text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Connecting…
              </>
            ) : (
              "Connect with Deriv"
            )}
          </button>

          {/* Fine print */}
          <p className="mt-5 text-center font-sans text-xs text-muted">
            You will be redirected to Deriv to authorize access.
          </p>
        </div>
      </div>
    </main>
  );
}
