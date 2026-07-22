"use client";

/**
 * AccountSwitchButton — a clear Demo ↔ Live toggle shown in the dashboard header.
 * Tapping switches the active account and reconnects the WebSocket.
 */

import { useState } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";
import type { AccountEntry } from "@/components/AccountSwitcher";

interface Props {
  accounts: AccountEntry[];
  activeAccountId: string;
}

export default function AccountSwitchButton({ accounts, activeAccountId }: Props) {
  const [currentId, setCurrentId] = useState(activeAccountId);
  const [switching, setSwitching] = useState(false);
  const reconnect = useDerivSocketStore((s) => s.reconnect);
  const activeAccountType = useDerivSocketStore((s) => s.activeAccountType);

  const realAccount = accounts.find((a) => a.account_type === "real");
  const demoAccount = accounts.find((a) => a.account_type === "demo");

  // Use live store value once WS connects, fall back to cookie-derived type
  const currentType =
    activeAccountType !== "unknown"
      ? activeAccountType
      : accounts.find((a) => a.account_id === currentId)?.account_type ?? "unknown";

  const isDemo = currentType === "demo";
  const isReal = currentType === "real";

  // Target is the other account
  const targetAccount = isDemo ? realAccount : demoAccount;

  if (!realAccount || !demoAccount) {
    // Only one account type — show static badge
    return (
      <span className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold tracking-wide ${
        isReal ? "border-gain/40 bg-gain/10 text-gain" : "border-loss/40 bg-loss/10 text-loss"
      }`}>
        {isReal ? "LIVE" : "DEMO"}
      </span>
    );
  }

  const handleSwitch = async () => {
    if (!targetAccount || switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/account-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: targetAccount.account_id }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Switch failed");
      setCurrentId(targetAccount.account_id);
      await reconnect();
    } catch {
      // silent — ProfileMenu shows errors if needed
    } finally {
      setSwitching(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleSwitch()}
      disabled={switching}
      aria-label={`Switch to ${isDemo ? "Live" : "Demo"} account`}
      className={`
        flex items-center gap-1.5 rounded-lg border px-3 py-1.5
        font-display text-xs font-bold tracking-wide
        transition-all disabled:opacity-60
        ${isReal
          ? "border-gain/50 bg-gain/15 text-gain hover:bg-gain/25"
          : "border-loss/50 bg-loss/15 text-loss hover:bg-loss/25"
        }
      `}
    >
      {switching ? (
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        /* swap icon */
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 5h10M9 2l3 3-3 3M14 11H4M7 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {/* Current mode label */}
      <span>{isReal ? "LIVE" : "DEMO"}</span>
      {/* Arrow to target */}
      <span className="text-[10px] opacity-60">→ {isDemo ? "LIVE" : "DEMO"}</span>
    </button>
  );
}
