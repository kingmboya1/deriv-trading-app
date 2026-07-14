"use client";

import { useEffect } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";

interface BalanceBarProps {
  realBalance: number;
  demoBalance: number;
  /** @deprecated No longer used — account type is now read from the WS store. */
  connectedAccountType?: "real" | "demo" | "unknown";
}

export default function BalanceBar({ realBalance, demoBalance }: BalanceBarProps) {
  const storeBalance = useDerivSocketStore((s) => s.balance);
  const connect = useDerivSocketStore((s) => s.connect);
  const wsStatus = useDerivSocketStore((s) => s.status);
  // Single source of truth — same store field TradePanel reads.
  const connectedAccountType = useDerivSocketStore((s) => s.activeAccountType);

  useEffect(() => {
    void connect();
  }, [connect]);

  // While connecting/reconnecting after an account switch, storeBalance is
  // null (cleared by reconnect()). Fall back to the SSR-baked prop only on
  // the initial page load (wsStatus === "Connecting" with no prior balance).
  // Once the new account's balance subscription fires, storeBalance takes over.
  const isConnecting = wsStatus === "Connecting" || wsStatus === "Reconnecting...";

  const balance =
    storeBalance !== null
      ? storeBalance
      : isConnecting
        ? null // show "—" while switching — never show the wrong account's number
        : connectedAccountType === "real"
          ? realBalance
          : demoBalance;

  const formattedBalance =
    balance === null
      ? "—"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(balance);

  const statusText =
    connectedAccountType === "real"
      ? "Connected to REAL"
      : connectedAccountType === "demo"
        ? "Connected to DEMO"
        : "Connected to UNKNOWN";

  return (
    <section className="rounded-2xl border border-hairline bg-surface px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-muted">
            Balance
          </p>
          <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-primary">
            {formattedBalance}
          </p>
        </div>
        <div
          className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-medium tracking-wide ${
            connectedAccountType === "real"
              ? "border-gain/30 bg-gain/10 text-gain"
              : connectedAccountType === "demo"
              ? "border-loss/30 bg-loss/10 text-loss"
              : "border-hairline bg-card text-muted"
          }`}
        >
          {statusText}
        </div>
      </div>
    </section>
  );
}
