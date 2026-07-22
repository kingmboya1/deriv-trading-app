"use client";

import { useDerivSocketStore } from "@/lib/derivsocket";
import { useAutoTrade } from "@/components/autotrade/hooks/use-auto-trade";
import AutoTradeConfig from "@/components/autotrade/AutoTradeConfig";
import AutoTradeHistory from "@/components/autotrade/AutoTradeHistory";
import AutoTradeStopReason from "@/components/autotrade/AutoTradeStopReason";

export default function AutoTradePanel() {
  const wsStatus = useDerivSocketStore((s) => s.status);

  const {
    isRunning,
    currentStake,
    accumulatedPL,
    sessionTrades,
    stopReason,
    error,
    start,
    stop,
    resetSession,
  } = useAutoTrade();

  const handleAcknowledge = () => resetSession();

  const plPositive = accumulatedPL >= 0;
  const wins = sessionTrades.filter((t) => t.result === "win").length;
  const losses = sessionTrades.filter((t) => t.result === "loss").length;

  // ── WS not connected guard ────────────────────────────────────────────────
  if (wsStatus !== "Connected") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
        </div>
        <p className="font-display text-base font-semibold text-primary">WebSocket not connected</p>
        <p className="max-w-xs font-sans text-sm text-muted">
          The Auto Trade bot requires an active connection. Current status:{" "}
          <span className="font-mono text-accent">{wsStatus}</span>
        </p>
      </div>
    );
  }

  // ── Stop reason summary ───────────────────────────────────────────────────
  if (stopReason) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">Auto Trade</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-primary">Session Ended</h2>
        </div>
        <AutoTradeStopReason
          stopReason={stopReason}
          trades={sessionTrades}
          accumulatedPL={accumulatedPL}
          onAcknowledge={handleAcknowledge}
        />
        {sessionTrades.length > 0 && (
          <div>
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-muted">Session History</p>
            <AutoTradeHistory trades={sessionTrades} />
          </div>
        )}
      </div>
    );
  }

  // ── Running view ──────────────────────────────────────────────────────────
  if (isRunning) {
    const wins   = sessionTrades.filter((t) => t.result === "win").length;
    const losses = sessionTrades.filter((t) => t.result === "loss").length;
    const plPositive = accumulatedPL >= 0;

    return (
      <div className="flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">D&apos;Alembert Bot</p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-primary">
              Bot Running
              <span className="flex items-center gap-1.5 rounded-full border border-gain/30 bg-gain/8 px-2.5 py-0.5 font-mono text-xs font-medium text-gain">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gain" aria-hidden="true" />
                Live
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => stop("manual")}
            className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-2 font-display text-sm font-semibold text-loss transition-colors hover:bg-loss/20"
          >
            Stop Bot
          </button>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-accent/25 bg-surface px-4 py-3">
            <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">Next Stake</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-accent">
              ${currentStake.toFixed(2)}
            </p>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${plPositive ? "border-gain/25 bg-gain/8" : "border-loss/25 bg-loss/8"}`}>
            <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">Session P/L</p>
            <p className={`mt-1 font-mono text-xl font-semibold tabular-nums ${plPositive ? "text-gain" : "text-loss"}`}>
              {plPositive ? "+" : ""}${accumulatedPL.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
            <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">W / L</p>
            <p className="mt-1 font-mono text-xl font-semibold">
              <span className="text-gain">{wins}</span>
              <span className="text-muted">/</span>
              <span className="text-loss">{losses}</span>
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
            <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">Trades</p>
            <p className="mt-1 font-mono text-xl font-semibold text-primary">{sessionTrades.length}</p>
          </div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {["R_50", "DIGITDIFF", "1 tick", "$10 base", "D'Alembert"].map((label) => (
            <span key={label} className="rounded-full border border-hairline bg-card px-2.5 py-0.5 font-mono text-[10px] text-muted">
              {label}
            </span>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 font-sans text-sm text-loss">{error}</div>
        )}

        <div>
          <p className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-muted">
            Trade History ({sessionTrades.length})
          </p>
          <AutoTradeHistory trades={sessionTrades} />
        </div>
      </div>
    );
  }

  // ── Config / idle ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <AutoTradeConfig onStart={(tp, ml) => start(tp, ml)} />
      {error && (
        <div className="rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 font-sans text-sm text-loss">{error}</div>
      )}
    </div>
  );
}
