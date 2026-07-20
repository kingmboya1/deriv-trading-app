"use client";

/**
 * SidebarNav — navigation for the dashboard.
 *
 * Responsive behaviour:
 *   mobile  (<md): fixed bottom tab bar — icon only, label hidden
 *   desktop (≥md): left sidebar — icon + label, fixed width
 *
 * Both surfaces share the same NAV_ITEMS array and active/onChange props so
 * there is no duplicated logic or state.
 */

export type DashSection = "markets" | "trade" | "portfolio";

interface NavItem {
  id: DashSection | "autotrade";
  label: string;
  soon?: boolean;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "markets",
    label: "Markets",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "trade",
    label: "Trade",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    id: "autotrade",
    label: "Auto",
    soon: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    if (!item.soon && item.id !== "autotrade") {
      onChange(item.id as DashSection);
    }
  };

  return (
    <>
      {/* ── Desktop: left sidebar (hidden on mobile) ─────────────── */}
      <aside className="hidden md:flex h-full w-56 flex-none flex-col border-r border-hairline bg-surface">
        {/* Logo row */}
        <div className="flex h-14 items-center gap-2.5 border-b border-hairline px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15">
            <svg width="14" height="14" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path d="M14 3L25 9.5V20.5L14 27L3 20.5V9.5L14 3Z" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M14 3V27M3 9.5L25 20.5M25 9.5L3 20.5" stroke="var(--color-accent)" strokeWidth="1.2" strokeOpacity="0.45" />
            </svg>
          </div>
          <span className="font-display text-sm font-bold text-primary">Deriv Trading</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Dashboard navigation">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === active;
              const isDisabled = item.soon === true;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleClick(item)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-display text-sm font-medium transition-colors disabled:cursor-default ${
                      isActive
                        ? "bg-accent/12 text-accent"
                        : isDisabled
                        ? "text-muted/40"
                        : "text-muted hover:bg-card hover:text-primary"
                    }`}
                  >
                    <span className={isActive ? "text-accent" : isDisabled ? "text-muted/30" : "text-muted"}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                    )}
                    {isDisabled && (
                      <span className="rounded-md border border-hairline px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted/60">
                        soon
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-hairline px-4 py-3">
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted/50">
            v0.1 · Beta
          </p>
        </div>
      </aside>

      {/* ── Mobile: fixed bottom tab bar (hidden on desktop) ─────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-hairline bg-surface md:hidden"
        aria-label="Dashboard navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const isDisabled = item.soon === true;
          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => handleClick(item)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 font-display text-[10px] font-semibold transition-colors disabled:cursor-default ${
                isActive
                  ? "text-accent"
                  : isDisabled
                  ? "text-muted/30"
                  : "text-muted"
              }`}
            >
              {/* Active bar at top of tab */}
              {isActive && (
                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent" aria-hidden="true" />
              )}
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {/* Soon dot */}
              {isDisabled && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-muted/40" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
