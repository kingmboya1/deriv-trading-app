"use client";

import { useEffect, useRef, useState } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";

export interface AccountEntry {
  account_id: string;
  account_type: string; // "real" | "demo" | ...
}

interface AccountSwitcherProps {
  /** Initial active account ID — passed from the server component via cookie. */
  activeAccountId: string;
  /** All available accounts — passed from the server component via cookie. */
  accounts: AccountEntry[];
}

function labelFor(account: AccountEntry): string {
  const typePart =
    account.account_type === "demo"
      ? "Demo"
      : account.account_type === "real"
      ? "Real"
      : account.account_type;
  return `${typePart} · ${account.account_id}`;
}

export default function AccountSwitcher({
  activeAccountId,
  accounts,
}: AccountSwitcherProps) {
  const [currentId, setCurrentId] = useState(activeAccountId);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const reconnect = useDerivSocketStore((s) => s.reconnect);

  const activeAccount = accounts.find((a) => a.account_id === currentId) ?? accounts[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (accounts.length <= 1) {
    // Single account — just render the static badge, no switcher needed
    const type = activeAccount?.account_type ?? "unknown";
    return (
      <span
        className={`rounded-md border px-3 py-1.5 font-mono text-xs font-medium tracking-wide ${
          type === "real"
            ? "border-gain/30 bg-gain/10 text-gain"
            : type === "demo"
            ? "border-loss/30 bg-loss/10 text-loss"
            : "border-hairline bg-card text-muted"
        }`}
      >
        {type === "real" ? "REAL" : type === "demo" ? "DEMO" : type.toUpperCase()}
      </span>
    );
  }

  const handleSwitch = async (targetId: string) => {
    if (targetId === currentId) {
      setOpen(false);
      return;
    }

    setSwitching(true);
    setError(null);
    setOpen(false);

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

      // Force WS reconnect so the new account's OTP is fetched and
      // balance/portfolio subscriptions restart from scratch.
      await reconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch failed");
    } finally {
      setSwitching(false);
    }
  };

  const type = activeAccount?.account_type ?? "unknown";

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-medium tracking-wide transition-colors disabled:opacity-60 ${
          type === "real"
            ? "border-gain/30 bg-gain/10 text-gain hover:bg-gain/20"
            : type === "demo"
            ? "border-loss/30 bg-loss/10 text-loss hover:bg-loss/20"
            : "border-hairline bg-card text-muted hover:text-primary"
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {switching ? (
          <svg
            className="h-3 w-3 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        <span>{type === "demo" ? "DEMO" : type === "real" ? "REAL" : type.toUpperCase()}</span>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Select account"
          className="absolute right-0 top-full z-40 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl"
        >
          <p className="px-3 pt-2.5 pb-1 font-display text-xs font-semibold uppercase tracking-wide text-muted">
            Switch account
          </p>
          {accounts.map((account) => {
            const isActive = account.account_id === currentId;
            const aType = account.account_type;
            return (
              <button
                key={account.account_id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => void handleSwitch(account.account_id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-card ${
                  isActive ? "text-primary" : "text-muted hover:text-primary"
                }`}
              >
                {/* Colour dot */}
                <span
                  className={`h-2 w-2 flex-none rounded-full ${
                    aType === "real" ? "bg-gain" : aType === "demo" ? "bg-loss" : "bg-muted"
                  }`}
                />
                <span className="font-display text-xs font-semibold">
                  {aType === "demo" ? "Demo" : aType === "real" ? "Real" : aType}
                </span>
                <span className="ml-auto font-mono text-xs tabular-nums text-muted">
                  {account.account_id}
                </span>
                {isActive && (
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
        </div>
      )}

      {/* Inline error — shown below the trigger */}
      {error && (
        <p className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-lg border border-loss/30 bg-loss/10 px-2.5 py-1 font-sans text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}
