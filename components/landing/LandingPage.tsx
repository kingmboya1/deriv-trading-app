"use client";

/**
 * LandingPage — root client component for the unauthenticated home page.
 *
 * Load sequence (mirrors autotrend's pattern):
 *   1. Splash overlay renders immediately over a blank canvas.
 *   2. After ~1.9s the splash fades out and calls onDone().
 *   3. Main content transitions in via `landing-hero-in` CSS animation.
 *   4. ThemeToggle is rendered by layout.tsx (fixed top-right), so we
 *      don't duplicate it here.
 *
 * Two distinct OAuth entry points:
 *   handleStartTrading — real account preference (or existing session → /dashboard)
 *   handleConnectFree  — demo account preference, always starts fresh OAuth
 *
 * The account preference is communicated to the OAuth callback via the
 * `deriv_account_preference` cookie. The callback reads it and selects the
 * matching account as the active one. connectSocket() then reads the resulting
 * WS URL and derives activeAccountType from it — no direct store mutation needed.
 * This is the same mechanism the old sign-in toggle used, keeping all the
 * account-selection logic inside the existing callback + WS store machinery.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import LandingSplash from "@/components/landing/LandingSplash";
import LandingNav from "@/components/landing/LandingNav";
import LandingTicker from "@/components/landing/LandingTicker";
import LandingHero from "@/components/landing/LandingHero";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingFooter from "@/components/landing/LandingFooter";

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function base64UrlEncode(value: Uint8Array | ArrayBuffer): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createPkcePair() {
  const raw = new Uint8Array(64);
  crypto.getRandomValues(raw);
  const codeVerifier = base64UrlEncode(raw);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return { codeVerifier, codeChallenge: base64UrlEncode(digest) };
}

function setCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 7) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Reads a client-visible cookie value by name. */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.split("=")[1] ?? "") : null;
}

// ─── Core OAuth redirect helper ───────────────────────────────────────────────

/**
 * Builds PKCE params, writes PKCE + state cookies, sets the account preference
 * cookie to `preference`, then redirects to Deriv's auth endpoint.
 *
 * `preference` ends up in the `deriv_account_preference` cookie which the
 * OAuth callback reads to select the active account (demo vs real). This is
 * the same mechanism used by the dashboard account switcher — we just set the
 * preference before OAuth so the first connection lands on the right account.
 */
async function redirectToOAuth(preference: "real" | "demo") {
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";
  const redirectUri =
    process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ||
    "http://localhost:3000/api/auth/callback";

  if (!appId) {
    window.alert("Missing NEXT_PUBLIC_DERIV_APP_ID");
    return;
  }

  const { codeVerifier, codeChallenge } = await createPkcePair();
  const state = crypto.randomUUID();

  // Set preference BEFORE the redirect so the callback picks it up.
  // The callback reads this cookie and calls connectSocket() which derives
  // activeAccountType from the resulting WS URL — no store mutation needed.
  setCookie("deriv_account_preference", preference, 60 * 60 * 24);
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

  window.location.assign(`https://auth.deriv.com/oauth2/auth?${params.toString()}`);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [splashDone, setSplashDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  /**
   * "Start Trading Now" — primary CTA.
   *
   * If a valid Deriv session already exists (deriv_auth_token cookie is
   * present on the client), go straight to /dashboard without re-authenticating.
   * Otherwise kick off OAuth with `real` preference so the user lands on their
   * real account by default (they can switch to demo from the profile menu).
   */
  const handleStartTrading = useCallback(async () => {
    setIsLoading(true);
    const hasSession = Boolean(getCookie("deriv_auth_token"));
    if (hasSession) {
      router.push("/dashboard");
      return;
    }
    await redirectToOAuth("real");
    // isLoading stays true — page is navigating away
  }, [router]);

  /**
   * "Connect Free Account" button has been removed from LandingHero.
   * handleConnectFree is no longer needed.
   */

  return (
    <>
      {/* Splash — unmounts after exit animation completes */}
      {!splashDone && (
        <LandingSplash onDone={() => setSplashDone(true)} />
      )}

      <div
        className="min-h-screen bg-canvas"
        style={{
          opacity: splashDone ? 1 : 0,
          transition: splashDone ? "opacity 0.45s ease-out" : "none",
        }}
      >
        <LandingNav onCta={() => void handleStartTrading()} isLoading={isLoading} />
        <LandingTicker />

        <main>
          <LandingHero
            onStartTrading={() => void handleStartTrading()}
            isLoading={isLoading}
          />

          {/* Divider */}
          <div className="mx-auto max-w-6xl border-t border-hairline px-5 sm:px-8" />

          <LandingFeatures />
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
