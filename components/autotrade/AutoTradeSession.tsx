"use client";

/**
 * AutoTradeSession — live session view shown while the bot is running.
 * Displays current stake, consecutive losses, running P/L, and trade history.
 */

import type { TradeRecord } from "@/components/autotrade/hooks/use-auto-trade";
import AutoTradeHistory from "@/components/autotrade/AutoTradeHistory";

interface BotSession {
  currentStake: number;
  consecutiveLosses: number;
  totalPnl: number;
  trades: TradeRecord[];
}

interface Props {
  session: BotSession;
  onStop: () => void;
}

export default function AutoTradeSession({ session, onStop }: Props) {
  const pnlPos = session.totalPnl >= 0;
  const wins   = session.trades.filter((t) => t.result === "win").length;
  const losses = session.trades.filter((t) => t.result === "loss").length;

  return (
    <div className="flex flex-col gap-4">

      {/* Live stats row */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">

        {/* Current stake */}
        <div className={`rounded-xl border px-4 py-3 ${
          session.currentStake > 0 ? "border-accent/30 bg-accent/8" : "border-hairline bg-surface"
        }`}>
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">
            Current Stake
          </p>
          <p className="mt-1 font-mono text-lg font-medium tabular-nums text-accent">
            {session.currentStake.toFixed(2)}
          </p>
        </div>

        {/* Consecutive losses */}
        <div className={`rounded-xl border px-4 py-3 ${
          session.consecutiveLosses > 0 ? "border-loss/30 bg-loss/8" : "border-hairline bg-surface"
        }`}>
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">
            Consec. Losses
          </p>
          <p className={`mt-1 font-mono text-lg font-medium ${
            session.consecutiveLosses > 0 ? "text-loss" : "text-primary"
          }`}>
            {session.consecutiveLosses}
          </p>
        </div>

        {/* Win / Loss counts */}
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">
            W / L
          </p>
          <p className="mt-1 font-mono text-lg font-medium">
            <span className="text-gain">{wins}</span>
            <span className="text-muted"> / </span>
            <span className="text-loss">{losses}</span>
          </p>
        </div>

        {/* Running P/L */}
        <div className={`rounded-xl border px-4 py-3 ${
          pnlPos ? "border-gain/30 bg-gain/8" : "border-loss/30 bg-loss/8"
        }`}>
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">
            Session P/L
          </p>
          <p className={`mt-1 font-mono text-lg font-medium tabular-nums ${pnlPos ? "text-gain" : "text-loss"}`}>
            {pnlPos ? "+" : ""}{session.totalPnl.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Stop button */}
      <button
        type="button"
        onClick={onStop}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-loss px-4 py-3 font-display text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
        Stop Bot
      </button>

      {/* Trade history */}
      <div>
        <p className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-muted">
          Trade History — This Session
        </p>
        <AutoTradeHistory trades={session.trades} />
      </div>
    </div>
  );
}
