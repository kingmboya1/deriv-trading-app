"use client";

/**
 * LandingNav — sticky top nav.
 * Logo left, ThemeToggle + CTA right.
 */

import { ThemeToggle } from "@/components/ThemeToggle";

interface LandingNavProps {
  onCta: () => void;
  isLoading: boolean;
}

export default function LandingNav({ onCta, isLoading }: LandingNavProps) {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-hairline bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">

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
            Deriv Trading
          </span>
        </div>

        {/* Right: theme toggle + CTA */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={onCta}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-1.5 font-display text-sm font-semibold text-canvas transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
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
  );
}
