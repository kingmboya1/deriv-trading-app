"use client";

/**
 * LandingTicker — CSS marquee strip with live Deriv tick prices.
 *
 * The landing page is unauthenticated, so we cannot use the OTP-gated
 * useDerivSocketStore. Instead we open a single public WebSocket to
 *   wss://ws.derivws.com/websockets/v3?app_id=<NEXT_PUBLIC_DERIV_APP_ID>
 * and subscribe to ticks for each symbol. No `authorize` call is needed —
 * Deriv allows public tick streams without credentials.
 *
 * Behaviour:
 *  - On mount: opens WS, subscribes to all SYMBOLS.
 *  - On each tick: updates the spot price and derives a direction indicator
 *    from the previous value.
 *  - Falls back gracefully to "—" prices if the connection fails or the
 *    app_id env var is absent.
 *  - On unmount: sends forget_all + closes WS.
 */

import { useEffect, useRef, useState } from "react";

interface TickItem {
  symbol: string;
  label: string;
  spot: number | null;
  prev: number | null;
}

const SYMBOLS: { symbol: string; label: string }[] = [
  { symbol: "R_10",  label: "Volatility 10" },
  { symbol: "R_25",  label: "Volatility 25" },
  { symbol: "R_50",  label: "Volatility 50" },
  { symbol: "R_75",  label: "Volatility 75" },
  { symbol: "R_100", label: "Volatility 100" },
  { symbol: "CRASH500",  label: "Crash 500" },
  { symbol: "BOOM500",   label: "Boom 500" },
];

function formatSpot(spot: number | null): string {
  if (spot === null) return "—";
  return spot.toFixed(spot >= 1000 ? 2 : spot >= 10 ? 3 : 4);
}

export default function LandingTicker() {
  const [ticks, setTicks] = useState<TickItem[]>(
    SYMBOLS.map((s) => ({ ...s, spot: null, prev: null }))
  );
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
    if (!appId) return;

    // Per-invocation abort flag. Set to true by the cleanup function so
    // that if the socket's "open" event fires after Strict Mode has already
    // run the cleanup (unmount → remount cycle), the handler knows to close
    // the socket immediately rather than subscribing and updating state.
    let cancelled = false;

    const ws = new WebSocket(
      `wss://ws.derivws.com/websockets/v3?app_id=${appId}`
    );
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      // If this effect run was already cleaned up (Strict Mode double-invoke),
      // close the socket immediately instead of subscribing.
      if (cancelled) {
        ws.close();
        return;
      }
      for (const { symbol } of SYMBOLS) {
        ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      }
    });

    ws.addEventListener("message", (event) => {
      if (cancelled) return;
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        if (msg.tick && typeof msg.tick === "object") {
          const tick = msg.tick as Record<string, unknown>;
          const symbol = typeof tick.symbol === "string" ? tick.symbol : null;
          const quote =
            typeof tick.quote === "number"
              ? tick.quote
              : typeof tick.quote === "string"
              ? parseFloat(tick.quote)
              : null;

          if (symbol && quote !== null && !isNaN(quote)) {
            setTicks((prev) =>
              prev.map((t) =>
                t.symbol === symbol
                  ? { ...t, prev: t.spot, spot: quote }
                  : t
              )
            );
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    return () => {
      // Mark this run as cancelled so any in-flight "open" handler bails out.
      cancelled = true;

      // Only close the socket this effect run opened. We compare against the
      // local `ws` reference — not wsRef.current — so we never accidentally
      // close a socket opened by the subsequent effect invocation.
      if (ws.readyState === WebSocket.OPEN) {
        // Socket is open: send forget_all before closing cleanly.
        try { ws.send(JSON.stringify({ forget_all: "ticks" })); } catch { /* ignore */ }
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // Socket is still handshaking. We cannot send yet; the "open" handler
        // will see `cancelled = true` and close it there instead.
        // No explicit close() call here — we let the open handler handle it
        // to avoid a CONNECTING→CLOSING race that can suppress the open event.
      }
      // CLOSING / CLOSED: nothing to do.

      // Clear the shared ref only if it still points to our socket.
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, []);

  // Duplicate for seamless marquee loop (same pattern as autotrend)
  const items = [...ticks, ...ticks];

  return (
    <div className="fixed top-14 z-40 w-full overflow-hidden border-b border-hairline bg-surface/80 py-2 backdrop-blur-sm">
      <div className="landing-marquee flex gap-10 whitespace-nowrap">
        {items.map((t, i) => {
          const up = t.spot !== null && t.prev !== null ? t.spot >= t.prev : null;
          return (
            <span
              key={`${t.symbol}-${i}`}
              className="inline-flex items-center gap-1.5 font-mono text-xs"
            >
              {/* Direction arrow */}
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
                className={
                  up === true
                    ? "text-gain"
                    : up === false
                    ? "rotate-180 text-loss"
                    : "text-muted"
                }
              >
                <path
                  d="M5 2L9 8H1L5 2Z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-muted">{t.label}</span>
              <span
                className={
                  up === true
                    ? "text-gain"
                    : up === false
                    ? "text-loss"
                    : "text-primary"
                }
              >
                {formatSpot(t.spot)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
