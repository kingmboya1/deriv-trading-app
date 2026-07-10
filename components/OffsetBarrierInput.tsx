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
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block">{barrier.label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          ±
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={barrier.placeholder}
          className={`w-full rounded-xl border px-3 py-2 pl-10 text-white bg-slate-950 ${
            error ? "border-rose-500" : "border-slate-700"
          }`}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Enter a relative price offset from the current spot, e.g. +1 or -1.
      </p>
      {spotValue !== null ? (
        <p className="mt-1 text-xs text-slate-400">
          {hasValidNumber ? (
            <>Target barrier price: {spotValue.toFixed(2)} {formattedOffset} = {targetPrice?.toFixed(2)}</>
          ) : (
            <>Current spot: {spotValue.toFixed(2)}</>
          )}
        </p>
      ) : null}
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </label>
  );
}
