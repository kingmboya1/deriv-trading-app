"use client";

import { useEffect, useState } from "react";
import { useDerivSocketStore, sellContract, isContractSettled } from "@/lib/derivsocket";

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
  const [pendingSellContractIds, setPendingSellContractIds] = useState<number[]>([]);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellErrorType, setSellErrorType] = useState<"price_mismatch" | "contract_not_found" | "unknown" | null>(null);

  const trades = Object.values(portfolio) as TradeRecord[];

  useEffect(() => {
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    if (!confirmSellModal) {
      return;
    }

    const matchingTrade = trades.find((trade) => {
      const contractId = trade.contract_id ?? trade.contractId ?? trade.id;
      return typeof contractId === "number" && contractId === confirmSellModal.contractId;
    });

    if (matchingTrade && isContractSettled(matchingTrade)) {
      setConfirmSellModal(null);
      setSellError(null);
      setSellErrorType(null);
    }
  }, [confirmSellModal, trades]);

  const handleSellClick = (contractId: number, bidPrice: number, currentProfit: number) => {
    setSellError(null);
    setSellErrorType(null);
    setConfirmSellModal({ contractId, bidPrice, currentProfit });
  };

  const handleConfirmSell = async () => {
    if (!confirmSellModal) return;

    const contractId = confirmSellModal.contractId;
    setPendingSellContractIds((previous) => (previous.includes(contractId) ? previous : [...previous, contractId]));
    setSellError(null);
    setSellErrorType(null);

    try {
      const result = await sellContract(contractId);

      if (!result.success) {
        setSellError(result.error ?? "Sell request failed");
        setSellErrorType(result.errorType ?? "unknown");
        return;
      }

      // Success - close modal
      setConfirmSellModal(null);
    } catch (error) {
      setSellError(error instanceof Error ? error.message : "Unknown error");
      setSellErrorType("unknown");
    } finally {
      setPendingSellContractIds((previous) => previous.filter((id) => id !== contractId));
    }
  };

  const handleRetry = () => {
    setSellError(null);
    setSellErrorType(null);
    // Modal stays open for retry
  };

  const isCurrentContractSelling = confirmSellModal
    ? pendingSellContractIds.includes(confirmSellModal.contractId)
    : false;

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-muted">
            Portfolio
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-primary">
            Open trades
          </h2>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="mt-4 rounded-lg border border-hairline bg-card px-4 py-3 font-sans text-sm text-muted">
          No trades yet
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-hairline">
                <th className="px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">Contract ID</th>
                <th className="px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">Type</th>
                <th className="px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">Buy Price</th>
                <th className="px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">Payout</th>
                <th className="px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">P/L</th>
                <th className="px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => {
                const buyPrice = parseNumber(trade.buy_price ?? trade.buyPrice);
                const payout = parseNumber(trade.payout);
                const profit = parseNumber(trade.profit ?? trade.profit_loss ?? trade.profitLoss);
                const contractId = trade.contract_id ?? trade.contractId ?? trade.id;
                const bidPrice = parseNumber((trade as Record<string, unknown>).bid_price);
                const isContractClosed = isContractSettled(trade);
                const canSell = typeof contractId === "number" && bidPrice !== null && bidPrice > 0 && !isContractClosed;
                const isThisContractSelling = typeof contractId === "number" && pendingSellContractIds.includes(contractId);
                const profitPositive = profit !== null && profit >= 0;

                return (
                  <tr key={`${contractId}-${index}`} className="border-b border-hairline last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted">{contractId}</td>
                    <td className="px-3 py-2.5 font-display text-sm font-medium text-primary">{inferTradeType(trade)}</td>
                    <td className="px-3 py-2.5 font-mono text-sm tabular-nums text-primary">{formatCurrency(buyPrice)}</td>
                    <td className="px-3 py-2.5 font-mono text-sm tabular-nums text-primary">{formatCurrency(payout)}</td>
                    <td className={`px-3 py-2.5 font-mono text-sm tabular-nums font-medium ${
                      profit === null ? "text-muted" : profitPositive ? "text-gain" : "text-loss"
                    }`}>
                      {formatCurrency(profit)}
                    </td>
                    <td className="px-3 py-2.5">
                      {canSell ? (
                        <button
                          onClick={() => handleSellClick(contractId, bidPrice, profit ?? 0)}
                          disabled={isThisContractSelling}
                          className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 font-display text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
                        >
                          Sell
                        </button>
                      ) : (
                        <span className="font-sans text-xs text-muted">
                          {isContractClosed ? "Settled" : "—"}
                        </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-primary">Confirm Sell</h3>

            <div className="mt-4 space-y-2.5">
              <div className="rounded-lg border border-hairline bg-card px-3 py-2.5">
                <p className="font-display text-xs font-medium text-muted">Contract ID</p>
                <p className="mt-0.5 font-mono text-sm tabular-nums text-primary">
                  {confirmSellModal.contractId}
                </p>
              </div>

              <div className="rounded-lg border border-hairline bg-card px-3 py-2.5">
                <p className="font-display text-xs font-medium text-muted">Current Bid Price</p>
                <p className="mt-0.5 font-mono text-sm tabular-nums text-primary">
                  ${confirmSellModal.bidPrice.toFixed(2)}
                </p>
              </div>

              <div
                className={`rounded-lg border px-3 py-2.5 ${
                  confirmSellModal.currentProfit >= 0
                    ? "border-gain/25 bg-gain/10"
                    : "border-loss/25 bg-loss/10"
                }`}
              >
                <p className="font-display text-xs font-medium text-muted">Profit / Loss</p>
                <p
                  className={`mt-0.5 font-mono text-sm tabular-nums font-medium ${
                    confirmSellModal.currentProfit >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {formatCurrency(confirmSellModal.currentProfit)}
                </p>
              </div>

              {sellError && (
                <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2.5">
                  <p className="font-sans text-sm text-loss">
                    {sellError}
                    {sellErrorType === "price_mismatch" && (
                      <span className="mt-1.5 block font-sans text-xs text-loss/70">
                        The market bid changed. Click Retry to get the fresh price.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              {sellError ? (
                <>
                  <button
                    onClick={handleRetry}
                    disabled={isCurrentContractSelling}
                    className="flex-1 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 font-display text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
                  >
                    {isCurrentContractSelling ? "Retrying…" : "Retry"}
                  </button>
                  <button
                    onClick={() => setConfirmSellModal(null)}
                    disabled={isCurrentContractSelling}
                    className="flex-1 rounded-lg border border-hairline px-4 py-2 font-display text-sm font-semibold text-muted transition hover:border-muted/40 hover:text-primary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleConfirmSell}
                    disabled={isCurrentContractSelling}
                    className="flex-1 rounded-lg bg-gain px-4 py-2 font-display text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {isCurrentContractSelling ? "Selling…" : "Confirm Sell"}
                  </button>
                  <button
                    onClick={() => setConfirmSellModal(null)}
                    disabled={isCurrentContractSelling}
                    className="flex-1 rounded-lg border border-hairline px-4 py-2 font-display text-sm font-semibold text-muted transition hover:border-muted/40 hover:text-primary disabled:opacity-50"
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
