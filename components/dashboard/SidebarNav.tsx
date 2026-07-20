"use client";

import React from "react";

/**
 * SidebarNav - navigation for the dashboard.
 */

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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "trade",
    label: "Trade",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    id: "autotrade",
    label: "Auto Trade",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  const handleClick = (item: NavItem) => {
    onChange(item.id);
  };

  return (
    <>
      {/* Desktop: left sidebar */}
      <aside className="hidden md:flex flex-col h-full w-56 flex-none bg-[#12161F] border-r border-[#1B2130]">
        {/* Logo row */}
        <div className="flex h-14 items-center gap-2.5 border-b border-[#1B2130] px-6">
          <span className="font-space-grotesk font-bold text-[#D9A94D] tracking-tight text-lg">
            KingMboya Deriv
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#1B2130] text-[#D9A94D]"
                    : "text-gray-400 hover:bg-[#1B2130]/50 hover:text-white"
                }`}
              >
                <span className={isActive ? "text-[#D9A94D]" : "text-gray-400"}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile: bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-[#1B2130] bg-[#12161F] px-2 pb-safe">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? "text-[#D9A94D]" : "text-gray-400"
              }`}
            >
              {item.icon}
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}