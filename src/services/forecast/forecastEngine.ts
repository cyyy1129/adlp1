// ============================================================
// Deterministic, explainable demand-estimation engine.
// ============================================================

import type { ForecastPlanContext, ForecastResult, ForecastSignal, HistoricalSession, NearbyEvent, PriceInsight, WeatherForecast } from '../../types/forecast';
import { calculateConfidence } from './confidence';
import { FORECAST_WEIGHTS } from './signalWeights';

interface ForecastEngineInput {
  context: ForecastPlanContext;
  weather: WeatherForecast;
  events: NearbyEvent[];
  eventsAvailability: 'available' | 'unavailable';
  priceInsight: PriceInsight;
}

interface ComparableSelection {
  sessions: HistoricalSession[];
  strategy: string;
}

function dateAtNoon(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function isWeekend(value: string): boolean {
  const day = dateAtNoon(value).getDay();
  return day === 0 || day === 6;
}

function normaliseLocation(location: string | null): string {
  return location?.trim().toLocaleLowerCase() ?? '';
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function newestFirst(left: HistoricalSession, right: HistoricalSession): number {
  return right.selling_date.localeCompare(left.selling_date);
}

function selectComparableSessions(history: HistoricalSession[], target: ForecastPlanContext): ComparableSelection {
  const sameFood = history.filter(session => session.food_id === target.item.food_id).sort(newestFirst);
  if (sameFood.length === 0) return { sessions: [], strategy: 'No completed sessions for this food yet' };

  const planDay = dateAtNoon(target.plan.plan_date).getDay();
  const sameLocation = sameFood.filter(session => normaliseLocation(session.location_name) === normaliseLocation(target.plan.location_name));
  const sameLocationAndDay = sameLocation.filter(session => dateAtNoon(session.selling_date).getDay() === planDay);
  const sameDay = sameFood.filter(session => dateAtNoon(session.selling_date).getDay() === planDay);

  const selected = sameLocationAndDay.length > 0
    ? sameLocationAndDay
    : sameLocation.length > 0
      ? sameLocation
      : sameDay.length > 0
        ? sameDay
        : sameFood;
  const strategy = sameLocationAndDay.length > 0
    ? 'same food, location, and day of week'
    : sameLocation.length > 0
      ? 'same food and location'
      : sameDay.length > 0
        ? 'same food and day of week'
        : 'same food';

  return {
    sessions: selected.slice(0, FORECAST_WEIGHTS.maxComparableSessions),
    strategy,
  };
}

function rounded(value: number): number {
  return Math.round(value);
}

function createDaySignal(planDate: string): ForecastSignal {
  const weekend = isWeekend(planDate);
  return {
    kind: 'day_of_week',
    label: weekend ? 'Weekend session' : 'Weekday session',
    adjustment: weekend ? FORECAST_WEIGHTS.weekend : 0,
    availability: 'available',
    detail: weekend ? 'Weekend weight is applied from the configured forecast settings.' : 'No weekday adjustment is configured.',
  };
}

function createWeatherSignal(weather: WeatherForecast): ForecastSignal {
  if (!weather.condition) {
    return {
      kind: 'weather',
      label: 'Weather unavailable',
      adjustment: 0,
      availability: 'unavailable',
      detail: 'Weather did not affect this estimate.',
    };
  }

  const adjustment = FORECAST_WEIGHTS.weather[weather.condition];
  return {
    kind: 'weather',
    label: `Weather: ${weather.condition}`,
    adjustment,
    availability: weather.availability,
    detail: weather.summary,
  };
}

function createEventSignal(events: NearbyEvent[], availability: ForecastEngineInput['eventsAvailability']): ForecastSignal {
  if (availability === 'unavailable') {
    return {
      kind: 'nearby_event',
      label: 'Nearby events unavailable',
      adjustment: 0,
      availability: 'unavailable',
      detail: 'Event data did not affect this estimate.',
    };
  }

  const nearby = events.filter(event => event.distance_km === null || event.distance_km <= FORECAST_WEIGHTS.nearbyEventRadiusKm);
  return {
    kind: 'nearby_event',
    label: nearby.length > 0 ? `${nearby.length} nearby event${nearby.length === 1 ? '' : 's'} found` : 'No nearby events reported',
    adjustment: nearby.length > 0 ? FORECAST_WEIGHTS.nearbyEvent : 0,
    availability,
    detail: nearby.length > 0 ? 'Nearby-event weight is applied from the configured forecast settings.' : 'No event adjustment is applied.',
  };
}

function createCrowdSignal(comparables: HistoricalSession[]): ForecastSignal {
  if (comparables.length === 0) {
    return {
      kind: 'historical_crowd',
      label: 'No historical crowd data',
      adjustment: 0,
      availability: 'unavailable',
      detail: 'Historical crowd did not affect this estimate.',
    };
  }

  const crowdAdjustment = average(comparables.map(session => FORECAST_WEIGHTS.historicalCrowd[session.crowd_level]));
  const packed = comparables.filter(session => session.crowd_level === 'Packed').length;
  const quiet = comparables.filter(session => session.crowd_level === 'Quiet').length;
  return {
    kind: 'historical_crowd',
    label: 'Historical crowd pattern',
    adjustment: crowdAdjustment,
    availability: 'available',
    detail: `${packed} packed and ${quiet} quiet comparable session${comparables.length === 1 ? '' : 's'} were recorded.`,
  };
}

function createHistoricalPerformanceSignal(comparables: HistoricalSession[], allSameFood: HistoricalSession[]): ForecastSignal {
  if (comparables.length === 0 || allSameFood.length === 0) {
    return {
      kind: 'historical_performance',
      label: 'No historical performance adjustment',
      adjustment: 0,
      availability: 'unavailable',
      detail: 'There is not enough completed history for a performance comparison.',
    };
  }

  const comparableAverage = average(comparables.map(session => session.estimated_sold_quantity));
  const overallAverage = average(allSameFood.map(session => session.estimated_sold_quantity));
  const isStrong = comparableAverage >= overallAverage * FORECAST_WEIGHTS.strongPerformanceRatio;
  return {
    kind: 'historical_performance',
    label: isStrong ? 'Strong comparable performance' : 'Comparable performance is typical',
    adjustment: isStrong ? FORECAST_WEIGHTS.strongHistoricalPerformance : 0,
    availability: 'available',
    detail: `Comparable sessions averaged ${rounded(comparableAverage)} ${comparables.length === 1 ? 'unit' : 'units'}; all completed sessions for this food averaged ${rounded(overallAverage)}.`,
  };
}

function explanationFacts(
  baseline: number | null,
  comparables: ComparableSelection,
  signals: ForecastSignal[],
  unit: string,
  lowDataMessage: string | null
): string[] {
  const facts: string[] = [];
  if (baseline !== null) {
    facts.push(`${comparables.sessions.length} comparable completed session${comparables.sessions.length === 1 ? '' : 's'} (${comparables.strategy}) averaged ${rounded(baseline)} ${unit}.`);
  }
  for (const signal of signals) {
    if (signal.adjustment > 0) facts.push(`${signal.label} adds ${rounded(signal.adjustment * 100)}%.`);
    if (signal.adjustment < 0) facts.push(`${signal.label} reduces the estimate by ${Math.abs(rounded(signal.adjustment * 100))}%.`);
    if (signal.availability === 'unavailable' && (signal.kind === 'weather' || signal.kind === 'nearby_event')) facts.push(signal.detail);
  }
  if (lowDataMessage) facts.unshift(lowDataMessage);
  return facts;
}

export function calculateForecast(input: ForecastEngineInput): ForecastResult {
  const comparables = selectComparableSessions(input.context.historical_sessions, input.context);
  const sameFoodHistory = input.context.historical_sessions.filter(session => session.food_id === input.context.item.food_id);
  const signals = [
    createDaySignal(input.context.plan.plan_date),
    createWeatherSignal(input.weather),
    createEventSignal(input.events, input.eventsAvailability),
    createCrowdSignal(comparables.sessions),
    createHistoricalPerformanceSignal(comparables.sessions, sameFoodHistory),
  ];
  const unavailableContextSignals = signals.filter(signal => signal.availability === 'unavailable' && (signal.kind === 'weather' || signal.kind === 'nearby_event')).length;
  const confidence = calculateConfidence(comparables.sessions.length, unavailableContextSignals);
  const baseline = comparables.sessions.length > 0
    ? average(comparables.sessions.map(session => session.estimated_sold_quantity))
    : null;
  const unclampedAdjustment = signals.reduce((total, signal) => total + signal.adjustment, 0);
  const totalAdjustment = Math.min(FORECAST_WEIGHTS.maximumAdjustment, Math.max(FORECAST_WEIGHTS.minimumAdjustment, unclampedAdjustment));
  const lowDataMessage = baseline === null
    ? "You don't have enough previous selling data yet, so a numerical preparation estimate cannot be grounded in your history. Today's available conditions are shown below."
    : null;

  if (baseline === null) {
    return {
      is_estimate_available: false,
      unit: input.context.food.unit,
      baseline_quantity: null,
      estimated_min: null,
      estimated_max: null,
      recommended_quantity: null,
      total_adjustment: 0,
      comparable_strategy: comparables.strategy,
      comparable_records: 0,
      confidence,
      signals,
      explanation_facts: explanationFacts(null, comparables, signals, input.context.food.unit, lowDataMessage),
      low_data_message: lowDataMessage,
      weather: input.weather,
      events: input.events,
      events_availability: input.eventsAvailability,
      price_insight: input.priceInsight,
    };
  }

  const recommended = Math.max(0, rounded(baseline * (1 + totalAdjustment)));
  const rangeAmount = Math.max(FORECAST_WEIGHTS.minimumRangeQuantity, Math.round(recommended * FORECAST_WEIGHTS.rangePercentage));
  return {
    is_estimate_available: true,
    unit: input.context.food.unit,
    baseline_quantity: rounded(baseline),
    estimated_min: Math.max(0, recommended - rangeAmount),
    estimated_max: recommended + rangeAmount,
    recommended_quantity: recommended,
    total_adjustment: totalAdjustment,
    comparable_strategy: comparables.strategy,
    comparable_records: comparables.sessions.length,
    confidence,
    signals,
    explanation_facts: explanationFacts(baseline, comparables, signals, input.context.food.unit, null),
    low_data_message: null,
    weather: input.weather,
    events: input.events,
    events_availability: input.eventsAvailability,
    price_insight: input.priceInsight,
  };
}
