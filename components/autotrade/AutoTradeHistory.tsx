"use client";

import type { TradeRecord } from "@/components/autotrade/hooks/use-auto-trade";

interface AutoTradeHistoryProps {
  trades: TradeRecord[];
}

const RESULT_LABEL: Record<string, string> = {
  win: "Win",
  loss: "Loss",
  pending: "Pending",
};

export default function AutoTradeHistory({ trades }: AutoTradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-card px-4 py-6 text-center font-mono text-xs text-muted">
        No trades placed yet this session.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline">
      <table className="min-w-full text-left">
        <thead>
          <tr className="border-b border-hairline bg-card">
            {["Symbol", "Type", "Stake", "Result", "Net P/L"].map((h) => (
              <th
                key={h}
                className="px-3 py-2 font-display text-[10px] font-semibold uppercase tracking-widest text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const isPending = t.result === "pending";
            const isWin = t.result === "win";
            return (
              <tr
                key={t.id}
                className="border-b border-hairline last:border-0 transition-colors hover:bg-card/60"
              >
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-primary">
                  {t.symbol}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted">
                  {t.contractType}
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-primary">
                  ${t.stake.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                      isPending
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : isWin
                        ? "border-gain/30 bg-gain/10 text-gain"
                        : "border-loss/30 bg-loss/10 text-loss"
                    }`}
                  >
                    {RESULT_LABEL[t.result]}
                  </span>
                </td>
                <td
                  className={`px-3 py-2 font-mono text-xs tabular-nums font-medium ${
                    isPending
                      ? "text-muted"
                      : t.profit >= 0
                      ? "text-gain"
                      : "text-loss"
                  }`}
                >
                  {isPending
                    ? "—"
                    : `${t.profit >= 0 ? "+" : ""}$${t.profit.toFixed(2)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
