// ============================================================
// Supabase reads/writes for the deterministic forecast engine.
// Keeps the established recommendations + external_signals schema intact.
// ============================================================

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { DailyCheckin, ExternalSignal, SellerFood, SellingItem, SellingPlan } from '../../types/database';
import type { ForecastPlanContext, ForecastResult, HistoricalSession } from '../../types/forecast';

export const FORECAST_SOURCE = 'forecast_engine_v1';
const FORECAST_SUMMARY_SIGNAL = 'forecast_summary';

type ServiceResult<T> = { data: T | null; error: string | null };

function notConfigured<T>(): ServiceResult<T> {
  return { data: null, error: 'Supabase is not configured.' };
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
      estimated_sold_quantity: Math.max(0, checkin.prepared_quantity - checkin.leftover_quantity),
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
  return { data: result, error: null };
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
