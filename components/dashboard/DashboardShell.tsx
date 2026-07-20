"use client";

/**
 * DashboardShell — client component that owns the active-section state and
 * renders the full dashboard layout:
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │  top header (logo · ProfileMenu)                     │
 *   ├───────────┬──────────────────────────────────────────┤
 *   │ SidebarNav│  BalanceBar (4-card row)                  │
 *   │           │  ─────────────────────────────────────── │
 *   │           │  section content (Markets/Trade/Portfolio)│
 *   └───────────┴──────────────────────────────────────────┘
 *
 * Props come straight from the server component — no data fetching here.
 */

import { useState } from "react";
import SidebarNav, { type DashSection } from "@/components/dashboard/SidebarNav";
import BalanceBar from "@/components/BalanceBar";
import MarketPanel from "@/components/MarketPanel";
import { TradePanel } from "@/components/TradePanel";
import Portfolio from "@/components/Portfolio";
import ProfileMenu from "@/components/ProfileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AccountEntry } from "@/components/AccountSwitcher";

interface DashboardShellProps {
  accountId: string;
  accounts: AccountEntry[];
  realBalance: number;
  demoBalance: number;
  wsUrl: string;
}

export default function DashboardShell({
  accountId,
  accounts,
  realBalance,
  demoBalance,
  wsUrl,
}: DashboardShellProps) {
  const [activeSection, setActiveSection] = useState<DashSection>("markets");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-primary">

      {/* ── Top header ─────────────────────────────────────────────────── */}
      <header className="flex h-14 flex-none items-center justify-between border-b border-hairline bg-surface px-5">
        {/* Left: product name (the sidebar has its own logo; this keeps the
            header clean while the sidebar is open) */}
        <div className="flex items-center gap-2">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-muted">
            Dashboard
          </p>
        </div>

        {/* Right: theme toggle + profile menu */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ProfileMenu activeAccountId={accountId} accounts={accounts} />
        </div>
      </header>

      {/* ── Body: sidebar + main ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">

        {/* Sidebar */}
        <SidebarNav active={activeSection} onChange={setActiveSection} />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto flex max-w-6xl flex-col gap-5">

            {/* Summary card row — always visible regardless of active section */}
            <BalanceBar realBalance={realBalance} demoBalance={demoBalance} />

            {/* Section content */}
            {activeSection === "markets" && (
              <MarketPanel wsUrl={wsUrl} />
            )}

            {activeSection === "trade" && (
              <div className="max-w-sm">
                <TradePanel />
              </div>
            )}

            {activeSection === "portfolio" && (
              <Portfolio />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
