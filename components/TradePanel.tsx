"use client";

import { useEffect, useState } from "react";
import { useDerivSocketStore } from "@/lib/derivsocket";
interface TradePanelProps {
  symbol?: string;
}

type ProposalResponse = {
  id?: string;
  ask_price?: number;
  payout?: number;
};

type BuyResponse = {
  contract_id?: number;
  buy_price?: number;
  payout?: number;
};

export function TradePanel({ symbol = "R_10" }: TradePanelProps) {
  const [stake, setStake] = useState(1);
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState<"m" | "s">("m");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = useDerivSocketStore((state) => state.status);
  const connect = useDerivSocketStore((state) => state.connect);
  const request = useDerivSocketStore((state) => state.request);
  const accountCurrency = useDerivSocketStore((state) => state.auth.currency ?? state.currency);

  useEffect(() => {
    void connect();
  }, [connect]);

  const handleTrade = async (contractType: "CALL" | "PUT") => {
    if (status !== "Connected") {
      setMessage("WebSocket is not connected yet.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const currency = accountCurrency?.toUpperCase();

    if (!currency) {
      setMessage("Account currency is not available yet.");
      setIsSubmitting(false);
      return;
    }

    try {
      const proposalPayload = {
        proposal: 1,
        amount: Number(stake),
        basis: "stake",
        contract_type: contractType,
        currency,
        duration: Number(duration),
        duration_unit: durationUnit,
        underlying_symbol: symbol,
        subscribe: 1,
      };

      const proposalResponse = await request<{ proposal?: ProposalResponse }>(proposalPayload);
      const proposal = proposalResponse.proposal;

      if (!proposal || !proposal.id || proposal.ask_price === undefined) {
        throw new Error("Proposal was not returned.");
      }

      const buyResponse = await request<{ buy?: BuyResponse }>({
        buy: proposal.id,
        price: proposal.ask_price,
      });
      const buy = buyResponse.buy;

      setMessage(
        `Bought ${contractType === "CALL" ? "Rise" : "Fall"} contract #${buy?.contract_id ?? "-"} for payout ${buy?.payout?.toFixed(2) ?? "-"}`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trade failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Trade Panel</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm ${
            status === "Connected"
              ? "bg-emerald-500/10 text-emerald-300"
              : status === "Reconnecting..."
                ? "bg-amber-500/10 text-amber-300"
                : "bg-slate-800 text-slate-300"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-sm text-slate-300">
          <span className="mb-1 block">Stake</span>
          <input
            type="number"
            min="0.35"
            step="0.01"
            value={stake}
            onChange={(event) => setStake(Number(event.target.value))}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex-1 text-sm text-slate-300">
            <span className="mb-1 block">Duration</span>
            <input
              type="number"
              min="1"
              step="1"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>

          <label className="w-24 text-sm text-slate-300">
            <span className="mb-1 block">Unit</span>
            <select
              value={durationUnit}
              onChange={(event) => setDurationUnit(event.target.value as "m" | "s")}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              <option value="m">m</option>
              <option value="s">s</option>
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleTrade("CALL")}
            disabled={isSubmitting || status !== "Connected"}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Placing..." : "Rise"}
          </button>
          <button
            type="button"
            onClick={() => void handleTrade("PUT")}
            disabled={isSubmitting || status !== "Connected"}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Placing..." : "Fall"}
          </button>
        </div>

        {message ? (
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
            {message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
