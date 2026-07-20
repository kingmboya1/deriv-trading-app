"use client";

import type { StopReason, TradeRecord } from "@/components/autotrade/hooks/use-auto-trade";

interface AutoTradeStopReasonProps {
  stopReason: StopReason;
  trades: TradeRecord[];
  accumulatedPL: number;
  onAcknowledge: () => void;
}

const REASON_COPY: Record<NonNullable<StopReason>, { title: string; desc: string }> = {
  max_losses: {
    title: "Max Consecutive Losses Reached",
    desc: "The bot stopped after hitting your configured consecutive loss limit to prevent runaway stake growth.",
  },
  take_profit: {
    title: "Take-Profit Target Reached",
    desc: "Session profit reached your take-profit limit. The bot locked in the gain automatically.",
  },
  stop_loss: {
    title: "Stop-Loss Limit Reached",
    desc: "Total session loss reached your stop-loss limit. The bot stopped to protect your balance.",
  },
  max_stake: {
    title: "Max Stake Ceiling Reached",
    desc: "The next martingale stake would have exceeded your max stake ceiling. The bot stopped instead of placing an over-limit trade.",
  },
  manual: {
    title: "Bot Stopped Manually",
    desc: "You stopped the bot. Session results are shown below.",
  },
};

export default function AutoTradeStopReason({
  stopReason,
  trades,
  accumulatedPL,
  onAcknowledge,
}: AutoTradeStopReasonProps) {
  if (!stopReason) return null;

  const copy = REASON_COPY[stopReason];
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  const total = trades.length;
  const plPositive = accumulatedPL >= 0;

  return (
    <div className="rounded-2xl border border-accent/40 bg-surface p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full ${
            stopReason === "take_profit"
              ? "bg-gain/15 text-gain"
              : stopReason === "manual"
              ? "bg-muted/15 text-muted"
              : "bg-loss/15 text-loss"
          }`}
          aria-hidden="true"
        >
          {stopReason === "take_profit" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </span>
        <div>
          <p className="font-display text-sm font-bold text-accent">{copy.title}</p>
          <p className="mt-1 font-sans text-xs text-muted">{copy.desc}</p>
        </div>
      </div>

      {/* Session summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-card px-3 py-2.5">
          <p className="font-display text-[10px] uppercase tracking-widest text-muted">Trades</p>
          <p className="mt-1 font-mono text-lg font-semibold text-primary">{total}</p>
        </div>
        <div className="rounded-xl border border-gain/25 bg-gain/8 px-3 py-2.5">
          <p className="font-display text-[10px] uppercase tracking-widest text-gain/70">Wins</p>
          <p className="mt-1 font-mono text-lg font-semibold text-gain">{wins}</p>
        </div>
        <div className="rounded-xl border border-loss/25 bg-loss/8 px-3 py-2.5">
          <p className="font-display text-[10px] uppercase tracking-widest text-loss/70">Losses</p>
          <p className="mt-1 font-mono text-lg font-semibold text-loss">{losses}</p>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 ${plPositive ? "border-gain/25 bg-gain/8" : "border-loss/25 bg-loss/8"}`}>
          <p className="font-display text-[10px] uppercase tracking-widest text-muted">Net P/L</p>
          <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${plPositive ? "text-gain" : "text-loss"}`}>
            {plPositive ? "+" : ""}${accumulatedPL.toFixed(2)}
          </p>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onAcknowledge}
        className="mt-5 w-full rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 font-display text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
      >
        Acknowledge &amp; Tweak Config
      </button>
    </div>
  );
}
