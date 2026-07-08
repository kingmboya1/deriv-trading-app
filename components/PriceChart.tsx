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
  onSymbolChange?: (symbol: string) => void;
}

const symbols = ["R_10", "R_25", "R_50", "R_75", "R_100"];
const symbolLabels: Record<string, string> = {
  R_10: "Volatility 10 Index",
  R_25: "Volatility 25 Index",
  R_50: "Volatility 50 Index",
  R_75: "Volatility 75 Index",
  R_100: "Volatility 100 Index",
};

export function PriceChart({ onSymbolChange }: PriceChartProps) {
  const [prices, setPrices] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("R_10");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<ReturnType<typeof connectDerivWS>>(null);
  const activeWsUrlRef = useRef<string | null>(null);

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
        const currentSocket = socketRef.current?.socket;
        const socketIsLive =
          currentSocket &&
          (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING);

        if (socketIsLive && activeWsUrlRef.current === nextWsUrl) {
          return;
        }

        disconnectDerivWS(currentSocket);
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
        activeWsUrlRef.current = nextWsUrl;
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
      activeWsUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    onSymbolChange?.(selectedSymbol);
  }, [onSymbolChange, selectedSymbol]);

  const handleSymbolChange = (symbol: string) => {
    const socket = socketRef.current?.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setConnectionStatus("failed");
      setSelectedSymbol(symbol);
      setPrices([]);
      setCurrentPrice(null);
      return;
    }

    // Update the tracking in the connection before sending new subscription
    socketRef.current?.setCurrentSymbol(symbol);

    socket.send(JSON.stringify({ forget_all: "ticks" }));
    socket.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));

    setSelectedSymbol(symbol);
    setPrices([]);
    setCurrentPrice(null);
  };

  const chartData = prices.map((price, index) => ({
    index: index + 1,
    price,
  }));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
            Live Market
          </p>
          <h2 className="mt-2 text-lg font-semibold">{symbolLabels[selectedSymbol]}</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedSymbol}
            onChange={(event) => handleSymbolChange(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
          <div
            className={`rounded-full border px-3 py-1 text-sm ${
              connectionStatus === "connected"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : connectionStatus === "failed"
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : "border-sky-500/40 bg-sky-500/10 text-sky-300"
            }`}
          >
            {connectionStatus === "connected"
              ? "Live"
              : connectionStatus === "failed"
                ? "Connection failed"
                : connectionStatus === "closed"
                  ? "Disconnected"
                  : "Connecting..."}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <p className="text-sm text-slate-400">Current price</p>
        <p className="mt-2 text-3xl font-semibold text-white">
          {currentPrice !== null ? currentPrice.toFixed(2) : "--"}
        </p>
        {connectionStatus === "failed" ? (
          <p className="mt-2 text-sm text-rose-400">
            The live feed could not connect for this account. Refresh and try again.
          </p>
        ) : null}
      </div>

      <div className="mt-6 h-64 rounded-2xl border border-slate-800 bg-slate-950 p-3">
        {currentPrice === null ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Connecting...
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
                stroke="#22d3ee"
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
