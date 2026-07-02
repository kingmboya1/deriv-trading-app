"use client";

import { useEffect } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";

type TradeRecord = {
  contract_id?: number | string;
  contractId?: number | string;
  id?: number | string;
  type?: string;
  contract_type?: string;
  buy_price?: number | string;
  buyPrice?: number | string;
  payout?: number | string;
  profit?: number | string;
  profit_loss?: number | string;
  profitLoss?: number | string;
  [key: string]: unknown;
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatCurrency(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function inferTradeType(record: TradeRecord): string {
  const rawType = record.contract_type ?? record.type ?? "";
  const normalized = String(rawType).toUpperCase();

  if (normalized === "CALL") {
    return "Rise";
  }

  if (normalized === "PUT") {
    return "Fall";
  }

  return rawType ? String(rawType) : "-";
}

export default function Portfolio() {
  const connect = useDerivSocketStore((state) => state.connect);
  const portfolio = useDerivSocketStore((state) => state.portfolio);

  useEffect(() => {
    void connect();
  }, [connect]);

  const trades = Object.values(portfolio) as TradeRecord[];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Portfolio</p>
          <h2 className="mt-2 text-xl font-semibold">Recent trades</h2>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          No trades yet
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-3 py-2">Contract ID</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Buy Price</th>
                <th className="px-3 py-2">Payout</th>
                <th className="px-3 py-2">Profit/Loss</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => {
                const buyPrice = parseNumber(trade.buy_price ?? trade.buyPrice);
                const payout = parseNumber(trade.payout);
                const profit = parseNumber(trade.profit ?? trade.profit_loss ?? trade.profitLoss);
                const contractId = trade.contract_id ?? trade.contractId ?? trade.id ?? index + 1;

                return (
                  <tr key={`${contractId}-${index}`} className="border-b border-slate-800 text-slate-200">
                    <td className="px-3 py-2">{contractId}</td>
                    <td className="px-3 py-2">{inferTradeType(trade)}</td>
                    <td className="px-3 py-2">{formatCurrency(buyPrice)}</td>
                    <td className="px-3 py-2">{formatCurrency(payout)}</td>
                    <td className="px-3 py-2">{formatCurrency(profit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
