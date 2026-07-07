"use client";

import { useEffect, useState } from "react";
import { subscribeToContract, markContractBought, useDerivSocketStore } from "@/lib/derivsocket";
interface TradePanelProps {
  symbol?: string;
  wsUrl?: string;
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
  const [durationError, setDurationError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = useDerivSocketStore((state) => state.status);
  const connect = useDerivSocketStore((state) => state.connect);
  const request = useDerivSocketStore((state) => state.request);
  const accountCurrency = useDerivSocketStore((state) => state.auth.currency);
  const [accountKind, setAccountKind] = useState<"real" | "demo" | "unknown">("unknown");

  // Duration validation rules per unit (Deriv constraints for binary options)
  const durationRules = {
    s: { min: 15, max: 3600, label: "15-3600 seconds" },
    m: { min: 1, max: 1440, label: "1-1440 minutes" },
  };

  const validateDuration = (dur: number, unit: "m" | "s"): string | null => {
    const rules = durationRules[unit];

    if (dur < rules.min || dur > rules.max) {
      return `Duration must be ${rules.label} for ${unit === "s" ? "seconds" : "minutes"}`;
    }

    return null;
  };

  const handleDurationBlur = () => {
    const error = validateDuration(duration, durationUnit);
    setDurationError(error);
  };

  useEffect(() => {
    void connect();
  }, [connect]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch("/api/ws-token");
        if (!mounted) return;
        if (!res.ok) {
          setAccountKind("unknown");
          return;
        }
        const payload = (await res.json()) as { wsUrl?: string };
        const wsUrl = payload.wsUrl;
        if (typeof wsUrl === "string") {
          setAccountKind(wsUrl.includes("/demo") ? "demo" : "real");
        } else {
          setAccountKind("unknown");
        }
      } catch {
        if (!mounted) return;
        setAccountKind("unknown");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleTrade = async (contractType: "CALL" | "PUT") => {
    if (status !== "Connected") {
      setMessage("WebSocket is not connected yet.");
      return;
    }

    // Validate duration before submitting
    const durationValidationError = validateDuration(duration, durationUnit);
    if (durationValidationError) {
      setDurationError(durationValidationError);
      setMessage(null);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setDurationError(null);

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

      const authState = useDerivSocketStore.getState().auth;
      console.log("BUY_RESPONSE_RAW:", buyResponse, "authAtBuy:", authState);

      if (buy?.contract_id) {
        markContractBought(buy.contract_id);

        const existing = useDerivSocketStore.getState().portfolio || {};
        const next = {
          ...existing,
          [buy.contract_id]: {
            contract_id: buy.contract_id,
            contract_type: "", // unknown until server updates, will be updated later
            buy_price: buy.buy_price ?? 0,
            payout: buy.payout ?? 0,
            profit: 0,
            current_spot: 0,
            is_sold: false,
          },
        };

        useDerivSocketStore.setState({ portfolio: next });
        subscribeToContract(buy.contract_id);
      }

      const payoutNum = buy?.payout !== undefined && buy?.payout !== null ? Number(buy.payout) : NaN;
      const payoutText = Number.isFinite(payoutNum) ? payoutNum.toFixed(2) : "-";

      setMessage(
        `Bought ${contractType === "CALL" ? "Rise" : "Fall"} contract #${buy?.contract_id ?? "-"} for payout ${payoutText}`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trade failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Trade Panel</h2>
        <div className="flex items-center gap-2">
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
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              accountKind === "real"
                ? "bg-emerald-500/10 text-emerald-300"
                : accountKind === "demo"
                  ? "bg-rose-500/10 text-rose-300"
                  : "bg-slate-800 text-slate-300"
            }`}
            title={accountKind === "unknown" ? "Account type unknown" : `Using ${accountKind} account`}
          >
            {accountKind === "unknown" ? "ACCOUNT?" : accountKind.toUpperCase()}
          </span>
        </div>
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
              onChange={(event) => {
                setDuration(Number(event.target.value));
                setDurationError(null);
              }}
              onBlur={handleDurationBlur}
              className={`w-full rounded-xl border px-3 py-2 text-white bg-slate-950 ${
                durationError ? "border-rose-500" : "border-slate-700"
              }`}
            />
            {durationError && <p className="mt-1 text-xs text-rose-400">{durationError}</p>}
          </label>

          <label className="w-24 text-sm text-slate-300">
            <span className="mb-1 block">Unit</span>
            <select
              value={durationUnit}
              onChange={(event) => {
                setDurationUnit(event.target.value as "m" | "s");
                setDurationError(null);
              }}
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
            disabled={isSubmitting || status !== "Connected" || durationError !== null}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Placing..." : "Rise"}
          </button>
          <button
            type="button"
            onClick={() => void handleTrade("PUT")}
            disabled={isSubmitting || status !== "Connected" || durationError !== null}
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
