export type DurationUnit = "m" | "s" | "t" | "d";
export type DurationKind = "time" | "tick";
export type BarrierKind = "digit" | "offset";
export type TradeMode = "RISE_FALL" | "EVEN_ODD" | "OVER_UNDER" | "MATCHES_DIFFERS" | "HIGHER_LOWER" | "ONETOUCH_NOTOUCH";
export type BuyContractType = "CALL" | "PUT" | "DIGITEVEN" | "DIGITODD" | "DIGITOVER" | "DIGITUNDER" | "DIGITMATCH" | "DIGITDIFF" | "HIGHER" | "LOWER" | "ONETOUCH" | "NOTOUCH";

export interface DurationConfig {
  kind: DurationKind;
  units: DurationUnit[];
  time?: { min: number; max: number; label: string };
  tick?: { min: number; max: number; label: string };
  day?: { min: number; max: number; label: string };
}

export interface BarrierConfig {
  kind: BarrierKind;
  label: string;
  min: number;
  max: number;
  step: number;
  placeholder: string;
}

export interface ContractTypeConfig {
  id: TradeMode;
  label: string;
  buttonLabels: [string, string];
  contractTypes: [BuyContractType, BuyContractType];
  duration: DurationConfig;
  barrier?: BarrierConfig;
}

export const CONTRACT_TYPES: Record<TradeMode, ContractTypeConfig> = {
  RISE_FALL: {
    id: "RISE_FALL",
    label: "Rise/Fall",
    buttonLabels: ["Rise", "Fall"],
    contractTypes: ["CALL", "PUT"],
    duration: {
      kind: "time",
      units: ["m", "s"],
      time: { min: 1, max: 1440, label: "1-1440 minutes" },
      tick: { min: 1, max: 10, label: "1-10 ticks" },
    },
  },
  EVEN_ODD: {
    id: "EVEN_ODD",
    label: "Even/Odd",
    buttonLabels: ["Even", "Odd"],
    contractTypes: ["DIGITEVEN", "DIGITODD"],
    duration: {
      kind: "tick",
      units: ["t"],
      tick: { min: 1, max: 10, label: "1-10 ticks" },
    },
  },
  OVER_UNDER: {
    id: "OVER_UNDER",
    label: "Over/Under",
    buttonLabels: ["Over", "Under"],
    contractTypes: ["DIGITOVER", "DIGITUNDER"],
    duration: {
      kind: "tick",
      units: ["t"],
      tick: { min: 1, max: 10, label: "1-10 ticks" },
    },
    barrier: {
      kind: "digit",
      label: "Barrier",
      min: 0,
      max: 9,
      step: 1,
      placeholder: "0-9",
    },
  },
  MATCHES_DIFFERS: {
    id: "MATCHES_DIFFERS",
    label: "Matches/Differs",
    buttonLabels: ["Matches", "Differs"],
    contractTypes: ["DIGITMATCH", "DIGITDIFF"],
    duration: {
      kind: "tick",
      units: ["t"],
      tick: { min: 1, max: 10, label: "1-10 ticks" },
    },
    barrier: {
      kind: "digit",
      label: "Barrier",
      min: 0,
      max: 9,
      step: 1,
      placeholder: "0-9",
    },
  },
  HIGHER_LOWER: {
    id: "HIGHER_LOWER",
    label: "Higher/Lower",
    buttonLabels: ["Higher", "Lower"],
    contractTypes: ["HIGHER", "LOWER"],
    duration: {
      kind: "time",
      units: ["m", "s"],
      time: { min: 1, max: 1440, label: "1-1440 minutes" },
      tick: { min: 1, max: 10, label: "1-10 ticks" },
    },
    barrier: {
      kind: "offset",
      label: "Barrier offset",
      min: -999999,
      max: 999999,
      step: 0.01,
      placeholder: "+1",
    },
  },
  ONETOUCH_NOTOUCH: {
    id: "ONETOUCH_NOTOUCH",
    label: "Touch/No Touch",
    buttonLabels: ["Touch", "No Touch"],
    contractTypes: ["ONETOUCH", "NOTOUCH"],
    duration: {
      kind: "time",
      units: ["m", "s", "d"],
      time: { min: 1, max: 1440, label: "1-1440 minutes" },
      tick: { min: 1, max: 10, label: "1-10 ticks" },
      day: { min: 1, max: 365, label: "1-365 days" },
    },
    barrier: {
      kind: "offset",
      label: "Barrier offset",
      min: -999999,
      max: 999999,
      step: 0.01,
      placeholder: "+1.37",
    },
  },
};

export const DEFAULT_TRADE_MODE: TradeMode = "RISE_FALL";

export const validateDuration = (
  value: number,
  unit: DurationUnit,
  config: ContractTypeConfig
): string | null => {
  if (config.duration.kind === "tick") {
    if (unit !== "t") {
      return "Tick-based contracts must use ticks.";
    }

    const tickRules = config.duration.tick!;
    if (value < tickRules.min || value > tickRules.max) {
      return `Duration must be ${tickRules.label}.`;
    }

    return null;
  }

  if (unit === "t") {
    return "Time-based contracts must use minutes, seconds, or days.";
  }

  if (unit === "d") {
    const dayRules = config.duration.day;
    if (!dayRules) {
      return "Day-based duration is not supported for this contract type.";
    }
    if (value < dayRules.min || value > dayRules.max) {
      return `Duration must be ${dayRules.label}.`;
    }
    return null;
  }

  const timeRules = config.duration.time!;
  if (value < timeRules.min || value > timeRules.max) {
    return `Duration must be ${timeRules.label}.`;
  }

  return null;
};

const OFFSET_PATTERN = /^(?=.{1,20}$)[+-]?[0-9]+(?:\.[0-9]*)?$/;

export const validateBarrier = (
  value: string,
  barrier?: BarrierConfig
): string | null => {
  if (!barrier) {
    return null;
  }

  if (value.trim() === "") {
    return "Barrier is required for this contract type.";
  }

  if (barrier.kind === "digit") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "Barrier must be a valid number.";
    }
    if (!Number.isInteger(numeric)) {
      return "Barrier must be a whole digit.";
    }
    if (numeric < barrier.min || numeric > barrier.max) {
      return `Barrier must be between ${barrier.min} and ${barrier.max}.`;
    }
    return null;
  }

  if (barrier.kind === "offset") {
    if (!OFFSET_PATTERN.test(value.trim())) {
      return "Barrier must be a valid offset like +1 or -1.";
    }
    return null;
  }

  return null;
};
