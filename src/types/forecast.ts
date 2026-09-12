// ============================================================
// Forecast domain types. Numerical values are produced only by the
// deterministic forecast engine, never by an LLM.
// ============================================================

import type { CrowdLevel, SellerFood, SellingItem, SellingPlan } from './database';

export type WeatherCondition = 'rain' | 'clear' | 'hot' | 'other';
export type DataAvailability = 'available' | 'unavailable' | 'demo';
export type ConfidenceLevel = 'Low' | 'Medium' | 'High';

export interface WeatherForecast {
  availability: DataAvailability;
  condition: WeatherCondition | null;
  summary: string;
  source: string | null;
}

export interface NearbyEvent {
  name: string;
  distance_km: number | null;
  starts_at: string | null;
  source: string;
}

export interface PriceInsight {
  availability: 'available' | 'unavailable';
  summary: string;
  source_name: string | null;
  reference_url: string | null;
}

export interface HistoricalSession {
  selling_plan_id: string;
  food_id: string;
  selling_date: string;
  location_name: string | null;
  prepared_quantity: number;
  leftover_quantity: number;
  estimated_sold_quantity: number;
  crowd_level: CrowdLevel;
}

export interface ForecastPlanContext {
  plan: SellingPlan;
  item: SellingItem;
  food: SellerFood;
  historical_sessions: HistoricalSession[];
}

export type ForecastSignalKind = 'day_of_week' | 'weather' | 'nearby_event' | 'historical_crowd' | 'historical_performance';

export interface ForecastSignal {
  kind: ForecastSignalKind;
  label: string;
  adjustment: number;
  availability: DataAvailability;
  detail: string;
}

export interface ForecastConfidence {
  level: ConfidenceLevel;
  score: number;
  comparable_records: number;
  unavailable_context_signals: number;
  detail: string;
}

export interface ForecastResult {
  is_estimate_available: boolean;
  unit: string;
  baseline_quantity: number | null;
  estimated_min: number | null;
  estimated_max: number | null;
  recommended_quantity: number | null;
  total_adjustment: number;
  comparable_strategy: string;
  comparable_records: number;
  confidence: ForecastConfidence;
  signals: ForecastSignal[];
  explanation_facts: string[];
  low_data_message: string | null;
  weather: WeatherForecast;
  events: NearbyEvent[];
  events_availability: DataAvailability;
  price_insight: PriceInsight;
}
