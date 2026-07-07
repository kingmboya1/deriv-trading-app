"use client";

import { useEffect, useState } from "react";
import { useDerivSocketStore, sellContract } from "@/lib/derivsocket";

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
  const [confirmSellModal, setConfirmSellModal] = useState<{ contractId: number; bidPrice: number; currentProfit: number } | null>(null);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellErrorType, setSellErrorType] = useState<"price_mismatch" | "contract_not_found" | "unknown" | null>(null);

  useEffect(() => {
    void connect();
  }, [connect]);

  const trades = Object.values(portfolio) as TradeRecord[];

  const handleSellClick = (contractId: number, bidPrice: number, currentProfit: number) => {
    setSellError(null);
    setSellErrorType(null);
    setConfirmSellModal({ contractId, bidPrice, currentProfit });
  };

  const handleConfirmSell = async () => {
    if (!confirmSellModal) return;

    setSellLoading(true);
    setSellError(null);
    setSellErrorType(null);

    try {
      const result = await sellContract(confirmSellModal.contractId);

      if (!result.success) {
        setSellError(result.error ?? "Sell request failed");
        setSellErrorType(result.errorType ?? "unknown");
        setSellLoading(false);
        // Keep modal open so user can retry
        return;
      }

      // Success - close modal
      setConfirmSellModal(null);
    } catch (error) {
      setSellError(error instanceof Error ? error.message : "Unknown error");
      setSellErrorType("unknown");
      setSellLoading(false);
    }
  };

  const handleRetry = () => {
    setSellError(null);
    setSellErrorType(null);
    // Modal stays open for retry
  };

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
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => {
                const buyPrice = parseNumber(trade.buy_price ?? trade.buyPrice);
                const payout = parseNumber(trade.payout);
                const profit = parseNumber(trade.profit ?? trade.profit_loss ?? trade.profitLoss);
                const contractId = trade.contract_id ?? trade.contractId ?? trade.id;
                const bidPrice = parseNumber((trade as Record<string, unknown>).bid_price);

                return (
                  <tr key={`${contractId}-${index}`} className="border-b border-slate-800 text-slate-200">
                    <td className="px-3 py-2">{contractId}</td>
                    <td className="px-3 py-2">{inferTradeType(trade)}</td>
                    <td className="px-3 py-2">{formatCurrency(buyPrice)}</td>
                    <td className="px-3 py-2">{formatCurrency(payout)}</td>
                    <td className="px-3 py-2">{formatCurrency(profit)}</td>
                    <td className="px-3 py-2">
                      {typeof contractId === "number" && bidPrice !== null ? (
                        <button
                          onClick={() => handleSellClick(contractId, bidPrice, profit ?? 0)}
                          className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
                        >
                          Sell
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sell Confirmation Modal */}
      {confirmSellModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white">Confirm Sell</h3>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <p className="text-sm text-slate-400">Contract ID</p>
                <p className="mt-1 font-semibold text-white">{confirmSellModal.contractId}</p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <p className="text-sm text-slate-400">Current Bid Price</p>
                <p className="mt-1 font-semibold text-white">${confirmSellModal.bidPrice.toFixed(2)}</p>
              </div>

              <div
                className={`rounded-lg border p-3 ${
                  confirmSellModal.currentProfit >= 0
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-rose-500/30 bg-rose-500/10"
                }`}
              >
                <p className="text-sm text-slate-400">Profit/Loss</p>
                <p
                  className={`mt-1 font-semibold ${
                    confirmSellModal.currentProfit >= 0
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  {formatCurrency(confirmSellModal.currentProfit)}
                </p>
              </div>

              {sellError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
                  <p className="text-sm text-rose-300">
                    {sellError}
                    {sellErrorType === "price_mismatch" && (
                      <span className="block mt-2 text-xs text-rose-200">
                        The market bid changed. Click Retry to get the fresh price.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              {sellError && sellErrorType === "price_mismatch" ? (
                <>
                  <button
                    onClick={handleRetry}
                    disabled={sellLoading}
                    className="flex-1 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
                  >
                    {sellLoading ? "Retrying..." : "Retry"}
                  </button>
                  <button
                    onClick={() => setConfirmSellModal(null)}
                    disabled={sellLoading}
                    className="flex-1 rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleConfirmSell}
                    disabled={sellLoading}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {sellLoading ? "Selling..." : "Confirm Sell"}
                  </button>
                  <button
                    onClick={() => setConfirmSellModal(null)}
                    disabled={sellLoading}
                    className="flex-1 rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
