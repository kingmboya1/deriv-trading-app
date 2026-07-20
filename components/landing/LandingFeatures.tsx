"use client";

/**
 * LandingFeatures — 4-card feature grid with IntersectionObserver stagger.
 *
 * Mirrors autotrend's features section:
 *   icon tile → title → description
 *   whileInView stagger (framer) → replaced with IO + CSS animation-delay.
 *
 * Each card starts invisible and gains `landing-card-in` once observed.
 * animation-delay is inline-styled per index (0 / 100 / 200 / 300 ms).
 */

import { useEffect, useRef } from "react";

const FEATURES = [
  {
    title: "Live Synthetic Indices",
    desc: "Trade Volatility, Crash, Boom, Step, and Jump indices 24/7 with real-time pricing.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "Instant Execution",
    desc: "Buy Rise/Fall, Digit, and Barrier contracts in one click with live proposal pricing.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    title: "Live Portfolio",
    desc: "Track open contracts in real time, see P&L update tick-by-tick, and close positions instantly.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    title: "Secure OAuth Login",
    desc: "Sign in with your existing Deriv account via PKCE OAuth2 — no password shared with this app.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

export default function LandingFeatures() {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("landing-card-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 }
    );

    for (const ref of cardRefs.current) {
      if (ref) observer.observe(ref);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl">
            Everything you need to trade
          </h2>
          <p className="mt-2 font-sans text-sm text-muted sm:text-base">
            Professional tools, powered by the Deriv API.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              ref={(el) => { cardRefs.current[i] = el; }}
              /* Cards start transparent; IO adds landing-card-in */
              style={{ opacity: 0, animationDelay: `${i * 100}ms` }}
              className="group cursor-default rounded-2xl border border-hairline bg-surface p-6 transition-colors hover:border-accent/30"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-card text-accent transition-colors group-hover:border-accent/30 group-hover:bg-accent/10">
                {f.icon}
              </div>
              <h3 className="font-display text-sm font-semibold text-primary">
                {f.title}
              </h3>
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
