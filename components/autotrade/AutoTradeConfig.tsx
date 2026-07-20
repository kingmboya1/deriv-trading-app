"use client";

import { useState } from "react";
import {
  CONTRACT_TYPES,
  DEFAULT_TRADE_MODE,
  validateBarrier,
  validateDuration,
  type DurationUnit,
  type TradeMode,
} from "@/lib/contract-types";
import { BarrierInput } from "@/components/BarrierInput";
import { OffsetBarrierInput } from "@/components/OffsetBarrierInput";
import type { BotConfig } from "@/components/autotrade/hooks/use-auto-trade";

const SYMBOLS = [
  { id: "R_10",  label: "V10" },
  { id: "R_50",  label: "V50" },
  { id: "R_75",  label: "V75" },
  { id: "R_100", label: "V100" },
];

const UNIT_LABELS: Record<string, string> = { t: "t", s: "s", m: "m", d: "d" };

interface AutoTradeConfigProps {
  /** If provided, pre-fills the form (used after "Acknowledge & Tweak Config") */
  initialConfig?: BotConfig;
  onStart: (config: BotConfig) => void;
}

export default function AutoTradeConfig({ initialConfig, onStart }: AutoTradeConfigProps) {
  const init = initialConfig;

  const [tradeMode, setTradeMode]             = useState<TradeMode>(init?.tradeMode ?? DEFAULT_TRADE_MODE);
  const [contractSide, setContractSide]       = useState<0 | 1>(init?.contractSide ?? 0);
  const [symbol, setSymbol]                   = useState(init?.symbol ?? "R_10");
  const [baseStake, setBaseStake]             = useState(init?.baseStake ?? 1);
  const [multiplier, setMultiplier]           = useState(init?.multiplier ?? 2);
  const [duration, setDuration]               = useState(init?.duration ?? 1);
  const [durationUnit, setDurationUnit]       = useState<DurationUnit>(init?.durationUnit ?? "m");
  const [barrier, setBarrier]                 = useState(init?.barrier ?? "");
  const [maxConsecLosses, setMaxConsecLosses] = useState(init?.maxConsecutiveLosses ?? 3);
  const [takeProfit, setTakeProfit]           = useState(init?.takeProfitLimit ?? 10);
  const [stopLoss, setStopLoss]               = useState(init?.stopLossLimit ?? 10);
  const [maxStake, setMaxStake]               = useState(init?.maxStakeCeiling ?? 50);

  const [barrierError, setBarrierError]       = useState<string | null>(null);
  const [durationError, setDurationError]     = useState<string | null>(null);
  const [formError, setFormError]             = useState<string | null>(null);

  const contractConfig = CONTRACT_TYPES[tradeMode];

  const availableUnits =
    contractConfig.duration.kind === "tick"
      ? ["t"]
      : contractConfig.duration.units.filter((u) => u !== "t");

  const handleTradeModeChange = (mode: TradeMode) => {
    setTradeMode(mode);
    setContractSide(0);
    setBarrier("");
    setBarrierError(null);
    setDurationError(null);
    if (CONTRACT_TYPES[mode].duration.kind === "tick") {
      setDurationUnit("t");
    } else if (durationUnit === "t") {
      setDurationUnit("m");
    }
  };

  const handleSubmit = () => {
    setFormError(null);

    const durErr = validateDuration(duration, durationUnit, contractConfig);
    if (durErr) { setDurationError(durErr); return; }

    const barErr = validateBarrier(barrier, contractConfig.barrier);
    if (barErr) { setBarrierError(barErr); return; }

    if (baseStake <= 0)      { setFormError("Base stake must be greater than 0."); return; }
    if (multiplier < 1)      { setFormError("Multiplier must be ≥ 1."); return; }
    if (maxConsecLosses < 1) { setFormError("Max consecutive losses must be ≥ 1."); return; }
    if (takeProfit <= 0)     { setFormError("Take-profit must be > 0."); return; }
    if (stopLoss <= 0)       { setFormError("Stop-loss must be > 0."); return; }
    if (maxStake <= 0)       { setFormError("Max stake must be > 0."); return; }
    if (baseStake > maxStake){ setFormError("Base stake exceeds max stake ceiling."); return; }

    onStart({
      tradeMode,
      contractSide,
      symbol,
      baseStake,
      multiplier,
      duration,
      durationUnit,
      barrier,
      maxConsecutiveLosses: maxConsecLosses,
      takeProfitLimit: takeProfit,
      stopLossLimit: stopLoss,
      maxStakeCeiling: maxStake,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
          Bot Configuration
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-primary">
          Auto Trade Setup
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">

        {/* ── Left col: trade params ─────────────────────────────── */}
        <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5">
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">Trade Parameters</p>

          {/* Contract type */}
          <div>
            <p className="mb-1.5 font-display text-xs font-medium text-muted">Contract Type</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {(Object.keys(CONTRACT_TYPES) as TradeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleTradeModeChange(mode)}
                  className={`rounded-lg border px-3 py-2 font-display text-xs font-semibold transition-colors ${
                    tradeMode === mode
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-hairline bg-card text-muted hover:border-accent/30 hover:text-primary"
                  }`}
                >
                  {CONTRACT_TYPES[mode].label}
                </button>
              ))}
            </div>
          </div>

          {/* Contract side */}
          <div>
            <p className="mb-1.5 font-display text-xs font-medium text-muted">Direction</p>
            <div className="flex gap-2">
              {contractConfig.buttonLabels.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setContractSide(idx as 0 | 1)}
                  className={`flex-1 rounded-lg border py-2 font-display text-sm font-semibold transition-colors ${
                    contractSide === idx
                      ? idx === 0
                        ? "border-gain/50 bg-gain/10 text-gain"
                        : "border-loss/50 bg-loss/10 text-loss"
                      : "border-hairline bg-card text-muted hover:text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Symbol */}
          <div>
            <p className="mb-1.5 font-display text-xs font-medium text-muted">Symbol</p>
            <div className="flex flex-wrap gap-1.5">
              {SYMBOLS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSymbol(s.id)}
                  className={`rounded-full border px-3 py-1 font-mono text-xs font-medium transition-colors ${
                    symbol === s.id
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-hairline bg-card text-muted hover:border-accent/30 hover:text-primary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1 block font-display text-xs font-medium text-muted">Duration</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                step={1}
                value={duration}
                onChange={(e) => { setDuration(Number(e.target.value)); setDurationError(null); }}
                onBlur={() => setDurationError(validateDuration(duration, durationUnit, contractConfig))}
                className={`flex-1 rounded-lg border bg-card px-3 py-2 font-mono text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent/30 ${durationError ? "border-loss" : "border-hairline focus:border-accent/50"}`}
              />
              <div className="flex gap-1 rounded-lg border border-hairline bg-card p-1">
                {availableUnits.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => { setDurationUnit(u as DurationUnit); setDurationError(null); }}
                    className={`min-w-[2rem] rounded-md px-2 py-1 font-mono text-xs font-medium transition-colors ${
                      durationUnit === u ? "bg-accent/15 text-accent" : "text-muted hover:text-primary"
                    }`}
                  >
                    {UNIT_LABELS[u] ?? u}
                  </button>
                ))}
              </div>
            </div>
            {durationError && <p className="mt-1 font-sans text-xs text-loss">{durationError}</p>}
          </div>

          {/* Barrier (conditional) */}
          {contractConfig.barrier?.kind === "offset" ? (
            <OffsetBarrierInput
              barrier={contractConfig.barrier}
              value={barrier}
              onChange={(v) => { setBarrier(v); setBarrierError(null); }}
              onBlur={() => setBarrierError(validateBarrier(barrier, contractConfig.barrier))}
              error={barrierError}
            />
          ) : contractConfig.barrier ? (
            <BarrierInput
              contractConfig={contractConfig}
              value={barrier}
              onChange={(v) => { setBarrier(v); setBarrierError(null); }}
              onBlur={() => setBarrierError(validateBarrier(barrier, contractConfig.barrier))}
              error={barrierError}
            />
          ) : null}

          {/* Stake + multiplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-display text-xs font-medium text-muted">Base Stake ($)</label>
              <input
                type="number"
                min={0.35}
                step={0.01}
                value={baseStake}
                onChange={(e) => setBaseStake(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="mb-1 block font-display text-xs font-medium text-muted">Multiplier (×)</label>
              <input
                type="number"
                min={1}
                step={0.1}
                value={multiplier}
                onChange={(e) => setMultiplier(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>
          </div>
        </div>

        {/* ── Right col: safety rails ────────────────────────────── */}
        <div className="flex flex-col gap-4 rounded-2xl border border-accent/25 bg-surface p-5">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-accent">Safety Rails</p>
            <p className="mt-0.5 font-sans text-xs text-muted">Bot stops immediately when any rail is hit.</p>
          </div>

          {[
            { label: "Max Consecutive Losses", value: maxConsecLosses, set: setMaxConsecLosses, min: 1, step: 1, hint: "Stops after this many losses in a row" },
            { label: "Take-Profit Limit ($)", value: takeProfit, set: setTakeProfit, min: 0.01, step: 0.01, hint: "Stop when session P/L reaches +$X" },
            { label: "Stop-Loss Limit ($)", value: stopLoss, set: setStopLoss, min: 0.01, step: 0.01, hint: "Stop when session P/L drops to −$X" },
            { label: "Max Stake Ceiling ($)", value: maxStake, set: setMaxStake, min: 0.35, step: 0.01, hint: "Never place a trade larger than $X" },
          ].map(({ label, value, set, min, step, hint }) => (
            <div key={label}>
              <label className="mb-1 block font-display text-xs font-medium text-muted">{label}</label>
              <input
                type="number"
                min={min}
                step={step}
                value={value}
                onChange={(e) => set(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <p className="mt-0.5 font-sans text-[10px] text-muted">{hint}</p>
            </div>
          ))}

          {/* Max stake preview */}
          <div className="rounded-lg border border-hairline bg-card px-3 py-2.5">
            <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">
              Martingale Preview (worst-case stakes)
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: Math.min(maxConsecLosses, 6) }, (_, i) => {
                const s = baseStake * Math.pow(multiplier, i);
                const over = s > maxStake;
                return (
                  <span
                    key={i}
                    className={`rounded-md border px-2 py-0.5 font-mono text-[10px] tabular-nums ${
                      over
                        ? "border-loss/30 bg-loss/10 text-loss"
                        : "border-hairline bg-surface text-muted"
                    }`}
                  >
                    ${s.toFixed(2)}{over ? " ✕" : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Form-level error */}
      {formError && (
        <div className="rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 font-sans text-sm text-loss">
          {formError}
        </div>
      )}

      {/* Start button */}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full rounded-xl bg-accent px-4 py-3.5 font-display text-sm font-bold text-canvas shadow-lg shadow-accent/20 transition-opacity hover:opacity-90"
      >
        Start Bot
      </button>
    </div>
  );
}
