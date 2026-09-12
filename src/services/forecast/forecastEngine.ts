// ============================================================
// Public-benchmark and personal-history demand estimator.
//
// Contextual inputs are intentionally not multipliers. The code has no
// weekend/rain/event/crowd coefficients: those inputs are explanatory until a
// labelled, held-out model demonstrates a relationship to units sold.
// ============================================================

import type {
  CalendarContext,
  ForecastPlanContext,
  ForecastResult,
  ForecastSignal,
  HistoricalSession,
  HistoricalWeatherContext,
  NearbyEvent,
  PriceInsight,
  PublicBenchmarkEvidence,
  TransitContext,
  WeatherForecast,
} from '../../types/forecast';
import { calculateConfidence } from './confidence';

export interface ForecastEngineInput {
  context: ForecastPlanContext;
  publicBenchmark: PublicBenchmarkEvidence;
  weather: WeatherForecast;
  historicalWeather: HistoricalWeatherContext;
  calendarContext: CalendarContext;
  transitContext: TransitContext;
  events: NearbyEvent[];
  eventsAvailability: 'available' | 'unavailable';
  priceInsight: PriceInsight;
}

interface ComparableSelection {
  sessions: HistoricalSession[];
  strategy: string;
}

interface EmpiricalSummary {
  mean: number;
  q25: number;
  q75: number;
  variance: number | null;
}

function dateAtNoon(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function normalise(value: string | null): string {
  return (value ?? '').trim().toLocaleLowerCase();
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function quantile(values: number[], percentile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function sampleVariance(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values);
  return values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);
}

function empiricalSummary(sessions: HistoricalSession[]): EmpiricalSummary {
  const values = sessions.map(session => session.estimated_sold_quantity);
  return { mean: average(values), q25: quantile(values, 0.25), q75: quantile(values, 0.75), variance: sampleVariance(values) };
}

function newestFirst(left: HistoricalSession, right: HistoricalSession): number {
  return right.selling_date.localeCompare(left.selling_date);
}

function selectComparableSessions(history: HistoricalSession[], target: ForecastPlanContext): ComparableSelection {
  const sameFoodAndUnit = history
    .filter(session => session.food_id === target.item.food_id && normalise(session.unit) === normalise(target.food.unit))
    .sort(newestFirst);
  if (sameFoodAndUnit.length === 0) return { sessions: [], strategy: 'No completed sessions for this food and unit yet' };

  const planDay = dateAtNoon(target.plan.plan_date).getDay();
  const sameLocation = sameFoodAndUnit.filter(session => normalise(session.location_name) === normalise(target.plan.location_name));
  const sameLocationAndDay = sameLocation.filter(session => dateAtNoon(session.selling_date).getDay() === planDay);
  const sameDay = sameFoodAndUnit.filter(session => dateAtNoon(session.selling_date).getDay() === planDay);
  const sessions = sameLocationAndDay.length > 0 ? sameLocationAndDay
    : sameLocation.length > 0 ? sameLocation
      : sameDay.length > 0 ? sameDay
        : sameFoodAndUnit;
  const strategy = sameLocationAndDay.length > 0 ? 'same food, unit, location, and day of week'
    : sameLocation.length > 0 ? 'same food, unit, and location'
      : sameDay.length > 0 ? 'same food, unit, and day of week'
        : 'same food and unit';
  return { sessions, strategy };
}

function roundForUnit(value: number, unit: string): number {
  const compactUnit = normalise(unit);
  if (compactUnit.includes('kg') || compactUnit.includes('litre') || compactUnit.includes('liter')) return Math.round(value * 10) / 10;
  return Math.round(value);
}

function missingBenchmark(message: string): PublicBenchmarkEvidence {
  return {
    availability: 'unavailable',
    quantity_basis: 'not_convertible',
    estimate_quantity: null,
    estimated_min: null,
    estimated_max: null,
    sample_size: 0,
    population_variance: null,
    selected_scope: null,
    sales_value_per_stall: null,
    persons_engaged_per_stall: null,
    serving_price: null,
    price_basis: null,
    methodology: 'No public quantity conversion was performed.',
    limitation: message,
    sources: [],
  };
}

function contextSignals(input: ForecastEngineInput): ForecastSignal[] {
  const publicBenchmarkSignal: ForecastSignal = input.publicBenchmark.availability === 'available'
    ? {
      kind: 'public_benchmark',
      label: 'Validated public bazaar benchmark',
      availability: 'available',
      role: 'baseline',
      detail: input.publicBenchmark.methodology,
    }
    : {
      kind: 'public_benchmark',
      label: 'Public bazaar benchmark unavailable',
      availability: 'unavailable',
      role: 'context_only',
      detail: input.publicBenchmark.limitation,
    };
  const weatherSignal: ForecastSignal = {
    kind: 'weather_context',
    label: input.weather.availability === 'available' ? 'Future weather forecast' : 'Future weather unavailable',
    availability: input.weather.availability,
    role: 'context_only',
    detail: `${input.weather.summary} No quantity adjustment is applied without labelled demand evidence.`,
  };
  const historicalWeatherSignal: ForecastSignal = {
    kind: 'historical_weather_context',
    label: input.historicalWeather.availability === 'available' ? 'Historical weather reference' : 'Historical weather unavailable',
    availability: input.historicalWeather.availability,
    role: 'context_only',
    detail: input.historicalWeather.summary,
  };
  const eventSignal: ForecastSignal = {
    kind: 'nearby_event_context',
    label: input.eventsAvailability === 'available'
      ? input.events.length > 0 ? `${input.events.length} verified nearby event${input.events.length === 1 ? '' : 's'}` : 'No nearby event data available'
      : 'Nearby event data unavailable',
    availability: input.eventsAvailability,
    role: 'context_only',
    detail: input.eventsAvailability === 'available' && input.events.length === 0
      ? 'No actual events were returned. No quantity adjustment is applied.'
      : 'Events are shown as context only; no quantity adjustment is applied.',
  };
  const holidaySignal: ForecastSignal = {
    kind: 'holiday_context',
    label: input.calendarContext.availability === 'available'
      ? input.calendarContext.is_public_holiday ? input.calendarContext.holiday_name ?? 'Public holiday' : 'No public holiday listed'
      : 'Official public-holiday data unavailable',
    availability: input.calendarContext.availability,
    role: 'context_only',
    detail: input.calendarContext.summary,
  };
  const transitSignal: ForecastSignal = {
    kind: 'transit_context',
    label: input.transitContext.availability === 'available' ? 'Verified Rapid Rail activity proxy' : 'Rapid Rail context unavailable',
    availability: input.transitContext.availability,
    role: 'context_only',
    detail: input.transitContext.summary,
  };
  return [publicBenchmarkSignal, weatherSignal, historicalWeatherSignal, eventSignal, holidaySignal, transitSignal];
}

// If a future public source includes true per-session units-sold labels, this
// precision-weighted update makes personal observations increasingly dominant
// as their number and precision increase. Current DOSM aggregate records do
// not have that compatible basis, so this branch is deliberately not used.
function partialPool(publicEstimate: number, publicVariance: number, personal: EmpiricalSummary, personalCount: number): number | null {
  if (!Number.isFinite(publicVariance) || publicVariance <= 0 || personal.variance === null || personal.variance <= 0) return null;
  const publicPrecision = 1 / publicVariance;
  const personalPrecision = personalCount / personal.variance;
  if (!Number.isFinite(publicPrecision) || !Number.isFinite(personalPrecision) || publicPrecision + personalPrecision === 0) return null;
  return (publicEstimate * publicPrecision + personal.mean * personalPrecision) / (publicPrecision + personalPrecision);
}

function factsForPublic(benchmark: PublicBenchmarkEvidence, unit: string): string[] {
  const facts = [
    `The selected public scope is ${benchmark.selected_scope ?? 'not specified'} and reports sales value per stall, not food-item units sold.`,
    benchmark.methodology,
    benchmark.limitation,
  ];
  if (benchmark.estimate_quantity !== null) {
    facts.unshift(`Public revenue-equivalent benchmark: ${benchmark.estimate_quantity} ${unit} for the published bazaar period.`);
  }
  return facts;
}

function unavailableResult(input: ForecastEngineInput, comparables: ComparableSelection, signals: ForecastSignal[]): ForecastResult {
  const lowDataMessage = 'Neither completed comparable selling sessions nor a convertible validated public benchmark is available. Add a real serving price and keep recording check-ins; no quantity was invented.';
  return {
    is_estimate_available: false,
    source_type: 'insufficient_evidence',
    evidence_level: 'insufficient_evidence',
    unit: input.context.food.unit,
    baseline_quantity: null,
    estimated_min: null,
    estimated_max: null,
    recommended_quantity: null,
    total_adjustment: 0,
    comparable_strategy: comparables.strategy,
    comparable_records: comparables.sessions.length,
    confidence: calculateConfidence('insufficient_evidence', comparables.sessions.length, signals.filter(signal => signal.availability === 'unavailable').length),
    signals,
    explanation_facts: [lowDataMessage],
    low_data_message: lowDataMessage,
    public_benchmark: input.publicBenchmark,
    weather: input.weather,
    historical_weather: input.historicalWeather,
    calendar_context: input.calendarContext,
    transit_context: input.transitContext,
    events: input.events,
    events_availability: input.eventsAvailability,
    price_insight: input.priceInsight,
    model_name: 'public_benchmark_empirical_estimator',
    model_version: '2.0.0',
    methodology: 'No numerical estimate is produced without a compatible empirical basis.',
  };
}

export function calculateForecast(input: ForecastEngineInput): ForecastResult {
  const comparables = selectComparableSessions(input.context.historical_sessions, input.context);
  const signals = contextSignals(input);
  const unavailableCount = signals.filter(signal => signal.availability === 'unavailable' && signal.role === 'context_only').length;
  const publicBenchmark = input.publicBenchmark ?? missingBenchmark('Public benchmark input was not supplied.');

  if (comparables.sessions.length > 0) {
    const personal = empiricalSummary(comparables.sessions);
    let estimate = personal.mean;
    let strategy = comparables.strategy;
    let methodology = 'Empirical mean and interquartile range of this seller’s completed comparable sessions. Contextual signals are displayed but do not alter quantity.';
    let min = personal.q25;
    let max = personal.q75;

    if (publicBenchmark.quantity_basis === 'per_session' && publicBenchmark.estimate_quantity !== null && publicBenchmark.population_variance !== null) {
      const pooled = partialPool(publicBenchmark.estimate_quantity, publicBenchmark.population_variance, personal, comparables.sessions.length);
      if (pooled !== null) {
        estimate = pooled;
        strategy = `${comparables.strategy}; precision-weighted partial pooling with compatible public session observations`;
        methodology = 'Precision-weighted partial pooling: public and personal means are weighted by inverse observed variance, so additional precise personal check-ins naturally receive more weight. Contextual signals do not alter quantity.';
      }
    }

    signals.unshift({
      kind: 'personal_history',
      label: 'Seller completed-session history',
      availability: 'available',
      role: 'personal_calibration',
      detail: `${comparables.sessions.length} comparable completed session${comparables.sessions.length === 1 ? '' : 's'}; ${strategy}.`,
    });
    return {
      is_estimate_available: true,
      source_type: 'personalized',
      evidence_level: 'personal_observations',
      unit: input.context.food.unit,
      baseline_quantity: roundForUnit(personal.mean, input.context.food.unit),
      estimated_min: roundForUnit(Math.max(0, min), input.context.food.unit),
      estimated_max: roundForUnit(Math.max(0, max), input.context.food.unit),
      recommended_quantity: roundForUnit(Math.max(0, estimate), input.context.food.unit),
      total_adjustment: 0,
      comparable_strategy: strategy,
      comparable_records: comparables.sessions.length,
      confidence: calculateConfidence('personalized', comparables.sessions.length, unavailableCount),
      signals,
      explanation_facts: [
        `${comparables.sessions.length} completed comparable session${comparables.sessions.length === 1 ? '' : 's'} (${comparables.strategy}) averaged ${roundForUnit(personal.mean, input.context.food.unit)} ${input.context.food.unit}.`,
        'Prepared quantity, leftovers, and the resulting estimated sold quantity are private seller feedback; they are not shared as public training data.',
        ...(publicBenchmark.availability === 'available' && publicBenchmark.quantity_basis !== 'per_session'
          ? ['The public bazaar benchmark is period-level, so it was not blended with per-session seller check-ins.']
          : []),
      ],
      low_data_message: null,
      public_benchmark: publicBenchmark,
      weather: input.weather,
      historical_weather: input.historicalWeather,
      calendar_context: input.calendarContext,
      transit_context: input.transitContext,
      events: input.events,
      events_availability: input.eventsAvailability,
      price_insight: input.priceInsight,
      model_name: 'public_benchmark_empirical_estimator',
      model_version: '2.0.0',
      methodology,
    };
  }

  if (publicBenchmark.availability === 'available' && publicBenchmark.estimate_quantity !== null) {
    return {
      is_estimate_available: true,
      source_type: 'public_benchmark',
      evidence_level: 'benchmark_approximation',
      unit: input.context.food.unit,
      baseline_quantity: publicBenchmark.estimate_quantity,
      estimated_min: publicBenchmark.estimated_min,
      estimated_max: publicBenchmark.estimated_max,
      recommended_quantity: publicBenchmark.estimate_quantity,
      total_adjustment: 0,
      comparable_strategy: 'validated public market benchmark',
      comparable_records: 0,
      confidence: calculateConfidence('public_benchmark', 0, unavailableCount),
      signals,
      explanation_facts: factsForPublic(publicBenchmark, input.context.food.unit),
      low_data_message: null,
      public_benchmark: publicBenchmark,
      weather: input.weather,
      historical_weather: input.historicalWeather,
      calendar_context: input.calendarContext,
      transit_context: input.transitContext,
      events: input.events,
      events_availability: input.eventsAvailability,
      price_insight: input.priceInsight,
      model_name: 'public_benchmark_empirical_estimator',
      model_version: '2.0.0',
      methodology: publicBenchmark.methodology,
    };
  }

  return unavailableResult(input, comparables, signals);
}
