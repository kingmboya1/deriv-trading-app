import { BarrierConfig } from "@/lib/contract-types";

interface OffsetBarrierInputProps {
  barrier: BarrierConfig;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  currentSpot?: number | null;
}

const OFFSET_PATTERN = /^(?=.{1,20}$)[+-]?[0-9]+(?:\.[0-9]*)?$/;

export function OffsetBarrierInput({
  barrier,
  value,
  onChange,
  onBlur,
  error,
  currentSpot,
}: OffsetBarrierInputProps) {
  const trimmedValue = value.trim();
  const numericValue = Number(trimmedValue);
  const hasValidNumber = OFFSET_PATTERN.test(trimmedValue) && Number.isFinite(numericValue);
  const formattedOffset = hasValidNumber
    ? numericValue >= 0
      ? `+${numericValue.toString()}`
      : numericValue.toString()
    : trimmedValue;
  const spotValue = currentSpot ?? null;
  const targetPrice = spotValue !== null && hasValidNumber ? spotValue + numericValue : null;

  return (
    <label className="block">
      <span className="mb-1 block font-display text-xs font-medium text-muted">
        {barrier.label}
      </span>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-muted">
          ±
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={barrier.placeholder}
          className={`w-full rounded-lg border bg-card px-3 py-2 pl-9 font-mono text-sm text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent/30 ${
            error
              ? "border-loss focus:border-loss"
              : "border-hairline focus:border-accent/50"
          }`}
        />
      </div>
      <p className="mt-1.5 font-sans text-xs text-muted">
        Enter a relative price offset from the current spot, e.g. +1 or −1.
      </p>
      {spotValue !== null ? (
        <p className="mt-1 font-mono text-xs tabular-nums text-muted">
          {hasValidNumber ? (
            <>
              Target: {spotValue.toFixed(2)} {formattedOffset} ={" "}
              <span className="text-primary">{targetPrice?.toFixed(2)}</span>
            </>
          ) : (
            <>Spot: {spotValue.toFixed(2)}</>
          )}
        </p>
      ) : null}
      {error && (
        <p className="mt-1 font-sans text-xs text-loss">{error}</p>
      )}
    </label>
  );
}
