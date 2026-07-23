"use client";

/**
 * PriceChart — lightweight-charts candlestick chart.
 *
 * Data source: useDerivSocketStore.candles[symbol] — populated by
 * derivsocket.ts via ticks_history (initial batch) + ohlc (live updates).
 *
 * Symbol switching: sends forget_all + ticks_history resubscription on the
 * shared store's send(), following the same pattern used for tick swaps.
 *
 * Does NOT open a separate WS connection.
 */

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickSeriesOptions,
  ColorType,
  type UTCTimestamp,
  CandlestickSeries,
} from "lightweight-charts";
import { useDerivSocketStore } from "@/lib/derivsocket";

interface PriceChartProps {
  symbol?: string;
  onSpotChange?: (spot: number | null) => void;
}

const SYMBOL_LABELS: Record<string, string> = {
  R_10:  "Volatility 10 Index",
  R_50:  "Volatility 50 Index",
  R_75:  "Volatility 75 Index",
  R_100: "Volatility 100 Index",
};

// ── Theme colours matching the app's design tokens ──────────────────────────
const CHART_THEME = {
  bg:           "#12161F",
  textColor:    "#8B93A7",
  gridColor:    "#1B2130",
  borderColor:  "#232838",
  upColor:      "#2FBE85",
  downColor:    "#F0526B",
  wickUp:       "#2FBE85",
  wickDown:     "#F0526B",
} as const;

export function PriceChart({ symbol = "R_10", onSpotChange }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const subscribedSymbolRef = useRef<string | null>(null);

  const candles    = useDerivSocketStore((s) => s.candles);
  const wsStatus   = useDerivSocketStore((s) => s.status);
  const send       = useDerivSocketStore((s) => s.send);

  // ── Mount: create chart ──────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_THEME.bg },
        textColor: CHART_THEME.textColor,
        fontFamily: "'JetBrains Mono', 'SFMono-Regular', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_THEME.gridColor },
        horzLines: { color: CHART_THEME.gridColor },
      },
      crosshair: {
        vertLine: { color: CHART_THEME.borderColor, labelBackgroundColor: CHART_THEME.bg },
        horzLine: { color: CHART_THEME.borderColor, labelBackgroundColor: CHART_THEME.bg },
      },
      timeScale: {
        borderColor: CHART_THEME.borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: CHART_THEME.borderColor,
      },
      autoSize: true,
    });

    const candleOptions: Partial<CandlestickSeriesOptions> = {
      upColor:          CHART_THEME.upColor,
      downColor:        CHART_THEME.downColor,
      borderUpColor:    CHART_THEME.upColor,
      borderDownColor:  CHART_THEME.downColor,
      wickUpColor:      CHART_THEME.wickUp,
      wickDownColor:    CHART_THEME.wickDown,
    };

    const series = chart.addSeries(CandlestickSeries, candleOptions);

    chartRef.current  = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []);

  // ── Symbol change: resubscribe candle stream ─────────────────────────────
  useEffect(() => {
    if (subscribedSymbolRef.current === symbol) return;
    subscribedSymbolRef.current = symbol;

    // Clear chart data immediately on symbol switch
    seriesRef.current?.setData([]);
    onSpotChange?.(null);

    if (wsStatus !== "Connected") return;

    try {
      // Unsubscribe old candle stream, then subscribe for the new symbol
      send({ forget_all: "candles" });
      send({
        ticks_history: symbol,
        style: "candles",
        granularity: 60,
        count: 100,
        subscribe: 1,
      });
    } catch {
      // WS not open yet — the onopen handler will subscribe R_10 by default;
      // the store will update candles[symbol] when data arrives.
    }
  }, [symbol, wsStatus, send, onSpotChange]);

  // ── Candle data → chart ──────────────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const bars = candles[symbol];
    if (!bars || bars.length === 0) return;

    // lightweight-charts requires bars sorted ascending by time
    const sorted = [...bars]
      .sort((a, b) => a.time - b.time)
      .map((c) => ({ ...c, time: c.time as UTCTimestamp }));
    series.setData(sorted);

    // Report latest close to parent (MarketPanel spot map)
    const last = sorted[sorted.length - 1];
    if (last) onSpotChange?.(last.close);

    // Scroll to the most recent candle
    chartRef.current?.timeScale().scrollToRealTime();
  }, [candles, symbol, onSpotChange]);

  // ── WS connects for the first time: subscribe current symbol ─────────────
  useEffect(() => {
    if (wsStatus !== "Connected") return;
    if (subscribedSymbolRef.current === symbol) return; // already subscribed

    try {
      send({
        ticks_history: symbol,
        style: "candles",
        granularity: 60,
        count: 100,
        subscribe: 1,
      });
      subscribedSymbolRef.current = symbol;
    } catch { /* ignore */ }
  }, [wsStatus, symbol, send]);

  const connectionStatus = wsStatus;
  const bars = candles[symbol];
  const isEmpty = !bars || bars.length === 0;

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            Live Market · 1m
          </p>
          <h2 className="mt-1 font-display text-base font-semibold text-primary">
            {SYMBOL_LABELS[symbol] ?? symbol}
          </h2>
        </div>

        <div className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium ${
          connectionStatus === "Connected"
            ? "border-gain/30 bg-gain/10 text-gain"
            : connectionStatus === "Disconnected"
            ? "border-loss/30 bg-loss/10 text-loss"
            : "border-hairline bg-card text-muted"
        }`}>
          {connectionStatus === "Connected"
            ? "Live"
            : connectionStatus === "Disconnected"
            ? "Disconnected"
            : "Connecting"}
        </div>
      </div>

      {/* Chart container */}
      <div className="relative mt-4 h-64 overflow-hidden rounded-xl">
        {/* Overlay shown while no data yet */}
        {isEmpty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card font-mono text-xs text-muted">
            {connectionStatus === "Disconnected" ? "No data — reconnecting…" : "Loading candles…"}
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </section>
  );
}
