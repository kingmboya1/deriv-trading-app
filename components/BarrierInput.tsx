import { ContractTypeConfig } from "@/lib/contract-types";

interface BarrierInputProps {
  contractConfig: ContractTypeConfig;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
}

export function BarrierInput({
  contractConfig,
  value,
  onChange,
  onBlur,
  error,
}: BarrierInputProps) {
  const barrier = contractConfig.barrier;
  if (!barrier) {
    return null;
  }

  const inputType = barrier.kind === "digit" ? "number" : "text";

  return (
    <label className="block">
      <span className="mb-1 block font-display text-xs font-medium text-muted">
        {barrier.label}
      </span>
      <input
        type={inputType}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        min={barrier.min}
        max={barrier.max}
        step={barrier.step}
        placeholder={barrier.placeholder}
        className={`w-full rounded-lg border bg-card px-3 py-2 font-mono text-sm text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent/30 ${
          error
            ? "border-loss focus:border-loss"
            : "border-hairline focus:border-accent/50"
        }`}
      />
      {error && (
        <p className="mt-1 font-sans text-xs text-loss">{error}</p>
      )}
    </label>
  );
}
