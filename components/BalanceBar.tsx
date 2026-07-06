"use client";

import { useEffect } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";

interface BalanceBarProps {
  realBalance: number;
  demoBalance: number;
  connectedAccountType?: "real" | "demo" | "unknown";
}

export default function BalanceBar({ realBalance, demoBalance, connectedAccountType = "unknown" }: BalanceBarProps) {
  const storeBalance = useDerivSocketStore((s) => s.balance);
  const connect = useDerivSocketStore((s) => s.connect);

  useEffect(() => {
    void connect();
  }, [connect]);

  const liveBalance = storeBalance ?? null;

  const balance =
    connectedAccountType === "real"
      ? liveBalance ?? realBalance
      : connectedAccountType === "demo"
        ? liveBalance ?? demoBalance
        : liveBalance ?? demoBalance ?? realBalance;

  const formattedBalance = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(balance ?? 0);

  const statusText =
    connectedAccountType === "real"
      ? "Connected to REAL"
      : connectedAccountType === "demo"
        ? "Connected to DEMO"
        : "Connected to UNKNOWN";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Balance</p>
            <p className="mt-2 text-2xl font-semibold">{formattedBalance}</p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-300">
            {statusText}
          </div>
        </div>
      </div>
    </section>
  );
}
