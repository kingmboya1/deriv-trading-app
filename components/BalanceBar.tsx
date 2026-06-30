"use client";

import { useEffect, useState } from "react";

interface BalanceBarProps {
  realBalance: number;
  demoBalance: number;
  wsUrl?: string;
  connectedAccountType?: "real" | "demo";
}

export default function BalanceBar({ realBalance, demoBalance, wsUrl, connectedAccountType = "demo" }: BalanceBarProps) {
  const [activeTab, setActiveTab] = useState<"real" | "demo">("real");
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const balance =
    activeTab === "real"
      ? connectedAccountType === "real"
        ? (liveBalance ?? realBalance)
        : realBalance
      : connectedAccountType === "demo"
        ? (liveBalance ?? demoBalance)
        : demoBalance;

  useEffect(() => {
    if (!wsUrl) {
      return;
    }

    const socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data as string) as { balance?: { balance?: number | string; currency?: string } };
        const incomingBalance = payload.balance?.balance;

        if (typeof incomingBalance === "number" || typeof incomingBalance === "string") {
          const parsedBalance = Number.parseFloat(String(incomingBalance));
          if (Number.isFinite(parsedBalance)) {
            setLiveBalance(parsedBalance);
          }
        }
      } catch {
        // Ignore malformed payloads.
      }
    });

    return () => {
      socket.close();
    };
  }, [wsUrl]);

  const formattedBalance = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(balance ?? 0);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Balance
            </p>
            <p className="mt-2 text-2xl font-semibold">{formattedBalance}</p>
          </div>
          <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
            Live
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("real")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "real"
                ? "bg-sky-500 text-white"
                : "border border-slate-700 bg-slate-800 text-slate-300"
            }`}
          >
            Real
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("demo")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "demo"
                ? "bg-sky-500 text-white"
                : "border border-slate-700 bg-slate-800 text-slate-300"
            }`}
          >
            Demo
          </button>
        </div>
      </div>
    </section>
  );
}
