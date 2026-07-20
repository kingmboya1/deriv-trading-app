"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOAuth2 } from "@deriv-com/auth-client";
import { useDerivSocketStore, disconnectSocket } from "@/lib/derivsocket";
import type { AccountEntry } from "@/components/AccountSwitcher";

interface ProfileMenuProps {
  /** Active account ID at SSR time — used as the initial value before the
   *  WS store populates auth.accountId. */
  activeAccountId: string;
  accounts: AccountEntry[];
}

/** Returns the first character of `id` uppercased, for the avatar fallback.
 *  Uses the loginid (account_id), e.g. "CR1234567" → "C", "VRTC456" → "V". */
function avatarLetter(id: string): string {
  return (id[0] ?? "?").toUpperCase();
}

export default function ProfileMenu({ activeAccountId, accounts }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentId, setCurrentId] = useState(activeAccountId);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Pull the live account type from the WS store — single source of truth.
  const activeAccountType = useDerivSocketStore((s) => s.activeAccountType);
  const currency = useDerivSocketStore((s) => s.auth.currency);
  const reconnect = useDerivSocketStore((s) => s.reconnect);

  // Derive display values
  const activeAccount = accounts.find((a) => a.account_id === currentId) ?? accounts[0];
  const displayId = activeAccount?.account_id ?? activeAccountId;
  const displayType =
    activeAccountType !== "unknown"
      ? activeAccountType
      : (activeAccount?.account_type ?? "unknown");

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Account switch (reuses the same store reconnect() as AccountSwitcher) ──
  const handleSwitch = async (targetId: string) => {
    if (targetId === currentId) return;

    setSwitching(true);
    setSwitchError(null);

    try {
      const res = await fetch("/api/account-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: targetId }),
        cache: "no-store",
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Switch failed");
      }

      setCurrentId(targetId);
      await reconnect();
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "Switch failed");
    } finally {
      setSwitching(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  //
  // Two-phase logout:
  //   1. OAuth2Logout (from @deriv-com/auth-client) loads Deriv's own
  //      end-session endpoint (https://oauth.deriv.com/oauth2/sessions/logout)
  //      in a hidden iframe, which clears Deriv's session cookies server-side
  //      so the user isn't silently re-authorized on next login.
  //   2. Once the iframe posts "logout_complete", our consumer function runs:
  //      close the WebSocket (intentional close — no reconnect loop), expire
  //      our auth cookies via /api/auth/logout, then navigate to root.
  //      localStorage (theme) is never touched.
  //
  // useOAuth2 is the correct API for this app: it targets the traditional
  // Deriv OAuth2 session endpoint directly, without requiring OIDC UserManager
  // state that this app's custom authorization_code flow never sets up.

  const consumerLogout = useCallback(async () => {
    // Close the WebSocket cleanly — reuses the intentionalClose flag so no
    // reconnect attempt or error state fires.
    disconnectSocket();

    // Expire all auth cookies server-side. localStorage (theme) is untouched.
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });

    // Navigate to root — server component guard in page.tsx will confirm
    // the cookies are gone and show the sign-in screen.
    router.push("/");
  }, [router]);

  // useOAuth2 must be called at the top level of the component (hook rules).
  // It wraps our consumer logout with Deriv's iframe-based session teardown.
  const { OAuth2Logout } = useOAuth2(consumerLogout);

  const handleLogout = () => {
    setLoggingOut(true);
    // OAuth2Logout is async but we deliberately don't await it here so the
    // button shows the spinner immediately. The consumer function redirects
    // the page when done, so there's no need to reset loggingOut.
    void OAuth2Logout();
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* ── Avatar trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loggingOut}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Profile menu — ${displayId}`}
        className={`
          inline-flex h-9 w-9 items-center justify-center rounded-full border
          font-display text-sm font-semibold transition-colors disabled:opacity-60
          ${
            displayType === "real"
              ? "border-gain/40 bg-gain/10 text-gain hover:bg-gain/20"
              : displayType === "demo"
              ? "border-loss/40 bg-loss/10 text-loss hover:bg-loss/20"
              : "border-hairline bg-card text-muted hover:text-primary"
          }
        `}
      >
        {loggingOut ? (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          avatarLetter(displayId)
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="dialog"
          aria-label="Profile menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl"
        >
          {/* Account info block */}
          <div className="border-b border-hairline px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Mini avatar */}
              <span
                className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border font-display text-sm font-semibold
                  ${
                    displayType === "real"
                      ? "border-gain/40 bg-gain/10 text-gain"
                      : displayType === "demo"
                      ? "border-loss/40 bg-loss/10 text-loss"
                      : "border-hairline bg-card text-muted"
                  }`}
                aria-hidden="true"
              >
                {avatarLetter(displayId)}
              </span>
              <div className="min-w-0">
                {/* Primary: loginid · currency — the actual account identity */}
                <p className="truncate font-mono text-sm font-medium text-primary">
                  {displayId}
                  {currency ? (
                    <span className="text-muted"> · {currency}</span>
                  ) : null}
                </p>
                {/* Secondary: account type (Real / Demo) */}
                <p className="font-display text-xs text-muted">
                  {displayType === "real"
                    ? "Real account"
                    : displayType === "demo"
                    ? "Demo account"
                    : "Account"}
                </p>
              </div>
            </div>
          </div>

          {/* Account switcher rows — only if there are multiple accounts */}
          {accounts.length > 1 && (
            <div className="border-b border-hairline py-1">
              <p className="px-4 pt-2 pb-1 font-display text-xs font-semibold uppercase tracking-wide text-muted">
                Switch account
              </p>
              {accounts.map((account) => {
                const isActive = account.account_id === currentId;
                const aType = account.account_type;
                return (
                  <button
                    key={account.account_id}
                    type="button"
                    disabled={switching}
                    onClick={() => void handleSwitch(account.account_id)}
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-card disabled:opacity-50 ${
                      isActive ? "text-primary" : "text-muted hover:text-primary"
                    }`}
                  >
                    {/* Spinner on the active row while switching */}
                    {switching && isActive ? (
                      <svg
                        className="h-2.5 w-2.5 flex-none animate-spin text-accent"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <span
                        className={`h-2 w-2 flex-none rounded-full ${
                          aType === "real" ? "bg-gain" : aType === "demo" ? "bg-loss" : "bg-muted"
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-display text-xs font-semibold">
                      {aType === "demo" ? "Demo" : aType === "real" ? "Real" : aType}
                    </span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-muted">
                      {account.account_id}
                    </span>
                    {isActive && !switching && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-accent"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}

              {switchError && (
                <p className="px-4 pb-2 font-sans text-xs text-loss">{switchError}</p>
              )}
            </div>
          )}

          {/* Log out */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 px-4 py-2.5 font-display text-sm text-muted transition-colors hover:bg-card hover:text-loss disabled:opacity-50"
            >
              {/* Log-out icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {loggingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
