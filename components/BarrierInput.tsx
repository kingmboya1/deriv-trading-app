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
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block">{barrier.label}</span>
      <input
        type={inputType}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        min={barrier.min}
        max={barrier.max}
        step={barrier.step}
        placeholder={barrier.placeholder}
        className={`w-full rounded-xl border px-3 py-2 text-white bg-slate-950 ${
          error ? "border-rose-500" : "border-slate-700"
        }`}
      />
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </label>
  );
}
