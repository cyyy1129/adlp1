// ============================================================
// Simple seller-owned session history and data-supported reflection.
// ============================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { DailyCheckin, SellerFood, SellingItem, SellingPlan } from '../types/database';

export interface HistoryEntry {
  selling_plan_id: string;
  selling_date: string;
  location_name: string | null;
  food_name: string;
  prepared_quantity: number;
  leftover_quantity: number;
  estimated_sold_quantity: number;
  unit: string;
  crowd_level: DailyCheckin['crowd_level'];
}

export async function getUserHistory(userId: string): Promise<{ data: HistoryEntry[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'Supabase is not configured.' };

  const { data: planData, error: planError } = await supabase
    .from('selling_plans')
    .select('*')
    .eq('user_id', userId)
    .order('plan_date', { ascending: false });
  if (planError) return { data: [], error: planError.message };
  const plans = (planData as SellingPlan[] | null) ?? [];
  if (plans.length === 0) return { data: [], error: null };
  const planIds = plans.map(plan => plan.id);

  const [checkinsResult, itemsResult, foodsResult] = await Promise.all([
    supabase.from('daily_checkins').select('*').eq('user_id', userId).in('selling_plan_id', planIds),
    supabase.from('selling_items').select('*').in('plan_id', planIds),
    supabase.from('seller_food').select('*').eq('user_id', userId),
  ]);
  if (checkinsResult.error) return { data: [], error: checkinsResult.error.message };
  if (itemsResult.error) return { data: [], error: itemsResult.error.message };
  if (foodsResult.error) return { data: [], error: foodsResult.error.message };

  const checkins = (checkinsResult.data as DailyCheckin[] | null) ?? [];
  const items = (itemsResult.data as SellingItem[] | null) ?? [];
  const foods = (foodsResult.data as SellerFood[] | null) ?? [];
  const planById = new Map(plans.map(plan => [plan.id, plan]));
  const itemByPlanId = new Map(items.map(item => [item.plan_id, item]));
  const foodById = new Map(foods.map(food => [food.id, food]));

  return {
    data: checkins
      .map(checkin => {
        const plan = planById.get(checkin.selling_plan_id);
        const item = itemByPlanId.get(checkin.selling_plan_id);
        const food = item ? foodById.get(item.food_id) : null;
        if (!plan || !food) return null;
        return {
          selling_plan_id: plan.id,
          selling_date: plan.plan_date || checkin.checkin_date,
          location_name: checkin.location_name ?? plan.location_name,
          food_name: food.food_name,
          prepared_quantity: checkin.prepared_quantity,
          leftover_quantity: checkin.leftover_quantity,
          estimated_sold_quantity: Math.max(0, typeof checkin.estimated_sold_quantity === 'number'
            ? checkin.estimated_sold_quantity
            : checkin.prepared_quantity - checkin.leftover_quantity),
          unit: checkin.unit,
          crowd_level: checkin.crowd_level,
        } as HistoryEntry;
      })
      .filter((entry): entry is HistoryEntry => entry !== null)
      .sort((left, right) => right.selling_date.localeCompare(left.selling_date)),
    error: null,
  };
}

export function getHistoryReflection(history: HistoryEntry[]): string {
  if (history.length < 2) return 'Keep recording your selling results to build a more useful history.';

  const grouped = new Map<string, HistoryEntry[]>();
  for (const entry of history) {
    const day = new Intl.DateTimeFormat('en-MY', { weekday: 'long' }).format(new Date(`${entry.selling_date}T12:00:00`));
    const key = `${day}|${entry.unit}`;
    const group = grouped.get(key) ?? [];
    group.push(entry);
    grouped.set(key, group);
  }
  const candidates = [...grouped.entries()].filter(([, sessions]) => sessions.length >= 2);
  if (candidates.length === 0) return 'Keep recording your selling results to build a more useful history.';

  candidates.sort(([, left], [, right]) => right.length - left.length);
  const [key, sessions] = candidates[0];
  const [day, unit] = key.split('|');
  const averageSold = Math.round(sessions.reduce((total, entry) => total + entry.estimated_sold_quantity, 0) / sessions.length);
  return `Your previous ${day} sessions averaged ${averageSold} ${unit} sold.`;
}
