"use client";

import { useState } from "react";
import SidebarNav, { type DashSection } from "@/components/dashboard/SidebarNav";
import BalanceBar from "@/components/BalanceBar";
import MarketPanel from "@/components/MarketPanel";
import { TradePanel } from "@/components/TradePanel";
import Portfolio from "@/components/Portfolio";
import ProfileMenu from "@/components/ProfileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import AutoTradePanel from "@/components/autotrade/AutoTradePanel";
import AccountSwitchButton from "@/components/AccountSwitchButton";
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
      <header className="flex h-14 flex-none items-center justify-between border-b border-hairline bg-surface px-4 sm:px-5">

        {/* Left: logo */}
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-primary sm:tracking-[0.25em]">
          AutoTrendX
        </p>

        {/* Right: Demo/Live switch + theme + profile */}
        <div className="flex items-center gap-2">
          {/* Demo ↔ Live switch — always visible, prominent on mobile */}
          <AccountSwitchButton accounts={accounts} activeAccountId={accountId} />
          <ThemeToggle />
          <ProfileMenu activeAccountId={accountId} accounts={accounts} />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <SidebarNav active={activeSection} onChange={setActiveSection} />

        <main className="flex-1 overflow-y-auto px-3 py-3 pb-20 sm:px-6 sm:py-5 md:pb-5">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:gap-5">
            <BalanceBar realBalance={realBalance} demoBalance={demoBalance} />

            {activeSection === "markets"   && <MarketPanel wsUrl={wsUrl} />}
            {activeSection === "trade"     && <div className="w-full max-w-sm mx-auto"><TradePanel /></div>}
            {activeSection === "portfolio" && <Portfolio />}
            {activeSection === "autotrade" && <AutoTradePanel />}
          </div>
        </main>
      </div>
    </div>
  );
}
