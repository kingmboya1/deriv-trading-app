"use client";

/**
 * MarketPanel — "Live Markets" section.
 *
 * Structure:
 *   1. Section heading
 *   2. Pill-shaped symbol selector row (R_10, R_50, R_75, R_100)
 *   3. Market card grid — one card per symbol showing name, current spot,
 *      direction badge, and a mini connection indicator
 *   4. Expanded view — PriceChart + TradePanel for the selected symbol
 *
 * Price data comes exclusively from PriceChart's existing onSpotChange
 * callback — no new WebSocket connections are opened here.
 */

import { useState, useCallback } from "react";
import { PriceChart } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";

interface MarketPanelProps {
  wsUrl: string;
}

// Only the symbols we actually support in PriceChart / TradePanel
const SYMBOLS = [
  { id: "R_10",  label: "Volatility 10",  short: "V10" },
  { id: "R_50",  label: "Volatility 50",  short: "V50" },
  { id: "R_75",  label: "Volatility 75",  short: "V75" },
  { id: "R_100", label: "Volatility 100", short: "V100" },
];

interface SpotState {
  current: number | null;
  prev: number | null;
}

export default function MarketPanel({ wsUrl }: MarketPanelProps) {
  // Single source of truth for symbol selection — pills and chart both read this
  const [selectedSymbol, setSelectedSymbol] = useState("R_10");
  // Map of symbol → { current, prev } for direction badges on the cards
  const [spotMap, setSpotMap] = useState<Record<string, SpotState>>(
    Object.fromEntries(SYMBOLS.map((s) => [s.id, { current: null, prev: null }]))
  );

  // PriceChart calls this whenever the active symbol's spot changes
  const handleSpotChange = useCallback((spot: number | null) => {
    setSpotMap((prev) => ({
      ...prev,
      [selectedSymbol]: {
        prev: prev[selectedSymbol]?.current ?? null,
        current: spot,
      },
    }));
  }, [selectedSymbol]);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Section heading ──────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h2 className="font-display text-lg font-semibold text-primary">
          Live Markets
        </h2>
        <span className="flex items-center gap-1.5 rounded-full border border-gain/30 bg-gain/8 px-2.5 py-0.5 font-mono text-xs font-medium text-gain">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gain" aria-hidden="true" />
          Live
        </span>
      </div>

      {/* ── Pill symbol selector row ─────────────────────────────── */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Market symbol selector">
        {SYMBOLS.map((s) => {
          const isActive = selectedSymbol === s.id;
          const spot = spotMap[s.id];
          const up = spot?.current !== null && spot?.prev !== null
            ? spot.current! >= spot.prev!
            : null;

          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedSymbol(s.id)}
              className={`flex items-center gap-2 rounded-full border px-4 py-1.5 font-display text-sm font-semibold transition-colors ${
                isActive
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-hairline bg-surface text-muted hover:border-accent/40 hover:text-primary"
              }`}
            >
              <span>{s.label}</span>
              {/* Live price on pill when available */}
              {spot?.current !== null && (
                <span className={`font-mono text-xs tabular-nums ${
                  up === true ? "text-gain" : up === false ? "text-loss" : "text-muted"
                }`}>
                  {spot.current!.toFixed(spot.current! >= 1000 ? 2 : spot.current! >= 10 ? 3 : 4)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Market card grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SYMBOLS.map((s) => {
          const isActive = selectedSymbol === s.id;
          const spot = spotMap[s.id];
          const hasPrice = spot?.current !== null;
          const up = hasPrice && spot?.prev !== null
            ? spot.current! >= spot.prev!
            : null;
          // Pseudo % change from prev tick — directional indicator only
          const pctChange = hasPrice && spot?.prev !== null && spot.prev !== 0
            ? ((spot.current! - spot.prev!) / spot.prev!) * 100
            : null;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSymbol(s.id)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                isActive
                  ? "border-accent/40 bg-accent/8"
                  : "border-hairline bg-surface hover:border-accent/25 hover:bg-card"
              }`}
            >
              {/* Symbol name + direction badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
                    {s.short}
                  </p>
                  <p className="mt-0.5 font-display text-sm font-semibold text-primary">
                    {s.label}
                  </p>
                </div>

                {/* % change badge — green up / red down */}
                <span className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-medium tabular-nums ${
                  up === true
                    ? "border-gain/25 bg-gain/10 text-gain"
                    : up === false
                    ? "border-loss/25 bg-loss/10 text-loss"
                    : "border-hairline bg-card text-muted"
                }`}>
                  {up === true ? "↑" : up === false ? "↓" : "·"}
                  {pctChange !== null
                    ? ` ${Math.abs(pctChange).toFixed(3)}%`
                    : " —"}
                </span>
              </div>

              {/* Spot price */}
              <p className={`mt-3 font-mono text-lg font-medium tabular-nums ${
                up === true ? "text-gain" : up === false ? "text-loss" : "text-primary"
              }`}>
                {hasPrice
                  ? spot.current!.toFixed(spot.current! >= 1000 ? 2 : spot.current! >= 10 ? 3 : 4)
                  : selectedSymbol === s.id ? "—" : "—"}
              </p>

              {/* Connection indicator — only meaningful for the active symbol
                  (PriceChart only streams the selected one) */}
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 flex-none rounded-full ${
                  isActive && hasPrice ? "bg-gain" : "bg-muted/30"
                }`} aria-hidden="true" />
                <span className="font-mono text-[10px] text-muted">
                  {isActive ? (hasPrice ? "live" : "connecting") : "select to stream"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Chart + Trade panel for selected symbol ──────────────── */}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <PriceChart
          symbol={selectedSymbol}
          onSpotChange={handleSpotChange}
        />
        <TradePanel symbol={selectedSymbol} currentSpot={spotMap[selectedSymbol]?.current ?? null} />
      </div>
    </div>
  );
}
