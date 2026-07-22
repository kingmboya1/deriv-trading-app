"use client";

/**
 * LandingNav — sticky top nav.
 *
 * Mobile  : hamburger (left) · logo (center) · theme toggle (right)
 *           Hamburger opens a left-side drawer with the CTA inside.
 * Desktop : logo (left) · theme toggle + CTA (right) — no hamburger.
 */

import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface LandingNavProps {
  onCta: () => void;
  isLoading: boolean;
}

export default function LandingNav({ onCta, isLoading }: LandingNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const handleCta = () => {
    setDrawerOpen(false);
    onCta();
  };

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-hairline bg-canvas/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-8">

          {/* Left: hamburger (mobile only) + logo */}
          <div className="flex items-center gap-3">
            {/* Hamburger — visible only on mobile */}
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-hairline bg-card text-primary transition-colors hover:border-accent/40 sm:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor" />
              </svg>
            </button>

            {/* Logo + wordmark */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                <svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <path
                    d="M14 3L25 9.5V20.5L14 27L3 20.5V9.5L14 3Z"
                    stroke="var(--color-accent)"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 3V27M3 9.5L25 20.5M25 9.5L3 20.5"
                    stroke="var(--color-accent)"
                    strokeWidth="1.2"
                    strokeOpacity="0.45"
                  />
                </svg>
              </div>
              <span className="font-display text-base font-bold text-primary">
                AutoTrendX
              </span>
            </div>
          </div>

          {/* Right: theme toggle + CTA (CTA hidden on mobile — lives in drawer) */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleCta}
              disabled={isLoading}
              className="hidden items-center gap-2 rounded-lg bg-accent px-4 py-1.5 font-display text-sm font-semibold text-canvas transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
            >
              {isLoading ? (
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              Connect with Deriv
            </button>
          </div>
        </div>
      </nav>

      {/* ── Left-side drawer (mobile only) ──────────────────────────────── */}

      {/* Backdrop — tapping it closes the drawer */}
      <div
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-[60] bg-canvas/70 backdrop-blur-sm transition-opacity duration-300 sm:hidden ${
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed left-0 top-0 z-[70] flex h-full w-72 max-w-[82vw] flex-col border-r border-hairline bg-surface shadow-2xl transition-transform duration-300 ease-in-out sm:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex h-14 flex-none items-center justify-between border-b border-hairline px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15">
              <svg width="15" height="15" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path
                  d="M14 3L25 9.5V20.5L14 27L3 20.5V9.5L14 3Z"
                  stroke="var(--color-accent)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 3V27M3 9.5L25 20.5M25 9.5L3 20.5"
                  stroke="var(--color-accent)"
                  strokeWidth="1.2"
                  strokeOpacity="0.45"
                />
              </svg>
            </div>
            <span className="font-display text-sm font-bold text-primary">AutoTrendX</span>
          </div>

          {/* Close button */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:border-accent/30 hover:text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-6">

          {/* Section label */}
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">
            Get Started
          </p>

          {/* CTA button — full width inside drawer */}
          <button
            type="button"
            onClick={handleCta}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-4 py-3.5 font-display text-sm font-semibold text-canvas shadow-lg shadow-accent/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connecting…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <path d="M3 2.5L11.5 7L3 11.5V2.5Z" />
                </svg>
                Connect with Deriv
              </>
            )}
          </button>

          {/* Info cards */}
          <div className="mt-2 flex flex-col gap-3">
            {[
              { label: "Live Markets", desc: "Real-time Volatility indices" },
              { label: "Instant Execution", desc: "One-click contract buying" },
              { label: "Live Portfolio", desc: "Track P&L tick-by-tick" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-hairline bg-card px-4 py-3"
              >
                <p className="font-display text-xs font-semibold text-primary">{item.label}</p>
                <p className="mt-0.5 font-sans text-[11px] text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Drawer footer */}
        <div className="flex-none border-t border-hairline px-5 py-4">
          <p className="font-sans text-[10px] leading-relaxed text-muted">
            Trading involves risk. Only trade with money you can afford to lose.
          </p>
        </div>
      </aside>
    </>
  );
}
