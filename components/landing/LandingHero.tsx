"use client";

/**
 * LandingHero — badge pill + two-tone headline + dual CTAs.
 *
 * Mirrors autotrend's hero section structure:
 *   badge pill → h1 (two-tone) → sub copy → two CTA buttons
 *
 * CSS fade-up animation fires once, 150ms after mount.
 *
 * Props:
 *   onStartTrading — primary CTA; routes to dashboard if session exists,
 *                    otherwise triggers OAuth (real account preference).
 *   onConnectFree  — secondary CTA; triggers OAuth with demo account
 *                    preference so the user lands on their Demo account.
 */

interface LandingHeroProps {
  onStartTrading: () => void;
  isLoading: boolean;
}

export default function LandingHero({ onStartTrading, isLoading }: LandingHeroProps) {
  return (
    <section className="landing-hero-in px-5 pt-44 pb-20 text-center sm:px-8 sm:pt-52">
      <div className="mx-auto max-w-3xl">

        {/* Badge pill — mirrors autotrend's green pill */}
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-widest text-accent">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
            <path d="M5 0L6.12 3.38H9.51L6.88 5.47L7.94 8.09L5 6.18L2.06 8.09L3.12 5.47L0.49 3.38H3.88Z" />
          </svg>
          Live market data · Real-time trading
        </div>

        {/* Two-tone headline — primary text + accent highlight */}
        <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-tight text-primary sm:text-5xl md:text-6xl">
          Trade smarter with{" "}
          <span className="text-accent">real-time markets</span>
        </h1>

        {/* Sub copy */}
        <p className="mx-auto mt-5 max-w-xl font-sans text-base leading-relaxed text-muted sm:text-lg">
          Connect your Deriv account and access live synthetic indices, instant
          trade execution, and live portfolio tracking — all in one place.
        </p>

        {/* Single CTA — centered */}
        <div className="mt-9 flex justify-center">
          <button
            type="button"
            onClick={onStartTrading}
            disabled={isLoading}
            className="flex items-center justify-center gap-2.5 rounded-xl bg-accent px-8 py-3.5 font-display text-sm font-semibold text-canvas shadow-lg shadow-accent/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <path d="M3 2.5L11.5 7L3 11.5V2.5Z" />
              </svg>
            )}
            {isLoading ? "Connecting…" : "Start Trading Now"}
          </button>
        </div>
      </div>
    </section>
  );
}
