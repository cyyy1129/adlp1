// ============================================================
// Evidence-based demand estimator.
//
// Quantities come only from compatible, observed units-sold records. Weather,
// dates, events, holidays, prices, and public market aggregates remain
// contextual unless a labelled and evaluated model is introduced later.
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
  WeatherForecast,
} from '../../types/forecast';
import { calculateConfidence } from './confidence';

export interface ForecastEngineInput {
  context: ForecastPlanContext;
  publicBenchmark: PublicBenchmarkEvidence;
  weather: WeatherForecast;
  historicalWeather: HistoricalWeatherContext;
  calendarContext: CalendarContext;
  events: NearbyEvent[];
  eventsAvailability: 'available' | 'unavailable';
  priceInsight: PriceInsight;
}

interface ComparableSelection {
  sessions: HistoricalSession[];
  strategy: string;
  unit: string | null;
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

function isGenericUnit(value: string | null): boolean {
  return ['', 'serving', 'servings', 'unit', 'units', 'other'].includes(normalise(value));
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

function sameTimeWindow(session: HistoricalSession, target: ForecastPlanContext): boolean {
  if (!target.plan.start_time || !target.plan.end_time || !session.start_time || !session.end_time) return false;
  return session.start_time === target.plan.start_time && session.end_time === target.plan.end_time;
}

function chooseUnitGroup(sessions: HistoricalSession[], targetUnit: string): HistoricalSession[] {
  if (!isGenericUnit(targetUnit)) {
    return sessions.filter(session => normalise(session.unit) === normalise(targetUnit));
  }

  const groups = new Map<string, HistoricalSession[]>();
  for (const session of sessions) {
    const unit = normalise(session.unit);
    if (!unit) continue;
    const group = groups.get(unit) ?? [];
    group.push(session);
    groups.set(unit, group);
  }
  return [...groups.values()]
    .sort((left, right) => right.length - left.length || newestFirst(left[0], right[0]))[0] ?? [];
}

function selectComparableSessions(history: HistoricalSession[], target: ForecastPlanContext): ComparableSelection {
  const sameFood = history
    .filter(session => session.food_id === target.item.food_id && Number.isFinite(session.estimated_sold_quantity) && session.estimated_sold_quantity >= 0)
    .sort(newestFirst);
  if (sameFood.length === 0) return { sessions: [], strategy: 'No completed sessions for this food yet', unit: null };

  const sameFoodAndUnit = chooseUnitGroup(sameFood, target.food.unit);
  if (sameFoodAndUnit.length === 0) {
    return { sessions: [], strategy: 'Completed sessions use a different measurement unit', unit: null };
  }

  const planDay = dateAtNoon(target.plan.plan_date).getDay();
  const sameLocation = sameFoodAndUnit.filter(session => normalise(session.location_name) === normalise(target.plan.location_name));
  const sameLocationAndDay = sameLocation.filter(session => dateAtNoon(session.selling_date).getDay() === planDay);
  const sameLocationDayAndTime = sameLocationAndDay.filter(session => sameTimeWindow(session, target));
  const sameDay = sameFoodAndUnit.filter(session => dateAtNoon(session.selling_date).getDay() === planDay);
  const sessions = sameLocationDayAndTime.length > 0 ? sameLocationDayAndTime
    : sameLocationAndDay.length > 0 ? sameLocationAndDay
      : sameLocation.length > 0 ? sameLocation
        : sameDay.length > 0 ? sameDay
          : sameFoodAndUnit;
  const strategy = sameLocationDayAndTime.length > 0 ? 'same food, unit, location, day of week, and selling time'
    : sameLocationAndDay.length > 0 ? 'same food, unit, location, and day of week'
      : sameLocation.length > 0 ? 'same food, unit, and location'
        : sameDay.length > 0 ? 'same food, unit, and day of week'
          : 'same food and unit';
  return { sessions, strategy, unit: sessions[0]?.unit ?? null };
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

function usablePublicSessionBenchmark(benchmark: PublicBenchmarkEvidence): boolean {
  return benchmark.availability === 'available'
    && benchmark.quantity_basis === 'per_session'
    && benchmark.estimate_quantity !== null
    && benchmark.estimated_min !== null
    && benchmark.estimated_max !== null
    && benchmark.sample_size >= 2;
}

function contextSignals(input: ForecastEngineInput): ForecastSignal[] {
  const publicBenchmarkSignal: ForecastSignal = usablePublicSessionBenchmark(input.publicBenchmark)
    ? {
      kind: 'public_benchmark',
      label: 'Validated public session benchmark',
      availability: 'available',
      role: 'baseline',
      detail: input.publicBenchmark.methodology,
    }
    : input.publicBenchmark.availability === 'available'
      ? {
        kind: 'public_benchmark',
        label: 'Official public bazaar market context',
        availability: 'available',
        role: 'context_only',
        detail: input.publicBenchmark.limitation,
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
  return [publicBenchmarkSignal, weatherSignal, historicalWeatherSignal, eventSignal, holidaySignal];
}

// If a future public source includes true, comparable per-session units-sold
// labels, this precision-weighted update makes personal observations more
// influential as their number and precision increase. The imported DOSM
// bazaar aggregates deliberately never enter this branch.
function partialPool(publicEstimate: number, publicVariance: number, personal: EmpiricalSummary, personalCount: number): number | null {
  if (!Number.isFinite(publicVariance) || publicVariance <= 0 || personal.variance === null || personal.variance <= 0) return null;
  const publicPrecision = 1 / publicVariance;
  const personalPrecision = personalCount / personal.variance;
  if (!Number.isFinite(publicPrecision) || !Number.isFinite(personalPrecision) || publicPrecision + personalPrecision === 0) return null;
  return (publicEstimate * publicPrecision + personal.mean * personalPrecision) / (publicPrecision + personalPrecision);
}

function factsForPublic(benchmark: PublicBenchmarkEvidence, unit: string): string[] {
  return [
    `${benchmark.sample_size} validated public per-session observation${benchmark.sample_size === 1 ? '' : 's'} support this ${unit} benchmark.`,
    benchmark.methodology,
    benchmark.limitation,
  ];
}

function resultUnit(input: ForecastEngineInput, comparables: ComparableSelection): string {
  return comparables.unit ?? input.context.food.unit;
}

function unavailableResult(input: ForecastEngineInput, comparables: ComparableSelection, signals: ForecastSignal[]): ForecastResult {
  const lowDataMessage = 'We don\'t have enough comparable selling data to make a reliable quantity recommendation yet. Keep recording prepared and leftover quantities after each session to build a stronger estimate.';
  return {
    is_estimate_available: false,
    source_type: 'insufficient_evidence',
    evidence_level: 'insufficient_evidence',
    unit: resultUnit(input, comparables),
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
    events: input.events,
    events_availability: input.eventsAvailability,
    price_insight: input.priceInsight,
    model_name: 'seller_history_evidence_estimator',
    model_version: '3.0.0',
    methodology: 'No numerical estimate is produced without compatible observed units-sold evidence.',
  };
}

export function calculateForecast(input: ForecastEngineInput): ForecastResult {
  const publicBenchmark = input.publicBenchmark ?? missingBenchmark('Public benchmark input was not supplied.');
  const normalizedInput = { ...input, publicBenchmark };
  const comparables = selectComparableSessions(input.context.historical_sessions, input.context);
  const signals = contextSignals(normalizedInput);
  const unavailableCount = signals.filter(signal => signal.availability === 'unavailable' && signal.role === 'context_only').length;
  const unit = resultUnit(normalizedInput, comparables);

  if (comparables.sessions.length > 0) {
    const personal = empiricalSummary(comparables.sessions);
    let estimate = personal.mean;
    let strategy = comparables.strategy;
    let methodology = 'Empirical mean and interquartile range of this seller\'s completed comparable sessions. Contextual signals are displayed but do not alter quantity.';
    const min = personal.q25;
    const max = personal.q75;

    if (usablePublicSessionBenchmark(publicBenchmark) && publicBenchmark.population_variance !== null && publicBenchmark.estimate_quantity !== null) {
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
      unit,
      baseline_quantity: roundForUnit(personal.mean, unit),
      estimated_min: roundForUnit(Math.max(0, min), unit),
      estimated_max: roundForUnit(Math.max(0, max), unit),
      recommended_quantity: roundForUnit(Math.max(0, estimate), unit),
      total_adjustment: 0,
      comparable_strategy: strategy,
      comparable_records: comparables.sessions.length,
      confidence: calculateConfidence('personalized', comparables.sessions.length, unavailableCount),
      signals,
      explanation_facts: [
        `${comparables.sessions.length} completed comparable session${comparables.sessions.length === 1 ? '' : 's'} (${comparables.strategy}) averaged ${roundForUnit(personal.mean, unit)} ${unit}.`,
        'Prepared quantity, leftovers, and the resulting estimated sold quantity are private seller feedback; they are not shared as public training data.',
        ...(publicBenchmark.availability === 'available' && !usablePublicSessionBenchmark(publicBenchmark)
          ? ['Official bazaar market data is shown as context only because it does not contain compatible item-level, per-session units sold.']
          : []),
      ],
      low_data_message: null,
      public_benchmark: publicBenchmark,
      weather: input.weather,
      historical_weather: input.historicalWeather,
      calendar_context: input.calendarContext,
      events: input.events,
      events_availability: input.eventsAvailability,
      price_insight: input.priceInsight,
      model_name: 'seller_history_evidence_estimator',
      model_version: '3.0.0',
      methodology,
    };
  }

  if (usablePublicSessionBenchmark(publicBenchmark) && publicBenchmark.estimate_quantity !== null && publicBenchmark.estimated_min !== null && publicBenchmark.estimated_max !== null) {
    return {
      is_estimate_available: true,
      source_type: 'public_benchmark',
      evidence_level: 'benchmark_approximation',
      unit,
      baseline_quantity: roundForUnit(publicBenchmark.estimate_quantity, unit),
      estimated_min: roundForUnit(Math.max(0, publicBenchmark.estimated_min), unit),
      estimated_max: roundForUnit(Math.max(0, publicBenchmark.estimated_max), unit),
      recommended_quantity: roundForUnit(Math.max(0, publicBenchmark.estimate_quantity), unit),
      total_adjustment: 0,
      comparable_strategy: 'validated public per-session benchmark',
      comparable_records: publicBenchmark.sample_size,
      confidence: calculateConfidence('public_benchmark', publicBenchmark.sample_size, unavailableCount),
      signals,
      explanation_facts: factsForPublic(publicBenchmark, unit),
      low_data_message: null,
      public_benchmark: publicBenchmark,
      weather: input.weather,
      historical_weather: input.historicalWeather,
      calendar_context: input.calendarContext,
      events: input.events,
      events_availability: input.eventsAvailability,
      price_insight: input.priceInsight,
      model_name: 'seller_history_evidence_estimator',
      model_version: '3.0.0',
      methodology: publicBenchmark.methodology,
    };
  }

  return unavailableResult(normalizedInput, comparables, signals);
}
