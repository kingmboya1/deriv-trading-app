"use client";

import React from "react";

export type DashSection = "markets" | "trade" | "portfolio" | "autotrade";

interface NavItem {
  id: DashSection;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "markets",
    label: "Markets",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "trade",
    label: "Trade",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    id: "autotrade",
    label: "Bot",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    ),
  },
];

interface SidebarNavProps {
  active: DashSection;
  onChange: (section: DashSection) => void;
}

export default function SidebarNav({ active, onChange }: SidebarNavProps) {
  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex flex-col h-full w-52 flex-none border-r border-hairline bg-surface">
        <div className="flex h-14 items-center border-b border-hairline px-5">
          <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
            Navigation
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-display text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-card hover:text-primary"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Mobile bottom tab bar ────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-hairline bg-surface px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
                isActive ? "text-accent" : "text-muted"
              }`}
            >
              {/* Active indicator dot */}
              <span className="relative">
                {item.icon}
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </span>
              <span className={`font-display text-[10px] font-semibold ${isActive ? "text-accent" : "text-muted"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
