"use client";

import { useEffect, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { connectDerivWS, disconnectDerivWS } from "@/lib/deriv-ws";

type ConnectionStatus = "connecting" | "connected" | "failed" | "closed";

interface PriceChartProps {
  /** Symbol to stream — controlled by the parent (MarketPanel pill row).
   *  When this changes, PriceChart switches the WS tick subscription. */
  symbol?: string;
  onSpotChange?: (spot: number | null) => void;
}

const symbolLabels: Record<string, string> = {
  R_10:  "Volatility 10 Index",
  R_50:  "Volatility 50 Index",
  R_75:  "Volatility 75 Index",
  R_100: "Volatility 100 Index",
};

function getAccountIdentity(wsUrl?: string): string {
  const accountIdCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("deriv_account_id="))
    ?.split("=")[1];
  const accountPreferenceCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("deriv_account_preference="))
    ?.split("=")[1];
  const normalizedAccountId = accountIdCookie ? decodeURIComponent(accountIdCookie) : "unknown";
  const accountType =
    accountPreferenceCookie === "demo" || (wsUrl && wsUrl.includes("/demo"))
      ? "demo"
      : accountPreferenceCookie === "real" || (wsUrl && !wsUrl.includes("/demo"))
        ? "real"
        : "unknown";

  return `${accountType}:${normalizedAccountId}`;
}

export function PriceChart({ symbol = "R_10", onSpotChange }: PriceChartProps) {
  const [prices, setPrices] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<ReturnType<typeof connectDerivWS>>(null);
  const activeAccountIdentityRef = useRef<string | null>(null);
  // Track the last symbol we subscribed to so we only re-subscribe on change
  const subscribedSymbolRef = useRef<string | null>(null);

  useEffect(() => {
    const loadSocket = async () => {
      try {
        const response = await fetch("/api/ws-token");
        const data = (await response.json()) as { otp?: string; wsUrl?: string };

        if (!response.ok || !data.otp || !data.wsUrl) {
          setConnectionStatus("failed");
          return;
        }

        const nextWsUrl = data.wsUrl;
        const nextAccountIdentity = getAccountIdentity(nextWsUrl);
        const currentSocket = socketRef.current?.socket;
        const socketIsOpen = currentSocket && currentSocket.readyState === WebSocket.OPEN;
        const socketIsConnecting = currentSocket && currentSocket.readyState === WebSocket.CONNECTING;

        if (socketIsOpen && activeAccountIdentityRef.current === nextAccountIdentity) {
          return;
        }

        if (socketIsConnecting) {
          return;
        }

        if (socketIsOpen) {
          disconnectDerivWS(currentSocket);
        }

        socketRef.current = connectDerivWS(
          data.otp,
          (price) => {
            setCurrentPrice(price);
            setPrices((previous) => [...previous.slice(-49), price]);
          },
          {
            wsUrl: nextWsUrl,
            onStatusChange: setConnectionStatus,
          }
        );
        activeAccountIdentityRef.current = nextAccountIdentity;
      } catch {
        setConnectionStatus("failed");
      }
    };

    void loadSocket();

    const handleReconnectCheck = () => {
      void loadSocket();
    };

    window.addEventListener("focus", handleReconnectCheck);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void loadSocket();
      }
    });

    const intervalId = window.setInterval(() => {
      void loadSocket();
    }, 15000);

    return () => {
      window.removeEventListener("focus", handleReconnectCheck);
      document.removeEventListener("visibilitychange", handleReconnectCheck);
      window.clearInterval(intervalId);
      disconnectDerivWS(socketRef.current?.socket);
      socketRef.current = null;
      activeAccountIdentityRef.current = null;
    };
  }, []);

  useEffect(() => {
    onSpotChange?.(currentPrice);
  }, [currentPrice, onSpotChange]);

  // When the parent changes the symbol prop, switch the WS subscription.
  // This is the single place symbol changes are acted upon — no dropdown.
  useEffect(() => {
    if (subscribedSymbolRef.current === symbol) return; // already on this symbol

    const socket = socketRef.current?.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      // Socket not ready yet — mark the desired symbol so the open handler
      // picks it up, or the next loadSocket call will use it.
      subscribedSymbolRef.current = symbol;
      socketRef.current?.setCurrentSymbol(symbol);
      setPrices([]);
      setCurrentPrice(null);
      return;
    }

    socketRef.current?.setCurrentSymbol(symbol);
    socket.send(JSON.stringify({ forget_all: "ticks" }));
    socket.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    subscribedSymbolRef.current = symbol;
    setPrices([]);
    setCurrentPrice(null);
  }, [symbol]);

  const chartData = prices.map((price, index) => ({
    index: index + 1,
    price,
  }));

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            Live Market
          </p>
          <h2 className="mt-1 font-display text-base font-semibold text-primary">
            {symbolLabels[symbol] ?? symbol}
          </h2>
        </div>

        {/* Status badge only — dropdown removed, pills are the selector */}
        <div className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium ${
          connectionStatus === "connected"
            ? "border-gain/30 bg-gain/10 text-gain"
            : connectionStatus === "failed"
            ? "border-loss/30 bg-loss/10 text-loss"
            : "border-hairline bg-card text-muted"
        }`}>
          {connectionStatus === "connected"
            ? "Live"
            : connectionStatus === "failed"
            ? "Failed"
            : connectionStatus === "closed"
            ? "Closed"
            : "Connecting"}
        </div>
      </div>

      {/* Current price */}
      <div className="mt-4 rounded-xl border border-hairline bg-card px-4 py-3">
        <p className="font-display text-xs font-medium text-muted">Current price</p>
        <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-primary">
          {currentPrice !== null ? currentPrice.toFixed(2) : "—"}
        </p>
        {connectionStatus === "failed" && (
          <p className="mt-1 font-sans text-xs text-loss">
            Live feed failed. Refresh to retry.
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="mt-4 h-56 rounded-xl border border-hairline bg-card p-3">
        {currentPrice === null ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-muted">
            {connectionStatus === "failed" ? "No data" : "Connecting…"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="index" hide />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                axisLine={false}
                tick={false}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
