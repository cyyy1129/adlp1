// ============================================================
// Supabase reads/writes for the deterministic forecast engine.
// Keeps the established recommendations + external_signals schema intact.
// ============================================================

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { DailyCheckin, ExternalSignal, SellerFood, SellingItem, SellingPlan } from '../../types/database';
import type { ForecastPlanContext, ForecastResult, HistoricalSession } from '../../types/forecast';

export const FORECAST_SOURCE = 'forecast_engine_v1';
const FORECAST_SUMMARY_SIGNAL = 'forecast_summary';
const WEATHER_OBSERVATION_SIGNAL = 'weather_observation';
const EVENT_CONTEXT_SIGNAL = 'nearby_event_context';
const PRICE_REFERENCE_SIGNAL = 'price_reference';

type ServiceResult<T> = { data: T | null; error: string | null };

function notConfigured<T>(): ServiceResult<T> {
  return { data: null, error: 'Supabase is not configured.' };
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normaliseStoredForecast(result: ForecastResult): ForecastResult {
  // Forecast summaries created before external-data normalization remain
  // readable; missing provider fields are shown as unavailable details.
  const weather = result.weather as ForecastResult['weather'] & Record<string, unknown>;
  const price = result.price_insight as ForecastResult['price_insight'] & Record<string, unknown>;
  return {
    ...result,
    weather: {
      ...weather,
      temperature_c: nullableNumber(weather.temperature_c),
      precipitation_probability: nullableNumber(weather.precipitation_probability),
      precipitation_mm: nullableNumber(weather.precipitation_mm),
      weather_code: nullableNumber(weather.weather_code),
      period_start: nullableString(weather.period_start),
      period_end: nullableString(weather.period_end),
    },
    events: result.events.map(event => ({ ...event, source_url: nullableString((event as typeof event & Record<string, unknown>).source_url) })),
    price_insight: {
      ...price,
      item_name: nullableString(price.item_name),
      unit: nullableString(price.unit),
      recent_price: nullableNumber(price.recent_price),
      price_date: nullableString(price.price_date),
      sample_size: nullableNumber(price.sample_size),
    },
  };
}

export async function getForecastPlanContext(userId: string, planId: string): Promise<ServiceResult<ForecastPlanContext>> {
  if (!isSupabaseConfigured) return notConfigured();

  const { data: planData, error: planError } = await supabase
    .from('selling_plans')
    .select('*')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  if (planError || !planData) return { data: null, error: planError?.message ?? 'Selling plan not found.' };
  const plan = planData as SellingPlan;

  const { data: itemData, error: itemError } = await supabase
    .from('selling_items')
    .select('*')
    .eq('plan_id', planId);
  if (itemError) return { data: null, error: itemError.message };
  const items = (itemData as SellingItem[] | null) ?? [];
  if (items.length !== 1) {
    return { data: null, error: 'This MVP can estimate one food item per selling plan.' };
  }

  const item = items[0];
  const { data: foodData, error: foodError } = await supabase
    .from('seller_food')
    .select('*')
    .eq('id', item.food_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (foodError || !foodData) return { data: null, error: foodError?.message ?? 'Selling food not found.' };

  const historical = await getHistoricalSessions(userId);
  if (historical.error) return { data: null, error: historical.error };

  return {
    data: {
      plan,
      item,
      food: foodData as SellerFood,
      historical_sessions: historical.data ?? [],
    },
    error: null,
  };
}

export async function getHistoricalSessions(userId: string): Promise<ServiceResult<HistoricalSession[]>> {
  if (!isSupabaseConfigured) return notConfigured();

  const { data: planData, error: planError } = await supabase
    .from('selling_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('plan_date', { ascending: false });
  if (planError) return { data: null, error: planError.message };
  const plans = (planData as SellingPlan[] | null) ?? [];
  if (plans.length === 0) return { data: [], error: null };
  const planIds = plans.map(plan => plan.id);

  const [checkinsResult, itemsResult] = await Promise.all([
    supabase.from('daily_checkins').select('*').eq('user_id', userId).in('selling_plan_id', planIds),
    supabase.from('selling_items').select('*').in('plan_id', planIds),
  ]);
  if (checkinsResult.error) return { data: null, error: checkinsResult.error.message };
  if (itemsResult.error) return { data: null, error: itemsResult.error.message };

  const checkins = (checkinsResult.data as DailyCheckin[] | null) ?? [];
  const items = (itemsResult.data as SellingItem[] | null) ?? [];
  const checkinByPlan = new Map(checkins.map(checkin => [checkin.selling_plan_id, checkin]));
  const itemsByPlan = new Map<string, SellingItem[]>();
  for (const item of items) {
    const group = itemsByPlan.get(item.plan_id) ?? [];
    group.push(item);
    itemsByPlan.set(item.plan_id, group);
  }

  const history: HistoricalSession[] = [];
  for (const plan of plans) {
    const checkin = checkinByPlan.get(plan.id);
    const planItems = itemsByPlan.get(plan.id) ?? [];
    // A session-level check-in cannot be assigned honestly across multiple foods.
    if (!checkin || planItems.length !== 1) continue;
    history.push({
      selling_plan_id: plan.id,
      food_id: planItems[0].food_id,
      selling_date: plan.plan_date || checkin.checkin_date,
      location_name: checkin.location_name ?? plan.location_name,
      prepared_quantity: checkin.prepared_quantity,
      leftover_quantity: checkin.leftover_quantity,
      estimated_sold_quantity: Math.max(
        0,
        typeof checkin.estimated_sold_quantity === 'number'
          ? checkin.estimated_sold_quantity
          : checkin.prepared_quantity - checkin.leftover_quantity
      ),
      crowd_level: checkin.crowd_level,
    });
  }

  return { data: history, error: null };
}

export async function getSavedForecast(planId: string): Promise<ServiceResult<ForecastResult>> {
  if (!isSupabaseConfigured) return notConfigured();

  const { data, error } = await supabase
    .from('external_signals')
    .select('*')
    .eq('selling_plan_id', planId)
    .eq('signal_type', FORECAST_SUMMARY_SIGNAL)
    .eq('source', FORECAST_SOURCE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  const signal = data as ExternalSignal;
  const stored = signal.signal_data?.forecast_result;
  if (!stored || typeof stored !== 'object') return { data: null, error: null };
  const result = stored as ForecastResult;
  if (typeof result.is_estimate_available !== 'boolean' || !Array.isArray(result.signals)) return { data: null, error: null };
  return { data: normaliseStoredForecast(result), error: null };
}

export async function saveForecastResult(planId: string, foodId: string, result: ForecastResult): Promise<ServiceResult<{ recommendationId: string | null }>> {
  if (!isSupabaseConfigured) return notConfigured();

  let recommendationId: string | null = null;
  if (result.is_estimate_available) {
    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        selling_plan_id: planId,
        food_id: foodId,
        recommended_qty: result.recommended_quantity,
        min_qty: result.estimated_min,
        max_qty: result.estimated_max,
        confidence: result.confidence.score,
        reasoning: result.explanation_facts.join(' '),
        source: FORECAST_SOURCE,
      })
      .select('id')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Could not save the recommendation.' };
    recommendationId = (data as { id: string }).id;
  }

  const signalRows = [
    ...result.signals.map(signal => ({
      selling_plan_id: planId,
      signal_type: signal.kind,
      signal_data: signal,
      source: FORECAST_SOURCE,
    })),
    {
      selling_plan_id: planId,
      signal_type: WEATHER_OBSERVATION_SIGNAL,
      signal_data: {
        availability: result.weather.availability,
        condition: result.weather.condition,
        temperature_c: result.weather.temperature_c,
        precipitation_probability: result.weather.precipitation_probability,
        precipitation_mm: result.weather.precipitation_mm,
        weather_code: result.weather.weather_code,
        period_start: result.weather.period_start,
        period_end: result.weather.period_end,
        summary: result.weather.summary,
      },
      source: result.weather.source ?? FORECAST_SOURCE,
    },
    {
      selling_plan_id: planId,
      signal_type: EVENT_CONTEXT_SIGNAL,
      signal_data: {
        availability: result.events_availability,
        events: result.events,
      },
      source: result.events[0]?.source ?? FORECAST_SOURCE,
    },
    {
      selling_plan_id: planId,
      signal_type: PRICE_REFERENCE_SIGNAL,
      signal_data: {
        availability: result.price_insight.availability,
        item_name: result.price_insight.item_name,
        unit: result.price_insight.unit,
        recent_price: result.price_insight.recent_price,
        price_date: result.price_insight.price_date,
        sample_size: result.price_insight.sample_size,
        summary: result.price_insight.summary,
      },
      source: result.price_insight.source_name ?? FORECAST_SOURCE,
    },
    {
      selling_plan_id: planId,
      signal_type: FORECAST_SUMMARY_SIGNAL,
      signal_data: {
        status: result.is_estimate_available ? 'estimated' : 'insufficient_history',
        baseline_quantity: result.baseline_quantity,
        estimated_min: result.estimated_min,
        estimated_max: result.estimated_max,
        recommended_quantity: result.recommended_quantity,
        confidence: result.confidence,
        forecast_result: result,
      },
      source: FORECAST_SOURCE,
    },
  ];
  const { error: signalsError } = await supabase.from('external_signals').insert(signalRows);
  if (signalsError) {
    if (recommendationId) await supabase.from('recommendations').delete().eq('id', recommendationId);
    return { data: null, error: signalsError.message };
  }

  return { data: { recommendationId }, error: null };
}
