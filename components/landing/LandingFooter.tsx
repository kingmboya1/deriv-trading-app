/**
 * LandingFooter — minimal footer matching the canvas background.
 * Server component (no interactivity needed).
 */
export default function LandingFooter() {
  return (
    <footer className="border-t border-hairline bg-canvas px-5 py-8 text-center sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3">
        {/* Logo row */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15">
            <svg width="14" height="14" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path
                d="M14 3L25 9.5V20.5L14 27L3 20.5V9.5L14 3Z"
                stroke="var(--color-accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-display text-sm font-bold text-primary">AutoTrendX</span>
        </div>

        <p className="font-sans text-xs text-muted">
          Trading involves risk. Only trade with money you can afford to lose.
        </p>
        <p className="font-sans text-xs text-muted">
          © {new Date().getFullYear()} AutoTrendX. Not affiliated with Deriv Ltd.
        </p>
      </div>
    </footer>
  );
}
