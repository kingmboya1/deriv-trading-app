"use client";

import { useState } from "react";

interface AutoTradeConfigProps {
  onStart: (takeProfit: number, maxLoss: number) => void;
}

export default function AutoTradeConfig({ onStart }: AutoTradeConfigProps) {
  const [takeProfit, setTakeProfit] = useState(80);
  const [maxLoss, setMaxLoss]       = useState(12);
  const [error, setError]           = useState<string | null>(null);

  const handleStart = () => {
    if (takeProfit <= 0) { setError("Take profit must be greater than 0."); return; }
    if (maxLoss <= 0)    { setError("Max loss must be greater than 0."); return; }
    setError(null);
    onStart(takeProfit, maxLoss);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
          D&apos;Alembert Strategy
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-primary">Auto Trade</h2>
      </div>

      {/* Hardcoded info */}
      <div className="rounded-2xl border border-accent/25 bg-surface p-5">
        <p className="mb-4 font-display text-xs font-semibold uppercase tracking-widest text-accent">
          Bot Configuration
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Symbol",    value: "Volatility 50 (R_50)" },
            { label: "Contract",  value: "Digits — Differs" },
            { label: "Duration",  value: "1 Tick" },
            { label: "Base Stake",value: "$10.00" },
            { label: "Strategy",  value: "D'Alembert (+$1 / −$1)" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-hairline bg-card px-4 py-3">
              <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</p>
              <p className="mt-1 font-mono text-sm font-medium text-primary">{value}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 font-sans text-xs leading-relaxed text-muted">
          After each <span className="text-gain">win</span> stake decreases by $1 (min $10).
          After each <span className="text-loss">loss</span> stake increases by $1.
          Bot stops when your profit or loss limit is hit.
        </p>
      </div>

      {/* User-configurable limits */}
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <p className="mb-4 font-display text-xs font-semibold uppercase tracking-widest text-muted">
          Your Limits
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block font-display text-xs font-medium text-muted">
              Take Profit ($)
            </label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={takeProfit}
              onChange={(e) => { setTakeProfit(Number(e.target.value)); setError(null); }}
              className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
            <p className="mt-0.5 font-sans text-[10px] text-muted">Stop when P/L reaches +$X</p>
          </div>
          <div>
            <label className="mb-1 block font-display text-xs font-medium text-muted">
              Max Loss ($)
            </label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={maxLoss}
              onChange={(e) => { setMaxLoss(Number(e.target.value)); setError(null); }}
              className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
            <p className="mt-0.5 font-sans text-[10px] text-muted">Stop when P/L drops to −$X</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 font-sans text-sm text-loss">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        className="w-full rounded-xl bg-accent px-4 py-3.5 font-display text-sm font-bold text-canvas shadow-lg shadow-accent/20 transition-opacity hover:opacity-90"
      >
        Start Bot
      </button>
    </div>
  );
}
