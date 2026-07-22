"use client";

/**
 * LandingSplash — full-screen overlay shown for ~1.8 s on first load.
 *
 * Structure mirrors autotrend's Splash:
 *   logo scale-in → wordmark slide-up → progress bar fill → fade-out
 *
 * Entirely CSS-driven; no framer-motion.
 * `onDone` is called after the exit animation completes so the parent can
 * unmount this overlay and reveal the main content.
 */

import { useEffect, useState } from "react";

interface LandingSplashProps {
  onDone: () => void;
}

export default function LandingSplash({ onDone }: LandingSplashProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Start exit after the progress bar finishes (0.5s delay + 1.4s fill = 1.9s)
    const exitTimer = window.setTimeout(() => setLeaving(true), 1900);
    // Unmount after exit animation (0.55s)
    const doneTimer = window.setTimeout(() => onDone(), 1900 + 550);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-canvas ${
        leaving ? "landing-splash-out" : ""
      }`}
    >
      {/* Logo mark */}
      <div className="landing-splash-logo flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15">
        <svg
          width="36"
          height="36"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 3L25 9.5V20.5L14 27L3 20.5V9.5L14 3Z"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M14 3V27M3 9.5L25 20.5M25 9.5L3 20.5"
            stroke="var(--color-accent)"
            strokeWidth="1.2"
            strokeOpacity="0.5"
          />
        </svg>
      </div>

      {/* Wordmark */}
      <p className="landing-splash-title mt-5 font-display text-2xl font-bold text-primary">
        AutoTrendX
      </p>
      <p className="landing-splash-sub mt-1 font-display text-sm font-medium tracking-widest text-accent">
        live markets · real time
      </p>

      {/* Progress bar */}
      <div className="mt-8 h-[3px] w-44 overflow-hidden rounded-full bg-hairline">
        <div className="landing-splash-bar h-full rounded-full bg-accent" />
      </div>
    </div>
  );
}
