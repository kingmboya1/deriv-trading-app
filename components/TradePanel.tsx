"use client";

import { useEffect, useState } from "react";
import { subscribeToContract, useDerivSocketStore } from "@/lib/derivsocket";
import {
  CONTRACT_TYPES,
  DEFAULT_TRADE_MODE,
  TradeMode,
  BuyContractType,
  validateBarrier,
  validateDuration,
} from "@/lib/contract-types";
import { BarrierInput } from "@/components/BarrierInput";
import { OffsetBarrierInput } from "@/components/OffsetBarrierInput";

interface TradePanelProps {
  symbol?: string;
  currentSpot?: number | null;
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

// ── Category / two-tier selector config ─────────────────────
type Category = "directional" | "barrier" | "digits";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "directional", label: "Directional" },
  { id: "barrier",     label: "Barrier" },
  { id: "digits",      label: "Digits" },
];

const CATEGORY_MODES: Record<Category, TradeMode[]> = {
  directional: ["RISE_FALL", "OVER_UNDER"],
  barrier:     ["HIGHER_LOWER", "ONETOUCH_NOTOUCH"],
  digits:      ["EVEN_ODD", "MATCHES_DIFFERS"],
};

const MODE_CATEGORY: Record<TradeMode, Category> = {
  RISE_FALL:        "directional",
  OVER_UNDER:       "directional",
  HIGHER_LOWER:     "barrier",
  ONETOUCH_NOTOUCH: "barrier",
  EVEN_ODD:         "digits",
  MATCHES_DIFFERS:  "digits",
};

// ── Duration unit pills config ───────────────────────────────
const UNIT_LABELS: Record<string, string> = { t: "t", s: "s", m: "m", d: "d" };

export function TradePanel({ symbol = "R_10", currentSpot }: TradePanelProps) {
  const [stake, setStake] = useState(1);
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState<"m" | "s" | "t" | "d">("m");
  const [tradeMode, setTradeMode] = useState<TradeMode>(DEFAULT_TRADE_MODE);
  const [activeCategory, setActiveCategory] = useState<Category>(MODE_CATEGORY[DEFAULT_TRADE_MODE]);
  const [barrier, setBarrier] = useState("");
  const [barrierError, setBarrierError] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = useDerivSocketStore((state) => state.status);
  const connect = useDerivSocketStore((state) => state.connect);
  const request = useDerivSocketStore((state) => state.request);
  const accountCurrency = useDerivSocketStore((state) => state.auth.currency);
  // Read account type from the store — same source of truth as the WS URL.
  // Updates automatically whenever reconnect() fires for an account switch.
  const accountKind = useDerivSocketStore((state) => state.activeAccountType);

  const currentContract = CONTRACT_TYPES[tradeMode];

  const handleDurationBlur = () => {
    const error = validateDuration(duration, durationUnit, currentContract);
    setDurationError(error);
  };

  const handleBarrierBlur = () => {
    const error = validateBarrier(barrier, currentContract.barrier);
    setBarrierError(error);
  };

  useEffect(() => {
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    if (currentContract.duration.kind === "tick") {
      setDurationUnit("t");
    } else if (durationUnit === "t") {
      setDurationUnit("m");
    }
  }, [currentContract.duration.kind]);

  const handleTrade = async (contractType: BuyContractType) => {
    if (status !== "Connected") {
      setMessage("WebSocket is not connected yet.");
      return;
    }

    // Validate duration before submitting
    const durationValidationError = validateDuration(duration, durationUnit, currentContract);
    if (durationValidationError) {
      setDurationError(durationValidationError);
      setMessage(null);
      return;
    }

    const barrierValidationError = validateBarrier(barrier, currentContract.barrier);
    if (barrierValidationError) {
      setBarrierError(barrierValidationError);
      setMessage(null);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setMessageType(null);
    setDurationError(null);
    setBarrierError(null);

    const currency = accountCurrency?.toUpperCase();

    if (!currency) {
      setMessage("Account currency is not available yet.");
      setIsSubmitting(false);
      return;
    }

    try {
      const proposalPayload: Record<string, unknown> = {
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

      if (currentContract.barrier) {
        proposalPayload.barrier = barrier.trim();
      }

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
      const verb =
        contractType === "CALL"
          ? "Rise"
          : contractType === "PUT"
          ? "Fall"
          : contractType === "HIGHER"
          ? "Higher"
          : contractType === "LOWER"
          ? "Lower"
          : contractType === "DIGITEVEN"
          ? "Even"
          : contractType === "DIGITODD"
          ? "Odd"
          : contractType === "DIGITOVER"
          ? "Over"
          : contractType === "DIGITUNDER"
          ? "Under"
          : contractType === "DIGITMATCH"
          ? "Matches"
          : contractType === "DIGITDIFF"
          ? "Differs"
          : contractType === "ONETOUCH"
          ? "Touch"
          : contractType === "NOTOUCH"
          ? "No Touch"
          : "Trade";

      setMessage(
        `Bought ${verb} contract #${buy?.contract_id ?? "-"} for payout ${payoutText}`
      );
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trade failed.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived values for the two-tier selector ────────────────
  const modesInCategory = CATEGORY_MODES[activeCategory];

  const handleCategoryClick = (cat: Category) => {
    setActiveCategory(cat);
    // Auto-select first mode in the new category
    const firstMode = CATEGORY_MODES[cat][0];
    setTradeMode(firstMode);
    setBarrier("");
    setBarrierError(null);
    setDurationError(null);
  };

  const handleModeClick = (mode: TradeMode) => {
    setTradeMode(mode);
    setBarrier("");
    setBarrierError(null);
    setDurationError(null);
  };

  // ── Duration unit pills ──────────────────────────────────────
  const availableUnits =
    currentContract.duration.kind === "tick"
      ? ["t"]
      : currentContract.duration.units.filter((u) => u !== "t");

  // ── Render ───────────────────────────────────────────────────
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">

      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-primary">Trade</h2>
        <div className="flex items-center gap-2">
          {/* WS status badge */}
          <span
            className={`rounded-md px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide ${
              status === "Connected"
                ? "bg-gain/10 text-gain"
                : status === "Reconnecting..."
                ? "bg-accent/10 text-accent"
                : "bg-card text-muted"
            }`}
          >
            {status}
          </span>
          {/* Account kind badge */}
          <span
            className={`rounded-md px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide ${
              accountKind === "real"
                ? "bg-gain/10 text-gain"
                : accountKind === "demo"
                ? "bg-loss/10 text-loss"
                : "bg-card text-muted"
            }`}
            title={accountKind === "unknown" ? "Account type unknown" : `Using ${accountKind} account`}
          >
            {accountKind === "unknown" ? "ACCT?" : accountKind.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── Tier 1: Category tabs ────────────────────────────── */}
      <div className="mt-4 flex gap-1 rounded-xl bg-card p-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryClick(cat.id)}
            className={`flex-1 rounded-lg py-1.5 font-display text-xs font-semibold transition-colors ${
              activeCategory === cat.id
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:text-primary"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Tier 2: Contract type buttons within category ───── */}
      <div className="mt-2 flex gap-1.5">
        {modesInCategory.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => handleModeClick(mode)}
            className={`flex-1 rounded-lg border px-3 py-1.5 font-display text-xs font-semibold transition-colors ${
              tradeMode === mode
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-hairline bg-card text-muted hover:border-muted/40 hover:text-primary"
            }`}
          >
            {CONTRACT_TYPES[mode].label}
          </button>
        ))}
      </div>

      {/* ── Form fields ─────────────────────────────────────── */}
      <div className="mt-4 space-y-3">

        {/* Stake */}
        <div>
          <label className="mb-1 block font-display text-xs font-medium text-muted">
            Stake
          </label>
          <input
            type="number"
            min="0.35"
            step="0.01"
            value={stake}
            onChange={(event) => setStake(Number(event.target.value))}
            className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary placeholder-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>

        {/* Duration + unit pills */}
        <div>
          <label className="mb-1 block font-display text-xs font-medium text-muted">
            Duration
          </label>
          <div className="flex items-stretch gap-2">
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
              className={`flex-1 rounded-lg border bg-card px-3 py-2 font-mono text-sm text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent/30 ${
                durationError ? "border-loss focus:border-loss" : "border-hairline focus:border-accent/50"
              }`}
            />
            {/* Pill toggles for duration unit */}
            <div className="flex gap-1 rounded-lg border border-hairline bg-card p-1">
              {availableUnits.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => {
                    setDurationUnit(unit as "m" | "s" | "t" | "d");
                    setDurationError(null);
                  }}
                  className={`min-w-[2rem] rounded-md px-2 py-1 font-mono text-xs font-medium transition-colors ${
                    durationUnit === unit
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:text-primary"
                  }`}
                >
                  {UNIT_LABELS[unit] ?? unit}
                </button>
              ))}
            </div>
          </div>
          {durationError && (
            <p className="mt-1 font-sans text-xs text-loss">{durationError}</p>
          )}
        </div>

        {/* Barrier input — rendered by existing components, styling applied via className passthrough */}
        {currentContract.barrier?.kind === "offset" ? (
          <OffsetBarrierInput
            barrier={currentContract.barrier}
            value={barrier}
            onChange={(value) => {
              setBarrier(value);
              setBarrierError(null);
            }}
            onBlur={handleBarrierBlur}
            error={barrierError}
            currentSpot={currentSpot ?? null}
          />
        ) : (
          <>
            <BarrierInput
              contractConfig={currentContract}
              value={barrier}
              onChange={(value) => {
                setBarrier(value);
                setBarrierError(null);
              }}
              onBlur={handleBarrierBlur}
              error={barrierError}
            />
            {currentContract.barrier ? (
              <p className="font-sans text-xs text-muted">
                Digit barrier rules are validated by Deriv during proposal submission. Any invalid value will return a server error.
              </p>
            ) : null}
          </>
        )}

        {/* Buy / Sell action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => void handleTrade(currentContract.contractTypes[0])}
            disabled={isSubmitting || status !== "Connected" || durationError !== null}
            className="flex-1 rounded-lg bg-gain px-4 py-2.5 font-display text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Placing…" : currentContract.buttonLabels[0]}
          </button>
          <button
            type="button"
            onClick={() => void handleTrade(currentContract.contractTypes[1])}
            disabled={isSubmitting || status !== "Connected" || durationError !== null}
            className="flex-1 rounded-lg bg-loss px-4 py-2.5 font-display text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Placing…" : currentContract.buttonLabels[1]}
          </button>
        </div>

        {/* Status message */}
        {message ? (
          <div
            className={`rounded-lg border px-3 py-2.5 font-sans text-sm ${
              messageType === "error"
                ? "border-loss/30 bg-loss/10 text-loss"
                : "border-gain/30 bg-gain/10 text-gain"
            }`}
          >
            {/* Contract ID and payout rendered in mono */}
            <span className="font-mono">{message}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
