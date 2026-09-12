// ============================================================
// Deterministic quantity-formula placeholder for the hackathon demo.
//
// This module intentionally does not fetch data or choose factors. A future
// validated data source must supply the three historical observations and the
// weather/event/day factors before it is used in a live recommendation.
// ============================================================

export interface HistoricalBaselineInputs {
  older: number;
  recent: number;
  most_relevant: number;
}

export interface QuantityFactors {
  weather: number;
  event: number;
  day_or_holiday: number;
}

export const BASELINE_WEIGHTS = {
  older: 0.2,
  recent: 0.3,
  most_relevant: 0.5,
} as const;

export function calculateWeightedBaseline(input: HistoricalBaselineInputs): number {
  return input.older * BASELINE_WEIGHTS.older
    + input.recent * BASELINE_WEIGHTS.recent
    + input.most_relevant * BASELINE_WEIGHTS.most_relevant;
}

export function calculateEstimatedQuantity(baseline: number, factors: QuantityFactors): number {
  return Math.round(baseline * factors.weather * factors.event * factors.day_or_holiday);
}

// These values are only the product brief's worked example. They are not
// reported as seller history, public data, or a live forecast.
export const DEMO_FORMULA_EXAMPLE = {
  historical: { older: 100, recent: 120, most_relevant: 110 },
  factors: { weather: 1.25, event: 1, day_or_holiday: 1 },
} as const;
