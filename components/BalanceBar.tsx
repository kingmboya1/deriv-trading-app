"use client";

/**
 * BalanceBar — summary card row shown at the top of the dashboard main area.
 *
 * Renders 4 cards in a responsive grid:
 *   Real Balance | Demo Balance | Account ID | WS Status
 *
 * All WS store bindings are unchanged — this is a layout restructure only.
 */

import { useEffect } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";

interface BalanceBarProps {
  realBalance: number;
  demoBalance: number;
  /** @deprecated No longer used — account type is read from the WS store. */
  connectedAccountType?: "real" | "demo" | "unknown";
}

function formatUsd(value: number | null, fallback = "—"): string {
  if (value === null) return fallback;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function BalanceBar({ realBalance, demoBalance }: BalanceBarProps) {
  const storeBalance   = useDerivSocketStore((s) => s.balance);
  const connect        = useDerivSocketStore((s) => s.connect);
  const wsStatus       = useDerivSocketStore((s) => s.status);
  const accountType    = useDerivSocketStore((s) => s.activeAccountType);
  const accountId      = useDerivSocketStore((s) => s.auth.accountId);
  const currency       = useDerivSocketStore((s) => s.auth.currency);

  useEffect(() => { void connect(); }, [connect]);

  const isConnecting = wsStatus === "Connecting" || wsStatus === "Reconnecting...";

  // Live balance — null while switching (shows "—"), falls back to SSR prop
  // only on initial load before the first balance subscription fires.
  const liveBalance =
    storeBalance !== null
      ? storeBalance
      : isConnecting
        ? null
        : accountType === "real"
          ? realBalance
          : demoBalance;

  // The SSR props are the initial values; after the WS connects the store
  // owns the real numbers. We always show both as reference cards.
  const displayRealBalance = accountType === "real" ? (liveBalance ?? realBalance) : realBalance;
  const displayDemoBalance = accountType === "demo" ? (liveBalance ?? demoBalance) : demoBalance;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

      {/* Card 1 — Real Balance */}
      <div className={`rounded-2xl border bg-surface px-5 py-4 ${
        accountType === "real" ? "border-gain/30" : "border-hairline"
      }`}>
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
          Real Balance
        </p>
        <p className={`mt-1.5 font-mono text-xl font-medium tabular-nums ${
          accountType === "real" ? "text-gain" : "text-primary"
        }`}>
          {accountType === "real" && isConnecting ? "—" : formatUsd(displayRealBalance)}
        </p>
        {accountType === "real" && (
          <span className="mt-2 inline-block rounded-md border border-gain/25 bg-gain/8 px-2 py-0.5 font-mono text-[10px] font-medium text-gain">
            Active
          </span>
        )}
      </div>

      {/* Card 2 — Demo Balance */}
      <div className={`rounded-2xl border bg-surface px-5 py-4 ${
        accountType === "demo" ? "border-loss/30" : "border-hairline"
      }`}>
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
          Demo Balance
        </p>
        <p className={`mt-1.5 font-mono text-xl font-medium tabular-nums ${
          accountType === "demo" ? "text-loss" : "text-primary"
        }`}>
          {accountType === "demo" && isConnecting ? "—" : formatUsd(displayDemoBalance)}
        </p>
        {accountType === "demo" && (
          <span className="mt-2 inline-block rounded-md border border-loss/25 bg-loss/8 px-2 py-0.5 font-mono text-[10px] font-medium text-loss">
            Active
          </span>
        )}
      </div>

      {/* Card 3 — Account ID */}
      <div className="rounded-2xl border border-hairline bg-surface px-5 py-4">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
          Account
        </p>
        <p className="mt-1.5 truncate font-mono text-base font-medium text-primary">
          {accountId ?? "—"}
        </p>
        <p className="mt-1 font-display text-xs text-muted">
          {accountType === "real"
            ? "Real account"
            : accountType === "demo"
            ? "Demo account"
            : "—"}
          {currency ? ` · ${currency}` : ""}
        </p>
      </div>

      {/* Card 4 — WS Connection Status */}
      <div className="rounded-2xl border border-hairline bg-surface px-5 py-4">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
          Status
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          {/* Pulse dot */}
          <span
            className={`relative flex h-2.5 w-2.5 flex-none ${
              wsStatus === "Connected" ? "text-gain" : wsStatus === "Reconnecting..." ? "text-accent" : "text-muted"
            }`}
            aria-hidden="true"
          >
            {wsStatus === "Connected" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-50" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
              wsStatus === "Connected"
                ? "bg-gain"
                : wsStatus === "Reconnecting..."
                ? "bg-accent"
                : "bg-muted/40"
            }`} />
          </span>
          <p className={`font-mono text-base font-medium ${
            wsStatus === "Connected"
              ? "text-gain"
              : wsStatus === "Reconnecting..."
              ? "text-accent"
              : "text-muted"
          }`}>
            {wsStatus}
          </p>
        </div>
        <p className="mt-1 font-display text-xs text-muted">
          {wsStatus === "Connected"
            ? `${accountType === "real" ? "Real" : accountType === "demo" ? "Demo" : "Unknown"} feed live`
            : wsStatus === "Reconnecting..."
            ? "Reconnecting…"
            : "Disconnected"}
        </p>
      </div>
    </div>
  );
}
